// ═══ OPPORTUNITÉ : CHERCHER L'OFFRE DANS OUTLOOK (22.09.2026) ═══════════════════════════════════
// « Ajoute une fonction chercher l'offre sur l'opportunité dans Outlook : si elle existe, ça met
// dans note et documents client l'offre. »
//
// Le CRM lit déjà la boîte (Mail.Read, js/03 ; même mécanisme que les décomptes, js/06). Depuis
// la fiche opportunité, « 📬 Chercher l'offre dans Outlook » :
//   1. cherche les e-mails des 6 derniers mois qui parlent du client (son nom), seuls ou avec une
//      des compagnies sollicitées, et qui portent un PDF ;
//   2. met en tête ceux qui ressemblent à une offre (offre, Offerte, proposition, devis, Angebot…)
//      et devine la compagnie (expéditeur, objet, nom du fichier) ;
//   3. un clic sur « Joindre » : le PDF est archivé sur l'offre de cette compagnie (vaut réception,
//      comme « 📎 Joindre l'offre »), une NOTE est posée dans le journal du client, et l'offre
//      rejoint les DOCUMENTS du client (même fichier, pas de doublon dans le stockage).
// Rien ne part sans ce clic.

const OXO_MOTS_OFFRE = /offre|offerte|proposition|devis|angebot|cotation|tarif|projet de (police|contrat)/i;
window._oxo = window._oxo || { oppId: null, pieces: [] };

function oxoEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function oxoNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function oxoNomClient(o) {
  const c = o && o.client_id ? (allClients || []).find(x => x.id === o.client_id) : null;
  if (c) return typeof estEntreprise === 'function' && estEntreprise(c) ? (c.nom || '') : `${c.prenom || ''} ${c.nom || ''}`.trim();
  return (o && o.prospect_nom) || '';
}

// Les mots qui identifient le client dans une recherche : sans « Sàrl », « SA »…, 3 lettres minimum.
function oxoMotsClient(nom) {
  return oxoNorm(nom).replace(/[^a-z0-9 ]+/g, ' ').split(' ')
    .filter(m => m.length >= 3 && !['sarl', 'sagl', 'gmbh', 'les', 'des', 'and', 'the'].includes(m)).slice(0, 3);
}

async function oxoGraph(url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${msalAccessToken}` } });
  if (r.status === 401) throw new Error('session Outlook expirée — reconnecte-toi puis réessaie');
  if (!r.ok) throw new Error('Outlook ' + r.status);
  return r.json();
}

async function oxoChercher(oppId) {
  const o = (allOpportunites || []).find(x => x.id === oppId);
  if (!o) return;
  if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) { showError('Connecte Outlook (bouton Microsoft du menu) pour chercher l’offre.'); return; }
  window._oxo = { oppId, pieces: [] };
  const nom = oxoNomClient(o);
  const mots = oxoMotsClient(nom);
  const entrees = typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : [];
  const compagnies = [...new Set(entrees.map(x => x.e && x.e.compagnie).filter(Boolean))];
  creerModale('modal-oxo', `<div class="opx-modale oxo" role="dialog" aria-labelledby="oxo-titre">
    <h3 id="oxo-titre">📬 Offres trouvées dans Outlook</h3>
    <p class="oxo-sous">Client : <b>${oxoEsc(nom || '—')}</b>${compagnies.length ? ` · compagnies sollicitées : ${compagnies.map(oxoEsc).join(', ')}` : ''}</p>
    <div id="oxo-liste"><div class="loader">Recherche dans la boîte…</div></div>
    <div class="opx-modale-actions"><button type="button" class="btn-secondary" onclick="document.getElementById('modal-oxo').remove()">Fermer</button></div>
  </div>`);
  const zone = () => document.getElementById('oxo-liste');
  if (!mots.length) { zone().innerHTML = '<div class="dbx-vide-petit">Pas de nom de client exploitable pour la recherche.</div>'; return; }
  try {
    // Recherches KQL (le moteur d'Outlook) : le client seul, puis client + chaque compagnie.
    const requetes = [mots.join(' '), ...compagnies.slice(0, 5).map(c => `${mots[0]} ${oxoNorm(c).split(/\s+/)[0]}`)];
    const vus = new Map();
    for (const q of requetes) {
      const url = `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(q)}"&$top=40&$select=id,subject,from,receivedDateTime,hasAttachments`;
      const j = await oxoGraph(url);
      (j.value || []).forEach(m => { if (m.hasAttachments && !vus.has(m.id)) vus.set(m.id, m); });
    }
    const limite = Date.now() - 183 * 864e5;
    const msgs = [...vus.values()].filter(m => new Date(m.receivedDateTime).getTime() >= limite)
      .sort((a, b) => String(b.receivedDateTime).localeCompare(String(a.receivedDateTime))).slice(0, 30);
    const pieces = [];
    for (const m of msgs) {
      const j = await oxoGraph(`https://graph.microsoft.com/v1.0/me/messages/${m.id}/attachments?$select=id,name,contentType,size`).catch(() => null);
      ((j && j.value) || []).filter(a => /\.pdf$/i.test(a.name || '') || /pdf/i.test(a.contentType || '')).forEach(a => {
        const de = (m.from && m.from.emailAddress) || {};
        const texte = `${a.name} ${m.subject || ''}`;
        const cie = compagnies.find(c => { const k = oxoNorm(c).split(/\s+/)[0]; return k.length >= 3 && (oxoNorm(texte).includes(k) || oxoNorm(de.address).includes(k) || oxoNorm(de.name).includes(k)); }) || '';
        pieces.push({ mid: m.id, aid: a.id, nom: a.name, taille: a.size, sujet: m.subject || '', de: de.name || de.address || '', date: m.receivedDateTime,
          offre: OXO_MOTS_OFFRE.test(texte), compagnie: cie });
      });
    }
    // Les offres probables d'abord, puis les plus récentes.
    pieces.sort((a, b) => (b.offre - a.offre) || (!!b.compagnie - !!a.compagnie) || String(b.date).localeCompare(String(a.date)));
    window._oxo.pieces = pieces;
    oxoRendre();
  } catch (e) { if (zone()) zone().innerHTML = `<div class="dbx-vide-petit">Recherche impossible : ${oxoEsc(e.message)}</div>`; }
}

