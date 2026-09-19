// ═══ PRÉPARER UN DOSSIER DE FINANCEMENT (20.09.2026, demande de Jonathan) ═══════════════════════
// Reprend la check-list papier « Demande de prêt hypothécaire » d'Assurex et la transforme en suivi
// vivant : on coche ce qui est reçu, le CRM calcule ce qui manque, imprime la liste sur le papier à
// en-tête pour le client et prépare le rappel par e-mail.
//  - Les sections s'affichent selon la situation (salarié / indépendant, achat / construction /
//    reprise, objet de rendement, PPE) : on ne demande jamais au client des pièces inutiles.
//  - Chaque pièce garde sa provenance (« où l'obtenir ») telle qu'indiquée sur la check-list.
//  - Tout est enregistré dans Supabase (table dossiers_financement) : rien en local, rien de perdu.
//  - Rien n'est envoyé automatiquement : l'e-mail passe par un aperçu et une confirmation.

const DF_CHECKLIST = [
  { groupe: 'Documents personnels', cond: null, items: [
    { cle: 'piece_identite', label: 'Copie de la pièce d’identité (pour les étrangers : livret et autorisation de séjour)', source: 'Client' },
    { cle: 'impots', label: 'Dernière déclaration d’impôt (avec inventaire des titres) et dernière taxation fiscale', source: 'Administration fiscale' },
    { cle: 'avoirs_gages', label: 'Relevé des avoirs mis en gage en garantie supplémentaire (2e et 3e piliers, comptes de libre passage)', source: 'Institut financier' },
    { cle: 'certificat_lpp', label: 'Certificat de caisse de pension et/ou relevé de libre passage (dès 50 ans)', source: 'Institut financier' },
    { cle: 'nationalite_us', label: 'Déclaration de nationalité et statut « US person »', source: 'Annexe à signer' },
  ] },
  { groupe: 'Activité salariée', cond: 'salarie', items: [
    { cle: 'attestation_salaire', label: 'Attestation de salaire actuelle et bulletins de salaire des 3 derniers mois', source: 'Employeur' },
  ] },
  { groupe: 'Indépendant ou salarié dans sa propre entreprise', cond: 'independant', items: [
    { cle: 'registre_commerce', label: 'Extrait du registre du commerce', source: 'Fiduciaire' },
    { cle: 'comptes_3ans', label: 'Bilans et comptes de pertes et profits des 3 dernières années, signés', source: 'Fiduciaire' },
    { cle: 'rapport_revision', label: 'Rapport de l’organe de révision des 3 dernières années', source: 'Fiduciaire' },
  ] },
  { groupe: 'Immeuble et financement', cond: null, items: [
    { cle: 'plans', label: 'Plans de construction et plan d’ensemble', source: 'Vendeur, architecte, maître d’œuvre' },
    { cle: 'registre_foncier', label: 'Extrait du registre foncier de moins de 6 mois', source: 'Vendeur, registre foncier, notaire' },
    { cle: 'descriptif', label: 'Descriptif de construction', source: 'Vendeur, architecte' },
    { cle: 'photos', label: '4 à 5 photos couleur actuelles (extérieur et intérieur : salle de bain, cuisine, séjour)', source: 'Vendeur' },
    { cle: 'incendie', label: 'Police d’assurance incendie avec année de construction et cubage, ou certificat de cubage SIA (m³)', source: 'ECA, vendeur, architecte, gérance' },
    { cle: 'renovations', label: 'Liste des travaux de rénovation et investissements (année et but)', source: 'Vendeur' },
  ] },
  { groupe: 'Lors d’un achat', cond: 'achat', items: [
    { cle: 'acte_achat', label: 'Acte d’achat ou projet d’acte d’achat', source: 'Notaire' },
    { cle: 'doc_vente', label: 'Description de la construction ou documentation de vente', source: 'Vendeur' },
    { cle: 'fonds_propres', label: 'Justificatifs des fonds propres', source: 'Institut financier' },
    { cle: 'certificat_simule', label: 'Certificat d’assurance simulé après retrait anticipé de l’avoir de prévoyance', source: 'Institut financier' },
  ] },
  { groupe: 'Consolidation d’un crédit de construction', cond: 'construction', items: [
    { cle: 'acte_achat_constr', label: 'Acte d’achat ou projet d’acte d’achat', source: 'Notaire' },
    { cle: 'compte_credit', label: 'Extrait du compte de crédit de construction et contrat de crédit actuel', source: 'Institut financier' },
    { cle: 'contrat_entreprise', label: 'Contrat d’entreprise générale et/ou contrat d’entreprise', source: 'Entreprise générale' },
  ] },
  { groupe: 'Reprise d’un prêt hypothécaire existant', cond: 'reprise', items: [
    { cle: 'contrat_hypo', label: 'Contrat de crédit hypothécaire actuel et dernier décompte des intérêts', source: 'Institut financier' },
  ] },
  { groupe: 'Objets de rendement', cond: 'rendement', items: [
    { cle: 'etat_locatif', label: 'État locatif actuel signé', source: 'Vendeur, régie' },
  ] },
  { groupe: 'Objets en PPE', cond: 'ppe', items: [
    { cle: 'fonds_renovation', label: 'État du fonds de rénovation', source: 'Administrateur PPE, gérance' },
    { cle: 'reglement_ppe', label: 'Règlement de propriété par étages', source: 'Administrateur PPE, notaire' },
  ] },
  { groupe: 'Le cas échéant', cond: null, facultatif: true, items: [
    { cle: 'contrat_pret', label: 'Contrat de prêt (montant, intérêts, durée)', source: 'Prêteur' },
    { cle: 'hoirie', label: 'Contrat d’avancement d’hoirie ou de donation', source: 'Notaire' },
    { cle: 'leasing', label: 'Contrat de leasing ou de crédit privé', source: 'Organisme de financement' },
    { cle: 'divorce', label: 'Convention de divorce, de séparation ou pensions alimentaires', source: 'Avocat, notaire' },
    { cle: 'superficie', label: 'Contrat de droit de superficie', source: 'Notaire, registre foncier' },
    { cle: 'augmentation', label: 'Raison et utilisation de l’augmentation du prêt hypothécaire existant', source: 'Client' },
  ] },
];

