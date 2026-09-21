// ═══ REX S'ANIME DANS LE BANDEAU (21.09.2026) ══════════════════════════════════════════════════
// « Crée des GIF avec ces planches et anime REX du bandeau. » La planche « planches gif REX.png »
// (dossier Logos/REX) donne dix mouvements de sept images : salut, joie, montre, ordinateur,
// concentré, planification, réflexion, pouce, marche, confiant. Détourées et calées sur les pieds
// le 21.09.2026 dans assets/logos/rex/anim-<mouvement>/1..7.png, et en GIF dans
// assets/logos/rex/gifs/rex-<mouvement>.gif.
//
// Dans le CRM, on n'utilise pas les GIF : leur transparence est tout ou rien et laisse un liseré
// blanc sur le bandeau bleu. On fait défiler les PNG détourés, qui gardent un bord net.
//
// Quand REX bouge, et quand il se tait :
//   · il salue à l'ouverture du CRM ;
//   · il saute de joie au survol de sa tête ;
//   · il fait le geste de l'écran qu'on ouvre (l'ordinateur pour les commissions, le bloc-notes
//     pour les tâches, la réflexion pour le conseil…), une fois, puis reprend la pose ;
//   · de temps en temps, sans rien demander, un petit geste discret ;
//   · jamais si l'onglet est caché, si le système demande moins d'animations, ou s'il porte son
//     costume de saison (le costume n'existe qu'en image fixe) — il sautille alors simplement.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. REX redevient fixe.

const RXA_DOSSIER = 'assets/logos/rex/anim-';
const RXA_MOUVEMENTS = ['salut', 'joie', 'montre', 'ordinateur', 'concentre', 'planification', 'reflexion', 'pouce', 'marche', 'confiant'];
const RXA_PAS_MS = 85;
const RXA_REPOS = ['confiant', 'pouce', 'reflexion', 'marche'];

// L'écran ouvert → le geste qui va avec.
const RXA_PAR_ECRAN = {
  dashboard: 'salut', 'commissions-attente': 'ordinateur', 'import-decompte': 'ordinateur', 'entrees-argent': 'ordinateur',
  tresorerie: 'concentre', 'suivi-financier': 'concentre', rappels: 'planification', agenda: 'planification',
  'rendez-vous': 'planification', conseil: 'reflexion', 'analyse-prevoyance': 'reflexion', 'calc-immo': 'reflexion',
  opportunites: 'montre', 'opp-converties': 'joie', 'nouveau-contrat-direct': 'pouce', factures: 'ordinateur',
};

window._rxa = window._rxa || { images: {}, enCours: false, dernier: 0 };

function rxaPrecharger() {
  for (const m of RXA_MOUVEMENTS) {
    if (window._rxa.images[m]) continue;
    window._rxa.images[m] = Array.from({ length: 7 }, (_, i) => { const im = new Image(); im.src = `${RXA_DOSSIER}${m}/${i + 1}.png`; return im; });
  }
}

function rxaCalme() {
  return document.hidden || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function rxaCible() { return document.querySelector('.sidebar .rex-mascotte-menu'); }

// Joue un mouvement : aller puis retour (1→7→1), pour revenir exactement à la pose de départ.
function rxaJouer(mouvement, img) {
  img = img || rxaCible();
  if (!img || window._rxa.enCours || rxaCalme()) return;
  if (img.classList.contains('srx-costume')) { rxaSautiller(img); return; }
  const cadres = window._rxa.images[mouvement];
  if (!cadres || !cadres.every(c => c.complete && c.naturalWidth)) return;
  window._rxa.enCours = true;
  window._rxa.dernier = Date.now();
  const repos = img.getAttribute('src');
  const ordre = [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0];
  img.classList.add('rxa-joue');
  let k = 0;
  const pas = () => {
    if (k >= ordre.length) {
      img.src = repos; img.classList.remove('rxa-joue'); window._rxa.enCours = false; return;
    }
    img.src = cadres[ordre[k++]].src;
    setTimeout(pas, RXA_PAS_MS);
  };
  pas();
}

function rxaSautiller(img) {
  img.classList.remove('rxa-saut'); void img.offsetWidth; img.classList.add('rxa-saut');
  window._rxa.dernier = Date.now();
}

// ── Le grand Rex du bandeau du tableau de bord (21.09.2026) ────────────────────────────────────
// « Ce n'est pas animé » — c'était celui-là, le bandeau : le Rex en costume de saison sur le bleu.
// Costumé, il n'existe qu'en image fixe : il vit alors par le mouvement (il flotte, se balance,
// rebondit). En tenue ordinaire, il joue ses vraies animations, un geste toutes les huit secondes.
const RXA_HERO_GESTES = ['salut', 'joie', 'pouce', 'montre', 'confiant'];

function rxaHero() {
  document.querySelectorAll('img.dbx-hero-mascotte, .dbx-hero-mascotte img, .rexb-duo img.rexb').forEach(img => {
    if (img.dataset.rxa) return;
    img.dataset.rxa = '1';
    const costume = /\/saison-|poses-(halloween|noel)\//.test(img.getAttribute('src') || '');
    // La « respiration » de js/58 ferait deux animations sur la même image : le mouvement la remplace.
    if (costume || img.classList.contains('rexb-compagnon')) { img.classList.remove('respire'); img.classList.add('rxa-vivant'); return; }
    let n = 0;
    setTimeout(() => rxaJouer('salut', img), 600);
    const minuterie = setInterval(() => {
      if (!document.body.contains(img)) { clearInterval(minuterie); return; }
      if (!window._rxa.enCours) rxaJouer(RXA_HERO_GESTES[++n % RXA_HERO_GESTES.length], img);
    }, 8000);
    img.addEventListener('mouseenter', () => { if (!window._rxa.enCours) rxaJouer('joie', img); });
  });
  document.querySelectorAll('img.rxa-vivant:not([data-rxa-saut])').forEach(img => {
    img.dataset.rxaSaut = '1';
    img.addEventListener('mouseenter', () => { img.classList.remove('rxa-hop'); void img.offsetWidth; img.classList.add('rxa-hop'); });
  });
}

(function rxaBrancher() {
  const main = () => document.getElementById('main-content');
  const surveiller = () => {
    const m = main();
    if (!m) { setTimeout(surveiller, 400); return; }
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(rxaHero, 80); }).observe(m, { childList: true, subtree: true });
    rxaHero();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', surveiller); else surveiller();
})();

