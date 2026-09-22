// ═══ OPPORTUNITÉ : LES OFFRES DÉTECTÉES DANS OUTLOOK (22.09.2026) ═══════════════════════════════
// « Ajoute une fonction chercher l'offre sur l'opportunité dans Outlook : si elle existe, ça met
// dans note et documents client l'offre. » Puis : « Détecter les offres. Pas besoin d'entrer dans
// le détail si la visualisation permet tout juste de saisir que l'offre est reçue. »
//
// À l'ouverture d'une opportunité, le CRM regarde seul dans la boîte Outlook (Mail.Read, js/03 ;
// session renouvelée sans fenêtre) les e-mails des 6 derniers mois qui parlent du client et
// portent un PDF. S'il en trouve, un bandeau l'annonce : « 📬 2 offres détectées dans Outlook ».
// La liste montre chaque PDF (on peut l'ouvrir d'un clic) et UN bouton : « Reçue ✓ ».
//   · la compagnie est devinée (expéditeur, objet, nom du fichier) — on la corrige d'un mot ;
//   · l'offre est marquée reçue et le PDF archivé sur elle, sans formulaire : prime, franchise et
//     couverture se complètent plus tard si besoin (✎ sur la ligne de l'offre) ;
//   · une NOTE est posée dans le journal du client et l'offre rejoint ses DOCUMENTS (même
//     fichier, pas de doublon dans le stockage).
// Rien n'est écrit sans ce clic. Pas d'Outlook connecté : rien ne s'affiche, rien ne s'ouvre.

const OXO_MOTS_OFFRE = /offre|offerte|proposition|devis|angebot|cotation|tarif|projet de (police|contrat)/i;
const OXO_CACHE_MS = 10 * 60 * 1000;
window._oxo = window._oxo || { parOpp: {}, oppId: null };

function oxoEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function oxoNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function oxoCle(c) { return oxoNorm(c).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).find(m => m.length >= 3) || ''; }

function oxoNomClient(o) {
  const c = o && o.client_id ? (allClients || []).find(x => x.id === o.client_id) : null;
  if (c) return typeof estEntreprise === 'function' && estEntreprise(c) ? (c.nom || '') : `${c.prenom || ''} ${c.nom || ''}`.trim();
  return (o && o.prospect_nom) || '';
}
function oxoMotsClient(nom) {
  return oxoNorm(nom).replace(/[^a-z0-9 ]+/g, ' ').split(' ')
    .filter(m => m.length >= 3 && !['sarl', 'sagl', 'gmbh', 'les', 'des', 'and', 'the'].includes(m)).slice(0, 3);
}
function oxoEntrees(oppId) { return typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : []; }

