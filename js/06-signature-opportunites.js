function switchTab(btn, tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['tab-identite','tab-prevoyance','tab-collaborateurs','tab-flotte','tab-contrats','tab-factures','tab-rappels','tab-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });
}

// OPPORTUNITÉS
let opportuniteEnEditionId = null;
let prefillOpportuniteClientId = null;

function editerOpportunite(id) {
  opportuniteEnEditionId = id;
  navigate('nouvelle-opportunite');
}

// Select de changement de stade réutilisé partout (kanban, gagnées, perdues) — stoppe la propagation
// du clic pour ne pas déclencher l'ouverture de la fiche d'édition quand on choisit juste un stade.
function selectStadeOpportunite(o, stadeActuel, tousLesStades) {
  return `<select onclick="event.stopPropagation()" onchange="event.stopPropagation();changerStadeOpportunite('${o.id}', this.value)" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);font-size:10.5px;border-radius:5px;padding:3px 6px">
    <option value="">Changer stade →</option>
    ${tousLesStades.filter(s => s !== stadeActuel).map(s => `<option value="${s}">${s === 'Gagné' ? '✓ Gagné' : s === 'Perdu' ? '✕ Perdu' : s}</option>`).join('')}
  </select>`;
}

// Mode d'affichage du pipeline — persisté en mémoire seulement (pas besoin de le garder entre
// sessions), pour ne pas perdre le choix en changeant de stade/filtre dans la même visite.
let vueModePipeline = 'kanban'; // 'kanban' | 'liste' | 'echeances'

function viewOpportunites() {
  // Session RH (Cofidex) : Pipeline visible mais en lecture seule et sans aucun chiffre (primes,
  // commissions, valeur pondérée) — cf. RH_VUES_AUTORISEES et le garde-fou sidebar (js/03). Le
  // drapeau est calculé une fois ici et passé à chaque sous-vue plutôt que ré-appelé partout.
  const rhMode = estRoleRH();
  const stadeColor = { Contact:'#64748b', Analyse:'#38bdf8', Proposition:'#f59e0b', Négociation:'#a78bfa' };
  const stades = ['Contact','Analyse','Proposition','Négociation'];
  const tousLesStades = [...stades, 'Gagné', 'Perdu'];
  const OPPS = allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu');
  const gagnees = allOpportunites.filter(o => o.stade === 'Gagné');
  const perdues = allOpportunites.filter(o => o.stade === 'Perdu');
  const total = OPPS.reduce((s,o) => s+(o.montant_potentiel||0), 0);
  const pondere = OPPS.reduce((s,o) => s+Math.round((o.montant_potentiel||0)*(o.probabilite||0)/100), 0);
  const caPotentiel = OPPS.reduce((s,o) => s+(o.commission_estimee||0), 0);

  function nomClient(o) {
    const c = allClients.find(cl => cl.id === o.client_id);
    if (c) return estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
    return o.prospect_nom ? `${o.prospect_nom} 🆕` : '—';
  }

  const toggleVues = [
    { id: 'kanban', label: '📋 Kanban' },
    { id: 'liste', label: '📃 Liste' },
    { id: 'echeances', label: '📅 Échéances' },
    { id: 'priorites', label: '🎯 Priorités' },
  ].map(v => `<button class="tab-btn ${vueModePipeline === v.id ? 'active' : ''}" onclick="vueModePipeline='${v.id}';navigate('opportunites')">${v.label}</button>`).join('');

  let corps;
  if (vueModePipeline === 'liste') corps = renderListeOpportunites(allOpportunites, nomClient, tousLesStades, stadeColor, rhMode);
  else if (vueModePipeline === 'echeances') corps = renderEcheancesOpportunites(OPPS, nomClient, stadeColor, rhMode);
  else if (vueModePipeline === 'priorites') corps = renderPrioritesOpportunites(OPPS, nomClient, stadeColor, rhMode);
  else corps = renderKanbanOpportunites(OPPS, gagnees, perdues, stades, stadeColor, tousLesStades, nomClient, rhMode);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Pipeline — Opportunités</h2>
      ${rhMode ? '' : `<button class="btn-add" onclick="opportuniteEnEditionId=null;navigate('nouvelle-opportunite')">+ Nouvelle opportunité</button>`}
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">${rhMode ? "Vue d'ensemble des affaires en cours (stades, clients, tâches liées) — lecture seule, sans montants." : 'Suivi des affaires en négociation, avant signature. Une fois "Gagnée" depuis le menu de stade, l\'opportunité ouvre directement le formulaire de contrat pré-rempli.'}</div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${rhMode ? '' : statCard('Pipeline total (prime)', 'CHF ' + total.toLocaleString(), '#f59e0b')}
      ${rhMode ? '' : statCard('Pondéré (prime)', 'CHF ' + pondere.toLocaleString(), '#38bdf8')}
      ${rhMode ? '' : statCard('CA potentiel (commissions)', 'CHF ' + caPotentiel.toLocaleString(), '#4ade80')}
      ${statCard('En cours', OPPS.length, '#e2e8f0')}
      ${statCard('Gagnées', gagnees.length, '#4ade80')}
    </div>
    ${rhMode ? '' : renderStatsBranchesPipeline(OPPS)}
    <div class="tabs" style="margin-bottom:18px">${toggleVues}</div>
    ${corps}`;
}

// ── Stats du pipeline par branche — nécessite que les opportunités aient un champ `produits`
// (tableau d'ids catalogue) rempli. Basé sur PRODUIT_BRANCHES (js/02-catalogue-session.js).
// Principe "jamais 0 sans être sûr" : une opp sans produits sélectionnés n'entre dans aucun total.
function renderStatsBranchesPipeline(OPPS) {
  let volumeEntreprise = 0;
  let commissionSante = 0;
  let commissionVie = 0;
  OPPS.forEach(o => {
    const produits = Array.isArray(o.produits) ? o.produits : [];
    if (!produits.length) return;
    const client = allClients.find(c => c.id === o.client_id);
    const entreprise = client ? estEntreprise(client) : false;
    const branches = new Set();
    produits.forEach(pid => (PRODUIT_BRANCHES[pid] || []).forEach(b => branches.add(b)));
    const montant = o.montant_potentiel || 0;
    if (entreprise) {
      volumeEntreprise += montant;
    } else {
      if (branches.has('lamal') || branches.has('sante_complementaire')) commissionSante += montant;
      if (branches.has('vie') || branches.has('lpp')) commissionVie += montant;
    }
  });
  if (!volumeEntreprise && !commissionSante && !commissionVie) return '';
  return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;background:var(--surface-alt);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;width:100%;margin-bottom:2px">📊 Pipeline par branche (selon produits sélectionnés)</div>
    <div style="flex:1;min-width:160px"><div style="font-size:10.5px;color:var(--text-muted)">Volume prime entreprises</div><div style="font-size:16px;font-weight:800;color:var(--text)">CHF ${fmtCHF(volumeEntreprise)}</div></div>
    <div style="flex:1;min-width:160px"><div style="font-size:10.5px;color:var(--text-muted)">Santé — privés</div><div style="font-size:16px;font-weight:800;color:var(--text)">CHF ${fmtCHF(commissionSante)}</div></div>
    <div style="flex:1;min-width:160px"><div style="font-size:10.5px;color:var(--text-muted)">Vie / LPP — privés</div><div style="font-size:16px;font-weight:800;color:var(--text)">CHF ${fmtCHF(commissionVie)}</div></div>
  </div>`;
}

// ── Vue Kanban (par défaut) — colonnes par stade + tableaux Gagnées/Perdues en dessous ──
// rhMode : carte non cliquable (pas d'accès à la fiche d'édition), sans montant ni menu de
// changement de stade (action réservée aux rôles apporteur/signataire).
function renderKanbanOpportunites(OPPS, gagnees, perdues, stades, stadeColor, tousLesStades, nomClient, rhMode) {
  let kanban = stades.map(stade => {
    const opps = OPPS.filter(o => o.stade === stade);
    const color = stadeColor[stade];
    return `<div class="kanban-col">
      <div class="kanban-col-title">
        <div class="kanban-dot" style="background:${color}"></div>
        <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.8px">${stade}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-left:auto">${opps.length}</div>
      </div>
      ${opps.map(o => {
        const tachesOuvertes = allRappels.filter(r => r.opportunite_id === o.id && r.statut === 'ouvert').length;
        return `<div class="kanban-card" ${rhMode ? '' : `onclick="editerOpportunite('${o.id}')" style="cursor:pointer"`}>
        <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:4px">${o.titre}</div>
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:1px">${nomClient(o)}</div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:8px">${o.compagnie || '&nbsp;'}${tachesOuvertes > 0 ? ` · ☑ ${tachesOuvertes} tâche${tachesOuvertes > 1 ? 's' : ''}` : ''}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${rhMode ? '<span></span>' : `<span style="font-size:13px;font-weight:800;color:#f59e0b">CHF ${fmtCHF((o.montant_potentiel||0))}</span>`}
          ${o.apporteur_id ? avatar(agentById(o.apporteur_id), 22) : ''}
        </div>
        <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${o.probabilite||0}%;background:${color}"></div></div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:6px;display:flex;justify-content:space-between;align-items:center">
          <span>${o.probabilite||0}%</span>
          ${rhMode ? '' : selectStadeOpportunite(o, stade, tousLesStades)}
        </div>
      </div>`;
      }).join('')}
      ${opps.length === 0 ? '<div class="kanban-empty">Aucune</div>' : ''}
    </div>`;
  }).join('');

  return `<div class="kanban">${kanban}</div>
    ${gagnees.length > 0 ? `<div style="margin-top:24px">
      <div style="font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">✓ Gagnées (${gagnees.length})</div>
      <div class="table-wrap">${gagnees.map(o => `<div class="table-row" style="grid-template-columns:${rhMode ? '1fr 160px 150px' : '1fr 160px 100px 150px 110px'};${rhMode ? '' : 'cursor:pointer'}" ${rhMode ? '' : `onclick="editerOpportunite('${o.id}')"`}>
        <div style="font-weight:700;font-size:13px;color:var(--text)">${o.titre}</div>
        <div style="font-size:13px;font-weight:800;color:var(--text)">${nomClient(o)}</div>
        ${rhMode ? '' : `<div style="font-size:12px;font-weight:700;color:#f59e0b">CHF ${fmtCHF((o.montant_potentiel||0))}</div>`}
        ${rhMode ? '' : `<div>${selectStadeOpportunite(o, 'Gagné', tousLesStades)}</div>`}
        <div>${o.contrat_id ? badge('Contrat créé', '#4ade80') : badge('À finaliser', '#f59e0b')}</div>
      </div>`).join('')}</div>
    </div>` : ''}
    ${perdues.length > 0 ? `<div style="margin-top:24px">
      <div style="font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">✕ Perdues (${perdues.length})</div>
      <div class="table-wrap">${perdues.map(o => `<div class="table-row" style="grid-template-columns:${rhMode ? '1fr 160px' : '1fr 160px 100px 150px'};${rhMode ? '' : 'cursor:pointer'}" ${rhMode ? '' : `onclick="editerOpportunite('${o.id}')"`}>
        <div style="font-weight:700;font-size:13px;color:var(--text)">${o.titre}</div>
        <div style="font-size:13px;font-weight:800;color:var(--text)">${nomClient(o)}</div>
        ${rhMode ? '' : `<div style="font-size:12px;font-weight:700;color:var(--text-muted)">CHF ${fmtCHF((o.montant_potentiel||0))}</div>`}
        ${rhMode ? '' : `<div>${selectStadeOpportunite(o, 'Perdu', tousLesStades)}</div>`}
      </div>`).join('')}</div>
    </div>` : ''}`;
}

