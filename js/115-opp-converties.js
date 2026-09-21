// ═══ OPPORTUNITÉS CONVERTIES : CE QUE CHAQUE AFFAIRE A RAPPORTÉ (21.09.2026) ═══════════════════
// « Il faudrait un calculateur d'opportunités converties, qui détecte quelle opportunité a généré
// combien de commissions une fois les bordereaux saisis. »
//
// Le pipeline s'arrêtait à « Gagné ». Ce qui compte vient après : la compagnie a-t-elle payé, et
// combien, par rapport à ce qu'on avait estimé ? Les trois maillons existent déjà en base :
//
//   opportunité ──► contrat(s) ──► commissions ──► bordereau (encaissé, daté)
//
// Le second lien est le seul fragile. Une opportunité porte parfois son contrat (contrat_id) ; le
// plus souvent, le contrat a été saisi à part. On le retrouve alors : même client, créé ou signé
// autour de la vente (7 jours avant, 180 jours après), même compagnie quand l'opportunité en nomme
// une. Chaque ligne dit comment le lien a été établi — « direct » ou « déduit » — pour que le
// chiffre ne soit jamais pris pour plus sûr qu'il n'est.
//
// Côté commissions : « encaissé » = reçu sur un bordereau (reçue, versée OZ) ; « attendu » = en
// attente ; les lignes annulées ne comptent pas. Le taux de réalisation compare l'encaissé à la
// commission estimée sur l'opportunité.
//
// Lecture seule : rien n'est écrit en base. RETOUR EN ARRIÈRE : retirer la ligne de index.html.

const OCV_AVANT_J = 7, OCV_APRES_J = 180;
const OCV_ENCAISSE = ['reçue', 'versé_oz', 'recue', 'verse_oz'];
const OCV_ATTENDU = ['en_attente', 'en_attente_naissance'];

window._ocv = window._ocv || { filtre: 'gagnees', tri: 'encaisse', texte: '' };

function ocvEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ocvCHF(n) { return 'CHF ' + (typeof fmtCHF === 'function' ? fmtCHF(Math.round(n || 0)) : Math.round(n || 0)); }
function ocvJour(d) { return d ? String(d).slice(0, 10) : ''; }
function ocvPlusJours(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function ocvCle(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(la|le|les)\s+/, '').replace(/[^a-z0-9]/g, ''); }
function ocvMemeCie(a, b) { const x = ocvCle(a), y = ocvCle(b); return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x)); }

function ocvNomClient(id) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === id);
  if (!c) return '—';
  return (typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim();
}

// ── Le rapprochement ───────────────────────────────────────────────────────────────────────────
function ocvContratsDe(o, dejaPris) {
  const contrats = typeof allContrats !== 'undefined' ? allContrats : [];
  if (o.contrat_id) {
    const ct = contrats.find(x => x.id === o.contrat_id);
    // Le contrat lié, plus les autres contrats de la même vente saisis le même jour chez la même
    // compagnie (une offre voiture = RC + casco + PJ, trois contrats pour une opportunité).
    if (ct) {
      const jour = ocvJour(ct.created_at);
      const freres = contrats.filter(x => x.id !== ct.id && x.client_id === ct.client_id && ocvJour(x.created_at) === jour
        && ocvMemeCie(x.compagnie, ct.compagnie) && !dejaPris.has(x.id));
      return { lien: 'direct', liste: [ct, ...freres] };
    }
  }
  if (!o.client_id) return { lien: 'aucun', liste: [] };
  const debut = ocvPlusJours(ocvJour(o.created_at), -OCV_AVANT_J);
  const fin = ocvPlusJours(ocvJour(o.signee_le || o.created_at), OCV_APRES_J);
  const liste = contrats.filter(ct => {
    if (ct.client_id !== o.client_id || dejaPris.has(ct.id)) return false;
    const d = ocvJour(ct.date_signature || ct.created_at);
    if (!d || d < debut || d > fin) return false;
    if (o.compagnie && ct.compagnie && !ocvMemeCie(o.compagnie, ct.compagnie)) return false;
    return !['annulé'].includes(ct.statut);
  });
  return { lien: liste.length ? 'deduit' : 'aucun', liste };
}

