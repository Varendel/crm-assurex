function showModalEditCommission(commId) {
  const c = allCommissionsAttente.find(x => x.id === commId);
  if (!c) return;
  const b = c.bordereau_id ? allBordereaux.find(bd => bd.id === c.bordereau_id) : null;
  const ct = c.contrat_id ? allContrats.find(x => x.id === c.contrat_id) : null;
  const cl = ct ? allClients.find(x => x.id === ct.client_id) : (c.client_id ? allClients.find(x => x.id === c.client_id) : null);
  creerModale('modal-edit-commission', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:500px">
      <h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:var(--text)">Commission — ${c.client_nom || '—'}</h3>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">${b ? `Rapprochée du bordereau ${b.numero || ''}` : "Pas encore rapprochée d'un bordereau"}</div>

      ${ct ? `<div style="background:var(--surface-alt);border-radius:10px;padding:12px 14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Contrat lié</div>
          <button type="button" onclick="document.getElementById('modal-edit-commission').remove(); showDetailContrat('${ct.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:3px 10px;font-size:10.5px;cursor:pointer;font-weight:700">Voir le contrat →</button>
        </div>
        <div style="font-size:12.5px;color:var(--text)">${ct.produit} · ${ct.compagnie}</div>
        <div style="font-size:11px;color:var(--text-muted)">Prime CHF ${Number(ct.prime_annuelle||0).toLocaleString()}/an${ct.date_debut ? ' · Signé le ' + fmtDate(ct.date_debut) : ''}${ct.numero_police ? ' · № ' + ct.numero_police : ''}</div>
      </div>` : `<div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:11.5px;color:#f87171">⚠ Aucun contrat lié à cette commission — impossible de vérifier son origine automatiquement.</div>`}

      <div class="form-field" style="margin-bottom:14px">
        <label class="form-label">Détail du calcul (visible sur la liste)</label>
        <textarea class="form-input" id="ec-detail" rows="2" placeholder="Ex : COG Swiss Life : prime 4992 × 1.20 × 6.3% = CHF 378/an">${(c.detail_calcul||'').split('[')[0].trim()}</textarea>
      </div>

      <div class="form-grid">
        <div class="form-field"><label class="form-label">Client</label><input class="form-input" id="ec-client" value="${c.client_nom || ''}"/></div>
        <div class="form-field"><label class="form-label">Compagnie</label><input class="form-input" id="ec-compagnie" value="${c.compagnie || ''}"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Produit</label><input class="form-input" id="ec-produit" value="${c.produit || ''}"/></div>
        <div class="form-field"><label class="form-label">Montant estimé (CHF)</label><input class="form-input" id="ec-montant-estime" type="number" step="0.01" value="${c.montant_estime || 0}"/></div>
        <div class="form-field"><label class="form-label">Montant final (CHF)</label><input class="form-input" id="ec-montant-final" type="number" step="0.01" value="${c.montant_final != null ? c.montant_final : ''}" placeholder="Vide si pas encore reçue"/></div>
        <div class="form-field"><label class="form-label">Date de réception</label><input class="form-input" id="ec-date-reception" type="date" value="${c.date_reception || ''}"/></div>
        <div class="form-field"><label class="form-label">N° de police</label><input class="form-input" id="ec-police" value="${c.numero_police || ''}"/></div>
        <div class="form-field"><label class="form-label">Nature</label><select class="form-select" id="ec-nature">
          <option value="acquisition" ${(c.nature||'acquisition')==='acquisition'?'selected':''}>Acquisition</option>
          <option value="gestion" ${c.nature==='gestion'?'selected':''}>Gestion</option>
        </select></div>
        <div class="form-field"><label class="form-label">Statut</label><select class="form-select" id="ec-statut">
          <option value="en_attente" ${c.statut==='en_attente'?'selected':''}>En attente</option>
          <option value="reçue" ${c.statut==='reçue'?'selected':''}>Reçue (Assurex)</option>
          <option value="extourné" ${c.statut==='extourné'?'selected':''}>↩ Extournée (contrat policé puis annulé après versement)</option>
          ${c.statut === 'annulé' ? `<option value="annulé" selected>❌ Annulé (ancien statut — passe en Extournée si le contrat a été policé, sinon remets En attente)</option>` : ''}
        </select></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="deleteCommission('${commId}')" style="background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:9px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer">🗑️ Supprimer</button>
        <button class="btn-secondary" onclick="document.getElementById('modal-edit-commission').remove()">Annuler</button>
        <button class="btn-save" onclick="saveEditCommission('${commId}')">✓ Enregistrer</button>
      </div>
    </div>`);
}

async function deleteCommission(commId) {
  const c = allCommissionsAttente.find(x => x.id === commId);
  const label = c ? `${c.client_nom} — ${c.produit}` : commId;
  if (!confirm(`Supprimer définitivement cette commission ?\n${label}\n\nCette action est irréversible.`)) return;
  const token = await getValidAccessToken() || SUPABASE_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/commissions_attente?id=eq.${commId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) { showError('Erreur lors de la suppression.'); return; }
  logAction('delete_commission', 'commissions_attente', commId, label);
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  document.getElementById('modal-edit-commission')?.remove();
  // Rerendre sans réinitialiser les filtres
  renderToutesCommissions();
}

async function saveEditCommission(commId) {
  const original = allCommissionsAttente.find(x => x.id === commId);
  const etaitDejaExtourne = original && original.statut === 'extourné';
  const nouveauStatut = document.getElementById('ec-statut').value;
  const montantFinalVal = document.getElementById('ec-montant-final').value;

  // ── Correction / retour en arrière ────────────────────────────────────────
  // Si on repasse une commission liée à un bordereau (reçue, versé, extournée...)
  // vers "En attente", c'est qu'une erreur de rapprochement doit être corrigée.
  // Le système défait alors AUTOMATIQUEMENT tout ce qui avait été fait lors du
  // rapprochement, pour ne jamais laisser de données à moitié cohérentes.
  const statutsLiesAUnBordereau = ['reçue', 'versé_oz', 'versé_cofidex', 'extourné'];
  const estUnRetourEnArriere = original && statutsLiesAUnBordereau.includes(original.statut) && nouveauStatut === 'en_attente';

  const body = {
    client_nom: document.getElementById('ec-client').value.trim(),
    compagnie: document.getElementById('ec-compagnie').value.trim(),
    produit: document.getElementById('ec-produit').value.trim(),
    montant_estime: Number(document.getElementById('ec-montant-estime').value) || 0,
    montant_final: estUnRetourEnArriere ? null : (montantFinalVal === '' ? null : Number(montantFinalVal)),
    bordereau_id: estUnRetourEnArriere ? null : (original ? original.bordereau_id : null),
    date_reception: estUnRetourEnArriere ? null : (document.getElementById('ec-date-reception').value || null),
    numero_police: document.getElementById('ec-police').value.trim() || null,
    nature: document.getElementById('ec-nature')?.value || 'acquisition',
    statut: nouveauStatut,
    detail_calcul: estUnRetourEnArriere
      ? `Rapprochement annulé le ${fmtDate(new Date().toISOString())} — remise en attente pour correction (était : ${statutCommissionLabel(original.statut)}, ${original.bordereau_id ? 'lié à un bordereau' : 'sans bordereau'})`
      : (document.getElementById('ec-detail').value.trim() || null),
  };
  const btn = document.querySelector('#modal-edit-commission .btn-save');
  if (btn) { btn.textContent = 'Enregistrement...'; btn.disabled = true; }
  const r = await dbPatch('commissions_attente', commId, body);
  if (r && r.error) { showError('Erreur: ' + errMsg(r)); if (btn) { btn.textContent = '✓ Enregistrer'; btn.disabled = false; } return; }
  logAction(estUnRetourEnArriere ? 'annuler_rapprochement_commission' : 'edit_commission', 'commissions_attente', commId, body.client_nom);

  if (estUnRetourEnArriere) {
    showError(`↺ Rapprochement annulé pour ${body.client_nom} — la commission est de nouveau "En attente", déliée du bordereau, prête à être re-rapprochée correctement.`);
  }

  // ── Passage vers "Extourné" : générer automatiquement la commission NÉGATIVE ──
  // correspondante, en attente de rapprochement (débit) sur un futur bordereau de
  // la même compagnie — exactement comme une commission normale, mais en négatif.
  if (body.statut === 'extourné' && !etaitDejaExtourne) {
    const montantOriginal = Math.abs(body.montant_final != null ? body.montant_final : (body.montant_estime || 0));
    if (montantOriginal > 0) {
      const rExtourne = await dbPost('commissions_attente', {
        client_id: original ? original.client_id : null,
        contrat_id: original ? original.contrat_id : null,
        client_nom: body.client_nom,
        compagnie: body.compagnie,
        produit: body.produit,
        montant_estime: -montantOriginal,
        detail_calcul: `↩ Reprise automatique suite à l'extourne de la commission d'origine (CHF ${montantOriginal.toLocaleString()}). À rapprocher avec la ligne de débit correspondante sur le prochain bordereau ${body.compagnie}.`,
        statut: 'en_attente',
        date_creation: new Date().toISOString().split('T')[0],
      });
      if (rExtourne && rExtourne.error) {
        showError('⚠️ Contrat extourné, mais la commission négative de reprise n\u2019a pas pu être créée : ' + errMsg(rExtourne) + ' — crée-la manuellement.');
      } else {
        showError(`✓ Commission extournée. Une commission de CHF -${montantOriginal.toLocaleString()} a été créée en attente pour ${body.compagnie} — rapproche-la avec "+ Rapprocher une commission" quand le bordereau de reprise arrive.`);
      }
    }
  }

  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  document.getElementById('modal-edit-commission').remove();
  // Rerendre sans réinitialiser les filtres — les sélections restent actives
  renderToutesCommissions();
}

function viewCommissionsAttente(prefiltreStatut) {
  window._tcPrefiltre = prefiltreStatut || null;
  setTimeout(() => renderToutesCommissions(), 0);
  return `
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:800;color:var(--text)">Toutes les commissions</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Estimées à la signature, puis liées à un bordereau une fois reçues. Pour faire passer une commission "en attente" en "reçue", utilise "+ Rapprocher une commission" sur le bordereau concerné — ça garantit le montant net exact et le numéro de police.</div>

    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
      <input class="form-input" id="tc-search" placeholder="🔍 Client, compagnie, produit, n° bordereau..." style="flex:1;min-width:200px" oninput="renderToutesCommissions()"/>
      <select class="form-select" id="tc-statut" style="max-width:180px" onchange="renderToutesCommissions()">
        <option value="">Tous statuts</option>
        <option value="en_attente" ${prefiltreStatut==='en_attente'?'selected':''}>En attente</option>
        <option value="reçue" ${prefiltreStatut==='reçue'?'selected':''}>Reçue (Assurex)</option>
        <option value="extourné">Extournée</option>
      </select>
      <select class="form-select" id="tc-nature" style="max-width:170px" onchange="renderToutesCommissions()">
        <option value="">Acquisition + Gestion</option>
        <option value="acquisition">Acquisition uniquement</option>
        <option value="gestion">Gestion uniquement</option>
      </select>
      <select class="form-select" id="tc-tri" style="max-width:190px" onchange="renderToutesCommissions()">
        <option value="date">Plus récent d'abord</option>
        <option value="montant_desc" selected>Montant décroissant</option>
      </select>
    </div>

    <div id="tc-stats" class="stat-grid" style="margin-bottom:20px"></div>
    <div id="tc-table"></div>`;
}

function renderToutesCommissions() {
  const search = (document.getElementById('tc-search')?.value || '').toLowerCase().trim();
  const statutFilter = document.getElementById('tc-statut')?.value || '';
  const natureFilter = document.getElementById('tc-nature')?.value || '';
  const tri = document.getElementById('tc-tri')?.value || 'montant_desc';

  function numeroBordereauDe(c) {
    if (!c.bordereau_id) return '';
    const b = allBordereaux.find(bd => bd.id === c.bordereau_id);
    return b ? (b.numero || '') : '';
  }
  function montantC(c) { return c.montant_final != null ? c.montant_final : (c.montant_estime || 0); }

  const filtered = allCommissionsAttente.filter(c => {
    // Cette page ne montre QUE les données Assurex — le passé OZ Assure a sa propre page dédiée
    if (c.statut === 'versé_oz') return false;
    // Exclure les commissions liées à un contrat marqué "non commissionné" ou "annulé"
    // (un contrat annulé n'a jamais réellement pris effet — aucune commission n'a de sens ici,
    // à la différence d'"extourné" qui représente un contrat policé puis repris)
    if (c.contrat_id) {
      const ct = allContrats.find(x => x.id === c.contrat_id);
      if (ct && (ct.commissionne === false || ct.statut === 'annulé')) return false;
    }
    if (statutFilter && c.statut !== statutFilter) return false;
    if (natureFilter && (c.nature || 'acquisition') !== natureFilter) return false;
    if (search) {
      const haystack = `${c.client_nom||''} ${c.compagnie||''} ${c.produit||''} ${numeroBordereauDe(c)}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }).sort((a,b) => {
    if (tri === 'montant_desc') return montantC(b) - montantC(a);
    return new Date(b.date_creation||0) - new Date(a.date_creation||0);
  });

  const totalAttente = filtered.filter(c => c.statut === 'en_attente').reduce((s,c) => s + montantC(c), 0);
  const totalRecuBrut = filtered.filter(c => c.statut === 'reçue').reduce((s,c) => s + montantC(c), 0);
  const totalExtourne = filtered.filter(c => c.statut === 'extourné').reduce((s,c) => s + montantC(c), 0);
  const totalRecuNet = totalRecuBrut - totalExtourne;
  const totalAcquisition = filtered.filter(c => (c.nature||'acquisition') === 'acquisition' && c.statut !== 'extourné').reduce((s,c) => s + montantC(c), 0);
  const totalGestion = filtered.filter(c => c.nature === 'gestion' && c.statut !== 'extourné').reduce((s,c) => s + montantC(c), 0);

  document.getElementById('tc-stats').innerHTML = `
    ${statCard('En attente', 'CHF ' + totalAttente.toLocaleString(), '#f59e0b')}
    ${statCard('Reçues (brut)', 'CHF ' + totalRecuBrut.toLocaleString(), '#4ade80')}
    ${statCard('Extournées', '– CHF ' + totalExtourne.toLocaleString(), '#f87171', 'contrat policé puis annulé')}
    ${statCard('Net Assurex encaissé', 'CHF ' + totalRecuNet.toLocaleString(), '#38bdf8')}
    ${statCard('Dont Acquisition', 'CHF ' + totalAcquisition.toLocaleString(), '#a78bfa')}
    ${statCard('Dont Gestion', 'CHF ' + totalGestion.toLocaleString(), '#60a5fa')}
    ${statCard('Total dossiers', filtered.length, '#a78bfa')}`;

  const cols = '1fr 120px 110px 110px 100px 90px';
  const rows = filtered.map(c => {
    const numBord = numeroBordereauDe(c);
    return `<div class="table-row" style="grid-template-columns:${cols};cursor:pointer" onclick="showModalEditCommission('${c.id}')">
      <div><div style="font-size:13px;font-weight:700;color:var(--text)">${c.client_id ? `<span onclick="event.stopPropagation(); showClient('${c.client_id}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted">${c.client_nom || '—'}</span>` : (c.client_nom || '—')}${getClientMiniLogos(allClients.find(x => x.id === c.client_id))}</div><div style="font-size:11px;color:var(--text-muted)">${c.produit || ''}</div>${c.detail_calcul ? `<div style="font-size:10px;color:var(--text-dim);margin-top:2px;font-style:italic">${c.detail_calcul.split('[')[0].trim()}</div>` : `<div style="font-size:10px;color:#f59e0b;margin-top:2px">⚠ Détail du calcul manquant — clique pour préciser</div>`}</div>
      <div style="font-size:12px;color:var(--text-muted)">${c.compagnie || ''}</div>
      <div style="font-size:11px;color:var(--text-muted)">${numBord ? `<span style="font-family:monospace">${numBord}</span>` : '—'}</div>
      <div style="font-size:12px;color:var(--text-muted)">${c.date_creation || ''}</div>
      <div style="font-weight:800;color:#f59e0b;text-align:right">CHF ${montantC(c).toLocaleString()}</div>
      <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">${badge(statutCommissionLabel(c.statut), statutCommissionColor(c.statut))}${badge(c.nature === 'gestion' ? 'Gestion' : 'Acquisition', c.nature === 'gestion' ? '#60a5fa' : '#a78bfa')}</div>
    </div>`;
  }).join('');

  document.getElementById('tc-table').innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}"><div>Client / Produit</div><div>Compagnie</div><div>N° bordereau</div><div>Créée le</div><div>Montant</div><div>Statut</div></div>
      ${rows || '<div class="table-empty">Aucune commission ne correspond à ces filtres.</div>'}
    </div>`;
}

// AGENDA
function viewAgenda() {
  const isConnected = msalAccessToken !== null;

  if (!isConnected) {
    return `
      <h2 style="margin:0 0 18px;font-size:18px;font-weight:800;color:var(--text)">Agenda</h2>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:40px;text-align:center">
        <div style="font-size:36px;margin-bottom:12px">📅</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">Agenda Outlook non connecté</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;max-width:380px;margin-left:auto;margin-right:auto">
          Connecte ton compte Outlook pour afficher tes rendez-vous et synchroniser tes rappels.
        </div>
        <button class="btn-add" onclick="loginMicrosoft()">
          <svg width="14" height="14" viewBox="0 0 21 21" style="vertical-align:-2px;margin-right:6px"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
          Connecter Outlook
        </button>
      </div>`;
  }

  if (calendarEvents.length === 0) {
    refreshAgenda();
    return `
      <h2 style="margin:0 0 18px;font-size:18px;font-weight:800;color:var(--text)">Agenda</h2>
      <div class="loader">Chargement des événements Outlook...</div>`;
  }

  const grouped = {};
  calendarEvents.forEach(ev => {
    const d = new Date(ev.start.dateTime).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(ev);
  });

  const days = Object.keys(grouped).map(day => {
    const events = grouped[day].map(ev => {
      const start = new Date(ev.start.dateTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
      const end = new Date(ev.end.dateTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
      return `<div style="display:flex;gap:14px;padding:11px 18px;border-bottom:1px solid var(--border)">
        <div style="font-size:12px;color:var(--accent);font-weight:700;min-width:90px">${start} - ${end}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${ev.subject || 'Sans titre'}</div>
          ${ev.location && ev.location.displayName ? `<div style="font-size:11px;color:var(--text-muted)">${ev.location.displayName}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${day}</div>
      <div class="table-wrap">${events}</div>
    </div>`;
  }).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Agenda — ${currentUser.email}</h2>
      <button class="btn-secondary" onclick="refreshAgenda()">↻ Actualiser</button>
    </div>
    ${days || '<div class="table-empty">Aucun événement à venir.</div>'}`;
}

// ═══ CAMPAGNES ═══
const CAMPAGNES_THEMES = [
  {
    id: 'prevoyance',
    titre: 'Prévoyance — Pilier 3a',
    periode: 'Recommandé février - mai (avant clôture fiscale)',
    icon: '🛡️',
    color: '#38bdf8',
    segment: 'Privé',
    filtre: c => !c.pilier3a,
    sujet: 'Optimisez votre fiscalité 2026 avec le 3e pilier',
    corps: `Bonjour {prenom},

