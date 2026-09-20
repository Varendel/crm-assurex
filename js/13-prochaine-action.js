// ═══ PROCHAINE ACTION OBLIGATOIRE SUR LES OPPORTUNITÉS (ajouté le 19.09.2026) ══════════════════
// Principe : une opportunité ouverte doit toujours avoir une prochaine étape datée — sinon elle
// finit par dormir dans le pipeline. La « prochaine action » est la tâche ouverte (rappels avec
// opportunite_id) la plus proche dans le temps ; aucune nouvelle table.
//
// Le CRM la demande automatiquement :
//   - quand on crée / enregistre une opportunité ouverte qui n'en a pas ;
//   - quand on change son stade (hors Gagné / Perdu) ;
//   - quand on termine sa dernière tâche ouverte (« et maintenant ? »).
// On peut répondre « Plus tard » : l'opportunité reste alors signalée en rouge partout.
// La session RH n'est jamais interrompue par cette demande.

const PA_TYPES = [
  { v: 'Appeler', icone: '📞' },
  { v: 'Envoyer l’offre', icone: '📨' },
  { v: 'Rendez-vous', icone: '📅' },
  { v: 'Relancer par e-mail', icone: '✉️' },
  { v: 'Autre', icone: '•' },
];

function paEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function paOuverte(o) {
  return o && o.stade !== 'Gagné' && o.stade !== 'Perdu';
}

// Tâche ouverte la plus proche (celles sans date passent après celles datées)
function prochaineAction(oppId) {
  return allRappels
    .filter(r => r.opportunite_id === oppId && r.statut === 'ouvert')
    .sort((a, b) => (a.date_echeance || '9999-12-31').localeCompare(b.date_echeance || '9999-12-31'))[0] || null;
}

function paJoursOuvresPlus(n) {
  const d = new Date();
  let ajoutes = 0;
  while (ajoutes < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) ajoutes++; }
  return d.toISOString().split('T')[0];
}

// Petit bloc affiché sur les cartes / lignes du pipeline
function htmlProchaineAction(o) {
  if (!paOuverte(o)) return '';
  const pa = prochaineAction(o.id);
  if (!pa) {
    return `<button type="button" onclick="event.stopPropagation();ouvrirModaleProchaineAction('${o.id}')" title="Définir la prochaine action"
      style="display:flex;align-items:center;gap:5px;width:100%;margin:2px 0 8px;background:rgba(248,113,113,0.08);border:1px dashed rgba(248,113,113,0.6);color:var(--c-danger-texte);border-radius:7px;padding:5px 8px;font-size:10.5px;font-weight:700;cursor:pointer;text-align:left">
      ⚠ Aucune prochaine action — définir</button>`;
  }
  const auj = new Date().toISOString().split('T')[0];
  const enRetard = pa.date_echeance && pa.date_echeance < auj;
  const couleur = enRetard ? '#f87171' : 'var(--text-muted)';
  return `<div title="Prochaine action" style="display:flex;align-items:center;gap:5px;margin:2px 0 8px;font-size:10.5px;color:${couleur}">
    <span style="font-weight:700">➜</span>
    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${paEsc(pa.titre)}${pa.date_echeance ? ` · ${enRetard ? 'en retard depuis le ' : ''}${fmtDate(pa.date_echeance)}` : ''}</span>
  </div>`;
}

