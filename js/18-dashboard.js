// ═══ TABLEAU DE BORD REX (nouvelle version, 19.09.2026) ═══════════════════════════════════════
// Deux onglets :
//   « Aujourd'hui » — pour agir : bandeau d'accueil, 4 indicateurs avec tendance, liste d'actions
//                     triée par urgence (traitables sur place), nouveautés des 7 derniers jours,
//                     agenda Outlook, signaux « à surveiller ».
//   « Pilotage »    — pour piloter : indicateurs de fond, graphiques 12 mois, portefeuille par
//                     compagnie, pipeline par stade, accès aux vues détaillées.
// Mêmes règles de calcul que l'ancien tableau de bord (commissions reçues après le 01.06.2026,
// contrats actifs = hors résiliés/annulés…). L'ancienne vue reste accessible (« Vue classique »).

const DBX_CLE_ONGLET = 'dbx_onglet';
const DBX_CLE_CLASSIQUE = 'dbx_classique';
const DBX_INACTIFS = ['résilié', 'annulé', 'mandat_resilie'];

function dbxLire(cle, defaut) { try { return localStorage.getItem(cle) || defaut; } catch (e) { return defaut; } }
function dbxEcrire(cle, v) { try { localStorage.setItem(cle, v); } catch (e) {} }
function dbxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function dbxClassiqueActive() { return dbxLire(DBX_CLE_CLASSIQUE, '0') === '1'; }
function dbxBasculer(classique) { dbxEcrire(DBX_CLE_CLASSIQUE, classique ? '1' : '0'); navigate('dashboard'); }
function dbxChoisirOnglet(o) { dbxEcrire(DBX_CLE_ONGLET, o); dbxRerendre(false); }
// Réaffiche sans recharger les données (changement d'onglet, tâche cochée) : instantané.
// calme = sans animation d'entrée (après une action, pour ne pas faire « clignoter » la page)
let dbxCalme = false;
function dbxRerendre(calme) {
  const main = document.getElementById('main-content');
  if (!main || currentView !== 'dashboard') return;
  const defilement = document.documentElement.scrollTop;
  dbxCalme = calme !== false;
  main.innerHTML = viewDashboardV2();
  mountCalendarWidget();
  if (dbxCalme) document.documentElement.scrollTop = defilement;
}

function dbxAujIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dbxDecalerIso(jours) { const d = new Date(); d.setDate(d.getDate() + jours); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dbxNomClient(id) { const c = allClients.find(x => x.id === id); return c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : ''; }
function dbxJour(iso) { const d = (iso || '').slice(0, 10); return d === dbxAujIso() ? 'aujourd’hui' : d === dbxDecalerIso(-1) ? 'hier' : fmtDate(d); }
function dbxMontant(ca) { return Number(ca.montant_final != null ? ca.montant_final : (ca.montant_estime || 0)); }
function dbxCHF(n) { return 'CHF ' + fmtCHF(Math.round(n || 0)); }
function dbxCompact(n) { const v = Math.round(n || 0); if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + ' M'; if (Math.abs(v) >= 1e4) return Math.round(v / 1000) + ' k'; return fmtCHF(v); }

// 12 derniers mois (clé AAAA-MM), du plus ancien au plus récent
function dbxMois12() {
  const res = []; const d = new Date(); d.setDate(1);
  for (let i = 11; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); res.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
  return res;
}
const DBX_MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function dbxLibelleMois(cle) { const [y, m] = cle.split('-').map(Number); return DBX_MOIS_COURTS[m - 1]; }

// ── Calculs ─────────────────────────────────────────────────────────────────────────────────
function dbxDonnees() {
  const auj = dbxAujIso();
  const mois = dbxMois12();
  const moisCourant = mois[11], moisPrec = mois[10];

  // Commissions reçues (post-fusion) et extournes, par mois de réception
  const recues = allCommissionsAttente.filter(ca => ca.statut === 'reçue' || ca.statut === 'extourné').map(ca => {
    const d = commissionDateReception(ca);
    return { ca, d, signe: ca.statut === 'extourné' ? -1 : 1 };
  }).filter(x => !x.d || x.d >= DATE_BASCULE_ASSUREX);
  const commMois = Object.fromEntries(mois.map(m => [m, 0]));
  recues.forEach(x => { if (x.d && commMois[x.d.slice(0, 7)] != null) commMois[x.d.slice(0, 7)] += x.signe * dbxMontant(x.ca); });
  let totalRecu = recues.reduce((s, x) => s + x.signe * dbxMontant(x.ca), 0);
  // Versements partiels déjà encaissés sur des commissions encore en attente (paiement échelonné)
  (typeof allCommissionTranches !== 'undefined' ? allCommissionTranches : []).forEach(t => {
    const ca = allCommissionsAttente.find(c => c.id === t.commission_id);
    if (!ca || ca.statut !== 'en_attente' || t.encaisse_par === 'oz' || !t.date_reception || t.date_reception < DATE_BASCULE_ASSUREX) return; // encaissé par OZ : hors chiffres Assurex
    const m = Number(t.montant || 0);
    totalRecu += m;
    if (commMois[t.date_reception.slice(0, 7)] != null) commMois[t.date_reception.slice(0, 7)] += m;
  });

  const commAttente = allCommissionsAttente.filter(ca => {
    if (ca.statut !== 'en_attente') return false;
    const ct = allContrats.find(c => c.id === ca.contrat_id);
    return ct && ct.statut !== 'annulé' && ct.date_debut && ct.date_debut >= DATE_BASCULE_ASSUREX;
  });
  const totalAttente = commAttente.reduce((s, ca) => s + (typeof commissionResteAttendu === 'function' ? commissionResteAttendu(ca) : Number(ca.montant_estime || 0)), 0);

  // Hors polices externes (« assuré ailleurs », saisies depuis Équipement) : pas notre portefeuille
  const actifs = allContrats.filter(ct => !DBX_INACTIFS.includes(ct.statut) && !/^Police externe/.test(ct.modules || ''));
  const portefeuille = actifs.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
  const primesMois = Object.fromEntries(mois.map(m => [m, 0]));
  allContrats.filter(ct => ct.statut !== 'annulé').forEach(ct => {
    const d = (ct.date_signature || ct.date_debut || ct.created_at || '').slice(0, 7);
    if (primesMois[d] != null) primesMois[d] += Number(ct.prime_annuelle || 0);
  });

  const oppsOuvertes = allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu');
  const pondere = oppsOuvertes.reduce((s, o) => s + Number(o.montant_potentiel || 0) * Number(o.probabilite || 0) / 100, 0);
  const il7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const nouvellesOpps = oppsOuvertes.filter(o => o.created_at && o.created_at >= il7).length;
  const anneeCourante = String(new Date().getFullYear());
  const gagneesAn = allOpportunites.filter(o => o.stade === 'Gagné' && (o.created_at || '').startsWith(anneeCourante)).length;
  const perduesAn = allOpportunites.filter(o => o.stade === 'Perdu' && (o.created_at || '').startsWith(anneeCourante)).length;

  return {
    auj, mois, moisCourant, moisPrec, commMois, totalRecu, commAttente, totalAttente, actifs, portefeuille, primesMois,
    oppsOuvertes, pondere, nouvellesOpps,
    tauxGain: gagneesAn + perduesAn ? Math.round(gagneesAn / (gagneesAn + perduesAn) * 100) : null, gagneesAn, perduesAn,
  };
}

// ── Petits composants visuels ─────────────────────────────────────────────────────────────────
function dbxSparkline(valeurs, couleur) {
  const w = 120, h = 36, max = Math.max(...valeurs, 1), min = Math.min(...valeurs, 0);
  const pts = valeurs.map((v, i) => [i * (w / (valeurs.length - 1)), h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
  const ligne = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const id = 'sg' + Math.random().toString(36).slice(2, 8);
  return `<svg class="dbx-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${couleur}" stop-opacity="0.35"/><stop offset="1" stop-color="${couleur}" stop-opacity="0"/></linearGradient></defs>
    <path d="${ligne} L${w},${h} L0,${h} Z" fill="url(#${id})"/><path d="${ligne}" fill="none" stroke="${couleur}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function dbxTendance(actuel, precedent, suffixe) {
  if (!precedent && !actuel) return '';
  if (!precedent) return `<span class="dbx-tendance hausse">nouveau ${suffixe || ''}</span>`;
  const pct = Math.round((actuel - precedent) / Math.abs(precedent) * 100);
  const cls = pct > 0 ? 'hausse' : pct < 0 ? 'baisse' : '';
  return `<span class="dbx-tendance ${cls}">${pct > 0 ? '▲' : pct < 0 ? '▼' : '='} ${Math.abs(pct)} % ${suffixe || ''}</span>`;
}

function dbxKpi({ label, valeur, prefixe = '', suffixe = '', sous = '', tendance = '', spark = '', onclick = '', i = 0 }) {
  return `<button type="button" class="dbx-kpi dbx-anim" style="--i:${i}" ${onclick ? `onclick="${onclick}"` : 'tabindex="-1"'}>
    <span class="dbx-kpi-label">${label}</span>
    <span class="dbx-kpi-valeur"><span data-dbx-compteur="${Math.round(valeur)}" data-prefixe="${prefixe}" data-suffixe="${suffixe}">${prefixe}${fmtCHF(Math.round(valeur))}${suffixe}</span></span>
    <span class="dbx-kpi-bas">${tendance}<span class="dbx-kpi-sous">${sous}</span></span>
    ${spark}
  </button>`;
}

function dbxBarres(mois, valeurs, couleur, format) {
  const max = Math.max(...valeurs, 1);
  return `<div class="dbx-barres">${mois.map((m, i) => {
    const v = valeurs[i]; const h = Math.max(2, Math.round((Math.max(v, 0) / max) * 100));
    return `<div class="dbx-barre-col" title="${dbxLibelleMois(m)} ${m.slice(0, 4)} : ${format(v)}">
      <span class="dbx-barre-val">${v ? dbxCompact(v) : ''}</span>
      <span class="dbx-barre" style="--h:${h}%;--c:${couleur};--i:${i}"></span>
      <span class="dbx-barre-mois">${dbxLibelleMois(m)}</span>
    </div>`;
  }).join('')}</div>`;
}

// ── Vue ─────────────────────────────────────────────────────────────────────────────────────
function viewDashboardV2() {
  const onglet = dbxLire(DBX_CLE_ONGLET, 'aujourdhui');
  const D = dbxDonnees();
  const actions = dbxActions(D);
  const nbRetard = actions.filter(a => a.groupe === 'retard').length;
  const rdvAuj = allRendezVous.filter(r => r.statut !== 'annule' && (r.date_heure || '').slice(0, 10) === D.auj).length;
  const dateLongue = new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const heure = new Date().getHours();
  const salut = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir';
  const resume = [
    nbRetard ? `<strong>${nbRetard}</strong> action${nbRetard > 1 ? 's' : ''} en retard` : 'aucune action en retard',
    `<strong>${rdvAuj}</strong> rendez-vous aujourd’hui`,
    `<strong>${D.oppsOuvertes.length}</strong> affaire${D.oppsOuvertes.length > 1 ? 's' : ''} en cours`,
  ];

  setTimeout(dbxApresRendu, 0);
  return `
  <div class="dbx ${dbxCalme ? 'dbx-calme' : ''}">
    <section class="dbx-hero dbx-anim" style="--i:0">
      <div class="dbx-hero-deco" aria-hidden="true"></div>
      <div class="dbx-hero-gauche">
        <span class="dbx-hero-date">${dbxEsc(dateLongue)}</span>
        <div class="dbx-hero-ligne">
          <h1 class="dbx-hero-titre">${salut}, ${dbxEsc(currentUser.prenom || '')}</h1>
          ${typeof LOGO_EXGROUPE_SVG !== 'undefined' ? `<span class="dbx-hero-exgroup">${LOGO_EXGROUPE_SVG}</span>` : ''}
        </div>
        <p class="dbx-hero-resume">${resume.join(' · ')}.</p>
        <div class="dbx-recherche">
          <span aria-hidden="true">⌕</span>
          <input id="recherche-globale-input" type="text" placeholder="Rechercher un client, un contrat, une opportunité…" autocomplete="off" aria-label="Recherche globale"
            oninput="renderResultatsRechercheGlobale()" onkeydown="onKeydownRechercheGlobale(event)" onblur="setTimeout(fermerRechercheGlobale, 150)"/>
          <kbd>${(navigator.platform || '').toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K'}</kbd>
          <div id="recherche-globale-resultats" class="dbx-recherche-resultats" style="display:none"></div>
        </div>
      </div>
      <div class="dbx-hero-droite">
        <div class="dbx-hero-boutons">
          <button type="button" id="btn-sync-outlook" class="dbx-btn-verre" onclick="synchroniserOutlook()" title="Vérifie dans Outlook si des compagnies ont répondu aux demandes d'offre">↻ Synchroniser Outlook</button>
          <button type="button" class="dbx-btn-blanc" onclick="navigate('nouveau-client')">+ Client</button>
          <button type="button" class="dbx-btn-blanc" onclick="opportuniteEnEditionId=null;navigate('nouvelle-opportunite')">+ Opportunité</button>
        </div>
        <img src="assets/logos/rex-mascotte-hd.png" alt="" class="dbx-hero-mascotte"/>
      </div>
    </section>

    ${typeof bmqBandeauHtml === 'function' ? bmqBandeauHtml() : ''}

    <div class="dbx-onglets" role="tablist" aria-label="Vue du tableau de bord">
      <button type="button" role="tab" aria-selected="${onglet === 'aujourdhui'}" class="${onglet === 'aujourdhui' ? 'actif' : ''}" onclick="dbxChoisirOnglet('aujourdhui')">Aujourd’hui${nbRetard ? `<span class="dbx-pastille">${nbRetard}</span>` : ''}</button>
      <button type="button" role="tab" aria-selected="${onglet === 'pilotage'}" class="${onglet === 'pilotage' ? 'actif' : ''}" onclick="dbxChoisirOnglet('pilotage')">Pilotage</button>
      <button type="button" role="tab" aria-selected="${onglet === 'essentiel'}" class="${onglet === 'essentiel' ? 'actif' : ''}" onclick="dbxChoisirOnglet('essentiel')" title="Vue simplifiée : l’essentiel de la journée, sans le reste">Essentiel</button>
      <button type="button" class="dbx-classique" onclick="dbxBasculer(true)" title="Revenir à l'ancien tableau de bord">Vue classique</button>
    </div>

    ${onglet === 'pilotage' ? dbxVuePilotage(D) : onglet === 'essentiel' ? dbxVueEssentiel(D, actions) : dbxVueAujourdhui(D, actions)}
  </div>`;
}

// ── Vue « Essentiel » (20.09.2026, demande de Jonathan) : une seconde lecture du tableau de bord,
// simplifiée et aérée. Trois chiffres, les priorités du jour, les rendez-vous — et rien d'autre.
// Tout le reste (sparklines, signaux, graphiques) reste dans « Aujourd'hui » et « Pilotage ».
function dbxVueEssentiel(D, actions) {
  const auj = D.auj;
  const priorites = actions.filter(a => ['retard', 'aujourdhui', 'equipe'].includes(a.groupe)).slice(0, 6);
  const rdv = allRendezVous
    .filter(r => r.statut !== 'annule' && (r.date_heure || '').slice(0, 10) === auj)
    .sort((a, b) => (a.date_heure || '').localeCompare(b.date_heure || ''));
  const nbRetard = actions.filter(a => a.groupe === 'retard').length;
  const carte = (label, valeur, sous, onclick) => `<button type="button" class="dbx-zen-carte" onclick="${onclick}">
    <span class="dbx-zen-valeur">${dbxEsc(valeur)}</span>
    <span class="dbx-zen-label">${dbxEsc(label)}</span>
    <span class="dbx-zen-sous">${dbxEsc(sous)}</span></button>`;

  return `<div class="dbx-zen dbx-anim" style="--i:1">
    <div class="dbx-zen-cartes">
      ${carte('À encaisser', dbxCHF(D.totalAttente), `${D.commAttente.length} commission${D.commAttente.length > 1 ? 's' : ''} en attente`, "navigate('commissions-attente')")}
      ${carte('Affaires en cours', String(D.oppsOuvertes.length), `${dbxCHF(D.pondere)} de pipeline pondéré`, "navigate('opportunites')")}
      ${carte('Portefeuille annuel', dbxCHF(D.portefeuille), `${D.actifs.length} contrats actifs`, "navigate('tous-contrats')")}
    </div>

    <section class="dbx-zen-bloc">
      <h2>Mes priorités${nbRetard ? ` <em>${nbRetard} en retard</em>` : ''}</h2>
      ${priorites.length ? `<div class="dbx-zen-liste">${priorites.map(dbxLigneAction).join('')}</div>
        ${actions.length > priorites.length ? `<button type="button" class="dbx-zen-lien" onclick="dbxChoisirOnglet('aujourdhui')">Voir les ${actions.length} actions →</button>` : ''}`
        : '<p class="dbx-zen-vide">Rien d’urgent. Belle journée pour appeler un client ou préparer un renouvellement.</p>'}
    </section>

    <section class="dbx-zen-bloc">
      <h2>Aujourd’hui</h2>
      ${rdv.length ? `<div class="dbx-zen-rdv">${rdv.map(r => `<div class="dbx-zen-ligne">
          <span class="dbx-zen-heure">${dbxEsc((r.date_heure || '').slice(11, 16) || '—')}</span>
          <span class="dbx-zen-corps"><b>${dbxEsc(r.type || 'Rendez-vous')}</b><small>${dbxEsc(dbxNomClient(r.client_id) || r.lieu || r.mode || '')}</small></span>
          ${r.client_id ? `<button type="button" class="dbx-zen-fleche" onclick="showClient('${r.client_id}')" aria-label="Ouvrir la fiche">→</button>` : ''}
        </div>`).join('')}</div>`
        : '<p class="dbx-zen-vide">Aucun rendez-vous aujourd’hui.</p>'}
    </section>

    <div class="dbx-zen-actions">
      <button type="button" class="btn-save" onclick="navigate('nouveau-client')">+ Nouveau client</button>
      <button type="button" class="btn-secondary" onclick="opportuniteEnEditionId=null;navigate('nouvelle-opportunite')">+ Nouvelle opportunité</button>
      <button type="button" class="btn-secondary" onclick="navigate('renouvellements')">🔁 Renouvellements</button>
      ${typeof viewMessagesClients === 'function' ? `<button type="button" class="btn-secondary" onclick="navigate('messages-clients')">💬 Messages clients</button>` : ''}
    </div>
  </div>`;
}

function dbxVueAujourdhui(D, actions) {
  const recuMois = D.commMois[D.moisCourant], recuPrec = D.commMois[D.moisPrec];
  const kpis = [
    dbxKpi({ i: 1, label: 'Commissions encaissées', valeur: D.totalRecu, prefixe: 'CHF ', sous: `dont ${dbxCHF(recuMois)} ce mois`, tendance: dbxTendance(recuMois, recuPrec, 'vs mois passé'),
      spark: dbxSparkline(D.mois.map(m => D.commMois[m]), '#00CFFF'), onclick: "navigate('commissions-attente')" }),
    dbxKpi({ i: 2, label: 'À encaisser', valeur: D.totalAttente, prefixe: 'CHF ', sous: `${D.commAttente.length} commission${D.commAttente.length > 1 ? 's' : ''} en attente`, onclick: "navigate('commissions-attente')" }),
    dbxKpi({ i: 3, label: 'Pipeline pondéré', valeur: D.pondere, prefixe: 'CHF ', sous: `${D.oppsOuvertes.length} affaires ouvertes`, tendance: D.nouvellesOpps ? `<span class="dbx-tendance hausse">+${D.nouvellesOpps} cette semaine</span>` : '', onclick: "navigate('opportunites')" }),
    dbxKpi({ i: 4, label: 'Portefeuille annuel', valeur: D.portefeuille, prefixe: 'CHF ', sous: `${D.actifs.length} contrats actifs`, tendance: D.primesMois[D.moisCourant] ? `<span class="dbx-tendance hausse">+${dbxCHF(D.primesMois[D.moisCourant])} ce mois</span>` : '',
      spark: dbxSparkline(D.mois.map(m => D.primesMois[m]), '#8FB4FF'), onclick: "navigate('tous-contrats')" }),
  ].join('');

  const groupes = [['equipe', '👥 Créé par l’équipe'], ['retard', 'En retard'], ['aujourdhui', 'Aujourd’hui'], ['semaine', 'Cette semaine']];
  const liste = actions.length ? groupes.map(([g, titre]) => {
    const items = actions.filter(a => a.groupe === g);
    if (!items.length) return '';
    return `<div class="dbx-groupe dbx-groupe-${g}"><div class="dbx-groupe-titre">${titre}<span>${items.length}</span></div>
      ${items.slice(0, 8).map(dbxLigneAction).join('')}
      ${items.length > 8 ? `<button type="button" class="dbx-lien" onclick="navigate('rappels')">+ ${items.length - 8} autres…</button>` : ''}
    </div>`;
  }).join('') : `<div class="dbx-vide"><img src="assets/logos/rex-mascotte-hd.png" alt=""/><strong>Rien d’urgent.</strong><span>Belle journée — c’est le moment de relancer un client ou de préparer les renouvellements.</span></div>`;

  return `
    <div class="dbx-kpis">${kpis}</div>
    <!-- Bandeau « Récurrence sourcée OZ » retiré du tableau de bord le 20.09.2026 (demande de
         Jonathan) : il reste dans le cockpit (js/34) et dans les objectifs (js/42). -->


    <div class="dbx-grille">
      <div class="dbx-col">
        <section class="dbx-carte dbx-anim" style="--i:5" aria-labelledby="dbx-titre-actions">
          <header class="dbx-carte-tete"><h2 id="dbx-titre-actions">À faire</h2><button type="button" class="dbx-lien" onclick="navigate('rappels')">Toutes les tâches →</button></header>
          <div id="dbx-actions">${liste}</div>
        </section>
        <section class="dbx-carte dbx-anim" style="--i:6" aria-labelledby="dbx-titre-nouveautes">
          <header class="dbx-carte-tete"><h2 id="dbx-titre-nouveautes">Nouveautés</h2><span class="dbx-carte-sous">7 derniers jours</span></header>
          <div id="dbx-nouveautes"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
        </section>
      </div>
      <div class="dbx-col">
        ${typeof htmlHorlogeLuxe === 'function' ? `<section class="dbx-carte dbx-anim hl-carte" style="--i:4" aria-label="Horloge et agenda">
          <div class="hl-haut">${htmlHorlogeLuxe()}</div>
          ${htmlAgenda2Jours()}
        </section>` : ''}
        <section class="dbx-carte dbx-anim" style="--i:5" aria-labelledby="dbx-titre-signaux">
          <header class="dbx-carte-tete"><h2 id="dbx-titre-signaux">À surveiller</h2></header>
          <div class="dbx-signaux">${dbxSignaux(D)}</div>
        </section>
        <section class="dbx-carte dbx-carte-agenda dbx-anim" style="--i:6" aria-label="Agenda">
          <div id="calendar-widget-container"></div>
        </section>
      </div>
    </div>`;
}

// ── Actions à faire ──────────────────────────────────────────────────────────────────────────
function dbxActions(D) {
  const auj = D.auj, fin = dbxDecalerIso(7);
  const res = [];
  const moi = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
  const rh = typeof estRoleRH === 'function' && estRoleRH();

  // Créés par l'équipe, pas encore vus
  if (!rh) {
    allOpportunites.filter(o => o.cree_par && !o.notif_vue && o.stade !== 'Gagné' && o.stade !== 'Perdu').forEach(o => res.push({ groupe: 'equipe', type: 'opp', id: o.id,
      icone: '🎯', titre: o.titre, sous: `Opportunité · créée par ${o.cree_par}`, ouvrir: `editerOpportunite('${o.id}')` }));
  }
  // Tâches et rappels ouverts datés jusqu'à J+7
  allRappels.filter(r => r.statut === 'ouvert' && r.date_echeance && r.date_echeance.slice(0, 10) <= fin).forEach(r => {
    const d = r.date_echeance.slice(0, 10);
    const client = r.client_id ? dbxNomClient(r.client_id) : '';
    res.push({ groupe: r.cree_par && !r.notif_vue && !rh ? 'equipe' : d < auj ? 'retard' : d === auj ? 'aujourdhui' : 'semaine', type: 'rappel', id: r.id, date: d,
      icone: r.nature === 'tache' ? '☑️' : '🔔', titre: r.titre || 'Tâche', urgence: r.urgence,
      sous: [client, d < auj ? `en retard depuis le ${fmtDate(d)}` : d === auj ? 'aujourd’hui' : fmtDate(d)].filter(Boolean).join(' · '),
      ouvrir: `showRappel('${r.id}')`, fait: true });
  });
  // Opportunités échues
  D.oppsOuvertes.filter(o => o.date_echeance && o.date_echeance.slice(0, 10) < auj).forEach(o => res.push({ groupe: 'retard', type: 'opp', id: o.id, date: o.date_echeance.slice(0, 10),
    icone: '🎯', titre: o.titre, sous: `${dbxNomClient(o.client_id) || o.prospect_nom || ''} · opportunité échue le ${fmtDate(o.date_echeance)}`, ouvrir: `editerOpportunite('${o.id}')` }));
  // Délais de résiliation qui tombent dans les 14 jours
  if (typeof rnContratsEcheancier === 'function') {
    const proches = rnContratsEcheancier().filter(x => x.horizon === 'j30' && !(RN_STATUTS.find(s => s.v === x.revue) || {}).traite && x.limite && rnJoursJusqua(x.limite) <= 14);
    if (proches.length) {
      const j = Math.min(...proches.map(x => rnJoursJusqua(x.limite)));
      res.push({ groupe: j <= 0 ? 'aujourdhui' : 'semaine', type: 'renouv', icone: '🔁', titre: `${proches.length} délai${proches.length > 1 ? 's' : ''} de résiliation ${j <= 0 ? 'aujourd’hui' : `dans ${j} jour${j > 1 ? 's' : ''}`}`,
        sous: `${dbxCHF(proches.reduce((s, x) => s + Number(x.ct.prime_annuelle || 0), 0))} de primes à revoir`, ouvrir: "rnFiltres.horizon='j30';navigate('renouvellements')" });
    }
  }
  const ordre = { haute: 0, moyenne: 1, basse: 2 };
  return res.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (ordre[a.urgence] ?? 3) - (ordre[b.urgence] ?? 3));
}

function dbxLigneAction(a) {
  return `<div class="dbx-action ${a.urgence === 'haute' ? 'urgente' : ''}" id="dbx-action-${a.type}-${a.id || ''}">
    <span class="dbx-action-icone" aria-hidden="true">${a.icone}</span>
    <button type="button" class="dbx-action-corps" onclick="${a.ouvrir}">
      <span class="dbx-action-titre">${dbxEsc(a.titre)}</span>
      <span class="dbx-action-sous">${dbxEsc(a.sous || '')}</span>
    </button>
    ${a.fait ? `<span class="dbx-action-boutons">
      <button type="button" title="Reporter au prochain jour ouvré" aria-label="Reporter" onclick="dbxReporter('${a.id}')">⏭</button>
      <button type="button" class="ok" title="Marquer comme fait" aria-label="Fait" onclick="dbxFait('${a.id}')">✓</button>
    </span>` : `<span class="dbx-action-boutons"><button type="button" title="Ouvrir" aria-label="Ouvrir" onclick="${a.ouvrir}">→</button></span>`}
  </div>`;
}

async function dbxFait(id) {
  const el = document.getElementById(`dbx-action-rappel-${id}`);
  if (el) el.classList.add('dbx-fait');
  const tache = allRappels.find(r => r.id === id);
  const r = await dbPatch('rappels', id, { statut: 'traité' });
  if (r && r.error) { if (el) el.classList.remove('dbx-fait'); showError('Non enregistré : ' + errMsg(r)); return; }
  if (tache) tache.statut = 'traité';
  setTimeout(() => {
    dbxRerendre();
    if (tache && tache.opportunite_id && typeof verifierProchaineAction === 'function') verifierProchaineAction(tache.opportunite_id);
  }, 380);
}

async function dbxReporter(id) {
  const tache = allRappels.find(r => r.id === id);
  if (!tache) return;
  const nouvelle = typeof paJoursOuvresPlus === 'function' ? paJoursOuvresPlus(1) : dbxDecalerIso(1);
  const r = await dbPatch('rappels', id, { date_echeance: nouvelle });
  if (r && r.error) { showError('Non reporté : ' + errMsg(r)); return; }
  tache.date_echeance = nouvelle;
  showError(`✓ Reporté au ${fmtDate(nouvelle)}.`);
  dbxRerendre();
}

// ── Signaux « à surveiller » ─────────────────────────────────────────────────────────────────
function dbxSignaux(D) {
  const s = [];
  const il60 = dbxDecalerIso(-60);
  // En retard : gestion → date prévue dépassée (js/19) ; acquisition → en attente depuis plus de 60 jours
  const vieilles = D.commAttente.filter(ca => {
    if (typeof commissionDatePrevue === 'function' && commissionDatePrevue(ca)) return commissionJoursRetard(ca) > 0;
    const d = (ca.date_creation || ca.created_at || '').slice(0, 10);
    return d && d < il60;
  });
  if (vieilles.length) {
    const parCie = {}; vieilles.forEach(ca => { const k = normaliserCompagnie(ca.compagnie || '') || '—'; parCie[k] = (parCie[k] || 0) + 1; });
    const top = Object.entries(parCie).sort((a, b) => b[1] - a[1])[0][0];
    s.push({ ton: 'rouge', icone: '⏳', texte: `<strong>${vieilles.length} commission${vieilles.length > 1 ? 's' : ''}</strong> en retard sur l’encaissement prévu (${dbxCHF(vieilles.reduce((t, ca) => t + Number(ca.montant_estime || 0), 0))}), surtout ${dbxEsc(top)}.`, action: "navigate('commissions-attente').then(() => { const t = document.getElementById('tc-tri'); if (t) { t.value = 'prevue'; renderToutesCommissions(); } })", bouton: 'Relancer' });
  }
  if (typeof rnContratsEcheancier === 'function') {
    const j30 = rnContratsEcheancier().filter(x => x.horizon === 'j30' && !(RN_STATUTS.find(t => t.v === x.revue) || {}).traite);
    if (j30.length) s.push({ ton: 'orange', icone: '🔁', texte: `<strong>${j30.length} contrat${j30.length > 1 ? 's' : ''}</strong> arrivent à leur date limite de résiliation dans moins de 30 jours.`, action: "rnFiltres.horizon='j30';navigate('renouvellements')", bouton: 'Échéancier' });
  }
  if (typeof nbOppsSansProchaineAction === 'function') {
    const n = nbOppsSansProchaineAction();
    if (n) s.push({ ton: 'orange', icone: '➜', texte: `<strong>${n} opportunité${n > 1 ? 's' : ''}</strong> sans prochaine action : elles risquent de s’endormir.`, action: "navigate('opportunites')", bouton: 'Planifier' });
  }
  if (typeof opEstDormante === 'function') {
    const n = allOpportunites.filter(opEstDormante).length;
    if (n) s.push({ ton: 'orange', icone: '💤', texte: `<strong>${n} affaire${n > 1 ? 's' : ''}</strong> sans aucune activité depuis plus de ${OP_DELAI_DORMANTE_JOURS} jours.`, action: "navigate('suivi')", bouton: 'Relancer' });
  }
  if (typeof rlClientsLamal === 'function') {
    const n = rlClientsLamal().filter(x => x.statut === 'a_contacter').length;
    if (n) s.push({ ton: 'bleu', icone: '🩺', texte: `<strong>${n} client${n > 1 ? 's' : ''} LAMal</strong> à relancer avant le 30.11 — une occasion de rendez-vous.`, action: "navigate('relances-lamal')", bouton: 'Relancer' });
  }
  if (typeof eqAnalyse === 'function') {
    const sansCompl = allClients.filter(c => !estEntreprise(c) && (c.statut || 'actif') !== 'inactif').map(eqAnalyse)
      .filter(a => a.besoins.find(b => b.id === 'lamal' && b.couvert) && a.besoins.find(b => b.id === 'complementaire' && !b.couvert)).length;
    if (sansCompl) s.push({ ton: 'vert', icone: '🧩', texte: `<strong>${sansCompl} client${sansCompl > 1 ? 's' : ''}</strong> ont leur LAMal chez nous mais pas de complémentaire santé.`, action: "eqFiltres={segment:'prive',manque:'complementaire',vue:'croisees',recherche:''};navigate('equipement')", bouton: 'Proposer' });
  }
  const idsComm = new Set(allCommissionsAttente.map(ca => ca.contrat_id).filter(Boolean));
  const orphelins = allContrats.filter(ct => ct.commissionne !== false && !DBX_INACTIFS.includes(ct.statut) && Number(ct.prime_annuelle || 0) > 0 && !idsComm.has(ct.id)).length;
  if (orphelins) s.push({ ton: 'rouge', icone: '⚠️', texte: `<strong>${orphelins} contrat${orphelins > 1 ? 's' : ''}</strong> commissionnable${orphelins > 1 ? 's' : ''} sans aucune commission enregistrée.`, action: "navigate('contrats-orphelins-commission')", bouton: 'Corriger' });

  if (!s.length) return `<div class="dbx-signal vert"><span class="dbx-signal-icone">✓</span><span class="dbx-signal-texte">Tout est sous contrôle. Aucun signal à surveiller.</span></div>`;
  return s.slice(0, 5).map((x, i) => `<div class="dbx-signal ${x.ton}" style="--i:${i}">
    <span class="dbx-signal-icone" aria-hidden="true">${x.icone}</span>
    <span class="dbx-signal-texte">${x.texte}</span>
    <button type="button" onclick="${x.action}">${x.bouton}</button>
  </div>`).join('');
}

// ── Nouveautés (chargées après l'affichage) ──────────────────────────────────────────────────
async function dbxChargerNouveautes() {
  const zone = document.getElementById('dbx-nouveautes');
  if (!zone) return;
  const depuis = new Date(Date.now() - 7 * 86400000).toISOString();
  const [mandats, demandes] = await Promise.all([
    dbGet('mandats_signes', `created_at=gte.${depuis}&signe=eq.true&archive=is.false&select=client_id,created_at&order=created_at.desc&limit=20`),
    dbGet('demandes_offre', 'select=id,client_id,opportunite_id,compagnies_envoi&limit=200'),
  ]);
  const items = [];
  (mandats || []).forEach(m => items.push({ date: m.created_at, icone: '✍️', ton: 'vert', texte: `Document signé par <strong>${dbxEsc(dbxNomClient(m.client_id))}</strong>`, action: `showClient('${m.client_id}')` }));
  allRendezVous.filter(r => r.cree_par === 'client' && r.created_at && r.created_at >= depuis).forEach(r => items.push({ date: r.created_at, icone: '📅', ton: 'bleu',
    texte: `RDV réservé en ligne par <strong>${dbxEsc(dbxNomClient(r.client_id) || r.prospect_nom || 'un prospect')}</strong> — ${fmtDate(r.date_heure)}`, action: r.client_id ? `showClient('${r.client_id}')` : "navigate('rendez-vous')" }));
  (demandes || []).forEach(d => (Array.isArray(d.compagnies_envoi) ? d.compagnies_envoi : []).forEach(e => {
    if (e && e.recu_le && e.recu_le >= depuis) items.push({ date: e.recu_le, icone: '📨', ton: 'violet',
      texte: `Offre reçue de <strong>${dbxEsc(normaliserCompagnie(e.compagnie || ''))}</strong>${d.client_id ? ' pour ' + dbxEsc(dbxNomClient(d.client_id)) : ''}`, action: d.opportunite_id ? `editerOpportunite('${d.opportunite_id}')` : "navigate('suivi')" });
  }));
  // Commissions reçues : une ligne par jour de réception, toutes compagnies confondues
  const parJour = {};
  allCommissionsAttente.filter(ca => ca.statut === 'reçue').forEach(ca => {
    const d = (commissionDateReception(ca) || '').slice(0, 10);
    if (!d || d < depuis.slice(0, 10)) return;
    parJour[d] = parJour[d] || { total: 0, cies: new Set() };
    parJour[d].total += dbxMontant(ca); parJour[d].cies.add(normaliserCompagnie(ca.compagnie || '') || '—');
  });
  Object.entries(parJour).forEach(([d, x]) => {
    const cies = [...x.cies];
    items.push({ date: d, icone: '💰', ton: 'vert', action: "navigate('commissions-attente')",
      texte: `<strong>${dbxCHF(x.total)}</strong> de commissions reçues · ${dbxEsc(cies.slice(0, 2).join(', '))}${cies.length > 2 ? ` +${cies.length - 2}` : ''}` });
  });
  allClients.filter(c => c.created_at && c.created_at >= depuis).forEach(c => items.push({ date: c.created_at, icone: '👤', ton: 'bleu', texte: `Nouveau client : <strong>${dbxEsc(dbxNomClient(c.id))}</strong>`, action: `showClient('${c.id}')` }));

  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  zone.innerHTML = items.length ? `<div class="dbx-fil">${items.slice(0, 10).map((x, i) => `<button type="button" class="dbx-nouveaute ${x.ton}" style="--i:${i}" onclick="${x.action}">
      <span class="dbx-nouveaute-icone" aria-hidden="true">${x.icone}</span>
      <span class="dbx-nouveaute-texte">${x.texte}</span>
      <span class="dbx-nouveaute-date">${(x.date || '').length > 10 && typeof jaQuand === 'function' ? jaQuand(x.date) : dbxJour(x.date)}</span>
    </button>`).join('')}</div>` : '<div class="dbx-vide-petit">Rien de neuf ces 7 derniers jours.</div>';
}

// ── Pilotage ─────────────────────────────────────────────────────────────────────────────────
function dbxVuePilotage(D) {
  const clientsActifs = allClients.filter(c => c.statut === 'actif').length;
  const nouveauxMois = allClients.filter(c => (c.created_at || '').slice(0, 7) === D.moisCourant).length;
  const gestion = allCommissionsAttente.filter(ca => ca.statut === 'reçue' && ca.nature === 'gestion').reduce((s, ca) => s + dbxMontant(ca), 0);
  let tauxEq = null;
  if (typeof eqAnalyse === 'function') {
    const eq = allClients.filter(c => (c.statut || 'actif') !== 'inactif').map(eqAnalyse).filter(a => a.contrats.length);
    tauxEq = eq.length ? Math.round(eq.reduce((s, a) => s + a.taux, 0) / eq.length * 100) : null;
  }
  const kpis = [
    dbxKpi({ i: 1, label: 'Clients actifs', valeur: clientsActifs, sous: `${allClients.length} fiches au total`, tendance: nouveauxMois ? `<span class="dbx-tendance hausse">+${nouveauxMois} ce mois</span>` : '', onclick: "navigate('portefeuille')" }),
    dbxKpi({ i: 2, label: 'Taux de transformation', valeur: D.tauxGain ?? 0, suffixe: ' %', sous: `${D.gagneesAn} gagnées · ${D.perduesAn} perdues cette année`, onclick: "navigate('opportunites')" }),
    dbxKpi({ i: 3, label: 'Taux d’équipement', valeur: tauxEq ?? 0, suffixe: ' %', sous: 'des besoins de base couverts', onclick: "navigate('equipement')" }),
    dbxKpi({ i: 4, label: 'Commissions de gestion', valeur: gestion, prefixe: 'CHF ', sous: `sur ${dbxCHF(D.totalRecu)} encaissés`, onclick: "navigate('commissions-attente')" }),
  ].join('');

  // Portefeuille par compagnie (top 8)
  const parCie = {};
  D.actifs.forEach(ct => { const k = normaliserCompagnie(ct.compagnie || '') || '—'; parCie[k] = parCie[k] || { primes: 0, nb: 0 }; parCie[k].primes += Number(ct.prime_annuelle || 0); parCie[k].nb++; });
  const cies = Object.entries(parCie).sort((a, b) => b[1].primes - a[1].primes).slice(0, 8);
  const maxCie = Math.max(...cies.map(c => c[1].primes), 1);

  // Pipeline par stade
  const stades = [['Contact', '#94A3B8'], ['Analyse', '#38BDF8'], ['Proposition', '#F59E0B'], ['Négociation', '#A78BFA']];
  const parStade = stades.map(([s, c]) => { const l = D.oppsOuvertes.filter(o => o.stade === s); return { s, c, nb: l.length, total: l.reduce((t, o) => t + Number(o.montant_potentiel || 0), 0) }; });
  const maxStade = Math.max(...parStade.map(x => x.total), 1);

  return `
    <div class="dbx-kpis">${kpis}</div>
    <div class="dbx-grille dbx-grille-egale">
      <section class="dbx-carte dbx-anim" style="--i:5"><header class="dbx-carte-tete"><h2>Commissions encaissées</h2><span class="dbx-carte-sous">12 derniers mois</span></header>
        ${dbxBarres(D.mois, D.mois.map(m => D.commMois[m]), '#00CFFF', dbxCHF)}</section>
      <section class="dbx-carte dbx-anim" style="--i:6"><header class="dbx-carte-tete"><h2>Primes signées</h2><span class="dbx-carte-sous">12 derniers mois</span></header>
        ${dbxBarres(D.mois, D.mois.map(m => D.primesMois[m]), '#5B82C9', dbxCHF)}</section>
      <section class="dbx-carte dbx-anim" style="--i:7"><header class="dbx-carte-tete"><h2>Portefeuille par compagnie</h2><button type="button" class="dbx-lien" onclick="navigate('tous-contrats')">Tous les contrats →</button></header>
        <div class="dbx-hbarres">${cies.map(([cie, x], i) => `<div class="dbx-hbarre" style="--i:${i}">
          <span class="dbx-hbarre-nom">${typeof pictoCompagnie === 'function' ? pictoCompagnie(cie, 22) : ''}<span>${dbxEsc(cie)}</span></span>
          <span class="dbx-hbarre-piste"><span style="--w:${Math.round(x.primes / maxCie * 100)}%"></span></span>
          <span class="dbx-hbarre-val">${dbxCompact(x.primes)}<small>${x.nb} ctr.</small></span></div>`).join('')}</div></section>
      <section class="dbx-carte dbx-anim" style="--i:8"><header class="dbx-carte-tete"><h2>Pipeline par stade</h2><button type="button" class="dbx-lien" onclick="navigate('opportunites')">Ouvrir le pipeline →</button></header>
        <div class="dbx-hbarres">${parStade.map((x, i) => `<div class="dbx-hbarre" style="--i:${i}">
          <span class="dbx-hbarre-nom"><span class="dbx-point" style="background:${x.c}"></span><span>${x.s}</span></span>
          <span class="dbx-hbarre-piste"><span style="--w:${Math.round(x.total / maxStade * 100)}%;background:${x.c}"></span></span>
          <span class="dbx-hbarre-val">${dbxCompact(x.total)}<small>${x.nb} aff.</small></span></div>`).join('')}</div></section>
    </div>
    <div class="dbx-raccourcis dbx-anim" style="--i:9">
      ${[['🔁', 'Renouvellements', 'renouvellements'], ['🧩', 'Équipement', 'equipement'], ['🧭', 'Sources des clients', 'sources'], ['💰', 'Suivi financier', 'suivi-financier'], ['📋', 'Rapport FINMA', 'rapport-finma']]
        .map(([i, l, v]) => `<button type="button" onclick="navigate('${v}')"><span aria-hidden="true">${i}</span>${l}</button>`).join('')}
      <button type="button" onclick="dbxBasculer(true)"><span aria-hidden="true">🗂️</span>Vue classique détaillée</button>
    </div>`;
}

// ── Après affichage : compteurs animés, nouveautés ────────────────────────────────────────────
function dbxApresRendu() {
  if (!document.querySelector('.dbx')) return;
  dbxChargerNouveautes();
  if (typeof bmqApresRendu === 'function') bmqApresRendu();
  const reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const calme = dbxCalme;
  dbxCalme = false;
  if (reduit || calme) return;
  document.querySelectorAll('[data-dbx-compteur]').forEach(el => {
    const cible = Number(el.dataset.dbxCompteur) || 0;
    const prefixe = el.dataset.prefixe || '', suffixe = el.dataset.suffixe || '';
    const debut = performance.now(), duree = 900;
    const pas = t => {
      const p = Math.min(1, (t - debut) / duree), e = 1 - Math.pow(1 - p, 3);
      el.textContent = prefixe + fmtCHF(Math.round(cible * e)) + suffixe;
      if (p < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  });
}
