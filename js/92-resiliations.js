// ═══ LES RÉSILIATIONS DE L'AFFAIRE (20.09.2026) ════════════════════════════════════════════════
// « J'ai aussi demandé à pouvoir gérer la résiliation assureur précédent depuis le bloc opp. »
//
// C'est le complément direct des couvertures qu'on vient de rétablir, et c'est pourquoi les deux
// vont ensemble : une affaire qui reprend « RC ménage + protection juridique + véhicule » se
// résilie chez TROIS compagnies, à trois dates limites différentes. Le bloc que j'avais posé ce
// matin ne décrivait qu'un seul contrat — suffisant pour le cas simple, faux dès qu'il y en a deux.
//
// LE POINT QUI COMPTE : LA DATE LIMITE EST UNE DATE DE RÉCEPTION.
// Une résiliation vaut quand elle est PARVENUE à l'assureur, pas quand elle est partie. Compter
// le courrier fait partie du calcul, et c'est ce qui se perd quand on suit ça de tête. Un contrat
// qu'on rate reste une année de plus : le client paie deux primes et l'apprend par son relevé.
//
// CE QU'ON REPREND DU PORTEFEUILLE. Le client a souvent déjà ses contrats chez nous. Les
// resaisir serait du travail inutile et une source d'écart : on propose donc ses contrats actifs,
// et la ligne créée garde le lien. La saisie libre reste possible — un assureur qu'on quitte
// n'est pas forcément un contrat que nous gérions.

window._rsl = window._rsl || { parOpp: {}, chargement: {} };

function rslEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rslCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }

function rslJours(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso + 'T23:59:59') - new Date()) / 86400000);
}

