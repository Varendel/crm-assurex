// ═══ REX SE BALADE DANS LES BANDEAUX (23.09.2026) ═══════════════════════════════════════════════
// « Dans l'opp, mets un mini Rex qui exécute la même séquence mais adaptée en petit. »
// puis : « j'ai demandé le Rex du dash, pas Rex cloud » — puis : « dans CET espace, pas plus loin,
// qu'il s'appuie sur quelque chose » — puis : « ajoute un petit décor préhistorique, et un mini
// Rex ici aussi » (sur la fiche client).
//
// Tout le trajet vient de js/117 : c'est le Rex du tableau de bord, en plus petit, borné à son
// couloir. Ici on ne fait que DEUX choses : trouver le creux, et y poser son image.
//
// TROUVER LE CREUX, sans rien savoir de l'écran. Ma version précédente s'appuyait sur des repères
// propres à la fiche d'affaire (bloc d'identité, rail des étapes) — elle ne pouvait pas servir
// ailleurs. On cherche maintenant à l'aveugle : on essaie des lignes de sol de bas en haut et on
// retient la PREMIÈRE assez large et assez haute. La première en partant du bas, et pas la plus
// grande : un personnage qui marche se pose en bas, et c'est là que la place est perdue de toute
// façon. Sur une fiche d'affaire ça tombe au-dessus du rail des étapes ; sur une fiche client, à
// droite des boutons. Aucun des deux écrans n'a eu besoin d'être décrit.

const MRX_H_MAX = 104, MRX_H_MIN = 44, MRX_L_MIN = 220;

function mrxRects(hero) {
  return [...hero.querySelectorAll('h1, h2, h3, p, button, a, input, select, kbd, img, .fcx-chip, .opx-kpi, .opx-identite, .opx-etapes')]
    .filter(e => !e.closest('.opx-rex'))                 // Rex ne se gêne pas lui-même
    .map(e => e.getBoundingClientRect())
    .filter(r => r.width > 4 && r.height > 4);
}

function mrxCouloir(rh, tous, bas) {
  const gene = tous.filter(r => r.bottom > bas - MRX_H_MIN && r.top < bas).sort((a, b) => a.left - b.left);
  let x = rh.left + 14, m = null;
  const retenir = (de, a) => { if (a - de > (m ? m.l : 0)) m = { x: de, l: a - de }; };
  for (const r of gene) { retenir(x, r.left - 8); x = Math.max(x, r.right + 8); }
  retenir(x, rh.right - 14);
  return m && m.l >= MRX_L_MIN ? m : null;
}

function mrxLibre(hero) {
  const rh = hero.getBoundingClientRect();
  if (rh.height < MRX_H_MIN + 20) return null;
  const tous = mrxRects(hero);
  for (let bas = Math.round(rh.bottom - 6); bas > rh.top + MRX_H_MIN; bas -= 6) {
    const m = mrxCouloir(rh, tous, bas);
    if (!m) continue;
    // La hauteur : ce qui surplombe CE couloir, et rien d'autre. Plafonnée — on ne l'agrandit pas
    // parce qu'il y a de la place.
    const plafond = tous
      .filter(r => r.right > m.x - 8 && r.left < m.x + m.l + 8 && r.bottom <= bas)
      .reduce((mx, r) => Math.max(mx, r.bottom), rh.top + 6) + 4;
    const h = Math.min(MRX_H_MAX, Math.floor(bas - plafond));
    if (h < MRX_H_MIN) continue;
    return { gauche: Math.round(m.x - rh.left), largeur: Math.round(m.l),
             bas: Math.round(rh.bottom - bas), hauteur: h };
  }
  return null;
}

function mrxHero() {
  // La fiche d'affaire d'abord si elle est là ; sinon n'importe quel bandeau de fiche.
  return document.querySelector('.opx-hero') || document.querySelector('.fcx-hero');
}

function mrxCaler() {
  const hero = mrxHero();
  const zone = hero && hero.querySelector('.opx-rex');
  if (!hero || !zone) return;
  const l = mrxLibre(hero);
  if (!l) { zone.style.display = 'none'; return; }
  // `position` est posé ici AUSSI, en plus de la feuille de js/117 : si cette feuille n'était pas
  // encore appliquée, le span resterait dans le flux et ajouterait sa hauteur au bandeau.
  zone.style.position = 'absolute';
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
  const hero = mrxHero();
  if (!hero || hero.querySelector('.opx-rex')) return;
  // La piste porte .rxa-zone — c'est elle qui borne le trajet, pas le creux entier : les 34 px de
  // marge de chaque côté sont la place des deux appuis, pour qu'il s'adosse CONTRE eux.
  const scene = typeof RXA_PETIT_SCENE === 'string' ? RXA_PETIT_SCENE : '';
  const prehist = hero.classList.contains('opx-hero') ? '' : ' mrx-prehist';
  hero.insertAdjacentHTML('beforeend',
    `<span class="opx-rex${prehist}" aria-hidden="true">${scene}<span class="opx-piste rxa-zone"><img class="dbx-hero-mascotte rxa-petit" src="assets/logos/rex/anim-confiant/1.png" alt=""/></span></span>`);
  if (typeof rxaPoser === 'function') rxaPoser();
  requestAnimationFrame(mrxCaler);
  setTimeout(mrxCaler, 500);
}

(function mrxBrancher() {
  const main = document.getElementById('main-content');
  if (main) {
    let t = null;
    // Un observateur plutôt qu'un enrobage par écran : la fiche client et la fiche d'affaire ne
    // passent pas par la même fonction, et demain il y en aura d'autres.
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(mrxPoser, 90); })
      .observe(main, { childList: true, subtree: true });
  }
  let r = null;
  window.addEventListener('resize', () => { clearTimeout(r); r = setTimeout(mrxCaler, 160); });
  const demarrer = () => setTimeout(mrxPoser, 200);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
