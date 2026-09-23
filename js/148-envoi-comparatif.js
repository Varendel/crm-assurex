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
  const F = 'font-family:Segoe UI,Segoe,Tahoma,Geneva,Verdana,sans-serif;font-size:10pt;color:#1F3864';
  return String(t || '').split(/\n{2,}/).filter(p => p.trim())
    .map(p => `<p style="margin:0 0 11pt;${F}">${ecoEsc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
}

// 23.09.2026 : « la mise en page du mail est bonne mais le tableau pas trop, fais un joli tableau. »
//
// Une grille de quatre colonnes se lit sur un écran d'ordinateur et devient illisible sur un
// téléphone : « 10 % des prestations, au maximum 50 000 » passe à la ligne trois fois dans une
// colonne de 60 px. Or un comparatif d'offres se lit d'abord sur un téléphone.
//
// Une CARTE par offre : le nom et la prime sur la même ligne — les deux choses qu'on cherche —
// puis franchise et couverture en dessous, en libellé/valeur. Elle tient dans n'importe quelle
// largeur sans jamais se couper.
//
// Contrainte Outlook : il rend le HTML avec le moteur de Word. Ni flex, ni grid, ni ombre, et les
// coins arrondis sont ignorés (on les laisse : les autres messageries en profitent). Donc des
// tableaux imbriqués et des styles en ligne, c'est le seul terrain sûr.
// La couverture actuelle, si le courtier l'a choisie dans le comparateur (js/155). Elle ouvre le
// message comme elle ouvre l'écran : le client lit d'abord ce qu'il a, ensuite ce qu'on propose.
function ecoActuelHtml(ct) {
  if (!ct) return '';
  const F = 'font-family:Segoe UI,Segoe,Tahoma,Geneva,Verdana,sans-serif';
  const prime = Number(ct.prime_annuelle) || 0;
  const l = (k, v) => !v ? '' : `<tr>
    <td style="${F};font-size:9.5pt;color:#8A94A8;padding:3px 10px 3px 0;white-space:nowrap;vertical-align:top;text-transform:uppercase;letter-spacing:.04em">${k}</td>
    <td style="${F};font-size:10.5pt;color:#4A5568;padding:3px 0;vertical-align:top;line-height:1.4">${ecoEsc(v)}</td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:14px 0 4px">
    <tr><td style="padding:0 0 6px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border:1px solid #DFE5EE;border-left:4px solid #A9B4C6;border-radius:10px;background:#F7F9FC">
        <tr><td style="padding:13px 16px 12px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
            <tr>
              <td style="${F};font-size:12pt;font-weight:700;color:#4A5568;padding:0 10px 0 0;vertical-align:middle">${ecoEsc(ct.compagnie || '—')}</td>
              <td style="${F};font-size:12.5pt;font-weight:700;color:#4A5568;text-align:right;white-space:nowrap;vertical-align:middle">${prime ? 'CHF ' + fmtCHF(prime) : '—'}</td>
            </tr>
            <tr>
              <td style="${F};font-size:9pt;color:#8A94A8;font-weight:600;padding:2px 10px 0 0;letter-spacing:.03em">VOTRE COUVERTURE ACTUELLE</td>
              <td style="${F};font-size:9pt;color:#8A94A8;text-align:right;padding-top:2px">par an</td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-top:11px;border-top:1px solid #E6EBF2">
            <tr><td style="height:8px;line-height:8px;font-size:0">&nbsp;</td><td></td></tr>
            ${l('Produit', ct.produit)}
            ${l('Couverture', ct.modules)}
            ${l('Police', ct.numero_police)}
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

function ecoTableauHtml(entrees, actuel) {
  const F = 'font-family:Segoe UI,Segoe,Tahoma,Geneva,Verdana,sans-serif';
  const ref = Number(actuel && actuel.prime_annuelle) || 0;
  // L'écart avec la couverture actuelle : le seul chiffre que le client retient vraiment.
  const ecart = p => {
    const n = Number(p) || 0;
    if (!ref || !n) return '';
    const d = Math.round((n - ref) * 100) / 100;
    if (d === 0) return `<span style="${F};font-size:9.5pt;color:#7A869A">même prime qu’aujourd’hui</span>`;
    const baisse = d < 0;
    return `<span style="${F};font-size:10pt;font-weight:700;color:${baisse ? '#16A34A' : '#DC2626'}">${baisse ? '−' : '+'} CHF ${fmtCHF(Math.abs(d))}</span><span style="${F};font-size:9pt;color:#7A869A"> / an ${baisse ? 'd’économie' : 'de plus'}</span>`;
  };
  const ligne = (libelle, valeur) => !valeur ? '' : `<tr>
    <td style="${F};font-size:9.5pt;color:#7A869A;padding:3px 10px 3px 0;white-space:nowrap;vertical-align:top;text-transform:uppercase;letter-spacing:.04em">${libelle}</td>
    <td style="${F};font-size:10pt;color:#1F3864;padding:3px 0;vertical-align:top;line-height:1.4">${ecoEsc(valeur)}</td></tr>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:14px 0 18px">
    ${entrees.map(({ e }) => `<tr><td style="padding:0 0 10px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border:1px solid ${e.retenue ? '#BBE8D2' : '#E2E7EF'};border-left:4px solid ${e.retenue ? '#16A34A' : '#C8D2E4'};border-radius:10px;background:${e.retenue ? '#F4FCF8' : '#FFFFFF'}">
        <tr><td style="padding:13px 16px 12px">

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
            <tr>
              <td style="${F};font-size:12pt;font-weight:700;color:#113679;padding:0 10px 0 0;vertical-align:middle;line-height:1.25">${ecoEsc(e.compagnie || '—')}</td>
              <td style="${F};font-size:13pt;font-weight:700;color:#1F3864;text-align:right;white-space:nowrap;vertical-align:middle">${e.prime ? 'CHF ' + fmtCHF(e.prime) : '—'}</td>
            </tr>
            <tr>
              <td style="${F};font-size:9pt;color:#16A34A;font-weight:600;padding:2px 10px 0 0;letter-spacing:.03em">${e.retenue ? '✓ NOTRE PROPOSITION' : '&nbsp;'}</td>
              <td style="${F};font-size:9pt;color:#7A869A;text-align:right;padding-top:2px">${ecart(e.prime) || 'par an'}</td>
            </tr>
          </table>

          ${(e.franchise || e.couverture || e.remarque) ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-top:11px;border-top:1px solid ${e.retenue ? '#DCF0E6' : '#EDF1F7'};padding-top:4px">
            <tr><td style="height:8px;line-height:8px;font-size:0">&nbsp;</td><td></td></tr>
            ${ligne('Franchise', e.franchise)}
            ${ligne('Couverture', e.couverture)}
            ${ligne('Remarque', e.remarque)}
          </table>` : ''}

        </td></tr>
      </table>
    </td></tr>`).join('')}
  </table>`;
}

const ECO_MENTION = `<p style="margin:14pt 0 0;font-size:8.5pt;color:#8A94A8;font-family:Segoe UI,Segoe,Tahoma,Geneva,Verdana,sans-serif">Comparaison établie sur la prime annuelle indiquée par chaque compagnie ; les franchises et l’étendue des couvertures diffèrent d’une offre à l’autre. Seules les conditions générales et particulières des polices font foi.</p>`;

// 23.09.2026 : « l'affichage c'est une page A4 paysage, corrige-moi ça. » Le message n'avait aucune
// largeur de page : dans un aperçu de 1900 px, il s'étalait sur 1900 px. Un courriel se lit sur une
// colonne — au-delà de 700 px environ, l'œil perd la ligne en revenant à la marge gauche.
// Une table centrée plutôt qu'un `max-width` sur un div : Outlook rend le HTML avec le moteur de
// Word, qui ignore max-width mais respecte la largeur d'une table.
function ecoMessageHtml(avant, apres, entrees, actuel) {
  const corps = ecoTexteHtml(avant) + ecoActuelHtml(actuel) + ecoTableauHtml(entrees, actuel) + ecoTexteHtml(apres) + ECO_MENTION;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
    <tr><td align="left" style="padding:0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="width:100%;max-width:480px;border-collapse:collapse;text-align:left">
        <tr><td style="padding:0">${corps}</td></tr>
      </table>
    </td></tr>
  </table>`;
}

