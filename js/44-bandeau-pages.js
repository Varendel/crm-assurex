// ═══ BANDEAU BLEU FONCÉ EN TÊTE DE TOUTES LES PAGES (19.09.2026, demande de Jonathan) ═══════════
// Même esprit que le haut du tableau de bord et de la vue OZ Assure, appliqué partout sans
// réécrire chaque vue : après chaque rendu de #main-content, on repère le titre de la page
// (premier h1/h2 en haut de page) et on le DÉPLACE dans un bandeau (l'élément garde son id, donc
// les vues qui mettent leur titre à jour continuent de fonctionner). Les en-têtes modernes
// (.dx-tete, .opc-tete) sont simplement habillés en bandeau. Les pages qui ont déjà leur propre
// bandeau (tableau de bord, OZ Assure, fiche client, conseil / immo) ne sont pas touchées.

const RB_HEROS = '.dbx-hero, .ozx-hero, .fcx-hero, .cf-hero, .rex-bandeau, .rex-bandeau-hote';
const RB_HOTES = ['dx-tete', 'opc-tete'];

function rbEsc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Libellé de la page et de sa rubrique d'après le menu
function rbInfosVue(vue) {
  if (typeof SECTIONS === 'undefined') return null;
  for (const s of SECTIONS) {
    if (s.solo && (s.target === vue || s.id === vue)) return { titre: s.label, icone: s.icon || '', rubrique: '' };
    const it = (s.sub || []).find(x => x.id === vue);
    if (it) return { titre: it.label, icone: it.icon || '', rubrique: [s.label, it.groupe && it.groupe !== s.label ? it.groupe : ''].filter(Boolean).join(' · ') };
  }
  return null;
}

function rbVisible(el) {
  if (!el || el.nodeType !== 1) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.classList.contains('print-header') && !el.classList.contains('print-only');
}

