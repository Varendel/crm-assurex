// ═══ PROFIL INVESTISSEUR & ALLOCATION DE L'ÉPARGNE (20.09.2026, demande de Jonathan) ════════════
// Dans le dossier de conseil financier : on CHOISIT un profil de risque (pas de questionnaire à
// remplir), et le CRM en déduit :
//   - la répartition recommandée de l'épargne : réserve de sécurité, 3e pilier A, placement libre ;
//   - une projection du capital à l'horizon (retraite ou projet le plus éloigné), avec fourchette ;
//   - un AVERTISSEMENT quand l'horizon des projets est trop court pour le profil choisi
//     (ex. apport immobilier dans 3 ans avec un profil Croissance qui demande 8 ans).
// Les rendements sont des hypothèses de travail, pas une promesse : ils s'affichent comme tels et
// la fourchette montre ce que peut donner une mauvaise année. Rien n'est un conseil automatique :
// le conseiller garde la main, le texte part ensuite dans les recommandations du dossier.

// Les noms anglais sont ceux des compagnies et des banques (Swiss Life, Zurich, Helvetia, UBS…) :
// le client les retrouve tels quels sur les offres et les relevés de fonds (demande du 20.09.2026).
const PROFILS_INVESTISSEUR = [
  { id: 'securite',  label: 'Sécurité',   en: 'Conservative', actions: 0,  rendement: 1.0, volatilite: 2,  horizon: 2,  perte: -3,
    resume: 'Capital préservé, rendement proche du compte épargne.', pour: 'argent nécessaire à court terme' },
  { id: 'revenu',    label: 'Revenu',     en: 'Income',       actions: 25, rendement: 2.2, volatilite: 5,  horizon: 4,  perte: -8,
    resume: 'Majorité d’obligations, une part d’actions pour le rendement.', pour: 'projets à 4–6 ans' },
  { id: 'equilibre', label: 'Équilibré',  en: 'Balanced',     actions: 45, rendement: 3.2, volatilite: 8,  horizon: 6,  perte: -15,
    resume: 'Autant de sécurité que de croissance — le choix le plus courant.', pour: 'épargne de moyen terme et 3a' },
  { id: 'croissance',label: 'Croissance', en: 'Growth',       actions: 65, rendement: 4.0, volatilite: 11, horizon: 8,  perte: -25,
    resume: 'Orienté actions, avec des années négatives assumées.', pour: 'retraite à plus de 8 ans' },
  { id: 'actions',   label: 'Actions',    en: 'Equity',       actions: 90, rendement: 5.0, volatilite: 15, horizon: 10, perte: -35,
    resume: 'Quasi tout en actions : rendement visé le plus élevé, secousses comprises.', pour: 'horizon long, tolérance aux baisses' },
];
function piNomProfil(p) { return `${p.label} · ${p.en}`; }

function piProfil(id) { return PROFILS_INVESTISSEUR.find(p => p.id === id) || PROFILS_INVESTISSEUR[2]; }
function piProfilActif() { return piProfil(cfGet(_cf.dossier, 'hypotheses.profil_investisseur') || 'equilibre'); }

function piChoisirProfil(id) {
  cfSet(_cf.dossier, 'hypotheses.profil_investisseur', id);
  // Le rendement des projections du dossier suit le profil choisi (modifiable ensuite dans Hypothèses)
  _cf.dossier.hypotheses.rendement = piProfil(id).rendement;
  cfPlanifierSauvegarde();
  cfRendre();
}

// Réserve de sécurité recommandée : 3 mois de dépenses (6 pour un indépendant)
function piReserveCible(A) {
  const indep = /ind[ée]pendant/i.test(cfGet(_cf.dossier, 'situation.profession') || '');
  return { mois: indep ? 6 : 3, montant: A.depenses * (indep ? 6 : 3) };
}

