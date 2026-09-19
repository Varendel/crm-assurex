// ═══ CONSEIL FINANCIER (19.09.2026) ═══════════════════════════════════════════════════════════
// Planification financière par client, sur le modèle des outils des conseillers en planification
// (Swiss Life Select & co) : un DOSSIER par client qui suit le processus
//   Découverte → Analyse → Recommandations → Mise en œuvre → Suivi
// et réunit : budget et patrimoine, projets de vie (achat immobilier, retraite anticipée, études…),
// projection de la retraite (AVS + LPP + 3e pilier), capacité hypothécaire, recommandations
// (proposées automatiquement puis retenues par le conseiller), rapport client imprimable.
//
// Calculs repris des modules existants (js/01) : estimerRenteAVS, calculerSalaireCoordonneLPP,
// simulerParcoursLPP, calculerCapaciteFinanciere, calculerPrixMaximalFinancable,
// schemaMaisonFinancement. Données : table dossiers_conseil (un dossier par client).
// ⚠️ Estimations indicatives — le rapport le mentionne explicitement.

const CF_ETAPES = [
  ['decouverte', 'Découverte', 'Collecte de la situation et des objectifs'],
  ['analyse', 'Analyse', 'Budget, patrimoine, retraite, projets'],
  ['recommandations', 'Recommandations', 'Solutions présentées au client'],
  ['mise_en_oeuvre', 'Mise en œuvre', 'Contrats, placements, démarches'],
  ['suivi', 'Suivi', 'Point régulier, ajustements'],
];
const CF_TYPES_PROJET = [
  ['immobilier', '🏡', 'Achat immobilier'], ['retraite_anticipee', '🌅', 'Retraite anticipée'], ['etudes', '🎓', 'Études des enfants'],
  ['reserve', '🛟', 'Réserve de sécurité'], ['voyage', '✈️', 'Voyage / année sabbatique'], ['entreprise', '🚀', 'Création d’entreprise'],
  ['renovation', '🔨', 'Rénovation'], ['vehicule', '🚗', 'Véhicule'], ['transmission', '🤝', 'Transmission / donation'], ['autre', '⭐', 'Autre projet'],
];
// Plafond 3e pilier A (salarié affilié LPP) — à vérifier chaque année (OFAS)
const CF_PLAFOND_3A = 7258;
const CF_HYPOTHESES_DEFAUT = { rendement: 2, inflation: 1, taux_marginal: 25, esperance_vie: 88, interet_lpp: 1.25 };

let _cf = { dossier: null, client: null, onglet: 'synthese', timer: null, etat: '', bilans: [] };

function cfEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function cfNomClient(c) { return c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : ''; }
function cfNum(v) { const n = typeof nombreCH === 'function' ? nombreCH(v) : Number(v); return isNaN(n) ? 0 : n; }
function cfCHF(n) { const v = Math.round(n || 0); return 'CHF ' + (v < 0 ? '−' : '') + fmtCHF(Math.abs(v)); }
function cfGet(obj, chemin) { return chemin.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function cfSet(obj, chemin, val) { const k = chemin.split('.'); let o = obj; k.slice(0, -1).forEach(p => { if (o[p] == null || typeof o[p] !== 'object') o[p] = {}; o = o[p]; }); o[k[k.length - 1]] = val; }
function cfId() { return Math.random().toString(36).slice(2, 10); }

// ── Liste des dossiers ──────────────────────────────────────────────────────────────────────
function viewConseil() {
  setTimeout(cfChargerListe, 0);
  return `<div class="dbx cf">
    <section class="cf-hero">
      <div class="cf-hero-deco" aria-hidden="true"></div>
      <div class="cf-hero-texte">
        <span class="cf-surtitre">Planification financière</span>
        <h1>Conseil financier</h1>
        <p>Budget, patrimoine, projets de vie, retraite et financement immobilier réunis dans un dossier par client — pour conseiller, présenter et suivre.</p>
      </div>
      <div class="cf-hero-actions">
        <div class="cf-choix-client">
          <input id="cf-recherche-client" list="cf-liste-clients" placeholder="Ouvrir le dossier de… (nom du client)" autocomplete="off" aria-label="Client" onchange="cfOuvrirDepuisRecherche(this.value)"/>
          <datalist id="cf-liste-clients">${allClients.filter(c => !estEntreprise(c)).map(c => `<option value="${cfEsc(cfNomClient(c))}"></option>`).join('')}</datalist>
        </div>
        <div class="cf-outils">
          <button type="button" onclick="navigate('analyse-prevoyance')">🧮 Analyse de prévoyance</button>
          <button type="button" onclick="navigate('calc-immo')">🏠 Simulateur hypothécaire</button>
        </div>
      </div>
    </section>
    <div id="cf-liste"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
  </div>`;
}

function cfOuvrirDepuisRecherche(nom) {
  const c = allClients.find(x => cfNomClient(x).toLowerCase() === (nom || '').trim().toLowerCase());
  if (c) ouvrirDossierConseil(c.id); else if (nom) showError('Client introuvable — choisis un nom dans la liste proposée.');
}

async function cfChargerListe() {
  const zone = document.getElementById('cf-liste');
  if (!zone) return;
  const dossiers = await dbGet('dossiers_conseil', 'select=id,client_id,etape,updated_at,prochain_point,situation,projets,recommandations&order=updated_at.desc');
  const liste = Array.isArray(dossiers) ? dossiers : [];
  const auj = new Date().toISOString().slice(0, 10);
  const aVenir = liste.filter(d => d.prochain_point && d.prochain_point >= auj).length;
  const enRetard = liste.filter(d => d.prochain_point && d.prochain_point < auj).length;
  const parEtape = CF_ETAPES.map(([v, l]) => [l, liste.filter(d => d.etape === v).length]);
  zone.innerHTML = `
    <div class="dbx-kpis">
      <div class="dbx-kpi tr-kpi" style="--i:1"><span class="dbx-kpi-label">Dossiers de conseil</span><span class="dbx-kpi-valeur">${liste.length}</span><span class="dbx-kpi-sous">${parEtape.filter(x => x[1]).map(x => `${x[1]} ${x[0].toLowerCase()}`).join(' · ') || 'aucun pour l’instant'}</span></div>
      <div class="dbx-kpi tr-kpi" style="--i:2"><span class="dbx-kpi-label">Points de suivi à venir</span><span class="dbx-kpi-valeur">${aVenir}</span><span class="dbx-kpi-sous">${enRetard ? `<span class="fcx-rouge">${enRetard} en retard</span>` : 'à jour'}</span></div>
      <div class="dbx-kpi tr-kpi" style="--i:3"><span class="dbx-kpi-label">Projets suivis</span><span class="dbx-kpi-valeur">${liste.reduce((s, d) => s + (d.projets || []).length, 0)}</span><span class="dbx-kpi-sous">tous clients confondus</span></div>
      <div class="dbx-kpi tr-kpi" style="--i:4"><span class="dbx-kpi-label">Recommandations en cours</span><span class="dbx-kpi-valeur">${liste.reduce((s, d) => s + (d.recommandations || []).filter(r => r.statut === 'acceptee').length, 0)}</span><span class="dbx-kpi-sous">acceptées, à mettre en œuvre</span></div>
    </div>
    ${liste.length ? `<section class="dbx-carte"><header class="dbx-carte-tete"><h2>Dossiers</h2><span class="dbx-carte-sous">du plus récent au plus ancien</span></header>
      <div class="cf-dossiers">${liste.map(d => {
        const c = allClients.find(x => x.id === d.client_id);
        const i = CF_ETAPES.findIndex(e => e[0] === d.etape);
        return `<button type="button" class="cf-dossier" onclick="ouvrirDossierConseil('${d.client_id}')">
          <span class="cf-dossier-nom">${cfEsc(cfNomClient(c) || 'Client supprimé')}</span>
          <span class="cf-etapes-mini" aria-label="Étape : ${CF_ETAPES[i] ? CF_ETAPES[i][1] : ''}">${CF_ETAPES.map((e, j) => `<span class="${j <= i ? 'fait' : ''}"></span>`).join('')}</span>
          <span class="cf-dossier-etape">${CF_ETAPES[i] ? CF_ETAPES[i][1] : ''}</span>
          <span class="cf-dossier-info">${(d.projets || []).length} projet(s)${d.prochain_point ? ` · prochain point ${fmtDate(d.prochain_point)}` : ''}</span>
          <span class="cf-dossier-date">maj ${fmtDate(d.updated_at)}</span>
        </button>`;
      }).join('')}</div></section>`
    : `<div class="dbx-vide"><img src="assets/logos/rex-mascotte-hd.png" alt=""/><strong>Aucun dossier de conseil pour l’instant.</strong><span>Tape le nom d’un client ci-dessus, ou ouvre son dossier depuis sa fiche (bouton « 💼 Conseil »).</span></div>`}`;
}

// ── Ouverture d'un dossier ──────────────────────────────────────────────────────────────────
async function ouvrirDossierConseil(clientId, opts) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) { showError('Client introuvable.'); return; }
  await cfSauverMaintenant();
  // Historique de navigation : le bouton retour ramène à l'écran précédent, et depuis la fiche
  // client ou une autre vue, « retour » rouvre ce dossier (type 'conseil', géré par restaurerEtat)
  if (!(opts && opts.sansHistorique) && typeof capturerEtatActuel === 'function') {
    const prec = capturerEtatActuel();
    if (!(prec.type === 'conseil' && prec.id === clientId)) navHistory.push(prec);
  }
  vueDetailActive = { type: 'conseil', id: clientId };
  currentView = 'dossier-conseil';
  if (typeof renderSidebar === 'function') renderSidebar();
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loader">Chargement du dossier...</div>';
  const [dossiers, bilans] = await Promise.all([
    dbGet('dossiers_conseil', `client_id=eq.${clientId}&select=*`),
    typeof getBilansPrevoyanceClient === 'function' ? getBilansPrevoyanceClient(clientId) : [],
  ]);
  let d = Array.isArray(dossiers) && dossiers[0];
  if (!d) {
    // Premier dossier : préremplissage depuis la fiche client
    const contrats3a = allContrats.filter(ct => ct.client_id === clientId && /3a/i.test(ct.produit || '') && !['résilié', 'annulé'].includes(ct.statut));
    d = {
      client_id: clientId, etape: 'decouverte', projets: [], recommandations: [], notes: '', hypotheses: { ...CF_HYPOTHESES_DEFAUT },
      situation: {
        prevoyance: { salaire_brut: c.revenu || '', age_retraite: 65, objectif_pct: 80, taux_conversion: 6.8, versement_3a: c.montant_3a || (contrats3a.length ? contrats3a.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0) : '') },
        menage: { enfants: c.enfants || 0, etat_civil: c.etat_civil || '' },
      },
    };
    const r = await dbPost('dossiers_conseil', d);
    if (r && r.error) { main.innerHTML = ''; showError('Impossible de créer le dossier : ' + errMsg(r)); return; }
    d = r[0];
    logAction('create_dossier_conseil', 'dossiers_conseil', d.id, cfNomClient(c));
  }
  d.hypotheses = { ...CF_HYPOTHESES_DEFAUT, ...(d.hypotheses || {}) };
  d.situation = d.situation || {};
  d.projets = d.projets || [];
  d.recommandations = d.recommandations || [];
  _cf = { dossier: d, client: c, onglet: _cf.client && _cf.client.id === clientId ? _cf.onglet : 'synthese', timer: null, etat: 'enregistre', bilans: Array.isArray(bilans) ? bilans : [] };
  cfRendre();
}

