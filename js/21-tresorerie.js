// ═══ PLAN DE TRÉSORERIE (19.09.2026) ══════════════════════════════════════════════════════════
// Projection mois par mois : solde bancaire de départ + encaissements attendus − charges.
// Encaissements calculés automatiquement depuis le CRM :
//   - commissions de GESTION en attente → date prévue (règle js/19 : 3 mois après signature,
//     HOTELA / Gastrosocial 1× par an) ;
//   - commissions d'ACQUISITION en attente → date de création + délai moyen de paiement observé
//     (à défaut 60 jours) ;
//   - en option, le pipeline pondéré (commission estimée × probabilité, 3 mois après l'échéance).
// Charges, autres encaissements et solde de départ : saisis ici, table tresorerie_lignes.
// Une commission attendue dont la date est dépassée est comptée dans le mois en cours (à relancer).

let _tr = { lignes: [], horizon: 12, pipeline: false, charge: false, edition: null };
const TR_CATEGORIES_SORTIE = ['Salaires & charges sociales', 'Parts apporteurs', 'Frais de déplacement & repas', 'Frais de représentation', 'Véhicule', 'Téléphone & internet', 'Informatique & abonnements', 'Loyer', 'Assurances', 'Formation & cotisations', 'Frais bancaires', 'Marketing', 'Impôts & TVA', 'Autres frais'];
const TR_CATEGORIES_ENTREE = ['Honoraires', 'Commissions hors CRM', 'Apport / prêt', 'Autres encaissements'];
const TR_FREQUENCES = [['mensuel', 'Chaque mois', 1], ['trimestriel', 'Chaque trimestre', 3], ['semestriel', 'Chaque semestre', 6], ['annuel', 'Chaque année', 12], ['unique', 'Une seule fois', 0]];
const TR_MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function trEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function trIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function trMoisCle(iso) { return (iso || '').slice(0, 7); }
function trLibelleMois(cle) { const [y, m] = cle.split('-').map(Number); return `${TR_MOIS[m - 1]} ${String(y).slice(2)}`; }
function trCHF(n) { const v = Math.round(n || 0); return (v < 0 ? '−' : '') + fmtCHF(Math.abs(v)); }

function viewTresorerie() {
  setTimeout(chargerTresorerie, 0);
  return `<div class="dbx tr">
    <header class="tr-entete">
      <div>
        <h2 class="tr-titre">Plan de trésorerie</h2>
        <p class="tr-sous">Solde bancaire + commissions attendues − charges, mois par mois. Les commissions sont reprises automatiquement du CRM ; les charges se saisissent une fois et se répètent seules.</p>
      </div>
    </header>
    <div id="tr-contenu"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
  </div>`;
}

async function chargerTresorerie() {
  const r = await dbGet('tresorerie_lignes', 'actif=eq.true&select=*&order=date_debut.asc');
  _tr.lignes = Array.isArray(r) ? r : [];
  _tr.charge = true;
  renderTresorerie();
}

// Délai moyen (jours) entre la création d'une commission et sa réception, sur l'historique réel
function trDelaiMoyenAcquisition() {
  const d = allCommissionsAttente.filter(ca => ca.statut === 'reçue' && ca.date_creation && ca.date_reception && (ca.nature || 'acquisition') !== 'gestion')
    .map(ca => (new Date(ca.date_reception) - new Date(ca.date_creation)) / 86400000).filter(j => j >= 0 && j < 400);
  return d.length >= 3 ? Math.round(d.reduce((s, j) => s + j, 0) / d.length) : 60;
}

// Incertitude des commissions : écart médian |réel − estimé| / estimé sur les commissions déjà
// encaissées (Assurex ou OZ) ; à défaut de 5 comparaisons, 20 % par prudence.
function trIncertitude() {
  const e = allCommissionsAttente.filter(ca => ['reçue', 'versé_oz'].includes(ca.statut) && ca.montant_final != null && Number(ca.montant_estime) > 0 && Number(ca.montant_final) > 0)
    .map(ca => Math.abs(Number(ca.montant_final) - Number(ca.montant_estime)) / Number(ca.montant_estime)).sort((a, b) => a - b);
  if (e.length < 5) return { taux: 0.2, n: e.length };
  const med = e.length % 2 ? e[(e.length - 1) / 2] : (e[e.length / 2 - 1] + e[e.length / 2]) / 2;
  return { taux: Math.min(0.5, Math.max(0.05, med)), n: e.length };
}

