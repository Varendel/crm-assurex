// ═══ SUPPRIMER UNE FICHE CLIENT VIERGE (20.09.2026) ════════════════════════════════════════════
// « Si je supprime une fiche client vierge, j'aimerais la voir disparaître. »
//
// Deux choses ne marchaient pas, et ce n'était pas la même.
//
// 1. LA FICHE VIERGE ÉTAIT ARCHIVÉE, PAS SUPPRIMÉE. La règle du cabinet — on n'efface jamais un
//    client — protège des DONNÉES. Une fiche vierge n'en a aucune : c'est une coquille créée par
//    erreur, un doublon abandonné, un essai. L'archiver revient à empiler des fantômes.
//    La vérification qu'une fiche est bien vide se fait CÔTÉ SERVEUR (fonction Postgres
//    supprimer_client_vierge) et non ici : un contrôle écrit en JavaScript peut être contourné
//    par un bug, un copier-coller malheureux ou un appel direct. Le serveur, lui, compte dans les
//    vingt-huit tables qui peuvent rattacher un client et refuse s'il trouve quoi que ce soit —
//    y compris un client parrainé. Ce fichier ne fait que demander ; c'est le serveur qui décide.
//
// 2. LES FICHES ARCHIVÉES NE DISPARAISSAIENT PAS NON PLUS. La fenêtre de confirmation promettait
//    « disparaît des listes courantes », mais l'archivage ne posait qu'un statut « inactif » que
//    les listes n'excluaient pas. On pose maintenant un vrai drapeau `archive`, et les listes le
//    respectent — avec une case pour les revoir, parce qu'un client archivé n'est pas un client
//    effacé et qu'on doit pouvoir le retrouver.

function scEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const SC_LIBELLES = {
  contrats: 'contrat', commissions_attente: 'commission', commissions: 'commission',
  opportunites: 'affaire', rappels: 'tâche', factures: 'facture', mandats_signes: 'mandat signé',
  vehicules: 'véhicule', collaborateurs: 'collaborateur', postits: 'post-it', sinistres: 'sinistre',
  rendez_vous: 'rendez-vous', acces_clients: 'accès à l’espace client', activites_client: 'activité',
  bilans_prevoyance: 'bilan de prévoyance', campagnes_suivi: 'suivi de campagne',
  demandes_devis: 'demande de devis', demandes_documents: 'demande de document',
  demandes_offre: 'demande d’offre', demandes_polices: 'demande de police',
  demandes_transfert: 'demande de transfert', documents_compagnies: 'document',
  dossiers_conseil: 'dossier de conseil', dossiers_financement: 'dossier de financement',
  ecohub_correspondances: 'correspondance EcoHub', messages_clients: 'message',
  notifications_clients: 'notification', signature_requests: 'demande de signature',
  clients_parraines: 'client parrainé',
};

function scPhrase(liens) {
  return Object.entries(liens || {}).map(([t, n]) => {
    const l = SC_LIBELLES[t] || t;
    return `${n} ${l}${n > 1 && !l.endsWith('s') ? 's' : ''}`;
  }).join(', ');
}

// ── Appeler une fonction du serveur, sans confondre « vide » et « échec » ───────────────────────
// dbRpc() renvoie null quand l'appel échoue (droits, réseau, fonction absente) et un TABLEAU
// quand il réussit. Un premier jet écrivait `liens = r || {}` : un refus d'autorisation devenait
// alors un objet vide, donc « aucun rattachement », donc « fiche vierge » — et l'écran proposait
// de supprimer définitivement un client qui avait deux contrats. Le serveur l'aurait refusé, mais
// l'interface aurait menti, ce qui est déjà une faute.
//
// Règle appliquée ici : tant qu'on n'a pas une réponse EXPLICITE du serveur, on ne conclut rien.
// Le défaut, en cas de doute, est la voie prudente — l'archivage.
async function scRpc(fonction, params) {
  let r = null;
  try { r = await dbRpc(fonction, params); }
  catch (e) { return { erreur: String(e.message || e) }; }
  if (r === null || r === undefined) {
    return { erreur: 'le serveur n’a pas répondu (droits insuffisants, ou fonction indisponible)' };
  }
  const v = Array.isArray(r) ? r[0] : r;
  if (v === null || v === undefined || typeof v !== 'object') {
    return { erreur: 'réponse inattendue du serveur' };
  }
  if (v.error) return { erreur: typeof errMsg === 'function' ? errMsg(v) : String(v.error) };
  return { valeur: v };
}

