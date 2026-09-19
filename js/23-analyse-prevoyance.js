// ═══ ANALYSE DE PRÉVOYANCE (19.09.2026) ═══════════════════════════════════════════════════════
// Remplace l'ancien « Bilan de prévoyance » (retiré le 19.09.2026).
// Inspiré des outils du marché (Logismata, Argo…) mais en version moderne : saisie à gauche,
// résultats à droite recalculés EN DIRECT, vue d'ensemble puis détail de chaque situation :
//   Retraite (ménage) · Invalidité maladie / accident · Décès maladie / accident
// Pour un couple, les risques sont analysés pour CHACUNE des deux personnes (comme les rapports
// Logismata/Argo « Personne 1 / Personne 2 »). Pour chaque situation : revenu actuel, besoin,
// prestations empilées (AVS/AI · LPP · LAA · 3e pilier) → lacune et ce qu'il faudrait assurer.
//
// Règles (état 2026, simplifiées — le rapport le mentionne ; recoupées avec un rapport Argo réel) :
//  AVS/AI  rente selon le RAMD (échelle 44, estimerRenteAVS de js/01). Retraite : 13e rente AVS
//          (+1/12, versée dès 2026) ; couple marié : revenus partagés (splitting) et plafonnement
//          à 150 % de la rente maximale. Rente d'enfant / d'orphelin 40 %, de veuve / veuf 80 %
//          (veuve sans enfant : dès 45 ans et 5 ans de mariage ; veuf : tant qu'il a des enfants
//          de moins de 18 ans).
//  LPP     selon le certificat si renseigné, sinon minimum légal : invalidité = avoir projeté à la
//          retraite sans intérêts × 6,8 % ; conjoint 60 % ; enfant / orphelin 20 %.
//  LAA     salariés : 80 % du salaire assuré (max. 148'200) ; décès : conjoint 40 %, orphelin 15 %,
//          total ≤ 70 %. Coordination avec l'AVS/AI : total ≤ 90 % du salaire assuré.
//  Surindemnisation LPP : AVS/AI (+ LAA) + LPP ≤ 90 % du revenu perdu.

const AP_LAA_SALAIRE_MAX = 148200;
const AP_TREIZIEME_AVS = 13 / 12;
const AP_RISQUES = [
  ['inv_maladie', '🩺', 'Invalidité maladie'],
  ['inv_accident', '🚑', 'Invalidité accident'],
  ['deces_maladie', '🕊️', 'Décès maladie'],
  ['deces_accident', '⚠️', 'Décès accident'],
];
const AP_SCENARIOS = [['retraite', '🌅', 'Retraite'], ...AP_RISQUES];
const AP_COULEURS = { avs: '#113679', lpp: '#0EA5E9', lpps: '#8B5CF6', laa: '#F59E0B', p3: '#22C55E' };
const AP_LIBELLES = { avs: 'AVS / AI', lpp: 'LPP', lpps: 'LPP rentes subsidiaires', laa: 'LAA', p3: '3e pilier' };
const AP_LPP_VIDE = () => ({ avoir: '', capital_65: '', rente_vieillesse: '', rente_invalidite: '', rente_conjoint: '', rente_enfant: '', capital_deces: '', taux_conversion: 6.8, concubin_couvert: false });
const AP_P3_VIDE = () => ({ avoir3a: '', versement3a: '', rente_inv_privee: '', capital_deces_risque: '' });
const AP_DEFAUT = () => ({
  nom: '', sexe: 'H', naissance: '', etat_civil: 'marie', mariage_5ans: true, enfants: '',
  salaire: '', statut: 'salarie', lacunes_avs: 0, ramd: '', age_retraite: 65,
  lpp: AP_LPP_VIDE(), laa: { salaire_assure: '' }, p3: { ...AP_P3_VIDE(), rendement: 1.5 },
  conjoint: { nom: '', sexe: 'F', naissance: '', salaire: '', statut: 'salarie', lacunes_avs: 0, age_retraite: 65, lpp: AP_LPP_VIDE(), laa: { salaire_assure: '' }, p3: AP_P3_VIDE() },
  besoins: { retraite: 80, invalidite: 80, deces: 80, horizon: 90 },
});

let _ap = { d: AP_DEFAUT(), clientId: null, scenario: 'retraite', personne: 1, unite: 'mois', analyses: [] };

function apEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function apNum(v) { const n = typeof nombreCH === 'function' ? nombreCH(v) : Number(v); return isNaN(n) ? 0 : n; }
function apGet(o, p) { return p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o); }
function apSet(o, p, v) { const k = p.split('.'); let x = o; k.slice(0, -1).forEach(c => { if (x[c] == null || typeof x[c] !== 'object') x[c] = {}; x = x[c]; }); x[k[k.length - 1]] = v; }
function apAge(iso) { if (!iso) return null; const d = new Date(iso), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--; return a; }
function apCHF(annuel) { const v = Math.round(_ap.unite === 'mois' ? annuel / 12 : annuel); return 'CHF ' + (v < 0 ? '−' : '') + fmtCHF(Math.abs(v)); }
function apCHFbrut(v) { return 'CHF ' + fmtCHF(Math.round(v || 0)); }
function apSuffixe() { return _ap.unite === 'mois' ? '/mois' : '/an'; }
function apCouple(d) { return d.etat_civil === 'marie' || d.etat_civil === 'concubin'; }
function apNomPers(d, i) { return i === 2 ? (d.conjoint.nom || 'Conjoint·e') : (d.nom ? d.nom.split(' ')[0] : 'Client·e'); }

// Les deux personnes sous une forme commune
function apPersonnes(d) {
  const p1 = { nom: d.nom, sexe: d.sexe, naissance: d.naissance, salaire: apNum(d.salaire), statut: d.statut, lacunes: apNum(d.lacunes_avs), ramd: apNum(d.ramd), ageRet: apNum(d.age_retraite) || 65, lpp: d.lpp || AP_LPP_VIDE(), laa: d.laa || {}, p3: d.p3 || {} };
  const c = d.conjoint || {};
  const p2 = { nom: c.nom, sexe: c.sexe, naissance: c.naissance, salaire: apNum(c.salaire), statut: c.statut || 'salarie', lacunes: apNum(c.lacunes_avs), ramd: 0, ageRet: apNum(c.age_retraite) || 65, lpp: c.lpp || AP_LPP_VIDE(), laa: c.laa || {}, p3: c.p3 || {} };
  return [p1, p2];
}

// Prestations LPP d'une personne : certificat si renseigné, sinon minimum légal
function apLpp(p, d) {
  const age = apAge(p.naissance);
  const tc = (apNum(p.lpp.taux_conversion) || 6.8) / 100;
  const coord = calculerSalaireCoordonneLPP(p.salaire);
  const assure = p.statut === 'salarie' && p.salaire >= LPP_LEGAL.seuil_entree;
  let capital65 = apNum(p.lpp.capital_65);
  const certificat = !!(apNum(p.lpp.rente_vieillesse) || capital65 || apNum(p.lpp.rente_invalidite));
  if (!capital65 && age != null && assure) capital65 = simulerParcoursLPP({ salaireCoordonne: coord, capitalDepart: apNum(p.lpp.avoir), ageDepart: age, ageRetraite: p.ageRet, moisDerniereAnnee: 0, tauxInteret: LPP_LEGAL.taux_interet_minimal, rachatAnnuel: 0 }).capitalFinal;
  if (!capital65) capital65 = apNum(p.lpp.avoir);
  const vieillesse = apNum(p.lpp.rente_vieillesse) || capital65 * tc;
  let avoirSansInteret = apNum(p.lpp.avoir);
  if (age != null && assure) for (let a = age; a < p.ageRet; a++) avoirSansInteret += coord * tauxBonificationLPP(a);
  const inv = apNum(p.lpp.rente_invalidite) || (assure ? avoirSansInteret * LPP_LEGAL.taux_conversion_legal : 0);
  return { capital65, vieillesse, inv, enfant: apNum(p.lpp.rente_enfant) || 0.2 * inv, conjoint: apNum(p.lpp.rente_conjoint) || 0.6 * inv, enfantTheo: !apNum(p.lpp.rente_enfant), conjointTheo: !apNum(p.lpp.rente_conjoint), capitalDeces: apNum(p.lpp.capital_deces), certificat, assure };
}

