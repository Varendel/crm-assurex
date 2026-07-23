async function initMSAL() {
  try {
    msalInstance = new msal.PublicClientApplication(MSAL_CONFIG);
    if (typeof msalInstance.initialize === 'function') {
      await msalInstance.initialize();
    }
    await tryRestoreOutlookSession();
  } catch(e) { msalInstance = null; }
}

// Tente de récupérer un token Outlook valide depuis le compte déjà connecté précédemment,
// sans rouvrir la popup de login (silencieux) — évite de devoir re-cliquer à chaque session.
async function tryRestoreOutlookSession() {
  if (!msalInstance) return false;
  try {
    const accounts = msalInstance.getAllAccounts();
    if (!accounts || accounts.length === 0) return false;
    const result = await msalInstance.acquireTokenSilent({
      account: accounts[0],
      scopes: ['openid', 'profile', 'email', 'User.Read', 'Calendars.ReadWrite', 'Mail.Send'],
    });
    msalAccessToken = result.accessToken;
    return true;
  } catch(e) {
    return false; // le compte a expiré/été révoqué → il faudra recliquer une fois
  }
}

async function loginMicrosoft() {
  try {
    if (!msalInstance) { await initMSAL(); }
    if (!msalInstance) { showError('Erreur initialisation Microsoft.'); return; }
    const result = await msalInstance.loginPopup({ scopes: ['openid', 'profile', 'email', 'User.Read', 'Calendars.ReadWrite', 'Mail.Send'] });
    msalAccessToken = result.accessToken;
    calendarEvents = await fetchCalendarEvents();
    showError('✓ Outlook connecté — synchronisation activée.');
    if (currentView === 'agenda') navigate('agenda');
  } catch(e) { showError('Connexion Outlook annulée.'); }
}

// ═══ MICROSOFT GRAPH — AGENDA ═══
async function fetchCalendarEvents() {
  if (!msalAccessToken) return [];
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
    const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${start}&endDateTime=${end}&$orderby=start/dateTime&$top=50`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${msalAccessToken}` } });
    if (!r.ok) { console.error('Graph API error', r.status); return []; }
    const data = await r.json();
    return data.value || [];
  } catch(e) { console.error('Graph fetch error', e); return []; }
}

// ═══ MICROSOFT GRAPH — SYNC RAPPELS → OUTLOOK ═══
async function createOutlookEventFromRappel(rappel) {
  if (!msalAccessToken || !rappel.date_echeance) return null;
  try {
    const client = rappel.client_id ? allClients.find(c => c.id === rappel.client_id) : null;
    const clientLine = client ? `Client : ${client.prenom} ${client.nom}\n` : '';
    const body = {
      subject: `🔔 ${rappel.titre}`,
      isAllDay: true,
      start: { dateTime: rappel.date_echeance, timeZone: 'Europe/Zurich' },
      end: { dateTime: rappel.date_echeance, timeZone: 'Europe/Zurich' },
      body: { contentType: 'text', content: `${clientLine}Type : ${rappel.type || ''}\nUrgence : ${rappel.urgence || ''}\n\n${rappel.notes || ''}` },
    };
    const r = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) { console.error('Graph create event error', r.status); return null; }
    const data = await r.json();
    return data.id || null;
  } catch(e) { console.error('Graph create event exception', e); return null; }
}

