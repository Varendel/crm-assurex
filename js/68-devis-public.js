// ═══ DEMANDE DE DEVIS — LA PAGE PUBLIQUE (20.09.2026) ══════════════════════════════════════════
// Point 4 du chantier, et la porte d'entrée du modèle économique : un inconnu laisse une demande,
// elle arrive dans le CRM comme un lead, et de là elle suit le chemin déjà construit —
// opportunité → mandat signé → demandes de polices → contrats → commissions.
//
// Trois partis pris :
//
// 1. RIEN N'EST ÉCRIT DIRECTEMENT DANS LA BASE. Le formulaire appelle une fonction serveur
//    (deposer_demande_devis) qui valide, limite le débit et n'accepte que les champs qu'elle
//    connaît. Une page publique qui insère avec la clé anonyme, c'est une table que n'importe qui
//    remplit depuis la console de son navigateur.
//
// 2. ON DEMANDE LE MINIMUM. Chaque champ ajouté fait perdre des demandes. Le besoin, le nom,
//    l'e-mail : le reste est facultatif et se complète au téléphone. C'est un formulaire de
//    premier contact, pas un dossier.
//
// 3. LE CONSENTEMENT EST EXPLICITE. Sans case cochée, pas d'envoi — et la fonction serveur le
//    revérifie de son côté. On n'a pas le droit de rappeler quelqu'un qui ne l'a pas demandé
//    (nLPD), et une case pré-cochée ne vaut pas consentement.

const DVP_BESOINS = [
  { id: 'lamal', nom: 'Assurance maladie', icone: '⚕️', pour: 'prive' },
  { id: 'menage', nom: 'Ménage & RC privée', icone: '🏠', pour: 'prive' },
  { id: 'vehicule', nom: 'Véhicule', icone: '🚗', pour: 'prive' },
  { id: '3a', nom: '3e pilier & prévoyance', icone: '🌱', pour: 'prive' },
  { id: 'immobilier', nom: 'Financement immobilier', icone: '🔑', pour: 'prive' },
  { id: 'pj', nom: 'Protection juridique', icone: '⚖️', pour: 'prive' },
  { id: 'lpp', nom: 'LPP / 2e pilier', icone: '🏛️', pour: 'entreprise' },
  { id: 'laa', nom: 'LAA & perte de gain', icone: '🦺', pour: 'entreprise' },
  { id: 'rc_entreprise', nom: 'RC entreprise', icone: '🏢', pour: 'entreprise' },
  { id: 'flotte', nom: 'Flotte de véhicules', icone: '🚚', pour: 'entreprise' },
  { id: 'choses', nom: 'Locaux & matériel', icone: '📦', pour: 'entreprise' },
  { id: 'bilan', nom: 'Bilan complet', icone: '📋', pour: 'entreprise' },
];

const DVP_STATUTS = {
  nouvelle:    { libelle: 'Nouvelle',    couleur: '#F59E0B' },
  contactee:   { libelle: 'Contactée',   couleur: '#2563EB' },
  rdv_pris:    { libelle: 'RDV pris',    couleur: '#7C3AED' },
  transformee: { libelle: 'Transformée', couleur: '#16A34A' },
  sans_suite:  { libelle: 'Sans suite',  couleur: '#94A3B8' },
  doublon:     { libelle: 'Doublon',     couleur: '#94A3B8' },
  indesirable: { libelle: 'Indésirable', couleur: '#B91C1C' },
};

window._dvp = window._dvp || { pourQui: 'prive', besoin: '', envoi: false, demandes: [], filtre: 'nouvelle' };

function dvpEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ── La page publique ────────────────────────────────────────────────────────────────────────────
// Elle s'ouvre sur ?devis (ou le sous-domaine devis.) AVANT toute connexion : c'est une page
// d'accueil, pas un écran du CRM.
function dvpEstPagePublique() {
  return /[?&]devis\b/.test(location.search) || /^devis\./.test((location.hostname || '').toLowerCase());
}

function dvpSource() {
  const p = new URLSearchParams(location.search);
  return p.get('src') || p.get('utm_source') || (document.referrer ? 'lien : ' + document.referrer.slice(0, 60) : 'direct');
}

