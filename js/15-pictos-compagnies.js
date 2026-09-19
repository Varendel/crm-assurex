// ═══ PICTOGRAMMES DES COMPAGNIES (ajouté le 19.09.2026) ═══════════════════════════════════════
// Petit badge carré devant le nom de la compagnie sur les contrats, pour repérer l'assureur d'un
// coup d'œil. Un logo fourni (symbole seul, en blanc) quand on l'a, sinon un monogramme court.
// Pour ajouter un logo, deux possibilités :
//   - `img` : chemin d'une image carrée (~128 px) dans assets/logos/compagnies, `forme` 'carre' | 'rond' ;
//   - `svg` : le SYMBOLE seul (sans le nom), avec son viewBox, en fill="currentColor" ; `fond` = couleur du badge.
//
// Couleurs : fond bleu Assurex par défaut. À remplacer par la couleur officielle de chaque
// compagnie au fur et à mesure que les logos sont fournis (clé = nom renvoyé par normaliserCompagnie).

const PICTO_FOND_DEFAUT = '#113679';

const PICTOS_COMPAGNIES = {
  // Symbole Helvetia (logo officiel « helvetia-logo-rgb-white.svg », fourni par Jonathan le 19.09.2026)
  // Sans fond (demande de Jonathan) : le symbole prend la couleur du texte du thème (clair ou sombre)
  'Helvetia': { viewBox: '0 0 184 208', sansFond: true,
    svg: '<path transform="translate(-0.5,2)" d="M2.52,97.92c-3.36,3.36-3.36,8.8,0,12.15l91.41,91.41c3.36,3.36,8.8,3.36,12.15,0l50.72-50.72-30.87-30.87-25.93,25.93-41.81-41.81,41.81-41.81,72.69,72.69,24.8-24.8c3.36-3.36,3.36-8.8,0-12.15L106.08,6.52c-3.36-3.36-8.8-3.36-12.15,0L2.52,97.92Z" fill="currentColor"/>' },
  // Logos image (fichiers fournis par Jonathan le 19.09.2026, réduits à 128 px dans assets/logos/compagnies)
  'AXA': { img: 'assets/logos/compagnies/axa.png', forme: 'carre' },
  'La Vaudoise': { img: 'assets/logos/compagnies/vaudoise.png', forme: 'rond' },
  'Allianz': { abr: 'AZ' },
  'Generali': { abr: 'GE' },
  'Swiss Life': { abr: 'SL' },
  'HOTELA': { img: 'assets/logos/compagnies/hotela.png', forme: 'carre', bordure: true },
  'Groupe Mutuel': { img: 'assets/logos/compagnies/groupe-mutuel.png', forme: 'carre', bordure: true },
  'Zurich': { img: 'assets/logos/compagnies/zurich.png', forme: 'rond' },
  // Monogrammes aux couleurs relevées sur les logos officiels fournis le 19.09.2026
  'La Mobilière': { abr: 'M', fond: '#DA2323' },
  'Helsana': { abr: 'He', fond: '#9A0941' },
  'SWICA': { abr: 'SW', fond: '#01BAA8' },
  'CSS': { abr: 'CSS' },
  'Sanitas': { abr: 'SA' },
  'Visana': { abr: 'VI' },
  'Gastrosocial': { abr: 'GS' },
  'SUVA': { abr: 'SU' },
  'PAX': { abr: 'PAX' },
  'Orion': { abr: 'OR' },
  'CAP': { abr: 'CAP' },
  'goCaution': { abr: 'GC' },
  'Animalia': { abr: 'AN' },
};

