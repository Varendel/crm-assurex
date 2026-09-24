// ═══ UN SEUL POINT D'ENVOI POUR TOUS LES COURRIELS DU CRM (22.09.2026) ═══════════════════════════
// Audit, point 2. Quinze endroits appelaient Outlook chacun de leur côté : chacun refaisait la
// vérification du jeton, la confirmation, la mise en forme, les erreurs — d'où une adresse
// d'expéditeur écrite en dur à deux endroits, et une signature qu'il avait fallu injecter en
// réécrivant window.fetch. Tout passe désormais par envoyerCourriel() :
//
//   await envoyerCourriel({ a: ['x@y.ch'], cci: [...], objet, texte, pieces, contexte: 'demande d’offre' })
//
// `copie` = Cc, VISIBLE du destinataire : réservé aux cas où la personne en copie DOIT se voir.
// Toute copie interne « pour information » passe par `cci` (24.09.2026).
//
// Elle s'occupe : du compte Outlook connecté (et l'annonce dans la confirmation), de la signature
// de l'expéditeur (js/138), du passage du texte en HTML à la mise en forme Outlook, des pièces
// jointes, de la confirmation, et des messages d'erreur — les mêmes partout.
// Elle renvoie { ok, annule, statut }. Rien ne part sans un « oui » explicite, sauf si l'appelant a
// DÉJÀ demandé confirmation lui-même (confirmer: false).

const ENVOI_TAILLE_MAX = 3.5 * 1024 * 1024;   // limite d'un envoi Graph en une requête

function envListe(v) { return (Array.isArray(v) ? v : [v]).map(x => String(x || '').trim()).filter(x => /@/.test(x)); }
function envB64(blob) { return new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = () => ko(fr.error); fr.readAsDataURL(blob); }); }

