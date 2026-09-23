// ═══ ÉCRIRE À COFIDEX — VUE DÉDIÉE (22.09.2026) ═════════════════════════════════════════════════
// « Laisse l'équipe et enlève le bouton Cofidex ; ajoute cette fonction de leur écrire dans une vue
// dédiée inspirée des courriers sortants : une belle mise en page avec les membres d'équipe et un
// sélecteur de client. »
//
// Même principe que « Courriers clients » (js/45) : à gauche ce qu'on écrit, à droite l'aperçu de
// ce qui part. En haut, l'équipe Cofidex (table equipe_cofidex) en cartes cliquables — on choisit
// les destinataires d'un clic. Le client se choisit dans un champ de recherche : sa situation
// (IDE, contrats, primes, échéances) remplit le message toute seule, et ses documents deviennent
// des pièces jointes à cocher.
// L'envoi passe par le compte Outlook connecté avec la signature (js/138), après confirmation.

const _ccx = { equipe: null, t: 0, clientId: null, dest: new Set(), modele: 'presentation', objet: '', corps: '', docs: [], docsCoches: new Set(), locaux: [], charge: false };

function ccxEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ccxNomClient(c) { return !c ? '' : (typeof estEntreprise === 'function' && estEntreprise(c)) ? (c.nom || '') : [c.prenom, c.nom].filter(Boolean).join(' '); }
function ccxClient() { return (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === _ccx.clientId) || null; }
function ccxInitiales(p) { return [(p.prenom || '')[0], (p.nom || '')[0]].filter(Boolean).join('').toUpperCase() || '?'; }

const CCX_MODELES = [
  { id: 'presentation', label: '👋 Présenter le client', objet: n => `Nouveau client — ${n}`,
    corps: (n, ide, d) => `Bonjour,\n\nJe vous présente ${n}${ide ? ` (${ide})` : ''}, que je suis côté assurances.\n\n${d.resume}\n\nJe reste à disposition pour toute question.` },
  { id: 'documents', label: '📎 Transmettre des documents', objet: n => `${n} — documents`,
    corps: (n, ide, d) => `Bonjour,\n\nVous trouverez en pièce jointe les documents de ${n}${ide ? ` (${ide})` : ''}.\n\n${d.resume}\n\nBonne réception.` },
  { id: 'question', label: '❓ Poser une question', objet: n => `${n} — question`,
    corps: (n, ide) => `Bonjour,\n\nAu sujet de ${n}${ide ? ` (${ide})` : ''} :\n\n[ta question]\n\nMerci d’avance pour ton retour.` },
  { id: 'salaires', label: '👥 Salaires et personnel', objet: n => `${n} — salaires et assurances du personnel`,
    corps: (n, ide, d) => `Bonjour,\n\nPour ${n}${ide ? ` (${ide})` : ''}, voici la situation côté assurances du personnel :\n\n${d.personnel || '—'}\n\nPouvez-vous me confirmer les masses salariales à jour ?` },
  { id: 'libre', label: '✏️ Message libre', objet: n => n || 'Message', corps: () => 'Bonjour,\n\n' },
];

async function ccxEquipe(forcer) {
  if (!forcer && _ccx.equipe && Date.now() - _ccx.t < 300000) return _ccx.equipe;
  const r = await dbGet('equipe_cofidex', 'actif=is.true&select=id,prenom,nom,email,fonction,email_a_verifier,ordre&order=ordre');
  _ccx.equipe = Array.isArray(r) ? r : [];
  _ccx.t = Date.now();
  return _ccx.equipe;
}

