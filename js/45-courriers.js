// ═══ COURRIERS CLIENTS AVEC EN-TÊTE (19.09.2026, demande de Jonathan) ═══════════════════════════
// Reprend la mise en page du courrier Word utilisé au cabinet : papier à en-tête Assurex / EX.GROUP,
// lieu et date, bloc adresse à droite (fenêtre d'enveloppe), n° de police(s) en référence, objet en
// gras, formule d'appel selon la civilité, corps, signature centrée (nom, e-mail, téléphone).
//  - Modèles réutilisables, variables remplies depuis la fiche client et les contrats cochés.
//  - Aperçu A4 en direct, export Word (templates/courrier-client.docx, même en-tête / pied de page
//    que l'original) et PDF (impression), envoi par e-mail via Outlook avec le courrier Word joint.
//  - Chaque courrier généré ou envoyé est archivé dans le journal d'activité de la fiche client.
//  - Rien n'est envoyé automatiquement : l'envoi passe toujours par l'aperçu et une confirmation.

const CRX_LIEU = 'St-Sulpice';
const CRX_PIED = [
  'Agrément FINMA F01565757 | Assurances entreprises / prévoyance / santé / garantie de loyer',
  'Assurex Sàrl - Cofidex SA – Rue du Centre 142 – 1025 St-Sulpice / succursale : c/o Cofidex SA Ch. de Pallud 3 - 1822 Chernex',
  'Tél. +41 21 614 00 40 – info@cofidex.ch – www.cofidex.ch',
];

// Variables : {prenom} {nom} {conseiller} {conseiller_prenom} {compagnie} {police} {produit}
//             {echeance} {date_limite}
const CRX_MODELES = [
  { id: 'polices-prevoyance', label: 'Envoi de polices prévoyance (3a)', objet: 'Vos nouvelles polices prévoyance', corps:
`Nous avons le plaisir de vous transmettre, en annexe, vos nouvelles polices de prévoyance ainsi que vos premiers bulletins de versement.

Afin de mettre en place votre stratégie d’épargne dans les meilleures conditions, nous vous recommandons d’enregistrer deux ordres de paiement permanents depuis votre espace bancaire en ligne, à la même date.

Les versements seront ainsi effectués régulièrement et les investissements réalisés de manière périodique, conformément à la stratégie prévue. Cette approche permet notamment de lisser les points d’entrée sur les marchés et de profiter pleinement, sur la durée, du potentiel des intérêts composés.

N’hésitez pas à contacter {conseiller_prenom} à tout moment si vous avez la moindre question concernant vos assurances ou si vous souhaitez faire évoluer la stratégie d’investissement de votre contrat. Il reste volontiers à votre disposition pour vous conseiller et vous accompagner dans la durée.` },
  { id: 'envoi-police', label: 'Envoi de police', objet: 'Votre nouvelle police {produit}', corps:
`Nous avons le plaisir de vous transmettre, en annexe, votre nouvelle police {compagnie} n° {police}.

Nous vous remercions de bien vouloir en prendre connaissance et de nous signaler toute inexactitude. Nous vous conseillons de conserver ce document avec vos papiers importants.

N’hésitez pas à contacter {conseiller_prenom} à tout moment si vous avez la moindre question concernant vos assurances. Il reste volontiers à votre disposition pour vous conseiller et vous accompagner dans la durée.` },
  { id: 'bulletins-3a', label: 'Bulletins de versement / ordres permanents 3a', objet: 'Vos versements de prévoyance', corps:
`Vous trouverez en annexe les bulletins de versement relatifs à votre contrat de prévoyance {compagnie} n° {police}.

Pour simplifier vos versements, nous vous recommandons d’enregistrer un ordre de paiement permanent depuis votre espace bancaire en ligne. Vos cotisations seront ainsi versées régulièrement, sans oubli, et restent déductibles de votre revenu imposable dans les limites légales.

{conseiller_prenom} reste volontiers à votre disposition pour toute question.` },
  { id: 'changement-compagnie', label: 'Changement de compagnie', objet: 'Changement de compagnie d’assurance', corps:
`Suite à notre entretien, nous vous confirmons la mise en place de votre nouvelle couverture {produit} auprès de {compagnie} (police n° {police}).

Nous nous chargeons des démarches auprès de votre ancien assureur. Aucune action n’est nécessaire de votre part ; nous vous tiendrons informé(e) de la confirmation de résiliation dès sa réception.

N’hésitez pas à contacter {conseiller_prenom} pour toute question.` },
  { id: 'resiliation', label: 'Confirmation de résiliation', objet: 'Résiliation de votre police {compagnie}', corps:
`Nous vous confirmons avoir transmis la résiliation de votre police {compagnie} n° {police} ({produit}) pour sa prochaine échéance.

Nous vous ferons parvenir la confirmation de l’assureur dès sa réception. D’ici là, votre couverture actuelle reste pleinement en vigueur.

{conseiller_prenom} reste volontiers à votre disposition pour toute question.` },
  { id: 'rappel-echeance', label: 'Rappel d’échéance', objet: 'Échéance de votre police {compagnie}', corps:
`Votre police {compagnie} n° {police} ({produit}) arrive à échéance le {echeance}. Une éventuelle résiliation doit parvenir à l’assureur au plus tard le {date_limite}.

C’est le bon moment pour vérifier que votre couverture correspond toujours à vos besoins et que la prime reste compétitive. Nous vous proposons d’en discuter lors d’un court rendez-vous.

N’hésitez pas à contacter {conseiller_prenom} pour convenir d’une date.` },
  { id: 'libre', label: 'Courrier libre', objet: '', corps: '' },
];

