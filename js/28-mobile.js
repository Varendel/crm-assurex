// ═══ EXPÉRIENCE IPHONE (19.09.2026) ═════════════════════════════════════════════════════════
// - Bandeau supérieur aux couleurs de la marque (logo REX, titre de la page, recherche) ;
// - barre d'onglets en bas, comme une app : Accueil · Clients · [+] · Affaires · Tâches ;
// - bouton central « + » : saisie rapide en une pression, pensée pour la voix (🎤 démarre tout
//   de suite), rattachée à une affaire ou à un client, enregistrée comme note ou comme tâche.
// Sur ordinateur, rien ne change (tout est masqué au-delà de 768 px).

const REX_ONGLETS_MOBILE = [
  { id: 'dashboard', icone: '🏠', label: 'Accueil', vues: ['dashboard'] },
  { id: 'portefeuille', icone: '👥', label: 'Clients', vues: ['portefeuille', 'clients', 'clients-prives', 'clients-entreprises', 'clients-oz', 'tous-contrats', 'nouveau-client'] },
  { id: '+', icone: '+', label: 'Saisir' },
  { id: 'suivi', icone: '🎯', label: 'Affaires', vues: ['suivi', 'opportunites', 'nouvelle-opportunite', 'nouvelle-demande-offre'] },
  { id: 'rappels', icone: '✅', label: 'Tâches', vues: ['rappels', 'nouveau-rappel', 'agenda', 'rendez-vous'] },
];

function rexEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function rexInstallerMobile() {
  const app = document.getElementById('app');
  if (!app || document.getElementById('rex-tabbar')) return;
  // Bandeau supérieur : logo + titre de la page + recherche
  const barre = document.querySelector('.mobile-topbar');
  if (barre) {
    barre.innerHTML = `
      <button class="mobile-menu-btn" onclick="toggleSidebarMobile()" aria-label="Ouvrir le menu">☰</button>
      <img src="assets/logos/rex-mascotte-hd.png" alt="" class="rex-topbar-mascotte"/>
      <div class="rex-topbar-texte"><span class="rex-topbar-marque">REX</span><span class="mobile-topbar-title" id="rex-topbar-titre">Accueil</span></div>
      <button class="rex-topbar-btn" onclick="rexRechercheMobile()" aria-label="Rechercher">🔍</button>`;
  }
  const nav = document.createElement('nav');
  nav.id = 'rex-tabbar';
  nav.className = 'rex-tabbar';
  nav.setAttribute('aria-label', 'Navigation principale');
  nav.innerHTML = REX_ONGLETS_MOBILE.map(o => o.id === '+'
    ? `<button type="button" class="rex-tab-plus" onclick="rexSaisieRapide()" aria-label="Saisie rapide"><span>+</span></button>`
    : `<button type="button" class="rex-tab" data-vue="${o.id}" onclick="rexAllerOnglet('${o.id}')"><span class="rex-tab-icone">${o.icone}</span><span>${o.label}</span></button>`).join('');
  app.appendChild(nav);
  rexMajTabbar();
}

// 22.09.2026 : l'onglet « Affaires » ouvre 'suivi', hors périmètre RH (commission pondérée à
// l'écran) : le garde-fou de navigate() renvoyait alors en silence sur « Tous les clients ». Pour
// la session RH, l'onglet ouvre le Pipeline, qui lui est autorisé (sans montants).
function rexAllerOnglet(id) {
  const rh = typeof estRoleRH === 'function' && estRoleRH();
  navigate(rh && id === 'suivi' ? 'opportunites' : id);
}

function rexMajTabbar() {
  const nav = document.getElementById('rex-tabbar');
  if (!nav) return;
  const rh = typeof estRoleRH === 'function' && estRoleRH();
  nav.querySelectorAll('.rex-tab').forEach(b => {
    const o = REX_ONGLETS_MOBILE.find(x => x.id === b.dataset.vue);
    const actif = o && o.vues.includes(currentView);
    b.classList.toggle('actif', !!actif);
    b.setAttribute('aria-current', actif ? 'page' : 'false');
    if (rh && o.id === 'dashboard') b.hidden = true;
  });
  const titre = document.getElementById('rex-topbar-titre');
  if (titre) titre.textContent = rexTitreVue(currentView);
}

