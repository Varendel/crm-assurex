// ═══ REX, PERSONNAGE 2D VIVANT (21.09.2026) ════════════════════════════════════════════════════
// « Par animation j'entendais que les ensembles de postures mis bout à bout donnent l'impression
// d'un Rex 2D vivant. »
//
// La planche « planches gif REX.png » (Logos/planches REX) donne dix mouvements de sept images :
// salut, joie, montre, ordinateur, concentré, planification, réflexion, pouce, marche, confiant.
// Détourés et calés sur les pieds dans assets/logos/rex/anim-<mouvement>/1..7.png.
//
// Chaque série commence et finit sur Rex debout, au repos : on peut donc les enchaîner sans saut.
// Rex joue un mouvement (aller-retour, 1→7→1), reste une respiration sur sa pose de repos, puis en
// choisit un autre — jamais deux fois le même d'affilée, et plus souvent les gestes « de présence »
// (confiant, salut, pouce) que les gestes « de travail » (ordinateur, bloc-notes). Il ne s'arrête
// que si l'image quitte la page, si l'onglet est caché, ou si le système demande moins d'animation.
//
//   · Bandeau du tableau de bord : Rex vit en continu, respirations courtes.
//   · Menu : même Rex, plus calme (respirations de 3 à 7 secondes).
//   · Au survol : il saute de joie ; en ouvrant un écran, il fait le geste de cet écran.
//
// Le costume de saison n'existe qu'en image fixe : là où Rex vit, il garde sa tenue ordinaire ; le
// costume habille le reste (connexion, citations, REX CLOUD, poses fixes des écrans). Un costumé
// qui reste affiché ailleurs flotte doucement (.rxa-vivant) pour ne pas paraître figé.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Rex redevient fixe.

const RXA_DOSSIER = 'assets/logos/rex/anim-';
const RXA_MOUVEMENTS = ['salut', 'joie', 'montre', 'ordinateur', 'concentre', 'planification', 'reflexion', 'pouce', 'marche', 'confiant'];
// Poids : combien de fois un mouvement revient, relativement aux autres.
const RXA_POIDS = { confiant: 5, salut: 3, pouce: 3, joie: 2, montre: 2, marche: 2, reflexion: 2, ordinateur: 1, concentre: 1, planification: 1 };
const RXA_PAS_MS = 90;
// Les planches HD du 21.09.2026 (« rex tourne rond flamme bleu », « rex sautant ») : 8 images,
// jouées dans l'ordre avec leur propre rythme, au lieu de l'aller-retour des séries de 7.
const RXA_SEQUENCES = {
  tour: { n: 8, ordre: [0, 1, 2, 3, 4, 5, 6, 7, 0], ms: [260, 110, 110, 110, 110, 110, 110, 110, 300] },
  saut: { n: 8, ordre: [0, 1, 2, 3, 4, 5, 6, 7], ms: [220, 160, 90, 90, 220, 90, 160, 300] },
};
RXA_MOUVEMENTS.push('tour', 'saut');
Object.assign(RXA_POIDS, { tour: 1, saut: 2 });

// 21.09.2026, soir : « Enlève tous les Rex animés sauf celui qui saute du bandeau supérieur. Je
// n'aime pas le rendu sur les autres. » Seul le saut reste, et seulement dans le bandeau ; le Rex
// du menu, les flottements et les gestes par écran sont retirés. Les séries de postures restent
// sur le disque : les remettre, c'est retirer ce filtre.
RXA_MOUVEMENTS.splice(0, RXA_MOUVEMENTS.length, 'saut');
const RXA_REPOS_BANDEAU = [4000, 9000];   // un saut toutes les 4 à 9 secondes, pas en continu
const RXA_REPOS = 'assets/logos/rex/anim-confiant/1.png';   // pose de repos commune à toutes les séries

