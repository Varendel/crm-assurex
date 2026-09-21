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
    @media (prefers-reduced-motion: reduce) { .rxa-saut { animation: none; } }`;
  document.head.appendChild(st);
})();
