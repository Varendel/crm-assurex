// ═══ LES COMMISSIONS, UNE SEULE ENTRÉE (20.09.2026) ════════════════════════════════════════════
// Trois entrées de menu traitaient du même sujet et se recouvraient largement :
//   « Toutes les commissions »   — la liste, par client et par contrat
//   « Bordereaux »               — les décomptes reçus des compagnies
//   « Commissions (vue interne) »— la vue de travail
// Choisir entre les trois demandait de savoir ce que chacune contient, ce qui ne s'apprend qu'en
// les ouvrant toutes. Elles deviennent trois onglets d'un même écran, dans l'ordre voulu par
// Jonathan : la liste, les bordereaux, la vue interne.
//
// Deux précautions :
//
// 1. LES ANCIENS LIENS CONTINUENT DE MARCHER. Une centaine de boutons du CRM appellent
//    navigate('bordereaux') ou navigate('commissions'). On ne les retouche pas : ces identifiants
//    ouvrent désormais l'écran unique, positionné sur le bon onglet. Rien ne casse, et l'adresse
//    reste un lien profond utilisable.
//
// 2. ON NE RÉÉCRIT AUCUNE DES TROIS VUES. Chaque onglet appelle la fonction existante. Le jour où
//    l'une d'elles évolue, l'onglet suit sans qu'on y pense — et si ce regroupement ne convient
//    pas, il se défait en supprimant ce fichier.

const CMX_ONGLETS = [
  { id: 'liste',     vue: 'commissions-attente', libelle: 'Toutes les commissions', icone: '💸',
    aide: 'Chaque commission, par client et par contrat', fn: 'viewCommissionsAttente' },
  { id: 'bordereaux', vue: 'bordereaux',         libelle: 'Bordereaux',             icone: '🧾',
    aide: 'Les décomptes reçus des compagnies',          fn: 'viewBordereaux' },
  { id: 'interne',   vue: 'commissions',         libelle: 'Vue interne',            icone: '🧮',
    aide: 'La vue de travail, réservée',                 fn: 'viewCommissions', staff: true },
];

window._cmx = window._cmx || { onglet: 'liste' };

function cmxOngletDepuisVue(vue) {
  const o = CMX_ONGLETS.find(x => x.vue === vue);
  return o ? o.id : 'liste';
}

function cmxAller(id) {
  window._cmx.onglet = id;
  const o = CMX_ONGLETS.find(x => x.id === id);
  // On passe par navigate() pour que l'historique, le fil d'Ariane et les récents suivent.
  if (o && typeof navigate === 'function') navigate(o.vue);
}

// L'en-tête d'onglets, posé au-dessus de la vue appelée.
function cmxHtml(vueCourante) {
  const actif = cmxOngletDepuisVue(vueCourante);
  const rh = typeof estRoleRH === 'function' ? estRoleRH() : false;
  const visibles = CMX_ONGLETS.filter(o => !(o.staff && rh));
  return `<div class="cmx-onglets" role="tablist" aria-label="Commissions">
    ${visibles.map(o => `<button type="button" role="tab" aria-selected="${o.id === actif}"
      class="cmx-onglet ${o.id === actif ? 'actif' : ''}" onclick="cmxAller('${o.id}')" title="${o.aide}">
      <span aria-hidden="true">${o.icone}</span><b>${o.libelle}</b><small>${o.aide}</small>
    </button>`).join('')}
  </div>`;
}

// On enveloppe le rendu : après que la vue d'origine a été peinte, on lui pose l'en-tête d'onglets
// devant. Aucune des trois vues n'est modifiée.
(function cmxPoserOnglets() {
  const origine = window.navigate;
  if (typeof origine !== 'function') return;
  window.navigate = function (vue) {
    const r = origine.apply(this, arguments);
    const poser = () => {
      if (!CMX_ONGLETS.some(o => o.vue === vue)) return;
      const main = document.getElementById('main-content');
      if (!main || main.querySelector('.cmx-onglets')) return;
      window._cmx.onglet = cmxOngletDepuisVue(vue);
      main.insertAdjacentHTML('afterbegin', cmxHtml(vue));
    };
    // Deux vues sur trois rechargent les données avant de peindre : on repasse après.
    if (r && typeof r.then === 'function') r.then(poser); else poser();
    setTimeout(poser, 350);
    return r;
  };
})();
