// ═══ NOUVEAU CONTRAT : BROUILLON AUTOMATIQUE ET GARDE-FOU DOUBLON (20.09.2026) ═════════════════
// Deux manques repérés en relisant le formulaire :
//   1. rien n'était conservé tant qu'on n'avait pas cliqué « Enregistrer » — un formulaire long
//      perdu à la moindre navigation ou fermeture d'onglet ;
//   2. le doublon n'était détecté que si le produit ET le n° de police correspondaient : deux
//      saisies de la même police avec un libellé différent passaient sans rien dire.
// Ici : sauvegarde locale au fil de la frappe (sur ce poste uniquement, jamais en base), bandeau de
// reprise à la réouverture, et avertissement quand la police existe déjà chez ce client.

const NC_CLE_BROUILLON = 'rex-brouillon-contrat';
const NC_DUREE_BROUILLON = 7 * 24 * 3600 * 1000; // au-delà d'une semaine, on n'en parle plus

function ncFormulairePresent() { return !!document.getElementById('ct-compagnie') && !!document.getElementById('ct-prime-lignes-list'); }

function ncLireFormulaire() {
  const v = id => (document.getElementById(id) || {}).value ?? '';
  return {
    date: Date.now(),
    client: v('ct-client'), contratClientId: typeof contratClientId !== 'undefined' ? contratClientId : null,
    champs: ['ct-segment', 'ct-compagnie', 'ct-categorie', 'ct-produit', 'ct-police', 'ct-periodicite', 'ct-date', 'ct-date-signature',
      'ct-echeance', 'ct-apporteur', 'ct-co-apporteur', 'ct-statut', 'ct-preavis', 'ct-commissionne', 'ct-nature-commission',
      'ct-comm-paiement', 'ct-manuel', 'ct-prime-risque-frais', 'ct-duree', 'ct-produit-swisslife-lpp'].reduce((o, id) => { o[id] = v(id); return o; }, {}),
    lignes: typeof collecterLignesPrimeSaisies === 'function' ? collecterLignesPrimeSaisies() : [],
    plaques: Array.from(document.querySelectorAll('#ct-plaques-list > div')).map(l => ({
      plaque: l.querySelector('.ct-plaque-input')?.value || '', marque: l.querySelector('.ct-plaque-marque-input')?.value || '', type: l.querySelector('.ct-plaque-type')?.value || '',
    })).filter(p => p.plaque || p.marque),
  };
}

function ncEstVide(b) {
  if (!b) return true;
  const rempli = Object.entries(b.champs || {}).some(([id, val]) => val && !['ct-segment', 'ct-periodicite', 'ct-statut', 'ct-commissionne', 'ct-nature-commission'].includes(id));
  return !rempli && !(b.lignes || []).length && !(b.plaques || []).length;
}

function ncSauverBrouillon() {
  if (!ncFormulairePresent()) return;
  const b = ncLireFormulaire();
  try { if (ncEstVide(b)) localStorage.removeItem(NC_CLE_BROUILLON); else localStorage.setItem(NC_CLE_BROUILLON, JSON.stringify(b)); } catch (e) { /* stockage plein ou privé */ }
}
function ncEffacerBrouillon() { try { localStorage.removeItem(NC_CLE_BROUILLON); } catch (e) {} window._ncBandeauTraite = true; document.getElementById('nc-brouillon')?.remove(); }
function ncBrouillon() {
  try {
    const b = JSON.parse(localStorage.getItem(NC_CLE_BROUILLON) || 'null');
    if (!b || !b.date || Date.now() - b.date > NC_DUREE_BROUILLON || ncEstVide(b)) return null;
    return b;
  } catch (e) { return null; }
}

function ncRestaurerBrouillon() {
  const b = ncBrouillon();
  if (!b) return;
  Object.entries(b.champs || {}).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  // Les listes déroulantes dépendent les unes des autres (catégorie → produit → modules)
  if (typeof updateCategorieOptions === 'function') updateCategorieOptions();
  const cat = document.getElementById('ct-categorie'); if (cat && b.champs['ct-categorie']) cat.value = b.champs['ct-categorie'];
  if (typeof updateProduitOptions === 'function') updateProduitOptions();
  const prod = document.getElementById('ct-produit'); if (prod && b.champs['ct-produit']) prod.value = b.champs['ct-produit'];
  if (typeof updateModulesOptions === 'function') updateModulesOptions();
  const liste = document.getElementById('ct-prime-lignes-list');
  if (liste && (b.lignes || []).length) {
    liste.innerHTML = '';
    b.lignes.forEach(l => ajouterLignePrime(l.libelle || '', l.montant || ''));
  }
  const plaques = document.getElementById('ct-plaques-list');
  if (plaques && (b.plaques || []).length) {
    plaques.innerHTML = '';
    b.plaques.forEach(p => {
      ajouterPlaqueFlotte();
      const ligne = plaques.lastElementChild;
      if (!ligne) return;
      ligne.querySelector('.ct-plaque-input').value = p.plaque || '';
      ligne.querySelector('.ct-plaque-marque-input').value = p.marque || '';
      const t = ligne.querySelector('.ct-plaque-type'); if (t && p.type) t.value = p.type;
    });
    const champ = document.getElementById('ct-plaques-field'); if (champ) champ.style.display = '';
  }
  if (typeof calculerPrimeTotaleLignes === 'function') calculerPrimeTotaleLignes();
  if (typeof updateCommissionPreview === 'function') updateCommissionPreview();
  window._ncBandeauTraite = true; // repris : on ne repropose plus le bandeau dans cette saisie
  document.getElementById('nc-brouillon')?.remove();
  showError('✓ Brouillon repris — vérifie les listes déroulantes avant d’enregistrer.');
}

