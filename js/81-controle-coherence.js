// ═══ CONTRÔLE CROISÉ CONTRATS × COMMISSIONS (20.09.2026) ═══════════════════════════════════════
// Demande de Jonathan : « que tous les contrats saisis aient bien été soit validé payé, soit
// attendu, soit annulé ». Autrement dit : aucun contrat ne doit rester dans un état indéterminé.
//
// POURQUOI UN NOUVEL ÉCRAN ALORS QU'IL EXISTE DÉJÀ « CONTRATS SANS COMMISSION ».
// L'écran existant (js/04) filtre sur `prime_annuelle > 0` et exclut les résiliés. Or au moment
// d'écrire ces lignes, 32 des 42 contrats sans commission ont justement une prime à zéro, et le
// plus gros trou est un contrat résilié de CHF 120 444 de prime. L'ancien écran affichait donc
// « tout est en ordre » sur les cas précisément qu'il fallait voir. Un contrôle qui cache ce qu'il
// ne sait pas traiter n'est pas un contrôle.
//
// Ici, RIEN n'est filtré. Chaque contrat de la base tombe dans exactement une case, et les cases
// « anomalie » disent ce qui manque plutôt que de laisser la ligne disparaître.

const CCX_ETATS = [
  { cle: 'encaisse_assurex', nom: 'Encaissé — Assurex', ton: 'ok',
    aide: 'Une commission au moins est reçue sur le compte Assurex.' },
  { cle: 'encaisse_oz', nom: 'Encaissé — OZ', ton: 'ok',
    aide: 'Versée sur le compte courant OZ : hors chiffre d’affaires Assurex, mais encaissée.' },
  { cle: 'attendu', nom: 'Attendu', ton: 'attente',
    aide: 'La commission est calculée, elle n’est pas encore arrivée.' },
  { cle: 'clos', nom: 'Clos sans suite', ton: 'neutre',
    aide: 'Contrat annulé ou résilié, ou commission extournée : plus rien à attendre.' },
  { cle: 'hors_commission', nom: 'Hors commission', ton: 'neutre',
    aide: 'Marqué non commissionnable — c’est un choix, pas un oubli.' },
  { cle: 'a_creer', nom: '⚠ Commission à créer', ton: 'alerte',
    aide: 'Contrat en vigueur, prime connue, aucune commission : c’est de l’argent non suivi.' },
  { cle: 'prime_absente', nom: '⚠ Prime manquante', ton: 'alerte',
    aide: 'Sans prime annuelle, aucune commission ne peut être calculée. La saisie est à compléter.' },
  { cle: 'contradiction', nom: '⚠ Drapeau contradictoire', ton: 'alerte',
    aide: 'Contrat marqué non commissionnable, mais il porte une commission.' },
  { cle: 'montant_nul', nom: '⚠ Commission à zéro', ton: 'alerte',
    aide: 'La ligne existe mais vaut CHF 0 : le calcul n’a pas abouti.' },
];

const CCX_CLOS = ['annulé', 'résilié', 'mandat_resilie'];

window._ccx = window._ccx || { etat: '', compagnie: '', recherche: '' };

function ccxEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function ccxNomClient(id) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === id);
  if (!c) return '—';
  return (typeof estEntreprise === 'function' && estEntreprise(c))
    ? (c.nom || '—')
    : [c.prenom, c.nom].filter(Boolean).join(' ') || '—';
}

