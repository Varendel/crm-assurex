// ═══ FICHE CLIENT : JOURNAL D'ACTIVITÉ (façon « chatter » Odoo) — ajouté le 19.09.2026 ══════════
// Colonne à droite de la fiche client (en dessous sur petit écran) qui rassemble dans un seul fil
// tout ce qui s'est passé avec le client, du plus récent au plus ancien :
//   - notes, e-mails envoyés, appels        → table activites_client (nouvelle)
//   - tâches / rappels                      → rappels (client_id)
//   - rendez-vous                           → rendez_vous
//   - signatures (mandats, documents)       → mandats_signes
//   - opportunités (historique de chaque opp du client)
//   - modifications (contrat créé/modifié, statut, source…) → audit_log (hors simples consultations)
// Saisie en haut du fil : Note · E-mail (envoyé depuis Outlook) · Appel · Tâche.

const JA_TYPES = {
  note:         { label: 'Notes',         icone: '📝', fond: 'rgba(245,158,11,0.14)' },
  email:        { label: 'E-mails',       icone: '✉️', fond: 'rgba(167,139,250,0.16)' },
  appel:        { label: 'Appels',        icone: '📞', fond: 'rgba(56,189,248,0.14)' },
  courrier:     { label: 'Courriers',     icone: '📨', fond: 'rgba(17,54,121,0.12)' },
  // 22.09.2026 : ce qui vient de REX CLOUD porte le logo REX CLOUD, ce qui arrive par EcoHub le
  // logo EcoHub — on voit d'où vient l'événement sans lire la ligne.
  message:      { label: 'REX CLOUD',     icone: '<img src="assets/logos/rex/logo-cloud/embleme-48.png" alt="" class="ja-logo"/>', fond: 'rgba(0,207,255,0.14)' },
  ecohub:       { label: 'EcoHub',        icone: '<img src="assets/logos/ecohub-icone.svg" alt="" class="ja-logo ja-logo-ecohub"/>', fond: 'rgba(21,25,88,0.10)' },
  tache:        { label: 'Tâches',        icone: '☑️', fond: 'rgba(56,189,248,0.14)' },
  rdv:          { label: 'RDV',           icone: '📅', fond: 'rgba(74,222,128,0.14)' },
  signature:    { label: 'Signatures',    icone: '✍️', fond: 'rgba(74,222,128,0.14)' },
  opportunite:  { label: 'Opportunités',  icone: '🎯', fond: 'rgba(0,207,255,0.12)' },
  modification: { label: 'Modifications', icone: '✏️', fond: 'rgba(148,163,184,0.16)' },
};

const JA_LIBELLES_AUDIT = {
  create_contrat: 'Contrat créé', edit_contrat: 'Contrat modifié', delete_contrat: 'Contrat supprimé', upload_police: 'Police ajoutée',
  edit_client: 'Fiche modifiée', edit_statut_client: 'Statut modifié', toggle_source_oz: 'Entité OZ modifiée', toggle_source_cofidex: 'Entité EX modifiée',
  source_client: 'Source du client', lier_famille: 'Lien familial', revue_renouvellement: 'Suivi du renouvellement', tache_renouvellement: 'Tâche de revue créée',
  relance_lamal: 'Relance LAMal', reporter_renouvellement: 'Échéance reportée', edit_commission: 'Commission modifiée', create_demande_offre: 'Demande d’offre créée',
  update_demande_offre: 'Demande d’offre mise à jour', vente_croisee: 'Opportunité de vente croisée', edit_details_entreprise: 'Détails entreprise modifiés',
};

let _ja = { clientId: null, client: null, items: [], filtre: 'tout', mode: 'note', contexte: null };

function jaEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jaQuand(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const auj = new Date(); const hier = new Date(); hier.setDate(hier.getDate() - 1);
  const h = d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === auj.toDateString()) return `aujourd’hui ${h}`;
  if (d.toDateString() === hier.toDateString()) return `hier ${h}`;
  return `${fmtDate(iso)}${h !== '00:00' ? ' · ' + h : ''}`;
}

// Appelée par showClient() après l'affichage : place la fiche et le journal côte à côte
function monterJournalActivite(main, client, contexte) {
  if (!main || !client) return;
  const grille = document.createElement('div');
  grille.className = 'fiche-grille';
  const principale = document.createElement('div');
  principale.className = 'fiche-principale';
  while (main.firstChild) principale.appendChild(main.firstChild);
  const aside = document.createElement('aside');
  aside.className = 'fiche-activite';
  aside.id = 'fiche-activite';
  aside.setAttribute('aria-label', 'Journal d’activité');
  grille.appendChild(principale);
  grille.appendChild(aside);
  main.appendChild(grille);
  _ja = { clientId: client.id, client, items: [], filtre: 'tout', mode: _ja.mode || 'note', contexte: contexte || {} };
  renderCompositeurActivite();
  chargerJournalActivite();
}