async function oxoGraph(url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${msalAccessToken}` } });
  if (r.status === 401) throw new Error('session Outlook expirée — reconnecte-toi puis réessaie');
  if (!r.ok) throw new Error('Outlook ' + r.status);
  return r.json();
}

// La compagnie d'un PDF : d'abord celles de l'opportunité, puis toutes celles que le CRM connaît.
function oxoDevinerCompagnie(texte, de, dejaSurOpp) {
  const t = oxoNorm(`${texte} ${de.address || ''} ${de.name || ''}`);
  const connues = typeof getCompagniesConnues === 'function' ? getCompagniesConnues() : [];
  for (const liste of [dejaSurOpp, connues]) {
    const c = liste.find(x => { const k = oxoCle(x); return k && t.includes(k); });
    if (c) return c;
  }
  return '';
}

// Recherche (silencieuse) : renvoie les PDF candidats, offres probables d'abord.
async function oxoDetecter(oppId, forcer) {
  const cache = window._oxo.parOpp[oppId];
  if (!forcer && cache && Date.now() - cache.t < OXO_CACHE_MS) return cache.pieces;
  const o = (allOpportunites || []).find(x => x.id === oppId);
  if (!o || typeof tryRestoreOutlookSession !== 'function' || !(await tryRestoreOutlookSession())) return null;
  const mots = oxoMotsClient(oxoNomClient(o));
  if (!mots.length) return [];
  const entrees = oxoEntrees(oppId);
  const compagnies = [...new Set(entrees.map(x => x.e && x.e.compagnie).filter(Boolean))];
  const dejaJoints = new Set(entrees.map(x => x.e && x.e.offre_nom).filter(Boolean));
  const requetes = [mots.join(' '), ...compagnies.slice(0, 5).map(c => `${mots[0]} ${oxoCle(c)}`)];
  const vus = new Map();
  for (const q of requetes) {
    const j = await oxoGraph(`https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(q)}"&$top=40&$select=id,subject,from,receivedDateTime,hasAttachments`);
    (j.value || []).forEach(m => { if (m.hasAttachments && !vus.has(m.id)) vus.set(m.id, m); });
  }
  const limite = Date.now() - 183 * 864e5;
  const msgs = [...vus.values()].filter(m => new Date(m.receivedDateTime).getTime() >= limite)
    .sort((a, b) => String(b.receivedDateTime).localeCompare(String(a.receivedDateTime))).slice(0, 30);
  const pieces = [];
  for (const m of msgs) {
    const j = await oxoGraph(`https://graph.microsoft.com/v1.0/me/messages/${m.id}/attachments?$select=id,name,contentType,size`).catch(() => null);
    ((j && j.value) || []).filter(a => /\.pdf$/i.test(a.name || '') || /pdf/i.test(a.contentType || '')).forEach(a => {
      if (dejaJoints.has(a.name)) return;                     // déjà rattaché à une offre de l'opportunité
      const de = (m.from && m.from.emailAddress) || {};
      const texte = `${a.name} ${m.subject || ''}`;
      pieces.push({ mid: m.id, aid: a.id, nom: a.name, taille: a.size, sujet: m.subject || '', de: de.name || de.address || '', date: m.receivedDateTime,
        offre: OXO_MOTS_OFFRE.test(texte), compagnie: oxoDevinerCompagnie(texte, de, compagnies) });
    });
  }
  pieces.sort((a, b) => (b.offre - a.offre) || (!!b.compagnie - !!a.compagnie) || String(b.date).localeCompare(String(a.date)));
  window._oxo.parOpp[oppId] = { t: Date.now(), pieces };
  return pieces;
}

// ── Le bandeau « offres détectées » dans la fiche opportunité ─────────────────────────────────────
async function oxoRemplirBandeau(el) {
  const oppId = el.getAttribute('data-oxo-opp');
  el.setAttribute('data-rempli', '');
  let pieces = null;
  try { pieces = await oxoDetecter(oppId); } catch (e) { pieces = null; }
  if (!document.body.contains(el)) return;
  const offres = (pieces || []).filter(p => p.offre && !p.fait);
  if (!pieces || !offres.length) { el.remove(); return; }
  el.innerHTML = `<button type="button" class="oxo-bandeau" onclick="oxoOuvrir('${oppId}')">
    <span class="oxo-bandeau-ico" aria-hidden="true">📬</span>
    <span><b>${offres.length} offre${offres.length > 1 ? 's' : ''} détectée${offres.length > 1 ? 's' : ''} dans Outlook</b>
      <small>${offres.slice(0, 3).map(p => oxoEsc(p.compagnie || p.de)).join(' · ')} — un clic pour la marquer reçue</small></span>
    <span class="oxo-bandeau-go">Voir →</span></button>`;
}

