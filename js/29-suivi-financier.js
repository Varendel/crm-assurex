// ═══ SUIVI FINANCIER MODERNISÉ (19.09.2026) ════════════════════════════════════════════════
// Trois onglets :
//   - Pilotage : reçu / reste attendu / retards / délai réel, encaissements par mois, prévision,
//     attente par compagnie et par ancienneté — chiffres Assurex uniquement (OZ à part) ;
//   - Précision des estimations : estimé vs réellement reçu, par compagnie / branche / nature,
//     taux constatés dans les décomptes → de quoi affiner les réglages au fil des imports ;
//   - Retards : commissions dont la date prévue est dépassée.
// L'ancienne page reste accessible (« Vue classique »).

window._sfxOnglet = window._sfxOnglet || 'ensemble';

function sfxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function sfxIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function sfxCie(n) { return (typeof normaliserCompagnie === 'function' ? normaliserCompagnie(n || '') : n) || '—'; }
function sfxBascule() { return typeof DATE_BASCULE_ASSUREX !== 'undefined' ? DATE_BASCULE_ASSUREX : '2026-06-01'; }
function sfxPct(x) { return (Math.round(x * 1000) / 10).toLocaleString('fr-CH') + ' %'; }

// Commission comptée dans les chiffres Assurex (ni OZ, ni contrat non commissionné / annulé)
function sfxCompte(ca) {
  if (ca.statut === 'versé_oz') return false;
  const ct = ca.contrat_id ? allContrats.find(x => x.id === ca.contrat_id) : null;
  if (ct && (ct.commissionne === false || ct.statut === 'annulé')) return false;
  if (ca.statut === 'en_attente' && typeof commissionGestionEncaisseeParOZ === 'function' && commissionGestionEncaisseeParOZ(ca, commissionDatePrevue(ca))) return false;
  return true;
}

// Encaissements Assurex datés : tranches (versements partiels) + commissions reçues sans tranche
function sfxEncaissements() {
  const bascule = sfxBascule();
  const tranches = typeof allCommissionTranches !== 'undefined' ? allCommissionTranches : [];
  const parId = new Set(tranches.map(t => t.commission_id));
  const res = [];
  tranches.forEach(t => {
    const ca = allCommissionsAttente.find(c => c.id === t.commission_id);
    if (!ca || ca.statut === 'versé_oz' || t.encaisse_par === 'oz') return; // encaissé par OZ : hors chiffres Assurex
    const d = (t.date_reception || t.created_at || '').slice(0, 10);
    if (d && d >= bascule) res.push({ date: d, montant: Number(t.montant || 0), ca });
  });
  allCommissionsAttente.filter(ca => ca.statut === 'reçue' && !parId.has(ca.id)).forEach(ca => {
    const d = (ca.date_reception || ca.date_creation || '').slice(0, 10);
    if (d && d >= bascule) res.push({ date: d, montant: Number(ca.montant_final ?? ca.montant_estime ?? 0), ca });
  });
  return res;
}