const DF_SITUATIONS = [
  { cle: 'salarie', label: 'Salarié(e)' },
  { cle: 'independant', label: 'Indépendant(e)' },
  { cle: 'achat', label: 'Achat' },
  { cle: 'construction', label: 'Crédit de construction' },
  { cle: 'reprise', label: 'Reprise d’hypothèque' },
  { cle: 'rendement', label: 'Objet de rendement' },
  { cle: 'ppe', label: 'PPE' },
];
const DF_STATUTS = [
  { v: 'en_cours', l: 'En préparation' }, { v: 'transmis', l: 'Transmis à la banque' },
  { v: 'accepte', l: 'Accepté' }, { v: 'refuse', l: 'Refusé' }, { v: 'annule', l: 'Annulé' },
];

let _dfListe = null;          // dossiers chargés depuis Supabase (null = pas encore chargés)
let _df = null;               // dossier ouvert
let _dfSale = false;          // modifications non enregistrées

function dfEsc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function dfIsoAuj() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dfClient(id) { return (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === (id || (_df && _df.client_id))) || null; }
function dfNomClient(c) {
  if (!c) return '';
  return (typeof estEntreprise === 'function' && estEntreprise(c)) ? (c.nom || '').trim() : `${c.prenom || ''} ${c.nom || ''}`.trim();
}
function dfSituation(cle) { return !!(_df && _df.situation && _df.situation[cle]); }

