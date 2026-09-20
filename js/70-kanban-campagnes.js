// ═══ KANBAN DES CAMPAGNES (20.09.2026) ═════════════════════════════════════════════════════════
// Demande de Jonathan : suivre l'avancement des campagnes depuis REX, et relier ce suivi à Brevo.
//
// Six colonnes, fixes : idée → rédaction → prête → programmée → envoyée → analysée. Un tableau à
// colonnes configurables finit toujours par avoir quinze colonnes qu'on n'ose plus supprimer, et
// on ne peut plus rien calculer dessus puisque les états sont libres.
//
// Sur le déplacement des cartes : la position est un NOMBRE, pas un rang. Glisser une carte entre
// deux autres lui donne la moyenne de leurs positions — une seule ligne à écrire en base, au lieu
// de renuméroter toute la colonne à chaque geste. Quand deux positions finissent par se toucher,
// la colonne se renumérote d'elle-même.
//
// Sur Brevo : le CRM ne l'appelle PAS depuis le navigateur. Il faudrait y mettre une clé d'API,
// et une clé dans une page est une clé publiée. La carte porte donc l'identifiant de la campagne
// Brevo, un lien direct vers son tableau de bord, et une photographie de ses chiffres — saisie à
// la main, ou déposée par une fonction serveur le jour où on en écrira une.

const KBC_COLONNES = [
  { id: 'idee',       nom: 'Idées',      icone: '💡', aide: 'Ce qu’on pourrait faire' },
  { id: 'redaction',  nom: 'Rédaction',  icone: '✍️', aide: 'En cours d’écriture' },
  { id: 'prete',      nom: 'Prête',      icone: '📦', aide: 'Relue, prête à partir' },
  { id: 'programmee', nom: 'Programmée', icone: '⏰', aide: 'Date fixée' },
  { id: 'envoyee',    nom: 'Envoyée',    icone: '📨', aide: 'Partie' },
  { id: 'analysee',   nom: 'Analysée',   icone: '📊', aide: 'Chiffres relevés, leçon tirée' },
];

const KBC_CANAUX = {
  email: { nom: 'E-mail', icone: '✉️' }, whatsapp: { nom: 'WhatsApp', icone: '💬' },
  sms: { nom: 'SMS', icone: '📱' }, courrier: { nom: 'Courrier', icone: '📮' },
  reseaux: { nom: 'Réseaux', icone: '🌐' }, telephone: { nom: 'Téléphone', icone: '📞' },
};

window._kbc = window._kbc || { cartes: [], chargement: false, glissee: null };

function kbcEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function kbcCharger() {
  try { window._kbc.cartes = await dbGet('campagnes_projets', 'select=*&archive=eq.false&order=position.asc') || []; }
  catch (e) { window._kbc.cartes = []; }
}

function viewKanbanCampagnes() {
  if (!window._kbc.cartes.length && !window._kbc.chargement) {
    window._kbc.chargement = true;
    kbcCharger().then(() => { window._kbc.chargement = false; if (currentView === 'kanban-campagnes') kbcRendre(); });
  }
  return `<div id="kbc-page">${kbcContenu()}</div>`;
}

function kbcRendre() {
  const el = document.getElementById('kbc-page');
  if (el) el.innerHTML = kbcContenu();
}