async function chargerJournalActivite() {
  const clientId = _ja.clientId;
  const ctx = _ja.contexte || {};
  const idsContrats = (ctx.contrats || []).map(ct => ct.id);
  const oppsClient = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).filter(o => o.client_id === clientId);
  const idsAudit = [clientId, ...idsContrats, ...oppsClient.map(o => o.id)];
  const [activites, audits, messages, transferts, sinistres, demandesDocs, docsEcohub] = await Promise.all([
    dbGet('activites_client', `client_id=eq.${clientId}&select=*&order=created_at.desc&limit=200`),
    dbGet('audit_log', `record_id=in.(${idsAudit.join(',')})&action=not.in.(view_client,login,logout)&select=action,detail,user_email,created_at&order=created_at.desc&limit=150`),
    // Ce que le client a écrit ou demandé depuis son espace REX CLOUD (js/51, js/52)
    dbGet('messages_clients', `client_id=eq.${clientId}&select=*&order=created_at.desc&limit=50`).catch(() => []),
    dbGet('demandes_transfert', `client_id=eq.${clientId}&select=*&order=created_at.desc&limit=20`).catch(() => []),
    dbGet('sinistres', `client_id=eq.${clientId}&select=*&order=created_at.desc&limit=50`).catch(() => []),
    dbGet('demandes_documents', `client_id=eq.${clientId}&select=*&order=created_at.desc&limit=50`).catch(() => []),
    // Documents déposés par la synchronisation EcoHub pour ce client (js/59, source « ecohub »)
    dbGet('documents_compagnies', `client_id=eq.${clientId}&source=eq.ecohub&select=titre,nom_fichier,compagnie,numero_police,type,created_at,visible_client&order=created_at.desc&limit=50`).catch(() => []),
  ]);
  if (_ja.clientId !== clientId) return; // l'utilisateur a changé de fiche entre-temps

  const items = [];
  (activites || []).forEach(a => items.push({ type: a.type, date: a.created_at, qui: a.auteur,
    titre: a.type === 'email' ? `E-mail envoyé${a.sujet ? ' : ' + a.sujet : ''}` : a.type === 'appel' ? 'Appel' : a.type === 'courrier' ? `Courrier${a.sujet ? ' : ' + a.sujet : ''}` : 'Note', detail: a.contenu }));
  (ctx.rappels || []).forEach(r => items.push({ type: 'tache', date: r.created_at || r.date_echeance, qui: r.cree_par || '',
    titre: `${r.statut === 'ouvert' ? 'Tâche' : 'Tâche terminée'} : ${r.titre || ''}`, detail: r.date_echeance ? `Échéance ${fmtDate(r.date_echeance)}` : '' }));
  (ctx.rendezVousClient || []).forEach(r => items.push({ type: 'rdv', date: r.created_at || r.date_heure, qui: r.cree_par === 'client' ? 'Client (en ligne)' : (r.cree_par || ''),
    titre: `${r.statut === 'annule' ? 'RDV annulé' : 'Rendez-vous'} : ${r.type || ''}`, detail: r.date_heure ? `${fmtDate(r.date_heure)} à ${new Date(r.date_heure).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}` : '' }));
  (ctx.mandatsSignes || []).forEach(m => items.push({ type: 'signature', date: m.created_at, qui: m.cree_par || '',
    titre: m.signe ? 'Document signé' : 'Document enregistré (non signé)', detail: m.fichier_nom || 'Mandat de courtage' }));
  oppsClient.forEach(o => (Array.isArray(o.historique) ? o.historique : []).forEach(h => items.push({ type: 'opportunite', date: h.date, qui: h.auteur || '',
    titre: `Opportunité « ${o.titre || ''} »`, detail: h.texte })));
  (messages || []).forEach(m => {
    const ct = (ctx.contrats || []).find(x => x.id === m.contrat_id);
    items.push({ type: 'message', date: m.created_at, qui: 'Client (REX CLOUD)',
      titre: `Message du client${m.sujet ? ' : ' + m.sujet : ''}${ct ? ` — ${ct.produit || 'contrat'}${ct.numero_police ? ' (' + ct.numero_police + ')' : ''}` : ''}`,
      detail: m.message + (m.reponse ? `\n↳ Réponse : ${m.reponse}` : m.statut === 'nouveau' ? '\n↳ Sans réponse pour l’instant.' : '') });
  });
  (sinistres || []).forEach(s => {
    const ct = (ctx.contrats || []).find(x => x.id === s.contrat_id);
    items.push({ type: 'message', date: s.created_at, qui: 'Client (REX CLOUD)',
      titre: `Sinistre déclaré : ${s.type_sinistre || ''}${ct ? ` — ${ct.produit || ''}` : ''}`,
      detail: [s.date_sinistre ? `Survenu le ${fmtDate(s.date_sinistre)}` : '', s.lieu, s.description,
        s.reference_assureur ? `Référence assureur : ${s.reference_assureur}` : ''].filter(Boolean).join('\n') });
  });
  (demandesDocs || []).forEach(d => items.push({ type: 'message', date: d.created_at, qui: 'Client (REX CLOUD)',
    titre: `Document demandé : ${d.type_document}`, detail: d.precisions || '' }));
  (transferts || []).forEach(t => items.push({ type: 'message', date: t.created_at, qui: 'Client (REX CLOUD)',
    titre: 'Demande de transfert de gestion',
    detail: (Array.isArray(t.compagnies) ? t.compagnies : []).map(x => `${x.compagnie}${x.produit ? ' · ' + x.produit : ''}${x.police ? ' · ' + x.police : ''}`).join('\n') + (t.message ? `\n${t.message}` : '') }));
  (docsEcohub || []).forEach(d => items.push({ type: 'ecohub', date: d.created_at, qui: 'Synchronisation EcoHub',
    titre: `Document reçu : ${d.titre || d.nom_fichier || 'document'}`,
    detail: [d.compagnie, d.numero_police ? 'police ' + d.numero_police : '', d.visible_client ? 'en ligne dans l’espace client' : ''].filter(Boolean).join(' · ') }));
  (audits || []).forEach(a => items.push({ type: 'modification', date: a.created_at, qui: a.user_email || '',
    titre: JA_LIBELLES_AUDIT[a.action] || a.action.replace(/_/g, ' '), detail: a.detail || '' }));

  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  _ja.items = items;
  renderFilActivite();
}

