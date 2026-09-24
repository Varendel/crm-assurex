// ═══ CLASSER DANS LE DOSSIER SHAREPOINT DU CLIENT (23.09.2026) ══════════════════════════════════
// « Ils sont stockés dans le navigateur, je dois à chaque fois les charger et les descendre —
//   est-ce qu'on pourrait connecter un fichier de dépôt ou prévoir un truc qui classe dans le
//   dossier client les fichiers téléchargés » — puis : « SharePoint je dis. »
//
// Jusqu'ici un PDF joint à une offre partait dans le stockage Supabase : un SECOND exemplaire, à
// côté du dossier SharePoint où le reste du dossier se trouve déjà, et qu'il fallait redescendre
// pour le relire. Il va maintenant directement dans le dossier du client, et le CRM ne garde que
// le lien. Un seul exemplaire, à l'endroit où on le cherche.
//
// CE QU'IL FAUT UNE FOIS, ET UNE SEULE : la permission déléguée Files.ReadWrite.All sur
// l'inscription d'application Microsoft du CRM. Elle est demandée à la PREMIÈRE utilisation
// (consentement incrémental), jamais à la connexion — personne n'a à re-consentir pour lire son
// courrier. Tant qu'elle n'est pas accordée, le bouton le dit en clair et ne casse rien.
//
// L'arborescence n'est pas inventée : elle est relevée sur le SharePoint tel qu'il est
// aujourd'hui (Sauthier Camille/Offres, Sauthier Camille/Polices).

const SPD_HOTE = 'cofidex.sharepoint.com';
const SPD_RACINE = ['MANDATS A TRAITER', 'ASSUREX'];
window._spd = window._spd || { driveId: null, jeton: null, jetonExp: 0 };

function spdCompte() {
  try { return msalInstance && msalInstance.getAllAccounts && msalInstance.getAllAccounts()[0]; } catch (e) { return null; }
}

// Le jeton porte SON propre scope : celui de la session (Mail/Calendars) ne donne aucun droit sur
// les fichiers. Silencieux si le consentement existe déjà, fenêtre sinon — et une seule fois.
async function spdJeton(interactif) {
  if (_spd.jeton && Date.now() < _spd.jetonExp - 60000) return _spd.jeton;
  const account = spdCompte();
  if (!account) throw new Error('Connecte-toi à Microsoft (bouton Outlook) avant de classer un document.');
  const demande = { scopes: ['Files.ReadWrite.All'], account };
  let r = null;
  try {
    r = await msalInstance.acquireTokenSilent(demande);
  } catch (e) {
    if (!interactif) throw new Error('consentement requis');
    r = await msalInstance.acquireTokenPopup(demande);
  }
  _spd.jeton = r.accessToken;
  _spd.jetonExp = r.expiresOn ? new Date(r.expiresOn).getTime() : Date.now() + 30 * 60000;
  return _spd.jeton;
}

async function spdGraph(url, options) {
  const jeton = await spdJeton(true);
  const o = options || {};
  const r = await fetch(url.startsWith('http') ? url : `https://graph.microsoft.com/v1.0${url}`, {
    ...o,
    headers: { Authorization: `Bearer ${jeton}`, ...(o.headers || {}) },
  });
  if (r.status === 403) throw new Error("Microsoft refuse l'accès aux fichiers : la permission Files.ReadWrite.All n'est pas accordée à l'application du CRM.");
  if (!r.ok && r.status !== 404) throw new Error(`SharePoint ${r.status} — ${(await r.text()).slice(0, 200)}`);
  return { ok: r.ok, status: r.status, json: r.status === 204 ? null : await r.json().catch(() => null) };
}

// La bibliothèque « Documents partagés » du site racine — résolue une fois par session.
async function spdDrive() {
  if (_spd.driveId) return _spd.driveId;
  const site = await spdGraph(`/sites/${SPD_HOTE}`);
  if (!site.ok || !site.json || !site.json.id) throw new Error('Site SharePoint introuvable.');
  const drive = await spdGraph(`/sites/${site.json.id}/drive`);
  if (!drive.ok || !drive.json) throw new Error('Bibliothèque de documents introuvable.');
  _spd.driveId = drive.json.id;
  return _spd.driveId;
}

// Le chemin du dossier d'un client. Deux ères cohabitent sur le SharePoint — les mandats repris
// d'OZ Assure ont leur propre branche — et le CRM sait déjà de laquelle un client relève
// (clients.source_oz). Le nom du dossier suit la convention observée : « Nom Prénom » pour un
// particulier, la raison sociale pour une entreprise.
function spdCheminClient(client, sousDossier) {
  if (!client) return null;
  const entreprise = typeof estEntreprise === 'function' && estEntreprise(client);
  const ere = client.source_oz ? ['Mandats OZ'] : [];
  const branche = client.source_oz
    ? (entreprise ? 'Mandats Entreprises' : 'Mandats privés')
    : (entreprise ? 'Mandats Entreprises' : 'Mandats Privés');
  const nom = entreprise
    ? String(client.nom || '').trim()
    : `${String(client.nom || '').trim()} ${String(client.prenom || '').trim()}`.trim();
  if (!nom) return null;
  return [...SPD_RACINE, ...ere, branche, nom, ...(sousDossier ? [sousDossier] : [])];
}

function spdUrlChemin(segments) {
  return segments.map(s => encodeURIComponent(s)).join('/');
}

