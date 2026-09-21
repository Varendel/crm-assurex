// ═══ REGROUPEMENT : DU MANDAT SIGNÉ AUX POLICES REÇUES (20.09.2026) ═════════════════════════════
// Le cœur économique du service de regroupement. Un client signe UN mandat, mais il faut écrire à
// CHAQUE compagnie, et chacune répond à son rythme. Ce module fait tenir cette chaîne en quelques
// minutes d'humain par mandat — c'est ce coût qui décide si le modèle se porte tout seul à 200
// mandats ou s'il devient ingérable.
//
// Déroulé :
//   1. Le client signe et coche ses compagnies dans REX CLOUD (js/51).
//   2. Ici : une demande est créée par compagnie, avec la liste de ses polices, et le courrier
//      est rédigé — annonce du mandat + demande des polices + transfert de portefeuille.
//   3. Envoi depuis Outlook. Une confirmation par lot, pas par message : trente demandes à
//      confirmer une par une, personne ne le fait deux fois.
//   4. Relance automatique proposée passé le délai, et suivi jusqu'à réception.
//
// Rien ne part sans que Jonathan ait vu ce qui part. C'est sa règle depuis le début, et elle vaut
// encore plus ici : ces courriers engagent le cabinet auprès des compagnies.

const DP_DELAI_RELANCE = 12;        // jours avant de proposer une relance
const DP_DELAI_ABANDON = 35;        // jours après quoi on considère l'absence de réponse

const DP_STATUTS = {
  a_envoyer:    { libelle: 'À envoyer',    couleur: '#F59E0B', ordre: 1 },
  envoyee:      { libelle: 'Envoyée',      couleur: '#2563EB', ordre: 2 },
  relancee:     { libelle: 'Relancée',     couleur: '#7C3AED', ordre: 3 },
  partielle:    { libelle: 'Partielle',    couleur: '#0EA5E9', ordre: 4 },
  recue:        { libelle: 'Reçue',        couleur: '#22C55E', ordre: 5 },
  sans_reponse: { libelle: 'Sans réponse', couleur: '#EF4444', ordre: 6 },
  refusee:      { libelle: 'Refusée',      couleur: '#B91C1C', ordre: 7 },
  annulee:      { libelle: 'Annulée',      couleur: '#94A3B8', ordre: 8 },
};

window._dp = window._dp || { demandes: [], contacts: [], chargement: false, filtre: '' };

function dpEsc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function dpNomClient(id) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === id);
  if (!c) return 'Client';
  return (typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim();
}
function dpJours(depuis) {
  if (!depuis) return null;
  return Math.floor((Date.now() - new Date(depuis).getTime()) / 86400000);
}

