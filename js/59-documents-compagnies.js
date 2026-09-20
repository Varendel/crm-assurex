// ═══ DOCUMENTS REÇUS DES COMPAGNIES (20.09.2026) ═══════════════════════════════════════════════
// Tout ce que les compagnies envoient — polices, factures, décomptes de commissions, rappels de
// prime, avenants — atterrit ici, puis apparaît sur la fiche du client concerné.
//
// Deux portes d'entrée, la même table `documents_compagnies` derrière :
//   1. Le dépôt manuel : on glisse les PDF reçus par courrier, par e-mail ou téléchargés depuis un
//      portail compagnie. Le numéro de police est deviné depuis le nom du fichier quand il y est.
//   2. EcoHub : les documents transmis par le flux, déposés avec la même structure.
//
// Rattachement : un document rattaché à un contrat suit le client de ce contrat. Un document dont
// on n'a pas trouvé la police reste « à rattacher » — visible dans le CRM, jamais côté client.
// Un document n'apparaît dans REX CLOUD que si quelqu'un l'a explicitement rendu visible : un
// document mal rattaché ne doit jamais se retrouver chez le mauvais client.

const DCX_TYPES = {
  police:     { label: 'Police',      icone: '📄' },
  facture:    { label: 'Facture de prime',    icone: '🧾' },
  commission: { label: 'Décompte de commissions', icone: '💰' },
  rappel:     { label: 'Rappel de prime',     icone: '⏰' },
  avenant:    { label: 'Avenant',     icone: '✏️' },
  autre:      { label: 'Autre document',      icone: '📎' },
};

// Formats de numéro de police rencontrés chez les compagnies suisses :
//   La Mobilière  G-1846-4747 / P-2606-0139   Allianz  T308424160   CAP  Z753916287
//
// Pas de \b en fin de motif : le souligné est un caractère de mot, si bien que
// « G-1561-1996_facture.pdf » n'était pas reconnu et le document restait à rattacher
// (constaté sur le premier import réel, 20.09.2026). Une négation de chiffre suffit et
// couvre tous les noms de fichiers.
const DCX_MOTIFS_POLICE = [
  /([A-Z])-?(\d{4})-?(\d{4})(?!\d)/,     // G-1846-4747, G18466747
  /([TZ]\d{9})(?!\d)/,    // T308424160
  /(\d{3}-\d{2}-\d{3})(?!\d)/,    // 833-28-491
];

window._dcx = window._dcx || { docs: [], filtre: { texte: '', type: '', etat: '' }, chargement: false };

function dcxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function dcxCle(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// Rattachement : on compare les numéros sans ponctuation, et on accepte qu'un numéro du CRM
// commence par celui du document (« G-1820-0743 - VD 183 261 » porte la plaque en plus).
function dcxContratParPolice(police) {
  const cle = dcxCle(police);
  if (cle.length < 6) return null;
  const contrats = typeof allContrats !== 'undefined' ? allContrats : [];
  return contrats.find(c => { const k = dcxCle(c.numero_police); return k && (k === cle || k.startsWith(cle) || cle.startsWith(k)); }) || null;
}

function dcxPoliceDansNom(nom) {
  const n = String(nom || '').toUpperCase();
  for (const motif of DCX_MOTIFS_POLICE) {
    const m = n.match(motif);
    if (m) return m[0];
  }
  return '';
}

// Type deviné d'après le nom du fichier — corrigeable à la main ensuite.
function dcxTypeDansNom(nom) {
  const n = String(nom || '').toLowerCase();
  if (/rappel|reminder|sommation|mahnung/.test(n)) return 'rappel';
  if (/commission|courtage|decompte|abrechnung/.test(n)) return 'commission';
  if (/facture|invoice|billing|prime|rechnung/.test(n)) return 'facture';
  if (/avenant|modification|nachtrag/.test(n)) return 'avenant';
  if (/police|policy|contrat|vertrag/.test(n)) return 'police';
  return 'autre';
}

function dcxNomClient(clientId) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === clientId);
  if (!c) return '';
  return (c.prenom ? `${c.prenom} ${c.nom}` : c.nom || '').trim();
}