function ccxContexte(client) {
  const contrats = (typeof allContrats !== 'undefined' ? allContrats : [])
    .filter(x => x.client_id === (client && client.id) && !['résilié', 'annulé', 'mandat_resilie'].includes(x.statut || ''));
  const ligne = ct => `- ${ct.produit || 'Contrat'}${ct.compagnie ? ' · ' + ct.compagnie : ''}${ct.numero_police ? ' · police ' + ct.numero_police : ''}${ct.prime_annuelle ? ' · CHF ' + fmtCHF(Math.round(ct.prime_annuelle)) + '/an' : ''}${ct.date_echeance ? ' · échéance ' + fmtDate(String(ct.date_echeance).slice(0, 10)) : ''}`;
  const perso = contrats.filter(ct => /laa|lpp|perte de gain|maladie|accident/i.test(ct.produit || ''));
  return {
    resume: contrats.length ? `Contrats en cours :\n${contrats.map(ligne).join('\n')}` : 'Aucun contrat enregistré à ce jour dans le CRM.',
    personnel: perso.length ? perso.map(ligne).join('\n') : '',
  };
}

function ccxAppliquerModele(garderTexte) {
  const c = ccxClient(), m = CCX_MODELES.find(x => x.id === _ccx.modele) || CCX_MODELES[0];
  const nom = ccxNomClient(c) || '[client]', ide = (c && (c.ide || c.numero_ide)) || '';
  if (!garderTexte) { _ccx.objet = m.objet(nom); _ccx.corps = m.corps(nom, ide, ccxContexte(c)); }
  const o = document.getElementById('ccx-objet'), t = document.getElementById('ccx-corps');
  if (o) o.value = _ccx.objet;
  if (t) t.value = _ccx.corps;
}