async function deleteOutlookEvent(eventId) {
  if (!msalAccessToken || !eventId) return;
  try {
    await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${msalAccessToken}` },
    });
  } catch(e) { console.error('Graph delete event exception', e); }
}

// ═══ MICROSOFT GRAPH — EMAIL D'ASSIGNATION (tâches & rappels) ═══
// Envoie un email immédiat à l'agent assigné, via la session Microsoft déjà connectée.
// Silencieux en cas d'échec (pas de session Outlook active, etc.) — la tâche reste créée dans tous les cas.
async function sendTaskAssignmentEmail(rappel, agent) {
  if (!msalAccessToken || !agent || !agent.email) return false;
  try {
    const client = rappel.client_id ? allClients.find(c => c.id === rappel.client_id) : null;
    const clientLine = client ? `Client : ${estEntreprise(client) ? client.nom : client.prenom + ' ' + client.nom}\n` : '';
    const collab = rappel.collaborateur_id ? allCollaborateurs.find(c => c.id === rappel.collaborateur_id) : null;
    const collabLine = collab ? `Collaborateur : ${collab.prenom} ${collab.nom}\n` : '';
    const natureLabel = rappel.nature === 'tache' ? 'Nouvelle tâche assignée' : 'Nouveau rappel assigné';
    const echeanceLine = rappel.date_echeance ? `Échéance : ${fmtDate(rappel.date_echeance)}\n` : '';
    const contenu = `${natureLabel} dans REX CRM\n\n${rappel.titre}\n\n${clientLine}${collabLine}${echeanceLine}Urgence : ${rappel.urgence || ''}\n\n${rappel.notes || ''}\n\n— Ouvrir dans REX CRM : https://varendel.github.io/crm-assurex`;
    const body = {
      message: {
        subject: `${rappel.nature === 'tache' ? '📋' : '🔔'} ${rappel.titre}`,
        body: { contentType: 'text', content: contenu },
        toRecipients: [{ emailAddress: { address: agent.email } }],
      },
      saveToSentItems: true,
    };
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch(e) { console.error('Graph sendMail exception', e); return false; }
}

// ═══ RAPPEL INTELLIGENT (lié automatiquement à une tâche) ═══
// Calcule un délai d'anticipation selon l'urgence de la tâche
function offsetJoursSelonUrgence(urgence) {
  if (urgence === 'haute') return 3;
  if (urgence === 'moyenne') return 7;
  return 14; // basse
}

// Retourne la date (YYYY-MM-DD) du rappel intelligent, ou null si non pertinent
// (échéance trop proche pour qu'un rappel préalable ait un sens — la tâche sert déjà d'alerte)
function calculerDateRappelIntelligent(dateEcheance, urgence) {
  if (!dateEcheance) return null;
  const offset = offsetJoursSelonUrgence(urgence);
  const echeance = new Date(dateEcheance + 'T00:00:00');
  const rappelDate = new Date(echeance);
  rappelDate.setDate(rappelDate.getDate() - offset);
  const today = new Date(); today.setHours(0,0,0,0);
  if (rappelDate <= today) return null;
  return rappelDate.toISOString().slice(0,10);
}

// Crée effectivement le rappel enfant en base, lié à la tâche parente
async function creerRappelIntelligentPourTache(tache) {
  const dateRappel = calculerDateRappelIntelligent(tache.date_echeance, tache.urgence);
  if (!dateRappel) return null;
  const body = {
    titre: `🔔 Rappel : ${tache.titre}`,
    nature: 'rappel',
    tache_parent_id: tache.id,
    client_id: tache.client_id || null,
    collaborateur_id: tache.collaborateur_id || null,
    contrat_id: tache.contrat_id || null,
    type: tache.type || 'Suivi',
    urgence: tache.urgence || 'basse',
    date_echeance: dateRappel,
    apporteur_id: tache.apporteur_id || null,
    notes: `Rappel automatique généré avant l'échéance de la tâche "${tache.titre}".`,
    statut: 'ouvert',
  };
  const created = await dbPost('rappels', body);
  if (created && created.error) return null;
  const enfant = created && created[0];
  if (enfant && enfant.date_echeance) {
    try {
      const eventId = await createOutlookEventFromRappel(enfant);
      if (eventId) await dbPatch('rappels', enfant.id, { outlook_event_id: eventId });
    } catch(e) { /* sync Outlook échouée, le rappel reste créé */ }
  }
  return enfant || null;
}

// Met à jour l'aperçu affiché dans le formulaire de création selon urgence + échéance choisies
function updateRappelIntelligentPreview() {
  const zone = document.getElementById('r-auto-rappel-zone');
  if (!zone) return;
  const nature = document.getElementById('r-nature').value;
  const dateEcheance = document.getElementById('r-date').value;
  const urgence = document.getElementById('r-urgence').value;
  if (nature !== 'tache' || !dateEcheance) { zone.style.display = 'none'; return; }
  const dateRappel = calculerDateRappelIntelligent(dateEcheance, urgence);
  zone.style.display = '';
  const checkbox = document.getElementById('r-auto-rappel-check');
  const preview = document.getElementById('r-auto-rappel-preview');
  if (!dateRappel) {
    checkbox.checked = false; checkbox.disabled = true;
    preview.textContent = "Échéance trop proche pour un rappel préalable — la tâche sert déjà d'alerte.";
  } else {
    checkbox.disabled = false;
    if (checkbox.dataset.userTouched !== 'true') checkbox.checked = true;
    preview.textContent = `Un rappel sera automatiquement créé le ${fmtDate(dateRappel)} (${offsetJoursSelonUrgence(urgence)} jours avant l'échéance).`;
  }
}
async function getEtapesRappel(rappelId) {
  return await dbGet('tache_etapes', `rappel_id=eq.${rappelId}&select=*&order=ordre.asc`);
}

async function toggleEtapeRappel(etapeId, fait) {
  const r = await dbPatch('tache_etapes', etapeId, { fait });
  if (r && r.error) { showError('Erreur lors de la mise à jour de l\u2019étape : ' + errMsg(r)); return; }
  showRappel(currentRappelId);
}

async function ajouterEtapeRappel(rappelId) {
  const input = document.getElementById('nouvelle-etape-input');
  const libelle = input && input.value.trim();
  if (!libelle) return;
  const etapesActuelles = await getEtapesRappel(rappelId);
  const r = await dbPost('tache_etapes', { rappel_id: rappelId, libelle, ordre: etapesActuelles.length });
  if (r && r.error) { showError('Erreur lors de l\u2019ajout de l\u2019étape : ' + errMsg(r)); return; }
  showRappel(currentRappelId);
}

async function supprimerEtapeRappel(etapeId) {
  await fetch(`${SUPABASE_URL}/rest/v1/tache_etapes?id=eq.${etapeId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${await getValidAccessToken() || SUPABASE_KEY}` },
  });
  showRappel(currentRappelId);
}

