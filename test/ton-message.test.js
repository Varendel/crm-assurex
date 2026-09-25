// showError sert à tout dans le CRM : erreurs, confirmations « ✓ … », attentes « ⏳ … ».
// Jusqu'au 25.09.2026 tout s'affichait en rouge avec un ⚠, et tout partait dans journal_erreurs
// (41 entrées « ⏳ Upload en cours… » y noyaient les vraies erreurs).
// tonDuMessage (js/00) est le seul juge : l'affichage et le journal s'y tiennent tous les deux.
// Ce test garde la convention — c'est elle qui décide ce qui vaut alerte.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.location = window.location;

window.eval(fs.readFileSync(path.join(ROOT, 'js/00-journal-erreurs.js'), 'utf8'));
const ton = window.tonDuMessage;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)}`); }
}

// ── Les messages réellement présents dans journal_erreurs au 25.09.2026 ────────────────────────
['⏳ Upload de l’offre en cours...', '⏳ Enregistrement de l’offre…', '⏳ Envoi en cours...',
 '⏳ Synchronisation EcoHub en cours…', '⏳ Upload en cours...', '⏳ Envoi du mandat…',
 '⏳ Lecture de ta signature dans tes e-mails envoyés…', '⏳ Préparation du mandat…',
].forEach(m => check(`attente : ${m.slice(0, 34)}`, ton(m), 'info'));

// ── Les confirmations : 131 occurrences de « ✓ » dans le code ──────────────────────────────────
check('✓ mandat importé', ton('✓ 12 mandats importés sur les fiches.'), 'succes');
check('✓ signalement', ton('✓ Signalement envoyé — dis à Claude « regarde le journal ».'), 'succes');
check('✓ avec espace devant', ton('  ✓ Enregistré'), 'succes');

// ── Les vraies erreurs, qui doivent rester rouges ET journalisées ──────────────────────────────
[ "Erreur lors de l'envoi du fichier.",
  'Aucun client rattaché — le personnel est fiché sur le client.',
  'Formats acceptés : PDF, JPEG, PNG, HEIC, WEBP.',
  'Fichier trop lourd — maximum 15 Mo.',
  'Échec de chargement',
  'Email et mot de passe requis.',
].forEach(m => check(`erreur : ${m.slice(0, 34)}`, ton(m), 'erreur'));

// Un avertissement reste une erreur : il appelle une action, et on veut le retrouver au journal.
check('⚠️ contrat non commissionné', ton('⚠️ Fichier archivé, mais pas rattaché au bordereau'), 'erreur');

// ── Cas limites : rien ne doit jeter ───────────────────────────────────────────────────────────
check('chaîne vide', ton(''), 'erreur');
check('null', ton(null), 'erreur');
check('undefined', ton(undefined), 'erreur');
check('nombre', ton(404), 'erreur');
// Un ✓ au milieu du message n'est pas une confirmation : c'est le début qui porte le ton.
check('✓ au milieu ne compte pas', ton('Impossible de valider ✓ la ligne'), 'erreur');

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