function sfxDonnees() {
  const auj = sfxIso(new Date());
  const enc = sfxEncaissements();
  const annee = auj.slice(0, 4);
  const recuAnnee = enc.filter(e => e.date.startsWith(annee)).reduce((s, e) => s + e.montant, 0);
  const attente = allCommissionsAttente.filter(ca => ca.statut === 'en_attente' && sfxCompte(ca));
  const reste = ca => typeof commissionResteAttendu === 'function' ? commissionResteAttendu(ca) : Number(ca.montant_estime || 0);
  const totalReste = attente.reduce((s, ca) => s + reste(ca), 0);
  const il60 = sfxIso(new Date(Date.now() - 60 * 86400000));
  const retards = attente.map(ca => {
    const j = typeof commissionJoursRetard === 'function' ? commissionJoursRetard(ca) : null;
    if (j !== null) return j > 0 ? { ca, jours: j, prevue: commissionDatePrevue(ca) } : null;
    const d = (ca.date_creation || '').slice(0, 10);
    return d && d < il60 ? { ca, jours: Math.round((new Date(auj) - new Date(d)) / 86400000) - 60, prevue: null } : null;
  }).filter(Boolean).sort((a, b) => b.jours - a.jours);
  // Délai réel : départ (signature / début) → réception
  const delais = allCommissionsAttente.filter(ca => ca.statut === 'reçue' && ca.date_reception).map(ca => {
    const dep = typeof commissionDateDepart === 'function' ? commissionDateDepart(ca) : ca.date_creation;
    return dep ? { cie: sfxCie(ca.compagnie), j: Math.round((new Date(ca.date_reception) - new Date(dep)) / 86400000) } : null;
  }).filter(x => x && x.j >= 0 && x.j < 800);
  const delaiMoyen = delais.length ? Math.round(delais.reduce((s, x) => s + x.j, 0) / delais.length) : null;
  // 12 derniers mois
  const mois = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); mois.push(sfxIso(d).slice(0, 7)); }
  const parMois = mois.map(m => enc.filter(e => e.date.startsWith(m)).reduce((s, e) => s + e.montant, 0));
  // Production encaissée par OZ Assure (compte courant OZ, net crédit − débit) : affichée à côté
  // d'Assurex, dans une autre couleur, pour voir toute la production du groupe jusqu'à la fusion.
  const ledger = window._ck && window._ck.ozLedger;
  if (!ledger && window._ck && !window._ck.ozLedgerEnCours && typeof dbGet === 'function') {
    window._ck.ozLedgerEnCours = true;
    dbGet('commissions_oz', 'select=*&order=date_mouvement.asc').then(r => { window._ck.ozLedger = Array.isArray(r) ? r : []; window._ck.ozLedgerEnCours = false; if (typeof ckRerendre === 'function') ckRerendre(); });
  }
  const netOZ = r => Number(r.credit || 0) - Number(r.debit || 0);
  const parMoisOZ = mois.map(m => (ledger || []).filter(r => String(r.date_mouvement || '').startsWith(m)).reduce((s, r) => s + netOZ(r), 0));
  const recuAnneeOZ = (ledger || []).filter(r => String(r.date_mouvement || '').startsWith(annee)).reduce((s, r) => s + netOZ(r), 0);
  // Commission mensuelle moyenne (occurrences réelles des 12 derniers mois, Assurex + OZ) :
  // nombre moyen de versements par mois × montant moyen d'un versement = entrée mensuelle type.
  const debut12 = mois[0] + '-01';
  const occ = [
    ...enc.filter(e => e.date >= debut12 && e.montant > 0).map(e => e.montant),
    ...(ledger || []).filter(r => String(r.date_mouvement || '') >= debut12 && Number(r.credit) > 0).map(r => Number(r.credit)),
  ];
  // Mois « actifs » seulement (au moins un versement) : les mois sans décompte saisi ne tirent pas la moyenne vers le bas
  const moisActifs = mois.filter((m, i) => Math.max(0, parMois[i]) + Math.max(0, parMoisOZ[i]) > 0).length || 1;
  const moyenne = {
    nbParMois: occ.length / moisActifs,
    montantMoyen: occ.length ? occ.reduce((s, v) => s + v, 0) / occ.length : 0,
    moisActifs,
  };
  moyenne.mensuelle = moyenne.nbParMois * moyenne.montantMoyen;
  // Attente par compagnie
  const cies = {};
  attente.forEach(ca => { const k = sfxCie(ca.compagnie); cies[k] = cies[k] || { total: 0, nb: 0 }; cies[k].total += reste(ca); cies[k].nb++; });
  // Ancienneté
  const tranchesAge = [['0–30 j', 0, 30, '#22C55E'], ['31–60 j', 31, 60, '#F59E0B'], ['61–90 j', 61, 90, '#FB923C'], ['+ 90 j', 91, 1e9, '#EF4444']].map(([l, a, b, c]) => {
    const liste = attente.filter(ca => { const d = (ca.date_creation || '').slice(0, 10); if (!d) return false; const j = Math.round((new Date(auj) - new Date(d)) / 86400000); return j >= a && j <= b; });
    return { l, c, nb: liste.length, total: liste.reduce((s, ca) => s + reste(ca), 0) };
  });
  const oz = allCommissionsAttente.filter(ca => ca.statut === 'versé_oz');
  return { auj, annee, recuAnnee, totalReste, attente, retards, delaiMoyen, delais, mois, parMois, parMoisOZ, recuAnneeOZ, ozCharge: !!ledger, moyenne, cies, tranchesAge, oz, reste };
}

// ── Pilotage par compagnie (19.09.2026) ─────────────────────────────────────────────────────
// Pour chaque compagnie, à partir des versements RÉELS (Assurex + compte courant OZ) :
//   - encaissé sur 12 mois, nombre de versements, montant moyen ;
//   - rythme de paiement détecté (écart médian entre deux versements : mensuel, trimestriel…)
//     et date du prochain versement probable ;
//   - attendu restant, et « attendu ajusté » = attendu × précision historique des estimations
//     de cette compagnie (médiane réel / estimé, dès 3 commissions comparables).
function sfxParCompagnie() {
  const iso = d => sfxIso(d);
  const d12 = new Date(); d12.setMonth(d12.getMonth() - 12); const debut = iso(d12);
  const map = {};
  const get = n => { const k = sfxCie(n); return map[k] = map[k] || { cie: k, pay: [], attendu: 0, nbAtt: 0, ratios: [] }; };
  sfxEncaissements().forEach(e => get(e.ca.compagnie).pay.push({ d: e.date, m: e.montant, src: 'assurex' }));
  ((window._ck && window._ck.ozLedger) || []).forEach(r => {
    const m = Number(r.credit || 0) - Number(r.debit || 0);
    if (m && r.compagnie && r.date_mouvement) get(r.compagnie).pay.push({ d: String(r.date_mouvement).slice(0, 10), m, src: 'oz' });
  });
  const reste = ca => typeof commissionResteAttendu === 'function' ? commissionResteAttendu(ca) : Number(ca.montant_estime || 0);
  allCommissionsAttente.forEach(ca => {
    if (ca.statut === 'en_attente') { const r = reste(ca); if (r > 0) { const x = get(ca.compagnie); x.attendu += r; x.nbAtt++; } }
    else if (['reçue', 'versé_oz'].includes(ca.statut) && ca.montant_final != null && Number(ca.montant_estime) > 0 && Number(ca.montant_final) > 0) {
      get(ca.compagnie).ratios.push(Number(ca.montant_final) / Number(ca.montant_estime));
    }
  });
  const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
  return Object.values(map).map(x => {
    const p12 = x.pay.filter(p => p.d >= debut);
    const total12 = p12.reduce((s, p) => s + p.m, 0);
    const oz12 = p12.filter(p => p.src === 'oz').reduce((s, p) => s + p.m, 0);
    const jours = [...new Set(x.pay.filter(p => p.m > 0).map(p => p.d))].sort();
    const ecarts = jours.slice(1).map((d, i) => Math.round((new Date(d) - new Date(jours[i])) / 864e5)).filter(g => g > 3);
    const gap = med(ecarts);
    const rythme = gap == null ? (jours.length ? 'ponctuel' : '—') : gap <= 45 ? 'mensuel' : gap <= 110 ? 'trimestriel' : gap <= 220 ? 'semestriel' : 'annuel';
    const dernier = jours[jours.length - 1] || null;
    let prochain = null;
    if (dernier && gap) { const d = new Date(dernier); d.setDate(d.getDate() + Math.round(gap)); prochain = iso(d); }
    const coef = x.ratios.length >= 3 ? med(x.ratios) : null;
    return { ...x, total12, oz12, assurex12: total12 - oz12, nb12: p12.filter(p => p.m > 0).length, moyVersement: p12.length ? total12 / Math.max(1, p12.filter(p => p.m > 0).length) : 0,
      moyMens: total12 / 12, rythme, gap, dernier, prochain, coef, attenduAjuste: coef ? x.attendu * coef : x.attendu };
  }).filter(x => x.total12 || x.attendu).sort((a, b) => (b.total12 + b.attenduAjuste) - (a.total12 + a.attenduAjuste));
}

