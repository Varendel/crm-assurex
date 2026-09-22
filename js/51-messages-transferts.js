// ═══ REX CLOUD : MESSAGES CLIENTS ET TRANSFERT DE GESTION (20.09.2026) ══════════════════════════
// Deux services rendus au client depuis son espace, et leur traitement côté CRM :
//  1. « Contacter mon conseiller » — toujours rattaché à un contrat précis — et « Laisser un
//     message » quand la question ne concerne aucun contrat. Les messages arrivent dans REX CRM
//     (page Messages clients) et dans le journal de la fiche client.
//  2. « Transférer la gestion de mes contrats » — le client choisit ses compagnies et ses contrats,
//     signe son mandat de courtage à l'écran et le dépose. Le courtier génère ensuite le mandat
//     signé (mécanique existante, js/05) et l'envoie aux compagnies pour récupérer les polices.
// Aucun envoi automatique : tout e-mail passe par un aperçu et une confirmation.

const MT_STATUTS_MSG = { nouveau: 'Nouveau', lu: 'Lu', traite: 'Traité' };
const MT_STATUTS_TR = {
  nouveau: 'À traiter', mandat_genere: 'Mandat généré', envoye: 'Envoyé aux compagnies',
  termine: 'Polices reçues', annule: 'Annulé',
};
const MT_COMPAGNIES_COURANTES = ['AXA', 'Allianz', 'Bâloise', 'CSS', 'Generali', 'Groupe Mutuel', 'Helsana', 'Helvetia', 'La Mobilière', 'La Vaudoise', 'Sanitas', 'Smile', 'Sympany', 'SWICA', 'Swiss Life', 'TCS', 'Visana', 'Zurich'];

function mtEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function mtClientCourant() { return (window._ec && window._ec.client) || null; }

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CÔTÉ CLIENT (REX CLOUD)
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── Écrire au conseiller : au sujet d'un contrat, ou message libre ──────────────────────────────
function ecOuvrirMessage(contratId) {
  const E = window._ec || {};
  const ct = (E.contrats || []).find(x => x.id === contratId) || null;
  const contrats = (E.contrats || []).filter(x => ['actif', 'renouveler', 'en_cours'].includes(x.statut));
  const titre = ct ? 'Contacter mon conseiller' : 'Laisser un message';
  const sous = ct ? `${ct.produit || 'Contrat'}${ct.compagnie ? ' · ' + ct.compagnie : ''}${ct.numero_police ? ' · police ' + ct.numero_police : ''}`
    : 'Votre question ne concerne pas un contrat en particulier — écrivez-nous librement.';
  creerModale('modal-ec-message', `
    <div class="opx-modale mdx-modale mdx-modale-flex" role="dialog" aria-modal="true" aria-labelledby="ec-msg-titre">
      ${typeof mdxTeteModale === 'function' ? mdxTeteModale(ct ? '💬' : '✉️', titre, sous, 'modal-ec-message', 'ec-msg-titre') : `<h3 id="ec-msg-titre">${mtEsc(titre)}</h3>`}
      ${!ct && contrats.length ? `<div class="form-field"><label class="form-label" for="ec-msg-contrat">Contrat concerné <span class="mdx-optionnel">facultatif</span></label>
        <select class="form-select" id="ec-msg-contrat"><option value="">Aucun contrat en particulier</option>
          ${contrats.map(x => `<option value="${x.id}">${mtEsc(x.produit || 'Contrat')} — ${mtEsc(x.compagnie || '')}${x.numero_police ? ' (' + mtEsc(x.numero_police) + ')' : ''}</option>`).join('')}
        </select></div>` : `<input type="hidden" id="ec-msg-contrat" value="${ct ? ct.id : ''}"/>`}
      <div class="form-field"><label class="form-label" for="ec-msg-sujet">Objet</label>
        <input class="form-input" id="ec-msg-sujet" maxlength="200" value="${ct ? mtEsc('Question sur ' + (ct.produit || 'mon contrat')) : ''}" placeholder="Ex. : changement d’adresse"/></div>
      <div class="form-field mdx-champ-corps"><label class="form-label" for="ec-msg-texte">Votre message</label>
        <textarea class="form-input" id="ec-msg-texte" rows="7" maxlength="5000" placeholder="Décrivez votre demande…"></textarea></div>
      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-ec-message').remove()">Annuler</button>
        <button type="button" class="btn-save" id="ec-msg-envoi" onclick="ecEnvoyerMessage()">Envoyer à mon conseiller</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
  setTimeout(() => document.getElementById('ec-msg-texte')?.focus(), 60);
}

async function ecEnvoyerMessage() {
  const c = mtClientCourant();
  if (!c) return;
  const texte = (document.getElementById('ec-msg-texte')?.value || '').trim();
  if (texte.length < 5) { showError('Votre message est un peu court — précisez votre demande.'); return; }
  const btn = document.getElementById('ec-msg-envoi');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  const contratId = document.getElementById('ec-msg-contrat')?.value || null;
  const r = await dbPost('messages_clients', {
    client_id: c.id, contrat_id: contratId || null,
    sujet: (document.getElementById('ec-msg-sujet')?.value || '').slice(0, 200) || null,
    message: texte.slice(0, 5000), canal: 'espace_client', statut: 'nouveau',
  });
  if (r && r.error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Envoyer à mon conseiller'; }
    showError('Votre message n’a pas pu être envoyé — réessayez ou écrivez à jo@cofidex.ch.');
    return;
  }
  document.getElementById('modal-ec-message')?.remove();
  showError('✓ Message transmis à votre conseiller. Il vous répondra par e-mail.');
  if (window._ec) window._ec.messages = [{ created_at: new Date().toISOString(), sujet: null, statut: 'nouveau' }, ...(window._ec.messages || [])];
}

// ── Transférer la gestion de ses contrats ───────────────────────────────────────────────────────
// Le bouton ouvre d'abord une page d'explication (Rex et sa bulle) : le client comprend ce que le
// service lui apporte et qu'il est gratuit, avant de signer (demande de Jonathan, 20.09.2026).
const EC_TEXTE_TRANSFERT = `En transférant vos contrats chez Assurex, vous bénéficiez d’un accompagnement de qualité et entièrement gratuit pour vos contrats existants, et vous êtes informé à l’échéance de vos contrats, à la recherche d’un meilleur tarif.

Nous nous occupons de récupérer vos polices et de les mettre à votre disposition sur votre cloud personnel, avec le résumé de vos couvertures. Assurance ménage, santé, véhicules : toutes vos polices digitales à portée de main.

De plus, vous pouvez déclarer vos sinistres directement depuis votre espace client : nous nous chargeons de l’enregistrement auprès de l’assureur et revenons vers vous avec une prise en charge.`;

function ecOuvrirTransfert() {
  const c = mtClientCourant();
  if (!c) return;
  creerModale('modal-ec-info-transfert', `
    <div class="opx-modale ecinfo" role="dialog" aria-modal="true" aria-labelledby="ec-info-titre">
      <button type="button" class="ecinfo-fermer" aria-label="Fermer" onclick="document.getElementById('modal-ec-info-transfert').remove()">✕</button>
      <span class="ecinfo-gratuit">Service gratuit</span>
      <h3 id="ec-info-titre">Transférer la gestion de mes assurances</h3>
      <div class="ecinfo-scene">
        <img src="assets/logos/rex-mascotte-hd.png" alt="" class="ecinfo-rex"/>
        <div class="ecinfo-bulle">${EC_TEXTE_TRANSFERT.split(/\n\s*\n/).map(p => `<p>${mtEsc(p)}</p>`).join('')}</div>
      </div>
      <div class="ecinfo-points">
        <span>✓ Vos couvertures restent inchangées</span>
        <span>✓ Résiliable en tout temps, sans frais</span>
        <span>✓ Un seul interlocuteur pour tous vos assureurs</span>
      </div>
      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-ec-info-transfert').remove()">Plus tard</button>
        <button type="button" class="btn-save" onclick="ecFormulaireTransfert()">✍️ Signer et transférer mon mandat</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
}

function ecFormulaireTransfert() {
  document.getElementById('modal-ec-info-transfert')?.remove();
  const E = window._ec || {};
  const c = mtClientCourant();
  if (!c) return;
  const connus = (E.contrats || []).filter(x => ['actif', 'renouveler', 'en_cours'].includes(x.statut));
  const cies = [...new Set([...connus.map(x => (x.compagnie || '').trim()).filter(Boolean), ...MT_COMPAGNIES_COURANTES])].sort((a, b) => a.localeCompare(b, 'fr'));
  window._ecTransfert = { lignes: [], signature: null };
  creerModale('modal-ec-transfert', `
    <div class="opx-modale mdx-modale mdx-modale-flex mdx-modale-large ect" role="dialog" aria-modal="true" aria-labelledby="ec-tr-titre">
      ${typeof mdxTeteModale === 'function' ? mdxTeteModale('🤝', 'Transférer la gestion de mes contrats', 'Nous devenons votre interlocuteur auprès de vos assureurs : nous récupérons vos polices, suivons vos échéances et vous conseillons. Vos couvertures ne changent pas.', 'modal-ec-transfert', 'ec-tr-titre') : '<h3 id="ec-tr-titre">Transférer la gestion de mes contrats</h3>'}

      <div class="ect-etape"><b>1</b> Les contrats à reprendre</div>
      ${connus.length ? `<div class="ect-connus">
        <p class="ect-aide">Contrats déjà connus chez nous — cochez ceux que nous devons reprendre :</p>
        ${connus.map(x => `<label class="ect-contrat"><input type="checkbox" class="ect-connu" value="${x.id}" checked/>
          <span>${typeof pictoCompagnie === 'function' ? pictoCompagnie(x.compagnie, 22) : ''} <b>${mtEsc(x.produit || 'Contrat')}</b> <small>${mtEsc(x.compagnie || '')}${x.numero_police ? ' · ' + mtEsc(x.numero_police) : ''}</small></span></label>`).join('')}
      </div>` : ''}
      <p class="ect-aide">Ajoutez les contrats que nous ne connaissons pas encore — la compagnie suffit, le numéro de police si vous l’avez sous la main :</p>
      <div id="ect-lignes"></div>
      <button type="button" class="btn-secondary ect-ajout" onclick="ectAjouterLigne()">+ Ajouter une compagnie</button>
      <datalist id="ect-cies">${cies.map(x => `<option value="${mtEsc(x)}"></option>`).join('')}</datalist>

      <div class="ect-etape"><b>2</b> Signature de votre mandat de courtage</div>
      <p class="ect-aide">Le mandat nous autorise à représenter vos intérêts auprès de vos assureurs et à demander vos polices. Il est résiliable en tout temps, sans frais, et n’engage aucun changement de couverture.</p>
      <div class="mdx-signature" id="ect-zone-signature">
        <canvas id="canvas-signature-transfert" class="mdx-canvas" width="460" height="180" aria-label="Zone de signature"></canvas>
        <span class="mdx-aide-signature">Signez ici avec le doigt ou la souris</span>
      </div>
      <div class="ect-sous-signature">
        <button type="button" class="btn-secondary" onclick="effacerSignature('canvas-signature-transfert')">Effacer</button>
        <small>${mtEsc((c.prenom || '') + ' ' + (c.nom || ''))} · ${mtEsc(new Date().toLocaleDateString('fr-CH'))}</small>
      </div>

      <div class="form-field"><label class="form-label" for="ect-message">Précisions pour votre conseiller <span class="mdx-optionnel">facultatif</span></label>
        <textarea class="form-input" id="ect-message" rows="3" maxlength="5000" placeholder="Ex. : je ne retrouve plus ma police auto, merci de la demander."></textarea></div>

      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary mdx-a-gauche" onclick="document.getElementById('modal-ec-transfert').remove()">Annuler</button>
        <button type="button" class="btn-save" id="ect-btn" onclick="ecDeposerTransfert()">✍️ Déposer ma demande signée</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
  ectAjouterLigne();
  setTimeout(() => {
    const cv = document.getElementById('canvas-signature-transfert');
    if (cv && typeof mdxDimensionnerCanvas === 'function') mdxDimensionnerCanvas(cv);
    if (typeof initCanvasSignature === 'function') initCanvasSignature('canvas-signature-transfert');
    cv?.addEventListener('pointerdown', () => document.getElementById('ect-zone-signature')?.classList.add('signe'));
  }, 80);
}

function ectAjouterLigne() {
  const z = document.getElementById('ect-lignes');
  if (!z) return;
  const i = z.children.length;
  const d = document.createElement('div');
  d.className = 'ect-ligne';
  d.innerHTML = `<input class="form-input" list="ect-cies" id="ect-cie-${i}" placeholder="Compagnie"/>
    <input class="form-input" id="ect-prod-${i}" placeholder="Type de contrat (auto, ménage, maladie…)"/>
    <input class="form-input" id="ect-pol-${i}" placeholder="N° de police (si connu)"/>
    <button type="button" class="ect-suppr" aria-label="Retirer cette ligne" onclick="this.parentElement.remove()">✕</button>`;
  z.appendChild(d);
}

function ectLignesSaisies() {
  const out = [];
  [...document.querySelectorAll('#ect-lignes .ect-ligne')].forEach(l => {
    const [cie, prod, pol] = [...l.querySelectorAll('input')].map(i => i.value.trim());
    if (cie) out.push({ compagnie: cie, produit: prod || null, police: pol || null, source: 'client' });
  });
  return out;
}

async function ecDeposerTransfert() {
  const c = mtClientCourant();
  if (!c) return;
  const E = window._ec || {};
  const coches = [...document.querySelectorAll('.ect-connu:checked')].map(i => i.value);
  const connus = (E.contrats || []).filter(x => coches.includes(x.id))
    .map(x => ({ compagnie: x.compagnie || '', produit: x.produit || null, police: x.numero_police || null, contrat_id: x.id, source: 'crm' }));
  const compagnies = [...connus, ...ectLignesSaisies()];
  if (!compagnies.length) { showError('Indiquez au moins une compagnie ou un contrat à reprendre.'); return; }

  const cv = document.getElementById('canvas-signature-transfert');
  let signature = null;
  if (cv) {
    const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < px.length; i += 4) { if (px[i] > 0) { signature = cv.toDataURL('image/png'); break; } }
  }
  if (!signature) { showError('Votre signature est nécessaire pour déposer le mandat.'); return; }

  const btn = document.getElementById('ect-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Dépôt en cours…'; }
  const r = await dbPost('demandes_transfert', {
    client_id: c.id, compagnies, message: (document.getElementById('ect-message')?.value || '').slice(0, 5000) || null,
    signature_data: signature, signe_le: new Date().toISOString(), statut: 'nouveau',
  });
  if (r && r.error) {
    if (btn) { btn.disabled = false; btn.textContent = '✍️ Déposer ma demande signée'; }
    showError('Le dépôt a échoué — réessayez, ou écrivez à votre conseiller.');
    return;
  }
  document.getElementById('modal-ec-transfert')?.remove();
  showError('✓ Demande déposée. Votre conseiller envoie le mandat à vos assureurs et récupère vos polices.');
  if (window._ec) window._ec.transferts = [{ created_at: new Date().toISOString(), statut: 'nouveau', compagnies }, ...(window._ec.transferts || [])];
  if (typeof ecVueEspaceClient === 'function') {
    const main = document.getElementById('main-content');
    if (main) main.innerHTML = ecVueEspaceClient();
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CÔTÉ CRM (REX CRM)
// ════════════════════════════════════════════════════════════════════════════════════════════════

let _mc = { messages: null, transferts: null, filtre: 'nouveau', onglet: 'messages' };

async function mcCharger(forcer) {
  if (_mc.messages && !forcer) return;
  const [m, t, s, d] = await Promise.all([
    dbGet('messages_clients', 'select=*&order=created_at.desc&limit=300').catch(() => []),
    dbGet('demandes_transfert', 'select=*&order=created_at.desc&limit=200').catch(() => []),
    dbGet('sinistres', 'select=*&order=created_at.desc&limit=300').catch(() => []),
    dbGet('demandes_documents', 'select=*&order=created_at.desc&limit=300').catch(() => []),
  ]);
  _mc.messages = m || []; _mc.transferts = t || []; _mc.sinistres = s || []; _mc.documents = d || [];
}
function mcNomClient(id) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === id);
  if (!c) return 'Client';
  return (typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim();
}
function mcContrat(id) { return (typeof allContrats !== 'undefined' ? allContrats : []).find(x => x.id === id) || null; }
function mcQuand(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${fmtDate(iso.slice(0, 10))} · ${d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`;
}
function mcNonLus() { return (_mc.messages || []).filter(m => m.statut === 'nouveau').length + (_mc.transferts || []).filter(t => t.statut === 'nouveau').length; }

// ── Ce qui attend une action : UNE seule définition (22.09.2026) ────────────────────────────────
// Trois écrans comptaient « les demandes clients en attente » chacun à sa façon : la pastille du
// menu (js/108 : statut « nouveau » seulement), la carte du tableau de bord (js/18 : tout ce qui
// n'est pas traité) et les indicateurs de cette page. Le menu disait 3, le tableau de bord 7.
// Désormais la règle est écrite ici, une fois : js/108 en tire ses requêtes, js/18 et
// mcTableauDeBord lisent mcDemandesEnAttente(). Changer un critère = changer cette liste.
//   statuts : valeurs qui comptent comme « en attente » ; null = tout sauf « traite ».
const MC_EN_ATTENTE = [
  { cle: 'messages', table: 'messages_clients', memoire: 'messages', statuts: null,
    un: 'message', ico: 'message', onglet: 'messages', emoji: '💬', quoi: 'Message',
    det: m => m.sujet || String(m.message || '').slice(0, 70) },
  { cle: 'transferts', table: 'demandes_transfert', memoire: 'transferts', statuts: ['nouveau', 'mandat_genere', 'envoye'],
    un: 'demande de transfert', ico: 'document', onglet: 'transferts', emoji: '🤝', quoi: 'Transfert de gestion',
    det: t => `${(t.compagnies || []).length} compagnie(s)` },
  { cle: 'sinistres', table: 'sinistres', memoire: 'sinistres', statuts: ['declare', 'transmis', 'en_cours'],
    un: 'sinistre ouvert', ico: 'sinistre', onglet: 'sinistres', emoji: '🛟', quoi: 'Sinistre',
    det: s => s.type_sinistre || '' },
  { cle: 'documents', table: 'demandes_documents', memoire: 'documents', statuts: ['nouvelle', 'en_cours'],
    un: 'demande de document', ico: 'document', onglet: 'documents', emoji: '📄', quoi: 'Document',
    det: d => d.type_document || '' },
  // Adresses et personnel : leurs cartes sont posées au-dessus des onglets (js/103, js/104),
  // d'où l'onglet « messages » par défaut au clic.
  { cle: 'adresses', table: 'demandes_adresse', memoire: 'adresses', statuts: ['nouvelle'],
    un: 'changement d’adresse', ico: 'habitation', onglet: 'messages', emoji: '🏠', quoi: 'Changement d’adresse',
    det: a => [a.npa, a.ville].filter(Boolean).join(' ') },
  { cle: 'salaries', table: 'annonces_salaries', memoire: 'salaries', statuts: ['nouvelle'],
    un: 'annonce de personnel', ico: 'personnel', onglet: 'messages', emoji: '👥', quoi: 'Annonce de personnel',
    det: () => '' },
];

function mcEstEnAttente(source, ligne) {
  if (!ligne) return false;
  return source.statuts ? source.statuts.includes(ligne.statut) : ligne.statut !== 'traite';
}

// Le même critère traduit en filtre PostgREST, pour la pastille qui interroge la base sans
// charger les listes (js/108).
function mcFiltreEnAttente(source) {
  return source.statuts ? `statut=in.(${source.statuts.join(',')})` : 'or=(statut.is.null,statut.neq.traite)';
}

// Les éléments en attente, tirés des listes chargées par mcCharger (et ses extensions js/103,
// js/104), les plus anciens d'abord : c'est le client qui attend.
function mcDemandesEnAttente() {
  const out = [];
  for (const s of MC_EN_ATTENTE) {
    const liste = (typeof _mc !== 'undefined' && _mc[s.memoire]) || [];
    for (const x of liste) {
      if (!mcEstEnAttente(s, x)) continue;
      out.push({ cle: s.cle, o: s.onglet, ico: s.emoji, quoi: s.quoi, det: s.det(x), c: x.client_id, d: x.created_at, ligne: x });
    }
  }
  return out.sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')));
}

function viewMessagesClients() {
  if (_mc.messages === null) { mcCharger().then(() => navigate('messages-clients', { silent: true })); return '<div class="loader">Chargement des messages…</div>'; }
  // 22.09.2026 : « il semblerait que j'ai un message et je ne le vois pas dans la vue ». La pastille
  // du menu compte tout ce qui attend (MC_EN_ATTENTE : un transfert « mandat généré » attend encore
  // son envoi aux compagnies), mais les onglets ne comptaient que les « nouveau » et la vue s'ouvrait
  // sur Messages, vide. Les onglets comptent désormais la même chose que la pastille, et à l'arrivée
  // on ouvre l'onglet qui contient une demande en attente (tant qu'on n'en a pas choisi un).
  const attente = mcDemandesEnAttente();
  const nbO = o => attente.filter(x => x.o === o).length;
  if (!_mc.ongletChoisi && !nbO(_mc.onglet)) {
    const o = ['messages', 'sinistres', 'documents', 'transferts'].find(k => nbO(k));
    if (o) _mc.onglet = o;
  }
  const nouveauxT = nbO('transferts');
  const msgs = (_mc.messages || []).filter(m => _mc.filtre === 'tout' || m.statut === _mc.filtre);
  return `<div class="mcx">
    <header class="dx-tete"><div><div class="dx-surtitre">REX CLOUD · demandes venues de l’espace client</div><h2>Messages clients</h2>
      <p class="dx-sous">Ce que vos clients vous écrivent depuis leur espace, et leurs demandes de transfert de gestion.</p></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-save" onclick="mcEcrireAuClient()">✉️ Écrire à un client</button>
        <button type="button" class="btn-secondary" onclick="mcCharger(true).then(() => navigate('messages-clients', { silent: true }))">↻ Actualiser</button>
      </div>
    </header>
    ${mcTableauDeBord()}
    <div class="mcx-onglets" role="tablist">
      <button type="button" role="tab" class="${_mc.onglet === 'messages' ? 'actif' : ''}${nbO('messages') ? ' a-attente' : ''}" onclick="_mc.ongletChoisi=true;_mc.onglet='messages';navigate('messages-clients',{silent:true})">💬 Messages <span>${nbO('messages')}</span></button>
      <button type="button" role="tab" class="${_mc.onglet === 'sinistres' ? 'actif' : ''}${nbO('sinistres') ? ' a-attente' : ''}" onclick="_mc.ongletChoisi=true;_mc.onglet='sinistres';navigate('messages-clients',{silent:true})">🛟 Sinistres <span>${nbO('sinistres')}</span></button>
      <button type="button" role="tab" class="${_mc.onglet === 'documents' ? 'actif' : ''}${nbO('documents') ? ' a-attente' : ''}" onclick="_mc.ongletChoisi=true;_mc.onglet='documents';navigate('messages-clients',{silent:true})">📄 Documents <span>${nbO('documents')}</span></button>
      <button type="button" role="tab" class="${_mc.onglet === 'transferts' ? 'actif' : ''}${nbO('transferts') ? ' a-attente' : ''}" onclick="_mc.ongletChoisi=true;_mc.onglet='transferts';navigate('messages-clients',{silent:true})">🤝 Transferts de gestion <span>${nouveauxT}</span></button>
    </div>
    ${_mc.onglet === 'messages' ? `
      <div class="mcx-filtres">${['nouveau', 'lu', 'traite', 'tout'].map(f => `<button type="button" class="${_mc.filtre === f ? 'actif' : ''}" onclick="_mc.filtre='${f}';navigate('messages-clients',{silent:true})">${f === 'tout' ? 'Tous' : MT_STATUTS_MSG[f]}</button>`).join('')}</div>
      <section class="dbx-carte mcx-liste">${msgs.length ? msgs.map(mcLigneMessage).join('') : '<div class="dbx-vide-petit">Aucun message dans cette vue.</div>'}</section>`
    : _mc.onglet === 'sinistres' ? `<section class="dbx-carte mcx-liste">${(_mc.sinistres || []).length ? _mc.sinistres.map(mcLigneSinistre).join('') : '<div class="dbx-vide-petit">Aucun sinistre déclaré depuis l’espace client.</div>'}</section>`
    : _mc.onglet === 'documents' ? `<section class="dbx-carte mcx-liste">${(_mc.documents || []).length ? _mc.documents.map(mcLigneDocument).join('') : '<div class="dbx-vide-petit">Aucune demande de document.</div>'}</section>`
    : `<section class="dbx-carte mcx-liste">${(_mc.transferts || []).length ? _mc.transferts.map(mcLigneTransfert).join('') : '<div class="dbx-vide-petit">Aucune demande de transfert pour l’instant.</div>'}</section>`}
  </div>`;
}

// Tableau de bord : ce qui attend une action, et la réactivité réelle (délai moyen de réponse)
function mcTableauDeBord() {
  const msgs = _mc.messages || [], trs = _mc.transferts || [];
  // 22.09.2026 : les compteurs viennent de la définition commune (MC_EN_ATTENTE) — mêmes chiffres
  // que la pastille du menu et la carte du tableau de bord. « Messages à traiter » ne comptait
  // que les « nouveau » : un message lu mais sans réponse disparaissait du compteur.
  const attente = mcDemandesEnAttente();
  const nb = cle => attente.filter(x => x.cle === cle).length;
  const nouveaux = nb('messages');
  const limite = Date.now() - 48 * 3600 * 1000;
  const enRetard = attente.filter(x => x.cle === 'messages' && new Date(x.d || 0).getTime() < limite).length;
  const trAFaire = nb('transferts');
  const lignes = trs.flatMap(t => Array.isArray(t.compagnies) ? t.compagnies : []);
  const attendues = lignes.filter(x => (x.statut || 'attendu') !== 'recu').length;
  const recues = lignes.filter(x => x.statut === 'recu').length;
  // 22.09.2026 : seuls les messages VENUS du client mesurent notre délai de réponse. Ceux que le
  // conseiller écrit lui-même (canal « conseiller ») sont enregistrés déjà traités, avec
  // repondu_le = created_at : ils tiraient la moyenne vers zéro.
  const repondus = msgs.filter(m => m.canal === 'espace_client' && m.repondu_le && m.created_at);
  const delai = repondus.length
    ? Math.round(repondus.reduce((s, m) => s + (new Date(m.repondu_le) - new Date(m.created_at)), 0) / repondus.length / 3600000)
    : null;
  // 22.09.2026 : une case qui compte quelque chose en attente s'éclaire, et un clic ouvre l'onglet.
  const k = (i, label, valeur, sous, onglet) => {
    const onclick = onglet ? `_mc.ongletChoisi=true;_mc.onglet='${onglet}';navigate('messages-clients',{silent:true})` : undefined;
    const h = typeof dbxKpi === 'function'
      ? dbxKpi({ i, label, valeur, sous, onclick })
      : `<div class="dbx-kpi"><b>${valeur}</b><span>${label}</span><small>${sous}</small></div>`;
    return onglet && Number(valeur) > 0 ? h.replace('class="dbx-kpi', 'class="dbx-kpi a-attente') : h;
  };
  const sinAFaire = nb('sinistres');
  const sinNeufs = (_mc.sinistres || []).filter(s => s.statut === 'declare').length;
  const docAFaire = nb('documents');
  return `<div class="dbx-kpis mcx-bord">
    ${k(0, 'Messages à traiter', nouveaux, `${enRetard ? `${enRetard} en attente depuis plus de 48 h` : 'tout est suivi'} · ${attente.length} demande(s) client en attente au total`, 'messages')}
    ${k(1, 'Sinistres ouverts', sinAFaire, sinNeufs ? `${sinNeufs} à annoncer à l’assureur` : 'tous annoncés', 'sinistres')}
    ${k(2, 'Documents à envoyer', docAFaire, `${(_mc.documents || []).length} demande(s) au total`, 'documents')}
    ${k(3, 'Transferts · polices', trAFaire, `${attendues} police(s) attendue(s) · ${recues} reçue(s)`, 'transferts')}
    ${k(4, 'Délai moyen de réponse', delai === null ? '—' : delai, delai === null ? 'aucune réponse enregistrée' : 'heures entre le message et la réponse')}
  </div>`;
}

// ── Écrire à un client depuis le CRM : toujours avec un motif, rattaché à un contrat ───────────
const MT_MOTIFS = [
  { v: 'echeance', l: 'Échéance / renouvellement', contrat: true },
  { v: 'prime', l: 'Prime ou facture', contrat: true },
  { v: 'sinistre', l: 'Sinistre', contrat: true },
  { v: 'document', l: 'Document manquant', contrat: true },
  { v: 'modification', l: 'Modification du contrat', contrat: true },
  { v: 'offre', l: 'Offre / comparatif', contrat: false },
  { v: 'rendez_vous', l: 'Proposition de rendez-vous', contrat: false },
  { v: 'autre', l: 'Autre information', contrat: false },
];

function mcEcrireAuClient(clientId) {
  document.getElementById('modal-onglet-admin')?.remove();
  const clients = (typeof allClients !== 'undefined' ? allClients : []).map(x => ({ id: x.id, n: mcNomClient(x.id) })).filter(x => x.n).sort((a, b) => a.n.localeCompare(b.n, 'fr'));
  creerModale('modal-mc-ecrire', `
    <div class="opx-modale mdx-modale mdx-modale-flex mdx-modale-large" role="dialog" aria-modal="true" aria-labelledby="mc-ecr-titre">
      ${typeof mdxTeteModale === 'function' ? mdxTeteModale('✉️', 'Écrire à mon client', 'Chaque message part avec un motif et, quand il s’applique, le contrat concerné — pour que l’échange reste rattaché au bon dossier.', 'modal-mc-ecrire', 'mc-ecr-titre') : '<h3 id="mc-ecr-titre">Écrire à mon client</h3>'}
      <div class="form-field"><label class="form-label" for="mc-ecr-client">Client</label>
        <input class="form-input" id="mc-ecr-client" list="mc-ecr-clients" value="${clientId ? mtEsc(mcNomClient(clientId)) : ''}" placeholder="Rechercher un client…" onchange="mcEcrireChoisirClient(this.value)"/>
        <datalist id="mc-ecr-clients">${clients.map(x => `<option value="${mtEsc(x.n)}"></option>`).join('')}</datalist></div>
      <div class="form-field"><label class="form-label" for="mc-ecr-motif">Motif</label>
        <select class="form-select" id="mc-ecr-motif" onchange="mcEcrireMajMotif()">${MT_MOTIFS.map(m => `<option value="${m.v}">${mtEsc(m.l)}</option>`).join('')}</select></div>
      <div class="form-field"><label class="form-label" for="mc-ecr-contrat">Contrat concerné</label>
        <select class="form-select" id="mc-ecr-contrat" onchange="mcEcrireMajTexte()"></select>
        <small class="mdx-aide" id="mc-ecr-aide">Obligatoire pour ce motif.</small></div>
      <div class="form-field"><label class="form-label" for="mc-ecr-sujet">Objet</label><input class="form-input" id="mc-ecr-sujet"/></div>
      <div class="form-field mdx-champ-corps"><label class="form-label" for="mc-ecr-corps">Message</label><textarea class="form-input" id="mc-ecr-corps" rows="10"></textarea></div>
      <div class="opx-modale-actions mdx-actions mdx-actions-envoi">
        <button type="button" class="btn-secondary mdx-a-gauche" onclick="document.getElementById('modal-mc-ecrire').remove()">Fermer</button>
        <button type="button" class="btn-save" onclick="mcEnvoyerAuClient()">📨 Envoyer via Outlook…</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
  window._mcEcrire = { clientId: clientId || null };
  mcEcrireMajMotif();
}

function mcEcrireChoisirClient(nom) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => mcNomClient(x.id) === String(nom || '').trim());
  if (!c) { showError('Client introuvable — choisis-le dans la liste.'); return; }
  window._mcEcrire = { ...(window._mcEcrire || {}), clientId: c.id };
  mcEcrireMajMotif();
}

function mcEcrireContratsClient() {
  const id = (window._mcEcrire || {}).clientId;
  if (!id) return [];
  return (typeof allContrats !== 'undefined' ? allContrats : [])
    .filter(ct => ct.client_id === id && !['annulé', 'annulée', 'resilie', 'résilié'].includes(String(ct.statut || '').toLowerCase()));
}

function mcEcrireMajMotif() {
  const motif = MT_MOTIFS.find(m => m.v === (document.getElementById('mc-ecr-motif')?.value || '')) || MT_MOTIFS[0];
  const sel = document.getElementById('mc-ecr-contrat');
  const contrats = mcEcrireContratsClient();
  if (sel) {
    sel.innerHTML = (motif.contrat ? '' : '<option value="">Aucun contrat en particulier</option>')
      + contrats.map(ct => `<option value="${ct.id}">${mtEsc(ct.produit || 'Contrat')} — ${mtEsc(ct.compagnie || '')}${ct.numero_police ? ' (' + mtEsc(ct.numero_police) + ')' : ''}</option>`).join('');
    if (motif.contrat && !contrats.length) sel.innerHTML = '<option value="">Aucun contrat sur cette fiche</option>';
  }
  const aide = document.getElementById('mc-ecr-aide');
  if (aide) aide.textContent = motif.contrat ? 'Obligatoire pour ce motif : le message sera classé sur ce contrat.' : 'Facultatif pour ce motif.';
  mcEcrireMajTexte();
}

function mcEcrireMajTexte() {
  const motif = MT_MOTIFS.find(m => m.v === (document.getElementById('mc-ecr-motif')?.value || '')) || MT_MOTIFS[0];
  const ct = mcEcrireContratsClient().find(x => x.id === (document.getElementById('mc-ecr-contrat')?.value || ''));
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === (window._mcEcrire || {}).clientId);
  const moi = typeof crxMoi === 'function' ? crxMoi() : { nom: '', email: '', tel: '' };
  const civ = c && c.civilite === 'Madame' ? 'Madame,' : c && c.civilite === 'Monsieur' ? 'Monsieur,' : 'Madame, Monsieur,';
  const ref = ct ? `${ct.produit || 'contrat'} ${ct.compagnie || ''}${ct.numero_police ? ' (police ' + ct.numero_police + ')' : ''}`.trim() : '';
  const intro = {
    echeance: ct ? `Votre contrat ${ref} arrive à échéance${ct.date_echeance ? ' le ' + fmtDate(ct.date_echeance) : ''}. Je vous propose d’en faire le point ensemble.` : 'Je reviens vers vous au sujet de l’échéance de vos contrats.',
    prime: ct ? `Je reviens vers vous au sujet de la prime de votre contrat ${ref}.` : 'Je reviens vers vous au sujet de votre prime.',
    sinistre: ct ? `Je reviens vers vous concernant le sinistre annoncé sur votre contrat ${ref}.` : 'Je reviens vers vous concernant votre sinistre.',
    document: ct ? `Afin de compléter votre dossier ${ref}, il me manque encore le document suivant :` : 'Afin de compléter votre dossier, il me manque encore le document suivant :',
    modification: ct ? `Suite à notre échange, je prépare la modification de votre contrat ${ref}.` : 'Suite à notre échange, je prépare la modification de vos couvertures.',
    offre: 'Je vous transmets l’offre que nous avons préparée pour vous.',
    rendez_vous: 'Je vous propose de faire le point ensemble lors d’un court rendez-vous.',
    autre: '',
  }[motif.v] || '';
  const sujet = { echeance: 'Échéance de votre contrat', prime: 'Votre prime', sinistre: 'Votre sinistre', document: 'Document manquant',
    modification: 'Modification de votre contrat', offre: 'Votre offre', rendez_vous: 'Proposition de rendez-vous', autre: 'Votre dossier' }[motif.v];
  const s = document.getElementById('mc-ecr-sujet');
  if (s) s.value = `${sujet}${ct && ct.compagnie ? ' — ' + ct.compagnie : ''}`;
  const t = document.getElementById('mc-ecr-corps');
  if (t) t.value = [civ, '', intro, '', 'Meilleures salutations', '', moi.nom, moi.email, moi.tel].filter(x => x !== undefined).join('\n');
}

async function mcEnvoyerAuClient() {
  const ctx = window._mcEcrire || {};
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === ctx.clientId);
  if (!c) { showError('Choisis d’abord le client.'); return; }
  const motif = MT_MOTIFS.find(m => m.v === (document.getElementById('mc-ecr-motif')?.value || '')) || MT_MOTIFS[0];
  const contratId = document.getElementById('mc-ecr-contrat')?.value || '';
  if (motif.contrat && !contratId) { showError('Ce motif doit être rattaché à un contrat — choisis-en un ou change de motif.'); return; }
  const to = String(c.email || '').trim();
  if (!/@/.test(to)) { showError('Pas d’adresse e-mail sur cette fiche client.'); return; }
  const sujet = document.getElementById('mc-ecr-sujet')?.value || '';
  const corps = document.getElementById('mc-ecr-corps')?.value || '';
  if (!confirm(`Envoyer ce message à ${to} depuis ton compte Outlook ?`)) return;
  if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) { showError('Connecte-toi à Outlook pour envoyer.'); return; }
  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST', headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { subject: sujet, body: { contentType: 'text', content: corps }, toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: true }),
    });
    if (!r.ok) { showError('Échec de l’envoi via Outlook.'); return; }
  } catch (e) { showError('Erreur réseau : ' + e.message); return; }
  const moi = typeof crxMoi === 'function' ? crxMoi() : { nom: '' };
  await dbPost('messages_clients', {
    client_id: c.id, contrat_id: contratId || null, sujet: `${motif.l} — ${sujet}`.slice(0, 200),
    message: corps.slice(0, 5000), canal: 'conseiller', statut: 'traite',
    reponse: null, repondu_par: moi.nom || null, repondu_le: new Date().toISOString(),
  });
  await dbPost('activites_client', { client_id: c.id, type: 'email', sujet: sujet.slice(0, 300), contenu: corps.slice(0, 10000), auteur: (moi.nom || '').slice(0, 200) });
  document.getElementById('modal-mc-ecrire')?.remove();
  showError(`✓ Message envoyé à ${to} et classé sur la fiche.`);
  if (_mc.messages) await mcCharger(true);
  // 22.09.2026 : la liste était rechargée en mémoire mais pas redessinée — le message envoyé
  // n'apparaissait qu'au prochain passage sur la page.
  if (typeof currentView !== 'undefined' && currentView === 'messages-clients') navigate('messages-clients', { silent: true });
}

function mcLigneMessage(m) {
  const ct = mcContrat(m.contrat_id);
  return `<article class="mcx-msg ${m.statut === 'nouveau' ? 'neuf' : ''}">
    <div class="mcx-msg-tete">
      <button type="button" class="mcx-nom" onclick="showClient('${m.client_id}')">${mtEsc(mcNomClient(m.client_id))}</button>
      <span class="mcx-badge mcx-badge-${m.statut}">${MT_STATUTS_MSG[m.statut] || m.statut}</span>
      <span class="mcx-date">${mtEsc(mcQuand(m.created_at))}</span>
    </div>
    ${ct ? `<div class="mcx-contrat">${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 18) : ''} ${mtEsc(ct.produit || 'Contrat')}${ct.numero_police ? ' · police ' + mtEsc(ct.numero_police) : ''}</div>` : '<div class="mcx-contrat mcx-libre">Message libre</div>'}
    ${m.sujet ? `<div class="mcx-sujet">${mtEsc(m.sujet)}</div>` : ''}
    <p class="mcx-texte">${mtEsc(m.message).replace(/\n/g, '<br/>')}</p>
    ${m.reponse ? `<div class="mcx-reponse"><b>Réponse (${mtEsc(m.repondu_par || '')}, ${mtEsc(mcQuand(m.repondu_le))})</b><p>${mtEsc(m.reponse).replace(/\n/g, '<br/>')}</p></div>` : ''}
    <div class="mcx-actions">
      <button type="button" class="btn-secondary" onclick="mcRepondre('${m.id}')">✉️ Répondre…</button>
      ${m.statut !== 'traite' ? `<button type="button" class="btn-secondary" onclick="mcStatut('${m.id}', 'traite')">✓ Marquer traité</button>` : ''}
      ${m.statut === 'nouveau' ? `<button type="button" class="btn-secondary" onclick="mcStatut('${m.id}', 'lu')">👁️ Marquer lu</button>` : ''}
    </div>
  </article>`;
}

async function mcStatut(id, statut) {
  const r = await dbPatch('messages_clients', id, { statut });
  if (r && r.error) { showError('Mise à jour impossible.'); return; }
  const m = (_mc.messages || []).find(x => x.id === id);
  if (m) m.statut = statut;
  navigate('messages-clients', { silent: true });
}

function mcRepondre(id) {
  const m = (_mc.messages || []).find(x => x.id === id);
  if (!m) return;
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === m.client_id);
  const moi = typeof crxMoi === 'function' ? crxMoi() : { nom: '', email: '', tel: '' };
  const civ = c && c.civilite === 'Madame' ? 'Madame,' : c && c.civilite === 'Monsieur' ? 'Monsieur,' : 'Madame, Monsieur,';
  const corps = [civ, '', 'Merci pour votre message.', '', '', 'Meilleures salutations', '', moi.nom, moi.email, moi.tel].filter(x => x !== undefined).join('\n');
  creerModale('modal-mc-reponse', `
    <div class="opx-modale mdx-modale mdx-modale-flex mdx-modale-large" role="dialog" aria-modal="true" aria-labelledby="mc-rep-titre">
      ${typeof mdxTeteModale === 'function' ? mdxTeteModale('✉️', 'Répondre au client', mtEsc(mcNomClient(m.client_id)) + ' — rien n’est envoyé automatiquement', 'modal-mc-reponse', 'mc-rep-titre') : '<h3 id="mc-rep-titre">Répondre</h3>'}
      <div class="mcx-rappel"><b>Son message :</b><p>${mtEsc(m.message).replace(/\n/g, '<br/>')}</p></div>
      <div class="form-field"><label class="form-label" for="mc-rep-a">À</label><input class="form-input" id="mc-rep-a" value="${mtEsc((c && c.email) || '')}"/></div>
      <div class="form-field"><label class="form-label" for="mc-rep-sujet">Objet</label><input class="form-input" id="mc-rep-sujet" value="${mtEsc('Re : ' + (m.sujet || 'votre message'))}"/></div>
      <div class="form-field mdx-champ-corps"><label class="form-label" for="mc-rep-corps">Réponse</label><textarea class="form-input" id="mc-rep-corps" rows="10">${mtEsc(corps)}</textarea></div>
      <div class="opx-modale-actions mdx-actions mdx-actions-envoi">
        <button type="button" class="btn-secondary mdx-a-gauche" onclick="document.getElementById('modal-mc-reponse').remove()">Fermer</button>
        <button type="button" class="btn-secondary" onclick="mcEnregistrerReponse('${id}', false)">💾 Noter la réponse (sans e-mail)</button>
        <button type="button" class="btn-save" onclick="mcEnregistrerReponse('${id}', true)">📨 Envoyer via Outlook…</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
}

async function mcEnregistrerReponse(id, envoyer) {
  const m = (_mc.messages || []).find(x => x.id === id);
  if (!m) return;
  const to = (document.getElementById('mc-rep-a')?.value || '').split(/[;,\s]+/).filter(x => /@/.test(x));
  const sujet = document.getElementById('mc-rep-sujet')?.value || '';
  const corps = document.getElementById('mc-rep-corps')?.value || '';
  const moi = typeof crxMoi === 'function' ? crxMoi() : { nom: '', email: '' };
  if (envoyer) {
    if (!to.length) { showError('Indique une adresse e-mail.'); return; }
    if (!confirm(`Envoyer cette réponse à ${to.join(', ')} depuis ton compte Outlook ?`)) return;
    if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) { showError('Connecte-toi à Outlook pour envoyer.'); return; }
    try {
      const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST', headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { subject: sujet, body: { contentType: 'text', content: corps }, toRecipients: to.map(a => ({ emailAddress: { address: a } })) }, saveToSentItems: true }),
      });
      if (!r.ok) { showError('Échec de l’envoi via Outlook.'); return; }
    } catch (e) { showError('Erreur réseau : ' + e.message); return; }
  }
  const maj = { reponse: corps, repondu_par: moi.nom || moi.email || '', repondu_le: new Date().toISOString(), statut: 'traite' };
  const r = await dbPatch('messages_clients', id, maj);
  if (r && r.error) { showError('Réponse non enregistrée.'); return; }
  Object.assign(m, maj);
  if (envoyer) {
    await dbPost('activites_client', { client_id: m.client_id, type: 'email', sujet: sujet.slice(0, 300), contenu: corps.slice(0, 10000), auteur: (moi.nom || '').slice(0, 200) });
    showError(`✓ Réponse envoyée à ${to.join(', ')}.`);
  } else showError('✓ Réponse enregistrée.');
  document.getElementById('modal-mc-reponse')?.remove();
  navigate('messages-clients', { silent: true });
}

