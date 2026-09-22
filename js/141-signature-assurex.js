// ═══ LA SIGNATURE ASSUREX, INTÉGRÉE AU CRM (22.09.2026) ═════════════════════════════════════════
// « Non mais intègre ma signature directement. »
// Plus besoin de la reprendre depuis Outlook : elle est écrite ici, dans la mise en page des e-mails
// Outlook (Aptos 11 pt), avec le logo animé EX.GROUP du dépôt (assets/signature/). Elle sert de
// signature par défaut à tout e-mail envoyé depuis le CRM (js/138) et s'affiche dans l'aperçu
// (js/139). Une signature reprise d'Outlook, si elle existe sur la fiche agent, reste prioritaire.
//
// Pour la modifier : ce fichier (texte) et assets/signature/ (image). Les coordonnées viennent de la
// signature Outlook de Jonathan, elles figurent déjà sur chaque e-mail envoyé et sur cofidex.ch.

// Le logo COFIDEX de la signature : le fichier cofidexgif.gif du dossier Logos, tel quel, à la
// demande de Jonathan (22.09.2026). Copié dans assets/signature/ pour être servi avec le CRM et
// joint en image intégrée (cid) à chaque e-mail sortant.
const SIG_LOGO = { cid: 'cofidex-signature@assurex', nom: 'cofidexgif.gif', type: 'image/gif', url: 'assets/signature/cofidexgif.gif', largeur: 228 };

const SIG_ASSUREX = {
  'jo@cofidex.ch': { nom: 'Jonathan Ozkan', titre: 'Directeur associé Assurex Sàrl', tel: '+41 79 101 99 26' },
};
const SIG_ASSUREX_DEFAUT = { titre: 'Assurex Sàrl', tel: '+41 79 101 99 26' };

// Mise en page volontairement en styles « en ligne » : c'est ce que comprennent Outlook, Gmail et
// les clients mobiles, sans feuille de style.
function sigAssurexHtml(agent) {
  const e = ((agent && agent.email) || '').toLowerCase();
  const p = SIG_ASSUREX[e] || SIG_ASSUREX_DEFAUT;
  const nom = p.nom || [agent && agent.prenom, agent && agent.nom].filter(Boolean).join(' ') || '';
  const tel = (agent && agent.tel) || p.tel;
  const courriel = (agent && agent.email) || e;
  const F = 'font-family:Aptos,Calibri,Arial,sans-serif;color:#0E1B33';
  const ligne = (t, style = '') => `<p style="margin:0;font-size:11pt;${F};${style}">${t}</p>`;
  return `<div class="WordSection1" style="${F}">
    ${ligne('Meilleures salutations,')}
    <p style="margin:11pt 0 0;font-size:11pt;${F}"><b>${nom}</b></p>
    ${ligne(`<b>${p.titre}</b>`)}
    ${ligne('Spécialiste en assurances &amp; prévoyance AFA | Agréé FINMA', 'margin-top:8pt')}
    <p style="margin:10pt 0 0"><img src="cid:${SIG_LOGO.cid}" alt="COFIDEX" width="${SIG_LOGO.largeur}" style="width:${SIG_LOGO.largeur}px;max-width:100%;height:auto;border:0"></p>
    ${ligne('Rue du Centre 142 – 1025 St-Sulpice', 'margin-top:10pt')}
    ${ligne('Succursale : Chemin de Pallud 3 – 1822 Chernex (Montreux)')}
    ${ligne(`<b>${tel} | <a href="https://www.cofidex.ch" style="color:#113679">www.cofidex.ch</a></b>`, 'margin-top:6pt')}
    ${ligne(`<a href="mailto:${courriel}" style="color:#113679">${courriel}</a>`)}
    ${ligne('<b>Agrément FINMA F01565757</b>', 'margin-top:6pt')}
    <p style="margin:10pt 0 0;font-size:8pt;color:#56627A;${F}">Ce message et ses annexes peuvent contenir des informations confidentielles protégées par le secret professionnel. Si vous l’avez reçu par erreur, veuillez nous en avertir immédiatement et l’effacer.<br><br>Toute utilisation, divulgation, copie ou distribution non autorisée est strictement interdite. La communication par e-mail non crypté comporte des risques (corruption de données, retards, interception, modifications non autorisées) que toute personne communiquant avec nous par ce biais est présumée accepter et pour lesquels nous déclinons toute responsabilité.</p>
  </div>`;
}

// Signature « comme si elle venait de la fiche agent » : js/138 et js/139 la consomment sans savoir
// d'où elle vient.
function sigAssurexPourAgent(agent) {
  return {
    signature_email_html: sigAssurexHtml(agent),
    signature_email_images: [{ cid: SIG_LOGO.cid, name: SIG_LOGO.nom, type: SIG_LOGO.type, url: SIG_LOGO.url }],
    signature_email_actif: true,
    integree: true,
  };
}