// Répartition recommandée de la capacité d'épargne mensuelle
function piAllocation(A) {
  const p = piProfilActif();
  const capacite = Math.max(0, A.capacite);
  const reserve = piReserveCible(A);
  const manqueReserve = Math.max(0, reserve.montant - A.liquidites);
  const lignes = [];
  let reste = capacite;

  // 1. Reconstituer la réserve de sécurité (liquidités, aucun risque) — étalée sur 12 mois max
  if (manqueReserve > 0 && reste > 0) {
    const m = Math.min(reste, Math.max(manqueReserve / 12, capacite * 0.2));
    lignes.push({ cle: 'reserve', label: 'Réserve de sécurité', montant: m, support: 'Compte épargne (aucun risque)',
      detail: `${cfCHF(manqueReserve)} manquants pour atteindre ${reserve.mois} mois de dépenses (${cfCHF(reserve.montant)})` });
    reste -= m;
  }
  // 2. 3e pilier A jusqu'au plafond — déduction fiscale immédiate
  const verse3a = cfNum(cfGet(_cf.dossier, 'situation.prevoyance.versement_3a'));
  const place3a = Math.max(0, CF_PLAFOND_3A - verse3a);
  if (place3a > 0 && reste > 0) {
    const m = Math.min(reste, place3a / 12);
    lignes.push({ cle: '3a', label: '3e pilier A', montant: m, support: `Fonds 3a — profil ${piNomProfil(p)} (${p.actions} % actions)`,
      detail: `${cfCHF(place3a)} encore déductibles cette année · économie d’impôt estimée ${cfCHF(A.economieImpot3a)}` });
    reste -= m;
  }
  // 3. Projets à court terme : ce qui est nécessaire avant l'horizon du profil reste sans risque
  const courtTerme = A.projets.filter(pr => pr.n < p.horizon && pr.mensuel > 0);
  const besoinCourt = courtTerme.reduce((s, pr) => s + pr.mensuel, 0);
  if (besoinCourt > 0 && reste > 0) {
    const m = Math.min(reste, besoinCourt);
    lignes.push({ cle: 'projets', label: 'Projets à moins de ' + p.horizon + ' ans', montant: m, support: 'Compte épargne ou placement court terme',
      detail: courtTerme.map(pr => `${pr.libelle || pr.type || 'Projet'} dans ${Math.round(pr.n)} an(s)`).join(' · ') });
    reste -= m;
  }
  // 4. Le solde : placement libre au profil choisi
  if (reste > 0) lignes.push({ cle: 'libre', label: 'Placement libre', montant: reste, support: `Portefeuille ${piNomProfil(p)} (${p.actions} % actions)`,
    detail: `Horizon recommandé : ${p.horizon} ans et plus` });

  return { profil: p, capacite, lignes, reserve, manqueReserve, courtTerme, besoinCourt };
}

// Projection d'un capital : versement mensuel + capital de départ, avec fourchette (± volatilité / √n)
function piProjection(capitalDepart, mensuel, annees, profil) {
  const central = cfValeurFuture(capitalDepart, mensuel * 12, annees, profil.rendement);
  const bas = cfValeurFuture(capitalDepart, mensuel * 12, annees, Math.max(-1, profil.rendement - profil.volatilite / Math.sqrt(Math.max(1, annees))));
  const haut = cfValeurFuture(capitalDepart, mensuel * 12, annees, profil.rendement + profil.volatilite / Math.sqrt(Math.max(1, annees)));
  return { central, bas, haut, verse: capitalDepart + mensuel * 12 * annees };
}

// Avertissements : profil trop offensif pour les échéances, réserve absente, rien à placer
function piAvertissements(A, alloc) {
  const p = alloc.profil;
  const av = [];
  alloc.courtTerme.forEach(pr => {
    av.push({ ton: 'rouge', texte: `<strong>${cfEsc(pr.libelle || pr.type || 'Projet')}</strong> arrive dans ${Math.round(pr.n)} an(s), alors que le profil <strong>${piNomProfil(p)}</strong> demande au moins ${p.horizon} ans. L’argent de ce projet (${cfCHF(pr.mensuel)}/mois) doit rester sans risque — sinon une baisse juste avant l’échéance coûterait jusqu’à ${p.perte} %.` });
  });
  if (A.annees != null && A.annees < p.horizon) av.push({ ton: 'rouge', texte: `La retraite est dans ${A.annees} an(s) et le profil <strong>${piNomProfil(p)}</strong> demande ${p.horizon} ans : choisis un profil plus prudent pour la part qui financera les premières années de retraite.` });
  if (alloc.manqueReserve > 0) av.push({ ton: 'orange', texte: `Réserve de sécurité incomplète : ${cfCHF(alloc.manqueReserve)} manquants pour ${alloc.reserve.mois} mois de dépenses. À constituer avant d’investir.` });
  if (alloc.capacite <= 0) av.push({ ton: 'orange', texte: 'Aucune capacité d’épargne dans le budget saisi : commencer par le budget avant de parler placement.' });
  if (!av.length) av.push({ ton: 'vert', texte: `Profil <strong>${piNomProfil(p)}</strong> cohérent avec les échéances saisies (la plus proche dépasse ${p.horizon} ans).` });
  return av;
}

