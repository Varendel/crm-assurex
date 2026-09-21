// ═══ ESPACE CLIENT (20.09.2026) ════════════════════════════════════════════════════════════════
// Un compte par client, avec SON mot de passe (demande de Jonathan). Le compte est créé par le
// courtier depuis la fiche client ; le mot de passe est généré côté serveur (fonction Supabase
// « acces-client », seule à détenir la clé de service) et affiché une seule fois pour être
// transmis au client. Côté base, un compte client ne voit que sa fiche, ses contrats en vigueur,
// ses véhicules, ses mandats signés et ses rendez-vous : toutes les autres règles d'accès le
// refusent explicitement (migration 20260920_role_client_acces).
// Ici, uniquement l'affichage : aucune donnée financière (commissions, bordereaux) n'est chargée.

const EC_FONCTION_URL = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/acces-client';

// Côté client, le produit s'appelle REX CLOUD : jamais « REX CRM », qui est l'outil interne
// (demande de Jonathan, 20.09.2026). Le lien envoyé au client porte ?espace=client pour que la
// page de connexion affiche déjà cette identité, avant même qu'il se connecte.
const EC_MARQUE = 'REX CLOUD';
const EC_NUAGE_SVG = '<svg viewBox="0 0 220 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M52 104c-20 0-34-13-34-30 0-15 11-27 26-29 4-20 21-34 42-34 19 0 35 11 41 28 3-1 6-1 9-1 18 0 32 13 32 30s-14 30-32 30H52z" fill="currentColor" opacity=".95"/></svg>';
function ecModeCloud(actif) { document.body.classList.toggle('mode-cloud', actif !== false); }
// La page de connexion s'affiche déjà en REX CLOUD quand le lien vient d'une invitation client
// Sous-domaine dédié (20.09.2026) : espace.assurex.ch ouvre directement REX CLOUD, sans paramètre
// dans l'adresse. Le paramètre ?espace=client reste accepté pour les liens déjà envoyés.
function ecSousDomaineClient() {
  const h = (location.hostname || '').toLowerCase();
  return /^(espace|cloud|client|mon)\./.test(h);
}
(function ecDetecterLienClient() {
  const appliquer = () => {
    if (!/[?&]espace=client/.test(location.search) && !ecSousDomaineClient()) return;
    ecModeCloud(true);
    document.title = `${EC_MARQUE} — Espace client`;
    // Logo EX.GROUP : on reprend celui du code (js/15) plutôt qu'une copie du tracé
    // Le lien « Vous êtes conseiller ? Ouvrir REX CRM » est retiré (21.09.2026, demande de
    // Jonathan) : un client n'a pas à voir l'entrée du CRM. Le conseiller passe par l'adresse
    // sans ?espace=client ; le sous-domaine dédié séparera bientôt les deux entièrement.
    const ex = document.querySelector('.cloud-signature .cloud-ex');
    if (ex && typeof LOGO_EXGROUPE_SVG !== 'undefined') {
      const span = document.createElement('span');
      span.className = 'cloud-ex';
      span.innerHTML = LOGO_EXGROUPE_SVG;
      ex.replaceWith(span);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appliquer); else appliquer();
})();

function ecEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Repasser du côté conseiller : on retire ?espace=client et l'identité REX CLOUD, puis on
// recharge sur la page de connexion normale du CRM.
function ouvrirCoteConseiller() {
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  location.href = location.pathname;
}

// ── Connexion : ce compte est-il un accès client ? ──────────────────────────────────────────────
async function ecAccesDeLEmail(email) {
  try {
    const r = await dbGet('acces_clients', `email=eq.${encodeURIComponent(String(email).toLowerCase())}&actif=is.true&select=*`);
    return Array.isArray(r) && r[0] ? r[0] : null;
  } catch (e) { return null; }
}

async function ecEntrerEspaceClient(acces, email) {
  currentUser = { id: email, email, prenom: '', nom: '', role: 'client', client_id: acces.client_id };
  document.getElementById('login-screen').style.display = 'none';
  const app = document.getElementById('app');
  app.classList.add('active');
  document.body.classList.add('mode-espace-client');
  ecModeCloud(true);
  document.title = `${EC_MARQUE} — Mon espace assurances`;
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = '<div class="loader">Chargement de votre espace…</div>';
  const [clients, contrats, vehicules, rdv, mandats, messages, transferts] = await Promise.all([
    dbGet('clients', `id=eq.${acces.client_id}&select=*`).catch(() => []),
    dbGet('contrats', `client_id=eq.${acces.client_id}&select=*&order=date_echeance.asc`).catch(() => []),
    dbGet('vehicules', `client_id=eq.${acces.client_id}&select=*`).catch(() => []),
    dbGet('rendez_vous', `client_id=eq.${acces.client_id}&select=*&order=date_heure.asc`).catch(() => []),
    dbGet('mandats_signes', `client_id=eq.${acces.client_id}&select=*`).catch(() => []),
    dbGet('messages_clients', `client_id=eq.${acces.client_id}&select=*&order=created_at.desc&limit=30`).catch(() => []),
    dbGet('demandes_transfert', `client_id=eq.${acces.client_id}&select=*&order=created_at.desc&limit=10`).catch(() => []),
  ]);
  window._ec = { client: (clients || [])[0] || null, contrats: contrats || [], vehicules: vehicules || [], rdv: rdv || [], mandats: mandats || [], messages: messages || [], transferts: transferts || [] };
  // Trace de connexion. Elle passe par une fonction en base (marquer_acces_client) et non par un
  // PATCH : la RLS ne donne au client que la LECTURE de sa ligne d'accès, si bien que le PATCH
  // était refusé en silence et la fiche affichait « jamais connecté » à tort (corrigé le
  // 20.09.2026). La fonction ne touche qu'à dernier_acces, et seulement pour l'appelant.
  try {
    const t = await getValidAccessToken();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/marquer_acces_client`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) console.warn('Trace de connexion non enregistrée :', r.status);
  } catch (e) { console.warn('Trace de connexion non enregistrée :', e.message); }
  if (main) main.innerHTML = ecVueEspaceClient();
}

// ── L'espace lui-même ───────────────────────────────────────────────────────────────────────────
function ecNomClient(c) { return c ? (typeof estEntreprise === 'function' && estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : ''; }

// 22.09.2026 : le client voyait une autre date limite que le CRM. Deux défauts : setMonth
// débordait (31.12 − 3 mois donnait 1er octobre au lieu du 30 septembre) et `Number(preavis) || 3`
// transformait un préavis de 0 mois en 3 mois. On reprend le calcul du CRM (rnDateLimite, js/11),
// qui gère la fin de mois, le préavis 0 et l'échéance LAMal reconduite d'année en année.
function ecDateLimiteResiliation(ct) {
  if (!ct.date_echeance) return null;
  if (typeof rnDateLimite === 'function') return rnDateLimite(ct);
  const p = ct.preavis_mois;
  const mois = (p !== null && p !== undefined && p !== '' && !isNaN(Number(p))) ? Number(p) : (/lamal/i.test(ct.produit || '') ? 1 : 3);
  // Repli (js/11 absent) : même règle de fin de mois que rnDateLimite, sans débordement.
  const [y, m, j] = String(ct.date_echeance).slice(0, 10).split('-').map(Number);
  const cible = new Date(Date.UTC(y, m - 1 - mois, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return cible.toISOString().slice(0, 10);
}

// 22.09.2026 : les rendez-vous s'affichaient avec l'heure UTC (date_heure.slice(11, 16)) — un
// rendez-vous à 10 h apparaissait à 08:00 en été. On convertit en heure de Zurich, et la date
// aussi (un rendez-vous tôt le matin pouvait tomber la veille). Partagé par js/52 et js/112.
function ecRdvJour(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }); } catch (e) { return String(iso).slice(0, 10); }
}
function ecRdvHeure(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' }); } catch (e) { return String(iso).slice(11, 16); }
}

function ecVueEspaceClient() {
  const E = window._ec || {};
  const c = E.client;
  const actifs = (E.contrats || []).filter(ct => ['actif', 'renouveler', 'en_cours'].includes(ct.statut));
  const prime = actifs.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
  const prochains = (E.rdv || []).filter(r => r.date_heure && r.date_heure >= new Date().toISOString() && r.statut !== 'annule');
  const auj = new Date().toISOString().slice(0, 10);
  return `<div class="dbx ec">
    <section class="cf-hero">
      <div class="cf-hero-deco" aria-hidden="true"></div>
      <div class="cf-hero-texte">
        <span class="ec-marque">${EC_NUAGE_SVG}<b>REX</b> CLOUD</span>
        <span class="cf-surtitre">Mon espace assurances</span>
        <h1>${ecEsc(ecNomClient(c) || 'Bienvenue')}</h1>
        <p>Vos contrats, vos échéances et vos rendez-vous, à jour. Pour toute modification, votre conseiller reste votre interlocuteur.</p>
      </div>
      <div class="cf-hero-actions">
        <div class="cf-boutons">
          <button type="button" class="fcx-btn-blanc" onclick="ecOuvrirTransfert()">🤝 Transférer la gestion de mes assurances <small>appuyez pour plus d’infos — service gratuit</small></button>
          <button type="button" class="fcx-btn-verre" onclick="ecOuvrirMessage()">✉️ Laisser un message</button>
          <button type="button" class="fcx-btn-verre" onclick="ecDeconnexion()">Se déconnecter</button>
        </div>
      </div>
    </section>

    <div class="dbx-kpis" style="margin-top:16px">
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 0, label: 'Contrats en vigueur', valeur: actifs.length, sous: `${(E.vehicules || []).length} véhicule(s) assuré(s)` }) : ''}
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 1, label: 'Primes annuelles', valeur: prime, prefixe: 'CHF ', sous: 'total de vos contrats en vigueur' }) : ''}
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 2, label: 'Prochain rendez-vous', valeur: prochains.length, sous: prochains[0] ? fmtDate(ecRdvJour(prochains[0].date_heure)) : 'aucun rendez-vous planifié' }) : ''}
    </div>

    <section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Mes contrats</h2><span class="dbx-carte-sous">${actifs.length} en vigueur</span></header>
      ${actifs.length ? `<div class="ec-contrats">${actifs.map(ct => {
        const limite = ecDateLimiteResiliation(ct);
        const bientot = limite && limite >= auj && limite <= new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
        return `<article class="ec-contrat">
          <span class="ec-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 34) : ''}</span>
          <div class="ec-corps">
            <b>${ecEsc(ct.produit || 'Contrat')}</b>
            <small>${ecEsc(ct.compagnie || '')}${ct.numero_police ? ` · police ${ecEsc(ct.numero_police)}` : ''}</small>
            ${ct.modules ? `<small class="ec-modules">${ecEsc(ct.modules)}</small>` : ''}
          </div>
          <div class="ec-dates">
            ${ct.date_debut ? `<span>Depuis le ${fmtDate(ct.date_debut)}</span>` : ''}
            ${ct.date_echeance ? `<span>Échéance ${fmtDate(ct.date_echeance)}</span>` : '<span>Sans échéance</span>'}
            ${limite ? `<span class="${bientot ? 'ec-alerte' : ''}">Résiliation jusqu’au ${fmtDate(limite)}</span>` : ''}
          </div>
          <div class="ec-prime">${ct.prime_annuelle ? `CHF ${fmtCHF(Math.round(ct.prime_annuelle))}<small>/an</small>` : '—'}</div>
          <button type="button" class="ec-contacter" onclick="ecOuvrirMessage('${ct.id}')" title="Une question sur ce contrat ?">💬 Contacter mon conseiller</button>
        </article>`;
      }).join('')}</div>` : '<div class="dbx-vide-petit">Aucun contrat en vigueur pour l’instant.</div>'}
    </section>

    ${(E.vehicules || []).length ? `<section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Mes véhicules</h2></header>
      <div class="ec-vehicules">${E.vehicules.map(v => `<span class="ec-vehicule"><b>${ecEsc([v.marque, v.modele].filter(Boolean).join(' ') || v.type_vehicule || 'Véhicule')}</b>${v.numero_plaque ? `<em>${ecEsc(v.numero_plaque)}</em>` : ''}</span>`).join('')}</div>
    </section>` : ''}

    ${prochains.length ? `<section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Mes rendez-vous</h2></header>
      <div class="sfx-liste">${prochains.map(r => `<div class="sfx-ligne"><span class="sfx-corps"><b>${ecEsc(r.type || 'Rendez-vous')}</b><small>${ecEsc(r.lieu || r.mode || '')}</small></span><span class="ck-date">${fmtDate(ecRdvJour(r.date_heure))} ${ecRdvHeure(r.date_heure)}</span></div>`).join('')}</div>
    </section>` : ''}

    ${ecCarteTransfert()}

    ${(E.messages || []).length ? `<section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Mes messages</h2><span class="dbx-carte-sous">${E.messages.length} envoyé(s)</span></header>
      <div class="sfx-liste">${E.messages.slice(0, 6).map(m => `<div class="sfx-ligne"><span class="sfx-corps"><b>${ecEsc(m.sujet || 'Message')}</b><small>${ecEsc((m.message || '').slice(0, 120))}${(m.message || '').length > 120 ? '…' : ''}</small>${m.reponse ? `<small class="ec-reponse">Réponse : ${ecEsc(m.reponse.slice(0, 160))}</small>` : ''}</span><span class="ck-date">${m.statut === 'traite' ? '✓ traité' : m.statut === 'lu' ? 'lu' : 'transmis'} · ${fmtDate((m.created_at || '').slice(0, 10))}</span></div>`).join('')}</div>
    </section>` : ''}

    <section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Vos documents</h2></header>
      <div class="dbx-vide-petit">Les polices et attestations sont transmises par votre conseiller. Écrivez-lui pour en recevoir une copie — le téléchargement direct arrivera dans une prochaine version.</div>
    </section>

    <div class="ec-pied">${(E.mandats || []).length ? `Mandat de courtage signé le ${fmtDate((E.mandats[0].created_at || '').slice(0, 10))} · ` : ''}${EC_MARQUE} — Agrément FINMA F01565757
      <div class="ec-signature sombre"><span style="font-size:11px">by</span><img src="assets/logos/assurex.png" alt="Assurex"/>${typeof LOGO_EXGROUPE_SVG !== 'undefined' ? `<span style="display:inline-flex;height:16px">${LOGO_EXGROUPE_SVG}</span>` : ''}</div>
    </div>
  </div>`;
}

// Transfert de la gestion des contrats (js/51) : proposé tant qu'aucune demande n'est en cours,
// puis remplacé par l'état d'avancement de la demande déposée.
function ecCarteTransfert() {
  const E = window._ec || {};
  const dem = (E.transferts || [])[0];
  const enCours = dem && ['nouveau', 'mandat_genere', 'envoye'].includes(dem.statut);
  if (enCours) {
    const etapes = [['nouveau', 'Demande reçue'], ['mandat_genere', 'Mandat établi'], ['envoye', 'Envoyé à vos assureurs']];
    const idx = etapes.findIndex(e => e[0] === dem.statut);
    return `<section class="dbx-carte ec-transfert" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Transfert de la gestion</h2><span class="dbx-carte-sous">déposé le ${fmtDate((dem.created_at || '').slice(0, 10))}</span></header>
      <div class="ec-suivi">${etapes.map((e, i) => `<span class="ec-suivi-etape ${i <= idx ? 'faite' : ''}">${i <= idx ? '●' : '○'} ${e[1]}</span>`).join('')}</div>
      <p class="ec-suivi-txt">Nous nous occupons de tout : vos assureurs nous transmettent vos polices, vous n’avez rien à faire. Vos couvertures restent inchangées.</p>
    </section>`;
  }
  return `<section class="dbx-carte ec-transfert" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Transférer la gestion de mes contrats</h2></header>
    <p class="ec-suivi-txt">Confiez-nous le suivi de vos assurances, même celles souscrites ailleurs : nous récupérons vos polices, surveillons vos échéances et comparons pour vous. Vos contrats et vos couvertures ne changent pas, et le mandat est résiliable en tout temps.</p>
    <button type="button" class="fcx-btn-blanc ec-btn-transfert" onclick="ecOuvrirTransfert()">🤝 Transférer la gestion de mes contrats <small>appuyez pour plus d’infos — service gratuit</small></button>
  </section>`;
}

async function ecDeconnexion() {
  document.body.classList.remove('mode-espace-client');
  // On reste en identité REX CLOUD sur la page de connexion du client
  try { history.replaceState(null, '', location.pathname + '?espace=client'); } catch (e) {}
  if (typeof supabaseAuthLogout === 'function') await supabaseAuthLogout();
  location.reload();
}

// ── Badge « espace client » sur la fiche (20.09.2026) ───────────────────────────────────────────
// On charge une fois la liste des accès au démarrage (cf. chargerDonnees) pour pouvoir dire d'un
// coup d'œil, sur chaque fiche, si le client a son espace REX CLOUD et s'il s'y est déjà connecté.
window.EC_ACCES = window.EC_ACCES || {};

async function ecChargerAccesClients() {
  try {
    const rows = await dbGet('acces_clients', 'select=client_id,email,actif,cree_le,dernier_acces');
    const carte = {};
    for (const r of rows || []) if (r.client_id) carte[r.client_id] = r;
    window.EC_ACCES = carte;
  } catch (e) { /* liste indisponible : le badge invite simplement à créer l'accès */ }
}

function ecAccesDuClient(clientId) { return (window.EC_ACCES || {})[clientId] || null; }

// Trois états : espace créé et déjà utilisé, espace créé mais jamais ouvert, pas d'espace.
// Le badge est cliquable : il ouvre la même fenêtre que l'onglet Admin.
function ecBadgeEspaceClient(clientId) {
  const a = ecAccesDuClient(clientId);
  const ouvrir = `onclick="ouvrirAccesEspaceClient('${clientId}')"`;
  if (!a) return `<button type="button" class="fcx-badge ec-badge" ${ouvrir} title="Ce client n’a pas encore d’espace REX CLOUD — cliquer pour le créer">☁️ + espace client</button>`;
  if (!a.actif) return `<button type="button" class="fcx-badge ec-badge suspendu" ${ouvrir} title="Accès désactivé — cliquer pour le réactiver">☁️ Espace désactivé</button>`;
  const jamais = !a.dernier_acces;
  const depuis = a.cree_le ? ` le ${fmtDate(String(a.cree_le).slice(0, 10))}` : '';
  const vu = jamais ? 'jamais connecté' : `vu le ${fmtDate(String(a.dernier_acces).slice(0, 10))}`;
  return `<button type="button" class="fcx-badge ec-badge on${jamais ? ' attente' : ''}" ${ouvrir}
    title="Espace REX CLOUD créé${depuis} · ${vu} — cliquer pour gérer l’accès">☁️ Espace client créé<span class="ec-badge-sous">${vu}</span></button>`;
}

// ── Côté courtier : créer / réinitialiser / désactiver l'accès d'un client ──────────────────────
async function ouvrirAccesEspaceClient(clientId) {
  document.getElementById('modal-onglet-admin')?.remove();
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const rows = await dbGet('acces_clients', `client_id=eq.${clientId}&select=*`).catch(() => []);
  const acces = Array.isArray(rows) && rows[0] ? rows[0] : null;
  const email = (acces && acces.email) || c.email || '';
  creerModale('modal-acces-client', `
    <div class="opx-modale" role="dialog" aria-modal="true" aria-labelledby="ec-acces-titre">
      <h3 id="ec-acces-titre">🔐 Accès à l’espace client</h3>
      <div class="opx-modale-sous">${ecEsc(ecNomClient(c))}</div>
      <div class="ec-etat ${acces ? (acces.actif ? 'actif' : 'inactif') : 'aucun'}">
        ${acces ? (acces.actif ? `✓ Accès actif depuis le ${fmtDate((acces.cree_le || '').slice(0, 10))}${acces.dernier_acces ? ` · dernière connexion le ${fmtDate(acces.dernier_acces.slice(0, 10))}` : ' · jamais connecté'}` : '⏸ Accès désactivé')
                : 'Aucun accès pour l’instant. Le client recevra un identifiant (son e-mail) et un mot de passe.'}
      </div>
      <div class="form-field"><label class="form-label" for="ec-email">Identifiant (e-mail du client)</label>
        <input class="form-input" id="ec-email" type="email" value="${ecEsc(email)}" ${acces ? 'readonly' : ''} placeholder="client@exemple.ch"/></div>
      <div id="ec-resultat"></div>
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-acces-client').remove()">Fermer</button>
        ${acces && acces.actif ? `<button type="button" class="btn-secondary" onclick="ecAction('${clientId}','desactiver')">⏸ Désactiver</button>` : ''}
        ${acces && !acces.actif ? `<button type="button" class="btn-secondary" onclick="ecAction('${clientId}','reactiver')">▶ Réactiver</button>` : ''}
        <button type="button" class="btn-save" id="ec-btn" onclick="ecAction('${clientId}','${acces ? 'reinitialiser' : 'creer'}')">${acces ? '🔁 Nouveau mot de passe' : '✓ Créer l’accès'}</button>
      </div>
      <div class="ec-note">Le mot de passe n’est affiché qu’une fois et n’est stocké nulle part : transmets-le au client, il pourra le changer depuis la page de connexion.</div>
    </div>`, { padding: '16px' });
}

// Envoi des accès par e-mail depuis le compte Outlook connecté — seule action qui envoie
// réellement quelque chose, toujours après confirmation explicite (jamais automatique).
async function ecEnvoyerAcces() {
  const ctx = window._ecEnvoi;
  if (!ctx) { showError('Rien à envoyer — recrée l’accès pour obtenir un mot de passe.'); return; }
  if (!confirm(`Envoyer les accès REX CLOUD à ${ctx.email} depuis ton compte Outlook ?\n\nLe mot de passe figure en clair dans le message : c'est le seul envoi, il ne sera plus affiché ensuite.`)) return;
  if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) {
    showError('Connecte-toi à Outlook (bouton Microsoft dans le menu) pour envoyer, ou utilise « Copier le message ».');
    return;
  }
  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: `Votre espace ${EC_MARQUE}${ctx.nom ? ' — ' + ctx.nom : ''}`,
          body: { contentType: 'text', content: ctx.message },
          toRecipients: [{ emailAddress: { address: ctx.email } }],
        },
        saveToSentItems: true,
      }),
    });
    if (r.status === 401) { showError('Session Outlook expirée — reconnecte-toi puis réessaie.'); return; }
    if (!r.ok) { showError('Échec de l’envoi via Outlook — utilise « Copier le message ».'); return; }
  } catch (e) { showError('Erreur réseau : ' + e.message); return; }
  showError(`✓ Accès envoyés à ${ctx.email}.`);
  if (typeof logAction === 'function') logAction('envoi_acces_client', 'acces_clients', null, ctx.email);
  window._ecEnvoi = null;
  document.getElementById('modal-acces-client')?.remove();
}