J'espère que vous allez bien. Je me permets de vous contacter car la période est idéale pour faire le point sur votre prévoyance.

Avec le 3e pilier (pilier 3a), vous pouvez non seulement préparer votre retraite, mais aussi réduire votre charge fiscale de manière significative cette année — le plafond légal 2026 est de CHF 7'056.- pour les salariés.

Auriez-vous 15 minutes pour qu'on regarde ensemble ce qui correspondrait le mieux à votre situation ?

Bien cordialement,
Jonathan Özkan
Assurex Sàrl`
  },
  {
    id: 'sante',
    titre: 'Complémentaire santé',
    periode: 'Toute l\'année, idéal avant fin d\'année (changement de caisse)',
    icon: '⚕️',
    color: '#4ade80',
    segment: 'Privé',
    filtre: c => !c.lpp_actuel,
    sujet: 'Faisons le point sur votre couverture santé',
    corps: `Bonjour {prenom},

Avec la hausse récurrente des primes d'assurance de base, c'est souvent le bon moment pour vérifier que votre couverture complémentaire correspond toujours à vos besoins réels (et à votre budget).

Je vous propose un comparatif gratuit et sans engagement de votre situation actuelle — ça ne prend que quelques minutes et peut représenter une économie non négligeable sur l'année.

Souhaitez-vous qu'on en discute cette semaine ?

