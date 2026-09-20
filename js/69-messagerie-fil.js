// ═══ MESSAGERIE : LE FIL ET LES NOTIFICATIONS (20.09.2026) ═════════════════════════════════════
// Demande de Jonathan : répondre DANS la messagerie de l'application, et que le client soit
// prévenu quand sa demande est traitée et close — en particulier au dépôt de la police demandée.
//
// Ce qui existait : un champ « reponse » unique sur le message. Une conversation n'y tenait pas —
// la deuxième réponse écrasait la première — et le client ne voyait rien revenir, sauf à lui
// envoyer un e-mail à côté. La réponse partait donc systématiquement par Outlook, hors de l'outil.
//
// Ce qui change :
//   — un vrai fil (messages_echanges), repris depuis l'existant sans rien perdre ;
//   — le client répond depuis REX CLOUD, le conseiller depuis le CRM, dans le même fil ;
//   — une notification part TOUJOURS, parce qu'elle est déclenchée par la BASE et non par l'écran :
//     que la réponse vienne du CRM, d'un téléphone ou d'un écran qui n'existe pas encore, le client
//     est prévenu. Idem au dépôt d'un document : le déclencheur clôt la demande correspondante et
//     annonce « votre demande est traitée ».
//
// L'envoi par e-mail reste possible, mais il devient un CHOIX et non le seul chemin.

window._fil = window._fil || { parMessage: {}, notifications: [], chargement: {} };

function filEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function filQuand(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 60 * 24) return `il y a ${Math.floor(minutes / 60)} h`;
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function filCharger(messageId) {
  try {
    const l = await dbGet('messages_echanges', `message_id=eq.${messageId}&select=*&order=created_at.asc`);
    window._fil.parMessage[messageId] = l || [];
  } catch (e) { window._fil.parMessage[messageId] = []; }
  return window._fil.parMessage[messageId];
}

// Le fil lui-même, partagé par les deux côtés : le conseiller et le client voient le même objet,
// seule la couleur change selon qui parle. Deux rendus différents finiraient par diverger.
function filHtml(messageId, moiCote) {
  const l = window._fil.parMessage[messageId];
  if (!l) return '<div class="fil-attente">Chargement de la conversation…</div>';
  if (!l.length) return '<div class="fil-attente">Aucun échange.</div>';
  return `<div class="fil">${l.map(e => `
    <div class="fil-bulle ${e.auteur === moiCote ? 'moi' : 'lui'}">
      <div class="fil-corps">${filEsc(e.corps).replace(/\n/g, '<br/>')}</div>
      <div class="fil-pied">${e.auteur === 'client' ? 'Le client' : filEsc(e.auteur_nom || 'Votre conseiller')} · ${filQuand(e.created_at)}</div>
    </div>`).join('')}</div>`;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CÔTÉ CONSEILLER
// ════════════════════════════════════════════════════════════════════════════════════════════════

// Remplace l'ancienne fenêtre de réponse. On garde le nom mcRepondre : il est appelé depuis les
// boutons déjà en place (js/51), et changer le nom obligerait à les retoucher un par un.
function mcRepondre(id) {
  const m = (window._mc && _mc.messages || []).find(x => x.id === id);
  if (!m) return;
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === m.client_id);
  const nom = typeof mcNomClient === 'function' ? mcNomClient(m.client_id) : '';

  creerModale('modal-fil', `
    <div class="opx-modale fil-modale" role="dialog" aria-modal="true" aria-labelledby="fil-titre">
      <header class="fil-tete">
        <div><h3 id="fil-titre">${filEsc(m.sujet || 'Conversation')}</h3>
          <span class="fil-sous">${filEsc(nom)}${c && c.email ? ' · ' + filEsc(c.email) : ''}</span></div>
        <button type="button" class="fil-fermer" onclick="document.getElementById('modal-fil').remove()" aria-label="Fermer">✕</button>
      </header>
      <div class="fil-zone" id="fil-zone">${filHtml(id, 'conseiller')}</div>
      <div class="fil-saisie">
        <textarea id="fil-texte" rows="4" placeholder="Votre réponse…"></textarea>
        <label class="fil-option"><input type="checkbox" id="fil-clore" checked/>
          <span>Marquer la demande traitée et close — le client en est prévenu.</span></label>
        <div class="fil-actions">
          <button type="button" class="btn-secondary" onclick="filAussiParMail('${id}')">📨 Aussi par e-mail…</button>
          <button type="button" class="btn-save" onclick="filEnvoyerConseiller('${id}')">Envoyer la réponse</button>
        </div>
      </div>
    </div>`, { padding: '0' });

  filCharger(id).then(() => {
    const z = document.getElementById('fil-zone');
    if (z) { z.innerHTML = filHtml(id, 'conseiller'); z.scrollTop = z.scrollHeight; }
  });
}

