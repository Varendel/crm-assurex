// ═══ ENVOYER LE COMPARATIF AU CLIENT (23.09.2026) ═══════════════════════════════════════════════
// « Est-ce que du coup on peut envoyer l'offre après comparaison ? »
// puis « Je veux envoyer le comparatif mais éditer le texte, je fais comment ? »
//
// Le comparateur savait imprimer une recommandation PDF ; il ne savait pas l'envoyer. Le courtier
// ressortait donc du CRM pour écrire le mail à la main, et le suivi s'arrêtait là.
//
// Le bouton ouvre une FENÊTRE D'ÉDITION, pas un envoi. On y règle le destinataire, l'objet, le mot
// qui précède le tableau et celui qui le suit, et les PDF à joindre ; l'aperçu à droite montre le
// message tel qu'il partira. Le tableau, lui, n'est pas éditable : il est fabriqué à partir des
// offres enregistrées, et un tableau qu'on peut retoucher à la main cesse d'être une comparaison
// pour devenir un argumentaire. Ce qu'il faut corriger se corrige sur l'offre.
//
// L'envoi passe par envoyerCourriel (js/143) : compte Outlook réel, signature, confirmation.
// Une ligne s'écrit dans le fil de l'affaire et sur la fiche client.
//
// DEUX PRÉCAUTIONS DE MÉTIER, tenues ici :
//   · le tableau ne décerne aucun « meilleur prix ». Trier sur la prime quand les franchises
//     diffèrent revient à recommander par écrit l'offre la plus chère au premier sinistre.
//     L'offre retenue est signalée comme telle — c'est un choix de conseil, pas un classement.
//   · la mention légale de la recommandation PDF ferme le message, et n'est pas éditable.

const _eco = { opp: null, entrees: [], pieces: [], t: null };

function ecoEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ecoEntrees(oppId) {
  const l = typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : [];
  return l.filter(x => x.e && (x.e.prime || x.e.recue_le))
    .sort((a, b) => (Number(a.e.prime) || 9e9) - (Number(b.e.prime) || 9e9));
}

// Texte libre → paragraphes. Une ligne vide sépare deux paragraphes, un simple retour va à la ligne.
function ecoTexteHtml(t) {
  const F = 'font-family:Aptos,Calibri,Arial,sans-serif;font-size:11pt;color:#0E1B33';
  return String(t || '').split(/\n{2,}/).filter(p => p.trim())
    .map(p => `<p style="margin:0 0 11pt;${F}">${ecoEsc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
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

const ECO_MENTION = `<p style="margin:14pt 0 0;font-size:8.5pt;color:#8A94A8;font-family:Aptos,Calibri,Arial,sans-serif">Comparaison établie sur la prime annuelle indiquée par chaque compagnie ; les franchises et l’étendue des couvertures diffèrent d’une offre à l’autre. Seules les conditions générales et particulières des polices font foi.</p>`;

function ecoMessageHtml(avant, apres, entrees) {
  return ecoTexteHtml(avant) + ecoTableauHtml(entrees) + ecoTexteHtml(apres) + ECO_MENTION;
}

// ── La fenêtre d'édition ───────────────────────────────────────────────────────────────────────
function ecoOuvrir(oppId) {
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  if (!o) return;
  const entrees = ecoEntrees(oppId);
  if (!entrees.length) { showError('Aucune offre reçue à envoyer.'); return; }

  const client = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === o.client_id);
  const dest = String((client && (typeof rlEmailClient === 'function' ? rlEmailClient(client) : client.email)) || '').trim();
  const reco = (document.getElementById('opx-reco')?.value || '').trim();
  if (typeof opSauverReco === 'function') opSauverReco(oppId, true);   // le texte reste sur l'affaire

  const nom = typeof opNomClient === 'function' ? opNomClient(o) : '';
  const avant = `${client && client.prenom ? `Bonjour ${client.prenom},` : 'Bonjour,'}\n\nVous trouverez ci-dessous la comparaison des offres reçues pour ${o.titre || nom}.`;
  const apres = `${reco ? reco + '\n\n' : ''}Les offres des compagnies sont jointes à ce message. Je reste à disposition pour en discuter.`;

  // Les PDF : celui de l'offre retenue coché d'office, les autres disponibles.
  const avecPdf = entrees.filter(x => x.e.offre_path);
  const uneRetenue = avecPdf.some(x => x.e.retenue);
  _eco.opp = o;
  _eco.entrees = entrees;
  _eco.pieces = avecPdf.map(x => ({
    path: x.e.offre_path, nom: x.e.offre_nom || `Offre ${x.e.compagnie || ''}.pdf`,
    compagnie: x.e.compagnie || '', coche: uneRetenue ? !!x.e.retenue : true,
  }));

  document.getElementById('modal-comparateur')?.remove();
  creerModale('modal-envoi-comparatif', `
    <div class="opx-modale opx-modale-large eco-modale" role="dialog" aria-labelledby="eco-titre">
      <h3 id="eco-titre">📨 Envoyer le comparatif au client</h3>
      <div class="opx-modale-sous">${ecoEsc(o.titre || '')}${nom ? ' · ' + ecoEsc(nom) : ''}</div>
      <div class="eco-corps">
        <div class="eco-form">
          <div class="form-field"><label class="form-label" for="eco-a">À</label>
            <input class="form-input" id="eco-a" type="email" value="${ecoEsc(dest)}" placeholder="adresse du client" oninput="ecoApercu()"/>
            ${dest ? '' : '<small class="eco-aide">Pas d’adresse sur la fiche client — saisis-la ici, ou complète la fiche.</small>'}</div>
          <div class="form-field"><label class="form-label" for="eco-objet">Objet</label>
            <input class="form-input" id="eco-objet" value="${ecoEsc(`Vos offres — ${o.titre || nom}`)}" oninput="ecoApercu()"/></div>
          <div class="form-field"><label class="form-label" for="eco-avant">Avant le tableau</label>
            <textarea class="form-input" id="eco-avant" rows="4" oninput="ecoApercu()">${ecoEsc(avant)}</textarea></div>
          <div class="eco-fige">⚖️ Le tableau des ${entrees.length} offre${entrees.length > 1 ? 's' : ''} s’insère ici — il est fabriqué à partir des offres enregistrées. Pour le corriger, modifie l’offre.</div>
          <div class="form-field"><label class="form-label" for="eco-apres">Après le tableau — votre recommandation</label>
            <textarea class="form-input" id="eco-apres" rows="6" oninput="ecoApercu()">${ecoEsc(apres)}</textarea></div>
          <div class="form-field"><span class="form-label">Pièces jointes</span>
            ${_eco.pieces.length ? _eco.pieces.map((p, i) => `<label class="eco-pj">
                <input type="checkbox" ${p.coche ? 'checked' : ''} onchange="_eco.pieces[${i}].coche=this.checked;ecoApercu()"/>
                <span>📄 ${ecoEsc(p.nom)}${p.compagnie ? ` <small>${ecoEsc(p.compagnie)}</small>` : ''}</span></label>`).join('')
              : '<small class="eco-aide">Aucune offre n’a de PDF déposé — le message partira sans pièce jointe.</small>'}</div>
        </div>
        <div class="eco-apercu">
          <div class="eco-apercu-tete">Aperçu · ce que le client recevra <small>la signature Outlook s’ajoute à l’envoi</small></div>
          <iframe id="eco-iframe" title="Aperçu du message"></iframe>
        </div>
      </div>
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-envoi-comparatif').remove();opComparer('${oppId}')">← Retour au comparateur</button>
        <button type="button" class="btn-save" id="eco-envoyer" onclick="ecoPartir('${oppId}')">📨 Envoyer</button>
      </div>
    </div>`, { padding: '16px' });
  ecoApercu();
}

function ecoApercu() {
  clearTimeout(_eco.t);
  _eco.t = setTimeout(() => {
    const f = document.getElementById('eco-iframe');
    if (!f) return;
    const avant = document.getElementById('eco-avant')?.value || '';
    const apres = document.getElementById('eco-apres')?.value || '';
    const jointes = _eco.pieces.filter(p => p.coche);
    const bandeau = jointes.length
      ? `<div style="margin:0 0 14px;padding:8px 10px;background:#F4F6F9;border-radius:8px;font:11px Arial,sans-serif;color:#56627A">📎 ${jointes.map(p => ecoEsc(p.nom)).join(' · ')}</div>` : '';
    f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px 18px;background:#fff;color:#000;word-wrap:break-word}</style></head><body>${bandeau}${ecoMessageHtml(avant, apres, _eco.entrees)}</body></html>`;
  }, 160);
}