// Catalogue + état enregistré : les sections inactives restent stockées mais ne s'affichent pas.
function dfGroupesActifs() {
  return DF_CHECKLIST.filter(g => !g.cond || dfSituation(g.cond));
}
function dfEtat(cle) {
  const d = (_df && Array.isArray(_df.documents) ? _df.documents : []).find(x => x.cle === cle);
  return d || { cle, fourni: false, date_recue: '', note: '' };
}
function dfMajEtat(cle, champs) {
  if (!_df) return;
  if (!Array.isArray(_df.documents)) _df.documents = [];
  const i = _df.documents.findIndex(x => x.cle === cle);
  if (i < 0) _df.documents.push({ cle, fourni: false, date_recue: '', note: '', ...champs });
  else _df.documents[i] = { ..._df.documents[i], ...champs };
  _dfSale = true;
}
function dfPieces(seulementRequises) {
  const out = [];
  dfGroupesActifs().forEach(g => {
    if (seulementRequises && g.facultatif) return;
    g.items.forEach(it => out.push({ ...it, groupe: g.groupe, etat: dfEtat(it.cle) }));
  });
  return out;
}
function dfAvancement() {
  const req = dfPieces(true);
  const ok = req.filter(p => p.etat.fourni).length;
  return { ok, total: req.length, pct: req.length ? Math.round(ok * 100 / req.length) : 0 };
}
function dfManquantes() {
  // Les pièces « le cas échéant » ne sont réclamées que si on les a marquées comme attendues (note).
  return dfPieces(true).filter(p => !p.etat.fourni)
    .concat(dfPieces(false).filter(p => !p.etat.fourni && p.etat.note && !dfPieces(true).some(r => r.cle === p.cle)));
}

// ── Chargement / ouverture ──────────────────────────────────────────────────────────────────────
async function dfCharger(forcer) {
  if (_dfListe && !forcer) return _dfListe;
  _dfListe = await dbGet('dossiers_financement', 'select=*&order=created_at.desc');
  return _dfListe;
}
function dfNormaliser(d) {
  return { ...d, situation: d.situation && typeof d.situation === 'object' ? d.situation : {}, documents: Array.isArray(d.documents) ? d.documents : [] };
}

// Point d'entrée depuis la fiche client (onglet Documents)
async function ouvrirDossierFinancement(clientId) {
  document.getElementById('modal-onglet-documents')?.remove();
  await dfCharger(true);
  const existants = _dfListe.filter(d => d.client_id === clientId && d.statut !== 'annule');
  _df = existants.length ? dfNormaliser(existants[0]) : dfNouveauLocal(clientId);
  _dfSale = !existants.length;
  navigate('dossier-financement');
}
function dfNouveauLocal(clientId) {
  const c = dfClient(clientId);
  return {
    id: null, client_id: clientId, objet: '', banque: '', montant: null, statut: 'en_cours',
    situation: { salarie: !(c && typeof estEntreprise === 'function' && estEntreprise(c)), achat: true },
    documents: [], notes: '', cree_par: (typeof currentUser !== 'undefined' && currentUser ? currentUser.email : '') || '',
  };
}

async function dfOuvrir(id) {
  await dfCharger();
  const d = _dfListe.find(x => x.id === id);
  if (!d) { showError('Dossier introuvable.'); return; }
  _df = dfNormaliser(d); _dfSale = false;
  navigate('dossier-financement', { silent: true });
}
function dfFermer() { if (_dfSale && !confirm('Des modifications ne sont pas enregistrées. Fermer quand même ?')) return; _df = null; _dfSale = false; navigate('dossier-financement', { silent: true }); }