function dvpHtml() {
  const P = window._dvp;
  const besoins = DVP_BESOINS.filter(b => b.pour === P.pourQui);
  const entreprise = P.pourQui === 'entreprise';
  return `
  <div class="dvp">
    <header class="dvp-tete">
      <img src="assets/logos/assurex-blanc.png" alt="Assurex" class="dvp-logo"/>
      <div class="dvp-accroche">
        <h1>Une demande, une réponse claire.</h1>
        <p>Dites-nous ce que vous cherchez. Nous comparons pour vous et nous revenons vers vous
           sous 24 heures ouvrables — sans engagement, et sans que cela vous coûte quoi que ce soit.</p>
      </div>
      ${typeof rexPoseHtml === 'function' ? rexPoseHtml({ taille: 160, pose: 'montre', classe: 'dvp-rex' }) : ''}
    </header>

    <form class="dvp-carte" id="dvp-form" onsubmit="event.preventDefault(); dvpEnvoyer();" autocomplete="on">
      <div class="dvp-bascule" role="tablist">
        <button type="button" role="tab" aria-selected="${!entreprise}" class="${!entreprise ? 'actif' : ''}" onclick="dvpPourQui('prive')">Pour moi</button>
        <button type="button" role="tab" aria-selected="${entreprise}" class="${entreprise ? 'actif' : ''}" onclick="dvpPourQui('entreprise')">Pour mon entreprise</button>
      </div>

      <fieldset class="dvp-besoins">
        <legend>Qu'est-ce qui vous occupe ?</legend>
        <div class="dvp-grille">
          ${besoins.map(b => `
            <button type="button" class="dvp-besoin ${P.besoin === b.nom ? 'actif' : ''}" onclick="dvpChoisir('${dvpEsc(b.nom)}')">
              <span aria-hidden="true">${b.icone}</span>${b.nom}
            </button>`).join('')}
        </div>
      </fieldset>

      <div class="dvp-lignes">
        <label class="dvp-champ dvp-court">
          <span>Civilité</span>
          <select id="dvp-civilite"><option value="">—</option><option>Madame</option><option>Monsieur</option></select>
        </label>
        <label class="dvp-champ"><span>Prénom</span><input id="dvp-prenom" autocomplete="given-name"/></label>
        <label class="dvp-champ"><span>Nom <b>*</b></span><input id="dvp-nom" autocomplete="family-name" required/></label>
      </div>

      ${entreprise ? `<label class="dvp-champ"><span>Entreprise</span><input id="dvp-entreprise" autocomplete="organization"/></label>` : ''}

      <div class="dvp-lignes">
        <label class="dvp-champ"><span>E-mail <b>*</b></span><input id="dvp-email" type="email" autocomplete="email" required/></label>
        <label class="dvp-champ"><span>Téléphone</span><input id="dvp-telephone" type="tel" autocomplete="tel" placeholder="079 000 00 00"/></label>
      </div>

      <div class="dvp-lignes">
        <label class="dvp-champ dvp-court"><span>NPA</span><input id="dvp-npa" autocomplete="postal-code" inputmode="numeric"/></label>
        <label class="dvp-champ"><span>Localité</span><input id="dvp-ville" autocomplete="address-level2"/></label>
      </div>

      <label class="dvp-champ"><span>Votre situation en deux mots</span>
        <textarea id="dvp-message" rows="3" placeholder="Ex. : je change de caisse au 1er janvier, deux enfants, franchise 2500."></textarea></label>

      <!-- Le champ-piège. Invisible et hors du parcours au clavier : un humain ne le voit jamais,
           un robot le remplit. La fonction serveur rejette alors la demande sans rien dire. -->
      <div class="dvp-piege" aria-hidden="true">
        <label>Ne pas remplir<input id="dvp-piege" type="text" tabindex="-1" autocomplete="off"/></label>
      </div>

      <label class="dvp-accord">
        <input type="checkbox" id="dvp-consentement"/>
        <span>J'accepte qu'Assurex Sàrl me recontacte au sujet de cette demande et conserve ces
          informations pour y répondre. Je peux demander leur suppression à tout moment.</span>
      </label>

      <div id="dvp-erreur" class="dvp-erreur" hidden></div>
      <button type="submit" class="dvp-envoyer" id="dvp-envoyer">Envoyer ma demande</button>
      <p class="dvp-pied">Assurex Sàrl · Rue du Centre 142, 1025 St-Sulpice · 079 101 99 26 ·
        inscrite au registre FINMA des intermédiaires d'assurance non liés.</p>
    </form>
  </div>`;
}

function dvpPourQui(v) {
  window._dvp.pourQui = v;
  window._dvp.besoin = '';
  dvpRedessiner();
}
function dvpChoisir(nom) {
  window._dvp.besoin = window._dvp.besoin === nom ? '' : nom;
  document.querySelectorAll('.dvp-besoin').forEach(b => b.classList.toggle('actif', b.textContent.trim() === nom && window._dvp.besoin === nom));
}

