// ═══ RETROUVER UN ÉCRAN EN TROIS LETTRES (20.09.2026) ══════════════════════════════════════════
// Constat de Jonathan : « avec la quantité de boutons je retrouve rien ». Mesuré : 48 entrées de
// menu réparties en 6 sections repliées. Pour atteindre « Entrées d'argent » il faut ouvrir
// Finances, repérer le groupe Pilotage, puis lire quatre lignes. Trois gestes et de la lecture
// pour une action — et ça empire à chaque écran ajouté.
//
// Quatre réponses, de la plus forte à la plus discrète :
//
// 1. UNE PALETTE DE COMMANDES (Ctrl+K). C'est la seule qui ne se dégrade pas : à 48 écrans comme
//    à 80, on tape trois lettres et on y est. Elle cherche dans les libellés, dans le chemin, et
//    dans des SYNONYMES — parce que personne ne cherche « Entrées d'argent » en tapant « entrées » :
//    on tape « argent », « cash », « encaissé ». Elle trouve aussi les clients.
//
// 2. DES ÉPINGLES. Cinq ou six écrans font 90 % des journées. Épinglés en haut, le reste devient
//    de l'archive qu'on consulte au lieu d'un mur qu'on parcourt.
//
// 3. LES RÉCENTS, sans rien configurer.
//
// 4. DES GROUPES VRAIMENT LISIBLES : un intertitre, pas un bouton de plus, et le compte des
//    entrées — savoir qu'un groupe contient quatre lignes évite de l'ouvrir pour rien.

// ── Les mots qu'on tape vraiment ────────────────────────────────────────────────────────────────
// Sans cette table, « Entrées d'argent » ne se trouve qu'en tapant son nom exact. Or on cherche
// avec le mot du problème, pas avec le titre de l'écran.
const NAV_SYNONYMES = {
  'entrees-argent': 'argent cash encaissement encaisse revenus recettes excel export previsionnel',
  'rapprochement': 'banque releve bancaire lettrage pointage credits versements',
  'tresorerie': 'cash flow liquidites solde previsionnel budget',
  'suivi-financier': 'cockpit pilotage chiffres kpi tableau financier',
  'commissions-attente': 'commissions attendu encaisse retard',
  'import-decompte': 'decompte bordereau import xml excel',
  'ocr-decomptes': 'scanner scan pdf lecture decompte',
  'ecohub-sync': 'ecohub igb2b synchronisation compagnies documents',
  'documents-compagnies': 'documents polices recus pdf pieces jointes',
  'demandes-polices': 'courrier compagnie transfert portefeuille mandat',
  'demandes-devis': 'lead prospect formulaire public site web demande',
  'kanban-campagnes': 'campagne tableau kanban marketing brevo newsletter',
  'campagnes': 'newsletter emailing modeles messages',
  'messages-clients': 'message sinistre demande document conversation fil',
  'clients': 'fiche client portefeuille annuaire',
  'opportunites': 'pipeline affaires deals vente',
  'tous-contrats': 'contrat police portefeuille',
  'renouvellements': 'echeance resiliation preavis',
  'relances-lamal': 'lamal sante caisse maladie relance',
  'equipement': 'vente croisee cross sell besoins couverture',
  'sources': 'apporteur recommandation acquisition canal',
  'rappels': 'tache todo rappel a faire',
  'agenda': 'calendrier rendez-vous planning',
  'factures': 'facture qr paiement',
  'fiche-paie': 'salaire paie agent retrocession',
  'rapport-finma': 'finma controle reglementaire audit',
  'audit-log': 'journal historique traces',
  'apparence': 'theme couleurs densite saison design',
  'conseil': 'conseil financier patrimoine bilan',
  'analyse-prevoyance': 'prevoyance retraite 2e pilier 3a lacune',
  'calc-immo': 'hypotheque immobilier financement maison',
  'bordereaux': 'bordereau decompte commission compagnie',
  'dashboard': 'accueil tableau de bord home',
};

const NAV_CLE_EPINGLES = 'rex-nav-epingles';
const NAV_CLE_RECENTS = 'rex-nav-recents';
const NAV_MAX_RECENTS = 6;