function kbcContenu() {
  const C = window._kbc.cartes;
  const envoyees = C.filter(c => ['envoyee', 'analysee'].includes(c.colonne));
  const totalEnvois = envoyees.reduce((s, c) => s + Number((c.stats || {}).envoyes || 0), 0);
  const totalOuvertures = envoyees.reduce((s, c) => s + Number((c.stats || {}).ouvertures || 0), 0);
  const tauxOuverture = totalEnvois ? Math.round(totalOuvertures * 100 / totalEnvois) : null;
  const kpi = (l, v, s, ton) => `<div class="dbx-kpi ${ton || ''}"><span class="dbx-kpi-label">${l}</span><span class="dbx-kpi-valeur">${v}</span><span class="dbx-kpi-sous">${s}</span></div>`;

  return `
  <div class="page-header">
    <h2>🗂️ Campagnes — le tableau</h2>
    <p class="page-sub">Chaque campagne est une carte : on la fait glisser d’une colonne à l’autre.
      Les chiffres de Brevo se relèvent sur la carte une fois la campagne partie.</p>
  </div>

  <div class="dbx-kpis">
    ${kpi('En préparation', C.filter(c => ['idee', 'redaction', 'prete'].includes(c.colonne)).length, 'idées, rédaction, prêtes')}
    ${kpi('Programmées', C.filter(c => c.colonne === 'programmee').length, 'date fixée')}
    ${kpi('Envois cumulés', totalEnvois.toLocaleString('fr-CH'), `${envoyees.length} campagne(s) partie(s)`)}
    ${kpi('Taux d’ouverture', tauxOuverture == null ? '—' : tauxOuverture + ' %', tauxOuverture == null ? 'aucun chiffre relevé' : 'sur l’ensemble des envois')}
  </div>

  <div class="kbc-outils">
    <button type="button" class="btn-save" onclick="kbcOuvrirCarte()">+ Nouvelle campagne</button>
    <a class="btn-secondary" href="https://app.brevo.com/marketing-campaigns" target="_blank" rel="noopener">Ouvrir Brevo ↗</a>
  </div>

  <div class="kbc-tableau">
    ${KBC_COLONNES.map(col => {
      const cartes = C.filter(c => c.colonne === col.id).sort((a, b) => Number(a.position) - Number(b.position));
      return `<section class="kbc-colonne" data-colonne="${col.id}"
          ondragover="kbcSurvol(event)" ondragleave="kbcQuitte(event)" ondrop="kbcDeposer(event,'${col.id}')">
        <header class="kbc-colonne-tete">
          <span class="kbc-colonne-nom"><span aria-hidden="true">${col.icone}</span> ${col.nom}</span>
          <span class="kbc-compte">${cartes.length}</span>
        </header>
        <div class="kbc-cartes">
          ${cartes.map(kbcCarteHtml).join('') || `<div class="kbc-vide">${col.aide}</div>`}
        </div>
      </section>`;
    }).join('')}
  </div>`;
}

function kbcCarteHtml(c) {
  const canal = KBC_CANAUX[c.canal] || KBC_CANAUX.email;
  const s = c.stats || {};
  const taux = s.envoyes ? Math.round(Number(s.ouvertures || 0) * 100 / Number(s.envoyes)) : null;
  const enRetard = c.date_prevue && c.colonne !== 'envoyee' && c.colonne !== 'analysee'
    && c.date_prevue < new Date().toISOString().slice(0, 10);
  return `<article class="kbc-carte ${enRetard ? 'retard' : ''}" draggable="true"
      ondragstart="kbcPrendre(event,'${c.id}')" ondragend="kbcLacher(event)"
      onclick="kbcOuvrirCarte('${c.id}')" tabindex="0"
      onkeydown="if(event.key==='Enter'){kbcOuvrirCarte('${c.id}')}">
    <div class="kbc-carte-tete">
      <span class="kbc-canal" title="${canal.nom}">${canal.icone}</span>
      <b>${kbcEsc(c.titre)}</b>
    </div>
    ${c.cible ? `<div class="kbc-cible">${kbcEsc(c.cible)}${c.nb_destinataires ? ` · ${c.nb_destinataires} destinataire(s)` : ''}</div>` : ''}
    <div class="kbc-carte-pied">
      ${c.date_prevue ? `<span class="kbc-date ${enRetard ? 'retard' : ''}">${fmtDate(c.date_prevue)}</span>` : ''}
      ${c.responsable ? `<span class="kbc-qui">${kbcEsc(c.responsable)}</span>` : ''}
      ${c.brevo_id ? '<span class="kbc-brevo" title="Reliée à Brevo">Brevo</span>' : ''}
    </div>
    ${s.envoyes ? `<div class="kbc-stats">
      <span><b>${Number(s.envoyes).toLocaleString('fr-CH')}</b> envoyés</span>
      ${taux != null ? `<span><b>${taux} %</b> ouverts</span>` : ''}
      ${s.clics ? `<span><b>${Number(s.clics).toLocaleString('fr-CH')}</b> clics</span>` : ''}
    </div>` : ''}
  </article>`;
}

// ── Glisser-déposer ─────────────────────────────────────────────────────────────────────────────
function kbcPrendre(ev, id) {
  window._kbc.glissee = id;
  ev.dataTransfer.effectAllowed = 'move';
  try { ev.dataTransfer.setData('text/plain', id); } catch (e) {}
  ev.currentTarget.classList.add('kbc-en-vol');
}
function kbcLacher(ev) { ev.currentTarget.classList.remove('kbc-en-vol'); window._kbc.glissee = null; }
function kbcSurvol(ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; ev.currentTarget.classList.add('kbc-cible-survol'); }
function kbcQuitte(ev) { ev.currentTarget.classList.remove('kbc-cible-survol'); }