function ocvCalculer() {
  const opps = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).slice()
    // Les liens directs d'abord : un contrat revendiqué par une opportunité ne peut pas être
    // « déduit » pour une autre.
    .sort((a, b) => (b.contrat_id ? 1 : 0) - (a.contrat_id ? 1 : 0) || String(a.created_at).localeCompare(String(b.created_at)));
  const comms = typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : [];
  const bordereaux = typeof allBordereaux !== 'undefined' ? allBordereaux : [];
  const dejaPris = new Set();
  const lignes = [];

  for (const o of opps) {
    const { lien, liste } = o.stade === 'Gagné' ? ocvContratsDe(o, dejaPris) : { lien: 'aucun', liste: [] };
    liste.forEach(ct => dejaPris.add(ct.id));
    const ids = new Set(liste.map(ct => ct.id));
    const lesComms = comms.filter(ca => ids.has(ca.contrat_id) && ca.statut !== 'annulée');
    const signe = ca => (ca.sens === 'debit' || ca.mouvement === 'extourne') ? -1 : 1;
    const montant = ca => Number(ca.montant_final ?? ca.montant_estime ?? 0) * signe(ca);
    const enc = lesComms.filter(ca => OCV_ENCAISSE.includes(ca.statut));
    const att = lesComms.filter(ca => OCV_ATTENDU.includes(ca.statut));
    const encaisse = enc.reduce((s, ca) => s + montant(ca), 0);
    const attendu = att.reduce((s, ca) => s + montant(ca), 0);
    const premier = enc.map(ca => ca.date_reception).filter(Boolean).sort()[0] || null;
    const brds = [...new Set(enc.map(ca => ca.bordereau_id).filter(Boolean))]
      .map(id => bordereaux.find(b => b.id === id)).filter(Boolean);
    const estime = Number(o.commission_estimee || 0);
    const delai = premier && (o.signee_le || o.created_at)
      ? Math.round((new Date(premier) - new Date(ocvJour(o.signee_le || o.created_at))) / 86400000) : null;
    lignes.push({ o, lien, contrats: liste, encaisse, attendu, estime, premier, delai, brds, nbComms: lesComms.length,
      realisation: estime > 0 ? encaisse / estime : null });
  }
  return lignes;
}

// ── L'écran ────────────────────────────────────────────────────────────────────────────────────
function viewOppConverties() {
  const toutes = ocvCalculer();
  const gagnees = toutes.filter(l => l.o.stade === 'Gagné');
  const perdues = toutes.filter(l => l.o.stade === 'Perdu').length;
  const encaisse = gagnees.reduce((s, l) => s + l.encaisse, 0);
  const attendu = gagnees.reduce((s, l) => s + l.attendu, 0);
  const estime = gagnees.reduce((s, l) => s + l.estime, 0);
  const taux = gagnees.length + perdues ? Math.round(gagnees.length / (gagnees.length + perdues) * 100) : 0;
  const delais = gagnees.map(l => l.delai).filter(d => d !== null && d >= 0);
  const delaiMoyen = delais.length ? Math.round(delais.reduce((s, d) => s + d, 0) / delais.length) : null;
  const sansLien = gagnees.filter(l => l.lien === 'aucun').length;

  return `<div class="dbx ocv">
    <h1>Opportunités converties</h1>
    <p class="ocv-intro">Ce que chaque affaire gagnée a réellement rapporté, une fois les bordereaux saisis.</p>

    <div class="ocv-kpis">
      <div class="ocv-kpi"><span>Affaires gagnées</span><b>${gagnees.length}</b><small>taux de conversion ${taux} % (${gagnees.length} gagnées, ${perdues} perdues)</small></div>
      <div class="ocv-kpi ok"><span>Commissions encaissées</span><b>${ocvCHF(encaisse)}</b><small>reçues sur bordereau</small></div>
      <div class="ocv-kpi"><span>Encore attendu</span><b>${ocvCHF(attendu)}</b><small>commissions en attente</small></div>
      <div class="ocv-kpi"><span>Estimé à la vente</span><b>${ocvCHF(estime)}</b><small>${estime ? `réalisé à ${Math.round(encaisse / estime * 100)} %` : 'aucune estimation saisie'}</small></div>
      <div class="ocv-kpi"><span>Délai de paiement</span><b>${delaiMoyen !== null ? delaiMoyen + ' j' : '—'}</b><small>de la signature au 1er encaissement</small></div>
    </div>
    ${sansLien ? `<p class="ocv-alerte">${sansLien} affaire${sansLien > 1 ? 's' : ''} gagnée${sansLien > 1 ? 's' : ''} sans contrat retrouvé : liez le contrat depuis l’opportunité pour que ses commissions soient comptées.</p>` : ''}

    <div class="ocv-outils">
      <input class="form-input" type="search" placeholder="Filtrer par client, titre, compagnie…" value="${ocvEsc(_ocv.texte)}"
        oninput="_ocv.texte=this.value; ocvPeindre()" aria-label="Filtrer"/>
      <select class="form-input" onchange="_ocv.tri=this.value; ocvPeindre()" aria-label="Trier">
        <option value="encaisse" ${_ocv.tri === 'encaisse' ? 'selected' : ''}>Les plus rentables</option>
        <option value="date" ${_ocv.tri === 'date' ? 'selected' : ''}>Les plus récentes</option>
        <option value="ecart" ${_ocv.tri === 'ecart' ? 'selected' : ''}>Écart à l’estimation</option>
      </select>
    </div>
    <div id="ocv-liste">${ocvListeHtml(gagnees)}</div>
  </div>`;
}