async function dcxCharger() {
  try {
    window._dcx.docs = await dbGet('documents_compagnies', 'select=*&order=date_document.desc.nullslast,created_at.desc') || [];
  } catch (e) { window._dcx.docs = []; }
}

// ── La page ─────────────────────────────────────────────────────────────────────────────────────
function viewDocumentsCompagnies() {
  if (!window._dcx.chargement) {
    window._dcx.chargement = true;
    dcxCharger().then(() => { window._dcx.chargement = false; if (currentView === 'documents-compagnies') dcxRendre(); });
  }
  return `<div id="dcx-page">${dcxContenu()}</div>`;
}

function dcxRendre() {
  const el = document.getElementById('dcx-page');
  if (el) el.innerHTML = dcxContenu();
}

function dcxContenu() {
  const docs = window._dcx.docs;
  const f = window._dcx.filtre;
  const auj = new Date().toISOString().slice(0, 7);
  const aRattacher = docs.filter(d => !d.contrat_id && !d.client_id).length;
  const visibles = docs.filter(d => d.visible_client).length;
  const ceMois = docs.filter(d => String(d.created_at || '').slice(0, 7) === auj).length;

  const liste = docs.filter(d => {
    if (f.type && d.type !== f.type) return false;
    if (f.etat === 'a-rattacher' && (d.contrat_id || d.client_id)) return false;
    if (f.etat === 'visible' && !d.visible_client) return false;
    if (f.etat === 'masque' && d.visible_client) return false;
    if (f.texte) {
      const t = f.texte.toLowerCase();
      const champ = `${d.numero_police || ''} ${d.compagnie || ''} ${d.titre || ''} ${d.nom_fichier || ''} ${dcxNomClient(d.client_id)}`.toLowerCase();
      if (!champ.includes(t)) return false;
    }
    return true;
  });

  const kpi = (label, valeur, sous, ton) => `<div class="dbx-kpi ${ton || ''}"><span class="dbx-kpi-label">${label}</span><span class="dbx-kpi-valeur">${valeur}</span><span class="dbx-kpi-sous">${sous}</span></div>`;

  return `
  <div class="page-header">
    <h2>📥 Documents reçus des compagnies</h2>
    <p class="page-sub">Polices, factures, décomptes et rappels — classés par client, et publiables dans son espace REX CLOUD.</p>
  </div>

  <div class="dbx-kpis">
    ${kpi('Documents', docs.length, docs.length ? 'archivés dans le CRM' : 'aucun pour l’instant')}
    ${kpi('À rattacher', aRattacher, aRattacher ? 'police non reconnue' : 'tout est rattaché', aRattacher ? 'cf-alerte' : '')}
    ${kpi('Visibles par le client', visibles, 'publiés dans REX CLOUD')}
    ${kpi('Ce mois', ceMois, 'déposés depuis le 1er')}
  </div>

  <section class="dcx-depot" id="dcx-depot"
    ondragover="event.preventDefault(); this.classList.add('survol')"
    ondragleave="this.classList.remove('survol')"
    ondrop="dcxDeposer(event)">
    <div class="dcx-depot-icone">📎</div>
    <div class="dcx-depot-texte">
      <strong>Glisse ici les documents reçus</strong>
      <span>PDF, images ou XML. Le numéro de police est lu dans le nom du fichier quand il y figure, et le document part directement sur la bonne fiche client.</span>
    </div>
    <button type="button" class="btn-save dcx-btn-fichier" onclick="dcxParcourir()">Choisir des fichiers</button>
  </section>
  <div id="dcx-progression"></div>

  <div class="dcx-filtres">
    <input class="form-input" type="search" placeholder="Rechercher un client, une police, une compagnie…"
      value="${dcxEsc(f.texte)}" oninput="window._dcx.filtre.texte=this.value; dcxRendre(); document.querySelector('.dcx-filtres input[type=search]').focus()"/>
    <select class="form-input" onchange="window._dcx.filtre.type=this.value; dcxRendre()">
      <option value="">Tous les types</option>
      ${Object.entries(DCX_TYPES).map(([k, v]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${v.icone} ${v.label}</option>`).join('')}
    </select>
    <select class="form-input" onchange="window._dcx.filtre.etat=this.value; dcxRendre()">
      <option value="">Tous les états</option>
      <option value="a-rattacher" ${f.etat === 'a-rattacher' ? 'selected' : ''}>À rattacher</option>
      <option value="visible" ${f.etat === 'visible' ? 'selected' : ''}>Visibles par le client</option>
      <option value="masque" ${f.etat === 'masque' ? 'selected' : ''}>Non publiés</option>
    </select>
  </div>

  ${liste.length ? `<div class="dcx-liste">${liste.map(dcxLigne).join('')}</div>`
    : `<div class="dbx-vide">${typeof rexBanquierHtml === 'function' ? rexBanquierHtml({ taille: 140 }) : ''}
<strong>${docs.length ? 'Aucun document ne correspond au filtre.' : 'Aucun document pour l’instant.'}</strong>
<span>${docs.length ? 'Change le filtre pour revoir la liste.' : 'Dépose les PDF reçus des compagnies ci-dessus : ils seront classés par client et consultables sur leur fiche.'}</span></div>`}`;
}

function dcxLigne(d) {
  const t = DCX_TYPES[d.type] || DCX_TYPES.autre;
  const nom = dcxNomClient(d.client_id);
  const rattache = !!(d.contrat_id || d.client_id);
  const montant = d.montant != null && d.montant !== '' ? `CHF ${fmtCHF(Number(d.montant))}` : '';
  const periode = d.periode_du || d.periode_au ? `${d.periode_du ? fmtDate(d.periode_du) : '?'} → ${d.periode_au ? fmtDate(d.periode_au) : '?'}` : '';
  return `<div class="dcx-ligne ${rattache ? '' : 'orphelin'}">
    <span class="dcx-type" title="${dcxEsc(t.label)}">${t.icone}</span>
    <div class="dcx-principal">
      <div class="dcx-titre">${dcxEsc(d.titre || d.nom_fichier || t.label)}</div>
      <div class="dcx-meta">
