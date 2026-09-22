// ═══ REX CLOUD — LA REFONTE (21.09.2026) ═══════════════════════════════════════════════════════
// « Je pense qu'il faut revoir de manière complète une refonte de l'espace client : accessibilité,
// visibilité, fonctionnalité, mise en page générale avec le texte centré. Ce sont les couvertures
// qui doivent être prioritaires sur l'écran. »
//
// Vu sur un iPhone avant d'écrire une ligne :
//   · le bouton « Transférer la gestion » était un rectangle blanc au texte illisible ;
//   · « Se déconnecter » était un gros bouton fondu dans les autres ;
//   · des éléments du CRM (une montre, le bandeau des marchés) s'affichaient chez le client ;
//   · le widget « Primes maladie » occupait un écran entier ;
//   · et les couvertures — la raison pour laquelle un client ouvre son espace — n'apparaissaient
//     qu'après deux écrans de défilement, dans un autre onglet.
//
// L'ordre de la page devient celui des questions du client :
//   1. Qui suis-je, et comment sortir ?     → une barre fine : REX CLOUD, et « Se déconnecter »
//                                             en couleur, petit mais explicite.
//   2. Suis-je bien couvert ?               → MES COUVERTURES, tout de suite : chaque domaine,
//                                             ses contrats, sa compagnie, sa prime.
//   3. Que dois-je savoir maintenant ?      → un seul bandeau court (primes maladie en automne,
//                                             transfert en cours, message non lu).
//   4. Que puis-je faire ?                  → des tuiles centrées, un geste chacune.
//   5. Qui est mon conseiller ?             → en pied, avec photo et contacts.
//
// Aucun formulaire n'est réécrit : sinistre, message, document, déménagement, salarié, transfert
// ouvrent les mêmes fenêtres qu'avant (js/51, js/52, js/103, js/104). Les onglets restent, pour
// le détail.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de index.html (ce fichier + 99-rex-cloud.css). La
// vue précédente (js/52 et ses enveloppes) reprend sa place au rechargement.

function rcEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rcCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }
function rcIco(nom, t) { return typeof ico === 'function' ? ico(nom, t || 20) : ''; }

const RC_SORTIE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/></svg>';

function rcEntreprise() {
  const c = (window._ec || {}).client;
  return !!(c && typeof estEntreprise === 'function' && estEntreprise(c));
}

// ── Le bandeau court ───────────────────────────────────────────────────────────────────────────
// Une ligne, une information, un geste. Le widget précédent expliquait le fonctionnement de
// l'OFSP sur un écran entier ; le client veut savoir s'il doit agir et avant quand.
function rcBandeauPrimes() {
  const E = window._ec || {};
  if (rcEntreprise() || typeof ecpJoursRestants !== 'function') return '';
  const { jours, limite } = ecpJoursRestants();
  if (jours > 100) return '';               // hors saison : rien à dire
  const annee = typeof ecpAnneeCible === 'function' ? ecpAnneeCible() : new Date().getFullYear() + 1;
  const urgent = jours <= 21;
  const npa = String((E.client || {}).npa || '').trim();
  return `<aside class="rc-bandeau ${urgent ? 'urgent' : ''}" aria-label="Primes maladie ${annee}">
    <span class="rc-bandeau-ico">${rcIco('horloge', 18)}</span>
    <p><b>Primes maladie ${annee}</b> · changement de caisse possible jusqu’au
      ${fmtDate(limite.toISOString().slice(0, 10))} <span class="rc-bandeau-jours">(${jours} j)</span></p>
    <span class="rc-bandeau-actions">
      <button type="button" onclick="ecpDemanderComparatif()">Demander un comparatif</button>
      <a href="https://www.priminfo.admin.ch/fr${npa ? '' : ''}" target="_blank" rel="noopener">priminfo ↗</a>
    </span>
  </aside>`;
}

