// Deux notions que le CRM avait confondues, et qu'il ne faut plus jamais confondre.
// Jonathan, 25.09.2026 : « Attention, une périodicité annuelle peut être payée trimestriellement. »
//
//   contrats.periodicite    = en combien de fois le MONTANT SAISI couvre l'année.
//                             prime_annuelle = montant saisi × periodicite. Facteur de conversion.
//   contrats.paiement_prime = le rythme auquel le client paie réellement. N'entre dans AUCUN calcul.
//
// Une première version datée du même jour avait pris la seconde pour un doublon de la première et
// renommait le champ existant « Paiement de la prime » : une prime annuelle de 1 200.- payée
// trimestriellement serait devenue une prime annuelle de 4 800.-.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
window.localStorage = { getItem: () => null, setItem: () => {} };
window.allCompagniesContacts = [];

window.eval(['js/01-prevoyance-immo.js', 'js/02-catalogue-session.js']
  .map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n;\n'));
const { libellePaiementPrime, echeancesPaiementPrime } = window;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${a}, attendu ${e}`); }
}

// ── Les quatre rythmes, et ce qu'ils valent en nombre d'appels ─────────────────────────────────
check('annuel', libellePaiementPrime('annuel'), 'Annuel');
check('semestriel', libellePaiementPrime('semestriel'), 'Semestriel');
check('trimestriel', libellePaiementPrime('trimestriel'), 'Trimestriel');
check('mensuel', libellePaiementPrime('mensuel'), 'Mensuel');
check('appels annuel', echeancesPaiementPrime('annuel'), 1);
check('appels semestriel', echeancesPaiementPrime('semestriel'), 2);
check('appels trimestriel', echeancesPaiementPrime('trimestriel'), 4);
check('appels mensuel', echeancesPaiementPrime('mensuel'), 12);
check('la casse ne compte pas', libellePaiementPrime('Trimestriel'), 'Trimestriel');

// ── Non renseigné : on ne comble JAMAIS par un défaut ──────────────────────────────────────────
// Les 63 contrats en base ont paiement_prime à null ; afficher « Annuel » serait une affirmation
// que personne n'a faite, et sur laquelle Jonathan se réglerait pour appeler un client.
check('vide -> pas de libellé', libellePaiementPrime(''), '');
check('null -> pas de libellé', libellePaiementPrime(null), '');
check('undefined -> pas de libellé', libellePaiementPrime(undefined), '');
check('valeur inconnue -> pas de libellé', libellePaiementPrime('bimestriel'), '');
check('vide -> aucun appel connu', echeancesPaiementPrime(null), 0);

// ── Le vocabulaire est le même que celui de la demande d'offre (do-paiement-prime, js/26) ──────
// Une valeur écrite là-bas et inconnue ici ressortirait sans libellé sur la fiche du contrat.
// (PAIEMENTS_PRIME est un `const` de premier niveau : il vit dans la portée lexicale globale,
// visible des scripts suivants dans le navigateur, mais pas depuis ce test — on interroge donc
// les fonctions plutôt que le tableau.)
['annuel', 'semestriel', 'trimestriel', 'mensuel'].forEach(v => {
  check(`la demande d’offre peut écrire « ${v} »`, libellePaiementPrime(v) !== '', true);
});

// ── Ce que la confusion produisait : la prime annuelle ne dépend QUE de periodicite ────────────
// Reproduction du calcul de creerContratEtCommission (js/09) et de saveEditContrat (js/08).
const primeAnnuelle = (montantSaisi, periodicite) => Math.round(montantSaisi * periodicite * 100) / 100;
check('1 200.- saisis pour l’année entière -> 1 200.-', primeAnnuelle(1200, 1), 1200);
check('300.- saisis pour un trimestre -> 1 200.-', primeAnnuelle(300, 4), 1200);
check('100.- saisis pour un mois -> 1 200.-', primeAnnuelle(100, 12), 1200);
// Le cas de Jonathan : prime annuelle saisie en une fois, payée en quatre appels. La périodicité
// reste 1 — c'est paiement_prime qui porte le trimestriel, et la prime ne bouge pas.
check('prime annuelle payée trimestriellement : la prime reste 1 200.-', primeAnnuelle(1200, 1), 1200);
check('… et l’appel vaut 300.-', Math.round(1200 / echeancesPaiementPrime('trimestriel') * 100) / 100, 300);

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