${d.compagnie ? `<span>${dcxEsc(d.compagnie)}</span>` : ''}
${d.numero_police ? `<span class="dcx-police">${dcxEsc(d.numero_police)}</span>` : ''}
${d.date_document ? `<span>${fmtDate(d.date_document)}</span>` : ''}
${periode ? `<span>${periode}</span>` : ''}
${montant ? `<span class="dcx-montant">${montant}</span>` : ''}
<span class="dcx-source">${d.source === 'ecohub' ? 'EcoHub' : 'dépôt manuel'}</span>
      </div>
    </div>
    <div class="dcx-client">
      ${rattache && d.client_id
? `<a href="?client=${d.client_id}" onclick="return irVersClient(event, '${d.client_id}')">${dcxEsc(nom || 'Fiche client')}</a>`
: `<button type="button" class="dcx-rattacher" onclick="dcxOuvrirRattachement('${d.id}')">Rattacher…</button>`}
    </div>
    <div class="dcx-actions">
      <button type="button" class="dcx-loupe" onclick="dcxApercu('${dcxEsc(d.chemin)}', '${dcxEsc(d.titre || d.nom_fichier || '')}')" title="Aperçu rapide">🔍</button>
      <button type="button" class="dcx-publier ${d.visible_client ? 'on' : ''}" ${rattache ? '' : 'disabled'}
