// ═══ ACTIVATION D'UN ACCÈS CLIENT (25.09.2026) ═════════════════════════════════════════════════
// « Fais le changement pour le mot de passe. »
//
// Jusqu'ici, le CRM générait le mot de passe du client et le lui envoyait par e-mail. Le secret
// voyageait en clair, restait dans deux boîtes mail, et le courtier le connaissait — il pouvait
// donc entrer dans l'espace de son client sans que rien ne distingue l'un de l'autre dans les
// traces. C'est l'incident n° 6 du registre.
//
// Désormais le client reçoit un LIEN à usage unique. Ce fichier est ce qui manquait au bout du
// lien : l'écran où il pose SON mot de passe. Supabase renvoie le jeton dans le FRAGMENT de
// l'adresse (après le #), qui n'est jamais transmis au serveur ni écrit dans un journal
// d'accès — c'est pour cela qu'il est là et pas dans la requête.
//
// Le fragment est effacé de la barre d'adresse dès qu'il est lu : un lien laissé ouvert dans un
// onglet, ou recopié à quelqu'un, ne doit pas rester utilisable.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Les liens d'activation déjà émis mèneront
// alors à un écran de connexion ordinaire, sans moyen de choisir un mot de passe.

// Douze caractères : c'est le seuil en dessous duquel une attaque par dictionnaire aboutit en
// heures plutôt qu'en années. On ne réclame ni majuscule ni chiffre — une phrase longue vaut
// mieux qu'un « P@ssw0rd! », et une règle compliquée pousse à écrire le mot de passe sur un papier.
const ACT_LONGUEUR_MIN = 12;

function actEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Ce que Supabase a mis dans le fragment. Renvoie null si ce n'est pas un retour d'activation.
function actLireFragment(fragment) {
  const h = String(fragment || '').replace(/^#/, '');
  if (!h) return null;
  const p = new URLSearchParams(h);
  const erreur = p.get('error_description') || p.get('error');
  if (erreur) return { erreur: decodeURIComponent(erreur).replace(/\+/g, ' ') };
  const jeton = p.get('access_token');
  const type = p.get('type');
  if (!jeton || (type !== 'recovery' && type !== 'invite' && type !== 'signup')) return null;
  return { jeton, refresh: p.get('refresh_token') || '', type };
}

function actEcran(etat) {
  const d = document.createElement('div');
  d.id = 'act-ecran';
  d.innerHTML = `<div class="act-boite" role="dialog" aria-modal="true" aria-labelledby="act-titre">
    <h1 id="act-titre">Choisissez votre mot de passe</h1>
    ${etat.erreur ? `<p class="act-erreur">${actEsc(etat.erreur)}</p>
      <p class="act-aide">Ce lien a déjà servi, ou il a expiré. Demandez-en un nouveau à votre conseiller — c'est immédiat.</p>
      <div class="act-actions"><button type="button" class="act-ok" onclick="actQuitter()">Revenir à la connexion</button></div>`
    : `<p class="act-aide">Votre espace est prêt. Il ne manque que votre mot de passe :
        personne d'autre que vous ne le connaîtra, pas même votre conseiller.</p>
      <label class="act-label" for="act-mdp">Mot de passe</label>
      <input class="act-champ" id="act-mdp" type="password" autocomplete="new-password" autofocus
        oninput="actJauge()" onkeydown="if(event.key==='Enter')document.getElementById('act-mdp2').focus()"/>
      <div class="act-jauge"><span id="act-jauge-barre"></span></div>
      <div class="act-mesure" id="act-mesure">Au moins ${ACT_LONGUEUR_MIN} caractères. Une phrase dont vous vous souvenez vaut mieux qu'un mot compliqué.</div>

      <label class="act-label" for="act-mdp2">Répétez-le</label>
      <input class="act-champ" id="act-mdp2" type="password" autocomplete="new-password"
        oninput="actJauge()" onkeydown="if(event.key==='Enter')actEnregistrer()"/>

      <p class="act-echec" id="act-echec" hidden></p>
      <div class="act-actions">
        <button type="button" class="act-ok" id="act-valider" onclick="actEnregistrer()" disabled>Ouvrir mon espace</button>
      </div>`}
  </div>`;
  document.body.appendChild(d);
}

// Une mesure honnête : la longueur d'abord, la variété ensuite. Un mot de passe long et simple
// résiste mieux qu'un court et tordu, et le dire évite les « Abc123! » de douze caractères.
function actJauge() {
  const a = document.getElementById('act-mdp')?.value || '';
  const b = document.getElementById('act-mdp2')?.value || '';
  const barre = document.getElementById('act-jauge-barre');
  const mesure = document.getElementById('act-mesure');
  const valider = document.getElementById('act-valider');

  const varietes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(a)).length;
  const force = Math.min(100, Math.round((a.length / 20) * 70 + varietes * 7.5));
  if (barre) {
    barre.style.width = `${a ? Math.max(6, force) : 0}%`;
    barre.className = force >= 70 ? 'fort' : force >= 40 ? 'moyen' : 'faible';
  }
  if (mesure) {
    mesure.textContent = !a ? `Au moins ${ACT_LONGUEUR_MIN} caractères. Une phrase dont vous vous souvenez vaut mieux qu'un mot compliqué.`
      : a.length < ACT_LONGUEUR_MIN ? `Encore ${ACT_LONGUEUR_MIN - a.length} caractère${ACT_LONGUEUR_MIN - a.length > 1 ? 's' : ''}.`
      : b && a !== b ? 'Les deux saisies ne correspondent pas.'
      : force >= 70 ? 'Solide.' : 'Correct — plus long serait mieux.';
  }
  if (valider) valider.disabled = !(a.length >= ACT_LONGUEUR_MIN && a === b);
}