function trCalculer() {
  const auj = new Date();
  const aujIso = trIso(auj);
  const mois = [];
  for (let i = 0; i < _tr.horizon; i++) mois.push(trIso(new Date(auj.getFullYear(), auj.getMonth() + i, 1)).slice(0, 7));
  const premier = mois[0], dernier = mois[mois.length - 1];
  const vide = () => Object.fromEntries(mois.map(m => [m, 0]));
  const res = { mois, gestion: vide(), acquisition: vide(), pipeline: vide(), entrees: [], sorties: [], retard: { total: 0, nb: 0 }, oz: { total: 0, nb: 0 }, delaiAcq: trDelaiMoyenAcquisition() };

  // Place un montant dans son mois (un mois passé = mois en cours ; au-delà de l'horizon = ignoré)
  const placer = (serie, iso, montant) => {
    let cle = trMoisCle(iso);
    if (!cle || cle < premier) cle = premier;
    if (cle > dernier) return false;
    serie[cle] += montant;
    return true;
  };

  // 1. Commissions en attente (hors contrats annulés / non commissionnés)
  allCommissionsAttente.filter(ca => typeof commissionAttendue === 'function' ? commissionAttendue(ca) : ca.statut === 'en_attente').forEach(ca => {
    const ct = ca.contrat_id ? allContrats.find(x => x.id === ca.contrat_id) : null;
    if (ct && (ct.commissionne === false || ct.statut === 'annulé')) return;
    const montant = typeof commissionResteAttendu === 'function' ? commissionResteAttendu(ca) : Number(ca.montant_estime || 0); // reste après versements partiels
    if (!montant) return;
    let date = typeof commissionDatePrevue === 'function' ? commissionDatePrevue(ca) : null;
    const gestion = ca.nature === 'gestion';
    if (!date) {
      // Assurance prénatale : on part de la naissance prévue, pas de la saisie du contrat (19.09.2026)
      const naiss = typeof commissionDateNaissancePrevue === 'function' ? commissionDateNaissancePrevue(ca) : null;
      const base = new Date((naiss || ca.date_creation || aujIso) + 'T00:00:00');
      base.setDate(base.getDate() + res.delaiAcq);
      date = trIso(base);
    }
    // Gestion d'un client OZ attendue avant le 01.01.2027 : encaissée par OZ, hors trésorerie Assurex
    if (typeof commissionGestionEncaisseeParOZ === 'function' && commissionGestionEncaisseeParOZ(ca, date)) { res.oz.total += montant; res.oz.nb++; return; }
    // Gestion d'une prime fractionnée (semestre, trimestre, mois) : un versement par paiement du client
    const parts = gestion && typeof commissionEcheancier === 'function' ? commissionEcheancier(ca, montant) : [{ date, montant }];
    parts.forEach(pt => {
      if (pt.date < aujIso) { res.retard.total += pt.montant; res.retard.nb++; }
      placer(gestion ? res.gestion : res.acquisition, pt.date, pt.montant);
    });
  });

  // 1b. Gestion récurrente des années suivantes (projection, rien n'est enregistré) — js/19
  res.recurrente = vide(); res.recurrenteNb = 0;
  if (typeof projectionGestionRecurrente === 'function') {
    projectionGestionRecurrente(dernier + '-31').forEach(p => { if (placer(res.recurrente, p.date, p.montant)) res.recurrenteNb++; });
  }

  // 2. Pipeline pondéré (option) : commission estimée × probabilité, 3 mois après l'échéance
  if (_tr.pipeline) {
    allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu').forEach(o => {
      const m = Number(o.commission_estimee || 0) * Number(o.probabilite || 0) / 100;
      if (!m) return;
      const d = new Date(((o.date_echeance || aujIso).slice(0, 10)) + 'T00:00:00');
      d.setMonth(d.getMonth() + 3);
      placer(res.pipeline, trIso(d), m);
    });
  }

  // 3. Lignes saisies (charges / autres encaissements), répétées selon leur fréquence
  _tr.lignes.filter(l => l.type !== 'solde').forEach(l => {
    const serie = vide();
    const pas = (TR_FREQUENCES.find(f => f[0] === l.frequence) || [0, 0, 1])[2];
    const debut = new Date(l.date_debut + 'T00:00:00');
    const fin = l.date_fin ? trMoisCle(l.date_fin) : null;
    for (let i = 0; i < 400; i++) {
      const d = new Date(debut.getFullYear(), debut.getMonth() + i * (pas || 1), 1);
      const cle = trIso(d).slice(0, 7);
      if (cle > dernier || (fin && cle > fin)) break;
      if (cle >= premier) serie[cle] += Number(l.montant || 0);
      if (!pas) break;
    }
    (l.type === 'entree' ? res.entrees : res.sorties).push({ ligne: l, serie });
  });

  // 4. Solde de départ = dernier solde saisi
  const soldes = _tr.lignes.filter(l => l.type === 'solde').sort((a, b) => (b.date_debut || '').localeCompare(a.date_debut || '') || (b.created_at || '').localeCompare(a.created_at || ''));
  res.solde = soldes[0] || null;

  // Totaux mensuels et solde cumulé — avec une FOURCHETTE (19.09.2026) : les commissions attendues
  // sont des estimations ; l'écart médian réel / estimé mesuré dans le CRM (trIncertitude) donne
  // un solde bas (commissions − x %) et un solde haut (+ x %). Les charges saisies restent fixes.
  const inc = trIncertitude();
  res.incertitude = inc;
  let courant = res.solde ? Number(res.solde.montant || 0) : 0;
  let bas = courant, haut = courant;
  res.parMois = mois.map(m => {
    const commissions = res.gestion[m] + res.recurrente[m] + res.acquisition[m] + res.pipeline[m];
    const entrees = commissions + res.entrees.reduce((s, x) => s + x.serie[m], 0);
    const sorties = res.sorties.reduce((s, x) => s + x.serie[m], 0);
    const debut = courant;
    courant += entrees - sorties;
    bas += entrees - commissions * inc.taux - sorties;
    haut += entrees + commissions * inc.taux - sorties;
    return { m, debut, entrees, sorties, net: entrees - sorties, fin: courant, finBas: bas, finHaut: haut };
  });
  res.totalEntrees = res.parMois.reduce((s, x) => s + x.entrees, 0);
  res.totalSorties = res.parMois.reduce((s, x) => s + x.sorties, 0);
  res.plusBas = res.parMois.reduce((min, x) => (!min || x.fin < min.fin ? x : min), null);
  // Réalisé : moyenne des commissions reçues sur les 3 derniers mois complets
  const trois = [1, 2, 3].map(i => trIso(new Date(auj.getFullYear(), auj.getMonth() - i, 1)).slice(0, 7));
  const recu = allCommissionsAttente.filter(ca => ca.statut === 'reçue' || ca.statut === 'extourné').reduce((s, ca) => {
    const d = typeof commissionDateReception === 'function' ? commissionDateReception(ca) : ca.date_reception;
    if (!d || !trois.includes(d.slice(0, 7))) return s;
    return s + (ca.statut === 'extourné' ? -1 : 1) * Number(ca.montant_final != null ? ca.montant_final : (ca.montant_estime || 0));
  }, 0);
  res.moyenneRecue3 = recu / 3;
  return res;
}

