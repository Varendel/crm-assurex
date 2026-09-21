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

// ── Neige irrégulière et guirlande (21.09.2026) ────────────────────────────────────────────────
// « Le bandeau doit être enneigé irrégulièrement, ajoute des guirlandes. » Le liseré est tiré au
// sort (épaisseur, gros paquets, quelques coulures) mais toujours le même pour une largeur donnée :
// pas de neige qui change à chaque clic. Il est calculé à la largeur réelle du bandeau, donc jamais
// étiré. La guirlande pend en festons juste sous la neige, ampoules qui scintillent doucement.
function scrHasard(graine) { let a = graine >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function scrLisereIrregulier(w, fort) {
  const h = scrHasard(w * 7 + (fort ? 3 : 1)), base = fort ? 5 : 4, k = fort ? 1 : 0.6;
  let d = `M0 0H${w}V${base}`, coulures = '';
  // Des paquets de largeur variable ; de temps en temps une vraie congère, plus haute et plus large.
  for (let x = w; x > 0;) {
    const congere = h() < 0.16, pas = congere ? 40 + h() * 50 : 12 + h() * 22;
    const x2 = Math.max(0, x - pas), ep = base + (congere ? 12 + h() * 12 : 2 + h() * 9) * k;
    d += `Q${(x + x2) / 2} ${ep * 1.35} ${x2} ${base + h() * 3 * k}`;
    if (!congere && h() < 0.08) {
      const cx = x2 + pas * (0.3 + h() * 0.4), lg = (5 + h() * 9) * k, lr = 3 + h() * 2;
      coulures += `<path d="M${cx - lr} ${ep * 0.9}C${cx - lr} ${ep + lg} ${cx + lr} ${ep + lg} ${cx + lr} ${ep * 0.9}Z" fill="#fff"/>`;
    }
    x = x2;
  }
  d += 'Z';
  const H = fort ? 40 : 26;
  return `<svg class="scr-lisere" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" aria-hidden="true"><path d="${d}" fill="#fff"/>${coulures}</svg>`;
}

function scrGuirlande(w, y0) {
  const couleurs = ['#00CFFF', '#FFD166', '#FF6B6B', '#7BE08A', '#FFFFFF'], feston = 170;
  const n = Math.max(1, Math.round(w / feston)), l = w / n, creux = 16;
  let fil = `M0 ${y0}`, bulbes = '', k = 0;
  for (let i = 0; i < n; i++) {
    const a = i * l, b = a + l;
    fil += `Q${a + l / 2} ${y0 + creux * 2} ${b} ${y0}`;
    for (let j = 1; j <= 4; j++) {
      const t = j / 5, x = a + l * t, y = y0 + 2 * (1 - t) * t * creux * 2;   // point de la courbe
      const c = couleurs[k % couleurs.length], retard = ((k * 0.37) % 2.2).toFixed(2);
      bulbes += `<g class="scr-ampoule" style="--r:-${retard}s"><rect x="${x - 1.6}" y="${y}" width="3.2" height="2.6" rx=".6" fill="#5b6b86"/><ellipse cx="${x}" cy="${y + 6}" rx="3" ry="4.2" fill="${c}"/></g>`;
      k++;
    }
  }
  return `<svg class="scr-guirlande" viewBox="0 0 ${w} ${y0 + creux + 16}" width="${w}" height="${y0 + creux + 16}" aria-hidden="true">
    <path d="${fil}" fill="none" stroke="#0A1A36" stroke-width="1.8" opacity=".85"/>${bulbes}</svg>`;
}

// ── Quelques éléments en plus (21.09.2026, « j'adore ») ────────────────────────────────────────
const SCR_SAPIN = `<svg viewBox="0 0 60 80" aria-hidden="true">
  <rect x="26" y="66" width="8" height="12" rx="1.5" fill="#6B4A2B"/>
  <path d="M30 14L50 44H38L54 66H6L22 44H10Z" fill="#2E7D5B"/>
  <path d="M30 14L38 26Q34 24 30 27Q26 24 22 26Z M14 44Q22 40 30 44Q38 40 46 44L50 44H10Z M10 66Q20 60 30 64Q40 60 50 66H6Z" fill="#fff" opacity=".9"/>
  <path d="M30 4l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L30 16.4l-5 2.8 1.2-5.6-4.2-3.8 5.6-.6z" fill="#FFD166"/>
  <circle cx="24" cy="38" r="1.8" fill="#FF6B6B"/><circle cx="36" cy="52" r="1.8" fill="#00CFFF"/><circle cx="22" cy="58" r="1.8" fill="#FFD166"/><circle cx="40" cy="36" r="1.6" fill="#7BE08A"/></svg>`;
const SCR_CADEAUX = `<svg viewBox="0 0 64 36" aria-hidden="true">
  <rect x="2" y="12" width="28" height="22" rx="2" fill="#E24C4B"/><rect x="13" y="12" width="6" height="22" fill="#FFD166"/><rect x="2" y="19" width="28" height="5" fill="#FFD166"/>
  <path d="M16 12q-8-9-11-3 1 4 11 3zm0 0q8-9 11-3-1 4-11 3z" fill="#FFD166"/>
  <rect x="34" y="18" width="24" height="16" rx="2" fill="#00A8D6"/><rect x="43" y="18" width="5" height="16" fill="#fff"/>
  <path d="M45.5 18q-6-7-9-2 1 3 9 2zm0 0q6-7 9-2-1 3-9 2z" fill="#fff"/></svg>`;
const SCR_BOULE = `<svg viewBox="0 0 20 44" aria-hidden="true"><path d="M10 0V22" stroke="#cfd8e6" stroke-width="1"/>
  <rect x="7" y="21" width="6" height="4" rx="1" fill="#c9a24a"/><circle cx="10" cy="33" r="9" fill="#E24C4B"/>
  <path d="M5 30q5-4 10 0" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7"/><circle cx="7" cy="29" r="1.8" fill="#fff" opacity=".6"/></svg>`;
const SCR_BONHOMME = `<svg viewBox="0 0 40 56" aria-hidden="true">
  <circle cx="20" cy="40" r="14" fill="#fff"/><circle cx="20" cy="18" r="10" fill="#fff"/>
  <rect x="12" y="2" width="16" height="7" rx="1" fill="#1b2a44"/><rect x="9" y="8" width="22" height="3" rx="1" fill="#1b2a44"/>
  <circle cx="16.5" cy="16" r="1.4" fill="#1b2a44"/><circle cx="23.5" cy="16" r="1.4" fill="#1b2a44"/><path d="M20 19l7 2-7 1z" fill="#F28C28"/>
  <path d="M11 26q9 5 18 0v4q-9 4-18 0z" fill="#E24C4B"/><circle cx="20" cy="37" r="1.4" fill="#1b2a44"/><circle cx="20" cy="43" r="1.4" fill="#1b2a44"/></svg>`;
const SCR_LUNE = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M26 4a16 16 0 1 0 10 26A13 13 0 0 1 26 4z" fill="#FFE8A3"/></svg>`;
const SCR_CHAUVE = `<svg viewBox="0 0 48 20" aria-hidden="true"><path class="scr-ailes" d="M24 8c-2-3-5-4-8-3-2-3-6-4-9-2-2-1-5 0-7 2 4 0 6 2 7 5 2-2 5-2 7 0 1-2 4-3 6-2 1 1 2 2 4 3 2-1 3-2 4-3 2-1 5 0 6 2 2-2 5-2 7 0 1-3 3-5 7-5-2-2-5-3-7-2-3-2-7-1-9 2-3-1-6 0-8 3z" fill="#0A1024"/>
  <circle cx="24" cy="10" r="3" fill="#0A1024"/></svg>`;
const SCR_ARAIGNEE = `<svg viewBox="0 0 20 60" aria-hidden="true"><path d="M10 0V40" stroke="#fff" stroke-width=".6" opacity=".6"/>
  <g stroke="#0A1024" stroke-width="1.2" fill="none"><path d="M10 44l-7-4M10 46l-8 0M10 48l-7 4M10 44l7-4M10 46l8 0M10 48l7 4"/></g>
  <ellipse cx="10" cy="46" rx="4" ry="5" fill="#0A1024"/><circle cx="10" cy="40" r="2.6" fill="#0A1024"/></svg>`;

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
  d.innerHTML = typeof html === 'function' ? html(Math.max(120, Math.round(hote.clientWidth || 600))) : html;
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
    ? w => scrGuirlande(w, 10) + scrLisereIrregulier(w, true) + scrNeige(14)
      + `<span class="scr-sapin">${SCR_SAPIN}</span><span class="scr-cadeaux">${SCR_CADEAUX}</span><span class="scr-boule">${SCR_BOULE}</span>`
    : `<span class="scr-coin">${SCR_TOILE}</span><span class="scr-c1">${SCR_CITROUILLE}</span><span class="scr-f1">${SCR_FANTOME}</span>`
      + `<span class="scr-lune">${SCR_LUNE}</span><span class="scr-chauve scr-ch1">${SCR_CHAUVE}</span><span class="scr-chauve scr-ch2">${SCR_CHAUVE}</span>`;
  const menu = cle === 'noel'
    ? w => scrGuirlande(w, 8) + scrLisereIrregulier(w, false) + scrNeige(16) + '<span class="scr-congere"></span>'
      + `<span class="scr-bonhomme">${SCR_BONHOMME}</span>`
    : `<span class="scr-coin scr-coin-d">${SCR_TOILE}</span><span class="scr-c2">${SCR_CITROUILLE}</span><span class="scr-f2">${SCR_FANTOME}</span>`
      + `<span class="scr-araignee">${SCR_ARAIGNEE}</span>`;
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
    .scr-lisere { position: absolute; left: 0; top: 0; opacity: .95; filter: drop-shadow(0 2px 2px rgba(0,0,0,.10)); }
    .scr-guirlande { position: absolute; left: 0; top: 0; overflow: visible; }
    .scr-ampoule { animation: scrScintille 2.2s ease-in-out var(--r) infinite; filter: drop-shadow(0 0 3px rgba(255,255,255,.7)); }
    @keyframes scrScintille { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
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

    /* Les éléments en plus */
    .scr-sapin, .scr-cadeaux, .scr-boule, .scr-bonhomme, .scr-lune, .scr-chauve, .scr-araignee { position: absolute; }
    .scr-deco span > svg { width: 100%; height: auto; display: block; }
    .scr-sapin { left: 16px; bottom: 0; width: 68px; opacity: .95; filter: drop-shadow(0 4px 6px rgba(0,0,0,.25)); }
    .scr-cadeaux { left: 80px; bottom: 2px; width: 66px; opacity: .95; filter: drop-shadow(0 3px 5px rgba(0,0,0,.25)); }
    .scr-boule { left: 58%; top: 20px; width: 14px; transform-origin: 50% 0; animation: scrBalance 5s ease-in-out infinite; }
    @keyframes scrBalance { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
    .sidebar .scr-bonhomme { right: 12px; bottom: 96px; width: 30px; opacity: .8; }
    .scr-lune { right: 34%; top: 14px; width: 30px; opacity: .45; filter: drop-shadow(0 0 10px rgba(255,232,163,.5)); }
    .scr-chauve { width: 26px; opacity: .7; animation: scrVol 24s linear infinite; }
    .scr-ch1 { top: 22%; left: -30px; }
    .scr-ch2 { top: 38%; left: -30px; width: 18px; opacity: .5; animation-duration: 31s; animation-delay: -14s; }
    .scr-ailes { transform-box: fill-box; transform-origin: 50% 50%; animation: scrBattre .35s ease-in-out infinite alternate; }
    @keyframes scrBattre { to { transform: scaleY(.45); } }
    @keyframes scrVol { 0% { transform: translate(0, 0); } 25% { transform: translate(28vw, -10px); } 50% { transform: translate(55vw, 8px); } 75% { transform: translate(80vw, -6px); } 100% { transform: translate(110vw, 0); } }
    .sidebar .scr-araignee { left: 52%; top: 0; width: 12px; opacity: .7; animation: scrDescend 8s ease-in-out infinite; }
    @keyframes scrDescend { 0%, 100% { transform: translateY(-18px); } 50% { transform: translateY(14px); } }
    @media (max-width: 768px) { .scr-sapin, .scr-cadeaux, .scr-lune, .scr-ch2 { display: none; } }

    @media (prefers-reduced-motion: reduce) { .scr-neige, .scr-f1, .scr-f2, .scr-chauve { display: none; } .scr-ampoule, .scr-boule, .scr-araignee, .scr-ailes { animation: none; } }
    @media (max-width: 768px) { .scr-f1, .scr-c1 { display: none; } .scr-coin { width: 60px; height: 60px; } }
    @media print { .scr-deco { display: none !important; } }`;
  document.head.appendChild(st);
})();
