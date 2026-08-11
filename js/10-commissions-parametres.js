// ═══ VERSEMENTS PARTIELS (commissions payées en plusieurs fois — ex. AGV TONI SA) ═══
// Certaines conventions (paiement direct du client hors décompte assureur) versent une
// commission de gestion en 3-4 fois au fil des échéances. commission_tranches garde un
// historique auditable de chaque versement, sans jamais modifier montant_estime/montant_final.
function versementsDe(commId) {
  return allCommissionTranches.filter(t => t.commission_id === commId);
}
function totalVersementsCommission(commId) {
  return versementsDe(commId).reduce((s, t) => s + Number(t.montant || 0), 0);
}

function blocVersementsPartiels(c) {
  const tranches = versementsDe(c.id).slice().sort((a, b) => (a.date_reception || '').localeCompare(b.date_reception || ''));
  const cible = c.montant_final != null ? Number(c.montant_final) : Number(c.montant_estime || 0);
  const recu = totalVersementsCommission(c.id);
  const reste = Math.max(0, Math.round((cible - recu) * 100) / 100);
  const solde = tranches.length > 0 && reste <= 0;
  return `
    <div style="background:var(--surface-alt);border-radius:10px;padding:12px 14px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Versements partiels ${tranches.length > 0 ? `(${tranches.length})` : ''}</div>
        ${tranches.length > 0 ? `<div style="font-size:11.5px;font-weight:700;color:${solde ? '#4ade80' : '#f59e0b'}">Reçu CHF ${fmtCHF(recu)} / ${cible.toLocaleString()} — ${solde ? 'soldé ✓' : `reste CHF ${fmtCHF(reste)}`}</div>` : ''}
      </div>
      ${tranches.length > 0 ? tranches.map(t => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:11.5px;color:var(--text)">
          <span>${fmtDate(t.date_reception)} — CHF ${fmtCHF(Number(t.montant))}${t.note ? ` · ${t.note}` : ''}</span>
          <button type="button" onclick="supprimerVersementCommission('${t.id}', '${c.id}')" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:12px">✕</button>
        </div>`).join('') : `<div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">Aucun versement enregistré — utile si cette commission est payée en plusieurs fois (ex. convention hors décompte assureur).</div>`}
      <div style="display:flex;gap:8px;margin-top:8px">
        <input class="form-input" id="vp-montant" type="number" step="0.01" placeholder="Montant CHF" style="max-width:130px"/>
        <input class="form-input" id="vp-date" type="date" value="${new Date().toISOString().split('T')[0]}" style="max-width:150px"/>
        <input class="form-input" id="vp-note" placeholder="Note (optionnel)" style="flex:1"/>
        <button type="button" onclick="ajouterVersementCommission('${c.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:0 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">+ Ajouter</button>
      </div>
    </div>`;
}

async function ajouterVersementCommission(commId) {
  const montant = parseFloat(document.getElementById('vp-montant')?.value);
  const date_reception = document.getElementById('vp-date')?.value || new Date().toISOString().split('T')[0];
  const note = document.getElementById('vp-note')?.value.trim() || null;
  if (!montant || montant <= 0) { showError('Indique un montant valide pour le versement.'); return; }
  const r = await dbPost('commission_tranches', { commission_id: commId, montant, date_reception, note });
  if (r && r.error) { showError('Erreur lors de l\'enregistrement du versement.'); return; }
  logAction('add_versement_commission', 'commission_tranches', commId, `CHF ${fmtCHF(montant)} le ${date_reception}`);
  allCommissionTranches = await dbGet('commission_tranches', 'select=*');
  showModalEditCommission(commId);
  renderToutesCommissions();
}

async function supprimerVersementCommission(trancheId, commId) {
  if (!confirm('Supprimer ce versement ?')) return;
  await dbDelete('commission_tranches', trancheId);
  allCommissionTranches = await dbGet('commission_tranches', 'select=*');
  showModalEditCommission(commId);
  renderToutesCommissions();
}

function showModalEditCommission(commId) {
  const c = allCommissionsAttente.find(x => x.id === commId);
  if (!c) return;
  const b = c.bordereau_id ? allBordereaux.find(bd => bd.id === c.bordereau_id) : null;
  const ct = c.contrat_id ? allContrats.find(x => x.id === c.contrat_id) : null;
  const cl = ct ? allClients.find(x => x.id === ct.client_id) : (c.client_id ? allClients.find(x => x.id === c.client_id) : null);
  // Nom résolu depuis la fiche client réelle (cl) — utilisé en repli quand client_nom (simple copie
  // texte prise à la création) est vide, ce qui arrivait sans qu'aucun lien vers la fiche ne soit
  // jamais proposé ici alors que le client était bel et bien identifiable via le contrat lié.
  const nomResolu = cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom || ''} ${cl.nom || ''}`.trim()) : '';
  creerModale('modal-edit-commission', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:500px">
      <h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:var(--text)">Commission — ${c.client_nom || nomResolu || '—'}</h3>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">${b ? `Rapprochée du bordereau ${b.numero || ''}` : "Pas encore rapprochée d'un bordereau"}</div>

      ${cl ? `<div style="background:var(--surface-alt);border-radius:10px;padding:12px 14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:12.5px;color:var(--text);font-weight:700">👤 ${nomResolu || '—'}</div>
          <button type="button" onclick="document.getElementById('modal-edit-commission').remove(); showClient('${cl.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:3px 10px;font-size:10.5px;cursor:pointer;font-weight:700">Voir la fiche client →</button>
        </div>
      </div>` : `<div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:11.5px;color:#f87171">⚠ Aucun client identifiable pour cette commission (ni contrat lié, ni client_id) — corrige le champ "Client" ci-dessous à la main si tu sais de qui il s'agit.</div>`}

      ${ct ? `<div style="background:var(--surface-alt);border-radius:10px;padding:12px 14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Contrat lié</div>
          <button type="button" onclick="document.getElementById('modal-edit-commission').remove(); showDetailContrat('${ct.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:3px 10px;font-size:10.5px;cursor:pointer;font-weight:700">Voir le contrat →</button>
        </div>
        <div style="font-size:12.5px;color:var(--text)">${ct.produit} · ${ct.compagnie}</div>
        <div style="font-size:11px;color:var(--text-muted)">Prime CHF ${fmtCHF(Number(ct.prime_annuelle||0))}/an${ct.date_debut ? ' · Signé le ' + fmtDate(ct.date_debut) : ''}${ct.numero_police ? ' · № ' + ct.numero_police : ''}</div>
      </div>` : `<div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:11.5px;color:#f87171">⚠ Aucun contrat lié à cette commission — impossible de vérifier son origine automatiquement.</div>`}

      <div class="form-field" style="margin-bottom:14px">
        <label class="form-label">Détail du calcul (visible sur la liste)</label>
        <textarea class="form-input" id="ec-detail" rows="2" placeholder="Ex : COG Swiss Life : prime 4992 × 1.20 × 6.3% = CHF 378/an">${(c.detail_calcul||'').split('[')[0].trim()}</textarea>
      </div>

      <div class="form-grid">
        <div class="form-field"><label class="form-label">Client</label><input class="form-input" id="ec-client" value="${c.client_nom || nomResolu || ''}"/></div>
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
        <div class="form-field"><label class="form-label">Statut</label><select class="form-select" id="ec-statut" onchange="document.getElementById('ec-refacturee-field').style.display = this.value === 'versé_oz' ? 'block' : 'none'">
          <option value="en_attente" ${c.statut==='en_attente'?'selected':''}>En attente</option>
          <option value="reçue" ${c.statut==='reçue'?'selected':''}>Reçue (Assurex)</option>
          <option value="versé_oz" ${c.statut==='versé_oz'?'selected':''}>Versée sur OZ (convention pas encore fusionnée — à refacturer)</option>
          <option value="extourné" ${c.statut==='extourné'?'selected':''}>↩ Extournée (contrat policé puis annulé après versement)</option>
          ${c.statut === 'annulé' ? `<option value="annulé" selected>❌ Annulé (ancien statut — passe en Extournée si le contrat a été policé, sinon remets En attente)</option>` : ''}
        </select></div>
        <div class="form-field" id="ec-refacturee-field" style="display:${c.statut === 'versé_oz' ? 'block' : 'none'}"><label class="form-label">Refacturée à Assurex ?</label><select class="form-select" id="ec-refacturee">
          <option value="non" ${!c.refacture_le?'selected':''}>Non — encore à transférer en interne</option>
          <option value="oui" ${c.refacture_le?'selected':''}>Oui — déjà transférée</option>
        </select></div>
      </div>
      ${blocVersementsPartiels(c)}

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
    compagnie: normaliserCompagnie(document.getElementById('ec-compagnie').value.trim()),
    produit: document.getElementById('ec-produit').value.trim(),
    montant_estime: Number(document.getElementById('ec-montant-estime').value) || 0,
    montant_final: estUnRetourEnArriere ? null : (montantFinalVal === '' ? null : Number(montantFinalVal)),
    bordereau_id: estUnRetourEnArriere ? null : (original ? original.bordereau_id : null),
    date_reception: estUnRetourEnArriere ? null : (document.getElementById('ec-date-reception').value || null),
    numero_police: document.getElementById('ec-police').value.trim() || null,
    nature: document.getElementById('ec-nature')?.value || 'acquisition',
    statut: nouveauStatut,
    refacture_le: (nouveauStatut === 'versé_oz' && document.getElementById('ec-refacturee')?.value === 'oui')
      ? (original?.refacture_le || new Date().toISOString().split('T')[0])
      : null,
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
        detail_calcul: `↩ Reprise automatique suite à l'extourne de la commission d'origine (CHF ${fmtCHF(montantOriginal)}). À rapprocher avec la ligne de débit correspondante sur le prochain bordereau ${body.compagnie}.`,
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
  // Par défaut (aucun filtre explicite passé par l'appelant), la vue ne montre que les
  // commissions EN ATTENTE — c'est ce qui intéresse au quotidien. Les autres statuts (reçues,
  // versées, extournées...) restent consultables via le filtre "Statut" ci-dessous, jamais
  // affichés en vrac par défaut (demande de Jonathan le 11.08.2026).
  const statutInitial = prefiltreStatut !== undefined ? prefiltreStatut : 'en_attente';
  window._tcPrefiltre = statutInitial || null;
  dbGet('commission_tranches', 'select=*').then(t => { allCommissionTranches = t; renderToutesCommissions(); });
  setTimeout(() => renderToutesCommissions(), 0);
  const compagniesPresentes = [...new Set(allCommissionsAttente.map(c => normaliserCompagnie(c.compagnie)).filter(Boolean))].sort();
  return `
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:800;color:var(--text)">Toutes les commissions</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Estimées à la signature, puis liées à un bordereau une fois reçues. Pour faire passer une commission "en attente" en "reçue", utilise "+ Rapprocher une commission" sur le bordereau concerné — ça garantit le montant net exact et le numéro de police. Par défaut, seules les commissions en attente sont affichées — choisis "Tous statuts" ou un autre statut ci-dessous pour voir le reste.</div>

    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
      <input class="form-input" id="tc-search" placeholder="🔍 Client, compagnie, produit, n° bordereau..." style="flex:1;min-width:200px" oninput="renderToutesCommissions()"/>
      <select class="form-select" id="tc-compagnie" style="max-width:200px" onchange="renderToutesCommissions()">
        <option value="">Toutes compagnies</option>
        ${compagniesPresentes.map(comp => `<option value="${comp}">${comp}</option>`).join('')}
      </select>
      <select class="form-select" id="tc-statut" style="max-width:180px" onchange="renderToutesCommissions()">
        <option value="" ${statutInitial===''?'selected':''}>Tous statuts</option>
        <option value="en_attente" ${statutInitial==='en_attente'?'selected':''}>En attente</option>
        <option value="en_attente_naissance" ${statutInitial==='en_attente_naissance'?'selected':''}>🍼 En attente de naissance</option>
        <option value="reçue" ${statutInitial==='reçue'?'selected':''}>Reçue (Assurex)</option>
        <option value="extourné" ${statutInitial==='extourné'?'selected':''}>Extournée</option>
        <option value="versé_oz" ${statutInitial==='versé_oz'?'selected':''}>Versé OZ (tout)</option>
        <option value="versé_oz_a_refacturer" ${statutInitial==='versé_oz_a_refacturer'?'selected':''}>Versé OZ — à refacturer</option>
      </select>
      <select class="form-select" id="tc-nature" style="max-width:170px" onchange="renderToutesCommissions()">
        <option value="">Acquisition + Gestion</option>
        <option value="acquisition">Acquisition uniquement</option>
        <option value="gestion">Gestion uniquement</option>
      </select>
      <select class="form-select" id="tc-typeclient" style="max-width:170px" onchange="renderToutesCommissions()">
        <option value="">Privés + Entreprises</option>
        <option value="prive">Client privé</option>
        <option value="entreprise">Entreprise</option>
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
  const compagnieFilter = document.getElementById('tc-compagnie')?.value || '';
  const statutFilter = document.getElementById('tc-statut')?.value || '';
  const natureFilter = document.getElementById('tc-nature')?.value || '';
  const typeClientFilter = document.getElementById('tc-typeclient')?.value || '';
  const tri = document.getElementById('tc-tri')?.value || 'montant_desc';

  // Client privé vs entreprise — déduit du client lié (allClients). Une commission sans client_id
  // rattaché (rare, prospect converti sans fiche) ne matche aucun des deux filtres explicites.
  function typeClientDe(c) {
    const cl = c.client_id ? allClients.find(x => x.id === c.client_id) : null;
    if (!cl) return null;
    return estEntreprise(cl) ? 'entreprise' : 'prive';
  }

  function numeroBordereauDe(c) {
    if (!c.bordereau_id) return '';
    const b = allBordereaux.find(bd => bd.id === c.bordereau_id);
    return b ? (b.numero || '') : '';
  }
  function montantC(c) { return c.montant_final != null ? c.montant_final : (c.montant_estime || 0); }

  const filtered = allCommissionsAttente.filter(c => {
    // Par défaut, cette page ne montre QUE les données Assurex — le passé OZ Assure reste
    // masqué tant que personne ne le demande explicitement via le filtre "Versé OZ" ci-dessus.
    // Si un filtre versé_oz est sélectionné, on laisse passer ces lignes (visibles pour tous,
    // David et Alejandro inclus — décision explicite de Jonathan du 03.08.2026).
    if (c.statut === 'versé_oz' && statutFilter !== 'versé_oz' && statutFilter !== 'versé_oz_a_refacturer') return false;
    // Exclure les commissions liées à un contrat marqué "non commissionné" ou "annulé"
    // (un contrat annulé n'a jamais réellement pris effet — aucune commission n'a de sens ici,
    // à la différence d'"extourné" qui représente un contrat policé puis repris)
    if (c.contrat_id) {
      const ct = allContrats.find(x => x.id === c.contrat_id);
      if (ct && (ct.commissionne === false || ct.statut === 'annulé')) return false;
    }
    if (compagnieFilter && normaliserCompagnie(c.compagnie) !== compagnieFilter) return false;
    if (statutFilter === 'versé_oz_a_refacturer') {
      if (!(c.statut === 'versé_oz' && !c.refacture_le)) return false;
    } else if (statutFilter && c.statut !== statutFilter) return false;
    if (natureFilter && (c.nature || 'acquisition') !== natureFilter) return false;
    if (typeClientFilter && typeClientDe(c) !== typeClientFilter) return false;
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
      <div><div style="font-size:13px;font-weight:700;color:var(--text)">${c.client_id ? `<span onclick="event.stopPropagation(); showClient('${c.client_id}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted">${c.client_nom || '—'}</span>` : (c.client_nom || '—')}${getClientMiniLogos(allClients.find(x => x.id === c.client_id))}</div><div style="font-size:11px;color:var(--text-muted)">${c.produit || ''}</div>${c.detail_calcul ? `<div style="font-size:10px;color:var(--text-dim);margin-top:2px;font-style:italic">${c.detail_calcul.split('[')[0].trim()}</div>` : `<div style="font-size:10px;color:#f59e0b;margin-top:2px">⚠ Détail du calcul manquant — clique pour préciser</div>`}${totalVersementsCommission(c.id) > 0 ? `<div style="font-size:10px;color:#4ade80;margin-top:2px">💰 Reçu CHF ${fmtCHF(totalVersementsCommission(c.id))} / ${montantC(c).toLocaleString()} (versements partiels)</div>` : ''}</div>
      <div style="font-size:12px;color:var(--text-muted)">${c.compagnie || ''}</div>
      <div style="font-size:11px;color:var(--text-muted)">${numBord ? `<span style="font-family:monospace">${numBord}</span>` : '—'}</div>
      <div style="font-size:12px;color:var(--text-muted)">${c.date_creation || ''}</div>
      <div style="font-weight:800;color:#f59e0b;text-align:right">CHF ${fmtCHF(montantC(c))}</div>
      <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">${badge(statutCommissionLabel(c.statut), statutCommissionColor(c.statut))}${badgeNatureCommission(c.nature)}</div>
    </div>`;
  }).join('');

  document.getElementById('tc-table').innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}"><div>Client / Produit</div><div>Compagnie</div><div>N° bordereau</div><div>Créée le</div><div>Montant</div><div>Statut</div></div>
      ${rows || '<div class="table-empty">Aucune commission ne correspond à ces filtres.</div>'}
    </div>`;
}

// AGENDA
let vueModeAgenda = 'liste'; // 'liste' | 'semaine'
let agendaWeekOffset = 0;

function changerVueAgenda(mode) {
  vueModeAgenda = mode;
  navigate('agenda');
}

function changerSemaineAgenda(delta) {
  agendaWeekOffset = delta === 0 ? 0 : agendaWeekOffset + delta;
  navigate('agenda');
}

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

  const toggle = `<div class="tabs">
    <button class="tab-btn ${vueModeAgenda === 'liste' ? 'active' : ''}" onclick="changerVueAgenda('liste')">📃 Liste</button>
    <button class="tab-btn ${vueModeAgenda === 'semaine' ? 'active' : ''}" onclick="changerVueAgenda('semaine')">📊 Semaine</button>
  </div>`;

  const corps = vueModeAgenda === 'semaine' ? renderAgendaSemaine() : renderAgendaListe();

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Agenda — ${currentUser.email}</h2>
      <div style="display:flex;gap:10px;align-items:center">${toggle}<button class="btn-secondary" onclick="refreshAgenda()">↻ Actualiser</button></div>
    </div>
    ${corps}`;
}

