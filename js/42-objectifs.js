// ═══ OBJECTIFS FINANCIERS & VENTES (19.09.2026) ═════════════════════════════════════════════
// Objectifs annuels saisis par Jonathan (table parametres_societe, clé 'objectifs_ventes',
// valeur { "2026": { revenu, acquisition, affaires, primes }, "2027": {…} }) et suivis en direct :
//   - socle RÉCURRENT (commissions de gestion annuelles du portefeuille) séparé entre la
//     récurrence SOURCÉE OZ (clients OZ Assure, production Assurex dès le 01.01.2027) et la
//     récurrence propre Assurex / EX ;
//   - VENTES de l'année : commissions d'acquisition (réalisées + attendues) des contrats signés
//     dans l'année, nombre de nouvelles affaires, volume de primes nouvelles ;
//   - rythme : où on devrait être aujourd'hui (prorata de l'année) et ce qu'il reste à vendre.

window._obj = window._obj || { annee: String(new Date().getFullYear()), cibles: null, charge: false, edition: false };

function objEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function objCharger() {
  const r = await dbGet('parametres_societe', 'cle=eq.objectifs_ventes&select=*');
  window._obj.cibles = (Array.isArray(r) && r[0] && r[0].valeur) || {};
  window._obj.charge = true;
  if (typeof ckRerendre === 'function') ckRerendre();
}

async function objEnregistrer() {
  const a = window._obj.annee;
  const lire = id => { const v = typeof nombreCH === 'function' ? nombreCH(document.getElementById(id)?.value || '') : parseFloat(document.getElementById(id)?.value); return Number.isFinite(v) && v > 0 ? v : null; };
  const cibles = { ...(window._obj.cibles || {}) };
  cibles[a] = { revenu: lire('obj-revenu'), acquisition: lire('obj-acquisition'), affaires: lire('obj-affaires'), primes: lire('obj-primes') };
  try {
    const jeton = (typeof getValidAccessToken === 'function' ? await getValidAccessToken() : null) || SUPABASE_KEY;
    const r = await fetch(SUPABASE_URL + '/rest/v1/parametres_societe', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ cle: 'objectifs_ventes', valeur: cibles, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) { showError('Objectifs non enregistrés (' + r.status + ').'); return; }
  } catch (e) { showError('Objectifs non enregistrés : connexion impossible.'); return; }
  window._obj.cibles = cibles; window._obj.edition = false;
  if (typeof logAction === 'function') logAction('objectifs_ventes', 'parametres_societe', null, `Objectifs ${a} mis à jour`);
  showError(`✓ Objectifs ${a} enregistrés.`);
  ckRerendre();
}

// Commission de gestion annuelle par contrat actif (dernière commission de gestion connue, réel
// si encaissée sinon estimation), séparée OZ / Assurex-EX selon l'entité du client.
function objRecurrence() {
  const parContrat = {};
  allCommissionsAttente.filter(ca => ca.nature === 'gestion' && ca.statut !== 'annulée' && ca.contrat_id).forEach(ca => {
    const p = parContrat[ca.contrat_id];
    if (!p || String(ca.date_creation || '') > String(p.date_creation || '')) parContrat[ca.contrat_id] = ca;
  });
  const res = { oz: 0, ozNb: 0, assurex: 0, assurexNb: 0, parCieOZ: {} };
  Object.values(parContrat).forEach(ca => {
    const ct = allContrats.find(c => c.id === ca.contrat_id);
    if (!ct || ct.commissionne === false || !['actif', 'renouveler'].includes(ct.statut)) return;
    const cl = allClients.find(c => c.id === ct.client_id);
    const m = Number(ca.montant_final ?? ca.montant_estime ?? 0);
    if (!m) return;
    if (cl && cl.source_oz) { res.oz += m; res.ozNb++; const k = (typeof normaliserCompagnie === 'function' ? normaliserCompagnie(ct.compagnie || '') : ct.compagnie) || '—'; res.parCieOZ[k] = (res.parCieOZ[k] || 0) + m; }
    else { res.assurex += m; res.assurexNb++; }
  });
  return res;
}