// ── Sinistres déclarés depuis l'espace client ───────────────────────────────────────────────────
const MT_ETATS_SINISTRE = { declare: 'Déclaré', transmis: 'Transmis à l’assureur', en_cours: 'En cours',
  regle: 'Réglé', refuse: 'Refusé', annule: 'Annulé' };

function mcLigneSinistre(s) {
  const ct = mcContrat(s.contrat_id);
  return `<article class="mcx-msg ${s.statut === 'declare' ? 'neuf' : ''}">
    <div class="mcx-msg-tete">
      <button type="button" class="mcx-nom" onclick="showClient('${s.client_id}')">${mtEsc(mcNomClient(s.client_id))}</button>
      <span class="mcx-badge mcx-badge-${s.statut === 'declare' ? 'nouveau' : s.statut === 'regle' ? 'traite' : 'lu'}">${MT_ETATS_SINISTRE[s.statut] || s.statut}</span>
      <span class="mcx-date">déclaré ${mtEsc(mcQuand(s.created_at))}</span>
    </div>
    <div class="mcx-contrat">🛟 <b>${mtEsc(s.type_sinistre || 'Sinistre')}</b>${s.date_sinistre ? ` · survenu le ${fmtDate(s.date_sinistre)}` : ''}${s.lieu ? ' · ' + mtEsc(s.lieu) : ''}
      ${ct ? ` · ${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 16) : ''} ${mtEsc(ct.produit || '')}${ct.numero_police ? ' (' + mtEsc(ct.numero_police) + ')' : ''}` : ' · <i>contrat non précisé</i>'}</div>
    <p class="mcx-texte">${mtEsc(s.description || '').replace(/\n/g, '<br/>')}</p>
    ${s.tiers ? `<div class="mcx-contrat">Tiers : ${mtEsc(s.tiers)}</div>` : ''}
    ${s.montant_estime ? `<div class="mcx-contrat">Dommage estimé : CHF ${fmtCHF(Math.round(s.montant_estime))}</div>` : ''}
    ${s.reference_assureur ? `<div class="mcx-contrat">Référence assureur : <b>${mtEsc(s.reference_assureur)}</b></div>` : ''}
    <div class="mcx-actions">
      ${s.statut === 'declare' ? `<button type="button" class="btn-save" onclick="mcStatutSinistre('${s.id}', 'transmis', true)">📨 Transmis à l’assureur…</button>` : ''}
      ${['declare', 'transmis'].includes(s.statut) ? `<button type="button" class="btn-secondary" onclick="mcStatutSinistre('${s.id}', 'en_cours')">⏳ En cours</button>` : ''}
      ${s.statut !== 'regle' ? `<button type="button" class="btn-secondary" onclick="mcStatutSinistre('${s.id}', 'regle')">✓ Réglé</button>` : ''}
      <button type="button" class="btn-secondary" onclick="mcEcrireAuClient('${s.client_id}')">✉️ Écrire au client</button>
    </div>
  </article>`;
}

