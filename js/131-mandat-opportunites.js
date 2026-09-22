// ═══ OPPORTUNITÉS : LE LOGO DU MANDAT QUAND IL EST ENREGISTRÉ (22.09.2026) ══════════════════════
// « Ajoute le logo du mandat s'il est enregistré dans les opp. »
//
// Le même logo que sur les couvertures (assets/logos/mandat-signe.svg, js/88) : sur chaque carte et
// chaque ligne du pipeline, et dans l'en-tête de la fiche opportunité, à côté du nom du client.
// La preuve est un mandat SIGNÉ et non archivé dans mandats_signes — lu en une seule requête pour
// tous les clients (cache de 60 s), puis posé sur ce qui est affiché. Pas de mandat : rien.

const _mop = { t: 0, clients: null, enCours: null };

async function mopClientsAvecMandat(forcer) {
  if (!forcer && _mop.clients && Date.now() - _mop.t < 60000) return _mop.clients;
  if (_mop.enCours) return _mop.enCours;
  _mop.enCours = dbGet('mandats_signes', 'signe=is.true&archive=is.false&select=client_id').then(r => {
    _mop.clients = new Set((Array.isArray(r) ? r : []).map(x => x.client_id).filter(Boolean));
    _mop.t = Date.now(); return _mop.clients;
  }).catch(() => _mop.clients || new Set()).finally(() => { _mop.enCours = null; });
  return _mop.enCours;
}

const MOP_BADGE = '<img src="assets/logos/mandat-signe.svg" alt="Mandat signé" class="mop-badge" title="Mandat signé enregistré" width="18" height="18"/>';

async function mopDecorer() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const cibles = main.querySelectorAll('[onclick*="editerOpportunite(\'"]:not([data-mop])');
  const fiche = main.querySelector('.opx-hero .fcx-contacts [onclick^="showClient(\'"]:not([data-mop])');
  // « Ajoute le logo mandat signé à côté de Fil de l'affaire » : le titre du fil, et l'affaire lue
  // sur le bouton « E-mails Outlook » de la même en-tête.
  const fil = [...main.querySelectorAll('.opx-h3:not([data-mop])')].find(h => /^Fil de l/.test(h.textContent.trim()));
  if (!cibles.length && !fiche && !fil) return;
  const avec = await mopClientsAvecMandat();
  const clientDeOpp = id => { const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === id); return o && o.client_id; };
  cibles.forEach(el => {
    el.setAttribute('data-mop', '');
    const m = (el.getAttribute('onclick') || '').match(/editerOpportunite\('([^']+)'\)/);
    const cid = m && clientDeOpp(m[1]);
    if (!cid || !avec.has(cid) || el.querySelector('.mop-badge')) return;
    // Sur la carte : à côté du nom (premier titre ou premier texte en gras), sinon en tête.
    // Ligne de tableau (liste, échéances…) : la 2e colonne est le client ; ne jamais ajouter une cellule.
    const cible = el.classList.contains('table-row') ? (el.children[1] || el.children[0])
      : (el.querySelector('.plc-qui b, b, strong, .sux-sous, .ocv-titre') || el);
    cible.insertAdjacentHTML('beforeend', ' ' + MOP_BADGE);
  });
  if (fiche) {
    fiche.setAttribute('data-mop', '');
    const m = (fiche.getAttribute('onclick') || '').match(/showClient\('([^']+)'\)/);
    if (m && avec.has(m[1])) fiche.insertAdjacentHTML('afterend', `<span class="fcx-chip mop-chip" title="Mandat de courtage signé enregistré">${MOP_BADGE} Mandat signé</span>`);
  }
  if (fil) {
    fil.setAttribute('data-mop', '');
    const tete = fil.closest('.dbx-carte-tete') || fil.parentElement;
    const b = tete && tete.querySelector('[onclick*="opChercherEmails(\'"], [onchange*="mopUploaderMandat(\'"]');
    const m = b && ((b.getAttribute('onclick') || b.getAttribute('onchange') || '').match(/\('([^']+)'/));
    const cid = m && clientDeOpp(m[1]);
    if (cid && avec.has(cid)) fil.insertAdjacentHTML('beforeend', `<span class="mop-fil-badge" title="Mandat de courtage signé enregistré">${MOP_BADGE.replace('width="18" height="18"', 'width="22" height="22"')}<span>Mandat signé</span></span>`);
  }
}