// Bandeau « Récurrence sourcée OZ » affiché en tête du tableau de bord et du cockpit
function htmlBandeauRecurrenceOZ() {
  if (typeof allCommissionsAttente === 'undefined' || !allCommissionsAttente.length) return '';
  const R = objRecurrence();
  if (!R.oz) return '';
  const chf = v => 'CHF ' + fmtCHF(Math.round(v));
  const cies = Object.entries(R.parCieOZ).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const part = R.oz + R.assurex ? Math.round(R.oz / (R.oz + R.assurex) * 100) : 0;
  return `<div class="rec-oz-bandeau" onclick="navigate('oz-assure')" role="button" tabindex="0" title="Voir la vue OZ Assure">
    <div class="rec-oz-titre"><span>Récurrence sourcée OZ</span><small>gestion annuelle — production Assurex dès le 01.01.2027</small></div>
    <div class="rec-oz-valeur">${chf(R.oz)}<small> / an</small></div>
    <div class="rec-oz-detail"><b>${R.ozNb}</b> contrat${R.ozNb > 1 ? 's' : ''} · <b>${part} %</b> de la récurrence totale (${chf(R.oz + R.assurex)})</div>
    <div class="rec-oz-cies">${cies.map(([k, v]) => `<span>${typeof pictoCompagnie === 'function' ? pictoCompagnie(k, 18) : ''} ${objEsc(k)} <b>${chf(v)}</b></span>`).join('')}</div>
  </div>`;
}

// Ventes de l'année : contrats signés (date de signature, à défaut début) dans l'année
function objVentes(annee) {
  const dansAnnee = d => String(d || '').startsWith(annee);
  const contrats = allContrats.filter(ct => ct.commissionne !== false && !['annulé'].includes(ct.statut) && !/^Police externe/.test(ct.modules || '')
    && dansAnnee(ct.date_signature || ct.date_debut) && String(ct.date_signature || ct.date_debut) >= (typeof DATE_BASCULE_ASSUREX !== 'undefined' ? DATE_BASCULE_ASSUREX.slice(0, 4) + '-01-01' : '2026-01-01'));
  const ids = new Set(contrats.map(c => c.id));
  const acq = allCommissionsAttente.filter(ca => ca.nature !== 'gestion' && ca.statut !== 'annulée' && ids.has(ca.contrat_id));
  const realise = acq.filter(ca => ['reçue', 'versé_oz'].includes(ca.statut)).reduce((s, ca) => s + Number(ca.montant_final ?? ca.montant_estime ?? 0), 0)
    + acq.filter(ca => ca.statut === 'en_attente').reduce((s, ca) => s + (typeof commissionDejaRecu === 'function' ? commissionDejaRecu(ca) : 0), 0);
  const attendu = acq.filter(ca => ['en_attente', 'en_attente_naissance'].includes(ca.statut)).reduce((s, ca) => s + (typeof commissionResteAttendu === 'function' ? commissionResteAttendu(ca) : Number(ca.montant_estime || 0)), 0);
  const parMois = Array.from({ length: 12 }, (_, i) => contrats.filter(ct => Number(String(ct.date_signature || ct.date_debut).slice(5, 7)) === i + 1).length);
  return { contrats, nb: contrats.length, primes: contrats.reduce((s, c) => s + Number(c.prime_annuelle || 0), 0), realise, attendu, acquisition: realise + attendu, parMois,
    panier: contrats.length ? (realise + attendu) / contrats.length : 0 };
}

