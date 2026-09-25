// Paramètres en feuilles, et le rôle RH non apporteur (25.09.2026).
//
// « Range cette feuille dans Paramètres, le bouton en bas du menu. Ajoute l'accès rh@cofidex
//   sur cette page comme agent non apporteur. »
//
// Deux garde-fous, et le second est le plus important : un agent RH ne prend aucune commission.
// S'il apparaissait dans un menu « Apporteur », une part partirait vers quelqu'un qui n'y a pas
// droit — et personne ne le remarquerait avant la fiche de paie.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
// `url` donne à JSDOM un vrai localStorage : le remplacer par un objet ne marche pas, c'est un
// accesseur natif et l'affectation est ignorée en silence.
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { runScripts: 'outside-only', url: 'https://crm.test/' });
const { window } = dom;
global.window = window;
global.document = window.document;
const memoire = () => window.localStorage.getItem('crm_parametres_feuille');
window.allCompagniesContacts = [];

// js/02 porte estRoleRH et agentsApporteurs ; le module des feuilles vient ensuite.
window.eval(['js/01-prevoyance-immo.js', 'js/02-catalogue-session.js']
  .map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n;\n'));

// De quoi faire tourner le module sans charger tout le CRM.
window.viewApparence = function () { return '<h2>Apparence</h2><p>réglages du thème</p>'; };
window.viewAgents = function () { return '<h2>Paramètres — Agents</h2><p>liste des agents</p>'; };
// viewContactsCompagnies est ASYNCHRONE dans le CRM : elle va chercher ses contacts en base.
window.viewContactsCompagnies = function () { return Promise.resolve('<h2>Contacts</h2><p>les contacts compagnies</p>'); };
window.SECTIONS = [
  { id: 'rh', label: 'RH', sub: [{ id: 'agents', label: 'Agents' }, { id: 'fiche-paie', label: 'Fiches de paie' }] },
  { id: 'settings', label: 'Réglages', sub: [{ id: 'contacts-compagnies', label: 'Contacts compagnies' }, { id: 'apparence', label: 'Apparence' }] },
];
let vueDemandee = null;
window.navigate = function (v) { vueDemandee = v; };
window.eval(fs.readFileSync(path.join(ROOT, 'js/163-parametres-feuilles.js'), 'utf8'));

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${a}, attendu ${e}`); }
}

// ── Un agent RH n'est jamais proposé comme apporteur ───────────────────────────────────────────
const equipe = [
  { id: 'j', prenom: 'Jonathan', nom: 'Özkan', role: 'signataire' },
  { id: 'd', prenom: 'David', nom: 'Pereira', role: 'apporteur' },
  { id: 'r', prenom: 'RH', nom: 'Cofidex', role: 'rh' },
];
const apporteurs = window.agentsApporteurs(equipe);
check('le RH est exclu des apporteurs', apporteurs.map(a => a.id), ['j', 'd']);
check('les autres rôles restent', apporteurs.length, 2);
check('la liste d’origine n’est pas modifiée', equipe.length, 3);
check('liste vide -> rien, pas d’erreur', window.agentsApporteurs([]), []);

// ── Paramètres affiche des feuilles ────────────────────────────────────────────────────────────
// estRoleRH est une déclaration de fonction de js/02 : elle vit sur window, on peut donc la
// remplacer pour jouer les deux rôles. `currentUser`, lui, est un `let` de premier niveau —
// invisible depuis ce test, comme dans le navigateur il serait invisible d'un autre document.
window.estRoleRH = () => false;
let html = window.viewApparence();
check('la page s’intitule Paramètres', /class="prm-titre">Paramètres</.test(html), true);
check('la feuille Apparence est proposée', html.includes('>Apparence<') || html.includes('Apparence</button>'), true);
check('la feuille Agents est proposée', html.includes('Agents</button>'), true);
check('la feuille Apparence est active par défaut', /class="prm-feuille active"[^>]*onclick="prmOuvrirFeuille\('apparence'\)"/.test(html), true);
check('le contenu de la feuille active est rendu', html.includes('réglages du thème'), true);
check('le contenu de l’autre feuille ne l’est pas', html.includes('liste des agents'), false);

// ── Changer de feuille ─────────────────────────────────────────────────────────────────────────
window.prmOuvrirFeuille('agents');
check('le changement de feuille redemande la page', vueDemandee, 'apparence');
html = window.viewApparence();
check('la feuille Agents est maintenant rendue', html.includes('liste des agents'), true);
check('l’Apparence ne l’est plus', html.includes('réglages du thème'), false);
check('le choix est retenu sur l’appareil', memoire(), 'agents');

// ── La session RH ne voit pas la feuille Agents ────────────────────────────────────────────────
// Elle montre les commissions générées par agent : hors de son périmètre.
window.estRoleRH = () => true;
html = window.viewApparence();
check('RH : pas de feuille Agents', html.includes('Agents</button>'), false);
check('RH : pas la liste des agents', html.includes('liste des agents'), false);
// Une seule feuille visible : la barre d’onglets ne sert à rien, on ne l’affiche pas.
check('RH : pas de barre de feuilles pour une seule feuille', html.includes('prm-feuilles'), false);
check('RH : l’Apparence reste accessible', html.includes('réglages du thème'), true);
window.estRoleRH = () => false;

// ── Les pages devenues des feuilles quittent le menu ───────────────────────────────────────────
const rh = window.SECTIONS.find(s => s.id === 'rh');
check('Agents retiré du menu RH', rh.sub.map(v => v.id), ['fiche-paie']);
const reglages = window.SECTIONS.find(s => s.id === 'settings');
check('Contacts compagnies retiré des Réglages', reglages.sub.map(v => v.id), ['apparence']);
check('Apparence reste dans le menu', reglages.sub.some(v => v.id === 'apparence'), true);

// ── Les anciens liens vers 'agents' continuent de marcher ──────────────────────────────────────
window.localStorage.removeItem('crm_parametres_feuille'); vueDemandee = null;
window.navigate('agents');
check('navigate(agents) ouvre Paramètres', vueDemandee, 'apparence');
check('… sur la feuille Agents', memoire(), 'agents');
vueDemandee = null;
window.navigate('contacts-compagnies');
check('navigate(contacts-compagnies) ouvre Paramètres', vueDemandee, 'apparence');
check('… sur la bonne feuille', memoire(), 'contacts-compagnies');
vueDemandee = null;
window.navigate('portefeuille');
check('les autres vues ne sont pas détournées', vueDemandee, 'portefeuille');
vueDemandee = null;
window.navigate('apparence');
check('apparence reste apparence, pas de boucle', vueDemandee, 'apparence');

// ── Une feuille asynchrone : chargement d'abord, contenu ensuite ───────────────────────────────
(async () => {
  window.localStorage.setItem('crm_parametres_feuille', 'contacts-compagnies');
  const html = window.viewApparence();
  check('la feuille asynchrone affiche un chargement', html.includes('Chargement…'), true);
  check('… dans un conteneur identifiable', /id="prm-[a-z0-9]+"/.test(html), true);
  // Le conteneur doit exister dans le document pour que le remplacement trouve sa cible.
  window.document.body.innerHTML = html;
  await new Promise(r => setTimeout(r, 10));
  check('… puis le contenu remplace le chargement',
    window.document.body.innerHTML.includes('les contacts compagnies'), true);
  check('… et le chargement a disparu', window.document.body.innerHTML.includes('Chargement…'), false);

  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail ? 1 : 0);
})();
