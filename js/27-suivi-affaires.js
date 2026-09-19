// ═══ SUIVI DES AFFAIRES MODERNISÉ (19.09.2026) ═════════════════════════════════════════════
// Onglet « Affaires en cours » : qui appeler aujourd'hui (score de priorité), offres des
// compagnies restées sans réponse (relance en un clic), affaires qui dorment, demandes d'offre
// récentes. Onglet « Portefeuille signé » : l'ancien Suivi (contrats à renouveler, échéances).

window._suxOnglet = window._suxOnglet || 'affaires';
window._suxTout = false;
window._suiviDemandes = window._suiviDemandes || null;

function suxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function viewSuiviAffaires() {
  const onglets = `<div class="dbx-onglets" role="tablist">
    ${[['affaires', '🎯 Affaires en cours'], ['portefeuille', '📄 Portefeuille signé']].map(([id, l]) => `<button type="button" role="tab" aria-selected="${window._suxOnglet === id}" class="${window._suxOnglet === id ? 'actif' : ''}" onclick="window._suxOnglet='${id}';navigate('suivi')">${l}</button>`).join('')}
  </div>`;
  if (window._suxOnglet === 'portefeuille') return `<div class="sux">${onglets}</div>${viewSuivi()}`;

  setTimeout(suxRecharger, 0);
  const ouvertes = allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu');
  const pondere = ouvertes.reduce((s, o) => s + Math.round((o.commission_estimee || 0) * (o.probabilite || 0) / 100), 0);
  const dormantes = ouvertes.filter(opEstDormante);
  const sansPa = typeof prochaineAction === 'function' ? ouvertes.filter(o => !prochaineAction(o.id)).length : 0;

  return `<div class="sux">
    <header class="dx-tete">
      <div><div class="dx-surtitre">Ventes</div><h2>Suivi des affaires</h2></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-secondary" onclick="navigate('opportunites')">🎯 Pipeline</button>
        <button type="button" class="btn-secondary" onclick="navigate('nouvelle-demande-offre')">📝 Demande d'offre</button>
        <button type="button" class="btn-save" onclick="opportuniteEnEditionId=null;navigate('nouvelle-opportunite')">+ Opportunité</button>
      </div>
    </header>
    ${onglets}
    <div class="sux-kpis">
      <div class="sux-kpi"><span>Affaires ouvertes</span><b>${ouvertes.length}</b><small>${sansPa ? `${sansPa} sans prochaine action` : 'toutes planifiées ✓'}</small></div>
      <div class="sux-kpi"><span>Commission pondérée</span><b>CHF ${fmtCHF(pondere)}</b><small>selon les probabilités</small></div>
      <div class="sux-kpi" id="sux-kpi-attente"><span>Offres attendues</span><b>…</b><small>&nbsp;</small></div>
      <div class="sux-kpi ${dormantes.length ? 'alerte' : ''}"><span>Affaires qui dorment</span><b>${dormantes.length}</b><small>sans activité > ${OP_DELAI_DORMANTE_JOURS} j</small></div>
    </div>
    <div class="opx-grille">
      <div class="opx-col">
        <section class="dbx-carte">
          <div class="dbx-carte-tete"><h3 class="opx-h3">📞 À appeler en priorité</h3><span class="dbx-carte-sous">score : retards, échéances, offres, inactivité, valeur</span></div>
          <div id="sux-priorites">${htmlSuxPriorites()}</div>
        </section>
      </div>
      <div class="opx-col">
        <section class="dbx-carte">
          <div class="dbx-carte-tete"><h3 class="opx-h3">🔔 Offres sans réponse</h3><span class="dbx-carte-sous">après ${OP_DELAI_RELANCE_JOURS} jours</span></div>
          <div id="sux-relances"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
        </section>
        <section class="dbx-carte">
          <div class="dbx-carte-tete"><h3 class="opx-h3">💤 Affaires qui dorment</h3></div>
          ${htmlSuxDormantes(dormantes)}
        </section>
        <section class="dbx-carte">
          <div class="dbx-carte-tete"><h3 class="opx-h3">📝 Demandes d'offre récentes</h3></div>
          <div id="sux-demandes"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
        </section>
      </div>
    </div>
  </div>`;
}

