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
