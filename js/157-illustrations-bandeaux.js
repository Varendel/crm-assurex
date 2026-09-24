// ═══ UNE ILLUSTRATION DANS LE BANDEAU, SELON L'ÉCRAN (24.09.2026) ═══════════════════════════════
// « Ajoute des illustrations sur les bandeaux en lien avec le nom de l'intitulé. »
//
// Le dessin n'est pas choisi à la main écran par écran : il vient de PMN (js/119), le jeu de
// pictogrammes déjà tracé pour le menu et déjà associé à chaque vue. Même source, donc le bandeau
// de « Renouvellements » porte forcément le dessin de « Renouvellements », aujourd'hui comme le
// jour où ce tracé changera. Un écran sans pictogramme n'a pas d'illustration — on n'en invente pas.
//
// Discret par construction : très grand, très pâle, derrière le contenu, collé au bord droit. Il
// remplit le vide à droite des titres sans jamais disputer la place au texte ni à Rex, qui marche
// dans le même bandeau (js/117, js/149). Rex passe devant.

const ILB_HEROS = '.dbx-hero, .fcx-hero, .cf-hero, .opx-hero';

function ilbTrace() {
  if (typeof PMN === 'undefined' || typeof currentView === 'undefined') return null;
  return PMN[currentView] || null;
}

function ilbPoser() {
  const trace = ilbTrace();
  document.querySelectorAll(ILB_HEROS).forEach(hero => {
    const dejaLa = hero.querySelector(':scope > .ilb-decor');
    // Le tracé change avec l'écran : on ne garde pas celui du précédent.
    if (dejaLa && dejaLa.dataset.vue === currentView) return;
    if (dejaLa) dejaLa.remove();
    if (!trace) return;
    const svg = `<svg class="ilb-decor" data-vue="${currentView}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
        fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="${trace}"/></svg>`;
    hero.insertAdjacentHTML('afterbegin', svg);
    // `position` posé ici aussi : si la feuille ci-dessous n'était pas encore appliquée, le SVG
    // resterait dans le flux et pousserait le contenu du bandeau vers le bas.
    const el = hero.querySelector(':scope > .ilb-decor');
    if (el) el.style.position = 'absolute';
  });
}

(function ilbBrancher() {
  const st = document.createElement('style');
  st.textContent = `
    ${ILB_HEROS.split(', ').join(', ')} { position: relative; }
    /* Posé en premier enfant et laissé en arrière-plan : tout ce qui suit dans le bandeau se peint
       naturellement par-dessus, sans qu'on ait à toucher au positionnement des autres éléments.
       24.09.2026 — une première version forçait « position: relative » sur TOUS les enfants directs
       du bandeau pour les faire passer devant. C'était inutile (l'ordre du DOM y suffit) et
       destructeur : Rex et son décor, qui se placent en absolu dans ce même bandeau, se
       retrouvaient repositionnés par cette règle. */
    .ilb-decor {
      position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
      height: 120%; max-height: 190px; width: auto; aspect-ratio: 1;
      color: currentColor; opacity: .05; pointer-events: none; z-index: 0;
    }
    @media (max-width: 760px) { .ilb-decor { display: none; } }`;
  document.head.appendChild(st);

  const main = document.getElementById('main-content');
  if (main) {
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(ilbPoser, 80); })
      .observe(main, { childList: true, subtree: true });
  }
  const demarrer = () => setTimeout(ilbPoser, 150);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