async function ecAction(clientId, action) {
  const btn = document.getElementById('ec-btn');
  const zone = document.getElementById('ec-resultat');
  const email = (document.getElementById('ec-email')?.value || '').trim();
  if (action !== 'desactiver' && action !== 'reactiver' && !email) { showError('Indique l’e-mail du client.'); return; }
  if (action === 'desactiver' && !confirm('Désactiver l’accès de ce client à son espace ?')) return;
  if (btn) { btn.disabled = true; btn.textContent = 'En cours…'; }
  try {
    const token = await getValidAccessToken();
    const r = await fetch(EC_FONCTION_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, client_id: clientId, email }),
    });
    const data = await r.json();
    if (!r.ok || data.error) { showError('Accès non créé : ' + (data.error || r.status)); if (btn) { btn.disabled = false; btn.textContent = '✓ Créer l’accès'; } return; }
    if (data.mot_de_passe) {
      const c = allClients.find(x => x.id === clientId);
      const lien = `${location.origin}${location.pathname}?espace=client`;
      const message = `Bonjour,\n\nVotre espace ${EC_MARQUE} est ouvert : ${lien}\n\nIdentifiant : ${data.email}\nMot de passe : ${data.mot_de_passe}\n\nVous y retrouvez vos contrats, vos échéances et vos rendez-vous, à jour en permanence. Je reste à votre disposition.\n\nJonathan Özkan — Assurex Sàrl`;
      if (zone) zone.innerHTML = `<div class="ec-mdp"><div class="ec-mdp-tete">Mot de passe (affiché une seule fois)</div>
        <code>${ecEsc(data.mot_de_passe)}</code>
        <div class="ec-mdp-actions">
          <button type="button" class="btn-save" onclick="ecEnvoyerAcces()">📨 Envoyer via Outlook…</button>
          <button type="button" class="btn-secondary" onclick="navigator.clipboard.writeText('${data.mot_de_passe.replace(/'/g, "\\'")}').then(()=>showError('✓ Mot de passe copié'))">📋 Copier le mot de passe</button>
          <button type="button" class="btn-secondary" onclick="navigator.clipboard.writeText(${JSON.stringify(message).replace(/"/g, '&quot;')}).then(()=>showError('✓ Message copié'))">✉️ Copier le message</button>
          <a class="btn-secondary" href="mailto:${encodeURIComponent(data.email)}?subject=${encodeURIComponent('Votre espace REX CLOUD')}&body=${encodeURIComponent(message)}">📧 Ouvrir dans mon client mail</a>
        </div>
        <div class="ec-note">Rien n’est envoyé automatiquement : choisis comment transmettre ces accès.</div></div>`;
      // Mémorisé pour l'envoi Outlook, jamais enregistré ailleurs (perdu dès que la fenêtre se ferme)
      window._ecEnvoi = { email: data.email, message, nom: ecNomClient(allClients.find(x => x.id === clientId)) };
      if (typeof logAction === 'function') logAction(action === 'creer' ? 'creer_acces_client' : 'reinit_mdp_client', 'acces_clients', clientId, data.email);
    } else {
      showError('✓ Accès mis à jour.');
      document.getElementById('modal-acces-client')?.remove();
    }
    // Le badge de la fiche doit refléter tout de suite le nouvel état
    await ecChargerAccesClients();
    if (typeof showClient === 'function' && document.querySelector('.fcx-hero')) showClient(clientId);
  } catch (e) {
    showError('Erreur : ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔁 Nouveau mot de passe'; }
}
