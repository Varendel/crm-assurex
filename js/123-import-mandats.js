// ═══ IMPORT D'UN DOSSIER DE MANDATS (22.09.2026) ═══════════════════════════════════════════════
// « Check le dossier Mandats et joins tous les mandats sur le CRM, ceux d'Assurex. Je dois encore
// m'occuper de ceux d'OZ Assure, c'est en cours. »
//
// Le dossier d'équipe range un sous-dossier par client (Mandats\Kisann SA\…, Mandats Privés\Demir
// Céline\…). On choisit le dossier racine ; l'outil :
//   1. retient, dans chaque sous-dossier, les PDF / images dont le nom contient « mandat » (pas les
//      courriers d'annulation ni les fichiers cachés « ._ ») ;
//   2. rapproche le sous-dossier d'une fiche client par les mots du nom (sans Sàrl, SA, AG…) ;
//   3. montre le tableau : dossier → fichier → fiche proposée, modifiable ligne par ligne, et
//      décoche d'office ce qui est déjà sur la fiche (même fichier, ou un PDF déjà classé) ;
//   4. n'envoie RIEN avant le clic « Importer » : chaque fichier part dans le stockage
//      (documents/mandats/<client>/…) et une ligne « mandat signé » est créée, comme un dépôt manuel.
// L'entité (Assurex / OZ Assure) est portée dans le nom du document : il servira aussi pour OZ.

const IMP_BRUIT = new Set(['sarl', 'sàrl', 'sa', 'ag', 'gmbh', 'sas', 'sagl', 'snc', 'the', 'le', 'la', 'les', 'de', 'du', 'des', 'et', 'l', 'd', 'mandat', 'mandats', 'courtage']);
let _imp = null;

function impEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function impMots(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(m => m && !IMP_BRUIT.has(m));
}
function impNomClient(c) { return estEntreprise(c) ? (c.nom || '') : `${c.prenom || ''} ${c.nom || ''}`.trim(); }

// Score de ressemblance : part des mots du dossier retrouvés dans la fiche (préfixes admis : un
// dossier « Valenthier » rejoint la fiche « Valentier », « Posturo » rejoint « Posturo »).
function impScore(motsDossier, c) {
  const motsFiche = new Set([...impMots(c.nom), ...impMots(c.prenom)]);
  if (!motsDossier.length || !motsFiche.size) return 0;
  let trouves = 0;
  for (const m of motsDossier) {
    if (motsFiche.has(m)) { trouves++; continue; }
    if ([...motsFiche].some(f => (f.length >= 4 && m.length >= 4) && (f.startsWith(m.slice(0, 5)) || m.startsWith(f.slice(0, 5))))) { trouves += 0.8; continue; }
    // Une lettre de travers (« ECXCAV » pour « EXCAV ») : distance d'édition 1 sur un mot long.
    if ([...motsFiche].some(f => f.length >= 5 && m.length >= 5 && impDistance(f, m) <= 1)) trouves += 0.9;
  }
  const couverture = trouves / motsDossier.length;
  const nomSeul = impMots(c.nom);
  const precision = nomSeul.length ? nomSeul.filter(f => motsDossier.some(m => m === f || (f.length >= 4 && m.startsWith(f.slice(0, 5))))).length / nomSeul.length : 0;
  return couverture * 0.7 + precision * 0.3;
}

function impDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function impMeilleureFiche(dossier) {
  // « MIVIAL SA - Tafick Club » : on essaie aussi la partie avant le tiret (la raison sociale).
  const variantes = [dossier, ...String(dossier).split(/\s[-–—]\s/).filter(Boolean)].map(impMots).filter(v => v.length);
  let best = null, second = 0;
  for (const c of (allClients || [])) {
    const s = Math.max(0, ...variantes.map(v => impScore(v, c)));
    if (!best || s > best.s) { second = best ? best.s : 0; best = { c, s }; } else if (s > second) second = s;
  }
  if (!best || best.s < 0.55) return { client: null, sur: false };
  return { client: best.c, sur: best.s >= 0.8 && best.s - second > 0.15 };
}

// Quel segment du chemin porte le nom du client ? Avant, on prenait bêtement parts[1], ce qui
// n'est juste que si tu choisis exactement le dossier « Mandats ». Si tu choisis le niveau
// au-dessus, parts[1] vaut « Mandats » et tous les fichiers se retrouvent dans un seul paquet
// qui ne correspond à aucune fiche : d'où les mandats « non reconnus ».
// On repart donc du dossier parent du fichier et on remonte tant qu'on tombe sur un nom
// générique (Mandats, Contrats, Divers documents clients, Scans…).
const IMP_DOSSIER_GENERIQUE = /^(mandats?|contrats?|offres?|polices?|documents?|divers|scans?|sign[ée]s?|archives?|pdf|\d{4})\b|document|contrat|courtage/i;
function impDossierClient(parts) {
  // Si tu choisis directement le dossier d'un client (« Mandats\AGV TONI SA »), le nom du client
  // est parts[0] : on descend jusqu'à 0 dans ce cas seulement, sinon parts[0] est le dossier choisi.
  const min = parts.length === 2 ? 0 : 1;
  for (let i = parts.length - 2; i >= min; i--) {
    if (!IMP_DOSSIER_GENERIQUE.test(parts[i])) return parts[i];
  }
  return null;
}