async function filEnvoyerConseiller(id) {
  const texte = (document.getElementById('fil-texte')?.value || '').trim();
  if (!texte) { showError('Écris ta réponse avant d’envoyer.'); return; }
  const clore = document.getElementById('fil-clore')?.checked;
  const moi = typeof crxMoi === 'function' ? crxMoi() : { nom: '' };

  // L'ORDRE COMPTE. Le déclencheur en base lit le statut du message au moment où la réponse est
  // insérée pour choisir son titre (« traitée » ou « une réponse »). On clôt donc AVANT d'écrire.
  if (clore) await dbPatch('messages_clients', id, { statut: 'traite', repondu_par: moi.nom || null, repondu_le: new Date().toISOString() });

  const r = await dbPost('messages_echanges', {
    message_id: id, auteur: 'conseiller', auteur_nom: moi.nom || null, corps: texte.slice(0, 5000),
  });
  if (r && r.error) { showError('Réponse non enregistrée : ' + errMsg(r)); return; }

  const el = document.getElementById('fil-texte');
  if (el) el.value = '';
  await filCharger(id);
  const z = document.getElementById('fil-zone');
  if (z) { z.innerHTML = filHtml(id, 'conseiller'); z.scrollTop = z.scrollHeight; }
  const m = (window._mc && _mc.messages || []).find(x => x.id === id);
  if (m && clore) m.statut = 'traite';
  showError(clore ? '✓ Réponse envoyée, demande close. Le client est prévenu.' : '✓ Réponse envoyée. Le client est prévenu.');
}

