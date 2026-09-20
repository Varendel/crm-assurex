// ═══ RAPPROCHEMENT BANQUE ↔ COMMISSIONS (20.09.2026) ═══════════════════════════════════════════
// Le chaînon qui manquait. Le CRM sait ce qu'il ATTEND ; la banque sait ce qui est ARRIVÉ, et
// quand. Rien ne reliait les deux — d'où 104 commissions déclarées encaissées sans date, et un
// tableau de bord qui dessinait un pic de CHF 62 016 en septembre qui n'a jamais existé.
//
// Trois règles que je me suis données ici :
//
// 1. LA BANQUE A TOUJOURS RAISON SUR LA DATE ET LE MONTANT. Le CRM a raison sur le client et le
//    contrat. Le rapprochement consiste à donner au CRM la date de la banque, jamais l'inverse.
//
// 2. ON PROPOSE, ON N'IMPOSE PAS. Un versement de compagnie solde presque toujours plusieurs
//    commissions d'un coup : le calcul cherche la combinaison qui tombe juste, l'affiche, et
//    attend un clic. Un rapprochement automatique silencieux qui se trompe est pire que pas de
//    rapprochement du tout — on ne sait plus quels chiffres sont vrais.
//
// 3. TOUT EST RÉVERSIBLE. Chaque lien est une ligne qu'on peut défaire, et défaire un lien rend
//    à la commission son état « date non rapprochée ».
//
// Sur la recherche de combinaisons : on ne teste pas tous les sous-ensembles (2^n). On cherche
// d'abord une commission seule, puis une paire, puis un triplet — au-delà, la proposition n'est
// plus vérifiable d'un coup d'œil, et un humain ne la validera pas de bonne foi.

const RAP_TOLERANCE = 0.05;        // écart accepté pour dire « c'est le même montant »
const RAP_MAX_COMBINAISON = 3;     // au-delà, on ne propose pas : ce serait invérifiable

window._rap = window._rap || { credits: [], commissions: [], liens: [], chargement: false, compagnie: 'toutes', choix: {} };

function rapEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rapCHF(n) { return Number(Math.round(n)).toLocaleString('fr-CH'); }

async function rapCharger() {
  try {
    const [credits, liens] = await Promise.all([
      dbGet('releves_lignes', 'categorie=eq.commission&select=*&order=date_operation.asc'),
      dbGet('rapprochements', 'select=*'),
    ]);
    window._rap.credits = credits || [];
    window._rap.liens = liens || [];
  } catch (e) { window._rap.credits = []; window._rap.liens = []; }
  window._rap.commissions = (typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : [])
    .filter(ca => ['reçue', 'versé_oz'].includes(ca.statut));
}

function rapMontant(ca) { return Math.round(Number(ca.montant_final ?? ca.montant_estime ?? 0) * 100) / 100; }
function rapAffecte(creditId) {
  return window._rap.liens.filter(l => l.releve_ligne_id === creditId).reduce((s, l) => s + Number(l.montant), 0);
}
function rapReste(c) { return Math.round((Number(c.montant) - rapAffecte(c.id)) * 100) / 100; }
function rapDejaLiee(commissionId) { return window._rap.liens.some(l => l.commission_id === commissionId); }

// Les commissions encore à dater, pour une compagnie donnée.
function rapCandidates(compagnie) {
  return window._rap.commissions.filter(ca =>
    ca.compagnie === compagnie && ca.date_reception_estimee && !rapDejaLiee(ca.id) && rapMontant(ca) > 0);
}

// ── La recherche de combinaison ─────────────────────────────────────────────────────────────────
// Une seule commission, puis une paire, puis un triplet. On s'arrête à la première combinaison
// exacte trouvée : inutile d'en proposer trois quand une tombe juste.
function rapProposer(credit) {
  const reste = rapReste(credit);
  if (reste <= RAP_TOLERANCE) return null;
  const cand = rapCandidates(credit.compagnie).sort((a, b) => rapMontant(b) - rapMontant(a));
  if (!cand.length) return null;

  for (const c of cand) {
    if (Math.abs(rapMontant(c) - reste) <= RAP_TOLERANCE) return { lignes: [c], exact: true };
  }
  if (RAP_MAX_COMBINAISON >= 2) {
    for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
      if (Math.abs(rapMontant(cand[i]) + rapMontant(cand[j]) - reste) <= RAP_TOLERANCE)
        return { lignes: [cand[i], cand[j]], exact: true };
    }
  }
  if (RAP_MAX_COMBINAISON >= 3 && cand.length <= 60) {
    for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) for (let k = j + 1; k < cand.length; k++) {
      if (Math.abs(rapMontant(cand[i]) + rapMontant(cand[j]) + rapMontant(cand[k]) - reste) <= RAP_TOLERANCE)
        return { lignes: [cand[i], cand[j], cand[k]], exact: true };
    }
  }
  // Rien d'exact : on propose la plus grosse commission qui tient dans le reste, à titre d'amorce.
  const tient = cand.find(c => rapMontant(c) <= reste + RAP_TOLERANCE);
  return tient ? { lignes: [tient], exact: false } : null;
}

