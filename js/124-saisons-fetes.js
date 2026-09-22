// ═══ HIVER & NOËL, ET LES FÊTES DE L'ANNÉE (22.09.2026) ═════════════════════════════════════════
// « Ajoute les thèmes. Comment ça il manque l'hiver, je vois Noël, c'est hiver pareil — ou renomme
// hiver Noël. »
//
// 1. Noël devient « Hiver & Noël » et couvre tout l'hiver, du 1er novembre au 19 mars (le printemps
//    prend le relais le 20). Après l'Épiphanie (7 janvier), la neige, le liseré et le bonhomme
//    restent ; le sapin, les cadeaux, la boule et la guirlande s'en vont.
// 2. Quatre fêtes courtes, qui passent devant la saison en cours le temps de quelques jours :
//      · Nouvel An          31 décembre → 2 janvier   confettis dorés et feux d'artifice
//      · Saint-Valentin     10 → 14 février           cœurs qui montent
//      · Carnaval           jeudi gras → mercredi des Cendres (suit Pâques)   confettis, serpentins
//      · Fête nationale     25 juillet → 1er août     drapeaux suisses et feux d'artifice
//    Pas encore de planche de Rex pour elles : il garde sa tenue (le mécanisme de js/62 l'accepte).
// Tout passe par SAISONS (js/62) : l'interrupteur, le choix forcé dans Apparence et le décor de
// l'espace client s'y appliquent d'office.

(function fetesDeclarer() {
  if (typeof SAISONS === 'undefined') return;
  const noel = SAISONS.find(s => s.cle === 'noel');
  if (noel) { noel.nom = 'Hiver & Noël'; noel.fin = { mois: 3, jour: 19 }; }

  const J = d => ({ mois: d.getMonth() + 1, jour: d.getDate() });
  const an = new Date().getFullYear();
  // Carnaval : jeudi gras (Pâques − 52 j) → mercredi des Cendres (Pâques − 46 j).
  const p = typeof scrPaques === 'function' ? scrPaques(an) : null;
  const carnaval = p ? [new Date(p.getTime() - 52 * 864e5), new Date(p.getTime() - 46 * 864e5)] : null;
  const poses = 'assets/logos/rex/poses/';
  const fetes = [
    { cle: 'nouvel-an', nom: 'Nouvel An', debut: { mois: 12, jour: 31 }, fin: { mois: 1, jour: 2 }, dossierRex: poses, poseConnexion: 'debout', decors: ['🎆', '🥂', '✨', '🎉'] },
    { cle: 'valentin', nom: 'Saint-Valentin', debut: { mois: 2, jour: 10 }, fin: { mois: 2, jour: 14 }, dossierRex: poses, poseConnexion: 'debout', decors: ['❤️', '💌', '🌹', '💕'] },
    carnaval && { cle: 'carnaval', nom: 'Carnaval', debut: J(carnaval[0]), fin: J(carnaval[1]), dossierRex: poses, poseConnexion: 'debout', decors: ['🎭', '🎊', '🥁', '🎉'] },
    { cle: 'fete-nationale', nom: 'Fête nationale', debut: { mois: 7, jour: 25 }, fin: { mois: 8, jour: 1 }, dossierRex: poses, poseConnexion: 'debout', decors: ['🇨🇭', '🎆', '🏔️', '✨'] },
  ].filter(Boolean);
  // En tête : une fête l'emporte sur la saison qui l'entoure (même principe que Pâques, js/120).
  for (const f of fetes.reverse()) if (!SAISONS.some(s => s.cle === f.cle)) SAISONS.unshift(f);
})();

