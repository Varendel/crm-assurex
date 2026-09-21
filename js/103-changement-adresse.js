// ═══ LE CHANGEMENT D'ADRESSE (20.09.2026) ══════════════════════════════════════════════════════
// « Ajoute changement d'adresses. »
//
// Un déménagement touche TOUS les contrats à la fois, et c'est l'événement qui fait le plus bouger
// un portefeuille : la RC ménage dépend de la commune, la LAMal de la région de prime, la casco du
// lieu de stationnement, et l'inventaire du ménage de la surface. Aujourd'hui il arrive par
// téléphone, souvent après coup — et une adresse annoncée en retard, c'est une couverture qui a
// porté sur le mauvais logement pendant des semaines.
//
// LA DEMANDE N'ÉCRIT PAS DANS LA FICHE. Elle la propose, et le courtier applique. Deux raisons :
//   · l'adresse de la fiche sert aux courriers et aux mandats ; une faute de frappe depuis
//     l'espace client casserait des envois sans que personne ne le voie ;
//   · seul le courtier peut annoncer le changement aux compagnies, et c'est ce geste-là qui
//     protège le client. Valider la demande et prévenir les assureurs doivent rester le même
//     mouvement — sinon la fiche est juste et les polices sont fausses.
//
// L'ancienne adresse est recopiée au dépôt : une fois la fiche mise à jour, plus rien ne dirait
// ce qui a changé ni depuis quand.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de index.html (ce fichier + 99-adresse.css).
// La table demandes_adresse reste, sans lectrice — aucune donnée n'est perdue.

function adrEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function adrIco(nom, t) { return typeof ico === 'function' ? ico(nom, t || 18) : ''; }

function adrLigne(o) {
  const l = [o && o.adresse, [o && o.npa, o && o.ville].filter(Boolean).join(' ')].filter(Boolean);
  return l.join(', ');
}

// ── Côté client : la demande ───────────────────────────────────────────────────────────────────
function adrDemandeEnCours() {
  return ((window._ec || {}).demandesAdresse || []).find(d => d.statut === 'nouvelle') || null;
}

