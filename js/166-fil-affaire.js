// ═══ TOUT CE QUI EST FAIT DANS UNE AFFAIRE S'INSCRIT AU FIL (25.09.2026) ═════════════════════════
// « Enregistre dans l'opp la pose comme si elle avait été demandée. Si ce n'est pas encore
// référencé, ajoute la possibilité de référencer au fil de l'affaire tout ce qui est fait. »
//
// Le fil d'une affaire racontait déjà presque tout : offres reçues, tâches, relances, rendez-vous,
// comparatif, contrats signés. Il manquait ce qui ouvre le dossier — la POSE DU MANDAT. On voyait
// « Tâche terminée : Poser mandat », mais rien ne disait à qui le mandat était parti, ni quand :
// la seule trace était dans Outlook. Deux mois plus tard, personne ne sait plus si Zurich a reçu
// quelque chose.
//
// Ce module apporte deux choses :
//   · filReferencer() — une ligne au fil à partir d'une affaire OU d'un client, sans que
//     l'appelant ait à retrouver l'opportunité lui-même ;
//   · le branchement sur envoyerCourriel (js/143) : tout courriel accompagné d'un `affaire`
//     laisse sa trace, une fois parti, et seulement s'il est vraiment parti. Les envois qui
//     écrivent déjà leur propre ligne (demande d'offre, comparatif, relances) ne passent pas par
//     là : deux lignes pour un même geste vaudraient moins qu'une.
// Un essai (« M'envoyer un essai ») n'écrit rien : il n'a atteint personne.

// L'affaire à laquelle rattacher ce qu'on fait pour un client. Une affaire ouverte prime sur une
// affaire close — on travaille sur celle qui est en cours ; à défaut, la plus récente, parce qu'un
// geste posé aujourd'hui appartient plutôt au dernier dossier qu'au premier.
const FIL_STADES_CLOS = ['gagné', 'gagnee', 'gagnée', 'perdu', 'perdue', 'abandonné', 'abandonnee', 'abandonnée', 'classé', 'classée'];

function filOppDuClient(clientId) {
  if (!clientId || typeof allOpportunites === 'undefined') return null;
  const siennes = (allOpportunites || []).filter(o => o && o.client_id === clientId);
  if (!siennes.length) return null;
  const close = o => FIL_STADES_CLOS.includes(String(o.stade || '').toLowerCase());
  const recent = o => o.updated_at || o.created_at || '';
  const ouvertes = siennes.filter(o => !close(o));
  const liste = ouvertes.length ? ouvertes : siennes;
  return [...liste].sort((a, b) => String(recent(b)).localeCompare(String(recent(a))))[0].id;
}

// `cible` : { oppId } ou { clientId }, ou les deux — l'identifiant d'affaire l'emporte.
// Sans affaire trouvée, on ne force rien : on ne va pas inventer un dossier pour y ranger une
// ligne. La valeur de retour dit si la ligne a bien été posée.
async function filReferencer(cible, texte) {
  if (!texte || typeof ajouterLigneHistoriqueOpportunite !== 'function') return false;
  const oppId = (cible && cible.oppId) || filOppDuClient(cible && cible.clientId);
  if (!oppId) return false;
  try { await ajouterLigneHistoriqueOpportunite(oppId, texte); return true; }
  catch (e) { console.warn('Fil de l’affaire : ' + (e.message || e)); return false; }
}

(function filBrancher() {
  if (typeof envoyerCourriel !== 'function') return;
  const envoyer = envoyerCourriel;
  window.envoyerCourriel = async function (options = {}) {
    const res = await envoyer.call(this, options);
    const af = options.affaire;
    if (!af || !res || !res.ok || options.test) return res;
    // Ce que le fil retient : à qui c'est parti, et pourquoi — pas le corps du message, qui est
    // dans Outlook. Le libellé vient de l'appelant quand le geste a un nom (« Mandat envoyé »).
    const qui = (res.destinataires || []).join(', ');
    const quoi = af.libelle || `📤 Courriel envoyé${options.objet ? ` — ${options.objet}` : ''}`;
    await filReferencer(af, `${quoi}${qui ? ` — ${qui}` : ''}`);
    return res;
  };
})();
