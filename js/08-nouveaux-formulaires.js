function viewNouveauRappel() {
  const agentOptions = allAgents.map(a => `<option value="${a.id}">${a.prenom} ${a.nom}</option>`).join('');
  const clientOptions = allClients.map(c => `<option value="${c.id}" ${prefill && prefill.clientId === c.id ? 'selected' : ''}>${estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`}</option>`).join('');
  const prefill = window._prefillRappelDepuisPostit || null;
  window._prefillRappelDepuisPostit = null; // évite qu'un rechargement ultérieur du formulaire ne le réutilise par erreur
  return `
    <button onclick="navigate('rappels')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour</button>
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:800;color:var(--text)">Nouvelle tâche / rappel</h2>
    ${sectionCard('Nature', '#4ade80', `<div class="form-grid">
      <div class="form-field" style="grid-column:span 2">
        <label class="form-label">Type d'élément *</label>
        <select class="form-select" id="r-nature" onchange="toggleNatureFields()">
          <option value="rappel">🔔 Rappel simple</option>
          <option value="tache">📋 Tâche (structurée, avec étapes)</option>
        </select>
      </div>
    </div>`)}
    ${sectionCard('Détails', '#38bdf8', `<div class="form-grid">
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Titre *</label><input class="form-input" id="r-titre" value="${prefill ? (prefill.titre || '').replace(/"/g, '&quot;') : ''}" placeholder="Ex: Affilier collaborateur à la LPP"/></div>
      <div class="form-field"><label class="form-label">Client</label><select class="form-select" id="r-client" onchange="onClientChangeRappel()"><option value="">— Sélectionner —</option>${clientOptions}</select></div>
      <div class="form-field" id="r-collab-field" style="display:none"><label class="form-label">Collaborateur</label><select class="form-select" id="r-collaborateur"><option value="">— Sélectionner —</option></select></div>
      <div class="form-field"><label class="form-label">Contrat lié</label><select class="form-select" id="r-contrat"><option value="">— Aucun —</option></select></div>
      <div class="form-field"><label class="form-label">Type</label><select class="form-select" id="r-type"><option>Suivi</option><option>Contrat</option><option>Opportunité</option><option>Admin</option></select></div>
      <div class="form-field"><label class="form-label">Urgence</label><select class="form-select" id="r-urgence" onchange="updateRappelIntelligentPreview()"><option value="basse">Basse</option><option value="moyenne">Moyenne</option><option value="haute">Haute</option></select></div>
      <div class="form-field"><label class="form-label">Date planifiée (quand tu comptes t'en occuper)</label><input class="form-input" id="r-date-planifiee" type="date"/></div>
      <div class="form-field"><label class="form-label">Date échéance (limite)</label><input class="form-input" id="r-date" type="date" onchange="updateRappelIntelligentPreview()"/></div>
      <div class="form-field"><label class="form-label">Assigné à</label><select class="form-select" id="r-agent"><option value="">— Sélectionner —</option>${agentOptions}</select></div>
    </div>`)}
    <div id="r-checklist-section" style="display:none">
      ${sectionCard('Étapes de la tâche', '#f59e0b', `
        <div id="r-etapes-list" style="margin-bottom:10px"></div>
        <div style="display:flex;gap:8px">
          <input class="form-input" id="r-nouvelle-etape" placeholder="Ex: Envoyer le formulaire d'affiliation" style="flex:1"/>
          <button type="button" class="btn-secondary" onclick="ajouterEtapeLocale()">+ Ajouter</button>
        </div>
      `)}
    </div>
    <div id="r-auto-rappel-zone" style="display:none;margin-bottom:16px">
      ${sectionCard('Rappel intelligent', '#38bdf8', `
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
          <input type="checkbox" id="r-auto-rappel-check" checked onchange="this.dataset.userTouched='true'" style="margin-top:2px;width:16px;height:16px;cursor:pointer"/>
          <span id="r-auto-rappel-preview" style="font-size:12.5px;color:var(--text-muted);line-height:1.5"></span>
        </label>
      `)}
    </div>
    ${sectionCard('Notes', '#a78bfa', `
      <textarea id="r-notes" placeholder="Ajouter des informations, un contexte..." style="width:100%;background:var(--surface-alt);border:1px solid var(--border);border-radius:9px;padding:12px 14px;color:var(--text);font-size:13px;outline:none;resize:vertical;min-height:90px;font-family:inherit;box-sizing:border-box"></textarea>
    `)}
    ${sectionCard('Pièce jointe', '#f59e0b', `
      <input type="file" id="r-file-input" style="display:none"/>
      <button type="button" class="btn-secondary" onclick="document.getElementById('r-file-input').click()">📎 Joindre un document (police, décompte...)</button>
      <div id="r-file-name" style="font-size:12px;color:var(--text-muted);margin-top:8px"></div>
    `)}
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn-secondary" onclick="navigate('rappels')">Annuler</button>
      <button class="btn-save" onclick="saveRappel()">✓ Enregistrer</button>
    </div>`;
}

// Bascule l'affichage de la section checklist selon la nature choisie
function toggleNatureFields() {
  const nature = document.getElementById('r-nature').value;
  document.getElementById('r-checklist-section').style.display = nature === 'tache' ? 'block' : 'none';
  updateRappelIntelligentPreview();
}

// Filtre dynamiquement le sélecteur Collaborateur + Contrat selon le client choisi
function onClientChangeRappel() {
  const clientId = document.getElementById('r-client').value;
  const collabField = document.getElementById('r-collab-field');
  const collabSelect = document.getElementById('r-collaborateur');
  const contratSelect = document.getElementById('r-contrat');
  if (!clientId) {
    collabField.style.display = 'none';
    contratSelect.innerHTML = '<option value="">— Aucun —</option>';
    return;
  }
  const client = allClients.find(c => c.id === clientId);
  const collabsDuClient = allCollaborateurs.filter(c => c.client_id === clientId);
  if (client && estEntreprise(client) && collabsDuClient.length) {
    collabField.style.display = '';
    collabSelect.innerHTML = '<option value="">— Sélectionner —</option>' + collabsDuClient.map(c => `<option value="${c.id}">${c.prenom} ${c.nom}</option>`).join('');
  } else {
    collabField.style.display = 'none';
  }
  const contratsDuClient = allContrats.filter(c => c.client_id === clientId);
  contratSelect.innerHTML = '<option value="">— Aucun —</option>' + contratsDuClient.map(c => `<option value="${c.id}">${c.produit || 'Contrat'} — ${c.numero_police || ''}</option>`).join('');
}

// Gestion locale des étapes avant la première sauvegarde (stockées en mémoire, insérées après création de la tâche)
let etapesLocalesTemp = [];
function ajouterEtapeLocale() {
  const input = document.getElementById('r-nouvelle-etape');
  const libelle = input.value.trim();
  if (!libelle) return;
  etapesLocalesTemp.push(libelle);
  input.value = '';
  renderEtapesLocales();
}
function retirerEtapeLocale(idx) {
  etapesLocalesTemp.splice(idx, 1);
  renderEtapesLocales();
}
function renderEtapesLocales() {
  const zone = document.getElementById('r-etapes-list');
  if (!zone) return;
  zone.innerHTML = etapesLocalesTemp.map((e, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0">
      <span style="flex:1;font-size:13px;color:var(--text)">${i+1}. ${e}</span>
      <button type="button" onclick="retirerEtapeLocale(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px">✕</button>
    </div>`).join('');
}

