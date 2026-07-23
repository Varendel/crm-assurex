async function uploadPieceJointe() {
  const input = document.getElementById('rd-file-input');
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('rd-upload-status');
  statusEl.textContent = 'Envoi en cours...';

  try {
    const ext = file.name.split('.').pop();
    const path = `rappels/${currentRappelId}-${Date.now()}.${ext}`;
    const uploadToken2 = await getValidAccessToken() || SUPABASE_KEY;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${uploadToken2}`, 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      statusEl.textContent = "Erreur lors de l'envoi: " + errText;
      return;
    }
    const rAttache = await dbPatch('rappels', currentRappelId, { piece_jointe_path: path, piece_jointe_nom: file.name, piece_jointe_url: null });
    if (rAttache && rAttache.error) { statusEl.textContent = 'Fichier envoyé, mais impossible de le lier au rappel : ' + errMsg(rAttache); return; }
    allRappels = await dbGet('rappels', 'select=*');
    showRappel(currentRappelId);
  } catch (e) {
    statusEl.textContent = "Erreur lors de l'envoi du fichier.";
  }
}

async function supprimerPieceJointe() {
  const r = await dbPatch('rappels', currentRappelId, { piece_jointe_url: null, piece_jointe_path: null, piece_jointe_nom: null });
  if (r && r.error) { showError('Erreur lors de la suppression de la pièce jointe : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  showRappel(currentRappelId);
}

// NOUVEAU BORDEREAU
// ═══ AGENT IA — Remplissage Demande d'offre depuis texte libre ═══
async function remplirDemandeOffreParIA() {
  const texte = document.getElementById('do-texte-libre').value.trim();
  if (!texte) { showError('Décris la situation du client d\'abord.'); return; }
  const statusEl = document.getElementById('do-ia-status');
  statusEl.textContent = '🤖 Analyse en cours...';
  statusEl.style.color = 'var(--text-muted)';

  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parse_demande_offre', texte }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || 'Erreur inconnue');

    let nbRemplis = 0;
    Object.entries(data).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') { el.checked = !!val; }
      else { el.value = val; }
      nbRemplis++;
    });

    statusEl.textContent = `✓ ${nbRemplis} champ(s) rempli(s) automatiquement — vérifie avant d'enregistrer.`;
    statusEl.style.color = '#4ade80';
  } catch (e) {
    statusEl.textContent = '✗ Erreur : ' + e.message;
    statusEl.style.color = '#f87171';
  }
}