async function refreshAgenda() {
  calendarEvents = await fetchCalendarEvents();
  if (currentView === 'agenda') {
    document.getElementById('main-content').innerHTML = viewAgenda();
  }
}

// ═══ WIDGET CALENDRIER (style "widget iPhone") sur le Dashboard ═══
let dashboardFocusDay = new Date(); // jour mis en avant dans la vue agrandie

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=dim
  const diff = day === 0 ? -6 : 1 - day; // lundi = début de semaine
  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date;
}
function isSameDay(a, b) { return a.toDateString() === b.toDateString(); }
function isoDay(d) { return d.toISOString().slice(0,10); }

function eventsForDay(d) {
  return calendarEvents.filter(ev => {
    const start = ev.start && ev.start.dateTime ? new Date(ev.start.dateTime) : null;
    return start && isSameDay(start, d);
  }).sort((a,b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));
}

function selectDashboardDay(iso) {
  dashboardFocusDay = new Date(iso + 'T12:00:00');
  renderCalendarWidget();
}

function shiftDashboardWeek(days) {
  if (days === 0) { dashboardFocusDay = new Date(); }
  else { const d = new Date(dashboardFocusDay); d.setDate(d.getDate() + days); dashboardFocusDay = d; }
  renderCalendarWidget();
}

async function mountCalendarWidget() {
  const el = document.getElementById('calendar-widget-container');
  if (!el) return;
  if (!msalAccessToken) {
    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">📅</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">Agenda non connecté</div>
            <div style="font-size:11px;color:var(--text-muted)">Connecte Outlook pour voir tes rendez-vous ici</div>
          </div>
        </div>
        <button onclick="loginMicrosoft().then(()=>mountCalendarWidget())" class="btn-add">Connecter Outlook</button>
      </div>`;
    return;
  }
  if (!calendarEvents || calendarEvents.length === 0) {
    el.innerHTML = `<div class="loader" style="padding:20px">Chargement de l'agenda...</div>`;
    calendarEvents = await fetchCalendarEvents();
  }
  dashboardFocusDay = new Date();
  renderCalendarWidget();
}