// ── Mes couvertures ────────────────────────────────────────────────────────────────────────────
function rcCouvertures() {
  const actifs = typeof ecContratsActifs === 'function' ? ecContratsActifs() : [];
  const types = typeof ecaTypes === 'function' ? ecaTypes() : (typeof EC_TYPES !== 'undefined' ? EC_TYPES : []);
  const cat = ct => typeof ecaCategorie === 'function' ? ecaCategorie(ct) : (typeof ecTypeContrat === 'function' ? ecTypeContrat(ct) : 'autre');
  if (!actifs.length) {
    return `<section class="rc-carte rc-couv" aria-labelledby="rc-couv-titre">
      <h2 id="rc-couv-titre">Mes couvertures</h2>
      <p class="rc-vide">Aucun contrat en vigueur pour l’instant. Dès qu’une police nous parvient,
        elle apparaît ici.</p>
    </section>`;
  }
  const parCat = new Map();
  for (const ct of actifs) { const id = cat(ct); if (!parCat.has(id)) parCat.set(id, []); parCat.get(id).push(ct); }
  const total = actifs.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
  const domaines = types.filter(t => (parCat.get(t.id) || []).length);

  return `<section class="rc-carte rc-couv" aria-labelledby="rc-couv-titre">
    <h2 id="rc-couv-titre">Mes couvertures</h2>
    <p class="rc-sous">${actifs.length} contrat${actifs.length > 1 ? 's' : ''} en vigueur · ${domaines.length} domaine${domaines.length > 1 ? 's' : ''}${total ? ` · CHF ${rcCHF(total)} par an` : ''}</p>
    <div class="rc-domaines">${domaines.map(t => {
      const l = parCat.get(t.id);
      const p = l.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
      return `<article class="rc-domaine">
        <button type="button" class="rc-domaine-tete" onclick="rcOuvrirDomaine('${t.id}')" aria-label="${rcEsc(t.label)} : voir le détail">
          <span class="rc-domaine-ico" aria-hidden="true">${t.icone || ''}</span>
          <b>${rcEsc(t.label)}</b>
          ${p ? `<span class="rc-domaine-prime">CHF ${rcCHF(p)}<small>/an</small></span>` : ''}
        </button>
        <ul class="rc-contrats">${l.map(ct => `<li>
          <span class="rc-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 26) : ''}</span>
          <span class="rc-contrat-txt"><b>${rcEsc(ct.produit || 'Contrat')}</b><small>${rcEsc(ct.compagnie || '')}${ct.numero_police ? ` · police ${rcEsc(ct.numero_police)}` : ''}</small></span>
          ${typeof ecPoliceDisponible === 'function' && ecPoliceDisponible(ct.id)
            ? `<button type="button" class="rc-police" onclick="ecTelechargerPolice('${ct.id}', this)" aria-label="Télécharger ma police ${rcEsc(ct.produit || '')}">${rcIco('telecharger', 16)}<span>Police</span></button>` : ''}
        </li>`).join('')}</ul>
      </article>`;
    }).join('')}</div>
    <button type="button" class="rc-lien" onclick="ecAllerOnglet('contrats')">Voir le détail de mes contrats ${rcIco('fleche', 15)}</button>
  </section>`;
}

function rcOuvrirDomaine(id) {
  if (typeof ecAllerOnglet === 'function') ecAllerOnglet('contrats');
  setTimeout(() => { if (typeof ecaAller === 'function') ecaAller(id); }, 60);
}

// ── Que souhaitez-vous faire ? ─────────────────────────────────────────────────────────────────
function rcTuile(icone, titre, aide, onclick, extra) {
  return `<button type="button" class="rc-tuile ${extra || ''}" onclick="${onclick}">
    <span class="rc-tuile-ico" aria-hidden="true">${icone}</span><b>${titre}</b><small>${aide}</small></button>`;
}

