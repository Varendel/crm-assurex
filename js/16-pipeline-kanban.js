// ═══ PIPELINE : GLISSER-DÉPOSER + OFFRES MULTI-COMPAGNIES (ajouté le 19.09.2026) ═══════════════
// 1. Glisser-déposer : une carte du Kanban se glisse vers un autre stade, ou vers les zones
//    « Gagné » / « Perdu » qui apparaissent pendant le déplacement. Le changement passe par
//    changerStadeOpportunite() : Gagné → création du contrat, Perdu → motif demandé, autre stade →
//    prochaine action demandée (js/13). Sur téléphone (pas de glisser-déposer), le menu de stade
//    de chaque carte reste disponible.
// 2. Offres : chaque carte affiche les compagnies sollicitées via les demandes d'offre liées
//    (demandes_offre.compagnies_envoi), avec leur statut. Un clic sur un logo fait passer l'offre
//    au statut suivant : envoyée → reçue → retenue → non retenue → envoyée.
// La session RH n'a ni glisser-déposer ni changement de statut (lecture seule, comme avant).

const OFFRE_STATUTS = {
  'envoyée':     { label: 'demandée, en attente', symbole: '…', couleur: '#F59E0B', suivant: 'reçue' },
  'reçue':       { label: 'offre reçue',          symbole: '✓', couleur: '#1F9D6B', suivant: 'retenue' },
  'retenue':     { label: 'offre retenue',        symbole: '★', couleur: '#113679', suivant: 'non_retenue' },
  'non_retenue': { label: 'non retenue',          symbole: '✕', couleur: '#B42318', suivant: 'envoyée' },
  // 22.09.2026 : « déclinée » est posé par la fiche opportunité (js/25) ; faute d'entrée ici, une
  // compagnie qui avait décliné s'affichait « en attente » sur le kanban.
  'déclinée':    { label: 'la compagnie décline', symbole: '⊘', couleur: '#6B7280', suivant: 'envoyée' },
};

let _pipelineDemandes = null;     // demandes d'offre liées à une opportunité (chargées à la demande)
let _pipelineRhMode = false;

function _offreStatut(s) { return OFFRE_STATUTS[s] ? s : (s === 'recue' ? 'reçue' : 'envoyée'); }
// 22.09.2026 : le statut affiché suit le même modèle que la fiche (js/25 opStatutOffre) —
// le drapeau « retenue » prime, et une date de réception sans statut vaut « reçue ».
function _offreStatutEntree(e) {
  if (e.retenue) return 'retenue';
  if (!OFFRE_STATUTS[e.statut] && e.statut !== 'recue' && (e.recue_le || e.recu_le)) return 'reçue';
  return _offreStatut(e.statut);
}

async function activerKanbanPipeline(rhMode) {
  _pipelineRhMode = !!rhMode;
  if (!rhMode) brancherGlisserDeposerPipeline();
  if (_pipelineDemandes) remplirOffresPipeline(); // affichage immédiat depuis le dernier chargement
  const d = await dbGet('demandes_offre', 'select=id,opportunite_id,compagnies_envoi&opportunite_id=not.is.null');
  _pipelineDemandes = Array.isArray(d) ? d : [];
  remplirOffresPipeline();
}

// ── Offres multi-compagnies ──────────────────────────────────────────────────────────────────
function _offresDeLOpportunite(oppId) {
  const lignes = [];
  (_pipelineDemandes || []).filter(d => d.opportunite_id === oppId).forEach(d => {
    (Array.isArray(d.compagnies_envoi) ? d.compagnies_envoi : []).forEach((e, index) => {
      // 22.09.2026 : la prime annuelle suit l'offre jusqu'au pipeline — « mets le tarif annuel sur
      // les offres du pipeline en ligne si connu ».
      if (e && e.compagnie) lignes.push({ demandeId: d.id, index, compagnie: e.compagnie, statut: _offreStatutEntree(e), prime: Number(e.prime) > 0 ? Number(e.prime) : null });
    });
  });
  return lignes;
}