// ── Vue Liste — toutes les opportunités (tous stades confondus) en une seule table triable ──
// Utile pour scanner/trier vite par montant, probabilité ou échéance sans le découpage par
// colonnes du Kanban, notamment quand le pipeline devient long.
let opportunitesTriListe = 'montant_desc';
function renderListeOpportunites(toutes, nomClient, tousLesStades, stadeColor, rhMode) {
  const tris = {
    montant_desc: (a,b) => (b.montant_potentiel||0) - (a.montant_potentiel||0),
    montant_asc: (a,b) => (a.montant_potentiel||0) - (b.montant_potentiel||0),
    echeance_asc: (a,b) => (a.date_echeance ? new Date(a.date_echeance) : Infinity) - (b.date_echeance ? new Date(b.date_echeance) : Infinity),
    probabilite_desc: (a,b) => (b.probabilite||0) - (a.probabilite||0),
    stade: (a,b) => tousLesStades.indexOf(a.stade) - tousLesStades.indexOf(b.stade),
  };
  // rhMode : tri par montant retiré du menu (rien à trier, rien à afficher) — bascule sur échéance.
  const triActif = rhMode && opportunitesTriListe.startsWith('montant') ? 'echeance_asc' : opportunitesTriListe;
  const liste = [...toutes].sort(tris[triActif] || tris.montant_desc);
  const cols = rhMode ? '1fr 160px 120px 120px 90px' : '1fr 160px 120px 120px 90px 110px';
  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <select class="form-select" style="max-width:220px" onchange="opportunitesTriListe=this.value;navigate('opportunites')">
        ${rhMode ? '' : `<option value="montant_desc" ${opportunitesTriListe==='montant_desc'?'selected':''}>Trier : montant décroissant</option>
        <option value="montant_asc" ${opportunitesTriListe==='montant_asc'?'selected':''}>Trier : montant croissant</option>`}
        <option value="echeance_asc" ${triActif==='echeance_asc'?'selected':''}>Trier : échéance la plus proche</option>
        <option value="probabilite_desc" ${triActif==='probabilite_desc'?'selected':''}>Trier : probabilité décroissante</option>
        <option value="stade" ${triActif==='stade'?'selected':''}>Trier : par stade</option>
      </select>
    </div>
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}"><div>Titre</div><div>Client</div><div>Compagnie</div><div>Stade</div><div>Prob.</div>${rhMode ? '' : '<div>Montant</div>'}</div>
      ${liste.length ? liste.map(o => `<div class="table-row" style="grid-template-columns:${cols};${rhMode ? '' : 'cursor:pointer'}" ${rhMode ? '' : `onclick="editerOpportunite('${o.id}')"`}>
        <div><div style="font-weight:700;font-size:13px;color:var(--text)">${o.titre}</div>${o.date_echeance ? `<div style="font-size:10.5px;color:var(--text-muted)">Échéance ${fmtDate(o.date_echeance)}</div>` : ''}</div>
        <div style="font-size:13px;color:var(--text)">${nomClient(o)}</div>
        <div style="font-size:12.5px;color:var(--text-muted)">${o.compagnie || '—'}</div>
        <div>${badge(o.stade, stadeColor[o.stade] || (o.stade === 'Gagné' ? '#4ade80' : '#f87171'))}</div>
        <div style="font-size:12.5px;color:var(--text-muted)">${o.probabilite||0}%</div>
        ${rhMode ? '' : `<div style="font-weight:800;color:#f59e0b">CHF ${fmtCHF((o.montant_potentiel||0))}</div>`}
      </div>`).join('') : '<div class="table-empty">Aucune opportunité.</div>'}
    </div>`;
}

// ── Vue Échéances — regroupe les opportunités OUVERTES par urgence de date d'échéance ──
// Pense comme un plan de relance : ce qui est en retard ou cette semaine remonte en premier.
function renderEcheancesOpportunites(oppsOuvertes, nomClient, stadeColor, rhMode) {
  const today = new Date(); today.setHours(0,0,0,0);
  const in7 = new Date(today.getTime() + 7*86400000);
  const in30 = new Date(today.getTime() + 30*86400000);
  function jours(o) { return o.date_echeance ? Math.floor((new Date(o.date_echeance) - today) / 86400000) : null; }
  const buckets = [
    { label: '🔴 En retard', test: o => { const j = jours(o); return j !== null && j < 0; } },
    { label: '🟠 Cette semaine', test: o => { const j = jours(o); return j !== null && j >= 0 && j <= 7; } },
    { label: '🟡 Ce mois-ci', test: o => { const j = jours(o); return j !== null && j > 7 && j <= 30; } },
    { label: '⚪ Plus tard', test: o => { const j = jours(o); return j !== null && j > 30; } },
    { label: '— Sans échéance', test: o => !o.date_echeance },
  ];
  return buckets.map(b => {
    const liste = oppsOuvertes.filter(b.test).sort((a,c) => (a.date_echeance||'9999') < (c.date_echeance||'9999') ? -1 : 1);
    if (!liste.length) return '';
    return `<div style="margin-bottom:22px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">${b.label} (${liste.length})</div>
      <div class="table-wrap">${liste.map(o => `<div class="table-row" style="grid-template-columns:${rhMode ? '1fr 160px 110px 120px' : '1fr 160px 110px 100px 120px'};${rhMode ? '' : 'cursor:pointer'}" ${rhMode ? '' : `onclick="editerOpportunite('${o.id}')"`}>
        <div style="font-weight:700;font-size:13px;color:var(--text)">${o.titre}</div>
        <div style="font-size:13px;color:var(--text)">${nomClient(o)}</div>
        <div>${badge(o.stade, stadeColor[o.stade] || '#64748b')}</div>
        ${rhMode ? '' : `<div style="font-weight:800;color:#f59e0b">CHF ${fmtCHF((o.montant_potentiel||0))}</div>`}
        <div style="font-size:12px;color:var(--text-muted)">${o.date_echeance ? fmtDate(o.date_echeance) : '—'}</div>
      </div>`).join('')}</div>
    </div>`;
  }).join('') || '<div class="table-empty">Aucune opportunité ouverte.</div>';
}

// ── Vue Priorités — croise chaque opportunité ouverte avec ses tâches liées (rappels.opportunite_id)
// et un score d'urgence (échéance, retard des tâches, probabilité, valeur pondérée, inactivité).
// Objectif : une seule vue qui répond à "qu'est-ce que je dois faire aujourd'hui sur mon pipeline ?"
// — contrairement au Kanban (organisé par stade) ou aux Échéances (organisé seulement par date),
// ici le tri tient aussi compte des tâches en retard et des opportunités qui stagnent sans relance.
function scorerPrioriteOpportunite(o, tachesLiees) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const jours = o.date_echeance ? Math.floor((new Date(o.date_echeance) - today) / 86400000) : null;
  const tachesOuvertes = tachesLiees.filter(r => r.statut === 'ouvert');
  const tachesEnRetard = tachesOuvertes.filter(r => r.date_echeance && new Date(r.date_echeance) < today);
  const joursDepuisCreation = o.created_at ? Math.floor((today - new Date(o.created_at)) / 86400000) : 0;
  // "Stagnante" : idée perso — une opp encore au tout début du pipeline, sans aucune tâche de
  // relance programmée depuis plus de 2 semaines, est justement celle qui passe le plus souvent
  // à la trappe. Ni le Kanban ni les Échéances ne la remontent si elle n'a pas de date fixée.
  const stagnante = tachesOuvertes.length === 0 && ['Contact', 'Analyse'].includes(o.stade) && joursDepuisCreation > 14;

  const reasons = [];
  let score = 0;
  if (tachesEnRetard.length) { score += 100; reasons.push(`⏰ ${tachesEnRetard.length} tâche${tachesEnRetard.length > 1 ? 's' : ''} en retard`); }
  if (jours !== null && jours < 0) { score += 90; reasons.push(`📅 Échéance dépassée (${Math.abs(jours)}j)`); }
  else if (jours !== null && jours <= 7) { score += 60; reasons.push(`📅 Échéance dans ${jours}j`); }
  else if (jours !== null && jours <= 30) { score += 25; reasons.push(`📅 Échéance dans ${jours}j`); }
  if ((o.probabilite || 0) >= 75) { score += 20; reasons.push(`🎯 Probabilité ${o.probabilite}%`); }
  if (stagnante) { score += 35; reasons.push(`🕸️ Sans tâche depuis ${joursDepuisCreation}j`); }
  if (!tachesOuvertes.length && !stagnante) reasons.push('— Aucune tâche liée');
  score += Math.round((o.montant_potentiel || 0) * (o.probabilite || 0) / 100 / 500); // poids valeur pondérée

  let tier;
  if (tachesEnRetard.length || (jours !== null && jours <= 7)) tier = 'urgent';
  else if (stagnante || (jours !== null && jours <= 30) || (o.probabilite || 0) >= 75) tier = 'suivre';
  else tier = 'normal';

  return { score, tier, reasons, tachesOuvertes };
}

function renderPrioritesOpportunites(OPPS, nomClient, stadeColor, rhMode) {
  if (!OPPS.length) return '<div class="table-empty">Aucune opportunité ouverte.</div>';
  const scored = OPPS.map(o => {
    const tachesLiees = allRappels.filter(r => r.opportunite_id === o.id);
    return { o, ...scorerPrioriteOpportunite(o, tachesLiees) };
  }).sort((a, b) => b.score - a.score);

  const tiers = [
    { id: 'urgent', label: "🔴 Urgent — à traiter aujourd'hui" },
    { id: 'suivre', label: '🟠 À suivre cette semaine' },
    { id: 'normal', label: '🟢 En cours, sous contrôle' },
  ];

  const corps = tiers.map(t => {
    const items = scored.filter(s => s.tier === t.id);
    if (!items.length) return '';
    return `<div style="margin-bottom:24px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">${t.label} (${items.length})</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${items.map(s => renderCartePrioriteOpportunite(s, nomClient, stadeColor, rhMode)).join('')}
      </div>
    </div>`;
  }).join('');

  return corps || '<div class="table-empty">Aucune opportunité ouverte.</div>';
}

// rhMode : pas de valeur pondérée (CHF) affichée, pas de clic vers la fiche d'édition (hors
// périmètre RH) — le reste (raisons de priorité, tâches liées, création rapide) reste utile.
function renderCartePrioriteOpportunite(s, nomClient, stadeColor, rhMode) {
  const o = s.o;
  const valeurPonderee = Math.round((o.montant_potentiel || 0) * (o.probabilite || 0) / 100);
  const borderColor = s.tier === 'urgent' ? '#f87171' : s.tier === 'suivre' ? '#f59e0b' : 'var(--border)';
  return `<div style="background:var(--surface-alt);border:1px solid ${borderColor};border-left:3px solid ${borderColor};border-radius:12px;padding:14px 16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px;${rhMode ? '' : 'cursor:pointer'}" ${rhMode ? '' : `onclick="editerOpportunite('${o.id}')"`}>
        <div style="font-size:13.5px;font-weight:800;color:var(--text)">${o.titre}</div>
        <div style="font-size:12.5px;color:var(--text-muted)">${nomClient(o)} · ${badge(o.stade, stadeColor[o.stade] || '#64748b')}</div>
      </div>
      <div style="text-align:right">
        ${rhMode ? '' : `<div style="font-size:13px;font-weight:800;color:#f59e0b">CHF ${fmtCHF(valeurPonderee)} <span style="font-weight:500;color:var(--text-muted);font-size:10.5px">pondéré</span></div>`}
        <div style="font-size:10.5px;color:var(--text-muted)">${o.date_echeance ? `Échéance ${fmtDate(o.date_echeance)}` : 'Sans échéance'}</div>
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      ${s.reasons.map(r => `<span style="font-size:10px;color:var(--text-muted);background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:2px 8px">${r}</span>`).join('')}
    </div>
    ${s.tachesOuvertes.length ? `<div style="margin-top:10px;display:flex;flex-direction:column;gap:5px">
      ${s.tachesOuvertes.map(r => `<label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text);cursor:pointer">
        <input type="checkbox" onclick="event.stopPropagation();toggleTacheDepuisPriorites('${r.id}')">
        <span>${r.titre}${r.date_echeance ? ` <span style="color:${new Date(r.date_echeance) < new Date() ? '#f87171' : 'var(--text-muted)'}">(${fmtDate(r.date_echeance)})</span>` : ''}</span>
      </label>`).join('')}
    </div>` : `<div style="margin-top:10px">
      <button type="button" onclick="event.stopPropagation();creerTacheRapideOpportunite('${o.id}','${s.tier}')" style="background:var(--surface);border:1px dashed var(--border);color:var(--text-muted);font-size:11px;border-radius:8px;padding:5px 10px;cursor:pointer">+ Créer une tâche de relance</button>
    </div>`}
  </div>`;
}

async function toggleTacheDepuisPriorites(id) {
  const r = await dbPatch('rappels', id, { statut: 'traité' });
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  navigate('opportunites');
}

async function creerTacheRapideOpportunite(oppId, tier) {
  const opp = allOpportunites.find(o => o.id === oppId);
  const monAgent = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
  const demain = new Date(); demain.setDate(demain.getDate() + 1);
  const body = {
    titre: `Relancer — ${opp ? opp.titre : ''}`,
    nature: 'tache',
    type: 'Opportunité',
    client_id: opp ? (opp.client_id || null) : null,
    opportunite_id: oppId,
    apporteur_id: (opp && opp.apporteur_id) || (monAgent ? monAgent.id : null),
    date_echeance: demain.toISOString().slice(0, 10),
    urgence: tier === 'urgent' ? 'haute' : 'moyenne',
    statut: 'ouvert',
  };
  const r = await dbPost('rappels', body);
  if (r && r.error) { showError('Erreur lors de la création de la tâche : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  navigate('opportunites');
}

// ── Tâches liées à une opportunité (réutilise la table rappels, colonne opportunite_id) ──
async function ajouterTacheOpportunite(oppId) {
  const input = document.getElementById('opp-nouvelle-tache');
  const titre = input.value.trim();
  if (!titre) return;
  const dateInput = document.getElementById('opp-nouvelle-tache-date');
  const dateEcheance = dateInput && dateInput.value ? dateInput.value : null;
  const opp = allOpportunites.find(o => o.id === oppId);
  // Sans apporteur_id, la tâche est invisible du badge "mes tâches" de la sidebar et de tout
  // filtre par agent — bug réel repéré par Jonathan (une tâche créée depuis une opp ne
  // remontait nulle part dans le système de rappels). Priorité à l'agent responsable de l'opp
  // elle-même (opp.apporteur_id) ; à défaut, l'agent actuellement connecté.
  // nature: 'tache' (et non 'rappel') pour que ça se comporte et s'affiche exactement comme les
  // autres tâches du CRM (icône 📋, checklist d'étapes disponible) — cohérent avec le libellé
  // "Tâches" de cette section. Sans date_echeance, l'élément tombait tout en bas de la liste
  // "Tâches & Rappels" (catégorie "Plus d'un an / sans échéance"), invisible en pratique.
  const monAgent = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
  const body = {
    titre,
    nature: 'tache',
    type: 'Opportunité',
    client_id: opp ? (opp.client_id || null) : null,
    opportunite_id: oppId,
    apporteur_id: (opp && opp.apporteur_id) || (monAgent ? monAgent.id : null),
    date_echeance: dateEcheance,
    urgence: 'moyenne',
    statut: 'ouvert',
  };
  input.value = '';
  if (dateInput) dateInput.value = '';
  const r = await dbPost('rappels', body);
  if (r && r.error) { showError('Erreur lors de l\u2019ajout de la tâche : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  navigate('nouvelle-opportunite');
}

async function toggleTacheOpportunite(id, fait) {
  const r = await dbPatch('rappels', id, { statut: fait ? 'traité' : 'ouvert' });
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  navigate('nouvelle-opportunite');
}

async function supprimerTacheOpportunite(id) {
  const r = await dbDelete('rappels', id);
  if (r && r.error) { showError('Erreur lors de la suppression : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  navigate('nouvelle-opportunite');
}

async function changerStadeOpportunite(id, nouveauStade) {
  if (!nouveauStade) return;
  const opp = allOpportunites.find(o => o.id === id);
  if (!opp) return;
  const r = await dbPatch('opportunites', id, { stade: nouveauStade });
  if (r && r.error) { showError('Erreur lors du changement de stade : ' + errMsg(r)); return; }
  opp.stade = nouveauStade;

  if (nouveauStade === 'Gagné') {
    const produits = Array.isArray(opp.produits) ? opp.produits : [];
    if (produits.length > 1) {
      proposerConversionMultiContrats(opp);
    } else {
      prefillOpportunite = opp;
      prefillOpportuniteProduitId = produits[0] || null;
      oppFileAttenteProduits = [];
      contratClientId = opp.client_id || null;
      navigate('nouveau-contrat');
    }
  } else {
    navigate('opportunites');
  }
}

// Opportunité gagnée avec PLUSIEURS produits envisagés cochés au pipeline : propose de créer un
// contrat par produit sélectionné (l'un après l'autre, cf. la reprise dans creerContratEtCommission
// / le post-enregistrement de "Nouveau contrat"), plutôt qu'un unique contrat générique qui
// forcerait à deviner lequel des produits a vraiment été signé.
function proposerConversionMultiContrats(opp) {
  const produits = (opp.produits || []).map(id => produitCategorieEtObjetParId(id)).filter(Boolean);
  creerModale('modal-conversion-opp', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:480px">
      <h3 style="margin:0 0 8px;font-size:16px;font-weight:800;color:var(--text)">🎉 Opportunité gagnée</h3>
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px">Plusieurs produits étaient envisagés sur "<strong>${opp.titre}</strong>". Sélectionne ceux réellement signés — un contrat sera créé pour chacun, l'un après l'autre.</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">
        ${produits.map(r => `<label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text);cursor:pointer;padding:8px 10px;border-radius:8px;background:var(--surface-alt)">
          <input type="checkbox" class="conv-opp-produit" value="${r.produit.id}" checked style="width:15px;height:15px;accent-color:var(--accent)"/>
          <span>${r.produit.label}</span>
        </label>`).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" onclick="document.getElementById('modal-conversion-opp').remove(); navigate('opportunites')">Annuler</button>
        <button class="btn-save" onclick="confirmerConversionMultiContrats('${opp.id}')">✓ Créer le(s) contrat(s)</button>
      </div>
    </div>`);
}

