// ═══ REX BANQUIER — LA VARIANTE « CONSEIL FINANCIER » DE LA MASCOTTE (20.09.2026) ══════════════
// Demande de Jonathan : un Rex banquier pour la partie conseil financier.
//
// On ne redessine pas le personnage : rex-mascotte-hd.png reste la seule source de vérité du
// dessin, et on l'habille d'une couche d'accessoires en SVG posée par-dessus, dans le même repère
// (488 × 624, la taille réelle du PNG). Avantages : la mascotte reste strictement identique d'une
// page à l'autre, les accessoires suivent l'image à n'importe quelle taille, et le jour où Jonathan
// fait redessiner un vrai Rex banquier, il suffit de remplacer l'image sans toucher au reste.
//
// Tenue : monocle cerclé d'or avec sa chaînette, et nœud papillon bleu marine. Deux signes qui se
// lisent immédiatement, et qui ne recouvrent ni les yeux ni la bouche du personnage.

const REXB_IMAGE = 'assets/logos/rex-mascotte-hd.png';
const REXB_BOITE = { w: 488, h: 624 };
// Repères relevés sur le PNG : l'œil visible et la naissance du poitrail.
const REXB_OEIL = { x: 232, y: 200, r: 62 };
const REXB_NOEUD = { x: 176, y: 396 };

function rexbEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// Couche d'accessoires seule (utile si on veut la poser sur une autre image de Rex).
function rexBanquierAccessoires() {
  const o = REXB_OEIL, n = REXB_NOEUD;
  // Point d'accroche de la chaînette sur le cercle du monocle, à 55° vers le bas-droite.
  const ax = o.x + o.r * Math.cos(Math.PI * 55 / 180);
  const ay = o.y + o.r * Math.sin(Math.PI * 55 / 180);
  return `<svg class="rexb-couche" viewBox="0 0 ${REXB_BOITE.w} ${REXB_BOITE.h}" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="rexb-or" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FCE9A8"/><stop offset="45%" stop-color="#E3B341"/><stop offset="100%" stop-color="#A9761B"/>
      </linearGradient>
      <linearGradient id="rexb-marine" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1E3A6E"/><stop offset="100%" stop-color="#0E1F44"/>
      </linearGradient>
    </defs>
    <!-- Chaînette du monocle : elle part du cercle et descend en s'incurvant vers le nœud papillon -->
    <path d="M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${(ax - 4).toFixed(1)} ${(ay + 80).toFixed(1)} ${(n.x + 46).toFixed(1)} ${(n.y - 8).toFixed(1)}"
          fill="none" stroke="url(#rexb-or)" stroke-width="5" stroke-linecap="round" opacity=".92"/>
    <!-- Monocle : verre à peine teinté pour qu'on voie toujours l'œil au travers -->
    <circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="#EAF4FF" opacity=".16"/>
    <circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="none" stroke="url(#rexb-or)" stroke-width="9"/>
    <circle cx="${o.x}" cy="${o.y}" r="${o.r - 7}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".35"/>
    <!-- Reflet -->
    <path d="M ${o.x - 38} ${o.y - 24} q 20 -22 46 -20" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".5"/>
    <!-- Nœud papillon -->
    <g transform="translate(${n.x} ${n.y})">
      <path d="M -6 0 L -58 -26 q -10 -5 -10 6 v 40 q 0 11 10 6 L -6 0 Z" fill="url(#rexb-marine)"/>
      <path d="M 6 0 L 58 -26 q 10 -5 10 6 v 40 q 0 11 -10 6 L 6 0 Z" fill="url(#rexb-marine)"/>
      <rect x="-9" y="-13" width="18" height="26" rx="6" fill="#16305C"/>
      <path d="M -52 -14 q 16 14 0 28" fill="none" stroke="#FFFFFF" stroke-width="2.5" opacity=".22"/>
      <path d="M 52 -14 q -16 14 0 28" fill="none" stroke="#FFFFFF" stroke-width="2.5" opacity=".22"/>
    </g>
  </svg>`;
}

