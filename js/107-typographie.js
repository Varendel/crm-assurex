// ═══ POLICES ET STYLES, DANS LES PARAMÈTRES (20.09.2026) ═══════════════════════════════════════
// « Ajoute quelques polices et styles dans les paramètres. »
//
// Quatre réglages, et pas davantage. Un panneau d'apparence qui offre trente options ne se règle
// jamais : on l'ouvre, on hésite, on referme. Chacun de ceux-ci répond à une gêne réelle d'un
// outil qu'on regarde huit heures par jour.
//
//   · LA POLICE. Geist est neutre et technique ; certains la trouvent froide en petit corps.
//     Atkinson Hyperlegible a été dessinée pour être lisible par des yeux fatigués — elle
//     distingue le 0 du O et le 1 du l, ce qui compte quand on lit des numéros de police toute
//     la journée.
//   · LA TAILLE DU TEXTE. Différente de la densité, qui règle les ESPACES. Un écran peut être
//     dense et lisible, ou aéré et trop petit ; ce sont deux gênes distinctes.
//   · L'ARRONDI. Le seul réglage purement esthétique, et il est là parce qu'il change l'allure
//     de l'outil plus que tout le reste réuni.
//   · LES ANIMATIONS. Le système sait déjà les couper (prefers-reduced-motion), mais seulement
//     pour qui l'a réglé au niveau du système d'exploitation. Ici, c'est à portée de main.
//
// LA GRAISSE RESTE PLAFONNÉE À 600. Les polices ne sont chargées qu'en 400/500/600, et c'est
// délibéré : 783 déclarations de graisse à 700 ou plus traînent dans le code, et les charger
// ferait revenir le « tout en gras » corrigé le 19.09. Le plafond tombera quand ces 783
// déclarations auront été reprises, pas avant.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de index.html. Les réglages restent en mémoire du
// navigateur mais ne s'appliquent plus ; rien n'est perdu.

const TYPO_POLICES = [
  { cle: 'geist', nom: 'Geist', pile: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    google: 'Geist:wght@400;500;600', desc: 'La police actuelle — neutre, technique' },
  { cle: 'inter', nom: 'Inter', pile: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    google: 'Inter:wght@400;500;600', desc: 'La référence des interfaces, très sobre' },
  { cle: 'source', nom: 'Source Sans', pile: "'Source Sans 3', -apple-system, 'Segoe UI', sans-serif",
    google: 'Source+Sans+3:wght@400;500;600', desc: 'Plus chaleureuse, excellente en petit corps' },
  { cle: 'plex', nom: 'IBM Plex Sans', pile: "'IBM Plex Sans', -apple-system, 'Segoe UI', sans-serif",
    google: 'IBM+Plex+Sans:wght@400;500;600', desc: 'Chiffres très lisibles, allure d’ingénierie' },
  { cle: 'atkinson', nom: 'Atkinson Hyperlegible', pile: "'Atkinson Hyperlegible', -apple-system, 'Segoe UI', sans-serif",
    google: 'Atkinson+Hyperlegible:wght@400;700', desc: 'Dessinée pour la lisibilité : 0 et O, 1 et l ne se confondent pas' },
];

const TYPO_TAILLES = [
  { cle: 'petit', nom: 'Petit', desc: 'plus de lignes à l’écran' },
  { cle: 'normal', nom: 'Normal', desc: 'réglage d’origine' },
  { cle: 'grand', nom: 'Grand', desc: 'moins de fatigue en fin de journée' },
];

const TYPO_COINS = [
  { cle: 'francs', nom: 'Francs', desc: 'angles nets, allure d’outil' },
  { cle: 'normal', nom: 'Doux', desc: 'réglage d’origine' },
  { cle: 'ronds', nom: 'Ronds', desc: 'plus souple, moins administratif' },
];

function typoEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function typoLire(cle, defaut) {
  try { return localStorage.getItem('rex-' + cle) || defaut; } catch (e) { return defaut; }
}
function typoEcrire(cle, valeur) {
  try { localStorage.setItem('rex-' + cle, valeur); } catch (e) {}
}

