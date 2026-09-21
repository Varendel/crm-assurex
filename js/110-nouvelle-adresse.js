// ═══ NOUVELLE ADRESSE — REMPLACER, ARCHIVER, ANNONCER (21.09.2026) ═════════════════════════════
// « Ajoute la fonction nouvelle adresse, qui remplace et archive la précédente et la date de
// changement, car il faut ensuite mettre à jour les couvertures et annoncer l'adresse. »
// « Il faudrait un mail prêt à expédier en CCI avec les compagnies. »
//
// Un déménagement se fait en trois temps, et c'est le dernier qu'on oublie :
//   1. la fiche prend la nouvelle adresse ;
//   2. l'ancienne est archivée avec sa date de fin : c'est elle qui dit sur quel logement
//      portait la couverture en cas de sinistre juste avant le changement ;
//   3. chaque compagnie qui a un contrat en vigueur est avisée, et les couvertures liées au
//      lieu (ménage, bâtiment, véhicule, région LAMal) sont revues.
//
// Les deux premiers temps sont faits en base par changer_adresse(), en un seul mouvement.
// Un déclencheur archive aussi toute modification d'adresse faite ailleurs (formulaire de fiche,
// import), pour qu'aucun changement ne passe sans laisser de trace. Le troisième temps est une
// liste, une ligne par compagnie, qui reste ouverte sur la fiche tant qu'elle n'est pas cochée.
//
// LE MAIL EN CCI ne part jamais seul : il s'ouvre dans Outlook, prêt, et c'est vous qui envoyez.
// Il ne cite AUCUN numéro de police : en copie cachée, chaque compagnie lirait les contrats que
// le client a chez ses concurrentes. Il identifie le client par son nom, sa date de naissance et
// son ancienne adresse, ce qui suffit à toutes les compagnies pour retrouver leurs contrats.
// Le mail par compagnie, lui, cite ses polices.
//
// Branché à la place de « Appliquer à la fiche » (js/103) : une demande venue de l'espace
// client passe par la même fenêtre, pré-remplie, et se clôt avec.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de index.html (ce fichier + 99-nouvelle-adresse.css).
// Tables et déclencheur restent : l'historique continue de se remplir, sans écran pour le lire.

window._nad = window._nad || { contacts: null, parClient: {} };

function nadEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function nadIco(nom, t) { return typeof ico === 'function' ? ico(nom, t || 16) : ''; }
function nadDate(d) { return d && typeof fmtDate === 'function' ? fmtDate(String(d).slice(0, 10)) : (d || ''); }
function nadAuj() { return new Date().toISOString().slice(0, 10); }