function confirmerConversionMultiContrats(oppId) {
  const opp = allOpportunites.find(o => o.id === oppId);
  const idsChoisis = [...document.querySelectorAll('.conv-opp-produit:checked')].map(el => el.value);
  document.getElementById('modal-conversion-opp')?.remove();
  if (!opp || !idsChoisis.length) { navigate('opportunites'); return; }
  prefillOpportunite = opp;
  prefillOpportuniteProduitId = idsChoisis[0];
  oppFileAttenteProduits = idsChoisis.slice(1);
  contratClientId = opp.client_id || null;
  navigate('nouveau-contrat');
}

// SUIVI — tableau de bord du portefeuille signé (après signature, distinct du Pipeline)
function viewSuivi() {
  const produitsDistincts = [...new Set(allContrats.map(ct => ct.produit).filter(Boolean))].sort();
  const produitOptions = produitsDistincts.map(p => `<option value="${p}">${p}</option>`).join('');

  setTimeout(() => renderSuiviTables(), 0);
  setTimeout(() => renderDemandesOffreSuivi(), 0);

  return `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">Suivi des affaires</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Contrats actifs, échéances proches, polices non commissionnées à reprendre.</div>

    <!-- ── Bloc pipeline commissions estimées ── -->
    ${(() => {
      const enCours = allContrats.filter(ct => ct.statut === 'en_cours' && ct.prime_annuelle > 0);
      const commissionsEstimees = allCommissionsAttente.filter(ca => ca.statut === 'en_attente' && ca.montant_estime > 0 && (() => { const ct = allContrats.find(x => x.id === ca.contrat_id); return ct && ct.date_debut >= DATE_BASCULE_ASSUREX; })());
      const totalComm = commissionsEstimees.reduce((s,ca) => s + Number(ca.montant_estime||0), 0);
      const totalCommGestion = commissionsEstimees.filter(ca => ca.nature === 'gestion').reduce((s,ca) => s + Number(ca.montant_estime||0), 0);
      const totalEnCours = enCours.reduce((s,ct) => s + Number(ct.prime_annuelle||0), 0);
      if (!commissionsEstimees.length && !enCours.length) return '';
      return `<div style="background:linear-gradient(135deg,rgba(74,222,128,0.06) 0%,rgba(56,189,248,0.04) 100%);border:1px solid rgba(74,222,128,0.2);border-radius:14px;padding:20px;margin-bottom:24px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:14px">💰 Pilotage commissions (depuis le 01.06.2026)</div>
        <div class="stat-grid">
          ${statCard('Commissions en attente', 'CHF ' + Math.round(totalComm).toLocaleString(), '#4ade80', `dont CHF ${fmtCHF(Math.round(totalCommGestion))} gestion — ${commissionsEstimees.length} dossiers`)}
          ${statCard('Contrats "en cours"', enCours.length, '#38bdf8', 'CHF ' + Math.round(totalEnCours).toLocaleString() + ' de primes')}
        </div>
        ${enCours.length ? `<div style="margin-top:14px;font-size:11px;color:var(--text-muted)">
          <strong style="color:var(--text)">Contrats en cours de signature :</strong>
          ${enCours.map(ct => {
            const cl = allClients.find(c => c.id === ct.client_id);
            const nom = cl ? (estEntreprise(cl)?cl.nom:`${cl.prenom} ${cl.nom}`) : '—';
            return `<div style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
              <a href="?client=${ct.client_id}" onclick="return irVersClient(event, '${ct.client_id}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted">${nom}</a>
              <span>${ct.produit||''} · ${ct.compagnie||''}</span>
              <span style="font-weight:700;color:#f59e0b">CHF ${fmtCHF(Number(ct.prime_annuelle||0))}/an</span>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>`;
    })()}

    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;align-items:center">
      <select class="form-select" id="su-produit" style="max-width:260px" onchange="renderSuiviTables()">
        <option value="">Tous les types de produit</option>
        ${produitOptions}
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-muted);cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px">
        <input type="checkbox" id="su-hide-lamal" checked onchange="renderSuiviTables()"/> Masquer LAMal
      </label>
    </div>

    <div id="su-stats" class="stat-grid" style="margin-bottom:24px"></div>
    <div id="su-tables"></div>

    <div style="margin-top:28px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px">📝 Demandes d'offre enregistrées</div>
      <div id="su-demandes-offre" class="table-empty">Chargement...</div>
    </div>`;
}

// Liste des demandes_offre sauvegardées (formulaire digital "Demande d'offre") — permet de
// rouvrir une demande déjà remplie pour cocher des compagnies et générer l'email, sans tout
// ressaisir. Chargée à part (fetch async) car jamais mise en cache globale ailleurs dans l'app.
async function renderDemandesOffreSuivi() {
  const zone = document.getElementById('su-demandes-offre');
  if (!zone) return;
  const demandes = await dbGet('demandes_offre', 'select=*&order=created_at.desc&limit=30');
  if (!Array.isArray(demandes) || !demandes.length) { zone.innerHTML = '<div class="table-empty">Aucune demande d’offre enregistrée pour l’instant.</div>'; return; }
  function nomPour(d) {
    if (d.client_id) { const c = allClients.find(cl => cl.id === d.client_id); if (c) return estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`; }
    return d.prospect_nom ? `${d.prospect_nom} 🆕` : '—';
  }
  zone.innerHTML = `<div class="table-wrap">${demandes.map(d => `
    <div class="table-row" style="grid-template-columns:1fr 150px 130px;cursor:pointer" onclick="demandeOffreEnEditionId='${d.id}';navigate('nouvelle-demande-offre')">
      <div style="font-weight:700;font-size:13px;color:var(--text)">${nomPour(d)}${d.opportunite_id ? ' <span style="color:var(--text-muted);font-weight:400">🎯 liée à une opp.</span>' : ''}</div>
      <div style="font-size:12px;color:var(--text-muted)">${fmtDate(d.created_at)}</div>
      <div><button onclick="event.stopPropagation();demandeOffreEnEditionId='${d.id}';navigate('nouvelle-demande-offre')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:5px 12px;font-size:11.5px;font-weight:700;cursor:pointer">↺ Reprendre / générer l’email</button></div>
    </div>`).join('')}</div>`;
}

function renderSuiviTables() {
  const today = new Date();
  const in60 = new Date(today.getTime() + 60*24*60*60*1000);
  const cols = '1fr 140px 110px 100px 110px 100px';

  function nomClient(ct) {
    const c = allClients.find(cl => cl.id === ct.client_id);
    return c ? (estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`) : '—';
  }

  const produitFilter = document.getElementById('su-produit')?.value || '';
  const hideLamal = document.getElementById('su-hide-lamal')?.checked;

  const base = allContrats.filter(ct => {
    if (hideLamal && (ct.produit||'').toLowerCase().includes('lamal')) return false;
    if (produitFilter && ct.produit !== produitFilter) return false;
    return true;
  });

  const aRenouveler = base.filter(ct => ct.statut === 'renouveler');
  const echeanceProche = base.filter(ct => {
    if (ct.statut !== 'actif' || !ct.date_echeance) return false;
    const d = new Date(ct.date_echeance);
    return d >= today && d <= in60;
  });
  const actifs = base.filter(ct => ct.statut === 'actif');
  const totalPrimes = actifs.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);

  document.getElementById('su-stats').innerHTML = `
    ${statCard('Contrats actifs', actifs.length, '#4ade80')}
    ${statCard('Primes annuelles', 'CHF ' + totalPrimes.toLocaleString(), '#f59e0b')}
    ${statCard('À renouveler', aRenouveler.length, '#f87171')}
    ${statCard('Échéance < 60j', echeanceProche.length, '#fbbf24')}`;

  // avecReporter : ajoute une colonne d'action "↻ Reporter d'un an" — pour les contrats "à
  // renouveler" qu'on n'a pas réussi à joindre/signer, plutôt que de les laisser polluer la
  // liste indéfiniment. Repousse l'échéance d'un an et repasse le contrat "actif" (il
  // retombera automatiquement en "à renouveler" à la nouvelle échéance, via basculerContratsEchus).
  function table(list, emptyMsg, avecReporter) {
    const colsActuelles = avecReporter ? cols + ' 160px' : cols;
    if (!list.length) return `<div class="table-empty">${emptyMsg}</div>`;
    return `<div class="table-wrap"><div class="table-header" style="grid-template-columns:${colsActuelles}"><div>Produit</div><div>Client</div><div>Compagnie</div><div>Échéance</div><div>Prime/an</div><div>Statut</div>${avecReporter ? '<div></div>' : ''}</div>
      ${list.map(ct => `<div class="table-row" style="grid-template-columns:${colsActuelles};cursor:pointer" onclick="showDetailContrat('${ct.id}')">
        <div><div style="font-weight:700;font-size:13px;color:var(--text)">${ct.produit}</div><div style="font-size:11px;color:var(--text-muted)">${ct.numero_police || ''}</div></div>
        <div style="font-size:13px;color:var(--text)">${nomClient(ct)}</div>
        <div style="font-size:13px;color:var(--text)">${ct.compagnie}</div>
        <div style="font-size:12px;color:var(--text-muted)">${fmtDate(ct.date_echeance)}</div>
        <div style="font-weight:800;color:#f59e0b">CHF ${fmtCHF(Number(ct.prime_annuelle||0))}</div>
        <div>${badge(ct.statut, ct.statut === 'actif' ? '#4ade80' : ct.statut === 'renouveler' ? '#f59e0b' : '#f87171')}${ct.commissionne === false ? ' ' + badge('Non commissionné', '#64748b') : ''}</div>
        ${avecReporter ? `<div><button type="button" onclick="event.stopPropagation();reporterRenouvellementContrat('${ct.id}')" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">↻ Reporter d'un an</button></div>` : ''}
      </div>`).join('')}</div>`;
  }

  document.getElementById('su-tables').innerHTML = `
    <div style="font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">⚠ À renouveler (${aRenouveler.length})</div>
    ${table(aRenouveler, 'Aucun contrat à renouveler.', true)}
    <div style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:1px;margin:24px 0 10px">⏳ Échéance dans moins de 60 jours (${echeanceProche.length})</div>
    ${table(echeanceProche, 'Aucune échéance proche.')}`;
}