async function ecoPieces() {
  const out = [];
  for (const p of _eco.pieces.filter(x => x.coche)) {
    try {
      const blob = typeof pjeTelecharger === 'function' ? await pjeTelecharger(p.path) : null;
      if (blob) out.push({ nom: p.nom, type: blob.type || 'application/pdf', blob });
    } catch (e) { showError(`Pièce illisible, ignorée : ${p.nom}`); }
  }
  return out;
}

async function ecoPartir(oppId) {
  const o = _eco.opp;
  if (!o) return;
  const dest = (document.getElementById('eco-a')?.value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) { showError('Adresse du destinataire incomplète.'); return; }
  const objet = (document.getElementById('eco-objet')?.value || '').trim();
  const avant = document.getElementById('eco-avant')?.value || '';
  const apres = document.getElementById('eco-apres')?.value || '';

  const bouton = document.getElementById('eco-envoyer');
  if (bouton) { bouton.disabled = true; bouton.textContent = '⏳ Préparation…'; }
  const pieces = await ecoPieces();
  const res = await envoyerCourriel({
    a: dest, objet, html: ecoMessageHtml(avant, apres, _eco.entrees), pieces, contexte: 'comparatif d’offres',
  });
  if (bouton) { bouton.disabled = false; bouton.textContent = '📨 Envoyer'; }
  if (!res.ok) return;

  document.getElementById('modal-envoi-comparatif')?.remove();
  const nom = typeof opNomClient === 'function' ? opNomClient(o) : '';
  if (typeof ajouterLigneHistoriqueOpportunite === 'function') {
    const retenue = _eco.entrees.find(x => x.e.retenue);
    await ajouterLigneHistoriqueOpportunite(oppId,
      `📨 Comparatif envoyé à ${dest} (${_eco.entrees.length} offre${_eco.entrees.length > 1 ? 's' : ''}${retenue ? `, proposition : ${retenue.e.compagnie}` : ''}${pieces.length ? `, ${pieces.length} PDF joint${pieces.length > 1 ? 's' : ''}` : ''})`);
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
      b.title = 'Écrire le message, puis l’envoyer avec le tableau et les PDF';
      b.onclick = () => ecoOuvrir(oppId);
      actions.appendChild(b);
    }, 0);
  };
})();
