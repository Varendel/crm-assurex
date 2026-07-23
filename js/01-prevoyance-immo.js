// ═══ CONFIG ═══
const SUPABASE_URL = 'https://gutlkjovmsyazwcomoyt.supabase.co';
const DATE_BASCULE_ASSUREX = '2026-06-01'; // Date à partir de laquelle les commissions sont versées à Assurex
const AI_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/clever-worker`;
const SUPABASE_KEY = 'sb_publishable_DJtZwHKeA5X1ck1coAQFOA_xOd7c02i';

// ═══ AUTOCOMPLÉTION ADRESSES SUISSES (swisstopo geo.admin.ch — sans clé, CORS OK) ═══
const CANTON_MAP = {
  'AG':'AG','AI':'AI','AR':'AR','BE':'BE','BL':'BL','BS':'BS','FR':'FR','GE':'GE',
  'GL':'GL','GR':'GR','JU':'JU','LU':'LU','NE':'NE','NW':'NW','OW':'OW','SG':'SG',
  'SH':'SH','SO':'SO','SZ':'SZ','TG':'TG','TI':'TI','UR':'UR','VD':'VD','VS':'VS',
  'ZG':'ZG','ZH':'ZH',
};

let _addrDebounceTimer = null;
let _addrDropdown = null;

// Parse le champ "detail" de geo.admin.ch : "rue de la paix 1 1003 lausanne 5586 lausanne ch vd"
function _parseGeoDetail(detail) {
  if (!detail) return {};
  const parts = detail.trim().split(' ');
  const canton = CANTON_MAP[parts[parts.length - 1]?.toUpperCase()] || '';
  // NPA = premier token qui est un nombre à 4 chiffres
  let npaIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (/^\d{4}$/.test(parts[i])) { npaIdx = i; break; }
  }
  const npa = npaIdx >= 0 ? parts[npaIdx] : '';
  const rue = npaIdx > 0 ? parts.slice(0, npaIdx).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
  // Ville = mot(s) après NPA jusqu'au prochain nombre ou "ch"
  let ville = '';
  if (npaIdx >= 0) {
    const rest = parts.slice(npaIdx + 1);
    const stopIdx = rest.findIndex(w => /^\d+$/.test(w) || w === 'ch');
    const villeWords = stopIdx >= 0 ? rest.slice(0, stopIdx) : rest.slice(0, 2);
    ville = villeWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return { rue, npa, ville, canton };
}

function initAdresseAutocomplete(inputId, onSelect) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.setAttribute('autocomplete', 'off');
  input.addEventListener('input', () => {
    clearTimeout(_addrDebounceTimer);
    const q = input.value.trim();
    if (q.length < 3) { _closeAddrDropdown(); return; }
    _addrDebounceTimer = setTimeout(() => _fetchAddrSuggestions(q, input, onSelect), 300);
  });
  input.addEventListener('blur', () => setTimeout(_closeAddrDropdown, 200));
}

async function _fetchAddrSuggestions(q, input, onSelect) {
  try {
    const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(q)}&type=locations&origins=address&limit=8&lang=fr`;
    const r = await fetch(url);
    if (!r.ok) return;
    const data = await r.json();
    _showAddrDropdown(data.results || [], input, onSelect);
  } catch(e) { console.error('Addr autocomplete error', e); }
}

function _showAddrDropdown(results, input, onSelect) {
  _closeAddrDropdown();
  if (!results.length) return;
  const rect = input.getBoundingClientRect();
  const dd = document.createElement('div');
  dd.id = 'addr-autocomplete-dd';
  dd.style.cssText = `position:fixed;top:${rect.bottom + 2}px;left:${rect.left}px;width:${Math.max(rect.width, 320)}px;background:#1e293b;border:1px solid #334155;border-radius:10px;z-index:99999;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.5);max-height:260px;overflow-y:auto`;
  results.forEach(res => {
    const attrs = res.attrs || {};
    const parsed = _parseGeoDetail(attrs.detail);
    const label = attrs.label ? attrs.label.replace(/<[^>]+>/g, '') : '';
    if (!label) return;
    const item = document.createElement('div');
    item.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:13px;color:#e2e8f0;border-bottom:1px solid #1e293b;line-height:1.4;transition:background 0.1s';
    item.innerHTML = `<div style="font-weight:700">${label}</div>${parsed.canton ? `<div style="font-size:11px;color:#94a3b8">Canton ${parsed.canton}</div>` : ''}`;
    item.addEventListener('mousedown', () => { onSelect(parsed); _closeAddrDropdown(); });
    item.addEventListener('mouseover', () => item.style.background = '#0f172a');
    item.addEventListener('mouseout', () => item.style.background = 'transparent');
    dd.appendChild(item);
  });
  if (!dd.children.length) return;
  document.body.appendChild(dd);
  _addrDropdown = dd;
}

function _closeAddrDropdown() {
  if (_addrDropdown) { _addrDropdown.remove(); _addrDropdown = null; }
}

// Raccourci recherche Zefix (registre du commerce) — ouvre la recherche pré-remplie dans un nouvel onglet
// À remplacer par une auto-complétion intégrée une fois les identifiants API obtenus (zefix@bj.admin.ch)
function rechercheZefix(inputId) {
  const nom = (document.getElementById(inputId)?.value || '').trim();
  const url = nom
    ? `https://www.zefix.ch/fr/search/entity/list?name=${encodeURIComponent(nom)}&searchType=exact`
    : `https://www.zefix.ch/fr/search/entity/list`;
  window.open(url, '_blank');
}

function bindAdresseAutocomplete(fieldMap) {
  const { adresseId, npaId, villeId, cantonId, npaVilleId, champUnique } = fieldMap;
  const adresseInput = document.getElementById(adresseId);
  if (!adresseInput) return;
  initAdresseAutocomplete(adresseId, ({ rue, npa, ville, canton }) => {
    if (adresseInput) adresseInput.value = champUnique ? `${rue}, ${npa} ${ville}`.trim().replace(/^,\s*/, '') : rue;
    if (npaVilleId) { const el = document.getElementById(npaVilleId); if (el) el.value = `${npa} ${ville}`.trim(); }
    if (npaId) { const el = document.getElementById(npaId); if (el) el.value = npa; }
    if (villeId) { const el = document.getElementById(villeId); if (el) el.value = ville; }
    if (cantonId) { const el = document.getElementById(cantonId); if (el) el.value = canton; }
  });
}

const MSAL_CONFIG = {
  auth: {
    clientId: '4b0a711d-2bd4-41a8-9782-0b7be5daab68',
    authority: 'https://login.microsoftonline.com/a4b1f96c-aa53-4dfc-b2ed-465bb3188198',
    redirectUri: 'https://varendel.github.io/crm-assurex',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  }
};

// ═══ STATE ═══
let currentUser = null;
let currentView = 'dashboard';
let openSections = { vente: true, portefeuille: true, clients: true, compta: true, settings: false };
let allAgents = [];
let allClients = [];
let allRappels = [];
let allCollaborateurs = [];
let msalInstance = null;
let openBordereaux = {};
let contratClientId = null;
let allContrats = [];
let allOpportunites = [];
let prefillOpportunite = null;
let ozAnnualSummary = null;
let allCommissionsAttente = [];
let allFichesPaie = [];
let allCompagniesContacts = [];
let allVehicules = [];
let currentClientId = null;
let currentCampagneId = null;

