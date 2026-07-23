function viewBordereaux() {
  setTimeout(() => renderBordereauxList(), 0);
  const compagnies = [...new Set(allBordereaux.map(b => b.compagnie).filter(Boolean))].sort();
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Bordereaux — décomptes reçus des compagnies</h2>
      <button class="btn-add" onclick="navigate('nouveau-bordereau')">+ Saisir bordereau</button>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Argent qui entre dans Assurex (commissions de gestion + d'acquisition). Pour répartir ces montants entre les collaborateurs, utilise <span onclick="navigate('fiche-paie')" style="color:var(--accent);cursor:pointer;text-decoration:underline">Fiche de paie</span>.</div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <input class="form-input" id="bd-search" placeholder="🔍 N° bordereau, client, compagnie..." style="flex:1;min-width:180px" oninput="renderBordereauxList()"/>
      <select class="form-select" id="bd-compagnie" style="max-width:180px" onchange="renderBordereauxList()">
        <option value="">Toutes compagnies</option>
        ${compagnies.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <select class="form-select" id="bd-statut" style="max-width:150px" onchange="renderBordereauxList()">
        <option value="">Tous statuts</option>
        <option value="attendu">Attendu</option>
        <option value="reçu">Reçu</option>
      </select>
      <select class="form-select" id="bd-tri" style="max-width:170px" onchange="renderBordereauxList()">
        <option value="recent">Plus récent d'abord</option>
        <option value="ancien">Plus ancien d'abord</option>
        <option value="montant">Montant décroissant</option>
      </select>
    </div>
    <div id="bd-stats" class="stat-grid" style="margin-bottom:20px"></div>
    <div id="bd-list"></div>`;
}

function renderBordereauxList() {
  const search = (document.getElementById('bd-search')?.value || '').toLowerCase().trim();
  const compagnieF = document.getElementById('bd-compagnie')?.value || '';
  const statutF = document.getElementById('bd-statut')?.value || '';
  const tri = document.getElementById('bd-tri')?.value || 'recent';

  let BORDS = allBordereaux.filter(b => {
    if (compagnieF && b.compagnie !== compagnieF) return false;
    if (statutF && b.statut !== statutF) return false;
    if (search) {
      const commissionsB = allCommissionsAttente.filter(c => c.bordereau_id === b.id);
      const nomsClients = commissionsB.map(c => (c.client_nom||'').toLowerCase()).join(' ');
      const hay = `${b.numero||''} ${b.compagnie||''} ${b.mois||''} ${nomsClients}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (tri === 'recent') BORDS.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  else if (tri === 'ancien') BORDS.sort((a,b) => new Date(a.created_at||0) - new Date(b.created_at||0));
  else if (tri === 'montant') BORDS.sort((a,b) => (b.montant_brut||0) - (a.montant_brut||0));

  const totalRecu = BORDS.filter(b=>b.statut==='reçu').reduce((s,b)=>s+(b.montant_brut||0),0);
  const totalAttendu = BORDS.filter(b=>b.statut==='attendu').reduce((s,b)=>s+(b.montant_brut||0),0);
  const totalCaution = BORDS.reduce((s,b)=>s+Math.round((b.montant_brut||0)*((b.taux_caution||0)/100)),0);

  document.getElementById('bd-stats').innerHTML = `
    ${statCard('Bordereaux', BORDS.length, '#38bdf8')}
    ${statCard('Reçus', 'CHF ' + totalRecu.toLocaleString(), '#4ade80')}
    ${statCard('Attendus', 'CHF ' + totalAttendu.toLocaleString(), '#f59e0b')}
    ${statCard('Caution totale retenue', 'CHF ' + totalCaution.toLocaleString(), '#a78bfa')}
  `;

  const cards = BORDS.map(b => {
    const commissions = allCommissionsAttente.filter(c => c.bordereau_id === b.id);
    const enAttentePourCompagnie = allCommissionsAttente.filter(c => (c.compagnie||'').trim().toLowerCase() === (b.compagnie||'').trim().toLowerCase() && c.statut === 'en_attente');
    const tauxCaution = b.taux_caution || 0;
    const montantCaution = Math.round((b.montant_brut||0) * (tauxCaution/100));
    const montantNetApresCaution = (b.montant_brut||0) - montantCaution;

    function splitAgent(c) {
      const montant = c.montant_final != null ? c.montant_final : (c.montant_estime || 0);
      const s = splitMontantAgent(montant, c.contrat_id);
      return { ...s, montant };
    }

    let pJ = 0, pA = 0;
    const agentsDistincts = new Set();
    commissions.forEach(c => { const s = splitAgent(c); pJ += s.pJ; pA += s.pA; if (s.agent) agentsDistincts.add(s.agent.id); });
    const apporteurUnique = agentsDistincts.size === 1 ? allAgents.find(a => a.id === [...agentsDistincts][0]) : null;
    const isOpen = openBordereaux[b.id];

    return `<div class="bordereau-card">
      <div class="bordereau-header" onclick="toggleBordereau('${b.id}')">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px">
            ${b.numero ? `<span style="background:var(--surface-alt);color:var(--text-muted);border-radius:5px;padding:2px 7px;font-size:10.5px;font-weight:800;font-family:monospace">${b.numero}</span>` : ''}
            <div style="font-size:14px;font-weight:800;color:var(--text)">${b.compagnie}</div>
            ${b.pdf_url ? `<button onclick="event.stopPropagation(); ouvrirPieceJointe('${b.pdf_url}')" title="Ouvrir le PDF" style="background:none;border:none;cursor:pointer;font-size:13px">📎</button>` : ''}
          </div>
          <div style="font-size:11px;color:var(--text-muted)">${b.mois}${b.date_reception ? ' · Reçu le ' + fmtDate(b.date_reception) : ''}${tauxCaution > 0 ? ' · Caution ' + tauxCaution + '%' : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:900;color:#f59e0b">CHF ${(b.montant_brut||0).toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text-muted)">Brut</div>
        </div>
        ${badge(b.statut, b.statut === 'reçu' ? '#4ade80' : '#f59e0b')}
        <div style="font-size:14px;color:var(--text-muted)">${isOpen ? '▲' : '▼'}</div>
      </div>
      ${isOpen ? `<div class="bordereau-body">
        ${tauxCaution > 0 ? `<div style="display:flex;gap:10px;margin-bottom:14px">
          <div style="flex:1;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.3);border-radius:8px;padding:10px 14px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Caution retenue (${tauxCaution}%)</div>
            <div style="font-size:16px;font-weight:900;color:#a78bfa">CHF ${montantCaution.toLocaleString()}</div>
          </div>
          <div style="flex:1;background:var(--surface-alt);border-radius:8px;padding:10px 14px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Net après caution</div>
            <div style="font-size:16px;font-weight:900;color:var(--text)">CHF ${montantNetApresCaution.toLocaleString()}</div>
          </div>
        </div>` : ''}

        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.25);border-radius:9px;padding:12px 16px">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Montant net total versé (rapproché)</div>
            <div style="font-size:20px;font-weight:900;color:#4ade80">CHF ${(pJ+pA).toLocaleString()}</div>
          </div>
          <button onclick="event.stopPropagation(); toggleBordereauVerse('${b.id}')" style="background:${b.statut==='reçu' ? 'rgba(74,222,128,0.15)' : 'var(--accent-dim)'};border:1px solid ${b.statut==='reçu' ? 'rgba(74,222,128,0.4)' : 'var(--accent-border)'};color:${b.statut==='reçu' ? '#4ade80' : 'var(--accent)'};border-radius:8px;padding:9px 18px;font-weight:800;font-size:12.5px;cursor:pointer;white-space:nowrap">${b.statut==='reçu' ? '↺ Remettre en attendu' : '✓ Marquer comme versé'}</button>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:14px">
          <div style="flex:1;background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:8px;padding:10px 14px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Part Jonathan</div>
            <div style="font-size:16px;font-weight:900;color:#38bdf8">CHF ${pJ.toLocaleString()}</div>
          </div>
          <div style="flex:1;background:var(--gold-dim);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:10px 14px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">${apporteurUnique ? 'Part ' + apporteurUnique.prenom : (agentsDistincts.size > 1 ? 'Part apporteurs (mixte)' : 'Part apporteurs')}</div>
            <div style="font-size:16px;font-weight:900;color:#f59e0b">CHF ${pA.toLocaleString()}</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Commissions rapprochées (${commissions.length})</div>
          <div style="display:flex;gap:8px">
            <button onclick="event.stopPropagation(); imprimerBordereau('${b.id}')" style="background:var(--surface-alt);color:var(--text-muted);border:1px solid var(--border);border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">📄 Export PDF</button>
            <button onclick="event.stopPropagation(); showModalEditBordereau('${b.id}')" style="background:var(--surface-alt);color:var(--text-muted);border:1px solid var(--border);border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">✏️ Modifier le bordereau</button>
            <button onclick="event.stopPropagation(); showModalValidationCommission('${b.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">+ Rapprocher une commission ${enAttentePourCompagnie.length > 0 ? `(${enAttentePourCompagnie.length} en attente)` : ''}</button>
          </div>
        </div>

        ${commissions.map((c, i) => {
          const s = splitAgent(c);
          const sig = allAgents.find(a => a.role === 'signataire');
          return `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:${i < commissions.length-1 ? '1px solid var(--border)' : 'none'}">
            ${s.agent ? avatar(s.agent, 24) : ''}
            <div style="flex:1"><div style="font-size:12.5px;font-weight:600;color:var(--text)">${c.client_nom}</div><div style="font-size:11px;color:var(--text-muted)">${c.produit}${c.numero_police ? ' · ' + c.numero_police : ''}</div></div>
            <div style="text-align:right">
              <div style="font-size:12px;color:#38bdf8;font-weight:700">${sig ? sig.prenom : 'Jonathan'}: CHF ${s.pJ}</div>
              ${s.agent
                ? `<div style="font-size:12px;color:#f59e0b;font-weight:700">${s.agent.prenom}: CHF ${s.pA}</div>`
                : (c.contrat_id
                    ? `<div onclick="event.stopPropagation(); showEditContrat('${c.contrat_id}', 'bordereaux')" style="font-size:11px;color:var(--accent);font-weight:700;cursor:pointer;text-decoration:underline dotted">🖊️ Cliquer pour renseigner l'apporteur</div>`
                    : `<div style="font-size:10.5px;color:var(--text-dim)">Aucun contrat lié</div>`)
              }
            </div>
            <div style="font-weight:800;color:var(--text);font-size:13px;min-width:70px;text-align:right">CHF ${s.montant.toLocaleString()}</div>
          </div>`;
        }).join('')}
        ${commissions.length === 0 ? '<div class="table-empty">Aucune commission rapprochée pour ce bordereau encore.</div>' : ''}
      </div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('bd-list').innerHTML = cards || '<div class="table-empty">Aucun bordereau ne correspond aux filtres.</div>';
}

async function toggleBordereauVerse(bordereauId) {
  const b = allBordereaux.find(x => x.id === bordereauId);
  if (!b) return;
  const commissionsLiees = allCommissionsAttente.filter(c => c.bordereau_id === bordereauId && c.statut !== 'annulé');

  if (b.statut !== 'reçu') {
    // Bascule vers "versé" : le bordereau ET toutes ses commissions rapprochées
    // passent en statut "reçu(e)" avec une vraie date de réception — c'est CE moment
    // qui met à jour le Dashboard, la Fiche de paie et toutes les statistiques.
    const dateRecep = b.date_reception || new Date().toISOString().split('T')[0];
    const resultatBordereau = await dbPatch('bordereaux', bordereauId, { statut: 'reçu', date_reception: dateRecep });
    if (resultatBordereau && resultatBordereau.error) {
      showError('Erreur lors de la mise à jour du bordereau : ' + errMsg(resultatBordereau) + ' — aucune commission n\u2019a été touchée.');
      return;
    }
    let echecsCommissions = 0;
    for (const c of commissionsLiees) {
      const patch = {};
      if (c.statut !== 'reçue') patch.statut = 'reçue';
      if (!c.date_reception) patch.date_reception = dateRecep; // backfill même si déjà "reçue" (rapprochements historiques sans date)
      if (Object.keys(patch).length) {
        const r = await dbPatch('commissions_attente', c.id, patch);
        if (r && r.error) echecsCommissions++;
      }
    }
    if (echecsCommissions > 0) {
      showError(`⚠️ Le bordereau est marqué reçu, mais ${echecsCommissions} commission(s) sur ${commissionsLiees.length} n'ont pas pu être mises à jour — vérifie-les manuellement.`);
    }
    logAction('bordereau_verse', 'bordereaux', bordereauId, `${b.numero || ''} — ${commissionsLiees.length} commission(s) marquée(s) reçue(s)`);
  } else {
    // Retour en arrière : le bordereau redevient "attendu" ET toutes ses commissions
    // rapprochées sont automatiquement déliées et remises "en attente" — correction
    // complète et symétrique, pour ne jamais laisser de données à moitié cohérentes.
    const resultatBordereau = await dbPatch('bordereaux', bordereauId, { statut: 'attendu' });
    if (resultatBordereau && resultatBordereau.error) {
      showError('Erreur lors de la mise à jour du bordereau : ' + errMsg(resultatBordereau) + ' — aucune commission n\u2019a été touchée.');
      return;
    }
    let echecsCommissions = 0;
    for (const c of commissionsLiees) {
      const r = await dbPatch('commissions_attente', c.id, {
        statut: 'en_attente',
        bordereau_id: null,
        montant_final: null,
        date_reception: null,
        detail_calcul: `Rapprochement annulé le ${fmtDate(new Date().toISOString())} suite au retour en arrière du bordereau ${b.numero || ''} — remis en attente pour correction.`,
      });
      if (r && r.error) echecsCommissions++;
    }
    if (echecsCommissions > 0) {
      showError(`⚠️ Le bordereau est remis "attendu", mais ${echecsCommissions} commission(s) sur ${commissionsLiees.length} n'ont pas pu être déliées — vérifie-les manuellement.`);
    }
    logAction('bordereau_attendu', 'bordereaux', bordereauId, `${b.numero || ''} — ${commissionsLiees.length} commission(s) remise(s) en attente`);
  }

  allBordereaux = await dbGet('bordereaux', 'select=*');
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  renderBordereauxList();
}

function toggleBordereau(id) {
  openBordereaux[id] = !openBordereaux[id];
  renderBordereauxList();
}

// ═══ ÉDITION D'UN BORDEREAU ═══
function showModalEditBordereau(bordereauId) {
  const b = allBordereaux.find(x => x.id === bordereauId);
  if (!b) return;
  creerModale('modal-edit-bordereau', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:480px">
      <h3 style="margin:0 0 18px;font-size:16px;font-weight:800;color:var(--text)">Modifier le bordereau ${b.numero || ''}</h3>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">Compagnie</label><input class="form-input" id="eb-compagnie" value="${b.compagnie || ''}" list="eb-compagnies-suggestions" autocomplete="off"/><datalist id="eb-compagnies-suggestions">${(allCompagniesContacts||[]).map(c => `<option value="${c.compagnie}">`).join('')}</datalist></div>
        <div class="form-field"><label class="form-label">Mois</label>
          <select class="form-select" id="eb-mois-select">
            ${['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map(m => `<option value="${m}" ${(b.mois||'').startsWith(m)?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-field"><label class="form-label">Année</label>
          <select class="form-select" id="eb-annee-select">
            ${[2024,2025,2026,2027].map(y => `<option value="${y}" ${(b.mois||'').includes(String(y))?'selected':''}>${y}</option>`).join('')}
          </select>
        </div>
        <div class="form-field"><label class="form-label">Montant brut (CHF)</label><input class="form-input" id="eb-montant" type="number" value="${b.montant_brut || 0}"/></div>
        <div class="form-field"><label class="form-label">Taux de caution (%)</label><input class="form-input" id="eb-caution" type="number" step="0.1" value="${b.taux_caution || 0}"/></div>
        <div class="form-field"><label class="form-label">Statut</label><select class="form-select" id="eb-statut">
          <option value="attendu" ${b.statut==='attendu'?'selected':''}>Attendu</option>
          <option value="reçu" ${b.statut==='reçu'?'selected':''}>Reçu</option>
        </select></div>
        <div class="form-field"><label class="form-label">Date de réception</label><input class="form-input" id="eb-date" type="date" value="${b.date_reception || ''}"/></div>
      </div>
      ${b.pdf_url ? `<button type="button" onclick="ouvrirPieceJointe('${b.pdf_url}')" style="margin-top:10px;background:var(--surface-alt);border:1px solid var(--border);border-radius:7px;padding:6px 12px;font-size:11.5px;color:var(--text-muted);cursor:pointer">📎 Voir le PDF joint</button>` : ''}
      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="deleteBordereau('${bordereauId}')" style="background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:9px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer">🗑️ Supprimer</button>
        <button class="btn-secondary" onclick="document.getElementById('modal-edit-bordereau').remove()">Annuler</button>
        <button class="btn-save" onclick="saveEditBordereau('${bordereauId}')">✓ Enregistrer</button>
      </div>
    </div>`);
}

async function deleteBordereau(bordereauId) {
  const b = allBordereaux.find(x => x.id === bordereauId);
  const commissionsLiees = allCommissionsAttente.filter(c => c.bordereau_id === bordereauId);
  const msg = commissionsLiees.length
    ? `Supprimer le bordereau ${b?.numero || ''} (${b?.compagnie || ''}) ?\n\n${commissionsLiees.length} commission(s) rapprochée(s) seront déliées et repasseront en statut "en attente".\n\nCette action est irréversible.`
    : `Supprimer définitivement le bordereau ${b?.numero || ''} (${b?.compagnie || ''}) ?\n\nCette action est irréversible.`;
  if (!confirm(msg)) return;

  // Délier les commissions liées (elles redeviennent en_attente, sans bordereau_id ni montant_final)
  let echecsDeliage = 0;
  for (const c of commissionsLiees) {
    const r0 = await dbPatch('commissions_attente', c.id, { bordereau_id: null, montant_final: null, statut: 'en_attente' });
    if (r0 && r0.error) echecsDeliage++;
  }
  if (echecsDeliage > 0) {
    showError(`⚠️ ${echecsDeliage} commission(s) sur ${commissionsLiees.length} n'ont pas pu être déliée(s) — vérifie-les manuellement avant de continuer.`);
    return;
  }

  const token = await getValidAccessToken() || SUPABASE_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bordereaux?id=eq.${bordereauId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) { showError('Erreur lors de la suppression du bordereau.'); return; }

  logAction('delete_bordereau', 'bordereaux', bordereauId, b?.numero || null);
  allBordereaux = await dbGet('bordereaux', 'select=*');
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  document.getElementById('modal-edit-bordereau')?.remove();
  navigate('bordereaux');
}

async function saveEditBordereau(bordereauId) {
  const body = {
    compagnie: document.getElementById('eb-compagnie').value.trim(),
    mois: `${document.getElementById('eb-mois-select').value} ${document.getElementById('eb-annee-select').value}`,
    montant_brut: Number(document.getElementById('eb-montant').value) || 0,
    taux_caution: Number(document.getElementById('eb-caution').value) || 0,
    statut: document.getElementById('eb-statut').value,
    date_reception: document.getElementById('eb-date').value || null,
  };
  const btn = document.querySelector('#modal-edit-bordereau .btn-save');
  if (btn) { btn.textContent = 'Enregistrement...'; btn.disabled = true; }
  const r = await dbPatch('bordereaux', bordereauId, body);
  if (r && r.error) { showError('Erreur: ' + errMsg(r)); if (btn) { btn.textContent = '✓ Enregistrer'; btn.disabled = false; } return; }
  logAction('edit_bordereau', 'bordereaux', bordereauId, body.compagnie);
  allBordereaux = await dbGet('bordereaux', 'select=*');
  document.getElementById('modal-edit-bordereau').remove();
  navigate('bordereaux');
}

// ═══ RAPPROCHEMENT BORDEREAU ↔ COMMISSION (façon Noovo) ═══
function showModalValidationCommission(bordereauId) {
  const b = allBordereaux.find(x => x.id === bordereauId);
  if (!b) return;
  const enAttente = allCommissionsAttente.filter(c => (c.compagnie||'').trim().toLowerCase() === (b.compagnie||'').trim().toLowerCase() && c.statut === 'en_attente');

  creerModale('modal-validation', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:0;width:100%;max-width:560px;overflow:hidden">
      <div style="background:#1f2937;padding:18px 24px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:16px;font-weight:800;color:#fff">Validation</div>
        <button onclick="document.getElementById('modal-validation').remove()" style="background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;line-height:1">✕</button>
      </div>
      <div style="padding:24px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Bordereau</div>
        <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:18px">${b.compagnie} (${b.mois})</div>

        <div class="form-grid">
          <div class="form-field" style="grid-column:span 2">
            <label class="form-label">Commission en attente *</label>
            <select class="form-select" id="val-commission" onchange="prefillMontantEstime()">
              <option value="">— Sélectionner —</option>
              ${enAttente.map(c => `<option value="${c.id}" data-montant="${c.montant_estime||0}" data-client="${c.client_nom}">${c.client_nom} — ${c.produit} (CHF ${(c.montant_estime||0).toLocaleString()})</option>`).join('')}
            </select>
            ${enAttente.length === 0 ? `<div style="font-size:11px;color:#f59e0b;margin-top:6px">Aucune commission en attente pour ${b.compagnie}.</div>` : ''}
          </div>

          <div class="form-field"><label class="form-label">Numéro de police</label><input class="form-input" id="val-police" placeholder="Ex: T302928541"/></div>
          <div class="form-field"><label class="form-label">Mouvement</label><select class="form-select" id="val-mouvement">
            <option value="Commission d'acquisition">Commission d'acquisition</option>
            <option value="Commission de gestion">Commission de gestion</option>
            <option value="Ristourne sur annulation">Ristourne sur annulation</option>
            <option value="Autre">Autre...</option>
          </select></div>

          <div class="form-field" style="grid-column:span 2">
            <label class="form-label">État du contrat</label>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text);cursor:pointer"><input type="radio" name="val-etat" value="vigueur" checked/> Passer le contrat en vigueur</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text);cursor:pointer"><input type="radio" name="val-etat" value="annule"/> Passer le contrat en annulé</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text);cursor:pointer"><input type="radio" name="val-etat" value="aucun"/> Ne pas changer l'état du contrat</label>
            </div>
          </div>

          <div class="form-field" style="grid-column:span 2">
            <label class="form-label">Montant estimé (CHF) — modifiable librement</label>
            <input class="form-input" id="val-montant-base" type="number" step="0.01" value="0.00" oninput="updateValidationPreview()"/>
          </div>

          <div class="form-field"><label class="form-label">Sens</label><select class="form-select" id="val-sens" onchange="updateValidationPreview()">
            <option value="credit">Crédit [+]</option>
            <option value="debit">Débit [-] (décommission)</option>
          </select></div>
          <div class="form-field"><label class="form-label">Déduction (%)</label><input class="form-input" id="val-deduction" type="number" step="0.1" min="0" max="100" value="0" oninput="updateValidationPreview()"/></div>

          <div class="form-field" style="grid-column:span 2">
            <label class="form-label">Montant final de la commission (CHF)</label>
            <input class="form-input" id="val-montant" type="number" step="0.01" style="font-size:22px;font-weight:800;text-align:center" value="0.00"/>
            <div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">Pré-calculé depuis le montant de base et la déduction — modifie-le librement si le montant réel du bordereau diffère.</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn-secondary" onclick="document.getElementById('modal-validation').remove()">✕ Annuler</button>
          <button class="btn-save" onclick="saveValidationCommission('${bordereauId}')">✓ Valider</button>
        </div>
      </div>
    </div>`);
}

function prefillMontantEstime() {
  const sel = document.getElementById('val-commission');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('val-montant-base').value = opt ? Number(opt.dataset.montant || 0).toFixed(2) : '0.00';
  updateValidationPreview();
}

function updateValidationPreview() {
  const montantBase = Number(document.getElementById('val-montant-base').value) || 0;
  const deduction = Number(document.getElementById('val-deduction').value) || 0;
  const sens = document.getElementById('val-sens').value;
  let montant = montantBase * (1 - deduction/100);
  if (sens === 'debit') montant = -Math.abs(montant);
  document.getElementById('val-montant').value = montant.toFixed(2);
}

async function saveValidationCommission(bordereauId) {
  const commId = document.getElementById('val-commission').value;
  if (!commId) { showError('Sélectionne une commission en attente.'); return; }
  const etat = document.querySelector('input[name="val-etat"]:checked').value;
  const montantEstime = Number(document.getElementById('val-montant-base').value) || 0;
  const montantFinal = Number(document.getElementById('val-montant').value) || 0;
  const deduction = Number(document.getElementById('val-deduction').value) || 0;
  const sens = document.getElementById('val-sens').value;
  const numeroPolice = document.getElementById('val-police').value.trim() || null;
  const mouvement = document.getElementById('val-mouvement').value;

  const btn = document.querySelector('#modal-validation .btn-save');
  if (btn) { btn.textContent = 'Validation...'; btn.disabled = true; }

  // La date de réception doit refléter le moment où Assurex encaisse réellement l'argent —
  // pas la période couverte par le document (le bordereau peut concerner "Mai 2026" alors
  // que l'argent n'entre chez Assurex qu'aujourd'hui). On ne reprend la date du bordereau
  // QUE si elle est déjà cohérente avec la fusion (≥ 01.06.2026) ; sinon, date du jour.
  const bordereauConcerne = allBordereaux.find(bd => bd.id === bordereauId);
  const dateBordereauValide = bordereauConcerne?.date_reception && bordereauConcerne.date_reception >= DATE_BASCULE_ASSUREX;
  const dateReceptionFinale = dateBordereauValide ? bordereauConcerne.date_reception : new Date().toISOString().split('T')[0];

  const res = await dbPatch('commissions_attente', commId, {
    statut: 'reçue',
    bordereau_id: bordereauId,
    numero_police: numeroPolice,
    montant_estime: montantEstime,
    montant_final: montantFinal,
    sens, deduction_pct: deduction, mouvement,
    date_reception: dateReceptionFinale,
  });
  if (res && res.error) {
    showError('Erreur lors de la validation : ' + (res.detail?.message || res.detail || res.status));
    if (btn) { btn.textContent = '✓ Valider'; btn.disabled = false; }
    return;
  }

  const comm = allCommissionsAttente.find(c => c.id === commId);
  if (comm && comm.contrat_id && etat !== 'aucun') {
    const nouveauStatut = etat === 'vigueur' ? 'actif' : 'résilié';
    const rContrat = await dbPatch('contrats', comm.contrat_id, { statut: nouveauStatut, numero_police: numeroPolice || undefined });
    if (rContrat && rContrat.error) {
      showError('Commission validée, mais le statut du contrat n\u2019a pas pu être mis à jour : ' + errMsg(rContrat) + ' — corrige-le manuellement sur la fiche contrat.');
    }
    allContrats = await dbGet('contrats', 'select=*');
  }

  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  document.getElementById('modal-validation').remove();
  navigate('bordereaux');
}

// COMMISSIONS
function splitMontantAgent(montant, contratId) {
  const contrat = contratId ? allContrats.find(ct => ct.id === contratId) : null;
  const agent = contrat ? allAgents.find(a => a.id === contrat.apporteur_id) : null;
  const tauxAgent = (agent && agent.role !== 'signataire') ? (agent.taux || 0) : 0;
  const pA = Math.round(montant * tauxAgent / 100);
  const pJ = montant - pA;
  return { pJ, pA, agent };
}

function viewCommissions() {
  const COMMS = allCommissionsAttente.filter(c => c.statut === 'reçue');
  function montantC(c) { return c.montant_final != null ? c.montant_final : (c.montant_estime || 0); }

  let totalBrut = 0, partJ = 0, partA = 0;
  COMMS.forEach(c => { const m = montantC(c); const s = splitMontantAgent(m, c.contrat_id); totalBrut += m; partJ += s.pJ; partA += s.pA; });

  // ── Commissions de gestion (récurrentes) ──
  const gestion = COMMS.filter(c => (c.mouvement || '').toLowerCase().includes('gestion'));
  const parMoisGestion = {};
  const parCompagnieGestion = {};
  let totalGestion = 0;
  gestion.forEach(c => {
    const m = montantC(c);
    totalGestion += m;
    const b = c.bordereau_id ? allBordereaux.find(bd => bd.id === c.bordereau_id) : null;
    const moisKey = b ? b.mois : (c.date_creation || '').slice(0,7);
    parMoisGestion[moisKey] = (parMoisGestion[moisKey] || 0) + m;
    parCompagnieGestion[c.compagnie] = (parCompagnieGestion[c.compagnie] || 0) + m;
  });
  const moisGestionKeys = Object.keys(parMoisGestion).sort();
  const maxMoisGestion = Math.max(...moisGestionKeys.map(k => parMoisGestion[k]), 1);
  const compGestion = Object.entries(parCompagnieGestion).sort((a,b)=>b[1]-a[1]);

  const cols = '1fr 130px 90px 100px 110px';
  const rows = COMMS.map(c => {
    const m = montantC(c);
    const s = splitMontantAgent(m, c.contrat_id);
    return `<div class="table-row" style="grid-template-columns:${cols}">
      <div style="font-size:13px;font-weight:600;color:var(--text)">${c.client_nom || '—'}</div>
      <div style="font-size:11px;color:var(--text-muted)">${c.produit || ''}${c.mouvement ? ' · ' + c.mouvement : ''}</div>
      <div style="font-weight:800;color:var(--text)">CHF ${m.toLocaleString()}</div>
      <div style="font-weight:800;color:#38bdf8">CHF ${s.pJ.toLocaleString()}</div>
      <div>${s.pA > 0 ? `<div style="display:flex;align-items:center;gap:6px">${s.agent ? avatar(s.agent, 18) : ''}<span style="font-weight:700;color:#f59e0b">CHF ${s.pA.toLocaleString()}</span></div>` : '<span style="color:var(--text-dim)">—</span>'}</div>
    </div>`;
  }).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Commissions</h2>
      <button class="btn-add" onclick="navigate('fiche-commission')">📄 Générer une fiche de commission</button>
    </div>
    <div class="stat-grid" style="margin-bottom:24px">
      ${statCard('Brut total', 'CHF ' + totalBrut.toLocaleString(), '#e2e8f0')}
      ${statCard('Part Jonathan', 'CHF ' + partJ.toLocaleString(), '#38bdf8')}
      ${statCard('Part apporteurs', 'CHF ' + partA.toLocaleString(), '#f59e0b')}
    </div>

    <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px">🔁 Commissions de gestion (récurrentes)</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Suivi de ce qui a été reçu — total : <strong style="color:#4ade80">CHF ${totalGestion.toLocaleString()}</strong> sur ${gestion.length} mouvement(s)</div>
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px;margin-bottom:24px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:14px">Évolution par période</div>
        ${moisGestionKeys.length ? `<div style="display:flex;align-items:flex-end;gap:6px;height:110px">
          ${moisGestionKeys.map(k => {
            const h = Math.max(Math.round(parMoisGestion[k]/maxMoisGestion*100), 3);
            return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0">
              <div title="CHF ${Math.round(parMoisGestion[k]).toLocaleString()}" style="width:100%;max-width:28px;height:${h}px;background:linear-gradient(180deg,#4ade80,#16a34a);border-radius:4px 4px 2px 2px"></div>
              <div style="font-size:8.5px;color:var(--text-muted);margin-top:5px;white-space:nowrap;overflow:hidden;max-width:40px">${k}</div>
            </div>`;
          }).join('')}
        </div>` : '<div class="table-empty">Aucune commission de gestion encore rapprochée.</div>'}
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:14px">Par compagnie</div>
        ${compGestion.map(([comp,val]) => `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:11.5px"><span style="color:var(--text)">${comp}</span><span style="color:#4ade80;font-weight:700">CHF ${Math.round(val).toLocaleString()}</span></div>
            <div style="height:6px;border-radius:3px;background:var(--border);margin-top:4px;overflow:hidden"><div style="height:100%;width:${compGestion.length?Math.round(val/compGestion[0][1]*100):0}%;background:#4ade80;border-radius:3px"></div></div>
          </div>`).join('') || '<div class="table-empty">—</div>'}
      </div>
    </div>

    <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px">Toutes les commissions reçues (${COMMS.length})</div>
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}"><div>Client</div><div>Produit / Mouvement</div><div>Brut</div><div>Jonathan</div><div>Apporteur</div></div>
      ${rows || '<div class="table-empty">Aucune commission reçue encore rapprochée.</div>'}
    </div>`;
}

// ═══ FICHE DE COMMISSION ═══
function viewFicheCommission() {
  const moisDisponibles = [...new Set(allBordereaux.map(b => b.mois).filter(Boolean))].sort();
  const agentOptions = allAgents.map(a => `<option value="${a.id}">${a.prenom} ${a.nom} (${a.role})</option>`).join('');

  return `
    <button onclick="navigate('commissions')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour aux commissions</button>
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:800;color:var(--text)">Fiche de commission</h2>
    ${sectionCard('Sélection', '#38bdf8', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Agent *</label><select class="form-select" id="fs-agent"><option value="">— Sélectionner —</option>${agentOptions}</select></div>
      <div class="form-field"><label class="form-label">Période (mois du bordereau) *</label><select class="form-select" id="fs-mois">
        <option value="">— Sélectionner —</option>
        ${moisDisponibles.map(m => `<option value="${m}">${m}</option>`).join('')}
      </select></div>
    </div>
    <button class="btn-add" style="margin-top:16px" onclick="genererFicheCommission()">⚙ Générer la fiche</button>`)}

    <div id="fiche-commission-resultat" style="margin-top:24px"></div>`;
}

function genererFicheCommission() {
  const agentId = document.getElementById('fs-agent').value;
  const mois = document.getElementById('fs-mois').value;
  const zone = document.getElementById('fiche-commission-resultat');
  if (!agentId || !mois) { zone.innerHTML = '<div class="table-empty">Sélectionne un agent et une période.</div>'; return; }

  const agent = allAgents.find(a => a.id === agentId);
  const bordereauxMois = allBordereaux.filter(b => b.mois === mois).map(b => b.id);
  const lignes = allCommissionsAttente.filter(c =>
    c.statut === 'reçue' && bordereauxMois.includes(c.bordereau_id) &&
    c.contrat_id && allContrats.find(ct => ct.id === c.contrat_id && ct.apporteur_id === agentId)
  );

  function montantC(c) { return c.montant_final != null ? c.montant_final : (c.montant_estime || 0); }
  const isSignataire = agent.role === 'signataire';
  let totalBrut = 0, totalPart = 0;
  const detail = lignes.map(c => {
    const m = montantC(c);
    const s = splitMontantAgent(m, c.contrat_id);
    const tauxAgent = isSignataire ? 100 : (agent.taux || 0);
    const part = isSignataire ? s.pJ : s.pA;
    totalBrut += m; totalPart += part;
    return { ...c, montant: m, part, tauxAgent };
  });

  const dateGen = new Date().toLocaleDateString('fr-CH', { day:'2-digit', month:'long', year:'numeric' });

  zone.innerHTML = `
    <div class="fiche-commission-print" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
        <div>
          <div style="font-size:16px;font-weight:900;color:var(--text)">FICHE DE COMMISSION</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Assurex Sàrl · Rue du Centre 142, 1025 St-Sulpice VD</div>
        </div>
        <button onclick="window.print()" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;padding:8px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">🖨️ Imprimer / PDF</button>
      </div>
      <div style="display:flex;gap:30px;margin-bottom:20px;font-size:13px">
        <div><div style="color:var(--text-muted);font-size:11px;text-transform:uppercase">Bénéficiaire</div><div style="font-weight:700;color:var(--text)">${agent.prenom} ${agent.nom} (${agent.role})</div></div>
        <div><div style="color:var(--text-muted);font-size:11px;text-transform:uppercase">Période</div><div style="font-weight:700;color:var(--text)">${mois}</div></div>
        <div><div style="color:var(--text-muted);font-size:11px;text-transform:uppercase">Généré le</div><div style="font-weight:700;color:var(--text)">${dateGen}</div></div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:20px">
        <thead><tr style="color:var(--text-muted);font-size:10.5px;text-transform:uppercase">
          <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Client</th>
          <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Produit</th>
          <th style="padding:7px 10px;text-align:right;border-bottom:1px solid var(--border)">Commission brute</th>
          <th style="padding:7px 10px;text-align:right;border-bottom:1px solid var(--border)">Taux</th>
          <th style="padding:7px 10px;text-align:right;border-bottom:1px solid var(--border)">Part due</th>
        </tr></thead>
        <tbody>${detail.map(d => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:7px 10px;color:var(--text)">${d.client_nom || '—'}</td>
            <td style="padding:7px 10px;color:var(--text-muted)">${d.produit || ''}</td>
            <td style="padding:7px 10px;text-align:right;color:var(--text)">CHF ${d.montant.toLocaleString()}</td>
            <td style="padding:7px 10px;text-align:right;color:var(--text-muted)">${d.tauxAgent}%</td>
            <td style="padding:7px 10px;text-align:right;font-weight:700;color:#f59e0b">CHF ${d.part.toLocaleString()}</td>
          </tr>`).join('') || `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-muted)">Aucune commission rapprochée pour cet agent sur cette période.</td></tr>`}
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;gap:30px;border-top:1px solid var(--border);padding-top:14px">
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Total brut</div><div style="font-size:16px;font-weight:800;color:var(--text)">CHF ${totalBrut.toLocaleString()}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Total dû à ${agent.prenom}</div><div style="font-size:20px;font-weight:900;color:#f59e0b">CHF ${totalPart.toLocaleString()}</div></div>
      </div>
    </div>`;
}

// NOUVEAU CLIENT
function viewNouveauClient() {
  return `
    <button onclick="navigate('clients')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour aux clients</button>
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:800;color:var(--text)">Nouveau client</h2>
    <div style="color:var(--text-muted);font-size:13px;margin-bottom:28px">Choisissez le type de client</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:580px">
      <button onclick="showFormClient('prive')" style="background:var(--surface);border:2px solid var(--border);border-radius:14px;padding:32px 24px;cursor:pointer;text-align:center;transition:all 0.15s"
        onmouseover="this.style.borderColor='#38bdf8';this.style.background='rgba(56,189,248,0.05)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">
        <div style="font-size:40px;margin-bottom:12px">👤</div>
        <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">Privé</div>
        <div style="font-size:12px;color:var(--text-muted)">Particulier, famille, indépendant</div>
      </button>
      <button onclick="showFormClient('entreprise')" style="background:var(--surface);border:2px solid var(--border);border-radius:14px;padding:32px 24px;cursor:pointer;text-align:center;transition:all 0.15s"
        onmouseover="this.style.borderColor='#f59e0b';this.style.background='rgba(245,158,11,0.05)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">
        <div style="font-size:40px;margin-bottom:12px">🏢</div>
        <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">Entreprise</div>
        <div style="font-size:12px;color:var(--text-muted)">PME, SA, Sàrl, association</div>
      </button>
    </div>`;
}

function showFormClient(type) {
  const main = document.getElementById('main-content');
  if (type === 'prive') {
    main.innerHTML = formPrive();
    setTimeout(() => bindAdresseAutocomplete({ adresseId:'f-adresse', npaId:'f-npa', villeId:'f-ville', cantonId:'f-canton' }), 0);
  } else {
    main.innerHTML = formEntreprise();
    setTimeout(() => bindAdresseAutocomplete({ adresseId:'e-adresse', npaId:null, villeId:'e-ville', cantonId:null }), 0);
  }
  insertBackBar({ homeId: 'clients', homeLabel: 'Clients', itemLabel: type === 'prive' ? 'Nouveau client privé' : 'Nouveau client entreprise' });
}

function formPrive() {
  const agentOptions = allAgents.map(a => `<option value="${a.id}" ${currentUser && a.email === currentUser.email ? 'selected' : ''}>${a.prenom} ${a.nom}</option>`).join('');
  return `
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:800;color:var(--text)">Nouveau client — Privé</h2>
    ${sectionCard('Identité', '#38bdf8', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Prénom *</label><input class="form-input" id="f-prenom" placeholder="Jean"/></div>
      <div class="form-field"><label class="form-label">Nom *</label><input class="form-input" id="f-nom" placeholder="Dupont"/></div>
      <div class="form-field"><label class="form-label">Date de naissance</label><input class="form-input" id="f-dob" type="date"/></div>
      <div class="form-field"><label class="form-label">Nationalité</label><input class="form-input" id="f-nationalite" placeholder="Suisse"/></div>
      <div class="form-field"><label class="form-label">État civil</label><select class="form-select" id="f-etat"><option value="">—</option><option>Célibataire</option><option>Marié</option><option>Divorcé</option><option>Divorcée</option><option>Veuf</option><option>Veuve</option><option>Pacsé</option><option>Pacsée</option></select></div>
      <div class="form-field"><label class="form-label">Enfants</label><input class="form-input" id="f-enfants" type="number" value="0"/></div>
      <div class="form-field"><label class="form-label">N° AVS</label><input class="form-input" id="f-avs" placeholder="756.XXXX.XXXX.XX"/></div>
      <div class="form-field"><label class="form-label">Langue</label><select class="form-select" id="f-langue"><option value="FR">Français</option><option value="DE">Allemand</option><option value="IT">Italien</option></select></div>
    </div>`)}
    ${sectionCard('Contact', '#f59e0b', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Email *</label><input class="form-input" id="f-email" type="email" placeholder="jean@email.ch"/></div>
      <div class="form-field"><label class="form-label">Mobile</label><input class="form-input" id="f-mobile" placeholder="+41 79 XXX XX XX"/></div>
      <div class="form-field"><label class="form-label">Téléphone fixe</label><input class="form-input" id="f-tel" placeholder="+41 21 XXX XX XX"/></div>
      <div class="form-field"><label class="form-label">Adresse *</label><input class="form-input" id="f-adresse" placeholder="Rue de la Paix 1"/></div>
      <div class="form-field"><label class="form-label">c/o (optionnel)</label><input class="form-input" id="f-co" placeholder="c/o Nom Prénom"/></div>
      <div class="form-field"><label class="form-label">NPA *</label><input class="form-input" id="f-npa" placeholder="1000"/></div>
      <div class="form-field"><label class="form-label">Ville</label><input class="form-input" id="f-ville" placeholder="Lausanne"/></div>
      <div class="form-field"><label class="form-label">Canton</label><input class="form-input" id="f-canton" placeholder="VD"/></div>
    </div>`)}
    ${sectionCard('Coordonnées bancaires', '#a78bfa', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Banque</label><input class="form-input" id="f-banque" placeholder="UBS SA Lausanne"/></div>
      <div class="form-field"><label class="form-label">IBAN</label><input class="form-input" id="f-iban" placeholder="CH56 0483 5012 3456 7800 9"/></div>
    </div>`)}
    ${sectionCard('Situation professionnelle', '#4ade80', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Profession</label><input class="form-input" id="f-profession" placeholder="Ingénieur"/></div>
      <div class="form-field"><label class="form-label">Employeur</label><input class="form-input" id="f-employeur" placeholder="EPFL"/></div>
      <div class="form-field"><label class="form-label">Revenu annuel brut (CHF)</label><input class="form-input" id="f-revenu" type="number" placeholder="80000"/></div>
      <div class="form-field"><label class="form-label">Taux activité %</label><input class="form-input" id="f-taux" type="number" value="100"/></div>
    </div>`)}
    ${sectionCard('CRM', '#38bdf8', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Statut</label><select class="form-select" id="f-statut"><option value="prospect">Prospect</option><option value="actif">Actif</option><option value="inactif">Inactif</option></select></div>
      <div class="form-field"><label class="form-label">Source du lead (apporteur interne)</label><select class="form-select" id="f-agent"><option value="">— Sélectionner —</option>${agentOptions}</select></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Apporteur / Recommandation externe</label><input class="form-input" id="f-apporteur-ext" placeholder="Ex: Luca Renda, BNI Lavaux, Hôtel Modern Times…"/></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Notes</label><textarea class="form-input" id="f-notes" rows="3" style="resize:vertical"></textarea></div>
    </div>`)}
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn-secondary" onclick="navigate('clients')">Annuler</button>
      <button onclick="window.print()" style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:10px 20px;font-weight:700;font-size:13px;cursor:pointer;color:var(--text-muted)">🖨️ Imprimer</button>
      <button class="btn-save" onclick="saveClient()">✓ Enregistrer</button>
    </div>`;
}

async function saveClient() {
  const prenom = document.getElementById('f-prenom').value.trim();
  const nom = document.getElementById('f-nom').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const adresse = document.getElementById('f-adresse').value.trim();
  const npa = document.getElementById('f-npa').value.trim();
  const missing = [];
  if (!prenom) missing.push('Prénom');
  if (!nom) missing.push('Nom');
  if (!email) missing.push('Email');
  if (!adresse) missing.push('Adresse');
  if (!npa) missing.push('NPA');
  if (missing.length > 0) { alert('Champs obligatoires manquants : ' + missing.join(', ')); return; }
  const body = {
    prenom, nom,
    date_naissance: document.getElementById('f-dob').value || null,
    nationalite: document.getElementById('f-nationalite').value || null,
    etat_civil: document.getElementById('f-etat').value || null,
    enfants: parseInt(document.getElementById('f-enfants').value) || 0,
    avs: document.getElementById('f-avs').value || null,
    langue: document.getElementById('f-langue').value,
    email: document.getElementById('f-email').value || null,
    mobile: document.getElementById('f-mobile').value || null,
    tel: document.getElementById('f-tel').value || null,
    adresse: document.getElementById('f-adresse').value || null,
    co: document.getElementById('f-co').value.trim() || null,
    npa: document.getElementById('f-npa').value || null,
    ville: document.getElementById('f-ville').value || null,
    canton: document.getElementById('f-canton').value || null,
    banque: document.getElementById('f-banque').value || null,
    iban: document.getElementById('f-iban').value || null,
    profession: document.getElementById('f-profession').value || null,
    employeur: document.getElementById('f-employeur').value || null,
    revenu: parseInt(document.getElementById('f-revenu').value) || 0,
    taux_activite: parseInt(document.getElementById('f-taux').value) || 100,
    statut: document.getElementById('f-statut').value,
    segment: 'Privé',
    apporteur_id: document.getElementById('f-agent').value || null,
    apporteur_externe: document.getElementById('f-apporteur-ext').value.trim() || null,
    notes: document.getElementById('f-notes').value || null,
  };
  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;
  const result = await dbPost('clients', body);
  if (result && !result.error) {
    allClients = await dbGet('clients', 'select=*');
    const nouveauId = (result[0] && result[0].id) || allClients.slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0))[0]?.id;
    if (nouveauId) { await showClient(nouveauId); } else { showError('Client créé mais introuvable — vérifie la liste.'); navigate('clients'); }
  } else {
    btn.textContent = 'Erreur — réessayer';
    btn.disabled = false;
    const detail = result && result.detail ? JSON.stringify(result.detail) : 'connexion';
    alert('Erreur lors de l\'enregistrement (' + detail + '). Vérifiez les champs et réessayez.');
  }
}

function formEntreprise() {
  const agentOptions = allAgents.map(a => `<option value="${a.id}" ${currentUser && a.email === currentUser.email ? 'selected' : ''}>${a.prenom} ${a.nom}</option>`).join('');
  return `
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:800;color:var(--text)">Nouveau client — Entreprise</h2>
    <div style="display:flex;gap:10px;margin-bottom:20px">
      <button onclick="printForm()" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">🖨️ Imprimer</button>
    </div>
    ${sectionCard('Identification', '#f59e0b', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Raison sociale *</label>
        <div style="display:flex;gap:6px">
          <input class="form-input" id="e-nom" placeholder="Dupont SA" style="flex:1"/>
          <button type="button" onclick="rechercheZefix('e-nom')" title="Rechercher sur le registre du commerce (Zefix)" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;padding:0 12px;color:var(--text-muted);cursor:pointer;font-size:14px;white-space:nowrap">🔍 Zefix</button>
        </div>
      </div>
      <div class="form-field"><label class="form-label">Forme juridique</label><select class="form-select" id="e-forme"><option>SA</option><option>Sàrl</option><option>Association</option><option>Fondation</option><option>Indépendant</option><option>Autre</option></select></div>
      <div class="form-field"><label class="form-label">N° IDE (CHE)</label><input class="form-input" id="e-ide" placeholder="CHE-123.456.789"/></div>
      <div class="form-field"><label class="form-label">Secteur d'activité</label><input class="form-input" id="e-secteur" placeholder="Construction, Restauration..."/></div>
      <div class="form-field"><label class="form-label">Activité principale</label><input class="form-input" id="e-activite" placeholder="Décrire l'activité"/></div>
      <div class="form-field"><label class="form-label">Soumis SUVA ?</label><select class="form-select" id="e-suva"><option value="">—</option><option value="oui">Oui</option><option value="non">Non</option></select></div>
    </div>`)}
    ${sectionCard('Contact & Adresse', '#38bdf8', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Adresse *</label><input class="form-input" id="e-adresse" placeholder="Rue du Commerce 1"/></div>
      <div class="form-field"><label class="form-label">c/o (optionnel)</label><input class="form-input" id="e-co" placeholder="c/o Nom Prénom"/></div>
      <div class="form-field"><label class="form-label">NPA / Ville *</label><input class="form-input" id="e-ville" placeholder="1000 Lausanne"/></div>
      <div class="form-field"><label class="form-label">Téléphone</label><input class="form-input" id="e-tel" placeholder="+41 21 XXX XX XX"/></div>
      <div class="form-field"><label class="form-label">Email *</label><input class="form-input" id="e-email" type="email" placeholder="contact@entreprise.ch"/></div>
      <div class="form-field"><label class="form-label">Lieu du risque</label><input class="form-input" id="e-risque" placeholder="Si différent de l'adresse"/></div>
    </div>`)}
    ${sectionCard('Interlocuteur principal', '#a78bfa', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Prénom</label><input class="form-input" id="e-contact-prenom" placeholder="Jean"/></div>
      <div class="form-field"><label class="form-label">Nom</label><input class="form-input" id="e-contact-nom" placeholder="Dupont"/></div>
      <div class="form-field"><label class="form-label">Fonction</label><input class="form-input" id="e-contact-fonction" placeholder="Directeur, RH..."/></div>
      <div class="form-field"><label class="form-label">Mobile direct</label><input class="form-input" id="e-contact-mobile" placeholder="+41 79 XXX XX XX"/></div>
      <div class="form-field"><label class="form-label">N° AVS (pour LPP)</label><input class="form-input" id="e-avs" placeholder="756.XXXX.XXXX.XX"/></div>
      <div class="form-field"><label class="form-label">Statut indépendant</label><select class="form-select" id="e-independant"><option value="non">Non</option><option value="oui">Oui</option></select></div>
    </div>`)}
    ${sectionCard('Données de base de calcul (masse salariale AVS — max. 90\'720)', '#4ade80', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Chiffre d'affaires (CHF)</label><input class="form-input" id="e-ca" type="number" placeholder="500000"/></div>
      <div class="form-field"><label class="form-label">Nb collaborateurs</label><input class="form-input" id="e-collaborateurs" type="number" placeholder="5"/></div>
      <div class="form-field"><label class="form-label">Masse salariale totale (CHF)</label><input class="form-input" id="e-ms-total" type="number" placeholder="250000"/></div>
      <div class="form-field"><label class="form-label">MS chef d'entreprise (CHF)</label><input class="form-input" id="e-ms-chef" type="number" placeholder="120000"/></div>
      <div class="form-field"><label class="form-label">MS AP Hommes (CHF)</label><input class="form-input" id="e-ms-ap-h" type="number" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">MS AP Femmes (CHF)</label><input class="form-input" id="e-ms-ap-f" type="number" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">MS ANP Hommes (CHF)</label><input class="form-input" id="e-ms-anp-h" type="number" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">MS ANP Femmes (CHF)</label><input class="form-input" id="e-ms-anp-f" type="number" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Sal. excéd. AVS H (CHF)</label><input class="form-input" id="e-exc-h" type="number" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Sal. excéd. AVS F (CHF)</label><input class="form-input" id="e-exc-f" type="number" placeholder="0"/></div>
    </div>`)}
    ${sectionCard('Assurances de personnes', '#38bdf8', `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      ${['Perte de gain maladie','LAA','LPP','LAAF (indépendant)','LAAC','Semi-privée'].map(l => `
      <label style="display:flex;align-items:center;gap:8px;background:var(--surface-alt);border-radius:8px;padding:10px 12px;cursor:pointer">
        <input type="checkbox" id="e-ap-${l.replace(/\s/g,'-').toLowerCase()}" style="width:14px;height:14px;accent-color:#38bdf8"/>
        <span style="font-size:12px;color:var(--text);font-weight:600">${l}</span>
      </label>`).join('')}
    </div>
    <div style="margin-top:12px">
      <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:8px">Perte de gain — délai d'attente</div>
      <div style="display:flex;gap:8px">
        ${['14j','30j','60j'].map(d => `<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="e-delai" value="${d}" style="accent-color:#38bdf8"/><span style="font-size:12px;color:var(--text)">${d}</span></label>`).join('')}
      </div>
    </div>`)}
    ${sectionCard('Assurances vie', '#a78bfa', `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
      ${['3a','3a indépendant','3B','Risque pur','Versement unique'].map(l => `
      <label style="display:flex;align-items:center;gap:8px;background:var(--surface-alt);border-radius:8px;padding:10px 12px;cursor:pointer">
        <input type="checkbox" style="width:14px;height:14px;accent-color:#a78bfa"/>
        <span style="font-size:12px;color:var(--text);font-weight:600">${l}</span>
      </label>`).join('')}
    </div>
    <div class="form-grid" style="margin-top:12px">
      <div class="form-field"><label class="form-label">Budget épargne (CHF/an)</label><input class="form-input" id="e-budget-epargne" type="number" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">PA (prime annuelle)</label><input class="form-input" id="e-pa" type="number" placeholder="0"/></div>
    </div>`)}
    ${sectionCard('LPP', '#4ade80', `<div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Sal. min coord. LPP 3780 - max. 64260 CHF - seuil entree 22680 - plafond sans ded. coord. 90720 CHF</div>
    <div class="form-grid">
      <div class="form-field"><label class="form-label">Soumis CCT ?</label><select class="form-select" id="e-cct"><option value="non">Non</option><option value="oui">Oui</option></select></div>
      <div class="form-field"><label class="form-label">Domaine SUVA (monopole accident) ?</label><select class="form-select" id="e-suva"><option value="non">Non</option><option value="oui">Oui</option></select></div>
      <div class="form-field"><label class="form-label">Taux LPP souhaité</label><select class="form-select" id="e-taux-lpp"><option>Min. légal 7/10/15/18</option><option>Spécifique</option></select></div>
      <div class="form-field"><label class="form-label">Capital invalidité souhaité (CHF)</label><input class="form-input" id="e-cap-invalidite" type="number" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Capital décès souhaité (CHF)</label><input class="form-input" id="e-cap-deces" type="number" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Améliorations</label><input class="form-input" id="e-ameliorations" placeholder="rentes, épargne, tranches..."/></div>
      <div class="form-field"><label class="form-label">Déduction coordinée</label><select class="form-select" id="e-ded-coord"><option>Avec déd. coord.</option><option>Sans déd. coord.</option></select></div>
    </div>`)}
    ${sectionCard('Responsabilité civile & Assurances choses', '#f87171', `<div class="form-grid">
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Risque particulier dans le domaine d'activité ?</label><input class="form-input" id="e-rc-risque" placeholder="Décrire si applicable"/></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Lieux d'exploitation</label><input class="form-input" id="e-lieux" placeholder="Tous les lieux de risque"/></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
      ${['RC/Commerce','Inventaire','Protection juridique','Perte exploitation','Machines','Vol','All Risk','Transports','Cyber','Construction/MO'].map(l => `
      <label style="display:flex;align-items:center;gap:8px;background:var(--surface-alt);border-radius:8px;padding:10px 12px;cursor:pointer">
        <input type="checkbox" style="width:14px;height:14px;accent-color:#f87171"/>
        <span style="font-size:12px;color:var(--text);font-weight:600">${l}</span>
      </label>`).join('')}
    </div>
    <div class="form-grid" style="margin-top:12px">
      <div class="form-field"><label class="form-label">Inventaire — somme assurée (CHF)</label><input class="form-input" id="e-inventaire" type="number" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Perte exploitation (CHF)</label><input class="form-input" id="e-perte-exploit" type="number" placeholder="0"/></div>
    </div>`)}
    ${sectionCard('Véhicules', '#64748b', `<div class="form-grid">
      <div class="form-field"><label class="form-label">N° plaque 1</label><input class="form-input" id="e-plaque1" placeholder="VD 123456"/></div>
      <div class="form-field"><label class="form-label">Modèle 1</label><input class="form-input" id="e-modele1" placeholder="VW Transporter"/></div>
      <div class="form-field"><label class="form-label">N° plaque 2</label><input class="form-input" id="e-plaque2" placeholder="VD 654321"/></div>
      <div class="form-field"><label class="form-label">Modèle 2</label><input class="form-input" id="e-modele2" placeholder=""/></div>
    </div>`)}
    ${sectionCard('CRM', '#38bdf8', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Statut</label><select class="form-select" id="e-statut"><option value="prospect">Prospect</option><option value="actif">Actif</option></select></div>
      <div class="form-field"><label class="form-label">Source du lead (apporteur interne)</label><select class="form-select" id="e-agent"><option value="">— Sélectionner —</option>${agentOptions}</select></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Apporteur / Recommandation externe</label><input class="form-input" id="e-apporteur-ext" placeholder="Ex: Luca Renda, BNI Lavaux, Hôtel Modern Times…"/></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Notes</label><textarea class="form-input" id="e-notes" rows="3" style="resize:vertical"></textarea></div>
    </div>`)}
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn-secondary" onclick="navigate('clients')">Annuler</button>
      <button onclick="printEntreprise()" style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:10px 20px;font-weight:700;font-size:13px;cursor:pointer;color:var(--text-muted)">🖨️ Imprimer PDF</button>
      <button class="btn-save" onclick="saveEntreprise()">✓ Enregistrer</button>
    </div>`;
}

async function saveEntreprise() {
  const nom = document.getElementById('e-nom').value.trim();
  const email = document.getElementById('e-email').value.trim();
  const adresse = document.getElementById('e-adresse').value.trim();
  const ville = document.getElementById('e-ville').value.trim();
  const missing = [];
  if (!nom) missing.push('Raison sociale');
  if (!email) missing.push('Email');
  if (!adresse) missing.push('Adresse');
  if (!ville) missing.push('NPA / Ville');
  if (missing.length > 0) { alert('Champs obligatoires manquants : ' + missing.join(', ')); return; }
  const contact = (document.getElementById('e-contact-prenom').value + ' ' + document.getElementById('e-contact-nom').value).trim();
  const body = {
    prenom: contact || document.getElementById('e-contact-prenom').value || '',
    nom,
    email: document.getElementById('e-email').value || null,
    tel: document.getElementById('e-tel').value || null,
    adresse: document.getElementById('e-adresse').value || null,
    co: document.getElementById('e-co').value.trim() || null,
    ville: document.getElementById('e-ville').value || null,
    avs: document.getElementById('e-avs').value || null,
    profession: document.getElementById('e-secteur').value || null,
    employeur: nom,
    revenu: parseInt(document.getElementById('e-ca').value) || 0,
    taux_activite: parseInt(document.getElementById('e-collaborateurs').value) || 0,
    statut: document.getElementById('e-statut').value,
    segment: 'Entreprise',
    cct: document.getElementById('e-cct').value === 'oui',
    domaine_suva: document.getElementById('e-suva').value === 'oui',
    ide: document.getElementById('e-ide').value.trim() || null,
    apporteur_id: document.getElementById('e-agent').value || null,
    apporteur_externe: document.getElementById('e-apporteur-ext').value.trim() || null,
    notes: document.getElementById('e-notes').value || null,
  };
  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;
  const result = await dbPost('clients', body);
  if (result && !result.error) {
    allClients = await dbGet('clients', 'select=*');
    const nouveauId = (result[0] && result[0].id) || allClients.slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0))[0]?.id;
    if (nouveauId) { await showClient(nouveauId); } else { showError('Client créé mais introuvable — vérifie la liste.'); navigate('clients'); }
  } else {
    btn.textContent = 'Erreur — réessayer';
    btn.disabled = false;
    const detail = result && result.detail ? JSON.stringify(result.detail) : 'connexion';
    alert('Erreur lors de l\'enregistrement (' + detail + '). Vérifiez les champs et réessayez.');
  }
}

function printEntreprise() {
  window.print();
}

// NOUVELLE OPPORTUNITE
// ═══ DEMANDE D'OFFRE (digital, miroir du formulaire papier) ═══
function ckb(id, label) {
  return `<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--text);cursor:pointer;margin-bottom:6px"><input type="checkbox" id="${id}" style="width:15px;height:15px;accent-color:var(--accent)"/> ${label}</label>`;
}

async function viewNouvelleDemandeOffre() {
  const clientOptions = allClients.map(c => `<option value="${c.id}">${estEntreprise(c) ? c.nom : c.prenom + ' ' + c.nom}</option>`).join('');
  const contactsCompagnies = await dbGet('compagnies_contacts', 'select=*&order=compagnie.asc');
  window._doContacts = contactsCompagnies || [];
  return `
    <button onclick="navigate('suivi')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour</button>
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:800;color:var(--text)">Demande d'offre</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">Version digitale du formulaire papier — à remplir directement en clientèle, sans ressaisie ensuite.</div>

    <div style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:12px;padding:16px 18px;margin-bottom:24px">
      <div style="font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:8px">🤖 Remplissage automatique par IA</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px">Décris la situation à l'oral (utilise le micro 🎤 du clavier de ton téléphone) ou par écrit — les cases et champs ci-dessous se rempliront automatiquement. Tu pourras tout vérifier/corriger avant d'enregistrer.</div>
      <textarea id="do-texte-libre" rows="4" placeholder="Ex: Client Dupont SA, 8 employés, CA 1.2 millions, souhaite une perte de gain maladie délai 30 jours, LPP, et une RC commerce. Pas de protection juridique pour l'instant." style="width:100%;background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;resize:vertical"></textarea>
      <button type="button" class="btn-add" style="margin-top:10px" onclick="remplirDemandeOffreParIA()">✨ Remplir automatiquement</button>
      <div id="do-ia-status" style="font-size:11.5px;color:var(--text-muted);margin-top:8px"></div>
    </div>

    ${sectionCard('Identité', '#38bdf8', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Client existant (optionnel)</label><select class="form-select" id="do-client" onchange="document.getElementById('do-prospect-field').style.display=this.value?'none':''"><option value="">— Prospect non fiché —</option>${clientOptions}</select></div>
      <div class="form-field" id="do-prospect-field"><label class="form-label">Nom/raison sociale</label><input class="form-input" id="do-prospect-nom" placeholder="Si pas encore client"/></div>
      <div class="form-field"><label class="form-label">Prénom/contact</label><input class="form-input" id="do-contact"/></div>
      <div class="form-field"><label class="form-label">Adresse</label><input class="form-input" id="do-adresse"/></div>
      <div class="form-field"><label class="form-label">N° téléphone</label><input class="form-input" id="do-tel"/></div>
      <div class="form-field"><label class="form-label">E-mail</label><input class="form-input" id="do-email" type="email"/></div>
      <div class="form-field"><label class="form-label">N° AVS (pour LPP)</label><input class="form-input" id="do-avs"/></div>
      <div class="form-field"><label class="form-label">Activité principale</label><input class="form-input" id="do-activite"/></div>
      <div class="form-field"><label class="form-label">Lieu du risque</label><input class="form-input" id="do-lieu-risque"/></div>
      <div class="form-field"><label class="form-label">Soumis SUVA ?</label><select class="form-select" id="do-suva"><option value="">—</option><option value="oui">Oui</option><option value="non">Non</option></select></div>
      <div class="form-field"><label class="form-label">Statut indépendant ?</label><select class="form-select" id="do-independant"><option value="">—</option><option value="oui">Oui</option><option value="non">Non</option></select></div>
    </div>`)}

    ${sectionCard('Données de base de calcul', '#a78bfa', `
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Masse salariale AVS – 90'720.- max. – dès 8h hebdo soumis ANP</div>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">Chiffre d'affaires (CHF)</label><input class="form-input" id="do-ca" type="number"/></div>
        <div class="form-field"><label class="form-label">Nombre de collaborateurs</label><input class="form-input" id="do-nb-collab" type="number"/></div>
        <div class="form-field"><label class="form-label">Masse salariale AP — hommes</label><input class="form-input" id="do-ap-h" type="number"/></div>
        <div class="form-field"><label class="form-label">Masse salariale AP — femmes</label><input class="form-input" id="do-ap-f" type="number"/></div>
        <div class="form-field"><label class="form-label">Masse salariale ANP — hommes</label><input class="form-input" id="do-anp-h" type="number"/></div>
        <div class="form-field"><label class="form-label">Masse salariale ANP — femmes</label><input class="form-input" id="do-anp-f" type="number"/></div>
        <div class="form-field"><label class="form-label">Salaire excédentaire AVS — hommes</label><input class="form-input" id="do-exc-avs-h" type="number"/></div>
        <div class="form-field"><label class="form-label">Salaire excédentaire AVS — femmes</label><input class="form-input" id="do-exc-avs-f" type="number"/></div>
        <div class="form-field"><label class="form-label">Masse salariale chef d'entreprise</label><input class="form-input" id="do-masse-chef" type="number"/></div>
      </div>`)}

    ${sectionCard('Assurances de personnes', '#4ade80', `<div class="form-grid">
      <div class="form-field">
        ${ckb('do-perte-gain', 'Perte de gain maladie')}
        <div style="display:flex;gap:14px;margin-left:22px">${ckb('do-pg-14j','14j')}${ckb('do-pg-30j','30j')}${ckb('do-pg-60j','60j')}</div>
      </div>
      <div class="form-field">${ckb('do-laa','LAA')}${ckb('do-laaf','LAAF (indépendant)')}${ckb('do-laac','LAAC')}${ckb('do-semi-privee','Semi-privée')}</div>
      <div class="form-field" style="grid-column:span 2">${ckb('do-lpp','LPP')}</div>
    </div>`)}

    ${sectionCard('Assurances vie', '#f59e0b', `<div class="form-grid">
      <div class="form-field">${ckb('do-3a','3a')}${ckb('do-3a-indep','3a indépendant')}</div>
      <div class="form-field">${ckb('do-3b','3B')}</div>
      <div class="form-field">${ckb('do-risque-pure','Risque pure')}</div>
      <div class="form-field">${ckb('do-versement-unique','Versement unique')}</div>
      <div class="form-field"><label class="form-label">Budget épargne (CHF)</label><input class="form-input" id="do-budget-epargne" type="number"/></div>
      <div class="form-field"><label class="form-label">PA (prévoyance / police existante)</label><input class="form-input" id="do-pa"/></div>
    </div>`)}

    ${sectionCard('Assurances choses', '#fb923c', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Inventaire — somme d'assurance (CHF)</label><input class="form-input" id="do-inventaire" type="number" onfocus="document.getElementById('do-inventaire-ckb').checked=true"/></div>
      <div class="form-field">${ckb('do-rc-commerce','RC/commerce')}${ckb('do-prejudice-fortune','Préjudices de fortune (CV et copie diplômes requis)')}${ckb('do-cyber','Cyber')}</div>
      <div class="form-field">${ckb('do-pj','Protection juridique')}${ckb('do-construction','Construction & maître ouvrage')}${ckb('do-technique','Technique')}${ckb('do-perte-exploit','Perte d\'exploitation')}</div>
    </div>`)}

    ${sectionCard('Données complémentaires — Assurances de personnes', '#4ade80', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Soumis à une CCT ?</label><select class="form-select" id="do-cct"><option value="">—</option><option value="oui">Oui</option><option value="non">Non</option></select></div>
      <div class="form-field"><label class="form-label">Couverture salaire (perte de gain)</label><select class="form-select" id="do-couverture-salaire"><option value="">—</option><option value="80">80%</option><option value="90">90%</option><option value="100">100%</option></select></div>
    </div>`)}

    ${sectionCard('LPP — souhaits client', '#a78bfa', `
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Sal. min coord. LPP 3'780 – max. 64'260 CHF – seuil entrée 22'680 – plafond LPP sans déduct. coord. 90'720 CHF</div>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">Taux par tranches — minimum légal</label><select class="form-select" id="do-taux-min-legal"><option value="">—</option><option value="7/10/15/18">7/10/15/18</option></select></div>
        <div class="form-field"><label class="form-label">Déduction de coordination</label><select class="form-select" id="do-ded-coord"><option value="">—</option><option value="avec">Avec</option><option value="sans">Sans</option></select></div>
        <div class="form-field"><label class="form-label">Salaires excédentaires — hommes</label><input class="form-input" id="do-lpp-exc-h" type="number"/></div>
        <div class="form-field"><label class="form-label">Salaires excédentaires — femmes</label><input class="form-input" id="do-lpp-exc-f" type="number"/></div>
        <div class="form-field"><label class="form-label">Capital invalidité souhaité (CHF)</label><input class="form-input" id="do-cap-invalidite" type="number"/></div>
        <div class="form-field"><label class="form-label">Capital décès souhaité (CHF)</label><input class="form-input" id="do-cap-deces" type="number"/></div>
      </div>
      <div class="form-field" style="margin-top:10px"><label class="form-label">Améliorations générales souhaitées</label>
        <div style="display:flex;gap:16px;flex-wrap:wrap">${ckb('do-amelio-rentes','Rentes')}${ckb('do-amelio-epargne','Épargne')}${ckb('do-amelio-tranches','Tranches de cotisations')}${ckb('do-amelio-rendement','Rendement')}</div>
      </div>`)}

    ${sectionCard('Responsabilité civile', '#f87171', `<div class="form-grid">
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Risque particulier dans le domaine d'activité ?</label><textarea class="form-input" id="do-rc-risque" rows="2"></textarea></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Lieux d'exploitation (tous les lieux de risque)</label><textarea class="form-input" id="do-rc-lieux" rows="2"></textarea></div>
      <div class="form-field">${ckb('do-marchandises','Marchandises à assurer')}${ckb('do-transports','Transports à assurer')}${ckb('do-transports-speciaux','Transports spéciaux')}</div>
      <div class="form-field">${ckb('do-machines','Machines à assurer')}${ckb('do-vol','Vol')}${ckb('do-all-risk','All Risk')}</div>
      <div class="form-field"><label class="form-label">Inventaire — somme d'assurance (CHF)</label><input class="form-input" id="do-rc-inventaire" type="number"/></div>
      <div class="form-field">${ckb('do-rc-prejudice-fortune','Préjudice de fortune (copie CV & diplômes)')}<textarea class="form-input" id="do-rc-cv-details" rows="2" placeholder="Détails CV & formations" style="margin-top:6px"></textarea></div>
    </div>`)}

    ${sectionCard('Véhicules', '#64748b', `<div id="do-plaques-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px"></div>
      <button type="button" class="btn-secondary" style="font-size:12px;padding:6px 14px" onclick="ajouterPlaqueDemandeOffre()">+ Ajouter un véhicule</button>`)}

    ${sectionCard('Envoyer la demande d\'offre à', '#a78bfa', `
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px">Sélectionne les compagnies à solliciter — un email pré-rempli s'ouvrira dans ta messagerie.</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:240px;overflow-y:auto">
        ${contactsCompagnies.map(c => `
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text);cursor:pointer;padding:6px 8px;border-radius:7px;background:var(--surface-alt)">
            <input type="checkbox" class="do-cie-checkbox" value="${c.id}" style="width:15px;height:15px;accent-color:var(--accent)"/>
            <span style="flex:1">${c.compagnie}${c.libelle_contact ? ` <span style="color:var(--text-muted);font-size:11px">— ${c.libelle_contact}</span>` : ''}</span>
            <span style="font-size:11px;color:${c.email ? 'var(--text-muted)' : '#f87171'}">${c.email || 'pas d\'email'}</span>
          </label>`).join('') || '<div class="table-empty">Aucune compagnie enregistrée — ajoute-en dans Paramètres → Contacts compagnies.</div>'}
      </div>
      <button type="button" class="btn-add" style="margin-top:14px" onclick="genererEmailDemandeOffre()">✉️ Générer l'email</button>`)}

    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn-secondary" onclick="navigate('suivi')">Annuler</button>
      <button class="btn-save" onclick="saveDemandeOffre()">✓ Enregistrer la demande d'offre</button>
      <button onclick="window.print()" style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:10px 20px;font-weight:700;font-size:13px;cursor:pointer;color:var(--text-muted)">🖨️ Imprimer</button>
    </div>`;
}

function ajouterPlaqueDemandeOffre() {
  const list = document.getElementById('do-plaques-list');
  const idx = list.children.length;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px';
  row.innerHTML = `<input class="form-input do-plaque-numero" placeholder="N° plaque"/><input class="form-input do-plaque-modele" placeholder="Modèle"/>`;
  list.appendChild(row);
}

function genererEmailDemandeOffre() {
  const checked = [...document.querySelectorAll('.do-cie-checkbox:checked')];
  if (!checked.length) { showError('Sélectionne au moins une compagnie.'); return; }
  const cies = checked.map(el => (window._doContacts || []).find(c => c.id === el.value)).filter(Boolean);
  const emails = cies.map(c => c.email).filter(Boolean);
  const sansEmail = cies.filter(c => !c.email).map(c => c.compagnie);

  const val = id => document.getElementById(id)?.value || '';
  const chk = id => document.getElementById(id)?.checked;
  const nomClient = val('do-client') ? (document.getElementById('do-client').selectedOptions[0]?.text || '') : (val('do-prospect-nom') || 'Client');

  let besoins = [];
  if (chk('do-perte-gain')) besoins.push('Perte de gain maladie' + (chk('do-pg-14j')?' (délai 14j)':chk('do-pg-30j')?' (délai 30j)':chk('do-pg-60j')?' (délai 60j)':''));
  if (chk('do-laa')) besoins.push('LAA');
  if (chk('do-laaf')) besoins.push('LAAF (indépendant)');
  if (chk('do-lpp')) besoins.push('LPP');
  if (chk('do-3a')) besoins.push('Vie 3a');
  if (chk('do-3b')) besoins.push('Vie 3B');
  if (chk('do-rc-commerce')) besoins.push('RC/commerce');
  if (chk('do-cyber')) besoins.push('Cyber');
  if (chk('do-pj')) besoins.push('Protection juridique');
  if (chk('do-construction')) besoins.push('Construction & maître ouvrage');
  if (chk('do-perte-exploit')) besoins.push("Perte d'exploitation");
  if (val('do-inventaire')) besoins.push(`Inventaire (CHF ${val('do-inventaire')})`);

  const lignesInfos = [
    val('do-activite') ? `Activité principale : ${val('do-activite')}` : '',
    val('do-ca') ? `Chiffre d'affaires : CHF ${val('do-ca')}` : '',
    val('do-nb-collab') ? `Nombre de collaborateurs : ${val('do-nb-collab')}` : '',
    val('do-lieu-risque') ? `Lieu du risque : ${val('do-lieu-risque')}` : '',
  ].filter(Boolean);

  const corps = `Bonjour,

Je me permets de solliciter une offre pour le client suivant :

Client : ${nomClient}
${lignesInfos.join('\n')}

Couvertures souhaitées :
${besoins.length ? besoins.map(b => '- ' + b).join('\n') : '- Voir détails ci-dessous'}

Je reste à votre disposition pour toute information complémentaire.

Meilleures salutations,
${currentUser ? currentUser.prenom + ' ' + currentUser.nom : ''}
Assurex Sàrl`;

  const sujet = `Demande d'offre — ${nomClient}`;
  const mailto = `mailto:${emails.join(',')}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  window.location.href = mailto;

  if (sansEmail.length) {
    showError(`⚠ Pas d'email enregistré pour : ${sansEmail.join(', ')} — ajoute-les dans Paramètres → Contacts compagnies.`);
  }
}