// Pièce jointe acceptée : un File/Blob, ou { nom, type, blob } ou { nom, type, contentBytes }.
async function envPiece(p) {
  if (!p) return null;
  if (p.contentBytes) return { '@odata.type': '#microsoft.graph.fileAttachment', name: p.nom || p.name || 'document', contentType: p.type || p.contentType || 'application/octet-stream', contentBytes: p.contentBytes, ...(p.cid ? { contentId: p.cid, isInline: true } : {}) };
  const blob = p.blob || (p instanceof Blob ? p : null);
  if (!blob) return null;
  const nom = (p.nom || p.name || blob.name || 'document').replace(/[\\/:*?"<>|]/g, '-');
  return { '@odata.type': '#microsoft.graph.fileAttachment', name: nom, contentType: p.type || blob.type || 'application/octet-stream', contentBytes: await envB64(blob) };
}

// `test: true` — l'envoi part UNIQUEMENT à soi, objet préfixé, personne d'autre n'est touché :
// de quoi voir le message tel qu'il arrivera (mise en forme Outlook, signature, pièces jointes)
// avant de l'expédier pour de bon. Demandé le 24.09.2026, pour tous les e-mails sortants.
async function envoyerCourriel({ a, copie, cci, objet, texte, html, pieces, confirmer = true, contexte = '', silencieux = false, cciMulti = true, test = false } = {}) {
  let dest = envListe(a);
  let cc = envListe(copie);
  let bcc = envListe(cci);
  if (!dest.length && !test) { if (!silencieux) showError('Aucun destinataire : rien n’a été envoyé.'); return { ok: false, statut: 'sans-destinataire' }; }

  const compte = typeof sigCompteOutlook === 'function' ? await sigCompteOutlook().catch(() => null) : null;
  // 24.09.2026 — « As-tu ajouté la règle jo@cofidex en cci de tous les e-mails sortants ? » Elle
  // était là, mais suspendue à `compte.adresse` : session Outlook froide ou illisible, et `moi`
  // restait vide, donc AUCUNE copie — en silence. Une règle qui ne s'applique que lorsque tout va
  // bien n'est pas une règle. On retombe donc sur l'adresse de l'agent connecté au CRM, puis sur
  // celle de la session : ce sont les mêmes, et elles, on les connaît sans Outlook.
  const agentSig = typeof sigAgent === 'function' ? await sigAgent().catch(() => null) : null;
  const moi = (compte && compte.adresse)
    || (agentSig && agentSig.email)
    || (typeof currentUser !== 'undefined' && currentUser && currentUser.email)
    || '';
  const meme = (x, y) => !!x && !!y && x.toLowerCase() === y.toLowerCase();
  const dedans = (l, x) => l.some(y => meme(y, x));

  // ── DEUX RÈGLES, POUR TOUS LES ENVOIS DU CRM (23.09.2026) ─────────────────────────────────────
  // « En multi-sélecteur, l'envoi doit se faire en cci. Copie-moi pour info, toujours. »
  //
  // 1. PLUSIEURS DESTINATAIRES → TOUS EN COPIE CACHÉE. Ce n'est pas une question de présentation :
  //    sur une demande d'offre adressée à trois compagnies, un champ « À » visible apprend à
  //    chacune qui sont ses concurrentes sur le dossier. L'adresse en clair devient une information
  //    commerciale qu'on n'a pas choisi de donner — et, côté clients, une liste d'adresses
  //    diffusée sans leur accord. L'en-tête « À » porte donc l'expéditeur, et les destinataires
  //    passent en cci. `cciMulti: false` permet l'exception, pour un cas où la liste DOIT se voir.
  // 2. UNE COPIE À SOI, systématique, en cci — sans alourdir l'en-tête du destinataire. Outlook
  //    garde déjà une trace dans les éléments envoyés ; ce qui manquait, c'est de RECEVOIR ce qui
  //    part, dans la même boîte que les réponses.
  // L'essai court-circuite les deux règles : un test qui partirait aux vraies compagnies ne serait
  // pas un test. On remplace la liste, on préfixe l'objet, et on n'exécute rien de ce qui suit
  // l'envoi côté appelant (statut des compagnies, historique) — c'est à l'appelant de s'arrêter là.
  if (test) {
    if (!moi) { if (!silencieux) showError('Impossible d’envoyer un test : aucune adresse connue pour toi.'); return { ok: false, statut: 'sans-expediteur' }; }
    dest = [moi]; cc = []; bcc = [];
    objet = `[TEST] ${objet || ''}`;
  }
  const groupe = !test && dest.length > 1 && cciMulti;
  if (groupe) {
    bcc = [...bcc, ...dest.filter(x => !dedans(bcc, x))];
    dest = moi ? [moi] : [dest[0]];          // sans compte Outlook connu, on garde au moins le premier
    bcc = bcc.filter(x => !dedans(dest, x));
  }
  if (!test && moi && !dedans(dest, moi) && !dedans(cc, moi) && !dedans(bcc, moi)) bcc.push(moi);

  if (confirmer && test) {
    if (!confirm(`Envoyer un ESSAI de ce courriel à toi seul (${moi}) ?\n\nAucune compagnie ni aucun client ne le recevra.`)) return { ok: false, annule: true, statut: 'annulé' };
  } else if (confirmer) {
    const depuis = moi || 'le compte Outlook connecté';
    const vrais = groupe ? bcc.filter(x => !meme(x, moi)) : dest;
    const suite = [
      groupe ? `⚠️ ${vrais.length} destinataires, tous en copie cachée — ils ne se voient pas entre eux` : '',
      cc.length ? `en copie : ${cc.join(', ')}` : '',
      moi ? `copie à toi : ${moi}` : '',
      pieces && pieces.length ? `${pieces.length} pièce(s) jointe(s)` : '',
    ].filter(Boolean).join('\n');
    if (!confirm(`Envoyer ${contexte ? `ce courriel (${contexte})` : 'ce courriel'} à ${vrais.join(', ')} depuis ${depuis} ?${suite ? `\n\n${suite}` : ''}`)) return { ok: false, annule: true, statut: 'annulé' };
  }
  if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) {
    if (!silencieux) showError('Connecte-toi à Outlook (bouton Microsoft dans le menu) pour envoyer.');
    return { ok: false, statut: 'sans-jeton' };
  }

  // Corps : le texte devient du HTML à la mise en forme Outlook, suivi de la signature.
  const ag = typeof sigAgent === 'function' ? await sigAgent().catch(() => null) : null;
  const avecSig = ag && ag.signature_email_actif && ag.signature_email_html;
  let contenu = html || '';
  let type = html ? 'html' : 'text';
  const jointes = [];
  // 23.09.2026 : la signature s'ajoute AUSSI aux corps déjà en HTML (comparatif d'offres…) —
  // auparavant un appel avec `html` partait sans elle, ce qui n'a aucune raison d'être.
  if (avecSig) {
    const corps = html || (typeof sigTexteVersHtml === 'function' ? sigTexteVersHtml(texte || '', ag) : '');
    contenu = `<html><head><meta charset="utf-8"></head><body>${corps}<br>${ag.signature_email_html}</body></html>`;
    type = 'html';
    if (typeof sigImages === 'function') jointes.push(...(await sigImages(ag).catch(() => [])));
  } else if (!html) {
    contenu = texte || '';
  }

  for (const p of (pieces || [])) { const j = await envPiece(p); if (j) jointes.push(j); }
  const poids = jointes.reduce((s, j) => s + (j.contentBytes ? j.contentBytes.length * 0.75 : 0), 0);
  if (poids > ENVOI_TAILLE_MAX) {
    if (!silencieux) showError(`Pièces jointes trop lourdes (${Math.round(poids / 1024 / 1024 * 10) / 10} Mo) — envoie-les en deux fois.`);
    return { ok: false, statut: 'trop-lourd' };
  }

  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: objet || '',
          body: { contentType: type, content: contenu },
          toRecipients: dest.map(address => ({ emailAddress: { address } })),
          ...(cc.length ? { ccRecipients: cc.map(address => ({ emailAddress: { address } })) } : {}),
          ...(bcc.length ? { bccRecipients: bcc.map(address => ({ emailAddress: { address } })) } : {}),
          ...(jointes.length ? { attachments: jointes } : {}),
        },
        saveToSentItems: true,
      }),
    });
    if (r.status === 401) { if (!silencieux) showError('Session Outlook expirée — reconnecte-toi (bouton Microsoft) puis réessaie.'); return { ok: false, statut: 'jeton-expire' }; }
    if (!r.ok) {
      let detail = '';
      try { detail = (await r.json())?.error?.message || ''; } catch (e) { /* réponse illisible */ }
      if (!silencieux) showError(`Échec de l’envoi via Outlook${detail ? ' : ' + detail : ` (code ${r.status})`}.`);
      return { ok: false, statut: 'refus', code: r.status, detail };
    }
  } catch (e) {
    if (!silencieux) showError('Erreur réseau lors de l’envoi via Outlook : ' + (e.message || e));
    return { ok: false, statut: 'reseau' };
  }
  // Le message de confirmation nomme les VRAIS destinataires, pas l'en-tête technique : quand
  // l'envoi est groupé, « À » ne porte que l'expéditeur, et annoncer ça n'apprendrait rien.
  const reels = groupe ? bcc.filter(x => !meme(x, moi)) : dest;
  if (!silencieux) showError(`✓ Courriel envoyé à ${reels.join(', ')}${groupe ? ' (en copie cachée)' : ''}${cc.length ? ` · copie : ${cc.join(', ')}` : ''}.`);
  return { ok: true, statut: 'envoyé', destinataires: reels, copie: cc, cachee: groupe, expediteur: moi || null };
}
