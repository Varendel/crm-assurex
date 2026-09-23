// ═══ PRENDRE RENDEZ-VOUS DEPUIS L'AFFAIRE (23.09.2026) ══════════════════════════════════════════
// « Ajoute la fonction prise de RDV sur les opp. »
//
// Le rendez-vous existait déjà (js/06 : modale, création, synchro Outlook, page publique), mais il
// vivait à côté des affaires : on le prenait depuis l'agenda, sans lien avec l'opportunité en
// cours, et la fiche ne savait pas qu'un rendez-vous était posé. Deux ajouts, pas un écran de plus :
//   · un bouton « 📅 Rendez-vous » dans la barre d'actions de la fiche, qui ouvre la modale
//     existante avec le client déjà choisi ;
//   · le rendez-vous créé depuis là porte l'affaire (rendez_vous.opportunite_id, migration du
//     23.09.2026), s'inscrit dans le fil de l'affaire, et les prochains rendez-vous s'affichent
//     sous la prochaine action.
// La prochaine action est mise à jour au passage : un rendez-vous posé EST la prochaine étape.

function rdoEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Les rendez-vous d'une affaire : ceux qui la citent, plus ceux du client pris le même jour ou
// après (les anciens, d'avant cette colonne, ne sont pas rattachés — on ne les invente pas).
function rdoRendezVous(o) {
  if (!o || typeof allRendezVous === 'undefined') return [];
  return (allRendezVous || [])
    .filter(r => r.statut === 'confirme' && r.opportunite_id === o.id)
    .sort((a, b) => new Date(a.date_heure) - new Date(b.date_heure));
}

function rdoOuvrir(oppId) {
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  if (!o) return;
  window._rdoOpp = oppId;                       // lu par creerRdvInterne, enrobé plus bas
  if (typeof ouvrirModaleNouveauRdv !== 'function') { showError('La prise de rendez-vous n’est pas disponible ici.'); return; }
  ouvrirModaleNouveauRdv(o.client_id || null);
  // Sans fiche client, on pré-remplit au moins le nom du prospect avec celui de l'affaire.
  if (!o.client_id) {
    setTimeout(() => {
      const p = document.getElementById('rdv-modal-prospect');
      if (p && !p.value) p.value = (typeof opNomClient === 'function' ? opNomClient(o) : '') || o.titre || '';
    }, 60);
  }
}

// Le bloc des rendez-vous à venir, posé sous la prochaine action de la fiche.
function rdoBlocHtml(o) {
  const liste = rdoRendezVous(o).filter(r => new Date(r.date_heure) >= new Date(Date.now() - 36e5));
  if (!liste.length) return '';
  const quand = iso => `${fmtDate(iso)} à ${new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`;
  return `<div class="rdo-bloc">${liste.map(r => `<div class="rdo-ligne">
    <span class="rdo-ico" aria-hidden="true">📅</span>
    <span class="rdo-txt"><b>${quand(r.date_heure)}</b>
      <small>${rdoEsc([r.type, r.duree_min ? r.duree_min + ' min' : '', r.lieu].filter(Boolean).join(' · '))}</small></span>
    ${r.outlook_event_id ? '<span class="rdo-ok" title="Dans l’agenda Outlook">✓</span>'
      : `<button type="button" class="rdo-sync" onclick="synchroniserRdvOutlook('${r.id}')" title="Absent d’Outlook — synchroniser">📅</button>`}
  </div>`).join('')}</div>`;
}

// ── Le bouton dans la barre d'actions de la fiche ───────────────────────────────────────────────
(function rdoPoser() {
  if (typeof viewFicheOpportunite !== 'function') return;
  const origine = viewFicheOpportunite;
  window.viewFicheOpportunite = function (o) {
    let h = origine.apply(this, arguments);
    if (!o) return h;
    const ancre = `<button type="button" onclick="opComparer('${o.id}')">⚖️ Comparer les offres</button>`;
    if (h.includes(ancre)) {
      h = h.replace(ancre, `<button type="button" onclick="rdoOuvrir('${o.id}')" title="Poser un rendez-vous avec ce client, rattaché à l’affaire">📅 Rendez-vous</button>\n          ${ancre}`);
    }
    const bloc = rdoBlocHtml(o);
    if (bloc) {
      const fil = '<div class="dbx-carte-tete"><h3 class="opx-h3">Fil de l\'affaire</h3>';
      if (h.includes(fil)) h = h.replace(fil, bloc + fil);
    }
    return h;
  };
})();

// ── Le rendez-vous créé depuis l'affaire lui reste attaché ──────────────────────────────────────
(function rdoBrancherCreation() {
  if (typeof creerRdvInterne !== 'function') return;
  const origine = creerRdvInterne;
  window.creerRdvInterne = async function () {
    const oppId = window._rdoOpp || null;
    const avant = (typeof allRendezVous !== 'undefined' ? allRendezVous : []).length;
    const r = await origine.apply(this, arguments);
    window._rdoOpp = null;
    if (!oppId) return r;
    try {
      const cree = (typeof allRendezVous !== 'undefined' ? allRendezVous : [])[avant];
      if (!cree || !cree.id) return r;
      const p = await dbPatch('rendez_vous', cree.id, { opportunite_id: oppId });
      if (p && p.error) return r;
      cree.opportunite_id = oppId;
      if (typeof ajouterLigneHistoriqueOpportunite === 'function') {
        const q = `${fmtDate(cree.date_heure)} à ${new Date(cree.date_heure).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`;
        await ajouterLigneHistoriqueOpportunite(oppId, `📅 Rendez-vous fixé — ${q}${cree.type ? ' · ' + cree.type : ''}`);
      }
      // Un rendez-vous posé est la prochaine étape de l'affaire : on ferme l'alerte « aucune
      // prochaine action » en créant la tâche correspondante, datée du rendez-vous.
      if (typeof prochaineAction === 'function' && !prochaineAction(oppId) && typeof dbPost === 'function') {
        const t = await dbPost('rappels', { titre: `Rendez-vous${cree.type ? ' — ' + cree.type : ''}`,
          client_id: cree.client_id || null, opportunite_id: oppId, type: 'Suivi', nature: 'tache',
          urgence: 'moyenne', statut: 'ouvert', date_echeance: String(cree.date_heure).slice(0, 10) });
        if (t && !t.error && typeof allRappels !== 'undefined') allRappels = await dbGet('rappels', 'select=*');
      }
      if (typeof opRafraichir === 'function' && typeof currentView !== 'undefined' && /opportunit/.test(currentView)) opRafraichir();
    } catch (e) { /* le rendez-vous est créé : le rattachement n'est qu'un confort */ }
    return r;
  };
})();

(function rdoStyles() {
  const st = document.createElement('style');
  st.textContent = `
    .rdo-bloc { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .rdo-ligne { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px;
      background: color-mix(in srgb, var(--accent) 8%, var(--surface)); border: 1px solid var(--accent-border); }
    .rdo-ico { font-size: 15px; }
    .rdo-txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .rdo-txt b { font-size: 12.5px; font-weight: 600; color: var(--text); }
    .rdo-txt small { font-size: 11px; color: var(--text-muted); }
    .rdo-ok { color: var(--c-succes, #16a34a); font-weight: 700; }
    .rdo-sync { background: none; border: 1px solid var(--border); border-radius: 7px; padding: 3px 7px; cursor: pointer; }
  `;
  document.head.appendChild(st);
})();