function renderCalendarWidget() {
  const el = document.getElementById('calendar-widget-container');
  if (!el) return;
  const today = new Date();
  const weekStart = startOfWeek(dashboardFocusDay);
  const joursLabels = ['L','M','M','J','V','S','D'];
  const weekDays = [...Array(7)].map((_,i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate()+i); return d; });

  const dayPills = weekDays.map((d, i) => {
    const isToday = isSameDay(d, today);
    const isFocus = isSameDay(d, dashboardFocusDay);
    const nbEv = eventsForDay(d).length;
    return `<button onclick="selectDashboardDay('${isoDay(d)}')" style="
      display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;background:none;border:none;cursor:pointer;padding:6px 2px;border-radius:10px;
      ${isFocus ? 'background:var(--accent-dim);' : ''}">
      <span style="font-size:10px;color:var(--text-muted);font-weight:700">${joursLabels[i]}</span>
      <span style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;
        ${isToday ? 'background:var(--accent);color:#fff;' : isFocus ? 'color:var(--accent);' : 'color:var(--text);'}">${d.getDate()}</span>
      ${nbEv > 0 ? `<span style="width:4px;height:4px;border-radius:50%;background:${isFocus?'var(--accent)':'var(--text-muted)'}"></span>` : '<span style="width:4px;height:4px"></span>'}
    </button>`;
  }).join('');

  // Vue agrandie : jour sélectionné + jour suivant
  const dayNext = new Date(dashboardFocusDay); dayNext.setDate(dashboardFocusDay.getDate() + 1);
  const focusLabel = isSameDay(dashboardFocusDay, today) ? "Aujourd'hui" : dashboardFocusDay.toLocaleDateString('fr-CH', { weekday:'long', day:'numeric', month:'long' });
  const nextLabel = isSameDay(dayNext, today) ? "Aujourd'hui" : dayNext.toLocaleDateString('fr-CH', { weekday:'long', day:'numeric', month:'long' });

  function dayCard(date, label) {
    const evs = eventsForDay(date);
    return `<div style="flex:1;min-width:0">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">${label}</div>
      ${evs.length ? evs.map(ev => {
        const start = new Date(ev.start.dateTime);
        const end = ev.end && ev.end.dateTime ? new Date(ev.end.dateTime) : null;
        const heure = ev.isAllDay ? 'Jour entier' : start.toLocaleTimeString('fr-CH', { hour:'2-digit', minute:'2-digit' }) + (end ? ' – ' + end.toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'}) : '');
        return `<div style="display:flex;gap:8px;margin-bottom:8px;background:var(--surface-alt);border-left:3px solid var(--accent);border-radius:8px;padding:8px 10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ev.subject || 'Sans titre'}</div>
            <div style="font-size:10.5px;color:var(--text-muted);margin-top:1px">${heure}${ev.location && ev.location.displayName ? ' · ' + ev.location.displayName : ''}</div>
          </div>
        </div>`;
      }).join('') : `<div style="font-size:11.5px;color:var(--text-muted);padding:8px 0">Aucun rendez-vous</div>`}
    </div>`;
  }

  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:800;color:var(--text)">📅 Agenda de la semaine</div>
        <div style="display:flex;align-items:center;gap:10px">
          <button onclick="shiftDashboardWeek(-7)" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:7px;width:26px;height:26px;color:var(--text-muted);cursor:pointer;font-size:13px;line-height:1">‹</button>
          <button onclick="shiftDashboardWeek(0)" style="background:none;border:none;color:var(--text-muted);font-size:10.5px;font-weight:700;cursor:pointer">Aujourd'hui</button>
          <button onclick="shiftDashboardWeek(7)" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:7px;width:26px;height:26px;color:var(--text-muted);cursor:pointer;font-size:13px;line-height:1">›</button>
          <button onclick="navigate('agenda')" style="background:none;border:none;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;margin-left:4px">Vue complète →</button>
        </div>
      </div>
      <div style="display:flex;gap:2px;margin-bottom:16px">${dayPills}</div>
      <div style="display:flex;gap:18px;border-top:1px solid var(--border);padding-top:14px;flex-wrap:wrap">
        ${dayCard(dashboardFocusDay, focusLabel)}
        ${dayCard(dayNext, nextLabel)}
      </div>
    </div>`;
}

// ═══ LOGIN ═══
function togglePass() {
  const inp = document.getElementById('login-pass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showError(msg) {
  const loginEl = document.getElementById('login-error');
  if (loginEl && !document.getElementById('app').classList.contains('active')) {
    loginEl.textContent = '⚠ ' + msg;
    loginEl.classList.remove('hidden');
    return;
  }
  let toast = document.getElementById('global-error-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-error-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#7f1d1d;border:1px solid #f87171;color:#fecaca;padding:14px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;max-width:380px;box-shadow:0 8px 24px rgba(0,0,0,0.4)';
    document.body.appendChild(toast);
  }
  toast.textContent = '⚠ ' + msg;
  toast.style.display = 'block';
  clearTimeout(window._errorToastTimeout);
  window._errorToastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 6000);
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pwd = document.getElementById('login-pass').value;
  if (!email || !pwd) { showError('Email et mot de passe requis.'); return; }
  const btn = document.querySelector('.btn-primary');
  if (btn) { btn.textContent = 'Connexion...'; btn.disabled = true; }
  const res = await supabaseAuthLogin(email, pwd);
  if (btn) { btn.textContent = 'Se connecter'; btn.disabled = false; }
  if (res.error) { showError('Email ou mot de passe incorrect.'); return; }
  document.getElementById('login-error').classList.add('hidden');

  // Propose au navigateur d'enregistrer les identifiants (SPA = pas de rechargement de page,
  // donc on déclenche explicitement la sauvegarde via l'API Credential Management)
  if (window.PasswordCredential) {
    try {
      const cred = new PasswordCredential({ id: email, password: pwd, name: email });
      await navigator.credentials.store(cred);
    } catch(e) { /* ignore si non supporté */ }
  }

  const userData = USER_ROLES[email] || { prenom: email.split('@')[0], nom: '', role: 'apporteur', taux: 50 };
  enterApp({ id: email, prenom: userData.prenom, nom: userData.nom, email, role: userData.role, taux: userData.taux });
}

async function enterApp(user) {
  currentUser = user;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('active');
  logAction('login', null, null, `${user.prenom} ${user.nom}`);
  allAgents = await dbGet('agents', 'select=*');
  allClients = await dbGet('clients', 'select=*');
  allRappels = await dbGet('rappels', 'select=*');
  allCollaborateurs = await dbGet('collaborateurs', 'select=*').catch(() => []);
  allBordereaux = await dbGet('bordereaux', 'select=*');
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  allFichesPaie = await dbGet('fiches_paie', 'select=*');
  allCompagniesContacts = await dbGet('compagnies_contacts', 'select=*&order=compagnie.asc');
  allVehicules = await dbGet('vehicules', 'select=*').catch(() => []);
  allContrats = await dbGet('contrats', 'select=*');
  allOpportunites = await dbGet('opportunites', 'select=*');

  // Bascule automatique : contrats actifs dont l'échéance est passée → "à renouveler"
  await basculerContratsEchus();

  if (user.role === 'signataire') {
    try {
      const ozRows = await dbGet('commissions_oz', 'select=date_mouvement,debit,credit');
      const parAnnee = {};
      (ozRows || []).forEach(r => {
        const annee = (r.date_mouvement || '').slice(0, 4);
        if (!annee) return;
        parAnnee[annee] = (parAnnee[annee] || 0) + (Number(r.credit||0) - Number(r.debit||0));
      });
      ozAnnualSummary = parAnnee;
    } catch(e) { ozAnnualSummary = null; }
  }

  renderSidebar();
  // Ouverture directe d'une fiche client si l'onglet a été ouvert via Ctrl/Cmd+clic (deep-link ?client=ID)
  const paramsUrl = new URLSearchParams(window.location.search);
  const clientDeepLink = paramsUrl.get('client');
  if (clientDeepLink && allClients.some(c => c.id === clientDeepLink)) {
    await showClient(clientDeepLink);
  } else {
    navigate('dashboard');
  }
}

async function logout() {
  logAction('logout', null, null, currentUser ? `${currentUser.prenom} ${currentUser.nom}` : null);
  await supabaseAuthLogout();
  currentUser = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('active');
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
}

// Tentative de restauration de session au chargement de la page
async function tryRestoreSession() {
  const s = loadStoredSession();
  if (!s || !s.email) return false;
  const token = await getValidAccessToken();
  if (!token) return false;
  const userData = USER_ROLES[s.email] || { prenom: s.email.split('@')[0], nom: '', role: 'apporteur', taux: 50 };
  await enterApp({ id: s.email, prenom: userData.prenom, nom: userData.nom, email: s.email, role: userData.role, taux: userData.taux });
  return true;
}

// ═══ SIDEBAR ═══
const SECTIONS = [
  { id: 'dashboard-solo', label: 'Dashboard', icon: '⬛', solo: true, target: 'dashboard' },
  { id: 'pipeline-solo', label: 'Pipeline', icon: '📈', solo: true, target: 'opportunites' },
  { id: 'oz-assure-solo', label: 'OZ Assure', solo: true, logo: true, target: 'oz-assure', signataireOnly: true },
  { id: 'vente', label: 'Vente', icon: '◈', sub: [
    { id: 'suivi', label: 'Suivi des affaires' },
    { id: 'nouveau-contrat-direct', label: 'Nouveau contrat' },
    { id: 'nouvelle-demande-offre', label: 'Demande d\'offre' },
    { id: 'calc-lpp', label: '🧮 Bilan de prévoyance' },
    { id: 'calc-immo', label: '🏠 Financement immobilier' },
    { id: 'rappels', label: 'Tâches & Rappels' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'campagnes', label: 'Campagnes' },
  ]},
  { id: 'portefeuille', label: 'Portefeuille', icon: '◑', sub: [
    { id: 'portefeuille', label: 'Tous les clients', staff: true },
    { id: 'clients-prives', label: 'Clients privés' },
    { id: 'clients-entreprises', label: 'Entreprises' },
    { id: 'clients-oz', label: 'Clients OZ Assure', staff: true },
    { id: 'volume-primes', label: 'Volume de primes', staff: true },
    { id: 'tous-contrats', label: 'Tous les contrats' },
    { id: 'recherche-vehicules', label: '🚗 Recherche véhicules' },
  ]},
  { id: 'compta', label: 'Comptabilité', icon: '◎', sub: [
    { id: 'bordereaux', label: 'Bordereaux (reçus des compagnies)' },
    { id: 'import-decompte', label: '📊 Import décompte (Excel IG B2B)' },
    { id: 'commissions', label: 'Commissions', staff: true },
    { id: 'commissions-attente', label: 'Toutes les commissions' },
    { id: 'fiche-paie', label: 'Fiche de paie (agents)' },
    { id: 'rapport-finma', label: 'Rapport FINMA' },
    { id: 'production', label: 'Production (par période)', staff: true },
  ]},
  { id: 'settings', label: 'Paramètres', icon: '⊙', sub: [
    { id: 'agents', label: 'Agents' },
    { id: 'audit-log', label: 'Journal d\'audit' },
    { id: 'contacts-compagnies', label: 'Contacts compagnies' },
  ]},
];

function renderSidebar() {
  // Nav
  let nav = '';
  SECTIONS.forEach(sec => {
    if (sec.signataireOnly && (!currentUser || currentUser.role !== 'signataire')) return;
    if (sec.solo) {
      const active = currentView === sec.target;
      if (sec.logo) {
        nav += `<button class="nav-solo-btn nav-solo-logo ${active ? 'active' : ''}" onclick="navigate('${sec.target}')" title="OZ Assure">
          ${OZASSURE_LOGO_SVG}
        </button>`;
        return;
      }
      nav += `<button class="nav-solo-btn ${active ? 'active' : ''}" onclick="navigate('${sec.target}')">
        <span style="font-size:13px">📊</span>${sec.label}
        ${active ? '<span class="nav-dot" style="margin-left:auto"></span>' : ''}
      </button>`;
      return;
    }
    const isActive = sec.sub.some(s => s.id === currentView);
    nav += `<button class="nav-section-btn ${isActive ? 'active' : ''}" onclick="toggleSection('${sec.id}')">
      <span style="font-size:14px">${sec.icon}</span>${sec.label}
      <span class="arrow">${openSections[sec.id] ? '▲' : '▼'}</span>
    </button>`;
    if (openSections[sec.id]) {
      sec.sub.forEach(s => {
        const active = s.id === currentView;
        let badgeHtml = '';
        if (s.id === 'rappels') {
          const monAgent = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
          const mesTaches = (allRappels || []).filter(r => r.statut === 'ouvert' && monAgent && r.apporteur_id === monAgent.id);
          if (mesTaches.length) badgeHtml = `<span style="background:#f87171;color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:800;margin-left:auto">${mesTaches.length}</span>`;
        }
        nav += `<button class="nav-item ${active ? 'active' : ''}" onclick="navigate('${s.id}')" style="${s.staff ? `color:#fb923c;font-weight:700;${active ? 'background:rgba(251,146,60,0.12);' : ''}` : ''}">
          ${active ? `<span class="nav-dot" style="${s.staff ? 'background:#fb923c' : ''}"></span>` : ''}${s.label}${badgeHtml}
        </button>`;
      });
    }
  });
  document.getElementById('nav').innerHTML = nav;

  // Team
  let team = '';
  const agents = allAgents.length > 0 ? allAgents : [currentUser];
  agents.forEach(a => {
    const isMe = a.email === currentUser.email;
    const color = agentColor(a);
    const initials = (a.prenom[0] + a.nom[0]).toUpperCase();
    team += `<div class="team-member ${isMe ? 'me' : ''}">
      <div class="avatar" style="width:24px;height:24px;font-size:8px;background:${color}18;border:1.5px solid ${color}44;color:${color}">${initials}</div>
      <div style="font-size:11.5px;font-weight:700;color:${isMe ? color : 'var(--text)'};">${a.prenom}</div>
      ${isMe ? '<div class="online-dot"></div>' : ''}
    </div>`;
  });
  document.getElementById('team-list').innerHTML = team;
}

function toggleSection(id) {
  openSections[id] = !openSections[id];
  renderSidebar();
}

let navHistory = [];
let vueDetailActive = null; // { type: 'client'|'rappel'|'campagne', id } — quelle fiche détail est affichée, si applicable

// Capture l'état actuellement affiché, sous une forme qui permet de le restaurer fidèlement
// (une fiche détail précise, pas juste "on était sur la page Rappels" en général).
function capturerEtatActuel() {
  return vueDetailActive || { type: 'view', view: currentView };
}

// Restaure un état précédemment capturé — redirige vers la bonne fiche détail si applicable,
// ou vers la vue normale sinon.
async function restaurerEtat(etat) {
  if (!etat) { await navigate('dashboard'); return; }
  if (etat.type === 'client') { await showClient(etat.id); return; }
  if (etat.type === 'rappel') { showRappel(etat.id); return; }
  if (etat.type === 'campagne') { showCampagne(etat.id); return; }
  currentView = etat.view;
  renderSidebar();
  await renderView();
}

// Recharge les tables financières critiques depuis Supabase — garantit que le
// Dashboard reflète TOUJOURS l'état réel de la base, y compris après une
// modification faite directement en SQL (hors de l'interface du CRM).
async function refreshCoreData() {
  const [contrats, commissions, bordereaux, clients, fiches] = await Promise.all([
    dbGet('contrats', 'select=*'),
    dbGet('commissions_attente', 'select=*'),
    dbGet('bordereaux', 'select=*'),
    dbGet('clients', 'select=*'),
    dbGet('fiches_paie', 'select=*'),
  ]);
  allContrats = contrats || allContrats;
  allCommissionsAttente = commissions || allCommissionsAttente;
  allBordereaux = bordereaux || allBordereaux;
  allClients = clients || allClients;
  allFichesPaie = fiches || allFichesPaie;
}

async function navigate(view, opts) {
  // Empile l'état précédent (vue normale OU fiche détail précise) pour permettre le retour arrière,
  // sauf navigation silencieuse ou si on reste sur le même état (évite un doublon inutile).
  if (!opts || !opts.silent) {
    const etatPrecedent = capturerEtatActuel();
    const dernier = navHistory[navHistory.length - 1];
    const doublon = dernier && JSON.stringify(dernier) === JSON.stringify(etatPrecedent);
    if (!doublon && (etatPrecedent.type !== 'view' || (currentView && currentView !== view))) {
      navHistory.push(etatPrecedent);
      if (navHistory.length > 30) navHistory.shift();
    }
  }
  vueDetailActive = null; // une navigation normale quitte toute fiche détail affichée
  currentView = view;
  renderSidebar();
  await renderView();
}

async function goBack() {
  if (!navHistory.length) { navigate('dashboard'); return; }
  const etat = navHistory.pop();
  await restaurerEtat(etat);
}

// ═══ HELPERS ═══
// Formater une date ISO en format européen DD/MM/YYYY
function fmtDate(d) {
  if (!d) return '—';
  const p = String(d).split('T')[0].split('-');
  if (p.length !== 3) return d;
  return p[2] + '/' + p[1] + '/' + p[0];
}

// Extrait un message d'erreur lisible depuis une réponse {error, detail, status} de dbPost/dbPatch
function errMsg(r) {
  if (!r) return 'Erreur inconnue';
  if (r.detail && typeof r.detail === 'object') return r.detail.message || r.detail.hint || JSON.stringify(r.detail);
  return r.detail || r.status || 'Erreur inconnue';
}

// Crée une fenêtre modale standard (fond sombre + boîte centrée) et l'ajoute au document.
// Mutualise ce qui était recopié à la main dans 13 endroits différents — un seul point à
// modifier si un jour le style général des modales doit changer (couleur du fond, etc.).
// Retourne l'élément modal, pour que l'appelant puisse encore lui attacher un comportement
// particulier (ex: fermeture au clic sur le fond) après l'avoir créé.
function creerModale(id, contenuHtml, options = {}) {
  document.getElementById(id)?.remove(); // évite un doublon si redéclenché rapidement
  const opacite = options.opacite !== undefined ? options.opacite : 0.7;
  const padding = options.padding || '20px';
  const overflowY = options.overflowY !== false; // true par défaut
  const modal = document.createElement('div');
  modal.id = id;
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,${opacite});z-index:9999;display:flex;align-items:center;justify-content:center;padding:${padding};${overflowY ? 'overflow-y:auto' : ''}`;
  modal.innerHTML = contenuHtml;
  document.body.appendChild(modal);
  return modal;
}