async function kbcDeposer(ev, colonne) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('kbc-cible-survol');
  const id = window._kbc.glissee || ev.dataTransfer.getData('text/plain');
  const c = window._kbc.cartes.find(x => x.id === id);
  if (!c || c.colonne === colonne) return;

  // La carte se pose en bas de sa nouvelle colonne, à mille de la dernière : on ne renumérote rien.
  const dans = window._kbc.cartes.filter(x => x.colonne === colonne);
  const position = dans.length ? Math.max(...dans.map(x => Number(x.position))) + 1000 : 1000;

  const avant = { colonne: c.colonne, position: c.position };
  c.colonne = colonne; c.position = position;      // affichage immédiat : on ne fait pas attendre un geste
  kbcRendre();

  const r = await dbPatch('campagnes_projets', id, { colonne, position });
  if (r && r.error) {
    Object.assign(c, avant);                        // la base a refusé : on remet la carte où elle était
    kbcRendre();
    showError('Déplacement non enregistré : ' + errMsg(r));
  }
}

// ── La fiche d'une campagne ─────────────────────────────────────────────────────────────────────
function kbcOuvrirCarte(id) {
  const c = id ? window._kbc.cartes.find(x => x.id === id) : null;
  const v = (k, d) => kbcEsc(c ? (c[k] ?? '') : (d ?? ''));
  const s = (c && c.stats) || {};
  creerModale('modal-kbc', `
    <div class="opx-modale kbc-modale" role="dialog" aria-modal="true" aria-labelledby="kbc-titre">
      <h3 id="kbc-titre">${c ? 'Campagne' : 'Nouvelle campagne'}</h3>

      <div class="form-field"><label class="form-label" for="kbc-titre-c">Titre</label>
        <input class="form-input" id="kbc-titre-c" value="${v('titre')}" placeholder="Ex. : Hausse des primes 2027"/></div>

      <div class="kbc-lignes">
        <div class="form-field"><label class="form-label" for="kbc-canal">Canal</label>
          <select class="form-input" id="kbc-canal">
            ${Object.entries(KBC_CANAUX).map(([k, x]) => `<option value="${k}" ${c && c.canal === k ? 'selected' : ''}>${x.icone} ${x.nom}</option>`).join('')}
          </select></div>
        <div class="form-field"><label class="form-label" for="kbc-colonne">Étape</label>
          <select class="form-input" id="kbc-colonne">
            ${KBC_COLONNES.map(x => `<option value="${x.id}" ${c && c.colonne === x.id ? 'selected' : ''}>${x.icone} ${x.nom}</option>`).join('')}
          </select></div>
        <div class="form-field"><label class="form-label" for="kbc-date">Date prévue</label>
          <input class="form-input" type="date" id="kbc-date" value="${v('date_prevue')}"/></div>
      </div>

      <div class="kbc-lignes">
        <div class="form-field"><label class="form-label" for="kbc-cible">À qui</label>
          <input class="form-input" id="kbc-cible" value="${v('cible')}" placeholder="Ex. : clients OZ sans mandat signé"/></div>
        <div class="form-field"><label class="form-label" for="kbc-nb">Destinataires</label>
          <input class="form-input" type="number" id="kbc-nb" value="${v('nb_destinataires')}"/></div>
        <div class="form-field"><label class="form-label" for="kbc-resp">Responsable</label>
          <input class="form-input" id="kbc-resp" value="${v('responsable', (typeof crxMoi === 'function' ? crxMoi().nom : ''))}"/></div>
      </div>

      <div class="form-field"><label class="form-label" for="kbc-desc">Le message, en deux lignes</label>
        <textarea class="form-input" id="kbc-desc" rows="3">${v('description')}</textarea></div>

      <fieldset class="kbc-brevo-bloc">
        <legend>Brevo</legend>
        <p class="kbc-note">Le CRM n’interroge pas Brevo : cela demanderait d’embarquer une clé
          d’API dans la page, donc de la publier. On note ici l’identifiant de la campagne et ses
          chiffres, relevés dans Brevo.</p>
        <div class="kbc-lignes">
          <div class="form-field"><label class="form-label" for="kbc-brevo">N° de campagne</label>
            <input class="form-input" type="number" id="kbc-brevo" value="${v('brevo_id')}"/></div>
          <div class="form-field"><label class="form-label" for="kbc-envoyes">Envoyés</label>
            <input class="form-input" type="number" id="kbc-envoyes" value="${kbcEsc(s.envoyes ?? '')}"/></div>
          <div class="form-field"><label class="form-label" for="kbc-ouvertures">Ouvertures</label>
            <input class="form-input" type="number" id="kbc-ouvertures" value="${kbcEsc(s.ouvertures ?? '')}"/></div>
          <div class="form-field"><label class="form-label" for="kbc-clics">Clics</label>
            <input class="form-input" type="number" id="kbc-clics" value="${kbcEsc(s.clics ?? '')}"/></div>
        </div>
        ${c && c.brevo_id ? `<a class="btn-secondary" href="https://app.brevo.com/marketing-campaigns/email/report/${c.brevo_id}" target="_blank" rel="noopener">Voir le rapport dans Brevo ↗</a>` : ''}
      </fieldset>

      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-kbc').remove()">Fermer</button>
        ${c ? `<button type="button" class="btn-secondary" onclick="kbcArchiver('${c.id}')">Archiver</button>` : ''}
        <button type="button" class="btn-save" onclick="kbcEnregistrer(${c ? `'${c.id}'` : 'null'})">Enregistrer</button>
      </div>
    </div>`, { padding: '16px' });
}

