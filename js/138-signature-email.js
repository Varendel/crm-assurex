// ═══ SIGNATURE OUTLOOK SUR LES E-MAILS DU CRM + COPIE DES DEMANDES D'OFFRE (22.09.2026) ═══════════
// « Est-ce que REX peut ajouter la signature aux courriels sortants ? » — « Le rendu est le même ? »
// — « Oui vas-y ; il faut que je sois en copie systématique des demandes d'offre. »
//
// L'API Outlook (sendMail) n'ajoute pas la signature : les e-mails du CRM partaient en texte brut.
// Désormais, un seul branchement sur fetch() traite TOUS les envois sendMail du CRM :
//   · le texte devient du HTML dans la police des e-mails Outlook ;
//   · la signature de l'expéditeur est ajoutée — la sienne, reprise TELLE QU'OUTLOOK L'ENVOIE
//     depuis son dernier e-mail envoyé (même code, mêmes images intégrées « cid: ») : le rendu est
//     identique ; la formule « Prénom Nom / Assurex Sàrl » qui terminait certains textes générés est
//     retirée pour ne pas signer deux fois ;
//   · demande d'offre : les agents marqués « copie_demandes_offre » sont mis en copie (Cc), quel que
//     soit l'expéditeur.
// Stockage : agents.signature_email_html / _images (chemins dans le stockage « documents », sous
// signatures/<agent>/) — dans le cloud, rien en local. « ↻ Reprendre ma signature Outlook » la
// recopie (à refaire si la signature change dans Outlook).

const _sig = { agent: null, t: 0, images: null, envoiDemande: false };

function sigEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function sigAgent(forcer) {
  if (!forcer && _sig.agent && Date.now() - _sig.t < 120000) return _sig.agent;
  const email = (typeof currentUser !== 'undefined' && currentUser && currentUser.email) || '';
  if (!email) return null;
  const r = await dbGet('agents', `email=eq.${encodeURIComponent(email)}&select=id,prenom,nom,email,signature_email_html,signature_email_images,signature_email_actif,signature_email_maj_le`);
  _sig.agent = Array.isArray(r) && r[0] ? r[0] : null; _sig.t = Date.now(); _sig.images = null;
  return _sig.agent;
}

async function sigCopiesDemandes() {
  const r = await dbGet('agents', 'copie_demandes_offre=is.true&select=email');
  return (Array.isArray(r) ? r : []).map(x => x.email).filter(Boolean);
}

// ── Reprendre la signature depuis Outlook ───────────────────────────────────────────────────────
async function sigReprendreOutlook() {
  if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) { showError('Connecte-toi à Outlook (bouton Microsoft) pour reprendre ta signature.'); return false; }
  const ag = await sigAgent(true);
  if (!ag) { showError('Fiche agent introuvable pour ton adresse.'); return false; }
  const H = { Authorization: `Bearer ${msalAccessToken}` };
  showError('⏳ Lecture de ta signature dans tes e-mails envoyés…');
  try {
    const lr = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=25&$orderby=sentDateTime desc&$select=id,subject,body,hasAttachments', { headers: H });
    if (!lr.ok) throw new Error('Outlook ' + lr.status);
    const msgs = (await lr.json()).value || [];
    let trouve = null;
    for (const m of msgs) {
      const html = m.body && m.body.contentType === 'html' ? m.body.content : '';
      if (!/_MailAutoSig/i.test(html)) continue;
      const frag = sigExtraire(html);
      if (frag) { trouve = { m, frag }; break; }
    }
    if (!trouve) throw new Error('aucun e-mail envoyé récent ne contient ta signature Outlook');
    // Images intégrées de la signature
    const cids = [...trouve.frag.html.matchAll(/src=["']cid:([^"']+)["']/gi)].map(x => x[1]);
    const images = [];
    if (cids.length) {
      const ar = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${trouve.m.id}/attachments?$select=id,name,contentType,contentId,isInline,size`, { headers: H });
      const atts = ar.ok ? ((await ar.json()).value || []) : [];
      const token = await getValidAccessToken() || SUPABASE_KEY;
      for (const cid of [...new Set(cids)]) {
        const a = atts.find(x => (x.contentId || '').replace(/[<>]/g, '') === cid) || atts.find(x => cid.startsWith((x.name || '') + '@'));
        if (!a) continue;
        const one = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${trouve.m.id}/attachments/${a.id}`, { headers: H }).then(r => r.json());
        const bin = atob(one.contentBytes || ''); const oct = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) oct[k] = bin.charCodeAt(k);
        const nom = (a.name || 'image').replace(/[^A-Za-z0-9._-]/g, '_');
        const path = `signatures/${ag.id}/${Date.now().toString(36)}-${nom}`;
        const up = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': a.contentType || 'application/octet-stream' }, body: new Blob([oct], { type: a.contentType || 'application/octet-stream' }) });
        if (up.ok) images.push({ cid, name: a.name || nom, type: a.contentType || 'application/octet-stream', path });
      }
    }
    const r = await dbPatch('agents', ag.id, { signature_email_html: trouve.frag.html, signature_email_images: images, signature_email_actif: true, signature_email_maj_le: new Date().toISOString() });
    if (r && r.error) throw new Error(errMsg(r));
    await sigAgent(true);
    showError(`✓ Signature reprise d'Outlook (${images.length} image${images.length > 1 ? 's' : ''}) — elle sera ajoutée aux e-mails du CRM.`);
    document.querySelectorAll('.sig-ligne').forEach(l => sigLigneMaj(l));
    return true;
  } catch (e) { showError('Signature non reprise : ' + (e.message || e)); return false; }
}

