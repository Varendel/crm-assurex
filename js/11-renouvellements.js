// ═══ RENOUVELLEMENTS — échéancier par date limite de résiliation (ajouté le 19.09.2026) ═══════
// Classe les contrats selon la DATE LIMITE DE RÉSILIATION (échéance − préavis), pas selon
// l'échéance elle-même : pour une échéance au 31.12 avec 3 mois de préavis, c'est le 30.09 qui
// compte — que ce soit pour garder le client (revue avant qu'il ne soit démarché) ou pour
// reprendre une police non commissionnée (transfert).
//
// Colonnes utilisées sur contrats (migration 20260919_contrats_suivi_renouvellement) :
//   preavis_mois   — null = défaut (3 mois, 1 mois pour la LAMal)
//   revue_statut   — a_contacter / rdv / offre / reconduit / remplace / resilie
//   revue_echeance — l'échéance à laquelle se rapporte revue_statut : si date_echeance change
//                    (contrat reconduit, nouvelle police), le suivi repart automatiquement à zéro.

const RN_STATUTS = [
  { v: 'a_contacter', label: 'À contacter', couleur: '#94a3b8' },
  { v: 'rdv',         label: 'RDV planifié', couleur: '#38bdf8' },
  { v: 'offre',       label: 'Offre envoyée', couleur: '#a78bfa' },
  { v: 'reconduit',   label: 'Reconduit',     couleur: '#4ade80', traite: true },
  { v: 'remplace',    label: 'Remplacé',      couleur: '#4ade80', traite: true },
  { v: 'resilie',     label: 'Résilié',       couleur: '#f87171', traite: true },
];

const RN_HORIZONS = [
  { id: 'echu',    label: 'Échus — à renouveler',            couleur: '#f87171' },
  { id: 'j30',     label: 'Délai de résiliation < 30 jours', couleur: '#f87171' },
  { id: 'j90',     label: 'Délai dans 1 à 3 mois',           couleur: '#f59e0b' },
  { id: 'm6',      label: 'Délai dans 3 à 6 mois',           couleur: '#38bdf8' },
  { id: 'm12',     label: 'Délai dans 6 à 12 mois',          couleur: '#64748b' },
  { id: 'depasse', label: 'Délai dépassé — reconduction probable', couleur: '#64748b' },
];

let rnFiltres = { horizon: '', compagnie: '', commission: '', masquerTraites: true, masquerLamal: false };

function rnEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function rnEstLamal(ct) {
  return (ct.produit || '').toLowerCase().includes('lamal');
}

function rnPreavis(ct) {
  if (ct.preavis_mois !== null && ct.preavis_mois !== undefined && ct.preavis_mois !== '') return Number(ct.preavis_mois);
  return rnEstLamal(ct) ? 1 : 3;
}

// Échéance − N mois, en restant sur le dernier jour du mois si besoin (31.12 − 3 mois = 30.09)
function rnDateLimite(ct) {
  if (!ct.date_echeance) return null;
  const [y, m, d] = ct.date_echeance.split('T')[0].split('-').map(Number);
  const cible = new Date(Date.UTC(y, m - 1 - rnPreavis(ct), 1));
  const dernierJour = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(d, dernierJour));
  return cible.toISOString().split('T')[0];
}

function rnJoursJusqua(iso) {
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - auj) / 86400000);
}

// Statut de revue valable seulement pour l'échéance en cours
function rnStatutRevue(ct) {
  if (ct.revue_statut && ct.revue_echeance && ct.date_echeance && ct.revue_echeance === ct.date_echeance.split('T')[0]) return ct.revue_statut;
  return 'a_contacter';
}

function rnHorizon(ct) {
  const aujIso = new Date().toISOString().split('T')[0];
  if (ct.statut === 'renouveler' || ct.date_echeance.split('T')[0] < aujIso) return 'echu';
  const jours = rnJoursJusqua(rnDateLimite(ct));
  if (jours < 0) return 'depasse';
  if (jours < 30) return 'j30';
  if (jours < 91) return 'j90';
  if (jours < 183) return 'm6';
  if (jours < 366) return 'm12';
  return null; // au-delà de 12 mois : hors échéancier
}

