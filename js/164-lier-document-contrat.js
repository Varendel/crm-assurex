// ═══ LIER UN DOCUMENT DÉPOSÉ À UN CONTRAT (25.09.2026) ═════════════════════════════════════════
// « Les polices que je viens de déposer, ça serait pas mal de pouvoir les connecter aux polices
//   saisies et ainsi les lier. »
//
// Un document déposé atterrit dans documents_compagnies avec client_id renseigné et contrat_id
// vide. Il vit donc à côté du portefeuille sans jamais le toucher : la fiche du contrat continue
// d'afficher « aucune police jointe » alors que le PDF est là, deux cartes plus bas.
//
// La colonne contrat_id existe depuis le début. Il manquait seulement de quoi la remplir.
//
// La suggestion ne réinvente rien : elle réutilise scoreBrancheImport (js/06), écrit pour départager
// deux contrats de même numéro de police lors d'un import de décompte. Le nom du fichier suffit
// souvent — « laa.pdf » désigne le contrat LAA, « ijm.pdf » la perte de gain maladie. Quand rien
// ne ressort, on ne propose RIEN plutôt qu'un contrat au hasard : un document rangé sous le mauvais
// contrat est pire qu'un document non rangé, parce qu'on cesse de le chercher.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Les liens déjà posés restent en base.

// En dessous de ce score, aucune branche ne ressort vraiment : scoreBrancheImport accorde déjà
// +0.5 à tout contrat non résilié, et +2 par famille de couverture reconnue. On exige donc une
// vraie correspondance de branche, pas un simple contrat vivant.
const DLC_SEUIL = 2;

function dlcEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function dlcContratsDuClient(clientId) {
  const l = typeof allContrats !== 'undefined' && Array.isArray(allContrats) ? allContrats : [];
  return l.filter(c => c.client_id === clientId);
}

function dlcClePolice(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// Le contrat le plus probable pour ce document, ou null.
function dlcSuggestion(doc, contrats) {
  if (!contrats || !contrats.length) return null;

  // 1. Un numéro de police identique ne se discute pas.
  const police = dlcClePolice(doc.numero_police);
  if (police.length >= 4) {
    const exact = contrats.find(c => dlcClePolice(c.numero_police) === police);
    if (exact) return { contrat: exact, motif: 'même numéro de police', sur: true };
  }

  // 2. Sinon, la branche lue dans le nom du fichier et le titre.
  if (typeof scoreBrancheImport !== 'function') return null;
  const texte = `${doc.nom_fichier || ''} ${doc.titre || ''}`;
  let best = null, second = -Infinity;
  for (const c of contrats) {
    const s = scoreBrancheImport(c, texte);
    if (!best || s > best.s) { second = best ? best.s : second; best = { c, s }; }
    else if (s > second) second = s;
  }
  if (!best || best.s < DLC_SEUIL) return null;
  return { contrat: best.c, motif: 'branche reconnue dans le nom du fichier', sur: best.s - second >= 2 };
}

function dlcLibelleContrat(c) {
  return `${c.produit || 'Contrat'}${c.compagnie ? ' — ' + c.compagnie : ''}${c.numero_police ? ' · ' + c.numero_police : ''}`;
}

// Le sélecteur posé sur la ligne du document.
function dlcCelluleHtml(lien) {
  const contrats = dlcContratsDuClient(lien.clientId);
  if (!contrats.length) return '<span class="dlc-vide" title="Ce client n’a aucun contrat fiché">—</span>';
  const lie = contrats.find(c => c.id === lien.contratId);
  const sugg = lie ? null : dlcSuggestion(lien.doc, contrats);
  const choisi = lie ? lie.id : '';
  return `<span class="dlc-cellule ${lie ? 'lie' : sugg ? 'propose' : ''}">
    <select class="dlc-select" aria-label="Contrat lié" title="${lie ? 'Document lié à : ' + dlcEsc(dlcLibelleContrat(lie)) : 'Lier ce document à un contrat'}"
      onchange="dlcLier('${lien.id}', this.value)">
      <option value="" ${choisi ? '' : 'selected'}>${sugg ? '🔗 Lier au contrat…' : '🔗 Non lié'}</option>
      ${contrats.map(c => `<option value="${c.id}" ${c.id === choisi ? 'selected' : ''}>${dlcEsc(dlcLibelleContrat(c))}</option>`).join('')}
    </select>
    ${sugg ? `<button type="button" class="dlc-suggestion" title="${dlcEsc(sugg.motif)} — ${dlcEsc(dlcLibelleContrat(sugg.contrat))}"
      onclick="dlcLier('${lien.id}', '${sugg.contrat.id}')">Lier à ${dlcEsc(String(sugg.contrat.produit || '').replace(/\s*\([^)]*\)\s*$/, '').slice(0, 26))} ?</button>` : ''}
  </span>`;
}