let _crx = { clientId: null, modele: 'polices-prevoyance', contrats: [], lieu: CRX_LIEU, date: '', objet: '', salutation: '', corps: '', signataire: '', email: '', tel: '', edite: false, archive: '' };

function crxEsc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function crxIsoAuj() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function crxDateLongue(iso) { const d = iso ? new Date(iso + 'T12:00:00') : new Date(); return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }); }
function crxClient() { return (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === _crx.clientId) || null; }
function crxNomClient(c) { return !c ? '' : (typeof estEntreprise === 'function' && estEntreprise(c)) ? (c.nom || '').trim() : `${c.prenom || ''} ${c.nom || ''}`.trim(); }
function crxContratsClient(c) {
  return !c ? [] : (typeof allContrats !== 'undefined' ? allContrats : []).filter(ct => ct.client_id === c.id && !['annulé', 'annulée', 'resilie', 'résilié'].includes(String(ct.statut || '').toLowerCase()));
}
function crxAdresse(c) {
  if (!c) return [];
  return [crxNomClient(c), c.co, c.adresse, [c.npa, c.ville].filter(Boolean).join(' ')].map(x => String(x || '').trim()).filter(Boolean);
}
function crxSalutation(c) {
  if (!c || (typeof estEntreprise === 'function' && estEntreprise(c))) return 'Madame, Monsieur,';
  return c.civilite === 'Madame' ? 'Madame,' : c.civilite === 'Monsieur' ? 'Monsieur,' : 'Madame, Monsieur,';
}
function crxMoi() {
  const u = typeof currentUser !== 'undefined' && currentUser ? currentUser : {};
  const ag = (typeof allAgents !== 'undefined' ? allAgents : []).find(a => a.email === u.email) || {};
  return { nom: `${u.prenom || ag.prenom || ''} ${u.nom || ag.nom || ''}`.trim(), prenom: u.prenom || ag.prenom || '', email: u.email || ag.email || '', tel: ag.telephone || ag.tel || ag.mobile || u.telephone || '' };
}
function crxVariables() {
  const c = crxClient();
  const ct = crxContratsClient(c).find(x => _crx.contrats.includes(x.id)) || {};
  const moi = crxMoi();
  let limite = '';
  if (ct.date_echeance) {
    const mois = Number(ct.preavis_mois) || (/lamal/i.test(ct.produit || '') ? 1 : 3);
    const d = new Date(ct.date_echeance + 'T12:00:00'); d.setMonth(d.getMonth() - mois);
    limite = crxDateLongue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return {
    prenom: c ? (c.prenom || '') : '', nom: c ? (c.nom || '') : '',
    conseiller: _crx.signataire || moi.nom, conseiller_prenom: (_crx.signataire || moi.nom).split(' ')[0] || moi.prenom,
    compagnie: typeof normaliserCompagnie === 'function' ? normaliserCompagnie(ct.compagnie || '') : (ct.compagnie || ''),
    police: ct.numero_police || '', produit: ct.produit || '',
    echeance: ct.date_echeance ? crxDateLongue(ct.date_echeance) : '', date_limite: limite,
  };
}
function crxRemplir(txt) {
  const v = crxVariables();
  return String(txt || '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? (v[k] || `[${k}]`) : m));
}
function crxAppliquerModele() {
  const m = CRX_MODELES.find(x => x.id === _crx.modele) || CRX_MODELES[0];
  _crx.objet = crxRemplir(m.objet);
  _crx.corps = crxRemplir(m.corps);
  _crx.edite = false;
}
function crxParagraphes() { return String(_crx.corps || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean); }
function crxReferences() {
  const c = crxClient();
  return crxContratsClient(c).filter(ct => _crx.contrats.includes(ct.id) && ct.numero_police).map(ct => ct.numero_police);
}
function crxTexteComplet() {
  return [`${_crx.lieu}, le ${crxDateLongue(_crx.date)}`, '', ...crxAdresse(crxClient()), '', ...crxReferences(), _crx.objet, '', _crx.salutation, '', crxParagraphes().join('\n\n'), '', _crx.signataire, _crx.email, _crx.tel].join('\n');
}

// Point d'entrée depuis la fiche client (menu Documents)
function ouvrirCourrierClient(clientId) {
  _crx = { ..._crx, clientId, contrats: [], date: crxIsoAuj(), archive: '' };
  const c = crxClient();
  _crx.salutation = crxSalutation(c);
  const moi = crxMoi(); _crx.signataire = moi.nom; _crx.email = moi.email; _crx.tel = moi.tel;
  crxAppliquerModele();
  document.getElementById('modal-onglet-documents')?.remove();
  navigate('courriers');
}

function viewCourriers() {
  if (!_crx.date) { _crx.date = crxIsoAuj(); const moi = crxMoi(); _crx.signataire = _crx.signataire || moi.nom; _crx.email = _crx.email || moi.email; _crx.tel = _crx.tel || moi.tel; }
  if (!_crx.corps && !_crx.edite && _crx.modele !== 'libre') crxAppliquerModele();
  const c = crxClient();
  const clients = (typeof allClients !== 'undefined' ? allClients : []).filter(x => x.statut !== 'inactif' || x.id === _crx.clientId)
    .map(x => ({ id: x.id, n: crxNomClient(x) })).filter(x => x.n).sort((a, b) => a.n.localeCompare(b.n, 'fr'));
  const contrats = crxContratsClient(c);
  return `<div class="crx">
    <header class="dx-tete"><div><div class="dx-surtitre">Documents · papier à en-tête Assurex / EX.GROUP</div><h2>Courriers clients</h2>
      <p class="dx-sous">Choisis un client et un modèle, ajuste le texte : l’aperçu se met à jour. Chaque courrier généré est archivé dans le journal de la fiche client.</p></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-secondary" onclick="crxWord()" ${c ? '' : 'disabled'}>📄 Word</button>
        <button type="button" class="btn-secondary" onclick="crxPdf()" ${c ? '' : 'disabled'}>🖨️ PDF / imprimer</button>
        <button type="button" class="btn-save" onclick="crxEmail()" ${c ? '' : 'disabled'}>✉️ Envoyer par e-mail…</button>
      </div></header>
    <div class="crx-grille">
      <section class="dbx-carte crx-form">
        <div class="form-field"><label class="form-label" for="crx-client">Client</label>
          <input class="form-input" id="crx-client" list="crx-clients" placeholder="Rechercher un client…" value="${crxEsc(crxNomClient(c))}" onchange="crxChoisirClient(this.value)"/>
          <datalist id="crx-clients">${clients.map(x => `<option value="${crxEsc(x.n)}"></option>`).join('')}</datalist></div>
        <div class="form-field"><label class="form-label" for="crx-modele">Modèle</label>
          <select class="form-select" id="crx-modele" onchange="crxChoisirModele(this.value)">${CRX_MODELES.map(m => `<option value="${m.id}" ${m.id === _crx.modele ? 'selected' : ''}>${crxEsc(m.label)}</option>`).join('')}</select></div>
        ${c ? `<div class="form-field"><span class="form-label">Police(s) en référence</span>
          <div class="crx-contrats">${contrats.length ? contrats.map(ct => `<label><input type="checkbox" ${_crx.contrats.includes(ct.id) ? 'checked' : ''} onchange="crxBasculerContrat('${ct.id}', this.checked)"/>
            ${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 18) : ''}<span>${crxEsc(ct.produit || '')} <small>${crxEsc(ct.numero_police || 'sans n°')}</small></span></label>`).join('') : '<small>Aucun contrat actif.</small>'}</div></div>` : ''}
        <div class="crx-deux">
          <div class="form-field"><label class="form-label" for="crx-lieu">Lieu</label><input class="form-input" id="crx-lieu" value="${crxEsc(_crx.lieu)}" oninput="crxChamp('lieu', this.value)"/></div>
          <div class="form-field"><label class="form-label" for="crx-date">Date</label><input class="form-input" id="crx-date" type="date" value="${crxEsc(_crx.date)}" oninput="crxChamp('date', this.value)"/></div>
        </div>
        <div class="form-field"><label class="form-label" for="crx-objet">Objet</label><input class="form-input" id="crx-objet" value="${crxEsc(_crx.objet)}" oninput="crxChamp('objet', this.value)"/></div>
        <div class="form-field"><label class="form-label" for="crx-salutation">Formule d’appel</label><input class="form-input" id="crx-salutation" value="${crxEsc(_crx.salutation)}" oninput="crxChamp('salutation', this.value)"/></div>
        <div class="form-field"><label class="form-label" for="crx-corps">Texte <small>(une ligne vide entre deux paragraphes)</small></label>
          <textarea class="form-input" id="crx-corps" rows="14" oninput="crxChamp('corps', this.value)">${crxEsc(_crx.corps)}</textarea></div>
        <div class="crx-deux crx-trois">
          <div class="form-field"><label class="form-label" for="crx-sign">Signataire</label><input class="form-input" id="crx-sign" value="${crxEsc(_crx.signataire)}" oninput="crxChamp('signataire', this.value)"/></div>
          <div class="form-field"><label class="form-label" for="crx-email">E-mail</label><input class="form-input" id="crx-email" value="${crxEsc(_crx.email)}" oninput="crxChamp('email', this.value)"/></div>
          <div class="form-field"><label class="form-label" for="crx-tel">Téléphone</label><input class="form-input" id="crx-tel" value="${crxEsc(_crx.tel)}" oninput="crxChamp('tel', this.value)"/></div>
        </div>
      </section>
      <section class="crx-apercu-zone" aria-label="Aperçu du courrier"><div id="crx-apercu">${crxHtmlLettre(false)}</div></section>
    </div>
  </div>`;
}

function crxChoisirClient(nom) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => crxNomClient(x) === String(nom || '').trim());
  if (!c) { showError('Client introuvable — choisis-le dans la liste.'); return; }
  _crx.clientId = c.id; _crx.contrats = []; _crx.salutation = crxSalutation(c); _crx.archive = '';
  if (!_crx.edite) crxAppliquerModele();
  navigate('courriers', { silent: true });
}
function crxChoisirModele(id) {
  if (_crx.edite && !confirm('Remplacer le texte modifié par celui du modèle ?')) { const s = document.getElementById('crx-modele'); if (s) s.value = _crx.modele; return; }
  _crx.modele = id; crxAppliquerModele(); navigate('courriers', { silent: true });
}
function crxBasculerContrat(id, oui) {
  _crx.contrats = oui ? [...new Set([..._crx.contrats, id])] : _crx.contrats.filter(x => x !== id);
  if (!_crx.edite) { crxAppliquerModele(); const o = document.getElementById('crx-objet'), t = document.getElementById('crx-corps'); if (o) o.value = _crx.objet; if (t) t.value = _crx.corps; }
  crxMajApercu();
}
function crxChamp(k, v) { _crx[k] = v; if (k === 'corps' || k === 'objet') _crx.edite = true; crxMajApercu(); }
function crxMajApercu() { const z = document.getElementById('crx-apercu'); if (z) z.innerHTML = crxHtmlLettre(false); }

