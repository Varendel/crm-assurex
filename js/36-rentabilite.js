// ═══ RENTABILITÉ PAR PRODUIT & RECOMMANDATIONS (19.09.2026) ═════════════════════════════════
// Onglet du Cockpit financier :
//   - rentabilité par famille de produits : commissions encaissées (Assurex + versées à OZ) et
//     attendues, part récurrente (gestion) vs unique (acquisition), taux moyen sur la prime,
//     valeur moyenne d'un contrat sur 3 ans ;
//   - produits à pousser : valeur moyenne × nombre de clients qui ne l'ont pas encore ;
//   - recommandations client par client (besoins manquants de « Équipement & ventes croisées »,
//     js/12), classées par valeur attendue, avec création de l'opportunité en un clic.
// Valeur sur 3 ans = acquisition moyenne + 3 × gestion annuelle moyenne (à défaut de mieux : une
// base simple et explicable, qui s'affine avec les décomptes importés).

window._rtSegment = window._rtSegment || 'tous';

const RT_FAMILLES = [
  { id: 'sante', l: 'Santé (LAMal / LCA)', re: /lamal|\blca\b|compl[ée]mentaire sant|assurance maladie \(|sant[ée]|optimum|global smart|dentaire|h-capital|hospital/i },
  { id: 'pgm', l: 'Perte de gain', re: /perte de gain|maladie collective/i },
  { id: 'lpp', l: 'LPP', re: /\blpp\b|2e pilier/i },
  { id: 'accidents', l: 'Accidents (LAA)', re: /\blaa|accident/i },
  { id: 'vie', l: 'Vie / 3e pilier', re: /\bvie\b|3a|3b|pilier/i },
  { id: 'vehicules', l: 'Véhicules', re: /v[ée]hicule|casco|flotte|avenue|auto/i },
  { id: 'rc', l: 'RC', re: /\brc\b|responsabilit/i },
  { id: 'pj', l: 'Protection juridique', re: /juridique/i },
  { id: 'menage', l: 'Ménage / bâtiment', re: /m[ée]nage|inventaire|b[âa]timent|choses/i },
];
function rtFamille(produit) { const f = RT_FAMILLES.find(x => x.re.test(produit || '')); return f ? f.id : 'autres'; }
function rtEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// Chiffres par contrat : acquisition, gestion annuelle, encaissé, attendu
function rtParContrat() {
  const res = {};
  allCommissionsAttente.forEach(ca => {
    if (!ca.contrat_id || ['annulée', 'annulé'].includes(ca.statut)) return;
    const r = res[ca.contrat_id] = res[ca.contrat_id] || { acq: 0, gest: 0, enc: 0, att: 0 };
    const m = Number(ca.montant_final ?? ca.montant_estime ?? 0);
    const recuTr = typeof commissionDejaRecu === 'function' ? commissionDejaRecu(ca) : 0;
    if (ca.nature === 'gestion') r.gest = Math.max(r.gest, Number(ca.montant_estime || m)); // une année de gestion
    else r.acq += m;
    if (['reçue', 'versé_oz'].includes(ca.statut)) r.enc += m;
    else { r.enc += recuTr; r.att += Math.max(0, Number(ca.montant_estime || 0) - recuTr); }
  });
  return res;
}

function rtDonnees() {
  const parContrat = rtParContrat();
  const actifs = allContrats.filter(ct => ['actif', 'renouveler', 'en_cours'].includes(ct.statut));
  const fam = {};
  const seg = ct => { const c = allClients.find(x => x.id === ct.client_id); return c && estEntreprise(c) ? 'entreprise' : 'prive'; };
  actifs.forEach(ct => {
    if (window._rtSegment !== 'tous' && seg(ct) !== window._rtSegment) return;
    const id = rtFamille(ct.produit);
    const f = fam[id] = fam[id] || { id, nb: 0, nbComm: 0, primes: 0, acq: 0, gest: 0, enc: 0, att: 0 };
    const p = parContrat[ct.id];
    f.nb++; f.primes += Number(ct.prime_annuelle || 0);
    if (p) { f.nbComm++; f.acq += p.acq; f.gest += p.gest; f.enc += p.enc; f.att += p.att; }
  });
  const liste = Object.values(fam).map(f => {
    const n = f.nbComm || 1;
    const valeur3 = f.acq / n + 3 * f.gest / n;
    return { ...f, label: (RT_FAMILLES.find(x => x.id === f.id) || { l: 'Autres' }).l, total: f.enc + f.att, valeur3, gestMoy: f.gest / n, acqMoy: f.acq / n,
      taux: f.primes ? (f.acq + f.gest) / f.primes : 0 };
  }).sort((a, b) => b.total - a.total);
  return { liste, parContrat };
}

// Valeur moyenne sur 3 ans d'un besoin d'équipement (js/12), mesurée sur les contrats qui le couvrent
function rtValeurBesoin(besoin, parContrat) {
  const cts = allContrats.filter(ct => besoin.match((ct.produit || '').toLowerCase()) && parContrat[ct.id]);
  if (!cts.length) return { valeur: 0, nb: 0 };
  const v = cts.reduce((s, ct) => s + parContrat[ct.id].acq + 3 * parContrat[ct.id].gest, 0) / cts.length;
  return { valeur: v, nb: cts.length };
}

function htmlCockpitRentabilite() {
  const { liste, parContrat } = rtDonnees();
  const tot = liste.reduce((s, f) => s + f.total, 0) || 1;
  const recurrent = liste.reduce((s, f) => s + f.gest, 0);
  const unique = liste.reduce((s, f) => s + f.acq, 0);
  const max = Math.max(1, ...liste.map(f => f.total));

  // Recommandations : besoins manquants des clients déjà équipés, valorisés
  const valeurs = {};
  ['prive', 'entreprise'].forEach(s => (typeof EQ_BESOINS !== 'undefined' ? EQ_BESOINS[s] : []).forEach(b => { valeurs[`${s}:${b.id}`] = rtValeurBesoin(b, parContrat); }));
  const recos = [];
  if (typeof eqAnalyse === 'function') {
    allClients.filter(c => (c.statut || 'actif') !== 'inactif').forEach(c => {
      const a = eqAnalyse(c);
      if (!a.contrats.length) return; // les clients déjà équipés : la relation existe
      if (window._rtSegment !== 'tous' && a.segment !== window._rtSegment) return;
      a.manquants.forEach(b => {
        const v = valeurs[`${a.segment}:${b.id}`];
        if (!v || !v.valeur || (typeof eqOppOuverte === 'function' && eqOppOuverte(c.id, b.id))) return;
        recos.push({ c, a, b, valeur: v.valeur });
      });
    });
  }
  recos.sort((x, y) => y.valeur - x.valeur);
  // Produits à pousser : valeur moyenne × clients équipés qui ne l'ont pas
  const pousser = {};
  recos.forEach(r => { const k = `${r.a.segment}:${r.b.id}`; const p = pousser[k] = pousser[k] || { label: r.b.label, segment: r.a.segment, valeur: r.valeur, nb: 0 }; p.nb++; });
  const aPousser = Object.values(pousser).map(p => ({ ...p, potentiel: p.valeur * p.nb })).sort((a, b) => b.potentiel - a.potentiel).slice(0, 8);
  const maxPot = Math.max(1, ...aPousser.map(p => p.potentiel));

  const segBtns = [['tous', 'Tous'], ['prive', 'Privés'], ['entreprise', 'Entreprises']].map(([v, l]) => `<button type="button" class="${window._rtSegment === v ? 'actif' : ''}" onclick="window._rtSegment='${v}';ckRerendre()">${l}</button>`).join('');
  return `
    <div class="dbx-onglets rt-segments" role="tablist">${segBtns}</div>
    <div class="dbx-kpis">
      ${dbxKpi({ label: 'Commissions (encaissé + attendu)', valeur: tot === 1 ? 0 : tot, prefixe: 'CHF ', sous: `${liste.reduce((s, f) => s + f.nb, 0)} contrats actifs`, i: 0 })}
      ${dbxKpi({ label: 'Récurrent par an (gestion)', valeur: recurrent, prefixe: 'CHF ', sous: 'revient chaque année', i: 1 })}
      ${dbxKpi({ label: 'Acquisition (unique)', valeur: unique, prefixe: 'CHF ', sous: 'une seule fois par contrat', i: 2 })}
      ${dbxKpi({ label: 'Potentiel des recommandations', valeur: recos.reduce((s, r) => s + r.valeur, 0), prefixe: 'CHF ', sous: `${recos.length} produit${recos.length > 1 ? 's' : ''} à proposer · sur 3 ans`, i: 3 })}
    </div>
    <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Rentabilité par produit</h2><span class="dbx-carte-sous">valeur 3 ans = acquisition + 3 × gestion annuelle, moyenne par contrat</span></header>
      <div class="sfx-table rt-table">
        <div class="sfx-tr sfx-th"><span>Produit</span><span>Contrats</span><span>Encaissé</span><span>Attendu</span><span>Récurrent / an</span><span>Taux / prime</span><span>Valeur 3 ans</span></div>
        ${liste.map(f => `<div class="sfx-tr">
          <span class="rt-nom"><b>${rtEsc(f.label)}</b><span class="dbx-hbarre-piste"><span style="--w:${Math.round(f.total / max * 100)}%;width:${Math.round(f.total / max * 100)}%"></span></span></span>
          <span>${f.nb}</span><span>CHF ${fmtCHF(Math.round(f.enc))}</span><span>CHF ${fmtCHF(Math.round(f.att))}</span>
          <span class="${f.gest ? 'rt-recurrent' : 'rt-dim'}">${f.gest ? 'CHF ' + fmtCHF(Math.round(f.gest)) : '—'}</span>
          <span>${f.taux ? (Math.round(f.taux * 1000) / 10).toString().replace('.', ',') + ' %' : '—'}</span>
          <span><b>CHF ${fmtCHF(Math.round(f.valeur3))}</b></span>
        </div>`).join('')}
      </div>
      <div class="sfx-note">Lecture : la santé rapporte beaucoup en volume mais une seule fois ; les produits avec un « récurrent / an » élevé (gestion) construisent le revenu durable. Les estimations génériques à 10 % sous-évaluent certaines acquisitions (voir Précision des estimations).</div>
    </section>
    <div class="dbx-grille" style="margin-top:18px">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Recommandations</h2><span class="dbx-carte-sous">clients déjà équipés · produit manquant le plus rentable</span></header>
        ${recos.length ? `<div class="sfx-liste">${recos.slice(0, 25).map(r => {
          const nom = estEntreprise(r.c) ? r.c.nom : `${r.c.prenom || ''} ${r.c.nom || ''}`.trim();
          return `<div class="sfx-ligne rt-reco">
            <span class="sfx-corps"><b>${rtEsc(nom)}</b><small>${r.a.segment === 'entreprise' ? 'Entreprise' : 'Privé'} · a déjà ${r.a.couverts}/${r.a.besoins.length} · manque : ${r.a.manquants.map(m => rtEsc(m.court)).join(', ')}</small></span>
            <span class="rt-produit">${rtEsc(r.b.label)}</span>
            <span class="sfx-montant">≈ CHF ${fmtCHF(Math.round(r.valeur))}</span>
            <button type="button" class="ck-ouvrir" onclick="rtCreerOpportunite('${r.c.id}','${r.b.id}')">🎯 Proposer</button>
          </div>`;
        }).join('')}</div>${recos.length > 25 ? `<div class="dbx-vide-petit">+ ${recos.length - 25} autres — voir « Équipement & ventes croisées ».</div>` : ''}` : '<div class="dbx-vide-petit">Aucune recommandation : les clients équipés ont déjà tous les produits suivis, ou les opportunités sont ouvertes.</div>'}
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Produits à pousser</h2><span class="dbx-carte-sous">valeur moyenne × clients sans le produit</span></header>
        ${aPousser.length ? `<div class="dbx-hbarres">${aPousser.map((p, i) => `<div class="dbx-hbarre" style="--i:${i}">
          <span class="dbx-hbarre-nom"><span class="dbx-point" style="background:${p.segment === 'entreprise' ? '#F59E0B' : '#22C55E'}"></span><span>${rtEsc(p.label)}</span></span>
          <span class="dbx-hbarre-piste"><span style="--w:${Math.round(p.potentiel / maxPot * 100)}%"></span></span>
          <span class="dbx-hbarre-val">${dbxCompact(p.potentiel)}<small>${p.nb} client${p.nb > 1 ? 's' : ''}</small></span></div>`).join('')}</div>
        <div class="sfx-note">🟢 privés · 🟠 entreprises. Potentiel sur 3 ans si chaque client concerné signe.</div>` : '<div class="dbx-vide-petit">—</div>'}
      </section>
    </div>`;
}

async function rtCreerOpportunite(clientId, besoinId) {
  if (typeof eqCreerOpportunite !== 'function') return;
  // eqCreerOpportunite rafraîchit sa propre liste si elle est affichée : on neutralise cet effet ici
  const sauve = window.renderEquipementListe;
  window.renderEquipementListe = () => {};
  try { await eqCreerOpportunite(clientId, besoinId); } finally { window.renderEquipementListe = sauve; }
  ckRerendre();
}
