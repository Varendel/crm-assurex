// ═══ LES CONTACTS COMPAGNIE, PAR SERVICE (20.09.2026) ══════════════════════════════════════════
// « Ajoute contact service broker dans les compagnies partenaires. Pour Swiss Life ajoute service
// individuel et collectif. »
//
// Une compagnie n'a pas UN contact mais plusieurs, et ils ne servent pas à la même chose : le
// service courtiers traite les affaires du quotidien, un conseiller nommé suit les dossiers en
// cours, les sinistres ont leur propre guichet. La table acceptait déjà plusieurs lignes par
// compagnie, mais rien ne disait laquelle appeler pour quoi — on en gardait donc une seule, et le
// bon interlocuteur restait dans la tête de Jonathan.
//
// SWISS LIFE EST LE CAS QUI LE REND ÉVIDENT. L'individuel (3a, assurance vie) et le collectif
// (LPP) sont deux services distincts, avec deux interlocuteurs différents. Écrire à l'un pour une
// affaire qui relève de l'autre coûte plusieurs jours, et c'est le genre d'erreur qu'on ne fait
// qu'une fois par compagnie — mais qu'on refait à chaque nouvelle compagnie.
//
// L'écran regroupe donc par compagnie, et liste ses services les uns sous les autres.

const CSV_SERVICES = {
  broker: { nom: 'Service courtiers', aide: 'Affaires courantes, demandes d’offres, questions de contrat.' },
  individuel: { nom: 'Service individuel', aide: 'Pilier 3a, assurance vie — personnes privées.' },
  collectif: { nom: 'Service collectif', aide: 'LPP, prévoyance professionnelle — entreprises.' },
  sinistres: { nom: 'Sinistres', aide: 'Déclarations et suivi des sinistres.' },
  general: { nom: 'Contact général', aide: '' },
};

function csvEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function csvService(s) { return CSV_SERVICES[s] || CSV_SERVICES.general; }

// Les compagnies qui séparent l'individuel du collectif. Proposer ces deux services partout
// encombrerait le formulaire : la plupart des compagnies n'ont qu'un guichet courtiers.
const CSV_SEPARENT = /swiss life|axa|helvetia|z[üu]rich|baloise|b[âa]loise|allianz|generali|pax/i;

function csvServicesPour(compagnie) {
  const base = ['broker', 'sinistres', 'general'];
  return CSV_SEPARENT.test(String(compagnie || ''))
    ? ['broker', 'individuel', 'collectif', 'sinistres', 'general']
    : base;
}

