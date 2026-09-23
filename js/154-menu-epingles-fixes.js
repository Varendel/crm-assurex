// ═══ LA TÊTE DU MENU RESTE, ET TIENT EN DEUX LIGNES (23.09.2026) ════════════════════════════════
// « Fais en sorte que les menus épinglés restent fixes au défilement. »
// puis : « Réorganise les menus, ça va pas comme ça avec le menu déroulant. Pense à un côté
//          pratique. »
//
// Première version : j'ai rendu collant le bloc entier de js/74 — recherche, épinglés, récents,
// en pleines lignes. Ça tenait la promesse et ça ruinait le menu : deux cents pixels figés en
// permanence, un ascenseur dans l'ascenseur, et les rubriques réduites à une fente. Le remède
// était pire que le mal.
//
// Ce qui est pratique, c'est de garder À PORTÉE ce dont on se sert tout le temps, pas de le garder
// GROS. Donc :
//   · la recherche reste, en une ligne — c'est l'entrée universelle ;
//   · les épinglés deviennent une RANGÉE D'ICÔNES sous elle : six écrans en 34 px de haut au lieu
//     de deux cents, le nom au survol, l'écran ouvert souligné ;
//   · les récents redescendent dans la partie qui défile : on y va moins souvent qu'on ne le croit,
//     et la palette (Ctrl K) les propose déjà en tête.
// Aucun ascenseur imbriqué : la molette sur la tête fait défiler le menu, comme partout ailleurs.
//
// Pour dépingler, l'étoile reste dans la palette Ctrl K — la rangée d'icônes n'a pas la place de
// la porter, et dépingler est un geste rare.

function mefRanger() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const recherche = nav.querySelector(':scope > .nav-chercher');
  if (!recherche) return;                                    // js/74 n'a pas (encore) posé son bloc
  if (recherche.parentElement && recherche.parentElement.classList.contains('nav-fixe')) return;

  const boite = document.createElement('div');
  boite.className = 'nav-fixe';
  nav.insertBefore(boite, recherche);
  boite.appendChild(recherche);

  // Ce qui suit la recherche jusqu'à la première rubrique : intertitres, épinglés, récents.
  const suite = [];
  for (let el = boite.nextElementSibling; el; el = el.nextElementSibling) {
    if (el.classList.contains('nav-groupe') || el.classList.contains('nav-fixe')) break;
    suite.push(el);
  }

  // Les épinglés sont les entrées qui suivent l'intertitre « Épinglés », jusqu'au suivant.
  const rangee = document.createElement('div');
  rangee.className = 'nav-fixe-epingles';
  let dedans = false;
  for (const el of suite) {
    if (el.classList.contains('nav-intertitre')) { dedans = /épingl/i.test(el.textContent || ''); el.remove(); continue; }
    if (el.classList.contains('nav-separateur')) { el.remove(); continue; }
    if (dedans && el.classList.contains('nav-item')) {
      el.classList.add('nav-fixe-ep');
      el.title = (el.querySelector('.nav-lib')?.textContent || '').trim();
      rangee.appendChild(el);
    }
  }
  if (rangee.childElementCount) boite.appendChild(rangee);
}

(function mefBrancher() {
  const st = document.createElement('style');
  st.textContent = `
    /* Collée en tête de la zone qui défile. Fond opaque : sans lui, les rubriques défilent en
       transparence dessous et deux textes se superposent. Pas d'overflow ici — un ascenseur dans
       l'ascenseur rend la molette imprévisible. */
    .nav-fixe { position: sticky; top: 0; z-index: 3; margin: 0 -12px; padding: 2px 12px 7px;
      background: var(--sidebar, #0F2D66); box-shadow: 0 10px 12px -10px rgba(0, 0, 0, .6); }
    .nav-fixe .nav-chercher { margin-bottom: 6px; }

    /* Les épinglés : une rangée d'icônes carrées. Le nom passe par le survol. */
    .nav-fixe-epingles { display: flex; gap: 4px; flex-wrap: wrap; }
    .nav-fixe .nav-item.nav-fixe-ep { width: 30px; height: 30px; min-width: 0; margin: 0; padding: 0;
      display: inline-flex; align-items: center; justify-content: center; border-radius: 9px;
      background: rgba(255, 255, 255, .07); border: 1px solid rgba(255, 255, 255, .10);
      transition: background .15s ease, border-color .15s ease; }
    .nav-fixe .nav-item.nav-fixe-ep:hover { background: rgba(255, 255, 255, .16); border-color: rgba(255, 255, 255, .22); }
    .nav-fixe .nav-item.nav-fixe-ep.active { background: rgba(0, 207, 255, .22); border-color: rgba(0, 207, 255, .5); }
    .nav-fixe .nav-item.nav-fixe-ep .nav-lib,
    .nav-fixe .nav-item.nav-fixe-ep .nav-etoile,
    .nav-fixe .nav-item.nav-fixe-ep .nav-compteur { display: none; }
    .nav-fixe .nav-item.nav-fixe-ep .nav-ico { width: 20px; height: 20px; font-size: 13px; background: none; }`;
  document.head.appendChild(st);

  const nav = document.getElementById('nav');
  if (nav) {
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(mefRanger, 40); }).observe(nav, { childList: true });
  }
  const demarrer = () => { mefRanger(); setInterval(mefRanger, 2000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