title="${d.visible_client ? 'Ce document est visible dans l’espace du client — cliquer pour le retirer' : rattache ? 'Rendre ce document visible dans l’espace du client' : 'Rattache d’abord le document à un client'}"
onclick="dcxBasculerVisible('${d.id}', ${d.visible_client ? 'false' : 'true'})">${d.visible_client ? '👁 Visible' : 'Publier'}</button>
      <button type="button" class="btn-secondary" onclick="dcxOuvrir('${dcxEsc(d.chemin)}')">Ouvrir</button>
    </div>
  </div>`;
}

// ── Dépôt ───────────────────────────────────────────────────────────────────────────────────────
// Le sélecteur de fichiers est créé à la volée plutôt que posé en HTML dans un <label> : un
// <input hidden> imbriqué ne réagissait pas au clic dans tous les navigateurs, et le bouton
// « Déposer » de la fiche restait mort (corrigé le 20.09.2026).
function dcxParcourir(clientId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.pdf,.png,.jpg,.jpeg,.xml';
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    const fichiers = [...input.files];
    input.remove();
    if (!fichiers.length) return;
    if (clientId) dcxDeposerSurFiche(clientId, fichiers); else dcxImporter(fichiers);
  });
  input.click();
}

function dcxDeposer(ev) {
  ev.preventDefault();
  document.getElementById('dcx-depot')?.classList.remove('survol');
  const fichiers = ev.dataTransfer && ev.dataTransfer.files;
  if (fichiers && fichiers.length) dcxImporter(fichiers);
}

async function dcxImporter(fichiers) {
  const liste = [...(fichiers || [])];
  if (!liste.length) return;
  const zone = document.getElementById('dcx-progression');
  const resultats = [];
  for (let i = 0; i < liste.length; i++) {
    const f = liste[i];
    if (zone) zone.innerHTML = `<div class="dcx-progress">⏳ ${i + 1} / ${liste.length} — ${dcxEsc(f.name)}</div>`;
    resultats.push(await dcxDeposerUnFichier(f));
  }
  await dcxCharger();
  dcxRendre();
  const ok = resultats.filter(r => r.ok).length;
  const rattaches = resultats.filter(r => r.ok && r.rattache).length;
  const echecs = resultats.filter(r => !r.ok);
  const z = document.getElementById('dcx-progression');
  if (z) z.innerHTML = `<div class="dcx-progress ${echecs.length ? 'alerte' : 'fini'}">
    ✓ ${ok} document(s) déposé(s), dont ${rattaches} rattaché(s) automatiquement.
    ${echecs.length ? `<br>⚠️ ${echecs.length} échec(s) : ${echecs.map(e => `${dcxEsc(e.nom)} (${dcxEsc(e.erreur)})`).join(', ')}` : ''}
  </div>`;
}

async function dcxDeposerUnFichier(fichier) {
  const nom = fichier.name || 'document';
  try {
    if (fichier.size > 20 * 1024 * 1024) return { ok: false, nom, erreur: 'plus de 20 Mo' };
    const police = dcxPoliceDansNom(nom);
    const contrat = police ? dcxContratParPolice(police) : null;
    const sain = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 110);
    const dossier = contrat ? `contrats/${contrat.id}` : police ? `polices/${dcxCle(police)}` : 'a-rattacher';
    const chemin = `compagnies/${dossier}/${Date.now()}-${sain}`;

    const token = await getValidAccessToken() || SUPABASE_KEY;
    const envoi = async (methode) => fetch(`${SUPABASE_URL}/storage/v1/object/documents/${chemin}`, {
      method: methode,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': fichier.type || 'application/octet-stream' },
      body: fichier,
    });
    let r = await envoi('POST');
    if (!r.ok) r = await envoi('PUT');
    if (!r.ok) return { ok: false, nom, erreur: 'upload refusé (' + r.status + ')' };

    const ligne = {
      client_id: contrat ? contrat.client_id : null,
      contrat_id: contrat ? contrat.id : null,
      compagnie: contrat ? contrat.compagnie : null,
      numero_police: police || (contrat ? contrat.numero_police : null),
      type: dcxTypeDansNom(nom),
      titre: nom.replace(/\.[a-z0-9]+$/i, ''),
      chemin, nom_fichier: nom,
      source: 'depot_manuel',
      visible_client: false,
      depose_par: (typeof currentUser !== 'undefined' && currentUser) ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : null,
    };
    const res = await dbPost('documents_compagnies', ligne);
    if (res && res.error) return { ok: false, nom, erreur: errMsg(res) };
    const id = Array.isArray(res) && res[0] ? res[0].id : null;
    if (typeof logAction === 'function') logAction('depot_document_compagnie', 'documents_compagnies', id, nom);
    return { ok: true, nom, id, rattache: !!contrat };
  } catch (e) {
    return { ok: false, nom, erreur: String(e.message || e).slice(0, 60) };
  }
}

// ── Rattachement manuel ─────────────────────────────────────────────────────────────────────────
function dcxOuvrirRattachement(id) {
  const d = window._dcx.docs.find(x => x.id === id);
  if (!d) return;
  const contrats = (typeof allContrats !== 'undefined' ? allContrats : []).slice()
    .sort((a, b) => (dcxNomClient(a.client_id) || '').localeCompare(dcxNomClient(b.client_id) || ''));
  creerModale('modal-dcx-rattacher', `
    <div class="opx-modale" role="dialog" aria-modal="true" aria-labelledby="dcx-rat-titre">
      <h3 id="dcx-rat-titre">🔗 Rattacher le document</h3>
      <div class="opx-modale-sous">${dcxEsc(d.titre || d.nom_fichier || '')}</div>
      <div class="form-field"><label class="form-label" for="dcx-contrat">Contrat concerné</label>
