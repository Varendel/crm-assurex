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

// 24.09.2026 — « Je n'arrive jamais à joindre les mandats, taille pièce jointe. » La limite était
// à 2,5 Mo parce que l'envoi passait forcément par /sendMail en une requête (plafonnée à ~4 Mo
// une fois encodée en base64). Depuis que js/143 bascule tout seul sur un brouillon + téléversement
// en tranches au-delà de cette taille, la seule limite qui reste est celle de la boîte Outlook
// elle-même — 25 à 35 Mo selon la configuration Exchange. On se garde une marge à 20 Mo :
// au-delà, c'est le serveur du destinataire qui refuserait, et mieux vaut le dire avant l'envoi.
const PJE_MAX = 20 * 1024 * 1024;
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
      // « Si les mandats sont signés, ils doivent aussi sortir dans les documents liés de la demande
      // d'offre et toujours joints » : coché d'office (décochable au cas par cas).
      // Un mandat signé DANS le CRM n'a pas de PDF (fichier_url vide) : seule la capture HTML de la
      // signature existe (html_snapshot, cas Tandoori Plage). On le liste quand même et le PDF est
      // fabriqué au moment de l'envoi, puis archivé sur le mandat pour les fois suivantes.
      const m = await dbGet('mandats_signes', `client_id=eq.${o.client_id}&signe=is.true&archive=is.false&select=id,fichier_url,fichier_nom,html_snapshot,created_at&order=created_at.desc`);
      const sig = (Array.isArray(m) ? m : []).filter(x => x.fichier_url || x.html_snapshot);
      if (sig.length) {
        const x = sig[0];
        const nom = (x.fichier_nom || 'Mandat de courtage signé').replace(/\.(pdf|html?)$/i, '').replace(/[\\/:*?"<>|]/g, '-') + '.pdf';
        items.push(x.fichier_url
          ? { path: x.fichier_url, nom, source: 'Mandat signé · joint d’office', defaut: true }
          : { path: `mandat:${x.id}`, mandatId: x.id, html: x.html_snapshot, nom, source: 'Mandat signé dans le CRM · joint d’office', defaut: true });
      }
    } catch (e) { /* sans mandat : rien */ }
  }
  return items.sort((a, b) => (b.defaut ? 1 : 0) - (a.defaut ? 1 : 0));   // le mandat en tête
}

function pjeRendre() {
  const zones = ['pje-liste', 'pjf-liste'].map(id => document.getElementById(id)).filter(Boolean);
  if (!zones.length) return;
  const lignes = [
    ..._pje.items.map((it, i) => `<label class="pje-ligne"><input type="checkbox" data-pje="d${i}" ${it.coche ? 'checked' : ''} onchange="pjeCocher('d',${i},this.checked)"/>
      <span class="pje-nom">📄 ${pjeEsc(it.nom)}</span><span class="pje-src">${pjeEsc(it.source)}</span>
      <button type="button" class="pje-voir" onclick="event.preventDefault();pjeVoir(${i})" title="Voir le document">👁</button></label>`),
    ..._pje.locaux.map((f, i) => `<label class="pje-ligne"><input type="checkbox" ${f.coche ? 'checked' : ''} onchange="pjeCocher('l',${i},this.checked)"/>
      <span class="pje-nom">💻 ${pjeEsc(f.file.name)}</span><span class="pje-src">${pjeTaille(f.file.size)} · ordinateur</span></label>`),
  ];
  const vide = _pje.sansOpp ? 'Pas d’affaire liée à cette demande — ajoute les fichiers depuis l’ordinateur.' : 'Aucun document déposé sur l’affaire.';
  zones.forEach(z => { z.innerHTML = lignes.length ? lignes.join('') : `<div class="pje-vide">${vide}</div>`; });
  const n = _pje.items.filter(x => x.coche).length + _pje.locaux.filter(x => x.coche).length;
  ['pje-compte', 'pjf-compte'].forEach(id => { const c = document.getElementById(id); if (c) c.textContent = n ? `${n} cochée${n > 1 ? 's' : ''}` : 'aucune'; });
}

