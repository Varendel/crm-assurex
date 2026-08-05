const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
window.allCompagniesContacts = [];
window.localStorage = { getItem: () => null, setItem: () => {} };

const combined = ['js/01-prevoyance-immo.js', 'js/02-catalogue-session.js', 'js/09-rappels-vehicules.js']
  .map(p => fs.readFileSync(path.join(ROOT, p), 'utf8'))
  .join('\n;\n');
window.eval(combined);

const getCompagniesConnues = window.getCompagniesConnues;
const compagniePertinentePourProduit = window.compagniePertinentePourProduit;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${actual}, attendu ${expected}`); }
}

// RC véhicule (rc_vehicule) : doit exclure Swiss Life, HOTELA, CSS, CAP, goCaution, Helsana, SUVA, PAX...
// et garder AXA, La Vaudoise, Zurich, Baloise, La Mobilière, Allianz, Generali
const suggRCVehicule = getCompagniesConnues('rc_vehicule');
console.log('  RC véhicule ->', suggRCVehicule.join(', '));
['Swiss Life','HOTELA','Gastrosocial','CSS','CAP','goCaution','SwissCaution','Helsana','Sanitas','SUVA','Visana','SWICA','Groupe Mutuel'].forEach(c => {
  check(`RC véhicule EXCLUT ${c}`, suggRCVehicule.includes(c), false);
});
['AXA','Zurich','Baloise','Allianz','Generali'].forEach(c => {
  check(`RC véhicule GARDE ${c}`, suggRCVehicule.includes(c), true);
});

// LAMal : doit exclure AXA, Zurich, Swiss Life, HOTELA, SUVA, CAP, goCaution... et garder Helsana/CSS/Visana/SWICA/Groupe Mutuel/Sanitas
const suggLamal = getCompagniesConnues('lamal');
console.log('  LAMal ->', suggLamal.join(', '));
['AXA','Zurich','Baloise','Allianz','Swiss Life','HOTELA','SUVA','CAP','goCaution'].forEach(c => {
  check(`LAMal EXCLUT ${c}`, suggLamal.includes(c), false);
});
['Helsana','CSS','Visana','SWICA','Groupe Mutuel','Sanitas'].forEach(c => {
  check(`LAMal GARDE ${c}`, suggLamal.includes(c), true);
});

// Vie 3a : doit exclure Helsana/CSS/HOTELA/SUVA/CAP/goCaution et garder Swiss Life/AXA/Zurich/PAX(si présent)
const suggVie = getCompagniesConnues('vie_3a');
console.log('  Vie 3a ->', suggVie.join(', '));
['Helsana','CSS','HOTELA','Gastrosocial','SUVA','CAP','goCaution','Visana','SWICA','Groupe Mutuel'].forEach(c => {
  check(`Vie 3a EXCLUT ${c}`, suggVie.includes(c), false);
});
['Swiss Life','AXA','Zurich','Baloise'].forEach(c => {
  check(`Vie 3a GARDE ${c}`, suggVie.includes(c), true);
});

// Caution de loyer : doit exclure Swiss Life/Helsana/AXA... garder goCaution/SwissCaution/FirstCaution/SmartCaution
const suggCaution = getCompagniesConnues('caution_bail_prive');
console.log('  Caution ->', suggCaution.join(', '));
['Swiss Life','Helsana','HOTELA','SUVA','CAP'].forEach(c => {
  check(`Caution EXCLUT ${c}`, suggCaution.includes(c), false);
});
['goCaution','SwissCaution','FirstCaution','SmartCaution'].forEach(c => {
  check(`Caution GARDE ${c}`, suggCaution.includes(c), true);
});

// Aucun filtre (pas de produit / produit 'autre') : toutes les compagnies visibles
const suggToutes = getCompagniesConnues();
check(`Sans produit : AXA visible`, suggToutes.includes('AXA'), true);
check(`Sans produit : Swiss Life visible`, suggToutes.includes('Swiss Life'), true);
check(`Sans produit : CSS visible`, suggToutes.includes('CSS'), true);

// Compagnie inconnue (hors table) : jamais masquée, quel que soit le produit
check(`Compagnie inconnue jamais masquée (RC véhicule)`, compagniePertinentePourProduit('Une Compagnie Jamais Vue Sàrl', 'rc_vehicule'), true);
check(`Compagnie inconnue jamais masquée (LAMal)`, compagniePertinentePourProduit('Une Compagnie Jamais Vue Sàrl', 'lamal'), true);

console.log(`\n${pass} tests passés, ${fail} échoués.`);
process.exit(fail > 0 ? 1 : 0);
