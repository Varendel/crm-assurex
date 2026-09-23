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
  // 21.09.2026, soir : Rex va s'adosser pour de vrai : à gauche contre le bout de la barre de
  // recherche du bandeau (ou contre le bord gauche du bandeau quand elle n'est pas à sa hauteur,
  // sur téléphone), à droite contre le bord du bandeau. Ces points dépendent de la largeur de
  // l'écran : la séquence est recalculée à chaque passage (construire). La planche « marche
  // détaillée » a été essayée puis écartée (on ne voyait pas un pied passer devant l'autre).
  // 21.09.2026, nuit : marche à la planche « REX marche croisée », remise en ordre image par
  // image (la planche était mélangée) : 16 images pour un pas, classées par écart des pieds et
  // pied levé, alignées sur la tête. Un pas fait ~12 % de la largeur de l'image : 0,8 % par image,
  // pour que le pied posé ne glisse pas.
  // 22.09.2026 : nouvelle planche « un pas » (8 images, dont 6 utiles : la 7 et la 8 répètent la
  // 1 et la 2). Chaque image a son avance propre, mesurée sur le pied posé (en px de la planche),
  // et une durée qui en dépend : le pied au sol reste immobile, le corps avance.
  // 22.09.2026 (validé par Jonathan) : « planche reconstituée » de 13 images. Les 6 images du pas
  // sont complétées par 7 intermédiaires reprises des autres planches (croisée 2 et 13,
  // intermédiaire 7, correction 4 et 5, détaillée 7 et 16), choisies par comparaison des
  // silhouettes des jambes pour combler les sauts. Les écarts étant désormais réguliers, l'avance
  // et la durée sont les mêmes pour chaque image.
  // 22.09.2026, correction validée : 10 images (les 6e, 8e et 11e de la version à 13 retirées :
  // petit bond et allers-retours du pied). Rex avance à chaque image exactement du recul mesuré
  // de son pied posé (px de l'image de 516), pour que ce pied ne glisse plus au sol.
  const M = 0, NM = 10, DT = 10, FG = 18, SA = 26, AP = 34, D = 36;
  const PAS_AVANCE = [3, 2, 6, 5, 9, 3, 15, 6, 10, 6], PAS_TOTAL = 65, PAS_MS = 65, FOULEE = 65 / 516 * 100;   // foulée en % de la largeur de l'image
  const SAUT_Y = [0, 1.6, -0.5, -27.7, -37, -17.3, 0.8, -0.3], SAUT_MS = [160, 170, 90, 100, 190, 100, 150, 200];
  // Dans les images de 516 px : bords du corps dans les deux poses adossées (dos à droite, dos à
  // gauche), et pivot du miroir (53,7 %, voir le CSS).
  const APPUI_DROIT = 350, APPUI_GAUCHE = 227, LARGEUR = 516;
  function construire(img) {
    let G = -D, R = 0, FLAMME_MIN = -D / 2;
    // 23.09.2026 : « le Rex du dash qui se balade le long de l'opp ». Le même trajet, mesuré sur le
    // bandeau de l'affaire quand c'est là qu'il vit.
    // Puis : « je veux le mini Rex dans CET espace, pas plus loin. » Sur une fiche, le bandeau est
    // plein de boutons et d'indicateurs : il traversait devant tout. Quand son conteneur porte
    // .rxa-zone, c'est CE rectangle qui borne son trajet — pas le bandeau (voir js/149, qui mesure
    // le creux libre).
    const petit = !!(img && img.classList.contains('rxa-petit'));
    const hero = img && (img.closest('.rxa-zone') || img.closest('.dbx-hero, .opx-hero'));
    if (hero && img.style.transform === '') {
      const ri = img.getBoundingClientRect(), rh = hero.getBoundingClientRect();
      if (ri.width > 0) {
        const pct = px => px / ri.width * 100, bord = p => ri.left + p / LARGEUR * ri.width;
        // 23.09.2026 : « fais défiler Rex le long de la barre, même devant la recherche sur PC ».
        // Il s'arrêtait au bord droit de la barre de recherche et s'y adossait ; il la traverse
        // maintenant par-dessus — il passe devant dans l'ordre d'empilement, et laisse passer les
        // clics (pointer-events: none) — jusqu'au bord gauche du bandeau, comme sur téléphone.
        // La barre repasse devant dès qu'on écrit dedans (:focus-within, plus bas dans le CSS).
        const g = pct(rh.left + 10 - bord(APPUI_GAUCHE)), r = pct(rh.right - 12 - bord(APPUI_DROIT));
        // La borne large laisse la traversée complète des grands écrans (≈ -370 % en 1920 px).
        if (g < -8 && g > -420) G = g;
        R = Math.max(0, Math.min(40, r));
        // La longue flamme part du bord gauche de l'image : elle ne doit pas sortir du bandeau.
        FLAMME_MIN = Math.min(0, pct(rh.left + 6 - ri.left));
      }
    }
    const etapes = [];
    const tourner = (vues, x) => vues.forEach(v => etapes.push({ f: DT + v, ms: v === 4 ? 220 : 110, x, miroir: false }));
    const marcher = (deX, aX, miroir) => {
      const dist = Math.abs(aX - deX), sens = aX < deX ? -1 : 1;
      if (dist < 0.5) return;
      // Nombre de pas entier le plus proche, pour finir le trajet sur un appui complet.
      const pas = Math.max(1, Math.round(dist / FOULEE)), echelle = dist / (pas * FOULEE);
      let fait = 0;
      for (let p = 0; p < pas; p++) for (let k = 0; k < NM; k++) {
        const part = PAS_AVANCE[k] / PAS_TOTAL;
        fait += part * FOULEE * echelle;
        etapes.push({ f: M + k, ms: PAS_MS, x: deX + sens * Math.min(fait, dist), miroir });
      }
    };
    const cracher = (deX, aX) => { const t = [130, 130, 130, 150, 240, 260, 160, 140]; for (let k = 0; k < 8; k++) etapes.push({ f: FG + k, ms: t[k], x: deX + (aX - deX) * (k + 1) / 8, miroir: false }); };
    const sauter = (x = 0, miroir = false) => SAUT_Y.forEach((y, k) => etapes.push({ f: SA + k, ms: SAUT_MS[k], x, y, miroir }));
    const adosser = (pose, x) => etapes.push({ f: AP + pose, ms: 2400, x, miroir: false });
    const C = Math.max(G / 2, -D / 2, FLAMME_MIN);

    // ── La version courte, pour le creux d'une fiche d'affaire ───────────────────────────────────
    // « Fais-le se poser sur les deux bords et cracher des flammes. Adapte la séquence à la
    // longueur. » Le trajet du bandeau dure près d'une minute et compte trois étapes intermédiaires
    // — dans un creux de 600 px, ça donne un va-et-vient frénétique. Ici : il salue, traverse en
    // crachant, se pose contre le bord gauche, retraverse, se pose contre le bord droit et crache
    // de là. Deux appuis, deux flammes, et rien entre les deux qui remplisse du vide.
    if (petit) {
      const demi = G * 0.45;
      tourner([0, 1, 2, 3], 0);               // de profil → de face
      sauter(0, false);                       // un salut pour commencer
      tourner([3, 4, 5, 6, 7], 0);            // se met de profil vers la gauche
      cracher(0, demi);                       // s'élance en crachant sa flamme
      marcher(demi, G, true);                 // jusqu'au bord gauche du creux
      tourner([7, 6, 5, 4, 3, 2, 1, 0], G);   // se retourne…
      adosser(1, G);                          // … et s'y adosse
      marcher(G, 0, false);                   // retraverse
      tourner([0, 1, 2, 3, 4, 5, 6, 7], 0);   // se retourne…
      adosser(0, 0);                          // … et s'adosse au bord droit
      cracher(0, -2);                         // d'où il crache, vers l'intérieur
      tourner([7, 6, 5, 4, 3, 2, 1, 0], 0);   // reprend sa pose : tout recommence
      return etapes;
    }

    tourner([0, 1, 2, 3], 0);                 // de profil → de face
    sauter();                                 // un saut de joie, sur place
    tourner([3, 4, 5, 6, 7], 0);              // sourire en clignant, puis profil gauche
    marcher(0, C, true);                      // vers la gauche
    tourner([7, 6, 5, 4, 3, 2, 1, 0], C);     // demi-tour vers la droite, en passant par la face
    marcher(C, 0, false);                     // revient
    tourner([0, 1, 2, 3, 4, 5, 6, 7], 0);     // demi-tour vers la gauche
    cracher(0, C);                            // repart en crachant une longue flamme turquoise
    // 23.09.2026 : « rajoute flamme et saut le long de la barre pour rallonger le trajet ». La
    // longue traversée est coupée en trois : il saute au premier tiers, crache au second.
    const T1 = C + (G - C) * 0.38, T2 = C + (G - C) * 0.72, T3 = G + (R - G) * 0.5;
    marcher(C, T1, true);
    sauter(T1, true);                         // un saut en chemin, face à sa marche
    marcher(T1, T2, true);
    cracher(T2, T2 - 4);                      // une flamme au passage
    marcher(T2, G, true);                     // jusqu'au bord gauche, par-dessus la recherche
    tourner([7, 6, 5, 4, 3, 2, 1, 0], G);     // se retourne vers la droite…
    adosser(1, G);                            // … et s'adosse contre le bord gauche du bandeau
    marcher(G, T3, false);                    // retraverse, avec un saut à mi-chemin
    sauter(T3, false);
    marcher(T3, R, false);                    // jusqu'au bord droit du bandeau
    tourner([0, 1, 2, 3, 4, 5, 6, 7], R);     // se retourne vers la gauche…
    adosser(0, R);                            // … et s'adosse contre le bord du bandeau
    marcher(R, 0, true);                      // revient à sa place
    tourner([7, 6, 5, 4, 3, 2, 1, 0], 0);     // de nouveau de profil vers la droite : tout recommence
    return etapes;
  }
  const lot = (dossier, n = 8) => Array.from({ length: n }, (_, i) => `assets/logos/rex/${dossier}/${i + 1}.webp`);
  const fichiers = [...lot('anim-marche10', NM), ...lot('anim-demitour8'), ...lot('anim-flammegauche8'), ...lot('anim-saut8'), ...lot('anim-appui2', 2)];
  const seq = { n: 36, fichiers, repos: 'assets/logos/rex/anim-demitour8/1.webp' };
  seq.construire = img => { seq.etapes = construire(img); seq.ordre = seq.etapes.map(e => e.f); seq.ms = seq.etapes.map(e => e.ms); };
  seq.construire(null);
  return seq;
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
  if (seq && seq.construire) seq.construire(img);
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
  if (RXA_MOUVEMENTS[0] === 'flamme') {
    // 22.09.2026 : plus d'image d'apparition. L'ancienne pose fixe du bandeau reste invisible (CSS
    // plus bas) ; Rex n'apparaît qu'une fois sa première image animée chargée.
    img.removeAttribute('loading'); img.style.height = '';
    img.addEventListener('load', () => img.classList.add('rxa-flamme'), { once: true });
    img.src = premier.repos;
    if (img.complete && img.naturalWidth && img.src.endsWith(premier.repos)) img.classList.add('rxa-flamme');
  } else img.src = (premier && premier.repos) || RXA_REPOS;
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
    <!-- 22.09.2026 : relief et nuances. Brume chaude à l'horizon, volcan éclairé à gauche et dans
         l'ombre à droite, une montagne plus lointaine derrière, végétation vert-bleu, rochers
         plus chauds. Tout reste translucide : le décor se devine derrière Rex. -->
    <linearGradient id="rxaBrume" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB88A" stop-opacity="0"/><stop offset=".7" stop-color="#FFB88A" stop-opacity=".07"/><stop offset="1" stop-color="#7FE0C8" stop-opacity=".10"/></linearGradient>
    <linearGradient id="rxaFlancClair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9D8FF" stop-opacity=".30"/><stop offset="1" stop-color="#8FA8E0" stop-opacity=".12"/></linearGradient>
    <linearGradient id="rxaFlancOmbre" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1F4D" stop-opacity=".30"/><stop offset="1" stop-color="#0A1F4D" stop-opacity=".12"/></linearGradient>
    <linearGradient id="rxaQueue" x1="0" y1="0" x2="62" y2="-36" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFD27A" stop-opacity="1"/><stop offset=".3" stop-color="#FF7A2E" stop-opacity=".8"/><stop offset="1" stop-color="#FF5A1F" stop-opacity="0"/></linearGradient>
    <linearGradient id="rxaSol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6FD3B0" stop-opacity=".16"/><stop offset="1" stop-color="#6FD3B0" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="0" y="96" width="420" height="56" fill="url(#rxaBrume)"/>
  <!-- 22.09.2026 : « ajoute une pluie de météorites derrière Rex ». Tout au fond, derrière la
       montagne : des traînées qui tombent en biais, de droite à gauche, chacune à son rythme ; la
       tête brille, la queue s'efface, et chaque météore s'éteint avant l'horizon. -->
  <g class="rxa-meteores" stroke-linecap="round">
    <g transform="translate(360 -6)"><g class="rxa-meteore" style="animation-duration:5.2s;animation-delay:-.4s"><path d="M0 0 L62 -36" stroke="url(#rxaQueue)" stroke-width="3"/><circle r="3" fill="#FFF6E0"/></g></g>
    <g transform="translate(290 -10) scale(.7)"><g class="rxa-meteore" style="animation-duration:6.8s;animation-delay:-2.9s"><path d="M0 0 L62 -36" stroke="url(#rxaQueue)" stroke-width="3"/><circle r="3" fill="#FFF6E0"/></g></g>
    <g transform="translate(410 4) scale(.85)"><g class="rxa-meteore" style="animation-duration:7.6s;animation-delay:-5.1s"><path d="M0 0 L62 -36" stroke="url(#rxaQueue)" stroke-width="3"/><circle r="3" fill="#FFF6E0"/></g></g>
    <g transform="translate(230 -14) scale(.55)"><g class="rxa-meteore" style="animation-duration:5.9s;animation-delay:-1.7s"><path d="M0 0 L62 -36" stroke="url(#rxaQueue)" stroke-width="3"/><circle r="3" fill="#FFF6E0"/></g></g>
    <g transform="translate(330 -18) scale(.6)"><g class="rxa-meteore" style="animation-duration:8.4s;animation-delay:-6.3s"><path d="M0 0 L62 -36" stroke="url(#rxaQueue)" stroke-width="3"/><circle r="3" fill="#FFF6E0"/></g></g>
    <g transform="translate(180 -8) scale(.45)"><g class="rxa-meteore" style="animation-duration:9.2s;animation-delay:-3.8s"><path d="M0 0 L62 -36" stroke="url(#rxaQueue)" stroke-width="3"/><circle r="3" fill="#FFF6E0"/></g></g>
  </g>
  <!-- La montagne lointaine, derrière le volcan. -->
  <path d="M150 150 L196 98 Q204 90 212 96 L236 116 L252 104 Q258 100 264 106 L318 150 Z" fill="#B8C8F0" opacity=".09"/>
  <!-- Le volcan fume : des bouffées rondes naissent du cratère, montent en grossissant et
       s'effacent, l'une après l'autre. -->
  <g fill="#fff">
    <circle class="rxa-bouffee" cx="118" cy="54" r="7"/>
    <circle class="rxa-bouffee" cx="121" cy="54" r="6" style="animation-delay:-1.6s"/>
    <circle class="rxa-bouffee" cx="116" cy="54" r="7.5" style="animation-delay:-3.2s"/>
    <circle class="rxa-bouffee" cx="120" cy="54" r="6.5" style="animation-delay:-4.8s"/>
    <circle class="rxa-bouffee" cx="117" cy="54" r="7" style="animation-delay:-6.4s"/>
  </g>
  <!-- Le volcan en relief : flanc gauche éclairé, flanc droit dans l'ombre, ravines, coulées
       turquoise qui luisent à peine. -->
  <path d="M40 150 L96 70 Q104 60 112 62 L118 62 L112 96 L104 122 L110 150 Z" fill="url(#rxaFlancClair)"/>
  <path d="M110 150 L104 122 L112 96 L118 62 L124 62 Q132 60 140 70 L206 150 Z" fill="url(#rxaFlancOmbre)"/>
  <path d="M40 150 L96 70 Q104 60 112 62 L124 62 Q132 60 140 70 L206 150 Z" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="1"/>
  <g fill="none" stroke-linecap="round">
    <path d="M100 72 Q92 96 78 118 Q70 132 62 146" stroke="#fff" stroke-opacity=".10" stroke-width="1.2"/>
    <path d="M108 66 Q104 90 94 112" stroke="#fff" stroke-opacity=".08" stroke-width="1"/>
    <path d="M132 70 Q142 94 158 116 Q168 130 178 146" stroke="#0A1F4D" stroke-opacity=".18" stroke-width="1.4"/>
    <path d="M126 66 Q130 88 138 104" stroke="#0A1F4D" stroke-opacity=".14" stroke-width="1.1"/>
    <path class="rxa-lave" d="M116 64 Q114 80 110 92 Q106 104 108 116" stroke="#00CFFF" stroke-opacity=".30" stroke-width="1.6"/>
    <path class="rxa-lave" d="M122 64 Q126 78 130 88" stroke="#00CFFF" stroke-opacity=".22" stroke-width="1.2" style="animation-delay:-2s"/>
  </g>
  <path d="M96 70 Q104 60 112 62 L124 62 Q132 60 140 70 Q130 66 118 67 Q106 66 96 70 Z" fill="#fff" opacity=".12"/>
  <ellipse cx="118" cy="64" rx="18" ry="7" fill="url(#rxaLueur)"/>
  <!-- Au loin, un grand herbivore au long cou, teinté vert-bleu. -->
  <path d="M296 150 C310 144 320 132 338 125 C354 119 368 120 376 114 C381 98 384 80 389 66 C391 59 398 56 403 60 C406 63 403 67 398 67 C394 82 392 102 388 122 C386 134 381 141 378 151 L369 151 L367 140 C358 142 348 142 341 140 L339 151 L330 151 L328 138 C317 143 306 148 296 150 Z" fill="#9FE3D2" opacity=".10"/>
  <!-- Des ptérodactyles qui passent, de droite à gauche, chacun à son rythme. -->
  <g transform="translate(450 18)" fill="#0A1F4D" opacity=".42">
    <g class="rxa-passe" style="animation-duration:23s;animation-delay:-6s">
      <g class="rxa-ailes"><path d="M-1 0 C-6 -6 -13 -7 -20 -3 C-13 -3 -7 -1 -2 2 Z"/><path d="M1 0 C6 -6 13 -7 20 -3 C13 -3 7 -1 2 2 Z"/></g>
      <path d="M3 1 C1 -1 -2 -1 -4 1 L-11 -1 L-6 2 C-4 4 1 4 3 1 Z"/>
    </g>
  </g>
  <g transform="translate(460 40) scale(.7)" fill="#0A1F4D" opacity=".32">
    <g class="rxa-passe" style="animation-duration:31s;animation-delay:-19s">
      <g class="rxa-ailes" style="animation-duration:1.3s"><path d="M-1 0 C-6 -6 -13 -7 -20 -3 C-13 -3 -7 -1 -2 2 Z"/><path d="M1 0 C6 -6 13 -7 20 -3 C13 -3 7 -1 2 2 Z"/></g>
      <path d="M3 1 C1 -1 -2 -1 -4 1 L-11 -1 L-6 2 C-4 4 1 4 3 1 Z"/>
    </g>
  </g>
  <g transform="translate(470 8) scale(.55)" fill="#0A1F4D" opacity=".26">
    <g class="rxa-passe" style="animation-duration:27s;animation-delay:-2s">
      <g class="rxa-ailes" style="animation-duration:1.1s"><path d="M-1 0 C-6 -6 -13 -7 -20 -3 C-13 -3 -7 -1 -2 2 Z"/><path d="M1 0 C6 -6 13 -7 20 -3 C13 -3 7 -1 2 2 Z"/></g>
      <path d="M3 1 C1 -1 -2 -1 -4 1 L-11 -1 L-6 2 C-4 4 1 4 3 1 Z"/>
    </g>
  </g>
  <!-- Un ptérodactyle qui plane lentement près de la fumée. -->
  <g transform="translate(62 26)" fill="#0A1F4D" opacity=".5">
    <g class="rxa-ptero">
      <g class="rxa-ailes">
        <path d="M-1 0 C-7 -7 -16 -8 -25 -3 C-17 -3 -9 -1 -3 3 Z"/>
        <path d="M1 0 C7 -7 16 -8 25 -3 C17 -3 9 -1 3 3 Z"/>
      </g>
      <path d="M-3 1 C-1 -1 2 -1 4 1 L12 -1 L6 2 C4 4 -1 4 -3 1 Z"/>
      <path d="M-3 2 L-8 4 L-3 3 Z"/>
    </g>
  </g>
  <!-- Le palmier préhistorique (cycadée) : tronc écaillé, couronne de palmes arquées. -->
  <g fill="#0C3A4C" opacity=".5">
    <path d="M36 152 C39 130 43 106 48 82 L54 82 C50 106 47 130 45 152 Z" fill="#3A2F4F"/>
    <path d="M38 140 l7 -3 M39 128 l7 -3 M41 116 l7 -3 M43 104 l7 -3 M45 92 l7 -3" stroke="#fff" stroke-opacity=".10" stroke-width="1.2" fill="none"/>
    <path d="M51 79 C66 70 86 72 99 88 C86 81 68 81 52 84 Z"/>
    <path d="M51 79 C36 70 16 72 3 88 C16 81 34 81 50 84 Z"/>
    <path d="M51 78 C60 62 78 55 93 60 C79 62 64 69 53 81 Z"/>
    <path d="M51 78 C42 62 24 55 9 60 C23 62 38 69 49 81 Z"/>
    <path d="M51 78 C50 64 54 53 63 46 C59 57 56 68 53 80 Z"/>
    <path d="M52 81 C67 85 80 96 84 112 C75 101 64 92 52 86 Z"/>
    <path d="M50 81 C35 85 22 96 18 112 C27 101 38 92 50 86 Z"/>
    <path d="M62 152 C60 142 56 136 50 132 C58 134 63 140 66 150 Z M68 152 C70 140 76 134 84 132 C78 138 74 144 72 152 Z M74 152 C78 144 86 140 94 140 C86 144 80 148 78 152 Z"/>
  </g>
  <!-- Rochers aux tons chauds, avec un reflet sur le dessus. -->
  <g fill="#3E3350" opacity=".5">
    <path d="M268 152 Q274 138 290 138 Q304 138 308 152 Z"/>
    <path d="M300 152 Q304 144 314 144 Q322 145 324 152 Z" opacity=".8"/>
    <path d="M168 152 Q172 144 182 144 Q190 145 192 152 Z" opacity=".7"/>
  </g>
  <g fill="none" stroke="#FFD2B0" stroke-opacity=".16" stroke-width="1.2" stroke-linecap="round">
    <path d="M276 142 Q288 137 300 141"/><path d="M306 147 Q313 144 319 146"/><path d="M173 148 Q181 144 188 147"/>
  </g>
  <rect x="0" y="146" width="420" height="6" fill="url(#rxaSol)"/>
  <rect x="0" y="151" width="420" height="2" rx="1" fill="#fff" opacity=".14"/>
