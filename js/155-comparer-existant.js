// ═══ COMPARER AVEC LA COUVERTURE ACTUELLE (23.09.2026) ══════════════════════════════════════════
// « J'aimerais comparer l'offre reçue avec la couverture actuelle saisie au CRM. Ce serait pas mal
// d'avoir le choix. »
//
// Le comparateur comparait les offres ENTRE ELLES. Or ce n'est pas la question que pose le client :
// il ne choisit pas entre trois inconnues, il choisit entre ce qu'il a et ce qu'on lui propose.
// « 971 contre 1076 » ne lui dit rien ; « 971 au lieu de 1240, soit 269 de moins par an » lui dit
// tout. Le portefeuille contient déjà son contrat en cours : il n'y avait qu'à l'inviter.
//
// LE CHOIX, puisqu'il est demandé — et il est nécessaire : sur une couverture NOUVELLE il n'y a
// rien à comparer, et sur un client qui a huit contrats le CRM ne peut pas deviner lequel est
// concerné. Un menu propose les contrats actifs du client, « ne pas comparer » par défaut. Quand
// un seul contrat correspond au produit de l'affaire, il est proposé d'office : c'est le cas
// courant, et l'erreur est sans conséquence puisqu'on peut le retirer.
//
// La colonne « aujourd'hui » n'est pas une offre : elle ne porte pas de bouton « retenir » et reste
// en gris. Chaque offre affiche en regard son écart avec elle — le seul chiffre qui se retienne.

window._cexChoix = window._cexChoix || {};   // { [oppId]: contratId | '' }

function cexEsc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function cexContratsClient(o) {
  if (!o || !o.client_id) return [];
  return (typeof allContrats !== 'undefined' ? allContrats : [])
    .filter(c => c.client_id === o.client_id && !['annulé', 'annule', 'resilie', 'résilié', 'mandat_resilie'].includes(String(c.statut || '').toLowerCase()))
    .sort((a, b) => String(a.produit || '').localeCompare(String(b.produit || ''), 'fr'));
}

// Le contrat que le CRM proposerait de lui-même : celui dont le produit est celui de l'affaire,
// et à condition qu'il n'y en ait qu'un — deux candidats, c'est au courtier de trancher.
function cexEvident(o, contrats) {
  const cible = String((Array.isArray(o.produits) && o.produits[0]) || '').toLowerCase().trim();
  if (!cible) return '';
  const memes = contrats.filter(c => String(c.produit || '').toLowerCase().trim() === cible);
  return memes.length === 1 ? memes[0].id : '';
}

function cexContrat(oppId) {
  const id = window._cexChoix[oppId];
  if (!id) return null;
  return (typeof allContrats !== 'undefined' ? allContrats : []).find(c => c.id === id) || null;
}

function cexChanger(oppId, id) {
  window._cexChoix[oppId] = id || '';
  const reco = document.getElementById('opx-reco')?.value || '';
  document.getElementById('modal-comparateur')?.remove();
  opComparer(oppId);
  const champ = document.getElementById('opx-reco');
  if (champ && reco) champ.value = reco;
}

// ── La colonne « aujourd'hui » ──────────────────────────────────────────────────────────────────
function cexColonneHtml(ct) {
  const prime = Number(ct.prime_annuelle) || 0;
  const echeance = ct.date_echeance ? new Date(ct.date_echeance).toLocaleDateString('fr-CH') : '—';
  const preavis = Number(ct.preavis_mois) || 0;
  return `<div class="opx-comp-col cex-col">
    <div class="opx-comp-tete">${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 40) : ''}<b>${cexEsc(ct.compagnie || '—')}</b></div>
    <div class="cex-etiquette">Aujourd’hui</div>
    <div class="opx-comp-prime">${prime ? 'CHF ' + fmtCHF(prime) : '—'}<small>par an</small></div>
    <div class="opx-comp-ecart cex-ref">référence</div>
    <dl>
      <dt>Produit</dt><dd>${cexEsc(ct.produit || '—')}</dd>
      <dt>Couverture</dt><dd>${cexEsc(ct.modules || '—')}</dd>
      <dt>Police</dt><dd>${cexEsc(ct.numero_police || '—')}</dd>
      <dt>Échéance</dt><dd>${echeance}${preavis ? ` · préavis ${preavis} mois` : ''}</dd>
    </dl>
    <span class="cex-cale" aria-hidden="true"></span>
  </div>`;
}

