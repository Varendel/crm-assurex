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
      scopes: ['openid', 'profile', 'email', 'User.Read', 'Calendars.ReadWrite', 'Mail.Send', 'Mail.Read'],
    });
    msalAccessToken = result.accessToken;
    return true;
  } catch(e) {
    return false; // le compte a expiré/été révoqué → il faudra recliquer une fois
  }
}

// Vérifie qu'on a bien un token Outlook exploitable juste AVANT une action qui en a besoin,
// au lieu de se fier uniquement à la variable globale msalAccessToken. Bug réel remonté par
// Jonathan le 10.08.2026 : la demande d'offre refusait de s'enregistrer/s'envoyer en réclamant
// une connexion Outlook alors qu'il était bel et bien connecté — le token silencieux au
// chargement de la page (tryRestoreOutlookSession, lancé une seule fois au démarrage) peut ne
// pas avoir abouti à temps, ou avoir expiré en cours de session ; on retente ici une
// restauration silencieuse à la volée avant d'afficher un message d'erreur à l'utilisateur.
async function assurerTokenOutlook() {
  // Toujours retenter une restauration silencieuse, même si msalAccessToken est déjà défini :
  // un access token Microsoft Graph expire après environ 1h, et rien ne le rafraîchissait
  // proactivement — on ne s'en rendait compte qu'APRÈS l'échec (401) de l'appel réel, ce qui est
  // exactement ce que Jonathan a vécu avec la demande d'offre. acquireTokenSilent (appelé par
  // tryRestoreOutlookSession) est peu coûteux : il renvoie le token en cache s'il est encore
  // valide, ou le rafraîchit silencieusement via le refresh token sans réafficher de popup.
  return await tryRestoreOutlookSession();
}

async function loginMicrosoft() {
  try {
    if (!msalInstance) { await initMSAL(); }
    if (!msalInstance) { showError('Erreur initialisation Microsoft.'); return; }
    const result = await msalInstance.loginPopup({ scopes: ['openid', 'profile', 'email', 'User.Read', 'Calendars.ReadWrite', 'Mail.Send', 'Mail.Read'] });
    msalAccessToken = result.accessToken;
    calendarEvents = await fetchCalendarEvents();
    showError('✓ Outlook connecté — synchronisation activée.');
    if (currentView === 'agenda') navigate('agenda');
  } catch(e) { showError('Connexion Outlook annulée.'); }
}

// ═══ MICROSOFT GRAPH — AGENDA ═══
// Microsoft Graph renvoie start/end.dateTime en UTC mais SANS suffixe 'Z' (aucun en-tête
// Prefer: outlook.timezone envoyé ci-dessous) — un new Date(...) direct sur cette chaîne nue est
// alors interprété comme une heure LOCALE par le navigateur, ce qui décalait l'affichage de TOUS
// les événements Outlook d'1h (CET) ou 2h (CEST) dans l'Agenda et le widget du dashboard. On force
// donc ici, une fois pour toutes, l'interprétation UTC avant de construire le Date.
function dateEvenementGraph(dateTimeStr) {
  if (!dateTimeStr) return null;
  return new Date(/[Zz]$|[+-]\d\d:\d\d$/.test(dateTimeStr) ? dateTimeStr : dateTimeStr + 'Z');
}

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
// Date utilisée pour l'événement Outlook d'une tâche/rappel : priorité à la date PLANIFIÉE
// (le jour où on compte réellement s'en occuper — demande de Jonathan le 07.08.2026 : "les
// tâches planifiées doivent être écrites dans mon agenda"), sinon repli sur l'échéance si aucune
// date planifiée n'est renseignée.
function dateAgendaRappel(rappel) {
  return rappel.date_planifiee || rappel.date_echeance || null;
}

// ═══ CALCUL DES CRÉNEAUX LIBRES — PRISE DE RDV EN AUTONOMIE ═══
// Génère, pour les prochains jours ouvrés de l'agent (selon sa config rdv_*), la liste des
// créneaux de `dureeMin` minutes réellement libres : ni dans une plage occupée du cache Outlook
// (agent.rdv_busy_cache, rafraîchi à chaque connexion du CRM — voir rafraichirCacheDispoRdv),
// ni chevauchant un rendez_vous déjà confirmé côté CRM (évite un double-booking entre deux
// réservations prises avant la prochaine synchro Outlook). Aucun créneau avant
// rdv_delai_min_heures à partir de maintenant. Grille de génération : 15 minutes.
function calculerCreneauxLibresRdv(agentConfig, rendezVousExistants, dureeMin) {
  const joursTravail = agentConfig.rdv_jours_travail || [1, 2, 3, 4, 5];
  const [hDebut, mDebut] = (agentConfig.rdv_heure_debut || '08:00').split(':').map(Number);
  const [hFin, mFin] = (agentConfig.rdv_heure_fin || '18:00').split(':').map(Number);
  const delaiMinHeures = agentConfig.rdv_delai_min_heures ?? 24;
  const horizonJours = agentConfig.rdv_horizon_jours || 30;
  const busy = (agentConfig.rdv_busy_cache || []).map(b => ({ debut: new Date(b.debut), fin: new Date(b.fin) }))
    .concat((rendezVousExistants || []).map(r => ({ debut: new Date(r.date_heure), fin: new Date(new Date(r.date_heure).getTime() + (r.duree_min || 45) * 60000) })));

  const maintenant = new Date();
  const pasAvant = new Date(maintenant.getTime() + delaiMinHeures * 3600000);
  const GRANULARITE_MIN = 15;
  const jours = [];

  for (let i = 0; i <= horizonJours; i++) {
    const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + i);
    const isoJour = jour.getDay() === 0 ? 7 : jour.getDay(); // aligne JS (0=dimanche) sur 1=lundi..7=dimanche
    if (!joursTravail.includes(isoJour)) continue;
    const creneaux = [];
    let curseur = new Date(jour); curseur.setHours(hDebut, mDebut, 0, 0);
    const finJournee = new Date(jour); finJournee.setHours(hFin, mFin, 0, 0);
    while (curseur.getTime() + dureeMin * 60000 <= finJournee.getTime()) {
      const finCreneau = new Date(curseur.getTime() + dureeMin * 60000);
      const libre = curseur >= pasAvant && !busy.some(b => curseur < b.fin && finCreneau > b.debut);
      if (libre) creneaux.push(curseur.toTimeString().slice(0, 5));
      curseur = new Date(curseur.getTime() + GRANULARITE_MIN * 60000);
    }
    if (creneaux.length) jours.push({ date: jour.toISOString().slice(0, 10), creneaux });
  }
  return jours;
}

// Bug corrigé le 10.08.2026 : les événements n'étaient JAMAIS créés dans Outlook, même connecté
// — Microsoft Graph exige un dateTime ISO 8601 complet ("2026-08-13T00:00:00"), or on lui envoyait
// une date seule ("2026-08-13") issue telle quelle du <input type="date">, systématiquement rejetée
// (400) en silence (le fetch échouait, catché, jamais remonté à l'écran). Pour un événement toute
// la journée, Graph veut en plus une fin = lendemain minuit (fin exclusive), sans quoi l'événement
// est de durée nulle. Les deux corrigés ici, utilisés par createOutlookEventFromRappel et
// updateOutlookEventDate.
function dateTimeGraphMinuit(dateStr) {
  return `${dateStr}T00:00:00.0000000`;
}
function lendemain(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

async function createOutlookEventFromRappel(rappel) {
  const dateEvenement = dateAgendaRappel(rappel);
  if (!msalAccessToken || !dateEvenement) return null;
  try {
    const client = rappel.client_id ? allClients.find(c => c.id === rappel.client_id) : null;
    const clientLine = client ? `Client : ${client.prenom} ${client.nom}\n` : '';
    const icone = rappel.date_planifiee ? '📋' : '🔔';
    const body = {
      subject: `${icone} ${rappel.titre}`,
      isAllDay: true,
      start: { dateTime: dateTimeGraphMinuit(dateEvenement), timeZone: 'UTC' },
      end: { dateTime: dateTimeGraphMinuit(lendemain(dateEvenement)), timeZone: 'UTC' },
      body: { contentType: 'text', content: `${clientLine}Type : ${rappel.type || ''}\nUrgence : ${rappel.urgence || ''}${rappel.date_echeance && rappel.date_planifiee ? `\nÉchéance : ${fmtDate(rappel.date_echeance)}` : ''}\n\n${rappel.notes || ''}` },
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

// Déplace un événement Outlook déjà créé sur une nouvelle date (ex: la date planifiée ou
// l'échéance d'une tâche a été modifiée depuis sa fiche) — évite de laisser un événement
// "fantôme" à l'ancienne date tout en créant un doublon à la nouvelle.
async function updateOutlookEventDate(eventId, dateEvenement) {
  if (!msalAccessToken || !eventId || !dateEvenement) return false;
  try {
    const r = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isAllDay: true,
        start: { dateTime: dateTimeGraphMinuit(dateEvenement), timeZone: 'UTC' },
        end: { dateTime: dateTimeGraphMinuit(lendemain(dateEvenement)), timeZone: 'UTC' },
      }),
    });
    return r.ok;
  } catch(e) { console.error('Graph update event exception', e); return false; }
}

