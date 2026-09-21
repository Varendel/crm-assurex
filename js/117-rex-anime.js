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
// Déroulé demandé : les 60 images dans l'ordre, puis Rex MARCHE VRAIMENT — il part vers la gauche
// (image en miroir, cycle de marche des images 1 à 10) puis revient à sa place, deux allers-retours
// — puis tout recommence, en continu. Le trajet est un déplacement de l'image (translateX), en %
// de sa largeur pour rester juste sur téléphone ; le miroir pivote autour de ses pieds.
RXA_SEQUENCES.flamme = (() => {
  // 21.09.2026, nuit : « Vire les images du début où il fait le clin d'œil et la première flamme,
  // c'est la séquence la moins bien réussie. Conserve les autres. » La planche des 60 images n'est
  // plus jouée. Restent les planches du même style, toutes à la même échelle et au même point
  // d'appui, dans des images de 516 × 234 élargies à gauche pour la longue flamme (voir CSS) :
  //   · marche (8 images, un vrai pas)         → indices 0 à 7
  //   · demi-tour par la face (8 images)        → indices 8 à 15
  //   · marche en crachant vers la gauche (8)   → indices 16 à 23
  //   · saut (8 images)                         → indices 24 à 31 ; la hauteur de chaque image
  //     au-dessus du sol est rendue par un déplacement vertical (y, en % de la hauteur).
  const M = 0, DT = 8, FG = 16, SA = 24, PAS = 16, D = 36;
  const SAUT_Y = [0, 1.6, -0.5, -27.7, -37, -17.3, 0.8, -0.3], SAUT_MS = [160, 170, 90, 100, 190, 100, 150, 200];
  const etapes = [];
  const tourner = (vues, x) => vues.forEach(v => etapes.push({ f: DT + v, ms: v === 4 ? 220 : 110, x, miroir: false }));
  const marcher = (deX, aX, miroir, pas = PAS) => { for (let k = 0; k < pas; k++) etapes.push({ f: M + (k % 8), ms: 90, x: deX + (aX - deX) * (k + 1) / pas, miroir }); };
  const cracher = (deX, aX) => { const t = [130, 130, 130, 150, 240, 260, 160, 140]; for (let k = 0; k < 8; k++) etapes.push({ f: FG + k, ms: t[k], x: deX + (aX - deX) * (k + 1) / 8, miroir: false }); };
  const sauter = () => SAUT_Y.forEach((y, k) => etapes.push({ f: SA + k, ms: SAUT_MS[k], x: 0, y, miroir: false }));
  tourner([0, 1, 2, 3], 0);                   // de profil → de face
  sauter();                                   // un saut de joie, sur place
  tourner([3, 4, 5, 6, 7], 0);                // sourire en clignant, puis profil gauche
  marcher(0, -D, true);                       // vers la gauche
  tourner([7, 6, 5, 4, 3, 2, 1, 0], -D);      // demi-tour vers la droite, en passant par la face
  marcher(-D, 0, false);                      // revient
  tourner([0, 1, 2, 3, 4, 5, 6, 7], 0);       // demi-tour vers la gauche
  cracher(0, -D / 2);                         // repart en crachant une longue flamme turquoise
  marcher(-D / 2, -D, true, 8);               // finit le trajet en marchant
  // Fin de séquence (planche « REX appuyé », indices 32 et 33) : il s'adosse à gauche, bras et
  // jambes croisés, revient, et s'adosse à droite avant que tout recommence.
  const AP = 32, adosser = (pose, x) => etapes.push({ f: AP + pose, ms: 2200, x, miroir: false });
  tourner([7, 6, 5, 4, 3, 2, 1, 0], -D);      // se retourne vers la droite…
  adosser(1, -D);                             // … et s'adosse à gauche
  marcher(-D, 0, false);                      // revient à sa place
  tourner([0, 1, 2, 3, 4, 5, 6, 7], 0);       // se retourne vers la gauche…
  adosser(0, 0);                              // … et s'adosse à droite
  tourner([7, 6, 5, 4, 3, 2, 1, 0], 0);       // de nouveau de profil vers la droite : tout recommence
  const lot = (dossier, n = 8) => Array.from({ length: n }, (_, i) => `assets/logos/rex/${dossier}/${i + 1}.webp`);
  const fichiers = [...lot('anim-marche8'), ...lot('anim-demitour8'), ...lot('anim-flammegauche8'), ...lot('anim-saut8'), ...lot('anim-appui2', 2)];
  return { n: 34, fichiers, etapes, ordre: etapes.map(e => e.f), ms: etapes.map(e => e.ms), repos: 'assets/logos/rex/anim-demitour8/1.webp' };
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
    const liste = RXA_SEQUENCES[m] && RXA_SEQUENCES[m].fichiers;
    if (!window._rxa.images[m]) window._rxa.images[m] = Array.from({ length: n }, (_, i) => { const im = new Image(); im.src = liste ? liste[i] : `${RXA_DOSSIER}${m}/${i + 1}.${ext}`; return im; });
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
    const e = seq && seq.etapes && seq.etapes[p];
    if (e) img.style.transform = (e.x || e.miroir || e.y) ? `translate(${e.x}%, ${e.y || 0}%) scaleX(${e.miroir ? -1 : 1}) rotate(${e.r || 0}deg)` : '';
    await rxaAttendre(seq ? seq.ms[p] : RXA_PAS_MS);
  }
  if (seq && seq.etapes) img.style.transform = '';
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

// ── Le petit décor préhistorique (21.09.2026) ──────────────────────────────────────────────────
// « Intègre autour de lui deux ou trois éléments de paysage de dinosaure, dans le thème Rex, sans
// être extravagant. » Un volcan lointain (silhouette pâle, lueur turquoise, fumée lente), une
// fougère en ombre chinoise, quelques rochers et l'ombre de ses pieds. Tout est translucide, aux
// couleurs du bandeau : le décor se devine, Rex reste le sujet. Il couvre aussi son trajet de marche.
const RXA_DECOR = `
<svg class="rxa-decor" viewBox="0 0 420 170" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="rxaLueur" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#00CFFF" stop-opacity=".75"/><stop offset="1" stop-color="#00CFFF" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="rxa-fumee" fill="#fff" opacity=".12">
    <circle cx="118" cy="44" r="9"/><circle cx="128" cy="32" r="11"/><circle cx="116" cy="20" r="8"/>
  </g>
  <path d="M40 150 L96 70 Q104 60 112 62 L124 62 Q132 60 140 70 L206 150 Z" fill="#fff" opacity=".10"/>
  <ellipse cx="118" cy="64" rx="18" ry="7" fill="url(#rxaLueur)"/>
  <g fill="#0A1F4D" opacity=".42">
    <path d="M22 152 C24 120 30 96 44 78" stroke="#0A1F4D" stroke-width="3" fill="none"/>
    <path d="M44 78 C32 80 20 86 12 96 C26 92 36 90 44 88 Z"/>
    <path d="M42 90 C30 94 18 102 12 114 C26 108 36 104 42 100 Z"/>
    <path d="M38 104 C28 110 20 118 16 130 C28 122 34 118 38 114 Z"/>
    <path d="M46 84 C58 84 70 88 78 96 C66 94 56 94 46 94 Z"/>
    <path d="M44 98 C56 100 66 106 72 114 C60 110 52 108 44 108 Z"/>
    <path d="M40 112 C50 116 58 122 62 130 C52 126 46 124 40 122 Z"/>
    <path d="M268 152 Q274 138 290 138 Q304 138 308 152 Z"/>
    <path d="M300 152 Q304 144 314 144 Q322 145 324 152 Z" opacity=".8"/>
    <path d="M168 152 Q172 144 182 144 Q190 145 192 152 Z" opacity=".7"/>
  </g>
  <rect x="0" y="151" width="420" height="2" rx="1" fill="#fff" opacity=".14"/>
</svg>`;

function rxaDecor(img) {
  if (!img || (img.parentElement && img.parentElement.classList.contains('rxa-scene'))) return;
  const scene = document.createElement('span');
  scene.className = 'rxa-scene';
  img.parentNode.insertBefore(scene, img);
  scene.insertAdjacentHTML('afterbegin', RXA_DECOR);
  scene.appendChild(img);
}

// ── Où Rex vit ─────────────────────────────────────────────────────────────────────────────────
function rxaPoser() {
  // Le bandeau du tableau de bord : le Rex principal (pas le compagnon de saison).
  document.querySelectorAll('img.dbx-hero-mascotte:not(.rexb-compagnon), .dbx-hero-mascotte img.rexb:not(.rexb-compagnon)').forEach(img => {
    if (img._rxaVit) return;
    img.addEventListener('mouseenter', () => { img._rxaDemande = RXA_MOUVEMENTS[0]; });
    if (RXA_MOUVEMENTS[0] === 'flamme') rxaDecor(img);
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
    img.dbx-hero-mascotte.rxa-flamme { height: 170px !important; width: auto !important; max-width: none; animation: none !important; filter: drop-shadow(0 10px 18px rgba(0,0,0,.28));
      /* Images élargies de 180 px à gauche (sur 234 de haut) : on reprend cette place par une marge
         négative, pour que Rex reste exactement où il était ; le pivot du miroir suit ses pieds. */
      margin-left: calc(-180 / 234 * 170px); transform-origin: 53.7% 100%; position: relative; z-index: 2; pointer-events: none; }
    .dbx-hero-droite .rexb-compagnon { display: none !important; }
    /* Le décor : derrière Rex, calé sur ses pieds, étendu vers la gauche pour son trajet de marche. */
    .rxa-scene { position: relative; display: inline-block; line-height: 0; }
    .rxa-scene .rxa-decor { position: absolute; right: -30px; bottom: 0; height: 170px; width: auto; aspect-ratio: 420 / 170; z-index: 1; pointer-events: none; }
    .rxa-scene img { position: relative; z-index: 2; }
    .rxa-fumee { transform-box: fill-box; transform-origin: 50% 100%; animation: rxaFumee 9s ease-in-out infinite; }
    @keyframes rxaFumee { 0%, 100% { transform: translateY(0) scale(1); opacity: .12; } 50% { transform: translateY(-6px) scale(1.12); opacity: .07; } }
    @media (prefers-reduced-motion: reduce) { .rxa-fumee { animation: none; } }
    @media (max-width: 768px) { .rxa-scene .rxa-decor { height: 96px; right: -16px; } }
    @media (max-width: 768px) { img.dbx-hero-mascotte.rxa-flamme { height: 96px !important; margin-left: calc(-180 / 234 * 96px); } }`;
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