function htmlSfxCompagnies() {
  const L = sfxParCompagnie();
  const charge = !!(window._ck && window._ck.ozLedger);
  const auj = sfxIso(new Date());
  const tot = k => L.reduce((s, x) => s + (x[k] || 0), 0);
  const maxT = Math.max(1, ...L.map(x => x.total12));
  const precision = x => x.coef == null ? '<span style="color:var(--text-muted)">pas assez de données</span>'
    : `<b style="color:${x.coef >= 1 ? '#16A34A' : '#DC2626'}">${x.coef >= 1 ? '+' : ''}${Math.round((x.coef - 1) * 100)} %</b> <small>sur ${x.ratios.length}</small>`;
  return `
    <div class="sfx-intro">Entrées de commissions pilotées par compagnie, à partir des versements <strong>réels</strong> (Assurex et compte courant OZ). Le rythme et la date du prochain versement sont déduits de l’historique ; l’<strong>attendu ajusté</strong> corrige l’estimation par la précision réellement observée chez chaque compagnie.${charge ? '' : ' <em>Chargement du compte courant OZ…</em>'}</div>
    <div class="dbx-kpis">
      ${dbxKpi({ label: 'Encaissé 12 mois', valeur: tot('total12'), prefixe: 'CHF ', sous: `dont OZ CHF ${fmtCHF(Math.round(tot('oz12')))}`, i: 0 })}
      ${dbxKpi({ label: 'Moyenne mensuelle', valeur: tot('moyMens'), prefixe: 'CHF ', sous: 'toutes compagnies, 12 mois', i: 1 })}
      ${dbxKpi({ label: 'Attendu (estimations)', valeur: tot('attendu'), prefixe: 'CHF ', sous: `${L.reduce((s, x) => s + x.nbAtt, 0)} commissions`, i: 2 })}
      ${dbxKpi({ label: 'Attendu ajusté', valeur: tot('attenduAjuste'), prefixe: 'CHF ', sous: 'corrigé par la précision réelle', i: 3 })}
    </div>
    <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Par compagnie</h2><span class="dbx-carte-sous">trié par poids total</span></header>
      <div style="display:flex;flex-direction:column;gap:10px">${L.map(x => {
        const w = Math.round(x.total12 / maxT * 100), wOz = x.total12 ? Math.round(x.oz12 / x.total12 * w) : 0;
        const retard = x.prochain && x.prochain < auj;
        return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 14px;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">${typeof pictoCompagnie === 'function' ? pictoCompagnie(x.cie, 30) : ''}<b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sfxEsc(x.cie)}</b></div>
          <div><div style="font-weight:800">CHF ${fmtCHF(Math.round(x.total12))} <small style="color:var(--text-muted);font-weight:500">12 mois</small></div>
            <div style="height:6px;border-radius:9px;background:var(--surface-alt,rgba(148,163,184,.18));overflow:hidden;margin-top:4px;display:flex"><i style="width:${w - wOz}%;background:#00CFFF"></i><i style="width:${wOz}%;background:#22C55E"></i></div>
            <small style="color:var(--text-muted)">${x.nb12} versement${x.nb12 > 1 ? 's' : ''} · moy. CHF ${fmtCHF(Math.round(x.moyVersement))}</small></div>
          <div><small style="color:var(--text-muted)">Rythme</small><div><b>${x.rythme}</b>${x.gap ? ` <small>(~${Math.round(x.gap)} j)</small>` : ''}</div>
            <small style="color:${retard ? '#DC2626' : 'var(--text-muted)'}">${x.prochain ? `prochain ≈ ${fmtDate(x.prochain)}${retard ? ' · en retard' : ''}` : (x.dernier ? `dernier ${fmtDate(x.dernier)}` : '')}</small></div>
          <div><small style="color:var(--text-muted)">Attendu</small><div><b>CHF ${fmtCHF(Math.round(x.attenduAjuste))}</b></div>
            <small style="color:var(--text-muted)">${x.coef ? `estimé ${fmtCHF(Math.round(x.attendu))}` : `${x.nbAtt} commission${x.nbAtt > 1 ? 's' : ''}`}</small></div>
          <div><small style="color:var(--text-muted)">Précision des estimations</small><div>${precision(x)}</div></div>
        </div>`;
      }).join('') || '<div class="dbx-vide-petit">Aucune donnée.</div>'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:12px;font-size:12px;color:var(--text-muted)">
        <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:11px;height:11px;border-radius:3px;background:#00CFFF"></i>Assurex</span>
        <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:11px;height:11px;border-radius:3px;background:#22C55E"></i>OZ Assure</span>
        <span>Précision : écart médian réel / estimé (+ = la compagnie paie plus que prévu)</span>
      </div>
    </section>`;
}

// Barres empilées Assurex (bleu) + OZ Assure (vert) par mois, avec légende
function sfxBarresEncaisse(D) {
  const tot = D.mois.map((m, i) => Math.max(0, D.parMois[i]) + Math.max(0, D.parMoisOZ[i] || 0));
  const moy = D.moyenne ? D.moyenne.mensuelle : 0;
  const max = Math.max(1, ...tot, moy);
  const CA = '#00CFFF', CO = '#22C55E', CM = '#F59E0B';
  // Ligne pointillée de la commission mensuelle moyenne (même échelle : 150 px = max, base à 22 px du bas)
  const yMoy = moy ? Math.round(moy / max * 150) + 22 : 0;
  return `<div style="position:relative;display:flex;align-items:flex-end;gap:6px;height:190px;padding-top:18px">
    ${moy ? `<div title="Commission mensuelle moyenne : CHF ${fmtCHF(Math.round(moy))}" style="position:absolute;left:0;right:0;bottom:${yMoy}px;border-top:2px dashed ${CM};pointer-events:none;z-index:1"><span style="position:absolute;right:0;top:-18px;font-size:10.5px;font-weight:700;color:${CM};background:var(--surface);padding:0 4px;border-radius:4px">moy. ${dbxCompact(moy)}/mois</span></div>` : ''}
    ${D.mois.map((m, i) => {
    const a = Math.max(0, D.parMois[i]), o = Math.max(0, D.parMoisOZ[i] || 0), t = a + o;
    const h = Math.round(t / max * 150);
    return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%" title="${dbxLibelleMois(m)} ${m.slice(0, 4)} — Assurex CHF ${fmtCHF(Math.round(a))} · OZ CHF ${fmtCHF(Math.round(o))}">
      <span style="font-size:10px;color:var(--text-muted);margin-bottom:3px;white-space:nowrap">${t ? dbxCompact(t) : ''}</span>
      <span style="width:70%;max-width:34px;height:${Math.max(t ? 3 : 2, h)}px;display:flex;flex-direction:column;border-radius:6px 6px 3px 3px;overflow:hidden;background:var(--surface-alt,rgba(148,163,184,.15))">
        ${o ? `<i style="flex:${o};background:${CO}"></i>` : ''}${a ? `<i style="flex:${a};background:${CA}"></i>` : ''}
      </span>
      <span style="font-size:10.5px;color:var(--text-muted);margin-top:5px">${dbxLibelleMois(m)}</span>
    </div>`;
  }).join('')}</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:10px;font-size:12px;color:var(--text-muted)">
    <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:11px;height:11px;border-radius:3px;background:${CA}"></i>Encaissé par Assurex</span>
    <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:11px;height:11px;border-radius:3px;background:${CO}"></i>Encaissé par OZ Assure (compte courant OZ)</span>
    ${moy ? `<span style="display:inline-flex;align-items:center;gap:6px"><i style="width:16px;height:0;border-top:2px dashed ${CM}"></i>Commission mensuelle moyenne</span>` : ''}
    ${D.ozCharge ? '' : '<span>· chargement du compte courant OZ…</span>'}
  </div>`;
}

function viewSuiviFinancierV2() {
  if (window._sfxOnglet === 'classique') {
    return `<div class="dbx"><button type="button" class="dbx-lien" onclick="window._sfxOnglet='pilotage';navigate('suivi-financier')">← Revenir au nouveau suivi financier</button></div>${viewSuiviFinancier()}`;
  }
  const D = sfxDonnees();
  const nbAnomalies = typeof ckAnomalies === 'function' ? ckAnomalies().filter(g => g.niveau !== 'info').reduce((s, g) => s + g.items.length, 0) : 0;
  const onglets = [
    ...(typeof htmlCockpitEnsemble === 'function' ? [['ensemble', '🧭 Vue d’ensemble']] : []),
    ['pilotage', '📊 Commissions'],
    ['compagnies', '🏢 Par compagnie'],
    ...(typeof htmlPrevisions12Mois === 'function' ? [['previsions', '📅 Prévisions 12 mois']] : []),
    ...(typeof htmlObjectifs === 'function' ? [['objectifs', '🎯 Objectifs']] : []),
    ...(typeof htmlCockpitRentabilite === 'function' ? [['rentabilite', '💎 Rentabilité']] : []),
    ['precision', '🎯 Précision des estimations'],
    ['retards', `⏳ Retards${D.retards.length ? ' <span class="dbx-pastille">' + D.retards.length + '</span>' : ''}`],
    ...(typeof htmlCockpitControle === 'function' ? [['controle', `🔍 Contrôle${nbAnomalies ? ' <span class="dbx-pastille">' + nbAnomalies + '</span>' : ''}`]] : []),
    ...(typeof htmlCockpitOZ === 'function' && currentUser && currentUser.role === 'signataire' ? [['oz', '🔹 OZ ↔ Assurex']] : []),
  ];
  let corps = '';
  if (window._sfxOnglet === 'ensemble' && typeof htmlCockpitEnsemble === 'function') corps = htmlCockpitEnsemble(D);
  else if (window._sfxOnglet === 'controle' && typeof htmlCockpitControle === 'function') corps = htmlCockpitControle();
  else if (window._sfxOnglet === 'rentabilite' && typeof htmlCockpitRentabilite === 'function') corps = htmlCockpitRentabilite();
  else if (window._sfxOnglet === 'oz' && typeof htmlCockpitOZ === 'function' && currentUser && currentUser.role === 'signataire') corps = htmlCockpitOZ();
  else if (window._sfxOnglet === 'precision') corps = htmlSfxPrecision();
  else if (window._sfxOnglet === 'compagnies') corps = htmlSfxCompagnies();
  else if (window._sfxOnglet === 'previsions' && typeof htmlPrevisions12Mois === 'function') corps = htmlPrevisions12Mois();
  else if (window._sfxOnglet === 'objectifs' && typeof htmlObjectifs === 'function') corps = htmlObjectifs();
  else if (window._sfxOnglet === 'retards') corps = htmlSfxRetards(D);
  else corps = htmlSfxPilotage(D);
  return `<div class="dbx sfx">
    <header class="dx-tete">
      <div><div class="dx-surtitre">Finances</div><h2>Cockpit financier</h2></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-secondary" onclick="navigate('tresorerie')">📈 Plan de trésorerie</button>
        ${typeof viewFacturesQR === 'function' ? `<button type="button" class="btn-secondary" onclick="navigate('factures')">🧾 Factures QR</button>` : ''}
        <button type="button" class="btn-secondary" onclick="navigate('import-decompte')">📥 Importer un décompte</button>
        <button type="button" class="opx-lien" onclick="window._sfxOnglet='classique';navigate('suivi-financier')">Vue classique</button>
      </div>
    </header>
    <div class="dbx-onglets" role="tablist">${onglets.map(([id, l]) => `<button type="button" role="tab" aria-selected="${window._sfxOnglet === id}" class="${window._sfxOnglet === id ? 'actif' : ''}" onclick="window._sfxOnglet='${id}';navigate('suivi-financier')">${l}</button>`).join('')}</div>
    ${corps}
  </div>`;
}

// ── Pilotage ────────────────────────────────────────────────────────────────────────────────
function htmlSfxPilotage(D) {
  const totalRetard = D.retards.reduce((s, r) => s + D.reste(r.ca), 0);
  const pv = typeof previsionGestionParMois === 'function' ? previsionGestionParMois(12) : null;
  const ciesTri = Object.entries(D.cies).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  const maxCie = Math.max(1, ...ciesTri.map(([, x]) => x.total));
  const maxAge = Math.max(1, ...D.tranchesAge.map(t => t.total));
  return `
    <div class="dbx-kpis">
      ${dbxKpi({ label: `Reçu en ${D.annee} (Assurex)`, valeur: D.recuAnnee, prefixe: 'CHF ', sous: `depuis le ${fmtDate(sfxBascule())}`, i: 0 })}
      ${dbxKpi({ label: `Encaissé par OZ en ${D.annee}`, valeur: D.recuAnneeOZ || 0, prefixe: 'CHF ', sous: D.ozCharge ? `production du groupe : CHF ${fmtCHF(Math.round((D.recuAnnee || 0) + (D.recuAnneeOZ || 0)))}` : 'chargement…', i: 0 })}
      ${D.moyenne && D.moyenne.mensuelle ? dbxKpi({ label: 'Commission mensuelle moyenne', valeur: D.moyenne.mensuelle, prefixe: 'CHF ', sous: `≈ ${D.moyenne.nbParMois.toFixed(1).replace('.', ',')} versements/mois × CHF ${fmtCHF(Math.round(D.moyenne.montantMoyen))} (12 mois, Assurex + OZ)`, i: 0 }) : ''}
      ${dbxKpi({ label: 'Reste attendu', valeur: D.totalReste, prefixe: 'CHF ', sous: `${D.attente.length} commission${D.attente.length > 1 ? 's' : ''}`, onclick: "navigate('commissions-attente')", i: 1 })}
      ${dbxKpi({ label: 'En retard', valeur: totalRetard, prefixe: 'CHF ', sous: `${D.retards.length} dossier${D.retards.length > 1 ? 's' : ''}`, onclick: "window._sfxOnglet='retards';navigate('suivi-financier')", i: 2 })}
      ${dbxKpi({ label: 'Délai réel de paiement', valeur: D.delaiMoyen ?? 0, suffixe: D.delaiMoyen === null ? '' : ' j', sous: D.delais.length ? `moyenne sur ${D.delais.length} paiement${D.delais.length > 1 ? 's' : ''}` : 'pas encore de paiement daté', i: 3 })}
    </div>
    <div class="dbx-grille dbx-grille-egale">
      <section class="dbx-carte dbx-anim" style="--i:4"><header class="dbx-carte-tete"><h2>Encaissé par mois</h2><span class="dbx-carte-sous">12 derniers mois · Assurex + OZ Assure</span></header>
        ${sfxBarresEncaisse(D)}</section>
      <section class="dbx-carte dbx-anim" style="--i:5"><header class="dbx-carte-tete"><h2>Attendu — commissions de gestion</h2><span class="dbx-carte-sous">selon la règle de versement</span></header>
        ${pv ? sfxBarres([{ l: 'Retard', v: pv.retard.total, c: '#EF4444' }, ...pv.mois.map(m => ({ l: dbxLibelleMois(m.cle), v: m.total, c: '#5B82C9' }))]) : '<div class="dbx-vide-petit">—</div>'}</section>
      <section class="dbx-carte dbx-anim" style="--i:6"><header class="dbx-carte-tete"><h2>Reste attendu par compagnie</h2><button type="button" class="dbx-lien" onclick="navigate('commissions-attente')">Toutes les commissions →</button></header>
        ${ciesTri.length ? `<div class="dbx-hbarres">${ciesTri.map(([cie, x], i) => `<div class="dbx-hbarre" style="--i:${i}">
          <span class="dbx-hbarre-nom">${typeof pictoCompagnie === 'function' ? pictoCompagnie(cie, 22) : ''}<span>${sfxEsc(cie)}</span></span>
          <span class="dbx-hbarre-piste"><span style="--w:${Math.round(x.total / maxCie * 100)}%"></span></span>
          <span class="dbx-hbarre-val">${dbxCompact(x.total)}<small>${x.nb}</small></span></div>`).join('')}</div>` : '<div class="dbx-vide-petit">Rien en attente.</div>'}</section>
      <section class="dbx-carte dbx-anim" style="--i:7"><header class="dbx-carte-tete"><h2>Ancienneté des attentes</h2><span class="dbx-carte-sous">depuis la création de la commission</span></header>
        <div class="dbx-hbarres">${D.tranchesAge.map((t, i) => `<div class="dbx-hbarre" style="--i:${i}">
          <span class="dbx-hbarre-nom"><span class="dbx-point" style="background:${t.c}"></span><span>${t.l}</span></span>
          <span class="dbx-hbarre-piste"><span style="--w:${Math.round(t.total / maxAge * 100)}%;background:${t.c}"></span></span>
          <span class="dbx-hbarre-val">${dbxCompact(t.total)}<small>${t.nb}</small></span></div>`).join('')}</div></section>
    </div>
    ${D.oz.length ? `<div class="sfx-note">🔹 ${D.oz.length} commission${D.oz.length > 1 ? 's' : ''} versée${D.oz.length > 1 ? 's' : ''} à OZ Assure (CHF ${fmtCHF(Math.round(D.oz.reduce((s, ca) => s + Number(ca.montant_final ?? ca.montant_estime ?? 0), 0)))}) — tenues à part, hors chiffres Assurex.</div>` : ''}`;
}

function sfxBarres(items) {
  const max = Math.max(1, ...items.map(x => x.v));
  return `<div class="dbx-barres">${items.map((x, i) => `<div class="dbx-barre-col" title="${sfxEsc(x.l)} : ${dbxCHF(x.v)}">
    <span class="dbx-barre-val">${x.v ? dbxCompact(x.v) : ''}</span>
    <span class="dbx-barre" style="--h:${Math.max(2, Math.round(x.v / max * 100))}%;--c:${x.c};--i:${i}"></span>
    <span class="dbx-barre-mois">${sfxEsc(x.l)}</span></div>`).join('')}</div>`;
}

// ── Retards ─────────────────────────────────────────────────────────────────────────────────
function htmlSfxRetards(D) {
  if (!D.retards.length) return `<section class="dbx-carte"><div class="dbx-vide"><span style="font-size:26px">✓</span>Aucune commission en retard.</div></section>`;
  return `<section class="dbx-carte"><header class="dbx-carte-tete"><h2>Commissions en retard</h2><span class="dbx-carte-sous">gestion : date prévue dépassée · acquisition : plus de 60 jours</span></header>
    <div class="sfx-liste">${D.retards.map(r => `<div class="sfx-ligne">
      <span class="sfx-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(r.ca.compagnie, 30) : ''}</span>
      <span class="sfx-corps"><b>${sfxEsc(r.ca.client_nom || '—')}</b><small>${sfxEsc(r.ca.produit || '')} · ${sfxEsc(sfxCie(r.ca.compagnie))} · ${r.ca.nature === 'gestion' ? 'gestion' : 'acquisition'}${r.prevue ? ' · prévue le ' + fmtDate(r.prevue) : ''}</small></span>
      <span class="sfx-retard">${r.jours} j</span>
      <span class="sfx-montant">CHF ${fmtCHF2(D.reste(r.ca))}</span>
    </div>`).join('')}</div></section>`;
}

// ── Précision des estimations ───────────────────────────────────────────────────────────────
// Une commission est « comparable » quand on connaît à la fois l'estimation faite par REX et le
// montant réellement versé : reçue (soldée) avec une estimation d'origine différente d'une simple
// recopie du décompte. Les versements partiels en cours sont listés à part (pas encore concluants).
function sfxComparables() {
  const ctPrime = ca => { const ct = ca.contrat_id ? allContrats.find(x => x.id === ca.contrat_id) : null; return ct ? Number(ct.prime_annuelle || 0) : 0; };
  const categorie = p => (typeof categoriePourProduitLibre === 'function' ? categoriePourProduitLibre(p) : null) || p || '—';
  const issuDecompte = ca => /^Décompte compagnie importé/.test(ca.detail_calcul || '');
  const lignes = [];
  allCommissionsAttente.forEach(ca => {
    // Les commissions versées à OZ comptent aussi : le taux de la compagnie est le même
    if (ca.statut === 'annulée' || issuDecompte(ca)) return;
    const est = Number(ca.montant_estime || 0);
    if (!est) return;
    const recuTranches = typeof commissionDejaRecu === 'function' ? commissionDejaRecu(ca) : 0;
    let reel = null, etat = null;
    if (ca.statut === 'reçue' || ca.statut === 'versé_oz') { reel = ca.montant_final != null ? Number(ca.montant_final) : recuTranches || null; etat = 'solde'; if (ca.statut === 'versé_oz' && reel === est) return; }
    else if (ca.statut === 'en_attente' && recuTranches > 0) { reel = recuTranches; etat = 'partiel'; }
    if (reel === null) return;
    lignes.push({ ca, est, reel, etat, prime: ctPrime(ca), cie: sfxCie(ca.compagnie), cat: categorie(ca.produit), nature: ca.nature === 'gestion' ? 'gestion' : 'acquisition', generique: /Estimation 10%|générique/i.test(ca.detail_calcul || '') });
  });
  return lignes;
}

// Taux réellement appliqués par les compagnies, lus dans le détail des lignes importées
// (« base CHF 506 × 12% »)
function sfxTauxDecomptes() {
  const res = {};
  allCommissionsAttente.forEach(ca => {
    const m = String(ca.detail_calcul || '').match(/^Décompte compagnie importé[^—]*— (.+?) : base CHF ([\d' ., ]+) × ([\d.,]+)\s*%/);
    if (!m) return;
    const cle = `${sfxCie(ca.compagnie)}|${m[1].trim()}`;
    const taux = parseFloat(m[3].replace(',', '.'));
    res[cle] = res[cle] || { cie: sfxCie(ca.compagnie), branche: m[1].trim(), taux: {}, nb: 0 };
    res[cle].taux[taux] = (res[cle].taux[taux] || 0) + 1;
    res[cle].nb++;
  });
  return Object.values(res).sort((a, b) => a.cie.localeCompare(b.cie) || b.nb - a.nb);
}

function htmlSfxPrecision() {
  const lignes = sfxComparables();
  const soldes = lignes.filter(l => l.etat === 'solde');
  const partiels = lignes.filter(l => l.etat === 'partiel');
  const sumEst = soldes.reduce((s, l) => s + l.est, 0), sumReel = soldes.reduce((s, l) => s + l.reel, 0);
  const groupes = {};
  soldes.forEach(l => {
    const k = `${l.cie}|${l.cat}|${l.nature}`;
    const g = groupes[k] = groupes[k] || { cie: l.cie, cat: l.cat, nature: l.nature, n: 0, est: 0, reel: 0, primeEst: 0, primeReel: 0, prime: 0, generique: 0 };
    g.n++; g.est += l.est; g.reel += l.reel; if (l.generique) g.generique++;
    if (l.prime) { g.prime += l.prime; g.primeEst += l.est; g.primeReel += l.reel; }
  });
  const gs = Object.values(groupes).sort((a, b) => Math.abs(b.reel - b.est) - Math.abs(a.reel - a.est));
  const taux = sfxTauxDecomptes();
  const ecartGlobal = sumEst ? sumReel / sumEst - 1 : 0;
  const couleur = r => Math.abs(r - 1) <= 0.05 ? 'ok' : Math.abs(r - 1) <= 0.2 ? 'moyen' : 'fort';

  return `
    <div class="sfx-intro">Chaque décompte importé compare ce que REX avait estimé à ce que la compagnie a réellement versé. Plus tu importes, plus ce tableau est fiable — il sert à corriger les taux de commission paramétrés.</div>
    <div class="dbx-kpis">
      ${dbxKpi({ label: 'Commissions comparées', valeur: soldes.length, sous: partiels.length ? `+ ${partiels.length} en cours de paiement` : 'soldées', i: 0 })}
      ${dbxKpi({ label: 'Total estimé', valeur: sumEst, prefixe: 'CHF ', sous: 'par REX', i: 1 })}
      ${dbxKpi({ label: 'Total réellement reçu', valeur: sumReel, prefixe: 'CHF ', sous: 'selon les décomptes', i: 2 })}
      ${dbxKpi({ label: 'Écart global', valeur: Math.round(ecartGlobal * 100), prefixe: ecartGlobal > 0 ? '+' : '', suffixe: ' %', sous: ecartGlobal > 0.05 ? 'REX sous-estime' : ecartGlobal < -0.05 ? 'REX surestime' : 'estimations justes', i: 3 })}
    </div>
    <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Écarts par compagnie et branche</h2><span class="dbx-carte-sous">les plus gros écarts en premier</span></header>
      ${gs.length ? `<div class="sfx-table">
        <div class="sfx-tr sfx-th"><span>Compagnie · branche</span><span>Nb</span><span>Estimé</span><span>Reçu</span><span>Écart</span><span>Réglage suggéré</span></div>
        ${gs.map(g => {
          const r = g.est ? g.reel / g.est : 1;
          const tEst = g.prime ? g.primeEst / g.prime : null, tReel = g.prime ? g.primeReel / g.prime : null;
          const suggestion = Math.abs(r - 1) <= 0.05 ? '✓ Estimation juste'
            : (tEst !== null && tReel !== null ? `Taux ${sfxPct(tEst)} → <b>${sfxPct(tReel)}</b> de la prime` : `Multiplier l'estimation par ${r.toFixed(2).replace('.', ',')}`);
          return `<div class="sfx-tr">
            <span class="sfx-nom">${typeof pictoCompagnie === 'function' ? pictoCompagnie(g.cie, 24) : ''}<span><b>${sfxEsc(g.cie)}</b><small>${sfxEsc(g.cat)} · ${g.nature}${g.generique ? ' · estimation générique 10 %' : ''}</small></span></span>
            <span>${g.n}</span><span>CHF ${fmtCHF2(g.est)}</span><span>CHF ${fmtCHF2(g.reel)}</span>
            <span class="sfx-ecart ${couleur(r)}">${r >= 1 ? '+' : ''}${Math.round((r - 1) * 100)} %</span>
            <span class="sfx-sugg">${suggestion}</span>
          </div>`;
        }).join('')}
      </div>` : '<div class="dbx-vide-petit">Pas encore de commission soldée avec une estimation d’origine. Le tableau se remplira au fil des décomptes importés.</div>'}
    </section>
    <div class="dbx-grille dbx-grille-egale" style="margin-top:18px">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Taux constatés dans les décomptes</h2><span class="dbx-carte-sous">ce que les compagnies appliquent vraiment</span></header>
        ${taux.length ? `<div class="sfx-mini">${taux.map(t => `<div><span>${typeof pictoCompagnie === 'function' ? pictoCompagnie(t.cie, 20) : ''}<b>${sfxEsc(t.branche)}</b><small>${sfxEsc(t.cie)} · ${t.nb} ligne${t.nb > 1 ? 's' : ''}</small></span><em>${Object.keys(t.taux).map(x => x.replace('.', ',') + ' %').join(' / ')}</em></div>`).join('')}</div>` : '<div class="dbx-vide-petit">Aucun décompte importé avec le détail des taux.</div>'}
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>En cours de paiement</h2><span class="dbx-carte-sous">pas encore concluant (versements partiels)</span></header>
        ${partiels.length ? `<div class="sfx-mini">${partiels.slice().sort((a, b) => b.reel / b.est - a.reel / a.est).map(l => `<div><span>${typeof pictoCompagnie === 'function' ? pictoCompagnie(l.cie, 20) : ''}<b>${sfxEsc(l.ca.client_nom || '—')}</b><small>${sfxEsc(l.ca.produit || '')} · ${sfxEsc(l.cie)}</small></span><em>${fmtCHF2(l.reel)} / ${fmtCHF2(l.est)} <small>(${Math.round(l.reel / l.est * 100)} %)</small></em></div>`).join('')}</div>` : '<div class="dbx-vide-petit">Aucun versement partiel en cours.</div>'}
      </section>
    </div>
    <section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Journal des écarts</h2><span class="dbx-carte-sous">enregistré à chaque import qui solde une commission</span></header>
      <div id="sfx-journal"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
    </section>${(setTimeout(sfxChargerJournal, 0), '')}`;
}

async function sfxChargerJournal() {
  const zone = document.getElementById('sfx-journal');
  if (!zone) return;
  const rows = await dbGet('commission_ecarts', 'select=*&order=created_at.desc&limit=60');
  if (!Array.isArray(rows) || !rows.length) { zone.innerHTML = '<div class="dbx-vide-petit">Le journal se remplira au prochain import de décompte.</div>'; return; }
  zone.innerHTML = `<div class="sfx-table">
    <div class="sfx-tr sfx-th"><span>Compagnie · produit</span><span>Nature</span><span>Estimé</span><span>Reçu</span><span>Écart</span><span>Détail</span></div>
    ${rows.map(r => {
      const est = Number(r.montant_estime || 0), recu = Number(r.montant_recu || 0);
      const ratio = est ? recu / est : 1;
      const cls = Math.abs(ratio - 1) <= 0.05 ? 'ok' : Math.abs(ratio - 1) <= 0.2 ? 'moyen' : 'fort';
      const tauxReel = r.prime_annuelle ? recu / Number(r.prime_annuelle) : null;
      return `<div class="sfx-tr">
        <span class="sfx-nom">${typeof pictoCompagnie === 'function' ? pictoCompagnie(sfxCie(r.compagnie), 22) : ''}<span><b>${sfxEsc(sfxCie(r.compagnie))}</b><small>${sfxEsc(r.produit || '')} · ${fmtDate(r.created_at)}</small></span></span>
        <span>${sfxEsc(r.nature || '—')}</span><span>CHF ${fmtCHF2(est)}</span><span>CHF ${fmtCHF2(recu)}</span>
        <span class="sfx-ecart ${cls}">${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)} %</span>
        <span class="sfx-sugg">${r.taux_decompte ? `taux décompte ${String(r.taux_decompte).replace('.', ',')} % · ` : ''}${tauxReel !== null ? `soit ${sfxPct(tauxReel)} de la prime` : ''}${r.note ? ` · ${sfxEsc(r.note)}` : ''}</span>
      </div>`;
    }).join('')}
  </div>`;
}
