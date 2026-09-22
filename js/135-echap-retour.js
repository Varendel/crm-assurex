// ═══ ÉCHAP ET ← : ÉCRAN PRÉCÉDENT (22.09.2026) ══════════════════════════════════════════════════
// « Ajoute touche Échap, flèche retour : écran précédent. »
// Même chemin que le bouton « ← écran précédent » de la barre du haut (navReculer, js/93) : même
// pile, même historique du navigateur.
//
// Garde-fous : Échap sert d'abord à fermer ce qui est ouvert. Si une fenêtre, un menu, la
// recherche ou un champ en cours de saisie est actif au moment de l'appui, on ne recule pas —
// l'état est lu en phase de capture, AVANT que le gestionnaire de la fenêtre ne la ferme.
// La flèche ← seule ne recule que hors des champs, listes d'onglets et zones défilantes où elle
// a déjà un sens.

function ecrOuvert() {
  const vis = el => el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  const sel = '.rex-modale, [role="dialog"], [aria-modal="true"], [id^="modal-"], .modal-overlay, .modal, #verif, .nav-rapide.ouvert, .rg-resultats:not(:empty), #recherche-globale-resultats:not(:empty)';
  return [...document.querySelectorAll(sel)].some(vis);
}
function ecrChamp(t) {
  return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
}

(function ecrBrancher() {
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return;
    if (e.key !== 'Escape' && e.key !== 'ArrowLeft') return;
    if (typeof currentUser === 'undefined' || !currentUser || typeof navReculer !== 'function') return;
    const t = e.target;
    if (ecrChamp(t) || ecrOuvert()) return;   // Échap ferme / quitte le champ : rien d'autre
    if (e.key === 'ArrowLeft' && t && t.closest && t.closest('[role="tablist"], [role="slider"], [role="listbox"], [role="menu"], .ja-fil, .carrousel, [data-fleches]')) return;
    // On laisse passer les autres gestionnaires (fermeture d'un panneau non repéré, etc.) puis on
    // recule seulement si personne n'a consommé la touche.
    setTimeout(() => { if (!e.defaultPrevented && !ecrOuvert()) navReculer(-1); }, 0);
  }, true);

  // Le bouton de la barre du haut annonce le raccourci.
  if (typeof navPoserFleche === 'function') {
    const pose = navPoserFleche;
    window.navPoserFleche = function () {
      const r = pose.apply(this, arguments);
      const b = document.getElementById('rex-retour');
      if (b && !b.disabled && !/Échap/.test(b.title)) b.title = b.title.replace('Alt + ←', 'Échap · ← · Alt + ←');
      return r;
    };
  }
})();
