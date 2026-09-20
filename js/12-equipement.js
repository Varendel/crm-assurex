// ═══ ÉQUIPEMENT & VENTES CROISÉES (ajouté le 19.09.2026) ═════════════════════════════════════
// Pour chaque client, compare ses contrats actifs aux besoins de base de son profil (particulier
// ou entreprise) et fait ressortir ce qui manque — pour proposer le bon produit au bon client,
// en commençant par ceux qui ont déjà confiance (au moins un contrat chez nous).
//
// La reconnaissance se fait sur le libellé du produit (texte libre en base) par mots-clés, pour
// fonctionner aussi avec les anciens libellés. Nuances :
//   - un enfant (< 18 ans) est couvert par la RC/ménage et la protection juridique de ses parents
//     (pere_id / mere_id) et n'a pas besoin de 3e pilier ;
//   - le 3e pilier n'est proposé qu'entre 18 et 64 ans (ou âge inconnu).

const EQ_BESOINS = {
  prive: [
    { id: 'lamal', label: 'LAMal', court: 'LAMal', catalogue: 'lamal',
      match: p => /lamal|assurance de base/.test(p) && !/collectiv/.test(p) },
    { id: 'complementaire', label: 'Complémentaire santé', court: 'Compl.', catalogue: 'lca_autre_compagnie',
      match: p => /compl[ée]mentaire sant[ée]|\blca\b|helsana|dentaplus|hospital|myflex|gm (optimum|premium|global)|h-bonus/.test(p) && !/perte de gain/.test(p) },
    { id: 'rc_menage', label: 'RC privée / ménage', court: 'RC/Mén.', catalogue: 'rc_inventaire', famille: true,
      match: p => /rc priv[ée]e|m[ée]nage|inventaire du m/.test(p) },
    { id: 'prevoyance', label: '3e pilier', court: '3e pil.', catalogue: 'vie_3a', adulteActif: true,
      match: p => /3a|3b|pilier 3|assurance vie|libre passage|pr[ée]voyance (priv|enfant)/.test(p) },
    { id: 'pj', label: 'Protection juridique', court: 'PJ', catalogue: 'pj_privee', famille: true,
      match: p => /protection juridique/.test(p) },
  ],
  entreprise: [
    { id: 'rc_ent', label: 'RC entreprise', court: 'RC', catalogue: 'rc_entreprise',
      match: p => /rc (entreprise|professionnelle|commerce|d&o)|exploitation/.test(p) },
    { id: 'laa', label: 'LAA', court: 'LAA', catalogue: 'laa',
      // LAA de base uniquement (pas la LAAC ni les compléments « complémentaire LAA »)
      match: p => /assurance.accidents obligatoire/.test(p) || (/^laa\b/.test(p) && !/laac|compl[ée]mentaire/.test(p)) },
    { id: 'pgm', label: 'Perte de gain maladie', court: 'PG mal.', catalogue: 'perte_gain_maladie_lca',
      match: p => /perte de gain/.test(p) && /maladie/.test(p) },
    { id: 'lpp', label: 'LPP (2e pilier)', court: 'LPP', catalogue: 'lpp_entreprise',
      match: p => /\blpp\b|2e pilier/.test(p) },
    { id: 'choses', label: 'Choses / bâtiment', court: 'Choses', catalogue: 'choses_entreprise',
      match: p => /choses|inventaire commercial|b[âa]timent|perte d.exploitation/.test(p) },
    { id: 'pj_ent', label: 'Protection juridique', court: 'PJ', catalogue: 'pj_pro',
      match: p => /protection juridique/.test(p) },
  ],
};

let eqFiltres = { segment: 'prive', manque: '', vue: 'croisees', recherche: '' };

function eqEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function eqContratsActifs(clientId) {
  return allContrats.filter(ct => ct.client_id === clientId && ['actif', 'renouveler', 'en_cours'].includes(ct.statut));
}

function eqAge(c) {
  if (!c.date_naissance) return null;
  return typeof ageAujourdhui === 'function' ? ageAujourdhui(c.date_naissance) : null;
}

