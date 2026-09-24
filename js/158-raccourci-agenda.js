// ═══ L'AGENDA, TOUT EN HAUT DU MENU (24.09.2026) ════════════════════════════════════════════════
// « Mets-moi un raccourci agenda dans le menu tout en haut, sous Rex. »
//
// L'Agenda existe déjà comme entrée de menu, mais rangé dans son groupe : il faut déplier pour
// l'atteindre. C'est l'écran qu'on ouvre plusieurs fois par jour — il mérite d'être à portée
// permanente, juste sous la marque, au-dessus des rubriques.
//
// Posé en JavaScript plutôt qu'écrit dans index.html pour une raison : l'état actif doit suivre la
// navigation, et le bouton reprend les classes du menu (nav-solo-btn) pour ne pas être un corps
// étranger le jour où la feuille de style du menu change.

function ragPoser() {
  const logo = document.querySelector('.sidebar .sidebar-logo');
  if (!logo || document.getElementById('rag-agenda')) return;
  logo.insertAdjacentHTML('afterend',
    `<button type="button" id="rag-agenda" class="nav-solo-btn rag-agenda" onclick="navigate('agenda')">
       <span class="nav-ico" aria-hidden="true">🗓️</span><span class="nav-lib">Agenda</span>
     </button>`);
  ragMajActif();
}

// L'état actif n'est pas déductible d'un clic : on peut arriver sur l'agenda par le menu déplié,
// par le tableau de bord (« Vue complète → ») ou par la reconnexion Outlook. On le relit.
function ragMajActif() {
  const b = document.getElementById('rag-agenda');
  if (b) b.classList.toggle('active', typeof currentView !== 'undefined' && currentView === 'agenda');
}

(function ragBrancher() {
  const st = document.createElement('style');
  st.textContent = `
    .rag-agenda { width: 100%; margin: 0 0 6px; }`;
  document.head.appendChild(st);

  // Le menu est reconstruit à chaque rendu (renderNav) : l'observateur le repose, et remet l'état
  // actif à jour au passage d'un écran à l'autre.
  const barre = document.querySelector('.sidebar');
  if (barre) {
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { ragPoser(); ragMajActif(); }, 60); })
      .observe(barre, { childList: true, subtree: true });
  }
  const main = document.getElementById('main-content');
  if (main) new MutationObserver(() => ragMajActif()).observe(main, { childList: true });

  const demarrer = () => setTimeout(ragPoser, 150);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