function renderTresorerie() {
  const zone = document.getElementById('tr-contenu');
  if (!zone) return;
  const R = trCalculer();
  const fin = R.parMois[R.parMois.length - 1];
  const soldeTxt = R.solde ? `au ${fmtDate(R.solde.date_debut)}` : 'à renseigner';

  const kpi = (label, valeur, sous, ton, i) => `<div class="dbx-kpi tr-kpi ${ton || ''}" style="--i:${i}">
    <span class="dbx-kpi-label">${label}</span><span class="dbx-kpi-valeur">${valeur}</span><span class="dbx-kpi-sous">${sous}</span></div>`;

  zone.innerHTML = `
    <div class="dbx-kpis">
      ${kpi('Solde bancaire de départ', R.solde ? 'CHF ' + trCHF(R.solde.montant) : '—', `${soldeTxt} · <button type="button" class="dbx-lien" onclick="trOuvrirSolde()">${R.solde ? 'mettre à jour' : 'saisir'}</button>`, R.solde ? '' : 'alerte', 1)}
      ${kpi(`Encaissements attendus · ${_tr.horizon} mois`, 'CHF ' + trCHF(R.totalEntrees), R.retard.nb ? `<span class="fcx-rouge">dont CHF ${trCHF(R.retard.total)} en retard (${R.retard.nb})</span>` : `réalisé récent ≈ CHF ${trCHF(R.moyenneRecue3)}/mois`, '', 2)}
      ${kpi(`Charges · ${_tr.horizon} mois`, 'CHF ' + trCHF(R.totalSorties), R.sorties.length ? `${R.sorties.length} poste(s) de charges` : '<button type="button" class="dbx-lien" onclick="trOuvrirLigne(\'sortie\')">ajouter vos charges</button>', '', 3)}
      ${kpi(`Solde fin ${trLibelleMois(fin.m)}`, 'CHF ' + trCHF(fin.fin), `${R.plusBas && R.plusBas.fin < 0 ? `<span class="fcx-rouge">⚠ négatif en ${trLibelleMois(R.plusBas.m)} (CHF ${trCHF(R.plusBas.fin)})</span>` : `point bas : CHF ${trCHF(R.plusBas ? R.plusBas.fin : 0)} (${R.plusBas ? trLibelleMois(R.plusBas.m) : '—'})`}<br>fourchette CHF ${trCHF(fin.finBas)} – ${trCHF(fin.finHaut)} (±${Math.round(R.incertitude.taux * 100)} %)`, fin.fin < 0 || (R.plusBas && R.plusBas.fin < 0) ? 'alerte' : 'ok', 4)}
    </div>

    <div class="tr-barre-outils">
      <div class="dbx-onglets" role="group" aria-label="Horizon">
        ${[6, 12, 18].map(h => `<button type="button" class="${_tr.horizon === h ? 'actif' : ''}" onclick="_tr.horizon=${h};renderTresorerie()">${h} mois</button>`).join('')}
      </div>
      <label class="tr-interrupteur"><input type="checkbox" ${_tr.pipeline ? 'checked' : ''} onchange="_tr.pipeline=this.checked;renderTresorerie()"/> Inclure le pipeline pondéré</label>
      <span class="tr-espace"></span>
      <button type="button" class="tr-btn" onclick="trOuvrirLigne('sortie')">− Ajouter une charge</button>
      <button type="button" class="tr-btn" onclick="trOuvrirLigne('entree')">+ Ajouter un encaissement</button>
      <button type="button" class="tr-btn" onclick="trExporterExcel()" title="Télécharger le plan au format Excel">⬇️ Excel</button>
      <button type="button" class="tr-btn" onclick="trImprimer()" title="Imprimer ou enregistrer en PDF">🖨️ PDF</button>
    </div>

    <div id="tr-formulaire"></div>

    <section class="dbx-carte">
      <header class="dbx-carte-tete"><h2>Évolution du solde</h2><span class="dbx-carte-sous">barres : entrées / sorties du mois · ligne : solde en fin de mois</span></header>
      ${trGraphique(R)}
    </section>

    <section class="dbx-carte tr-carte-tableau">
      <header class="dbx-carte-tete"><h2>Détail mois par mois</h2><span class="dbx-carte-sous">acquisition : délai moyen observé ${R.delaiAcq} j${R.oz.nb ? ` · ${R.oz.nb} commission(s) de gestion de clients OZ (CHF ${trCHF(R.oz.total)}) exclue(s) : encaissées par OZ jusqu’au 31.12.2026` : ''}</span></header>
      ${trTableau(R)}
    </section>

    <section class="dbx-carte">
      <header class="dbx-carte-tete"><h2>Postes saisis</h2><span class="dbx-carte-sous">charges et encaissements hors commissions</span></header>
      ${trListePostes()}
    </section>`;
}

