// Test exécutable du calcul de commission par compagnie, contre le VRAI code de production
// (chargé tel quel depuis js/01-prevoyance-immo.js, js/02-catalogue-session.js, js/09-rappels-vehicules.js).
// Objectif : vérifier que calculerCommissionEstimee() / _commissionParLignes() produisent des
// montants exacts, avec des cas de référence tirés de sources réelles (relevé de commission
// Vaudoise réel, tableau de courtage AXA du contrat signé).

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <input id="ct-compagnie" value="" />
  <select id="ct-categorie"><option value="prive">prive</option><option value="entreprise">entreprise</option></select>
  <input id="ct-produit" value="" />
  <select id="ct-periodicite"><option value="12">12</option><option value="1" selected>1</option></select>
  <input id="ct-manuel" value="" />
  <input id="ct-prime-mensuelle" value="" />
  <div id="ct-prime-lignes-list"></div>
  <span id="ct-prime-total-affiche"></span>
  <div id="ct-prime-taxes-note"></div>
  <input id="ct-duree" value="1" />
  <div id="ct-duree-field"></div>
  <div id="ct-manuel-field"></div>
  <div id="ct-prime-risque-frais-field"></div>
  <input id="ct-prime-risque-frais" value="" />
  <div id="commission-preview-value"></div>
  <div id="commission-preview-detail"></div>
  <div id="commission-preview-label"></div>
  <input id="ct-nature-commission" value="acquisition" />