// ── Le classement ───────────────────────────────────────────────────────────────────────────────
// L'ordre des tests est l'ordre de gravité : on veut qu'un contrat qui a bel et bien encaissé soit
// classé « encaissé » même s'il traîne par ailleurs une ligne annulée. Les anomalies ne sont
// examinées qu'une fois écartée toute possibilité que la situation soit normale.
function ccxClasser(ct, commissions) {
  const somme = c => Number(c.montant_final ?? c.montant_estime ?? 0);
  const a = s => commissions.some(c => c.statut === s);

  if (commissions.length) {
    // Le drapeau passe AVANT l'encaissement, et c'est voulu. « Non commissionnable » exclut le
    // contrat de tous les calculs à venir ; s'il porte malgré tout une commission bien réelle, les
    // deux informations se contredisent et quelqu'un doit trancher. Le classer « encaissé »
    // reviendrait à ranger le problème au lieu de le montrer.
    if (ct.commissionne === false) return { etat: 'contradiction', montant: commissions.reduce((s, c) => s + somme(c), 0) };
    if (a('reçue')) return { etat: 'encaisse_assurex', montant: commissions.filter(c => c.statut === 'reçue').reduce((s, c) => s + somme(c), 0) };
    if (a('versé_oz')) return { etat: 'encaisse_oz', montant: commissions.filter(c => c.statut === 'versé_oz').reduce((s, c) => s + somme(c), 0) };
    if (a('en_attente') || a('en_attente_naissance')) {
      const m = commissions.filter(c => String(c.statut).startsWith('en_attente')).reduce((s, c) => s + somme(c), 0);
      // Une commission attendue qui vaut zéro n'est pas une attente : c'est un calcul qui a échoué.
      if (!m) return { etat: 'montant_nul', montant: 0 };
      return { etat: 'attendu', montant: m };
    }
    return { etat: 'clos', montant: 0 };   // annulée / extournée
  }

  // Aucune commission du tout.
  if (ct.commissionne === false) return { etat: 'hors_commission', montant: 0 };
  if (CCX_CLOS.includes(ct.statut)) return { etat: 'clos', montant: 0 };
  if (!Number(ct.prime_annuelle || 0)) return { etat: 'prime_absente', montant: 0 };
  return { etat: 'a_creer', montant: 0 };
}

function ccxLignes() {
  const CT = typeof allContrats !== 'undefined' ? allContrats : [];
  const CA = typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : [];
  const parContrat = new Map();
  for (const c of CA) {
    if (!c.contrat_id) continue;
    if (!parContrat.has(c.contrat_id)) parContrat.set(c.contrat_id, []);
    parContrat.get(c.contrat_id).push(c);
  }
  return CT.map(ct => {
    const comms = parContrat.get(ct.id) || [];
    const { etat, montant } = ccxClasser(ct, comms);
    return {
      id: ct.id, client: ccxNomClient(ct.client_id), client_id: ct.client_id,
      compagnie: ct.compagnie || '—', produit: ct.produit || '—',
      police: ct.numero_police || '', statut: ct.statut,
      prime: Number(ct.prime_annuelle || 0), etat, montant, nbComm: comms.length,
    };
  });
}

// ── L'écran ─────────────────────────────────────────────────────────────────────────────────────
function viewControleCoherence() {
  setTimeout(() => ccxPeindre(), 0);
  return `
    <section class="fcx-hero ccx-hero">
      <div class="fcx-hero-deco" aria-hidden="true"></div>
      <div>
        <span class="cf-surtitre">Contrôle</span>
        <h1>Contrats × commissions</h1>
        <p>Chaque contrat saisi doit être encaissé, attendu, ou clos. Cet écran ne filtre rien :
          ce qui n’entre dans aucune de ces cases apparaît comme une anomalie, avec son motif.</p>
      </div>
      <div class="cf-hero-actions">
        <button type="button" class="fcx-btn-blanc" onclick="ccxExporter()">⬇️ Exporter (Excel)</button>
      </div>
    </section>
    <div id="ccx-corps"></div>`;
}