// ── La fenêtre de confirmation ──────────────────────────────────────────────────────────────────
// Elle interroge le serveur AVANT de s'afficher : on ne propose pas « supprimer définitivement »
// pour découvrir ensuite que ce n'était pas possible. Ce qui est proposé est ce qui va se passer.
async function scConfirmerSuppression(clientId, nomClient) {
  if (typeof creerModale !== 'function') return;

  creerModale('modal-suppression-client', `
    <div class="sc-modale">
      <h3>${scEsc(nomClient)}</h3>
      <p class="sc-attente"><span class="sc-spin" aria-hidden="true"></span>Vérification de ce qui est rattaché à cette fiche…</p>
    </div>`, { opacite: .78, padding: '16px', overflowY: false });

  const res = await scRpc('client_rattachements', { p_client: clientId });
  const liens = res.valeur || {};
  const erreur = res.erreur;

  const boite = document.querySelector('#modal-suppression-client .sc-modale');
  if (!boite) return;   // la fenêtre a été fermée entre-temps

  if (erreur) {
    boite.innerHTML = `<h3>${scEsc(nomClient)}</h3>
      <p class="sc-erreur">Impossible de vérifier cette fiche : ${scEsc(erreur)}</p>
      <div class="sc-actions"><button type="button" class="btn-secondary"
        onclick="document.getElementById('modal-suppression-client').remove()">Fermer</button></div>`;
    return;
  }

  const vierge = !Object.keys(liens).length;
  boite.innerHTML = vierge ? scVierge(clientId, nomClient) : scPleine(clientId, nomClient, liens);
}

function scVierge(clientId, nomClient) {
  return `
    <span class="sc-surtitre">Fiche vierge</span>
    <h3>Supprimer ${scEsc(nomClient)} ?</h3>
    <p>Cette fiche ne porte aucun contrat, aucune affaire, aucun document, aucun historique.
      Il n’y a rien à conserver : elle sera <b>réellement supprimée</b>.</p>
    <p class="sc-note">C’est irréversible — mais il n’y a rien à perdre, c’est justement ce que la
      vérification vient d’établir.</p>
    <div class="sc-actions">
      <button type="button" class="btn-secondary" onclick="document.getElementById('modal-suppression-client').remove()">Annuler</button>
      <button type="button" class="sc-danger" onclick="scSupprimer('${clientId}', this)">Supprimer définitivement</button>
    </div>`;
}

function scPleine(clientId, nomClient, liens) {
  return `
    <span class="sc-surtitre">Fiche avec des données</span>
    <h3>Archiver ${scEsc(nomClient)} ?</h3>
    <p>Cette fiche porte <b>${scEsc(scPhrase(liens))}</b>. Rien ne sera effacé : le client passe en
      archivé et disparaît des listes courantes.</p>
    <ul class="sc-liste">
      <li>Les contrats en vigueur passent en « annulé »</li>
      <li>Les commissions encore attendues sont annulées ; l’encaissé reste dans l’historique</li>
      <li>Factures, mandats, rappels et notes : conservés</li>
    </ul>
    <p class="sc-note">Vous pourrez le retrouver en cochant « Afficher les archivés » dans les listes.</p>
    <div class="sc-actions">
      <button type="button" class="btn-secondary" onclick="document.getElementById('modal-suppression-client').remove()">Annuler</button>
      <button type="button" class="sc-danger" onclick="scArchiver('${clientId}', this)">Archiver</button>
    </div>`;
}

// ── La suppression réelle ───────────────────────────────────────────────────────────────────────
async function scSupprimer(clientId, btn) {
  btn.textContent = 'Suppression…'; btn.disabled = true;
  const res = await scRpc('supprimer_client_vierge', { p_client: clientId });
  const r = res.valeur;

  if (res.erreur || !r || r.ok !== true) {
    // Le refus vient du serveur : quelque chose a pu être rattaché à la fiche entre la
    // vérification et le clic, ou l'appel n'a pas abouti. Dans les deux cas on ne touche à rien.
    const motif = res.erreur ? `Suppression impossible : ${res.erreur}.` : (r && r.motif) || 'Suppression refusée.';
    const detail = r && r.rattachements ? ` (${scPhrase(r.rattachements)})` : '';
    if (typeof showError === 'function') showError(motif + detail);
    btn.textContent = 'Supprimer définitivement'; btn.disabled = false;
    return;
  }

  if (typeof logAction === 'function') logAction('supprimer_client_vierge', 'clients', clientId, r.nom || '');
  document.getElementById('modal-suppression-client')?.remove();

  // On retire la fiche de la liste en mémoire plutôt que de tout recharger : la disparition est
  // immédiate, et c'est précisément ce qui était demandé.
  if (typeof allClients !== 'undefined') {
    const i = allClients.findIndex(c => c.id === clientId);
    if (i >= 0) allClients.splice(i, 1);
  }
  if (typeof showError === 'function') showError(`✓ Fiche supprimée — ${r.nom || 'sans nom'}`);
  scRetourListe();
}