function nadClient(id) {
  const f = window._nad.fiche;
  return (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === id)
    || (f && f.id === id ? f : null);
}
function nadNom(c) {
  if (!c) return 'Client';
  return (typeof estEntreprise === 'function' && estEntreprise(c)) ? (c.nom || '') : `${c.prenom || ''} ${c.nom || ''}`.trim();
}
function nadLigne(o) {
  return [o && o.adresse, [o && o.npa, o && o.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}
function nadSignataire() {
  const u = typeof currentUser !== 'undefined' ? currentUser : null;
  const nom = u && (u.prenom || u.nom) ? `${u.prenom || ''} ${u.nom || ''}`.trim() : 'Jonathan Özkan';
  return `${nom}\nAssurex Sàrl\n079 101 99 26 — jo@cofidex.ch`;
}

// ── Carnet des compagnies ──────────────────────────────────────────────────────────────────────
// Le nom saisi sur le contrat (« CSS », « La Vaudoise ») n'est pas celui du carnet (« CSS
// Assurance », « Vaudoise Assurances ») : on compare sans article ni ponctuation, sur le début.
async function nadContacts() {
  if (window._nad.contacts) return window._nad.contacts;
  const liste = (typeof allCompagniesContacts !== 'undefined' && allCompagniesContacts && allCompagniesContacts.length)
    ? allCompagniesContacts
    : await dbGet('compagnies_contacts', 'select=*&order=compagnie.asc').catch(() => []);
  window._nad.contacts = liste || [];
  return window._nad.contacts;
}
function nadCle(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^(la|le|les|l)\s+/, '').replace(/[^a-z0-9]/g, '');
}
// Service « broker » d'abord (c'est lui qui gère nos contrats), puis « general », puis le reste.
function nadContactDe(compagnie) {
  const k = nadCle(compagnie);
  if (!k) return null;
  const rang = s => ({ broker: 0, general: 1 }[s] ?? 2);
  return (window._nad.contacts || [])
    .filter(c => c.email)
    .filter(c => { const n = nadCle(c.compagnie); return n === k || n.startsWith(k) || k.startsWith(n); })
    .sort((a, b) => rang(a.service) - rang(b.service) || (a.ordre ?? 99) - (b.ordre ?? 99))[0] || null;
}

// ── Ce que le déménagement touche ──────────────────────────────────────────────────────────────
// Pas une règle d'assurance complète : un pense-bête, pour que la revue des couvertures ne se
// réduise pas à « adresse modifiée ».
function nadPointsARevoir(contrats, ancien, nouveau) {
  const txt = (contrats || []).map(ct => `${ct.produit || ''} ${ct.modules || ''}`).join(' ').toLowerCase();
  const points = [];
  const cantonChange = ancien.canton && nouveau.canton && ancien.canton.toUpperCase() !== nouveau.canton.toUpperCase();
  if (/m[ée]nage|inventaire|rc priv|habitation/.test(txt)) points.push('Ménage et RC : nouvelle commune, surface et valeur d’inventaire à vérifier.');
  if (/b[âa]timent|immeuble|propri[ée]taire|pp[ée]/.test(txt)) points.push('Bâtiment : l’ancien logement reste-t-il assuré (vente, location, vacant) ?');
  if (/auto|v[ée]hicule|moto|casco|scooter/.test(txt)) points.push(cantonChange
    ? 'Véhicule : changement de canton — plaques et permis à changer sous 14 jours, lieu de stationnement.'
    : 'Véhicule : nouveau lieu de stationnement (garage, place extérieure).');
  if (/lamal|aos|base|obligatoire/.test(txt) || (contrats || []).some(ct => /helsana|css|groupe mutuel|swica|assura|sanitas|concordia|visana|kpt|sympany|atupri|egk|[öo]kk/i.test(ct.compagnie || ''))) {
    points.push(cantonChange || (ancien.npa && nouveau.npa && ancien.npa !== nouveau.npa)
      ? 'LAMal : la prime suit la région du nouveau domicile — nouvelle prime dès le mois suivant le changement.'
      : 'LAMal : vérifier que la région de prime reste la même.');
  }
  if (cantonChange && !points.some(p => p.startsWith('Véhicule'))) points.push('Changement de canton : impôts et, le cas échéant, prévoyance cantonale.');
  return points;
}

// ── Les mails ──────────────────────────────────────────────────────────────────────────────────
function nadCorps(c, a, polices) {
  const nom = nadNom(c);
  const naissance = c && c.date_naissance ? ` (né${c.civilite === 'Madame' ? 'e' : ''} le ${nadDate(c.date_naissance)})` : '';
  const ide = c && c.ide ? ` — IDE ${c.ide}` : '';
  const liste = polices && polices.length
    ? `\n\nContrats concernés :\n${polices.map(p => `  • ${p.produit || 'Contrat'}${p.numero_police ? ` — police ${p.numero_police}` : ''}`).join('\n')}`
    : `\n\nCe changement concerne l’ensemble des contrats que ${c && c.civilite === 'Madame' ? 'notre cliente' : 'notre client'} détient auprès de votre compagnie.`;
  const client = c && c.civilite === 'Madame' ? 'Notre cliente' : 'Notre client';
  return `Madame, Monsieur,

${client} ${nom}${naissance}${ide} nous informe de son changement d’adresse.

Ancienne adresse : ${a.ancienne || 'non renseignée'}
Nouvelle adresse : ${a.nouvelle}
Date du changement : ${nadDate(a.date)}${liste}

Nous vous remercions de mettre vos contrats à jour à cette date et de nous transmettre les avenants correspondants. Si une couverture liée au lieu du risque (ménage, bâtiment, véhicule, région de prime) doit être adaptée, merci de nous indiquer la nouvelle prime.

Avec nos salutations distinguées.

${nadSignataire()}`;
}

function nadObjet(c, a) {
  return `Changement d’adresse — ${nadNom(c)} — dès le ${nadDate(a.date)}`;
}

function nadOuvrirMail(to, bcc, objet, corps) {
  const p = [];
  if (bcc && bcc.length) p.push('bcc=' + bcc.map(encodeURIComponent).join(','));
  p.push('subject=' + encodeURIComponent(objet));
  p.push('body=' + encodeURIComponent(corps));
  window.open(`mailto:${to ? encodeURIComponent(to) : ''}?${p.join('&')}`, '_blank');
}

// ── Chargement par fiche ───────────────────────────────────────────────────────────────────────
async function nadCharger(clientId) {
  const [hist, annonces] = await Promise.all([
    dbGet('adresses_historique', `client_id=eq.${clientId}&select=*&order=date_changement.desc,created_at.desc`).catch(() => []),
    dbGet('adresse_annonces', `client_id=eq.${clientId}&select=*&order=created_at.desc`).catch(() => []),
    nadContacts(),
  ]);
  window._nad.parClient[clientId] = { hist: hist || [], annonces: annonces || [] };
  return window._nad.parClient[clientId];
}

// ── La fenêtre « Nouvelle adresse » ────────────────────────────────────────────────────────────
function nadOuvrir(clientId, demandeId) {
  const c = nadClient(clientId);
  if (!c) { showError('Fiche introuvable — rechargez la page.'); return; }
  const d = demandeId ? ((typeof _mc !== 'undefined' && _mc.adresses) || []).find(x => x.id === demandeId) : null;
  const v = x => nadEsc(x == null ? '' : x);

  creerModale('modal-nad', `
    <div class="opx-modale mdx-modale mdx-modale-flex adr-modale nad-modale" role="dialog" aria-modal="true" aria-labelledby="nad-titre">
      <h3 id="nad-titre">Nouvelle adresse — ${nadEsc(nadNom(c))}</h3>
      <p class="adr-sous">L’adresse actuelle est archivée avec sa date de fin. Vous obtenez ensuite la
        liste des compagnies à aviser et le mail prêt à partir.</p>
      ${d ? `<p class="nad-origine">${nadIco('message', 15)} Demande de l’espace client du ${nadDate(d.created_at)}${d.remarque ? ` — « ${nadEsc(d.remarque)} »` : ''}</p>` : ''}

      <div class="adr-avant">
        <em>Adresse actuelle, qui sera archivée</em>
        <b>${nadEsc(nadLigne(c) || 'non renseignée')}${c.canton ? ` · ${nadEsc(c.canton)}` : ''}</b>
      </div>

      <div class="form-field"><label class="form-label" for="nad-rue">Rue et numéro</label>
        <input class="form-input" id="nad-rue" maxlength="160" value="${v(d && d.adresse)}"/></div>
      <div class="adr-grille">
        <div class="form-field"><label class="form-label" for="nad-npa">NPA</label>
          <input class="form-input" id="nad-npa" maxlength="10" inputmode="numeric" value="${v(d && d.npa)}"/></div>
        <div class="form-field"><label class="form-label" for="nad-ville">Localité</label>
          <input class="form-input" id="nad-ville" maxlength="80" value="${v(d && d.ville)}"/></div>
        <div class="form-field"><label class="form-label" for="nad-canton">Canton</label>
          <input class="form-input" id="nad-canton" maxlength="30" value="${v((d && d.canton) || c.canton)}"/></div>
      </div>
      <div class="form-field"><label class="form-label" for="nad-date">Date du changement</label>
        <input class="form-input" id="nad-date" type="date" value="${v((d && d.date_effet) || nadAuj())}"/>
        <small class="adr-aide">Le jour de l’emménagement. L’ancienne adresse est valable jusqu’à la veille.</small></div>

      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-nad').remove()">Annuler</button>
        <button type="button" class="btn-save" id="nad-ok" onclick="nadEnregistrer('${c.id}', ${d ? `'${d.id}'` : 'null'})">Remplacer l’adresse</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
  setTimeout(() => document.getElementById('nad-rue')?.focus(), 50);
}

async function nadEnregistrer(clientId, demandeId) {
  const c = nadClient(clientId);
  const t = id => (document.getElementById(id)?.value || '').trim();
  const nouveau = { adresse: t('nad-rue'), npa: t('nad-npa'), ville: t('nad-ville'), canton: t('nad-canton') };
  const date = t('nad-date') || nadAuj();
  if (!nouveau.adresse || !nouveau.ville) { showError('Indiquez au moins la rue et la localité.'); return; }
  if (c && nadLigne(c) === nadLigne(nouveau) && (c.canton || '') === nouveau.canton) {
    showError('C’est déjà l’adresse de la fiche.'); return;
  }
  const btn = document.getElementById('nad-ok');
  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }

  const ancien = c ? { adresse: c.adresse, npa: c.npa, ville: c.ville, canton: c.canton } : {};
  const r = await dbRpc('changer_adresse', {
    p_client: clientId, p_adresse: nouveau.adresse, p_npa: nouveau.npa || null, p_ville: nouveau.ville,
    p_canton: nouveau.canton || null, p_date: date, p_demande: demandeId || null,
    p_source: demandeId ? 'espace client' : 'nouvelle adresse',
  });
  if (!r) {
    if (btn) { btn.disabled = false; btn.textContent = 'Remplacer l’adresse'; }
    showError('Le changement n’a pas pu être enregistré — rien n’a été modifié.');
    return;
  }
  document.getElementById('modal-nad')?.remove();

  // La mémoire suit la base, sinon la fiche et les listes afficheraient encore l'ancienne adresse.
  if (c) Object.assign(c, { adresse: nouveau.adresse, npa: nouveau.npa || null, ville: nouveau.ville, canton: nouveau.canton || c.canton });
  if (demandeId && typeof _mc !== 'undefined') {
    const d = (_mc.adresses || []).find(x => x.id === demandeId);
    if (d) d.statut = 'traitee';
  }
  window._nad.dernierChangement = { clientId, ancien, nouveau, date };

  const n = (r[0] && r[0].annonces) || 0;
  showError(n ? `✓ Adresse remplacée, l’ancienne est archivée. ${n} compagnie${n > 1 ? 's' : ''} à aviser.` : '✓ Adresse remplacée, l’ancienne est archivée. Aucun contrat en vigueur à annoncer.');
  if (n) await nadSuivi(clientId);
  if (typeof currentView !== 'undefined' && currentView === 'fiche-client' && currentClientId === clientId && typeof showClient === 'function') showClient(clientId);
  else if (typeof currentView !== 'undefined' && currentView === 'messages-clients' && typeof navigate === 'function') navigate('messages-clients', { silent: true });
}

// ── Le suivi : compagnies à aviser, couvertures à revoir, mails ────────────────────────────────
function nadDernierLot(donnees) {
  const ouvertes = (donnees.annonces || []).filter(a => a.statut === 'a_annoncer');
  if (!ouvertes.length) return null;
  const histId = ouvertes[0].historique_id;
  const lot = ouvertes.filter(a => a.historique_id === histId);
  const h = (donnees.hist || []).find(x => x.id === histId) || null;
  return { lot, h };
}

async function nadSuivi(clientId) {
  const donnees = await nadCharger(clientId);
  const c = nadClient(clientId) || (await dbGet('clients', `id=eq.${clientId}&select=*`).catch(() => []))[0];
  const dl = nadDernierLot(donnees);
  if (!dl) { showError('Toutes les compagnies ont été avisées.'); return; }
  const { lot, h } = dl;

  const ancienne = h ? nadLigne(h) : '';
  const a = { ancienne, nouvelle: nadLigne(c), date: (lot[0] && lot[0].date_effet) || (h && h.date_changement) || nadAuj() };
  const contratsLot = lot.flatMap(x => (x.contrats || []).map(p => ({ ...p, compagnie: x.compagnie })));
  const points = nadPointsARevoir(contratsLot, h || {}, c || {});
  const avecMail = lot.map(x => ({ x, contact: nadContactDe(x.compagnie) }));
  const sansMail = avecMail.filter(o => !o.contact);

  creerModale('modal-nad-suivi', `
    <div class="opx-modale mdx-modale mdx-modale-flex nad-modale" role="dialog" aria-modal="true" aria-labelledby="nad-suivi-titre">
      <h3 id="nad-suivi-titre">Annoncer la nouvelle adresse</h3>
      <div class="adr-item-chg nad-chg">
        <span class="adr-avant-txt">${nadEsc(ancienne || 'adresse inconnue')}</span>
        <span class="adr-fleche" aria-hidden="true">${nadIco('fleche', 16)}</span>
        <span class="adr-apres">${nadEsc(a.nouvelle)}</span>
        <small class="nad-date">dès le ${nadDate(a.date)}</small>
      </div>

      ${points.length ? `<div class="nad-points"><b>Couvertures à revoir</b><ul>${points.map(p => `<li>${nadEsc(p)}</li>`).join('')}</ul></div>` : ''}

      <div class="nad-cies">
        ${avecMail.map(({ x, contact }) => `<label class="nad-cie">
          <input type="checkbox" class="nad-coche" value="${x.id}" checked/>
          <span class="nad-cie-nom">${typeof pictoCompagnie === 'function' ? pictoCompagnie(x.compagnie) : ''}${nadEsc(x.compagnie)}</span>
          <span class="nad-cie-contrats">${(x.contrats || []).map(p => nadEsc(p.produit || 'Contrat')).join(' · ')}</span>
          <span class="nad-cie-mail ${contact ? '' : 'manque'}">${contact ? nadEsc(contact.email) : 'pas d’e-mail dans le carnet'}</span>
          <button type="button" class="nad-lien" onclick="event.preventDefault(); nadMailCompagnie('${clientId}','${x.id}')" ${contact ? '' : 'disabled'}>mail seul</button>
        </label>`).join('')}
      </div>
      ${sansMail.length ? `<p class="nad-alerte">${sansMail.length} compagnie${sansMail.length > 1 ? 's' : ''} sans adresse e-mail : à aviser par leur portail ou par téléphone, puis à cocher.</p>` : ''}
      <p class="adr-aide">Le mail groupé part en copie cachée et ne cite aucun numéro de police, pour
        qu’aucune compagnie ne voie les contrats des autres. Le « mail seul » cite les polices de la compagnie.</p>

      <div class="opx-modale-actions mdx-actions nad-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-nad-suivi').remove()">Plus tard</button>
        <button type="button" class="btn-secondary" onclick="nadMarquer('${clientId}')">Marquer les cochées comme avisées</button>
        <button type="button" class="btn-secondary" onclick="nadMailGroupe('${clientId}')" ${avecMail.some(o => o.contact) ? '' : 'disabled'}>${nadIco('courriel', 15)} Ouvrir dans Outlook</button>
        <button type="button" class="btn-save" onclick="nadEnvoyerOutlook('${clientId}')" ${avecMail.some(o => o.contact) ? '' : 'disabled'}>Envoyer en CCI depuis ${NAD_CABINET}</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
  window._nad.suivi = { clientId, a, lot };
}

function nadCochees() {
  return [...document.querySelectorAll('#modal-nad-suivi .nad-coche:checked')].map(i => i.value);
}

function nadBccCochees(s) {
  const ids = new Set(nadCochees());
  return [...new Set(s.lot.filter(x => ids.has(x.id)).map(x => nadContactDe(x.compagnie)).filter(Boolean).map(ct => ct.email))];
}

// Destinataire visible : le cabinet lui-même. Le mail reste dans le fil, et aucune adresse de
// compagnie n'apparaît en clair.
const NAD_CABINET = 'jo@cofidex.ch';

function nadMailGroupe(clientId) {
  const s = window._nad.suivi;
  if (!s || s.clientId !== clientId) return;
  const bcc = nadBccCochees(s);
  if (!bcc.length) { showError('Aucune compagnie cochée n’a d’adresse e-mail.'); return; }
  const c = nadClient(clientId);
  nadOuvrirMail(NAD_CABINET, bcc, nadObjet(c, s.a), nadCorps(c, s.a, null));
  nadProposerMarquage(clientId, bcc.length);
}

// Même mail, envoyé par le compte Microsoft connecté au CRM : l'expéditeur est garanti
// (mailto laisse Outlook choisir son compte par défaut). Rien ne part sans la confirmation qui
// liste les destinataires ; une fois parti, les compagnies cochées sont marquées avisées.
async function nadEnvoyerOutlook(clientId) {
  const s = window._nad.suivi;
  if (!s || s.clientId !== clientId) return;
  const bcc = nadBccCochees(s);
  if (!bcc.length) { showError('Aucune compagnie cochée n’a d’adresse e-mail.'); return; }
  const c = nadClient(clientId);
  const objet = nadObjet(c, s.a);
  if (!confirm(`Envoyer maintenant depuis ${NAD_CABINET} ?\n\nObjet : ${objet}\n\nEn copie cachée (${bcc.length}) :\n${bcc.join('\n')}`)) return;
  if (typeof assurerTokenOutlook !== 'function' || !(await assurerTokenOutlook())) {
    showError('Connectez-vous à Outlook (bouton Microsoft dans le menu) pour envoyer.'); return;
  }
  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: objet,
          body: { contentType: 'text', content: nadCorps(c, s.a, null) },
          toRecipients: [{ emailAddress: { address: NAD_CABINET } }],
          bccRecipients: bcc.map(e => ({ emailAddress: { address: e } })),
        },
        saveToSentItems: true,
      }),
    });
    if (r.status === 401) { showError('Session Outlook expirée — reconnectez-vous puis réessayez.'); return; }
    if (!r.ok) { showError('Échec de l’envoi via Outlook — rien n’est parti, réessayez.'); return; }
  } catch (e) { showError('Erreur réseau, rien n’est parti : ' + e.message); return; }
  await nadMarquer(clientId);
}