// 21.09.2026, nuit : « Ajoute Rex sans fond sur le bandeau supérieur, en remplacement des
// animations et images actuelles. » La planche « Rex flamme » (60 images) détourée, alignée sur les
// pieds et à taille constante : Rex marche, salue, souffle sa flamme turquoise, allume sa queue,
// lève le pouce et fait un clin d'œil. WebP à fond transparent (753 Ko les 60). Le repos est la
// dernière image de la série (pouce levé, queue allumée) : pas de saut de taille entre deux passages.
// Déroulé demandé : les 60 images dans l'ordre, puis Rex marche en faisant 2 allers-retours entre
// les images 1 et 13, puis tout recommence — en continu, sans pause entre deux boucles.
RXA_SEQUENCES.flamme = (() => {
  const tenir = { 9: 40, 19: 200, 25: 80, 37: 120, 49: 120, 59: 1100 };
  const complet = Array.from({ length: 60 }, (_, i) => i);
  const aller = Array.from({ length: 13 }, (_, i) => i), retour = aller.slice(1, -1).reverse();
  const marche = [...aller, ...retour, ...aller, ...retour];
  const ordre = [...complet, ...marche];
  const ms = [...complet.map(i => 80 + (tenir[i] || 0)), ...marche.map(() => 80)];
  return { n: 60, ext: 'webp', ordre, ms, repos: 'assets/logos/rex/anim-flamme/1.webp' };
})();
RXA_MOUVEMENTS.splice(0, RXA_MOUVEMENTS.length, 'flamme');
RXA_REPOS_BANDEAU.splice(0, 2, 0, 0);   // en continu

const RXA_PAR_ECRAN = {
  dashboard: 'salut', 'commissions-attente': 'ordinateur', 'import-decompte': 'ordinateur', 'entrees-argent': 'ordinateur',
  tresorerie: 'concentre', 'suivi-financier': 'concentre', rappels: 'planification', agenda: 'planification',
  'rendez-vous': 'planification', conseil: 'reflexion', 'analyse-prevoyance': 'reflexion', 'calc-immo': 'reflexion',
  opportunites: 'montre', 'opp-converties': 'joie', 'nouveau-contrat-direct': 'pouce', factures: 'ordinateur',
};

window._rxa = window._rxa || { images: {}, pret: false };

function rxaPrecharger() {
  const promesses = [];
  for (const m of RXA_MOUVEMENTS) {
    const n = RXA_SEQUENCES[m] ? RXA_SEQUENCES[m].n : 7, ext = (RXA_SEQUENCES[m] && RXA_SEQUENCES[m].ext) || 'png';
    if (!window._rxa.images[m]) window._rxa.images[m] = Array.from({ length: n }, (_, i) => { const im = new Image(); im.src = `${RXA_DOSSIER}${m}/${i + 1}.${ext}`; return im; });
    for (const im of window._rxa.images[m]) promesses.push(im.decode ? im.decode().catch(() => {}) : Promise.resolve());
  }
  // decode() peut ne jamais répondre dans un onglet en arrière-plan : on n'attend pas plus de
  // 3 secondes. rxaJouer vérifie de toute façon que chaque image est chargée avant de la montrer.
  return Promise.race([Promise.all(promesses), rxaAttendre(3000)]).then(() => { window._rxa.pret = true; });
}