function impFichiersRetenus(liste) {
  return liste.filter(f => /mandat/i.test(f.name) && /\.(pdf|jpe?g|png|heic|webp)$/i.test(f.name)
    && !/^\._/.test(f.name) && !/annulation|r[ée]siliation|courrier/i.test(f.name));
}

// Parmi plusieurs mandats d'un même dossier, on propose celui qui dit « Assurex » (ou « OZ » pour
// un import OZ), sinon le plus récent.
function impChoixParDefaut(fichiers, entite) {
  const cle = entite === 'OZ Assure' ? /\boz\b/i : /assurex/i;
  const nomme = fichiers.filter(f => cle.test(f.name));
  const pool = nomme.length ? nomme : fichiers;
  return [...pool].sort((a, b) => b.lastModified - a.lastModified)[0];
}

async function impOuvrir() {
  document.getElementById('imp-modale')?.remove();
  const m = document.createElement('div');
  m.id = 'imp-modale'; m.className = 'imp-voile';
  m.innerHTML = `<div class="imp-boite" role="dialog" aria-modal="true" aria-labelledby="imp-titre">
    <header class="imp-tete"><h2 id="imp-titre">Importer un dossier de mandats</h2>
      <button type="button" class="imp-x" onclick="document.getElementById('imp-modale').remove()" aria-label="Fermer">×</button></header>
    <div class="imp-corps" id="imp-corps">
      <p>Choisis le dossier qui range un sous-dossier par client (par exemple <b>Mandats</b> ou <b>Mandats Privés</b> du site d’équipe). Rien n’est envoyé avant ta confirmation.</p>
      <div class="imp-choix">
        <label>Entité <select id="imp-entite"><option>Assurex</option><option>OZ Assure</option></select></label>
        <label class="btn-save imp-dossier">📁 Choisir le dossier…<input type="file" webkitdirectory directory multiple hidden onchange="impAnalyser(this.files)"/></label>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
}

async function impAnalyser(files) {
  const entite = document.getElementById('imp-entite')?.value || 'Assurex';
  const corps = document.getElementById('imp-corps');
  corps.innerHTML = '<div class="loader">Analyse du dossier…</div>';
  const parDossier = new Map();
  for (const f of files) {
    const parts = (f.webkitRelativePath || f.name).split('/');
    if (parts.length < 2) continue;                     // fichier posé à la racine : pas de client
    const dossier = impDossierClient(parts);
    if (!dossier) continue;
    if (!parDossier.has(dossier)) parDossier.set(dossier, []);
    parDossier.get(dossier).push(f);
  }
  const existants = await dbGet('mandats_signes', 'archive=is.false&select=client_id,fichier_url,fichier_nom').catch(() => []) || [];
  const lignes = [];
  for (const [dossier, tous] of [...parDossier.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'))) {
    const fichiers = impFichiersRetenus(tous);
    const { client, sur } = impMeilleureFiche(dossier);
    const choisi = fichiers.length ? impChoixParDefaut(fichiers, entite) : null;
    const dejaFichier = client && existants.some(e => e.client_id === client.id && e.fichier_url);
    const memeNom = client && choisi && existants.some(e => e.client_id === client.id && (e.fichier_nom || '').includes(choisi.name));
    lignes.push({ dossier, fichiers, choisi, client, sur, deja: !!(dejaFichier || memeNom),
      coche: !!(fichiers.length && client && !dejaFichier && !memeNom) });
  }
  _imp = { entite, lignes };
  impRendre();
}

function impRendre() {
  const corps = document.getElementById('imp-corps');
  if (!corps || !_imp) return;
  const options = [...(allClients || [])].sort((a, b) => impNomClient(a).localeCompare(impNomClient(b), 'fr'));
  const nb = _imp.lignes.filter(l => l.coche).length;
  corps.innerHTML = `
    <p class="imp-resume"><b>${_imp.lignes.length}</b> dossiers · <b>${nb}</b> mandat${nb > 1 ? 's' : ''} prêt${nb > 1 ? 's' : ''} à importer (${impEsc(_imp.entite)}). Vérifie la fiche proposée pour chaque ligne en orange.</p>
    <div class="imp-table-boite"><table class="imp-table">
      <thead><tr><th></th><th>Dossier</th><th>Fichier</th><th>Fiche du CRM</th><th>État</th></tr></thead>
      <tbody>${_imp.lignes.map((l, i) => {
        const etat = !l.fichiers.length ? '<span class="imp-etat gris">Aucun PDF de mandat</span>'
          : !l.client ? '<span class="imp-etat rouge">Aucune fiche trouvée</span>'
          : l.deja ? '<span class="imp-etat vert">Déjà sur la fiche</span>'
          : l.sur ? '<span class="imp-etat vert">Correspondance sûre</span>' : '<span class="imp-etat orange">À vérifier</span>';
        return `<tr class="${l.coche ? '' : 'off'}">
          <td><input type="checkbox" ${l.coche ? 'checked' : ''} ${l.fichiers.length ? '' : 'disabled'} onchange="_imp.lignes[${i}].coche=this.checked;impRendre()" aria-label="Importer ${impEsc(l.dossier)}"/></td>
          <td><b>${impEsc(l.dossier)}</b></td>
          <td>${l.fichiers.length > 1 ? `<select onchange="_imp.lignes[${i}].choisi=_imp.lignes[${i}].fichiers[this.value]">${l.fichiers.map((f, k) => `<option value="${k}" ${f === l.choisi ? 'selected' : ''}>${impEsc(f.name)} (${Math.round(f.size / 1024)} Ko)</option>`).join('')}</select>`
            : l.choisi ? `${impEsc(l.choisi.name)} <small>(${Math.round(l.choisi.size / 1024)} Ko)</small>` : '—'}</td>
          <td><select onchange="_imp.lignes[${i}].client=(allClients||[]).find(c=>c.id===this.value)||null;_imp.lignes[${i}].sur=true;_imp.lignes[${i}].coche=!!(_imp.lignes[${i}].client&&_imp.lignes[${i}].fichiers.length);impRendre()">
            <option value="">— choisir —</option>${options.map(c => `<option value="${c.id}" ${l.client && l.client.id === c.id ? 'selected' : ''}>${impEsc(impNomClient(c))}</option>`).join('')}</select></td>
          <td>${etat}</td></tr>`;
      }).join('')}</tbody></table></div>
    <footer class="imp-pied"><button type="button" class="btn-secondary" onclick="impOuvrir()">← Autre dossier</button>
      <button type="button" class="btn-save" id="imp-go" ${nb ? '' : 'disabled'} onclick="impImporter()">Importer ${nb} mandat${nb > 1 ? 's' : ''}</button></footer>`;
}

async function impImporter() {
  const lot = _imp.lignes.filter(l => l.coche && l.client && l.choisi);
  if (!lot.length) return;
  if (!confirm(`Importer ${lot.length} mandat${lot.length > 1 ? 's' : ''} (${_imp.entite}) sur les fiches clients ?`)) return;
  const btn = document.getElementById('imp-go'); if (btn) btn.disabled = true;
  let ok = 0; const echecs = [];
  const token = await getValidAccessToken() || SUPABASE_KEY;
  for (const [n, l] of lot.entries()) {
    if (btn) btn.textContent = `Import ${n + 1} / ${lot.length}…`;
    const f = l.choisi, c = l.client, nom = impNomClient(c);
    const ext = (f.name.split('.').pop() || 'pdf').toLowerCase();
    const slug = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'client';
    const path = `mandats/${c.id}/Mandat_de_courtage_${slug}_import_${Date.now().toString(36)}.${ext}`;
    const type = f.type || (ext === 'pdf' ? 'application/pdf' : 'image/' + ext.replace('jpg', 'jpeg'));
    try {
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
        method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': type }, body: f });
      if (!up.ok) throw new Error('stockage ' + up.status);
      const r = await dbPost('mandats_signes', {
        client_id: c.id, signe: true,
        cree_par: (typeof supaSession !== 'undefined' && supaSession && supaSession.email) || null,
        fichier_url: path,
        fichier_nom: `Mandat de courtage — ${nom} — ${_imp.entite} (importé : ${f.name})`,
        // Date du fichier plutôt que celle de l'import : c'est la plus proche de la signature.
        created_at: new Date(f.lastModified || Date.now()).toISOString(),
      });
      if (r && r.error) throw new Error(errMsg(r));
      ok++; l.coche = false; l.deja = true;
      if (typeof _couMandats !== 'undefined') _couMandats.delete(c.id);
    } catch (e) { echecs.push(`${l.dossier} : ${e.message || e}`); }
  }
  if (typeof logAction === 'function') logAction('import_mandats', 'mandats_signes', null, `${ok} mandat(s) ${_imp.entite}`);
  impRendre();
  showError(echecs.length ? `✓ ${ok} importé(s) — ${echecs.length} échec(s) : ${echecs.join(' ; ')}` : `✓ ${ok} mandat${ok > 1 ? 's' : ''} importé${ok > 1 ? 's' : ''} sur les fiches.`);
}

// La porte d'entrée : un bouton dans la carte « Documents & mandats signés » de chaque fiche.
(function impBrancher() {
  if (typeof htmlDocumentsMandatsClient !== 'function') return;
  const origine = htmlDocumentsMandatsClient;
  window.htmlDocumentsMandatsClient = function (c, liste) {
    const h = origine.apply(this, arguments);
    return h.replace('<div class="mdx-carte-boutons">',
      '<div class="mdx-carte-boutons"><button type="button" class="btn-secondary" onclick="impOuvrir()" title="Importer tous les mandats d’un dossier (un sous-dossier par client)">📁 Importer un dossier</button>');
  };
})();
