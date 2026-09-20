// ═══ ENTRÉES D'ARGENT : LA VUE (20.09.2026) ════════════════════════════════════════════════════
// Trois remarques de Jonathan, toutes justes, et une même cause derrière deux d'entre elles.
//
// 1. « LA COLONNE DATE NE SE VOIT PAS LA DATE. » Mesuré : la cellule faisait 104 px pour un texte
//    de 106 px, avec overflow:hidden et white-space:nowrap — le dernier chiffre de l'année était
//    rogné. Le tableau générique (js/66) répartit dix colonnes en grille CSS ; à dix colonnes il
//    n'a plus assez de place et ce sont les colonnes fixes qui coupent. On écrit donc ici un
//    tableau propre à cet écran, où la date a la place qu'il lui faut.
//
// 2. « POURQUOI ELISA RIGGIO DANS LES ENTRÉES. » Parce que sa commission 3a de CHF 3 092.08 est
//    encaissée — mais sur le compte courant OZ, pas chez Assurex. L'ancienne vue mélangeait les
//    deux entités dans une colonne discrète. L'entité devient un choix de premier plan, affiché
//    en permanence, et chaque ligne OZ porte une pastille distincte. Rien n'est caché : ce qui
//    appartient à OZ est simplement reconnaissable au premier coup d'œil.
//
// 3. « NAVIGUER ENTRE LES DEUX POUR SAVOIR QUEL MONTANT DU GRAPHIQUE CORRESPOND À QUELLE LIGNE. »
//    C'est la demande de fond, et c'est la bonne : un graphique qu'on ne peut pas ouvrir n'est
//    qu'une illustration. Les barres mensuelles sont ici cliquables — un clic filtre le tableau
//    sur ce mois. Et le plan de trésorerie reçoit un bouton par mois qui amène directement ici,
//    sur le mois en question. Les deux écrans lisent le même moteur (commissionDatePrevue,
//    commissionEcheancier) : ils ne peuvent donc pas raconter deux histoires différentes.

// Filtres fins. Chacun est indépendant des autres : on peut vouloir « l'attendu d'Helsana en
// acquisition sur novembre », et aucune combinaison n'est interdite.
window._eaf = window._eaf || {
  entite: 'tous', etat: 'tous', nature: 'tous',
  compagnie: '', mois: '', recherche: '', tri: 'date', sens: 1,
};

function eafEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function eafCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }

const EAF_MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function eafLibelleMois(cle) {
  const [a, m] = String(cle).split('-');
  return `${EAF_MOIS[Number(m) - 1] || m} ${String(a).slice(2)}`;
}

