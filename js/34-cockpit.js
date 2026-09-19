// ═══ COCKPIT FINANCIER (19.09.2026) ═════════════════════════════════════════════════════════
// Deux onglets ajoutés au Suivi financier (js/29), devenu « Cockpit financier » :
//   - Vue d'ensemble : trésorerie, solde prévu, flux entrants / sortants sur 12 mois (plan de
//     trésorerie js/21, gestion récurrente projetée js/19, factures QR js/33), prochains
//     encaissements et charges, alertes ;
//   - Contrôle : détection des anomalies probables dans les commissions (déjà payées, doublons,
//     montants nuls, contrats non commissionnés, retards, orphelins…), avec accès direct.

window._ck = window._ck || { lignesChargees: false, factures: null };

function ckEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function ckIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function ckRerendre() {
  const main = document.getElementById('main-content');
  if (main && currentView === 'suivi-financier' && typeof viewSuiviFinancierV2 === 'function') main.innerHTML = viewSuiviFinancierV2();
}

async function ckCharger() {
  const [lignes, factures] = await Promise.all([
    dbGet('tresorerie_lignes', 'actif=eq.true&select=*&order=date_debut.asc'),
    dbGet('factures', 'statut=in.(emise,payee)&select=id,numero,montant,statut,date_emission,date_echeance,paye_le,debiteur'),
  ]);
  if (Array.isArray(lignes)) { _tr.lignes = lignes; _tr.charge = true; }
  window._ck.factures = Array.isArray(factures) ? factures : [];
  window._ck.lignesChargees = true;
  ckRerendre();
}