function trGraphique(R) {
  const w = 900, h = 240, padG = 56, padB = 26, padH = 14;
  const n = R.parMois.length;
  const valeurs = R.parMois.flatMap(x => [x.entrees, x.sorties, x.fin, x.finBas ?? x.fin, x.finHaut ?? x.fin, 0]);
  const max = Math.max(...valeurs, 1), min = Math.min(...valeurs, 0);
  const y = v => padH + (max - v) / (max - min || 1) * (h - padH - padB);
  const larg = (w - padG - 10) / n;
  const x0 = i => padG + i * larg;
  const barres = R.parMois.map((x, i) => {
    const bw = Math.max(6, larg * 0.3);
    return `<rect x="${x0(i) + larg / 2 - bw - 1}" y="${y(x.entrees)}" width="${bw}" height="${Math.max(0, y(0) - y(x.entrees))}" rx="3" fill="#22C55E" opacity=".75"><title>${trLibelleMois(x.m)} — entrées CHF ${trCHF(x.entrees)}</title></rect>
      <rect x="${x0(i) + larg / 2 + 1}" y="${y(x.sorties)}" width="${bw}" height="${Math.max(0, y(0) - y(x.sorties))}" rx="3" fill="#EF4444" opacity=".7"><title>${trLibelleMois(x.m)} — sorties CHF ${trCHF(x.sorties)}</title></rect>
      <text x="${x0(i) + larg / 2}" y="${h - 8}" text-anchor="middle" class="tr-axe">${trLibelleMois(x.m)}</text>`;
  }).join('');

  // Chaque colonne est cliquable et ouvre le détail du mois dans « Entrées d'argent » (demande de
  // Jonathan, 20.09.2026). La zone de clic couvre toute la hauteur plutôt que la seule barre :
  // viser une barre de six pixels de large, dont la hauteur dépend du montant, serait pénible —
  // et impossible pour un mois à zéro, qui est justement un mois qu'on a envie d'interroger.
  // Elle est posée au-dessus du dessin, donc elle porte son propre libellé de survol.
  const zonesCliquables = typeof eafDepuisTresorerie === 'function' ? R.parMois.map((x, i) =>
    `<rect class="tr-zone-mois" x="${x0(i)}" y="${padH}" width="${larg}" height="${h - padH - padB}"
       fill="transparent" onclick="eafDepuisTresorerie('${x.m}')" role="button" tabindex="0"
       onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();eafDepuisTresorerie('${x.m}')}"
     ><title>${trLibelleMois(x.m)}
Solde au 1er : CHF ${trCHF(x.debut)}
  + entrées CHF ${trCHF(x.entrees)}
  − sorties CHF ${trCHF(x.sorties)}
  = CHF ${trCHF(x.fin)} en fin de mois
Cliquez pour voir les lignes qui composent les entrées de ce mois.</title></rect>`).join('') : '';
  const pts = R.parMois.map((x, i) => `${x0(i) + larg / 2},${y(x.fin)}`);
  const graduations = [max, (max + min) / 2, min].map(v => `<line x1="${padG}" x2="${w - 6}" y1="${y(v)}" y2="${y(v)}" class="tr-grille"/><text x="${padG - 8}" y="${y(v) + 4}" text-anchor="end" class="tr-axe">${Math.max(Math.abs(max), Math.abs(min)) >= 10000 ? trCHF(v / 1000) + 'k' : trCHF(v)}</text>`).join('');
  return `<div class="tr-graph"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Évolution du solde de trésorerie">
    ${graduations}
    <line x1="${padG}" x2="${w - 6}" y1="${y(0)}" y2="${y(0)}" class="tr-zero"/>
    ${barres}
    ${R.parMois[0] && R.parMois[0].finHaut != null ? `<polygon points="${R.parMois.map((x, i) => `${x0(i) + larg / 2},${y(x.finHaut)}`).join(' ')} ${R.parMois.slice().reverse().map((x, j) => `${x0(R.parMois.length - 1 - j) + larg / 2},${y(x.finBas)}`).join(' ')}" fill="#00CFFF" opacity=".12"/>
    <polyline points="${R.parMois.map((x, i) => `${x0(i) + larg / 2},${y(x.finHaut)}`).join(' ')}" fill="none" stroke="#00CFFF" stroke-width="1.2" stroke-dasharray="4 4" opacity=".7"/>
    <polyline points="${R.parMois.map((x, i) => `${x0(i) + larg / 2},${y(x.finBas)}`).join(' ')}" fill="none" stroke="#00CFFF" stroke-width="1.2" stroke-dasharray="4 4" opacity=".7"/>` : ''}
    <polyline points="${pts.join(' ')}" fill="none" stroke="#00CFFF" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" class="tr-ligne"/>
    ${R.parMois.map((x, i) => `<circle cx="${x0(i) + larg / 2}" cy="${y(x.fin)}" r="4.5" fill="${x.fin < 0 ? '#EF4444' : '#00CFFF'}" stroke="var(--surface)" stroke-width="2"><title>${trLibelleMois(x.m)} — solde CHF ${trCHF(x.fin)}</title></circle>`).join('')}
    ${zonesCliquables}
  </svg>
  <div class="tr-legende" style="display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:10px;font-size:12px;color:var(--text-muted)">
    <span style="display:inline-flex;align-items:center;gap:7px"><i style="width:12px;height:12px;border-radius:3px;background:#22C55E;opacity:.75"></i><b style="color:var(--text)">Entrées du mois</b> — commissions (gestion, acquisition) et autres encaissements prévus</span>
    <span style="display:inline-flex;align-items:center;gap:7px"><i style="width:12px;height:12px;border-radius:3px;background:#EF4444;opacity:.7"></i><b style="color:var(--text)">Sorties du mois</b> — charges saisies (salaires, loyer, abonnements…)</span>
    <span style="display:inline-flex;align-items:center;gap:7px"><i style="width:18px;height:3px;border-radius:2px;background:#00CFFF"></i><b style="color:var(--text)">Solde en fin de mois</b> — <b style="color:var(--text)">cumulé</b> : solde du mois précédent + entrées − sorties. Un mois à fortes entrées peut donc finir bas s’il part d’un solde négatif, et l’inverse.</span>
    <span style="display:inline-flex;align-items:center;gap:7px"><i style="width:10px;height:10px;border-radius:50%;background:#EF4444"></i><b style="color:var(--text)">Point rouge</b> — solde négatif ce mois-là</span>
    ${typeof eafDepuisTresorerie === 'function' ? '<span style="display:inline-flex;align-items:center;gap:7px">👆<b style="color:var(--text)">Cliquez un mois</b> — le détail des lignes qui composent ses entrées s’ouvre dans « Entrées d’argent »</span>' : ''}
    ${R.incertitude ? `<span style="display:inline-flex;align-items:center;gap:7px"><i style="width:18px;height:10px;border-radius:3px;background:rgba(0,207,255,.18);border-top:1.5px dashed #00CFFF;border-bottom:1.5px dashed #00CFFF"></i><b style="color:var(--text)">Zone bleutée</b> — fourchette : commissions ±${Math.round(R.incertitude.taux * 100)} % (écart médian réel / estimé${R.incertitude.n ? ` mesuré sur ${R.incertitude.n} commissions` : ''})</span>` : ''}
    <span style="display:inline-flex;align-items:center;gap:7px"><i style="width:18px;height:0;border-top:1.5px solid var(--text-dim, var(--text-muted))"></i>Ligne du zéro · échelle en CHF (k = milliers)</span>
  </div></div>`;
}