// La barre « ← Retour + fil d'Ariane » (insertBackBar, js/03) est intégrée DANS le bandeau :
// flèche ronde en verre + fil d'Ariane à la place du surtitre, au lieu d'une barre grise séparée
// qui se retrouvait sous le bandeau (revu le 19.09.2026, demande de Jonathan).
function rbAbsorberBarre(barre, cible) {
  if (!barre || !cible) return;
  const bouton = barre.querySelector('button');
  const fil = barre.querySelector(':scope > div');
  const nav = document.createElement('div');
  nav.className = 'rex-bandeau-nav';
  if (bouton) { bouton.removeAttribute('style'); bouton.className = 'rb-retour'; bouton.setAttribute('aria-label', 'Retour à la page précédente'); bouton.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'; nav.appendChild(bouton); }
  if (fil) { fil.removeAttribute('style'); fil.className = 'rb-fil'; fil.querySelectorAll('[style]').forEach(x => x.removeAttribute('style')); nav.appendChild(fil); }
  if (cible.classList.contains('rex-bandeau')) {
    const texte = cible.querySelector('.rex-bandeau-texte');
    const sur = texte && texte.querySelector('.rex-bandeau-surtitre');
    if (sur) { if (fil) sur.remove(); else nav.appendChild(sur); }
    if (texte) texte.insertBefore(nav, texte.firstChild);
  } else {
    const bloc = cible.querySelector(':scope > div:not(.rex-bandeau-deco)') || cible;
    bloc.insertBefore(nav, bloc.firstChild);
  }
  barre.remove();
}

function rbAppliquer() {
  const main = document.getElementById('main-content');
  if (!main || typeof currentUser === 'undefined' || !currentUser) return;
  // L'espace client a son propre en-tête (js/112) : le bandeau du CRM y déplaçait le nom du client.
  if (currentUser.role === 'client' || document.body.classList.contains('mode-espace-client')) return;
  const barre = main.querySelector(':scope > #nav-back-bar');
  const existant = main.querySelector('.rex-bandeau, .rex-bandeau-hote');
  if (existant) { rbAbsorberBarre(barre, existant); return; }
  if (main.querySelector(RB_HEROS)) return; // pages avec leur propre bandeau : la barre reste, restylée en CSS
  const enfants = [...main.children].filter(x => rbVisible(x) && x.id !== 'nav-back-bar');
  if (!enfants.length || (enfants.length === 1 && enfants[0].classList.contains('loader'))) return;

  const infos = rbInfosVue(typeof currentView !== 'undefined' ? currentView : '') || { titre: '', icone: '', rubrique: '' };
  const date = new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // 1. En-tête moderne en haut de page → habillé en bandeau
  const premier = enfants[0];
  const hote = RB_HOTES.some(c => premier.classList.contains(c)) ? premier : premier.querySelector(':scope > .dx-tete, :scope > .opc-tete');
  if (hote) {
    hote.classList.add('rex-bandeau-hote');
    if (!hote.querySelector('.rex-bandeau-deco')) hote.insertAdjacentHTML('afterbegin', '<div class="rex-bandeau-deco" aria-hidden="true"></div>');
    // Boutons transparents → texte blanc ; boutons pleins (principaux) inchangés
    hote.querySelectorAll('button, a.btn, select').forEach(b => {
      const bg = getComputedStyle(b).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      const alpha = m ? (m[1].split(',')[3] !== undefined ? Number(m[1].split(',')[3]) : 1) : 0;
      if (alpha < 0.15) b.classList.add('rb-bouton-clair');
    });
    rbAbsorberBarre(barre, hote);
    return;
  }

  // 2. Titre existant (premier h1/h2 dans le haut de page) → déplacé dans le bandeau
  let titreEl = null;
  for (const el of enfants.slice(0, 3)) {
    if (/^H[12]$/.test(el.tagName)) { titreEl = el; break; }
    const h = [...el.querySelectorAll('h1, h2')].find(x => rbVisible(x) && x.closest('.dbx-carte, .card, table, form, .modal') == null);
    if (h && (h.parentElement === el || h.parentElement.parentElement === el)) { titreEl = h; break; }
  }
  const sousEl = titreEl && titreEl.parentElement === main && titreEl.nextElementSibling && /^(DIV|P)$/.test(titreEl.nextElementSibling.tagName)
    && !titreEl.nextElementSibling.querySelector('button, input, select, div, table') &&titreEl.nextElementSibling.textContent.trim().length < 400 ? titreEl.nextElementSibling : null;

  const bandeau = document.createElement('section');
  bandeau.className = 'rex-bandeau';
  bandeau.innerHTML = `<div class="rex-bandeau-deco" aria-hidden="true"></div>
    <div class="rex-bandeau-texte">
      <span class="rex-bandeau-surtitre">${rbEsc(infos.rubrique || 'REX · Assurex')}</span>
      <div class="rex-bandeau-titre"></div>
      <div class="rex-bandeau-sous"></div>
    </div>
    <div class="rex-bandeau-droite"><span class="rex-bandeau-date">${rbEsc(date)}</span>${typeof LOGO_EXGROUPE_SVG !== 'undefined' ? `<span class="rex-bandeau-logo">${LOGO_EXGROUPE_SVG}</span>` : ''}</div>`;
  const zoneTitre = bandeau.querySelector('.rex-bandeau-titre');
  if (titreEl) {
    const parent = titreEl.parentElement;
    zoneTitre.appendChild(titreEl);
    // Conteneur d'en-tête devenu vide (ou avec seulement un compteur) : on le masque
    if (parent !== main && parent && !parent.querySelector('button, input, select, a') && !parent.textContent.trim()) parent.style.display = 'none';
  } else if (infos.titre) {
    zoneTitre.innerHTML = `<h1>${infos.icone ? `<span class="rex-bandeau-icone">${infos.icone}</span>` : ''}${rbEsc(infos.titre)}</h1>`;
  } else return;
  if (sousEl) bandeau.querySelector('.rex-bandeau-sous').appendChild(sousEl);
  main.insertBefore(bandeau, main.firstChild);
  rbAbsorberBarre(barre, bandeau);
}

// ═══ HISTORIQUE DU NAVIGATEUR : retiré le 21.09.2026 ═══════════════════════════════════════════
// Il doublait celui de js/93 : deux écouteurs « popstate » reculaient chacun d'un pas, et un seul
// « précédent » du navigateur sautait deux écrans. js/93 tient désormais seul l'historique.

// Réapplique après chaque rendu (navigation, onglets internes qui réécrivent la page)
(function rbObserver() {
  const demarrer = () => {
    const main = document.getElementById('main-content');
    if (!main) return;
    let prevu = false;
    new MutationObserver(() => {
      if (prevu) return;
      prevu = true;
      // microtâche : appliqué avant l'affichage, sans clignotement (et même onglet en arrière-plan)
      queueMicrotask(() => { prevu = false; try { rbAppliquer(); } catch (e) { console.warn('bandeau', e); } });
    }).observe(main, { childList: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