async function dlcLier(docId, contratId) {
  const doc = (window._dcx && window._dcx.docs || []).find(d => d.id === docId);
  const contrat = contratId ? dlcContratsDuClient(doc ? doc.client_id : null).find(c => c.id === contratId) : null;
  const maj = { contrat_id: contratId || null };
  // Le numéro de police du contrat descend sur le document s'il n'en portait pas : c'est ce qui
  // permettra plus tard de retrouver l'un depuis l'autre sans repasser par le lien.
  if (contrat && contrat.numero_police && !(doc && doc.numero_police)) maj.numero_police = contrat.numero_police;
  const r = await dbPatch('documents_compagnies', docId, maj);
  if (r && r.error) { showError('Le lien n’a pas pu être enregistré : ' + errMsg(r)); return; }
  if (doc) { doc.contrat_id = maj.contrat_id; if (maj.numero_police) doc.numero_police = maj.numero_police; }
  if (typeof logAction === 'function') logAction(contratId ? 'lier_document_contrat' : 'delier_document_contrat', 'documents_compagnies', docId, contrat ? dlcLibelleContrat(contrat) : null);
  showError(contrat ? `✓ Document lié à « ${dlcLibelleContrat(contrat)} ».` : '✓ Lien retiré.');
  if (doc && typeof showClient === 'function') showClient(doc.client_id);
}

// ── Greffe : on enrichit les documents de compagnie d'un lien, js/59 rend la cellule ───────────
(function dlcBrancher() {
  if (typeof dcxToutDocument !== 'function') return;
  const origine = dcxToutDocument;
  window.dcxToutDocument = function (clientId, contrats, mandats, rappels) {
    const out = origine.apply(this, arguments);
    const parId = new Map((window._dcx && window._dcx.docs || []).map(d => [d.id, d]));
    for (const o of out) {
      if (o.origine !== 'compagnie' || !o.publiable) continue;
      const d = parId.get(o.publiable.id);
      if (!d) continue;
      o.lien = { id: d.id, clientId: d.client_id, contratId: d.contrat_id || '', doc: d };
    }
    return out;
  };
})();

(function dlcStyles() {
  if (document.getElementById('dlc-styles')) return;
  const s = document.createElement('style');
  s.id = 'dlc-styles';
  s.textContent = `
    .dlc-cellule { display: inline-flex; align-items: center; gap: 6px; }
    .dlc-select { font: inherit; font-size: var(--t-xs, 11px); max-width: 190px; padding: 4px 7px;
      border-radius: 7px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); }
    .dlc-cellule.lie .dlc-select { color: #15803D; border-color: rgba(34,197,94,.35); background: rgba(34,197,94,.10); }
    .dlc-suggestion { font: inherit; font-size: 10.5px; font-weight: 600; cursor: pointer; white-space: nowrap;
      padding: 4px 9px; border-radius: 7px; border: 1px dashed var(--accent-border); background: var(--accent-dim); color: var(--accent); }
    .dlc-suggestion:hover { border-style: solid; }
    .dlc-vide { font-size: var(--t-xs, 11px); color: var(--text-muted); }
    @media (max-width: 720px) { .dlc-cellule { grid-column: 2 / -1; } .dlc-select { max-width: 100%; } }
  `;
  document.head.appendChild(s);
})();