function renderCompositeurActivite() {
  const aside = document.getElementById('fiche-activite');
  if (!aside) return;
  const modes = [['note', '📝 Note'], ['email', '✉️ E-mail'], ['appel', '📞 Appel'], ['tache', '☑️ Tâche']];
  const email = typeof rlEmailClient === 'function' ? rlEmailClient(_ja.client) : (_ja.client.email || null);
  const aide = {
    note: 'Ajouter une note sur ce client…',
    email: email ? `E-mail à ${email} (envoyé depuis ton Outlook)…` : 'Pas d’e-mail utilisable sur cette fiche.',
    appel: 'Résumé de l’appel…',
    tache: 'Décrire la tâche…',
  }[_ja.mode];
  aside.innerHTML = `
    <div class="ja-titre">Activité</div>
    <div class="ja-compositeur">
      <div class="ja-modes" role="tablist" aria-label="Type d’entrée">
        ${modes.map(([v, l]) => `<button type="button" role="tab" class="${_ja.mode === v ? 'actif' : ''}" onclick="_ja.mode='${v}';renderCompositeurActivite();renderFilActivite()">${l}</button>`).join('')}
      </div>
      ${_ja.mode === 'email' ? `<input id="ja-sujet" class="form-input" placeholder="Objet" aria-label="Objet de l’e-mail" ${email ? '' : 'disabled'}/>` : ''}
      <textarea id="ja-texte" class="form-input" rows="3" placeholder="${jaEsc(aide)}" aria-label="Contenu" ${_ja.mode === 'email' && !email ? 'disabled' : ''}></textarea>
      ${_ja.mode === 'tache' ? `<div style="display:flex;gap:8px;align-items:center"><label for="ja-date" style="font-size:12px;color:var(--text-muted)">Échéance</label><input id="ja-date" type="date" class="form-input" style="flex:1" value="${typeof paJoursOuvresPlus === 'function' ? paJoursOuvresPlus(1) : ''}"/></div>` : ''}
      <div style="display:flex;justify-content:flex-end">
        <button type="button" id="ja-publier" class="btn-save" style="padding:8px 16px" onclick="publierActivite()" ${_ja.mode === 'email' && !email ? 'disabled' : ''}>${{ note: 'Ajouter la note', email: 'Envoyer', appel: 'Enregistrer l’appel', tache: 'Planifier' }[_ja.mode]}</button>
      </div>
    </div>
    <div class="ja-filtres" id="ja-filtres"></div>
    <div class="ja-fil" id="ja-fil"><div class="table-empty">Chargement…</div></div>`;
}