// Le petit encadré bleu marine contenant le logo Assurex, répété dans les documents imprimés
// (bilan de prévoyance, financement immobilier, mandat de courtage). Seule cette partie est
// réellement identique d'un document à l'autre — les coordonnées et infos client qui l'entourent
// diffèrent légitimement selon le document, donc elles ne sont volontairement pas mutualisées ici.
function genererBadgeLogoAssurex(hauteurLogo = 34, padding = '14px 18px', display = 'flex') {
  return `<div style="background:#113679;border-radius:8px;padding:${padding};display:${display};align-items:center">
    <img src="${ASSUREX_LOGO_WORDMARK_PNG}" alt="Assurex" style="height:${hauteurLogo}px;width:auto;display:block"/>
  </div>`;
}

function badge(label, color) {
  return `<span class="badge" style="background:${color}15;color:${color};border:1px solid ${color}30">${label}</span>`;
}

function avatar(agent, size = 28) {
  if (!agent) return '';
  const color = agentColor(agent);
  const initials = (agent.prenom[0] + agent.nom[0]).toUpperCase();
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${size*0.33}px;background:${color}18;border:1.5px solid ${color}44;color:${color}">${initials}</div>`;
}

function agentById(id) { return allAgents.find(a => a.id === id); }

function caClient(clientId) {
  // Même définition que le "CA portefeuille" du Dashboard : tout contrat non résilié et non annulé
  // (inclut donc "actif", "en_cours", "à renouveler"...) — pour que les deux chiffres se répondent toujours.
  return allContrats.filter(ct => ct.client_id === clientId && !['résilié','annulé','mandat_resilie'].includes(ct.statut))
    .reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
}