function rexTitreVue(v) {
  if (v === 'dashboard') return 'Accueil';
  if (v === 'nouvelle-opportunite') return 'Opportunité';
  if (v === 'nouvelle-demande-offre') return "Demande d'offre";
  if (v === 'opportunites') return 'Pipeline';
  for (const s of (typeof SECTIONS !== 'undefined' ? SECTIONS : [])) {
    if (s.target === v) return s.label;
    const sub = (s.sub || []).find(x => x.id === v);
    if (sub) return sub.label;
  }
  return 'REX';
}

async function rexRechercheMobile() {
  if (currentView !== 'dashboard') await navigate('dashboard');
  const el = document.getElementById('recherche-globale-input');
  if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
}

// ── Saisie rapide ───────────────────────────────────────────────────────────────────────────
function rexSaisieRapide(demarrerDictee) {
  const ouvertes = allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu');
  const prio = typeof suxScorer === 'function' ? ouvertes.map(suxScorer).sort((a, b) => b.score - a.score).map(s => s.o) : ouvertes;
  // Affaire ouverte à l'écran : proposée d'office
  const courante = currentView === 'nouvelle-opportunite' && opportuniteEnEditionId ? allOpportunites.find(o => o.id === opportuniteEnEditionId) : null;
  window._rexCible = courante ? { type: 'opp', id: courante.id } : null;
  window._rexType = 'note';
  const dicteeOk = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  creerModale('modal-saisie-rapide', `
    <div class="rex-feuille" role="dialog" aria-labelledby="rex-feuille-titre">
      <div class="rex-feuille-poignee" aria-hidden="true"></div>
      <div class="rex-feuille-tete"><h3 id="rex-feuille-titre">Saisie rapide</h3><button type="button" class="rex-fermer" aria-label="Fermer" onclick="document.getElementById('modal-saisie-rapide').remove()">✕</button></div>
      <div class="opx-modes rex-types">
        <button type="button" class="actif" data-t="note" onclick="rexChoisirType('note')">📝 Note</button>
        <button type="button" data-t="appel" onclick="rexChoisirType('appel')">📞 Appel</button>
        <button type="button" data-t="tache" onclick="rexChoisirType('tache')">✅ Tâche</button>
      </div>
      <div class="rex-dictee">
        ${dicteeOk ? `<button type="button" class="rex-micro" id="opx-micro" onclick="opDicter('rex-texte')" aria-label="Dicter">🎤</button><div class="rex-dictee-aide">Touche le micro et parle</div>` : ''}
        <textarea id="rex-texte" class="form-input" rows="3" placeholder="${dicteeOk ? 'Ou écris ici…' : 'Utilise le micro du clavier pour dicter…'}"></textarea>
      </div>
      <div class="rex-date" hidden>
        ${[['Demain', 1], ['Dans 3 jours', 3], ['Dans 1 semaine', 5]].map(([l, n], i) => `<button type="button" class="${i === 0 ? 'actif' : ''}" onclick="rexChoisirDate(this,${n})">${l}</button>`).join('')}
        <input type="hidden" id="rex-date" value="${typeof paJoursOuvresPlus === 'function' ? paJoursOuvresPlus(1) : ''}"/>
      </div>
      <div class="rex-cible">
        <div class="form-label">Rattacher à</div>
        <input class="form-input" id="rex-cible-recherche" placeholder="Chercher une affaire ou un client…" autocomplete="off" oninput="rexChercherCible(this.value)"/>
        <div class="rex-cibles" id="rex-cibles">${rexHtmlCibles(prio.slice(0, 6).map(o => ({ type: 'opp', id: o.id, nom: o.titre, sous: typeof opNomClient === 'function' ? opNomClient(o) : '' })))}</div>
      </div>
      <button type="button" class="btn-save rex-valider" id="rex-valider" onclick="rexEnregistrer()">Enregistrer</button>
    </div>`, { padding: '0' });
  const modale = document.getElementById('modal-saisie-rapide');
  if (modale) modale.classList.add('rex-modale-feuille');
  if (demarrerDictee && dicteeOk) setTimeout(() => opDicter('rex-texte'), 150);
}

function rexHtmlCibles(items) {
  const c = window._rexCible;
  if (!items.length) return '<div class="dbx-vide-petit">Aucun résultat.</div>';
  return items.map(it => `<button type="button" class="${c && c.id === it.id ? 'actif' : ''}" onclick="rexChoisirCible(this,'${it.type}','${it.id}')"><span>${it.type === 'opp' ? '🎯' : '👤'}</span><b>${rexEsc(it.nom)}</b><small>${rexEsc(it.sous || '')}</small></button>`).join('');
}