// ── Dans le formulaire de demande d'offre (js/26), juste au-dessus de « Relire et envoyer » ──────
// « Je suis dans l'opportunité, j'ai uploadé des documents dans l'opp ; je clique sur demande
// d'offre : vers le bouton Envoyer, il faut un sélecteur des documents de l'opp à joindre. »
// Même sélection que dans l'aperçu : ce qui est coché ici est coché dans l'aperçu et part à l'envoi.
async function pjfPoser() {
  // Formulaire rapide (js/26) : au-dessus de la barre d'envoi ; formulaire détaillé (js/07) : au-dessus
  // de « Générer l'email ».
  const barre = document.querySelector('#main-content .dx-barre') || document.querySelector('#main-content button[onclick^="genererEmailDemandeOffre"]');
  if (!barre || document.getElementById('pjf')) return;
  barre.insertAdjacentHTML('beforebegin', `<section class="pje pjf" id="pjf">
    <div class="pje-tete"><b>📎 Pièces jointes à la demande</b> <span id="pjf-compte" class="pje-src">…</span>
      <label class="pje-ajout">+ Fichier de l’ordinateur<input type="file" multiple hidden onchange="pjeAjouterLocaux(this)"/></label></div>
    <div id="pjf-liste" class="pje-liste"><div class="pje-vide">Recherche des documents de l’affaire…</div></div></section>`);
  const oid = document.getElementById('do-opportunite-id')?.value || null;
  if (_pje.form !== oid) { _pje.items = []; _pje.locaux = []; }
  _pje.form = oid; _pje.sansOpp = !oid;
  const avant = new Map(_pje.items.map(x => [x.path, x.coche]));
  try { _pje.items = oid ? (await pjeDocuments(oid)).map(x => ({ ...x, coche: avant.has(x.path) ? avant.get(x.path) : !!x.defaut })) : []; } catch (e) { _pje.items = []; }
  pjeRendre();
}
function pjeCocher(t, i, v) { (t === 'd' ? _pje.items : _pje.locaux)[i].coche = v; pjeRendre(); }
function pjeVoir(i) {
  const it = _pje.items[i]; if (!it) return;
  if (it.html) { const w = window.open(URL.createObjectURL(new Blob([it.html], { type: 'text/html;charset=utf-8' })), '_blank'); if (!w) showError('Autorise les fenêtres pop-up pour voir le mandat.'); return; }
  ouvrirPieceJointe(it.path);
}
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
// Mandat signé dans le CRM : PDF fabriqué depuis la capture HTML (jsPDF + html2canvas chargés à la
// demande), puis archivé sur le mandat — la fois suivante, c'est un vrai fichier comme les autres.
function pjeScript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('chargement ' + src)); document.head.appendChild(s); }); }
async function pjeMandatPdf(it) {
  if (!window.html2canvas) await pjeScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (!window.jspdf) await pjeScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  const hote = document.createElement('div');
  hote.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;padding:36px;font-family:Arial,Helvetica,sans-serif;color:#111';
  hote.innerHTML = it.html;
  document.body.appendChild(hote);
  try {
    const toile = await html2canvas(hote, { scale: 2, backgroundColor: '#fff', useCORS: true });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const L = 210, H = 297, hImg = toile.height * L / toile.width;
    const img = toile.toDataURL('image/jpeg', 0.92);
    for (let y = 0, p = 0; y < hImg; y += H, p++) { if (p) pdf.addPage(); pdf.addImage(img, 'JPEG', 0, -y, L, hImg); }
    const blob = pdf.output('blob');
    // archivage (facultatif) : le mandat aura enfin son PDF
    try {
      const path = `mandats/${it.mandatId}/${Date.now().toString(36)}-mandat-signe.pdf`;
      const token = await getValidAccessToken() || SUPABASE_KEY;
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' }, body: blob });
      if (up.ok) await dbPatch('mandats_signes', it.mandatId, { fichier_url: path, fichier_nom: it.nom });
    } catch (e) { /* l'envoi n'attend pas l'archivage */ }
    return blob;
  } finally { hote.remove(); }
}

