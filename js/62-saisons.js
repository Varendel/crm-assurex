// ═══ HABILLAGES SAISONNIERS (20.09.2026) ═══════════════════════════════════════════════════════
// Demande de Jonathan : Halloween dès le 1er octobre, Noël dès le 1er novembre, sur l'espace
// client et sur Rex. Les planches de Rex saisonnier arriveront plus tard — le mécanisme est écrit
// pour les accueillir sans rien changer d'autre.
//
// Trois principes :
//   1. Les dates sont ici, en clair, et nulle part ailleurs. Changer une période se fait sur une
//      ligne, pas en cherchant des conditions dans dix fichiers.
//   2. Repli automatique sur la pose normale. Tant qu'une planche saisonnière n'existe pas, le
//      fichier manquant déclenche « onerror » et Rex reprend sa pose habituelle : jamais d'image
//      cassée à l'écran, et on peut déposer les planches au fil de l'eau, pose par pose.
//   3. Un interrupteur. Un habillage de fête pendant qu'un client déclare un sinistre peut tomber
//      très mal : chacun peut le couper, côté conseiller comme côté client, et le choix est retenu.

const SAISONS = [
  {
    cle: 'halloween',
    nom: 'Halloween',
    // Du 1er au 31 octobre
    debut: { mois: 10, jour: 1 }, fin: { mois: 10, jour: 31 },
    dossierRex: 'assets/logos/rex/poses-halloween/',
    // La planche Halloween ne contient pas la pose « debout » : sur l'écran de connexion, Rex
    // retombait donc sur sa tenue ordinaire, et l'habillage passait inaperçu là où il compte le
    // plus. Chaque saison désigne la pose qu'elle a réellement dessinée pour la connexion.
    poseConnexion: 'joie',
    decors: ['🎃', '👻', '🦇', '🕸️'],
  },
  {
    cle: 'noel',
    nom: 'Noël',
    // Du 1er novembre au 6 janvier (Jonathan : « Noël dès le 01.11 »)
    debut: { mois: 11, jour: 1 }, fin: { mois: 1, jour: 6 },
    dossierRex: 'assets/logos/rex/poses-noel/',
    poseConnexion: 'debout',
    decors: ['🎄', '⭐', '🎁', '❄️'],
  },
];

const SAISON_CLE_COUPE = 'rex-saison-coupee';
// Saison imposée à la main, pour voir un habillage hors de sa période : on ne valide pas un
// décor de Noël le 20 septembre en imaginant à quoi il ressemblera.
const SAISON_CLE_FORCEE = 'rex-saison-forcee';

// Une période peut enjamber le 31 décembre : on compare alors en deux morceaux.
function saisonActive(date) {
  const d = date || new Date();
  const m = d.getMonth() + 1, j = d.getDate();
  const apres = (a) => m > a.mois || (m === a.mois && j >= a.jour);
  const avant = (a) => m < a.mois || (m === a.mois && j <= a.jour);
  for (const s of SAISONS) {
    const enjambe = s.fin.mois < s.debut.mois;
    if (enjambe ? (apres(s.debut) || avant(s.fin)) : (apres(s.debut) && avant(s.fin))) return s;
  }
  return null;
}

function saisonCoupee() {
  try { return localStorage.getItem(SAISON_CLE_COUPE) === '1'; } catch (e) { return false; }
}
function saisonBasculer(couper) {
  try { localStorage.setItem(SAISON_CLE_COUPE, couper ? '1' : '0'); } catch (e) {}
  saisonAppliquer();
  if (typeof saisonPoserDecorConnexion === 'function') saisonPoserDecorConnexion();
  if (typeof ecRendre === 'function' && document.body.classList.contains('mode-espace-client')) ecRendre();
  else if (typeof dbxRerendre === 'function' && currentView === 'dashboard') dbxRerendre(true);
}

function saisonForcee() {
  try { return localStorage.getItem(SAISON_CLE_FORCEE) || ''; } catch (e) { return ''; }
}
function saisonImposer(cle) {
  try { localStorage.setItem(SAISON_CLE_FORCEE, cle || ''); } catch (e) {}
  saisonAppliquer();
  if (typeof saisonPoserCompagnonConnexion === 'function') saisonPoserCompagnonConnexion();
  if (typeof saisonPoserDecorConnexion === 'function') saisonPoserDecorConnexion();
  if (typeof navigate === 'function' && currentView === 'apparence') navigate('apparence');
}