Bien cordialement,
Jonathan Özkan
Assurex Sàrl`
  },
];

function viewCampagnes() {
  const cards = CAMPAGNES_THEMES.map(t => {
    const cibles = allClients.filter(c => (c.segment || 'Privé') === t.segment && t.filtre(c));
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor='${t.color}'" onmouseout="this.style.borderColor='var(--border)'" onclick="showCampagne('${t.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="font-size:28px">${t.icon}</div>
        <div style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55;border-radius:7px;padding:3px 10px;font-size:11px;font-weight:700">${t.segment}</div>
      </div>
      <div style="font-size:15px;font-weight:800;color:var(--text);margin-top:12px">${t.titre}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${t.periode}</div>
      <div style="margin-top:14px;font-size:13px;font-weight:700;color:${t.color}">${cibles.length} client${cibles.length !== 1 ? 's' : ''} ciblé${cibles.length !== 1 ? 's' : ''} →</div>
    </div>`;
  }).join('');

  return `
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:800;color:var(--text)">Campagnes</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Sélectionnez un thème pour voir les clients ciblés et générer vos emails personnalisés.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">${cards}</div>`;
}

function showCampagne(themeId) {
  const t = CAMPAGNES_THEMES.find(x => x.id === themeId);
  if (!t) return;
  const etatPrecedent = capturerEtatActuel();
  if (!(etatPrecedent.type === 'campagne' && etatPrecedent.id === themeId)) navHistory.push(etatPrecedent);
  vueDetailActive = { type: 'campagne', id: themeId };
  currentCampagneId = themeId;
  currentView = 'campagne-detail';
  const main = document.getElementById('main-content');
  const cibles = allClients.filter(c => (c.segment || 'Privé') === t.segment && t.filtre(c));

  const rows = cibles.map(c => {
    const mailtoSujet = encodeURIComponent(t.sujet);
    const mailtoCorps = encodeURIComponent(t.corps.replace(/{prenom}/g, c.prenom || ''));
    const mailtoHref = `mailto:${c.email || ''}?subject=${mailtoSujet}&body=${mailtoCorps}`;
    return `<tr>
      <td style="padding:10px 14px;font-size:13px;font-weight:700;color:var(--text)">${estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`}</td>
      <td style="padding:10px 14px;font-size:12px;color:var(--text-muted)">${c.email || '—'}</td>
      <td style="padding:10px 14px;font-size:12px;color:var(--text-muted)">${c.mobile || c.tel || '—'}</td>
      <td style="padding:10px 14px;text-align:right">
        ${c.email ? `<a href="${mailtoHref}" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55;border-radius:7px;padding:6px 14px;font-size:11px;font-weight:700;text-decoration:none">✉️ Ouvrir le mail</a>` : '<span style="font-size:11px;color:var(--text-muted)">Pas d\'email</span>'}
      </td>
    </tr>`;
  }).join('');

  const corpsApercu = t.corps.replace(/{prenom}/g, '[Prénom]').replace(/\n/g, '<br>');

  main.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
      <div style="font-size:32px">${t.icon}</div>
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">${t.titre}</h2>
        <div style="font-size:12px;color:var(--text-muted)">${t.periode} · ${cibles.length} client${cibles.length !== 1 ? 's' : ''} ciblé${cibles.length !== 1 ? 's' : ''}</div>
      </div>
    </div>

    ${sectionCard('Aperçu du message', t.color, `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Objet : <strong style="color:var(--text)">${t.sujet}</strong></div>
      <div style="background:var(--surface-alt);border-radius:8px;padding:14px;font-size:12px;color:var(--text);line-height:1.6;white-space:pre-line">${corpsApercu}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:10px">Le prénom de chaque client sera automatiquement inséré à la place de [Prénom].</div>
    `)}

    <div style="margin-top:18px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">Clients ciblés</div>
      <div class="table-wrap">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:8px 14px;font-size:11px;color:var(--text-muted);text-transform:uppercase">Client</th>
            <th style="text-align:left;padding:8px 14px;font-size:11px;color:var(--text-muted);text-transform:uppercase">Email</th>
            <th style="text-align:left;padding:8px 14px;font-size:11px;color:var(--text-muted);text-transform:uppercase">Téléphone</th>
            <th></th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="table-empty">Aucun client ne correspond à ce filtre actuellement.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  insertBackBar({ homeId: 'campagnes', homeLabel: 'Campagnes', itemLabel: t.titre });
}

// AGENTS
let editingAgentId = null;

// ═══ JOURNAL D'AUDIT ═══
const ACTION_LABELS = {
  login: '🔓 Connexion',
  logout: '🔒 Déconnexion',
  view_client: '👁 Consultation fiche client',
  edit_client: '✏️ Modification fiche client',
  add_collaborateur_avs: '🆔 Ajout collaborateur (AVS)',
  create_contrat: '📄 Création contrat',
  edit_contrat: '✏️ Modification contrat',
};

// ═══ OZ ASSURE — ARCHIVE COMMISSIONS HISTORIQUES ═══
// ═══ RECENSEMENT FINMA OFFICIEL (OZ Assure) — basé sur le vrai formulaire FINMA ═══
// Catégories exactes du chapitre 3.2/3.5 du recensement annuel FINMA (art. 190b OS)
// Important : Assurance Maladie (Lamal) est EXCLUE du recensement (hors périmètre LSA)
function classifyFinmaCategorie(produit) {
  const p = (produit || '').toLowerCase();
  if (p.includes('lamal')) return 'exclu_lamal';
  if (p.includes('complémentaire') && p.includes('maladie')) return 'maladie_complementaire';
  if ((p.includes('vie') && (p.includes('3a') || p.includes('3b')))) return 'vie_3a_3b';
  if (p.includes('vie')) return 'autres_vie_lsa';
  if (p.includes('laa') || p.includes('ijm') || p.includes('perte de gain')) return 'ijm_laac';
  return 'autres_lsa';
}

function isClientCommercialHeuristic(nom, titre) {
  if (titre && /madame|monsieur|mme|m\./i.test(titre)) return false;
  if (!nom) return false;
  return /\b(sa|sàrl|gmbh|ag|sc|sci|holding)\b\.?$/i.test(nom.trim()) || !titre;
}

async function viewRapportFinmaOz() {
  if (!currentUser || currentUser.role !== 'signataire') {
    return `<div class="table-empty">Accès réservé.</div>`;
  }
  const [contrats, commRows] = await Promise.all([
    dbGet('contrats_oz', 'select=*'),
    dbGet('commissions_oz', 'select=*'),
  ]);
  const annee = new Date().getFullYear() - 1; // exercice = année précédente, comme le vrai recensement

  // ── 3.2 / 3.3 : polices et clients (privés vs commerciaux), hors LAMal ──
  const clientsSegment = {}; // nom -> 'prive'|'commercial'
  (contrats || []).forEach(c => {
    if (!clientsSegment[c.client_nom]) {
      clientsSegment[c.client_nom] = isClientCommercialHeuristic(c.client_nom, c.titre_client) ? 'commercial' : 'prive';
    }
  });
  const nbClientsPrive = Object.values(clientsSegment).filter(s => s === 'prive').length;
  const nbClientsCommercial = Object.values(clientsSegment).filter(s => s === 'commercial').length;

  const policesPrive = { maladie_complementaire: 0, vie_3a_3b: 0, autres_vie_lsa: 0, autres_lsa: 0 };
  const policesCommercial = { ijm_laac: 0, autres_lsa: 0 };
  (contrats || []).forEach(c => {
    const cat = classifyFinmaCategorie(c.produit);
    if (cat === 'exclu_lamal') return;
    const seg = clientsSegment[c.client_nom];
    if (seg === 'commercial') {
      if (cat === 'ijm_laac') policesCommercial.ijm_laac++;
      else policesCommercial.autres_lsa++;
    } else {
      if (cat in policesPrive) policesPrive[cat]++;
      else policesPrive.autres_lsa++;
    }
  });

  // ── 3.5 : rémunérations par compagnie / catégorie / type (acquisition vs gestion) ──
  const remuneration = {}; // compagnie -> { categorie -> { acquisition, gestion } }
  (commRows || []).forEach(r => {
    const cat = classifyFinmaCategorie(r.produit);
    if (cat === 'exclu_lamal') return;
    const net = Number(r.credit||0) - Number(r.debit||0);
    const isGestion = (r.type_mouvement || '').toLowerCase().includes('gestion');
    if (!remuneration[r.compagnie]) remuneration[r.compagnie] = {};
    if (!remuneration[r.compagnie][cat]) remuneration[r.compagnie][cat] = { acquisition: 0, gestion: 0 };
    remuneration[r.compagnie][cat][isGestion ? 'gestion' : 'acquisition'] += net;
  });

  const CAT_LABELS = {
    maladie_complementaire: 'Assurance-maladie complémentaire',
    vie_3a_3b: 'Assurance-vie 3a et 3b',
    autres_vie_lsa: 'Autres assurances-vie (soumises à la LSA)',
    ijm_laac: 'IJM/LAA-C',
    autres_lsa: 'Autres assurances (soumises à la LSA)',
  };

  function chf(v) { return 'CHF ' + Math.round(v).toLocaleString('fr-CH'); }

  window._finmaOzData = { policesPrive, policesCommercial, nbClientsPrive, nbClientsCommercial, remuneration, annee };

  return `
    <button onclick="navigate('oz-assure')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour OZ Assure</button>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Recensement FINMA — Exercice ${annee}</h2>
      <button onclick="exportFinmaOzTxt()" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 16px;color:var(--text);font-size:12px;font-weight:700;cursor:pointer">⬇ Export TXT (question par question)</button>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">Calculé automatiquement selon la structure du recensement annuel FINMA (art. 190b OS) — à transcrire sur la plateforme EHP. LAMal est exclue du périmètre, conformément au formulaire officiel.</div>

    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:var(--text)">
      ⚠ La distinction client privé/commercial est déduite automatiquement du nom et du titre — vérifie chaque cas avant transmission. Les sections 2, 3.4, 4 et 5 du formulaire (déclarations, adresses, confirmations) ne sont pas calculables depuis les données du CRM — utilise l'export TXT comme aide-mémoire pour les répondre directement sur le site FINMA.
    </div>

    <div style="font-size:13px;font-weight:800;color:var(--text);margin:18px 0 10px">3.3 — Nombre de clients gérés</div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${statCard('Clients privés', nbClientsPrive, '#38bdf8')}
      ${statCard('Clients commerciaux', nbClientsCommercial, '#f59e0b')}
    </div>

    <div style="font-size:13px;font-weight:800;color:var(--text);margin:18px 0 10px">3.2 — Polices intermédiées (hors LAMal)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px">
        <div style="font-size:11px;font-weight:700;color:#38bdf8;text-transform:uppercase;margin-bottom:10px">Clients privés</div>
        ${Object.entries(policesPrive).map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${CAT_LABELS[k]}</span><span style="font-weight:800;color:var(--text)">${v}</span></div>`).join('')}
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px">
        <div style="font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;margin-bottom:10px">Clients commerciaux</div>
        ${Object.entries(policesCommercial).map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${CAT_LABELS[k]}</span><span style="font-weight:800;color:var(--text)">${v}</span></div>`).join('')}
      </div>
    </div>

    <div style="font-size:13px;font-weight:800;color:var(--text);margin:18px 0 10px">3.5 — Rémunérations par compagnie</div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px">
      ${Object.entries(remuneration).map(([compagnie, cats]) => `
        <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
          <div style="font-size:13px;font-weight:800;color:var(--accent);margin-bottom:8px">${compagnie}</div>
          <table style="width:100%;font-size:11.5px;border-collapse:collapse">
            <thead><tr style="color:var(--text-muted)"><th style="text-align:left;padding:3px 6px">Catégorie</th><th style="text-align:right;padding:3px 6px">Souscription</th><th style="text-align:right;padding:3px 6px">Portefeuille</th></tr></thead>
            <tbody>${Object.entries(cats).map(([cat, v]) => `<tr><td style="padding:3px 6px;color:var(--text)">${CAT_LABELS[cat]}</td><td style="text-align:right;padding:3px 6px;color:#f59e0b;font-weight:700">${chf(v.acquisition)}</td><td style="text-align:right;padding:3px 6px;color:#4ade80;font-weight:700">${chf(v.gestion)}</td></tr>`).join('')}</tbody>
          </table>
        </div>`).join('') || '<div class="table-empty">Aucune donnée de commission.</div>'}
    </div>`;
}

function exportFinmaOzTxt() {
  const d = window._finmaOzData;
  if (!d) return;
  const CAT_LABELS = {
    maladie_complementaire: 'Assurance-maladie complémentaire',
    vie_3a_3b: 'Assurance-vie 3a et 3b',
    autres_vie_lsa: 'Autres assurances-vie (soumises à la LSA)',
    ijm_laac: 'IJM/LAA-C',
    autres_lsa: 'Autres assurances (soumises à la LSA)',
  };
  let t = `RECENSEMENT FINMA — EXERCICE ${d.annee}\nOZ Assure — Aide-mémoire question par question pour saisie sur EHP\n${'='.repeat(70)}\n\n`;

  t += `1. INFORMATIONS SUR LE RECENSEMENT\n(Pas de saisie requise — section informative)\n\n`;

  t += `2. PLATES-FORMES OU SUPPORTS ÉLECTRONIQUES\nQ: Utilisez-vous des plateformes/moyens électroniques pour l'intermédiation ?\nR: [À répondre — l'an dernier : Oui, "Progest SA Novoo"]\n\n`;

  t += `3.1 NOMBRE DE PERSONNES ACTIVES\nQ: Nombre d'intermédiaires actifs pour la société ?\nR: [À compléter — l'an dernier : 2]\nQ: Nombre de personnes actives non-intermédiaires ?\nR: [À compléter — l'an dernier : 0]\n\n`;

  t += `3.2 NOMBRE DE POLICES INTERMÉDIÉES (hors LAMal — calculé automatiquement)\n-- Clients privés --\n`;
  Object.entries(d.policesPrive).forEach(([k,v]) => t += `${CAT_LABELS[k]}: ${v}\n`);
  t += `-- Clients commerciaux --\n`;
  Object.entries(d.policesCommercial).forEach(([k,v]) => t += `${CAT_LABELS[k]}: ${v}\n`);
  t += `\n`;

  t += `3.3 NOMBRE DE CLIENTS GÉRÉS (calculé automatiquement)\nClients privés: ${d.nbClientsPrive}\nClients commerciaux: ${d.nbClientsCommercial}\n\n`;

  t += `3.4 CANAUX DE L'ACTIVITÉ D'INTERMÉDIAIRE\nQ: % polices via plateforme électronique ?\nR: [À compléter — l'an dernier : 0%]\nQ: % polices en contact direct avec le client ?\nR: [À compléter — l'an dernier : 100%]\nQ: % polices via sous-intermédiaires ?\nR: [À compléter — l'an dernier : 0%]\nQ: Agissez-vous comme sous-intermédiaire pour un tiers ?\nR: [À compléter — l'an dernier : Oui, AXA Agence partenaire des Gouttes]\nQ: D'autres sociétés agissent-elles comme sous-intermédiaires pour vous ?\nR: [À compléter — l'an dernier : Non]\n\n`;

  t += `3.4.2 AUTRES PARTENAIRES DE COLLABORATION\nQ: Collaboration avec des entreprises tierces (apporteurs d'adresse) ?\nR: [À compléter — l'an dernier : Non]\nQ: Collaboration avec des personnes physiques tierces ?\nR: [À compléter — l'an dernier : Non]\n\n`;

  t += `3.5 RÉMUNÉRATIONS PAR COMPAGNIE (calculé automatiquement, montants nets)\n`;
  Object.entries(d.remuneration).forEach(([compagnie, cats]) => {
    t += `\n-- ${compagnie} --\n`;
    Object.entries(cats).forEach(([cat, v]) => {
      t += `  ${CAT_LABELS[cat]}: Souscription CHF ${v.acquisition.toFixed(2)} / Portefeuille CHF ${v.gestion.toFixed(2)}\n`;
    });
  });
  t += `\n3.5.1 HONORAIRES\nQ: Avez-vous reçu des honoraires directement de preneurs d'assurance ?\nR: [À compléter — l'an dernier : Non]\n\n`;

  t += `4. ACTUALITÉ ET EXACTITUDE DE L'INSCRIPTION\nQ: Adresse de notification postale toujours exacte ?\nR: [À vérifier sur le portail EHP]\nQ: Adresse électronique de correspondance toujours exacte ?\nR: [À vérifier — l'an dernier : jozkan@oz-assure.ch]\nQ: Adresse électronique de réception des factures toujours exacte ?\nR: [À vérifier — l'an dernier : jozkan@oz-assure.ch]\nQ: Les personnes inscrites au registre travaillent-elles toujours pour vous ?\nR: [À compléter]\n\n`;

  t += `4.5 / 4.6 EXIGENCES RÉGLEMENTAIRES\nQ: Toutes les personnes agissant comme intermédiaires sont-elles enregistrées à la FINMA ?\nR: [À compléter — l'an dernier : Oui]\nQ: Les personnes non enregistrées agissent-elles uniquement en formation accompagnée ?\nR: [À compléter — l'an dernier : Oui]\nQ: Les sous-intermédiaires éventuels sont-ils bien enregistrés (contrôles en place) ?\nR: [À compléter — l'an dernier : Oui]\n\n`;

  t += `5. CONFIRMATION\n[ ] Je confirme l'exactitude et l'exhaustivité des informations\n[ ] J'ai vérifié la saisie et soumis le recensement (statut "Remis à la FINMA")\n`;

  downloadBlob(t, `recensement_finma_oz_${d.annee}.txt`, 'text/plain;charset=utf-8');
}

