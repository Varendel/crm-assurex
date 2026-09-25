// ═══ MOSAÏQUE DE WIDGETS — LE CADENAS, LES TAILLES, LE GLISSER-DÉPOSER (25.09.2026) ═════════════
// « Je voyais un cadenas qui permet de choisir des widgets à plusieurs niveaux de grandeurs,
//   inspirés des widgets Apple mais adaptés à nos fonctions. Le déplacement et l'insertion se fait
//   un peu comme le kanban. »
//
// js/160 savait déjà masquer et réordonner, mais par un panneau, avec des flèches, et toutes les
// cartes à la même largeur. Ce qu'il manquait, c'est le geste : ouvrir le cadenas, attraper une
// carte, la poser ailleurs, et décider qu'elle prend un quart, une moitié ou toute la largeur.
//
// TROIS PARTIS PRIS
//
// 1. Rien n'est réécrit. Comme js/160, ce module lit les cartes produites par les vues existantes
//    (.dbx-carte) et se contente de les REPARENTER dans une grille. Une carte ajoutée demain
//    apparaît toute seule. Retirer la ligne de index.html rend la page d'origine, intacte.
//
// 2. La mosaïque ne s'impose à personne. Tant que l'agent n'a pas ouvert le cadenas et posé une
//    taille, `mosaique` reste faux et la page garde exactement la disposition d'aujourd'hui. On ne
//    change pas la vue de quelqu'un qui n'a rien demandé.
//
// 3. Les réglages vivent là où js/160 les range déjà — agents.preferences_pages, côté serveur,
//    donc suivis d'un poste à l'autre. On ajoute deux clés à la structure existante plutôt que d'en
//    créer une seconde à côté :
//      { "<vue>": { caches: [...], ordre: [...], mosaique: true, tailles: { "<cle>": "large" } } }
//
// Le glisser-déposer reprend le vocabulaire du kanban (js/16) : `en-deplacement` sur la carte
// attrapée, `drop-cible` sur l'emplacement visé. Même geste, mêmes repères visuels.

// Quatre colonnes : c'est ce qui permet le quart, la moitié, les trois quarts et la pleine largeur
// sans jamais tomber sur une fraction bancale.
const WGM_COLONNES = 4;

// Les tailles, dans l'ordre où le bouton les fait défiler. Le « carré » d'Apple (2×2) a une vraie
// utilité ici : l'agenda et le pipeline ont besoin de hauteur, pas de largeur.
const WGM_TAILLES = [
  ['petit', 'Quart', 1, 1],
  ['moyen', 'Moitié', 2, 1],
  ['large', 'Carré', 2, 2],
  ['pleine', 'Pleine largeur', 4, 1],
];
const WGM_DEFAUT = 'moyen';

window._wgm = window._wgm || { edition: false, glissee: null, pose: false };

function wgmPrefs(vue) {
  const p = (window._wgt && window._wgt.prefs) || {};
  return p[vue] || {};
}

function wgmTaille(vue, cle) {
  const t = (wgmPrefs(vue).tailles || {})[cle];
  return WGM_TAILLES.some(x => x[0] === t) ? t : WGM_DEFAUT;
}

function wgmActive(vue) { return !!wgmPrefs(vue).mosaique; }

function wgmEcrire(vue, maj) {
  const w = window._wgt;
  if (!w) return;
  w.prefs = w.prefs || {};
  w.prefs[vue] = Object.assign({ caches: [], ordre: [] }, w.prefs[vue] || {}, maj);
}