function statutColor(s) {
  if (s === 'actif') return '#4ade80';
  if (s === 'prospect') return '#f59e0b';
  return '#64748b';
}

function statCard(label, value, color, sub = '') {
  return `<div class="stat-card">
    <div class="stat-label">${label}</div>
    <div class="stat-value" style="color:${color}">${value}</div>
    ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
  </div>`;
}

function infoBlock(label, value) {
  return `<div class="info-block"><div class="info-label">${label}</div><div class="info-value">${value || '—'}</div></div>`;
}

function sectionCard(title, accentColor, content) {
  return `<div class="section-card" style="border-color:${accentColor}33">
    <div class="section-card-header" style="border-color:${accentColor}22">
      <div style="width:3px;height:14px;border-radius:99px;background:${accentColor}"></div>
      <span style="color:${accentColor}">${title}</span>
    </div>
    <div class="section-card-body">${content}</div>
  </div>`;
}

// ═══ VIEWS ═══
async function renderView() {
  const main = document.getElementById('main-content');
  switch (currentView) {
    case 'dashboard':
      main.innerHTML = '<div class="loader">Actualisation des données...</div>';
      await refreshCoreData();
      main.innerHTML = viewDashboard();
      mountCalendarWidget();
      break;
    case 'clients': main.innerHTML = viewPortefeuille('tous'); break;
    case 'portefeuille': main.innerHTML = viewPortefeuille('tous'); break;
    case 'clients-prives': main.innerHTML = viewPortefeuille('prive'); break;
    case 'clients-entreprises': main.innerHTML = viewPortefeuille('entreprise'); break;
    case 'clients-oz': main.innerHTML = viewPortefeuille('oz'); break;
    case 'tous-contrats': main.innerHTML = viewTousContrats(); break;
    case 'recherche-vehicules': main.innerHTML = viewRechercheVehicules(); break;
    case 'volume-primes': main.innerHTML = '<div class="loader">Calcul en cours...</div>'; main.innerHTML = await viewVolumePrimes(); break;
    case 'nouveau-client': main.innerHTML = viewNouveauClient(); break;
    case 'nouvelle-opportunite': main.innerHTML = viewNouvelleOpportunite(); break;
    case 'nouveau-rappel': main.innerHTML = viewNouveauRappel(); break;
    case 'nouveau-bordereau': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = await viewNouveauBordereau(); break;
    case 'nouveau-contrat': main.innerHTML = viewNouveauContrat(); initSegmentContrat(); break;
    case 'nouveau-contrat-direct': contratClientId = null; main.innerHTML = viewNouveauContrat(); initSegmentContrat(); break;
    case 'nouvelle-demande-offre': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = await viewNouvelleDemandeOffre(); bindAdresseAutocomplete({ adresseId: 'do-adresse', champUnique: true }); break;
    case 'commissions-attente':
      main.innerHTML = '<div class="loader">Actualisation des données...</div>';
      await refreshCoreData();
      main.innerHTML = viewCommissionsAttente();
      break;
    case 'rapport-finma': main.innerHTML = viewRapportFinma(); break;
    case 'production': main.innerHTML = viewProduction(); break;
    case 'opportunites': main.innerHTML = viewOpportunites(); break;
    case 'suivi': main.innerHTML = viewSuivi(); break;
    case 'rappels': main.innerHTML = viewRappels(); break;
    case 'calc-lpp': main.innerHTML = viewCalculateurLPP(); bindAdresseAutocomplete({ adresseId: 'clpp-adresse', npaVilleId: 'clpp-npa-ville' }); break;
    case 'calc-immo': main.innerHTML = viewFinancementImmo(); break;
    case 'agenda': main.innerHTML = viewAgenda(); break;
    case 'campagnes': main.innerHTML = viewCampagnes(); break;
    case 'nouveau-agent': main.innerHTML = viewNouvelAgent(); break;
    case 'bordereaux':
      main.innerHTML = '<div class="loader">Actualisation des données...</div>';
      await refreshCoreData();
      main.innerHTML = viewBordereaux();
      break;
    case 'fiche-paie': main.innerHTML = viewFichePaie(); break;
    case 'import-decompte': main.innerHTML = viewImportDecompte(); break;
    case 'commissions': main.innerHTML = viewCommissions(); break;
    case 'fiche-commission': main.innerHTML = viewFicheCommission(); break;
    case 'agents': main.innerHTML = viewAgents(); break;
    case 'audit-log': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = await viewAuditLog(); break;
    case 'contacts-compagnies': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = await viewContactsCompagnies(); break;
    case 'oz-assure': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = await viewOzAssure(); break;
    case 'oz-commissions-assurex': main.innerHTML = viewOzCommissionsAssurex(); break;
    case 'contrats-orphelins-commission': main.innerHTML = viewContratsOrphelinsCommission(); break;
    case 'rapport-finma-oz': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = await viewRapportFinmaOz(); break;
    default: main.innerHTML = viewDashboard(); mountCalendarWidget();
  }

  // ── Barre de navigation : flèche retour + lien vers la liste principale de la section ──
  if (currentView !== 'dashboard') {
    const bc = getBreadcrumbInfo(currentView);
    insertBackBar(bc);
  }
}