// Le nom de compagnie saisi par le client ne correspond pas toujours au libellé du carnet
// d'adresses (« Allianz » contre « Allianz Suisse Crissier ») : on rapproche sur le début du nom.
function dpContactDe(compagnie) {
  const k = String(compagnie || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!k) return null;
  const liste = window._dp.contacts || [];
  return liste.find(c => {
    const n = String(c.compagnie || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return n === k || n.startsWith(k) || k.startsWith(n);
  }) || null;
}

async function dpCharger() {
  try {
    const [demandes, contacts] = await Promise.all([
      dbGet('demandes_polices', 'select=*&order=created_at.desc'),
      dbGet('compagnies_contacts', 'select=compagnie,libelle_contact,email'),
    ]);
    window._dp.demandes = demandes || [];
    window._dp.contacts = contacts || [];
  } catch (e) { window._dp.demandes = []; }
}

// ── Le courrier ─────────────────────────────────────────────────────────────────────────────────
// Un seul message par compagnie, qui fait les trois choses à la fois : annoncer le mandat,
// demander les polices, demander le transfert du portefeuille. Écrire trois fois coûte trois fois
// plus cher et se perd trois fois plus facilement.
function dpRediger(clientId, compagnie, polices) {
  const nom = dpNomClient(clientId);
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === clientId);
  const naissance = c && c.date_naissance ? ` (né${c && c.civilite === 'Madame' ? 'e' : ''} le ${fmtDate(c.date_naissance)})` : '';
  const ide = c && c.ide ? ` — IDE ${c.ide}` : '';
  const adresse = c ? [c.adresse, [c.npa, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';

  const liste = (polices || []).length
    ? (polices || []).map(p => `  • ${p.produit || 'Contrat'}${p.police ? ` — police ${p.police}` : ' — numéro de police inconnu'}`).join('\n')
    : '  • l’ensemble des contrats en cours';

  const objet = `Mandat de courtage — ${nom}${ide ? ` (${c.ide})` : ''} — demande de polices et transfert de portefeuille`;

  // 22.09.2026 : le courrier disait « Vous le trouverez en annexe », alors que l'envoi (Graph
  // sendMail, dpEnvoyerLot) ne joint AUCUNE pièce. Annoncer une annexe absente fait perdre un
  // aller-retour avec la compagnie — et engage le cabinet sur un document qui n'est pas parti.
  // Tant que le PDF n'est pas joint automatiquement, le texte ne promet plus d'annexe.

  const corps = `Madame, Monsieur,

Notre client ${nom}${naissance}${adresse ? `, ${adresse}` : ''} nous a confié la gestion de ses assurances et a signé un mandat de courtage en faveur d’Assurex Sàrl. Nous vous en transmettons une copie sur simple demande.

Nous vous prions de bien vouloir :

1. Enregistrer Assurex Sàrl comme courtier pour les contrats suivants :
${liste}

2. Nous transmettre une copie des polices en vigueur, avec leurs conditions particulières et leurs avenants éventuels.

3. Procéder au transfert du portefeuille de ce client en notre faveur, avec effet immédiat.

Assurex Sàrl est inscrite au registre FINMA des intermédiaires d’assurance non liés (CHE-IGB2B-90443, IDE CHE-396.485.775). Nous restons naturellement à votre disposition pour tout document complémentaire.

En vous remerciant de votre diligence, nous vous adressons, Madame, Monsieur, nos salutations distinguées.

Jonathan Özkan
Assurex Sàrl
079 101 99 26 — jo@cofidex.ch`;

  return { objet, corps };
}

// ── Création depuis une demande de transfert ────────────────────────────────────────────────────
// Une demande par compagnie, jamais une par contrat : la compagnie traite le client, pas la ligne.
async function dpGenererDepuisTransfert(transfertId, silencieux) {
  const rows = await dbGet('demandes_transfert', `id=eq.${transfertId}&select=*`).catch(() => []);
  const t = (rows || [])[0];
  if (!t) { if (!silencieux) showError('Demande de transfert introuvable.'); return 0; }

  const parCompagnie = new Map();
  for (const p of (t.compagnies || [])) {
    const nom = String(p.compagnie || '').trim();
    if (!nom) continue;
    if (!parCompagnie.has(nom)) parCompagnie.set(nom, []);
    if (p.police || p.produit) parCompagnie.get(nom).push({ police: p.police || null, produit: p.produit || null, contrat_id: p.contrat_id || null });
  }
  if (!parCompagnie.size) { if (!silencieux) showError('Aucune compagnie indiquée dans cette demande.'); return 0; }

  await dpCharger();
  const ouvertes = new Set(window._dp.demandes
    .filter(d => d.client_id === t.client_id && ['a_envoyer', 'envoyee', 'relancee'].includes(d.statut))
    .map(d => d.compagnie));

  let crees = 0, doublons = 0;
  for (const [compagnie, polices] of parCompagnie) {
    if (ouvertes.has(compagnie)) { doublons++; continue; }
    const contact = dpContactDe(compagnie);
    const { objet, corps } = dpRediger(t.client_id, compagnie, polices);
    const r = await dbPost('demandes_polices', {
      client_id: t.client_id, transfert_id: t.id, compagnie,
      destinataire: contact ? contact.email : null,
      polices, objet, corps, statut: 'a_envoyer',
      cree_par: (typeof currentUser !== 'undefined' && currentUser) ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : null,
    });
    if (!(r && r.error)) crees++;
  }
  if (!silencieux) {
    showError(`✓ ${crees} demande(s) préparée(s)${doublons ? ` · ${doublons} déjà en cours` : ''}.`);
  }
  // 22.09.2026 : on écrivait statut « en_cours », valeur que demandes_transfert n'accepte pas
  // (nouveau, mandat_genere, envoye, termine, annule) : le PATCH échouait en silence. La valeur
  // juste est « envoye » — mais seulement quand un courrier est réellement PARTI : à ce stade les
  // demandes sont seulement préparées, et « Envoyé aux compagnies » s'afficherait côté client
  // (js/98) alors que rien n'est encore sorti. Le statut est donc posé par dpEnvoyerLot, après un
  // envoi réussi (dpMarquerTransfertEnvoye).
  await dpCharger();
  if (crees && !silencieux && typeof navigate === 'function' && confirm(`${crees} demande(s) de polices préparée(s).\n\nOuvrir la page « Demandes de polices » pour relire les courriers avant envoi ?`)) {
    navigate('demandes-polices');
  }
  return crees;
}

// Le transfert passe à « Envoyé aux compagnies » quand au moins une de ses demandes est partie.
async function dpMarquerTransfertEnvoye(transfertId) {
  if (!transfertId) return;
  const rows = await dbGet('demandes_transfert', `id=eq.${transfertId}&select=id,statut`).catch(() => []);
  const t = (rows || [])[0];
  if (!t || !['nouveau', 'mandat_genere'].includes(t.statut)) return;
  const r = await dbPatch('demandes_transfert', transfertId, { statut: 'envoye', traite_le: new Date().toISOString() });
  if (r && r.error) return;
  const local = (typeof _mc !== 'undefined' && _mc.transferts || []).find(x => x.id === transfertId);
  if (local) local.statut = 'envoye';
}

// ── Envoi ───────────────────────────────────────────────────────────────────────────────────────
// Une confirmation pour le lot, pas une par message : trente confirmations d'affilée ne sont plus
// lues, ce qui revient à ne plus rien contrôler du tout.
// 22.09.2026 : « Rien ne part sans que Jonathan ait vu ce qui part » — mais le bouton Envoyer
// partait sur une simple boîte de confirmation qui ne montre que la compagnie et l'adresse, jamais
// le courrier. Avant tout envoi (ou relance), chaque courrier du lot passe désormais par l'aperçu
// dpVoirCourrier ; le lot ne reprend qu'une fois tous les courriers ouverts, puis la confirmation
// explicite reste la dernière étape.
function dpExigerLecture(liste, suite) {
  window._dp.vus = window._dp.vus || new Set();
  const nonVu = liste.find(d => !window._dp.vus.has(d.id));
  if (!nonVu) return true;
  const reste = liste.filter(d => !window._dp.vus.has(d.id)).length;
  window._dp.suite = suite;
  dpVoirCourrier(nonVu.id, { reste });
  return false;
}

async function dpEnvoyerLot(ids) {
  const liste = (ids || []).map(id => window._dp.demandes.find(d => d.id === id)).filter(Boolean);
  const prets = liste.filter(d => d.destinataire);
  const sansAdresse = liste.filter(d => !d.destinataire);
  if (!prets.length) { showError('Aucune de ces demandes n’a d’adresse de destinataire. Complète le carnet des compagnies.'); return; }
  if (!dpExigerLecture(prets, { type: 'envoi', ids })) return;
  window._dp.suite = null;

  const apercu = prets.slice(0, 8).map(d => `  • ${d.compagnie} → ${d.destinataire} (${dpNomClient(d.client_id)})`).join('\n');
  const message = `Envoyer ${prets.length} demande(s) de polices depuis ton compte Outlook ?\n\n${apercu}${prets.length > 8 ? `\n  … et ${prets.length - 8} autre(s)` : ''}`
    + (sansAdresse.length ? `\n\n${sansAdresse.length} demande(s) sans adresse seront ignorées.` : '');
  if (!confirm(message)) return;

  if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) {
    showError('Connecte-toi à Outlook (bouton Microsoft dans le menu) pour envoyer.');
    return;
  }

  let ok = 0; const echecs = [];
  for (const d of prets) {
    try {
      const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: d.objet,
            body: { contentType: 'text', content: d.corps },
            toRecipients: [{ emailAddress: { address: d.destinataire } }],
          },
          saveToSentItems: true,
        }),
      });
      if (!r.ok) { echecs.push(`${d.compagnie} (${r.status})`); continue; }
      await dbPatch('demandes_polices', d.id, { statut: 'envoyee', envoyee_le: new Date().toISOString() });
      if (typeof logAction === 'function') logAction('envoi_demande_police', 'demandes_polices', d.id, d.compagnie);
      // 22.09.2026 : le transfert d'origine passe à « Envoyé aux compagnies » maintenant, et
      // seulement maintenant — un courrier est effectivement parti.
      if (d.transfert_id) await dpMarquerTransfertEnvoye(d.transfert_id).catch(() => {});
      ok++;
    } catch (e) { echecs.push(`${d.compagnie} (${e.message})`); }
  }
  showError(`✓ ${ok} demande(s) envoyée(s)${echecs.length ? ` · échecs : ${echecs.slice(0, 3).join(', ')}` : ''}.`);
  await dpCharger();
  dpRendre();
}