<select class="form-input" id="dcx-contrat">
  <option value="">— choisir —</option>
  ${contrats.map(c => `<option value="${c.id}">${dcxEsc(dcxNomClient(c.client_id))} · ${dcxEsc(c.compagnie)} · ${dcxEsc(c.produit)}${c.numero_police ? ' · ' + dcxEsc(c.numero_police) : ''}</option>`).join('')}
</select></div>
      <div class="form-field"><label class="form-label" for="dcx-type">Type de document</label>
<select class="form-input" id="dcx-type">
  ${Object.entries(DCX_TYPES).map(([k, v]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${v.icone} ${v.label}</option>`).join('')}
</select></div>
      <div class="ec-note">Rattacher ne publie rien : le document reste invisible pour le client tant que tu ne l’as pas explicitement publié (bouton 👁️).</div>
      <div class="opx-modale-actions">
<button type="button" class="btn-secondary" onclick="document.getElementById('modal-dcx-rattacher').remove()">Annuler</button>
<button type="button" class="btn-save" onclick="dcxRattacher('${id}')">✓ Rattacher</button>
      </div>
    </div>`, { padding: '16px' });
}

async function dcxRattacher(id) {
  const contratId = document.getElementById('dcx-contrat')?.value || '';
  const type = document.getElementById('dcx-type')?.value || 'autre';
  if (!contratId) { showError('Choisis le contrat concerné.'); return; }
  const c = (typeof allContrats !== 'undefined' ? allContrats : []).find(x => x.id === contratId);
  if (!c) { showError('Contrat introuvable.'); return; }
  const r = await dbPatch('documents_compagnies', id, {
    contrat_id: c.id, client_id: c.client_id, compagnie: c.compagnie,
    numero_police: c.numero_police || null, type,
  });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  document.getElementById('modal-dcx-rattacher')?.remove();
  await dcxCharger();
  dcxRendre();
  showError('✓ Document rattaché à ' + dcxNomClient(c.client_id) + '.');
}

// ── Publication côté client ─────────────────────────────────────────────────────────────────────
async function dcxBasculerVisible(id, visible) {
  const v = visible === true || visible === 'true';
  const d = window._dcx.docs.find(x => x.id === id);
  if (v && d && !d.client_id) { showError('Rattache d’abord le document à un client.'); return; }
  if (v && !confirm(`Publier ce document dans l’espace REX CLOUD de ${dcxNomClient(d.client_id) || 'ce client'} ?\n\nIl le verra dès sa prochaine connexion.`)) return;
  const r = await dbPatch('documents_compagnies', id, { visible_client: v });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  if (typeof logAction === 'function') logAction(v ? 'publier_document_client' : 'retirer_document_client', 'documents_compagnies', id, null);
  await dcxCharger();
  dcxRendre();
}

// Ouverture par URL signée de courte durée — le bucket reste privé.
async function dcxOuvrir(chemin) {
  if (typeof ouvrirPieceJointe === 'function') return ouvrirPieceJointe(chemin);
  showError('Ouverture indisponible.');
}

// ── Aperçu rapide (20.09.2026) ──────────────────────────────────────────────────────────────────
// Demande de Jonathan : pouvoir jeter un œil sans ouvrir un onglet. Le document s'affiche dans une
// fenêtre, au-dessus de la liste, et on enchaîne. L'URL signée dure une minute et n'est jamais
// écrite ailleurs que dans le cadre : le bucket reste privé.
async function dcxApercu(chemin, titre) {
  const nom = titre || 'Document';
  creerModale('modal-dcx-apercu', `
    <div class="dcx-apercu" role="dialog" aria-modal="true" aria-label="Aperçu du document">
      <header>
        <span class="dcx-apercu-titre">${dcxEsc(nom)}</span>
        <button type="button" class="btn-secondary" onclick="dcxOuvrir('${dcxEsc(chemin)}')">↗ Ouvrir en grand</button>
        <button type="button" class="dcx-apercu-fermer" onclick="document.getElementById('modal-dcx-apercu').remove()" aria-label="Fermer">×</button>
      </header>
      <div class="dcx-apercu-corps" id="dcx-apercu-corps"><div class="loader">Chargement du document…</div></div>
    </div>`, { padding: '0' });
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/documents/${chemin}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 }),
    });
    const zone = document.getElementById('dcx-apercu-corps');
    if (!zone) return;
    if (!r.ok) { zone.innerHTML = '<div class="dcx-apercu-vide">Document inaccessible.</div>'; return; }
    const data = await r.json();
    const url = `${SUPABASE_URL}/storage/v1${data.signedURL}`;
    const estImage = /\.(png|jpe?g|webp|gif)$/i.test(chemin);
    zone.innerHTML = estImage
      ? `<img src="${url}" alt="${dcxEsc(nom)}"/>`
      : `<iframe src="${url}#toolbar=0&navpanes=0" title="${dcxEsc(nom)}"></iframe>
         <div class="dcx-apercu-secours">Le document ne s’affiche pas ? <button type="button" onclick="dcxOuvrir('${dcxEsc(chemin)}')">Ouvrir dans un onglet</button></div>`;
  } catch (e) {
    const zone = document.getElementById('dcx-apercu-corps');
    if (zone) zone.innerHTML = '<div class="dcx-apercu-vide">Erreur : ' + dcxEsc(e.message) + '</div>';
  }
}

