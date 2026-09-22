// ═══ OPPORTUNITÉ : RETIRER UNE OFFRE SAISIE PAR ERREUR (22.09.2026) ═════════════════════════════
// « Offres reçues : il faut pouvoir effacer si erreur de saisie. »
//
// Un 🗑 sur chaque ligne d'offre de la fiche opportunité. L'offre quitte la liste (et les
// comparaisons, les relances, le « meilleur prix »), mais n'est pas détruite : elle est rangée
// dans la demande (donnees.offres_retirees, avec la date et qui l'a retirée), et le PDF éventuel
// reste dans le stockage. Une ligne dans l'historique de l'opportunité garde la trace.

async function opSupprimerOffre(oppId, demandeId, idx) {
  const rows = await dbGet('demandes_offre', `id=eq.${demandeId}&select=id,compagnies_envoi,donnees`).catch(() => []);
  const d = Array.isArray(rows) && rows[0];
  if (!d) { showError('Demande d’offre introuvable.'); return; }
  const entrees = [...(d.compagnies_envoi || [])];
  const e = entrees[idx];
  if (!e) { showError('Offre introuvable (déjà retirée ?).'); return; }
  const quoi = `${e.compagnie || 'cette compagnie'}${e.prime ? ' — CHF ' + fmtCHF(e.prime) + '/an' : ''}`;
  if (!confirm(`Retirer l’offre ${quoi} de l’opportunité ?\n\nÀ utiliser pour une erreur de saisie. L’offre est conservée à part (et son PDF), elle ne sera plus comptée.`)) return;
  const moi = typeof currentUser !== 'undefined' && currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : null;
  entrees.splice(idx, 1);
  const donnees = { ...(d.donnees || {}) };
  donnees.offres_retirees = [...(donnees.offres_retirees || []), { ...e, retiree_le: new Date().toISOString(), retiree_par: moi }];
  const r = await dbPatch('demandes_offre', demandeId, { compagnies_envoi: entrees, donnees });
  if (r && r.error) { showError('Offre non retirée : ' + errMsg(r)); return; }
  if (typeof ajouterLigneHistoriqueOpportunite === 'function') await ajouterLigneHistoriqueOpportunite(oppId, `🗑 Offre ${e.compagnie || ''} retirée (erreur de saisie)`);
  if (typeof logAction === 'function') logAction('retirer_offre', 'demandes_offre', demandeId, quoi);
  if (typeof opChargerDemandes === 'function') await opChargerDemandes(oppId);
  if (typeof opRafraichir === 'function') opRafraichir();
  showError(`✓ Offre ${e.compagnie || ''} retirée.`);
}

// Le bouton, à côté du ✎ de chaque ligne d'offre (htmlOffresOpportunite, js/25).
(function opSupprimerBrancher() {
  if (typeof htmlOffresOpportunite !== 'function') return;
  const rendu = htmlOffresOpportunite;
  window.htmlOffresOpportunite = function () {
    return rendu.apply(this, arguments).replace(
      /(<button type="button" onclick="opSaisirOffre\('([^']+)','([^']+)',(\d+)\)">[^<]*<\/button>)/g,
      (m, bouton, opp, dem, i) => `${bouton}<button type="button" class="opx-offre-retirer" onclick="opSupprimerOffre('${opp}','${dem}',${i})" title="Retirer cette offre (erreur de saisie)" aria-label="Retirer cette offre">🗑</button>`);
  };
  const st = document.createElement('style');
  st.textContent = `.opx-offre-retirer { opacity: .7; } .opx-offre-retirer:hover { opacity: 1; border-color: var(--c-danger, #EF4444) !important; color: var(--c-danger, #EF4444) !important; }`;
  document.head.appendChild(st);
})();