window._nav = window._nav || { ouverte: false, requete: '', index: 0, resultats: [] };

function navSansAccents(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[''`]/g, ' ');
}
function navEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function navEpingles() { try { return JSON.parse(localStorage.getItem(NAV_CLE_EPINGLES) || '[]'); } catch (e) { return []; } }
function navRecents() { try { return JSON.parse(localStorage.getItem(NAV_CLE_RECENTS) || '[]'); } catch (e) { return []; } }

function navBasculerEpingle(id) {
  const l = navEpingles();
  const i = l.indexOf(id);
  if (i >= 0) l.splice(i, 1); else l.unshift(id);
  try { localStorage.setItem(NAV_CLE_EPINGLES, JSON.stringify(l.slice(0, 8))); } catch (e) {}
  if (typeof renderSidebar === 'function') renderSidebar();
  if (window._nav.ouverte) navPeindre();
  showError(i >= 0 ? 'Écran retiré des épinglés.' : '✓ Écran épinglé en haut du menu.');
}

// ── L'inventaire des écrans, à plat ─────────────────────────────────────────────────────────────
// On le reconstruit à chaque ouverture : un menu qui dépend du rôle ne doit pas proposer ce que
// l'utilisateur ne peut pas ouvrir.
function navInventaire() {
  const out = [];
  const rh = typeof estRoleRH === 'function' ? estRoleRH() : false;
  (typeof SECTIONS !== 'undefined' ? SECTIONS : []).forEach(sec => {
    if (sec.signataireOnly && (!currentUser || currentUser.role !== 'signataire')) return;
    if (sec.solo) {
      if (rh && !sec.rhAllowed) return;
      out.push({ id: sec.target || sec.id, label: sec.label, icone: sec.icon || '•', chemin: '' });
      return;
    }
    (sec.sub || []).filter(s => !rh || s.rhAllowed).forEach(s => {
      out.push({ id: s.id, label: s.label, icone: s.icon || '•',
        chemin: sec.label + (s.groupe && s.groupe !== sec.label ? ' › ' + s.groupe : '') });
    });
  });
  return out;
}

function navEcran(id) { return navInventaire().find(x => x.id === id); }

// ── La recherche ────────────────────────────────────────────────────────────────────────────────
// Chaque mot tapé doit se retrouver quelque part (libellé, chemin ou synonyme). Un ET, pas un OU :
// « devis client » ne doit pas remonter tous les écrans contenant « client ».
function navChercher(q) {
  const mots = navSansAccents(q).split(/\s+/).filter(Boolean);
  const ecrans = navInventaire();
  if (!mots.length) {
    const ep = navEpingles(), rc = navRecents();
    return [
      ...ep.map(id => ({ ...navEcran(id), section: 'Épinglés' })).filter(x => x.id),
      ...rc.filter(id => !ep.includes(id)).map(id => ({ ...navEcran(id), section: 'Récents' })).filter(x => x.id),
    ].slice(0, 10);
  }

  const notes = [];
  for (const e of ecrans) {
    const lib = navSansAccents(e.label);
    const foin = lib + ' ' + navSansAccents(e.chemin) + ' ' + (NAV_SYNONYMES[e.id] || '');
    if (!mots.every(m => foin.includes(m))) continue;
    // Le classement : un libellé qui commence par ce qu'on tape passe devant un synonyme.
    let note = 0;
    if (lib.startsWith(mots[0])) note += 100;
    if (mots.every(m => lib.includes(m))) note += 50;
    if (navEpingles().includes(e.id)) note += 20;
    if (navRecents().includes(e.id)) note += 10;
    note -= lib.length * 0.1;
    notes.push({ ...e, section: 'Écrans', note });
  }
  notes.sort((a, b) => b.note - a.note);

  // Les clients : on ne les cherche qu'à partir de deux lettres, sinon ils noient les écrans.
  const clients = [];
  if (mots.join('').length >= 2 && typeof allClients !== 'undefined') {
    for (const c of allClients) {
      const nom = ((c.prenom || '') + ' ' + (c.nom || '')).trim();
      if (!mots.every(m => navSansAccents(nom).includes(m))) continue;
      clients.push({ id: 'client:' + c.id, label: nom, icone: '👤', chemin: 'Fiche client', section: 'Clients' });
      if (clients.length >= 6) break;
    }
  }
  return [...notes.slice(0, 12), ...clients];
}

// ── La palette ──────────────────────────────────────────────────────────────────────────────────
function navOuvrir(requeteInitiale) {
  if (window._nav.ouverte) return;
  window._nav.ouverte = true;
  window._nav.requete = requeteInitiale || '';
  window._nav.index = 0;
  const d = document.createElement('div');
  d.id = 'nav-palette';
  d.className = 'nav-palette-fond';
  d.setAttribute('role', 'dialog');
  d.setAttribute('aria-modal', 'true');
  d.innerHTML = `
    <div class="nav-palette" role="combobox" aria-expanded="true" aria-haspopup="listbox">
      <div class="nav-palette-tete">
        <span aria-hidden="true">🔎</span>
        <input id="nav-q" type="text" autocomplete="off" spellcheck="false"
          placeholder="Où veux-tu aller ? (un écran, un client…)" value="${navEsc(window._nav.requete)}"
          aria-label="Rechercher un écran ou un client"/>
        <kbd>Échap</kbd>
      </div>
      <div class="nav-palette-liste" id="nav-liste" role="listbox"></div>
      <div class="nav-palette-pied">
        <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
        <span><kbd>↵</kbd> ouvrir</span>
        <span><kbd>★</kbd> épingler d’un clic sur l’étoile</span>
      </div>
    </div>`;
  d.addEventListener('mousedown', ev => { if (ev.target === d) navFermer(); });
  document.body.appendChild(d);

  const champ = document.getElementById('nav-q');
  champ.addEventListener('input', () => { window._nav.requete = champ.value; window._nav.index = 0; navPeindre(); });
  champ.addEventListener('keydown', navTouche);
  navPeindre();
  champ.focus();
  champ.select();
}

function navFermer() {
  window._nav.ouverte = false;
  document.getElementById('nav-palette')?.remove();
}

function navTouche(ev) {
  const n = window._nav.resultats.length;
  if (ev.key === 'Escape') { ev.preventDefault(); navFermer(); return; }
  if (ev.key === 'ArrowDown') { ev.preventDefault(); window._nav.index = n ? (window._nav.index + 1) % n : 0; navPeindre(true); return; }
  if (ev.key === 'ArrowUp') { ev.preventDefault(); window._nav.index = n ? (window._nav.index - 1 + n) % n : 0; navPeindre(true); return; }
  if (ev.key === 'Enter') { ev.preventDefault(); navAller(window._nav.index); return; }
}

function navPeindre(garderFocus) {
  const liste = document.getElementById('nav-liste');
  if (!liste) return;
  const r = navChercher(window._nav.requete);
  window._nav.resultats = r;
  if (window._nav.index >= r.length) window._nav.index = 0;

  if (!r.length) {
    liste.innerHTML = `<div class="nav-palette-vide">Rien ne correspond à « ${navEsc(window._nav.requete)} ».
      <small>Essaie un mot du problème plutôt qu’un titre : « argent », « banque », « échéance ».</small></div>`;
    return;
  }
  let section = null, html = '';
  r.forEach((x, i) => {
    if (x.section !== section) { section = x.section; html += `<div class="nav-palette-section">${section}</div>`; }
    const estEcran = !x.id.startsWith('client:');
    const epingle = estEcran && navEpingles().includes(x.id);
    html += `<button type="button" class="nav-palette-ligne ${i === window._nav.index ? 'actif' : ''}"
        role="option" aria-selected="${i === window._nav.index}" data-i="${i}" onclick="navAller(${i})">
      <span class="nav-palette-ico" aria-hidden="true">${x.icone}</span>
      <span class="nav-palette-lib"><b>${navEsc(x.label)}</b>${x.chemin ? `<small>${navEsc(x.chemin)}</small>` : ''}</span>
      ${estEcran ? `<span class="nav-palette-etoile ${epingle ? 'pleine' : ''}"
        onclick="event.stopPropagation();navBasculerEpingle('${x.id}')" title="${epingle ? 'Retirer des épinglés' : 'Épingler'}">${epingle ? '★' : '☆'}</span>` : ''}
    </button>`;
  });
  liste.innerHTML = html;
  liste.querySelector('.nav-palette-ligne.actif')?.scrollIntoView({ block: 'nearest' });
  if (garderFocus) document.getElementById('nav-q')?.focus();
}

function navAller(i) {
  const x = window._nav.resultats[i];
  if (!x) return;
  navFermer();
  if (x.id.startsWith('client:')) {
    const id = x.id.slice(7);
    if (typeof showClient === 'function') showClient(id);
    return;
  }
  if (typeof navigate === 'function') navigate(x.id);
}

// ── Les récents, alimentés par la navigation elle-même ──────────────────────────────────────────
(function navSuivreNavigation() {
  const origine = window.navigate;
  if (typeof origine !== 'function') return;
  window.navigate = function (vue, opts) {
    try {
      if (vue && typeof vue === 'string' && !(opts && opts.silent)) {
        const l = navRecents().filter(x => x !== vue);
        l.unshift(vue);
        localStorage.setItem(NAV_CLE_RECENTS, JSON.stringify(l.slice(0, NAV_MAX_RECENTS)));
      }
    } catch (e) {}
    return origine.apply(this, arguments);
  };
})();

// ── Le raccourci ────────────────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', ev => {
  if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
    ev.preventDefault();
    window._nav.ouverte ? navFermer() : navOuvrir();
  }
});

// ── Les épinglés et les récents, en haut du menu ────────────────────────────────────────────────
// On enveloppe renderSidebar plutôt que de le réécrire : le menu existant continue de vivre sa
// vie, et ce bloc se pose devant.
(function navHabillerMenu() {
  const origine = window.renderSidebar;
  if (typeof origine !== 'function') return;
  window.renderSidebar = function () {
    origine.apply(this, arguments);
    const nav = document.getElementById('nav');
    if (!nav) return;

    const ep = navEpingles().map(navEcran).filter(Boolean);
    const rc = navRecents().filter(id => !navEpingles().includes(id)).map(navEcran).filter(Boolean).slice(0, 4);

    const ligne = (x, epingle) => `<button class="nav-item nav-rapide ${currentView === x.id ? 'active' : ''}" onclick="navigate('${x.id}')">
      <span class="nav-ico" aria-hidden="true">${x.icone}</span><span class="nav-lib">${navEsc(x.label)}</span>
      <span class="nav-etoile ${epingle ? 'pleine' : ''}" onclick="event.stopPropagation();navBasculerEpingle('${x.id}')"
        title="${epingle ? 'Retirer des épinglés' : 'Épingler'}">${epingle ? '★' : '☆'}</span>
    </button>`;

    const bloc = `
      <button type="button" class="nav-chercher" onclick="navOuvrir()">
        <span aria-hidden="true">🔎</span><span>Chercher un écran…</span><kbd>Ctrl K</kbd>
      </button>
      ${ep.length ? `<div class="nav-intertitre">Épinglés</div>${ep.map(x => ligne(x, true)).join('')}` : ''}
      ${rc.length ? `<div class="nav-intertitre">Récents</div>${rc.map(x => ligne(x, false)).join('')}` : ''}
      ${ep.length || rc.length ? '<div class="nav-separateur"></div>' : ''}`;
    nav.insertAdjacentHTML('afterbegin', bloc);

    // Le compte d'entrées par groupe : savoir qu'un groupe en contient quatre évite de l'ouvrir
    // pour rien. On le lit sur le menu déjà rendu plutôt que de dupliquer la structure.
    nav.querySelectorAll('.nav-groupe').forEach(g => {
      let n = 0;
      for (let el = g.nextElementSibling; el && el.classList.contains('nav-item'); el = el.nextElementSibling) n++;
      if (n && !g.querySelector('.nav-groupe-compte')) {
        g.querySelector('.nav-groupe-fleche')
          ?.insertAdjacentHTML('beforebegin', `<span class="nav-groupe-compte">${n}</span>`);
      }
    });
  };
})();
