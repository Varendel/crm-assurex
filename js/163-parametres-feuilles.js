// ═══ PARAMÈTRES, EN FEUILLES (25.09.2026) ══════════════════════════════════════════════════════
// « Paramètres Agents : range cette feuille dans Paramètres, le bouton en bas du menu. Tu la mets
//   comme feuille. »
//
// Le bouton du pied de menu ouvrait « Apparence », une page à part, pendant que « Agents » vivait
// tout en bas de la section RH — alors que la page se titre elle-même « Paramètres — Agents ».
// Deux endroits pour une même idée : ce qu'on règle une fois et qu'on ne touche plus.
//
// Ici, Paramètres devient une page à FEUILLES, comme un classeur : un onglet par sujet, la feuille
// active en dessous. La feuille choisie est retenue sur l'appareil — c'est une commodité
// d'affichage, pas une donnée : elle n'a rien à faire sur le serveur.
//
// Parti pris : ce module ne réécrit aucune vue. Il enveloppe viewApparence, y glisse la barre de
// feuilles, et appelle la fonction de rendu existante de la feuille active. viewAgents reste ce
// qu'elle est, et une feuille ajoutée demain n'a qu'une ligne à écrire dans PRM_FEUILLES.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. « Agents » revient dans le menu RH et
// Paramètres redevient la seule page Apparence.

const PRM_MEMOIRE = 'crm_parametres_feuille';

// Une feuille : son onglet, et ce qu'elle affiche. `staff` exclut la session RH — la page Agents
// montre les commissions générées, elle n'a rien à faire sous ses yeux.
// `asynchrone` : la feuille rend une promesse. On affiche alors un chargement, puis on remplace
// — viewContactsCompagnies va chercher ses contacts en base avant de savoir quoi écrire.
const PRM_FEUILLES = [
  { id: 'apparence', icone: '🎨', label: 'Apparence', rendu: () => (typeof _prmApparenceOrigine === 'function' ? _prmApparenceOrigine() : '') },
  { id: 'agents', icone: '🧑‍🤝‍🧑', label: 'Agents', staff: true, rendu: () => (typeof viewAgents === 'function' ? viewAgents() : '<p>Page Agents indisponible.</p>') },
  { id: 'contacts-compagnies', icone: '🏢', label: 'Contacts compagnies', staff: true, asynchrone: true,
    rendu: () => (typeof viewContactsCompagnies === 'function' ? viewContactsCompagnies() : Promise.resolve('<p>Page Contacts compagnies indisponible.</p>')) },
];

let _prmApparenceOrigine = null;

function prmFeuillesVisibles() {
  const rh = typeof estRoleRH === 'function' && estRoleRH();
  return PRM_FEUILLES.filter(f => !(f.staff && rh));
}

function prmFeuilleActive() {
  const visibles = prmFeuillesVisibles();
  let choisie = null;
  try { choisie = localStorage.getItem(PRM_MEMOIRE); } catch (e) { /* navigation privée */ }
  return visibles.find(f => f.id === choisie) || visibles[0];
}

function prmEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Changer de feuille : on retient le choix puis on redemande la page. Passer par navigate() plutôt
// que de remplacer le HTML à la main, pour que tout ce qui se greffe après le rendu se rejoue.
function prmOuvrirFeuille(id) {
  try { localStorage.setItem(PRM_MEMOIRE, id); } catch (e) { /* le choix ne survivra pas, tant pis */ }
  if (typeof navigate === 'function') navigate('apparence');
}

function prmBarreHtml(active) {
  const f = prmFeuillesVisibles();
  if (f.length < 2) return '';
  return `<div class="prm-feuilles" role="tablist" aria-label="Feuilles des paramètres">
    ${f.map(x => `<button type="button" role="tab" aria-selected="${x.id === active.id}"
      class="prm-feuille ${x.id === active.id ? 'active' : ''}" onclick="prmOuvrirFeuille('${x.id}')">
      <span aria-hidden="true">${x.icone}</span> ${prmEsc(x.label)}</button>`).join('')}
  </div>`;
}

