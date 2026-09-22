// ═══ TRANSFERT DE GESTION : LE MANDAT SIGNÉ SE CLASSE TOUT SEUL (22.09.2026) ═══════════════════
// « J'ai signé le mandat depuis la fiche Ozkan Jonathan en demandant le transfert : je vois la
// note "demande de transfert" mais pas le nouveau mandat. »
//
// Le client signe dans REX CLOUD ; la signature part avec la demande (demandes_transfert,
// signature_data). Jusqu'ici, le mandat n'était construit qu'au clic sur « Générer le mandat »
// dans Messages clients → Transferts : tant qu'on n'y passait pas, la fiche n'en montrait rien.
//
// On fait comme pour les signatures à distance (recupererSignaturesEnAttente, js/05) : au
// chargement du CRM puis toutes les deux minutes, chaque transfert signé encore « À traiter »
// produit son mandat dans « Documents & mandats signés », et passe à « Mandat généré ».
//
// Anti-doublon : la demande est d'abord « réservée » par un PATCH conditionnel
// (statut=eq.nouveau → mandat_genere). Si deux onglets passent en même temps, un seul obtient la
// ligne. Si l'enregistrement du mandat échoue, la demande revient à « nouveau » pour être retentée.

async function trmPatch(filtre, corps, representation) {
  const jeton = await getValidAccessToken() || SUPABASE_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/demandes_transfert?${filtre}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json',
      Prefer: representation ? 'return=representation' : 'return=minimal' },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return representation ? r.json() : null;
}

let _trmEnCours = false;
async function recupererMandatsTransferts() {
  if (_trmEnCours || typeof genererMandatCourtage !== 'function') return;
  _trmEnCours = true;
  try {
    const demandes = await dbGet('demandes_transfert', 'statut=eq.nouveau&signature_data=not.is.null&select=id,client_id,signature_data').catch(() => []);
    if (!Array.isArray(demandes) || !demandes.length) return;
    let classes = 0;
    for (const d of demandes) {
      if (!allClients.some(c => c.id === d.client_id)) continue; // fiche pas encore chargée : on repassera
      let prise;
      try {
        prise = await trmPatch(`id=eq.${d.id}&statut=eq.nouveau`, { statut: 'mandat_genere', traite_le: new Date().toISOString() }, true);
      } catch (e) { console.error('Transfert — réservation impossible', d.id, e); continue; }
      if (!Array.isArray(prise) || !prise.length) continue; // déjà pris par un autre onglet
      let r;
      try { r = await genererMandatCourtage(d.client_id, d.signature_data, { silencieux: true }); }
      catch (e) { r = { error: true, detail: e }; }
      if (r && r.error) {
        console.error('Transfert — mandat non enregistré, demande remise à traiter', d.id, r);
        await trmPatch(`id=eq.${d.id}`, { statut: 'nouveau', traite_le: null }).catch(() => {});
        continue;
      }
      const t = (typeof _mc !== 'undefined' && _mc.transferts || []).find(x => x.id === d.id);
      if (t) t.statut = 'mandat_genere';
      classes++;
    }
    if (classes) {
      showError(`✓ ${classes} mandat${classes > 1 ? 's' : ''} signé${classes > 1 ? 's' : ''} par ${classes > 1 ? 'des clients' : 'un client'} (demande de transfert) classé${classes > 1 ? 's' : ''} dans la fiche.`);
      // La fiche ouverte est peut-être celle du client : on la rafraîchit pour montrer le mandat —
      // sauf si on est en train d'y écrire (note, champ), pour ne rien effacer.
      const saisie = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (!saisie && typeof currentView !== 'undefined' && currentView === 'fiche-client'
        && demandes.some(d => d.client_id === currentClientId) && typeof showClient === 'function') showClient(currentClientId);
    }
  } finally { _trmEnCours = false; }
}

// Branché sur le rattrapage existant : même moment (chargement du CRM) et même rythme (2 min).
(function trmBrancher() {
  if (typeof recupererSignaturesEnAttente !== 'function') return;
  const origine = recupererSignaturesEnAttente;
  window.recupererSignaturesEnAttente = async function () {
    try { await origine.apply(this, arguments); }
    finally { await recupererMandatsTransferts().catch(e => console.error('Rattrapage transferts :', e)); }
  };
})();