function trTableau(R) {
  const ligne = (libelle, valeurs, cls, extra) => `<tr class="${cls || ''}"><th scope="row">${libelle}${extra || ''}</th>${valeurs.map(v => `<td class="${v < 0 ? 'neg' : ''}">${Math.round(v) ? trCHF(v) : '<span class="tr-vide">·</span>'}</td>`).join('')}<td class="tr-total">${cls && cls.includes('solde') ? '' : trCHF(valeurs.reduce((s, v) => s + v, 0))}</td></tr>`;
  const m = R.mois;
  // Chaque en-tête de mois ouvre le détail de ce mois dans « Entrées d'argent ». Une colonne de
  // trésorerie est une somme ; savoir de quelles lignes elle est faite ne devrait jamais demander
  // de refaire la recherche à la main dans un autre écran (demande de Jonathan, 20.09.2026).
  const enTeteMois = k => typeof eafDepuisTresorerie === 'function'
    ? `<th scope="col"><button type="button" class="tr-mois-lien" onclick="eafDepuisTresorerie('${k}')"
         title="Voir les entrées d’argent de ${trLibelleMois(k)}">${trLibelleMois(k)}</button></th>`
    : `<th scope="col">${trLibelleMois(k)}</th>`;
  return `<div class="tr-tableau-wrap"><table class="tr-tableau">
    <thead><tr><th></th>${m.map(enTeteMois).join('')}<th scope="col">Total</th></tr></thead>
    <tbody>
      ${ligne('Solde en début de mois', R.parMois.map(x => x.debut), 'solde')}
      <tr class="tr-section"><td colspan="${m.length + 2}">Encaissements</td></tr>
      ${ligne('Commissions de gestion', m.map(k => R.gestion[k]), 'entree', ' <small>date prévue</small>')}
      ${R.recurrenteNb ? ligne('Gestion des années suivantes', m.map(k => R.recurrente[k]), 'entree pipeline', ' <small>projection</small>') : ''}
      ${ligne('Commissions d’acquisition', m.map(k => R.acquisition[k]), 'entree', ` <small>+${R.delaiAcq} j</small>`)}
      ${_tr.pipeline ? ligne('Pipeline pondéré', m.map(k => R.pipeline[k]), 'entree pipeline', ' <small>estimation</small>') : ''}
      ${R.entrees.map(x => ligne(trEsc(x.ligne.libelle), m.map(k => x.serie[k]), 'entree', ` <small>${trEsc(x.ligne.categorie || '')}</small>`)).join('')}
      <tr class="tr-section"><td colspan="${m.length + 2}">Charges</td></tr>
      ${R.sorties.length ? R.sorties.map(x => ligne(trEsc(x.ligne.libelle), m.map(k => -x.serie[k]), 'sortie', ` <small>${trEsc(x.ligne.categorie || '')}</small>`)).join('') : `<tr><td colspan="${m.length + 2}" class="tr-invite">Aucune charge saisie — <button type="button" class="dbx-lien" onclick="trOuvrirLigne('sortie')">ajouter les salaires, le loyer, les abonnements…</button></td></tr>`}
      ${ligne('Variation du mois', R.parMois.map(x => x.net), 'net')}
      ${ligne('Solde en fin de mois', R.parMois.map(x => x.fin), 'solde fin')}
      ${ligne(`Fourchette basse <small>commissions −${Math.round(R.incertitude.taux * 100)} %</small>`, R.parMois.map(x => x.finBas), 'solde')}
      ${ligne(`Fourchette haute <small>commissions +${Math.round(R.incertitude.taux * 100)} %</small>`, R.parMois.map(x => x.finHaut), 'solde')}
    </tbody></table></div>`;
}