async function mcStatutSinistre(id, statut, demanderReference) {
  const s = (_mc.sinistres || []).find(x => x.id === id);
  if (!s) return;
  const maj = { statut, traite_par: (typeof crxMoi === 'function' ? crxMoi().nom : '') || null, traite_le: new Date().toISOString() };
  if (demanderReference) {
    const ref = prompt('Référence du sinistre chez l’assureur (facultatif) :', s.reference_assureur || '');
    if (ref === null) return;
    if (ref.trim()) maj.reference_assureur = ref.trim().slice(0, 100);
  }
  const r = await dbPatch('sinistres', id, maj);
  if (r && r.error) { showError('Mise à jour impossible.'); return; }
  Object.assign(s, maj);
  navigate('messages-clients', { silent: true });
}

// ── Demandes de documents ───────────────────────────────────────────────────────────────────────
const MT_ETATS_DOC = { nouvelle: 'À traiter', en_cours: 'En cours', envoye: 'Envoyé au client', refuse: 'Non disponible' };

function mcLigneDocument(d) {
  const ct = mcContrat(d.contrat_id);
  return `<article class="mcx-msg ${d.statut === 'nouvelle' ? 'neuf' : ''}">
    <div class="mcx-msg-tete">
      <button type="button" class="mcx-nom" onclick="showClient('${d.client_id}')">${mtEsc(mcNomClient(d.client_id))}</button>
      <span class="mcx-badge mcx-badge-${d.statut === 'nouvelle' ? 'nouveau' : d.statut === 'envoye' ? 'traite' : 'lu'}">${MT_ETATS_DOC[d.statut] || d.statut}</span>
      <span class="mcx-date">${mtEsc(mcQuand(d.created_at))}</span>
    </div>
    <div class="mcx-contrat">📄 <b>${mtEsc(d.type_document)}</b>${ct ? ` · ${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 16) : ''} ${mtEsc(ct.produit || '')}${ct.numero_police ? ' (' + mtEsc(ct.numero_police) + ')' : ''}` : ''}</div>
    ${d.precisions ? `<p class="mcx-texte">${mtEsc(d.precisions).replace(/\n/g, '<br/>')}</p>` : ''}
    <div class="mcx-actions">
      <button type="button" class="btn-secondary" onclick="mcEcrireAuClient('${d.client_id}')">✉️ Envoyer le document…</button>
      ${d.statut !== 'envoye' ? `<button type="button" class="btn-save" onclick="mcStatutDocument('${d.id}', 'envoye')">✓ Marquer envoyé</button>` : ''}
      ${d.statut === 'nouvelle' ? `<button type="button" class="btn-secondary" onclick="mcStatutDocument('${d.id}', 'en_cours')">⏳ En cours</button>` : ''}
    </div>
  </article>`;
}