function renderAgendaListe() {
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

  return days || '<div class="table-empty">Aucun événement à venir.</div>';
}

// ── Vue "bâtons" — une colonne par jour de la semaine (Lun-Dim), grille horaire 7h-20h,
// chaque événement affiché comme une barre positionnée/dimensionnée selon son horaire. Les
// événements journée entière (isAllDay) s'affichent à part, au-dessus de la grille.
const AGENDA_HEURE_DEBUT = 7;
const AGENDA_HEURE_FIN = 20;
const AGENDA_COULEURS = ['#38bdf8', '#4ade80', '#f59e0b', '#a78bfa', '#f87171', '#fb923c'];

function renderAgendaSemaine() {
  const qa = (s) => (s || '').toString().replace(/"/g, '&quot;');
  const base = new Date();
  base.setDate(base.getDate() + agendaWeekOffset * 7);
  const lundi = startOfWeek(base);
  const jours = Array.from({ length: 7 }, (_, i) => { const d = new Date(lundi); d.setDate(d.getDate() + i); return d; });
  const aujourdhui = new Date();
  const plageH = AGENDA_HEURE_FIN - AGENDA_HEURE_DEBUT;
  const heures = Array.from({ length: plageH + 1 }, (_, i) => AGENDA_HEURE_DEBUT + i);

  const nav = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <button class="btn-secondary" style="padding:6px 12px" onclick="changerSemaineAgenda(-1)">◀</button>
    <button class="btn-secondary" style="padding:6px 12px" onclick="changerSemaineAgenda(0)">Semaine actuelle</button>
    <button class="btn-secondary" style="padding:6px 12px" onclick="changerSemaineAgenda(1)">▶</button>
    <div style="font-size:12.5px;color:var(--text-muted);font-weight:700;margin-left:6px">${lundi.toLocaleDateString('fr-CH',{day:'numeric',month:'long'})} — ${jours[6].toLocaleDateString('fr-CH',{day:'numeric',month:'long',year:'numeric'})}</div>
  </div>`;

  const colonnes = jours.map((jour, idx) => {
    const evsJour = eventsForDay(jour);
    const journeeEntiere = evsJour.filter(ev => ev.isAllDay);
    const horaires = evsJour.filter(ev => !ev.isAllDay);
    const estAujourdhui = isSameDay(jour, aujourdhui);

    const badgesJournee = journeeEntiere.map(ev => `<div style="background:var(--accent-dim);color:var(--accent);font-size:10px;font-weight:700;border-radius:5px;padding:2px 6px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${qa(ev.subject || 'Sans titre')}">${ev.subject || 'Sans titre'}</div>`).join('');

    const batons = horaires.map((ev, i) => {
      const start = new Date(ev.start.dateTime);
      const end = new Date(ev.end.dateTime);
      const startH = Math.min(Math.max(start.getHours() + start.getMinutes() / 60, AGENDA_HEURE_DEBUT), AGENDA_HEURE_FIN);
      let endH = Math.min(Math.max(end.getHours() + end.getMinutes() / 60, AGENDA_HEURE_DEBUT), AGENDA_HEURE_FIN);
      if (endH <= startH) endH = Math.min(startH + 0.5, AGENDA_HEURE_FIN);
      const top = ((startH - AGENDA_HEURE_DEBUT) / plageH) * 100;
      const height = ((endH - startH) / plageH) * 100;
      const color = AGENDA_COULEURS[i % AGENDA_COULEURS.length];
      const hDeb = start.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
      const hFin = end.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
      return `<div title="${qa(ev.subject || 'Sans titre')} (${hDeb}-${hFin})" style="position:absolute;left:2px;right:2px;top:${top}%;height:${Math.max(height,3)}%;background:${color};border-radius:5px;padding:3px 5px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.25)">
        <div style="font-size:9.5px;font-weight:800;color:#0b1220;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${hDeb}</div>
        <div style="font-size:10px;font-weight:700;color:#0b1220;line-height:1.25;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${ev.subject || 'Sans titre'}</div>
      </div>`;
    }).join('');

    return `<div style="flex:1;min-width:110px;display:flex;flex-direction:column">
      <div style="text-align:center;padding:6px 4px;border-bottom:2px solid ${estAujourdhui ? 'var(--accent)' : 'var(--border)'};margin-bottom:4px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.5px">${jour.toLocaleDateString('fr-CH',{weekday:'short'})}</div>
        <div style="font-size:15px;font-weight:800;color:${estAujourdhui ? 'var(--accent)' : 'var(--text)'}">${jour.getDate()}</div>
      </div>
      <div style="min-height:16px">${badgesJournee}</div>
      <div style="position:relative;flex:1;background:var(--surface-alt);border-radius:6px;${idx > 0 ? 'border-left:1px solid var(--border);' : ''}">
        ${heures.map(h => `<div style="position:absolute;left:0;right:0;top:${((h - AGENDA_HEURE_DEBUT) / plageH) * 100}%;border-top:1px dashed var(--border)"></div>`).join('')}
        ${batons}
      </div>
    </div>`;
  }).join('');

  const axeHeures = `<div style="width:40px;display:flex;flex-direction:column">
    <div style="padding:6px 4px;margin-bottom:4px;height:38px"></div>
    <div style="min-height:16px"></div>
    <div style="position:relative;flex:1">
      ${heures.map(h => `<div style="position:absolute;left:0;top:${((h - AGENDA_HEURE_DEBUT) / plageH) * 100}%;transform:translateY(-50%);font-size:9.5px;color:var(--text-muted);font-weight:700">${h}h</div>`).join('')}
    </div>
  </div>`;

  return `${nav}<div style="display:flex;gap:6px;height:560px">${axeHeures}${colonnes}</div>`;
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
  {
    id: 'sante-hausse-primes-2027',
    titre: 'Santé — Hausse des primes 2027',
    periode: 'Septembre - décembre (avant l\'annonce officielle des primes et la période de résiliation du 30 novembre)',
    icon: '📈',
    color: '#fb923c',
    segment: 'Privé',
    filtre: c => true,
    sujet: 'Primes maladie 2027 : anticipons la hausse ensemble',
    corps: `Bonjour {prenom},

Comme chaque année, les primes d'assurance maladie sont amenées à augmenter en 2027. Plutôt que de subir la hausse au moment de recevoir votre nouvelle police, je vous propose d'anticiper : on fait le point maintenant sur votre couverture actuelle (base et complémentaire), pour voir si elle correspond toujours à vos besoins et à votre budget avant que la période de changement de caisse (résiliation au 30 novembre) n'arrive.

Ça ne prend que 15-20 minutes, et ça peut représenter une vraie économie sur l'année.

Réservez directement le créneau qui vous convient, en moins d'une minute et sans échange d'emails : {lien_rdv}

Le temps presse un peu avant fin novembre — n'attendez pas le dernier moment.

Bien cordialement,
Jonathan Özkan
Assurex Sàrl`
  },
];

// Lien de prise de RDV en autonomie (agent unique du cabinet — token fixe) — permet au client de
// réserver directement un créneau depuis le mail de campagne, sans échange d'emails.
const LIEN_RESERVATION_RDV = 'https://varendel.github.io/crm-assurex/?rdv=1a5f1ba8-9964-46b2-896d-775248e8d2c3';

// Libellés des produits de complémentaire santé (hors LAMal, base obligatoire) — sert au filtre
// intelligent "sans complémentaire santé actuelle" des campagnes.
const LABELS_COMPLEMENTAIRE_SANTE = (CATALOGUE_PRODUITS['Santé'] || []).filter(p => p.id !== 'lamal').map(p => p.label.toLowerCase());

function clientAComplementaireSanteActive(clientId) {
  return allContrats.some(ct => ct.client_id === clientId && ct.statut === 'actif' && LABELS_COMPLEMENTAIRE_SANTE.some(l => (ct.produit || '').toLowerCase().includes(l)));
}

// Réglages de ciblage/texte par campagne, ajustables depuis l'écran de détail — en mémoire
// uniquement (remis à zéro au rechargement), pour rester simple et rapide à utiliser.
let campagneReglages = {};

function segmentParDefautCampagne(t) {
  const s = (t.segment || '').trim().toLowerCase();
  if (s === 'entreprise') return 'entreprise';
  if (s === 'privé' || s === 'prive') return 'prive';
  return 'tous';
}

function reglagesCampagne(t) {
  if (!campagneReglages[t.id]) {
    campagneReglages[t.id] = { segment: segmentParDefautCampagne(t), sansSante: false, emailUniquement: false, sujet: null, corps: null, exclusions: [] };
  }
  if (!campagneReglages[t.id].exclusions) campagneReglages[t.id].exclusions = [];
  return campagneReglages[t.id];
}

// Clients qui correspondent aux critères automatiques (segment + filtres intelligents), AVANT
// toute exclusion manuelle — c'est cette liste complète qui s'affiche dans le tableau "Clients
// ciblés" avec une case à cocher chacun, pour que Jonathan puisse retirer un client précis sans
// perdre sa place s'il change ensuite un filtre.
function ciblesEligiblesCampagne(t) {
  const r = reglagesCampagne(t);
  return allClients.filter(c => {
    if (r.segment === 'prive' && estEntreprise(c)) return false;
    if (r.segment === 'entreprise' && !estEntreprise(c)) return false;
    if (r.sansSante && clientAComplementaireSanteActive(c.id)) return false;
    if (r.emailUniquement && !c.email) return false;
    return t.filtre(c);
  });
}

// Cible réelle = éligibles moins les exclusions manuelles (cases décochées une par une, ou via
// "Tout désélectionner") — c'est cette liste qui compte pour le total affiché et qui alimente la
// génération d'email.
function ciblesCampagne(t) {
  const r = reglagesCampagne(t);
  return ciblesEligiblesCampagne(t).filter(c => !r.exclusions.includes(c.id));
}

function toggleClientExclusionCampagne(themeId, clientId, inclus) {
  const t = CAMPAGNES_THEMES.find(x => x.id === themeId);
  if (!t) return;
  const r = reglagesCampagne(t);
  r.exclusions = inclus ? r.exclusions.filter(id => id !== clientId) : [...new Set([...r.exclusions, clientId])];
  showCampagne(themeId);
}

function toutSelectionnerCampagne(themeId) {
  const t = CAMPAGNES_THEMES.find(x => x.id === themeId);
  if (!t) return;
  reglagesCampagne(t).exclusions = [];
  showCampagne(themeId);
}

function toutDeselectionnerCampagne(themeId) {
  const t = CAMPAGNES_THEMES.find(x => x.id === themeId);
  if (!t) return;
  reglagesCampagne(t).exclusions = ciblesEligiblesCampagne(t).map(c => c.id);
  showCampagne(themeId);
}

function texteCampagne(t) {
  const r = reglagesCampagne(t);
  return { sujet: r.sujet != null ? r.sujet : t.sujet, corps: r.corps != null ? r.corps : t.corps };
}

function texteCampagneAvecPlaceholders(txt, client) {
  return (txt || '').replace(/\{prenom\}/g, (client && client.prenom) || '').replace(/\{lien_rdv\}/g, LIEN_RESERVATION_RDV);
}

function appliquerReglageCampagne(themeId, champ, valeur) {
  const t = CAMPAGNES_THEMES.find(x => x.id === themeId);
  if (!t) return;
  reglagesCampagne(t)[champ] = valeur;
  showCampagne(themeId);
}

function sauverTexteCampagne(themeId, champ, valeur) {
  const t = CAMPAGNES_THEMES.find(x => x.id === themeId);
  if (!t) return;
  reglagesCampagne(t)[champ] = valeur;
}

function reinitialiserTexteCampagne(themeId) {
  const t = CAMPAGNES_THEMES.find(x => x.id === themeId);
  if (!t) return;
  const r = reglagesCampagne(t);
  r.sujet = null; r.corps = null;
  showCampagne(themeId);
}

function viewCampagnes() {
  const cards = CAMPAGNES_THEMES.map(t => {
    const cibles = ciblesCampagne(t);
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
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Sélectionnez un thème pour paramétrer la cible, ajuster le texte et générer vos emails personnalisés.</div>
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
  const r = reglagesCampagne(t);
  const ciblesEligibles = ciblesEligiblesCampagne(t);
  const cibles = ciblesCampagne(t);
  const texte = texteCampagne(t);

  const rows = ciblesEligibles.map(c => {
    const inclus = !r.exclusions.includes(c.id);
    const corpsClient = texteCampagneAvecPlaceholders(texte.corps, c);
    const mailtoHref = `mailto:${c.email || ''}?subject=${encodeURIComponent(texte.sujet)}&body=${encodeURIComponent(corpsClient)}`;
    return `<tr style="opacity:${inclus ? '1' : '0.45'}">
      <td style="padding:10px 8px 10px 14px;width:30px"><input type="checkbox" ${inclus ? 'checked' : ''} onchange="toggleClientExclusionCampagne('${t.id}','${c.id}',this.checked)" style="width:15px;height:15px;accent-color:${t.color};cursor:pointer"/></td>
      <td style="padding:10px 14px;font-size:13px;font-weight:700;color:var(--text)">${estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`}</td>
      <td style="padding:10px 14px;font-size:12px;color:var(--text-muted)">${c.email || '—'}</td>
      <td style="padding:10px 14px;font-size:12px;color:var(--text-muted)">${c.mobile || c.tel || '—'}</td>
      <td style="padding:10px 14px;text-align:right">
        <div style="display:flex;gap:6px;justify-content:flex-end">
        ${inclus && c.email ? `<a href="${mailtoHref}" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55;border-radius:7px;padding:6px 14px;font-size:11px;font-weight:700;text-decoration:none">✉️ mailto</a>` : (!inclus ? '<span style="font-size:11px;color:var(--text-muted)">Retiré</span>' : '<span style="font-size:11px;color:var(--text-muted)">Pas d\'email</span>')}
        ${inclus ? `<button class="btn-secondary" style="padding:6px 12px;font-size:11px" onclick="ouvrirApercuEmailCampagne('${t.id}','${c.id}')">👁 Aperçu</button>` : `<button class="btn-secondary" style="padding:6px 12px;font-size:11px" onclick="toggleClientExclusionCampagne('${t.id}','${c.id}',true)">↺ Remettre</button>`}
        </div>
      </td>
    </tr>`;
  }).join('');

  main.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
      <div style="font-size:32px">${t.icon}</div>
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">${t.titre}</h2>
        <div style="font-size:12px;color:var(--text-muted)">${t.periode} · ${cibles.length} client${cibles.length !== 1 ? 's' : ''} ciblé${cibles.length !== 1 ? 's' : ''}</div>
      </div>
    </div>

    ${sectionCard('Ciblage', t.color, `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        <div class="form-field"><label class="form-label">Segment</label>
          <select class="form-select" onchange="appliquerReglageCampagne('${t.id}','segment',this.value)">
            <option value="tous" ${r.segment === 'tous' ? 'selected' : ''}>Tous les clients</option>
            <option value="prive" ${r.segment === 'prive' ? 'selected' : ''}>Privés uniquement</option>
            <option value="entreprise" ${r.segment === 'entreprise' ? 'selected' : ''}>Entreprises uniquement</option>
          </select>
        </div>
      </div>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text);cursor:pointer">
          <input type="checkbox" ${r.sansSante ? 'checked' : ''} onchange="appliquerReglageCampagne('${t.id}','sansSante',this.checked)"/>
          Recommandation intelligente : cibler uniquement les clients sans complémentaire santé active
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text);cursor:pointer">
          <input type="checkbox" ${r.emailUniquement ? 'checked' : ''} onchange="appliquerReglageCampagne('${t.id}','emailUniquement',this.checked)"/>
          Email renseigné uniquement (nécessaire pour un envoi)
        </label>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:10px">${ciblesEligibles.length} client${ciblesEligibles.length !== 1 ? 's' : ''} correspond${ciblesEligibles.length !== 1 ? 'ent' : ''} à ces critères sur ${allClients.length} au total — ${cibles.length} effectivement ciblé${cibles.length !== 1 ? 's' : ''} après retraits manuels ci-dessous.</div>
    `)}

    ${sectionCard('Objet et texte du message', t.color, `
      <div class="form-field" style="margin-bottom:8px"><label class="form-label">Objet</label><input class="form-input" oninput="sauverTexteCampagne('${t.id}','sujet',this.value)" value="${(texte.sujet || '').replace(/"/g, '&quot;')}"/></div>
      <div class="form-field" style="margin-bottom:8px"><label class="form-label">Corps</label><textarea class="form-input" oninput="sauverTexteCampagne('${t.id}','corps',this.value)" style="min-height:220px;font-family:inherit;resize:vertical">${texte.corps || ''}</textarea></div>
      <div style="font-size:11px;color:var(--text-muted)">Variables disponibles : {prenom} (prénom du client), {lien_rdv} (lien de réservation de RDV en autonomie).</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary" onclick="reinitialiserTexteCampagne('${t.id}')">↺ Réinitialiser au texte par défaut</button>
        <button class="btn-save" onclick="ouvrirApercuEmailCampagne('${t.id}')">✉️ Générer le mail prêt à l'envoi</button>
      </div>
    `)}

    <div style="margin-top:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">Clients ciblés <span style="font-weight:400;color:var(--text-muted)">(${cibles.length} sur ${ciblesEligibles.length} correspondant aux critères)</span></div>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary" style="padding:6px 12px;font-size:11.5px" onclick="toutSelectionnerCampagne('${t.id}')">☑ Tout sélectionner</button>
          <button class="btn-secondary" style="padding:6px 12px;font-size:11.5px" onclick="toutDeselectionnerCampagne('${t.id}')">☐ Tout désélectionner</button>
        </div>
      </div>
      <div class="table-wrap">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th></th>
            <th style="text-align:left;padding:8px 14px;font-size:11px;color:var(--text-muted);text-transform:uppercase">Client</th>
            <th style="text-align:left;padding:8px 14px;font-size:11px;color:var(--text-muted);text-transform:uppercase">Email</th>
            <th style="text-align:left;padding:8px 14px;font-size:11px;color:var(--text-muted);text-transform:uppercase">Téléphone</th>
            <th></th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="table-empty">Aucun client ne correspond à ces critères actuellement.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  insertBackBar({ homeId: 'campagnes', homeLabel: 'Campagnes', itemLabel: t.titre });
}

// Aperçu de mail — objet + corps modifiables, personnalisé pour un client précis. Ne déclenche
// JAMAIS d'envoi automatique : uniquement copier / mailto, ou un envoi Outlook explicite derrière
// une confirmation, exactement comme pour les demandes d'offre (js/07).
function ouvrirApercuEmailCampagne(themeId, clientId) {
  const t = CAMPAGNES_THEMES.find(x => x.id === themeId);
  if (!t) return;
  const cibles = ciblesCampagne(t);
  if (!cibles.length) { showError('Aucun client ne correspond aux critères de ciblage actuels.'); return; }
  const client = (clientId && cibles.find(c => c.id === clientId)) || cibles[0];
  const texte = texteCampagne(t);
  window._apercuEmailCampagneCibles = cibles;
  window._apercuEmailCampagneTexteBrut = texte;
  const optionsClients = cibles.map(c => `<option value="${c.id}" ${c.id === client.id ? 'selected' : ''}>${estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`}${c.email ? '' : ' (sans email)'}</option>`).join('');
  const qa = (s) => (s || '').toString().replace(/"/g, '&quot;');
  creerModale('modal-apercu-email-campagne', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:600px;width:100%;max-height:90vh;display:flex;flex-direction:column">
      <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px">✉️ Aperçu — ${t.titre}</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px">Ce courriel n'est PAS envoyé automatiquement — relis-le, corrige-le si besoin, puis choisis comment le transmettre.</div>
      <div class="form-field" style="margin-bottom:10px"><label class="form-label">Client (${cibles.length} ciblé${cibles.length !== 1 ? 's' : ''})</label>
        <select class="form-select" id="apercu-campagne-client" onchange="changerClientApercuCampagne()">${optionsClients}</select>
      </div>
      <div class="form-field" style="margin-bottom:8px"><label class="form-label">Objet</label><input class="form-input" id="apercu-campagne-sujet" value="${qa(texte.sujet)}"/></div>
      <div class="form-field" style="flex:1;display:flex;flex-direction:column;margin-bottom:14px"><label class="form-label">Corps</label><textarea class="form-input" id="apercu-campagne-corps" style="flex:1;min-height:260px;font-family:inherit;resize:vertical">${texteCampagneAvecPlaceholders(texte.corps, client)}</textarea></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary" onclick="document.getElementById('modal-apercu-email-campagne').remove()">Fermer</button>
        <button class="btn-secondary" onclick="copierApercuEmailCampagne()">📋 Copier</button>
        <button class="btn-secondary" onclick="ouvrirMailtoApercuCampagne()">📧 Ouvrir dans mon client mail</button>
        <button class="btn-save" style="margin-left:auto" onclick="envoyerApercuEmailCampagneViaOutlook()">📨 Envoyer maintenant via Outlook</button>
      </div>
    </div>`, { padding: '16px' });
}

function changerClientApercuCampagne() {
  const cibles = window._apercuEmailCampagneCibles || [];
  const clientId = document.getElementById('apercu-campagne-client')?.value;
  const client = cibles.find(c => c.id === clientId);
  const texte = window._apercuEmailCampagneTexteBrut;
  if (!client || !texte) return;
  const corpsEl = document.getElementById('apercu-campagne-corps');
  if (corpsEl) corpsEl.value = texteCampagneAvecPlaceholders(texte.corps, client);
}

function copierApercuEmailCampagne() {
  const sujet = document.getElementById('apercu-campagne-sujet')?.value || '';
  const corps = document.getElementById('apercu-campagne-corps')?.value || '';
  const texteFinal = `Objet : ${sujet}\n\n${corps}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texteFinal).then(() => showError('✓ Texte copié.')).catch(() => showError('Impossible de copier automatiquement — sélectionne le texte manuellement.'));
  } else { showError('Copie automatique non disponible — sélectionne le texte manuellement.'); }
}

