// ═══ PICTOGRAMMES DU MENU, ET LE PIED DU MENU (21.09.2026) ═════════════════════════════════════
// « Les boutons, ça fait cheap quand même : pour les menus, trouve des pictogrammes plus
// professionnels. » — « Paramètres et déconnexion : bouton scindé, inutile de prendre deux
// boutons pour ça. » — « Corrige OZ Assure. »
//
// 1. PICTOGRAMMES. Les émojis du menu sont remplacés par un jeu dessiné au trait : même grille
//    (24), même épaisseur (1,8), extrémités arrondies, couleur du texte. Un émoji change d'allure
//    d'un système à l'autre et arrive avec ses propres couleurs ; un jeu au trait tient la page.
//    Les tracés sont écrits ici, sans bibliothèque externe. Un écran sans pictogramme propre garde
//    celui de sa rubrique.
// 2. LE PIED DU MENU. La pastille « Jonathan » et le bouton « Déconnexion » deviennent un seul
//    bouton scindé : à gauche, vous et les paramètres (Apparence) ; à droite, la sortie.
// 3. OZ ASSURE. Le logo était rendu à 16 px de haut : les lettres se fondaient (« OZO·SLTE »).
//    Il passe à une hauteur lisible, et reste blanc sur le bandeau.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Les émojis reviennent.