// ── Vue d'ensemble ──────────────────────────────────────────────────────────────────────────
function htmlCockpitEnsemble(D) {
  if (!window._ck.lignesChargees) {
    setTimeout(ckCharger, 0);
    return '<section class="dbx-carte"><div class="dbx-chargement"><span></span><span></span><span></span></div></section>';
  }
  const ancienHorizon = _tr.horizon; _tr.horizon = 12;
  const R = trCalculer();
  _tr.horizon = ancienHorizon;
  const auj = ckIso(new Date());
  const dans = j => ckIso(new Date(Date.now() + j * 86400000));
  const trois = R.parMois.slice(0, 3);
  const entrees90 = trois.reduce((s, x) => s + x.entrees, 0), sorties90 = trois.reduce((s, x) => s + x.sorties, 0);
  const soldeDans3 = R.parMois[2] ? R.parMois[2].fin : 0;
  const factures = window._ck.factures || [];
  const aEncaisser = factures.filter(f => f.statut === 'emise');
  const facturesRetard = aEncaisser.filter(f => f.date_echeance && f.date_echeance < auj);
  const somme = obj => Object.values(obj).reduce((s, v) => s + v, 0);
  const autres = R.entrees.reduce((s, x) => s + somme(x.serie), 0);
  const compo = [
    { l: 'Gestion en attente', v: somme(R.gestion), c: '#00CFFF' },
    { l: 'Gestion des années suivantes', v: somme(R.recurrente || {}), c: '#5B82C9' },
    { l: 'Acquisition', v: somme(R.acquisition), c: '#22C55E' },
    { l: 'Autres encaissements', v: autres, c: '#F59E0B' },
    ...(somme(R.pipeline) ? [{ l: 'Pipeline pondéré', v: somme(R.pipeline), c: '#A78BFA' }] : []),
  ];
  const maxCompo = Math.max(1, ...compo.map(x => x.v));

  // Prochains encaissements (60 jours) : commissions datées, projections, factures
  const prochains = [];
  allCommissionsAttente.filter(ca => ca.statut === 'en_attente' && sfxCompte(ca)).forEach(ca => {
    const parts = typeof commissionEcheancier === 'function' ? commissionEcheancier(ca, D.reste(ca)) : [];
    parts.forEach((pt, i) => { if (pt.date >= auj && pt.date <= dans(60)) prochains.push({ date: pt.date, montant: pt.montant, titre: ca.client_nom || '—', sous: `${ca.produit || ''} · gestion${parts.length > 1 ? ` (versement ${i + 1}/${parts.length})` : ''}`, cie: ca.compagnie }); });
  });
  if (typeof projectionGestionRecurrente === 'function') projectionGestionRecurrente(dans(60)).forEach(p => {
    const cl = allClients.find(c => c.id === p.contrat.client_id);
    prochains.push({ date: p.date, montant: p.montant, titre: cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`) : '—', sous: `${p.contrat.produit || ''} · gestion ${p.echeance.slice(0, 4)} (projection)`, cie: p.contrat.compagnie });
  });
  aEncaisser.filter(f => f.date_echeance && f.date_echeance <= dans(60)).forEach(f => prochains.push({ date: f.date_echeance, montant: Number(f.montant || 0), titre: `Facture ${f.numero}`, sous: (f.debiteur && f.debiteur.nom) || '', facture: true }));
  prochains.sort((a, b) => a.date.localeCompare(b.date));

  // Charges des deux prochains mois
  const moisCh = R.mois.slice(0, 2);
  const charges = R.sorties.map(x => ({ l: x.ligne, montants: moisCh.map(m => x.serie[m]) })).filter(x => x.montants.some(Boolean)).sort((a, b) => (b.montants[0] + b.montants[1]) - (a.montants[0] + a.montants[1]));

  const alertes = [];
  if (!R.solde) alertes.push({ ton: 'orange', icone: '🏦', texte: 'Aucun solde bancaire saisi : les soldes prévus partent de zéro.', action: "navigate('tresorerie')", bouton: 'Saisir' });
  if (R.plusBas && R.plusBas.fin < 0) alertes.push({ ton: 'rouge', icone: '📉', texte: `Trésorerie négative prévue en <strong>${trLibelleMois(R.plusBas.m)}</strong> (CHF ${trCHF(R.plusBas.fin)}).`, action: "navigate('tresorerie')", bouton: 'Voir' });
  if (D.retards.length) alertes.push({ ton: 'rouge', icone: '⏳', texte: `<strong>${D.retards.length}</strong> commission${D.retards.length > 1 ? 's' : ''} en retard (CHF ${fmtCHF(Math.round(D.retards.reduce((s, r) => s + D.reste(r.ca), 0)))}).`, action: "window._sfxOnglet='retards';navigate('suivi-financier')", bouton: 'Relancer' });
  if (facturesRetard.length) alertes.push({ ton: 'orange', icone: '🧾', texte: `<strong>${facturesRetard.length}</strong> facture${facturesRetard.length > 1 ? 's' : ''} échue${facturesRetard.length > 1 ? 's' : ''} non payée${facturesRetard.length > 1 ? 's' : ''}.`, action: "navigate('factures')", bouton: 'Voir' });
  const anomalies = ckAnomalies().filter(g => g.niveau === 'erreur').reduce((s, g) => s + g.items.length, 0);
  if (anomalies) alertes.push({ ton: 'orange', icone: '🔍', texte: `<strong>${anomalies}</strong> anomalie${anomalies > 1 ? 's' : ''} probable${anomalies > 1 ? 's' : ''} dans les commissions.`, action: "window._sfxOnglet='controle';navigate('suivi-financier')", bouton: 'Contrôler' });

  return `
    <div class="dbx-kpis">
      ${dbxKpi({ label: 'Trésorerie', valeur: R.solde ? Number(R.solde.montant || 0) : 0, prefixe: 'CHF ', sous: R.solde ? `solde du ${fmtDate(R.solde.date_debut)}` : 'solde à saisir', onclick: "navigate('tresorerie')", i: 0 })}
      ${dbxKpi({ label: 'Solde prévu dans 3 mois', valeur: soldeDans3, prefixe: 'CHF ', sous: R.plusBas ? `point bas ${trLibelleMois(R.plusBas.m)} : CHF ${trCHF(R.plusBas.fin)}` : '', i: 1 })}
      ${dbxKpi({ label: 'Entrées attendues · 90 j', valeur: entrees90, prefixe: 'CHF ', sous: aEncaisser.length ? `dont factures CHF ${fmtCHF(Math.round(aEncaisser.reduce((s, f) => s + Number(f.montant || 0), 0)))} à encaisser` : 'commissions et autres encaissements', i: 2 })}
      ${dbxKpi({ label: 'Charges · 90 j', valeur: sorties90, prefixe: 'CHF ', sous: `${R.sorties.length} poste${R.sorties.length > 1 ? 's' : ''} de charges`, onclick: "navigate('tresorerie')", i: 3 })}
    </div>
    ${typeof htmlBandeauRecurrenceOZ === 'function' ? htmlBandeauRecurrenceOZ() : ''}
    ${alertes.length ? `<div class="dbx-signaux ck-alertes">${alertes.map((x, i) => `<div class="dbx-signal ${x.ton}" style="--i:${i}"><span class="dbx-signal-icone" aria-hidden="true">${x.icone}</span><span class="dbx-signal-texte">${x.texte}</span><button type="button" onclick="${x.action}">${x.bouton}</button></div>`).join('')}</div>` : ''}
    <section class="dbx-carte ck-flux"><header class="dbx-carte-tete"><h2>Flux sur 12 mois</h2><span class="dbx-carte-sous">entrées, charges et solde de fin de mois</span></header>
      ${typeof trGraphique === 'function' ? trGraphique(R) : ''}
    </section>
    <div class="dbx-grille dbx-grille-egale" style="margin-top:18px">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Prochains encaissements</h2><span class="dbx-carte-sous">60 jours</span></header>
        ${prochains.length ? `<div class="sfx-liste">${prochains.slice(0, 12).map(p => `<div class="sfx-ligne">
          <span class="sfx-logo">${p.facture ? '<span class="ck-ico">🧾</span>' : (typeof pictoCompagnie === 'function' ? pictoCompagnie(p.cie, 28) : '')}</span>
          <span class="sfx-corps"><b>${ckEsc(p.titre)}</b><small>${ckEsc(p.sous)}</small></span>
          <span class="ck-date">${fmtDate(p.date)}</span>
          <span class="sfx-montant">CHF ${fmtCHF2(p.montant)}</span></div>`).join('')}</div>${prochains.length > 12 ? `<div class="dbx-vide-petit">+ ${prochains.length - 12} autre(s)</div>` : ''}` : '<div class="dbx-vide-petit">Aucun encaissement daté dans les 60 prochains jours.</div>'}
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Charges à venir</h2><span class="dbx-carte-sous">${trLibelleMois(moisCh[0])} · ${trLibelleMois(moisCh[1])}</span></header>
        ${charges.length ? `<div class="sfx-liste">${charges.slice(0, 10).map(x => `<div class="sfx-ligne ck-charge">
          <span class="sfx-logo"><span class="ck-ico">−</span></span>
          <span class="sfx-corps"><b>${ckEsc(x.l.libelle)}</b><small>${ckEsc(x.l.categorie || '')}</small></span>
          <span class="sfx-montant">CHF ${fmtCHF(Math.round(x.montants[0]))}</span>
          <span class="sfx-montant ck-mois2">CHF ${fmtCHF(Math.round(x.montants[1]))}</span></div>`).join('')}</div>` : `<div class="dbx-vide-petit">Aucune charge saisie. <button type="button" class="dbx-lien" onclick="navigate('tresorerie')">Ajouter les charges →</button></div>`}
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>D’où viendront les entrées</h2><span class="dbx-carte-sous">12 mois</span></header>
        <div class="dbx-hbarres">${compo.map((x, i) => `<div class="dbx-hbarre" style="--i:${i}">
          <span class="dbx-hbarre-nom"><span class="dbx-point" style="background:${x.c}"></span><span>${x.l}</span></span>
          <span class="dbx-hbarre-piste"><span style="--w:${Math.round(x.v / maxCompo * 100)}%;background:${x.c}"></span></span>
          <span class="dbx-hbarre-val">${dbxCompact(x.v)}</span></div>`).join('')}</div>
        ${R.oz.nb ? `<div class="sfx-note">🔹 CHF ${fmtCHF(Math.round(R.oz.total))} de gestion OZ attendue avant 2027, encaissée par OZ (hors trésorerie Assurex).</div>` : ''}
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Factures QR</h2>${typeof viewFacturesQR === 'function' ? `<button type="button" class="dbx-lien" onclick="navigate('factures')">Toutes les factures →</button>` : ''}</header>
        ${factures.length ? `<div class="sfx-mini">
          <div><span><b>À encaisser</b><small>${aEncaisser.length} facture${aEncaisser.length > 1 ? 's' : ''}</small></span><em>CHF ${fmtCHF2(aEncaisser.reduce((s, f) => s + Number(f.montant || 0), 0))}</em></div>
          <div><span><b>Échues</b><small>${facturesRetard.length} facture${facturesRetard.length > 1 ? 's' : ''}</small></span><em>CHF ${fmtCHF2(facturesRetard.reduce((s, f) => s + Number(f.montant || 0), 0))}</em></div>
          <div><span><b>Encaissées cette année</b></span><em>CHF ${fmtCHF2(factures.filter(f => f.statut === 'payee' && String(f.paye_le || '').startsWith(auj.slice(0, 4))).reduce((s, f) => s + Number(f.montant || 0), 0))}</em></div>
        </div>` : `<div class="dbx-vide-petit">Aucune facture émise. ${typeof viewFacturesQR === 'function' ? `<button type="button" class="dbx-lien" onclick="navigate('factures')">Créer une facture QR →</button>` : ''}</div>`}
      </section>
    </div>`;
}

// ── Contrôle des commissions ────────────────────────────────────────────────────────────────
function ckAnomalies() {
  const auj = ckIso(new Date());
  const ct = id => id ? allContrats.find(x => x.id === id) : null;
  const groupes = [];
  const g = (id, niveau, titre, explication, items) => { if (items.length) groupes.push({ id, niveau, titre, explication, items }); };
  const attente = allCommissionsAttente.filter(ca => ca.statut === 'en_attente');
  const actives = allCommissionsAttente.filter(ca => ca.statut !== 'annulée');

  g('non-commissionne', 'erreur', 'Commission en attente sur un contrat « non commissionné »',
    'Le contrat indique qu’aucune commission n’est due : soit la case du contrat est fausse, soit cette attente est à annuler.',
    attente.filter(ca => { const c = ct(ca.contrat_id); return c && c.commissionne === false; }).map(ca => ({ ca })));

  g('montant-nul', 'erreur', 'Commission en attente sans montant',
    'Montant à saisir, sinon elle n’apparaît dans aucune prévision.',
    attente.filter(ca => !Number(ca.montant_estime) && !/aucune/i.test(ca.detail_calcul || '')).map(ca => ({ ca })));

  const dejaPayee = attente.filter(ca => {
    if (/\[gestion annuelle\]/.test(ca.detail_calcul || '')) return false;
    return actives.some(b => b.id !== ca.id && b.contrat_id && b.contrat_id === ca.contrat_id && b.nature === ca.nature && ['reçue', 'versé_oz'].includes(b.statut)
      && String(b.date_reception || b.date_creation || '') >= String(ca.date_creation || '').slice(0, 10));
  });
  g('deja-payee', 'erreur', 'Peut-être déjà payée',
    'Une commission de même nature a été encaissée (ou versée à OZ) sur ce contrat après la création de celle-ci : elle a sans doute été payée sans être soldée.',
    dejaPayee.map(ca => {
      const b = actives.find(x => x.id !== ca.id && x.contrat_id === ca.contrat_id && x.nature === ca.nature && ['reçue', 'versé_oz'].includes(x.statut));
      return { ca, note: b ? `${b.statut === 'versé_oz' ? 'versée à OZ' : 'reçue'} CHF ${fmtCHF2(b.montant_final ?? b.montant_estime)} le ${fmtDate(b.date_reception || b.date_creation)}` : '' };
    }));

  const vus = {};
  attente.forEach(ca => { const k = `${ca.contrat_id}|${ca.nature}|${Math.round(Number(ca.montant_estime || 0))}`; (vus[k] = vus[k] || []).push(ca); });
  g('doublon', 'erreur', 'Doublon probable', 'Deux commissions en attente identiques (même contrat, même nature, même montant).',
    Object.values(vus).filter(l => l.length > 1 && l[0].contrat_id).flatMap(l => l.slice(1).map(ca => ({ ca, note: `doublon de la commission du ${fmtDate(l[0].date_creation)}` }))));

  g('gestion-retard', 'attention', 'Gestion en retard de plus de 60 jours',
    'Date prévue largement dépassée : à relancer auprès de la compagnie, ou déjà payée sans rapprochement.',
    attente.filter(ca => ca.nature === 'gestion' && sfxCompte(ca) && (commissionJoursRetard(ca) || 0) > 60).map(ca => ({ ca, note: `${commissionJoursRetard(ca)} j de retard` })));

  g('acquisition-ancienne', 'attention', 'Acquisition en attente depuis plus de 150 jours', 'Une acquisition est normalement versée dans les mois qui suivent la signature.',
    attente.filter(ca => ca.nature !== 'gestion' && ca.date_creation && (new Date(auj) - new Date(ca.date_creation)) / 86400000 > 150).map(ca => ({ ca, note: `depuis le ${fmtDate(ca.date_creation)}` })));

  g('recue-sans-bordereau', 'attention', 'Reçue sans bordereau', 'Encaissement non rattaché à un bordereau : difficile à retrouver dans la comptabilité.',
    allCommissionsAttente.filter(ca => ca.statut === 'reçue' && !ca.bordereau_id).map(ca => ({ ca })));

  const idsComm = new Set(actives.map(ca => ca.contrat_id).filter(Boolean));
  g('orphelin', 'attention', 'Contrat commissionnable sans aucune commission', 'Contrat actif avec une prime, mais aucune commission (ni attendue ni reçue) dans le CRM.',
    allContrats.filter(c => c.commissionne !== false && ['actif', 'renouveler', 'en_cours'].includes(c.statut) && Number(c.prime_annuelle || 0) > 0 && !idsComm.has(c.id)).map(c => ({ contrat: c })));

  g('generique', 'info', 'Estimation générique « 10 % » encore en attente', 'À remplacer par le taux de la convention (voir Précision des estimations) : les écarts constatés vont jusqu’à ×7.',
    attente.filter(ca => /Estimation 10%/.test(ca.detail_calcul || '')).map(ca => ({ ca })));

  g('oz-2026', 'info', 'Gestion de clients OZ attendue avant 2027', 'Encaissée par OZ : hors chiffres Assurex. À passer en « versée à OZ » lors de l’import du décompte OZ.',
    attente.filter(ca => ca.nature === 'gestion' && typeof commissionGestionEncaisseeParOZ === 'function' && commissionGestionEncaisseeParOZ(ca, commissionDatePrevue(ca))).map(ca => ({ ca })));
  return groupes;
}

function htmlCockpitControle() {
  const groupes = ckAnomalies();
  const nb = n => groupes.filter(x => x.niveau === n).reduce((s, x) => s + x.items.length, 0);
  const total = (items) => items.reduce((s, it) => s + (it.ca ? Number(it.ca.montant_estime || 0) : 0), 0);
  const ligne = it => {
    if (it.contrat) {
      const c = it.contrat; const cl = allClients.find(x => x.id === c.client_id);
      return `<div class="sfx-ligne"><span class="sfx-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(c.compagnie, 28) : ''}</span>
        <span class="sfx-corps"><b>${ckEsc(cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`) : '—')}</b><small>${ckEsc(c.produit || '')} · prime CHF ${fmtCHF(Number(c.prime_annuelle || 0))}</small></span>
        <span></span><button type="button" class="ck-ouvrir" onclick="${typeof showDetailContrat === 'function' ? `showDetailContrat('${c.id}')` : `showClient('${c.client_id}')`}">Ouvrir</button></div>`;
    }
    const ca = it.ca;
    return `<div class="sfx-ligne"><span class="sfx-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(ca.compagnie, 28) : ''}</span>
      <span class="sfx-corps"><b>${ckEsc(ca.client_nom || '—')}</b><small>${ckEsc(ca.produit || '')} · ${ckEsc(ca.nature || '')} · ${ckEsc(ca.statut)}${it.note ? ' · ' + ckEsc(it.note) : ''}</small></span>
      <span class="sfx-montant">CHF ${fmtCHF2(ca.montant_final ?? ca.montant_estime ?? 0)}</span>
      <button type="button" class="ck-ouvrir" onclick="showModalEditCommission('${ca.id}')">Ouvrir</button></div>`;
  };
  return `
    <div class="sfx-intro">Contrôle automatique de toutes les commissions, recalculé à chaque ouverture. « Ouvrir » donne accès à la commission pour la corriger, la solder ou l’annuler (jamais de suppression).
      ${typeof rexAutotests === 'function' ? `<div style="margin-top:8px;display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap"><button type="button" class="btn-secondary" onclick="ckLancerAutotests()">🧪 Lancer les autotests des calculs</button><div id="ck-autotests" style="font-size:12.5px"></div></div>` : ''}</div>
    <div class="dbx-kpis">
      ${dbxKpi({ label: 'Anomalies probables', valeur: nb('erreur'), sous: 'à corriger', i: 0 })}
      ${dbxKpi({ label: 'Points d’attention', valeur: nb('attention'), sous: 'à vérifier', i: 1 })}
      ${dbxKpi({ label: 'Informations', valeur: nb('info'), sous: 'pour affiner', i: 2 })}
      ${dbxKpi({ label: 'Commissions contrôlées', valeur: allCommissionsAttente.length, sous: 'toutes les lignes', i: 3 })}
    </div>
    ${groupes.length ? groupes.map(gr => `<details class="dbx-carte ck-groupe ${gr.niveau}" ${gr.niveau === 'erreur' ? 'open' : ''}>
      <summary><span class="ck-niveau ${gr.niveau}">${gr.niveau === 'erreur' ? 'À corriger' : gr.niveau === 'attention' ? 'À vérifier' : 'Info'}</span><b>${gr.titre}</b><em>${gr.items.length}${total(gr.items) ? ` · CHF ${fmtCHF(Math.round(total(gr.items)))}` : ''}</em></summary>
      <p class="ck-explication">${gr.explication}${gr.id === 'generique' && typeof tauxCommissionAppris === 'function' ? ` <button type="button" class="btn-secondary" style="margin-left:8px" onclick="ckAffinerGeneriques()">✨ Affiner avec les taux réels observés</button>` : ''}</p>
      <div class="sfx-liste">${gr.items.slice(0, 60).map(ligne).join('')}</div>
    </details>`).join('') : '<section class="dbx-carte"><div class="dbx-vide"><span style="font-size:26px">✓</span>Aucune anomalie détectée.</div></section>'}`;
}

// Remplace les estimations génériques à 10 % par le taux réellement observé (js/19,
// tauxCommissionAppris) quand il existe assez de commissions encaissées comparables. Ancienne
// estimation conservée dans le détail du calcul ; les autres restent à 10 % jusqu'au 1er décompte.
async function ckAffinerGeneriques() {
  const cibles = allCommissionsAttente.filter(ca => ca.statut === 'en_attente' && /Estimation 10%/.test(ca.detail_calcul || '')).map(ca => {
    const ct = ca.contrat_id ? allContrats.find(x => x.id === ca.contrat_id) : null;
    const prime = ct ? Number(ct.prime_annuelle || 0) : 0;
    const a = prime > 0 ? tauxCommissionAppris(ca.compagnie || ct.compagnie, ca.produit || ct.produit, ca.nature) : null;
    return a ? { ca, prime, a, montant: Math.round(prime * a.taux * 100) / 100 } : null;
  }).filter(Boolean);
  if (!cibles.length) { showError('Pas encore assez de commissions encaissées comparables pour affiner ces estimations — elles le seront après les prochains décomptes.'); return; }
  const liste = cibles.slice(0, 12).map(x => `• ${x.ca.client_nom || ''} — ${x.ca.compagnie || ''} ${x.ca.produit || ''} : ${fmtCHF2(x.ca.montant_estime)} → ${fmtCHF2(x.montant)}`).join('\n');
  if (!confirm(`Affiner ${cibles.length} estimation(s) avec les taux réels observés ?\n\n${liste}${cibles.length > 12 ? '\n…' : ''}`)) return;
  let ok = 0;
  for (const x of cibles) {
    const pct = (Math.round(x.a.taux * 1000) / 10).toString().replace('.', ',');
    const detail = `Taux réel observé ${pct} % × prime ${x.prime} (médiane de ${x.a.n} commissions encaissées, ${x.a.portee === 'compagnie' ? 'même compagnie et produit' : 'même produit'}) — affiné le ${new Date().toLocaleDateString('fr-CH')}, ancienne estimation générique CHF ${x.ca.montant_estime}`;
    const r = await dbPatch('commissions_attente', x.ca.id, { montant_estime: x.montant, detail_calcul: detail });
    if (!(r && r.error)) { x.ca.montant_estime = x.montant; x.ca.detail_calcul = detail; ok++; }
  }
  if (typeof logAction === 'function') logAction('affiner_estimations', 'commissions_attente', null, `${ok} estimation(s) générique(s) remplacée(s) par le taux réel observé`);
  showError(`✓ ${ok} estimation(s) affinée(s).`);
  ckRerendre();
}

// ═══ OZ ↔ ASSUREX : REFACTURATION 2026 ══════════════════════════════════════════════════════
// Jusqu'à la fusion complète (01.01.2027), certaines commissions sont encore versées sur le compte
// OZ Assure alors qu'elles reviennent à Assurex. Règle (Jonathan, 19.09.2026) :
//   - à refacturer à OZ (jamais la santé : LAMal, complémentaire) :
//       · la GESTION des clients Assurex / EX versée à OZ, et celle des clients OZ dès le 01.01.2027 ;
//       · l'ACQUISITION quand un apporteur est renseigné sur le contrat (sa part lui est due) ;
//   - reste à OZ : la santé, les acquisitions sans apporteur, la gestion des clients OZ avant 2027.
// Les commissions qui reviennent à Assurex suivent le partage des apporteurs comme une commission
// reçue normalement (fiche de commission incluse).
// Précision de Jonathan (19.09.2026) : on ne refacture à OZ QUE des commissions de GESTION, et
// jamais la santé (LAMal / complémentaire santé) — les acquisitions et la santé restent chez OZ.
function ozEstSante(ca) {
  const cat = typeof categoriePourProduitLibre === 'function' ? categoriePourProduitLibre(ca.produit) : null;
  return cat === 'Santé' || /lamal|lca|compl[ée]mentaire sant[ée]|assurance maladie \(|soins|hospitalisation/i.test(ca.produit || '');
}
// Apporteur renseigné sur le contrat (autre que le signataire) : sa part doit lui être versée par
// Assurex, donc l'acquisition encaissée par OZ est aussi à refacturer (précision de Jonathan).
function ozApporteurRenseigne(ca) {
  const ct = ca.contrat_id ? allContrats.find(x => x.id === ca.contrat_id) : null;
  if (!ct || !ct.apporteur_id) return false;
  const ag = (typeof allAgents !== 'undefined' ? allAgents : []).find(a => a.id === ct.apporteur_id);
  return !ag || ag.role !== 'signataire';
}
function ozPartAssurex(ca) {
  if (!ca || ca.statut !== 'versé_oz' || ozEstSante(ca)) return false;
  if (ca.nature !== 'gestion') return ozApporteurRenseigne(ca); // acquisition : seulement avec apporteur
  const cl = ca.client_id ? allClients.find(x => x.id === ca.client_id) : null;
  if (!(cl && cl.source_oz)) return true; // client Assurex / EX dont la gestion a été versée à OZ
  const date = (ca.date_reception || ca.date_creation || '').slice(0, 10);
  return !!date && date >= (typeof DATE_GESTION_ASSUREX !== 'undefined' ? DATE_GESTION_ASSUREX : '2027-01-01');
}

function ozLignesRefacturation(annee) {
  return allCommissionsAttente.filter(ca => ca.statut === 'versé_oz' && ozPartAssurex(ca) && String(ca.date_reception || ca.date_creation || '').startsWith(annee)).map(ca => {
    const m = Number(ca.montant_final != null ? ca.montant_final : (ca.montant_estime || 0));
    const s = typeof splitMontantAgent === 'function' ? splitMontantAgent(m, ca.contrat_id) : { pJ: m, pA: 0, agent: null };
    return { ca, m, pJ: s.pJ, pA: s.pA, agent: s.agent };
  });
}

function htmlCockpitOZ() {
  const annee = String(new Date().getFullYear());
  const lignes = ozLignesRefacturation(annee);
  const ouvertes = lignes.filter(l => !l.ca.refacture_le);
  const somme = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
  const restentOZ = allCommissionsAttente.filter(ca => ca.statut === 'versé_oz' && !ozPartAssurex(ca) && String(ca.date_reception || ca.date_creation || '').startsWith(annee));
  window._ozSelection = new Set(ouvertes.map(l => l.ca.id));
  return `
    <div class="sfx-intro">Commissions ${annee} versées sur le compte OZ Assure qui reviennent à Assurex — la <strong>gestion</strong>, et l’<strong>acquisition</strong> quand un apporteur est renseigné (hors santé) : elles sont à <strong>refacturer à OZ</strong> pour équilibrer les comptes avant la fusion complète du 01.01.2027. Les parts des apporteurs s’appliquent comme pour une commission reçue.</div>
    <div class="dbx-kpis">
      ${dbxKpi({ label: 'À refacturer à OZ', valeur: somme(ouvertes, 'm'), prefixe: 'CHF ', sous: `${ouvertes.length} commission${ouvertes.length > 1 ? 's' : ''}`, i: 0 })}
      ${dbxKpi({ label: 'dont parts apporteurs', valeur: somme(ouvertes, 'pA'), prefixe: 'CHF ', sous: 'à verser via la fiche de commission', i: 1 })}
      ${dbxKpi({ label: 'Déjà refacturé', valeur: somme(lignes.filter(l => l.ca.refacture_le), 'm'), prefixe: 'CHF ', sous: annee, i: 2 })}
      ${dbxKpi({ label: 'Reste chez OZ', valeur: restentOZ.reduce((s, ca) => s + Number(ca.montant_final ?? ca.montant_estime ?? 0), 0), prefixe: 'CHF ', sous: 'santé, acquisitions sans apporteur, gestion OZ avant 2027', i: 3 })}
    </div>
    <section class="dbx-carte"><header class="dbx-carte-tete"><h2>À refacturer</h2>
      <span class="dx-tete-actions">
        ${typeof fqrNouvelleFactureDepuis === 'function' ? `<button type="button" class="btn-secondary" onclick="ozPreparerFacture()">🧾 Préparer la facture QR</button>` : ''}
        <button type="button" class="btn-save" onclick="ozMarquerRefacture()" ${ouvertes.length ? '' : 'disabled'}>✓ Marquer refacturé</button>
      </span></header>
      ${ouvertes.length ? `<div class="sfx-liste">${ouvertes.map(l => `<label class="sfx-ligne oz-ligne">
        <input type="checkbox" checked onchange="this.checked?window._ozSelection.add('${l.ca.id}'):window._ozSelection.delete('${l.ca.id}')"/>
        <span class="sfx-corps"><b>${ckEsc(l.ca.client_nom || '—')}</b><small>${ckEsc(l.ca.compagnie || '')} · ${ckEsc(l.ca.produit || '')} · ${ckEsc(l.ca.nature || '')} · ${fmtDate(l.ca.date_reception || l.ca.date_creation)}${l.pA ? ` · apporteur CHF ${fmtCHF2(l.pA)}` : ''}</small></span>
        <span class="sfx-montant">CHF ${fmtCHF2(l.m)}</span></label>`).join('')}</div>` : '<div class="dbx-vide-petit">✓ Rien à refacturer pour l’instant.</div>'}
    </section>
    ${htmlRapprochementCompteOZ()}`;
}

// ═══ COMPTE COURANT OZ → DÉDUCTION DES COMMISSIONS EN ATTENTE ═══════════════════════════════
// Le compte courant OZ (table commissions_oz) liste ce que les compagnies ont versé à OZ Assure.
// Tant que ces montants ne sont pas rapprochés, le CRM continue de les attendre (ex. AGV TONI SA :
// Vaudoise paie la commission d'encaissement au fil des primes, libellée « acquisition » par OZ).
// Règles de rapprochement (une ligne du compte courant → une commission en attente) :
//   - même n° de police (sans espaces ni ponctuation, 5 caractères min.) et même compagnie ;
//   - période : celle écrite dans le libellé (« 01.01.25 - 31.12.25 » → 2025) ; à défaut, une
//     gestion payée de janvier à avril concerne l'année précédente (Vaudoise paie à terme échu),
//     sinon l'année du versement. Une GESTION n'est déduite que de la commission de la même année ;
//   - une ligne « acquisition » va à l'acquisition en attente du contrat ; s'il n'y en a jamais eu
//     (commission d'encaissement Vaudoise), elle est déduite de la gestion de l'année ;
//   - une ligne déjà déduite porte sa référence [oz:id] dans la tranche → jamais imputée deux fois ;
//     une ligne dont le montant correspond déjà à une commission reçue / versée à OZ est ignorée.
// Chaque déduction crée une tranche « encaissée par OZ » (hors trésorerie Assurex). Quand le total
// atteint le montant attendu, la commission passe « versée à OZ » et l'écart est journalisé.
function ozNormPolice(p) { return String(p || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function ozPeriodeLigne(r) {
  const t = String(r.type_mouvement || '');
  const m = [...t.matchAll(/\d{1,2}\.\d{1,2}\.(\d{2}|\d{4})\b/g)];
  if (m.length) { const a = m[m.length - 1][1]; return Number(a.length === 2 ? '20' + a : a); }
  const d = String(r.date_mouvement || '');
  const an = Number(d.slice(0, 4)), mois = Number(d.slice(5, 7));
  return (classerTypeMouvementOz(t) === 'Gestion' && mois && mois <= 4) ? an - 1 : an;
}
function ozAnneeCommission(ca) { return Number(String(ca.date_creation || '').slice(0, 4)) || new Date().getFullYear(); }

function ozPropositionsCompteCourant() {
  const ledger = window._ck.ozLedger || [];
  const dejaImputees = new Set();
  (allCommissionTranches || []).forEach(t => { const m = String(t.note || '').match(/\[oz:([0-9a-f-]{36})\]/); if (m) dejaImputees.add(m[1]); });
  const proche = typeof compagnieProcheImport === 'function' ? compagnieProcheImport : () => true;
  const parPolice = {};
  allCommissionsAttente.filter(ca => ca.statut !== 'annulée' && ca.contrat_id).forEach(ca => {
    const ct = allContrats.find(c => c.id === ca.contrat_id);
    const np = ozNormPolice(ct && ct.numero_police);
    if (np.length < 5) return;
    (parPolice[np] = parPolice[np] || []).push({ ca, ct });
  });
  const props = {};
  ledger.forEach(r => {
    if (!(Number(r.credit) > 0) || dejaImputees.has(r.id)) return;
    const liees = (parPolice[ozNormPolice(r.police)] || []).filter(x => proche(r.compagnie, x.ct.compagnie || x.ca.compagnie));
    if (!liees.length) return;
    const montant = Number(r.credit);
    // Déjà enregistrée comme commission reçue / versée à OZ du même montant → rien à déduire
    if (liees.some(x => ['reçue', 'versé_oz'].includes(x.ca.statut) && Math.abs(Number(x.ca.montant_final ?? x.ca.montant_estime ?? 0) - montant) <= 0.05)) return;
    const type = classerTypeMouvementOz(r.type_mouvement);
    const periode = ozPeriodeLigne(r);
    const enAttente = liees.filter(x => x.ca.statut === 'en_attente');
    let cible = null;
    if (type !== 'Gestion') {
      const acq = enAttente.find(x => x.ca.nature === 'acquisition');
      const debut = acq && acq.ct.date_debut ? new Date(acq.ct.date_debut) : null;
      if (acq && (!debut || new Date(r.date_mouvement) >= new Date(debut.getTime() - 120 * 864e5))) cible = acq;
      else if (!acq && !liees.some(x => x.ca.nature === 'acquisition')) cible = enAttente.find(x => x.ca.nature === 'gestion' && ozAnneeCommission(x.ca) === periode);
    } else {
      cible = enAttente.find(x => x.ca.nature === 'gestion' && ozAnneeCommission(x.ca) === periode);
    }
    if (!cible) return;
    const p = props[cible.ca.id] = props[cible.ca.id] || { ca: cible.ca, ct: cible.ct, lignes: [] };
    p.lignes.push(r);
  });
  return Object.values(props).map(p => {
    const attendu = Number(p.ca.montant_estime || 0);
    const deja = commissionDejaRecu(p.ca);
    const propose = Math.round(p.lignes.reduce((s, r) => s + Number(r.credit), 0) * 100) / 100;
    const total = deja + propose;
    // Cochée d'office si le total reste plausible (≤ 150 % de l'attendu) ; au-delà, à vérifier
    return { ...p, attendu, deja, propose, reste: Math.max(0, attendu - total), depasse: total - attendu, coche: total <= attendu * 1.5 + 1 };
  }).sort((a, b) => (a.ca.client_nom || '').localeCompare(b.ca.client_nom || ''));
}

function htmlRapprochementCompteOZ() {
  if (!window._ck.ozLedger) {
    if (!window._ck.ozLedgerEnCours) {
      window._ck.ozLedgerEnCours = true;
      dbGet('commissions_oz', 'select=*&order=date_mouvement.asc').then(r => { window._ck.ozLedger = Array.isArray(r) ? r : []; window._ck.ozLedgerEnCours = false; ckRerendre(); });
    }
    return `<section class="dbx-carte"><header class="dbx-carte-tete"><h2>Compte courant OZ → montants déjà reçus</h2></header><div class="dbx-vide-petit">Chargement du compte courant OZ…</div></section>`;
  }
  const props = ozPropositionsCompteCourant();
  window._ozRappSel = new Set(props.filter(p => p.coche).map(p => p.ca.id));
  window._ozRappProps = props;
  const tot = props.reduce((s, p) => s + p.propose, 0);
  return `<section class="dbx-carte"><header class="dbx-carte-tete"><h2>Compte courant OZ → montants déjà reçus</h2>
      <span class="dx-tete-actions"><button type="button" class="btn-save" onclick="ozAppliquerRapprochement()" ${props.length ? '' : 'disabled'}>✓ Déduire des commissions attendues</button></span></header>
    <p class="ck-explication">Versements du compte courant OZ rapprochés par n° de police des commissions encore attendues : ils sont déduits du montant attendu (versement encaissé par OZ). Les lignes non cochées dépassent nettement l’estimation — à vérifier avant de les déduire.</p>
    ${props.length ? `<div class="sfx-liste">${props.map(p => `<label class="sfx-ligne oz-ligne">
      <input type="checkbox" ${p.coche ? 'checked' : ''} onchange="this.checked?window._ozRappSel.add('${p.ca.id}'):window._ozRappSel.delete('${p.ca.id}')"/>
      <span class="sfx-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(p.ca.compagnie, 28) : ''}</span>
      <span class="sfx-corps"><b>${ckEsc(p.ca.client_nom || '—')}</b><small>${ckEsc(p.ca.produit || '')} · ${ckEsc(p.ca.nature || '')} · police ${ckEsc(p.ct.numero_police || '')} · ${p.lignes.length} versement${p.lignes.length > 1 ? 's' : ''} (${p.lignes.map(r => fmtDate(r.date_mouvement) + ' CHF ' + fmtCHF2(r.credit)).join(', ')})</small>
        <small>Attendu CHF ${fmtCHF2(p.attendu)}${p.deja ? ` · déjà reçu CHF ${fmtCHF2(p.deja)}` : ''} → ${p.reste > 0.009 ? `reste CHF ${fmtCHF2(p.reste)}` : p.depasse > 0.009 ? `soldée, CHF ${fmtCHF2(p.depasse)} de plus que l’estimation` : 'soldée'}</small></span>
      <span class="sfx-montant">− CHF ${fmtCHF2(p.propose)}</span></label>`).join('')}</div>
      <div class="ck-explication" style="text-align:right">Total rapprochable : <b>CHF ${fmtCHF2(tot)}</b></div>` : '<div class="dbx-vide-petit">✓ Tout le compte courant OZ est déjà rapproché.</div>'}
  </section>`;
}

async function ozAppliquerRapprochement() {
  const props = (window._ozRappProps || []).filter(p => window._ozRappSel && window._ozRappSel.has(p.ca.id));
  if (!props.length) { showError('Coche au moins une commission.'); return; }
  const total = props.reduce((s, p) => s + p.propose, 0);
  if (!confirm(`Déduire CHF ${fmtCHF2(total)} reçus par OZ de ${props.length} commission(s) attendue(s) ?`)) return;
  let nbT = 0, nbSoldees = 0, echecs = 0;
  const ecarts = [];
  for (const p of props) {
    for (const r of p.lignes) {
      const res = await dbPost('commission_tranches', {
        commission_id: p.ca.id, montant: Number(r.credit), date_reception: r.date_mouvement, encaisse_par: 'oz',
        note: `Compte courant OZ — ${r.compagnie || ''} ${r.type_mouvement || ''} du ${fmtDate(r.date_mouvement)} [oz:${r.id}]`,
      });
      if (res && res.error) echecs++; else nbT++;
    }
  }
  allCommissionTranches = await dbGet('commission_tranches', 'annule=eq.false&select=*') || [];
  for (const p of props) {
    const deja = commissionDejaRecu(p.ca);
    if (deja > 0 && p.attendu - deja <= Math.max(1, p.attendu * 0.02)) {
      const derniere = p.lignes.map(r => r.date_mouvement).sort().pop();
      const r = await dbPatch('commissions_attente', p.ca.id, { statut: 'versé_oz', montant_final: Math.round(deja * 100) / 100, date_reception: derniere });
      if (!(r && r.error)) { p.ca.statut = 'versé_oz'; p.ca.montant_final = Math.round(deja * 100) / 100; p.ca.date_reception = derniere; nbSoldees++; ecarts.push({ attente: p.ca, source: 'compte courant OZ' }); }
    }
  }
  if (ecarts.length && typeof journaliserEcartsCommission === 'function') await journaliserEcartsCommission(ecarts, null);
  if (typeof logAction === 'function') logAction('rapprochement_compte_oz', 'commissions_attente', null, `${nbT} versement(s) du compte courant OZ déduit(s) — CHF ${fmtCHF2(total)}, ${nbSoldees} commission(s) soldée(s)`);
  showError(`✓ CHF ${fmtCHF2(total)} déduits (${nbT} versement(s)), ${nbSoldees} commission(s) soldée(s)${echecs ? ` — ⚠️ ${echecs} échec(s)` : ''}.`);
  ckRerendre();
}

async function ozMarquerRefacture() {
  const ids = [...(window._ozSelection || [])];
  if (!ids.length) { showError('Coche au moins une commission.'); return; }
  const total = ids.reduce((s, id) => { const ca = allCommissionsAttente.find(x => x.id === id); return s + Number(ca ? (ca.montant_final ?? ca.montant_estime ?? 0) : 0); }, 0);
  if (!confirm(`Marquer ${ids.length} commission(s) (CHF ${fmtCHF2(total)}) comme refacturée(s) à OZ aujourd’hui ?`)) return;
  const auj = ckIso(new Date());
  for (const id of ids) {
    const r = await dbPatch('commissions_attente', id, { refacture_le: auj });
    if (!(r && r.error)) { const ca = allCommissionsAttente.find(x => x.id === id); if (ca) ca.refacture_le = auj; }
  }
  if (typeof logAction === 'function') logAction('refacturation_oz', 'commissions_attente', null, `${ids.length} commission(s) refacturée(s) à OZ — CHF ${fmtCHF2(total)}`);
  showError('✓ Refacturation enregistrée.');
  ckRerendre();
}

// Facture QR à OZ pour la sélection (si le module factures est chargé)
function ozPreparerFacture() {
  const ids = [...(window._ozSelection || [])];
  const lignes = ids.map(id => allCommissionsAttente.find(x => x.id === id)).filter(Boolean)
    .map(ca => ({ libelle: `Commission ${ca.compagnie || ''} — ${ca.client_nom || ''} (${ca.produit || ''})`, quantite: 1, prix: Number(ca.montant_final ?? ca.montant_estime ?? 0) }));
  if (!lignes.length) { showError('Coche au moins une commission.'); return; }
  fqrNouvelleFactureDepuis({ debiteur: { nom: 'OZ Assure' }, lignes, message: `Refacturation commissions ${new Date().getFullYear()} versées à OZ` });
}