// Le bloc signature d'un e-mail Outlook : de l'élément qui porte _MailAutoSig jusqu'au séparateur
// de réponse (« De : … ») ; les styles Outlook (MsoNormal…) sont gardés pour un rendu identique.
function sigExtraire(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ancre = doc.querySelector('a[name="_MailAutoSig"], [name="_MailAutoSig"]');
  if (!ancre) return null;
  const racine = doc.querySelector('.WordSection1') || doc.body;
  let bloc = ancre; while (bloc.parentElement && bloc.parentElement !== racine) bloc = bloc.parentElement;
  const parties = [];
  for (let n = bloc; n; n = n.nextElementSibling) {
    const txt = (n.textContent || '').trim();
    const sep = /border-top:\s*solid/i.test(n.getAttribute && (n.getAttribute('style') || '')) || /^(De|From|Von)\s*:/.test(txt);
    if (sep || n.querySelector && n.querySelector('[style*="border-top:solid"], [style*="border-top: solid"]')) break;
    parties.push(n.outerHTML);
  }
  if (!parties.length) return null;
  const style = [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n');
  return { html: `${style ? `<style>${style}</style>` : ''}<div class="WordSection1">${parties.join('')}</div>` };
}

async function sigImages(ag) {
  if (_sig.images) return _sig.images;
  const token = await getValidAccessToken() || SUPABASE_KEY;
  const out = [];
  for (const im of (ag.signature_email_images || [])) {
    try {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/documents/${im.path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
      if (!r.ok) continue;
      const b = await r.blob();
      const b64 = await new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = ko; fr.readAsDataURL(b); });
      out.push({ '@odata.type': '#microsoft.graph.fileAttachment', name: im.name, contentType: im.type, contentId: im.cid, isInline: true, contentBytes: b64 });
    } catch (e) { /* image manquante : la signature part sans elle */ }
  }
  _sig.images = out;
  return out;
}

