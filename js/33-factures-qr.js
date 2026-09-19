// ═══ FACTURES QR SUISSES (19.09.2026) ═══════════════════════════════════════════════════════
// Générateur de QR-factures conformes aux Swiss Payment Standards (IG QR-bill 2.2 / 2.3, SIX) :
//   - liste des factures (table factures) avec indicateurs émis / encaissé / en attente / en retard,
//     filtre par statut, actions ouvrir · dupliquer · marquer payée · annuler · imprimer / PDF ;
//   - éditeur : client du CRM ou débiteur libre, lignes avec total en direct, échéance, message,
//     référence QRR (QR-IBAN) ou SCOR « RF » (IBAN normal) ou sans référence, numéro automatique
//     (préfixe-année-compteur), aperçu A4 en direct avec la section paiement ;
//   - paramètres du créancier (table parametres_societe, clé 'facturation') : nom, adresse
//     structurée, IBAN, QR-IBAN optionnel — rien n'est en dur dans le code ;
//   - impression : document A4 autonome, section paiement 210 × 105 mm en bas de page
//     (récépissé 62 mm + section paiement 148 mm), QR 46 × 46 mm avec la croix suisse.
// Rien n'est jamais supprimé : une facture s'annule (statut 'annulee').
// Compatibilité : les anciennes factures créées depuis la fiche client (js/08 : statut 'envoyee',
// champ objet, sans lignes ni débiteur) sont lues comme des factures émises à une ligne.
// Contrôle rapide dans la console : fqrAutotest().

window._fqr = window._fqr || { factures: [], charge: false, params: null, filtre: 'toutes', recherche: '', ed: null, numeroPrevu: '' };
const FQR_QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
const FQR_STATUTS = {
  brouillon: ['Brouillon', 'brouillon'],
  emise: ['Émise', 'emise'],
  retard: ['En retard', 'retard'],
  payee: ['Payée', 'payee'],
  annulee: ['Annulée', 'annulee'],
};
const FQR_FILTRES = [['toutes', 'Toutes'], ['brouillon', 'Brouillons'], ['emise', 'À encaisser'], ['retard', 'En retard'], ['payee', 'Payées'], ['annulee', 'Annulées']];

function fqrEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function fqrIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fqrAjouterJours(iso, n) { const d = new Date((iso || fqrIso(new Date())) + 'T00:00:00'); d.setDate(d.getDate() + n); return fqrIso(d); }
function fqrDateCH(iso) { if (!iso) return '—'; const p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso; }
function fqrArrondi(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function fqrNombre(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = typeof nombreCH === 'function' ? nombreCH(v) : parseFloat(String(v ?? '').replace(/['’\s]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function fqrCompact(s) { return String(s ?? '').replace(/\s+/g, '').toUpperCase(); }

// ── Normes : IBAN, QRR, SCOR ────────────────────────────────────────────────────────────────
// Reste modulo 97 d'une chaîne alphanumérique (A = 10 … Z = 35), calculé chiffre par chiffre
// pour ne jamais dépasser la précision des nombres JavaScript.
function fqrMod97(chaine) {
  let reste = 0;
  for (const ch of String(chaine)) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) reste = (reste * 10 + Number(d)) % 97;
  }
  return reste;
}

// IBAN suisse ou liechtensteinois : 21 caractères, CHkk + IID 5 chiffres + 12 alphanumériques
function fqrIbanValide(iban) {
  const s = fqrCompact(iban);
  if (!/^(CH|LI)\d{2}\d{5}[0-9A-Z]{12}$/.test(s)) return false;
  return fqrMod97(s.slice(4) + s.slice(0, 4)) === 1;
}
// QR-IBAN : IID (positions 5 à 9) entre 30000 et 31999
function fqrEstQrIban(iban) {
  const s = fqrCompact(iban);
  const iid = Number(s.slice(4, 9));
  return /^(CH|LI)/.test(s) && iid >= 30000 && iid <= 31999;
}
function fqrIbanErreur(iban, { qr = false } = {}) {
  const s = fqrCompact(iban);
  if (!s) return '';
  if (!/^(CH|LI)/.test(s)) return 'L’IBAN doit commencer par CH ou LI.';
  if (s.length !== 21) return `L’IBAN doit compter 21 caractères (ici ${s.length}).`;
  if (!fqrIbanValide(s)) return 'IBAN invalide (chiffres de contrôle incorrects).';
  if (qr && !fqrEstQrIban(s)) return 'Ce n’est pas un QR-IBAN (IID entre 30000 et 31999 attendu).';
  if (!qr && fqrEstQrIban(s)) return 'Cet IBAN est un QR-IBAN : indique-le dans le champ « QR-IBAN ».';
  return '';
}

// Référence QR (QRR) : 26 chiffres + chiffre de contrôle modulo 10 récursif
const FQR_TABLE_MOD10 = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
function fqrCleMod10(chiffres) {
  let report = 0;
  for (const c of String(chiffres)) report = FQR_TABLE_MOD10[(report + Number(c)) % 10];
  return String((10 - report) % 10);
}
function fqrQrrCreer(base) {
  const b = String(base ?? '').replace(/\D/g, '').slice(-26).padStart(26, '0');
  return b + fqrCleMod10(b);
}
function fqrQrrValide(ref) {
  const s = fqrCompact(ref);
  return /^\d{27}$/.test(s) && !/^0+$/.test(s) && fqrCleMod10(s.slice(0, 26)) === s[26];
}

// Référence créancier ISO 11649 (SCOR) : « RF » + 2 chiffres de contrôle (modulo 97) + 1 à 21 caractères
function fqrRfCreer(base) {
  const b = fqrCompact(base).replace(/[^0-9A-Z]/g, '').slice(-21) || '0';
  const cle = 98 - fqrMod97(b + 'RF00');
  return 'RF' + String(cle).padStart(2, '0') + b;
}
function fqrRfValide(ref) {
  const s = fqrCompact(ref);
  return /^RF\d{2}[0-9A-Z]{1,21}$/.test(s) && fqrMod97(s.slice(4) + s.slice(0, 4)) === 1;
}
function fqrTypeReference(ref) {
  const s = fqrCompact(ref);
  if (!s) return 'NON';
  return /^RF/.test(s) ? 'SCOR' : 'QRR';
}

// ── Mise en forme SIX ───────────────────────────────────────────────────────────────────────
// Montant « 1 234.50 » : espace des milliers, point décimal, toujours 2 décimales
function fqrFmtMontant(n) {
  const [e, d] = Math.abs(fqrArrondi(n)).toFixed(2).split('.');
  return (Number(n) < 0 ? '-' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + d;
}
function fqrFmtIban(iban) { return (fqrCompact(iban).match(/.{1,4}/g) || []).join(' '); }
// QRR groupée 2 + 5 × 5 ; SCOR groupée par 4
function fqrFmtReference(ref) {
  const s = fqrCompact(ref);
  if (!s) return '';
  if (fqrTypeReference(s) === 'QRR') return s.slice(0, 2) + ' ' + (s.slice(2).match(/.{1,5}/g) || []).join(' ');
  return (s.match(/.{1,4}/g) || []).join(' ');
}

// Jeu de caractères autorisé dans le QR (latin étendu SPS) : le reste est remplacé
function fqrTexte(v, max) {
  let s = String(v ?? '').normalize('NFC')
    .replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"').replace(/[–—−]/g, '-').replace(/[  ]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/[^ -~¡-ÿŒœŠšŸŽžȘ-ț€]/g, '.');
  return max ? s.slice(0, max).trim() : s;
}

// ── Contenu du QR (payload SPC) ─────────────────────────────────────────────────────────────
// Adresse structurée « S » : type, nom, rue, n°, NPA, localité, pays — 7 lignes vides si absente
function fqrAdresseS(a) {
  if (!a || !fqrTexte(a.nom)) return ['', '', '', '', '', '', ''];
  return ['S', fqrTexte(a.nom, 70), fqrTexte(a.rue, 70), fqrTexte(a.numero, 16), fqrTexte(a.npa, 16), fqrTexte(a.ville, 35), (fqrTexte(a.pays, 2) || 'CH').toUpperCase()];
}

function fqrPayload({ iban, creancier, montant, devise, debiteur, reference, message }) {
  const ref = fqrCompact(reference);
  const type = fqrTypeReference(ref);
  const m = montant === null || montant === undefined || montant === '' ? '' : fqrArrondi(montant).toFixed(2);
  return [
    'SPC', '0200', '1',                 // en-tête : type, version 2.0, codage UTF-8
    fqrCompact(iban),                   // compte (IBAN ou QR-IBAN)
    ...fqrAdresseS(creancier),          // créancier
    '', '', '', '', '', '', '',         // créancier final : réservé, toujours vide
    m, devise === 'EUR' ? 'EUR' : 'CHF', // montant, monnaie
    ...fqrAdresseS(debiteur),           // débiteur final
    type, type === 'NON' ? '' : ref,    // type de référence, référence
    fqrTexte(message, 140),             // communication non structurée
    'EPD',                              // fin des données de paiement — rien après
  ].join('\n');
}

// IBAN à utiliser pour un type de référence (QRR → QR-IBAN, sinon IBAN normal)
function fqrIbanPour(type, P) {
  P = P || {};
  return type === 'QRR' ? fqrCompact(P.qr_iban) : fqrCompact(P.iban);
}

// Erreurs bloquantes pour produire un QR valable (liste vide = conforme)
function fqrErreursFacture(f, P) {
  const e = [];
  P = P || {};
  if (!fqrTexte(P.nom) || !fqrTexte(P.npa) || !fqrTexte(P.ville)) e.push('Créancier incomplet (nom, NPA, localité) — ouvre les paramètres.');
  const type = fqrTypeReference(f.reference);
  const iban = fqrIbanPour(type, P);
  if (!iban) e.push(type === 'QRR' ? 'Aucun QR-IBAN configuré pour une référence QRR.' : 'Aucun IBAN configuré.');
  else if (!fqrIbanValide(iban)) e.push('IBAN du créancier invalide.');
  else if (type === 'QRR' && !fqrEstQrIban(iban)) e.push('Une référence QRR exige un QR-IBAN.');
  else if (type !== 'QRR' && fqrEstQrIban(iban)) e.push('Un QR-IBAN exige une référence QRR.');
  if (type === 'QRR' && !fqrQrrValide(f.reference)) e.push('Référence QRR invalide.');
  if (type === 'SCOR' && !fqrRfValide(f.reference)) e.push('Référence créancier RF invalide.');
  const m = fqrArrondi(f.montant);
  if (!(m >= 0.01 && m <= 999999999.99)) e.push('Le montant doit être compris entre 0.01 et 999 999 999.99.');
  if (!['CHF', 'EUR'].includes(f.devise || 'CHF')) e.push('Monnaie : CHF ou EUR uniquement.');
  const d = f.debiteur || {};
  if (fqrTexte(d.nom) && (!fqrTexte(d.npa) || !fqrTexte(d.ville))) e.push('Adresse du débiteur incomplète (NPA et localité obligatoires).');
  if (fqrTexte(d.nom) && !/^[A-Z]{2}$/.test(fqrTexte(d.pays || 'CH').toUpperCase())) e.push('Pays du débiteur : code à 2 lettres (CH, FR…).');
  if (fqrTexte(f.message).length > 140) e.push('Message limité à 140 caractères.');
  return e;
}

// ── Code QR (bibliothèque chargée à la demande) et SVG avec la croix suisse ────────────────────
let _fqrLibPromesse = null;
function fqrChargerQrLib() {
  if (typeof qrcode === 'function') return Promise.resolve(true);
  if (_fqrLibPromesse) return _fqrLibPromesse;
  _fqrLibPromesse = new Promise(resoudre => {
    const s = document.createElement('script');
    s.src = FQR_QR_LIB;
    s.async = true;
    s.onload = () => resoudre(typeof qrcode === 'function');
    s.onerror = () => { _fqrLibPromesse = null; resoudre(false); };
    document.head.appendChild(s);
  });
  return _fqrLibPromesse;
}

// Matrice du QR : niveau M, octets UTF-8 (le texte est converti en octets puis passé tel quel
// en mode « Byte » — indépendant de la fonction de conversion par défaut de la bibliothèque)
function fqrQrMatrice(payload) {
  if (typeof qrcode !== 'function') return null;
  const octets = new TextEncoder().encode(payload);
  let binaire = '';
  octets.forEach(o => { binaire += String.fromCharCode(o); });
  const qr = qrcode(0, 'M');
  qr.addData(binaire, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return { n, version: (n - 17) / 4, sombre: (l, c) => qr.isDark(l, c) };
}

// SVG 46 × 46 mm (sans zone de protection) avec la croix suisse 7 × 7 mm au centre
function fqrQrSvg(payload) {
  const M = fqrQrMatrice(payload);
  if (!M) return '';
  const n = M.n;
  let d = '';
  for (let l = 0; l < n; l++) {
    let c = 0;
    while (c < n) {
      if (M.sombre(l, c)) { let c2 = c; while (c2 < n && M.sombre(l, c2)) c2++; d += `M${c} ${l}h${c2 - c}v1h-${c2 - c}z`; c = c2; }
      else c++;
    }
  }
  const k = 46 / n;
  // Croix suisse : carré blanc 7 mm, carré noir 6 mm, croix blanche (bras 1.2 × 3.9 mm)
  const b = 1.2, L = 3.9, ctr = 23;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="46mm" height="46mm" viewBox="0 0 46 46" shape-rendering="crispEdges" role="img" aria-label="Code QR de paiement suisse">
    <rect width="46" height="46" fill="#fff"/>
    <path d="${d}" transform="scale(${k})" fill="#000"/>
    <rect x="${ctr - 3.5}" y="${ctr - 3.5}" width="7" height="7" fill="#fff"/>
    <rect x="${ctr - 3}" y="${ctr - 3}" width="6" height="6" fill="#000"/>
    <rect x="${ctr - b / 2}" y="${ctr - L / 2}" width="${b}" height="${L}" fill="#fff"/>
    <rect x="${ctr - L / 2}" y="${ctr - b / 2}" width="${L}" height="${b}" fill="#fff"/>
  </svg>`;
}

// ── Données ─────────────────────────────────────────────────────────────────────────────────
function fqrParamsOk(P) {
  P = P || _fqr.params || {};
  return !!(fqrTexte(P.nom) && fqrTexte(P.npa) && fqrTexte(P.ville) && ((P.iban && fqrIbanValide(P.iban)) || (P.qr_iban && fqrIbanValide(P.qr_iban))));
}

function fqrNomClient(c) {
  if (!c) return '';
  if (typeof estEntreprise === 'function' && estEntreprise(c)) return (c.nom || '').trim();
  return [c.prenom, c.nom].filter(Boolean).join(' ').trim();
}

// « Rue du Lac 12b » → { rue, numero } ; accepte aussi « 12 rue du Lac » et « …, 1000 Ville »
function fqrDecouperRue(adresse) {
  const s = String(adresse || '').split(/\n|,/)[0].trim();
  let m = s.match(/^(.*?\D)\s*(\d+\s?[a-zA-Z]?(?:\s?[-/]\s?\d+[a-zA-Z]?)?)$/);
  if (m) return { rue: m[1].trim(), numero: m[2].replace(/\s/g, '') };
  m = s.match(/^(\d+\s?[a-zA-Z]?)[,\s]+(.+)$/);
  if (m) return { rue: m[2].trim(), numero: m[1].replace(/\s/g, '') };
  return { rue: s, numero: '' };
}

function fqrDebiteurDepuisClient(c) {
  const r = fqrDecouperRue(c.adresse);
  return { nom: fqrNomClient(c), rue: r.rue, numero: r.numero, npa: String(c.npa || '').trim(), ville: String(c.ville || '').trim(), pays: 'CH' };
}

// Ligne de la base → facture normalisée (y compris les anciennes factures de js/08)
function fqrNormaliser(r) {
  const f = { ...r };
  if (f.statut === 'envoyee') f.statut = 'emise';
  if (!f.statut) f.statut = 'emise';
  f.devise = f.devise === 'EUR' ? 'EUR' : 'CHF';
  f.montant = fqrArrondi(f.montant);
  if (!Array.isArray(f.lignes) || !f.lignes.length) f.lignes = [{ libelle: f.objet || 'Prestation', quantite: 1, prix: f.montant }];
  if (!f.debiteur || typeof f.debiteur !== 'object') {
    const c = f.client_id && typeof allClients !== 'undefined' ? allClients.find(x => x.id === f.client_id) : null;
    f.debiteur = c ? fqrDebiteurDepuisClient(c) : { nom: '', rue: '', numero: '', npa: '', ville: '', pays: 'CH' };
  }
  return f;
}

function fqrStatut(f, auj) {
  auj = auj || fqrIso(new Date());
  if (f.statut === 'emise' && f.date_echeance && f.date_echeance < auj) return 'retard';
  return f.statut;
}

function fqrTotalLignes(lignes) {
  return fqrArrondi((lignes || []).reduce((s, l) => s + fqrArrondi(fqrNombre(l.quantite) * fqrNombre(l.prix)), 0));
}

// Prochain numéro : préfixe-année-compteur sur 4 chiffres (ex. F-2026-0007)
function fqrPrefixe(P) { return (fqrTexte((P || _fqr.params || {}).prefixe_numero) || 'F').replace(/[^0-9A-Za-z]/g, '').toUpperCase() || 'F'; }
function fqrProchainNumeroLocal(numeros, P, date) {
  const pref = fqrPrefixe(P);
  const annee = (date || fqrIso(new Date())).slice(0, 4);
  const re = new RegExp(`^${pref}-${annee}-(\\d+)$`);
  const max = (numeros || []).reduce((m, n) => { const x = String(n || '').match(re); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return `${pref}-${annee}-${String(max + 1).padStart(4, '0')}`;
}
async function fqrProchainNumero(date) {
  const pref = fqrPrefixe();
  const annee = (date || fqrIso(new Date())).slice(0, 4);
  const r = await dbGet('factures', `select=numero&numero=like.${encodeURIComponent(`${pref}-${annee}-`)}*`);
  const numeros = [...(Array.isArray(r) ? r.map(x => x.numero) : []), ..._fqr.factures.map(x => x.numero)];
  return fqrProchainNumeroLocal(numeros, null, date);
}

function fqrCalculerReference(type, numero) {
  if (type === 'QRR') return fqrQrrCreer(String(numero || '').replace(/\D/g, '') || '1');
  if (type === 'SCOR') return fqrRfCreer(numero || '1');
  return '';
}
function fqrTypeParDefaut(P) {
  P = P || _fqr.params || {};
  if (P.qr_iban && fqrIbanValide(P.qr_iban) && fqrEstQrIban(P.qr_iban)) return 'QRR';
  if (P.iban && fqrIbanValide(P.iban)) return 'SCOR';
  return 'NON';
}

// ── Page ────────────────────────────────────────────────────────────────────────────────────
function viewFacturesQR() {
  setTimeout(fqrCharger, 0);
  fqrChargerQrLib(); // préchargé : l'impression reste immédiate (fenêtre pop-up autorisée)
  return `<div class="dbx fqr">
    <header class="dx-tete">
      <div><div class="dx-surtitre">Finances</div><h2>Factures QR</h2></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-secondary" onclick="fqrOuvrirParametres()">⚙️ Créancier & IBAN</button>
        <button type="button" class="btn-secondary" onclick="fqrExporterExcel()" title="Télécharger la liste au format Excel">⬇️ Excel</button>
        <button type="button" class="btn-save" onclick="fqrNouvelle()">+ Nouvelle facture</button>
      </div>
    </header>
    <div id="fqr-contenu"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
  </div>`;
}

async function fqrCharger() {
  const [rows, params] = await Promise.all([
    dbGet('factures', 'select=*&order=created_at.desc'),
    dbGet('parametres_societe', 'cle=eq.facturation&select=*'),
  ]);
  _fqr.factures = (Array.isArray(rows) ? rows : []).map(fqrNormaliser);
  _fqr.params = Array.isArray(params) && params[0] && params[0].valeur ? params[0].valeur : (_fqr.params || null);
  _fqr.charge = true;
  fqrRendre();
}

function fqrRendre() {
  const zone = document.getElementById('fqr-contenu');
  if (!zone) return;
  const auj = fqrIso(new Date());
  const annee = auj.slice(0, 4);
  const F = _fqr.factures;
  const chf = F.filter(f => f.devise !== 'EUR');
  const somme = l => l.reduce((s, f) => s + Number(f.montant || 0), 0);
  const emis = chf.filter(f => ['emise', 'payee'].includes(f.statut) && (f.date_emission || '').startsWith(annee));
  const encaisse = chf.filter(f => f.statut === 'payee' && (f.paye_le || f.date_emission || '').startsWith(annee));
  const attente = chf.filter(f => f.statut === 'emise');
  const retard = attente.filter(f => fqrStatut(f, auj) === 'retard');
  const nbEur = F.filter(f => f.devise === 'EUR' && f.statut !== 'annulee').length;
  const pl = (n, s) => `${n} facture${n > 1 ? 's' : ''}${s || ''}`;

  const compte = id => id === 'toutes' ? F.length : id === 'emise' ? F.filter(f => f.statut === 'emise').length : F.filter(f => fqrStatut(f, auj) === id).length;
  const q = _fqr.recherche.trim().toLowerCase();
  const liste = F.filter(f => {
    const s = fqrStatut(f, auj);
    if (_fqr.filtre === 'emise' && f.statut !== 'emise') return false;
    if (!['toutes', 'emise'].includes(_fqr.filtre) && s !== _fqr.filtre) return false;
    if (q && !`${f.numero} ${f.debiteur?.nom || ''} ${(f.lignes || []).map(l => l.libelle).join(' ')} ${f.montant}`.toLowerCase().includes(q)) return false;
    return true;
  });

  zone.innerHTML = `
    ${fqrParamsOk() ? '' : `<div class="fqr-bandeau">
      <span class="fqr-bandeau-icone">🏦</span>
      <span><b>Configure le créancier avant d’émettre une facture QR.</b><small>Nom, adresse, IBAN (et QR-IBAN si ta banque t’en a attribué un) : ils figurent sur chaque section de paiement.</small></span>
      <button type="button" class="btn-save" onclick="fqrOuvrirParametres()">Configurer</button>
    </div>`}
    <div class="dbx-kpis">
      ${dbxKpi({ label: `Émis en ${annee}`, valeur: somme(emis), prefixe: 'CHF ', sous: pl(emis.length), i: 0 })}
      ${dbxKpi({ label: `Encaissé en ${annee}`, valeur: somme(encaisse), prefixe: 'CHF ', sous: pl(encaisse.length, ' payée' + (encaisse.length > 1 ? 's' : '')), onclick: "_fqr.filtre='payee';fqrRendre()", i: 1 })}
      ${dbxKpi({ label: 'En attente', valeur: somme(attente), prefixe: 'CHF ', sous: pl(attente.length) + (nbEur ? ` · hors ${nbEur} en EUR` : ''), onclick: "_fqr.filtre='emise';fqrRendre()", i: 2 })}
      ${dbxKpi({ label: 'En retard', valeur: somme(retard), prefixe: 'CHF ', sous: retard.length ? pl(retard.length, ' échue' + (retard.length > 1 ? 's' : '')) : 'aucune échéance dépassée', onclick: "_fqr.filtre='retard';fqrRendre()", i: 3 })}
    </div>
    <div class="fqr-outils">
      <div class="dbx-onglets" role="tablist" aria-label="Filtrer par statut">
        ${FQR_FILTRES.map(([id, l]) => { const n = compte(id); return `<button type="button" role="tab" aria-selected="${_fqr.filtre === id}" class="${_fqr.filtre === id ? 'actif' : ''}" onclick="_fqr.filtre='${id}';fqrRendre()">${l}${n ? ` <span class="fqr-compte">${n}</span>` : ''}</button>`; }).join('')}
      </div>
      <label class="fqr-recherche"><span aria-hidden="true">🔎</span><input type="search" placeholder="Numéro, débiteur, libellé…" value="${fqrEsc(_fqr.recherche)}" oninput="_fqr.recherche=this.value;fqrRendreListe()" aria-label="Rechercher une facture"/></label>
    </div>
    <section class="dbx-carte fqr-carte-liste"><div id="fqr-liste">${fqrListeHtml(liste, auj)}</div></section>`;
}

// Rafraîchit la liste seule (la recherche garde le focus)
function fqrRendreListe() {
  const zone = document.getElementById('fqr-liste');
  if (!zone) return;
  const auj = fqrIso(new Date());
  const q = _fqr.recherche.trim().toLowerCase();
  const liste = _fqr.factures.filter(f => {
    const s = fqrStatut(f, auj);
    if (_fqr.filtre === 'emise' && f.statut !== 'emise') return false;
    if (!['toutes', 'emise'].includes(_fqr.filtre) && s !== _fqr.filtre) return false;
    return !q || `${f.numero} ${f.debiteur?.nom || ''} ${(f.lignes || []).map(l => l.libelle).join(' ')} ${f.montant}`.toLowerCase().includes(q);
  });
  zone.innerHTML = fqrListeHtml(liste, auj);
}

function fqrListeHtml(liste, auj) {
  if (!_fqr.factures.length) return `<div class="dbx-vide"><span style="font-size:26px">🧾</span>Aucune facture pour l’instant.<button type="button" class="btn-save" style="margin-top:12px" onclick="fqrNouvelle()">+ Créer la première facture</button></div>`;
  if (!liste.length) return '<div class="dbx-vide-petit">Aucune facture ne correspond à ce filtre.</div>';
  return `<div class="fqr-liste">${liste.map((f, i) => {
    const s = fqrStatut(f, auj);
    const [lib, cls] = FQR_STATUTS[s] || [s, 'emise'];
    const jours = s === 'retard' ? Math.round((new Date(auj) - new Date(f.date_echeance)) / 86400000) : 0;
    const detail = [
      `émise le ${fqrDateCH(f.date_emission)}`,
      f.statut === 'payee' ? `payée le ${fqrDateCH(f.paye_le)}` : f.statut === 'annulee' ? 'annulée' : `échéance ${fqrDateCH(f.date_echeance)}${jours ? ` · ${jours} j de retard` : ''}`,
      (f.lignes || [])[0]?.libelle || '',
    ].filter(Boolean).join(' · ');
    const act = (icone, titre, onclick, extra = '') => `<button type="button" class="fqr-icone ${extra}" title="${titre}" aria-label="${titre}" onclick="${onclick}">${icone}</button>`;
    return `<div class="fqr-ligne ${f.statut === 'annulee' ? 'fqr-ligne-annulee' : ''}" style="--i:${Math.min(i, 12)}">
      <button type="button" class="fqr-ligne-corps" onclick="fqrOuvrir('${f.id}')">
        <span class="fqr-statut fqr-s-${cls}">${lib}</span>
        <span class="fqr-ligne-texte"><b>${fqrEsc(f.numero || '—')} · ${fqrEsc(f.debiteur?.nom || 'Débiteur non renseigné')}</b><small>${fqrEsc(detail)}</small></span>
        <span class="fqr-ligne-montant">${f.devise} ${fqrFmtMontant(f.montant)}</span>
      </button>
      <span class="fqr-ligne-actions">
        ${act('🖨️', 'Imprimer ou PDF', `fqrImprimer('${f.id}')`)}
        ${act('⧉', 'Dupliquer', `fqrDupliquer('${f.id}')`)}
        ${f.statut === 'emise' ? act('✓', 'Marquer payée', `fqrOuvrirPaiement('${f.id}')`, 'fqr-icone-ok') : ''}
        ${f.statut === 'payee' ? act('↺', 'Annuler le paiement (remettre à encaisser)', `fqrAnnulerPaiement('${f.id}')`) : ''}
        ${['brouillon', 'emise'].includes(f.statut) ? act('⊘', 'Annuler la facture', `fqrAnnuler('${f.id}')`, 'fqr-icone-danger') : ''}
      </span>
    </div>`;
  }).join('')}</div>`;
}

// ── Actions sur une facture ─────────────────────────────────────────────────────────────────
function fqrTrouver(id) { return _fqr.factures.find(f => f.id === id); }

async function fqrAnnuler(id) {
  const f = fqrTrouver(id);
  if (!f || !confirm(`Annuler la facture ${f.numero} ?\nElle reste dans la liste avec le statut « Annulée » (rien n’est supprimé).`)) return;
  const r = await dbPatch('factures', id, { statut: 'annulee' });
  if (r && r.error) { showError('Facture non annulée : ' + errMsg(r)); return; }
  if (typeof logAction === 'function') logAction('annuler_facture', 'factures', id, f.numero);
  showError(`✓ Facture ${f.numero} annulée`);
  await fqrCharger();
}

function fqrOuvrirPaiement(id) {
  const f = fqrTrouver(id);
  if (!f) return;
  creerModale('fqr-modale-paiement', `
    <div class="fqr-modale fqr-modale-petite" role="dialog" aria-labelledby="fqr-paie-titre">
      <header class="fqr-modale-tete"><h3 id="fqr-paie-titre">Paiement reçu</h3><button type="button" class="fqr-fermer" aria-label="Fermer" onclick="document.getElementById('fqr-modale-paiement').remove()">✕</button></header>
      <p class="fqr-aide">${fqrEsc(f.numero)} · ${fqrEsc(f.debiteur?.nom || '')} · <b>${f.devise} ${fqrFmtMontant(f.montant)}</b></p>
      <label class="fqr-champ">Payée le<input type="date" id="fqr-paye-le" value="${fqrIso(new Date())}" max="${fqrIso(new Date())}"/></label>
      <div class="fqr-modale-pied">
        <button type="button" class="btn-secondary" onclick="document.getElementById('fqr-modale-paiement').remove()">Annuler</button>
        <button type="button" class="btn-save" id="fqr-paie-ok" onclick="fqrMarquerPayee('${id}')">✓ Marquer payée</button>
      </div>
    </div>`, { padding: '16px' });
}

async function fqrMarquerPayee(id) {
  const f = fqrTrouver(id);
  const date = document.getElementById('fqr-paye-le')?.value;
  if (!f) return;
  if (!date) { showError('Indique la date du paiement.'); return; }
  const btn = document.getElementById('fqr-paie-ok');
  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
  const r = await dbPatch('factures', id, { statut: 'payee', paye_le: date });
  if (r && r.error) { showError('Paiement non enregistré : ' + errMsg(r)); if (btn) { btn.disabled = false; btn.textContent = '✓ Marquer payée'; } return; }
  if (typeof logAction === 'function') logAction('facture_payee', 'factures', id, `${f.numero} — ${f.devise} ${fqrFmtMontant(f.montant)} le ${fqrDateCH(date)}`);
  document.getElementById('fqr-modale-paiement')?.remove();
  showError(`✓ Facture ${f.numero} marquée payée`);
  await fqrCharger();
}

async function fqrAnnulerPaiement(id) {
  const f = fqrTrouver(id);
  if (!f || !confirm(`Remettre la facture ${f.numero} « à encaisser » ?`)) return;
  const r = await dbPatch('factures', id, { statut: 'emise', paye_le: null });
  if (r && r.error) { showError('Modification refusée : ' + errMsg(r)); return; }
  if (typeof logAction === 'function') logAction('facture_paiement_annule', 'factures', id, f.numero);
  await fqrCharger();
}

function fqrDupliquer(id) {
  const f = fqrTrouver(id);
  if (!f) return;
  fqrOuvrirEditeur(fqrNouvelleFacture(f));
}

function fqrOuvrir(id) {
  const f = fqrTrouver(id);
  if (!f) return;
  fqrOuvrirEditeur({
    id: f.id, numero: f.numero, client_id: f.client_id || null,
    debiteur: { nom: '', rue: '', numero: '', npa: '', ville: '', pays: 'CH', ...(f.debiteur || {}) },
    lignes: (f.lignes || []).map(l => ({ libelle: l.libelle || '', quantite: l.quantite ?? 1, prix: l.prix ?? 0 })),
    devise: f.devise, typeRef: fqrTypeReference(f.reference), typeRefOrigine: fqrTypeReference(f.reference), reference: f.reference || '',
    message: f.message || '', notes: f.notes || '', date_emission: f.date_emission || fqrIso(new Date()),
    date_echeance: f.date_echeance || fqrAjouterJours(f.date_emission, 30), statut: f.statut, paye_le: f.paye_le || null,
  });
}

function fqrNouvelleFacture(modele) {
  const auj = fqrIso(new Date());
  return {
    id: null, numero: '', client_id: modele ? modele.client_id || null : null,
    debiteur: { nom: '', rue: '', numero: '', npa: '', ville: '', pays: 'CH', ...((modele && modele.debiteur) || {}) },
    lignes: modele && modele.lignes && modele.lignes.length ? modele.lignes.map(l => ({ libelle: l.libelle || '', quantite: l.quantite ?? 1, prix: l.prix ?? 0 })) : [{ libelle: '', quantite: 1, prix: '' }],
    devise: modele ? modele.devise || 'CHF' : 'CHF', typeRef: fqrTypeParDefaut(), reference: '',
    message: modele ? modele.message || '' : '', notes: '', date_emission: auj, date_echeance: fqrAjouterJours(auj, 30), statut: 'brouillon',
  };
}

async function fqrNouvelle() {
  if (!_fqr.charge) await fqrCharger();
  fqrOuvrirEditeur(fqrNouvelleFacture());
}

// Point d'entrée depuis un autre écran (refacturation OZ du cockpit, fiche client…) :
// ouvre l'éditeur prérempli ({ client_id?, debiteur?, lignes?, message? })
async function fqrNouvelleFactureDepuis(modele) {
  if (!_fqr.charge) await fqrCharger();
  const m = { ...(modele || {}) };
  if (m.client_id && !m.debiteur && typeof fqrDebiteurDepuisClient === 'function') {
    const c = allClients.find(x => x.id === m.client_id);
    if (c) m.debiteur = fqrDebiteurDepuisClient(c);
  }
  fqrOuvrirEditeur(fqrNouvelleFacture(m));
}

// ── Éditeur ─────────────────────────────────────────────────────────────────────────────────
async function fqrOuvrirEditeur(ed) {
  _fqr.ed = ed;
  const lecture = ['payee', 'annulee'].includes(ed.statut);
  const P = _fqr.params || {};
  const aQr = !!(P.qr_iban && fqrIbanValide(P.qr_iban));
  const aIban = !!(P.iban && fqrIbanValide(P.iban));
  const optRef = [
    ['QRR', 'Référence QR (QRR) — QR-IBAN', aQr],
    ['SCOR', 'Référence créancier (RF) — IBAN', aIban],
    ['NON', 'Sans référence — IBAN', aIban],
  ];
  const dis = lecture ? 'disabled' : '';
  const d = ed.debiteur;
  const champ = (cle, label, attrs = '', plein = false) => `<label class="fqr-champ${plein ? ' fqr-plein' : ''}">${label}<input data-champ="${cle}" value="${fqrEsc(cle.startsWith('debiteur.') ? d[cle.slice(9)] : ed[cle])}" oninput="fqrEdChamp(this)" ${dis} ${attrs}/></label>`;

  creerModale('fqr-modale-editeur', `
    <div class="fqr-modale fqr-modale-large" role="dialog" aria-labelledby="fqr-ed-titre">
      <header class="fqr-modale-tete">
        <div><h3 id="fqr-ed-titre">${ed.id ? `Facture ${fqrEsc(ed.numero)}` : 'Nouvelle facture'}</h3>
          <span class="fqr-modale-sous">${ed.id ? `<span class="fqr-statut fqr-s-${(FQR_STATUTS[fqrStatut(ed)] || [])[1] || 'emise'}">${(FQR_STATUTS[fqrStatut(ed)] || [ed.statut])[0]}</span>` : `numéro attribué à l’enregistrement : <b id="fqr-ed-numero">…</b>`}</span></div>
        <button type="button" class="fqr-fermer" aria-label="Fermer" onclick="fqrFermerEditeur()">✕</button>
      </header>
      ${lecture ? `<div class="fqr-info">Facture ${ed.statut === 'payee' ? `payée le ${fqrDateCH(ed.paye_le)}` : 'annulée'} : lecture seule. Duplique-la pour en créer une nouvelle.</div>` : ''}
      ${!fqrParamsOk() ? `<div class="fqr-info fqr-info-alerte">Créancier ou IBAN non configuré : l’aperçu n’aura pas de code QR. <button type="button" class="dbx-lien" onclick="fqrOuvrirParametres()">Configurer</button></div>` : ''}
      <div class="fqr-editeur">
        <div class="fqr-form">
          <section class="fqr-bloc">
            <h4>Débiteur</h4>
            ${lecture ? '' : `<div class="fqr-client">
              <input id="fqr-ed-client" type="search" autocomplete="off" placeholder="Rechercher un client du CRM…" oninput="fqrEdChercherClient(this.value)" aria-label="Rechercher un client"/>
              <div id="fqr-ed-client-res" class="fqr-client-res" role="listbox"></div>
            </div>`}
            <div id="fqr-ed-lien" class="fqr-lien-client">${fqrEdLienClientHtml()}</div>
            <div class="fqr-grille">
              ${champ('debiteur.nom', 'Nom / raison sociale', 'maxlength="70"', true)}
              ${champ('debiteur.rue', 'Rue', 'maxlength="70"')}
              ${champ('debiteur.numero', 'N°', 'maxlength="16"')}
              ${champ('debiteur.npa', 'NPA', 'maxlength="16" inputmode="numeric"')}
              ${champ('debiteur.ville', 'Localité', 'maxlength="35"')}
              ${champ('debiteur.pays', 'Pays', 'maxlength="2"')}
            </div>
          </section>
          <section class="fqr-bloc">
            <h4>Prestations</h4>
            <div id="fqr-ed-lignes">${fqrEdLignesHtml(lecture)}</div>
            ${lecture ? '' : `<button type="button" class="dbx-lien" onclick="fqrEdAjouterLigne()">+ Ajouter une ligne</button>`}
            <div class="fqr-total"><span>Total</span><b id="fqr-ed-total">${ed.devise} ${fqrFmtMontant(fqrTotalLignes(ed.lignes))}</b></div>
          </section>
          <section class="fqr-bloc">
            <h4>Paiement</h4>
            <div class="fqr-grille">
              <label class="fqr-champ">Date de facture<input type="date" data-champ="date_emission" value="${ed.date_emission}" oninput="fqrEdChamp(this)" ${dis}/></label>
              <label class="fqr-champ">Échéance<input type="date" id="fqr-ed-echeance" data-champ="date_echeance" value="${ed.date_echeance}" oninput="fqrEdChamp(this)" ${dis}/></label>
              ${lecture ? '' : `<div class="fqr-delais fqr-plein">${[10, 30, 60].map(j => `<button type="button" onclick="fqrEdDelai(${j})">${j} jours</button>`).join('')}</div>`}
              <label class="fqr-champ">Monnaie<select data-champ="devise" onchange="fqrEdChamp(this)" ${dis}>${['CHF', 'EUR'].map(x => `<option ${ed.devise === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
              <label class="fqr-champ">Référence<select data-champ="typeRef" onchange="fqrEdChamp(this)" ${dis}>${optRef.map(([v, l, ok]) => `<option value="${v}" ${ed.typeRef === v ? 'selected' : ''} ${ok || ed.typeRef === v ? '' : 'disabled'}>${l}</option>`).join('')}</select></label>
              <div class="fqr-ref fqr-plein" id="fqr-ed-ref"></div>
              <label class="fqr-champ fqr-plein">Message au débiteur <small id="fqr-ed-msg-compte">${fqrTexte(ed.message).length}/140</small><input data-champ="message" maxlength="140" value="${fqrEsc(ed.message)}" oninput="fqrEdChamp(this)" placeholder="ex. Honoraires de conseil septembre" ${dis}/></label>
              <label class="fqr-champ fqr-plein">Notes internes <small>(non imprimées)</small><textarea data-champ="notes" rows="2" oninput="fqrEdChamp(this)" ${ed.statut === 'annulee' ? 'disabled' : ''}>${fqrEsc(ed.notes)}</textarea></label>
            </div>
          </section>
          <div id="fqr-ed-erreurs"></div>
        </div>
        <div class="fqr-apercu">
          <div class="fqr-apercu-tete"><span>Aperçu</span><small>A4 · section paiement SIX</small></div>
          <div class="fqr-apercu-cadre"><iframe id="fqr-apercu" title="Aperçu de la facture" sandbox="allow-same-origin"></iframe></div>
        </div>
      </div>
      <footer class="fqr-modale-pied">
        <button type="button" class="btn-secondary" onclick="fqrFermerEditeur()">Fermer</button>
        <span class="fqr-espace"></span>
        ${ed.id ? `<button type="button" class="btn-secondary" onclick="fqrFermerEditeur();fqrDupliquer('${ed.id}')">⧉ Dupliquer</button>` : ''}
        <button type="button" class="btn-secondary" onclick="fqrImprimerEditeur()">🖨️ Imprimer / PDF</button>
        ${lecture ? (ed.statut === 'payee' ? `<button type="button" class="btn-save" id="fqr-ed-ok" onclick="fqrEnregistrer(null)">✓ Enregistrer les notes</button>` : '')
          : ed.statut === 'brouillon'
            ? `<button type="button" class="btn-secondary" id="fqr-ed-brouillon" onclick="fqrEnregistrer('brouillon')">Enregistrer le brouillon</button>
               <button type="button" class="btn-save" id="fqr-ed-ok" onclick="fqrEnregistrer('emise')">✓ Émettre la facture</button>`
            : `<button type="button" class="btn-save" id="fqr-ed-ok" onclick="fqrEnregistrer('emise')">✓ Enregistrer</button>`}
      </footer>
    </div>`, { padding: '16px' });

  if (!ed.id) {
    _fqr.numeroPrevu = fqrProchainNumeroLocal(_fqr.factures.map(f => f.numero), null, ed.date_emission);
    fqrEdMajNumero();
    fqrProchainNumero(ed.date_emission).then(n => { _fqr.numeroPrevu = n; fqrEdMajNumero(); fqrEdApercu(); });
  }
  fqrEdApercu(true);
  if (typeof qrcode !== 'function') fqrChargerQrLib().then(ok => { if (ok) fqrEdApercu(true); else showError('Générateur de code QR indisponible (connexion ?).'); });
}

function fqrFermerEditeur() { document.getElementById('fqr-modale-editeur')?.remove(); _fqr.ed = null; }

function fqrEdMajNumero() {
  const el = document.getElementById('fqr-ed-numero');
  if (el) el.textContent = _fqr.numeroPrevu || '…';
}

function fqrEdLienClientHtml() {
  const ed = _fqr.ed;
  if (!ed || !ed.client_id) return '<small>Débiteur libre (non rattaché à un client du CRM)</small>';
  const c = typeof allClients !== 'undefined' ? allClients.find(x => x.id === ed.client_id) : null;
  return `<small>Rattachée au client <b>${fqrEsc(c ? fqrNomClient(c) : 'du CRM')}</b></small>${['payee', 'annulee'].includes(ed.statut) ? '' : ` <button type="button" class="dbx-lien" onclick="fqrEdDetacherClient()">détacher</button>`}`;
}

function fqrEdLignesHtml(lecture) {
  const ed = _fqr.ed;
  const dis = lecture ? 'disabled' : '';
  return `<div class="fqr-lignes">
    <div class="fqr-lignes-tete"><span>Libellé</span><span>Qté</span><span>Prix unit.</span><span>Montant</span><span></span></div>
    ${ed.lignes.map((l, i) => `<div class="fqr-lignes-ligne">
      <input value="${fqrEsc(l.libelle)}" placeholder="ex. Analyse de couverture" maxlength="200" oninput="fqrEdLigne(${i},'libelle',this.value)" aria-label="Libellé ligne ${i + 1}" ${dis}/>
      <input value="${fqrEsc(l.quantite)}" inputmode="decimal" oninput="fqrEdLigne(${i},'quantite',this.value)" aria-label="Quantité ligne ${i + 1}" ${dis}/>
      <input value="${fqrEsc(l.prix)}" inputmode="decimal" placeholder="0.00" oninput="fqrEdLigne(${i},'prix',this.value)" aria-label="Prix ligne ${i + 1}" ${dis}/>
      <span class="fqr-lignes-montant" id="fqr-ed-lm-${i}">${fqrFmtMontant(fqrNombre(l.quantite) * fqrNombre(l.prix))}</span>
      ${lecture ? '<span></span>' : `<button type="button" class="fqr-icone" title="Retirer la ligne" aria-label="Retirer la ligne ${i + 1}" onclick="fqrEdRetirerLigne(${i})" ${ed.lignes.length < 2 ? 'disabled' : ''}>✕</button>`}
    </div>`).join('')}
  </div>`;
}

function fqrEdChamp(el) {
  const ed = _fqr.ed;
  if (!ed) return;
  const cle = el.dataset.champ;
  let v = el.value;
  if (cle === 'debiteur.pays') { v = v.toUpperCase().replace(/[^A-Z]/g, ''); if (el.value !== v) el.value = v; }
  if (cle.startsWith('debiteur.')) ed.debiteur[cle.slice(9)] = v;
  else ed[cle] = v;
  if (cle === 'devise') document.getElementById('fqr-ed-total').textContent = `${ed.devise} ${fqrFmtMontant(fqrTotalLignes(ed.lignes))}`;
  if (cle === 'message') document.getElementById('fqr-ed-msg-compte').textContent = `${fqrTexte(v).length}/140`;
  if (cle === 'date_emission' && !ed.id) fqrProchainNumero(v).then(n => { _fqr.numeroPrevu = n; fqrEdMajNumero(); fqrEdApercu(); });
  fqrEdApercu();
}

function fqrEdDelai(jours) {
  const ed = _fqr.ed;
  ed.date_echeance = fqrAjouterJours(ed.date_emission, jours);
  const el = document.getElementById('fqr-ed-echeance');
  if (el) el.value = ed.date_echeance;
  fqrEdApercu();
}

function fqrEdLigne(i, cle, v) {
  const ed = _fqr.ed;
  ed.lignes[i][cle] = v;
  const l = ed.lignes[i];
  const cel = document.getElementById(`fqr-ed-lm-${i}`);
  if (cel) cel.textContent = fqrFmtMontant(fqrNombre(l.quantite) * fqrNombre(l.prix));
  document.getElementById('fqr-ed-total').textContent = `${ed.devise} ${fqrFmtMontant(fqrTotalLignes(ed.lignes))}`;
  fqrEdApercu();
}
function fqrEdAjouterLigne() {
  _fqr.ed.lignes.push({ libelle: '', quantite: 1, prix: '' });
  document.getElementById('fqr-ed-lignes').innerHTML = fqrEdLignesHtml(false);
  const inputs = document.querySelectorAll('#fqr-ed-lignes .fqr-lignes-ligne:last-child input');
  if (inputs[0]) inputs[0].focus();
  fqrEdApercu();
}
function fqrEdRetirerLigne(i) {
  const ed = _fqr.ed;
  if (ed.lignes.length < 2) return;
  ed.lignes.splice(i, 1);
  document.getElementById('fqr-ed-lignes').innerHTML = fqrEdLignesHtml(false);
  document.getElementById('fqr-ed-total').textContent = `${ed.devise} ${fqrFmtMontant(fqrTotalLignes(ed.lignes))}`;
  fqrEdApercu();
}

function fqrEdChercherClient(texte) {
  const zone = document.getElementById('fqr-ed-client-res');
  if (!zone) return;
  const q = String(texte || '').trim().toLowerCase();
  const clients = typeof allClients !== 'undefined' && Array.isArray(allClients) ? allClients : [];
  if (q.length < 2) { zone.innerHTML = ''; return; }
  const res = clients.filter(c => `${fqrNomClient(c)} ${c.ville || ''} ${c.email || ''}`.toLowerCase().includes(q)).slice(0, 8);
  zone.innerHTML = res.length ? res.map(c => `<button type="button" role="option" onclick="fqrEdChoisirClient('${c.id}')">
      <b>${fqrEsc(fqrNomClient(c) || '—')}</b><small>${fqrEsc([c.adresse, [c.npa, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'adresse non renseignée')}</small></button>`).join('')
    : '<div class="fqr-client-vide">Aucun client trouvé — saisis le débiteur ci-dessous.</div>';
}

function fqrEdChoisirClient(id) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === id);
  const ed = _fqr.ed;
  if (!c || !ed) return;
  ed.client_id = c.id;
  ed.debiteur = fqrDebiteurDepuisClient(c);
  document.querySelectorAll('#fqr-modale-editeur [data-champ^="debiteur."]').forEach(el => { el.value = ed.debiteur[el.dataset.champ.slice(9)] || ''; });
  document.getElementById('fqr-ed-client').value = '';
  document.getElementById('fqr-ed-client-res').innerHTML = '';
  document.getElementById('fqr-ed-lien').innerHTML = fqrEdLienClientHtml();
  if (!ed.debiteur.npa || !ed.debiteur.ville) showError('Adresse du client incomplète : complète le NPA et la localité.');
  fqrEdApercu();
}
function fqrEdDetacherClient() {
  _fqr.ed.client_id = null;
  document.getElementById('fqr-ed-lien').innerHTML = fqrEdLienClientHtml();
}

// Facture complète à partir de l'état de l'éditeur (numéro et référence calculés si besoin)
function fqrEdFacture() {
  const ed = _fqr.ed;
  const numero = ed.id ? ed.numero : (_fqr.numeroPrevu || fqrProchainNumeroLocal(_fqr.factures.map(f => f.numero), null, ed.date_emission));
  const garderRef = ed.id && ed.reference && ed.typeRef === ed.typeRefOrigine;
  const lignes = ed.lignes.filter(l => String(l.libelle || '').trim() || fqrNombre(l.prix))
    .map(l => ({ libelle: String(l.libelle || '').trim(), quantite: fqrNombre(l.quantite), prix: fqrArrondi(fqrNombre(l.prix)) }));
  const deb = Object.fromEntries(Object.entries(ed.debiteur).map(([k, v]) => [k, String(v ?? '').trim()]));
  deb.pays = (deb.pays || 'CH').toUpperCase();
  return {
    id: ed.id, numero, client_id: ed.client_id || null, debiteur: deb, lignes,
    montant: fqrTotalLignes(lignes), devise: ed.devise === 'EUR' ? 'EUR' : 'CHF',
    reference: garderRef ? fqrCompact(ed.reference) : fqrCalculerReference(ed.typeRef, numero),
    message: fqrTexte(ed.message, 140), date_emission: ed.date_emission, date_echeance: ed.date_echeance,
    statut: ed.statut, paye_le: ed.paye_le || null, notes: String(ed.notes || '').trim(),
  };
}

let _fqrApercuMinuteur = null;
function fqrEdApercu(immediat) {
  clearTimeout(_fqrApercuMinuteur);
  _fqrApercuMinuteur = setTimeout(() => {
    if (!_fqr.ed) return;
    const f = fqrEdFacture();
    const ref = document.getElementById('fqr-ed-ref');
    if (ref) ref.innerHTML = f.reference ? `<small>${fqrTypeReference(f.reference) === 'QRR' ? 'Référence QR' : 'Référence créancier'}</small><code>${fqrFmtReference(f.reference)}</code>` : '<small>Sans référence : le paiement s’identifie par le message.</small>';
    const err = fqrErreursFacture(f, _fqr.params);
    const zone = document.getElementById('fqr-ed-erreurs');
    if (zone) zone.innerHTML = err.length && !['payee', 'annulee'].includes(f.statut) ? `<div class="fqr-erreurs"><b>À corriger avant d’émettre :</b><ul>${err.map(e => `<li>${fqrEsc(e)}</li>`).join('')}</ul></div>` : '';
    const ifr = document.getElementById('fqr-apercu');
    if (ifr) ifr.srcdoc = fqrDocumentHtml(f, _fqr.params || {}, { apercu: true });
  }, immediat ? 0 : 220);
}

async function fqrEnregistrer(statut) {
  const ed = _fqr.ed;
  if (!ed) return;
  const btn = document.getElementById(statut === 'brouillon' ? 'fqr-ed-brouillon' : 'fqr-ed-ok');
  if (btn && btn.disabled) return;
  // Facture payée : seules les notes internes se modifient
  if (statut === null) {
    const r = await dbPatch('factures', ed.id, { notes: String(ed.notes || '').trim() || null });
    if (r && r.error) { showError('Notes non enregistrées : ' + errMsg(r)); return; }
    fqrFermerEditeur(); showError('✓ Notes enregistrées'); await fqrCharger(); return;
  }
  const f = fqrEdFacture();
  if (!f.lignes.length) { showError('Ajoute au moins une ligne de prestation.'); return; }
  if (!f.date_emission || !f.date_echeance) { showError('Indique la date de facture et l’échéance.'); return; }
  if (f.date_echeance < f.date_emission) { showError('L’échéance est avant la date de facture.'); return; }
  if (statut === 'emise') {
    const err = fqrErreursFacture(f, _fqr.params);
    if (!fqrTexte(f.debiteur.nom)) err.push('Indique le débiteur (nom et adresse).');
    if (err.length) { showError(err[0]); fqrEdApercu(true); return; }
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
  const retablir = () => { if (btn) { btn.disabled = false; btn.textContent = statut === 'brouillon' ? 'Enregistrer le brouillon' : (ed.statut === 'brouillon' ? '✓ Émettre la facture' : '✓ Enregistrer'); } };
  const body = {
    client_id: f.client_id, debiteur: f.debiteur, lignes: f.lignes, montant: f.montant, devise: f.devise,
    reference: f.reference || null, message: f.message || null, date_emission: f.date_emission, date_echeance: f.date_echeance,
    statut, notes: f.notes || null,
  };
  let r, id = ed.id, numero = f.numero;
  if (ed.id) {
    r = await dbPatch('factures', ed.id, body);
  } else {
    // Numéro relu juste avant la création (évite un doublon si une autre facture vient d'être créée)
    numero = await fqrProchainNumero(f.date_emission);
    body.numero = numero;
    body.reference = fqrCalculerReference(ed.typeRef, numero) || null;
    r = await dbPost('factures', body);
    if (Array.isArray(r) && r[0]) id = r[0].id;
  }
  if (r && r.error) { showError('Facture non enregistrée : ' + errMsg(r)); retablir(); return; }
  if (typeof logAction === 'function') logAction(ed.id ? 'modifier_facture' : 'creer_facture', 'factures', id || null, `${numero} — ${f.devise} ${fqrFmtMontant(f.montant)} (${statut})`);
  fqrFermerEditeur();
  showError(`✓ Facture ${numero} ${statut === 'brouillon' ? 'enregistrée en brouillon' : ed.statut === 'brouillon' ? 'émise' : 'enregistrée'}`);
  await fqrCharger();
}

// ── Paramètres du créancier ─────────────────────────────────────────────────────────────────
function fqrOuvrirParametres() {
  const P = _fqr.params || {};
  const champ = (id, label, val, attrs = '', plein = false) => `<label class="fqr-champ${plein ? ' fqr-plein' : ''}">${label}<input id="fqr-p-${id}" value="${fqrEsc(val ?? '')}" ${attrs}/></label>`;
  creerModale('fqr-modale-params', `
    <div class="fqr-modale" role="dialog" aria-labelledby="fqr-p-titre">
      <header class="fqr-modale-tete"><div><h3 id="fqr-p-titre">Créancier & comptes</h3><span class="fqr-modale-sous">Figurent sur chaque facture et dans le code QR</span></div>
        <button type="button" class="fqr-fermer" aria-label="Fermer" onclick="document.getElementById('fqr-modale-params').remove()">✕</button></header>
      <div class="fqr-grille">
        ${champ('nom', 'Nom du créancier', P.nom, 'maxlength="70" placeholder="Raison sociale"', true)}
        ${champ('rue', 'Rue', P.rue, 'maxlength="70"')}
        ${champ('numero', 'N°', P.numero, 'maxlength="16"')}
        ${champ('npa', 'NPA', P.npa, 'maxlength="16" inputmode="numeric"')}
        ${champ('ville', 'Localité', P.ville, 'maxlength="35"')}
        <label class="fqr-champ">Pays<select id="fqr-p-pays">${['CH', 'LI'].map(x => `<option ${(P.pays || 'CH') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        ${champ('prefixe', 'Préfixe des numéros', P.prefixe_numero || 'F', 'maxlength="6"')}
        ${champ('iban', 'IBAN', P.iban ? fqrFmtIban(P.iban) : '', 'class="fqr-mono" placeholder="CH.. .... .... .... .... ." oninput="fqrParamIban(this,false)" autocomplete="off"', true)}
        <div class="fqr-plein fqr-verif" id="fqr-p-iban-v"></div>
        ${champ('qr_iban', 'QR-IBAN <small>(optionnel — pour les références QRR)</small>', P.qr_iban ? fqrFmtIban(P.qr_iban) : '', 'class="fqr-mono" placeholder="CH.. 30.. .... .... .... ." oninput="fqrParamIban(this,true)" autocomplete="off"', true)}
        <div class="fqr-plein fqr-verif" id="fqr-p-qr_iban-v"></div>
        ${champ('email', 'E-mail', P.email, 'type="email"')}
        ${champ('tel', 'Téléphone', P.tel)}
        <label class="fqr-case fqr-plein"><input type="checkbox" id="fqr-p-logo" ${P.logo === false ? '' : 'checked'}/> Afficher le logo sur les factures</label>
      </div>
      <p class="fqr-aide">Avec un QR-IBAN, les factures portent une référence QRR (rapprochement automatique par la banque). Avec un IBAN normal : référence créancier RF ou aucune référence.</p>
      <footer class="fqr-modale-pied">
        <button type="button" class="btn-secondary" onclick="document.getElementById('fqr-modale-params').remove()">Annuler</button>
        <button type="button" class="btn-save" id="fqr-p-ok" onclick="fqrSauverParametres()">✓ Enregistrer</button>
      </footer>
    </div>`, { padding: '16px' });
  ['iban', 'qr_iban'].forEach(k => { const el = document.getElementById('fqr-p-' + k); if (el && el.value) fqrParamIban(el, k === 'qr_iban'); });
}

function fqrParamIban(el, qr) {
  const v = document.getElementById(el.id + '-v');
  if (!v) return;
  const s = fqrCompact(el.value);
  const err = fqrIbanErreur(s, { qr });
  v.className = 'fqr-plein fqr-verif ' + (!s ? '' : err ? 'ko' : 'ok');
  v.textContent = !s ? '' : err || (fqrEstQrIban(s) ? '✓ QR-IBAN valide' : '✓ IBAN valide');
}

async function fqrSauverParametres() {
  const val = id => (document.getElementById('fqr-p-' + id)?.value || '').trim();
  const valeur = {
    nom: val('nom'), rue: val('rue'), numero: val('numero'), npa: val('npa'), ville: val('ville'), pays: val('pays') || 'CH',
    iban: fqrCompact(val('iban')), qr_iban: fqrCompact(val('qr_iban')), email: val('email'), tel: val('tel'),
    prefixe_numero: (val('prefixe') || 'F').replace(/[^0-9A-Za-z]/g, '').toUpperCase() || 'F',
    logo: !!document.getElementById('fqr-p-logo')?.checked,
  };
  if (!valeur.nom || !valeur.npa || !valeur.ville) { showError('Nom, NPA et localité du créancier sont obligatoires.'); return; }
  if (!valeur.iban && !valeur.qr_iban) { showError('Indique au moins un IBAN ou un QR-IBAN.'); return; }
  const e1 = fqrIbanErreur(valeur.iban, { qr: false }), e2 = fqrIbanErreur(valeur.qr_iban, { qr: true });
  if (e1) { showError('IBAN : ' + e1); return; }
  if (e2) { showError('QR-IBAN : ' + e2); return; }
  const btn = document.getElementById('fqr-p-ok');
  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
  try {
    const jeton = (typeof getValidAccessToken === 'function' ? await getValidAccessToken() : null) || SUPABASE_KEY;
    const r = await fetch(SUPABASE_URL + '/rest/v1/parametres_societe', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ cle: 'facturation', valeur, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) {
      let detail = null; try { detail = await r.json(); } catch (e) { /* réponse vide */ }
      showError('Paramètres non enregistrés : ' + errMsg({ error: true, status: r.status, detail }));
      if (btn) { btn.disabled = false; btn.textContent = '✓ Enregistrer'; }
      return;
    }
  } catch (e) {
    showError('Paramètres non enregistrés : connexion impossible.');
    if (btn) { btn.disabled = false; btn.textContent = '✓ Enregistrer'; }
    return;
  }
  _fqr.params = valeur;
  if (typeof logAction === 'function') logAction('parametres_facturation', 'parametres_societe', null, 'Créancier / IBAN mis à jour');
  document.getElementById('fqr-modale-params')?.remove();
  showError('✓ Paramètres de facturation enregistrés');
  fqrRendre();
  if (_fqr.ed && document.getElementById('fqr-modale-editeur')) fqrOuvrirEditeur(_fqr.ed);
}

// ── Document A4 (aperçu et impression) ──────────────────────────────────────────────────────
function fqrLignesAdresse(a) {
  if (!a) return [];
  const pays = (a.pays || 'CH').toUpperCase();
  return [
    a.nom,
    [a.rue, a.numero].filter(x => String(x || '').trim()).join(' '),
    `${pays !== 'CH' ? pays + '-' : ''}${a.npa || ''} ${a.ville || ''}`.trim(),
  ].map(x => String(x || '').trim()).filter(Boolean);
}

// Coins de délimitation d'une zone à remplir à la main (débiteur absent)
function fqrCadreVide(l, h) {
  const c = 3;
  return `<svg width="${l}mm" height="${h}mm" viewBox="0 0 ${l} ${h}" class="coins"><path d="M0 ${c}V0H${c}M${l - c} 0H${l}V${c}M${l} ${h - c}V${h}H${l - c}M${c} ${h}H0V${h - c}" fill="none" stroke="#000" stroke-width="0.3"/></svg>`;
}

// Section paiement 210 × 105 mm : récépissé (62 mm) + section paiement (148 mm)
function fqrBulletinHtml(f, P) {
  const type = fqrTypeReference(f.reference);
  const iban = fqrIbanPour(type, P);
  const err = fqrErreursFacture(f, P);
  const cr = fqrLignesAdresse(P).map(fqrEsc).join('<br>');
  const db = fqrTexte(f.debiteur?.nom) ? fqrLignesAdresse(f.debiteur).map(fqrEsc).join('<br>') : '';
  const ref = f.reference ? fqrFmtReference(f.reference) : '';
  const montant = fqrFmtMontant(f.montant);
  let qr = '';
  if (!err.length && typeof qrcode === 'function') {
    try { qr = fqrQrSvg(fqrPayload({ iban, creancier: P, montant: f.montant, devise: f.devise, debiteur: f.debiteur, reference: f.reference, message: f.message })); }
    catch (e) { err.push('Code QR impossible à générer : ' + e.message); }
  }
  const zoneQr = qr || `<div class="qr-vide">${err.length ? err.map(fqrEsc).join('<br>') : 'Code QR en cours de chargement…'}</div>`;
  return `<div class="bulletin">
    <div class="detacher"><span class="ciseaux">✂</span>À détacher avant le versement</div>
    <div class="recu">
      <div class="titre">Récépissé</div>
      <div class="r-info">
        <div class="rub">Compte / Payable à</div><div class="val">${fqrEsc(fqrFmtIban(iban))}<br>${cr}</div>
        ${ref ? `<div class="rub">Référence</div><div class="val">${fqrEsc(ref)}</div>` : ''}
        ${db ? `<div class="rub">Payable par</div><div class="val">${db}</div>` : `<div class="rub">Payable par (nom/adresse)</div>${fqrCadreVide(52, 20)}`}
      </div>
      <div class="r-montant"><div><div class="rub">Monnaie</div><div class="val">${f.devise}</div></div><div><div class="rub">Montant</div><div class="val">${montant}</div></div></div>
      <div class="r-depot">Point de dépôt</div>
    </div>
    <div class="paiement">
      <div class="titre">Section paiement</div>
      <div class="qr">${zoneQr}</div>
      <div class="p-montant"><div><div class="rub">Monnaie</div><div class="val">${f.devise}</div></div><div><div class="rub">Montant</div><div class="val">${montant}</div></div></div>
      <div class="p-info">
        <div class="rub">Compte / Payable à</div><div class="val">${fqrEsc(fqrFmtIban(iban))}<br>${cr}</div>
        ${ref ? `<div class="rub">Référence</div><div class="val">${fqrEsc(ref)}</div>` : ''}
        ${f.message ? `<div class="rub">Informations supplémentaires</div><div class="val">${fqrEsc(f.message)}</div>` : ''}
        ${db ? `<div class="rub">Payable par</div><div class="val">${db}</div>` : `<div class="rub">Payable par (nom/adresse)</div>${fqrCadreVide(65, 25)}`}
      </div>
    </div>
  </div>`;
}

function fqrDocumentHtml(f, P, opt = {}) {
  P = P || {};
  const lignes = (f.lignes || []).filter(l => String(l.libelle || '').trim() || fqrNombre(l.prix));
  const bulletinSepare = lignes.length > 12; // au-delà, la section paiement passe en page 2
  const logo = P.logo !== false && typeof ASSUREX_LOGO_B64 !== 'undefined' && ASSUREX_LOGO_B64 ? `<img src="${ASSUREX_LOGO_B64}" alt="">` : '';
  const cr = fqrLignesAdresse(P);
  const db = fqrLignesAdresse(f.debiteur);
  const contact = [P.email, P.tel].filter(Boolean).map(fqrEsc).join(' · ');
  const filigrane = f.statut === 'brouillon' ? 'BROUILLON' : f.statut === 'annulee' ? 'ANNULÉE' : '';
  const qte = q => { const n = fqrNombre(q); return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''); };
  const bulletin = fqrBulletinHtml(f, P);
  // Titre = nom de fichier proposé à l'enregistrement en PDF : « Facture n° — Débiteur »
  const nomDebiteur = String((f.debiteur && (f.debiteur.nom || f.debiteur.raison_sociale)) || '').trim();
  const titre = [`Facture ${f.numero || ''}`.trim(), nomDebiteur].filter(Boolean).join(' — ').replace(/[<>:"/\\|?*]/g, '');

  const page1 = `<section class="page">
    <div class="tete">
      <div class="logo">${logo || `<b class="nom-crea">${fqrEsc(P.nom || '')}</b>`}</div>
      <div class="crea">${cr.map((l, i) => i === 0 ? `<b>${fqrEsc(l)}</b>` : fqrEsc(l)).join('<br>')}${contact ? `<br>${contact}` : ''}</div>
    </div>
    <div class="dest">${db.length ? db.map(fqrEsc).join('<br>') : '<span class="gris">Débiteur à compléter</span>'}</div>
    ${filigrane ? `<div class="filigrane">${filigrane}</div>` : ''}
    <div class="corps">
      <h1>Facture <span>${fqrEsc(f.numero || '')}</span></h1>
      <table class="meta"><tr>
        <td><small>Date</small>${fqrDateCH(f.date_emission)}</td>
        <td><small>Échéance</small>${fqrDateCH(f.date_echeance)}</td>
        ${f.reference ? `<td><small>Référence</small>${fqrEsc(fqrFmtReference(f.reference))}</td>` : ''}
      </tr></table>
      <table class="lignes">
        <thead><tr><th>Désignation</th><th class="n">Quantité</th><th class="n">Prix unitaire</th><th class="n">Montant ${f.devise}</th></tr></thead>
        <tbody>${lignes.length ? lignes.map(l => `<tr><td>${fqrEsc(l.libelle)}</td><td class="n">${qte(l.quantite)}</td><td class="n">${fqrFmtMontant(l.prix)}</td><td class="n">${fqrFmtMontant(fqrNombre(l.quantite) * fqrNombre(l.prix))}</td></tr>`).join('') : '<tr><td colspan="4" class="gris">Aucune prestation saisie</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3">Total à payer</td><td class="n">${f.devise} ${fqrFmtMontant(f.montant)}</td></tr></tfoot>
      </table>
      ${f.message ? `<p class="msg">${fqrEsc(f.message)}</p>` : ''}
      <p class="cond">Payable jusqu’au ${fqrDateCH(f.date_echeance)} au moyen de la section de paiement QR ${bulletinSepare ? 'en page 2' : 'ci-dessous'}. Merci de votre confiance.</p>
    </div>
    ${bulletinSepare ? '' : bulletin}
  </section>`;
  const page2 = bulletinSepare ? `<section class="page"><div class="corps"><h1>Facture <span>${fqrEsc(f.numero || '')}</span></h1><p class="cond">Section de paiement</p></div>${bulletin}</section>` : '';

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${fqrEsc(titre)}</title><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: ${opt.apercu ? '#fff' : '#E9ECF1'}; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #fff; margin: ${opt.apercu ? '0' : '8mm auto'}; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .tete { position: absolute; top: 14mm; left: 20mm; right: 15mm; display: flex; justify-content: space-between; align-items: flex-start; }
    .logo img { height: 15mm; max-width: 70mm; object-fit: contain; }
    .nom-crea { font-size: 14pt; color: #113679; }
    .crea { font-size: 8.5pt; line-height: 1.4; text-align: right; color: #333; }
    .dest { position: absolute; top: 50mm; left: 118mm; width: 80mm; font-size: 10.5pt; line-height: 1.4; }
    .gris { color: #999; }
    .corps { position: absolute; top: 88mm; left: 20mm; right: 15mm; font-size: 10pt; }
    h1 { font-size: 17pt; margin: 0 0 5mm; color: #113679; font-weight: bold; }
    h1 span { color: #000; font-weight: normal; }
    .meta { border-collapse: collapse; margin-bottom: 6mm; }
    .meta td { padding: 0 10mm 0 0; font-size: 10pt; vertical-align: top; }
    .meta small { display: block; font-size: 7.5pt; color: #666; text-transform: uppercase; letter-spacing: .3pt; margin-bottom: 1mm; }
    table.lignes { width: 100%; border-collapse: collapse; }
    .lignes th { font-size: 8pt; text-transform: uppercase; color: #555; text-align: left; border-bottom: 0.4mm solid #113679; padding: 1.5mm 1mm; }
    .lignes td { padding: 1.8mm 1mm; border-bottom: 0.2mm solid #DDE2EA; vertical-align: top; }
    .lignes .n { text-align: right; white-space: nowrap; }
    .lignes tfoot td { font-weight: bold; font-size: 11pt; border-bottom: none; border-top: 0.4mm solid #113679; padding-top: 2.5mm; }
    .msg { margin: 5mm 0 0; font-size: 10pt; }
    .cond { margin: 4mm 0 0; font-size: 9pt; color: #444; }
    .filigrane { position: absolute; top: 120mm; left: 0; right: 0; text-align: center; font-size: 60pt; font-weight: bold; color: rgba(200, 30, 30, 0.12); transform: rotate(-24deg); pointer-events: none; }
    /* Section paiement — dimensions SIX */
    .bulletin { position: absolute; left: 0; bottom: 0; width: 210mm; height: 105mm; border-top: 0.2mm dashed #000; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .detacher { position: absolute; top: -4mm; left: 0; right: 0; text-align: center; font-size: 7pt; color: #000; }
    .ciseaux { position: absolute; left: 4mm; top: 1.2mm; font-size: 10pt; line-height: 1; }
    .recu { position: absolute; left: 0; top: 0; width: 62mm; height: 105mm; border-right: 0.2mm dashed #000; }
    .recu::after { content: '✂'; position: absolute; right: -2.1mm; top: 6mm; font-size: 10pt; transform: rotate(90deg); background: #fff; line-height: 1; }
    .paiement { position: absolute; left: 62mm; top: 0; width: 148mm; height: 105mm; }
    .titre { position: absolute; top: 5mm; left: 5mm; font-size: 11pt; font-weight: bold; }
    .rub { font-weight: bold; }
    .recu .rub { font-size: 6pt; line-height: 9pt; }
    .recu .val { font-size: 8pt; line-height: 9pt; margin-bottom: 9pt; }
    .paiement .rub { font-size: 8pt; line-height: 11pt; }
    .paiement .val { font-size: 10pt; line-height: 11pt; margin-bottom: 11pt; }
    .r-info { position: absolute; top: 12mm; left: 5mm; width: 52mm; height: 56mm; overflow: hidden; }
    .r-montant { position: absolute; top: 68mm; left: 5mm; width: 52mm; height: 14mm; display: flex; gap: 5mm; }
    .r-montant > div:first-child { width: 12mm; }
    .r-depot { position: absolute; top: 82mm; right: 5mm; font-size: 6pt; font-weight: bold; }
    .qr { position: absolute; top: 17mm; left: 5mm; width: 46mm; height: 46mm; }
    .qr svg { display: block; width: 46mm; height: 46mm; }
    .qr-vide { width: 46mm; height: 46mm; border: 0.3mm dashed #C33; color: #C33; font-size: 7pt; line-height: 1.3; padding: 3mm; display: flex; align-items: center; text-align: center; }
    .p-montant { position: absolute; top: 68mm; left: 5mm; width: 46mm; height: 22mm; display: flex; gap: 5mm; }
    .p-montant > div:first-child { width: 14mm; }
    .p-info { position: absolute; top: 5mm; left: 56mm; width: 87mm; height: 95mm; overflow: hidden; }
    .coins { display: block; }
    @media print { html, body { background: #fff; } .page { margin: 0; } }
  </style></head><body><script>(function(){var t=${JSON.stringify(titre).replace(/</g, '\\u003c')};document.title=t;var e=document.querySelector('title');if(e)new MutationObserver(function(){if(document.title!==t)document.title=t;}).observe(e,{childList:true,characterData:true,subtree:true});})();<\/script>${page1}${page2}${opt.imprimer ?'<script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script>' : ''}</body></html>`;
}

async function fqrImprimerFacture(f) {
  const P = _fqr.params || {};
  const ok = await fqrChargerQrLib();
  if (!ok) { showError('Générateur de code QR indisponible : vérifie la connexion puis réessaie.'); return; }
  const err = fqrErreursFacture(f, P);
  if (err.length) { showError('Impression impossible : ' + err[0]); return; }
  const html = fqrDocumentHtml(f, P, { imprimer: true });
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  if (!w) showError('Autorise les fenêtres pop-up pour afficher le PDF.');
}
function fqrImprimer(id) { const f = fqrTrouver(id); if (f) fqrImprimerFacture(f); }
function fqrImprimerEditeur() { if (_fqr.ed) fqrImprimerFacture(fqrEdFacture()); }

// ── Export Excel ────────────────────────────────────────────────────────────────────────────
function fqrExporterExcel() {
  if (typeof XLSX === 'undefined' || !XLSX.utils || !XLSX.writeFile) { showError('Export Excel indisponible (bibliothèque non chargée).'); return; }
  if (!_fqr.factures.length) { showError('Aucune facture à exporter.'); return; }
  const auj = fqrIso(new Date());
  const lignes = _fqr.factures.map(f => ({
    'Numéro': f.numero || '',
    'Débiteur': f.debiteur?.nom || '',
    'Localité': [f.debiteur?.npa, f.debiteur?.ville].filter(Boolean).join(' '),
    'Date': f.date_emission || '',
    'Échéance': f.date_echeance || '',
    'Montant': Number(f.montant || 0),
    'Monnaie': f.devise,
    'Statut': (FQR_STATUTS[fqrStatut(f, auj)] || [f.statut])[0],
    'Payée le': f.paye_le || '',
    'Référence': fqrFmtReference(f.reference),
    'Message': f.message || '',
    'Prestations': (f.lignes || []).map(l => l.libelle).filter(Boolean).join(' ; '),
  }));
  const ws = XLSX.utils.json_to_sheet(lignes);
  ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 8 }, { wch: 11 }, { wch: 11 }, { wch: 34 }, { wch: 40 }, { wch: 50 }];
  Object.keys(ws).forEach(k => { if (k[0] !== '!' && typeof ws[k].v === 'number') ws[k].z = '#,##0.00'; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Factures');
  XLSX.writeFile(wb, `factures_${auj}.xlsx`);
}

// ── Autotest (console : fqrAutotest()) ──────────────────────────────────────────────────────
// Vérifie les calculs normés sur les exemples publiés (SIX, ISO 11649, IBAN public) et la
// structure du payload. Le test du code QR ne tourne que si la bibliothèque est déjà chargée.
function fqrAutotest() {
  const res = [];
  const t = (nom, ok, detail = '') => res.push({ test: nom, ok: !!ok, detail });
  const qrr = '210000000003139471430009017';
  t('QRR — chiffre de contrôle de 21 00000 00003 13947 14300 0901·', fqrCleMod10(qrr.slice(0, 26)) === '7', `calculé : ${fqrCleMod10(qrr.slice(0, 26))}`);
  t('QRR — référence 21 00000 00003 13947 14300 09017 valide', fqrQrrValide('21 00000 00003 13947 14300 09017'));
  t('QRR — chiffre de contrôle faux détecté', !fqrQrrValide('21 00000 00003 13947 14300 09018'));
  t('QRR — création depuis 26 chiffres', fqrQrrCreer(qrr.slice(0, 26)) === qrr);
  t('QRR — groupement 2 + 5×5', fqrFmtReference(qrr) === '21 00000 00003 13947 14300 09017', fqrFmtReference(qrr));
  t('RF — RF18 5390 0754 7034 valide (modulo 97)', fqrRfValide('RF18 5390 0754 7034'));
  t('RF — création depuis 539007547034', fqrRfCreer('539007547034') === 'RF18539007547034', fqrRfCreer('539007547034'));
  t('RF — chiffres de contrôle faux détectés', !fqrRfValide('RF19 5390 0754 7034'));
  t('IBAN — CH93 0076 2011 6238 5295 7 valide', fqrIbanValide('CH93 0076 2011 6238 5295 7'));
  t('IBAN — chiffre modifié refusé', !fqrIbanValide('CH93 0076 2011 6238 5295 8'));
  t('IBAN — longueur incorrecte refusée', !fqrIbanValide('CH93 0076 2011 6238 5295'));
  t('IBAN — pays hors CH/LI refusé', !fqrIbanValide('DE89 3704 0044 0532 0130 00'));
  t('IBAN — CH93… n’est pas un QR-IBAN', !fqrEstQrIban('CH9300762011623852957'));
  t('QR-IBAN — CH44 3199 9123 0008 8901 2 valide et détecté (IID 31999)', fqrIbanValide('CH4431999123000889012') && fqrEstQrIban('CH4431999123000889012'));
  t('Montant — 1234.5 → « 1 234.50 »', fqrFmtMontant(1234.5) === '1 234.50', fqrFmtMontant(1234.5));
  t('Montant — 1234567.5 → « 1 234 567.50 »', fqrFmtMontant(1234567.5) === '1 234 567.50', fqrFmtMontant(1234567.5));
  t('IBAN — groupement par 4', fqrFmtIban('CH9300762011623852957') === 'CH93 0076 2011 6238 5295 7');

  // Payload : données fictives
  const cre = { nom: 'Exemple Créancier Sàrl', rue: 'Rue de l’Exemple', numero: '1', npa: '1000', ville: 'Lausanne', pays: 'CH' };
  const deb = { nom: 'Débiteur Fictif SA', rue: 'Chemin Test', numero: '99', npa: '1200', ville: 'Genève', pays: 'CH' };
  const p = fqrPayload({ iban: 'CH44 3199 9123 0008 8901 2', creancier: cre, montant: 1234.5, devise: 'CHF', debiteur: deb, reference: qrr, message: 'Facture F-2026-0001' });
  const L = p.split('\n');
  t('Payload — 31 lignes', L.length === 31, `${L.length} lignes`);
  t('Payload — en-tête SPC / 0200 / 1', L[0] === 'SPC' && L[1] === '0200' && L[2] === '1');
  t('Payload — IBAN sans espaces', L[3] === 'CH4431999123000889012');
  t('Payload — créancier structuré S', L[4] === 'S' && L[5] === cre.nom && L[6] === 'Rue de l\'Exemple' && L[7] === '1' && L[8] === '1000' && L[9] === 'Lausanne' && L[10] === 'CH');
  t('Payload — 7 lignes vides (créancier final)', L.slice(11, 18).every(x => x === ''));
  t('Payload — montant 1234.50 et monnaie CHF', L[18] === '1234.50' && L[19] === 'CHF', `${L[18]} ${L[19]}`);
  t('Payload — débiteur structuré S', L[20] === 'S' && L[21] === deb.nom && L[26] === 'CH');
  t('Payload — QRR, référence, message', L[27] === 'QRR' && L[28] === qrr && L[29] === 'Facture F-2026-0001');
  t('Payload — se termine par EPD, rien après', L[30] === 'EPD' && !p.endsWith('\n'));
  const pNon = fqrPayload({ iban: 'CH9300762011623852957', creancier: cre, montant: '', devise: 'EUR', debiteur: null, reference: '', message: '' }).split('\n');
  t('Payload — sans montant ni débiteur ni référence (NON)', pNon.length === 31 && pNon[18] === '' && pNon[19] === 'EUR' && pNon.slice(20, 27).every(x => x === '') && pNon[27] === 'NON' && pNon[28] === '');
  t('Validation facture — cohérence QR-IBAN / QRR', fqrErreursFacture({ reference: qrr, montant: 10, devise: 'CHF', debiteur: deb, message: '' }, { ...cre, qr_iban: 'CH4431999123000889012' }).length === 0);
  t('Validation facture — QR-IBAN avec RF refusé', fqrErreursFacture({ reference: 'RF18539007547034', montant: 10, devise: 'CHF', debiteur: deb }, { ...cre, iban: 'CH4431999123000889012' }).length > 0);
  t('Numéro automatique — F-2026-0008 après F-2026-0007', fqrProchainNumeroLocal(['F-2026-0007', 'F-2025-0042', 'FAC-0003'], { prefixe_numero: 'F' }, '2026-09-19') === 'F-2026-0008');
  t('Adresse — « Rue du Lac 12b » découpée', (r => r.rue === 'Rue du Lac' && r.numero === '12b')(fqrDecouperRue('Rue du Lac 12b')));

  if (typeof qrcode === 'function') {
    try {
      const M = fqrQrMatrice(p);
      t('Code QR — généré, niveau M, version ≤ 25', M && M.version >= 1 && M.version <= 25, `version ${M.version} (${M.n}×${M.n} modules)`);
      const svg = fqrQrSvg(p);
      t('Code QR — SVG 46 × 46 mm avec croix suisse', svg.includes('width="46mm"') && svg.includes('width="7" height="7"'));
    } catch (e) { t('Code QR — génération', false, e.message); }
  } else {
    res.push({ test: 'Code QR — non testé (bibliothèque pas encore chargée : fqrChargerQrLib())', ok: true, detail: 'ignoré' });
  }

  const echecs = res.filter(r => !r.ok);
  const rapport = { ok: !echecs.length, total: res.length, reussis: res.length - echecs.length, echecs: echecs.map(r => r.test), details: res };
  if (typeof console !== 'undefined' && console.table) console.table(res);
  return rapport;
}