function nadMailCompagnie(clientId, annonceId) {
  const s = window._nad.suivi;
  const x = s && s.lot.find(l => l.id === annonceId);
  const contact = x && nadContactDe(x.compagnie);
  if (!contact) return;
  const c = nadClient(clientId);
  nadOuvrirMail(contact.email, null, nadObjet(c, s.a), nadCorps(c, s.a, x.contrats || []));
}

// Outlook s'ouvre ; on ne sait pas si le mail est parti. On le demande, au lieu de le supposer.
function nadProposerMarquage(clientId, n) {
  const zone = document.querySelector('#modal-nad-suivi .nad-actions');
  if (!zone || zone.querySelector('.nad-envoye')) return;
  zone.insertAdjacentHTML('afterbegin', `<span class="nad-envoye">Mail ouvert dans Outlook pour ${n} compagnie${n > 1 ? 's' : ''}. Une fois envoyé :</span>`);
}

async function nadMarquer(clientId) {
  const ids = nadCochees();
  if (!ids.length) { showError('Cochez au moins une compagnie.'); return; }
  const qui = typeof currentUserEmail === 'function' ? currentUserEmail() : null;
  const res = await Promise.all(ids.map(id => dbPatch('adresse_annonces', id, { statut: 'annoncee', annoncee_le: nadAuj(), annoncee_par: qui })));
  const echecs = res.filter(r => r && r.error).length;
  if (echecs) { showError(`${echecs} ligne(s) n’ont pas pu être enregistrées — réessayez.`); return; }
  document.getElementById('modal-nad-suivi')?.remove();
  showError(`✓ ${ids.length} compagnie${ids.length > 1 ? 's' : ''} marquée${ids.length > 1 ? 's' : ''} comme avisée${ids.length > 1 ? 's' : ''}.`);
  nadRemplirFiche(clientId);
}