// ── Enregistrement ──────────────────────────────────────────────────────────────────────────────
async function dfEnregistrer(silencieux) {
  if (!_df) return false;
  const corps = {
    client_id: _df.client_id, objet: (_df.objet || '').slice(0, 200) || null, banque: (_df.banque || '').slice(0, 120) || null,
    montant: _df.montant === '' || _df.montant === null || isNaN(Number(_df.montant)) ? null : Number(_df.montant),
    statut: _df.statut || 'en_cours', situation: _df.situation || {}, documents: _df.documents || [],
    notes: _df.notes || null, updated_at: new Date().toISOString(),
  };
  let r;
  if (_df.id) r = await dbPatch('dossiers_financement', _df.id, corps);
  else { r = await dbPost('dossiers_financement', { ...corps, cree_par: _df.cree_par || null }); if (r && r[0] && r[0].id) _df.id = r[0].id; }
  if (r && r.error) { showError('Enregistrement impossible : ' + (typeof errMsg === 'function' ? errMsg(r) : '')); return false; }
  _dfSale = false;
  await dfCharger(true);
  if (!silencieux) showError('✓ Dossier enregistré.');
  const b = document.getElementById('df-etat-sauve'); if (b) b.textContent = 'Enregistré';
  return true;
}
function dfChamp(k, v) {
  if (!_df) return;
  _df[k] = v; _dfSale = true;
  const b = document.getElementById('df-etat-sauve'); if (b) b.textContent = 'Modifications non enregistrées';
}
function dfBasculerSituation(cle, oui) {
  if (!_df) return;
  _df.situation = { ..._df.situation, [cle]: !!oui }; _dfSale = true;
  navigate('dossier-financement', { silent: true });
}
function dfBasculerPiece(cle, oui) {
  dfMajEtat(cle, { fourni: !!oui, date_recue: oui ? dfIsoAuj() : '' });
  const l = document.getElementById('df-ligne-' + cle); if (l) l.classList.toggle('df-ok', !!oui);
  const d = document.getElementById('df-date-' + cle); if (d) d.textContent = oui ? `reçu le ${fmtDate(dfIsoAuj())}` : '';
  dfMajAvancement();
}
function dfNotePiece(cle, v) { dfMajEtat(cle, { note: v }); }
function dfMajAvancement() {
  const a = dfAvancement();
  const bar = document.getElementById('df-barre'); if (bar) bar.style.width = a.pct + '%';
  const t = document.getElementById('df-compteur'); if (t) t.textContent = `${a.ok} / ${a.total} pièces reçues · ${a.pct} %`;
  const b = document.getElementById('df-etat-sauve'); if (b) b.textContent = 'Modifications non enregistrées';
}

// ── Vue ─────────────────────────────────────────────────────────────────────────────────────────
function viewDossierFinancement() {
  if (_dfListe === null) { dfCharger().then(() => navigate('dossier-financement', { silent: true })); return '<div class="df"><p class="dx-sous">Chargement des dossiers…</p></div>'; }
  return _df ? dfVueDossier() : dfVueListe();
}

