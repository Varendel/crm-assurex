// ═══ ÉCRIRE À COFIDEX AU SUJET D'UN CLIENT (22.09.2026) ═════════════════════════════════════════
// « Ajoute l'équipe Cofidex SA avec les collaborateurs… le rôle est destinataires. Il faut un bouton
// Cofidex sur les clients pour leur envoyer un mail. Je pensais à lier une fonction pour envoyer des
// courriels liés au client. »
//
// Un bouton « 🏢 Cofidex » sur la fiche client ouvre un courriel DÉJÀ RENSEIGNÉ avec ce que l'autre
// côté a besoin de savoir : qui est le client, son IDE, ses contrats, ses échéances — plus les
// documents du client qu'on veut joindre. On choisit les destinataires dans l'équipe (table
// equipe_cofidex), on relit, on envoie. Jamais d'envoi sans relecture ni sans clic.
//
// L'expéditeur, la signature et la mise en forme viennent du branchement unique (js/138) : ce
// courriel-ci part donc comme les autres, signé, depuis le compte Outlook connecté.

const _ccx = { equipe: null, t: 0, client: null, pj: [] };

function ccxEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ccxNom(c) { return !c ? '' : (typeof estEntreprise === 'function' && estEntreprise(c)) ? (c.nom || '') : [c.prenom, c.nom].filter(Boolean).join(' '); }

async function ccxEquipe(forcer) {
  if (!forcer && _ccx.equipe && Date.now() - _ccx.t < 300000) return _ccx.equipe;
  const r = await dbGet('equipe_cofidex', 'actif=is.true&select=id,prenom,nom,email,fonction,email_a_verifier,ordre&order=ordre');
  _ccx.equipe = Array.isArray(r) ? r : [];
  _ccx.t = Date.now();
  return _ccx.equipe;
}

// Les modèles : ce qu'on écrit vraiment à la fiduciaire à propos d'un client.
const CCX_MODELES = [
  { id: 'presentation', label: 'Présenter le client', objet: c => `Nouveau client — ${c.nom}`,
    corps: (c, d) => `Bonjour,\n\nJe vous présente ${c.nom}${c.ide ? ` (${c.ide})` : ''}, que je suis côté assurances.\n\n${d.resume}\n\nJe reste à disposition pour toute question.` },
  { id: 'documents', label: 'Transmettre des documents', objet: c => `${c.nom} — documents`,
    corps: (c, d) => `Bonjour,\n\nVous trouverez en pièce jointe les documents de ${c.nom}${c.ide ? ` (${c.ide})` : ''}.\n\n${d.resume}\n\nBonne réception.` },
  { id: 'question', label: 'Poser une question', objet: c => `${c.nom} — question`,
    corps: (c) => `Bonjour,\n\nAu sujet de ${c.nom}${c.ide ? ` (${c.ide})` : ''} :\n\n[ta question]\n\nMerci d’avance pour ton retour.` },
  { id: 'salaires', label: 'Salaires / RH', objet: c => `${c.nom} — salaires et assurances du personnel`,
    corps: (c, d) => `Bonjour,\n\nPour ${c.nom}${c.ide ? ` (${c.ide})` : ''}, voici la situation côté assurances du personnel :\n\n${d.personnel || '—'}\n\nPouvez-vous me confirmer les masses salariales à jour ?` },
  { id: 'libre', label: 'Message libre', objet: c => `${c.nom}`, corps: () => 'Bonjour,\n\n' },
];

