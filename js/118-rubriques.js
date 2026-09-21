// ═══ UNE PAGE PAR RUBRIQUE (21.09.2026) ════════════════════════════════════════════════════════
// « Est-ce qu'on pourrait faire que chaque menu principal a sa vue propre, avec tout résumé sur une
// page et des boutons d'accès rapide ? Un peu comme Plan de trésorerie et Entrées d'argent ont des
// ponts. Je ne trouve pas "Affaires". »
//
// Chaque rubrique du menu — Vente, Marketing, Compta, Admin, RH, Agenda — reçoit une page
// « Vue d'ensemble » :
//   · en tête, les chiffres de la rubrique, chacun cliquable vers l'écran qui les détaille ;
//   · « À traiter » : ce qui attend une action, avec le lien direct ;
//   · « Accès rapide » : TOUS les écrans de la rubrique en boutons, rangés par groupe — y compris
//     ceux que le menu replie. C'est là que « Affaires » (un groupe de Vente, pas une rubrique)
//     devient visible d'un coup d'œil.
// On y arrive par l'entrée « Vue d'ensemble » en tête de chaque rubrique, ou en cliquant le nom de
// la rubrique dans le fil d'Ariane de la barre du haut.
//
// Lecture seule : tout est calculé sur les données déjà chargées. RETOUR EN ARRIÈRE : retirer la
// ligne de index.html.

function rbqEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rbqCHF(n) { return 'CHF ' + (typeof fmtCHF === 'function' ? fmtCHF(Math.round(n || 0)) : Math.round(n || 0)); }
function rbqListe(nom) { try { const v = window[nom] ?? eval(nom); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function rbqAuj() { return new Date().toISOString().slice(0, 10); }
function rbqDans(j) { return new Date(Date.now() + j * 86400000).toISOString().slice(0, 10); }
function rbqNomClient(id) {
  const c = rbqListe('allClients').find(x => x.id === id);
  if (!c) return '';
  return (typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim();
}

// Une carte-chiffre : titre, valeur, précision, et l'écran où elle mène.
function rbqCarte(label, valeur, sous, vue, ton) {
  return `<button type="button" class="rbq-carte ${ton || ''}" onclick="navigate('${vue}')">
    <span>${rbqEsc(label)}</span><b>${valeur}</b><small>${sous || ''}</small></button>`;
}
function rbqTache(texte, vue, ton) {
  return `<li class="${ton || ''}"><button type="button" onclick="${vue.startsWith('js:') ? vue.slice(3) : `navigate('${vue}')`}">${texte}</button></li>`;
}

// ── Les chiffres de chaque rubrique ────────────────────────────────────────────────────────────
const RBQ_RESUMES = {
  vente() {
    const clients = rbqListe('allClients'), contrats = rbqListe('allContrats'), opps = rbqListe('allOpportunites');
    const actifs = contrats.filter(ct => ['actif', 'renouveler'].includes(ct.statut));
    const primes = actifs.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
    const enCours = opps.filter(o => !['Gagné', 'Perdu'].includes(o.stade));
    const pondere = enCours.reduce((s, o) => s + Number(o.commission_estimee || 0) * Number(o.probabilite || 50) / 100, 0);
    const mois = rbqAuj().slice(0, 7);
    const gagneesMois = opps.filter(o => o.stade === 'Gagné' && String(o.signee_le || o.created_at || '').slice(0, 7) === mois);
    const auj = rbqAuj(), d90 = rbqDans(90);
    const echeances = actifs.filter(ct => ct.date_echeance && ct.date_echeance >= auj && ct.date_echeance <= d90);
    const echues = enCours.filter(o => o.date_echeance && o.date_echeance < auj);
    const entreprises = clients.filter(c => typeof estEntreprise === 'function' && estEntreprise(c)).length;
    return {
      cartes: [
        rbqCarte('Clients', clients.length, `${clients.length - entreprises} privés · ${entreprises} entreprises`, 'portefeuille'),
        rbqCarte('Contrats en vigueur', actifs.length, `${rbqCHF(primes)} de primes par an`, 'tous-contrats'),
        rbqCarte('Affaires en cours', enCours.length, `commission pondérée ${rbqCHF(pondere)}`, 'opportunites'),
        rbqCarte('Gagnées ce mois', gagneesMois.length, 'voir ce qu’elles ont rapporté', 'opp-converties', gagneesMois.length ? 'ok' : ''),
        rbqCarte('Échéances à 90 jours', echeances.length, 'renouvellements à préparer', 'renouvellements', echeances.length ? 'alerte' : ''),
      ],
      taches: [
        echues.length ? rbqTache(`⏰ <b>${echues.length}</b> affaire${echues.length > 1 ? 's' : ''} à relancer (échéance dépassée)`, 'opportunites', 'danger') : '',
        echeances.length ? rbqTache(`🔁 <b>${echeances.length}</b> contrat${echeances.length > 1 ? 's arrivent' : ' arrive'} à échéance d’ici 90 jours`, 'renouvellements') : '',
      ],
    };
  },
  marketing() {
    const clients = rbqListe('allClients'), camp = rbqListe('allCampagnesPersonnalisees');
    const sansMail = clients.filter(c => !c.email).length;
    const sansSource = clients.filter(c => !c.source).length;
    return {
      cartes: [
        rbqCarte('Campagnes', camp.length, 'modèles et envois', 'campagnes'),
        rbqCarte('Clients joignables par e-mail', clients.length - sansMail, `${sansMail} sans adresse`, 'portefeuille', sansMail ? 'alerte' : ''),
        rbqCarte('Source renseignée', clients.length ? Math.round((clients.length - sansSource) / clients.length * 100) + ' %' : '—', `${sansSource} client${sansSource > 1 ? 's' : ''} sans source`, 'sources'),
      ],
      taches: [
        sansMail ? rbqTache(`✉️ <b>${sansMail}</b> client${sansMail > 1 ? 's' : ''} sans e-mail : hors de portée des newsletters`, 'portefeuille', 'alerte') : '',
      ],
    };
  },
  compta() {
    const comms = rbqListe('allCommissionsAttente'), brds = rbqListe('allBordereaux');
    const attente = comms.filter(ca => ca.statut === 'en_attente');
    const an = rbqAuj().slice(0, 4), mois = rbqAuj().slice(0, 7);
    const encAn = comms.filter(ca => ['reçue', 'versé_oz'].includes(ca.statut) && String(ca.date_reception || '').startsWith(an));
    const brdMois = brds.filter(b => String(b.date_reception || '').startsWith(mois));
    const retard = attente.filter(ca => ca.date_creation && (Date.now() - new Date(ca.date_creation)) / 86400000 > 45);
    const dernier = brds.map(b => b.date_reception).filter(Boolean).sort().pop();
    return {
      cartes: [
        rbqCarte('Commissions attendues', rbqCHF(attente.reduce((s, ca) => s + Number(ca.montant_estime || 0), 0)), `${attente.length} ligne${attente.length > 1 ? 's' : ''} en attente`, 'commissions-attente'),
        rbqCarte(`Encaissé en ${an}`, rbqCHF(encAn.reduce((s, ca) => s + Number(ca.montant_final ?? ca.montant_estime ?? 0), 0)), 'commissions reçues sur bordereau', 'entrees-argent', 'ok'),
        rbqCarte('Bordereaux ce mois', brdMois.length, dernier ? `dernier reçu le ${fmtDate(dernier)}` : 'aucun reçu', 'commissions-attente'),
        rbqCarte('Plan de trésorerie', '→', 'les mois à venir', 'tresorerie'),
      ],
      taches: [
        retard.length ? rbqTache(`⏳ <b>${retard.length}</b> commission${retard.length > 1 ? 's' : ''} attendue${retard.length > 1 ? 's' : ''} depuis plus de 45 jours`, 'commissions-attente', 'danger') : '',
      ],
    };
  },
  admin() {
    const n = typeof NTF_ETAT !== 'undefined' && NTF_ETAT ? NTF_ETAT.total || 0 : 0;
    const phrase = typeof ntfPhrase === 'function' ? ntfPhrase() : '';
    const contrats = rbqListe('allContrats').filter(ct => ['actif', 'renouveler'].includes(ct.statut));
    const sansPolice = contrats.filter(ct => !ct.numero_police).length;
    return {
      cartes: [
        rbqCarte('Demandes à traiter', n, phrase || (n ? 'messages, sinistres, documents' : 'rien en attente'), 'messages-clients', n ? 'alerte' : 'ok'),
        rbqCarte('Contrats sans n° de police', sansPolice, 'à compléter pour le rattachement', 'tous-contrats', sansPolice ? 'alerte' : ''),
        rbqCarte('Rapport FINMA', '→', 'conformité', 'rapport-finma'),
      ],
      taches: [
        n ? rbqTache(`💬 <b>${n}</b> demande${n > 1 ? 's' : ''} de clients attend${n > 1 ? 'ent' : ''} une réponse`, 'messages-clients', 'alerte') : '',
      ],
    };
  },
  rh() {
    const agents = rbqListe('allAgents'), fiches = rbqListe('allFichesPaie');
    const derniere = fiches.map(f => f.periode || f.mois || f.created_at).filter(Boolean).sort().pop();
    return {
      cartes: [
        rbqCarte('Agents', agents.length, 'équipe et apporteurs', 'agents'),
        rbqCarte('Fiches de paie', fiches.length, derniere ? `dernière : ${rbqEsc(String(derniere).slice(0, 10))}` : 'aucune', 'fiche-paie'),
      ],
      taches: [],
    };
  },
  organisation() {
    const rap = rbqListe('allRappels').filter(r => r.statut === 'ouvert'), rdv = rbqListe('allRendezVous');
    const auj = rbqAuj(), d7 = rbqDans(7);
    const retard = rap.filter(r => r.date_echeance && String(r.date_echeance).slice(0, 10) < auj);
    const aujourdhui = rap.filter(r => String(r.date_echeance || '').slice(0, 10) === auj);
    const semaine = rdv.filter(r => r.statut !== 'annule' && r.date_heure && r.date_heure.slice(0, 10) >= auj && r.date_heure.slice(0, 10) <= d7)
      .sort((a, b) => a.date_heure.localeCompare(b.date_heure));
    return {
      cartes: [
        rbqCarte('Tâches ouvertes', rap.length, retard.length ? `${retard.length} en retard` : 'à jour', 'rappels', retard.length ? 'danger' : ''),
        rbqCarte('Pour aujourd’hui', aujourdhui.length, 'tâches du jour', 'rappels'),
        rbqCarte('Rendez-vous à 7 jours', semaine.length, semaine[0] ? `prochain : ${fmtDate(semaine[0].date_heure.slice(0, 10))} ${semaine[0].date_heure.slice(11, 16)}` : 'aucun', 'rendez-vous'),
      ],
      taches: [
        ...semaine.slice(0, 4).map(r => rbqTache(`📅 ${fmtDate(r.date_heure.slice(0, 10))} ${r.date_heure.slice(11, 16)} — ${rbqEsc(r.type || 'Rendez-vous')}${r.client_id ? ' · ' + rbqEsc(rbqNomClient(r.client_id)) : ''}`, 'rendez-vous')),
        retard.length ? rbqTache(`⚠️ <b>${retard.length}</b> tâche${retard.length > 1 ? 's' : ''} en retard`, 'rappels', 'danger') : '',
      ],
    };
  },
};

// ── La page ────────────────────────────────────────────────────────────────────────────────────
function viewRubrique(secId) {
  const sec = (typeof SECTIONS !== 'undefined' ? SECTIONS : []).find(s => s.id === secId);
  if (!sec) return '<div class="dbx-vide-petit">Rubrique inconnue.</div>';
  const rh = typeof estRoleRH === 'function' && estRoleRH();
  const r = (RBQ_RESUMES[secId] || (() => ({ cartes: [], taches: [] })))();
  const taches = r.taches.filter(Boolean);
  const ecrans = (sec.sub || []).filter(s => !s.id.startsWith('rubrique-') && (!rh || s.rhAllowed));
  const groupes = [];
  for (const s of ecrans) {
    const g = s.groupe || sec.label;
    let bloc = groupes.find(x => x.nom === g);
    if (!bloc) { bloc = { nom: g, ecrans: [] }; groupes.push(bloc); }
    bloc.ecrans.push(s);
  }
  // Les autres rubriques, en pied : on passe de l'une à l'autre sans rouvrir le menu.
  const autres = (typeof SECTIONS !== 'undefined' ? SECTIONS : []).filter(s => !s.solo && s.id !== secId);

  return `<div class="dbx rbq">
    <h1>${sec.icon || ''} ${rbqEsc(sec.label)} — vue d’ensemble</h1>
    ${r.cartes.length && !rh ? `<div class="rbq-cartes">${r.cartes.join('')}</div>` : ''}
    ${taches.length && !rh ? `<section class="rbq-bloc"><h2>À traiter</h2><ul class="rbq-taches">${taches.join('')}</ul></section>` : ''}
    <section class="rbq-bloc"><h2>Accès rapide</h2>
      <div class="rbq-groupes">${groupes.map(g => `<div class="rbq-groupe">
        <h3>${rbqEsc(g.nom)}</h3>
        <div class="rbq-boutons">${g.ecrans.map(s => `<button type="button" class="rbq-bouton" onclick="navigate('${s.id}')">
          <span aria-hidden="true">${s.icon || '•'}</span>${rbqEsc(s.label)}</button>`).join('')}</div>
      </div>`).join('')}</div>
    </section>
    <nav class="rbq-autres" aria-label="Autres rubriques">${autres.map(s => `<button type="button" onclick="navigate('rubrique-${s.id}')">${s.icon || ''} ${rbqEsc(s.label)}</button>`).join('')}</nav>
  </div>`;
}

// ── Branchements ───────────────────────────────────────────────────────────────────────────────
(function rbqBrancher() {
  if (typeof SECTIONS !== 'undefined') {
    for (const sec of SECTIONS) {
      if (sec.solo || !Array.isArray(sec.sub) || sec.sub.some(s => s.id === 'rubrique-' + sec.id)) continue;
      // En tête de rubrique, avant le premier groupe. Visible en session RH seulement si la
      // rubrique a des écrans autorisés (le menu la masque sinon de toute façon).
      sec.sub.unshift({ id: 'rubrique-' + sec.id, icon: '🧭', label: 'Vue d’ensemble', rhAllowed: sec.sub.some(s => s.rhAllowed) });
      if (typeof NAV_SYNONYMES !== 'undefined') NAV_SYNONYMES['rubrique-' + sec.id] = `accueil resume rubrique ${sec.label.toLowerCase()} ensemble tableau`;
    }
  }
  if (typeof NAV_SYNONYMES !== 'undefined') {
    NAV_SYNONYMES['rubrique-vente'] += ' affaires affaire';
    NAV_SYNONYMES['suivi'] = (NAV_SYNONYMES['suivi'] || '') + ' affaires affaire dossiers en cours';
  }
  if (typeof renderView === 'function') {
    const origine = renderView;
    window.renderView = async function () {
      const v = typeof currentView !== 'undefined' ? currentView : '';
      if (v.startsWith('rubrique-')) {
        const main = document.getElementById('main-content');
        if (main) main.innerHTML = viewRubrique(v.slice(9));
        return;
      }
      return origine.apply(this, arguments);
    };
  }
  // Le fil d'Ariane : cliquer « Vente » ouvre la vue d'ensemble de Vente.
  if (typeof mnuOuvrirRubrique === 'function') {
    window.mnuOuvrirRubrique = function (secId) {
      if (typeof openSections !== 'undefined') openSections[secId] = true;
      navigate('rubrique-' + secId);
    };
  }

  const st = document.createElement('style');
  st.textContent = `
    .rbq h1 { margin-bottom: 14px; }
    .rbq-cartes { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-bottom: 16px; }
    .rbq-carte { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 14px 16px; border-radius: 14px; cursor: pointer; text-align: left;
      background: var(--surface); border: 1px solid var(--border); color: var(--text); font: inherit; transition: border-color .15s, transform .15s; }
    .rbq-carte:hover { border-color: var(--accent); transform: translateY(-1px); }
    .rbq-carte span { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
    .rbq-carte b { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .rbq-carte small { font-size: var(--t-xs); color: var(--text-muted); }
    .rbq-carte.ok b { color: var(--c-succes-texte, #047857); }
    .rbq-carte.alerte { border-color: color-mix(in srgb, var(--c-alerte) 45%, transparent); }
    .rbq-carte.alerte b { color: var(--c-alerte-texte, #B45309); }
    .rbq-carte.danger { border-color: color-mix(in srgb, var(--c-danger) 45%, transparent); }
    .rbq-carte.danger b { color: var(--c-danger-texte, #B91C1C); }
    .rbq-bloc { margin-bottom: 16px; padding: 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); }
    .rbq-bloc h2 { margin: 0 0 10px; font-size: 15px; font-weight: 600; }
    .rbq-taches { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .rbq-taches button { width: 100%; text-align: left; border: 0; border-radius: 10px; padding: 9px 12px; cursor: pointer; font: inherit; font-size: var(--t-s);
      background: var(--surface-alt); color: var(--text); }
    .rbq-taches li.danger button { background: var(--c-danger-fond, color-mix(in srgb, var(--c-danger) 10%, transparent)); }
    .rbq-taches li.alerte button { background: var(--c-alerte-fond, color-mix(in srgb, var(--c-alerte) 10%, transparent)); }
    .rbq-groupes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
    .rbq-groupe h3 { margin: 0 0 8px; font-size: var(--t-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); font-weight: 600; }
    .rbq-boutons { display: flex; flex-direction: column; gap: 6px; }
    .rbq-bouton { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; cursor: pointer; text-align: left;
      border: 1px solid var(--border); background: var(--surface-alt); color: var(--text); font: inherit; font-size: var(--t-m); }
    .rbq-bouton:hover { border-color: var(--accent); color: var(--accent); }
    .rbq-bouton span { width: 22px; text-align: center; }
    .rbq-autres { display: flex; flex-wrap: wrap; gap: 8px; }
    .rbq-autres button { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 999px; padding: 6px 14px; cursor: pointer; font: inherit; font-size: var(--t-s); }
    .rbq-autres button:hover { color: var(--text); border-color: var(--accent); }`;
  document.head.appendChild(st);
})();