// ── LE CENTRE DOCUMENTAIRE DE LA FICHE CLIENT (20.09.2026) ──────────────────────────────────────
// Refonte demandée par Jonathan une fois EcoHub opérationnel. Avant, les documents d'un client
// étaient éparpillés : les mandats dans l'onglet Documents, les polices accrochées à chaque ligne
// de contrat, les pièces jointes au fond des tâches, et les factures des compagnies nulle part.
// Quand un client appelle et demande « vous avez ma police ? », il ne faut pas chercher à quatre
// endroits.
//
// Tout est donc réuni ici, groupé par origine, avec la même ligne pour tous :
//   Mandats   ce que le client a signé
//   Polices   les contrats, PDF accroché au contrat
//   Reçu des compagnies   EcoHub et dépôts manuels — factures, rappels, décomptes
//   Pièces jointes    ce qui pend à une tâche
//
// Une seule règle transverse : la colonne « visible par le client » n'existe que pour les
// documents reçus des compagnies, et elle reste fermée par défaut. Publier est une décision.

const DCX_ORIGINES = [
  { cle: 'mandat',    titre: 'Mandats et documents signés', icone: '🖊️' },
  { cle: 'police',    titre: 'Polices',     icone: '📄' },
  { cle: 'compagnie', titre: 'Reçu des compagnies', icone: '📥' },
  { cle: 'tache',     titre: 'Pièces jointes des tâches',   icone: '📎' },
];