// ── L'archivage ─────────────────────────────────────────────────────────────────────────────────
// On garde le traitement de js/05 (contrats annulés, commissions attendues annulées) et on ajoute
// le drapeau qui manquait pour que la fiche sorte enfin des listes.
async function scArchiver(clientId, btn) {
  btn.textContent = 'Archivage…'; btn.disabled = true;
  const auj = new Date().toLocaleDateString('fr-CH');

  for (const c of (typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : [])
    .filter(c => c.client_id === clientId && ['en_attente', 'en_attente_naissance'].includes(c.statut))) {
    const r = await dbPatch('commissions_attente', c.id, {
      statut: 'annulée',
      detail_calcul: `Annulée le ${auj} (client archivé). ${c.detail_calcul || ''}`,
    });
    if (r && r.error) { showError('Archivage interrompu : ' + errMsg(r)); btn.textContent = 'Archiver'; btn.disabled = false; return; }
    c.statut = 'annulée';
  }
  for (const ct of (typeof allContrats !== 'undefined' ? allContrats : [])
    .filter(ct => ct.client_id === clientId && !['résilié', 'annulé', 'mandat_resilie'].includes(ct.statut))) {
    const r = await dbPatch('contrats', ct.id, { statut: 'annulé' });
    if (r && r.error) { showError('Archivage interrompu : ' + errMsg(r)); btn.textContent = 'Archiver'; btn.disabled = false; return; }
    ct.statut = 'annulé';
  }

  const cl = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === clientId);
  const maj = { statut: 'inactif', archive: true, notes: `${cl && cl.notes ? cl.notes + '\n' : ''}Archivé le ${auj}.` };
  const rc = await dbPatch('clients', clientId, maj);
  if (rc && rc.error) { showError('Erreur lors de l’archivage : ' + errMsg(rc)); btn.textContent = 'Archiver'; btn.disabled = false; return; }
  if (cl) Object.assign(cl, maj);

  if (typeof logAction === 'function') logAction('archiver_client', 'clients', clientId, 'Client archivé (non supprimé)');
  document.getElementById('modal-suppression-client')?.remove();
  if (typeof showError === 'function') showError('✓ Client archivé — rien n’a été effacé.');
  scRetourListe();
}

// Revenir là où la fiche était visible. Si l'on était SUR la fiche supprimée, y rester afficherait
// un écran vide : on remonte à la liste.
function scRetourListe() {
  if (typeof navigate !== 'function') return;
  const vue = typeof currentView !== 'undefined' ? currentView : '';
  const listes = ['clients', 'clients-prives', 'clients-entreprises', 'portefeuille'];
  navigate(listes.includes(vue) ? vue : 'clients');
}

// ── Les archivés sortent des listes ─────────────────────────────────────────────────────────────
window._scArchives = false;

function scBasculerArchives(v) {
  window._scArchives = !!v;
  if (typeof renderPortefeuilleTable === 'function' && document.getElementById('pf-table-container')) {
    renderPortefeuilleTable(window._arb ? window._arb.filtre : 'tous');
  } else if (typeof renderClientsTable === 'function') {
    renderClientsTable();
  }
}

(function scBrancher() {
  // On remplace la confirmation de js/05 : elle proposait l'archivage pour tout le monde, y
  // compris pour une coquille vide.
  if (typeof confirmerSuppressionClient === 'function') window.confirmerSuppressionClient = scConfirmerSuppression;

  // Les listes filtrent les archivés. On enveloppe plutôt que de réécrire les deux rendus :
  // le temps du rendu, allClients ne contient que les fiches à montrer.
  const filtrer = (nom) => {
    if (typeof window[nom] !== 'function') return;
    const origine = window[nom];
    window[nom] = function () {
      if (window._scArchives || typeof allClients === 'undefined') return origine.apply(this, arguments);
      const complet = allClients;
      const visibles = complet.filter(c => !c.archive);
      if (visibles.length === complet.length) return origine.apply(this, arguments);
      allClients = visibles;
      try { return origine.apply(this, arguments); }
      finally { allClients = complet; }   // toujours restauré, même si le rendu échoue
    };
  };
  filtrer('renderPortefeuilleTable');
  filtrer('renderClientsTable');

  // La case pour les revoir. Elle n'apparaît que s'il existe au moins une fiche archivée : une
  // case qui ne change jamais rien est du bruit dans une barre de filtres déjà chargée.
  if (typeof viewPortefeuille === 'function') {
    const origine = viewPortefeuille;
    window.viewPortefeuille = function () {
      const html = origine.apply(this, arguments);
      const n = (typeof allClients !== 'undefined' ? allClients : []).filter(c => c.archive).length;
      if (!n) return html;
      const case_ = `
        <label class="sc-case" title="Les fiches archivées ne sont pas effacées : elles sont seulement retirées des listes.">
          <input type="checkbox" ${window._scArchives ? 'checked' : ''} onchange="scBasculerArchives(this.checked)"/>
          Afficher les ${n} archivée${n > 1 ? 's' : ''}
        </label>`;
      return html.replace('</div>\n    <div id="pf-stats"', case_ + '</div>\n    <div id="pf-stats"');
    };
  }
})();
