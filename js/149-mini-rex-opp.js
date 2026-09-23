// ═══ REX SE BALADE AUSSI SUR LA FICHE D'AFFAIRE (23.09.2026) ════════════════════════════════════
// « Dans l'opp, mets un mini Rex qui exécute la même séquence mais adaptée en petit. »
// puis : « j'ai demandé le Rex du dash qui se balade le long de l'opp, pas Rex cloud. »
// puis : « je veux le mini Rex dans CET espace, pas plus loin. Fais-le se poser sur les deux bords
//          et cracher des flammes. Adapte la séquence à la longueur. »
//
// Deux erreurs avant d'arriver ici, et elles se ressemblent : j'ai d'abord pris le mauvais Rex
// (l'emblème du nuage de l'espace client, qui flotte sur place), puis je l'ai lâché sur toute la
// largeur du bandeau — il passait devant les chiffres et les boutons.
//
// Le bandeau d'une fiche n'est pas celui du tableau de bord : il est plein. Mais il reste un creux,
// entre les coordonnées du client et le rail des étapes, à gauche des boutons. C'est là qu'il doit
// vivre — et ce creux se MESURE, il ne se devine pas : sa largeur change avec le nom du client, le
// nombre de boutons et la largeur de l'écran. On cherche donc le plus grand espace libre à cette
// hauteur, on y pose Rex, et js/117 borne son trajet à ce rectangle (classe .rxa-zone).

const MRX_H_MAX = 104, MRX_H_MIN = 44;

// Le creux se cherche en deux temps, et l'ordre compte. Ma première version prenait pour plafond le
// bas du bloc d'identité sur TOUTE la largeur — or ce bloc n'occupe que la gauche : à droite des
// coordonnées, l'espace libre commence bien plus haut, sous la rangée de boutons. Elle ne trouvait
// donc qu'une bande de vingt pixels, et renonçait.
//   1. le couloir : le plus large passage sans bouton, juste au-dessus du rail des étapes ;
//   2. la hauteur : ce qui surplombe CE couloir-là, et rien d'autre.
function mrxLibre(hero) {
  const rh = hero.getBoundingClientRect();
  const rail = hero.querySelector('.opx-etapes');
  if (!rail) return null;
  const bas = rail.getBoundingClientRect().top - 4;   // Rex marche sur la ligne du rail

  // .opx-identite en entier, et pas seulement ses pastilles : le titre de l'affaire est un champ
  // libre, il descend plus bas dès que le client a un nom long.
  const tous = [...hero.querySelectorAll('.opx-identite, button, a, input, select, kbd, .fcx-chip, .opx-kpi')]
    .map(e => e.getBoundingClientRect()).filter(r => r.width > 4 && r.height > 4);

  // 1. Le couloir, cherché sur la hauteur minimale qu'il faut à Rex pour tenir debout.
  const gene = tous.filter(r => r.bottom > bas - MRX_H_MIN && r.top < bas).sort((a, b) => a.left - b.left);
  let x = rh.left + 14, meilleur = null;
  const retenir = (de, a) => { if (a - de > (meilleur ? meilleur.l : 0)) meilleur = { x: de, l: a - de }; };
  for (const r of gene) { retenir(x, r.left - 8); x = Math.max(x, r.right + 8); }
  retenir(x, rh.right - 14);
  // 220 px : les deux appuis en prennent 68, il doit rester de quoi marcher entre eux.
  if (!meilleur || meilleur.l < 220) return null;   // trop étroit : on s'abstient plutôt que d'entasser

  // 2. La hauteur : ce qui déborde au-dessus du couloir, plafonné. On ne l'agrandit pas parce
  //    qu'il y a de la place, et on renonce plutôt que de le faire chevaucher les boutons.
  const plafond = tous
    .filter(r => r.right > meilleur.x - 8 && r.left < meilleur.x + meilleur.l + 8 && r.bottom <= bas)
    .reduce((m, r) => Math.max(m, r.bottom), rh.top + 6) + 4;
  const h = Math.min(MRX_H_MAX, Math.floor(bas - plafond));
  if (h < MRX_H_MIN) return null;

  return { gauche: Math.round(meilleur.x - rh.left), largeur: Math.round(meilleur.l),
           bas: Math.round(rh.bottom - bas), hauteur: h };
}

function mrxCaler() {
  const hero = document.querySelector('.opx-hero');
  const zone = hero && hero.querySelector('.opx-rex');
  if (!hero || !zone) return;
  const l = mrxLibre(hero);
  if (!l) { zone.style.display = 'none'; return; }
  zone.style.display = 'block';
  zone.style.setProperty('--rxa-petit-h', l.hauteur + 'px');
  zone.style.left = l.gauche + 'px';
  zone.style.width = l.largeur + 'px';
  zone.style.bottom = Math.max(0, l.bas) + 'px';
  zone.style.height = l.hauteur + 'px';
  const img = zone.querySelector('img');
  // Le trajet se recalcule sur la nouvelle largeur : sans ça, il garde les bornes du premier calcul.
  if (img) { img.style.transform = ''; if (typeof rxaSol === 'function') rxaSol(img); }
}

function mrxPoser() {
  const hero = document.querySelector('.opx-hero');
  if (!hero || hero.querySelector('.opx-rex')) return;
  // La piste porte .rxa-zone — c'est elle qui borne le trajet, pas le creux entier : les 34 px de
  // marge de chaque côté sont la place des deux appuis (panneau à gauche, dossiers à droite), pour
  // qu'il s'adosse CONTRE eux au lieu de passer devant.
  const scene = typeof RXA_PETIT_SCENE === 'string' ? RXA_PETIT_SCENE : '';
  hero.insertAdjacentHTML('beforeend',
    `<span class="opx-rex" aria-hidden="true">${scene}<span class="opx-piste rxa-zone"><img class="dbx-hero-mascotte rxa-petit" src="assets/logos/rex/anim-confiant/1.png" alt=""/></span></span>`);
  if (typeof rxaPoser === 'function') rxaPoser();
  // Deux passages : le premier avant que les images d'animation soient arrivées (la hauteur est
  // alors fausse), le second une fois le bandeau posé pour de bon.
  requestAnimationFrame(mrxCaler);
  setTimeout(mrxCaler, 500);
}

(function mrxBrancher() {
  if (typeof viewFicheOpportunite !== 'function') return;
  const origine = viewFicheOpportunite;
  window.viewFicheOpportunite = function () {
    const html = origine.apply(this, arguments);
    setTimeout(mrxPoser, 0);
    return html;
  };
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(mrxCaler, 160); });
})();
