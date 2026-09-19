// ═══ RENOUVELLEMENTS — échéancier par date limite de résiliation (ajouté le 19.09.2026) ═══════
// Classe les contrats selon la DATE LIMITE DE RÉSILIATION (échéance − préavis), pas selon
// l'échéance elle-même : pour une échéance au 31.12 avec 3 mois de préavis, c'est le 30.09 qui
// compte — que ce soit pour garder le client (revue avant qu'il ne soit démarché) ou pour
// reprendre une police non commissionnée (transfert).
//
// Colonnes utilisées sur contrats (migration 20260919_contrats_suivi_renouvellement) :
//   preavis_mois   — null = défaut (3 mois, 1 mois pour la LAMal)
//   revue_statut   — a_contacter / relance / rdv / offre / reconduit / remplace / resilie
//   revue_echeance — l'échéance à laquelle se rapporte revue_statut : si date_echeance change
//                    (contrat reconduit, nouvelle police), le suivi repart automatiquement à zéro.

const RN_STATUTS = [
  { v: 'a_contacter', label: 'À contacter', couleur: '#94a3b8' },
  { v: 'relance',     label: 'Relancé',     couleur: '#fbbf24' },
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

// Échéance à prendre en compte. La LAMal se renouvelle d'office chaque année : une échéance
// passée (ex. 31.12.2025 restée en base) est ramenée à la prochaine échéance annuelle.
function rnEcheance(ct) {
  if (!ct.date_echeance) return null;
  const iso = ct.date_echeance.split('T')[0];
  if (!rnEstLamal(ct)) return iso;
  const aujIso = new Date().toISOString().split('T')[0];
  let [y, m, d] = iso.split('-').map(Number);
  const fmt = an => {
    const dernier = new Date(Date.UTC(an, m, 0)).getUTCDate();
    return `${an}-${String(m).padStart(2, '0')}-${String(Math.min(d, dernier)).padStart(2, '0')}`;
  };
  while (fmt(y) < aujIso) y++;
  return fmt(y);
}

// Échéance − N mois, en restant sur le dernier jour du mois si besoin (31.12 − 3 mois = 30.09)
function rnDateLimite(ct) {
  const echeance = rnEcheance(ct);
  if (!echeance) return null;
  const [y, m, d] = echeance.split('-').map(Number);
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
  if (ct.revue_statut && ct.revue_echeance && ct.date_echeance && ct.revue_echeance === rnEcheance(ct)) return ct.revue_statut;
  return 'a_contacter';
}

function rnHorizon(ct) {
  const aujIso = new Date().toISOString().split('T')[0];
  if (!rnEstLamal(ct) && (ct.statut === 'renouveler' || rnEcheance(ct) < aujIso)) return 'echu';
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
  const compagnies = [...new Set(allContrats.filter(ct => ct.date_echeance).map(ct => normaliserCompagnie(ct.compagnie)).filter(Boolean))].sort();
  setTimeout(renderRenouvellements, 0);
  return `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">Renouvellements</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Contrats classés par <strong>date limite de résiliation</strong> (échéance − préavis : 3 mois par défaut, 1 mois pour la LAMal). C'est cette date qui compte pour revoir un client ou reprendre une police.</div>
    <div id="rn-stats" class="stat-grid" style="margin-bottom:20px"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:10px;padding:10px 16px;margin-bottom:18px">
      <span style="font-size:12.5px;color:var(--text)">🩺 LAMal : relance chaque client avec son lien de prise de RDV, depuis une page dédiée.</span>
      <button type="button" onclick="navigate('relances-lamal')" style="background:none;border:none;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">Relances LAMal →</button>
    </div>
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
    if (rnFiltres.compagnie && !memeCompagnie(ct.compagnie, rnFiltres.compagnie)) return false;
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
    <div style="font-size:12px;color:var(--text-muted)">${fmtDate(rnEcheance(ct))}</div>
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
  const maj = { revue_statut: statut, revue_echeance: rnEcheance(ct), revue_maj: new Date().toISOString() };
  const r = await dbPatch('contrats', contratId, maj);
  if (r && r.error) { showError('Suivi non enregistré : ' + errMsg(r)); rnRafraichir(); return false; }
  Object.assign(ct, maj);
  logAction('revue_renouvellement', 'contrats', contratId, `${statut} (échéance ${fmtDate(maj.revue_echeance)})`);
  rnRafraichir();
  return true;
}

function rnRafraichir() {
  if (document.getElementById('rn-liste')) renderRenouvellements();
  if (document.getElementById('rl-liste')) renderRelancesLamal();
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
      + `Échéance le ${fmtDate(rnEcheance(ct))}, date limite de résiliation le ${limite ? fmtDate(limite) : '—'} (préavis ${rnPreavis(ct)} mois).\n`
      + (ct.commissionne === false
        ? 'Police non commissionnée : proposer un transfert vers une compagnie partenaire avant la date limite.'
        : 'Revoir la couverture et la prime avec le client avant la date limite.'),
  };
  const r = await dbPost('rappels', body);
  if (r && r.error) { showError('Tâche non créée : ' + errMsg(r)); return; }
  allRappels = await dbGet('rappels', 'select=*');
  logAction('tache_renouvellement', 'contrats', contratId, `Tâche de revue pour le ${fmtDate(echeanceTache)}`);
  showError(`✓ Tâche de revue créée pour le ${fmtDate(echeanceTache)}.`);
  rnRafraichir();
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

// ═══ RELANCES LAMAL — la LAMal comme levier de prise de RDV (ajouté le 19.09.2026) ══════════════
// Chaque automne, les nouvelles primes LAMal sont une raison naturelle de recontacter un client.
// Cette page liste les clients ayant une LAMal (une ligne par client), avec un message prêt à
// envoyer par e-mail (Outlook) ou WhatsApp contenant le lien de réservation en ligne personnalisé
// (?rdv=<token agent>&client=<id>, le client n'a pas à ressaisir ses coordonnées).
// Suivi : À contacter → Relancé (automatique à l'envoi) → RDV planifié (automatique si un RDV
// futur existe pour le client, ou à la main). Relance manuelle, un client à la fois.

let rlFiltre = 'a_relancer';
const RL_CLE_MODELE = 'rn_modele_relance_lamal';

function rlModeleParDefaut() {
  const annee = new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  return `Bonjour {prenom},\n\nLes primes d'assurance maladie ${annee} sont publiées cet automne. C'est le bon moment pour vérifier que votre caisse maladie, votre modèle et votre franchise sont toujours les plus avantageux pour vous — un éventuel changement doit être annoncé avant le {date_limite}.\n\nJe vous propose un court rendez-vous (15 à 20 minutes) pour faire le point ensemble. Vous pouvez choisir directement le créneau qui vous convient ici :\n{lien_rdv}\n\nMeilleures salutations,\n{conseiller}\nAssurex Sàrl`;
}

function rlModele() {
  try { return localStorage.getItem(RL_CLE_MODELE) || rlModeleParDefaut(); } catch (e) { return rlModeleParDefaut(); }
}

function rlSauverModele(txt) {
  try { localStorage.setItem(RL_CLE_MODELE, txt); } catch (e) {}
}

function rlReinitialiserModele() {
  try { localStorage.removeItem(RL_CLE_MODELE); } catch (e) {}
  const zone = document.getElementById('rl-modele');
  if (zone) zone.value = rlModeleParDefaut();
}

// E-mail utilisable pour écrire au client : format valide et pas une adresse interne du cabinet
// (certaines fiches portent « inconnu » ou l'adresse d'un collaborateur faute de mieux).
function rlEmailClient(c) {
  const e = (c && c.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  if (/@(cofidex|assurex)\.ch$/i.test(e)) return null;
  return e;
}

function rlLienRdv(clientId) {
  const moi = (typeof allAgents !== 'undefined' ? allAgents : []).find(a => a.email === (currentUser && currentUser.email) && a.rdv_actif && a.rdv_token)
    || (typeof allAgents !== 'undefined' ? allAgents : []).find(a => a.rdv_actif && a.rdv_token);
  let base;
  if (moi) base = `${window.location.origin}${window.location.pathname}?rdv=${moi.rdv_token}`;
  else if (typeof LIEN_RESERVATION_RDV !== 'undefined') base = LIEN_RESERVATION_RDV;
  else return '';
  return `${base}&client=${clientId}`;
}

// Une ligne par client : ses contrats LAMal, le statut le moins avancé, son prochain RDV
function rlClientsLamal() {
  const parClient = new Map();
  for (const ct of allContrats) {
    if (!rnEstLamal(ct) || !['actif', 'renouveler'].includes(ct.statut) || !ct.client_id) continue;
    if (!parClient.has(ct.client_id)) parClient.set(ct.client_id, []);
    parClient.get(ct.client_id).push(ct);
  }
  const ordre = RN_STATUTS.map(s => s.v);
  const maintenant = new Date();
  return [...parClient.entries()].map(([clientId, contrats]) => {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return null;
    const statuts = contrats.map(rnStatutRevue);
    const statut = statuts.sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b))[0];
    const rdv = (typeof allRendezVous !== 'undefined' ? allRendezVous : [])
      .filter(r => r.client_id === clientId && r.statut !== 'annule' && new Date(r.date_heure) >= maintenant)
      .sort((a, b) => new Date(a.date_heure) - new Date(b.date_heure))[0] || null;
    const limite = contrats.map(rnDateLimite).filter(Boolean).sort()[0] || null;
    return { client, contrats, statut: rdv && ['a_contacter', 'relance'].includes(statut) ? 'rdv' : statut, rdv, limite,
      prime: contrats.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0) };
  }).filter(Boolean);
}

function rlMessage(x) {
  const prenom = estEntreprise(x.client) ? '' : (x.client.prenom || '');
  return rlModele()
    .replace(/\{prenom\}/g, prenom)
    .replace(/\{date_limite\}/g, x.limite ? fmtDate(x.limite) : '30 novembre')
    .replace(/\{lien_rdv\}/g, rlLienRdv(x.client.id))
    .replace(/\{conseiller\}/g, (currentUser && currentUser.prenom) || '')
    .replace(/Bonjour ,/g, 'Bonjour,');
}

function viewRelancesLamal() {
  setTimeout(renderRelancesLamal, 0);
  return `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">Relances LAMal</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Les nouvelles primes LAMal sont une occasion de recontacter chaque client et de lui proposer un rendez-vous. Le message contient son lien de réservation personnel. Date limite de changement : 30.11 (préavis 1 mois).</div>
    <div id="rl-stats" class="stat-grid" style="margin-bottom:20px"></div>
    <details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:18px">
      <summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--text)">✏️ Modèle du message</summary>
      <div style="font-size:11.5px;color:var(--text-muted);margin:10px 0 8px">Variables : {prenom} · {date_limite} · {lien_rdv} · {conseiller}. Le modèle est gardé sur cet ordinateur.</div>
      <textarea id="rl-modele" class="form-input" rows="11" style="width:100%;font-family:inherit;font-size:12.5px;line-height:1.5" oninput="rlSauverModele(this.value)">${rnEsc(rlModele())}</textarea>
      <div style="margin-top:8px;text-align:right"><button type="button" class="btn-secondary" onclick="rlReinitialiserModele()">Revenir au modèle par défaut</button></div>
    </details>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      ${[['a_relancer', 'À relancer'], ['relance', 'Relancés, sans RDV'], ['rdv', 'RDV planifié'], ['tous', 'Tous']].map(([v, l]) =>
        `<button type="button" onclick="rlFiltre='${v}';renderRelancesLamal()" class="${rlFiltre === v ? 'btn-save' : 'btn-secondary'}" style="padding:7px 14px;font-size:12px">${l}</button>`).join('')}
    </div>
    <div id="rl-liste"></div>`;
}

function renderRelancesLamal() {
  const zoneStats = document.getElementById('rl-stats');
  const zoneListe = document.getElementById('rl-liste');
  if (!zoneStats || !zoneListe) return;
  const tous = rlClientsLamal();
  const aRelancer = tous.filter(x => x.statut === 'a_contacter');
  const relances = tous.filter(x => x.statut === 'relance');
  const rdv = tous.filter(x => x.statut === 'rdv');
  zoneStats.innerHTML = `
    ${statCard('Clients LAMal', tous.length, '#38bdf8', `${tous.reduce((s, x) => s + x.contrats.length, 0)} contrats`)}
    ${statCard('À relancer', aRelancer.length, aRelancer.length ? '#f59e0b' : '#64748b')}
    ${statCard('Relancés, sans RDV', relances.length, '#fbbf24')}
    ${statCard('RDV planifiés', rdv.length, '#4ade80', tous.length ? Math.round(rdv.length / tous.length * 100) + ' % des clients' : '')}`;

  const liste = (rlFiltre === 'a_relancer' ? aRelancer : rlFiltre === 'relance' ? relances : rlFiltre === 'rdv' ? rdv : tous)
    .sort((a, b) => `${a.client.nom} ${a.client.prenom}`.localeCompare(`${b.client.nom} ${b.client.prenom}`));
  if (!liste.length) { zoneListe.innerHTML = '<div class="table-empty">Aucun client dans cette liste.</div>'; return; }

  const cols = '1.3fr 1.2fr 110px 150px 260px';
  zoneListe.innerHTML = `<div class="table-wrap">
    <div class="table-header" style="grid-template-columns:${cols}"><div>Client</div><div>Caisse · contact</div><div>Prime/an</div><div>Suivi</div><div></div></div>
    ${liste.map(x => {
      const c = x.client;
      const nom = estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
      const caisses = [...new Set(x.contrats.map(ct => ct.compagnie).filter(Boolean))].join(', ');
      const statutInfo = RN_STATUTS.find(s => s.v === x.statut) || RN_STATUTS[0];
      return `<div class="table-row" style="grid-template-columns:${cols};align-items:center">
        <div><a href="?client=${c.id}" onclick="return irVersClient(event, '${c.id}')" style="font-weight:700;font-size:13px;color:var(--text);text-decoration:none">${rnEsc(nom)}</a>
          ${x.contrats.length > 1 ? `<div style="font-size:11px;color:var(--text-muted)">${x.contrats.length} contrats LAMal</div>` : ''}</div>
        <div><div style="font-size:12.5px;color:var(--text)">${rnEsc(caisses || '—')}</div>
          <div style="font-size:11px;color:var(--text-muted)">${rnEsc(rlEmailClient(c) || (c.email ? 'e-mail non utilisable (' + c.email + ')' : 'pas d\u2019e-mail'))} · ${rnEsc(c.mobile || c.tel || 'pas de mobile')}</div></div>
        <div style="font-weight:800;color:#f59e0b">CHF ${fmtCHF(Math.round(x.prime))}</div>
        <div>${badge(statutInfo.label, statutInfo.couleur)}${x.rdv ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">📅 ${fmtDate(x.rdv.date_heure)}</div>` : ''}</div>
        <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
          ${rlEmailClient(c) ? `<button type="button" onclick="rlEnvoyerEmail('${c.id}', this)" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">✉️ E-mail</button>` : ''}
          ${(c.mobile || c.tel) ? `<button type="button" onclick="rlOuvrirWhatsapp('${c.id}')" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">📲 WhatsApp</button>` : ''}
          <button type="button" onclick="rlCopier('${c.id}')" title="Copier le message" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">📋</button>
          ${x.statut !== 'rdv' ? `<button type="button" onclick="rlMarquer('${c.id}', 'rdv')" title="Le client a pris RDV (téléphone, etc.)" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">✓ RDV</button>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// Passe tous les contrats LAMal du client au statut donné (sans jamais faire reculer un dossier)
async function rlMarquer(clientId, statut) {
  const x = rlClientsLamal().find(y => y.client.id === clientId);
  if (!x) return;
  const ordre = RN_STATUTS.map(s => s.v);
  let echecs = 0;
  for (const ct of x.contrats) {
    if (ordre.indexOf(rnStatutRevue(ct)) >= ordre.indexOf(statut)) continue;
    const maj = { revue_statut: statut, revue_echeance: rnEcheance(ct), revue_maj: new Date().toISOString() };
    const r = await dbPatch('contrats', ct.id, maj);
    if (r && r.error) { echecs++; continue; }
    Object.assign(ct, maj);
  }
  if (echecs) showError(`Suivi non enregistré pour ${echecs} contrat(s) — réessaie.`);
  logAction('relance_lamal', 'clients', clientId, statut);
  rnRafraichir();
}

async function rlEnvoyerEmail(clientId, btn) {
  const x = rlClientsLamal().find(y => y.client.id === clientId);
  const destinataire = x && rlEmailClient(x.client);
  if (!destinataire) return;
  if (!(await assurerTokenOutlook())) { showError('Connecte-toi à Outlook (Microsoft) dans le CRM pour envoyer cet e-mail.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  const annee = new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: `Votre assurance maladie ${annee} — faisons le point`,
          body: { contentType: 'text', content: rlMessage(x) },
          toRecipients: [{ emailAddress: { address: destinataire } }],
        },
        saveToSentItems: true,
      }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  } catch (e) {
    console.error('rlEnvoyerEmail', e);
    showError('L\u2019e-mail n\u2019est pas parti — réessaie ou utilise 📋 pour copier le message.');
    if (btn) { btn.disabled = false; btn.textContent = '✉️ E-mail'; }
    return;
  }
  showError(`✓ E-mail envoyé à ${destinataire}.`);
  await rlMarquer(clientId, 'relance');
}

function rlOuvrirWhatsapp(clientId) {
  const x = rlClientsLamal().find(y => y.client.id === clientId);
  if (!x) return;
  let tel = (x.client.mobile || x.client.tel || '').replace(/[^\d]/g, '');
  if (tel.startsWith('00')) tel = tel.slice(2);
  if (tel.startsWith('0')) tel = '41' + tel.slice(1);
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(rlMessage(x))}`, '_blank', 'noopener');
  rlMarquer(clientId, 'relance');
}

async function rlCopier(clientId) {
  const x = rlClientsLamal().find(y => y.client.id === clientId);
  if (!x) return;
  try { await navigator.clipboard.writeText(rlMessage(x)); showError('✓ Message copié.'); }
  catch (e) { showError('Copie impossible dans ce navigateur.'); }
}