// ── La page ─────────────────────────────────────────────────────────────────────────────────────
function viewRapprochement() {
  if (!window._rap.credits.length && !window._rap.chargement) {
    window._rap.chargement = true;
    rapCharger().then(() => { window._rap.chargement = false; if (currentView === 'rapprochement') rapRendre(); });
  }
  return `<div id="rap-page">${rapContenu()}</div>`;
}

function rapRendre() {
  const el = document.getElementById('rap-page');
  if (el) el.innerHTML = rapContenu();
}

function rapContenu() {
  const C = window._rap.credits;
  const f = window._rap.compagnie;
  const compagnies = [...new Set(C.map(c => c.compagnie).filter(Boolean))].sort();
  const visibles = (f === 'toutes' ? C : C.filter(c => c.compagnie === f));
  const ouverts = visibles.filter(c => rapReste(c) > RAP_TOLERANCE);
  const soldes = visibles.filter(c => rapReste(c) <= RAP_TOLERANCE);
  const aDater = window._rap.commissions.filter(ca => ca.date_reception_estimee && !rapDejaLiee(ca.id));
  const montantADater = aDater.reduce((s, ca) => s + rapMontant(ca), 0);
  const kpi = (l, v, s, ton) => `<div class="dbx-kpi ${ton || ''}"><span class="dbx-kpi-label">${l}</span><span class="dbx-kpi-valeur">${v}</span><span class="dbx-kpi-sous">${s}</span></div>`;

  if (!C.length) {
    return `<div class="page-header"><h2>🔗 Rapprochement bancaire</h2></div>
      ${typeof ixVide === 'function' ? ixVide({
        titre: 'Aucun relevé importé',
        texte: 'Importe les relevés PDF de la banque pour pouvoir donner aux commissions leur vraie date d’encaissement.',
        pose: 'reflexion' }) : ''}`;
  }

  return `
  <div class="page-header">
    <h2>🔗 Rapprochement bancaire</h2>
    <p class="page-sub">La banque a raison sur la date et le montant, le CRM sur le client et le
      contrat. Rapprocher, c’est donner au CRM la date de la banque.</p>
  </div>

  <div class="dbx-kpis">
    ${kpi('Versements à solder', ouverts.length, `sur ${visibles.length} crédits`, ouverts.length ? 'cf-alerte' : '')}
    ${kpi('Déjà soldés', soldes.length, soldes.length ? 'rapprochés au centime' : 'aucun pour l’instant')}
    ${kpi('Commissions sans date', aDater.length, `CHF ${rapCHF(montantADater)} déclarés encaissés`)}
    ${kpi('Liens créés', window._rap.liens.length, 'tous réversibles')}
  </div>

  <div class="rap-outils">
    <select class="form-input" onchange="window._rap.compagnie=this.value; rapRendre()">
      <option value="toutes">Toutes les compagnies (${C.length})</option>
      ${compagnies.map(x => `<option value="${rapEsc(x)}" ${f === x ? 'selected' : ''}>${rapEsc(x)} (${C.filter(c => c.compagnie === x).length})</option>`).join('')}
    </select>
    <button type="button" class="btn-secondary" onclick="rapToutProposer()">✨ Proposer partout</button>
  </div>

  <div class="rap-liste">
    ${ouverts.map(rapCreditHtml).join('') || (typeof ixVide === 'function'
      ? ixVide({ titre: 'Tous les versements sont rapprochés', texte: 'Chaque crédit de la banque est affecté à ses commissions.', pose: 'pouce' }) : '')}
  </div>

  ${soldes.length ? `<details class="rap-soldes"><summary>${soldes.length} versement(s) déjà soldé(s)</summary>
    <div class="rap-liste">${soldes.map(rapCreditHtml).join('')}</div></details>` : ''}`;
}