async function dpRelancerLot(ids) {
  const liste = (ids || []).map(id => window._dp.demandes.find(d => d.id === id)).filter(d => d && d.destinataire);
  if (!liste.length) { showError('Rien à relancer.'); return; }
  // La relance reprend le courrier d'origine : on l'a relu avant de le renvoyer (22.09.2026).
  if (!dpExigerLecture(liste, { type: 'relance', ids })) return;
  window._dp.suite = null;
  if (!confirm(`Relancer ${liste.length} compagnie(s) restée(s) sans réponse ?`)) return;
  if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) {
    showError('Connecte-toi à Outlook pour envoyer les relances.'); return;
  }
  let ok = 0;
  for (const d of liste) {
    const j = dpJours(d.envoyee_le);
    const corps = `Madame, Monsieur,\n\nNous nous permettons de revenir vers vous concernant notre demande du ${fmtDate(String(d.envoyee_le).slice(0, 10))}${j ? ` (il y a ${j} jours)` : ''}, restée sans réponse à ce jour.\n\n${d.corps}`;
    try {
      const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { subject: `Rappel — ${d.objet}`, body: { contentType: 'text', content: corps },
          toRecipients: [{ emailAddress: { address: d.destinataire } }] }, saveToSentItems: true }),
      });
      if (!r.ok) continue;
      await dbPatch('demandes_polices', d.id, { statut: 'relancee', relancee_le: new Date().toISOString(), nb_relances: (d.nb_relances || 0) + 1 });
      ok++;
    } catch (e) { /* on continue le lot */ }
  }
  showError(`✓ ${ok} relance(s) envoyée(s).`);
  await dpCharger();
  dpRendre();
}