// ── Le filtrage ─────────────────────────────────────────────────────────────────────────────────
// eaVisibles() de js/72 ne connaît qu'un filtre à la fois ; on le remplace par un filtrage
// cumulatif. Le nom reste le même : tout ce qui l'appelle (exports, impression) suit sans changer.
function eafVisibles() {
  const F = window._eaf;
  const q = F.recherche.trim().toLowerCase();
  const lignes = (window._ea.lignes || []).filter(l => {
    if (F.entite !== 'tous' && l.entite !== F.entite) return false;
    if (F.etat === 'encaisse' && !l.etat.startsWith('Encaissé')) return false;
    if (F.etat === 'attendu' && l.etat.startsWith('Encaissé')) return false;
    if (F.etat === 'retard' && !l.retard) return false;
    if (F.nature !== 'tous' && l.nature !== F.nature) return false;
    if (F.compagnie && l.compagnie !== F.compagnie) return false;
    if (F.mois && l.date.slice(0, 7) !== F.mois) return false;
    if (q && !`${l.client} ${l.compagnie} ${l.produit} ${l.police}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const s = F.sens;
  const cmp = {
    date: (a, b) => a.date.localeCompare(b.date),
    client: (a, b) => a.client.localeCompare(b.client, 'fr'),
    compagnie: (a, b) => a.compagnie.localeCompare(b.compagnie, 'fr'),
    montant: (a, b) => a.montant - b.montant,
  }[F.tri] || ((a, b) => a.date.localeCompare(b.date));
  return lignes.sort((a, b) => cmp(a, b) * s || b.montant - a.montant);
}

function eafFiltrer(champ, valeur) {
  window._eaf[champ] = valeur;
  eaRendre();
}
function eafTrier(cle) {
  const F = window._eaf;
  F.sens = F.tri === cle ? -F.sens : (cle === 'montant' ? -1 : 1);
  F.tri = cle;
  eaRendre();
}
function eafToutAfficher() {
  window._eaf = { entite: 'tous', etat: 'tous', nature: 'tous', compagnie: '', mois: '', recherche: '', tri: 'date', sens: 1 };
  eaRendre();
}

// ── Le graphique mensuel, cliquable ─────────────────────────────────────────────────────────────
// Deux barres empilées par mois : l'encaissé en plein, l'attendu hachuré. Le hachuré dit « ce
// n'est pas encore arrivé » sans qu'il faille lire une légende — une estimation ne doit jamais
// avoir l'aspect plein d'un fait.
function eafGraphique(lignes) {
  const parMois = {};
  for (const l of lignes) {
    const m = l.date.slice(0, 7);
    if (!parMois[m]) parMois[m] = { encaisse: 0, attendu: 0, n: 0 };
    parMois[m][l.etat.startsWith('Encaissé') ? 'encaisse' : 'attendu'] += l.montant;
    parMois[m].n++;
  }
  const mois = Object.keys(parMois).sort();
  if (!mois.length) return '';
  const max = Math.max(...mois.map(m => parMois[m].encaisse + parMois[m].attendu), 1);
  const aujMois = new Date().toISOString().slice(0, 7);
  const F = window._eaf;

  return `<div class="eaf-graph" role="group" aria-label="Entrées par mois — cliquez un mois pour filtrer">
    ${mois.map(m => {
      const v = parMois[m];
      const total = v.encaisse + v.attendu;
      const hE = (v.encaisse / max) * 100, hA = (v.attendu / max) * 100;
      const actif = F.mois === m;
      return `<button type="button" class="eaf-barre ${actif ? 'actif' : ''} ${m === aujMois ? 'courant' : ''}"
          onclick="eafFiltrer('mois', '${actif ? '' : m}')"
          aria-pressed="${actif}"
          title="${eafLibelleMois(m)} — encaissé CHF ${eafCHF(v.encaisse)}, attendu CHF ${eafCHF(v.attendu)} (${v.n} ligne${v.n > 1 ? 's' : ''})">
        <span class="eaf-barre-val">${total >= 1000 ? Math.round(total / 1000) + 'k' : Math.round(total) || ''}</span>
        <span class="eaf-barre-pile">
          <i class="eaf-attendu" style="height:${hA}%"></i>
          <i class="eaf-encaisse" style="height:${hE}%"></i>
        </span>
        <span class="eaf-barre-mois">${eafLibelleMois(m)}</span>
      </button>`;
    }).join('')}
  </div>
  <div class="eaf-legende">
    <span><i class="eaf-pastille-encaisse"></i>Encaissé</span>
    <span><i class="eaf-pastille-attendu"></i>Attendu (estimation)</span>
    <span class="eaf-legende-aide">Cliquez un mois pour n’afficher que ses lignes.</span>
  </div>`;
}

// ── La page ─────────────────────────────────────────────────────────────────────────────────────
function eafContenu() {
  const toutes = window._ea.lignes || [];
  const L = eafVisibles();
  const F = window._eaf;
  const somme = a => a.reduce((s, x) => s + x.montant, 0);

  const encaisse = L.filter(l => l.etat.startsWith('Encaissé'));
  const attendu = L.filter(l => !l.etat.startsWith('Encaissé'));
  const retard = L.filter(l => l.retard);
  const assurex = L.filter(l => l.entite === 'Assurex');
  const oz = L.filter(l => l.entite === 'OZ');

  const compagnies = [...new Set(toutes.map(l => l.compagnie))].sort();
  const actifs = (F.entite !== 'tous') + (F.etat !== 'tous') + (F.nature !== 'tous')
    + (F.compagnie ? 1 : 0) + (F.mois ? 1 : 0) + (F.recherche ? 1 : 0);

  const seg = (champ, valeurs) => `<div class="eaf-segments" role="group">${valeurs.map(([v, nom, aide]) =>
    `<button type="button" class="${F[champ] === v ? 'actif' : ''}" onclick="eafFiltrer('${champ}','${v}')"
      ${aide ? `title="${eafEsc(aide)}"` : ''}>${nom}</button>`).join('')}</div>`;

  const kpi = (l, v, s, ton) => `<div class="dbx-kpi ${ton || ''}"><span class="dbx-kpi-label">${l}</span><span class="dbx-kpi-valeur">CHF ${eafCHF(v)}</span><span class="dbx-kpi-sous">${s}</span></div>`;

  return `
  <div class="page-header">
    <h2>💰 Entrées d’argent, par contrat</h2>
    <p class="page-sub">Chaque franc attendu ou encaissé, rattaché à son contrat et à son client.
      Les montants attendus sont des estimations tant qu’aucun décompte n’est venu les confirmer.</p>
  </div>

  ${(() => {
    // Les encaissements sans date (20.09.2026). Ils ne figurent sur aucune courbe — et c'est
    // voulu : leur donner la date de saisie les empilait tous au jour de la reprise. Mais ils
    // existent, et un total qui les oublierait serait faux dans l'autre sens. On les annonce
    // donc, chiffrés, au-dessus des courbes qui ne peuvent pas les montrer.
    const S = typeof eaSansDate !== 'undefined' ? eaSansDate : [];
    if (!S.length) return '';
    const t = S.reduce((s, l) => s + Number(l.montant || 0), 0);
    const cies = [...new Set(S.map(l => l.compagnie))].filter(x => x && x !== '—');
    return `<div class="eaf-sansdate">
      <b>CHF ${eafCHF(t)} encaissés sans date connue</b>
      <small>${S.length} ligne${S.length > 1 ? 's' : ''}${cies.length ? ` · ${cies.slice(0, 6).join(', ')}${cies.length > 6 ? '…' : ''}` : ''}.
        Ces montants sont bien encaissés, mais aucune date de réception n’est enregistrée : ils ne
        peuvent apparaître sur aucun mois. Les dater, c’est rapprocher les décomptes des virements
        bancaires — jusque-là, les courbes ci-dessous ne montrent qu’une partie du réel.</small>
    </div>`;
  })()}

  <div class="dbx-kpis">
    ${kpi('Encaissé', somme(encaisse), `${encaisse.length} ligne${encaisse.length > 1 ? 's' : ''}`)}
    ${kpi('Attendu', somme(attendu), `${attendu.length} ligne${attendu.length > 1 ? 's' : ''}`)}
    ${kpi('En retard', somme(retard), retard.length ? 'date prévue dépassée' : 'rien en retard', retard.length ? 'cf-alerte' : '')}
    ${kpi('Dont OZ', somme(oz), oz.length ? `hors chiffre Assurex · ${eafCHF(somme(assurex))} pour Assurex` : 'tout est Assurex')}
  </div>

  <section class="dbx-carte eaf-carte">
    <header class="dbx-carte-tete">
      <div><h2>Par mois</h2><span class="dbx-carte-sous">${F.mois ? eafLibelleMois(F.mois) + ' — cliquez à nouveau pour tout revoir' : 'Cliquez un mois pour ouvrir son détail'}</span></div>
      <button type="button" class="btn-secondary eaf-pont" onclick="eafVersTresorerie()">📈 Voir dans le plan de trésorerie</button>
    </header>
    ${eafGraphique(toutes.filter(l => (F.entite === 'tous' || l.entite === F.entite)))}
  </section>

  <div class="eaf-outils">
    <div class="eaf-groupe">
      <label class="eaf-label">Période</label>
      <select class="form-select" onchange="window._ea.periode=this.value; window._eaf.mois=''; eaRendre()">
        ${EA_PERIODES.map(p => `<option value="${p.id}" ${window._ea.periode === p.id ? 'selected' : ''}>${p.nom}</option>`).join('')}
      </select>
    </div>
    <div class="eaf-groupe">
      <label class="eaf-label">Entité</label>
      ${seg('entite', [['tous', 'Les deux'], ['Assurex', 'Assurex', 'Encaissé ou attendu sur le compte Assurex'], ['OZ', 'OZ', 'Versé sur le compte courant OZ — hors chiffre d’affaires Assurex']])}
    </div>
    <div class="eaf-groupe">
      <label class="eaf-label">État</label>
      ${seg('etat', [['tous', 'Tout'], ['encaisse', 'Encaissé'], ['attendu', 'Attendu'], ['retard', 'En retard']])}
    </div>
    <div class="eaf-groupe">
      <label class="eaf-label">Nature</label>
      ${seg('nature', [['tous', 'Tout'], ['Acquisition', 'Acquisition'], ['Gestion', 'Gestion']])}
    </div>
    <div class="eaf-groupe">
      <label class="eaf-label">Compagnie</label>
      <select class="form-select" onchange="eafFiltrer('compagnie', this.value)">
        <option value="">Toutes (${compagnies.length})</option>
        ${compagnies.map(c => `<option value="${eafEsc(c)}" ${F.compagnie === c ? 'selected' : ''}>${eafEsc(c)}</option>`).join('')}
      </select>
    </div>
    <div class="eaf-groupe eaf-groupe-large">
      <label class="eaf-label">Rechercher</label>
      <input class="form-input" type="search" placeholder="Client, produit, n° de police…"
        value="${eafEsc(F.recherche)}" oninput="clearTimeout(window._eafT); window._eafT=setTimeout(()=>eafFiltrer('recherche', this.value), 250)"/>
    </div>
    <div class="eaf-groupe eaf-groupe-actions">
      ${actifs ? `<button type="button" class="btn-secondary" onclick="eafToutAfficher()">Retirer les ${actifs} filtre${actifs > 1 ? 's' : ''}</button>` : ''}
      <button type="button" class="btn-save" onclick="eaExporterExcel()">⬇ Excel</button>
      <button type="button" class="btn-secondary" onclick="eaImprimer()">🖨️ PDF</button>
    </div>
  </div>

  <section class="dbx-carte eaf-carte">
    <header class="dbx-carte-tete"><div><h2>Détail</h2>
      <span class="dbx-carte-sous">${L.length} ligne${L.length > 1 ? 's' : ''} sur ${toutes.length} · total CHF ${eafCHF(somme(L))}</span></div></header>
    ${L.length ? eafTableau(L) : '<div class="dbx-vide-petit">Aucune entrée d’argent dans cette sélection.</div>'}
  </section>`;
}

function eafTableau(L) {
  const F = window._eaf;
  const fl = (cle, nom, cls) => `<th class="${cls || ''} ${F.tri === cle ? 'trie' : ''}">
    <button type="button" onclick="eafTrier('${cle}')">${nom}${F.tri === cle ? (F.sens > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;

  return `<div class="eaf-table-enveloppe"><table class="eaf-table">
    <thead><tr>
      ${fl('date', 'Date')}
      ${fl('client', 'Client')}
      ${fl('compagnie', 'Compagnie')}
      <th><span>Produit</span></th><th><span>Nature</span></th><th><span>État</span></th>
      ${fl('montant', 'Montant', 'd')}
    </tr></thead>
    <tbody>${L.map(l => {
      const enc = l.etat.startsWith('Encaissé');
      const ton = l.retard ? 'retard' : enc ? 'ok' : 'attente';
      return `<tr class="ton-${ton}" ${l.client_id ? `onclick="eafOuvrirClient('${l.client_id}')"` : ''}>
        <td class="eaf-date">${fmtDate(l.date)}</td>
        <td><b>${eafEsc(l.client)}</b>${l.police ? `<small>police ${eafEsc(l.police)}</small>` : ''}</td>
        <td>${eafEsc(l.compagnie)}</td>
        <td class="eaf-produit">${eafEsc(l.produit)}</td>
        <td><span class="eaf-tag">${l.nature}</span></td>
        <td><span class="eaf-etat ton-${ton} ${l.entite === 'OZ' ? 'oz' : ''}">${eafEsc(l.etat)}</span></td>
        <td class="d ${l.reel ? 'reel' : 'estime'}"
          title="${l.reel ? 'Montant constaté sur un décompte' : 'Estimation — non confirmée par un décompte'}">
          ${eafCHF(l.montant)}${l.reel ? '' : '<span class="eaf-tilde" aria-label="estimation">≈</span>'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function eafOuvrirClient(id) {
  if (typeof showClient === 'function') showClient(id);
  else if (typeof voirClient === 'function') voirClient(id);
}

// ── Le pont vers le plan de trésorerie ──────────────────────────────────────────────────────────
// Le mois sélectionné voyage avec la navigation : on arrive dans la trésorerie avec ce mois mis en
// évidence, et le chemin inverse existe (bouton par mois dans le tableau de trésorerie).
function eafVersTresorerie() {
  window._trMoisCible = window._eaf.mois || '';
  if (typeof navigate === 'function') navigate('tresorerie');
}

function eafDepuisTresorerie(mois) {
  window._eaf = { entite: 'tous', etat: 'tous', nature: 'tous', compagnie: '', mois: mois || '', recherche: '', tri: 'date', sens: 1 };
  // « Tout » plutôt que la fenêtre glissante : le mois demandé peut être hors des 24 mois par
  // défaut, et arriver sur un écran vide après avoir cliqué un montant bien visible serait absurde.
  window._ea.periode = 'tout';
  if (typeof navigate === 'function') navigate('entrees-argent');
}

// ── Branchement ─────────────────────────────────────────────────────────────────────────────────
// On remplace le corps de la page et le filtrage de js/72, en gardant sa collecte et ses exports :
// le moteur qui calcule les montants n'est pas en cause, seule la présentation l'était.
(function eafBrancher() {
  if (typeof eaContenu === 'function') window.eaContenu = eafContenu;
  if (typeof eaVisibles === 'function') window.eaVisibles = eafVisibles;
  // eaPeindreTableau dessinait le tableau générique après coup : notre tableau est déjà dans le
  // HTML rendu, il n'y a plus rien à peindre.
  if (typeof eaPeindreTableau === 'function') window.eaPeindreTableau = function () {};
})();
