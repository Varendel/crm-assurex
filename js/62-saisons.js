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
    decors: ['🎃', '👻', '🦇', '🕸️'],
  },
  {
    cle: 'noel',
    nom: 'Noël',
    // Du 1er novembre au 6 janvier (Jonathan : « Noël dès le 01.11 »)
    debut: { mois: 11, jour: 1 }, fin: { mois: 1, jour: 6 },
    dossierRex: 'assets/logos/rex/poses-noel/',
    decors: ['🎄', '⭐', '🎁', '❄️'],
  },
];

const SAISON_CLE_COUPE = 'rex-saison-coupee';

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
  if (typeof ecRendre === 'function' && document.body.classList.contains('mode-espace-client')) ecRendre();
  else if (typeof dbxRerendre === 'function' && currentView === 'dashboard') dbxRerendre(true);
}

function saisonCourante() {
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
function saisonSourceRex(nom) {
  const s = saisonCourante();
  const p = (typeof REX_POSES !== 'undefined' && REX_POSES[nom]) ? REX_POSES[nom] : null;
  if (!p) return null;
  return s ? { src: s.dossierRex + p.f, repli: REX_DOSSIER + p.f } : { src: REX_DOSSIER + p.f, repli: null };
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
  return `<div class="saison-decor" aria-hidden="true">${pieces}</div>`;
}

// Petit interrupteur, à poser dans un en-tête. Discret : c'est un habillage, pas une fonction.
function saisonBoutonHtml() {
  const s = saisonActive();
  if (!s) return '';
  const coupe = saisonCoupee();
  return `<button type="button" class="saison-bouton${coupe ? ' coupe' : ''}" onclick="saisonBasculer(${coupe ? 'false' : 'true'})"
    title="${coupe ? `Réafficher l’habillage ${s.nom}` : `Masquer l’habillage ${s.nom}`}">${s.decors[0]} ${coupe ? 'Activer' : 'Masquer'}</button>`;
}

// Au chargement, puis une fois par heure : une session ouverte en continu doit basculer le jour
// venu sans qu'on ait à recharger la page.
(function saisonDemarrer() {
  const poser = () => { if (document.body) saisonAppliquer(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
  setInterval(poser, 60 * 60 * 1000);
})();