const PMN = {
  // rubriques
  vente: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1M21 3l-9 9M17 3h4v4',
  marketing: 'M4 10v4h3l8 4V6l-8 4zM18.5 9a3 3 0 0 1 0 6M7 14l1 5h2.5l-1-5',
  compta: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 6.5h8v3H8zM8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M8.5 17h.01M12 17h.01M15.5 17h.01',
  admin: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  rh: 'M9 8a3.5 3.5 0 1 0 0-.01M3 20c0-3.5 2.6-5.5 6-5.5s6 2 6 5.5M17 11a2.8 2.8 0 1 0 0-.01M16.5 14.6c2.8.2 4.5 2 4.5 4.9',
  organisation: 'M4 5h16v16H4zM4 10h16M8.5 3v4M15.5 3v4',
  // écrans seuls
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  'vue-ensemble': 'M12 3a9 9 0 1 0 .01 0zM15.5 8.5l-2 5-5 2 2-5z',
  opportunites: 'M4 5h16l-6 7.5V18l-4 2v-7.5z',
  // Vente
  'clients-prives': 'M12 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6',
  'clients-entreprises': 'M5 21V5l7-2v18M12 8h7v13M8 8h1M8 12h1M8 16h1M15 12h1M15 16h1M3 21h18',
  portefeuille: 'M9 8m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M3 20c0-3.5 2.6-5.5 6-5.5s6 2 6 5.5M17 9.5m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0M16.5 14.7c2.8.2 4.5 2 4.5 4.8',
  'clients-oz': 'M10 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M3 20c0-3.9 3-6 7-6 1.6 0 3 .3 4.2.9M15 19l2 2 4-4.5',
  'marquage-entites': 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  'tous-contrats': 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7M9 8h3',
  'recherche-vehicules': 'M3 17v-3l2.2-5.2A2 2 0 0 1 7 7.5h10a2 2 0 0 1 1.8 1.3L21 14v3zM3 14h18M6.5 17v2M17.5 17v2M7 11.5h.01M17 11.5h.01',
  'volume-primes': 'M4 20V11M10 20V5M16 20v-7M3 20h18',
  suivi: 'M8 3h8v3H8zM6 4.5H5v16.5h14V4.5h-1M8.5 11h7M8.5 15h5',
  'opp-converties': 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.5a2.5 2.5 0 0 0 2.5 3.5M16 6h2.5A2.5 2.5 0 0 1 16 9.5M12 13v4M8 21h8M9.5 17h5v4',
  'nouvelle-demande-offre': 'M4 5h16v14H4zM4 6l8 6 8-6',
  'nouveau-contrat-direct': 'M6 3h9l4 4v14H6zM15 3v4h4M12 11v6M9 14h6',
  resiliations: 'M6 3h9l4 4v14H6zM15 3v4h4M10 12l4 4M14 12l-4 4',
  renouvellements: 'M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4',
  'relances-lamal': 'M20.5 8.8c0 4.9-8.5 11.2-8.5 11.2S3.5 13.7 3.5 8.8A4.3 4.3 0 0 1 12 6.6a4.3 4.3 0 0 1 8.5 2.2zM6.5 12.5h3l1.5-2.5 2 5 1.5-2.5h3',
  equipement: 'M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5',
  conseil: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16M11 13v2h2v-2',
  'analyse-prevoyance': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4.5',
  'calc-immo': 'M4 11l8-7 8 7M6 10v10h12V10M10 20v-5h4v5',
  // Marketing
  campagnes: 'M4 10v4h3l8 4V6l-8 4zM18.5 9a3 3 0 0 1 0 6M7 14l1 5h2.5l-1-5',
  'kanban-campagnes': 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  'campagnes-performance': 'M3 17l6-6 4 4 8-8M15 7h6v6',
  'demandes-devis': 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5',
  sources: 'M18 5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M6 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M18 19m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5',
  brevo: 'M3 6h18v12H3zM3 7l9 6 9-6',
  // Compta
  'commissions-attente': 'M3 7h18v10H3zM12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M6 10v4M18 10v4',
  'import-decompte': 'M12 3v11M8 10l4 4 4-4M4 15v5h16v-5',
  'controle-coherence': 'M12 4v16M7 20h10M5 8h14M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z',
  rapprochement: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  'ocr-decomptes': 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10',
  'ecohub-sync': 'M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5',
  'suivi-financier': 'M4 17a8 8 0 1 1 16 0M12 17l4-5.5M3 17h2.5M18.5 17H21',
  tresorerie: 'M3 3v18h18M7 14l3-3 3 3 5-6',
  'entrees-argent': 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3zM3 7l2.5-3h11L19 7M15.5 13.5h3',
  production: 'M3 20V10l5 3v-3l5 3V6h8v14zM3 20h18',
  factures: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3.5',
  caution: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4M12 15v2',
  // Admin
  'messages-clients': 'M4 5h16v11H9l-5 4z',
  'demandes-polices': 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
  courriers: 'M3 9l9-6 9 6v11H3zM3 9l9 6 9-6',
  'documents-compagnies': 'M3 6h6l2 2h10v11H3z',
  'dossier-financement': 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  'rapport-finma': 'M6 3h9l4 4v14H6zM15 3v4h4M12 14m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  'audit-log': 'M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 3.5v5h5M12 8v4.5l3 2',
  'journal-erreurs': 'M12 3l10 18H2zM12 10v5M12 18h.01',
  'contacts-compagnies': 'M6 3h13v18H6zM3 7h3M3 12h3M3 17h3M12.5 10m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M9 17c0-2 1.5-3 3.5-3s3.5 1 3.5 3',
  apparence: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h12M20 18h0M15 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M18 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  // RH
  agents: 'M12 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 20c0-3.5 2.6-6 6-6s6 2.5 6 6M5 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M19 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  'fiche-paie': 'M4 6h16v12H4zM8 10h3M8 14h6M15.5 10h1',
  // Agenda
  rappels: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 12l3 3 5-6',
  agenda: 'M4 5h16v16H4zM4 10h16M8.5 3v4M15.5 3v4',
  'rendez-vous': 'M4 5h13v6M4 5v15h8M4 10h13M8 3v4M13 3v4M17.5 17.5m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M17.5 15.5v2l1.5 1',
  calendly: 'M4 5h16v16H4zM4 10h16M8.5 3v4M15.5 3v4M9 15l2 2 4-4',
  // pied du menu
  _reglages: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  _sortie: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16.5 5.5 12 10 7.5M5.5 12H15',
};