function dfVueListe() {
  const clients = (typeof allClients !== 'undefined' ? allClients : []).map(x => ({ id: x.id, n: dfNomClient(x) })).filter(x => x.n).sort((a, b) => a.n.localeCompare(b.n, 'fr'));
  const lignes = (_dfListe || []).map(d => {
    const c = dfClient(d.client_id);
    const dd = dfNormaliser(d);
    const sauve = _df; _df = dd; const a = dfAvancement(); _df = sauve;
    const st = DF_STATUTS.find(s => s.v === d.statut) || DF_STATUTS[0];
    return `<button type="button" class="df-ligne-dossier" onclick="dfOuvrir('${d.id}')">
      <span class="df-ld-nom">${dfEsc(dfNomClient(c) || 'Client supprimé')}</span>
      <span class="df-ld-objet">${dfEsc(d.objet || 'Sans objet')}${d.banque ? ' · ' + dfEsc(d.banque) : ''}</span>
      <span class="df-ld-avance"><i style="width:${a.pct}%"></i></span>
      <span class="df-ld-pct">${a.ok}/${a.total}</span>
      <span class="df-badge df-badge-${d.statut}">${dfEsc(st.l)}</span>
    </button>`;
  }).join('');
  return `<div class="df">
    <header class="dx-tete"><div><div class="dx-surtitre">Hypothèques · check-list Assurex</div><h2>Dossiers de financement</h2>
      <p class="dx-sous">Prépare la demande de prêt hypothécaire : les pièces à réunir, qui les fournit, ce qui manque encore.</p></div>
      <div class="dx-tete-actions">
        <input class="form-input df-choix-client" id="df-nouveau-client" list="df-clients" placeholder="Nouveau dossier pour…"/>
        <datalist id="df-clients">${clients.map(x => `<option value="${dfEsc(x.n)}"></option>`).join('')}</datalist>
        <button type="button" class="btn-save" onclick="dfNouveauDepuisChamp()">🏦 Préparer un dossier</button>
      </div></header>
    <section class="dbx-carte df-liste">${lignes || '<p class="dx-sous">Aucun dossier pour l’instant — choisis un client ci-dessus pour commencer.</p>'}</section>
  </div>`;
}
function dfNouveauDepuisChamp() {
  const nom = (document.getElementById('df-nouveau-client')?.value || '').trim();
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => dfNomClient(x) === nom);
  if (!c) { showError('Client introuvable — choisis-le dans la liste.'); return; }
  ouvrirDossierFinancement(c.id);
}

function dfVueDossier() {
  const c = dfClient();
  const a = dfAvancement();
  const groupes = dfGroupesActifs().map(g => `<section class="dbx-carte df-groupe">
      <h3>${dfEsc(g.groupe)}${g.facultatif ? ' <small>(uniquement si la situation le demande)</small>' : ''}</h3>
      ${g.items.map(it => {
        const e = dfEtat(it.cle);
        return `<div class="df-ligne ${e.fourni ? 'df-ok' : ''}" id="df-ligne-${it.cle}">
          <label class="df-case"><input type="checkbox" ${e.fourni ? 'checked' : ''} onchange="dfBasculerPiece('${it.cle}', this.checked)"/><span></span></label>
          <div class="df-txt">
            <div class="df-label">${dfEsc(it.label)}</div>
            <div class="df-source">📍 ${dfEsc(it.source)} <em id="df-date-${it.cle}">${e.fourni && e.date_recue ? 'reçu le ' + fmtDate(e.date_recue) : ''}</em></div>
          </div>
          <input class="form-input df-note" value="${dfEsc(e.note)}" placeholder="remarque…" oninput="dfNotePiece('${it.cle}', this.value)"/>
        </div>`;
      }).join('')}
    </section>`).join('');
  return `<div class="df">
    <header class="dx-tete"><div><div class="dx-surtitre">Dossier de financement · ${dfEsc(dfNomClient(c) || '')}</div><h2>Demande de prêt hypothécaire</h2>
      <p class="dx-sous">Coche ce que tu as reçu : le CRM tient la liste de ce qui manque, l’imprime sur le papier à en-tête et prépare la relance.</p></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-secondary" onclick="dfFermer()">← Tous les dossiers</button>
        <button type="button" class="btn-secondary" onclick="dfPdf()">🖨️ Check-list PDF</button>
        <button type="button" class="btn-secondary" onclick="dfEmail()">✉️ Demander les pièces manquantes…</button>
        <button type="button" class="btn-save" onclick="dfEnregistrer()">💾 Enregistrer</button>
      </div></header>

    <section class="dbx-carte df-entete">
      <div class="df-trois">
        <div class="form-field"><label class="form-label" for="df-objet">Objet financé</label>
          <input class="form-input" id="df-objet" value="${dfEsc(_df.objet || '')}" placeholder="Ex. : appartement 4,5 p., Ch. du Lac 4, 1095 Lutry" oninput="dfChamp('objet', this.value)"/></div>
        <div class="form-field"><label class="form-label" for="df-banque">Établissement</label>
          <input class="form-input" id="df-banque" value="${dfEsc(_df.banque || '')}" placeholder="Banque ou assureur" oninput="dfChamp('banque', this.value)"/></div>
        <div class="form-field"><label class="form-label" for="df-montant">Montant du prêt (CHF)</label>
          <input class="form-input" id="df-montant" type="number" step="1000" value="${_df.montant ?? ''}" oninput="dfChamp('montant', this.value)"/></div>
      </div>
      <div class="df-trois">
        <div class="form-field"><label class="form-label" for="df-statut">Statut</label>
          <select class="form-select" id="df-statut" onchange="dfChamp('statut', this.value)">${DF_STATUTS.map(s => `<option value="${s.v}" ${s.v === (_df.statut || 'en_cours') ? 'selected' : ''}>${dfEsc(s.l)}</option>`).join('')}</select></div>
        <div class="form-field df-deux-col"><span class="form-label">Situation (détermine les pièces demandées)</span>
          <div class="df-situations">${DF_SITUATIONS.map(s => `<label class="df-chip ${dfSituation(s.cle) ? 'actif' : ''}"><input type="checkbox" ${dfSituation(s.cle) ? 'checked' : ''} onchange="dfBasculerSituation('${s.cle}', this.checked)"/>${dfEsc(s.label)}</label>`).join('')}</div></div>
      </div>
      <div class="df-avancement">
        <div class="df-barre-fond"><i id="df-barre" style="width:${a.pct}%"></i></div>
        <div class="df-avance-txt"><b id="df-compteur">${a.ok} / ${a.total} pièces reçues · ${a.pct} %</b><span id="df-etat-sauve">${_dfSale ? 'Modifications non enregistrées' : 'Enregistré'}</span></div>
      </div>
    </section>

    ${groupes}

    <section class="dbx-carte">
      <div class="form-field"><label class="form-label" for="df-notes">Notes internes</label>
        <textarea class="form-input" id="df-notes" rows="3" placeholder="Conditions, taux discuté, contact à la banque…" oninput="dfChamp('notes', this.value)">${dfEsc(_df.notes || '')}</textarea></div>
    </section>
  </div>`;
}

