// ═══ OPPORTUNITÉ : PLUSIEURS OFFRES SIGNÉES D'UN COUP (22.09.2026) ═══════════════════════════════
// « Il faut pouvoir convertir en gagné multi-offres dans les opp, et ensuite cumuler les saisies.
// Par exemple Demir Céline : j'avais signé 2× 3A Swiss Life ; j'aurais voulu saisir les offres et
// valider en 2×. »
//
// « ✍️ Signée → contrat » (js/46) prend UNE offre. Ici : on coche les offres signées, on indique
// combien de contrats chacune donne (2 pour deux 3A identiques), on joint les polices si on les a,
// et en un clic :
//   · les offres cochées sont « retenues » (toutes, pas une seule) ;
//   · l'affaire passe en Gagné — ou le reste, sans la rouvrir — et sa prime devient la somme des
//     offres signées × nombre de contrats ;
//   · les formulaires de contrat s'enchaînent, un par contrat, pré-remplis (compagnie, produit de
//     l'offre, police lue par REX quand elle est jointe). Même formulaire et même saveContrat() que
//     d'habitude : rien n'est créé sans « Enregistrer », et « Annuler » arrête la file.

let _mvc = null;   // { oppId, file: [{compagnie, prime, produit, fichier}], rang }

function mvcEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function mvcRecue(e) { return !!(e.recue_le || e.statut === 'reçue' || e.retenue) && e.statut !== 'déclinée'; }

function mvcOuvrir(oppId) {
  const o = allOpportunites.find(x => x.id === oppId);
  const entrees = (typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : []).filter(x => mvcRecue(x.e));
  if (!o) return;
  if (!entrees.length) { showError('Aucune offre reçue sur cette affaire : saisis d’abord les offres (« + Offre reçue »).'); return; }
  creerModale('modal-mvc', `
    <div class="opx-modale mvc" role="dialog" aria-modal="true" aria-labelledby="mvc-titre">
      <h3 id="mvc-titre">✍️ Offres signées — ${mvcEsc(o.titre || '')}</h3>
      <p class="opx-modale-sous">Coche les offres signées et le nombre de contrats pour chacune (ex. 2 pour deux 3A identiques). Les polices sont facultatives : REX pré-remplit le contrat depuis la police quand elle est jointe.</p>
      <div class="mvc-liste">${entrees.map((x, i) => {
        const type = typeof otyTypeEntree === 'function' ? otyTypeEntree(x.e, o) : null;
        return `<div class="mvc-ligne">
          <label class="mvc-coche"><input type="checkbox" id="mvc-c-${i}" ${x.e.retenue ? 'checked' : ''} onchange="mvcTotal()"/>
            <span class="mvc-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(x.e.compagnie, 28) : ''}</span>
            <span class="mvc-quoi"><b>${mvcEsc(x.e.compagnie || '—')}</b><small>${type && typeof otyLabel === 'function' ? mvcEsc(otyLabel(type)) + ' · ' : ''}${x.e.prime ? 'CHF ' + fmtCHF(x.e.prime) + '/an' : 'prime à préciser'}</small></span></label>
          <label class="mvc-nb">× <input type="number" id="mvc-n-${i}" min="1" max="20" value="1" oninput="mvcTotal()" aria-label="Nombre de contrats"/></label>
          <label class="mvc-polices" title="Polices PDF (facultatif)">📄<input type="file" id="mvc-f-${i}" accept="application/pdf" multiple hidden onchange="mvcTotal()"/><span id="mvc-fl-${i}">police(s)</span></label>
        </div>`; }).join('')}</div>
      <div class="mvc-total" id="mvc-total"></div>
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-mvc').remove()">Annuler</button>
        <button type="button" class="btn-save" id="mvc-btn" onclick="mvcConfirmer('${oppId}')">✍️ Gagnée → créer les contrats</button>
      </div>
    </div>`, { padding: '16px' });
  window._mvcEntrees = entrees;
  mvcTotal();
}

function mvcSelection() {
  return (window._mvcEntrees || []).map((x, i) => {
    if (!document.getElementById('mvc-c-' + i)?.checked) return null;
    const fichiers = [...(document.getElementById('mvc-f-' + i)?.files || [])].filter(f => f.type === 'application/pdf' && f.size <= 10 * 1024 * 1024);
    const n = Math.max(1, Math.min(20, parseInt(document.getElementById('mvc-n-' + i)?.value, 10) || 1), fichiers.length);
    return { x, n, fichiers };
  }).filter(Boolean);
}

