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

function rbAppliquer() {
  const main = document.getElementById('main-content');
  if (!main || typeof currentUser === 'undefined' || !currentUser) return;
  if (main.querySelector(RB_HEROS)) return;
  const enfants = [...main.children].filter(rbVisible);
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
}

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