(function rxaBrancher() {
  const demarrer = () => {
    rxaPrecharger();
    // Le salut d'ouverture, une fois les images arrivées.
    setTimeout(() => rxaJouer('salut'), 1200);
    // Joie au survol.
    document.addEventListener('mouseover', ev => {
      const img = rxaCible();
      if (img && ev.target === img && Date.now() - window._rxa.dernier > 2500) rxaJouer('joie', img);
    });
    // Un geste de temps en temps : rarement, pour rester un clin d'œil.
    setInterval(() => {
      if (Date.now() - window._rxa.dernier < 70000) return;
      rxaJouer(RXA_REPOS[Math.floor(Math.random() * RXA_REPOS.length)]);
    }, 15000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();

  // Le geste de l'écran ouvert.
  if (typeof navigate === 'function') {
    const origine = navigate;
    window.navigate = function (vue) {
      const r = origine.apply(this, arguments);
      const m = typeof vue === 'string' ? RXA_PAR_ECRAN[vue] : null;
      if (m && Date.now() - window._rxa.dernier > 4000) setTimeout(() => rxaJouer(m), 250);
      return r;
    };
  }

  const st = document.createElement('style');
  st.textContent = `
    .sidebar .rex-mascotte-menu { object-fit: contain; object-position: center bottom; }
    .sidebar .rex-mascotte-menu:hover { cursor: pointer; }
    .rxa-saut { animation: rxaSaut .6s cubic-bezier(.3, 1.6, .5, 1); transform-origin: 50% 100%; }
    @keyframes rxaSaut { 0% { transform: none; } 30% { transform: translateY(-6px) scale(1.04, .97); } 60% { transform: translateY(0) scale(.97, 1.03); } 100% { transform: none; } }
    /* Le costume vit : il flotte, se balance, s'écrase un peu en retombant. Lent, régulier. */
    img.rxa-vivant { animation: rxaVivant 3.4s ease-in-out infinite; transform-origin: 50% 100%; }
    img.rxa-vivant.rexb-compagnon { animation-delay: -1.2s; animation-duration: 3.9s; }
    @keyframes rxaVivant {
      0%, 100% { transform: translateY(0) rotate(0deg) scale(1, 1); }
      22% { transform: translateY(-9px) rotate(-3deg) scale(.99, 1.01); }
      45% { transform: translateY(0) rotate(0deg) scale(1.03, .97); }
      68% { transform: translateY(-6px) rotate(3deg) scale(.99, 1.01); }
      88% { transform: translateY(0) rotate(0deg) scale(1.02, .98); }
    }
    img.rxa-vivant.rxa-hop { animation: rxaHop .7s cubic-bezier(.3, 1.5, .5, 1), rxaVivant 3.4s ease-in-out .7s infinite; }
    @keyframes rxaHop { 0% { transform: none; } 35% { transform: translateY(-22px) rotate(-6deg) scale(.96, 1.05); } 70% { transform: translateY(0) scale(1.06, .94); } 100% { transform: none; } }
    @media (prefers-reduced-motion: reduce) { .rxa-saut, img.rxa-vivant, img.rxa-vivant.rxa-hop { animation: none; } }`;
  document.head.appendChild(st);
})();
