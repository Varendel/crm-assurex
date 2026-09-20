// ═══ POINTEUR DE SOURIS AUX COULEURS DU CRM (20.09.2026) ═══════════════════════════════════════
// Demande de Jonathan : un pointeur dans la couleur d'accent, légèrement plus sombre.
//
// Deux décisions qui méritent d'être écrites :
//
// 1. La couleur n'est pas recopiée, elle est DÉRIVÉE. Le pointeur lit --accent tel qu'il est
//    appliqué et l'assombrit. Le CRM a quatre accents (REX, vert, or, violet) et deux thèmes :
//    une valeur en dur serait juste dans un cas sur huit. Si Jonathan change d'accent dans les
//    paramètres, le pointeur suit dans la seconde.
//
// 2. Seule la flèche est teintée. La main du survol et le curseur de saisie restent ceux du
//    système. Redessiner une main donne presque toujours un résultat qui sent le bricolage, et
//    surtout ces deux curseurs-là portent une information que l'utilisateur lit sans y penser —
//    on ne touche pas à ce qui sert à comprendre, on habille ce qui ne sert qu'à montrer.
//
// Le pointeur est désactivable depuis Paramètres → Apparence : un curseur personnalisé qui ne
// plaît pas est une gêne permanente, pas un détail.

const CUR_CLE = 'rex-curseur';

function curActif() {
  try { return localStorage.getItem(CUR_CLE) !== '0'; } catch (e) { return true; }
}

// ── Assombrissement ─────────────────────────────────────────────────────────────────────────────
// Passage par la teinte/saturation/luminosité plutôt qu'une simple multiplication des composantes :
// multiplier vire au gris sale sur les couleurs saturées comme le turquoise #00CFFF.
function curEnHsl(hex) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, v = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, v, b), mn = Math.min(r, v, b), d = mx - mn;
  let t = 0;
  if (d) {
    if (mx === r) t = ((v - b) / d + (v < b ? 6 : 0));
    else if (mx === v) t = (b - r) / d + 2;
    else t = (r - v) / d + 4;
    t *= 60;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { t, s, l };
}

function curAssombrir(hex, part) {
  const h = curEnHsl(hex);
  if (!h) return hex;
  const l = Math.max(0.12, h.l * (1 - (part == null ? 0.28 : part)));
  return `hsl(${h.t.toFixed(1)} ${(h.s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
}

// ── La flèche ───────────────────────────────────────────────────────────────────────────────────
// Tracé de la flèche système classique : on ne réinvente pas la forme, seulement la couleur.
// Le liseré blanc est indispensable — sans lui, le pointeur disparaît sur le bandeau bleu marine.
function curFleche(couleur) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    <path d="M5 2 L5 20.5 L9.8 16.1 L12.9 23.2 L16.1 21.8 L13.1 14.9 L19.6 14.4 Z"
      fill="${couleur}" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;
  // encodeURIComponent plutôt que base64 : plus léger, et surtout lisible en inspectant la page
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}") 4 2, auto`;
}

function curAppliquer() {
  const racine = document.documentElement;
  if (!document.body) return;
  document.body.classList.toggle('curseur-rex', curActif());
  if (!curActif()) { racine.style.removeProperty('--curseur-fleche'); return; }
  const accent = getComputedStyle(racine).getPropertyValue('--accent').trim() || '#00CFFF';
  racine.style.setProperty('--curseur-fleche', curFleche(curAssombrir(accent, 0.28)));
}

function curBasculer(actif) {
  try { localStorage.setItem(CUR_CLE, actif ? '1' : '0'); } catch (e) {}
  curAppliquer();
  if (typeof navigate === 'function' && currentView === 'apparence') navigate('apparence');
}

// Le thème et l'accent se changent sans recharger la page : on réapplique après chaque bascule.
(function curDemarrer() {
  const poser = () => curAppliquer();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
  const observateur = new MutationObserver(() => curAppliquer());
  observateur.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
})();