function rexChercherCible(t) {
  const q = _cleRechercheSansAccents(t || '');
  const zone = document.getElementById('rex-cibles');
  if (!zone) return;
  if (!q) { zone.innerHTML = rexHtmlCibles([]); return; }
  const opps = allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu' && _cleRechercheSansAccents(`${o.titre} ${opNomClient(o)}`).includes(q)).slice(0, 4)
    .map(o => ({ type: 'opp', id: o.id, nom: o.titre, sous: opNomClient(o) }));
  const nomC = c => estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
  const clients = allClients.filter(c => _cleRechercheSansAccents(nomC(c)).includes(q)).slice(0, 4).map(c => ({ type: 'client', id: c.id, nom: nomC(c), sous: c.ville || '' }));
  zone.innerHTML = rexHtmlCibles([...opps, ...clients]);
}

function rexChoisirCible(btn, type, id) {
  window._rexCible = { type, id };
  document.querySelectorAll('#rex-cibles button').forEach(b => b.classList.toggle('actif', b === btn));
}

function rexChoisirType(t) {
  window._rexType = t;
  document.querySelectorAll('.rex-types button').forEach(b => b.classList.toggle('actif', b.dataset.t === t));
  const d = document.querySelector('.rex-date');
  if (d) d.hidden = t !== 'tache';
}

function rexChoisirDate(btn, n) {
  document.querySelectorAll('.rex-date button').forEach(b => b.classList.toggle('actif', b === btn));
  document.getElementById('rex-date').value = typeof paJoursOuvresPlus === 'function' ? paJoursOuvresPlus(n) : '';
}

async function rexEnregistrer() {
  const texte = (document.getElementById('rex-texte')?.value || '').trim();
  const cible = window._rexCible;
  const type = window._rexType || 'note';
  if (!texte) { showError('Dicte ou écris quelque chose d’abord.'); return; }
  if (!cible) { showError('Choisis l’affaire ou le client concerné.'); return; }
  const btn = document.getElementById('rex-valider');
  if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Enregistrement…'; }
  let ok = true;
  if (type === 'tache') {
    const date = document.getElementById('rex-date')?.value || null;
    if (cible.type === 'opp') ok = await opCreerTache(cible.id, texte, date);
    else {
      const monAgent = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
      const r = await dbPost('rappels', { titre: texte, nature: 'tache', type: 'Suivi', client_id: cible.id, apporteur_id: monAgent ? monAgent.id : null, date_echeance: date, urgence: 'moyenne', statut: 'ouvert' });
      ok = !(r && r.error);
      if (!ok) showError('Tâche non créée : ' + errMsg(r));
      else {
        if (r[0] && r[0].id && date && typeof createOutlookEventFromRappel === 'function') { try { const ev = await createOutlookEventFromRappel(r[0]); if (ev) await dbPatch('rappels', r[0].id, { outlook_event_id: ev }); } catch (e) {} }
        allRappels = await dbGet('rappels', 'select=*');
        showError('✓ Tâche ajoutée.');
      }
    }
  } else {
    const prefixe = type === 'appel' ? '📞 Appel : ' : '📝 ';
    if (cible.type === 'opp') { await ajouterLigneHistoriqueOpportunite(cible.id, prefixe + texte); showError('✓ Ajouté au fil de l’affaire.'); }
    else {
      // Client sans affaire : la note devient une tâche déjà traitée, visible dans son historique
      const monAgent = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
      const r = await dbPost('rappels', { titre: prefixe + texte, nature: 'tache', type: 'Suivi', client_id: cible.id, apporteur_id: monAgent ? monAgent.id : null, date_echeance: new Date().toISOString().slice(0, 10), urgence: 'basse', statut: 'traité' });
      ok = !(r && r.error);
      if (!ok) showError('Note non enregistrée : ' + errMsg(r)); else { allRappels = await dbGet('rappels', 'select=*'); showError('✓ Note enregistrée sur le client.'); }
    }
  }
  if (!ok) { if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; } return; }
  document.getElementById('modal-saisie-rapide')?.remove();
  if (currentView === 'nouvelle-opportunite' && typeof opRafraichir === 'function') opRafraichir();
}

document.addEventListener('DOMContentLoaded', rexInstallerMobile);
if (document.readyState !== 'loading') rexInstallerMobile();