</svg>`;

// ── L'horizon, sur toute la largeur du bandeau (23.09.2026) ─────────────────────────────────────
// « Continue le paysage le long du bandeau bleu sur iPhone et aussi PC, va jusqu'au bout, intègre
// deux trois éléments supplémentaires comme une lune luminescente. »
//
// Le décor (volcan, cycadée, rochers) tient dans 420 px calés sur Rex, à droite : à gauche, le
// bandeau redevenait un aplat. Cette couche-ci part du bord gauche et va jusqu'au bord droit.
// Elle est faite de MOTIFS RÉPÉTÉS plutôt que d'un grand dessin étiré : un iPhone de 360 px et un
// écran de 1600 px montrent alors exactement les mêmes collines, ni écrasées ni distendues.
// Trois éléments s'ajoutent au paysage : deux rangs de collines, un ciel étoilé qui scintille, et
// une lune luminescente à halo. Tout est posé sur la ligne de sol mesurée (--rxa-sol), donc à la
// même hauteur que le volcan, et reste très translucide pour ne pas gêner le texte du bandeau.
const RXA_HORIZON = `
<span class="rxa-horizon" aria-hidden="true">
  <span class="rxa-etoiles"></span>
  <span class="rxa-collines"></span>
  <svg class="rxa-lune" viewBox="0 0 100 100" focusable="false">
    <defs>
      <radialGradient id="rxaHalo"><stop offset=".30" stop-color="%23EAF6FF" stop-opacity=".50"/><stop offset=".55" stop-color="%239FD8FF" stop-opacity=".16"/><stop offset="1" stop-color="%239FD8FF" stop-opacity="0"/></radialGradient>
      <radialGradient id="rxaLuneCorps" cx="38%" cy="34%"><stop offset="0" stop-color="%23FFFFFF"/><stop offset=".68" stop-color="%23EAF3FF"/><stop offset="1" stop-color="%23BFD6F2"/></radialGradient>
    </defs>
    <circle cx="50" cy="50" r="49" fill="url(%23rxaHalo)"/>
    <circle class="rxa-lune-corps" cx="50" cy="50" r="19" fill="url(%23rxaLuneCorps)" opacity=".9"/>
    <g fill="%23AFC6E6" opacity=".5"><circle cx="44" cy="45" r="3.1"/><circle cx="56" cy="53" r="2.1"/><circle cx="48" cy="58" r="1.5"/></g>
  </svg>