// ── Solutions concrètes : c'est là qu'on sort du conseil pour proposer un produit ───────────────
// Objectif (Jonathan, 20.09.2026) : le profil et l'allocation doivent déboucher sur une POLICE VIE
// (3a lié, 3b libre, amortissement indirect) ou un FINANCEMENT LONG TERME (hypothèque, apport),
// avec la prime mensuelle, les compagnies à solliciter, et le bouton qui crée l'affaire.
const PI_COMPAGNIES_VIE = ['Swiss Life', 'Helvetia', 'Generali', 'PAX', 'Zurich', 'Groupe Mutuel'];

function piSolutions(A, alloc) {
  const p = alloc.profil;
  const s = [];
  const m = cle => (alloc.lignes.find(l => l.cle === cle) || {}).montant || 0;
  const mens = x => `${cfCHF(x)}/mois`;
  const hypo = A.hypoActuelle || 0;

  // 1. 3e pilier A — police vie liée, la solution de base quand il reste du plafond
  if (m('3a') > 0) s.push({
    icone: '🛡️', titre: 'Police vie liée 3a', produit: 'Assurance vie liée 3a (pilier 3a)',
    prime: m('3a'), horizon: A.annees,
    pourquoi: `Déductible du revenu (${cfCHF(A.economieImpot3a)} d’impôt économisé cette année), capital garanti au décès et à l’invalidité, fonds au profil ${p.label}.`,
    compagnies: PI_COMPAGNIES_VIE,
  });
  // 2. Amortissement indirect : hypothèque existante + 3a → financement long terme
  if (hypo > 0) s.push({
    icone: '🏡', titre: 'Amortissement indirect de l’hypothèque', produit: 'Assurance vie liée 3a (pilier 3a)',
    prime: Math.min(CF_PLAFOND_3A / 12, Math.max(m('3a'), hypo * 0.01 / 12)), horizon: A.annees,
    pourquoi: `Hypothèque de ${cfCHF(hypo)} : amortir via une police 3a nantie plutôt qu’en direct garde la dette (et sa déduction fiscale) et fait travailler l’épargne au profil ${p.label}.`,
    compagnies: PI_COMPAGNIES_VIE, route: 'calc-immo',
  });
  // 3. Projet immobilier : apport à constituer + financement à préparer
  const projetImmo = A.projets.find(x => x.type === 'immobilier');
  if (projetImmo) s.push({
    icone: '🔑', titre: 'Financement immobilier à préparer', produit: 'Financement / hypothèque',
    prime: projetImmo.mensuel, horizon: projetImmo.n,
    pourquoi: `Apport de ${cfCHF(projetImmo.cible)} à réunir d’ici ${Math.round(projetImmo.n)} an(s). À moins de ${p.horizon} ans, cette part reste sans risque ; le 2e pilier et le 3a peuvent être nantis ou retirés.`,
    compagnies: [], route: 'calc-immo',
  });
  // 4. Placement libre — police vie 3b ou plan d'épargne en fonds
  if (m('libre') > 0) s.push({
    icone: '📈', titre: 'Épargne libre : police vie 3b ou plan en fonds', produit: 'Assurance vie liée 3b',
    prime: m('libre'), horizon: Math.max(p.horizon, A.annees || p.horizon),
    pourquoi: `Au-delà du plafond 3a : police vie 3b (bénéficiaires désignés, capital en cas de décès) ou plan d’épargne en fonds si la souplesse prime. Profil ${p.label}, horizon ${p.horizon} ans et plus.`,
    compagnies: PI_COMPAGNIES_VIE,
  });
  // 5. Lacune de retraite non couverte par ce qui précède
  if (A.lacune > 0 && A.epargneRetraite > m('3a') + m('libre')) s.push({
    icone: '🌅', titre: 'Compléter la retraite', produit: 'Rachats LPP + vie 3a',
    prime: A.epargneRetraite, horizon: A.annees,
    pourquoi: `Lacune estimée à ${cfCHF(A.lacune)}/an à la retraite : il manque ${cfCHF(Math.max(0, A.epargneRetraite - m('3a') - m('libre')))}/mois. Rachats LPP (déductibles, sans risque de marché) puis vie 3a pour le solde.`,
    compagnies: PI_COMPAGNIES_VIE,
  });
  return s;
}

