// ═══ SUIVI DES AFFAIRES : FERMER LA TÂCHE DEPUIS LA LISTE (22.09.2026) ══════════════════════════
// « Dans le suivi des affaires en cours je peux qu'appeler ou planifier la prochaine action, mais
// si je veux fermer la tâche ? »
//
// Les priorités (js/27) n'offraient que 📞 appeler et ➜ planifier : une tâche faite obligeait à
// ouvrir l'affaire pour la cocher. Un bouton ✓ s'ajoute devant, quand une prochaine action existe.
// Il fait la même chose que la coche de la fiche (js/06 toggleTacheOpportunite) — statut « traité »,
// ligne dans le fil de l'affaire, événement Outlook supprimé — mais SANS quitter le suivi : la
// liste se redessine sur place, puis le CRM demande la prochaine action (« et maintenant ? »).

async function suxFermerAction(oppId) {
  const pa = typeof prochaineAction === 'function' ? prochaineAction(oppId) : null;
  if (!pa) { showError('Aucune tâche ouverte sur cette affaire.'); return; }

  let maj = { statut: 'traité' };
  if (pa.outlook_event_id) {
    try { await deleteOutlookEvent(pa.outlook_event_id); maj.outlook_event_id = null; } catch (e) { /* l'agenda suivra */ }
  }
  const r = await dbPatch('rappels', pa.id, maj);
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }

  allRappels = await dbGet('rappels', 'select=*');
  if (typeof ajouterLigneHistoriqueOpportunite === 'function') {
    await ajouterLigneHistoriqueOpportunite(oppId, `✓ Tâche terminée : ${pa.titre}`);
  }
  if (typeof logAction === 'function') logAction('tache_terminee', 'rappels', pa.id, pa.titre);

  suxRedessiner();
  showError(`✓ « ${pa.titre} » terminée.`);
  // Dernière tâche fermée : le CRM redemande une prochaine action, comme ailleurs.
  if (typeof verifierProchaineAction === 'function') verifierProchaineAction(oppId);
}

// Redessine la liste des priorités sans changer de vue (le score et la ligne « ➜ » en dépendent).
function suxRedessiner() {
  const prio = document.getElementById('sux-priorites');
  if (prio && typeof htmlSuxPriorites === 'function') prio.innerHTML = htmlSuxPriorites();
}

// Le bouton ✓ se glisse devant le ➜ de chaque ligne, uniquement si une tâche est ouverte.
(function suxPoserBouton() {
  if (typeof htmlSuxPriorites !== 'function') return;
  const origine = htmlSuxPriorites;
  window.htmlSuxPriorites = function () {
    const h = origine.apply(this, arguments);
    return h.replace(/<button type="button" title="Planifier la prochaine action" aria-label="Planifier" onclick="ouvrirModaleProchaineAction\('([^']+)'\)">➜<\/button>/g,
      (tout, oppId) => {
        const pa = typeof prochaineAction === 'function' ? prochaineAction(oppId) : null;
        if (!pa) return tout;
        const titre = String(pa.titre || 'la tâche').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        return `<button type="button" class="sux-fermer" title="Terminer : ${titre}" aria-label="Terminer la tâche" onclick="suxFermerAction('${oppId}')">✓</button>${tout}`;
      });
  };
})();

(function suxStyleFermer() {
  const st = document.createElement('style');
  st.textContent = `
    .sux-actions .sux-fermer { color: var(--c-succes, #16a34a); font-weight: 700; }
    .sux-actions .sux-fermer:hover { background: color-mix(in srgb, var(--c-succes, #16a34a) 14%, transparent); }
  `;
  document.head.appendChild(st);
})();