function ccxContexte(client) {
  const contrats = (typeof allContrats !== 'undefined' ? allContrats : [])
    .filter(x => x.client_id === client.id && !['résilié', 'annulé', 'mandat_resilie'].includes(x.statut || ''));
  const ligne = ct => `- ${ct.produit || 'Contrat'}${ct.compagnie ? ' · ' + ct.compagnie : ''}${ct.numero_police ? ' · police ' + ct.numero_police : ''}${ct.prime_annuelle ? ' · CHF ' + fmtCHF(Math.round(ct.prime_annuelle)) + '/an' : ''}${ct.date_echeance ? ' · échéance ' + fmtDate(String(ct.date_echeance).slice(0, 10)) : ''}`;
  const perso = contrats.filter(ct => /laa|lpp|perte de gain|maladie|accident/i.test(ct.produit || ''));
  return {
    resume: contrats.length ? `Contrats en cours :\n${contrats.map(ligne).join('\n')}` : 'Aucun contrat enregistré à ce jour dans le CRM.',
    personnel: perso.length ? perso.map(ligne).join('\n') : '',
    contrats,
  };
}

async function ccxOuvrir(clientId) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === clientId);
  if (!c) return;
  const equipe = await ccxEquipe();
  _ccx.client = { id: c.id, nom: ccxNom(c), ide: c.ide || c.numero_ide || '' };
  _ccx.pj = [];
  const modele = CCX_MODELES[0];
  creerModale('modal-ccx', `
    <div class="opx-modale ccx" role="dialog" aria-modal="true" aria-labelledby="ccx-titre">
      <h3 id="ccx-titre">🏢 Écrire à Cofidex — ${ccxEsc(_ccx.client.nom)}</h3>
      <p class="opx-modale-sous">Le message est pré-rempli avec la situation du client. Relis, ajuste, choisis les pièces jointes, puis envoie.</p>
      <label class="form-label">Destinataires</label>
      <div class="ccx-equipe">${equipe.length ? equipe.map((p, i) => `
        <label class="ccx-personne ${p.email ? '' : 'sans'}" title="${p.email ? ccxEsc(p.email) : 'Adresse e-mail à renseigner'}">
          <input type="checkbox" value="${ccxEsc(p.email || '')}" ${p.email ? '' : 'disabled'} onchange="ccxMaj()"/>
          <span><b>${ccxEsc([p.prenom, p.nom].filter(Boolean).join(' '))}</b><small>${ccxEsc(p.fonction || '')}${p.email_a_verifier && p.email ? ' · adresse à vérifier' : ''}${p.email ? '' : ' · sans adresse'}</small></span>
        </label>`).join('') : '<div class="dbx-vide-petit">Aucun destinataire enregistré.</div>'}
      </div>
      <div class="form-field"><label class="form-label" for="ccx-autres">Autres destinataires <small>(séparés par des virgules)</small></label>
        <input class="form-input" id="ccx-autres" placeholder="prenom@cofidex.ch" oninput="ccxMaj()"/></div>
      <div class="form-field"><label class="form-label" for="ccx-modele">Motif</label>
        <select class="form-select" id="ccx-modele" onchange="ccxAppliquerModele(this.value)">${CCX_MODELES.map(m => `<option value="${m.id}">${m.label}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-label" for="ccx-objet">Objet</label><input class="form-input" id="ccx-objet" value="${ccxEsc(modele.objet(_ccx.client))}"/></div>
      <div class="form-field"><label class="form-label" for="ccx-corps">Message</label>
        <textarea class="form-input" id="ccx-corps" rows="12">${ccxEsc(modele.corps(_ccx.client, ccxContexte(c)))}</textarea></div>
      <div class="form-field"><label class="form-label">Pièces jointes</label>
        <div id="ccx-pj" class="ccx-pj"><span class="dbx-vide-petit">Chargement des documents du client…</span></div>
        <label class="ccx-ajout">+ Fichier de l’ordinateur<input type="file" multiple hidden onchange="ccxAjouterFichiers(this)"/></label></div>
      <div id="ccx-etat" class="ccx-etat"></div>
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-ccx').remove()">Fermer</button>
        <button type="button" class="btn-save" id="ccx-envoyer" onclick="ccxEnvoyer()">📨 Envoyer via Outlook</button>
      </div>
    </div>`, { padding: '16px' });
  ccxChargerDocuments(c);
  ccxMaj();
}

function ccxAppliquerModele(id) {
  const m = CCX_MODELES.find(x => x.id === id) || CCX_MODELES[0];
  const c = (allClients || []).find(x => x.id === _ccx.client.id);
  const o = document.getElementById('ccx-objet'), t = document.getElementById('ccx-corps');
  if (o) o.value = m.objet(_ccx.client);
  if (t) t.value = m.corps(_ccx.client, ccxContexte(c));
}

// Les documents déjà rangés sur le client : mandat signé et offres/polices archivées.
async function ccxChargerDocuments(c) {
  const z = document.getElementById('ccx-pj');
  const items = [];
  try {
    if (typeof pjeMandatDuClient === 'function') {
      const m = await dbGet('mandats_signes', `client_id=eq.${c.id}&signe=is.true&archive=is.false&select=id&limit=1`);
      if (Array.isArray(m) && m[0]) items.push({ cle: 'mandat', nom: 'Mandat de courtage signé', source: 'mandat' });
    }
    const docs = await dbGet('documents_compagnies', `client_id=eq.${c.id}&select=id,titre,nom_fichier,chemin,type&order=created_at.desc&limit=25`);
    (Array.isArray(docs) ? docs : []).forEach(d => { if (d.chemin) items.push({ cle: d.id, nom: d.nom_fichier || d.titre || 'Document', source: d.type || 'document', path: d.chemin }); });
  } catch (e) { /* liste facultative */ }
  _ccx.docs = items;
  if (!z) return;
  z.innerHTML = items.length ? items.map((it, i) => `<label class="ccx-doc"><input type="checkbox" data-doc="${i}" onchange="ccxMaj()"/><span>📄 ${ccxEsc(it.nom)}<small>${ccxEsc(it.source)}</small></span></label>`).join('')
    : '<span class="dbx-vide-petit">Aucun document rangé sur ce client.</span>';
}

function ccxAjouterFichiers(input) {
  [...(input.files || [])].forEach(f => _ccx.pj.push(f));
  input.value = '';
  const z = document.getElementById('ccx-pj');
  if (z && _ccx.pj.length) z.insertAdjacentHTML('beforeend', _ccx.pj.slice(-1).map(f => `<span class="ccx-doc fige">💻 ${ccxEsc(f.name)}</span>`).join(''));
  ccxMaj();
}

function ccxDestinataires() {
  const coches = [...document.querySelectorAll('.ccx-equipe input:checked')].map(i => i.value).filter(Boolean);
  const libres = (document.getElementById('ccx-autres')?.value || '').split(/[,;\s]+/).filter(x => /@/.test(x));
  return [...new Set([...coches, ...libres])];
}

function ccxMaj() {
  const dest = ccxDestinataires();
  const nbDocs = document.querySelectorAll('#ccx-pj input:checked').length + _ccx.pj.length;
  const e = document.getElementById('ccx-etat');
  if (e) e.textContent = `${dest.length ? dest.join(', ') : 'Aucun destinataire choisi'}${nbDocs ? ` · ${nbDocs} pièce${nbDocs > 1 ? 's' : ''} jointe${nbDocs > 1 ? 's' : ''}` : ''}`;
  const b = document.getElementById('ccx-envoyer');
  if (b) b.disabled = !dest.length;
}

async function ccxEnvoyer() {
  const dest = ccxDestinataires();
  if (!dest.length) return;
  const sujet = document.getElementById('ccx-objet')?.value || '';
  const corps = document.getElementById('ccx-corps')?.value || '';
  const b = document.getElementById('ccx-envoyer');
  if (!confirm(`Envoyer ce courriel à ${dest.join(', ')} ?`)) return;
  if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) { showError('Connecte-toi à Outlook (bouton Microsoft) pour envoyer.'); return; }
  if (b) b.disabled = true;
  try {
    const pieces = [];
    const b64 = blob => new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = ko; fr.readAsDataURL(blob); });
    for (const el of document.querySelectorAll('#ccx-pj input:checked')) {
      const it = _ccx.docs[Number(el.dataset.doc)];
      if (!it) continue;
      const blob = it.source === 'mandat' && typeof pjeMandatDuClient === 'function'
        ? (await pjeMandatDuClient(_ccx.client.id))?.blob : await pjeTelecharger(it.path);
      if (blob) pieces.push({ '@odata.type': '#microsoft.graph.fileAttachment', name: it.nom.replace(/[\\/:*?"<>|]/g, '-') + (/\.\w{2,4}$/.test(it.nom) ? '' : '.pdf'), contentType: blob.type || 'application/pdf', contentBytes: await b64(blob) });
    }
    for (const f of _ccx.pj) pieces.push({ '@odata.type': '#microsoft.graph.fileAttachment', name: f.name, contentType: f.type || 'application/octet-stream', contentBytes: await b64(f) });
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST', headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { subject: sujet, body: { contentType: 'text', content: corps }, toRecipients: dest.map(address => ({ emailAddress: { address } })), ...(pieces.length ? { attachments: pieces } : {}) }, saveToSentItems: true }),
    });
    if (!r.ok) { showError(r.status === 401 ? 'Session Outlook expirée — reconnecte-toi puis réessaie.' : 'Échec de l’envoi via Outlook.'); if (b) b.disabled = false; return; }
    document.getElementById('modal-ccx')?.remove();
    showError(`✓ Courriel envoyé à ${dest.join(', ')}.`);
    if (typeof ajouterActiviteClient === 'function') await ajouterActiviteClient(_ccx.client.id, 'email', `Courriel à Cofidex (${dest.join(', ')}) : ${sujet}`);
  } catch (e) { showError('Envoi impossible : ' + (e.message || e)); if (b) b.disabled = false; }
}

// Le bouton sur la fiche client, à côté de « Rendez-vous ».
(function ccxBrancher() {
  let t = null;
  const poser = () => {
    const zone = document.querySelector('#main-content .fcx-actions-principales');
    if (!zone || zone.querySelector('.ccx-btn')) return;
    const m = (document.querySelector('#main-content .fcx-actions button[onclick*="ouvrirModaleNouveauRdv("]')?.getAttribute('onclick') || '').match(/ouvrirModaleNouveauRdv\('([^']+)'\)/);
    if (!m) return;
    zone.insertAdjacentHTML('beforeend', `<button type="button" class="fcx-btn-verre ccx-btn" onclick="ccxOuvrir('${m[1]}')" title="Écrire à l’équipe Cofidex au sujet de ce client">🏢 Cofidex</button>`);
  };
  const go = () => { const main = document.getElementById('main-content'); if (main) new MutationObserver(() => { clearTimeout(t); t = setTimeout(poser, 120); }).observe(main, { childList: true, subtree: true }); poser(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();

  const st = document.createElement('style');
  st.textContent = `
    .ccx { width: min(680px, 95vw); }
    .ccx-equipe { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 6px; margin-bottom: 12px; }
    .ccx-personne { display: flex; gap: 8px; align-items: flex-start; padding: 7px 9px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-alt); cursor: pointer; font-size: 12.5px; }
    .ccx-personne.sans { opacity: .55; cursor: not-allowed; }
    .ccx-personne small { display: block; color: var(--text-muted); font-size: 10.5px; }
    .ccx-pj { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
    .ccx-doc { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: pointer; background: var(--surface); }
    .ccx-doc.fige { cursor: default; }
    .ccx-doc small { color: var(--text-muted); margin-left: 4px; font-size: 10.5px; }
    .ccx-ajout { display: inline-block; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--accent); }
    .ccx-etat { font-size: 11.5px; color: var(--text-muted); margin: 8px 0; }`;
  document.head.appendChild(st);
})();