function rnNomClient(ct) {
  const c = allClients.find(cl => cl.id === ct.client_id);
  return c ? (estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`) : '—';
}

function rnTacheOuverte(ct) {
  return allRappels.find(r => r.contrat_id === ct.id && r.statut === 'ouvert' && (r.titre || '').startsWith('Revue échéance'));
}

// Tous les contrats de l'échéancier, avec leurs infos calculées (utilisé par la page ET le dashboard)
function rnContratsEcheancier() {
  return allContrats
    .filter(ct => ['actif', 'renouveler'].includes(ct.statut) && ct.date_echeance)
    .map(ct => ({ ct, limite: rnDateLimite(ct), horizon: rnHorizon(ct), revue: rnStatutRevue(ct) }))
    .filter(x => x.horizon);
}

function viewRenouvellements() {
  const compagnies = [...new Set(allContrats.filter(ct => ct.date_echeance).map(ct => ct.compagnie).filter(Boolean))].sort();
  setTimeout(renderRenouvellements, 0);
  return `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">Renouvellements</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Contrats classés par <strong>date limite de résiliation</strong> (échéance − préavis : 3 mois par défaut, 1 mois pour la LAMal). C'est cette date qui compte pour revoir un client ou reprendre une police.</div>
    <div id="rn-stats" class="stat-grid" style="margin-bottom:20px"></div>
    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;align-items:center">
      <select class="form-select" id="rn-horizon" style="max-width:260px" onchange="rnFiltres.horizon=this.value;renderRenouvellements()">
        <option value="">Tous les horizons</option>
        ${RN_HORIZONS.map(h => `<option value="${h.id}" ${rnFiltres.horizon === h.id ? 'selected' : ''}>${h.label}</option>`).join('')}
      </select>
      <select class="form-select" id="rn-compagnie" style="max-width:220px" onchange="rnFiltres.compagnie=this.value;renderRenouvellements()">
        <option value="">Toutes les compagnies</option>
        ${compagnies.map(c => `<option value="${rnEsc(c)}" ${rnFiltres.compagnie === c ? 'selected' : ''}>${rnEsc(c)}</option>`).join('')}
      </select>
      <select class="form-select" id="rn-commission" style="max-width:220px" onchange="rnFiltres.commission=this.value;renderRenouvellements()">
        <option value="">Commissionnés et non commissionnés</option>
        <option value="oui" ${rnFiltres.commission === 'oui' ? 'selected' : ''}>Commissionnés (à garder)</option>
        <option value="non" ${rnFiltres.commission === 'non' ? 'selected' : ''}>Non commissionnés (à reprendre)</option>
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-muted);cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px">
        <input type="checkbox" ${rnFiltres.masquerTraites ? 'checked' : ''} onchange="rnFiltres.masquerTraites=this.checked;renderRenouvellements()"/> Masquer les dossiers traités
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-muted);cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px">
        <input type="checkbox" ${rnFiltres.masquerLamal ? 'checked' : ''} onchange="rnFiltres.masquerLamal=this.checked;renderRenouvellements()"/> Masquer LAMal
      </label>
    </div>
    <div id="rn-liste"></div>`;
}

function renderRenouvellements() {
  const zoneStats = document.getElementById('rn-stats');
  const zoneListe = document.getElementById('rn-liste');
  if (!zoneStats || !zoneListe) return;

  const tous = rnContratsEcheancier();
  const filtres = tous.filter(({ ct, horizon, revue }) => {
    if (rnFiltres.horizon && horizon !== rnFiltres.horizon) return false;
    if (rnFiltres.compagnie && ct.compagnie !== rnFiltres.compagnie) return false;
    if (rnFiltres.commission === 'oui' && ct.commissionne === false) return false;
    if (rnFiltres.commission === 'non' && ct.commissionne !== false) return false;
    if (rnFiltres.masquerLamal && rnEstLamal(ct)) return false;
    if (rnFiltres.masquerTraites && RN_STATUTS.find(s => s.v === revue)?.traite) return false;
    return true;
  });

  const somme = list => list.reduce((s, x) => s + Number(x.ct.prime_annuelle || 0), 0);
  const aTraiter = tous.filter(x => !RN_STATUTS.find(s => s.v === x.revue)?.traite);
  const j30 = aTraiter.filter(x => x.horizon === 'j30');
  const j90 = aTraiter.filter(x => x.horizon === 'j90');
  const echus = aTraiter.filter(x => x.horizon === 'echu');
  const traites = tous.filter(x => RN_STATUTS.find(s => s.v === x.revue)?.traite && x.horizon !== 'depasse');
  zoneStats.innerHTML = `
    ${statCard('Délai < 30 jours', j30.length, j30.length ? '#f87171' : '#64748b', 'CHF ' + fmtCHF(Math.round(somme(j30))) + ' de primes')}
    ${statCard('Délai dans 1 à 3 mois', j90.length, '#f59e0b', 'CHF ' + fmtCHF(Math.round(somme(j90))) + ' de primes')}
    ${statCard('Échus à renouveler', echus.length, echus.length ? '#f87171' : '#64748b', 'CHF ' + fmtCHF(Math.round(somme(echus))) + ' de primes')}
    ${statCard('Dossiers traités', traites.length, '#4ade80', 'reconduits, remplacés ou résiliés')}`;

  if (!filtres.length) { zoneListe.innerHTML = '<div class="table-empty">Aucun contrat pour ces filtres.</div>'; return; }

  const cols = '1.3fr 1fr 110px 120px 110px 150px 120px';
  zoneListe.innerHTML = RN_HORIZONS.map(h => {
    const groupe = filtres.filter(x => x.horizon === h.id).sort((a, b) => (a.limite || '').localeCompare(b.limite || ''));
    if (!groupe.length) return '';
    return `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin:22px 0 10px">
        <div style="font-size:11px;font-weight:700;color:${h.couleur};text-transform:uppercase;letter-spacing:1px">${h.label} (${groupe.length})</div>
        <div style="font-size:12px;color:var(--text-muted)">CHF ${fmtCHF(Math.round(somme(groupe)))} de primes</div>
      </div>
      <div class="table-wrap">
        <div class="table-header" style="grid-template-columns:${cols}"><div>Client</div><div>Produit · compagnie</div><div>Échéance</div><div>Limite résiliation</div><div>Prime/an</div><div>Suivi</div><div></div></div>
        ${groupe.map(x => rnLigne(x, cols)).join('')}
      </div>`;
  }).join('');
}

function rnLigne({ ct, limite, horizon, revue }, cols) {
  const jours = limite ? rnJoursJusqua(limite) : null;
  const limiteTxt = !limite ? '—' : horizon === 'echu' ? fmtDate(limite)
    : jours < 0 ? `${fmtDate(limite)}<div style="font-size:10.5px;color:var(--text-muted)">dépassée</div>`
    : `${fmtDate(limite)}<div style="font-size:10.5px;color:${jours < 30 ? '#f87171' : 'var(--text-muted)'}">dans ${jours} j · préavis ${rnPreavis(ct)} mois</div>`;
  const tache = rnTacheOuverte(ct);
  return `<div class="table-row" style="grid-template-columns:${cols};align-items:center">
    <div>
      <a href="?client=${ct.client_id}" onclick="return irVersClient(event, '${ct.client_id}')" style="font-weight:700;font-size:13px;color:var(--text);text-decoration:none">${rnEsc(rnNomClient(ct))}</a>
      ${ct.commissionne === false ? `<div>${badge('Non commissionné — à reprendre', '#fb923c')}</div>` : ''}
    </div>
    <div style="cursor:pointer" onclick="showDetailContrat('${ct.id}')">
      <div style="font-size:13px;color:var(--text)">${rnEsc(ct.produit || '')}</div>
      <div style="font-size:11px;color:var(--text-muted)">${rnEsc(ct.compagnie || '')}${ct.numero_police ? ' · ' + rnEsc(ct.numero_police) : ''}</div>
    </div>
    <div style="font-size:12px;color:var(--text-muted)">${fmtDate(ct.date_echeance)}</div>
    <div style="font-size:12px;color:var(--text)">${limiteTxt}</div>
    <div style="font-weight:800;color:#f59e0b">CHF ${fmtCHF(Number(ct.prime_annuelle || 0))}</div>
    <div>
      <select class="form-select" aria-label="Suivi du renouvellement" style="padding:6px 8px;font-size:12px" onchange="rnChangerStatut('${ct.id}', this.value)">
        ${RN_STATUTS.map(s => `<option value="${s.v}" ${s.v === revue ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:6px;justify-content:flex-end">
      ${tache
        ? `<button type="button" onclick="showRappel('${tache.id}')" title="Une tâche de revue est déjà ouverte" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">✓ Tâche</button>`
        : `<button type="button" onclick="rnCreerTache('${ct.id}')" title="Crée une tâche de revue avant la date limite" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">+ Tâche</button>`}
      ${horizon === 'echu' ? `<button type="button" onclick="reporterRenouvellementContrat('${ct.id}')" title="Échéance +1 an, contrat repasse actif" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">↻ +1 an</button>` : ''}
    </div>
  </div>`;
}

async function rnChangerStatut(contratId, statut) {
  const ct = allContrats.find(c => c.id === contratId);
  if (!ct) return;
  const maj = { revue_statut: statut, revue_echeance: ct.date_echeance.split('T')[0], revue_maj: new Date().toISOString() };
  const r = await dbPatch('contrats', contratId, maj);
  if (r && r.error) { showError('Suivi non enregistré : ' + errMsg(r)); renderRenouvellements(); return; }
  Object.assign(ct, maj);
  logAction('revue_renouvellement', 'contrats', contratId, `${statut} (échéance ${fmtDate(ct.date_echeance)})`);
  renderRenouvellements();
}

async function rnCreerTache(contratId) {
  const ct = allContrats.find(c => c.id === contratId);
  if (!ct) return;
  const limite = rnDateLimite(ct);
  const aujIso = new Date().toISOString().split('T')[0];
  // Échéance de la tâche : 2 semaines avant la date limite, jamais dans le passé
  let echeanceTache = aujIso;
  if (limite && rnJoursJusqua(limite) > 14) {
    const [y, m, d] = limite.split('-').map(Number);
    echeanceTache = new Date(Date.UTC(y, m - 1, d - 14)).toISOString().split('T')[0];
  }
  const joursLimite = limite ? rnJoursJusqua(limite) : null;
  const nomClient = rnNomClient(ct);
  const body = {
    titre: `Revue échéance — ${ct.produit || 'contrat'} (${ct.compagnie || '—'})`,
    client_id: ct.client_id,
    contrat_id: ct.id,
    type: 'Contrat',
    nature: 'rappel',
    urgence: joursLimite !== null && joursLimite < 30 ? 'haute' : joursLimite !== null && joursLimite < 91 ? 'moyenne' : 'basse',
    date_echeance: echeanceTache,
    statut: 'ouvert',
    notes: `${nomClient} — ${ct.produit || ''} chez ${ct.compagnie || ''}${ct.numero_police ? ' (police ' + ct.numero_police + ')' : ''}.\n`
      + `Échéance le ${fmtDate(ct.date_echeance)}, date limite de résiliation le ${limite ? fmtDate(limite) : '—'} (préavis ${rnPreavis(ct)} mois).\n`
      + (ct.commissionne === false
        ? 'Police non commissionnée : proposer un transfert vers une compagnie partenaire avant la date limite.'
        : 'Revoir la couverture et la prime avec le client avant la date limite.'),
  };
  const r = await dbPost('rappels', body);
  if (r && r.error) { showError('Tâche non créée : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  logAction('tache_renouvellement', 'contrats', contratId, `Tâche de revue pour le ${fmtDate(echeanceTache)}`);
  showError(`✓ Tâche de revue créée pour le ${fmtDate(echeanceTache)}.`);
  renderRenouvellements();
}

// Carte compacte pour le tableau de bord
function carteRenouvellementsDashboard() {
  const aTraiter = rnContratsEcheancier().filter(x => !RN_STATUTS.find(s => s.v === x.revue)?.traite);
  if (!aTraiter.length) return '';
  const somme = list => list.reduce((s, x) => s + Number(x.ct.prime_annuelle || 0), 0);
  const lignes = [
    { h: 'j30', label: 'Délai de résiliation < 30 jours' },
    { h: 'j90', label: 'Délai dans 1 à 3 mois' },
    { h: 'm6', label: 'Délai dans 3 à 6 mois' },
    { h: 'echu', label: 'Échus à renouveler' },
  ].map(l => ({ ...l, list: aTraiter.filter(x => x.horizon === l.h), couleur: RN_HORIZONS.find(h => h.id === l.h).couleur }))
   .filter(l => l.list.length);
  const prochaine = aTraiter.filter(x => x.horizon === 'j30' || x.horizon === 'j90').sort((a, b) => a.limite.localeCompare(b.limite))[0];
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <div style="font-size:13px;font-weight:800;color:var(--text)">🔁 Renouvellements à traiter</div>
        <div style="font-size:18px;font-weight:900;color:var(--text)">${aTraiter.filter(x => x.horizon !== 'depasse').length}</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:14px">${prochaine ? `Prochaine date limite de résiliation : <strong style="color:var(--text)">${fmtDate(prochaine.limite)}</strong> (dans ${rnJoursJusqua(prochaine.limite)} j)` : 'Classés par date limite de résiliation'}</div>
      ${lignes.map(l => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="rnFiltres.horizon='${l.h}';navigate('renouvellements')">
        <span style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text)"><span style="width:8px;height:8px;border-radius:2px;background:${l.couleur}"></span>${l.label}</span>
        <span style="font-size:12.5px;color:var(--text-muted)"><strong style="color:var(--text)">${l.list.length}</strong> · CHF ${fmtCHF(Math.round(somme(l.list)))}</span>
      </div>`).join('')}
      <div style="margin-top:14px;text-align:right">
        <button onclick="rnFiltres.horizon='';navigate('renouvellements')" style="background:none;border:none;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer">Ouvrir l'échéancier →</button>
      </div>
    </div>`;
}
