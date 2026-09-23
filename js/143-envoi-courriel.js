// ═══ UN SEUL POINT D'ENVOI POUR TOUS LES COURRIELS DU CRM (22.09.2026) ═══════════════════════════
// Audit, point 2. Quinze endroits appelaient Outlook chacun de leur côté : chacun refaisait la
// vérification du jeton, la confirmation, la mise en forme, les erreurs — d'où une adresse
// d'expéditeur écrite en dur à deux endroits, et une signature qu'il avait fallu injecter en
// réécrivant window.fetch. Tout passe désormais par envoyerCourriel() :
//
//   await envoyerCourriel({ a: ['x@y.ch'], copie: [...], objet, texte, pieces, contexte: 'demande d’offre' })
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

async function envoyerCourriel({ a, copie, cci, objet, texte, html, pieces, confirmer = true, contexte = '', silencieux = false } = {}) {
  const dest = envListe(a), cc = envListe(copie), bcc = envListe(cci);
  if (!dest.length) { if (!silencieux) showError('Aucun destinataire : rien n’a été envoyé.'); return { ok: false, statut: 'sans-destinataire' }; }

  const compte = typeof sigCompteOutlook === 'function' ? await sigCompteOutlook().catch(() => null) : null;
  if (confirmer) {
    const depuis = compte && compte.adresse ? compte.adresse : 'le compte Outlook connecté';
    const suite = [cc.length ? `en copie : ${cc.join(', ')}` : '', pieces && pieces.length ? `${pieces.length} pièce(s) jointe(s)` : ''].filter(Boolean).join(' · ');
    if (!confirm(`Envoyer ${contexte ? `ce courriel (${contexte})` : 'ce courriel'} à ${dest.join(', ')} depuis ${depuis} ?${suite ? `\n\n${suite}` : ''}`)) return { ok: false, annule: true, statut: 'annulé' };
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
  if (!silencieux) showError(`✓ Courriel envoyé à ${dest.join(', ')}${cc.length ? ` (copie : ${cc.join(', ')})` : ''}.`);
  return { ok: true, statut: 'envoyé', destinataires: dest, copie: cc, expediteur: (compte && compte.adresse) || null };
}