// ═══ Commissions Assurex historiquement versées à OZ Assure — visible uniquement Jonathan ═══
function viewOzCommissionsAssurex() {
  if (!currentUser || currentUser.role !== 'signataire') {
    return `<div class="table-empty">Accès réservé.</div>`;
  }
  const lignes = allCommissionsAttente.filter(c => c.statut === 'versé_oz');
  const total = lignes.reduce((s,c) => s + Number(c.montant_final != null ? c.montant_final : (c.montant_estime||0)), 0);

  return `
    <button onclick="navigate('oz-assure')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour OZ Assure</button>
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">Commissions Assurex versées à OZ Assure</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Historique privé : commissions gérées dans le CRM mais réglées directement sur le compte OZ Assure (portefeuille pré-fusion). Ces montants n'apparaissent plus dans "Toutes les commissions" ni dans les statistiques Assurex — cette page est visible uniquement par toi.</div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${statCard('Dossiers', lignes.length, '#38bdf8')}
      ${statCard('Total versé à OZ', 'CHF ' + Math.round(total).toLocaleString(), '#1a56db')}
    </div>
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:1fr 130px 110px 90px"><div>Client / Produit</div><div>Compagnie</div><div>Montant</div><div></div></div>
      ${lignes.map(c => `<div class="table-row" style="grid-template-columns:1fr 130px 110px 90px">
        <div><div style="font-size:13px;font-weight:700;color:var(--text)">${c.client_nom||'—'}</div><div style="font-size:11px;color:var(--text-muted)">${c.produit||''}</div></div>
        <div style="font-size:12px;color:var(--text-muted)">${c.compagnie||''}</div>
        <div style="font-weight:800;color:#1a56db">CHF ${Number(c.montant_final != null ? c.montant_final : (c.montant_estime||0)).toLocaleString()}</div>
        <div><button onclick="showModalEditCommission('${c.id}')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer">✏️</button></div>
      </div>`).join('') || '<div class="table-empty">Aucune commission versée à OZ Assure enregistrée.</div>'}
    </div>`;
}