function rapCreditHtml(c) {
  const reste = rapReste(c);
  const solde = reste <= RAP_TOLERANCE;
  const liens = window._rap.liens.filter(l => l.releve_ligne_id === c.id);
  const prop = solde ? null : (window._rap.choix[c.id] || rapProposer(c));

  return `<article class="rap-credit ${solde ? 'solde' : ''}">
    <header class="rap-credit-tete">
      <span class="rap-date">${fmtDate(c.date_operation)}</span>
      <b class="rap-cie">${rapEsc(c.compagnie || '—')}</b>
      <span class="rap-montant">CHF ${rapCHF(c.montant)}</span>
      ${solde ? '<span class="rap-etiq soldee">Soldé</span>'
        : `<span class="rap-etiq">reste CHF ${rapCHF(reste)}</span>`}
    </header>
    <div class="rap-libelle">${rapEsc(c.libelle || '')}</div>

    ${liens.length ? `<ul class="rap-liens">${liens.map(l => {
      const ca = window._rap.commissions.find(x => x.id === l.commission_id);
      return `<li><span>${ca ? rapEsc(ca.client_nom || '—') + ' · ' + rapEsc(ca.produit || '') : 'commission supprimée'}</span>
        <b>CHF ${rapCHF(l.montant)}</b>
        <button type="button" class="rap-defaire" onclick="rapDefaire('${l.id}')" title="Défaire ce lien">✕</button></li>`;
    }).join('')}</ul>` : ''}

    ${!solde && prop ? `<div class="rap-proposition ${prop.exact ? 'exacte' : 'approchante'}">
      <div class="rap-prop-tete">${prop.exact
        ? `✓ ${prop.lignes.length} commission(s) tombent exactement sur ce montant`
        : '~ aucune combinaison exacte — proposition partielle'}</div>
      <ul>${prop.lignes.map(ca => `<li>${rapEsc(ca.client_nom || '—')} · ${rapEsc(ca.produit || '')}
        <b>CHF ${rapCHF(rapMontant(ca))}</b></li>`).join('')}</ul>
      <div class="rap-prop-actions">
        <button type="button" class="btn-save" onclick="rapAccepter('${c.id}')">Rapprocher</button>
        <button type="button" class="btn-secondary" onclick="rapChoisirAutre('${c.id}')">Choisir à la main…</button>
      </div>
    </div>`
    : (!solde ? `<div class="rap-rien">Aucune commission « ${rapEsc(c.compagnie || '')} » sans date ne correspond.
        <button type="button" class="btn-secondary" onclick="rapChoisirAutre('${c.id}')">Choisir à la main…</button></div>` : '')}
  </article>`;
}

// ── Accepter une proposition ────────────────────────────────────────────────────────────────────
async function rapAccepter(creditId) {
  const c = window._rap.credits.find(x => x.id === creditId);
  const prop = window._rap.choix[creditId] || rapProposer(c);
  if (!c || !prop) return;
  const moi = (typeof crxMoi === 'function' ? crxMoi().nom : null);
  let reste = rapReste(c);
  let faits = 0;

  for (const ca of prop.lignes) {
    const montant = Math.min(rapMontant(ca), Math.round(reste * 100) / 100);
    if (montant <= 0) break;
    const lien = await dbPost('rapprochements', {
      releve_ligne_id: c.id, commission_id: ca.id, montant,
      methode: prop.exact ? 'auto' : 'manuel', rapproche_par: moi,
    });
    if (lien && lien.error) { showError('Lien non créé : ' + errMsg(lien)); return; }

    // La banque donne la date. Et si le versement solde exactement la commission, elle donne
    // aussi le montant constaté — l'estimation cesse d'en être une.
    const maj = {
      date_reception: c.date_operation,
      date_reception_estimee: false,
      detail_calcul: (ca.detail_calcul ? ca.detail_calcul + ' | ' : '')
        + `Rapproché du versement ${c.compagnie} du ${c.date_operation} (CHF ${c.montant}).`,
    };
    if (Math.abs(rapMontant(ca) - montant) <= RAP_TOLERANCE) maj.montant_final = montant;
    const r = await dbPatch('commissions_attente', ca.id, maj);
    if (r && r.error) { showError('Commission non mise à jour : ' + errMsg(r)); return; }
    Object.assign(ca, maj);
    window._rap.liens.push(Array.isArray(lien) ? lien[0] : lien);
    reste -= montant; faits++;
  }

  delete window._rap.choix[creditId];
  rapRendre();
  showError(`✓ ${faits} commission(s) datée(s) au ${fmtDate(c.date_operation)}.`);
}

