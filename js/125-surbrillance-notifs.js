// ═══ SURBRILLANCE DES BOUTONS QUI ONT UNE NOTIFICATION (22.09.2026) ═══════════════════════════════
// « Mets en surbrillance les boutons quand il y a notification, c'est important. »
//
// Une pastille chiffrée seule se rate : elle est petite, et quand la rubrique du menu est repliée,
// elle n'est même pas à l'écran. On éclaire donc le BOUTON entier :
//   · une entrée du menu qui porte une pastille (demandes clients, tâches…) ;
//   · la rubrique repliée qui contient une telle entrée — on sait où cliquer sans tout déplier ;
//   · les onglets de Messages clients qui contiennent une demande en attente (js/51, classe
//     .a-attente posée au rendu).
// La couleur suit l'origine : orange pour ce qui vient de l'espace client, rouge pour les tâches.

function snbMarquerMenu() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.querySelectorAll('.nav-item, .nav-solo-btn').forEach(b => {
    const p = b.querySelector('.nav-compteur');
    const n = p && parseInt(p.textContent, 10);
    b.classList.toggle('snb-notif', !!n);
    b.classList.toggle('snb-client', !!n && p.classList.contains('ntf-pastille'));
  });
  // Rubriques : on parcourt le menu dans l'ordre ; tout ce qui suit un bouton de rubrique, jusqu'au
  // suivant, lui appartient.
  let rubrique = null, cumul = { n: 0, client: false };
  const clore = () => { if (rubrique) { rubrique.classList.toggle('snb-notif', cumul.n > 0); rubrique.classList.toggle('snb-client', cumul.client); } };
  nav.querySelectorAll('.nav-section-btn[data-sec], .nav-item, .nav-solo-btn').forEach(el => {
    if (el.matches('.nav-section-btn')) { clore(); rubrique = el; cumul = { n: 0, client: false }; return; }
    if (!rubrique || !el.classList.contains('snb-notif')) return;
    cumul.n++; if (el.classList.contains('snb-client')) cumul.client = true;
  });
  clore();
}

(function snbBrancher() {
  const relancer = (() => { let t = null; return () => { clearTimeout(t); t = setTimeout(snbMarquerMenu, 80); }; })();
  const demarrer = () => {
    snbMarquerMenu();
    const nav = document.getElementById('nav');
    if (nav) new MutationObserver(relancer).observe(nav, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  // Le menu est reconstruit (renderSidebar) : l'observateur doit suivre le nouveau #nav.
  if (typeof renderSidebar === 'function') {
    const origine = renderSidebar;
    window.renderSidebar = function () { const r = origine.apply(this, arguments); setTimeout(demarrer, 0); return r; };
  }
})();
