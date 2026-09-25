// L'import des archives de décomptes (point 5) repose entièrement sur la lecture du nom de
// fichier et des dossiers qui le contiennent. Ces noms sont écrits à la main depuis deux ans :
// « BRD61 janvier 20026 Helsana », « Groupemutuel déocmpte 21.03.2025 », « BRD01 Moblière 05.2026 ».
// Les chemins ci-dessous sont les VRAIS, relevés le 25.09.2026 dans
// « OZ Assure / Décomptes commissions » et « ASSUREX / Décomptes de commissions ».
//
// Une erreur de lecture ici crée un bordereau fantôme au mauvais mois. Compagnie et période
// restent modifiables dans l'écran, mais ce que la machine propose doit être juste par défaut.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
// Le module se greffe sur viewBordereaux s'il existe ; ici il n'existe pas, la greffe est sautée.
window.eval(fs.readFileSync(path.join(ROOT, 'js/162-import-decomptes.js'), 'utf8'));
const { idcCompagnie, idcPeriode, idcNumeroBrd } = window;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${a}, attendu ${e}`); }
}

// [chemin réel, compagnie attendue, mois, année, n° BRD attendu]
const CAS = [
  // ── 2024 : nom simple, date suisse ────────────────────────────────────────────────────────
  ['2024/CSS décompte 06.11.2024.pdf', 'CSS', 11, 2024, 0],
  ['2024/Groupemutuel décompte 17.12.2024.pdf', 'Groupe Mutuel', 12, 2024, 0],
  ['2024/Helsana 20.11.2024.xlsx', 'Helsana', 11, 2024, 0],
  ['2024/SWICA versement 05.12.2024.pdf', 'SWICA', 12, 2024, 0],

  // ── 2025 : fautes de frappe comprises ─────────────────────────────────────────────────────
  ['2025/Groupemutuel déocmpte 21.03.2025.pdf', 'Groupe Mutuel', 3, 2025, 0],
  ['2025/Bâloise décomote 31.10.2025.pdf', 'Bâloise', 10, 2025, 0],
  ['2025/Allianz décompte 04.08.2025.pdf', 'Allianz', 8, 2025, 0],
  ['2025/Mobilière décompte décembre 2025.pdf', 'La Mobilière', 12, 2025, 0],
  ['2025/Mobilière décompte septembre 2025.pdf', 'La Mobilière', 9, 2025, 0],
  ['2025/BRD62  décembre 2025Helsana.pdf', 'Helsana', 12, 2025, 62],

  // ── 2026 : le mois est dans le dossier, pas dans le nom ───────────────────────────────────
  ['2026/01 Janvier/BRD67 01.26 AXA .pdf', 'AXA', 1, 2026, 67],
  ['2026/03 Mars/BRD68 03.26 AXA.pdf', 'AXA', 3, 2026, 68],
  ['2026/04 Avril/BRD69 04.26 AXA.pdf', 'AXA', 4, 2026, 69],
  ['2026/BRD SL 07.2026.pdf', 'Swiss Life', 7, 2026, 0],
  ['2026/05 Mai/BRD 74 mai 2026 Mobilière.pdf', 'La Mobilière', 5, 2026, 74],

  // ── L'année mal tapée : « 20026 » pour 2026 ───────────────────────────────────────────────
  ['2026/01 Janvier/BRD61 janvier 20026 Helsana.pdf', 'Helsana', 1, 2026, 61],

  // ── Une plage de dates : c'est la FIN qui date le décompte ─────────────────────────────────
  ['2026/04 Avril/BRD 56 01.04-30.04.2026 Vaudoise.pdf', 'La Vaudoise', 4, 2026, 56],
  ['2026/02 Février/BRD48 01.02.-28.02.2026 Vaudoise .pdf', 'La Vaudoise', 2, 2026, 48],
  ['2026/06 Juin/01.06-30.06.26 Liste_Comm_courtier_32_1809_2026-06-29_FR_12290713.xlsx', '', 6, 2026, 0],

  // ── Les exports Vaudoise, datés en ISO au milieu du nom ────────────────────────────────────
  ['Traités/vaudoiseListe_Comm_courtier_32_2299_2026-07-30_FR_12295375.xlsx', 'La Vaudoise', 7, 2026, 0],
  ['Traités/VaudoiseListe_Comm_courtier_32_2299_2026-08-28_FR_12300161 (002).xlsx', 'La Vaudoise', 8, 2026, 0],

  // ── Les noms les plus abîmés du lot ────────────────────────────────────────────────────────
  ['Traités/Mobilière/BRD01 Moblière 05.2026.pdf', 'La Mobilière', 5, 2026, 1],
  ['Traités/Orion BRD75.xlsx', 'Orion', 0, 0, 75],
  ['BRD Groupe Mutuel septembre 2026.pdf', 'Groupe Mutuel', 9, 2026, 0],
  ['BRD AXA aout 2026.pdf', 'AXA', 8, 2026, 0],
  ['BRD72 octobre 2025 Baloise.pdf', 'Bâloise', 10, 2025, 72],
  ['2026/04 Avril/BRD70 avril 2026 fondation NEST.pdf', 'Nest', 4, 2026, 70],
];

for (const [chemin, cie, mois, annee, brd] of CAS) {
  const court = chemin.split('/').pop().slice(0, 44);
  check(`compagnie · ${court}`, idcCompagnie(chemin), cie);
  check(`période  · ${court}`, idcPeriode(chemin), { mois, annee });
  check(`n° BRD   · ${court}`, idcNumeroBrd(chemin), brd);
}

// Une année hors plage plausible ne doit jamais sortir : mieux vaut « à compléter » qu'un faux mois.
check('année absurde rejetée', idcPeriode('décompte 12.1899.pdf').annee, 0);
check('rien à lire', idcPeriode('scan0001.pdf'), { mois: 0, annee: 0 });
check('compagnie inconnue', idcCompagnie('décompte 01.2026.pdf'), '');

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