// Repousse l'échéance d'un contrat "à renouveler" d'un an (même jour/mois, année suivante) et le
// repasse "actif" — pour les cas où le client n'a pas pu être recontacté/signé cette année-ci et
// qu'on veut le retirer de la liste "à renouveler" sans perdre le suivi (il y reviendra
// automatiquement à sa nouvelle échéance, un an plus tard).
async function reporterRenouvellementContrat(id) {
  const ct = allContrats.find(c => c.id === id);
  if (!ct) return;
  const base = (ct.date_echeance || new Date().toISOString()).split('T')[0];
  const [y, m, d] = base.split('-').map(Number);
  // Cas 29 février d'une année bissextile reporté vers une année non bissextile (ex: 2028 -> 2029) :
  // cette date n'existe pas, on tombe au 1er mars suivant plutôt que de planter le PATCH Postgres.
  const anneeSuivante = y + 1;
  const dateValide = new Date(Date.UTC(anneeSuivante, m - 1, d)).getUTCMonth() === m - 1;
  const nouvelleDate = dateValide
    ? `${anneeSuivante}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : `${anneeSuivante}-03-01`;
  const r = await dbPatch('contrats', id, { date_echeance: nouvelleDate, statut: 'actif' });
  if (r && r.error) { showError('Erreur lors du report : ' + errMsg(r)); return; }
  ct.date_echeance = nouvelleDate;
  ct.statut = 'actif';
  logAction('reporter_renouvellement', 'contrats', id, `Échéance reportée au ${fmtDate(nouvelleDate)}`);
  showError(`✓ Échéance reportée au ${fmtDate(nouvelleDate)} — le contrat repasse "actif" d'ici là.`);
  renderSuiviTables();
}

// RAPPELS
let filtreRappelsActuel = 'ouverts';

function filtrerVueRappels(filtre) {
  filtreRappelsActuel = filtre;
  navigate('rappels');
}

function viewRappels() {
  const uc = u => u === 'haute' ? '#f87171' : u === 'moyenne' ? '#f59e0b' : '#64748b';

  function nomClientRappel(r) {
    if (!r.client_id) return '';
    const c = allClients.find(cl => cl.id === r.client_id);
    return c ? (estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`) : '';
  }
  function dateRelative(dateStr) {
    if (!dateStr) return '';
    const j = Math.round((new Date(dateStr) - new Date()) / 86400000);
    if (j < 0) return ` · ⚠️ en retard de ${Math.abs(j)}j`;
    if (j === 0) return ` · aujourd'hui`;
    if (j <= 7) return ` · dans ${j}j`;
    if (j <= 31) return ` · dans ${Math.round(j/7)} sem.`;
    if (j <= 365) return ` · dans ${Math.round(j/30)} mois`;
    return ` · dans ${Math.round(j/365*10)/10} an(s)`;
  }

  const ouverts = allRappels
    .filter(r => r.statut === 'ouvert')
    .sort((a,b) => {
      const da = a.date_echeance ? new Date(a.date_echeance) : new Date('9999-01-01');
      const db = b.date_echeance ? new Date(b.date_echeance) : new Date('9999-01-01');
      return da - db;
    });

  const today = new Date();
  const finDuMois = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const enRetard = ouverts.filter(r => r.date_echeance && new Date(r.date_echeance) < today);
  const ceMois = ouverts.filter(r => r.date_echeance && new Date(r.date_echeance) >= today && new Date(r.date_echeance) <= finDuMois);
  const fermes = allRappels
    .filter(r => r.statut !== 'ouvert')
    .sort((a,b) => new Date(b.date_echeance||b.created_at||0) - new Date(a.date_echeance||a.created_at||0));

  // Grouper par horizon temporel (utilisé pour la vue "Ouverts")
  const groups = [
    { label: '🔴 En retard', color: '#f87171', items: enRetard },
    { label: '🟠 Dans les 30 prochains jours', color: '#fb923c', items: ouverts.filter(r => { if (!r.date_echeance) return false; const j = Math.round((new Date(r.date_echeance)-today)/86400000); return j>=0 && j<=30; }) },
    { label: '🟡 1 à 3 mois', color: '#f59e0b', items: ouverts.filter(r => { if (!r.date_echeance) return false; const j = Math.round((new Date(r.date_echeance)-today)/86400000); return j>30 && j<=90; }) },
    { label: '🔵 3 à 12 mois', color: '#38bdf8', items: ouverts.filter(r => { if (!r.date_echeance) return false; const j = Math.round((new Date(r.date_echeance)-today)/86400000); return j>90 && j<=365; }) },
    { label: '⚪ Plus d\'un an / sans échéance', color: '#64748b', items: ouverts.filter(r => !r.date_echeance || Math.round((new Date(r.date_echeance)-today)/86400000) > 365) },
  ];

  const renderItem = r => `<div class="rappel-item" style="cursor:pointer" onclick="showRappel('${r.id}')">
        <div class="urgence-dot" style="background:${uc(r.urgence||'basse')}"></div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${r.nature === 'tache' ? '📋' : (r.tache_parent_id ? '🔗🔔' : '🔔')} ${r.titre}</div>
          <div style="font-size:11px;color:var(--text-muted)">${nomClientRappel(r) ? `👤 <span onclick="event.stopPropagation(); showClient('${r.client_id}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted">${nomClientRappel(r)}</span> · ` : ''}${r.date_echeance ? fmtDate(r.date_echeance) : 'Sans échéance'}${dateRelative(r.date_echeance)}${r.date_planifiee ? ` · 📅 planifié le ${fmtDate(r.date_planifiee)}` : ''}${r.piece_jointe_nom ? ' · 📎 ' + r.piece_jointe_nom : ''}</div>
          ${r.notes ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:3px;font-style:italic">${r.notes.split('[')[0].substring(0,120)}${r.notes.length>120?'...':''}</div>` : ''}
        </div>
        ${badge(r.type || 'Suivi', '#64748b')}
        <button class="btn-traite" onclick="event.stopPropagation(); traiterRappel('${r.id}')">✓ Traité</button>
      </div>`;

  const renderGroupes = () => groups.map(g => {
    if (!g.items.length) return '';
    return `<div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:${g.color};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">${g.label} (${g.items.length})</div>
      ${g.items.map(renderItem).join('')}
    </div>`;
  }).join('');

  const renderListeSimple = (items, videMsg) => items.length
    ? items.map(renderItem).join('')
    : `<div class="table-empty">${videMsg}</div>`;

  const fermesHtml = fermes.length ? `<div class="table-wrap">
      <div class="table-header" style="grid-template-columns:1fr 160px 100px 80px 70px">
        <div>Titre</div><div>Client</div><div>Échéance</div><div>Type</div><div></div>
      </div>
      ${fermes.map(r => `<div class="table-row" style="grid-template-columns:1fr 160px 100px 80px 70px;opacity:.7;cursor:pointer" onclick="showRappel('${r.id}')">
        <div style="font-size:12px;color:var(--text)">${r.titre}</div>
        <div style="font-size:11px;color:var(--text-muted)">${nomClientRappel(r)||'—'}</div>
        <div style="font-size:11px;color:var(--text-muted)">${fmtDate(r.date_echeance)}</div>
        <div>${badge(r.type||'Suivi','#64748b')}</div>
        <div><button onclick="event.stopPropagation(); rouvrirRappel('${r.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer">↺</button></div>
      </div>`).join('')}
    </div>` : `<div class="table-empty">Aucun rappel fermé.</div>`;

  let corps = '';
  if (filtreRappelsActuel === 'ouverts') corps = renderGroupes() || '<div class="table-empty">✅ Aucun rappel ouvert.</div>';
  else if (filtreRappelsActuel === 'retard') corps = renderListeSimple(enRetard, '✅ Aucun rappel en retard.');
  else if (filtreRappelsActuel === 'mois') corps = renderListeSimple(ceMois, 'Aucune échéance ce mois-ci.');
  else if (filtreRappelsActuel === 'fermes') corps = fermesHtml;

  const filtreBtn = (id, label, count, couleur) => `<button onclick="filtrerVueRappels('${id}')" style="flex:1;min-width:110px;background:${filtreRappelsActuel===id?couleur:'var(--surface-alt)'};color:${filtreRappelsActuel===id?'#0a0e1a':'var(--text)'};border:1px solid ${filtreRappelsActuel===id?couleur:'var(--border)'};border-radius:9px;padding:12px 14px;cursor:pointer;font-weight:800;text-align:left;transition:all .15s">
    <div style="font-size:20px;line-height:1">${count}</div>
    <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;opacity:.85;margin-top:2px">${label}</div>
  </button>`;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Tâches & Rappels</h2>
      <button class="btn-add" onclick="navigate('nouveau-rappel')">+ Nouvelle tâche / rappel</button>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:22px;flex-wrap:wrap">
      ${filtreBtn('ouverts', 'Ouverts', ouverts.length, '#4ade80')}
      ${filtreBtn('retard', 'En retard', enRetard.length, '#f87171')}
      ${filtreBtn('mois', 'Ce mois', ceMois.length, '#f59e0b')}
      ${filtreBtn('fermes', 'Fermés', fermes.length, '#64748b')}
    </div>
    ${corps}`;
}