// ── La liste ────────────────────────────────────────────────────────────────────────────────────
async function oxoOuvrir(oppId, forcer) {
  window._oxo.oppId = oppId;
  const o = (allOpportunites || []).find(x => x.id === oppId);
  creerModale('modal-oxo', `<div class="opx-modale oxo" role="dialog" aria-labelledby="oxo-titre">
    <h3 id="oxo-titre">📬 Offres dans Outlook — ${oxoEsc(oxoNomClient(o) || '')}</h3>
    <div id="oxo-liste"><div class="loader">Recherche dans la boîte…</div></div>
    <div class="opx-modale-actions"><button type="button" class="btn-secondary" onclick="oxoOuvrir('${oppId}',true)">↻ Relancer la recherche</button>
      <button type="button" class="btn-secondary" onclick="document.getElementById('modal-oxo').remove()">Fermer</button></div>
  </div>`);
  let pieces;
  try { pieces = await oxoDetecter(oppId, forcer); }
  catch (e) { const z = document.getElementById('oxo-liste'); if (z) z.innerHTML = `<div class="dbx-vide-petit">Recherche impossible : ${oxoEsc(e.message)}</div>`; return; }
  if (pieces === null) {
    const z = document.getElementById('oxo-liste');
    if (z) z.innerHTML = `<div class="dbx-vide-petit">Outlook n’est pas connecté. <button type="button" class="btn-secondary" onclick="loginMicrosoft().then(()=>oxoOuvrir('${oppId}',true))">Connecter Outlook</button></div>`;
    return;
  }
  oxoRendre();
}
// Ancien nom (bouton de la version précédente) : même action.
function oxoChercher(oppId) { return oxoOuvrir(oppId, true); }

function oxoRendre() {
  const zone = document.getElementById('oxo-liste');
  const oppId = window._oxo.oppId;
  const pieces = (window._oxo.parOpp[oppId] || {}).pieces || [];
  if (!zone) return;
  if (!pieces.length) { zone.innerHTML = '<div class="dbx-vide-petit">Aucun PDF trouvé dans les e-mails des six derniers mois qui parlent de ce client.</div>'; return; }
  const connues = typeof getCompagniesConnues === 'function' ? getCompagniesConnues() : [];
  zone.innerHTML = `<datalist id="oxo-cies">${connues.map(c => `<option value="${oxoEsc(c)}">`).join('')}</datalist>
    <div class="oxo-liste">${pieces.map((p, i) => `
    <div class="oxo-piece ${p.offre ? 'probable' : ''} ${p.fait ? 'fait' : ''}">
      <button type="button" class="oxo-voir" onclick="oxoVoir(${i})" title="Regarder l’offre avant de la valider">${typeof BAL_JUMELLES !== 'undefined' ? BAL_JUMELLES : '📄'}</button>
      <div class="oxo-corps"><b>${oxoEsc(p.nom)}</b>
        <small>${fmtDate(p.date)} · ${oxoEsc(p.de)}${p.sujet ? ' · ' + oxoEsc(p.sujet) : ''}</small></div>
      ${p.fait ? `<span class="oxo-ok">✓ Reçue — ${oxoEsc(p.compagnie)}</span>` : `<div class="oxo-actions">
        <input id="oxo-cie-${i}" list="oxo-cies" value="${oxoEsc(p.compagnie)}" placeholder="Compagnie" aria-label="Compagnie de l’offre"/>
        <button type="button" class="btn-save" onclick="oxoRecue(${i})">Reçue ✓</button></div>`}
    </div>`).join('')}</div>`;
}

async function oxoFichier(p) {
  const a = await oxoGraph(`https://graph.microsoft.com/v1.0/me/messages/${p.mid}/attachments/${p.aid}`);
  const bin = atob(a.contentBytes || '');
  const octets = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) octets[k] = bin.charCodeAt(k);
  return new File([octets], p.nom, { type: 'application/pdf' });
}

async function oxoVoir(i) {
  const p = ((window._oxo.parOpp[window._oxo.oppId] || {}).pieces || [])[i];
  if (!p) return;
  try { window.open(URL.createObjectURL(await oxoFichier(p)), '_blank'); }
  catch (e) { showError('PDF inaccessible : ' + e.message); }
}

