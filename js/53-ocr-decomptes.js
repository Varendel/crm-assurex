// ═══ LECTURE DES DÉCOMPTES SCANNÉS (20.09.2026) ═════════════════════════════════════════════════
// La plupart des décomptes de commissions arrivent en scan : aucun texte à extraire, et le
// rapprochement se fait à la main — c'est le plus gros puits de temps du cabinet, et la raison
// pour laquelle 35 contrats n'ont toujours pas de numéro de police.
// Ici : on envoie le document à la fonction Supabase « ocr-decompte », on affiche les lignes lues,
// et surtout on les RAPPROCHE des contrats existants — par numéro de police, sinon par nom de
// client. Rien n'est écrit sans validation ligne par ligne.

const OCR_FONCTION_URL = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/ocr-decompte';

let _ocr = { fichier: null, resultat: null, etat: '', lignes: [] };

function ocrEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ocrClePolice(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function ocrNormNom(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Rapprochement d'une ligne lue avec le portefeuille ──────────────────────────────────────────
// 1. numéro de police identique (à la ponctuation près) → contrat sûr
// 2. sinon, nom du client reconnu → on propose de compléter le numéro de police manquant
function ocrRapprocher(ligne) {
  const contrats = typeof allContrats !== 'undefined' ? allContrats : [];
  const clients = typeof allClients !== 'undefined' ? allClients : [];
  const cle = ocrClePolice(ligne.numero_police);
  if (cle.length >= 4) {
    const exact = contrats.find(ct => ocrClePolice(ct.numero_police) === cle);
    if (exact) return { statut: 'contrat', contrat: exact, client: clients.find(c => c.id === exact.client_id) || null };
  }
  const nom = ocrNormNom(ligne.client_nom);
  if (nom.length >= 4) {
    const mots = nom.split(' ').filter(m => m.length >= 3);
    const clientsTrouves = clients.filter(c => {
      const complet = ocrNormNom(`${c.prenom || ''} ${c.nom || ''}`);
      return complet && mots.every(m => complet.includes(m));
    });
    if (clientsTrouves.length === 1) {
      const client = clientsTrouves[0];
      const sansPolice = contrats.filter(ct => ct.client_id === client.id && !ct.numero_police);
      return { statut: cle.length >= 4 && sansPolice.length ? 'police_a_completer' : 'client', client, candidats: sansPolice };
    }
    if (clientsTrouves.length > 1) return { statut: 'ambigu', clients: clientsTrouves };
  }
  return { statut: 'inconnu' };
}

async function ocrDiagnostic() {
  const zone = document.getElementById('ocr-etat');
  if (zone) zone.textContent = 'Vérification…';
  try {
    const token = await getValidAccessToken();
    const r = await fetch(OCR_FONCTION_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'diagnostic' }),
    });
    const d = await r.json();
    if (zone) zone.textContent = d.message || d.error || 'Réponse inattendue';
    if (zone) zone.className = 'ocr-etat ' + (d.fournisseur_actif ? 'ok' : 'alerte');
  } catch (e) {
    if (zone) { zone.textContent = 'Impossible de joindre la fonction : ' + e.message; zone.className = 'ocr-etat alerte'; }
  }
}

async function ocrLireFichier(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 18 * 1024 * 1024) { showError('Document trop lourd — maximum 18 Mo.'); input.value = ''; return; }
  _ocr = { fichier: { nom: file.name, taille: file.size }, resultat: null, etat: 'lecture', lignes: [] };
  navigate('ocr-decomptes', { silent: true });
  try {
    const base64 = await new Promise((ok, ko) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result).split(',')[1]);
      fr.onerror = ko;
      fr.readAsDataURL(file);
    });
    const token = await getValidAccessToken();
    const r = await fetch(OCR_FONCTION_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lire', fichier_base64: base64, type_mime: file.type || 'application/pdf' }),
    });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error || `Erreur ${r.status}`);
    _ocr.resultat = d;
    _ocr.lignes = (d.lignes || []).map((l, i) => ({ ...l, _i: i, _rap: ocrRapprocher(l) }));
    _ocr.etat = 'lu';
  } catch (e) {
    _ocr.etat = 'erreur';
    _ocr.erreur = e.message;
  }
  input.value = '';
  navigate('ocr-decomptes', { silent: true });
}

