// ═══ PIPELINE : LA BOÎTE AUX LETTRES (22.09.2026) ═══════════════════════════════════════════════
// « Ajoute un bouton boîte aux lettres sur la vue des opportunités, qui permet de savoir si du
// courrier et des offres sont arrivés, pour quel client. »
//
// Pour chaque affaire en cours (ni gagnée ni perdue), une recherche Outlook sur le nom du client :
//   · ✉️ courrier — les e-mails reçus ces 14 derniers jours qui parlent du client (hors les tiens) ;
//   · 📄 offres   — parmi les e-mails des 30 derniers jours, les PDF qui ressemblent à une offre et
//                   qui ne sont pas encore joints à l'opportunité.
// Le bouton s'éclaire avec le nombre de clients concernés ; la liste dit qui, quoi, depuis quand,
// et ouvre l'opportunité ou ses offres (js/126 : « Reçue ✓ » en un clic).
// La recherche se fait une fois par session à l'ouverture du pipeline (sans fenêtre, si Outlook est
// déjà connecté), puis à la demande. Rien n'est écrit : c'est une lecture de la boîte.

const BAL_MOTS_OFFRE = typeof OXO_MOTS_OFFRE !== 'undefined' ? OXO_MOTS_OFFRE : /offre|offerte|proposition|devis|angebot|cotation|tarif/i;
window._bal = window._bal || { t: 0, res: null, enCours: false, fait: 0, total: 0 };

function balEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function balOppsOuvertes() { return (allOpportunites || []).filter(o => !['Gagné', 'Perdu'].includes(o.stade)); }
function balMoi() {
  try { const a = msalInstance && msalInstance.getAllAccounts && msalInstance.getAllAccounts()[0]; return String((a && a.username) || '').toLowerCase(); } catch (e) { return ''; }
}

async function balScanner() {
  if (_bal.enCours) return _bal.res;
  if (typeof tryRestoreOutlookSession !== 'function' || !(await tryRestoreOutlookSession())) return null;
  _bal.enCours = true;
  const opps = balOppsOuvertes(); _bal.total = opps.length; _bal.fait = 0; balMajProgression();
  const moi = balMoi(), maintenant = Date.now(), res = [];
  try {
    for (const o of opps) {
      const nom = typeof oxoNomClient === 'function' ? oxoNomClient(o) : (o.prospect_nom || '');
      const mots = typeof oxoMotsClient === 'function' ? oxoMotsClient(nom) : [];
      if (mots.length) {
        const j = await oxoGraph(`https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(mots.join(' '))}"&$top=30&$select=id,subject,from,receivedDateTime,hasAttachments`).catch(() => null);
        const msgs = ((j && j.value) || []).filter(m => String((m.from && m.from.emailAddress && m.from.emailAddress.address) || '').toLowerCase() !== moi);
        const age = m => (maintenant - new Date(m.receivedDateTime).getTime()) / 864e5;
        const courrier = msgs.filter(m => age(m) <= 14);
        const joints = new Set((typeof oxoEntrees === 'function' ? oxoEntrees(o.id) : []).map(x => x.e && x.e.offre_nom).filter(Boolean));
        const offres = [];
        for (const m of msgs.filter(m => m.hasAttachments && age(m) <= 30).slice(0, 8)) {
          const ja = await oxoGraph(`https://graph.microsoft.com/v1.0/me/messages/${m.id}/attachments?$select=name,contentType`).catch(() => null);
          ((ja && ja.value) || []).filter(a => /\.pdf$/i.test(a.name || '') && !joints.has(a.name) && BAL_MOTS_OFFRE.test(`${a.name} ${m.subject || ''}`))
            .forEach(a => offres.push({ nom: a.name, date: m.receivedDateTime, de: (m.from && m.from.emailAddress && (m.from.emailAddress.name || m.from.emailAddress.address)) || '' }));
        }
        if (courrier.length || offres.length) {
          const derniere = [...courrier.map(m => m.receivedDateTime), ...offres.map(x => x.date)].sort().pop();
          res.push({ oppId: o.id, nom, titre: o.titre || '', stade: o.stade || '', courrier: courrier.length, offres,
            dernierSujet: (courrier[0] && courrier[0].subject) || '', derniere });
        }
      }
      _bal.fait++; balMajProgression();
    }
    res.sort((a, b) => (b.offres.length - a.offres.length) || String(b.derniere).localeCompare(String(a.derniere)));
    _bal.res = res; _bal.t = Date.now();
  } finally { _bal.enCours = false; balMajBouton(); }
  return res;
}

