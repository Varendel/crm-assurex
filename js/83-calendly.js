// ═══ CALENDLY (20.09.2026) ═════════════════════════════════════════════════════════════════════
// « Relie Calendly. »
//
// DEUX NIVEAUX, ET LE PREMIER NE DEMANDE RIEN.
// Le lien de réservation est une URL publique : le CRM peut la proposer à un client, la copier,
// la glisser dans un message, sans jeton ni configuration. C'est le niveau qui marche tout de
// suite, et c'est déjà 90 % de l'usage — un client qui prend rendez-vous seul, sans échange de
// courriels pour trouver un créneau.
// Le second niveau remonte les rendez-vous DÉJÀ pris dans le CRM. Celui-là demande un jeton
// personnel Calendly, qui vit dans les secrets Supabase et jamais dans le navigateur (le dépôt
// est public). Tant que le jeton n'est pas posé, l'écran le dit et le premier niveau continue de
// fonctionner : une intégration à moitié configurée ne doit pas casser ce qui marchait sans elle.
//
// LE PRÉREMPLISSAGE. Calendly accepte name= et email= dans l'URL. On les passe pour que le client
// n'ait pas à retaper ce que nous savons déjà. En revanche on ne passe RIEN d'autre : une URL
// voyage dans les journaux du navigateur, l'historique et parfois les référents. Le nom et
// l'adresse sont ce que le formulaire de Calendly demandera de toute façon ; le reste n'a pas à
// s'y trouver.

const CDL_LIEN_BASE = 'https://calendly.com/jo-cofidex';
const CDL_EVENEMENT = 'bilan-gratuit-cofidex-assurex';
const CDL_FONCTION = `${typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : ''}/functions/v1/calendly`;

function cdlEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function cdlNomClient(c) {
  if (!c) return '';
  return (typeof estEntreprise === 'function' && estEntreprise(c))
    ? (c.nom || '')
    : [c.prenom, c.nom].filter(Boolean).join(' ');
}

// Le lien, éventuellement prérempli. `client` peut être un objet client du CRM ou rien.
function cdlLien(client, evenement) {
  const base = `${CDL_LIEN_BASE}/${evenement || CDL_EVENEMENT}`;
  const p = new URLSearchParams();
  const nom = cdlNomClient(client);
  if (nom) p.set('name', nom);
  if (client && client.email) p.set('email', String(client.email).trim().toLowerCase());
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}

async function cdlAppel(action, params) {
  if (typeof SUPABASE_URL === 'undefined') return { ok: false, erreur: 'Configuration absente.' };
  try {
    const jeton = (typeof getValidAccessToken === 'function' ? await getValidAccessToken() : null) || SUPABASE_KEY;
    const r = await fetch(CDL_FONCTION, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(params || {}) }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, erreur: String(e.message || e) };
  }
}

// ── Copier le lien ──────────────────────────────────────────────────────────────────────────────
// navigator.clipboard échoue hors contexte sécurisé et quand l'onglet n'a pas le focus ; on garde
// donc le repli par <textarea>, qui marche partout. Un bouton « copier » qui échoue en silence est
// pire que pas de bouton du tout.
async function cdlCopier(texte, message) {
  let ok = false;
  try { await navigator.clipboard.writeText(texte); ok = true; } catch (e) { /* repli ci-dessous */ }
  if (!ok) {
    try {
      const z = document.createElement('textarea');
      z.value = texte; z.setAttribute('readonly', '');
      z.style.cssText = 'position:fixed;top:-9999px;opacity:0';
      document.body.appendChild(z); z.select();
      ok = document.execCommand('copy');
      z.remove();
    } catch (e) { ok = false; }
  }
  if (typeof showError === 'function') {
    showError(ok ? `✓ ${message || 'Lien copié'}` : 'Copie impossible — sélectionnez le lien à la main.');
  }
  return ok;
}

function cdlCopierLienClient(clientId) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === clientId);
  cdlCopier(cdlLien(c), 'Lien de rendez-vous copié' + (c ? ` (prérempli pour ${cdlNomClient(c)})` : ''));
}

