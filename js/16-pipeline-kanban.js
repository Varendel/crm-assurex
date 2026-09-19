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
};

let _pipelineDemandes = null;     // demandes d'offre liées à une opportunité (chargées à la demande)
let _pipelineRhMode = false;

function _offreStatut(s) { return OFFRE_STATUTS[s] ? s : (s === 'recue' ? 'reçue' : 'envoyée'); }

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
      if (e && e.compagnie) lignes.push({ demandeId: d.id, index, compagnie: e.compagnie, statut: _offreStatut(e.statut) });
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
      <div style="display:flex;flex-wrap:wrap;gap:7px">
        ${offres.map(o => {
          const st = OFFRE_STATUTS[o.statut];
          const nom = normaliserCompagnie(o.compagnie);
          const titre = `${nom} — ${st.label}${_pipelineRhMode ? '' : ' (clic : statut suivant)'}`;
          return `<button type="button" title="${titre.replace(/"/g, '&quot;')}" aria-label="${titre.replace(/"/g, '&quot;')}" ${_pipelineRhMode ? 'disabled' : ''}
            onclick="event.stopPropagation();changerStatutOffrePipeline('${o.demandeId}', ${o.index})"
            draggable="false" style="position:relative;padding:0;border:2px solid ${o.statut === 'retenue' ? st.couleur : 'transparent'};border-radius:8px;background:none;cursor:${_pipelineRhMode ? 'default' : 'pointer'};opacity:${o.statut === 'non_retenue' ? 0.45 : 1};line-height:0">
            ${pictoCompagnie(o.compagnie, 22)}
            <span style="position:absolute;right:-6px;bottom:-6px;min-width:14px;height:14px;padding:0 2px;box-sizing:border-box;border-radius:7px;background:${st.couleur};color:#fff;font-size:9px;line-height:14px;font-weight:600;text-align:center">${st.symbole}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  });
}

async function changerStatutOffrePipeline(demandeId, index) {
  if (_pipelineRhMode) return;
  const d = (_pipelineDemandes || []).find(x => x.id === demandeId);
  if (!d || !Array.isArray(d.compagnies_envoi) || !d.compagnies_envoi[index]) return;
  const envoi = [...d.compagnies_envoi];
  const actuel = _offreStatut(envoi[index].statut);
  const nouveau = OFFRE_STATUTS[actuel].suivant;
  envoi[index] = { ...envoi[index], statut: nouveau };
  if (nouveau === 'reçue' && !envoi[index].recu_le) envoi[index].recu_le = new Date().toISOString();
  const r = await dbPatch('demandes_offre', demandeId, { compagnies_envoi: envoi });
  if (r && r.error) { showError('Statut de l’offre non enregistré : ' + errMsg(r)); return; }
  d.compagnies_envoi = envoi;
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