function viewOcrDecomptes() {
  const r = _ocr.resultat;
  const parStatut = { contrat: 0, police_a_completer: 0, client: 0, ambigu: 0, inconnu: 0 };
  _ocr.lignes.forEach(l => { parStatut[l._rap.statut] = (parStatut[l._rap.statut] || 0) + 1; });
  return `<div class="ocr">
    <header class="dx-tete"><div><div class="dx-surtitre">Commissions · documents scannés</div><h2>Lecture des décomptes</h2>
      <p class="dx-sous">Déposez un décompte — même photographié ou scanné. Les lignes sont lues, puis rapprochées de vos contrats : numéro de police d’abord, nom du client ensuite.</p></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-secondary" onclick="ocrDiagnostic()">🔌 Tester la lecture</button>
        <label class="btn-save ocr-depot">📄 Choisir un décompte
          <input type="file" accept="application/pdf,image/*" hidden onchange="ocrLireFichier(this)"/></label>
      </div></header>

    <div id="ocr-etat" class="ocr-etat"></div>

    ${_ocr.etat === 'lecture' ? '<section class="dbx-carte"><div class="loader">Lecture du document…</div></section>' : ''}
    ${_ocr.etat === 'erreur' ? `<section class="dbx-carte"><div class="ocr-etat alerte">Échec de la lecture : ${ocrEsc(_ocr.erreur || '')}</div>
      <p class="dx-sous">Si le message parle de clé manquante, ajoutez <code>ANTHROPIC_API_KEY</code> dans Supabase → Edge Functions → Secrets, puis réessayez.</p></section>` : ''}

    ${r ? `<section class="dbx-carte ocr-resume">
        <div class="ocr-resume-tete">
          <div><b>${ocrEsc(r.compagnie || 'Compagnie non identifiée')}</b>
            <small>${ocrEsc(_ocr.fichier ? _ocr.fichier.nom : '')}${r.periode ? ' · période ' + ocrEsc(r.periode) : ''}${r.reference ? ' · réf. ' + ocrEsc(r.reference) : ''}</small></div>
          <div class="ocr-confiance ${ocrEsc(r.confiance)}">confiance ${ocrEsc(r.confiance || '—')}</div>
        </div>
        <div class="ocr-compteurs">
          <span class="ok">${parStatut.contrat} contrat(s) reconnu(s)</span>
          <span class="attention">${parStatut.police_a_completer} police(s) à compléter</span>
          <span>${parStatut.client} client(s) sans contrat certain</span>
          <span>${parStatut.ambigu + parStatut.inconnu} ligne(s) à traiter à la main</span>
          ${r.total_credit != null ? `<span class="total">Total lu : CHF ${fmtCHF(r.total_credit)}</span>` : ''}
        </div>
        ${r.remarques ? `<p class="ocr-remarques">⚠️ ${ocrEsc(r.remarques)}</p>` : ''}
        <div class="ocr-actions-globales">
          <button type="button" class="btn-secondary" onclick="ocrVersBordereau()">➡️ Reprendre dans un bordereau</button>
        </div>
      </section>

      <section class="dbx-carte">
        <div class="ocr-lignes">${_ocr.lignes.map(ocrLigneHtml).join('') || '<div class="dbx-vide-petit">Aucune ligne lue.</div>'}</div>
      </section>` : ''}
  </div>`;
}

