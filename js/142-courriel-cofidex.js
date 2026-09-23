// ═══ ÉCRIRE UN E-MAIL — VUE UNIQUE (22.09.2026, élargie le 23.09.2026) ══════════════════════════
// D'abord « écrire à Cofidex » : l'équipe de la fiduciaire, au sujet d'un client. Puis :
// « Supprime le bouton Cofidex, crée un bouton pour les e-mails, regroupe dedans la fonction
// collègues et les envois liés clients, pour pouvoir écrire directement aux compagnies. »
//
// La vue ne change pas de forme — à gauche ce qu'on écrit, à droite l'aperçu de ce qui part — elle
// change de destinataire. UN sélecteur, TROIS carnets d'adresses :
//   · Équipe Cofidex   → table equipe_cofidex ;
//   · Compagnie        → table compagnies_contacts, par service (courtiers, individuel, collectif,
//                        sinistres) — le bon guichet, pas une adresse générique ;
//   · Client           → l'adresse de sa fiche.
// Le client choisi reste le contexte commun : sa situation remplit le message, ses documents
// deviennent des pièces jointes à cocher, et l'envoi est journalisé sur sa fiche.
//
// CE QUE CETTE VUE NE FAIT PAS, ET POURQUOI : les envois qui portent un processus — demande
// d'offre, mandat, demande de police, changement d'adresse — gardent leur écran. Ils écrivent des
// statuts, des dates de relance et des lignes d'historique qu'un composeur générique perdrait.
// Ici, c'est le courriel qui n'avait nulle part où aller.
//
// L'envoi passe par envoyerCourriel (js/143) : compte Outlook réel, signature, confirmation.

const _ccx = { equipe: null, t: 0, compagnies: null, tc: 0, cible: 'equipe', clientId: null, dest: new Set(), modele: 'presentation', objet: '', corps: '', docs: [], docsCoches: new Set(), locaux: [], charge: false };

const CCX_CIBLES = [
  { id: 'equipe', label: '🏢 Équipe Cofidex', aide: 'La fiduciaire, au sujet d’un client.' },
  { id: 'compagnie', label: '🛡️ Compagnie', aide: 'Le bon service : courtiers, individuel, collectif, sinistres.' },
  { id: 'client', label: '👤 Client', aide: 'Directement au client — l’envoi est classé sur sa fiche.' },
];

function ccxEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ccxNomClient(c) { return !c ? '' : (typeof estEntreprise === 'function' && estEntreprise(c)) ? (c.nom || '') : [c.prenom, c.nom].filter(Boolean).join(' '); }
function ccxClient() { return (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === _ccx.clientId) || null; }
function ccxInitiales(p) { return [(p.prenom || '')[0], (p.nom || '')[0]].filter(Boolean).join('').toUpperCase() || '?'; }

const CCX_MODELES = [
  { id: 'presentation', label: '👋 Présenter le client', objet: n => `Nouveau client — ${n}`,
    corps: (n, ide, d) => `Bonjour,\n\nJe vous présente ${n}${ide ? ` (${ide})` : ''}, que je suis côté assurances.\n\n${d.resume}\n\nJe reste à disposition pour toute question.` },
  { id: 'documents', label: '📎 Transmettre des documents', objet: n => `${n} — documents`,
    corps: (n, ide, d) => `Bonjour,\n\nVous trouverez en pièce jointe les documents de ${n}${ide ? ` (${ide})` : ''}.\n\n${d.resume}\n\nBonne réception.` },
  { id: 'question', label: '❓ Poser une question', objet: n => `${n} — question`,
    corps: (n, ide) => `Bonjour,\n\nAu sujet de ${n}${ide ? ` (${ide})` : ''} :\n\n[ta question]\n\nMerci d’avance pour ton retour.` },
  { id: 'salaires', label: '👥 Salaires et personnel', objet: n => `${n} — salaires et assurances du personnel`,
    corps: (n, ide, d) => `Bonjour,\n\nPour ${n}${ide ? ` (${ide})` : ''}, voici la situation côté assurances du personnel :\n\n${d.personnel || '—'}\n\nPouvez-vous me confirmer les masses salariales à jour ?` },
  { id: 'libre', label: '✏️ Message libre', objet: n => n || 'Message', corps: () => 'Bonjour,\n\n' },
];

