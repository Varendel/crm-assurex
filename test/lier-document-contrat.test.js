// Lier un document déposé au contrat correspondant (25.09.2026).
//
// « Les polices que je viens de déposer, ça serait pas mal de pouvoir les connecter aux polices
//   saisies et ainsi les lier. »
//
// Le cas réel qui sert de référence : Restaurant le Débarcadère St-Sulpice Sàrl, trois fichiers
// déposés à la main — laa.pdf, ijm.pdf, laac.pdf — et six contrats fichés, AUCUN avec un numéro
// de police. Le rapprochement ne peut donc se faire que sur la branche lue dans le nom du fichier.
//
// Deux exigences opposées, et la seconde compte autant que la première :
//   - laa.pdf doit trouver le contrat LAA, ijm.pdf la perte de gain maladie ;
//   - laac.pdf ne doit RIEN proposer, puisqu'aucun contrat LAAC n'existe. Un document rangé sous
//     le mauvais contrat est pire qu'un document non rangé : on cesse de le chercher.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
window.localStorage = { getItem: () => null, setItem: () => {} };
window.estStatutResilieOuAnnule = s => /resili|annul/i.test(String(s || ''));
window.estEntreprise = () => true;

// js/06 porte marqueursBranche et scoreBrancheImport, sur lesquels la suggestion s'appuie.
window.eval(fs.readFileSync(path.join(ROOT, 'js/06-signature-opportunites.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(ROOT, 'js/164-lier-document-contrat.js'), 'utf8'));
const { dlcSuggestion, dlcCelluleHtml } = window;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${a}, attendu ${e}`); }
}

// Le portefeuille réel du Débarcadère au 25.09.2026 — aucun numéro de police.
const CLIENT = '11b696f2-2144-457c-84f3-fa0df6101882';
const contrats = [
  { id: 'caution', client_id: CLIENT, produit: 'Caution de loyer — bail commercial', compagnie: 'goCaution', statut: 'actif' },
  { id: 'laa', client_id: CLIENT, produit: 'LAA (assurance-accidents obligatoire)', compagnie: 'Gastrosocial', statut: 'actif' },
  { id: 'lpp', client_id: CLIENT, produit: 'LPP collective (2e pilier entreprise)', compagnie: 'Gastrosocial', statut: 'actif' },
  { id: 'pgm', client_id: CLIENT, produit: 'Perte de gain maladie collective', compagnie: 'Gastrosocial', statut: 'actif' },
  { id: 'pj', client_id: CLIENT, produit: 'Protection juridique professionnelle / entreprise', compagnie: 'La Mobilière', statut: 'actif' },
  { id: 'rc', client_id: CLIENT, produit: 'RC entreprise / exploitation', compagnie: 'La Mobilière', statut: 'actif' },
];
const doc = (nom, extra) => Object.assign({ id: 'd', client_id: CLIENT, nom_fichier: nom, titre: 'Police — Restaurant le Débarcadère St-Sulpice Sàrl' }, extra || {});
const suggere = (nom, extra) => { const s = dlcSuggestion(doc(nom, extra), contrats); return s ? s.contrat.id : null; };

// ── Les trois fichiers réellement déposés ──────────────────────────────────────────────────────
check('laa.pdf  -> contrat LAA', suggere('laa.pdf'), 'laa');
check('ijm.pdf  -> perte de gain maladie', suggere('ijm.pdf'), 'pgm');
check('laac.pdf -> aucune suggestion', suggere('laac.pdf'), null);

// ── D'autres noms qu'on rencontre dans les dépôts ──────────────────────────────────────────────
check('« RC entreprise 2026.pdf »', suggere('RC entreprise 2026.pdf'), 'rc');
check('« protection juridique.pdf »', suggere('protection juridique.pdf'), 'pj');
check('« LPP collective.pdf »', suggere('LPP collective.pdf'), 'lpp');
check('« Perte de gain maladie.pdf »', suggere('Perte de gain maladie.pdf'), 'pgm');

// ── Ne rien proposer plutôt que proposer n'importe quoi ────────────────────────────────────────
check('« Scan_0047.pdf » -> rien', suggere('Scan_0047.pdf'), null);
check('« document.pdf » -> rien', suggere('document.pdf'), null);
check('nom vide -> rien', suggere(''), null);
check('client sans contrat -> rien', dlcSuggestion(doc('laa.pdf'), []), null);

// ── Un numéro de police identique l'emporte sur la branche ─────────────────────────────────────
const avecPolice = contrats.concat([{ id: 'vie', client_id: CLIENT, produit: 'Assurance vie liée 3a (pilier 3a)', compagnie: 'Swiss Life', numero_police: '106.128.691', statut: 'actif' }]);
const s1 = dlcSuggestion(doc('laa.pdf', { numero_police: '106 128 691' }), avecPolice);
check('même n° de police malgré un nom trompeur', s1 && s1.contrat.id, 'vie');
check('… et le motif est explicite', s1 && s1.motif, 'même numéro de police');
check('un n° de police trop court ne compte pas',
  (dlcSuggestion(doc('laa.pdf', { numero_police: '12' }), avecPolice) || {}).contrat.id, 'laa');

// ── Un contrat résilié ne doit pas gagner contre un contrat actif de la même branche ───────────
const avecResilie = [
  { id: 'laa-vieux', client_id: CLIENT, produit: 'LAA (assurance-accidents obligatoire)', compagnie: 'AXA', statut: 'résilié' },
  { id: 'laa-actif', client_id: CLIENT, produit: 'LAA (assurance-accidents obligatoire)', compagnie: 'Gastrosocial', statut: 'actif' },
];
check('le contrat actif l’emporte sur le résilié', dlcSuggestion(doc('laa.pdf'), avecResilie).contrat.id, 'laa-actif');

// ── La cellule affichée ────────────────────────────────────────────────────────────────────────
window.allContrats = contrats;
let html = dlcCelluleHtml({ id: 'd1', clientId: CLIENT, contratId: '', doc: doc('laa.pdf') });
check('un document non lié propose un bouton', html.includes('dlc-suggestion'), true);
check('le bouton nomme le contrat suggéré', html.includes('Lier à LAA'), true);
check('le select liste les six contrats', (html.match(/<option value="(?!")/g) || []).length, 6);

html = dlcCelluleHtml({ id: 'd1', clientId: CLIENT, contratId: 'laa', doc: doc('laa.pdf') });
check('un document déjà lié est marqué', html.includes('dlc-cellule lie'), true);
check('… et ne propose plus rien', html.includes('dlc-suggestion'), false);
check('… avec le bon contrat sélectionné', /value="laa" selected/.test(html), true);

html = dlcCelluleHtml({ id: 'd1', clientId: CLIENT, contratId: '', doc: doc('Scan_0047.pdf') });
check('sans suggestion, le select dit « Non lié »', html.includes('Non lié'), true);
check('… et aucun bouton n’est proposé', html.includes('dlc-suggestion'), false);

window.allContrats = [];
check('client sans contrat : la cellule le dit', dlcCelluleHtml({ id: 'd1', clientId: 'x', contratId: '', doc: doc('laa.pdf') }).includes('dlc-vide'), true);

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
