// ═══ LA COMPAGNIE EN COURT, DANS LES TABLEAUX (20.09.2026) ═════════════════════════════════════
// « Maintenant qu'il y a les logos dans les tableaux, réutilisez-les et créez des acronymes pour
// garder de la place. HOTELA HA. »
//
// Dans un tableau, le nom écrit en toutes lettres coûte cher : « Retraites Populaires » prend
// 160 px, « Groupe Mutuel » 110, et cette largeur est prise à la colonne d'à côté — celle du
// client, du produit ou du montant, qui en avaient plus besoin. Le nom y est pourtant la donnée
// la moins lue : on balaie une colonne de compagnies pour REPÉRER, pas pour lire.
//
// Le logo fait ce repérage mieux que le mot, et plus vite. L'acronyme n'est là que pour lever un
// doute — deux logos ronds bleus côte à côte se confondent au vingtième coup d'œil. Ensemble ils
// tiennent dans 60 px là où le nom en demandait 160.
//
// LE NOM COMPLET N'EST JAMAIS PERDU : il reste dans le `title` de la cellule, donc au survol, à
// la copie et pour un lecteur d'écran. Un acronyme qu'on ne peut pas résoudre est une devinette,
// et un tableau n'est pas un jeu.
//
// LA MÉTHODE. On ne réécrit pas les vingt écrans qui produisent des tableaux : on repère la
// COLONNE compagnie par son en-tête, et on ne touche qu'à celle-là. C'est ce qui évite le piège
// d'un remplacement par le texte — une colonne « Localité » contenant « Zurich » recevrait sinon
// le logo de l'assureur. Le repérage par en-tête ne peut pas se tromper de colonne.
//
// POUR REVENIR EN ARRIÈRE : retirer les deux lignes de index.html (ce fichier + 99-compagnies-court.css).
// Aucune vue n'est modifiée, les tableaux retrouvent leur nom en toutes lettres.

// Les abréviations d'usage. Celles qui ne sont pas ici sont dérivées du nom (voir ccoAbr).
// HELVETIA / HELSANA se ressemblent trop pour partager « HEL » : la dernière lettre les sépare,
// et les logos (losange marine contre pastille bordeaux) font le reste.
const CCO_ABR = {
  'AXA': 'AXA', 'Allianz': 'ALZ', 'Generali': 'GEN', 'Zurich': 'ZUR',
  'Helvetia': 'HLV', 'Helsana': 'HLS', 'Swiss Life': 'SL',
  'La Mobilière': 'MOB', 'La Vaudoise': 'VAU', 'Groupe Mutuel': 'GM',
  'CSS': 'CSS', 'SWICA': 'SWI', 'Sanitas': 'SAN', 'Visana': 'VIS',
  'HOTELA': 'HA', 'Gastrosocial': 'GAS',
  'goCaution': 'GOC', 'SwissCaution': 'SWC', 'FirstCaution': 'FCA', 'SmartCaution': 'SMC',
  'SUVA': 'SUVA', 'PAX': 'PAX', 'CAP': 'CAP', 'Orion': 'ORI',
  'Retraites Populaires': 'RP', 'Animalia': 'ANI',
  'Bâloise': 'BAL', 'Baloise': 'BAL', 'Sympany': 'SYM', 'Concordia': 'CON',
  'Assura': 'ASR', 'TCS': 'TCS', 'Smile': 'SMI', 'Nest': 'NEST',
  'Protekta': 'PRO', 'Emmental': 'EMM', 'EGK': 'EGK', 'Atupri': 'ATU', 'KPT': 'KPT',
};

// Même résolution que le logo (js/15) : « Allianz Suisse Crissier » donne ALZ et le losange
// Allianz, et non l'acronyme « ASC » que personne ne reconnaîtrait.
function ccoNom(nom) {
  if (typeof pictoResoudre === 'function') return pictoResoudre(nom);
  return typeof normaliserCompagnie === 'function' ? normaliserCompagnie(nom) : String(nom || '').trim();
}