async function saveDemandeOffre() {
  const val = id => document.getElementById(id)?.value || null;
  const chk = id => document.getElementById(id)?.checked || false;

  const plaques = [...document.querySelectorAll('.do-plaque-numero')].map((el, i) => ({
    numero: el.value, modele: document.querySelectorAll('.do-plaque-modele')[i]?.value || '',
  })).filter(p => p.numero || p.modele);

  const donnees = {
    identite: { contact: val('do-contact'), adresse: val('do-adresse'), tel: val('do-tel'), email: val('do-email'), avs: val('do-avs'), activite: val('do-activite'), lieu_risque: val('do-lieu-risque'), suva: val('do-suva'), independant: val('do-independant') },
    base_calcul: { ca: val('do-ca'), nb_collab: val('do-nb-collab'), ap_h: val('do-ap-h'), ap_f: val('do-ap-f'), anp_h: val('do-anp-h'), anp_f: val('do-anp-f'), exc_avs_h: val('do-exc-avs-h'), exc_avs_f: val('do-exc-avs-f'), masse_chef: val('do-masse-chef') },
    assurances_personnes: { perte_gain: chk('do-perte-gain'), pg_14j: chk('do-pg-14j'), pg_30j: chk('do-pg-30j'), pg_60j: chk('do-pg-60j'), laa: chk('do-laa'), laaf: chk('do-laaf'), laac: chk('do-laac'), semi_privee: chk('do-semi-privee'), lpp: chk('do-lpp') },
    assurances_vie: { a3a: chk('do-3a'), a3a_indep: chk('do-3a-indep'), a3b: chk('do-3b'), risque_pure: chk('do-risque-pure'), versement_unique: chk('do-versement-unique'), budget_epargne: val('do-budget-epargne'), pa: val('do-pa') },
    assurances_choses: { inventaire: val('do-inventaire'), rc_commerce: chk('do-rc-commerce'), prejudice_fortune: chk('do-prejudice-fortune'), cyber: chk('do-cyber'), pj: chk('do-pj'), construction: chk('do-construction'), technique: chk('do-technique'), perte_exploit: chk('do-perte-exploit') },
    complementaires: { cct: val('do-cct'), couverture_salaire: val('do-couverture-salaire') },
    lpp: { taux_min_legal: val('do-taux-min-legal'), ded_coord: val('do-ded-coord'), exc_h: val('do-lpp-exc-h'), exc_f: val('do-lpp-exc-f'), cap_invalidite: val('do-cap-invalidite'), cap_deces: val('do-cap-deces'), amelio_rentes: chk('do-amelio-rentes'), amelio_epargne: chk('do-amelio-epargne'), amelio_tranches: chk('do-amelio-tranches'), amelio_rendement: chk('do-amelio-rendement') },
    rc: { risque: val('do-rc-risque'), lieux: val('do-rc-lieux'), marchandises: chk('do-marchandises'), transports: chk('do-transports'), transports_speciaux: chk('do-transports-speciaux'), machines: chk('do-machines'), vol: chk('do-vol'), all_risk: chk('do-all-risk'), inventaire: val('do-rc-inventaire'), prejudice_fortune: chk('do-rc-prejudice-fortune'), cv_details: val('do-rc-cv-details') },
    vehicules: plaques,
  };

  const clientId = val('do-client');
  const body = {
    client_id: clientId || null,
    prospect_nom: clientId ? null : val('do-prospect-nom'),
    agent_id: currentUser.id && allAgents.find(a=>a.email===currentUser.email) ? allAgents.find(a=>a.email===currentUser.email).id : null,
    donnees,
  };

  const res = await dbPost('demandes_offre', body);
  if (res && res.error) { showError('Erreur: ' + errMsg(res)); return; }
  logAction('create_demande_offre', 'demandes_offre', res && res[0] ? res[0].id : null, body.prospect_nom || 'Client existant');
  showError('✓ Demande d\'offre enregistrée.');
  navigate('suivi');
}