// ── La vue ──────────────────────────────────────────────────────────────────────────────────────
function viewCofidex() {
  const clients = (typeof allClients !== 'undefined' ? allClients : []).filter(c => c.statut !== 'inactif')
    .map(c => ({ id: c.id, n: ccxNomClient(c) })).filter(c => c.n).sort((a, b) => a.n.localeCompare(b.n, 'fr'));
  const c = ccxClient();
  if (!_ccx.corps) ccxAppliquerModele();
  setTimeout(() => { ccxEquipe().then(ccxRendreEquipe); ccxChargerDocuments(); ccxMajApercu(); }, 0);
  return `<div class="ccx-vue">
    <header class="dx-tete"><div><div class="dx-surtitre">Relation interne · fiduciaire Cofidex SA</div><h2>🏢 Écrire à Cofidex</h2>
      <p class="dx-sous">Choisis les destinataires et le client : le message se remplit avec sa situation et ses documents. L’aperçu à droite montre ce qui part, signature comprise.</p></div></header>

    <section class="ccx-equipe-bloc dbx-carte">
      <div class="ccx-bloc-tete"><b>Destinataires</b><span id="ccx-compte" class="ccx-doux">aucun</span></div>
      <div class="ccx-equipe" id="ccx-equipe"><span class="ccx-doux">Chargement de l’équipe…</span></div>
      <label class="form-label" for="ccx-autres">Autres adresses <small>(séparées par des virgules)</small></label>
      <input class="form-input" id="ccx-autres" placeholder="prenom@cofidex.ch" oninput="ccxMajApercu()"/>
    </section>

    <div class="ccx-grille">
      <section class="dbx-carte ccx-form">
        <div class="form-field"><label class="form-label" for="ccx-client">Client concerné</label>
          <input class="form-input" id="ccx-client" list="ccx-clients" placeholder="Rechercher un client…" value="${ccxEsc(ccxNomClient(c))}" onchange="ccxChoisirClient(this.value)"/>
          <datalist id="ccx-clients">${clients.map(x => `<option value="${ccxEsc(x.n)}"></option>`).join('')}</datalist></div>
        <div class="form-field"><label class="form-label" for="ccx-modele">Motif</label>
          <select class="form-select" id="ccx-modele" onchange="_ccx.modele=this.value;ccxAppliquerModele();ccxMajApercu()">
            ${CCX_MODELES.map(m => `<option value="${m.id}" ${m.id === _ccx.modele ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div>
        <div class="form-field"><label class="form-label" for="ccx-objet">Objet</label>
          <input class="form-input" id="ccx-objet" value="${ccxEsc(_ccx.objet)}" oninput="_ccx.objet=this.value;ccxMajApercu()"/></div>
        <div class="form-field"><label class="form-label" for="ccx-corps">Message</label>
          <textarea class="form-input" id="ccx-corps" rows="16" oninput="_ccx.corps=this.value;ccxMajApercu()">${ccxEsc(_ccx.corps)}</textarea></div>
        <div class="form-field"><label class="form-label">Pièces jointes <small>documents du client</small></label>
          <div id="ccx-pj" class="ccx-pj"><span class="ccx-doux">Choisis d’abord un client.</span></div>
          <label class="ccx-ajout">+ Fichier de l’ordinateur<input type="file" multiple hidden onchange="ccxAjouterFichiers(this)"/></label></div>
        <div class="ccx-actions">
          <button type="button" class="btn-secondary" onclick="ccxCopier()">📋 Copier</button>
          <button type="button" class="btn-save" id="ccx-envoyer" onclick="ccxEnvoyer()">📨 Envoyer via Outlook</button>
        </div>
      </section>

      <section class="ccx-apercu-zone" aria-label="Aperçu du courriel">
        <div class="ccx-barre"><b>Aperçu</b> <small>tel que l’équipe le recevra</small></div>
        <div class="ccx-fenetre"><div class="ccx-tete" id="ccx-apercu-tete"></div><iframe id="ccx-apercu" title="Contenu du courriel" sandbox="allow-same-origin"></iframe></div>
      </section>
    </div>
  </div>`;
}

function ccxRendreEquipe(equipe) {
  const z = document.getElementById('ccx-equipe');
  if (!z) return;
  z.innerHTML = equipe.length ? equipe.map(p => {
    const sans = !p.email;
    const choisi = p.email && _ccx.dest.has(p.email);
    return `<button type="button" class="ccx-personne ${choisi ? 'choisie' : ''} ${sans ? 'sans' : ''}" ${sans ? 'disabled' : ''}
      onclick="ccxBasculer('${ccxEsc(p.email || '')}')" title="${sans ? 'Adresse à renseigner' : ccxEsc(p.email)}">
      <span class="ccx-avatar">${ccxEsc(ccxInitiales(p))}</span>
      <span class="ccx-qui"><b>${ccxEsc([p.prenom, p.nom].filter(Boolean).join(' '))}</b>
        <small>${ccxEsc(p.fonction || '')}</small>
        <em>${sans ? 'adresse à renseigner' : ccxEsc(p.email)}${p.email_a_verifier && p.email ? ' · à vérifier' : ''}</em></span>
      <span class="ccx-coche">${choisi ? '✓' : ''}</span>
    </button>`;
  }).join('') : '<span class="ccx-doux">Aucun membre enregistré.</span>';
}

function ccxBasculer(email) {
  if (!email) return;
  if (_ccx.dest.has(email)) _ccx.dest.delete(email); else _ccx.dest.add(email);
  ccxEquipe().then(ccxRendreEquipe);
  ccxMajApercu();
}

function ccxChoisirClient(nom) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => ccxNomClient(x) === String(nom || '').trim());
  if (!c) { showError('Client introuvable — choisis-le dans la liste.'); return; }
  _ccx.clientId = c.id; _ccx.docs = []; _ccx.docsCoches = new Set();
  ccxAppliquerModele();
  ccxChargerDocuments();
  ccxMajApercu();
}

async function ccxChargerDocuments() {
  const z = document.getElementById('ccx-pj');
  const c = ccxClient();
  if (!z) return;
  if (!c) { z.innerHTML = '<span class="ccx-doux">Choisis d’abord un client.</span>'; return; }
  z.innerHTML = '<span class="ccx-doux">Lecture des documents…</span>';
  const items = [];
  try {
    const m = await dbGet('mandats_signes', `client_id=eq.${c.id}&signe=is.true&archive=is.false&select=id&limit=1`);
    if (Array.isArray(m) && m[0]) items.push({ nom: 'Mandat de courtage signé.pdf', source: 'mandat signé', mandat: true });
    const docs = await dbGet('documents_compagnies', `client_id=eq.${c.id}&select=id,titre,nom_fichier,chemin,type&order=created_at.desc&limit=30`);
    (Array.isArray(docs) ? docs : []).forEach(d => { if (d.chemin) items.push({ nom: d.nom_fichier || d.titre || 'Document', source: d.type || 'document', path: d.chemin }); });
  } catch (e) { /* liste facultative */ }
  _ccx.docs = items;
  z.innerHTML = (items.length ? items.map((it, i) => `<label class="ccx-doc"><input type="checkbox" data-doc="${i}" ${_ccx.docsCoches.has(i) ? 'checked' : ''} onchange="ccxCocherDoc(${i}, this.checked)"/><span>📄 ${ccxEsc(it.nom)}<small>${ccxEsc(it.source)}</small></span></label>`).join('')
    : '<span class="ccx-doux">Aucun document rangé sur ce client.</span>')
    + _ccx.locaux.map((f, i) => `<span class="ccx-doc fige">💻 ${ccxEsc(f.name)}<button type="button" onclick="ccxRetirerLocal(${i})" title="Retirer">✕</button></span>`).join('');
}

function ccxCocherDoc(i, oui) { if (oui) _ccx.docsCoches.add(i); else _ccx.docsCoches.delete(i); ccxMajApercu(); }
function ccxAjouterFichiers(input) { [...(input.files || [])].forEach(f => _ccx.locaux.push(f)); input.value = ''; ccxChargerDocuments(); ccxMajApercu(); }
function ccxRetirerLocal(i) { _ccx.locaux.splice(i, 1); ccxChargerDocuments(); ccxMajApercu(); }

function ccxDestinataires() {
  const libres = (document.getElementById('ccx-autres')?.value || '').split(/[,;\s]+/).filter(x => /@/.test(x));
  return [...new Set([..._ccx.dest, ...libres])];
}

// ── L'aperçu, construit avec les mêmes fonctions que l'envoi ────────────────────────────────────
async function ccxMajApercu() {
  const dest = ccxDestinataires();
  const cpt = document.getElementById('ccx-compte');
  if (cpt) cpt.textContent = dest.length ? dest.join(', ') : 'aucun';
  const b = document.getElementById('ccx-envoyer');
  if (b) b.disabled = !dest.length || !_ccx.clientId;
  const tete = document.getElementById('ccx-apercu-tete'), f = document.getElementById('ccx-apercu');
  if (!tete || !f) return;
  const ag = typeof sigAgent === 'function' ? await sigAgent().catch(() => null) : null;
  const compte = typeof sigCompteOutlook === 'function' ? await sigCompteOutlook().catch(() => null) : null;
  const moi = (compte && compte.nom) || (ag && [ag.prenom, ag.nom].filter(Boolean).join(' ')) || '';
  const adresse = (compte && compte.adresse) || (ag && ag.email) || '';
  const pj = [..._ccx.docs.filter((_, i) => _ccx.docsCoches.has(i)).map(d => d.nom), ..._ccx.locaux.map(f2 => f2.name)];
  tete.innerHTML = `<div class="ccx-objet-ap">${ccxEsc(_ccx.objet) || '<i>(sans objet)</i>'}</div>
    <div class="ccx-exp"><span class="ccx-avatar petit">${ccxEsc((moi.split(/\s+/).map(x => x[0] || '').join('') || '✉').slice(0, 2).toUpperCase())}</span>
      <div><div><b>${ccxEsc(moi)}</b> <span class="ccx-doux">${ccxEsc(adresse)}</span></div>
        <div class="ccx-doux">À ${dest.length ? dest.map(ccxEsc).join(', ') : '—'}</div></div></div>
    ${pj.length ? `<div class="ccx-pj-ap">${pj.map(n => `<span>📄 ${ccxEsc(n)}</span>`).join('')}</div>` : ''}`;
  const texte = typeof sigTexteVersHtml === 'function' && ag ? sigTexteVersHtml(_ccx.corps, ag)
    : `<div style="font-family:Aptos,Calibri,Arial,sans-serif;font-size:11pt">${ccxEsc(_ccx.corps).replace(/\n/g, '<br>')}</div>`;
  let sig = (ag && ag.signature_email_actif && ag.signature_email_html) || '';
  if (sig && typeof sigImages === 'function') {
    const imgs = await sigImages(ag).catch(() => []);
    imgs.forEach(im => { sig = sig.split(`cid:${im.contentId}`).join(`data:${im.contentType};base64,${im.contentBytes}`); });
  }
  f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:18px 20px;background:#fff;color:#000;font-family:Aptos,Calibri,Arial,sans-serif}img{max-width:100%;height:auto}</style></head><body>${texte}${sig ? '<br>' + sig : ''}</body></html>`;
}

function ccxCopier() {
  const texte = `Objet : ${_ccx.objet}\n\n${_ccx.corps}`;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(() => showError('✓ Texte copié.'), () => showError('Copie impossible — sélectionne le texte.'));
}

async function ccxEnvoyer() {
  const dest = ccxDestinataires();
  const c = ccxClient();
  if (!dest.length || !c) { showError('Choisis au moins un destinataire et un client.'); return; }
  const b = document.getElementById('ccx-envoyer');
  if (b) b.disabled = true;
  try {
    // 22.09.2026 (audit, point 2) : l'envoi passe par envoyerCourriel (js/143), qui s'occupe du
    // compte Outlook, de la signature, de l'encodage des pièces jointes et des erreurs.
    const pieces = [];
    for (const i of _ccx.docsCoches) {
      const it = _ccx.docs[i]; if (!it) continue;
      const blob = it.mandat && typeof pjeMandatDuClient === 'function' ? (await pjeMandatDuClient(c.id))?.blob
        : (typeof pjeTelecharger === 'function' ? await pjeTelecharger(it.path) : null);
      if (blob) pieces.push({ nom: it.nom, type: blob.type || 'application/pdf', blob });
    }
    for (const f of _ccx.locaux) pieces.push({ nom: f.name, type: f.type || 'application/octet-stream', blob: f });
    const res = await envoyerCourriel({ a: dest, objet: _ccx.objet, texte: _ccx.corps, pieces, contexte: 'Cofidex' });
    if (!res.ok) { if (b) b.disabled = false; return; }
    if (typeof ajouterActiviteClient === 'function') await ajouterActiviteClient(c.id, 'email', `Courriel à Cofidex (${dest.join(', ')}) : ${_ccx.objet}`);
    _ccx.locaux = []; _ccx.docsCoches = new Set();
    ccxChargerDocuments(); ccxMajApercu();
  } catch (e) { showError('Envoi impossible : ' + (e.message || e)); if (b) b.disabled = false; }
}

// Le bouton du menu est rendu par la barre latérale elle-même (js/03, entrée « cofidex-solo », sous
// OZ Assure) : ici, seulement son allure.
(function ccxStyles() {
  const st = document.createElement('style');
  st.textContent = `
    .nav-solo-btn.nav-cofidex { flex-direction: column; align-items: flex-start; gap: 3px; padding: 10px 12px;
      border: 1px solid color-mix(in srgb, #113679 35%, var(--border)); border-radius: 12px;
      background: color-mix(in srgb, #113679 8%, var(--surface)); }
    .nav-solo-btn.nav-cofidex:hover { background: color-mix(in srgb, #113679 16%, var(--surface)); border-color: #113679; }
    .nav-cofidex-logo { width: 116px; max-width: 100%; height: auto; display: block; }
    :root:not([data-theme="light"]) .nav-cofidex-logo, [data-theme="dark"] .nav-cofidex-logo { filter: brightness(0) invert(1); opacity: .92; }
    .nav-solo-btn.nav-cofidex .nav-lib { font-size: var(--t-xs, 11.5px); color: var(--text-muted); }
    .sidebar-repliee .nav-solo-btn.nav-cofidex, .sidebar.repliee .nav-solo-btn.nav-cofidex { align-items: center; padding: 8px 4px; }
    .sidebar-repliee .nav-cofidex-logo, .sidebar.repliee .nav-cofidex-logo { width: 34px; object-fit: cover; object-position: left; }
    .sidebar-repliee .nav-solo-btn.nav-cofidex .nav-lib, .sidebar.repliee .nav-solo-btn.nav-cofidex .nav-lib { display: none; }`;
  document.head.appendChild(st);
  const st2 = document.createElement('style');
  st2.textContent = `
    .ccx-doux { color: var(--text-muted); font-size: var(--t-xs, 11.5px); }
    .ccx-equipe-bloc { padding: 14px 16px; margin-bottom: 16px; }
    .ccx-bloc-tete { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
    .ccx-equipe { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; margin-bottom: 12px; }
    .ccx-personne { display: flex; gap: 10px; align-items: center; text-align: left; padding: 8px 10px; border: 1px solid var(--border); border-radius: 12px;
      background: var(--surface-alt); cursor: pointer; font: inherit; color: var(--text); }
    .ccx-personne:hover { border-color: var(--accent-border); }
    .ccx-personne.choisie { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
    .ccx-personne.sans { opacity: .5; cursor: not-allowed; }
    .ccx-avatar { flex: 0 0 34px; height: 34px; border-radius: 50%; background: #113679; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 12px; }
    .ccx-avatar.petit { flex-basis: 30px; height: 30px; }
    .ccx-qui { display: flex; flex-direction: column; min-width: 0; font-size: 12.5px; }
    .ccx-qui small, .ccx-qui em { color: var(--text-muted); font-size: 10.5px; font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ccx-coche { margin-left: auto; color: var(--accent); font-weight: 700; }
    .ccx-grille { display: grid; grid-template-columns: minmax(340px, 480px) 1fr; gap: 18px; align-items: start; }
    .ccx-form { display: flex; flex-direction: column; gap: 6px; padding: 16px; }
    .ccx-apercu-zone { position: sticky; top: 12px; background: #E5E7EB; border-radius: 16px; padding: 14px; }
    .ccx-barre { display: flex; gap: 8px; align-items: baseline; color: #1f2937; font-size: 12.5px; margin-bottom: 8px; }
    .ccx-barre small { color: #6b7280; }
    .ccx-fenetre { background: #fff; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.14); overflow: hidden; color: #111; }
    .ccx-tete { padding: 14px 18px 10px; border-bottom: 1px solid #e5e7eb; font-family: 'Segoe UI', Arial, sans-serif; }
    .ccx-objet-ap { font-size: 16px; font-weight: 600; margin-bottom: 9px; }
    .ccx-exp { display: flex; gap: 10px; align-items: center; font-size: 12.5px; }
    .ccx-pj-ap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .ccx-pj-ap span { border: 1px solid #d1d5db; border-radius: 8px; padding: 3px 8px; font-size: 11.5px; background: #f9fafb; }
    .ccx-fenetre iframe { border: 0; width: 100%; min-height: 560px; background: #fff; }
    .ccx-pj { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
    .ccx-doc { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: pointer; background: var(--surface); }
    .ccx-doc.fige { cursor: default; } .ccx-doc button { border: 0; background: none; color: var(--text-muted); cursor: pointer; }
    .ccx-doc small { color: var(--text-muted); margin-left: 4px; font-size: 10.5px; }
    .ccx-ajout { display: inline-block; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--accent); }
    @media (max-width: 1100px) { .ccx-grille { grid-template-columns: 1fr; } .ccx-apercu-zone { position: static; } }`;
  document.head.appendChild(st2);
})();