function ouvrirMailtoApercuCampagne() {
  const cibles = window._apercuEmailCampagneCibles || [];
  const clientId = document.getElementById('apercu-campagne-client')?.value;
  const client = cibles.find(c => c.id === clientId);
  const sujet = document.getElementById('apercu-campagne-sujet')?.value || '';
  const corps = document.getElementById('apercu-campagne-corps')?.value || '';
  if (!client || !client.email) { showError("Ce client n'a pas d'email enregistré."); return; }
  window.open(`mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`, '_blank');
}

// SEULE action qui envoie réellement quelque chose — déclenchée explicitement par un clic depuis
// l'aperçu, jamais automatiquement. Un seul destinataire à la fois (le client sélectionné).
async function envoyerApercuEmailCampagneViaOutlook() {
  const cibles = window._apercuEmailCampagneCibles || [];
  const clientId = document.getElementById('apercu-campagne-client')?.value;
  const client = cibles.find(c => c.id === clientId);
  const sujet = document.getElementById('apercu-campagne-sujet')?.value || '';
  const corps = document.getElementById('apercu-campagne-corps')?.value || '';
  if (!client || !client.email) { showError("Ce client n'a pas d'email enregistré."); return; }
  if (!confirm(`Envoyer ce courriel à ${client.email} depuis jo@cofidex.ch ?`)) return;
  if (!(await assurerTokenOutlook())) { showError('Connecte-toi à Outlook (bouton Microsoft dans le menu) pour envoyer.'); return; }
  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { subject: sujet, body: { contentType: 'text', content: corps }, toRecipients: [{ emailAddress: { address: client.email } }] },
        saveToSentItems: true,
      }),
    });
    if (r.ok) { showError('✓ Email envoyé à ' + client.email); document.getElementById('modal-apercu-email-campagne')?.remove(); }
    else { showError("Échec de l'envoi — réessaie ou utilise « Ouvrir dans mon client mail »."); }
  } catch (e) { showError("Échec de l'envoi — réessaie ou utilise « Ouvrir dans mon client mail »."); }
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
      t += `  ${CAT_LABELS[cat]}: Souscription CHF ${fmtCHF2(v.acquisition)} / Portefeuille CHF ${fmtCHF2(v.gestion)}\n`;
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
  const aRefacturer = lignes.filter(c => !c.refacture_le);
  const totalARefacturer = aRefacturer.reduce((s,c) => s + Number(c.montant_final != null ? c.montant_final : (c.montant_estime||0)), 0);

  return `
    <button onclick="navigate('oz-assure')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour OZ Assure</button>
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">Commissions Assurex versées à OZ Assure</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Historique privé : commissions gérées dans le CRM mais réglées directement sur le compte OZ Assure (portefeuille pré-fusion, ou conventions d'assureurs pas encore basculées vers Assurex). Ces montants n'apparaissent plus dans "Toutes les commissions" ni dans les statistiques Assurex — cette page est visible uniquement par toi.</div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${statCard('Dossiers', lignes.length, '#38bdf8')}
      ${statCard('Total versé à OZ', 'CHF ' + Math.round(total).toLocaleString(), '#1a56db')}
      ${statCard('Encore à refacturer', 'CHF ' + Math.round(totalARefacturer).toLocaleString(), aRefacturer.length ? '#f59e0b' : '#4ade80')}
    </div>
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:1fr 130px 110px 130px 90px"><div>Client / Produit</div><div>Compagnie</div><div>Montant</div><div>Refacturation</div><div></div></div>
      ${lignes.map(c => `<div class="table-row" style="grid-template-columns:1fr 130px 110px 130px 90px">
        <div><div style="font-size:13px;font-weight:700;color:var(--text)">${c.client_nom||'—'}</div><div style="font-size:11px;color:var(--text-muted)">${c.produit||''}</div></div>
        <div style="font-size:12px;color:var(--text-muted)">${c.compagnie||''}</div>
        <div style="font-weight:800;color:#1a56db">CHF ${fmtCHF(Number(c.montant_final != null ? c.montant_final : (c.montant_estime||0)))}</div>
        <div>${c.refacture_le ? `<span style="color:#4ade80;font-size:11.5px;font-weight:700">✓ Faite le ${fmtDate(c.refacture_le)}</span>` : `<span style="color:#f59e0b;font-size:11.5px;font-weight:700">⏳ À refacturer</span>`}</div>
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
        <div style="font-weight:700;font-size:13px;color:var(--text)">${c.compagnie}${c.convention && c.convention.valable_des ? `<div style="font-size:10px;font-weight:600;color:#4ade80;margin-top:2px">📄 Convention active dès ${fmtDate(c.convention.valable_des)}</div>` : ''}</div>
        <div style="font-size:12.5px;color:var(--text-muted)">${c.libelle_contact || '—'}</div>
        <div style="font-size:12.5px;color:${c.email ? 'var(--text)' : '#f87171'}">${c.email || 'Non renseigné'}</div>
        <div><button onclick="showFormContactCompagnie('${c.id}')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:4px 8px;font-size:12px;cursor:pointer">✏️</button></div>
      </div>`).join('') || '<div class="table-empty">Aucune compagnie enregistrée.</div>'}
    </div>`;
}

