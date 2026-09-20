// ═══ ENTRÉES D'ARGENT, PAR CONTRAT (20.09.2026) ════════════════════════════════════════════════
// Question de Jonathan : « c'est quoi les commissions d'acquisition prévues sur le plan de
// trésorerie, est-ce que ça serait pas pertinent une entrée d'argent détaillée par contrat en
// export PDF ou Excel ».
//
// Ce qui existait ne répondait qu'à moitié :
//   — le plan de trésorerie (js/21) donne des TOTAUX par mois, sans dire quel contrat les porte ;
//   — les prévisions 12 mois (js/41) donnent le détail, mais seulement de ce qui reste à VENIR,
//     et l'export s'arrête au CSV.
//
// Ici : tout l'argent, encaissé ET attendu, une ligne par commission et par contrat, sur la
// période qu'on choisit — avec un vrai classeur Excel et une sortie A4.
//
// Un parti pris sur l'export : le classeur porte TROIS feuilles. Le détail pour vérifier, la
// synthèse par mois pour la trésorerie, la synthèse par compagnie pour la négociation. Un tableur
// qu'on doit reconstruire après l'avoir exporté n'a pas été exporté.
//
// Et les montants y sont des NOMBRES, pas du texte. Un export dont les colonnes ne s'additionnent
// pas dans Excel ne sert à rien — c'est le défaut le plus courant des exports de CRM.

const EA_PERIODES = [
  { id: '12mois',   nom: '12 prochains mois' },
  { id: 'annee',    nom: 'Année en cours' },
  { id: 'anneep',   nom: 'Année précédente' },
  { id: '12passes', nom: '12 derniers mois' },
  { id: 'tout',     nom: 'Tout' },
];

window._ea = window._ea || { periode: '12mois', filtre: 'tous', lignes: [] };

function eaEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function eaNomClient(id, repli) {
  const c = id ? (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === id) : null;
  if (!c) return repli || '—';
  return (typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim();
}

function eaBornes() {
  const a = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  switch (window._ea.periode) {
    case 'annee':    return { du: `${a.getFullYear()}-01-01`, au: `${a.getFullYear()}-12-31` };
    case 'anneep':   return { du: `${a.getFullYear() - 1}-01-01`, au: `${a.getFullYear() - 1}-12-31` };
    case '12passes': return { du: iso(new Date(a.getFullYear(), a.getMonth() - 11, 1)), au: iso(a) };
    case 'tout':     return { du: '2000-01-01', au: '2099-12-31' };
    default:         return { du: iso(a), au: iso(new Date(a.getFullYear(), a.getMonth() + 12, 0)) };
  }
}

// ── La collecte ─────────────────────────────────────────────────────────────────────────────────
// Deux sources, une seule forme de ligne. Ce qui est ENCAISSÉ porte sa date de réception réelle ;
// ce qui est ATTENDU porte sa date prévue, calculée par le même moteur que la trésorerie — ainsi
// les deux écrans ne peuvent pas diverger.
function eaCollecter() {
  const { du, au } = eaBornes();
  const aujIso = new Date().toISOString().slice(0, 10);
  const lignes = [];
  const CA = typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : [];
  const CT = typeof allContrats !== 'undefined' ? allContrats : [];

  for (const ca of CA) {
    if (ca.statut === 'annulée') continue;
    const ct = ca.contrat_id ? CT.find(x => x.id === ca.contrat_id) : null;
    if (ct && (ct.commissionne === false || ct.statut === 'annulé')) continue;

    const commun = {
      client: ca.client_nom || eaNomClient(ca.client_id),
      client_id: ca.client_id,
      compagnie: ca.compagnie || (ct && ct.compagnie) || '—',
      produit: ca.produit || (ct && ct.produit) || '—',
      police: (ct && ct.numero_police) || ca.numero_police || '',
      prime: ct ? Number(ct.prime_annuelle || 0) : null,
      nature: ca.nature === 'gestion' ? 'Gestion' : 'Acquisition',
      ca_id: ca.id,
    };

    const encaisse = ['reçue', 'versé_oz'].includes(ca.statut);
    if (encaisse) {
      const date = (ca.date_reception || ca.date_creation || '').slice(0, 10);
      if (!date || date < du || date > au) continue;
      lignes.push({ ...commun, date, montant: Number(ca.montant_final ?? ca.montant_estime ?? 0),
        etat: ca.statut === 'versé_oz' ? 'Encaissé (OZ)' : 'Encaissé', entite: ca.statut === 'versé_oz' ? 'OZ' : 'Assurex',
        reel: ca.montant_final != null, retard: false });
      continue;
    }

    // Attendu : on reprend l'échéancier du moteur de trésorerie plutôt que d'en réinventer un.
    const reste = typeof commissionResteAttendu === 'function' ? commissionResteAttendu(ca)
      : Number(ca.montant_estime || 0);
    if (!reste) continue;
    const gestion = ca.nature === 'gestion';
    let datePrevue = typeof commissionDatePrevue === 'function' ? commissionDatePrevue(ca) : null;
    if (!datePrevue) {
      const delai = typeof trDelaiMoyenAcquisition === 'function' ? trDelaiMoyenAcquisition() : 60;
      const b = new Date(((ca.date_creation || aujIso).slice(0, 10)) + 'T00:00:00');
      b.setDate(b.getDate() + delai);
      datePrevue = b.toISOString().slice(0, 10);
    }
    const parts = (gestion && typeof commissionEcheancier === 'function')
      ? commissionEcheancier(ca, reste) : [{ date: datePrevue, montant: reste }];
    for (const pt of parts) {
      if (!pt.date || pt.date < du || pt.date > au) continue;
      const oz = typeof commissionGestionEncaisseeParOZ === 'function' && commissionGestionEncaisseeParOZ(ca, pt.date);
      lignes.push({ ...commun, date: pt.date, montant: Number(pt.montant || 0),
        etat: pt.date < aujIso ? 'En retard' : 'Attendu', entite: oz ? 'OZ' : 'Assurex',
        reel: false, retard: pt.date < aujIso });
    }
  }

  lignes.sort((a, b) => a.date.localeCompare(b.date) || b.montant - a.montant);
  window._ea.lignes = lignes;
  return lignes;
}

function eaVisibles() {
  const f = window._ea.filtre;
  return window._ea.lignes.filter(l =>
    f === 'tous' ? true
    : f === 'encaisse' ? l.etat.startsWith('Encaissé')
    : f === 'attendu' ? !l.etat.startsWith('Encaissé')
    : f === 'retard' ? l.retard
    : f === 'assurex' ? l.entite === 'Assurex'
    : f === 'oz' ? l.entite === 'OZ'
    : f === 'acquisition' ? l.nature === 'Acquisition'
    : f === 'gestion' ? l.nature === 'Gestion' : true);
}

// ── La page ─────────────────────────────────────────────────────────────────────────────────────
function viewEntreesArgent() {
  eaCollecter();
  setTimeout(eaPeindreTableau, 0);
  return `<div id="ea-page">${eaContenu()}</div>`;
}

function eaRendre() {
  eaCollecter();
  const el = document.getElementById('ea-page');
  if (el) el.innerHTML = eaContenu();
  setTimeout(eaPeindreTableau, 0);
}

function eaContenu() {
  const L = eaVisibles();
  const somme = a => Math.round(a.reduce((s, x) => s + x.montant, 0));
  const encaisse = L.filter(l => l.etat.startsWith('Encaissé'));
  const attendu = L.filter(l => !l.etat.startsWith('Encaissé'));
  const retard = L.filter(l => l.retard);
  const estimations = attendu.filter(l => !l.reel);
  const kpi = (l, v, s, ton) => `<div class="dbx-kpi ${ton || ''}"><span class="dbx-kpi-label">${l}</span><span class="dbx-kpi-valeur">${v}</span><span class="dbx-kpi-sous">${s}</span></div>`;
  const chf = n => 'CHF ' + Number(n).toLocaleString('fr-CH');

  return `
  <div class="page-header">
    <h2>💰 Entrées d’argent, par contrat</h2>
    <p class="page-sub">Chaque franc attendu ou encaissé, rattaché à son contrat et à son client.
      Les montants attendus sont des estimations tant qu’aucun décompte n’est venu les confirmer.</p>
  </div>

  <div class="dbx-kpis">
    ${kpi('Encaissé', chf(somme(encaisse)), `${encaisse.length} ligne(s)`)}
    ${kpi('Attendu', chf(somme(attendu)), `${attendu.length} ligne(s)`)}
    ${kpi('En retard', chf(somme(retard)), retard.length ? 'date prévue dépassée' : 'rien en retard', retard.length ? 'cf-alerte' : '')}
    ${kpi('Total', chf(somme(L)), `${estimations.length} estimation(s) sur ${L.length}`)}
  </div>

  <div class="ea-outils">
    <select class="form-input" onchange="window._ea.periode=this.value; eaRendre()" aria-label="Période">
      ${EA_PERIODES.map(p => `<option value="${p.id}" ${window._ea.periode === p.id ? 'selected' : ''}>${p.nom}</option>`).join('')}
    </select>
    <select class="form-input" onchange="window._ea.filtre=this.value; eaRendre()" aria-label="Filtre">
      <option value="tous">Tout</option>
      <option value="encaisse" ${window._ea.filtre === 'encaisse' ? 'selected' : ''}>Encaissé seulement</option>
      <option value="attendu" ${window._ea.filtre === 'attendu' ? 'selected' : ''}>Attendu seulement</option>
      <option value="retard" ${window._ea.filtre === 'retard' ? 'selected' : ''}>En retard</option>
      <option value="acquisition" ${window._ea.filtre === 'acquisition' ? 'selected' : ''}>Acquisition</option>
      <option value="gestion" ${window._ea.filtre === 'gestion' ? 'selected' : ''}>Gestion</option>
      <option value="assurex" ${window._ea.filtre === 'assurex' ? 'selected' : ''}>Assurex</option>
      <option value="oz" ${window._ea.filtre === 'oz' ? 'selected' : ''}>OZ Assure</option>
    </select>
    <button type="button" class="btn-save" onclick="eaExporterExcel()">⬇ Excel (3 feuilles)</button>
    <button type="button" class="btn-secondary" onclick="eaImprimer()">🖨️ PDF / impression</button>
  </div>

  <div id="ea-tableau"></div>`;
}

function eaPeindreTableau() {
  if (typeof tblRendre !== 'function' || !document.getElementById('ea-tableau')) return;
  const chf = n => Number(n).toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  tblRendre('ea-tableau', {
    titre: 'Détail par contrat',
    lignes: eaVisibles(),
    parPage: 300,
    colonnes: [
      { cle: 'date', titre: 'Date', gabarit: '104px', valeur: l => l.date, texte: l => fmtDate(l.date) },
      { cle: 'client', titre: 'Client', gabarit: '1.5fr', valeur: l => l.client },
      { cle: 'compagnie', titre: 'Compagnie', gabarit: '1fr', valeur: l => l.compagnie },
      { cle: 'produit', titre: 'Produit', gabarit: '1.3fr', valeur: l => l.produit },
      { cle: 'police', titre: 'Police', gabarit: '128px', valeur: l => l.police || '—' },
      { cle: 'nature', titre: 'Nature', gabarit: '104px', valeur: l => l.nature },
      { cle: 'entite', titre: 'Entité', gabarit: '86px', valeur: l => l.entite },
      { cle: 'etat', titre: 'État', gabarit: '116px', valeur: l => l.etat },
      { cle: 'prime', titre: 'Prime/an', gabarit: '106px', aligne: 'droite',
        valeur: l => l.prime ?? 0, texte: l => l.prime ? chf(l.prime) : '—' },
      { cle: 'montant', titre: 'Montant', gabarit: '116px', aligne: 'droite',
        valeur: l => l.montant, texte: l => chf(Math.round(l.montant)),
        titreCellule: l => l.reel ? 'Montant constaté sur un décompte' : 'Estimation — non confirmée par un décompte' },
    ],
    classeLigne: l => l.retard ? 'ea-retard' : (l.reel ? 'ea-reel' : ''),
    surClic: l => { if (l.client_id && typeof showClient === 'function') showClient(l.client_id); },
    vide: 'Aucune entrée d’argent sur cette période.',
  });
}

// ── Les synthèses, calculées une fois et partagées par les deux exports ─────────────────────────
function eaSyntheses(L) {
  const parMois = {}, parCompagnie = {};
  for (const l of L) {
    const m = l.date.slice(0, 7);
    const cle = l.etat.startsWith('Encaissé') ? 'encaisse' : 'attendu';
    (parMois[m] = parMois[m] || { encaisse: 0, attendu: 0, n: 0 });
    parMois[m][cle] += l.montant; parMois[m].n++;
    (parCompagnie[l.compagnie] = parCompagnie[l.compagnie] || { encaisse: 0, attendu: 0, acquisition: 0, gestion: 0, n: 0 });
    parCompagnie[l.compagnie][cle] += l.montant;
    parCompagnie[l.compagnie][l.nature === 'Gestion' ? 'gestion' : 'acquisition'] += l.montant;
    parCompagnie[l.compagnie].n++;
  }
  return { parMois, parCompagnie };
}

// ── Excel ───────────────────────────────────────────────────────────────────────────────────────
function eaExporterExcel() {
  if (typeof XLSX === 'undefined' || !XLSX.utils || !XLSX.writeFile) {
    showError('Export Excel indisponible : la bibliothèque n’a pas été chargée.'); return;
  }
  const L = eaVisibles();
  if (!L.length) { showError('Rien à exporter sur cette période.'); return; }
  const { du, au } = eaBornes();
  const { parMois, parCompagnie } = eaSyntheses(L);
  const r2 = n => Math.round(Number(n) * 100) / 100;

  // Feuille 1 — le détail. Les dates sont de vraies dates, les montants de vrais nombres :
  // c'est ce qui permet de filtrer et d'additionner dans Excel sans rien retoucher.
  const detail = L.map(l => ({
    Date: new Date(l.date + 'T00:00:00'),
    Client: l.client, Compagnie: l.compagnie, Produit: l.produit,
    'N° police': l.police || '', Nature: l.nature, Entité: l.entite, État: l.etat,
    'Prime annuelle': l.prime ? r2(l.prime) : null,
    'Montant CHF': r2(l.montant),
    Source: l.reel ? 'Décompte' : 'Estimation',
  }));
  const ws1 = XLSX.utils.json_to_sheet(detail, { cellDates: true });
  ws1['!cols'] = [{ wch: 11 }, { wch: 26 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 9 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 11 }];
  ws1['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: detail.length, c: 10 } }) };
  ws1['!freeze'] = { xSplit: 0, ySplit: 1 };

  const ws2 = XLSX.utils.json_to_sheet(Object.entries(parMois).sort().map(([m, v]) => ({
    Mois: m, 'Encaissé CHF': r2(v.encaisse), 'Attendu CHF': r2(v.attendu),
    'Total CHF': r2(v.encaisse + v.attendu), Lignes: v.n,
  })));
  ws2['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 8 }];

  const ws3 = XLSX.utils.json_to_sheet(Object.entries(parCompagnie)
    .sort((a, b) => (b[1].encaisse + b[1].attendu) - (a[1].encaisse + a[1].attendu))
    .map(([c, v]) => ({
      Compagnie: c, 'Acquisition CHF': r2(v.acquisition), 'Gestion CHF': r2(v.gestion),
      'Encaissé CHF': r2(v.encaisse), 'Attendu CHF': r2(v.attendu),
      'Total CHF': r2(v.encaisse + v.attendu), Lignes: v.n,
    })));
  ws3['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 8 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Détail par contrat');
  XLSX.utils.book_append_sheet(wb, ws2, 'Par mois');
  XLSX.utils.book_append_sheet(wb, ws3, 'Par compagnie');
  XLSX.writeFile(wb, `entrees-argent_${du}_${au}.xlsx`);
  showError(`✓ ${L.length} lignes exportées sur 3 feuilles.`);
}

// ── PDF (par l'impression du navigateur) ────────────────────────────────────────────────────────
// On n'embarque pas de bibliothèque PDF : le navigateur en a une, elle gère les sauts de page et
// les en-têtes répétés mieux qu'un générateur maison, et « Enregistrer en PDF » y est natif.
function eaImprimer() {
  const L = eaVisibles();
  if (!L.length) { showError('Rien à imprimer sur cette période.'); return; }
  const { du, au } = eaBornes();
  const { parMois } = eaSyntheses(L);
  const chf = n => Number(Math.round(n)).toLocaleString('fr-CH');
  const total = L.reduce((s, l) => s + l.montant, 0);
  const encaisse = L.filter(l => l.etat.startsWith('Encaissé')).reduce((s, l) => s + l.montant, 0);
  const periode = (EA_PERIODES.find(p => p.id === window._ea.periode) || {}).nom || '';

  const zone = document.createElement('div');
  zone.id = 'ea-impression';
  zone.innerHTML = `
    <header class="ea-imp-tete">
      <div><h1>Entrées d’argent, par contrat</h1>
        <p>${eaEsc(periode)} · du ${fmtDate(du)} au ${fmtDate(au)} · édité le ${fmtDate(new Date().toISOString().slice(0, 10))}</p></div>
      <img src="assets/logos/assurex.png" alt="Assurex"/>
    </header>
    <table class="ea-imp-synthese">
      <tr><th>Encaissé</th><th>Attendu</th><th>Total</th><th>Lignes</th></tr>
      <tr><td>CHF ${chf(encaisse)}</td><td>CHF ${chf(total - encaisse)}</td><td><b>CHF ${chf(total)}</b></td><td>${L.length}</td></tr>
    </table>
    <table class="ea-imp-table">
      <thead><tr><th>Date</th><th>Client</th><th>Compagnie</th><th>Produit</th><th>Police</th>
        <th>Nature</th><th>État</th><th class="d">Montant</th></tr></thead>
      <tbody>${L.map(l => `<tr><td>${fmtDate(l.date)}</td><td>${eaEsc(l.client)}</td><td>${eaEsc(l.compagnie)}</td>
        <td>${eaEsc(l.produit)}</td><td>${eaEsc(l.police || '—')}</td><td>${l.nature}</td><td>${l.etat}</td>
        <td class="d">${chf(l.montant)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="7">Total</td><td class="d">CHF ${chf(total)}</td></tr></tfoot>
    </table>
    <table class="ea-imp-table ea-imp-mois">
      <thead><tr><th>Mois</th><th class="d">Encaissé</th><th class="d">Attendu</th><th class="d">Total</th></tr></thead>
      <tbody>${Object.entries(parMois).sort().map(([m, v]) => `<tr><td>${m}</td>
        <td class="d">${chf(v.encaisse)}</td><td class="d">${chf(v.attendu)}</td>
        <td class="d"><b>${chf(v.encaisse + v.attendu)}</b></td></tr>`).join('')}</tbody>
    </table>
    <p class="ea-imp-pied">Document de travail. Les montants « attendus » sont des estimations
      fondées sur les conventions de commissionnement et les rythmes de versement observés ; ils ne
      constituent pas un engagement des compagnies. Assurex Sàrl · Rue du Centre 142, 1025 St-Sulpice.</p>`;

  document.getElementById('ea-impression')?.remove();
  document.body.appendChild(zone);
  document.body.classList.add('ea-mode-impression');
  const nettoyer = () => {
    document.body.classList.remove('ea-mode-impression');
    document.getElementById('ea-impression')?.remove();
    window.removeEventListener('afterprint', nettoyer);
  };
  window.addEventListener('afterprint', nettoyer);
  setTimeout(() => window.print(), 80);
  // Filet : certains navigateurs n'émettent pas « afterprint ».
  setTimeout(nettoyer, 60000);
}