// ── Check-list imprimable sur le papier à en-tête (même mécanique que les courriers, js/45) ─────
const DF_CSS_IMPRESSION = `.df-p-titre{font-weight:700;font-size:13pt;margin:0 0 2mm}.df-p-sous{color:#334155;margin:0 0 6mm;font-size:10pt}
.df-p-groupe{font-weight:700;color:#113679;border-bottom:1px solid #00CFFF;margin:5mm 0 2mm;padding-bottom:1mm;font-size:10.5pt}
.df-p-item{display:flex;gap:3mm;align-items:flex-start;margin:0 0 1.8mm;font-size:9.5pt;line-height:1.35}
.df-p-case{flex:0 0 4mm;font-size:11pt;line-height:1}.df-p-src{color:#475569;font-size:8.5pt}
.df-p-note{color:#113679;font-size:8.5pt;font-style:italic}`;

function dfHtmlChecklist(pourClient) {
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const c = dfClient();
  const groupes = dfGroupesActifs().map(g => {
    const items = g.items.filter(it => !pourClient || !dfEtat(it.cle).fourni);
    if (!items.length) return '';
    return `<div class="df-p-groupe">${dfEsc(g.groupe)}</div>` + items.map(it => {
      const e = dfEtat(it.cle);
      return `<div class="df-p-item"><span class="df-p-case">${e.fourni ? '☒' : '☐'}</span><span>${dfEsc(it.label)}<br/><span class="df-p-src">Où l’obtenir : ${dfEsc(it.source)}</span>${e.note ? `<br/><span class="df-p-note">${dfEsc(e.note)}</span>` : ''}</span></div>`;
    }).join('');
  }).join('');
  const entete = [_df.objet, _df.banque, _df.montant ? `Prêt envisagé : CHF ${Number(_df.montant).toLocaleString('fr-CH')}` : ''].filter(Boolean).map(dfEsc).join(' · ');
  return `<div class="crx-page">
    <div class="crx-entete"><img src="${base}assets/logos/courrier-assurex-bleu.png" alt="Assurex"/><img src="${base}assets/logos/courrier-exgroup-bleu.png" alt="EX.GROUP"/></div>
    <div class="crx-corps-lettre">
      <div class="df-p-titre">Check-list des documents à joindre — Demande de prêt hypothécaire</div>
      <div class="df-p-sous">${dfEsc(dfNomClient(c))}${entete ? ' — ' + entete : ''}<br/>${pourClient ? 'Documents encore à nous transmettre, au ' : 'État du dossier au '}${dfEsc(fmtDate(dfIsoAuj()))}</div>
      ${groupes || '<p>Toutes les pièces nécessaires ont été reçues.</p>'}
    </div>
    <div class="crx-pied">${(typeof CRX_PIED !== 'undefined' ? CRX_PIED : []).map(dfEsc).join('<br/>')}</div>
  </div>`;
}

