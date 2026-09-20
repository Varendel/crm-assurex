// ═══ AMBIANCES (20.09.2026) ════════════════════════════════════════════════════════════════════
// « Peux-tu proposer d'autres thèmes modernes ? »
//
// Le CRM avait deux modes et quatre accents — mais l'accent ne change qu'une couleur de bouton.
// Ce qui fait la sensation d'un outil, c'est le fond, les surfaces, les bordures et l'encre.
// Une ambiance, ici, redéfinit ces dix variables-là. Rien d'autre : aucune règle de mise en page
// n'est touchée, donc aucune ambiance ne peut casser un écran.
//
// LE CHOIX D'UN SECOND ATTRIBUT.
// Des centaines de règles du CRM disent `html:not([data-theme="clair"])` pour signifier « en
// sombre ». Si « papier » était devenu une valeur de data-theme, ce thème CLAIR serait passé par
// toutes les règles du sombre — bandeaux inversés compris. data-theme continue donc de dire
// clair-ou-sombre, et data-ambiance dit laquelle. Les deux se combinent sans se contredire.

const AMB_CLE = 'rex-ambiance';

const AMBIANCES = [
  { cle: 'marine',   nom: 'Marine',    mode: 'sombre', desc: 'L’identité Assurex, le réglage d’origine',
    bg: '#0B1220', surface: '#131D32', border: '#23304A', text: '#E7ECF4' },
  { cle: 'ardoise',  nom: 'Ardoise',   mode: 'sombre', desc: 'Gris-bleu neutre : les couleurs des chiffres ressortent',
    bg: '#0F172A', surface: '#1B263B', border: '#2E3E58', text: '#E8EDF5' },
  { cle: 'nuit',     nom: 'Nuit',      mode: 'sombre', desc: 'Noir profond, pensé pour les écrans OLED',
    bg: '#08090B', surface: '#131417', border: '#26282E', text: '#EDEEF0' },
  { cle: 'clair',    nom: 'Clair',     mode: 'clair',  desc: 'Le clair d’origine, gris froid',
    bg: '#F4F6F9', surface: '#FFFFFF', border: '#E2E7EF', text: '#0E1B33' },
  { cle: 'papier',   nom: 'Papier',    mode: 'clair',  desc: 'Blanc crème : moins de bleu, lecture longue',
    bg: '#F7F5F1', surface: '#FFFFFF', border: '#E5E1D8', text: '#1C1917' },
  { cle: 'aurore',   nom: 'Aurore',    mode: 'clair',  desc: 'Clair bleuté, aux couleurs de la marque',
    bg: '#F2F7FD', surface: '#FFFFFF', border: '#DBE6F3', text: '#0B2458' },
  { cle: 'contraste', nom: 'Contraste élevé', mode: 'clair', desc: 'Encre noire, bordures franches, focus épais',
    bg: '#FFFFFF', surface: '#FFFFFF', border: '#767676', text: '#000000' },
];

function ambCourante() {
  try {
    const c = localStorage.getItem(AMB_CLE);
    if (c && AMBIANCES.some(a => a.cle === c)) return c;
  } catch (e) {}
  // Pas de choix enregistré : on déduit l'ambiance d'origine du mode en cours, pour que la page
  // des paramètres montre juste ce qui est affiché plutôt qu'aucune sélection.
  return document.documentElement.getAttribute('data-theme') === 'clair' ? 'clair' : 'marine';
}

// Poser l'ambiance pose AUSSI le mode : choisir « Papier » depuis le sombre doit basculer en
// clair, sinon on obtiendrait un fond crème avec les règles du sombre par-dessus.
function ambAppliquer(cle, rafraichir) {
  const a = AMBIANCES.find(x => x.cle === cle) || AMBIANCES[0];
  const html = document.documentElement;
  html.setAttribute('data-ambiance', a.cle);
  html.setAttribute('data-theme', a.mode);
  try {
    localStorage.setItem(AMB_CLE, a.cle);
    localStorage.setItem('crm_theme_mode', a.mode);
  } catch (e) {}
  if (rafraichir !== false && typeof navigate === 'function' && typeof currentView !== 'undefined' && currentView === 'apparence') {
    navigate('apparence');
  }
}

function ambCarteHtml(a, actif) {
  return `<button type="button" class="amb-carte ${actif ? 'actif' : ''}" onclick="ambAppliquer('${a.cle}')"
      aria-pressed="${actif}" title="${a.nom}">
    <span class="amb-apercu" style="background:${a.bg}">
      <i class="amb-barre" style="background:${a.text};opacity:.85;width:42%"></i>
      <i class="amb-barre" style="background:${a.text};opacity:.35;width:66%"></i>
      <i class="amb-carte-mini" style="background:${a.surface};border:1px solid ${a.border}"></i>
    </span>
    <b class="amb-nom">${a.nom}${actif ? ' ✓' : ''}</b>
    <small class="amb-desc">${a.desc}</small>
  </button>`;
}

function ambSectionHtml() {
  const courante = ambCourante();
  const par = m => AMBIANCES.filter(a => a.mode === m).map(a => ambCarteHtml(a, a.cle === courante)).join('');
  return `
  <section class="dbx-carte apx-section">
    <header class="dbx-carte-tete"><div><h2>Ambiance</h2>
      <span class="dbx-carte-sous">Le fond, les surfaces et l’encre — la couleur d’accent reste réglable à part</span></div></header>
    <h4 class="apx-sous-titre">Sombres</h4>
    <div class="amb-cartes">${par('sombre')}</div>
    <h4 class="apx-sous-titre" style="margin-top:16px">Clairs</h4>
    <div class="amb-cartes">${par('clair')}</div>
    <p class="apx-note">Une ambiance ne redéfinit que des couleurs : aucune mise en page ne change,
      donc aucune ne peut abîmer un écran. « Contraste élevé » est là pour les situations où les
      gris moyens disparaissent — plein soleil, projecteur, vue fatiguée.</p>
  </section>`;
}

// On ajoute la section en tête des paramètres d'apparence sans toucher à js/64 : la fonction y est
// appelée par son nom, on l'enveloppe.
(function ambBrancher() {
  if (typeof apxSectionHtml === 'function') {
    const origine = apxSectionHtml;
    window.apxSectionHtml = function () { return ambSectionHtml() + origine.apply(this, arguments); };
  }
})();

// Au démarrage, avant le premier rendu : sans cela l'ambiance n'apparaîtrait qu'après un passage
// par les paramètres, et le premier écran affiché serait celui d'une autre ambiance.
(function ambDemarrer() {
  const poser = () => ambAppliquer(ambCourante(), false);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
})();
