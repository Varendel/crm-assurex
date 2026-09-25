// ═══ CHERCHER UNE PIÈCE DANS LE DOSSIER DE DÉPÔT (21.09.2026) ══════════════════════════════════
// « Je vais sur une fiche client et je peux scanner le dossier de dépôt pour ajouter la pièce
// recherchée par détection. J'ai souvent des pièces d'identité, des permis ou des polices à
// téléverser. »
//
// Le geste d'avant : ouvrir l'explorateur, descendre dans le dossier des scans, reconnaître le bon
// fichier parmi « Scan_0047.pdf » et « IMG_2231.jpg », revenir, cliquer « Déposer », le retrouver
// une seconde fois. Ici, le dossier est lu d'un coup et les fichiers sont classés pour CE client :
//
//   1. DÉTECTION PAR LE NOM ET LA DATE — immédiate, rien ne quitte l'ordinateur. Le nom ou le
//      prénom du client dans le fichier, un mot qui trahit le type (« ID », « passeport »,
//      « permis », « police », une compagnie connue), un numéro de police de ses contrats, et la
//      fraîcheur : un scan d'il y a dix minutes est presque toujours celui qu'on cherche.
//   2. LECTURE DU CONTENU — sur demande, fichier par fichier. Pour « Scan_0047.pdf », le nom ne dit
//      rien : on envoie l'image, réduite, à la fonction de lecture déjà utilisée pour les décomptes
//      (Edge Function ocr-decompte, action « classer »), qui répond : carte d'identité de
//      Marie Exemple. Elle ne recopie aucun numéro de pièce d'identité, et rien n'est conservé.
//
// Le dossier choisi est retenu (navigateurs Chrome et Edge) : la fois suivante, un clic suffit.
// Ailleurs, on choisit le dossier à chaque fois — la détection marche pareil.
//
// L'ajout passe par dcxDeposerUnFichier (js/59) : même rangement, même rattachement automatique
// au contrat quand le numéro de police est dans le nom. Seuls le type et la fiche sont fixés ici.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Le bouton disparaît de l'onglet Documents.

const DPS_EXTENSIONS = /\.(pdf|jpe?g|png|webp|heic|heif|tiff?)$/i;
const DPS_MAX_FICHIERS = 3000;
const DPS_PROFONDEUR = 3;
const DPS_OCR_URL = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/ocr-decompte';

// Les types de pièce. Ils s'ajoutent à ceux de js/59 (police, facture…) : une pièce d'identité
// n'est pas un document de compagnie, mais elle vit au même endroit sur la fiche.
const DPS_TYPES = {
  identite: { label: 'Pièce d’identité', icone: '🪪', mots: /\b(id|ci|cni|carte.?d.?identit|identit|identity|ausweis|idk)\b|passe?port|pass\b/i },
  permis_conduire: { label: 'Permis de conduire', icone: '🚗', mots: /permis.?(de.?)?conduire|f(ü|ue)hrerausweis|driving|\bpc\b|\bpermis\b(?!.?(de.?)?(circulation|s[ée]jour|[bcgl]\b))/i },
  permis_sejour: { label: 'Permis de séjour', icone: '🛂', mots: /s[ée]jour|permis.?[bcgl]\b|titre.?de.?s|ausl(ä|ae)nder|aufenthalt/i },
  permis_circulation: { label: 'Permis de circulation', icone: '📘', mots: /circulation|carte.?grise|fahrzeugausweis|\bpermis.?circ/i },
  police: { label: 'Police', icone: '📄', mots: /police|policy|contrat|vertrag|offre|proposition|avenant/i },
  attestation: { label: 'Attestation', icone: '✅', mots: /attestation|certificat|bestätigung/i },
  autre: { label: 'Autre document', icone: '📎', mots: null },
};
(function dpsTypesDansDcx() {
  if (typeof DCX_TYPES === 'undefined') return;
  for (const [k, v] of Object.entries(DPS_TYPES)) if (!DCX_TYPES[k]) DCX_TYPES[k] = { label: v.label, icone: v.icone };
})();

window._dps = window._dps || { dossier: null, nomDossier: '', fichiers: [], clientId: null, filtre: 'tous', texte: '', choix: {}, lectures: {} };

function dpsEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function dpsNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function dpsTaille(o) { return o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1048576).toFixed(1)} Mo`; }
function dpsQuand(ms) {
  const j = Math.floor((Date.now() - ms) / 86400000);
  if (j <= 0) { const h = Math.floor((Date.now() - ms) / 3600000); return h <= 0 ? 'à l’instant' : `il y a ${h} h`; }
  if (j === 1) return 'hier';
  if (j < 30) return `il y a ${j} j`;
  return new Date(ms).toLocaleDateString('fr-CH');
}

// ── Le dossier retenu (IndexedDB : un « handle » ne se range pas dans localStorage) ─────────────
function dpsBase() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('rex-depot', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('dossiers');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function dpsRetenir(handle) {
  try { const db = await dpsBase(); db.transaction('dossiers', 'readwrite').objectStore('dossiers').put(handle, 'depot'); } catch (e) {}
}
async function dpsRetrouver() {
  try {
    const db = await dpsBase();
    return await new Promise(ok => {
      const q = db.transaction('dossiers').objectStore('dossiers').get('depot');
      q.onsuccess = () => ok(q.result || null);
      q.onerror = () => ok(null);
    });
  } catch (e) { return null; }
}

// ── Lire le dossier ────────────────────────────────────────────────────────────────────────────
async function dpsParcourirHandle(handle, chemin, profondeur, out) {
  for await (const [nom, entree] of handle.entries()) {
    if (out.length >= DPS_MAX_FICHIERS) return;
    if (nom.startsWith('.') || nom.startsWith('~$')) continue;
    if (entree.kind === 'directory') {
      if (profondeur < DPS_PROFONDEUR) await dpsParcourirHandle(entree, chemin ? `${chemin}/${nom}` : nom, profondeur + 1, out);
    } else if (DPS_EXTENSIONS.test(nom)) {
      try {
        const f = await entree.getFile();
        out.push({ nom, chemin, fichier: f, date: f.lastModified, taille: f.size });
      } catch (e) { /* fichier verrouillé ou en cours de synchronisation OneDrive : on l'ignore */ }
    }
  }
}

async function dpsChoisirDossier() {
  if (window.showDirectoryPicker) {
    try {
      const h = await window.showDirectoryPicker({ id: 'rex-depot', mode: 'read' });
      window._dps.dossier = h;
      window._dps.nomDossier = h.name;
      await dpsRetenir(h);
      await dpsLire();
    } catch (e) { if (e && e.name !== 'AbortError') showError('Dossier inaccessible : ' + (e.message || e)); }
    return;
  }
  // Safari, Firefox : pas d'accès durable à un dossier. On passe par un sélecteur de dossier
  // classique, à refaire à chaque recherche.
  const input = document.createElement('input');
  input.type = 'file'; input.multiple = true; input.webkitdirectory = true;
  input.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    const liste = [...input.files].filter(f => DPS_EXTENSIONS.test(f.name)).slice(0, DPS_MAX_FICHIERS);
    input.remove();
    window._dps.nomDossier = (liste[0] && liste[0].webkitRelativePath || '').split('/')[0] || 'dossier choisi';
    window._dps.fichiers = liste.map(f => ({ nom: f.name, chemin: (f.webkitRelativePath || '').split('/').slice(1, -1).join('/'), fichier: f, date: f.lastModified, taille: f.size }));
    dpsPeindre();
  });
  input.click();
}

async function dpsLire() {
  const h = window._dps.dossier;
  if (!h) return;
  // Chrome redemande l'autorisation d'une session à l'autre : c'est le navigateur qui protège le
  // disque, pas nous. Un clic de l'utilisateur est nécessaire, d'où l'appel depuis un bouton.
  try {
    let p = await h.queryPermission({ mode: 'read' });
    if (p !== 'granted') p = await h.requestPermission({ mode: 'read' });
    if (p !== 'granted') { showError('Accès au dossier refusé.'); return; }
  } catch (e) {}
  const zone = document.getElementById('dps-liste');
  if (zone) zone.innerHTML = '<div class="dps-vide">Lecture du dossier…</div>';
  const out = [];
  await dpsParcourirHandle(h, '', 1, out);
  window._dps.fichiers = out;
  dpsPeindre();
}

// ── La détection ───────────────────────────────────────────────────────────────────────────────
function dpsClient() {
  const id = window._dps.clientId;
  return (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === id)
    || (window._nad && window._nad.fiche && window._nad.fiche.id === id ? window._nad.fiche : null);
}

function dpsTypeNom(nom) {
  for (const [k, t] of Object.entries(DPS_TYPES)) if (t.mots && t.mots.test(nom.replace(/[_.-]+/g, ' '))) return k;
  return null;
}

function dpsAnalyser(x) {
  const c = dpsClient();
  const n = dpsNorm(`${x.chemin} ${x.nom.replace(/\.[a-z0-9]+$/i, '')}`);
  const mots = new Set(n.split(' '));
  let note = 0;
  const raisons = [];

  if (c) {
    const nom = dpsNorm(c.nom).split(' ').filter(m => m.length >= 3);
    const prenom = dpsNorm(c.prenom).split(' ').filter(m => m.length >= 3);
    const aNom = nom.length && nom.every(m => mots.has(m) || n.includes(m));
    const aPrenom = prenom.length && prenom.some(m => mots.has(m));
    if (aNom && aPrenom) { note += 60; raisons.push('nom et prénom'); }
    else if (aNom) { note += 40; raisons.push('nom'); }
    else if (aPrenom) { note += 15; raisons.push('prénom'); }
    // Un numéro de police d'un de ses contrats vaut une signature.
    const polices = (typeof allContrats !== 'undefined' ? allContrats : [])
      .filter(ct => ct.client_id === c.id && ct.numero_police).map(ct => String(ct.numero_police).replace(/[^0-9a-z]/gi, '').toLowerCase()).filter(p => p.length >= 5);
    const compact = n.replace(/ /g, '');
    if (polices.some(p => compact.includes(p))) { note += 50; raisons.push('n° de police'); }
    // Une plaque de ses véhicules, pour le permis de circulation.
    const plaques = (typeof allVehicules !== 'undefined' ? allVehicules : []).filter(v => v.client_id === c.id && v.numero_plaque)
      .map(v => String(v.numero_plaque).replace(/[^0-9a-z]/gi, '').toLowerCase());
    if (plaques.some(p => p.length >= 4 && compact.includes(p))) { note += 40; raisons.push('plaque'); }
  }

  const lu = window._dps.lectures[dpsCle(x)];
  let type = lu && lu.type ? dpsTypeDepuisLecture(lu.type) : dpsTypeNom(x.nom + ' ' + x.chemin);
  if (type) { note += 25; }
  if (lu && lu.correspond) { note += 70; raisons.push('contenu lu'); }
  if (lu && lu.correspond === false) { note -= 40; }

  const age = (Date.now() - x.date) / 86400000;
  if (age < 1) note += 25; else if (age < 7) note += 15; else if (age < 30) note += 5;

  return { note, type: type || 'autre', raisons, lu };
}

function dpsCle(x) { return `${x.chemin}/${x.nom}/${x.taille}/${x.date}`; }
function dpsTypeDepuisLecture(t) {
  return ({ identite: 'identite', passeport: 'identite', permis_conduire: 'permis_conduire', permis_sejour: 'permis_sejour',
    permis_circulation: 'permis_circulation', police: 'police', attestation: 'attestation' })[t] || 'autre';
}

// ── La fenêtre ─────────────────────────────────────────────────────────────────────────────────
async function dpsOuvrir(clientId) {
  window._dps.clientId = clientId;
  window._dps.choix = {};
  const c = dpsClient();
  const nom = c ? ((typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : 'ce client';
  creerModale('modal-dps', `
    <div class="opx-modale mdx-modale mdx-modale-flex dps-modale" role="dialog" aria-modal="true" aria-labelledby="dps-titre">
      <h3 id="dps-titre">Chercher une pièce pour ${dpsEsc(nom)}</h3>
      <div class="dps-dossier">
        <span id="dps-nom-dossier">${window._dps.nomDossier ? `Dossier : <b>${dpsEsc(window._dps.nomDossier)}</b>` : 'Aucun dossier de dépôt choisi'}</span>
        <span class="dps-dossier-actions">
          <button type="button" class="btn-secondary" id="dps-relire" onclick="dpsLire()" ${window._dps.dossier ? '' : 'hidden'}>Relire</button>
          <button type="button" class="btn-secondary" onclick="dpsChoisirDossier()">${window._dps.nomDossier ? 'Changer de dossier' : 'Choisir le dossier de dépôt'}</button>
        </span>
      </div>
      <div class="dps-filtres" role="group" aria-label="Type de pièce">
        ${[['tous', 'Tout'], ...Object.entries(DPS_TYPES).filter(([k]) => k !== 'autre').map(([k, t]) => [k, t.label])].map(([k, l]) =>
          `<button type="button" class="dps-filtre ${window._dps.filtre === k ? 'on' : ''}" onclick="dpsFiltrer('${k}')">${dpsEsc(l)}</button>`).join('')}
      </div>
      <input class="form-input dps-texte" type="search" placeholder="Filtrer par nom de fichier…" value="${dpsEsc(window._dps.texte)}"
        oninput="window._dps.texte=this.value; dpsPeindre()" aria-label="Filtrer par nom de fichier"/>
      <div class="dps-liste" id="dps-liste"></div>
      <p class="adr-aide">La détection lit les noms et les dates des fichiers, sur cet ordinateur. « Lire » envoie le fichier,
        réduit, au service de lecture déjà utilisé pour les décomptes ; rien n’est conservé.</p>
      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-dps').remove()">Fermer</button>
        <button type="button" class="btn-save" id="dps-ajouter" onclick="dpsAjouter()" disabled>Ajouter à la fiche</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');

  if (!window._dps.dossier && window.showDirectoryPicker) {
    const h = await dpsRetrouver();
    if (h) { window._dps.dossier = h; window._dps.nomDossier = h.name; document.getElementById('dps-nom-dossier').innerHTML = `Dossier : <b>${dpsEsc(h.name)}</b>`; document.getElementById('dps-relire')?.removeAttribute('hidden'); }
  }
  if (window._dps.fichiers.length) dpsPeindre();
  else document.getElementById('dps-liste').innerHTML = `<div class="dps-vide">${window._dps.dossier
    ? `<button type="button" class="btn-save" onclick="dpsLire()">Lire le dossier ${dpsEsc(window._dps.nomDossier)}</button>`
    : 'Choisissez le dossier où arrivent vos scans (celui du scanner, de OneDrive ou des téléchargements).'}</div>`;
}

