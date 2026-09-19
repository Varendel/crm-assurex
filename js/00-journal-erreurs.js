// ═══ JOURNAL DES ERREURS (ajouté le 19.09.2026) ═══════════════════════════════════════════════
// Chargé AVANT tous les autres scripts (voir index.html) pour capturer aussi leurs erreurs.
// Tout ce qui part en erreur dans le navigateur est enregistré dans la table Supabase
// journal_erreurs, avec les derniers clics (fil d'Ariane) : quand Jonathan dit « ça ne va pas »,
// Claude lit directement le journal au lieu d'attendre des captures d'écran.
//
// Capturé automatiquement :
//   - erreurs JavaScript non gérées (window 'error') et promesses rejetées ('unhandledrejection')
//   - console.error(...) — c'est là que finissent déjà tous les échecs dbGet/dbPost/dbPatch/dbRpc
//   - les messages d'erreur affichés à l'écran via showError(...) (sauf les confirmations « ✓ »)
// Signalement manuel : Ctrl+Alt+E (ou signalerProbleme() dans la console) → petite note libre,
// utile quand « ça ne marche pas » sans erreur technique (mauvais affichage, mauvais chiffre...).
//
// Confidentialité : on n'enregistre JAMAIS le contenu des champs saisis, seulement le texte des
// boutons/liens cliqués ; les paramètres d'URL (ex. ?signer=<token>) sont retirés.
(function () {
  const MAX_ENVOIS_PAR_SESSION = 40;
  const MAX_CLICS = 20;
  const sessionId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const clics = [];
  const dejaVus = new Map(); // message → horodatage, pour ne pas envoyer 50 fois la même erreur
  let envois = 0;
  let enCours = false; // évite qu'une erreur pendant l'envoi ne relance un envoi (boucle)
  const consoleErrorOriginal = console.error.bind(console);

  function urlSansParametres() {
    return (location.origin + location.pathname + location.hash).slice(0, 500);
  }

  function enTexte(v) {
    if (v instanceof Error) return v.message;
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function utilisateurCourant() {
    try { return (typeof supaSession !== 'undefined' && supaSession && supaSession.email) || null; } catch (e) { return null; }
  }

  // Fil d'Ariane : texte des éléments cliqués (boutons, liens, onglets), jamais les valeurs saisies
  document.addEventListener('click', (e) => {
    try {
      const el = e.target.closest('button, a, [onclick], .nav-item, [role="tab"], summary, label') || e.target;
      const texte = (el.innerText || el.getAttribute('aria-label') || el.title || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const ident = el.id ? '#' + el.id : (el.getAttribute('onclick') || '').slice(0, 60);
      clics.push({ t: new Date().toISOString().slice(11, 19), el: el.tagName.toLowerCase(), texte, ident });
      if (clics.length > MAX_CLICS) clics.shift();
    } catch (err) { /* le journal ne doit jamais casser le CRM */ }
  }, true);

  async function envoyer(source, message, stack, contexte) {
    if (enCours || envois >= MAX_ENVOIS_PAR_SESSION) return;
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') return;
    const cle = source + '|' + message;
    const maintenant = Date.now();
    if (dejaVus.has(cle) && maintenant - dejaVus.get(cle) < 30000) return;
    dejaVus.set(cle, maintenant);
    envois++;
    enCours = true;
    try {
      let jeton = SUPABASE_KEY;
      try { if (typeof supaSession !== 'undefined' && supaSession && supaSession.access_token) jeton = supaSession.access_token; } catch (e) {}
      await fetch(`${SUPABASE_URL}/rest/v1/journal_erreurs`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          source,
          message: String(message || '').slice(0, 4000),
          stack: stack ? String(stack).slice(0, 8000) : null,
          url: urlSansParametres(),
          user_email: utilisateurCourant(),
          user_agent: navigator.userAgent.slice(0, 400),
          session_id: sessionId,
          breadcrumbs: clics.slice(),
          contexte: contexte || null,
        }),
      });
    } catch (e) {
      consoleErrorOriginal('journal_erreurs — envoi impossible', e);
    } finally {
      enCours = false;
    }
  }

  window.addEventListener('error', (e) => {
    const msg = e.message || (e.target && e.target.src ? 'Échec de chargement : ' + e.target.src : 'Erreur inconnue');
    envoyer('window.error', msg, e.error && e.error.stack, { fichier: e.filename, ligne: e.lineno, colonne: e.colno });
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    envoyer('promesse', enTexte(r), r && r.stack);
  });

  console.error = function (...args) {
    consoleErrorOriginal(...args);
    if (enCours) return;
    const erreur = args.find((a) => a instanceof Error);
    envoyer('console.error', args.map(enTexte).join(' ').slice(0, 4000), erreur ? erreur.stack : new Error().stack);
  };

  // showError est déclarée plus loin (js/03) : on l'enveloppe une fois tous les scripts chargés.
  window.addEventListener('load', () => {
    if (typeof window.showError !== 'function' || window.showError._journalise) return;
    const showErrorOriginal = window.showError;
    const enveloppe = function (msg, ...reste) {
      if (typeof msg === 'string' && !msg.trim().startsWith('✓')) envoyer('showError', msg, new Error().stack);
      return showErrorOriginal.call(this, msg, ...reste);
    };
    enveloppe._journalise = true;
    window.showError = enveloppe;
  });

  // Signalement manuel : Ctrl+Alt+E
  window.signalerProbleme = function () {
    const note = prompt('Qu’est-ce qui ne va pas ? (une phrase suffit — les derniers clics sont joints automatiquement)');
    if (note === null) return;
    dejaVus.delete('signalement|' + note);
    envoyer('signalement', note || '(sans description)', null).then(() => {
      if (typeof window.showError === 'function') window.showError('✓ Signalement envoyé — dis à Claude « regarde le journal ».');
    });
  };
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); window.signalerProbleme(); }
  });
})();