function trListePostes() {
  const postes = _tr.lignes.filter(l => l.type !== 'solde');
  if (!postes.length) return '<div class="dbx-vide-petit">Aucun poste saisi pour l’instant.</div>';
  const freq = f => (TR_FREQUENCES.find(x => x[0] === f) || [0, f])[1];
  return `<div class="tr-postes">${postes.map(l => `<div class="tr-poste ${l.type}">
    <span class="tr-poste-signe">${l.type === 'entree' ? '+' : '−'}</span>
    <div class="tr-poste-texte"><strong>${trEsc(l.libelle)}</strong><small>${trEsc(l.categorie || '')} · ${freq(l.frequence)} · dès ${fmtDate(l.date_debut)}${l.date_fin ? ' jusqu’au ' + fmtDate(l.date_fin) : ''}</small></div>
    <span class="tr-poste-montant">CHF ${fmtCHF2(l.montant)}</span>
    <button type="button" class="tr-icone" title="Modifier" aria-label="Modifier" onclick="trOuvrirLigne('${l.type}','${l.id}')">✎</button>
    <button type="button" class="tr-icone" title="Retirer du plan" aria-label="Retirer du plan" onclick="trRetirerLigne('${l.id}')">✕</button>
  </div>`).join('')}</div>`;
}

// ── Export ──────────────────────────────────────────────────────────────────────────────────
// Lignes du tableau (mêmes que l'écran) : [libellé, catégorie, ...montants par mois, total]
function trLignesExport(R) {
  const m = R.mois;
  const tot = v => Math.round(v.reduce((s, x) => s + x, 0) * 100) / 100;
  const arr = v => v.map(x => Math.round(x * 100) / 100);
  const L = [];
  const push = (lib, cat, vals, avecTotal = true) => L.push([lib, cat, ...arr(vals), avecTotal ? tot(vals) : '']);
  push('Solde en début de mois', '', R.parMois.map(x => x.debut), false);
  L.push(['ENCAISSEMENTS']);
  push('Commissions de gestion', 'date prévue', m.map(k => R.gestion[k]));
  if (R.recurrenteNb) push('Gestion des années suivantes', 'projection', m.map(k => R.recurrente[k]));
  push('Commissions d’acquisition', `+${R.delaiAcq} j`, m.map(k => R.acquisition[k]));
  if (_tr.pipeline) push('Pipeline pondéré', 'estimation', m.map(k => R.pipeline[k]));
  R.entrees.forEach(x => push(x.ligne.libelle, x.ligne.categorie || '', m.map(k => x.serie[k])));
  push('Total encaissements', '', R.parMois.map(x => x.entrees));
  L.push(['CHARGES']);
  R.sorties.forEach(x => push(x.ligne.libelle, x.ligne.categorie || '', m.map(k => -x.serie[k])));
  push('Total charges', '', R.parMois.map(x => -x.sorties));
  push('Variation du mois', '', R.parMois.map(x => x.net));
  push('Solde en fin de mois', '', R.parMois.map(x => x.fin), false);
  push('Solde — fourchette basse', `commissions −${Math.round(R.incertitude.taux * 100)} %`, R.parMois.map(x => x.finBas), false);
  push('Solde — fourchette haute', `commissions +${Math.round(R.incertitude.taux * 100)} %`, R.parMois.map(x => x.finHaut), false);
  return L;
}

function trExporterExcel() {
  const R = trCalculer();
  const entete = ['Poste', 'Détail', ...R.mois.map(trLibelleMois), 'Total'];
  const titre = [
    ['Plan de trésorerie PRÉVISIONNEL — Assurex Sàrl'],
    [`Établi le ${new Date().toLocaleDateString('fr-CH')} · horizon ${_tr.horizon} mois${_tr.pipeline ? ' · pipeline pondéré inclus' : ''}`],
    [R.solde ? `Solde bancaire de départ : CHF ${fmtCHF2(R.solde.montant)} au ${fmtDate(R.solde.date_debut)}` : 'Solde bancaire de départ : non renseigné (0)'],
    [],
  ];
  const lignes = trLignesExport(R);
  const nom = `plan_tresorerie_${new Date().toISOString().slice(0, 10)}`;
  if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([...titre, entete, ...lignes]);
    ws['!cols'] = [{ wch: 34 }, { wch: 24 }, ...R.mois.map(() => ({ wch: 11 })), { wch: 12 }];
    // Format monétaire suisse sur les cellules numériques
    Object.keys(ws).forEach(k => { if (k[0] !== '!' && typeof ws[k].v === 'number') ws[k].z = "#,##0.00"; });
    XLSX.utils.book_append_sheet(wb, ws, 'Plan de trésorerie');
    const postes = _tr.lignes.filter(l => l.type !== 'solde').map(l => [l.type === 'entree' ? 'Encaissement' : 'Charge', l.libelle, l.categorie || '', Number(l.montant), (TR_FREQUENCES.find(f => f[0] === l.frequence) || [0, l.frequence])[1], l.date_debut, l.date_fin || '']);
    const ws2 = XLSX.utils.aoa_to_sheet([['Type', 'Libellé', 'Catégorie', 'Montant (CHF)', 'Fréquence', 'Dès le', 'Jusqu’au'], ...postes]);
    ws2['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Postes saisis');
    XLSX.writeFile(wb, nom + '.xlsx');
  } else {
    exporterCsv(nom, entete, lignes);
  }
}

