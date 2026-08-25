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
          ${data.lignes.map(l => `<div style="font-size:11.5px;color:var(--text-muted);padding:4px 0;border-bottom:1px solid var(--border)">${l.client_nom || '—'} · ${l.produit || ''} · ${l.type_mouvement || ''} · CHF ${fmtCHF(l.credit || l.debit || 0)}</div>`).join('')}
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
        <datalist id="bordereau-compagnies-suggestions">${[...new Set((allCompagniesContacts||[]).map(c => normaliserCompagnie(c.compagnie)).filter(Boolean))].sort().map(nom => `<option value="${nom}">`).join('')}</datalist>
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
  const compagnie = normaliserCompagnie(document.getElementById('b-compagnie').value.trim());
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
    // Plaque / marque / modèle — uniquement présents dans data si l'IA a détecté une police
    // véhicule (voir prompt parse_police côté edge function). updateModulesOptions(), déjà
    // appelé par appliquerProduitTrouve() ci-dessus, a créé la ligne #ct-plaques-list si le
    // produit détecté est bien un véhicule (RC véhicule / casco / flotte) — on la peuple ici
    // pour que le véhicule remonte dans la table `vehicules` (et donc dans Recherche véhicules)
    // à l'enregistrement du contrat, exactement comme une saisie manuelle.
    if (data.numero_plaque || data.marque || data.modele) {
      const premiereLigne = document.querySelector('#ct-plaques-list > div');
      if (premiereLigne) {
        const plaqueInput = premiereLigne.querySelector('.ct-plaque-input');
        const marqueInput = premiereLigne.querySelector('.ct-plaque-marque-input');
        if (plaqueInput && data.numero_plaque) plaqueInput.value = data.numero_plaque;
        if (marqueInput) marqueInput.value = [data.marque, data.modele].filter(Boolean).join(' ');
      }
    }
    if (data.numero_police) document.getElementById('ct-police').value = data.numero_police;
    if (data.date_debut) document.getElementById('ct-date').value = data.date_debut;
    if (data.date_echeance) document.getElementById('ct-echeance').value = data.date_echeance;
    if (Array.isArray(data.lignes_prime) && data.lignes_prime.length > 0) {
      // La police détaille la prime poste par poste (ex: RC privée, inventaire du ménage, modules
      // complémentaires, taxes légales) — on reporte chaque ligne telle quelle, le total se
      // recalcule automatiquement en sommant ces lignes (jamais resaisi/dupliqué à la main).
      initLignesPrimeDepuisLignes(data.lignes_prime);
      document.getElementById('ct-periodicite').value = '1';
    } else if (data.prime_mensuelle) {
      // Pas de détail par poste, mais une prime réellement mensuelle (ex: santé complémentaire)
      initLignesPrimeDepuisMontant(data.prime_mensuelle, 'Prime (import PDF)');
      document.getElementById('ct-periodicite').value = '12';
    } else if (data.prime_annuelle) {
      // Pas de détail par poste : un seul montant global déjà annuel (ex: RC, véhicule)
      initLignesPrimeDepuisMontant(data.prime_annuelle, 'Prime (import PDF)');
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
      ✓ Pré-rempli depuis l'opportunité gagnée <strong>"${opp.titre}"</strong> — montant potentiel estimé : <strong>CHF ${fmtCHF((opp.montant_potentiel||0))}</strong>. Vérifie/ajuste la prime exacte ci-dessous avant d'enregistrer.
      ${oppFileAttenteProduits.length ? `<div style="margin-top:6px;color:var(--accent)">📋 ${oppFileAttenteProduits.length} autre(s) contrat(s) à créer ensuite pour cette même opportunité, une fois celui-ci enregistré.</div>` : ''}
      ${!opp.client_id && opp.prospect_nom ? `<div style="margin-top:8px;color:#f59e0b">⚠ "<strong>${opp.prospect_nom}</strong>" n'a pas encore de fiche client — sélectionne un client existant ci-dessous, ou <a href="#" onclick="navigate('nouveau-client'); return false;" style="color:#f59e0b;text-decoration:underline">crée sa fiche maintenant</a> puis reviens enregistrer ce contrat.</div>` : ''}
    </div>` : ''}
    ${sectionCard('Informations contrat', '#4ade80', `<div class="form-grid">
      ${!contratClientId ? `<div class="form-field" style="grid-column:span 2"><label class="form-label">Client *</label><select class="form-select" id="ct-client" onchange="syncSegmentFromClient()"><option value="">— Sélectionner un client —</option>${clientOptions}</select></div>` : ''}
      <div class="form-field"><label class="form-label">Type de client *</label><select class="form-select" id="ct-segment" onchange="updateCategorieOptions()">
        <option value="prive">Privé</option>
        <option value="entreprise">Entreprise</option>
      </select></div>
      <div class="form-field"><label class="form-label">Compagnie *</label><input class="form-input" id="ct-compagnie" value="${opp && opp.compagnie ? opp.compagnie : ''}" placeholder="Swiss Life, AXA, Helsana..." list="compagnies-suggestions" autocomplete="off" oninput="refreshCategoriesLignesPrime(); updateCommissionPreview(); refreshLcaLignesOptions()" onchange="appliquerRestrictionCategorieCompagnie()"/><datalist id="compagnies-suggestions">${getCompagniesConnues(getProduitSelectionne() ? getProduitSelectionne().id : null).map(c => `<option value="${c}">`).join('')}</datalist></div>
      <div class="form-field"><label class="form-label">Catégorie *</label><select class="form-select" id="ct-categorie" onchange="updateProduitOptions()"></select></div>
      <div class="form-field"><label class="form-label">Produit *</label><select class="form-select" id="ct-produit" onchange="updateModulesOptions(); updateCommissionPreview()"><option value="">— Sélectionner —</option></select></div>
      <div class="form-field" style="grid-column:span 2" id="ct-modules-field"><label class="form-label">Modules complémentaires</label><div id="ct-modules-list" style="display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:6px"></div><div style="font-size:10px;color:var(--text-muted);margin-top:4px" id="ct-modules-hint"></div>
        <div id="ct-modules-custom-list" style="margin-top:8px"></div>
        <button type="button" onclick="ajouterModuleComplementaire()" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:6px 12px;font-size:11.5px;font-weight:700;cursor:pointer;margin-top:6px">+ Ajouter un module complémentaire</button>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px">Ex: "Assurances complémentaires et services" (AXA) — sert à lister les options incluses dans la police, à titre de détail. Si cette option a sa propre prime à reporter dans le total, ajoute-la plutôt comme "ligne de prime" ci-dessous (section "Lignes de prime").</div>
      </div>
      <div class="form-field" style="grid-column:span 2" id="ct-combinables-field"><label class="form-label">Produits souvent combinés</label><div id="ct-combinables-list" style="display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:6px"></div></div>
      <div class="form-field" style="grid-column:span 2;display:none" id="ct-plaques-field">
        <label class="form-label" id="ct-plaques-label">Plaques d'immatriculation de la flotte</label>
        <div id="ct-plaques-list" style="display:flex;flex-direction:column;gap:6px;margin-top:6px"></div>
        <button type="button" class="btn-secondary" id="ct-plaques-add-btn" style="margin-top:8px;font-size:12px;padding:6px 14px" onclick="ajouterPlaqueFlotte()">+ Ajouter une plaque</button>
      </div>
      <div class="form-field"><label class="form-label">N° de police</label><input class="form-input" id="ct-police" placeholder="Optionnel"/></div>
      <div class="form-field" style="grid-column:span 2" id="ct-prime-lignes-field">
        <label class="form-label"><span id="ct-prime-lignes-label-text">Lignes de prime *</span> <span id="ct-prime-lignes-hint" style="font-weight:400;color:var(--text-muted);font-size:10px">(reporte chaque ligne de la police — ex: Responsabilité civile privée, Inventaire du ménage, Assurances complémentaires et services, Taxes légales)</span></label>
        <div id="ct-prime-lignes-list" style="display:flex;flex-direction:column;gap:6px;margin-top:6px"></div>
        <button type="button" id="ct-prime-lignes-add-btn" onclick="ajouterLignePrime()" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:6px 12px;font-size:11.5px;font-weight:700;cursor:pointer;margin-top:8px">+ Ajouter une ligne</button>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <span style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Prime totale <span style="font-weight:400;text-transform:none">(hors taxes — base de commission)</span></span>
          <span id="ct-prime-total-affiche" style="font-size:17px;font-weight:900;color:var(--accent)">CHF 0</span>
        </div>
        <div id="ct-prime-taxes-note" style="font-size:10px;color:var(--text-muted);margin-top:3px;text-align:right"></div>
        <input type="hidden" id="ct-prime-mensuelle" value=""/>
      </div>
      <div class="form-field" id="ct-produit-swisslife-lpp-field" style="display:none">
        <label class="form-label">Produit Swiss Life exact — détermine le facteur produit (FP)</label>
        <select class="form-select" id="ct-produit-swisslife-lpp" onchange="updateCommissionPreview()">
          <option value="">— Sélectionner —</option>
          ${Object.keys(SWISS_LIFE_LPP_FP).map(nom => `<option value="${nom}">${nom} (FP ${SWISS_LIFE_LPP_FP[nom].toFixed(2)})</option>`).join('')}
        </select>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Annexe A à la convention d'indemnisation Prévoyance professionnelle (PP), valable dès 01.01.2024 — le FP varie selon le produit exact, jamais 1.20 partout.</div>
      </div>
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
      <div class="form-field"><label class="form-label">Date d'entrée en vigueur</label><input class="form-input" id="ct-date" type="date"/></div>
      <div class="form-field"><label class="form-label">Date de signature</label><input class="form-input" id="ct-date-signature" type="date"/></div>
      <div class="form-field"><label class="form-label">Date d'échéance</label><input class="form-input" id="ct-echeance" type="date"/></div>
      <div class="form-field"><label class="form-label">Agent / Apporteur</label><select class="form-select" id="ct-apporteur">
        <option value="">— Aucun / pas de partage —</option>
        ${allAgents.map(a => `<option value="${a.id}" ${contratClientId && allClients.find(c=>c.id===contratClientId)?.apporteur_id===a.id ? 'selected' : ''}>${a.prenom} ${a.nom}${a.role==='signataire'?' (moi-même)':''}</option>`).join('')}
      </select></div>
      <div class="form-field"><label class="form-label">Co-apporteur (si client apporté à 2 — répartition 1/3 chacun + 1/3 signataire)</label><select class="form-select" id="ct-co-apporteur">
        <option value="">— Aucun —</option>
        ${allAgents.filter(a => a.role !== 'signataire').map(a => `<option value="${a.id}">${a.prenom} ${a.nom}</option>`).join('')}
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
      <button class="btn-secondary" onclick="prefillOpportunite=null; prefillOpportuniteProduitId=null; oppFileAttenteProduits=[]; navigate(contratClientId ? 'clients' : 'suivi')">Annuler</button>
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
  // 3 lignes vides par défaut, prêtes à recevoir les tarifs de la police (RC privée, inventaire
  // du ménage, modules complémentaires, taxes légales, etc.) — le total se calcule automatiquement.
  const lignesList = document.getElementById('ct-prime-lignes-list');
  if (lignesList && !lignesList.children.length) {
    ajouterLignePrime(); ajouterLignePrime(); ajouterLignePrime();
    calculerPrimeTotaleLignes();
  }
  updateCategorieOptions();
  // Si on arrive depuis une opportunité gagnée : priorité au produit précis choisi au pipeline
  // (prefillOpportuniteProduitId, id exact — cf. proposerConversionMultiContrats / conversion
  // simple) ; à défaut (anciennes opportunités sans produits sélectionnés), on retombe sur la
  // devinette depuis le titre libre, comme avant.
  if (prefillOpportuniteProduitId) {
    appliquerProduitTrouve(produitCategorieEtObjetParId(prefillOpportuniteProduitId));
  } else if (prefillOpportunite && prefillOpportunite.titre) {
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
  let categoriesDisponibles = getCategoriesPourSegment(segment);
  const compagnieTexte = document.getElementById('ct-compagnie')?.value || '';
  if (compagnieEstAssureurSantePur(compagnieTexte) && categoriesDisponibles.includes('Santé')) {
    categoriesDisponibles = ['Santé'];
  }
  if (compagnieEstAssureurViePur(compagnieTexte)) {
    categoriesDisponibles = categoriesDisponibles.filter(c => c === 'Prévoyance' || c === 'Prévoyance privée');
  }
  const categoriePrecedente = catSelect.value;
  catSelect.innerHTML = categoriesDisponibles.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  if (categoriesDisponibles.includes(categoriePrecedente)) catSelect.value = categoriePrecedente;
  updateProduitOptions();
}

// Rappelée quand la compagnie change (ex: on tape "Helsana") pour restreindre "Catégorie" à Santé
// uniquement — sans perturber une saisie déjà faite si la restriction ne change rien à la liste
// actuellement affichée (évite de réinitialiser le Produit à chaque frappe dans "Compagnie").
function appliquerRestrictionCategorieCompagnie() {
  const catSelect = document.getElementById('ct-categorie');
  const segmentSelect = document.getElementById('ct-segment');
  if (!catSelect || !segmentSelect) return;
  const segment = segmentSelect.value;
  const compagnieTexte = document.getElementById('ct-compagnie')?.value || '';
  let categoriesDisponibles = getCategoriesPourSegment(segment);
  if (compagnieEstAssureurSantePur(compagnieTexte) && categoriesDisponibles.includes('Santé')) {
    categoriesDisponibles = ['Santé'];
  }
  if (compagnieEstAssureurViePur(compagnieTexte)) {
    categoriesDisponibles = categoriesDisponibles.filter(c => c === 'Prévoyance' || c === 'Prévoyance privée');
  }
  const optionsActuelles = Array.from(catSelect.options).map(o => o.value);
  const inchange = optionsActuelles.length === categoriesDisponibles.length && optionsActuelles.every((v, i) => v === categoriesDisponibles[i]);
  if (inchange) return;
  const categoriePrecedente = catSelect.value;
  catSelect.innerHTML = categoriesDisponibles.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  if (categoriesDisponibles.includes(categoriePrecedente)) {
    catSelect.value = categoriePrecedente;
  } else {
    catSelect.value = categoriesDisponibles[0] || '';
    updateProduitOptions();
  }
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
    refreshCompagniesSuggestions();
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
  //
  // Refonte du 07.08.2026 (retour Jonathan : le texte libre pour LAA/LAAC/perte de gain
  // "référence souvent en Prévoyance") — l'ancienne version rendait le PREMIER mot-clé partagé
  // trouvé en itérant les catégories dans leur ordre de déclaration. Comme 'Prévoyance' est
  // déclarée avant 'Assurances de personnes (entreprise)' dans CATALOGUE_PRODUITS, et que des
  // mots très génériques ("entreprise", "collective") apparaissent dans les deux (ex: "LPP
  // collective (2e pilier entreprise)"), un texte comme "perte de gain maladie collective"
  // tombait sur la LPP avant même d'atteindre la bonne catégorie. Deux correctifs :
  //  1. la catégorie actuellement sélectionnée (`categorie`) est toujours scannée EN PREMIER ;
  //  2. les mots-clés trop génériques (STOPWORDS ci-dessous) ne comptent plus comme signal de
  //     correspondance, et on garde le MEILLEUR score (nombre de mots partagés) plutôt que le
  //     premier trouvé.
  const STOPWORDS_RECHERCHE_PRODUIT = new Set(['entreprise', 'entreprises', 'collective', 'collectif', 'assurance', 'assurances', 'complementaire', 'complémentaire', 'privee', 'privée', 'prive', 'privé', 'individuel', 'individuelle', 'obligatoire']);
  const motsTexte = texteTape.split(/[\s\/'’,-]+/).filter(m => m.length > 3);
  const motsTexteSignificatifs = motsTexte.filter(m => !STOPWORDS_RECHERCHE_PRODUIT.has(m));

  function meilleureCorrespondance(categories) {
    let meilleur = null, meilleurScore = 0;
    for (const cat of categories) {
      for (const p of CATALOGUE_PRODUITS[cat]) {
        const labelLower = p.label.toLowerCase();
        if (labelLower.includes(texteTape) || texteTape.includes(labelLower)) return p; // correspondance forte, retour immédiat
        const motsLabel = labelLower.split(/[\s\/'’,-]+/).filter(m => m.length > 3);
        const score = motsTexteSignificatifs.filter(m => motsLabel.includes(m)).length;
        if (score > meilleurScore) { meilleurScore = score; meilleur = p; }
      }
    }
    return meilleur;
  }

  if (categorie && CATALOGUE_PRODUITS[categorie]) {
    const dansCategorieActuelle = meilleureCorrespondance([categorie]);
    if (dansCategorieActuelle) return dansCategorieActuelle;
  }
  const autresCategories = Object.keys(CATALOGUE_PRODUITS).filter(cat => cat !== categorie);
  const ailleurs = meilleureCorrespondance(autresCategories);
  if (ailleurs) return ailleurs;
  return null;
}

// ═══ Lignes de prime (Nouveau contrat) — chaque ligne de la police (RC privée, inventaire du
// ménage, modules complémentaires, taxes légales, etc.) est saisie séparément ; la prime totale
// est calculée une seule fois, automatiquement, comme somme de ces lignes — jamais ressaisie à la main.
function ajouterLignePrime(libelle = '', montant = '') {
  const list = document.getElementById('ct-prime-lignes-list');
  if (!list) return;
  const ligne = document.createElement('div');
  ligne.className = 'ct-prime-ligne';
  ligne.style.cssText = 'display:flex;gap:8px;align-items:center';
  const libelleEch = (libelle || '').toString().replace(/"/g, '&quot;');
  ligne.innerHTML = `
    <input class="form-input ct-prime-ligne-libelle" placeholder="Ex: Responsabilité civile privée" value="${libelleEch}" style="flex:1" oninput="refreshCategoriesLignesPrime(); calculerPrimeTotaleLignes()"/>
    <span class="ct-prime-ligne-badge-taxe" title="Taxes/émoluments légaux — exclus du volume de prime et du calcul de commission" style="display:none;font-size:9.5px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:5px;padding:2px 6px;white-space:nowrap">hors commission</span>
    <select class="form-select ct-prime-ligne-categorie" style="display:none;width:190px;font-size:11px" onchange="calculerPrimeTotaleLignes()"></select>
    <input class="form-input ct-prime-ligne-montant" type="number" step="0.01" placeholder="CHF" value="${montant}" style="width:120px" oninput="calculerPrimeTotaleLignes()"/>
    <button type="button" onclick="this.parentElement.remove(); calculerPrimeTotaleLignes()" style="background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:13px;flex-shrink:0">✕</button>
  `;
  list.appendChild(ligne);
  refreshCategoriesLignesPrime();
  calculerPrimeTotaleLignes();
}
// Taxes/émoluments légaux (ex: "Taxes légales", "Taxe cantonale", "Droit de timbre fédéral") ne
// sont pas rémunérés par les compagnies — à exclure du volume de prime et de la base de commission,
// tout en restant visibles/reportées dans le détail (elles font bien partie du montant facturé au client).
function _estLigneTaxe(libelle) {
  const s = (libelle || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /\btaxes?\b|\bdroit de timbre\b|\bemolument/.test(s);
}
function calculerPrimeTotaleLignes() {
  const lignes = Array.from(document.querySelectorAll('.ct-prime-ligne'));
  let totalCommissionnable = 0;
  let totalTaxes = 0;
  lignes.forEach(ligne => {
    const libelle = ligne.querySelector('.ct-prime-ligne-libelle')?.value || '';
    const montant = parseFloat(ligne.querySelector('.ct-prime-ligne-montant')?.value) || 0;
    const badge = ligne.querySelector('.ct-prime-ligne-badge-taxe');
    const estTaxe = _estLigneTaxe(libelle);
    if (badge) badge.style.display = estTaxe ? '' : 'none';
    if (estTaxe) totalTaxes += montant; else totalCommissionnable += montant;
  });
  const total = Math.round(totalCommissionnable * 100) / 100;
  const hidden = document.getElementById('ct-prime-mensuelle');
  if (hidden) hidden.value = total > 0 ? total : '';
  const decimales = lignes.some(l => (parseFloat(l.querySelector('.ct-prime-ligne-montant')?.value) || 0) % 1 !== 0);
  const affiche = document.getElementById('ct-prime-total-affiche');
  if (affiche) affiche.textContent = 'CHF ' + total.toLocaleString('fr-CH', { minimumFractionDigits: decimales ? 2 : 0 });
  const note = document.getElementById('ct-prime-taxes-note');
  if (note) {
    note.textContent = totalTaxes > 0
      ? `Taxes/émoluments légaux exclus : CHF ${fmtCHF(Math.round(totalTaxes * 100) / 100)} (facturés au client mais hors volume de prime et hors commission)`
      : '';
  }
  updateCommissionPreview();
}
// Capture le détail ligne par ligne tel que saisi (libellé + montant + catégorie de commission
// si applicable) pour le PERSISTER sur le contrat (colonne detail_lignes, jsonb) — jusqu'ici ce
// détail n'existait qu'en mémoire le temps du calcul puis disparaissait après enregistrement
// (demande de Jonathan le 25.08.2026 : "rien ne s'est enregistré dans les lignes de primes...
// ça serait bien de le retrouver"). Vaut aussi bien pour une saisie manuelle que pour un futur
// pré-remplissage automatique (import PDF) : les deux passent par les mêmes champs .ct-prime-ligne.
function collecterLignesPrimeSaisies() {
  return Array.from(document.querySelectorAll('.ct-prime-ligne')).map(ligne => {
    const libelle = (ligne.querySelector('.ct-prime-ligne-libelle')?.value || '').trim();
    const montant = parseFloat(ligne.querySelector('.ct-prime-ligne-montant')?.value) || 0;
    const catSelect = ligne.querySelector('.ct-prime-ligne-categorie');
    const categorie = (catSelect && catSelect.style.display !== 'none' && catSelect.value) ? catSelect.value : null;
    return { libelle, montant, categorie };
  }).filter(l => l.libelle || l.montant > 0);
}

// Met à jour la ligne portant ce libellé si elle existe déjà (ex: reportée par la calculette
// RC+Casco), sinon en crée une nouvelle — pour ne jamais écraser les autres lignes déjà saisies.
function setOuAjouterLignePrime(libelle, montant) {
  const list = document.getElementById('ct-prime-lignes-list');
  if (!list) return;
  const lignes = Array.from(list.querySelectorAll('.ct-prime-ligne'));
  const existante = lignes.find(l => (l.querySelector('.ct-prime-ligne-libelle')?.value || '').trim().toLowerCase() === libelle.toLowerCase());
  if (existante) {
    existante.querySelector('.ct-prime-ligne-montant').value = montant;
  } else {
    ajouterLignePrime(libelle, montant);
  }
  calculerPrimeTotaleLignes();
}

// ═══ Commission par ligne (par branche) ═══════════════════════════════════
// Une police combinée (ex: "RC + inventaire du ménage") mélange souvent des branches payées à
// des taux DIFFÉRENTS par la compagnie (ex AXA : RC hors véhicules 15%, Ménage/Bâtiment et
// Assurances complémentaires 10% — Tableau de courtage §B4.4, vérifié sur le contrat AXA Des
// Gouttes & Cie du 10.03.2025). Appliquer un seul taux "produit" à la somme de toutes les lignes
// surestime ou sous-estime la commission réelle. Ici, chaque ligne de prime reçoit sa propre
// catégorie tarifaire (devinée depuis le libellé, toujours modifiable), et la commission se
// calcule ligne par ligne puis se somme — jamais un taux unique sur le total combiné.
function _categoriesCommissionCompagnie(compagnieChoisie) {
  if (compagnieChoisie.includes('axa')) {
    const A = TAUX_COMMISSION.axa;
    return {
      cle: 'axa',
      nom: 'AXA (Tableau de courtage §B4.4)',
      categories: [
        { id: 'choses', label: `Choses — incendie/vol/DE/BG (${A.choses}%)`, taux: A.choses },
        { id: 'rc_hors_vehicules', label: `RC (hors véhicules) (${A.rc_hors_vehicules}%)`, taux: A.rc_hors_vehicules },
        { id: 'techniques', label: `Techniques — machines (${A.techniques}%)`, taux: A.techniques },
        { id: 'transport', label: `Transport (${A.transport}%)`, taux: A.transport },
        { id: 'personnes_accidents', label: `Accidents ind./coll. sans LAA (${A.personnes_accidents}%)`, taux: A.personnes_accidents },
        { id: 'maladie_collective', label: `Maladie collective (${A.maladie_collective}%)`, taux: A.maladie_collective },
        { id: 'laa_laaf', label: `Accidents LAA/LAAF (${A.laa_laaf}%)`, taux: A.laa_laaf },
        { id: 'vehicules', label: `Véhicules — RC/Casco/Flottes (${A.vehicules}%)`, taux: A.vehicules },
        { id: 'autres', label: `Autres — ménage/bâtiment/complémentaires (${A.autres}%)`, taux: A.autres },
      ],
    };
  }
  if (compagnieChoisie.includes('vaudoise')) {
    const V = TAUX_COMMISSION.vaudoise;
    return {
      cle: 'vaudoise',
      nom: 'Vaudoise (Tabelle A1 Non-vie)',
      categories: [
        { id: 'accident_individuel_collectif', label: `Accident ind./coll. sans LAA (${V.accident_individuel_collectif}%)`, taux: V.accident_individuel_collectif },
        { id: 'laa', label: `Accident collective LAA (${V.laa}%)`, taux: V.laa },
        { id: 'maladie_collective', label: `Maladie collective (${V.maladie_collective}%)`, taux: V.maladie_collective },
        { id: 'rc_generale', label: `RC générale/privée/immeubles (${V.rc_generale}%)`, taux: V.rc_generale },
        { id: 'rc_agricole_dirigeant', label: `RC agricole/dirigeant (${V.rc_agricole_dirigeant}%)`, taux: V.rc_agricole_dirigeant },
        { id: 'caution', label: `Caution/garantie construction (${V.caution}%)`, taux: V.caution },
        { id: 'vehicule_rc', label: `Véhicule — RC (${V.vehicule_rc}%)`, taux: V.vehicule_rc },
        { id: 'vehicule_casco_complete', label: `Véhicule — Casco complète (${V.vehicule_casco_complete}%)`, taux: V.vehicule_casco_complete },
        { id: 'vehicule_casco_partielle', label: `Véhicule — Casco partielle (${V.vehicule_casco_partielle}%)`, taux: V.vehicule_casco_partielle },
        { id: 'batiment', label: `Bâtiment (${V.batiment}%)`, taux: V.batiment },
        { id: 'choses', label: `Choses — incendie/vol/DE (${V.choses}%)`, taux: V.choses },
        { id: 'five_in_one', label: `Five in one — RC/inventaire/PJ (${V.five_in_one}%)`, taux: V.five_in_one },
        { id: 'assistance', label: `Assistance (${V.assistance}%)`, taux: V.assistance },
      ],
    };
  }
  return null;
}
// Suggestion automatique de catégorie depuis le libellé de la ligne — reste toujours modifiable
// par l'utilisateur, jamais appliquée de façon silencieuse pour un calcul de commission.
function _deviner_categorie_ligne(table, libelle) {
  const s = (libelle || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const a = (id) => table.categories.some(cat => cat.id === id) ? id : table.categories[table.categories.length - 1].id;
  if (table.cle === 'axa') {
    if (/vehicul|voiture|auto\b|casco|flotte/.test(s)) return a('vehicules');
    if (/accident.*laa|laa\/laaf|\blaa\b|\blaaf\b/.test(s)) return a('laa_laaf');
    if (/maladie collective/.test(s)) return a('maladie_collective');
    if (/accident/.test(s)) return a('personnes_accidents');
    if (/responsabilite civile|\brc\b/.test(s)) return a('rc_hors_vehicules');
    if (/incendie|\bvol\b|degat.*eau|bris de glace/.test(s)) return a('choses');
    if (/transport|abonnement/.test(s)) return a('transport');
    if (/machine|technique|montage/.test(s)) return a('techniques');
    return a('autres'); // ménage, bâtiment, complémentaires, caution, PJ, etc.
  }
  if (table.cle === 'vaudoise') {
    // Casco : le mot "véhicule" n'apparaît presque jamais sur les libellés réels des polices
    // ("Casco AVENUE segmentée collision", "Casco complète", "Ass. Casco AVENUE segmentée vol") —
    // "casco" seul suffit à identifier la branche véhicule, sans exiger "véhicule/voiture/auto" en plus.
    // Vérifié contre le relevé de commission Vaudoise réel (32/2299, 07.2026) : "collision" → complète
    // (12%), "vol" et les autres sinistres casco → partielle (15%), au même taux que les occupants.
    if (/casco.*complet|collision/.test(s)) return a('vehicule_casco_complete');
    if (/casco/.test(s)) return a('vehicule_casco_partielle');
    if (/vehicul|voiture|auto\b/.test(s)) return a('vehicule_rc');
    if (/laa\b/.test(s)) return a('laa');
    if (/maladie collective/.test(s)) return a('maladie_collective');
    if (/accident/.test(s)) return a('accident_individuel_collectif');
    if (/responsabilite civile|\brc\b/.test(s)) return a('rc_generale');
    if (/caution|garantie/.test(s)) return a('caution');
    if (/batiment/.test(s)) return a('batiment');
    if (/incendie|\bvol\b|degat.*eau/.test(s)) return a('choses');
    return a('rc_generale');
  }
  return table.categories[0].id;
}
// Affiche/masque et peuple le sélecteur de catégorie sur chaque ligne, selon la compagnie choisie.
// Conserve la sélection déjà faite par l'utilisateur ; ne devine que pour les lignes pas encore
// catégorisées (nouvelle ligne, ou changement de compagnie).
function refreshCategoriesLignesPrime() {
  const compagnieChoisie = (document.getElementById('ct-compagnie')?.value || '').trim().toLowerCase();
  const table = _categoriesCommissionCompagnie(compagnieChoisie);
  document.querySelectorAll('.ct-prime-ligne').forEach(ligne => {
    const select = ligne.querySelector('.ct-prime-ligne-categorie');
    if (!select) return;
    if (!table) { select.style.display = 'none'; select.innerHTML = ''; select.dataset.compagnie = ''; return; }
    const libelle = ligne.querySelector('.ct-prime-ligne-libelle')?.value || '';
    if (select.dataset.compagnie !== table.cle) {
      // Compagnie différente depuis la dernière fois : repeuple les options et redevine.
      select.innerHTML = table.categories.map(cat => `<option value="${cat.id}">${cat.label}</option>`).join('');
      select.value = _deviner_categorie_ligne(table, libelle);
      select.dataset.compagnie = table.cle;
    }
    select.style.display = _estLigneTaxe(libelle) ? 'none' : '';
  });
}
// Calcule la commission en sommant chaque ligne de prime (hors taxes) × son propre taux de
// catégorie — retourne null si aucune ligne n'a de catégorie exploitable (ex: compagnie sans
// tableau connu, ou contrat existant sans lignes), pour laisser le calcul "produit unique" prendre
// le relais en repli.
function _commissionParLignes(table) {
  const lignes = Array.from(document.querySelectorAll('.ct-prime-ligne'));
  if (!lignes.length) return null;
  let total = 0;
  let auMoinsUneLigne = false;
  const detailParCategorie = {};
  for (const ligne of lignes) {
    const libelle = ligne.querySelector('.ct-prime-ligne-libelle')?.value || '';
    const montant = parseFloat(ligne.querySelector('.ct-prime-ligne-montant')?.value) || 0;
    if (montant <= 0 || _estLigneTaxe(libelle)) continue;
    const select = ligne.querySelector('.ct-prime-ligne-categorie');
    const catId = select ? select.value : null;
    const cat = catId ? table.categories.find(c => c.id === catId) : null;
    if (!cat) continue;
    auMoinsUneLigne = true;
    const montantCommission = Math.round(montant * cat.taux) / 100;
    total += montantCommission;
    if (!detailParCategorie[cat.id]) detailParCategorie[cat.id] = { label: cat.label.replace(/\s*\([^)]*\)$/, ''), sousTotal: 0 };
    detailParCategorie[cat.id].sousTotal += montantCommission;
  }
  if (!auMoinsUneLigne) return null;
  total = Math.round(total * 100) / 100;
  const detailTxt = Object.values(detailParCategorie).map(d => `${d.label} : CHF ${fmtCHF(Math.round(d.sousTotal * 100) / 100)}`).join(' · ');
  return { montant: total, detail: `${table.nom} — commission calculée ligne par ligne (${detailTxt}) = CHF ${fmtCHF(total)}` };
}

// Réinitialise la liste avec une seule ligne pré-remplie (import PDF, pré-remplissage) — l'utilisateur
// peut ensuite éclater ce montant en plusieurs lignes ou en ajouter d'autres.
function initLignesPrimeDepuisMontant(montant, libelle = 'Prime totale') {
  const list = document.getElementById('ct-prime-lignes-list');
  if (!list) return;
  list.innerHTML = '';
  ajouterLignePrime(libelle, montant || '');
  calculerPrimeTotaleLignes();
}
// Pré-remplit directement le détail poste par poste renvoyé par l'extraction IA de la police
// (data.lignes_prime) — évite de resaisir à la main ce que le PDF affiche déjà en toutes lettres.
function initLignesPrimeDepuisLignes(lignes) {
  const list = document.getElementById('ct-prime-lignes-list');
  if (!list) return;
  list.innerHTML = '';
  lignes.forEach(l => ajouterLignePrime(l.libelle || '', (l.montant ?? '')));
  if (!lignes.length) ajouterLignePrime();
  calculerPrimeTotaleLignes();
}

function updateModulesOptions() {
  const modulesField = document.getElementById('ct-modules-field');
  const modulesList = document.getElementById('ct-modules-list');
  const combinablesField = document.getElementById('ct-combinables-field');
  const combinablesList = document.getElementById('ct-combinables-list');
  if (!modulesList) return;
  const produit = getProduitSelectionne();
  // Bloc "Modules complémentaires" sans objet pour les produits Santé (LAMal/LCA — aucun module
  // n'existe pour cette catégorie dans le catalogue, et la prime se règle via le bloc "Produits
  // souvent combinés" ci-dessous, pas ici) — masqué entièrement plutôt que laissé vide et confus
  // (demande de Jonathan le 13.08.2026).
  const estSante = produit && (CATALOGUE_PRODUITS['Santé'] || []).some(p => p.id === produit.id);
  if (modulesField) modulesField.style.display = estSante ? 'none' : '';
  if (estSante) {
    modulesList.innerHTML = '';
    const hintEl = document.getElementById('ct-modules-hint');
    if (hintEl) hintEl.textContent = '';
    const customList = document.getElementById('ct-modules-custom-list');
    if (customList) customList.innerHTML = '';
  }
  // Pour la Santé (LAMal seul ou LAMal + LCA), la section générique "Lignes de prime" (pensée
  // pour RC/ménage/etc.) est remplacée par une ligne unique pré-libellée "Prime LAMal" — la
  // prime LCA se saisit séparément dans "Produits souvent combinés" ci-dessus. Évite la confusion
  // avec le placeholder générique "Ex: Responsabilité civile privée" (demande de Jonathan).
  const lignesField = document.getElementById('ct-prime-lignes-field');
  const lignesLabelText = document.getElementById('ct-prime-lignes-label-text');
  const lignesHint = document.getElementById('ct-prime-lignes-hint');
  const lignesAddBtn = document.getElementById('ct-prime-lignes-add-btn');
  const lignesList = document.getElementById('ct-prime-lignes-list');
  const estLamalSeul = produit && produit.id === 'lamal';
  if (lignesField && lignesList) {
    if (estLamalSeul && lignesField.dataset.mode !== 'sante') {
      lignesField.dataset.mode = 'sante';
      if (lignesLabelText) lignesLabelText.textContent = 'Prime LAMal (mensuelle) *';
      if (lignesHint) lignesHint.textContent = '(prime MENSUELLE LAMal — en Suisse les primes santé se paient au mois, jamais à l\'année — la prime LCA se saisit ci-dessus dans "Produits souvent combinés", elle aussi mensuelle)';
      if (lignesAddBtn) lignesAddBtn.style.display = 'none';
      const montantExistant = Array.from(lignesList.querySelectorAll('.ct-prime-ligne-montant')).reduce((s, el) => s + (parseFloat(el.value) || 0), 0);
      lignesList.innerHTML = '';
      ajouterLignePrime('Prime LAMal', montantExistant > 0 ? montantExistant : '');
    } else if (!estLamalSeul && lignesField.dataset.mode === 'sante') {
      lignesField.dataset.mode = '';
      if (lignesLabelText) lignesLabelText.textContent = 'Lignes de prime *';
      if (lignesHint) lignesHint.textContent = '(reporte chaque ligne de la police — ex: Responsabilité civile privée, Inventaire du ménage, Assurances complémentaires et services, Taxes légales)';
      if (lignesAddBtn) lignesAddBtn.style.display = '';
      lignesList.innerHTML = '';
      ajouterLignePrime(); ajouterLignePrime(); ajouterLignePrime();
    }
  }
  const modules = (produit && !estSante) ? produit.modules : [];
  // Le bloc "Modules complémentaires" reste toujours visible (même sans liste prédéfinie pour ce
  // produit, ex: RC véhicule) car le bouton "+ Ajouter un module complémentaire" (libellé libre)
  // est toujours disponible en dessous — sauf pour la Santé, masquée ci-dessus.
  if (!estSante) document.getElementById('ct-modules-hint').textContent = modules.length === 0
    ? 'Aucun module prédéfini pour ce produit — utilise le bouton ci-dessous pour en ajouter un librement.'
    : 'Coche un module pour y indiquer sa prime annuelle (facultatif, à titre de détail).';
  if (modules.length === 0) {
    modulesList.innerHTML = '';
  } else {
    modulesList.innerHTML = modules.map((m, i) => `
      <div style="display:flex;align-items:center;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text);cursor:pointer">
          <input type="checkbox" class="ct-module-checkbox" value="${m}" data-idx="${i}" onchange="toggleModulePrime(this)" style="width:15px;height:15px;cursor:pointer"/>${m}
        </label>
        <input type="number" class="ct-module-prime-input" data-idx="${i}" placeholder="Prime CHF/an" style="display:none;width:110px;background:var(--surface-alt);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:11.5px;color:var(--text)"/>
      </div>`).join('');
  }
  // Réinitialise les modules libres ajoutés manuellement à chaque changement de produit
  const customList = document.getElementById('ct-modules-custom-list');
  if (customList) customList.innerHTML = '';

  if (combinablesField && combinablesList) {
    const combinablesIds = produit ? (produit.combinables || []) : [];
    if (combinablesIds.length === 0) {
      combinablesField.style.display = 'none';
      combinablesList.innerHTML = '';
    } else {
      combinablesField.style.display = 'block';
      // La calculette RC+Casco n'a de sens que pour les produits véhicule (casco combinable) —
      // pas pour ménage ou santé/LCA, qui n'ont rien à voir avec RC/Casco.
      const estContexteVehicule = combinablesIds.includes('casco_partielle') || combinablesIds.includes('casco_complete');
      combinablesList.innerHTML = combinablesIds.map(id => {
        const p = getProduitParId(id);
        return p ? `
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text);cursor:pointer">
          <input type="checkbox" class="ct-combinable-checkbox" value="${p.id}" onchange="toggleCombinablePrime('${p.id}')" style="width:15px;height:15px;cursor:pointer"/>+ ${p.label}
        </label>` : '';
      }).join('') + '<div id="ct-combinables-primes" style="width:100%;margin-top:8px"></div>' +
        (!estContexteVehicule ? '' : `<div id="ct-calculette-vehicule" style="display:none;width:100%;margin-top:10px;padding:12px 14px;background:var(--surface-alt);border:1px solid var(--border);border-radius:9px">
          <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">🧮 Calculette RC + Casco — remplis 2 montants, le 3e se calcule</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div><label class="form-label" style="font-size:10.5px">Prime totale (CHF)</label><input class="form-input" id="ct-calc-total" type="number" placeholder="1929.60" oninput="calculerSoldeVehicule('total')"/></div>
            <div><label class="form-label" style="font-size:10.5px">RC (CHF)</label><input class="form-input" id="ct-calc-rc" type="number" placeholder="327.60" oninput="calculerSoldeVehicule('rc')"/></div>
            <div><label class="form-label" style="font-size:10.5px">Casco (CHF)</label><input class="form-input" id="ct-calc-casco" type="number" placeholder="1602.00" oninput="calculerSoldeVehicule('casco')"/></div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:6px">Prime totale = montant final de la police (timbre fédéral et taxes déjà inclus). Remplis-en deux, le troisième se déduit automatiquement et se reporte dans les champs ci-dessus.</div>
        </div>`);
    }
  }

  const plaquesField = document.getElementById('ct-plaques-field');
  if (plaquesField) {
    const estVehiculeUnique = produit && ['vehicule_rc', 'casco_partielle', 'casco_complete'].includes(produit.id);
    if (produit && produit.flotte) {
      document.getElementById('ct-plaques-label').textContent = "Plaques d'immatriculation de la flotte";
      document.getElementById('ct-plaques-add-btn').style.display = '';
      plaquesField.dataset.mode = 'flotte';
      plaquesField.style.display = 'block';
      if (document.getElementById('ct-plaques-list').children.length === 0) ajouterPlaqueFlotte();
    } else if (estVehiculeUnique) {
      // Un seul véhicule pour ce contrat (pas une flotte) — même ligne plaque + marque/modèle,
      // mais pas de bouton "+" puisqu'il n'y a qu'un seul véhicule assuré par ce contrat.
      document.getElementById('ct-plaques-label').textContent = 'Véhicule assuré (plaque)';
      document.getElementById('ct-plaques-add-btn').style.display = 'none';
      if (plaquesField.dataset.mode !== 'unique') {
        document.getElementById('ct-plaques-list').innerHTML = '';
        ajouterPlaqueFlotte();
      }
      plaquesField.dataset.mode = 'unique';
      plaquesField.style.display = 'block';
    } else {
      plaquesField.dataset.mode = '';
      plaquesField.style.display = 'none';
      document.getElementById('ct-plaques-list').innerHTML = '';
    }
  }
}

// Ajoute une ligne "module complémentaire" au libellé libre (ex: "Assurances complémentaires et
// services" comme chez AXA) avec sa propre prime annuelle — disponible pour tout produit, y compris
// ceux sans liste de modules prédéfinie dans le catalogue (ex: RC véhicule).
function ajouterModuleComplementaire() {
  const list = document.getElementById('ct-modules-custom-list');
  if (!list) return;
  const ligne = document.createElement('div');
  ligne.className = 'ct-module-custom-ligne';
  ligne.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px';
  ligne.innerHTML = `
    <input class="form-input ct-module-custom-nom" placeholder="Ex: Assurances complémentaires et services" style="flex:1"/>
    <input class="form-input ct-module-custom-prime" type="number" placeholder="Prime CHF/an" style="width:130px"/>
    <button type="button" onclick="this.parentElement.remove()" style="background:var(--red-dim);color:var(--red);border:none;border-radius:7px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer">✕</button>
  `;
  list.appendChild(ligne);
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

// Rend le champ "produit LCA" d'une ligne : un <select> filtré sur les produits de la compagnie
// renseignée en haut du formulaire (ex: "Helsana" → seulement les produits Helsana, jamais Groupe
// Mutuel — cf. CATALOGUE_LCA_PAR_COMPAGNIE, js/02) si la compagnie est reconnue, sinon un champ
// libre (compagnie non cataloguée — jamais bloquant). Choisir "Autre produit" dans le select bascule
// vers la saisie libre, en conservant toujours la classe .ct-lca-nom-input (lue tel quel à
// l'enregistrement, cf. creerContratEtCommission).
function champProduitLcaHtml(valeurActuelle) {
  const compagnie = document.getElementById('ct-compagnie')?.value || '';
  const produits = produitsLcaPourCompagnie(compagnie);
  const valEch = (valeurActuelle || '').replace(/"/g, '&quot;');
  if (produits && produits.length) {
    const connu = produits.includes(valeurActuelle);
    return `<select class="form-input ct-lca-nom-input" onchange="if(this.value==='__autre__'){ const t=document.createElement('input'); t.className='form-input ct-lca-nom-input'; t.placeholder='Nom exact du produit chez la compagnie'; t.setAttribute('oninput','updateCommissionPreview()'); this.replaceWith(t); t.focus(); } updateCommissionPreview();">
      <option value="">— Sélectionner un produit ${compagnie.trim()} —</option>
      ${produits.map(p => `<option value="${p.replace(/"/g, '&quot;')}" ${p === valeurActuelle ? 'selected' : ''}>${p}</option>`).join('')}
      <option value="__autre__" ${valeurActuelle && !connu ? 'selected' : ''}>Autre produit (préciser)…</option>
    </select>`;
  }
  return `<input class="form-input ct-lca-nom-input" placeholder="Nom exact du produit chez la compagnie" value="${valEch}" oninput="updateCommissionPreview()"/>`;
}

function ajouterLigneLCA() {
  const container = document.getElementById('ct-lca-lignes');
  if (!container) return;
  const ligne = document.createElement('div');
  ligne.className = 'ct-lca-ligne';
  ligne.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;flex-wrap:wrap';
  ligne.innerHTML = `
    <div class="ct-lca-nom-wrap" style="flex:2;min-width:180px">
      <label class="form-label" style="font-size:10.5px">Produit LCA</label>
      ${champProduitLcaHtml('')}
    </div>
    <div style="flex:1;min-width:120px">
      <label class="form-label" style="font-size:10.5px">Prime mensuelle (CHF)</label>
      <input class="form-input ct-lca-prime-input" type="number" placeholder="150" oninput="updateCommissionPreview()"/>
    </div>
    <button type="button" onclick="this.parentElement.remove(); updateCommissionPreview();" style="background:var(--red-dim);color:var(--red);border:none;border-radius:7px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer">✕</button>
  `;
  container.appendChild(ligne);
}

// Rafraîchit le sélecteur de produit de chaque ligne LCA déjà saisie quand la compagnie change
// (ex: le client tape "Helsana" après avoir déjà ajouté une ligne) — conserve la valeur si elle
// reste valide pour la nouvelle compagnie.
function refreshLcaLignesOptions() {
  document.querySelectorAll('.ct-lca-nom-wrap').forEach(wrap => {
    const actuel = wrap.querySelector('.ct-lca-nom-input');
    if (!actuel) return;
    const valeurActuelle = actuel.value && actuel.value !== '__autre__' ? actuel.value : '';
    wrap.innerHTML = `<label class="form-label" style="font-size:10.5px">Produit LCA</label>${champProduitLcaHtml(valeurActuelle)}`;
  });
}

// Révèle/masque le petit champ de prime en regard d'une case "Module complémentaire" cochée
// (ex: RC privée > "Location de chevaux" CHF 90.40) — optionnel, purement informatif : ce montant
// n'est PAS additionné automatiquement à la prime totale du contrat (celle-ci reprend déjà le total
// final de la police), il sert juste à garder trace du détail dans le champ "modules".
function toggleModulePrime(checkbox) {
  const idx = checkbox.dataset.idx;
  const primeInput = document.querySelector(`.ct-module-prime-input[data-idx="${idx}"]`);
  if (!primeInput) return;
  primeInput.style.display = checkbox.checked ? 'inline-block' : 'none';
  if (!checkbox.checked) primeInput.value = '';
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
    if (produitId === 'lca_autre_compagnie') {
      // LCA complémentaire santé : un client peut avoir plusieurs produits LCA (ex: hospitalisation
      // + ambulatoire, ou deux compagnies différentes) — on affiche une liste de lignes dynamiques
      // (nom du produit + prime annuelle), avec un bouton pour en ajouter d'autres.
      div.innerHTML = `<div id="ct-lca-lignes"></div><button type="button" onclick="ajouterLigneLCA()" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:6px 12px;font-size:11.5px;font-weight:700;cursor:pointer">+ Ajouter un autre produit LCA</button><div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">Une ligne par produit LCA — chacune devient un contrat distinct avec sa propre commission.</div>`;
      primesZone.appendChild(div);
      ajouterLigneLCA();
    } else {
      div.innerHTML = `<label class="form-label">Prime annuelle pour "${produit.label}" (CHF)</label><input class="form-input ct-combinable-prime-input" data-produit-id="${produitId}" type="number" placeholder="540"/><div style="font-size:10.5px;color:var(--text-muted);margin-top:3px">Casco/ménage sont facturés annuellement — indique le montant annuel, pas mensuel.</div>`;
      primesZone.appendChild(div);
    }
  } else if (!checkbox.checked && existant) {
    existant.remove();
  }
  // La calculette RC+Casco n'a de sens que si au moins une case Casco/combinable est cochée
  const calculette = document.getElementById('ct-calculette-vehicule');
  if (calculette) {
    const auMoinsUneCochee = document.querySelectorAll('.ct-combinable-checkbox:checked').length > 0;
    calculette.style.display = auMoinsUneCochee ? 'block' : 'none';
  }
  updateCommissionPreview();
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
    setOuAjouterLignePrime('Prime RC (calculette)', rcFinal);
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
  'vaudoise générale, compagnie d\u2019assurances sa': 'La Vaudoise', 'vaudoise générale': 'La Vaudoise', 'vaudoise generale, compagnie d\u2019assurances sa': 'La Vaudoise',
  'la mobilière': 'La Mobilière', 'la mobiliere': 'La Mobilière', 'mobilière': 'La Mobilière', 'mobiliere': 'La Mobilière', 'mobilière suisse société d\u2019assurances': 'La Mobilière',
  'hotela assurances sa': 'HOTELA', 'hotela': 'HOTELA', 'institutions sociales hotela': 'HOTELA', 'hotela caisse maladie': 'HOTELA', 'hotela caisse de maladie': 'HOTELA',
  'gastrosocial': 'Gastrosocial', 'caisse gastrosocial': 'Gastrosocial',
  'suva': 'SUVA', 'schweizerische unfallversicherungsanstalt': 'SUVA',
  'css assurances': 'CSS', 'css assurance': 'CSS', 'css': 'CSS',
  'groupe mutuel': 'Groupe Mutuel', 'gmv sa': 'Groupe Mutuel',
  'swiss life': 'Swiss Life', 'swiss life sa': 'Swiss Life', 'swisslife': 'Swiss Life', 'swisslife sa': 'Swiss Life',
  'axa winterthur': 'AXA', 'axa assurances': 'AXA', 'axa': 'AXA',
  'zurich assurances': 'Zurich', 'zurich': 'Zurich',
  'generali assurances': 'Generali', 'generali': 'Generali', 'generali assurances générales sa': 'Generali',
  'baloise assurances': 'Baloise', 'bâloise': 'Baloise', 'baloise': 'Baloise', 'bâloise assurances sa': 'Baloise', 'baloise assurances sa': 'Baloise',
  'helsana assurances': 'Helsana', 'helsana': 'Helsana',
  'sanitas assurances': 'Sanitas', 'sanitas': 'Sanitas',
  'allianz suisse': 'Allianz', 'allianz': 'Allianz',
  'visana assurances': 'Visana', 'visana': 'Visana',
  'swica assurances': 'SWICA', 'swica': 'SWICA',
  'swisscaution': 'SwissCaution', 'swiss caution': 'SwissCaution',
  'firstcaution': 'FirstCaution', 'first caution': 'FirstCaution',
  'gocaution': 'goCaution', 'go caution': 'goCaution',
  'smartcaution': 'SmartCaution', 'smart caution': 'SmartCaution',
};
function _cleCompagnieSansAccents(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
// Retire les suffixes juridiques / génériques (SA, AG, "Assurances", "Compagnie d'assurance(s)", etc.)
// pour ne garder que le "cœur" du nom, afin de rapprocher des variantes non couvertes une-à-une
// par ALIAS_COMPAGNIES (ex: "AXA Assurances SA", "Baloise Assurance SA", "Bâloise Assurances").
function _cleCompagnieCanonique(s) {
  let cle = _cleCompagnieSansAccents(s);
  cle = cle
    // Article défini en tête ("La Vaudoise", "Le X", "Les X") — uniquement en tête de chaîne,
    // pour ne jamais toucher un "la/le/les" qui ferait partie du cœur du nom ailleurs.
    .replace(/^(la|le|les)\s+/, '')
    .replace(/\bcompagnie d.assurances?\b/g, ' ')
    .replace(/\bassurances?\s*generales?\b/g, ' ')
    // "Générale(s)" isolé — ex: "Vaudoise Générale, Compagnie d'Assurances SA" doit se ramener
    // au même cœur que "La Vaudoise" une fois l'article et le suffixe juridique retirés.
    .replace(/\bgenerale?s?\b/g, ' ')
    .replace(/\bassurances?\b/g, ' ')
    .replace(/\bversicherungen?\b/g, ' ')
    .replace(/\binsurance\b/g, ' ')
    .replace(/\b(sa|ag|sarl|ltd|inc|llc|gmbh)\b/g, ' ')
    .replace(/[.,'\u2019]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cle;
}
// Table de correspondance clé-canonique → nom d'alias déjà connu, construite une fois à partir
// de ALIAS_COMPAGNIES (clé exacte prioritaire, gérée séparément dans normaliserCompagnie).
const _CANONIQUES_VERS_ALIAS = (() => {
  const table = new Map();
  Object.values(ALIAS_COMPAGNIES).forEach(nomAffiche => {
    const cle = _cleCompagnieCanonique(nomAffiche);
    if (cle && !table.has(cle)) table.set(cle, nomAffiche);
  });
  return table;
})();
function normaliserCompagnie(nom) {
  if (!nom) return nom;
  const cle = nom.trim().toLowerCase();
  if (ALIAS_COMPAGNIES[cle]) return ALIAS_COMPAGNIES[cle];
  const cleCanonique = _cleCompagnieCanonique(nom);
  if (cleCanonique && _CANONIQUES_VERS_ALIAS.has(cleCanonique)) {
    return _CANONIQUES_VERS_ALIAS.get(cleCanonique);
  }
  return nom.trim();
}

// produitId (optionnel) : filtre la liste aux compagnies pertinentes pour ce produit (cf.
// COMPAGNIE_BRANCHES / compagniePertinentePourProduit dans 02-catalogue-session.js). Sans
// produitId, retourne toutes les compagnies connues (comportement inchangé).
function getCompagniesConnues(produitId) {
  const base = ['Swiss Life', 'AXA', 'Helsana', 'Sanitas', 'Allianz', 'Zurich', 'Generali', 'Baloise', 'CSS', 'Groupe Mutuel', 'Visana', 'SWICA', 'SwissCaution', 'FirstCaution', 'goCaution', 'SmartCaution'];
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
  let noms = [...vues.values()];
  if (produitId) noms = noms.filter(nom => compagniePertinentePourProduit(nom, produitId));
  return noms.sort();
}

// Repeuple le datalist #compagnies-suggestions selon le produit actuellement sélectionné —
// appelée à chaque changement de produit (cf. updateProduitOptions ci-dessous), pour que la
// saisie de "Compagnie" ne propose plus, par ex., Swiss Life/HOTELA/CSS/CAP pour une "RC véhicule".
function refreshCompagniesSuggestions() {
  const datalist = document.getElementById('compagnies-suggestions');
  if (!datalist) return;
  const produit = typeof getProduitSelectionne === 'function' ? getProduitSelectionne() : null;
  const produitId = produit ? produit.id : null;
  datalist.innerHTML = getCompagniesConnues(produitId).map(c => `<option value="${c}">`).join('');
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

// Cherche un produit du catalogue par son id, tous catégories confondues (utilisé par
// estimerCommissionProduit ci-dessous pour la prévisualisation de commission sur une opportunité).
function produitParId(id) {
  for (const cat in CATALOGUE_PRODUITS) {
    const p = CATALOGUE_PRODUITS[cat].find(x => x.id === id);
    if (p) return p;
  }
  return null;
}

// Comme trouverProduitCatalogue() mais par id exact (pas de recherche floue sur un texte) —
// utilisé pour préremplir "Nouveau contrat" depuis le produit précis choisi sur une opportunité
// (opportunites.produits), plus fiable que deviner depuis le titre libre de l'opportunité.
function produitCategorieEtObjetParId(id) {
  if (!id) return null;
  for (const cat in CATALOGUE_PRODUITS) {
    const p = CATALOGUE_PRODUITS[cat].find(x => x.id === id);
    if (p) return { categorie: cat, produit: p };
  }
  return null;
}

// Prévisualisation de la commission estimée sur une OPPORTUNITÉ (avant tout contrat) — réutilise
// TEL QUEL le moteur calculerCommissionEstimee() du formulaire "Nouveau contrat" (déjà audité,
// testé par 19 cas de régression réels) via un DOM temporaire invisible, plutôt que de dupliquer
// la logique tarifaire par compagnie (risque de désynchronisation). Nettoie toujours son DOM
// temporaire, y compris en cas d'erreur.
// Âge en années pleines à partir d'une date de naissance (YYYY-MM-DD) — utilisé pour estimer la
// durée restante jusqu'à 65 ans sur les produits vie 3a/3b au stade opportunité (avant qu'un vrai
// champ "durée" ne soit saisi sur le contrat).
function ageDepuisNaissance(dateNaissance) {
  if (!dateNaissance) return null;
  const naissance = new Date(dateNaissance);
  if (isNaN(naissance.getTime())) return null;
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();
  const pasEncoreAnniversaire = (aujourdhui.getMonth() < naissance.getMonth()) ||
    (aujourdhui.getMonth() === naissance.getMonth() && aujourdhui.getDate() < naissance.getDate());
  if (pasEncoreAnniversaire) age--;
  return age;
}

function estimerCommissionProduit(produitId, compagnieNom, primeSaisie, dureeAnnees) {
  const produit = produitId ? produitParId(produitId) : null;
  // La compagnie n'est obligatoire QUE pour les produits dont le taux en dépend — pas pour la
  // santé complémentaire (PRODUITS_SANTE_X16, js/07), rémunérée à taux fixe prime x16 quelle que
  // soit la compagnie. Sans cet assouplissement, l'estimation santé restait à 0 tant qu'aucune
  // compagnie n'était choisie sur l'opportunité (bug repéré par Jonathan le 10.08.2026).
  const compagnieRequise = !PRODUITS_SANTE_X16.includes(produitId);
  if (!produit || (compagnieRequise && !compagnieNom) || !primeSaisie) return { montant: 0, detail: null };
  const temp = [];
  const creer = (id, valeur) => {
    const el = document.createElement('input');
    el.id = id; el.type = 'hidden'; el.value = valeur;
    document.body.appendChild(el);
    temp.push(el);
  };
  // primeSaisie représente une prime ANNUELLE pour la plupart des produits (case "Prime CHF/an"
  // sur l'opportunité), mais une prime MENSUELLE pour la santé complémentaire — en Suisse les
  // primes LAMal/LCA se paient et se comparent au mois, jamais à l'année (retour Jonathan le
  // 11.08.2026 : CHF 45/mois de complémentaire, divisé par erreur par 12 avant le calcul x16,
  // ce qui donnait CHF 60 de commission au lieu de CHF 720).
  const estSante = PRODUITS_SANTE_X16.includes(produitId);
  const primeMensuelle = estSante ? primeSaisie : Math.round((primeSaisie / 12) * 100) / 100;
  creer('ct-categorie', '');
  creer('ct-produit', produit.label);
  creer('ct-prime-mensuelle', String(primeMensuelle));
  creer('ct-periodicite', '12');
  creer('ct-manuel', '');
  creer('ct-compagnie', compagnieNom || '');
  creer('ct-duree', String(dureeAnnees && dureeAnnees > 0 ? dureeAnnees : 1));
  creer('ct-prime-risque-frais', '0');
  try {
    return calculerCommissionEstimee() || { montant: 0, detail: null };
  } finally {
    temp.forEach(el => el.remove());
  }
}

function calculerCommissionEstimee() {
  const produit = getProduitSelectionne();
  const produitId = produit ? produit.id : null;
  const primeMensuelle = parseFloat(document.getElementById('ct-prime-mensuelle').value) || 0;
  const periodicite = parseInt(document.getElementById('ct-periodicite')?.value) || 12;
  const primeAnnuelle = Math.round(primeMensuelle * periodicite * 100) / 100;

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
    if (produitId === 'perte_gain_maladie_lca') {
      const montant = Math.round(primeAnnuelle * TAUX_COMMISSION.hotela.ij_maladie / 100);
      return { montant, detail: `HOTELA — Indemnités journalières maladie : ${TAUX_COMMISSION.hotela.ij_maladie}% × CHF ${fmtCHF(primeAnnuelle)} = CHF ${fmtCHF(montant)}` };
    }
    if (produitId === 'laa') {
      const montant = Math.round(primeAnnuelle * TAUX_COMMISSION.hotela.accidents / 100);
      return { montant, detail: `HOTELA — Assurance-accidents : ${TAUX_COMMISSION.hotela.accidents}% × CHF ${fmtCHF(primeAnnuelle)} = CHF ${fmtCHF(montant)}` };
    }
    if (produitId === 'perte_gain_maladie_accident_lca' || produitId === 'laac') {
      const montant = Math.round(primeAnnuelle * TAUX_COMMISSION.hotela.accidents_complementaire / 100);
      return { montant, detail: `HOTELA — Assurance-accidents complémentaire : ${TAUX_COMMISSION.hotela.accidents_complementaire}% × CHF ${fmtCHF(primeAnnuelle)} = CHF ${fmtCHF(montant)}` };
    }
    if (produitId === 'lpp_entreprise') {
      const montantBrut = Math.round(primeAnnuelle * TAUX_COMMISSION.hotela.lpp / 100);
      const plafond = TAUX_COMMISSION.hotela.lpp_plafond;
      const montant = Math.min(montantBrut, plafond);
      return {
        montant,
        detail: `HOTELA — Prévoyance professionnelle : ${TAUX_COMMISSION.hotela.lpp}% × CHF ${fmtCHF(primeAnnuelle)} = CHF ${fmtCHF(montantBrut)}${montantBrut > plafond ? ` — plafonné à CHF ${fmtCHF(plafond)}/an (preneur soumis CCNT hôtellerie-restauration)` : ''}`,
      };
    }
  }

  // ── GASTROSOCIAL — LPP restauration/hôtellerie, taux fixe sur la prime totale ──
  if (compagnieChoisie.includes('gastrosocial') && produitId === 'lpp_entreprise') {
    const montant = Math.round(primeAnnuelle * TAUX_COMMISSION.gastrosocial.lpp / 100);
    return { montant, detail: `Gastrosocial — Prévoyance professionnelle : ${TAUX_COMMISSION.gastrosocial.lpp}% × CHF ${fmtCHF(primeAnnuelle)} (prime totale) = CHF ${fmtCHF(montant)}` };
  }

  // ── VAUDOISE — Tabelle de commissions A1 non-vie (édition 01.11.2024) ──
  // Convention de collaboration de courtage signée le 09.09.2025 (entrée en vigueur 01.09.2025).
  // Commission d'Encaissement uniquement pour les Risques Non-Vie (art. 2.2.1 du Règlement) :
  // Crédit = Prime nette × Taux. Estimation basée sur la prime annuelle (pas de suivi par échéance).
  if (compagnieChoisie.includes('vaudoise')) {
    const tableVaudoise = _categoriesCommissionCompagnie(compagnieChoisie);
    const parLignesVaudoise = tableVaudoise ? _commissionParLignes(tableVaudoise) : null;
    if (parLignesVaudoise) return parLignesVaudoise;
    const V = TAUX_COMMISSION.vaudoise;
    const tauxVaudoiseParProduit = {
      laa: V.laa,
      perte_gain_maladie_accident_lca: V.accident_individuel_collectif,
      perte_gain_maladie_lca: V.maladie_collective,
      rc_entreprise: V.rc_generale,
      rc_pro: V.rc_generale,
      rc_privee: V.rc_generale,
      rc_inventaire: V.rc_generale,
      rc_batiment: V.rc_generale,
      rc_commerce: V.rc_generale,
      rc_do: V.rc_agricole_dirigeant,
      caution_bail_prive: V.caution,
      caution_bail_commercial: V.caution,
      rc_vehicule: V.vehicule_rc,
      vehicule_rc: V.vehicule_rc,
      casco_complete: V.vehicule_casco_complete,
      casco_partielle: V.vehicule_casco_partielle,
      batiment_prive: V.batiment,
      batiment_entreprise: V.batiment,
      choses_entreprise: V.choses,
      pertes_exploitation: V.choses,
      cyber_entreprise: V.choses,
      pj_pro: V.five_in_one,
    };
    const tauxVaudoise = tauxVaudoiseParProduit[produitId];
    if (tauxVaudoise !== undefined) {
      const montantArrondi = Math.round(primeAnnuelle * tauxVaudoise) / 100; // arrondi au centime
      return {
        montant: montantArrondi,
        detail: `Vaudoise — Commission d'Encaissement (Tabelle A1, éd. 01.11.2024) : ${tauxVaudoise}% × CHF ${fmtCHF(primeAnnuelle)} = CHF ${fmtCHF(montantArrondi)} — estimation annuelle, versement réel étalé selon échéances d'encaissement`,
      };
    }
  }

  // ── Santé / complémentaire ──────────────────────────────────────────────

  // ── AXA — Agence partenaire DES GOUTTES & Cie SA (Genève) ───────────────
  // Contrat pour intermédiaire non lié, entrée en vigueur 01.04.2025 — Annexe Non-vie,
  // Tableau de courtage §B4.4. Commission de courtage annuelle sur prime nette.
  // Aucune commission sur police échue ou en renouvellement tacite (§B3) — estimation
  // valable uniquement pour une affaire nouvelle.
  if (compagnieChoisie.includes('axa')) {
    const tableAxa = _categoriesCommissionCompagnie(compagnieChoisie);
    const parLignesAxa = tableAxa ? _commissionParLignes(tableAxa) : null;
    if (parLignesAxa) return parLignesAxa;
    const A = TAUX_COMMISSION.axa;
    const tauxAxaParProduit = {
      choses_entreprise: A.choses,
      pertes_exploitation: A.choses,
      cyber_entreprise: A.choses,
      rc_entreprise: A.rc_hors_vehicules,
      rc_pro: A.rc_hors_vehicules,
      rc_privee: A.rc_hors_vehicules,
      rc_inventaire: A.rc_hors_vehicules,
      rc_batiment: A.rc_hors_vehicules,
      rc_commerce: A.rc_hors_vehicules,
      rc_do: A.rc_hors_vehicules,
      perte_gain_maladie_accident_lca: A.personnes_accidents,
      perte_gain_maladie_lca: A.maladie_collective,
      laa: A.laa_laaf,
      rc_vehicule: A.vehicules,
      vehicule_rc: A.vehicules,
      casco_complete: A.vehicules,
      casco_partielle: A.vehicules,
      flotte_entreprise: A.vehicules,
      caution_bail_prive: A.autres,
      caution_bail_commercial: A.autres,
      batiment_prive: A.autres,
      batiment_entreprise: A.autres,
      pj_pro: A.autres,
    };
    const tauxAxa = tauxAxaParProduit[produitId];
    if (tauxAxa !== undefined) {
      const montantArrondi = Math.round(primeAnnuelle * tauxAxa) / 100; // arrondi au centime
      return {
        montant: montantArrondi,
        detail: `AXA (Des Gouttes & Cie) — Commission de courtage (Tableau §B4.4) : ${tauxAxa}% × CHF ${fmtCHF(primeAnnuelle)} = CHF ${fmtCHF(montantArrondi)} — affaire nouvelle uniquement, aucune commission sur renouvellement tacite`,
      };
    }
  }

  // ── Santé / complémentaire — taux fixe, indépendant de la compagnie (voir PRODUITS_SANTE_X16, js/07) ──
  if (PRODUITS_SANTE_X16.includes(produitId)) {
    const montant = Math.round(primeMensuelle * TAUX_COMMISSION.sante_facteur_mensuel);
    return { montant, detail: `CHF ${fmtCHF(primeMensuelle)}/mois × ${TAUX_COMMISSION.sante_facteur_mensuel} (taux santé) = CHF ${fmtCHF(montant)}` };
  }

  // ── Vie / 3a et 3B mixte — même taux (à ajuster si Jonathan donne un taux différent pour le 3B) ──
  if (produitId === 'vie_3a' || produitId === 'vie_3b_mixte') {
    const duree = parseFloat(document.getElementById('ct-duree')?.value) || 1;
    const capitalProduction = primeMensuelle * 12 * duree;
    const montant = Math.round(capitalProduction * (TAUX_COMMISSION.vie_taux_capital / 100));
    return { montant, detail: `${TAUX_COMMISSION.vie_taux_capital}% × CHF ${fmtCHF(capitalProduction)} (capital = ${primeMensuelle} × 12 × ${duree} ans) = CHF ${fmtCHF(montant)}` };
  }

  // ── LPP (prévoyance professionnelle 2e pilier) ─────────────────────────
  // Formule COG Swiss Life : (prime risque + frais, HORS part épargne) × FP (par produit exact,
  // voir SWISS_LIFE_LPP_FP) × taux 6.3%. Source : Annexe A + Annexe B à la convention
  // d'indemnisation Prévoyance professionnelle (PP), valables dès 01.01.2024 — vérifiées contre
  // les PDF fournis par Jonathan le 25.08.2026. Le seuil "CHF 2'000 minimum" précédemment codé ici
  // était introuvable dans ces annexes et a été retiré à sa demande (25.08.2026) — plus de
  // commission à CHF 0 forcée en dessous d'un montant.
  // Swiss Life ne rémunère que sur risque + frais — jamais sur la part épargne de la prime totale.
  if (produitId === 'lpp_entreprise') {
    const primeRisqueFrais = parseFloat(document.getElementById('ct-prime-risque-frais')?.value) || 0;
    const baseCalcul = primeRisqueFrais > 0 ? primeRisqueFrais : primeAnnuelle;
    const produitSwissLife = document.getElementById('ct-produit-swisslife-lpp')?.value || '';
    const fpConnu = produitSwissLife && SWISS_LIFE_LPP_FP[produitSwissLife] !== undefined;
    const fp = fpConnu ? SWISS_LIFE_LPP_FP[produitSwissLife] : 1.20;
    const cogAnnuelle = Math.round(baseCalcul * fp * (TAUX_COMMISSION.lpp_taux / 100));
    const cogTrimestrielle = Math.round(cogAnnuelle / 4);
    const avertissementPrime = primeRisqueFrais > 0 ? '' : ' ⚠️ Prime risque+frais non renseignée ci-dessus — calcul sur la prime TOTALE, probablement surestimé (inclut la part épargne).';
    const avertissementFp = fpConnu ? '' : ' ⚠️ Produit Swiss Life exact non précisé ci-dessus — FP 1.20 utilisé par défaut, à vérifier (varie de 0.00 à 1.20 selon le produit réel).';
    return {
      montant: cogAnnuelle,
      detail: `COG Swiss Life : CHF ${fmtCHF(baseCalcul)} (risque+frais) × ${fp.toFixed(2)} (FP${produitSwissLife ? ' — ' + produitSwissLife : ''}) × ${TAUX_COMMISSION.lpp_taux}% = CHF ${fmtCHF(cogAnnuelle)}/an (CHF ${fmtCHF(cogTrimestrielle)}/trimestre, versée en mars/juin/sept/déc)${avertissementPrime}${avertissementFp}`,
    };
  }

  // ── LAMal — forfait unique CHF 70.- à la signature ─────────────────────
  if (produitId === 'lamal' || (produitId && produitId.toLowerCase().includes('lamal'))) {
    return {
      montant: TAUX_COMMISSION.lamal_forfait,
      detail: `LAMal : forfait unique CHF ${fmtCHF(TAUX_COMMISSION.lamal_forfait)} à la signature`,
    };
  }
  return { montant: 0, detail: 'Saisis le montant estimé ci-dessous' };
}

// Lignes LCA valablement remplies (produit + prime mensuelle > 0) parmi les .ct-lca-ligne
// actuellement affichées — utilisé à la fois pour la prévisualisation de commission et pour la
// validation à l'enregistrement (cf. saveContrat).
function calculerLignesLCASaisies() {
  return Array.from(document.querySelectorAll('.ct-lca-ligne')).map(ligne => {
    const nom = ligne.querySelector('.ct-lca-nom-input')?.value.trim() || '';
    const primeMensuelle = parseFloat(ligne.querySelector('.ct-lca-prime-input')?.value) || 0;
    return { nom, primeMensuelle };
  }).filter(l => l.nom && l.primeMensuelle > 0);
}

function updateCommissionPreview() {
  const produit = getProduitSelectionne();
  const produitId = produit ? produit.id : null;
  document.getElementById('ct-duree-field').style.display = produitId === 'vie_3a' ? 'block' : 'none';
  document.getElementById('ct-manuel-field').style.display = 'block';
  const compagnieChoisie = (document.getElementById('ct-compagnie')?.value || '').trim().toLowerCase();
  const champRisqueFrais = document.getElementById('ct-prime-risque-frais-field');
  const estLppSwissLife = produitId === 'lpp_entreprise' && compagnieChoisie.includes('swiss life');
  if (champRisqueFrais) champRisqueFrais.style.display = estLppSwissLife ? 'block' : 'none';
  const champProduitSwissLife = document.getElementById('ct-produit-swisslife-lpp-field');
  if (champProduitSwissLife) champProduitSwissLife.style.display = estLppSwissLife ? 'block' : 'none';
  const { montant, detail } = calculerCommissionEstimee();
  // LAMal + LCA = plusieurs contrats distincts (même n° de police, compagnies parfois différentes)
  // → plusieurs commissions distinctes seront créées à l'enregistrement. L'aperçu doit le montrer,
  // sinon on ne voit que la commission LAMal (CHF 70 forfait) et les LCA passent inaperçues avant
  // de sauver (demande de Jonathan le 21.08.2026).
  const lcaCoche = document.querySelector('.ct-combinable-checkbox[value="lca_autre_compagnie"]');
  let montantTotal = montant;
  let detailFinal = detail;
  if (lcaCoche && lcaCoche.checked) {
    const lignesLCA = calculerLignesLCASaisies();
    if (lignesLCA.length > 0) {
      const parLigne = lignesLCA.map(l => ({ ...l, montant: Math.round(l.primeMensuelle * TAUX_COMMISSION.sante_facteur_mensuel) }));
      const totalLCA = parLigne.reduce((s, l) => s + l.montant, 0);
      montantTotal = montant + totalLCA;
      const detailLCA = parLigne.map(l => `${l.nom} : CHF ${fmtCHF(l.montant)}`).join(', ');
      detailFinal = `${detail} + ${lignesLCA.length} produit LCA (${detailLCA}) = CHF ${fmtCHF(totalLCA)} — ${1 + lignesLCA.length} commissions distinctes seront créées à l'enregistrement (même n° de police).`;
    }
  }
  document.getElementById('commission-preview-value').textContent = 'CHF ' + montantTotal.toLocaleString();
  document.getElementById('commission-preview-detail').textContent = detailFinal;
  const natureEl = document.getElementById('ct-nature-commission');
  const labelEl = document.getElementById('commission-preview-label');
  if (natureEl && labelEl) labelEl.textContent = natureEl.value === 'gestion' ? 'Commission de gestion estimée' : 'Commission d\u2019acquisition estimée';
}

async function creerContratEtCommission(clientId, compagnie, produitLabel, primeMensuelle, modules, montantCommission, detailCommission, plaques, dejaAnnuelle, detailLignes) {
  const commissionne = document.getElementById('ct-commissionne').value !== 'non';
  const contratBody = {
    client_id: clientId,
    apporteur_id: document.getElementById('ct-apporteur').value || null,
    co_apporteur_id: document.getElementById('ct-co-apporteur') ? (document.getElementById('ct-co-apporteur').value || null) : null,
    compagnie,
    produit: produitLabel,
    modules: modules && modules.length > 0 ? modules.join(', ') : null,
    plaques: plaques && plaques.length > 0 ? plaques.join(', ') : null,
    numero_police: document.getElementById('ct-police').value.trim() || null,
    prime_annuelle: dejaAnnuelle ? Math.round(primeMensuelle * 100) / 100 : Math.round(primeMensuelle * (parseInt(document.getElementById('ct-periodicite')?.value) || 12) * 100) / 100,
    date_debut: document.getElementById('ct-date').value || null,
    date_signature: document.getElementById('ct-date-signature').value || null,
    date_echeance: document.getElementById('ct-echeance').value || null,
    statut: document.getElementById('ct-statut').value,
    commissionne,
    detail_lignes: detailLignes && detailLignes.length > 0 ? detailLignes : null,
  };
  const rContrat = await dbPost('contrats', contratBody);
  if (rContrat && rContrat.error) return { error: true, detail: rContrat.detail || rContrat.status };
  logAction('create_contrat', 'contrats', rContrat && rContrat[0] ? rContrat[0].id : null, `${produitLabel} — ${compagnie}`);

  const client = allClients.find(c => c.id === clientId);

  // Contrat non commissionné OU créé directement en "Annulé" : pas de commission générée.
  // Sans date d'échéance, pas de raison d'attendre — rappel créé immédiatement (échéance =
  // aujourd'hui, urgence haute) plutôt que silencieusement omis. Demande de Jonathan le 25.08.2026.
  if (!commissionne || contratBody.statut === 'annulé') {
    if (!commissionne) {
      const aEcheance = !!contratBody.date_echeance;
      let dEch;
      if (aEcheance) { dEch = new Date(contratBody.date_echeance); dEch.setMonth(dEch.getMonth() - 6); }
      else { dEch = new Date(); }
      const nomClient = client ? (estEntreprise(client) ? client.nom : `${client.prenom} ${client.nom}`) : '';
      const rRappel = await dbPost('rappels', {
        titre: `Reprendre "${produitLabel}" de ${nomClient} (actuellement ${compagnie}, non partenaire)`,
        client_id: clientId,
        type: 'Contrat',
        urgence: aEcheance ? 'moyenne' : 'haute',
        date_echeance: dEch.toISOString().split('T')[0],
        notes: aEcheance
          ? `Police actuellement chez ${compagnie} (compagnie non partenaire) — échéance le ${fmtDate(contratBody.date_echeance)}. Objectif : proposer un transfert vers une compagnie partenaire pour générer une commission.`
          : `Police actuellement chez ${compagnie} (compagnie non partenaire) — échéance inconnue, donc à traiter sans attendre. Objectif : proposer un transfert vers une compagnie partenaire pour générer une commission.`,
        statut: 'ouvert',
      });
      if (rRappel && rRappel.error) console.error('Échec de création du rappel de transfert automatique :', errMsg(rRappel));
      allRappels = await dbGet('rappels', 'select=*');
    }
    return { error: false, contrat: rContrat && rContrat[0] ? rContrat[0] : null };
  }
  // Client "assurance prénatale" : la compagnie ne déclenchera réellement la commission qu'à la
  // naissance confirmée, mais le suivi existe dès la saisie — statut dédié 'en_attente_naissance',
  // basculé en 'en_attente' normal par confirmerNaissance() une fois la naissance annoncée.
  const commissionBody = {
    client_id: clientId,
    client_nom: client ? (estEntreprise(client) ? client.nom : `${client.prenom} ${client.nom}`) : '',
    compagnie,
    produit: produitLabel,
    montant_estime: montantCommission,
    detail_calcul: client && client.prenatal ? `${detailCommission} — en attente de naissance` : detailCommission,
    statut: client && client.prenatal ? 'en_attente_naissance' : 'en_attente',
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

  const compagnie = normaliserCompagnie(document.getElementById('ct-compagnie').value.trim());
  const produitSelectionne = getProduitSelectionne();
  const primeMensuelle = parseFloat(document.getElementById('ct-prime-mensuelle').value) || 0;
  if (!compagnie || !primeMensuelle) { showError('Compagnie et prime sont obligatoires.'); return; }
  if (!produitSelectionne) { showError('Sélectionne un produit valide dans la liste proposée.'); return; }

  // Vérifier que les produits combinés cochés ont bien une prime renseignée. La LCA est un cas
  // à part (pas un simple input, mais des lignes dynamiques .ct-lca-ligne) — validée séparément
  // juste en dessous, sinon la case "+ LCA" cochée bloquait TOUJOURS l'enregistrement (aucun
  // .ct-combinable-prime-input n'existe pour elle) — bug repéré par Jonathan le 21.08.2026.
  const combinablesCoches = Array.from(document.querySelectorAll('.ct-combinable-checkbox:checked')).map(cb => cb.value);
  for (const id of combinablesCoches) {
    if (id === 'lca_autre_compagnie') continue;
    const input = document.querySelector(`.ct-combinable-prime-input[data-produit-id="${id}"]`);
    if (!input || !parseFloat(input.value)) { showError('Renseigne la prime annuelle pour chaque produit combiné coché.'); return; }
  }
  if (combinablesCoches.includes('lca_autre_compagnie') && calculerLignesLCASaisies().length === 0) {
    showError('Renseigne au moins un produit LCA (produit + prime mensuelle), ou décoche la case "+ LCA".');
    return;
  }

  const produitLabel = produitSelectionne.label;
  const modulesChoisis = Array.from(document.querySelectorAll('.ct-module-checkbox:checked')).map(cb => {
    const primeInput = document.querySelector(`.ct-module-prime-input[data-idx="${cb.dataset.idx}"]`);
    const prime = primeInput ? parseFloat(primeInput.value) : NaN;
    return !isNaN(prime) && prime > 0 ? `${cb.value} (CHF ${fmtCHF(prime)})` : cb.value;
  });
  // Modules complémentaires au libellé libre (ex: "Assurances complémentaires et services")
  Array.from(document.querySelectorAll('.ct-module-custom-ligne')).forEach(ligne => {
    const nom = ligne.querySelector('.ct-module-custom-nom')?.value.trim();
    if (!nom) return;
    const prime = parseFloat(ligne.querySelector('.ct-module-custom-prime')?.value);
    modulesChoisis.push(!isNaN(prime) && prime > 0 ? `${nom} (CHF ${fmtCHF(prime)})` : nom);
  });
  // Détail des "lignes de prime" (ex: RC véhicule + Casco complète + Casco partielle, ou RC privée +
  // inventaire du ménage) — persisté ici pour que les couvertures annexes restent visibles sur la
  // fiche client (ligne du contrat) et sur la fiche contrat, au lieu de disparaître dans le seul
  // total sommé. N'ajoute rien si une seule ligne (le champ "Prime" suffit déjà dans ce cas).
  const lignesPrimeSaisies = Array.from(document.querySelectorAll('.ct-prime-ligne')).map(ligne => ({
    libelle: (ligne.querySelector('.ct-prime-ligne-libelle')?.value || '').trim(),
    montant: parseFloat(ligne.querySelector('.ct-prime-ligne-montant')?.value) || 0,
  })).filter(l => l.libelle && l.montant > 0);
  if (lignesPrimeSaisies.length > 1) {
    lignesPrimeSaisies.forEach(l => modulesChoisis.push(`${l.libelle} (CHF ${fmtCHF(l.montant)})`));
  }
  const { montant: commissionEstimee, detail } = calculerCommissionEstimee();

  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;

  // Une ligne par plaque saisie (mode "flotte" : plusieurs lignes ; mode "véhicule unique" : une seule) —
  // gardées en paires plaque/marque pour aussi peupler la table vehicules (celle qui alimente réellement
  // "Recherche véhicules" et l'onglet Flotte de la fiche client, contrats.plaques n'étant qu'un résumé texte).
  const lignesPlaques = Array.from(document.querySelectorAll('#ct-plaques-list > div')).map(ligne => ({
    plaque: ligne.querySelector('.ct-plaque-input')?.value.trim() || '',
    marque: ligne.querySelector('.ct-plaque-marque-input')?.value.trim() || '',
  })).filter(l => l.plaque);
  const plaquesValeurs = lignesPlaques.map(l => l.plaque);
  const resultPrincipal = await creerContratEtCommission(clientId, compagnie, produitLabel, primeMensuelle, modulesChoisis, commissionEstimee, detail, plaquesValeurs, false, collecterLignesPrimeSaisies());
  if (resultPrincipal.error) { showError('Erreur lors de la création du contrat: ' + resultPrincipal.detail); btn.textContent = '✓ Enregistrer le contrat'; btn.disabled = false; return; }

  // Peuple la table vehicules à partir des plaques saisies, pour que ce(s) véhicule(s) ressorte(nt)
  // dans "Recherche véhicules" et dans l'onglet Flotte de la fiche client — lié au contrat créé.
  if (lignesPlaques.length > 0 && resultPrincipal.contrat && resultPrincipal.contrat.id) {
    const nouveauContratId = resultPrincipal.contrat.id;
    const policeContrat = document.getElementById('ct-police').value.trim() || null;
    const rVeh = await dbPost('vehicules', lignesPlaques.map(l => ({
      client_id: clientId,
      contrat_id: nouveauContratId,
      marque: l.marque || null,
      numero_plaque: l.plaque,
      numero_police: policeContrat,
    })));
    if (rVeh && rVeh.error) console.error('Échec de l\'enregistrement du/des véhicule(s) dans la table vehicules :', rVeh.detail);
    else allVehicules = await dbGet('vehicules', 'select=*');
  }

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

  // Créer un contrat + commission distincts pour chaque produit combiné véhicule/ménage coché
  // (la LCA est gérée séparément juste après : un client peut avoir plusieurs produits LCA)
  for (const id of combinablesCoches) {
    if (id === 'lca_autre_compagnie') continue;
    const produitCombinable = getProduitParId(id);
    const input = document.querySelector(`.ct-combinable-prime-input[data-produit-id="${id}"]`);
    const primeCombinableAnnuelle = parseFloat(input.value) || 0;
    const montantCombinable = Math.round(primeCombinableAnnuelle * 0.1); // estimation par défaut (10% fictif) — ajustable manuellement ensuite
    await creerContratEtCommission(clientId, compagnie, produitCombinable.label, primeCombinableAnnuelle, [], montantCombinable, 'Produit combiné — commission estimée à ajuster', null, true);
  }

  // Produits LCA (santé complémentaire) — un ou plusieurs par client (ex: hospitalisation + ambulatoire),
  // chacun avec son propre nom de produit et sa propre prime MENSUELLE (les primes santé se paient
  // au mois en Suisse — jamais de conversion annuel/mensuel ici), saisis via les lignes dynamiques.
  if (combinablesCoches.includes('lca_autre_compagnie')) {
    const lignesLCA = document.querySelectorAll('.ct-lca-ligne');
    for (const ligne of lignesLCA) {
      const nomInput = ligne.querySelector('.ct-lca-nom-input');
      const primeInput = ligne.querySelector('.ct-lca-prime-input');
      const nom = nomInput ? nomInput.value.trim() : '';
      const primeMensuelleLCA = primeInput ? parseFloat(primeInput.value) || 0 : 0;
      if (!nom || !primeMensuelleLCA) continue; // ligne vide (ajoutée puis pas remplie) — ignorée
      const montantLCA = Math.round(primeMensuelleLCA * TAUX_COMMISSION.sante_facteur_mensuel);
      const detailLCA = `CHF ${fmtCHF(primeMensuelleLCA)}/mois × ${TAUX_COMMISSION.sante_facteur_mensuel} (taux santé) = CHF ${fmtCHF(montantLCA)}`;
      const primeAnnuelleLCA = Math.round(primeMensuelleLCA * 12 * 100) / 100;
      await creerContratEtCommission(clientId, compagnie, `LCA — ${nom}`, primeAnnuelleLCA, [], montantLCA, detailLCA, null, true);
    }
  }

  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  allContrats = await dbGet('contrats', 'select=*');

  // Si ce contrat provient d'une opportunité passée en "Gagné" avec plusieurs produits cochés,
  // on enchaîne sur le produit suivant de la file d'attente (cf. proposerConversionMultiContrats)
  // au lieu de considérer la conversion terminée — le lien opportunites.contrat_id (une seule
  // colonne) est posé sur le DERNIER contrat créé de la série, une fois la file vidée.
  if (prefillOpportunite && prefillOpportunite.id && resultPrincipal.contrat && resultPrincipal.contrat.id) {
    if (oppFileAttenteProduits.length) {
      const prochainProduitId = oppFileAttenteProduits.shift();
      const prochain = produitCategorieEtObjetParId(prochainProduitId);
      prefillOpportuniteProduitId = prochainProduitId;
      showError(`✓ Contrat créé — contrat suivant à compléter : ${prochain ? prochain.produit.label : ''} (${oppFileAttenteProduits.length + 1} restant(s))`);
      navigate('nouveau-contrat');
      return;
    }
    const rOpp = await dbPatch('opportunites', prefillOpportunite.id, { contrat_id: resultPrincipal.contrat.id });
    if (rOpp && rOpp.error) showError('⚠️ Contrat créé, mais le lien avec l\u2019opportunité n\u2019a pas pu être enregistré : ' + errMsg(rOpp));
    allOpportunites = await dbGet('opportunites', 'select=*');
    prefillOpportunite = null;
    prefillOpportuniteProduitId = null;
  }

  if (contratClientId) {
    showClient(contratClientId);
  } else {
    navigate('suivi');
  }
}

// ═══ TOUTES LES COMMISSIONS — vue unifiée et recherchable (en attente + reçues) ═══
// ═══ Édition d'une commission (ouvrir/modifier depuis "Toutes les commissions") ═══
