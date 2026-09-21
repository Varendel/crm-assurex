// ═══ HABILLAGES DE SAISON DANS LE CRM (21.09.2026) ═════════════════════════════════════════════
// « Thème Noël : ajoute des effets enneigés partout. Halloween : des fantômes, des citrouilles et
// des toiles d'araignée. Partout, c'est le bandeau et le menu de gauche, réparti sans trop en faire. »
//
// Jusqu'ici, la neige et les citrouilles n'existaient que sur la page de connexion et dans
// l'espace client (js/62). Ici, le CRM lui-même :
//   · Noël — une neige légère qui tombe dans le bandeau et dans le menu, et un liseré de neige qui
//     coiffe le haut du bandeau ;
//   · Halloween — une toile d'araignée dans un coin du bandeau et du menu, une ou deux citrouilles,
//     un petit fantôme qui flotte lentement.
// Tout est dessiné (SVG), translucide, en petit nombre, jamais cliquable, et disparaît pour qui a
// demandé moins d'animations (sauf les éléments fixes : toile, citrouilles, liseré de neige).
// L'interrupteur de saison et le choix forcé dans Apparence s'appliquent ici aussi.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html.

const SCR_BANDEAUX = '.dbx-hero, .rex-bandeau, .fcx-hero, .cf-hero';

const SCR_TOILE = `<svg class="scr-toile" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round">
  <path d="M0 0L100 4M0 0L92 34M0 0L76 66M0 0L48 90M0 0L16 100"/>
  <path d="M22 1Q20 8 20 7.5Q17 13 16.5 16Q13 19 10.5 21.5Q7 22 3.5 22"/>
  <path d="M46 2Q42 12 41 15Q37 24 34 32Q27 38 21 43Q13 44 7 45"/>
  <path d="M70 3Q64 16 62 23Q56 36 51 48Q41 56 32 64Q20 66 11 68"/>
  <path d="M94 4Q86 21 84 31Q76 48 69 63Q56 74 44 83Q28 88 15 92"/>
  <path d="M60 58L60 78" stroke-width=".6"/></g><circle cx="60" cy="80" r="2.6" fill="#fff"/></svg>`;

const SCR_CITROUILLE = `<svg class="scr-citrouille" viewBox="0 0 44 38" aria-hidden="true">
  <path d="M21 6q1-5 5-6" stroke="#3C7A3E" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="13" cy="22" rx="11" ry="14" fill="#E07A1F"/><ellipse cx="31" cy="22" rx="11" ry="14" fill="#E07A1F"/>
  <ellipse cx="22" cy="22" rx="11" ry="15" fill="#F28C28"/>
  <path d="M15 18l4 3h-6zM29 18l2 3h-6zM14 27q8 6 16 0l-3 1-2-2-2 2-2-2-2 2z" fill="#FFD166"/></svg>`;

const SCR_FANTOME = `<svg class="scr-fantome" viewBox="0 0 40 48" aria-hidden="true">
  <path d="M20 2C9 2 4 11 4 22v22l5-4 5 4 6-4 6 4 5-4 5 4V22C36 11 31 2 20 2z" fill="#fff"/>
  <ellipse cx="14.5" cy="20" rx="3" ry="4" fill="#113679"/><ellipse cx="25.5" cy="20" rx="3" ry="4" fill="#113679"/>
  <ellipse cx="20" cy="30" rx="3.5" ry="2.5" fill="#113679" opacity=".8"/></svg>`;

const SCR_LISERE = `<svg class="scr-lisere" viewBox="0 0 400 16" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 0H400V6Q392 12 384 7Q372 14 360 6Q346 11 334 6Q326 15 316 7Q300 12 288 5Q276 13 262 6Q250 10 238 5Q228 14 218 6Q204 11 192 6Q180 13 166 5Q154 11 142 6Q132 15 120 6Q106 12 94 5Q82 13 70 6Q58 11 46 5Q36 14 26 6Q14 12 0 6Z" fill="#fff"/></svg>`;

function scrNeige(n) {
  const f = Array.from({ length: n }, (_, i) => {
    const t = [3, 4, 4, 5, 6][i % 5], x = ((i * 37 + 11) % 100), d = (7 + (i % 6) * 1.6).toFixed(1);
    const r = ((i * 1.9) % 9).toFixed(1), o = (0.45 + (i % 4) * 0.13).toFixed(2), dx = 8 + (i % 3) * 7;
    return `<i style="--t:${t}px;--x:${x}%;--d:${d}s;--r:-${r}s;--o:${o};--dx:${dx}px"></i>`;
  }).join('');
  return `<div class="scr-neige" aria-hidden="true">${f}</div>`;
}

function scrPoserSur(hote, html) {
  if (!hote || hote.querySelector(':scope > .scr-deco')) return;
  if (getComputedStyle(hote).position === 'static') hote.style.position = 'relative';
  const d = document.createElement('div');
  d.className = 'scr-deco';
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = html;
  hote.appendChild(d);
}