function ncBandeauBrouillon() {
  const b = ncBrouillon();
  if (!b || window._ncBandeauTraite || document.getElementById('nc-brouillon')) return;
  const ancre = document.querySelector('#main-content h2, #main-content .rex-bandeau');
  if (!ancre) return;
  const quand = new Date(b.date);
  const resume = [b.champs['ct-compagnie'], b.champs['ct-produit'], b.champs['ct-police']].filter(Boolean).join(' · ') || 'saisie en cours';
  ancre.insertAdjacentHTML('afterend', `<div id="nc-brouillon" class="nc-brouillon">
    <span aria-hidden="true">📝</span>
    <div><b>Un contrat était en cours de saisie</b><small>${resume} — ${quand.toLocaleDateString('fr-CH')} à ${quand.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</small></div>
    <button type="button" class="btn-save" onclick="ncRestaurerBrouillon()">Reprendre</button>
    <button type="button" class="btn-secondary" onclick="ncEffacerBrouillon()">Ignorer</button>
  </div>`);
}

// Sauvegarde au fil de la frappe + bandeau à l'ouverture du formulaire
(function ncInstaller() {
  const demarrer = () => {
    const main = document.getElementById('main-content');
    if (!main) return;
    let minuteur = null;
    main.addEventListener('input', () => {
      if (!ncFormulairePresent()) return;
      clearTimeout(minuteur); minuteur = setTimeout(ncSauverBrouillon, 600);
    });
    main.addEventListener('change', () => { if (ncFormulairePresent()) ncSauverBrouillon(); });
    // Nouvelle page : on repropose le brouillon (le drapeau ne vaut que pour la saisie en cours)
    new MutationObserver(() => {
      if (!ncFormulairePresent()) { window._ncBandeauTraite = false; return; }
      setTimeout(ncBandeauBrouillon, 60);
    }).observe(main, { childList: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

// ── Garde-fou : cette police existe déjà chez ce client (même avec un autre produit) ────────────
function ncContratsMemePolice(clientId, police) {
  const p = String(police || '').replace(/[^0-9A-Za-z]/g, '').toLowerCase();
  if (!clientId || !p) return [];
  return (typeof allContrats !== 'undefined' ? allContrats : []).filter(ct => ct.client_id === clientId
    && String(ct.numero_police || '').replace(/[^0-9A-Za-z]/g, '').toLowerCase() === p
    && !['annulé', 'résilié', 'mandat_resilie'].includes(ct.statut));
}

if (typeof saveContrat === 'function') {
  const _saveContratAvantNc = saveContrat;
  saveContrat = async function () {
    const clientId = (typeof contratClientId !== 'undefined' && contratClientId) || document.getElementById('ct-client')?.value || null;
    const police = document.getElementById('ct-police')?.value || '';
    const produit = typeof getProduitSelectionne === 'function' ? (getProduitSelectionne() || {}).label : '';
    const memes = ncContratsMemePolice(clientId, police).filter(ct => (ct.produit || '').toLowerCase() !== String(produit || '').toLowerCase());
    if (memes.length) {
      const liste = memes.map(ct => `• ${ct.produit || 'Contrat'} — ${ct.compagnie || ''}${ct.prime_annuelle ? ` (CHF ${fmtCHF(Math.round(ct.prime_annuelle))}/an)` : ''}`).join('\n');
      const suite = confirm(`La police ${police} existe déjà chez ce client :\n\n${liste}\n\nC'est normal si tu saisis une autre garantie de la même police (RC, casco…). Sinon, annule et complète le contrat existant.\n\nContinuer ?`);
      if (!suite) return;
    }
    const avant = (allContrats || []).length;
    await _saveContratAvantNc.apply(this, arguments);
    if ((allContrats || []).length > avant) ncEffacerBrouillon(); // contrat créé : le brouillon n'a plus lieu d'être
  };
}