// ── L'objet du message (23.09.2026) ─────────────────────────────────────────────────────────────
// « L'objet du comparatif ne doit pas être le titre, mais le nom des couvertures. »
//
// Le titre d'une affaire est une note interne : « ASA et LAA », « Ménage / RC privée — Personeni
// Christelle ». Le client ne l'a jamais vu et il n'y reconnaît rien. Ce qu'il cherche dans sa boîte,
// c'est de quoi on lui parle : LAA, LPP, ménage. On prend donc les produits de l'affaire, ou à
// défaut les couvertures des offres reçues.
//
// Les libellés du portefeuille sont longs (« LAAC — LAA complémentaire (sursalaire au-delà du
// plafond LAA) ») : on garde ce qui précède la parenthèse ou le tiret, c'est-à-dire le nom usuel.
function ecoNomCourt(v) {
  let s = String(v || '').split(/\s[—–-]\s|\s*\(/)[0].trim();
  if (s.length > 38) s = s.slice(0, 37).replace(/\s+\S*$/, '') + '…';
  return s;
}

function ecoObjet(o, entrees) {
  // Les produits de l'affaire d'abord, et SEULS s'ils existent : le champ « couverture » d'une offre
  // décrit l'étendue (« RC 5 mio, inventaire 80 000 »), ce n'est pas un nom de branche. Les mêler
  // donnait des objets absurdes.
  const bruts = (Array.isArray(o.produits) && o.produits.length)
    ? o.produits
    : entrees.map(x => x.e.couverture);
  const noms = [];
  for (const b of bruts) {
    const n = ecoNomCourt(b);
    if (n && !noms.some(x => x.toLowerCase() === n.toLowerCase())) noms.push(n);
    if (noms.length === 3) break;
  }
  const tete = entrees.length > 1 ? 'Vos offres' : 'Votre offre';
  return noms.length ? `${tete} — ${noms.join(', ')}` : tete;   // jamais le titre : il est interne
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
  // La civilité, pas le prénom — on écrit à un client (js/138).
  const appel = typeof sigFormuleAppel === 'function' ? sigFormuleAppel(client) : 'Bonjour,';
  const avant = `${appel}\n\nVous trouverez ci-dessous la comparaison des offres reçues pour ${o.titre || nom}.`;
  const apres = `${reco ? reco + '\n\n' : ''}Les offres des compagnies sont jointes à ce message. Je reste à disposition pour en discuter.`;

  // Les PDF : celui de l'offre retenue coché d'office, les autres disponibles.
  const avecPdf = entrees.filter(x => x.e.offre_path);
  const uneRetenue = avecPdf.some(x => x.e.retenue);
  _eco.opp = o;
  _eco.entrees = entrees;
  // La couverture actuelle choisie dans le comparateur (js/155) suit dans le message : le client
  // lit d'abord ce qu'il a, puis l'écart. Si rien n'a été choisi, rien n'apparaît.
  _eco.actuel = typeof cexContrat === 'function' ? cexContrat(oppId) : null;
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
            <input class="form-input" id="eco-objet" value="${ecoEsc(ecoObjet(o, entrees))}" oninput="ecoApercu()"/>
            <small class="eco-aide">Repris des couvertures comparées, pas du titre de l’affaire — que le client n’a jamais vu. Modifiable.</small></div>
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
    f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px 18px;background:#EEF1F5;color:#000;word-wrap:break-word}.page{max-width:480px;margin:0;background:#fff;padding:16px 18px;box-shadow:0 1px 4px rgba(0,0,0,.12)}</style></head><body><div class="page">${bandeau}${ecoMessageHtml(avant, apres, _eco.entrees, _eco.actuel)}</div></body></html>`;
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
    a: dest, objet, html: ecoMessageHtml(avant, apres, _eco.entrees, _eco.actuel), pieces, contexte: 'comparatif d’offres',
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