// Modèles propres à chaque carnet. Pour une compagnie, le message part des contrats que le client
// a CHEZ ELLE : numéro de police et produit, c'est ce qu'on cite dans la première ligne.
const CCX_MODELES_COMPAGNIE = [
  { id: 'question-contrat', label: '❓ Question sur un contrat', objet: n => `${n} — question`,
    corps: (n, ide, d) => `Madame, Monsieur,\n\nConcernant notre client ${n}${ide ? ` (${ide})` : ''} :\n\n${d.chezElle}\n\n[ta question]\n\nJe vous remercie d’avance de votre retour.` },
  { id: 'document', label: '📎 Demande de document', objet: n => `${n} — demande de document`,
    corps: (n, ide, d) => `Madame, Monsieur,\n\nPourriez-vous nous faire parvenir, pour notre client ${n}${ide ? ` (${ide})` : ''} :\n\n[document demandé]\n\n${d.chezElle}\n\nAvec nos remerciements.` },
  { id: 'sinistre', label: '⚠️ Annoncer un sinistre', objet: n => `${n} — annonce de sinistre`,
    corps: (n, ide, d) => `Madame, Monsieur,\n\nNous vous annonçons un sinistre pour notre client ${n}${ide ? ` (${ide})` : ''}.\n\n${d.chezElle}\n\nDate et circonstances : [à compléter]\n\nMerci de nous indiquer la marche à suivre et les pièces nécessaires.` },
  { id: 'modification', label: '✏️ Modification de contrat', objet: n => `${n} — modification`,
    corps: (n, ide, d) => `Madame, Monsieur,\n\nPour notre client ${n}${ide ? ` (${ide})` : ''}, nous vous prions de bien vouloir procéder à la modification suivante :\n\n[modification demandée]\n\n${d.chezElle}\n\nMerci de nous confirmer la prise en compte.` },
  { id: 'libre', label: '✏️ Message libre', objet: n => n || 'Message', corps: () => 'Madame, Monsieur,\n\n' },
];

const CCX_MODELES_CLIENT = [
  { id: 'information', label: '💬 Information', objet: n => `Votre dossier — ${n}`,
    corps: (n, ide, d) => `Bonjour,\n\n${d.resume}\n\nJe reste à votre disposition pour toute question.` },
  { id: 'documents', label: '📎 Transmettre des documents', objet: () => 'Vos documents',
    corps: () => 'Bonjour,\n\nVous trouverez en pièce jointe les documents annoncés.\n\nBonne réception, et à disposition pour toute question.' },
  { id: 'libre', label: '✏️ Message libre', objet: () => 'Message', corps: () => 'Bonjour,\n\n' },
];

function ccxModeles() {
  return _ccx.cible === 'compagnie' ? CCX_MODELES_COMPAGNIE : _ccx.cible === 'client' ? CCX_MODELES_CLIENT : CCX_MODELES;
}

// Les contacts compagnie qui ont une adresse, groupés par compagnie (table compagnies_contacts,
// écran Paramètres → Contacts compagnies, js/100).
async function ccxCompagnies(forcer) {
  if (!forcer && _ccx.compagnies && Date.now() - _ccx.tc < 300000) return _ccx.compagnies;
  const r = await dbGet('compagnies_contacts', 'select=id,compagnie,service,libelle_contact,email,telephone,ordre&order=compagnie.asc,ordre.asc');
  _ccx.compagnies = (Array.isArray(r) ? r : []).filter(c => c.email);
  _ccx.tc = Date.now();
  return _ccx.compagnies;
}

async function ccxEquipe(forcer) {
  if (!forcer && _ccx.equipe && Date.now() - _ccx.t < 300000) return _ccx.equipe;
  const r = await dbGet('equipe_cofidex', 'actif=is.true&select=id,prenom,nom,email,fonction,email_a_verifier,ordre&order=ordre');
  _ccx.equipe = Array.isArray(r) ? r : [];
  _ccx.t = Date.now();
  return _ccx.equipe;
}

