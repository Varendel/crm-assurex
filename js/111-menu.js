// ═══ LE MENU, REPRIS EN ENTIER (21.09.2026) ════════════════════════════════════════════════════
// « Je ne suis toujours pas convaincu par les menus. Revois présentation, accessibilité,
// défilement, rangement, mise en place — que ce soit pratique. Évite d'en supprimer. Il faut
// qu'il reste de manière permanente une loupe dans la partie supérieure de l'écran. »
//
// Ce qui n'allait pas, constaté à l'écran et non supposé :
//   · TOUT le menu défilait d'un bloc : logo, recherche, épinglés partaient avec les rubriques.
//     Au bas de « Vente », plus rien pour chercher ni pour se situer.
//   · La recherche vivait DANS le menu. Dès qu'on défile, elle disparaît ; sur mobile, elle
//     demande d'ouvrir le tiroir d'abord.
//   · Les rubriques (VENTE, COMPTA…) étaient écrites plus petit que leurs propres sous-groupes :
//     la hiérarchie se lisait à l'envers.
//   · Rien ne disait où l'on est. Le seul repère était une ligne surlignée, parfois hors de vue.
//   · Au clavier, il fallait tabuler bouton par bouton à travers soixante entrées.
//
// Ce qui change, sans qu'aucun écran ne disparaisse :
//   1. UNE BARRE EN HAUT DE L'ÉCRAN, toujours là : le chemin de l'écran ouvert (Compta › Pilotage ›
//      Entrées d'argent, chaque étape cliquable), le retour, et LA LOUPE. Elle ouvre la palette de
//      js/74, désormais capable de trouver aussi un contrat par son numéro de police et une
//      opportunité. Taper une lettre sur la loupe l'ouvre déjà remplie ; « / » l'ouvre de partout.
//   2. LE MENU DÉFILE SEUL, sous un logo qui reste. Il garde sa position d'un écran à l'autre, et
//      ramène à la vue l'entrée ouverte quand elle sort du cadre.
//   3. LES RUBRIQUES SE LISENT COMME DES RUBRIQUES : icône, nom en clair, nombre d'écrans. Celle de
//      l'écran ouvert s'ouvre d'elle-même. « Tout ouvrir / tout fermer » en un clic.
//   4. LE CLAVIER : ↑ ↓ parcourent le menu, ← → ferment et ouvrent une rubrique, Début et Fin
//      vont aux extrémités. Chaque entrée annonce aux lecteurs d'écran qu'elle est la page ouverte.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de index.html (ce fichier + 99-menu.css). La
// structure d'origine est rétablie au rechargement.

window._mnu = window._mnu || { derniereVue: null, nav: 0 };

function mnuEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const MNU_LOUPE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/></svg>';
const MNU_RETOUR = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H6M11 6.5 5.5 12l5.5 5.5"/></svg>';