async function traiterRappel(id) {
  const r = allRappels.find(x => x.id === id);
  let resultat;
  if (r && r.outlook_event_id) {
    try { await deleteOutlookEvent(r.outlook_event_id); } catch(e) {}
    resultat = await dbPatch('rappels', id, { statut: 'traité', outlook_event_id: null });
    if (!(resultat && resultat.error)) r.outlook_event_id = null;
  } else {
    resultat = await dbPatch('rappels', id, { statut: 'traité' });
  }
  if (resultat && resultat.error) { showError('Erreur lors du traitement du rappel : ' + errMsg(resultat)); return; }
  if (r) r.statut = 'traité';
  navigate('rappels');
}

async function rouvrirRappel(id) {
  const r = allRappels.find(x => x.id === id);
  const resultat = await dbPatch('rappels', id, { statut: 'ouvert' });
  if (resultat && resultat.error) { showError('Erreur lors de la réouverture du rappel : ' + errMsg(resultat)); return; }
  if (r) r.statut = 'ouvert';
  if (r && r.date_echeance) {
    try {
      const eventId = await createOutlookEventFromRappel(r);
      if (eventId) {
        await dbPatch('rappels', id, { outlook_event_id: eventId });
        r.outlook_event_id = eventId;
      }
    } catch(e) {}
  }
  navigate('rappels');
}

// BORDEREAUX
let allBordereaux = [];

// ═══════════════════════════════════════════════════════════════
// FICHE DE PAIE — répartition des commissions reçues entre agents
// Bordereaux = argent qui ENTRE dans Assurex (compagnies → société)
// Fiche de paie = argent qui SORT vers les collaborateurs (société → agents)
// Taux toujours celui défini dans Paramètres → Agents (jamais de saisie manuelle)
// ═══════════════════════════════════════════════════════════════
function viewFichePaie() {
  const aujourd = new Date().toISOString().split('T')[0];
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  setTimeout(() => renderFichePaieApercu(), 0);
  return `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">Fiche de paie — répartition entre agents</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Les commissions <strong>reçues</strong> (argent réellement entré dans Assurex via un bordereau) sont réparties selon le taux fixe de chaque agent défini dans Paramètres → Agents. Une fois générée, une fiche de paie marque les commissions comme payées — elles ne seront plus proposées une seconde fois.</div>

    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;align-items:flex-end">
      <div><label style="font-size:10.5px;color:var(--text-muted);display:block;margin-bottom:3px">Du</label><input class="form-input" id="fp-debut" type="date" value="${debutMois}" onchange="renderFichePaieApercu()"/></div>
      <div><label style="font-size:10.5px;color:var(--text-muted);display:block;margin-bottom:3px">Au</label><input class="form-input" id="fp-fin" type="date" value="${aujourd}" onchange="renderFichePaieApercu()"/></div>
    </div>

    <div id="fp-stats" class="stat-grid" style="margin-bottom:20px"></div>
    <div id="fp-detail"></div>

    <div style="margin-top:28px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Historique des fiches de paie générées</div>
      <div id="fp-historique"></div>
    </div>`;
}

function commissionDateReception(ca) {
  // Retourne UNIQUEMENT une vraie date de réception (jamais la date de création
  // de l'enregistrement, qui ne reflète que le moment de saisie/import dans le CRM
  // et n'a aucune valeur pour savoir quand l'argent est réellement entré).
  if (ca.date_reception) return ca.date_reception;
  if (ca.bordereau_id) {
    const b = allBordereaux.find(bd => bd.id === ca.bordereau_id);
    if (b && b.date_reception) return b.date_reception;
  }
  return null;
}

function renderFichePaieApercu() {
  const debut = document.getElementById('fp-debut')?.value;
  const fin = document.getElementById('fp-fin')?.value;

  const eligibles = allCommissionsAttente.filter(ca => {
    if (ca.statut !== 'reçue') return false;
    if (ca.fiche_paie_id) return false; // déjà payée dans une fiche précédente
    const d = commissionDateReception(ca);
    if (!d) return false;
    if (debut && d < debut) return false;
    if (fin && d > fin) return false;
    return true;
  });

  // Calcul par ligne avec le taux FIXE de l'agent (Paramètres → Agents)
  const lignes = eligibles.map(ca => {
    const ct = ca.contrat_id ? allContrats.find(c => c.id === ca.contrat_id) : null;
    const cl = ct ? allClients.find(c => c.id === ct.client_id) : null;
    const montant = ca.montant_final != null ? ca.montant_final : (ca.montant_estime || 0);
    const s = splitMontantAgent(montant, ca.contrat_id);
    return { ca, ct, cl, montant, ...s };
  });

  const totalGlobal = lignes.reduce((s,l) => s + l.montant, 0);
  const parAgent = {};
  lignes.forEach(l => {
    const agentApporteur = l.agent;
    if (agentApporteur) {
      parAgent[agentApporteur.id] = parAgent[agentApporteur.id] || { agent: agentApporteur, total: 0, nb: 0 };
      parAgent[agentApporteur.id].total += l.pA;
      parAgent[agentApporteur.id].nb++;
    }
    const signataire = allAgents.find(a => a.role === 'signataire');
    if (signataire) {
      parAgent[signataire.id] = parAgent[signataire.id] || { agent: signataire, total: 0, nb: 0 };
      parAgent[signataire.id].total += l.pJ;
      parAgent[signataire.id].nb++;
    }
  });

  document.getElementById('fp-stats').innerHTML = `
    ${statCard('Commissions à répartir', lignes.length, '#38bdf8')}
    ${statCard('Montant total', 'CHF ' + Math.round(totalGlobal).toLocaleString(), '#f59e0b')}
    ${Object.values(parAgent).map(pa => statCard(pa.agent.prenom + ' ' + pa.agent.nom, 'CHF ' + Math.round(pa.total).toLocaleString(), agentColor(pa.agent))).join('')}
  `;

  const cols = '1fr 130px 110px 100px 100px 90px';
  const rows = lignes.map(l => {
    const nom = l.cl ? (estEntreprise(l.cl)?l.cl.nom:`${l.cl.prenom} ${l.cl.nom}`) : (l.ca.client_nom || '—');
    const sig = allAgents.find(a => a.role === 'signataire');
    return `<div class="table-row" style="grid-template-columns:${cols}">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${nom}</div>
        <div style="font-size:11px;color:var(--text-muted)">${l.ca.produit||''} · ${l.ca.compagnie||''}</div>
      </div>
      <div style="font-size:12px;color:var(--text-muted)">${fmtDate(commissionDateReception(l.ca))}</div>
      <div style="font-weight:800;color:var(--text);text-align:right">CHF ${fmtCHF(l.montant)}</div>
      <div style="text-align:right">${sig ? `<div style="font-size:11px;color:${agentColor(sig)}">${sig.prenom}: CHF ${fmtCHF(l.pJ)}</div>` : ''}</div>
      <div style="text-align:right">${l.agent ? `<div style="font-size:11px;color:${agentColor(l.agent)}">${l.agent.prenom}: CHF ${fmtCHF(l.pA)}</div>` : `<div style="font-size:11px;color:var(--text-muted)">—</div>`}</div>
      <div style="text-align:right;font-size:10px;color:var(--text-muted)">${l.agent ? (l.agent.taux||0)+'%' : '0%'}</div>
    </div>`;
  }).join('');

  document.getElementById('fp-detail').innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}"><div>Client / Contrat</div><div>Reçu le</div><div>Montant</div><div>Part signataire</div><div>Part apporteur</div><div>Taux</div></div>
      ${rows || '<div class="table-empty">Aucune commission reçue non encore payée sur cette période.</div>'}
    </div>
    ${lignes.length > 0 ? `<div style="margin-top:16px;display:flex;justify-content:flex-end">
      <button class="btn-save" onclick="genererFichePaie()">✓ Générer la fiche de paie et marquer comme payé</button>
    </div>` : ''}`;

  renderHistoriqueFichesPaie();
}

function renderHistoriqueFichesPaie() {
  const el = document.getElementById('fp-historique');
  if (!el) return;
  const fiches = [...allFichesPaie].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  el.innerHTML = fiches.length ? `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:140px 140px 120px 1fr"><div>Du</div><div>Au</div><div>Montant total</div><div>Générée le</div></div>
      ${fiches.map(f => `<div class="table-row" style="grid-template-columns:140px 140px 120px 1fr">
        <div style="font-size:12px;color:var(--text)">${fmtDate(f.date_debut)}</div>
        <div style="font-size:12px;color:var(--text)">${fmtDate(f.date_fin)}</div>
        <div style="font-weight:800;color:#f59e0b">CHF ${fmtCHF(Math.round(f.total_montant||0))}</div>
        <div style="font-size:11px;color:var(--text-muted)">${fmtDate(f.created_at)}</div>
      </div>`).join('')}
    </div>` : '<div class="table-empty">Aucune fiche de paie générée pour l\'instant.</div>';
}

async function genererFichePaie() {
  const debut = document.getElementById('fp-debut')?.value;
  const fin = document.getElementById('fp-fin')?.value;
  if (!debut || !fin) { showError('Sélectionne une période valide.'); return; }

  const eligibles = allCommissionsAttente.filter(ca => {
    if (ca.statut !== 'reçue' || ca.fiche_paie_id) return false;
    const d = commissionDateReception(ca);
    return d && d >= debut && d <= fin;
  });
  if (!eligibles.length) { showError('Aucune commission à inclure sur cette période.'); return; }

  if (!confirm(`Générer la fiche de paie du ${fmtDate(debut)} au ${fmtDate(fin)} pour ${eligibles.length} commission(s) ?\n\nCes commissions seront marquées comme payées et ne réapparaîtront plus dans une future fiche de paie.`)) return;

  const totalMontant = eligibles.reduce((s,ca) => s + Number(ca.montant_final != null ? ca.montant_final : (ca.montant_estime||0)), 0);

  const r = await dbPost('fiches_paie', { date_debut: debut, date_fin: fin, total_montant: Math.round(totalMontant) });
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  const ficheId = r && r[0] ? r[0].id : null;

  let echecsLiaison = 0;
  for (const ca of eligibles) {
    const r2 = await dbPatch('commissions_attente', ca.id, { fiche_paie_id: ficheId });
    if (r2 && r2.error) echecsLiaison++;
  }
  if (echecsLiaison > 0) {
    showError(`⚠️ ${echecsLiaison} commission(s) sur ${eligibles.length} n'ont pas pu être liée(s) à cette fiche de paie — elles risquent de réapparaître dans une prochaine fiche alors qu'elles sont déjà comptées ici. Vérifie manuellement.`);
  }

  logAction('generer_fiche_paie', 'fiches_paie', ficheId, `${fmtDate(debut)} → ${fmtDate(fin)} · CHF ${fmtCHF(Math.round(totalMontant))}`);
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  allFichesPaie = await dbGet('fiches_paie', 'select=*');

  imprimerFichePaie(ficheId, eligibles, debut, fin, totalMontant);
  navigate('fiche-paie');
}

// ═══ EXPORT PDF D'UN BORDEREAU ═══
function imprimerBordereau(bordereauId) {
  const b = allBordereaux.find(x => x.id === bordereauId);
  if (!b) return;
  const commissions = allCommissionsAttente.filter(c => c.bordereau_id === bordereauId);
  const contact = (allCompagniesContacts || []).find(c => c.compagnie.toLowerCase() === (b.compagnie||'').toLowerCase());
  const tauxCaution = b.taux_caution || 0;
  const montantCaution = Math.round((b.montant_brut||0) * (tauxCaution/100));
  const montantNet = (b.montant_brut||0) - montantCaution;

  let pJ = 0, pA = 0;
  const lignesHtml = commissions.map(c => {
    const montant = c.montant_final != null ? c.montant_final : (c.montant_estime || 0);
    const s = splitMontantAgent(montant, c.contrat_id);
    pJ += s.pJ; pA += s.pA;
    const sig = allAgents.find(a => a.role === 'signataire');
    return `<tr>
      <td>${c.client_nom||''}</td><td>${c.produit||''}</td><td>${c.numero_police||''}</td>
      <td style="text-align:right">CHF ${fmtCHF(montant)}</td>
      <td>${statutCommissionLabel(c.statut)}</td>
    </tr>`;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bordereau ${b.numero||''} — ${b.compagnie}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#0f2244}
      h1{font-size:18px;margin-bottom:2px} .sub{color:#666;font-size:12px;margin-bottom:20px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
      .box{border:1px solid #ddd;border-radius:8px;padding:10px 14px}
      .box .l{font-size:9px;text-transform:uppercase;color:#888;margin-bottom:3px}
      .box .v{font-size:16px;font-weight:800}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
      th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}
      th{background:#0f2244;color:#fff;text-transform:uppercase;font-size:10px}
      .total{font-size:15px;font-weight:800;margin-top:16px;text-align:right}
      @media print{ button{display:none} }
    </style></head><body>
    <h1>Bordereau ${b.numero || ''} — ${b.compagnie}</h1>
    <div class="sub">${b.mois}${contact ? ` · Contact : ${contact.libelle_contact||''} ${contact.email ? '('+contact.email+')' : ''}` : ''}</div>
    <div class="grid">
      <div class="box"><div class="l">Montant brut</div><div class="v">CHF ${fmtCHF((b.montant_brut||0))}</div></div>
      <div class="box"><div class="l">Caution (${tauxCaution}%)</div><div class="v">CHF ${fmtCHF(montantCaution)}</div></div>
      <div class="box"><div class="l">Net après caution</div><div class="v">CHF ${fmtCHF(montantNet)}</div></div>
      <div class="box"><div class="l">Statut</div><div class="v">${b.statut === 'reçu' ? 'Reçu' : 'Attendu'}${b.date_reception ? ' le '+fmtDate(b.date_reception) : ''}</div></div>
    </div>
    <table><thead><tr><th>Client</th><th>Produit</th><th>N° police</th><th>Montant</th><th>Statut</th></tr></thead>
    <tbody>${lignesHtml || '<tr><td colspan="5">Aucune commission rapprochée</td></tr>'}</tbody></table>
    <div class="total">Part Jonathan : CHF ${fmtCHF(pJ)} · Part apporteurs : CHF ${fmtCHF(pA)}</div>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#0f2244;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimer / Enregistrer en PDF</button>
    </body></html>`);
  win.document.close();
}