// Lettre A4 (aperçu et PDF) — logos en URL absolues pour la fenêtre d'impression
function crxHtmlLettre(pourImpression) {
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const c = crxClient();
  const adr = crxAdresse(c);
  const refs = crxReferences();
  return `<div class="crx-page">
    <div class="crx-entete"><img src="${base}assets/logos/courrier-assurex-bleu.png" alt="Assurex"/><img src="${base}assets/logos/courrier-exgroup-bleu.png" alt="EX.GROUP"/></div>
    <div class="crx-corps-lettre">
      <div class="crx-droite">${crxEsc(_crx.lieu)}, le ${crxEsc(crxDateLongue(_crx.date))}</div>
      <div class="crx-droite crx-adresse">${adr.length ? adr.map(crxEsc).join('<br/>') : '<i>Adresse du client</i>'}</div>
      ${refs.length ? `<div class="crx-refs">${refs.map(crxEsc).join('<br/>')}</div>` : ''}
      <div class="crx-objet">${crxEsc(_crx.objet)}</div>
      <p>${crxEsc(_crx.salutation)}</p>
      ${crxParagraphes().map(p => `<p>${crxEsc(p).replace(/\n/g, '<br/>')}</p>`).join('')}
      <div class="crx-signature"><b>${crxEsc(_crx.signataire)}</b><br/><b>${crxEsc(_crx.email)}</b>${_crx.tel ? `<br/><b>${crxEsc(_crx.tel)}</b>` : ''}</div>
    </div>
    <div class="crx-pied">${CRX_PIED.map(crxEsc).join('<br/>')}</div>
  </div>`;
}