// ── Où est-on ? ────────────────────────────────────────────────────────────────────────────────
// La vue ouverte, retrouvée dans SECTIONS. Les fiches (client, rappel…) n'ont pas d'entrée de
// menu : on les nomme à part, avec la rubrique d'où l'on vient d'habitude.
function mnuOuSuisJe() {
  const vue = typeof currentView !== 'undefined' ? currentView : '';
  const vueMenu = vue === 'dossier-conseil' ? 'conseil' : vue;
  for (const sec of (typeof SECTIONS !== 'undefined' ? SECTIONS : [])) {
    if (sec.solo) {
      if ((sec.target || sec.id) === vueMenu) return { section: null, groupe: null, ecran: sec.label, icone: sec.icon };
      continue;
    }
    const s = (sec.sub || []).find(x => x.id === vueMenu);
    if (s) return { section: sec, groupe: s.groupe || null, ecran: s.label, icone: s.icon };
  }
  if (vue === 'fiche-client') {
    const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === (typeof currentClientId !== 'undefined' ? currentClientId : null));
    const nom = c ? ((typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : '';
    const vente = (typeof SECTIONS !== 'undefined' ? SECTIONS : []).find(x => x.id === 'vente');
    return { section: vente || null, groupe: 'Fiche client', ecran: nom || 'Fiche client', icone: '👤' };
  }
  const libres = {
    'nouvelle-opportunite': ['Pipeline', 'Opportunité'],
    'fiche-rappel': ['Agenda', 'Tâche'],
  };
  if (libres[vue]) return { section: null, groupe: libres[vue][0], ecran: libres[vue][1], icone: '•' };
  return { section: null, groupe: null, ecran: '', icone: '' };
}

function mnuOuvrirRubrique(secId) {
  if (typeof openSections === 'undefined') return;
  openSections[secId] = true;
  if (typeof renderSidebar === 'function') renderSidebar();
  const btn = document.querySelector(`#nav .nav-section-btn[data-sec="${secId}"]`);
  if (btn) { btn.scrollIntoView({ block: 'start', behavior: 'smooth' }); btn.focus({ preventScroll: true }); }
  if (window.innerWidth <= 768 && typeof toggleSidebarMobile === 'function') toggleSidebarMobile(true);
}

function mnuPeindreFil() {
  const fil = document.getElementById('rex-fil');
  if (!fil) return;
  const o = mnuOuSuisJe();
  const morceaux = [];
  if (o.section) morceaux.push(`<button type="button" class="rex-fil-etape" onclick="mnuOuvrirRubrique('${o.section.id}')">${mnuEsc(o.section.label)}</button>`);
  if (o.groupe) morceaux.push(`<span class="rex-fil-etape rex-fil-groupe">${mnuEsc(o.groupe)}</span>`);
  if (o.ecran) morceaux.push(`<span class="rex-fil-etape rex-fil-ici" aria-current="page">${mnuEsc(o.ecran)}</span>`);
  fil.innerHTML = morceaux.join('<span class="rex-fil-sep" aria-hidden="true">›</span>');
  // Les flèches « précédent » et « menu rattaché » : js/93 les nomme et les active.
  if (typeof navPoserFleche === 'function') navPoserFleche();
}

// ── La barre du haut ───────────────────────────────────────────────────────────────────────────
// Posée une fois : #main-content est replacé dans une colonne qui porte la barre au-dessus de
// lui. Les écrans continuent d'écrire dans #main-content, sans rien savoir de la barre.
function mnuPoserBarre() {
  if (document.getElementById('rex-barre')) return;
  const main = document.getElementById('main-content');
  if (!main || !main.parentElement) return;
  const col = document.createElement('div');
  col.className = 'rex-colonne';
  main.parentElement.insertBefore(col, main);
  col.innerHTML = `
    <header class="rex-barre" id="rex-barre">
      <div class="rex-barre-gauche">
        <div class="rex-nav-fleches" role="group" aria-label="Se déplacer">
          <button type="button" class="rex-nav-btn" id="rex-retour" onclick="goBack()" disabled>${MNU_RETOUR}<span class="rex-nav-txt">Précédent</span></button>
          <button type="button" class="rex-nav-btn rex-nav-monter" id="rex-monter" onclick="navMonter()" hidden></button>
        </div>
        <nav class="rex-fil" id="rex-fil" aria-label="Vous êtes ici"></nav>
      </div>
      <button type="button" class="rex-loupe" id="rex-loupe" onclick="navOuvrir()" aria-keyshortcuts="Control+K /"
        aria-label="Rechercher un écran, un client, un contrat">
        ${MNU_LOUPE}<span class="rex-loupe-txt">Rechercher un écran, un client, une police…</span><kbd>Ctrl K</kbd>
      </button>
      <span class="rex-barre-droite" aria-hidden="true"></span>
    </header>`;
  col.appendChild(main);

  // Taper directement sur la loupe (focus clavier) ouvre la palette avec la lettre déjà saisie.
  document.getElementById('rex-loupe').addEventListener('keydown', ev => {
    if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); navOuvrir(ev.key); }
  });

  // Sur téléphone, la barre de l'app porte déjà sa loupe (rexRechercheMobile) : rien à ajouter.
}

// « / » ouvre la recherche de partout — sauf quand on écrit dans un champ, bien sûr.
document.addEventListener('keydown', ev => {
  if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (typeof navOuvrir !== 'function' || (window._nav && window._nav.ouverte)) return;
  ev.preventDefault();
  navOuvrir();
});