function oxoRendre() {
  const zone = document.getElementById('oxo-liste');
  if (!zone) return;
  const { oppId, pieces } = window._oxo;
  const entrees = typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : [];
  if (!pieces.length) { zone.innerHTML = '<div class="dbx-vide-petit">Aucun PDF trouvé dans les e-mails des six derniers mois qui parlent de ce client.</div>'; return; }
  zone.innerHTML = `<div class="oxo-liste">${pieces.map((p, i) => {
    const choix = entrees.map(({ d, e, idx }) => `<option value="${d.id}|${idx}" ${p.compagnie && e.compagnie === p.compagnie ? 'selected' : ''}>${oxoEsc(e.compagnie || '—')}${e.offre_path ? ' (a déjà un PDF)' : ''}</option>`).join('');
    return `<div class="oxo-piece ${p.offre ? 'probable' : ''} ${p.fait ? 'fait' : ''}">
      <span class="oxo-ico" aria-hidden="true">📄</span>
      <div class="oxo-corps"><b>${oxoEsc(p.nom)}</b>${p.offre ? '<em>offre probable</em>' : ''}
        <small>${fmtDate(p.date)} · ${oxoEsc(p.de)} · ${oxoEsc(p.sujet)}</small></div>
      ${p.fait ? '<span class="oxo-ok">✓ jointe</span>' : `<div class="oxo-actions">
        <select id="oxo-cible-${i}" aria-label="Compagnie de l’offre">${choix}<option value="nouvelle" ${!entrees.length || !p.compagnie ? 'selected' : ''}>+ Autre compagnie…</option></select>
        <button type="button" class="btn-secondary" onclick="oxoVoir(${i})" title="Ouvrir le PDF">👁</button>
        <button type="button" class="btn-save" onclick="oxoJoindre(${i})">Joindre</button></div>`}
    </div>`;
  }).join('')}</div>`;
}

async function oxoFichier(p) {
  const a = await oxoGraph(`https://graph.microsoft.com/v1.0/me/messages/${p.mid}/attachments/${p.aid}`);
  const bin = atob(a.contentBytes || '');
  const octets = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) octets[k] = bin.charCodeAt(k);
  return new File([octets], p.nom, { type: 'application/pdf' });
}

async function oxoVoir(i) {
  const p = window._oxo.pieces[i];
  try { const f = await oxoFichier(p); window.open(URL.createObjectURL(f), '_blank'); }
  catch (e) { showError('PDF inaccessible : ' + e.message); }
}

async function oxoJoindre(i) {
  const { oppId, pieces } = window._oxo;
  const p = pieces[i];
  const o = (allOpportunites || []).find(x => x.id === oppId);
  const cible = document.getElementById('oxo-cible-' + i)?.value || 'nouvelle';
  let fichier;
  try { fichier = await oxoFichier(p); } catch (e) { showError('PDF inaccessible : ' + e.message); return; }
  if (fichier.size > 10 * 1024 * 1024) { showError('PDF trop lourd (plus de 10 Mo) : joins-le à la main.'); return; }

  if (cible === 'nouvelle') {
    // Compagnie pas encore sur l'opportunité : la saisie d'offre habituelle, PDF déjà choisi.
    // Note et documents suivent à l'enregistrement (voir oxoApresSaisie).
    document.getElementById('modal-oxo')?.remove();
    opSaisirOffre(oppId, null, null);
    setTimeout(() => {
      const inp = document.getElementById('of-fichier');
      if (inp) { const dt = new DataTransfer(); dt.items.add(fichier); inp.files = dt.files; }
      window._oxoEnAttente = { oppId, p };
    }, 80);
    return;
  }
  const [demandeId, idxTxt] = cible.split('|'); const idx = Number(idxTxt);
  showError('⏳ Archivage de l’offre…');
  await opJoindreOffre(oppId, demandeId, idx, { files: [fichier] });
  const rows = await dbGet('demandes_offre', `id=eq.${demandeId}&select=compagnies_envoi`).catch(() => []);
  const e = Array.isArray(rows) && rows[0] ? (rows[0].compagnies_envoi || [])[idx] : null;
  if (!e || !e.offre_path) { showError('L’offre n’a pas pu être archivée.'); return; }
  await oxoNoteEtDocument(o, e.compagnie, e.offre_path, p);
  p.fait = true; oxoRendre();
  showError(`✓ Offre ${e.compagnie} jointe à l’opportunité, notée et classée dans les documents du client.`);
}