// ── Construire la mosaïque ──────────────────────────────────────────────────────────────────────
// Les cartes sont dispersées dans .dbx-trio et .dbx-col ; on les rassemble dans une seule grille,
// dans l'ordre enregistré. Les conteneurs vidés disparaissent — sinon ils laissent des marges
// fantômes au milieu de la page.
function wgmConstruire() {
  const main = document.getElementById('main-content');
  if (!main || typeof wgtCle !== 'function') return false;
  const vue = typeof wgtVue === 'function' ? wgtVue() : 'dashboard';
  if (!wgmActive(vue)) return false;

  const cartes = [...main.querySelectorAll('.dbx-carte')];
  if (!cartes.length) return false;

  let grille = main.querySelector('.wgm-grille');
  // Déjà construite et complète : on ne refait rien, sinon l'observateur et nous jouerions au
  // ping-pong jusqu'à la fin des temps.
  if (grille && cartes.every(c => c.parentElement === grille)) { wgmAppliquerTailles(); return true; }

  if (!grille) {
    grille = document.createElement('div');
    grille.className = 'wgm-grille';
    const ancre = main.querySelector('.dbx-trio, .dbx-grille') || cartes[0].parentElement;
    ancre.parentElement.insertBefore(grille, ancre);
  }

  const ordre = (wgmPrefs(vue).ordre || []);
  const avecCle = cartes.map(s => ({ s, cle: wgtCle(s) })).filter(x => x.cle);
  avecCle.sort((a, b) => {
    const ia = ordre.indexOf(a.cle), ib = ordre.indexOf(b.cle);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  avecCle.forEach(({ s, cle }) => { s.dataset.wgt = cle; s.style.order = ''; grille.appendChild(s); });

  // Les conteneurs d'origine, maintenant vides.
  main.querySelectorAll('.dbx-trio, .dbx-grille, .dbx-col').forEach(c => {
    if (c !== grille && !c.querySelector('.dbx-carte')) c.remove();
  });

  wgmAppliquerTailles();
  return true;
}

function wgmAppliquerTailles() {
  const main = document.getElementById('main-content');
  const grille = main && main.querySelector('.wgm-grille');
  if (!grille) return;
  const vue = typeof wgtVue === 'function' ? wgtVue() : 'dashboard';
  const caches = wgmPrefs(vue).caches || [];
  [...grille.children].forEach(s => {
    const cle = s.dataset.wgt;
    if (!cle) return;
    const t = WGM_TAILLES.find(x => x[0] === wgmTaille(vue, cle)) || WGM_TAILLES[1];
    s.style.gridColumn = `span ${Math.min(t[2], WGM_COLONNES)}`;
    s.style.gridRow = t[3] > 1 ? `span ${t[3]}` : '';
    s.dataset.wgmTaille = t[0];
    // Une carte masquée reste dans la grille en mode édition : c'est là qu'on la fait revenir.
    const masquee = caches.includes(cle);
    s.classList.toggle('wgm-masquee', masquee);
    s.style.display = masquee && !window._wgm.edition ? 'none' : '';
  });
}

// ── Le cadenas ──────────────────────────────────────────────────────────────────────────────────
function wgmBouton() {
  const main = document.getElementById('main-content');
  if (!main || document.getElementById('wgm-cadenas')) return;
  if (!main.querySelector('.dbx-carte')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'wgm-cadenas';
  b.className = 'wgm-cadenas';
  b.onclick = wgmBasculerEdition;
  const onglets = main.querySelector('.dbx-onglets');
  if (onglets) onglets.appendChild(b); else main.insertBefore(b, main.firstChild);
  wgmMajBouton();
}

function wgmMajBouton() {
  const b = document.getElementById('wgm-cadenas');
  if (!b) return;
  const ouvert = window._wgm.edition;
  b.textContent = ouvert ? '🔓 Terminer' : '🔒 Disposer';
  b.title = ouvert ? 'Fermer le cadenas et enregistrer' : 'Ouvrir le cadenas pour déplacer et redimensionner les widgets';
  b.classList.toggle('actif', ouvert);
}

async function wgmBasculerEdition() {
  const vue = typeof wgtVue === 'function' ? wgtVue() : 'dashboard';
  if (window._wgm.edition) {
    window._wgm.edition = false;
    document.body.classList.remove('wgm-edition');
    wgmHabiller(false);
    wgmAppliquerTailles();
    wgmMajBouton();
    if (typeof wgtEnregistrer === 'function' && await wgtEnregistrer()) showError('✓ Disposition enregistrée.');
    return;
  }
  // Première ouverture : la page passe en mosaïque et garde l'ordre où elle est affichée.
  if (!wgmActive(vue)) {
    const main = document.getElementById('main-content');
    const ordre = [...main.querySelectorAll('.dbx-carte')].map(s => wgtCle(s)).filter(Boolean);
    wgmEcrire(vue, { mosaique: true, ordre: (wgmPrefs(vue).ordre || []).length ? wgmPrefs(vue).ordre : ordre, tailles: wgmPrefs(vue).tailles || {} });
    wgmConstruire();
  }
  window._wgm.edition = true;
  document.body.classList.add('wgm-edition');
  wgmAppliquerTailles();
  wgmHabiller(true);
  wgmMajBouton();
}

// En mode édition, chaque carte reçoit sa barre : poignée, taille, œil. Hors édition, tout est
// retiré — une carte ne doit pas porter de commandes quand on est en train de la lire.
function wgmHabiller(actif) {
  const main = document.getElementById('main-content');
  const grille = main && main.querySelector('.wgm-grille');
  if (!grille) return;
  [...grille.children].forEach(s => {
    const barre = s.querySelector(':scope > .wgm-barre');
    if (!actif) {
      if (barre) barre.remove();
      s.draggable = false;
      s.classList.remove('en-deplacement', 'drop-cible');
      return;
    }
    s.draggable = true;
    if (barre) return;
    const cle = s.dataset.wgt || '';
    const titre = typeof wgtTitre === 'function' ? wgtTitre(s) : cle;
    const el = document.createElement('div');
    el.className = 'wgm-barre';
    el.innerHTML = `<span class="wgm-poignee" title="Glisser pour déplacer">⠿</span>
      <span class="wgm-titre">${String(titre).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</span>
      <button type="button" class="wgm-t" onclick="wgmTaillerSuivante('${cle}')" title="Changer la taille"></button>
      <button type="button" class="wgm-o" onclick="wgmBasculerVisible('${cle}')" title="Afficher ou masquer"></button>`;
    s.insertBefore(el, s.firstChild);
  });
  wgmMajBarres();
}

function wgmMajBarres() {
  const vue = typeof wgtVue === 'function' ? wgtVue() : 'dashboard';
  const caches = wgmPrefs(vue).caches || [];
  document.querySelectorAll('.wgm-grille > .dbx-carte').forEach(s => {
    const cle = s.dataset.wgt;
    const t = WGM_TAILLES.find(x => x[0] === wgmTaille(vue, cle));
    const bt = s.querySelector(':scope > .wgm-barre .wgm-t');
    const bo = s.querySelector(':scope > .wgm-barre .wgm-o');
    if (bt) bt.textContent = t ? t[1] : '';
    if (bo) bo.textContent = caches.includes(cle) ? '🙈' : '👁️';
  });
}

function wgmTaillerSuivante(cle) {
  const vue = typeof wgtVue === 'function' ? wgtVue() : 'dashboard';
  const i = WGM_TAILLES.findIndex(x => x[0] === wgmTaille(vue, cle));
  const suivante = WGM_TAILLES[(i + 1) % WGM_TAILLES.length][0];
  const tailles = Object.assign({}, wgmPrefs(vue).tailles || {});
  tailles[cle] = suivante;
  wgmEcrire(vue, { tailles });
  wgmAppliquerTailles();
  wgmMajBarres();
}

function wgmBasculerVisible(cle) {
  const vue = typeof wgtVue === 'function' ? wgtVue() : 'dashboard';
  const caches = [...(wgmPrefs(vue).caches || [])];
  const i = caches.indexOf(cle);
  if (i === -1) caches.push(cle); else caches.splice(i, 1);
  wgmEcrire(vue, { caches });
  wgmAppliquerTailles();
  wgmMajBarres();
}

// ── Glisser-déposer, comme le kanban ────────────────────────────────────────────────────────────
function wgmOrdreDepuisGrille() {
  const vue = typeof wgtVue === 'function' ? wgtVue() : 'dashboard';
  const grille = document.querySelector('.wgm-grille');
  if (!grille) return;
  wgmEcrire(vue, { ordre: [...grille.children].map(s => s.dataset.wgt).filter(Boolean) });
}

function wgmBrancherGlisser() {
  const grille = document.querySelector('.wgm-grille');
  if (!grille || grille.dataset.wgmGlisse) return;
  grille.dataset.wgmGlisse = '1';

  grille.addEventListener('dragstart', e => {
    const carte = e.target.closest('.dbx-carte');
    if (!carte || !window._wgm.edition) return;
    window._wgm.glissee = carte;
    carte.classList.add('en-deplacement');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', carte.dataset.wgt || ''); } catch (x) { /* Safari */ }
  });

  grille.addEventListener('dragend', () => {
    if (window._wgm.glissee) window._wgm.glissee.classList.remove('en-deplacement');
    grille.querySelectorAll('.drop-cible').forEach(el => el.classList.remove('drop-cible'));
    window._wgm.glissee = null;
  });

  // On insère AVANT ou APRÈS la carte survolée selon le côté où l'on se trouve : c'est ce qui
  // donne l'impression que la place se fait toute seule, comme sur une colonne de kanban.
  grille.addEventListener('dragover', e => {
    const carte = e.target.closest('.dbx-carte');
    const glissee = window._wgm.glissee;
    if (!carte || !glissee || carte === glissee) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    grille.querySelectorAll('.drop-cible').forEach(el => el.classList.remove('drop-cible'));
    carte.classList.add('drop-cible');
    const r = carte.getBoundingClientRect();
    const apres = (e.clientX - r.left) > r.width / 2;
    grille.insertBefore(glissee, apres ? carte.nextSibling : carte);
  });

  grille.addEventListener('drop', e => {
    e.preventDefault();
    grille.querySelectorAll('.drop-cible').forEach(el => el.classList.remove('drop-cible'));
    wgmOrdreDepuisGrille();
  });
}

// ── Remise à zéro ───────────────────────────────────────────────────────────────────────────────
// « Revenir à la page d'origine » doit vraiment y revenir : on coupe la mosaïque, on oublie les
// tailles, et le rendu suivant reconstruit la page telle que les vues la produisent.
async function wgmReinitialiser() {
  const vue = typeof wgtVue === 'function' ? wgtVue() : 'dashboard';
  if (window._wgt && window._wgt.prefs) delete window._wgt.prefs[vue];
  window._wgm.edition = false;
  document.body.classList.remove('wgm-edition');
  document.querySelector('.wgm-grille')?.remove();
  if (typeof wgtEnregistrer === 'function') await wgtEnregistrer();
  if (typeof renderView === 'function') renderView();
  showError('✓ Disposition d’origine rétablie.');
}

(function wgmBrancher() {
  const poser = () => {
    if (window._wgm.pose) return;
    window._wgm.pose = true;
    try {
      wgmConstruire();
      wgmBouton();
      wgmBrancherGlisser();
      if (window._wgm.edition) wgmHabiller(true);
    } finally { window._wgm.pose = false; }
  };

  let minuterie = null;
  const guetter = () => {
    const m = document.getElementById('main-content');
    if (!m) return;
    new MutationObserver(() => { clearTimeout(minuterie); minuterie = setTimeout(poser, 140); }).observe(m, { childList: true, subtree: true });
    poser();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guetter);
  else guetter();

  const st = document.createElement('style');
  st.textContent = `
    .wgm-grille { display: grid; grid-template-columns: repeat(${WGM_COLONNES}, minmax(0, 1fr));
      grid-auto-rows: minmax(180px, auto); gap: 18px; align-items: stretch; margin-bottom: 18px; }
    .wgm-grille > .dbx-carte { margin: 0; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }

    .wgm-cadenas { background: var(--surface); border: 1px solid var(--border); color: var(--text-muted);
      border-radius: 9px; padding: 6px 13px; font-size: 12.5px; font-weight: 600; cursor: pointer; margin-left: 6px; }
    .wgm-cadenas.actif { background: var(--accent-dim); border-color: var(--accent-border); color: var(--accent); }

    /* Mode édition : la page dit d'elle-même qu'elle est modifiable. Le frémissement est court et
       léger — assez pour qu'on le voie, pas assez pour donner mal au cœur. */
    .wgm-edition .wgm-grille > .dbx-carte { cursor: grab; animation: wgm-fremir 2.6s ease-in-out infinite; transform-origin: 50% 50%; }
    .wgm-edition .wgm-grille > .dbx-carte:nth-child(2n) { animation-delay: -1.3s; }
    .wgm-edition .wgm-grille > .dbx-carte.en-deplacement { opacity: .5; animation: none; cursor: grabbing; }
    .wgm-edition .wgm-grille > .dbx-carte.drop-cible { outline: 2px dashed var(--accent); outline-offset: 3px; }
    .wgm-edition .wgm-grille > .dbx-carte.wgm-masquee { opacity: .42; }
    @keyframes wgm-fremir { 0%, 100% { transform: rotate(-.22deg); } 50% { transform: rotate(.22deg); } }
    @media (prefers-reduced-motion: reduce) { .wgm-edition .wgm-grille > .dbx-carte { animation: none; } }

    .wgm-barre { display: flex; align-items: center; gap: 8px; margin: -8px -10px 10px; padding: 6px 10px;
      background: var(--surface-alt); border-radius: 9px; font-size: 11.5px; color: var(--text-muted); }
    .wgm-poignee { cursor: grab; font-size: 14px; letter-spacing: -2px; }
    .wgm-titre { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-weight: 600; }
    .wgm-barre button { background: var(--surface); border: 1px solid var(--border); border-radius: 7px;
      padding: 2px 9px; font-size: 11px; font-weight: 600; color: var(--text); cursor: pointer; }
    .wgm-barre button:hover { border-color: var(--accent-border); color: var(--accent); }

    /* Sur téléphone, une mosaïque à quatre colonnes n'a aucun sens : tout reprend la pleine largeur. */
    @media (max-width: 860px) {
      .wgm-grille { grid-template-columns: 1fr; grid-auto-rows: auto; }
      .wgm-grille > .dbx-carte { grid-column: 1 / -1 !important; grid-row: auto !important; }
    }`;
  document.head.appendChild(st);
})();
