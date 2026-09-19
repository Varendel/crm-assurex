// ═══ PRÉVISIONS 12 MOIS : QUI PAIE QUOI, QUAND (19.09.2026) ═════════════════════════════════
// Demande de Jonathan : savoir quels clients vont payer à quel mois, quelle commission, pour quel
// contrat. Même moteur que le plan de trésorerie (js/21) et les règles de versement (js/19) :
//   - commissions en attente : reste à encaisser, date prévue (profil réel de la compagnie pour la
//     gestion, fractionnée selon la périodicité ; acquisition = création + délai moyen observé) ;
//   - gestion des années suivantes : projection (prime × taux constaté), rien n'est enregistré.
// La gestion des clients OZ encaissée par OZ avant le 01.01.2027 est affichée à part (hors Assurex).

window._pv = window._pv || { filtre: 'tous', ouverts: {} };

function pvEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function pvNomClient(id, repli) {
  const c = id ? (allClients || []).find(x => x.id === id) : null;
  if (!c) return repli || '—';
  return typeof estEntreprise === 'function' && estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim();
}

function pvCalculer() {
  const auj = new Date();
  const aujIso = _prevIso(auj);
  const mois = [];
  for (let i = 0; i < 12; i++) mois.push(_prevIso(new Date(auj.getFullYear(), auj.getMonth() + i, 1)).slice(0, 7));
  const fin = _prevIso(new Date(auj.getFullYear(), auj.getMonth() + 12, 0));
  const delaiAcq = typeof trDelaiMoyenAcquisition === 'function' ? trDelaiMoyenAcquisition() : 60;
  const items = [];
  allCommissionsAttente.filter(ca => ca.statut === 'en_attente').forEach(ca => {
    const ct = ca.contrat_id ? allContrats.find(x => x.id === ca.contrat_id) : null;
    if (ct && (ct.commissionne === false || ct.statut === 'annulé')) return;
    const reste = typeof commissionResteAttendu === 'function' ? commissionResteAttendu(ca) : Number(ca.montant_estime || 0);
    if (!reste) return;
    const gestion = ca.nature === 'gestion';
    let date = commissionDatePrevue(ca);
    if (!date) { const b = new Date(((ca.date_creation || aujIso).slice(0, 10)) + 'T00:00:00'); b.setDate(b.getDate() + delaiAcq); date = _prevIso(b); }
    const parts = gestion ? commissionEcheancier(ca, reste) : [{ date, montant: reste }];
    parts.forEach(pt => {
      if (pt.date > fin) return;
      items.push({ date: pt.date, montant: pt.montant, ca, ct, client_id: ca.client_id, client: ca.client_nom || pvNomClient(ca.client_id),
        compagnie: ca.compagnie || (ct && ct.compagnie), produit: ca.produit || (ct && ct.produit), police: ct && ct.numero_police,
        nature: gestion ? 'gestion' : 'acquisition', type: 'attendu', oz: commissionGestionEncaisseeParOZ(ca, pt.date), retard: pt.date < aujIso });
    });
  });
  if (typeof projectionGestionRecurrente === 'function') {
    projectionGestionRecurrente(fin).forEach(p => {
      const ct = p.contrat;
      items.push({ date: p.date, montant: p.montant, ct, client_id: ct.client_id, client: pvNomClient(ct.client_id), compagnie: ct.compagnie, produit: ct.produit,
        police: ct.numero_police, nature: 'gestion', type: 'projection', oz: false, retard: false, taux: p.taux });
    });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || b.montant - a.montant);
  return { mois, items, delaiAcq };
}

