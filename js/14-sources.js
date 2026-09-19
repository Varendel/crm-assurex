// ═══ SOURCE DES CLIENTS — d'où viennent les clients, et lesquels rapportent (ajouté le 19.09.2026) ══
// clients.source = canal d'acquisition (recommandation, apporteur, RDV en ligne…), avec
// source_detail (nom de l'apporteur, campagne…) et source_client_id (client qui a recommandé).
// À ne pas confondre avec source_oz / source_cofidex, qui restent les ENTITÉS (répartition des
// commissions OZ Assure / Assurex-EX) et ne sont pas modifiées par ce module.

const SOURCES_CLIENT = [
  { v: 'recommandation_client', label: 'Recommandation d’un client', parClient: true },
  { v: 'apporteur',             label: 'Apporteur externe', detail: 'Nom de l’apporteur' },
  { v: 'famille',               label: 'Famille d’un client', parClient: true },
  { v: 'reseau',                label: 'Réseau personnel' },
  { v: 'portefeuille_oz',       label: 'Reprise portefeuille OZ' },
  { v: 'cofidex',               label: 'Clientèle Cofidex / EX' },
  { v: 'rdv_en_ligne',          label: 'Prise de RDV en ligne' },
  { v: 'campagne',              label: 'Campagne (e-mail, WhatsApp…)', detail: 'Nom de la campagne' },
  { v: 'web',                   label: 'Site web / réseaux sociaux', detail: 'Lequel ?' },
  { v: 'prospection',           label: 'Prospection directe' },
  { v: 'autre',                 label: 'Autre', detail: 'Précision' },
];

function srcEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function srcLabel(v) {
  const s = SOURCES_CLIENT.find(x => x.v === v);
  return s ? s.label : 'Non renseignée';
}

function srcNomClient(c) {
  return c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : '';
}

// Texte court « Recommandation d'un client — Anne Exemple »
function srcResume(c) {
  if (!c || !c.source) return 'Non renseignée';
  const ref = c.source_client_id ? allClients.find(x => x.id === c.source_client_id) : null;
  const complement = ref ? srcNomClient(ref) : (c.source_detail || '');
  return srcLabel(c.source) + (complement ? ' — ' + complement : '');
}

// Client « apporteur » à l'origine de ce client : lui-même s'il vient d'un apporteur, sinon on
// remonte la famille / les recommandations (5 niveaux max, sans boucle). null si aucun.
function srcApporteurRacine(c) {
  const vus = new Set();
  let x = c;
  for (let i = 0; x && i < 6 && !vus.has(x.id); i++) {
    if (x.source === 'apporteur') return x;
    if (!['famille', 'recommandation_client'].includes(x.source) || !x.source_client_id) return null;
    vus.add(x.id);
    x = allClients.find(y => y.id === x.source_client_id);
  }
  return null;
}