function rcActions() {
  const E = window._ec || {};
  const adrEnCours = typeof adrDemandeEnCours === 'function' ? adrDemandeEnCours() : null;
  const tuiles = [
    rcTuile(rcIco('sinistre', 24), 'Déclarer un sinistre', 'Nous l’annonçons à votre assureur', 'ecOuvrirSinistre()'),
    rcTuile(rcIco('message', 24), 'Écrire à mon conseiller', 'Une question, une modification', 'ecOuvrirMessage()'),
    rcTuile(rcIco('document', 24), 'Demander un document', 'Police, attestation, carte verte', 'ecOuvrirDemandeDocument()'),
    adrEnCours
      ? `<div class="rc-tuile rc-tuile-attente" role="status"><span class="rc-tuile-ico" aria-hidden="true">${rcIco('horloge', 24)}</span><b>Déménagement annoncé</b><small>Votre conseiller met vos contrats à jour</small></div>`
      : (typeof adrOuvrir === 'function' ? rcTuile(rcIco('habitation', 24), 'Annoncer un déménagement', 'Nous prévenons chaque compagnie', 'adrOuvrir()') : ''),
  ];
  if (rcEntreprise() && typeof aslOuvrir === 'function') {
    tuiles.push(rcTuile(rcIco('personnel', 24), 'Annoncer un salarié', 'Entrée ou sortie : LPP, LAA, IJM', 'aslOuvrir()'));
  }
  tuiles.push(rcTuile(rcIco('agenda', 24), 'Prendre rendez-vous', 'Au bureau, en visio ou chez vous', "ecOuvrirMessageMotif('rendez_vous')"));
  return `<section class="rc-carte" aria-labelledby="rc-act-titre">
    <h2 id="rc-act-titre">Que souhaitez-vous faire ?</h2>
    <div class="rc-tuiles">${tuiles.filter(Boolean).join('')}</div>
  </section>`;
}

// Le transfert : vert, centré, et un titre qui dit ce qu'on obtient.
function rcTransfert() {
  const enCours = typeof etrEnCours === 'function' ? etrEnCours() : null;
  if (enCours && typeof etrBlocHtml === 'function') return `<section class="rc-carte rc-transfert-suivi">${etrBlocHtml()}</section>`;
  return `<section class="rc-transfert">
    <button type="button" class="rc-btn-vert" onclick="ecOuvrirTransfert()">
      <b>Transférer la gestion de mes assurances</b>
      <small>Service gratuit — nous récupérons vos polices, vos couvertures restent inchangées</small>
    </button>
  </section>`;
}

