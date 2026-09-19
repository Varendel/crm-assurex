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

const PROFILS_INVESTISSEUR = [
  { id: 'securite',  label: 'Sécurité',   actions: 0,  rendement: 1.0, volatilite: 2,  horizon: 2,  perte: -3,
    resume: 'Capital préservé, rendement proche du compte épargne.', pour: 'argent nécessaire à court terme' },
  { id: 'revenu',    label: 'Revenu',     actions: 25, rendement: 2.2, volatilite: 5,  horizon: 4,  perte: -8,
    resume: 'Majorité d’obligations, une part d’actions pour le rendement.', pour: 'projets à 4–6 ans' },
  { id: 'equilibre', label: 'Équilibré',  actions: 45, rendement: 3.2, volatilite: 8,  horizon: 6,  perte: -15,
    resume: 'Autant de sécurité que de croissance — le choix le plus courant.', pour: 'épargne de moyen terme et 3a' },
  { id: 'croissance',label: 'Croissance', actions: 65, rendement: 4.0, volatilite: 11, horizon: 8,  perte: -25,
    resume: 'Orienté actions, avec des années négatives assumées.', pour: 'retraite à plus de 8 ans' },
  { id: 'actions',   label: 'Actions',    actions: 90, rendement: 5.0, volatilite: 15, horizon: 10, perte: -35,
    resume: 'Quasi tout en actions : rendement visé le plus élevé, secousses comprises.', pour: 'horizon long, tolérance aux baisses' },
];

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
    lignes.push({ cle: '3a', label: '3e pilier A', montant: m, support: `Fonds 3a — profil ${p.label} (${p.actions} % actions)`,
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
  if (reste > 0) lignes.push({ cle: 'libre', label: 'Placement libre', montant: reste, support: `Portefeuille ${p.label} (${p.actions} % actions)`,
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
    av.push({ ton: 'rouge', texte: `<strong>${cfEsc(pr.libelle || pr.type || 'Projet')}</strong> arrive dans ${Math.round(pr.n)} an(s), alors que le profil <strong>${p.label}</strong> demande au moins ${p.horizon} ans. L’argent de ce projet (${cfCHF(pr.mensuel)}/mois) doit rester sans risque — sinon une baisse juste avant l’échéance coûterait jusqu’à ${p.perte} %.` });
  });
  if (A.annees != null && A.annees < p.horizon) av.push({ ton: 'rouge', texte: `La retraite est dans ${A.annees} an(s) et le profil <strong>${p.label}</strong> demande ${p.horizon} ans : choisis un profil plus prudent pour la part qui financera les premières années de retraite.` });
  if (alloc.manqueReserve > 0) av.push({ ton: 'orange', texte: `Réserve de sécurité incomplète : ${cfCHF(alloc.manqueReserve)} manquants pour ${alloc.reserve.mois} mois de dépenses. À constituer avant d’investir.` });
  if (alloc.capacite <= 0) av.push({ ton: 'orange', texte: 'Aucune capacité d’épargne dans le budget saisi : commencer par le budget avant de parler placement.' });
  if (!av.length) av.push({ ton: 'vert', texte: `Profil <strong>${p.label}</strong> cohérent avec les échéances saisies (la plus proche dépasse ${p.horizon} ans).` });
  return av;
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
        <b>${x.label}</b>
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
          <div class="pi-proj-central">${cfCHF(proj.central)}<small>capital projeté, profil ${p.label}</small></div>
          <div class="pi-proj-fourchette">Fourchette réaliste : <b>${cfCHF(proj.bas)}</b> à <b>${cfCHF(proj.haut)}</b> · versé ${cfCHF(proj.verse)}</div>
          <div class="pi-comparatif">${PROFILS_INVESTISSEUR.map(x => { const v = piProjection(capitalDepart, mensuelPlace, horizon, x).central; return `<div class="pi-comp ${x.id === p.id ? 'actif' : ''}">
            <span class="pi-comp-nom">${x.label}</span><span class="pi-comp-barre"><i style="width:${Math.max(4, v / maxProj * 100)}%"></i></span><span class="pi-comp-val">${cfCHF(v)}</span></div>`; }).join('')}</div>
        </div>
      </section>
    </div>

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
  const texte = `Profil investisseur retenu : ${p.label} (${p.actions} % actions, ${p.rendement.toFixed(1)} %/an visés, horizon ${p.horizon} ans et plus). `
    + (alloc.lignes.length ? `Répartition de l’épargne : ${alloc.lignes.map(l => `${l.label} ${cfCHF(l.montant)}/mois`).join(', ')}.` : '')
    + (alloc.courtTerme.length ? ` Attention : ${alloc.courtTerme.map(x => x.libelle || x.type || 'projet').join(', ')} à moins de ${p.horizon} ans — cette part reste sans risque.` : '');
  _cf.dossier.recommandations = _cf.dossier.recommandations || [];
  _cf.dossier.recommandations.push({ id: cfId(), cat: 'Placements', texte, date: new Date().toISOString().slice(0, 10) });
  cfPlanifierSauvegarde();
  showError('✓ Recommandation ajoutée au dossier.');
  cfChangerOnglet('recommandations');
}