function trImprimer() {
  const R = trCalculer();
  const fin = R.parMois[R.parMois.length - 1];
  const lignes = trLignesExport(R);
  const cell = v => typeof v === 'number' ? `<td class="${v < 0 ? 'neg' : ''}">${Math.round(v) ? trCHF(v) : '·'}</td>` : `<td></td>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Plan de trésorerie</title><style>
    :root{--text:#0E1B33;--text-dim:#8A94A8;--border:#E2E7EF;--surface:#fff}
    body{font-family:Arial,Helvetica,sans-serif;color:#0E1B33;margin:0;padding:24px 28px;font-size:10.5px}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #113679;padding-bottom:10px;margin-bottom:14px}
    header img{height:30px} h1{font-size:19px;margin:0;color:#113679} .sous{color:#56627A;font-size:10.5px}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px} .kpi{background:#F4F6F9;border-radius:6px;padding:8px}
    .kpi span{display:block;font-size:9px;color:#56627A;text-transform:uppercase} .kpi b{font-size:13px;color:#113679} .kpi b.neg{color:#DC2626}
    .graph svg{width:100%;height:auto} .tr-axe{font-size:11px;fill:#8A94A8} .tr-grille{stroke:#E2E7EF;stroke-dasharray:3 4} .tr-zero{stroke:#8A94A8}
    table{width:100%;border-collapse:collapse;margin-top:10px} th,td{padding:3px 5px;text-align:right;border-bottom:1px solid #EEF1F5;white-space:nowrap}
    th:first-child,td:first-child{text-align:left} td.neg{color:#DC2626} tr.section td{font-weight:bold;color:#56627A;padding-top:8px;border:none}
    tr.fort td{font-weight:bold;background:#F4F6F9} thead th{color:#56627A;font-size:9.5px;text-transform:uppercase}
    .mention{font-size:9px;color:#8A94A8;margin-top:14px} @page{size:A4 landscape;margin:10mm}
  </style></head><body>
    <div style="position:fixed;top:42%;left:0;right:0;text-align:center;font-size:92px;font-weight:900;letter-spacing:.2em;color:#113679;opacity:.05;transform:rotate(-18deg);pointer-events:none">PRÉVISIONNEL</div>
    <header><div><h1>Plan de trésorerie <span style="font-size:10px;font-weight:800;letter-spacing:.12em;color:#fff;background:#F59E0B;border-radius:4px;padding:3px 7px;vertical-align:middle">PRÉVISIONNEL</span></h1><div class="sous">Établi le ${new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })} · horizon ${_tr.horizon} mois${_tr.pipeline ? ' · pipeline pondéré inclus' : ''}</div></div>${typeof ASSUREX_LOGO_B64 !== 'undefined' ? `<img src="${ASSUREX_LOGO_B64}" alt="Assurex"/>` : ''}</header>
    <div class="kpis">
      <div class="kpi"><span>Solde de départ</span><b>${R.solde ? 'CHF ' + trCHF(R.solde.montant) : '—'}</b></div>
      <div class="kpi"><span>Encaissements attendus</span><b>CHF ${trCHF(R.totalEntrees)}</b></div>
      <div class="kpi"><span>Charges</span><b>CHF ${trCHF(R.totalSorties)}</b></div>
      <div class="kpi"><span>Solde fin ${trLibelleMois(fin.m)}</span><b class="${fin.fin < 0 ? 'neg' : ''}">CHF ${trCHF(fin.fin)}</b></div>
    </div>
    <div class="graph">${trGraphique(R)}</div>
    <table><thead><tr><th>Poste</th><th>Détail</th>${R.mois.map(k => `<th>${trLibelleMois(k)}</th>`).join('')}<th>Total</th></tr></thead><tbody>
      ${lignes.map(l => l.length === 1 ? `<tr class="section"><td colspan="${R.mois.length + 3}">${trEsc(l[0])}</td></tr>`
        : `<tr class="${/^(Solde|Total|Variation)/.test(l[0]) ? 'fort' : ''}"><td>${trEsc(l[0])}</td><td style="text-align:left;color:#8A94A8">${trEsc(l[1])}</td>${l.slice(2).map(cell).join('')}</tr>`).join('')}
    </tbody></table>
    <div class="mention">Commissions attendues calculées depuis le CRM (gestion : date prévue selon la règle de versement ; acquisition : délai moyen observé de ${R.delaiAcq} jours). <strong>Document prévisionnel</strong> : les commissions sont des estimations ; fourchette basse / haute = commissions ±${Math.round(R.incertitude.taux * 100)} %, écart médian mesuré entre estimations et montants réellement reçus${R.incertitude.n ? ` (${R.incertitude.n} commissions)` : ''}. Charges saisies non modulées.</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`;
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  if (!w) showError('Autorise les fenêtres pop-up pour afficher le PDF.');
}

