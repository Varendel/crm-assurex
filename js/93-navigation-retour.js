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

// ── Repris le 21.09.2026 ──────────────────────────────────────────────────────────────────────
// « Le bouton retour qui apparaît des fois n'a pas la bonne logique. Mets des flèches de retour à
// la page précédente visitée et de retour au menu rattaché. »
// Constaté : il restait QUATRE flèches — celle de la barre du haut (js/111, grisée selon l'ancienne
// pile de js/03 alors qu'elle suivait celle-ci), celle du bandeau (js/44 via insertBackBar), la
// flèche flottante d'ici (posée seulement quand il y avait un historique : « des fois ») et les
// « ← Retour » écrits en dur. Et deux écouteurs du bouton précédent du navigateur (js/44 et ici)
// qui reculaient chacun d'un pas. Désormais : deux boutons, toujours au même endroit, dans la
// barre du haut — « ← écran précédent » (nommé) et « ↑ menu rattaché » (nommé) — et un seul
// historique, synchronisé avec celui du navigateur.
const NAV_MAX = 200;

window._hist = window._hist || {
  pile: [],        // états traversés, du plus ancien au plus récent
  index: -1,       // où l'on se trouve dans la pile
  enCours: false,  // vrai pendant un déplacement : empêche de réempiler ce qu'on est en train de rejouer
};

function histEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

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
  const N = window._hist;
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
  const N = window._hist;
  return sens < 0 ? N.index > 0 : N.index < N.pile.length - 1;
}

async function histAller(sens) {
  const N = window._hist;
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
  const N = window._hist;
  N.enCours = true;
  try {
    if (typeof vueDetailActive !== 'undefined') vueDetailActive = null;
    if (typeof restaurerEtat === 'function') await restaurerEtat(etat);
  } finally {
    N.enCours = false;
  }
  navPoserFleche();
}

// ── Reculer / avancer ───────────────────────────────────────────────────────────────────────────
// Les boutons passent par l'historique du navigateur quand il est aligné sur la pile : ainsi le
// bouton de l'écran et celui du navigateur restent synchrones (sinon, après un clic sur la flèche
// de l'écran, le « précédent » du navigateur tombait sur l'écran déjà affiché et ne faisait rien).
function navReculer(sens) {
  const N = window._hist;
  const s = history.state;
  if (navPeut(sens) && s && typeof s.nav === 'number' && s.nav === N.index) { history.go(sens); return; }
  histAller(sens);
}

// ── Le menu rattaché ────────────────────────────────────────────────────────────────────────────
// Où « remonte » l'écran ouvert : une fiche vers sa liste, un écran du menu vers sa rubrique dans
// la Vue d'ensemble. Rien pour le tableau de bord et la Vue d'ensemble : ce sont les sommets.
function navParent() {
  const vue = typeof currentView !== 'undefined' ? currentView : '';
  const det = typeof vueDetailActive !== 'undefined' ? vueDetailActive : null;
  const liste = (id, nom) => ({ nom, aller: () => navigate(id) });
  if (det) {
    if (det.type === 'client') {
      const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === det.id);
      const ent = c && typeof estEntreprise === 'function' && estEntreprise(c);
      return ent ? liste('clients-entreprises', 'Entreprises') : liste('clients-prives', 'Clients privés');
    }
    if (det.type === 'rappel') return liste('rappels', 'Tâches & rappels');
    if (det.type === 'campagne') return liste('campagnes', 'Campagnes');
    if (det.type === 'conseil') return liste('conseil', 'Conseil financier');
  }
  if (vue === 'nouvelle-opportunite') return liste('opportunites', 'Pipeline');
  if (vue === 'dossier-conseil') return liste('conseil', 'Conseil financier');
  if (!vue || vue === 'dashboard' || vue === 'vue-ensemble') return null;
  for (const sec of (typeof SECTIONS !== 'undefined' ? SECTIONS : [])) {
    if (sec.solo || !(sec.sub || []).some(x => x.id === vue)) continue;
    return {
      nom: sec.label,
      aller: async () => {
        await navigate('vue-ensemble');
        setTimeout(() => { if (typeof rbqAller === 'function') rbqAller(sec.id); }, 60);
      },
    };
  }
  return { nom: 'Vue d’ensemble', aller: () => navigate('vue-ensemble') };
}
function navMonter() { const p = navParent(); if (p) p.aller(); }

// ── Les deux boutons, dans la barre du haut ─────────────────────────────────────────────────────
// Toujours présents (grisés quand il n'y a nulle part où aller), au même endroit sur tous les
// écrans, et nommés : on sait où l'on arrive avant de cliquer.
const NAV_SVG_RETOUR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H6M11 6.5 5.5 12l5.5 5.5"/></svg>';
const NAV_SVG_MONTER = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M6.5 11 12 5.5l5.5 5.5"/></svg>';