// ── Uploader le mandat depuis l'opportunité (22.09.2026) ────────────────────────────────────────
// « Mets un bouton upload le mandat dans l'opp, et le bouton poser le mandat dans le fil aussi, à
// côté de E-mails Outlook. » Même stockage et même ligne « mandat signé » que le dépôt de la fiche
// client (uploadMandatSigne, js/08), mais on reste sur l'affaire : une ligne s'ajoute au fil et le
// logo du mandat apparaît aussitôt.
async function mopUploaderMandat(oppId, input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  if (!o || !o.client_id) { showError('Rattache d’abord l’affaire à une fiche client : le mandat se classe sur le client.'); input.value = ''; return; }
  const types = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'];
  if (!types.includes(file.type)) { showError('Formats acceptés : PDF, JPEG, PNG, HEIC, WEBP.'); input.value = ''; return; }
  if (file.size > 15 * 1024 * 1024) { showError('Fichier trop lourd — maximum 15 Mo.'); input.value = ''; return; }
  const c = (allClients || []).find(x => x.id === o.client_id);
  const nom = c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : 'Client';
  const jour = new Date(); const iso = `${jour.getFullYear()}-${String(jour.getMonth() + 1).padStart(2, '0')}-${String(jour.getDate()).padStart(2, '0')}`;
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  const slug = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'client';
  const path = `mandats/${o.client_id}/Mandat_de_courtage_${slug}_${iso}_${Date.now().toString(36)}.${ext}`;
  showError('⏳ Envoi du mandat…');
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': file.type }, body: file });
    if (!up.ok) throw new Error('stockage ' + up.status);
    const r = await dbPost('mandats_signes', { client_id: o.client_id, signe: true,
      cree_par: (typeof supaSession !== 'undefined' && supaSession && supaSession.email) || null,
      fichier_url: path, fichier_nom: `Mandat de courtage — ${nom} — ${fmtDate(iso)} (signé).${ext}` });
    if (r && r.error) throw new Error(errMsg(r));
    if (typeof ajouterLigneHistoriqueOpportunite === 'function') await ajouterLigneHistoriqueOpportunite(oppId, `📎 Mandat de courtage signé déposé (${file.name})`);
    if (typeof logAction === 'function') logAction('upload_mandat', 'mandats_signes', null, `${nom} — ${file.name}`);
    _mop.clients = null;
    if (typeof _couMandats !== 'undefined') _couMandats.delete(o.client_id);
    if (typeof opRafraichir === 'function') opRafraichir();
    showError('✓ Mandat signé classé sur la fiche du client.');
  } catch (e) { showError('Mandat non enregistré : ' + (e.message || e)); }
  input.value = '';
}

// Les deux boutons dans l'en-tête du fil de l'affaire, à côté de « 🔍 E-mails Outlook ».
(function mopBoutonsFil() {
  if (typeof viewFicheOpportunite !== 'function') return;
  const origine = viewFicheOpportunite;
  window.viewFicheOpportunite = function (o) {
    const h = origine.apply(this, arguments);
    const lien = `<button type="button" class="dbx-lien" onclick="opChercherEmails('${o.id}')">🔍 E-mails Outlook</button>`;
    return h.replace(lien, `<span class="mop-fil-actions">${lien}
      <label class="dbx-lien mop-upload" title="Déposer le mandat signé à la main (PDF ou photo)">📤 Uploader le mandat<input type="file" accept="application/pdf,image/*" hidden onchange="mopUploaderMandat('${o.id}', this)"/></label>
      ${typeof cpfPoserMandat === 'function' ? `<button type="button" class="dbx-lien" onclick="cpfPoserMandat('${o.id}')" title="Envoyer le mandat signé aux compagnies">📨 Poser le mandat</button>` : ''}</span>`);
  };
})();

(function mopBrancher() {
  let t = null;
  const relancer = () => { clearTimeout(t); t = setTimeout(() => mopDecorer().catch(() => {}), 120); };
  const go = () => { const main = document.getElementById('main-content'); if (main) new MutationObserver(relancer).observe(main, { childList: true, subtree: true }); relancer(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  const st = document.createElement('style');
  st.textContent = `
    .mop-badge { width: 18px; height: 18px; vertical-align: -4px; margin-left: 4px; background: #fff; border-radius: 50%; padding: 1px; display: inline-block; }
    .mop-chip { display: inline-flex; align-items: center; gap: 5px; }
    .mop-chip .mop-badge { margin: 0; }
    .mop-fil-actions { display: inline-flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; justify-content: flex-end; }
    .mop-upload { cursor: pointer; }
    .mop-fil-badge { display: inline-flex; align-items: center; gap: 5px; margin-left: 10px; padding: 2px 9px 2px 3px; border-radius: 999px; vertical-align: 2px;
      font-size: var(--t-xs, 12px); font-weight: 600; color: #15803D; background: color-mix(in srgb, #16A34A 12%, var(--surface, #fff)); border: 1px solid color-mix(in srgb, #16A34A 35%, transparent); }
    .mop-fil-badge .mop-badge { width: 22px; height: 22px; margin: 0; }`;
  document.head.appendChild(st);
})();