// ── Calcul ──────────────────────────────────────────────────────────────────────────────────
function apCalculer(d) {
  const [p1, p2] = apPersonnes(d);
  const couple = apCouple(d), marie = d.etat_civil === 'marie';
  const anneeCourante = new Date().getFullYear();
  const enfants = String(d.enfants || '').split(/[,;\s]+/).map(x => parseInt(x, 10)).filter(x => x > 1900 && x <= anneeCourante + 1).map(an => anneeCourante - an);
  const enfantsACharge = enfants.filter(a => a < 25).length;
  const enfantsMineurs = enfants.filter(a => a < 18).length;
  const plusJeune = enfants.length ? Math.min(...enfants) : null;
  const remarques = [];
  const r3 = (apNum(d.p3.rendement) || 0) / 100;

  // Rentes AVS / AI individuelles (sans splitting) — base des prestations de risque
  const renteEntiere = p => p.salaire || p.ramd ? estimerRenteAVS(p.ramd || p.salaire, Math.max(1, 44 - p.lacunes)) : 0;
  const R1 = renteEntiere(p1), R2 = couple ? renteEntiere(p2) : 0;
  const L1 = apLpp(p1, d), L2 = couple ? apLpp(p2, d) : null;

  // ── Retraite du ménage ──
  let avs1 = R1, avs2 = couple ? R2 : 0;
  if (marie) {
    const ramdSplit = ((p1.ramd || p1.salaire) + p2.salaire) / 2;
    avs1 = estimerRenteAVS(ramdSplit, Math.max(1, 44 - p1.lacunes));
    avs2 = estimerRenteAVS(ramdSplit, Math.max(1, 44 - p2.lacunes));
    const plafond = AVS_LEGAL.rente_max * 1.5;
    if (avs1 + avs2 > plafond) { const f = plafond / (avs1 + avs2); avs1 *= f; avs2 *= f; }
  }
  const avsMenage = (avs1 + avs2) * AP_TREIZIEME_AVS;
  const age1 = apAge(p1.naissance), age2 = apAge(p2.naissance);
  const cap3a = (p, age) => { let c = apNum(p.p3.avoir3a); if (age != null) for (let a = age; a < p.ageRet; a++) c = c * (1 + r3) + apNum(p.p3.versement3a); return c; };
  const cap3a1 = cap3a(p1, age1), cap3a2 = couple ? cap3a(p2, age2) : 0;
  const dureeRetraite = Math.max(1, (apNum(d.besoins.horizon) || 90) - p1.ageRet);
  const revenuMenage = p1.salaire + (couple ? p2.salaire : 0);
  const scenRetraite = apScenario([
    { src: 'avs', label: couple ? `AVS du ${marie ? 'couple' : 'ménage'} (13e rente incluse)` : 'Rente AVS (13e rente incluse)', montant: avsMenage },
    { src: 'lpp', label: couple ? 'Rentes LPP des deux conjoints' : 'Rente LPP', montant: L1.vieillesse + (L2 ? L2.vieillesse : 0) },
    { src: 'p3', label: '3e pilier A (capital converti en revenu)', montant: (cap3a1 + cap3a2) / dureeRetraite },
  ], revenuMenage * (apNum(d.besoins.retraite) || 80) / 100, revenuMenage);
  scenRetraite.capitalManquant = scenRetraite.lacune * dureeRetraite;
  const moisJusquaRetraite = age1 != null ? Math.max(1, (p1.ageRet - age1) * 12) : 1;
  const rm = r3 / 12;
  scenRetraite.epargne0 = scenRetraite.capitalManquant / moisJusquaRetraite;
  scenRetraite.epargneMensuelle = rm ? scenRetraite.capitalManquant * rm / (Math.pow(1 + rm, moisJusquaRetraite) - 1) : scenRetraite.epargne0;
  scenRetraite.capitaux = [['Capital LPP à la retraite', L1.capital65 + (L2 ? L2.capital65 : 0)], ['Capital 3a à la retraite', cap3a1 + cap3a2]];
  scenRetraite.note = `${couple ? 'Revenu et besoin du ménage. ' : ''}Capital 3a converti en revenu et lacune capitalisée sur ${dureeRetraite} ans (jusqu’à ${apNum(d.besoins.horizon) || 90} ans).${marie && avs1 + avs2 >= AVS_LEGAL.rente_max * 1.5 - 1 ? ' Rentes AVS du couple plafonnées à 150 %.' : ''}`;

  // ── Risques pour une personne (p touchée, q survivant/conjoint) ──
  // LPP : rente principale (invalidité / conjoint survivant) et rentes SUBSIDIAIRES (enfant d'invalide,
  // orphelin), affichées dans une couleur distincte. Si le certificat ne les indique pas, elles sont
  // calculées théoriquement (20 % de la rente d'invalidité par enfant, 60 % pour le conjoint) — et
  // seulement si les conditions légales sont remplies. La surindemnisation (90 %) réduit l'ensemble
  // LPP au prorata.
  const repartirLpp = (principal, subsidiaire, plafond) => {
    const brut = principal + subsidiaire;
    const f = brut > 0 ? Math.min(1, Math.max(0, plafond) / brut) : 0;
    return { lpp: principal * f, lpps: subsidiaire * f, reduit: f < 0.999 && brut > 0 };
  };
  const risques = (p, R, L, q, Rq) => {
    const S = p.salaire;
    const besoinInv = S * (apNum(d.besoins.invalidite) || 80) / 100;
    const res = {};
    const nomP = apNomPers(d, p === p1 ? 1 : 2);
    const theoE = L.enfantTheo ? ' — théorique 20 %' : '';
    // Invalidité
    const aiTotal = R + enfantsACharge * 0.4 * R;
    const privee = apNum(p.p3.rente_inv_privee);
    const subInv = enfantsACharge * L.enfant; // rentes d'enfant d'invalide : enfants de moins de 25 ans
    const invMal = repartirLpp(L.inv, subInv, 0.9 * S - aiTotal);
    res.inv_maladie = apScenario([
      { src: 'avs', label: `Rente AI${enfantsACharge ? ` + ${enfantsACharge} rente(s) d’enfant` : ''}`, montant: aiTotal },
      { src: 'lpp', label: `Rente d’invalidité LPP${invMal.reduit ? ' (réduite : plafond 90 %)' : ''}`, montant: invMal.lpp },
      { src: 'lpps', label: `Rentes d’enfant d’invalide LPP (${enfantsACharge})${theoE}`, montant: invMal.lpps },
      { src: 'p3', label: 'Rente d’invalidité privée', montant: privee },
    ], besoinInv, S);
    res.inv_maladie.note = 'Invalidité totale suite à une maladie. Montants dès la 3e année : avant, indemnités journalières (employeur, perte de gain), puis rente AI après le délai d’attente.';
    const Sa = p.statut === 'salarie' ? Math.min(apNum(p.laa.salaire_assure) || S, AP_LAA_SALAIRE_MAX) : 0;
    const laaInv = Sa ? Math.min(0.8 * Sa, Math.max(0, 0.9 * Sa - aiTotal)) : 0;
    const invAcc = repartirLpp(L.inv, subInv, 0.9 * S - aiTotal - laaInv);
    res.inv_accident = apScenario([
      { src: 'avs', label: `Rente AI${enfantsACharge ? ' + enfants' : ''}`, montant: aiTotal },
      { src: 'laa', label: 'Rente complémentaire LAA', montant: laaInv },
      { src: 'lpp', label: 'Rente d’invalidité LPP (après surindemnisation)', montant: invAcc.lpp },
      { src: 'lpps', label: `Rentes d’enfant d’invalide LPP (${enfantsACharge})${theoE}`, montant: invAcc.lpps },
      { src: 'p3', label: 'Rente d’invalidité privée', montant: privee },
    ], besoinInv, S);
    res.inv_accident.note = Sa ? 'LAA : 80 % du salaire assuré, coordonnée avec l’AI (total ≤ 90 %) ; la LPP ne complète que jusqu’à 90 % du revenu perdu.' : 'Pas de LAA (indépendant ou non assuré) : l’accident est traité comme la maladie.';

    // Décès — droits du survivant q
    const survivantFemme = q.sexe === 'F';
    const ageQ = apAge(q.naissance);
    let veuvage = false;
    if (marie) veuvage = enfantsMineurs > 0 || (survivantFemme && (enfantsACharge > 0 || (ageQ != null && ageQ >= 45 && d.mariage_5ans)));
    const avsSurv = (veuvage ? 0.8 * R : 0) + enfantsACharge * 0.4 * R;
    // LPP conjoint survivant (art. 19 LPP) : marié·e ET (enfant à charge OU 45 ans et 5 ans de mariage),
    // sinon allocation unique de 3 rentes annuelles. Concubin·e : seulement si le règlement le prévoit.
    const condConjointLpp = (marie && (enfantsACharge > 0 || (ageQ != null && ageQ >= 45 && d.mariage_5ans)))
      || (d.etat_civil === 'concubin' && p.lpp.concubin_couvert);
    const lppConj = condConjointLpp ? L.conjoint : 0;
    const allocationUnique = marie && !condConjointLpp ? 3 * L.conjoint : 0;
    const subDeces = enfantsACharge * L.enfant; // rentes d'orphelin
    const besoinDeces = (couple || enfantsACharge) ? S * (apNum(d.besoins.deces) || 80) / 100 : 0;
    const capitaux = [['Capital décès LPP', L.capitalDeces], ['Allocation unique LPP au conjoint (3 rentes)', allocationUnique], ['Avoir 3e pilier A', apNum(p.p3.avoir3a)], ['Capital décès risque (3e pilier)', apNum(p.p3.capital_deces_risque)]];
    const totalCapitaux = capitaux.reduce((s, x) => s + x[1], 0);
    const duree = plusJeune != null ? Math.max(25 - plusJeune, 10) : (couple ? 15 : 0);
    const finirDeces = s => { s.capitaux = capitaux; s.dureeBesoin = duree; s.capitalNecessaire = s.lacune * duree; s.capitalAAssurer = Math.max(0, s.capitalNecessaire - totalCapitaux); s.note = besoinDeces ? `Seules les rentes figurent dans les graphiques ; les capitaux décès sont déduits du capital nécessaire (besoin sur ${duree} ans${plusJeune != null ? ', jusqu’aux 25 ans du plus jeune' : ''}).${couple && !veuvage && marie ? ' Pas de rente AVS de conjoint survivant dans cette situation.' : ''}${allocationUnique ? ' Conditions de la rente LPP de conjoint non remplies : allocation unique de 3 rentes annuelles.' : ''}` : 'Ni conjoint ni enfant à charge : pas de besoin de revenu pour des survivants.'; return s; };
    const theoC = L.conjointTheo ? ' — théorique 60 %' : '';
    const decMal = repartirLpp(lppConj, subDeces, 0.9 * S - avsSurv);
    res.deces_maladie = finirDeces(apScenario([
      { src: 'avs', label: `AVS ${veuvage ? 'veuf/veuve' : ''}${veuvage && enfantsACharge ? ' + ' : ''}${enfantsACharge ? `${enfantsACharge} orphelin(s)` : ''}`.trim() || 'AVS survivants', montant: avsSurv },
      { src: 'lpp', label: `Rente de conjoint survivant LPP${theoC}${decMal.reduit ? ' (plafond 90 %)' : ''}`, montant: decMal.lpp },
      { src: 'lpps', label: `Rentes d’orphelin LPP (${enfantsACharge})${theoE}`, montant: decMal.lpps },
    ], besoinDeces, S));
    const laaSurv = Sa ? Math.min((marie ? 0.4 * Sa : 0) + enfantsACharge * 0.15 * Sa, 0.7 * Sa) : 0;
    const laaSurvC = Math.min(laaSurv, Math.max(0, 0.9 * Sa - avsSurv));
    const decAcc = repartirLpp(lppConj, subDeces, 0.9 * S - avsSurv - laaSurvC);
    res.deces_accident = finirDeces(apScenario([
      { src: 'avs', label: 'AVS survivants', montant: avsSurv },
      { src: 'laa', label: 'Rentes de survivants LAA', montant: laaSurvC },
      { src: 'lpp', label: `Rente de conjoint survivant LPP (après surindemnisation)${theoC}`, montant: decAcc.lpp },
      { src: 'lpps', label: `Rentes d’orphelin LPP (${enfantsACharge})${theoE}`, montant: decAcc.lpps },
    ], besoinDeces, S));
    res.inv_maladie.renteAAssurer = res.inv_maladie.lacune;
    res.inv_accident.renteAAssurer = res.inv_accident.lacune;

    // ── Évolution dans le temps (événement survenant aujourd'hui) ──
    const horizon = apNum(d.besoins.horizon) || 90;
    const ageP = apAge(p.naissance);
    const nEnf = y => enfants.filter(a => a + y < 25).length;
    const nMin = y => enfants.filter(a => a + y < 18).length;
    const serieInv = accident => {
      const pts = [];
      if (ageP == null) return pts;
      for (let y = 0; ageP + y <= horizon && y <= 55; y++) {
        const ag = ageP + y, n = nEnf(y), retraite = ag >= p.ageRet;
        // Retraite : rente de vieillesse AVS (13e rente) ; les rentes pour enfant continuent jusqu'à 25 ans
        const avs = (retraite ? R * AP_TREIZIEME_AVS : R) + n * 0.4 * R;
        const laa = accident && Sa ? Math.min(0.8 * Sa, Math.max(0, 0.9 * Sa - avs)) : 0;
        const l = repartirLpp(L.inv, n * L.enfant, 0.9 * S - avs - laa);
        const evt = ag === p.ageRet ? 'Retraite' : (y > 0 && n < nEnf(y - 1) ? 'Fin rente d’enfant' : '');
        pts.push({ an: anneeCourante + y, age: ag, v: { avs, lpp: l.lpp, lpps: l.lpps, laa, p3: retraite ? 0 : privee }, besoin: retraite ? S * (apNum(d.besoins.retraite) || 80) / 100 : besoinInv, evt });
      }
      return pts;
    };
    const serieDeces = accident => {
      const pts = [];
      if (!besoinDeces) return pts;
      const ageQ0 = apAge(q.naissance);
      const fin = Math.min(45, Math.max(plusJeune != null ? 25 - plusJeune : 0, ageQ0 != null ? q.ageRet - ageQ0 : 15, 5));
      for (let y = 0; y <= fin; y++) {
        const n = nEnf(y);
        // Veuve : rente AVS à vie si elle y avait droit ; veuf : tant qu'il a un enfant de moins de 18 ans
        const veuvY = veuvage && (survivantFemme || nMin(y) > 0);
        const avs = (veuvY ? 0.8 * R : 0) + n * 0.4 * R;
        const laaB = accident && Sa ? Math.min((marie ? 0.4 * Sa : 0) + n * 0.15 * Sa, 0.7 * Sa) : 0;
        const laa = Math.min(laaB, Math.max(0, 0.9 * Sa - avs));
        const l = repartirLpp(lppConj, n * L.enfant, 0.9 * S - avs - laa);
        const veuvPrec = y > 0 && veuvage && (survivantFemme || nMin(y - 1) > 0);
        const evt = y > 0 && n < nEnf(y - 1) ? 'Fin rente d’orphelin' : (veuvPrec && !veuvY ? 'Fin rente AVS de veuf' : '');
        pts.push({ an: anneeCourante + y, age: ageQ0 != null ? ageQ0 + y : null, v: { avs, lpp: l.lpp, lpps: l.lpps, laa, p3: 0 }, besoin: besoinDeces, evt });
      }
      return pts;
    };
    res.inv_maladie.serie = serieInv(false);
    res.inv_accident.serie = serieInv(true);
    res.deces_maladie.serie = serieDeces(false);
    res.deces_accident.serie = serieDeces(true);
    res.deces_maladie.serieLibelle = res.deces_accident.serieLibelle = `âge de ${apNomPers(d, p === p1 ? 2 : 1)} (survivant·e)`;
    res.inv_maladie.serieLibelle = res.inv_accident.serieLibelle = `âge de ${nomP}`;
    return res;
  };

  const pers = { 1: risques(p1, R1, L1, p2, R2) };
  if (couple && p2.salaire) pers[2] = risques(p2, R2, L2, p1, R1);

  // Remarques
  if (!L1.certificat && L1.assure) remarques.push(`LPP de ${apNomPers(d, 1)} estimée au minimum légal : saisir les chiffres du certificat de prévoyance pour un résultat fiable (le surobligatoire change souvent tout).`);
  if (couple && L2 && !L2.certificat && L2.assure) remarques.push(`LPP de ${apNomPers(d, 2)} estimée au minimum légal — certificat à demander.`);
  [p1, couple ? p2 : null].forEach((p, i) => { if (p && p.statut === 'salarie' && p.salaire > AP_LAA_SALAIRE_MAX) remarques.push(`${apNomPers(d, i + 1)} : salaire au-delà du maximum LAA (CHF 148'200) — la part excédentaire n’est couverte en cas d’accident que par une complémentaire LAA.`); if (p && p.statut === 'independant') remarques.push(`${apNomPers(d, i + 1)} est indépendant·e : pas de LAA ni de LPP obligatoires — invalidité et décès reposent sur l’AI et le 3e pilier.`); });
  if (d.etat_civil === 'concubin') remarques.push('Concubinage : aucune rente AVS ni LAA pour le partenaire survivant ; la LPP seulement si le règlement le prévoit et que le partenaire est désigné. Le 3e pilier (clause bénéficiaire) est le moyen de le protéger.');
  if (enfantsACharge) remarques.push('Les rentes d’enfant cessent à 18 ans (25 ans en formation) : la lacune augmente ensuite.');

  // Évolution du revenu du ménage : activité jusqu'à chaque retraite (1re / 2e retraite du couple), puis rentes
  scenRetraite.serie = [];
  if (age1 != null) {
    const horizon = apNum(d.besoins.horizon) || 90;
    const besoinR = scenRetraite.besoin;
    for (let y = 0; age1 + y <= horizon && y <= 60; y++) {
      const a1 = age1 + y, a2 = age2 != null ? age2 + y : null;
      const ret1 = a1 >= p1.ageRet, ret2 = couple && a2 != null && a2 >= p2.ageRet;
      const tousRetraites = ret1 && (!couple || ret2);
      const v = { activite: 0, avs: 0, lpp: 0, laa: 0, p3: 0 };
      if (!ret1) v.activite += p1.salaire;
      if (couple && !ret2) v.activite += p2.salaire;
      // AVS : rentes individuelles tant qu'un seul conjoint est retraité, puis rentes du couple (splitting + plafond)
      if (ret1) v.avs += (tousRetraites && couple ? avs1 : R1) * AP_TREIZIEME_AVS;
      if (ret2) v.avs += (tousRetraites ? avs2 : R2) * AP_TREIZIEME_AVS;
      if (ret1) { v.lpp += L1.vieillesse; v.p3 += cap3a1 / dureeRetraite; }
      if (ret2) { v.lpp += L2.vieillesse; v.p3 += cap3a2 / dureeRetraite; }
      const evt = (a1 === p1.ageRet ? (couple && !ret2 ? '1re retraite' : 'Retraite') : '') || (couple && a2 === p2.ageRet ? (ret1 && a1 > p1.ageRet ? '2e retraite' : '1re retraite') : '');
      scenRetraite.serie.push({ an: anneeCourante + y, age: a1, v, besoin: ret1 || ret2 ? besoinR : null, evt });
    }
    scenRetraite.serieLibelle = `âge de ${apNomPers(d, 1)}`;
  }

  return { p1, p2, couple, enfants, enfantsACharge, retraite: scenRetraite, pers, remarques, R1 };
}
function apScenario(items, besoin, revenu) {
  const total = items.reduce((s, x) => s + x.montant, 0);
  return { items: items.filter(x => x.montant > 0.5), total, besoin, revenu, lacune: Math.max(0, besoin - total), surplus: Math.max(0, total - besoin) };
}
function apScen(A, k, personne) { return k === 'retraite' ? A.retraite : (A.pers[personne] || A.pers[1])[k]; }