function actEchec(texte) {
  const e = document.getElementById('act-echec');
  if (!e) return;
  e.textContent = texte;
  e.hidden = false;
}

async function actEnregistrer() {
  const b = document.getElementById('act-valider');
  const mdp = document.getElementById('act-mdp')?.value || '';
  const mdp2 = document.getElementById('act-mdp2')?.value || '';
  if (mdp.length < ACT_LONGUEUR_MIN || mdp !== mdp2) return;
  if (b) { b.disabled = true; b.textContent = 'Enregistrement…'; }
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${window._act.jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: mdp }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      // Message de Supabase quand la protection contre les mots de passe compromis est active :
      // on le répète tel quel, il est plus utile qu'un « erreur » générique.
      actEchec(d.msg || d.error_description || d.message || `Enregistrement impossible (${r.status}).`);
      if (b) { b.disabled = false; b.textContent = 'Ouvrir mon espace'; }
      return;
    }
    // Le mot de passe est posé : on entre dans l'espace avec la session du lien, sans redemander
    // au client de se connecter avec ce qu'il vient tout juste de choisir.
    if (typeof saveSession === 'function') {
      saveSession({
        access_token: window._act.jeton,
        refresh_token: window._act.refresh,
        expires_at: Math.floor(Date.now() / 1000) + 3500,
        email: (d && d.email) || '',
      });
    }
    document.getElementById('act-ecran')?.remove();
    const acces = (typeof ecAccesDeLEmail === 'function' && d && d.email) ? await ecAccesDeLEmail(d.email) : null;
    if (acces && typeof ecEntrerEspaceClient === 'function') await ecEntrerEspaceClient(acces, d.email);
    else location.href = location.pathname + '?espace=client';
  } catch (e) {
    actEchec('Enregistrement impossible : ' + (e && e.message || e));
    if (b) { b.disabled = false; b.textContent = 'Ouvrir mon espace'; }
  }
}

function actQuitter() {
  document.getElementById('act-ecran')?.remove();
  location.href = location.pathname + '?espace=client';
}

(function actDemarrer() {
  const etat = actLireFragment(location.hash);
  if (!etat) return;
  window._act = etat;
  // Le fragment disparaît de la barre d'adresse avant tout affichage : un onglet laissé ouvert,
  // une capture d'écran ou un lien recopié ne doivent pas porter le jeton.
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  const poser = () => { document.body.classList.add('mode-cloud'); actEcran(etat); actJauge(); };
  if (document.body) poser(); else document.addEventListener('DOMContentLoaded', poser);
})();

(function actStyles() {
  if (document.getElementById('act-styles')) return;
  const s = document.createElement('style');
  s.id = 'act-styles';
  s.textContent = `
    #act-ecran { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center;
      justify-content: center; padding: 20px; background: #0B1F3A;
      font-family: Geist, system-ui, -apple-system, sans-serif; }
    .act-boite { width: 100%; max-width: 420px; background: #fff; color: #0F172A;
      border-radius: 18px; padding: 30px 30px 26px; box-shadow: 0 24px 60px rgba(0,0,0,.35); }
    .act-boite h1 { margin: 0 0 8px; font-size: 21px; font-weight: 600; letter-spacing: -.01em; }
    .act-aide { margin: 0 0 22px; font-size: 13.5px; line-height: 1.6; color: #475569; }
    .act-label { display: block; margin: 0 0 6px; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .07em; color: #64748B; }
    .act-champ { width: 100%; padding: 11px 13px; font: inherit; font-size: 15px;
      border: 1px solid #CBD5E1; border-radius: 10px; background: #fff; color: #0F172A; }
    .act-champ:focus { outline: 2px solid #00A8D6; outline-offset: 1px; border-color: #00A8D6; }
    .act-jauge { height: 4px; margin: 9px 0 6px; border-radius: 999px; background: #E2E8F0; overflow: hidden; }
    .act-jauge span { display: block; height: 100%; width: 0; border-radius: 999px; transition: width .2s, background .2s; }
    .act-jauge .faible { background: #F87171; }
    .act-jauge .moyen { background: #F59E0B; }
    .act-jauge .fort { background: #22C55E; }
    .act-mesure { font-size: 12px; color: #64748B; margin-bottom: 18px; min-height: 30px; line-height: 1.45; }
    .act-echec { margin: 14px 0 0; font-size: 13px; color: #B91C1C; line-height: 1.5; }
    .act-erreur { margin: 0 0 6px; font-size: 14px; font-weight: 600; color: #B91C1C; }
    .act-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
    .act-ok { border: 0; border-radius: 999px; padding: 11px 22px; font: inherit; font-size: 14px;
      font-weight: 600; cursor: pointer; background: #0B1F3A; color: #fff; }
    .act-ok:disabled { background: #CBD5E1; color: #fff; cursor: not-allowed; }
    .act-ok:not(:disabled):hover { background: #14335F; }
    @media (max-width: 480px) { .act-boite { padding: 24px 20px 20px; } }
  `;
  document.head.appendChild(s);
})();