// Un clic : offre reçue + PDF archivé, sur l'entrée de la compagnie (créée si elle n'existe pas).
async function oxoRecue(i) {
  const oppId = window._oxo.oppId;
  const p = ((window._oxo.parOpp[oppId] || {}).pieces || [])[i];
  const compagnie = (document.getElementById('oxo-cie-' + i)?.value || '').trim();
  if (!p) return;
  if (!compagnie) { showError('Indique la compagnie de cette offre.'); document.getElementById('oxo-cie-' + i)?.focus(); return; }
  const o = (allOpportunites || []).find(x => x.id === oppId);
  let fichier;
  try { fichier = await oxoFichier(p); } catch (e) { showError('PDF inaccessible : ' + e.message); return; }
  if (fichier.size > 10 * 1024 * 1024) { showError('PDF trop lourd (plus de 10 Mo) : joins-le à la main.'); return; }
  showError('⏳ Enregistrement de l’offre…');

  const existante = oxoEntrees(oppId).find(x => oxoCle(x.e && x.e.compagnie) === oxoCle(compagnie) && !x.e.offre_path);
  let demandeId, idx;
  if (existante) {
    demandeId = existante.d.id; idx = existante.idx;
    await opJoindreOffre(oppId, demandeId, idx, { files: [fichier] });   // vaut réception (js/25)
  } else {
    const entree = { compagnie_id: null, compagnie, email: null, envoye_le: null, statut: 'reçue', recue_le: new Date().toISOString() };
    const d = (window._opDemandes && window._opDemandes[oppId] || [])[0] || null;
    let r;
    if (d) { const entrees = [...(d.compagnies_envoi || []), entree]; r = await dbPatch('demandes_offre', d.id, { compagnies_envoi: entrees }); demandeId = d.id; idx = entrees.length - 1; }
    else {
      r = await dbPost('demandes_offre', { opportunite_id: oppId, client_id: o?.client_id || null, prospect_nom: o?.client_id ? null : (o?.prospect_nom || null),
        agent_id: typeof opMonAgentId === 'function' ? opMonAgentId(o) : null, donnees: {}, compagnies_envoi: [entree] });
      demandeId = Array.isArray(r) && r[0] ? r[0].id : (r && r.id) || null; idx = 0;
    }
    if ((r && r.error) || !demandeId) { showError('Offre non enregistrée : ' + (r && r.error ? errMsg(r) : 'demande introuvable')); return; }
    if (!(await uploadOffreCompagnie(demandeId, idx, { files: [fichier] }, '', ''))) return;
    await ajouterLigneHistoriqueOpportunite(oppId, `📥 Offre reçue de ${compagnie} (détectée dans Outlook, PDF joint)`);
    if (o && ['Contact', 'Analyse'].includes(o.stade) && typeof opChangerStade === 'function') await opChangerStade(oppId, 'Proposition');
  }
  const rows = await dbGet('demandes_offre', `id=eq.${demandeId}&select=compagnies_envoi`).catch(() => []);
  const e = Array.isArray(rows) && rows[0] ? (rows[0].compagnies_envoi || [])[idx] : null;
  if (e && e.offre_path) await oxoNoteEtDocument(o, compagnie, e.offre_path, p);
  p.fait = true; p.compagnie = compagnie;
  if (typeof opChargerDemandes === 'function') await opChargerDemandes(oppId);
  if (typeof opRafraichir === 'function') opRafraichir();
  oxoRendre();
  showError(`✓ Offre ${compagnie} reçue — jointe, notée et classée dans les documents du client.`);
}

// La note dans le journal du client et la ligne dans ses documents (même fichier que l'offre).
async function oxoNoteEtDocument(o, compagnie, chemin, p) {
  if (!o || !o.client_id) return;   // prospect sans fiche : l'offre reste sur l'opportunité
  const auteur = typeof currentUser !== 'undefined' && currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : null;
  await dbPost('activites_client', { client_id: o.client_id, type: 'note', auteur,
    contenu: `📬 Offre ${compagnie || ''} reçue (détectée dans Outlook) pour l’opportunité « ${o.titre || ''} » — ${p.nom}, e-mail du ${fmtDate(p.date)}${p.sujet ? ' : ' + p.sujet : ''}` }).catch(() => {});
  await dbPost('documents_compagnies', { client_id: o.client_id, compagnie: compagnie || null, type: 'offre',
    titre: `Offre ${compagnie || ''} — ${p.nom.replace(/\.pdf$/i, '')}`.trim(), chemin, nom_fichier: p.nom,
    source: 'outlook', visible_client: false, depose_par: auteur }).catch(() => {});
  if (typeof logAction === 'function') logAction('offre_outlook', 'opportunites', o.id, `${compagnie} — ${p.nom}`);
}

