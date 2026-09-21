// ═══ TÂCHES & RAPPELS — LA VUE, REVUE (22.09.2026) ═════════════════════════════════════════════
// « J'aime la fonction, mais vois si tu peux améliorer la vue et l'affichage un peu. »
//
// Rien ne change dans le fonctionnement : mêmes données (allRappels), mêmes actions (showRappel,
// traiterRappel, rouvrirRappel, synchroniserRappelOutlook, « + Nouvelle tâche »). On remplace
// seulement la vue de js/06, qui reste en place si ce fichier n'est pas chargé.
//
// CE QUI CHANGE, ET POURQUOI.
//   · Les groupes suivent la façon dont on s'organise, pas des tranches de jours : En retard,
//     Aujourd'hui, Demain, Cette semaine, Ce mois-ci, Plus tard, Sans échéance. « Dans les 30
//     prochains jours » mélangeait ce qui est pour demain et ce qui est pour dans quatre semaines.
//   · Une recherche instantanée (titre, client, notes) et un filtre Tâches / Rappels : avec
//     quelques dizaines de lignes ouvertes, on ne retrouvait une tâche qu'en faisant défiler.
//   · Chaque carte porte sa date en pastille (jour + mois), son urgence en liseré, le client
//     cliquable, et deux gestes directs : « Reporter » au prochain jour ouvré et « Fait ».
//
// RETOUR EN ARRIÈRE : retirer les deux lignes (js/121, css/99-taches.css) de index.html.

window._trp = window._trp || { filtre: 'ouverts', texte: '', nature: 'toutes' };

function trpEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Jours de calendrier LOCAUX entre la date et aujourd'hui (pas de new Date('AAAA-MM-JJ'), qui est
// minuit UTC et faisait passer « en retard » un rappel du jour dès 2 h du matin).
function trpJours(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const t = new Date();
  return Math.round((new Date(y, m - 1, d) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
}
function trpIsoLocal(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const TRP_MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function trpNomClient(r) {
  if (!r.client_id) return '';
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === r.client_id);
  return c ? ((typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : '';
}

function trpRelatif(j) {
  if (j == null) return 'sans échéance';
  if (j < -1) return `en retard de ${-j} jours`;
  if (j === -1) return 'en retard d’un jour';
  if (j === 0) return 'aujourd’hui';
  if (j === 1) return 'demain';
  if (j <= 7) return `dans ${j} jours`;
  if (j <= 31) return `dans ${Math.round(j / 7)} sem.`;
  if (j <= 365) return `dans ${Math.round(j / 30)} mois`;
  return `dans ${Math.round(j / 365 * 10) / 10} an(s)`;
}

// Le groupe d'un rappel ouvert. La semaine s'arrête au dimanche, le mois à son dernier jour.
function trpGroupe(r) {
  const j = trpJours(r.date_echeance);
  if (j == null) return 'sans';
  if (j < 0) return 'retard';
  if (j === 0) return 'auj';
  if (j === 1) return 'demain';
  const t = new Date();
  const jusquDimanche = (7 - t.getDay()) % 7;           // 0 le dimanche
  if (j <= jusquDimanche) return 'semaine';
  const finMois = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  if (String(r.date_echeance).slice(0, 10) <= trpIsoLocal(finMois)) return 'mois';
  return 'tard';
}
const TRP_GROUPES = [
  { cle: 'retard', nom: 'En retard', ton: 'grave' },
  { cle: 'auj', nom: 'Aujourd’hui', ton: 'chaud' },
  { cle: 'demain', nom: 'Demain', ton: 'tiede' },
  { cle: 'semaine', nom: 'Cette semaine', ton: 'tiede' },
  { cle: 'mois', nom: 'Ce mois-ci', ton: '' },
  { cle: 'tard', nom: 'Plus tard', ton: 'froid' },
  { cle: 'sans', nom: 'Sans échéance', ton: 'froid' },
];

function trpCorrespond(r) {
  const F = window._trp;
  if (F.nature === 'taches' && r.nature !== 'tache') return false;
  if (F.nature === 'rappels' && r.nature === 'tache') return false;
  const q = (F.texte || '').trim().toLowerCase();
  if (!q) return true;
  return [r.titre, r.notes, trpNomClient(r), r.type].some(v => String(v || '').toLowerCase().includes(q));
}

function trpCarte(r) {
  const j = trpJours(r.date_echeance);
  const ferme = r.statut !== 'ouvert';
  const urg = r.urgence === 'haute' ? 'haute' : r.urgence === 'moyenne' ? 'moyenne' : 'basse';
  const nom = trpNomClient(r);
  const date = r.date_echeance ? String(r.date_echeance).slice(0, 10).split('-').map(Number) : null;
  const icone = r.nature === 'tache' ? '📋' : (r.tache_parent_id ? '🔗' : '🔔');
  const notes = r.notes ? String(r.notes).split('[')[0].trim() : '';
  const puces = [
    nom ? `<button type="button" class="trp-puce trp-client" onclick="event.stopPropagation();showClient('${r.client_id}')">👤 ${trpEsc(nom)}</button>` : '',
    `<span class="trp-puce ${!ferme && j != null && j < 0 ? 'grave' : ''}">${trpEsc(ferme ? (r.statut === 'traité' ? 'traité' : r.statut) : trpRelatif(j))}</span>`,
    r.date_planifiee ? `<span class="trp-puce">📅 planifié le ${fmtDate(r.date_planifiee)}</span>` : '',
    r.piece_jointe_nom ? `<span class="trp-puce">📎 ${trpEsc(r.piece_jointe_nom)}</span>` : '',
    r.type ? `<span class="trp-puce trp-type">${trpEsc(r.type)}</span>` : '',
  ].filter(Boolean).join('');
  const sansAgenda = !ferme && !r.outlook_event_id && (r.date_echeance || r.date_planifiee);
  return `<article class="trp-carte urg-${urg} ${ferme ? 'ferme' : ''} ${!ferme && j != null && j < 0 ? 'retard' : ''}" onclick="showRappel('${r.id}')" tabindex="0"
      onkeydown="if(event.key==='Enter'){showRappel('${r.id}')}">
    <div class="trp-date" aria-label="Échéance">
      ${date ? `<b>${date[2]}</b><small>${TRP_MOIS[date[1] - 1]}${date[0] !== new Date().getFullYear() ? ' ' + String(date[0]).slice(2) : ''}</small>` : '<b>—</b><small>sans date</small>'}
    </div>
    <div class="trp-corps">
      <div class="trp-titre">${r.cree_par && typeof PICTO_CREE_EQUIPE !== 'undefined' ? PICTO_CREE_EQUIPE + ' ' : ''}<span class="trp-ico" aria-hidden="true">${icone}</span>${trpEsc(r.titre || (r.nature === 'tache' ? 'Tâche' : 'Rappel'))}</div>
      <div class="trp-puces">${puces}</div>
      ${notes ? `<div class="trp-notes">${trpEsc(notes.slice(0, 140))}${notes.length > 140 ? '…' : ''}</div>` : ''}
    </div>
    <div class="trp-actions" onclick="event.stopPropagation()">
      ${ferme
        ? `<button type="button" class="trp-btn" onclick="rouvrirRappel('${r.id}')" title="Rouvrir">↺ Rouvrir</button>`
        : `${sansAgenda && typeof synchroniserRappelOutlook === 'function' ? `<button type="button" class="trp-btn trp-btn-agenda" onclick="synchroniserRappelOutlook('${r.id}')" title="Absent de l’agenda Outlook — cliquer pour l’y ajouter">📅</button>` : ''}
           <button type="button" class="trp-btn" onclick="trpReporter('${r.id}')" title="Reporter au prochain jour ouvré">⏭ Reporter</button>
           <button type="button" class="trp-btn trp-btn-ok" onclick="traiterRappel('${r.id}')" title="Marquer comme fait">✓ Fait</button>`}
    </div>
  </article>`;
}

function viewRappelsTrp() {
  const F = window._trp;
  const tous = (typeof allRappels !== 'undefined' ? allRappels : []);
  const ouverts = tous.filter(r => r.statut === 'ouvert')
    .sort((a, b) => String(a.date_echeance || '9999-12-31').localeCompare(String(b.date_echeance || '9999-12-31'))
      || ({ haute: 0, moyenne: 1, basse: 2 }[a.urgence] ?? 3) - ({ haute: 0, moyenne: 1, basse: 2 }[b.urgence] ?? 3));
  const fermes = tous.filter(r => r.statut !== 'ouvert')
    .sort((a, b) => String(b.date_echeance || b.created_at || '').localeCompare(String(a.date_echeance || a.created_at || '')));
  const parGroupe = {};
  ouverts.forEach(r => { const g = trpGroupe(r); (parGroupe[g] = parGroupe[g] || []).push(r); });
  const n = k => (parGroupe[k] || []).length;
  const semaine = n('auj') + n('demain') + n('semaine');

  const onglets = [
    ['ouverts', 'Ouverts', ouverts.length, ''],
    ['retard', 'En retard', n('retard'), 'grave'],
    ['auj', 'Aujourd’hui', n('auj'), 'chaud'],
    ['semaine', 'Cette semaine', semaine, 'tiede'],
    ['fermes', 'Fermés', fermes.length, 'froid'],
  ];

  let corps = '';
  const filtrer = l => l.filter(trpCorrespond);
  if (F.filtre === 'fermes') {
    const l = filtrer(fermes).slice(0, 80);
    corps = l.length ? `<div class="trp-liste">${l.map(trpCarte).join('')}</div>` : '<div class="trp-vide">Aucun rappel fermé.</div>';
  } else {
    const groupes = F.filtre === 'retard' ? ['retard'] : F.filtre === 'auj' ? ['auj'] : F.filtre === 'semaine' ? ['auj', 'demain', 'semaine'] : TRP_GROUPES.map(g => g.cle);
    corps = groupes.map(k => {
      const g = TRP_GROUPES.find(x => x.cle === k);
      const l = filtrer(parGroupe[k] || []);
      if (!l.length) return '';
      return `<section class="trp-groupe ton-${g.ton}">
        <h3 class="trp-groupe-tete"><span>${g.nom}</span><em>${l.length}</em></h3>
        <div class="trp-liste">${l.map(trpCarte).join('')}</div>
      </section>`;
    }).join('') || `<div class="trp-vide">${F.texte ? 'Aucun résultat pour cette recherche.' : F.filtre === 'retard' ? '✅ Rien en retard.' : '✅ Rien à faire dans cette sélection.'}</div>`;
  }

  const resume = n('retard')
    ? `<b>${n('retard')}</b> en retard · <b>${n('auj')}</b> pour aujourd’hui · ${ouverts.length} ouvert${ouverts.length > 1 ? 's' : ''}`
    : `${n('auj') ? `<b>${n('auj')}</b> pour aujourd’hui · ` : 'Rien d’urgent · '}${ouverts.length} ouvert${ouverts.length > 1 ? 's' : ''}`;

  return `<div class="trp">
    <section class="fcx-hero trp-hero">
      <div class="fcx-hero-deco" aria-hidden="true"></div>
      <div>
        <span class="cf-surtitre">Organisation</span>
        <h1>Tâches &amp; rappels</h1>
        <p>${resume}</p>
      </div>
      <div class="cf-hero-actions">
        <button type="button" class="fcx-btn-blanc" onclick="navigate('nouveau-rappel')">+ Nouvelle tâche / rappel</button>
      </div>
    </section>

    <div class="trp-barre">
      <div class="trp-onglets" role="tablist">${onglets.map(([k, l, c, ton]) =>
        `<button type="button" role="tab" aria-selected="${F.filtre === k}" class="trp-onglet ton-${ton} ${F.filtre === k ? 'actif' : ''}" onclick="trpFiltrer('filtre','${k}')">
          <b>${c}</b><span>${l}</span></button>`).join('')}</div>
      <div class="trp-outils">
        <label class="trp-recherche"><span aria-hidden="true">⌕</span>
          <input type="search" id="trp-q" placeholder="Rechercher une tâche, un client…" value="${trpEsc(F.texte)}" oninput="trpChercher(this.value)" autocomplete="off"/></label>
        <div class="trp-seg" role="group" aria-label="Nature">${[['toutes', 'Tout'], ['taches', '📋 Tâches'], ['rappels', '🔔 Rappels']].map(([k, l]) =>
          `<button type="button" class="${F.nature === k ? 'actif' : ''}" onclick="trpFiltrer('nature','${k}')">${l}</button>`).join('')}</div>
      </div>
    </div>

    <div id="trp-corps">${corps}</div>
  </div>`;
}

function trpFiltrer(champ, v) {
  window._trp[champ] = v;
  if (typeof filtreRappelsActuel !== 'undefined' && champ === 'filtre') { try { filtreRappelsActuel = v; } catch (e) {} }
  if (typeof navigate === 'function') navigate('rappels', { silent: true });
}

// La recherche repeint sans renavigation, pour garder le curseur dans le champ.
let _trpMinuteur = null;
function trpChercher(v) {
  window._trp.texte = v;
  clearTimeout(_trpMinuteur);
  _trpMinuteur = setTimeout(() => {
    const main = document.getElementById('main-content');
    if (!main || currentView !== 'rappels') return;
    const tmp = document.createElement('div');
    tmp.innerHTML = viewRappelsTrp();
    const neuf = tmp.querySelector('#trp-corps'), actuel = document.getElementById('trp-corps');
    if (neuf && actuel) actuel.innerHTML = neuf.innerHTML;
  }, 120);
}

// « Reporter » : au prochain jour ouvré, en date locale, et l'événement Outlook suit (comme le
// report de la fiche du rappel, js/06 appliquerReportRappel), mais on reste sur la liste.
async function trpReporter(id) {
  const r = (typeof allRappels !== 'undefined' ? allRappels : []).find(x => x.id === id);
  if (!r) return;
  const d = new Date();
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  const nouvelle = trpIsoLocal(d);
  const ancien = r.outlook_event_id;
  const res = await dbPatch('rappels', id, { date_echeance: nouvelle, outlook_event_id: null });
  if (res && res.error) { showError('Report impossible : ' + errMsg(res)); return; }
  r.date_echeance = nouvelle; r.outlook_event_id = null;
  showError(`✓ Reporté au ${fmtDate(nouvelle)}`);
  if (typeof navigate === 'function') navigate('rappels', { silent: true });
  if (ancien && typeof deleteOutlookEvent === 'function') { try { await deleteOutlookEvent(ancien); } catch (e) {} }
  if (typeof createOutlookEventFromRappel === 'function') {
    try { const ev = await createOutlookEventFromRappel(r); if (ev) { await dbPatch('rappels', id, { outlook_event_id: ev }); r.outlook_event_id = ev; } } catch (e) {}
  }
}

(function trpBrancher() {
  if (typeof viewRappels === 'function') window.viewRappels = viewRappelsTrp;
})();