// ── Vue ─────────────────────────────────────────────────────────────────────────────────────
function viewAnalysePrevoyance() {
  const initial = window._apClientInitial || null;
  window._apClientInitial = null;
  if (initial) setTimeout(() => apChoisirClient(initial), 0);
  return `<div class="dbx ap">
    <section class="cf-hero ap-hero">
      <div class="cf-hero-deco" aria-hidden="true"></div>
      <div class="cf-hero-texte">
        <span class="cf-surtitre">Prévoyance</span>
        <h1>Analyse de prévoyance</h1>
        <p>Retraite, invalidité et décès : ce que versent l’AVS/AI, la LPP, la LAA et le 3e pilier face aux besoins de la famille — recalculé en direct pendant la saisie.</p>
      </div>
      <div class="cf-hero-actions">
        <div class="cf-choix-client">
          <input id="ap-client" list="ap-liste-clients" placeholder="Client (ou simulation libre)" autocomplete="off" aria-label="Client" value="${apEsc(_ap.clientId ? apNomClient(allClients.find(c => c.id === _ap.clientId)) : '')}" onchange="apChoisirClientParNom(this.value)"/>
          <datalist id="ap-liste-clients">${allClients.filter(c => !estEntreprise(c)).map(c => `<option value="${apEsc(apNomClient(c))}"></option>`).join('')}</datalist>
        </div>
        <div class="cf-boutons">
          <button type="button" class="fcx-btn-blanc" onclick="apEnregistrer()">💾 Enregistrer sur la fiche</button>
          <button type="button" class="fcx-btn-verre" onclick="apRapport()">📄 Rapport client</button>
          <button type="button" class="fcx-btn-verre" onclick="apNouvelle()">↺ Nouvelle</button>
        </div>
        <div id="ap-analyses" class="ap-analyses">${apHtmlAnalyses()}</div>
      </div>
    </section>
    <div class="ap-grille">
      <aside class="ap-saisie">${apFormulaire()}</aside>
      <section class="ap-droite"><div id="ap-resultats">${apResultats()}</div>
      </section>
    </div>
  </div>`;
}
function apNomClient(c) { return c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : ''; }
function apHtmlAnalyses() {
  if (!_ap.clientId || !_ap.analyses.length) return '';
  return `<select aria-label="Analyses enregistrées" onchange="if(this.value)apChargerAnalyse(this.value)"><option value="">Analyses enregistrées (${_ap.analyses.length})</option>${_ap.analyses.map(a => `<option value="${a.id}">${fmtDate(a.created_at)}${a.donnees ? '' : ' (ancien format)'}</option>`).join('')}</select>`;
}
function apChoisirClientParNom(nom) {
  const c = allClients.find(x => apNomClient(x).toLowerCase() === (nom || '').trim().toLowerCase());
  if (c) apChoisirClient(c.id);
  else if (!nom) _ap.clientId = null;
  else showError('Client introuvable — choisis un nom dans la liste, ou laisse vide pour une simulation libre.');
}
async function apChoisirClient(clientId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  _ap.clientId = clientId; _ap.personne = 1;
  const [analyses, dossiers] = await Promise.all([
    dbGet('bilans_prevoyance', `client_id=eq.${clientId}&select=id,created_at,resume,donnees,html_snapshot&order=created_at.desc`),
    dbGet('dossiers_conseil', `client_id=eq.${clientId}&select=situation`),
  ]);
  _ap.analyses = Array.isArray(analyses) ? analyses : [];
  const derniere = _ap.analyses.find(a => a.donnees);
  if (derniere) {
    _ap.d = apFusion(AP_DEFAUT(), derniere.donnees);
    showError(`Analyse du ${fmtDate(derniere.created_at)} reprise — modifie puis enregistre une nouvelle version.`);
  } else {
    const d = AP_DEFAUT();
    d.nom = apNomClient(c);
    d.sexe = c.civilite === 'Madame' ? 'F' : 'H';
    d.conjoint.sexe = d.sexe === 'F' ? 'H' : 'F';
    d.naissance = c.date_naissance || '';
    const ec = (c.etat_civil || '').toLowerCase();
    d.etat_civil = /mari|pacs|partenariat/.test(ec) ? 'marie' : /divor/.test(ec) ? 'divorce' : /veu/.test(ec) ? 'veuf' : /concub/.test(ec) ? 'concubin' : ec ? 'celibataire' : 'marie';
    d.salaire = c.revenu || '';
    d.enfants = allClients.filter(x => x.pere_id === c.id || x.mere_id === c.id).map(x => (x.date_naissance || '').slice(0, 4)).filter(Boolean).join(', ');
    d.p3.versement3a = c.montant_3a || '';
    const s = Array.isArray(dossiers) && dossiers[0] ? dossiers[0].situation || {} : {};
    if (s.prevoyance) {
      if (s.prevoyance.salaire_brut) d.salaire = s.prevoyance.salaire_brut;
      if (s.prevoyance.salaire_brut_conjoint) d.conjoint.salaire = s.prevoyance.salaire_brut_conjoint;
      if (s.prevoyance.versement_3a) d.p3.versement3a = s.prevoyance.versement_3a;
      if (s.prevoyance.lpp_capital_projete) d.lpp.capital_65 = s.prevoyance.lpp_capital_projete;
      if (s.prevoyance.age_retraite) d.age_retraite = s.prevoyance.age_retraite;
    }
    if (s.patrimoine) { if (s.patrimoine.lpp) d.lpp.avoir = s.patrimoine.lpp; if (s.patrimoine.pilier3a) d.p3.avoir3a = s.patrimoine.pilier3a; }
    _ap.d = d;
  }
  apRerendre();
}
function apFusion(base, src) {
  Object.keys(src || {}).forEach(k => {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && base[k] && typeof base[k] === 'object') apFusion(base[k], src[k]);
    else base[k] = src[k];
  });
  return base;
}
function apChargerAnalyse(id) {
  const a = _ap.analyses.find(x => x.id === id);
  if (!a) return;
  if (!a.donnees) { window._bilansPrevoyanceActuel = _ap.analyses; if (typeof voirBilanSauvegarde === 'function') voirBilanSauvegarde(id); return; }
  _ap.d = apFusion(AP_DEFAUT(), a.donnees);
  apRerendre();
}
function apNouvelle() { _ap = { d: AP_DEFAUT(), clientId: null, scenario: 'retraite', personne: 1, unite: _ap.unite, analyses: [] }; apRerendre(); }
function apRerendre() { const main = document.getElementById('main-content'); if (main && currentView === 'analyse-prevoyance') main.innerHTML = viewAnalysePrevoyance(); }