function imprimerFichePaie(ficheId, lignesCommissions, debut, fin, totalMontant) {
  const win = window.open('', '_blank');
  const lignesHtml = lignesCommissions.map(ca => {
    const ct = ca.contrat_id ? allContrats.find(c => c.id === ca.contrat_id) : null;
    const cl = ct ? allClients.find(c => c.id === ct.client_id) : null;
    const nom = cl ? (estEntreprise(cl)?cl.nom:`${cl.prenom} ${cl.nom}`) : (ca.client_nom||'—');
    const montant = ca.montant_final != null ? ca.montant_final : (ca.montant_estime||0);
    const s = splitMontantAgent(montant, ca.contrat_id);
    const sig = allAgents.find(a => a.role === 'signataire');
    return `<tr>
      <td>${nom}</td><td>${ca.produit||''}</td><td>${ca.compagnie||''}</td>
      <td style="text-align:right">CHF ${fmtCHF(montant)}</td>
      <td style="text-align:right">${sig ? sig.prenom+': CHF '+s.pJ : ''}</td>
      <td style="text-align:right">${s.agent ? s.agent.prenom+': CHF '+s.pA : '—'}</td>
    </tr>`;
  }).join('');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiche de paie ${fmtDate(debut)} - ${fmtDate(fin)}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#0f2244}
      h1{font-size:18px} table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
      th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}
      th{background:#0f2244;color:#fff;text-transform:uppercase;font-size:10px}
      .total{font-size:15px;font-weight:800;margin-top:16px;text-align:right}
      @media print{ button{display:none} }
    </style></head><body>
    <h1>Fiche de paie — Assurex Sàrl</h1>
    <p>Période : ${fmtDate(debut)} au ${fmtDate(fin)}</p>
    <table><thead><tr><th>Client</th><th>Produit</th><th>Compagnie</th><th>Montant</th><th>Part signataire</th><th>Part apporteur</th></tr></thead>
    <tbody>${lignesHtml}</tbody></table>
    <div class="total">Total : CHF ${fmtCHF(Math.round(totalMontant))}</div>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#0f2244;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimer / Enregistrer en PDF</button>
    </body></html>`);
  win.document.close();
}

// ═══ IMPORT DÉCOMPTE COMPAGNIE (Excel norme IG B2B — ex: Vaudoise "Décompte de prime") ═══
function viewImportDecompte() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">📊 Import décompte compagnie (Excel, norme IG B2B)</h2>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Lit directement le fichier envoyé par une compagnie — Excel norme IG B2B (testé avec La Vaudoise) ou PDF lu automatiquement par l'IA (pour les compagnies comme AXA qui n'envoient que du PDF). Réconcilie automatiquement les contrats par n° de police, propose un client probable par le nom quand le contrat n'est pas trouvé, et reprend directement le taux et le montant déjà calculés par la compagnie dans le fichier.</div>

    ${sectionCard('Fichier', '#38bdf8', `
      <input type="file" id="imp-file-input" accept=".xlsx,.xls" style="display:none" onchange="analyserDecompteExcel()"/>
      <input type="file" id="imp-pdf-input" accept="application/pdf" style="display:none" onchange="analyserDecomptePdf(this)"/>
      <button class="btn-secondary" onclick="document.getElementById('imp-file-input').click()">📎 Choisir le fichier Excel</button>
      <button class="btn-secondary" style="margin-left:8px" onclick="document.getElementById('imp-pdf-input').click()">📄 Choisir un PDF (ex: AXA)</button>
      <span id="imp-file-nom" style="margin-left:10px;font-size:12px;color:var(--text-muted)"></span>
      <div id="imp-pdf-status" style="margin-top:8px;font-size:12px"></div>
      <div style="margin-top:14px"><label class="form-label">Nature des commissions de ce lot</label>
        <select class="form-select" id="imp-nature-commission" style="max-width:320px">
          <option value="gestion">Gestion (décompte périodique de portefeuille)</option>
          <option value="acquisition">Acquisition (nouvelles affaires)</option>
        </select>
        <div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">Un décompte de prime périodique est généralement de la gestion — change si ce lot contient des affaires nouvelles.</div>
      </div>
    `)}

    <div id="imp-resultats"></div>
  `;
}

let _decompteLignes = [];
let _decompteNomAssureur = '';
let _decompteCommissionTotaleAnnoncee = null;

// Compare deux textes en ignorant accents, casse et ordre des mots (utile pour rapprocher un nom
// "Preneur d'assurance / Prénom" du fichier compagnie avec "prenom nom" tel que saisi dans le CRM,
// l'ordre des mots n'étant jamais garanti identique entre les deux sources).
function motsTriesSansAccents(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
}

// Un n° de police peut être noté avec des espacements différents et surtout des zéros non significatifs
// différents entre le CRM et le fichier compagnie (ex. CRM "529747 8 1210" vs fichier "00529747 8 1210")
// — on ne compare que la suite de chiffres significative pour ne pas rater ces correspondances.
function normPoliceNumero(s) {
  return (s || '').toString().replace(/\D/g, '').replace(/^0+/, '');
}