function ccxContexte(client) {
  const contrats = (typeof allContrats !== 'undefined' ? allContrats : [])
    .filter(x => x.client_id === (client && client.id) && !['résilié', 'annulé', 'mandat_resilie'].includes(x.statut || ''));
  const ligne = ct => `- ${ct.produit || 'Contrat'}${ct.compagnie ? ' · ' + ct.compagnie : ''}${ct.numero_police ? ' · police ' + ct.numero_police : ''}${ct.prime_annuelle ? ' · CHF ' + fmtCHF(Math.round(ct.prime_annuelle)) + '/an' : ''}${ct.date_echeance ? ' · échéance ' + fmtDate(String(ct.date_echeance).slice(0, 10)) : ''}`;
  const perso = contrats.filter(ct => /laa|lpp|perte de gain|maladie|accident/i.test(ct.produit || ''));
  // Quand on écrit à une compagnie, seuls ses contrats à elle comptent : on les reconnaît aux
  // destinataires choisis (une adresse de compagnies_contacts porte le nom de sa compagnie).
  const cies = new Set((_ccx.compagnies || []).filter(x => _ccx.dest.has(x.email)).map(x => String(x.compagnie || '').toLowerCase()));
  const siens = cies.size ? contrats.filter(ct => cies.has(String(ct.compagnie || '').toLowerCase())) : [];
  return {
    resume: contrats.length ? `Contrats en cours :\n${contrats.map(ligne).join('\n')}` : 'Aucun contrat enregistré à ce jour dans le CRM.',
    personnel: perso.length ? perso.map(ligne).join('\n') : '',
    chezElle: siens.length ? `Contrat${siens.length > 1 ? 's' : ''} concerné${siens.length > 1 ? 's' : ''} :\n${siens.map(ligne).join('\n')}`
      : (cies.size ? 'Aucun contrat enregistré chez vous pour ce client à ce jour.' : '[contrat concerné]'),
  };
}

function ccxAppliquerModele(garderTexte) {
  const c = ccxClient(), liste = ccxModeles(), m = liste.find(x => x.id === _ccx.modele) || liste[0];
  _ccx.modele = m.id;
  const nom = ccxNomClient(c) || '[client]', ide = (c && (c.ide || c.numero_ide)) || '';
  if (!garderTexte) { _ccx.objet = m.objet(nom); _ccx.corps = m.corps(nom, ide, ccxContexte(c)); }
  const o = document.getElementById('ccx-objet'), t = document.getElementById('ccx-corps');
  if (o) o.value = _ccx.objet;
  if (t) t.value = _ccx.corps;
}