// ── Postures : le sprite découpé et articulé ────────────────────────────────────────────────────
// Jonathan : « pourquoi tu ne peux pas extraire le visage et redessiner des postures inspirées ».
// Réponse honnête : je ne peux pas peindre de nouveaux pixels, mais je peux découper le dessin
// existant et l'articuler — c'est la technique du découpage articulé, celle des marionnettes 2D.
//
// Deux pièces ont été extraites du PNG d'origine par masque polygonal (assets/logos/rex/) :
//   tete.png   la tête seule, fond transparent
//   corps.png  le personnage entier, la zone de la tête comblée d'un aplat bleu — sinon on verrait
//              l'ancienne tête dépasser dès qu'on incline la nouvelle. Le comblement est borné à
//              la silhouette d'origine, pour ne pas créer de halo autour du personnage.
//
// La tête pivote autour de la nuque. Les angles restent faibles : au-delà d'une dizaine de degrés,
// le dessin trahit qu'il s'agit d'un montage, parce que la pose assise est vue de trois quarts.
// Une posture debout, elle, n'est pas atteignable depuis ce sprite — il faudrait redessiner les
// jambes, et là il faut un illustrateur.
const REXB_PARTS = { corps: 'assets/logos/rex/corps.png', tete: 'assets/logos/rex/tete.png' };
const REXB_NUQUE = { x: 180, y: 352 };

const REX_POSES = {
  assis:    { angle: 0,  dx: 0,  dy: 0,  titre: 'Rex' },
  curieux:  { angle: -7, dx: 4,  dy: 0,  titre: 'Rex, curieux' },
  attentif: { angle: 4,  dx: -6, dy: 8,  titre: 'Rex, attentif' },
  ravi:     { angle: -9, dx: 6,  dy: -3, titre: 'Rex, ravi' },
};

// Bloc complet à insérer dans une page. `taille` est la hauteur en pixels (l'image garde son ratio).
//   pose      : une clé de REX_POSES ; sans pose, on affiche le PNG d'origine intact
//   banquier  : ajoute le monocle et le nœud papillon
//   respire   : légère animation de repos (le personnage n'est jamais tout à fait figé)
function rexPoseHtml(opts) {
  const o = opts || {};
  const taille = Number(o.taille) || 120;
  const largeur = Math.round(taille * REXB_BOITE.w / REXB_BOITE.h);
  const p = REX_POSES[o.pose] || null;
  const titre = o.titre || (p ? p.titre : 'Rex') + (o.banquier ? ', votre conseiller financier' : '');
  const classes = ['rexb', o.classe || '', o.respire ? 'respire' : ''].filter(Boolean).join(' ');

  // Sans pose : une seule image, c'est le dessin d'origine, pixel pour pixel.
  const corps = p
    ? `<img class="rexb-corps" src="${REXB_PARTS.corps}" alt=""/>
       <img class="rexb-tete" src="${REXB_PARTS.tete}" alt=""
            style="transform:translate(${(p.dx / REXB_BOITE.w * 100).toFixed(2)}%, ${(p.dy / REXB_BOITE.h * 100).toFixed(2)}%) rotate(${p.angle}deg);
                   transform-origin:${(REXB_NUQUE.x / REXB_BOITE.w * 100).toFixed(2)}% ${(REXB_NUQUE.y / REXB_BOITE.h * 100).toFixed(2)}%"/>`
    : `<img src="${REXB_IMAGE}" alt=""/>`;

  return `<span class="${classes}" style="width:${largeur}px;height:${taille}px" role="img" aria-label="${rexbEsc(titre)}" title="${rexbEsc(titre)}">
    ${corps}
    ${o.banquier === false ? '' : rexBanquierAccessoires()}
  </span>`;
}

// Rex banquier : la tenue, et par défaut la posture attentive — celle qui convient à un conseil.
function rexBanquierHtml(opts) {
  const o = opts || {};
  return rexPoseHtml({ ...o, banquier: true, pose: o.pose === undefined ? 'attentif' : o.pose, respire: o.respire !== false });
}

// Bandeau d'accueil du conseil financier : Rex banquier + une phrase de contexte.
function rexBanquierBandeau(texte, boutonHtml) {
  return `<div class="rexb-bandeau">
    ${rexBanquierHtml({ taille: 104 })}
    <div class="rexb-bandeau-texte">${texte || ''}</div>
    ${boutonHtml || ''}
  </div>`;
}