function piHtmlSolutions(A, alloc) {
  const sols = piSolutions(A, alloc);
  if (!sols.length) return '<div class="dbx-vide-petit">Pas encore de solution à proposer : compléter le budget et les projets.</div>';
  return `<div class="pi-solutions">${sols.map(x => `<article class="pi-solution">
    <div class="pi-sol-tete"><span aria-hidden="true">${x.icone}</span><b>${cfEsc(x.titre)}</b><em>${cfCHF(x.prime)}/mois${x.horizon ? ` · ${Math.round(x.horizon)} ans` : ''}</em></div>
    <p>${x.pourquoi}</p>
    ${x.compagnies.length ? `<div class="pi-sol-cies">${x.compagnies.map(c => `<span>${typeof pictoCompagnie === 'function' ? pictoCompagnie(c, 20) : ''} ${cfEsc(c)}</span>`).join('')}</div>` : ''}
    <div class="pi-sol-actions">
      <button type="button" class="btn-save" onclick="piCreerOpportunite('${encodeURIComponent(x.titre)}', '${encodeURIComponent(x.produit)}', ${Math.round(x.prime * 12)})">🎯 Créer l’affaire</button>
      <button type="button" class="btn-secondary" onclick="piDemandeOffre()">📝 Demander des offres</button>
      ${x.route ? `<button type="button" class="btn-secondary" onclick="cfSauverMaintenant().then(() => navigate('${x.route}'))">🏡 Simulateur</button>` : ''}
    </div>
  </article>`).join('')}</div>`;
}

// Crée l'opportunité depuis le dossier de conseil (le formulaire s'ouvre pré-rempli, rien n'est
// enregistré tant que l'utilisateur n'a pas validé)
function piCreerOpportunite(titre, produit, primeAnnuelle) {
  const c = _cf.client;
  prefillOpportuniteClientId = c.id;
  if (typeof opportuniteEnEditionId !== 'undefined') opportuniteEnEditionId = null;
  window._opcPrefill = { titre: decodeURIComponent(titre), produit: decodeURIComponent(produit), montant: primeAnnuelle, origine: 'conseil financier' };
  cfSauverMaintenant().then(() => navigate('nouvelle-opportunite'));
}
function piDemandeOffre() {
  prefillDemandeOffreClientId = _cf.client.id;
  cfSauverMaintenant().then(() => navigate('nouvelle-demande-offre'));
}

// Résumé « votre projet en quelques lignes » — sert d'ouverture et de fil conducteur au rapport
// client (demande de Jonathan, 20.09.2026 : le rapport doit raconter une histoire, pas empiler
// des tableaux). Retourne des phrases prêtes à lire, dans l'ordre : où on en est, ce qu'on vise,
// ce qu'on met en place, ce qu'on surveille.
function piResumeProjet(A, alloc) {
  const p = (alloc && alloc.profil) || piProfilActif();
  const c = _cf.client;
  const nom = typeof cfNomClient === 'function' ? cfNomClient(c) : '';
  const projets = (A.projets || []).slice().sort((a, b) => a.n - b.n);
  const principal = projets[0];
  const phrases = [];

  phrases.push(`${nom || 'Vous'}${A.age ? `, ${A.age} ans,` : ''} dispose${nom ? '' : 'z'} aujourd’hui de ${cfCHF(Math.max(0, A.capacite))} par mois d’épargne possible, pour un patrimoine net de ${cfCHF(A.net)}${A.moisReserve != null ? ` et une réserve de sécurité de ${A.moisReserve.toFixed(1).replace('.', ',')} mois de dépenses` : ''}.`);

  const objectifs = [];
  if (principal) objectifs.push(`${principal.libelle || principal.type || 'un projet'} d’ici ${Math.round(principal.n)} an(s) (${cfCHF(principal.cible)})`);
  if (A.annees != null) objectifs.push(`la retraite dans ${A.annees} an(s)${A.lacune > 0 ? `, avec une lacune estimée à ${cfCHF(A.lacune / 12)} par mois` : ', sans lacune apparente'}`);
  if (objectifs.length) phrases.push(`Les objectifs retenus : ${objectifs.join(' et ')}.`);

  const parts = (alloc && alloc.lignes || []).map(l => `${l.label} ${cfCHF(l.montant)}/mois`);
  if (parts.length) phrases.push(`La proposition : profil ${piNomProfil(p)} (${p.actions} % actions, horizon ${p.horizon} ans et plus), avec ${parts.join(', ')}.`);

  const risques = [];
  if (alloc && alloc.manqueReserve > 0) risques.push(`reconstituer la réserve de sécurité (${cfCHF(alloc.manqueReserve)} manquants)`);
  if (alloc && alloc.courtTerme.length) risques.push(`garder sans risque l’argent des projets à moins de ${p.horizon} ans`);
  if (A.lacune > 0) risques.push('combler la lacune de retraite');
  if (risques.length) phrases.push(`Points de vigilance : ${risques.join(', ')}.`);

  return phrases;
}