// Paramètres de taux de commission — modifiables via Paramètres (gestion récurrente)
// Acquisition: santé = primemensuelle x ce facteur ; vie = primemensuelle x12 x facteur(par année du contrat)
// ═══ MARQUAGE CLIENT OZ ASSURE ═══
const OZ_MINI_LOGO = `<span title="Client OZ Assure" style="display:inline-flex;align-items:center;margin-left:4px;vertical-align:middle"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="height:14px;width:14px"><circle cx="50" cy="50" r="45" fill="#1a56db" opacity="0.9"/><text x="50" y="67" text-anchor="middle" font-size="44" font-weight="900" fill="white" font-family="Arial,sans-serif">OZ</text></svg></span>`;

// ═══ MARQUAGE CLIENT EX GROUPE (logo officiel) ═══
const COFIDEX_MINI_LOGO = `<span title="Client EX Groupe" style="display:inline-flex;align-items:center;margin-left:4px;vertical-align:middle;border-radius:3px;overflow:hidden"><svg xmlns="http://www.w3.org/2000/svg" viewBox="670 488 180 108" style="height:16px;width:auto;vertical-align:middle"><rect x="-42.76" y="-54.33" width="2005.52" height="1188.65" fill="#0f2244"/><rect x="829.47" y="551.34" width="18.15" height="18.15" fill="#00cfff"/><rect x="686.18" y="538.2" width="48.56" height="10.09" fill="#fff"/><rect x="686.18" y="558.47" width="53.17" height="10.09" fill="#fff"/><rect x="686.18" y="518.73" width="53.17" height="10.01" fill="#fff"/><polygon points="829.47 496.06 827.87 506.11 827.61 507.83 825.24 522.76 818.89 517.34 801.9 535.92 787.85 535.92 794.91 543.55 817.93 568.41 803 568.41 787.47 551.6 758.21 583.94 743.55 583.94 780.04 543.54 757.11 518.73 771.94 518.73 787.72 535.76 810.6 510.28 804.33 504.93 829.47 496.06" fill="#fff"/></svg></span>`;
const SUVA_MINI_LOGO = `<span title="Domaine SUVA (monopole accident LAA)" style="display:inline-flex;align-items:center;margin-left:4px;vertical-align:middle;background:#fff;border-radius:3px;padding:2px 4px"><img src="data:image/png;base64,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" style="height:11px;width:auto;display:block"/></span>`;

function getClientMiniLogos(c) {
  let logos = '';
  if (c && c.source_oz) logos += OZ_MINI_LOGO;
  if (c && c.source_cofidex) logos += COFIDEX_MINI_LOGO;
  // Domaine SUVA (monopole légal de l'assurance-accidents pour certaines branches, art. 66 LAA) :
  // déclaré manuellement à la création/édition du client (champ "Domaine SUVA ?"), OU détecté
  // automatiquement dès qu'un contrat LAA actif chez SUVA existe pour ce client — les deux
  // signaux se combinent, pour couvrir aussi bien un nouveau client sans contrat encore créé
  // qu'un client existant dont le contrat suffit à le déterminer sans case à cocher.
  if (c) {
    const contratSuva = typeof allContrats !== 'undefined' && allContrats.some(ct =>
      ct.client_id === c.id &&
      (ct.compagnie || '').trim().toLowerCase().includes('suva') &&
      !['résilié', 'annulé', 'mandat_resilie'].includes(ct.statut)
    );
    if (c.domaine_suva || contratSuva) logos += SUVA_MINI_LOGO;
  }
  return logos;
}

// ═══ STATUTS DE COMMISSION ═══
function statutCommissionLabel(statut) {
  if (statut === 'reçue') return 'Reçue';
  if (statut === 'versé_oz') return 'Versé OZ';
  if (statut === 'versé_cofidex') return 'Versé EX Groupe';
  if (statut === 'extourné') return '↩ Extournée';
  if (statut === 'annulé') return '❌ Annulé (legacy)';
  return 'En attente';
}
function statutCommissionColor(statut) {
  if (statut === 'reçue') return '#4ade80';
  if (statut === 'versé_oz') return '#1a56db';
  if (statut === 'versé_cofidex') return '#f59e0b';
  if (statut === 'extourné') return '#f87171';
  if (statut === 'annulé') return '#94a3b8';
  return '#f59e0b';
}

// ═══ MARQUAGE CLIENT EX GROUPE / COFIDEX ═══
// Logo EX Groupe officiel (logo officiel EX Groupe)

const TAUX_COMMISSION = {
  sante_facteur_mensuel: 16,   // santé complémentaire : prime mensuelle x 16 (acquisition unique)
  vie_taux_capital: 4,         // vie 3a : 4% du capital de production (prime mensuelle x12 x nb années)
  lpp_fp: 1.20,                // LPP Swiss Life : facteur produit 1.20 (Business Invest/Premium/Select)
  lpp_taux: 6.3,               // LPP Swiss Life : taux 6.3% (Annexe B convention SL1102)
  lamal_forfait: 70,           // LAMal : forfait unique CHF 70.- par contrat à la signature
  // COG annuelle LPP = prime_annuelle × 1.20 × 6.3% (versée trimestriellement)
  // LAMal : CHF 70 une seule fois, à la signature, indépendant de la prime
  // Convention de collaboration HOTELA (entrée en vigueur 01.05.2026) — taux sur prime effectivement payée
  hotela: {
    ij_maladie: 7.00,               // Indemnités journalières en cas de maladie
    accidents: 5.00,                // Assurance-accidents (LAA)
    accidents_complementaire: 15.00,// Assurance-accidents complémentaire
    lpp: 1.50,                      // Prévoyance professionnelle
    lpp_plafond: 20000,             // Plafond annuel CHF 20'000.- par preneur soumis à la CCNT hôtellerie-restauration
    package: 10.00,                 // Package HOTELA (nouvelles affaires uniquement, toutes couvertures placées par le courtier)
  },
};

// ═══ CONSTANTES LÉGALES LPP (état au 01.01.2026 — inchangées depuis 2025, réforme rejetée) ═══
const LPP_LEGAL = {
  seuil_entree: 22680,
  deduction_coordination: 26460,
  salaire_max: 90720,
  coordonne_min: 3780,
  coordonne_max: 64260,
  taux_interet_minimal: 0.0125,   // taux d'intérêt minimal LPP maintenu à 1.25% en 2026
  taux_conversion_legal: 0.068,   // taux de conversion 6.8% (part obligatoire, inchangé en 2026)
};