function renderFilActivite() {
  const zoneFiltres = document.getElementById('ja-filtres');
  const zoneFil = document.getElementById('ja-fil');
  if (!zoneFiltres || !zoneFil) return;
  const presents = [...new Set(_ja.items.map(i => i.type))];
  zoneFiltres.innerHTML = [['tout', 'Tout']].concat(Object.keys(JA_TYPES).filter(t => presents.includes(t)).map(t => [t, JA_TYPES[t].label]))
    .map(([v, l]) => `<button type="button" class="${_ja.filtre === v ? 'actif' : ''}" onclick="_ja.filtre='${v}';renderFilActivite()">${l}</button>`).join('');
  const liste = _ja.items.filter(i => _ja.filtre === 'tout' || i.type === _ja.filtre);
  if (!liste.length) { zoneFil.innerHTML = '<div class="table-empty">Rien pour l’instant.</div>'; return; }
  zoneFil.innerHTML = jaRegrouperSemaines(liste.slice(0, 120)).map(g => g.items.length > 1 ? jaGroupeHtml(g) : jaItemHtml(g.items[0])).join('');
}

// Pictogramme d'une ligne. Notes et tâches posées par la synchronisation EcoHub gardent leur
// pictogramme (la case cochée dit « tâche ») et portent une petite pastille EcoHub en coin.
function jaIconeHtml(i) {
  const t = JA_TYPES[i.type] || JA_TYPES.modification;
  const pastille = i.type !== 'ecohub' && /ecohub/i.test(i.qui || '')
    ? '<span class="ja-pastille-ecohub"><img src="assets/logos/ecohub-icone.svg" alt=""/></span>' : '';
  return `<span class="ja-icone" style="background:${t.fond}" aria-hidden="true">${t.icone}${pastille}</span>`;
}

function jaItemHtml(i) {
  return `<div class="ja-item">
      ${jaIconeHtml(i)}
      <div class="ja-corps">
        <div class="ja-item-titre">${jaEsc(i.titre)}</div>
        ${i.detail ? `<div class="ja-item-detail">${jaEsc(i.detail)}</div>` : ''}
        <div class="ja-item-meta">${jaEsc(i.qui || '')}${i.qui ? ' · ' : ''}${jaQuand(i.date)}</div>
      </div>
    </div>`;
}

// ── Regroupement par semaine (22.09.2026) ──────────────────────────────────────────────────────
// « Regroupe les notes d'une même semaine sur une ligne avec les différentes dates : ça évite que
// ça bouffe toute la place. » Les entrées de même nature d'une même semaine (lundi → dimanche)
// tiennent sur une ligne : le nombre, les jours en pastilles, et le détail replié. Les demandes
// du client (REX CLOUD) restent une par ligne : chacune appelle une réponse, aucune ne doit se
// cacher dans un groupe.
const JA_NON_GROUPES = ['message'];