// ── Formulaire ──────────────────────────────────────────────────────────────────────────────
function apChamp(chemin, label, o = {}) {
  const v = apGet(_ap.d, chemin); const val = v == null ? '' : v;
  const cls = `ap-champ ${o.large ? 'large' : ''}`;
  if (o.type === 'select') return `<label class="${cls}"><span>${label}</span><select data-ap="${chemin}" onchange="apMaj(this)">${o.options.map(([x, l]) => `<option value="${x}" ${String(val) === String(x) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  if (o.type === 'date') return `<label class="${cls}"><span>${label}</span><input type="date" data-ap="${chemin}" value="${apEsc(val)}" onchange="apMaj(this)"/></label>`;
  if (o.type === 'texte') return `<label class="${cls}"><span>${label}</span><input data-ap="${chemin}" value="${apEsc(val)}" placeholder="${apEsc(o.placeholder || '')}" oninput="apMaj(this)"/>${o.aide ? `<small>${o.aide}</small>` : ''}</label>`;
  if (o.type === 'case') return `<label class="ap-case ${o.large ? 'large' : ''}"><input type="checkbox" data-ap="${chemin}" ${val ? 'checked' : ''} onchange="apMaj(this)"/> ${label}</label>`;
  return `<label class="${cls}"><span>${label}</span><div class="cf-saisie"><input data-ap="${chemin}" data-num="1" inputmode="decimal" value="${apEsc(val)}" placeholder="${apEsc(o.placeholder || '')}" oninput="apMaj(this)"/>${o.unite ? `<em>${o.unite}</em>` : ''}</div>${o.aide ? `<small>${o.aide}</small>` : ''}</label>`;
}
function apSection(titre, icone, contenu, ouvert) {
  return `<details class="ap-bloc" ${ouvert ? 'open' : ''}><summary><span>${icone}</span>${titre}</summary><div class="ap-champs">${contenu}</div></details>`;
}
function apChampsLpp(b) {
  return `${apChamp(b + 'avoir', 'Avoir de vieillesse actuel', { unite: 'CHF' })}
    ${apChamp(b + 'capital_65', 'Capital projeté à la retraite', { unite: 'CHF' })}
    ${apChamp(b + 'rente_vieillesse', 'Rente de vieillesse projetée', { unite: 'CHF/an' })}
    ${apChamp(b + 'taux_conversion', 'Taux de conversion', { unite: '%' })}
    ${apChamp(b + 'rente_invalidite', 'Rente d’invalidité', { unite: 'CHF/an' })}
    ${apChamp(b + 'rente_enfant', 'Rente d’enfant (invalide / orphelin)', { unite: 'CHF/an' })}
    ${apChamp(b + 'rente_conjoint', 'Rente de conjoint survivant', { unite: 'CHF/an' })}
    ${apChamp(b + 'capital_deces', 'Capital décès supplémentaire', { unite: 'CHF' })}`;
}
function apFormulaire() {
  const d = _ap.d;
  const couple = apCouple(d);
  const n2 = d.conjoint.nom || 'conjoint·e';
  return `
    ${apSection('Situation familiale', '👨‍👩‍👧', `
      ${apChamp('etat_civil', 'État civil', { type: 'select', options: [['marie', 'Marié(e) / partenariat enregistré'], ['concubin', 'Concubinage'], ['celibataire', 'Célibataire'], ['divorce', 'Divorcé(e)'], ['veuf', 'Veuf / veuve']] })}
      ${apChamp('enfants', 'Enfants — années de naissance', { type: 'texte', placeholder: 'ex. 2015, 2018', aide: 'rentes jusqu’à 18 ans, 25 ans en formation' })}
      ${d.etat_civil === 'marie' ? apChamp('mariage_5ans', 'Marié(e)s / partenaires depuis au moins 5 ans', { type: 'case', large: true }) : ''}
    `, true)}
    ${apSection(`Personne 1${d.nom ? ' — ' + apEsc(d.nom) : ''}`, '👤', `
      ${apChamp('nom', 'Nom', { type: 'texte', large: true, placeholder: 'Nom du client ou prospect' })}
      ${apChamp('sexe', 'Sexe', { type: 'select', options: [['H', 'Homme'], ['F', 'Femme']] })}
      ${apChamp('naissance', 'Date de naissance', { type: 'date' })}
      ${apChamp('salaire', 'Revenu brut annuel (AVS)', { unite: 'CHF/an' })}
      ${apChamp('statut', 'Statut', { type: 'select', options: [['salarie', 'Salarié(e)'], ['independant', 'Indépendant(e)']] })}
      ${apChamp('age_retraite', 'Âge de la retraite', { unite: 'ans' })}
      ${apChamp('lacunes_avs', 'Années AVS manquantes', { unite: 'ans' })}
    `, true)}
    ${apSection('Personne 1 — certificat LPP', '🏦', `${apChampsLpp('lpp.')}
      ${d.etat_civil === 'concubin' ? apChamp('lpp.concubin_couvert', 'Le règlement couvre le partenaire (désigné)', { type: 'case', large: true }) : ''}
      ${apChamp('laa.salaire_assure', 'Salaire assuré LAA', { unite: 'CHF/an', aide: 'par défaut le revenu, max. 148’200' })}
      <p class="ap-aide large">Laisser vide ce qui n’est pas connu : le minimum légal est utilisé.</p>`, false)}
    ${apSection('Personne 1 — 3e pilier', '🌱', `
      ${apChamp('p3.avoir3a', 'Avoir 3e pilier A', { unite: 'CHF' })}${apChamp('p3.versement3a', 'Versement annuel 3a', { unite: 'CHF/an' })}
      ${apChamp('p3.rente_inv_privee', 'Rente d’invalidité privée', { unite: 'CHF/an' })}${apChamp('p3.capital_deces_risque', 'Capital décès (risque pur)', { unite: 'CHF' })}
    `, false)}
    ${couple ? `
    ${apSection(`Personne 2${d.conjoint.nom ? ' — ' + apEsc(d.conjoint.nom) : ' — conjoint·e'}`, '👤', `
      ${apChamp('conjoint.nom', 'Nom', { type: 'texte', large: true })}
      ${apChamp('conjoint.sexe', 'Sexe', { type: 'select', options: [['F', 'Femme'], ['H', 'Homme']] })}
      ${apChamp('conjoint.naissance', 'Date de naissance', { type: 'date' })}
      ${apChamp('conjoint.salaire', 'Revenu brut annuel (AVS)', { unite: 'CHF/an' })}
      ${apChamp('conjoint.statut', 'Statut', { type: 'select', options: [['salarie', 'Salarié(e)'], ['independant', 'Indépendant(e)']] })}
      ${apChamp('conjoint.age_retraite', 'Âge de la retraite', { unite: 'ans' })}
      ${apChamp('conjoint.lacunes_avs', 'Années AVS manquantes', { unite: 'ans' })}
    `, true)}
    ${apSection(`Personne 2 — certificat LPP & 3e pilier`, '🏦', `${apChampsLpp('conjoint.lpp.')}
      ${apChamp('conjoint.laa.salaire_assure', 'Salaire assuré LAA', { unite: 'CHF/an' })}
      ${apChamp('conjoint.p3.avoir3a', 'Avoir 3e pilier A', { unite: 'CHF' })}${apChamp('conjoint.p3.versement3a', 'Versement annuel 3a', { unite: 'CHF/an' })}
      ${apChamp('conjoint.p3.rente_inv_privee', 'Rente d’invalidité privée', { unite: 'CHF/an' })}${apChamp('conjoint.p3.capital_deces_risque', 'Capital décès (risque pur)', { unite: 'CHF' })}
    `, false)}` : ''}
    ${apSection('Besoins & hypothèses', '🎯', `
      ${apChamp('besoins.retraite', 'Besoin à la retraite', { unite: '% du revenu' })}
      ${apChamp('besoins.invalidite', 'Besoin en invalidité', { unite: '% du revenu' })}
      ${apChamp('besoins.deces', 'Besoin des survivants', { unite: '% du revenu' })}
      ${apChamp('p3.rendement', 'Rendement de l’épargne', { unite: '%/an' })}
      ${apChamp('besoins.horizon', 'Planifier jusqu’à l’âge de', { unite: 'ans' })}
      <p class="ap-aide large">Usuel : 70–80 % du revenu brut. Le besoin de retraite porte sur le revenu du ménage.</p>
    `, true)}`;
}
function apMaj(el) {
  const p = el.dataset.ap;
  const v = el.type === 'checkbox' ? el.checked : el.dataset.num ? (el.value.trim() === '' ? '' : apNum(el.value)) : el.value;
  apSet(_ap.d, p, v);
  if (p === 'etat_civil' || p === 'nom' && false) { const z = document.querySelector('.ap-saisie'); if (z) z.innerHTML = apFormulaire(); }
  apRafraichir();
}
function apRafraichir() { const r = document.getElementById('ap-resultats'); if (r) r.innerHTML = apResultats(); }

// ── Résultats ───────────────────────────────────────────────────────────────────────────────
function apResultats() {
  const d = _ap.d;
  if (!apNum(d.salaire) || !d.naissance) return `<div class="dbx-vide"><img src="assets/logos/rex-mascotte-hd.png" alt=""/><strong>Commence par la date de naissance et le revenu</strong><span>Retraite, invalidité et décès — maladie ou accident — s’affichent et se recalculent au fil de la saisie.</span></div>`;
  const A = apCalculer(d);
  if (!A.pers[_ap.personne]) _ap.personne = 1;
  const sel = apScen(A, _ap.scenario, _ap.personne);
  const t = AP_SCENARIOS.find(s => s[0] === _ap.scenario) || AP_SCENARIOS[0];
  const carte = (k, ic, l, s) => {
    const couv = s.besoin ? Math.min(1, s.total / s.besoin) : 1;
    const ton = !s.besoin || couv >= 0.95 ? 'ok' : couv >= 0.75 ? 'moyen' : 'critique';
    return `<button type="button" class="ap-carte ${ton} ${_ap.scenario === k ? 'actif' : ''}" onclick="_ap.scenario='${k}';apRafraichir()">
      <span class="ap-carte-titre">${ic} ${l}</span>
      <svg viewBox="0 0 36 36" class="ap-anneau" aria-hidden="true"><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" stroke-width="4"/><circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="${Math.round(couv * 100)} 100" transform="rotate(-90 18 18)"/></svg>
      <span class="ap-carte-pct">${s.besoin ? Math.round(couv * 100) + ' %' : '—'}</span>
      <span class="ap-carte-lacune">${!s.besoin ? 'pas de besoin' : s.lacune ? `lacune ${apCHF(s.lacune)}${apSuffixe()}` : 'couvert ✓'}</span>
    </button>`;
  };
  return `
    <div class="ap-barre-haut">
      <h2>Vue d’ensemble</h2>
      <div class="ap-commandes">
        ${A.pers[2] ? `<div class="dbx-onglets" role="group" aria-label="Personne touchée">${[1, 2].map(i => `<button type="button" class="${_ap.personne === i ? 'actif' : ''}" onclick="_ap.personne=${i};if(_ap.scenario==='retraite')_ap.scenario='inv_maladie';apRafraichir()">${apEsc(apNomPers(d, i))}</button>`).join('')}</div>` : ''}
        <div class="dbx-onglets" role="group" aria-label="Unité">
          <button type="button" class="${_ap.unite === 'mois' ? 'actif' : ''}" onclick="_ap.unite='mois';apRafraichir()">/mois</button>
          <button type="button" class="${_ap.unite === 'an' ? 'actif' : ''}" onclick="_ap.unite='an';apRafraichir()">/an</button>
        </div>
      </div>
    </div>
    <div class="ap-apercu">
      ${carte('retraite', '🌅', A.couple ? 'Retraite du ménage' : 'Retraite', A.retraite)}
      ${AP_RISQUES.map(([k, ic, l]) => carte(k, ic, l, A.pers[_ap.personne][k])).join('')}
    </div>
    ${A.pers[2] ? `<p class="ap-sous">Risques affichés pour : <b>${apEsc(apNomPers(d, _ap.personne))}</b> — change de personne ci-dessus.</p>` : ''}

    <section class="dbx-carte ap-detail">
      <header class="dbx-carte-tete"><h2>${t[1]} ${_ap.scenario === 'retraite' ? (A.couple ? 'Retraite du ménage' : 'Retraite') : `${t[2]}${A.pers[2] ? ' — ' + apEsc(apNomPers(d, _ap.personne)) : ''}`}</h2><span class="dbx-carte-sous">montants ${_ap.unite === 'mois' ? 'mensuels' : 'annuels'}</span></header>
      <div class="ap-visuel">
      <div class="ap-colonnes">${apSvgColonnes(sel, _ap.scenario === 'retraite' ? 'À la retraite' : _ap.scenario.startsWith('inv') ? 'En invalidité' : 'Après un décès')}
        <div class="ap-legende"><span><i class="ap-revenu"></i>Revenu actuel</span>${sel.items.map(x => `<span><i style="background:${AP_COULEURS[x.src]}"></i>${AP_LIBELLES[x.src]}</span>`).filter((v, i, a) => a.indexOf(v) === i).join('')}${sel.lacune ? '<span><i class="ap-lacune"></i>Lacune</span>' : ''}</div>
      </div>
      <div class="ap-lignes">
        <div class="ap-ligne discret"><span>Revenu actuel</span><b>${apCHF(sel.revenu)}</b></div>
        <div class="ap-ligne discret"><span>Besoin de prévoyance</span><b>${apCHF(sel.besoin)}</b></div>
        ${sel.items.map(x => `<div class="ap-ligne"><i style="background:${AP_COULEURS[x.src]}"></i><span>${x.label}</span><b>${apCHF(x.montant)}</b></div>`).join('') || '<div class="dbx-vide-petit">Aucune prestation dans cette situation.</div>'}
        <div class="ap-ligne total"><span>Revenus dans cette situation</span><b>${apCHF(sel.total)}</b></div>
        ${sel.lacune ? `<div class="ap-ligne total neg"><span>Lacune</span><b>${apCHF(sel.lacune)}</b></div>` : sel.besoin ? `<div class="ap-ligne total pos"><span>Besoin couvert — excédent</span><b>${apCHF(sel.surplus)}</b></div>` : ''}
      </div>
      </div>
      ${apConseil(_ap.scenario, sel)}
      ${sel.serie && sel.serie.length > 1 ? `<div class="ap-temps"><h3>Évolution dans le temps</h3><p class="ap-temps-aide">${_ap.scenario === 'retraite' ? 'Revenu du ménage année après année : activité jusqu’à la retraite, puis rentes.' : `Si l’événement survenait aujourd’hui : ce que ${_ap.scenario.startsWith('deces') ? 'la famille' : 'le ménage'} toucherait chaque année.`}</p>${apSvgTemps(sel.serie, sel.serieLibelle)}</div>` : ''}
      ${sel.capitaux && sel.capitaux.some(c => c[1] > 0) ? `<div class="ap-capitaux">${sel.capitaux.filter(c => c[1] > 0).map(c => `<span>${c[0]} <b>${apCHFbrut(c[1])}</b></span>`).join('')}</div>` : ''}
      ${sel.note ? `<p class="cf-mention">${sel.note}</p>` : ''}
    </section>
    ${apCoach(A)}
    <p class="cf-mention">Estimation indicative selon les règles 2026 simplifiées (sans plafonnement des rentes de survivants ni réduction pour retraite anticipée). À confirmer par l’extrait AVS et le certificat de prévoyance.</p>`;
}

function apConseil(k, s) {
  if (!s.besoin || !s.lacune) return '';
  if (k === 'retraite') return `<div class="cf-note rouge">Il manque <b>${apCHFbrut(s.lacune)}/an</b> à la retraite, soit un capital d’environ <b>${apCHFbrut(s.capitalManquant)}</b> : épargne de <b>${apCHFbrut(s.epargneMensuelle)}/mois</b> dès aujourd’hui (${fmtCHF(apNum(_ap.d.p3.rendement))} %/an ; ${apCHFbrut(s.epargne0)}/mois sans rendement).</div>`;
  if (k.startsWith('inv')) return `<div class="cf-note rouge">Rente d’invalidité à assurer (3e pilier) : <b>${apCHFbrut(s.renteAAssurer)}/an</b>${k === 'inv_maladie' ? ' — la maladie est la cause la plus fréquente d’invalidité' : ''}.</div>`;
  if (k.startsWith('deces')) return `<div class="cf-note rouge">Capital nécessaire sur ${s.dureeBesoin} ans : ${apCHFbrut(s.capitalNecessaire)} — capital décès à assurer : <b>${apCHFbrut(s.capitalAAssurer)}</b> (après capitaux existants).</div>`;
  return '';
}

// « Coach » : synthèse en phrases, comme la dernière page des rapports du marché, en plus direct
function apCoach(A) {
  const msgs = [];
  const nom = i => apEsc(apNomPers(_ap.d, i));
  Object.keys(A.pers).forEach(i => {
    const P = A.pers[i], qui = A.pers[2] ? ` (${nom(+i)})` : '';
    const inv = Math.max(P.inv_maladie.lacune, P.inv_accident.lacune);
    msgs.push(inv ? ['alerte', `Invalidité${qui} : lacune jusqu’à ${apCHFbrut(inv / 12)}/mois — une rente d’invalidité de ${apCHFbrut(inv)}/an la comblerait.`] : ['ok', `Invalidité${qui} : besoin de revenu couvert.`]);
    const dec = Math.max(P.deces_maladie.capitalAAssurer || 0, P.deces_accident.capitalAAssurer || 0);
    if (P.deces_maladie.besoin) msgs.push(dec ? ['alerte', `Décès${qui} : capital de ${apCHFbrut(dec)} à assurer pour protéger la famille.`] : ['ok', `Décès${qui} : le revenu des survivants est couvert.`]);
  });
  msgs.push(A.retraite.lacune ? ['alerte', `Retraite : il manque ${apCHFbrut(A.retraite.lacune)}/an — ${apCHFbrut(A.retraite.epargneMensuelle)}/mois d’épargne à prévoir (rachats LPP déductibles, 3e pilier, placements).`] : ['ok', 'Retraite : le besoin de revenu est couvert.']);
  A.remarques.forEach(r => msgs.push(['info', r]));
  return `<section class="dbx-carte ap-coach"><header class="dbx-carte-tete"><h2>En résumé</h2></header>
    ${msgs.map(([ton, m]) => `<div class="ap-coach-ligne ${ton}"><span>${ton === 'ok' ? '✓' : ton === 'alerte' ? '!' : 'i'}</span><p>${m}</p></div>`).join('')}</section>`;
}

// ── Diagrammes (SVG autonomes : couleurs en dur → identiques à l'écran et dans le rapport) ────
let _apSvgId = 0;
const AP_GRIS_TEXTE = '#8A94A8';
const AP_ACTIVITE = '#CBD5E1';
function apFmtK(v) { const x = Math.round(v); return Math.abs(x) >= 1000 ? fmtCHF(Math.round(x / 1000)) + 'k' : fmtCHF(x); }
function apPattern(id) { return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#FECACA"/><rect width="4" height="8" fill="#EF4444"/></pattern>`; }

// Colonnes verticales : « Aujourd'hui » (revenu actuel) vs « En cas de… » (prestations empilées + lacune), ligne du besoin
function apSvgColonnes(s, titreSituation, annuelForce) {
  const f = v => annuelForce || _ap.unite === 'an' ? v : v / 12;
  const W = 320, H = 240, bas = 200, haut = 22, g = 44;
  const max = Math.max(f(s.besoin), f(s.total + s.lacune), f(s.revenu || 0), 1) * 1.08;
  const y = v => bas - (v / max) * (bas - haut);
  const pid = 'aph' + (++_apSvgId);
  const col = (x, w, segs) => { let cum = 0; return segs.map(([v, fill, tip]) => { const h = (v / max) * (bas - haut); const r = `<rect x="${x}" y="${(bas - cum - h).toFixed(1)}" width="${w}" height="${Math.max(0, h).toFixed(1)}" fill="${fill}"><title>${tip}</title></rect>`; cum += h; return r; }).join(''); };
  const segs = [...s.items.map(x => [f(x.montant), AP_COULEURS[x.src], `${x.label} : ${fmtCHF(Math.round(f(x.montant)))}`]), ...(s.lacune ? [[f(s.lacune), `url(#${pid})`, `Lacune : ${fmtCHF(Math.round(f(s.lacune)))}`]] : [])];
  const ticks = [0, max / 2 / 1.08, max / 1.08].map(v => `<line x1="${g}" x2="${W - 6}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#94A3B8" stroke-opacity=".25"/><text x="${g - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${AP_GRIS_TEXTE}">${apFmtK(v)}</text>`).join('');
  const yb = y(f(s.besoin));
  return `<svg viewBox="0 0 ${W} ${H}" class="ap-svg" role="img" aria-label="Revenu actuel et revenu dans cette situation" font-family="Arial,Helvetica,sans-serif">
    <defs>${apPattern(pid)}</defs>${ticks}
    ${col(g + 22, 88, [[f(s.revenu || 0), '#A5B4FC', `Revenu actuel : ${fmtCHF(Math.round(f(s.revenu || 0)))}`]])}
    ${col(g + 150, 88, segs)}
    <text x="${g + 66}" y="${bas + 16}" text-anchor="middle" font-size="11" fill="${AP_GRIS_TEXTE}">Aujourd’hui</text>
    <text x="${g + 194}" y="${bas + 16}" text-anchor="middle" font-size="11" fill="${AP_GRIS_TEXTE}">${apEsc(titreSituation || 'Dans cette situation')}</text>
    <text x="${g + 66}" y="${(y(f(s.revenu || 0)) - 5).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="bold" fill="#6366F1">${apFmtK(f(s.revenu || 0))}</text>
    <text x="${g + 194}" y="${(y(f(s.total + s.lacune)) - 5).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="bold" fill="${s.lacune ? '#DC2626' : '#16A34A'}">${apFmtK(f(s.total))}</text>
    ${s.besoin ? `<line x1="${g}" x2="${W - 6}" y1="${yb.toFixed(1)}" y2="${yb.toFixed(1)}" stroke="#EF4444" stroke-width="2.5"/><text x="${W - 8}" y="${(yb - 5).toFixed(1)}" text-anchor="end" font-size="10" font-weight="bold" fill="#EF4444">besoin ${apFmtK(f(s.besoin))}</text>` : ''}
  </svg>`;
}

// Évolution dans le temps : une barre par année (activité / AVS-AI / LPP / LAA / 3e pilier + lacune), besoin en escalier
function apSvgTemps(serie, libelleAxe, annuelForce) {
  if (!serie || serie.length < 2) return '';
  const f = v => annuelForce || _ap.unite === 'an' ? v : v / 12;
  const W = 760, H = 270, g = 48, bas = 214, haut = 18, droite = W - 10;
  const pid = 'apt' + (++_apSvgId);
  const tot = pt => Object.values(pt.v).reduce((s, x) => s + x, 0);
  const max = Math.max(...serie.map(pt => Math.max(f(tot(pt)), f(pt.besoin || 0))), 1) * 1.08;
  const y = v => bas - (v / max) * (bas - haut);
  const n = serie.length, pas = (droite - g) / n, bw = Math.max(2, pas * 0.78);
  const ordre = [['activite', AP_ACTIVITE, 'Revenu d’activité'], ['avs', AP_COULEURS.avs, 'AVS / AI'], ['lpp', AP_COULEURS.lpp, 'LPP'], ['lpps', AP_COULEURS.lpps, 'LPP rentes subsidiaires'], ['laa', AP_COULEURS.laa, 'LAA'], ['p3', AP_COULEURS.p3, '3e pilier']];
  const barres = serie.map((pt, i) => {
    const x = g + i * pas + (pas - bw) / 2;
    let cum = 0;
    const r = ordre.map(([k, fill, l]) => { const v = f(pt.v[k] || 0); if (v <= 0) return ''; const h = (v / max) * (bas - haut); const s = `<rect x="${x.toFixed(1)}" y="${(bas - cum - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"><title>${pt.an}${pt.age != null ? ` (${pt.age} ans)` : ''} — ${l} : ${fmtCHF(Math.round(v))}</title></rect>`; cum += h; return s; }).join('');
    const lac = pt.besoin ? Math.max(0, f(pt.besoin) - f(tot(pt))) : 0;
    const rl = lac > 0 ? `<rect x="${x.toFixed(1)}" y="${(bas - cum - (lac / max) * (bas - haut)).toFixed(1)}" width="${bw.toFixed(1)}" height="${((lac / max) * (bas - haut)).toFixed(1)}" fill="url(#${pid})"><title>${pt.an} — lacune : ${fmtCHF(Math.round(lac))}</title></rect>` : '';
    return r + rl;
  }).join('');
  // Besoin en escalier (interrompu quand pas de besoin défini, ex. avant la retraite)
  let besoin = '', ouvert = false;
  serie.forEach((pt, i) => {
    const x1 = g + i * pas, x2 = x1 + pas;
    if (pt.besoin) { const yy = y(f(pt.besoin)).toFixed(1); besoin += `${ouvert ? 'L' : 'M'}${x1.toFixed(1)},${yy} L${x2.toFixed(1)},${yy} `; ouvert = true; } else ouvert = false;
  });
  const ticks = [0, max / 2 / 1.08, max / 1.08].map(v => `<line x1="${g}" x2="${droite}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#94A3B8" stroke-opacity=".25"/><text x="${g - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${AP_GRIS_TEXTE}">${apFmtK(v)}</text>`).join('');
  const etiq = serie.map((pt, i) => (i % 5 === 0 || i === n - 1) ? `<text x="${(g + i * pas + pas / 2).toFixed(1)}" y="${bas + 14}" text-anchor="middle" font-size="10" fill="${AP_GRIS_TEXTE}">${pt.age != null ? pt.age : ''}</text><text x="${(g + i * pas + pas / 2).toFixed(1)}" y="${bas + 26}" text-anchor="middle" font-size="9" fill="${AP_GRIS_TEXTE}" opacity=".75">${pt.an}</text>` : '').join('');
  let dernierEvtX = -99;
  const evts = serie.map((pt, i) => {
    if (!pt.evt) return '';
    const x = g + i * pas;
    const decal = x - dernierEvtX < 70 ? 12 : 0; dernierEvtX = x;
    return `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${haut - 4}" y2="${bas}" stroke="#0E1B33" stroke-opacity=".45" stroke-dasharray="3 3"/><text x="${(x + 3).toFixed(1)}" y="${haut + 6 + decal}" font-size="9.5" font-weight="bold" fill="#475569">${apEsc(pt.evt)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="ap-svg ap-svg-temps" role="img" aria-label="Évolution dans le temps" font-family="Arial,Helvetica,sans-serif">
    <defs>${apPattern(pid)}</defs>${ticks}${barres}
    ${besoin ? `<path d="${besoin}" fill="none" stroke="#EF4444" stroke-width="2.5"/>` : ''}
    ${evts}${etiq}
    <text x="${g}" y="${H - 4}" font-size="9.5" fill="${AP_GRIS_TEXTE}">${apEsc(libelleAxe || 'âge')} · année · montants ${annuelForce || _ap.unite === 'an' ? 'annuels' : 'mensuels'}</text>
  </svg>
  <div class="ap-legende"><span><i style="background:${AP_ACTIVITE}"></i>Revenu d’activité</span><span><i style="background:${AP_COULEURS.avs}"></i>AVS / AI</span><span><i style="background:${AP_COULEURS.lpp}"></i>LPP</span><span><i style="background:${AP_COULEURS.lpps}"></i>LPP rentes subsidiaires</span><span><i style="background:${AP_COULEURS.laa}"></i>LAA</span><span><i style="background:${AP_COULEURS.p3}"></i>3e pilier</span><span><i class="ap-lacune"></i>Lacune</span><span><i style="background:#EF4444;height:3px"></i>Besoin</span></div>`;
}

function apGraphique(s) {
  const max = Math.max(s.besoin, s.total, s.revenu || 0, 1);
  const pct = v => (v / max * 100).toFixed(2) + '%';
  return `<div class="ap-graph">
    <div class="ap-graph-ligne"><span class="ap-graph-lib">Aujourd’hui</span><div class="ap-graph-piste"><span class="ap-revenu" style="width:${pct(s.revenu || 0)}"></span></div><b>${apCHF(s.revenu || 0)}</b></div>
    <div class="ap-graph-ligne"><span class="ap-graph-lib">Situation</span><div class="ap-graph-piste">
      ${s.items.map(x => `<span style="width:${pct(x.montant)};background:${AP_COULEURS[x.src]}" title="${apEsc(x.label)} : ${apCHF(x.montant)}"></span>`).join('')}
      ${s.lacune ? `<span class="ap-lacune" style="width:${pct(s.lacune)}" title="Lacune : ${apCHF(s.lacune)}"></span>` : ''}
    </div><b>${apCHF(s.total)}</b></div>
    ${s.besoin ? `<div class="ap-graph-besoin" style="--x:${pct(s.besoin)}"><span>besoin ${apCHF(s.besoin)}</span></div>` : ''}
    <div class="ap-legende"><span><i class="ap-revenu"></i>Revenu actuel</span><span><i style="background:${AP_COULEURS.avs}"></i>AVS / AI</span><span><i style="background:${AP_COULEURS.lpp}"></i>LPP</span><span><i style="background:${AP_COULEURS.laa}"></i>LAA</span><span><i style="background:${AP_COULEURS.p3}"></i>3e pilier</span>${s.lacune ? '<span><i class="ap-lacune"></i>Lacune</span>' : ''}</div>
  </div>`;
}

// ── Enregistrement & rapport ────────────────────────────────────────────────────────────────
function apResume(A) {
  const f = s => !s.besoin ? 'pas de besoin' : s.lacune ? `lacune CHF ${fmtCHF(Math.round(s.lacune / 12))}/mois` : 'couvert';
  const P = A.pers[1];
  return `Retraite : ${f(A.retraite)} · Invalidité maladie : ${f(P.inv_maladie)} · accident : ${f(P.inv_accident)} · Décès maladie : ${f(P.deces_maladie)} · accident : ${f(P.deces_accident)}${A.pers[2] ? ' (personne 1)' : ''}`;
}
async function apEnregistrer() {
  if (!_ap.clientId) { showError('Choisis d’abord un client (en haut) pour enregistrer l’analyse sur sa fiche.'); return; }
  if (!apNum(_ap.d.salaire) || !_ap.d.naissance) { showError('Renseigne au moins la date de naissance et le revenu.'); return; }
  const A = apCalculer(_ap.d);
  const r = await dbPost('bilans_prevoyance', { client_id: _ap.clientId, nom: _ap.d.nom || apNomClient(allClients.find(c => c.id === _ap.clientId)), resume: apResume(A), html_snapshot: apRapportCorps(A), donnees: _ap.d, auteur: currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : null });
  if (r && r.error) { showError('Analyse non enregistrée : ' + errMsg(r)); return; }
  logAction('analyse_prevoyance', 'bilans_prevoyance', r && r[0] ? r[0].id : null, apResume(A));
  _ap.analyses = await dbGet('bilans_prevoyance', `client_id=eq.${_ap.clientId}&select=id,created_at,resume,donnees,html_snapshot&order=created_at.desc`) || [];
  const z = document.getElementById('ap-analyses'); if (z) z.innerHTML = apHtmlAnalyses();
  showError('✓ Analyse enregistrée sur la fiche client (onglet Prévoyance).');
}

// Corps du rapport (aussi conservé dans html_snapshot) : styles en ligne, lisible partout
function apRapportCorps(A) {
  const d = _ap.d, uniteSauve = _ap.unite; _ap.unite = 'an';
  const chf = v => fmtCHF(Math.round(v || 0));
  const bloc = (titre, s, k) => {
    const coul = !s.besoin ? '#56627A' : s.lacune ? '#DC2626' : '#16A34A';
    return `<div style="break-inside:avoid;page-break-inside:avoid;margin-bottom:14px;border:1px solid #E2E7EF;border-radius:12px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><b style="font-size:14px;color:#113679">${titre}</b><span style="font-size:12px;color:${coul};font-weight:bold">${!s.besoin ? 'pas de besoin' : s.lacune ? `lacune CHF ${chf(s.lacune)}/an` : 'besoin couvert ✓'}</span></div>
      <div style="display:grid;grid-template-columns:300px 1fr;gap:18px;align-items:center">
      <div>${apSvgColonnes(s, k === 'retraite' ? 'À la retraite' : k.startsWith('inv') ? 'En invalidité' : 'Après un décès', true)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px">
        <tr><td style="color:#56627A;padding:2px 0">Revenu actuel</td><td style="text-align:right">CHF ${chf(s.revenu)}</td></tr>
        <tr><td style="color:#56627A;padding:2px 0">Besoin de prévoyance</td><td style="text-align:right">CHF ${chf(s.besoin)}</td></tr>
        ${s.items.map(x => `<tr><td style="padding:2px 0"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${AP_COULEURS[x.src]};margin-right:6px"></span>${x.label}</td><td style="text-align:right">CHF ${chf(x.montant)}</td></tr>`).join('')}
        <tr><td style="padding:3px 0;border-top:1px solid #E2E7EF"><b>Revenus dans cette situation</b></td><td style="text-align:right;border-top:1px solid #E2E7EF"><b>CHF ${chf(s.total)}</b></td></tr>
        ${s.lacune ? `<tr><td style="padding:3px 0;color:#DC2626"><b>Lacune</b></td><td style="text-align:right;color:#DC2626"><b>CHF ${chf(s.lacune)}</b></td></tr>` : ''}
      </table>
      </div>
      ${s.lacune && s.besoin ? `<div style="font-size:11px;color:#B91C1C;margin-top:6px">${apConseil(k, s).replace(/<[^>]+>/g, '')}</div>` : ''}
      ${s.serie && s.serie.length > 1 ? `<div style="margin-top:10px"><div style="font-size:11.5px;font-weight:bold;color:#113679;margin-bottom:2px">Évolution dans le temps</div>${apSvgTemps(s.serie, s.serieLibelle, true)}</div>` : ''}
    </div>`;
  };
  const [p1, p2] = [A.p1, A.p2];
  const ligne = (l, a, b) => `<tr><td style="padding:3px 0;color:#56627A">${l}</td><td>${a}</td>${A.couple ? `<td>${b}</td>` : ''}</tr>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0E1B33">
    <h3 style="color:#113679;font-size:14px;margin:0 0 6px">Bases de calcul</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:16px;background:#F7F8FB;border-radius:10px">
      <tr><td></td><td><b>${apEsc(apNomPers(d, 1))}</b></td>${A.couple ? `<td><b>${apEsc(apNomPers(d, 2))}</b></td>` : ''}</tr>
      ${ligne('Année de naissance', (p1.naissance || '').slice(0, 4), (p2.naissance || '').slice(0, 4))}
      ${ligne('Revenu brut annuel', 'CHF ' + chf(p1.salaire), 'CHF ' + chf(p2.salaire))}
      ${ligne('Statut', p1.statut === 'salarie' ? 'salarié·e' : 'indépendant·e', p2.statut === 'salarie' ? 'salarié·e' : 'indépendant·e')}
      ${ligne('Situation', { marie: 'marié(e)s / partenariat', concubin: 'concubinage', celibataire: 'célibataire', divorce: 'divorcé(e)', veuf: 'veuf / veuve' }[d.etat_civil] || '', '')}
      ${ligne('Enfants à charge', String(A.enfantsACharge), '')}
    </table>
    ${bloc(A.couple ? '🌅 Retraite du ménage' : '🌅 Retraite', A.retraite, 'retraite')}
    ${Object.keys(A.pers).map(i => AP_RISQUES.map(([k, ic, l]) => bloc(`${ic} ${l}${A.pers[2] ? ' — ' + apEsc(apNomPers(d, +i)) : ''}`, A.pers[i][k], k)).join('')).join('')}
    <div style="break-inside:avoid;border:1px solid #E2E7EF;border-radius:12px;padding:14px 16px;font-size:11.5px">${apCoach(A).replace(/<header[\s\S]*?<\/header>/, '<b style="color:#113679;font-size:13.5px">En résumé</b>').replace(/class="ap-coach-ligne (\w+)"/g, 'style="display:flex;gap:8px;margin-top:6px"').replace(/<span>([✓!i])<\/span>/g, '<b style="width:14px">$1</b>').replace(/<p>/g, '<span>').replace(/<\/p>/g, '</span>')}</div>
  </div>`;
  _ap.unite = uniteSauve;
  return html;
}
function apRapport() {
  if (!apNum(_ap.d.salaire) || !_ap.d.naissance) { showError('Renseigne au moins la date de naissance et le revenu.'); return; }
  const A = apCalculer(_ap.d);
  const nom = _ap.d.nom || (_ap.clientId ? apNomClient(allClients.find(c => c.id === _ap.clientId)) : 'Simulation');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Analyse de prévoyance — ${apEsc(nom)}</title>
    <style>body{margin:0;padding:28px 36px;font-family:Arial,Helvetica,sans-serif}header{display:flex;justify-content:space-between;align-items:flex-end;background:linear-gradient(135deg,#0B2458,#113679 60%,#1A4A9C);color:#fff;border-radius:14px;padding:18px 22px;margin-bottom:18px}h1{font-size:21px;margin:0}header img{height:30px;filter:brightness(0) invert(1)}.sous{color:rgba(255,255,255,.75);font-size:11.5px;margin-top:3px}.mention{font-size:9.5px;color:#8A94A8;margin-top:16px;border-top:1px solid #E2E7EF;padding-top:8px}@page{margin:12mm}.ap-svg{width:100%;height:auto;display:block}.ap-legende{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:9.5px;color:#56627A;margin-top:2px}.ap-legende span{display:inline-flex;align-items:center;gap:4px}.ap-legende i{display:inline-block;width:9px;height:9px;border-radius:2px}.ap-lacune{background:repeating-linear-gradient(45deg,#EF4444 0 4px,#FECACA 4px 8px)}.ap-revenu{background:#A5B4FC}svg rect,svg path,i{-webkit-print-color-adjust:exact;print-color-adjust:exact}@media print{header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
    <header><div><h1>Analyse de prévoyance</h1><div class="sous">${apEsc(nom)} · ${new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>${typeof ASSUREX_LOGO_B64 !== 'undefined' ? `<img src="${ASSUREX_LOGO_B64}" alt="Assurex"/>` : ''}</header>
    ${apRapportCorps(A)}
    <div class="mention">Estimation indicative établie sur la base des informations communiquées, selon les règles légales 2026 simplifiées (AVS/AI avec 13e rente de vieillesse, LPP, LAA). Elle ne remplace ni l'extrait de compte individuel AVS ni le certificat de prévoyance, qui font foi. Assurex Sàrl — courtier en assurances inscrit auprès de la FINMA.</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`;
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  if (!w) showError('Autorise les fenêtres pop-up pour afficher le rapport.');
}