// ═══ ESTIMATION RENTE AVS (échelle 44) — état 2026, inchangé depuis 2025 ═══
// Approximation standard de branche : interpolation linéaire entre rente min et rente max
// selon le RAMD (Revenu Annuel Moyen Déterminant), en prenant le salaire actuel comme proxy du RAMD.
// ⚠️ Estimation indicative — ne remplace pas l'extrait de compte individuel AVS officiel.
const AVS_LEGAL = {
  ramd_min: 15120,
  ramd_max: 90720,
  rente_min: 15120,   // CHF/an (1'260/mois)
  rente_max: 30240,   // CHF/an (2'520/mois)
  duree_cotisation_complete: 44,
  taux_veuvage: 0.80,   // rente de veuve/veuf = 80% de la rente entière du défunt (art. 24 LAVS)
  taux_orphelin: 0.40,  // rente d'orphelin = 40% de la rente entière du défunt, par enfant (art. 25 LAVS)
};

// Estime la rente AVS annuelle (entière, à durée de cotisation donnée) à partir d'un RAMD approximé par le salaire actuel
function estimerRenteAVS(salaireActuel, anneesCotisation) {
  let renteComplete;
  if (salaireActuel <= AVS_LEGAL.ramd_min) renteComplete = AVS_LEGAL.rente_min;
  else if (salaireActuel >= AVS_LEGAL.ramd_max) renteComplete = AVS_LEGAL.rente_max;
  else renteComplete = AVS_LEGAL.rente_min + (salaireActuel - AVS_LEGAL.ramd_min) / (AVS_LEGAL.ramd_max - AVS_LEGAL.ramd_min) * (AVS_LEGAL.rente_max - AVS_LEGAL.rente_min);
  const coefficient = Math.min(anneesCotisation, AVS_LEGAL.duree_cotisation_complete) / AVS_LEGAL.duree_cotisation_complete;
  return Math.round(renteComplete * coefficient);
}

// Table officielle de fraction de rente LPP selon le degré d'invalidité (changement de méthode au 01.01.2022)
function fractionRenteInvaliditeLPP(degre) {
  if (degre < 40) return 0;
  if (degre <= 49) {
    const table = { 40:0.25, 41:0.275, 42:0.30, 43:0.325, 44:0.35, 45:0.375, 46:0.40, 47:0.425, 48:0.45, 49:0.475 };
    return table[degre] !== undefined ? table[degre] : 0;
  }
  if (degre < 70) return degre / 100; // taux linéaire de manière précise
  return 1; // dès 70% = rente entière
}

// ═══ RÈGLES DE FINANCEMENT IMMOBILIER (bases IAF) — standards de branche 2026 ═══
const IMMO_LEGAL = {
  fp_min_principale: 0.20,     // fonds propres minimum : 20% du prix (résidence principale)
  fp_min_secondaire: 1 / 3,    // fonds propres minimum : 33.3% (résidence secondaire — pas de LPP autorisé)
  fp_min_durs: 0.10,           // dont au moins 10% doivent être des fonds propres "durs" (hors 2e pilier)
  premier_rang_max: 0.65,      // 1er rang hypothécaire : max 65% de la valeur du bien
  taux_interet_theorique_defaut: 0.05,  // taux théorique standard de branche (souvent 4.5%-5%)
  charges_entretien_defaut: 0.01,       // frais d'entretien/accessoires : ~1% du prix d'achat
  duree_amortissement_defaut: 15,       // amortissement du 2e rang : 15 ans, ou jusqu'à la retraite si plus tôt
  taux_endettement_max_defaut: 0.33,    // charge totale ne doit pas dépasser 1/3 du revenu brut
};

// Calcule la capacité financière pour un prix d'achat donné
function calculerCapaciteFinanciere({ prix, fondsPropresDisponibles, fondsPropresLPP, revenuBrut, tauxInteret, chargesEntretien, dureeAmortissement, residenceSecondaire, tauxEndettementMax }) {
  const pctFPMin = residenceSecondaire ? IMMO_LEGAL.fp_min_secondaire : IMMO_LEGAL.fp_min_principale;
  const fpMinRequis = prix * pctFPMin;
  const fpDursRequis = residenceSecondaire ? fpMinRequis : prix * IMMO_LEGAL.fp_min_durs;
  const fondsPropresDurs = fondsPropresDisponibles - (fondsPropresLPP || 0);

  const hypotheque = Math.max(0, prix - fondsPropresDisponibles);
  const premierRang = Math.min(hypotheque, prix * IMMO_LEGAL.premier_rang_max);
  const deuxiemeRang = Math.max(0, hypotheque - premierRang);

  const interetsAnnuels = hypotheque * tauxInteret;
  const amortissementAnnuel = dureeAmortissement > 0 ? deuxiemeRang / dureeAmortissement : 0;
  const chargesAnnuelles = prix * chargesEntretien;
  const chargeTotaleAnnuelle = interetsAnnuels + amortissementAnnuel + chargesAnnuelles;
  const tauxEffort = revenuBrut > 0 ? chargeTotaleAnnuelle / revenuBrut : Infinity;
  const revenuMinimumNecessaire = tauxEndettementMax > 0 ? chargeTotaleAnnuelle / tauxEndettementMax : chargeTotaleAnnuelle / 0.33;

  return {
    fpMinRequis, fpDursRequis, fondsPropresDurs,
    fpSuffisants: fondsPropresDisponibles >= fpMinRequis - 0.01,
    fpDursSuffisants: fondsPropresDurs >= fpDursRequis - 0.01,
    hypotheque, premierRang, deuxiemeRang,
    interetsAnnuels, amortissementAnnuel, chargesAnnuelles, chargeTotaleAnnuelle, tauxEffort, revenuMinimumNecessaire,
  };
}

// Recherche par dichotomie le prix d'achat maximal finançable (respecte fonds propres ET taux d'effort)
function calculerPrixMaximalFinancable({ fondsPropresDisponibles, fondsPropresLPP, revenuBrut, tauxInteret, chargesEntretien, dureeAmortissement, tauxEndettementMax, residenceSecondaire }) {
  const pctFPMin = residenceSecondaire ? IMMO_LEGAL.fp_min_secondaire : IMMO_LEGAL.fp_min_principale;
  let lo = 0, hi = fondsPropresDisponibles > 0 ? fondsPropresDisponibles / pctFPMin : 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const c = calculerCapaciteFinanciere({ prix: mid, fondsPropresDisponibles, fondsPropresLPP, revenuBrut, tauxInteret, chargesEntretien, dureeAmortissement, residenceSecondaire, tauxEndettementMax });
    if (c.tauxEffort <= tauxEndettementMax && c.fpSuffisants && c.fpDursSuffisants) lo = mid; else hi = mid;
  }
  const prixMax = lo;

  // Identifie quelle règle bloque effectivement le prix maximal, pour l'expliquer clairement
  const capFPTotale = fondsPropresDisponibles > 0 ? fondsPropresDisponibles / pctFPMin : 0;
  const fondsPropresDurs = fondsPropresDisponibles - (fondsPropresLPP || 0);
  const capFPDurs = residenceSecondaire ? Infinity : (fondsPropresDurs > 0 ? fondsPropresDurs / IMMO_LEGAL.fp_min_durs : 0);
  let contrainteLimitante = 'tauxEffort';
  if (Math.abs(prixMax - capFPDurs) < Math.max(1, prixMax * 0.005) && capFPDurs <= capFPTotale) contrainteLimitante = 'fondsPropresDurs';
  else if (Math.abs(prixMax - capFPTotale) < Math.max(1, prixMax * 0.005)) contrainteLimitante = 'fondsPropresTotaux';

  return { prixMax, contrainteLimitante, capFPTotale, capFPDurs };
}