function showFormContactCompagnie(id) {
  const existant = id ? (window._contactsCompagnies || []).find(c => c.id === id) : null;
  const conv = (existant && existant.convention) || {};
  creerModale('modal-contact-cie', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto">
      <h3 style="margin:0 0 20px;font-size:16px;font-weight:800;color:var(--text)">${existant ? 'Modifier' : 'Ajouter'} une compagnie</h3>
      <div class="form-grid">
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Nom de la compagnie *</label><input class="form-input" id="cc-nom" value="${existant ? existant.compagnie : ''}"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Libellé contact (agence/courtier)</label><input class="form-input" id="cc-libelle" value="${existant ? (existant.libelle_contact||'') : ''}"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Email</label><input class="form-input" id="cc-email" type="email" value="${existant ? (existant.email||'') : ''}"/></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin:18px 0 8px">Convention / contrat de collaboration (facultatif)</div>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">Valable dès le</label><input class="form-input" id="cc-conv-valable" type="date" value="${conv.valable_des || ''}"/></div>
        <div class="form-field"><label class="form-label">Signée le</label><input class="form-input" id="cc-conv-signee" type="date" value="${conv.signee_le || ''}"/></div>
        <div class="form-field"><label class="form-label">Facteur rémun. Non-vie</label><input class="form-input" id="cc-conv-fnv" type="number" step="0.1" value="${conv.facteur_nv || ''}" placeholder="1.8"/></div>
        <div class="form-field"><label class="form-label">Facteur rémun. Vie indiv.</label><input class="form-input" id="cc-conv-fvi" type="number" step="0.1" value="${conv.facteur_vi || ''}" placeholder="0.9"/></div>
        <div class="form-field"><label class="form-label">Facteur rémun. Vie coll.</label><input class="form-input" id="cc-conv-fvc" type="number" step="0.1" value="${conv.facteur_vc || ''}" placeholder="1.0"/></div>
        <div class="form-field"><label class="form-label">Contact agence générale</label><input class="form-input" id="cc-conv-contact" value="${conv.contact_agence || ''}" placeholder="Nom, adresse"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Notes (barème, particularités...)</label><textarea class="form-input" id="cc-conv-notes" rows="2" style="resize:vertical">${conv.notes || ''}</textarea></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn-secondary" onclick="document.getElementById('modal-contact-cie').remove()">Annuler</button>
        <button class="btn-save" onclick="saveContactCompagnie(${existant ? `'${existant.id}'` : 'null'})">✓ Enregistrer</button>
      </div>
    </div>`, { overflowY: false });
}

async function saveContactCompagnie(id) {
  const v = key => { const el = document.getElementById(key); return el && el.value.trim() ? el.value.trim() : undefined; };
  const convention = {};
  const setConv = (k, val) => { if (val !== undefined) convention[k] = val; };
  setConv('valable_des', v('cc-conv-valable'));
  setConv('signee_le', v('cc-conv-signee'));
  setConv('facteur_nv', v('cc-conv-fnv') !== undefined ? Number(v('cc-conv-fnv')) : undefined);
  setConv('facteur_vi', v('cc-conv-fvi') !== undefined ? Number(v('cc-conv-fvi')) : undefined);
  setConv('facteur_vc', v('cc-conv-fvc') !== undefined ? Number(v('cc-conv-fvc')) : undefined);
  setConv('contact_agence', v('cc-conv-contact'));
  setConv('notes', v('cc-conv-notes'));

  const body = {
    compagnie: document.getElementById('cc-nom').value.trim(),
    libelle_contact: document.getElementById('cc-libelle').value.trim() || null,
    email: document.getElementById('cc-email').value.trim() || null,
    convention,
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
            <div style="color:#38bdf8;font-size:14px;font-weight:800">CHF ${fmtCHF(ca)}</div>
          </div>
          <div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:9px;padding:10px 14px">
            <div style="color:var(--text-muted);font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:4px">Commissions générées (via fiche de paie)</div>
            <div style="color:#4ade80;font-size:14px;font-weight:800">CHF ${fmtCHF(Math.round(commGeneree))}</div>
          </div>
        </div>
        ${a.email === currentUser.email ? `
        <div style="margin-top:14px;background:var(--surface-alt);border-radius:10px;padding:16px">
          <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:8px">✍️ Ma signature — reprise automatiquement sur les mandats de courtage</div>
          ${a.signature_image ? `
            <img src="${a.signature_image}" style="max-height:60px;max-width:220px;background:#fff;border-radius:6px;padding:6px;display:block;margin-bottom:10px"/>
            <button class="btn-secondary" onclick="ouvrirModaleMaSignature('${a.id}')">✏️ Redessiner</button>
          ` : `
            <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px">Aucune signature enregistrée — une fois enregistrée, elle sera ajoutée automatiquement (avec la date du jour) sur tous les mandats de courtage générés.</div>
            <button class="btn-save" onclick="ouvrirModaleMaSignature('${a.id}')">✍️ Enregistrer ma signature</button>
          `}
        </div>
        <div style="margin-top:14px;background:var(--surface-alt);border-radius:10px;padding:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${a.rdv_actif ? '12px' : '0'}">
            <div style="font-size:12px;font-weight:800;color:var(--text)">📅 Prise de RDV en autonomie — reliée aux clients</div>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11.5px;color:var(--text-muted)">
              <input type="checkbox" ${a.rdv_actif ? 'checked' : ''} onchange="toggleRdvActif('${a.id}', this.checked)"/> Activer
            </label>
          </div>
          ${a.rdv_actif ? `
            <div class="form-grid" style="margin-bottom:10px">
              <div class="form-field" style="grid-column:span 2"><label class="form-label">Jours travaillés</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  ${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((lbl, i) => `<label style="display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--text)"><input type="checkbox" id="rdv-jour-${i+1}-${a.id}" ${(a.rdv_jours_travail || [1,2,3,4,5]).includes(i+1) ? 'checked' : ''}/> ${lbl}</label>`).join('')}
                </div>
              </div>
              <div class="form-field"><label class="form-label">Heure de début</label><input class="form-input" id="rdv-heure-debut-${a.id}" type="time" value="${a.rdv_heure_debut || '08:00'}"/></div>
              <div class="form-field"><label class="form-label">Heure de fin</label><input class="form-input" id="rdv-heure-fin-${a.id}" type="time" value="${a.rdv_heure_fin || '18:00'}"/></div>
              <div class="form-field"><label class="form-label">Durée du RDV (min)</label><input class="form-input" id="rdv-duree-${a.id}" type="number" value="${a.rdv_duree_defaut || 45}"/></div>
              <div class="form-field"><label class="form-label">Délai minimum (heures)</label><input class="form-input" id="rdv-delai-${a.id}" type="number" value="${a.rdv_delai_min_heures ?? 24}"/></div>
              <div class="form-field"><label class="form-label">Réservable jusqu'à (jours)</label><input class="form-input" id="rdv-horizon-${a.id}" type="number" value="${a.rdv_horizon_jours || 30}"/></div>
            </div>
            <button class="btn-save" onclick="saveConfigRdv('${a.id}')">💾 Enregistrer les disponibilités</button>
            ${a.rdv_token ? `
              <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
                <input class="form-input" readonly value="${window.location.origin}${window.location.pathname}?rdv=${a.rdv_token}" style="flex:1;font-size:11px;color:var(--text-muted)" onclick="this.select()"/>
                <button class="btn-secondary" onclick="copierLienRdv('${a.rdv_token}')">📋 Copier le lien</button>
              </div>
            ` : ''}
          ` : `<div style="font-size:11.5px;color:var(--text-muted)">Une fois activée, un lien public sera généré : tes clients/prospects pourront y réserver un créneau libre, qui atterrit automatiquement dans le CRM et — à ta prochaine connexion Outlook — dans ton agenda.</div>`}
        </div>` : ''}
      </div>`;
    }).join('')}
    ${currentUser.role === 'signataire' ? `<button class="btn-save" style="margin-top:4px" onclick="navigate('nouveau-agent')">+ Ajouter un agent</button>` : ''}
    <div style="margin-top:20px">
      <button onclick="logout()" style="background:var(--red-dim);color:var(--red);border:1px solid rgba(248,113,113,0.3);border-radius:10px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">🚪 Se déconnecter</button>
    </div>`;
}

// ═══ SIGNATURE DE L'AGENT (Jonathan) — enregistrée une fois, reprise automatiquement sur les
// mandats de courtage générés (js/05, genererMandatCourtage). Réutilise le même mécanisme de
// canvas que la capture de signature client (initCanvasSignature/effacerSignature, js/05),
// avec un id de canvas distinct pour ne jamais interférer avec une signature en cours ailleurs.
function ouvrirModaleMaSignature(agentId) {
  creerModale('modal-ma-signature', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:480px;width:100%">
      <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">✍️ Ma signature</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">Dessine ta signature ci-dessous — elle sera reprise automatiquement sur tous les mandats de courtage générés (côté « Le mandataire »), avec la date du jour.</div>
      <canvas id="canvas-signature-agent" width="460" height="200" style="width:100%;height:200px;background:#fff;border-radius:9px;touch-action:none;cursor:crosshair;display:block"></canvas>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn-secondary" onclick="effacerSignature('canvas-signature-agent')">🗑️ Effacer</button>
        <button class="btn-secondary" onclick="document.getElementById('modal-ma-signature').remove()">Annuler</button>
        <button class="btn-save" onclick="enregistrerMaSignature('${agentId}')" style="margin-left:auto">✓ Enregistrer</button>
      </div>
    </div>`, { opacite: 0.8, padding: '16px', overflowY: false });
  initCanvasSignature('canvas-signature-agent');
}

