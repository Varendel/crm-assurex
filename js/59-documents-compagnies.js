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
  police:     { label: 'Police',              icone: '📄' },
  facture:    { label: 'Facture de prime',    icone: '🧾' },
  commission: { label: 'Décompte de commissions', icone: '💰' },
  rappel:     { label: 'Rappel de prime',     icone: '⏰' },
  avenant:    { label: 'Avenant',             icone: '✏️' },
  autre:      { label: 'Autre document',      icone: '📎' },
};

// Formats de numéro de police rencontrés chez les compagnies suisses :
//   La Mobilière  G-1846-4747 / P-2606-0139   Allianz  T308424160   CAP  Z753916287
const DCX_MOTIFS_POLICE = [
  /\b([A-Z])-?(\d{4})-?(\d{4})\b/,      // G-1846-4747, G18466747
  /\b([TZ]\d{9})\b/,                     // T308424160
  /\b(\d{3}-\d{2}-\d{3})\b/,             // 833-28-491
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
      <button type="button" class="dcx-oeil ${d.visible_client ? 'on' : ''}" ${rattache ? '' : 'disabled'}
        title="${d.visible_client ? 'Visible dans l’espace du client — cliquer pour la retirer' : rattache ? 'Publier dans l’espace du client' : 'Rattache d’abord le document à un client'}"
        onclick="dcxBasculerVisible('${d.id}', ${d.visible_client ? 'false' : 'true'})">${d.visible_client ? '👁️' : '🚫'}</button>
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

// ── Bloc « Documents des compagnies » sur la fiche client ───────────────────────────────────────
// Appelé par la fiche : rend le bloc tout de suite avec ce qu'on a en mémoire, et recharge si
// la liste n'a jamais été chargée dans cette session.
function dcxSectionFiche(clientId) {
  if (!window._dcx.docs.length && !window._dcx.chargement) {
    window._dcx.chargement = true;
    dcxCharger().then(() => {
      window._dcx.chargement = false;
      const z = document.getElementById('dcx-fiche-' + clientId);
      if (z) z.outerHTML = dcxSectionFiche(clientId);
    });
  }
  const docs = window._dcx.docs.filter(d => d.client_id === clientId);
  return `<section class="dcx-fiche" id="dcx-fiche-${clientId}">
    <div class="dcx-fiche-tete">
      <h3>📥 Documents des compagnies</h3>
      <span class="dcx-fiche-compte">${docs.length || 'aucun'}</span>
      <button type="button" class="dcx-fiche-ajout" onclick="dcxParcourir('${clientId}')">+ Déposer</button>
    </div>
    ${docs.length ? `<div class="dcx-fiche-liste">${docs.map(d => {
      const t = DCX_TYPES[d.type] || DCX_TYPES.autre;
      return `<button type="button" class="dcx-fiche-doc" onclick="dcxOuvrir('${dcxEsc(d.chemin)}')" title="${dcxEsc(d.nom_fichier || '')}">
        <span class="dcx-fiche-icone">${t.icone}</span>
        <span class="dcx-fiche-nom">${dcxEsc(d.titre || d.nom_fichier || t.label)}</span>
        <span class="dcx-fiche-sous">${dcxEsc(t.label)}${d.date_document ? ' · ' + fmtDate(d.date_document) : ''}${d.numero_police ? ' · ' + dcxEsc(d.numero_police) : ''}</span>
        ${d.visible_client ? '<span class="dcx-fiche-publie" title="Visible dans l’espace du client">👁️</span>' : ''}
      </button>`;
    }).join('')}</div>` : `<div class="dcx-fiche-vide">Rien reçu pour ce client. Les documents déposés ici apparaissent aussi dans « Documents reçus des compagnies ».</div>`}
  </section>`;
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