// Trois mois avant l'échéance : le délai ordinaire des contrats choses et RC en Suisse. C'est une
// aide à la saisie, PAS une règle — les conditions générales de chaque contrat font foi, et
// certaines branches ont leur propre calendrier (LAMal au 30 novembre, par exemple). La date
// reste modifiable, et c'est volontairement elle qui est enregistrée, pas la formule.
function rslLimiteProposee(echeance) {
  if (!echeance) return '';
  const d = new Date(echeance + 'T00:00:00');
  d.setMonth(d.getMonth() - 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rslEtat(r) {
  if (r.confirmee_le) return { cle: 'confirmee', nom: 'Confirmée', ton: 'ok' };
  if (r.envoyee_le) return { cle: 'envoyee', nom: 'Envoyée', ton: 'attente' };
  const j = rslJours(r.limite);
  if (j != null && j < 0) return { cle: 'depassee', nom: 'Délai dépassé', ton: 'grave' };
  if (j != null && j <= 21) return { cle: 'urgente', nom: `${j} j`, ton: 'grave' };
  if (j != null) return { cle: 'a_faire', nom: `${j} j`, ton: j <= 60 ? 'alerte' : '' };
  return { cle: 'a_faire', nom: 'À faire', ton: '' };
}

// ── Chargement ──────────────────────────────────────────────────────────────────────────────────
async function rslCharger(oppId) {
  if (window._rsl.chargement[oppId]) return;
  window._rsl.chargement[oppId] = true;
  try {
    const r = await dbGet('opportunites_resiliations',
      `opportunite_id=eq.${oppId}&select=*&order=limite.asc.nullslast`);
    window._rsl.parOpp[oppId] = Array.isArray(r) ? r : [];
  } catch (e) {
    window._rsl.parOpp[oppId] = [];
  }
  window._rsl.chargement[oppId] = false;
  rslPeindre(oppId);
}

function rslListe(oppId) { return window._rsl.parOpp[oppId] || null; }

// ── Le bloc ─────────────────────────────────────────────────────────────────────────────────────
function rslBlocHtml(o) {
  const l = rslListe(o.id);
  if (l === null) setTimeout(() => rslCharger(o.id), 0);

  return `<section class="dbx-carte opx-carte rsl-carte" id="rsl-bloc-${o.id}">
    ${rslCorpsHtml(o, l)}
  </section>`;
}

function rslCorpsHtml(o, l) {
  if (l === null) {
    return `<div class="dbx-carte-tete"><h3 class="opx-h3">Résiliations</h3></div>
      <div class="dbx-chargement"><span></span><span></span><span></span></div>`;
  }

  const ouvertes = l.filter(r => !r.confirmee_le);
  const pire = ouvertes.map(r => rslJours(r.limite)).filter(j => j != null).sort((a, b) => a - b)[0];

  return `
    <div class="dbx-carte-tete">
      <h3 class="opx-h3">Résiliations${l.length ? ` · ${l.length}` : ''}</h3>
      <button type="button" class="dbx-lien" onclick="rslOuvrirAjout('${o.id}')">+ Contrat à résilier</button>
    </div>

    ${l.length ? `
      ${pire != null && pire <= 21 ? `<div class="rsl-alerte ${pire < 0 ? 'depassee' : ''}">
        ${pire < 0
          ? `<b>Délai dépassé de ${-pire} jour${-pire > 1 ? 's' : ''}</b><small>Le contrat court une année de plus : le client paiera deux primes s’il souscrit ailleurs.</small>`
          : `<b>Plus que ${pire} jour${pire > 1 ? 's' : ''}</b><small>La résiliation doit être parvenue à l’assureur — comptez le courrier.</small>`}
      </div>` : ''}
      <div class="rsl-liste">${l.map(r => rslLigneHtml(o.id, r)).join('')}</div>`
    : `<div class="rsl-vide">
        <p>Aucun contrat à résilier n’est enregistré.</p>
        <small>Sur un transfert, c’est ici qu’on suit ce qu’il faut quitter — et avant quelle date.
          Le délai se compte sur la <b>réception</b> par l’assureur, jamais sur l’envoi.</small>
      </div>`}`;
}

function rslLigneHtml(oppId, r) {
  const e = rslEtat(r);
  return `<article class="rsl-ligne ton-${e.ton}">
    <span class="rsl-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(r.compagnie, 26) : ''}</span>
    <div class="rsl-corps">
      <b>${rslEsc(r.compagnie || 'Assureur à préciser')}</b>
      <small>${rslEsc(r.produit || '')}${r.numero_police ? ` · police ${rslEsc(r.numero_police)}` : ''}</small>
      <small class="rsl-dates">
        ${r.echeance ? `Échéance ${fmtDate(r.echeance)}` : 'Échéance inconnue'}
        ${r.limite ? ` · résilier avant le ${fmtDate(r.limite)}` : ''}
        ${r.envoyee_le ? ` · envoyée le ${fmtDate(r.envoyee_le)}` : ''}
        ${r.confirmee_le ? ` · confirmée le ${fmtDate(r.confirmee_le)}` : ''}
      </small>
    </div>
    <span class="rsl-etat ton-${e.ton}">${rslEsc(e.nom)}</span>
    <div class="rsl-actions">
      ${!r.envoyee_le ? `<button type="button" class="rsl-act" onclick="rslCopierLettre('${oppId}','${r.id}')" title="Copier le texte de la lettre">📋</button>` : ''}
      ${!r.envoyee_le ? `<button type="button" class="rsl-act rsl-act-ok" onclick="rslMarquer('${oppId}','${r.id}','envoyee_le')">Envoyée</button>`
        : !r.confirmee_le ? `<button type="button" class="rsl-act rsl-act-ok" onclick="rslMarquer('${oppId}','${r.id}','confirmee_le')">Confirmée</button>` : ''}
      <button type="button" class="rsl-act" onclick="rslOuvrirAjout('${oppId}','${r.id}')">✎</button>
      <button type="button" class="rsl-act" onclick="rslSupprimer('${oppId}','${r.id}')" title="Retirer de la liste">✕</button>
    </div>
  </article>`;
}

function rslPeindre(oppId) {
  const z = document.getElementById('rsl-bloc-' + oppId);
  if (!z) return;
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  if (!o) return;
  z.innerHTML = rslCorpsHtml(o, rslListe(oppId));
}

// ── Ajouter ou modifier ─────────────────────────────────────────────────────────────────────────
function rslOuvrirAjout(oppId, resilId) {
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  if (!o || typeof creerModale !== 'function') return;
  const r = resilId ? (rslListe(oppId) || []).find(x => x.id === resilId) : null;

  // Les contrats du client déjà au portefeuille, hors ceux déjà dans la liste : c'est presque
  // toujours là que se trouve ce qu'il faut résilier.
  const dejaLa = new Set((rslListe(oppId) || []).map(x => x.contrat_id).filter(Boolean));
  const candidats = (typeof allContrats !== 'undefined' ? allContrats : [])
    .filter(ct => ct.client_id === o.client_id
      && !['résilié', 'annulé', 'mandat_resilie'].includes(ct.statut)
      && (!dejaLa.has(ct.id) || (r && r.contrat_id === ct.id)));

  const v = x => (x == null ? '' : x);
  creerModale('modal-rsl', `
    <div class="rsl-modale">
      <h3>${r ? 'Modifier la résiliation' : 'Contrat à résilier'}</h3>
      <p class="rsl-sous">Chez quel assureur, et avant quelle date la lettre doit-elle être
        <b>reçue</b>.</p>

      ${!r && candidats.length ? `
        <label class="rsl-label" for="rsl-contrat">Reprendre un contrat du portefeuille</label>
        <select class="form-select" id="rsl-contrat" onchange="rslDepuisContrat(this.value)">
          <option value="">— saisir à la main —</option>
          ${candidats.map(ct => `<option value="${ct.id}">${rslEsc(ct.compagnie || '?')} · ${rslEsc(ct.produit || 'contrat')}${ct.numero_police ? ' · ' + rslEsc(ct.numero_police) : ''}</option>`).join('')}
        </select>
        <p class="rsl-aide">Le lien avec le contrat est conservé : quand la résiliation est
          confirmée, on saura lequel fermer au portefeuille.</p>` : ''}

      <input type="hidden" id="rsl-contrat-id" value="${v(r && r.contrat_id)}"/>
      <div class="rsl-grille">
        <div><label for="rsl-cie">Compagnie</label>
          <input class="form-input" id="rsl-cie" value="${rslEsc(v(r && r.compagnie))}" placeholder="Ex. Helvetia"/></div>
        <div><label for="rsl-produit">Couverture</label>
          <input class="form-input" id="rsl-produit" value="${rslEsc(v(r && r.produit))}" placeholder="Ex. RC + inventaire du ménage"/></div>
        <div><label for="rsl-police">N° de police</label>
          <input class="form-input" id="rsl-police" value="${rslEsc(v(r && r.numero_police))}"/></div>
        <div><label for="rsl-echeance">Échéance du contrat</label>
          <input class="form-input" id="rsl-echeance" type="date" value="${v(r && r.echeance)}" onchange="rslProposerLimite()"/></div>
        <div><label for="rsl-limite">Résiliation reçue avant le</label>
          <input class="form-input" id="rsl-limite" type="date" value="${v(r && r.limite)}"/>
          <small class="rsl-aide">Proposé à trois mois de l’échéance — le délai ordinaire en
            choses et RC. Les conditions générales du contrat font foi : corrigez si besoin.</small></div>
        ${r ? `
        <div><label for="rsl-envoi">Envoyée le</label>
          <input class="form-input" id="rsl-envoi" type="date" value="${v(r.envoyee_le)}"/></div>
        <div><label for="rsl-conf">Confirmée le</label>
          <input class="form-input" id="rsl-conf" type="date" value="${v(r.confirmee_le)}"/></div>` : ''}
      </div>

      <div class="rsl-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-rsl').remove()">Annuler</button>
        <button type="button" class="btn-save" onclick="rslEnregistrer('${oppId}'${r ? `,'${r.id}'` : ''})">✓ Enregistrer</button>
      </div>
    </div>`, { opacite: .7, padding: '16px' });
}

// Reprendre un contrat du portefeuille : on remplit, on ne devine pas. Les champs restent
// modifiables — un numéro de police change parfois entre notre base et le décompte.
function rslDepuisContrat(contratId) {
  const ct = (typeof allContrats !== 'undefined' ? allContrats : []).find(x => x.id === contratId);
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val == null ? '' : val; };
  set('rsl-contrat-id', contratId || '');
  if (!ct) return;
  set('rsl-cie', ct.compagnie || '');
  set('rsl-produit', ct.produit || '');
  set('rsl-police', ct.numero_police || '');
  set('rsl-echeance', ct.date_echeance || '');
  rslProposerLimite();
}

function rslProposerLimite() {
  const ech = document.getElementById('rsl-echeance')?.value;
  const lim = document.getElementById('rsl-limite');
  // On ne remplace jamais une date déjà posée : elle a pu être corrigée d'après les CG.
  if (lim && !lim.value && ech) lim.value = rslLimiteProposee(ech);
}

async function rslEnregistrer(oppId, resilId) {
  const txt = id => (document.getElementById(id)?.value || '').trim() || null;
  const nb = id => {
    const v = (document.getElementById(id)?.value || '').replace(/['’\s]/g, '').replace(',', '.');
    if (v === '') return null;
    const n = Number(v); return isFinite(n) ? n : null;
  };
  const ligne = {
    opportunite_id: oppId,
    contrat_id: txt('rsl-contrat-id'),
    compagnie: txt('rsl-cie'),
    produit: txt('rsl-produit'),
    numero_police: txt('rsl-police'),
    // Plus de prime dans la résiliation (22.09.2026, Jonathan : « on s'en fout ») — la colonne
    // reste en base, elle n'est simplement plus demandée ni affichée.
    echeance: txt('rsl-echeance'),
    limite: txt('rsl-limite'),
  };
  if (resilId) {
    ligne.envoyee_le = txt('rsl-envoi');
    ligne.confirmee_le = txt('rsl-conf');
  }
  if (!ligne.compagnie && !ligne.numero_police) {
    showError('Indiquez au moins la compagnie ou le numéro de police.');
    return;
  }

  const r = resilId
    ? await dbPatch('opportunites_resiliations', resilId, ligne)
    : await dbPost('opportunites_resiliations', ligne);
  if (r && r.error) { showError('Enregistrement impossible : ' + errMsg(r)); return; }

  document.getElementById('modal-rsl')?.remove();
  await rslRecharger(oppId);
  showError('✓ Enregistré');
}

async function rslRecharger(oppId) {
  window._rsl.parOpp[oppId] = null;
  window._rsl.chargement[oppId] = false;
  await rslCharger(oppId);
}

async function rslMarquer(oppId, resilId, champ) {
  const auj = new Date().toISOString().slice(0, 10);
  const r = await dbPatch('opportunites_resiliations', resilId, { [champ]: auj });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }

  const l = rslListe(oppId) || [];
  const ligne = l.find(x => x.id === resilId);
  if (ligne) ligne[champ] = auj;

  if (typeof ajouterLigneHistoriqueOpportunite === 'function' && ligne) {
    const quoi = champ === 'envoyee_le' ? 'Résiliation envoyée à' : 'Résiliation confirmée par';
    await ajouterLigneHistoriqueOpportunite(oppId, `✉️ ${quoi} ${ligne.compagnie || 'l’assureur'}${ligne.numero_police ? ` (police ${ligne.numero_police})` : ''} — ${fmtDate(auj)}`);
  }
  rslPeindre(oppId);
  showError(champ === 'envoyee_le' ? '✓ Envoi noté — reste la confirmation de l’assureur' : '✓ Confirmée');
}

async function rslSupprimer(oppId, resilId) {
  const l = rslListe(oppId) || [];
  const r = l.find(x => x.id === resilId);
  if (!confirm(`Retirer « ${(r && r.compagnie) || 'cette ligne'} » de la liste des résiliations ?\n\nLe contrat au portefeuille n’est pas touché.`)) return;
  const res = await dbDelete('opportunites_resiliations', resilId);
  if (res && res.error) { showError('Échec : ' + errMsg(res)); return; }
  window._rsl.parOpp[oppId] = l.filter(x => x.id !== resilId);
  rslPeindre(oppId);
}

// ── La lettre ───────────────────────────────────────────────────────────────────────────────────
// Copiée, jamais envoyée : une résiliation part sous la signature du client, et une lettre partie
// par erreur ne se rattrape pas.
function rslCopierLettre(oppId, resilId) {
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  const r = (rslListe(oppId) || []).find(x => x.id === resilId);
  if (!o || !r) return;
  const cl = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === o.client_id);
  const nom = cl ? ((typeof estEntreprise === 'function' && estEntreprise(cl)) ? cl.nom : `${cl.prenom || ''} ${cl.nom || ''}`.trim()) : (o.prospect_nom || '');

  const lettre = [
    nom,
    cl && cl.adresse ? cl.adresse : '',
    cl && (cl.npa || cl.ville) ? `${cl.npa || ''} ${cl.ville || ''}`.trim() : '',
    '',
    r.compagnie || '[Compagnie]',
    '',
    `${cl && cl.ville ? cl.ville + ', ' : ''}le ${fmtDate(new Date().toISOString().slice(0, 10))}`,
    '',
    `Objet : résiliation de la police n° ${r.numero_police || '[numéro]'}${r.produit ? ` — ${r.produit}` : ''}`,
    '',
    'Madame, Monsieur,',
    '',
    `Par la présente, je résilie la police citée en objet pour son échéance du ${r.echeance ? fmtDate(r.echeance) : '[échéance]'}, dans le respect du délai contractuel.`,
    '',
    'Je vous remercie de me confirmer par écrit la prise en compte de cette résiliation ainsi que la date effective de fin de couverture.',
    '',
    'Veuillez agréer, Madame, Monsieur, mes salutations distinguées.',
    '',
    '',
    nom,
  ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');

  const fini = ok => showError(ok
    ? '✓ Lettre copiée — à relire et à faire signer par le client'
    : 'Copie impossible — sélectionnez le texte à la main.');
  navigator.clipboard.writeText(lettre).then(() => fini(true)).catch(() => {
    try {
      const z = document.createElement('textarea');
      z.value = lettre; z.style.cssText = 'position:fixed;top:-9999px';
      document.body.appendChild(z); z.select();
      fini(document.execCommand('copy'));
      z.remove();
    } catch (e) { fini(false); }
  });
}

// ── Branchement ─────────────────────────────────────────────────────────────────────────────────
(function rslBrancher() {
  // Le bloc se pose sous « Offres des compagnies », dans la colonne de droite : c'est la suite
  // logique — on compare, on choisit, on quitte l'ancien.
  if (typeof viewFicheOpportunite === 'function') {
    const origine = viewFicheOpportunite;
    window.viewFicheOpportunite = function (o) {
      const html = origine.apply(this, arguments);
      if (!o || !o.id) return html;
      return html.replace(
        /(<div id="opx-offres">[\s\S]*?<\/div>\s*<\/section>)/,
        '$1' + rslBlocHtml(o),
      );
    };
  }

  // Le manque « résiliation » du parcours (js/90) lit maintenant la liste, plus la colonne unique.
  if (typeof pafManques === 'function') {
    const origine = pafManques;
    window.pafManques = function (o) {
      const m = origine.apply(this, arguments);
      const l = rslListe(o.id);
      if (l === null) { m.resiliation = null; return m; }   // pas encore chargé : on ne réclame rien
      const ouvertes = l.filter(r => !r.envoyee_le);
      m.resiliation = ouvertes.length
        ? `${ouvertes.length} résiliation${ouvertes.length > 1 ? 's' : ''} à envoyer`
        : null;
      return m;
    };
  }
  if (typeof pafBoutonPour === 'function') {
    const origine = pafBoutonPour;
    window.pafBoutonPour = function (o, cle) {
      if (cle === 'resiliation') {
        return `<button type="button" class="paf-act" onclick="rslOuvrirAjout('${o.id}')">Gérer les résiliations</button>`;
      }
      return origine.apply(this, arguments);
    };
  }
})();