// ── Mes documents signés (22.09.2026) ─────────────────────────────────────────────────────────
// « L'idée, c'est qu'il existe une copie enregistrée mise à disposition sur l'espace client si
// l'espace est créé ; sinon elle s'insère à la création. » La carte lit mandats_signes par
// client_id (la règle d'accès « mandats_espace_client » n'ouvre que les siens) : un mandat signé
// avant l'ouverture de l'espace y apparaît donc d'office le jour où l'espace est créé.
function rcDocsSignes() {
  return ((window._ec || {}).mandats || []).filter(m => m.signe && !m.archive && (m.html_snapshot || m.fichier_url))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function rcMandats() {
  const docs = rcDocsSignes();
  if (!docs.length) return '';
  return `<section class="rc-carte rc-mandats" aria-labelledby="rc-man-titre">
    <h2 id="rc-man-titre">Mes documents signés</h2>
    <ul class="rc-liste">${docs.map(m => `<li>
      <span class="rc-man-txt"><b>${rcEsc((m.fichier_nom || 'Mandat de courtage').split(' — ')[0])}</b>
        <span>Signé le ${fmtDate(String(m.created_at || '').slice(0, 10))}</span></span>
      <button type="button" class="rc-man-voir" onclick="rcVoirDocSigne('${m.id}')">Voir / télécharger</button>
    </li>`).join('')}</ul>
  </section>`;
}

async function rcVoirDocSigne(id) {
  const m = rcDocsSignes().find(x => x.id === id);
  if (!m) return;
  // La copie enregistrée, telle que signée : même rendu que côté conseiller, imprimable en PDF.
  if (m.html_snapshot) {
    const w = window.open(URL.createObjectURL(new Blob([m.html_snapshot], { type: 'text/html;charset=utf-8' })), '_blank');
    if (!w && typeof showError === 'function') showError('Autorisez les fenêtres pop-up pour afficher le document.');
    return;
  }
  // Mandat signé à la main et déposé en PDF : lien signé à la volée, comme côté conseiller.
  if (typeof ouvrirPieceJointe === 'function') { ouvrirPieceJointe(m.fichier_url); return; }
  if (typeof showError === 'function') showError('Ce document s’ouvre depuis votre conseiller : écrivez-lui, il vous l’envoie.');
}

function rcAgenda() {
  const E = window._ec || {};
  const prochains = (E.rdv || []).filter(r => r.date_heure && r.date_heure >= new Date().toISOString() && r.statut !== 'annule');
  const vehicules = E.vehicules || [];
  if (!prochains.length && !vehicules.length) return '';
  // 22.09.2026 : date_heure est en UTC ; slice(11, 16) affichait 08:00 pour un rendez-vous à
  // 10 h (été). On passe par l'heure de Zurich (ecRdvJour / ecRdvHeure, js/48).
  const jour = iso => typeof ecRdvJour === 'function' ? ecRdvJour(iso) : String(iso).slice(0, 10);
  const heure = iso => typeof ecRdvHeure === 'function' ? ecRdvHeure(iso)
    : new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
  return `<div class="rc-duo">
    ${prochains.length ? `<section class="rc-carte" aria-labelledby="rc-rdv-titre"><h2 id="rc-rdv-titre">Mes rendez-vous</h2>
      <ul class="rc-liste">${prochains.map(r => `<li><b>${rcEsc(r.type || 'Rendez-vous')}</b><span>${fmtDate(jour(r.date_heure))} · ${heure(r.date_heure)}</span></li>`).join('')}</ul></section>` : ''}
    ${vehicules.length ? `<section class="rc-carte" aria-labelledby="rc-veh-titre"><h2 id="rc-veh-titre">Mes véhicules</h2>
      <ul class="rc-liste">${vehicules.map(v => `<li><b>${rcEsc([v.marque, v.modele].filter(Boolean).join(' ') || v.type_vehicule || 'Véhicule')}</b>${v.numero_plaque ? `<span class="rc-plaque">${rcEsc(v.numero_plaque)}</span>` : ''}</li>`).join('')}</ul></section>` : ''}
  </div>`;
}

function rcConseillerPied() {
  const co = typeof ecConseiller === 'function' ? ecConseiller() : {};
  const photo = typeof ECP_PHOTO_CONSEILLER !== 'undefined' ? ECP_PHOTO_CONSEILLER : '';
  return `<section class="rc-carte rc-conseiller" aria-labelledby="rc-co-titre">
    <h2 id="rc-co-titre" class="rc-visuel-cache">Mon conseiller</h2>
    ${photo ? `<img class="rc-co-photo" src="${photo}" alt="" loading="lazy" onerror="this.remove()"/>` : ''}
    <b>${rcEsc(co.nom || '')}</b>
    <small>${rcEsc(co.role || '')}</small>
    <div class="rc-co-liens">
      ${co.tel ? `<a href="tel:${rcEsc(String(co.tel).replace(/\s/g, ''))}">${rcIco('telephone', 16)}<span>${rcEsc(co.tel)}</span></a>` : ''}
      ${co.email ? `<a href="mailto:${rcEsc(co.email)}">${rcIco('courriel', 16)}<span>${rcEsc(co.email)}</span></a>` : ''}
    </div>
  </section>`;
}

// ── La page ────────────────────────────────────────────────────────────────────────────────────
function rcVue() {
  const E = window._ec || {};
  const c = E.client;
  if (E.sinistres === undefined && !E._servicesEnCours && typeof ecChargerServices === 'function') ecChargerServices();
  const onglet = (typeof _ecUI !== 'undefined' && _ecUI.onglet) || 'accueil';
  const onglets = typeof EC_ONGLETS !== 'undefined' ? EC_ONGLETS : [];
  const enCoursSin = (E.sinistres || []).filter(s => !['regle', 'refuse', 'annule'].includes(s.statut)).length;
  const nom = typeof ecNomClient === 'function' ? ecNomClient(c) : '';
  const ident = typeof eciBlocHtml === 'function' ? eciBlocHtml(c) : '';
  const notif = typeof filBandeauNotifications === 'function' ? filBandeauNotifications() : '';

  // Sur ordinateur (21.09.2026) : deux colonnes. Les couvertures occupent la grande colonne ; les
  // gestes, le transfert, l'agenda et le conseiller se rangent à droite. Sur téléphone, la grille
  // redevient une seule colonne dans cet ordre-là.
  const contenu = onglet === 'accueil'
    ? `${notif}<div class="rc-grille">${rcCouvertures()}${rcBandeauPrimes()}${rcActions()}${rcTransfert()}${rcMandats()}${rcAgenda()}${rcConseillerPied()}</div>`
    : onglet === 'contrats' ? (typeof ecOngletContrats === 'function' ? ecOngletContrats() : '')
    : onglet === 'sinistres' ? (typeof ecOngletSinistres === 'function' ? ecOngletSinistres() : '')
    : onglet === 'demandes' ? (typeof ecOngletDemandes === 'function' ? ecOngletDemandes() : '')
    : (typeof ecOngletConseiller === 'function' ? ecOngletConseiller() : '');

  const initiales = (nom || '?').split(/\s+/).filter(Boolean).map(m => m[0]).join('').slice(0, 2).toUpperCase();
  const prenom = c ? (c.prenom || c.nom || '') : '';
  return `<div class="rc" data-lgp-non>
    <header class="rc-barre">
      <span class="rc-marque"><img src="assets/logos/rex/logo-cloud/rex-cloud-blanc.png" alt="REX CLOUD" class="rc-marque-logo"/></span>
      <div class="rc-compte" role="group" aria-label="Mon compte">
        <button type="button" class="rc-moi" onclick="rcMenuCompte(event)" aria-haspopup="menu" aria-expanded="false">
          <span class="rc-avatar" aria-hidden="true">${rcEsc(initiales)}</span>
          <span class="rc-moi-txt"><b>${rcEsc(prenom)}</b><small>Mon compte</small></span>
        </button>
        <button type="button" class="rc-sortie" onclick="ecDeconnexion()" title="Se déconnecter" aria-label="Se déconnecter">${RC_SORTIE}</button>
      </div>
    </header>

    <section class="rc-tete">
      <div class="rc-tete-txt">
        <span class="rc-surtitre">Mon espace assurances</span>
        <h1>${rcEsc(nom || 'Bienvenue')}</h1>
        ${ident}
      </div>
      <img class="rc-tete-embleme" src="assets/logos/rex/logo-cloud/embleme.png" alt="" aria-hidden="true"/>
    </section>

    <nav class="rc-onglets" role="tablist" aria-label="Sections de mon espace">
      ${onglets.map(o => `<button type="button" role="tab" id="rc-tab-${o.id}" class="${onglet === o.id ? 'actif' : ''}" aria-selected="${onglet === o.id}" onclick="ecAllerOnglet('${o.id}')">${rcPictoOnglet(o.id)}<span>${rcEsc(o.label)}</span>${o.id === 'sinistres' && enCoursSin ? `<em aria-label="${enCoursSin} en cours">${enCoursSin}</em>` : ''}</button>`).join('')}
    </nav>

    <main class="rc-corps" role="tabpanel" aria-labelledby="rc-tab-${onglet}">
      ${contenu}
    </main>

    <footer class="rc-pied">
      <p>${(E.mandats || []).length ? `Mandat de courtage signé le ${fmtDate((E.mandats[0].created_at || '').slice(0, 10))} · ` : ''}Assurex Sàrl · Agrément FINMA F01565757</p>
      <button type="button" onclick="ecInfosLegales()">Informations légales et protection des données</button>
      <div class="rc-signature"><span>by</span><img src="assets/logos/assurex.png" alt="Assurex"/>${typeof LOGO_EXGROUPE_SVG !== 'undefined' ? `<span class="rc-ex">${LOGO_EXGROUPE_SVG}</span>` : ''}</div>
    </footer>
  </div>`;
}

// ── Onglets et compte : la même logique que le menu du CRM (21.09.2026) ─────────────────────────
// Pictogrammes au trait (js/119) et bouton scindé : à gauche le client et son compte, à droite
// la sortie.
function rcPictoOnglet(id) {
  const cle = { accueil: 'calc-immo', contrats: 'tous-contrats', sinistres: 'analyse-prevoyance', demandes: 'messages-clients', conseiller: 'clients-prives' }[id];
  return typeof pmnSvg === 'function' && cle ? pmnSvg(cle, 17) : '';
}

function rcMenuCompte(ev) {
  if (ev) ev.stopPropagation();
  const btn = document.querySelector('.rc-moi');
  const existant = document.getElementById('rc-menu-compte');
  if (existant) { existant.remove(); btn?.setAttribute('aria-expanded', 'false'); return; }
  const ligne = (picto, texte, action) => `<button type="button" role="menuitem" onclick="document.getElementById('rc-menu-compte')?.remove(); ${action}">${typeof pmnSvg === 'function' ? pmnSvg(picto, 16) : ''}<span>${texte}</span></button>`;
  const menu = document.createElement('div');
  menu.id = 'rc-menu-compte'; menu.className = 'rc-menu-compte'; menu.setAttribute('role', 'menu');
  menu.innerHTML = [
    ligne('tous-contrats', 'Mes contrats', "ecAllerOnglet('contrats')"),
    ligne('messages-clients', 'Mes demandes', "ecAllerOnglet('demandes')"),
    typeof adrOuvrir === 'function' ? ligne('calc-immo', 'Annoncer un déménagement', 'adrOuvrir()') : '',
    ligne('clients-prives', 'Mon conseiller', "ecAllerOnglet('conseiller')"),
    ligne('rapport-finma', 'Informations légales', 'ecInfosLegales()'),
    `<hr/>`,
    ligne('_sortie', 'Se déconnecter', 'ecDeconnexion()'),
  ].join('');
  document.querySelector('.rc-compte')?.appendChild(menu);
  btn?.setAttribute('aria-expanded', 'true');
  setTimeout(() => document.addEventListener('click', function fermer(e) {
    if (!menu.contains(e.target)) { menu.remove(); btn?.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', fermer); }
  }), 0);
}

// ── Branchements ───────────────────────────────────────────────────────────────────────────────
(function rcBrancher() {
  // La vue entière, en dernière position : les enveloppes précédentes (identité, tuiles, onglets
  // sans émoji) sont reprises ici par leurs fonctions, pas par recherche de texte.
  if (typeof ecVueEspaceClient === 'function') window.ecVueEspaceClient = rcVue;

  // Le widget des primes, partout où il était appelé (en tête de « Mes contrats ») : le bandeau court.
  if (typeof ecpWidgetPrimes === 'function') window.ecpWidgetPrimes = rcBandeauPrimes;
})();

// La page de connexion vue par un client : « prenom@assurex.ch » en exemple lui laissait croire
// qu'il fallait une adresse Assurex.
(function rcConnexion() {
  const go = () => {
    if (!document.body.classList.contains('mode-cloud')) return;
    const mail = document.getElementById('login-email');
    if (mail) mail.placeholder = 'votre adresse e-mail';
    const h2 = document.querySelector('#login-screen .login-card h2');
    if (h2) h2.textContent = 'Connexion à mon espace';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(go, 0)); else setTimeout(go, 0);
})();