</span>`.replace(/%23/g, '#');

function rxaHorizon(hero) {
  if (!hero || hero.querySelector(':scope > .rxa-horizon')) return;
  hero.insertAdjacentHTML('afterbegin', RXA_HORIZON);
}

// ── Le décor du couloir d'une fiche d'affaire (23.09.2026) ──────────────────────────────────────
// « Fais-le s'appuyer sur quelque chose, dessine quelque chose de cohérent. Ajoute aussi un paysage
// d'inspiration libre. » Il s'adossait au vide : le geste existait, l'objet manquait.
//
// Aux deux bouts, deux objets du métier plutôt qu'un décor de fantaisie : à gauche un panneau
// indicateur — l'affaire avance vers quelque part — à droite une pile de dossiers, celle des
// classeurs du logo REX CLOUD. Entre les deux, un paysage bas : collines lointaines, quelques
// étoiles, un croissant de lune. Tout est en motifs répétés, donc juste à toutes les largeurs.
//
// Rex marche sur une PISTE en retrait de 34 px de chaque côté : c'est ce qui lui laisse la place de
// s'appuyer contre les objets au lieu de passer devant.
const RXA_PETIT_SCENE = `<span class="opx-paysage" aria-hidden="true">
  <span class="opxp-etoiles"></span><span class="opxp-lune"></span>
  <span class="opxp-collines"></span>
  <span class="opxp-panneau"></span><span class="opxp-dossiers"></span>