// L'abréviation d'une compagnie. Un nom déjà court (AXA, CSS, PAX) reste tel quel : l'abréger ne
// gagnerait rien et le rendrait moins lisible.
function ccoAbr(nom) {
  const n = ccoNom(nom);
  if (!n) return '';
  if (CCO_ABR[n]) return CCO_ABR[n];
  if (n.length <= 5) return n.toUpperCase();
  const mots = n.replace(/^(la|le|les)\s+/i, '').split(/[\s-]+/).filter(Boolean);
  if (mots.length === 1) return mots[0].slice(0, 3).toUpperCase();
  return mots.slice(0, 3).map(m => m[0]).join('').toUpperCase();
}

function ccoEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Logo + acronyme, prêt à poser dans une cellule.
function compagnieCompacte(nom, taille) {
  const n = ccoNom(nom);
  if (!n) return '';
  const picto = typeof pictoCompagnie === 'function' ? pictoCompagnie(n, taille || 20) : '';
  return `<span class="cco" title="${ccoEsc(n)}">${picto}<b>${ccoEsc(ccoAbr(n))}</b></span>`;
}

// ── Le repérage de la colonne ───────────────────────────────────────────────────────────────────
// « Compagnie », « Assureur », « Caisse » : les trois mots utilisés dans les écrans existants.
const CCO_ENTETE = /\b(compagnie|assureur|caisse\s+maladie)\b/i;

// Ce qui n'est pas un nom de compagnie et doit rester tel quel.
const CCO_VIDE = /^(—|-|–|\?|n\/a|aucune?|sans)$/i;

function ccoTableau(table) {
  const ligneEntete = (table.tHead && table.tHead.rows[0]) || table.rows[0];
  if (!ligneEntete) return;
  let idx = -1;
  for (let i = 0; i < ligneEntete.cells.length; i++) {
    if (CCO_ENTETE.test(ligneEntete.cells[i].textContent || '')) { idx = i; break; }
  }
  if (idx < 0) return;

  const corps = table.tBodies.length ? [...table.tBodies].flatMap(b => [...b.rows]) : [...table.rows].slice(1);
  for (const tr of corps) {
    const cel = tr.cells[idx];
    if (!cel || cel.dataset.cco) continue;
    // Une cellule qui contient déjà un élément a son propre rendu (un logo, un lien, un badge) :
    // le remplacer ferait perdre ce que l'écran avait voulu y mettre.
    if (cel.firstElementChild) { cel.dataset.cco = 'garde'; continue; }
    const texte = (cel.textContent || '').trim();
    if (!texte || CCO_VIDE.test(texte)) { cel.dataset.cco = 'vide'; continue; }
    cel.dataset.cco = '1';
    cel.title = texte;              // le nom complet reste accessible au survol
    cel.innerHTML = compagnieCompacte(texte, 20);
  }
}

let ccoEnCours = false;
function ccoAppliquer(racine) {
  if (ccoEnCours) return;
  ccoEnCours = true;
  try {
    const zone = racine || document.getElementById('main-content') || document.body;
    zone.querySelectorAll('table').forEach(t => { try { ccoTableau(t); } catch (e) {} });
  } finally {
    // Relâché après le tour de boucle : les mutations que l'on vient de faire remontent à
    // l'observateur, et sans ce délai il se rappellerait lui-même.
    setTimeout(() => { ccoEnCours = false; }, 0);
  }
}

// ── Le déclenchement ────────────────────────────────────────────────────────────────────────────
// Un observateur plutôt qu'un branchement sur chaque vue : les tableaux sont produits par une
// vingtaine d'écrans, dont certains se redessinent tout seuls (filtres, tri, pagination). Les
// envelopper un par un laisserait passer ceux qu'on aurait oubliés.
(function ccoBrancher() {
  const demarrer = () => {
    const zone = document.getElementById('main-content');
    if (!zone) { setTimeout(demarrer, 300); return; }
    let minuteur = null;
    new MutationObserver(() => {
      if (ccoEnCours) return;
      clearTimeout(minuteur);
      minuteur = setTimeout(() => ccoAppliquer(), 40);
    }).observe(zone, { childList: true, subtree: true });
    ccoAppliquer();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