function adrOuvrir() {
  const c = (window._ec || {}).client;
  if (!c) return;
  const v = x => adrEsc(x == null ? '' : x);
  const enCours = adrDemandeEnCours();
  if (enCours) {
    showError('Une demande de changement d’adresse est déjà en cours de traitement.');
    return;
  }
  creerModale('modal-adr', `
    <div class="opx-modale mdx-modale mdx-modale-flex adr-modale" role="dialog" aria-modal="true" aria-labelledby="adr-titre">
      <h3 id="adr-titre">Annoncer un déménagement</h3>
      <p class="adr-sous">Votre conseiller met votre dossier à jour et annonce le changement à
        chacune de vos compagnies. Vous n’avez rien d’autre à faire.</p>

      <div class="adr-avant">
        <em>Adresse actuelle</em>
        <b>${adrEsc(adrLigne(c) || 'non renseignée')}</b>
      </div>

      <div class="form-field"><label class="form-label" for="adr-rue">Nouvelle adresse</label>
        <input class="form-input" id="adr-rue" maxlength="160" placeholder="Rue et numéro" value=""/></div>
      <div class="adr-grille">
        <div class="form-field"><label class="form-label" for="adr-npa">NPA</label>
          <input class="form-input" id="adr-npa" maxlength="10" inputmode="numeric"/></div>
        <div class="form-field"><label class="form-label" for="adr-ville">Localité</label>
          <input class="form-input" id="adr-ville" maxlength="80"/></div>
        <div class="form-field"><label class="form-label" for="adr-canton">Canton <span class="mdx-optionnel">facultatif</span></label>
          <input class="form-input" id="adr-canton" maxlength="30" placeholder="VD" value="${v(c.canton)}"/></div>
      </div>
      <div class="form-field"><label class="form-label" for="adr-effet">À partir du</label>
        <input class="form-input" id="adr-effet" type="date" value=""/>
        <small class="adr-aide">La date de votre emménagement. C’est elle qui fixe le jour où vos
          couvertures suivent — une date approximative vaut mieux qu’une case vide.</small></div>
      <div class="form-field"><label class="form-label" for="adr-remarque">Précisions <span class="mdx-optionnel">facultatif</span></label>
        <textarea class="form-input" id="adr-remarque" rows="3" maxlength="1000"
          placeholder="Changement de canton, nouveau garage, surface différente…"></textarea></div>

      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-adr').remove()">Annuler</button>
        <button type="button" class="btn-save" id="adr-envoi" onclick="adrEnvoyer()">Transmettre</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
}

async function adrEnvoyer() {
  const c = (window._ec || {}).client;
  if (!c) return;
  const t = id => (document.getElementById(id)?.value || '').trim();
  const rue = t('adr-rue'), npa = t('adr-npa'), ville = t('adr-ville');
  // Une adresse sans rue ni localité ne dit rien : le courtier ne saurait ni quoi écrire dans la
  // fiche, ni quoi annoncer aux compagnies.
  if (!rue || !ville) { showError('Indiquez au moins la rue et la localité.'); return; }

  const btn = document.getElementById('adr-envoi');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  const ligne = {
    client_id: c.id,
    adresse: rue, npa: npa || null, ville, canton: t('adr-canton') || null,
    date_effet: t('adr-effet') || null,
    ancienne: adrLigne(c) || null,
    remarque: t('adr-remarque') || null,
    statut: 'nouvelle',
  };
  const r = await dbPost('demandes_adresse', ligne);
  if (r && r.error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Transmettre'; }
    showError('La demande n’a pas pu être enregistrée — réessayez dans un instant.');
    return;
  }
  document.getElementById('modal-adr')?.remove();
  showError('✓ Demande transmise. Votre conseiller met à jour vos contrats.');
  window._ec.demandesAdresse = [{ ...ligne, created_at: new Date().toISOString() }, ...(window._ec.demandesAdresse || [])];
  if (typeof ecRendre === 'function') ecRendre();
}

// La tuile, posée à côté de « Demander un document » : les deux sont des demandes, elles vont
// ensemble.
function adrTuileHtml() {
  const enCours = adrDemandeEnCours();
  if (enCours) {
    return `<div class="ec-tuile adr-tuile-encours">
      <span>${adrIco('horloge', 22)}</span>
      <b>Changement d’adresse en cours</b>
      <small>Demandé le ${typeof fmtDate === 'function' ? fmtDate((enCours.created_at || '').slice(0, 10)) : ''} — votre conseiller s’en occupe.</small>
    </div>`;
  }
  return `<button type="button" class="ec-tuile" onclick="adrOuvrir()">
    <span>${adrIco('habitation', 22)}</span>
    <b>Annoncer un déménagement</b>
    <small>Vos contrats suivent : nous prévenons chaque compagnie</small>
  </button>`;
}

// ── Côté cabinet : ce qui attend d'être appliqué ───────────────────────────────────────────────
function adrEnAttente() {
  return ((window._mc || {}).adresses || (typeof _mc !== 'undefined' ? _mc.adresses : null) || [])
    .filter(d => d.statut === 'nouvelle');
}

function adrCarteCabinet() {
  const liste = adrEnAttente();
  if (!liste.length) return '';
  const nom = id => (typeof mcNomClient === 'function' ? mcNomClient(id) : 'Client');
  return `<section class="dbx-carte adr-cabinet">
    <header class="dbx-carte-tete">
      <h2>Changements d’adresse</h2>
      <span class="dbx-carte-sous">${liste.length} à traiter</span>
    </header>
    <p class="adr-rappel">Mettre la fiche à jour ne suffit pas : chaque compagnie doit être
      avisée, sinon la police continue de porter l’ancien domicile.</p>
    <div class="adr-liste">${liste.map(d => `<article class="adr-item">
      <div class="adr-item-qui">
        <b>${adrEsc(nom(d.client_id))}</b>
        <small>demandé le ${typeof fmtDate === 'function' ? fmtDate((d.created_at || '').slice(0, 10)) : ''}${d.date_effet ? ` · effet au ${fmtDate(d.date_effet)}` : ' · sans date d’effet'}</small>
      </div>
      <div class="adr-item-chg">
        <span class="adr-avant-txt">${adrEsc(d.ancienne || 'adresse inconnue')}</span>
        <span class="adr-fleche" aria-hidden="true">${adrIco('fleche', 16)}</span>
        <span class="adr-apres">${adrEsc([d.adresse, [d.npa, d.ville].filter(Boolean).join(' '), d.canton].filter(Boolean).join(', '))}</span>
      </div>
      ${d.remarque ? `<p class="adr-item-note">${adrEsc(d.remarque)}</p>` : ''}
      <div class="adr-item-actions">
        <button type="button" class="btn-save" onclick="adrAppliquer('${d.id}')">Appliquer à la fiche</button>
        <button type="button" class="btn-secondary" onclick="adrEcarter('${d.id}')">Écarter</button>
      </div>
    </article>`).join('')}</div>
  </section>`;
}

async function adrAppliquer(id) {
  const d = (_mc.adresses || []).find(x => x.id === id);
  if (!d) return;
  const apres = [d.adresse, [d.npa, d.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  if (!confirm(`Remplacer l’adresse de la fiche par :\n\n${apres}\n\nL’ancienne (${d.ancienne || 'inconnue'}) reste consignée dans la demande.\n\nPensez à annoncer le changement aux compagnies concernées.`)) return;

  const maj = { adresse: d.adresse, npa: d.npa, ville: d.ville };
  if (d.canton) maj.canton = d.canton;
  const r1 = await dbPatch('clients', d.client_id, maj);
  if (r1 && r1.error) { showError('Mise à jour de la fiche impossible : ' + errMsg(r1)); return; }

  const r2 = await dbPatch('demandes_adresse', id, {
    statut: 'traitee', traite_le: new Date().toISOString(),
    traite_par: (typeof currentUserEmail === 'function' ? currentUserEmail() : null),
  });
  if (r2 && r2.error) { showError('Fiche mise à jour, mais la demande n’a pas pu être clôturée.'); }

  // La liste en mémoire suit, sinon la carte réafficherait une demande déjà traitée.
  d.statut = 'traitee';
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === d.client_id);
  if (c) Object.assign(c, maj);
  showError('✓ Fiche mise à jour. Reste à prévenir les compagnies.');
  if (typeof navigate === 'function') navigate('messages-clients', { silent: true });
}

async function adrEcarter(id) {
  if (!confirm('Écarter cette demande ? La fiche client n’est pas modifiée.')) return;
  const r = await dbPatch('demandes_adresse', id, { statut: 'refusee', traite_le: new Date().toISOString() });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  const d = (_mc.adresses || []).find(x => x.id === id);
  if (d) d.statut = 'refusee';
  if (typeof navigate === 'function') navigate('messages-clients', { silent: true });
}

// ── Les branchements ───────────────────────────────────────────────────────────────────────────
(function adrBrancher() {
  // Côté client : charger ses demandes avec le reste de ses services.
  if (typeof ecChargerServices === 'function') {
    const origine = ecChargerServices;
    window.ecChargerServices = async function () {
      const r = await origine.apply(this, arguments);
      const E = window._ec;
      if (E && E.client && E.demandesAdresse === undefined) {
        E.demandesAdresse = await dbGet('demandes_adresse',
          `client_id=eq.${E.client.id}&select=*&order=created_at.desc`).catch(() => []) || [];
        if (typeof ecRendre === 'function') ecRendre();
      }
      return r;
    };
  }

  // Côté client : poser la tuile juste avant « Demander un document ».
  if (typeof ecVueEspaceClient === 'function') {
    const origine = ecVueEspaceClient;
    const MARQUE = '<button type="button" class="ec-tuile" onclick="ecOuvrirDemandeDocument()">';
    window.ecVueEspaceClient = function () {
      const html = origine.apply(this, arguments);
      if (!(window._ec || {}).client) return html;
      const i = html.indexOf(MARQUE);
      if (i < 0) return html;
      return html.slice(0, i) + adrTuileHtml() + html.slice(i);
    };
  }

  // Côté cabinet : charger les demandes avec les autres messages, et poser la carte en tête —
  // après le tableau de bord, avant les onglets. Un déménagement se traite le jour même : il ne
  // peut pas attendre dans un onglet qu'on ouvre une fois par semaine.
  if (typeof mcCharger === 'function') {
    const origine = mcCharger;
    window.mcCharger = async function (forcer) {
      const r = await origine.apply(this, arguments);
      if (typeof _mc !== 'undefined' && (!_mc.adresses || forcer)) {
        _mc.adresses = await dbGet('demandes_adresse', 'select=*&order=created_at.desc&limit=200').catch(() => []) || [];
      }
      return r;
    };
  }

  if (typeof viewMessagesClients === 'function') {
    const origine = viewMessagesClients;
    const MARQUE = '<div class="mcx-onglets"';
    window.viewMessagesClients = function () {
      const html = origine.apply(this, arguments);
      const carte = adrCarteCabinet();
      if (!carte) return html;
      const i = html.indexOf(MARQUE);
      if (i < 0) return html + carte;
      return html.slice(0, i) + carte + html.slice(i);
    };
  }
})();