function cfRendre() {
  const main = document.getElementById('main-content');
  if (!main || !_cf.dossier) return;
  const c = _cf.client, d = _cf.dossier;
  const age = c.date_naissance && typeof ageAujourdhui === 'function' ? ageAujourdhui(c.date_naissance) : null;
  const i = CF_ETAPES.findIndex(e => e[0] === d.etape);
  const onglets = [['synthese', 'Synthèse'], ['situation', 'Situation'], ['projets', `Projets (${d.projets.length})`], ['retraite', 'Retraite & prévoyance'], ['immobilier', 'Immobilier'], ['recommandations', `Recommandations (${d.recommandations.length})`]];
  main.innerHTML = `<div class="dbx cf">
    <section class="cf-hero cf-hero-dossier">
      <div class="cf-hero-deco" aria-hidden="true"></div>
      <div class="cf-hero-texte">
        <button type="button" class="cf-retour" onclick="cfSauverMaintenant().then(() => navigate('conseil'))">← Tous les dossiers</button>
        <span class="cf-surtitre">Dossier de conseil${age ? ` · ${age} ans` : ''}${c.etat_civil ? ' · ' + cfEsc(c.etat_civil) : ''}</span>
        <h1>${cfEsc(cfNomClient(c))}</h1>
        <div class="cf-etapes" role="group" aria-label="Étape du conseil">
          ${CF_ETAPES.map(([v, l, aide], j) => `<button type="button" class="${j < i ? 'fait' : j === i ? 'actif' : ''}" title="${cfEsc(aide)}" onclick="cfChangerEtape('${v}')"><span>${j < i ? '✓' : j + 1}</span>${l}</button>`).join('')}
        </div>
      </div>
      <div class="cf-hero-actions">
        <span class="cf-etat" id="cf-etat">${cfLibelleEtat()}</span>
        <div class="cf-boutons">
          <button type="button" class="fcx-btn-blanc" onclick="cfImprimerRapport()">📄 Rapport client</button>
          <button type="button" class="fcx-btn-verre" onclick="cfSauverMaintenant().then(() => showClient('${c.id}'))">👤 Fiche client</button>
        </div>
        <label class="cf-prochain">Prochain point <input type="date" value="${d.prochain_point || ''}" onchange="_cf.dossier.prochain_point=this.value||null;cfPlanifierSauvegarde()"/></label>
      </div>
    </section>
    <div class="dbx-onglets cf-onglets" role="tablist">
      ${onglets.map(([v, l]) => `<button type="button" role="tab" aria-selected="${_cf.onglet === v}" class="${_cf.onglet === v ? 'actif' : ''}" onclick="cfChangerOnglet('${v}')">${l}</button>`).join('')}
    </div>
    <div id="cf-onglet">${cfContenuOnglet()}</div>
  </div>`;
}