async function viewOzAssure() {
  if (!currentUser || currentUser.role !== 'signataire') {
    return `<div class="table-empty">Accès réservé.</div>`;
  }
  const [commRows, contratRows] = await Promise.all([
    dbGet('commissions_oz', 'select=*&order=date_mouvement.asc'),
    dbGet('contrats_oz', 'select=*&order=client_nom.asc'),
  ]);
  const data = commRows || [];
  const contrats = contratRows || [];

  function chf(v) { return 'CHF ' + Math.round(v).toLocaleString('fr-CH'); }
  function dch(v) { return v ? new Date(v).toLocaleDateString('fr-CH') : '—'; }
  const PALETTE = ['#38bdf8','#f59e0b','#a78bfa','#4ade80','#f87171','#fb923c','#22d3ee','#e879f9','#64748b'];
  const today = new Date();

  // ── Commissions ──
  const parAnnee = {};
  const parCompagnie = {};
  const parMois = {};
  const parClientComm = {};
  const parProduitComm = {};
  let totalVieComm = 0, totalNonVieComm = 0;
  let totalDebit = 0, totalCredit = 0;

  data.forEach(r => {
    const date = r.date_mouvement || '';
    const annee = date.slice(0, 4);
    const mois = date.slice(0, 7);
    const net = Number(r.credit || 0) - Number(r.debit || 0);
    parAnnee[annee] = (parAnnee[annee] || 0) + net;
    parCompagnie[r.compagnie] = (parCompagnie[r.compagnie] || 0) + net;
    parMois[mois] = (parMois[mois] || 0) + net;
    if (r.client_nom && r.client_nom !== '-') parClientComm[r.client_nom] = (parClientComm[r.client_nom] || 0) + net;
    const catLabel = (r.produit || 'Autre').trim();
    parProduitComm[catLabel] = (parProduitComm[catLabel] || 0) + net;
    const isVie = PRODUITS_VIE_KEYWORDS.some(kw => (r.produit||'').toLowerCase().includes(kw));
    if (isVie) totalVieComm += net; else totalNonVieComm += net;
    totalDebit += Number(r.debit || 0);
    totalCredit += Number(r.credit || 0);
  });

  const totalNet = totalCredit - totalDebit;
  const annees = Object.keys(parAnnee).sort();
  const compagnies = Object.entries(parCompagnie).sort((a,b) => b[1]-a[1]);
  const produitsComm = Object.entries(parProduitComm).sort((a,b) => b[1]-a[1]);
  const mois = Object.keys(parMois).sort();
  const nbClientsComm = Object.keys(parClientComm).length;
  const moyenneMensuelle = mois.length ? totalNet / mois.length : 0;

  // ── Contrats / Volume de primes ──
  const contratsActifs = contrats.filter(c => !c.date_fin || new Date(c.date_fin) >= today);
  const volumeTotal = contrats.reduce((s,c) => s + Number(c.prime_annuelle||0), 0);
  const volumeActif = contratsActifs.reduce((s,c) => s + Number(c.prime_annuelle||0), 0);
  const sansPrimeAnnuelle = contrats.filter(c => Number(c.prime_annuelle||0) === 0 && Number(c.prime||0) > 0).length;

  // ── Segmentation du volume de primes par type de produit (actifs uniquement) ──
  const parProduitPrime = {};
  const parProduitPrimeVie = {}, parProduitPrimeNonVie = {};
  let volumeVie = 0, volumeNonVie = 0;
  contratsActifs.forEach(c => {
    const prime = Number(c.prime_annuelle||0);
    if (!prime) return;
    const catLabel = (c.produit || 'Autre').trim();
    parProduitPrime[catLabel] = (parProduitPrime[catLabel] || 0) + prime;
    const isVie = PRODUITS_VIE_KEYWORDS.some(kw => (c.produit||'').toLowerCase().includes(kw));
    if (isVie) { volumeVie += prime; parProduitPrimeVie[catLabel] = (parProduitPrimeVie[catLabel]||0) + prime; }
    else { volumeNonVie += prime; parProduitPrimeNonVie[catLabel] = (parProduitPrimeNonVie[catLabel]||0) + prime; }
  });
  const produitsPrime = Object.entries(parProduitPrime).sort((a,b) => b[1]-a[1]);
  const maxProduitPrime = produitsPrime.length ? produitsPrime[0][1] : 1;

  function ozDetailHtml(obj, segTotal, color) {
    const items = Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, 5);
    if (!items.length) return '';
    return `<div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px">
      ${items.map(([label, val]) => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:11px;margin-bottom:5px">
          <div style="color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%">${label}</div>
          <div style="color:${color};font-weight:700;white-space:nowrap">${Math.round(val).toLocaleString('fr-CH')} CHF · ${segTotal>0?Math.round(val/segTotal*100):0}%</div>
        </div>`).join('')}
    </div>`;
  }

  // ── Données clients (agrégées depuis contrats_oz) ──
  const clientsMap = {};
  contrats.forEach(c => {
    const key = c.client_nom || '—';
    if (!clientsMap[key]) clientsMap[key] = {
      nom: key, titre: c.titre_client, npa: c.npa, naissance: c.date_naissance,
      tel: c.tel_mobile || c.tel_perso, nbContrats: 0, primeAnnuelle: 0,
    };
    clientsMap[key].nbContrats++;
    clientsMap[key].primeAnnuelle += Number(c.prime_annuelle||0);
  });
  const clientsList = Object.values(clientsMap).sort((a,b) => b.primeAnnuelle - a.primeAnnuelle);
  const topClientsComm = Object.entries(parClientComm).sort((a,b) => b[1]-a[1]).slice(0, 8);

  // ── Donut SVG : répartition par compagnie (commissions) ──
  const totalCompagnies = compagnies.reduce((s,[,v]) => s+v, 0) || 1;
  let cumul = 0;
  const R = 70, C = 2 * Math.PI * R;
  const donutSegments = compagnies.map(([comp, val], i) => {
    const frac = val / totalCompagnies;
    const dash = frac * C;
    const offset = cumul * C;
    cumul += frac;
    return `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="22"
      stroke-dasharray="${dash.toFixed(1)} ${(C-dash).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 90 90)"/>`;
  }).join('');

  // ── Bar chart : évolution mensuelle ──
  const maxMois = Math.max(...mois.map(m => parMois[m]), 1);
  const moisLabels = { '01':'Jan','02':'Fév','03':'Mar','04':'Avr','05':'Mai','06':'Jun','07':'Jul','08':'Aoû','09':'Sep','10':'Oct','11':'Nov','12':'Déc' };
  const barsHtml = mois.map(m => {
    const val = parMois[m];
    const h = Math.max(Math.round(val / maxMois * 100), 3);
    const [y, mm] = m.split('-');
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0">
      <div title="${chf(val)}" style="width:100%;max-width:22px;height:${h}px;background:linear-gradient(180deg,#38bdf8,#0ea5e9);border-radius:4px 4px 2px 2px;"></div>
      <div style="font-size:8.5px;color:var(--text-muted);margin-top:5px;white-space:nowrap">${moisLabels[mm]}<br>'${y.slice(2)}</div>
    </div>`;
  }).join('');

  const dateRapport = today.toLocaleDateString('fr-CH', { day:'2-digit', month:'long', year:'numeric' });

  return `
    <div class="oz-screen-only">
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:-10px">
      <button onclick="navigate('oz-commissions-assurex')" style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:9px;padding:9px 18px;font-weight:700;font-size:12.5px;cursor:pointer;color:var(--accent);display:flex;align-items:center;gap:6px">💼 Commissions Assurex versées à OZ</button>
      <button onclick="navigate('rapport-finma-oz')" style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:9px;padding:9px 18px;font-weight:700;font-size:12.5px;cursor:pointer;color:var(--accent);display:flex;align-items:center;gap:6px">📋 Recensement FINMA</button>
      <button onclick="window.print()" style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 18px;font-weight:700;font-size:12.5px;cursor:pointer;color:var(--text-muted);display:flex;align-items:center;gap:6px">🖨️ Imprimer / Export PDF</button>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:8px;padding:28px 0 18px;background:radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.08) 0%, transparent 70%)">
      <div style="background:var(--navy);border-radius:18px;padding:18px 36px;box-shadow:0 8px 30px rgba(0,0,0,0.35)">
        ${OZASSURE_LOGO_PRIMARY_SVG.replace('class="oz-logo-primary-svg"', 'class="oz-logo-primary-svg" style="height:80px;width:auto;display:block"')}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:14px;max-width:480px">Bilan de 2 ans d'exploitation — entité OZ Assure (entreprise individuelle de Jonathan Özkan)</div>
    </div>

    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:12.5px;color:var(--text)">
      ⚠ Depuis le <strong>01.06.2026</strong>, le portefeuille OZ Assure est considéré comme <strong>virtuellement transféré à Assurex Sàrl</strong> — les mandats principaux seront resignés progressivement sous Assurex. Cette page reste une <strong>archive historique</strong>.
    </div>

    <div class="stat-grid" style="margin-bottom:14px">
      ${statCard('Volume de primes (actif)', chf(volumeActif), '#4ade80')}
      ${statCard('Volume de primes (total)', chf(volumeTotal), '#64748b')}
      ${statCard('Commissions perçues', chf(totalNet), '#f59e0b')}
      ${statCard('Contrats', contrats.length, '#38bdf8')}
    </div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${statCard('Clients (contrats)', clientsList.length, '#a78bfa')}
      ${statCard('Clients (commissions)', nbClientsComm, '#a78bfa')}
      ${statCard('Moyenne mensuelle', chf(moyenneMensuelle), '#38bdf8')}
      ${statCard('Mouvements', data.length, '#e2e8f0')}
    </div>
    ${sansPrimeAnnuelle > 0 ? `<div style="font-size:11px;color:var(--text-muted);margin:-8px 0 20px">ℹ️ ${sansPrimeAnnuelle} contrat(s) (principalement LAMal) sans prime annuelle renseignée dans la source — non comptabilisés dans le volume de primes.</div>` : ''}

    <!-- VIE vs NON-VIE — volume de primes (actif) -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:var(--surface);border:2px solid rgba(167,139,250,0.3);border-radius:14px;padding:18px 20px">
        <div style="font-size:11px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🫀 VIE & Prévoyance (primes actives)</div>
        <div style="font-size:22px;font-weight:900;color:#a78bfa">${chf(volumeVie)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${volumeActif > 0 ? Math.round(volumeVie/volumeActif*100) : 0}% du volume actif</div>
        ${ozDetailHtml(parProduitPrimeVie, volumeVie, '#a78bfa')}
      </div>
      <div style="background:var(--surface);border:2px solid rgba(56,189,248,0.3);border-radius:14px;padding:18px 20px">
        <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🛡️ NON-VIE / IARD (primes actives)</div>
        <div style="font-size:22px;font-weight:900;color:var(--accent)">${chf(volumeNonVie)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${volumeActif > 0 ? Math.round(volumeNonVie/volumeActif*100) : 0}% du volume actif</div>
        ${ozDetailHtml(parProduitPrimeNonVie, volumeNonVie, 'var(--accent)')}
      </div>
    </div>

    <!-- Répartition du volume de primes par type de produit -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:16px">Volume de primes par type de produit (contrats actifs)</div>
      ${produitsPrime.map(([cat, val]) => `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-size:13px;font-weight:700;color:var(--text)">${cat}</div>
            <div style="font-size:13px;font-weight:800;color:#4ade80">${chf(val)}</div>
          </div>
          <div style="height:7px;border-radius:4px;background:var(--border);margin-top:5px;overflow:hidden">
            <div style="height:100%;width:${Math.round(val/maxProduitPrime*100)}%;background:#4ade80;border-radius:4px"></div>
          </div>
        </div>`).join('') || '<div class="table-empty">Aucune donnée.</div>'}
    </div>

    <!-- Répartition des commissions par type de produit -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px">
        <div style="font-size:13px;font-weight:800;color:var(--text)">Commissions par type de produit</div>
        <div style="font-size:11px;color:var(--text-muted)">Vie : ${chf(totalVieComm)} · Non-vie : ${chf(totalNonVieComm)}</div>
      </div>
      ${produitsComm.map(([cat, val]) => `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-size:13px;font-weight:700;color:var(--text)">${cat}</div>
            <div style="font-size:13px;font-weight:800;color:#f59e0b">${chf(val)}</div>
          </div>
          <div style="height:7px;border-radius:4px;background:var(--border);margin-top:5px;overflow:hidden">
            <div style="height:100%;width:${Math.round(val/(produitsComm.length?produitsComm[0][1]:1)*100)}%;background:#f59e0b;border-radius:4px"></div>
          </div>
        </div>`).join('') || '<div class="table-empty">Aucune donnée.</div>'}
    </div>

    <div style="display:grid;grid-template-columns:repeat(${Math.min(annees.length,4) || 1},1fr);gap:12px;margin-bottom:24px">
      ${annees.map(a => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${a}</div>
          <div style="font-size:20px;font-weight:900;color:#f59e0b">${chf(parAnnee[a])}</div>
        </div>`).join('')}
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:18px">Évolution mensuelle des commissions nettes</div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:130px;overflow-x:auto;padding-bottom:4px">${barsHtml}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:16px">Répartition par compagnie (commissions)</div>
        <div style="display:flex;align-items:center;gap:20px">
          <svg width="180" height="180" viewBox="0 0 180 180">${donutSegments}
            <text x="90" y="86" text-anchor="middle" font-size="18" font-weight="900" fill="#fff">${compagnies.length}</text>
            <text x="90" y="104" text-anchor="middle" font-size="9" fill="#94a3b8">compagnies</text>
          </svg>
          <div style="flex:1;min-width:0">
            ${compagnies.slice(0,6).map(([comp,val],i) => `
              <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;font-size:11.5px">
                <div style="width:9px;height:9px;border-radius:50%;background:${PALETTE[i % PALETTE.length]};flex-shrink:0"></div>
                <div style="color:var(--text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${comp}</div>
                <div style="color:var(--text-muted);font-weight:700;flex-shrink:0">${Math.round(val/totalCompagnies*100)}%</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:16px">Top clients (commissions cumulées)</div>
        ${topClientsComm.map(([client, val], i) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:20px;height:20px;border-radius:50%;background:var(--accent-dim);color:var(--accent);font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
            <div style="flex:1;font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${client}</div>
            <div style="font-size:12.5px;font-weight:800;color:#f59e0b;flex-shrink:0">${chf(val)}</div>
          </div>`).join('') || '<div class="table-empty">Aucune donnée.</div>'}
      </div>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px">
        <div style="font-size:13px;font-weight:800;color:var(--text)">Données clients (${clientsList.length})</div>
        <div style="font-size:11px;color:var(--text-muted)">Triés par volume de prime annuelle</div>
      </div>
      <div style="max-height:480px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="color:var(--text-muted);font-size:10.5px;text-transform:uppercase;position:sticky;top:0;background:var(--surface)">
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border)">Client</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border)">NPA</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border)">Né(e) le</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border)">Téléphone</th>
          <th style="padding:8px 10px;text-align:center;border-bottom:1px solid var(--border)">Contrats</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:1px solid var(--border)">Prime/an</th>
        </tr></thead>
        <tbody>${clientsList.map(c => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:8px 10px;font-weight:700;color:var(--text)">${c.titre ? c.titre + ' ' : ''}${c.nom}</td>
            <td style="padding:8px 10px;color:var(--text-muted)">${c.npa || '—'}</td>
            <td style="padding:8px 10px;color:var(--text-muted)">${dch(c.naissance)}</td>
            <td style="padding:8px 10px;color:var(--text-muted)">${c.tel || '—'}</td>
            <td style="padding:8px 10px;text-align:center;color:var(--text-muted)">${c.nbContrats}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:800;color:#f59e0b">${c.primeAnnuelle ? chf(c.primeAnnuelle) : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>
    </div>

    <!-- ═══ RÉSUMÉ IMPRIMABLE / PDF ═══ -->
    <div class="oz-print-report">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:20px;font-weight:900;color:black">OZ ASSURE — Résumé d'exploitation</div>
        <div style="font-size:12px;color:#555;margin-top:4px">Entreprise individuelle de Jonathan Özkan · Rapport généré le ${dateRapport}</div>
        <div style="font-size:11px;color:#888;margin-top:2px">Portefeuille virtuellement transféré à Assurex Sàrl depuis le 01.06.2026</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="border:1px solid #ccc;padding:10px;width:25%"><div style="font-size:9px;color:#666;text-transform:uppercase">Volume primes actif</div><div style="font-size:16px;font-weight:800">${chf(volumeActif)}</div></td>
          <td style="border:1px solid #ccc;padding:10px;width:25%"><div style="font-size:9px;color:#666;text-transform:uppercase">Volume primes total</div><div style="font-size:16px;font-weight:800">${chf(volumeTotal)}</div></td>
          <td style="border:1px solid #ccc;padding:10px;width:25%"><div style="font-size:9px;color:#666;text-transform:uppercase">Commissions perçues</div><div style="font-size:16px;font-weight:800">${chf(totalNet)}</div></td>
          <td style="border:1px solid #ccc;padding:10px;width:25%"><div style="font-size:9px;color:#666;text-transform:uppercase">Contrats / Clients</div><div style="font-size:16px;font-weight:800">${contrats.length} / ${clientsList.length}</div></td>
        </tr>
      </table>

      <div style="font-size:13px;font-weight:800;margin-bottom:8px">Commissions par année</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#f0f0f0"><th style="border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:11px">Année</th><th style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-size:11px">Total net</th></tr></thead>
        <tbody>${annees.map(a => `<tr><td style="border:1px solid #ccc;padding:6px 10px">${a}</td><td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:700">${chf(parAnnee[a])}</td></tr>`).join('')}</tbody>
      </table>

      <div style="font-size:13px;font-weight:800;margin-bottom:8px">Répartition par compagnie</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#f0f0f0"><th style="border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:11px">Compagnie</th><th style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-size:11px">Commissions</th><th style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-size:11px">Part</th></tr></thead>
        <tbody>${compagnies.map(([comp,val]) => `<tr><td style="border:1px solid #ccc;padding:6px 10px">${comp}</td><td style="border:1px solid #ccc;padding:6px 10px;text-align:right">${chf(val)}</td><td style="border:1px solid #ccc;padding:6px 10px;text-align:right">${Math.round(val/totalCompagnies*100)}%</td></tr>`).join('')}</tbody>
      </table>

      <div style="font-size:13px;font-weight:800;margin-bottom:8px">Volume de primes par type de produit (contrats actifs) — Vie: ${chf(volumeVie)} · Non-vie: ${chf(volumeNonVie)}</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#f0f0f0"><th style="border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:11px">Type de produit</th><th style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-size:11px">Volume prime/an</th></tr></thead>
        <tbody>${produitsPrime.map(([cat,val]) => `<tr><td style="border:1px solid #ccc;padding:6px 10px">${cat}</td><td style="border:1px solid #ccc;padding:6px 10px;text-align:right">${chf(val)}</td></tr>`).join('')}</tbody>
      </table>

      <div style="font-size:13px;font-weight:800;margin-bottom:8px">Commissions par type de produit</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#f0f0f0"><th style="border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:11px">Type de produit</th><th style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-size:11px">Commissions</th></tr></thead>
        <tbody>${produitsComm.map(([cat,val]) => `<tr><td style="border:1px solid #ccc;padding:6px 10px">${cat}</td><td style="border:1px solid #ccc;padding:6px 10px;text-align:right">${chf(val)}</td></tr>`).join('')}</tbody>
      </table>

      <div style="font-size:13px;font-weight:800;margin-bottom:8px">Données clients complètes (${clientsList.length})</div>
      <table style="width:100%;border-collapse:collapse;font-size:10.5px">
        <thead><tr style="background:#f0f0f0">
          <th style="border:1px solid #ccc;padding:5px 8px;text-align:left">Client</th>
          <th style="border:1px solid #ccc;padding:5px 8px;text-align:left">NPA</th>
          <th style="border:1px solid #ccc;padding:5px 8px;text-align:left">Né(e) le</th>
          <th style="border:1px solid #ccc;padding:5px 8px;text-align:left">Téléphone</th>
          <th style="border:1px solid #ccc;padding:5px 8px;text-align:center">Contrats</th>
          <th style="border:1px solid #ccc;padding:5px 8px;text-align:right">Prime/an</th>
        </tr></thead>
        <tbody>${clientsList.map(c => `<tr>
          <td style="border:1px solid #ccc;padding:5px 8px">${c.titre ? c.titre + ' ' : ''}${c.nom}</td>
          <td style="border:1px solid #ccc;padding:5px 8px">${c.npa || '—'}</td>
          <td style="border:1px solid #ccc;padding:5px 8px">${dch(c.naissance)}</td>
          <td style="border:1px solid #ccc;padding:5px 8px">${c.tel || '—'}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${c.nbContrats}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:right;font-weight:700">${c.primeAnnuelle ? chf(c.primeAnnuelle) : '—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}


// ═══ CONTACTS COMPAGNIES (pour demandes d'offre) ═══
async function viewContactsCompagnies() {
  const contacts = await dbGet('compagnies_contacts', 'select=*&order=compagnie.asc');
  window._contactsCompagnies = contacts || [];

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Contacts compagnies</h2>
      <button class="btn-add" onclick="showFormContactCompagnie()">+ Ajouter une compagnie</button>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Utilisés pour générer les emails de demande d'offre depuis le formulaire "Demande d'offre".</div>
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:1fr 1fr 1fr 60px"><div>Compagnie</div><div>Contact</div><div>Email</div><div></div></div>
      ${(contacts||[]).map(c => `<div class="table-row" style="grid-template-columns:1fr 1fr 1fr 60px">
        <div style="font-weight:700;font-size:13px;color:var(--text)">${c.compagnie}</div>
        <div style="font-size:12.5px;color:var(--text-muted)">${c.libelle_contact || '—'}</div>
        <div style="font-size:12.5px;color:${c.email ? 'var(--text)' : '#f87171'}">${c.email || 'Non renseigné'}</div>
        <div><button onclick="showFormContactCompagnie('${c.id}')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:4px 8px;font-size:12px;cursor:pointer">✏️</button></div>
      </div>`).join('') || '<div class="table-empty">Aucune compagnie enregistrée.</div>'}
    </div>`;
}

function showFormContactCompagnie(id) {
  const existant = id ? (window._contactsCompagnies || []).find(c => c.id === id) : null;
  creerModale('modal-contact-cie', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:440px">
      <h3 style="margin:0 0 20px;font-size:16px;font-weight:800;color:var(--text)">${existant ? 'Modifier' : 'Ajouter'} une compagnie</h3>
      <div class="form-grid">
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Nom de la compagnie *</label><input class="form-input" id="cc-nom" value="${existant ? existant.compagnie : ''}"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Libellé contact (agence/courtier)</label><input class="form-input" id="cc-libelle" value="${existant ? (existant.libelle_contact||'') : ''}"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Email</label><input class="form-input" id="cc-email" type="email" value="${existant ? (existant.email||'') : ''}"/></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn-secondary" onclick="document.getElementById('modal-contact-cie').remove()">Annuler</button>
        <button class="btn-save" onclick="saveContactCompagnie(${existant ? `'${existant.id}'` : 'null'})">✓ Enregistrer</button>
      </div>
    </div>`, { overflowY: false });
}

async function saveContactCompagnie(id) {
  const body = {
    compagnie: document.getElementById('cc-nom').value.trim(),
    libelle_contact: document.getElementById('cc-libelle').value.trim() || null,
    email: document.getElementById('cc-email').value.trim() || null,
  };
  if (!body.compagnie) { showError('Le nom de la compagnie est obligatoire.'); return; }
  const r = id ? await dbPatch('compagnies_contacts', id, body) : await dbPost('compagnies_contacts', body);
  if (r && r.error) { showError('Erreur lors de l\u2019enregistrement du contact : ' + errMsg(r)); return; }
  allCompagniesContacts = await dbGet('compagnies_contacts', 'select=*&order=compagnie.asc');
  document.getElementById('modal-contact-cie').remove();
  navigate('contacts-compagnies');
}

async function viewAuditLog() {
  if (!currentUser || currentUser.role !== 'signataire') {
    return `<h2 style="margin:0 0 18px;font-size:18px;font-weight:800;color:var(--text)">Journal d'audit</h2>
      <div class="table-empty">Accès réservé au signataire.</div>`;
  }
  const logs = await dbGet('audit_log', 'select=*&order=created_at.desc&limit=200');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Journal d'audit</h2>
      <div style="font-size:12px;color:var(--text-muted)">200 dernières actions — traçabilité nLPD</div>
    </div>
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:140px 1fr 200px 160px"><div>Date/heure</div><div>Action</div><div>Détail</div><div>Utilisateur</div></div>
      ${(logs || []).map(l => `<div class="table-row" style="grid-template-columns:140px 1fr 200px 160px">
        <div style="font-size:11px;color:var(--text-muted)">${new Date(l.created_at).toLocaleString('fr-CH', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
        <div style="font-size:12.5px;font-weight:600;color:var(--text)">${ACTION_LABELS[l.action] || l.action}</div>
        <div style="font-size:12px;color:var(--text-muted)">${l.detail || ''}</div>
        <div style="font-size:12px;color:var(--text-muted)">${l.user_email}</div>
      </div>`).join('') || '<div class="table-empty">Aucune entrée pour le moment.</div>'}
    </div>`;
}

function viewAgents() {
  const agents = allAgents.length > 0 ? allAgents : [currentUser];
  return `
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:800;color:var(--text)">Paramètres — Agents</h2>
    ${agents.map(a => {
      const color = agentColor(a);
      const nbClients = allClients.filter(c => c.apporteur_id === a.id).length;
      const ca = allClients.filter(c => c.apporteur_id === a.id).reduce((s,c)=>s+caClient(c.id),0);
      // Commissions GÉNÉRÉES = uniquement celles déjà incluses dans une fiche de paie
      // (l'argent qui entre via un bordereau n'est "attribué" à un agent qu'au moment
      // où une fiche de paie est effectivement créée — avant ça, c'est 0 par définition).
      const commissionsPayees = allCommissionsAttente.filter(cm => cm.fiche_paie_id);
      let commGeneree = 0;
      commissionsPayees.forEach(cm => {
        const montant = cm.montant_final != null ? cm.montant_final : (cm.montant_estime || 0);
        const s = splitMontantAgent(montant, cm.contrat_id);
        if (a.role === 'signataire') commGeneree += s.pJ;
        else if (s.agent && s.agent.id === a.id) commGeneree += s.pA;
      });
      const partAgent = commGeneree; // déjà la part exacte de l'agent (pJ ou pA selon son rôle)
      const isEditing = editingAgentId === a.id;
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
          ${avatar(a, 44)}
          <div>
            <div style="font-size:15px;font-weight:800;color:var(--text)">${a.prenom} ${a.nom}</div>
            <div style="font-size:12px;color:var(--text-muted)">${a.email} · ${a.tel || ''}</div>
          </div>
          ${currentUser.role === 'signataire' ? `<button class="btn-save" style="margin-left:auto" onclick="toggleEditAgent('${a.id}')">${isEditing ? 'Annuler' : 'Modifier'}</button>` : ''}
        </div>
        ${isEditing ? `<div style="background:var(--surface-alt);border-radius:10px;padding:16px;margin-bottom:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div class="form-field"><label class="form-label">Prénom</label><input id="edit-prenom-${a.id}" class="form-input" value="${a.prenom || ''}"></div>
            <div class="form-field"><label class="form-label">Nom</label><input id="edit-nom-${a.id}" class="form-input" value="${a.nom || ''}"></div>
            <div class="form-field"><label class="form-label">Email</label><input id="edit-email-${a.id}" class="form-input" value="${a.email || ''}"></div>
            <div class="form-field"><label class="form-label">Téléphone</label><input id="edit-tel-${a.id}" class="form-input" value="${a.tel || ''}"></div>
            <div class="form-field"><label class="form-label">Taux commission (%)</label>
              <select id="edit-taux-select-${a.id}" class="form-input" onchange="toggleTauxLibre('${a.id}')">
                <option value="0" ${a.taux === 0 ? 'selected' : ''}>0%</option>
                <option value="50" ${a.taux === 50 ? 'selected' : ''}>50%</option>
                <option value="100" ${a.taux === 100 ? 'selected' : ''}>100%</option>
                <option value="autre" ${![0,50,100].includes(a.taux) ? 'selected' : ''}>Autre…</option>
              </select>
              <input id="edit-taux-${a.id}" type="number" class="form-input" value="${a.taux || ''}" placeholder="Saisir le taux exact" style="margin-top:6px;${[0,50,100].includes(a.taux) ? 'display:none' : ''}">
            </div>
            <div class="form-field"><label class="form-label">Rôle</label>
              <select id="edit-role-${a.id}" class="form-input">
                <option value="signataire" ${a.role === 'signataire' ? 'selected' : ''}>Signataire</option>
                <option value="apporteur" ${a.role === 'apporteur' ? 'selected' : ''}>Apporteur</option>
              </select>
            </div>
          </div>
          <button class="btn-save" onclick="saveAgent('${a.id}')">💾 Enregistrer</button>
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
          ${[['Rôle', a.role], ['Taux commission', a.taux + '%'], ['Clients', nbClients]].map(([l,v]) =>
            `<div style="background:var(--surface-alt);border-radius:9px;padding:10px 14px">
              <div style="color:var(--text-muted);font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:4px">${l}</div>
              <div style="color:var(--text);font-size:13px;font-weight:700">${v}</div>
            </div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2);border-radius:9px;padding:10px 14px">
            <div style="color:var(--text-muted);font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:4px">CA géré</div>
            <div style="color:#38bdf8;font-size:14px;font-weight:800">CHF ${ca.toLocaleString()}</div>
          </div>
          <div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:9px;padding:10px 14px">
            <div style="color:var(--text-muted);font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:4px">Commissions générées (via fiche de paie)</div>
            <div style="color:#4ade80;font-size:14px;font-weight:800">CHF ${Math.round(commGeneree).toLocaleString()}</div>
          </div>
        </div>
      </div>`;
    }).join('')}
    ${currentUser.role === 'signataire' ? `<button class="btn-save" style="margin-top:4px" onclick="navigate('nouveau-agent')">+ Ajouter un agent</button>` : ''}
    <div style="margin-top:20px">
      <button onclick="logout()" style="background:var(--red-dim);color:var(--red);border:1px solid rgba(248,113,113,0.3);border-radius:10px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">🚪 Se déconnecter</button>
    </div>`;
}

function toggleTauxLibre(id) {
  const select = document.getElementById(`edit-taux-select-${id}`);
  const input = document.getElementById(`edit-taux-${id}`);
  if (select.value === 'autre') {
    input.style.display = 'block';
    input.value = '';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = select.value;
  }
}

function printForm() {
  window.print();
}

function toggleEditAgent(id) {
  editingAgentId = editingAgentId === id ? null : id;
  navigate('agents');
}

async function saveAgent(id) {
  const body = {
    prenom: document.getElementById(`edit-prenom-${id}`).value.trim(),
    nom: document.getElementById(`edit-nom-${id}`).value.trim(),
    email: document.getElementById(`edit-email-${id}`).value.trim(),
    tel: document.getElementById(`edit-tel-${id}`).value.trim(),
    taux: Number(document.getElementById(`edit-taux-${id}`).value) || 0,
    role: document.getElementById(`edit-role-${id}`).value,
  };
  if (!body.prenom || !body.nom || !body.email) { showError('Prénom, nom et email sont obligatoires.'); return; }
  const r = await dbPatch('agents', id, body);
  if (r && r.error) { showError('Erreur lors de la mise à jour: ' + errMsg(r)); return; }
  allAgents = await dbGet('agents', 'select=*');
  editingAgentId = null;
  navigate('agents');
}

function viewNouvelAgent() {
  return `
    <button onclick="navigate('agents')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour aux agents</button>
    <h2 style="margin:0 0 18px;font-size:18px;font-weight:800;color:var(--text)">Nouvel agent</h2>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="form-field"><label class="form-label">Prénom *</label><input id="new-prenom" class="form-input"></div>
        <div class="form-field"><label class="form-label">Nom *</label><input id="new-nom" class="form-input"></div>
        <div class="form-field"><label class="form-label">Email *</label><input id="new-email" class="form-input" placeholder="prenom@cofidex.ch"></div>
        <div class="form-field"><label class="form-label">Téléphone</label><input id="new-tel" class="form-input"></div>
        <div class="form-field"><label class="form-label">Taux commission (%)</label><input id="new-taux" type="number" class="form-input" value="50"></div>
        <div class="form-field"><label class="form-label">Rôle</label>
          <select id="new-role" class="form-input">
            <option value="apporteur">Apporteur</option>
            <option value="signataire">Signataire</option>
          </select>
        </div>
      </div>
      <button class="btn-save" onclick="createAgent()">💾 Créer l'agent</button>
    </div>`;
}

async function createAgent() {
  const body = {
    prenom: document.getElementById('new-prenom').value.trim(),
    nom: document.getElementById('new-nom').value.trim(),
    email: document.getElementById('new-email').value.trim(),
    tel: document.getElementById('new-tel').value.trim(),
    taux: Number(document.getElementById('new-taux').value) || 50,
    role: document.getElementById('new-role').value,
  };
  if (!body.prenom || !body.nom || !body.email) { showError('Prénom, nom et email sont obligatoires.'); return; }
  const r = await dbPost('agents', body);
  if (r && r.error) { showError('Erreur lors de la création: ' + errMsg(r)); return; }
  allAgents = await dbGet('agents', 'select=*');
  navigate('agents');
}

// ═══ INIT ═══
// ═══ INIT ═══
// Un lien de signature (?signer=TOKEN) contourne tout le CRM et Microsoft — le client
// qui ouvre ce lien sur son téléphone n'a pas de compte, il ne doit voir qu'un écran de signature.
const _paramsInitiaux = new URLSearchParams(window.location.search);
const _tokenSignature = _paramsInitiaux.get('signer');
if (_tokenSignature) {
  afficherPageSignatureAutonome(_tokenSignature);
} else {
  initMSAL();
  tryRestoreSession();
}