// ── Les décors dans le CRM (bandeaux et menu) ─────────────────────────────────────────────────
const FD_DRAPEAU = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="3" fill="#DA291C"/><path d="M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z" fill="#fff"/></svg>`;
const FD_COEUR = c => `<svg viewBox="0 0 32 30" aria-hidden="true"><path d="M16 29S2 20 2 10a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 10-14 19-14 19z" fill="${c}"/><ellipse cx="9" cy="9" rx="3" ry="2" fill="#fff" opacity=".45" transform="rotate(-30 9 9)"/></svg>`;
const FD_MASQUE = `<svg viewBox="0 0 60 30" aria-hidden="true"><path d="M2 6q28-10 56 0-2 18-14 20-8 1-14-7-6 8-14 7Q4 24 2 6z" fill="#8E44AD"/><path d="M12 12q5-4 10 0-5 4-10 0zM38 12q5-4 10 0-5 4-10 0z" fill="#1b1030"/><path d="M2 6q28-10 56 0" stroke="#FFD166" stroke-width="2" fill="none"/><circle cx="30" cy="4" r="2.5" fill="#FFD166"/></svg>`;

// Une pluie de pièces : confettis (rectangles colorés qui tournent), cœurs qui montent.
function fdPluie(n, sorte) {
  const couleurs = sorte === 'or' ? ['#FFD166', '#F3DC9A', '#FFFFFF', '#E9C46A'] : ['#FF6B6B', '#FFD166', '#00CFFF', '#7BE08A', '#C77DFF', '#FF9E5E'];
  return `<div class="fd-pluie fd-${sorte}" aria-hidden="true">${Array.from({ length: n }, (_, i) => {
    const x = ((i * 37 + 7) % 100), d = (6 + (i % 5) * 1.4).toFixed(1), r = ((i * 1.3) % 8).toFixed(1), c = couleurs[i % couleurs.length];
    return sorte === 'coeurs'
      ? `<i style="--x:${x}%;--d:${(8 + (i % 4) * 2).toFixed(1)}s;--r:-${r}s;--t:${10 + (i % 3) * 4}px">${FD_COEUR(['#FF4D6D', '#FF8FA3', '#E63946'][i % 3])}</i>`
      : `<i style="--x:${x}%;--d:${d}s;--r:-${r}s;--c:${c};--w:${4 + (i % 3) * 2}px;--h:${7 + (i % 2) * 4}px"></i>`;
  }).join('')}</div>`;
}

// Feux d'artifice : des gerbes qui éclatent l'une après l'autre dans le haut du bandeau.
function fdFeux(n, couleurs) {
  return `<div class="fd-feux" aria-hidden="true">${Array.from({ length: n }, (_, i) => {
    const x = 18 + ((i * 29) % 70), y = 14 + ((i * 17) % 30), c = couleurs[i % couleurs.length];
    const rayons = Array.from({ length: 12 }, (_, k) => `<b style="--a:${k * 30}deg"></b>`).join('');
    return `<span class="fd-gerbe" style="--x:${x}%;--y:${y}%;--c:${c};--r:-${(i * 1.1).toFixed(1)}s">${rayons}</span>`;
  }).join('')}</div>`;
}

function fdDecor(cle, ou) {
  if (cle === 'valentin') return fdPluie(ou === 'menu' ? 8 : 12, 'coeurs')
    + (ou === 'menu' ? '' : `<span class="fd-coeur-gros">${FD_COEUR('#FF4D6D')}</span>`);
  if (cle === 'carnaval') return fdPluie(ou === 'menu' ? 14 : 22, 'confettis')
    + (ou === 'menu' ? '' : `<span class="fd-masque">${FD_MASQUE}</span>`);
  if (cle === 'nouvel-an') return fdPluie(ou === 'menu' ? 10 : 16, 'or')
    + (ou === 'menu' ? '' : fdFeux(4, ['#FFD166', '#FFFFFF', '#00CFFF', '#FF9E5E']));
  if (cle === 'fete-nationale') return (ou === 'menu' ? '' : fdFeux(4, ['#FF3B30', '#FFFFFF', '#FFD166']))
    + `<span class="fd-drapeau fd-dr1">${FD_DRAPEAU}</span>` + (ou === 'menu' ? '' : `<span class="fd-drapeau fd-dr2">${FD_DRAPEAU}</span>`);
  return '';
}

function fdPoser() {
  const s = typeof saisonCourante === 'function' ? saisonCourante() : null;
  const cle = s ? s.cle : '';
  // Hiver & Noël : après l'Épiphanie, l'hiver sans les objets de Noël.
  const d = new Date(), m = d.getMonth() + 1;
  document.body.classList.toggle('hiver-seul', cle === 'noel' && (m === 1 ? d.getDate() >= 7 : (m === 2 || m === 3)));
  document.querySelectorAll('.fd-deco').forEach(x => { if (x.dataset.saison !== cle) x.remove(); });
  if (!['valentin', 'carnaval', 'nouvel-an', 'fete-nationale'].includes(cle)) return;
  if (document.body.classList.contains('mode-espace-client')) return;   // l'espace client a le sien (js/62)
  const poser = (hote, ou) => {
    if (!hote || hote.querySelector(':scope > .fd-deco')) return;
    if (getComputedStyle(hote).position === 'static') hote.style.position = 'relative';
    const el = document.createElement('div');
    el.className = 'scr-deco fd-deco'; el.dataset.saison = cle; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = fdDecor(cle, ou);
    hote.appendChild(el);
  };
  document.querySelectorAll(typeof SCR_BANDEAUX !== 'undefined' ? SCR_BANDEAUX : '.dbx-hero').forEach(h => poser(h, 'bandeau'));
  poser(document.querySelector('.sidebar'), 'menu');
}

(function fdBrancher() {
  const demarrer = () => {
    fdPoser();
    let t = null;
    const relancer = () => { clearTimeout(t); t = setTimeout(fdPoser, 140); };
    const main = document.getElementById('main-content');
    if (main) new MutationObserver(relancer).observe(main, { childList: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  if (typeof saisonAppliquer === 'function') {
    const origine = saisonAppliquer;
    window.saisonAppliquer = function () { const r = origine.apply(this, arguments); setTimeout(fdPoser, 0); return r; };
  }
  const st = document.createElement('style');
  st.textContent = `
    /* Hiver seul (7 janvier → 19 mars) : la neige reste, les objets de Noël partent. */
    body.hiver-seul .scr-sapin, body.hiver-seul .scr-cadeaux, body.hiver-seul .scr-boule, body.hiver-seul .scr-guirlande { display: none; }

    .fd-pluie { position: absolute; inset: 0; }
    .fd-confettis i, .fd-or i { position: absolute; top: -12px; left: var(--x); width: var(--w); height: var(--h); background: var(--c); border-radius: 1px;
      opacity: .85; animation: fdTombe var(--d) linear var(--r) infinite; }
    .fd-or i { border-radius: 50%; width: calc(var(--w) * .8); height: calc(var(--w) * .8); box-shadow: 0 0 4px rgba(255,209,102,.7); }
    @keyframes fdTombe { 0% { top: -12px; transform: translateX(0) rotate(0); } 50% { transform: translateX(14px) rotate(200deg); } 100% { top: 105%; transform: translateX(-6px) rotate(420deg); } }
    .fd-coeurs i { position: absolute; bottom: -20px; left: var(--x); width: var(--t); opacity: .75; animation: fdMonte var(--d) ease-in var(--r) infinite; }
    .fd-coeurs i svg, .fd-deco span > svg { width: 100%; height: auto; display: block; }
    @keyframes fdMonte { 0% { bottom: -20px; opacity: 0; transform: translateX(0) scale(.8); } 15% { opacity: .8; } 100% { bottom: 105%; opacity: 0; transform: translateX(18px) scale(1.1); } }
    .fd-coeur-gros { position: absolute; left: 18px; bottom: 8px; width: 34px; opacity: .9; animation: fdBat 1.6s ease-in-out infinite; filter: drop-shadow(0 0 8px rgba(255,77,109,.5)); }
    @keyframes fdBat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.18); } 30% { transform: scale(1); } 45% { transform: scale(1.1); } }
    .fd-masque { position: absolute; left: 16px; bottom: 10px; width: 62px; transform: rotate(-8deg); filter: drop-shadow(0 3px 5px rgba(0,0,0,.25)); }
    .fd-drapeau { position: absolute; width: 26px; filter: drop-shadow(0 2px 4px rgba(0,0,0,.25)); animation: fdFlotte 3s ease-in-out infinite; transform-origin: 0 100%; }
    .fd-dr1 { left: 18px; bottom: 10px; } .fd-dr2 { left: 52px; bottom: 6px; width: 20px; animation-delay: -1.2s; }
    .sidebar .fd-dr1 { left: auto; right: 14px; bottom: 96px; width: 22px; }
    @keyframes fdFlotte { 0%, 100% { transform: skewY(0) rotate(-2deg); } 50% { transform: skewY(-4deg) rotate(2deg); } }
    .fd-feux { position: absolute; inset: 0; }
    .fd-gerbe { position: absolute; left: var(--x); top: var(--y); width: 0; height: 0; }
    .fd-gerbe b { position: absolute; left: 0; top: 0; width: 2px; height: 14px; border-radius: 2px; background: linear-gradient(to top, transparent, var(--c));
      transform-origin: 50% 0; transform: rotate(var(--a)) translateY(0) scaleY(0); opacity: 0; animation: fdEclat 4.2s ease-out var(--r) infinite; }
    @keyframes fdEclat { 0%, 60% { opacity: 0; transform: rotate(var(--a)) translateY(0) scaleY(0); } 64% { opacity: 1; } 80% { opacity: .9; transform: rotate(var(--a)) translateY(18px) scaleY(1); } 100% { opacity: 0; transform: rotate(var(--a)) translateY(30px) scaleY(.4); } }
    @media (prefers-reduced-motion: reduce) { .fd-pluie, .fd-feux { display: none; } .fd-coeur-gros, .fd-drapeau { animation: none; } }
    @media (max-width: 768px) { .fd-dr2, .fd-masque { display: none; } }
    @media print { .fd-deco { display: none !important; } }`;
  document.head.appendChild(st);
})();