function saisonCourante() {
  const f = saisonForcee();
  if (f === 'aucune') return null;
  if (f) return SAISONS.find(s => s.cle === f) || null;
  return saisonCoupee() ? null : saisonActive();
}

// Pose le nom de la saison sur <body> : tout l'habillage tient ensuite dans la feuille de style.
function saisonAppliquer() {
  const s = saisonCourante();
  for (const x of SAISONS) document.body.classList.toggle('saison-' + x.cle, !!s && s.cle === x.cle);
  document.body.classList.toggle('saison', !!s);
}

// ── Rex saisonnier ──────────────────────────────────────────────────────────────────────────────
// On tente la planche de la saison ; si le fichier n'existe pas encore, le navigateur bascule
// tout seul sur la pose normale. C'est ce repli qui permet de livrer les planches au fur et à
// mesure sans jamais casser l'affichage.
// Inventaire des poses de saison réellement livrées (22.09.2026) : le repli par onerror marche,
// mais chaque fichier absent coûtait une requête en erreur et une ligne au journal des erreurs
// (poses-halloween/debout.png, poses-noel/joie.png…). Un dossier listé ici n'est tenté que pour
// les fichiers listés ; un dossier absent de la liste garde l'ancien comportement (on tente).
// À COMPLÉTER quand une nouvelle planche est déposée.
const SAISON_POSES_LIVREES = {
  'assets/logos/rex/poses-halloween/': ['enthousiaste.png', 'joie.png', 'planification.png', 'reflexion.png', 'rodolphe.png'],
  'assets/logos/rex/poses-noel/': ['concentre.png', 'debout.png', 'montre.png', 'pouce.png', 'rodolphe.png'],
  'assets/logos/rex/saison-paques/': [],
  'assets/logos/rex/saison-ete/': [],        // dessins thématiques seulement (js/116), pas de poses
  'assets/logos/rex/saison-printemps/': [],
};
function saisonPoseLivree(dossier, f) {
  const liste = SAISON_POSES_LIVREES[dossier];
  return !liste || liste.includes(f);
}

function saisonSourceRex(nom) {
  const s = saisonCourante();
  const p = (typeof REX_POSES !== 'undefined' && REX_POSES[nom]) ? REX_POSES[nom] : null;
  if (!p) return null;
  return s && saisonPoseLivree(s.dossierRex, p.f) ? { src: s.dossierRex + p.f, repli: REX_DOSSIER + p.f } : { src: REX_DOSSIER + p.f, repli: null };
}

// ── Décor de l'espace client ────────────────────────────────────────────────────────────────────
// Quelques éléments qui flottent en fond, jamais devant le contenu, et rien du tout pour qui a
// demandé moins d'animations.
function saisonDecorHtml() {
  const s = saisonCourante();
  if (!s) return '';
  const n = 9;
  const pieces = Array.from({ length: n }, (_, i) => {
    const d = s.decors[i % s.decors.length];
    const g = (i * 100 / n + (i % 3) * 4).toFixed(1);
    return `<span style="--g:${g}%;--r:${(i * 1.7 % 9).toFixed(1)}s;--v:${(11 + (i % 5) * 2.4).toFixed(1)}s">${d}</span>`;
  }).join('');
  return `<div class="saison-decor" aria-hidden="true">${pieces}</div>${s.cle === 'noel' ? saisonNeigeHtml() : ''}`;
}

// ── Neige (20.09.2026) ──────────────────────────────────────────────────────────────────────────
// Des flocons dessinés, pas des emojis : à cette taille un emoji devient une tache illisible, et
// surtout il s'affiche différemment sur chaque système. Trois tailles, trois vitesses, un léger
// balancement latéral — sans quoi la neige tombe comme de la pluie et le regard le remarque.
const NEIGE_FLOCONS = 48;

function saisonNeigeHtml() {
  const f = Array.from({ length: NEIGE_FLOCONS }, (_, i) => {
    const taille = [2, 3, 4, 5, 6][i % 5];
    const depart = ((i * 97) % 100).toFixed(1);
    const duree = (9 + (i % 7) * 2.1).toFixed(1);
    const retard = ((i * 1.31) % 12).toFixed(1);
    const derive = (14 + (i % 4) * 11);
    const opacite = (0.35 + (i % 4) * 0.16).toFixed(2);
    return `<i style="--t:${taille}px;--x:${depart}%;--d:${duree}s;--r:-${retard}s;--dx:${derive}px;--o:${opacite}"></i>`;
  }).join('');
  return `<div class="neige" aria-hidden="true">${f}</div>`;
}