function normEnTeteColonne(h) {
  return (h == null ? '' : h.toString()).trim().toLowerCase().replace(/\s+/g, ' ');
}
function trouverColonne(headers, alias) {
  const aliasNorm = alias.map(normEnTeteColonne);
  for (let i = 0; i < headers.length; i++) {
    if (aliasNorm.includes(normEnTeteColonne(headers[i]))) return i;
  }
  return -1;
}
function estStatutResilieOuAnnule(statut) {
  const s = (statut || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ['resilie', 'annule', 'mandat_resilie'].includes(s);
}

// Recherche le contrat CRM correspondant à une ligne de décompte (par n° de police, avec départage
// par ressemblance de branche si plusieurs contrats partagent la même police), et à défaut un client
// probable par le nom — factorisé pour être réutilisé à l'analyse initiale ET après création manuelle
// d'un contrat manquant depuis l'écran d'import (sans redemander le fichier).
function matcherContratEtClient(numeroContrat, brancheInterne, nomFichier) {
  const npReq = normPoliceNumero(numeroContrat);
  const candidats = allContrats.filter(c => c.numero_police && normPoliceNumero(c.numero_police) === npReq);

  let contratTrouve = null;
  if (candidats.length === 1) contratTrouve = candidats[0];
  else if (candidats.length > 1) {
    const motsB = (brancheInterne || '').toLowerCase().split(/[^a-zàâäéèêëïîôöùûüç0-9]+/).filter(w => w.length >= 4);
    let meilleur = candidats[0], meilleurScore = -1;
    candidats.forEach(c => {
      const p = (c.produit || '').toLowerCase();
      let score = motsB.reduce((s, m) => s + (p.includes(m) ? 1 : 0), 0);
      if (!estStatutResilieOuAnnule(c.statut)) score += 0.5;
      if (score > meilleurScore) { meilleurScore = score; meilleur = c; }
    });
    contratTrouve = meilleur;
  }
  const clientTrouve = contratTrouve ? allClients.find(c => c.id === contratTrouve.client_id) : null;

  let clientSuggere = null;
  if (!clientTrouve && nomFichier) {
    const mf = motsTriesSansAccents(nomFichier);
    clientSuggere = allClients.find(c => {
      const nomComplet = estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`;
      return nomComplet.trim() && motsTriesSansAccents(nomComplet) === mf;
    }) || null;
  }

  return { contratTrouve, clientTrouve, clientSuggere };
}

// Ré-applique le rapprochement (police -> contrat CRM) sur toutes les lignes déjà analysées, sans
// redemander le fichier — utilisé après la création d'un contrat manquant depuis l'écran d'import,
// pour que la ligne (et toute autre ligne partageant la même police) se rattache immédiatement.
function reassocierLignesImport() {
  _decompteLignes.forEach(l => {
    const { contratTrouve, clientTrouve, clientSuggere } = matcherContratEtClient(l.numeroContrat, l.brancheInterne, l.nomVaudoise);
    const candidats = allContrats.filter(c => c.numero_police && normPoliceNumero(c.numero_police) === normPoliceNumero(l.numeroContrat));
    l.contratId = contratTrouve ? contratTrouve.id : null;
    l.clientId = contratTrouve ? (clientTrouve ? clientTrouve.id : null) : (clientSuggere ? clientSuggere.id : null);
    l.clientNomCRM = clientTrouve ? (estEntreprise(clientTrouve) ? clientTrouve.nom : `${clientTrouve.prenom} ${clientTrouve.nom}`) : null;
    l.clientSuggereNom = (!clientTrouve && clientSuggere) ? (estEntreprise(clientSuggere) ? clientSuggere.nom : `${clientSuggere.prenom} ${clientSuggere.nom}`) : null;
    l.ambigu = candidats.length > 1;
    if (contratTrouve) l.selectionne = true;
  });
  renderImportDecompte(_decompteNomAssureur, _decompteCommissionTotaleAnnoncee);
}

// Crée directement le contrat manquant à partir des données déjà présentes dans la ligne de décompte
// (compagnie, branche, n° de police, base de commission comme estimation de prime de départ) — pour
// le cas fréquent où la police n'a jamais été reçue/saisie mais que la compagnie facture déjà dessus.
async function creerContratDepuisImport(idx) {
  const l = _decompteLignes[idx];
  if (!l || !l.clientId) return;

  // Garde-fou anti-doublon : le client a peut-être déjà ce contrat en base, juste sans (ou avec un
  // mauvais) n° de police — dans ce cas il vaut mieux corriger la police sur l'existant que d'en
  // créer un second. On compare la branche du décompte aux produits déjà présents chez ce client.
  const motsB = (l.brancheInterne || '').toLowerCase().split(/[^a-zàâäéèêëïîôöùûüç0-9]+/).filter(w => w.length >= 4);
  const contratsSimilaires = allContrats.filter(c => {
    if (c.client_id !== l.clientId || estStatutResilieOuAnnule(c.statut)) return false;
    const p = (c.produit || '').toLowerCase();
    return motsB.some(m => p.includes(m));
  });
  if (contratsSimilaires.length > 0) {
    const liste = contratsSimilaires.map(c => `• ${c.produit} — ${c.compagnie}${c.numero_police ? ' (police ' + c.numero_police + ')' : ' (sans n° de police)'}`).join('\n');
    const continuer = confirm(`Ce client a déjà ${contratsSimilaires.length > 1 ? 'des contrats qui ressemblent' : 'un contrat qui ressemble'} à "${l.brancheInterne}" :\n\n${liste}\n\nIl s'agit peut-être du même contrat, juste sans le bon n° de police — dans ce cas Annuler ici et corrige plutôt son n° de police sur la fiche client.\n\nCréer quand même un nouveau contrat séparé ?`);
    if (!continuer) return;
  }

  const btn = document.getElementById(`imp-creer-${idx}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Création...'; }
  const body = {
    client_id: l.clientId,
    compagnie: normaliserCompagnie(_decompteNomAssureur || ''),
    produit: l.brancheInterne || 'Contrat (à préciser)',
    numero_police: l.numeroContrat,
    prime_annuelle: Math.round((l.commissionProduction || 0) * 100) / 100,
    statut: 'actif',
  };
  const r = await dbPost('contrats', body);
  if (r && r.error) {
    showError('Erreur lors de la création du contrat : ' + errMsg(r));
    if (btn) { btn.disabled = false; btn.textContent = '📝 Créer le contrat'; }
    return;
  }
  logAction('create_contrat', 'contrats', r && r[0] ? r[0].id : null, `${body.produit} — ${body.compagnie} (créé depuis import décompte, police jamais reçue)`);
  allContrats = await dbGet('contrats', 'select=*');
  showError(`✓ Contrat créé (${body.produit} — ${body.compagnie}, police ${body.numero_police}). Prime annuelle estimée à CHF ${fmtCHF(body.prime_annuelle)} depuis la base de commission du décompte — vérifie/corrige-la sur la fiche contrat, c'est une estimation de départ.`);
  reassocierLignesImport();
}

async function analyserDecompteExcel() {
  const input = document.getElementById('imp-file-input');
  const file = input.files[0];
  if (!file) return;
  document.getElementById('imp-file-nom').textContent = file.name;

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

  // Le nom de l'onglet varie selon les compagnies/versions ("Commissions" chez La Vaudoise) — on
  // cherche un onglet dont le nom évoque des commissions/primes avant de retomber sur le premier.
  const feuillePrimes = wb.SheetNames.find(n => n.toLowerCase().includes('commission'))
    || wb.SheetNames.find(n => n.toLowerCase().includes('prime')) || wb.SheetNames[0];
  const ws = wb.Sheets[feuillePrimes];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  // Métadonnées d'en-tête (nom assureur, total annoncé pour contrôle) — informatif
  let nomAssureur = '', commissionTotaleAnnoncee = null;
  rows.forEach(r => {
    if (r[0] === "Nom de l'assureur:") nomAssureur = r[1] || '';
    if (r[0] === 'Commission totale:') commissionTotaleAnnoncee = parseFloat(r[1]) || null;
  });

  // Trouve la ligne d'en-tête du tableau (celle qui contient "N° de contrat")
  const idxHeader = rows.findIndex(r => r[0] === 'N° de contrat');
  if (idxHeader === -1) { showError('Format non reconnu — impossible de trouver la ligne d’en-tête du tableau ("N° de contrat").'); return; }
  const headers = rows[idxHeader];

  // Résolution des colonnes par alias tolérant (accents/casse/espaces) — les décomptes Vaudoise ont
  // changé de mise en page entre versions (14 colonnes en janvier 2026, 23 colonnes en nov/déc 2025),
  // une correspondance rigide sur le nom exact de colonne cassait silencieusement l'import.
  const iContrat = trouverColonne(headers, ['N° de contrat']);
  const iNom = trouverColonne(headers, ["Preneur d'assurance/Nom", "Preneur d'assurance"]);
  const iPrenom = trouverColonne(headers, ['Prénom']);
  const iNpa = trouverColonne(headers, ['Nopost']);
  const iLocalite = trouverColonne(headers, ['Localité']);
  const iBranche = trouverColonne(headers, ['Branche interne']);
  const iNoFacture = trouverColonne(headers, ['No. Facture']);
  const iDateFacture = trouverColonne(headers, ['Date facture']);
  const iCommissionProd = trouverColonne(headers, ['Commission production', 'Prime commis.']);
  const iTaux = trouverColonne(headers, ['Taux %']);
  const iMontantDetaille = trouverColonne(headers, ['Montant détaillé']);
  const iMontantTotal = trouverColonne(headers, ['Montant total', 'Pr. Fact. Total']);

  if (iContrat === -1 || iNom === -1) {
    showError('Colonnes essentielles introuvables dans ce fichier (n° de contrat / preneur d’assurance) — le format a peut-être encore changé, vérifie les en-têtes du fichier.');
    return;
  }

  const lignesBrutes = rows.slice(idxHeader + 1).filter(r => r && r[iContrat]);

  // Selon la légende du fichier lui-même : "En cas de commission sur plusieurs codes branches
  // différents, il y a une ligne total suivie de lignes de détail" — on ne garde la ligne total
  // que si aucune ligne de détail n'existe pour ce contrat, sinon la commission serait comptée 2×.
  const parContrat = {};
  lignesBrutes.forEach(r => {
    const key = (r[iContrat] || '').toString().trim();
    (parContrat[key] = parContrat[key] || []).push(r);
  });
  const lignesUtiles = [];
  Object.values(parContrat).forEach(groupe => {
    const detailPresent = iMontantDetaille !== -1 && groupe.some(r => r[iMontantDetaille] != null && r[iMontantDetaille] !== '');
    groupe.forEach(r => {
      const estLigneTotal = detailPresent && (r[iMontantDetaille] == null || r[iMontantDetaille] === '');
      if (!estLigneTotal) lignesUtiles.push(r);
    });
  });

  _decompteLignes = lignesUtiles.map((r, i) => {
    const numeroContrat = (r[iContrat] || '').toString().trim();
    const brancheInterne = iBranche !== -1 ? (r[iBranche] || '') : '';
    const nomFichier = `${(r[iNom] || '').toString().trim()}${r[iPrenom] ? ' ' + r[iPrenom].toString().trim() : ''}`.trim();
    const commissionProduction = iCommissionProd !== -1 ? (parseFloat(r[iCommissionProd]) || 0) : 0;
    const tauxFichier = iTaux !== -1 ? (parseFloat(r[iTaux]) || 0) : 0;
    const montantDetaille = iMontantDetaille !== -1 ? parseFloat(r[iMontantDetaille]) : null;
    const montantTotalCol = iMontantTotal !== -1 ? parseFloat(r[iMontantTotal]) : null;
    // Le fichier donne déjà le montant de commission par ligne (détaillé, ou total si pas de détail) —
    // on ne le recalcule depuis le taux que si aucun des deux montants n'est fourni.
    const montantFichier = (montantDetaille != null && !isNaN(montantDetaille)) ? montantDetaille
      : (montantTotalCol != null && !isNaN(montantTotalCol)) ? montantTotalCol
      : Math.round(commissionProduction * tauxFichier) / 100;

    return construireLigneImport(i, {
      numeroContrat,
      noFacture: iNoFacture !== -1 ? r[iNoFacture] : null,
      dateFacture: iDateFacture !== -1 ? r[iDateFacture] : null,
      nomFichier,
      npa: iNpa !== -1 ? r[iNpa] : '', localite: iLocalite !== -1 ? r[iLocalite] : '',
      brancheInterne,
      commissionProduction,
      taux: tauxFichier,
      montant: montantFichier,
    });
  });

  _decompteNomAssureur = nomAssureur;
  _decompteCommissionTotaleAnnoncee = commissionTotaleAnnoncee;
  renderImportDecompte(nomAssureur, commissionTotaleAnnoncee);
}

// Construit une ligne _decompteLignes à partir de champs déjà normalisés — commun aux deux sources
// d'import (Excel norme IG B2B et PDF lu par l'IA), pour que le rapprochement, l'affichage et la
// création de contrat manquant se comportent exactement pareil quel que soit le format d'origine.
function construireLigneImport(i, champs) {
  const { numeroContrat, noFacture, dateFacture, nomFichier, npa, localite, brancheInterne, commissionProduction, taux, montant } = champs;
  const { contratTrouve, clientTrouve, clientSuggere } = matcherContratEtClient(numeroContrat, brancheInterne, nomFichier);
  const candidats = allContrats.filter(c => c.numero_police && normPoliceNumero(c.numero_police) === normPoliceNumero(numeroContrat));
  return {
    idx: i,
    numeroContrat,
    noFacture: noFacture || null,
    dateFacture: dateFacture || null,
    nomVaudoise: nomFichier || '(nom non fourni par le fichier)',
    npa: npa || '', localite: localite || '',
    brancheInterne: brancheInterne || '',
    commissionProduction: Number(commissionProduction) || 0,
    taux: Number(taux) || 0,
    montant: Math.round((Number(montant) || 0) * 100) / 100,
    contratId: contratTrouve ? contratTrouve.id : null,
    clientId: contratTrouve ? (clientTrouve ? clientTrouve.id : null) : (clientSuggere ? clientSuggere.id : null),
    clientNomCRM: clientTrouve ? (estEntreprise(clientTrouve) ? clientTrouve.nom : `${clientTrouve.prenom} ${clientTrouve.nom}`) : null,
    clientSuggereNom: (!clientTrouve && clientSuggere) ? (estEntreprise(clientSuggere) ? clientSuggere.nom : `${clientSuggere.prenom} ${clientSuggere.nom}`) : null,
    primeCRM: contratTrouve ? contratTrouve.prime_annuelle : null,
    ambigu: candidats.length > 1,
    selectionne: !!contratTrouve,
  };
}

// ═══ IMPORT DÉCOMPTE PDF (compagnies qui n'envoient pas d'Excel, ex: AXA) — lecture par IA ═══
async function analyserDecomptePdf(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('imp-file-nom').textContent = file.name;
  const statusEl = document.getElementById('imp-pdf-status');
  if (statusEl) { statusEl.textContent = '🤖 Lecture du PDF en cours (peut prendre 30-60 secondes)...'; statusEl.style.color = 'var(--accent)'; }

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parse_decompte_pdf', pdf_base64: base64 }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || 'Erreur inconnue');

    const lignesBrutes = data.lignes || [];
    if (!lignesBrutes.length) {
      if (statusEl) { statusEl.textContent = '⚠ Aucune ligne de commission détectée dans ce PDF.'; statusEl.style.color = '#f59e0b'; }
      return;
    }

    _decompteLignes = lignesBrutes.map((l, i) => construireLigneImport(i, {
      numeroContrat: (l.numero_contrat || '').toString().trim(),
      noFacture: l.no_facture,
      dateFacture: l.date_facture,
      nomFichier: `${(l.preneur_nom || '').toString().trim()}${l.preneur_prenom ? ' ' + l.preneur_prenom.toString().trim() : ''}`.trim(),
      npa: l.npa, localite: l.localite,
      brancheInterne: l.branche,
      commissionProduction: l.commission_production,
      taux: l.taux,
      montant: l.montant,
    }));

    _decompteNomAssureur = data.compagnie || '';
    _decompteCommissionTotaleAnnoncee = data.commission_totale != null ? Number(data.commission_totale) : null;
    if (statusEl) { statusEl.textContent = `✓ ${_decompteLignes.length} ligne(s) lue(s) par l'IA — vérifie le rapprochement ci-dessous avant d'importer.`; statusEl.style.color = '#4ade80'; }
    renderImportDecompte(_decompteNomAssureur, _decompteCommissionTotaleAnnoncee);
  } catch (e) {
    if (statusEl) { statusEl.textContent = '✗ ' + e.message + ' — réessaie, ou importe le fichier Excel si la compagnie en fournit un.'; statusEl.style.color = '#f87171'; }
  }
  input.value = '';
}

function renderImportDecompte(nomAssureur, commissionTotaleAnnoncee) {
  const zone = document.getElementById('imp-resultats');
  const nbTrouves = _decompteLignes.filter(l => l.contratId).length;
  const nbSuggeres = _decompteLignes.filter(l => !l.contratId && l.clientSuggereNom).length;
  const nbRienTrouve = _decompteLignes.length - nbTrouves - nbSuggeres;
  const totalFichier = _decompteLignes.reduce((s, l) => s + l.montant, 0);
  const ecartTotal = commissionTotaleAnnoncee != null ? Math.round((totalFichier - commissionTotaleAnnoncee) * 100) / 100 : null;

  zone.innerHTML = `
    ${sectionCard(`Résultat de l'analyse — ${nomAssureur || 'Compagnie'}`, '#4ade80', `
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">${_decompteLignes.length} ligne(s) de commission — ${nbTrouves} contrat(s) reconnu(s) dans le CRM, ${nbSuggeres} client(s) probable(s) trouvé(s) par le nom (contrat à choisir/créer toi-même), ${nbRienTrouve} totalement non trouvé(s).</div>
      ${commissionTotaleAnnoncee != null ? `
      <div style="font-size:11.5px;margin-bottom:12px;padding:8px 12px;border-radius:8px;background:var(--surface-alt);color:${Math.abs(ecartTotal) > 1 ? '#f87171' : '#4ade80'}">
        Total annoncé par le fichier : CHF ${fmtCHF(commissionTotaleAnnoncee)} — total des lignes lues : CHF ${fmtCHF(Math.round(totalFichier))}
        ${Math.abs(ecartTotal) > 1 ? ` ⚠️ écart de CHF ${fmtCHF(ecartTotal)} — une ligne a probablement été mal lue, vérifie avant d'importer` : ' ✓ les lignes lues correspondent au total du fichier'}
      </div>` : ''}
      <div style="overflow-x:auto">
      <table style="width:100%;min-width:1180px;border-collapse:collapse;font-size:12px">
        <thead><tr style="color:var(--text-muted);font-size:10px;text-transform:uppercase">
          <th style="padding:6px 8px"></th>
          <th style="padding:6px 8px;text-align:left">N° contrat</th>
          <th style="padding:6px 8px;text-align:left">N° facture</th>
          <th style="padding:6px 8px;text-align:left">Date facture</th>
          <th style="padding:6px 8px;text-align:left">Client (fichier)</th>
          <th style="padding:6px 8px;text-align:left">NPA</th>
          <th style="padding:6px 8px;text-align:left">Localité</th>
          <th style="padding:6px 8px;text-align:left">Client CRM</th>
          <th style="padding:6px 8px;text-align:left">Branche</th>
          <th style="padding:6px 8px;text-align:right">Base commission</th>
          <th style="padding:6px 8px;text-align:right">Taux %</th>
          <th style="padding:6px 8px;text-align:right">Montant</th>
        </tr></thead>
        <tbody>${_decompteLignes.map(l => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:5px 8px"><input type="checkbox" id="imp-check-${l.idx}" ${l.selectionne ? 'checked' : ''} ${!l.contratId ? 'disabled' : ''} onchange="_decompteLignes[${l.idx}].selectionne = this.checked"/></td>
            <td style="padding:5px 8px;font-family:monospace;white-space:nowrap">${l.numeroContrat}${l.ambigu ? ' <span title="Plusieurs contrats CRM partagent ce n° de police — vérifie que le bon a été choisi" style="color:#f59e0b">⚠</span>' : ''}</td>
            <td style="padding:5px 8px;white-space:nowrap;color:var(--text-muted)">${l.noFacture || '—'}</td>
            <td style="padding:5px 8px;white-space:nowrap;color:var(--text-muted)">${l.dateFacture || '—'}</td>
            <td style="padding:5px 8px;white-space:nowrap">${l.nomVaudoise}</td>
            <td style="padding:5px 8px;white-space:nowrap;color:var(--text-muted)">${l.npa || '—'}</td>
            <td style="padding:5px 8px;white-space:nowrap;color:var(--text-muted)">${l.localite || '—'}</td>
            <td style="padding:5px 8px;white-space:nowrap">${l.clientNomCRM ? l.clientNomCRM : (l.clientSuggereNom ? `<span style="color:#f59e0b">≈ ${l.clientSuggereNom}</span>` : '<span style="color:#f87171">Non trouvé</span>')}${!l.clientNomCRM && l.clientSuggereNom ? `<div style="font-size:9.5px;color:var(--text-muted);white-space:normal;max-width:170px;margin-bottom:4px">nom trouvé, pas de contrat avec cette police — vérifie avant de créer</div><div style="display:flex;gap:6px"><button type="button" onclick="document.getElementById('modal-detail-contrat')?.remove(); showClient('${l.clientId}')" style="background:var(--surface-alt);color:var(--text-muted);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:10.5px;cursor:pointer;font-weight:700;white-space:nowrap">👁 Voir la fiche</button><button type="button" id="imp-creer-${l.idx}" onclick="creerContratDepuisImport(${l.idx})" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:3px 8px;font-size:10.5px;cursor:pointer;font-weight:700;white-space:nowrap">📝 Créer</button></div>` : ''}</td>
            <td style="padding:5px 8px;color:var(--text-muted);white-space:nowrap">${l.brancheInterne}</td>
            <td style="padding:5px 8px;text-align:right;white-space:nowrap;color:var(--text-muted)">CHF ${fmtCHF(l.commissionProduction)}</td>
            <td style="padding:5px 8px;text-align:right;white-space:nowrap">${l.taux}%</td>
            <td style="padding:5px 8px;text-align:right;white-space:nowrap"><input type="number" step="0.01" value="${l.montant}" class="imp-montant-input" data-idx="${l.idx}" style="width:75px;background:var(--surface-alt);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:3px 5px;text-align:right" onchange="_decompteLignes[${l.idx}].montant = parseFloat(this.value)||0; recalculerTotalImport();"/></td>
          </tr>`).join('')}</tbody>
        <tfoot><tr style="border-top:2px solid var(--border)">
          <td colspan="11" style="padding:8px;text-align:right;font-weight:700;color:var(--text)">Total des lignes ci-dessus</td>
          <td id="imp-total-cell" style="padding:8px;text-align:right;font-weight:800;color:#4ade80;white-space:nowrap">CHF ${fmtCHF(Math.round(_decompteLignes.reduce((s,l)=>s+l.montant,0)))}</td>
        </tr></tfoot>
      </table>
      </div>
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:10px">Taux et montant sont repris directement du décompte compagnie (modifiable si besoin). Une ligne sans contrat CRM reconnu ne peut pas être importée automatiquement — crée le contrat manquant (ou corrige son n° de police) puis réimporte le fichier.${_decompteLignes.some(l => l.montant < 0) ? ' Un montant négatif n\'est pas une erreur : la compagnie a émis 2 factures pour la même police (voir le n° de facture sous chaque ligne) — la 2e corrige/ajuste une branche de la 1ère, d\'où une ligne en négatif compensée par une autre en positif.' : ''}</div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn-save" onclick="importerCommissionsDecompte('${(nomAssureur || '').replace(/'/g, "\\'")}')">✓ Créer les commissions sélectionnées</button>
      </div>
    `)}
  `;
}

// Recalcule et réaffiche le total en pied de tableau après modification manuelle d'un montant.
function recalculerTotalImport() {
  const total = _decompteLignes.reduce((s, l) => s + l.montant, 0);
  const cell = document.getElementById('imp-total-cell');
  if (cell) cell.textContent = 'CHF ' + Math.round(total).toLocaleString();
}

async function importerCommissionsDecompte(nomAssureur) {
  const aTraiter = _decompteLignes.filter(l => l.selectionne && l.contratId);
  if (!aTraiter.length) { showError('Aucune ligne sélectionnée avec un contrat reconnu.'); return; }
  const nature = document.getElementById('imp-nature-commission')?.value || 'gestion';
  let nbCrees = 0, nbEchecs = 0;
  for (const l of aTraiter) {
    const montant = Math.round(l.montant);
    // Un montant négatif est une vraie correction de la compagnie (2e facture ajustant une branche
    // de la 1ère) — il doit être importé comme les autres, sinon la correction disparaît silencieusement
    // et le montant en attente reste surestimé du montant qu'elle était censée compenser.
    if (montant !== 0) {
      const r = await dbPost('commissions_attente', {
        client_id: l.clientId,
        contrat_id: l.contratId,
        client_nom: l.clientNomCRM,
        compagnie: nomAssureur || null,
        produit: l.brancheInterne || null,
        montant_estime: montant,
        detail_calcul: `Décompte compagnie importé (Excel IG B2B) — ${l.brancheInterne || ''}${montant < 0 ? ' (correction' + (l.noFacture ? ' facture n°' + l.noFacture : '') + ')' : ''} : base CHF ${fmtCHF(l.commissionProduction)} × ${l.taux}% — contrat ${l.numeroContrat}`,
        statut: 'en_attente',
        nature,
        date_creation: new Date().toISOString().split('T')[0],
      });
      if (r && r.error) { nbEchecs++; continue; }
      nbCrees++;
    }
  }
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  showError(`✓ ${nbCrees} commission(s) créée(s).${nbEchecs ? ' ⚠️ ' + nbEchecs + ' échec(s) d’écriture — vérifie manuellement.' : ''}`);
  navigate('import-decompte');
}