function _pictoEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Monogramme de secours : initiales du nom (sans article ni forme juridique), 1 à 3 lettres
function _pictoAbreviation(nom) {
  const mots = (nom || '').replace(/^(la|le|les)\s+/i, '').replace(/\b(sa|ag|compagnie|assurances?|d'|de|du)\b/gi, ' ').split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return mots.slice(0, 3).map(m => m[0]).join('').toUpperCase();
}

// Badge seul. taille en px (22 par défaut)
function pictoCompagnie(nomCompagnie, taille) {
  if (!nomCompagnie) return '';
  const t = taille || 22;
  const nom = typeof normaliserCompagnie === 'function' ? normaliserCompagnie(nomCompagnie) : nomCompagnie;
  const def = PICTOS_COMPAGNIES[nom] || {};
  const fond = def.fond || PICTO_FOND_DEFAUT;
  if (def.img) {
    const rayon = def.forme === 'rond' ? '50%' : `${Math.round(t * 0.27)}px`;
    return `<img src="${def.img}" alt="${_pictoEsc(nom)}" title="${_pictoEsc(nom)}" width="${t}" height="${t}" style="flex-shrink:0;width:${t}px;height:${t}px;border-radius:${rayon};object-fit:cover;vertical-align:middle;${def.bordure ? 'border:1px solid rgba(23,52,84,0.25);box-sizing:border-box;' : ''}">`;
  }
  const base = `display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:${t}px;height:${t}px;border-radius:${Math.round(t * 0.27)}px;background:${fond};color:${def.texte || '#fff'};vertical-align:middle`;
  if (def.svg && def.sansFond) {
    return `<span title="${_pictoEsc(nom)}" aria-label="${_pictoEsc(nom)}" role="img" style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:${t}px;height:${t}px;color:var(--text);vertical-align:middle"><svg width="${Math.round(t * 0.86)}" height="${Math.round(t * 0.86)}" viewBox="${def.viewBox}" aria-hidden="true">${def.svg}</svg></span>`;
  }
  if (def.svg) {
    const s = Math.round(t * 0.62);
    return `<span title="${_pictoEsc(nom)}" aria-label="${_pictoEsc(nom)}" role="img" style="${base}"><svg width="${s}" height="${s}" viewBox="${def.viewBox}" aria-hidden="true">${def.svg}</svg></span>`;
  }
  const abr = def.abr || _pictoAbreviation(nom);
  const fs = abr.length >= 3 ? Math.round(t * 0.34) : Math.round(t * 0.42);
  return `<span title="${_pictoEsc(nom)}" aria-label="${_pictoEsc(nom)}" role="img" style="${base};font-size:${fs}px;font-weight:800;letter-spacing:-0.02em;font-family:inherit">${_pictoEsc(abr)}</span>`;
}

// Badge + nom de la compagnie, alignés (à utiliser à la place du simple nom)
function compagnieAvecPicto(nomCompagnie, taille) {
  if (!nomCompagnie) return '';
  return `<span style="display:inline-flex;align-items:center;gap:6px;vertical-align:middle">${pictoCompagnie(nomCompagnie, taille)}<span>${_pictoEsc(nomCompagnie)}</span></span>`;
}

// Logo EX Group (en-tête du tableau de bord, à côté de « Bonjour ») — tiré du logo du menu ;
// lettres en currentColor pour suivre le thème, carré cyan de la marque (19.09.2026).
const LOGO_EXGROUPE_SVG = '<svg viewBox="670 488 580 100" xmlns="http://www.w3.org/2000/svg" class="exgroupe-entete" aria-label="EX Group" role="img"> <rect x="829.47" y="551.34" width="18.15" height="18.15" fill="#00CFFF"/> <rect x="686.18" y="538.2" width="48.56" height="10.09" fill="currentColor"/> <rect x="686.18" y="558.47" width="53.17" height="10.09" fill="currentColor"/> <rect x="686.18" y="518.73" width="53.17" height="10.01" fill="currentColor"/> <polygon points="829.47 496.06 827.87 506.11 827.61 507.83 825.24 522.76 818.89 517.34 801.9 535.92 787.85 535.92 794.91 543.55 817.93 568.41 803 568.41 787.47 551.6 758.21 583.94 743.55 583.94 780.04 543.54 757.11 518.73 771.94 518.73 787.72 535.76 810.6 510.28 804.33 504.93 829.47 496.06" fill="currentColor"/> <path d="M1152.37,518.74v32.87c0,9.37-7.59,16.96-16.96,16.96h-22.52c-9.37,0-16.96-7.59-16.96-16.96v-32.87h11.3v32.58c0,3.29,2.67,5.96,5.96,5.96h21.93c3.29,0,5.96-2.67,5.96-5.96v-32.58h11.3Z" fill="currentColor"/> <path d="M996.21,537.33v-6.44c0-7.31-5.4-12.16-13.19-12.16h-43.31v10.01h41.01c2.54,0,4.45,1.59,4.45,4.13v3.1c0,2.54-1.59,4.21-4.45,4.21h-41.01v28.37h11.2v-18.36h21.86l11.6,18.36h12.64l-11.36-18.52c6.68-.95,10.57-5.8,10.57-12.72" fill="currentColor"/> <path d="M1062.96,519.69c-1.76-.63-3.66-.97-5.66-.97h-22.53c-1.99,0-3.9.34-5.66.97-6.58,2.33-11.3,8.6-11.3,15.98v15.91c0,7.38,4.72,13.67,11.3,16,1.76.63,3.66.97,5.66.97h22.53c1.99,0,3.9-.34,5.66-.97,6.58-2.33,11.3-8.61,11.3-16v-15.91c0-7.38-4.72-13.65-11.3-15.98ZM1062.96,551.29c0,3.3-2.67,5.96-5.96,5.96h-21.92c-3.3,0-5.96-2.67-5.96-5.96v-15.32c0-3.28,2.67-5.95,5.96-5.95h21.92c3.3,0,5.96,2.67,5.96,5.95v15.32Z" fill="currentColor"/> <path d="M880.28,530.04h39.18v-11.3h-39.48c-1.99,0-3.9.34-5.66.97-6.58,2.33-11.3,8.6-11.3,15.98v15.91c0,7.38,4.72,13.67,11.3,16,1.76.63,3.66.97,5.66.97h22.53c1.99,0,3.9-.34,5.66-.97,6.58-2.33,11.3-8.61,11.3-16v-13.11h-22.57v11.3h11.27v1.52c0,3.3-2.67,5.96-5.96,5.96h-21.92c-3.3,0-5.96-2.67-5.96-5.96v-15.32c0-3.28,2.67-5.95,5.96-5.95Z" fill="currentColor"/> <path d="M1220.63,518.74h-43.32v49.83h11.21v-18.36h21.86l11.39-.14c1.22-.02,2.44-.13,3.61-.48,5.37-1.6,8.45-6.11,8.45-12.26v-6.43c0-7.31-5.41-12.16-13.19-12.16ZM1222.77,535.99c0,2.55-1.58,4.22-4.45,4.22h-29.8v-11.44h30.12c2.28,0,4.13,1.85,4.13,4.13v3.09Z" fill="currentColor"/> </svg>';