const CRX_CSS_IMPRESSION = `@page{size:A4;margin:0}body{margin:0;background:#fff;font-family:'Segoe UI',Arial,sans-serif;color:#111}
.crx-page{width:210mm;min-height:297mm;box-sizing:border-box;padding:14mm 20mm 12mm 25mm;position:relative;display:flex;flex-direction:column}
.crx-entete{display:flex;justify-content:space-between;align-items:center;margin-bottom:14mm}.crx-entete img{height:9.5mm;width:auto}
.crx-corps-lettre{flex:1;font-size:11pt;line-height:1.45;text-align:justify}.crx-droite{margin-left:84mm}
.crx-adresse{margin-top:22mm;margin-bottom:20mm}.crx-refs{font-weight:700}.crx-objet{font-weight:700;margin:4mm 0 6mm}
.crx-corps-lettre p{margin:0 0 4mm}.crx-signature{text-align:center;margin-top:8mm}
.crx-pied{text-align:center;font-size:7.5pt;color:#113679;line-height:1.5;border-top:1px solid #00CFFF;padding-top:3mm;margin-top:8mm}
@media screen{body{background:#e5e7eb}.crx-page{margin:10mm auto;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.15)}}`;

function crxPdf() {
  if (!crxClient()) return;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Courrier — ${crxEsc(crxNomClient(crxClient()))} — ${crxEsc(_crx.objet)}</title><style>${CRX_CSS_IMPRESSION}</style></head>
    <body>${crxHtmlLettre(true)}<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`;
  window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  crxArchiver('PDF');
}

function crxDonneesWord() {
  return {
    lieu_date: `${_crx.lieu}, le ${crxDateLongue(_crx.date)}`,
    adresse: crxAdresse(crxClient()).map(ligne => ({ ligne })),
    references: crxReferences().map(ref => ({ ref })),
    objet: _crx.objet, salutation: _crx.salutation,
    paragraphes: crxParagraphes().map(texte => ({ texte })),
    signataire: _crx.signataire, contact: [_crx.email, _crx.tel].filter(Boolean).join('\n'),
  };
}
function crxNomFichier() { return `Courrier — ${crxNomClient(crxClient())} — ${_crx.objet || 'courrier'} — ${fmtDate(_crx.date)}`.replace(/\//g, '.').replace(/[<>:"\\|?*\x00-\x1F]/g, '').trim(); }

async function crxDocxBlob() {
  if (typeof window.PizZip === 'undefined' || typeof window.docxtemplater === 'undefined') throw new Error('Génération Word indisponible (pas de connexion internet ?)');
  const r = await fetch('templates/courrier-client.docx');
  if (!r.ok) throw new Error(`Modèle introuvable (${r.status})`);
  const doc = new window.docxtemplater(new window.PizZip(await r.arrayBuffer()), { paragraphLoop: true, linebreaks: true });
  doc.render(crxDonneesWord());
  return doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
async function crxWord() {
  if (!crxClient()) return;
  try {
    const blob = await crxDocxBlob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = crxNomFichier() + '.docx';
    document.body.appendChild(a); a.click(); a.remove();
    crxArchiver('Word');
  } catch (e) { showError('Erreur Word : ' + e.message); }
}

// Archivage dans le journal d'activité (une fois par version du courrier)
async function crxArchiver(forme) {
  const c = crxClient(); if (!c) return;
  const texte = crxTexteComplet();
  const cle = forme + '|' + texte;
  if (_crx.archive === cle) return;
  const r = await dbPost('activites_client', { client_id: c.id, type: 'courrier', sujet: `${_crx.objet || 'Courrier'} (${forme})`.slice(0, 300), contenu: texte.slice(0, 10000), auteur: (crxMoi().nom || '').slice(0, 200) });
  if (r && r.error) { showError('⚠️ Courrier généré, mais non archivé dans le journal du client : ' + (typeof errMsg === 'function' ? errMsg(r) : '')); return; }
  _crx.archive = cle;
}

// ── Envoi par e-mail : aperçu obligatoire, jamais d'envoi automatique ──
function crxEmail() {
  const c = crxClient(); if (!c) return;
  const to = String(c.email || '').trim();
  const corps = [_crx.salutation, '', crxParagraphes().join('\n\n'), '', 'Meilleures salutations', '', _crx.signataire, _crx.email, _crx.tel].filter(x => x !== undefined).join('\n');
  creerModale('modal-crx-email', `
    <div class="opx-modale mdx-modale mdx-modale-flex mdx-modale-large" role="dialog" aria-modal="true" aria-labelledby="crx-mail-titre">
      ${typeof mdxTeteModale === 'function' ? mdxTeteModale('✉️', 'Aperçu avant envoi', 'Rien n’est envoyé automatiquement — relis, corrige si besoin, puis choisis comment le transmettre.', 'modal-crx-email', 'crx-mail-titre') : '<h3 id="crx-mail-titre">Aperçu avant envoi</h3>'}
      <div class="form-field"><label class="form-label" for="crx-mail-a">À</label><input class="form-input" id="crx-mail-a" value="${crxEsc(to)}" placeholder="adresse e-mail du client"/></div>
      <div class="form-field"><label class="form-label" for="crx-mail-sujet">Objet</label><input class="form-input" id="crx-mail-sujet" value="${crxEsc(_crx.objet)}"/></div>
      <div class="form-field mdx-champ-corps"><label class="form-label" for="crx-mail-corps">Message</label><textarea class="form-input" id="crx-mail-corps" rows="12">${crxEsc(corps)}</textarea></div>
      <label class="crx-joindre"><input type="checkbox" id="crx-mail-joindre" checked/> Joindre le courrier au format Word (${crxEsc(crxNomFichier())}.docx)</label>
      <div class="opx-modale-actions mdx-actions mdx-actions-envoi">
        <button type="button" class="btn-secondary mdx-a-gauche" onclick="document.getElementById('modal-crx-email').remove()">Fermer</button>
        <button type="button" class="btn-secondary" onclick="crxMailto()">📧 Ouvrir dans mon client mail</button>
        <button type="button" class="btn-save" onclick="crxEnvoyerOutlook()">📨 Envoyer via Outlook…</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
}
function crxMailto() {
  const to = document.getElementById('crx-mail-a')?.value || '';
  const s = document.getElementById('crx-mail-sujet')?.value || '', b = document.getElementById('crx-mail-corps')?.value || '';
  window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(b)}`, '_blank');
}
async function crxEnvoyerOutlook() {
  const to = (document.getElementById('crx-mail-a')?.value || '').split(/[;,\s]+/).filter(x => /@/.test(x));
  const sujet = document.getElementById('crx-mail-sujet')?.value || '';
  const corps = document.getElementById('crx-mail-corps')?.value || '';
  const joindre = document.getElementById('crx-mail-joindre')?.checked;
  if (!to.length) { showError('Indique l’adresse e-mail du destinataire.'); return; }
  if (!confirm(`Envoyer ce courriel à ${to.join(', ')} depuis ton compte Outlook${joindre ? ', avec le courrier Word en pièce jointe' : ''} ?`)) return;
  if (!(await assurerTokenOutlook())) { showError('Connecte-toi à Outlook (bouton Microsoft dans le menu) pour envoyer.'); return; }
  const message = { subject: sujet, body: { contentType: 'text', content: corps }, toRecipients: to.map(e => ({ emailAddress: { address: e } })) };
  try {
    if (joindre) {
      const blob = await crxDocxBlob();
      const b64 = await new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = ko; fr.readAsDataURL(blob); });
      message.attachments = [{ '@odata.type': '#microsoft.graph.fileAttachment', name: crxNomFichier() + '.docx', contentType: blob.type, contentBytes: b64 }];
    }
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', { method: 'POST', headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message, saveToSentItems: true }) });
    if (r.status === 401) { showError('Session Outlook expirée — reconnecte-toi puis réessaie.'); return; }
    if (!r.ok) { showError("Échec de l'envoi via Outlook — réessaie."); return; }
  } catch (e) { showError('Erreur lors de l’envoi : ' + e.message); return; }
  document.getElementById('modal-crx-email')?.remove();
  await crxArchiver('e-mail à ' + to.join(', '));
  showError(`✓ Courriel envoyé à ${to.join(', ')}.`);
}