</body></html>`, { runScripts: 'outside-only' });

const { window } = dom;
global.window = window;
global.document = window.document;

// js/07 doit être chargé AVANT js/09 : il y définit PRODUITS_SANTE_X16, que le calcul de
// commission de js/09 consulte pour les complémentaires santé (prime × 16). Dans le navigateur
// l'ordre d'index.html s'en charge ; ici il faut le reproduire, sinon le test casse sur une
// ReferenceError qui n'existe pas en production (24.09.2026).
const combined = ['js/01-prevoyance-immo.js', 'js/02-catalogue-session.js', 'js/07-fichepaie-bordereaux.js', 'js/09-rappels-vehicules.js']
  .map(p => fs.readFileSync(path.join(ROOT, p), 'utf8'))
  .join('\n;\n');
window.eval(combined);

const calculerCommissionEstimee = window.calculerCommissionEstimee;
const ajouterLignePrime = window.ajouterLignePrime;
const calculerPrimeTotaleLignes = window.calculerPrimeTotaleLignes;
const refreshCategoriesLignesPrime = window.refreshCategoriesLignesPrime;

let pass = 0, fail = 0;
function reset() {
  document.getElementById('ct-prime-lignes-list').innerHTML = '';
  document.getElementById('ct-compagnie').value = '';
  document.getElementById('ct-manuel').value = '';
  document.getElementById('ct-periodicite').value = '1';
}
function setLignes(compagnie, lignes) {
  reset();
  document.getElementById('ct-compagnie').value = compagnie;
  lignes.forEach(l => ajouterLignePrime(l.libelle, l.montant));
  refreshCategoriesLignesPrime();
  calculerPrimeTotaleLignes();
}
function assertClose(actual, expected, label, tol = 0.05) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { pass++; console.log(`PASS  ${label}: ${actual} ≈ ${expected}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${actual}, attendu ${expected}`); }
}

// ═══ 1. VAUDOISE — vérifié contre le vrai relevé de commission courtier
// (vaudoiseListe_Comm_courtier_32_2299_2026-07-30, PERléman SA + Dark Yeti Sàrl) ═══

setLignes('La Vaudoise', [{ libelle: 'RC Avenue véhicule', montant: 433.4 }]);
{
  const r = calculerCommissionEstimee();
  assertClose(r.montant, 17.34, 'Vaudoise RC véhicule 433.4 × 4%');
}

setLignes('La Vaudoise', [{ libelle: 'Casco AVENUE segmentée vol', montant: 226 }]);
{
  const r = calculerCommissionEstimee();
  assertClose(r.montant, 33.9, 'Vaudoise Casco partielle (vol) 226 × 15%');
}

setLignes('La Vaudoise', [{ libelle: 'Casco AVENUE segmentée collision', montant: 279.6 }]);
{
  const r = calculerCommissionEstimee();
  assertClose(r.montant, 33.55, 'Vaudoise Casco complète (collision) 279.6 × 12%');
}

setLignes('La Vaudoise', [{ libelle: 'Assurance accidents des occupants', montant: 45.2 }]);
{
  const r = calculerCommissionEstimee();
  assertClose(r.montant, 6.78, 'Vaudoise Occupants 45.2 × 15%');
}

setLignes('La Vaudoise', [{ libelle: 'Assurance accidents selon la LAA', montant: 613.2 }]);
{
  const r = calculerCommissionEstimee();
  assertClose(r.montant, 24.53, 'Vaudoise LAA 613.2 × 4%');
}

setLignes('La Vaudoise', [{ libelle: 'RC générale RC lot 2 Business One', montant: 489.1 }]);
{
  const r = calculerCommissionEstimee();
  assertClose(r.montant, 73.37, 'Vaudoise RC générale 489.1 × 15%');
}

setLignes('La Vaudoise', [
  { libelle: 'RC véhicule', montant: 250 },
  { libelle: 'Casco complète', montant: 600 },
  { libelle: 'Casco partielle / occupants', montant: 40 },
]);
{
  const r = calculerCommissionEstimee();
  const attendu = 250 * 0.04 + 600 * 0.12 + 40 * 0.15;
  assertClose(r.montant, attendu, 'Vaudoise police combinée RC+Casco (somme par branche)');
}

// ═══ 2. AXA — vérifié contre le Tableau de courtage §B4.4 (contrat Des Gouttes & Cie, 10.03.2025) ═══

setLignes('AXA', [
  { libelle: 'RC privée', montant: 206 },
  { libelle: 'Inventaire du ménage', montant: 768 },
  { libelle: 'Assurances complémentaires et services', montant: 57.9 },
  { libelle: 'Taxes légales', montant: 51.62 },
]);
{
  const primeTotale = parseFloat(document.getElementById('ct-prime-mensuelle').value);
  assertClose(primeTotale, 1031.9, 'AXA volume de prime hors taxes (206+768+57.9)');
  const lignes = Array.from(document.querySelectorAll('.ct-prime-ligne'));
  const catRC = lignes[0].querySelector('.ct-prime-ligne-categorie').value;
  const catMenage = lignes[1].querySelector('.ct-prime-ligne-categorie').value;
  const catCompl = lignes[2].querySelector('.ct-prime-ligne-categorie').value;
  console.log(`  (catégories devinées : RC privée→${catRC}, Ménage→${catMenage}, Compl.→${catCompl})`);
  if (catRC === 'rc_hors_vehicules') { pass++; console.log('PASS  AXA RC privée → catégorie rc_hors_vehicules (15%)'); }
  else { fail++; console.log(`FAIL  AXA RC privée → catégorie devinée ${catRC}, attendu rc_hors_vehicules`); }
  if (catMenage === 'autres') { pass++; console.log('PASS  AXA Ménage → catégorie autres (10%)'); }
  else { fail++; console.log(`FAIL  AXA Ménage → catégorie devinée ${catMenage}, attendu autres`); }

  const r = calculerCommissionEstimee();
  const attendu = 206 * 0.15 + 768 * 0.10 + 57.9 * 0.10;
  assertClose(r.montant, attendu, 'AXA RC+Ménage+Compl. — commission par ligne (taxes exclues)');
}

setLignes('AXA', [
  { libelle: 'RC véhicule', montant: 300 },
  { libelle: 'Casco complète', montant: 500 },
]);
{
  const r = calculerCommissionEstimee();
  const attendu = (300 + 500) * 0.07;
  assertClose(r.montant, attendu, 'AXA véhicules RC+Casco (taux unique 7%)');
}

// ═══ 3. Compagnies SANS table codée — le calcul doit retomber sur 0 / saisie manuelle,
// PAS inventer un taux. ═══
['Allianz', 'La Mobilière', 'Zurich', 'SWICA', 'goCaution', 'CAP', 'Groupe Mutuel'].forEach(compagnie => {
  setLignes(compagnie, [{ libelle: 'RC entreprise / exploitation', montant: 500 }]);
  const r = calculerCommissionEstimee();
  if (r.montant === 0) { pass++; console.log(`PASS  ${compagnie} sans table codée → 0 (pas de taux inventé, saisie manuelle requise)`); }
  else { fail++; console.log(`FAIL  ${compagnie} → montant ${r.montant} inattendu (aucune table connue ne devrait produire un chiffre)`); }
});

// ═══ 4. GROUPE MUTUEL — Tabelle de rémunération Domaine entreprises, édition 01.06.2025 ═══
// Chiffres réels de la proposition GM n° 621247 (Katogan / Dorentina Ismaili, signée le
// 23.09.2026) : LAA 928.80, LAAC 200.00, LPP 2'760.40, IJM 0.00 — total 3'889.20.
// Les taux viennent du document contractuel, pas de mémoire : LAA 11%/18%, LAAC 25%/40%,
// LPP 24% sur la prime de RISQUE, IJM 10 à 30% selon le délai d'attente.
// `ct-produit` porte le LIBELLÉ du catalogue, pas l'identifiant : getProduitSelectionne() fait
// la correspondance. Passer l'identifiant renvoie null et le calcul retombe sur la répartition
// par ligne — d'où des montants inattendus. (Constaté en écrivant ce test, 24.09.2026.)
function commissionGm(libelleProduit, libelleLigne, montant, attendu, label) {
  reset();
  document.getElementById('ct-compagnie').value = 'Groupe Mutuel';
  document.getElementById('ct-categorie').value = 'entreprise';
  document.getElementById('ct-produit').value = libelleProduit;
  ajouterLignePrime(libelleLigne, montant);
  refreshCategoriesLignesPrime();
  calculerPrimeTotaleLignes();
  const r = calculerCommissionEstimee();
  assertClose(r.montant, attendu, label);
  return r;
}

const gmLaa = commissionGm('LAA', 'Assurance-accidents selon la LAA', 928.80, 102.17,
  'GM LAA 928.80 × 11% sur 3 ans (Katogan n° 621247)');
commissionGm('LAAC (complémentaire)', 'Assurance complémentaire à la LAA', 200.00, 50.00,
  'GM LAAC 200.00 × 25% sur 3 ans (Katogan n° 621247)');

// Sur 5 ans, les taux changent — c'est la durée qui commande, pas la branche seule.
reset();
document.getElementById('ct-compagnie').value = 'Groupe Mutuel';
document.getElementById('ct-produit').value = 'LAA';
document.getElementById('ct-duree').value = '5';
ajouterLignePrime('Assurance-accidents selon la LAA', 928.80);
refreshCategoriesLignesPrime(); calculerPrimeTotaleLignes();
assertClose(calculerCommissionEstimee().montant, 167.18, 'GM LAA 928.80 × 18% sur 5 ans');
document.getElementById('ct-duree').value = '1';

// Art. 4 — un renouvellement vaut la moitié de la commission d'acquisition.
reset();
document.getElementById('ct-compagnie').value = 'Groupe Mutuel';
document.getElementById('ct-produit').value = 'LAAC (complémentaire)';
document.getElementById('ct-nature-commission').value = 'gestion';
ajouterLignePrime('Assurance complémentaire à la LAA', 200.00);
refreshCategoriesLignesPrime(); calculerPrimeTotaleLignes();
assertClose(calculerCommissionEstimee().montant, 25.00, 'GM LAAC renouvellement = moitié de 25%');
document.getElementById('ct-nature-commission').value = 'acquisition';

// L'édition de la tabelle doit être citée : sans elle, impossible de savoir si un chiffre
// d'il y a six mois suivait encore les mêmes règles.
if (/01\.06\.2025/.test(gmLaa.detail || '')) { pass++; console.log('PASS  GM — le détail cite l’édition de la tabelle'); }
else { fail++; console.log(`FAIL  GM — le détail ne cite pas l’édition : "${gmLaa.detail}"`); }

// Art. 3 — la LPP se commissionne sur la prime de RISQUE nette. Sans elle, le CRM calcule sur la
// prime totale mais DOIT le dire, sinon le chiffre passe pour contractuel.
const gmLpp = commissionGm('LPP collective', 'Prévoyance professionnelle LPP', 2760.40, 662.50,
  'GM LPP 2760.40 × 24% (prime totale, faute de prime de risque)');
if (/prime de risque nette/i.test(gmLpp.detail || '')) { pass++; console.log('PASS  GM LPP — le détail réclame la prime de risque nette'); }
else { fail++; console.log(`FAIL  GM LPP — le détail ne réclame pas la prime de risque : "${gmLpp.detail}"`); }

// ── Domaine Patrimoine, édition 01.06.2024 ──────────────────────────────────────────────────
// Le timbre fédéral ne doit JAMAIS entrer dans la base (art. 2 et 3) : on le met dans la police
// pour vérifier qu'il est bien exclu — c'est le total commissionnable qui sert de base.
commissionGm('Inventaire du ménage', 'Inventaire du ménage HomeProtect', 400, 200.00,
  'GM ménage 400 × 50% (HomeProtect basic)');
commissionGm('RC privée', 'Responsabilité civile privée SelfProtect', 200, 100.00,
  'GM RC privée 200 × 50% (SelfProtect basic)');

reset();
document.getElementById('ct-compagnie').value = 'Groupe Mutuel';
document.getElementById('ct-produit').value = 'Inventaire du ménage';
ajouterLignePrime('Inventaire du ménage HomeProtect', 400);
ajouterLignePrime('Droit de timbre fédéral', 20);
refreshCategoriesLignesPrime(); calculerPrimeTotaleLignes();
assertClose(calculerCommissionEstimee().montant, 200.00,
  'GM ménage — le timbre fédéral reste hors de la base de commission');

// ── Domaine Vie : 4 % du capital de production (= 40 ‰), valorisation 100 % ──────────────────
// Règle confirmée par Jonathan le 24.09.2026. Capital = prime annuelle × durée — le « × 12 »
// dont il parle est celui qui transforme la prime MENSUELLE en prime annuelle, pas un facteur
// supplémentaire : le champ primeAnnuelle le porte déjà (cf. correction du 23.09 sur Sauthier).
reset();
document.getElementById('ct-compagnie').value = 'Groupe Mutuel';
document.getElementById('ct-categorie').value = 'prive';
document.getElementById('ct-produit').value = 'Assurance vie liée 3a (pilier 3a)';
document.getElementById('ct-duree').value = '10';
ajouterLignePrime('Prime 3a', 3000);
refreshCategoriesLignesPrime(); calculerPrimeTotaleLignes();
const gmVie = calculerCommissionEstimee();
assertClose(gmVie.montant, 1200, 'GM Vie 3000 × 10 ans × 4% = 1200');

// Cas réel : offre Sauthier n° 10110911451, 208.–/mois sur 21 ans.
reset();
document.getElementById('ct-compagnie').value = 'Groupe Mutuel';
document.getElementById('ct-produit').value = 'Assurance vie liée 3a (pilier 3a)';
document.getElementById('ct-periodicite').value = '12';
document.getElementById('ct-duree').value = '21';
ajouterLignePrime('Prime 3a mensuelle', 208);
refreshCategoriesLignesPrime(); calculerPrimeTotaleLignes();
assertClose(calculerCommissionEstimee().montant, 2096.64,
  'GM VariaInvest Sauthier : 208 × 12 × 21 ans × 4%');

// GM calcule sur la prime d'ÉPARGNE seule (49'008.75 au pied de l'offre, hors libération 161.95) :
// le détail doit le rappeler, sinon on annonce 136.– de commission de trop.
const gmVi = calculerCommissionEstimee();
if (/épargne/i.test(gmVi.detail || '')) { pass++; console.log('PASS  GM Vie — le détail rappelle que la base est la prime d’épargne seule'); }
else { fail++; console.log(`FAIL  GM Vie — le détail ne parle pas de la prime d'épargne : "${gmVi.detail}"`); }
document.getElementById('ct-duree').value = '1';
document.getElementById('ct-periodicite').value = '1';

console.log(`\n${pass} tests passés, ${fail} échoués.`);
process.exit(fail > 0 ? 1 : 0);