// Descend le chemin segment par segment et crée ce qui manque. Créer le dossier d'un client qui
// n'en a pas encore est voulu : le refus silencieux obligerait à aller le faire à la main dans
// SharePoint, ce qui est exactement la corvée qu'on supprime ici.
async function spdDossier(segments) {
  const driveId = await spdDrive();
  const direct = await spdGraph(`/drives/${driveId}/root:/${spdUrlChemin(segments)}`);
  if (direct.ok && direct.json) return { driveId, item: direct.json };
  let parentId = (await spdGraph(`/drives/${driveId}/root`)).json.id;
  for (const segment of segments) {
    const enfants = await spdGraph(`/drives/${driveId}/items/${parentId}/children?$select=id,name,folder&$top=999`);
    const trouve = ((enfants.json && enfants.json.value) || [])
      .find(x => x.folder && String(x.name).toLowerCase() === segment.toLowerCase());
    if (trouve) { parentId = trouve.id; continue; }
    const cree = await spdGraph(`/drives/${driveId}/items/${parentId}/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: segment, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
    });
    if (!cree.ok || !cree.json) throw new Error(`Impossible de créer le dossier « ${segment} ».`);
    parentId = cree.json.id;
  }
  return { driveId, item: { id: parentId } };
}

// Au-delà de 4 Mo, Graph refuse l'envoi direct : il faut une session d'envoi. Le fichier part
// quand même en une fois — le découpage en tranches ne sert que pour les très gros fichiers.
async function spdEnvoyer(driveId, parentId, nom, fichier) {
  const jeton = await spdJeton(true);
  const cible = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentId}:/${encodeURIComponent(nom)}`;
  if (fichier.size <= 4 * 1024 * 1024) {
    const r = await fetch(`${cible}:/content?@microsoft.graph.conflictBehavior=rename`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': fichier.type || 'application/octet-stream' },
      body: fichier,
    });
    if (!r.ok) throw new Error(`Envoi refusé (${r.status}).`);
    return r.json();
  }
  const session = await spdGraph(`${cible}:/createUploadSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
  });
  if (!session.ok || !session.json || !session.json.uploadUrl) throw new Error("Session d'envoi refusée.");
  const r = await fetch(session.json.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Length': String(fichier.size), 'Content-Range': `bytes 0-${fichier.size - 1}/${fichier.size}` },
    body: fichier,
  });
  if (!r.ok) throw new Error(`Envoi refusé (${r.status}).`);
  return r.json();
}

// Le point d'entrée : un fichier + un client + un sous-dossier → le lien SharePoint.
async function spdClasser(fichier, client, sousDossier) {
  const segments = spdCheminClient(client, sousDossier);
  if (!segments) throw new Error('Client sans nom : impossible de déterminer son dossier.');
  const { driveId, item } = await spdDossier(segments);
  const depose = await spdEnvoyer(driveId, item.id, fichier.name, fichier);
  return { url: depose.webUrl, id: depose.id, nom: depose.name, chemin: segments.join(' / ') };
}

// ── Classer l'offre d'une compagnie ────────────────────────────────────────────────────────────
// Même geste que « 📎 Joindre l'offre », mais le PDF va dans le dossier du client au lieu du
// stockage du CRM. L'entrée garde l'adresse SharePoint : plus rien à redescendre pour relire.
async function spdClasserOffre(demandeOffreId, idx, input, refreshType, refreshId) {
  const fichier = input && input.files && input.files[0];
  if (!fichier) return;
  input.value = '';
  try {
    showError('Classement dans SharePoint…');
    const rows = await dbGet('demandes_offre', `id=eq.${demandeOffreId}&select=id,client_id,opportunite_id,compagnies_envoi`);
    const d = Array.isArray(rows) && rows[0];
    if (!d) throw new Error("Demande d'offre introuvable");
    const client = (allClients || []).find(c => c.id === d.client_id);
    if (!client) throw new Error('Client introuvable sur ce dossier');

    const depose = await spdClasser(fichier, client, 'Offres');

    const compagniesEnvoi = (d.compagnies_envoi || []).map(e => ({ ...e }));
    if (!compagniesEnvoi[idx]) throw new Error('Compagnie introuvable sur ce dossier');
    compagniesEnvoi[idx].sharepoint_url = depose.url;
    compagniesEnvoi[idx].sharepoint_id = depose.id;
    compagniesEnvoi[idx].offre_nom = depose.nom;
    const r = await dbPatch('demandes_offre', demandeOffreId, { compagnies_envoi: compagniesEnvoi });
    if (r && r.error) throw new Error(errMsg(r));

    if (typeof logAction === 'function') logAction('classer_offre_sharepoint', 'demandes_offre', demandeOffreId, `${compagniesEnvoi[idx].compagnie} — ${depose.nom}`);
    if (d.opportunite_id && typeof ajouterLigneHistoriqueOpportunite === 'function') {
      await ajouterLigneHistoriqueOpportunite(d.opportunite_id, `📁 Offre classée dans SharePoint — ${compagniesEnvoi[idx].compagnie} — ${depose.nom}`);
    }
    showError(`✓ Classée dans ${depose.chemin}`);
    if (refreshType === 'client' && refreshId) showClient(refreshId);
    else if (refreshType === 'opp' && refreshId) renderDemandeOffreLieeOpportunite(refreshId);
  } catch (e) {
    showError(e.message === 'consentement requis'
      ? "Autorisation SharePoint pas encore accordée — réessaie, une fenêtre Microsoft va la demander."
      : 'SharePoint : ' + e.message);
  }
}

function spdOuvrir(url) {
  if (url) window.open(url, '_blank', 'noopener');
}
