// ═══ ENVOYER LE COMPARATIF AU CLIENT (23.09.2026) ═══════════════════════════════════════════════
// « Est-ce que du coup on peut envoyer l'offre après comparaison ? »
//
// Le comparateur savait imprimer une recommandation PDF ; il ne savait pas l'envoyer. Le courtier
// ressortait donc du CRM pour écrire le mail à la main, et le suivi s'arrêtait là.
//
// Un bouton de plus dans le comparateur : le tableau des offres part DANS le corps du message —
// lisible sur un téléphone, sans pièce jointe à ouvrir — suivi de la recommandation, et les PDF
// des compagnies sont joints tels qu'ils ont été reçus. L'envoi passe par envoyerCourriel (js/143) :
// compte Outlook réel, signature, confirmation. Une ligne s'écrit dans le fil de l'affaire.
//
// DEUX PRÉCAUTIONS DE MÉTIER, tenues ici :
//   · le tableau ne décerne aucun « meilleur prix ». Trier sur la prime quand les franchises
//     diffèrent revient à recommander par écrit l'offre la plus chère au premier sinistre.
//     L'offre retenue est signalée comme telle — c'est un choix de conseil, pas un classement.
//   · la mention légale de la recommandation PDF accompagne le message.

function ecoEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ecoEntrees(oppId) {
  const l = typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : [];
  return l.filter(x => x.e && (x.e.prime || x.e.recue_le))
    .sort((a, b) => (Number(a.e.prime) || 9e9) - (Number(b.e.prime) || 9e9));
}

function ecoTableauHtml(entrees) {
  const F = 'font-family:Aptos,Calibri,Arial,sans-serif';
  const th = 'background:#113679;color:#fff;text-align:left;padding:7px 10px;font-size:11pt';
  const td = 'padding:8px 10px;border-bottom:1px solid #E2E7EF;font-size:11pt;vertical-align:top';
  return `<table style="border-collapse:collapse;width:100%;${F};color:#0E1B33;margin:10px 0 16px">
    <thead><tr>
      <th style="${th}">Compagnie</th><th style="${th};text-align:right">Prime annuelle</th>
      <th style="${th}">Franchise</th><th style="${th}">Couverture</th>
    </tr></thead><tbody>
    ${entrees.map(({ e }) => `<tr${e.retenue ? ' style="background:#ECFDF5"' : ''}>
      <td style="${td}">${e.retenue ? '<b>✓ </b>' : ''}<b>${ecoEsc(e.compagnie || '—')}</b>${e.retenue ? '<br><span style="font-size:9.5pt;color:#16A34A">notre proposition</span>' : ''}</td>
      <td style="${td};text-align:right;white-space:nowrap"><b>${e.prime ? 'CHF ' + fmtCHF(e.prime) : '—'}</b></td>
      <td style="${td}">${ecoEsc(e.franchise || '—')}</td>
      <td style="${td}">${ecoEsc(e.couverture || '—')}</td>
    </tr>`).join('')}
    </tbody></table>`;
}

// Les PDF des offres, tels que les compagnies les ont envoyés. Par défaut celle qui est retenue ;
// à défaut, toutes celles qui en ont un.
async function ecoPieces(entrees) {
  const avecPdf = entrees.filter(x => x.e.offre_path);
  const choix = avecPdf.some(x => x.e.retenue) ? avecPdf.filter(x => x.e.retenue) : avecPdf;
  const pieces = [];
  for (const x of choix) {
    try {
      const blob = typeof pjeTelecharger === 'function' ? await pjeTelecharger(x.e.offre_path) : null;
      if (blob) pieces.push({ nom: x.e.offre_nom || `Offre ${x.e.compagnie || ''}.pdf`, type: blob.type || 'application/pdf', blob });
    } catch (e) { /* une pièce illisible n'empêche pas l'envoi des autres */ }
  }
  return pieces;
}

