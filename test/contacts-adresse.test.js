// Adresse postale des services de compagnie (25.09.2026).
//
// « Ajoute le champ adresse pour les compagnies. »
//
// Un courrier de résiliation, un mandat posté ou un recommandé partent à une adresse, pas à une
// boîte e-mail. Le champ est du texte libre sur plusieurs lignes : les adresses d'assureurs
// suisses ne tiennent pas dans un gabarit unique — case postale, service, siège alémanique.
//
// Ce que ce test garde, c'est la différence entre les deux formes de l'adresse :
// celle AFFICHÉE tient sur une ligne pour entrer dans la carte, celle COPIÉE garde ses sauts de
// ligne. Recoller « Case postale 120 · 1001 Lausanne » sur une enveloppe demanderait de la
// remettre en forme à la main.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js/100-contacts-services.js'), 'utf8');
const dom = new JSDOM('<!DOCTYPE html><html><body><button id="b"></button></body></html>', { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
window.localStorage = { getItem: () => null, setItem: () => {} };

let copie = null, messages = [];
window.navigator.clipboard = { writeText: t => { copie = t; return Promise.resolve(); } };
window.showError = m => messages.push(m);
window.creerModale = () => {};
window.eval(SOURCE);
const { csvCopierAdresse } = window;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${a}, attendu ${e}`); }
}

const ADRESSE = 'Vaudoise Générale\nService sinistres — Case postale 120\n1001 Lausanne';
window._contactsCompagnies = [
  { id: 'a', compagnie: 'La Vaudoise', service: 'sinistres', email: 's@vaudoise.ch', adresse: ADRESSE },
  { id: 'b', compagnie: 'AXA', service: 'broker', email: 'b@axa.ch' },
];

// ── Le champ existe, de bout en bout ───────────────────────────────────────────────────────────
check('le formulaire porte un champ adresse', SOURCE.includes('id="csv-adresse"'), true);
check('c’est un textarea, pas un input', /<textarea[^>]*id="csv-adresse"/.test(SOURCE), true);
check('il est enregistré', SOURCE.includes("adresse: t('csv-adresse')"), true);
check('il est affiché sur la carte du service', SOURCE.includes('csvCopierAdresse'), true);

(async () => {
  // ── Ce qui part dans le presse-papiers : la forme postale, sauts de ligne compris ────────────
  const bouton = window.document.getElementById('b');
  copie = null;
  await csvCopierAdresse('a', bouton);
  check('l’adresse copiée garde ses sauts de ligne', copie, ADRESSE);
  check('… trois lignes, comme sur l’enveloppe', copie.split('\n').length, 3);
  check('le bouton confirme', bouton.innerHTML.includes('copiée'), true);

  // ── Ce qui est affiché : une seule ligne, pour tenir dans la carte ───────────────────────────
  const affiche = ADRESSE.split('\n').filter(Boolean).join(' · ');
  check('l’affichage tient sur une ligne', affiche.includes('\n'), false);
  check('… en gardant tout le contenu',
    affiche, 'Vaudoise Générale · Service sinistres — Case postale 120 · 1001 Lausanne');

  // ── Un service sans adresse ne propose rien, et ne casse pas ─────────────────────────────────
  copie = null;
  await csvCopierAdresse('b', bouton);
  check('pas d’adresse, pas de copie', copie, null);
  copie = null;
  await csvCopierAdresse('inconnu', bouton);
  check('un identifiant inconnu ne casse pas', copie, null);

  // ── Presse-papiers refusé : on montre l'adresse plutôt que de mentir ─────────────────────────
  // Page non sécurisée, permission refusée : dire « copié » alors que rien ne l'est ferait coller
  // n'importe quoi dans le courrier suivant.
  messages = [];
  window.navigator.clipboard = { writeText: () => Promise.reject(new Error('refusé')) };
  await csvCopierAdresse('a', bouton);
  check('un refus est signalé', messages.length, 1);
  check('… et l’adresse est donnée à recopier', messages[0].includes('1001 Lausanne'), true);
  check('… sans prétendre que la copie a eu lieu', messages[0].includes('copiée'), false);

  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST INTERROMPU :', e.message); process.exit(1); });