// Redessiner sans perdre ce qui est déjà tapé : quelqu'un qui bascule « pour mon entreprise »
// après avoir saisi son nom ne doit pas avoir à le retaper.
function dvpRedessiner() {
  const zone = document.getElementById('dvp-zone');
  if (!zone) return;
  const garde = {};
  ['civilite', 'prenom', 'nom', 'entreprise', 'email', 'telephone', 'npa', 'ville', 'message']
    .forEach(k => { const el = document.getElementById('dvp-' + k); if (el) garde[k] = el.value; });
  const accord = document.getElementById('dvp-consentement')?.checked;
  zone.innerHTML = dvpHtml();
  Object.entries(garde).forEach(([k, v]) => { const el = document.getElementById('dvp-' + k); if (el && v) el.value = v; });
  const c = document.getElementById('dvp-consentement');
  if (c && accord) c.checked = true;
}

function dvpMontrerErreur(texte) {
  const e = document.getElementById('dvp-erreur');
  if (!e) return;
  e.textContent = texte;
  e.hidden = !texte;
}

const DVP_MESSAGES = {
  nom: 'Il nous faut au moins votre nom.',
  email: 'Cette adresse e-mail ne semble pas valide.',
  besoin: 'Choisissez ce qui vous occupe, en haut du formulaire.',
  consentement: 'Merci de cocher la case : sans votre accord, nous n’avons pas le droit de vous rappeler.',
  trop_de_demandes: 'Nous avons déjà reçu votre demande. Nous vous répondons très vite.',
};

