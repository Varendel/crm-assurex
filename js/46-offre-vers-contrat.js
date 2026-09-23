// ═══ OFFRE SIGNÉE → POLICE(S) → CONTRAT(S) + OPPORTUNITÉ GAGNÉE (19.09.2026, demande de Jonathan) ══
// Depuis une offre reçue sur la fiche opportunité : « ✍️ Signée → contrat ». On dépose la ou les
// polices PDF reçues de la compagnie, puis en un clic :
//   1. l'offre est marquée « retenue » et l'opportunité passe en « Gagné » (probabilité 100 %) ;
//   2. le formulaire de contrat habituel s'ouvre, pré-rempli depuis l'opportunité et lu par REX
//      depuis la police (import IA existant) — la police PDF est archivée sur le contrat ;
//   3. plusieurs polices → un contrat par police, enchaînés automatiquement après chaque
//      enregistrement ; l'opportunité est reliée au dernier contrat créé.
// On réutilise le formulaire et saveContrat() tels quels : commissions, rappels et contrôles
// restent exactement les mêmes qu'une saisie manuelle. Rien n'est enregistré sans « Enregistrer ».

let _ovc = null; // { oppId, compagnie, prime, fichiers: [File], total }

function ovcEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function opSigneeVersContrat(oppId, demandeId, idx) {
  const o = allOpportunites.find(x => x.id === oppId);
  const d = (window._opDemandes && window._opDemandes[oppId] || []).find(x => x.id === demandeId);
  const e = d && (d.compagnies_envoi || [])[idx];
  if (!o || !e) return;
  creerModale('modal-offre-signee', `
    <div class="opx-modale" role="dialog" aria-modal="true" aria-labelledby="ovc-titre">
      <h3 id="ovc-titre">${typeof pictoCompagnie === 'function' ? pictoCompagnie(e.compagnie, 26) : ''} Offre signée — ${ovcEsc(e.compagnie)}</h3>
      <div class="opx-modale-sous">${ovcEsc(o.titre || '')}${e.prime ? ` · CHF ${fmtCHF(e.prime)}/an` : ''}</div>
      <ol class="ovc-etapes">
        <li>L’offre est <b>retenue</b> et l’opportunité passe en <b>Gagné</b>.</li>
        <li>Le formulaire de contrat s’ouvre, <b>pré-rempli par REX</b> depuis la police.</li>
        <li>La police PDF est <b>archivée sur le contrat</b> — une police = un contrat.</li>
      </ol>
      <label class="ovc-depot" id="ovc-depot">
        <input type="file" id="ovc-fichiers" accept="application/pdf" multiple onchange="ovcMajListe()"/>
        <span class="ovc-depot-icone" aria-hidden="true">📄</span>
        <b>Déposer la ou les polices PDF</b>
        <small>Glisser ici ou cliquer · 10 Mo max par fichier</small>
      </label>
      <div id="ovc-liste" class="ovc-liste"></div>
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-offre-signee').remove()">Annuler</button>
        <button type="button" class="btn-save" id="ovc-btn" onclick="ovcConfirmer('${oppId}','${demandeId}',${idx})">✍️ Gagnée → créer le contrat</button>
      </div>
      <div class="ovc-note">Pas encore la police ? Continue sans fichier : le contrat sera pré-rempli depuis l’offre, tu pourras joindre la police plus tard depuis la fiche contrat.</div>
    </div>`, { padding: '16px' });
  const zone = document.getElementById('ovc-depot');
  if (zone) {
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, x => { x.preventDefault(); zone.classList.add('survol'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, x => { x.preventDefault(); zone.classList.remove('survol'); }));
    zone.addEventListener('drop', x => { const inp = document.getElementById('ovc-fichiers'); if (inp && x.dataTransfer) { inp.files = x.dataTransfer.files; ovcMajListe(); } });
  }
}

function ovcFichiersValides() {
  const f = [...(document.getElementById('ovc-fichiers')?.files || [])];
  return f.filter(x => x.type === 'application/pdf' && x.size <= 10 * 1024 * 1024);
}
function ovcMajListe() {
  const tous = [...(document.getElementById('ovc-fichiers')?.files || [])];
  const ok = ovcFichiersValides();
  const z = document.getElementById('ovc-liste');
  if (z) z.innerHTML = tous.map(f => `<div class="${ok.includes(f) ? '' : 'refuse'}">📄 ${ovcEsc(f.name)} <small>${ok.includes(f) ? Math.round(f.size / 1024) + ' Ko' : 'refusé (PDF de 10 Mo max)'}</small></div>`).join('');
  const b = document.getElementById('ovc-btn');
  if (b) b.textContent = ok.length > 1 ? `✍️ Gagnée → créer ${ok.length} contrats` : '✍️ Gagnée → créer le contrat';
}