// ── Espace client : proposer le rendez-vous ─────────────────────────────────────────────────────
// Le bouton « Demander un rendez-vous » ouvrait un message : le client écrit, on lit, on répond,
// on propose trois créneaux, il en choisit un. Quatre allers-retours pour poser une date. Le lien
// Calendly la pose en une fois. On garde quand même le message : certains préfèrent écrire, et
// pour eux un agenda en libre-service est une porte fermée.
function cdlOngletRendezVous() {
  const E = window._ec || {};
  const lien = cdlLien(E.client);
  return `<div class="cdl-bloc">
    <a class="btn-save cdl-principal" href="${cdlEsc(lien)}" target="_blank" rel="noopener">
      📅 Choisir un créneau maintenant</a>
    <button type="button" class="btn-secondary" onclick="ecOuvrirMessageMotif('rendez_vous')">
      ✍️ Préférer m’écrire</button>
    <small>Vous voyez les disponibilités réelles et vous réservez en une fois. Le rendez-vous se
      tient par Teams ; vous recevez le lien par courriel.</small>
  </div>`;
}

// On remplace le bouton de rendez-vous de l'onglet conseiller (js/79), sans toucher au reste.
(function cdlBrancherEspaceClient() {
  if (typeof ecpOngletConseiller !== 'function') return;
  const origine = ecpOngletConseiller;
  window.ecpOngletConseiller = function () {
    const html = origine.apply(this, arguments);
    return html.replace(
      /<button type="button" class="btn-secondary" onclick="ecOuvrirMessageMotif\('rendez_vous'\)">[^<]*<\/button>/,
      `<a class="btn-secondary" href="${cdlEsc(cdlLien((window._ec || {}).client))}" target="_blank" rel="noopener">📅 Prendre rendez-vous</a>`,
    );
  };
  // ecOngletConseiller pointe sur l'ancienne référence : on le repointe.
  if (typeof ecOngletConseiller === 'function') window.ecOngletConseiller = window.ecpOngletConseiller;
})();

// ── L'écran CRM ─────────────────────────────────────────────────────────────────────────────────
window._cdl = window._cdl || { etat: 'inconnu', rdv: [], types: [], erreur: '' };

function viewCalendly() {
  setTimeout(() => cdlCharger(), 0);
  return `
    <section class="fcx-hero cdl-hero">
      <div class="fcx-hero-deco" aria-hidden="true"></div>
      <div>
        <span class="cf-surtitre">Rendez-vous</span>
        <h1>Calendly</h1>
        <p>Votre lien de réservation, et les rendez-vous déjà pris. Le lien fonctionne sans
          configuration ; la liste des rendez-vous demande un jeton, posé côté serveur.</p>
      </div>
      <div class="cf-hero-actions">
        <a class="fcx-btn-blanc" href="${cdlEsc(CDL_LIEN_BASE)}" target="_blank" rel="noopener">Ouvrir Calendly ↗</a>
      </div>
    </section>

    <section class="dbx-carte cdl-carte">
      <header class="dbx-carte-tete"><div><h2>Le lien à partager</h2>
        <span class="dbx-carte-sous">Bilan gratuit — 20 minutes, par Teams</span></div></header>
      <div class="cdl-lien-boite">
        <code>${cdlEsc(cdlLien(null))}</code>
        <button type="button" class="btn-save" onclick="cdlCopier('${cdlEsc(cdlLien(null))}', 'Lien copié')">Copier</button>
      </div>
      <p class="cdl-note">Depuis la fiche d’un client, le bouton « Lien de rendez-vous » copie ce
        même lien avec son nom et son adresse déjà remplis : il n’a plus qu’à choisir l’heure.</p>
    </section>

    <div id="cdl-corps"></div>`;
}

async function cdlCharger() {
  const zone = document.getElementById('cdl-corps');
  if (!zone) return;
  zone.innerHTML = '<section class="dbx-carte cdl-carte"><div class="dbx-chargement"><span></span><span></span><span></span></div></section>';
  const r = await cdlAppel('rendezvous', { limite: 30 });
  if (!r || !r.ok) {
    window._cdl.etat = 'erreur'; window._cdl.erreur = (r && r.erreur) || 'Appel impossible.';
    zone.innerHTML = cdlNonConfigureHtml(window._cdl.erreur);
    return;
  }
  window._cdl.etat = 'ok'; window._cdl.rdv = r.rendezvous || [];
  zone.innerHTML = cdlListeHtml(window._cdl.rdv);
}