// ── Champ de formulaire (nouveau client / modification) ─────────────────────────────────────────
// prefixe : préfixe des id du formulaire ('f' = création, 'e' = modification)
function htmlChampSourceClient(prefixe, c) {
  const val = (c && c.source) || '';
  const clientsOptions = allClients
    .filter(x => !c || x.id !== c.id)
    .map(x => ({ id: x.id, nom: srcNomClient(x) }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const refNom = c && c.source_client_id ? srcNomClient(allClients.find(x => x.id === c.source_client_id)) : '';
  return `
    <div class="form-field"><label class="form-label" for="${prefixe}-source">Source du client</label>
      <select class="form-select" id="${prefixe}-source" onchange="srcMajChampsDetail('${prefixe}')">
        <option value="">— Non renseignée —</option>
        ${SOURCES_CLIENT.map(s => `<option value="${s.v}" ${val === s.v ? 'selected' : ''}>${srcEsc(s.label)}</option>`).join('')}
      </select></div>
    <div class="form-field" id="${prefixe}-source-client-wrap" style="display:${SOURCES_CLIENT.find(s => s.v === val)?.parClient ? 'block' : 'none'}">
      <label class="form-label" for="${prefixe}-source-client">Recommandé par (client)</label>
      <input class="form-input" id="${prefixe}-source-client" list="${prefixe}-source-client-liste" placeholder="Tape un nom…" value="${srcEsc(refNom)}" autocomplete="off"/>
      <datalist id="${prefixe}-source-client-liste">${clientsOptions.map(x => `<option value="${srcEsc(x.nom)}">`).join('')}</datalist></div>
    <div class="form-field" id="${prefixe}-source-detail-wrap" style="display:${SOURCES_CLIENT.find(s => s.v === val)?.detail ? 'block' : 'none'}">
      <label class="form-label" for="${prefixe}-source-detail" id="${prefixe}-source-detail-label">${srcEsc(SOURCES_CLIENT.find(s => s.v === val)?.detail || 'Précision')}</label>
      <input class="form-input" id="${prefixe}-source-detail" list="${prefixe}-source-detail-liste" value="${srcEsc((c && c.source_detail) || '')}" autocomplete="off"/>
      <datalist id="${prefixe}-source-detail-liste">${[...new Set(allClients.map(x => x.source_detail).filter(Boolean))].sort().map(d => `<option value="${srcEsc(d)}">`).join('')}</datalist></div>`;
}

function srcMajChampsDetail(prefixe) {
  const v = document.getElementById(`${prefixe}-source`)?.value || '';
  const def = SOURCES_CLIENT.find(s => s.v === v);
  const wrapClient = document.getElementById(`${prefixe}-source-client-wrap`);
  const wrapDetail = document.getElementById(`${prefixe}-source-detail-wrap`);
  if (wrapClient) wrapClient.style.display = def && def.parClient ? 'block' : 'none';
  if (wrapDetail) wrapDetail.style.display = def && def.detail ? 'block' : 'none';
  const label = document.getElementById(`${prefixe}-source-detail-label`);
  if (label && def && def.detail) label.textContent = def.detail;
}

// Valeurs à enregistrer (à fusionner dans le body de dbPost / dbPatch clients)
function lireChampSourceClient(prefixe) {
  const sel = document.getElementById(`${prefixe}-source`);
  if (!sel) return {};
  const v = sel.value || null;
  const def = SOURCES_CLIENT.find(s => s.v === v);
  let sourceClientId = null;
  if (def && def.parClient) {
    const nom = (document.getElementById(`${prefixe}-source-client`)?.value || '').trim().toLowerCase();
    const ref = nom ? allClients.find(x => srcNomClient(x).toLowerCase() === nom) : null;
    sourceClientId = ref ? ref.id : null;
  }
  const detail = def && def.detail ? ((document.getElementById(`${prefixe}-source-detail`)?.value || '').trim() || null) : null;
  return { source: v, source_client_id: sourceClientId, source_detail: detail };
}

// ── Bloc « Source » sur la fiche client (modifiable sur place) ──────────────────────────────────
function htmlSourceFicheClient(c) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--surface-alt);border-radius:10px;margin-top:8px">
    <div style="width:32px;height:32px;border-radius:50%;background:rgba(56,189,248,0.12);border:2px solid rgba(56,189,248,0.35);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">🧭</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Source du client</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <select aria-label="Source du client" onchange="srcChangerSourceFiche('${c.id}', this.value)" style="background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:5px 8px;color:var(--text);font-size:13px;font-weight:700;max-width:260px">
          <option value="">— Non renseignée —</option>
          ${SOURCES_CLIENT.map(s => `<option value="${s.v}" ${c.source === s.v ? 'selected' : ''}>${srcEsc(s.label)}</option>`).join('')}
        </select>
        ${c.source ? `<span style="font-size:12px;color:var(--text-muted)">${srcEsc(srcResume(c).replace(srcLabel(c.source), '').replace(/^ — /, ''))}</span>` : ''}
      </div>
    </div>
  </div>`;
}

async function srcChangerSourceFiche(clientId, valeur) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const def = SOURCES_CLIENT.find(s => s.v === valeur);
  const maj = { source: valeur || null, source_client_id: null, source_detail: null };
  if (def && def.parClient) {
    const nom = prompt(valeur === 'famille' ? 'Membre de la famille déjà client (nom et prénom) :' : 'Quel client l’a recommandé ? (nom et prénom)');
    if (nom) {
      const ref = allClients.find(x => x.id !== clientId && srcNomClient(x).toLowerCase() === nom.trim().toLowerCase())
        || allClients.find(x => x.id !== clientId && srcNomClient(x).toLowerCase().includes(nom.trim().toLowerCase()));
      if (ref) maj.source_client_id = ref.id; else maj.source_detail = nom.trim();
    }
  } else if (def && def.detail) {
    const d = prompt(def.detail + ' :', c.source === valeur ? (c.source_detail || '') : '');
    if (d) maj.source_detail = d.trim();
  }
  const r = await dbPatch('clients', clientId, maj);
  if (r && r.error) { showError('Source non enregistrée : ' + errMsg(r)); return; }
  Object.assign(c, maj);
  logAction('source_client', 'clients', clientId, srcResume(c));
  showError('✓ Source enregistrée : ' + srcResume(c));
  if (document.getElementById('src-liste')) renderSources();
  else if (typeof showClient === 'function' && document.querySelector('[onchange^="srcChangerSourceFiche"]')) showClient(clientId);
}

// ── Page « Sources des clients » ────────────────────────────────────────────────────────────────
let srcPeriode = 'tout';

function viewSources() {
  setTimeout(renderSources, 0);
  return `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">Sources des clients</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">D’où viennent les clients, et lesquels rapportent. Primes et commissions calculées sur les contrats actifs et les commissions non annulées.</div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      ${[['tout', 'Tous les clients'], ['annee', 'Créés cette année'], ['12m', 'Créés ces 12 derniers mois'], ['3m', 'Ces 3 derniers mois']].map(([v, l]) =>
        `<button type="button" onclick="srcPeriode='${v}';renderSources()" data-src-periode="${v}" class="${srcPeriode === v ? 'btn-save' : 'btn-secondary'}" style="padding:7px 14px;font-size:12px">${l}</button>`).join('')}
    </div>
    <div id="src-stats" class="stat-grid" style="margin-bottom:18px"></div>
    <div id="src-liste"></div>`;
}

function srcClientsPeriode() {
  const maintenant = new Date();
  const debut = srcPeriode === 'annee' ? new Date(maintenant.getFullYear(), 0, 1)
    : srcPeriode === '12m' ? new Date(maintenant.getTime() - 365 * 86400000)
    : srcPeriode === '3m' ? new Date(maintenant.getTime() - 91 * 86400000) : null;
  return allClients.filter(c => !debut || (c.created_at && new Date(c.created_at) >= debut));
}

function srcIndicateurs(clients) {
  const ids = new Set(clients.map(c => c.id));
  const contrats = allContrats.filter(ct => ids.has(ct.client_id) && ['actif', 'renouveler', 'en_cours'].includes(ct.statut));
  const avecContrat = new Set(contrats.map(ct => ct.client_id));
  const comm = (allCommissionsAttente || []).filter(ca => ids.has(ca.client_id) && !['annulé', 'annule'].includes(ca.statut));
  const opps = allOpportunites.filter(o => ids.has(o.client_id));
  const gagnees = opps.filter(o => o.stade === 'Gagné').length;
  const perdues = opps.filter(o => o.stade === 'Perdu').length;
  return {
    clients: clients.length,
    clientsAvecContrat: avecContrat.size,
    contrats: contrats.length,
    primes: contrats.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0),
    commissions: comm.reduce((s, ca) => s + Number(ca.montant_final ?? ca.montant_estime ?? 0), 0),
    oppsOuvertes: opps.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu').length,
    tauxGain: gagnees + perdues ? Math.round(gagnees / (gagnees + perdues) * 100) : null,
  };
}

function renderSources() {
  const zoneStats = document.getElementById('src-stats');
  const zone = document.getElementById('src-liste');
  if (!zoneStats || !zone) return;
  document.querySelectorAll('[data-src-periode]').forEach(b => { b.className = b.dataset.srcPeriode === srcPeriode ? 'btn-save' : 'btn-secondary'; });

  const clients = srcClientsPeriode();
  const sansSource = clients.filter(c => !c.source);
  const lignes = [...SOURCES_CLIENT.map(s => ({ v: s.v, label: s.label, clients: clients.filter(c => c.source === s.v) })),
    { v: '', label: 'Non renseignée', clients: sansSource }]
    .filter(l => l.clients.length)
    .map(l => ({ ...l, ind: srcIndicateurs(l.clients) }))
    .sort((a, b) => (a.v === '') - (b.v === '') || b.ind.commissions - a.ind.commissions || b.ind.clients - a.ind.clients);

  const top = lignes.filter(l => l.v)[0];
  const renseignes = clients.length - sansSource.length;
  zoneStats.innerHTML = `
    ${statCard('Clients', clients.length, '#38bdf8', `${renseignes} avec une source (${clients.length ? Math.round(renseignes / clients.length * 100) : 0} %)`)}
    ${statCard('Source la plus rentable', top ? top.label : '—', '#4ade80', top ? 'CHF ' + fmtCHF(Math.round(top.ind.commissions)) + ' de commissions' : '')}
    ${statCard('Recommandations', clients.filter(c => c.source === 'recommandation_client').length, '#a78bfa', 'clients venus par un client')}
    ${statCard('Sans source', sansSource.length, sansSource.length ? '#f59e0b' : '#64748b', 'à renseigner ci-dessous')}`;

  const cols = '1.6fr 80px 110px 90px 130px 130px 90px 90px';
  const tableau = `<div class="table-wrap" style="margin-bottom:24px">
    <div class="table-header" style="grid-template-columns:${cols}"><div>Source</div><div>Clients</div><div>Avec contrat</div><div>Contrats</div><div>Primes/an</div><div>Commissions</div><div>Opp. ouvertes</div><div>Taux gain</div></div>
    ${lignes.map(l => `<div class="table-row" style="grid-template-columns:${cols};align-items:center">
      <div style="font-weight:700;font-size:13px;color:${l.v ? 'var(--text)' : '#f59e0b'}">${srcEsc(l.label)}</div>
      <div style="font-size:13px;color:var(--text)">${l.ind.clients}</div>
      <div style="font-size:12.5px;color:var(--text-muted)">${l.ind.clientsAvecContrat} (${l.ind.clients ? Math.round(l.ind.clientsAvecContrat / l.ind.clients * 100) : 0} %)</div>
      <div style="font-size:12.5px;color:var(--text-muted)">${l.ind.contrats}</div>
      <div style="font-weight:700;color:#f59e0b">CHF ${fmtCHF(Math.round(l.ind.primes))}</div>
      <div style="font-weight:800;color:#4ade80">CHF ${fmtCHF(Math.round(l.ind.commissions))}</div>
      <div style="font-size:12.5px;color:var(--text-muted)">${l.ind.oppsOuvertes}</div>
      <div style="font-size:12.5px;color:var(--text-muted)">${l.ind.tauxGain === null ? '—' : l.ind.tauxGain + ' %'}</div>
    </div>`).join('')}
  </div>`;

  // Apporteurs externes et meilleurs recommandeurs. Un apporteur compte aussi la famille et les
  // recommandations des clients qu'il a amenés (chaîne source_client_id) — ex. l'apporteur d'une
  // maman compte aussi le conjoint et les enfants saisis « Famille d'un client » (19.09.2026).
  const parApporteur = {};
  clients.forEach(c => { const racine = srcApporteurRacine(c); if (racine) { const k = racine.source_detail || '(sans nom)'; (parApporteur[k] = parApporteur[k] || []).push(c); } });
  const apporteurs = Object.entries(parApporteur).map(([nom, cl]) => ({ nom, cl, directs: cl.filter(c => c.source === 'apporteur').length, ind: srcIndicateurs(cl) })).sort((a, b) => b.ind.commissions - a.ind.commissions || b.cl.length - a.cl.length);
  const parRef = {};
  clients.filter(c => c.source === 'recommandation_client' && c.source_client_id).forEach(c => { (parRef[c.source_client_id] = parRef[c.source_client_id] || []).push(c); });
  const recommandeurs = Object.entries(parRef).map(([id, cl]) => ({ ref: allClients.find(x => x.id === id), cl, ind: srcIndicateurs(cl) })).filter(x => x.ref).sort((a, b) => b.cl.length - a.cl.length);

  const colsA = '1.6fr 80px 90px 130px 130px';
  const blocApporteurs = apporteurs.length ? `<div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px">🤝 Apporteurs externes</div>
    <div class="table-wrap" style="margin-bottom:24px">
      <div class="table-header" style="grid-template-columns:${colsA}"><div>Apporteur</div><div>Clients</div><div>Contrats</div><div>Primes/an</div><div>Commissions</div></div>
      ${apporteurs.map(a => `<div class="table-row" style="grid-template-columns:${colsA}">
        <div style="font-size:13px;color:var(--text)"><b>${srcEsc(a.nom)}</b><div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${a.cl.map(c => `<a href="?client=${c.id}" onclick="return irVersClient(event, '${c.id}')" style="color:inherit">${srcEsc(srcNomClient(c))}</a>`).join(', ')}</div></div>
        <div title="${a.directs} apporté(s) directement, ${a.cl.length - a.directs} par la famille ou une recommandation">${a.ind.clients}</div><div>${a.ind.contrats}</div>
        <div style="color:#f59e0b;font-weight:700">CHF ${fmtCHF(Math.round(a.ind.primes))}</div><div style="color:#4ade80;font-weight:800">CHF ${fmtCHF(Math.round(a.ind.commissions))}</div></div>`).join('')}
    </div>` : '';
  const blocRecommandeurs = recommandeurs.length ? `<div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px">⭐ Clients qui recommandent</div>
    <div class="table-wrap" style="margin-bottom:24px">
      ${recommandeurs.map(x => `<div class="table-row" style="grid-template-columns:1.6fr 2fr 130px">
        <a href="?client=${x.ref.id}" onclick="return irVersClient(event, '${x.ref.id}')" style="font-weight:700;font-size:13px;color:var(--text);text-decoration:none">${srcEsc(srcNomClient(x.ref))}</a>
        <div style="font-size:12px;color:var(--text-muted)">${x.cl.map(c => srcEsc(srcNomClient(c))).join(', ')}</div>
        <div style="color:#4ade80;font-weight:800">CHF ${fmtCHF(Math.round(x.ind.commissions))}</div></div>`).join('')}
    </div>` : '';

  // Clients sans source : attribution rapide
  const blocSans = sansSource.length ? `<div style="font-size:13px;font-weight:800;color:#f59e0b;margin-bottom:4px">Clients sans source (${sansSource.length})</div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px">Choisis la source directement dans la liste — pour une recommandation, le CRM te demande le nom du client qui a recommandé.</div>
    <div class="table-wrap">
      ${sansSource.sort((a, b) => srcNomClient(a).localeCompare(srcNomClient(b))).map(c => `<div class="table-row" style="grid-template-columns:1.4fr 1fr 260px;align-items:center">
        <a href="?client=${c.id}" onclick="return irVersClient(event, '${c.id}')" style="font-weight:700;font-size:13px;color:var(--text);text-decoration:none">${srcEsc(srcNomClient(c))}</a>
        <div style="font-size:11.5px;color:var(--text-muted)">${c.created_at ? 'Créé le ' + fmtDate(c.created_at) : ''}</div>
        <select class="form-select" aria-label="Source de ${srcEsc(srcNomClient(c))}" style="padding:6px 8px;font-size:12px" onchange="srcChangerSourceFiche('${c.id}', this.value)">
          <option value="">— Choisir —</option>
          ${SOURCES_CLIENT.map(s => `<option value="${s.v}">${srcEsc(s.label)}</option>`).join('')}
        </select>
      </div>`).join('')}
    </div>` : '';

  zone.innerHTML = tableau + blocApporteurs + blocRecommandeurs + blocSans;
}