// Bandeau en haut du Pipeline
function bandeauSansProchaineAction(OPPS, nomClient) {
  const sans = OPPS.filter(o => paOuverte(o) && !prochaineAction(o.id));
  if (!sans.length) return '';
  return `<div style="background:rgba(245,158,11,0.08);border:1.5px solid rgba(245,158,11,0.4);border-radius:12px;padding:14px 16px;margin-bottom:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
      <div style="font-size:12px;font-weight:800;color:var(--c-alerte-texte);text-transform:uppercase;letter-spacing:0.5px">➜ ${sans.length} opportunité${sans.length > 1 ? 's' : ''} sans prochaine action</div>
      <button type="button" onclick="ouvrirModaleProchaineAction('${sans[0].id}', 'enchainer')" style="background:none;border:none;color:var(--c-alerte-texte);font-size:11.5px;font-weight:700;cursor:pointer">Les traiter une par une →</button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${sans.map(o => `<button type="button" onclick="ouvrirModaleProchaineAction('${o.id}')" style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:11.5px;color:var(--text);cursor:pointer">${paEsc(o.titre)} <span style="color:var(--text-muted)">— ${paEsc(nomClient(o))}</span></button>`).join('')}
    </div>
  </div>`;
}

// Nombre d'opportunités ouvertes sans prochaine action (tableau de bord)
function nbOppsSansProchaineAction() {
  return allOpportunites.filter(o => paOuverte(o) && !prochaineAction(o.id)).length;
}

// Demande la prochaine action si l'opportunité (ouverte) n'en a pas
function verifierProchaineAction(oppId) {
  if (typeof estRoleRH === 'function' && estRoleRH()) return;
  const o = allOpportunites.find(x => x.id === oppId);
  if (!paOuverte(o) || prochaineAction(oppId)) return;
  setTimeout(() => ouvrirModaleProchaineAction(oppId, 'rappel'), 250);
}

// mode : undefined (clic direct) | 'rappel' (demandée automatiquement) | 'enchainer' (bandeau)
function ouvrirModaleProchaineAction(oppId, mode) {
  const o = allOpportunites.find(x => x.id === oppId);
  if (!o) return;
  const c = allClients.find(x => x.id === o.client_id);
  const nomClient = c ? (estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`) : (o.prospect_nom || '');
  window._paMode = mode || null;
  creerModale('modal-prochaine-action', `
    <div role="dialog" aria-labelledby="pa-titre-modale" style="background:var(--surface);border-radius:14px;padding:22px;max-width:460px;width:100%">
      <div id="pa-titre-modale" style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px">➜ Prochaine action</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">${mode === 'rappel' ? 'Cette opportunité n’a plus d’étape prévue. ' : ''}<strong style="color:var(--text)">${paEsc(o.titre)}</strong>${nomClient ? ' — ' + paEsc(nomClient) : ''} · ${paEsc(o.stade)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px" id="pa-types">
        ${PA_TYPES.map((t, i) => `<button type="button" data-type="${paEsc(t.v)}" onclick="paChoisirType(this)" class="${i === 0 ? 'btn-save' : 'btn-secondary'}" style="padding:7px 12px;font-size:12px">${t.icone} ${paEsc(t.v)}</button>`).join('')}
      </div>
      <div class="form-grid">
        <div class="form-field" style="grid-column:span 2"><label class="form-label" for="pa-titre">Action</label>
          <input class="form-input" id="pa-titre" value="${paEsc(`${PA_TYPES[0].v} — ${nomClient || o.titre}`)}"/></div>
        <div class="form-field"><label class="form-label" for="pa-date">Quand ?</label>
          <input class="form-input" id="pa-date" type="date" value="${paJoursOuvresPlus(2)}"/></div>
        <div class="form-field" style="display:flex;align-items:flex-end;gap:6px;padding-bottom:4px">
          ${[['Jour ouvré suivant', 1], ['Dans 1 sem.', 5]].map(([l, n]) => `<button type="button" class="btn-secondary" style="padding:7px 10px;font-size:11.5px" onclick="document.getElementById('pa-date').value='${paJoursOuvresPlus(n)}'">${l}</button>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button type="button" class="btn-secondary" onclick="paFermer()">Plus tard</button>
        <button type="button" class="btn-save" id="pa-btn-ok" style="margin-left:auto" onclick="enregistrerProchaineAction('${oppId}')">✓ Planifier</button>
      </div>
    </div>`, { opacite: 0.75 });
  window._paNomCible = nomClient || o.titre;
  setTimeout(() => document.getElementById('pa-titre')?.select(), 50);
}

function paChoisirType(btn) {
  document.querySelectorAll('#pa-types button').forEach(b => { b.className = b === btn ? 'btn-save' : 'btn-secondary'; });
  const champ = document.getElementById('pa-titre');
  if (champ) champ.value = `${btn.dataset.type} — ${window._paNomCible || ''}`;
}

function paFermer() {
  document.getElementById('modal-prochaine-action')?.remove();
  if (typeof currentView !== 'undefined' && currentView === 'opportunites') navigate('opportunites');
}

async function enregistrerProchaineAction(oppId) {
  const o = allOpportunites.find(x => x.id === oppId);
  if (!o) return;
  const titre = (document.getElementById('pa-titre')?.value || '').trim();
  const date = document.getElementById('pa-date')?.value || null;
  if (!titre) { showError('Décris l’action en quelques mots.'); return; }
  const btn = document.getElementById('pa-btn-ok');
  if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Enregistrement...'; }
  const monAgent = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
  const joursAvant = date ? Math.round((new Date(date) - new Date(new Date().toISOString().split('T')[0])) / 86400000) : null;
  const body = {
    titre,
    nature: 'tache',
    type: 'Opportunité',
    client_id: o.client_id || null,
    opportunite_id: oppId,
    apporteur_id: o.apporteur_id || (monAgent ? monAgent.id : null),
    date_echeance: date,
    urgence: joursAvant !== null && joursAvant <= 1 ? 'haute' : 'moyenne',
    statut: 'ouvert',
  };
  const r = await dbPost('rappels', body);
  if (r && r.error) {
    showError('Action non enregistrée : ' + errMsg(r));
    if (btn) { btn.disabled = false; btn.textContent = '✓ Planifier'; }
    return;
  }
  // Agenda Outlook, comme les autres tâches datées du CRM (échec silencieux : la tâche reste créée)
  if (r && r[0] && r[0].id && date && typeof createOutlookEventFromRappel === 'function') {
    try {
      const eventId = await createOutlookEventFromRappel(r[0]);
      if (eventId) await dbPatch('rappels', r[0].id, { outlook_event_id: eventId });
    } catch (e) { /* voir « Tâches & Rappels » pour resynchroniser */ }
  }
  // Trace dans l'historique de l'opportunité
  const auteur = currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : '';
  const historique = [...(Array.isArray(o.historique) ? o.historique : []),
    { texte: `➜ Prochaine action : ${titre}${date ? ' (' + fmtDate(date) + ')' : ''}`, date: new Date().toISOString(), auteur }];
  const rh = await dbPatch('opportunites', oppId, { historique });
  if (!(rh && rh.error)) o.historique = historique;

  allRappels = await dbGet('rappels', 'select=*');
  document.getElementById('modal-prochaine-action')?.remove();
  showError(`✓ Prochaine action planifiée${date ? ' pour le ' + fmtDate(date) : ''}.`);

  // Mode « une par une » depuis le bandeau : on enchaîne sur la suivante
  if (window._paMode === 'enchainer') {
    const suivante = allOpportunites.find(x => paOuverte(x) && !prochaineAction(x.id));
    if (suivante) { ouvrirModaleProchaineAction(suivante.id, 'enchainer'); return; }
  }
  if (typeof currentView !== 'undefined' && (currentView === 'opportunites' || currentView === 'dashboard' || currentView === 'suivi')) navigate(currentView);
  if (typeof currentView !== 'undefined' && currentView === 'nouvelle-opportunite' && typeof opRafraichir === 'function') opRafraichir();
}