// Taux de bonification de vieillesse par tranche d'âge (art. 16 LPP, minimum légal)
function tauxBonificationLPP(age) {
  if (age < 25) return 0;
  if (age <= 34) return 0.07;
  if (age <= 44) return 0.10;
  if (age <= 54) return 0.15;
  return 0.18;
}

// Calcule le salaire coordonné LPP selon les règles légales (plafonnement + déduction + garde-fous min/max)
function calculerSalaireCoordonneLPP(salaireAVS) {
  if (!salaireAVS || salaireAVS < LPP_LEGAL.seuil_entree) return 0;
  const salairePlafonne = Math.min(salaireAVS, LPP_LEGAL.salaire_max);
  let coordonne = salairePlafonne - LPP_LEGAL.deduction_coordination;
  if (coordonne < LPP_LEGAL.coordonne_min) coordonne = LPP_LEGAL.coordonne_min;
  if (coordonne > LPP_LEGAL.coordonne_max) coordonne = LPP_LEGAL.coordonne_max;
  return Math.round(coordonne);
}

// Simule un parcours d'épargne LPP année par année, avec capitalisation des intérêts
// (réplique la logique du tableau d'évolution LPP : bonifications par tranche d'âge + intérêts composés,
// avec prorata sur l'année de la retraite selon le nombre de mois avant l'échéance)
function simulerParcoursLPP({ salaireCoordonne, capitalDepart, ageDepart, ageRetraite, moisDerniereAnnee, tauxInteret, rachatAnnuel, tauxBonifFn }) {
  const bonifFn = tauxBonifFn || tauxBonificationLPP;
  const lignes = [];
  let capital = capitalDepart || 0;
  for (let age = ageDepart; age < ageRetraite; age++) {
    const interet = capital * tauxInteret;
    const bonification = salaireCoordonne * bonifFn(age);
    const rachat = rachatAnnuel || 0;
    const etatDebut = capital;
    capital = capital + interet + bonification + rachat;
    lignes.push({ age, etatDebut, interet, bonification, rachat, etatFin: capital });
  }
  // Année de la retraite : bonification et intérêt proratés sur le nombre de mois avant l'échéance
  const etatDebutFinal = capital;
  const interetFinal = (capital * tauxInteret / 12) * moisDerniereAnnee;
  const bonificationFinale = (salaireCoordonne * bonifFn(ageRetraite) / 12) * moisDerniereAnnee;
  const capitalFinal = capital + interetFinal + bonificationFinale;
  lignes.push({ age: ageRetraite, etatDebut: etatDebutFinal, interet: interetFinal, bonification: bonificationFinale, rachat: 0, etatFin: capitalFinal });
  return { lignes, capitalFinal };
}