// ═══ AGENT IA — Import bordereau PDF ═══
async function importBordereauPdf(input) {
  const file = input.files[0];
  if (!file) return;
  window._bordereauPdfFile = file; // conservé pour pièce jointe quoi qu'il arrive ensuite
  const statusEl = document.getElementById('bord-pdf-status');
  statusEl.textContent = '🤖 Lecture du PDF en cours...';
  statusEl.style.color = 'var(--text-muted)';

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
      body: JSON.stringify({ action: 'parse_bordereau', pdf_base64: base64 }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || 'Erreur inconnue');

    document.getElementById('b-compagnie').value = data.compagnie || '';
    document.getElementById('b-mois').value = data.mois || '';
    document.getElementById('b-montant').value = data.montant_brut || '';

    window._bordereauLignesExtraites = data.lignes || [];
    const zone = document.getElementById('bord-lignes-extraites');
    if (data.lignes && data.lignes.length) {
      zone.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">
          <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:10px">📋 ${data.lignes.length} ligne(s) détectée(s) — à vérifier avant d'enregistrer</div>
          ${data.lignes.map(l => `<div style="font-size:11.5px;color:var(--text-muted);padding:4px 0;border-bottom:1px solid var(--border)">${l.client_nom || '—'} · ${l.produit || ''} · ${l.type_mouvement || ''} · CHF ${l.credit || l.debit || 0}</div>`).join('')}
        </div>`;
    }
    statusEl.textContent = '✓ Champs remplis automatiquement — vérifie avant d\'enregistrer.';
    statusEl.style.color = '#4ade80';
  } catch (e) {
    statusEl.textContent = '✗ Erreur : ' + e.message;
    statusEl.style.color = '#f87171';
  }
}

async function viewNouveauBordereau() {
  const tousLesBordereaux = await dbGet('bordereaux', 'select=numero');
  let maxNum = 0;
  (tousLesBordereaux || []).forEach(b => {
    if (b.numero) {
      const m = b.numero.match(/(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
  });
  const prochainNumero = 'BRD-' + String(maxNum + 1).padStart(4, '0');
  window._bordereauNumero = prochainNumero;
  window._bordereauPdfFile = null;

  return `
    <button onclick="navigate('bordereaux')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour</button>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Saisir un bordereau</h2>
      <span style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:4px 10px;font-size:12px;font-weight:800;font-family:monospace">${prochainNumero}</span>
    </div>

    <div style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:12px;padding:16px 18px;margin-bottom:20px">
      <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:8px">🤖 Importer le PDF (extraction IA + archivage automatique)</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px">Le PDF sera lu pour préremplir les champs, ET conservé en pièce jointe sous le numéro ${prochainNumero} — tu pourras le retrouver et le rouvrir plus tard.</div>
      <input type="file" id="bord-pdf-input" accept="application/pdf" onchange="importBordereauPdf(this)" style="font-size:12.5px;color:var(--text-muted)"/>
      <div id="bord-pdf-status" style="font-size:11.5px;color:var(--text-muted);margin-top:8px"></div>
    </div>

    ${sectionCard('Informations bordereau', '#4ade80', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Compagnie *</label>
        <input class="form-input" id="b-compagnie" placeholder="Commence à taper..." list="bordereau-compagnies-suggestions" oninput="suggererCautionCompagnie()" autocomplete="off"/>
        <datalist id="bordereau-compagnies-suggestions">${(allCompagniesContacts||[]).map(c => `<option value="${c.compagnie}">`).join('')}</datalist>
        <div id="b-compagnie-hint" style="font-size:10.5px;color:var(--text-muted);margin-top:4px"></div>
      </div>
      <div class="form-field"><label class="form-label">Mois *</label>
        <select class="form-select" id="b-mois-select">
          <option value="Janvier">Janvier</option><option value="Février">Février</option><option value="Mars">Mars</option>
          <option value="Avril">Avril</option><option value="Mai">Mai</option><option value="Juin">Juin</option>
          <option value="Juillet" selected>Juillet</option><option value="Août">Août</option><option value="Septembre">Septembre</option>
          <option value="Octobre">Octobre</option><option value="Novembre">Novembre</option><option value="Décembre">Décembre</option>
        </select>
      </div>
      <div class="form-field"><label class="form-label">Année *</label>
        <select class="form-select" id="b-annee-select">
          ${[2024,2025,2026,2027].map(y => `<option value="${y}" ${y===2026?'selected':''}>${y}</option>`).join('')}
        </select>
      </div>
      <div class="form-field"><label class="form-label">Montant brut (CHF) *</label><input class="form-input" id="b-montant" type="number" placeholder="1500"/></div>
      <div class="form-field"><label class="form-label">Taux de caution (%)</label><input class="form-input" id="b-caution" type="number" step="0.1" placeholder="5 à 10" min="0" max="100" oninput="this.dataset.touched='1'"/></div>
      <div class="form-field"><label class="form-label">Statut</label><select class="form-select" id="b-statut"><option value="attendu">Attendu</option><option value="reçu">Reçu</option></select></div>
      <div class="form-field"><label class="form-label">Date de réception</label><input class="form-input" id="b-date" type="date"/></div>
    </div>`)}
    <div style="font-size:11px;color:var(--text-muted);margin-top:-6px;margin-bottom:8px">Certaines compagnies retiennent un pourcentage de la commission brute à titre de caution (généralement 5 à 10%). Laissez vide ou 0 si non applicable.</div>
    <div id="bord-lignes-extraites"></div>
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn-secondary" onclick="navigate('bordereaux')">Annuler</button>
      <button class="btn-save" onclick="saveBordereau()">✓ Enregistrer</button>
    </div>`;
}

function suggererCautionCompagnie() {
  const nomSaisi = document.getElementById('b-compagnie').value.trim();
  const hint = document.getElementById('b-compagnie-hint');
  if (!nomSaisi) { hint.textContent = ''; return; }

  const contact = (allCompagniesContacts||[]).find(c => c.compagnie.toLowerCase() === nomSaisi.toLowerCase());
  const dernierBordereauCompagnie = [...allBordereaux]
    .filter(b => (b.compagnie||'').toLowerCase() === nomSaisi.toLowerCase())
    .sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0))[0];

  let msgs = [];
  if (contact) msgs.push(`✓ Compagnie partenaire enregistrée${contact.libelle_contact ? ' — ' + contact.libelle_contact : ''}${contact.email ? ' (' + contact.email + ')' : ''}`);
  if (dernierBordereauCompagnie) {
    const cautionField = document.getElementById('b-caution');
    if (!cautionField.dataset.touched && dernierBordereauCompagnie.taux_caution) {
      cautionField.value = dernierBordereauCompagnie.taux_caution;
      msgs.push(`💡 Taux de caution repris du dernier bordereau ${dernierBordereauCompagnie.numero || ''} (${dernierBordereauCompagnie.taux_caution}%)`);
    }
  }
  if (!contact && nomSaisi.length > 2) msgs.push(`⚠ Compagnie non enregistrée dans Paramètres → Contacts compagnies`);
  hint.innerHTML = msgs.join('<br/>');
}

async function saveBordereau() {
  const compagnie = document.getElementById('b-compagnie').value.trim();
  const mois = `${document.getElementById('b-mois-select').value} ${document.getElementById('b-annee-select').value}`;
  const montant = parseInt(document.getElementById('b-montant').value) || 0;
  const tauxCaution = parseFloat(document.getElementById('b-caution').value) || 0;
  if (!compagnie) { alert('Compagnie obligatoire.'); return; }
  const body = {
    numero: window._bordereauNumero || null,
    compagnie, mois,
    montant_brut: montant,
    taux_caution: tauxCaution,
    statut: document.getElementById('b-statut').value,
    date_reception: document.getElementById('b-date').value || null,
  };
  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;
  const r = await dbPost('bordereaux', body);
  if (r && r.error) { showError("Erreur lors de l'enregistrement: " + errMsg(r)); btn.textContent = '✓ Enregistrer'; btn.disabled = false; return; }

  const nouveauBordereau = r && r[0] ? r[0] : null;

  // Si un PDF a été importé, on l'archive en pièce jointe rattachée au numéro du bordereau
  if (nouveauBordereau && window._bordereauPdfFile) {
    try {
      const file = window._bordereauPdfFile;
      const ext = file.name.split('.').pop();
      const path = `bordereaux/${body.numero || nouveauBordereau.id}-${Date.now()}.${ext}`;
      const uploadToken = await getValidAccessToken() || SUPABASE_KEY;
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${uploadToken}`, 'Content-Type': file.type || 'application/pdf' },
        body: file,
      });
      if (uploadRes.ok) {
        await dbPatch('bordereaux', nouveauBordereau.id, { pdf_url: path, pdf_nom: file.name });
      }
    } catch(e) { /* le bordereau reste créé même si l'archivage du PDF échoue */ }
  }

  window._bordereauPdfFile = null;
  allBordereaux = await dbGet('bordereaux', 'select=*');
  navigate('bordereaux');
}

// ═══ NOUVEAU CONTRAT + COMMISSION EN ATTENTE ═══
// ═══ IMPORT POLICE PDF PAR IA ═══
// Recherche floue d'un produit du catalogue à partir d'un texte libre (titre d'opportunité, extraction IA...).
// Retourne {categorie, produit} ou null. Tolère les formulations proches (mots-clés partagés)
// sans exiger une correspondance mot pour mot au libellé exact.
function trouverProduitCatalogue(texteLibre, segmentPrefere) {
  if (!texteLibre) return null;
  const texte = texteLibre.trim().toLowerCase();
  if (!texte) return null;
  const mots = texte.split(/[\s\/'’,-]+/).filter(m => m.length > 3);

  function chercher(exigerSegment) {
    for (const cat in CATALOGUE_PRODUITS) {
      for (const p of CATALOGUE_PRODUITS[cat]) {
        // Ignore les produits d'un autre segment quand on connaît déjà le segment du client
        // (évite par ex. qu'un mot générique comme "prévoyance" ne matche un produit privé
        // pour un client entreprise, ou l'inverse) — sauf en 2e passe si rien n'est trouvé.
        if (exigerSegment && segmentPrefere && p.segment !== 'tous' && p.segment !== segmentPrefere) continue;
        const labelLower = p.label.toLowerCase();
        const motsLabel = labelLower.split(/[\s\/'’,-]+/).filter(m => m.length > 3);
        if (labelLower === texte || labelLower.includes(texte) || texte.includes(labelLower) || mots.some(m => motsLabel.includes(m))) {
          return { categorie: cat, produit: p };
        }
      }
    }
    return null;
  }

  // Si le segment est connu, on ne cherche QUE dans ce segment (+ "tous") — mieux vaut ne rien
  // proposer que de proposer avec assurance le produit d'un autre segment. Si le segment est
  // inconnu, on cherche partout (comportement d'origine, moins précis mais jamais pire qu'avant).
  if (segmentPrefere) return chercher(true);
  return chercher(false);
}

// Applique le résultat de trouverProduitCatalogue() aux champs du formulaire Nouveau contrat
function appliquerProduitTrouve(resultat) {
  if (!resultat) return false;
  document.getElementById('ct-categorie').value = resultat.categorie;
  if (resultat.produit.segment && resultat.produit.segment !== 'tous') document.getElementById('ct-segment').value = resultat.produit.segment;
  updateProduitOptions(); // recharge la liste du menu déroulant pour la nouvelle catégorie/segment
  document.getElementById('ct-produit').value = resultat.produit.label;
  updateModulesOptions();
  updateCommissionPreview();
  return true;
}

async function importPolicePdfAI(input) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('police-import-status');
  const label = document.getElementById('police-import-label');
  statusEl.textContent = '🤖 Lecture du PDF en cours...';
  statusEl.style.color = 'var(--accent)';
  label.style.opacity = '0.5';
  label.style.pointerEvents = 'none';

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
      body: JSON.stringify({ action: 'parse_police', pdf_base64: base64 }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || 'Erreur inconnue');

    // Pré-remplir le formulaire avec les données extraites
    if (data.compagnie) document.getElementById('ct-compagnie').value = data.compagnie;

    // Trouver le client si nom détecté — AVANT la recherche de produit, pour que le segment
    // (privé/entreprise) du client déjà connu du CRM guide correctement cette recherche.
    let clientDejaTrouve = false;
    if (data.client_nom) {
      const nom = data.client_nom.toLowerCase();
      const clientTrouve = allClients.find(c => {
        const n = (c.prenom + ' ' + c.nom).toLowerCase();
        const n2 = c.nom.toLowerCase();
        return n.includes(nom) || nom.includes(n2) || n2.includes(nom);
      });
      if (clientTrouve && !contratClientId) {
        const sel = document.getElementById('ct-client');
        if (sel) { sel.value = clientTrouve.id; syncSegmentFromClient(); clientDejaTrouve = true; }
      }
    }
    // Pas de client existant trouvé (nouveau client pas encore créé) : on devine le segment
    // depuis des indices textuels (raison sociale Sàrl/SA/..., ou mention "entreprise(s)" dans le produit)
    // plutôt que de laisser "Privé" par défaut sans aucune vérification.
    if (!clientDejaTrouve && !contratClientId) {
      const texteIndice = `${data.client_nom || ''} ${data.produit || ''}`;
      if (/\b(sàrl|sarl|sa|ag|gmbh|sagl|snc)\b/i.test(data.client_nom || '') || /entreprises?\b/i.test(texteIndice)) {
        const segSel = document.getElementById('ct-segment');
        if (segSel) { segSel.value = 'entreprise'; updateCategorieOptions(); }
      }
    }

    if (data.produit) {
      document.getElementById('ct-produit').value = data.produit;
      const segmentConnu = document.getElementById('ct-segment')?.value;
      appliquerProduitTrouve(trouverProduitCatalogue(data.produit, segmentConnu));
    }
    if (data.numero_police) document.getElementById('ct-police').value = data.numero_police;
    if (data.date_debut) document.getElementById('ct-date').value = data.date_debut;
    if (data.date_echeance) document.getElementById('ct-echeance').value = data.date_echeance;
    if (data.prime_mensuelle) {
      // Prime réellement mensuelle (ex: santé complémentaire) — la périodicité annualise correctement
      document.getElementById('ct-prime-mensuelle').value = data.prime_mensuelle;
      document.getElementById('ct-periodicite').value = '12';
    } else if (data.prime_annuelle) {
      // Prime déjà annuelle (ex: RC, véhicule) — on l'utilise telle quelle, sans la diviser puis la remultiplier
      document.getElementById('ct-prime-mensuelle').value = data.prime_annuelle;
      document.getElementById('ct-periodicite').value = '1';
    }

    updateCommissionPreview();

    // Conserver le fichier pour l'archiver après création du contrat
    window._policePdfFileFromImport = file;

    statusEl.innerHTML = `<span style="color:#4ade80;font-weight:700">✓ Formulaire pré-rempli depuis le PDF</span> — vérifie les données, précise si le contrat sera commissionné ou non, puis enregistre.`;

  } catch(e) {
    statusEl.textContent = '✗ ' + e.message + ' — remplis manuellement le formulaire ci-dessous.';
    statusEl.style.color = '#f87171';
  } finally {
    label.style.opacity = '1';
    label.style.pointerEvents = 'auto';
  }
}

function viewNouveauContrat() {
  const clientOptions = allClients.map(c => `<option value="${c.id}" data-segment="${estEntreprise(c) ? 'entreprise' : 'prive'}">${estEntreprise(c) ? c.nom : c.prenom + ' ' + c.nom}</option>`).join('');
  const opp = prefillOpportunite;
  window._policePdfFileFromImport = null; // évite qu'un PDF d'un import précédent (annulé ou d'un autre contrat) ne s'attache par erreur
  return `
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:800;color:var(--text)">Nouveau contrat</h2>

    <!-- ── Zone import IA ─────────────────────────────────────── -->
    <div style="background:linear-gradient(135deg,rgba(0,207,255,0.06) 0%,rgba(56,189,248,0.04) 100%);border:1.5px dashed var(--accent-border);border-radius:14px;padding:16px 20px;margin-bottom:22px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px">🤖 Import automatique depuis une police PDF</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px">REX lit le PDF, extrait les données et pré-remplit le formulaire. Tu n'as plus qu'à confirmer si le contrat est commissionné ou non.</div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <label id="police-import-label" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:9px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px">
          📎 Choisir une police PDF
          <input type="file" accept="application/pdf" onchange="importPolicePdfAI(this)" style="display:none"/>
        </label>
        <div id="police-import-status" style="font-size:12px;color:var(--text-muted)">ou remplis le formulaire manuellement ci-dessous</div>
      </div>
    </div>

    ${opp ? `<div style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:12.5px;color:var(--text)">
      ✓ Pré-rempli depuis l'opportunité gagnée <strong>"${opp.titre}"</strong> — montant potentiel estimé : <strong>CHF ${(opp.montant_potentiel||0).toLocaleString()}</strong>. Vérifie/ajuste la prime exacte ci-dessous avant d'enregistrer.
      ${!opp.client_id && opp.prospect_nom ? `<div style="margin-top:8px;color:#f59e0b">⚠ "<strong>${opp.prospect_nom}</strong>" n'a pas encore de fiche client — sélectionne un client existant ci-dessous, ou <a href="#" onclick="navigate('nouveau-client'); return false;" style="color:#f59e0b;text-decoration:underline">crée sa fiche maintenant</a> puis reviens enregistrer ce contrat.</div>` : ''}
    </div>` : ''}
    ${sectionCard('Informations contrat', '#4ade80', `<div class="form-grid">
      ${!contratClientId ? `<div class="form-field" style="grid-column:span 2"><label class="form-label">Client *</label><select class="form-select" id="ct-client" onchange="syncSegmentFromClient()"><option value="">— Sélectionner un client —</option>${clientOptions}</select></div>` : ''}
      <div class="form-field"><label class="form-label">Type de client *</label><select class="form-select" id="ct-segment" onchange="updateCategorieOptions()">
        <option value="prive">Privé</option>
        <option value="entreprise">Entreprise</option>
      </select></div>
      <div class="form-field"><label class="form-label">Compagnie *</label><input class="form-input" id="ct-compagnie" value="${opp && opp.compagnie ? opp.compagnie : ''}" placeholder="Swiss Life, AXA, Helsana..." list="compagnies-suggestions" autocomplete="off" oninput="updateCommissionPreview()"/><datalist id="compagnies-suggestions">${getCompagniesConnues().map(c => `<option value="${c}">`).join('')}</datalist></div>
      <div class="form-field"><label class="form-label">Catégorie *</label><select class="form-select" id="ct-categorie" onchange="updateProduitOptions()"></select></div>
      <div class="form-field"><label class="form-label">Produit *</label><select class="form-select" id="ct-produit" onchange="updateModulesOptions(); updateCommissionPreview()"><option value="">— Sélectionner —</option></select></div>
      <div class="form-field" style="grid-column:span 2" id="ct-modules-field"><label class="form-label">Modules complémentaires</label><div id="ct-modules-list" style="display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:6px"></div></div>
      <div class="form-field" style="grid-column:span 2" id="ct-combinables-field"><label class="form-label">Produits souvent combinés</label><div id="ct-combinables-list" style="display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:6px"></div></div>
      <div class="form-field" style="grid-column:span 2;display:none" id="ct-plaques-field">
        <label class="form-label">Plaques d'immatriculation de la flotte</label>
        <div id="ct-plaques-list" style="display:flex;flex-direction:column;gap:6px;margin-top:6px"></div>
        <button type="button" class="btn-secondary" style="margin-top:8px;font-size:12px;padding:6px 14px" onclick="ajouterPlaqueFlotte()">+ Ajouter une plaque</button>
      </div>
      <div class="form-field"><label class="form-label">N° de police</label><input class="form-input" id="ct-police" placeholder="Optionnel"/></div>
      <div class="form-field"><label class="form-label">Prime (CHF) *</label><input class="form-input" id="ct-prime-mensuelle" type="number" placeholder="150" oninput="updateCommissionPreview()"/></div>
      <div class="form-field" id="ct-prime-risque-frais-field" style="display:none">
        <label class="form-label">Dont prime risque + frais (CHF/an) — base de calcul COG</label>
        <input class="form-input" id="ct-prime-risque-frais" type="number" placeholder="Hors part épargne" oninput="updateCommissionPreview()"/>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Swiss Life rémunère uniquement sur risque + frais, pas sur la part épargne de la prime totale ci-dessus.</div>
      </div>
      <div class="form-field"><label class="form-label">Périodicité</label><select class="form-select" id="ct-periodicite" onchange="updateCommissionPreview()">
        <option value="12">Mensuelle</option>
        <option value="4">Trimestrielle</option>
        <option value="2">Semestrielle</option>
        <option value="1">Annuelle</option>
      </select></div>
      <div class="form-field" id="ct-duree-field" style="display:none"><label class="form-label">Durée du contrat (années)</label><input class="form-input" id="ct-duree" type="number" placeholder="10" value="1" oninput="updateCommissionPreview()"/></div>
      <div class="form-field" id="ct-manuel-field"><label class="form-label">Montant manuel (CHF) — remplace le calcul automatique si rempli</label><input class="form-input" id="ct-manuel" type="number" placeholder="0 = laisser le calcul automatique" oninput="updateCommissionPreview()"/></div>
      <div class="form-field"><label class="form-label">Date de signature</label><input class="form-input" id="ct-date" type="date"/></div>
      <div class="form-field"><label class="form-label">Date d'échéance</label><input class="form-input" id="ct-echeance" type="date"/></div>
      <div class="form-field"><label class="form-label">Agent / Apporteur</label><select class="form-select" id="ct-apporteur">
        <option value="">— Aucun / pas de partage —</option>
        ${allAgents.map(a => `<option value="${a.id}" ${contratClientId && allClients.find(c=>c.id===contratClientId)?.apporteur_id===a.id ? 'selected' : ''}>${a.prenom} ${a.nom}${a.role==='signataire'?' (moi-même)':''}</option>`).join('')}
      </select></div>
      <div class="form-field"><label class="form-label">Statut</label><select class="form-select" id="ct-statut"><option value="actif">Actif</option><option value="en_cours">En cours de signature</option><option value="annulé">Annulé (réserve refusée / non abouti)</option></select></div>
      <div class="form-field"><label class="form-label">Commissionné ?</label><select class="form-select" id="ct-commissionne" onchange="document.getElementById('ct-rappel-note').style.display = this.value==='non' ? '' : 'none'"><option value="oui">Oui</option><option value="non">Non (pas de convention de collaboration)</option></select>
        <div id="ct-rappel-note" style="display:none;font-size:10.5px;color:var(--text-muted);margin-top:4px">ℹ️ Pas de commission créée. Un rappel sera généré 6 mois avant la date d'échéance pour proposer un transfert vers une compagnie partenaire.</div>
      </div>
      <div class="form-field"><label class="form-label">Nature de la commission</label><select class="form-select" id="ct-nature-commission" onchange="updateCommissionPreview()"><option value="acquisition">Acquisition (nouvelle affaire)</option><option value="gestion">Gestion (portefeuille existant)</option></select></div>
    </div>`)}
    <div id="commission-preview" style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:10px;padding:14px 18px;margin-top:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px" id="commission-preview-label">Commission d'acquisition estimée</div>
      <div id="commission-preview-value" style="font-size:20px;font-weight:900;color:var(--accent)">CHF 0</div>
      <div id="commission-preview-detail" style="font-size:11px;color:var(--text-muted);margin-top:2px"></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn-secondary" onclick="prefillOpportunite=null; navigate(contratClientId ? 'clients' : 'suivi')">Annuler</button>
      <button class="btn-save" onclick="saveContrat()">✓ Enregistrer le contrat</button>
    </div>`;
}

function initSegmentContrat() {
  const segmentSelect = document.getElementById('ct-segment');
  if (!segmentSelect) return;
  if (contratClientId) {
    const client = allClients.find(c => c.id === contratClientId);
    if (client) segmentSelect.value = estEntreprise(client) ? 'entreprise' : 'prive';
  }
  updateCategorieOptions();
  // Si on arrive depuis une opportunité gagnée, tente de présélectionner automatiquement
  // catégorie + produit à partir de son titre (ex: "RC entreprise — Acme SA" → RC entreprise / exploitation)
  if (prefillOpportunite && prefillOpportunite.titre) {
    appliquerProduitTrouve(trouverProduitCatalogue(prefillOpportunite.titre));
  }
}

function syncSegmentFromClient() {
  const clientSelect = document.getElementById('ct-client');
  const segmentSelect = document.getElementById('ct-segment');
  if (!clientSelect || !segmentSelect) return;
  const selectedOption = clientSelect.options[clientSelect.selectedIndex];
  const segment = selectedOption ? selectedOption.getAttribute('data-segment') : null;
  if (segment) {
    segmentSelect.value = segment;
    updateCategorieOptions();
  }
}

function getCategoriesPourSegment(segment) {
  return Object.keys(CATALOGUE_PRODUITS).filter(cat =>
    CATALOGUE_PRODUITS[cat].some(p => p.segment === segment || p.segment === 'tous')
  );
}

function updateCategorieOptions() {
  const segmentSelect = document.getElementById('ct-segment');
  const catSelect = document.getElementById('ct-categorie');
  if (!segmentSelect || !catSelect) return;
  const segment = segmentSelect.value;
  const categoriesDisponibles = getCategoriesPourSegment(segment);
  const categoriePrecedente = catSelect.value;
  catSelect.innerHTML = categoriesDisponibles.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  if (categoriesDisponibles.includes(categoriePrecedente)) catSelect.value = categoriePrecedente;
  updateProduitOptions();
}

function updateProduitOptions() {
  const segmentSelect = document.getElementById('ct-segment');
  const catSelect = document.getElementById('ct-categorie');
  const produitSelect = document.getElementById('ct-produit');
  if (!segmentSelect || !catSelect || !produitSelect) return;
  const segment = segmentSelect.value;
  const categorie = catSelect.value;
  const tousProduits = CATALOGUE_PRODUITS[categorie] || [];
  const produits = tousProduits.filter(p => p.segment === segment || p.segment === 'tous');
  produitSelect.innerHTML = '<option value="">— Sélectionner —</option>' + produits.map(p => `<option value="${p.label}">${p.label}</option>`).join('');
  // Pré-remplir la compagnie si le produit a une compagnie fixe
  produitSelect.onchange = function() {
    const val = this.value.trim().toLowerCase();
    const prodTrouve = produits.find(p => p.label.toLowerCase() === val);
    if (prodTrouve && prodTrouve.compagnie_fixe) {
      const compField = document.getElementById('ct-compagnie');
      if (compField && !compField.value) compField.value = prodTrouve.compagnie_fixe;
    }
    updateModulesOptions();
    updateCommissionPreview();
  };
  updateModulesOptions();
  updateCommissionPreview();
}

function getProduitParId(produitId) {
  for (const categorie in CATALOGUE_PRODUITS) {
    const trouve = CATALOGUE_PRODUITS[categorie].find(p => p.id === produitId);
    if (trouve) return trouve;
  }
  return null;
}

function getProduitSelectionne() {
  const catSelect = document.getElementById('ct-categorie');
  const produitInput = document.getElementById('ct-produit');
  if (!catSelect || !produitInput) return null;
  const texteTape = produitInput.value.trim().toLowerCase();
  if (!texteTape) return null;
  const categorie = catSelect.value;
  const produitsCategorie = CATALOGUE_PRODUITS[categorie] || [];
  let trouve = produitsCategorie.find(p => p.label.toLowerCase() === texteTape);
  if (trouve) return trouve;
  // Fallback : recherche dans tout le catalogue si pas trouvé dans la catégorie active
  for (const cat in CATALOGUE_PRODUITS) {
    trouve = CATALOGUE_PRODUITS[cat].find(p => p.label.toLowerCase() === texteTape);
    if (trouve) return trouve;
  }
  // Fallback 2 : correspondance partielle (utile après un import IA dont le texte libre ne colle pas
  // mot pour mot au libellé du catalogue, ex: "Responsabilité civile d'entreprise" vs "RC entreprise / exploitation")
  const motsTexte = texteTape.split(/[\s\/'’,-]+/).filter(m => m.length > 3);
  for (const cat in CATALOGUE_PRODUITS) {
    for (const p of CATALOGUE_PRODUITS[cat]) {
      const labelLower = p.label.toLowerCase();
      if (labelLower.includes(texteTape) || texteTape.includes(labelLower)) return p;
      // correspondance par mots-clés significatifs communs (au moins 1 mot de plus de 3 lettres partagé)
      const motsLabel = labelLower.split(/[\s\/'’,-]+/).filter(m => m.length > 3);
      if (motsTexte.some(m => motsLabel.includes(m))) return p;
    }
  }
  return null;
}

function updateModulesOptions() {
  const modulesList = document.getElementById('ct-modules-list');
  const combinablesField = document.getElementById('ct-combinables-field');
  const combinablesList = document.getElementById('ct-combinables-list');
  if (!modulesList) return;
  const produit = getProduitSelectionne();
  const modules = produit ? produit.modules : [];
  if (modules.length === 0) {
    modulesList.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Aucun module complémentaire pour ce produit.</span>';
    document.getElementById('ct-modules-field').style.display = 'none';
  } else {
    document.getElementById('ct-modules-field').style.display = 'block';
    modulesList.innerHTML = modules.map((m, i) => `
      <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text);cursor:pointer">
        <input type="checkbox" class="ct-module-checkbox" value="${m}" style="width:15px;height:15px;cursor:pointer"/>${m}
      </label>`).join('');
  }

  if (combinablesField && combinablesList) {
    const combinablesIds = produit ? (produit.combinables || []) : [];
    if (combinablesIds.length === 0) {
      combinablesField.style.display = 'none';
      combinablesList.innerHTML = '';
    } else {
      combinablesField.style.display = 'block';
      combinablesList.innerHTML = combinablesIds.map(id => {
        const p = getProduitParId(id);
        return p ? `
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text);cursor:pointer">
          <input type="checkbox" class="ct-combinable-checkbox" value="${p.id}" onchange="toggleCombinablePrime('${p.id}')" style="width:15px;height:15px;cursor:pointer"/>+ ${p.label}
        </label>` : '';
      }).join('') + '<div id="ct-combinables-primes" style="width:100%;margin-top:8px"></div>' +
        `<div id="ct-calculette-vehicule" style="display:none;width:100%;margin-top:10px;padding:12px 14px;background:var(--surface-alt);border:1px solid var(--border);border-radius:9px">
          <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">🧮 Calculette RC + Casco — remplis 2 montants, le 3e se calcule</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div><label class="form-label" style="font-size:10.5px">Prime totale (CHF)</label><input class="form-input" id="ct-calc-total" type="number" placeholder="1929.60" oninput="calculerSoldeVehicule('total')"/></div>
            <div><label class="form-label" style="font-size:10.5px">RC (CHF)</label><input class="form-input" id="ct-calc-rc" type="number" placeholder="327.60" oninput="calculerSoldeVehicule('rc')"/></div>
            <div><label class="form-label" style="font-size:10.5px">Casco (CHF)</label><input class="form-input" id="ct-calc-casco" type="number" placeholder="1602.00" oninput="calculerSoldeVehicule('casco')"/></div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:6px">Prime totale = montant final de la police (timbre fédéral et taxes déjà inclus). Remplis-en deux, le troisième se déduit automatiquement et se reporte dans les champs ci-dessus.</div>
        </div>`;
    }
  }

  const plaquesField = document.getElementById('ct-plaques-field');
  if (plaquesField) {
    if (produit && produit.flotte) {
      plaquesField.style.display = 'block';
      if (document.getElementById('ct-plaques-list').children.length === 0) ajouterPlaqueFlotte();
    } else {
      plaquesField.style.display = 'none';
      document.getElementById('ct-plaques-list').innerHTML = '';
    }
  }
}

function ajouterPlaqueFlotte() {
  const list = document.getElementById('ct-plaques-list');
  if (!list) return;
  const ligne = document.createElement('div');
  ligne.style.cssText = 'display:flex;gap:8px;align-items:center';
  ligne.innerHTML = `
    <input class="form-input ct-plaque-input" placeholder="VD 123456" style="flex:1"/>
    <input class="form-input ct-plaque-marque-input" placeholder="Marque / modèle (optionnel)" style="flex:1"/>
    <button type="button" onclick="this.parentElement.remove()" style="background:var(--red-dim);color:var(--red);border:none;border-radius:7px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer">✕</button>
  `;
  list.appendChild(ligne);
}

function toggleCombinablePrime(produitId) {
  const checkbox = document.querySelector(`.ct-combinable-checkbox[value="${produitId}"]`);
  const primesZone = document.getElementById('ct-combinables-primes');
  if (!checkbox || !primesZone) return;
  const produit = getProduitParId(produitId);
  const existant = document.getElementById(`ct-combinable-prime-${produitId}`);
  if (checkbox.checked && !existant) {
    const div = document.createElement('div');
    div.id = `ct-combinable-prime-${produitId}`;
    div.style.cssText = 'margin-top:6px';
    div.innerHTML = `<label class="form-label">Prime annuelle pour "${produit.label}" (CHF)</label><input class="form-input ct-combinable-prime-input" data-produit-id="${produitId}" type="number" placeholder="540"/><div style="font-size:10.5px;color:var(--text-muted);margin-top:3px">Casco/ménage sont facturés annuellement — indique le montant annuel, pas mensuel.</div>`;
    primesZone.appendChild(div);
  } else if (!checkbox.checked && existant) {
    existant.remove();
  }
  // La calculette RC+Casco n'a de sens que si au moins une case Casco/combinable est cochée
  const calculette = document.getElementById('ct-calculette-vehicule');
  if (calculette) {
    const auMoinsUneCochee = document.querySelectorAll('.ct-combinable-checkbox:checked').length > 0;
    calculette.style.display = auMoinsUneCochee ? 'block' : 'none';
  }
}

// Calculette RC + Casco : remplis 2 des 3 montants (Total / RC / Casco), le 3e se déduit par soustraction
// et se reporte automatiquement dans les vrais champs du formulaire (Prime RC + prime du 1er combinable coché).
function calculerSoldeVehicule(champModifie) {
  const totalEl = document.getElementById('ct-calc-total');
  const rcEl = document.getElementById('ct-calc-rc');
  const cascoEl = document.getElementById('ct-calc-casco');
  if (!totalEl || !rcEl || !cascoEl) return;
  const total = parseFloat(totalEl.value);
  const rc = parseFloat(rcEl.value);
  const casco = parseFloat(cascoEl.value);

  if (champModifie !== 'casco' && !isNaN(total) && !isNaN(rc)) {
    cascoEl.value = Math.round((total - rc) * 100) / 100;
  } else if (champModifie !== 'rc' && !isNaN(total) && !isNaN(casco)) {
    rcEl.value = Math.round((total - casco) * 100) / 100;
  } else if (champModifie !== 'total' && !isNaN(rc) && !isNaN(casco)) {
    totalEl.value = Math.round((rc + casco) * 100) / 100;
  }

  // Reporte les valeurs dans les vrais champs du formulaire (source de vérité pour l'enregistrement)
  const rcFinal = parseFloat(rcEl.value);
  const cascoFinal = parseFloat(cascoEl.value);
  if (!isNaN(rcFinal)) {
    const primeRC = document.getElementById('ct-prime-mensuelle');
    if (primeRC) { primeRC.value = rcFinal; updateCommissionPreview(); }
  }
  if (!isNaN(cascoFinal)) {
    const premierCombinable = document.querySelector('.ct-combinable-prime-input');
    if (premierCombinable) premierCombinable.value = cascoFinal;
  }
}

// Normalise les variantes connues d'un même assureur vers un nom canonique unique
// (ex: "Vaudoise Assurances" / "La Vaudoise" / "Vaudoise" -> "La Vaudoise") — le dédoublonnage
// insensible à la casse ne suffit pas puisque ce sont de vraies formulations différentes.
const ALIAS_COMPAGNIES = {
  'la vaudoise': 'La Vaudoise', 'vaudoise assurances': 'La Vaudoise', 'vaudoise': 'La Vaudoise',
  'la mobilière': 'La Mobilière', 'la mobiliere': 'La Mobilière', 'mobilière': 'La Mobilière', 'mobiliere': 'La Mobilière', 'mobilière suisse société d\u2019assurances': 'La Mobilière',
  'hotela assurances sa': 'HOTELA', 'hotela': 'HOTELA', 'institutions sociales hotela': 'HOTELA',
  'suva': 'SUVA', 'schweizerische unfallversicherungsanstalt': 'SUVA',
  'css assurances': 'CSS', 'css': 'CSS',
  'groupe mutuel': 'Groupe Mutuel', 'gmv sa': 'Groupe Mutuel',
  'swiss life': 'Swiss Life', 'swiss life sa': 'Swiss Life',
  'axa winterthur': 'AXA', 'axa assurances': 'AXA', 'axa': 'AXA',
  'zurich assurances': 'Zurich', 'zurich': 'Zurich',
  'generali assurances': 'Generali', 'generali': 'Generali',
  'baloise assurances': 'Baloise', 'bâloise': 'Baloise', 'baloise': 'Baloise',
  'helsana assurances': 'Helsana', 'helsana': 'Helsana',
  'sanitas assurances': 'Sanitas', 'sanitas': 'Sanitas',
  'allianz suisse': 'Allianz', 'allianz': 'Allianz',
  'visana assurances': 'Visana', 'visana': 'Visana',
  'swica assurances': 'SWICA', 'swica': 'SWICA',
};
function normaliserCompagnie(nom) {
  if (!nom) return nom;
  const cle = nom.trim().toLowerCase();
  return ALIAS_COMPAGNIES[cle] || nom.trim();
}

function getCompagniesConnues() {
  const base = ['Swiss Life', 'AXA', 'Helsana', 'Sanitas', 'Allianz', 'Zurich', 'Generali', 'Baloise', 'CSS', 'Groupe Mutuel', 'Visana', 'SWICA'];
  // Source prioritaire : Paramètres → Contacts compagnies (Supabase, synchronisé pour toute l'équipe)
  const depuisParametres = (allCompagniesContacts || []).map(c => c.compagnie).filter(Boolean);
  let memorisees = [];
  try { memorisees = JSON.parse(localStorage.getItem('compagnies_memorisees') || '[]'); } catch (e) {}
  // Dédoublonnage : d'abord normaliser les vraies variantes de nom (alias), puis insensible à la casse/espaces
  const vues = new Map();
  [...depuisParametres, ...base, ...memorisees].forEach(nom => {
    const nomNormalise = normaliserCompagnie(nom);
    const cle = nomNormalise.trim().toLowerCase();
    if (!vues.has(cle)) vues.set(cle, nomNormalise);
  });
  return [...vues.values()].sort();
}

function memoriserCompagnie(nom) {
  if (!nom) return;
  const nomNormalise = normaliserCompagnie(nom);
  let memorisees = [];
  try { memorisees = JSON.parse(localStorage.getItem('compagnies_memorisees') || '[]'); } catch (e) {}
  if (!memorisees.some(c => c.toLowerCase() === nomNormalise.toLowerCase())) {
    memorisees.push(nomNormalise);
    localStorage.setItem('compagnies_memorisees', JSON.stringify(memorisees));
  }
}

function calculerCommissionEstimee() {
  const produit = getProduitSelectionne();
  const produitId = produit ? produit.id : null;
  const primeMensuelle = parseFloat(document.getElementById('ct-prime-mensuelle').value) || 0;
  const periodicite = parseInt(document.getElementById('ct-periodicite')?.value) || 12;
  const primeAnnuelle = Math.round(primeMensuelle * periodicite);

  // Le montant saisi manuellement a TOUJOURS priorité s'il est renseigné (> 0),
  // quel que soit le produit — corrige d'anciens champs "manuel" qui étaient visibles
  // à l'écran (LPP, LAMal) mais silencieusement ignorés par le calcul automatique.
  const manuelInput = document.getElementById('ct-manuel');
  const montantManuel = manuelInput ? parseFloat(manuelInput.value) || 0 : 0;
  if (montantManuel > 0) {
    return { montant: montantManuel, detail: 'Saisie manuelle (remplace le calcul automatique)' };
  }

  // ── HOTELA — Convention de collaboration (dès 01.05.2026) ──────────────
  // Le taux dépend de la compagnie choisie, pas seulement du produit — vérifié en premier
  // pour ces 4 produits, avant toute formule générique (ex: LPP Swiss Life ci-dessous).
  const compagnieChoisie = (document.getElementById('ct-compagnie')?.value || '').trim().toLowerCase();
  if (compagnieChoisie.includes('hotela')) {
    if (produitId === 'perte_gain_maladie_collective') {
      const montant = Math.round(primeAnnuelle * TAUX_COMMISSION.hotela.ij_maladie / 100);
      return { montant, detail: `HOTELA — Indemnités journalières maladie : ${TAUX_COMMISSION.hotela.ij_maladie}% × CHF ${primeAnnuelle} = CHF ${montant}` };
    }
    if (produitId === 'laa') {
      const montant = Math.round(primeAnnuelle * TAUX_COMMISSION.hotela.accidents / 100);
      return { montant, detail: `HOTELA — Assurance-accidents : ${TAUX_COMMISSION.hotela.accidents}% × CHF ${primeAnnuelle} = CHF ${montant}` };
    }
    if (produitId === 'perte_gain_accident_collective' || produitId === 'laac') {
      const montant = Math.round(primeAnnuelle * TAUX_COMMISSION.hotela.accidents_complementaire / 100);
      return { montant, detail: `HOTELA — Assurance-accidents complémentaire : ${TAUX_COMMISSION.hotela.accidents_complementaire}% × CHF ${primeAnnuelle} = CHF ${montant}` };
    }
    if (produitId === 'lpp_entreprise') {
      const montantBrut = Math.round(primeAnnuelle * TAUX_COMMISSION.hotela.lpp / 100);
      const plafond = TAUX_COMMISSION.hotela.lpp_plafond;
      const montant = Math.min(montantBrut, plafond);
      return {
        montant,
        detail: `HOTELA — Prévoyance professionnelle : ${TAUX_COMMISSION.hotela.lpp}% × CHF ${primeAnnuelle} = CHF ${montantBrut}${montantBrut > plafond ? ` — plafonné à CHF ${plafond.toLocaleString()}/an (preneur soumis CCNT hôtellerie-restauration)` : ''}`,
      };
    }
  }

  // ── Santé / complémentaire ──────────────────────────────────────────────
  if (produitId === 'sante_complementaire') {
    const montant = Math.round(primeMensuelle * TAUX_COMMISSION.sante_facteur_mensuel);
    return { montant, detail: `CHF ${primeMensuelle}/mois × ${TAUX_COMMISSION.sante_facteur_mensuel} (taux santé) = CHF ${montant}` };
  }

  // ── Vie / 3a ────────────────────────────────────────────────────────────
  if (produitId === 'vie_3a') {
    const duree = parseFloat(document.getElementById('ct-duree')?.value) || 1;
    const capitalProduction = primeMensuelle * 12 * duree;
    const montant = Math.round(capitalProduction * (TAUX_COMMISSION.vie_taux_capital / 100));
    return { montant, detail: `${TAUX_COMMISSION.vie_taux_capital}% × CHF ${capitalProduction.toLocaleString()} (capital = ${primeMensuelle} × 12 × ${duree} ans) = CHF ${montant}` };
  }

  // ── LPP (prévoyance professionnelle 2e pilier) ─────────────────────────
  // Formule COG Swiss Life : (prime risque + frais, HORS part épargne) × FP 1.20 × taux 6.3%
  // Source : Annexe B convention SL1102, valable dès 01.01.2024
  // Swiss Life ne rémunère que sur risque + frais — jamais sur la part épargne de la prime totale.
  if (produitId === 'lpp_entreprise') {
    const primeRisqueFrais = parseFloat(document.getElementById('ct-prime-risque-frais')?.value) || 0;
    const baseCalcul = primeRisqueFrais > 0 ? primeRisqueFrais : primeAnnuelle;
    if (baseCalcul < 2000) {
      return { montant: 0, detail: `Base de calcul CHF ${baseCalcul} < CHF 2\u2019000 minimum — aucune COG Swiss Life` };
    }
    const cogAnnuelle = Math.round(baseCalcul * TAUX_COMMISSION.lpp_fp * (TAUX_COMMISSION.lpp_taux / 100));
    const cogTrimestrielle = Math.round(cogAnnuelle / 4);
    const avertissement = primeRisqueFrais > 0 ? '' : ' ⚠️ Prime risque+frais non renseignée ci-dessus — calcul sur la prime TOTALE, probablement surestimé (inclut la part épargne).';
    return {
      montant: cogAnnuelle,
      detail: `COG Swiss Life : CHF ${baseCalcul} (risque+frais) × ${TAUX_COMMISSION.lpp_fp} (FP) × ${TAUX_COMMISSION.lpp_taux}% = CHF ${cogAnnuelle}/an (CHF ${cogTrimestrielle}/trimestre, versée en mars/juin/sept/déc)${avertissement}`,
    };
  }

  // ── LAMal — forfait unique CHF 70.- à la signature ─────────────────────
  if (produitId === 'lamal' || (produitId && produitId.toLowerCase().includes('lamal'))) {
    return {
      montant: TAUX_COMMISSION.lamal_forfait,
      detail: `LAMal : forfait unique CHF ${TAUX_COMMISSION.lamal_forfait} à la signature`,
    };
  }
  return { montant: 0, detail: 'Saisis le montant estimé ci-dessous' };
}

function updateCommissionPreview() {
  const produit = getProduitSelectionne();
  const produitId = produit ? produit.id : null;
  document.getElementById('ct-duree-field').style.display = produitId === 'vie_3a' ? 'block' : 'none';
  document.getElementById('ct-manuel-field').style.display = 'block';
  const compagnieChoisie = (document.getElementById('ct-compagnie')?.value || '').trim().toLowerCase();
  const champRisqueFrais = document.getElementById('ct-prime-risque-frais-field');
  if (champRisqueFrais) champRisqueFrais.style.display = (produitId === 'lpp_entreprise' && compagnieChoisie.includes('swiss life')) ? 'block' : 'none';
  const { montant, detail } = calculerCommissionEstimee();
  document.getElementById('commission-preview-value').textContent = 'CHF ' + montant.toLocaleString();
  document.getElementById('commission-preview-detail').textContent = detail;
  const natureEl = document.getElementById('ct-nature-commission');
  const labelEl = document.getElementById('commission-preview-label');
  if (natureEl && labelEl) labelEl.textContent = natureEl.value === 'gestion' ? 'Commission de gestion estimée' : 'Commission d\u2019acquisition estimée';
}

async function creerContratEtCommission(clientId, compagnie, produitLabel, primeMensuelle, modules, montantCommission, detailCommission, plaques, dejaAnnuelle) {
  const commissionne = document.getElementById('ct-commissionne').value !== 'non';
  const contratBody = {
    client_id: clientId,
    apporteur_id: document.getElementById('ct-apporteur').value || null,
    compagnie,
    produit: produitLabel,
    modules: modules && modules.length > 0 ? modules.join(', ') : null,
    plaques: plaques && plaques.length > 0 ? plaques.join(', ') : null,
    numero_police: document.getElementById('ct-police').value.trim() || null,
    prime_annuelle: dejaAnnuelle ? Math.round(primeMensuelle) : Math.round(primeMensuelle * (parseInt(document.getElementById('ct-periodicite')?.value) || 12)),
    date_debut: document.getElementById('ct-date').value || null,
    date_echeance: document.getElementById('ct-echeance').value || null,
    statut: document.getElementById('ct-statut').value,
    commissionne,
  };
  const rContrat = await dbPost('contrats', contratBody);
  if (rContrat && rContrat.error) return { error: true, detail: rContrat.detail || rContrat.status };
  logAction('create_contrat', 'contrats', rContrat && rContrat[0] ? rContrat[0].id : null, `${produitLabel} — ${compagnie}`);

  const client = allClients.find(c => c.id === clientId);

  // Contrat non commissionné OU créé directement en "Annulé" : pas de commission générée
  if (!commissionne || contratBody.statut === 'annulé') {
    if (!commissionne && contratBody.date_echeance) {
      const dEch = new Date(contratBody.date_echeance);
      dEch.setMonth(dEch.getMonth() - 6);
      const nomClient = client ? (estEntreprise(client) ? client.nom : `${client.prenom} ${client.nom}`) : '';
      const rRappel = await dbPost('rappels', {
        titre: `Reprendre "${produitLabel}" de ${nomClient} (actuellement ${compagnie}, non partenaire)`,
        client_id: clientId,
        type: 'Contrat',
        urgence: 'moyenne',
        date_echeance: dEch.toISOString().split('T')[0],
        notes: `Police actuellement chez ${compagnie} (compagnie non partenaire) — échéance le ${contratBody.date_echeance}. Objectif : proposer un transfert vers une compagnie partenaire pour générer une commission.`,
        statut: 'ouvert',
      });
      if (rRappel && rRappel.error) console.error('Échec de création du rappel de transfert automatique :', errMsg(rRappel));
      allRappels = await dbGet('rappels', 'select=*');
    }
    return { error: false, contrat: rContrat && rContrat[0] ? rContrat[0] : null };
  }
  const commissionBody = {
    client_id: clientId,
    client_nom: client ? (estEntreprise(client) ? client.nom : `${client.prenom} ${client.nom}`) : '',
    compagnie,
    produit: produitLabel,
    montant_estime: montantCommission,
    detail_calcul: detailCommission,
    statut: 'en_attente',
    nature: document.getElementById('ct-nature-commission')?.value || 'acquisition',
    date_creation: new Date().toISOString().split('T')[0],
    contrat_id: rContrat && rContrat[0] ? rContrat[0].id : null,
  };
  const rComm = await dbPost('commissions_attente', commissionBody);
  return { error: false, commissionError: rComm && rComm.error, contrat: rContrat && rContrat[0] ? rContrat[0] : null };
}

async function saveContrat() {
  const clientSelectEl = document.getElementById('ct-client');
  const clientId = clientSelectEl ? clientSelectEl.value : contratClientId;
  if (!clientId) { showError('Sélectionne un client.'); return; }

  const compagnie = document.getElementById('ct-compagnie').value.trim();
  const produitSelectionne = getProduitSelectionne();
  const primeMensuelle = parseFloat(document.getElementById('ct-prime-mensuelle').value) || 0;
  if (!compagnie || !primeMensuelle) { showError('Compagnie et prime sont obligatoires.'); return; }
  if (!produitSelectionne) { showError('Sélectionne un produit valide dans la liste proposée.'); return; }

  // Vérifier que les produits combinés cochés ont bien une prime renseignée
  const combinablesCoches = Array.from(document.querySelectorAll('.ct-combinable-checkbox:checked')).map(cb => cb.value);
  for (const id of combinablesCoches) {
    const input = document.querySelector(`.ct-combinable-prime-input[data-produit-id="${id}"]`);
    if (!input || !parseFloat(input.value)) { showError('Renseigne la prime annuelle pour chaque produit combiné coché.'); return; }
  }

  const produitLabel = produitSelectionne.label;
  const modulesChoisis = Array.from(document.querySelectorAll('.ct-module-checkbox:checked')).map(cb => cb.value);
  const { montant: commissionEstimee, detail } = calculerCommissionEstimee();

  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;

  const plaquesValeurs = Array.from(document.querySelectorAll('.ct-plaque-input')).map(inp => inp.value.trim()).filter(Boolean);
  const resultPrincipal = await creerContratEtCommission(clientId, compagnie, produitLabel, primeMensuelle, modulesChoisis, commissionEstimee, detail, plaquesValeurs);
  if (resultPrincipal.error) { showError('Erreur lors de la création du contrat: ' + resultPrincipal.detail); btn.textContent = '✓ Enregistrer le contrat'; btn.disabled = false; return; }

  // Si le contrat provient d'un import de police PDF par l'IA, on archive ce même PDF sur le contrat
  // — permet d'ouvrir le document d'origine en un clic pour vérifier la saisie (même mécanisme que
  // l'attache manuelle depuis la fiche contrat : champs police_url / police_nom).
  if (window._policePdfFileFromImport && resultPrincipal.contrat && resultPrincipal.contrat.id) {
    const file = window._policePdfFileFromImport;
    const newContratId = resultPrincipal.contrat.id;
    try {
      const nomFichier = `${compagnie}_${produitLabel}_${resultPrincipal.contrat.numero_police || newContratId}`
        .replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);
      const path = `polices/${newContratId}/${nomFichier}.pdf`;
      const uploadToken = await getValidAccessToken() || SUPABASE_KEY;
      let uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${uploadToken}`, 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!uploadRes.ok) {
        uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
          method: 'PUT',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${uploadToken}`, 'Content-Type': 'application/pdf' },
          body: file,
        });
      }
      if (uploadRes.ok) {
        await dbPatch('contrats', newContratId, { police_url: path, police_nom: file.name });
        logAction('upload_police', 'contrats', newContratId, file.name);
      }
    } catch (e) { /* upload échoué, le contrat reste créé sans police jointe */ }
    window._policePdfFileFromImport = null;
  }

  memoriserCompagnie(compagnie);

  // Créer un contrat + commission distincts pour chaque produit combiné coché
  for (const id of combinablesCoches) {
    const produitCombinable = getProduitParId(id);
    const input = document.querySelector(`.ct-combinable-prime-input[data-produit-id="${id}"]`);
    const primeCombinableAnnuelle = parseFloat(input.value) || 0;
    const montantCombinable = Math.round(primeCombinableAnnuelle * 0.1); // estimation par défaut (10% fictif) — ajustable manuellement ensuite
    await creerContratEtCommission(clientId, compagnie, produitCombinable.label, primeCombinableAnnuelle, [], montantCombinable, 'Produit combiné — commission estimée à ajuster', null, true);
  }

  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  allContrats = await dbGet('contrats', 'select=*');

  // Si ce contrat provient d'une opportunité passée en "Gagné", on la lie au contrat créé
  if (prefillOpportunite && prefillOpportunite.id && resultPrincipal.contrat && resultPrincipal.contrat.id) {
    const rOpp = await dbPatch('opportunites', prefillOpportunite.id, { contrat_id: resultPrincipal.contrat.id });
    if (rOpp && rOpp.error) showError('⚠️ Contrat créé, mais le lien avec l\u2019opportunité n\u2019a pas pu être enregistré : ' + errMsg(rOpp));
    allOpportunites = await dbGet('opportunites', 'select=*');
    prefillOpportunite = null;
  }

  if (contratClientId) {
    showClient(contratClientId);
  } else {
    navigate('suivi');
  }
}

// ═══ TOUTES LES COMMISSIONS — vue unifiée et recherchable (en attente + reçues) ═══
// ═══ Édition d'une commission (ouvrir/modifier depuis "Toutes les commissions") ═══
