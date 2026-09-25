// REPRENDRE UNE POLICE DÉJÀ DÉPOSÉE (js/167).
// Jonathan, 25.09.2026 : « Lorsque j'ajoute des documents classés police dans les documents
// client, j'aimerais que l'import propose de reprendre les polices déposées pour les lire et les
// créer dans le système. »
//
// Deux choses à garder :
//   1. la liste ne propose QUE des polices qu'aucun contrat ne reprend ;
//   2. une fois le contrat créé, le document est rattaché — sinon on a juste déplacé le travail.
//
// Et une dépendance fragile à surveiller : js/167 appelle importPolicePdfAI (js/09) en lui passant
// un objet qui n'a qu'un `files`. Tant que cette fonction ne lit que `input.files`, c'est bon ; le
// jour où elle lira `input.value` ou `input.id`, ce test tombe et on saura pourquoi.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${a}, attendu ${e}`); }
}

// ── La dépendance sur js/09 ──────────────────────────────────────────────────────────────────────
const src09 = lire('js/09-rappels-vehicules.js');
const deb = src09.indexOf('async function importPolicePdfAI(');
const corps = src09.slice(deb, src09.indexOf('\nasync function', deb + 10));
const usages = [...corps.matchAll(/\binput\.([a-zA-Z_]+)/g)].map(m => m[1]);
check('importPolicePdfAI ne lit que input.files', [...new Set(usages)], ['files']);

// ── Le module ────────────────────────────────────────────────────────────────────────────────────
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="main-content"></div></body></html>',
  { url: 'https://crm.test/', runScripts: 'outside-only' });
const { window } = dom;
global.window = window; global.document = window.document;
window.showError = () => {};
window.SUPABASE_URL = 'https://exemple.test'; window.SUPABASE_KEY = 'cle';
window.allClients = [
  { id: 'cl-1', nom: 'TANDOORI PLAGE Sàrl', prenom: '', segment: 'Entreprise' },
  { id: 'cl-2', nom: 'Exemple', prenom: 'Jean' },
];
window.estEntreprise = c => (c.segment || '') === 'Entreprise';
window.fmtDate = d => d;

// dbGet doit recevoir un filtre qui exclut les documents déjà rattachés.
let requete = '';
window.dbGet = async (table, params) => {
  requete = `${table}?${params}`;
  return [
    { id: 'd1', client_id: 'cl-2', nom_fichier: 'police-axa.pdf', chemin: 'compagnies/a-rattacher/1-police-axa.pdf', compagnie: 'AXA' },
    { id: 'd2', client_id: 'cl-1', nom_fichier: 'laa.pdf', chemin: 'compagnies/a-rattacher/2-laa.pdf' },
  ];
};
const patchs = [];
window.dbPatch = async (table, id, maj) => { patchs.push({ table, id, maj }); return {}; };
window.errMsg = () => 'erreur';

// La création de contrat, remplacée par un double : c'est le branchement qu'on teste.
let contratRendu = { error: false, contrat: { id: 'ct-9', client_id: 'cl-1', numero_police: 'G-1846-4747', compagnie: 'Mobilière' } };
window.creerContratEtCommission = async () => contratRendu;

window.eval(lire('js/167-polices-deposees.js'));

(async () => {
  await window.pdpCharger();
  check('ne demande que les polices', /type=eq\.police/.test(requete), true);
  check('ne demande que celles sans contrat', /contrat_id=is\.null/.test(requete), true);

  // ── L'ordre d'affichage ────────────────────────────────────────────────────────────────────────
  // Sans client choisi sur le formulaire, on ne réordonne rien.
  check('sans client au formulaire : ordre d’origine', window.pdpTriees(window._pdp.docs).map(d => d.id), ['d1', 'd2']);
  document.body.insertAdjacentHTML('beforeend', '<select id="ct-client"><option value="cl-1" selected>x</option></select>');
  check('le client du formulaire passe devant', window.pdpTriees(window._pdp.docs).map(d => d.id), ['d2', 'd1']);

  // ── Le rendu ───────────────────────────────────────────────────────────────────────────────────
  document.body.insertAdjacentHTML('beforeend', '<div id="ct-pan-auto"><div id="pdp-zone"></div></div>');
  await window.pdpRendre();
  const html = document.getElementById('pdp-zone').innerHTML;
  check('les deux polices sont listées', (html.match(/pdp-ligne/g) || []).length, 2);
  check('le nom du client apparaît', html.includes('TANDOORI PLAGE'), true);
  check('un bouton par document', (html.match(/Lire et créer/g) || []).length, 2);

  // Rien à reprendre : le bloc disparaît au lieu d'afficher une liste vide décorative.
  window._pdp.docs = [];
  await window.pdpRendre();
  check('aucune police : bloc vide', document.getElementById('pdp-zone').innerHTML, '');

  // ── La boucle se referme ───────────────────────────────────────────────────────────────────────
  window._pdp.docs = [{ id: 'd2', client_id: 'cl-1', nom_fichier: 'laa.pdf', chemin: 'x' }];
  window._pdp.enCours = window._pdp.docs[0];
  await window.creerContratEtCommission('cl-1');
  check('le document est rattaché au contrat créé', patchs[0], { table: 'documents_compagnies', id: 'd2', maj: { contrat_id: 'ct-9', numero_police: 'G-1846-4747', compagnie: 'Mobilière' } });
  check('il quitte la liste des polices à reprendre', window._pdp.docs.length, 0);
  check('rien ne reste en attente', window._pdp.enCours, null);

  // Un contrat refusé (doublon) ne doit rattacher aucun document.
  patchs.length = 0;
  window._pdp.enCours = { id: 'd3', client_id: 'cl-1' };
  contratRendu = { error: true, detail: 'ce client a déjà un contrat' };
  await window.creerContratEtCommission('cl-1');
  check('contrat refusé : aucun rattachement', patchs.length, 0);
  check('le document reste en attente', window._pdp.enCours.id, 'd3');

  // Un contrat créé hors de ce parcours ne rattache rien non plus.
  window._pdp.enCours = null;
  contratRendu = { error: false, contrat: { id: 'ct-10' } };
  await window.creerContratEtCommission('cl-2');
  check('création ordinaire : aucun rattachement', patchs.length, 0);

  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail ? 1 : 0);
})();