// Rassemble en une liste unique tout ce qui existe pour ce client, quelle qu'en soit la source.
function dcxToutDocument(clientId, contrats, mandats, rappels) {
  const out = [];
  for (const m of mandats || []) {
    const n = typeof mdxNatureDocument === 'function' ? mdxNatureDocument(m) : { titre: 'Mandat', icone: '🖊️', type: '' };
    out.push({ origine: 'mandat', icone: n.icone, titre: n.titre, sous: `${fmtDate(m.created_at)}${n.type ? ' · ' + n.type : ''}`,
      etat: m.signe ? 'signé' : 'non signé', ok: !!m.signe, ouvrir: `voirMandatSauvegarde('${m.id}')` });
  }
  for (const ct of (contrats || []).filter(x => x.police_url)) {
    out.push({ origine: 'police', icone: '📄', titre: `${ct.compagnie} · ${ct.produit}`,
      sous: `${ct.numero_police || 'sans n° de police'}${ct.date_debut ? ' · dès le ' + fmtDate(ct.date_debut) : ''}`,
      etat: ct.police_nom || '',
      ouvrir: `ouvrirPieceJointe('${dcxEsc(ct.police_url)}')`,
      apercu: `dcxApercu('${dcxEsc(ct.police_url)}', '${dcxEsc(`${ct.compagnie} · ${ct.produit}`)}')` });
  }
  for (const d of window._dcx.docs.filter(x => x.client_id === clientId)) {
    const t = DCX_TYPES[d.type] || DCX_TYPES.autre;
    out.push({ origine: 'compagnie', icone: t.icone, titre: d.titre || d.nom_fichier || t.label,
      sous: [t.label, d.compagnie, d.numero_police, d.date_document ? fmtDate(d.date_document) : '',
     d.montant != null && d.montant !== '' ? 'CHF ' + fmtCHF(Number(d.montant)) : ''].filter(Boolean).join(' · '),
      etat: d.source === 'ecohub' ? 'EcoHub' : 'déposé à la main',
      publiable: { id: d.id, visible: !!d.visible_client },
      ouvrir: `dcxOuvrir('${dcxEsc(d.chemin)}')`,
      apercu: `dcxApercu('${dcxEsc(d.chemin)}', '${dcxEsc(d.titre || d.nom_fichier || '')}')` });
  }
  for (const r of (rappels || []).filter(x => x.piece_jointe_path || x.piece_jointe_url)) {
    out.push({ origine: 'tache', icone: '📎', titre: r.piece_jointe_nom || r.titre || 'Pièce jointe',
      sous: `${r.titre || ''}${r.date_echeance ? ' · ' + fmtDate(r.date_echeance) : ''}`,
      ouvrir: r.piece_jointe_path ? `ouvrirPieceJointe('${dcxEsc(r.piece_jointe_path)}')` : `window.open('${dcxEsc(r.piece_jointe_url || '')}','_blank')`,
      apercu: r.piece_jointe_path ? `dcxApercu('${dcxEsc(r.piece_jointe_path)}', '${dcxEsc(r.piece_jointe_nom || r.titre || '')}')` : null });
  }
  return out;
}

function dcxCompteDocuments(clientId, contrats, mandats, rappels) {
  return dcxToutDocument(clientId, contrats, mandats, rappels).length;
}

