// LA MOSAÏQUE DE WIDGETS (js/168) — cadenas, tailles, glisser-déposer.
// Jonathan, 24.09.2026 : « Je voyais un cadenas qui permet de choisir des widgets à plusieurs
// niveaux de grandeurs, inspirés des widgets Apple mais adaptés à nos fonctions. Le déplacement et
// l'insertion se fait un peu comme le kanban. »
//
// Ce qu'on protège ici :
//   · une page que personne n'a touchée n'est PAS transformée — pas de mosaïque imposée ;
//   · les tailles défilent en boucle et se rangent au bon endroit dans preferences_pages ;
//   · l'ordre enregistré est celui de la grille après déplacement ;
//   · la remise à zéro efface vraiment tout pour cette vue.
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

const PAGE = `<!DOCTYPE html><html><body><div id="main-content">
  <div class="dbx-onglets"></div>
  <div class="dbx-trio">
    <section class="dbx-carte dbx-horloge"><div class="dbx-carte-tete"><h2>Horloge</h2></div></section>
    <section class="dbx-carte"><div class="dbx-carte-tete"><h2>À faire</h2></div></section>
  </div>
  <div class="dbx-grille"><div class="dbx-col">
    <section class="dbx-carte dbx-agenda-semaine"><div class="dbx-carte-tete"><h2>Agenda</h2></div></section>
  </div></div>
</div></body></html>`;

const dom = new JSDOM(PAGE, { url: 'https://crm.test/', runScripts: 'outside-only' });
const { window } = dom;
global.window = window; global.document = window.document;
window.showError = () => {};
window.currentView = 'dashboard';
window.currentUser = { email: 'jo@cofidex.ch' };
window.renderView = () => {};

// js/160 fournit wgtCle / wgtTitre / wgtVue / l'état _wgt : on le charge pour de vrai, c'est la
// dépendance réelle. dbGet n'est pas appelé ici (les préférences sont posées à la main).
// L'enregistrement réel passe par wgtEnregistrer (js/160) → dbPatch sur la fiche agent : c'est
// donc dbPatch qu'on compte, pas un double de wgtEnregistrer, que l'évaluation de js/160
// écraserait aussitôt.
let enregistre = 0;
window.dbGet = async () => [];
window.dbPatch = async (table) => { if (table === 'agents') enregistre++; return {}; };
window.eval(lire('js/160-widgets-pages.js'));
window._wgt.prefs = {};
window._wgt.agentId = 'ag-1';
window.eval(lire('js/168-widgets-mosaique.js'));

(async () => {
  // ── Une page que personne n'a touchée reste telle quelle ─────────────────────────────────────
  check('sans réglage, pas de mosaïque', window.wgmConstruire(), false);
  check('… la page d’origine est intacte', !!document.querySelector('.dbx-trio'), true);
  check('… aucune grille créée', document.querySelectorAll('.wgm-grille').length, 0);

  // ── Ouvrir le cadenas construit la mosaïque ──────────────────────────────────────────────────
  await window.wgmBasculerEdition();
  check('le cadenas ouvre le mode édition', window._wgm.edition, true);
  check('la mosaïque est mémorisée', window._wgt.prefs.dashboard.mosaique, true);
  const grille = document.querySelector('.wgm-grille');
  check('une grille existe', !!grille, true);
  check('elle contient les 3 cartes', grille.children.length, 3);
  check('les conteneurs vidés ont disparu', document.querySelectorAll('.dbx-trio, .dbx-col').length, 0);
  check('l’ordre affiché est repris', window._wgt.prefs.dashboard.ordre, ['horloge', 'a-faire', 'agenda-semaine']);
  check('chaque carte a sa barre', document.querySelectorAll('.wgm-barre').length, 3);
  check('les cartes deviennent déplaçables', [...grille.children].every(c => c.draggable), true);
  check('le corps porte la marque du mode édition', document.body.classList.contains('wgm-edition'), true);

  // ── Les tailles ──────────────────────────────────────────────────────────────────────────────
  check('taille par défaut : moitié', grille.children[0].style.gridColumn, 'span 2');
  window.wgmTaillerSuivante('horloge');
  check('moitié → carré', window._wgt.prefs.dashboard.tailles.horloge, 'large');
  check('le carré prend deux rangées', grille.children[0].style.gridRow, 'span 2');
  window.wgmTaillerSuivante('horloge');
  check('carré → pleine largeur', grille.children[0].style.gridColumn, 'span 4');
  window.wgmTaillerSuivante('horloge');
  check('pleine largeur → quart', grille.children[0].style.gridColumn, 'span 1');
  window.wgmTaillerSuivante('horloge');
  check('la boucle revient à la moitié', window._wgt.prefs.dashboard.tailles.horloge, 'moyen');

  // ── Masquer ──────────────────────────────────────────────────────────────────────────────────
  window.wgmBasculerVisible('a-faire');
  check('la carte est notée masquée', window._wgt.prefs.dashboard.caches, ['a-faire']);
  check('en édition elle reste visible pour la retrouver', grille.children[1].style.display, '');
  check('… mais signalée comme telle', grille.children[1].classList.contains('wgm-masquee'), true);

  // ── Refermer le cadenas ──────────────────────────────────────────────────────────────────────
  const avant = enregistre;
  await window.wgmBasculerEdition();
  check('le cadenas se referme', window._wgm.edition, false);
  check('la disposition est enregistrée', enregistre, avant + 1);
  check('les barres sont retirées', document.querySelectorAll('.wgm-barre').length, 0);
  check('la carte masquée disparaît vraiment', grille.children[1].style.display, 'none');
  check('les cartes ne sont plus déplaçables', [...grille.children].some(c => c.draggable), false);

  // ── L'ordre après déplacement ────────────────────────────────────────────────────────────────
  grille.insertBefore(grille.children[2], grille.children[0]);
  window.wgmOrdreDepuisGrille();
  check('l’ordre suit la grille', window._wgt.prefs.dashboard.ordre, ['agenda-semaine', 'horloge', 'a-faire']);
  // Et il survit à une reconstruction : c'est tout l'intérêt de l'enregistrer.
  document.querySelector('.wgm-grille').remove();
  document.getElementById('main-content').insertAdjacentHTML('beforeend',
    '<div class="dbx-trio"><section class="dbx-carte dbx-horloge"><div class="dbx-carte-tete"><h2>Horloge</h2></div></section>'
    + '<section class="dbx-carte"><div class="dbx-carte-tete"><h2>À faire</h2></div></section>'
    + '<section class="dbx-carte dbx-agenda-semaine"><div class="dbx-carte-tete"><h2>Agenda</h2></div></section></div>');
  window.wgmConstruire();
  check('après un nouveau rendu, l’ordre est rétabli',
    [...document.querySelector('.wgm-grille').children].map(c => c.dataset.wgt),
    ['agenda-semaine', 'horloge', 'a-faire']);

  // ── Remise à zéro ────────────────────────────────────────────────────────────────────────────
  await window.wgmReinitialiser();
  check('plus aucun réglage pour cette vue', window._wgt.prefs.dashboard, undefined);
  check('la grille est retirée', document.querySelectorAll('.wgm-grille').length, 0);
  check('le mode édition est coupé', document.body.classList.contains('wgm-edition'), false);

  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail ? 1 : 0);
})();
