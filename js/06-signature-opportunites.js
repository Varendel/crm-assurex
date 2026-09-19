function switchTab(btn, tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['tab-identite','tab-documents','tab-prevoyance','tab-collaborateurs','tab-flotte','tab-contrats','tab-factures','tab-rappels','tab-rdv','tab-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });
}

// OPPORTUNITÉS
let opportuniteEnEditionId = null;
let prefillOpportuniteClientId = null;

function editerOpportunite(id) {
  opportuniteEnEditionId = id;
  // Marque la notification « créée par l'équipe » comme vue dès que Jonathan (pas la
  // session RH) ouvre la fiche — la notification du dashboard/pipeline disparaît d'elle-même.
  if (!estRoleRH()) {
    const oppVue = allOpportunites.find(o => o.id === id);
    if (oppVue && oppVue.cree_par && !oppVue.notif_vue) {
      oppVue.notif_vue = true;
      dbPatch('opportunites', id, { notif_vue: true }).catch(() => {});
    }
  }
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
  if (vueModePipeline === 'liste') corps = renderListeOpportunites(OPPS, nomClient, tousLesStades, stadeColor, rhMode);
  else if (vueModePipeline === 'echeances') corps = renderEcheancesOpportunites(OPPS, nomClient, stadeColor, rhMode);
  else if (vueModePipeline === 'priorites') corps = renderPrioritesOpportunites(OPPS, nomClient, stadeColor, rhMode);
  else corps = renderKanbanOpportunites(OPPS, gagnees, perdues, stades, stadeColor, tousLesStades, nomClient, rhMode);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Pipeline — Opportunités</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-add" onclick="opportuniteEnEditionId=null;navigate('nouvelle-opportunite')">${rhMode ? PICTO_CREE_EQUIPE + ' Créer une opportunité pour Jonathan' : '+ Nouvelle opportunité'}</button>
        ${rhMode ? `<button class="btn-secondary" onclick="navigate('nouveau-rappel')">${PICTO_CREE_EQUIPE} Créer une tâche pour Jonathan</button>` : ''}
      </div>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">${rhMode ? "Vue d'ensemble des affaires en cours (stades, clients, tâches liées) — lecture seule, sans montants. Utilise les boutons ci-dessus pour créer une opportunité ou une tâche pour Jonathan." : 'Suivi des affaires en négociation, avant signature. Une fois "Gagnée" depuis le menu de stade, l\'opportunité ouvre directement le formulaire de contrat pré-rempli.'}</div>
    ${renderOppsEchuesBanner(OPPS, nomClient)}
    ${!rhMode && typeof bandeauSansProchaineAction === 'function' ? bandeauSansProchaineAction(OPPS, nomClient) : ''}
    <div class="stat-grid" style="margin-bottom:20px">
      ${rhMode ? '' : statCard('Pipeline total (prime)', 'CHF ' + total.toLocaleString(), '#f59e0b')}
      ${rhMode ? '' : statCard('Pondéré (prime)', 'CHF ' + pondere.toLocaleString(), '#38bdf8')}
      ${rhMode ? '' : statCard('CA potentiel (commissions)', 'CHF ' + caPotentiel.toLocaleString(), '#4ade80')}
      ${statCard('En cours', OPPS.length, '#e2e8f0')}
      ${statCard('Gagnées', gagnees.length, '#4ade80')}
    </div>
    ${rhMode ? '' : renderStatsBranchesPipeline(OPPS)}
    ${rhMode ? '' : renderCamembertsPipeline(OPPS)}
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

// ── Deux camemberts du pipeline : répartition Privé/Entreprise, et répartition par type de
// produit (catégories du CATALOGUE_PRODUITS, js/02). SVG généré à la volée à partir des données
// live (pas une image figée) — se met donc à jour à chaque changement d'opportunité. Masqué en
// session RH comme le reste des stats du pipeline (cf. rhMode dans viewOpportunites).
function idProduitVersCategoriePipeline(id) {
  for (const cat in CATALOGUE_PRODUITS) {
    if (CATALOGUE_PRODUITS[cat].some(p => p.id === id)) return cat;
  }
  return 'Autre';
}

function renderCamembertsPipeline(OPPS) {
  if (!OPPS.length) return '';

  let segEntreprise = 0, segPrive = 0;
  const catCounts = {};
  let nonPrecise = 0;
  OPPS.forEach(o => {
    const client = allClients.find(c => c.id === o.client_id);
    const entreprise = client ? estEntreprise(client) : false;
    if (entreprise) segEntreprise++; else segPrive++;
    const produits = Array.isArray(o.produits) ? o.produits : [];
    if (!produits.length) { nonPrecise++; return; }
    const cats = new Set(produits.map(idProduitVersCategoriePipeline));
    cats.forEach(c => { catCounts[c] = (catCounts[c] || 0) + 1; });
  });
  if (nonPrecise) catCounts['Produit non précisé'] = nonPrecise;

  const palette = ['#1f3a5f', '#e8934a', '#3d7a6e', '#a83246', '#6b5b95', '#c9a13b', '#4a7fb5', '#8c8c8c'];
  const segData = [
    { label: 'Entreprise', value: segEntreprise, color: palette[0] },
    { label: 'Privé', value: segPrive, color: palette[1] },
  ].filter(d => d.value > 0);
  const catData = Object.keys(catCounts).map((label, i) => ({
    label, value: catCounts[label],
    color: label === 'Produit non précisé' ? '#c7c7c7' : palette[i % palette.length],
  }));

  return `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
    <div style="flex:1;min-width:300px;background:var(--surface-alt);border:1px solid var(--border);border-radius:12px;padding:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🥧 Pipeline par segment</div>
      ${svgCamembertPipeline(segData, OPPS.length)}
    </div>
    <div style="flex:1;min-width:300px;background:var(--surface-alt);border:1px solid var(--border);border-radius:12px;padding:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🥧 Pipeline par type de produit</div>
      ${svgCamembertPipeline(catData, OPPS.length)}
    </div>
  </div>`;
}

function svgCamembertPipeline(data, total) {
  if (!data.length) return '<div style="font-size:12px;color:var(--text-muted)">Pas encore de données.</div>';
  const r = 70, cx = 80, cy = 80;
  let angle = -90;
  const toRad = a => (a * Math.PI) / 180;
  const paths = data.map(d => {
    const pct = d.value / total;
    const startAngle = angle;
    const endAngle = angle + pct * 360;
    angle = endAngle;
    const large = (endAngle - startAngle) > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const titre = `${d.label}: ${d.value} (${Math.round(pct * 100)}%)`;
    if (pct >= 0.999) {
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${d.color}" stroke="var(--surface-alt)" stroke-width="2"><title>${titre}</title></circle>`;
    }
    return `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${d.color}" stroke="var(--surface-alt)" stroke-width="2"><title>${titre}</title></path>`;
  }).join('');
  const legend = data.map(d => `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text)"><span style="width:10px;height:10px;border-radius:2px;background:${d.color};display:inline-block;flex-shrink:0"></span>${d.label} (${d.value} · ${Math.round(d.value / total * 100)}%)</div>`).join('');
  return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
    <svg width="160" height="160" viewBox="0 0 160 160" style="flex-shrink:0">${paths}</svg>
    <div style="display:flex;flex-direction:column;gap:5px">${legend}</div>
  </div>`;
}

// ── Bandeau "OPP échues" — toujours visible en haut du Pipeline, quelle que soit la vue active
// (Kanban/Liste/Échéances/Priorités), pour que les opportunités dont l'échéance est dépassée
// sautent aux yeux et soient traitées en priorité sans avoir à aller chercher l'onglet Échéances.
function renderOppsEchuesBanner(OPPS, nomClient) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const echues = OPPS.filter(o => o.date_echeance && new Date(o.date_echeance) < today)
    .sort((a, b) => new Date(a.date_echeance) - new Date(b.date_echeance));
  if (!echues.length) return '';
  return `<div style="background:rgba(248,113,113,0.08);border:1.5px solid rgba(248,113,113,0.4);border-radius:12px;padding:14px 16px;margin-bottom:20px">
    <div style="font-size:12px;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🔴 ${echues.length} opportunité${echues.length !== 1 ? 's' : ''} échue${echues.length !== 1 ? 's' : ''} — à traiter en priorité</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${echues.map(o => `<div onclick="editerOpportunite('${o.id}')" style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--surface);border-radius:8px;padding:8px 12px;cursor:pointer">
        <div style="min-width:0">
          <div style="font-size:12.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.titre}</div>
          <div style="font-size:11px;color:var(--text-muted)">${nomClient(o)}</div>
        </div>
        <div style="font-size:11.5px;font-weight:800;color:#f87171;white-space:nowrap">Échue le ${fmtDate(o.date_echeance)}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ── Vue Kanban (par défaut) — colonnes par stade + tableaux Gagnées/Perdues en dessous ──
// rhMode : carte non cliquable (pas d'accès à la fiche d'édition), sans montant ni menu de
// changement de stade (action réservée aux rôles apporteur/signataire).
function renderKanbanOpportunites(OPPS, gagnees, perdues, stades, stadeColor, tousLesStades, nomClient, rhMode) {
  let kanban = stades.map(stade => {
    const opps = OPPS.filter(o => o.stade === stade);
    const color = stadeColor[stade];
    return `<div class="kanban-col" data-stade="${stade}">
      <div class="kanban-col-title">
        <div class="kanban-dot" style="background:${color}"></div>
        <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.8px">${stade}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-left:auto">${opps.length}${rhMode ? '' : ` · CHF ${fmtCHF(Math.round(opps.reduce((s, o) => s + Number(o.montant_potentiel || 0), 0)))}`}</div>
      </div>
      ${opps.map(o => {
        const tachesOuvertes = allRappels.filter(r => r.opportunite_id === o.id && r.statut === 'ouvert').length;
        const echue = o.date_echeance && new Date(o.date_echeance) < new Date(new Date().setHours(0,0,0,0));
        return `<div class="kanban-card" data-opp-id="${o.id}" ${rhMode ? '' : 'draggable="true" title="Glisser vers un autre stade"'} onclick="editerOpportunite('${o.id}')" style="cursor:${rhMode ? 'pointer' : 'grab'};position:relative;${echue ? 'border-left:3px solid #f87171' : ''}">
        ${o.cree_par ? `<div title="Créée par ${o.cree_par}" style="position:absolute;top:8px;right:8px;font-size:13px">${PICTO_CREE_EQUIPE}${o.notif_vue ? '' : ' 🔴'}</div>` : ''}
        <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:4px">${o.titre}</div>
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:1px">${nomClient(o)}</div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:6px">${tachesOuvertes > 0 ? `☑ ${tachesOuvertes} tâche${tachesOuvertes > 1 ? 's' : ''}` : '&nbsp;'}</div>
        <div class="opp-offres" data-opp="${o.id}" data-compagnie="${(o.compagnie || '').replace(/"/g, '&quot;')}">${o.compagnie && typeof compagnieAvecPicto === 'function' ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${compagnieAvecPicto(o.compagnie, 20)}</div>` : ''}</div>
        ${typeof htmlProchaineAction === 'function' ? htmlProchaineAction(o) : ''}
        ${o.date_echeance ? `<div style="font-size:10px;font-weight:700;color:${echue ? '#f87171' : 'var(--text-muted)'};margin-bottom:6px">${echue ? '🔴 Échue le ' : 'Échéance '}${fmtDate(o.date_echeance)}</div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${rhMode ? '<span></span>' : `<span style="font-size:13px;font-weight:800;color:#f59e0b">CHF ${fmtCHF((o.montant_potentiel||0))}</span>`}
          ${o.apporteur_id ? avatar(agentById(o.apporteur_id), 22) : ''}
        </div>
        <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${o.probabilite||0}%;background:${color}"></div></div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:6px;display:flex;justify-content:space-between;align-items:center;gap:6px">
          <span>${o.probabilite||0}%</span>
          <div style="display:flex;gap:4px;align-items:center">
            ${rhMode ? '' : `<button onclick="event.stopPropagation();ouvrirModaleMotifPerte('${o.id}','kanban')" title="Marquer perdue" style="background:none;border:1px solid rgba(248,113,113,0.35);color:#f87171;border-radius:5px;padding:2px 6px;font-size:10px;font-weight:700;cursor:pointer">✕ Perdu</button>`}
            ${rhMode ? '' : selectStadeOpportunite(o, stade, tousLesStades)}
          </div>
        </div>
      </div>`;
      }).join('')}
      ${opps.length === 0 ? '<div class="kanban-empty">Aucune</div>' : ''}
    </div>`;
  }).join('');

  // Glisser-déposer + offres multi-compagnies : branchés après l'affichage (js/16-pipeline-kanban.js)
  setTimeout(() => { if (typeof activerKanbanPipeline === 'function') activerKanbanPipeline(rhMode); }, 0);
  return `${rhMode ? '' : `<div class="kanban-zones-fin" aria-hidden="true">
      <div class="kanban-zone-fin" data-stade="Gagné">✓ Déposer ici : <strong>Gagné</strong></div>
      <div class="kanban-zone-fin perdu" data-stade="Perdu">✕ Déposer ici : <strong>Perdu</strong></div>
    </div>`}
    <div class="kanban">${kanban}</div>
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
        <div>
          <div style="font-weight:700;font-size:13px;color:var(--text)">${o.titre}</div>
          ${o.motif_perte ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:2px;font-style:italic">Motif : ${o.motif_perte}</div>` : ''}
        </div>
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
      ${liste.length ? liste.map(o => `<div class="table-row" style="grid-template-columns:${cols};cursor:pointer" onclick="editerOpportunite('${o.id}')">
        <div><div style="font-weight:700;font-size:13px;color:var(--text)">${o.cree_par ? PICTO_CREE_EQUIPE + ' ' : ''}${o.titre}</div>${o.date_echeance ? `<div style="font-size:10.5px;color:var(--text-muted)">Échéance ${fmtDate(o.date_echeance)}</div>` : ''}${typeof htmlProchaineAction === 'function' ? htmlProchaineAction(o) : ''}</div>
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
      <div class="table-wrap">${liste.map(o => `<div class="table-row" style="grid-template-columns:${rhMode ? '1fr 160px 110px 120px' : '1fr 160px 110px 100px 120px'};cursor:pointer" onclick="editerOpportunite('${o.id}')">
        <div style="font-weight:700;font-size:13px;color:var(--text)">${o.cree_par ? PICTO_CREE_EQUIPE + ' ' : ''}${o.titre}</div>
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
      <div style="flex:1;min-width:200px;cursor:pointer" onclick="editerOpportunite('${o.id}')">
        <div style="font-size:13.5px;font-weight:800;color:var(--text)">${o.cree_par ? PICTO_CREE_EQUIPE + ' ' : ''}${o.titre}</div>
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
  const tache = allRappels.find(r => r.id === id);
  const r = await dbPatch('rappels', id, { statut: 'traité' });
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  navigate('opportunites');
  // Dernière tâche terminée : « et maintenant ? »
  if (tache && tache.opportunite_id && typeof verifierProchaineAction === 'function') verifierProchaineAction(tache.opportunite_id);
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
  const typeInput = document.getElementById('opp-nouvelle-tache-type');
  const typeChoisi = typeInput && typeInput.value ? typeInput.value : 'Opportunité';
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
    type: typeChoisi,
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
  // Bug corrigé le 10.08.2026 : ce point d'ajout rapide de tâche (depuis la fiche opportunité)
  // n'appelait jamais createOutlookEventFromRappel — contrairement à saveRappel() — donc une
  // tâche créée ici n'atterrissait JAMAIS dans l'agenda, même une fois le bug de format de date
  // Graph corrigé. Alignée sur le même comportement que le formulaire complet.
  if (r && r[0] && r[0].id && body.date_echeance) {
    try {
      const eventId = await createOutlookEventFromRappel(r[0]);
      if (eventId) await dbPatch('rappels', r[0].id, { outlook_event_id: eventId });
      else showError(!msalAccessToken
        ? "⚠️ Tâche créée, mais pas dans l'agenda Outlook — tu n'es pas connecté. Reconnecte-toi puis synchronise-la depuis \"Tâches & Rappels\"."
        : "⚠️ Tâche créée, mais l'ajout à l'agenda Outlook a échoué — réessaie depuis \"Tâches & Rappels\".");
    } catch (e) { /* sync Outlook échouée, la tâche reste créée dans le CRM */ }
  }
  allRappels = await dbGet('rappels', 'select=*');
  navigate('nouvelle-opportunite');
}

async function toggleTacheOpportunite(id, fait) {
  const tache = allRappels.find(r => r.id === id);
  const r = await dbPatch('rappels', id, { statut: fait ? 'traité' : 'ouvert' });
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  // Demande de Jonathan le 07.09.2026 : une tâche validée depuis la fiche opportunité doit
  // laisser une trace dans l'historique de l'opp (nom de la tâche + date), sans étape manuelle —
  // réutilise ajouterLigneHistoriqueOpportunite() qui horodate et signe déjà avec l'auteur connecté.
  if (fait && tache && tache.opportunite_id) {
    await ajouterLigneHistoriqueOpportunite(tache.opportunite_id, `✓ Tâche terminée : ${tache.titre}`);
  }
  navigate('nouvelle-opportunite');
  // Dernière tâche terminée : « et maintenant ? »
  if (fait && tache && tache.opportunite_id && typeof verifierProchaineAction === 'function') verifierProchaineAction(tache.opportunite_id);
}

async function supprimerTacheOpportunite(id) {
  const r = await dbDelete('rappels', id);
  if (r && r.error) { showError('Erreur lors de la suppression : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  navigate('nouvelle-opportunite');
}

// Version "sans quitter la fiche" de changerStadeOpportunite() — utilisée par les boutons rapides
// en haut de la fiche opportunité. Contrairement au drag&drop du Kanban, on reste sur place :
// Jonathan ne veut pas ressortir juste pour changer un statut (demande du 21.08.2026). "Gagné"
// continue de déclencher la conversion en contrat (ça reste la suite logique attendue), tous les
// autres stades se mettent à jour sur place sans navigation.
async function changerStadeOpportuniteRapide(id, nouveauStade) {
  if (!nouveauStade) return;
  const opp = allOpportunites.find(o => o.id === id);
  if (!opp || opp.stade === nouveauStade) return;
  // "Perdu" demande toujours un motif libre avant de confirmer — voir ouvrirModaleMotifPerte.
  if (nouveauStade === 'Perdu') { ouvrirModaleMotifPerte(id, 'rapide'); return; }
  const r = await dbPatch('opportunites', id, { stade: nouveauStade });
  if (r && r.error) { showError('Erreur lors du changement de stade : ' + errMsg(r)); return; }
  opp.stade = nouveauStade;
  if (nouveauStade === 'Gagné') {
    proposerActionApresGain(opp);
    return;
  }
  // Synchronise le <select> #o-stade (caché dans le formulaire "Contrat" plus bas) pour qu'un
  // "Enregistrer" ultérieur ne réécrase pas ce changement, et rafraîchit la barre de boutons.
  const selectStade = document.getElementById('o-stade');
  if (selectStade) selectStade.value = nouveauStade;
  document.querySelectorAll('.o-stade-rapide-btn').forEach(btn => {
    const actif = btn.dataset.stade === nouveauStade;
    btn.style.background = actif ? btn.dataset.couleur : 'var(--surface-alt)';
    btn.style.color = actif ? '#0a0e1a' : 'var(--text-muted)';
    btn.style.borderColor = actif ? btn.dataset.couleur : 'var(--border)';
  });
  if (typeof verifierProchaineAction === 'function') verifierProchaineAction(id);
}

async function changerStadeOpportunite(id, nouveauStade) {
  if (!nouveauStade) return;
  const opp = allOpportunites.find(o => o.id === id);
  if (!opp) return;
  // "Perdu" demande toujours un motif libre avant de confirmer — voir ouvrirModaleMotifPerte.
  if (nouveauStade === 'Perdu') { ouvrirModaleMotifPerte(id, 'kanban'); return; }
  const r = await dbPatch('opportunites', id, { stade: nouveauStade });
  if (r && r.error) { showError('Erreur lors du changement de stade : ' + errMsg(r)); return; }
  opp.stade = nouveauStade;

  if (nouveauStade === 'Gagné') {
    proposerActionApresGain(opp);
  } else {
    navigate('opportunites');
    if (typeof verifierProchaineAction === 'function') verifierProchaineAction(id);
  }
}

// Opportunité passée en "Gagné" : propose de créer le contrat maintenant (cas normal) OU de
// relier directement un contrat déjà existant si celui-ci a été saisi séparément avant que
// l'opportunité ne soit mise à jour (demande de Jonathan le 31.08.2026). Sans ça, on était
// systématiquement forcé dans le formulaire de création, quitte à créer un doublon.
function proposerActionApresGain(opp) {
  const contratsClient = opp.client_id ? allContrats.filter(ct => ct.client_id === opp.client_id) : [];
  creerModale('modal-action-opp-gagnee', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:480px">
      <h3 style="margin:0 0 8px;font-size:16px;font-weight:800;color:var(--text)">🎉 Opportunité gagnée</h3>
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px">"<strong>${opp.titre}</strong>" — le contrat correspondant a-t-il déjà été créé, ou faut-il le créer maintenant ?</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn-save" onclick="document.getElementById('modal-action-opp-gagnee').remove(); demarrerCreationContratDepuisOpp('${opp.id}')">📝 Créer le contrat maintenant</button>
        <button class="btn-secondary" ${contratsClient.length === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} onclick="${contratsClient.length ? `ouvrirSelectionContratExistant('${opp.id}')` : ''}">🔗 Relier un contrat déjà créé${contratsClient.length ? ` (${contratsClient.length})` : ''}</button>
        <button class="btn-secondary" style="opacity:0.7" onclick="document.getElementById('modal-action-opp-gagnee').remove(); navigate('opportunites')">Plus tard</button>
      </div>
      ${!opp.client_id ? `<div style="font-size:10.5px;color:#f59e0b;margin-top:12px">⚠️ Cette opportunité n'a pas de fiche client rattachée — impossible de proposer un contrat existant à relier.</div>` : (contratsClient.length === 0 ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:12px">Aucun contrat existant trouvé pour ce client.</div>` : '')}
    </div>`);
}

function demarrerCreationContratDepuisOpp(oppId) {
  const opp = allOpportunites.find(o => o.id === oppId);
  if (!opp) return;
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
}

function ouvrirSelectionContratExistant(oppId) {
  const opp = allOpportunites.find(o => o.id === oppId);
  if (!opp) return;
  const contratsClient = allContrats.filter(ct => ct.client_id === opp.client_id);
  document.getElementById('modal-action-opp-gagnee')?.remove();
  creerModale('modal-lier-contrat-existant', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:100%;max-width:480px">
      <h3 style="margin:0 0 6px;font-size:15px;font-weight:800;color:var(--text)">🔗 Relier "${opp.titre}" à un contrat existant</h3>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">Sélectionne le contrat déjà créé pour ce client :</div>
      <select class="form-select" id="select-contrat-existant" style="width:100%;margin-bottom:16px">
        <option value="">— Sélectionner —</option>
        ${contratsClient.map(ct => `<option value="${ct.id}">${ct.produit || 'Contrat'} — ${ct.compagnie || '—'}${ct.numero_police ? ' (' + ct.numero_police + ')' : ''} — ${ct.date_debut ? fmtDate(ct.date_debut) : 'date inconnue'}</option>`).join('')}
      </select>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" onclick="document.getElementById('modal-lier-contrat-existant').remove(); navigate('opportunites')">Annuler</button>
        <button class="btn-save" onclick="confirmerLienContratExistant('${oppId}')">✓ Relier</button>
      </div>
    </div>`);
}

async function confirmerLienContratExistant(oppId) {
  const contratId = document.getElementById('select-contrat-existant')?.value;
  if (!contratId) { showError('Sélectionne un contrat dans la liste.'); return; }
  const r = await dbPatch('opportunites', oppId, { contrat_id: contratId });
  if (r && r.error) { showError('Erreur lors de la liaison : ' + errMsg(r)); return; }
  document.getElementById('modal-lier-contrat-existant')?.remove();
  const opp = allOpportunites.find(o => o.id === oppId);
  if (opp) opp.contrat_id = contratId;
  showError('✓ Opportunité reliée au contrat existant.');
  navigate('opportunites');
}

// Marquer une opportunité "Perdue" demande toujours un motif libre (demande de Jonathan le
// 25.08.2026), pour garder une trace exploitable de pourquoi ça n'a pas abouti. mode = 'rapide'
// (fiche détail, reste sur place) | 'kanban' (Kanban/liste, retourne au pipeline après confirmation).
function ouvrirModaleMotifPerte(id, mode) {
  const opp = allOpportunites.find(o => o.id === id);
  if (!opp) return;
  creerModale('modal-motif-perte', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:26px;width:100%;max-width:440px">
      <h3 style="margin:0 0 6px;font-size:15px;font-weight:800;color:var(--text)">✕ Marquer "${opp.titre}" comme perdue</h3>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">Motif (texte libre, optionnel)</div>
      <textarea id="motif-perte-texte" class="form-input" rows="3" placeholder="Ex : parti chez la concurrence, budget annulé, plus de nouvelles…" style="resize:vertical;width:100%">${opp.motif_perte || ''}</textarea>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn-secondary" onclick="document.getElementById('modal-motif-perte').remove()">Annuler</button>
        <button class="btn-save" style="background:#f87171;border-color:#f87171" onclick="confirmerOpportunitePerdue('${id}', '${mode}')">✕ Confirmer perdue</button>
      </div>
    </div>
  `);
}

async function confirmerOpportunitePerdue(id, mode) {
  const motif = document.getElementById('motif-perte-texte') ? document.getElementById('motif-perte-texte').value.trim() || null : null;
  const opp = allOpportunites.find(o => o.id === id);
  if (!opp) { document.getElementById('modal-motif-perte')?.remove(); return; }
  const r = await dbPatch('opportunites', id, { stade: 'Perdu', motif_perte: motif });
  document.getElementById('modal-motif-perte')?.remove();
  if (r && r.error) { showError('Erreur lors du passage en Perdu : ' + errMsg(r)); return; }
  opp.stade = 'Perdu';
  opp.motif_perte = motif;
  if (mode === 'rapide') {
    // Reste sur la fiche, rafraîchie sur place — même garde-fou que ailleurs dans ce fichier
    // (pas de double entrée dans l'historique de navigation puisqu'on est déjà sur cette vue).
    if (opportuniteEnEditionId === id && currentView === 'nouvelle-opportunite') navigate('nouvelle-opportunite');
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
        <div style="font-size:13px;color:var(--text)">${typeof compagnieAvecPicto === 'function' ? compagnieAvecPicto(ct.compagnie) : ct.compagnie}</div>
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
  // Appelée depuis « Suivi des affaires » et depuis « Renouvellements » : on ne rafraîchit que la page affichée
  if (document.getElementById('su-stats')) renderSuiviTables();
  if (document.getElementById('rn-liste')) renderRenouvellements();
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

  // Date d'échéance mise en avant en premier (colonne dédiée, étiquetée) — demande de Jonathan
  // le 10.08.2026 : il ne savait pas quelle date était affichée. La date planifiée (quand on
  // compte s'en occuper, distincte de l'échéance) reste visible mais clairement étiquetée à part.
  const renderItem = r => {
    const enRetardItem = r.date_echeance && new Date(r.date_echeance) < today;
    const details = [];
    if (nomClientRappel(r)) details.push(`👤 <span onclick="event.stopPropagation(); showClient('${r.client_id}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted">${nomClientRappel(r)}</span>`);
    const relatif = dateRelative(r.date_echeance).replace(/^ · /, '');
    if (relatif) details.push(relatif);
    if (r.date_planifiee) details.push(`📅 Planifié : ${fmtDate(r.date_planifiee)}`);
    if (r.piece_jointe_nom) details.push(`📎 ${r.piece_jointe_nom}`);
    return `<div class="rappel-item" style="cursor:pointer;align-items:center" onclick="showRappel('${r.id}')">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:60px;text-align:center;flex-shrink:0">
          <div style="font-size:14px;font-weight:800;color:${enRetardItem ? '#f87171' : 'var(--text)'}">${r.date_echeance ? fmtDate(r.date_echeance) : '—'}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-top:1px">Échéance</div>
        </div>
        <div class="urgence-dot" style="background:${uc(r.urgence||'basse')}"></div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${r.cree_par ? PICTO_CREE_EQUIPE + ' ' : ''}${r.nature === 'tache' ? '📋' : (r.tache_parent_id ? '🔗🔔' : '🔔')} ${r.titre}</div>
          <div style="font-size:11px;color:var(--text-muted)">${details.join(' · ')}</div>
          ${r.notes ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:3px;font-style:italic">${r.notes.split('[')[0].substring(0,120)}${r.notes.length>120?'...':''}</div>` : ''}
        </div>
        ${(!r.outlook_event_id && (r.date_echeance || r.date_planifiee)) ? `<button onclick="event.stopPropagation(); synchroniserRappelOutlook('${r.id}')" title="Absent de l'agenda Outlook — cliquer pour synchroniser" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;border-radius:7px;padding:4px 8px;font-size:11px;cursor:pointer">📅</button>` : ''}
        ${badge(r.type || 'Suivi', '#64748b')}
        <button class="btn-traite" onclick="event.stopPropagation(); traiterRappel('${r.id}')">✓ Traité</button>
      </div>`;
  };

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

// ═══ VUE INTERNE — RENDEZ-VOUS (pris en autonomie par les clients via le lien public, ou créés
// ici directement) — demande de Jonathan le 10.08.2026 : prise de RDV reliée aux clients. ═══
async function viewRendezVous() {
  allRendezVous = await dbGet('rendez_vous', 'select=*&order=date_heure.asc').catch(() => allRendezVous) || allRendezVous;
  const maintenant = new Date();
  const aVenir = allRendezVous.filter(r => r.statut === 'confirme' && new Date(r.date_heure) >= maintenant);
  const passes = allRendezVous.filter(r => r.statut === 'confirme' && new Date(r.date_heure) < maintenant).sort((a, b) => new Date(b.date_heure) - new Date(a.date_heure));
  const annules = allRendezVous.filter(r => r.statut === 'annule');

  const nomRdv = r => {
    if (r.client_id) { const c = allClients.find(x => x.id === r.client_id); return c ? (estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`) : '—'; }
    return r.prospect_nom || '—';
  };
  const heureRdv = iso => new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });

  const renderItem = r => `
    <div class="rappel-item" style="align-items:center">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:60px;text-align:center;flex-shrink:0">
        <div style="font-size:14px;font-weight:800;color:var(--text)">${fmtDate(r.date_heure)}</div>
        <div style="font-size:12px;font-weight:700;color:var(--accent)">${heureRdv(r.date_heure)}</div>
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${r.cree_par === 'client' ? '🌐 ' : ''}${r.client_id ? `<span onclick="showClient('${r.client_id}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted">${nomRdv(r)}</span>` : nomRdv(r)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${[r.type, r.duree_min ? `${r.duree_min} min` : '', r.prospect_email, r.prospect_tel].filter(Boolean).join(' · ')}</div>
        ${r.notes ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:3px;font-style:italic">${r.notes}</div>` : ''}
      </div>
      ${!r.outlook_event_id ? `<button onclick="synchroniserRdvOutlook('${r.id}')" title="Absent de l'agenda Outlook — cliquer pour synchroniser" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;border-radius:7px;padding:4px 8px;font-size:11px;cursor:pointer">📅</button>` : `<span title="Synchronisé avec Outlook" style="font-size:13px">✅</span>`}
      <button onclick="annulerRdv('${r.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px" title="Annuler">✕</button>
    </div>`;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Rendez-vous</h2>
      <button class="btn-add" onclick="ouvrirModaleNouveauRdv()">+ Nouveau RDV</button>
    </div>
    <div style="margin-bottom:22px">
      <div style="font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">À venir (${aVenir.length})</div>
      ${aVenir.length ? aVenir.map(renderItem).join('') : '<div class="table-empty">Aucun rendez-vous à venir.</div>'}
    </div>
    ${passes.length ? `<div style="margin-bottom:22px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Passés (${passes.length})</div>
      ${passes.slice(0, 20).map(renderItem).join('')}
    </div>` : ''}
    ${annules.length ? `<div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Annulés (${annules.length})</div>
      ${annules.slice(0, 10).map(r => `<div class="rappel-item" style="opacity:.6"><div style="flex:1"><div style="font-size:13px;color:var(--text)">${fmtDate(r.date_heure)} ${heureRdv(r.date_heure)} — ${nomRdv(r)}</div></div></div>`).join('')}
    </div>` : ''}`;
}

async function annulerRdv(id) {
  if (!confirm('Annuler ce rendez-vous ?')) return;
  const r = allRendezVous.find(x => x.id === id);
  if (r && r.outlook_event_id) { try { await deleteOutlookEvent(r.outlook_event_id); } catch(e) {} }
  const res = await dbPatch('rendez_vous', id, { statut: 'annule', outlook_event_id: null });
  if (res && res.error) { showError('Erreur : ' + errMsg(res)); return; }
  if (r) { r.statut = 'annule'; r.outlook_event_id = null; }
  navigate('rendez-vous', { silent: true });
}

// Création interne d'un RDV (Jonathan crée directement, sans passer par le lien public).
function ouvrirModaleNouveauRdv(clientIdPrefill) {
  const monAgent = allAgents.find(a => a.email === currentUser.email) || allAgents[0];
  const clientPrefille = clientIdPrefill ? allClients.find(c => c.id === clientIdPrefill) : null;
  const nomClientPrefille = clientPrefille ? (estEntreprise(clientPrefille) ? clientPrefille.nom : `${clientPrefille.prenom} ${clientPrefille.nom}`) : '';
  creerModale('modal-nouveau-rdv', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:480px;width:100%">
      <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:14px">📅 Nouveau rendez-vous</div>
      <div class="form-field" style="margin-bottom:10px;position:relative">
        <label class="form-label">Client (ou laisse vide pour un prospect)</label>
        <input class="form-input" id="rdv-modal-client-recherche" placeholder="Rechercher un client..." value="${nomClientPrefille.replace(/"/g, '&quot;')}" oninput="rechercheClientRdvModal(this.value)" autocomplete="off"/>
        <input type="hidden" id="rdv-modal-client-id" value="${clientPrefille ? clientPrefille.id : ''}"/>
        <div id="rdv-modal-client-resultats" style="display:none;position:absolute;z-index:10;background:var(--surface);border:1px solid var(--border);border-radius:8px;max-height:200px;overflow-y:auto;width:100%"></div>
      </div>
      <div class="form-field" style="margin-bottom:10px"><label class="form-label">Nom du prospect (si pas de client)</label><input class="form-input" id="rdv-modal-prospect"/></div>
      <div class="form-field" style="margin-bottom:10px"><label class="form-label">Type</label><select class="form-select" id="rdv-modal-type">${TYPES_RDV.map(t => `<option>${t}</option>`).join('')}</select></div>
      <div style="display:flex;gap:10px;margin-bottom:10px">
        <div class="form-field" style="flex:1"><label class="form-label">Date</label><input class="form-input" id="rdv-modal-date" type="date"/></div>
        <div class="form-field" style="flex:1"><label class="form-label">Heure</label><input class="form-input" id="rdv-modal-heure" type="time"/></div>
        <div class="form-field" style="flex:1"><label class="form-label">Durée (min)</label><input class="form-input" id="rdv-modal-duree" type="number" value="${(monAgent && monAgent.rdv_duree_defaut) || 45}"/></div>
      </div>
      <div class="form-field" style="margin-bottom:14px"><label class="form-label">Notes (facultatif)</label><textarea class="form-input" id="rdv-modal-notes" rows="2"></textarea></div>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" onclick="document.getElementById('modal-nouveau-rdv').remove()">Annuler</button>
        <button class="btn-save" onclick="creerRdvInterne('${monAgent ? monAgent.id : ''}')" style="margin-left:auto">✓ Créer le RDV</button>
      </div>
    </div>`, { padding: '16px' });
}

function rechercheClientRdvModal(texte) {
  const zone = document.getElementById('rdv-modal-client-resultats');
  if (!zone) return;
  const q = _cleRechercheSansAccents(texte);
  const nomAffiche = c => estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
  const resultats = (q ? allClients.filter(c => _cleRechercheSansAccents(nomAffiche(c)).includes(q)) : []).slice(0, 8);
  if (!resultats.length) { zone.style.display = 'none'; return; }
  zone.innerHTML = resultats.map(c => `<div onmousedown="selectionnerClientRdvModal('${c.id}','${nomAffiche(c).replace(/'/g, "\\'")}')" style="padding:9px 14px;font-size:13px;color:var(--text);cursor:pointer;border-bottom:1px solid var(--border)">${nomAffiche(c)}</div>`).join('');
  zone.style.display = 'block';
}
function selectionnerClientRdvModal(id, nom) {
  document.getElementById('rdv-modal-client-id').value = id;
  document.getElementById('rdv-modal-client-recherche').value = nom;
  document.getElementById('rdv-modal-client-resultats').style.display = 'none';
}

async function creerRdvInterne(agentId) {
  const clientId = document.getElementById('rdv-modal-client-id')?.value || null;
  const prospectNom = (document.getElementById('rdv-modal-prospect')?.value || '').trim() || null;
  const date = document.getElementById('rdv-modal-date')?.value;
  const heure = document.getElementById('rdv-modal-heure')?.value;
  if (!clientId && !prospectNom) { showError('Indique un client ou un nom de prospect.'); return; }
  if (!date || !heure) { showError('Indique une date et une heure.'); return; }
  const body = {
    agent_id: agentId || null,
    client_id: clientId,
    prospect_nom: clientId ? null : prospectNom,
    type: document.getElementById('rdv-modal-type')?.value || null,
    // isoZurich() (js/05) explicite le décalage Europe/Zurich dans l'horodatage — sans lui la
    // session Postgres (UTC) prenait "15:15" tapé ici pour de l'UTC, donc le RDV se retrouvait
    // 1-2h plus tard partout (fiche client, agenda, Outlook). Même bug déjà corrigé sur la page
    // de réservation publique (confirmerReservationRdv) mais pas ici — repéré par Jonathan le
    // 08.09.2026 ("j'ai créé le rdv pour 15h, je le vois pas dans mon outlook").
    date_heure: isoZurich(date, heure),
    duree_min: Number(document.getElementById('rdv-modal-duree')?.value) || 45,
    notes: (document.getElementById('rdv-modal-notes')?.value || '').trim() || null,
    statut: 'confirme',
    cree_par: 'agent',
  };
  const res = await dbPost('rendez_vous', body);
  if (res && res.error) { showError('Erreur : ' + errMsg(res)); return; }
  if (res && res[0]) allRendezVous.push(res[0]);
  document.getElementById('modal-nouveau-rdv')?.remove();
  // Synchro Outlook immédiate — auparavant absente ici (contrairement aux rappels/tâches), le RDV
  // ne remontait dans l'agenda Outlook qu'à la prochaine connexion via synchroniserRdvEtDispoOutlook
  // (js/03), en silence. Repéré par Jonathan le 31.08.2026 : "j'ai créé le rdv mais il n'apparaît
  // pas dans mon outlook". Comme pour les rappels : on tente tout de suite, on prévient clairement
  // en cas d'échec (session Outlook expirée ou non connectée), le bouton 📅 sur la fiche RDV reste
  // le rattrapage manuel.
  let messageOutlook = '';
  if (res && res[0] && res[0].id) {
    try {
      const eventId = await createOutlookEventFromRdv(res[0]);
      if (eventId) {
        await dbPatch('rendez_vous', res[0].id, { outlook_event_id: eventId });
        res[0].outlook_event_id = eventId;
        const idx = allRendezVous.findIndex(r => r.id === res[0].id);
        if (idx >= 0) allRendezVous[idx].outlook_event_id = eventId;
      } else {
        messageOutlook = !msalAccessToken
          ? " ⚠️ Pas dans l'agenda Outlook — tu n'es pas connecté à Outlook (ou la connexion a expiré). Reconnecte-toi puis utilise le bouton 📅 sur la fiche du RDV."
          : " ⚠️ L'ajout à l'agenda Outlook a échoué — réessaie via le bouton 📅 sur la fiche du RDV.";
      }
    } catch (e) { messageOutlook = " ⚠️ L'ajout à l'agenda Outlook a échoué — réessaie via le bouton 📅 sur la fiche du RDV."; }
  }
  showError('✓ Rendez-vous créé.' + messageOutlook);
  // Revient sur la fiche client si le RDV a été créé depuis là (onglet RDV) — sinon retour à la
  // vue liste "Rendez-vous" comme avant.
  if (vueDetailActive && vueDetailActive.type === 'client' && clientId && vueDetailActive.id === clientId) showClient(clientId);
  else if (currentView === 'rendez-vous') navigate('rendez-vous', { silent: true });
}

// Versions "sans quitter la fiche" de traiterRappel()/rouvrirRappel() — mêmes boutons de principe
// que sur la fiche opportunité (changerStadeOpportuniteRapide) : on reste sur la fiche du rappel/
// tâche au lieu de repartir sur la liste. Demande de Jonathan le 21.08.2026.
async function traiterRappelRapide(id) {
  const r = allRappels.find(x => x.id === id);
  if (!r) return;
  let resultat;
  if (r.outlook_event_id) {
    try { await deleteOutlookEvent(r.outlook_event_id); } catch(e) {}
    resultat = await dbPatch('rappels', id, { statut: 'traité', outlook_event_id: null });
    if (!(resultat && resultat.error)) r.outlook_event_id = null;
  } else {
    resultat = await dbPatch('rappels', id, { statut: 'traité' });
  }
  if (resultat && resultat.error) { showError('Erreur lors du traitement du rappel : ' + errMsg(resultat)); return; }
  r.statut = 'traité';
  showRappel(id);
}

async function rouvrirRappelRapide(id) {
  const r = allRappels.find(x => x.id === id);
  if (!r) return;
  const resultat = await dbPatch('rappels', id, { statut: 'ouvert' });
  if (resultat && resultat.error) { showError('Erreur lors de la réouverture du rappel : ' + errMsg(resultat)); return; }
  r.statut = 'ouvert';
  if (r.date_echeance) {
    try {
      const eventId = await createOutlookEventFromRappel(r);
      if (eventId) { await dbPatch('rappels', id, { outlook_event_id: eventId }); r.outlook_event_id = eventId; }
    } catch(e) {}
  }
  showRappel(id);
}

// Report rapide de l'échéance d'un rappel/tâche — bouton demandé par Jonathan le 25.08.2026
// ("repousser la tâche avec des dates préremplies, 1 semaine, 2 semaines, 1 mois... ou spécifique").
// Le report part toujours d'AUJOURD'HUI (comme un "snooze" e-mail), pas de l'ancienne échéance —
// c'est le sens naturel de "repousser" quand on reporte une tâche qu'on n'a pas eu le temps de
// traiter. Reste sur la fiche (pas de navigate), même principe que traiterRappelRapide.
function repousserRappelRapide(id, valeur) {
  const select = document.getElementById('rd-repousser-select');
  if (!valeur) return;
  if (valeur === 'specifique') {
    ouvrirModaleDateSpecifiqueRappel(id);
    if (select) select.value = '';
    return;
  }
  const jours = parseInt(valeur, 10);
  if (!jours) { if (select) select.value = ''; return; }
  const nouvelleDate = new Date();
  nouvelleDate.setDate(nouvelleDate.getDate() + jours);
  appliquerReportRappel(id, nouvelleDate.toISOString().split('T')[0]);
  if (select) select.value = '';
}

function ouvrirModaleDateSpecifiqueRappel(id) {
  creerModale('modal-date-specifique-rappel', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:26px;width:100%;max-width:360px">
      <h3 style="margin:0 0 14px;font-size:15px;font-weight:800;color:var(--text)">📅 Repousser à une date précise</h3>
      <input class="form-input" id="date-report-specifique-rappel" type="date"/>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button class="btn-secondary" onclick="document.getElementById('modal-date-specifique-rappel').remove()">Annuler</button>
        <button class="btn-save" onclick="confirmerDateSpecifiqueRappel('${id}')">✓ Confirmer</button>
      </div>
    </div>
  `);
}

async function confirmerDateSpecifiqueRappel(id) {
  const val = document.getElementById('date-report-specifique-rappel')?.value;
  if (!val) return;
  document.getElementById('modal-date-specifique-rappel')?.remove();
  await appliquerReportRappel(id, val);
}

async function appliquerReportRappel(id, nouvelleDateStr) {
  const r = allRappels.find(x => x.id === id);
  if (!r) return;
  const ancienEventId = r.outlook_event_id;
  const resultat = await dbPatch('rappels', id, { date_echeance: nouvelleDateStr, outlook_event_id: null });
  if (resultat && resultat.error) { showError('Erreur lors du report : ' + errMsg(resultat)); return; }
  r.date_echeance = nouvelleDateStr;
  r.outlook_event_id = null;
  if (ancienEventId) { try { await deleteOutlookEvent(ancienEventId); } catch(e) {} }
  try {
    const eventId = await createOutlookEventFromRappel(r);
    if (eventId) { await dbPatch('rappels', id, { outlook_event_id: eventId }); r.outlook_event_id = eventId; }
  } catch(e) {}
  showRappel(id);
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

  const titreBordereau = `Bordereau ${b.numero||''} — ${b.compagnie}`;
  const contenuBordereau = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titreBordereau}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#0f2244;-webkit-print-color-adjust:exact;print-color-adjust:exact}
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
    <script>
      (function(){var t=${JSON.stringify(titreBordereau)};document.title=t;var e=document.querySelector('title');if(e)new MutationObserver(function(){if(document.title!==t)document.title=t;}).observe(e,{childList:true,characterData:true,subtree:true});})();
    </script>
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
    <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#0f2244;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimer</button>
    </body></html>`;
  // Blob/ObjectURL au lieu de document.write sur about:blank : un F5 dans l'onglet recharge le
  // même bordereau au lieu d'une page blanche (voir genererMandatCourtage, js/05).
  const blobBordereau = new Blob([contenuBordereau], { type: 'text/html;charset=utf-8' });
  window.open(URL.createObjectURL(blobBordereau), '_blank', 'popup');
}

function imprimerFichePaie(ficheId, lignesCommissions, debut, fin, totalMontant) {
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
  const titreFichePaie = `Fiche de paie ${fmtDate(debut)} - ${fmtDate(fin)}`;
  const contenuFichePaie = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titreFichePaie}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#0f2244;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      h1{font-size:18px} table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
      th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}
      th{background:#0f2244;color:#fff;text-transform:uppercase;font-size:10px}
      .total{font-size:15px;font-weight:800;margin-top:16px;text-align:right}
      @media print{ button{display:none} }
    </style></head><body>
    <script>
      (function(){var t=${JSON.stringify(titreFichePaie)};document.title=t;var e=document.querySelector('title');if(e)new MutationObserver(function(){if(document.title!==t)document.title=t;}).observe(e,{childList:true,characterData:true,subtree:true});})();
    </script>
    <h1>Fiche de paie — Assurex Sàrl</h1>
    <p>Période : ${fmtDate(debut)} au ${fmtDate(fin)}</p>
    <table><thead><tr><th>Client</th><th>Produit</th><th>Compagnie</th><th>Montant</th><th>Part signataire</th><th>Part apporteur</th></tr></thead>
    <tbody>${lignesHtml}</tbody></table>
    <div class="total">Total : CHF ${fmtCHF(Math.round(totalMontant))}</div>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#0f2244;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimer</button>
    </body></html>`;
  // Blob/ObjectURL au lieu de document.write sur about:blank : un F5 dans l'onglet recharge la
  // même fiche de paie au lieu d'une page blanche (voir genererMandatCourtage, js/05).
  const blobFichePaie = new Blob([contenuFichePaie], { type: 'text/html;charset=utf-8' });
  window.open(URL.createObjectURL(blobFichePaie), '_blank', 'popup');
}

// ═══ IMPORT DÉCOMPTE COMPAGNIE (Excel norme IG B2B — ex: Vaudoise "Décompte de prime") ═══
function viewImportDecompte() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">📥 Importer un décompte compagnie (PDF ou Excel)</h2>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Lit directement le fichier envoyé par une compagnie — Excel norme IG B2B (testé avec La Vaudoise) ou PDF lu automatiquement par l'IA (pour les compagnies comme AXA qui n'envoient que du PDF). Réconcilie automatiquement les contrats par n° de police, propose un client probable par le nom quand le contrat n'est pas trouvé, reprend directement le taux et le montant déjà calculés par la compagnie dans le fichier, puis crée en un clic le bordereau numéroté (BRD 001, 002…) avec les commissions déjà rapprochées dessus.</div>

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
      <div style="margin-top:14px"><label class="form-label">Encaissé par</label>
        <div class="imp-encaisse" role="radiogroup" aria-label="Encaissé par">
          <label><input type="radio" name="imp-encaisse-par" value="assurex" checked/> <span>Assurex</span></label>
          <label><input type="radio" name="imp-encaisse-par" value="oz"/> <span>${typeof OZ_MINI_LOGO !== 'undefined' ? OZ_MINI_LOGO : ''} OZ Assure</span></label>
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">« OZ Assure » : décompte versé sur le compte d'OZ — les commissions sont enregistrées en « Versé OZ » et le bordereau marqué OZ, <strong>sans compter dans les encaissements Assurex</strong> (tableau de bord, suivi financier, trésorerie).</div>
      </div>
    `)}

    <div id="imp-resultats"></div>
  `;
}

let _decompteLignes = [];
let _decompteFichier = null; // fichier du décompte importé (Excel/PDF), archivé avec le bordereau créé
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
// Colonne « Contrat CRM » de l'import : le contrat auquel la ligne sera rattachée. Quand plusieurs
// contrats partagent le n° de police (ex. RC véhicule + casco sous une même police Vaudoise), une
// liste permet de choisir — présélection automatique selon la branche (marqueursBranche).
function htmlContratImport(l) {
  if (!l.contratId) return '<span style="color:var(--text-dim)">—</span>';
  const cands = l.candidats || [];
  const contrat = cands.length > 1
    ? `<select aria-label="Contrat CRM pour cette ligne" onchange="choisirContratImport(${l.idx}, this.value)" title="Plusieurs contrats partagent ce n° de police : choisis celui qui correspond à la branche" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.45);border-radius:8px;color:var(--text);padding:4px 6px;font-size:12px;max-width:220px">
      ${cands.map(c => `<option value="${c.id}" ${c.id === l.contratId ? 'selected' : ''}>${String(c.produit).replace(/</g, '&lt;')}${c.statut && c.statut !== 'actif' ? ` (${c.statut})` : ''}</option>`).join('')}
    </select>`
    : `<span style="color:var(--text-muted)">${String(l.contratProduit || 'Contrat').replace(/</g, '&lt;')}</span>`;
  const doublon = l.doublon ? `<div title="${String(l.doublon.detail).replace(/"/g, '&quot;')}" style="margin-top:4px;font-size:11px;font-weight:600;color:#DC2626;white-space:normal;max-width:240px">⛔ ${l.doublon.certain ? 'Déjà importé' : 'Doublon probable'} — ${l.doublon.court}<span style="display:block;font-weight:400;color:var(--text-muted)">ligne décochée ; coche-la si c’est bien un nouveau versement</span></div>` : '';
  const attente = l.attenteId ? `<label style="display:flex;align-items:center;gap:5px;margin-top:4px;font-size:11px;color:var(--text-muted);cursor:pointer;white-space:normal;max-width:240px"><input type="checkbox" ${l.imputer ? 'checked' : ''} onchange="_decompteLignes[${l.idx}].imputer=this.checked"/> Déduire de la commission en attente (reste CHF ${fmtCHF2(l.attenteReste)})</label>` : '';
  const parNom = l.parNom ? `<div title="Aucun contrat avec ce n° de police : rattaché d'après le nom de l'assuré et la compagnie" style="margin-top:4px;font-size:11px;font-weight:600;color:#D97706;white-space:normal;max-width:240px">🔎 Rapproché par le nom — vérifie, et complète le n° de police du contrat</div>` : '';
  return contrat + parNom + doublon + attente;
}