// La note dans le journal du client et la ligne dans ses documents (même fichier que l'offre).
async function oxoNoteEtDocument(o, compagnie, chemin, p) {
  if (!o || !o.client_id) return;   // prospect sans fiche : l'offre reste sur l'opportunité
  const auteur = typeof currentUser !== 'undefined' && currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : null;
  await dbPost('activites_client', { client_id: o.client_id, type: 'note', auteur,
    contenu: `📬 Offre ${compagnie || ''} trouvée dans Outlook et jointe à l’opportunité « ${o.titre || ''} » — ${p.nom} (e-mail du ${fmtDate(p.date)} : ${p.sujet || 'sans objet'})` }).catch(() => {});
  await dbPost('documents_compagnies', { client_id: o.client_id, compagnie: compagnie || null, type: 'offre',
    titre: `Offre ${compagnie || ''} — ${p.nom.replace(/\.pdf$/i, '')}`.trim(), chemin, nom_fichier: p.nom,
    source: 'outlook', visible_client: false, depose_par: auteur }).catch(() => {});
  if (typeof logAction === 'function') logAction('offre_outlook', 'opportunites', o.id, `${compagnie} — ${p.nom}`);
}

// Offre d'une nouvelle compagnie : une fois la saisie enregistrée, on retrouve son PDF et on
// pose la note et le document.
(function oxoBrancher() {
  if (typeof opEnregistrerOffre === 'function') {
    const origine = opEnregistrerOffre;
    window.opEnregistrerOffre = async function (oppId) {
      const attente = window._oxoEnAttente && window._oxoEnAttente.oppId === oppId ? window._oxoEnAttente : null;
      const r = await origine.apply(this, arguments);
      if (attente && !document.getElementById('modal-offre-recue')) {
        window._oxoEnAttente = null;
        const o = (allOpportunites || []).find(x => x.id === oppId);
        const e = (typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : []).map(x => x.e).find(x => x.offre_nom === attente.p.nom && x.offre_path);
        if (e) await oxoNoteEtDocument(o, e.compagnie, e.offre_path, attente.p);
      }
      return r;
    };
  }
  // Le bouton, à côté de « 📎 Uploader une offre ».
  if (typeof htmlOffresOpportunite === 'function') {
    const rendu = htmlOffresOpportunite;
    window.htmlOffresOpportunite = function (oppId) {
      return rendu.apply(this, arguments).replace('<div class="opx-offres-actions">',
        `<div class="opx-offres-actions"><button type="button" class="btn-secondary oxo-bouton" onclick="oxoChercher('${oppId}')" title="Chercher dans ta boîte Outlook le PDF de l’offre envoyé par la compagnie">📬 Chercher l’offre dans Outlook</button>`);
    };
  }
  const st = document.createElement('style');
  st.textContent = `
    .oxo { width: min(760px, 94vw); }
    .oxo-sous { margin: 0 0 12px; font-size: var(--t-s); color: var(--text-muted); }
    .oxo-liste { display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow: auto; }
    .oxo-piece { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); }
    .oxo-piece.probable { border-color: color-mix(in srgb, #16A34A 45%, var(--border)); background: color-mix(in srgb, #16A34A 6%, var(--surface)); }
    .oxo-piece.fait { opacity: .65; }
    .oxo-ico { font-size: 20px; }
    .oxo-corps { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .oxo-corps b { font-size: var(--t-s); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .oxo-corps em { font-style: normal; font-size: var(--t-xs); font-weight: 600; color: #16A34A; }
    .oxo-corps small { font-size: var(--t-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .oxo-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
    .oxo-actions select { max-width: 170px; background: var(--surface-alt); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 5px 7px; font: inherit; font-size: var(--t-s); }
    .oxo-actions .btn-save, .oxo-actions .btn-secondary { padding: 6px 12px; font-size: var(--t-s); }
    .oxo-ok { font-size: var(--t-s); font-weight: 600; color: #16A34A; }
    @media (max-width: 620px) { .oxo-piece { flex-wrap: wrap; } .oxo-actions { width: 100%; justify-content: flex-end; } }`;
  document.head.appendChild(st);
})();