function scrPoser() {
  const s = typeof saisonCourante === 'function' ? saisonCourante() : null;
  const cle = s ? s.cle : '';
  // On retire ce qui n'est plus de saison (changement forcé dans Apparence, interrupteur coupé).
  document.querySelectorAll('.scr-deco').forEach(d => { if (d.dataset.saison !== cle) d.remove(); });
  if (cle !== 'noel' && cle !== 'halloween') return;
  if (document.body.classList.contains('mode-espace-client')) return;   // l'espace client a le sien (js/62)
  const bandeau = cle === 'noel'
    ? SCR_LISERE + scrNeige(14)
    : `<span class="scr-coin">${SCR_TOILE}</span><span class="scr-c1">${SCR_CITROUILLE}</span><span class="scr-f1">${SCR_FANTOME}</span>`;
  const menu = cle === 'noel'
    ? scrNeige(16) + '<span class="scr-congere"></span>'
    : `<span class="scr-coin scr-coin-d">${SCR_TOILE}</span><span class="scr-c2">${SCR_CITROUILLE}</span><span class="scr-f2">${SCR_FANTOME}</span>`;
  document.querySelectorAll(SCR_BANDEAUX).forEach(h => scrPoserSur(h, bandeau));
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) scrPoserSur(sidebar, menu);
  document.querySelectorAll('.scr-deco').forEach(d => { d.dataset.saison = cle; });
}

(function scrBrancher() {
  const demarrer = () => {
    scrPoser();
    let t = null;
    const relancer = () => { clearTimeout(t); t = setTimeout(scrPoser, 120); };
    const main = document.getElementById('main-content');
    if (main) new MutationObserver(relancer).observe(main, { childList: true });
    const sb = document.querySelector('.sidebar');
    if (sb) new MutationObserver(relancer).observe(sb, { childList: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  // Changement de saison (Apparence, interrupteur) : on repose tout de suite.
  if (typeof saisonAppliquer === 'function') {
    const origine = saisonAppliquer;
    window.saisonAppliquer = function () { const r = origine.apply(this, arguments); setTimeout(scrPoser, 0); return r; };
  }

  const st = document.createElement('style');
  st.textContent = `
    .scr-deco, .sidebar > .scr-deco { position: absolute !important; inset: 0 !important; width: auto !important; height: auto !important;
      margin: 0 !important; padding: 0 !important; pointer-events: none; overflow: hidden; border-radius: inherit; z-index: 0 !important; }
    .dbx-hero > :not(.scr-deco), .rex-bandeau > :not(.scr-deco), .fcx-hero > :not(.scr-deco), .cf-hero > :not(.scr-deco) { position: relative; z-index: 1; }

    /* Noël : neige légère, liseré en haut du bandeau, petite congère au pied du menu */
    .scr-neige { position: absolute; inset: 0; }
    .scr-neige i { position: absolute; top: -10px; left: var(--x); width: var(--t); height: var(--t); border-radius: 50%;
      background: #fff; opacity: var(--o); filter: blur(.3px); animation: scrTombe var(--d) linear var(--r) infinite; }
    @keyframes scrTombe { 0% { top: -10px; transform: translateX(0); } 50% { transform: translateX(var(--dx)); } 100% { top: 105%; transform: translateX(0); } }
    .scr-lisere { position: absolute; left: 0; top: 0; width: 100%; height: 14px; opacity: .92; filter: drop-shadow(0 2px 2px rgba(0,0,0,.08)); }
    .sidebar .scr-congere { position: absolute; left: -10%; right: -10%; bottom: -18px; height: 40px; border-radius: 50%;
      background: radial-gradient(ellipse at 50% 30%, rgba(255,255,255,.22), rgba(255,255,255,0) 70%); }

    /* Halloween : une toile dans un coin, une ou deux citrouilles, un fantôme qui flotte */
    .scr-coin { position: absolute; left: 0; top: 0; width: 92px; height: 92px; opacity: .3; }
    .scr-coin-d { left: auto; right: 0; transform: scaleX(-1); width: 70px; height: 70px; opacity: .22; }
    .scr-coin svg { width: 100%; height: 100%; }
    .scr-c1, .scr-c2 { position: absolute; width: 38px; opacity: .9; filter: drop-shadow(0 0 8px rgba(255,160,40,.45)); }
    .scr-c1 { left: 22px; bottom: 10px; }
    .scr-c2 { left: 16px; bottom: 74px; width: 30px; opacity: .8; }
    .scr-c1 svg, .scr-c2 svg, .scr-f1 svg, .scr-f2 svg { width: 100%; height: auto; display: block; }
    .scr-f1, .scr-f2 { position: absolute; width: 30px; opacity: .55; animation: scrFlotte 7s ease-in-out infinite; }
    .scr-f1 { left: 40%; top: 18%; }
    .scr-f2 { right: 18px; top: 46%; width: 24px; opacity: .35; animation-duration: 9s; animation-delay: -3s; }
    @keyframes scrFlotte { 0%, 100% { transform: translate(0, 0) rotate(-4deg); } 50% { transform: translate(14px, -12px) rotate(4deg); } }

    @media (prefers-reduced-motion: reduce) { .scr-neige, .scr-f1, .scr-f2 { display: none; } }
    @media (max-width: 768px) { .scr-f1, .scr-c1 { display: none; } .scr-coin { width: 60px; height: 60px; } }
    @media print { .scr-deco { display: none !important; } }`;
  document.head.appendChild(st);
})();