function cdlNonConfigureHtml(erreur) {
  const manque = /CALENDLY_TOKEN/i.test(erreur);
  return `<section class="dbx-carte cdl-carte">
    <header class="dbx-carte-tete"><div><h2>Rendez-vous à venir</h2>
      <span class="dbx-carte-sous">${manque ? 'Jeton non configuré' : 'Lecture impossible'}</span></div></header>
    <div class="cdl-vide">
      <b>${manque ? 'Il manque le jeton Calendly.' : 'Calendly n’a pas répondu.'}</b>
      ${manque ? `<p>Le lien de réservation ci-dessus fonctionne déjà. Pour voir en plus les
        rendez-vous pris depuis le CRM, il faut un jeton d’accès personnel :</p>
        <ol>
          <li>Calendly → <b>Integrations & apps</b> → <b>API & webhooks</b> → <i>Personal access tokens</i> → générer un jeton</li>
          <li>Supabase → projet → <b>Edge Functions</b> → <b>Secrets</b> → nouveau secret nommé <code>CALENDLY_TOKEN</code></li>
        </ol>
        <p class="cdl-note">Le jeton reste sur le serveur : le CRM ne le voit jamais, et il n’est
          donc pas dans le dépôt public.</p>`
        : `<p class="cdl-note">${cdlEsc(erreur)}</p>`}
    </div>
  </section>`;
}

function cdlListeHtml(rdv) {
  if (!rdv.length) {
    return `<section class="dbx-carte cdl-carte">
      <header class="dbx-carte-tete"><div><h2>Rendez-vous à venir</h2></div></header>
      <div class="dbx-vide-petit">Aucun rendez-vous à venir.</div>
    </section>`;
  }
  return `<section class="dbx-carte cdl-carte">
    <header class="dbx-carte-tete"><div><h2>Rendez-vous à venir</h2>
      <span class="dbx-carte-sous">${rdv.length} rendez-vous · rapprochés du portefeuille par l’adresse courriel</span></div></header>
    <div class="cdl-liste">${rdv.map(cdlCarteHtml).join('')}</div>
  </section>`;
}

// Le rapprochement : on cherche l'invité dans le portefeuille par son adresse. Une correspondance
// n'est affichée que si elle est CERTAINE (adresse identique) — un rapprochement approximatif sur
// le nom rattacherait un rendez-vous au mauvais dossier, ce qui est pire que pas de lien du tout.
function cdlClientDe(invite) {
  if (!invite || !invite.email) return null;
  const e = String(invite.email).trim().toLowerCase();
  return (typeof allClients !== 'undefined' ? allClients : [])
    .find(c => String(c.email || '').trim().toLowerCase() === e) || null;
}

function cdlCarteHtml(e) {
  const d = e.debut ? new Date(e.debut) : null;
  const f = e.fin ? new Date(e.fin) : null;
  const jour = d ? d.toLocaleDateString('fr-CH', { weekday: 'short', day: '2-digit', month: 'short' }) : '—';
  const heures = d && f
    ? `${d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })} – ${f.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  const inv = (e.invites || [])[0];
  const client = cdlClientDe(inv);
  const visio = /^https?:/.test(e.lieu || '');

  return `<article class="cdl-rdv ${e.statut === 'canceled' ? 'annule' : ''}">
    <div class="cdl-quand"><b>${cdlEsc(jour)}</b><small>${cdlEsc(heures)}</small></div>
    <div class="cdl-qui">
      <b>${cdlEsc(inv ? inv.nom : 'Invité inconnu')}</b>
      <small>${cdlEsc(e.nom || '')}${inv && inv.email ? ' · ' + cdlEsc(inv.email) : ''}</small>
      ${client
        ? `<button type="button" class="cdl-fiche" onclick="cdlOuvrirClient('${client.id}')">Au portefeuille : ${cdlEsc(cdlNomClient(client))} →</button>`
        : '<span class="cdl-inconnu">Pas encore au portefeuille</span>'}
    </div>
    <div class="cdl-actions">
      ${visio ? `<a class="btn-secondary" href="${cdlEsc(e.lieu)}" target="_blank" rel="noopener">Rejoindre ↗</a>` : ''}
      ${e.statut === 'canceled' ? `<span class="cdl-annule-tag">Annulé${e.annulation ? ' — ' + cdlEsc(e.annulation) : ''}</span>` : ''}
    </div>
  </article>`;
}

function cdlOuvrirClient(id) {
  if (typeof showClient === 'function') showClient(id);
  else if (typeof voirClient === 'function') voirClient(id);
}

(function cdlBrancher() {
  if (typeof NAV_SYNONYMES !== 'undefined') {
    NAV_SYNONYMES['calendly'] = 'calendly rendez vous rdv agenda reservation creneau lien bilan gratuit';
  }
})();
