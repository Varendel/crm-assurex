function switchTab(btn, tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['tab-identite','tab-prevoyance','tab-contrats','tab-factures','tab-rappels','tab-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });
}

// OPPORTUNITÉS
function viewOpportunites() {
  const stadeColor = { Contact:'#64748b', Analyse:'#38bdf8', Proposition:'#f59e0b', Négociation:'#a78bfa' };
  const stades = ['Contact','Analyse','Proposition','Négociation'];
  const OPPS = allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu');
  const gagnees = allOpportunites.filter(o => o.stade === 'Gagné');
  const perdues = allOpportunites.filter(o => o.stade === 'Perdu');
  const total = OPPS.reduce((s,o) => s+(o.montant_potentiel||0), 0);
  const pondere = OPPS.reduce((s,o) => s+Math.round((o.montant_potentiel||0)*(o.probabilite||0)/100), 0);

  function nomClient(o) {
    const c = allClients.find(cl => cl.id === o.client_id);
    if (c) return estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
    return o.prospect_nom ? `${o.prospect_nom} 🆕` : '—';
  }

  let kanban = stades.map(stade => {
    const opps = OPPS.filter(o => o.stade === stade);
    const color = stadeColor[stade];
    return `<div class="kanban-col">
      <div class="kanban-col-title">
        <div class="kanban-dot" style="background:${color}"></div>
        <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.8px">${stade}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-left:auto">${opps.length}</div>
      </div>
      ${opps.map(o => `<div class="kanban-card">
        <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:4px">${o.titre}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${nomClient(o)}${o.compagnie ? ' · ' + o.compagnie : ''}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;font-weight:800;color:#f59e0b">CHF ${(o.montant_potentiel||0).toLocaleString()}</span>
          ${o.apporteur_id ? avatar(agentById(o.apporteur_id), 22) : ''}
        </div>
        <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${o.probabilite||0}%;background:${color}"></div></div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:6px;display:flex;justify-content:space-between;align-items:center">
          <span>${o.probabilite||0}%</span>
          <select onchange="changerStadeOpportunite('${o.id}', this.value)" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);font-size:10px;border-radius:5px;padding:2px 4px">
            <option value="">Changer →</option>
            ${stades.filter(s => s !== stade).map(s => `<option value="${s}">${s}</option>`).join('')}
            <option value="Gagné">✓ Gagné</option>
            <option value="Perdu">✕ Perdu</option>
          </select>
        </div>
      </div>`).join('')}
      ${opps.length === 0 ? '<div class="kanban-empty">Aucune</div>' : ''}
    </div>`;
  }).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Pipeline — Opportunités</h2>
      <button class="btn-add" onclick="navigate('nouvelle-opportunite')">+ Nouvelle opportunité</button>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Suivi des affaires en négociation, avant signature. Une fois "Gagnée", l'opportunité ouvre directement le formulaire de contrat pré-rempli.</div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${statCard('Pipeline total', 'CHF ' + total.toLocaleString(), '#f59e0b')}
      ${statCard('Pondéré', 'CHF ' + pondere.toLocaleString(), '#38bdf8')}
      ${statCard('En cours', OPPS.length, '#e2e8f0')}
      ${statCard('Gagnées', gagnees.length, '#4ade80')}
    </div>
    <div class="kanban">${kanban}</div>
    ${gagnees.length > 0 ? `<div style="margin-top:24px">
      <div style="font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">✓ Gagnées (${gagnees.length})</div>
      <div class="table-wrap">${gagnees.map(o => `<div class="table-row" style="grid-template-columns:1fr 140px 100px 80px">
        <div style="font-weight:700;font-size:13px;color:var(--text)">${o.titre}</div>
        <div style="font-size:12px;color:var(--text-muted)">${nomClient(o)}</div>
        <div style="font-size:12px;font-weight:700;color:#f59e0b">CHF ${(o.montant_potentiel||0).toLocaleString()}</div>
        <div>${o.contrat_id ? badge('Contrat créé', '#4ade80') : badge('À finaliser', '#f59e0b')}</div>
      </div>`).join('')}</div>
    </div>` : ''}`;
}

async function changerStadeOpportunite(id, nouveauStade) {
  if (!nouveauStade) return;
  const opp = allOpportunites.find(o => o.id === id);
  if (!opp) return;
  const r = await dbPatch('opportunites', id, { stade: nouveauStade });
  if (r && r.error) { showError('Erreur lors du changement de stade : ' + errMsg(r)); return; }
  opp.stade = nouveauStade;

  if (nouveauStade === 'Gagné') {
    prefillOpportunite = opp;
    contratClientId = opp.client_id || null;
    navigate('nouveau-contrat');
  } else {
    navigate('opportunites');
  }
}

// SUIVI — tableau de bord du portefeuille signé (après signature, distinct du Pipeline)
function viewSuivi() {
  const produitsDistincts = [...new Set(allContrats.map(ct => ct.produit).filter(Boolean))].sort();
  const produitOptions = produitsDistincts.map(p => `<option value="${p}">${p}</option>`).join('');

  setTimeout(() => renderSuiviTables(), 0);

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
          ${statCard('Commissions en attente', 'CHF ' + Math.round(totalComm).toLocaleString(), '#4ade80', `dont CHF ${Math.round(totalCommGestion).toLocaleString()} gestion — ${commissionsEstimees.length} dossiers`)}
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
              <span style="font-weight:700;color:#f59e0b">CHF ${Number(ct.prime_annuelle||0).toLocaleString()}/an</span>
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
    <div id="su-tables"></div>`;
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

  function table(list, emptyMsg) {
    if (!list.length) return `<div class="table-empty">${emptyMsg}</div>`;
    return `<div class="table-wrap"><div class="table-header" style="grid-template-columns:${cols}"><div>Produit</div><div>Client</div><div>Compagnie</div><div>Échéance</div><div>Prime/an</div><div>Statut</div></div>
      ${list.map(ct => `<div class="table-row" style="grid-template-columns:${cols};cursor:pointer" onclick="showDetailContrat('${ct.id}')">
        <div><div style="font-weight:700;font-size:13px;color:var(--text)">${ct.produit}</div><div style="font-size:11px;color:var(--text-muted)">${ct.numero_police || ''}</div></div>
        <div style="font-size:13px;color:var(--text)">${nomClient(ct)}</div>
        <div style="font-size:13px;color:var(--text)">${ct.compagnie}</div>
        <div style="font-size:12px;color:var(--text-muted)">${fmtDate(ct.date_echeance)}</div>
        <div style="font-weight:800;color:#f59e0b">CHF ${Number(ct.prime_annuelle||0).toLocaleString()}</div>
        <div>${badge(ct.statut, ct.statut === 'actif' ? '#4ade80' : ct.statut === 'renouveler' ? '#f59e0b' : '#f87171')}${ct.commissionne === false ? ' ' + badge('Non commissionné', '#64748b') : ''}</div>
      </div>`).join('')}</div>`;
  }

  document.getElementById('su-tables').innerHTML = `
    <div style="font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">⚠ À renouveler (${aRenouveler.length})</div>
    ${table(aRenouveler, 'Aucun contrat à renouveler.')}
    <div style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:1px;margin:24px 0 10px">⏳ Échéance dans moins de 60 jours (${echeanceProche.length})</div>
    ${table(echeanceProche, 'Aucune échéance proche.')}`;
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
      <div style="font-weight:800;color:var(--text);text-align:right">CHF ${l.montant.toLocaleString()}</div>
      <div style="text-align:right">${sig ? `<div style="font-size:11px;color:${agentColor(sig)}">${sig.prenom}: CHF ${l.pJ}</div>` : ''}</div>
      <div style="text-align:right">${l.agent ? `<div style="font-size:11px;color:${agentColor(l.agent)}">${l.agent.prenom}: CHF ${l.pA}</div>` : `<div style="font-size:11px;color:var(--text-muted)">—</div>`}</div>
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
        <div style="font-weight:800;color:#f59e0b">CHF ${Math.round(f.total_montant||0).toLocaleString()}</div>
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

  logAction('generer_fiche_paie', 'fiches_paie', ficheId, `${fmtDate(debut)} → ${fmtDate(fin)} · CHF ${Math.round(totalMontant)}`);
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
      <td style="text-align:right">CHF ${montant.toLocaleString()}</td>
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
      <div class="box"><div class="l">Montant brut</div><div class="v">CHF ${(b.montant_brut||0).toLocaleString()}</div></div>
      <div class="box"><div class="l">Caution (${tauxCaution}%)</div><div class="v">CHF ${montantCaution.toLocaleString()}</div></div>
      <div class="box"><div class="l">Net après caution</div><div class="v">CHF ${montantNet.toLocaleString()}</div></div>
      <div class="box"><div class="l">Statut</div><div class="v">${b.statut === 'reçu' ? 'Reçu' : 'Attendu'}${b.date_reception ? ' le '+fmtDate(b.date_reception) : ''}</div></div>
    </div>
    <table><thead><tr><th>Client</th><th>Produit</th><th>N° police</th><th>Montant</th><th>Statut</th></tr></thead>
    <tbody>${lignesHtml || '<tr><td colspan="5">Aucune commission rapprochée</td></tr>'}</tbody></table>
    <div class="total">Part Jonathan : CHF ${pJ.toLocaleString()} · Part apporteurs : CHF ${pA.toLocaleString()}</div>
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
      <td style="text-align:right">CHF ${montant.toLocaleString()}</td>
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
    <div class="total">Total : CHF ${Math.round(totalMontant).toLocaleString()}</div>
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
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Lit directement le fichier Excel "Décompte de commission" envoyé par une compagnie (norme IG B2B — testé avec les décomptes La Vaudoise). Réconcilie automatiquement les contrats par n° de police, propose un client probable par le nom quand le contrat n'est pas trouvé, et reprend directement le taux et le montant déjà calculés par la compagnie dans le fichier.</div>

    ${sectionCard('Fichier', '#38bdf8', `
      <input type="file" id="imp-file-input" accept=".xlsx,.xls" style="display:none" onchange="analyserDecompteExcel()"/>
      <button class="btn-secondary" onclick="document.getElementById('imp-file-input').click()">📎 Choisir le fichier Excel</button>
      <span id="imp-file-nom" style="margin-left:10px;font-size:12px;color:var(--text-muted)"></span>
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
    const npReq = normPoliceNumero(numeroContrat);
    const brancheInterne = iBranche !== -1 ? (r[iBranche] || '') : '';
    const candidats = allContrats.filter(c => c.numero_police && normPoliceNumero(c.numero_police) === npReq);

    // Plusieurs contrats CRM peuvent partager le même n° de police (ex. RC + Casco saisis en 2 lignes,
    // ou un ancien contrat résilié jamais nettoyé) — on choisit celui dont le produit ressemble le plus
    // à la branche du décompte, avec un petit bonus pour un contrat encore actif à score égal.
    let contratTrouve = null;
    if (candidats.length === 1) contratTrouve = candidats[0];
    else if (candidats.length > 1) {
      const motsB = brancheInterne.toLowerCase().split(/[^a-zàâäéèêëïîôöùûüç0-9]+/).filter(w => w.length >= 4);
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

    const nomFichier = `${(r[iNom] || '').toString().trim()}${r[iPrenom] ? ' ' + r[iPrenom].toString().trim() : ''}`.trim();

    // Aucun contrat trouvé par n° de police : on tente quand même de repérer un client probable par
    // son nom (comparaison insensible à l'ordre des mots et aux accents) plutôt que de laisser une
    // ligne "Non trouvé" muette alors que le fichier donne bel et bien un nom.
    let clientSuggere = null;
    if (!clientTrouve && nomFichier) {
      const mf = motsTriesSansAccents(nomFichier);
      clientSuggere = allClients.find(c => {
        const nomComplet = estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`;
        return nomComplet.trim() && motsTriesSansAccents(nomComplet) === mf;
      }) || null;
    }

    const commissionProduction = iCommissionProd !== -1 ? (parseFloat(r[iCommissionProd]) || 0) : 0;
    const tauxFichier = iTaux !== -1 ? (parseFloat(r[iTaux]) || 0) : 0;
    const montantDetaille = iMontantDetaille !== -1 ? parseFloat(r[iMontantDetaille]) : null;
    const montantTotalCol = iMontantTotal !== -1 ? parseFloat(r[iMontantTotal]) : null;
    // Le fichier donne déjà le montant de commission par ligne (détaillé, ou total si pas de détail) —
    // on ne le recalcule depuis le taux que si aucun des deux montants n'est fourni.
    const montantFichier = (montantDetaille != null && !isNaN(montantDetaille)) ? montantDetaille
      : (montantTotalCol != null && !isNaN(montantTotalCol)) ? montantTotalCol
      : Math.round(commissionProduction * tauxFichier) / 100;

    return {
      idx: i,
      numeroContrat,
      nomVaudoise: nomFichier || '(nom non fourni par le fichier)',
      npa: iNpa !== -1 ? r[iNpa] : '', localite: iLocalite !== -1 ? r[iLocalite] : '',
      brancheInterne,
      commissionProduction,
      taux: tauxFichier,
      montant: Math.round((montantFichier || 0) * 100) / 100,
      contratId: contratTrouve ? contratTrouve.id : null,
      clientId: contratTrouve ? (clientTrouve ? clientTrouve.id : null) : (clientSuggere ? clientSuggere.id : null),
      clientNomCRM: clientTrouve ? (estEntreprise(clientTrouve) ? clientTrouve.nom : `${clientTrouve.prenom} ${clientTrouve.nom}`) : null,
      clientSuggereNom: (!clientTrouve && clientSuggere) ? (estEntreprise(clientSuggere) ? clientSuggere.nom : `${clientSuggere.prenom} ${clientSuggere.nom}`) : null,
      primeCRM: contratTrouve ? contratTrouve.prime_annuelle : null,
      ambigu: candidats.length > 1,
      selectionne: !!contratTrouve,
    };
  });

  renderImportDecompte(nomAssureur, commissionTotaleAnnoncee);
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
        Total annoncé par le fichier : CHF ${commissionTotaleAnnoncee.toLocaleString()} — total des lignes lues : CHF ${Math.round(totalFichier).toLocaleString()}
        ${Math.abs(ecartTotal) > 1 ? ` ⚠️ écart de CHF ${ecartTotal.toLocaleString()} — une ligne a probablement été mal lue, vérifie avant d'importer` : ' ✓ les lignes lues correspondent au total du fichier'}
      </div>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="color:var(--text-muted);font-size:10px;text-transform:uppercase">
          <th style="padding:6px 8px"></th>
          <th style="padding:6px 8px;text-align:left">N° contrat</th>
          <th style="padding:6px 8px;text-align:left">Client (fichier)</th>
          <th style="padding:6px 8px;text-align:left">Client CRM</th>
          <th style="padding:6px 8px;text-align:left">Branche</th>
          <th style="padding:6px 8px;text-align:right">Taux %</th>
          <th style="padding:6px 8px;text-align:right">Montant</th>
        </tr></thead>
        <tbody>${_decompteLignes.map(l => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:5px 8px"><input type="checkbox" id="imp-check-${l.idx}" ${l.selectionne ? 'checked' : ''} ${!l.contratId ? 'disabled' : ''} onchange="_decompteLignes[${l.idx}].selectionne = this.checked"/></td>
            <td style="padding:5px 8px;font-family:monospace">${l.numeroContrat}${l.ambigu ? ' <span title="Plusieurs contrats CRM partagent ce n° de police — vérifie que le bon a été choisi" style="color:#f59e0b">⚠</span>' : ''}</td>
            <td style="padding:5px 8px">${l.nomVaudoise}<div style="font-size:10px;color:var(--text-muted)">${l.npa || ''} ${l.localite || ''}</div></td>
            <td style="padding:5px 8px">${l.clientNomCRM ? l.clientNomCRM : (l.clientSuggereNom ? `<span style="color:#f59e0b">≈ ${l.clientSuggereNom}</span><div style="font-size:9.5px;color:var(--text-muted)">nom trouvé, mais pas de contrat avec ce n° de police — crée-le ou corrige la police</div>` : '<span style="color:#f87171">Non trouvé</span>')}</td>
            <td style="padding:5px 8px;color:var(--text-muted)">${l.brancheInterne}</td>
            <td style="padding:5px 8px;text-align:right">${l.taux}%</td>
            <td style="padding:5px 8px;text-align:right"><input type="number" step="0.01" value="${l.montant}" style="width:75px;background:var(--surface-alt);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:3px 5px;text-align:right" onchange="_decompteLignes[${l.idx}].montant = parseFloat(this.value)||0"/></td>
          </tr>`).join('')}</tbody>
      </table>
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:10px">Taux et montant sont repris directement du décompte compagnie (modifiable si besoin). Une ligne sans contrat CRM reconnu ne peut pas être importée automatiquement — crée le contrat manquant (ou corrige son n° de police) puis réimporte le fichier.</div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn-save" onclick="importerCommissionsDecompte('${(nomAssureur || '').replace(/'/g, "\\'")}')">✓ Créer les commissions sélectionnées</button>
      </div>
    `)}
  `;
}

async function importerCommissionsDecompte(nomAssureur) {
  const aTraiter = _decompteLignes.filter(l => l.selectionne && l.contratId);
  if (!aTraiter.length) { showError('Aucune ligne sélectionnée avec un contrat reconnu.'); return; }
  const nature = document.getElementById('imp-nature-commission')?.value || 'gestion';
  let nbCrees = 0, nbEchecs = 0;
  for (const l of aTraiter) {
    const montant = Math.round(l.montant);
    if (montant > 0) {
      const r = await dbPost('commissions_attente', {
        client_id: l.clientId,
        contrat_id: l.contratId,
        client_nom: l.clientNomCRM,
        compagnie: nomAssureur || null,
        produit: l.brancheInterne || null,
        montant_estime: montant,
        detail_calcul: `Décompte compagnie importé (Excel IG B2B) — ${l.brancheInterne || ''} : base CHF ${l.commissionProduction.toLocaleString()} × ${l.taux}% — contrat ${l.numeroContrat}`,
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