async function rapDefaire(lienId) {
  const l = window._rap.liens.find(x => x.id === lienId);
  if (!l) return;
  if (!confirm('Défaire ce rapprochement ? La commission repasse en « date non rapprochée ».')) return;
  const r = await dbDelete('rapprochements', lienId);
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  window._rap.liens = window._rap.liens.filter(x => x.id !== lienId);
  // La commission ne retrouve une date estimée que si plus aucun lien ne la porte.
  if (!rapDejaLiee(l.commission_id)) {
    const ca = window._rap.commissions.find(x => x.id === l.commission_id);
    if (ca) {
      await dbPatch('commissions_attente', ca.id, { date_reception_estimee: true });
      ca.date_reception_estimee = true;
    }
  }
  rapRendre();
}

// ── Choisir à la main ───────────────────────────────────────────────────────────────────────────
function rapChoisirAutre(creditId) {
  const c = window._rap.credits.find(x => x.id === creditId);
  if (!c) return;
  const cand = rapCandidates(c.compagnie);
  creerModale('modal-rap', `
    <div class="opx-modale rap-modale" role="dialog" aria-modal="true" aria-labelledby="rap-titre">
      <h3 id="rap-titre">Versement ${rapEsc(c.compagnie)} du ${fmtDate(c.date_operation)}</h3>
      <div class="opx-modale-sous">CHF ${rapCHF(c.montant)} · reste CHF <b id="rap-reste">${rapCHF(rapReste(c))}</b> à affecter</div>
      ${cand.length ? `<div class="rap-choix">${cand.map(ca => `
        <label class="rap-choix-ligne">
          <input type="checkbox" value="${ca.id}" data-montant="${rapMontant(ca)}" onchange="rapRecalculerChoix('${c.id}')"/>
          <span>${rapEsc(ca.client_nom || '—')}<small>${rapEsc(ca.produit || '')}${ca.numero_police ? ' · ' + rapEsc(ca.numero_police) : ''}</small></span>
          <b>CHF ${rapCHF(rapMontant(ca))}</b>
        </label>`).join('')}</div>`
        : '<p class="rap-rien">Aucune commission de cette compagnie n’attend une date.</p>'}
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-rap').remove()">Fermer</button>
        <button type="button" class="btn-save" onclick="rapValiderChoix('${c.id}')">Rapprocher la sélection</button>
      </div>
    </div>`, { padding: '16px' });
}

function rapRecalculerChoix(creditId) {
  const c = window._rap.credits.find(x => x.id === creditId);
  const coches = [...document.querySelectorAll('#modal-rap input:checked')];
  const somme = coches.reduce((s, el) => s + Number(el.dataset.montant), 0);
  const reste = rapReste(c) - somme;
  const el = document.getElementById('rap-reste');
  if (el) {
    el.textContent = rapCHF(reste);
    el.parentElement.classList.toggle('rap-juste', Math.abs(reste) <= RAP_TOLERANCE);
    el.parentElement.classList.toggle('rap-trop', reste < -RAP_TOLERANCE);
  }
}

function rapValiderChoix(creditId) {
  const ids = [...document.querySelectorAll('#modal-rap input:checked')].map(el => el.value);
  if (!ids.length) { showError('Coche au moins une commission.'); return; }
  window._rap.choix[creditId] = {
    lignes: ids.map(id => window._rap.commissions.find(x => x.id === id)).filter(Boolean),
    exact: false,
  };
  document.getElementById('modal-rap')?.remove();
  rapAccepter(creditId);
}

// ── Proposer partout ────────────────────────────────────────────────────────────────────────────
// Ne rapproche RIEN : ne fait que compter ce qui tomberait juste, pour dire s'il vaut la peine de
// s'y mettre. C'est à l'humain de valider versement par versement.
function rapToutProposer() {
  const ouverts = window._rap.credits.filter(c => rapReste(c) > RAP_TOLERANCE);
  let exactes = 0, partielles = 0, rien = 0;
  for (const c of ouverts) {
    const p = rapProposer(c);
    if (!p) rien++; else if (p.exact) exactes++; else partielles++;
  }
  showError(`${exactes} versement(s) trouvent une combinaison exacte, ${partielles} une partielle, ${rien} rien du tout.`, 'info');
}