(function oxoBrancher() {
  // Le bouton (recherche à la demande) et la place du bandeau de détection, dans les offres.
  if (typeof htmlOffresOpportunite === 'function') {
    const rendu = htmlOffresOpportunite;
    window.htmlOffresOpportunite = function (oppId) {
      return `<div class="oxo-detect" data-oxo-opp="${oppId}"></div>` + rendu.apply(this, arguments).replace('<div class="opx-offres-actions">',
        `<div class="opx-offres-actions"><button type="button" class="btn-secondary" onclick="oxoOuvrir('${oppId}',true)" title="Chercher dans ta boîte Outlook le PDF de l’offre">📬 Offres dans Outlook</button>`);
    };
  }
  const remplir = () => document.querySelectorAll('.oxo-detect[data-oxo-opp]:not([data-rempli])').forEach(oxoRemplirBandeau);
  const go = () => new MutationObserver(remplir).observe(document.body, { childList: true, subtree: true });
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);

  const st = document.createElement('style');
  st.textContent = `
    .oxo-detect:empty { display: none; }
    .oxo-bandeau { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0 0 12px; padding: 10px 14px; cursor: pointer; text-align: left;
      border: 1px solid color-mix(in srgb, #16A34A 45%, var(--border)); border-radius: 12px; font: inherit; color: var(--text);
      background: color-mix(in srgb, #16A34A 10%, var(--surface)); box-shadow: 0 0 0 1px color-mix(in srgb, #16A34A 25%, transparent); animation: oxoPouls 2.4s ease-in-out infinite; }
    .oxo-bandeau:hover { background: color-mix(in srgb, #16A34A 16%, var(--surface)); }
    .oxo-bandeau-ico { font-size: 22px; }
    .oxo-bandeau span:nth-child(2) { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .oxo-bandeau b { font-size: var(--t-m); } .oxo-bandeau small { font-size: var(--t-xs); color: var(--text-muted); }
    .oxo-bandeau-go { font-weight: 600; color: #16A34A; white-space: nowrap; }
    @keyframes oxoPouls { 50% { box-shadow: 0 0 0 1px #16A34A, 0 0 16px color-mix(in srgb, #16A34A 35%, transparent); } }
    .oxo { width: min(720px, 94vw); }
    .oxo-liste { display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow: auto; }
    .oxo-piece { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); }
    .oxo-piece.probable { border-color: color-mix(in srgb, #16A34A 45%, var(--border)); }
    .oxo-piece.fait { opacity: .7; }
    .oxo-voir { border: 1px solid var(--border); background: var(--surface-alt); border-radius: 9px; font-size: 18px; padding: 4px 8px; cursor: pointer; }
    .oxo-corps { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .oxo-corps b { font-size: var(--t-s); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .oxo-corps small { font-size: var(--t-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .oxo-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
    .oxo-actions input { width: 140px; background: var(--surface-alt); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; font: inherit; font-size: var(--t-s); }
    .oxo-actions .btn-save { padding: 6px 12px; font-size: var(--t-s); }
    .oxo-ok { font-size: var(--t-s); font-weight: 600; color: #16A34A; white-space: nowrap; }
    @media (max-width: 620px) { .oxo-piece { flex-wrap: wrap; } .oxo-actions { width: 100%; } .oxo-actions input { flex: 1; } }
    @media (prefers-reduced-motion: reduce) { .oxo-bandeau { animation: none; } }`;
  document.head.appendChild(st);
})();
