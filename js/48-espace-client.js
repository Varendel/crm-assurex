// ═══ ESPACE CLIENT (20.09.2026) ════════════════════════════════════════════════════════════════
// Un compte par client, avec SON mot de passe (demande de Jonathan). Le compte est créé par le
// courtier depuis la fiche client ; le mot de passe est généré côté serveur (fonction Supabase
// « acces-client », seule à détenir la clé de service) et affiché une seule fois pour être
// transmis au client. Côté base, un compte client ne voit que sa fiche, ses contrats en vigueur,
// ses véhicules, ses mandats signés et ses rendez-vous : toutes les autres règles d'accès le
// refusent explicitement (migration 20260920_role_client_acces).
// Ici, uniquement l'affichage : aucune donnée financière (commissions, bordereaux) n'est chargée.

const EC_FONCTION_URL = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/acces-client';

function ecEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

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
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = '<div class="loader">Chargement de votre espace…</div>';
  const [clients, contrats, vehicules, rdv, mandats] = await Promise.all([
    dbGet('clients', `id=eq.${acces.client_id}&select=*`).catch(() => []),
    dbGet('contrats', `client_id=eq.${acces.client_id}&select=*&order=date_echeance.asc`).catch(() => []),
    dbGet('vehicules', `client_id=eq.${acces.client_id}&select=*`).catch(() => []),
    dbGet('rendez_vous', `client_id=eq.${acces.client_id}&select=*&order=date_heure.asc`).catch(() => []),
    dbGet('mandats_signes', `client_id=eq.${acces.client_id}&select=*`).catch(() => []),
  ]);
  window._ec = { client: (clients || [])[0] || null, contrats: contrats || [], vehicules: vehicules || [], rdv: rdv || [], mandats: mandats || [] };
  try { await dbPatch('acces_clients', acces.id, { dernier_acces: new Date().toISOString() }); } catch (e) { /* sans importance */ }
  if (main) main.innerHTML = ecVueEspaceClient();
}

// ── L'espace lui-même ───────────────────────────────────────────────────────────────────────────
function ecNomClient(c) { return c ? (typeof estEntreprise === 'function' && estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : ''; }

function ecDateLimiteResiliation(ct) {
  if (!ct.date_echeance) return null;
  const mois = Number(ct.preavis_mois) || (/lamal/i.test(ct.produit || '') ? 1 : 3);
  const d = new Date(ct.date_echeance + 'T12:00:00');
  d.setMonth(d.getMonth() - mois);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
        <span class="cf-surtitre">Mon espace assurances</span>
        <h1>${ecEsc(ecNomClient(c) || 'Bienvenue')}</h1>
        <p>Vos contrats, vos échéances et vos rendez-vous, à jour. Pour toute modification, votre conseiller reste votre interlocuteur.</p>
      </div>
      <div class="cf-hero-actions">
        <div class="cf-boutons">
          <a class="fcx-btn-blanc" href="mailto:jo@cofidex.ch?subject=${encodeURIComponent('Mon espace client — ' + (ecNomClient(c) || ''))}">✉️ Écrire à mon conseiller</a>
          <button type="button" class="fcx-btn-verre" onclick="ecDeconnexion()">Se déconnecter</button>
        </div>
      </div>
    </section>

    <div class="dbx-kpis" style="margin-top:16px">
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 0, label: 'Contrats en vigueur', valeur: actifs.length, sous: `${(E.vehicules || []).length} véhicule(s) assuré(s)` }) : ''}
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 1, label: 'Primes annuelles', valeur: prime, prefixe: 'CHF ', sous: 'total de vos contrats en vigueur' }) : ''}
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 2, label: 'Prochain rendez-vous', valeur: prochains.length, sous: prochains[0] ? fmtDate(prochains[0].date_heure.slice(0, 10)) : 'aucun rendez-vous planifié' }) : ''}
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
        </article>`;
      }).join('')}</div>` : '<div class="dbx-vide-petit">Aucun contrat en vigueur pour l’instant.</div>'}
    </section>

    ${(E.vehicules || []).length ? `<section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Mes véhicules</h2></header>
      <div class="ec-vehicules">${E.vehicules.map(v => `<span class="ec-vehicule"><b>${ecEsc([v.marque, v.modele].filter(Boolean).join(' ') || v.type_vehicule || 'Véhicule')}</b>${v.numero_plaque ? `<em>${ecEsc(v.numero_plaque)}</em>` : ''}</span>`).join('')}</div>
    </section>` : ''}

    ${prochains.length ? `<section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Mes rendez-vous</h2></header>
      <div class="sfx-liste">${prochains.map(r => `<div class="sfx-ligne"><span class="sfx-corps"><b>${ecEsc(r.type || 'Rendez-vous')}</b><small>${ecEsc(r.lieu || r.mode || '')}</small></span><span class="ck-date">${fmtDate(r.date_heure.slice(0, 10))} ${r.date_heure.slice(11, 16)}</span></div>`).join('')}</div>
    </section>` : ''}

    <section class="dbx-carte" style="margin-top:18px"><header class="dbx-carte-tete"><h2>Vos documents</h2></header>
      <div class="dbx-vide-petit">Les polices et attestations sont transmises par votre conseiller. Écrivez-lui pour en recevoir une copie — le téléchargement direct arrivera dans une prochaine version.</div>
    </section>

    <div class="ec-pied">${(E.mandats || []).length ? `Mandat de courtage signé le ${fmtDate((E.mandats[0].created_at || '').slice(0, 10))} · ` : ''}Assurex Sàrl — Agrément FINMA F01565757</div>
  </div>`;
}

async function ecDeconnexion() {
  document.body.classList.remove('mode-espace-client');
  if (typeof supabaseAuthLogout === 'function') await supabaseAuthLogout();
  location.reload();
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
      const message = `Bonjour,\n\nVotre espace client Assurex est ouvert : ${location.origin}${location.pathname}\n\nIdentifiant : ${data.email}\nMot de passe : ${data.mot_de_passe}\n\nVous y retrouvez vos contrats, vos échéances et vos rendez-vous. Je reste à votre disposition.\n\nJonathan Özkan — Assurex Sàrl`;
      if (zone) zone.innerHTML = `<div class="ec-mdp"><div class="ec-mdp-tete">Mot de passe (affiché une seule fois)</div>
        <code>${ecEsc(data.mot_de_passe)}</code>
        <div class="ec-mdp-actions">
          <button type="button" class="btn-secondary" onclick="navigator.clipboard.writeText('${data.mot_de_passe.replace(/'/g, "\\'")}').then(()=>showError('✓ Mot de passe copié'))">📋 Copier</button>
          <button type="button" class="btn-secondary" onclick="navigator.clipboard.writeText(${JSON.stringify(message).replace(/"/g, '&quot;')}).then(()=>showError('✓ Message copié'))">✉️ Copier le message</button>
          <a class="btn-secondary" href="mailto:${encodeURIComponent(data.email)}?subject=${encodeURIComponent('Votre espace client Assurex')}&body=${encodeURIComponent(message)}">📧 Ouvrir dans le mail</a>
        </div></div>`;
      if (typeof logAction === 'function') logAction(action === 'creer' ? 'creer_acces_client' : 'reinit_mdp_client', 'acces_clients', clientId, data.email);
    } else {
      showError('✓ Accès mis à jour.');
      document.getElementById('modal-acces-client')?.remove();
    }
  } catch (e) {
    showError('Erreur : ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔁 Nouveau mot de passe'; }
}