function viewNouvelleOpportunite() {
  const agentOptions = allAgents.map(a => `<option value="${a.id}">${a.prenom} ${a.nom}</option>`).join('');
  const clientOptions = allClients.map(c => `<option value="${c.id}">${estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`}</option>`).join('');
  return `
    <button onclick="navigate('opportunites')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour</button>
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:800;color:var(--text)">Nouvelle opportunité</h2>
    ${sectionCard('Détails', '#f59e0b', `<div class="form-grid">
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Titre *</label><input class="form-input" id="o-titre" placeholder="Ex: Assurance vie mixte 20 ans"/></div>
      <div class="form-field"><label class="form-label">Client (si déjà fiché)</label><select class="form-select" id="o-client" onchange="document.getElementById('o-prospect-field').style.display = this.value ? 'none' : ''"><option value="">— Prospect non encore fiché —</option>${clientOptions}</select></div>
      <div class="form-field" id="o-prospect-field"><label class="form-label">Nom du prospect</label><input class="form-input" id="o-prospect-nom" placeholder="Ex: Jean Dupont (pas encore client)"/></div>
      <div class="form-field"><label class="form-label">Compagnie</label><input class="form-input" id="o-compagnie" placeholder="Swiss Life, AXA..."/></div>
      <div class="form-field"><label class="form-label">Montant potentiel (CHF)</label><input class="form-input" id="o-montant" type="number" placeholder="5000"/></div>
      <div class="form-field"><label class="form-label">Probabilité %</label><input class="form-input" id="o-prob" type="number" value="50" min="0" max="100"/></div>
      <div class="form-field"><label class="form-label">Stade</label><select class="form-select" id="o-stade"><option>Contact</option><option>Analyse</option><option>Proposition</option><option>Négociation</option><option>Gagné</option></select></div>
      <div class="form-field"><label class="form-label">Échéance</label><input class="form-input" id="o-date" type="date"/></div>
      <div class="form-field"><label class="form-label">Agent responsable</label><select class="form-select" id="o-agent"><option value="">— Sélectionner —</option>${agentOptions}</select></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Notes</label><textarea class="form-input" id="o-notes" rows="3" style="resize:vertical"></textarea></div>
    </div>`)}
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn-secondary" onclick="navigate('opportunites')">Annuler</button>
      <button class="btn-save" onclick="saveOpportunite()">✓ Enregistrer</button>
    </div>`;
}

async function saveOpportunite() {
  const titre = document.getElementById('o-titre').value.trim();
  if (!titre) { alert('Titre obligatoire.'); return; }
  const body = {
    titre,
    client_id: document.getElementById('o-client').value || null,
    prospect_nom: document.getElementById('o-client').value ? null : (document.getElementById('o-prospect-nom').value.trim() || null),
    compagnie: document.getElementById('o-compagnie').value || null,
    montant_potentiel: parseInt(document.getElementById('o-montant').value) || 0,
    probabilite: parseInt(document.getElementById('o-prob').value) || 50,
    stade: document.getElementById('o-stade').value,
    date_echeance: document.getElementById('o-date').value || null,
    apporteur_id: document.getElementById('o-agent').value || null,
    notes: document.getElementById('o-notes').value || null,
  };
  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Enregistrement...'; btn.disabled = true;
  const r = await dbPost('opportunites', body);
  if (r && r.error) {
    showError('Erreur lors de la création de l\u2019opportunité : ' + errMsg(r));
    btn.textContent = '✓ Enregistrer'; btn.disabled = false;
    return;
  }
  allOpportunites = await dbGet('opportunites', 'select=*');
  navigate('opportunites');
}

// NOUVEAU RAPPEL