async function dpStatut(id, statut) {
  const champs = { statut };
  if (['recue', 'partielle', 'refusee'].includes(statut)) champs.repondue_le = new Date().toISOString();
  const r = await dbPatch('demandes_polices', id, champs);
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  await dpCharger();
  dpRendre();
}

// ── La page ─────────────────────────────────────────────────────────────────────────────────────
function viewDemandesPolices() {
  if (!window._dp.chargement && !window._dp.demandes.length) {
    window._dp.chargement = true;
    dpCharger().then(() => { window._dp.chargement = false; if (currentView === 'demandes-polices') dpRendre(); });
  }
  return `<div id="dp-page">${dpContenu()}</div>`;
}

function dpRendre() {
  const el = document.getElementById('dp-page');
  if (el) el.innerHTML = dpContenu();
}

function dpContenu() {
  const D = window._dp.demandes;
  const f = window._dp.filtre;
  const aEnvoyer = D.filter(d => d.statut === 'a_envoyer');
  const aRelancer = D.filter(d => d.statut === 'envoyee' && dpJours(d.envoyee_le) >= DP_DELAI_RELANCE);
  const enCours = D.filter(d => ['envoyee', 'relancee'].includes(d.statut));
  const abouties = D.filter(d => ['recue', 'partielle'].includes(d.statut));
  const taux = (abouties.length + enCours.length) ? Math.round(abouties.length * 100 / (abouties.length + enCours.length)) : null;

  const liste = f ? D.filter(d => d.statut === f) : D.filter(d => !['annulee'].includes(d.statut));
  const kpi = (l, v, s, ton) => `<div class="dbx-kpi ${ton || ''}"><span class="dbx-kpi-label">${l}</span><span class="dbx-kpi-valeur">${v}</span><span class="dbx-kpi-sous">${s}</span></div>`;

  return `
  <div class="page-header">
    <h2>📤 Demandes de polices</h2>
    <p class="page-sub">Chaque mandat signé devient une demande par compagnie : annonce du mandat, demande des polices et transfert de portefeuille dans un seul courrier.</p>
  </div>

  <div class="dbx-kpis">
    ${kpi('À envoyer', aEnvoyer.length, aEnvoyer.length ? 'prêtes, en attente de ton feu vert' : 'rien en attente', aEnvoyer.length ? 'cf-alerte' : '')}
    ${kpi('En cours', enCours.length, `dont ${aRelancer.length} à relancer`, aRelancer.length ? 'cf-alerte' : '')}
    ${kpi('Polices obtenues', abouties.length, taux == null ? 'pas encore de recul' : `${taux} % des demandes abouties`)}
    ${kpi('Compagnies sollicitées', new Set(D.map(d => d.compagnie)).size, 'depuis le début')}
  </div>

  <div class="dp-actions">
    ${aEnvoyer.length ? `<button type="button" class="btn-save" onclick="dpEnvoyerLot(${JSON.stringify(aEnvoyer.map(d => d.id)).replace(/"/g, '&quot;')})">✉️ Envoyer les ${aEnvoyer.length} demandes prêtes</button>` : ''}
    ${aRelancer.length ? `<button type="button" class="btn-secondary" onclick="dpRelancerLot(${JSON.stringify(aRelancer.map(d => d.id)).replace(/"/g, '&quot;')})">🔔 Relancer les ${aRelancer.length} sans réponse</button>` : ''}
    <select class="form-input dp-filtre" onchange="window._dp.filtre=this.value; dpRendre()">
      <option value="">Tout ce qui est en cours</option>
      ${Object.entries(DP_STATUTS).map(([k, v]) => `<option value="${k}" ${f === k ? 'selected' : ''}>${v.libelle} (${D.filter(d => d.statut === k).length})</option>`).join('')}
    </select>
  </div>

  ${liste.length ? `<div class="dp-liste">${liste.map(dpLigne).join('')}</div>`
    : `<div class="dbx-vide">${typeof rexPoseHtml === 'function' ? rexPoseHtml({ taille: 130, pose: 'confiant' }) : ''}
        <strong>Aucune demande en cours.</strong>
        <span>Les demandes se créent toutes seules quand un client signe son mandat et coche ses compagnies depuis REX CLOUD.</span></div>`}`;
}

function dpLigne(d) {
  const s = DP_STATUTS[d.statut] || DP_STATUTS.a_envoyer;
  const j = dpJours(d.envoyee_le);
  const retard = ['envoyee', 'relancee'].includes(d.statut) && j >= DP_DELAI_RELANCE;
  const nbPolices = (d.polices || []).length;
  return `<div class="dp-ligne ${retard ? 'retard' : ''}">
    <span class="dp-statut" style="--c:${s.couleur}">${s.libelle}</span>
    <div class="dp-corps">
      <div class="dp-titre">${dpEsc(d.compagnie)} · <a href="?client=${d.client_id}" onclick="return irVersClient(event, '${d.client_id}')">${dpEsc(dpNomClient(d.client_id))}</a></div>
      <div class="dp-meta">
        ${nbPolices ? `${nbPolices} police(s) citée(s)` : 'tous contrats'}
        ${d.destinataire ? ` · ${dpEsc(d.destinataire)}` : ' · <span class="dp-manque">adresse manquante</span>'}
        ${d.envoyee_le ? ` · envoyée il y a ${j} j` : ''}
        ${d.nb_relances ? ` · ${d.nb_relances} relance(s)` : ''}
      </div>
    </div>
    <div class="dp-boutons">
      <button type="button" class="btn-secondary" onclick="dpVoirCourrier('${d.id}')">👁 Le courrier</button>
      ${d.statut === 'a_envoyer' ? `<button type="button" class="btn-save" onclick="dpEnvoyerLot(['${d.id}'])">Envoyer</button>` : ''}
      ${['envoyee', 'relancee'].includes(d.statut) ? `<button type="button" class="btn-secondary" onclick="dpStatut('${d.id}','recue')">✓ Reçue</button>` : ''}
    </div>
  </div>`;
}

function dpVoirCourrier(id, opts) {
  const d = window._dp.demandes.find(x => x.id === id);
  if (!d) return;
  // 22.09.2026 : ouvrir le courrier vaut lecture (dpExigerLecture). Quand l'aperçu est ouvert
  // par un envoi ou une relance en attente, son bouton principal enregistre puis reprend le lot.
  window._dp.vus = window._dp.vus || new Set();
  window._dp.vus.add(d.id);
  const suite = window._dp.suite && opts ? window._dp.suite : null;
  const reste = opts && opts.reste ? opts.reste : 0;
  const annexe = /en annexe|ci-joint/i.test(d.corps || '');
  const actionSuite = suite
    ? `<button type="button" class="btn-save" onclick="dpEnregistrerCourrier('${d.id}', true)">${reste > 1 ? `✓ Relu — courrier suivant (${reste - 1} restant${reste - 1 > 1 ? 's' : ''})` : suite.type === 'relance' ? '✓ Relu — préparer la relance…' : '✓ Relu — passer à l’envoi…'}</button>`
    : `<button type="button" class="btn-save" onclick="dpEnregistrerCourrier('${d.id}')">✓ Enregistrer</button>
       ${d.statut === 'a_envoyer' && d.destinataire ? `<button type="button" class="btn-save" onclick="window._dp.suite={type:'envoi',ids:['${d.id}']};dpEnregistrerCourrier('${d.id}', true)">📨 Enregistrer et envoyer…</button>` : ''}`;
  creerModale('modal-dp-courrier', `
    <div class="opx-modale dp-modale" role="dialog" aria-modal="true" aria-label="Courrier à la compagnie">
      <h3>${dpEsc(d.compagnie)}</h3>
      <div class="opx-modale-sous">${d.destinataire ? dpEsc(d.destinataire) : 'aucune adresse — à compléter dans le carnet des compagnies'}</div>
      <div class="form-field"><label class="form-label" for="dp-objet">Objet</label>
        <input class="form-input" id="dp-objet" value="${dpEsc(d.objet || '')}"/></div>
      <div class="form-field"><label class="form-label" for="dp-corps">Message</label>
        <textarea class="form-input dp-corps" id="dp-corps" rows="18">${dpEsc(d.corps || '')}</textarea></div>
      ${annexe ? '<div class="ec-note">⚠️ Ce courrier annonce une pièce jointe (« en annexe » / « ci-joint »), mais l’envoi depuis le CRM ne joint aucun fichier. Corrige le texte ou envoie le mandat séparément.</div>' : ''}
      <div class="ec-note">Le mandat signé n’est pas joint automatiquement à cet envoi. Relis avant d’envoyer : ce courrier engage le cabinet auprès de la compagnie.</div>
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="window._dp.suite=null;document.getElementById('modal-dp-courrier').remove()">Fermer</button>
        ${actionSuite}
      </div>
    </div>`, { padding: '16px' });
}

async function dpEnregistrerCourrier(id, continuer) {
  const objet = document.getElementById('dp-objet')?.value || '';
  const corps = document.getElementById('dp-corps')?.value || '';
  const r = await dbPatch('demandes_polices', id, { objet, corps });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  document.getElementById('modal-dp-courrier')?.remove();
  await dpCharger();
  dpRendre();
  // 22.09.2026 : reprise de l'envoi ou de la relance en attente — qui ouvre le courrier suivant
  // non relu, ou arrive à la confirmation explicite une fois tout relu.
  const suite = continuer ? window._dp.suite : null;
  if (suite) {
    if (suite.type === 'relance') await dpRelancerLot(suite.ids);
    else await dpEnvoyerLot(suite.ids);
    return;
  }
  showError('✓ Courrier enregistré.');
}
