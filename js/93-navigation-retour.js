// ═══ LE RETOUR EN ARRIÈRE, REFAIT (20.09.2026) ═════════════════════════════════════════════════
// « Vérifie les flèches et la logique de retour en arrière et parcours dans le site. Revois cette
// fonction entièrement, vestige. »
//
// RETOUR EN ARRIÈRE (au sens du dépôt) : tout tient ici et dans css/99-retour.css. Retirer leurs
// deux lignes d'index.html rend l'ancien comportement, intact — navHistory, insertBackBar et
// rbAbsorberBarre ne sont pas modifiés, seulement enveloppés.
//
// CE QUI N'ALLAIT PAS, DU PLUS GRAVE AU MOINS GRAVE.
//
// 1. LE BOUTON RETOUR DU NAVIGATEUR NE FAISAIT RIEN — ou pire. Aucune vue n'était poussée dans
//    l'historique du navigateur. Conséquence sur téléphone : le geste de balayage et le bouton
//    retour d'Android ne reculaient pas d'un écran, ils QUITTAIENT l'application. Sur ordinateur,
//    Alt+← faisait de même. C'est le réflexe le plus universel du web, et il éjectait l'utilisateur.
//
// 2. LA PILE ÉTAIT DESTRUCTIVE. goBack() faisait navHistory.pop() : revenir en arrière effaçait
//    l'étape. Il n'existait donc aucun « en avant », et un retour cliqué par erreur se payait en
//    refaisant le chemin à la main.
//
// 3. LA FLÈCHE N'ÉTAIT PAS AU MÊME ENDROIT PARTOUT. Trois mécanismes se superposaient : la barre
//    #nav-back-bar de js/03 (posée seulement si la vue a un fil d'Ariane, donc absente ailleurs),
//    son absorption dans le bandeau par js/44 (qui abandonne sur les pages à hero propre), et des
//    boutons « ← Retour » écrits en dur dans certaines fiches. D'où des écrans sans aucune flèche
//    — la fiche opportunité en était un.
//
// 4. ELLE NE DISAIT PAS OÙ ELLE RAMÈNE. « ← » seul oblige à cliquer pour savoir. Quand on sait
//    d'où l'on vient, autant l'écrire : « ← Tous les clients ».
//
// CE QUI REMPLACE : une pile unique avec un curseur (arrière ET avant), branchée sur
// history.pushState, et une flèche posée au même endroit sur tous les écrans.

const NAV_MAX = 50;

window._nav = window._nav || {
  pile: [],        // états traversés, du plus ancien au plus récent
  index: -1,       // où l'on se trouve dans la pile
  enCours: false,  // vrai pendant un déplacement : empêche de réempiler ce qu'on est en train de rejouer
};

function navEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ── Nommer un état ──────────────────────────────────────────────────────────────────────────────
// Pour écrire « ← Tous les clients » plutôt que « ← ». On cherche d'abord le nom réel de
// l'enregistrement ouvert, puis le libellé du menu, et on se rabat sur l'identifiant de vue.
function navNom(etat) {
  if (!etat) return 'Accueil';
  const cl = id => {
    const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === id);
    if (!c) return null;
    return (typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : [c.prenom, c.nom].filter(Boolean).join(' ');
  };
  switch (etat.type) {
    case 'client': return cl(etat.id) || 'Fiche client';
    case 'rappel': {
      const r = (typeof allRappels !== 'undefined' ? allRappels : []).find(x => x.id === etat.id);
      return r ? (r.titre || 'Tâche') : 'Tâche';
    }
    case 'opportunite': {
      const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === etat.id);
      return o ? (o.titre || 'Affaire') : 'Affaire';
    }
    case 'campagne': return 'Campagne';
    case 'demande-offre': return 'Demande d’offre';
    case 'conseil': return 'Dossier de conseil';
    default: {
      const i = typeof rbInfosVue === 'function' ? rbInfosVue(etat.view) : null;
      return (i && i.titre) || 'Accueil';
    }
  }
}

function navMeme(a, b) {
  if (!a || !b) return false;
  return a.type === b.type && (a.id || '') === (b.id || '') && (a.view || '') === (b.view || '');
}

// ── La pile ─────────────────────────────────────────────────────────────────────────────────────
// Empiler TRONQUE ce qui était devant : c'est le comportement d'un navigateur, et celui que tout
// le monde attend. Partir d'un écran intermédiaire vers une branche nouvelle abandonne l'ancienne.
function navEmpiler(etat) {
  const N = window._nav;
  if (!etat || N.enCours) return;
  if (navMeme(N.pile[N.index], etat)) return;
  N.pile = N.pile.slice(0, N.index + 1);
  N.pile.push(etat);
  if (N.pile.length > NAV_MAX) N.pile.shift();
  N.index = N.pile.length - 1;

  // L'historique du navigateur reçoit une entrée par écran : le bouton ←, Alt+← et le geste de
  // balayage sur téléphone reculent alors DANS l'application au lieu d'en sortir.
  try { history.pushState({ nav: N.index }, '', location.pathname + location.search); } catch (e) { /* contexte sans history */ }
}

function navPeut(sens) {
  const N = window._nav;
  return sens < 0 ? N.index > 0 : N.index < N.pile.length - 1;
}

async function navAller(sens) {
  const N = window._nav;
  if (!navPeut(sens)) {
    if (sens < 0 && typeof navigate === 'function') await navigate('dashboard');
    return;
  }
  N.index += sens;
  await navRejouer(N.pile[N.index]);
}