async function mcStatutDocument(id, statut) {
  const d = (_mc.documents || []).find(x => x.id === id);
  if (!d) return;
  const maj = { statut, traite_par: (typeof crxMoi === 'function' ? crxMoi().nom : '') || null, traite_le: new Date().toISOString() };
  const r = await dbPatch('demandes_documents', id, maj);
  if (r && r.error) { showError('Mise à jour impossible.'); return; }
  Object.assign(d, maj);
  navigate('messages-clients', { silent: true });
}

// ── Demandes de transfert de gestion ────────────────────────────────────────────────────────────
// Suivi pièce par pièce : pour chaque compagnie demandée, on sait où en est la police (attendue,
// relancée, reçue) et on dépose le PDF reçu directement ici (demande de Jonathan, 20.09.2026).
const MT_ETATS_POLICE = { attendu: 'Police attendue', relance: 'Relancée', recu: 'Police reçue' };

function mcLigneTransfert(t) {
  const cies = Array.isArray(t.compagnies) ? t.compagnies : [];
  const recues = cies.filter(x => x.statut === 'recu').length;
  return `<article class="mcx-msg ${t.statut === 'nouveau' ? 'neuf' : ''}">
    <div class="mcx-msg-tete">
      <button type="button" class="mcx-nom" onclick="showClient('${t.client_id}')">${mtEsc(mcNomClient(t.client_id))}</button>
      <span class="mcx-badge mcx-badge-${t.statut === 'nouveau' ? 'nouveau' : t.statut === 'termine' ? 'traite' : 'lu'}">${MT_STATUTS_TR[t.statut] || t.statut}</span>
      <span class="mcx-compte">${recues} / ${cies.length} police(s) reçue(s)</span>
      <span class="mcx-date">${mtEsc(mcQuand(t.created_at))}</span>
    </div>
    ${t.message ? `<p class="mcx-texte">${mtEsc(t.message).replace(/\n/g, '<br/>')}</p>` : ''}
    <div class="mcx-polices">${cies.map((x, i) => mcLignePolice(t, x, i)).join('') || '<div class="dbx-vide-petit">Aucune compagnie indiquée.</div>'}</div>
    ${t.signature_data ? `<div class="mcx-signature"><small>Mandat signé le ${mtEsc(mcQuand(t.signe_le || t.created_at))}</small><img src="${t.signature_data}" alt="Signature du client"/></div>` : '<div class="mcx-texte">⚠️ Aucune signature déposée.</div>'}
    <div class="mcx-actions">
      <button type="button" class="btn-save" onclick="mcGenererMandat('${t.id}')" ${t.signature_data ? '' : 'disabled'}>📄 Générer le mandat signé</button>
      <button type="button" class="btn-secondary" onclick="mcEnvoyerAuxCompagnies('${t.id}')">✉️ Envoyer aux compagnies…</button>
      ${/* 22.09.2026 : le module « Demandes de polices » (js/63) n'était relié à rien —
           dpGenererDepuisTransfert n'était jamais appelé. Il prépare une demande par compagnie,
           sans rien envoyer : l'envoi reste sur la page Demandes de polices, après relecture. */ ''}
      ${typeof dpGenererDepuisTransfert === 'function' && ['nouveau', 'mandat_genere', 'envoye'].includes(t.statut) ? `<button type="button" class="btn-secondary" onclick="dpGenererDepuisTransfert('${t.id}')">📨 Générer les demandes de polices</button>` : ''}
      ${t.statut !== 'termine' ? `<button type="button" class="btn-secondary" onclick="mcStatutTransfert('${t.id}', 'termine')">✓ Dossier terminé</button>` : ''}
    </div>
  </article>`;
}