function ocvListeHtml(lignes) {
  const q = ocvCle(_ocv.texte);
  let l = lignes.filter(x => !q || ocvCle(`${x.o.titre} ${ocvNomClient(x.o.client_id)} ${x.o.compagnie} ${x.contrats.map(c => c.compagnie + c.produit).join(' ')}`).includes(q));
  if (_ocv.tri === 'encaisse') l.sort((a, b) => b.encaisse - a.encaisse || b.attendu - a.attendu);
  if (_ocv.tri === 'date') l.sort((a, b) => String(b.o.signee_le || b.o.created_at).localeCompare(String(a.o.signee_le || a.o.created_at)));
  if (_ocv.tri === 'ecart') l.sort((a, b) => Math.abs(b.encaisse - b.estime) - Math.abs(a.encaisse - a.estime));
  if (!l.length) return '<div class="dbx-vide-petit">Aucune affaire gagnée ne correspond.</div>';

  return `<div class="ocv-liste">${l.map(x => {
    const r = x.realisation;
    const barre = r !== null ? Math.min(100, Math.round(r * 100)) : null;
    const cies = [...new Set(x.contrats.map(c => c.compagnie).filter(Boolean))];
    return `<article class="ocv-ligne">
      <div class="ocv-tete">
        <button type="button" class="ocv-titre" onclick="editerOpportunite('${x.o.id}')">${ocvEsc(x.o.titre || 'Opportunité')}</button>
        <span class="ocv-lien ${x.lien}" title="${x.lien === 'direct' ? 'Contrat lié à l’opportunité' : x.lien === 'deduit' ? 'Contrat retrouvé : même client, même période' + (x.o.compagnie ? ', même compagnie' : '') : 'Aucun contrat retrouvé'}">${x.lien === 'direct' ? 'lien direct' : x.lien === 'deduit' ? 'lien déduit' : 'sans contrat'}</span>
      </div>
      <div class="ocv-meta">
        <button type="button" class="ocv-client" onclick="showClient('${x.o.client_id}')">${ocvEsc(ocvNomClient(x.o.client_id))}</button>
        <span>gagnée le ${fmtDate(ocvJour(x.o.signee_le || x.o.created_at))}</span>
        ${cies.length ? `<span class="ocv-cies">${cies.map(c => `${typeof pictoCompagnie === 'function' ? pictoCompagnie(c, 16) : ''}${ocvEsc(c)}`).join(' · ')}</span>` : ''}
        <span>${x.contrats.length} contrat${x.contrats.length > 1 ? 's' : ''} · ${x.nbComms} commission${x.nbComms > 1 ? 's' : ''}</span>
      </div>
      <div class="ocv-chiffres">
        <div><small>Encaissé</small><b class="ok">${ocvCHF(x.encaisse)}</b></div>
        <div><small>Attendu</small><b>${ocvCHF(x.attendu)}</b></div>
        <div><small>Estimé</small><b class="doux">${x.estime ? ocvCHF(x.estime) : '—'}</b></div>
        <div><small>1er encaissement</small><b class="doux">${x.premier ? `${fmtDate(x.premier)}${x.delai !== null ? ` · ${x.delai} j` : ''}` : '—'}</b></div>
      </div>
      ${barre !== null ? `<div class="ocv-barre" role="img" aria-label="Réalisé à ${Math.round(r * 100)} % de l’estimation"><i style="width:${barre}%"></i><span>${Math.round(r * 100)} % de l’estimation</span></div>` : ''}
      ${x.brds.length ? `<div class="ocv-brds">${x.brds.map(b => `<span>${ocvEsc(b.numero || 'Bordereau')}${b.date_reception ? ` · ${fmtDate(b.date_reception)}` : ''}</span>`).join('')}</div>` : ''}
    </article>`;
  }).join('')}</div>`;
}

