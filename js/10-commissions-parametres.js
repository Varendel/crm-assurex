// ═══ LA DATE D'UNE COMMISSION DANS « TOUTES LES COMMISSIONS » (21.09.2026) ═══════════════════════
// « C'est écrit que j'ai encaissé Victor Grandval le 19.09, c'est faux. » La liste affichait la date
// de CRÉATION de la ligne — pour une ligne importée d'un décompte, le jour de l'import — comme si
// c'était celle de l'encaissement. Désormais : une commission encaissée montre sa vraie date de
// réception (la sienne, ou celle de son bordereau), la date de saisie en petit ; une commission
// encore attendue montre sa date de saisie, dite comme telle. Tri et filtres suivent la même date.
function tcEncaissee(c) { return c.statut === 'reçue' || c.statut === 'versé_oz'; }
function tcDateReception(c) {
  if (c.date_reception) return String(c.date_reception).slice(0, 10);
  const b = c.bordereau_id && typeof allBordereaux !== 'undefined' ? allBordereaux.find(x => x.id === c.bordereau_id) : null;
  return b && b.date_reception ? String(b.date_reception).slice(0, 10) : '';
}
// « À refacturer à OZ » (22.09.2026) : une seule règle — ozARefacturer (js/34) — pour la carte,
// l'onglet, la page Commissions et le Cockpit. Repli si js/34 n'est pas chargé.
function tcARefacturer(c) {
  if (typeof ozARefacturer === 'function') return ozARefacturer(c);
  return c.statut === 'versé_oz' && typeof ozPartAssurex === 'function' && ozPartAssurex(c) && !c.refacture_le;
}
function tcDateRef(c) { return tcDateReception(c) || String(c.date_creation || '').slice(0, 10); }
function tcDatesHtml(c) {
  const saisie = c.date_creation ? fmtDate(c.date_creation) : '';
  if (tcEncaissee(c)) {
    const r = tcDateReception(c);
    // 22.09.2026 : une date conventionnelle (date_reception_estimee) ou une date encore à venir n'est
    // pas un fait — on ne l'écrit plus « Reçue le », mais comme l'estimation qu'elle est.
    const auj = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    if (r && (c.date_reception_estimee || r > auj)) return `<span title="Date conventionnelle : aucun relevé ne date encore cet encaissement">≈ reçue vers le ${fmtDate(r)} (date estimée)</span>${saisie ? `<small class="tcx-saisie">saisie le ${saisie}</small>` : ''}`;
    return r ? `<span title="Date à laquelle l'argent est arrivé">Reçue le ${fmtDate(r)}</span>${saisie ? `<small class="tcx-saisie">saisie le ${saisie}</small>` : ''}`
             : `<span class="tcx-manque" title="Aucune date de réception enregistrée : à compléter">Date de réception inconnue</span>${saisie ? `<small class="tcx-saisie">saisie le ${saisie}</small>` : ''}`;
  }
  return saisie ? `<span title="Date à laquelle la commission a été enregistrée">Saisie le ${saisie}</span>` : '<span>—</span>';
}

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
        <div style="font-size:10px;font-weight: 500;color:var(--text-muted);text-transform:uppercase">Versements partiels ${tranches.length > 0 ? `(${tranches.length})` : ''}</div>
        ${tranches.length > 0 ? `<div style="font-size:11.5px;font-weight: 500;color:${solde ? '#4ade80' : '#f59e0b'}">Reçu CHF ${fmtCHF(recu)} / ${cible.toLocaleString()} — ${solde ? 'soldé ✓' : `reste CHF ${fmtCHF(reste)}`}</div>` : ''}
      </div>
      ${tranches.length > 0 ? tranches.map(t => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:11.5px;color:var(--text)">
          <span>${fmtDate(t.date_reception)} — CHF ${fmtCHF(Number(t.montant))}${t.note ? ` · ${t.note}` : ''}</span>
          <button type="button" onclick="supprimerVersementCommission('${t.id}', '${c.id}')" style="background:none;border:none;color:var(--c-danger-texte);cursor:pointer;font-size:12px">✕</button>
        </div>`).join('') : `<div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">Aucun versement enregistré — utile si cette commission est payée en plusieurs fois (ex. convention hors décompte assureur).</div>`}
      <div style="display:flex;gap:8px;margin-top:8px">
        <input class="form-input" id="vp-montant" type="number" step="0.01" placeholder="Montant CHF" style="max-width:130px"/>
        <input class="form-input" id="vp-date" type="date" value="${new Date().toISOString().split('T')[0]}" style="max-width:150px"/>
        <input class="form-input" id="vp-note" placeholder="Note (optionnel)" style="flex:1"/>
        <button type="button" onclick="ajouterVersementCommission('${c.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:0 14px;font-size:12px;font-weight: 500;cursor:pointer;white-space:nowrap">+ Ajouter</button>
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
  allCommissionTranches = await dbGet('commission_tranches', 'annule=eq.false&select=*');
  showModalEditCommission(commId);
  renderToutesCommissions();
}

async function supprimerVersementCommission(trancheId, commId) {
  if (!confirm('Annuler ce versement ? Il ne sera plus déduit (il reste visible dans l’historique de la base).')) return;
  await dbPatch('commission_tranches', trancheId, { annule: true }); // jamais de suppression
  allCommissionTranches = await dbGet('commission_tranches', 'annule=eq.false&select=*');
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
      <h3 style="margin:0 0 6px;font-size:16px;font-weight: 600;color:var(--text)">Commission — ${c.client_nom || nomResolu || '—'}</h3>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">${b ? `Rapprochée du bordereau ${b.numero || ''}` : "Pas encore rapprochée d'un bordereau"}</div>

      ${cl ? `<div style="background:var(--surface-alt);border-radius:10px;padding:12px 14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:12.5px;color:var(--text);font-weight: 600">👤 ${nomResolu || '—'}</div>
          <button type="button" onclick="document.getElementById('modal-edit-commission').remove(); showClient('${cl.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:3px 10px;font-size:10.5px;cursor:pointer;font-weight: 600">Voir la fiche client →</button>
        </div>
      </div>` : `<div style="background:color-mix(in srgb, var(--c-danger) 8%, transparent);border:1px solid color-mix(in srgb, var(--c-danger) 20%, transparent);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:11.5px;color:var(--c-danger-texte)">⚠ Aucun client identifiable pour cette commission (ni contrat lié, ni client_id) — corrige le champ "Client" ci-dessous à la main si tu sais de qui il s'agit.</div>`}

      ${ct ? `<div style="background:var(--surface-alt);border-radius:10px;padding:12px 14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:10px;font-weight: 500;color:var(--text-muted);text-transform:uppercase">Contrat lié</div>
          <button type="button" onclick="document.getElementById('modal-edit-commission').remove(); showDetailContrat('${ct.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:3px 10px;font-size:10.5px;cursor:pointer;font-weight: 500">Voir le contrat →</button>
        </div>
        <div style="font-size:12.5px;color:var(--text)">${ct.produit} · ${ct.compagnie}</div>
        <div style="font-size:11px;color:var(--text-muted)">Prime CHF ${fmtCHF(Number(ct.prime_annuelle||0))}/an${ct.date_debut ? ' · Signé le ' + fmtDate(ct.date_debut) : ''}${ct.numero_police ? ' · № ' + ct.numero_police : ''}</div>
      </div>` : `<div style="background:color-mix(in srgb, var(--c-danger) 8%, transparent);border:1px solid color-mix(in srgb, var(--c-danger) 20%, transparent);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:11.5px;color:var(--c-danger-texte)">⚠ Aucun contrat lié à cette commission — impossible de vérifier son origine automatiquement.</div>`}

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
          <option value="en_attente_naissance" ${c.statut==='en_attente_naissance'?'selected':''}>🍼 En attente de la naissance</option>
          <option value="reçue" ${c.statut==='reçue'?'selected':''}>Reçue (Assurex)</option>
          <option value="versé_oz" ${c.statut==='versé_oz'?'selected':''}>Versée sur OZ (convention pas encore fusionnée — à refacturer)</option>
          <option value="extourné" ${c.statut==='extourné'?'selected':''}>↩ Extournée (contrat policé puis annulé après versement)</option>
          <option value="annulée" ${c.statut==='annulée'?'selected':''}>❌ Annulée (ne sera jamais versée)</option>
          ${c.statut === 'annulé' ? `<option value="annulé" selected>❌ Annulé (ancien statut — passe en Extournée si le contrat a été policé, sinon remets En attente)</option>` : ''}
          ${/* 22.09.2026 : sans option pour son statut, le select retombait sur « En attente » et un simple
               « Enregistrer » (pour corriger un nom) changeait le statut. Tout statut inconnu de la liste
               (ex. versé_cofidex) est donc repris tel quel. */ ''}
          ${c.statut && !['en_attente', 'en_attente_naissance', 'reçue', 'versé_oz', 'extourné', 'annulée', 'annulé'].includes(c.statut) ? `<option value="${c.statut}" selected>${statutCommissionLabel(c.statut)}</option>` : ''}
        </select></div>
        <div class="form-field" id="ec-refacturee-field" style="display:${c.statut === 'versé_oz' ? 'block' : 'none'}"><label class="form-label">Refacturée à Assurex ?</label><select class="form-select" id="ec-refacturee">
          <option value="non" ${!c.refacture_le?'selected':''}>Non — encore à transférer en interne</option>
          <option value="oui" ${c.refacture_le?'selected':''}>Oui — déjà transférée</option>
        </select></div>
      </div>
      ${blocVersementsPartiels(c)}

      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="deleteCommission('${commId}')" style="background:color-mix(in srgb, var(--c-danger) 12%, transparent);color:var(--c-danger-texte);border:1px solid color-mix(in srgb, var(--c-danger) 30%, transparent);border-radius:9px;padding:10px 16px;font-weight: 600;font-size:13px;cursor:pointer">🗑️ Supprimer</button>
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
  // 22.09.2026 — extournes : encaissé puis repris = 0 net, jamais −X. La commission « extourné » qui
  // avait été encaissée continue de compter +|X| (commissionExtourneeEncaissee, js/29) ; c'est CETTE
  // reprise négative, une fois reçue, qui porte seule la déduction. Elle n'a donc de sens que si de
  // l'argent était réellement arrivé (reçue, versée à OZ, ou versements partiels) : extourner une
  // commission jamais encaissée ne doit rien retrancher (elle compte déjà 0).
  const originalEncaissee = original && (['reçue', 'versé_oz', 'versé_cofidex'].includes(original.statut) || totalVersementsCommission(commId) !== 0);
  if (body.statut === 'extourné' && !etaitDejaExtourne && !originalEncaissee) {
    showError('Commission extournée. Elle n’avait jamais été encaissée : aucune reprise négative n’est créée.');
  }
  if (body.statut === 'extourné' && !etaitDejaExtourne && originalEncaissee) {
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
  dbGet('commission_tranches', 'annule=eq.false&select=*').then(t => { allCommissionTranches = t; renderToutesCommissions(); });
  setTimeout(() => renderToutesCommissions(), 0);
  const compagniesPresentes = [...new Set(allCommissionsAttente.map(c => normaliserCompagnie(c.compagnie)).filter(Boolean))].sort();
  // Vue modernisée le 19.09.2026 : en-tête bandeau, statuts en onglets avec compteurs, indicateurs
  // en cartes, répartition par entité, lignes avec logo compagnie et n° de police. Les filtres et le
  // calcul sont inchangés (mêmes id), le statut est porté par un champ caché #tc-statut.
  return `<div class="tcx">
    ${printHeaderCorporate('Toutes les commissions', 'Rapport des commissions dues et reçues')}
    <header class="dx-tete no-print">
      <div><div class="dx-surtitre">Finances · Commissions</div><h2>Toutes les commissions</h2>
        <p class="dx-sous">Estimées à la signature, puis soldées par les décomptes (import ou « Rapprocher une commission » sur le bordereau). Clique une ligne pour la modifier.</p></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-secondary" onclick="exporterCommissionsCsv()">⬇️ Export Excel</button>
        <button type="button" class="btn-secondary" onclick="window.print()">🖨️ Imprimer / PDF</button>
      </div>
    </header>
    <div id="tc-stats" class="dbx-kpis tcx-kpis"></div>
    <input type="hidden" id="tc-statut" value="${statutInitial || ''}"/>
    <div id="tc-onglets" class="dbx-onglets tcx-onglets no-print" role="tablist" aria-label="Statut"></div>
    <div class="tcx-filtres no-print">
      <input class="form-input" id="tc-search" placeholder="🔍 Client, compagnie, produit, n° de police, bordereau…" oninput="renderToutesCommissions()"/>
      <select class="form-select" id="tc-compagnie" onchange="renderToutesCommissions()">
        <option value="">Toutes compagnies</option>
        ${compagniesPresentes.map(comp => `<option value="${comp}">${comp}</option>`).join('')}
      </select>
      <select class="form-select" id="tc-nature" onchange="renderToutesCommissions()">
        <option value="">Acquisition + Gestion</option>
        <option value="acquisition">Acquisition uniquement</option>
        <option value="gestion">Gestion uniquement</option>
      </select>
      <select class="form-select" id="tc-typeclient" onchange="renderToutesCommissions()">
        <option value="">Privés + Entreprises</option>
        <option value="prive">Client privé</option>
        <option value="entreprise">Entreprise</option>
      </select>
      <select class="form-select" id="tc-entite" onchange="renderToutesCommissions()">
        <option value="">Toutes entités</option>
        <option value="oz">${OZ_MINI_LOGO} Clients OZ Assure</option>
        <option value="assurex">${COFIDEX_MINI_LOGO} Clients Assurex / EX Groupe</option>
        <option value="aucun">— Non marqués</option>
      </select>
      <label class="tcx-date"><span>Du</span><input type="date" class="form-input" id="tc-date-debut" title="Date de réception (à défaut, date de saisie) — du" onchange="renderToutesCommissions()"/></label>
      <label class="tcx-date"><span>au</span><input type="date" class="form-input" id="tc-date-fin" title="Date de réception (à défaut, date de saisie) — au" onchange="renderToutesCommissions()"/></label>
      <select class="form-select" id="tc-tri" onchange="renderToutesCommissions()">
        <option value="date">Plus récent d'abord</option>
        <option value="montant_desc" selected>Montant décroissant</option>
        <option value="prevue">Date d'encaissement prévue</option>
      </select>
    </div>
    <div id="tc-entites" class="tcx-entites"></div>
    <div id="tc-table"></div>
  </div>`;
}

function tcChoisirStatut(v) {
  const el = document.getElementById('tc-statut');
  if (el) el.value = v;
  renderToutesCommissions();
}

let _tcCommissionsFiltrees = [];

function exporterCommissionsCsv() {
  function numeroBordereauDe2(c) {
    if (!c.bordereau_id) return '';
    const b = allBordereaux.find(bd => bd.id === c.bordereau_id);
    return b ? (b.numero || '') : '';
  }
  // 22.09.2026 : la date de réception (la sienne ou celle du bordereau) rejoint l'export — la liste
  // la montre et la filtre, l'Excel ne donnait que la date de saisie.
  const entetes = ['Client', 'Produit', 'Compagnie', 'Statut', 'Nature', 'Montant (CHF)', 'N° bordereau', 'Date réception', 'Date réception estimée', 'Date création', 'Entité'];
  const lignes = _tcCommissionsFiltrees.map(c => {
    const cl = c.client_id ? allClients.find(x => x.id === c.client_id) : null;
    const entite = cl && cl.source_oz ? 'OZ Assure' : cl && cl.source_cofidex ? 'Assurex/EX' : '—';
    const montant = c.montant_final != null ? c.montant_final : (c.montant_estime || 0);
    return [c.client_nom || '', c.produit || '', c.compagnie || '', c.statut || '', c.nature || 'acquisition', Number(montant), numeroBordereauDe2(c), tcDateReception(c), c.date_reception_estimee ? 'oui' : '', c.date_creation || '', entite];
  });
  exporterCsv('toutes_les_commissions_' + new Date().toISOString().slice(0,10), entetes, lignes);
}

function renderToutesCommissions() {
  const search = (document.getElementById('tc-search')?.value || '').toLowerCase().trim();
  const compagnieFilter = document.getElementById('tc-compagnie')?.value || '';
  const statutFilter = document.getElementById('tc-statut')?.value || '';
  const natureFilter = document.getElementById('tc-nature')?.value || '';
  const typeClientFilter = document.getElementById('tc-typeclient')?.value || '';
  const entiteFilter = document.getElementById('tc-entite')?.value || '';
  const dateDebutFilter = document.getElementById('tc-date-debut')?.value || '';
  const dateFinFilter = document.getElementById('tc-date-fin')?.value || '';
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

  // Cartes de synthèse (19.09.2026) : calculées sur TOUS les statuts (mêmes autres filtres). Avant,
  // elles suivaient le filtre « Statut » — resté sur « En attente » par défaut, « Reçues (brut) »
  // affichait donc toujours 0. Les versements partiels encaissés par Assurex sur une commission
  // encore en attente (conventions échelonnées) comptent aussi dans le reçu.
  const passeAutresFiltres = c => {
    if (c.contrat_id) { const ct = allContrats.find(x => x.id === c.contrat_id); if (ct && (ct.commissionne === false || ct.statut === 'annulé')) return false; }
    if (compagnieFilter && normaliserCompagnie(c.compagnie) !== compagnieFilter) return false;
    if (natureFilter && (c.nature || 'acquisition') !== natureFilter) return false;
    if (typeClientFilter && typeClientDe(c) !== typeClientFilter) return false;
    if (entiteFilter) {
      const clEnt = c.client_id ? allClients.find(x => x.id === c.client_id) : null;
      if (entiteFilter === 'oz' && !(clEnt && clEnt.source_oz)) return false;
      if (entiteFilter === 'assurex' && !(clEnt && clEnt.source_cofidex)) return false;
      if (entiteFilter === 'aucun' && (clEnt && (clEnt.source_oz || clEnt.source_cofidex))) return false;
    }
    if (dateDebutFilter && (!tcDateRef(c) || tcDateRef(c) < dateDebutFilter)) return false;
    if (dateFinFilter && (!tcDateRef(c) || tcDateRef(c) > dateFinFilter)) return false;
    if (search) {
      const haystack = `${c.client_nom||''} ${c.compagnie||''} ${c.produit||''} ${c.numero_police||''} ${numeroBordereauDe(c)}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  };
  const baseTous = allCommissionsAttente.filter(passeAutresFiltres);
  // 22.09.2026 : une commission annulée ne sera jamais versée — hors des totaux et de « Toutes »,
  // visible seulement dans son propre onglet.
  const estAnnulee = c => c.statut === 'annulée' || c.statut === 'annulé';
  const baseStats = baseTous.filter(c => c.statut !== 'versé_oz' && !estAnnulee(c));
  const tranchesAssurex = id => (typeof allCommissionTranches !== 'undefined' ? allCommissionTranches : [])
    .filter(t => t.commission_id === id && !t.annule && t.encaisse_par !== 'oz').reduce((s, t) => s + Number(t.montant || 0), 0);

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
    // « OZ à refacturer » : même règle que la carte, la page OZ et le Cockpit (ozARefacturer, js/34 —
    // 22.09.2026). Avant, l'onglet prenait TOUT le versé OZ non refacturé, santé et acquisitions
    // sans apporteur comprises, qui restent pourtant chez OZ.
    if (statutFilter === 'versé_oz_a_refacturer') {
      if (!tcARefacturer(c)) return false;
    } else if (statutFilter && c.statut !== statutFilter) return false;
    if (!statutFilter && estAnnulee(c)) return false; // « Toutes » : sans les annulées (22.09.2026)
    if (natureFilter && (c.nature || 'acquisition') !== natureFilter) return false;
    if (typeClientFilter && typeClientDe(c) !== typeClientFilter) return false;
    if (entiteFilter) {
      const clEnt = c.client_id ? allClients.find(x => x.id === c.client_id) : null;
      if (entiteFilter === 'oz' && !(clEnt && clEnt.source_oz)) return false;
      if (entiteFilter === 'assurex' && !(clEnt && clEnt.source_cofidex)) return false;
      if (entiteFilter === 'aucun' && (clEnt && (clEnt.source_oz || clEnt.source_cofidex))) return false;
    }
    if (dateDebutFilter && (!tcDateRef(c) || tcDateRef(c) < dateDebutFilter)) return false;
    if (dateFinFilter && (!tcDateRef(c) || tcDateRef(c) > dateFinFilter)) return false;
    if (search) {
      const haystack = `${c.client_nom||''} ${c.compagnie||''} ${c.produit||''} ${c.numero_police||''} ${numeroBordereauDe(c)}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }).sort((a,b) => {
    if (tri === 'montant_desc') return montantC(b) - montantC(a);
    if (tri === 'prevue') return (commissionDatePrevue(a) || '9999').localeCompare(commissionDatePrevue(b) || '9999');
    return String(tcDateRef(b) || '').localeCompare(String(tcDateRef(a) || ''));
  });

  _tcCommissionsFiltrees = filtered;

  // En attente : reste après versements partiels (paiements échelonnés)
  // 22.09.2026 : « à encaisser » = commissionAEncaisser (js/29), la même définition que la carte du
  // tableau de bord et le Cockpit — naissances comprises, gestion encaissée par OZ exclue.
  const aEncaisser = c => typeof commissionAEncaisser === 'function' ? commissionAEncaisser(c) : c.statut === 'en_attente';
  const totalAttente = baseStats.filter(aEncaisser).reduce((s,c) => s + (typeof commissionResteAttendu === 'function' ? commissionResteAttendu(c) : montantC(c)), 0);
  // 22.09.2026 — extournes : encaissé puis repris = 0 net, jamais −X. Une extournée qui avait été
  // encaissée compte +|X| (commissionExtourneeEncaissee, js/29), jamais encaissée → 0 ; la reprise
  // négative, reçue au débit d'un bordereau, est dans recuDe et porte seule la déduction. Avant,
  // l'extourne était retranchée EN PLUS de la reprise : −X au lieu de 0.
  const montantExt = c => typeof commissionExtourneeEncaissee === 'function' ? commissionExtourneeEncaissee(c) : 0;
  const montantProduit = c => c.statut === 'extourné' ? montantExt(c) : montantC(c);
  const recuDe = c => c.statut === 'reçue' ? montantC(c) : c.statut === 'extourné' ? montantExt(c) : (aEncaisser(c) ? tranchesAssurex(c.id) : 0);
  const totalRecuBrut = baseStats.reduce((s,c) => s + recuDe(c), 0);
  const nbRecues = baseStats.filter(c => recuDe(c) !== 0).length;
  const totalExtourne = baseStats.filter(c => c.statut === 'extourné').reduce((s, c) => s + montantExt(c), 0);
  const totalRecuNet = totalRecuBrut;
  const totalAcquisition = baseStats.filter(c => (c.nature||'acquisition') === 'acquisition').reduce((s,c) => s + montantProduit(c), 0);
  const totalGestion = baseStats.filter(c => c.nature === 'gestion').reduce((s,c) => s + montantProduit(c), 0);

  // Répartition "qui rapporte quoi" par entité — même principe que dans "Tous les contrats" :
  // calculée sur les lignes filtrées par tous les autres critères (compagnie/statut/nature/...)
  // mais SANS le filtre entité lui-même, pour pouvoir comparer OZ / Assurex / non-marqués côte
  // à côte même quand "Toutes entités" est sélectionné. Extournées à leur montant encaissé (+|X| ou 0,
  // règle du 22.09.2026 — la reprise négative les compense).
  function totauxEntiteComm(testFn) {
    const lignes = filtered.filter(c => (statutFilter === 'annulée' || !estAnnulee(c)) && testFn(c.client_id ? allClients.find(x => x.id === c.client_id) : null));
    return { count: lignes.length, montant: lignes.reduce((s,c) => s + montantProduit(c), 0) };
  }
  const totOzC = totauxEntiteComm(cl => cl && cl.source_oz);
  const totAssurexC = totauxEntiteComm(cl => cl && cl.source_cofidex);
  const totAucunC = totauxEntiteComm(cl => !(cl && (cl.source_oz || cl.source_cofidex)));

  // Part encaissée par OZ qui revient à Assurex (à refacturer) : affichée à part pour que le total
  // « produit » corresponde à la vue interne Commissions (20.09.2026 — deux vues, un seul langage).
  const ozRefacturable = baseTous.filter(c => c.statut === 'versé_oz' && typeof ozPartAssurex === 'function' && ozPartAssurex(c));
  const totalOzRefacturable = ozRefacturable.reduce((s, c) => s + montantC(c), 0);
  const dejaRefacture = ozRefacturable.filter(c => c.refacture_le).reduce((s, c) => s + montantC(c), 0);
  // Reste à refacturer : la règle partagée (tcARefacturer → ozARefacturer), comme l'onglet qu'ouvre la carte
  const totalARefacturer = baseTous.filter(tcARefacturer).reduce((s, c) => s + montantC(c), 0);

  const kpi = (o) => typeof dbxKpi === 'function' ? dbxKpi(o) : statCard(o.label, (o.prefixe || '') + fmtCHF(Math.round(o.valeur)), '#00CFFF', o.sous);
  const zoneStats = document.getElementById('tc-stats');
  if (zoneStats) zoneStats.innerHTML = [
    kpi({ i: 0, label: 'En attente', valeur: totalAttente, prefixe: 'CHF ', sous: `${baseStats.filter(aEncaisser).length} commission(s) · reste attendu`, onclick: "tcChoisirStatut('en_attente')" }),
    kpi({ i: 1, label: 'Encaissé par Assurex', valeur: totalRecuNet, prefixe: 'CHF ', sous: `${nbRecues} commission(s) · versements partiels inclus${totalExtourne ? ` · dont ${fmtCHF(Math.round(totalExtourne))} extournés, compensés par leur reprise` : ''}`, onclick: "tcChoisirStatut('reçue')" }),
    kpi({ i: 2, label: 'Versé à OZ, revient à Assurex', valeur: totalOzRefacturable, prefixe: 'CHF ', sous: `reste à refacturer CHF ${fmtCHF(Math.round(totalARefacturer))}${dejaRefacture ? ` · ${fmtCHF(Math.round(dejaRefacture))} déjà refacturés` : ''}`, onclick: "tcChoisirStatut('versé_oz_a_refacturer')" }),
    // « Produit total » (21.09.2026) : cette carte ne totalisait PAS toutes les commissions, seulement
    // la part qui revient à Assurex. Avec le mot « total », on la lisait comme le grand total — et
    // 13 294 francs face à plus de 100 000 encaissés faisait croire à une erreur. Elle dit
    // maintenant ce qu'elle compte.
    kpi({ i: 3, label: 'Produit Assurex', valeur: totalRecuNet + totalOzRefacturable, prefixe: 'CHF ', sous: 'encaissé directement + part encaissée par OZ pour Assurex — même total que la vue interne' }),
    kpi({ i: 4, label: 'Acquisition · Gestion', valeur: totalAcquisition + totalGestion, prefixe: 'CHF ', sous: `acquisition CHF ${fmtCHF(Math.round(totalAcquisition))} · gestion CHF ${fmtCHF(Math.round(totalGestion))}` }),
    // Le vrai grand total, qui manquait : tout ce qui a été encaissé, par les deux entités. Seulement
    // l'encaissé : additionner du reçu et de l'attendu donnerait un chiffre qui ne correspond à rien.
    // L'attendu est rappelé à côté, à part.
    (() => {
      const encOz = baseTous.filter(c => c.statut === 'versé_oz').reduce((s, c) => s + montantC(c), 0);
      const totalGeneral = totalRecuNet + encOz;
      return kpi({ i: 5, label: 'Total encaissé, toutes entités', valeur: totalGeneral, prefixe: 'CHF ',
        sous: `Assurex CHF ${fmtCHF(Math.round(totalRecuNet))} · OZ CHF ${fmtCHF(Math.round(encOz))} · en attente CHF ${fmtCHF(Math.round(totalAttente))}` });
    })(),
  ].join('');

  // Onglets de statut avec compteurs (mêmes autres filtres)
  const nb = f => baseTous.filter(f).length;
  const onglets = [
    ['en_attente', 'En attente', nb(c => c.statut === 'en_attente')],
    ['en_attente_naissance', '🍼 Naissance', nb(c => c.statut === 'en_attente_naissance')],
    ['reçue', 'Reçues', nb(c => c.statut === 'reçue')],
    ['extourné', 'Extournées', nb(c => c.statut === 'extourné')],
    ['versé_oz', 'Versé OZ', nb(c => c.statut === 'versé_oz')],
    ['versé_oz_a_refacturer', 'OZ à refacturer', nb(tcARefacturer)],
    ['annulée', 'Annulées', nb(estAnnulee)],
    ['', 'Toutes', baseStats.length],
  ].filter(([v, , n]) => n > 0 || v === '' || v === statutFilter);
  const zoneOnglets = document.getElementById('tc-onglets');
  if (zoneOnglets) zoneOnglets.innerHTML = onglets.map(([v, l, n]) => `<button type="button" role="tab" aria-selected="${statutFilter === v}" class="${statutFilter === v ? 'actif' : ''}" onclick="tcChoisirStatut('${v}')">${l}<small>${n}</small></button>`).join('');

  // Répartition par entité
  const totE = totOzC.montant + totAssurexC.montant + totAucunC.montant || 1;
  const zoneEnt = document.getElementById('tc-entites');
  if (zoneEnt) zoneEnt.innerHTML = filtered.length ? `<div class="tcx-barre" aria-hidden="true">
      <span style="width:${totOzC.montant / totE * 100}%;background:#1A56DB"></span><span style="width:${totAssurexC.montant / totE * 100}%;background:#00CFFF"></span><span style="width:${totAucunC.montant / totE * 100}%;background:#94A3B8"></span></div>
    <div class="tcx-legende">
      <span><i style="background:#1A56DB"></i>${OZ_MINI_LOGO} OZ <b>CHF ${fmtCHF(Math.round(totOzC.montant))}</b> · ${totOzC.count}</span>
      <span><i style="background:#00CFFF"></i>${COFIDEX_MINI_LOGO} Assurex / EX <b>CHF ${fmtCHF(Math.round(totAssurexC.montant))}</b> · ${totAssurexC.count}</span>
      ${totAucunC.count ? `<span><i style="background:#94A3B8"></i>Non marqués <b>CHF ${fmtCHF(Math.round(totAucunC.montant))}</b> · ${totAucunC.count}</span>` : ''}
      <span class="tcx-total">${filtered.length} ligne${filtered.length > 1 ? 's' : ''} · <b>CHF ${fmtCHF(Math.round(filtered.reduce((s, c) => s + montantC(c), 0)))}</b></span>
    </div>` : '';

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = filtered.map(c => {
    const numBord = numeroBordereauDe(c);
    const verse = totalVersementsCommission(c.id);
    const m = montantC(c);
    const cl = allClients.find(x => x.id === c.client_id);
    return `<div class="tcx-ligne" role="button" tabindex="0" onclick="showModalEditCommission('${c.id}')" onkeydown="if(event.key==='Enter')showModalEditCommission('${c.id}')">
      <span class="tcx-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(c.compagnie, 34) : ''}</span>
      <div class="tcx-corps">
        <div class="tcx-client">${c.client_id ? `<span class="tcx-lien" onclick="event.stopPropagation(); showClient('${c.client_id}')">${esc(c.client_nom || '—')}</span>` : esc(c.client_nom || '—')}${typeof getClientMiniLogos === 'function' ? getClientMiniLogos(cl) : ''}</div>
        <div class="tcx-produit">${esc(c.compagnie || '')}${c.produit ? ' · ' + esc(c.produit) : ''}${c.numero_police ? ` · <span class="tcx-police">police ${esc(c.numero_police)}</span>` : ' · <span class="tcx-manque">sans n° de police</span>'}</div>
        ${c.detail_calcul ? `<div class="tcx-detail">${esc(c.detail_calcul.split('[')[0].trim())}</div>` : `<div class="tcx-detail tcx-manque">Détail du calcul manquant — clique pour préciser</div>`}
        ${verse > 0 && c.statut === 'en_attente' ? `<div class="tcx-partiel"><span style="width:${Math.min(100, verse / (m || 1) * 100)}%"></span></div><div class="tcx-detail" style="color:var(--c-succes-texte)">Reçu CHF ${fmtCHF(verse)} sur ${fmtCHF(m)} (versements partiels)</div>` : ''}
      </div>
      <div class="tcx-dates">${tcDatesHtml(c)}${typeof htmlCommissionPrevue === 'function' ? htmlCommissionPrevue(c) : ''}${numBord ? `<span class="tcx-bord">${esc(numBord)}</span>` : ''}</div>
      <div class="tcx-droite">
        <b class="tcx-montant ${m < 0 ? 'negatif' : ''}">CHF ${fmtCHF(m)}</b>
        <span class="tcx-badges">${badge(statutCommissionLabel(c.statut), statutCommissionColor(c.statut))}${badgeNatureCommission(c.nature)}</span>
      </div>
    </div>`;
  }).join('');

  document.getElementById('tc-table').innerHTML = `<section class="dbx-carte tcx-liste">${rows || '<div class="dbx-vide-petit">Aucune commission ne correspond à ces filtres.</div>'}</section>`;
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
      <h2 style="margin:0 0 18px;font-size:18px;font-weight: 600;color:var(--text)">Agenda</h2>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:40px;text-align:center">
        <div style="font-size:36px;margin-bottom:12px">📅</div>
        <div style="font-size:14px;font-weight: 600;color:var(--text);margin-bottom:8px">Agenda Outlook non connecté</div>
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
      <h2 style="margin:0 0 18px;font-size:18px;font-weight: 600;color:var(--text)">Agenda</h2>
      <div class="loader">Chargement des événements Outlook...</div>`;
  }

  const toggle = `<div class="tabs">
    <button class="tab-btn ${vueModeAgenda === 'liste' ? 'active' : ''}" onclick="changerVueAgenda('liste')">📃 Liste</button>
    <button class="tab-btn ${vueModeAgenda === 'semaine' ? 'active' : ''}" onclick="changerVueAgenda('semaine')">📊 Semaine</button>
  </div>`;

  const corps = vueModeAgenda === 'semaine' ? renderAgendaSemaine() : renderAgendaListe();

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
      <h2 style="margin:0;font-size:18px;font-weight: 600;color:var(--text)">Agenda — ${currentUser.email}</h2>
      <div style="display:flex;gap:10px;align-items:center">${toggle}<button class="btn-secondary" onclick="refreshAgenda()">↻ Actualiser</button></div>
    </div>
    ${corps}`;
}

function renderAgendaListe() {
  const grouped = {};
  calendarEvents.forEach(ev => {
    const d = dateEvenementGraph(ev.start.dateTime).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(ev);
  });

  const days = Object.keys(grouped).map(day => {
    const events = grouped[day].map(ev => {
      const start = dateEvenementGraph(ev.start.dateTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
      const end = dateEvenementGraph(ev.end.dateTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
      return `<div style="display:flex;gap:14px;padding:11px 18px;border-bottom:1px solid var(--border)">
        <div style="font-size:12px;color:var(--accent);font-weight: 600;min-width:90px">${start} - ${end}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight: 600;color:var(--text)">${ev.subject || 'Sans titre'}</div>
          ${ev.location && ev.location.displayName ? `<div style="font-size:11px;color:var(--text-muted)">${ev.location.displayName}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight: 500;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${day}</div>
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

// Répartit en colonnes les rendez-vous qui se chevauchent (24.09.2026).
// Avant, toutes les barres d'une journée étaient posées « left:2px; right:2px » : deux rendez-vous
// à la même heure se recouvraient exactement et le second masquait le premier. On forme des
// grappes de rendez-vous qui se chevauchent, puis, dans chaque grappe, chacun prend la première
// colonne libre — même principe qu'Outlook. Une journée chargée s'étale donc en largeur au lieu
// d'empiler des barres invisibles.
function agendaRepartirColonnes(barres) {
  const tri = [...barres].sort((a, b) => a.debut - b.debut || b.fin - a.fin);
  const sortie = [];
  let grappe = [], finGrappe = -Infinity;
  const clore = () => {
    const finsParColonne = [];
    grappe.forEach(b => {
      let c = finsParColonne.findIndex(fin => fin <= b.debut);
      if (c === -1) { finsParColonne.push(b.fin); c = finsParColonne.length - 1; }
      else finsParColonne[c] = b.fin;
      b.col = c;
    });
    grappe.forEach(b => { b.nbCols = finsParColonne.length; sortie.push(b); });
    grappe = []; finGrappe = -Infinity;
  };
  tri.forEach(b => {
    if (grappe.length && b.debut >= finGrappe) clore();
    grappe.push(b);
    finGrappe = Math.max(finGrappe, b.fin);
  });
  if (grappe.length) clore();
  return sortie;
}

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
    <div style="font-size:12.5px;color:var(--text-muted);font-weight: 600;margin-left:6px">${lundi.toLocaleDateString('fr-CH',{day:'numeric',month:'long'})} — ${jours[6].toLocaleDateString('fr-CH',{day:'numeric',month:'long',year:'numeric'})}</div>
  </div>`;

  const colonnes = jours.map((jour, idx) => {
    const evsJour = eventsForDay(jour);
    const journeeEntiere = evsJour.filter(ev => ev.isAllDay);
    const horaires = evsJour.filter(ev => !ev.isAllDay);
    const estAujourdhui = isSameDay(jour, aujourdhui);

    // Plus de deux évènements sur la journée entière écrasaient la grille horaire sous les badges.
    // On en montre deux, le reste est résumé et lisible au survol.
    const badge = (texte, titre) => `<div style="background:var(--accent-dim);color:var(--accent);font-size:10px;font-weight: 500;border-radius:5px;padding:2px 6px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${qa(titre || texte)}">${texte}</div>`;
    const badgesJournee = journeeEntiere.slice(0, 2).map(ev => badge(ev.subject || 'Sans titre')).join('')
      + (journeeEntiere.length > 2
        ? badge(`+${journeeEntiere.length - 2} autre${journeeEntiere.length - 2 > 1 ? 's' : ''}`,
            journeeEntiere.slice(2).map(e => e.subject || 'Sans titre').join(' · '))
        : '');

    const barres = agendaRepartirColonnes(horaires.map((ev, i) => {
      const start = dateEvenementGraph(ev.start.dateTime);
      const end = dateEvenementGraph(ev.end.dateTime);
      const debut = Math.min(Math.max(start.getHours() + start.getMinutes() / 60, AGENDA_HEURE_DEBUT), AGENDA_HEURE_FIN);
      let fin = Math.min(Math.max(end.getHours() + end.getMinutes() / 60, AGENDA_HEURE_DEBUT), AGENDA_HEURE_FIN);
      if (fin <= debut) fin = Math.min(debut + 0.5, AGENDA_HEURE_FIN);
      return { ev, debut, fin, couleur: AGENDA_COULEURS[i % AGENDA_COULEURS.length], start, end };
    }));

    const batons = barres.map(b => {
      const top = ((b.debut - AGENDA_HEURE_DEBUT) / plageH) * 100;
      const hauteur = ((b.fin - b.debut) / plageH) * 100;
      const largeur = 100 / b.nbCols;
      const hDeb = b.start.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
      const hFin = b.end.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
      // À trois colonnes ou plus, la place manque pour l'heure ET le titre : le titre seul reste,
      // l'heure est dans l'infobulle. Au-delà, mieux vaut un libellé lisible qu'un détail illisible.
      const serre = b.nbCols >= 3;
      return `<div title="${qa(b.ev.subject || 'Sans titre')} (${hDeb}–${hFin})" style="position:absolute;left:calc(${b.col * largeur}% + 2px);width:calc(${largeur}% - 4px);top:${top}%;height:${Math.max(hauteur, 3)}%;background:${b.couleur};border-radius:5px;padding:3px 5px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.25)">
        ${serre ? '' : `<div style="font-size:9.5px;font-weight: 500;color:#0b1220;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${hDeb}</div>`}
        <div style="font-size:${serre ? '9' : '10'}px;font-weight: 500;color:#0b1220;line-height:1.25;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:${serre ? 3 : 2};-webkit-box-orient:vertical">${b.ev.subject || 'Sans titre'}</div>
      </div>`;
    }).join('');

    return `<div style="flex:1;min-width:110px;display:flex;flex-direction:column">
      <div style="text-align:center;padding:6px 4px;border-bottom:2px solid ${estAujourdhui ? 'var(--accent)' : 'var(--border)'};margin-bottom:4px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;font-weight: 600;letter-spacing:0.5px">${jour.toLocaleDateString('fr-CH',{weekday:'short'})}</div>
        <div style="font-size:15px;font-weight: 600;color:${estAujourdhui ? 'var(--accent)' : 'var(--text)'}">${jour.getDate()}</div>
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
      ${heures.map(h => `<div style="position:absolute;left:0;top:${((h - AGENDA_HEURE_DEBUT) / plageH) * 100}%;transform:translateY(-50%);font-size:9.5px;color:var(--text-muted);font-weight: 600">${h}h</div>`).join('')}
    </div>
  </div>`;

  // Sur écran étroit, sept colonnes de 110 px débordaient sans qu'on puisse atteindre la fin de
  // semaine. Le défilement horizontal est explicite, et la largeur minimale garde des colonnes
  // lisibles au lieu de les écraser.
  return `${nav}<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
    <div style="display:flex;gap:6px;height:560px;min-width:760px">${axeHeures}${colonnes}</div>
  </div>`;
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

Avec le 3e pilier (pilier 3a), vous pouvez non seulement préparer votre retraite, mais aussi réduire votre charge fiscale de manière significative cette année — le plafond légal 2026 est de CHF 7'258.- pour les salariés affiliés à une caisse de pension.

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

// Palette cyclique pour les campagnes personnalisées (pas de sélecteur de couleur — on garde la
// création simple, une couleur cohérente est assignée automatiquement selon le rang de création).
const PALETTE_CAMPAGNES_PERSONNALISEES = ['#a78bfa', '#f472b6', '#fb923c', '#22d3ee', '#facc15', '#4ade80'];

// Uniformise une ligne de la table `campagnes_personnalisees` (Supabase) au même format que les
// entrées statiques de CAMPAGNES_THEMES, pour que tout le reste du module (ciblage, aperçu, export
// CSV, mailto…) puisse traiter indifféremment campagnes prédéfinies et campagnes créées à la volée.
function normaliserCampagnePersonnalisee(row) {
  return {
    ...row,
    periode: 'Campagne personnalisée',
    filtre: () => true,
    personnalisee: true,
    color: row.color || PALETTE_CAMPAGNES_PERSONNALISEES[allCampagnesPersonnalisees.length % PALETTE_CAMPAGNES_PERSONNALISEES.length],
    icon: row.icon || '📣',
  };
}

// Recherche une campagne par id, qu'elle soit prédéfinie (CAMPAGNES_THEMES) ou personnalisée
// (allCampagnesPersonnalisees) — point d'entrée unique utilisé partout dans ce module à la place
// d'un CAMPAGNES_THEMES.find(...) direct qui ignorerait les campagnes créées par Jonathan.
function trouverCampagne(themeId) {
  return CAMPAGNES_THEMES.find(x => x.id === themeId) || allCampagnesPersonnalisees.find(x => x.id === themeId);
}

// Ouvre le formulaire de création d'une campagne personnalisée — mêmes garde-fous que le reste du
// module (jamais d'envoi automatique) : ça crée seulement l'entrée, le ciblage/texte/envoi se
// paramètrent ensuite exactement comme pour les 3 campagnes prédéfinies.
function ouvrirNouvelleCampagnePersonnalisee() {
  const icones = ['📣', '🎯', '💬', '🎁', '⭐', '🔔', '💼', '🏠', '🚗', '📅'];
  creerModale('modal-nouvelle-campagne', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:560px;width:100%;max-height:90vh;overflow:auto">
      <div style="font-size:16px;font-weight: 600;color:var(--text);margin-bottom:4px">📣 Nouvelle campagne personnalisée</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:16px">Une fois créée, tu retrouveras cette campagne dans la liste avec le même ciblage, aperçu et export que les campagnes existantes.</div>
      <div class="form-field" style="margin-bottom:10px"><label class="form-label">Titre</label><input class="form-input" id="ncp-titre" placeholder="Ex. Relance clients véhicule sans casco"/></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="form-field"><label class="form-label">Segment</label>
          <select class="form-select" id="ncp-segment">
            <option value="Tous">Tous les clients</option>
            <option value="Privé">Privés uniquement</option>
            <option value="Entreprise">Entreprises uniquement</option>
          </select>
        </div>
        <div class="form-field"><label class="form-label">Icône</label>
          <select class="form-select" id="ncp-icon">${icones.map(i => `<option value="${i}">${i}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-field" style="margin-bottom:10px"><label class="form-label">Objet</label><input class="form-input" id="ncp-sujet" placeholder="Objet du message"/></div>
      <div class="form-field" style="margin-bottom:8px"><label class="form-label">Corps</label><textarea class="form-input" id="ncp-corps" style="min-height:180px;font-family:inherit;resize:vertical" placeholder="Bonjour {prenom}, ..."></textarea></div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:14px">Variables disponibles : {prenom} (prénom du client), {lien_rdv} (lien de réservation de RDV en autonomie). Le ciblage précis (filtres, retraits manuels) se règle ensuite sur l'écran de la campagne.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn-secondary" onclick="document.getElementById('modal-nouvelle-campagne').remove()">Annuler</button>
        <button class="btn-save" onclick="creerCampagnePersonnalisee()">✓ Créer la campagne</button>
      </div>
    </div>`, { padding: '16px' });
}

async function creerCampagnePersonnalisee() {
  const titre = document.getElementById('ncp-titre').value.trim();
  if (!titre) { showError('Le titre est obligatoire.'); return; }
  const body = {
    titre,
    segment: document.getElementById('ncp-segment').value,
    icon: document.getElementById('ncp-icon').value,
    sujet: document.getElementById('ncp-sujet').value.trim() || `Un mot de la part d'OZ Assure`,
    corps: document.getElementById('ncp-corps').value.trim() || `Bonjour {prenom},\n\n\n\nBien cordialement,\nJonathan Özkan\nAssurex Sàrl`,
    cree_par: currentUser ? `${currentUser.prenom} ${currentUser.nom}`.trim() : null,
  };
  const btn = document.querySelector('#modal-nouvelle-campagne .btn-save');
  if (btn) { btn.textContent = 'Création...'; btn.disabled = true; }
  const r = await dbPost('campagnes_personnalisees', body);
  if (!r || r.error || !r[0]) {
    showError('Erreur lors de la création de la campagne : ' + errMsg(r));
    if (btn) { btn.textContent = '✓ Créer la campagne'; btn.disabled = false; }
    return;
  }
  allCampagnesPersonnalisees.push(normaliserCampagnePersonnalisee(r[0]));
  document.getElementById('modal-nouvelle-campagne')?.remove();
  navigate('campagnes');
}

// Suppression d'une campagne personnalisée (jamais possible pour les 3 campagnes prédéfinies —
// bouton simplement absent pour elles, cf. showCampagne). Nettoie aussi les réglages de ciblage en
// mémoire pour cette campagne pour ne pas laisser d'état orphelin.
// (retiré le 22.09.2026) supprimerCampagnePersonnalisee : doublon mort — la version active est dans js/32, chargée après celle-ci, donc seule exécutée.

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

// Filtre année sélectionné pour le tableau "Gestion & acquisition par client" de l'onglet
// OZ Assure (null = par défaut la dernière année complète disponible) — en mémoire uniquement.
let ozAnneeGestionClient = null;
// (retiré le 22.09.2026) changerAnneeOzGestionClient : doublon mort — la version active est dans js/38, chargée après celle-ci, donc seule exécutée.

// Classe un libellé de mouvement (commissions_oz.type_mouvement, texte libre et peu homogène
// dans la source historique) en Acquisition / Gestion / Autre — sert à distinguer le
// commissionnement ponctuel (signature) du commissionnement récurrent (gestion du portefeuille),
// utile notamment pour chiffrer la contribution de gestion apportée à la fusion Assurex/Cofidex.
function classerTypeMouvementOz(t) {
  const s = (t || '').toLowerCase();
  if (s.includes('acquisition')) return 'Acquisition';
  if (s.includes('gestion')) return 'Gestion';
  return 'Autre';
}

// Export CSV du tableau "Gestion & acquisition par client" tel qu'affiché à l'écran (dépend du
// filtre année en cours) — mis en cache par viewOzAssure() juste avant son rendu, sur le même
// principe que window._contactsCompagnies.
function exporterOzGestionClientCsv() {
  const rows = window._ozGestionClientRows || [];
  if (!rows.length) { showError('Aucune donnée à exporter pour cette période.'); return; }
  const label = window._ozGestionAnneeLabel || 'Toutes années';
  const entetes = ['Client', 'Gestion (CHF)', 'Acquisition (CHF)', 'Autre (CHF)', 'Total (CHF)'];
  const echapper = (v) => {
    const s = String(v == null ? '' : v).replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  };
  const lignes = rows.map(l => [l.client, Math.round(l.ges), Math.round(l.acq), Math.round(l.autre), Math.round(l.total)].map(echapper).join(';'));
  const csv = '\uFEFF' + entetes.join(';') + '\n' + lignes.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oz-assure_gestion-acquisition_${label.replace(/[^a-z0-9]+/gi, '-')}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showError(`✓ Fichier téléchargé — ${rows.length} client(s), ${label}.`);
}


function segmentParDefautCampagne(t) {
  const s = (t.segment || '').trim().toLowerCase();
  if (s === 'entreprise') return 'entreprise';
  if (s === 'privé' || s === 'prive') return 'prive';
  return 'tous';
}

function reglagesCampagne(t) {
  if (!campagneReglages[t.id]) {
    campagneReglages[t.id] = { segment: segmentParDefautCampagne(t), sansSante: false, emailUniquement: false, cofidexUniquement: cofidexParDefautCampagne(t), sujet: null, corps: null, exclusions: [] };
  }
  if (!campagneReglages[t.id].exclusions) campagneReglages[t.id].exclusions = [];
  return campagneReglages[t.id];
}

// Coche "Clients EX (Cofidex) uniquement" par défaut pour les campagnes dont le titre mentionne
// Cofidex — évite d'avoir à y penser à chaque ouverture pour les 2 campagnes du plan Assurex x
// Cofidex, sans figer ce comportement pour les autres campagnes (case toujours modifiable ensuite).
function cofidexParDefautCampagne(t) {
  return /cofidex/i.test(t.titre || '');
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
    if (r.cofidexUniquement && !c.source_cofidex) return false;
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
  const t = trouverCampagne(themeId);
  if (!t) return;
  const r = reglagesCampagne(t);
  r.exclusions = inclus ? r.exclusions.filter(id => id !== clientId) : [...new Set([...r.exclusions, clientId])];
  showCampagne(themeId);
}

function toutSelectionnerCampagne(themeId) {
  const t = trouverCampagne(themeId);
  if (!t) return;
  reglagesCampagne(t).exclusions = [];
  showCampagne(themeId);
}

function toutDeselectionnerCampagne(themeId) {
  const t = trouverCampagne(themeId);
  if (!t) return;
  reglagesCampagne(t).exclusions = ciblesEligiblesCampagne(t).map(c => c.id);
  showCampagne(themeId);
}

// Recherche live (nom/email) dans le tableau "Clients ciblés" — filtre juste l'affichage des
// lignes déjà rendues (pas de re-render de showCampagne), pour ne pas perdre le focus du champ
// de recherche ni l'état des cases à cocher pendant la frappe.
// (retiré le 22.09.2026) filtrerClientsCiblesCampagne : doublon mort — la version active est dans js/32, chargée après celle-ci, donc seule exécutée.

// Export CSV "prêt pour publipostage" — un seul fichier téléchargé en un clic (au lieu d'ouvrir
// un mailto par client un par un). Objet et corps déjà personnalisés par client (placeholders
// {prenom}/{lien_rdv} résolus), pour servir directement de source de fusion Word/Outlook — que ce
// soit un mailing postal (colonnes Adresse/NPA/Ville) ou un envoi groupé d'emails personnalisés.
function exporterPublipostageCampagne(themeId) {
  const t = trouverCampagne(themeId);
  if (!t) return;
  const cibles = ciblesCampagne(t);
  if (!cibles.length) { showError('Aucun client ciblé à exporter.'); return; }
  const texte = texteCampagne(t);
  const entetes = ['Civilite', 'Prenom', 'Nom', 'Email', 'Adresse', 'NPA', 'Ville', 'Telephone', 'Objet', 'Corps'];
  const echapper = (v) => {
    const s = (v == null ? '' : String(v)).replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  };
  const lignes = cibles.map(c => {
    const entreprise = estEntreprise(c);
    const corpsPerso = texteCampagneAvecPlaceholders(texte.corps, c);
    return [
      entreprise ? '' : (c.civilite || ''),
      entreprise ? '' : (c.prenom || ''),
      c.nom || '',
      c.email || '',
      c.adresse || '',
      c.npa || '',
      c.ville || '',
      c.mobile || c.tel || '',
      texte.sujet || '',
      corpsPerso,
    ].map(echapper).join(';');
  });
  const csv = '\uFEFF' + entetes.join(';') + '\n' + lignes.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `publipostage_${(t.titre || t.id).toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showError(`✓ Fichier téléchargé — ${cibles.length} client${cibles.length !== 1 ? 's' : ''} prêt${cibles.length !== 1 ? 's' : ''} pour publipostage.`);
}

function texteCampagne(t) {
  const r = reglagesCampagne(t);
  return { sujet: r.sujet != null ? r.sujet : t.sujet, corps: r.corps != null ? r.corps : t.corps };
}

function texteCampagneAvecPlaceholders(txt, client) {
  return (txt || '').replace(/\{prenom\}/g, (client && client.prenom) || '').replace(/\{lien_rdv\}/g, LIEN_RESERVATION_RDV);
}

function appliquerReglageCampagne(themeId, champ, valeur) {
  const t = trouverCampagne(themeId);
  if (!t) return;
  reglagesCampagne(t)[champ] = valeur;
  showCampagne(themeId);
}

function sauverTexteCampagne(themeId, champ, valeur) {
  const t = trouverCampagne(themeId);
  if (!t) return;
  reglagesCampagne(t)[champ] = valeur;
}

function reinitialiserTexteCampagne(themeId) {
  const t = trouverCampagne(themeId);
  if (!t) return;
  const r = reglagesCampagne(t);
  r.sujet = null; r.corps = null;
  showCampagne(themeId);
}

// (retiré le 22.09.2026) viewCampagnes : doublon mort — la version active est dans js/32, chargée après celle-ci, donc seule exécutée.

// (retiré le 22.09.2026) showCampagne : doublon mort — la version active est dans js/32, chargée après celle-ci, donc seule exécutée.

// Aperçu de mail — objet + corps modifiables, personnalisé pour un client précis. Ne déclenche
// JAMAIS d'envoi automatique : uniquement copier / mailto, ou un envoi Outlook explicite derrière
// une confirmation, exactement comme pour les demandes d'offre (js/07).
function ouvrirApercuEmailCampagne(themeId, clientId) {
  const t = trouverCampagne(themeId);
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
      <div style="font-size:16px;font-weight: 600;color:var(--text);margin-bottom:4px">✉️ Aperçu — ${t.titre}</div>
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
  // 22.09.2026 (audit, point 2) : envoi via envoyerCourriel (js/143). L'adresse d'expéditeur n'est
  // plus écrite en dur ici — c'est le compte Outlook réellement connecté qui est annoncé.
  const res = await envoyerCourriel({ a: client.email, objet: sujet, texte: corps, contexte: 'campagne' });
  if (!res.ok) return;
  document.getElementById('modal-apercu-email-campagne')?.remove();
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
    <button onclick="navigate('oz-assure')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight: 500;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour OZ Assure</button>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h2 style="margin:0;font-size:18px;font-weight: 600;color:var(--text)">Recensement FINMA — Exercice ${annee}</h2>
      <button onclick="exportFinmaOzTxt()" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 16px;color:var(--text);font-size:12px;font-weight: 500;cursor:pointer">⬇ Export TXT (question par question)</button>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">Calculé automatiquement selon la structure du recensement annuel FINMA (art. 190b OS) — à transcrire sur la plateforme EHP. LAMal est exclue du périmètre, conformément au formulaire officiel.</div>

    <div style="background:color-mix(in srgb, var(--c-alerte) 8%, transparent);border:1px solid color-mix(in srgb, var(--c-alerte) 30%, transparent);border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:var(--text)">
      ⚠ La distinction client privé/commercial est déduite automatiquement du nom et du titre — vérifie chaque cas avant transmission. Les sections 2, 3.4, 4 et 5 du formulaire (déclarations, adresses, confirmations) ne sont pas calculables depuis les données du CRM — utilise l'export TXT comme aide-mémoire pour les répondre directement sur le site FINMA.
    </div>

    <div style="font-size:13px;font-weight: 600;color:var(--text);margin:18px 0 10px">3.3 — Nombre de clients gérés</div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${statCard('Clients privés', nbClientsPrive, '#38bdf8')}
      ${statCard('Clients commerciaux', nbClientsCommercial, '#f59e0b')}
    </div>

    <div style="font-size:13px;font-weight: 600;color:var(--text);margin:18px 0 10px">3.2 — Polices intermédiées (hors LAMal)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px">
        <div style="font-size:11px;font-weight: 500;color:#38bdf8;text-transform:uppercase;margin-bottom:10px">Clients privés</div>
        ${Object.entries(policesPrive).map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${CAT_LABELS[k]}</span><span style="font-weight: 600;color:var(--text)">${v}</span></div>`).join('')}
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px">
        <div style="font-size:11px;font-weight: 500;color:var(--c-alerte-texte);text-transform:uppercase;margin-bottom:10px">Clients commerciaux</div>
        ${Object.entries(policesCommercial).map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${CAT_LABELS[k]}</span><span style="font-weight: 600;color:var(--text)">${v}</span></div>`).join('')}
      </div>
    </div>

    <div style="font-size:13px;font-weight: 600;color:var(--text);margin:18px 0 10px">3.5 — Rémunérations par compagnie</div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px">
      ${Object.entries(remuneration).map(([compagnie, cats]) => `
        <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
          <div style="font-size:13px;font-weight: 600;color:var(--accent);margin-bottom:8px">${compagnie}</div>
          <table style="width:100%;font-size:11.5px;border-collapse:collapse">
            <thead><tr style="color:var(--text-muted)"><th style="text-align:left;padding:3px 6px">Catégorie</th><th style="text-align:right;padding:3px 6px">Souscription</th><th style="text-align:right;padding:3px 6px">Portefeuille</th></tr></thead>
            <tbody>${Object.entries(cats).map(([cat, v]) => `<tr><td style="padding:3px 6px;color:var(--text)">${CAT_LABELS[cat]}</td><td style="text-align:right;padding:3px 6px;color:var(--c-alerte-texte);font-weight: 600">${chf(v.acquisition)}</td><td style="text-align:right;padding:3px 6px;color:var(--c-succes-texte);font-weight: 600">${chf(v.gestion)}</td></tr>`).join('')}</tbody>
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
  // 22.09.2026 : même règle que le Cockpit et « Toutes les commissions » (tcARefacturer) — la santé
  // et les acquisitions sans apporteur restent chez OZ, elles ne sont pas « à refacturer ».
  const aRefacturer = lignes.filter(tcARefacturer);
  const totalARefacturer = aRefacturer.reduce((s,c) => s + Number(c.montant_final != null ? c.montant_final : (c.montant_estime||0)), 0);

  return `
    <button onclick="navigate('oz-assure')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight: 500;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour OZ Assure</button>
    <h2 style="margin:0 0 4px;font-size:18px;font-weight: 600;color:var(--text)">Commissions Assurex versées à OZ Assure</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Historique privé : commissions gérées dans le CRM mais réglées directement sur le compte OZ Assure (portefeuille pré-fusion, ou conventions d'assureurs pas encore basculées vers Assurex). Ces montants n'apparaissent plus dans "Toutes les commissions" ni dans les statistiques Assurex — cette page est visible uniquement par toi.</div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${statCard('Dossiers', lignes.length, '#38bdf8')}
      ${statCard('Total versé à OZ', 'CHF ' + Math.round(total).toLocaleString(), '#1a56db')}
      ${statCard('Encore à refacturer', 'CHF ' + Math.round(totalARefacturer).toLocaleString(), aRefacturer.length ? '#f59e0b' : '#4ade80')}
    </div>
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:1fr 130px 110px 130px 90px"><div>Client / Produit</div><div>Compagnie</div><div>Montant</div><div>Refacturation</div><div></div></div>
      ${lignes.map(c => `<div class="table-row" style="grid-template-columns:1fr 130px 110px 130px 90px">
        <div><div style="font-size:13px;font-weight: 600;color:var(--text)">${c.client_nom||'—'}</div><div style="font-size:11px;color:var(--text-muted)">${c.produit||''}</div></div>
        <div style="font-size:12px;color:var(--text-muted)">${c.compagnie||''}</div>
        <div style="font-weight: 600;color:#1a56db">CHF ${fmtCHF(Number(c.montant_final != null ? c.montant_final : (c.montant_estime||0)))}</div>
        <div>${c.refacture_le ? `<span style="color:var(--c-succes-texte);font-size:11.5px;font-weight: 500">✓ Faite le ${fmtDate(c.refacture_le)}</span>` : tcARefacturer(c) ? `<span style="color:var(--c-alerte-texte);font-size:11.5px;font-weight: 500">⏳ À refacturer</span>` : `<span style="color:var(--text-muted);font-size:11.5px">Reste chez OZ</span>`}</div>
        <div><button onclick="showModalEditCommission('${c.id}')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer">✏️</button></div>
      </div>`).join('') || '<div class="table-empty">Aucune commission versée à OZ Assure enregistrée.</div>'}
    </div>`;
}

// (retiré le 22.09.2026) viewOzAssure : doublon mort — la version active est dans js/38, chargée après celle-ci, donc seule exécutée.


// ═══ CONTACTS COMPAGNIES (pour demandes d'offre) ═══
async function viewContactsCompagnies() {
  const contacts = await dbGet('compagnies_contacts', 'select=*&order=compagnie.asc');
  window._contactsCompagnies = contacts || [];

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight: 600;color:var(--text)">Contacts compagnies</h2>
      <button class="btn-add" onclick="showFormContactCompagnie()">+ Ajouter une compagnie</button>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Utilisés pour générer les emails de demande d'offre depuis le formulaire "Demande d'offre". Le logo est celui affiché partout dans le CRM (contrats, bordereaux, commissions) ; à défaut de logo fourni, un monogramme aux couleurs de la compagnie est utilisé.</div>
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:44px 1fr 1fr 1fr 60px"><div></div><div>Compagnie</div><div>Contact</div><div>Email</div><div></div></div>
      ${(contacts||[]).map(c => `<div class="table-row" style="grid-template-columns:44px 1fr 1fr 1fr 60px;align-items:center">
        <div>${typeof pictoCompagnie === 'function' ? pictoCompagnie(c.compagnie, 32) : ''}</div>
        <div style="font-weight: 600;font-size:13px;color:var(--text)">${typeof normaliserCompagnie === 'function' ? normaliserCompagnie(c.compagnie) : c.compagnie}${(typeof normaliserCompagnie === 'function' && normaliserCompagnie(c.compagnie) !== c.compagnie) ? `<div style="font-size:10px;color:var(--text-dim)">saisi : ${c.compagnie}</div>` : ''}${c.convention && c.convention.valable_des ? `<div style="font-size:10px;font-weight: 500;color:var(--c-succes-texte);margin-top:2px">📄 Convention active dès ${fmtDate(c.convention.valable_des)}</div>` : ''}</div>
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
      <h3 style="margin:0 0 20px;font-size:16px;font-weight: 600;color:var(--text);display:flex;align-items:center;gap:10px">${existant && typeof pictoCompagnie === 'function' ? pictoCompagnie(existant.compagnie, 30) : ''}${existant ? 'Modifier' : 'Ajouter'} une compagnie</h3>
      <div class="form-grid">
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Nom de la compagnie *</label><input class="form-input" id="cc-nom" value="${existant ? existant.compagnie : ''}"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Libellé contact (agence/courtier)</label><input class="form-input" id="cc-libelle" value="${existant ? (existant.libelle_contact||'') : ''}"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Email</label><input class="form-input" id="cc-email" type="email" value="${existant ? (existant.email||'') : ''}"/></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);font-weight: 600;text-transform:uppercase;margin:18px 0 8px">Convention / contrat de collaboration (facultatif)</div>
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
    return `<h2 style="margin:0 0 18px;font-size:18px;font-weight: 600;color:var(--text)">Journal d'audit</h2>
      <div class="table-empty">Accès réservé au signataire.</div>`;
  }
  const logs = await dbGet('audit_log', 'select=*&order=created_at.desc&limit=200');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight: 600;color:var(--text)">Journal d'audit</h2>
      <div style="font-size:12px;color:var(--text-muted)">200 dernières actions — traçabilité nLPD</div>
    </div>
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:140px 1fr 200px 160px"><div>Date/heure</div><div>Action</div><div>Détail</div><div>Utilisateur</div></div>
      ${(logs || []).map(l => `<div class="table-row" style="grid-template-columns:140px 1fr 200px 160px">
        <div style="font-size:11px;color:var(--text-muted)">${new Date(l.created_at).toLocaleString('fr-CH', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
        <div style="font-size:12.5px;font-weight: 500;color:var(--text)">${ACTION_LABELS[l.action] || l.action}</div>
        <div style="font-size:12px;color:var(--text-muted)">${l.detail || ''}</div>
        <div style="font-size:12px;color:var(--text-muted)">${l.user_email}</div>
      </div>`).join('') || '<div class="table-empty">Aucune entrée pour le moment.</div>'}
    </div>`;
}

function viewAgents() {
  const agents = allAgents.length > 0 ? allAgents : [currentUser];
  return `
    <h2 style="margin:0 0 20px;font-size:18px;font-weight: 600;color:var(--text)">Paramètres — Agents</h2>
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
            <div style="font-size:15px;font-weight: 600;color:var(--text)">${a.prenom} ${a.nom}</div>
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
              <div style="color:var(--text-muted);font-size:10px;font-weight: 500;text-transform:uppercase;margin-bottom:4px">${l}</div>
              <div style="color:var(--text);font-size:13px;font-weight: 600">${v}</div>
            </div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2);border-radius:9px;padding:10px 14px">
            <div style="color:var(--text-muted);font-size:10px;font-weight: 500;text-transform:uppercase;margin-bottom:4px">CA géré</div>
            <div style="color:#38bdf8;font-size:14px;font-weight: 600">CHF ${fmtCHF(ca)}</div>
          </div>
          <div style="background:color-mix(in srgb, var(--c-succes) 8%, transparent);border:1px solid color-mix(in srgb, var(--c-succes) 20%, transparent);border-radius:9px;padding:10px 14px">
            <div style="color:var(--text-muted);font-size:10px;font-weight: 500;text-transform:uppercase;margin-bottom:4px">Commissions générées (via fiche de paie)</div>
            <div style="color:var(--c-succes-texte);font-size:14px;font-weight: 600">CHF ${fmtCHF(Math.round(commGeneree))}</div>
          </div>
        </div>
        ${a.email === currentUser.email ? `
        <div style="margin-top:14px;background:var(--surface-alt);border-radius:10px;padding:16px">
          <div style="font-size:12px;font-weight: 500;color:var(--text);margin-bottom:8px">✍️ Ma signature — reprise automatiquement sur les mandats de courtage</div>
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
            <div style="font-size:12px;font-weight: 500;color:var(--text)">📅 Prise de RDV en autonomie — reliée aux clients</div>
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
      <button onclick="logout()" style="background:var(--red-dim);color:var(--red);border:1px solid color-mix(in srgb, var(--c-danger) 30%, transparent);border-radius:10px;padding:10px 20px;font-size:13px;font-weight: 600;cursor:pointer">🚪 Se déconnecter</button>
    </div>`;
}

// ═══ SIGNATURE DE L'AGENT (Jonathan) — enregistrée une fois, reprise automatiquement sur les
// mandats de courtage générés (js/05, genererMandatCourtage). Réutilise le même mécanisme de
// canvas que la capture de signature client (initCanvasSignature/effacerSignature, js/05),
// avec un id de canvas distinct pour ne jamais interférer avec une signature en cours ailleurs.
function ouvrirModaleMaSignature(agentId) {
  creerModale('modal-ma-signature', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:480px;width:100%">
      <div style="font-size:16px;font-weight: 600;color:var(--text);margin-bottom:6px">✍️ Ma signature</div>
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
    <button onclick="navigate('agents')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight: 500;margin-bottom:16px;display:flex;align-items:center;gap:5px">← Retour aux agents</button>
    <h2 style="margin:0 0 18px;font-size:18px;font-weight: 600;color:var(--text)">Nouvel agent</h2>
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