// ── Saisie ──────────────────────────────────────────────────────────────────────────────────
function trOuvrirLigne(type, id) {
  const l = id ? _tr.lignes.find(x => x.id === id) : null;
  const cats = type === 'entree' ? TR_CATEGORIES_ENTREE : TR_CATEGORIES_SORTIE;
  const zone = document.getElementById('tr-formulaire');
  if (!zone) return;
  zone.innerHTML = `<section class="dbx-carte tr-form">
    <header class="dbx-carte-tete"><h2>${l ? 'Modifier' : type === 'entree' ? 'Nouvel encaissement' : 'Nouvelle charge'}</h2><button type="button" class="dbx-lien" onclick="document.getElementById('tr-formulaire').innerHTML=''">Fermer</button></header>
    <div class="tr-form-grille">
      <label>Libellé<input id="tr-f-libelle" class="form-input" maxlength="200" value="${trEsc(l ? l.libelle : '')}" placeholder="${type === 'entree' ? 'ex. Honoraires conseil' : 'ex. Salaire assistante'}"/></label>
      <label>Catégorie<select id="tr-f-categorie" class="form-select">${cats.map(c => `<option ${l && l.categorie === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>Montant (CHF)<input id="tr-f-montant" class="form-input" inputmode="decimal" value="${l ? l.montant : ''}" placeholder="ex. 4'500,00"/></label>
      <label>Fréquence<select id="tr-f-frequence" class="form-select">${TR_FREQUENCES.map(f => `<option value="${f[0]}" ${(l ? l.frequence : 'mensuel') === f[0] ? 'selected' : ''}>${f[1]}</option>`).join('')}</select></label>
      <label>À partir du<input id="tr-f-debut" type="date" class="form-input" value="${l ? l.date_debut : trIso(new Date())}"/></label>
      <label>Jusqu’au <small>(optionnel)</small><input id="tr-f-fin" type="date" class="form-input" value="${l && l.date_fin ? l.date_fin : ''}"/></label>
    </div>
    <div class="tr-form-actions"><button type="button" class="btn-save" id="tr-f-ok" onclick="trEnregistrerLigne('${type}', ${l ? `'${l.id}'` : 'null'})">✓ Enregistrer</button></div>
  </section>`;
  zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => document.getElementById('tr-f-libelle')?.focus(), 250);
}

async function trEnregistrerLigne(type, id) {
  const btn = document.getElementById('tr-f-ok');
  if (btn && btn.disabled) return;
  const libelle = document.getElementById('tr-f-libelle').value.trim();
  const montant = nombreCH(document.getElementById('tr-f-montant').value);
  const date_debut = document.getElementById('tr-f-debut').value;
  const date_fin = document.getElementById('tr-f-fin').value || null;
  if (!libelle) { showError('Indique un libellé.'); return; }
  if (isNaN(montant) || montant <= 0) { showError('Indique un montant positif (ex. 4’500,00).'); return; }
  if (!date_debut) { showError('Indique la date de départ.'); return; }
  if (date_fin && date_fin < date_debut) { showError('La date de fin est avant la date de départ.'); return; }
  const body = { type, libelle, categorie: document.getElementById('tr-f-categorie').value, montant: Math.round(montant * 100) / 100, frequence: document.getElementById('tr-f-frequence').value, date_debut, date_fin };
  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
  const r = id ? await dbPatch('tresorerie_lignes', id, body) : await dbPost('tresorerie_lignes', body);
  if (r && r.error) { showError('Non enregistré : ' + errMsg(r)); if (btn) { btn.disabled = false; btn.textContent = '✓ Enregistrer'; } return; }
  await chargerTresorerie();
}

async function trRetirerLigne(id) {
  const l = _tr.lignes.find(x => x.id === id);
  if (!l || !confirm(`Retirer « ${l.libelle} » du plan de trésorerie ?`)) return;
  // Retrait doux (actif = false) : la ligne reste en base, simplement plus comptée
  const r = await dbPatch('tresorerie_lignes', id, { actif: false });
  if (r && r.error) { showError('Non retiré : ' + errMsg(r)); return; }
  await chargerTresorerie();
}

function trOuvrirSolde() {
  const zone = document.getElementById('tr-formulaire');
  if (!zone) return;
  zone.innerHTML = `<section class="dbx-carte tr-form">
    <header class="dbx-carte-tete"><h2>Solde bancaire actuel</h2><button type="button" class="dbx-lien" onclick="document.getElementById('tr-formulaire').innerHTML=''">Fermer</button></header>
    <p class="tr-sous">Le solde de ton compte professionnel à une date donnée — point de départ de la projection. Mets-le à jour de temps en temps (fin de mois, par exemple).</p>
    <div class="tr-form-grille">
      <label>Solde (CHF)<input id="tr-s-montant" class="form-input" inputmode="decimal" placeholder="ex. 25'000,00"/></label>
      <label>Au<input id="tr-s-date" type="date" class="form-input" value="${trIso(new Date())}"/></label>
    </div>
    <div class="tr-form-actions"><button type="button" class="btn-save" id="tr-s-ok" onclick="trEnregistrerSolde()">✓ Enregistrer le solde</button></div>
  </section>`;
  setTimeout(() => document.getElementById('tr-s-montant')?.focus(), 100);
}

async function trEnregistrerSolde() {
  const btn = document.getElementById('tr-s-ok');
  if (btn && btn.disabled) return;
  const montant = nombreCH(document.getElementById('tr-s-montant').value);
  const date = document.getElementById('tr-s-date').value;
  if (isNaN(montant)) { showError('Indique le solde (ex. 25’000,00).'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
  const r = await dbPost('tresorerie_lignes', { type: 'solde', libelle: 'Solde bancaire', montant: Math.round(montant * 100) / 100, frequence: 'unique', date_debut: date || trIso(new Date()) });
  if (r && r.error) { showError('Non enregistré : ' + errMsg(r)); if (btn) { btn.disabled = false; btn.textContent = '✓ Enregistrer le solde'; } return; }
  await chargerTresorerie();
}