// ── La loupe trouve aussi les contrats et les opportunités ─────────────────────────────────────
// On cherche un client par son nom, mais souvent on n'a sous les yeux qu'un numéro de police
// (sur un décompte, dans un mail de compagnie) ou un téléphone. rechercheGlobale (js/03) sait
// déjà les trouver : on la branche sur la palette.
(function mnuEtendreRecherche() {
  if (typeof navChercher !== 'function') return;
  const origine = navChercher;
  window.navChercher = function (q) {
    const base = origine.apply(this, arguments) || [];
    const txt = String(q || '').trim();
    if (txt.length < 2 || typeof rechercheGlobale !== 'function') return base;
    let r;
    try { r = rechercheGlobale(txt); } catch (e) { return base; }
    const nomC = c => c ? ((typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : '';
    const dejaClients = new Set(base.filter(x => String(x.id).startsWith('client:')).map(x => x.id));
    const plus = [];
    (r.clients || []).forEach(c => {
      const id = 'client:' + c.id;
      if (dejaClients.has(id) || dejaClients.size + plus.filter(p => p.section === 'Clients').length >= 6) return;
      plus.push({ id, label: nomC(c), icone: '👤', chemin: [c.ville, c.mobile || c.telephone, c.email].filter(Boolean).join(' · ') || 'Fiche client', section: 'Clients' });
    });
    (r.contrats || []).slice(0, 5).forEach(ct => {
      const cl = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === ct.client_id);
      plus.push({ id: 'contrat:' + ct.client_id, label: `${ct.produit || 'Contrat'} — ${ct.compagnie || ''}`.trim(),
        icone: '📄', chemin: [nomC(cl), ct.numero_police ? 'police ' + ct.numero_police : ''].filter(Boolean).join(' · '), section: 'Contrats' });
    });
    (r.opportunites || []).slice(0, 4).forEach(o => {
      plus.push({ id: 'opp:' + o.id, label: o.titre || 'Opportunité', icone: '🎯', chemin: o.stade || 'Opportunité', section: 'Opportunités' });
    });
    // Les clients trouvés en plus se rangent avec ceux de la palette, pas après les contrats.
    const clientsPlus = plus.filter(p => p.section === 'Clients');
    const reste = plus.filter(p => p.section !== 'Clients');
    const iFin = base.map(x => x.section).lastIndexOf('Clients');
    const avec = iFin >= 0 ? [...base.slice(0, iFin + 1), ...clientsPlus, ...base.slice(iFin + 1)] : [...base, ...clientsPlus];
    return [...avec, ...reste];
  };

  if (typeof navAller === 'function') {
    const allerOrigine = navAller;
    window.navAller = function (i) {
      const x = (window._nav && window._nav.resultats || [])[i];
      if (x && /^(contrat|opp):/.test(x.id)) {
        navFermer();
        const [type, id] = [x.id.split(':')[0], x.id.slice(x.id.indexOf(':') + 1)];
        if (type === 'contrat' && typeof showClient === 'function') { showClient(id); setTimeout(() => typeof fcxOnglet === 'function' && fcxOnglet('tab-contrats'), 600); }
        if (type === 'opp' && typeof editerOpportunite === 'function') editerOpportunite(id);
        return;
      }
      return allerOrigine.apply(this, arguments);
    };
  }
})();

// ── Le menu lui-même ───────────────────────────────────────────────────────────────────────────
function mnuToutBasculer() {
  if (typeof openSections === 'undefined') return;
  const secs = (typeof SECTIONS !== 'undefined' ? SECTIONS : []).filter(s => !s.solo);
  const toutOuvert = secs.every(s => openSections[s.id]);
  secs.forEach(s => { openSections[s.id] = !toutOuvert; });
  if (typeof renderSidebar === 'function') renderSidebar();
}

function mnuHabiller(nav) {
  const secs = typeof SECTIONS !== 'undefined' ? SECTIONS : [];
  const rh = typeof estRoleRH === 'function' && estRoleRH();
  const vueMenu = typeof currentView !== 'undefined' ? (currentView === 'dossier-conseil' ? 'conseil' : currentView) : '';

  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Menu principal');

  // Rubriques : icône, nombre d'écrans, et le lien avec ce qu'elles déplient.
  nav.querySelectorAll('.nav-section-btn[data-sec]').forEach(btn => {
    const sec = secs.find(s => s.id === btn.dataset.sec);
    if (!sec || btn.querySelector('.nav-sec-ico')) return;
    const n = (sec.sub || []).filter(s => !rh || s.rhAllowed).length;
    btn.insertAdjacentHTML('afterbegin', `<span class="nav-sec-ico" aria-hidden="true">${sec.icon || '•'}</span>`);
    btn.querySelector('.arrow')?.insertAdjacentHTML('beforebegin', `<span class="nav-sec-compte" aria-label="${n} écrans">${n}</span>`);
    btn.id = 'nav-sec-' + sec.id;
  });

  // Entrées : le nom complet au survol (les longs libellés sont tronqués), et la page ouverte
  // annoncée comme telle aux lecteurs d'écran.
  nav.querySelectorAll('.nav-item, .nav-solo-btn').forEach(b => {
    const lib = b.querySelector('.nav-lib');
    if (lib && !b.title) b.title = lib.textContent.trim();
    if (b.classList.contains('active')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });

  // Un intertitre avant les rubriques, avec « tout ouvrir / tout fermer ».
  const premiere = nav.querySelector('.nav-section-btn');
  if (premiere && !nav.querySelector('.nav-outils')) {
    const toutOuvert = secs.filter(s => !s.solo).every(s => openSections[s.id]);
    premiere.insertAdjacentHTML('beforebegin', `<div class="nav-outils">
      <span>Rubriques</span>
      <button type="button" onclick="mnuToutBasculer()">${toutOuvert ? 'tout fermer' : 'tout ouvrir'}</button>
    </div>`);
  }
}

(function mnuBrancherMenu() {
  if (typeof renderSidebar !== 'function') return;
  const origine = renderSidebar;
  window.renderSidebar = function () {
    const nav = document.getElementById('nav');
    const haut = nav ? nav.scrollTop : 0;
    const vue = typeof currentView !== 'undefined' ? currentView : null;
    const vueChangee = vue !== window._mnu.derniereVue;

    // La rubrique de l'écran ouvert s'ouvre d'elle-même — une fois par changement d'écran, pour
    // qu'on puisse encore la refermer sans qu'elle se rouvre au prochain rafraîchissement.
    if (vueChangee && typeof openSections !== 'undefined') {
      const o = mnuOuSuisJe();
      if (o.section && !openSections[o.section.id]) openSections[o.section.id] = true;
    }

    const r = origine.apply(this, arguments);
    if (nav) {
      mnuHabiller(nav);
      nav.scrollTop = haut;
      if (vueChangee) {
        const actif = nav.querySelector('.nav-item.active:not(.nav-rapide), .nav-solo-btn.active');
        if (actif) {
          const a = actif.getBoundingClientRect(), n = nav.getBoundingClientRect();
          if (a.top < n.top + 8 || a.bottom > n.bottom - 8) actif.scrollIntoView({ block: 'center' });
        }
      }
    }
    window._mnu.derniereVue = vue;
    mnuPeindreFil();
    return r;
  };
})();

// ── Le clavier dans le menu ────────────────────────────────────────────────────────────────────
function mnuBoutons(nav) {
  return [...nav.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.disabled && !b.closest('.nav-outils'));
}
function mnuClavier(ev) {
  const nav = document.getElementById('nav');
  if (!nav || !nav.contains(document.activeElement)) return;
  const liste = mnuBoutons(nav);
  const i = liste.indexOf(document.activeElement);
  const aller = j => { const b = liste[Math.max(0, Math.min(liste.length - 1, j))]; if (b) { b.focus(); b.scrollIntoView({ block: 'nearest' }); } };
  const sec = document.activeElement.classList.contains('nav-section-btn') ? document.activeElement.dataset.sec : null;
  switch (ev.key) {
    case 'ArrowDown': ev.preventDefault(); aller(i + 1); break;
    case 'ArrowUp': ev.preventDefault(); aller(i - 1); break;
    case 'Home': ev.preventDefault(); aller(0); break;
    case 'End': ev.preventDefault(); aller(liste.length - 1); break;
    case 'ArrowRight':
    case 'ArrowLeft':
      if (!sec || typeof openSections === 'undefined') return;
      ev.preventDefault();
      if (!!openSections[sec] !== (ev.key === 'ArrowRight')) {
        openSections[sec] = ev.key === 'ArrowRight';
        renderSidebar();
        document.getElementById('nav-sec-' + sec)?.focus();
      }
      break;
  }
}

// ── Mise en place ──────────────────────────────────────────────────────────────────────────────
(function mnuDemarrer() {
  const go = () => {
    mnuPoserBarre();
    document.getElementById('nav')?.addEventListener('keydown', mnuClavier);
    mnuPeindreFil();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