async function nadSansObjet(annonceId, clientId) {
  const r = await dbPatch('adresse_annonces', annonceId, { statut: 'sans_objet' });
  if (r && r.error) { showError('Échec : ' + (typeof errMsg === 'function' ? errMsg(r) : '')); return; }
  nadRemplirFiche(clientId);
}

// ── Sur la fiche : ce qui reste à annoncer, et les adresses précédentes ─────────────────────────
async function nadRemplirFiche(clientId) {
  const zone = document.getElementById(`nad-fiche-${clientId}`);
  if (!zone) return;
  const d = await nadCharger(clientId);
  const ouvertes = d.annonces.filter(a => a.statut === 'a_annoncer');
  const hist = d.hist;
  if (!ouvertes.length && !hist.length) { zone.innerHTML = ''; return; }

  zone.innerHTML = `
    ${ouvertes.length ? `<div class="nad-bandeau">
      <span class="nad-bandeau-ico">${nadIco('habitation', 20)}</span>
      <div><strong>Nouvelle adresse à annoncer — ${ouvertes.length} compagnie${ouvertes.length > 1 ? 's' : ''}</strong>
        <span>${ouvertes.map(a => nadEsc(a.compagnie)).join(' · ')} · changement du ${nadDate(ouvertes[0].date_effet)}</span></div>
      <button type="button" onclick="nadSuivi('${clientId}')">Annoncer</button>
    </div>` : ''}
    ${hist.length ? `<details class="nad-hist">
      <summary>Adresses précédentes (${hist.length})</summary>
      <ol>${hist.map(h => `<li>
        <span class="nad-hist-adr">${nadEsc(nadLigne(h) || '—')}${h.canton ? ` · ${nadEsc(h.canton)}` : ''}</span>
        <span class="nad-hist-meta">jusqu’au ${nadDate(h.valable_jusqu_au)} · remplacée le ${nadDate(h.date_changement)} · ${nadEsc(h.source)}</span>
      </li>`).join('')}</ol>
    </details>` : ''}`;
}