// Texte brut → HTML (police des e-mails Outlook) ; retire la formule finale « Prénom Nom / Assurex »
function sigTexteVersHtml(texte, ag) {
  let paras = String(texte || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  const nom = [ag.prenom, ag.nom].filter(Boolean).join(' ').trim().toLowerCase();
  const der = (paras[paras.length - 1] || '').trim().toLowerCase();
  if (der && der.length < 90 && ((nom && der.includes(nom)) || /assurex s[àa]rl|meilleures salutations|^cordialement/.test(der))) paras.pop();
  const corps = paras.map(p => `<p style="margin:0 0 11pt">${sigEsc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="font-family:Aptos,Calibri,Arial,sans-serif;font-size:11pt;color:#000">${corps}</div>`;
}

// ── Le branchement unique sur les envois ─────────────────────────────────────────────────────────
(function sigBrancher() {
  const f0 = window.fetch;
  window.fetch = async function (url, opts) {
    if (!/graph\.microsoft\.com\/v1\.0\/me\/sendMail$/.test(String(url)) || !opts || typeof opts.body !== 'string') return f0.apply(window, arguments);
    try {
      const b = JSON.parse(opts.body); const m = b && b.message;
      if (m) {
        // 1. Copie systématique des demandes d'offre
        if (_sig.envoiDemande) {
          const deja = new Set([...(m.toRecipients || []), ...(m.ccRecipients || [])].map(x => (x.emailAddress && x.emailAddress.address || '').toLowerCase()));
          const cc = (await sigCopiesDemandes()).filter(e => !deja.has(e.toLowerCase()));
          if (cc.length) m.ccRecipients = [...(m.ccRecipients || []), ...cc.map(address => ({ emailAddress: { address } }))];
        }
        // 2. Signature
        const ag = window._sigSans ? null : await sigAgent();
        if (ag && ag.signature_email_actif && ag.signature_email_html && m.body) {
          const deja = /_MailAutoSig|Agrément FINMA/i.test(m.body.content || '');
          if (!deja) {
            const corps = m.body.contentType === 'html' ? m.body.content : sigTexteVersHtml(m.body.content, ag);
            m.body = { contentType: 'html', content: `<html><head><meta charset="utf-8"></head><body>${corps}<br>${ag.signature_email_html}</body></html>` };
            const imgs = await sigImages(ag);
            if (imgs.length) m.attachments = [...(m.attachments || []), ...imgs];
          }
        }
        opts = { ...opts, body: JSON.stringify(b) };
      }
    } catch (e) { console.warn('Signature / copie non appliquées', e); }
    return f0.call(window, url, opts);
  };

  // Demande d'offre : on sait que l'envoi en cours en est une (pour la copie).
  if (typeof envoyerApercuEmailDemandeOffreViaOutlook === 'function') {
    const env = envoyerApercuEmailDemandeOffreViaOutlook;
    window.envoyerApercuEmailDemandeOffreViaOutlook = async function () {
      window._sigSans = !!document.getElementById('sig-sans')?.checked;
      _sig.envoiDemande = true;
      try { return await env.apply(this, arguments); } finally { _sig.envoiDemande = false; window._sigSans = false; }
    };
  }
  // Dans l'aperçu : la ligne signature + copie, au-dessus des boutons
  if (typeof ouvrirApercuEmailDemandeOffre === 'function') {
    const ouvrir = ouvrirApercuEmailDemandeOffre;
    window.ouvrirApercuEmailDemandeOffre = function () {
      const r = ouvrir.apply(this, arguments);
      const actions = document.querySelector('#modal-apercu-email-do .btn-save')?.parentElement;
      if (actions && !document.getElementById('sig-ligne-do')) {
        actions.insertAdjacentHTML('beforebegin', '<div class="sig-ligne" id="sig-ligne-do">✍️ Signature…</div>');
        sigLigneMaj(document.getElementById('sig-ligne-do'), true);
      }
      return r;
    };
  }

  const st = document.createElement('style');
  st.textContent = `
    .sig-ligne { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 12px; color: var(--text-muted); margin: 0 0 12px; }
    .sig-ligne b { color: var(--text); }
    .sig-ligne button { background: none; border: 0; padding: 0; color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; }
    .sig-ligne .sig-ko { color: var(--c-alerte-texte, #B45309); }`;
  document.head.appendChild(st);
})();

async function sigLigneMaj(el, avecCopie) {
  if (!el) return;
  const ag = await sigAgent().catch(() => null);
  const ok = ag && ag.signature_email_html;
  const copies = avecCopie ? await sigCopiesDemandes().catch(() => []) : [];
  el.innerHTML = `${ok ? `<span>✍️ <b>Ta signature Outlook</b> sera ajoutée${ag.signature_email_maj_le ? ` (reprise le ${fmtDate(String(ag.signature_email_maj_le).slice(0, 10))})` : ''}</span>
      <label><input type="checkbox" id="sig-sans"/> sans signature</label>`
    : '<span class="sig-ko">✍️ Pas encore de signature enregistrée</span>'}
    <button type="button" onclick="sigReprendreOutlook()">↻ ${ok ? 'Mettre à jour' : 'Reprendre ma signature Outlook'}</button>
    ${copies.length ? `<span>📋 En copie : <b>${copies.map(sigEsc).join(', ')}</b></span>` : ''}`;
}