async function enregistrerMaSignature(agentId) {
  const canvas = document.getElementById('canvas-signature-agent');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const aDessine = pixels.some((v, i) => i % 4 === 3 && v > 0);
  if (!aDessine) { showError('Dessine ta signature avant d\'enregistrer.'); return; }
  const signatureDataUrl = canvas.toDataURL('image/png');
  const r = await dbPatch('agents', agentId, { signature_image: signatureDataUrl });
  if (r && r.error) { showError('Erreur lors de l\'enregistrement : ' + errMsg(r)); return; }
  const agent = allAgents.find(a => a.id === agentId);
  if (agent) agent.signature_image = signatureDataUrl;
  document.getElementById('modal-ma-signature')?.remove();
  showError('✓ Signature enregistrée — elle apparaîtra désormais sur tes mandats de courtage.');
  navigate('agents');
}

// ═══ PRISE DE RDV EN AUTONOMIE — configuration par agent (Paramètres → Agents) ═══
// Active/désactive le lien public de réservation et génère son token la première fois (jamais
// régénéré ensuite, pour ne pas casser un lien déjà partagé/imprimé/mis en signature email).
async function toggleRdvActif(agentId, actif) {
  const agent = allAgents.find(a => a.id === agentId);
  const body = { rdv_actif: actif };
  if (actif && agent && !agent.rdv_token) {
    body.rdv_token = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
  }
  const r = await dbPatch('agents', agentId, body);
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  if (agent) Object.assign(agent, body);
  navigate('agents');
}