function mcLignePolice(t, x, i) {
  const etat = x.statut || 'attendu';
  return `<div class="mcx-police ${etat}">
    <span class="mcx-police-cie">${typeof pictoCompagnie === 'function' ? pictoCompagnie(x.compagnie, 20) : ''} <b>${mtEsc(x.compagnie)}</b>${x.produit ? `<small>${mtEsc(x.produit)}</small>` : ''}${x.police ? `<small>police ${mtEsc(x.police)}</small>` : ''}${x.source === 'client' ? '<em>à créer</em>' : ''}</span>
    <span class="mcx-police-etat">${MT_ETATS_POLICE[etat]}${x.police_nom ? ` · ${mtEsc(x.police_nom)}` : ''}</span>
    <span class="mcx-police-actions">
      ${etat !== 'recu' ? `<button type="button" class="mcx-mini" onclick="mcEtatPolice('${t.id}', ${i}, 'relance')">📣 Relancée</button>` : ''}
      <label class="mcx-mini mcx-depot">📎 Déposer la police<input type="file" accept="application/pdf" hidden onchange="mcDeposerPolice('${t.id}', ${i}, this)"/></label>
      ${etat !== 'recu' ? `<button type="button" class="mcx-mini" onclick="mcEtatPolice('${t.id}', ${i}, 'recu')">✓ Reçue</button>`
        : `<button type="button" class="mcx-mini" onclick="mcCreerContratDepuis('${t.id}', ${i})">➕ Créer le contrat</button>`}
    </span>
  </div>`;
}