// Resynchronisation manuelle d'un rappel/tâche avec Outlook — bouton "📅 Absent d'Outlook" sur
// la fiche du rappel et dans la liste (demande de Jonathan le 07.08.2026 : plusieurs tâches créées
// pendant que sa session Outlook était expirée n'étaient jamais arrivées dans son agenda, en
// silence — createOutlookEventFromRappel() échoue sans rien signaler si msalAccessToken est vide).
// Permet de rattraper le coup une fois reconnecté, sans recréer le rappel.
async function synchroniserRappelOutlook(id) {
  const r = allRappels.find(x => x.id === id);
  if (!r) return;
  if (!(await assurerTokenOutlook())) { showError('Connecte-toi d\'abord à Outlook (bouton "Connecter Outlook"), puis réessaie.'); return; }
  const dateEvenement = dateAgendaRappel(r);
  if (!dateEvenement) { showError('Ce rappel n\'a ni date planifiée ni échéance — rien à synchroniser.'); return; }
  try {
    if (r.outlook_event_id) {
      const ok = await updateOutlookEventDate(r.outlook_event_id, dateEvenement);
      if (!ok) throw new Error('update échoué');
      showError('✓ Agenda Outlook mis à jour.');
    } else {
      const eventId = await createOutlookEventFromRappel(r);
      if (!eventId) throw new Error('création échouée');
      const patchR = await dbPatch('rappels', id, { outlook_event_id: eventId });
      if (patchR && patchR.error) throw new Error('enregistrement échoué');
      r.outlook_event_id = eventId;
      showError('✓ Ajouté à l\'agenda Outlook.');
    }
  } catch (e) {
    showError('Échec de la synchronisation Outlook — réessaie dans un instant.');
    return;
  }
  if (vueDetailActive && vueDetailActive.type === 'rappel' && vueDetailActive.id === id) showRappel(id);
  else if (currentView === 'rappels') navigate('rappels', { silent: true });
  else if (currentView === 'nouvelle-opportunite') navigate('nouvelle-opportunite', { silent: true });
}

// ═══ SYNC OUTLOOK — RENDEZ-VOUS ═══
// Créé l'événement Outlook d'un RDV avec une heure précise (contrairement aux rappels, qui sont
// des événements "toute la journée") — même logique UTC explicite que createOutlookEventFromRappel
// pour éviter tout décalage de fuseau côté Graph.
async function createOutlookEventFromRdv(rdv) {
  if (!msalAccessToken || !rdv.date_heure) return null;
  try {
    const client = rdv.client_id ? allClients.find(c => c.id === rdv.client_id) : null;
    const nomInvite = client ? (estEntreprise(client) ? client.nom : `${client.prenom} ${client.nom}`) : (rdv.prospect_nom || '');
    const debut = new Date(rdv.date_heure);
    const fin = new Date(debut.getTime() + (rdv.duree_min || 45) * 60000);
    const contenu = [
      nomInvite ? `Avec : ${nomInvite}` : '',
      rdv.prospect_email ? `Email : ${rdv.prospect_email}` : '',
      rdv.prospect_tel ? `Tél : ${rdv.prospect_tel}` : '',
      rdv.cree_par === 'client' ? 'Réservé en autonomie par le client.' : '',
      rdv.notes || '',
    ].filter(Boolean).join('\n');
    const body = {
      subject: `📅 ${rdv.type || 'Rendez-vous'}${nomInvite ? ' — ' + nomInvite : ''}`,
      isAllDay: false,
      start: { dateTime: debut.toISOString().split('.')[0], timeZone: 'UTC' },
      end: { dateTime: fin.toISOString().split('.')[0], timeZone: 'UTC' },
      body: { contentType: 'text', content: contenu },
    };
    const r = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) { console.error('Graph create rdv event error', r.status); return null; }
    const data = await r.json();
    return data.id || null;
  } catch(e) { console.error('Graph create rdv event exception', e); return null; }
}

// Resynchronisation manuelle d'un RDV — bouton "📅" dans la vue Rendez-vous.
async function synchroniserRdvOutlook(id) {
  const r = allRendezVous.find(x => x.id === id);
  if (!r) return;
  if (!(await assurerTokenOutlook())) { showError('Connecte-toi d\'abord à Outlook (bouton "Connecter Outlook"), puis réessaie.'); return; }
  try {
    const eventId = await createOutlookEventFromRdv(r);
    if (!eventId) throw new Error('création échouée');
    const patchR = await dbPatch('rendez_vous', id, { outlook_event_id: eventId, outlook_sync_le: new Date().toISOString() });
    if (patchR && patchR.error) throw new Error('enregistrement échoué');
    r.outlook_event_id = eventId;
    showError('✓ Ajouté à l\'agenda Outlook.');
  } catch (e) {
    showError('Échec de la synchronisation Outlook — réessaie dans un instant.');
    return;
  }
  if (currentView === 'rendez-vous') navigate('rendez-vous', { silent: true });
}

// Appelée automatiquement à la connexion (si Outlook est connecté) : pousse tout RDV confirmé pas
// encore synchronisé vers l'agenda Outlook, et rafraîchit le cache des créneaux occupés de
// l'agent courant (agents.rdv_busy_cache) pour que les prochaines réservations publiques restent
// à jour. Entièrement silencieuse — ne bloque jamais le chargement du CRM, pas d'erreur affichée
// si Outlook n'est pas connecté (cas normal, pas une panne). Limite connue : fetchCalendarEvents
// ne couvre que ~2 mois glissants ; un agent configurant un horizon de réservation plus large
// verrait ses créneaux au-delà non vérifiés contre son agenda Outlook réel.
async function synchroniserRdvEtDispoOutlook() {
  if (!(await assurerTokenOutlook())) return;
  const aSynchroniser = (allRendezVous || []).filter(r => r.statut === 'confirme' && !r.outlook_event_id);
  for (const r of aSynchroniser) {
    try {
      const eventId = await createOutlookEventFromRdv(r);
      if (eventId) { await dbPatch('rendez_vous', r.id, { outlook_event_id: eventId, outlook_sync_le: new Date().toISOString() }); r.outlook_event_id = eventId; }
    } catch(e) { /* on retentera à la prochaine connexion */ }
  }

  const monAgent = allAgents.find(a => a.email === currentUser.email);
  if (!monAgent || !monAgent.rdv_actif) return;
  try {
    const events = await fetchCalendarEvents();
    const busy = (events || []).filter(e => !e.isCancelled && e.start && e.end)
      .map(e => ({ debut: e.start.dateTime + 'Z', fin: e.end.dateTime + 'Z' }));
    const maj = new Date().toISOString();
    await dbPatch('agents', monAgent.id, { rdv_busy_cache: busy, rdv_busy_cache_maj_le: maj });
    monAgent.rdv_busy_cache = busy;
    monAgent.rdv_busy_cache_maj_le = maj;
  } catch(e) { /* pas grave, retentera à la prochaine connexion */ }
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
  const r = await dbDelete('tache_etapes', etapeId);
  if (r && r.error) { showError('Erreur lors de la suppression de l\u2019étape : ' + errMsg(r)); return; }
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
    const start = ev.start && ev.start.dateTime ? dateEvenementGraph(ev.start.dateTime) : null;
    return start && isSameDay(start, d);
  }).sort((a,b) => dateEvenementGraph(a.start.dateTime) - dateEvenementGraph(b.start.dateTime));
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
  if (!(await assurerTokenOutlook())) {
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
        const start = dateEvenementGraph(ev.start.dateTime);
        const end = ev.end && ev.end.dateTime ? dateEvenementGraph(ev.end.dateTime) : null;
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
  const ecranLogin = document.getElementById('login-screen');
  if (ecranLogin) ecranLogin.classList.add('lp-go'); // Rex s'élance dans le paysage pendant la connexion
  const res = await supabaseAuthLogin(email, pwd);
  if (btn) { btn.textContent = 'Se connecter'; btn.disabled = false; }
  if (res.error) { if (ecranLogin) ecranLogin.classList.remove('lp-go'); showError('Email ou mot de passe incorrect.'); return; }
  document.getElementById('login-error').classList.add('hidden');

  // Propose au navigateur d'enregistrer les identifiants (SPA = pas de rechargement de page,
  // donc on déclenche explicitement la sauvegarde via l'API Credential Management)
  if (window.PasswordCredential) {
    try {
      const cred = new PasswordCredential({ id: email, password: pwd, name: email });
      await navigator.credentials.store(cred);
    } catch(e) { /* ignore si non supporté */ }
  }

  // L'animation de Rex (course puis sprint hors de l'écran) va jusqu'au bout avant d'ouvrir le CRM
  // (demande de Jonathan, 20.09.2026). Les données se chargent pendant ce temps, rien n'est perdu.
  await attendreFinAnimationRex(ecranLogin);

  // Compte client (espace client, js/48) : jamais le CRM, seulement son propre espace
  if (typeof ecAccesDeLEmail === 'function') {
    const acces = await ecAccesDeLEmail(email);
    if (acces) { await ecEntrerEspaceClient(acces, email); return; }
  }

  const userData = USER_ROLES[email] || { prenom: email.split('@')[0], nom: '', role: 'apporteur', taux: 50 };
  enterApp({ id: email, prenom: userData.prenom, nom: userData.nom, email, role: userData.role, taux: userData.taux });
}