// Analyse d'un client : besoins applicables, couverts / manquants
function eqAnalyse(c) {
  const segment = estEntreprise(c) ? 'entreprise' : 'prive';
  const contrats = eqContratsActifs(c.id);
  const produits = contrats.map(ct => (ct.produit || '').toLowerCase());
  const age = eqAge(c);
  const enfant = segment === 'prive' && age !== null && age < 18;
  const parents = [c.pere_id, c.mere_id].filter(Boolean);
  const produitsParents = parents.flatMap(pid => eqContratsActifs(pid).map(ct => (ct.produit || '').toLowerCase()));

  const besoins = EQ_BESOINS[segment].filter(b => {
    if (b.adulteActif && age !== null && (age < 18 || age > 64)) return false;
    return true;
  }).map(b => {
    // « Chez nous » = contrat commissionné ; « ailleurs » = police externe connue (non commissionnée)
    const nous = contrats.filter(ct => ct.commissionne !== false && b.match((ct.produit || '').toLowerCase()));
    const externe = contrats.find(ct => ct.commissionne === false && b.match((ct.produit || '').toLowerCase())) || null;
    let couvert = nous.length > 0 || !!externe;
    let viaFamille = false;
    if (!couvert && b.famille && enfant && produitsParents.some(b.match)) { couvert = true; viaFamille = true; }
    return { ...b, couvert, viaFamille, ailleurs: !nous.length && !!externe, externe };
  });
  const couverts = besoins.filter(b => b.couvert).length;
  return {
    client: c, segment, contrats, besoins, couverts,
    manquants: besoins.filter(b => !b.couvert),
    taux: besoins.length ? couverts / besoins.length : 0,
    prime: contrats.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0),
  };
}

function eqOppOuverte(clientId, besoinId) {
  return allOpportunites.find(o => o.client_id === clientId && !['Gagné', 'Perdu'].includes(o.stade)
    && (o.titre || '').startsWith('Vente croisée') && (o.titre || '').includes(`[${besoinId}]`));
}

function viewEquipement() {
  setTimeout(renderEquipement, 0);
  return `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight: 600;color:var(--text)">Équipement &amp; ventes croisées</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Ce que chaque client a déjà chez nous et ce qui lui manque. Les meilleures cibles sont les clients qui ont déjà un contrat : la relation existe.</div>
    <div id="eq-stats" class="stat-grid" style="margin-bottom:20px"></div>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      ${[['prive', 'Particuliers'], ['entreprise', 'Entreprises']].map(([v, l]) =>
        `<button type="button" onclick="eqFiltres.segment='${v}';eqFiltres.manque='';renderEquipement()" class="${eqFiltres.segment === v ? 'btn-save' : 'btn-secondary'}" style="padding:7px 14px;font-size:12px">${l}</button>`).join('')}
      <span style="width:1px;height:24px;background:var(--border);margin:0 6px"></span>
      ${[['croisees', 'Ventes croisées (clients équipés)'], ['sans', 'Sans contrat actif']].map(([v, l]) =>
        `<button type="button" onclick="eqFiltres.vue='${v}';renderEquipement()" class="${eqFiltres.vue === v ? 'btn-save' : 'btn-secondary'}" style="padding:7px 14px;font-size:12px">${l}</button>`).join('')}
      <input type="search" class="form-input" placeholder="Filtrer par nom…" aria-label="Filtrer par nom" value="${eqEsc(eqFiltres.recherche)}" oninput="eqFiltres.recherche=this.value;renderEquipementListe()" style="max-width:220px;margin-left:auto"/>
    </div>
    <div id="eq-besoins" style="margin-bottom:18px"></div>
    <div id="eq-liste"></div>`;
}

function eqAnalysesSegment() {
  return allClients
    .filter(c => (c.statut || 'actif') !== 'inactif')
    .filter(c => (estEntreprise(c) ? 'entreprise' : 'prive') === eqFiltres.segment)
    .map(eqAnalyse);
}