(function prmBrancher() {
  if (typeof viewApparence !== 'function') return;
  _prmApparenceOrigine = viewApparence;
  window.viewApparence = function () {
    const active = prmFeuilleActive();
    if (!active) return _prmApparenceOrigine.apply(this, arguments);
    // Une feuille asynchrone ne peut rien rendre tout de suite : on pose la page, puis on remplit.
    // Le jeton évite qu'une réponse lente n'écrase une feuille ouverte entre-temps.
    let corps;
    if (active.asynchrone) {
      const jeton = 'prm-' + Date.now().toString(36);
      corps = `<div id="${jeton}" class="loader">Chargement…</div>`;
      Promise.resolve().then(() => active.rendu()).then(h => {
        const z = document.getElementById(jeton);
        if (z && prmFeuilleActive().id === active.id) z.outerHTML = h;
      }).catch(e => {
        const z = document.getElementById(jeton);
        if (z) z.innerHTML = `<p class="prm-echec">Cette feuille n’a pas pu se charger : ${prmEsc(e && e.message || e)}</p>`;
      });
    } else {
      corps = active.rendu();
    }
    return `<div class="prm-page">
      <h2 class="prm-titre">Paramètres</h2>
      ${prmBarreHtml(active)}
      <div class="prm-contenu" role="tabpanel">${corps}</div>
    </div>`;
  };

  // Les pages devenues des feuilles sortent du menu : elles vivent désormais dans Paramètres, et
  // deux chemins vers le même écran, c'est un de trop. On retire l'entrée où qu'elle soit.
  const dansLeMenu = PRM_FEUILLES.map(f => f.id).filter(id => id !== 'apparence');
  if (typeof SECTIONS !== 'undefined' && Array.isArray(SECTIONS)) {
    for (const sec of SECTIONS) {
      if (!Array.isArray(sec.sub)) continue;
      for (const id of dansLeMenu) {
        const i = sec.sub.findIndex(v => v.id === id);
        if (i >= 0) sec.sub.splice(i, 1);
      }
    }
  }

  // Les liens qui pointent encore vers ces vues (favoris, recherche rapide, raccourcis) doivent
  // continuer de marcher : ils ouvrent Paramètres sur la bonne feuille au lieu d'une page nue.
  if (typeof navigate === 'function' && !navigate._prmRedirige) {
    const origine = navigate;
    const enveloppe = function (vue, ...reste) {
      if (dansLeMenu.includes(vue)) {
        try { localStorage.setItem(PRM_MEMOIRE, vue); } catch (e) {}
        return origine.call(this, 'apparence', ...reste);
      }
      return origine.call(this, vue, ...reste);
    };
    enveloppe._prmRedirige = true;
    window.navigate = enveloppe;
  }
})();

(function prmStyles() {
  if (document.getElementById('prm-styles')) return;
  const s = document.createElement('style');
  s.id = 'prm-styles';
  s.textContent = `
    .prm-titre { margin: 0 0 14px; font-size: 18px; font-weight: 600; color: var(--text); }
    .prm-feuilles { display: flex; gap: 4px; padding: 3px; margin-bottom: 18px; border: 1px solid var(--border);
      border-radius: 11px; background: var(--surface-alt); width: fit-content; max-width: 100%; overflow-x: auto; }
    .prm-feuille { border: 0; background: transparent; color: var(--text-muted); font: inherit;
      font-size: var(--t-s, 13px); font-weight: 600; padding: 7px 14px; border-radius: 8px; cursor: pointer;
      display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; }
    .prm-feuille:hover { color: var(--text); }
    .prm-feuille.active { background: var(--accent-dim); color: var(--accent); }
    .prm-feuille:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    /* La feuille rendue porte souvent son propre titre (« Paramètres — Agents ») : il ferait
       doublon sous celui de la page. On masque le premier h2 de la feuille, pas les suivants. */
    .prm-contenu > h2:first-child { display: none; }
    .prm-echec { font-size: var(--t-s, 13px); color: var(--c-danger-texte, #b91c1c); }
  `;
  document.head.appendChild(s);
})();