function balMajProgression() {
  const z = document.getElementById('bal-progression');
  if (z) z.innerHTML = `<div class="bal-barre"><i style="width:${_bal.total ? Math.round(_bal.fait / _bal.total * 100) : 0}%"></i></div><small>${_bal.fait} / ${_bal.total} affaires parcourues…</small>`;
  const b = document.getElementById('bal-bouton');
  if (b && _bal.enCours) b.querySelector('.bal-compte').textContent = '…';
}

function balMajBouton() {
  const b = document.getElementById('bal-bouton');
  if (!b) return;
  const n = (_bal.res || []).length, nOffres = (_bal.res || []).filter(r => r.offres.length).length;
  b.classList.toggle('bal-nouveau', n > 0);
  b.classList.toggle('bal-offre', nOffres > 0);
  b.querySelector('.bal-compte').textContent = _bal.res ? String(n) : '';
  b.title = _bal.res ? (n ? `${n} client(s) avec du courrier ou des offres (${nOffres} avec offre)` : 'Rien de nouveau dans Outlook pour les affaires en cours') : 'Courrier et offres arrivés pour les clients des affaires en cours';
}

async function balOuvrir(forcer) {
  creerModale('modal-bal', `<div class="opx-modale bal" role="dialog" aria-labelledby="bal-titre">
    <h3 id="bal-titre">📬 Boîte aux lettres — affaires en cours</h3>
    <p class="bal-sous">Courrier reçu ces 14 derniers jours et offres PDF des 30 derniers jours pas encore jointes, client par client.</p>
    <div id="bal-progression"></div><div id="bal-liste"></div>
    <div class="opx-modale-actions"><button type="button" class="btn-secondary" onclick="balOuvrir(true)">↻ Relever</button>
      <button type="button" class="btn-secondary" onclick="document.getElementById('modal-bal').remove()">Fermer</button></div>
  </div>`);
  let res = _bal.res;
  if (forcer || !res || Date.now() - _bal.t > 10 * 60 * 1000) res = await balScanner();
  const prog = document.getElementById('bal-progression'); if (prog) prog.innerHTML = '';
  const z = document.getElementById('bal-liste'); if (!z) return;
  if (res === null) { z.innerHTML = `<div class="dbx-vide-petit">Outlook n’est pas connecté. <button type="button" class="btn-secondary" onclick="loginMicrosoft().then(()=>balOuvrir(true))">Connecter Outlook</button></div>`; return; }
  if (!res.length) { z.innerHTML = '<div class="dbx-vide-petit">Rien de nouveau : aucun courrier ni offre récente pour les clients des affaires en cours.</div>'; return; }
  z.innerHTML = `<div class="bal-liste">${res.map(r => `
    <div class="bal-ligne ${r.offres.length ? 'offre' : ''}">
      <div class="bal-qui"><b>${balEsc(r.nom || '—')}</b><small>${balEsc(r.titre)}${r.stade ? ' · ' + balEsc(r.stade) : ''}</small></div>
      <div class="bal-quoi">
        ${r.offres.length ? `<span class="bal-pastille offre" title="${balEsc(r.offres.map(x => x.nom + ' — ' + x.de).join('\n'))}">📄 ${r.offres.length} offre${r.offres.length > 1 ? 's' : ''}</span>` : ''}
        ${r.courrier ? `<span class="bal-pastille courrier" title="${balEsc(r.dernierSujet)}">✉️ ${r.courrier} e-mail${r.courrier > 1 ? 's' : ''}</span>` : ''}
        <small>dernier : ${fmtDate(r.derniere)}</small>
      </div>
      <div class="bal-actions">
        ${r.offres.length ? `<button type="button" class="btn-save" onclick="document.getElementById('modal-bal').remove();oxoOuvrir('${r.oppId}',true)">Voir les offres</button>` : ''}
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-bal').remove();editerOpportunite('${r.oppId}')">Ouvrir l’affaire</button>
      </div>
    </div>`).join('')}</div>`;
}