async function kbcEnregistrer(id) {
  const val = k => (document.getElementById('kbc-' + k)?.value || '').trim();
  const nb = k => { const x = val(k); return x === '' ? null : Number(x); };
  const titre = val('titre-c');
  if (!titre) { showError('Donne un titre à la campagne.'); return; }

  const stats = { envoyes: nb('envoyes'), ouvertures: nb('ouvertures'), clics: nb('clics') };
  const aDesStats = Object.values(stats).some(x => x !== null);

  const ligne = {
    titre, description: val('desc') || null, canal: val('canal'), colonne: val('colonne'),
    date_prevue: val('date') || null, cible: val('cible') || null,
    nb_destinataires: nb('nb'), responsable: val('resp') || null,
    brevo_id: nb('brevo'),
    stats: aDesStats ? stats : null,
    stats_le: aDesStats ? new Date().toISOString() : null,
  };

  let r;
  if (id) r = await dbPatch('campagnes_projets', id, ligne);
  else {
    const dans = window._kbc.cartes.filter(x => x.colonne === ligne.colonne);
    ligne.position = dans.length ? Math.max(...dans.map(x => Number(x.position))) + 1000 : 1000;
    ligne.cree_par = (typeof crxMoi === 'function' ? crxMoi().nom : null);
    r = await dbPost('campagnes_projets', ligne);
  }
  if (r && r.error) { showError('Enregistrement impossible : ' + errMsg(r)); return; }
  document.getElementById('modal-kbc')?.remove();
  await kbcCharger();
  kbcRendre();
  showError('✓ Campagne enregistrée.');
}

// ── Le pont avec Brevo (20.09.2026) ─────────────────────────────────────────────────────────────
// Les chiffres se saisissaient à la main ; depuis que la clé d'API vit dans les secrets Supabase,
// l'écran Brevo (js/84) peut les relever et les reporter ici. Le rapprochement se fait par le
// numéro de campagne Brevo, jamais par le titre : deux campagnes peuvent porter le même nom, et
// écrire des statistiques sur la mauvaise ne se remarque pas avant longtemps.
function kbcCampagneParBrevo(brevoId) {
  const n = Number(brevoId);
  if (!n) return null;
  return (window._kbc.cartes || []).find(c => Number(c.brevo_id) === n) || null;
}

async function kbcReporterChiffres(brevoId, chiffres) {
  // Le tableau peut ne pas avoir été ouvert de la session : on le charge avant de conclure qu'il
  // n'y a pas de correspondance.
  if (!(window._kbc.cartes || []).length) await kbcCharger();
  const c = kbcCampagneParBrevo(brevoId);
  if (!c) return { ok: false, erreur: 'Aucune campagne du tableau ne porte ce numéro Brevo.' };

  const stats = {
    envoyes: Number(chiffres.envoyes || 0),
    ouvertures: Number(chiffres.ouvertures || 0),
    clics: Number(chiffres.clics || 0),
  };
  const r = await dbPatch('campagnes_projets', c.id, {
    stats, stats_le: chiffres.releve_le || new Date().toISOString(),
  });
  if (r && r.error) return { ok: false, erreur: errMsg(r) };

  c.stats = stats; c.stats_le = chiffres.releve_le || new Date().toISOString();
  if (typeof currentView !== 'undefined' && currentView === 'kanban-campagnes') kbcRendre();
  return { ok: true, nom: c.titre };
}

async function kbcArchiver(id) {
  if (!confirm('Archiver cette campagne ? Elle disparaît du tableau mais rien n’est supprimé.')) return;
  const r = await dbPatch('campagnes_projets', id, { archive: true });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  document.getElementById('modal-kbc')?.remove();
  await kbcCharger();
  kbcRendre();
}