function mvcTotal() {
  (window._mvcEntrees || []).forEach((x, i) => {
    const f = document.getElementById('mvc-f-' + i), l = document.getElementById('mvc-fl-' + i);
    if (f && l) l.textContent = f.files && f.files.length ? `${f.files.length} police${f.files.length > 1 ? 's' : ''}` : 'police(s)';
  });
  const sel = mvcSelection();
  const nb = sel.reduce((s, y) => s + y.n, 0), prime = sel.reduce((s, y) => s + (Number(y.x.e.prime) || 0) * y.n, 0);
  const z = document.getElementById('mvc-total'), b = document.getElementById('mvc-btn');
  if (z) z.innerHTML = nb ? `<b>${nb} contrat${nb > 1 ? 's' : ''}</b> à créer${prime ? ` · prime cumulée <b>CHF ${fmtCHF(prime)}</b>/an` : ''}` : 'Coche au moins une offre.';
  if (b) { b.disabled = !nb; b.textContent = nb > 1 ? `✍️ Gagnée → créer ${nb} contrats` : '✍️ Gagnée → créer le contrat'; }
}

async function mvcConfirmer(oppId) {
  const sel = mvcSelection();
  if (!sel.length) return;
  const btn = document.getElementById('mvc-btn'); if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Préparation…'; }
  const o = allOpportunites.find(x => x.id === oppId);
  // 1. Les offres cochées sont retenues (on ne décoche pas les autres déjà retenues).
  const parDemande = new Map();
  sel.forEach(y => { if (!parDemande.has(y.x.d.id)) parDemande.set(y.x.d.id, { d: y.x.d, idx: new Set() }); parDemande.get(y.x.d.id).idx.add(y.x.idx); });
  for (const { d, idx } of parDemande.values()) {
    const entrees = (d.compagnies_envoi || []).map((e, i) => idx.has(i) ? { ...e, retenue: true, statut: 'retenue' } : e);
    const r = await dbPatch('demandes_offre', d.id, { compagnies_envoi: entrees });
    if (r && r.error) { showError('Offres non retenues : ' + errMsg(r)); if (btn) btn.disabled = false; return; }
    d.compagnies_envoi = entrees;
  }
  // 2. Affaire gagnée (ou qui le reste), prime cumulée.
  const primeCumulee = sel.reduce((s, y) => s + (Number(y.x.e.prime) || 0) * y.n, 0);
  const cies = [...new Set(sel.map(y => y.x.e.compagnie).filter(Boolean))];
  const maj = { stade: 'Gagné', probabilite: 100, ...(primeCumulee ? { montant_potentiel: Math.round(primeCumulee * 100) / 100 } : {}),
    ...(cies.length === 1 ? { compagnie: typeof normaliserCompagnie === 'function' ? normaliserCompagnie(cies[0]) : cies[0] } : {}) };
  const ancien = o.stade;
  const r = await dbPatch('opportunites', oppId, maj);
  if (r && r.error) { showError('Opportunité non mise à jour : ' + errMsg(r)); if (btn) btn.disabled = false; return; }
  Object.assign(o, maj);
  const nb = sel.reduce((s, y) => s + y.n, 0);
  if (typeof ajouterLigneHistoriqueOpportunite === 'function') {
    await ajouterLigneHistoriqueOpportunite(oppId, `✍️ ${nb} contrat${nb > 1 ? 's' : ''} signé${nb > 1 ? 's' : ''} : ${sel.map(y => `${y.n > 1 ? y.n + '× ' : ''}${y.x.e.compagnie || ''}${y.x.e.prime ? ' (CHF ' + fmtCHF(y.x.e.prime) + ')' : ''}`).join(', ')}${primeCumulee ? ` — total CHF ${fmtCHF(primeCumulee)}/an` : ''}`);
    if (ancien !== 'Gagné') await ajouterLigneHistoriqueOpportunite(oppId, `🔀 Stade : ${ancien || '—'} → Gagné`);
  }
  document.getElementById('modal-mvc')?.remove();
  // 3. La file des contrats : une entrée par contrat (les polices jointes d'abord, dans l'ordre).
  const file = [];
  sel.forEach(y => {
    const type = typeof otyTypeEntree === 'function' ? otyTypeEntree(y.x.e, o) : null;
    for (let k = 0; k < y.n; k++) file.push({ compagnie: y.x.e.compagnie, prime: y.x.e.prime || null, produit: type, fichier: y.fichiers[k] || null });
  });
  if (typeof _ovc !== 'undefined') _ovc = null;   // une seule file à la fois
  _mvc = { oppId, file, rang: 0 };
  await mvcFormulaire();
}