function cexSelecteurHtml(oppId, contrats, choisi) {
  return `<div class="cex-barre">
    <label class="form-label" for="cex-select">Comparer avec la couverture actuelle</label>
    <select class="form-select" id="cex-select" onchange="cexChanger('${oppId}', this.value)">
      <option value="">— ne pas comparer —</option>
      ${contrats.map(c => `<option value="${c.id}" ${c.id === choisi ? 'selected' : ''}>${cexEsc(`${c.compagnie || '?'} · ${c.produit || 'contrat'}${c.prime_annuelle ? ' · CHF ' + fmtCHF(c.prime_annuelle) + '/an' : ''}`)}</option>`).join('')}
    </select>
    <small class="cex-aide">Les contrats actifs de ce client. L’offre retenue se lira alors comme un écart, pas comme un prix en l’air.</small>
  </div>`;
}

// ── L'écart, porté sur chaque offre ─────────────────────────────────────────────────────────────
function cexPoserEcarts(ref) {
  document.querySelectorAll('#modal-comparateur .opx-comp-col:not(.cex-col)').forEach(col => {
    if (col.querySelector('.cex-delta')) return;
    const txt = col.querySelector('.opx-comp-prime')?.textContent || '';
    const n = Number(String(txt).replace(/[^\d,.-]/g, '').replace(/\s/g, '').replace(',', '.'));
    const zone = col.querySelector('.opx-comp-ecart');
    if (!zone || !Number.isFinite(n) || !n || !ref) return;
    const d = Math.round((n - ref) * 100) / 100;
    const signe = d < 0 ? 'baisse' : d > 0 ? 'hausse' : 'egal';
    zone.insertAdjacentHTML('afterend', `<div class="cex-delta ${signe}">${d === 0 ? '= même prime qu’aujourd’hui'
      : `${d < 0 ? '−' : '+'} CHF ${fmtCHF(Math.abs(d))} / an`}<small>${d < 0 ? 'par rapport à aujourd’hui' : d > 0 ? 'de plus qu’aujourd’hui' : ''}</small></div>`);
  });
}

(function cexBrancher() {
  if (typeof opComparer !== 'function') return;
  const origine = opComparer;
  window.opComparer = function (oppId) {
    origine.apply(this, arguments);
    setTimeout(() => {
      const modale = document.getElementById('modal-comparateur');
      const grille = modale && modale.querySelector('.opx-comp');
      if (!grille || modale.querySelector('.cex-barre')) return;
      const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
      if (!o) return;
      const contrats = cexContratsClient(o);
      if (!contrats.length) return;                 // rien à proposer : on n'encombre pas l'écran
      if (window._cexChoix[oppId] === undefined) window._cexChoix[oppId] = cexEvident(o, contrats);
      const choisi = window._cexChoix[oppId];
      grille.insertAdjacentHTML('beforebegin', cexSelecteurHtml(oppId, contrats, choisi));
      const ct = cexContrat(oppId);
      if (!ct) return;
      grille.insertAdjacentHTML('afterbegin', cexColonneHtml(ct));
      cexPoserEcarts(Number(ct.prime_annuelle) || 0);
    }, 30);
  };

  const st = document.createElement('style');
  st.textContent = `
    .cex-barre { margin: 10px 0 6px; }
    .cex-barre .form-select { max-width: 460px; }
    .cex-aide { display: block; margin-top: 4px; color: var(--text-muted); font-size: 11.5px; line-height: 1.4; }
    /* La colonne de référence n'est pas une candidate : elle reste grise et sans bouton. */
    .opx-comp-col.cex-col { background: color-mix(in srgb, var(--border) 26%, transparent);
      border-color: color-mix(in srgb, var(--border) 70%, transparent); }
    .cex-etiquette { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
      color: var(--text-muted); margin-top: -2px; }
    .cex-ref { color: var(--text-dim); font-style: italic; }
    .cex-delta { margin-top: 2px; font-size: 13px; font-weight: 700; line-height: 1.25; }
    .cex-delta small { display: block; font-size: 10px; font-weight: 500; opacity: .75; }
    .cex-delta.baisse { color: #16A34A; }
    .cex-delta.hausse { color: #DC2626; }
    .cex-delta.egal { color: var(--text-muted); }
    /* Une cale de la hauteur d'un bouton « Retenir », pour que les colonnes s'alignent en bas
       alors que celle-ci n'en a pas — elle n'est pas candidate. */
    .cex-cale { display: block; height: 34px; }`;
  document.head.appendChild(st);
})();