</span>`;

function rxaDecor(img) {
  if (!img || (img.parentElement && img.parentElement.classList.contains('rxa-scene'))) return;
  const scene = document.createElement('span');
  scene.className = 'rxa-scene';
  img.parentNode.insertBefore(scene, img);
  // Le petit Rex des fiches d'affaire garde la séquence, pas le paysage : le volcan mesure 170 px
  // de haut, il écraserait un bandeau de fiche, et les étoiles rendraient les indicateurs illisibles.
  if (!img.classList.contains('rxa-petit')) scene.insertAdjacentHTML('afterbegin', RXA_DECOR);
  scene.appendChild(img);
  rxaSol(img);
}

// ── Le sol, jusqu'au bas du bandeau (22.09.2026) ─────────────────────────────────────────────────
// « Ajoute un effet de sol jusqu'au bas du bandeau au paysage. » Le décor s'arrêtait à la ligne
// où marche Rex ; sous elle, le dégradé du bandeau reprenait, et le paysage semblait posé en l'air.
// Une couche posée sur le bandeau lui-même part EXACTEMENT de cette ligne (mesurée, car la marge
// basse du bandeau change entre ordinateur et téléphone) et descend jusqu'au bord : terre sombre,
// liseré vert d'eau, quelques touffes d'herbe et cailloux. Elle s'efface vers la gauche pour ne
// pas passer sous la barre de recherche.
function rxaSol(img) {
  const hero = img && img.closest('.dbx-hero, .opx-hero');
  if (!hero) return;
  if (!img.classList.contains('rxa-petit')) rxaHorizon(hero);
  if (!hero.querySelector(':scope > .rxa-sol')) hero.insertAdjacentHTML('beforeend', '<span class="rxa-sol" aria-hidden="true"></span>');
  const caler = () => {
    if (!hero.isConnected) return;
    const d = hero.querySelector('.rxa-decor');
    const rh = hero.getBoundingClientRect();
    let ligne;
    if (d) {
      const rd = d.getBoundingClientRect();
      if (!rd.height) return;
      ligne = rd.top + rd.height * 151 / 170;              // la ligne de sol du dessin (viewBox 420 × 170)
    } else {
      const ri = img.getBoundingClientRect();              // sans décor : Rex marche sur le bas de son image
      if (!ri.height) return;
      ligne = ri.bottom;
    }
    hero.style.setProperty('--rxa-sol', Math.max(8, Math.round(rh.bottom - ligne)) + 'px');
    // ── La lune ──────────────────────────────────────────────────────────────────────────────────
    // Troisième tentative, et la raison des deux premières : je lui donnais un ENDROIT (62 %, puis
    // « 30 px à droite de la barre de recherche »), et cet endroit redevenait faux dès que le
    // bandeau changeait de largeur ou qu'un bouton s'ajoutait — elle repassait derrière.
    // Elle ne se place plus à un endroit : elle se place LÀ OÙ IL Y A DE LA PLACE. On mesure ce que
    // le bandeau contient déjà (titre, barre de recherche, boutons, indicateurs) et on cherche, de
    // droite à gauche, le premier emplacement libre à la hauteur du « Ctrl K » — la hauteur
    // demandée. Si cette bande est pleine, on remonte tout en haut du bandeau. Recalculé à chaque
    // redimensionnement : elle ne peut plus se retrouver cachée.
    const lune = hero.querySelector('.rxa-lune');
    if (lune) {
      const T = Math.round(lune.getBoundingClientRect().width) || 84;
      const rech = hero.querySelector('.dbx-recherche');
      const rr = rech && rech.getBoundingClientRect();
      const occupe = [...hero.querySelectorAll('h1, h2, h3, p, button, a, input, select, .dbx-kpi, .dbx-recherche')]
        .map(e => e.getBoundingClientRect()).filter(r => r.width > 8 && r.height > 8);
      const libre = (x, cy) => !occupe.some(r => x < r.right + 12 && x + T > r.left - 12
        && cy - T / 2 < r.bottom + 8 && cy + T / 2 > r.top - 8);
      const hauteurs = [];
      if (rr && rr.width > 0) hauteurs.push(rr.top + rr.height / 2);   // la hauteur demandée
      hauteurs.push(rh.top + T / 2 + 10);                              // à défaut, le haut du ciel
      let pose = null;
      for (const cy of hauteurs) {
        for (let x = rh.right - 18 - T; x > rh.left + 10 && !pose; x -= 6) if (libre(x, cy)) pose = { x, cy };
        if (pose) break;
      }
      if (!pose) pose = { x: rh.right - 18 - T, cy: rh.top + T / 2 + 10 };
      hero.style.setProperty('--rxa-lune-x', Math.round(pose.x - rh.left) + 'px');
      hero.style.setProperty('--rxa-lune-b', Math.round(rh.bottom - pose.cy - T / 2) + 'px');
    }
  };
  requestAnimationFrame(caler);
  setTimeout(caler, 400);
  if (!window._rxaSolResize) {
    window._rxaSolResize = true;
    let t = null;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => document.querySelectorAll('.dbx-hero, .opx-hero').forEach(h => { const i = h.querySelector('img.dbx-hero-mascotte'); if (i) rxaSol(i); }), 150); });
  }
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
    /* Le même Rex, en petit, sur le bandeau d'une affaire (23.09.2026) : « le Rex du dash qui se
       balade le long de l'opp ». Même séquence, même trajet mesuré, deux tiers de la taille. Il
       passe DEVANT les indicateurs comme il passe devant la barre de recherche, et laisse passer
       les clics. La marge négative suit la hauteur, sinon ses pieds se décalent. */
    /* Sa taille suit la hauteur réellement disponible dans le creux (mesurée par js/149) : un Rex
       de 104 px dans une bande de 60 déborde sur les boutons du dessus. */
    img.dbx-hero-mascotte.rxa-flamme.rxa-petit { height: var(--rxa-petit-h, 104px) !important;
      margin-left: calc(-180 / 234 * var(--rxa-petit-h, 104px)); }
    /* Le creux est mesuré par js/149, qui pose left / width / bottom. Rex se range à droite de sa
       piste : c'est de là qu'il part, et c'est là qu'il revient. */
    .opx-rex { position: absolute; right: auto; bottom: 0; z-index: 4; line-height: 0; pointer-events: none; }
    .opx-piste { position: absolute; left: 34px; right: 34px; bottom: 0; top: 0; text-align: right; z-index: 1; }
    .opx-paysage { position: absolute; inset: 0; overflow: hidden; border-radius: 10px; z-index: 0; }
    /* Les collines et les étoiles : des motifs répétés, donc identiques quelle que soit la largeur
       du creux — un dessin unique étiré serait déformé sur les écrans larges. */
    .opxp-collines { position: absolute; left: 0; right: 0; bottom: 0; height: 58%;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='40' viewBox='0 0 300 40'%3E%3Cpath d='M0 40 L0 26 Q34 14 68 22 Q102 30 136 18 Q172 6 206 20 Q240 34 272 22 Q288 16 300 21 L300 40 Z' fill='%230A1F4D' fill-opacity='.30'/%3E%3Cpath d='M0 26 Q34 14 68 22 Q102 30 136 18 Q172 6 206 20 Q240 34 272 22 Q288 16 300 21' fill='none' stroke='%237FE0C8' stroke-opacity='.16' stroke-width='1.1'/%3E%3C/svg%3E") repeat-x left bottom / 300px 40px; }
    .opxp-etoiles { position: absolute; left: 0; right: 0; top: 2px; height: 42%;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='210' height='26' viewBox='0 0 210 26'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='16' cy='7' r='1' opacity='.5'/%3E%3Ccircle cx='58' cy='16' r='.8' opacity='.3'/%3E%3Ccircle cx='89' cy='5' r='1.2' opacity='.55'/%3E%3Ccircle cx='124' cy='14' r='.7' opacity='.26'/%3E%3Ccircle cx='158' cy='8' r='1' opacity='.44'/%3E%3Ccircle cx='191' cy='18' r='.9' opacity='.32'/%3E%3C/g%3E%3C/svg%3E") repeat-x left top / 210px 26px;
      animation: rxaScintille 7s ease-in-out infinite; }
    /* La lune est posée à droite du couloir, au-dessus de la pile de dossiers : c'est le seul coin
       que Rex ne traverse pas. */
    .opxp-lune { position: absolute; right: 12%; top: 4px; width: 15px; height: 15px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M17.6 15.2A8 8 0 0 1 8.8 3.4a8 8 0 1 0 8.8 11.8Z' fill='%23E8F3FF' fill-opacity='.72'/%3E%3C/svg%3E") no-repeat center / contain;
      filter: drop-shadow(0 0 4px rgba(190, 225, 255, .5)); }
    /* Les deux appuis. Le panneau dépasse Rex en hauteur, la pile lui arrive à l'épaule : dans les
       deux cas on voit contre QUOI il s'adosse, et pas seulement qu'il s'arrête. */
    .opxp-panneau { position: absolute; left: 2px; bottom: 0; width: 26px; height: 96%;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 64' preserveAspectRatio='xMidYMax meet'%3E%3Crect x='11' y='10' width='4' height='54' rx='1.4' fill='%230A1F4D' fill-opacity='.55'/%3E%3Cpath d='M3 13h16l5 6-5 6H3z' fill='%237FE0C8' fill-opacity='.34'/%3E%3Cpath d='M3 13h16l5 6-5 6H3z' fill='none' stroke='%23C9EFE6' stroke-opacity='.4' stroke-width='.9'/%3E%3Crect x='6' y='18' width='10' height='1.8' rx='.9' fill='%23E8F3FF' fill-opacity='.5'/%3E%3C/svg%3E") no-repeat center bottom / contain; }
    .opxp-dossiers { position: absolute; right: 2px; bottom: 0; width: 30px; height: 62%;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 34' preserveAspectRatio='xMidYMax meet'%3E%3Crect x='1' y='22' width='38' height='12' rx='2' fill='%23C9D8FF' fill-opacity='.26'/%3E%3Crect x='4' y='12' width='31' height='11' rx='2' fill='%237FE0C8' fill-opacity='.26'/%3E%3Crect x='8' y='2' width='24' height='11' rx='2' fill='%23C9D8FF' fill-opacity='.34'/%3E%3Cg fill='%230A1F4D' fill-opacity='.35'%3E%3Crect x='11' y='5' width='9' height='1.8' rx='.9'/%3E%3Crect x='7' y='15' width='9' height='1.8' rx='.9'/%3E%3Crect x='4' y='25' width='9' height='1.8' rx='.9'/%3E%3C/g%3E%3C/svg%3E") no-repeat center bottom / contain; }
    @media (prefers-reduced-motion: reduce) { .opxp-etoiles { animation: none; } }
    .opx-hero .rxa-scene { line-height: 0; }
    /* L'ancienne pose fixe ne s'affiche jamais : Rex n'apparaît qu'animé (22.09.2026). */
    :is(.dbx-hero, .opx-hero) img.dbx-hero-mascotte:not(.rxa-flamme) { visibility: hidden; }
    /* Le décor : derrière Rex, calé sur ses pieds, étendu vers la gauche pour son trajet de marche. */
    .rxa-scene { position: relative; display: inline-block; line-height: 0; }
    /* Le sol jusqu'au bas du bandeau (rxaSol) : hauteur mesurée dans --rxa-sol. */
    :is(.dbx-hero, .opx-hero) > .rxa-sol { position: absolute !important; left: 0; right: 0; bottom: 0; height: var(--rxa-sol, 40px); z-index: 0 !important;
      pointer-events: none; border-radius: 0 0 inherit inherit; border-bottom-left-radius: inherit; border-bottom-right-radius: inherit;
      background:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='40' viewBox='0 0 140 40'%3E%3Cg fill='%236FD3B0' fill-opacity='.22'%3E%3Cpath d='M12 6 l2 -6 l1 6 l2 -4 l0 4 z'/%3E%3Cpath d='M78 7 l1.5 -5 l1 5 l2 -3.5 l0 3.5 z'/%3E%3Cpath d='M118 5 l1.5 -4 l1 4 z'/%3E%3C/g%3E%3Cg fill='%23ffffff' fill-opacity='.10'%3E%3Cellipse cx='44' cy='14' rx='3' ry='1.4'/%3E%3Cellipse cx='101' cy='22' rx='2.2' ry='1'/%3E%3Cellipse cx='23' cy='27' rx='1.6' ry='.8'/%3E%3C/g%3E%3C/svg%3E") repeat-x 0 0 / 140px 40px,
        linear-gradient(to bottom, rgba(111, 211, 176, .20) 0, rgba(111, 211, 176, .20) 1px, rgba(111, 211, 176, .09) 2px, rgba(10, 31, 77, .30) 100%);
      /* 23.09.2026 : Rex traverse maintenant tout le bandeau — le sol le suit jusqu'au bord, il ne
         s'efface plus qu'au tout début pour adoucir le raccord avec le coin arrondi. */
      -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 10%, #000 100%); mask-image: linear-gradient(to right, transparent 0%, #000 10%, #000 100%); }
    /* Rex passe DEVANT la barre de recherche… */
    .dbx-hero > .dbx-hero-droite { z-index: 3; }
    /* … mais elle repasse devant dès qu'on écrit dedans, résultats compris. */
    .dbx-hero .dbx-recherche:focus-within { z-index: 6; }
    /* L'horizon sur toute la largeur : motifs répétés, donc identiques du téléphone au grand écran.
       Tout est calé sur la ligne de sol mesurée (--rxa-sol), comme le volcan. */
    :is(.dbx-hero, .opx-hero) > .rxa-horizon { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; border-radius: inherit; }
    .rxa-horizon .rxa-collines { position: absolute; left: 0; right: 0; bottom: var(--rxa-sol, 40px); height: 108px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='62' viewBox='0 0 300 62'%3E%3Cpath d='M0 62 L0 42 Q30 26 62 36 Q94 46 124 32 Q156 18 190 34 Q224 50 256 38 Q280 29 300 36 L300 62 Z' fill='%230A1F4D' fill-opacity='.26'/%3E%3Cpath d='M0 42 Q30 26 62 36 Q94 46 124 32 Q156 18 190 34 Q224 50 256 38 Q280 29 300 36' fill='none' stroke='%237FE0C8' stroke-opacity='.13' stroke-width='1.2'/%3E%3C/svg%3E") repeat-x left bottom / 300px 62px,
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='460' height='90' viewBox='0 0 460 90'%3E%3Cpath d='M0 90 L0 62 Q40 44 78 56 Q116 68 150 48 Q188 26 228 44 Q268 62 306 50 Q344 38 382 56 Q420 74 460 58 L460 90 Z' fill='%23C9D8FF' fill-opacity='.09'/%3E%3C/svg%3E") repeat-x left bottom / 460px 90px; }
    .rxa-horizon .rxa-etoiles { position: absolute; left: 0; right: 0; bottom: calc(var(--rxa-sol, 40px) + 60px); height: 48px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='48' viewBox='0 0 260 48'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='18' cy='12' r='1.2' opacity='.55'/%3E%3Ccircle cx='63' cy='28' r='.9' opacity='.32'/%3E%3Ccircle cx='96' cy='7' r='1.4' opacity='.6'/%3E%3Ccircle cx='131' cy='21' r='.8' opacity='.28'/%3E%3Ccircle cx='168' cy='11' r='1.1' opacity='.48'/%3E%3Ccircle cx='199' cy='31' r='1' opacity='.36'/%3E%3Ccircle cx='232' cy='15' r='1.3' opacity='.54'/%3E%3Ccircle cx='247' cy='35' r='.8' opacity='.26'/%3E%3C/g%3E%3C/svg%3E") repeat-x left bottom / 260px 48px;
      animation: rxaScintille 7s ease-in-out infinite; }
    /* La lune est dessinée APRÈS les collines : rien ne la couvre. Sa position vient entièrement de
       la mesure faite dans rxaSol (--rxa-lune-x / --rxa-lune-b) : le premier emplacement libre à la
       hauteur du « Ctrl K ». Plus aucun pourcentage ni décalage fixe — c'est ce qui la renvoyait
       derrière les boutons à chaque changement de largeur. */
    .rxa-horizon .rxa-lune { position: absolute; left: var(--rxa-lune-x, 62%); bottom: var(--rxa-lune-b, 150px);
      width: var(--rxa-lune-t, 84px); height: var(--rxa-lune-t, 84px);
      animation: rxaLuneLuit 9s ease-in-out infinite; }
    .rxa-lune-corps { filter: drop-shadow(0 0 5px rgba(190, 225, 255, .6)); }
    @keyframes rxaScintille { 0%, 100% { opacity: .72; } 50% { opacity: 1; } }
    @keyframes rxaLuneLuit { 0%, 100% { opacity: .82; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
    @media (prefers-reduced-motion: reduce) { .rxa-horizon .rxa-etoiles, .rxa-horizon .rxa-lune { animation: none; } }
    @media (max-width: 768px) {
      .rxa-horizon .rxa-collines { height: 58px; background-size: 190px 40px, 290px 58px; }
      .rxa-horizon .rxa-etoiles { bottom: calc(var(--rxa-sol, 40px) + 38px); height: 32px; background-size: 175px 32px; }
      /* Sur téléphone elle est simplement plus petite : l'emplacement reste mesuré, comme sur PC
         (avant, un « left: 6% » écrit en dur reprenait le dessus et la remettait sous le titre). */
      .rxa-horizon .rxa-lune { --rxa-lune-t: 54px; } }
    /* Sur téléphone la barre de recherche prend toute la largeur : la mesure ne sert pas. */
    /* 23.09.2026 : « il y a un trait net d'arrêt de paysage ». Le décor mesure 420 px et se coupait
       net sur son bord gauche — brume, montagne et sol s'arrêtaient d'un coup au milieu du bandeau.
       Son bord gauche se fond maintenant dans les collines répétées, qui prennent le relais. */
    .rxa-scene .rxa-decor { position: absolute; right: -30px; bottom: 0; height: 170px; width: auto; aspect-ratio: 420 / 170; z-index: 1; pointer-events: none; overflow: visible;
      -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 17%, #000 100%); mask-image: linear-gradient(to right, transparent 0%, #000 17%, #000 100%); }
    .rxa-scene img { position: relative; z-index: 2; }
    /* Rex marche et s'adosse jusqu'aux bords du bandeau : la partie transparente de son image ne
       doit pas élargir la page (défilement de côté sur iPhone). Le vertical reste libre (résultats
       de la recherche). */
    :is(.dbx-hero, .opx-hero) { overflow-x: clip; }
    .rxa-bouffee { transform-box: fill-box; transform-origin: 50% 50%; opacity: 0; animation: rxaBouffee 8s linear infinite; }
    @keyframes rxaBouffee {
      0% { transform: translate(0, 0) scale(.35); opacity: 0; }
      12% { opacity: .2; }
      50% { transform: translate(5px, -26px) scale(1.05); opacity: .15; }
      100% { transform: translate(-3px, -54px) scale(1.7); opacity: 0; } }
    .rxa-ptero { animation: rxaPtero 16s ease-in-out infinite; }
    .rxa-ailes { transform-box: fill-box; transform-origin: 50% 90%; animation: rxaAiles 1.6s ease-in-out infinite; }
    @keyframes rxaPtero { 0%, 100% { transform: translate(0, 0); } 30% { transform: translate(18px, -5px); } 60% { transform: translate(34px, 2px); } 80% { transform: translate(14px, 4px); } }
    @keyframes rxaAiles { 0%, 100% { transform: scaleY(1); } 45% { transform: scaleY(.35); } }
    /* Ptérodactyles de passage : traversent tout le décor de droite à gauche, puis reviennent. */
    .rxa-passe { animation: rxaPasse 25s linear infinite; }
    @keyframes rxaPasse { 0% { transform: translate(0, 0); } 25% { transform: translate(-130px, 6px); } 50% { transform: translate(-260px, -2px); } 75% { transform: translate(-390px, 5px); } 100% { transform: translate(-540px, 0); } }
    /* Les coulées turquoise du volcan luisent doucement. */
    .rxa-lave { animation: rxaLave 5s ease-in-out infinite; }
    @keyframes rxaLave { 0%, 100% { stroke-opacity: .12; } 50% { stroke-opacity: .38; } }
    /* Météorites : chacune traverse en biais (vers le bas-gauche), brille, puis s'éteint ; l'essentiel
       du cycle est une pause, pour une pluie clairsemée plutôt qu'un feu d'artifice. */
    .rxa-meteore { opacity: 0; animation: rxaMeteore 6s linear infinite; }
    .rxa-meteore circle { filter: drop-shadow(0 0 3px #FFB347) drop-shadow(0 0 6px #FF7A2E); }
    @keyframes rxaMeteore {
      0% { transform: translate(0, 0); opacity: 0; }
      3% { opacity: 1; }
      22% { transform: translate(-150px, 88px); opacity: .9; }
      28% { transform: translate(-186px, 109px); opacity: 0; }
      100% { transform: translate(-186px, 109px); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) { .rxa-meteores { display: none; } }
    @media (prefers-reduced-motion: reduce) { .rxa-ptero, .rxa-ailes, .rxa-passe, .rxa-lave { animation: none; } .rxa-passe { display: none; } .rxa-bouffee { animation: none; opacity: .12; } }
    @media (max-width: 768px) { .rxa-scene .rxa-decor { height: 96px; right: -16px; } }
    @media (max-width: 768px) {
      img.dbx-hero-mascotte.rxa-flamme { height: 96px !important; margin-left: calc(-180 / 234 * 96px); }
      img.dbx-hero-mascotte.rxa-flamme.rxa-petit { height: 68px !important; margin-left: calc(-180 / 234 * 68px); } }`;
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