// Aperçu affiché directement dans la Synthèse : le profil et les solutions ne doivent pas être
// cachés derrière un onglet (remarque de Jonathan, 20.09.2026 : « je ne vois pas le profil
// investisseur ni les solutions proposées »).
function cfApercuPlacements(A) {
  A = A || cfAnalyse();
  const alloc = piAllocation(A);
  const p = alloc.profil;
  const sols = piSolutions(A, alloc);
  const av = piAvertissements(A, alloc).filter(x => x.ton !== 'vert');
  return `<section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete">
      <h2>Profil investisseur & solutions</h2>
      <button type="button" class="dbx-lien" onclick="cfChangerOnglet('placements')">Choisir le profil et détailler →</button></header>
    <div class="pi-apercu">
      <div class="pi-apercu-profil">
        <span class="pi-jauge" aria-hidden="true"><i style="width:${p.actions}%"></i></span>
        <b>${piNomProfil(p)}</b>
        <small>${p.actions} % actions · ${p.rendement.toFixed(1).replace('.', ',')} %/an visés · horizon ${p.horizon} ans et +</small>
        ${alloc.lignes.length ? `<div class="pi-apercu-alloc">${alloc.lignes.map(l => `<span><em>${cfEsc(l.label)}</em>${cfCHF(l.montant)}/mois</span>`).join('')}</div>` : '<div class="dbx-vide-petit">Capacité d’épargne à compléter dans la situation.</div>'}
      </div>
      <div class="pi-apercu-sols">
        ${sols.length ? sols.map(s => `<button type="button" class="pi-apercu-sol" onclick="cfChangerOnglet('placements')">
            <span aria-hidden="true">${s.icone}</span><b>${cfEsc(s.titre)}</b><em>${cfCHF(s.prime)}/mois</em></button>`).join('')
          : '<div class="dbx-vide-petit">Aucune solution à proposer pour l’instant.</div>'}
        ${av.length ? `<div class="pi-apercu-alerte">⚠ ${av[0].texte}</div>` : ''}
      </div>
    </div>
  </section>`;
}

