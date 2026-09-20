// ═══ REX CLOUD : navigation et services de l'espace client (20.09.2026) ═══════════════════════
// Le client ne doit pas avoir à écrire un e-mail pour tout : depuis son espace il consulte ses
// contrats classés par type, déclare un sinistre, demande un document, écrit à son conseiller
// avec un motif, et retrouve les coordonnées de ce conseiller.
// Ce fichier remplace la vue de js/48 (chargé après lui) et ajoute les formulaires correspondants.
// Rien n'est envoyé par e-mail d'ici : tout arrive dans REX CRM, où le courtier traite et répond.

const EC_CONSEILLER_DEFAUT = { nom: 'Jonathan Özkan', role: 'Directeur associé · spécialiste assurances & prévoyance',
  email: 'jo@cofidex.ch', tel: '+41 79 101 99 26', agrement: 'Certifié AFA · Agréé FINMA F01492173' };

const EC_ONGLETS = [
  { id: 'accueil', icone: '🏠', label: 'Mon espace' },
  { id: 'contrats', icone: '📄', label: 'Mes contrats' },
  { id: 'sinistres', icone: '🛟', label: 'Mes sinistres' },
  { id: 'demandes', icone: '📬', label: 'Mes demandes' },
  { id: 'conseiller', icone: '👤', label: 'Mon conseiller' },
];

// Classement des contrats par type : on se base sur la catégorie enregistrée quand elle existe,
// sinon sur le libellé du produit — le client doit s'y retrouver, pas retrouver notre catalogue.
const EC_TYPES = [
  { id: 'vehicule', label: 'Véhicules', icone: '🚗', mots: /v[ée]hicule|auto|moto|rc\s*v|casco|flotte|scooter|camion/i },
  { id: 'habitation', label: 'Ménage et habitation', icone: '🏠', mots: /m[ée]nage|rc\s*priv|inventaire|b[âa]timent|immeuble|habitation|vol simple/i },
  { id: 'sante', label: 'Santé', icone: '🩺', mots: /lamal|maladie|sant[ée]|compl[ée]mentaire|hospital|lca|dentaire/i },
  { id: 'prevoyance', label: 'Prévoyance et épargne', icone: '🌱', mots: /3a|3b|pr[ée]voyance|vie|[ée]pargne|pilier|lpp|rente/i },
  { id: 'juridique', label: 'Protection juridique', icone: '⚖️', mots: /juridique|protection jur/i },
  { id: 'entreprise', label: 'Entreprise', icone: '🏢', mots: /laa|perte de gain|apg|entreprise|rc\s*entrepr|chose|technique|transport/i },
  { id: 'caution', label: 'Garantie de loyer', icone: '🔑', mots: /caution|garantie de loyer/i },
  { id: 'autre', label: 'Autres contrats', icone: '📁', mots: null },
];

const EC_TYPES_SINISTRE = ['Accident de véhicule', 'Bris de glace', 'Vol ou cambriolage', 'Dégât des eaux', 'Incendie',
  'Dommage causé à un tiers (RC)', 'Dégât matériel', 'Accident de personne', 'Maladie ou hospitalisation', 'Autre'];

const EC_TYPES_DOCUMENT = ['Copie de ma police', 'Attestation d’assurance', 'Carte verte / attestation véhicule',
  'Attestation pour les impôts (3e pilier)', 'Attestation LAMal ou subside', 'Bulletins de versement',
  'Décompte de prestations', 'Conditions générales', 'Autre document'];

const EC_MOTIFS = [
  { v: 'question', l: 'Question sur un contrat', contrat: true },
  { v: 'prime', l: 'Prime ou facture', contrat: true },
  { v: 'modification', l: 'Modifier mon contrat', contrat: true },
  { v: 'resiliation', l: 'Résilier / changer de compagnie', contrat: true },
  { v: 'offre', l: 'Demander une offre', contrat: false },
  { v: 'coordonnees', l: 'Changement d’adresse ou de coordonnées', contrat: false },
  { v: 'rendez_vous', l: 'Prendre rendez-vous', contrat: false },
  { v: 'autre', l: 'Autre sujet', contrat: false },
];

let _ecUI = { onglet: 'accueil' };