function ccxPeindre() {
  const zone = document.getElementById('ccx-corps');
  if (!zone) return;
  const toutes = ccxLignes();
  const F = window._ccx;

  const parEtat = {};
  for (const l of toutes) {
    if (!parEtat[l.etat]) parEtat[l.etat] = { n: 0, prime: 0, montant: 0 };
    parEtat[l.etat].n++; parEtat[l.etat].prime += l.prime; parEtat[l.etat].montant += l.montant;
  }

  const anomalies = ['a_creer', 'prime_absente', 'contradiction', 'montant_nul']
    .reduce((s, c) => s + ((parEtat[c] && parEtat[c].n) || 0), 0);
  const couverture = toutes.length ? Math.round((toutes.length - anomalies) / toutes.length * 100) : 100;

  const compagnies = [...new Set(toutes.map(l => l.compagnie))].sort();

  const visibles = toutes.filter(l =>
    (!F.etat || l.etat === F.etat) &&
    (!F.compagnie || l.compagnie === F.compagnie) &&
    (!F.recherche || (l.client + ' ' + l.produit + ' ' + l.police).toLowerCase().includes(F.recherche.toLowerCase()))
  ).sort((a, b) => {
    // Les anomalies d'abord, puis par prime décroissante : ce qui pèse le plus se traite en premier.
    const gr = x => ['a_creer', 'contradiction', 'montant_nul', 'prime_absente'].indexOf(x.etat);
    const ga = gr(a) < 0 ? 9 : gr(a), gb = gr(b) < 0 ? 9 : gr(b);
    return ga - gb || b.prime - a.prime;
  });

  const chf = n => typeof fmtCHF === 'function' ? fmtCHF(Math.round(n)) : Math.round(n);

  const cartes = CCX_ETATS.map(e => {
    const v = parEtat[e.cle] || { n: 0, prime: 0, montant: 0 };
    if (!v.n && e.ton !== 'alerte') return '';
    return `<button type="button" class="ccx-tuile ton-${e.ton} ${v.n ? '' : 'vide'} ${F.etat === e.cle ? 'actif' : ''}"
        onclick="ccxFiltrer('etat', '${F.etat === e.cle ? '' : e.cle}')" title="${ccxEsc(e.aide)}">
      <b class="ccx-tuile-n">${v.n}</b>
      <span class="ccx-tuile-nom">${e.nom}</span>
      <small>${v.montant ? 'CHF ' + chf(v.montant) : 'CHF ' + chf(v.prime) + ' de prime'}</small>
    </button>`;
  }).join('');

  zone.innerHTML = `
    <section class="dbx-carte ccx-section">
      <header class="dbx-carte-tete"><div><h2>Couverture</h2>
        <span class="dbx-carte-sous">${toutes.length} contrats · ${anomalies} en anomalie</span></div>
        <span class="ccx-jauge ${couverture >= 95 ? 'ok' : couverture >= 80 ? 'moyen' : 'faible'}">${couverture} %</span>
      </header>
      <div class="ccx-tuiles">${cartes}</div>
      ${anomalies ? `<p class="ccx-note">Les quatre dernières cases sont des trous de suivi, pas des
        catégories normales. Tant qu’elles ne sont pas vides, les graphiques d’encaissement
        sous-estiment la réalité.</p>` : `<p class="ccx-note ccx-note-ok">Aucune anomalie : chaque contrat
        est rattaché à une commission encaissée, attendue ou close.</p>`}
    </section>

    <section class="dbx-carte ccx-section">
      <header class="dbx-carte-tete">
        <div><h2>${F.etat ? (CCX_ETATS.find(e => e.cle === F.etat) || {}).nom : 'Tous les contrats'}</h2>
          <span class="dbx-carte-sous">${visibles.length} ligne${visibles.length > 1 ? 's' : ''}${F.etat ? ' · ' + ccxEsc((CCX_ETATS.find(e => e.cle === F.etat) || {}).aide || '') : ''}</span></div>
        <div class="ccx-filtres">
          <input class="form-input" type="search" placeholder="Client, produit, police…"
            value="${ccxEsc(F.recherche)}" oninput="ccxFiltrer('recherche', this.value)"/>
          <select class="form-select" onchange="ccxFiltrer('compagnie', this.value)">
            <option value="">Toutes compagnies</option>
            ${compagnies.map(c => `<option value="${ccxEsc(c)}" ${F.compagnie === c ? 'selected' : ''}>${ccxEsc(c)}</option>`).join('')}
          </select>
          ${F.etat || F.compagnie || F.recherche ? '<button type="button" class="btn-secondary" onclick="ccxReinitialiser()">Tout afficher</button>' : ''}
        </div>
      </header>
      ${visibles.length ? `<div class="ccx-table-enveloppe"><table class="ccx-table">
        <thead><tr><th>État</th><th>Client</th><th>Contrat</th><th class="d">Prime/an</th>
          <th class="d">Commission</th><th></th></tr></thead>
        <tbody>${visibles.map(l => ccxLigneHtml(l, chf)).join('')}</tbody>
      </table></div>` : '<div class="dbx-vide-petit">Aucune ligne dans cette sélection.</div>'}
    </section>`;
}

