// ═══ OPPORTUNITÉ : LES NOTES VONT DANS LE FIL, PLUS DE CARTE « NOTES » À DROITE (22.09.2026) ═════
// « Pourquoi les notes saisies ont disparu du fil et finissent à droite ? Retire Notes à droite et
// laisse les notes dans le fil de l'affaire. »
//
// Deux endroits pour la même chose : les notes tapées dans le fil vont dans l'historique ; celles
// du formulaire « Tous les champs » et des affaires créées automatiquement (renouvellements,
// équipement…) allaient dans le champ `notes`, affiché dans une carte séparée à droite.
// Désormais, à l'ouverture de la fiche, le contenu du champ `notes` rejoint le fil — une note
// comme les autres, datée, marquée « Notes de l'affaire » — et le champ est vidé : plus rien ne
// s'accumule à part. La carte de droite disparaît. Rien n'est perdu : le texte est recopié tel quel.

async function nfVerserNotes(o) {
  const texte = String(o && o.notes || '').trim();
  if (!texte) return;
  const ligne = { texte: '📝 ' + texte, date: o.updated_at || o.created_at || new Date().toISOString(), auteur: 'Notes de l’affaire', source: 'notes' };
  const historique = [...(Array.isArray(o.historique) ? o.historique : [])];
  // Déjà versée (même texte) : on ne double pas, on vide seulement le champ.
  if (!historique.some(h => h.source === 'notes' && String(h.texte || '').includes(texte))) historique.push(ligne);
  const r = await dbPatch('opportunites', o.id, { historique, notes: null });
  if (r && r.error) { console.error('Notes non versées dans le fil', r); return; }
  o.historique = historique; o.notes = null;
}

(function nfBrancher() {
  if (typeof viewFicheOpportunite !== 'function') return;
  const origine = viewFicheOpportunite;
  window.viewFicheOpportunite = function (o) {
    // Affichage immédiat : la note apparaît dans le fil dès ce rendu, l'écriture suit.
    if (o && String(o.notes || '').trim()) {
      const texte = String(o.notes).trim();
      const hist = Array.isArray(o.historique) ? o.historique : [];
      if (!hist.some(h => h.source === 'notes' && String(h.texte || '').includes(texte))) {
        o.historique = [...hist, { texte: '📝 ' + texte, date: o.updated_at || o.created_at || new Date().toISOString(), auteur: 'Notes de l’affaire', source: 'notes' }];
      }
      const copie = { ...o, historique: hist, notes: texte };
      setTimeout(() => nfVerserNotes(copie).then(() => { o.notes = null; }), 0);
    }
    return origine.apply(this, arguments)
      .replace(/<section class="dbx-carte opx-carte">\s*<div class="dbx-carte-tete"><h3 class="opx-h3">Notes<\/h3>[\s\S]*?<\/section>/, '');
  };
})();