async function saveRappel() {
  const titre = document.getElementById('r-titre').value.trim();
  if (!titre) { alert('Titre obligatoire.'); return; }
  const body = {
    titre,
    nature: document.getElementById('r-nature').value,
    client_id: document.getElementById('r-client').value || null,
    collaborateur_id: document.getElementById('r-collaborateur') ? (document.getElementById('r-collaborateur').value || null) : null,
    contrat_id: document.getElementById('r-contrat').value || null,
    type: document.getElementById('r-type').value,
    urgence: document.getElementById('r-urgence').value,
    date_echeance: document.getElementById('r-date').value || null,
    date_planifiee: document.getElementById('r-date-planifiee') ? (document.getElementById('r-date-planifiee').value || null) : null,
    apporteur_id: document.getElementById('r-agent').value || null,
    notes: document.getElementById('r-notes').value || null,
    statut: 'ouvert',
  };
  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;
  const created = await dbPost('rappels', body);
  if (created && created.error) { showError('Erreur lors de la création: ' + (created.detail || created.status)); btn.textContent = '✓ Enregistrer'; btn.disabled = false; return; }

  // Si nature = tâche, on insère les étapes de checklist saisies localement
  if (body.nature === 'tache' && etapesLocalesTemp.length && created && created[0] && created[0].id) {
    const newId = created[0].id;
    let echecsEtapes = 0;
    for (let i = 0; i < etapesLocalesTemp.length; i++) {
      const rEtape = await dbPost('tache_etapes', { rappel_id: newId, libelle: etapesLocalesTemp[i], ordre: i });
      if (rEtape && rEtape.error) echecsEtapes++;
    }
    if (echecsEtapes > 0) showError(`⚠️ La tâche est créée, mais ${echecsEtapes} étape(s) de checklist n'ont pas pu être ajoutée(s) — tu peux les ressaisir sur la fiche.`);
    etapesLocalesTemp = [];
  }

  // Si un fichier a été sélectionné, on l'upload une fois le rappel créé (on a alors son ID)
  const fileInput = document.getElementById('r-file-input');
  const file = fileInput && fileInput.files[0];
  if (file && created && created[0] && created[0].id) {
    const newId = created[0].id;
    try {
      const ext = file.name.split('.').pop();
      const path = `rappels/${newId}-${Date.now()}.${ext}`;
      const uploadToken = await getValidAccessToken() || SUPABASE_KEY;
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${uploadToken}`, 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (uploadRes.ok) {
        await dbPatch('rappels', newId, { piece_jointe_path: path, piece_jointe_nom: file.name, piece_jointe_url: null });
      }
    } catch (e) { /* upload échoué, le rappel reste créé sans pièce jointe */ }
  }

  // Création de l'événement Outlook correspondant (si une date d'échéance est définie)
  if (created && created[0] && created[0].id && body.date_echeance) {
    try {
      const eventId = await createOutlookEventFromRappel(created[0]);
      if (eventId) await dbPatch('rappels', created[0].id, { outlook_event_id: eventId });
    } catch (e) { /* sync Outlook échouée, le rappel reste créé dans le CRM */ }
  }

  // Rappel intelligent : si nature = tâche, échéance définie, et case cochée
  if (body.nature === 'tache' && created && created[0]) {
    const checkbox = document.getElementById('r-auto-rappel-check');
    if (checkbox && checkbox.checked && !checkbox.disabled) {
      try { await creerRappelIntelligentPourTache(created[0]); } catch(e) { /* rappel intelligent échoué, la tâche reste créée */ }
    }
  }

  // Email immédiat à l'agent assigné (silencieux si pas de session Outlook active)
  if (created && created[0] && body.apporteur_id) {
    const agent = allAgents.find(a => a.id === body.apporteur_id);
    if (agent) { try { await sendTaskAssignmentEmail(created[0], agent); } catch(e) {} }
  }

  // Si ce rappel provient de la conversion d'un post-it, on supprime ce dernier —
  // il ne doit pas continuer à exister en double une fois transformé en vraie tâche suivie.
  if (postitEnConversion) {
    const rSuppr = await dbDelete('postits', postitEnConversion.id);
    if (rSuppr && rSuppr.error) showError('⚠️ Tâche créée, mais le post-it d\u2019origine n\u2019a pas pu être supprimé — tu peux le retirer manuellement.');
    postitEnConversion = null;
  }

  allRappels = await dbGet('rappels', 'select=*');
  navigate('rappels');
}

// ═══ ACCÈS SÉCURISÉ AUX PIÈCES JOINTES (bucket privé → URL signée temporaire) ═══
// ═══ UPLOAD POLICE PDF (fiche client → onglet Contrats) ═══
async function uploadPolicePdf(contratId, input) {
  const file = input.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') { showError('Seuls les fichiers PDF sont acceptés.'); return; }
  if (file.size > 10 * 1024 * 1024) { showError('Fichier trop lourd — maximum 10 Mo.'); return; }

  const ct = allContrats.find(x => x.id === contratId);
  const nomFichier = (ct ? `${ct.compagnie}_${ct.produit}_${ct.numero_police || contratId}` : contratId)
    .replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);
  const path = `polices/${contratId}/${nomFichier}.pdf`;

  showError('⏳ Upload en cours...');
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
      body: file,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      // Si fichier déjà existant, on écrase (UPSERT)
      const upRes2 = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
        method: 'PUT',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!upRes2.ok) throw new Error('Échec de l\'upload');
    }
    const r = await dbPatch('contrats', contratId, { police_url: path, police_nom: file.name });
    if (r && r.error) throw new Error(errMsg(r));
    allContrats = await dbGet('contrats', 'select=*');
    showError('✓ Police PDF archivée avec succès.');
    logAction('upload_police', 'contrats', contratId, file.name);
    // Recharger la fiche client
    const ct2 = allContrats.find(x => x.id === contratId);
    if (ct2) showClient(ct2.client_id);
  } catch(e) {
    showError('Erreur upload : ' + e.message);
  }
}

async function ouvrirPieceJointe(path) {
  if (!path) return;
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/documents/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 }),
    });
    if (!r.ok) { showError("Impossible d'ouvrir le document (accès refusé)."); return; }
    const data = await r.json();
    if (data.signedURL) window.open(`${SUPABASE_URL}/storage/v1${data.signedURL}`, '_blank');
  } catch(e) { showError("Erreur lors de l'ouverture du document."); }
}

// ═══ ÉDITION CONTRAT ═══
async function showEditContrat(contratId, returnTo) {
  window._editContratReturnTo = returnTo || null;
  const contrats = await dbGet('contrats', `id=eq.${contratId}&select=*`);
  const ct = contrats && contrats[0];
  if (!ct) return;

  // Déduire périodicité depuis prime_annuelle si on peut
  const perioOpts = [
    { value:'1', label:'Annuelle (paiement en 1×)' },
    { value:'2', label:'Semestrielle (2× par an)' },
    { value:'4', label:'Trimestrielle (4× par an)' },
    { value:'12', label:'Mensuelle (12× par an)' },
  ];
  // La prime est stockée en annuel. On affiche le montant PAR ÉCHÉANCE.
  // Périodicité mémorisée sur le contrat (défaut annuel si absente)
  const perioActuelle = ct.periodicite || 1;
  const primeAff = perioActuelle > 1 ? Math.round((ct.prime_annuelle || 0) / perioActuelle) : (ct.prime_annuelle || 0);

  creerModale('modal-edit-contrat', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:520px">
      <h3 style="margin:0 0 20px;font-size:16px;font-weight:800;color:var(--text)">Modifier le contrat</h3>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">Produit</label><input class="form-input" id="ect-produit" value="${ct.produit || ''}"/></div>
        <div class="form-field"><label class="form-label">Compagnie</label><input class="form-input" id="ect-compagnie" value="${ct.compagnie || ''}"/></div>
        <div class="form-field"><label class="form-label">N° de police</label><input class="form-input" id="ect-police" value="${ct.numero_police || ''}"/></div>
        <div class="form-field"><label class="form-label">Date de signature</label><input class="form-input" id="ect-date-debut" type="date" value="${ct.date_debut || ''}"/></div>
        <div class="form-field"><label class="form-label">Date d'échéance</label><input class="form-input" id="ect-echeance" type="date" value="${ct.date_echeance || ''}"/></div>
        <div class="form-field"><label class="form-label">Prime par échéance (CHF)</label><input class="form-input" id="ect-prime" type="number" value="${primeAff}" oninput="updateApercuPrimeAnnuelle()"/></div>
        <div class="form-field"><label class="form-label">Périodicité</label>
          <select class="form-select" id="ect-periodicite" onchange="updateApercuPrimeAnnuelle()">
            ${perioOpts.map(o => `<option value="${o.value}" ${String(o.value)===String(perioActuelle)?'selected':''}>${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-field" style="grid-column:span 2"><div id="ect-apercu-annuel" style="font-size:12px;color:var(--text-muted);padding:6px 12px;background:var(--surface-alt);border-radius:8px">Prime annuelle calculée : CHF ${(ct.prime_annuelle||0).toLocaleString()}</div></div>
        <div class="form-field"><label class="form-label">Agent / Apporteur</label><select class="form-select" id="ect-apporteur">
          <option value="">— Aucun / pas de partage —</option>
          ${allAgents.map(a => `<option value="${a.id}" ${ct.apporteur_id===a.id?'selected':''}>${a.prenom} ${a.nom}${a.role==='signataire'?' (moi-même)':''}</option>`).join('')}
        </select></div>
        <div class="form-field"><label class="form-label">Statut</label>
          <select class="form-select" id="ect-statut">
            <option value="actif" ${ct.statut==='actif'?'selected':''}>Actif</option>
            <option value="renouveler" ${ct.statut==='renouveler'?'selected':''}>À renouveler</option>
            <option value="résilié" ${ct.statut==='résilié'?'selected':''}>Résilié</option>
            <option value="en_cours" ${ct.statut==='en_cours'?'selected':''}>En cours de signature</option>
            <option value="annulé" ${ct.statut==='annulé'?'selected':''}>Annulé (réserve refusée / non abouti)</option>
            <option value="mandat_resilie" ${ct.statut==='mandat_resilie'?'selected':''}>🚫 Mandat résilié (défini automatiquement depuis la fiche client)</option>
          </select>
        </div>
        <div class="form-field"><label class="form-label">Commissionné ?</label>
          <select class="form-select" id="ect-commissionne" onchange="document.getElementById('ect-rappel-note').style.display = this.value==='non' ? '' : 'none'">
            <option value="oui" ${ct.commissionne !== false ?'selected':''}>Oui</option>
            <option value="non" ${ct.commissionne === false ?'selected':''}>Non (pas de convention de collaboration)</option>
          </select>
          <div id="ect-rappel-note" style="display:${ct.commissionne === false ?'':'none'};font-size:10.5px;color:var(--text-muted);margin-top:4px">ℹ️ Un rappel sera créé 6 mois avant la date d'échéance ci-dessous, pour proposer un transfert vers une compagnie partenaire.</div>
        </div>
        <div class="form-field"><label class="form-label">Modules / options</label><input class="form-input" id="ect-modules" value="${ct.modules || ''}"/></div>
        <div class="form-field" style="grid-column:span 2">
          <label class="form-label">Police PDF</label>
          ${ct.police_url
            ? `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface-alt);border-radius:8px">
                <span style="font-size:12px;color:var(--text-muted)">📄 ${ct.police_nom || 'Police jointe'}</span>
                <button type="button" onclick="ouvrirPieceJointe('${ct.police_url}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">Ouvrir</button>
                <label style="background:var(--surface-alt);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;color:var(--text-muted)">Remplacer<input type="file" accept="application/pdf" onchange="uploadPolicePdf('${ct.id}', this); document.getElementById('modal-edit-contrat').remove();" style="display:none"/></label>
              </div>`
            : `<label style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--surface-alt);border:2px dashed var(--border);border-radius:8px;cursor:pointer;color:var(--text-muted);font-size:12.5px">
                📎 Joindre la police PDF (optionnel)
                <input type="file" accept="application/pdf" onchange="uploadPolicePdf('${ct.id}', this); document.getElementById('modal-edit-contrat').remove();" style="display:none"/>
              </label>`
          }
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="deleteContrat('${ct.id}','${ct.client_id}', window._editContratReturnTo)" style="background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:9px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer">🗑️ Supprimer</button>
        <button class="btn-secondary" onclick="document.getElementById('modal-edit-contrat').remove()">Annuler</button>
        <button class="btn-save" onclick="saveEditContrat('${ct.id}','${ct.client_id}', window._editContratReturnTo)">✓ Enregistrer</button>
      </div>
    </div>`);
}

async function deleteContrat(contratId, clientId, returnTo) {
  if (!confirm('Supprimer définitivement ce contrat ? Les commissions liées seront également supprimées. Cette action est irréversible.')) return;
  const token = await getValidAccessToken() || SUPABASE_KEY;
  // Supprimer les commissions liées d'abord (contrainte FK)
  await fetch(`${SUPABASE_URL}/rest/v1/commissions_attente?contrat_id=eq.${contratId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  // Supprimer le contrat
  const r = await fetch(`${SUPABASE_URL}/rest/v1/contrats?id=eq.${contratId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) { showError('Erreur lors de la suppression du contrat.'); return; }
  logAction('delete_contrat', 'contrats', contratId, null);
  allContrats = await dbGet('contrats', 'select=*');
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  const modal = document.getElementById('modal-edit-contrat');
  if (modal) modal.remove();
  if (returnTo) { navigate(returnTo); } else { showClient(clientId); }
}

function updateApercuPrimeAnnuelle() {
  const prime = parseFloat(document.getElementById('ect-prime')?.value) || 0;
  const perio = parseInt(document.getElementById('ect-periodicite')?.value) || 1;
  const annuelle = Math.round(prime * perio);
  const el = document.getElementById('ect-apercu-annuel');
  if (el) el.innerHTML = `Prime annuelle calculée : <strong style="color:#f59e0b">CHF ${annuelle.toLocaleString()}</strong> (${prime.toLocaleString()} × ${perio} échéance${perio>1?'s':''})`;
}

async function saveEditContrat(contratId, clientId, returnTo) {
  const periodicite = parseInt(document.getElementById('ect-periodicite').value) || 1;
  const primeParEcheance = parseFloat(document.getElementById('ect-prime').value) || 0;
  const primeAnnuelle = Math.round(primeParEcheance * periodicite);
  const commissionne = document.getElementById('ect-commissionne').value !== 'non';
  const ancienContrat = allContrats.find(c => c.id === contratId);
  const ancienStatut = ancienContrat ? ancienContrat.statut : null;
  const body = {
    produit: document.getElementById('ect-produit').value.trim(),
    compagnie: document.getElementById('ect-compagnie').value.trim(),
    numero_police: document.getElementById('ect-police').value.trim() || null,
    date_debut: document.getElementById('ect-date-debut').value || null,
    date_echeance: document.getElementById('ect-echeance').value || null,
    prime_annuelle: primeAnnuelle,
    periodicite: periodicite,
    statut: document.getElementById('ect-statut').value,
    commissionne,
    apporteur_id: document.getElementById('ect-apporteur').value || null,
    modules: document.getElementById('ect-modules').value.trim() || null,
  };
  const btn = document.querySelector('#modal-edit-contrat .btn-save');
  if (btn) { btn.textContent = 'Enregistrement...'; btn.disabled = true; }
  const r = await dbPatch('contrats', contratId, body);
  if (r && r.error) { showError('Erreur: ' + errMsg(r)); if (btn) { btn.textContent = '✓ Enregistrer'; btn.disabled = false; } return; }
  logAction('edit_contrat', 'contrats', contratId, `${body.produit} — ${body.compagnie}`);

  // ── Contrat passé en "Annulé" : supprimer la commission en attente liée ──
  // Un contrat annulé n'a jamais réellement pris effet (réserve refusée, non abouti),
  // donc toute commission encore "en attente" pour lui n'a plus aucune raison d'exister.
  // On ne touche JAMAIS aux commissions déjà "reçue" (argent réel déjà encaissé) —
  // dans ce cas c'est le statut "Extourné" qu'il faut utiliser, pas l'annulation.
  if (body.statut === 'annulé' && ancienStatut !== 'annulé') {
    const commissionsEnAttenteLiees = allCommissionsAttente.filter(c => c.contrat_id === contratId && c.statut === 'en_attente');
    for (const c of commissionsEnAttenteLiees) {
      const token = await getValidAccessToken() || SUPABASE_KEY;
      await fetch(`${SUPABASE_URL}/rest/v1/commissions_attente?id=eq.${c.id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      });
    }
    if (commissionsEnAttenteLiees.length) {
      logAction('suppr_commission_contrat_annule', 'commissions_attente', null, `${commissionsEnAttenteLiees.length} commission(s) en attente supprimée(s) — contrat ${body.produit} annulé`);
      showError(`Contrat annulé — ${commissionsEnAttenteLiees.length} commission(s) en attente liée(s) ont été supprimée(s) automatiquement.`);
    }
    allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  }

  // Police passée en "Non commissionné" : créer le rappel de transfert 6 mois avant échéance (si pas déjà fait)
  if (!commissionne && body.date_echeance) {
    const dejaCree = allRappels.some(r => r.client_id === clientId && r.type === 'Contrat' && (r.titre||'').includes(body.produit) && (r.titre||'').includes(body.compagnie));
    if (!dejaCree) {
      const client = allClients.find(c => c.id === clientId);
      const nomClient = client ? (estEntreprise(client) ? client.nom : `${client.prenom} ${client.nom}`) : '';
      const dEch = new Date(body.date_echeance);
      dEch.setMonth(dEch.getMonth() - 6);
      const r = await dbPost('rappels', {
        titre: `Reprendre "${body.produit}" de ${nomClient} (actuellement ${body.compagnie}, non partenaire)`,
        client_id: clientId, type: 'Contrat', urgence: 'moyenne',
        date_echeance: dEch.toISOString().split('T')[0],
        notes: `Police actuellement chez ${body.compagnie} (compagnie non partenaire) — échéance le ${body.date_echeance}. Objectif : proposer un transfert vers une compagnie partenaire pour générer une commission.`,
        statut: 'ouvert',
      });
      if (r && r.error) showError('⚠️ Contrat enregistré, mais le rappel de transfert automatique n\u2019a pas pu être créé : ' + errMsg(r));
      allRappels = await dbGet('rappels', 'select=*');
    }
  }

  allContrats = await dbGet('contrats', 'select=*');
  document.getElementById('modal-edit-contrat').remove();
  if (returnTo) { navigate(returnTo); } else { showClient(clientId); }
}
function showFormCollaborateur(clientId) {
  creerModale('modal-collaborateur', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:480px">
      <h3 style="margin:0 0 20px;font-size:16px;font-weight:800;color:var(--text)">Nouveau collaborateur</h3>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">Nom *</label><input class="form-input" id="col-nom" placeholder="Dupont"/></div>
        <div class="form-field"><label class="form-label">Prénom *</label><input class="form-input" id="col-prenom" placeholder="Jean"/></div>
        <div class="form-field"><label class="form-label">Date de naissance</label><input class="form-input" id="col-naissance" type="date"/></div>
        <div class="form-field"><label class="form-label">N° de téléphone</label><input class="form-input" id="col-tel" placeholder="079 123 45 67"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Adresse privée</label><input class="form-input" id="col-adresse" placeholder="Rue des Alpes 12, 1000 Lausanne"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">N° AVS</label><input class="form-input" id="col-avs" placeholder="756.1234.5678.90" maxlength="16"/></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn-secondary" onclick="document.getElementById('modal-collaborateur').remove()">Annuler</button>
        <button class="btn-save" onclick="saveCollaborateur('${clientId}')">✓ Enregistrer</button>
      </div>
    </div>`, { overflowY: false });
  setTimeout(() => initAdresseAutocomplete('col-adresse', ({ rue, npa, ville, canton }) => {
    const el = document.getElementById('col-adresse');
    if (el) el.value = [rue, npa, ville].filter(Boolean).join(', ');
  }), 0);
}

async function saveCollaborateur(clientId) {
  const nom = document.getElementById('col-nom').value.trim();
  const prenom = document.getElementById('col-prenom').value.trim();
  if (!nom || !prenom) { showError('Nom et prénom obligatoires.'); return; }
  const body = {
    client_id: clientId,
    nom,
    prenom,
    date_naissance: document.getElementById('col-naissance').value || null,
    telephone: document.getElementById('col-tel').value.trim() || null,
    adresse: document.getElementById('col-adresse').value.trim() || null,
    avs: document.getElementById('col-avs').value.trim() || null,
  };
  const btn = document.querySelector('#modal-collaborateur .btn-save');
  if (btn) { btn.textContent = 'Enregistrement...'; btn.disabled = true; }
  const res = await dbPost('collaborateurs', body);
  if (res && res.error) { showError('Erreur: ' + errMsg(res)); if (btn) { btn.textContent = '✓ Enregistrer'; btn.disabled = false; } return; }
  logAction('add_collaborateur_avs', 'collaborateurs', res && res[0] ? res[0].id : null, `${prenom} ${nom}`);
  document.getElementById('modal-collaborateur').remove();
  showClient(clientId);
}

// ═══ POST-ITS (collés sur la fiche client) ═══
const POSTIT_COULEURS = ['#fde047', '#fda4af', '#93c5fd', '#86efac', '#fdba74'];

async function addPostit(clientId) {
  const couleur = POSTIT_COULEURS[Math.floor(Math.random() * POSTIT_COULEURS.length)];
  const rotation = Math.round((Math.random() * 8 - 4) * 10) / 10; // entre -4° et +4°
  const res = await dbPost('postits', { client_id: clientId, contenu: '', couleur, rotation });
  if (res && res.error) { showError("Erreur lors de l'ajout du post-it : " + (res.detail?.message || res.detail || res.status) + ' — vérifie que la table "postits" a bien été créée dans Supabase.'); return; }
  showClient(clientId);
}

async function savePostitContenu(postitId, contenu) {
  const r = await dbPatch('postits', postitId, { contenu });
  if (r && r.error) showError('Erreur lors de l\u2019enregistrement du post-it : ' + errMsg(r));
}

async function deletePostit(postitId, clientId) {
  const r = await dbDelete('postits', postitId);
  if (r && r.error) { showError('Erreur lors de la suppression du post-it : ' + errMsg(r)); return; }
  showClient(clientId);
}

// Convertit un post-it en une vraie tâche/rappel avec échéance — le post-it n'a alors plus lieu
// d'exister seul sans suivi ; il est supprimé automatiquement une fois le rappel enregistré.
let postitEnConversion = null; // { id, clientId } — mémorisé le temps de remplir le formulaire
function convertirPostitEnRappel(postitId, clientId, boutonCliquer) {
  const note = boutonCliquer.closest('.postit-note');
  const contenu = note ? note.querySelector('.postit-text')?.value : '';
  postitEnConversion = { id: postitId, clientId };
  window._prefillRappelDepuisPostit = { titre: (contenu || '').slice(0, 120), clientId };
  navigate('nouveau-rappel');
}

// ═══ FACTURES ═══
async function showFormFacture(clientId) {
  const allFactures = await dbGet('factures', 'select=numero&order=created_at.desc&limit=1');
  let prochainNumero = 'FAC-0001';
  if (allFactures && allFactures[0] && allFactures[0].numero) {
    const m = allFactures[0].numero.match(/(\d+)$/);
    if (m) prochainNumero = 'FAC-' + String(parseInt(m[1], 10) + 1).padStart(4, '0');
  }

  creerModale('modal-facture', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:480px">
      <h3 style="margin:0 0 20px;font-size:16px;font-weight:800;color:var(--text)">Nouvelle facture</h3>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">N° de facture</label><input class="form-input" id="fac-numero" value="${prochainNumero}"/></div>
        <div class="form-field"><label class="form-label">Montant (CHF) *</label><input class="form-input" id="fac-montant" type="number" step="0.05" placeholder="250.00"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Objet</label><input class="form-input" id="fac-objet" placeholder="Honoraires de conseil, frais de dossier..."/></div>
        <div class="form-field"><label class="form-label">Date d'émission</label><input class="form-input" id="fac-emission" type="date" value="${new Date().toISOString().split('T')[0]}"/></div>
        <div class="form-field"><label class="form-label">Date d'échéance</label><input class="form-input" id="fac-echeance" type="date"/></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn-secondary" onclick="document.getElementById('modal-facture').remove()">Annuler</button>
        <button class="btn-save" onclick="saveFacture('${clientId}')">✓ Créer la facture</button>
      </div>
    </div>`, { overflowY: false });
}

async function saveFacture(clientId) {
  const montant = Number(document.getElementById('fac-montant').value) || 0;
  if (!montant) { showError('Le montant est obligatoire.'); return; }
  const body = {
    numero: document.getElementById('fac-numero').value.trim(),
    client_id: clientId,
    objet: document.getElementById('fac-objet').value.trim() || null,
    montant,
    date_emission: document.getElementById('fac-emission').value || null,
    date_echeance: document.getElementById('fac-echeance').value || null,
    statut: 'envoyee',
  };
  const btn = document.querySelector('#modal-facture .btn-save');
  if (btn) { btn.textContent = 'Création...'; btn.disabled = true; }
  const res = await dbPost('factures', body);
  if (res && res.error) { showError('Erreur: ' + errMsg(res)); if (btn) { btn.textContent = '✓ Créer la facture'; btn.disabled = false; } return; }
  logAction('create_facture', 'factures', res && res[0] ? res[0].id : null, `${body.numero} — CHF ${montant}`);
  document.getElementById('modal-facture').remove();
  showClient(clientId);
}

async function toggleFactureStatut(factureId, statutActuel, clientId) {
  const prochain = statutActuel === 'envoyee' ? 'payee' : statutActuel === 'payee' ? 'annulee' : 'envoyee';
  if (!confirm(`Marquer cette facture comme "${prochain === 'payee' ? 'Payée' : prochain === 'annulee' ? 'Annulée' : 'Envoyée'}" ?`)) return;
  const r = await dbPatch('factures', factureId, { statut: prochain });
  if (r && r.error) { showError('Erreur lors de la mise à jour de la facture : ' + errMsg(r)); return; }
  showClient(clientId);
}

async function deleteCollaborateur(colId, clientId) {
  if (!confirm('Supprimer ce collaborateur ?')) return;
  const token = await getValidAccessToken() || SUPABASE_KEY;
  await fetch(`${SUPABASE_URL}/rest/v1/collaborateurs?id=eq.${colId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  logAction('delete_collaborateur_avs', 'collaborateurs', colId, null);
  showClient(clientId);
}

// ═══ FLOTTE DE VÉHICULES (clients entreprise) ═══
function flotteListeHtml(clientId, searchOverride) {
  const search = (searchOverride !== undefined ? searchOverride : (document.getElementById('flotte-search-'+clientId)?.value || '')).toLowerCase().trim();
  let vehicules = allVehicules.filter(v => v.client_id === clientId);
  if (search) {
    vehicules = vehicules.filter(v =>
      (v.marque||'').toLowerCase().includes(search) ||
      (v.modele||'').toLowerCase().includes(search) ||
      (v.cylindree||'').toLowerCase().includes(search) ||
      (v.numero_plaque||'').toLowerCase().includes(search) ||
      (v.numero_police||'').toLowerCase().includes(search)
    );
  }
  if (!vehicules.length) return `<div class="table-empty">${search ? 'Aucun véhicule ne correspond à cette recherche.' : 'Aucun véhicule enregistré pour ce client.'}</div>`;

  const totalBrut = vehicules.reduce((s,v) => s + Number(v.prime_brute||0), 0);
  const totalNet = vehicules.reduce((s,v) => s + Number(v.prime_nette||0), 0);

  return `<div style="display:flex;gap:10px;margin-bottom:12px">
      <div style="background:var(--surface-alt);border-radius:8px;padding:8px 14px"><span style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Véhicules</span><div style="font-weight:800;color:var(--text)">${vehicules.length}</div></div>
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:8px 14px"><span style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Total prime brute</span><div style="font-weight:800;color:#f59e0b">CHF ${totalBrut.toLocaleString()}</div></div>
      <div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:8px 14px"><span style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Total prime nette</span><div style="font-weight:800;color:#4ade80">CHF ${totalNet.toLocaleString()}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">
        <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Marque</th>
        <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Modèle</th>
        <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Cylindrée</th>
        <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">N° plaque</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:1px solid var(--border)">Prime brute</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:1px solid var(--border)">Prime nette</th>
        <th style="padding:8px 12px;border-bottom:1px solid var(--border)"></th>
      </tr></thead>
      <tbody>${vehicules.map(v => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:9px 12px;font-weight:700;color:var(--text)">${v.marque || '—'}</td>
          <td style="padding:9px 12px;color:var(--text)">${v.modele || '—'}</td>
          <td style="padding:9px 12px;color:var(--text-muted)">${v.cylindree || '—'}</td>
          <td style="padding:9px 12px;color:var(--text-muted);font-family:monospace;font-weight:700">${v.numero_plaque || '—'}</td>
          <td style="padding:9px 12px;text-align:right;color:#f59e0b;font-weight:700">CHF ${Number(v.prime_brute||0).toLocaleString()}</td>
          <td style="padding:9px 12px;text-align:right;color:#4ade80;font-weight:700">CHF ${Number(v.prime_nette||0).toLocaleString()}</td>
          <td style="padding:9px 12px;text-align:right;display:flex;gap:6px;justify-content:flex-end">
            <button onclick="showFormVehicule('${clientId}','${v.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">✏️</button>
            <button onclick="deleteVehicule('${v.id}','${clientId}')" style="background:rgba(248,113,113,0.1);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">🗑️</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderFlotteClient(clientId) {
  const el = document.getElementById('flotte-liste-'+clientId);
  if (el) el.innerHTML = flotteListeHtml(clientId);
}

function showFormVehicule(clientId, vehiculeId) {
  const v = vehiculeId ? allVehicules.find(x => x.id === vehiculeId) : null;
  const contratsFlotte = allContrats.filter(ct => ct.client_id === clientId && (ct.produit||'').toLowerCase().includes('véhicule'));
  const contratActuel = v?.contrat_id ? contratsFlotte.find(ct => ct.id === v.contrat_id) : null;
  creerModale('modal-vehicule', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:480px">
      <h3 style="margin:0 0 18px;font-size:16px;font-weight:800;color:var(--text)">${v ? 'Modifier le véhicule' : '🚗 Nouveau véhicule'}</h3>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">Marque *</label><input class="form-input" id="veh-marque" value="${v?.marque || ''}" placeholder="Renault, Mercedes..."/></div>
        <div class="form-field"><label class="form-label">Modèle *</label><input class="form-input" id="veh-modele" value="${v?.modele || ''}" placeholder="Trafic, Sprinter..."/></div>
        <div class="form-field"><label class="form-label">Cylindrée</label><input class="form-input" id="veh-cylindree" value="${v?.cylindree || ''}" placeholder="1998 cm3"/></div>
        <div class="form-field"><label class="form-label">N° de plaque *</label><input class="form-input" id="veh-plaque" value="${v?.numero_plaque || ''}" placeholder="VD 123456"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Contrat flotte lié (si applicable)</label>
          <select class="form-select" id="veh-contrat" onchange="afficherCouverturesFlotte('${clientId}')">
            <option value="">— Aucun (police individuelle) —</option>
            ${contratsFlotte.map(ct => `<option value="${ct.id}" ${v?.contrat_id===ct.id?'selected':''}>${ct.produit} — ${ct.compagnie}</option>`).join('')}
          </select>
          <div id="veh-couvertures-info" style="font-size:10.5px;color:var(--text-muted);margin-top:5px">
            ${contratActuel ? `📋 Couvertures de la flotte : <strong>${contratActuel.modules || 'aucune couverture définie sur ce contrat — édite le contrat pour les préciser une fois pour toutes'}</strong>` : ''}
          </div>
        </div>
        <div class="form-field"><label class="form-label">Prime brute (CHF/an)</label><input class="form-input" id="veh-prime-brute" type="number" step="0.01" value="${v?.prime_brute || ''}" placeholder="0"/></div>
        <div class="form-field"><label class="form-label">Prime nette (CHF/an)</label><input class="form-input" id="veh-prime-nette" type="number" step="0.01" value="${v?.prime_nette || ''}" placeholder="0"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">N° de police individuelle (si pas lié à un contrat flotte)</label><input class="form-input" id="veh-police" value="${v?.numero_police || ''}" placeholder="Laisser vide si couvert par le contrat flotte"/></div>
      </div>
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:6px">💡 La prime brute de ce véhicule s'ajoute (ou se retire) automatiquement du montant total de la police flotte liée.</div>
      <div style="display:flex;gap:10px;margin-top:16px">
        ${v ? `<button onclick="deleteVehicule('${v.id}','${clientId}')" style="background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:9px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer">🗑️ Supprimer</button>` : ''}
        <button class="btn-secondary" onclick="document.getElementById('modal-vehicule').remove()">Annuler</button>
        <button class="btn-save" onclick="saveVehicule('${clientId}'${v ? `,'${v.id}'` : ''})">✓ Enregistrer</button>
      </div>
    </div>`);
}

function afficherCouverturesFlotte(clientId) {
  const contratId = document.getElementById('veh-contrat').value;
  const infoEl = document.getElementById('veh-couvertures-info');
  if (!contratId) { infoEl.innerHTML = ''; return; }
  const ct = allContrats.find(c => c.id === contratId);
  infoEl.innerHTML = ct ? `📋 Couvertures de la flotte : <strong>${ct.modules || 'aucune couverture définie sur ce contrat — édite le contrat pour les préciser une fois pour toutes'}</strong>` : '';
}

// ═══ IMPORT DE FLOTTE PAR PDF (IA) — avec écran de vérification avant import ═══
async function importFlottePdf(clientId, input) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('flotte-import-status-'+clientId);
  statusEl.innerHTML = '🤖 Lecture du PDF en cours (peut prendre 30-60 secondes pour une grande flotte)...';
  statusEl.style.color = 'var(--accent)';

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parse_flotte', pdf_base64: base64 }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || 'Erreur inconnue');

    const vehicules = data.vehicules || [];
    if (!vehicules.length) {
      statusEl.innerHTML = '⚠ Aucun véhicule détecté dans ce PDF.';
      statusEl.style.color = '#f59e0b';
      return;
    }
    statusEl.innerHTML = `✓ ${vehicules.length} véhicule(s) détecté(s) — vérifie la liste avant de confirmer l'import.`;
    statusEl.style.color = '#4ade80';
    showModalVerifFlotte(clientId, vehicules);

  } catch(e) {
    statusEl.innerHTML = '✗ ' + e.message + ' — réessaie ou saisis les véhicules manuellement.';
    statusEl.style.color = '#f87171';
  }
  input.value = '';
}

function showModalVerifFlotte(clientId, vehicules) {
  const contratsFlotte = allContrats.filter(ct => ct.client_id === clientId && (ct.produit||'').toLowerCase().includes('véhicule'));
  window._flotteAImporter = vehicules;
  creerModale('modal-verif-flotte', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:100%;max-width:720px;max-height:85vh;overflow-y:auto">
      <h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:var(--text)">🤖 Vérification avant import — ${vehicules.length} véhicule(s)</h3>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">Décoche les lignes incorrectes ou en double avant de confirmer. Rien n'est encore enregistré.</div>

      <div class="form-field" style="margin-bottom:14px">
        <label class="form-label">Lier tous les véhicules importés à ce contrat flotte (optionnel)</label>
        <select class="form-select" id="verif-flotte-contrat">
          <option value="">— Aucun (polices individuelles) —</option>
          ${contratsFlotte.map(ct => `<option value="${ct.id}">${ct.produit} — ${ct.compagnie}</option>`).join('')}
        </select>
      </div>

      <div style="max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:10px">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead style="position:sticky;top:0;background:var(--surface)"><tr style="color:var(--text-muted);font-size:10.5px;text-transform:uppercase">
            <th style="padding:8px"><input type="checkbox" checked onchange="document.querySelectorAll('.verif-veh-check').forEach(cb=>cb.checked=this.checked)"/></th>
            <th style="padding:8px;text-align:left">Marque</th><th style="padding:8px;text-align:left">Modèle</th>
            <th style="padding:8px;text-align:left">Cylindrée</th><th style="padding:8px;text-align:left">Plaque</th>
            <th style="padding:8px;text-align:right">Prime brute</th><th style="padding:8px;text-align:right">Prime nette</th>
          </tr></thead>
          <tbody>${vehicules.map((v,i) => `
            <tr style="border-top:1px solid var(--border)">
              <td style="padding:7px"><input type="checkbox" class="verif-veh-check" data-idx="${i}" checked/></td>
              <td style="padding:7px;font-weight:700;color:var(--text)">${v.marque||'—'}</td>
              <td style="padding:7px;color:var(--text)">${v.modele||'—'}</td>
              <td style="padding:7px;color:var(--text-muted)">${v.cylindree||'—'}</td>
              <td style="padding:7px;font-family:monospace;font-weight:700">${v.numero_plaque||'—'}</td>
              <td style="padding:7px;text-align:right;color:#f59e0b">${v.prime_brute!=null?'CHF '+v.prime_brute:'—'}</td>
              <td style="padding:7px;text-align:right;color:#4ade80">${v.prime_nette!=null?'CHF '+v.prime_nette:'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div style="display:flex;gap:10px;margin-top:18px">
        <button class="btn-secondary" onclick="document.getElementById('modal-verif-flotte').remove()">Annuler</button>
        <button class="btn-save" onclick="confirmerImportFlotte('${clientId}')">✓ Confirmer l'import des véhicules cochés</button>
      </div>
    </div>`);
}

async function confirmerImportFlotte(clientId) {
  const vehicules = window._flotteAImporter || [];
  const contratId = document.getElementById('verif-flotte-contrat').value || null;
  const cases = document.querySelectorAll('.verif-veh-check');
  const aImporter = [];
  cases.forEach(cb => { if (cb.checked) aImporter.push(vehicules[parseInt(cb.dataset.idx)]); });

  if (!aImporter.length) { showError('Aucun véhicule sélectionné.'); return; }

  const btn = document.querySelector('#modal-verif-flotte .btn-save');
  if (btn) { btn.textContent = 'Import en cours...'; btn.disabled = true; }
  let echecsImport = 0;

  for (const v of aImporter) {
    const rVeh = await dbPost('vehicules', {
      client_id: clientId,
      contrat_id: contratId,
      marque: v.marque || null,
      modele: v.modele || null,
      cylindree: v.cylindree || null,
      numero_plaque: v.numero_plaque || null,
      prime_brute: Number(v.prime_brute) || 0,
      prime_nette: Number(v.prime_nette) || 0,
    });
    if (rVeh && rVeh.error) echecsImport++;
  }

  logAction('import_flotte_pdf', 'vehicules', null, `${aImporter.length - echecsImport} véhicule(s) importé(s)${echecsImport ? ` (${echecsImport} échec(s))` : ''}`);
  allVehicules = await dbGet('vehicules', 'select=*');
  let echecRecalcul = false;
  if (contratId) echecRecalcul = !(await recalculerPrimeFlotte(contratId));

  document.getElementById('modal-verif-flotte').remove();
  if (echecsImport > 0) {
    showError(`⚠️ ${aImporter.length - echecsImport} véhicule(s) importé(s), mais ${echecsImport} ont échoué — vérifie et réessaie pour ceux-là.`);
  } else {
    showError(`✓ ${aImporter.length} véhicule(s) importé(s) avec succès${contratId ? (echecRecalcul ? ' — ⚠️ la prime du contrat flotte n\u2019a pas pu être recalculée, vérifie-la manuellement' : ' et prime du contrat flotte recalculée') : ''}.`);
  }
  showClient(clientId);
}

async function recalculerPrimeFlotte(contratId) {
  if (!contratId) return true;
  const vehiculesDuContrat = allVehicules.filter(v => v.contrat_id === contratId);
  const totalBrut = vehiculesDuContrat.reduce((s, v) => s + Number(v.prime_brute || 0), 0);
  const r = await dbPatch('contrats', contratId, { prime_annuelle: Math.round(totalBrut) });
  allContrats = await dbGet('contrats', 'select=*');
  return !(r && r.error);
}

async function saveVehicule(clientId, vehiculeId) {
  const marque = document.getElementById('veh-marque').value.trim();
  const plaque = document.getElementById('veh-plaque').value.trim();
  if (!marque || !plaque) { showError('Marque et n° de plaque obligatoires.'); return; }
  const ancienVehicule = vehiculeId ? allVehicules.find(x => x.id === vehiculeId) : null;
  const ancienContratId = ancienVehicule ? ancienVehicule.contrat_id : null;
  const nouveauContratId = document.getElementById('veh-contrat').value || null;
  const body = {
    client_id: clientId,
    marque,
    modele: document.getElementById('veh-modele').value.trim() || null,
    cylindree: document.getElementById('veh-cylindree').value.trim() || null,
    numero_plaque: plaque,
    contrat_id: nouveauContratId,
    numero_police: document.getElementById('veh-police').value.trim() || null,
    prime_brute: Number(document.getElementById('veh-prime-brute').value) || 0,
    prime_nette: Number(document.getElementById('veh-prime-nette').value) || 0,
  };
  const r = vehiculeId ? await dbPatch('vehicules', vehiculeId, body) : await dbPost('vehicules', body);
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  logAction(vehiculeId ? 'edit_vehicule' : 'create_vehicule', 'vehicules', vehiculeId || null, `${marque} — ${plaque}`);
  allVehicules = await dbGet('vehicules', 'select=*');

  // Recalcul automatique de la prime du/des contrat(s) flotte concerné(s)
  const okNouveau = await recalculerPrimeFlotte(nouveauContratId);
  let okAncien = true;
  if (ancienContratId && ancienContratId !== nouveauContratId) okAncien = await recalculerPrimeFlotte(ancienContratId);
  if (!okNouveau || !okAncien) {
    showError('⚠️ Véhicule enregistré, mais la prime du contrat flotte n\u2019a pas pu être recalculée automatiquement — vérifie-la manuellement.');
  }

  document.getElementById('modal-vehicule').remove();
  showClient(clientId);
}

async function deleteVehicule(vehiculeId, clientId) {
  if (!confirm('Supprimer ce véhicule de la flotte ?')) return;
  const vehicule = allVehicules.find(v => v.id === vehiculeId);
  const contratConcerne = vehicule ? vehicule.contrat_id : null;
  const token = await getValidAccessToken() || SUPABASE_KEY;
  await fetch(`${SUPABASE_URL}/rest/v1/vehicules?id=eq.${vehiculeId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  logAction('delete_vehicule', 'vehicules', vehiculeId, null);
  allVehicules = await dbGet('vehicules', 'select=*');
  await recalculerPrimeFlotte(contratConcerne);
  document.getElementById('modal-vehicule')?.remove();
  showClient(clientId);
}

// ═══ RECHERCHE GLOBALE DE VÉHICULES (tous clients confondus) ═══
function viewRechercheVehicules() {
  setTimeout(() => renderRechercheVehicules(), 0);
  return `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">🚗 Recherche véhicules (toutes flottes)</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Recherche par marque, modèle, cylindrée ou n° de plaque, tous clients confondus.</div>
    <input class="form-input" id="rv-search" placeholder="🔍 Marque, modèle, cylindrée, plaque..." style="margin-bottom:16px" oninput="renderRechercheVehicules()"/>
    <div id="rv-stats" class="stat-grid" style="margin-bottom:16px"></div>
    <div id="rv-liste"></div>`;
}

function renderRechercheVehicules() {
  const search = (document.getElementById('rv-search')?.value || '').toLowerCase().trim();
  let vehicules = allVehicules;
  if (search) {
    vehicules = vehicules.filter(v =>
      (v.marque||'').toLowerCase().includes(search) ||
      (v.modele||'').toLowerCase().includes(search) ||
      (v.cylindree||'').toLowerCase().includes(search) ||
      (v.numero_plaque||'').toLowerCase().includes(search) ||
      (v.numero_police||'').toLowerCase().includes(search)
    );
  }
  document.getElementById('rv-stats').innerHTML = `${statCard('Véhicules', vehicules.length, '#38bdf8')}${statCard('Total flotte', allVehicules.length, '#64748b')}`;
  const cols = '130px 1fr 110px 130px 1fr';
  document.getElementById('rv-liste').innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}"><div>Marque</div><div>Modèle</div><div>Cylindrée</div><div>Plaque</div><div>Client</div></div>
      ${vehicules.map(v => {
        const cl = allClients.find(c => c.id === v.client_id);
        return `<a href="?client=${v.client_id}" class="table-row" style="grid-template-columns:${cols};cursor:pointer;text-decoration:none;color:inherit" onclick="return irVersClient(event, '${v.client_id}')">
          <div style="font-weight:700;color:var(--text)">${v.marque||'—'}</div>
          <div style="color:var(--text-muted)">${v.modele||'—'}</div>
          <div style="color:var(--text-muted)">${v.cylindree||'—'}</div>
          <div style="font-family:monospace;font-weight:700;color:var(--text)">${v.numero_plaque||'—'}</div>
          <div style="color:var(--accent);text-decoration:underline dotted">${cl ? cl.nom : '—'}</div>
        </a>`;
      }).join('') || '<div class="table-empty">Aucun véhicule ne correspond.</div>'}
    </div>`;
}

// ═══ DÉTAIL / ÉDITION RAPPEL ═══
let currentRappelId = null;
let editingClient = false;

function showRappel(id) {
  const etatPrecedent = capturerEtatActuel();
  if (!(etatPrecedent.type === 'rappel' && etatPrecedent.id === id)) navHistory.push(etatPrecedent);
  vueDetailActive = { type: 'rappel', id };
  currentRappelId = id;
  currentView = 'rappels';
  renderSidebar();
  const r = allRappels.find(x => x.id === id);
  if (!r) { return; }
  const client = allClients.find(c => c.id === r.client_id);
  const clientNom = client ? (estEntreprise(client) ? client.nom : `${client.prenom} ${client.nom}`) : '';
  const agentOptions = allAgents.map(a => `<option value="${a.id}" ${a.id === r.apporteur_id ? 'selected' : ''}>${a.prenom} ${a.nom}</option>`).join('');
  const clientOptions = allClients.map(c => `<option value="${c.id}" ${c.id === r.client_id ? 'selected' : ''}>${estEntreprise(c) ? c.nom : c.prenom + ' ' + c.nom}</option>`).join('');
  const collabsDuClient = r.client_id ? allCollaborateurs.filter(c => c.client_id === r.client_id) : [];
  const collabOptions = collabsDuClient.map(c => `<option value="${c.id}" ${c.id === r.collaborateur_id ? 'selected' : ''}>${c.prenom} ${c.nom}</option>`).join('');
  const contratsDuClient = r.client_id ? allContrats.filter(c => c.client_id === r.client_id) : [];
  const contratOptions = contratsDuClient.map(c => `<option value="${c.id}" ${c.id === r.contrat_id ? 'selected' : ''}>${c.produit || 'Contrat'} — ${c.numero_police || ''}</option>`).join('');
  const isTache = r.nature === 'tache';
  const rappelIntelligentLie = isTache ? (allRappels || []).find(x => x.tache_parent_id === r.id) : null;
  const tacheParente = r.tache_parent_id ? (allRappels || []).find(x => x.id === r.tache_parent_id) : null;

  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">${isTache ? '📋' : '🔔'} ${r.titre}</h2>
      ${badge(r.statut === 'ouvert' ? 'Ouvert' : 'Traité', r.statut === 'ouvert' ? '#f59e0b' : '#4ade80')}
    </div>

    ${sectionCard('Détails', '#38bdf8', `<div class="form-grid">
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Titre *</label><input class="form-input" id="rd-titre" value="${r.titre || ''}"/></div>
      <div class="form-field"><label class="form-label">Client</label><select class="form-select" id="rd-client"><option value="">— Sélectionner —</option>${clientOptions}</select></div>
      ${collabsDuClient.length ? `<div class="form-field"><label class="form-label">Collaborateur</label><select class="form-select" id="rd-collaborateur"><option value="">— Sélectionner —</option>${collabOptions}</select></div>` : ''}
      <div class="form-field"><label class="form-label">Contrat lié</label><select class="form-select" id="rd-contrat"><option value="">— Aucun —</option>${contratOptions}</select></div>
      <div class="form-field"><label class="form-label">Type</label><select class="form-select" id="rd-type">${['Suivi','Contrat','Opportunité','Admin'].map(t => `<option ${t === r.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-label">Urgence</label><select class="form-select" id="rd-urgence">
        <option value="basse" ${r.urgence === 'basse' ? 'selected' : ''}>Basse</option>
        <option value="moyenne" ${r.urgence === 'moyenne' ? 'selected' : ''}>Moyenne</option>
        <option value="haute" ${r.urgence === 'haute' ? 'selected' : ''}>Haute</option>
      </select></div>
      <div class="form-field"><label class="form-label">Date planifiée (quand tu comptes t'en occuper)</label><input class="form-input" id="rd-date-planifiee" type="date" value="${r.date_planifiee || ''}"/></div>
      <div class="form-field"><label class="form-label">Date échéance (limite)</label><input class="form-input" id="rd-date" type="date" value="${r.date_echeance || ''}"/></div>
      <div class="form-field"><label class="form-label">Assigné à</label><select class="form-select" id="rd-agent"><option value="">— Sélectionner —</option>${agentOptions}</select></div>
    </div>`)}

    ${tacheParente ? `<div style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:var(--accent);cursor:pointer" onclick="showRappel('${tacheParente.id}')">🔗 Rappel automatique lié à la tâche : <strong>${tacheParente.titre}</strong></div>` : ''}
    ${rappelIntelligentLie ? `<div style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:var(--accent);cursor:pointer" onclick="showRappel('${rappelIntelligentLie.id}')">🔔 Rappel intelligent programmé le ${fmtDate(rappelIntelligentLie.date_echeance)} — <strong>${rappelIntelligentLie.statut === 'ouvert' ? 'ouvert' : 'traité'}</strong></div>` : ''}

    ${isTache ? `<div id="rd-checklist-zone">${renderChecklistLoading()}</div>` : ''}

    ${sectionCard('Notes', '#a78bfa', `
      <textarea id="rd-notes" placeholder="Ajouter des informations, un contexte, un suivi..." style="width:100%;background:var(--surface-alt);border:1px solid var(--border);border-radius:9px;padding:12px 14px;color:var(--text);font-size:13px;outline:none;resize:vertical;min-height:120px;font-family:inherit;box-sizing:border-box">${r.notes || ''}</textarea>
    `)}

    ${sectionCard('Pièce jointe', '#f59e0b', `
      <div id="rd-attachment-zone">
        ${(r.piece_jointe_path || r.piece_jointe_url) ? `
          <div style="display:flex;align-items:center;gap:10px;background:var(--surface-alt);border-radius:9px;padding:10px 14px">
            <span style="font-size:18px">📎</span>
            <a href="#" onclick="ouvrirPieceJointe('${r.piece_jointe_path || ''}'); return false;" style="flex:1;color:var(--accent);font-size:13px;font-weight:700;text-decoration:none">${r.piece_jointe_nom || 'Document joint'}</a>
            <button onclick="supprimerPieceJointe()" style="background:var(--red-dim);color:var(--red);border:none;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">Retirer</button>
          </div>
        ` : `
          <input type="file" id="rd-file-input" style="display:none" onchange="uploadPieceJointe()"/>
          <button class="btn-secondary" onclick="document.getElementById('rd-file-input').click()">📎 Joindre un document (police, décompte...)</button>
          <div id="rd-upload-status" style="font-size:11px;color:var(--text-muted);margin-top:8px"></div>
        `}
      </div>
    `)}

    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn-secondary" onclick="navigate('rappels')">Annuler</button>
      <button class="btn-save" onclick="saveRappelEdit()">💾 Enregistrer les modifications</button>
    </div>`;

  insertBackBar({ homeId: 'rappels', homeLabel: 'Tâches & Rappels', itemLabel: r.titre });
  if (isTache) loadAndRenderChecklist(id);
}

function renderChecklistLoading() {
  return `<div style="font-size:12px;color:var(--text-muted);padding:10px 0">Chargement des étapes...</div>`;
}

async function loadAndRenderChecklist(rappelId) {
  const etapes = await getEtapesRappel(rappelId);
  const zone = document.getElementById('rd-checklist-zone');
  if (!zone) return;
  const faites = etapes.filter(e => e.fait).length;
  zone.innerHTML = sectionCard(`Étapes de la tâche (${faites}/${etapes.length})`, '#f59e0b', `
    <div>
      ${etapes.map(e => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;${e.fait ? 'opacity:.6' : ''}">
          <input type="checkbox" ${e.fait ? 'checked' : ''} onchange="toggleEtapeRappel('${e.id}', this.checked)" style="width:16px;height:16px;cursor:pointer"/>
          <span style="flex:1;font-size:13px;color:var(--text);${e.fait ? 'text-decoration:line-through' : ''}">${e.libelle}</span>
          <button onclick="supprimerEtapeRappel('${e.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px">✕</button>
        </div>`).join('') || '<div style="font-size:12px;color:var(--text-muted)">Aucune étape.</div>'}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <input class="form-input" id="nouvelle-etape-input" placeholder="Ajouter une étape..." style="flex:1"/>
      <button type="button" class="btn-secondary" onclick="ajouterEtapeRappel('${rappelId}')">+ Ajouter</button>
    </div>
  `);
}

async function saveRappelEdit() {
  const titre = document.getElementById('rd-titre').value.trim();
  if (!titre) { showError('Le titre est obligatoire.'); return; }
  const collabEl = document.getElementById('rd-collaborateur');
  const body = {
    titre,
    client_id: document.getElementById('rd-client').value || null,
    collaborateur_id: collabEl ? (collabEl.value || null) : null,
    contrat_id: document.getElementById('rd-contrat').value || null,
    type: document.getElementById('rd-type').value,
    urgence: document.getElementById('rd-urgence').value,
    date_echeance: document.getElementById('rd-date').value || null,
    date_planifiee: document.getElementById('rd-date-planifiee') ? (document.getElementById('rd-date-planifiee').value || null) : null,
    apporteur_id: document.getElementById('rd-agent').value || null,
    notes: document.getElementById('rd-notes').value || null,
  };
  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;
  const r = await dbPatch('rappels', currentRappelId, body);
  if (r && r.error) { showError('Erreur lors de la mise à jour: ' + errMsg(r)); btn.textContent = '💾 Enregistrer les modifications'; btn.disabled = false; return; }
  allRappels = await dbGet('rappels', 'select=*');
  navigate('rappels');
}