// L'e-mail devient une option : certains clients ne se connectent jamais à leur espace, et pour
// ceux-là la notification dans l'application ne sert à rien.
function filAussiParMail(id) {
  const m = (window._mc && _mc.messages || []).find(x => x.id === id);
  const texte = (document.getElementById('fil-texte')?.value || '').trim();
  if (!m) return;
  if (!texte) { showError('Écris d’abord ta réponse.'); return; }
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === m.client_id);
  if (!c || !c.email) { showError('Ce client n’a pas d’adresse e-mail dans sa fiche.'); return; }
  if (typeof mcEcrireAuClient === 'function') {
    mcEcrireAuClient(m.client_id);
    setTimeout(() => {
      const corps = document.getElementById('mce-corps');
      if (corps) corps.value = texte + '\n\n' + (corps.value || '');
    }, 60);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CÔTÉ CLIENT (REX CLOUD)
// ════════════════════════════════════════════════════════════════════════════════════════════════

async function filChargerNotifications() {
  const E = window._ec || {};
  if (!E.client) return [];
  try {
    window._fil.notifications = await dbGet('notifications_clients',
      `client_id=eq.${E.client.id}&select=*&order=created_at.desc&limit=30`) || [];
  } catch (e) { window._fil.notifications = []; }
  return window._fil.notifications;
}

function filNonLues() { return (window._fil.notifications || []).filter(n => !n.lu_le); }

// Le bandeau de notifications, en haut de l'espace client. Il n'apparaît que s'il y a quelque
// chose à dire : un bandeau vide en permanence, on cesse de le voir.
function filBandeauNotifications() {
  const nl = filNonLues();
  if (!nl.length) return '';
  const icone = { document: '📄', police: '📄', demande_traitee: '✅', message: '💬', rendez_vous: '📅', info: 'ℹ️' };
  return `<div class="fil-notifs">
    ${nl.slice(0, 4).map(n => `
      <button type="button" class="fil-notif" onclick="filOuvrirNotification('${n.id}')">
        <span class="fil-notif-icone" aria-hidden="true">${icone[n.type] || 'ℹ️'}</span>
        <span class="fil-notif-texte"><b>${filEsc(n.titre)}</b>${n.corps ? `<small>${filEsc(n.corps)}</small>` : ''}</span>
        <span class="fil-notif-quand">${filQuand(n.created_at)}</span>
      </button>`).join('')}
    ${nl.length > 4 ? `<div class="fil-notif-reste">et ${nl.length - 4} autre(s)</div>` : ''}
  </div>`;
}

async function filOuvrirNotification(id) {
  const n = (window._fil.notifications || []).find(x => x.id === id);
  if (!n) return;
  try { await dbPatch('notifications_clients', id, { lu_le: new Date().toISOString() }); n.lu_le = new Date().toISOString(); } catch (e) {}
  if (n.lien && typeof ecAllerOnglet === 'function') ecAllerOnglet(n.lien === 'documents' ? 'demandes' : n.lien === 'messages' ? 'demandes' : n.lien);
  else if (typeof ecRendre === 'function') ecRendre();
}

async function filMarquerToutLu() {
  const nl = filNonLues();
  const maintenant = new Date().toISOString();
  for (const n of nl) {
    try { await dbPatch('notifications_clients', n.id, { lu_le: maintenant }); n.lu_le = maintenant; } catch (e) {}
  }
  if (typeof ecRendre === 'function') ecRendre();
}

// Le fil côté client : il ouvre sa conversation et peut y répondre.
async function filOuvrirClient(messageId) {
  const E = window._ec || {};
  const m = (E.messages || []).find(x => x.id === messageId);
  if (!m) return;
  creerModale('modal-fil-client', `
    <div class="opx-modale fil-modale" role="dialog" aria-modal="true" aria-labelledby="filc-titre">
      <header class="fil-tete">
        <div><h3 id="filc-titre">${filEsc(m.sujet || 'Ma demande')}</h3>
          <span class="fil-sous">${m.statut === 'traite' ? '✅ Traitée et close' : 'En cours de traitement'}</span></div>
        <button type="button" class="fil-fermer" onclick="document.getElementById('modal-fil-client').remove()" aria-label="Fermer">✕</button>
      </header>
      <div class="fil-zone" id="filc-zone">${filHtml(messageId, 'client')}</div>
      <div class="fil-saisie">
        <textarea id="filc-texte" rows="3" placeholder="Votre message…"></textarea>
        <div class="fil-actions">
          <button type="button" class="btn-save" onclick="filEnvoyerClient('${messageId}')">Envoyer</button>
        </div>
      </div>
    </div>`, { padding: '0' });
  await filCharger(messageId);
  const z = document.getElementById('filc-zone');
  if (z) { z.innerHTML = filHtml(messageId, 'client'); z.scrollTop = z.scrollHeight; }
}

async function filEnvoyerClient(messageId) {
  const texte = (document.getElementById('filc-texte')?.value || '').trim();
  if (!texte) return;
  const r = await dbPost('messages_echanges', { message_id: messageId, auteur: 'client', corps: texte.slice(0, 5000) });
  if (r && r.error) { showError('Votre message n’a pas pu être envoyé.'); return; }
  // Une relance du client rouvre la demande : elle n'est plus close puisqu'il y a du nouveau.
  try { await dbPatch('messages_clients', messageId, { statut: 'nouveau' }); } catch (e) {}
  const el = document.getElementById('filc-texte');
  if (el) el.value = '';
  await filCharger(messageId);
  const z = document.getElementById('filc-zone');
  if (z) { z.innerHTML = filHtml(messageId, 'client'); z.scrollTop = z.scrollHeight; }
}