function htmlPrevisions12Mois() {
  const P = pvCalculer();
  const f = window._pv.filtre;
  const garde = it => f === 'tous' || (f === 'assurex' && !it.oz) || (f === 'oz' && it.oz) || (f === 'gestion' && it.nature === 'gestion') || (f === 'acquisition' && it.nature === 'acquisition');
  const vis = P.items.filter(garde);
  window._pvExport = vis;
  const retard = vis.filter(i => i.retard);
  const parMois = P.mois.map(m => {
    const l = vis.filter(i => !i.retard && i.date.slice(0, 7) === m);
    return { m, l, a: l.filter(i => !i.oz && i.type === 'attendu').reduce((s, i) => s + i.montant, 0), p: l.filter(i => i.type === 'projection').reduce((s, i) => s + i.montant, 0), o: l.filter(i => i.oz).reduce((s, i) => s + i.montant, 0) };
  });
  const total = vis.filter(i => !i.oz).reduce((s, i) => s + i.montant, 0);
  const totalOZ = vis.filter(i => i.oz).reduce((s, i) => s + i.montant, 0);
  const max = Math.max(1, ...parMois.map(x => x.a + x.p + x.o));
  const lib = m => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 1).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' }); };
  const court = m => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 1).toLocaleDateString('fr-CH', { month: 'short' }).replace('.', ''); };
  const ligne = i => `<div class="pv-ligne ${i.oz ? 'oz' : ''} ${i.type}">
      <span class="pv-date">${fmtDate(i.date)}</span>
      <span class="pv-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(i.compagnie, 26) : ''}</span>
      <span class="pv-corps"><b ${i.client_id ? `onclick="showClient('${i.client_id}')" class="pv-lien"` : ''}>${pvEsc(i.client)}</b>
        <small>${pvEsc(i.compagnie || '')} · ${pvEsc(i.produit || '')}${i.police ? ` · police ${pvEsc(i.police)}` : ''}</small></span>
      <span class="pv-tags"><em class="pv-tag ${i.nature}">${i.nature === 'gestion' ? 'Gestion' : 'Acquisition'}</em>${i.type === 'projection' ? '<em class="pv-tag proj">Projection</em>' : ''}${i.oz ? '<em class="pv-tag ozt">Encaissé par OZ</em>' : ''}</span>
      <span class="pv-montant">CHF ${fmtCHF2(i.montant)}</span>
    </div>`;
  const filtres = [['tous', 'Tout'], ['assurex', 'Assurex'], ['oz', 'Encaissé par OZ'], ['gestion', 'Gestion'], ['acquisition', 'Acquisition']];
  return `
    <div class="sfx-intro">Chaque commission attendue sur les 12 prochains mois : <strong>quel client</strong>, <strong>quel contrat</strong>, <strong>quel mois</strong>. Gestion : délai réel de chaque compagnie et primes fractionnées ; acquisition : délai moyen observé (${P.delaiAcq} j) ; « projection » = gestion des années suivantes (prime × taux constaté).</div>
    <div class="dbx-kpis">
      ${dbxKpi({ label: '12 prochains mois', valeur: total, prefixe: 'CHF ', sous: `${vis.filter(i => !i.oz).length} versements attendus`, i: 0 })}
      ${dbxKpi({ label: 'Dont en retard', valeur: retard.filter(i => !i.oz).reduce((s, i) => s + i.montant, 0), prefixe: 'CHF ', sous: `${retard.length} à relancer`, i: 1 })}
      ${dbxKpi({ label: 'Moyenne mensuelle', valeur: total / 12, prefixe: 'CHF ', sous: 'Assurex, attendu + projection', i: 2 })}
      ${dbxKpi({ label: 'Encaissé par OZ', valeur: totalOZ, prefixe: 'CHF ', sous: 'gestion OZ jusqu’au 31.12.2026', i: 3 })}
    </div>
    <section class="dbx-carte">
      <header class="dbx-carte-tete"><h2>Mois par mois</h2>
        <span class="dx-tete-actions">${filtres.map(([k, l]) => `<button type="button" class="pv-filtre ${f === k ? 'actif' : ''}" onclick="window._pv.filtre='${k}';ckRerendre()">${l}</button>`).join('')}
          <button type="button" class="btn-secondary" onclick="pvExporterCsv()">⬇ Excel</button></span></header>
      <div class="pv-barres">${parMois.map(x => {
        const t = x.a + x.p + x.o;
        return `<button type="button" class="pv-col" onclick="pvOuvrirMois('${x.m}')" title="${lib(x.m)} : CHF ${fmtCHF(Math.round(t))}">
          <span class="pv-val">${t ? dbxCompact(t) : ''}</span>
          <span class="pv-pile" style="height:${Math.max(t ? 4 : 2, Math.round(t / max * 140))}px">${x.o ? `<i style="flex:${x.o};background:#22C55E"></i>` : ''}${x.p ? `<i style="flex:${x.p};background:#8FB4FF"></i>` : ''}${x.a ? `<i style="flex:${x.a};background:#00CFFF"></i>` : ''}</span>
          <span class="pv-mois">${court(x.m)}</span></button>`;
      }).join('')}</div>
      <div class="pv-legende"><span><i style="background:#00CFFF"></i>Attendu (Assurex)</span><span><i style="background:#8FB4FF"></i>Projection gestion années suivantes</span><span><i style="background:#22C55E"></i>Encaissé par OZ</span></div>
    </section>
    ${retard.length ? `<details class="dbx-carte pv-mois-bloc retard" open><summary><b>⚠ En retard — à relancer</b><em>${retard.length} · CHF ${fmtCHF(Math.round(retard.reduce((s, i) => s + i.montant, 0)))}</em></summary><div class="pv-liste">${retard.map(ligne).join('')}</div></details>` : ''}
    ${parMois.map(x => `<details class="dbx-carte pv-mois-bloc" id="pv-${x.m}" ${window._pv.ouverts[x.m] ? 'open' : ''} ontoggle="window._pv.ouverts['${x.m}']=this.open">
      <summary><b style="text-transform:capitalize">${lib(x.m)}</b><em>${x.l.length} versement${x.l.length > 1 ? 's' : ''} · CHF ${fmtCHF(Math.round(x.a + x.p + x.o))}</em></summary>
      <div class="pv-liste">${x.l.length ? x.l.map(ligne).join('') : '<div class="dbx-vide-petit">Aucun versement prévu.</div>'}</div>
    </details>`).join('')}`;
}

function pvOuvrirMois(m) {
  window._pv.ouverts[m] = true;
  const el = document.getElementById('pv-' + m);
  if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

function pvExporterCsv() {
  const rows = window._pvExport || [];
  if (!rows.length) { showError('Rien à exporter.'); return; }
  const e = v => { const s = String(v == null ? '' : v).replace(/"/g, '""'); return /[;"\n]/.test(s) ? `"${s}"` : s; };
  const lignes = rows.map(i => [i.date, i.client, i.compagnie, i.produit, i.police || '', i.nature, i.type === 'projection' ? 'projection' : (i.retard ? 'en retard' : 'attendu'), i.oz ? 'OZ' : 'Assurex', i.montant.toFixed(2)].map(e).join(';'));
  const csv = '﻿' + ['Date prévue', 'Client', 'Compagnie', 'Produit', 'Police', 'Nature', 'Statut', 'Encaissé par', 'Montant CHF'].join(';') + '\n' + lignes.join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = `previsions-commissions-12-mois_${_prevIso(new Date())}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