function renderEquipement() {
  const zoneStats = document.getElementById('eq-stats');
  const zoneBesoins = document.getElementById('eq-besoins');
  if (!zoneStats || !zoneBesoins) return;
  // Met à jour l'état actif des boutons de filtre (ils font partie du gabarit, non régénéré)
  document.querySelectorAll('#main-content button[onclick^="eqFiltres.segment"], #main-content button[onclick^="eqFiltres.vue"]').forEach(b => {
    const m = b.getAttribute('onclick').match(/eqFiltres\.(segment|vue)='(\w+)'/);
    if (m) b.className = eqFiltres[m[1]] === m[2] ? 'btn-save' : 'btn-secondary';
  });

  const analyses = eqAnalysesSegment();
  const equipes = analyses.filter(a => a.contrats.length > 0);
  const sans = analyses.filter(a => a.contrats.length === 0);
  const mono = equipes.filter(a => a.contrats.length === 1);
  const tauxMoyen = equipes.length ? equipes.reduce((s, a) => s + a.taux, 0) / equipes.length : 0;
  const trous = equipes.reduce((s, a) => s + a.manquants.length, 0);
  const ailleurs = equipes.flatMap(a => a.besoins.filter(b => b.ailleurs));
  const bientot = ailleurs.filter(b => b.externe.date_echeance && (new Date(b.externe.date_echeance) - new Date()) / 864e5 < 200).length;
  zoneStats.innerHTML = `
    ${statCard('Clients équipés', equipes.length, '#38bdf8', `${sans.length} sans contrat actif`)}
    ${statCard('Taux d’équipement moyen', Math.round(tauxMoyen * 100) + ' %', '#4ade80', 'des besoins de base couverts')}
    ${statCard('Un seul contrat', mono.length, '#f59e0b', 'clients mono-équipés')}
    ${statCard('Ventes croisées possibles', trous, '#a78bfa', 'besoins non couverts chez des clients équipés')}
    ${statCard('Assurés ailleurs', ailleurs.length, '#8B5CF6', bientot ? `${bientot} échéance${bientot > 1 ? 's' : ''} dans les 6 mois — à transférer` : 'polices externes connues')}`;

  // Tableau des besoins : couverture et nombre de clients équipés à qui il manque ce besoin
  const besoinsDefs = EQ_BESOINS[eqFiltres.segment];
  zoneBesoins.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${besoinsDefs.length}, minmax(0, 1fr));gap:10px">
    ${besoinsDefs.map(b => {
      const applicables = equipes.filter(a => a.besoins.some(x => x.id === b.id));
      const couverts = applicables.filter(a => a.besoins.find(x => x.id === b.id).couvert).length;
      const manquent = applicables.length - couverts;
      const pct = applicables.length ? Math.round(couverts / applicables.length * 100) : 0;
      const actif = eqFiltres.manque === b.id;
      return `<button type="button" onclick="eqFiltres.manque=eqFiltres.manque==='${b.id}'?'':'${b.id}';eqFiltres.vue='croisees';renderEquipement()"
        style="text-align:left;background:${actif ? 'var(--accent-dim)' : 'var(--surface)'};border:1px solid ${actif ? 'var(--accent-border)' : 'var(--border)'};border-radius:12px;padding:12px 14px;cursor:pointer;color:var(--text)">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">${b.label}</div>
        <div style="font-size:20px;font-weight: 600">${pct} %</div>
        <div style="height:6px;border-radius:3px;background:var(--surface-alt);margin:6px 0"><div style="height:6px;border-radius:3px;width:${pct}%;background:#4ade80"></div></div>
        <div style="font-size:11.5px;color:${manquent ? '#f59e0b' : 'var(--text-muted)'}">${manquent} client${manquent > 1 ? 's' : ''} sans</div>
      </button>`;
    }).join('')}
  </div>
  ${eqFiltres.manque ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px">Filtre : clients équipés <strong style="color:var(--text)">sans ${eqEsc(besoinsDefs.find(b => b.id === eqFiltres.manque)?.label || '')}</strong> — <a href="#" onclick="eqFiltres.manque='';renderEquipement();return false" style="color:var(--accent)">retirer le filtre</a></div>` : ''}`;

  renderEquipementListe();
}