// ═══ VUE : CALCULATEUR DE LACUNE DE PRÉVOYANCE LPP ═══
function viewCalculateurLPP() {
  const clientOptions = allClients.map(c => `<option value="${c.id}">${estEntreprise(c) ? c.nom : c.prenom + ' ' + c.nom}</option>`).join('');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">🧮 Bilan de prévoyance — Vie · Décès · Invalidité</h2>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Additionne les prestations AVS + LPP projetées sur les trois risques et fait apparaître les lacunes par rapport au besoin du client. Basé sur les paramètres légaux 2026 (inchangés depuis 2025).</div>

    ${sectionCard('Client (optionnel — pour préremplir)', '#38bdf8', `<div class="form-grid">
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Sélectionner un client</label><select class="form-select" id="clpp-client" onchange="prefillClientLPP()"><option value="">— Simulation libre (prospect) —</option>${clientOptions}</select></div>
    </div>`)}

    ${sectionCard('Coordonnées (pour l\'en-tête du document imprimé)', '#38bdf8', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Adresse</label><input class="form-input" id="clpp-adresse" placeholder="Rue des Alpes 12"/></div>
      <div class="form-field"><label class="form-label">NPA / Ville</label><input class="form-input" id="clpp-npa-ville" placeholder="1000 Lausanne"/></div>
      <div class="form-field"><label class="form-label">Téléphone</label><input class="form-input" id="clpp-telephone" placeholder="079 123 45 67"/></div>
      <div class="form-field"><label class="form-label">Email</label><input class="form-input" id="clpp-email" placeholder="jean.dupont@email.ch"/></div>
    </div>`)}

    ${sectionCard('Situation personnelle', '#a78bfa', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Nom (prospect ou client)</label><input class="form-input" id="clpp-nom" placeholder="Jean Dupont"/></div>
      <div class="form-field"><label class="form-label">Date de naissance *</label><input class="form-input" id="clpp-naissance" type="date"/></div>
      <div class="form-field"><label class="form-label">Âge de référence retraite</label><input class="form-input" id="clpp-age-retraite" type="number" value="65"/></div>
      <div class="form-field"><label class="form-label">Mois avant échéance l'année de la retraite</label><input class="form-input" id="clpp-mois-derniere-annee" type="number" value="6" min="0" max="12"/></div>
      <div class="form-field"><label class="form-label">État civil</label><select class="form-select" id="clpp-etat-civil"><option value="marie">Marié(e) / partenariat enregistré</option><option value="celibataire">Célibataire / concubinage</option></select></div>
      <div class="form-field"><label class="form-label">Années de cotisation AVS à ce jour</label><input class="form-input" id="clpp-annees-cotisation" type="number" placeholder="auto"/></div>
    </div>
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
      <label class="form-label" style="margin-bottom:8px;display:block">Enfants à charge</label>
      <div id="clpp-enfants-list" style="margin-bottom:10px"></div>
      <button type="button" class="btn-secondary" onclick="ajouterEnfantLPP()">+ Ajouter un enfant</button>
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:6px">La rente pour enfant est versée jusqu'à 18 ans, ou jusqu'à 25 ans si l'enfant poursuit des études — coche la case correspondante pour chaque enfant concerné.</div>
    </div>`)}

    ${sectionCard('Salaire et avoir actuel', '#f59e0b', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Salaire AVS annuel actuel (CHF) *</label><input class="form-input" id="clpp-salaire-avs" type="number" placeholder="90000" oninput="updateApercuSalaireCoordonne()"/></div>
      <div class="form-field"><label class="form-label">Salaire coordonné LPP (calculé)</label><input class="form-input" id="clpp-salaire-coordonne" type="number" readonly style="background:var(--surface-alt);color:var(--text-muted)"/></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Avoir de vieillesse LPP actuel (CHF) — depuis le certificat de prévoyance *</label><input class="form-input" id="clpp-avoir-actuel" type="number" placeholder="85000"/></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Avoir de libre passage disponible (CHF, optionnel) — compte/police d'un ancien employeur</label><input class="form-input" id="clpp-libre-passage" type="number" value="0"/></div>
    </div>`)}

    ${sectionCard('Hypothèses de calcul', '#4ade80', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Taux d'intérêt hypothèse (%)</label><input class="form-input" id="clpp-taux-interet" type="number" step="0.01" value="1.25"/></div>
      <div class="form-field"><label class="form-label">Taux de conversion hypothèse (%)</label><input class="form-input" id="clpp-taux-conversion" type="number" step="0.1" value="6.8"/></div>
      <div class="form-field"><label class="form-label">Rachat annuel prévu (CHF, optionnel)</label><input class="form-input" id="clpp-rachat-annuel" type="number" value="0"/></div>
    </div>`)}

    ${sectionCard('Risque Décès', '#f87171', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Besoin décès (% du salaire actuel)</label><input class="form-input" id="clpp-besoin-deces-pct" type="number" value="80"/></div>
      <div class="form-field"><label class="form-label">OU besoin décès — montant manuel (CHF/an)</label><input class="form-input" id="clpp-besoin-deces-manuel" type="number" placeholder="laisser vide = utiliser le %"/></div>
    </div>`)}

    ${sectionCard('Risque Invalidité', '#fb923c', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Degré d'invalidité à simuler (%)</label><input class="form-input" id="clpp-degre-invalidite" type="number" value="100" min="0" max="100"/></div>
      <div class="form-field"><label class="form-label">Besoin invalidité (% du salaire actuel)</label><input class="form-input" id="clpp-besoin-invalidite-pct" type="number" value="80"/></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">OU besoin invalidité — montant manuel (CHF/an)</label><input class="form-input" id="clpp-besoin-invalidite-manuel" type="number" placeholder="laisser vide = utiliser le %"/></div>
    </div>`)}

    ${sectionCard('Plan LPP surobligatoire (caisse enveloppante)', '#a78bfa', `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px">
        <input type="checkbox" id="clpp-surobligatoire" onchange="toggleSurobligatoire()" style="width:16px;height:16px;cursor:pointer"/>
        <span style="font-size:12.5px;color:var(--text)">Ce plan prévoit de meilleures prestations que le minimum légal LPP</span>
      </label>
      <div id="clpp-surobligatoire-zone" style="display:none">
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:10px">Par défaut, les calculs utilisent le minimum légal LPP. Ajuste ici selon le règlement du plan si le client bénéficie d'une caisse enveloppante.</div>

        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:12px 0 6px">Rentes de survivants et d'invalidité</div>
        <div class="form-grid">
          <div class="form-field"><label class="form-label">Rente de conjoint LPP (% de la rente d'invalidité entière)</label><input class="form-input" id="clpp-pct-conjoint" type="number" value="60"/></div>
          <div class="form-field"><label class="form-label">Rente d'orphelin LPP décès (% par enfant)</label><input class="form-input" id="clpp-pct-orphelin" type="number" value="20"/></div>
          <div class="form-field"><label class="form-label">Rente enfant d'invalide LPP (% par enfant)</label><input class="form-input" id="clpp-pct-enfant-invalidite" type="number" value="20"/></div>
          <div class="form-field">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:18px">
              <input type="checkbox" id="clpp-rente-concubin" style="width:16px;height:16px;cursor:pointer"/>
              <span class="form-label" style="margin:0">Inclure une rente de concubin/partenaire (si état civil = célibataire/concubinage)</span>
            </label>
          </div>
        </div>

        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:14px 0 6px">Part LPP surobligatoire</div>
        <div class="form-grid">
          <div class="form-field" style="grid-column:span 2"><label class="form-label">Salaire coordonné effectif (CHF) — remplace le calcul légal plafonné si le plan couvre la part au-delà du plafond</label><input class="form-input" id="clpp-salaire-coordonne-surob" type="number" placeholder="laisser vide = calcul légal plafonné"/></div>
        </div>

        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:14px 0 6px">Capitaux additionnels prévus au plan</div>
        <div class="form-grid">
          <div class="form-field"><label class="form-label">Capital décès LPP additionnel (CHF)</label><input class="form-input" id="clpp-capital-deces" type="number" value="0"/></div>
          <div class="form-field"><label class="form-label">Capital invalidité LPP additionnel (CHF)</label><input class="form-input" id="clpp-capital-invalidite" type="number" value="0"/></div>
        </div>

        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:14px 0 6px">Bonifications de vieillesse sur mesure (% du salaire coordonné, remplace le minimum légal 7/10/15/18%)</div>
        <div class="form-grid">
          <div class="form-field"><label class="form-label">25 à 34 ans (%)</label><input class="form-input" id="clpp-bonif-1" type="number" step="0.5" value="7"/></div>
          <div class="form-field"><label class="form-label">35 à 44 ans (%)</label><input class="form-input" id="clpp-bonif-2" type="number" step="0.5" value="10"/></div>
          <div class="form-field"><label class="form-label">45 à 54 ans (%)</label><input class="form-input" id="clpp-bonif-3" type="number" step="0.5" value="15"/></div>
          <div class="form-field"><label class="form-label">55 ans et plus (%)</label><input class="form-input" id="clpp-bonif-4" type="number" step="0.5" value="18"/></div>
        </div>
      </div>
    `)}

    <div style="display:flex;gap:10px;margin:18px 0">
      <button class="btn-save" onclick="calculerEtAfficherLPP()">🧮 Calculer le bilan</button>
    </div>

    <div id="clpp-resultats"></div>
  `;
}

// ═══ VUE : FINANCEMENT IMMOBILIER (capacité financière — règles IAF) ═══
function viewFinancementImmo() {
  const clientOptions = allClients.map(c => `<option value="${c.id}">${estEntreprise(c) ? c.nom : c.prenom + ' ' + c.nom}</option>`).join('');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">🏠 Financement immobilier — Capacité financière</h2>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Vérifie si un projet d'acquisition respecte les règles standards de branche (fonds propres 20%, dont 10% hors LPP, taux d'effort max 33%) et calcule le prix maximal finançable.</div>

    ${sectionCard('Client (optionnel — pour préremplir)', '#38bdf8', `<div class="form-grid">
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Sélectionner un client</label><select class="form-select" id="fi-client" onchange="prefillClientImmo()"><option value="">— Simulation libre (prospect) —</option>${clientOptions}</select></div>
    </div>`)}

    ${sectionCard('Le bien', '#a78bfa', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Nom (prospect ou client)</label><input class="form-input" id="fi-nom" placeholder="Jean Dupont"/></div>
      <div class="form-field"><label class="form-label">Type de résidence</label><select class="form-select" id="fi-type-residence"><option value="principale">Résidence principale</option><option value="secondaire">Résidence secondaire</option></select></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Prix d'achat du bien (CHF) *</label><input class="form-input" id="fi-prix" type="number" placeholder="800000"/></div>
    </div>`)}

    ${sectionCard('Fonds propres', '#f59e0b', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Fonds propres disponibles — total (CHF) *</label><input class="form-input" id="fi-fp-total" type="number" placeholder="200000"/></div>
      <div class="form-field"><label class="form-label">Dont provenant du 2e pilier LPP (CHF)</label><input class="form-input" id="fi-fp-lpp" type="number" value="0"/></div>
    </div>`)}

    ${sectionCard('Revenu et hypothèses', '#4ade80', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Revenu brut annuel du ménage (CHF) *</label><input class="form-input" id="fi-revenu" type="number" placeholder="150000"/></div>
      <div class="form-field"><label class="form-label">Taux d'intérêt théorique (%)</label><input class="form-input" id="fi-taux-interet" type="number" step="0.1" value="5"/></div>
      <div class="form-field"><label class="form-label">Charges d'entretien (% du prix)</label><input class="form-input" id="fi-charges" type="number" step="0.1" value="1"/></div>
      <div class="form-field"><label class="form-label">Taux d'effort maximum toléré (%)</label><input class="form-input" id="fi-taux-max" type="number" step="0.5" value="33"/></div>
    </div>`)}

    ${sectionCard('Amortissement', '#f87171', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Âge actuel de l'acheteur</label><input class="form-input" id="fi-age-actuel" type="number" placeholder="35"/></div>
      <div class="form-field"><label class="form-label">Âge de référence retraite</label><input class="form-input" id="fi-age-retraite" type="number" value="65"/></div>
      <div style="grid-column:span 2;font-size:10.5px;color:var(--text-muted);padding:4px 2px">Le 2ème rang doit être amorti sur 15 ans, ou jusqu'à la retraite si celle-ci intervient plus tôt.</div>
    </div>`)}

    <div style="display:flex;gap:10px;margin:18px 0">
      <button class="btn-save" onclick="calculerEtAfficherImmo()">🏠 Calculer la capacité financière</button>
    </div>

    <div id="fi-resultats"></div>
  `;
}

function prefillClientImmo() {
  const clientId = document.getElementById('fi-client').value;
  if (!clientId) return;
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  document.getElementById('fi-nom').value = estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
  if (c.revenu) document.getElementById('fi-revenu').value = c.revenu;
  if (c.date_naissance) document.getElementById('fi-age-actuel').value = ageAujourdhui(c.date_naissance);
}

// Génère le HTML des résultats (vérifications + structure + charge + prix max) à partir de paramètres donnés.
// Réutilisé à la fois pour le calcul initial et pour chaque ajustement des curseurs en direct.
function renderResultatsImmo(p) {
  const r = calculerCapaciteFinanciere(p);
  const resultatPrixMax = calculerPrixMaximalFinancable({ fondsPropresDisponibles: p.fondsPropresDisponibles, fondsPropresLPP: p.fondsPropresLPP, revenuBrut: p.revenuBrut, tauxInteret: p.tauxInteret, chargesEntretien: p.chargesEntretien, dureeAmortissement: p.dureeAmortissement, tauxEndettementMax: p.tauxEndettementMax, residenceSecondaire: p.residenceSecondaire });
  const prixMax = resultatPrixMax.prixMax;
  const explicationContrainte = {
    fondsPropresDurs: `Plafonné par les fonds propres "durs" (hors LPP) : seulement CHF ${Math.round(p.fondsPropresDisponibles - (p.fondsPropresLPP||0)).toLocaleString()} disponibles hors 2ème pilier, alors que 10% du prix doit provenir de cette source.`,
    fondsPropresTotaux: `Plafonné par les fonds propres totaux (règle des ${p.residenceSecondaire ? '33.3' : '20'}%).`,
    tauxEffort: `Plafonné par le taux d'effort (revenu par rapport à la charge annuelle).`,
  }[resultatPrixMax.contrainteLimitante];
  const ok = r.fpSuffisants && r.fpDursSuffisants && r.tauxEffort <= p.tauxEndettementMax;

  const ligneVerif = (label, okLigne, detail) => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0">
      <span style="font-size:15px">${okLigne ? '✅' : '❌'}</span>
      <div style="flex:1"><div style="font-size:12.5px;font-weight:700;color:var(--text)">${label}</div><div style="font-size:11px;color:var(--text-muted)">${detail}</div></div>
    </div>`;

  window._immoDernierResultat = { ...p, ...r, prixMax, contrainteLimitante: resultatPrixMax.contrainteLimitante };

  return `
    ${sectionCard(ok ? '✅ Projet finançable' : '❌ Projet non finançable en l\u2019état', ok ? '#4ade80' : '#f87171', `
      ${ligneVerif('Fonds propres suffisants (min. 20%)', r.fpSuffisants, `${Math.round(p.fondsPropresDisponibles).toLocaleString()} CHF disponibles / ${Math.round(r.fpMinRequis).toLocaleString()} CHF requis`)}
      ${ligneVerif('Fonds propres "durs" suffisants (min. 10% hors LPP)', r.fpDursSuffisants, `${Math.round(r.fondsPropresDurs).toLocaleString()} CHF hors LPP / ${Math.round(r.fpDursRequis).toLocaleString()} CHF requis`)}
      ${ligneVerif('Taux d\u2019effort dans la limite', r.tauxEffort <= p.tauxEndettementMax, `${(r.tauxEffort*100).toFixed(1)}% du revenu brut / ${Math.round(p.tauxEndettementMax*100)}% maximum toléré`)}
    `)}

    ${sectionCard('Structure de financement', '#38bdf8', `
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <tr><td style="padding:5px 0;color:var(--text-muted)">Prix d'achat</td><td style="padding:5px 0;text-align:right;font-weight:700">CHF ${Math.round(p.prix).toLocaleString()}</td></tr>
        <tr><td style="padding:5px 0;color:var(--text-muted)">Revenu brut annuel du ménage</td><td style="padding:5px 0;text-align:right;font-weight:700">CHF ${Math.round(p.revenuBrut).toLocaleString()}</td></tr>
        <tr><td style="padding:5px 0;color:var(--text-muted)">Fonds propres</td><td style="padding:5px 0;text-align:right;font-weight:700">CHF ${Math.round(p.fondsPropresDisponibles).toLocaleString()}</td></tr>
        <tr><td style="padding:5px 0;color:var(--text-muted)">Hypothèque totale</td><td style="padding:5px 0;text-align:right;font-weight:700">CHF ${Math.round(r.hypotheque).toLocaleString()}</td></tr>
        <tr><td style="padding:5px 0 5px 16px;color:var(--text-muted)">— dont 1er rang (max 65%)</td><td style="padding:5px 0;text-align:right">CHF ${Math.round(r.premierRang).toLocaleString()}</td></tr>
        <tr><td style="padding:5px 0 5px 16px;color:var(--text-muted)">— dont 2ème rang (à amortir sur ${p.dureeAmortissement} ans)</td><td style="padding:5px 0;text-align:right">CHF ${Math.round(r.deuxiemeRang).toLocaleString()}</td></tr>
      </table>
    `)}

    ${sectionCard('Charge annuelle (capacité financière)', '#f59e0b', `
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:12px">
        <tr><td style="padding:5px 0;color:var(--text-muted)">Intérêts théoriques (${(p.tauxInteret*100).toFixed(1)}%)</td><td style="padding:5px 0;text-align:right;font-weight:700">CHF ${Math.round(r.interetsAnnuels).toLocaleString()}/an</td></tr>
        <tr><td style="padding:5px 0;color:var(--text-muted)">Amortissement 2ème rang</td><td style="padding:5px 0;text-align:right;font-weight:700">CHF ${Math.round(r.amortissementAnnuel).toLocaleString()}/an</td></tr>
        <tr><td style="padding:5px 0;color:var(--text-muted)">Charges d'entretien (${(p.chargesEntretien*100).toFixed(1)}%)</td><td style="padding:5px 0;text-align:right;font-weight:700">CHF ${Math.round(r.chargesAnnuelles).toLocaleString()}/an</td></tr>
        <tr style="border-top:1px solid var(--border)"><td style="padding:6px 0;font-weight:800">Charge totale annuelle</td><td style="padding:6px 0;text-align:right;font-weight:800;color:#f59e0b">CHF ${Math.round(r.chargeTotaleAnnuelle).toLocaleString()}/an</td></tr>
      </table>
      ${svgStackedBarChart([
        { label: 'Intérêts', value: r.interetsAnnuels, color: '#38bdf8' },
        { label: 'Amortissement', value: r.amortissementAnnuel, color: '#f59e0b' },
        { label: 'Charges d\u2019entretien', value: r.chargesAnnuelles, color: '#fbbf24' },
      ], p.revenuBrut * p.tauxEndettementMax, `Max. ${Math.round(p.tauxEndettementMax*100)}% du revenu`)}
    `)}

    ${sectionCard('Prix maximal finançable / Revenu minimum nécessaire', '#4ade80', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-size:11px;color:var(--text-muted)">Prix maximal finançable</div>
          <div style="font-size:22px;font-weight:900;color:#4ade80">CHF ${Math.round(prixMax).toLocaleString()}</div>
          <div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">${explicationContrainte}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted)">Revenu brut minimum nécessaire (pour ce prix et ces fonds propres)</div>
          <div style="font-size:22px;font-weight:900;color:${p.revenuBrut >= r.revenuMinimumNecessaire ? '#4ade80' : '#f87171'}">CHF ${Math.round(r.revenuMinimumNecessaire).toLocaleString()}</div>
          <div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">Revenu actuel saisi : CHF ${Math.round(p.revenuBrut).toLocaleString()} — ${p.revenuBrut >= r.revenuMinimumNecessaire ? 'suffisant' : 'manque CHF ' + Math.round(r.revenuMinimumNecessaire - p.revenuBrut).toLocaleString() + '/an'}</div>
        </div>
      </div>
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:10px">⚠️ Ces deux chiffres répondent à des questions différentes : le <strong>revenu minimum</strong> est calculé pour le prix saisi ci-dessus (CHF ${Math.round(p.prix).toLocaleString()}), sans tenir compte de la règle des fonds propres. Le <strong>prix maximal</strong> tient compte de toutes les règles (fonds propres compris) à revenu et fonds propres inchangés. Ils ne se répondent donc pas forcément l'un à l'autre.</div>
    `)}
  `;
}

// Curseur générique avec libellé de valeur en direct
function curseurImmo(id, label, min, max, step, valeur, unite) {
  return `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="color:var(--text-muted);font-weight:700">${label}</span>
        <span id="${id}-valeur" style="color:var(--text);font-weight:800">${valeur}${unite}</span>
      </div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${valeur}" oninput="recalculerImmoEnDirect()" style="width:100%"/>
    </div>`;
}

function calculerEtAfficherImmo() {
  const zone = document.getElementById('fi-resultats');
  const prix = parseFloat(document.getElementById('fi-prix').value) || 0;
  const fondsPropresDisponibles = parseFloat(document.getElementById('fi-fp-total').value) || 0;
  const fondsPropresLPP = parseFloat(document.getElementById('fi-fp-lpp').value) || 0;
  const revenuBrut = parseFloat(document.getElementById('fi-revenu').value) || 0;
  if (!prix || !revenuBrut) { showError('Le prix du bien et le revenu brut sont obligatoires.'); return; }

  const tauxInteret = parseFloat(document.getElementById('fi-taux-interet').value) || 5;
  const chargesEntretien = parseFloat(document.getElementById('fi-charges').value) || 1;
  const tauxEndettementMax = parseFloat(document.getElementById('fi-taux-max').value) || 33;
  const residenceSecondaire = document.getElementById('fi-type-residence').value === 'secondaire';
  const ageActuel = parseInt(document.getElementById('fi-age-actuel').value) || null;
  const ageRetraite = parseInt(document.getElementById('fi-age-retraite').value) || 65;
  const dureeAmortissement = ageActuel ? Math.max(1, Math.min(IMMO_LEGAL.duree_amortissement_defaut, ageRetraite - ageActuel)) : IMMO_LEGAL.duree_amortissement_defaut;

  // Paramètres fixes (non ajustables par les curseurs) — conservés pour la simulation en direct
  window._immoParamsFixes = { revenuBrut, fondsPropresLPP, dureeAmortissement, residenceSecondaire };

  const paramsInitiaux = { prix, fondsPropresDisponibles, fondsPropresLPP, revenuBrut, tauxInteret: tauxInteret / 100, chargesEntretien: chargesEntretien / 100, tauxEndettementMax: tauxEndettementMax / 100, dureeAmortissement, residenceSecondaire };

  zone.innerHTML = `
    ${sectionCard('🎚️ Simulation en direct — ajuste les paramètres pour voir ce qui débloque le financement', '#a78bfa', `
      ${curseurImmo('fi-slider-prix', 'Prix d\u2019achat', Math.round(prix * 0.5 / 5000) * 5000, Math.round(prix * 1.5 / 5000) * 5000, 5000, prix, ' CHF')}
      ${curseurImmo('fi-slider-fp', 'Fonds propres disponibles', 0, Math.round(prix * 0.8 / 5000) * 5000, 5000, fondsPropresDisponibles, ' CHF')}
      ${curseurImmo('fi-slider-taux', 'Taux d\u2019intérêt théorique', 1, 8, 0.1, tauxInteret, '%')}
      ${curseurImmo('fi-slider-charges', 'Charges d\u2019entretien', 0.5, 2, 0.1, chargesEntretien, '%')}
      ${curseurImmo('fi-slider-effort', 'Taux d\u2019effort maximum toléré', 20, 40, 0.5, tauxEndettementMax, '%')}
    `)}

    <div id="fi-resultats-dynamiques">${renderResultatsImmo(paramsInitiaux)}</div>

    <div style="font-size:10.5px;color:var(--text-muted);margin:10px 0">⚠️ Simulation indicative selon les règles standards de branche — chaque établissement prêteur peut appliquer des critères légèrement différents (taux théorique, taux d'effort maximum). Ne remplace pas une étude de faisabilité bancaire formelle.</div>

    <div style="display:flex;gap:10px;margin-top:10px">
      <button class="btn-secondary" onclick="imprimerResultatImmo()">🖨️ Imprimer / PDF</button>
    </div>
  `;
}

// Relit les curseurs et recalcule instantanément, sans redemander les paramètres fixes du formulaire
function recalculerImmoEnDirect() {
  const fixes = window._immoParamsFixes;
  if (!fixes) return;
  const prix = parseFloat(document.getElementById('fi-slider-prix').value);
  const fondsPropresDisponibles = parseFloat(document.getElementById('fi-slider-fp').value);
  const tauxInteret = parseFloat(document.getElementById('fi-slider-taux').value);
  const chargesEntretien = parseFloat(document.getElementById('fi-slider-charges').value);
  const tauxEndettementMax = parseFloat(document.getElementById('fi-slider-effort').value);

  document.getElementById('fi-slider-prix-valeur').textContent = `CHF ${Math.round(prix).toLocaleString()}`;
  document.getElementById('fi-slider-fp-valeur').textContent = `CHF ${Math.round(fondsPropresDisponibles).toLocaleString()}`;
  document.getElementById('fi-slider-taux-valeur').textContent = `${tauxInteret.toFixed(1)}%`;
  document.getElementById('fi-slider-charges-valeur').textContent = `${chargesEntretien.toFixed(1)}%`;
  document.getElementById('fi-slider-effort-valeur').textContent = `${tauxEndettementMax.toFixed(1)}%`;

  const params = {
    prix, fondsPropresDisponibles, fondsPropresLPP: fixes.fondsPropresLPP, revenuBrut: fixes.revenuBrut,
    tauxInteret: tauxInteret / 100, chargesEntretien: chargesEntretien / 100, tauxEndettementMax: tauxEndettementMax / 100,
    dureeAmortissement: fixes.dureeAmortissement, residenceSecondaire: fixes.residenceSecondaire,
  };
  document.getElementById('fi-resultats-dynamiques').innerHTML = renderResultatsImmo(params);
}

function imprimerResultatImmo() {
  const r = window._immoDernierResultat;
  if (!r) return;
  const nom = document.getElementById('fi-nom').value || 'Client';
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Financement immobilier — ${nom}</title><style>
    body{font-family:Arial,sans-serif;padding:30px;color:#0f2244}
    .entete{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0f2244;padding-bottom:14px;margin-bottom:20px}
    h1{font-size:16px;color:#0f2244;margin:14px 0 4px}
    h2{font-size:14px;color:#0f2244;margin-top:22px;border-bottom:1px solid #ddd;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
    th,td{padding:6px 8px;border-bottom:1px solid #ddd}
    th{background:#f2f5fa;text-align:left}
    @media print{ button{display:none !important} }
  </style></head><body>
    <div class="entete">
      ${genererBadgeLogoAssurex()}
      <div style="font-size:10.5px;color:#666">c/o COFIDEX SA · Rue du Centre 142 · 1025 St-Sulpice<br/>Courtier en assurances FINMA F01492173</div>
    </div>
    <h1>Analyse de financement immobilier — ${nom}</h1>
    <div style="font-size:11px;color:#666;margin-bottom:10px">Document établi le ${new Date().toLocaleDateString('fr-CH')} — simulation indicative.</div>

    <h2>${r.tauxEffort <= r.tauxEndettementMax && r.fpSuffisants && r.fpDursSuffisants ? '✅ Projet finançable' : '❌ Projet non finançable en l\u2019état'}</h2>
    <table>
      <tr><td>Fonds propres (min. 20%)</td><td>${r.fondsPropresDisponibles.toLocaleString()} CHF / ${Math.round(r.fpMinRequis).toLocaleString()} CHF requis</td></tr>
      <tr><td>Fonds propres "durs" (min. 10% hors LPP)</td><td>${Math.round(r.fondsPropresDurs).toLocaleString()} CHF / ${Math.round(r.fpDursRequis).toLocaleString()} CHF requis</td></tr>
      <tr><td>Taux d'effort</td><td>${(r.tauxEffort*100).toFixed(1)}% / ${Math.round(r.tauxEndettementMax*100)}% maximum</td></tr>
    </table>

    <h2>Structure de financement</h2>
    <table>
      <tr><td>Prix d'achat</td><td>CHF ${r.prix.toLocaleString()}</td></tr>
      <tr><td>Revenu brut annuel du ménage</td><td>CHF ${Math.round(r.revenuBrut).toLocaleString()}</td></tr>
      <tr><td>Fonds propres</td><td>CHF ${r.fondsPropresDisponibles.toLocaleString()}</td></tr>
      <tr><td>Hypothèque totale</td><td>CHF ${Math.round(r.hypotheque).toLocaleString()}</td></tr>
      <tr><td>1er rang</td><td>CHF ${Math.round(r.premierRang).toLocaleString()}</td></tr>
      <tr><td>2ème rang (à amortir sur ${r.dureeAmortissement} ans)</td><td>CHF ${Math.round(r.deuxiemeRang).toLocaleString()}</td></tr>
    </table>

    <h2>Charge annuelle</h2>
    <table>
      <tr><td>Intérêts théoriques</td><td>CHF ${Math.round(r.interetsAnnuels).toLocaleString()}/an</td></tr>
      <tr><td>Amortissement</td><td>CHF ${Math.round(r.amortissementAnnuel).toLocaleString()}/an</td></tr>
      <tr><td>Charges d'entretien</td><td>CHF ${Math.round(r.chargesAnnuelles).toLocaleString()}/an</td></tr>
      <tr><td><b>Total</b></td><td><b>CHF ${Math.round(r.chargeTotaleAnnuelle).toLocaleString()}/an</b></td></tr>
    </table>

    <h2>Prix maximal finançable / Revenu minimum nécessaire</h2>
    <table>
      <tr><td>Prix maximal finançable</td><td>CHF ${Math.round(r.prixMax).toLocaleString()}</td></tr>
      <tr><td>Revenu brut minimum nécessaire</td><td>CHF ${Math.round(r.revenuMinimumNecessaire).toLocaleString()}</td></tr>
      <tr><td>Revenu actuel saisi</td><td>CHF ${Math.round(r.revenuBrut).toLocaleString()} — ${r.revenuBrut >= r.revenuMinimumNecessaire ? 'suffisant' : 'manque CHF ' + Math.round(r.revenuMinimumNecessaire - r.revenuBrut).toLocaleString() + '/an'}</td></tr>
    </table>
    <p style="font-size:10.5px;color:#666;margin-top:6px">${
      r.contrainteLimitante === 'fondsPropresDurs'
        ? `Prix maximal plafonné par les fonds propres "durs" (hors LPP) : seulement CHF ${Math.round(r.fondsPropresDisponibles - (r.fondsPropresLPP||0)).toLocaleString()} disponibles hors 2ème pilier, alors que 10% du prix doit provenir de cette source.`
        : r.contrainteLimitante === 'fondsPropresTotaux'
        ? `Prix maximal plafonné par les fonds propres totaux (règle des ${r.residenceSecondaire ? '33.3' : '20'}%).`
        : `Prix maximal plafonné par le taux d'effort (revenu par rapport à la charge annuelle).`
    }</p>
    <p style="font-size:10.5px;color:#666;margin-top:6px">⚠️ Ces deux chiffres répondent à des questions différentes : le revenu minimum est calculé pour le prix saisi (CHF ${Math.round(r.prix).toLocaleString()}), sans tenir compte de la règle des fonds propres. Le prix maximal tient compte de toutes les règles (fonds propres compris) à revenu et fonds propres inchangés.</p>

    <p style="font-size:10px;color:#888;margin-top:20px">Simulation indicative selon les règles standards de branche — ne remplace pas une étude de faisabilité bancaire formelle.</p>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#0f2244;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimer / Enregistrer en PDF</button>
  </body></html>`);
  win.document.close();
}

// des rentes d'une situation (AVS + LPP + ...) empilées jusqu'au total, avec ligne de besoin en référence.