function remplirOffresPipeline() {
  document.querySelectorAll('.opp-offres[data-opp]').forEach(zone => {
    const offres = _offresDeLOpportunite(zone.dataset.opp);
    if (!offres.length) return; // garde l'affichage simple (compagnie de l'opportunité)
    const recues = offres.filter(o => o.statut === 'reçue' || o.statut === 'retenue').length;
    const retenue = offres.find(o => o.statut === 'retenue');
    const resume = retenue ? `${normaliserCompagnie(retenue.compagnie)} retenue` : `${recues}/${offres.length} reçue${recues > 1 ? 's' : ''}`;
    const couleurResume = retenue ? 'var(--accent)' : offres.every(o => o.statut !== 'envoyée') ? '#1F9D6B' : '#F59E0B';
    zone.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;padding:7px 8px;margin-bottom:8px;border-radius:8px;background:var(--surface-alt);border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--text-muted)"><span>Offres demandées</span><strong style="color:${couleurResume};font-weight:600">${resume}</strong></div>
      <div style="display:flex;flex-wrap:wrap;gap:${offres.length > 3 ? 4 : 7}px">
        ${(() => {
          // Le tarif annuel s'affiche à côté du logo quand il est connu. Plus il y a d'offres, plus
          // la pastille est compacte, pour que la ligne tienne dans la carte sans la déformer.
          const n = offres.length;
          const taille = n > 4 ? 15 : n > 3 ? 17 : n > 2 ? 19 : 22;
          const police = n > 4 ? 8.5 : n > 2 ? 9.5 : 10.5;
          const court = v => n > 3 && v >= 1000 ? Math.round(v / 100) / 10 + 'k' : fmtCHF(Math.round(v));
          return offres.map(o => {
            const st = OFFRE_STATUTS[o.statut];
            const nom = normaliserCompagnie(o.compagnie);
            const titre = `${nom} — ${st.label}${o.prime ? ` · CHF ${fmtCHF(o.prime)}/an` : ''}${_pipelineRhMode ? '' : ' (clic : statut suivant)'}`;
            const prix = o.prime && !_pipelineRhMode
              ? `<span style="font-size:${police}px;font-weight:600;color:var(--text);white-space:nowrap">${court(o.prime)}</span>` : '';
            return `<button type="button" title="${titre.replace(/"/g, '&quot;')}" aria-label="${titre.replace(/"/g, '&quot;')}" ${_pipelineRhMode ? 'disabled' : ''}
              onclick="event.stopPropagation();changerStatutOffrePipeline('${o.demandeId}', ${o.index})"
              draggable="false" style="position:relative;display:inline-flex;align-items:center;gap:${prix ? 5 : 0}px;padding:${prix ? '2px 7px 2px 2px' : '0'};border:2px solid ${o.statut === 'retenue' ? st.couleur : 'transparent'};border-radius:${prix ? 999 : 8}px;background:${prix ? 'var(--surface)' : 'none'};cursor:${_pipelineRhMode ? 'default' : 'pointer'};opacity:${o.statut === 'non_retenue' ? 0.45 : 1};line-height:1">
              <span style="position:relative;line-height:0">${pictoCompagnie(o.compagnie, taille)}
                <span style="position:absolute;right:-5px;bottom:-5px;min-width:13px;height:13px;padding:0 2px;box-sizing:border-box;border-radius:7px;background:${st.couleur};color:#fff;font-size:8.5px;line-height:13px;font-weight:600;text-align:center">${st.symbole}</span></span>
              ${prix}
            </button>`;
          }).join('');
        })()}
      </div>
    </div>`;
  });
}

async function changerStatutOffrePipeline(demandeId, index) {
  if (_pipelineRhMode) return;
  const d = (_pipelineDemandes || []).find(x => x.id === demandeId);
  if (!d || !Array.isArray(d.compagnies_envoi) || !d.compagnies_envoi[index]) return;
  const envoi = [...d.compagnies_envoi];
  const actuel = _offreStatutEntree(envoi[index]);
  const nouveau = OFFRE_STATUTS[actuel].suivant;
  const e = { ...envoi[index], statut: nouveau };
  // 22.09.2026 : même modèle que la fiche opportunité (js/25) — date sous « recue_le » (l'ancien
  // « recu_le » n'était lu nulle part ailleurs), drapeau « retenue » tenu à jour, et le retour à
  // « envoyée » efface la réception, sinon la fiche continuait d'afficher l'offre comme reçue.
  if (!e.recue_le && e.recu_le) e.recue_le = e.recu_le;
  delete e.recu_le;
  if (nouveau === 'reçue' && !e.recue_le) e.recue_le = new Date().toISOString();
  e.retenue = nouveau === 'retenue';
  if (nouveau === 'envoyée') e.recue_le = null;
  envoi[index] = e;
  // Une seule offre retenue par affaire, comme opRetenir (js/25) : les autres demandes de la même
  // opportunité perdent leur drapeau (et « retenue » redevient « reçue »).
  const autres = [];
  if (nouveau === 'retenue') {
    (_pipelineDemandes || []).filter(x => x.id !== demandeId && x.opportunite_id === d.opportunite_id).forEach(x => {
      const liste = Array.isArray(x.compagnies_envoi) ? x.compagnies_envoi : [];
      if (!liste.some(y => y && (y.retenue || y.statut === 'retenue'))) return;
      autres.push({ x, liste: liste.map(y => y && (y.retenue || y.statut === 'retenue') ? { ...y, retenue: false, statut: 'reçue' } : y) });
    });
    envoi.forEach((y, i) => { if (i !== index && y && (y.retenue || y.statut === 'retenue')) envoi[i] = { ...y, retenue: false, statut: 'reçue' }; });
  }
  const r = await dbPatch('demandes_offre', demandeId, { compagnies_envoi: envoi });
  if (r && r.error) { showError('Statut de l’offre non enregistré : ' + errMsg(r)); return; }
  d.compagnies_envoi = envoi;
  for (const a of autres) {
    const ra = await dbPatch('demandes_offre', a.x.id, { compagnies_envoi: a.liste });
    if (!(ra && ra.error)) a.x.compagnies_envoi = a.liste;
  }
  if (nouveau === 'retenue' && d.opportunite_id) {
    const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === d.opportunite_id);
    const nom = normaliserCompagnie(e.compagnie || '');
    if (o && nom) { const ro = await dbPatch('opportunites', o.id, { compagnie: nom }); if (!(ro && ro.error)) o.compagnie = nom; }
  }
  // La fiche garde ses demandes en cache : on l'oublie pour qu'elle relise l'état à jour.
  if (d.opportunite_id && window._opDemandes) delete window._opDemandes[d.opportunite_id];
  logAction('statut_offre', 'demandes_offre', demandeId, `${normaliserCompagnie(envoi[index].compagnie)} : ${OFFRE_STATUTS[nouveau].label}`);
  remplirOffresPipeline();
}

// ── Glisser-déposer ──────────────────────────────────────────────────────────────────────────
function brancherGlisserDeposerPipeline() {
  const kanban = document.querySelector('.kanban');
  if (!kanban || kanban.dataset.ddBranche) return;
  kanban.dataset.ddBranche = '1';
  let idDeplace = null;

  document.querySelectorAll('.kanban-card[data-opp-id][draggable="true"]').forEach(carte => {
    carte.addEventListener('dragstart', e => {
      idDeplace = carte.dataset.oppId;
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', idDeplace); } catch (x) {}
      carte.classList.add('en-deplacement');
      document.body.classList.add('kanban-glisse');
    });
    carte.addEventListener('dragend', () => {
      carte.classList.remove('en-deplacement');
      document.body.classList.remove('kanban-glisse');
      document.querySelectorAll('.drop-cible').forEach(el => el.classList.remove('drop-cible'));
      idDeplace = null;
    });
  });

  document.querySelectorAll('.kanban-col[data-stade], .kanban-zone-fin[data-stade]').forEach(cible => {
    cible.addEventListener('dragover', e => { if (!idDeplace) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; cible.classList.add('drop-cible'); });
    cible.addEventListener('dragleave', e => { if (!cible.contains(e.relatedTarget)) cible.classList.remove('drop-cible'); });
    cible.addEventListener('drop', e => {
      e.preventDefault();
      cible.classList.remove('drop-cible');
      const id = idDeplace || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      const stade = cible.dataset.stade;
      document.body.classList.remove('kanban-glisse');
      const opp = allOpportunites.find(o => o.id === id);
      if (!opp || !stade || opp.stade === stade) return;
      changerStadeOpportunite(id, stade);
    });
  });
}
