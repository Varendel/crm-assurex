// ═══ REX SE BALADE AUSSI SUR LA FICHE D'AFFAIRE (23.09.2026) ════════════════════════════════════
// « Dans l'opp, mets un mini Rex qui exécute la même séquence mais adaptée en petit. »
// puis, la correction : « j'ai demandé le Rex du dash qui se balade le long de l'opp, pas Rex cloud ».
//
// Première version fausse : j'avais repris l'emblème du nuage de l'espace client (js/112), qui
// flotte sur place et fait des bulles. Ce n'est pas la même bête. Celui qui était demandé est le
// Rex du tableau de bord (js/117) : il marche pour de vrai le long du bandeau, fait demi-tour,
// crache sa flamme, saute.
//
// Il n'y avait donc rien à réécrire — juste à le laisser vivre ailleurs. Toute la machinerie de
// js/117 (trajet mesuré sur le bandeau, sol, repos) accepte désormais le bandeau d'une affaire en
// plus de celui du tableau de bord ; ici on se contente de lui poser son image, et l'observateur
// de js/117 la prend en charge. Deux tiers de la taille, sans le paysage : le volcan et les étoiles
// écraseraient un bandeau de fiche.

function mrxPoser() {
  const hero = document.querySelector('.opx-hero');
  if (!hero || hero.querySelector('.opx-rex')) return;
  hero.insertAdjacentHTML('beforeend',
    '<span class="opx-rex" aria-hidden="true"><img class="dbx-hero-mascotte rxa-petit" src="assets/logos/rex/anim-confiant/1.png" alt=""/></span>');
  if (typeof rxaPoser === 'function') rxaPoser();
}

(function mrxBrancher() {
  if (typeof viewFicheOpportunite !== 'function') return;
  const origine = viewFicheOpportunite;
  window.viewFicheOpportunite = function () {
    const html = origine.apply(this, arguments);
    setTimeout(mrxPoser, 0);
    return html;
  };
})();