async function saveConfigRdv(agentId) {
  const jours = [1, 2, 3, 4, 5, 6, 7].filter(j => document.getElementById(`rdv-jour-${j}-${agentId}`)?.checked);
  const body = {
    rdv_jours_travail: jours,
    rdv_heure_debut: document.getElementById(`rdv-heure-debut-${agentId}`)?.value || '08:00',
    rdv_heure_fin: document.getElementById(`rdv-heure-fin-${agentId}`)?.value || '18:00',
    rdv_duree_defaut: Number(document.getElementById(`rdv-duree-${agentId}`)?.value) || 45,
    rdv_delai_min_heures: Number(document.getElementById(`rdv-delai-${agentId}`)?.value) || 24,
    rdv_horizon_jours: Number(document.getElementById(`rdv-horizon-${agentId}`)?.value) || 30,
  };
  const r = await dbPatch('agents', agentId, body);
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  const agent = allAgents.find(a => a.id === agentId);
  if (agent) Object.assign(agent, body);
  showError('✓ Disponibilités enregistrées.');
}

function copierLienRdv(token) {
  const lien = `${window.location.origin}${window.location.pathname}?rdv=${token}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(lien).then(() => showError('✓ Lien copié — prêt à partager.')).catch(() => showError('Lien : ' + lien));
  } else { showError('Lien : ' + lien); }
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
const _tokenRdv = _paramsInitiaux.get('rdv');
if (_tokenSignature) {
  afficherPageSignatureAutonome(_tokenSignature);
} else if (_tokenRdv) {
  afficherPageReservationRdv(_tokenRdv, _paramsInitiaux.get('client'));
} else {
  initMSAL();
  tryRestoreSession();
}