(function balBrancher() {
  if (typeof viewOpportunites !== 'function') return;
  const origine = viewOpportunites;
  window.viewOpportunites = function () {
    const h = origine.apply(this, arguments);
    // Première ouverture de la session : relevé discret en arrière-plan (sans fenêtre de connexion).
    if (!_bal.res && !_bal.enCours && !_bal.lance) { _bal.lance = true; setTimeout(() => balScanner().catch(() => {}), 1200); }
    setTimeout(balMajBouton, 0);
    return h.replace('<div class="pln-actions">', `<div class="pln-actions"><button type="button" id="bal-bouton" class="btn-secondary bal-bouton" onclick="balOuvrir()">📬 Boîte aux lettres <span class="bal-compte"></span></button>`);
  };
  const st = document.createElement('style');
  st.textContent = `
    .bal-bouton { display: inline-flex; align-items: center; gap: 6px; }
    .bal-compte:empty { display: none; }
    .bal-compte { min-width: 20px; padding: 0 6px; border-radius: 999px; background: var(--surface-alt); font-size: var(--t-xs); font-weight: 600; text-align: center; }
    .bal-bouton.bal-nouveau { border-color: #F97316 !important; background: color-mix(in srgb, #F97316 14%, var(--surface)) !important; box-shadow: 0 0 0 1px #F97316; animation: balPouls 2.4s ease-in-out infinite; }
    .bal-bouton.bal-nouveau .bal-compte { background: #F97316; color: #fff; }
    .bal-bouton.bal-offre { border-color: #16A34A !important; background: color-mix(in srgb, #16A34A 14%, var(--surface)) !important; box-shadow: 0 0 0 1px #16A34A; }
    .bal-bouton.bal-offre .bal-compte { background: #16A34A; }
    @keyframes balPouls { 50% { box-shadow: 0 0 0 1px currentColor, 0 0 14px color-mix(in srgb, #F97316 45%, transparent); } }
    .bal { width: min(760px, 94vw); }
    .bal-sous { margin: 0 0 10px; font-size: var(--t-s); color: var(--text-muted); }
    .bal-barre { height: 6px; border-radius: 999px; background: var(--surface-alt); overflow: hidden; margin-bottom: 4px; }
    .bal-barre i { display: block; height: 100%; background: var(--accent); transition: width .2s; }
    #bal-progression small { font-size: var(--t-xs); color: var(--text-muted); }
    .bal-liste { display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow: auto; }
    .bal-ligne { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(0, auto) auto; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
    .bal-ligne.offre { border-color: color-mix(in srgb, #16A34A 45%, var(--border)); background: color-mix(in srgb, #16A34A 6%, var(--surface)); }
    .bal-qui { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .bal-qui b { font-size: var(--t-m); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bal-qui small, .bal-quoi small { font-size: var(--t-xs); color: var(--text-muted); }
    .bal-quoi { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end; }
    .bal-pastille { padding: 2px 9px; border-radius: 999px; font-size: var(--t-xs); font-weight: 600; white-space: nowrap; }
    .bal-pastille.offre { background: color-mix(in srgb, #16A34A 16%, transparent); color: #16A34A; }
    .bal-pastille.courrier { background: color-mix(in srgb, #F97316 16%, transparent); color: #C2410C; }
    html:not([data-theme="clair"]) .bal-pastille.courrier { color: #FDBA74; }
    html:not([data-theme="clair"]) .bal-pastille.offre { color: #4ADE80; }
    .bal-actions { display: flex; gap: 6px; }
    .bal-actions button { padding: 6px 11px; font-size: var(--t-s); white-space: nowrap; }
    @media (max-width: 680px) { .bal-ligne { grid-template-columns: 1fr; } .bal-quoi { justify-content: flex-start; } }
    @media (prefers-reduced-motion: reduce) { .bal-bouton.bal-nouveau { animation: none; } }`;
  document.head.appendChild(st);
})();