// Le mandat signé d'un client, prêt à joindre : le PDF archivé, ou celui fabriqué depuis la
// signature faite dans le CRM. Utilisé par « Poser le mandat aux compagnies » (js/05) et par la
// demande d'offre. Renvoie null si le client n'a pas de mandat signé.
async function pjeMandatDuClient(clientId) {
  if (!clientId) return null;
  const r = await dbGet('mandats_signes', `client_id=eq.${clientId}&signe=is.true&archive=is.false&select=id,fichier_url,fichier_nom,html_snapshot,created_at&order=created_at.desc`);
  const m = (Array.isArray(r) ? r : []).find(x => x.fichier_url || x.html_snapshot);
  if (!m) return null;
  const nom = (m.fichier_nom || 'Mandat de courtage signé').replace(/\.(pdf|html?)$/i, '').replace(/[\\/:*?"<>|]/g, '-') + '.pdf';
  const blob = m.fichier_url ? await pjeTelecharger(m.fichier_url) : await pjeMandatPdf({ mandatId: m.id, html: m.html_snapshot, nom });
  return { name: nom, type: blob.type || 'application/pdf', blob };
}

async function pjePreparer() {
  const out = [];
  for (const it of _pje.items.filter(x => x.coche)) {
    const b = it.html ? await pjeMandatPdf(it) : await pjeTelecharger(it.path);
    out.push({ name: it.nom, type: b.type || 'application/octet-stream', blob: b });
  }
  _pje.locaux.filter(x => x.coche).forEach(f => out.push({ name: f.file.name, type: f.file.type || 'application/octet-stream', blob: f.file }));
  const total = out.reduce((s, x) => s + x.blob.size, 0);
  if (total > PJE_MAX) throw new Error(`pièces jointes trop lourdes (${pjeTaille(total)}, maximum ${pjeTaille(PJE_MAX)}) — la boîte du destinataire les refuserait ; décoche-en une partie ou envoie un lien`);
  for (const x of out) x.contentBytes = await pjeB64(x.blob);
  return out;
}

(function pjeBrancher() {
  if (typeof ouvrirApercuEmailDemandeOffre !== 'function' || typeof envoyerApercuEmailDemandeOffreViaOutlook !== 'function') return;

  const ouvrir = ouvrirApercuEmailDemandeOffre;
  window.ouvrirApercuEmailDemandeOffre = function () {
    const r = ouvrir.apply(this, arguments);
    // Venant du formulaire (sélection déjà faite) : on la garde ; sinon on repart de zéro.
    const duFormulaire = !!document.getElementById('pjf');
    if (!duFormulaire) { _pje.items = []; _pje.locaux = []; }
    const avant = new Map(_pje.items.map(x => [x.path, x.coche]));
    const ctx = window._apercuEmailDemandeOffre || {};
    const actions = document.querySelector('#modal-apercu-email-do .btn-save')?.parentElement;
    if (actions) {
      actions.insertAdjacentHTML('beforebegin', `<div class="pje" id="pje">
        <div class="pje-tete"><b>📎 Pièces jointes</b> <span id="pje-compte" class="pje-src">…</span>
          <label class="pje-ajout">+ Fichier de l’ordinateur<input type="file" multiple hidden onchange="pjeAjouterLocaux(this)"/></label></div>
        <div id="pje-liste" class="pje-liste"><div class="pje-vide">Recherche des documents de l’affaire…</div></div>
        <div class="pje-note">Jointes à l’envoi « via Outlook » uniquement (Copier / client mail : à joindre toi-même).</div></div>`);
    }
    pjeRendre();
    pjeOppDe(ctx).then(async oid => { ctx.oppId = ctx.oppId || oid; _pje.sansOpp = !oid;
      _pje.items = oid ? (await pjeDocuments(oid)).map(x => ({ ...x, coche: avant.has(x.path) ? avant.get(x.path) : !!x.defaut })) : []; pjeRendre(); }).catch(() => pjeRendre());
    return r;
  };

  // 22.09.2026 (audit, point 2) : l'envoi n'est plus détourné ici. js/07 appelle pjePreparer()
  // lui-même et passe les pièces à envoyerCourriel (js/143) — plus besoin de réécrire window.fetch
  // pour glisser les fichiers dans la requête Graph au vol.

  let tPjf = null;
  const guetter = () => { const m = document.getElementById('main-content'); if (m) new MutationObserver(() => { clearTimeout(tPjf); tPjf = setTimeout(() => pjfPoser().catch(() => {}), 150); }).observe(m, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guetter); else guetter();

  const st = document.createElement('style');
  st.textContent = `
    .pje.pjf { margin: 16px 0 12px; background: var(--surface); }
    .pje.pjf .pje-liste { max-height: 240px; }`;
  document.head.appendChild(st);
  const st2 = document.createElement('style');
  st2.textContent = `
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
  document.head.appendChild(st2);
})();