// Rejouer un état sans le réempiler. On réutilise restaurerEtat() de js/03 : il sait déjà ouvrir
// chaque type de fiche, et le réécrire ici créerait deux vérités.
async function navRejouer(etat) {
  const N = window._nav;
  N.enCours = true;
  try {
    if (typeof vueDetailActive !== 'undefined') vueDetailActive = null;
    if (typeof restaurerEtat === 'function') await restaurerEtat(etat);
  } finally {
    N.enCours = false;
  }
  navPoserFleche();
}

// ── La flèche, au même endroit partout ──────────────────────────────────────────────────────────
// Posée après chaque rendu, dans le bandeau quand il y en a un, en tête de page sinon. Une seule
// origine, donc un seul endroit à corriger le jour où elle bouge.
function navPoserFleche() {
  const main = document.getElementById('main-content');
  if (!main || typeof currentUser === 'undefined' || !currentUser) return;

  document.querySelectorAll('.nav-fleche-bloc').forEach(e => e.remove());
  // Les boutons « ← Retour » écrits en dur dans certaines fiches : ils feraient doublon.
  main.querySelectorAll('.opx-lien-retour').forEach(e => e.remove());

  const N = window._nav;
  if (N.index <= 0 && !navPeut(1)) return;   // rien derrière ni devant : pas de flèche

  const precedent = N.pile[N.index - 1];
  const suivant = N.pile[N.index + 1];
  const bloc = document.createElement('div');
  bloc.className = 'nav-fleche-bloc';
  bloc.innerHTML = `
    ${navPeut(-1) ? `<button type="button" class="nav-fleche" onclick="navAller(-1)"
      title="Retour vers ${navEsc(navNom(precedent))} · Alt + flèche gauche">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 5l-7 7 7 7"
        fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>${navEsc(navNom(precedent))}</span>
    </button>` : ''}
    ${navPeut(1) ? `<button type="button" class="nav-fleche nav-fleche-avant" onclick="navAller(1)"
      title="Revenir vers ${navEsc(navNom(suivant))} · Alt + flèche droite" aria-label="En avant">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 5l7 7-7 7"
        fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>` : ''}`;

  // Dans le bandeau s'il y en a un — la flèche y flotte sur le fond coloré, comme avant.
  const hero = main.querySelector(typeof RB_HEROS !== 'undefined' ? RB_HEROS : '.fcx-hero, .dbx-hero, .cf-hero');
  if (hero) {
    bloc.classList.add('sur-bandeau');
    const dedans = hero.querySelector(':scope > div:not(.fcx-hero-deco):not(.dbx-hero-deco):not(.cf-hero-deco)');
    (dedans || hero).insertBefore(bloc, (dedans || hero).firstChild);
    return;
  }
  const barre = main.querySelector(':scope > #nav-back-bar');
  if (barre) { barre.insertBefore(bloc, barre.firstChild); return; }
  main.insertAdjacentElement('afterbegin', bloc);
}

// ── Branchement ─────────────────────────────────────────────────────────────────────────────────
(function navBrancher() {
  // 1. navigate() empile l'état QUITTÉ puis le nouveau. On garde l'appel d'origine : il fait le
  //    rendu, la sidebar, la barre d'onglets — rien de tout cela n'est à refaire.
  if (typeof navigate === 'function') {
    const origine = navigate;
    window.navigate = async function (view, opts) {
      const avant = (!window._nav.enCours && typeof capturerEtatActuel === 'function' && typeof currentView !== 'undefined' && currentView)
        ? capturerEtatActuel() : null;
      const r = await origine.apply(this, arguments);
      if (!(opts && opts.silent)) {
        if (avant && !window._nav.pile.length) navEmpiler(avant);
        navEmpiler(typeof capturerEtatActuel === 'function' ? capturerEtatActuel() : { type: 'view', view });
      }
      navPoserFleche();
      return r;
    };
  }

  // 2. Les fiches détail ne passent pas par navigate() : elles posent vueDetailActive puis
  //    dessinent. On les rattrape en enveloppant les ouvreurs connus.
  for (const nom of ['showClient', 'showRappel', 'showCampagne', 'ouvrirDossierConseil']) {
    if (typeof window[nom] !== 'function') continue;
    const origine = window[nom];
    window[nom] = async function () {
      const r = await origine.apply(this, arguments);
      if (!window._nav.enCours && typeof capturerEtatActuel === 'function') navEmpiler(capturerEtatActuel());
      navPoserFleche();
      return r;
    };
  }

  // 3. goBack() garde son nom — il est appelé depuis des dizaines d'endroits — mais suit
  //    désormais le curseur au lieu de dépiler.
  window.goBack = function () { return navAller(-1); };

  // 4. Le bouton ← du navigateur, le geste de balayage et le bouton retour d'Android.
  //    On compare l'index poussé à celui où l'on se trouve pour savoir dans quel sens aller.
  window.addEventListener('popstate', (e) => {
    const cible = e.state && typeof e.state.nav === 'number' ? e.state.nav : null;
    const N = window._nav;
    if (cible === null) { navAller(-1); return; }
    if (cible === N.index) return;
    const sens = cible < N.index ? -1 : 1;
    const pas = Math.abs(cible - N.index);
    N.index += sens * (pas - 1);           // on saute d'un coup, sans rejouer les écrans traversés
    navAller(sens);
  });

  // 5. Alt + flèches, comme partout ailleurs sur le web.
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const cible = e.target;
    if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); navAller(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); navAller(1); }
  });

  // 6. Premier état, une fois la session ouverte : sans lui, la première flèche n'aurait nulle
  //    part où revenir.
  const amorcer = () => {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    if (window._nav.pile.length) return;
    navEmpiler(typeof capturerEtatActuel === 'function' ? capturerEtatActuel() : { type: 'view', view: 'dashboard' });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', amorcer);
  else setTimeout(amorcer, 400);
})();
