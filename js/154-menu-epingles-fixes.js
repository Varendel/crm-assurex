// ═══ LES ÉPINGLÉS RESTENT EN HAUT DU MENU (23.09.2026) ══════════════════════════════════════════
// « Fais en sorte que les menus épinglés restent fixes au défilement. »
//
// Le menu défile déjà seul, sous un logo qui reste (js/111). Mais la recherche d'écran et le bloc
// des épinglés sont posés DANS la zone qui défile (js/74) : arrivé au bas de « Compta », les cinq
// ou six écrans qu'on utilise tout le temps sont hors de vue — exactement ceux qu'on épingle pour
// ne pas avoir à les chercher. L'épingle ne servait donc à rien une fois le menu déroulé.
//
// On les rend collants en tête de la zone défilante. Pas en les déplaçant hors du menu — ils sont
// écrits par un autre module, et un jour ce module changera : on les ENVELOPPE après coup, et
// l'enveloppe est collante. Si js/74 cesse d'en poser, il n'y a simplement plus rien à envelopper.
//
// Le fond de l'enveloppe est opaque, sinon les rubriques défilent en transparence dessous et on
// lit deux textes superposés.

function mefEnvelopper() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const debut = nav.querySelector(':scope > .nav-chercher');
  if (!debut) return;                                  // le bloc n'est pas (encore) posé
  if (debut.parentElement && debut.parentElement.classList.contains('nav-fixe')) return;

  // Du bouton de recherche jusqu'au séparateur inclus : c'est le bloc « chercher + épinglés +
  // récents » de js/74. On s'arrête à la première rubrique, quoi qu'il y ait avant.
  const pris = [];
  for (let el = debut; el; el = el.nextElementSibling) {
    pris.push(el);
    if (el.classList.contains('nav-separateur')) break;
    if (el.classList.contains('nav-groupe')) { pris.pop(); break; }
  }
  if (!pris.length) return;
  const boite = document.createElement('div');
  boite.className = 'nav-fixe';
  debut.parentElement.insertBefore(boite, debut);
  pris.forEach(el => boite.appendChild(el));
}

(function mefBrancher() {
  const st = document.createElement('style');
  st.textContent = `
    /* Collant en tête de la zone qui défile (#nav). Le fond doit être opaque : sans lui, les
       rubriques passent en transparence derrière et deux textes se superposent. */
    .nav-fixe {
      position: sticky; top: 0; z-index: 3;
      margin: 0 -12px; padding: 2px 12px 6px;
      background: var(--sidebar, #0F2D66);
      box-shadow: 0 8px 12px -8px rgba(0, 0, 0, .55);
    }
    .nav-fixe .nav-separateur { margin-bottom: 0; }
    /* Quand les épinglés sont nombreux, ils ne doivent pas manger tout le menu : au-delà, le bloc
       défile pour lui-même et les rubriques gardent de la place. */
    .nav-fixe { max-height: 46vh; overflow-y: auto; overscroll-behavior: contain; }`;
  document.head.appendChild(st);

  const nav = document.getElementById('nav');
  if (nav) {
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(mefEnvelopper, 40); })
      .observe(nav, { childList: true });
  }
  const demarrer = () => { mefEnvelopper(); setInterval(mefEnvelopper, 2000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
