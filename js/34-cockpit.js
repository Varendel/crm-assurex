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
    const p = typeof commissionDatePrevue === 'function' ? commissionDatePrevue(ca) : null;
    if (p && p >= auj && p <= dans(60)) prochains.push({ date: p, montant: D.reste(ca), titre: ca.client_nom || '—', sous: `${ca.produit || ''} · gestion`, cie: ca.compagnie });
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
    <div class="sfx-intro">Contrôle automatique de toutes les commissions, recalculé à chaque ouverture. « Ouvrir » donne accès à la commission pour la corriger, la solder ou l’annuler (jamais de suppression).</div>
    <div class="dbx-kpis">
      ${dbxKpi({ label: 'Anomalies probables', valeur: nb('erreur'), sous: 'à corriger', i: 0 })}
      ${dbxKpi({ label: 'Points d’attention', valeur: nb('attention'), sous: 'à vérifier', i: 1 })}
      ${dbxKpi({ label: 'Informations', valeur: nb('info'), sous: 'pour affiner', i: 2 })}
      ${dbxKpi({ label: 'Commissions contrôlées', valeur: allCommissionsAttente.length, sous: 'toutes les lignes', i: 3 })}
    </div>
    ${groupes.length ? groupes.map(gr => `<details class="dbx-carte ck-groupe ${gr.niveau}" ${gr.niveau === 'erreur' ? 'open' : ''}>
      <summary><span class="ck-niveau ${gr.niveau}">${gr.niveau === 'erreur' ? 'À corriger' : gr.niveau === 'attention' ? 'À vérifier' : 'Info'}</span><b>${gr.titre}</b><em>${gr.items.length}${total(gr.items) ? ` · CHF ${fmtCHF(Math.round(total(gr.items)))}` : ''}</em></summary>
      <p class="ck-explication">${gr.explication}</p>
      <div class="sfx-liste">${gr.items.slice(0, 60).map(ligne).join('')}</div>
    </details>`).join('') : '<section class="dbx-carte"><div class="dbx-vide"><span style="font-size:26px">✓</span>Aucune anomalie détectée.</div></section>'}`;
}

// ═══ OZ ↔ ASSUREX : REFACTURATION 2026 ══════════════════════════════════════════════════════
// Jusqu'à la fusion complète (01.01.2027), certaines commissions sont encore versées sur le compte
// OZ Assure alors qu'elles reviennent à Assurex. Règle (Jonathan, 19.09.2026) :
//   - reste à OZ : la gestion des clients marqués OZ encaissée avant 2027, et les acquisitions de
//     clients OZ sur des contrats antérieurs à la bascule (01.06.2026) ;
//   - revient à Assurex (à refacturer à OZ) : tout le reste — clients Assurex / EX, et production
//     OZ signée depuis la bascule.
// Les commissions qui reviennent à Assurex suivent le partage des apporteurs comme une commission
// reçue normalement (fiche de commission incluse).
function ozPartAssurex(ca) {
  if (!ca || ca.statut !== 'versé_oz') return false;
  const cl = ca.client_id ? allClients.find(x => x.id === ca.client_id) : null;
  const clientOZ = !!(cl && cl.source_oz);
  if (!clientOZ) return true;
  const date = (ca.date_reception || ca.date_creation || '').slice(0, 10);
  if (ca.nature === 'gestion') return !!date && date >= (typeof DATE_GESTION_ASSUREX !== 'undefined' ? DATE_GESTION_ASSUREX : '2027-01-01');
  const ct = ca.contrat_id ? allContrats.find(x => x.id === ca.contrat_id) : null;
  const depart = ct ? (ct.date_signature || ct.date_debut || '').slice(0, 10) : '';
  return !!depart && depart >= (typeof DATE_BASCULE_ASSUREX !== 'undefined' ? DATE_BASCULE_ASSUREX : '2026-06-01');
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
    <div class="sfx-intro">Commissions ${annee} versées sur le compte OZ Assure mais qui reviennent à Assurex : elles sont à <strong>refacturer à OZ</strong> pour équilibrer les comptes avant la fusion complète du 01.01.2027. Les parts des apporteurs s’appliquent comme pour une commission reçue.</div>
    <div class="dbx-kpis">
      ${dbxKpi({ label: 'À refacturer à OZ', valeur: somme(ouvertes, 'm'), prefixe: 'CHF ', sous: `${ouvertes.length} commission${ouvertes.length > 1 ? 's' : ''}`, i: 0 })}
      ${dbxKpi({ label: 'dont parts apporteurs', valeur: somme(ouvertes, 'pA'), prefixe: 'CHF ', sous: 'à verser via la fiche de commission', i: 1 })}
      ${dbxKpi({ label: 'Déjà refacturé', valeur: somme(lignes.filter(l => l.ca.refacture_le), 'm'), prefixe: 'CHF ', sous: annee, i: 2 })}
      ${dbxKpi({ label: 'Reste chez OZ', valeur: restentOZ.reduce((s, ca) => s + Number(ca.montant_final ?? ca.montant_estime ?? 0), 0), prefixe: 'CHF ', sous: 'gestion OZ avant 2027, production OZ antérieure', i: 3 })}
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
    </section>`;
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