// Attend la fin du sprint de Rex sur l'écran de connexion (au plus 2 s, et pas d'attente du tout
// si l'animation est désactivée par le système ou si l'écran n'existe pas).
function attendreFinAnimationRex(ecran) {
  const rex = ecran && ecran.querySelector('.lp-rex');
  const reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!rex || reduit) return Promise.resolve();
  return new Promise(resolve => {
    let fini = false;
    const terminer = () => { if (fini) return; fini = true; rex.removeEventListener('animationend', surFin); resolve(); };
    const surFin = e => { if (e.animationName === 'lp-sprint') terminer(); };
    rex.addEventListener('animationend', surFin);
    setTimeout(terminer, 1300); // filet de sécurité : la connexion n'attend jamais plus de 1,3 s
  });
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
  allRendezVous = await dbGet('rendez_vous', 'select=*&order=date_heure.asc').catch(() => []);
  allCampagnesPersonnalisees = (await dbGet('campagnes_personnalisees', 'select=*&order=created_at.asc').catch(() => [])).filter(c => c.actif !== false).map(normaliserCampagnePersonnalisee);

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
  synchroniserRdvEtDispoOutlook(); // arrière-plan, non bloquant — voir sa doc plus haut

  // Rattrapage des mandats/résiliations signés pendant que personne ne regardait l'écran (voir
  // recupererSignaturesEnAttente, js/05) — corrige le bug du 17.09.2026 où une signature reçue
  // sur le téléphone du client pouvait ne jamais s'enregistrer si l'onglet du PC s'était mis en
  // veille entre-temps. Un premier passage au login/chargement, puis un passage toutes les 2
  // minutes tant que le CRM reste ouvert, pour rattraper rapidement même sans recharger la page.
  recupererSignaturesEnAttente().catch(e => console.error('Rattrapage signatures (initial) :', e));
  clearInterval(window._pollingSignaturesEnAttente);
  window._pollingSignaturesEnAttente = setInterval(() => {
    recupererSignaturesEnAttente().catch(e => console.error('Rattrapage signatures (périodique) :', e));
  }, 120000);
  // Ouverture directe d'une fiche client si l'onglet a été ouvert via Ctrl/Cmd+clic (deep-link ?client=ID)
  const paramsUrl = new URLSearchParams(window.location.search);
  const clientDeepLink = paramsUrl.get('client');
  if (clientDeepLink && allClients.some(c => c.id === clientDeepLink)) {
    await showClient(clientDeepLink);
  } else {
    navigate(user.role === 'rh' ? 'portefeuille' : 'dashboard');
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
// Rubriques réorganisées par métier (19.09.2026) : Clients · Ventes · Conseil · Agenda · Finances ·
// Paramètres — une icône par entrée pour se repérer d'un coup d'œil. Les droits RH (rhAllowed) et
// les entrées réservées (staff) sont inchangés.
const SECTIONS = [
  { id: 'dashboard-solo', label: 'Tableau de bord', icon: '📊', solo: true, target: 'dashboard' },
  { id: 'pipeline-solo', label: 'Pipeline', icon: '🎯', solo: true, target: 'opportunites', rhAllowed: true },
  { id: 'oz-assure-solo', label: 'OZ Assure', solo: true, logo: true, target: 'oz-assure', signataireOnly: true },
  // « groupe » : sous-menu repliable à l'intérieur d'une section (19.09.2026, demande de Jonathan)
  { id: 'clients', label: 'Clients', icon: '👥', sub: [
    { id: 'portefeuille', icon: '👥', label: 'Tous les clients', staff: true, rhAllowed: true, groupe: 'Clients' },
    { id: 'clients-prives', icon: '🙂', label: 'Clients privés', rhAllowed: true, groupe: 'Clients' },
    { id: 'clients-entreprises', icon: '🏢', label: 'Entreprises', rhAllowed: true, groupe: 'Clients' },
    { id: 'clients-oz', icon: '🔹', label: 'Clients OZ Assure', staff: true, groupe: 'Clients' },
    { id: 'marquage-entites', icon: '🏷️', label: 'Marquage des entités', staff: true, groupe: 'Clients' },
    { id: 'courriers', icon: '📨', label: 'Courriers clients', staff: true, groupe: 'Clients' },
    { id: 'tous-contrats', icon: '📄', label: 'Tous les contrats', rhAllowed: true, groupe: 'Contrats' },
    { id: 'volume-primes', icon: '📦', label: 'Volume de primes', staff: true, rhAllowed: true, groupe: 'Contrats' },
    { id: 'recherche-vehicules', icon: '🚗', label: 'Recherche véhicules', rhAllowed: true, groupe: 'Contrats' },
  ]},
  { id: 'vente', label: 'Ventes', icon: '🚀', sub: [
    { id: 'suivi', icon: '📋', label: 'Suivi des affaires', groupe: 'Affaires' },
    { id: 'nouvelle-demande-offre', icon: '📝', label: 'Demande d\'offre', groupe: 'Affaires' },
    { id: 'nouveau-contrat-direct', icon: '➕', label: 'Nouveau contrat', groupe: 'Affaires' },
    { id: 'renouvellements', icon: '🔁', label: 'Renouvellements', groupe: 'Portefeuille' },
    { id: 'relances-lamal', icon: '🩺', label: 'Relances LAMal', groupe: 'Portefeuille' },
    { id: 'equipement', icon: '🧩', label: 'Équipement & ventes croisées', groupe: 'Portefeuille' },
    { id: 'sources', icon: '🧭', label: 'Sources des clients', groupe: 'Marketing' },
    { id: 'campagnes', icon: '📣', label: 'Campagnes', groupe: 'Marketing' },
  ]},
  { id: 'conseil-section', label: 'Conseil', icon: '💼', sub: [
    { id: 'conseil', icon: '💼', label: 'Conseil financier' },
    { id: 'analyse-prevoyance', icon: '🧮', label: 'Analyse de prévoyance' },
    { id: 'calc-immo', icon: '🏠', label: 'Financement immobilier' },
  ]},
  { id: 'organisation', label: 'Agenda', icon: '🗓️', sub: [
    { id: 'rappels', icon: '✅', label: 'Tâches & rappels', rhAllowed: true },
    { id: 'agenda', icon: '🗓️', label: 'Agenda', rhAllowed: true },
    { id: 'rendez-vous', icon: '📅', label: 'Rendez-vous', rhAllowed: true },
  ]},
  { id: 'compta', label: 'Finances', icon: '💰', sub: [
    { id: 'suivi-financier', icon: '🧭', label: 'Cockpit financier', groupe: 'Pilotage' },
    { id: 'tresorerie', icon: '📈', label: 'Plan de trésorerie', groupe: 'Pilotage' },
    { id: 'production', icon: '🏭', label: 'Production par période', staff: true, groupe: 'Pilotage' },
    { id: 'import-decompte', icon: '📥', label: 'Importer un décompte', groupe: 'Commissions' },
    { id: 'bordereaux', icon: '🧾', label: 'Bordereaux', groupe: 'Commissions' },
    { id: 'commissions-attente', icon: '💸', label: 'Toutes les commissions', groupe: 'Commissions' },
    { id: 'commissions', icon: '🧮', label: 'Commissions (vue interne)', staff: true, groupe: 'Commissions' },
    { id: 'factures', icon: '🧾', label: 'Factures QR', groupe: 'Facturation' },
    { id: 'caution', icon: '🔒', label: 'Comptes de caution', groupe: 'Facturation' },
    { id: 'fiche-paie', icon: '🧑‍💼', label: 'Fiche de paie (agents)', groupe: 'Administration' },
    { id: 'rapport-finma', icon: '🏛️', label: 'Rapport FINMA', groupe: 'Administration' },
  ]},
  { id: 'settings', label: 'Paramètres', icon: '⚙️', sub: [
    { id: 'agents', icon: '🧑‍🤝‍🧑', label: 'Agents' },
    { id: 'contacts-compagnies', icon: '🏢', label: 'Contacts compagnies' },
    { id: 'audit-log', icon: '🔍', label: 'Journal d\'audit' },
    { id: 'apparence', icon: '🎨', label: 'Apparence', rhAllowed: true },
  ]},
];

function renderSidebar() {
  // Nav
  const rh = estRoleRH();
  let nav = '';
  SECTIONS.forEach(sec => {
    if (sec.signataireOnly && (!currentUser || currentUser.role !== 'signataire')) return;
    if (sec.solo) {
      // Dashboard/OZ Assure : hors périmètre de la session RH. Pipeline reste visible (rhAllowed)
      // mais s'affiche en lecture seule et sans chiffres — voir rhMode dans js/06.
      if (rh && !sec.rhAllowed) return;
      const active = currentView === sec.target;
      if (sec.logo) {
        nav += `<button class="nav-solo-btn nav-solo-logo ${active ? 'active' : ''}" onclick="navigate('${sec.target}')" title="OZ Assure">
          ${OZASSURE_LOGO_SVG}
        </button>`;
        return;
      }
      nav += `<button class="nav-solo-btn ${active ? 'active' : ''}" onclick="navigate('${sec.target}')">
        <span class="nav-ico" aria-hidden="true">${sec.icon || '•'}</span><span class="nav-lib">${sec.label}</span>
      </button>`;
      return;
    }
    // Session RH : liste blanche stricte (RH_VUES_AUTORISEES) — un groupe entier (ex: Comptabilité,
    // Paramètres) disparaît si aucun de ses sous-éléments n'est autorisé.
    const subVisibles = rh ? sec.sub.filter(s => s.rhAllowed) : sec.sub;
    if (rh && !subVisibles.length) return;
    // Un dossier de conseil ouvert allume l'entrée « Conseil financier » du menu
    const vueMenu = currentView === 'dossier-conseil' ? 'conseil' : currentView;
    const isActive = subVisibles.some(s => s.id === vueMenu);
    nav += `<button class="nav-section-btn ${isActive ? 'active' : ''} ${openSections[sec.id] ? 'ouverte' : ''}" data-sec="${sec.id}" onclick="toggleSection('${sec.id}')" aria-expanded="${!!openSections[sec.id]}">
      <span class="nav-lib">${sec.label}</span>
      <span class="arrow" aria-hidden="true">›</span>
    </button>`;
    if (openSections[sec.id]) {
      // Sous-menus (groupe) : en-tête repliable ; un groupe contenant la vue active reste ouvert
      let groupeCourant = null;
      subVisibles.forEach(s => {
        const active = s.id === vueMenu;
        if (s.groupe && s.groupe !== groupeCourant) {
          groupeCourant = s.groupe;
          const cle = sec.id + '|' + s.groupe;
          const contientActif = subVisibles.some(x => x.groupe === s.groupe && x.id === vueMenu);
          const ferme = window._navGroupesFermes[cle] && !contientActif;
          nav += `<button type="button" class="nav-groupe ${ferme ? 'ferme' : ''}" onclick="event.stopPropagation();basculerGroupeNav('${cle}')" aria-expanded="${!ferme}"><span>${s.groupe}</span><span class="nav-groupe-fleche" aria-hidden="true">▾</span></button>`;
        }
        if (s.groupe && window._navGroupesFermes[sec.id + '|' + s.groupe] && !subVisibles.some(x => x.groupe === s.groupe && x.id === vueMenu)) return;
        let badgeHtml = '';
        if (s.id === 'rappels') {
          const monAgent = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
          const mesTaches = (allRappels || []).filter(r => r.statut === 'ouvert' && monAgent && r.apporteur_id === monAgent.id);
          if (mesTaches.length) badgeHtml = `<span class="nav-compteur">${mesTaches.length}</span>`;
        }
        // staff : vues réservées (anciennement en orange) — repérées par un petit point, plus discret
        nav += `<button class="nav-item ${active ? 'active' : ''} ${s.staff ? 'staff' : ''}" data-sec="${sec.id}" onclick="navigate('${s.id}')" ${s.staff ? 'title="Vue réservée"' : ''}>
          <span class="nav-ico" aria-hidden="true">${s.icon || '•'}</span><span class="nav-lib">${s.label}</span>${badgeHtml}
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

// Sous-menus repliables (état mémorisé sur ce navigateur)
window._navGroupesFermes = (() => { try { return JSON.parse(localStorage.getItem('rex-nav-groupes-fermes') || '{}') || {}; } catch (e) { return {}; } })();
function basculerGroupeNav(cle) {
  window._navGroupesFermes[cle] = !window._navGroupesFermes[cle];
  try { localStorage.setItem('rex-nav-groupes-fermes', JSON.stringify(window._navGroupesFermes)); } catch (e) {}
  renderSidebar();
}

let navHistory = [];
let vueDetailActive = null; // { type: 'client'|'rappel'|'campagne', id } — quelle fiche détail est affichée, si applicable

// Capture l'état actuellement affiché, sous une forme qui permet de le restaurer fidèlement
// (une fiche détail précise, pas juste "on était sur la page Rappels" en général).
function capturerEtatActuel() {
  if (vueDetailActive) return vueDetailActive;
  // Écrans d'édition "pleine page" (opportunité, demande d'offre) : pas gérés par
  // vueDetailActive, mais on a quand même besoin de mémoriser QUEL enregistrement était ouvert,
  // sans quoi le retour arrière rouvrirait un formulaire vide au lieu de celui en cours d'édition.
  if (currentView === 'nouvelle-opportunite' && opportuniteEnEditionId) {
    return { type: 'opportunite', id: opportuniteEnEditionId };
  }
  if (currentView === 'nouvelle-demande-offre' && demandeOffreActiveId) {
    return { type: 'demande-offre', id: demandeOffreActiveId };
  }
  return { type: 'view', view: currentView };
}

// Restaure un état précédemment capturé — redirige vers la bonne fiche détail si applicable,
// ou vers la vue normale sinon.
async function restaurerEtat(etat) {
  if (!etat) { await navigate('dashboard'); return; }
  if (etat.type === 'client') { await showClient(etat.id); return; }
  if (etat.type === 'rappel') { showRappel(etat.id); return; }
  if (etat.type === 'campagne') { showCampagne(etat.id); return; }
  if (etat.type === 'conseil' && typeof ouvrirDossierConseil === 'function') { await ouvrirDossierConseil(etat.id, { sansHistorique: true }); return; }
  if (etat.type === 'opportunite') {
    opportuniteEnEditionId = etat.id;
    currentView = 'nouvelle-opportunite';
    renderSidebar();
    await renderView();
    return;
  }
  if (etat.type === 'demande-offre') {
    demandeOffreEnEditionId = etat.id;
    currentView = 'nouvelle-demande-offre';
    renderSidebar();
    await renderView();
    return;
  }
  currentView = etat.view;
  renderSidebar();
  await renderView();
}

// Recharge les tables financières critiques depuis Supabase — garantit que le
// Dashboard reflète TOUJOURS l'état réel de la base, y compris après une
// modification faite directement en SQL (hors de l'interface du CRM).
async function refreshCoreData() {
  const [contrats, commissions, bordereaux, clients, fiches, tranches] = await Promise.all([
    dbGet('contrats', 'select=*'),
    dbGet('commissions_attente', 'select=*'),
    dbGet('bordereaux', 'select=*'),
    dbGet('clients', 'select=*'),
    dbGet('fiches_paie', 'select=*'),
    dbGet('commission_tranches', 'annule=eq.false&select=*'),
  ]);
  allContrats = contrats || allContrats;
  allCommissionsAttente = commissions || allCommissionsAttente;
  allBordereaux = bordereaux || allBordereaux;
  allClients = clients || allClients;
  allFichesPaie = fiches || allFichesPaie;
  if (Array.isArray(tranches)) allCommissionTranches = tranches; // versements partiels (reste attendu, encaissé)
  // Gestion de l'année suivante créée à l'approche de chaque échéance de facturation (js/19) —
  // seulement sur des données fraîches, pour ne jamais créer de doublon à partir d'un état périmé
  if (Array.isArray(commissions) && Array.isArray(contrats) && typeof assurerGestionAnnuelle === 'function') {
    try { await assurerGestionAnnuelle(); } catch (e) { /* jamais bloquant */ }
  }
}

async function navigate(view, opts) {
  // Garde-fou session RH (liste blanche RH_VUES_AUTORISEES) — en plus du filtrage de la sidebar,
  // pour bloquer aussi les liens/redirections directes vers une vue financière hors périmètre.
  if (estRoleRH() && !RH_VUES_AUTORISEES.has(view)) {
    view = 'portefeuille';
  }
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
  if (typeof rexMajTabbar === 'function') rexMajTabbar(); // barre d'onglets iPhone (js/28)
  toggleSidebarMobile(false); // referme le tiroir mobile après un choix dans le menu
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
  const message = (r.detail && typeof r.detail === 'object') ? (r.detail.message || r.detail.hint || JSON.stringify(r.detail)) : (r.detail || r.status || 'Erreur inconnue');
  // Code Postgres 42501 = violation de policy RLS (accès refusé). Dans ce CRM ça n'arrive
  // quasiment jamais pour un vrai refus métier — presque toujours parce que la session a expiré
  // en cours d'usage et que l'appel est silencieusement retombé sur la clé publique anonyme, qui
  // n'a le droit d'écrire nulle part dans l'app (sauf sur les quelques pages publiques dédiées :
  // signature à distance, prise de RDV). Repéré par Jonathan le 31.08.2026 : "impossible de créer
  // un nouveau client" avec ce code alors qu'il était bien connecté au départ — le message d'erreur
  // brut de Postgres ne disait rien de tout ça. Détecté ici une bonne fois pour toutes plutôt que
  // dans chaque écran séparément.
  const code = (r.detail && typeof r.detail === 'object') ? r.detail.code : null;
  if (code === '42501' || r.status === 401) {
    return 'Session expirée — recharge la page et reconnecte-toi, puis réessaie. (' + message + ')';
  }
  return message;
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
  // Fond bleu nuit flouté (19.09.2026) plutôt qu'un noir opaque : plus moderne, le contexte reste perceptible
  modal.className = 'rex-modale';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(6,20,44,${Math.min(opacite, 0.55)});backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:${padding};${overflowY ? 'overflow-y:auto' : ''}`;
  modal.innerHTML = contenuHtml;
  document.body.appendChild(modal);
  return modal;
}

// La bande noire contenant le logo Assurex, répétée dans les documents imprimés
// (bilan de prévoyance, financement immobilier, mandat de courtage). Le fond noir est
// directement intégré dans l'image (et non posé en CSS background) afin que le bandeau
// s'imprime toujours correctement, même quand l'option "Graphiques d'arrière-plan" du
// navigateur est décochée à l'impression (c'était la cause du logo invisible/pâle chez
// certains collègues alors qu'il s'affichait bien chez Jonathan). Seule cette partie est
// réellement identique d'un document à l'autre — les coordonnées et infos client qui l'entourent
// diffèrent légitimement selon le document, donc elles ne sont volontairement pas mutualisées ici.
const ASSUREX_LOGO_BADGE_PNG = "data:image/png;base64,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E+fPn5dg0uVySesSFCHl0aNHlbyPysvq306dOjVp0mTNmjXbt2+XbdOdObTh8/mOHj169OjRY8eOZWVl+S9BxqqpIQGbNYnEkzExMcOHD7e2dkP+pNBjGEkuvfrqq48++qjNGCN4yYjAli1bmjVrFsIzMGXoPy0trVWrVhs2bLjhhhtslrj02apWrbpmzZpGjRqdO3eO+asgpAwp8pLHx8e3adPGTorS4/G8+eabv/322z9FehJGzpw58+mnn65Zs6ad+fTjxo3bsGFD8GZR5Jf//vvvUkHntYchtbCqqs2aNWvWrFlQXO/Zs2f37Nnz5Zdfrl69eseOHfKEBMWgwIEDB6z9oX9Q9rHHHnvsscecX0yaph05cmTHjh1r1qxZs2aNpGclNiZjifwgMxdC+xplXobP54uLi1u8eHG1atWsTdKRNuLs2bOKA+adFitWrESJEmH+9IbDHZA+4ZkzZxITEzds2FC1alWbKyFlG8gbb7xx5cqVTZo0ycjIIKoEQoTki1wu1+bNm03T1DTNzDtd13VdP3PmTFxcnHzgPw4VeDyKorRr187yd/n/sHPnzsqlrVCC8bYrihIREbF//365gRbugxz463O8y65O1/X169e3adPG38A4djmoPF2333673G1rj6v0Jp3vsgs8d+7ce++9d8stt+S+Fc6MSRRFqVy5clpamoVikoezdevWwVWZyFVv2bLFQkXq8/lM03zjjTeCt/4MOrGxsU888cTvv/9uueGTBzsjI0O29inEOFwa8ffee88wjJycHCMsSYW5ceNGJcjXxOapKaxVq9apU6cs91j+Wgt9+umnbrdbuqDUEsjHWotbUGA1haZpHTp0uOuuuywPPsmk1gkTJpw+ffrfl1zLVyxbtmzTpk333HOPtW+UibWjRo1atmxZVlZWMJ6lIXcsJyfn22+/ve666ywPWgdLj1AKSHpFHo8nISEhISFh48aNQ4cO3bRpk79MHThAqyjKzz//fPz48auvvtrydLVgmRuWe3ue2NjYxx9/vFOnTnPnzh0+fPiJEydY94LARsWGYdx9990tWrSwvMe48xUpUqR27dp169YtV66ccinnY+3ddLlcR48e/fPPPxUHZClDftfTK7z8MLle6ar98ssvrVu3/uyzz4oXL27znZV54M2bN58/f/4jjzzCXBggFKpFVVWLFi36yy+/SMrL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5bZv3759xowZoX3krqZp58+fP378+K5du3777bdz587561nnZ1TkGZg3b1716tVDdQd/0zRVVc3MzExOTv79999//vnn/fv3Z2dn+zsr0k0JvQuXi5K837lz55YvX758+XLpqVSuXPn6668vX758qVKlIiIiSpcuXShvqMvlunjxYnp6enp6ekpKyoEDB/bv33/o0KGUlJTcvckgLSCpA7/77jsLdaAkK/bt26cU0n4hliuTnj179uvXT146aw9tREREjRo1du7cWbgFN2fOnO3btxuGwbkml5Wyy+XKzs7OyMgomIdTpqo1aNBgyZIl0m+xExFJSOl2u7t167Z69WpnzmKTuWmHDx9u1KjRfffdJ5uT2f/M4sWLx8TE2LyB/3Jj82+uk5QRWxuikANULgcFTLZTorAczu12O+Rc9QKrPdxud7CM78pLRFceoKJWFKVWrVqnT5+2vEPhX/NdAwYMUBTF6/U6vBoMojJq27ZtfifGly1bppCl/KcmnlvwL70f+++SjEWFZPVqU0GO9AT73kh5CvUvW58Wbs9VUBRT7vYpnEc9cs99csKtCOHSsbnTTNANzAekzndCRRpWQ04WFEByT2aZlS9fftOmTddee63k7ux8oM/n83q9EydOHDhwYFDsshHwpVuyrUbAX3nTNCtVqtS4ceP8S4G6XK4DBw5s2rSJtaAAAAAAriiaUhSlePHiP/74Y0AW6Ul+cs6cOYqiMJMIAAAAAEKW5LojIiLWr18fkLM05BNWrlwpeT/iyfwoMk8+C4fpVAAAAAACEJxI8PDBBx8EMJ785ptvoqKiwmExDgAAAACEL9l/ZfLkyQGJJ2XG7L59++RkL+JJAAAAAAjxePKll14yTTMnJycg8eTx48erVaumhMdGdAAAAAAQ1vFkz549JT8pG/9apuu6YRjnz5+vV6+ewuETAAAAABDy8WTbtm0Nw9A0zWY8aRiGruvZ2dmNGzcmngQAAACA0I8n77333qysLDk70WY8KVNeH3roIeJJAAAAAAhlssSxTp06586dkwmrAdni9b///S/xJAAAAACEfjxZqVKlI0eO+DfUsUM29Xn55ZeJJwEAAAAglMmRHrGxsT/99FNA4knJT7711lsST7pcLm4yAAAAAIQgl8ulqmqRIkU2btwYkCMo5RM+/PBDRVHcbjfxJAAAAACEbDwpU14//PDDAMaTX375ZWRkpKqqkv8EAAAAAIRgPCmrHN98803/6kc7ZMbszp07Y2JilEvzaQEAAAAAIcjr9SqKMmrUqIDkJyWePHToUKVKlYgnAQAAACCUSX7y2WefDUg8KSeOnDlz5vrrr1cu7R8LAAAAAAjZePKhhx6S7KJhGDbjSV3XMzIyGjZsSDwJAAAAAKEfTyYkJOTk5Oi6bjOeNAxDgtLWrVsrHEEJAAAAACFMUoj16tW7cOGCf8KqnXhSJs0+8cQTxJMAAAAAEPrxZLVq1Y4dO2Y/nvQvwkxKSiKeBAAAAIBQJluwlilTZt++ff4NWu2QQ0dee+014kkAAAAACGUul8vlckVFRX377bcB2eJVPuH999+XeNLlcnGTAQAAACA040lVVV0u14oVKwIYT65evdrtdssnc5MBAAAAIGRDSkVR3n77bdM0MzMzffZkZ2ebprl169bo6GhJfnKHAQAAACA0qaoaERExc+ZMM3B+/fXXsmXLKpfWZwIQjK8AAAAgtDq4LpdpmiVKlGjfvn1WVpb9pKJhGKqqbty48ejRo6qqGobBTQYAAAAA5DlY5SYAl78X3AIAAACEZPgnJ1IGimEY5CcBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACc5/8B16QobdMRdVMAAAAASUVORK5CYII=";
const EX_GROUP_LOGO_BADGE_PNG = "data:image/png;base64,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cngGayxnt9sllps7d64MBATxcLVk7HQ6nadPn27VqtWaNWuI4vxTxo4ePRoXF2e4XtvtdlVV69atO3jwYKvNsXtjucjIyMWLF+efSnTgwIFmzZrt2rUrICqRXPPWrVubN2+ekJAg1xzEIbeu65LXas2aNS1btjx79iwJTkAgB1iILOPp27fv2LFjzS83ksmZK1euREdH//7773nS4suLdv/+/e3bt79+/br5+UB5VTdp0mTp0qUSxXFa6O26oaqqPv/88//+97/dbrfEwMHXxdE0zWazOZ3OjRs3NmrUaPv27URxfitjDodj8uTJZhbgSRA4evToihUrWm2OXSrR9evXu3Xr9sYbb8j3DcpKpKqqVKIFCxY0adLk119/DaDZLW/8+eijjy5btszpdMou2aCMtOU89PHjx7dr1+7KlSuy44C2CARygFWiOFVVO3XqNHPmTBmfNnnwt6Iobre7U6dOv/zySx4ukpEX7Y8//ti5c2eJ4kz2hCTcbd269bx586SzRSz3l91QRVHsdvv777/fpEmTnTt3ers4wdET1TRN+tbp6ekjRox46qmnTp8+zdEL/uxZKoqSlZX10ksvyT8bKFeSEbFQoULvv/++RY6cvqkSyY7liRMnPvbYY3v37g2mSiSZXaRFvXDhwgsvvNCjR4/U1NSACw9k0PPSpUudO3fu16/fpUuXnE6n99sFRwgnkfbhw4cjIyNHjRolbz1WVAL5nUz4tG3bVloKD/5fbrfb4/GMHDlSXnW5HcUpitK8efOMjAzpoZq5cl3X5YHGxsb64eLv/gt2795dCpvJL+h9Oh9//LF8uOEuoEwC1KhRI7cLUlxcXJ48C/mLTqdzyJAh58+f954e7pOn4H+apsn9FEuXLq1Zs6ZyI0WQdQZlFEUZPny49+nfPam5mzZt8hZO679EPv74YwPf9Kav3KZNG+8HWvNrhoaGDh8+PDExMZgqkaqqs2bNKleunHzNwB0U87YAlStXnjt3rve5uN1uydIc0I8pJSXlrbfeKliwoGXryB3e+DltGeR5HTx40Ptk6a4DBHKWDuTkQdSpU+fSpUveVsz8lffv319RFJO77HxIruTll1+WK/RVLPf222+beUBBH8hljwdKly4dFxd39uzZ7Nemqqr5sYNcpeu69GmyV434+PiWLVtmr0FW68Tkh0BOes9FihQ5ffq0PCZj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";

function genererBadgeLogoAssurex(hauteurLogo = 34, padding = '14px 18px', display = 'flex') {
  const padMatch = /^([0-9.]+)px\s+([0-9.]+)px$/.exec(String(padding).trim());
  const padVertical = padMatch ? parseFloat(padMatch[1]) : 14;
  const hauteurBandeau = hauteurLogo + (padVertical * 2);
  return `<div style="display:${display};align-items:center">
    <img src="${ASSUREX_LOGO_BADGE_PNG}" alt="Assurex" style="height:${hauteurBandeau}px;width:auto;display:block;border-radius:8px"/>
  </div>`;
}

// Même principe que genererBadgeLogoAssurex() ci-dessus (fond noir intégré à l'image, pour un
// rendu identique à l'écran et à l'impression) mais pour le logo EX.GROUP — utilisé à droite de
// l'en-tête du mandat de courtage, en miroir du badge Assurex à gauche.
function genererBadgeExGroup(hauteurLogo = 34, padding = '14px 18px', display = 'flex') {
  const padMatch = /^([0-9.]+)px\s+([0-9.]+)px$/.exec(String(padding).trim());
  const padVertical = padMatch ? parseFloat(padMatch[1]) : 14;
  const hauteurBandeau = hauteurLogo + (padVertical * 2);
  return `<div style="display:${display};align-items:center">
    <img src="${EX_GROUP_LOGO_BADGE_PNG}" alt="EX.GROUP" style="height:${hauteurBandeau}px;width:auto;display:block;border-radius:8px"/>
  </div>`;
}

function badge(label, color) {
  return `<span class="badge" style="background:${color}15;color:${color};border:1px solid ${color}30">${label}</span>`;
}

// Badge visuel distinct pour la nature d'une commission — icône + couleur, reconnaissable
// d'un coup d'œil sans avoir à lire le texte, à apposer partout où une commission s'affiche.
function badgeNatureCommission(nature) {
  const estGestion = nature === 'gestion';
  const couleur = estGestion ? '#60a5fa' : '#a78bfa';
  const icone = estGestion ? '🔄' : '🆕';
  const label = estGestion ? 'Gestion' : 'Acquisition';
  return `<span title="Commission de ${label.toLowerCase()}" style="display:inline-flex;align-items:center;gap:4px;background:${couleur}18;color:${couleur};border:1px solid ${couleur}40;border-radius:7px;padding:2px 8px 2px 6px;font-size:10.5px;font-weight:800;white-space:nowrap"><span style="font-size:12px;line-height:1">${icone}</span>${label}</span>`;
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

// Export CSV générique — utilisé par "Tous les contrats" et "Toutes les commissions" (et
// réutilisable ailleurs). Séparateur point-virgule + BOM UTF-8 : ouverture directe dans Excel
// (locale FR/CH) sans casser les accents ni éclater les colonnes sur les virgules des montants.
function exporterCsv(nomFichier, entetes, lignes) {
  function echapper(v) {
    const s = (v === null || v === undefined) ? '' : String(v);
    if (/[;"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  const contenu = [entetes, ...lignes].map(l => l.map(echapper).join(';')).join(String.fromCharCode(13,10));
  const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier.endsWith('.csv') ? nomFichier : nomFichier + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function infoBlock(label, value, extra, copiable) {
  const texte = (value === undefined || value === null || value === '') ? '' : String(value);
  const copyBtn = (copiable && texte) ? `<button type="button" onclick="copierValeurBouton(this)" title="Copier" style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:11px;margin-left:6px;padding:1px 4px;border-radius:4px;vertical-align:middle" onmouseover="this.style.color='var(--accent)';this.style.background='var(--surface-alt)'" onmouseout="this.style.color='var(--text-dim)';this.style.background='none'">📋</button>` : '';
  return `<div class="info-block"><div class="info-label">${label}</div><div class="info-value"><span class="info-value-text">${texte || '—'}</span>${extra || ''}${copyBtn}</div></div>`;
}

// Bouton "copier" à côté d'un champ de fiche client (adresse, date de naissance, IBAN, etc.) —
// demande de Jonathan du 18.09.2026. Lit le texte depuis le <span> frère plutôt que de le passer
// en argument JS, pour éviter tout souci d'échappement avec les apostrophes des noms/adresses.
function copierValeurBouton(btn) {
  const conteneur = btn.closest('.info-value');
  const span = conteneur ? conteneur.querySelector('.info-value-text') : null;
  const texte = (span ? span.textContent : '').trim();
  if (!texte || texte === '—') return;
  navigator.clipboard.writeText(texte).then(() => {
    const original = btn.textContent;
    btn.textContent = '✓';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1200);
  }).catch(() => {});
}

// ═══ RECHERCHE GLOBALE (raccourci général depuis le dashboard) ═══
// Un seul champ pour retrouver n'importe quel client, contrat, opportunité ou rappel sans passer
// par les listes/filtres dédiés — demande de Jonathan du 14.09.2026. Le raccourci clavier
// Ctrl/Cmd+K (voir listener tout en bas de ce fichier) ramène sur le dashboard et place le focus
// dans ce champ depuis n'importe quel écran du CRM.
function rechercheGlobale(q) {
  const search = (q || '').toLowerCase().trim();
  const vide = { clients: [], contrats: [], opportunites: [], rappels: [] };
  if (search.length < 2) return vide;

  const nomClient = (c) => c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : '';

  const clients = (allClients || []).filter(c => {
    const hay = `${nomClient(c)} ${c.email||''} ${c.tel||''} ${c.mobile||''} ${c.telephone||''} ${c.ville||''} ${c.adresse||''}`.toLowerCase();
    return hay.includes(search);
  }).slice(0, 6);

  const contrats = (allContrats || []).filter(ct => {
    const cl = allClients.find(c => c.id === ct.client_id);
    const hay = `${nomClient(cl)} ${ct.compagnie||''} ${ct.produit||''} ${ct.numero_police||''}`.toLowerCase();
    return hay.includes(search);
  }).slice(0, 6);

  const opportunites = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).filter(o => {
    const cl = o.client_id ? allClients.find(c => c.id === o.client_id) : null;
    const nom = cl ? nomClient(cl) : (o.prospect_nom || '');
    const hay = `${o.titre||''} ${nom}`.toLowerCase();
    return hay.includes(search);
  }).slice(0, 6);

  const rappels = (typeof allRappels !== 'undefined' ? allRappels : []).filter(r => {
    return (r.titre || '').toLowerCase().includes(search);
  }).slice(0, 6);

  return { clients, contrats, opportunites, rappels };
}

// Ferme et vide le champ de recherche globale — appelé après un clic sur un résultat, sur Échap,
// ou (avec un léger délai) quand le champ perd le focus.
function fermerRechercheGlobale() {
  const zone = document.getElementById('recherche-globale-resultats');
  const input = document.getElementById('recherche-globale-input');
  if (zone) { zone.style.display = 'none'; zone.innerHTML = ''; }
  if (input) input.value = '';
  window._rechercheGlobalePremiereAction = null;
}

function onKeydownRechercheGlobale(e) {
  if (e.key === 'Escape') { e.target.blur(); fermerRechercheGlobale(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (typeof window._rechercheGlobalePremiereAction === 'function') window._rechercheGlobalePremiereAction();
  }
}

function renderResultatsRechercheGlobale() {
  const input = document.getElementById('recherche-globale-input');
  const zone = document.getElementById('recherche-globale-resultats');
  if (!input || !zone) return;
  const q = input.value;
  if (!q || q.trim().length < 2) { zone.style.display = 'none'; zone.innerHTML = ''; window._rechercheGlobalePremiereAction = null; return; }

  const { clients, contrats, opportunites, rappels } = rechercheGlobale(q);
  const total = clients.length + contrats.length + opportunites.length + rappels.length;
  const nomClient = (c) => c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : '';

  if (!total) {
    zone.innerHTML = `<div style="padding:14px 16px;color:var(--text-muted);font-size:12.5px">Aucun résultat pour « ${q.replace(/</g,'&lt;')} »</div>`;
    zone.style.display = 'block';
    window._rechercheGlobalePremiereAction = null;
    return;
  }

  window._rechercheGlobaleActions = window._rechercheGlobaleActions || {};
  window._rechercheGlobaleActions = {};
  let compteur = 0;
  window._rechercheGlobalePremiereAction = null;

  const ligne = (icone, titre, sousTitre, action) => {
    const cle = 'r' + (compteur++);
    window._rechercheGlobaleActions[cle] = action;
    if (!window._rechercheGlobalePremiereAction) window._rechercheGlobalePremiereAction = action;
    return `<div onmousedown="window._rechercheGlobaleActions['${cle}']()" style="display:flex;align-items:center;gap:10px;padding:9px 16px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseover="this.style.background='rgba(56,189,248,0.06)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:15px;flex-shrink:0">${icone}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${titre}</div>
        ${sousTitre ? `<div style="font-size:10.5px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sousTitre}</div>` : ''}
      </div>
    </div>`;
  };
  const entete = (txt) => `<div style="padding:7px 16px 4px;font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px">${txt}</div>`;

  let html = '';
  if (clients.length) {
    html += entete('👤 Clients');
    html += clients.map(c => ligne('👤', nomClient(c) || '—', c.email || c.ville || '', () => { fermerRechercheGlobale(); showClient(c.id); })).join('');
  }
  if (contrats.length) {
    html += entete('📄 Contrats');
    html += contrats.map(ct => {
      const cl = allClients.find(c => c.id === ct.client_id);
      return ligne('📄', `${ct.compagnie || '—'}${ct.produit ? ' — ' + ct.produit : ''}`, nomClient(cl), () => { fermerRechercheGlobale(); showDetailContrat(ct.id); });
    }).join('');
  }
  if (opportunites.length) {
    html += entete('🎯 Opportunités');
    html += opportunites.map(o => {
      const cl = o.client_id ? allClients.find(c => c.id === o.client_id) : null;
      const nom = cl ? nomClient(cl) : (o.prospect_nom ? `${o.prospect_nom} 🆕` : '—');
      return ligne('🎯', o.titre || '—', nom, () => { fermerRechercheGlobale(); opportuniteEnEditionId = o.id; navigate('nouvelle-opportunite'); });
    }).join('');
  }
  if (rappels.length) {
    html += entete('🔔 Rappels');
    html += rappels.map(r => {
      const cl = r.client_id ? allClients.find(c => c.id === r.client_id) : null;
      return ligne('🔔', r.titre || '—', nomClient(cl), () => { fermerRechercheGlobale(); showRappel(r.id); });
    }).join('');
  }

  zone.innerHTML = html;
  zone.style.display = 'block';
}

// Raccourci clavier général Ctrl/Cmd+K : ramène sur le dashboard si besoin puis place le focus
// dans le champ de recherche globale, depuis n'importe quel écran du CRM.
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    const focusChamp = () => {
      const el = document.getElementById('recherche-globale-input');
      if (el) { el.focus(); el.select(); }
    };
    if (typeof currentView !== 'undefined' && currentView === 'dashboard') focusChamp();
    else if (typeof navigate === 'function') navigate('dashboard').then(focusChamp);
  }
});

// Cadre "État des dossiers" — réutilisé sur la fiche client ET la fiche opportunité (même liste
// de demandes d'offre, filtrée différemment en amont selon client_id ou opportunite_id).
// Affiche une ligne PAR COMPAGNIE sollicitée (pas juste un statut global "envoyée" qui ne disait
// pas à qui) — voir demandes_offre.compagnies_envoi, alimenté par genererEmailDemandeOffre().
// Repli sur une ligne générique si aucune compagnie n'a encore été tracée (dossier enregistré
// mais email pas encore généré, ou ancien dossier antérieur à ce suivi).
// refreshType/refreshId : comment rafraîchir l'affichage après upload d'une offre PDF —
// ('client', clientId) depuis la fiche client, ('opp', oppId) depuis la fiche opportunité.
// Laissés vides si appelé depuis un contexte où le rafraîchissement n'a pas de sens.
function renderEtatDossiers(demandesOffre, refreshType, refreshId) {
  if (!demandesOffre || !demandesOffre.length) return '';
  const statutColorDo = { 'envoyée': '#f59e0b', 'reçue': '#4ade80', 'relance': '#f87171', 'clôturée': '#64748b' };
  const lignes = [];
  demandesOffre.forEach(d => {
    if (d.compagnies_envoi && d.compagnies_envoi.length) {
      d.compagnies_envoi.forEach((e, idx) => lignes.push({
        demandeOffreId: d.id,
        idx,
        clientId: d.client_id || '',
        statut: e.statut || 'envoyée',
        compagnie: e.compagnie,
        email: e.email || null,
        envoyeLe: e.envoye_le || null,
        recuLe: e.recu_le || null,
        soumisClient: !!e.soumis_client,
        soumisClientLe: e.soumis_client_le || null,
        offrePath: e.offre_path || null,
      }));
    } else {
      lignes.push({ demandeOffreId: d.id, idx: null, clientId: d.client_id || '', libelle: `Demande d'offre du ${fmtDate(d.created_at)}`, statut: d.statut || 'envoyée', compagnie: null, email: null, envoyeLe: d.created_at, recuLe: null, soumisClient: false, soumisClientLe: null, offrePath: null });
    }
  });
  // Actions pièce jointe / signature / soumission client — uniquement disponibles sur les lignes
  // suivies par compagnie (idx non-null). Upload manuel du PDF (décision de Jonathan le
  // 06.08.2026), bouton "soumise au client" (nouvelle étape demandée le 07.08.2026 — distincte
  // de la réception compagnie : trace le moment où Jonathan présente l'offre reçue au client),
  // puis bouton pour lancer directement le mandat de signature.
  const actionsOffre = (l) => {
    if (l.idx === null) return '';
    if (l.statut !== 'reçue') {
      // Marquer manuellement comme reçue (repli si la synchro Outlook ne trouve pas la réponse —
      // mauvais domaine, réponse pas encore arrivée, offre reçue par un autre canal, etc.).
      return `<button type="button" onclick="event.stopPropagation();marquerCompagnieRecue('${l.demandeOffreId}',${l.idx},'${refreshType || ''}','${refreshId || ''}')" style="background:var(--surface);border:1px solid var(--border);color:var(--text-muted);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">✓ Marquer reçue</button>`;
    }
    const boutons = [];
    boutons.push(l.offrePath
      ? `<button type="button" onclick="event.stopPropagation();ouvrirPieceJointe('${l.offrePath}')" style="background:var(--surface);border:1px solid var(--border);color:var(--text-muted);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">📄 Voir l'offre</button>`
      : `<label onclick="event.stopPropagation()" style="cursor:pointer;background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700">📎 Joindre l'offre
        <input type="file" accept="application/pdf" style="display:none" onclick="event.stopPropagation()" onchange="event.stopPropagation();uploadOffreCompagnie('${l.demandeOffreId}',${l.idx},this,'${refreshType || ''}','${refreshId || ''}')">
      </label>`);
    if (!l.soumisClient) {
      boutons.push(`<button type="button" onclick="event.stopPropagation();marquerOffreSoumiseClient('${l.demandeOffreId}',${l.idx},'${refreshType || ''}','${refreshId || ''}')" style="background:var(--surface);border:1px solid #60a5fa44;color:#60a5fa;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">📨 Marquer soumise au client</button>`);
    }
    boutons.push(`<button type="button" onclick="event.stopPropagation();preparerEnvoiSignatureOffre('${l.clientId}')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">✍️ Préparer signature</button>`);
    return boutons.join('');
  };
  // Petite étape de timeline (Envoyée / Reçue / Soumise au client) — pastille pleine + date une
  // fois l'étape franchie, pastille grise en pointillé sinon. Répond directement à la demande de
  // Jonathan de voir clairement à quelle compagnie et à quelle date chaque étape a eu lieu.
  const etape = (label, fait, date, couleur) => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:${fait ? couleur : 'var(--text-muted)'};background:${fait ? couleur + '1a' : 'transparent'};border:1px ${fait ? 'solid' : 'dashed'} ${fait ? couleur + '55' : 'var(--border)'};border-radius:99px;padding:2px 8px;white-space:nowrap">${label}${fait && date ? ' · ' + fmtDate(date) : ''}</span>`;
  return `<div style="padding:10px 16px;background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;margin-bottom:16px">
    <div style="font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">📋 État des dossiers (demandes d'offre)</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${lignes.map(l => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 10px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer" onclick="demandeOffreEnEditionId='${l.demandeOffreId}';navigate('nouvelle-demande-offre')">
          <span style="width:7px;height:7px;border-radius:50%;background:${statutColorDo[l.statut] || '#64748b'};flex-shrink:0"></span>
          <span style="font-size:12.5px;color:var(--text);font-weight:700">${l.compagnie || l.libelle}</span>
          ${l.idx !== null ? (l.email ? `<span style="font-size:10.5px;color:var(--text-muted)">✉️ destinataire : ${l.email}</span>` : `<span style="font-size:10.5px;color:#f87171">⚠ aucun destinataire enregistré</span>`) : ''}
        </div>
        ${l.idx !== null ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px;padding-left:17px">
          ${etape('📤 Envoyée', !!l.envoyeLe, l.envoyeLe, '#f59e0b')}
          ${etape('📬 Reçue', l.statut === 'reçue', l.recuLe, '#4ade80')}
          ${etape('📨 Soumise au client', l.soumisClient, l.soumisClientLe, '#60a5fa')}
          <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap" onclick="event.stopPropagation()">${actionsOffre(l)}</div>
        </div>` : `<div style="font-size:10.5px;color:var(--text-muted);margin-top:4px;padding-left:17px">envoyée le ${fmtDate(l.envoyeLe)} — ${l.statut}</div>`}
      </div>`).join('')}
    </div>
  </div>`;
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
  if (currentView !== 'nouvelle-opportunite') { window._oppFormulairePour = null; window._oppFormulaireNouveau = false; }
  if (currentView !== 'nouvelle-demande-offre') window._doClassique = false;
  switch (currentView) {
    case 'dashboard':
      main.innerHTML = '<div class="loader">Actualisation des données...</div>';
      await refreshCoreData();
      // Nouveau tableau de bord (js/18) sauf si « Vue classique » a été choisie
      main.innerHTML = (typeof viewDashboardV2 === 'function' && !dbxClassiqueActive()) ? viewDashboardV2() : viewDashboard();
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
    // Fiche opportunité aérée + création rapide (js/25) ; l'ancien formulaire reste le mode « tous les champs »
    case 'nouvelle-opportunite': main.innerHTML = typeof viewOpportuniteRoute === 'function' ? viewOpportuniteRoute() : viewNouvelleOpportunite(); break;
    case 'nouveau-rappel': main.innerHTML = viewNouveauRappel(); break;
    case 'nouveau-bordereau': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = await viewNouveauBordereau(); break;
    case 'importer-bordereau': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = await viewImporterBordereauIGB2B(); break;
    case 'nouveau-contrat': main.innerHTML = viewNouveauContrat(); initSegmentContrat(); break;
    case 'nouveau-contrat-direct': contratClientId = null; main.innerHTML = viewNouveauContrat(); initSegmentContrat(); break;
    // Demande d'offre simplifiée (js/26) ; l'ancien formulaire reste accessible (« Formulaire détaillé »)
    case 'nouvelle-demande-offre': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = (typeof viewDemandeOffreSimple === 'function' && !window._doClassique) ? await viewDemandeOffreSimple() : await viewNouvelleDemandeOffre(); bindAdresseAutocomplete({ adresseId: 'do-adresse', champUnique: true }); break;
    case 'commissions-attente':
      main.innerHTML = '<div class="loader">Actualisation des données...</div>';
      await refreshCoreData();
      main.innerHTML = viewCommissionsAttente();
      break;
    case 'rapport-finma': main.innerHTML = viewRapportFinma(); break;
    case 'suivi-financier':
      if (typeof viewSuiviFinancierV2 === 'function') { main.innerHTML = '<div class="loader">Actualisation des données...</div>'; await refreshCoreData(); main.innerHTML = viewSuiviFinancierV2(); }
      else main.innerHTML = viewSuiviFinancier();
      break;
    case 'conseil': main.innerHTML = viewConseil(); break;
    case 'caution': main.innerHTML = '<div class="loader">Actualisation des données...</div>'; await refreshCoreData(); main.innerHTML = typeof viewComptesCaution === 'function' ? viewComptesCaution() : ''; break;
    // Marquage OZ / Assurex-EX des clients sans entité (js/39)
    // Courriers clients avec en-tête Assurex / EX.GROUP (js/45)
    case 'courriers': main.innerHTML = typeof viewCourriers === 'function' ? viewCourriers() : ''; break;
    case 'marquage-entites': main.innerHTML = '<div class="loader">Actualisation des données...</div>'; await refreshCoreData(); main.innerHTML = typeof viewMarquageEntites === 'function' ? viewMarquageEntites() : ''; break;
    // Factures QR suisses (js/33)
    case 'factures': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = typeof viewFacturesQR === 'function' ? await viewFacturesQR() : '<div class="table-empty">Module factures non chargé.</div>'; break;
    case 'tresorerie': main.innerHTML = '<div class="loader">Actualisation des données...</div>'; await refreshCoreData(); main.innerHTML = viewTresorerie(); break;
    case 'production': main.innerHTML = viewProduction(); break;
    case 'opportunites': main.innerHTML = viewOpportunites(); break;
    case 'suivi': main.innerHTML = typeof viewSuiviAffaires === 'function' ? viewSuiviAffaires() : viewSuivi(); break;
    case 'renouvellements': main.innerHTML = viewRenouvellements(); break;
    case 'relances-lamal': main.innerHTML = viewRelancesLamal(); break;
    case 'equipement': main.innerHTML = viewEquipement(); break;
    case 'sources': main.innerHTML = viewSources(); break;
    case 'rappels': main.innerHTML = viewRappels(); break;
    case 'analyse-prevoyance': main.innerHTML = viewAnalysePrevoyance(); break;
    // Ancien calculateur de prévoyance retiré (19.09.2026) : redirigé vers l'analyse de prévoyance
    case 'calc-lpp': currentView = 'analyse-prevoyance'; renderSidebar(); main.innerHTML = viewAnalysePrevoyance(); break;
    case 'calc-immo': main.innerHTML = viewFinancementImmo(); break;
    case 'agenda': main.innerHTML = viewAgenda(); break;
    case 'rendez-vous': main.innerHTML = '<div class="loader">Chargement...</div>'; main.innerHTML = await viewRendezVous(); break;
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
    case 'apparence': main.innerHTML = viewApparence(); break;
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
  clients: 'portefeuille',
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


// ═══ APPARENCE (thème) ═══
function appliquerThemeMode(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('crm_theme_mode', mode);
  navigate('apparence');
}

function appliquerThemeAccent(accent) {
  document.documentElement.setAttribute('data-accent', accent);
  localStorage.setItem('crm_theme_accent', accent);
  navigate('apparence');
}

function viewApparence() {
  const modeActuel = localStorage.getItem('crm_theme_mode') || 'sombre';
  const accentActuel = localStorage.getItem('crm_theme_accent') || 'bleu';

  const modes = [
    { id: 'sombre', label: 'Sombre', desc: 'Thème par défaut du CRM', bg: '#111827', surface: '#1a2235', text: '#e2e8f0' },
    { id: 'clair', label: 'Clair', desc: 'Fond blanc, texte foncé', bg: '#f1f5f9', surface: '#ffffff', text: '#0f172a' },
  ];
  const accents = [
    { id: 'bleu', label: 'REX (cyan / bleu marine)', couleur: '#00CFFF' },
    { id: 'vert', label: 'Vert', couleur: '#4ade80' },
    { id: 'or', label: 'Or', couleur: '#f59e0b' },
    { id: 'violet', label: 'Violet', couleur: '#a78bfa' },
  ];

  const modesHtml = modes.map(m => `
    <div class="theme-mode-card ${modeActuel === m.id ? 'active' : ''}" onclick="appliquerThemeMode('${m.id}')" style="flex:1;min-width:160px">
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <div style="flex:1;height:44px;border-radius:8px;background:${m.bg};border:1px solid ${m.surface}"></div>
        <div style="flex:1;height:44px;border-radius:8px;background:${m.surface};border:1px solid var(--border)"></div>
      </div>
      <div style="font-size:13px;font-weight:800;color:var(--text)">${m.label} ${modeActuel === m.id ? '✓' : ''}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${m.desc}</div>
    </div>`).join('');

  const accentsHtml = accents.map(a => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
      <div class="theme-swatch ${accentActuel === a.id ? 'active' : ''}" style="background:${a.couleur}" onclick="appliquerThemeAccent('${a.id}')" title="${a.label}"></div>
      <div style="font-size:10.5px;color:var(--text-muted);font-weight:700">${a.label}</div>
    </div>`).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Apparence</h2>
    </div>
    <div style="max-width:640px;margin-bottom:18px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px">Mode</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:14px">Le choix est enregistré sur cet appareil et s'applique immédiatement.</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">${modesHtml}</div>
    </div>
    <div style="max-width:640px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px">Couleur d'accent</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:14px">Boutons, liens et éléments actifs du CRM.</div>
      <div style="display:flex;gap:18px">${accentsHtml}</div>
    </div>`;
}