function cfChangerOnglet(o) { _cf.onglet = o; cfSauverMaintenant(); cfRendre(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function cfChangerEtape(e) { _cf.dossier.etape = e; cfPlanifierSauvegarde(); cfRendre(); }
function cfContenuOnglet() {
  switch (_cf.onglet) {
    case 'situation': return cfOngletSituation();
    case 'projets': return cfOngletProjets();
    case 'retraite': return cfOngletRetraite();
    case 'immobilier': return cfOngletImmobilier();
    case 'recommandations': return cfOngletRecommandations();
    default: return cfOngletSynthese();
  }
}

// ── Sauvegarde automatique ──────────────────────────────────────────────────────────────────
function cfLibelleEtat() { return { enregistre: '✓ Enregistré', attente: '… modifications en cours', envoi: 'Enregistrement…', erreur: '⚠ Non enregistré' }[_cf.etat] || ''; }
function cfMajEtat(e) { _cf.etat = e; const el = document.getElementById('cf-etat'); if (el) { el.textContent = cfLibelleEtat(); el.className = 'cf-etat ' + e; } }
function cfPlanifierSauvegarde() { cfMajEtat('attente'); clearTimeout(_cf.timer); _cf.timer = setTimeout(cfSauverMaintenant, 700); }
async function cfSauverMaintenant() {
  clearTimeout(_cf.timer); _cf.timer = null;
  const d = _cf.dossier;
  if (!d || !d.id || _cf.etat === 'enregistre') return;
  cfMajEtat('envoi');
  const { etape, situation, projets, hypotheses, recommandations, notes, prochain_point } = d;
  const r = await dbPatch('dossiers_conseil', d.id, { etape, situation, projets, hypotheses, recommandations, notes, prochain_point, updated_at: new Date().toISOString() });
  if (r && r.error) { cfMajEtat('erreur'); showError('Dossier de conseil non enregistré : ' + errMsg(r)); return; }
  cfMajEtat('enregistre');
}

// Champ lié au dossier : data-cf = chemin (ex. situation.revenus.net_client)
function cfChamp(chemin, label, opts = {}) {
  const v = cfGet(_cf.dossier, chemin);
  const val = v === undefined || v === null ? '' : v;
  if (opts.type === 'select') return `<label class="cf-champ ${opts.large ? 'large' : ''}"><span>${label}</span><select data-cf="${chemin}" onchange="cfMaj(this)">${opts.options.map(([o, l]) => `<option value="${cfEsc(o)}" ${String(val) === String(o) ? 'selected' : ''}>${cfEsc(l)}</option>`).join('')}</select></label>`;
  if (opts.type === 'texte') return `<label class="cf-champ ${opts.large ? 'large' : ''}"><span>${label}</span><input data-cf="${chemin}" value="${cfEsc(val)}" placeholder="${cfEsc(opts.placeholder || '')}" oninput="cfMaj(this)"/></label>`;
  return `<label class="cf-champ ${opts.large ? 'large' : ''}"><span>${label}</span><div class="cf-saisie"><input data-cf="${chemin}" data-num="1" inputmode="decimal" value="${cfEsc(val)}" placeholder="${cfEsc(opts.placeholder || '0')}" oninput="cfMaj(this)"/>${opts.unite ? `<em>${opts.unite}</em>` : ''}</div>${opts.aide ? `<small>${opts.aide}</small>` : ''}</label>`;
}
function cfMaj(el) {
  const chemin = el.dataset.cf;
  const val = el.dataset.num ? (el.value.trim() === '' ? '' : cfNum(el.value)) : el.value;
  cfSet(_cf.dossier, chemin, val);
  cfPlanifierSauvegarde();
  cfRafraichirCalculs();
}
// Met à jour uniquement les zones calculées (sans reconstruire les champs : le curseur reste en place)
function cfRafraichirCalculs() {
  const z = document.getElementById('cf-calculs');
  if (z) z.innerHTML = cfCalculsOnglet();
}
function cfCalculsOnglet() {
  switch (_cf.onglet) {
    case 'situation': return cfPanneauSituation();
    case 'retraite': return cfPanneauRetraite();
    case 'immobilier': return cfPanneauImmobilier();
    case 'projets': return cfPanneauProjets();
    default: return '';
  }
}

// ── Calculs ─────────────────────────────────────────────────────────────────────────────────
function cfSomme(obj) { return Object.values(obj || {}).reduce((s, v) => s + cfNum(v), 0); }
function cfMensualiteEpargne(capital, annees, tauxPct) {
  // Épargne mensuelle nécessaire pour constituer « capital » en « annees » à « tauxPct » %/an
  if (capital <= 0) return 0;
  const n = Math.max(1, Math.round(annees * 12));
  const r = (tauxPct || 0) / 100 / 12;
  return r ? capital * r / (Math.pow(1 + r, n) - 1) : capital / n;
}
function cfValeurFuture(actuel, versementAnnuel, annees, tauxPct) {
  const r = (tauxPct || 0) / 100;
  let v = actuel || 0;
  for (let a = 0; a < Math.max(0, Math.round(annees)); a++) v = v * (1 + r) + (versementAnnuel || 0);
  return v;
}

function cfAnalyse() {
  const d = _cf.dossier, c = _cf.client, s = d.situation || {}, h = d.hypotheses;
  const age = c.date_naissance && typeof ageAujourdhui === 'function' ? ageAujourdhui(c.date_naissance) : null;
  const revenus = cfSomme(s.revenus), depenses = cfSomme(s.depenses);
  const capacite = revenus - depenses;
  const patrimoine = cfSomme(s.patrimoine), dettes = cfSomme(s.dettes);
  const liquidites = cfNum(cfGet(s, 'patrimoine.liquidites'));
  const moisReserve = depenses > 0 ? liquidites / depenses : null;

  // Retraite
  const p = s.prevoyance || {};
  const ageRetraite = cfNum(p.age_retraite) || 65;
  const annees = age != null ? Math.max(0, ageRetraite - age) : null;
  const salaire = cfNum(p.salaire_brut);
  const avs = salaire ? estimerRenteAVS(salaire, 44) : 0;
  const avsConjoint = cfNum(p.salaire_brut_conjoint) ? estimerRenteAVS(cfNum(p.salaire_brut_conjoint), 44) : 0;
  const avsCouple = avsConjoint ? Math.min(avs + avsConjoint, AVS_LEGAL.rente_max * 1.5) : avs; // plafonnement couple marié 150 %
  let capitalLPP = cfNum(p.lpp_capital_projete);
  const lppProjeteCertificat = !!capitalLPP;
  if (!capitalLPP && annees != null && salaire) {
    capitalLPP = simulerParcoursLPP({ salaireCoordonne: calculerSalaireCoordonneLPP(salaire), capitalDepart: cfNum(cfGet(s, 'patrimoine.lpp')), ageDepart: age, ageRetraite, moisDerniereAnnee: 0, tauxInteret: (cfNum(h.interet_lpp) || 1.25) / 100, rachatAnnuel: cfNum(p.rachat_lpp_annuel) }).capitalFinal;
  }
  const renteLPP = capitalLPP * (cfNum(p.taux_conversion) || 6.8) / 100;
  const capital3a = annees != null ? cfValeurFuture(cfNum(cfGet(s, 'patrimoine.pilier3a')), cfNum(p.versement_3a), annees, h.rendement) : 0;
  const capitalLibre = annees != null ? cfValeurFuture(cfNum(cfGet(s, 'patrimoine.placements')), 0, annees, h.rendement) : 0;
  const dureeRetraite = Math.max(1, (cfNum(h.esperance_vie) || 88) - ageRetraite);
  const renteCapitaux = (capital3a + capitalLibre) / dureeRetraite;
  const revenuRetraite = avsCouple + renteLPP + renteCapitaux;
  const besoin = revenus * 12 * (cfNum(p.objectif_pct) || 80) / 100;
  const lacune = Math.max(0, besoin - revenuRetraite);
  const capitalManquant = lacune * dureeRetraite;
  const epargneRetraite = annees ? cfMensualiteEpargne(capitalManquant, annees, h.rendement) : 0;
  const manque3a = Math.max(0, CF_PLAFOND_3A - cfNum(p.versement_3a));
  const economieImpot3a = manque3a * (cfNum(h.taux_marginal) || 0) / 100;

  // Projets
  const anneeCourante = new Date().getFullYear();
  const projets = d.projets.map(pr => {
    const n = Math.max(0.5, cfNum(pr.annee) - anneeCourante);
    // Achat immobilier : seul l'apport est à épargner — 20 % de fonds propres + ~5 % de frais
    // d'achat (droits de mutation, notaire) ; le reste est financé par l'hypothèque
    const cible = pr.type === 'immobilier' ? cfNum(pr.montant) * 0.25 : cfNum(pr.montant);
    const dejaFV = cfValeurFuture(cfNum(pr.epargne), 0, n, h.rendement);
    const reste = Math.max(0, cible - dejaFV);
    const mensuel = cfMensualiteEpargne(reste, n, h.rendement);
    const avancement = cible ? Math.min(1, cfNum(pr.epargne) / cible) : 0;
    return { ...pr, n, cible, reste, mensuel, avancement };
  });
  const besoinProjets = projets.reduce((t, x) => t + x.mensuel, 0);

  // Immobilier (projet d'achat)
  const im = s.immobilier || {};
  const revenuBrutMenage = salaire + cfNum(p.salaire_brut_conjoint);
  let hypo = null;
  if (cfNum(im.prix) && revenuBrutMenage) {
    const params = { prix: cfNum(im.prix), fondsPropresDisponibles: cfNum(im.fonds_propres), fondsPropresLPP: cfNum(im.fonds_propres_lpp), revenuBrut: revenuBrutMenage,
      tauxInteret: IMMO_LEGAL.taux_interet_theorique_defaut, chargesEntretien: IMMO_LEGAL.charges_entretien_defaut, tauxEndettementMax: IMMO_LEGAL.taux_endettement_max_defaut,
      dureeAmortissement: age != null ? Math.max(1, Math.min(IMMO_LEGAL.duree_amortissement_defaut, ageRetraite - age)) : IMMO_LEGAL.duree_amortissement_defaut, residenceSecondaire: im.type === 'secondaire' };
    hypo = { params, ...calculerCapaciteFinanciere(params), prixMax: calculerPrixMaximalFinancable(params).prixMax };
    hypo.ok = hypo.fpSuffisants && hypo.fpDursSuffisants && hypo.tauxEffort <= params.tauxEndettementMax;
  }
  // Bien existant : charge théorique à 5 % sur l'hypothèque actuelle
  const hypoActuelle = cfNum(cfGet(s, 'dettes.hypotheque')), valeurBien = cfNum(cfGet(s, 'patrimoine.immobilier'));
  const chargeTheoriqueActuelle = hypoActuelle ? hypoActuelle * IMMO_LEGAL.taux_interet_theorique_defaut + valeurBien * IMMO_LEGAL.charges_entretien_defaut : 0;
  const tauxEffortActuel = revenuBrutMenage && hypoActuelle ? chargeTheoriqueActuelle / revenuBrutMenage : null;

  return { age, revenus, depenses, capacite, patrimoine, dettes, net: patrimoine - dettes, liquidites, moisReserve, ageRetraite, annees, salaire, avs, avsCouple, capitalLPP, lppProjeteCertificat, renteLPP, capital3a, capitalLibre, renteCapitaux, revenuRetraite, besoin, lacune, capitalManquant, epargneRetraite, dureeRetraite, manque3a, economieImpot3a, projets, besoinProjets, hypo, revenuBrutMenage, hypoActuelle, valeurBien, tauxEffortActuel };
}

// Recommandations proposées automatiquement à partir de l'analyse
function cfRecommandationsAuto(A) {
  const r = [];
  const s = _cf.dossier.situation || {};
  if (A.revenus && A.capacite < 0) r.push({ cle: 'budget', cat: 'Budget', texte: `Budget déficitaire de ${cfCHF(-A.capacite)}/mois : revoir les postes de dépenses avant tout nouvel engagement.` });
  if (A.depenses && A.moisReserve != null && A.moisReserve < 3) r.push({ cle: 'reserve', cat: 'Épargne', texte: `Constituer une réserve de sécurité de 3 à 6 mois de dépenses (${cfCHF(A.depenses * 3)} à ${cfCHF(A.depenses * 6)}) — aujourd’hui ${A.moisReserve.toFixed(1).replace('.', ',')} mois.` });
  if (cfNum(cfGet(s, 'dettes.credits')) > 0) r.push({ cle: 'credits', cat: 'Dettes', texte: `Rembourser en priorité les crédits à la consommation (${cfCHF(cfGet(s, 'dettes.credits'))}) : leur coût dépasse le rendement de toute épargne.` });
  if (A.salaire && A.manque3a > 0) r.push({ cle: '3a', cat: 'Fiscalité', texte: `Verser le maximum au 3e pilier A : ${cfCHF(A.manque3a)} de plus par an (plafond ${cfCHF(CF_PLAFOND_3A)}), soit environ ${cfCHF(A.economieImpot3a)} d’impôts économisés chaque année.` });
  if (A.lacune > 0 && A.annees) r.push({ cle: 'retraite', cat: 'Retraite', texte: `Lacune de revenu à la retraite estimée à ${cfCHF(A.lacune)}/an : épargner environ ${cfCHF(A.epargneRetraite)}/mois (rachats LPP fiscalement déductibles, 3e pilier, placements).` });
  if (A.projets.length && A.besoinProjets > Math.max(0, A.capacite)) r.push({ cle: 'projets', cat: 'Projets', texte: `Les projets demandent ${cfCHF(A.besoinProjets)}/mois d’épargne pour une capacité de ${cfCHF(Math.max(0, A.capacite))}/mois : prioriser, étaler dans le temps ou revoir les montants.` });
  if (A.hypo && !A.hypo.ok) r.push({ cle: 'hypo', cat: 'Immobilier', texte: `Projet immobilier non finançable en l’état (taux d’effort ${(A.hypo.tauxEffort * 100).toFixed(0)} %) : prix maximal finançable ≈ ${cfCHF(A.hypo.prixMax)}.` });
  if (A.tauxEffortActuel != null && A.tauxEffortActuel > 0.33) r.push({ cle: 'hypo-actuelle', cat: 'Immobilier', texte: `Charge hypothécaire théorique actuelle à ${(A.tauxEffortActuel * 100).toFixed(0)} % du revenu : anticiper le renouvellement et l’amortissement (indirect via 3a).` });
  if (!_cf.bilans.length) r.push({ cle: 'risques', cat: 'Protection', texte: 'Vérifier la couverture en cas de décès et d’invalidité (bilan de prévoyance complet) — la famille est-elle protégée ?' });
  if (A.patrimoine > 250000 && !cfNum(cfGet(s, 'patrimoine.placements'))) r.push({ cle: 'placements', cat: 'Placements', texte: 'Patrimoine important sans placements : étudier une stratégie de placement adaptée au profil de risque.' });
  return r;
}

// ── Onglet Synthèse ─────────────────────────────────────────────────────────────────────────
function cfOngletSynthese() {
  const A = cfAnalyse();
  const vide = !A.revenus && !A.patrimoine && !_cf.dossier.projets.length;
  if (vide) return `<div class="dbx-vide"><img src="assets/logos/rex-mascotte-hd.png" alt=""/><strong>Dossier à compléter</strong><span>Commence par la situation du client : revenus, dépenses, patrimoine. Les analyses et recommandations se construisent ensuite automatiquement.</span><button type="button" class="btn-save" style="margin-top:10px" onclick="cfChangerOnglet('situation')">Saisir la situation →</button></div>`;
  const kpi = (l, v, s, ton, i, onglet) => `<button type="button" class="dbx-kpi ${ton || ''}" style="--i:${i}" onclick="cfChangerOnglet('${onglet}')"><span class="dbx-kpi-label">${l}</span><span class="dbx-kpi-valeur">${v}</span><span class="dbx-kpi-sous">${s}</span></button>`;
  const recos = cfRecommandationsAuto(A);
  const couvertProjets = A.besoinProjets ? Math.min(1, Math.max(0, A.capacite) / A.besoinProjets) : 1;
  return `
    <div class="dbx-kpis">
      ${kpi('Patrimoine net', cfCHF(A.net), `${cfCHF(A.patrimoine)} d’actifs · ${cfCHF(A.dettes)} de dettes`, '', 1, 'situation')}
      ${kpi('Capacité d’épargne', cfCHF(A.capacite) + '/mois', A.revenus ? `${Math.round(A.capacite / A.revenus * 100)} % des revenus nets` : 'revenus à saisir', A.capacite < 0 ? 'cf-alerte' : '', 2, 'situation')}
      ${kpi('Revenu à la retraite', A.revenuRetraite ? cfCHF(A.revenuRetraite / 12) + '/mois' : '—', A.besoin ? (A.lacune ? `<span class="fcx-rouge">lacune ${cfCHF(A.lacune / 12)}/mois</span>` : 'objectif atteint ✓') : 'à compléter', A.lacune ? 'cf-alerte' : '', 3, 'retraite')}
      ${kpi('Projets', `${A.projets.length}`, A.projets.length ? `${cfCHF(A.besoinProjets)}/mois nécessaires · couverts à ${Math.round(couvertProjets * 100)} %` : 'aucun projet saisi', couvertProjets < 1 ? 'cf-alerte' : '', 4, 'projets')}
    </div>
    <div class="dbx-grille">
      <div class="dbx-col">
        <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Répartition du budget mensuel</h2><button type="button" class="dbx-lien" onclick="cfChangerOnglet('situation')">Modifier →</button></header>${cfGraphBudget(A)}</section>
        ${A.projets.length ? `<section class="dbx-carte"><header class="dbx-carte-tete"><h2>Projets de vie</h2><button type="button" class="dbx-lien" onclick="cfChangerOnglet('projets')">Détail →</button></header>${cfListeProjetsMini(A)}</section>` : ''}
      </div>
      <div class="dbx-col">
        <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Pistes de recommandation</h2><button type="button" class="dbx-lien" onclick="cfChangerOnglet('recommandations')">Gérer →</button></header>
          ${recos.length ? `<div class="dbx-signaux">${recos.map((x, i) => `<div class="dbx-signal ${['budget', 'credits', 'hypo'].includes(x.cle) ? 'rouge' : ['retraite', 'projets', 'reserve'].includes(x.cle) ? 'orange' : 'bleu'}" style="--i:${i}"><span class="dbx-signal-icone">${cfIconeCat(x.cat)}</span><span class="dbx-signal-texte"><strong>${x.cat}</strong> — ${x.texte}</span></div>`).join('')}</div>` : '<div class="dbx-vide-petit">Aucune piste particulière : la situation est saine.</div>'}
        </section>
        ${A.revenuRetraite ? `<section class="dbx-carte"><header class="dbx-carte-tete"><h2>Retraite à ${A.ageRetraite} ans</h2><button type="button" class="dbx-lien" onclick="cfChangerOnglet('retraite')">Détail →</button></header>${cfBarreRetraite(A)}</section>` : ''}
      </div>
    </div>`;
}
function cfIconeCat(cat) { return { Budget: '📊', 'Épargne': '🛟', Dettes: '💳', 'Fiscalité': '🧾', Retraite: '🌅', Projets: '🎯', Immobilier: '🏡', Protection: '🛡️', Placements: '📈' }[cat] || '💡'; }

function cfGraphBudget(A) {
  const s = _cf.dossier.situation || {};
  const postes = [['logement', 'Logement', '#113679'], ['assurances_maladie', 'Caisse maladie', '#0EA5E9'], ['autres_assurances', 'Autres assurances', '#38BDF8'], ['impots', 'Impôts', '#8B5CF6'], ['transport', 'Transport', '#F59E0B'], ['vie_courante', 'Vie courante', '#10B981'], ['enfants', 'Enfants', '#EC4899'], ['loisirs', 'Loisirs & vacances', '#F97316'], ['autres', 'Autres', '#94A3B8']]
    .map(([k, l, col]) => ({ l, col, v: cfNum(cfGet(s, 'depenses.' + k)) })).filter(x => x.v > 0);
  if (!A.revenus) return '<div class="dbx-vide-petit">Revenus et dépenses à saisir dans « Situation ».</div>';
  const epargne = Math.max(0, A.capacite);
  const total = Math.max(A.revenus, A.depenses);
  const segs = [...postes, ...(epargne ? [{ l: 'Capacité d’épargne', col: '#22C55E', v: epargne }] : [])];
  return `<div class="cf-budget-barre">${segs.map(x => `<span style="flex:${x.v};background:${x.col}" title="${cfEsc(x.l)} : ${cfCHF(x.v)}"></span>`).join('')}</div>
    <div class="cf-legende">${segs.map(x => `<span><i style="background:${x.col}"></i>${cfEsc(x.l)} <b>${cfCHF(x.v)}</b> <small>${Math.round(x.v / total * 100)} %</small></span>`).join('')}</div>
    ${A.capacite < 0 ? `<div class="cf-note rouge">Dépenses supérieures aux revenus de ${cfCHF(-A.capacite)}/mois.</div>` : ''}`;
}

function cfListeProjetsMini(A) {
  return `<div class="cf-projets-mini">${A.projets.map(p => {
    const t = CF_TYPES_PROJET.find(x => x[0] === p.type) || CF_TYPES_PROJET[CF_TYPES_PROJET.length - 1];
    return `<div class="cf-projet-mini"><span class="cf-projet-icone">${t[1]}</span><div><strong>${cfEsc(p.libelle || t[2])}</strong><small>${cfCHF(p.montant)} en ${cfEsc(p.annee || '—')}${p.type === 'immobilier' ? ` · apport visé ${cfCHF(p.cible)}` : ''} · ${cfCHF(p.mensuel)}/mois</small><span class="cf-progression"><span style="width:${Math.round(p.avancement * 100)}%"></span></span></div></div>`;
  }).join('')}</div>`;
}

function cfBarreRetraite(A) {
  const total = Math.max(A.besoin, A.revenuRetraite, 1);
  const seg = (v, col, l) => v > 0 ? `<span style="width:${v / total * 100}%;background:${col}" title="${l} : ${cfCHF(v)}/an"></span>` : '';
  return `<div class="cf-retraite-barre">${seg(A.avsCouple, '#113679', 'AVS')}${seg(A.renteLPP, '#0EA5E9', 'LPP')}${seg(A.renteCapitaux, '#22C55E', '3e pilier & épargne')}${seg(A.lacune, 'repeating-linear-gradient(45deg,#EF4444 0 6px,#FCA5A5 6px 12px)', 'Lacune')}</div>
    ${A.besoin ? `<div class="cf-retraite-objectif" style="margin-left:${Math.min(100, A.besoin / total * 100)}%"><span>objectif ${cfCHF(A.besoin / 12)}/mois</span></div>` : ''}
    <div class="cf-legende"><span><i style="background:#113679"></i>AVS <b>${cfCHF(A.avsCouple / 12)}</b>/mois</span><span><i style="background:#0EA5E9"></i>LPP <b>${cfCHF(A.renteLPP / 12)}</b>/mois</span><span><i style="background:#22C55E"></i>3e pilier & épargne <b>${cfCHF(A.renteCapitaux / 12)}</b>/mois</span>${A.lacune ? `<span><i style="background:#EF4444"></i>Lacune <b>${cfCHF(A.lacune / 12)}</b>/mois</span>` : ''}</div>`;
}

// ── Onglet Situation ────────────────────────────────────────────────────────────────────────
function cfOngletSituation() {
  const s = 'situation.';
  return `<div class="cf-grille-saisie">
    <div class="cf-col-saisie">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Revenus nets mensuels</h2><span class="dbx-carte-sous">après déductions sociales, 13e salaire réparti</span></header>
        <div class="cf-champs">${cfChamp(s + 'revenus.net_client', 'Revenu net du client', { unite: 'CHF/mois' })}${cfChamp(s + 'revenus.net_conjoint', 'Revenu net du conjoint', { unite: 'CHF/mois' })}${cfChamp(s + 'revenus.locatifs', 'Revenus locatifs', { unite: 'CHF/mois' })}${cfChamp(s + 'revenus.autres', 'Autres revenus (rentes, pensions…)', { unite: 'CHF/mois' })}</div></section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Dépenses mensuelles</h2></header>
        <div class="cf-champs">${cfChamp(s + 'depenses.logement', 'Logement (loyer / intérêts, charges)', { unite: 'CHF/mois' })}${cfChamp(s + 'depenses.assurances_maladie', 'Caisse maladie (famille)', { unite: 'CHF/mois' })}${cfChamp(s + 'depenses.autres_assurances', 'Autres assurances', { unite: 'CHF/mois' })}${cfChamp(s + 'depenses.impots', 'Impôts', { unite: 'CHF/mois' })}${cfChamp(s + 'depenses.transport', 'Transport / véhicules', { unite: 'CHF/mois' })}${cfChamp(s + 'depenses.vie_courante', 'Vie courante (alimentation, ménage)', { unite: 'CHF/mois' })}${cfChamp(s + 'depenses.enfants', 'Enfants (garde, écolage)', { unite: 'CHF/mois' })}${cfChamp(s + 'depenses.loisirs', 'Loisirs & vacances', { unite: 'CHF/mois' })}${cfChamp(s + 'depenses.autres', 'Autres dépenses', { unite: 'CHF/mois' })}</div></section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Patrimoine</h2></header>
        <div class="cf-champs">${cfChamp(s + 'patrimoine.liquidites', 'Liquidités (comptes, épargne)', { unite: 'CHF' })}${cfChamp(s + 'patrimoine.placements', 'Placements (titres, fonds)', { unite: 'CHF' })}${cfChamp(s + 'patrimoine.pilier3a', 'Avoir 3e pilier A', { unite: 'CHF' })}${cfChamp(s + 'patrimoine.pilier3b', 'Valeur de rachat 3e pilier B', { unite: 'CHF' })}${cfChamp(s + 'patrimoine.lpp', 'Avoir LPP actuel (certificat)', { unite: 'CHF' })}${cfChamp(s + 'patrimoine.immobilier', 'Valeur des biens immobiliers', { unite: 'CHF' })}${cfChamp(s + 'patrimoine.autres', 'Autres actifs', { unite: 'CHF' })}</div></section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Dettes</h2></header>
        <div class="cf-champs">${cfChamp(s + 'dettes.hypotheque', 'Hypothèques', { unite: 'CHF' })}${cfChamp(s + 'dettes.credits', 'Crédits & leasings', { unite: 'CHF' })}${cfChamp(s + 'dettes.autres', 'Autres dettes', { unite: 'CHF' })}</div></section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Prévoyance & hypothèses</h2></header>
        <div class="cf-champs">${cfChamp(s + 'prevoyance.salaire_brut', 'Salaire brut annuel (AVS) du client', { unite: 'CHF/an' })}${cfChamp(s + 'prevoyance.salaire_brut_conjoint', 'Salaire brut annuel du conjoint', { unite: 'CHF/an' })}${cfChamp(s + 'prevoyance.versement_3a', 'Versement annuel 3a', { unite: 'CHF/an', aide: `plafond ${cfCHF(CF_PLAFOND_3A)}` })}${cfChamp(s + 'prevoyance.age_retraite', 'Âge de retraite souhaité', { unite: 'ans' })}${cfChamp(s + 'prevoyance.objectif_pct', 'Objectif de revenu à la retraite', { unite: '% du revenu', aide: 'usuel : 70 à 80 %' })}${cfChamp('hypotheses.rendement', 'Rendement attendu de l’épargne', { unite: '%/an' })}${cfChamp('hypotheses.taux_marginal', 'Taux marginal d’imposition', { unite: '%' })}${cfChamp('hypotheses.esperance_vie', 'Horizon de planification', { unite: 'ans' })}</div></section>
    </div>
    <aside class="cf-col-calculs"><div id="cf-calculs" class="cf-collant">${cfPanneauSituation()}</div></aside>
  </div>`;
}
function cfPanneauSituation() {
  const A = cfAnalyse();
  return `<section class="dbx-carte cf-resume">
    <h2>Résumé</h2>
    <div class="cf-ligne"><span>Revenus nets</span><b>${cfCHF(A.revenus)}/mois</b></div>
    <div class="cf-ligne"><span>Dépenses</span><b>${cfCHF(A.depenses)}/mois</b></div>
    <div class="cf-ligne total ${A.capacite < 0 ? 'neg' : 'pos'}"><span>Capacité d’épargne</span><b>${cfCHF(A.capacite)}/mois</b></div>
    <div class="cf-sep"></div>
    <div class="cf-ligne"><span>Actifs</span><b>${cfCHF(A.patrimoine)}</b></div>
    <div class="cf-ligne"><span>Dettes</span><b>− ${cfCHF(A.dettes)}</b></div>
    <div class="cf-ligne total"><span>Patrimoine net</span><b>${cfCHF(A.net)}</b></div>
    <div class="cf-sep"></div>
    <div class="cf-ligne"><span>Réserve de sécurité</span><b class="${A.moisReserve != null && A.moisReserve < 3 ? 'neg' : ''}">${A.moisReserve != null ? A.moisReserve.toFixed(1).replace('.', ',') + ' mois' : '—'}</b></div>
    ${A.salaire ? `<div class="cf-ligne"><span>Potentiel 3a non utilisé</span><b>${cfCHF(A.manque3a)}/an</b></div><div class="cf-ligne"><span>Économie d’impôt possible</span><b class="pos">${cfCHF(A.economieImpot3a)}/an</b></div>` : ''}
    <p class="cf-mention">Enregistrement automatique à chaque saisie.</p>
  </section>`;
}

// ── Onglet Projets ──────────────────────────────────────────────────────────────────────────
function cfOngletProjets() {
  const projets = _cf.dossier.projets;
  return `<div class="cf-grille-saisie">
    <div class="cf-col-saisie">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Ajouter un projet</h2><span class="dbx-carte-sous">les objectifs du client, chiffrés et datés</span></header>
        <div class="cf-types">${CF_TYPES_PROJET.map(([v, i, l]) => `<button type="button" onclick="cfAjouterProjet('${v}')"><span>${i}</span>${l}</button>`).join('')}</div></section>
      ${projets.map((p, idx) => {
        const t = CF_TYPES_PROJET.find(x => x[0] === p.type) || CF_TYPES_PROJET[CF_TYPES_PROJET.length - 1];
        const b = `projets.${idx}.`;
        return `<section class="dbx-carte cf-projet"><header class="dbx-carte-tete"><h2>${t[1]} ${cfEsc(p.libelle || t[2])}</h2><button type="button" class="tr-icone" title="Retirer ce projet" aria-label="Retirer ce projet" onclick="cfRetirerProjet('${p.id}')">✕</button></header>
          <div class="cf-champs">${cfChamp(b + 'libelle', 'Intitulé', { type: 'texte', placeholder: t[2] })}${cfChamp(b + 'montant', p.type === 'immobilier' ? 'Prix du bien visé' : 'Montant nécessaire', { unite: 'CHF' })}${cfChamp(b + 'annee', 'Année visée', { placeholder: String(new Date().getFullYear() + 5) })}${cfChamp(b + 'epargne', 'Déjà épargné / disponible', { unite: 'CHF' })}${cfChamp(b + 'priorite', 'Priorité', { type: 'select', options: [['haute', 'Haute'], ['moyenne', 'Moyenne'], ['basse', 'Basse']] })}</div>
          ${p.type === 'immobilier' ? `<p class="cf-mention">Épargne visée : l’apport, soit 20 % de fonds propres + ~5 % de frais d’achat (${cfCHF(cfNum(p.montant) * 0.25)}) — le reste est financé par l’hypothèque.</p><button type="button" class="dbx-lien" onclick="cfProjetVersImmobilier('${p.id}')">→ Vérifier la capacité de financement de ce projet</button>` : ''}
        </section>`;
      }).join('')}
    </div>
    <aside class="cf-col-calculs"><div id="cf-calculs" class="cf-collant">${cfPanneauProjets()}</div></aside>
  </div>`;
}
function cfAjouterProjet(type) {
  const t = CF_TYPES_PROJET.find(x => x[0] === type);
  _cf.dossier.projets.push({ id: cfId(), type, libelle: t ? t[2] : 'Projet', montant: '', annee: new Date().getFullYear() + 5, epargne: '', priorite: 'moyenne' });
  cfPlanifierSauvegarde(); cfRendre();
}
function cfRetirerProjet(id) {
  const p = _cf.dossier.projets.find(x => x.id === id);
  if (!p || !confirm(`Retirer le projet « ${p.libelle} » ?`)) return;
  _cf.dossier.projets = _cf.dossier.projets.filter(x => x.id !== id);
  cfPlanifierSauvegarde(); cfRendre();
}
function cfProjetVersImmobilier(id) {
  const p = _cf.dossier.projets.find(x => x.id === id);
  if (!p) return;
  const s = _cf.dossier.situation;
  s.immobilier = s.immobilier || {};
  if (cfNum(p.montant)) s.immobilier.prix = cfNum(p.montant);
  if (cfNum(p.epargne) && !cfNum(s.immobilier.fonds_propres)) s.immobilier.fonds_propres = cfNum(p.epargne);
  cfPlanifierSauvegarde(); cfChangerOnglet('immobilier');
}
function cfPanneauProjets() {
  const A = cfAnalyse();
  if (!A.projets.length) return `<section class="dbx-carte cf-resume"><h2>Faisabilité</h2><p class="cf-mention">Choisis un type de projet à gauche pour commencer.</p></section>`;
  const couvert = A.besoinProjets ? Math.max(0, A.capacite) / A.besoinProjets : 1;
  const ordre = { haute: 0, moyenne: 1, basse: 2 };
  return `<section class="dbx-carte cf-resume">
    <h2>Faisabilité</h2>
    <div class="cf-jauge"><svg viewBox="0 0 120 70" aria-hidden="true"><path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="var(--border)" stroke-width="10" stroke-linecap="round"/><path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="${couvert >= 1 ? '#22C55E' : couvert >= 0.6 ? '#F59E0B' : '#EF4444'}" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="${Math.min(100, couvert * 100)} 100"/></svg><b>${Math.round(Math.min(couvert, 9.99) * 100)} %</b><small>des besoins couverts par la capacité d’épargne</small></div>
    <div class="cf-ligne"><span>Épargne nécessaire</span><b>${cfCHF(A.besoinProjets)}/mois</b></div>
    <div class="cf-ligne"><span>Capacité d’épargne</span><b>${cfCHF(A.capacite)}/mois</b></div>
    <div class="cf-sep"></div>
    ${[...A.projets].sort((a, b) => (ordre[a.priorite] ?? 1) - (ordre[b.priorite] ?? 1)).map(p => `<div class="cf-ligne"><span>${cfEsc(p.libelle)} <small>(${Math.round(p.n)} an${p.n >= 2 ? 's' : ''})</small></span><b>${cfCHF(p.mensuel)}/mois</b></div>`).join('')}
    <p class="cf-mention">Rendement supposé de ${fmtCHF(_cf.dossier.hypotheses.rendement)} %/an sur l’épargne affectée.</p>
  </section>`;
}

// ── Onglet Retraite & prévoyance ────────────────────────────────────────────────────────────
function cfOngletRetraite() {
  const s = 'situation.';
  const b = _cf.bilans;
  return `<div class="cf-grille-saisie">
    <div class="cf-col-saisie">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Projection de la retraite</h2><span class="dbx-carte-sous">AVS + LPP + 3e pilier + épargne</span></header>
        <div class="cf-champs">${cfChamp(s + 'prevoyance.salaire_brut', 'Salaire brut annuel (AVS)', { unite: 'CHF/an' })}${cfChamp(s + 'prevoyance.salaire_brut_conjoint', 'Salaire brut du conjoint (AVS couple)', { unite: 'CHF/an' })}${cfChamp(s + 'patrimoine.lpp', 'Avoir LPP actuel', { unite: 'CHF' })}${cfChamp(s + 'prevoyance.lpp_capital_projete', 'Capital LPP projeté (certificat)', { unite: 'CHF', aide: 'si connu — sinon estimé au minimum légal' })}${cfChamp(s + 'prevoyance.taux_conversion', 'Taux de conversion LPP', { unite: '%', aide: 'légal 6,8 % ; souvent 5 à 6 % en réalité' })}${cfChamp(s + 'prevoyance.rachat_lpp_annuel', 'Rachat LPP prévu', { unite: 'CHF/an' })}${cfChamp(s + 'patrimoine.pilier3a', 'Avoir 3a actuel', { unite: 'CHF' })}${cfChamp(s + 'prevoyance.versement_3a', 'Versement 3a annuel', { unite: 'CHF/an' })}${cfChamp(s + 'prevoyance.age_retraite', 'Âge de retraite', { unite: 'ans' })}${cfChamp(s + 'prevoyance.objectif_pct', 'Objectif de revenu', { unite: '% du revenu actuel' })}</div></section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Protection décès & invalidité</h2><button type="button" class="dbx-lien" onclick="cfOuvrirBilanPrevoyance()">Analyse de prévoyance complète →</button></header>
        ${b.length ? `<div class="cf-bilans">${b.slice(0, 4).map(x => `<button type="button" class="cf-bilan" onclick="window._bilansPrevoyanceActuel=_cf.bilans;voirBilanSauvegarde('${x.id}')"><strong>Bilan du ${fmtDate(x.created_at)}</strong><small>${cfEsc(x.resume || '')}</small></button>`).join('')}</div>`
        : '<div class="dbx-vide-petit">Aucun bilan de prévoyance enregistré pour ce client. Le bilan complet calcule les lacunes en cas de décès et d’invalidité (AVS/AI + LPP).</div>'}
      </section>
    </div>
    <aside class="cf-col-calculs"><div id="cf-calculs" class="cf-collant">${cfPanneauRetraite()}</div></aside>
  </div>`;
}
function cfOuvrirBilanPrevoyance() {
  cfSauverMaintenant();
  const id = _cf.client.id;
  window._apClientInitial = id;
  navigate('analyse-prevoyance');
}
function cfPanneauRetraite() {
  const A = cfAnalyse();
  if (A.age == null) return `<section class="dbx-carte cf-resume"><h2>Retraite</h2><p class="cf-mention">Date de naissance manquante sur la fiche client : impossible de projeter la retraite.</p></section>`;
  return `<section class="dbx-carte cf-resume">
    <h2>À ${A.ageRetraite} ans <small>(dans ${A.annees} an${A.annees > 1 ? 's' : ''})</small></h2>
    ${A.revenuRetraite || A.besoin ? cfBarreRetraite(A) : ''}
    <div class="cf-ligne"><span>Rente AVS${A.avsConjoint ? ' (couple)' : ''}</span><b>${cfCHF(A.avsCouple / 12)}/mois</b></div>
    <div class="cf-ligne"><span>Rente LPP <small>${A.lppProjeteCertificat ? 'certificat' : 'minimum légal'}</small></span><b>${cfCHF(A.renteLPP / 12)}/mois</b></div>
    <div class="cf-ligne"><span>3e pilier & épargne <small>sur ${A.dureeRetraite} ans</small></span><b>${cfCHF(A.renteCapitaux / 12)}/mois</b></div>
    <div class="cf-ligne total"><span>Revenu estimé</span><b>${cfCHF(A.revenuRetraite / 12)}/mois</b></div>
    <div class="cf-ligne"><span>Objectif</span><b>${cfCHF(A.besoin / 12)}/mois</b></div>
    ${A.lacune ? `<div class="cf-ligne total neg"><span>Lacune</span><b>${cfCHF(A.lacune / 12)}/mois</b></div>
      <div class="cf-note rouge">Capital à constituer ≈ ${cfCHF(A.capitalManquant)}, soit <b>${cfCHF(A.epargneRetraite)}/mois</b> d’épargne jusqu’à la retraite.</div>` : A.besoin ? '<div class="cf-note vert">Objectif de revenu atteint ✓</div>' : ''}
    <div class="cf-sep"></div>
    <div class="cf-ligne"><span>Capital LPP projeté</span><b>${cfCHF(A.capitalLPP)}</b></div>
    <div class="cf-ligne"><span>Capital 3a projeté</span><b>${cfCHF(A.capital3a)}</b></div>
    <p class="cf-mention">Estimation indicative : AVS sur carrière complète (échelle 44), LPP ${A.lppProjeteCertificat ? 'selon certificat' : 'au minimum légal (bonifications légales, intérêt ' + fmtCHF(_cf.dossier.hypotheses.interet_lpp) + ' %)'} ; à confirmer par l’extrait AVS et le certificat de caisse de pension.</p>
  </section>`;
}

// ── Onglet Immobilier ───────────────────────────────────────────────────────────────────────
function cfOngletImmobilier() {
  const s = 'situation.';
  return `<div class="cf-grille-saisie">
    <div class="cf-col-saisie">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Projet d’achat</h2><span class="dbx-carte-sous">règles usuelles : 20 % de fonds propres dont 10 % hors LPP, charges ≤ 33 % du revenu</span></header>
        <div class="cf-champs">${cfChamp(s + 'immobilier.prix', 'Prix du bien', { unite: 'CHF' })}${cfChamp(s + 'immobilier.fonds_propres', 'Fonds propres disponibles (total)', { unite: 'CHF' })}${cfChamp(s + 'immobilier.fonds_propres_lpp', 'dont 2e pilier (EPL)', { unite: 'CHF' })}${cfChamp(s + 'immobilier.type', 'Type de résidence', { type: 'select', options: [['principale', 'Résidence principale'], ['secondaire', 'Résidence secondaire']] })}${cfChamp(s + 'prevoyance.salaire_brut', 'Revenu brut annuel du client', { unite: 'CHF/an' })}${cfChamp(s + 'prevoyance.salaire_brut_conjoint', 'Revenu brut du conjoint', { unite: 'CHF/an' })}</div>
        <button type="button" class="dbx-lien" onclick="cfOuvrirSimulateurImmo()">→ Ouvrir le simulateur détaillé (curseurs, impression)</button></section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Bien déjà détenu</h2></header>
        <div class="cf-champs">${cfChamp(s + 'patrimoine.immobilier', 'Valeur du bien', { unite: 'CHF' })}${cfChamp(s + 'dettes.hypotheque', 'Hypothèque actuelle', { unite: 'CHF' })}${cfChamp(s + 'immobilier.taux_actuel', 'Taux effectif actuel', { unite: '%' })}${cfChamp(s + 'immobilier.echeance', 'Échéance de l’hypothèque (année)', { placeholder: String(new Date().getFullYear() + 3) })}</div></section>
    </div>
    <aside class="cf-col-calculs"><div id="cf-calculs" class="cf-collant">${cfPanneauImmobilier()}</div></aside>
  </div>`;
}
function cfOuvrirSimulateurImmo() {
  cfSauverMaintenant();
  const s = _cf.dossier.situation || {}, im = s.immobilier || {}, p = s.prevoyance || {};
  // Le simulateur (js/24) s'ouvre prérempli avec les données du dossier
  const c = _cf.client, pa = s.patrimoine || {};
  const lpp = cfNum(im.fonds_propres_lpp);
  window._fiInitial = { clientId: c.id, d: {
    nom: cfNomClient(c), naissance: c.date_naissance || '', prix: cfNum(im.prix) || '', type: im.type === 'secondaire' ? 'secondaire' : 'principale',
    fp_epargne: cfNum(im.fonds_propres) ? Math.max(0, cfNum(im.fonds_propres) - lpp) : (cfNum(pa.liquidites) || ''), fp_lpp: lpp || '',
    revenu: (cfNum(p.salaire_brut) + cfNum(p.salaire_brut_conjoint)) || '', age_retraite: cfNum(p.age_retraite) || 65,
    taux_effectif: cfNum(im.taux_actuel) || 1.8,
  } };
  navigate('calc-immo');
}
function cfPanneauImmobilier() {
  const A = cfAnalyse();
  const s = _cf.dossier.situation || {}, im = s.immobilier || {};
  let html = '';
  if (A.hypo) {
    const h = A.hypo;
    html += `<section class="dbx-carte cf-resume">
      <h2>${h.ok ? '✅ Projet finançable' : '❌ Pas finançable en l’état'}</h2>
      <div class="cf-ligne"><span>Fonds propres (min. 20 %)</span><b class="${h.fpSuffisants ? 'pos' : 'neg'}">${cfCHF(h.params.fondsPropresDisponibles)} / ${cfCHF(h.fpMinRequis)}</b></div>
      <div class="cf-ligne"><span>dont hors LPP (min. 10 %)</span><b class="${h.fpDursSuffisants ? 'pos' : 'neg'}">${cfCHF(h.fondsPropresDurs)} / ${cfCHF(h.fpDursRequis)}</b></div>
      <div class="cf-ligne"><span>Hypothèque</span><b>${cfCHF(h.hypotheque)}</b></div>
      <div class="cf-ligne"><span>Charge théorique annuelle</span><b>${cfCHF(h.chargeTotaleAnnuelle)}</b></div>
      <div class="cf-ligne total ${h.tauxEffort <= 0.33 ? 'pos' : 'neg'}"><span>Taux d’effort (max. 33 %)</span><b>${(h.tauxEffort * 100).toFixed(1).replace('.', ',')} %</b></div>
      <div class="cf-ligne"><span>Prix maximal finançable</span><b>${cfCHF(h.prixMax)}</b></div>
      <div class="cf-schema">${schemaMaisonFinancement(h.params.fondsPropresDisponibles, h.premierRang, h.deuxiemeRang, h.params.prix, h.params.dureeAmortissement)}</div>
      <p class="cf-mention">Taux théorique 5 %, entretien 1 %, amortissement du 2e rang sur ${h.params.dureeAmortissement} ans — standards de branche, chaque prêteur a ses critères.</p>
    </section>`;
  } else {
    html += `<section class="dbx-carte cf-resume"><h2>Capacité de financement</h2><p class="cf-mention">Renseigne le prix du bien, les fonds propres et le revenu brut pour vérifier le financement.</p></section>`;
  }
  if (A.hypoActuelle) {
    html += `<section class="dbx-carte cf-resume"><h2>Bien actuel</h2>
      <div class="cf-ligne"><span>Taux d’avance</span><b>${A.valeurBien ? Math.round(A.hypoActuelle / A.valeurBien * 100) + ' %' : '—'}</b></div>
      ${cfNum(im.taux_actuel) ? `<div class="cf-ligne"><span>Intérêts actuels</span><b>${cfCHF(A.hypoActuelle * cfNum(im.taux_actuel) / 100 / 12)}/mois</b></div>` : ''}
      ${A.tauxEffortActuel != null ? `<div class="cf-ligne ${A.tauxEffortActuel > 0.33 ? 'neg' : ''}"><span>Charge théorique / revenu</span><b>${(A.tauxEffortActuel * 100).toFixed(1).replace('.', ',')} %</b></div>` : ''}
      ${cfNum(im.echeance) ? `<div class="cf-ligne"><span>Renouvellement</span><b>${cfNum(im.echeance)}${cfNum(im.echeance) - new Date().getFullYear() <= 2 ? ' — à préparer' : ''}</b></div>` : ''}
    </section>`;
  }
  return html;
}

// ── Onglet Recommandations & notes ──────────────────────────────────────────────────────────
function cfOngletRecommandations() {
  const A = cfAnalyse();
  const d = _cf.dossier;
  const retenues = new Set(d.recommandations.map(r => r.cle).filter(Boolean));
  const auto = cfRecommandationsAuto(A).filter(x => !retenues.has(x.cle));
  const STATUTS = [['proposee', 'Proposée'], ['acceptee', 'Acceptée'], ['realisee', 'Réalisée'], ['refusee', 'Refusée']];
  return `<div class="dbx-grille">
    <div class="dbx-col">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Recommandations du dossier</h2><span class="dbx-carte-sous">ce que tu présentes au client, et leur suivi</span></header>
        ${d.recommandations.length ? `<div class="cf-recos">${d.recommandations.map(r => `<div class="cf-reco ${r.statut}">
          <span class="cf-reco-icone">${cfIconeCat(r.cat)}</span>
          <div class="cf-reco-texte"><small>${cfEsc(r.cat || 'Conseil')}</small><textarea rows="2" aria-label="Recommandation" oninput="cfMajReco('${r.id}','texte',this.value)">${cfEsc(r.texte)}</textarea></div>
          <select aria-label="Statut" onchange="cfMajReco('${r.id}','statut',this.value);cfRendre()">${STATUTS.map(([v, l]) => `<option value="${v}" ${r.statut === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button type="button" class="tr-icone" title="Créer une opportunité" aria-label="Créer une opportunité" onclick="cfRecoVersOpportunite('${r.id}')">🎯</button>
          <button type="button" class="tr-icone" title="Retirer" aria-label="Retirer" onclick="cfRetirerReco('${r.id}')">✕</button>
        </div>`).join('')}</div>` : '<div class="dbx-vide-petit">Aucune recommandation retenue. Ajoute les pistes proposées à droite, ou écris la tienne.</div>'}
        <div class="cf-ajout-reco"><input id="cf-nouvelle-reco" placeholder="Ta recommandation (ex. Ouvrir un 3a en titres chez…)" onkeydown="if(event.key==='Enter')cfAjouterRecoLibre()"/><button type="button" class="btn-save" onclick="cfAjouterRecoLibre()">Ajouter</button></div>
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Notes d’entretien</h2></header>
        <textarea class="cf-notes" rows="8" placeholder="Attentes du client, profil de risque, contexte familial, décisions prises…" oninput="_cf.dossier.notes=this.value;cfPlanifierSauvegarde()">${cfEsc(d.notes || '')}</textarea>
      </section>
    </div>
    <div class="dbx-col">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Pistes proposées par l’analyse</h2></header>
        ${auto.length ? `<div class="dbx-signaux">${auto.map((x, i) => `<div class="dbx-signal bleu" style="--i:${i}"><span class="dbx-signal-icone">${cfIconeCat(x.cat)}</span><span class="dbx-signal-texte"><strong>${x.cat}</strong> — ${x.texte}</span><button type="button" onclick="cfRetenirReco('${x.cle}')">Retenir</button></div>`).join('')}</div>` : '<div class="dbx-vide-petit">Toutes les pistes ont été traitées.</div>'}
      </section>
    </div>
  </div>`;
}
function cfRetenirReco(cle) {
  const x = cfRecommandationsAuto(cfAnalyse()).find(r => r.cle === cle);
  if (!x) return;
  _cf.dossier.recommandations.push({ id: cfId(), cle, cat: x.cat, texte: x.texte, statut: 'proposee', date: new Date().toISOString().slice(0, 10) });
  cfPlanifierSauvegarde(); cfRendre();
}
function cfAjouterRecoLibre() {
  const el = document.getElementById('cf-nouvelle-reco');
  const t = (el && el.value || '').trim();
  if (!t) return;
  _cf.dossier.recommandations.push({ id: cfId(), cat: 'Conseil', texte: t, statut: 'proposee', date: new Date().toISOString().slice(0, 10) });
  cfPlanifierSauvegarde(); cfRendre();
}
function cfMajReco(id, champ, val) { const r = _cf.dossier.recommandations.find(x => x.id === id); if (r) { r[champ] = val; cfPlanifierSauvegarde(); } }
function cfRetirerReco(id) { _cf.dossier.recommandations = _cf.dossier.recommandations.filter(x => x.id !== id); cfPlanifierSauvegarde(); cfRendre(); }
async function cfRecoVersOpportunite(id) {
  const r = _cf.dossier.recommandations.find(x => x.id === id);
  if (!r) return;
  await cfSauverMaintenant();
  prefillOpportuniteClientId = _cf.client.id; opportuniteEnEditionId = null;
  await navigate('nouvelle-opportunite');
  const titre = document.getElementById('opp-titre') || document.querySelector('input[id*="titre"]');
  if (titre && !titre.value) titre.value = `${r.cat} — ${r.texte}`.slice(0, 120);
}

// ── Rapport client imprimable ───────────────────────────────────────────────────────────────
async function cfImprimerRapport() {
  await cfSauverMaintenant();
  const A = cfAnalyse(), c = _cf.client, d = _cf.dossier;
  const ligne = (l, v) => `<tr><td>${l}</td><td class="n">${v}</td></tr>`;
  const recos = d.recommandations.filter(r => r.statut !== 'refusee');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Conseil financier — ${cfEsc(cfNomClient(c))}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#0E1B33;margin:0;padding:32px 40px;font-size:12.5px;line-height:1.5}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #113679;padding-bottom:12px;margin-bottom:22px}
    header img{height:34px} h1{font-size:22px;margin:0;color:#113679} h2{font-size:14px;color:#113679;border-bottom:1px solid #E2E7EF;padding-bottom:4px;margin:22px 0 8px}
    .sous{color:#56627A;font-size:11px} table{width:100%;border-collapse:collapse} td{padding:4px 0;border-bottom:1px solid #F0F2F6} td.n{text-align:right;font-weight:bold}
    .grille{display:grid;grid-template-columns:1fr 1fr;gap:24px} .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}
    .kpi{background:#F4F6F9;border-radius:8px;padding:10px} .kpi b{display:block;font-size:15px;color:#113679} .kpi span{font-size:10px;color:#56627A;text-transform:uppercase}
    .reco{padding:8px 10px;border-left:3px solid #00CFFF;background:#F4F9FC;margin-bottom:6px} .reco small{color:#56627A;text-transform:uppercase;font-size:9.5px}
    .mention{font-size:9.5px;color:#8A94A8;margin-top:24px;border-top:1px solid #E2E7EF;padding-top:8px} @page{margin:14mm}
  </style></head><body>
  <header><div><h1>Conseil financier</h1><div class="sous">${cfEsc(cfNomClient(c))}${A.age ? ` · ${A.age} ans` : ''} · ${new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>${typeof ASSUREX_LOGO_B64 !== 'undefined' ? `<img src="${ASSUREX_LOGO_B64}" alt="Assurex"/>` : ''}</header>
  <div class="kpis"><div class="kpi"><span>Patrimoine net</span><b>${cfCHF(A.net)}</b></div><div class="kpi"><span>Capacité d'épargne</span><b>${cfCHF(A.capacite)}/mois</b></div><div class="kpi"><span>Revenu à la retraite</span><b>${cfCHF(A.revenuRetraite / 12)}/mois</b></div><div class="kpi"><span>Projets</span><b>${A.projets.length}</b></div></div>
  <div class="grille">
    <div><h2>Budget mensuel</h2><table>${ligne('Revenus nets', cfCHF(A.revenus))}${ligne('Dépenses', cfCHF(A.depenses))}${ligne('Capacité d’épargne', cfCHF(A.capacite))}</table>
      <h2>Patrimoine</h2><table>${ligne('Actifs', cfCHF(A.patrimoine))}${ligne('Dettes', cfCHF(A.dettes))}${ligne('Patrimoine net', cfCHF(A.net))}${ligne('Réserve de sécurité', A.moisReserve != null ? A.moisReserve.toFixed(1).replace('.', ',') + ' mois' : '—')}</table></div>
    <div><h2>Retraite à ${A.ageRetraite} ans</h2><table>${ligne('Rente AVS', cfCHF(A.avsCouple / 12) + '/mois')}${ligne('Rente LPP', cfCHF(A.renteLPP / 12) + '/mois')}${ligne('3e pilier & épargne', cfCHF(A.renteCapitaux / 12) + '/mois')}${ligne('Revenu estimé', cfCHF(A.revenuRetraite / 12) + '/mois')}${ligne('Objectif', cfCHF(A.besoin / 12) + '/mois')}${A.lacune ? ligne('Lacune', cfCHF(A.lacune / 12) + '/mois') + ligne('Épargne pour la combler', cfCHF(A.epargneRetraite) + '/mois') : ''}</table></div>
  </div>
  ${A.projets.length ? `<h2>Projets</h2><table>${A.projets.map(p => ligne(`${cfEsc(p.libelle)} — ${cfCHF(p.montant)} en ${cfEsc(p.annee)}`, cfCHF(p.mensuel) + '/mois')).join('')}</table>` : ''}
  ${A.hypo ? `<h2>Financement immobilier</h2><table>${ligne('Prix du bien', cfCHF(A.hypo.params.prix))}${ligne('Fonds propres', cfCHF(A.hypo.params.fondsPropresDisponibles))}${ligne('Hypothèque', cfCHF(A.hypo.hypotheque))}${ligne('Taux d’effort', (A.hypo.tauxEffort * 100).toFixed(1) + ' %')}${ligne('Prix maximal finançable', cfCHF(A.hypo.prixMax))}</table>` : ''}
  ${recos.length ? `<h2>Nos recommandations</h2>${recos.map(r => `<div class="reco"><small>${cfEsc(r.cat || 'Conseil')}</small><div>${cfEsc(r.texte)}</div></div>`).join('')}` : ''}
  ${typeof rexCitationRapportHtml === 'function' ? rexCitationRapportHtml('investissement') : ''}
  <div class="mention">Document établi à titre indicatif sur la base des informations communiquées par le client. Les projections (AVS, LPP, rendements, fiscalité) sont des estimations et ne constituent pas une garantie ; elles doivent être confirmées par les documents officiels (extrait de compte AVS, certificat de prévoyance, offres des établissements). Assurex Sàrl — courtier en assurances inscrit auprès de la FINMA.</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`;
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  if (!w) showError('Autorise les fenêtres pop-up pour afficher le rapport.');
  logAction('rapport_conseil', 'dossiers_conseil', d.id, cfNomClient(c));
}
