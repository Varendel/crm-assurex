// ═══ APERÇU DE L'E-MAIL EN DIRECT, COMME LES COURRIERS (22.09.2026) ══════════════════════════════
// « J'aimerais un module comme pour les courriers où je vois l'aperçu, c'est génial. »
//
// La fenêtre d'envoi de la demande d'offre (js/07, enrichie par js/136 pièces jointes et js/138
// signature) devient un module en deux colonnes : à gauche ce qu'on écrit et choisit, à droite
// l'e-mail tel que le destinataire le recevra — en-tête façon Outlook (De, À, Cc, Objet, pièces
// jointes), texte dans la police Outlook, signature avec ses images, rendu ordinateur ou téléphone.
// L'aperçu se construit avec les mêmes fonctions que l'envoi (sigTexteVersHtml, signature et
// images de js/138) : ce qu'on voit est ce qui part. Rien n'est envoyé sans le bouton habituel.

const _aem = { mode: 'ordi', t: null, cc: null };

function aemEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function aemDonnees() {
  const ctx = window._apercuEmailDemandeOffre || {};
  const sujet = document.getElementById('apercu-email-sujet')?.value || '';
  const corps = document.getElementById('apercu-email-corps')?.value || '';
  const ag = typeof sigAgent === 'function' ? await sigAgent().catch(() => null) : null;
  if (_aem.cc === null) _aem.cc = typeof sigCopiesDemandes === 'function' ? await sigCopiesDemandes().catch(() => []) : [];
  const to = (ctx.emails || []);
  const cc = _aem.cc.filter(e => !to.map(x => x.toLowerCase()).includes(e.toLowerCase()));
  const pj = typeof _pje !== 'undefined' ? [..._pje.items.filter(x => x.coche).map(x => ({ nom: x.nom, taille: null })), ..._pje.locaux.filter(x => x.coche).map(f => ({ nom: f.file.name, taille: f.file.size }))] : [];
  const sans = !!document.getElementById('sig-sans')?.checked;
  return { ctx, sujet, corps, ag, to, cc, pj, sans };
}

