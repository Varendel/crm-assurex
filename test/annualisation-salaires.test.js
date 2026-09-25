// ANNUALISER LES SALAIRES POUR LES DEMANDES D'OFFRE.
// Jonathan, 25.09.2026 : « Salaire AVS à annualiser pour les demandes d'offres. »
//
// Une compagnie tarife sur la masse salariale de l'ANNÉE. Un salaire, lui, se discute au mois, et
// c'est au mois qu'il arrive sur la fiche du collaborateur (la seule fiche renseignée du CRM porte
// 3 500). Le formulaire ne disait nulle part quelle unité il attendait : 3 500 partaient tels
// quels, et l'offre revenait douze fois trop basse.
//
// La règle tient en deux lignes, et la seconde compte autant que la première :
//   · l'unité est demandée (annuels / mensuels ×12 / mensuels ×13) et la conversion se fait une
//     seule fois, juste avant l'envoi ;
//   · sans réponse, le facteur vaut 1. On transmet ce qui a été écrit. Un chiffre brut se corrige ;
//     un chiffre inventé par le CRM se propage dans toute l'offre sans que personne ne le voie.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://crm.test/', runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
window.allCompagniesContacts = [];

window.eval(['js/01-prevoyance-immo.js', 'js/02-catalogue-session.js']
  .map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n;\n'));
const { annualiserSalaire, facteurAnnualisation, libelleBaseSalaire } = window;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${a}, attendu ${e}`); }
}

// ── Les trois bases, et ce qu'elles valent ──────────────────────────────────────────────────────
check('annuel : rien à multiplier', facteurAnnualisation('annuel'), 1);
check('mensuel sur 12 mois', facteurAnnualisation('mensuel12'), 12);
check('mensuel sur 13 mois', facteurAnnualisation('mensuel13'), 13);
check('la casse ne compte pas', facteurAnnualisation('Mensuel12'), 12);

// ── Le cas réel : la seule fiche collaborateur renseignée du CRM ────────────────────────────────
check('3 500 mensuels sur 12 mois', annualiserSalaire(3500, 'mensuel12'), 42000);
check('3 500 mensuels sur 13 mois', annualiserSalaire(3500, 'mensuel13'), 45500);
check('3 500 déjà annuels', annualiserSalaire(3500, 'annuel'), 3500);

// ── Sans réponse, AUCUNE multiplication ─────────────────────────────────────────────────────────
// C'est la moitié importante de la règle : le CRM ne devine pas l'unité d'un chiffre.
check('base absente', annualiserSalaire(3500, ''), 3500);
check('base nulle', annualiserSalaire(3500, null), 3500);
check('base inconnue', annualiserSalaire(3500, 'hebdomadaire'), 3500);
check('facteur par défaut', facteurAnnualisation(''), 1);

// ── Ce qui n'est pas un montant ne devient pas un montant ───────────────────────────────────────
check('vide', annualiserSalaire('', 'mensuel12'), 0);
check('null', annualiserSalaire(null, 'mensuel12'), 0);
check('texte', annualiserSalaire('beaucoup', 'mensuel12'), 0);
check('zéro reste zéro', annualiserSalaire(0, 'mensuel13'), 0);

// ── Les centimes ne dérivent pas ────────────────────────────────────────────────────────────────
check('arrondi au centime', annualiserSalaire(4166.665, 'mensuel12'), 49999.98);
check('chaîne numérique', annualiserSalaire('5250.50', 'mensuel12'), 63006);

// ── Ce que l'utilisateur lit ────────────────────────────────────────────────────────────────────
check('libellé 13e salaire', /13/.test(libelleBaseSalaire('mensuel13')), true);
check('libellé inconnu : rien d’inventé', libelleBaseSalaire('hebdomadaire'), '');

// ── L'e-mail annonce des montants ANNUELS ───────────────────────────────────────────────────────
// Le chiffre juste sous une étiquette ambiguë reste un piège : les deux rédacteurs d'e-mail
// (js/26 moderne, js/07 classique) nomment la ligne « Masse salariale annuelle ».
const src26 = fs.readFileSync(path.join(ROOT, 'js/26-demande-offre.js'), 'utf8');
const src07 = fs.readFileSync(path.join(ROOT, 'js/07-fichepaie-bordereaux.js'), 'utf8');
check('js/26 : la masse est annoncée annuelle', src26.includes('Masse salariale annuelle'), true);
check('js/07 : la masse est annoncée annuelle', src07.includes('Masse salariale annuelle'), true);
check('js/26 annualise avant d’envoyer', /annualiserSalaire/.test(src26), true);
check('js/07 annualise avant d’envoyer', /annualiserSalaire/.test(src07), true);
// Le choix doit survivre à l'enregistrement : rouverte demain, la demande dirait sinon autre chose
// que ce qui est parti.
check('la base est enregistrée', /salaires_base:\s*val\('do-salaires-base'\)/.test(src07), true);
check('la base est rechargée', /setVal\('do-salaires-base'/.test(src07), true);

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