function dfPdf(pourClient) {
  if (!_df) return;
  if (_dfSale) dfEnregistrer(true);
  const titre = `Check-list financement — ${dfNomClient(dfClient())}${_df.objet ? ' — ' + _df.objet : ''}`.replace(/\//g, '.').replace(/[<>:"\\|?*\x00-\x1F]/g, '').trim();
  const css = (typeof CRX_CSS_IMPRESSION !== 'undefined' ? CRX_CSS_IMPRESSION : '') + DF_CSS_IMPRESSION;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${dfEsc(titre)}</title><style>${css}</style></head><body>${dfHtmlChecklist(!!pourClient)}</body></html>`;
  document.getElementById('df-cadre-impression')?.remove();
  const f = document.createElement('iframe');
  f.id = 'df-cadre-impression';
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(html); d.close();
  const imprimer = () => {
    const titreApp = document.title; document.title = titre;
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { showError('Impression impossible : ' + e.message); }
    setTimeout(() => { document.title = titreApp; }, 1500);
  };
  Promise.all([...d.images].map(i => i.complete ? null : new Promise(ok => { i.onload = i.onerror = ok; }))).then(() => setTimeout(imprimer, 150));
}

// ── Relance : liste des pièces manquantes, avec aperçu obligatoire avant envoi ──────────────────
function dfTexteManquantes() {
  const manque = dfManquantes();
  const parGroupe = {};
  manque.forEach(p => { (parGroupe[p.groupe] = parGroupe[p.groupe] || []).push(p); });
  return Object.keys(parGroupe).map(g => `${g} :\n` + parGroupe[g].map(p => `  - ${p.label} (${p.source})`).join('\n')).join('\n\n');
}
function dfEmail() {
  if (!_df) return;
  if (_dfSale) dfEnregistrer(true);
  const c = dfClient();
  const manque = dfManquantes();
  if (!manque.length) { showError('Toutes les pièces sont reçues — rien à demander.'); return; }
  const moi = typeof crxMoi === 'function' ? crxMoi() : { nom: '', prenom: '', email: '', tel: '' };
  const civ = c && c.civilite === 'Madame' ? 'Madame,' : c && c.civilite === 'Monsieur' ? 'Monsieur,' : 'Madame, Monsieur,';
  const corps = [civ, '',
    `Afin de finaliser votre demande de financement${_df.objet ? ' (' + _df.objet + ')' : ''}, il nous manque encore les documents suivants :`, '',
    dfTexteManquantes(), '',
    'Vous pouvez nous les transmettre par e-mail en réponse à ce message. Nous restons à votre disposition pour toute question.', '',
    'Meilleures salutations', '', moi.nom, moi.email, moi.tel].filter(x => x !== undefined).join('\n');
  window._dfEnvoi = { email: String((c && c.email) || '').trim(), sujet: `Votre dossier de financement — documents à nous transmettre`, corps };
  creerModale('modal-df-email', `
    <div class="opx-modale mdx-modale mdx-modale-flex mdx-modale-large" role="dialog" aria-modal="true" aria-labelledby="df-mail-titre">
      ${typeof mdxTeteModale === 'function' ? mdxTeteModale('✉️', 'Demander les pièces manquantes', 'Rien n’est envoyé automatiquement — relis, corrige si besoin, puis choisis comment le transmettre.', 'modal-df-email', 'df-mail-titre') : '<h3 id="df-mail-titre">Aperçu avant envoi</h3>'}
      <div class="form-field"><label class="form-label" for="df-mail-a">À</label><input class="form-input" id="df-mail-a" value="${dfEsc(window._dfEnvoi.email)}" placeholder="adresse e-mail du client"/></div>
      <div class="form-field"><label class="form-label" for="df-mail-sujet">Objet</label><input class="form-input" id="df-mail-sujet" value="${dfEsc(window._dfEnvoi.sujet)}"/></div>
      <div class="form-field mdx-champ-corps"><label class="form-label" for="df-mail-corps">Message</label><textarea class="form-input" id="df-mail-corps" rows="14">${dfEsc(corps)}</textarea></div>
      <div class="opx-modale-actions mdx-actions mdx-actions-envoi">
        <button type="button" class="btn-secondary mdx-a-gauche" onclick="document.getElementById('modal-df-email').remove()">Fermer</button>
        <button type="button" class="btn-secondary" onclick="dfPdf(true)">🖨️ Imprimer la liste pour le client</button>
        <button type="button" class="btn-secondary" onclick="dfMailto()">📧 Ouvrir dans mon client mail</button>
        <button type="button" class="btn-save" onclick="dfEnvoyerOutlook()">📨 Envoyer via Outlook…</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
}
function dfMailto() {
  const to = document.getElementById('df-mail-a')?.value || '';
  const s = document.getElementById('df-mail-sujet')?.value || '', b = document.getElementById('df-mail-corps')?.value || '';
  window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(b)}`, '_blank');
}
async function dfEnvoyerOutlook() {
  const to = (document.getElementById('df-mail-a')?.value || '').split(/[;,\s]+/).filter(x => /@/.test(x));
  const sujet = document.getElementById('df-mail-sujet')?.value || '';
  const corps = document.getElementById('df-mail-corps')?.value || '';
  if (!to.length) { showError('Indique au moins une adresse e-mail.'); return; }
  if (!confirm(`Envoyer la demande de documents à ${to.join(', ')} depuis ton compte Outlook ?`)) return;
  if (typeof assurerTokenOutlook === 'function' && !(await assurerTokenOutlook())) {
    showError('Connecte-toi à Outlook (bouton Microsoft dans le menu) pour envoyer, ou utilise « Ouvrir dans mon client mail ».');
    return;
  }
  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { subject: sujet, body: { contentType: 'text', content: corps }, toRecipients: to.map(a => ({ emailAddress: { address: a } })) }, saveToSentItems: true }),
    });
    if (r.status === 401) { showError('Session Outlook expirée — reconnecte-toi puis réessaie.'); return; }
    if (!r.ok) { showError('Échec de l’envoi via Outlook.'); return; }
  } catch (e) { showError('Erreur réseau : ' + e.message); return; }
  showError(`✓ Demande envoyée à ${to.join(', ')}.`);
  if (_df && _df.client_id) {
    await dbPost('activites_client', { client_id: _df.client_id, type: 'courrier', sujet: sujet.slice(0, 300), contenu: corps.slice(0, 10000), auteur: ((typeof crxMoi === 'function' ? crxMoi().nom : '') || '').slice(0, 200) });
  }
  document.getElementById('modal-df-email')?.remove();
}
