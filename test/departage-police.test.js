// Départage à numéro de police égal — demande de Jonathan, restée trois fois en plan avant le
// 25.09.2026. Plusieurs contrats du portefeuille partagent un même numéro : véhicule (RC + casco
// partielle + casco complète), santé (LAMal + complémentaire), entreprise (LAA + perte de gain),
// et le cas qui l'avait fait remonter — la police Groupe Mutuel 7623523, qui porte à la fois une
// « Complémentaire santé » et un « RC + inventaire du ménage ».
//
// On vérifie ici que scoreBrancheImport range la ligne du décompte sur le bon contrat, pas sur
// celui qui se trouve en tête de allContrats.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
window.localStorage = { getItem: () => null, setItem: () => {} };
// scoreBrancheImport s'appuie sur estStatutResilieOuAnnule, défini ailleurs dans le CRM.
window.estStatutResilieOuAnnule = s => /resili|annul/i.test(String(s || ''));

const src = fs.readFileSync(path.join(ROOT, 'js/06-signature-opportunites.js'), 'utf8');
window.eval(src);
const { marqueursBranche, scoreBrancheImport } = window;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)}`); }
}

// Le contrat que le départage doit désigner, parmi ceux qui partagent la police.
function gagnant(candidats, brancheDecompte) {
  return candidats.reduce((m, c) => {
    const s = scoreBrancheImport(c, brancheDecompte);
    return s > m.s ? { c, s } : m;
  }, { c: candidats[0], s: -Infinity }).c.produit;
}

const A = (produit, statut = 'actif') => ({ produit, statut });

// ── Police 7623523, Groupe Mutuel ──────────────────────────────────────────────────────────
// L'ordre du tableau est volontairement celui qui faisait échouer le rapprochement : le ménage
// d'abord, alors que la ligne du décompte est une ligne santé.
const gm7623523 = [A('RC + inventaire du ménage'), A('Complémentaire santé')];
check('GM 7623523 — ligne « Hospita Flex » -> complémentaire santé',
  gagnant(gm7623523, 'Hospita Flex'), 'Complémentaire santé');
check('GM 7623523 — ligne « Global Care » -> complémentaire santé',
  gagnant(gm7623523, 'Global Care'), 'Complémentaire santé');
check('GM 7623523 — ligne « RC privée et inventaire du ménage » -> ménage',
  gagnant(gm7623523, 'RC privée et inventaire du ménage'), 'RC + inventaire du ménage');

// ── LAMal et complémentaire sous un même numéro (Helsana, CSS, Groupe Mutuel) ───────────────
const sante = [A('Complémentaire santé'), A('LAMal')];
check('LAMal — ligne « Assurance obligatoire des soins » -> LAMal',
  gagnant(sante, 'Assurance obligatoire des soins'), 'LAMal');
check('LAMal — ligne « AOS franchise 2500 » -> LAMal',
  gagnant(sante, 'AOS franchise 2500'), 'LAMal');
check('LCA — ligne « Complémentaire santé Hospita » -> complémentaire',
  gagnant(sante, 'Complémentaire santé Hospita'), 'Complémentaire santé');

// ── LAA et perte de gain sous un même numéro (SWICA 0654.0357, Vaudoise) ────────────────────
const entreprise = [
  A('Perte de gain accident collective (complémentaire LAA)'),
  A('LAA (assurance-accidents obligatoire)'),
  A('Perte de gain maladie collective'),
];
check('Entreprise — ligne « LAA obligatoire » -> LAA',
  gagnant(entreprise, 'LAA obligatoire'), 'LAA (assurance-accidents obligatoire)');
check('Entreprise — ligne « Perte de gain maladie » -> PGM',
  gagnant(entreprise, 'Indemnités journalières maladie'), 'Perte de gain maladie collective');

// ── Véhicule : le comportement d'origine ne doit pas bouger ─────────────────────────────────
const vehicule = [A('Casco complète'), A('Casco partielle'), A('RC véhicule (obligatoire)')];
check('Véhicule — ligne « Ass. RC Avenue » -> RC',
  gagnant(vehicule, 'Ass. RC Avenue'), 'RC véhicule (obligatoire)');
check('Véhicule — ligne « Casco segmentée vol » -> casco partielle',
  gagnant(vehicule, 'Casco segmentée vol'), 'Casco partielle');
check('Véhicule — ligne « Casco collision » -> casco complète',
  gagnant(vehicule, 'Casco collision'), 'Casco complète');

// ── Un contrat résilié ne doit pas l'emporter sur un contrat actif de la même branche ───────
const avecResilie = [A('Complémentaire santé', 'résilié'), A('Complémentaire santé', 'actif')];
check('Un contrat résilié ne prime pas sur un actif de même branche',
  scoreBrancheImport(avecResilie[1], 'Hospita') > scoreBrancheImport(avecResilie[0], 'Hospita'), true);

// ── Marqueurs : contrôles unitaires des familles ajoutées ───────────────────────────────────
check('marqueursBranche(« LAMal ») contient lamal', marqueursBranche('LAMal').has('lamal'), true);
check('marqueursBranche(« LAMal ») ne contient pas lca', marqueursBranche('LAMal').has('lca'), false);
check('marqueursBranche(« rente IG ») contient vie', marqueursBranche('rente IG').has('vie'), true);
check('marqueursBranche(« LPP collective ») contient lpp', marqueursBranche('LPP collective').has('lpp'), true);

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