function jaLundi(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const l = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7));
  return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, '0')}-${String(l.getDate()).padStart(2, '0')}`;
}

function jaRegrouperSemaines(liste) {
  const groupes = [], parCle = new Map();
  for (const i of liste) {
    const lundi = i.date ? jaLundi(i.date) : '';
    if (!lundi || JA_NON_GROUPES.includes(i.type)) { groupes.push({ items: [i] }); continue; }
    const cle = i.type + '|' + lundi;
    // La liste est triée du plus récent au plus ancien : le groupe prend la place de son entrée
    // la plus récente, les suivantes de la semaine viennent s'y ranger.
    if (parCle.has(cle)) parCle.get(cle).items.push(i);
    else { const g = { type: i.type, lundi, items: [i] }; parCle.set(cle, g); groupes.push(g); }
  }
  return groupes;
}

function jaJourCourt(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-CH', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '').replace(/\.$/, '');
}

function jaGroupeHtml(g) {
  const t = JA_TYPES[g.type] || JA_TYPES.modification;
  const n = g.items.length;
  const [a, m, j] = g.lundi.split('-').map(Number);
  const lundi = new Date(a, m - 1, j);
  const cetteSemaine = g.lundi === jaLundi(new Date().toISOString());
  const semaine = cetteSemaine ? 'cette semaine'
    : `semaine du ${lundi.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}`;
  const nom = (t.label || '').toLowerCase();
  // Une pastille par jour (plusieurs entrées le même jour : « ×2 »), du plus ancien au plus récent.
  const jours = [];
  [...g.items].reverse().forEach(i => {
    const k = new Date(i.date).toDateString();
    const x = jours.find(y => y.k === k);
    if (x) x.n++; else jours.push({ k, lib: jaJourCourt(i.date), n: 1 });
  });
  const auteurs = [...new Set(g.items.map(i => i.qui).filter(Boolean))];
  return `<details class="ja-item ja-groupe">
      <summary>
        ${jaIconeHtml(g.items[0])}
        <div class="ja-corps">
          <div class="ja-item-titre">${n} ${jaEsc(nom)} · ${jaEsc(semaine)}</div>
          <div class="ja-jours">${jours.map(x => `<span class="ja-jour">${jaEsc(x.lib)}${x.n > 1 ? ` <b>×${x.n}</b>` : ''}</span>`).join('')}</div>
          <div class="ja-item-meta">${jaEsc(auteurs.join(', '))}${auteurs.length ? ' · ' : ''}<span class="ja-voir">Voir le détail</span></div>
        </div>
      </summary>
      <div class="ja-groupe-liste">${g.items.map(i => `
        <div class="ja-sous">
          <span class="ja-sous-date">${jaEsc(jaJourCourt(i.date))}</span>
          <div class="ja-sous-corps">
            ${i.titre && !(i.titre === 'Note' && i.detail) ? `<div class="ja-item-titre">${jaEsc(i.titre)}</div>` : ''}
            ${i.detail ? `<div class="ja-item-detail">${jaEsc(i.detail)}</div>` : ''}
          </div>
        </div>`).join('')}</div>
    </details>`;
}

async function publierActivite() {
  const texte = (document.getElementById('ja-texte')?.value || '').trim();
  const btn = document.getElementById('ja-publier');
  if (!texte) { showError('Écris quelques mots d’abord.'); return; }
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  const auteur = currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : '';
  const c = _ja.client;
  try {
    if (_ja.mode === 'tache') {
      const date = document.getElementById('ja-date')?.value || null;
      const monAgent = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
      const r = await dbPost('rappels', { titre: texte, client_id: c.id, type: 'Suivi', nature: 'tache', urgence: 'moyenne', statut: 'ouvert', date_echeance: date, apporteur_id: (monAgent || {}).id || null });
      if (r && r.error) throw new Error(errMsg(r));
      if (r && r[0] && date && typeof createOutlookEventFromRappel === 'function') {
        try { const eventId = await createOutlookEventFromRappel(r[0]); if (eventId) await dbPatch('rappels', r[0].id, { outlook_event_id: eventId }); } catch (e) { /* agenda : resynchroniser depuis Tâches */ }
      }
      if (r && r[0]) (_ja.contexte.rappels = _ja.contexte.rappels || []).push({ ...r[0], created_at: r[0].created_at || new Date().toISOString(), cree_par: auteur });
      allRappels = await dbGet('rappels', 'select=*');
      showError(`✓ Tâche planifiée${date ? ' pour le ' + fmtDate(date) : ''}.`);
    } else if (_ja.mode === 'email') {
      const dest = typeof rlEmailClient === 'function' ? rlEmailClient(c) : c.email;
      const sujet = (document.getElementById('ja-sujet')?.value || '').trim() || 'Assurex';
      if (!dest) throw new Error('pas d’e-mail utilisable sur cette fiche');
      if (!(await assurerTokenOutlook())) throw new Error('connecte-toi à Outlook (Microsoft) dans le CRM');
      const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST', headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { subject: sujet, body: { contentType: 'text', content: texte }, toRecipients: [{ emailAddress: { address: dest } }] }, saveToSentItems: true }),
      });
      if (!r.ok) throw new Error('envoi Outlook refusé (HTTP ' + r.status + ')');
      const rr = await dbPost('activites_client', { client_id: c.id, type: 'email', sujet, contenu: texte, auteur });
      if (rr && rr.error) console.error('Journal : e-mail envoyé mais non journalisé', rr);
      showError(`✓ E-mail envoyé à ${dest}.`);
    } else {
      const r = await dbPost('activites_client', { client_id: c.id, type: _ja.mode, contenu: texte, auteur });
      if (r && r.error) throw new Error(errMsg(r));
    }
  } catch (e) {
    showError('Non enregistré : ' + (e.message || e));
    if (btn) btn.disabled = false;
    return;
  }
  renderCompositeurActivite();
  chargerJournalActivite();
}