function htmlObjectifs() {
  if (!window._obj.charge) { objCharger(); return '<div class="dbx-chargement"><span></span><span></span><span></span></div>'; }
  const a = window._obj.annee, an = Number(a);
  const C = (window._obj.cibles || {})[a] || {};
  const R = objRecurrence();
  const V = objVentes(a);
  const auj = new Date();
  const debut = new Date(an, 0, 1), fin = new Date(an + 1, 0, 1);
  const prorata = Math.min(1, Math.max(0, (auj - debut) / (fin - debut)));
  const ozCompte = an >= 2027; // la récurrence OZ devient production Assurex au 01.01.2027
  const recurrent = R.assurex + (ozCompte ? R.oz : 0);
  const revenuPrevu = recurrent + V.acquisition;
  const barre = (label, valeur, cible, fmt, sous) => {
    const pct = cible ? Math.min(100, Math.round(valeur / cible * 100)) : 0;
    const attendu = cible ? cible * prorata : 0;
    const enAvance = cible ? valeur >= attendu : true;
    return `<div class="obj-ligne">
      <div class="obj-tete"><b>${label}</b><span>${fmt(valeur)}${cible ? ` <small>/ ${fmt(cible)}</small>` : ''}</span></div>
      <div class="obj-piste">${cible ? `<i style="width:${pct}%;background:${enAvance ? '#22C55E' : '#F59E0B'}"></i><em style="left:${Math.round(prorata * 100)}%" title="Où on devrait être aujourd’hui"></em>` : '<i style="width:0"></i>'}</div>
      <div class="obj-pied">${cible ? `${pct} % · ${enAvance ? `<span style="color:#16A34A">en avance</span>` : `<span style="color:#D97706">retard de ${fmt(attendu - valeur)} sur le rythme</span>`}${sous ? ' · ' + sous : ''}` : `<button type="button" class="dbx-lien" onclick="window._obj.edition=true;ckRerendre()">fixer un objectif</button>${sous ? ' · ' + sous : ''}`}</div>
    </div>`;
  };
  const chf = v => 'CHF ' + fmtCHF(Math.round(v || 0));
  const nb = v => String(Math.round(v || 0));
  const moisRestants = an === auj.getFullYear() ? Math.max(1, 12 - auj.getMonth()) : an > auj.getFullYear() ? 12 : 1;
  const resteVentes = C.revenu ? Math.max(0, C.revenu - recurrent - V.acquisition) : null;
  const edit = window._obj.edition || !Object.keys(C).length;
  const annees = [String(auj.getFullYear()), String(auj.getFullYear() + 1)];
  return `
    <div class="sfx-intro">Objectifs annuels liés aux ventes. Le <strong>socle récurrent</strong> (gestion annuelle du portefeuille) est séparé de la <strong>récurrence sourcée OZ</strong>, qui devient production Assurex au 01.01.2027. Les ventes comptent les contrats signés dans l’année (commissions d’acquisition réalisées + attendues). Le repère vertical indique où il faudrait être aujourd’hui.</div>
    <div class="dbx-onglets" role="tablist" style="margin-bottom:12px">${annees.map(y => `<button type="button" class="${a === y ? 'actif' : ''}" onclick="window._obj.annee='${y}';window._obj.edition=false;ckRerendre()">${y}</button>`).join('')}
      <button type="button" onclick="window._obj.edition=!window._obj.edition;ckRerendre()">✎ ${Object.keys(C).length ? 'Modifier' : 'Fixer'} les objectifs ${a}</button></div>
    ${edit ? `<section class="dbx-carte"><header class="dbx-carte-tete"><h2>Objectifs ${a}</h2></header>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">Revenu total commissions (CHF)</label><input class="form-input" id="obj-revenu" inputmode="decimal" value="${C.revenu || ''}" placeholder="récurrent + ventes"/></div>
        <div class="form-field"><label class="form-label">Commissions d’acquisition — ventes (CHF)</label><input class="form-input" id="obj-acquisition" inputmode="decimal" value="${C.acquisition || ''}"/></div>
        <div class="form-field"><label class="form-label">Nouvelles affaires (nombre de contrats)</label><input class="form-input" id="obj-affaires" inputmode="numeric" value="${C.affaires || ''}"/></div>
        <div class="form-field"><label class="form-label">Volume de primes nouvelles (CHF)</label><input class="form-input" id="obj-primes" inputmode="decimal" value="${C.primes || ''}"/></div>
      </div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-top:8px">Repères : socle récurrent ${a} ${chf(recurrent)}${ozCompte ? ` (dont OZ ${chf(R.oz)})` : ` + récurrence OZ ${chf(R.oz)} dès 2027`} · panier moyen actuel ${chf(V.panier)} par affaire.</div>
      <div style="display:flex;gap:10px;margin-top:12px"><button class="btn-save" onclick="objEnregistrer()">✓ Enregistrer</button>${Object.keys(C).length ? `<button class="btn-secondary" onclick="window._obj.edition=false;ckRerendre()">Annuler</button>` : ''}</div>
    </section>` : ''}
    <div class="dbx-kpis">
      ${dbxKpi({ label: `Revenu prévu ${a}`, valeur: revenuPrevu, prefixe: 'CHF ', sous: C.revenu ? `objectif ${chf(C.revenu)} · ${Math.round(revenuPrevu / C.revenu * 100)} %` : 'récurrent + ventes', i: 0 })}
      ${dbxKpi({ label: 'Récurrence sourcée OZ', valeur: R.oz, prefixe: 'CHF ', sous: `${R.ozNb} contrats · ${ozCompte ? 'production Assurex' : 'Assurex dès le 01.01.2027'}`, i: 1 })}
      ${dbxKpi({ label: 'Récurrence Assurex / EX', valeur: R.assurex, prefixe: 'CHF ', sous: `${R.assurexNb} contrats · gestion annuelle`, i: 2 })}
      ${dbxKpi({ label: `Ventes ${a}`, valeur: V.acquisition, prefixe: 'CHF ', sous: `${V.nb} affaire${V.nb > 1 ? 's' : ''} · ${chf(V.realise)} déjà encaissés`, i: 3 })}
    </div>
    <div class="dbx-grille dbx-grille-egale">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Avancement ${a}</h2><span class="dbx-carte-sous">${Math.round(prorata * 100)} % de l’année écoulée</span></header>
        ${barre('Revenu total commissions', revenuPrevu, C.revenu, chf, `récurrent ${chf(recurrent)} + ventes ${chf(V.acquisition)}`)}
        ${barre('Commissions d’acquisition (ventes)', V.acquisition, C.acquisition, chf, `${chf(V.realise)} encaissés`)}
        ${barre('Nouvelles affaires', V.nb, C.affaires, nb)}
        ${barre('Primes nouvelles', V.primes, C.primes, chf)}
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Pour atteindre l’objectif</h2></header>
        ${C.revenu ? `<div class="obj-plan">
          <div><span>Objectif de revenu</span><b>${chf(C.revenu)}</b></div>
          <div><span>− Socle récurrent${ozCompte ? ' (Assurex + OZ)' : ' Assurex / EX'}</span><b>${chf(recurrent)}</b></div>
          <div><span>− Ventes déjà signées</span><b>${chf(V.acquisition)}</b></div>
          <div class="total"><span>Reste à vendre</span><b>${chf(resteVentes)}</b></div>
          ${resteVentes > 0 ? `<p>Soit environ <b>${chf(resteVentes / moisRestants)}</b> par mois${V.panier ? ` — ≈ <b>${Math.ceil(resteVentes / V.panier)}</b> affaires au panier moyen actuel (${chf(V.panier)})` : ''}.</p>` : '<p style="color:#16A34A;font-weight:700">✓ Objectif couvert par le socle et les ventes signées.</p>'}
          ${!ozCompte && R.oz ? `<p style="color:var(--text-muted)">En ${an + 1}, la récurrence OZ (${chf(R.oz)}) s’ajoutera au socle Assurex.</p>` : ''}
        </div>` : '<div class="dbx-vide-petit">Fixe un objectif de revenu pour voir ce qu’il reste à vendre.</div>'}
        <div class="obj-cies"><b>Récurrence sourcée OZ par compagnie</b>${Object.entries(R.parCieOZ).sort((x, y) => y[1] - x[1]).map(([k, v]) => `<div><span>${typeof pictoCompagnie === 'function' ? pictoCompagnie(k, 20) : ''} ${objEsc(k)}</span><b>${chf(v)}</b></div>`).join('') || '<div>—</div>'}</div>
      </section>
    </div>
    <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Nouvelles affaires par mois — ${a}</h2></header>
      <div class="obj-mois">${V.parMois.map((n, i) => { const cible = C.affaires ? C.affaires / 12 : 0; const max = Math.max(1, cible, ...V.parMois); return `<div><em style="height:${Math.round(n / max * 90)}px;background:${cible && n >= cible ? '#22C55E' : '#00CFFF'}"></em><small>${n || ''}</small><span>${['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</span></div>`; }).join('')}</div>
      ${C.affaires ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">Rythme cible : ${(C.affaires / 12).toFixed(1).replace('.', ',')} affaire(s) par mois (en vert : mois où il est atteint).</div>` : ''}
    </section>`;
}
