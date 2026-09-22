// ═══ AFFAIRE GAGNÉE : LE LIEN VERS LE CONTRAT (22.09.2026) ══════════════════════════════════════
// « Opp convertie, il n'y a pas de lien vers le contrat, ça sert à rien la vue. »
//
// Le bandeau « 🎉 Opportunité gagnée · contrat relié » ne disait rien du contrat et n'y menait pas.
// Il liste maintenant le ou les contrats issus de l'affaire — compagnie, produit, police, prime,
// date — et chaque ligne ouvre la fiche du contrat (showDetailContrat).
//
// opportunites.contrat_id ne tient qu'UN contrat, alors qu'une affaire gagnée en produit souvent
// plusieurs (conversion multi-produits, js/134). D'où la colonne contrats.opportunite_id
// (migration 20260922_contrats_opportunite_id) : le lien retour, posé à la création du contrat et
// repris pour l'existant. Les deux liens sont lus, l'ancien reste donc valable.

function oclEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Les contrats d'une affaire : le lien retour, plus l'ancien lien simple.
function oclContratsDeOpp(o) {
  if (!o) return [];
  const tous = typeof allContrats !== 'undefined' && Array.isArray(allContrats) ? allContrats : [];
  const vus = new Set();
  return tous
    .filter(c => (c.opportunite_id && c.opportunite_id === o.id) || (o.contrat_id && c.id === o.contrat_id))
    .filter(c => !vus.has(c.id) && vus.add(c.id))
    .sort((a, b) => String(a.date_debut || '').localeCompare(String(b.date_debut || '')));
}

function oclLigneContrat(c) {
  const picto = typeof pictoCompagnie === 'function' ? pictoCompagnie(c.compagnie, 26) : '';
  const details = [
    c.numero_police ? 'police ' + oclEsc(c.numero_police) : '',
    c.prime_annuelle ? 'CHF ' + fmtCHF(c.prime_annuelle) + '/an' : '',
    c.date_debut ? 'dès le ' + fmtDate(c.date_debut) : '',
  ].filter(Boolean).join(' · ');
  const resilie = c.statut && c.statut !== 'actif';
  return `<button type="button" class="ocl-contrat${resilie ? ' resilie' : ''}" onclick="showDetailContrat('${c.id}')" title="Ouvrir la fiche du contrat">
    <span class="ocl-logo">${picto}</span>
    <span class="ocl-corps">
      <b>${oclEsc(c.produit || 'Contrat')}${c.compagnie ? ' — ' + oclEsc(c.compagnie) : ''}</b>
      <small>${details || 'contrat enregistré'}${resilie ? ' · ' + oclEsc(c.statut) : ''}</small>
    </span>
    <span class="ocl-fleche">→</span>
  </button>`;
}

function oclBandeau(o) {
  const liste = oclContratsDeOpp(o);
  const relier = `<button type="button" class="ocl-relier" onclick="proposerActionApresGain(allOpportunites.find(x=>x.id==='${o.id}'))">${liste.length ? '+ Relier un autre contrat' : 'Créer / relier le contrat'}</button>`;
  if (!liste.length) {
    return `<div class="opx-bandeau opx-bandeau-gagne ocl-bandeau">
      <div class="ocl-tete"><span>🎉 Opportunité gagnée</span>${relier}</div>
      <div class="ocl-vide">Aucun contrat rattaché — l'affaire est gagnée mais rien ne la relie au portefeuille.</div>
    </div>`;
  }
  const total = liste.reduce((s, c) => s + (Number(c.prime_annuelle) || 0), 0);
  return `<div class="opx-bandeau opx-bandeau-gagne ocl-bandeau">
    <div class="ocl-tete">
      <span>🎉 Opportunité gagnée — ${liste.length} contrat${liste.length > 1 ? 's' : ''}${total ? ` · CHF ${fmtCHF(total)}/an` : ''}</span>${relier}
    </div>
    <div class="ocl-liste">${liste.map(oclLigneContrat).join('')}</div>
  </div>`;
}

// Remplace le bandeau « gagnée » de la fiche (js/25) par celui qui mène aux contrats.
(function oclPoser() {
  if (typeof viewFicheOpportunite !== 'function') return;
  const origine = viewFicheOpportunite;
  window.viewFicheOpportunite = function (o) {
    const h = origine.apply(this, arguments);
    if (!o || o.stade !== 'Gagné') return h;
    return h.replace(/<div class="opx-bandeau opx-bandeau-gagne">[\s\S]*?<\/div>/, oclBandeau(o));
  };
})();

// ── Poser le lien retour à la création du contrat ────────────────────────────────────────────────
// La conversion passe par creerContratEtCommission() : chaque contrat créé pendant qu'une affaire
// est en cours de conversion (prefillOpportunite) reçoit son opportunite_id, y compris les suivants
// de la file multi-produits, que opportunites.contrat_id ne pouvait pas retenir.
(function oclBrancherCreation() {
  if (typeof creerContratEtCommission !== 'function') return;
  const origine = creerContratEtCommission;
  window.creerContratEtCommission = async function () {
    const r = await origine.apply(this, arguments);
    try {
      const opp = (typeof prefillOpportunite !== 'undefined' && prefillOpportunite) || null;
      const ct = r && r.contrat;
      if (opp && opp.id && ct && ct.id && !ct.opportunite_id) {
        const p = await dbPatch('contrats', ct.id, { opportunite_id: opp.id });
        if (!(p && p.error)) {
          ct.opportunite_id = opp.id;
          const local = (typeof allContrats !== 'undefined' ? allContrats : []).find(x => x.id === ct.id);
          if (local) local.opportunite_id = opp.id;
        }
      }
    } catch (e) { /* le contrat est créé : un lien manquant ne doit jamais faire échouer la conversion */ }
    return r;
  };
})();

// Relier un contrat existant à la main : le lien retour aussi.
(function oclBrancherLiaison() {
  if (typeof confirmerLienContratExistant !== 'function') return;
  const origine = confirmerLienContratExistant;
  window.confirmerLienContratExistant = async function (oppId) {
    const contratId = document.getElementById('select-contrat-existant')?.value;
    const r = await origine.apply(this, arguments);
    try {
      if (contratId) {
        await dbPatch('contrats', contratId, { opportunite_id: oppId });
        const local = (typeof allContrats !== 'undefined' ? allContrats : []).find(x => x.id === contratId);
        if (local) local.opportunite_id = oppId;
      }
    } catch (e) { /* idem : la liaison principale est déjà faite */ }
    return r;
  };
})();

(function oclStyles() {
  const st = document.createElement('style');
  st.textContent = `
    .ocl-bandeau { display: block; }
    .ocl-tete { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .ocl-relier { background: none; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); color: inherit;
      border-radius: 20px; padding: 3px 11px; font-size: 11px; font-weight: 500; cursor: pointer; }
    .ocl-relier:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
    .ocl-vide { margin-top: 8px; font-size: 11.5px; opacity: 0.8; }
    .ocl-liste { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    .ocl-contrat { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; cursor: pointer;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; color: var(--text); }
    .ocl-contrat:hover { border-color: var(--accent-border); background: var(--surface-alt); }
    .ocl-contrat.resilie { opacity: 0.72; }
    .ocl-logo { display: flex; align-items: center; }
    .ocl-corps { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
    .ocl-corps b { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ocl-corps small { font-size: 11px; color: var(--text-muted); }
    .ocl-fleche { color: var(--text-muted); font-size: 14px; }
  `;
  document.head.appendChild(st);
})();