function rxaCalme() {
  return document.hidden || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
const rxaAttendre = ms => new Promise(r => setTimeout(r, ms));

// Un mouvement, sur une image donnée. Chaque image a son propre verrou : le Rex du menu et celui du
// bandeau vivent chacun leur vie.
async function rxaJouer(mouvement, img) {
  if (!img || img._rxaJoue || rxaCalme()) return;
  const cadres = window._rxa.images[mouvement];
  if (!cadres || !cadres.every(c => c.complete && c.naturalWidth)) return;
  img._rxaJoue = true;
  const seq = RXA_SEQUENCES[mouvement];
  const ordre = seq ? seq.ordre : [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0];
  for (let p = 0; p < ordre.length; p++) {
    if (!document.body.contains(img)) break;
    img.src = cadres[ordre[p]].src;
    await rxaAttendre(seq ? seq.ms[p] : RXA_PAS_MS);
  }
  if (seq) img.src = seq.repos || RXA_REPOS;
  img._rxaJoue = false;
}

function rxaTirage(dernier) {
  const liste = RXA_MOUVEMENTS.length > 1 ? RXA_MOUVEMENTS.filter(m => m !== dernier) : RXA_MOUVEMENTS;
  const total = liste.reduce((s, m) => s + (RXA_POIDS[m] || 1), 0);
  let x = Math.random() * total;
  for (const m of liste) { x -= RXA_POIDS[m] || 1; if (x <= 0) return m; }
  return liste[0];
}

// La vie de Rex : mouvement, respiration, mouvement… tant qu'il est à l'écran.
async function rxaVivre(img, repos) {
  if (!img || img._rxaVit) return;
  img._rxaVit = true;
  img.classList.remove('respire', 'rxa-vivant', 'srx-costume');
  const premier = RXA_SEQUENCES[RXA_MOUVEMENTS[0]];
  img.src = (premier && premier.repos) || RXA_REPOS;
  if (RXA_MOUVEMENTS[0] === 'flamme') { img.classList.add('rxa-flamme'); img.removeAttribute('loading'); img.style.height = ''; }
  let dernier = null;
  await rxaAttendre(400);
  while (document.body.contains(img)) {
    if (rxaCalme() || !window._rxa.pret) { await rxaAttendre(1000); continue; }
    const m = img._rxaDemande || rxaTirage(dernier);
    img._rxaDemande = null;
    await rxaJouer(m, img);
    dernier = m;
    await rxaAttendre(repos[0] + Math.random() * (repos[1] - repos[0]));
  }
  img._rxaVit = false;
}

// ── Où Rex vit ─────────────────────────────────────────────────────────────────────────────────
function rxaPoser() {
  // Le bandeau du tableau de bord : le Rex principal (pas le compagnon de saison).
  document.querySelectorAll('img.dbx-hero-mascotte:not(.rexb-compagnon), .dbx-hero-mascotte img.rexb:not(.rexb-compagnon)').forEach(img => {
    if (img._rxaVit) return;
    img.addEventListener('mouseenter', () => { img._rxaDemande = RXA_MOUVEMENTS[0]; });
    rxaVivre(img, RXA_REPOS_BANDEAU);
  });
  // Plus de flottement ailleurs, ni de Rex animé dans le menu (retirés le 21.09.2026).
}

(function rxaBrancher() {
  const demarrer = () => {
    rxaPrecharger();
    rxaPoser();
    const main = document.getElementById('main-content');
    if (main) {
      let t = null;
      new MutationObserver(() => { clearTimeout(t); t = setTimeout(rxaPoser, 80); }).observe(main, { childList: true, subtree: true });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();

  const st = document.createElement('style');
  st.textContent = `
    /* Les Rex fixes restent fixes : plus de flottement (bandeaux, compagnon, REX CLOUD). */
    img.rexb.respire, .rexb-duo .rexb-compagnon.respire, .cloud-rex, img.rxa-vivant { animation: none !important; }
    /* Rex flamme dans le bandeau : image plus large (la flamme part vers la droite), sans flottement,
       sans le compagnon de saison à côté. Rex y garde à peu près la taille de l'ancienne pose. */
    img.dbx-hero-mascotte.rxa-flamme { height: 170px !important; width: auto !important; max-width: none; animation: none !important; filter: drop-shadow(0 10px 18px rgba(0,0,0,.28)); }
    .dbx-hero-droite .rexb-compagnon { display: none !important; }
    @media (max-width: 768px) { img.dbx-hero-mascotte.rxa-flamme { height: 96px !important; } }`;
  st.textContent += `
    .sidebar .rex-mascotte-menu, img.dbx-hero-mascotte { object-fit: contain; object-position: center bottom; }
    .sidebar .rex-mascotte-menu:hover, img.dbx-hero-mascotte:hover { cursor: pointer; }
    img.rxa-vivant { animation: rxaVivant 3.4s ease-in-out infinite; transform-origin: 50% 100%; }
    @keyframes rxaVivant {
      0%, 100% { transform: translateY(0) rotate(0deg) scale(1, 1); }
      22% { transform: translateY(-9px) rotate(-3deg) scale(.99, 1.01); }
      45% { transform: translateY(0) rotate(0deg) scale(1.03, .97); }
      68% { transform: translateY(-6px) rotate(3deg) scale(.99, 1.01); }
      88% { transform: translateY(0) rotate(0deg) scale(1.02, .98); }
    }
    @media (prefers-reduced-motion: reduce) { img.rxa-vivant { animation: none; } }`;
  document.head.appendChild(st);
})();