// ── L'écran ─────────────────────────────────────────────────────────────────────────────────────
async function viewContactsServices() {
  const contacts = await dbGet('compagnies_contacts', 'select=*&order=compagnie.asc,ordre.asc') || [];
  window._contactsCompagnies = contacts;

  // Regroupement par compagnie : une compagnie = un bloc, ses services dedans.
  const parCie = new Map();
  for (const c of contacts) {
    const cle = c.compagnie || '(sans nom)';
    if (!parCie.has(cle)) parCie.set(cle, []);
    parCie.get(cle).push(c);
  }
  const cies = [...parCie.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  const sansEmail = contacts.filter(c => !c.email).length;

  return `
    <section class="fcx-hero csv-hero">
      <div class="fcx-hero-deco" aria-hidden="true"></div>
      <div>
        <span class="cf-surtitre">Partenaires</span>
        <h1>Contacts compagnies</h1>
        <p>Une compagnie a plusieurs guichets. Le service courtiers traite les affaires courantes ;
          certaines compagnies séparent l’individuel du collectif, et écrire au mauvais service
          coûte plusieurs jours.</p>
      </div>
      <div class="cf-hero-actions">
        <button type="button" class="fcx-btn-blanc" onclick="csvOuvrir()">+ Ajouter un contact</button>
      </div>
    </section>

    ${sansEmail ? `<div class="csv-manque">
      <b>${sansEmail} contact${sansEmail > 1 ? 's' : ''} sans adresse</b>
      <small>Sans adresse, la demande d’offre ne peut pas partir automatiquement vers cette compagnie.</small>
    </div>` : ''}

    <div class="csv-liste">${cies.map(([cie, l]) => csvCieHtml(cie, l)).join('')
      || '<div class="table-empty">Aucune compagnie enregistrée.</div>'}</div>`;
}

function csvCieHtml(cie, contacts) {
  const tries = contacts.slice().sort((a, b) => (a.ordre ?? 9) - (b.ordre ?? 9));
  const manquants = csvServicesPour(cie).filter(s =>
    s !== 'general' && s !== 'sinistres' && !tries.some(c => c.service === s));

  return `<section class="dbx-carte csv-carte">
    <header class="csv-tete">
      <span class="csv-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(cie, 40) : ''}</span>
      <div class="csv-nom">
        <b>${csvEsc(cie)}</b>
        <small>${tries.length} service${tries.length > 1 ? 's' : ''}</small>
      </div>
      <button type="button" class="csv-act" onclick="csvOuvrir(null, '${csvEsc(cie).replace(/'/g, '&#39;')}')">+ Service</button>
    </header>

    <div class="csv-services">${tries.map(c => {
      const s = csvService(c.service);
      return `<article class="csv-service ${c.email ? '' : 'sans-email'}">
        <div class="csv-service-texte">
          <b>${csvEsc(s.nom)}</b>
          ${c.libelle_contact ? `<small>${csvEsc(c.libelle_contact)}</small>` : ''}
          ${c.remarque ? `<small class="csv-remarque">${csvEsc(c.remarque)}</small>` : ''}
        </div>
        <div class="csv-coord">
          ${c.email
            ? `<a href="mailto:${csvEsc(c.email)}">${typeof ico === 'function' ? ico('courriel', 15) : ''}<span>${csvEsc(c.email)}</span></a>`
            : '<span class="csv-vide">adresse à renseigner</span>'}
          ${c.telephone ? `<a href="tel:${csvEsc(String(c.telephone).replace(/\s/g, ''))}">${typeof ico === 'function' ? ico('telephone', 15) : ''}<span>${csvEsc(c.telephone)}</span></a>` : ''}
        </div>
        <button type="button" class="csv-act" onclick="csvOuvrir('${c.id}')">Modifier</button>
      </article>`;
    }).join('')}</div>

    ${manquants.length ? `<p class="csv-suggestion">
      Cette compagnie sépare ses services : ${manquants.map(m => `<button type="button" class="csv-lien"
        onclick="csvOuvrir(null, '${csvEsc(cie).replace(/'/g, '&#39;')}', '${m}')">ajouter le ${csvService(m).nom.toLowerCase()}</button>`).join(', ')}.
    </p>` : ''}
  </section>`;
}

// ── Le formulaire ───────────────────────────────────────────────────────────────────────────────
// Il reprend celui de js/10 en y ajoutant le service, le téléphone et la remarque. La partie
// « convention » reste dans le formulaire d'origine : elle appartient à la compagnie, pas au
// service, et la dupliquer sur chaque guichet créerait des versions divergentes.
function csvOuvrir(id, compagnie, service) {
  const existant = id ? (window._contactsCompagnies || []).find(c => c.id === id) : null;
  const cie = existant ? existant.compagnie : (compagnie || '');
  const sel = existant ? existant.service : (service || 'broker');
  const services = csvServicesPour(cie);
  const v = x => csvEsc(x == null ? '' : x);

  creerModale('modal-csv', `
    <div class="csv-modale">
      <h3>${existant ? 'Modifier' : 'Ajouter'} un contact${cie ? ' — ' + csvEsc(cie) : ''}</h3>
      <p class="csv-sous">Un contact par service. C’est ce qui évite d’écrire au guichet collectif
        pour une affaire individuelle.</p>

      <label class="csv-label" for="csv-cie">Compagnie</label>
      <input class="form-input" id="csv-cie" value="${v(cie)}" placeholder="Ex. Swiss Life"/>

      <label class="csv-label">Service</label>
      <div class="csv-choix">${services.map(s => `
        <label class="csv-radio ${sel === s ? 'actif' : ''}">
          <input type="radio" name="csv-service" value="${s}" ${sel === s ? 'checked' : ''}
            onchange="document.querySelectorAll('.csv-radio').forEach(l=>l.classList.toggle('actif', l.querySelector('input').value===this.value))"/>
          <b>${csvService(s).nom}</b>
          ${csvService(s).aide ? `<small>${csvService(s).aide}</small>` : ''}
        </label>`).join('')}</div>

      <div class="csv-grille">
        <div><label for="csv-libelle">Interlocuteur / agence</label>
          <input class="form-input" id="csv-libelle" value="${v(existant && existant.libelle_contact)}" placeholder="Ex. Nadine Ducret"/></div>
        <div><label for="csv-email">Adresse e-mail</label>
          <input class="form-input" id="csv-email" type="email" value="${v(existant && existant.email)}"/></div>
        <div><label for="csv-tel">Téléphone</label>
          <input class="form-input" id="csv-tel" value="${v(existant && existant.telephone)}"/></div>
        <div><label for="csv-remarque">Remarque</label>
          <input class="form-input" id="csv-remarque" value="${v(existant && existant.remarque)}" placeholder="Ex. ne traite pas les flottes"/></div>
      </div>

      <div class="csv-actions">
        ${existant ? `<button type="button" class="csv-act csv-act-sup" onclick="csvSupprimer('${existant.id}')">Retirer ce service</button>` : ''}
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-csv').remove()">Annuler</button>
        <button type="button" class="btn-save" onclick="csvEnregistrer(${existant ? `'${existant.id}'` : 'null'})">✓ Enregistrer</button>
      </div>
    </div>`, { opacite: .7, padding: '16px' });
}

const CSV_ORDRE = { broker: 0, individuel: 1, collectif: 2, sinistres: 3, general: 9 };

async function csvEnregistrer(id) {
  const t = x => (document.getElementById(x)?.value || '').trim() || null;
  const compagnie = t('csv-cie');
  if (!compagnie) { showError('Le nom de la compagnie est obligatoire.'); return; }
  const service = document.querySelector('input[name="csv-service"]:checked')?.value || 'broker';

  const corps = {
    compagnie, service,
    libelle_contact: t('csv-libelle'),
    email: t('csv-email'),
    telephone: t('csv-tel'),
    remarque: t('csv-remarque'),
    ordre: CSV_ORDRE[service] ?? 9,
  };
  const r = id ? await dbPatch('compagnies_contacts', id, corps) : await dbPost('compagnies_contacts', corps);
  if (r && r.error) { showError('Enregistrement impossible : ' + errMsg(r)); return; }

  if (typeof allCompagniesContacts !== 'undefined') {
    allCompagniesContacts = await dbGet('compagnies_contacts', 'select=*&order=compagnie.asc');
  }
  document.getElementById('modal-csv')?.remove();
  showError('✓ Contact enregistré');
  if (typeof navigate === 'function') navigate('contacts-compagnies');
}

async function csvSupprimer(id) {
  const c = (window._contactsCompagnies || []).find(x => x.id === id);
  if (!confirm(`Retirer « ${csvService(c && c.service).nom} » de ${c ? c.compagnie : 'cette compagnie'} ?\n\nLes autres services de la compagnie ne sont pas touchés.`)) return;
  const r = await dbDelete('compagnies_contacts', id);
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  document.getElementById('modal-csv')?.remove();
  showError('✓ Service retiré');
  if (typeof navigate === 'function') navigate('contacts-compagnies');
}

// On remplace la vue de js/10 : l'ancienne reste en place si ce fichier n'est pas chargé, et le
// formulaire de convention qu'elle porte continue de fonctionner par son propre bouton.
(function csvBrancher() {
  if (typeof viewContactsCompagnies === 'function') window.viewContactsCompagnies = viewContactsServices;
})();