async function mvcFormulaire() {
  if (!_mvc) return;
  const o = allOpportunites.find(x => x.id === _mvc.oppId);
  const it = _mvc.file[_mvc.rang];
  if (!o || !it) { _mvc = null; return; }
  prefillOpportunite = { ...o, compagnie: typeof normaliserCompagnie === 'function' ? normaliserCompagnie(it.compagnie || '') : it.compagnie, montant_potentiel: it.prime || o.montant_potentiel };
  const produits = Array.isArray(o.produits) ? o.produits : [];
  prefillOpportuniteProduitId = it.produit || produits[0] || null;
  if (typeof oppFileAttenteProduits !== 'undefined') oppFileAttenteProduits = [];
  contratClientId = o.client_id || null;
  await navigate('nouveau-contrat');
  const bandeau = document.createElement('div');
  bandeau.className = 'ovc-bandeau';
  bandeau.innerHTML = `✍️ Offre signée — ${mvcEsc(it.compagnie || '')}${it.prime ? ` · prime de l’offre CHF ${fmtCHF(it.prime)}/an` : ''} · <b>contrat ${_mvc.rang + 1} sur ${_mvc.file.length}</b>`;
  document.querySelector('#main-content .rex-bandeau, #main-content h2')?.insertAdjacentElement('afterend', bandeau);
  if (it.fichier && typeof importPolicePdfAI === 'function') {
    await importPolicePdfAI({ files: [it.fichier], value: '' });
    window._policePdfFileFromImport = it.fichier;
  }
}

// Après chaque contrat enregistré : le suivant de la file.
if (typeof saveContrat === 'function') {
  const _saveContratAvantMvc = saveContrat;
  saveContrat = async function () {
    const avant = (allContrats || []).length;
    if (_mvc && !(prefillOpportunite && prefillOpportunite.id === _mvc.oppId)) _mvc = null;   // autre saisie : on arrête la file
    await _saveContratAvantMvc.apply(this, arguments);
    if (!_mvc) return;
    if ((allContrats || []).length <= avant) return;   // erreur de saisie : on reste sur le formulaire
    _mvc.rang++;
    if (_mvc.rang < _mvc.file.length) { showError(`✓ Contrat ${_mvc.rang} sur ${_mvc.file.length} créé — suivant.`); await mvcFormulaire(); }
    else { const n = _mvc.file.length; _mvc = null; showError(`✓ Affaire gagnée — ${n} contrat${n > 1 ? 's' : ''} créé${n > 1 ? 's' : ''}.`); }
  };
}

// Le bouton, sous les offres (dès qu'une offre est reçue), à côté de « Comparer ».
(function mvcBrancher() {
  if (typeof htmlOffresOpportunite !== 'function') return;
  const rendu = htmlOffresOpportunite;
  window.htmlOffresOpportunite = function (oppId) {
    const h = rendu.apply(this, arguments);
    const n = (typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : []).filter(x => mvcRecue(x.e)).length;
    if (!n) return h;
    const bouton = `<button type="button" class="mvc-bouton" onclick="mvcOuvrir('${oppId}')">✍️ Plusieurs offres signées → contrats</button>`;
    return h.includes('<div class="opx-offres-actions">') ? h.replace('<div class="opx-offres-actions">', bouton + '<div class="opx-offres-actions">') : h + bouton;
  };
  const st = document.createElement('style');
  st.textContent = `
    .mvc-bouton { display: block; width: 100%; margin: 8px 0; padding: 10px 14px; border-radius: 12px; cursor: pointer; font: inherit; font-weight: 600;
      border: 1px solid #16A34A; background: color-mix(in srgb, #16A34A 14%, var(--surface)); color: var(--text); }
    .mvc-bouton:hover { background: color-mix(in srgb, #16A34A 24%, var(--surface)); }
    .mvc { width: min(640px, 94vw); }
    .mvc-liste { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; max-height: 50vh; overflow: auto; }
    .mvc-ligne { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); }
    .mvc-coche { display: flex; align-items: center; gap: 10px; min-width: 0; cursor: pointer; }
    .mvc-quoi { display: flex; flex-direction: column; min-width: 0; } .mvc-quoi small { font-size: var(--t-xs); color: var(--text-muted); }
    .mvc-nb { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
    .mvc-nb input { width: 54px; padding: 5px 6px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-alt); color: var(--text); font: inherit; }
    .mvc-polices { display: inline-flex; gap: 4px; align-items: center; cursor: pointer; font-size: var(--t-xs); padding: 5px 9px; border-radius: 8px; border: 1px dashed var(--border); }
    .mvc-total { font-size: var(--t-s); padding: 8px 10px; border-radius: 10px; background: var(--surface-alt); }
    @media (max-width: 560px) { .mvc-ligne { grid-template-columns: 1fr auto; } .mvc-polices { grid-column: 1 / -1; justify-self: start; } }`;
  document.head.appendChild(st);
})();