// L'onglet complet. `htmlDocumentsMandatsClient` (js/05) reste en tête : c'est là qu'on crée un
// mandat, qu'on l'envoie aux compagnies ou qu'on en téléverse un signé à la main.
function dcxOngletDocuments(c, contrats, mandats, rappels) {
  if (!window._dcx.docs.length && !window._dcx.chargement) {
    window._dcx.chargement = true;
    dcxCharger().then(() => {
      window._dcx.chargement = false;
      const z = document.getElementById('dcx-centre');
      if (z && typeof showClient === 'function') showClient(c.id);
    });
  }
  const tout = dcxToutDocument(c.id, contrats, mandats, rappels);
  const publies = tout.filter(d => d.publiable && d.publiable.visible).length;

  const ligne = d => `<div class="dcx-doc">
    <span class="dcx-doc-icone" aria-hidden="true">${d.icone}</span>
    <button type="button" class="dcx-doc-corps" onclick="${d.apercu || d.ouvrir}">
      <span class="dcx-doc-titre">${dcxEsc(d.titre)}</span>
      <span class="dcx-doc-sous">${dcxEsc(d.sous || '')}</span>
    </button>
    ${d.apercu ? `<button type="button" class="dcx-loupe" onclick="${d.apercu}" title="Aperçu rapide">🔍</button>` : '<span></span>'}
    ${d.etat ? `<span class="dcx-doc-etat ${d.ok ? 'ok' : ''}">${dcxEsc(d.etat)}</span>` : '<span></span>'}
    ${d.publiable
      ? `<button type="button" class="dcx-publier ${d.publiable.visible ? 'on' : ''}"
   title="${d.publiable.visible ? 'Ce document est visible dans l’espace du client — cliquer pour le retirer' : 'Rendre ce document visible dans l’espace du client'}"
   onclick="dcxBasculerVisible('${d.publiable.id}', ${d.publiable.visible ? 'false' : 'true'}).then(()=>showClient('${c.id}'))">${d.publiable.visible ? '👁 Visible' : 'Publier'}</button>`
      : '<span></span>'}
  </div>`;

  return `<div id="dcx-centre">
    ${typeof htmlDocumentsMandatsClient === 'function' ? htmlDocumentsMandatsClient(c, mandats) : ''}

    <section class="dbx-carte dcx-centre-carte">
      <header class="dbx-carte-tete">
<div><h2>Tous les documents du client</h2>
  <span class="dbx-carte-sous">${tout.length} document${tout.length > 1 ? 's' : ''} au total${publies ? ` · ${publies} publié${publies > 1 ? 's' : ''} dans son espace` : ''}</span></div>
<button type="button" class="btn-secondary" onclick="dcxParcourir('${c.id}')">📤 Déposer un document</button>
      </header>
      ${tout.length ? DCX_ORIGINES.map(o => {
const l = tout.filter(d => d.origine === o.cle);
if (!l.length) return '';
return `<div class="dcx-groupe">
  <h3>${o.icone} ${o.titre}<span>${l.length}</span></h3>
  <div class="dcx-docs">${l.map(ligne).join('')}</div>
</div>`;
      }).join('') : `<div class="dcx-fiche-vide">Aucun document pour ce client. Dépose un fichier ci-dessus, ou attends la prochaine synchronisation EcoHub.</div>`}
      <p class="dcx-centre-note">Un document reçu d’une compagnie n’apparaît dans l’espace du client que si tu l’as publié (bouton 👁️). Les mandats, polices et pièces jointes restent internes.</p>
    </section>
  </div>`;
}

// Dépôt depuis la fiche : le client est connu, on rattache au contrat si la police est lisible,
// sinon au client directement.
async function dcxDeposerSurFiche(clientId, fichiers) {
  const liste = [...(fichiers || [])];
  if (!liste.length) return;
  showError(`⏳ Dépôt de ${liste.length} document(s)…`);
  let ok = 0;
  const sansContrat = [];
  for (const f of liste) {
    const r = await dcxDeposerUnFichier(f);
    if (!r.ok) { showError(`Échec sur ${r.nom} : ${r.erreur}`); continue; }
    ok++;
    // Rien que les documents de CE dépôt : on ne touche jamais aux orphelins déjà en base,
    // ils pourraient appartenir à un autre client.
    if (!r.rattache && r.id) sansContrat.push(r.id);
  }
  for (const id of sansContrat) await dbPatch('documents_compagnies', id, { client_id: clientId });
  await dcxCharger();
  showError(`✓ ${ok} document(s) ajouté(s) à la fiche.`);
  if (typeof showClient === 'function') showClient(clientId);
}