function ccxLigneHtml(l, chf) {
  const e = CCX_ETATS.find(x => x.cle === l.etat) || { nom: l.etat, ton: 'neutre' };
  const actions = [];
  if (l.etat === 'a_creer' && typeof creerCommissionManquante === 'function') {
    actions.push(`<button type="button" class="ccx-act ccx-act-vert" onclick="ccxCreer('${l.id}')">+ Créer la commission</button>`);
  }
  if (l.etat === 'prime_absente') {
    actions.push(`<button type="button" class="ccx-act" onclick="ccxOuvrirContrat('${l.client_id}')">Compléter la prime</button>`);
  }
  if (l.etat === 'contradiction') {
    actions.push(`<button type="button" class="ccx-act" onclick="ccxRendreCommissionnable('${l.id}')">Rendre commissionnable</button>`);
  }
  if (!actions.length) {
    actions.push(`<button type="button" class="ccx-act" onclick="ccxOuvrirContrat('${l.client_id}')">Ouvrir la fiche</button>`);
  }
  return `<tr class="ton-${e.ton}">
    <td><span class="ccx-pastille ton-${e.ton}">${e.nom}</span></td>
    <td><b>${ccxEsc(l.client)}</b><small>${ccxEsc(l.compagnie)}</small></td>
    <td>${ccxEsc(l.produit)}<small>${l.police ? 'police ' + ccxEsc(l.police) + ' · ' : ''}${ccxEsc(l.statut)}</small></td>
    <td class="d">${l.prime ? 'CHF ' + chf(l.prime) : '<span class="ccx-vide">—</span>'}</td>
    <td class="d">${l.montant ? 'CHF ' + chf(l.montant) : '<span class="ccx-vide">—</span>'}</td>
    <td class="ccx-actions">${actions.join('')}</td>
  </tr>`;
}

function ccxFiltrer(champ, valeur) { window._ccx[champ] = valeur; ccxPeindre(); }
function ccxReinitialiser() { window._ccx = { etat: '', compagnie: '', recherche: '' }; ccxPeindre(); }

function ccxOuvrirContrat(clientId) {
  if (clientId && typeof voirClient === 'function') voirClient(clientId);
  else if (clientId && typeof navigate === 'function') navigate('clients');
}

async function ccxCreer(contratId) {
  await creerCommissionManquante(contratId);
  // creerCommissionManquante() renvoie vers son propre écran : on revient ici.
  if (typeof navigate === 'function') navigate('controle-coherence');
}

// Le drapeau « non commissionnable » et une commission bien réelle ne peuvent pas coexister. On
// corrige le drapeau plutôt que la commission : la commission, elle, a une trace bancaire.
async function ccxRendreCommissionnable(contratId) {
  if (typeof dbPatch !== 'function') return;
  const r = await dbPatch('contrats', contratId, { commissionne: true });
  if (r && r.error) { if (typeof showError === 'function') showError('Échec : ' + (typeof errMsg === 'function' ? errMsg(r) : '')); return; }
  const ct = (typeof allContrats !== 'undefined' ? allContrats : []).find(c => c.id === contratId);
  if (ct) ct.commissionne = true;
  if (typeof logAction === 'function') logAction('contrat_rendre_commissionnable', 'contrats', contratId, '');
  if (typeof showError === 'function') showError('✓ Contrat rendu commissionnable');
  ccxPeindre();
}

function ccxExporter() {
  if (typeof XLSX === 'undefined') { if (typeof showError === 'function') showError('Le module Excel n’est pas chargé.'); return; }
  const L = ccxLignes();
  const nom = c => (CCX_ETATS.find(e => e.cle === c) || {}).nom || c;
  const feuille = XLSX.utils.json_to_sheet(L.map(l => ({
    État: nom(l.etat), Client: l.client, Compagnie: l.compagnie, Produit: l.produit,
    Police: l.police, 'Statut contrat': l.statut,
    'Prime annuelle': l.prime || null, 'Commission': l.montant || null,
    'Nb lignes commission': l.nbComm,
  })));
  feuille['!cols'] = [{ wch: 24 }, { wch: 26 }, { wch: 16 }, { wch: 34 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 13 }, { wch: 8 }];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, 'Contrôle');
  XLSX.writeFile(classeur, `controle-contrats-commissions_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Branchement ─────────────────────────────────────────────────────────────────────────────────
// L'entrée de menu et la route vivent dans js/03 avec toutes les autres : une vue qui s'ajoute
// elle-même au routeur par-dessous marche jusqu'au jour où deux vues le font. Ici on ne complète
// que la table des synonymes de la palette Ctrl+K, qui est faite pour être enrichie.
(function ccxBrancher() {
  if (typeof NAV_SYNONYMES !== 'undefined') {
    NAV_SYNONYMES['controle-coherence'] = 'controle coherence anomalie trou manquant orphelin audit verification croise sans commission';
  }
})();