// Petit interrupteur, à poser dans un en-tête. Discret : c'est un habillage, pas une fonction.
function saisonBoutonHtml() {
  const s = saisonActive();
  if (!s) return '';
  const coupe = saisonCoupee();
  return `<button type="button" class="saison-bouton${coupe ? ' coupe' : ''}" onclick="saisonBasculer(${coupe ? 'false' : 'true'})"
    title="${coupe ? `Réafficher l’habillage ${s.nom}` : `Masquer l’habillage ${s.nom}`}">${s.decors[0]} ${coupe ? 'Activer' : 'Masquer'}</button>`;
}

// Le compagnon de l'écran de connexion est posé par code : la page de connexion est du HTML
// statique, et un personnage qui n'existe que deux mois par an n'a pas à y figurer en dur.
// Il se tient à côté de la piste de Rex et ne saute pas avec lui — il regarde.
function saisonPoserCompagnonConnexion() {
  const piste = document.querySelector('.login-rex-piste');
  if (!piste) return;
  const s = saisonCourante();

  // Rex prend la tenue de la saison. Le fichier est remplacé plutôt que dupliqué dans le HTML :
  // la page de connexion est statique, et on ne veut pas y figer une pose qui change deux fois
  // par an. Repli sur la pose normale si la planche n'existe pas.
  const rex = piste.querySelector('.login-mascotte');
  if (rex) {
    const normal = 'assets/logos/rex/poses/debout.png';
    const fichier = (s && typeof REX_POSES !== 'undefined' && REX_POSES[s.poseConnexion])
      ? REX_POSES[s.poseConnexion].f : 'debout.png';
    const voulu = s && saisonPoseLivree(s.dossierRex, fichier) ? s.dossierRex + fichier : normal;
    if (!rex.getAttribute('src') || rex.getAttribute('src').split('?')[0] !== voulu) {
      rex.onerror = function () { this.onerror = null; this.src = normal; };
      rex.src = voulu;
    }
  }

  // Le compagnon : posé à côté de Rex, dans sa piste, donc il saute avec lui.
  piste.querySelector('.login-compagnon')?.remove();
  if (typeof rexCompagnonHtml !== 'function') return;
  const html = rexCompagnonHtml('rodolphe', { taille: 84, respire: false });
  if (!html) return;
  const zone = document.createElement('span');
  zone.innerHTML = html;
  const img = zone.firstElementChild;
  if (!img) return;
  img.classList.add('login-compagnon');
  img.style.height = '';
  piste.appendChild(img);
}

// ── Le décor de la page de connexion (20.09.2026) ───────────────────────────────────────────────
// Jusqu'ici, seuls Rex et son compagnon changeaient de tenue à la connexion : le décor (citrouilles
// qui flottent, neige) n'apparaissait qu'une fois entré dans le CRM. C'est l'inverse de ce qu'il
// faut — la page de connexion est la seule que voit un client avant d'ouvrir son espace, et c'est
// donc là que l'habillage compte le plus. Le décor est maintenant posé sur l'écran de connexion
// aux mêmes dates, et retiré dès que la saison est coupée ou terminée.
function saisonPoserDecorConnexion() {
  const ecran = document.getElementById('login-screen');
  if (!ecran) return;
  ecran.querySelector(':scope > .saison-decor')?.remove();
  ecran.querySelector(':scope > .neige')?.remove();
  const html = saisonDecorHtml();
  if (!html) return;
  const zone = document.createElement('div');
  zone.innerHTML = html;
  // saisonDecorHtml peut renvoyer deux blocs (le décor et la neige) : on les déplace tels quels.
  while (zone.firstElementChild) ecran.appendChild(zone.firstElementChild);
}

// Au chargement, puis une fois par heure : une session ouverte en continu doit basculer le jour
// venu sans qu'on ait à recharger la page.
(function saisonDemarrer() {
  const poser = () => { if (document.body) { saisonAppliquer(); saisonPoserCompagnonConnexion(); saisonPoserDecorConnexion(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
  setInterval(poser, 60 * 60 * 1000);
})();
