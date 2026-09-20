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

// Bloc complet à insérer dans une page. `taille` est la hauteur en pixels (l'image garde son ratio).
function rexBanquierHtml(opts) {
  const o = opts || {};
  const taille = Number(o.taille) || 120;
  const largeur = Math.round(taille * REXB_BOITE.w / REXB_BOITE.h);
  const titre = o.titre || 'Rex, votre conseiller financier';
  return `<span class="rexb ${o.classe || ''}" style="width:${largeur}px;height:${taille}px" role="img" aria-label="${rexbEsc(titre)}" title="${rexbEsc(titre)}">
    <img src="${REXB_IMAGE}" alt=""/>
    ${rexBanquierAccessoires()}
  </span>`;
}

// Bandeau d'accueil du conseil financier : Rex banquier + une phrase de contexte.
function rexBanquierBandeau(texte, boutonHtml) {
  return `<div class="rexb-bandeau">
    ${rexBanquierHtml({ taille: 104 })}
    <div class="rexb-bandeau-texte">${texte || ''}</div>
    ${boutonHtml || ''}
  </div>`;
}