async function dvpEnvoyer() {
  const P = window._dvp;
  if (P.envoi) return;
  const val = k => (document.getElementById('dvp-' + k)?.value || '').trim();
  if (!P.besoin) { dvpMontrerErreur(DVP_MESSAGES.besoin); return; }
  if (!val('nom')) { dvpMontrerErreur(DVP_MESSAGES.nom); return; }
  if (!document.getElementById('dvp-consentement')?.checked) { dvpMontrerErreur(DVP_MESSAGES.consentement); return; }

  P.envoi = true;
  const bouton = document.getElementById('dvp-envoyer');
  if (bouton) { bouton.disabled = true; bouton.textContent = 'Envoi…'; }
  dvpMontrerErreur('');

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/deposer_demande_devis`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_besoin: P.besoin, p_pour_qui: P.pourQui, p_nom: val('nom'), p_prenom: val('prenom'),
        p_email: val('email'), p_telephone: val('telephone'), p_entreprise: val('entreprise'),
        p_civilite: val('civilite'), p_npa: val('npa'), p_ville: val('ville'),
        p_message: val('message'), p_source: dvpSource(),
        p_consentement: true, p_piege: val('piege'),
      }),
    });
    const d = await r.json();
    if (!r.ok || !d || d.ok !== true) {
      dvpMontrerErreur(DVP_MESSAGES[d && d.erreur] || 'L’envoi n’a pas abouti. Réessayez, ou appelez le 079 101 99 26.');
      P.envoi = false;
      if (bouton) { bouton.disabled = false; bouton.textContent = 'Envoyer ma demande'; }
      return;
    }
    dvpMerci(val('prenom') || val('nom'));
  } catch (e) {
    dvpMontrerErreur('Pas de connexion. Réessayez, ou appelez le 079 101 99 26.');
    P.envoi = false;
    if (bouton) { bouton.disabled = false; bouton.textContent = 'Envoyer ma demande'; }
  }
}

function dvpMerci(prenom) {
  const zone = document.getElementById('dvp-zone');
  if (!zone) return;
  zone.innerHTML = `
    <div class="dvp dvp-merci">
      <div class="dvp-carte">
        ${typeof rexPoseHtml === 'function' ? rexPoseHtml({ taille: 150, pose: 'pouce' }) : ''}
        <h1>C'est noté${prenom ? ', ' + dvpEsc(prenom) : ''}.</h1>
        <p>Votre demande est arrivée. Nous revenons vers vous sous 24 heures ouvrables.</p>
        <p class="dvp-pied">Une urgence ? 079 101 99 26 — Jonathan Özkan, Assurex Sàrl.</p>
      </div>
    </div>`;
}

// Au chargement : si l'adresse demande la page de devis, on remplace l'écran de connexion.
(function dvpDemarrer() {
  const poser = () => {
    if (!dvpEstPagePublique()) return;
    const login = document.getElementById('login-screen');
    if (!login) return;
    document.body.classList.add('mode-devis');
    document.title = 'Assurex — Demander un devis';
    login.innerHTML = `<div id="dvp-zone">${dvpHtml()}</div>`;
    login.style.display = '';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
})();

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CÔTÉ CRM : la liste des demandes reçues
// ════════════════════════════════════════════════════════════════════════════════════════════════

async function dvpCharger() {
  try { window._dvp.demandes = await dbGet('demandes_devis', 'select=*&order=cree_le.desc') || []; }
  catch (e) { window._dvp.demandes = []; }
}

function viewDemandesDevis() {
  if (!window._dvp.demandes.length) dvpCharger().then(() => { if (currentView === 'demandes-devis') dvpRendreCrm(); });
  return `<div id="dvp-crm">${dvpContenuCrm()}</div>`;
}

function dvpRendreCrm() {
  const el = document.getElementById('dvp-crm');
  if (el) el.innerHTML = dvpContenuCrm();
}

function dvpContenuCrm() {
  const D = window._dvp.demandes;
  const f = window._dvp.filtre;
  const liste = f === 'tout' ? D : D.filter(d => d.statut === f);
  const nouvelles = D.filter(d => d.statut === 'nouvelle');
  const transformees = D.filter(d => d.statut === 'transformee');
  const taux = D.length ? Math.round(transformees.length * 100 / D.length) : null;
  const lien = location.origin + location.pathname + '?devis';
  const kpi = (l, v, s, ton) => `<div class="dbx-kpi ${ton || ''}"><span class="dbx-kpi-label">${l}</span><span class="dbx-kpi-valeur">${v}</span><span class="dbx-kpi-sous">${s}</span></div>`;

  return `
  <div class="page-header">
    <h2>📨 Demandes de devis</h2>
    <p class="page-sub">Les demandes laissées sur la page publique. Chacune peut devenir un client
      et une opportunité en un clic.</p>
  </div>

  <div class="dbx-kpis">
    ${kpi('À traiter', nouvelles.length, nouvelles.length ? 'en attente de ton appel' : 'rien en attente', nouvelles.length ? 'cf-alerte' : '')}
    ${kpi('Reçues en tout', D.length, 'depuis l’ouverture de la page')}
    ${kpi('Transformées', transformees.length, taux == null ? 'pas encore de recul' : `${taux} % des demandes`)}
    ${kpi('Sans suite', D.filter(d => d.statut === 'sans_suite').length, 'clôturées sans affaire')}
  </div>

  <div class="dvp-outils">
    <div class="dvp-lien">
      <span>Le lien à diffuser</span>
      <code id="dvp-lien-public">${dvpEsc(lien)}</code>
      <button type="button" class="btn-secondary" onclick="dvpCopierLien()">Copier</button>
      <a class="btn-secondary" href="?devis" target="_blank" rel="noopener">Voir la page</a>
    </div>
    <select class="form-input" onchange="window._dvp.filtre=this.value; dvpRendreCrm()">
      <option value="nouvelle" ${f === 'nouvelle' ? 'selected' : ''}>À traiter (${nouvelles.length})</option>
      <option value="tout" ${f === 'tout' ? 'selected' : ''}>Toutes (${D.length})</option>
      ${Object.entries(DVP_STATUTS).filter(([k]) => k !== 'nouvelle').map(([k, v]) =>
        `<option value="${k}" ${f === k ? 'selected' : ''}>${v.libelle} (${D.filter(d => d.statut === k).length})</option>`).join('')}
    </select>
  </div>

  ${liste.length ? `<div class="dvp-liste">${liste.map(dvpLigneCrm).join('')}</div>`
    : `<div class="dbx-vide">${typeof rexPoseHtml === 'function' ? rexPoseHtml({ taille: 130, pose: 'confiant' }) : ''}
        <strong>Aucune demande ici.</strong>
        <span>Diffuse le lien ci-dessus sur le site, dans ta signature d’e-mail et sur tes réseaux :
          c’est par là que les leads arrivent.</span></div>`}`;
}

function dvpLigneCrm(d) {
  const s = DVP_STATUTS[d.statut] || DVP_STATUTS.nouvelle;
  const jours = Math.floor((Date.now() - new Date(d.cree_le).getTime()) / 86400000);
  const nom = [d.prenom, d.nom].filter(Boolean).join(' ');
  return `<div class="dvp-ligne ${d.statut === 'nouvelle' && jours >= 2 ? 'retard' : ''}">
    <span class="dvp-statut" style="--c:${s.couleur}">${s.libelle}</span>
    <div class="dvp-corps">
      <div class="dvp-titre">${dvpEsc(nom)}${d.entreprise ? ` · ${dvpEsc(d.entreprise)}` : ''}
        <span class="dvp-besoin-etiq">${dvpEsc(d.besoin)}</span></div>
      <div class="dvp-meta">
        ${dvpEsc(d.email)}${d.telephone ? ` · ${dvpEsc(d.telephone)}` : ''}${d.npa || d.ville ? ` · ${dvpEsc([d.npa, d.ville].filter(Boolean).join(' '))}` : ''}
        · reçue ${jours === 0 ? 'aujourd’hui' : `il y a ${jours} j`}${d.source ? ` · ${dvpEsc(d.source)}` : ''}
      </div>
      ${d.message ? `<div class="dvp-message">${dvpEsc(d.message)}</div>` : ''}
    </div>
    <div class="dvp-boutons">
      ${d.telephone ? `<a class="btn-secondary" href="tel:${dvpEsc(d.telephone.replace(/\s/g, ''))}">📞 Appeler</a>` : ''}
      ${d.client_id ? `<a class="btn-secondary" href="?client=${d.client_id}" onclick="return irVersClient(event,'${d.client_id}')">Voir la fiche</a>`
        : `<button type="button" class="btn-save" onclick="dvpTransformer('${d.id}')">→ Créer le client</button>`}
      <select class="form-input dvp-statut-choix" onchange="dvpStatut('${d.id}', this.value)">
        ${Object.entries(DVP_STATUTS).map(([k, v]) => `<option value="${k}" ${d.statut === k ? 'selected' : ''}>${v.libelle}</option>`).join('')}
      </select>
    </div>
  </div>`;
}

function dvpCopierLien() {
  const t = document.getElementById('dvp-lien-public')?.textContent || '';
  navigator.clipboard?.writeText(t).then(
    () => showError('✓ Lien copié.'),
    () => showError('Copie impossible — sélectionne le lien à la main.'));
}

async function dvpStatut(id, statut) {
  const r = await dbPatch('demandes_devis', id, {
    statut,
    traite_le: new Date().toISOString(),
    traite_par: (typeof currentUser !== 'undefined' && currentUser) ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : null,
  });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  await dvpCharger();
  dvpRendreCrm();
}

// Transformer une demande en client. On ne crée PAS l'opportunité dans la foulée : le produit
// exact et le montant se décident au téléphone, et une opportunité vide encombre le pipeline.
async function dvpTransformer(id) {
  const d = window._dvp.demandes.find(x => x.id === id);
  if (!d) return;
  const nom = [d.prenom, d.nom].filter(Boolean).join(' ');
  const existant = (typeof allClients !== 'undefined' ? allClients : [])
    .find(c => (c.email || '').toLowerCase() === (d.email || '').toLowerCase());
  if (existant) {
    if (!confirm(`${nom} a déjà une fiche (${existant.email}). La rattacher à cette demande ?`)) return;
    await dbPatch('demandes_devis', id, { client_id: existant.id, statut: 'doublon' });
    await dvpCharger(); dvpRendreCrm();
    showError('✓ Demande rattachée à la fiche existante.');
    return;
  }
  if (!confirm(`Créer la fiche client de ${nom} à partir de cette demande ?`)) return;

  const fiche = {
    nom: d.entreprise || d.nom, prenom: d.entreprise ? '' : (d.prenom || ''),
    email: d.email, telephone: d.telephone || null, civilite: d.civilite || null,
    npa: d.npa || null, ville: d.ville || null,
    source: 'Demande de devis en ligne',
    statut: 'prospect',
  };
  const r = await dbPost('clients', fiche);
  const cree = Array.isArray(r) ? r[0] : r;
  if (!cree || !cree.id) { showError('Échec de la création : ' + errMsg(r)); return; }
  await dbPatch('demandes_devis', id, {
    client_id: cree.id, statut: 'transformee',
    traite_le: new Date().toISOString(),
    traite_par: (typeof currentUser !== 'undefined' && currentUser) ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : null,
  });
  if (typeof allClients !== 'undefined') allClients.push(cree);
  await dvpCharger();
  dvpRendreCrm();
  showError(`✓ Fiche créée pour ${nom}. Besoin annoncé : ${d.besoin}.`);
}