function pmnSvg(cle, taille) {
  const d = PMN[cle];
  if (!d) return '';
  const t = taille || 17;
  return `<svg class="pmn" viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// La rubrique d'un écran, pour les écrans sans pictogramme propre.
function pmnRubriqueDe(id) {
  const sec = (typeof SECTIONS !== 'undefined' ? SECTIONS : []).find(s => (s.sub || []).some(x => x.id === id));
  return sec ? sec.id : null;
}
function pmnPour(id) { return PMN[id] ? id : (PMN[pmnRubriqueDe(id)] ? pmnRubriqueDe(id) : null); }

function pmnHabiller(racine) {
  if (!racine) return;
  racine.querySelectorAll('[onclick*="navigate(\'"]').forEach(b => {
    const m = (b.getAttribute('onclick') || '').match(/navigate\('([^']+)'\)/);
    if (!m) return;
    const cle = pmnPour(m[1]);
    const ico = b.querySelector('.nav-ico, .rbq-bouton > span, .nav-palette-ico');
    if (cle && ico && !ico.querySelector('svg.pmn')) ico.innerHTML = pmnSvg(cle);
  });
  racine.querySelectorAll('.nav-section-btn[data-sec] .nav-sec-ico').forEach(s => {
    const sec = s.closest('.nav-section-btn').dataset.sec;
    if (PMN[sec] && !s.querySelector('svg.pmn')) s.innerHTML = pmnSvg(sec);
  });
}

// ── Le pied du menu : un bouton scindé ─────────────────────────────────────────────────────────
function pmnPied() {
  const pied = document.querySelector('.sidebar .sidebar-team');
  if (!pied || typeof currentUser === 'undefined' || !currentUser) return;
  let bloc = pied.querySelector('.pmn-pied');
  const initiales = ((currentUser.prenom || '?')[0] + (currentUser.nom || '')[0] || '').toUpperCase();
  const html = `<div class="pmn-pied" role="group" aria-label="Compte">
    <button type="button" class="pmn-moi" onclick="navigate('apparence')" title="Paramètres et apparence">
      <span class="pmn-avatar" aria-hidden="true">${initiales}</span>
      <span class="pmn-nom"><b>${(currentUser.prenom || '').replace(/</g, '&lt;')}</b><small>Paramètres</small></span>
      ${pmnSvg('_reglages', 16)}
    </button>
    <button type="button" class="pmn-sortie" onclick="logout()" title="Se déconnecter" aria-label="Se déconnecter">${pmnSvg('_sortie', 17)}</button>
  </div>`;
  if (!bloc) { pied.insertAdjacentHTML('afterbegin', html); } else { bloc.outerHTML = html; }
}

(function pmnBrancher() {
  if (typeof renderSidebar === 'function') {
    const origine = renderSidebar;
    window.renderSidebar = function () {
      const r = origine.apply(this, arguments);
      pmnHabiller(document.getElementById('nav'));
      pmnPied();
      return r;
    };
  }
  // La palette de recherche et la vue d'ensemble prennent les mêmes pictogrammes.
  if (typeof navPeindre === 'function') {
    const origine = navPeindre;
    window.navPeindre = function () {
      const r = origine.apply(this, arguments);
      const liste = document.getElementById('nav-liste');
      if (liste && window._nav) liste.querySelectorAll('.nav-palette-ligne').forEach(l => {
        const x = window._nav.resultats[Number(l.dataset.i)];
        const cle = x && !/^(client|contrat|opp):/.test(x.id) ? pmnPour(x.id) : null;
        const ico = l.querySelector('.nav-palette-ico');
        if (cle && ico) ico.innerHTML = pmnSvg(cle, 18);
      });
      return r;
    };
  }
  if (typeof viewVueEnsemble === 'function') {
    const origine = viewVueEnsemble;
    window.viewVueEnsemble = function () {
      const div = document.createElement('div');
      div.innerHTML = origine.apply(this, arguments);
      pmnHabiller(div);
      div.querySelectorAll('.rbq-rubrique').forEach(s => {
        const sec = s.id.replace('rbq-', ''), h = s.querySelector('h2');
        if (h && PMN[sec]) h.innerHTML = `<span class="pmn-titre">${pmnSvg(sec, 20)}</span>${h.textContent.replace(/^[^\p{L}]+/u, '')}`;
      });
      div.querySelectorAll('.rbq-sauts button').forEach(b => {
        const m = (b.getAttribute('onclick') || '').match(/rbqAller\('([^']+)'\)/);
        if (m && PMN[m[1]]) b.innerHTML = pmnSvg(m[1], 15) + b.textContent.replace(/^[^\p{L}]+/u, '');
      });
      const h1 = div.querySelector('h1');
      if (h1) h1.innerHTML = `<span class="pmn-titre">${pmnSvg('vue-ensemble', 24)}</span>Vue d’ensemble`;
      return div.innerHTML;
    };
  }

  const st = document.createElement('style');
  st.textContent = `
    /* Les pastilles d'icônes gardent leur place ; le trait prend la couleur du texte. */
    .sidebar .nav-ico svg.pmn, .sidebar .nav-sec-ico svg.pmn { display: block; }
    .sidebar .nav-ico, .sidebar .nav-sec-ico { color: #CFE0FF; }
    .sidebar .nav-item.active .nav-ico, .sidebar .nav-solo-btn.active .nav-ico { color: #7FE3FF; }
    .sidebar .nav-section-btn.active .nav-sec-ico { color: #7FE3FF; }
    .rbq-bouton > span svg.pmn, .nav-palette-ico svg.pmn { display: block; margin: auto; }
    .rbq-bouton > span { color: var(--accent); }
    .pmn-titre { display: inline-flex; vertical-align: -3px; margin-right: 8px; color: var(--accent); }
    .rbq-sauts button { display: inline-flex; align-items: center; gap: 6px; }

    /* Le pied : un bouton scindé. */
    .sidebar-team #team-list, .sidebar-team .team-title, .sidebar-team .btn-logout { display: none !important; }
    .pmn-pied { display: flex; align-items: stretch; border-radius: 12px; overflow: hidden;
      border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); }
    .pmn-pied button { border: 0; background: none; color: #E2ECFF; cursor: pointer; font: inherit; }
    .pmn-moi { flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; padding: 7px 10px; text-align: left; }
    .pmn-moi:hover { background: rgba(255,255,255,.08); }
    .pmn-avatar { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
      background: rgba(0,207,255,.18); color: #7FE3FF; font-size: 11px; font-weight: 600; box-shadow: inset 0 0 0 1.5px rgba(0,207,255,.45); }
    .pmn-nom { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.15; }
    .pmn-nom b { font-size: 12.5px; font-weight: 600; }
    .pmn-nom small { font-size: 10.5px; color: #9FB4DA; }
    .pmn-moi svg.pmn { flex-shrink: 0; opacity: .7; }
    .pmn-sortie { width: 42px; display: inline-flex; align-items: center; justify-content: center;
      border-left: 1px solid rgba(255,255,255,.14) !important; color: #FFB4B4 !important; }
    .pmn-sortie:hover { background: rgba(220, 38, 38, .25); color: #fff !important; }
    .pmn-pied button:focus-visible { outline: 2px solid #00CFFF; outline-offset: -2px; }

    /* OZ Assure : lisible. */
    .sidebar .nav-solo-logo { padding: 8px 12px; justify-content: flex-start; }
    .sidebar .nav-solo-logo .oz-logo-svg { height: 22px !important; width: auto !important; max-width: 150px; display: block; }`;
  document.head.appendChild(st);
})();