async function ecoEnvoyer(oppId) {
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  if (!o) return;
  const entrees = ecoEntrees(oppId);
  if (!entrees.length) { showError('Aucune offre reçue à envoyer.'); return; }

  const client = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === o.client_id);
  const dest = String((client && (typeof rlEmailClient === 'function' ? rlEmailClient(client) : client.email)) || '').trim();
  if (!dest) {
    showError('Pas d’adresse e-mail sur la fiche de ce client — complète-la, puis réessaie.');
    return;
  }

  const reco = (document.getElementById('opx-reco')?.value || '').trim();
  if (typeof opSauverReco === 'function') await opSauverReco(oppId, true);   // le texte reste sur l'affaire
  const nom = typeof opNomClient === 'function' ? opNomClient(o) : '';
  const civ = client && client.prenom ? `Bonjour ${ecoEsc(client.prenom)},` : 'Bonjour,';
  const F = 'font-family:Aptos,Calibri,Arial,sans-serif;font-size:11pt;color:#0E1B33';
  const p = t => `<p style="margin:0 0 11pt;${F}">${t}</p>`;

  const html = [
    p(civ),
    p(`Vous trouverez ci-dessous la comparaison des offres reçues pour ${ecoEsc(o.titre || nom)}.`),
    ecoTableauHtml(entrees),
    reco ? `<p style="margin:0 0 6pt;${F}"><b>Notre recommandation</b></p>${p(ecoEsc(reco).replace(/\n/g, '<br>'))}` : '',
    p('Les offres des compagnies sont jointes à ce message. Je reste à disposition pour en discuter.'),
    `<p style="margin:14pt 0 0;font-size:8.5pt;color:#8A94A8;${F}">Comparaison établie sur la prime annuelle indiquée par chaque compagnie ; les franchises et l’étendue des couvertures diffèrent d’une offre à l’autre. Seules les conditions générales et particulières des polices font foi.</p>`,
  ].join('');

  showError('⏳ Préparation des offres…');
  const pieces = await ecoPieces(entrees);
  const res = await envoyerCourriel({
    a: dest, objet: `Vos offres — ${o.titre || nom}`, html, pieces, contexte: 'comparatif d’offres',
  });
  if (!res.ok) return;

  document.getElementById('modal-comparateur')?.remove();
  if (typeof ajouterLigneHistoriqueOpportunite === 'function') {
    const retenue = entrees.find(x => x.e.retenue);
    await ajouterLigneHistoriqueOpportunite(oppId,
      `📨 Comparatif envoyé au client (${entrees.length} offre${entrees.length > 1 ? 's' : ''}${retenue ? `, proposition : ${retenue.e.compagnie}` : ''}${pieces.length ? `, ${pieces.length} PDF joint${pieces.length > 1 ? 's' : ''}` : ''})`);
  }
  if (typeof ajouterActiviteClient === 'function' && o.client_id) {
    await ajouterActiviteClient(o.client_id, 'email', `Comparatif des offres envoyé — ${o.titre || nom}`);
  }
  // Offres présentées : l'affaire avance naturellement en « Proposition ».
  if (typeof opChangerStade === 'function' && ['Contact', 'Analyse'].includes(o.stade)) await opChangerStade(oppId, 'Proposition');
  else if (typeof opRafraichir === 'function') opRafraichir();
}

// Le bouton, dans la barre d'actions du comparateur.
(function ecoPoser() {
  if (typeof opComparer !== 'function') return;
  const origine = opComparer;
  window.opComparer = function (oppId) {
    origine.apply(this, arguments);
    setTimeout(() => {
      const actions = document.querySelector('#modal-comparateur .opx-modale-actions');
      if (!actions || actions.querySelector('.eco-envoyer')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-save eco-envoyer';
      b.textContent = '📨 Envoyer au client';
      b.title = 'Le tableau dans le message, les PDF des compagnies en pièces jointes';
      b.onclick = () => ecoEnvoyer(oppId);
      actions.appendChild(b);
    }, 0);
  };
})();