async function mcEnregistrerCompagnies(t) {
  const tousRecus = (t.compagnies || []).length && (t.compagnies || []).every(x => x.statut === 'recu');
  const corps = { compagnies: t.compagnies };
  if (tousRecus && t.statut !== 'termine') { corps.statut = 'termine'; corps.traite_le = new Date().toISOString(); t.statut = 'termine'; }
  const r = await dbPatch('demandes_transfert', t.id, corps);
  if (r && r.error) { showError('Mise à jour impossible : ' + (typeof errMsg === 'function' ? errMsg(r) : '')); return false; }
  navigate('messages-clients', { silent: true });
  return true;
}

async function mcEtatPolice(id, i, statut) {
  const t = (_mc.transferts || []).find(x => x.id === id);
  if (!t || !Array.isArray(t.compagnies) || !t.compagnies[i]) return;
  t.compagnies[i] = { ...t.compagnies[i], statut, date_statut: new Date().toISOString() };
  await mcEnregistrerCompagnies(t);
}

// Dépôt de la police reçue : même bucket privé que les polices des contrats (documents/polices/…)
async function mcDeposerPolice(id, i, input) {
  const t = (_mc.transferts || []).find(x => x.id === id);
  const file = input.files && input.files[0];
  if (!t || !file) return;
  if (file.type !== 'application/pdf') { showError('Seuls les PDF sont acceptés.'); input.value = ''; return; }
  if (file.size > 10 * 1024 * 1024) { showError('Fichier trop lourd — maximum 10 Mo.'); input.value = ''; return; }
  const cie = (t.compagnies[i] || {}).compagnie || 'compagnie';
  const nom = `${cie}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const chemin = `polices/transferts/${t.id}/${nom}.pdf`;
  showError('⏳ Dépôt de la police…');
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const entetes = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' };
    let up = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${chemin}`, { method: 'POST', headers: entetes, body: file });
    if (!up.ok) up = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${chemin}`, { method: 'PUT', headers: entetes, body: file });
    if (!up.ok) throw new Error('échec du dépôt');
  } catch (e) { showError('Dépôt impossible : ' + e.message); input.value = ''; return; }
  t.compagnies[i] = { ...t.compagnies[i], statut: 'recu', police_url: chemin, police_nom: file.name, date_statut: new Date().toISOString() };
  if (await mcEnregistrerCompagnies(t)) {
    showError('✓ Police déposée et classée.');
    if (typeof logAction === 'function') logAction('upload_police', 'demandes_transfert', t.id, file.name);
  }
  input.value = '';
}

function mcCreerContratDepuis(id, i) {
  const t = (_mc.transferts || []).find(x => x.id === id);
  const x = t && Array.isArray(t.compagnies) ? t.compagnies[i] : null;
  if (!x) return;
  // Préremplissage du formulaire Nouveau contrat avec ce que le client a indiqué : compagnie et
  // n° de police seulement — le produit se choisit dans le catalogue, on ne devine pas à sa place.
  window.contratClientId = t.client_id;
  navigate('nouveau-contrat');
  setTimeout(() => {
    const cie = document.getElementById('ct-compagnie');
    if (cie && x.compagnie) { cie.value = x.compagnie; cie.dispatchEvent(new Event('input')); cie.dispatchEvent(new Event('change')); }
    const pol = document.getElementById('ct-police');
    if (pol && x.police) pol.value = x.police;
    if (x.produit) showError(`Contrat indiqué par le client : « ${x.produit} » — choisis la catégorie et le produit correspondants.`);
  }, 250);
}

async function mcStatutTransfert(id, statut) {
  const moi = typeof crxMoi === 'function' ? crxMoi() : { nom: '' };
  const r = await dbPatch('demandes_transfert', id, { statut, traite_par: moi.nom || null, traite_le: new Date().toISOString() });
  if (r && r.error) { showError('Mise à jour impossible.'); return; }
  const t = (_mc.transferts || []).find(x => x.id === id);
  if (t) t.statut = statut;
  navigate('messages-clients', { silent: true });
}

async function mcGenererMandat(id) {
  const t = (_mc.transferts || []).find(x => x.id === id);
  if (!t || !t.signature_data) return;
  if (typeof genererMandatCourtage !== 'function') { showError('Module mandat indisponible.'); return; }
  const r = await genererMandatCourtage(t.client_id, t.signature_data, {});
  if (r && r.error) return; // genererMandatCourtage affiche déjà l'erreur
  await mcStatutTransfert(id, 'mandat_genere');
  showError('✓ Mandat signé généré et classé dans la fiche du client.');
}

function mcEnvoyerAuxCompagnies(id) {
  const t = (_mc.transferts || []).find(x => x.id === id);
  if (!t) return;
  if (typeof ouvrirEnvoiMandatCompagnies !== 'function') { showError('Module d’envoi indisponible.'); return; }
  // Mémorise les compagnies demandées par le client pour les cocher dans la fenêtre d'envoi
  window._mcCiesDemandees = (Array.isArray(t.compagnies) ? t.compagnies : []).map(x => (x.compagnie || '').toLowerCase());
  ouvrirEnvoiMandatCompagnies(t.client_id);
  setTimeout(() => {
    let n = 0;
    document.querySelectorAll('#mdx-cies .mdx-cie').forEach(l => {
      const nom = (l.getAttribute('data-nom') || '');
      if (window._mcCiesDemandees.some(c => c && nom.includes(c))) { const cb = l.querySelector('input'); if (cb && !cb.checked) { cb.checked = true; n++; } }
    });
    if (typeof mdxMajCompteur === 'function') mdxMajCompteur();
    if (n) showError(`${n} compagnie(s) demandée(s) par le client pré-cochée(s).`);
  }, 120);
  // 22.09.2026 : le statut passait à « Envoyé aux compagnies » dès l'OUVERTURE du choix des
  // compagnies — un simple clic suivi d'« Annuler » suffisait à faire croire au client (js/98) et
  // au cabinet que le mandat était parti. On mémorise le dossier ; le statut n'est posé qu'une
  // fois l'envoi Outlook réussi (voir mcBrancherEnvoiMandat ci-dessous).
  window._mcTransfertEnvoi = { transfertId: id, clientId: t.client_id };
}

// Le module d'envoi du mandat (js/05) n'annonce pas sa réussite. On l'enveloppe : l'envoi est
// réussi quand, l'appel terminé, l'aperçu a été refermé par la fonction elle-même (elle ne le
// ferme qu'après un sendMail accepté ; annulation, erreur ou refus Outlook le laissent ouvert).
(function mcBrancherEnvoiMandat() {
  if (typeof envoyerApercuEmailMandatViaOutlook !== 'function') return;
  const origine = envoyerApercuEmailMandatViaOutlook;
  window.envoyerApercuEmailMandatViaOutlook = async function () {
    const suivi = window._mcTransfertEnvoi;
    const ctx = window._apercuEmailMandat;
    const r = await origine.apply(this, arguments);
    const envoye = !document.getElementById('modal-apercu-email-mandat');
    if (envoye && suivi && ctx && ctx.clientId === suivi.clientId) {
      window._mcTransfertEnvoi = null;
      const t = (_mc.transferts || []).find(x => x.id === suivi.transfertId);
      if (t && (t.statut === 'nouveau' || t.statut === 'mandat_genere')) await mcStatutTransfert(t.id, 'envoye');
    }
    return r;
  };
})();