// ── La vue ──────────────────────────────────────────────────────────────────────────────────────
function viewCofidex() {
  const clients = (typeof allClients !== 'undefined' ? allClients : []).filter(c => c.statut !== 'inactif')
    .map(c => ({ id: c.id, n: ccxNomClient(c) })).filter(c => c.n).sort((a, b) => a.n.localeCompare(b.n, 'fr'));
  const c = ccxClient();
  if (!_ccx.corps) ccxAppliquerModele();
  setTimeout(() => { ccxRendreDestinataires(); ccxChargerDocuments(); ccxMajApercu(); }, 0);
  const cible = CCX_CIBLES.find(x => x.id === _ccx.cible) || CCX_CIBLES[0];
  return `<div class="ccx-vue">
    <header class="dx-tete"><div><div class="dx-surtitre">Courriel sortant</div><h2>✉️ Écrire un e-mail</h2>
      <p class="dx-sous">À l’équipe Cofidex, à une compagnie ou au client : le message se remplit avec sa situation et ses documents. L’aperçu à droite montre ce qui part, signature comprise.</p></div></header>

    <section class="ccx-equipe-bloc dbx-carte">
      <div class="ccx-bloc-tete"><b>Destinataires</b><span id="ccx-compte" class="ccx-doux">aucun</span></div>
      <div class="ccx-onglets" role="tablist">
        ${CCX_CIBLES.map(t => `<button type="button" role="tab" class="ccx-onglet ${t.id === _ccx.cible ? 'actif' : ''}"
          aria-selected="${t.id === _ccx.cible}" onclick="ccxChangerCible('${t.id}')">${t.label}</button>`).join('')}
      </div>
      <div class="ccx-aide-cible">${ccxEsc(cible.aide)}</div>
      <div class="ccx-equipe" id="ccx-equipe"><span class="ccx-doux">Chargement…</span></div>
      <label class="form-label" for="ccx-autres">Autres adresses <small>(séparées par des virgules)</small></label>
      <input class="form-input" id="ccx-autres" placeholder="prenom@cofidex.ch, courtiers@compagnie.ch" oninput="ccxMajApercu()"/>
    </section>

    <div class="ccx-grille">
      <section class="dbx-carte ccx-form">
        <div class="form-field"><label class="form-label" for="ccx-client">Client concerné</label>
          <input class="form-input" id="ccx-client" list="ccx-clients" placeholder="Rechercher un client…" value="${ccxEsc(ccxNomClient(c))}" onchange="ccxChoisirClient(this.value)"/>
          <datalist id="ccx-clients">${clients.map(x => `<option value="${ccxEsc(x.n)}"></option>`).join('')}</datalist></div>
        <div class="form-field"><label class="form-label" for="ccx-modele">Motif</label>
          <select class="form-select" id="ccx-modele" onchange="_ccx.modele=this.value;ccxAppliquerModele();ccxMajApercu()">
            ${ccxModeles().map(m => `<option value="${m.id}" ${m.id === _ccx.modele ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
          ${_ccx.cible === 'compagnie' ? `<p class="ccx-renvoi">Pour une <b>demande d’offre</b>, passe par l’affaire : le suivi des réponses et des relances s’y fait tout seul.
            <button type="button" class="dbx-lien" onclick="navigate('nouvelle-demande-offre')">Ouvrir une demande d’offre →</button></p>` : ''}</div>
        <div class="form-field"><label class="form-label" for="ccx-objet">Objet</label>
          <input class="form-input" id="ccx-objet" value="${ccxEsc(_ccx.objet)}" oninput="_ccx.objet=this.value;ccxMajApercu()"/></div>
        <div class="form-field"><label class="form-label" for="ccx-corps">Message</label>
          <textarea class="form-input" id="ccx-corps" rows="16" oninput="_ccx.corps=this.value;ccxMajApercu()">${ccxEsc(_ccx.corps)}</textarea></div>
        <div class="form-field"><label class="form-label">Pièces jointes <small>documents du client</small></label>
          <div id="ccx-pj" class="ccx-pj"><span class="ccx-doux">Choisis d’abord un client.</span></div>
          <label class="ccx-ajout">+ Fichier de l’ordinateur<input type="file" multiple hidden onchange="ccxAjouterFichiers(this)"/></label></div>
        <div class="ccx-actions">
          <button type="button" class="btn-secondary" onclick="ccxCopier()">📋 Copier</button>
          <button type="button" class="btn-save" id="ccx-envoyer" onclick="ccxEnvoyer()">📨 Envoyer via Outlook</button>
        </div>
      </section>

      <section class="ccx-apercu-zone" aria-label="Aperçu du courriel">
        <div class="ccx-barre"><b>Aperçu</b> <small>tel que l’équipe le recevra</small></div>
        <div class="ccx-fenetre"><div class="ccx-tete" id="ccx-apercu-tete"></div><iframe id="ccx-apercu" title="Contenu du courriel" sandbox="allow-same-origin"></iframe></div>
      </section>
    </div>
  </div>`;
}

function ccxRendreEquipe(equipe) {
  const z = document.getElementById('ccx-equipe');
  if (!z) return;
  z.innerHTML = equipe.length ? equipe.map(p => {
    const sans = !p.email;
    const choisi = p.email && _ccx.dest.has(p.email);
    return `<button type="button" class="ccx-personne ${choisi ? 'choisie' : ''} ${sans ? 'sans' : ''}" ${sans ? 'disabled' : ''}
      onclick="ccxBasculer('${ccxEsc(p.email || '')}')" title="${sans ? 'Adresse à renseigner' : ccxEsc(p.email)}">
      <span class="ccx-avatar">${ccxEsc(ccxInitiales(p))}</span>
      <span class="ccx-qui"><b>${ccxEsc([p.prenom, p.nom].filter(Boolean).join(' '))}</b>
        <small>${ccxEsc(p.fonction || '')}</small>
        <em>${sans ? 'adresse à renseigner' : ccxEsc(p.email)}${p.email_a_verifier && p.email ? ' · à vérifier' : ''}</em></span>
      <span class="ccx-coche">${choisi ? '✓' : ''}</span>
    </button>`;
  }).join('') : '<span class="ccx-doux">Aucun membre enregistré.</span>';
}

// Les contacts d'une compagnie, un bloc par compagnie et une carte par service : c'est le service
// qui compte (écrire à l'individuel pour une affaire collective coûte des jours — voir js/100).
async function ccxRendreCompagnies() {
  const z = document.getElementById('ccx-equipe');
  if (!z) return;
  const contacts = await ccxCompagnies();
  if (!contacts.length) {
    z.innerHTML = `<span class="ccx-doux">Aucun contact compagnie avec une adresse.
      <button type="button" class="dbx-lien" onclick="navigate('contacts-services')">Les renseigner →</button></span>`;
    return;
  }
  const parCie = new Map();
  contacts.forEach(c => { const k = c.compagnie || '(sans nom)'; if (!parCie.has(k)) parCie.set(k, []); parCie.get(k).push(c); });
  z.innerHTML = [...parCie.entries()].map(([cie, liste]) => `<div class="ccx-cie">
    <div class="ccx-cie-tete">${typeof pictoCompagnie === 'function' ? pictoCompagnie(cie, 22) : ''}<b>${ccxEsc(cie)}</b></div>
    ${liste.map(c => {
      const choisi = _ccx.dest.has(c.email);
      const service = typeof csvService === 'function' ? csvService(c.service).nom : (c.service || 'Contact');
      return `<button type="button" class="ccx-personne ${choisi ? 'choisie' : ''}" onclick="ccxBasculer('${ccxEsc(c.email)}')" title="${ccxEsc(c.email)}">
        <span class="ccx-qui"><b>${ccxEsc(service)}</b>
          <small>${ccxEsc(c.libelle_contact || '')}</small>
          <em>${ccxEsc(c.email)}</em></span>
        <span class="ccx-coche">${choisi ? '✓' : ''}</span></button>`;
    }).join('')}
  </div>`).join('');
}

// Le client lui-même : une seule carte, celle de son adresse.
function ccxRendreClient() {
  const z = document.getElementById('ccx-equipe');
  if (!z) return;
  const c = ccxClient();
  if (!c) { z.innerHTML = '<span class="ccx-doux">Choisis d’abord un client ci-dessous.</span>'; return; }
  const email = String((typeof rlEmailClient === 'function' ? rlEmailClient(c) : c.email) || '').trim();
  if (!email) {
    z.innerHTML = `<span class="ccx-doux">Pas d’adresse e-mail sur la fiche de ${ccxEsc(ccxNomClient(c))}.
      <button type="button" class="dbx-lien" onclick="showClient('${c.id}')">Ouvrir sa fiche →</button></span>`;
    return;
  }
  const choisi = _ccx.dest.has(email);
  z.innerHTML = `<button type="button" class="ccx-personne ${choisi ? 'choisie' : ''}" onclick="ccxBasculer('${ccxEsc(email)}')" title="${ccxEsc(email)}">
    <span class="ccx-avatar">${ccxEsc(ccxInitiales({ prenom: c.prenom, nom: c.nom }))}</span>
    <span class="ccx-qui"><b>${ccxEsc(ccxNomClient(c))}</b><small>client</small><em>${ccxEsc(email)}</em></span>
    <span class="ccx-coche">${choisi ? '✓' : ''}</span></button>`;
}

function ccxRendreDestinataires() {
  if (_ccx.cible === 'compagnie') return ccxRendreCompagnies();
  if (_ccx.cible === 'client') return ccxRendreClient();
  return ccxEquipe().then(ccxRendreEquipe);
}

// Changer de carnet remet les destinataires à zéro : une adresse d'équipe n'a rien à faire dans un
// courriel à une compagnie, et le modèle de message change avec elle.
function ccxChangerCible(id) {
  if (!CCX_CIBLES.some(x => x.id === id) || id === _ccx.cible) return;
  _ccx.cible = id;
  _ccx.dest = new Set();
  _ccx.modele = ccxModeles()[0].id;
  ccxAppliquerModele();
  navigate(currentView, { silent: true });
}

function ccxBasculer(email) {
  if (!email) return;
  if (_ccx.dest.has(email)) _ccx.dest.delete(email); else _ccx.dest.add(email);
  ccxRendreDestinataires();
  // Le texte suit les destinataires : pour une compagnie, il cite les contrats qu'elle couvre.
  if (_ccx.cible === 'compagnie') ccxAppliquerModele();
  ccxMajApercu();
}

function ccxChoisirClient(nom) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => ccxNomClient(x) === String(nom || '').trim());
  if (!c) { showError('Client introuvable — choisis-le dans la liste.'); return; }
  _ccx.clientId = c.id; _ccx.docs = []; _ccx.docsCoches = new Set();
  ccxAppliquerModele();
  ccxRendreDestinataires();   // le carnet « Client » dépend de lui
  ccxChargerDocuments();
  ccxMajApercu();
}

async function ccxChargerDocuments() {
  const z = document.getElementById('ccx-pj');
  const c = ccxClient();
  if (!z) return;
  if (!c) { z.innerHTML = '<span class="ccx-doux">Choisis d’abord un client.</span>'; return; }
  z.innerHTML = '<span class="ccx-doux">Lecture des documents…</span>';
  const items = [];
  try {
    const m = await dbGet('mandats_signes', `client_id=eq.${c.id}&signe=is.true&archive=is.false&select=id&limit=1`);
    if (Array.isArray(m) && m[0]) items.push({ nom: 'Mandat de courtage signé.pdf', source: 'mandat signé', mandat: true });
    const docs = await dbGet('documents_compagnies', `client_id=eq.${c.id}&select=id,titre,nom_fichier,chemin,type&order=created_at.desc&limit=30`);
    (Array.isArray(docs) ? docs : []).forEach(d => { if (d.chemin) items.push({ nom: d.nom_fichier || d.titre || 'Document', source: d.type || 'document', path: d.chemin }); });
  } catch (e) { /* liste facultative */ }
  _ccx.docs = items;
  z.innerHTML = (items.length ? items.map((it, i) => `<label class="ccx-doc"><input type="checkbox" data-doc="${i}" ${_ccx.docsCoches.has(i) ? 'checked' : ''} onchange="ccxCocherDoc(${i}, this.checked)"/><span>📄 ${ccxEsc(it.nom)}<small>${ccxEsc(it.source)}</small></span></label>`).join('')
    : '<span class="ccx-doux">Aucun document rangé sur ce client.</span>')
    + _ccx.locaux.map((f, i) => `<span class="ccx-doc fige">💻 ${ccxEsc(f.name)}<button type="button" onclick="ccxRetirerLocal(${i})" title="Retirer">✕</button></span>`).join('');
}

function ccxCocherDoc(i, oui) { if (oui) _ccx.docsCoches.add(i); else _ccx.docsCoches.delete(i); ccxMajApercu(); }
function ccxAjouterFichiers(input) { [...(input.files || [])].forEach(f => _ccx.locaux.push(f)); input.value = ''; ccxChargerDocuments(); ccxMajApercu(); }
function ccxRetirerLocal(i) { _ccx.locaux.splice(i, 1); ccxChargerDocuments(); ccxMajApercu(); }

function ccxDestinataires() {
  const libres = (document.getElementById('ccx-autres')?.value || '').split(/[,;\s]+/).filter(x => /@/.test(x));
  return [...new Set([..._ccx.dest, ...libres])];
}

// ── L'aperçu, construit avec les mêmes fonctions que l'envoi ────────────────────────────────────
async function ccxMajApercu() {
  const dest = ccxDestinataires();
  const cpt = document.getElementById('ccx-compte');
  if (cpt) cpt.textContent = dest.length ? dest.join(', ') : 'aucun';
  const b = document.getElementById('ccx-envoyer');
  // Un client est nécessaire dès que le message parle de lui ; le message libre s'en passe.
  if (b) b.disabled = !dest.length || (!_ccx.clientId && _ccx.modele !== 'libre');
  const tete = document.getElementById('ccx-apercu-tete'), f = document.getElementById('ccx-apercu');
  if (!tete || !f) return;
  const ag = typeof sigAgent === 'function' ? await sigAgent().catch(() => null) : null;
  const compte = typeof sigCompteOutlook === 'function' ? await sigCompteOutlook().catch(() => null) : null;
  const moi = (compte && compte.nom) || (ag && [ag.prenom, ag.nom].filter(Boolean).join(' ')) || '';
  const adresse = (compte && compte.adresse) || (ag && ag.email) || '';
  const pj = [..._ccx.docs.filter((_, i) => _ccx.docsCoches.has(i)).map(d => d.nom), ..._ccx.locaux.map(f2 => f2.name)];
  tete.innerHTML = `<div class="ccx-objet-ap">${ccxEsc(_ccx.objet) || '<i>(sans objet)</i>'}</div>
    <div class="ccx-exp"><span class="ccx-avatar petit">${ccxEsc((moi.split(/\s+/).map(x => x[0] || '').join('') || '✉').slice(0, 2).toUpperCase())}</span>
      <div><div><b>${ccxEsc(moi)}</b> <span class="ccx-doux">${ccxEsc(adresse)}</span></div>
        <div class="ccx-doux">À ${dest.length ? dest.map(ccxEsc).join(', ') : '—'}</div></div></div>
    ${pj.length ? `<div class="ccx-pj-ap">${pj.map(n => `<span>📄 ${ccxEsc(n)}</span>`).join('')}</div>` : ''}`;
  const texte = typeof sigTexteVersHtml === 'function' && ag ? sigTexteVersHtml(_ccx.corps, ag)
    : `<div style="font-family:Aptos,Calibri,Arial,sans-serif;font-size:11pt">${ccxEsc(_ccx.corps).replace(/\n/g, '<br>')}</div>`;
  let sig = (ag && ag.signature_email_actif && ag.signature_email_html) || '';
  if (sig && typeof sigImages === 'function') {
    const imgs = await sigImages(ag).catch(() => []);
    imgs.forEach(im => { sig = sig.split(`cid:${im.contentId}`).join(`data:${im.contentType};base64,${im.contentBytes}`); });
  }
  f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:18px 20px;background:#fff;color:#000;font-family:Aptos,Calibri,Arial,sans-serif}img{max-width:100%;height:auto}</style></head><body>${texte}${sig ? '<br>' + sig : ''}</body></html>`;
}

function ccxCopier() {
  const texte = `Objet : ${_ccx.objet}\n\n${_ccx.corps}`;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(() => showError('✓ Texte copié.'), () => showError('Copie impossible — sélectionne le texte.'));
}

async function ccxEnvoyer() {
  const dest = ccxDestinataires();
  const c = ccxClient();
  if (!dest.length) { showError('Choisis au moins un destinataire.'); return; }
  if (!c && _ccx.modele !== 'libre') { showError('Choisis le client concerné, ou passe en message libre.'); return; }
  const b = document.getElementById('ccx-envoyer');
  if (b) b.disabled = true;
  try {
    // 22.09.2026 (audit, point 2) : l'envoi passe par envoyerCourriel (js/143), qui s'occupe du
    // compte Outlook, de la signature, de l'encodage des pièces jointes et des erreurs.
    const pieces = [];
    for (const i of _ccx.docsCoches) {
      const it = _ccx.docs[i]; if (!it) continue;
      const blob = it.mandat && typeof pjeMandatDuClient === 'function' ? (await pjeMandatDuClient(c.id))?.blob
        : (typeof pjeTelecharger === 'function' ? await pjeTelecharger(it.path) : null);
      if (blob) pieces.push({ nom: it.nom, type: blob.type || 'application/pdf', blob });
    }
    for (const f of _ccx.locaux) pieces.push({ nom: f.name, type: f.type || 'application/octet-stream', blob: f });
    const quoi = { equipe: 'Cofidex', compagnie: 'compagnie', client: 'client' }[_ccx.cible] || 'courriel';
    const res = await envoyerCourriel({ a: dest, objet: _ccx.objet, texte: _ccx.corps, pieces, contexte: quoi });
    if (!res.ok) { if (b) b.disabled = false; return; }
    // Trace sur la fiche du client : c'est là qu'on la cherche, quel que soit le destinataire.
    if (c && typeof ajouterActiviteClient === 'function') {
      const a = { equipe: 'Courriel à Cofidex', compagnie: 'Courriel à la compagnie', client: 'Courriel au client' }[_ccx.cible];
      await ajouterActiviteClient(c.id, 'email', `${a} (${dest.join(', ')}) : ${_ccx.objet}`);
    }
    _ccx.locaux = []; _ccx.docsCoches = new Set();
    ccxChargerDocuments(); ccxMajApercu();
  } catch (e) { showError('Envoi impossible : ' + (e.message || e)); if (b) b.disabled = false; }
}

// 23.09.2026 : le bouton logo Cofidex de la barre latérale est remplacé par l'entrée « Écrire un
// e-mail » de la rubrique Relation client (js/03) — une vue, trois carnets, un seul chemin.
(function ccxStyles() {
  const st = document.createElement('style');
  st.textContent = `
    /* Les trois carnets d'adresses */
    .ccx-onglets { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0 6px; }
    .ccx-onglet { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted);
      border-radius: 999px; padding: 6px 13px; font-size: 12.5px; font-weight: 500; cursor: pointer; }
    .ccx-onglet:hover { border-color: var(--accent-border); color: var(--text); }
    .ccx-onglet.actif { background: var(--accent-dim); border-color: var(--accent-border); color: var(--accent); font-weight: 600; }
    .ccx-aide-cible { font-size: 11.5px; color: var(--text-muted); margin-bottom: 10px; }
    .ccx-cie { margin-bottom: 10px; }
    .ccx-cie-tete { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text); margin-bottom: 4px; }
    .ccx-renvoi { margin: 8px 0 0; font-size: 11.5px; color: var(--text-muted);
      background: var(--surface-alt); border: 1px dashed var(--border); border-radius: 10px; padding: 8px 10px; }
    .ccx-renvoi .dbx-lien { margin-left: 4px; }`;
  document.head.appendChild(st);
  const st2 = document.createElement('style');
  st2.textContent = `
    .ccx-doux { color: var(--text-muted); font-size: var(--t-xs, 11.5px); }
    .ccx-equipe-bloc { padding: 14px 16px; margin-bottom: 16px; }
    .ccx-bloc-tete { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
    .ccx-equipe { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; margin-bottom: 12px; }
    .ccx-personne { display: flex; gap: 10px; align-items: center; text-align: left; padding: 8px 10px; border: 1px solid var(--border); border-radius: 12px;
      background: var(--surface-alt); cursor: pointer; font: inherit; color: var(--text); }
    .ccx-personne:hover { border-color: var(--accent-border); }
    .ccx-personne.choisie { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
    .ccx-personne.sans { opacity: .5; cursor: not-allowed; }
    .ccx-avatar { flex: 0 0 34px; height: 34px; border-radius: 50%; background: #113679; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 12px; }
    .ccx-avatar.petit { flex-basis: 30px; height: 30px; }
    .ccx-qui { display: flex; flex-direction: column; min-width: 0; font-size: 12.5px; }
    .ccx-qui small, .ccx-qui em { color: var(--text-muted); font-size: 10.5px; font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ccx-coche { margin-left: auto; color: var(--accent); font-weight: 700; }
    .ccx-grille { display: grid; grid-template-columns: minmax(340px, 480px) 1fr; gap: 18px; align-items: start; }
    .ccx-form { display: flex; flex-direction: column; gap: 6px; padding: 16px; }
    .ccx-apercu-zone { position: sticky; top: 12px; background: #E5E7EB; border-radius: 16px; padding: 14px; }
    .ccx-barre { display: flex; gap: 8px; align-items: baseline; color: #1f2937; font-size: 12.5px; margin-bottom: 8px; }
    .ccx-barre small { color: #6b7280; }
    .ccx-fenetre { background: #fff; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.14); overflow: hidden; color: #111; }
    .ccx-tete { padding: 14px 18px 10px; border-bottom: 1px solid #e5e7eb; font-family: 'Segoe UI', Arial, sans-serif; }
    .ccx-objet-ap { font-size: 16px; font-weight: 600; margin-bottom: 9px; }
    .ccx-exp { display: flex; gap: 10px; align-items: center; font-size: 12.5px; }
    .ccx-pj-ap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .ccx-pj-ap span { border: 1px solid #d1d5db; border-radius: 8px; padding: 3px 8px; font-size: 11.5px; background: #f9fafb; }
    .ccx-fenetre iframe { border: 0; width: 100%; min-height: 560px; background: #fff; }
    .ccx-pj { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
    .ccx-doc { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: pointer; background: var(--surface); }
    .ccx-doc.fige { cursor: default; } .ccx-doc button { border: 0; background: none; color: var(--text-muted); cursor: pointer; }
    .ccx-doc small { color: var(--text-muted); margin-left: 4px; font-size: 10.5px; }
    .ccx-ajout { display: inline-block; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--accent); }
    /* Le bouton d'envoi est sous le message, au bout du formulaire : on écrit, puis on envoie. */
    .ccx-actions { display: flex; gap: 10px; justify-content: flex-end; align-items: center;
      margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
    .ccx-actions .btn-save { flex: 0 0 auto; }
    @media (max-width: 1100px) { .ccx-grille { grid-template-columns: 1fr; } .ccx-apercu-zone { position: static; } }
    @media (max-width: 560px) { .ccx-actions { flex-direction: column-reverse; align-items: stretch; } }`;
  document.head.appendChild(st2);
})();