// Référence unique d'une ligne de décompte (police, facture, date, branche, montant) : mémorisée dans
// le détail de la commission ou du versement créé → un réimport du même fichier est reconnu à coup sûr.
function refLigneImport(l) {
  return `ref:${normPoliceNumero(l.numeroContrat)}|${l.noFacture || ''}|${l.dateFacture || ''}|${(l.brancheInterne || '').toLowerCase().replace(/\s+/g, ' ').slice(0, 40)}|${Number(l.montant || 0).toFixed(2)}`;
}
// Complète une ligne : doublon éventuel (déjà importé / probable) et commission en attente à laquelle
// imputer le montant (paiements échelonnés, rapprochement automatique). Un doublon est décoché d'office.
function enrichirLigneImport(l) {
  l.ref = refLigneImport(l);
  l.doublon = null; l.attenteId = null; l.attenteReste = 0;
  if (!l.contratId || !l.montant) return l;
  const tranches = typeof allCommissionTranches !== 'undefined' ? allCommissionTranches : [];
  const commsContrat = allCommissionsAttente.filter(c => c.contrat_id === l.contratId);
  const certain = commsContrat.find(c => (c.detail_calcul || '').includes(`[${l.ref}]`)) || tranches.find(t => (t.note || '').includes(`[${l.ref}]`));
  if (certain) {
    l.doublon = { certain: true, court: 'cette ligne de facture existe déjà', detail: `Même police, facture, date, branche et montant — importée le ${fmtDate(certain.date_creation || certain.date_reception || certain.created_at)}` };
  } else {
    // Même contrat, même montant (au centime, ou au franc pour les anciens imports arrondis), déjà encaissé —
    // seulement pour les commissions SANS référence (anciens imports, historique OZ) : une commission
    // importée depuis REX porte sa référence de facture, une autre facture n'est donc pas un doublon
    // (mensualités identiques d'une convention de paiement échelonné).
    const egal = m => Math.abs(Number(m) - l.montant) < 0.01 || Math.round(Number(m)) === Math.round(l.montant);
    const m = String(l.dateFacture || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    const isoFacture = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : String(l.dateFacture || '').slice(0, 10);
    const jours = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
    const proche = commsContrat.find(c => c.statut !== 'en_attente' && !(c.detail_calcul || '').includes('[ref:') && egal(c.montant_final != null ? c.montant_final : c.montant_estime))
      || tranches.find(t => commsContrat.some(c => c.id === t.commission_id) && !(t.note || '').includes('[ref:') && egal(t.montant)
        && isoFacture && t.date_reception && jours(t.date_reception, isoFacture) <= 5);
    if (proche) {
      const statut = proche.statut ? ({ 'reçue': 'reçue', 'versé_oz': 'versée à OZ', 'extourné': 'extournée' }[proche.statut] || proche.statut) : 'versée (versement partiel)';
      l.doublon = { certain: false, court: `CHF ${fmtCHF2(l.montant)} déjà ${statut}${proche.date_reception ? ' le ' + fmtDate(proche.date_reception) : ''}`, detail: `Commission existante sur le même contrat avec le même montant (${proche.detail_calcul || proche.note || ''})` };
    }
  }
  if (l.doublon) l.selectionne = false;
  // Commission en attente sur ce contrat (ex. commission annuelle payée par mensualités) : déduire plutôt que créer
  const attente = commsContrat.find(c => c.statut === 'en_attente' && (typeof commissionResteAttendu === 'function' ? commissionResteAttendu(c) : Number(c.montant_estime || 0)) > 0);
  if (attente) {
    l.attenteId = attente.id;
    l.attenteReste = typeof commissionResteAttendu === 'function' ? commissionResteAttendu(attente) : Number(attente.montant_estime || 0);
    if (l.imputer === undefined) l.imputer = true;
  }
  return l;
}
function choisirContratImport(idx, contratId) {
  const l = _decompteLignes[idx];
  const ct = allContrats.find(c => c.id === contratId);
  if (!l || !ct) return;
  l.contratId = ct.id; l.contratProduit = ct.produit;
  const cl = allClients.find(c => c.id === ct.client_id);
  if (cl) { l.clientId = cl.id; l.clientNomCRM = estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`; }
  enrichirLigneImport(l);
  const cellule = document.getElementById(`imp-contrat-${idx}`);
  if (cellule) cellule.innerHTML = htmlContratImport(l);
  const coche = document.getElementById(`imp-check-${idx}`);
  if (coche) coche.checked = l.selectionne;
}

// Familles de couverture reconnues dans un libellé de branche ou de produit (19.09.2026)
function marqueursBranche(texte) {
  const t = (texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const m = new Set();
  if (/\brc\b|responsabilite|haftpflicht/.test(t)) m.add('rc');
  if (/casco|kasko/.test(t)) m.add('casco');
  if (/collision|complete|vollkasko/.test(t)) m.add('complete');
  if (/partielle|\bvol\b|teilkasko|bris de glace|incendie|forces? de la nature|parking/.test(t)) m.add('partielle');
  if (/accident|occupant|\blaa\b|unfall/.test(t)) m.add('accident');
  if (/juridique|rechtsschutz/.test(t)) m.add('pj');
  if (/menage|inventaire|hausrat/.test(t)) m.add('menage');
  if (/cyber/.test(t)) m.add('cyber');
  return m;
}

// Numéros de police candidats lus dans le texte du décompte. Certains PDF (Groupe Mutuel) mêlent nom,
// numéro d'assuré et date sur une même ligne (« Nom Prénom / GMA SA 7623006 / 23.04.2026 ») : collés
// ensemble, les chiffres ne correspondaient plus à rien. On essaie le numéro entier, puis chaque
// groupe de chiffres (dates retirées).
function policesCandidates(numeroContrat) {
  const brut = (numeroContrat || '').toString();
  const res = [normPoliceNumero(brut)];
  const sansDates = brut.replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ');
  res.push(normPoliceNumero(sansDates));
  (sansDates.match(/\d[\d\s]{3,}\d/g) || []).forEach(g => res.push(normPoliceNumero(g)));
  (sansDates.match(/\d{5,}/g) || []).forEach(g => res.push(normPoliceNumero(g)));
  return [...new Set(res.filter(x => x && x.length >= 5))];
}

// Même compagnie, à la louche (« GMA SA » / « Groupe Mutuel », « Vaudoise Générale » / « La Vaudoise »)
function compagnieProcheImport(a, b) {
  const n = s => (typeof normaliserCompagnie === 'function' ? normaliserCompagnie(s || '') : (s || '')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(la|le|les|sa|ag|assurances?|generale|group|groupe)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const x = n(a), y = n(b);
  if (!x || !y) return true; // compagnie inconnue : on ne filtre pas
  if (/mutuel|gma\b/.test(x) && /mutuel|gma\b/.test(y)) return true;
  return x === y || x.includes(y) || y.includes(x);
}

function scoreBrancheImport(c, brancheInterne) {
  const motsB = (brancheInterne || '').toLowerCase().split(/[^a-zàâäéèêëïîôöùûüç0-9]+/).filter(w => w.length >= 4);
  const marqB = marqueursBranche(brancheInterne);
  const p = (c.produit || '').toLowerCase();
  let score = motsB.reduce((s, m) => s + (p.includes(m) ? 1 : 0), 0);
  // Familles de couverture (RC, casco partielle/complète, accidents…) : « Ass. RC Avenue » →
  // « RC véhicule », « Casco segmentée vol » → « Casco partielle », « … collision » → « Casco complète »
  const marqP = marqueursBranche(c.produit);
  marqB.forEach(m => { if (marqP.has(m)) score += 2; });
  if (marqB.has('rc') && marqP.has('casco')) score -= 2;
  if (marqB.has('casco') && marqP.has('rc') && !marqP.has('casco')) score -= 2;
  if (!estStatutResilieOuAnnule(c.statut)) score += 0.5;
  return score;
}

function matcherContratEtClient(numeroContrat, brancheInterne, nomFichier) {
  const nomClient = c => estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`;
  const meilleur = liste => liste.reduce((m, c) => { const s = scoreBrancheImport(c, brancheInterne); return s > m.s ? { c, s } : m; }, { c: liste[0], s: -Infinity }).c;

  // 1. Par numéro de police
  let candidats = [];
  for (const np of policesCandidates(numeroContrat)) {
    candidats = allContrats.filter(c => c.numero_police && normPoliceNumero(c.numero_police) === np);
    if (candidats.length) break;
  }
  let contratTrouve = candidats.length === 1 ? candidats[0] : candidats.length > 1 ? meilleur(candidats) : null;
  let parNom = false;

  // 2. À défaut, par le nom de l'assuré : client dont le nom correspond (mots dans le désordre,
  //    noms composés tolérés, au moins deux mots en commun), puis ses contrats chez la même compagnie
  let clientSuggere = null;
  if (!contratTrouve && nomFichier) {
    const mf = motsTriesSansAccents(nomFichier).split(' ').filter(w => w.length >= 2);
    const correspond = c => {
      const mc = motsTriesSansAccents(nomClient(c)).split(' ').filter(w => w.length >= 2);
      if (!mc.length || !mf.length) return false;
      const communs = mf.filter(w => mc.includes(w)).length;
      return communs >= 2 && (communs === mf.length || communs === mc.length);
    };
    const clients = allClients.filter(correspond);
    if (clients.length === 1) {
      clientSuggere = clients[0];
      const cieDecompte = typeof _decompteNomAssureur !== 'undefined' ? _decompteNomAssureur : '';
      const ctsClient = allContrats.filter(ct => ct.client_id === clientSuggere.id && compagnieProcheImport(ct.compagnie, cieDecompte) && !estStatutResilieOuAnnule(ct.statut));
      if (ctsClient.length) {
        candidats = ctsClient;
        contratTrouve = ctsClient.length === 1 ? ctsClient[0] : meilleur(ctsClient);
        parNom = true;
      }
    }
  }
  const clientTrouve = contratTrouve ? allClients.find(c => c.id === contratTrouve.client_id) : null;
  return { contratTrouve, clientTrouve, clientSuggere: clientTrouve ? null : clientSuggere, candidats, parNom };
}
// Ré-applique le rapprochement (police -> contrat CRM) sur toutes les lignes déjà analysées, sans
// redemander le fichier — utilisé après la création d'un contrat manquant depuis l'écran d'import,
// pour que la ligne (et toute autre ligne partageant la même police) se rattache immédiatement.
function reassocierLignesImport() {
  _decompteLignes.forEach(l => {
    const { contratTrouve, clientTrouve, clientSuggere, candidats, parNom } = matcherContratEtClient(l.numeroContrat, l.brancheInterne, l.nomVaudoise);
    l.parNom = parNom;
    l.contratId = contratTrouve ? contratTrouve.id : null;
    l.clientId = contratTrouve ? (clientTrouve ? clientTrouve.id : null) : (clientSuggere ? clientSuggere.id : null);
    l.clientNomCRM = clientTrouve ? (estEntreprise(clientTrouve) ? clientTrouve.nom : `${clientTrouve.prenom} ${clientTrouve.nom}`) : null;
    l.clientSuggereNom = (!clientTrouve && clientSuggere) ? (estEntreprise(clientSuggere) ? clientSuggere.nom : `${clientSuggere.prenom} ${clientSuggere.nom}`) : null;
    l.ambigu = candidats.length > 1;
    l.candidats = candidats.map(c => ({ id: c.id, produit: c.produit || 'Contrat', statut: c.statut }));
    l.contratProduit = contratTrouve ? contratTrouve.produit : null;
    if (contratTrouve) l.selectionne = true;
    enrichirLigneImport(l);
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

  // Même client + même produit + même n° de police déjà en base : on ne crée pas de doublon
  if (typeof contratExisteDeja === 'function' && contratExisteDeja(l.clientId, l.brancheInterne || 'Contrat (à préciser)', l.numeroContrat)) {
    showError(`Ce client a déjà ce contrat (police ${l.numeroContrat}) — rien n'a été créé.`);
    reassocierLignesImport();
    return;
  }
  const btn = document.getElementById(`imp-creer-${idx}`);
  if (btn && btn.disabled) return; // double-clic : une création est déjà en cours
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
  _decompteFichier = file;
  // Versements partiels et commissions à jour : nécessaires à la détection des doublons et à la déduction
  try { const [tr, co] = await Promise.all([dbGet('commission_tranches', 'select=*'), dbGet('commissions_attente', 'select=*')]); if (Array.isArray(tr)) allCommissionTranches = tr; if (Array.isArray(co)) allCommissionsAttente = co; } catch (e) {}
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
    if (r[0] === 'Commission totale:') commissionTotaleAnnoncee = isNaN(nombreCH(r[1])) ? null : nombreCH(r[1]);
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
    // Par contrat ET par facture : une facture « total + détails » ne doit pas faire écarter la ligne
    // total d'une autre facture du même contrat qui, elle, n'a pas de détail (19.09.2026)
    const key = `${(r[iContrat] || '').toString().trim()}|${iNoFacture !== -1 ? (r[iNoFacture] ?? '') : ''}`;
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

  _decompteNomAssureur = nomAssureur; // avant le rapprochement : sert au repli par nom (même compagnie)
  _decompteLignes = lignesUtiles.map((r, i) => {
    const numeroContrat = (r[iContrat] || '').toString().trim();
    const brancheInterne = iBranche !== -1 ? (r[iBranche] || '') : '';
    const nomFichier = `${(r[iNom] || '').toString().trim()}${r[iPrenom] ? ' ' + r[iPrenom].toString().trim() : ''}`.trim();
    const commissionProduction = iCommissionProd !== -1 ? (nombreCH(r[iCommissionProd]) || 0) : 0;
    const tauxFichier = iTaux !== -1 ? (nombreCH(r[iTaux]) || 0) : 0;
    const montantDetaille = iMontantDetaille !== -1 ? nombreCH(r[iMontantDetaille]) : null;
    const montantTotalCol = iMontantTotal !== -1 ? nombreCH(r[iMontantTotal]) : null;
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
  const { contratTrouve, clientTrouve, clientSuggere, candidats, parNom } = matcherContratEtClient(numeroContrat, brancheInterne, nomFichier);
  return enrichirLigneImport({
    idx: i,
    numeroContrat,
    noFacture: noFacture || null,
    dateFacture: dateFacture || null,
    nomVaudoise: nomFichier || '(nom non fourni par le fichier)',
    npa: npa || '', localite: localite || '',
    brancheInterne: brancheInterne || '',
    commissionProduction: nombreCH(commissionProduction) || 0,
    taux: nombreCH(taux) || 0,
    montant: Math.round((nombreCH(montant) || 0) * 100) / 100,
    contratId: contratTrouve ? contratTrouve.id : null,
    clientId: contratTrouve ? (clientTrouve ? clientTrouve.id : null) : (clientSuggere ? clientSuggere.id : null),
    clientNomCRM: clientTrouve ? (estEntreprise(clientTrouve) ? clientTrouve.nom : `${clientTrouve.prenom} ${clientTrouve.nom}`) : null,
    clientSuggereNom: (!clientTrouve && clientSuggere) ? (estEntreprise(clientSuggere) ? clientSuggere.nom : `${clientSuggere.prenom} ${clientSuggere.nom}`) : null,
    primeCRM: contratTrouve ? contratTrouve.prime_annuelle : null,
    ambigu: candidats.length > 1,
    candidats: candidats.map(c => ({ id: c.id, produit: c.produit || 'Contrat', statut: c.statut })),
    contratProduit: contratTrouve ? contratTrouve.produit : null,
    selectionne: !!contratTrouve,
    parNom,
  });
}

// ═══ IMPORT DÉCOMPTE PDF (compagnies qui n'envoient pas d'Excel, ex: AXA) — lecture par IA ═══
async function analyserDecomptePdf(input) {
  const file = input.files[0];
  if (!file) return;
  _decompteFichier = file;
  // Versements partiels et commissions à jour : nécessaires à la détection des doublons et à la déduction
  try { const [tr, co] = await Promise.all([dbGet('commission_tranches', 'select=*'), dbGet('commissions_attente', 'select=*')]); if (Array.isArray(tr)) allCommissionTranches = tr; if (Array.isArray(co)) allCommissionsAttente = co; } catch (e) {}
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

    _decompteNomAssureur = data.compagnie || ''; // avant le rapprochement : sert au repli par nom
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
    _decompteCommissionTotaleAnnoncee = data.commission_totale != null && !isNaN(nombreCH(data.commission_totale)) ? nombreCH(data.commission_totale) : null;
    if (statusEl) { statusEl.textContent = `✓ ${_decompteLignes.length} ligne(s) lue(s) par l'IA — vérifie le rapprochement ci-dessous avant d'importer.`; statusEl.style.color = '#4ade80'; }
    renderImportDecompte(_decompteNomAssureur, _decompteCommissionTotaleAnnoncee);
  } catch (e) {
    if (statusEl) { statusEl.textContent = '✗ ' + e.message + ' — réessaie, ou importe le fichier Excel si la compagnie en fournit un.'; statusEl.style.color = '#f87171'; }
  }
  input.value = '';
}

// Répartit les lignes du décompte entre les commissions en attente du même contrat : chaque ligne
// va vers l'attente dont le reste est le plus proche de son montant, en tenant compte de ce que
// les lignes précédentes y imputent déjà (plusieurs lignes d'une même police, ex. RC + casco).
// Sans ça, toutes les lignes visaient la même attente, ou aucune (repéré le 19.09.2026, décompte Vaudoise).
function repartirImputationsImport() {
  const alloue = {};
  _decompteLignes.forEach(l => {
    l.attenteId = null; l.attenteReste = 0;
    if (!l.contratId || !l.montant) return;
    const cands = allCommissionsAttente
      .filter(c => c.contrat_id === l.contratId && c.statut === 'en_attente')
      .map(c => ({ c, reste: (typeof commissionResteAttendu === 'function' ? commissionResteAttendu(c) : Number(c.montant_estime || 0)) - (alloue[c.id] || 0) }))
      .filter(x => x.reste > 0.005)
      .sort((a, b) => Math.abs(a.reste - l.montant) - Math.abs(b.reste - l.montant));
    if (!cands.length) return;
    l.attenteId = cands[0].c.id;
    l.attenteReste = cands[0].reste;
    if (l.imputer === undefined) l.imputer = true;
    if (l.imputer && l.selectionne !== false && !l.doublon) alloue[l.attenteId] = (alloue[l.attenteId] || 0) + Number(l.montant);
  });
}

function renderImportDecompte(nomAssureur, commissionTotaleAnnoncee) {
  repartirImputationsImport();
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
        Total annoncé par le fichier : CHF ${fmtCHF2(commissionTotaleAnnoncee)} — total des lignes lues : CHF ${fmtCHF2(totalFichier)}
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
          <th style="padding:6px 8px;text-align:left">Contrat CRM</th>
          <th style="padding:6px 8px;text-align:right">Base commission</th>
          <th style="padding:6px 8px;text-align:right">Taux %</th>
          <th style="padding:6px 8px;text-align:right">Montant</th>
        </tr></thead>
        <tbody>${_decompteLignes.map(l => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:5px 8px"><input type="checkbox" id="imp-check-${l.idx}" ${l.selectionne ? 'checked' : ''} ${!l.contratId ? 'disabled' : ''} onchange="_decompteLignes[${l.idx}].selectionne = this.checked; recalculerEcartBordereauImport();"/></td>
            <td style="padding:5px 8px;font-family:monospace;white-space:nowrap">${l.numeroContrat}</td>
            <td style="padding:5px 8px;white-space:nowrap;color:var(--text-muted)">${l.noFacture || '—'}</td>
            <td style="padding:5px 8px;white-space:nowrap;color:var(--text-muted)">${l.dateFacture || '—'}</td>
            <td style="padding:5px 8px;white-space:nowrap">${l.nomVaudoise}</td>
            <td style="padding:5px 8px;white-space:nowrap;color:var(--text-muted)">${l.npa || '—'}</td>
            <td style="padding:5px 8px;white-space:nowrap;color:var(--text-muted)">${l.localite || '—'}</td>
            <td style="padding:5px 8px;white-space:nowrap">${l.clientNomCRM ? l.clientNomCRM : (l.clientSuggereNom ? `<span style="color:#f59e0b">≈ ${l.clientSuggereNom}</span>` : '<span style="color:#f87171">Non trouvé</span>')}${!l.clientNomCRM && l.clientSuggereNom ? `<div style="font-size:9.5px;color:var(--text-muted);white-space:normal;max-width:170px;margin-bottom:4px">nom trouvé, pas de contrat avec cette police — vérifie avant de créer</div><div style="display:flex;gap:6px"><button type="button" onclick="document.getElementById('modal-detail-contrat')?.remove(); showClient('${l.clientId}')" style="background:var(--surface-alt);color:var(--text-muted);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:10.5px;cursor:pointer;font-weight:700;white-space:nowrap">👁 Voir la fiche</button><button type="button" id="imp-creer-${l.idx}" onclick="creerContratDepuisImport(${l.idx})" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:3px 8px;font-size:10.5px;cursor:pointer;font-weight:700;white-space:nowrap">📝 Créer</button></div>` : ''}</td>
            <td style="padding:5px 8px;color:var(--text-muted);white-space:nowrap">${l.brancheInterne}</td>
            <td id="imp-contrat-${l.idx}" style="padding:5px 8px;white-space:nowrap">${htmlContratImport(l)}</td>
            <td style="padding:5px 8px;text-align:right;white-space:nowrap;color:var(--text-muted)">CHF ${fmtCHF(l.commissionProduction)}</td>
            <td style="padding:5px 8px;text-align:right;white-space:nowrap">${l.taux}%</td>
            <td style="padding:5px 8px;text-align:right;white-space:nowrap"><input type="number" step="0.01" value="${l.montant}" class="imp-montant-input" data-idx="${l.idx}" style="width:75px;background:var(--surface-alt);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:3px 5px;text-align:right" onchange="_decompteLignes[${l.idx}].montant = nombreCH(this.value)||0; recalculerTotalImport(); recalculerEcartBordereauImport();"/></td>
          </tr>`).join('')}</tbody>
        <tfoot><tr style="border-top:2px solid var(--border)">
          <td colspan="12" style="padding:8px;text-align:right;font-weight:700;color:var(--text)">Total des lignes ci-dessus</td>
          <td id="imp-total-cell" style="padding:8px;text-align:right;font-weight:800;color:#4ade80;white-space:nowrap">CHF ${fmtCHF2(_decompteLignes.reduce((s,l)=>s+l.montant,0))}</td>
        </tr></tfoot>
      </table>
      </div>
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:10px">Taux et montant sont repris directement du décompte compagnie (modifiable si besoin). Une ligne sans contrat CRM reconnu ne peut pas être importée automatiquement — crée le contrat manquant (ou corrige son n° de police) puis réimporte le fichier.${_decompteLignes.some(l => l.montant < 0) ? ' Un montant négatif n\'est pas une erreur : la compagnie a émis 2 factures pour la même police (voir le n° de facture sous chaque ligne) — la 2e corrige/ajuste une branche de la 1ère, d\'où une ligne en négatif compensée par une autre en positif.' : ''}</div>
    `)}

    ${sectionCard('Bordereau créé pour ce lot', '#a78bfa', renderBlocBordereauImportDecompte())}

    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn-save" id="imp-btn-creer" onclick="importerCommissionsEtBordereau('${(nomAssureur || '').replace(/'/g, "\\'")}')">✓ Créer les commissions et le bordereau</button>
    </div>
  `;
}

// Bloc "Bordereau" affiché sous le tableau de lignes — le numéro (BRD 001 - Mois Année - Compagnie)
// est généré à l'affichage à partir des bordereaux existants ; le montant brut est préempli avec le
// total des lignes actuellement cochées mais reste modifiable si le montant officiel du décompte
// diffère (ex. arrondi compagnie, ligne exclue volontairement du bordereau mais gardée en commission).
function renderBlocBordereauImportDecompte() {
  const now = new Date();
  const totalCoche = _decompteLignes.filter(l => l.selectionne && l.contratId).reduce((s, l) => s + l.montant, 0);
  const numeroApercu = genererNumeroBordereau(_decompteNomAssureur || '', MOIS_LISTE_IB[now.getMonth()], now.getFullYear(), allBordereaux);
  return `
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Numéro attribué automatiquement à la création — actuellement <span style="font-family:monospace;font-weight:700;color:var(--accent)">${numeroApercu}</span> (peut changer d'une unité si un autre bordereau est créé entretemps).</div>
    <div class="form-grid">
      <div class="form-field"><label class="form-label">Mois *</label>
        <select class="form-select" id="imp-bd-mois">
          ${MOIS_LISTE_IB.map(m => `<option value="${m}" ${m === MOIS_LISTE_IB[now.getMonth()] ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
      <div class="form-field"><label class="form-label">Année *</label>
        <select class="form-select" id="imp-bd-annee">
          ${[2024, 2025, 2026, 2027].map(y => `<option value="${y}" ${y === now.getFullYear() ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>
      <div class="form-field"><label class="form-label">Montant brut (CHF) *</label>
        <input class="form-input" id="imp-bd-montant" type="number" step="0.01" value="${Math.round(totalCoche * 100) / 100}" oninput="recalculerEcartBordereauImport()"/>
        <div id="imp-bd-ecart" style="font-size:10.5px;color:var(--text-muted);margin-top:4px">Préempli avec le total des lignes cochées ci-dessus — corrige si le montant officiel du bordereau compagnie diffère.</div>
      </div>
      <div class="form-field"><label class="form-label">Taux de caution (%)</label><input class="form-input" id="imp-bd-caution" type="number" step="0.1" placeholder="5 à 10" min="0" max="100"/></div>
      <div class="form-field"><label class="form-label">Statut</label><select class="form-select" id="imp-bd-statut">
        <option value="reçu" selected>Reçu</option>
        <option value="attendu">Attendu</option>
      </select></div>
      <div class="form-field"><label class="form-label">Date de réception</label><input class="form-input" id="imp-bd-date" type="date" value="${now.toISOString().split('T')[0]}"/></div>
    </div>
  `;
}

// Recalcule juste le message d'écart sous "Montant brut" quand Jonathan le modifie à la main — ne
// touche à rien d'autre (même prudence que recalculerTotalImportBordereau : ne pas effacer les
// champs déjà remplis en régénérant tout le formulaire).
function recalculerEcartBordereauImport() {
  const el = document.getElementById('imp-bd-ecart');
  if (!el) return;
  const montantBrut = nombreCH(document.getElementById('imp-bd-montant').value) || 0;
  const totalCoche = _decompteLignes.filter(l => l.selectionne && l.contratId).reduce((s, l) => s + l.montant, 0);
  const ecart = Math.round((montantBrut - totalCoche) * 100) / 100;
  if (Math.abs(ecart) > 1) {
    el.innerHTML = `⚠️ Écart de CHF ${fmtCHF(ecart)} avec le total des lignes cochées (CHF ${fmtCHF2(totalCoche)}) — vérifie avant de créer.`;
    el.style.color = '#f87171';
  } else {
    el.innerHTML = 'Correspond au total des lignes cochées ci-dessus.';
    el.style.color = 'var(--text-muted)';
  }
}

// Recalcule et réaffiche le total en pied de tableau après modification manuelle d'un montant.
function recalculerTotalImport() {
  const total = _decompteLignes.reduce((s, l) => s + l.montant, 0);
  const cell = document.getElementById('imp-total-cell');
  if (cell) cell.textContent = 'CHF ' + fmtCHF2(total);
}

// Flux fusionné (demande de Jonathan, 16.09.2026) : un seul bouton fait upload PDF/Excel → lecture
// IA → validation des lignes → création DIRECTE du bordereau numéroté (BRD 001 - Mois Année -
// Compagnie) avec les commissions déjà rapprochées dessus (statut "reçue" d'emblée, pas "en attente"
// puis un second import séparé) — le PDF/Excel importé EST le décompte de la compagnie, donc les
// commissions qu'il contient sont par définition déjà validées par elle.
async function importerCommissionsEtBordereau(nomAssureur) {
  // Garde-fou anti-doublon n°1 : sans ce verrou, un double-clic sur le bouton (le clic reste actif
  // pendant toute la boucle await ci-dessous) relançait deux fois la création des mêmes lignes —
  // c'est la cause la plus probable d'un doublon signalé par Jonathan le 16.09.2026.
  const btn = document.getElementById('imp-btn-creer');
  if (btn && btn.disabled) return;

  const aTraiter = _decompteLignes.filter(l => l.selectionne && l.contratId);
  if (!aTraiter.length) {
    showError('Aucune ligne sélectionnée avec un contrat reconnu.');
    return;
  }
  const mois = document.getElementById('imp-bd-mois')?.value;
  const annee = Number(document.getElementById('imp-bd-annee')?.value);
  const montantBrut = Math.round((nombreCH(document.getElementById('imp-bd-montant')?.value) || 0) * 100) / 100; // centimes conservés
  const caution = Number(document.getElementById('imp-bd-caution')?.value) || 0;
  const statutBordereau = document.getElementById('imp-bd-statut')?.value || 'reçu';
  const dateReception = document.getElementById('imp-bd-date')?.value || '';
  if (!mois || !annee) { showError('Choisis le mois et l\'année du bordereau.'); return; }
  if (!montantBrut) { showError('Indique le montant brut du bordereau.'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Création en cours...'; }

  const nature = document.getElementById('imp-nature-commission')?.value || 'gestion';
  // Décompte encaissé par OZ Assure : commissions « versé_oz » (exclues des chiffres Assurex) et bordereau marqué OZ
  let surOZ = (document.querySelector('input[name="imp-encaisse-par"]:checked')?.value || 'assurex') === 'oz';
  // Dès le 01.01.2027, toute la gestion est production Assurex (règle générale) : pas de gestion « OZ » après cette date
  const dateRef = document.getElementById('imp-bd-date')?.value || new Date().toISOString().slice(0, 10);
  if (surOZ && nature === 'gestion' && typeof DATE_GESTION_ASSUREX !== 'undefined' && dateRef >= DATE_GESTION_ASSUREX) {
    if (!confirm(`Depuis le 01.01.2027, toutes les commissions de gestion sont de la production Assurex.\n\nEnregistrer ce décompte de gestion en Assurex (recommandé) ?\n\nOK = Assurex · Annuler = arrêter l'import`)) {
      if (btn) { btn.disabled = false; btn.textContent = '✓ Créer les commissions et le bordereau'; }
      return;
    }
    surOZ = false;
  }
  const aujourdhui = new Date().toISOString().split('T')[0];
  const compagnie = normaliserCompagnie(nomAssureur || '');

  // Le bordereau est créé EN PREMIER : chaque commission créée ensuite se rattache directement à
  // son id (bordereau_id), pas de rapprochement séparé à faire après coup.
  const numero = genererNumeroBordereau(compagnie, mois, annee, allBordereaux);
  const rBordereau = await dbPost('bordereaux', {
    numero,
    compagnie,
    mois: `${mois} ${annee}`,
    montant_brut: montantBrut,
    taux_caution: caution,
    statut: statutBordereau,
    date_reception: dateReception || null,
    encaisse_par: surOZ ? 'oz' : 'assurex',
  });
  if (rBordereau && rBordereau.error) {
    showError('Erreur lors de la création du bordereau : ' + errMsg(rBordereau));
    if (btn) { btn.disabled = false; btn.textContent = '✓ Créer les commissions et le bordereau'; }
    return;
  }
  const nouveauBordereau = rBordereau && rBordereau[0] ? rBordereau[0] : null;
  if (!nouveauBordereau) {
    showError('Le bordereau semble créé mais sa réponse est vide — vérifie dans la liste des bordereaux avant de réessayer.');
    if (btn) { btn.disabled = false; btn.textContent = '✓ Créer les commissions et le bordereau'; }
    return;
  }
  // Le fichier du décompte (Excel ou PDF scanné) reste archivé avec le bordereau
  const fichierArchive = _decompteFichier && typeof archiverFichierBordereau === 'function' ? await archiverFichierBordereau(nouveauBordereau, _decompteFichier) : false;
  const dateReceptionCommission = surOZ ? (dateReception || aujourdhui) : ((dateReception && dateReception >= DATE_BASCULE_ASSUREX) ? dateReception : aujourdhui);

  let nbCrees = 0, nbEchecs = 0, nbIgnores = 0, nbImputes = 0, nbSoldes = 0, totalImpute = 0;
  const attentesTouchees = new Set();
  for (const l of aTraiter) {
    const montant = Math.round((Number(l.montant) || 0) * 100) / 100; // centimes conservés (19.09.2026)
    // Un montant négatif est une vraie correction de la compagnie (2e facture ajustant une branche
    // de la 1ère) — il doit être importé comme les autres, sinon la correction disparaît silencieusement
    // et le montant en attente reste surestimé du montant qu'elle était censée compenser.
    if (montant !== 0) {
      // Garde-fou anti-doublon n°2 : si une commission identique (même contrat, même montant, créée
      // aujourd'hui) existe déjà — en attente ou déjà reçue — c'est presque certainement un doublon
      // (fichier réimporté par erreur, ou double-clic malgré le verrou ci-dessus) plutôt qu'une
      // nouvelle commission légitime — on ne la recrée pas.
      const dejaExistante = allCommissionsAttente.some(c => c.contrat_id === l.contratId && Math.round(Number(c.montant_estime || 0) * 100) / 100 === montant && c.date_creation === aujourdhui);
      if (dejaExistante) { nbIgnores++; continue; }
      // Rapprochement : le contrat a une commission en attente (ex. commission annuelle payée par
      // mensualités) → le montant est DÉDUIT de l'attente (versement partiel) au lieu de créer une
      // nouvelle commission ; l'attente est soldée quand le total est atteint. Pas pour un décompte OZ.
      if (!surOZ && l.imputer && l.attenteId) {
        const attente = allCommissionsAttente.find(c => c.id === l.attenteId);
        const rT = await dbPost('commission_tranches', { commission_id: l.attenteId, montant, date_reception: dateReceptionCommission, bordereau_id: nouveauBordereau.id, note: `Décompte ${compagnie} — ${l.brancheInterne || ''} (police ${l.numeroContrat}) [${l.ref}]` });
        if (rT && rT.error) { nbEchecs++; continue; }
        if (Array.isArray(rT) && rT[0]) allCommissionTranches.push(rT[0]);
        nbImputes++;
        totalImpute += montant;
        if (attente) attentesTouchees.add(attente);
        continue;
      }
      const r = await dbPost('commissions_attente', {
        client_id: l.clientId,
        contrat_id: l.contratId,
        client_nom: l.clientNomCRM,
        compagnie: nomAssureur || null,
        produit: l.brancheInterne || null,
        montant_estime: montant,
        montant_final: montant,
        detail_calcul: `Décompte compagnie importé — ${l.brancheInterne || ''}${montant < 0 ? ' (correction' + (l.noFacture ? ' facture n°' + l.noFacture : '') + ')' : ''} : base CHF ${fmtCHF(l.commissionProduction)} × ${l.taux}% — contrat ${l.numeroContrat}${l.noFacture ? ` — facture n°${l.noFacture}` : ''}${l.dateFacture ? ` du ${l.dateFacture}` : ''} [${l.ref || refLigneImport(l)}]`,
        statut: surOZ ? 'versé_oz' : 'reçue',
        bordereau_id: nouveauBordereau.id,
        nature,
        date_creation: aujourdhui,
        date_reception: dateReceptionCommission,
      });
      if (r && r.error) { nbEchecs++; continue; }
      nbCrees++;
    }
  }
  // Solde des commissions en attente touchées, une fois TOUTES les lignes imputées (une police peut
  // avoir plusieurs lignes). Tolérance : l'estimation diffère souvent de quelques centimes du montant
  // réel versé — reste ≤ CHF 1 ou ≤ 2 % de l'estimation → commission soldée au montant réellement reçu.
  for (const attente of attentesTouchees) {
    const estime = Number(attente.montant_estime || 0);
    const deja = typeof commissionDejaRecu === 'function' ? commissionDejaRecu(attente) : 0;
    if (deja > 0 && estime - deja <= Math.max(1, estime * 0.02)) {
      const rS = await dbPatch('commissions_attente', attente.id, { statut: 'reçue', montant_final: Math.round(deja * 100) / 100, bordereau_id: nouveauBordereau.id, date_reception: dateReceptionCommission });
      if (!(rS && rS.error)) { attente.statut = 'reçue'; nbSoldes++; }
    }
  }
  logAction('import_decompte_et_bordereau', 'bordereaux', nouveauBordereau.id, `${numero} — ${compagnie} — ${nbCrees} commission(s) créée(s), ${nbImputes} versement(s) déduit(s) de l'attente${surOZ ? ' — encaissé par OZ Assure' : ''}`);
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  allCommissionTranches = await dbGet('commission_tranches', 'select=*') || [];
  allBordereaux = await dbGet('bordereaux', 'select=*');
  const partiesMsg = [];
  if (nbImputes) partiesMsg.push(`${nbImputes} ligne(s) rapprochée(s) de commissions déjà en attente (CHF ${fmtCHF2(totalImpute)} déduits${nbSoldes ? `, ${nbSoldes} commission(s) désormais soldée(s)` : ', le solde reste attendu'})`);
  if (nbCrees || !nbImputes) partiesMsg.push(`${nbCrees} nouvelle(s) commission(s) ${surOZ ? 'enregistrée(s) en « Versé OZ » (hors chiffres Assurex)' : 'enregistrée(s) comme reçue(s)'}`);
  showError(`✓ Bordereau ${numero} créé : ${partiesMsg.join(' · ')}${fichierArchive ? ' — fichier archivé 📎' : ''}.${nbIgnores ? ' ' + nbIgnores + ' ligne(s) ignorée(s) car déjà importée(s) aujourd\'hui (doublon évité).' : ''}${nbEchecs ? ' ⚠️ ' + nbEchecs + ' échec(s) d’écriture — vérifie manuellement depuis le bordereau.' : ''}`);
  if (btn) { btn.disabled = false; btn.textContent = '✓ Créer les commissions et le bordereau'; }
  _decompteLignes = []; _decompteNomAssureur = ''; _decompteCommissionTotaleAnnoncee = null; _decompteFichier = null;
  navigate('bordereaux');
}