function dpsFiltrer(k) {
  window._dps.filtre = k;
  document.querySelectorAll('#modal-dps .dps-filtre').forEach(b => b.classList.toggle('on', b.getAttribute('onclick') === `dpsFiltrer('${k}')`));
  dpsPeindre();
}

function dpsPeindre() {
  const zone = document.getElementById('dps-liste');
  if (!zone) return;
  const S = window._dps;
  document.getElementById('dps-nom-dossier') && (document.getElementById('dps-nom-dossier').innerHTML = S.nomDossier ? `Dossier : <b>${dpsEsc(S.nomDossier)}</b> · ${S.fichiers.length} fichier${S.fichiers.length > 1 ? 's' : ''}` : 'Aucun dossier choisi');
  const q = dpsNorm(S.texte);
  let lignes = S.fichiers.map(x => ({ x, a: dpsAnalyser(x) }))
    .filter(({ x, a }) => (S.filtre === 'tous' || a.type === S.filtre) && (!q || dpsNorm(x.chemin + ' ' + x.nom).includes(q)));
  lignes.sort((p, r) => r.a.note - p.a.note || r.x.date - p.x.date);
  const total = lignes.length;
  lignes = lignes.slice(0, 60);
  if (!total) { zone.innerHTML = `<div class="dps-vide">${S.fichiers.length ? 'Aucun fichier ne correspond à ce filtre.' : 'Dossier vide ou sans scans lisibles.'}</div>`; dpsMajBouton(); return; }

  zone.innerHTML = lignes.map(({ x, a }) => {
    const k = dpsCle(x);
    const choix = S.choix[k];
    const pour = a.raisons.length ? `<span class="dps-badge ok">${dpsEsc(a.raisons.join(' · '))}</span>` : '';
    const lu = a.lu ? (a.lu.erreur ? `<span class="dps-badge ko">${dpsEsc(a.lu.erreur)}</span>`
      : `<span class="dps-badge ${a.lu.correspond ? 'ok' : a.lu.correspond === false ? 'ko' : ''}">lu : ${dpsEsc(DPS_TYPES[dpsTypeDepuisLecture(a.lu.type)].label)}${a.lu.titulaire ? ` de ${dpsEsc(a.lu.titulaire)}` : ''}</span>`) : '';
    const image = /\.(jpe?g|png|webp)$/i.test(x.nom);
    return `<div class="dps-ligne ${choix ? 'choisie' : ''}">
      <label class="dps-case"><input type="checkbox" ${choix ? 'checked' : ''} onchange="dpsCocher('${encodeURIComponent(k)}', this.checked)" aria-label="Choisir ${dpsEsc(x.nom)}"/></label>
      <span class="dps-vignette" data-k="${encodeURIComponent(k)}">${image ? '' : DPS_TYPES[a.type].icone}</span>
      <div class="dps-corps">
        <b title="${dpsEsc(x.nom)}">${dpsEsc(x.nom)}</b>
        <small>${x.chemin ? dpsEsc(x.chemin) + ' · ' : ''}${dpsQuand(x.date)} · ${dpsTaille(x.taille)}</small>
        <span class="dps-badges">${pour}${lu}</span>
      </div>
      <select class="form-input dps-type" onchange="dpsType('${encodeURIComponent(k)}', this.value)" aria-label="Type de pièce">
        ${Object.entries(DPS_TYPES).map(([t, v]) => `<option value="${t}" ${(choix ? choix.type : a.type) === t ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select>
      <span class="dps-actions">
        <button type="button" class="dps-mini" onclick="dpsVoir('${encodeURIComponent(k)}')">Voir</button>
        ${/\.(pdf|jpe?g|png|webp)$/i.test(x.nom) ? `<button type="button" class="dps-mini" onclick="dpsLireContenu('${encodeURIComponent(k)}', this)">Lire</button>` : ''}
      </span>
    </div>`;
  }).join('') + (total > 60 ? `<div class="dps-vide">${total - 60} autres fichiers — affinez avec le filtre.</div>` : '');

  // Vignettes des images, en différé : lire 60 photos d'un coup gèlerait la fenêtre.
  zone.querySelectorAll('.dps-vignette[data-k]').forEach(v => {
    const x = dpsTrouver(decodeURIComponent(v.dataset.k));
    if (!x || !/\.(jpe?g|png|webp)$/i.test(x.nom) || x.fichier.size > 15 * 1048576) return;
    if (!x.url) x.url = URL.createObjectURL(x.fichier);
    v.style.backgroundImage = `url("${x.url}")`;
  });
  dpsMajBouton();
}

function dpsTrouver(k) { return window._dps.fichiers.find(x => dpsCle(x) === k); }
function dpsCocher(kEnc, oui) {
  const k = decodeURIComponent(kEnc);
  const x = dpsTrouver(k);
  if (!x) return;
  if (oui) window._dps.choix[k] = { type: dpsAnalyser(x).type }; else delete window._dps.choix[k];
  dpsPeindre();
}
function dpsType(kEnc, t) {
  const k = decodeURIComponent(kEnc);
  window._dps.choix[k] = { ...(window._dps.choix[k] || {}), type: t };
  dpsPeindre();
}
function dpsVoir(kEnc) {
  const x = dpsTrouver(decodeURIComponent(kEnc));
  if (!x) return;
  if (!x.url) x.url = URL.createObjectURL(x.fichier);
  window.open(x.url, '_blank', 'noopener');
}
function dpsMajBouton() {
  const n = Object.keys(window._dps.choix).length;
  const b = document.getElementById('dps-ajouter');
  if (b) { b.disabled = !n; b.textContent = n ? `Ajouter ${n} pièce${n > 1 ? 's' : ''} à la fiche` : 'Ajouter à la fiche'; }
}

// ── Lire le contenu (sur demande) ──────────────────────────────────────────────────────────────
// Une photo de téléphone pèse 4 à 8 Mo : on la réduit à 1600 px avant l'envoi. Lisible pour une
// carte d'identité, et dix fois plus léger.
async function dpsReduire(fichier) {
  if (fichier.type === 'application/pdf' || /\.pdf$/i.test(fichier.name)) {
    if (fichier.size > 15 * 1048576) throw new Error('PDF trop lourd');
    return { base64: await dpsBase64(fichier), mime: 'application/pdf' };
  }
  const bmp = await createImageBitmap(fichier);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.85));
  return { base64: await dpsBase64(blob), mime: 'image/jpeg' };
}
function dpsBase64(blob) {
  return new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = ko; fr.readAsDataURL(blob); });
}

async function dpsLireContenu(kEnc, bouton) {
  const k = decodeURIComponent(kEnc);
  const x = dpsTrouver(k);
  if (!x) return;
  if (bouton) { bouton.disabled = true; bouton.textContent = 'Lecture…'; }
  try {
    const { base64, mime } = await dpsReduire(x.fichier);
    const token = await getValidAccessToken();
    const r = await fetch(DPS_OCR_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'classer', fichier_base64: base64, type_mime: mime }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || `lecture impossible (${r.status})`);
    const c = dpsClient();
    const titulaire = dpsNorm(d.titulaire);
    const nomC = c ? dpsNorm(c.nom).split(' ').filter(m => m.length >= 3) : [];
    d.correspond = titulaire ? (nomC.length ? nomC.every(m => titulaire.includes(m)) : null) : null;
    window._dps.lectures[k] = d;
    // Ce que la lecture a trouvé devient le type proposé, et la pièce du client se coche seule.
    if (d.correspond) window._dps.choix[k] = { type: dpsTypeDepuisLecture(d.type) };
  } catch (e) {
    window._dps.lectures[k] = { erreur: String(e.message || e).slice(0, 80) };
  }
  dpsPeindre();
}

// ── Ajouter à la fiche ─────────────────────────────────────────────────────────────────────────
async function dpsAjouter() {
  const S = window._dps;
  const cles = Object.keys(S.choix);
  if (!cles.length || typeof dcxDeposerUnFichier !== 'function') return;
  const b = document.getElementById('dps-ajouter');
  if (b) { b.disabled = true; b.textContent = 'Ajout…'; }
  const c = dpsClient();
  const nomClient = c ? ((typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : '';
  let ok = 0; const echecs = [];
  for (const k of cles) {
    const x = dpsTrouver(k);
    if (!x) continue;
    const r = await dcxDeposerUnFichier(x.fichier);
    if (!r.ok) { echecs.push(`${r.nom} (${r.erreur})`); continue; }
    const type = S.choix[k].type || 'autre';
    const lu = S.lectures[k];
    const maj = { client_id: S.clientId, type, titre: `${DPS_TYPES[type] ? DPS_TYPES[type].label : 'Document'}${nomClient ? ' — ' + nomClient : ''}` };
    if (lu && lu.valable_jusqu && /^\d{4}-\d{2}-\d{2}$/.test(lu.valable_jusqu)) maj.note = `Valable jusqu’au ${fmtDate(lu.valable_jusqu)}`;
    if (r.id) await dbPatch('documents_compagnies', r.id, maj);
    ok++;
  }
  S.choix = {};
  document.getElementById('modal-dps')?.remove();
  showError(echecs.length ? `${ok} pièce(s) ajoutée(s), ${echecs.length} échec(s) : ${echecs.join(', ')}` : `✓ ${ok} pièce${ok > 1 ? 's' : ''} ajoutée${ok > 1 ? 's' : ''} à la fiche.`);
  if (typeof dcxCharger === 'function') await dcxCharger();
  if (typeof showClient === 'function') showClient(S.clientId);
}

// ── Le bouton, dans l'onglet Documents de la fiche ─────────────────────────────────────────────
(function dpsBrancher() {
  if (typeof dcxOngletDocuments !== 'function') return;
  const origine = dcxOngletDocuments;
  window.dcxOngletDocuments = function (c) {
    const html = origine.apply(this, arguments);
    const repere = `<button type="button" class="btn-secondary" onclick="dcxParcourir('${c.id}')">`;
    const i = html.indexOf(repere);
    const bouton = `<button type="button" class="btn-save dps-bouton" onclick="dpsOuvrir('${c.id}')">🔎 Chercher dans le dossier de dépôt</button>`;
    if (i >= 0) return html.slice(0, i) + `<span class="dps-boutons">${bouton}` + html.slice(i).replace('</button>', '</button></span>');
    // 25.09.2026 — « il m'a semblé tomber sur un bouton tout à l'heure, je le retrouve plus ».
    // On se greffait sur le libellé exact du bouton « Déposer un document » de js/59 : le jour où
    // ce libellé change, le nôtre disparaissait sans un mot. On se rabat donc sur la fin de
    // l'en-tête de la carte, et on laisse une trace si même ça échoue.
    const tete = html.indexOf('</header>');
    if (tete >= 0) return html.slice(0, tete) + `<span class="dps-boutons">${bouton}</span>` + html.slice(tete);
    console.warn('[dps] Bouton « Chercher dans le dossier de dépôt » non greffé : aucun point d’accroche dans l’onglet Documents.');
    return html;
  };
})();

(function dpsStyles() {
  if (document.getElementById('dps-styles')) return;
  const s = document.createElement('style');
  s.id = 'dps-styles';
  s.textContent = `
    .dps-boutons { display: inline-flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .opx-modale.dps-modale, .mdx-modale.dps-modale { width: min(900px, 96vw) !important; max-width: min(900px, 96vw) !important; }
    .dps-dossier { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
      padding: 10px 12px; border-radius: 10px; background: var(--surface-alt); font-size: var(--t-s); margin-bottom: 10px; }
    .dps-dossier-actions { display: inline-flex; gap: 6px; }
    .dps-filtres { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .dps-filtre { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 999px;
      padding: 4px 12px; font: inherit; font-size: 12.5px; cursor: pointer; }
    .dps-filtre.on { background: var(--accent); border-color: var(--accent); color: #fff; }
    .dps-texte { margin-bottom: 8px; }
    .dps-liste { max-height: 52vh; overflow: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 2px; }
    .dps-vide { padding: 22px; text-align: center; color: var(--text-muted); font-size: var(--t-s); }
    .dps-ligne { display: grid; grid-template-columns: auto 52px minmax(0, 1fr) 170px auto; gap: 10px; align-items: center;
      padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); }
    .dps-ligne.choisie { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
    .dps-case input { width: 18px; height: 18px; }
    .dps-vignette { width: 52px; height: 52px; border-radius: 8px; background: var(--surface-alt) center/cover no-repeat;
      display: inline-flex; align-items: center; justify-content: center; font-size: 22px; }
    .dps-corps { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .dps-corps b { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dps-corps small { font-size: 11.5px; color: var(--text-muted); }
    .dps-badges { display: flex; flex-wrap: wrap; gap: 4px; }
    .dps-badge { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: var(--surface-alt); color: var(--text-muted); }
    .dps-badge.ok { background: color-mix(in srgb, #10B981 16%, transparent); color: var(--c-succes-texte, #047857); }
    .dps-badge.ko { background: color-mix(in srgb, #EF4444 14%, transparent); color: var(--c-danger-texte, #B91C1C); }
    .dps-type { font-size: 12.5px; padding: 6px 8px; }
    .dps-actions { display: inline-flex; gap: 4px; }
    .dps-mini { border: 1px solid var(--border); background: var(--surface-alt); border-radius: 8px; padding: 5px 9px;
      font: inherit; font-size: 12px; cursor: pointer; color: var(--text); }
    .dps-mini:disabled { opacity: .6; cursor: default; }
    @media (max-width: 700px) {
      .dps-ligne { grid-template-columns: auto 44px minmax(0, 1fr); }
      .dps-type, .dps-actions { grid-column: 2 / -1; }
    }`;
  document.head.appendChild(s);
})();
