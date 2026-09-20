// ═══ LES ICÔNES DE L'ESPACE CLIENT (20.09.2026) ════════════════════════════════════════════════
// « L'espace client fait trop IA. Fais le rendu comme si c'était une agence web, je n'aime pas les
// pictogrammes et le visuel trop simple. »
//
// Les émojis sont le symptôme le plus net. Ils ont trois défauts qu'aucun réglage ne corrige :
//   — ils ne sont pas dessinés par nous : chaque système d'exploitation les rend à sa façon, et
//     l'espace client d'Assurex n'a pas la même allure sur un iPhone, un Android et un PC ;
//   — ils sont en couleur, toujours, et ces couleurs n'appartiennent à aucune charte — un 🏠
//     orange vif à côté du marine de la marque, personne ne l'a choisi ;
//   — ils portent une épaisseur, un style et un niveau de détail qui varient d'un caractère à
//     l'autre, là où une famille d'icônes tient par sa régularité.
//
// Ce qui les remplace : un jeu dessiné au trait, même grille de 24, même épaisseur de 1,5, mêmes
// terminaisons arrondies, et la couleur du texte courant. Ils suivent donc le thème, l'ambiance
// et l'accent sans un réglage de plus.

const ICO_BASE = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

const ICONES = {
  // ── Les familles d'assurance (particulier) ────────────────────────────────────────────────────
  vehicule: '<path d="M5 17h14M4.5 17V11l1.8-4.2A2 2 0 0 1 8.1 5.5h7.8a2 2 0 0 1 1.8 1.3L19.5 11v6"/><path d="M4.5 11h15"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  habitation: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  sante: '<path d="M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.7 12 20 12 20Z"/><path d="M12 11v4M10 13h4"/>',
  // Une pousse stylisée avait été essayée : à 20 px elle ressemblait à un oiseau. Des pièces
  // empilées et une flèche qui monte se lisent tout de suite — l'épargne qui croît.
  prevoyance: '<ellipse cx="12" cy="17" rx="5.5" ry="2"/><path d="M6.5 17v-3M17.5 17v-3"/><ellipse cx="12" cy="14" rx="5.5" ry="2"/><path d="M6.5 14v-3M17.5 14v-3"/><ellipse cx="12" cy="11" rx="5.5" ry="2"/><path d="M12 8V4M9.7 6.2 12 3.9l2.3 2.3"/>',
  juridique: '<path d="M12 4v16M7 20h10"/><path d="M4 9h16"/><path d="M6.5 9 4 14.5h5L6.5 9Z"/><path d="M17.5 9 15 14.5h5L17.5 9Z"/>',
  caution: '<circle cx="8.5" cy="12" r="3.5"/><path d="M12 12h8M17 12v3M20 12v2.5"/>',
  autre: '<path d="M5 7.5A1.5 1.5 0 0 1 6.5 6h3.2l1.6 2h6.2A1.5 1.5 0 0 1 19 9.5v7A1.5 1.5 0 0 1 17.5 18h-11A1.5 1.5 0 0 1 5 16.5Z"/>',

  // ── Les familles d'entreprise ─────────────────────────────────────────────────────────────────
  personnel: '<circle cx="9" cy="8.5" r="2.8"/><path d="M4 18.5c0-2.6 2.2-4.5 5-4.5s5 1.9 5 4.5"/><circle cx="17" cy="9.5" r="2.2"/><path d="M15.2 14.4c2.3.2 3.8 2 3.8 4.1"/>',
  flotte: '<path d="M3 16.5h11.5V8H6.2a1.5 1.5 0 0 0-1.4 1L3 13.5Z"/><path d="M14.5 10.5H18l3 3v3h-6.5Z"/><circle cx="7" cy="16.5" r="1.7"/><circle cx="17.5" cy="16.5" r="1.7"/>',
  responsabilite: '<path d="M12 3.5 5 6.2v5.5c0 4 2.9 7.6 7 8.8 4.1-1.2 7-4.8 7-8.8V6.2Z"/><path d="M9.5 12.2l1.8 1.8 3.4-3.6"/>',
  biens: '<path d="M4 20V9.5l5-3 5 3V20"/><path d="M14 20v-7h6v7"/><path d="M3 20h18"/><path d="M7 12h0M7 15.5h0M11 12h0M11 15.5h0M17 16h0"/>',
  cyber: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2.2 2.2 3.3 5 3.3 8s-1.1 5.8-3.3 8c-2.2-2.2-3.3-5-3.3-8s1.1-5.8 3.3-8Z"/>',

  // ── Les actions ───────────────────────────────────────────────────────────────────────────────
  telecharger: '<path d="M12 4v10"/><path d="M8.5 10.5 12 14l3.5-3.5"/><path d="M5 16.5v1.5A1.5 1.5 0 0 0 6.5 19.5h11A1.5 1.5 0 0 0 19 18v-1.5"/>',
  message: '<path d="M4.5 6.5A1.5 1.5 0 0 1 6 5h12a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 16H9.5L5.5 19.5V16H6a1.5 1.5 0 0 1-1.5-1.5Z"/>',
  sinistre: '<path d="M12 4.5 2.8 19.5h18.4Z"/><path d="M12 10v4M12 17h0"/>',
  document: '<path d="M6.5 4.5h7L18 9v10.5H6.5Z"/><path d="M13.5 4.5V9H18"/><path d="M9.5 13h5M9.5 16h3"/>',
  agenda: '<rect x="4" y="6" width="16" height="14" rx="1.5"/><path d="M4 10h16M9 4v4M15 4v4"/><path d="M8.5 14h2M13.5 14h2M8.5 17h2"/>',
  telephone: '<path d="M6.2 4.5h3l1.3 3.6-1.9 1.4a11 11 0 0 0 5 5l1.4-1.9 3.6 1.3v3a1.5 1.5 0 0 1-1.6 1.5C10.3 18 6 13.7 4.7 6.1A1.5 1.5 0 0 1 6.2 4.5Z"/>',
  courriel: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 7 8 5.5L20 7"/>',
  fleche: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5"/>',
  cadenas: '<rect x="5" y="10.5" width="14" height="9" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  horloge: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  boussole: '<circle cx="12" cy="12" r="8"/><path d="m15 9-1.6 4.4L9 15l1.6-4.4Z"/>',
  etincelle: '<path d="M12 4.5 13.6 9l4.4 1.6-4.4 1.6L12 16.5l-1.6-4.3L6 10.6 10.4 9Z"/><path d="M18 16.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z"/>',
  bouclier: '<path d="M12 3.5 5 6.2v5.5c0 4 2.9 7.6 7 8.8 4.1-1.2 7-4.8 7-8.8V6.2Z"/>',
  loupe: '<circle cx="11" cy="11" r="6"/><path d="m15.5 15.5 4 4"/>',
};

// Une icône, dans une taille donnée. `aria-hidden` par défaut : à côté d'un libellé, elle décore ;
// un lecteur d'écran qui l'annoncerait dirait deux fois la même chose.
function ico(nom, taille = 20, classe = '') {
  const d = ICONES[nom];
  if (!d) return '';
  return `<svg class="ico ${classe}" ${ICO_BASE} width="${taille}" height="${taille}" aria-hidden="true">${d}</svg>`;
}

// La correspondance entre les familles de contrats et les icônes. Elle vit ici, à côté des
// dessins, pour qu'ajouter une famille soit un seul geste.
const ICO_FAMILLES = {
  vehicule: 'vehicule', habitation: 'habitation', sante: 'sante', prevoyance: 'prevoyance',
  juridique: 'juridique', entreprise: 'personnel', caution: 'caution', autre: 'autre',
  personnel: 'personnel', vehicules: 'flotte', responsabilite: 'responsabilite',
  biens: 'biens', cyber: 'cyber',
};

function icoFamille(id, taille = 20) { return ico(ICO_FAMILLES[id] || 'autre', taille); }