function ocvPeindre() {
  const z = document.getElementById('ocv-liste');
  if (z) z.innerHTML = ocvListeHtml(ocvCalculer().filter(l => l.o.stade === 'Gagné'));
}

// ── Branchements : l'entrée de menu, et la vue ────────────────────────────────────────────────
(function ocvBrancher() {
  if (typeof SECTIONS !== 'undefined') {
    const vente = SECTIONS.find(s => s.id === 'vente');
    if (vente && !vente.sub.some(s => s.id === 'opp-converties')) {
      const i = vente.sub.findIndex(s => s.id === 'suivi');
      vente.sub.splice(i >= 0 ? i + 1 : vente.sub.length, 0, { id: 'opp-converties', icon: '🏆', label: 'Opportunités converties', groupe: 'Affaires' });
    }
  }
  if (typeof NAV_SYNONYMES !== 'undefined') NAV_SYNONYMES['opp-converties'] = 'conversion gagne rentabilite rapporte commission opportunite affaire resultat';

  if (typeof renderView === 'function') {
    const origine = renderView;
    window.renderView = async function () {
      if (typeof currentView !== 'undefined' && currentView === 'opp-converties') {
        const main = document.getElementById('main-content');
        if (main) main.innerHTML = viewOppConverties();
        return;
      }
      return origine.apply(this, arguments);
    };
  }
})();

(function ocvStyles() {
  if (document.getElementById('ocv-styles')) return;
  const s = document.createElement('style');
  s.id = 'ocv-styles';
  s.textContent = `
    .ocv-intro { margin: 0 0 16px; color: var(--text-muted); }
    .ocv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .ocv-kpi { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); }
    .ocv-kpi span { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
    .ocv-kpi b { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .ocv-kpi.ok b { color: var(--c-succes-texte, #047857); }
    .ocv-kpi small { font-size: var(--t-xs); color: var(--text-muted); }
    .ocv-alerte { margin: 0 0 14px; padding: 10px 14px; border-radius: 12px; font-size: var(--t-s);
      background: var(--c-alerte-fond, rgba(245,158,11,.12)); color: var(--c-alerte-texte, #B45309); }
    .ocv-outils { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .ocv-outils input { flex: 1 1 260px; }
    .ocv-outils select { flex: 0 0 auto; width: auto; }
    .ocv-liste { display: flex; flex-direction: column; gap: 10px; }
    .ocv-ligne { padding: 14px 16px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
    .ocv-tete { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .ocv-titre { border: 0; background: none; padding: 0; cursor: pointer; font: inherit; font-size: 15px; font-weight: 600; color: var(--text); text-align: left; }
    .ocv-titre:hover { color: var(--accent); }
    .ocv-lien { flex-shrink: 0; font-size: 11px; padding: 2px 9px; border-radius: 999px; background: var(--surface-alt); color: var(--text-muted); }
    .ocv-lien.direct { background: color-mix(in srgb, #10B981 15%, transparent); color: var(--c-succes-texte, #047857); }
    .ocv-lien.deduit { background: color-mix(in srgb, #0EA5E9 14%, transparent); color: #0369A1; }
    .ocv-lien.aucun { background: color-mix(in srgb, #F59E0B 16%, transparent); color: var(--c-alerte-texte, #B45309); }
    .ocv-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: var(--t-s); color: var(--text-muted); align-items: center; }
    .ocv-client { border: 0; background: none; padding: 0; cursor: pointer; font: inherit; color: var(--accent); }
    .ocv-cies { display: inline-flex; align-items: center; gap: 4px; }
    .ocv-chiffres { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .ocv-chiffres div { display: flex; flex-direction: column; }
    .ocv-chiffres small { font-size: var(--t-xs); color: var(--text-muted); }
    .ocv-chiffres b { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .ocv-chiffres b.ok { color: var(--c-succes-texte, #047857); }
    .ocv-chiffres b.doux { font-weight: 500; color: var(--text-muted); font-size: 13.5px; }
    .ocv-barre { position: relative; height: 18px; border-radius: 999px; background: var(--surface-alt); overflow: hidden; }
    .ocv-barre i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #10B981, #059669); border-radius: 999px; }
    .ocv-barre span { position: relative; display: block; text-align: center; font-size: 11px; line-height: 18px; color: var(--text); font-weight: 500; }
    .ocv-brds { display: flex; flex-wrap: wrap; gap: 6px; }
    .ocv-brds span { font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border); color: var(--text-muted); }
    @media (max-width: 640px) { .ocv-chiffres { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
  document.head.appendChild(s);
})();