// Génère et insère la barre "← Retour" + fil d'Ariane en haut de #main-content.
// Utilisée automatiquement par navigate() pour toutes les vues du menu, et appelée manuellement
// par les fiches détail qui ne passent pas par navigate() (fiche client, rappel, campagne, etc.)
// afin que CETTE MÊME barre soit présente partout dans le site, sans exception.
function insertBackBar(bc) {
  const main = document.getElementById('main-content');
  if (!main) return;
  const barHtml = `<div id="nav-back-bar" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
    <button onclick="goBack()" title="Retour en arrière" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;flex-shrink:0">←</button>
    ${bc ? `<div style="font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:6px">
      <span onclick="navigate('${bc.homeId}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted">${bc.homeLabel}</span>
      <span style="color:var(--text-dim)">›</span>
      <strong style="color:var(--text)">${bc.itemLabel}</strong>
    </div>` : ''}
  </div>`;
  main.insertAdjacentHTML('afterbegin', barHtml);
}
// Home de chaque section pour le lien rapide de la barre de retour
const SECTION_HOME = {
  portefeuille: 'portefeuille',
  compta: 'commissions-attente',
  suivi: 'suivi',
  settings: 'agents',
};

function getBreadcrumbInfo(view) {
  for (const sec of SECTIONS) {
    if (sec.id === view && !sec.sub) continue;
    if (sec.sub) {
      const found = sec.sub.find(s => s.id === view);
      if (found) {
        const homeId = SECTION_HOME[sec.id] || sec.sub[0].id;
        const homeItem = sec.sub.find(s => s.id === homeId);
        return { homeId, homeLabel: homeItem ? homeItem.label : sec.label, itemLabel: found.label };
      }
    }
  }
  return null;
}

// DASHBOARD
async function changerStatutClient(clientId, nouveauStatut) {
  const r = await dbPatch('clients', clientId, { statut: nouveauStatut });
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  logAction('edit_statut_client', 'clients', clientId, nouveauStatut);
  allClients = await dbGet('clients', 'select=*');
  showClient(clientId);
}

async function basculerContratsEchus() {
  const today = new Date().toISOString().split('T')[0];
  const echus = allContrats.filter(ct =>
    ct.statut === 'actif' &&
    ct.date_echeance &&
    ct.date_echeance < today
  );
  if (!echus.length) return;
  let echecs = 0;
  for (const ct of echus) {
    const r = await dbPatch('contrats', ct.id, { statut: 'renouveler' });
    if (r && r.error) { echecs++; continue; } // ne pas mettre à jour l'état local si l'écriture a échoué
    ct.statut = 'renouveler';
  }
  console.log(`${echus.length - echecs} contrat(s) échu(s) basculé(s) en "à renouveler"${echecs ? ` — ${echecs} échec(s)` : ''}`);
}