function navPoserFleche() {
  // Les anciennes flèches : flottante (ici, avant), dans le bandeau (js/44), écrites en dur.
  document.querySelectorAll('.nav-fleche-bloc, #main-content .opx-lien-retour, #main-content .rb-retour, #main-content > #nav-back-bar').forEach(e => e.remove());

  const retour = document.getElementById('rex-retour');
  const monter = document.getElementById('rex-monter');
  if (!retour) return;
  const N = window._hist;
  const prec = navPeut(-1) ? navNom(N.pile[N.index - 1]) : '';
  retour.disabled = !prec;
  retour.innerHTML = `${NAV_SVG_RETOUR}<span class="rex-nav-txt">${prec ? histEsc(prec) : 'Précédent'}</span>`;
  retour.title = prec ? `Revenir à « ${prec} » · Alt + ←` : 'Aucun écran précédent';
  retour.setAttribute('aria-label', prec ? `Revenir à l’écran précédent : ${prec}` : 'Aucun écran précédent');

  if (!monter) return;
  const p = navParent();
  monter.hidden = !p;
  if (p) {
    monter.innerHTML = `${NAV_SVG_MONTER}<span class="rex-nav-txt">${histEsc(p.nom)}</span>`;
    monter.title = `Remonter au menu « ${p.nom} » · Alt + ↑`;
    monter.setAttribute('aria-label', `Remonter au menu rattaché : ${p.nom}`);
  }
}

// La barre « ← + fil d'Ariane » de js/03, posée en tête de chaque écran : son rôle est repris par
// la barre du haut (flèches + fil d'Ariane). On ne la pose plus.
window.insertBackBar = function () {};

// ── Branchement ─────────────────────────────────────────────────────────────────────────────────
(function navBrancher() {
  // 1. navigate() empile l'état QUITTÉ puis le nouveau. On garde l'appel d'origine : il fait le
  //    rendu, la sidebar, la barre d'onglets — rien de tout cela n'est à refaire.
  if (typeof navigate === 'function') {
    const origine = navigate;
    window.navigate = async function (view, opts) {
      const avant = (!window._hist.enCours && typeof capturerEtatActuel === 'function' && typeof currentView !== 'undefined' && currentView)
        ? capturerEtatActuel() : null;
      const r = await origine.apply(this, arguments);
      if (!(opts && opts.silent)) {
        if (avant && !window._hist.pile.length) navEmpiler(avant);
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
      if (!window._hist.enCours && typeof capturerEtatActuel === 'function') navEmpiler(capturerEtatActuel());
      navPoserFleche();
      return r;
    };
  }

  // 3. goBack() garde son nom — il est appelé depuis des dizaines d'endroits — mais suit
  //    désormais le curseur au lieu de dépiler.
  window.goBack = function () { return navReculer(-1); };

  // 4. Le bouton ← du navigateur, le geste de balayage et le bouton retour d'Android.
  //    On compare l'index poussé à celui où l'on se trouve pour savoir dans quel sens aller.
  window.addEventListener('popstate', async (e) => {
    const cible = e.state && typeof e.state.nav === 'number' ? e.state.nav : null;
    const N = window._hist;
    // Une fenêtre ouverte : « précédent » la ferme sans changer d'écran (repris de js/44).
    const modales = document.querySelectorAll('.rex-modale');
    if (modales.length) {
      modales[modales.length - 1].remove();
      try { history.pushState({ nav: N.index }, '', location.pathname + location.search); } catch (err) {}
      return;
    }
    // Revenu avant le premier écran : on reste dans le CRM, au tableau de bord.
    if (cible === null) {
      await histAller(-1);
      if (!history.state) { try { history.pushState({ nav: window._hist.index }, '', location.pathname + location.search); } catch (err) {} }
      return;
    }
    if (cible === N.index) return;
    const sens = cible < N.index ? -1 : 1;
    const pas = Math.abs(cible - N.index);
    N.index += sens * (pas - 1);           // on saute d'un coup, sans rejouer les écrans traversés
    histAller(sens);
  });

  // 5. Alt + flèches, comme partout ailleurs sur le web.
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const cible = e.target;
    if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); navReculer(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); navReculer(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); navMonter(); }
  });

  // 6. Premier état, une fois la session ouverte : sans lui, la première flèche n'aurait nulle
  //    part où revenir.
  const amorcer = () => {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    if (window._hist.pile.length) return;
    navEmpiler(typeof capturerEtatActuel === 'function' ? capturerEtatActuel() : { type: 'view', view: 'dashboard' });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', amorcer);
  else setTimeout(amorcer, 400);
})();