async function suxRecharger() {
  const rows = await dbGet('demandes_offre', 'select=*&order=created_at.desc&limit=300');
  window._suiviDemandes = Array.isArray(rows) ? rows : [];
  // Alimente aussi le cache par opportunité (relances / saisie d'offre depuis cette page)
  const parOpp = {};
  window._suiviDemandes.forEach(d => { if (d.opportunite_id) (parOpp[d.opportunite_id] = parOpp[d.opportunite_id] || []).push(d); });
  Object.assign(window._opDemandes, parOpp);
  const z1 = document.getElementById('sux-relances'); if (z1) z1.innerHTML = htmlSuxRelances();
  const z2 = document.getElementById('sux-demandes'); if (z2) z2.innerHTML = htmlSuxDemandes();
  const z3 = document.getElementById('sux-priorites'); if (z3) z3.innerHTML = htmlSuxPriorites();
  const attente = suxEntrees().filter(x => x.e.statut === 'envoyée' && !x.e.recue_le);
  const aRelancer = attente.filter(x => opEntreeSansReponse(x.e));
  const k = document.getElementById('sux-kpi-attente');
  if (k) { k.classList.toggle('alerte', !!aRelancer.length); k.innerHTML = `<span>Offres attendues</span><b>${attente.length}</b><small>${aRelancer.length ? `${aRelancer.length} à relancer` : 'rien à relancer ✓'}</small>`; }
}