function ocrLigneHtml(l) {
  const rap = l._rap || {};
  const montant = Number(l.credit || 0) - Number(l.debit || 0);
  const nomClient = rap.client ? ((typeof estEntreprise === 'function' && estEntreprise(rap.client)) ? rap.client.nom : `${rap.client.prenom || ''} ${rap.client.nom || ''}`.trim()) : '';
  const etats = {
    contrat: `<span class="ocr-badge ok">Contrat reconnu</span>`,
    police_a_completer: `<span class="ocr-badge attention">N° de police à compléter</span>`,
    client: `<span class="ocr-badge">Client reconnu</span>`,
    ambigu: `<span class="ocr-badge">Plusieurs clients possibles</span>`,
    inconnu: `<span class="ocr-badge alerte">Non rapproché</span>`,
  };
  return `<div class="ocr-ligne ${rap.statut}">
    <div class="ocr-l-principal">
      <b>${ocrEsc(l.client_nom || '—')}</b>
      <small>${ocrEsc(l.produit || '')}${l.numero_police ? ' · police ' + ocrEsc(l.numero_police) : ' · sans n° de police'}${l.date ? ' · ' + ocrEsc(l.date) : ''}</small>
      ${rap.statut === 'contrat' ? `<small class="ocr-l-lien">→ ${ocrEsc(rap.contrat.produit || 'contrat')} ${ocrEsc(rap.contrat.compagnie || '')} · ${ocrEsc(nomClient)}</small>` : ''}
      ${rap.statut === 'police_a_completer' ? `<small class="ocr-l-lien">→ ${ocrEsc(nomClient)} : ${rap.candidats.length} contrat(s) sans numéro</small>` : ''}
      ${rap.statut === 'client' ? `<small class="ocr-l-lien">→ ${ocrEsc(nomClient)}</small>` : ''}
    </div>
    <div class="ocr-l-montant">${montant ? (montant < 0 ? '−' : '') + 'CHF ' + fmtCHF(Math.abs(montant)) : '—'}
      <small>${ocrEsc(l.type_mouvement || '')}${l.taux ? ' · ' + l.taux + ' %' : ''}</small></div>
    <div class="ocr-l-etat">${etats[rap.statut] || ''}</div>
    <div class="ocr-l-actions">
      ${rap.statut === 'contrat' ? `<button type="button" onclick="showClient('${rap.contrat.client_id}')">Ouvrir la fiche</button>` : ''}
      ${rap.statut === 'police_a_completer' ? rap.candidats.map(ct => `<button type="button" class="ocr-appliquer" onclick="ocrAppliquerPolice('${ct.id}', ${l._i})">Attribuer à « ${ocrEsc((ct.produit || 'contrat').slice(0, 28))} »</button>`).join('') : ''}
      ${rap.statut === 'client' ? `<button type="button" onclick="showClient('${rap.client.id}')">Ouvrir la fiche</button>` : ''}
      ${rap.statut === 'ambigu' ? rap.clients.slice(0, 3).map(c => `<button type="button" onclick="showClient('${c.id}')">${ocrEsc(`${c.prenom || ''} ${c.nom || ''}`.trim())}</button>`).join('') : ''}
    </div>
  </div>`;
}

// Complète le numéro de police d'un contrat à partir de la ligne lue — la correction la plus
// fréquente, et celle qui débloque le rapprochement des commissions suivantes.
async function ocrAppliquerPolice(contratId, indexLigne) {
  const ligne = _ocr.lignes.find(l => l._i === indexLigne);
  const ct = (typeof allContrats !== 'undefined' ? allContrats : []).find(x => x.id === contratId);
  if (!ligne || !ct) return;
  const numero = String(ligne.numero_police || '').trim();
  if (!numero) { showError('Cette ligne n’a pas de numéro de police lisible.'); return; }
  if (!confirm(`Attribuer le n° de police « ${numero} » au contrat « ${ct.produit || ''} » (${ct.compagnie || ''}) ?`)) return;
  const r = await dbPatch('contrats', contratId, { numero_police: numero });
  if (r && r.error) { showError('Enregistrement impossible : ' + (typeof errMsg === 'function' ? errMsg(r) : '')); return; }
  ct.numero_police = numero;
  if (typeof logAction === 'function') logAction('edit_contrat', 'contrats', contratId, `n° de police depuis un décompte : ${numero}`);
  _ocr.lignes = _ocr.lignes.map(l => ({ ...l, _rap: ocrRapprocher(l) }));
  showError('✓ Numéro de police enregistré.');
  navigate('ocr-decomptes', { silent: true });
}

// Reprend les lignes lues dans le formulaire de bordereau existant (js/09)
function ocrVersBordereau() {
  const r = _ocr.resultat;
  if (!r) return;
  window._bordereauLignesExtraites = (r.lignes || []).map(l => ({
    client_nom: l.client_nom, produit: l.produit, type_mouvement: l.type_mouvement,
    credit: l.credit, debit: l.debit, numero_police: l.numero_police,
  }));
  window._ocrVersBordereau = { compagnie: r.compagnie || '', mois: r.periode || '', montant: r.total_credit || '' };
  navigate('nouveau-bordereau');
  setTimeout(() => {
    const c = document.getElementById('b-compagnie'); if (c && r.compagnie) c.value = r.compagnie;
    const m = document.getElementById('b-mois'); if (m && r.periode) m.value = r.periode;
    const t = document.getElementById('b-montant'); if (t && r.total_credit) t.value = r.total_credit;
    showError(`${(r.lignes || []).length} ligne(s) reprises — vérifie avant d’enregistrer.`);
  }, 250);
}
