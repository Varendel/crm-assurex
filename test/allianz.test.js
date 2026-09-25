// ALLIANZ — barème V30 (vie individuelle) et taux non-vie observés.
//
// Le 25.09.2026, l'audit des estimations a montré un taux effectif de 35,22 % sur la RC véhicule
// Allianz : une seule ligne aberrante (Claire Emery, prime 951.20, estimation 1 091.- — plus
// élevée que la prime) tirait toute la moyenne. Les autres lignes étaient au repli générique
// de 10 %, c'est-à-dire à rien.
//
// Jonathan a fourni le contrat de collaboration (02.05.2025) et le tableau V30. Ils donnent la
// vraie mécanique : Allianz multiplie un barème de base par un FACTEUR DE RÉMUNÉRATION propre à
// l'intermédiaire — pour OZ Assure : non-vie 1.8, vie individuelle 0.9, vie collective 1.0.
//
// Ce test fige la formule et, surtout, la distinction entre les bases de prime : confondre PAN
// (prime d'une année) et VNP (prime × durée) multiplie une estimation par trente.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
window.localStorage = { getItem: () => null, setItem: () => {} };

const SOURCE = fs.readFileSync(path.join(ROOT, 'js/01-prevoyance-immo.js'), 'utf8');
window.eval(SOURCE);
const { allianzCommissionVie, allianzTauxNonVie } = window;
// TAUX_COMMISSION est un `const` de premier niveau : il vit dans la portée lexicale globale,
// visible des scripts suivants dans le navigateur, mais pas depuis ce test. Les valeurs du
// contrat se vérifient donc dans la source — c'est justement ce qu'on veut figer : elles
// viennent d'un document signé, elles ne doivent pas dériver en silence.
const contient = t => SOURCE.includes(t);

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${a}, attendu ${e}`); }
}

// ── Les facteurs du contrat signé : c'est la donnée qui manquait ───────────────────────────────
check('facteurs de rémunération du contrat du 02.05.2025',
  contient('facteur_nv: 1.8, facteur_vi: 0.9, facteur_vc: 1.0'), true);
check('taux du barème V30, en pour mille', contient('taux_pour_mille: 50'), true);
check('édition du contrat citée', contient("edition_contrat: '02.05.2025'"), true);

// ── Base PAN : la prime d'UNE année ────────────────────────────────────────────────────────────
// Smart Invest, facteur 1.00 : 3 000 × 1.00 × 50 ‰ × 0.9 = 135.-
check('Smart Invest, prime 3 000.-', allianzCommissionVie('smart_invest', 3000, 30).montant, 135);
// Assurance mixte PP, facteur 0.80 : 3 000 × 0.80 × 0.05 × 0.9 = 108.-
check('Mixte PP, prime 3 000.-', allianzCommissionVie('mixte_pp', 3000, 30).montant, 108);
// Rente d'incapacité de gain, facteur 1.20 : 1 053.70 × 1.20 × 0.05 × 0.9 = 56.90
check('Rente IG, prime 1 053.70', allianzCommissionVie('rente_ig', 1053.7, 30).montant, 56.9);
// Libération des primes, facteur 0.50 : 1 000 × 0.50 × 0.05 × 0.9 = 22.50
check('Libération des primes, prime 1 000.-', allianzCommissionVie('liberation_primes', 1000, 30).montant, 22.5);

// Sur une base PAN, la durée ne change RIEN. C'est le point qui fait la différence entre une
// estimation juste et une estimation trente fois trop grosse.
check('PAN : 30 ans ne change pas le montant',
  allianzCommissionVie('smart_invest', 3000, 30).montant,
  allianzCommissionVie('smart_invest', 3000, 1).montant);

// ── Base VNP : prime × durée, le capital de production ─────────────────────────────────────────
// Balance Invest PP, facteur 0.85, 20 ans : 3 000 × 20 × 0.85 × 0.05 × 0.9 = 2 295.-
check('Balance Invest PP, 3 000.- sur 20 ans', allianzCommissionVie('balance_invest_pp', 3000, 20).montant, 2295);
// La durée est plafonnée à 30 ans : 40 ans doit donner le même montant que 30.
check('VNP : la durée est plafonnée à 30 ans',
  allianzCommissionVie('balance_invest_pp', 3000, 40).montant,
  allianzCommissionVie('balance_invest_pp', 3000, 30).montant);
// Flex Saving, facteur 1.35, 25 ans : 2 000 × 25 × 1.35 × 0.05 × 0.9 = 3 037.50
check('Flex Saving, 2 000.- sur 25 ans', allianzCommissionVie('flex_saving', 2000, 25).montant, 3037.5);
// Une durée absurde ou absente vaut 1 an, jamais 0 : mieux vaut sous-estimer que renvoyer zéro.
check('VNP sans durée = 1 an', allianzCommissionVie('balance_invest_pp', 3000, 0).montant, 114.75);

// ── Smart Invest va jusqu'à 35 ans, les autres à 30 ─────────────────────────────────────────────
check('Smart Invest : durée max 35 ans', contient("smart_invest:        { facteur: 1.00, base: 'PAN', duree_max: 35"), true);

// ── Produit inconnu : on retombe sur le défaut, pas sur zéro ni sur une erreur ──────────────────
check('produit inconnu -> facteur par défaut 0.80', allianzCommissionVie('jamais_vu', 1000, 10).montant, 36);
check('prime nulle -> null', allianzCommissionVie('smart_invest', 0, 10), null);

// ── Non-vie : taux OBSERVÉS sur les versements réels, le barème T03 manquant au dossier ────────
check('le barème non-vie manquant est nommé', contient("bareme_manquant: 'T03'"), true);
check('RC véhicule', allianzTauxNonVie('RC véhicule (obligatoire)').taux, 12.3);
check('Casco partielle suit le véhicule', allianzTauxNonVie('Casco partielle').taux, 12.3);
check('LAA', allianzTauxNonVie('LAA (assurance-accidents obligatoire)').taux, 8.2);
check('RC entreprise', allianzTauxNonVie('RC entreprise / exploitation').taux, 31.12);
check('branche inconnue -> défaut observé', allianzTauxNonVie('Assurance chiens').taux, 12.3);
// « RC véhicule » contient « RC » : il doit sortir en véhicule, pas en RC entreprise.
check('RC véhicule ne bascule pas en RC entreprise', allianzTauxNonVie('RC véhicule (obligatoire)').nom, 'véhicule');

// ── Le cas qui a déclenché tout ça ─────────────────────────────────────────────────────────────
// Claire Emery : prime 951.20, estimation enregistrée 1 091.-, montant réellement versé 116.96.
// Le taux observé donne 117.-, à quatre centimes du versement.
const emery = Math.round(951.2 * allianzTauxNonVie('RC véhicule (obligatoire)').taux / 100 * 100) / 100;
check('Claire Emery : l’estimation retombe sur le versement réel', Math.abs(emery - 116.96) < 0.50, true);
check('… et n’est plus 1 091.-', emery < 200, true);

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
