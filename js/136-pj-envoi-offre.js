// ═══ ENVOI DE LA DEMANDE D'OFFRE : CHOISIR LES PIÈCES JOINTES (22.09.2026) ══════════════════════
// « Au moment d'envoyer l'offre, qu'il y ait la possibilité de sélectionner les pièces jointes
// parmi les documents uploadés dans l'opp. »
//
// L'aperçu de l'e-mail (js/07, ouvrirApercuEmailDemandeOffre) reçoit une section « 📎 Pièces
// jointes » : les documents déposés sur l'affaire (opportunites.pieces_jointes), les offres PDF déjà
// jointes et le mandat signé du client, chacun à cocher, plus « + Fichier de l'ordinateur ».
// Rien n'est coché d'office. À l'envoi via Outlook, les fichiers cochés sont téléchargés du
// stockage et ajoutés au message ; le reste de l'envoi (confirmation, statut des compagnies) est
// celui de js/07, inchangé. Le texte annonce déjà « documents en pièce jointe » : il dit vrai.

const PJE_MAX = 3.5 * 1024 * 1024;   // limite d'un envoi Graph en une requête (≈ 4 Mo encodés)
const _pje = { items: [], locaux: [] };

function pjeEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pjeTaille(o) { return o < 1024 * 1024 ? Math.max(1, Math.round(o / 1024)) + ' Ko' : (o / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo'; }

async function pjeOppDe(ctx) {
  if (ctx.oppId) return ctx.oppId;
  if (!ctx.demandeOffreId) return null;
  for (const [oid, liste] of Object.entries(window._opDemandes || {})) if ((liste || []).some(d => d.id === ctx.demandeOffreId)) return oid;
  const r = await dbGet('demandes_offre', `id=eq.${ctx.demandeOffreId}&select=opportunite_id`);
  return (Array.isArray(r) && r[0] && r[0].opportunite_id) || null;
}

async function pjeDocuments(oppId) {
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  const items = [];
  if (!o) return items;
  (Array.isArray(o.pieces_jointes) ? o.pieces_jointes : []).forEach(f => { if (f && f.path) items.push({ path: f.path, nom: f.nom || f.path.split('/').pop(), source: 'Document de l’affaire' }); });
  (window._opDemandes[oppId] || []).forEach(d => (d.compagnies_envoi || []).forEach(e => {
    if (e.offre_path && !items.some(x => x.path === e.offre_path)) items.push({ path: e.offre_path, nom: e.offre_nom || `Offre ${e.compagnie || ''}.pdf`, source: `Offre ${e.compagnie || ''}` });
  }));
  if (o.client_id) {
    try {
      const m = await dbGet('mandats_signes', `client_id=eq.${o.client_id}&signe=is.true&archive=is.false&select=fichier_url,fichier_nom,created_at&order=created_at.desc&limit=1`);
      if (Array.isArray(m) && m[0] && m[0].fichier_url) items.push({ path: m[0].fichier_url, nom: m[0].fichier_nom || 'Mandat de courtage signé.pdf', source: 'Mandat signé du client' });
    } catch (e) { /* sans mandat : rien */ }
  }
  return items;
}

function pjeRendre() {
  const z = document.getElementById('pje-liste');
  if (!z) return;
  const lignes = [
    ..._pje.items.map((it, i) => `<label class="pje-ligne"><input type="checkbox" data-pje="d${i}" ${it.coche ? 'checked' : ''} onchange="pjeCocher('d',${i},this.checked)"/>
      <span class="pje-nom">📄 ${pjeEsc(it.nom)}</span><span class="pje-src">${pjeEsc(it.source)}</span>
      <button type="button" class="pje-voir" onclick="event.preventDefault();ouvrirPieceJointe('${pjeEsc(it.path)}')" title="Voir le document">👁</button></label>`),
    ..._pje.locaux.map((f, i) => `<label class="pje-ligne"><input type="checkbox" ${f.coche ? 'checked' : ''} onchange="pjeCocher('l',${i},this.checked)"/>
      <span class="pje-nom">💻 ${pjeEsc(f.file.name)}</span><span class="pje-src">${pjeTaille(f.file.size)} · ordinateur</span></label>`),
  ];
  z.innerHTML = lignes.length ? lignes.join('') : '<div class="pje-vide">Aucun document déposé sur l’affaire.</div>';
  const n = _pje.items.filter(x => x.coche).length + _pje.locaux.filter(x => x.coche).length;
  const c = document.getElementById('pje-compte'); if (c) c.textContent = n ? `${n} cochée${n > 1 ? 's' : ''}` : 'aucune';
}
function pjeCocher(t, i, v) { (t === 'd' ? _pje.items : _pje.locaux)[i].coche = v; pjeRendre(); }
function pjeAjouterLocaux(input) {
  [...(input.files || [])].forEach(file => _pje.locaux.push({ file, coche: true }));
  input.value = ''; pjeRendre();
}

async function pjeTelecharger(path) {
  const token = await getValidAccessToken() || SUPABASE_KEY;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/documents/${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${path.split('/').pop()} (${r.status})`);
  return r.blob();
}
function pjeB64(blob) {
  return new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = () => ko(fr.error); fr.readAsDataURL(blob); });
}
async function pjePreparer() {
  const out = [];
  for (const it of _pje.items.filter(x => x.coche)) {
    const b = await pjeTelecharger(it.path);
    out.push({ name: it.nom, type: b.type || 'application/octet-stream', blob: b });
  }
  _pje.locaux.filter(x => x.coche).forEach(f => out.push({ name: f.file.name, type: f.file.type || 'application/octet-stream', blob: f.file }));
  const total = out.reduce((s, x) => s + x.blob.size, 0);
  if (total > PJE_MAX) throw new Error(`pièces jointes trop lourdes (${pjeTaille(total)}, maximum ${pjeTaille(PJE_MAX)}) — décoche-en une partie`);
  for (const x of out) x.contentBytes = await pjeB64(x.blob);
  return out;
}

(function pjeBrancher() {
  if (typeof ouvrirApercuEmailDemandeOffre !== 'function' || typeof envoyerApercuEmailDemandeOffreViaOutlook !== 'function') return;

  const ouvrir = ouvrirApercuEmailDemandeOffre;
  window.ouvrirApercuEmailDemandeOffre = function () {
    const r = ouvrir.apply(this, arguments);
    _pje.items = []; _pje.locaux = [];
    const ctx = window._apercuEmailDemandeOffre || {};
    const actions = document.querySelector('#modal-apercu-email-do .btn-save')?.parentElement;
    if (actions) {
      actions.insertAdjacentHTML('beforebegin', `<div class="pje" id="pje">
        <div class="pje-tete"><b>📎 Pièces jointes</b> <span id="pje-compte" class="pje-src">…</span>
          <label class="pje-ajout">+ Fichier de l’ordinateur<input type="file" multiple hidden onchange="pjeAjouterLocaux(this)"/></label></div>
        <div id="pje-liste" class="pje-liste"><div class="pje-vide">Recherche des documents de l’affaire…</div></div>
        <div class="pje-note">Jointes à l’envoi « via Outlook » uniquement (Copier / client mail : à joindre toi-même).</div></div>`);
    }
    pjeOppDe(ctx).then(async oid => { ctx.oppId = ctx.oppId || oid; _pje.items = oid ? await pjeDocuments(oid) : []; pjeRendre(); }).catch(() => pjeRendre());
    return r;
  };

  // Envoi : on prépare les fichiers, puis on laisse js/07 envoyer ; son appel à sendMail reçoit les
  // pièces jointes au passage (une seule fois, pour cet envoi-là).
  const envoyer = envoyerApercuEmailDemandeOffreViaOutlook;
  window.envoyerApercuEmailDemandeOffreViaOutlook = async function () {
    const coches = _pje.items.some(x => x.coche) || _pje.locaux.some(x => x.coche);
    if (!coches) return envoyer.apply(this, arguments);
    let pj;
    try { showError('⏳ Préparation des pièces jointes…'); pj = await pjePreparer(); }
    catch (e) { showError('Envoi arrêté : ' + (e.message || e)); return; }
    const f0 = window.fetch;
    let jointes = false;
    window.fetch = function (url, opts) {
      if (!jointes && /graph\.microsoft\.com\/v1\.0\/me\/sendMail$/.test(String(url)) && opts && typeof opts.body === 'string') {
        try {
          const b = JSON.parse(opts.body);
          b.message.attachments = pj.map(x => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: x.name, contentType: x.type, contentBytes: x.contentBytes }));
          opts = { ...opts, body: JSON.stringify(b) }; jointes = true;
        } catch (e) { /* corps illisible : envoi tel quel */ }
      }
      return f0.apply(this, [url, opts]);
    };
    const ctx = window._apercuEmailDemandeOffre || {};
    try { await envoyer.apply(this, arguments); }
    finally { window.fetch = f0; }
    if (jointes && !document.getElementById('modal-apercu-email-do') && ctx.oppId && typeof ajouterLigneHistoriqueOpportunite === 'function')
      await ajouterLigneHistoriqueOpportunite(ctx.oppId, `📎 Joint à la demande d’offre : ${pj.map(x => x.name).join(', ')}`);
  };

  const st = document.createElement('style');
  st.textContent = `
    .pje { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin: -4px 0 14px; background: var(--surface-alt); }
    .pje-tete { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; font-size: 13px; color: var(--text); }
    .pje-ajout { margin-left: auto; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--accent); }
    .pje-liste { display: flex; flex-direction: column; gap: 2px; max-height: 180px; overflow: auto; }
    .pje-ligne { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 5px 4px; border-radius: 8px; cursor: pointer; font-size: 12.5px; color: var(--text); }
    .pje-ligne:hover { background: var(--surface); }
    .pje-nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pje-src { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
    .pje-voir { background: none; border: 0; cursor: pointer; font-size: 14px; padding: 0 2px; }
    .pje-vide, .pje-note { font-size: 11.5px; color: var(--text-muted); padding: 4px; }
    @media (max-width: 560px) { .pje-ligne { grid-template-columns: auto minmax(0, 1fr) auto; } .pje-src { display: none; } }`;
  document.head.appendChild(st);
})();