function piOngletPlacements() {
  const A = cfAnalyse();
  const alloc = piAllocation(A);
  const p = alloc.profil;
  const av = piAvertissements(A, alloc);
  const horizon = Math.max(1, A.annees != null && A.annees > 0 ? A.annees : Math.max(5, ...A.projets.map(x => x.n), 5));
  const capitalDepart = cfNum(cfGet(_cf.dossier, 'situation.patrimoine.placements')) + cfNum(cfGet(_cf.dossier, 'situation.patrimoine.pilier3a'));
  const mensuelPlace = alloc.lignes.filter(l => ['3a', 'libre'].includes(l.cle)).reduce((s, l) => s + l.montant, 0);
  const proj = piProjection(capitalDepart, mensuelPlace, horizon, p);
  const maxProj = Math.max(...PROFILS_INVESTISSEUR.map(x => piProjection(capitalDepart, mensuelPlace, horizon, x).central), 1);

  return `
    <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Profil investisseur</h2><span class="dbx-carte-sous">choisis-en un : l’allocation et les projections suivent</span></header>
      <div class="pi-profils">${PROFILS_INVESTISSEUR.map(x => `<button type="button" class="pi-profil ${x.id === p.id ? 'actif' : ''}" onclick="piChoisirProfil('${x.id}')" aria-pressed="${x.id === p.id}">
        <span class="pi-jauge" aria-hidden="true"><i style="width:${x.actions}%"></i></span>
        <b>${x.label} <span class="pi-en">${x.en}</span></b>
        <span class="pi-chiffres">${x.actions} % actions · ${x.rendement.toFixed(1)} %/an visés</span>
        <small>${cfEsc(x.resume)}</small>
        <em>Horizon ${x.horizon} ans et + · mauvaise année ≈ ${x.perte} %</em>
      </button>`).join('')}</div>
      <div class="pi-note">Rendements et fourchettes : hypothèses de travail (moyennes long terme), jamais une garantie. La part d’actions est indicative — le portefeuille réel dépend des fonds retenus.</div>
    </section>

    <div class="dbx-grille dbx-grille-egale" style="margin-top:18px">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Où placer l’épargne</h2><span class="dbx-carte-sous">capacité ${cfCHF(alloc.capacite)}/mois</span></header>
        ${alloc.lignes.length ? `<div class="pi-alloc">${alloc.lignes.map(l => `<div class="pi-ligne ${l.cle}">
          <div class="pi-ligne-tete"><b>${cfEsc(l.label)}</b><span>${cfCHF(l.montant)}/mois</span></div>
          <div class="pi-barre"><span style="width:${alloc.capacite ? Math.min(100, l.montant / alloc.capacite * 100) : 0}%"></span></div>
          <small>${cfEsc(l.support)} — ${cfEsc(l.detail)}</small>
        </div>`).join('')}</div>` : '<div class="dbx-vide-petit">Pas de capacité d’épargne à répartir : compléter le budget dans l’onglet Situation.</div>'}
      </section>

      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Projection à ${horizon} ans</h2><span class="dbx-carte-sous">${cfCHF(mensuelPlace)}/mois placés${capitalDepart ? ` + ${cfCHF(capitalDepart)} déjà investis` : ''}</span></header>
        <div class="pi-proj">
          <div class="pi-proj-central">${cfCHF(proj.central)}<small>capital projeté, profil ${piNomProfil(p)}</small></div>
          <div class="pi-proj-fourchette">Fourchette réaliste : <b>${cfCHF(proj.bas)}</b> à <b>${cfCHF(proj.haut)}</b> · versé ${cfCHF(proj.verse)}</div>
          <div class="pi-comparatif">${PROFILS_INVESTISSEUR.map(x => { const v = piProjection(capitalDepart, mensuelPlace, horizon, x).central; return `<div class="pi-comp ${x.id === p.id ? 'actif' : ''}">
            <span class="pi-comp-nom">${x.label}</span><span class="pi-comp-barre"><i style="width:${Math.max(4, v / maxProj * 100)}%"></i></span><span class="pi-comp-val">${cfCHF(v)}</span></div>`; }).join('')}</div>
        </div>
      </section>
    </div>

    <section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Solutions à proposer</h2><span class="dbx-carte-sous">polices vie et financement long terme déduits du profil</span></header>
      ${piHtmlSolutions(A, alloc)}
    </section>

    <section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Cohérence avec les échéances</h2><span class="dbx-carte-sous">profil vs projets et retraite</span></header>
      <div class="dbx-signaux">${av.map((x, i) => `<div class="dbx-signal ${x.ton === 'rouge' ? 'rouge' : x.ton === 'orange' ? 'orange' : 'bleu'}" style="--i:${i}"><span class="dbx-signal-icone">${x.ton === 'vert' ? '✅' : x.ton === 'rouge' ? '⛔' : '⚠️'}</span><span class="dbx-signal-texte">${x.texte}</span></div>`).join('')}</div>
      <button type="button" class="btn-secondary" style="margin-top:12px" onclick="piAjouterRecommandation()">＋ Ajouter au dossier comme recommandation</button>
    </section>`;
}

// Reprend le profil et l'allocation sous forme de recommandation écrite dans le dossier
function piAjouterRecommandation() {
  const A = cfAnalyse();
  const alloc = piAllocation(A);
  const p = alloc.profil;
  const texte = `Profil investisseur retenu : ${piNomProfil(p)} (${p.actions} % actions, ${p.rendement.toFixed(1)} %/an visés, horizon ${p.horizon} ans et plus). `
    + (alloc.lignes.length ? `Répartition de l’épargne : ${alloc.lignes.map(l => `${l.label} ${cfCHF(l.montant)}/mois`).join(', ')}.` : '')
    + (alloc.courtTerme.length ? ` Attention : ${alloc.courtTerme.map(x => x.libelle || x.type || 'projet').join(', ')} à moins de ${p.horizon} ans — cette part reste sans risque.` : '');
  _cf.dossier.recommandations = _cf.dossier.recommandations || [];
  _cf.dossier.recommandations.push({ id: cfId(), cat: 'Placements', texte, date: new Date().toISOString().slice(0, 10) });
  cfPlanifierSauvegarde();
  showError('✓ Recommandation ajoutée au dossier.');
  cfChangerOnglet('recommandations');
}
