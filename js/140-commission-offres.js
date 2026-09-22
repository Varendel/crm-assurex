// ═══ LA COMMISSION PRÉVUE AU PIPELINE, D'APRÈS LES OFFRES REÇUES (22.09.2026) ═══════════════════
// « Maintenant qu'il y a l'import des offres, on peut prévoir une commission dans le pipeline. »
//
// L'import lit la prime sur le PDF (js/137). Dès qu'une offre porte une prime, l'affaire met à jour
// toute seule ses primes par produit, son montant potentiel et sa commission estimée — les trois
// chiffres qui alimentent déjà le pipeline (« Commission potentielle »), le suivi des affaires et
// la trésorerie. Plus besoin de ressaisir une prime devinée à la création de l'affaire.
//
// Règle : pour chaque type de produit, l'offre RETENUE fait foi ; sans offre retenue, c'est la
// moins chère des offres reçues (hypothèse de travail, celle qu'on proposera au client). Le taux
// vient d'estimerCommissionProduit (js/09), qui applique les taux réels par compagnie et produit.
// Une prime saisie à la main sur l'affaire n'est écrasée que si une offre existe pour ce produit.

const _cof = { enCours: new Set() };

function cofPrimeSante(produitId, primeAnnuelle) {
  // estimerCommissionProduit attend une prime MENSUELLE pour la santé complémentaire (prime × 16).
  const sante = typeof PRODUITS_SANTE_COMPAGNIE_INDEPENDANTE !== 'undefined' && PRODUITS_SANTE_COMPAGNIE_INDEPENDANTE.includes(produitId);
  return sante ? Math.round(primeAnnuelle / 12 * 100) / 100 : primeAnnuelle;
}

// Offre retenue par type de produit, sinon la moins chère reçue.
function cofOffresRetenues(oppId, o) {
  const entrees = (typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : [])
    .map(x => x.e)
    .filter(e => e && Number(e.prime) > 0 && e.statut !== 'déclinée' && (e.recue_le || e.recu_le || e.retenue || e.statut === 'reçue' || e.statut === 'retenue'));
  const parProduit = new Map();
  entrees.forEach(e => {
    const type = (typeof otyTypeEntree === 'function' ? otyTypeEntree(e, o) : null) || (Array.isArray(o.produits) ? o.produits[0] : null);
    if (!type) return;
    const avant = parProduit.get(type);
    const mieux = !avant || (e.retenue && !avant.retenue) || (!avant.retenue && Number(e.prime) < Number(avant.prime));
    if (mieux) parProduit.set(type, e);
  });
  return parProduit;
}

async function cofRecalculer(oppId) {
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  if (!o || _cof.enCours.has(oppId) || (typeof estRoleRH === 'function' && estRoleRH())) return null;
  const parProduit = cofOffresRetenues(oppId, o);
  if (!parProduit.size) return null;
  _cof.enCours.add(oppId);
  try {
    const primes = { ...(o.produits_primes && typeof o.produits_primes === 'object' ? o.produits_primes : {}) };
    const produits = [...(Array.isArray(o.produits) ? o.produits : [])];
    let commission = 0;
    for (const [produitId, e] of parProduit) {
      primes[produitId] = Math.round(Number(e.prime) * 100) / 100;
      if (!produits.includes(produitId)) produits.push(produitId);
    }
    for (const [produitId, prime] of Object.entries(primes)) {
      const e = parProduit.get(produitId);
      const cie = (e && e.compagnie) || o.compagnie || '';
      const r = typeof estimerCommissionProduit === 'function' ? estimerCommissionProduit(produitId, cie, cofPrimeSante(produitId, Number(prime)), 1) : null;
      commission += (r && r.montant) || 0;
    }
    commission = Math.round(commission * 100) / 100;
    const montant = Math.round(Object.values(primes).reduce((s, p) => s + Number(p || 0), 0) * 100) / 100;
    const change = Math.abs(Number(o.commission_estimee || 0) - commission) > 1 || Math.abs(Number(o.montant_potentiel || 0) - montant) > 1;
    if (!change) return { commission, montant };
    const r = await dbPatch('opportunites', oppId, { produits_primes: primes, produits, montant_potentiel: montant, commission_estimee: commission });
    if (r && r.error) return null;
    Object.assign(o, { produits_primes: primes, produits, montant_potentiel: montant, commission_estimee: commission });
    if (typeof ajouterLigneHistoriqueOpportunite === 'function')
      await ajouterLigneHistoriqueOpportunite(oppId, `💰 Prévision mise à jour d’après les offres reçues : prime CHF ${fmtCHF(montant)}/an · commission estimée CHF ${fmtCHF(commission)}`);
    return { commission, montant };
  } catch (e) { return null; } finally { _cof.enCours.delete(oppId); }
}

// Sur la fiche : d'où vient le chiffre (offre retenue ou meilleure offre), sous le KPI.
function cofDecorer(oppId) {
  const kpi = [...document.querySelectorAll('#main-content .opx-kpi')].find(k => /Commission estimée/i.test(k.textContent || ''));
  if (!kpi || kpi.dataset.cof) return;
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  if (!o) return;
  const parProduit = cofOffresRetenues(oppId, o);
  if (!parProduit.size) return;
  kpi.dataset.cof = '1';
  const retenue = [...parProduit.values()].some(e => e.retenue);
  const cies = [...new Set([...parProduit.values()].map(e => e.compagnie).filter(Boolean))];
  kpi.insertAdjacentHTML('beforeend', `<small class="cof-source">d’après ${retenue ? 'l’offre retenue' : 'la meilleure offre'}${cies.length ? ' · ' + cies.map(c => String(c).replace(/[<>&]/g, '')).join(', ') : ''}</small>`);
}

(function cofBrancher() {
  // Les offres d'une affaire sont (re)chargées ici : c'est le bon moment pour recalculer.
  if (typeof opChargerDemandes === 'function') {
    const origine = opChargerDemandes;
    window.opChargerDemandes = async function (oppId) {
      const r = await origine.apply(this, arguments);
      try { await cofRecalculer(oppId); cofDecorer(oppId); } catch (e) { /* prévision facultative */ }
      return r;
    };
  }
  const st = document.createElement('style');
  st.textContent = '.cof-source { display: block; font-size: 10.5px; color: var(--text-muted); margin-top: 2px; }';
  document.head.appendChild(st);
})();