async function aemCorpsHtml(d) {
  const ag = d.ag || { prenom: '', nom: '' };
  const avecSig = !d.sans && d.ag && d.ag.signature_email_actif && d.ag.signature_email_html;
  // Même transformation que l'envoi (js/138) : formule finale retirée seulement si la signature suit.
  const texte = typeof sigTexteVersHtml === 'function' && avecSig ? sigTexteVersHtml(d.corps, ag)
    : `<div style="font-family:Aptos,Calibri,Arial,sans-serif;font-size:11pt;color:#000">${String(d.corps).split(/\n{2,}/).map(p => `<p style="margin:0 0 11pt">${aemEsc(p).replace(/\n/g, '<br>')}</p>`).join('')}</div>`;
  let sig = '';
  if (avecSig) {
    sig = d.ag.signature_email_html;
    const imgs = typeof sigImages === 'function' ? await sigImages(d.ag).catch(() => []) : [];
    imgs.forEach(im => { sig = sig.split(`cid:${im.contentId}`).join(`data:${im.contentType};base64,${im.contentBytes}`); });
  } else if (!d.sans) {
    sig = `<div style="margin-top:14px;padding:12px 14px;border:1px dashed #9aa7b8;border-radius:8px;font:12px Arial,sans-serif;color:#56627a">✍️ Ta signature Outlook apparaîtra ici — clique « ↻ Reprendre ma signature Outlook » à gauche.</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:18px 20px;background:#fff;color:#000;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${texte}${sig ? '<br>' + sig : ''}</body></html>`;
}

async function aemRendre() {
  const z = document.getElementById('aem-apercu');
  if (!z) return;
  const d = await aemDonnees();
  // L'adresse expéditeur reste toujours visible : celle du compte Outlook qui enverra réellement.
  const cpt = typeof sigCompteOutlook === 'function' ? await sigCompteOutlook().catch(() => null) : null;
  const moi = (cpt && cpt.nom) || (d.ag && [d.ag.prenom, d.ag.nom].filter(Boolean).join(' ')) || (typeof currentUser !== 'undefined' && currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : '');
  const emailCrm = (d.ag && d.ag.email) || (typeof currentUser !== 'undefined' && currentUser && currentUser.email) || '';
  const email = (cpt && cpt.adresse) || emailCrm;
  const autre = cpt && cpt.adresse && emailCrm && cpt.adresse.toLowerCase() !== emailCrm.toLowerCase();
  const init = moi.split(/\s+/).map(x => x[0] || '').join('').slice(0, 2).toUpperCase() || '✉';
  const puces = arr => arr.map(e => `<span class="aem-puce">${aemEsc(e)}</span>`).join('');
  z.querySelector('.aem-tete').innerHTML = `
    <div class="aem-objet">${aemEsc(d.sujet) || '<i>(sans objet)</i>'}</div>
    <div class="aem-exp"><span class="aem-avatar">${aemEsc(init)}</span>
      <div><div><b>${aemEsc(moi)}</b> <span class="aem-de${autre ? ' aem-de-autre' : ''}" title="Compte Outlook qui envoie l’e-mail">${aemEsc(email) || 'compte Outlook non connecté'}</span>${autre ? ' <b class="aem-de-autre">⚠️ pas l’adresse de ta session CRM</b>' : ''}</div>
        <div class="aem-lignes"><span>À</span> ${d.to.length ? puces(d.to) : '<i>aucun destinataire</i>'}</div>
        ${d.cc.length ? `<div class="aem-lignes"><span>Cci</span> ${puces(d.cc)}<em style="font-size:10.5px;color:var(--text-muted);font-style:normal">copie cachée — la compagnie ne la voit pas</em></div>` : ''}</div></div>
    ${d.pj.length ? `<div class="aem-pj">${d.pj.map(p => `<span class="aem-fichier">📄 ${aemEsc(p.nom)}${p.taille ? ` <small>${typeof pjeTaille === 'function' ? pjeTaille(p.taille) : ''}</small>` : ''}</span>`).join('')}</div>` : ''}`;
  const f = z.querySelector('iframe');
  const html = await aemCorpsHtml(d);
  if (f && f.srcdoc !== html) f.srcdoc = html;
}
function aemPlus() { clearTimeout(_aem.t); _aem.t = setTimeout(() => aemRendre().catch(() => {}), 180); }
function aemMode(m) {
  _aem.mode = m; const z = document.getElementById('aem-apercu'); if (z) z.dataset.mode = m;
  document.querySelectorAll('.aem-modes button').forEach(b => b.classList.toggle('actif', b.dataset.m === m));
}

(function aemBrancher() {
  if (typeof ouvrirApercuEmailDemandeOffre !== 'function') return;
  const ouvrir = ouvrirApercuEmailDemandeOffre;
  window.ouvrirApercuEmailDemandeOffre = function () {
    const r = ouvrir.apply(this, arguments);
    _aem.cc = null;
    const modal = document.getElementById('modal-apercu-email-do');
    const boite = modal && modal.firstElementChild;
    const actions = boite && boite.querySelector('.btn-save')?.parentElement;
    if (!boite || !actions || boite.querySelector('.aem-grille')) return r;
    boite.classList.add('aem-boite'); boite.removeAttribute('style');
    const titre = boite.firstElementChild;
    const gauche = document.createElement('div'); gauche.className = 'aem-gauche';
    [...boite.children].filter(n => n !== titre && n !== actions).forEach(n => gauche.appendChild(n));
    const droite = document.createElement('section'); droite.className = 'aem-droite'; droite.setAttribute('aria-label', 'Aperçu de l’e-mail');
    droite.innerHTML = `<div class="aem-barre"><b>Aperçu</b> <small>tel que le destinataire le recevra</small>
        <span class="aem-modes"><button type="button" data-m="ordi" class="actif" onclick="aemMode('ordi')" title="Ordinateur">💻</button><button type="button" data-m="tel" onclick="aemMode('tel')" title="Téléphone">📱</button></span></div>
      <div id="aem-apercu" class="aem-apercu" data-mode="${_aem.mode}"><div class="aem-fenetre"><div class="aem-tete"></div><iframe title="Contenu de l’e-mail" sandbox="allow-same-origin"></iframe></div></div>`;
    const grille = document.createElement('div'); grille.className = 'aem-grille';
    grille.append(gauche, droite);
    titre.after(grille);
    aemMode(_aem.mode);
    boite.addEventListener('input', aemPlus); boite.addEventListener('change', aemPlus);
    // les listes (pièces jointes, signature) se remplissent après coup : on suit
    new MutationObserver(aemPlus).observe(gauche, { childList: true, subtree: true });
    aemRendre().catch(() => {});
    return r;
  };
  // Après « ↻ Reprendre ma signature Outlook » : l'aperçu se met à jour.
  if (typeof sigReprendreOutlook === 'function') {
    const rep = sigReprendreOutlook;
    window.sigReprendreOutlook = async function () { const ok = await rep.apply(this, arguments); aemPlus(); return ok; };
  }

  const st = document.createElement('style');
  st.textContent = `
    .aem-boite { background: var(--surface); border-radius: 16px; padding: 18px; width: min(1320px, 97vw); max-height: 94vh; display: flex; flex-direction: column; gap: 10px; }
    .aem-grille { display: grid; grid-template-columns: minmax(340px, 460px) 1fr; gap: 16px; min-height: 0; flex: 1; overflow: hidden; }
    .aem-gauche { overflow: auto; padding-right: 4px; display: flex; flex-direction: column; }
    .aem-gauche #apercu-email-corps { min-height: 240px; }
    .aem-droite { display: flex; flex-direction: column; min-height: 0; background: #E5E7EB; border-radius: 14px; padding: 12px; }
    .aem-barre { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #1f2937; margin-bottom: 8px; }
    .aem-barre small { color: #6b7280; }
    .aem-modes { margin-left: auto; display: inline-flex; background: #fff; border-radius: 999px; padding: 2px; }
    .aem-modes button { border: 0; background: none; padding: 3px 10px; border-radius: 999px; cursor: pointer; font-size: 14px; }
    .aem-modes button.actif { background: #113679; }
    .aem-apercu { flex: 1; min-height: 0; overflow: auto; display: flex; justify-content: center; }
    .aem-fenetre { width: 100%; max-width: 860px; background: #fff; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.14); display: flex; flex-direction: column; overflow: hidden; color: #111; }
    .aem-apercu[data-mode="tel"] .aem-fenetre { max-width: 390px; border-radius: 26px; border: 10px solid #111; }
    .aem-tete { padding: 14px 18px 10px; border-bottom: 1px solid #e5e7eb; font-family: 'Segoe UI', Arial, sans-serif; }
    .aem-objet { font-size: 17px; font-weight: 600; margin-bottom: 10px; }
    .aem-exp { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; }
    .aem-exp small { color: #6b7280; }
    .aem-avatar { flex: 0 0 34px; height: 34px; border-radius: 50%; background: #113679; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 12px; }
    .aem-lignes { margin-top: 3px; color: #374151; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .aem-lignes > span:first-child { color: #6b7280; min-width: 20px; }
    .aem-puce { background: #eef2f7; border-radius: 999px; padding: 1px 8px; }
    .aem-de { background: #eef2f7; border-radius: 999px; padding: 1px 8px; color: #374151; }
    .aem-de-autre { background: #FEF3C7; color: #92400E; }
    .aem-pj { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .aem-fichier { border: 1px solid #d1d5db; border-radius: 8px; padding: 4px 9px; font-size: 12px; background: #f9fafb; }
    .aem-fichier small { color: #6b7280; }
    .aem-fenetre iframe { border: 0; width: 100%; flex: 1; min-height: 520px; background: #fff; }
    @media (max-width: 900px) { .aem-grille { grid-template-columns: 1fr; overflow: auto; } .aem-fenetre iframe { min-height: 420px; } }`;
  document.head.appendChild(st);
})();