function ecTypeContrat(ct) {
  const texte = `${ct.categorie || ''} ${ct.produit || ''} ${ct.modules || ''}`;
  return (EC_TYPES.find(t => t.mots && t.mots.test(texte)) || EC_TYPES[EC_TYPES.length - 1]).id;
}
function ecContratsActifs() {
  return ((window._ec || {}).contrats || []).filter(ct => ['actif', 'renouveler', 'en_cours'].includes(ct.statut));
}
function ecConseiller() {
  const a = (window._ec || {}).acces || {};
  return {
    ...EC_CONSEILLER_DEFAUT,
    nom: a.conseiller_nom || EC_CONSEILLER_DEFAUT.nom,
    email: a.conseiller_email || EC_CONSEILLER_DEFAUT.email,
    tel: a.conseiller_tel || EC_CONSEILLER_DEFAUT.tel,
  };
}
function ecAllerOnglet(id) { _ecUI.onglet = id; ecRendre(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function ecRendre() {
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = ecVueEspaceClient();
}

// Chargement complémentaire (sinistres, demandes de documents, coordonnées du conseiller)
async function ecChargerServices() {
  const E = window._ec;
  if (!E || !E.client || E._servicesEnCours) return;
  E._servicesEnCours = true;
  const [sinistres, docs, acces] = await Promise.all([
    dbGet('sinistres', `client_id=eq.${E.client.id}&select=*&order=created_at.desc`).catch(() => []),
    dbGet('demandes_documents', `client_id=eq.${E.client.id}&select=*&order=created_at.desc`).catch(() => []),
    dbGet('acces_clients', `client_id=eq.${E.client.id}&select=*`).catch(() => []),
  ]);
  E.sinistres = sinistres || [];
  E.demandesDocs = docs || [];
  E.acces = (acces || [])[0] || {};
  E._servicesEnCours = false;
  ecRendre();
}

// ── La vue complète (remplace celle de js/48) ───────────────────────────────────────────────────
function ecVueEspaceClient() {
  const E = window._ec || {};
  const c = E.client;
  if (E.sinistres === undefined && !E._servicesEnCours) ecChargerServices();
  const actifs = ecContratsActifs();
  const enCoursSin = (E.sinistres || []).filter(s => !['regle', 'refuse', 'annule'].includes(s.statut)).length;
  return `<div class="dbx ec">
    <section class="cf-hero">
      <div class="cf-hero-deco" aria-hidden="true"></div>
      <div class="cf-hero-texte">
        <span class="ec-marque">${EC_NUAGE_SVG}<b>REX</b> CLOUD</span>
        <span class="cf-surtitre">Mon espace assurances</span>
        <h1>${ecEsc(ecNomClient(c) || 'Bienvenue')}</h1>
        <p>Vos contrats, vos sinistres et vos demandes au même endroit. Votre conseiller reçoit tout directement.</p>
      </div>
      <div class="cf-hero-actions">
        <div class="cf-boutons">
          <button type="button" class="fcx-btn-blanc" onclick="ecOuvrirTransfert()">🤝 Transférer la gestion de mes assurances <small>appuyez pour plus d’infos — service gratuit</small></button>
          <button type="button" class="fcx-btn-verre" onclick="ecOuvrirSinistre()">🛟 Déclarer un sinistre</button>
          <button type="button" class="fcx-btn-verre" onclick="ecDeconnexion()">Se déconnecter</button>
        </div>
      </div>
    </section>

    <nav class="ec-onglets" role="tablist" aria-label="Sections de mon espace">
      ${EC_ONGLETS.map(o => `<button type="button" role="tab" class="${_ecUI.onglet === o.id ? 'actif' : ''}" aria-selected="${_ecUI.onglet === o.id}" onclick="ecAllerOnglet('${o.id}')">
        <span aria-hidden="true">${o.icone}</span>${ecEsc(o.label)}${o.id === 'sinistres' && enCoursSin ? `<em>${enCoursSin}</em>` : ''}</button>`).join('')}
    </nav>

    ${_ecUI.onglet === 'accueil' ? ecOngletAccueil()
      : _ecUI.onglet === 'contrats' ? ecOngletContrats()
      : _ecUI.onglet === 'sinistres' ? ecOngletSinistres()
      : _ecUI.onglet === 'demandes' ? ecOngletDemandes()
      : ecOngletConseiller()}

    <div class="ec-pied">${(E.mandats || []).length ? `Mandat de courtage signé le ${fmtDate((E.mandats[0].created_at || '').slice(0, 10))} · ` : ''}${EC_MARQUE} — Agrément FINMA F01565757
      <div class="ec-signature sombre"><span style="font-size:11px">by</span><img src="assets/logos/assurex.png" alt="Assurex"/>${typeof LOGO_EXGROUPE_SVG !== 'undefined' ? `<span style="display:inline-flex;height:16px">${LOGO_EXGROUPE_SVG}</span>` : ''}</div>
    </div>
  </div>`;
}

function ecOngletAccueil() {
  const E = window._ec || {};
  const actifs = ecContratsActifs();
  const prime = actifs.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
  const prochains = (E.rdv || []).filter(r => r.date_heure && r.date_heure >= new Date().toISOString() && r.statut !== 'annule');
  const auj = new Date().toISOString().slice(0, 10);
  const dans120 = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  const aSurveiller = actifs.filter(ct => { const l = ecDateLimiteResiliation(ct); return l && l >= auj && l <= dans120; });
  return `
    <div class="dbx-kpis" style="margin-top:16px">
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 0, label: 'Contrats en vigueur', valeur: actifs.length, sous: `${(E.vehicules || []).length} véhicule(s) assuré(s)` }) : ''}
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 1, label: 'Primes annuelles', valeur: prime, prefixe: 'CHF ', sous: 'total de vos contrats en vigueur' }) : ''}
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 2, label: 'Échéances à surveiller', valeur: aSurveiller.length, sous: aSurveiller.length ? 'résiliation possible dans les 4 mois' : 'rien dans les 4 prochains mois' }) : ''}
    </div>

    <section class="dbx-carte ec-services" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Que souhaitez-vous faire ?</h2></header>
      <div class="ec-tuiles">
        <button type="button" class="ec-tuile" onclick="ecOuvrirSinistre()"><span>🛟</span><b>Déclarer un sinistre</b><small>Nous l’annonçons à votre assureur et suivons la prise en charge</small></button>
        <button type="button" class="ec-tuile" onclick="ecOuvrirMessage()"><span>💬</span><b>Contacter mon conseiller</b><small>Une question sur un contrat, une prime, un changement</small></button>
        <button type="button" class="ec-tuile" onclick="ecOuvrirDemandeDocument()"><span>📄</span><b>Demander un document</b><small>Police, attestation, carte verte, bulletins de versement</small></button>
        <button type="button" class="ec-tuile" onclick="ecAllerOnglet('contrats')"><span>🗂️</span><b>Voir mes contrats par type</b><small>Véhicules, santé, ménage, prévoyance…</small></button>
      </div>
    </section>

    ${ecCarteTransfert()}

    ${prochains.length ? `<section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Mes rendez-vous</h2></header>
      <div class="sfx-liste">${prochains.map(r => `<div class="sfx-ligne"><span class="sfx-corps"><b>${ecEsc(r.type || 'Rendez-vous')}</b><small>${ecEsc(r.lieu || r.mode || '')}</small></span><span class="ck-date">${fmtDate(r.date_heure.slice(0, 10))} ${r.date_heure.slice(11, 16)}</span></div>`).join('')}</div>
    </section>` : ''}

    ${(E.vehicules || []).length ? `<section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Mes véhicules</h2></header>
      <div class="ec-vehicules">${E.vehicules.map(v => `<span class="ec-vehicule"><b>${ecEsc([v.marque, v.modele].filter(Boolean).join(' ') || v.type_vehicule || 'Véhicule')}</b>${v.numero_plaque ? `<em>${ecEsc(v.numero_plaque)}</em>` : ''}</span>`).join('')}</div>
    </section>` : ''}`;
}

function ecOngletContrats() {
  const actifs = ecContratsActifs();
  const auj = new Date().toISOString().slice(0, 10);
  const dans120 = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  if (!actifs.length) return '<section class="dbx-carte" style="margin-top:18px"><div class="dbx-vide-petit">Aucun contrat en vigueur pour l’instant.</div></section>';
  return EC_TYPES.map(t => {
    const liste = actifs.filter(ct => ecTypeContrat(ct) === t.id);
    if (!liste.length) return '';
    const total = liste.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
    return `<section class="dbx-carte" style="margin-top:18px">
      <header class="dbx-carte-tete"><h2><span aria-hidden="true">${t.icone}</span> ${ecEsc(t.label)}</h2>
        <span class="dbx-carte-sous">${liste.length} contrat${liste.length > 1 ? 's' : ''}${total ? ` · CHF ${fmtCHF(Math.round(total))}/an` : ''}</span></header>
      <div class="ec-contrats">${liste.map(ct => {
        const limite = ecDateLimiteResiliation(ct);
        const bientot = limite && limite >= auj && limite <= dans120;
        return `<article class="ec-contrat">
          <span class="ec-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 34) : ''}</span>
          <div class="ec-corps">
            <b>${ecEsc(ct.produit || 'Contrat')}</b>
            <small>${ecEsc(ct.compagnie || '')}${ct.numero_police ? ` · police ${ecEsc(ct.numero_police)}` : ''}</small>
            ${ct.modules ? `<small class="ec-modules">${ecEsc(ct.modules)}</small>` : ''}
          </div>
          <div class="ec-dates">
            ${ct.date_debut ? `<span>Depuis le ${fmtDate(ct.date_debut)}</span>` : ''}
            ${ct.date_echeance ? `<span>Échéance ${fmtDate(ct.date_echeance)}</span>` : '<span>Sans échéance</span>'}
            ${limite ? `<span class="${bientot ? 'ec-alerte' : ''}">Résiliation jusqu’au ${fmtDate(limite)}</span>` : ''}
          </div>
          <div class="ec-prime">${ct.prime_annuelle ? `CHF ${fmtCHF(Math.round(ct.prime_annuelle))}<small>/an</small>` : '—'}</div>
          <div class="ec-actions-contrat">
            <button type="button" onclick="ecOuvrirMessage('${ct.id}')">💬 Contacter mon conseiller</button>
            <button type="button" onclick="ecOuvrirSinistre('${ct.id}')">🛟 Déclarer un sinistre</button>
            <button type="button" onclick="ecOuvrirDemandeDocument('${ct.id}')">📄 Demander un document</button>
          </div>
        </article>`;
      }).join('')}</div>
    </section>`;
  }).join('');
}

const EC_ETATS_SINISTRE = { declare: 'Déclaré', transmis: 'Transmis à l’assureur', en_cours: 'En cours de traitement',
  regle: 'Réglé', refuse: 'Refusé', annule: 'Annulé' };

function ecOngletSinistres() {
  const E = window._ec || {};
  const liste = E.sinistres || [];
  return `<section class="dbx-carte" style="margin-top:18px">
      <header class="dbx-carte-tete"><h2>Mes sinistres</h2>
        <button type="button" class="btn-save" onclick="ecOuvrirSinistre()">🛟 Déclarer un sinistre</button></header>
      <p class="ec-suivi-txt">Annoncez-nous le sinistre : nous l’enregistrons auprès de votre assureur et revenons vers vous avec la prise en charge. En cas d’urgence vitale ou de vol, prévenez d’abord la police ou les secours.</p>
      ${liste.length ? `<div class="ec-sinistres">${liste.map(s => {
        const ct = (E.contrats || []).find(x => x.id === s.contrat_id);
        return `<article class="ec-sinistre ${s.statut}">
          <div class="ec-sin-tete"><b>${ecEsc(s.type_sinistre || 'Sinistre')}</b>
            <span class="ec-sin-etat">${EC_ETATS_SINISTRE[s.statut] || s.statut}</span></div>
          <small>${s.date_sinistre ? 'Survenu le ' + fmtDate(s.date_sinistre) : ''}${s.lieu ? ' · ' + ecEsc(s.lieu) : ''}${ct ? ' · ' + ecEsc(ct.produit || '') + (ct.compagnie ? ' (' + ecEsc(ct.compagnie) + ')' : '') : ''}</small>
          <p>${ecEsc(s.description || '')}</p>
          ${s.reference_assureur ? `<small class="ec-sin-ref">Référence assureur : ${ecEsc(s.reference_assureur)}</small>` : ''}
          <small class="ec-sin-date">Déclaré le ${fmtDate((s.created_at || '').slice(0, 10))}</small>
        </article>`;
      }).join('')}</div>` : '<div class="dbx-vide-petit">Aucun sinistre déclaré — tant mieux.</div>'}
    </section>`;
}

function ecOngletDemandes() {
  const E = window._ec || {};
  const docs = E.demandesDocs || [];
  const msgs = E.messages || [];
  const etats = { nouvelle: 'Reçue', en_cours: 'En cours', envoye: 'Envoyé', refuse: 'Non disponible' };
  return `<section class="dbx-carte" style="margin-top:18px">
      <header class="dbx-carte-tete"><h2>Mes demandes de documents</h2>
        <button type="button" class="btn-save" onclick="ecOuvrirDemandeDocument()">📄 Demander un document</button></header>
      ${docs.length ? `<div class="sfx-liste">${docs.map(d => {
        const ct = (E.contrats || []).find(x => x.id === d.contrat_id);
        return `<div class="sfx-ligne"><span class="sfx-corps"><b>${ecEsc(d.type_document)}</b>
          <small>${ct ? ecEsc(ct.produit || '') + (ct.compagnie ? ' · ' + ecEsc(ct.compagnie) : '') : 'Sans contrat précis'}${d.precisions ? ' — ' + ecEsc(d.precisions.slice(0, 120)) : ''}</small></span>
          <span class="ck-date">${etats[d.statut] || d.statut} · ${fmtDate((d.created_at || '').slice(0, 10))}</span></div>`;
      }).join('')}</div>` : '<div class="dbx-vide-petit">Aucune demande en cours.</div>'}
    </section>

    <section class="dbx-carte" style="margin-top:18px">
      <header class="dbx-carte-tete"><h2>Mes messages</h2>
        <button type="button" class="btn-save" onclick="ecOuvrirMessage()">💬 Contacter mon conseiller</button></header>
      ${msgs.length ? `<div class="sfx-liste">${msgs.map(m => `<div class="sfx-ligne"><span class="sfx-corps"><b>${ecEsc(m.sujet || 'Message')}</b>
        <small>${ecEsc((m.message || '').slice(0, 140))}${(m.message || '').length > 140 ? '…' : ''}</small>
        ${m.reponse ? `<small class="ec-reponse">Réponse : ${ecEsc(m.reponse.slice(0, 200))}</small>` : ''}</span>
        <span class="ck-date">${m.statut === 'traite' ? '✓ traité' : m.statut === 'lu' ? 'lu' : 'transmis'} · ${fmtDate((m.created_at || '').slice(0, 10))}</span></div>`).join('')}</div>`
        : '<div class="dbx-vide-petit">Aucun message pour l’instant.</div>'}
    </section>`;
}

function ecOngletConseiller() {
  const co = ecConseiller();
  return `<section class="dbx-carte ec-conseiller" style="margin-top:18px">
      <header class="dbx-carte-tete"><h2>Mon conseiller</h2></header>
      <div class="ec-co-carte">
        <div class="ec-co-ident">
          <span class="ec-co-initiales" aria-hidden="true">${ecEsc((co.nom || '?').split(/\s+/).map(m => m[0]).join('').slice(0, 2).toUpperCase())}</span>
          <div><b>${ecEsc(co.nom)}</b><small>${ecEsc(co.role)}</small><small>${ecEsc(co.agrement)}</small></div>
        </div>
        <div class="ec-co-liens">
          <a href="tel:${ecEsc((co.tel || '').replace(/\s/g, ''))}">📞 ${ecEsc(co.tel)}</a>
          <a href="mailto:${ecEsc(co.email)}">✉️ ${ecEsc(co.email)}</a>
        </div>
        <div class="ec-co-actions">
          <button type="button" class="btn-save" onclick="ecOuvrirMessage()">💬 Lui écrire depuis mon espace</button>
          <button type="button" class="btn-secondary" onclick="ecOuvrirMessageMotif('rendez_vous')">📅 Demander un rendez-vous</button>
        </div>
        <p class="ec-suivi-txt">Assurex Sàrl — Rue du Centre 142, 1025 St-Sulpice · succursale c/o Cofidex SA, Ch. de Pallud 3, 1822 Chernex. Écrire depuis l’espace garde l’échange rattaché à votre dossier.</p>
      </div>
    </section>`;
}

// ── Contacter mon conseiller, avec motif (remplace la version simple de js/51) ──────────────────
function ecOuvrirMessageMotif(motif, contratId) { ecOuvrirMessage(contratId, motif); }

function ecOuvrirMessage(contratId, motifInitial) {
  const E = window._ec || {};
  const ct = (E.contrats || []).find(x => x.id === contratId) || null;
  const contrats = ecContratsActifs();
  creerModale('modal-ec-message', `
    <div class="opx-modale mdx-modale mdx-modale-flex" role="dialog" aria-modal="true" aria-labelledby="ec-msg-titre">
      ${typeof mdxTeteModale === 'function' ? mdxTeteModale('💬', 'Contacter mon conseiller', 'Indiquez le motif : votre message arrive classé dans votre dossier, votre conseiller vous répond par e-mail.', 'modal-ec-message', 'ec-msg-titre') : '<h3 id="ec-msg-titre">Contacter mon conseiller</h3>'}
      <div class="form-field"><label class="form-label" for="ec-msg-motif">Motif</label>
        <select class="form-select" id="ec-msg-motif" onchange="ecMsgMajMotif()">
          ${EC_MOTIFS.map(m => `<option value="${m.v}" ${m.v === (motifInitial || (ct ? 'question' : 'autre')) ? 'selected' : ''}>${ecEsc(m.l)}</option>`).join('')}
        </select></div>
      <div class="form-field"><label class="form-label" for="ec-msg-contrat">Contrat concerné</label>
        <select class="form-select" id="ec-msg-contrat">
          <option value="">Aucun contrat en particulier</option>
          ${contrats.map(x => `<option value="${x.id}" ${ct && ct.id === x.id ? 'selected' : ''}>${ecEsc(x.produit || 'Contrat')} — ${ecEsc(x.compagnie || '')}${x.numero_police ? ' (' + ecEsc(x.numero_police) + ')' : ''}</option>`).join('')}
        </select>
        <small class="mdx-aide" id="ec-msg-aide"></small></div>
      <div class="form-field"><label class="form-label" for="ec-msg-sujet">Objet</label>
        <input class="form-input" id="ec-msg-sujet" maxlength="200"/></div>
      <div class="form-field mdx-champ-corps"><label class="form-label" for="ec-msg-texte">Votre message</label>
        <textarea class="form-input" id="ec-msg-texte" rows="7" maxlength="5000" placeholder="Décrivez votre demande…"></textarea></div>
      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-ec-message').remove()">Annuler</button>
        <button type="button" class="btn-save" id="ec-msg-envoi" onclick="ecEnvoyerMessage()">Envoyer à mon conseiller</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
  ecMsgMajMotif();
  setTimeout(() => document.getElementById('ec-msg-texte')?.focus(), 60);
}

function ecMsgMajMotif() {
  const m = EC_MOTIFS.find(x => x.v === (document.getElementById('ec-msg-motif')?.value || '')) || EC_MOTIFS[0];
  const aide = document.getElementById('ec-msg-aide');
  if (aide) aide.textContent = m.contrat ? 'Choisissez le contrat concerné pour que nous répondions précisément.' : 'Facultatif pour ce motif.';
  const s = document.getElementById('ec-msg-sujet');
  const ct = ecContratsActifs().find(x => x.id === (document.getElementById('ec-msg-contrat')?.value || ''));
  if (s && !s.dataset.modifie) s.value = `${m.l}${ct ? ' — ' + (ct.produit || '') : ''}`.slice(0, 200);
  if (s && !s.dataset.ecoute) { s.dataset.ecoute = '1'; s.addEventListener('input', () => { s.dataset.modifie = '1'; }); }
}

async function ecEnvoyerMessage() {
  const c = (window._ec || {}).client;
  if (!c) return;
  const texte = (document.getElementById('ec-msg-texte')?.value || '').trim();
  if (texte.length < 5) { showError('Votre message est un peu court — précisez votre demande.'); return; }
  const motif = EC_MOTIFS.find(x => x.v === (document.getElementById('ec-msg-motif')?.value || '')) || EC_MOTIFS[0];
  const contratId = document.getElementById('ec-msg-contrat')?.value || null;
  if (motif.contrat && !contratId) { showError('Choisissez le contrat concerné (ou changez de motif).'); return; }
  const btn = document.getElementById('ec-msg-envoi');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  const ligne = {
    client_id: c.id, contrat_id: contratId || null, motif: motif.v,
    sujet: (document.getElementById('ec-msg-sujet')?.value || motif.l).slice(0, 200),
    message: texte.slice(0, 5000), canal: 'espace_client', statut: 'nouveau',
  };
  const r = await dbPost('messages_clients', ligne);
  if (r && r.error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Envoyer à mon conseiller'; }
    showError('Votre message n’a pas pu être envoyé — réessayez dans un instant.');
    return;
  }
  document.getElementById('modal-ec-message')?.remove();
  showError('✓ Message transmis à votre conseiller.');
  window._ec.messages = [{ ...ligne, created_at: new Date().toISOString() }, ...(window._ec.messages || [])];
  ecRendre();
}

// ── Déclarer un sinistre ────────────────────────────────────────────────────────────────────────
function ecOuvrirSinistre(contratId) {
  const contrats = ecContratsActifs();
  const auj = new Date().toISOString().slice(0, 10);
  creerModale('modal-ec-sinistre', `
    <div class="opx-modale mdx-modale mdx-modale-flex mdx-modale-large" role="dialog" aria-modal="true" aria-labelledby="ec-sin-titre">
      ${typeof mdxTeteModale === 'function' ? mdxTeteModale('🛟', 'Déclarer un sinistre', 'Nous annonçons le sinistre à votre assureur et revenons vers vous avec la prise en charge.', 'modal-ec-sinistre', 'ec-sin-titre') : '<h3 id="ec-sin-titre">Déclarer un sinistre</h3>'}
      <div class="mdx-alerte">⚠️ <span>En cas d’urgence (blessés, incendie, vol en cours), appelez d’abord les secours ou la police, puis déclarez ici.</span></div>
      <div class="ec-deux">
        <div class="form-field"><label class="form-label" for="ec-sin-contrat">Contrat concerné</label>
          <select class="form-select" id="ec-sin-contrat">
            <option value="">Je ne sais pas / autre</option>
            ${contrats.map(x => `<option value="${x.id}" ${x.id === contratId ? 'selected' : ''}>${ecEsc(x.produit || 'Contrat')} — ${ecEsc(x.compagnie || '')}${x.numero_police ? ' (' + ecEsc(x.numero_police) + ')' : ''}</option>`).join('')}
          </select></div>
        <div class="form-field"><label class="form-label" for="ec-sin-type">Type de sinistre</label>
          <select class="form-select" id="ec-sin-type">${EC_TYPES_SINISTRE.map(t => `<option>${ecEsc(t)}</option>`).join('')}</select></div>
      </div>
      <div class="ec-deux">
        <div class="form-field"><label class="form-label" for="ec-sin-date">Date du sinistre</label>
          <input class="form-input" type="date" id="ec-sin-date" max="${auj}" value="${auj}"/></div>
        <div class="form-field"><label class="form-label" for="ec-sin-lieu">Lieu</label>
          <input class="form-input" id="ec-sin-lieu" maxlength="200" placeholder="Adresse, localité"/></div>
      </div>
      <div class="form-field mdx-champ-corps"><label class="form-label" for="ec-sin-desc">Que s’est-il passé ?</label>
        <textarea class="form-input" id="ec-sin-desc" rows="6" maxlength="5000" placeholder="Décrivez les circonstances, les dégâts constatés…"></textarea></div>
      <div class="ec-deux">
        <div class="form-field"><label class="form-label" for="ec-sin-tiers">Tiers impliqué <span class="mdx-optionnel">facultatif</span></label>
          <input class="form-input" id="ec-sin-tiers" maxlength="1000" placeholder="Nom, plaque, assurance du tiers, n° de constat"/></div>
        <div class="form-field"><label class="form-label" for="ec-sin-montant">Dommage estimé (CHF) <span class="mdx-optionnel">facultatif</span></label>
          <input class="form-input" type="number" step="50" id="ec-sin-montant"/></div>
      </div>
      <p class="ec-suivi-txt">Photos, constat ou factures : envoyez-les par e-mail à votre conseiller, nous les joindrons au dossier.</p>
      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-ec-sinistre').remove()">Annuler</button>
        <button type="button" class="btn-save" id="ec-sin-envoi" onclick="ecEnvoyerSinistre()">Déclarer le sinistre</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
}

async function ecEnvoyerSinistre() {
  const c = (window._ec || {}).client;
  if (!c) return;
  const desc = (document.getElementById('ec-sin-desc')?.value || '').trim();
  if (desc.length < 10) { showError('Décrivez brièvement ce qui s’est passé.'); return; }
  const btn = document.getElementById('ec-sin-envoi');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  const montant = Number(document.getElementById('ec-sin-montant')?.value);
  const ligne = {
    client_id: c.id, contrat_id: document.getElementById('ec-sin-contrat')?.value || null,
    date_sinistre: document.getElementById('ec-sin-date')?.value || null,
    type_sinistre: document.getElementById('ec-sin-type')?.value || null,
    lieu: (document.getElementById('ec-sin-lieu')?.value || '').slice(0, 200) || null,
    description: desc.slice(0, 5000),
    tiers: (document.getElementById('ec-sin-tiers')?.value || '').slice(0, 1000) || null,
    montant_estime: isNaN(montant) || !montant ? null : montant,
    statut: 'declare',
  };
  const r = await dbPost('sinistres', ligne);
  if (r && r.error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Déclarer le sinistre'; }
    showError('La déclaration n’a pas pu être enregistrée — réessayez ou appelez votre conseiller.');
    return;
  }
  document.getElementById('modal-ec-sinistre')?.remove();
  showError('✓ Sinistre déclaré. Votre conseiller l’annonce à l’assureur et revient vers vous.');
  window._ec.sinistres = [{ ...ligne, created_at: new Date().toISOString() }, ...(window._ec.sinistres || [])];
  _ecUI.onglet = 'sinistres';
  ecRendre();
}

// ── Demander un document ────────────────────────────────────────────────────────────────────────
function ecOuvrirDemandeDocument(contratId) {
  const contrats = ecContratsActifs();
  creerModale('modal-ec-doc', `
    <div class="opx-modale mdx-modale mdx-modale-flex" role="dialog" aria-modal="true" aria-labelledby="ec-doc-titre">
      ${typeof mdxTeteModale === 'function' ? mdxTeteModale('📄', 'Demander un document', 'Votre conseiller vous l’envoie par e-mail, ou le demande à la compagnie si nécessaire.', 'modal-ec-doc', 'ec-doc-titre') : '<h3 id="ec-doc-titre">Demander un document</h3>'}
      <div class="form-field"><label class="form-label" for="ec-doc-type">Document souhaité</label>
        <select class="form-select" id="ec-doc-type">${EC_TYPES_DOCUMENT.map(t => `<option>${ecEsc(t)}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-label" for="ec-doc-contrat">Contrat concerné</label>
        <select class="form-select" id="ec-doc-contrat">
          <option value="">Aucun contrat en particulier</option>
          ${contrats.map(x => `<option value="${x.id}" ${x.id === contratId ? 'selected' : ''}>${ecEsc(x.produit || 'Contrat')} — ${ecEsc(x.compagnie || '')}${x.numero_police ? ' (' + ecEsc(x.numero_police) + ')' : ''}</option>`).join('')}
        </select></div>
      <div class="form-field"><label class="form-label" for="ec-doc-precisions">Précisions <span class="mdx-optionnel">facultatif</span></label>
        <textarea class="form-input" id="ec-doc-precisions" rows="4" maxlength="2000" placeholder="Année concernée, destinataire, urgence…"></textarea></div>
      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-ec-doc').remove()">Annuler</button>
        <button type="button" class="btn-save" id="ec-doc-envoi" onclick="ecEnvoyerDemandeDocument()">Envoyer la demande</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
}

async function ecEnvoyerDemandeDocument() {
  const c = (window._ec || {}).client;
  if (!c) return;
  const btn = document.getElementById('ec-doc-envoi');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  const ligne = {
    client_id: c.id, contrat_id: document.getElementById('ec-doc-contrat')?.value || null,
    type_document: (document.getElementById('ec-doc-type')?.value || 'Document').slice(0, 120),
    precisions: (document.getElementById('ec-doc-precisions')?.value || '').slice(0, 2000) || null,
    statut: 'nouvelle',
  };
  const r = await dbPost('demandes_documents', ligne);
  if (r && r.error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Envoyer la demande'; }
    showError('La demande n’a pas pu être enregistrée — réessayez dans un instant.');
    return;
  }
  document.getElementById('modal-ec-doc')?.remove();
  showError('✓ Demande transmise. Votre conseiller vous envoie le document.');
  window._ec.demandesDocs = [{ ...ligne, created_at: new Date().toISOString() }, ...(window._ec.demandesDocs || [])];
  _ecUI.onglet = 'demandes';
  ecRendre();
}