async function ovcConfirmer(oppId, demandeId, idx) {
  const btn = document.getElementById('ovc-btn');
  if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Préparation…'; }
  const fichiers = ovcFichiersValides();
  const o = allOpportunites.find(x => x.id === oppId);
  const demandes = window._opDemandes[oppId] || [];
  let compagnie = null, prime = null;

  // 1. Offre retenue (et elle seule)
  for (const d of demandes) {
    const entrees = [...(d.compagnies_envoi || [])];
    let change = false;
    entrees.forEach((e, i) => {
      const cible = d.id === demandeId && i === idx;
      if (cible) { compagnie = e.compagnie; prime = e.prime; }
      if (!!e.retenue !== cible) { entrees[i] = { ...e, retenue: cible, statut: cible ? 'retenue' : (e.statut === 'retenue' ? 'reçue' : e.statut) }; change = true; }
    });
    if (change) {
      // 23.09.2026 (audit) : relecture avant écriture, sinon on efface les offres ajoutées
      // ailleurs entre-temps — voir majListeJson (js/146).
      const r = await majListeJson('demandes_offre', d.id, 'compagnies_envoi',
        l => l.map((e, i) => { const cible = d.id === demandeId && i === idx;
          return (!!e.retenue !== cible) ? { ...e, retenue: cible, statut: cible ? 'retenue' : (e.statut === 'retenue' ? 'reçue' : e.statut) } : e; }), entrees);
      if (r && r.error) { showError('Offre non retenue : ' + errMsg(r)); if (btn) btn.disabled = false; return; }
      d.compagnies_envoi = r.liste;
    }
  }
  // 2. Opportunité gagnée
  const nomCie = typeof normaliserCompagnie === 'function' ? normaliserCompagnie(compagnie || '') : compagnie;
  const maj = { stade: 'Gagné', probabilite: 100, ...(nomCie ? { compagnie: nomCie } : {}) };
  const r = await dbPatch('opportunites', oppId, maj);
  if (r && r.error) { showError('Opportunité non mise à jour : ' + errMsg(r)); if (btn) btn.disabled = false; return; }
  const ancien = o.stade;
  Object.assign(o, maj);
  if (typeof ajouterLigneHistoriqueOpportunite === 'function') {
    await ajouterLigneHistoriqueOpportunite(oppId, `✍️ Offre ${compagnie || ''} signée${prime ? ' — CHF ' + fmtCHF(prime) + '/an' : ''}${fichiers.length ? ` · ${fichiers.length} police${fichiers.length > 1 ? 's' : ''} reçue${fichiers.length > 1 ? 's' : ''}` : ''}`);
    if (ancien !== 'Gagné') await ajouterLigneHistoriqueOpportunite(oppId, `🔀 Stade : ${ancien || '—'} → Gagné`);
  }
  document.getElementById('modal-offre-signee')?.remove();

  // 3. Formulaire de contrat, une police après l'autre
  _ovc = { oppId, compagnie: nomCie, prime, fichiers, total: Math.max(1, fichiers.length), rang: 0 };
  await ovcOuvrirFormulaire();
}

async function ovcOuvrirFormulaire() {
  if (!_ovc) return;
  const o = allOpportunites.find(x => x.id === _ovc.oppId);
  if (!o) { _ovc = null; return; }
  prefillOpportunite = { ...o, compagnie: _ovc.compagnie || o.compagnie };
  const produits = Array.isArray(o.produits) ? o.produits : [];
  prefillOpportuniteProduitId = produits[_ovc.rang] || produits[0] || null;
  oppFileAttenteProduits = [];
  contratClientId = o.client_id || null;
  await navigate('nouveau-contrat');
  // Bandeau de progression + rappel de l'offre
  const zoneImport = document.getElementById('police-import-status');
  const bandeau = document.createElement('div');
  bandeau.className = 'ovc-bandeau';
  bandeau.innerHTML = `✍️ Offre signée${_ovc.compagnie ? ' — ' + ovcEsc(_ovc.compagnie) : ''}${_ovc.prime ? ` · prime de l’offre CHF ${fmtCHF(_ovc.prime)}/an` : ''}${_ovc.total > 1 ? ` · <b>contrat ${_ovc.rang + 1} sur ${_ovc.total}</b>` : ''}`;
  document.querySelector('#main-content .rex-bandeau, #main-content h2')?.insertAdjacentElement('afterend', bandeau);
  const f = _ovc.fichiers[_ovc.rang];
  if (f && typeof importPolicePdfAI === 'function') {
    await importPolicePdfAI({ files: [f], value: '' });
    window._policePdfFileFromImport = f; // archivée sur le contrat à l'enregistrement, même si la lecture IA échoue
  } else if (zoneImport) {
    zoneImport.textContent = 'Pas de police jointe — vérifie la prime et les dates avant d’enregistrer.';
  }
}

// Après chaque contrat enregistré : police suivante, sinon fin (l'opportunité est reliée par saveContrat)
if (typeof saveContrat === 'function') {
  const _saveContratAvantOvc = saveContrat;
  saveContrat = async function () {
    const avant = (allContrats || []).length;
    // Enchaînement actif seulement si ce formulaire vient bien de l'offre signée (sinon « Annuler »
    // puis une autre saisie de contrat relancerait la file par erreur)
    if (_ovc && !(prefillOpportunite && prefillOpportunite.id === _ovc.oppId)) _ovc = null;
    await _saveContratAvantOvc.apply(this, arguments);
    if (!_ovc) return;
    const cree = (allContrats || []).length > avant;
    if (!cree) return; // erreur de saisie : on reste sur le formulaire
    _ovc.rang++;
    if (_ovc.rang < _ovc.fichiers.length) {
      showError(`✓ Contrat ${_ovc.rang} sur ${_ovc.total} créé — police suivante.`);
      await ovcOuvrirFormulaire();
    } else {
      const n = _ovc.total;
      _ovc = null;
      showError(`✓ Opportunité gagnée — ${n > 1 ? n + ' contrats créés' : 'contrat créé'} avec la police archivée.`);
    }
  };
}