// La police n'est chargée qu'au moment où on la choisit : charger les cinq d'avance coûterait
// cinq requêtes et autant de retard à l'affichage, pour quatre polices que personne n'utilisera.
function typoChargerPolice(p) {
  if (!p || !p.google || p.cle === 'geist') return;   // Geist est déjà dans index.html
  const id = 'typo-police-' + p.cle;
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id; l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${p.google}&display=swap`;
  document.head.appendChild(l);
}

function typoAppliquer() {
  const police = TYPO_POLICES.find(p => p.cle === typoLire('police', 'geist')) || TYPO_POLICES[0];
  typoChargerPolice(police);
  const b = document.body;
  if (!b) return;
  b.style.setProperty('--police-choisie', police.pile);
  b.setAttribute('data-texte', typoLire('texte', 'normal'));
  b.setAttribute('data-coins', typoLire('coins', 'normal'));
  b.setAttribute('data-animations', typoLire('animations', 'oui'));
}

function typoChoisir(cle, valeur) {
  typoEcrire(cle, valeur);
  typoAppliquer();
  // On redessine la page pour que les aperçus montrent le choix retenu.
  if (typeof navigate === 'function' && typeof currentView !== 'undefined' && currentView === 'apparence') navigate('apparence');
}

// ── Le panneau ─────────────────────────────────────────────────────────────────────────────────
function typoSectionHtml() {
  const police = typoLire('police', 'geist');
  const taille = typoLire('texte', 'normal');
  const coins = typoLire('coins', 'normal');
  const anim = typoLire('animations', 'oui');

  const cartesPolice = TYPO_POLICES.map(p => `
    <button type="button" class="apx-carte typo-carte ${police === p.cle ? 'actif' : ''}"
      onclick="typoChoisir('police','${p.cle}')" onmouseenter="typoPrecharger('${p.cle}')">
      <span class="typo-apercu" style="font-family:${p.pile}">Agfi 0O1l</span>
      <b>${typoEsc(p.nom)}${police === p.cle ? ' ✓' : ''}</b><small>${typoEsc(p.desc)}</small>
    </button>`).join('');

  const cartes = (liste, cleReglage, actif) => liste.map(x => `
    <button type="button" class="apx-carte ${actif === x.cle ? 'actif' : ''}"
      onclick="typoChoisir('${cleReglage}','${x.cle}')">
      <span class="typo-vignette typo-vignette-${cleReglage}-${x.cle}"><i></i><i></i></span>
      <b>${typoEsc(x.nom)}${actif === x.cle ? ' ✓' : ''}</b><small>${typoEsc(x.desc)}</small>
    </button>`).join('');

  return `
  <section class="dbx-carte apx-section">
    <header class="dbx-carte-tete"><div><h2>Police</h2>
      <span class="dbx-carte-sous">Ce qu’on lit toute la journée — l’aperçu montre les caractères qui se confondent</span></div></header>
    <div class="apx-cartes">${cartesPolice}</div>
    <p class="typo-note">Les graisses sont volontairement limitées : charger les très grasses
      ferait revenir le « tout en gras » corrigé récemment.</p>
  </section>

  <section class="dbx-carte apx-section">
    <header class="dbx-carte-tete"><div><h2>Taille du texte</h2>
      <span class="dbx-carte-sous">Distinct de la densité, qui règle les espaces</span></div></header>
    <div class="apx-cartes">${cartes(TYPO_TAILLES, 'texte', taille)}</div>
  </section>

  <section class="dbx-carte apx-section">
    <header class="dbx-carte-tete"><div><h2>Angles</h2>
      <span class="dbx-carte-sous">Ce qui change l’allure de l’outil plus que tout le reste</span></div></header>
    <div class="apx-cartes">${cartes(TYPO_COINS, 'coins', coins)}</div>
  </section>

  <section class="dbx-carte apx-section">
    <header class="dbx-carte-tete"><div><h2>Animations</h2>
      <span class="dbx-carte-sous">Les transitions et les apparitions de cartes</span></div></header>
    <div class="apx-cartes">
      <button type="button" class="apx-carte ${anim === 'oui' ? 'actif' : ''}" onclick="typoChoisir('animations','oui')">
        <span class="typo-vignette typo-vignette-anim-oui"><i></i></span>
        <b>Activées${anim === 'oui' ? ' ✓' : ''}</b><small>réglage d’origine</small></button>
      <button type="button" class="apx-carte ${anim === 'non' ? 'actif' : ''}" onclick="typoChoisir('animations','non')">
        <span class="typo-vignette typo-vignette-anim-non"><i></i></span>
        <b>Coupées${anim === 'non' ? ' ✓' : ''}</b><small>tout apparaît d’un coup</small></button>
    </div>
  </section>`;
}

// Précharger au survol : la police arrive pendant que l'œil lit la description, donc l'aperçu
// est déjà dans la bonne fonte quand on clique.
function typoPrecharger(cle) {
  const p = TYPO_POLICES.find(x => x.cle === cle);
  if (p) typoChargerPolice(p);
}

// ── Le branchement ─────────────────────────────────────────────────────────────────────────────
(function typoBrancher() {
  // Les réglages s'appliquent AVANT le premier rendu : sinon la page s'affiche dans la police
  // d'origine puis saute dans la bonne, ce qui se voit à chaque chargement.
  const poser = () => { typoAppliquer(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();

  // On s'ajoute au panneau Apparence, après ce qui s'y trouve déjà (densité, saison, ambiances).
  if (typeof apxSectionHtml === 'function') {
    const origine = apxSectionHtml;
    window.apxSectionHtml = function () {
      return origine.apply(this, arguments) + typoSectionHtml();
    };
  }
})();