// ── Les branchements ───────────────────────────────────────────────────────────────────────────
(function nadBrancher() {
  // En-tête de fiche : l'adresse devient le bouton qui la change ; sans adresse, un bouton l'ajoute.
  if (typeof htmlEnteteFicheClient === 'function') {
    const origine = htmlEnteteFicheClient;
    window.htmlEnteteFicheClient = function (c) {
      let html = origine.apply(this, arguments);
      window._nad.fiche = c;
      const adresse = nadLigne(c);
      const bouton = `<button type="button" class="fcx-chip nad-chip" onclick="nadOuvrir('${c.id}')" title="Nouvelle adresse : remplace et archive l’actuelle">📍 ${adresse ? nadEsc(adresse) : 'Ajouter une adresse'}<span class="nad-chip-plus">changer</span></button>`;
      const i = html.indexOf('<span class="fcx-chip" title="Adresse">');
      if (i >= 0) {
        const j = html.indexOf('</span>', i);
        html = html.slice(0, i) + bouton + html.slice(j + 7);
      } else {
        const k = html.indexOf('<div class="fcx-contacts">');
        if (k >= 0) html = html.slice(0, k + 26) + bouton + html.slice(k + 26);
      }
      // La zone de suivi, juste sous le bandeau : un déménagement non annoncé doit se voir
      // dès l'ouverture de la fiche.
      const fin = html.indexOf('</section>');
      if (fin >= 0) {
        html = html.slice(0, fin + 10) + `<div class="nad-fiche" id="nad-fiche-${c.id}"></div>` + html.slice(fin + 10);
        setTimeout(() => nadRemplirFiche(c.id), 0);
      }
      return html;
    };
  }

  // Une demande de l'espace client passe par la même fenêtre, pré-remplie.
  if (typeof adrAppliquer === 'function') {
    window.adrAppliquer = function (id) {
      const d = ((typeof _mc !== 'undefined' && _mc.adresses) || []).find(x => x.id === id);
      if (!d) return;
      nadOuvrir(d.client_id, id);
    };
  }
})();