function suxEntrees() {
  const res = [];
  (window._suiviDemandes || []).forEach(d => (Array.isArray(d.compagnies_envoi) ? d.compagnies_envoi : []).forEach((e, idx) => res.push({ d, e, idx })));
  return res;
}
function suxNomDemande(d) {
  if (d.client_id) { const c = allClients.find(x => x.id === d.client_id); if (c) return estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`; }
  return d.prospect_nom || (d.opportunite_id ? opNomClient(allOpportunites.find(o => o.id === d.opportunite_id) || {}) : '') || '—';
}

// ── Priorités ───────────────────────────────────────────────────────────────────────────────
function suxScorer(o) {
  const base = scorerPrioriteOpportunite(o, allRappels.filter(r => r.opportunite_id === o.id));
  const reasons = base.reasons.filter(r => !r.startsWith('—'));
  let score = base.score;
  const demandes = (window._suiviDemandes || []).filter(d => d.opportunite_id === o.id);
  const sansReponse = demandes.flatMap(d => (d.compagnies_envoi || []).filter(opEntreeSansReponse));
  if (sansReponse.length) { score += 40; reasons.push(`🔔 ${sansReponse.length} offre${sansReponse.length > 1 ? 's' : ''} à relancer`); }
  const recues = demandes.flatMap(d => (d.compagnies_envoi || []).filter(e => e.recue_le && !e.retenue));
  if (recues.length && !demandes.some(d => (d.compagnies_envoi || []).some(e => e.retenue))) { score += 30; reasons.push(`📥 ${recues.length} offre${recues.length > 1 ? 's' : ''} reçue${recues.length > 1 ? 's' : ''} à présenter`); }
  if (opEstDormante(o)) { score += 30; reasons.push(`💤 ${opJoursDepuis(opDerniereActivite(o))} j sans activité`); }
  if (typeof prochaineAction === 'function' && !prochaineAction(o.id)) { score += 25; reasons.push('➜ Aucune prochaine action'); }
  return { o, score, reasons };
}

function htmlSuxPriorites() {
  const liste = allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu').map(suxScorer).sort((a, b) => b.score - a.score);
  if (!liste.length) return `<div class="dbx-vide"><span style="font-size:26px">🌤️</span>Aucune affaire en cours.<button type="button" class="btn-save" onclick="opportuniteEnEditionId=null;navigate('nouvelle-opportunite')">+ Créer une opportunité</button></div>`;
  const visibles = window._suxTout ? liste : liste.slice(0, 8);
  return `<div class="sux-liste">${visibles.map((s, i) => {
    const o = s.o;
    const c = opClient(o);
    const tel = c ? (c.mobile || c.tel || '') : '';
    const pa = typeof prochaineAction === 'function' ? prochaineAction(o.id) : null;
    const niveau = s.score >= 100 ? 'haut' : s.score >= 45 ? 'moyen' : 'bas';
    return `<div class="sux-ligne" style="--i:${i}">
      <span class="sux-score ${niveau}" title="Score de priorité">${Math.min(99, Math.round(s.score / 2))}</span>
      <button type="button" class="sux-corps" onclick="editerOpportunite('${o.id}')">
        <span class="sux-titre"><i style="background:${OP_STADE_COUL[o.stade] || '#94A3B8'}"></i>${suxEsc(o.titre)}</span>
        <span class="sux-sous">${suxEsc(opNomClient(o) || '—')} · ${suxEsc(o.stade)}${o.montant_potentiel ? ' · CHF ' + fmtCHF(o.montant_potentiel) : ''}</span>
        ${pa ? `<span class="sux-pa">➜ ${suxEsc(pa.titre)}${pa.date_echeance ? ' · ' + fmtDate(pa.date_echeance) : ''}</span>` : ''}
        <span class="sux-raisons">${s.reasons.slice(0, 3).map(r => `<em>${suxEsc(r)}</em>`).join('')}</span>
      </button>
      <span class="sux-actions">
        ${tel ? `<a href="tel:${suxEsc(tel.replace(/\s/g, ''))}" title="Appeler ${suxEsc(tel)}" aria-label="Appeler">📞</a>` : ''}
        <button type="button" title="Planifier la prochaine action" aria-label="Planifier" onclick="ouvrirModaleProchaineAction('${o.id}')">➜</button>
      </span>
    </div>`;
  }).join('')}</div>
  ${liste.length > 8 ? `<button type="button" class="dbx-lien" onclick="window._suxTout=!window._suxTout;document.getElementById('sux-priorites').innerHTML=htmlSuxPriorites()">${window._suxTout ? 'Réduire' : `Voir les ${liste.length} affaires`}</button>` : ''}`;
}

function htmlSuxRelances() {
  const items = suxEntrees().filter(x => opEntreeSansReponse(x.e)).sort((a, b) => String(a.e.envoye_le).localeCompare(String(b.e.envoye_le)));
  if (!items.length) return '<div class="dbx-vide-petit">✓ Toutes les compagnies ont répondu (ou le délai n’est pas encore passé).</div>';
  return `<div class="sux-relances">${items.map(({ d, e, idx }) => `<div class="opx-offre relancer">
    <span class="opx-offre-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(e.compagnie, 32) : ''}</span>
    <div class="opx-offre-corps"><b>${suxEsc(e.compagnie)}</b><span class="opx-offre-details">${suxEsc(suxNomDemande(d))} · envoyée il y a ${opJoursDepuis(e.envoye_le)} j${e.nb_relances ? ` · ${e.nb_relances} relance${e.nb_relances > 1 ? 's' : ''}` : ''}</span></div>
    <div class="opx-offre-boutons">
      <button type="button" onclick="opRelancerCompagnie('${d.id}',${idx})">🔔 Relancer</button>
      ${d.opportunite_id ? `<button type="button" onclick="opSaisirOffre('${d.opportunite_id}','${d.id}',${idx})">📥 Reçue</button>` : ''}
    </div>
  </div>`).join('')}</div>`;
}

function htmlSuxDormantes(dormantes) {
  if (!dormantes.length) return '<div class="dbx-vide-petit">✓ Aucune affaire endormie.</div>';
  return `<div class="sux-mini">${dormantes.sort((a, b) => String(opDerniereActivite(a)).localeCompare(String(opDerniereActivite(b)))).slice(0, 8).map(o => `
    <button type="button" onclick="editerOpportunite('${o.id}')"><span><b>${suxEsc(o.titre)}</b><small>${suxEsc(opNomClient(o) || '—')} · ${suxEsc(o.stade)}</small></span><em>${opJoursDepuis(opDerniereActivite(o))} j</em></button>`).join('')}</div>`;
}

function htmlSuxDemandes() {
  const ds = (window._suiviDemandes || []).slice(0, 8);
  if (!ds.length) return `<div class="dbx-vide-petit">Aucune demande d’offre pour l’instant. <button type="button" class="dbx-lien" onclick="navigate('nouvelle-demande-offre')">En créer une →</button></div>`;
  return `<div class="sux-mini">${ds.map(d => {
    const envs = Array.isArray(d.compagnies_envoi) ? d.compagnies_envoi : [];
    const recues = envs.filter(e => e.recue_le).length;
    const etat = !envs.length ? 'Pas encore envoyée' : `${envs.length} compagnie${envs.length > 1 ? 's' : ''} · ${recues} réponse${recues > 1 ? 's' : ''}`;
    return `<button type="button" onclick="demandeOffreEnEditionId='${d.id}';navigate('nouvelle-demande-offre')"><span><b>${suxEsc(suxNomDemande(d))}</b><small>${fmtDate(d.created_at)} · ${etat}</small></span>
      <span class="sux-logos">${envs.slice(0, 4).map(e => typeof pictoCompagnie === 'function' ? pictoCompagnie(e.compagnie, 22) : '').join('')}</span></button>`;
  }).join('')}</div>`;
}