function renderEquipementListe() {
  const zone = document.getElementById('eq-liste');
  if (!zone) return;
  const q = (eqFiltres.recherche || '').trim().toLowerCase();
  let liste = eqAnalysesSegment().filter(a => eqFiltres.vue === 'sans' ? a.contrats.length === 0 : a.contrats.length > 0);
  if (eqFiltres.vue === 'croisees') {
    liste = liste.filter(a => a.manquants.length > 0);
    if (eqFiltres.manque) liste = liste.filter(a => a.manquants.some(b => b.id === eqFiltres.manque));
  }
  if (q) liste = liste.filter(a => `${a.client.prenom || ''} ${a.client.nom || ''}`.toLowerCase().includes(q));
  // Priorité : clients les plus équipés d'abord (relation la plus forte), puis la plus grosse prime
  liste.sort((a, b) => (b.couverts - a.couverts) || (b.prime - a.prime));

  if (!liste.length) { zone.innerHTML = '<div class="table-empty">Aucun client dans cette liste.</div>'; return; }

  if (eqFiltres.vue === 'sans') {
    const cols = '1.4fr 1fr 120px 1.2fr 150px';
    zone.innerHTML = `<div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}"><div>Client</div><div>Contact</div><div>Statut</div><div>Contrats passés</div><div></div></div>
      ${liste.map(a => {
        const c = a.client;
        const passes = allContrats.filter(ct => ct.client_id === c.id).length;
        return `<div class="table-row" style="grid-template-columns:${cols};align-items:center">
          <a href="?client=${c.id}" onclick="return irVersClient(event, '${c.id}')" style="font-weight: 600;font-size:13px;color:var(--text);text-decoration:none">${eqEsc(estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`)}</a>
          <div style="font-size:11.5px;color:var(--text-muted)">${eqEsc(c.email || '—')}<br>${eqEsc(c.mobile || c.tel || '')}</div>
          <div>${badge(c.statut || 'actif', c.statut === 'prospect' ? '#a78bfa' : '#64748b')}</div>
          <div style="font-size:12px;color:var(--text-muted)">${passes ? `${passes} contrat(s) résilié(s) ou annulé(s)` : 'Aucun contrat enregistré'}</div>
          <div style="text-align:right"><button type="button" onclick="eqCreerTacheContact('${c.id}')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:5px 10px;font-size:11px;font-weight: 500;cursor:pointer">+ Tâche de contact</button></div>
        </div>`;
      }).join('')}
    </div>`;
    return;
  }

  const cols = '1.3fr 90px 2.4fr 110px';
  zone.innerHTML = `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${liste.length} client${liste.length > 1 ? 's' : ''} — clique sur un besoin manquant pour créer l’opportunité correspondante.</div>
    <div class="table-wrap">
    <div class="table-header" style="grid-template-columns:${cols}"><div>Client</div><div>Équipement</div><div>Besoins</div><div>Primes/an</div></div>
    ${liste.map(a => {
      const c = a.client;
      const age = eqAge(c);
      return `<div class="table-row" style="grid-template-columns:${cols};align-items:center">
        <div><a href="?client=${c.id}" onclick="return irVersClient(event, '${c.id}')" style="font-weight: 600;font-size:13px;color:var(--text);text-decoration:none">${eqEsc(estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`)}</a>
          <div style="font-size:11px;color:var(--text-muted)">${a.contrats.length} contrat${a.contrats.length > 1 ? 's' : ''}${age !== null && !estEntreprise(c) ? ` · ${age} ans` : ''}</div></div>
        <div style="font-size:13px;font-weight: 600;color:var(--text)">${a.couverts}/${a.besoins.length}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${a.besoins.map(b => {
            const opp = eqOppOuverte(c.id, b.id);
            if (b.ailleurs) {
              const x = b.externe, ech = x.date_echeance ? fmtDate(x.date_echeance) : null;
              const proche = x.date_echeance && (new Date(x.date_echeance) - new Date()) / 864e5 < 200;
              return `<button type="button" onclick="${opp ? `opportuniteEnEditionId='${opp.id}';navigate('nouvelle-opportunite')` : `eqCreerOpportunite('${c.id}', '${b.id}', true)`}" title="Assuré ailleurs${x.compagnie ? ' : ' + eqEsc(x.compagnie) : ''}${ech ? ' — échéance ' + ech : ''} · clic : ${opp ? 'ouvrir l’opportunité' : 'proposer un transfert'}" style="font-size:11px;padding:3px 8px;border-radius:999px;background:${proche ? 'rgba(167,139,250,0.14)' : 'var(--surface-alt)'};color:${proche ? '#8B5CF6' : 'var(--text-muted)'};border:1px solid ${proche ? 'rgba(139,92,246,0.4)' : 'var(--border)'};cursor:pointer">${opp ? '🎯' : '◌'} ${b.court}${x.compagnie ? ' · ' + eqEsc(x.compagnie.split(' ')[0]) : ''}${proche && ech ? ' · ' + ech : ''}</button>`;
            }
            if (b.couvert) return `<span title="${eqEsc(b.label)}${b.viaFamille ? ' (via les parents)' : ''}" style="font-size:11px;padding:3px 8px;border-radius:999px;background:color-mix(in srgb, var(--c-succes) 12%, transparent);color:var(--c-succes-texte);border:1px solid color-mix(in srgb, var(--c-succes) 30%, transparent)">✓ ${b.court}</span>`;
            if (opp) return `<button type="button" onclick="opportuniteEnEditionId='${opp.id}';navigate('nouvelle-opportunite')" title="Opportunité déjà ouverte" style="font-size:11px;padding:3px 8px;border-radius:999px;background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);cursor:pointer">🎯 ${b.court}</button>`;
            return `<span style="display:inline-flex"><button type="button" onclick="eqCreerOpportunite('${c.id}', '${b.id}')" title="Créer une opportunité : ${eqEsc(b.label)}" style="font-size:11px;padding:3px 8px;border-radius:999px 0 0 999px;background:transparent;color:var(--c-alerte-texte);border:1px dashed color-mix(in srgb, var(--c-alerte) 60%, transparent);cursor:pointer">+ ${b.court}</button><button type="button" onclick="eqMarquerAilleurs('${c.id}', '${b.id}')" title="Déjà assuré ailleurs : saisir la police externe (compagnie, échéance)" style="font-size:11px;padding:3px 7px;border-radius:0 999px 999px 0;background:transparent;color:var(--text-muted);border:1px dashed var(--border);border-left:none;cursor:pointer">ailleurs</button></span>`;
          }).join('')}
        </div>
        <div style="font-weight: 600;color:var(--c-alerte-texte)">CHF ${fmtCHF(Math.round(a.prime))}</div>
      </div>`;
    }).join('')}
  </div>`;
}

// Produit enregistré pour une police externe (libellé reconnu par le besoin correspondant)
const EQ_PRODUIT_EXTERNE = {
  lamal: 'Assurance maladie (LAMal)', complementaire: 'Complémentaire santé', rc_menage: 'RC + inventaire du ménage',
  prevoyance: 'Assurance vie liée 3a (pilier 3a)', pj: 'Protection juridique privée', rc_ent: 'RC entreprise / exploitation',
  laa: 'LAA (assurance-accidents obligatoire)', pgm: 'Perte de gain maladie collective', lpp: 'LPP collective (2e pilier entreprise)',
  choses: 'Choses entreprise (inventaire commercial)', pj_ent: 'Protection juridique professionnelle / entreprise',
};

// « Assuré ailleurs » : la police externe est saisie comme contrat NON commissionné (compagnie,
// échéance, prime si connue) — le besoin n'est plus « manquant » mais « chez un concurrent »,
// avec une piste de transfert à l'échéance (19.09.2026).
function eqMarquerAilleurs(clientId, besoinId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const besoin = EQ_BESOINS[estEntreprise(c) ? 'entreprise' : 'prive'].find(b => b.id === besoinId);
  if (!besoin) return;
  const cies = [...new Set((allContrats || []).map(ct => ct.compagnie).filter(Boolean))].sort();
  creerModale('modal-eq-ailleurs', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:420px;width:100%">
      <div style="font-size:16px;font-weight: 600;margin-bottom:4px">${eqEsc(besoin.label)} — assuré ailleurs</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${eqEsc(estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`)} · la police est enregistrée comme contrat <strong>non commissionné</strong>, pour préparer un transfert à l'échéance.</div>
      <div class="form-field"><label class="form-label">Compagnie actuelle</label><input class="form-input" id="eqa-cie" list="eqa-cies" placeholder="ex. Helsana, AXA…"/><datalist id="eqa-cies">${cies.map(n => `<option value="${eqEsc(n)}">`).join('')}</datalist></div>
      <div class="form-field" style="margin-top:10px"><label class="form-label">Échéance (si connue)</label><input class="form-input" id="eqa-ech" type="date"/></div>
      <div class="form-field" style="margin-top:10px"><label class="form-label">Prime annuelle (si connue)</label><input class="form-input" id="eqa-prime" inputmode="decimal" placeholder="CHF"/></div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn-secondary" style="flex:1" onclick="document.getElementById('modal-eq-ailleurs').remove()">Annuler</button>
        <button class="btn-save" style="flex:1" onclick="eqEnregistrerAilleurs('${clientId}','${besoinId}')">Enregistrer</button>
      </div>
    </div>`, { opacite: 0.6, padding: '16px', overflowY: false });
}

async function eqEnregistrerAilleurs(clientId, besoinId) {
  const cie = (document.getElementById('eqa-cie')?.value || '').trim();
  const ech = document.getElementById('eqa-ech')?.value || null;
  const prime = typeof nombreCH === 'function' ? nombreCH(document.getElementById('eqa-prime')?.value || '') : parseFloat(document.getElementById('eqa-prime')?.value);
  const signataire = allAgents.find(a => a.role === 'signataire');
  const body = {
    client_id: clientId, compagnie: cie ? (typeof normaliserCompagnie === 'function' ? normaliserCompagnie(cie) : cie) : 'Autre compagnie',
    produit: EQ_PRODUIT_EXTERNE[besoinId] || besoinId, statut: 'actif', commissionne: false, date_echeance: ech,
    prime_annuelle: Number.isFinite(prime) && prime > 0 ? prime : 0, periodicite: 1,
    modules: 'Police externe — assuré ailleurs (saisie depuis Équipement)', apporteur_id: signataire ? signataire.id : null,
  };
  const r = await dbPost('contrats', body);
  if (r && r.error) { showError('Police externe non enregistrée : ' + errMsg(r)); return; }
  logAction('create_contrat', 'contrats', r && r[0] ? r[0].id : null, `Police externe (assuré ailleurs) — ${body.produit} — ${body.compagnie}`);
  allContrats = await dbGet('contrats', 'select=*');
  document.getElementById('modal-eq-ailleurs')?.remove();
  showError(`✓ Enregistré : assuré ailleurs (${body.compagnie})${ech ? `, échéance ${fmtDate(ech)}` : ''}.`);
  renderEquipement();
}

async function eqCreerOpportunite(clientId, besoinId, transfert) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const segment = estEntreprise(c) ? 'entreprise' : 'prive';
  const besoin = EQ_BESOINS[segment].find(b => b.id === besoinId);
  if (!besoin || eqOppOuverte(clientId, besoinId)) return;
  const signataire = allAgents.find(a => a.role === 'signataire');
  const moi = allAgents.find(a => a.email === (currentUser && currentUser.email));
  const externe = transfert ? eqContratsActifs(clientId).find(ct => ct.commissionne === false && besoin.match((ct.produit || '').toLowerCase())) : null;
  // Transfert : échéance de l'opportunité = 4 mois avant l'échéance de la police externe (préavis)
  let echeanceOpp = new Date(Date.now() + 30 * 86400000);
  if (externe && externe.date_echeance) { const d = new Date(externe.date_echeance); d.setMonth(d.getMonth() - 4); if (d > new Date()) echeanceOpp = d; }
  const dans30j = echeanceOpp.toISOString().split('T')[0];
  const body = {
    titre: `Vente croisée — ${transfert ? 'Transfert ' : ''}${besoin.label} [${besoin.id}]`,
    client_id: clientId,
    stade: 'Contact',
    probabilite: 30,
    montant_potentiel: 0,
    date_echeance: dans30j,
    apporteur_id: (moi || signataire || {}).id || null,
    produits: [besoin.catalogue],
    notes: externe
      ? `Créée depuis « Équipement & ventes croisées » : ${besoin.label.toLowerCase()} actuellement chez ${externe.compagnie || 'une autre compagnie'}${externe.date_echeance ? ` (échéance ${fmtDate(externe.date_echeance)} — résilier avant le préavis)` : ''}. Proposer une comparaison et un transfert.`
      : `Créée depuis « Équipement & ventes croisées » : le client n'a pas encore de ${besoin.label.toLowerCase()} chez nous.`,
  };
  const r = await dbPost('opportunites', body);
  if (r && r.error) { showError('Opportunité non créée : ' + errMsg(r)); return; }
  allOpportunites = await dbGet('opportunites', 'select=*');
  logAction('vente_croisee', 'opportunites', clientId, besoin.label);
  showError(`✓ Opportunité « ${besoin.label} » créée (stade Contact, échéance ${fmtDate(dans30j)}).`);
  renderEquipementListe();
}

async function eqCreerTacheContact(clientId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const dans7j = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const r = await dbPost('rappels', {
    titre: 'Reprendre contact — client sans contrat actif',
    client_id: clientId, type: 'Suivi', nature: 'rappel', urgence: 'basse', statut: 'ouvert',
    date_echeance: dans7j,
    notes: `${estEntreprise(c) ? c.nom : c.prenom + ' ' + c.nom} n'a aucun contrat actif chez nous. Faire le point sur sa situation et ses besoins.`,
  });
  if (r && r.error) { showError('Tâche non créée : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  showError(`✓ Tâche de contact créée pour le ${fmtDate(dans7j)}.`);
}
