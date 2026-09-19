// ═══ OZ ASSURE — VUE REFONDUE (19.09.2026) ═══════════════════════════════════════════════════
// Remplace viewOzAssure() de js/10 (chargé après lui, la fonction globale est redéfinie).
// Sources :
//   - commissions_oz : grand livre / compte courant OZ (crédit − débit = net encaissé), le libellé
//     type_mouvement donne la nature (acquisition / gestion, cf. classerTypeMouvementOz de js/10)
//     et le n° de décompte (« BRD 65 ») quand il existe ;
//   - contrats_oz : portefeuille OZ (volume de primes, vie / non-vie, échéances) ;
//   - commission_tranches (encaisse_par 'oz', note « [oz:<id>] ») : lignes du grand livre déjà
//     rapprochées des commissions attendues du CRM (bouton dans le cockpit, onglet OZ ↔ Assurex) ;
//   - commissions_attente 'versé_oz' + ozPartAssurex / ozLignesRefacturation (js/34) : refacturation
//     à OZ jusqu'à la fusion complète (DATE_GESTION_ASSUREX), et gestion OZ qui bascule chez Assurex.
// Filtre année global (Tous / chaque année) en mémoire ; changer de filtre ou de courbe réaffiche la
// vue depuis le cache, sans recharger les données. L'export CSV « par client » de js/10 est conservé
// (il lit window._ozGestionClientRows, alimenté ici selon le filtre).

window._ozxAnnee = window._ozxAnnee || 'tous';
window._ozxCourbe = window._ozxCourbe || 'cumul';
window._ozxClientsTous = window._ozxClientsTous || false;

const OZX_MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const OZX_MOIS_INIT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const OZX_LIMITE_CLIENTS = 25;

function ozxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function ozxCie(n) { const s = String(n || '').trim(); return (s && typeof normaliserCompagnie === 'function' ? normaliserCompagnie(s) : s) || '—'; }
function ozxCHF(n) { return 'CHF ' + fmtCHF(Math.round(n || 0)); }
function ozxCompact(n) { return typeof dbxCompact === 'function' ? dbxCompact(n) : fmtCHF(Math.round(n || 0)); }
function ozxIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function ozxPct(part, total) { return total ? Math.round(part / total * 100) : 0; }
function ozxBrd(t) { const m = String(t || '').match(/\bBRD\s*(?:n[°o.]?\s*)?(\d{1,4})\b/i); return m ? m[1] : null; }
// Période écrite dans le libellé (« 01.04.26 - 30.06.26 ») pour l'afficher sous le décompte
function ozxPeriode(t) { const m = String(t || '').match(/(\d{1,2}\.\d{1,2}\.\d{2,4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/); return m ? `${m[1]} – ${m[2]}` : ''; }
function ozxEstVie(produit) { const p = String(produit || '').toLowerCase(); return (typeof PRODUITS_VIE_KEYWORDS !== 'undefined' ? PRODUITS_VIE_KEYWORDS : ['vie', '3a', '3b', 'lpp']).some(kw => p.includes(kw)); }
function ozxDateFusion() { return typeof DATE_GESTION_ASSUREX !== 'undefined' ? DATE_GESTION_ASSUREX : '2027-01-01'; }
function ozxTendance(actuel, precedent) {
  if (!precedent) return '';
  const pct = Math.round((actuel - precedent) / Math.abs(precedent) * 100);
  return `<span class="ozx-delta ${pct > 0 ? 'hausse' : pct < 0 ? 'baisse' : ''}">${pct > 0 ? '▲' : pct < 0 ? '▼' : '='} ${Math.abs(pct)} %</span>`;
}
// Client du CRM correspondant au nom du grand livre (pour ouvrir sa fiche), sinon null
function ozxClientCrm(nom) {
  if (typeof allClients === 'undefined' || !nom) return null;
  const n = String(nom).toLowerCase().replace(/\s+/g, ' ').trim();
  return allClients.find(c => {
    const a = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
    const b = `${c.nom || ''} ${c.prenom || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
    return a === n || b === n;
  }) || null;
}

// ── Point d'entrée (route 'oz-assure') ──────────────────────────────────────────────────────
async function viewOzAssure() {
  if (!currentUser || currentUser.role !== 'signataire') return `<div class="table-empty">Accès réservé.</div>`;
  const [commRows, contratRows] = await Promise.all([
    dbGet('commissions_oz', 'select=*&order=date_mouvement.asc'),
    dbGet('contrats_oz', 'select=*&order=client_nom.asc'),
  ]);
  window._ozxCache = { ledger: Array.isArray(commRows) ? commRows : [], contrats: Array.isArray(contratRows) ? contratRows : [] };
  return ozxRendre(false);
}

// Réaffichage instantané depuis le cache (changement de filtre / de courbe), sans animation d'entrée
function ozxRerendre() {
  const main = document.getElementById('main-content');
  if (!main || !window._ozxCache) return;
  if (typeof currentView !== 'undefined' && currentView !== 'oz-assure') return;
  const defil = document.documentElement.scrollTop;
  main.innerHTML = ozxRendre(true);
  document.documentElement.scrollTop = defil;
}
function ozxChoisirAnnee(a) { window._ozxAnnee = a || 'tous'; window._ozxClientsTous = false; ozxRerendre(); }
function ozxChoisirCourbe(m) { window._ozxCourbe = m; ozxRerendre(); }
function ozxAfficherTousClients() { window._ozxClientsTous = true; ozxRerendre(); }
// Compatibilité avec l'ancien sélecteur (js/10) : le filtre année est désormais global
function changerAnneeOzGestionClient(valeur) { ozxChoisirAnnee(valeur || 'tous'); }

function ozxFiltrerClients(q) {
  const s = String(q || '').toLowerCase().trim();
  const lignes = document.querySelectorAll('.ozx-clients [data-nom]');
  let n = 0;
  lignes.forEach((el, i) => {
    const ok = s ? el.dataset.nom.includes(s) : (window._ozxClientsTous || i < OZX_LIMITE_CLIENTS);
    el.hidden = !ok; if (ok) n++;
  });
  const plus = document.getElementById('ozx-clients-plus');
  if (plus) plus.hidden = !!s || window._ozxClientsTous || lignes.length <= OZX_LIMITE_CLIENTS;
  const vide = document.getElementById('ozx-clients-vide');
  if (vide) vide.hidden = n > 0;
}

// ── Calculs ─────────────────────────────────────────────────────────────────────────────────
function ozxCalculs() {
  const { ledger, contrats } = window._ozxCache;
  const aujIso = ozxIso(new Date());
  const lignes = ledger.map(r => {
    const date = String(r.date_mouvement || '').slice(0, 10);
    const credit = Number(r.credit || 0), debit = Number(r.debit || 0);
    return { r, date, an: date.slice(0, 4), m: Number(date.slice(5, 7)) || 0, net: credit - debit, credit, type: classerTypeMouvementOz(r.type_mouvement), cie: ozxCie(r.compagnie), brd: ozxBrd(r.type_mouvement), client: (r.client_nom && r.client_nom !== '-') ? String(r.client_nom).trim() : '' };
  }).filter(l => /^\d{4}$/.test(l.an));
  const annees = [...new Set(lignes.map(l => l.an))].sort();
  const anneeMax = annees[annees.length - 1] || String(new Date().getFullYear());
  const sel = window._ozxAnnee !== 'tous' && annees.includes(window._ozxAnnee) ? window._ozxAnnee : 'tous';
  const filtre = sel === 'tous' ? lignes : lignes.filter(l => l.an === sel);

  // Par année / par mois (toujours sur l'ensemble : sert aux comparaisons et aux courbes)
  const parAn = {}, parAnMois = {}, dernierMois = {};
  annees.forEach(a => { parAn[a] = { total: 0, Acquisition: 0, Gestion: 0, Autre: 0, nb: 0 }; parAnMois[a] = Array(12).fill(0); dernierMois[a] = 0; });
  const gesAnMois = {}; annees.forEach(a => { gesAnMois[a] = Array(12).fill(0); });
  lignes.forEach(l => {
    const p = parAn[l.an]; p.total += l.net; p[l.type] += l.net; p.nb++;
    if (l.m) { parAnMois[l.an][l.m - 1] += l.net; dernierMois[l.an] = Math.max(dernierMois[l.an], l.m); if (l.type === 'Gestion') gesAnMois[l.an][l.m - 1] += l.net; }
  });
  const anneeCal = new Date().getFullYear();
  const estPartielle = a => Number(a) >= anneeCal || (a === anneeMax && dernierMois[a] < 12);
  const comparer = a => {
    const prec = String(Number(a) - 1);
    if (!parAn[a] || !parAn[prec]) return null;
    if (estPartielle(a)) {
      const k = dernierMois[a] || 12;
      const somme = arr => arr.slice(0, k).reduce((s, v) => s + v, 0);
      return { actuel: somme(parAnMois[a]), precedent: somme(parAnMois[prec]), libelle: `vs ${OZX_MOIS[0]}–${OZX_MOIS[k - 1]} ${prec}`, k };
    }
    return { actuel: parAn[a].total, precedent: parAn[prec].total, libelle: `vs ${prec}` };
  };

  // Totaux filtrés
  const tot = { total: 0, Acquisition: 0, Gestion: 0, Autre: 0, credit: 0, debit: 0, vie: 0, nonVie: 0 };
  const parCie = {}, parClient = {}, parProduit = {}, parBrd = {};
  filtre.forEach(l => {
    tot.total += l.net; tot[l.type] += l.net; tot.credit += l.credit; tot.debit += Number(l.r.debit || 0);
    if (ozxEstVie(l.r.produit)) tot.vie += l.net; else tot.nonVie += l.net;
    const c = parCie[l.cie] = parCie[l.cie] || { total: 0, Gestion: 0, Acquisition: 0, nb: 0 }; c.total += l.net; if (l.type !== 'Autre') c[l.type] += l.net; c.nb++;
    if (l.client) {
      const k = parClient[l.client] = parClient[l.client] || { client: l.client, ges: 0, acq: 0, autre: 0, total: 0, nb: 0, cies: new Set(), dernier: '' };
      if (l.type === 'Gestion') k.ges += l.net; else if (l.type === 'Acquisition') k.acq += l.net; else k.autre += l.net;
      k.total += l.net; k.nb++; k.cies.add(l.cie); if (l.date > k.dernier) k.dernier = l.date;
    }
    const prod = String(l.r.produit || 'Autre').trim() || 'Autre';
    parProduit[prod] = (parProduit[prod] || 0) + l.net;
    if (l.brd) {
      const cle = `${l.cie}|${l.brd}`;
      const b = parBrd[cle] = parBrd[cle] || { brd: l.brd, cie: l.cie, total: 0, nb: 0, date: '', periode: '' };
      b.total += l.net; b.nb++; if (l.date > b.date) b.date = l.date; if (!b.periode) b.periode = ozxPeriode(l.r.type_mouvement);
    }
  });
  const moisDistincts = new Set(filtre.map(l => l.date.slice(0, 7))).size;
  const clients = Object.values(parClient).filter(l => Math.abs(l.total) > 0.004).sort((a, b) => b.ges - a.ges || b.total - a.total);
  // Export CSV (js/10) : mêmes lignes que le tableau affiché
  window._ozGestionClientRows = clients.map(l => ({ client: l.client, ges: l.ges, acq: l.acq, autre: l.autre, total: l.total }));
  window._ozGestionAnneeLabel = sel === 'tous' ? 'Toutes années' : sel;

  // Gestion récurrente : 12 mois glissants et projection de l'année en cours
  const derniereDate = lignes.reduce((m, l) => l.date > m ? l.date : m, '');
  let glissant12 = 0;
  if (derniereDate) {
    const d = new Date(derniereDate); d.setFullYear(d.getFullYear() - 1);
    const debut = ozxIso(d);
    lignes.forEach(l => { if (l.type === 'Gestion' && l.date > debut && l.date <= derniereDate) glissant12 += l.net; });
  }
  const anPrec = String(Number(anneeMax) - 1);
  const kMax = dernierMois[anneeMax] || 12;
  const gesYtd = parAn[anneeMax] ? parAn[anneeMax].Gestion : 0;
  const gesResteN1 = gesAnMois[anPrec] ? gesAnMois[anPrec].slice(kMax).reduce((s, v) => s + v, 0) : 0;
  const projection = estPartielle(anneeMax) ? { annee: anneeMax, ytd: gesYtd, reste: Math.max(0, gesResteN1), total: gesYtd + Math.max(0, gesResteN1), k: kMax } : null;
  const anneesCompletes = annees.filter(a => !estPartielle(a));
  const derniereComplete = anneesCompletes[anneesCompletes.length - 1] || null;

  // Rapprochement du grand livre de l'année civile en cours avec les commissions du CRM
  const anRapp = String(anneeCal);
  const imputees = new Set();
  (typeof allCommissionTranches !== 'undefined' ? allCommissionTranches : []).forEach(t => { const m = String(t.note || '').match(/\[oz:([0-9a-f-]{36})\]/i); if (m) imputees.add(m[1]); });
  const rappLignes = lignes.filter(l => l.an === anRapp && l.credit > 0);
  const rapp = { annee: anRapp, nb: rappLignes.length, nbOk: 0, montant: 0, montantOk: 0, restantes: [] };
  rappLignes.forEach(l => { rapp.montant += l.credit; if (imputees.has(l.r.id)) { rapp.nbOk++; rapp.montantOk += l.credit; } else rapp.restantes.push(l); });
  rapp.restantes.sort((a, b) => b.date.localeCompare(a.date));

  // Fusion 2027 : refacturation à OZ et gestion OZ qui bascule chez Assurex
  const dateFusion = ozxDateFusion();
  const ca = typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : [];
  const montantCa = x => Number(x.montant_final != null ? x.montant_final : (x.montant_estime || 0));
  const refac = typeof ozLignesRefacturation === 'function' ? ozLignesRefacturation(String(anneeCal)) : [];
  const versesOz = ca.filter(x => x.statut === 'versé_oz');
  const clientsOz = new Set((typeof allClients !== 'undefined' ? allClients : []).filter(c => c.source_oz).map(c => c.id));
  const bascule = ca.filter(x => x.nature === 'gestion' && !['annulée', 'annulé'].includes(x.statut) && String(x.date_creation || '').slice(0, 10) >= dateFusion && clientsOz.has(x.client_id));
  const basculeCies = {};
  bascule.forEach(x => { const k = ozxCie(x.compagnie); basculeCies[k] = (basculeCies[k] || 0) + Number(x.montant_estime || 0); });
  const fusion = {
    dateFusion,
    aRefacturer: refac.filter(l => !l.ca.refacture_le).reduce((s, l) => s + l.m, 0),
    nbARefacturer: refac.filter(l => !l.ca.refacture_le).length,
    dejaRefacture: refac.filter(l => l.ca.refacture_le).reduce((s, l) => s + l.m, 0),
    partsApporteurs: refac.filter(l => !l.ca.refacture_le).reduce((s, l) => s + (l.pA || 0), 0),
    versesOz: versesOz.reduce((s, x) => s + montantCa(x), 0), nbVersesOz: versesOz.length,
    bascule: bascule.reduce((s, x) => s + Number(x.montant_estime || 0), 0), nbBascule: bascule.length,
    clientsBascule: new Set(bascule.map(x => x.client_id)).size,
    basculeCies: Object.entries(basculeCies).sort((a, b) => b[1] - a[1]),
    gestionReference: derniereComplete ? parAn[derniereComplete].Gestion : 0, anneeReference: derniereComplete,
  };

  // Portefeuille (contrats_oz)
  const auj = new Date(aujIso);
  const dans365 = ozxIso(new Date(Date.now() + 365 * 864e5));
  const actifs = contrats.filter(c => !c.date_fin || String(c.date_fin).slice(0, 10) >= aujIso);
  const pf = { nb: contrats.length, nbActifs: actifs.length, volumeTotal: 0, volumeActif: 0, vie: 0, nonVie: 0, parProduit: {}, parCie: {}, sansPrime: 0 };
  contrats.forEach(c => { pf.volumeTotal += Number(c.prime_annuelle || 0); if (!Number(c.prime_annuelle || 0) && Number(c.prime || 0) > 0) pf.sansPrime++; });
  actifs.forEach(c => {
    const p = Number(c.prime_annuelle || 0); if (!p) return;
    pf.volumeActif += p;
    if (ozxEstVie(c.produit)) pf.vie += p; else pf.nonVie += p;
    const prod = String(c.produit || 'Autre').trim() || 'Autre';
    pf.parProduit[prod] = (pf.parProduit[prod] || 0) + p;
    const k = ozxCie(c.compagnie); pf.parCie[k] = (pf.parCie[k] || 0) + p;
  });
  pf.echeances = contrats.filter(c => { const d = String(c.date_fin || '').slice(0, 10); return d && d >= aujIso && d <= dans365; }).sort((a, b) => String(a.date_fin).localeCompare(String(b.date_fin)));
  const cm = {};
  contrats.forEach(c => {
    const k = c.client_nom || '—';
    const x = cm[k] = cm[k] || { nom: k, titre: c.titre_client, npa: c.npa, naissance: c.date_naissance, tel: c.tel_mobile || c.tel_perso, nb: 0, prime: 0 };
    x.nb++; x.prime += Number(c.prime_annuelle || 0);
  });
  pf.clients = Object.values(cm).sort((a, b) => b.prime - a.prime);

  return {
    lignes, annees, anneeMax, sel, filtre, parAn, parAnMois, dernierMois, estPartielle, comparer, tot, moisDistincts,
    parCie: Object.entries(parCie).sort((a, b) => b[1].total - a[1].total),
    clients, parProduit: Object.entries(parProduit).sort((a, b) => b[1] - a[1]),
    brds: Object.values(parBrd).sort((a, b) => b.date.localeCompare(a.date) || Number(b.brd) - Number(a.brd)),
    derniers: filtre.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    glissant12, projection, derniereComplete, rapp, fusion, pf, derniereDate, auj,
  };
}

// ── Composants graphiques (SVG inline) ──────────────────────────────────────────────────────
// Couleur d'une année : la plus récente en cyan, les précédentes dans des teintes plus calmes
function ozxCouleurAn(annees, a) {
  const i = annees.length - 1 - annees.indexOf(a);
  return `var(--ozx-an-${Math.min(i, 3)})`;
}
function ozxMaxJoli(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// Courbes mensuelles superposées par année (mensuel ou cumulé). Tracé en SVG étiré (non-scaling
// stroke), axes et bulles en HTML pour rester lisibles quelle que soit la largeur (iPhone compris).
function ozxCourbes(D) {
  const mode = window._ozxCourbe === 'mensuel' ? 'mensuel' : 'cumul';
  const series = D.annees.map(a => {
    const dern = D.estPartielle(a) ? (D.dernierMois[a] || 0) : 12;
    let cumul = 0;
    const vals = D.parAnMois[a].map((v, i) => { cumul += v; return i < dern ? (mode === 'cumul' ? cumul : v) : null; });
    return { a, vals, couleur: ozxCouleurAn(D.annees, a) };
  });
  const tous = series.flatMap(s => s.vals.filter(v => v !== null));
  const max = ozxMaxJoli(Math.max(1, ...tous));
  const min = Math.min(0, ...tous);
  const W = 1000, H = 300;
  const x = i => i / 11 * W;
  const y = v => H - ((v - min) / (max - min || 1)) * H;
  const actif = D.sel;
  const traces = series.map(s => {
    const pts = s.vals.map((v, i) => v === null ? null : [x(i), y(v)]).filter(Boolean);
    if (!pts.length) return '';
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const enAvant = actif === 'tous' ? s.a === D.anneeMax : s.a === actif;
    const aire = enAvant ? `<path d="${d} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z" style="fill:url(#ozx-degrade)"/>` : '';
    return `<g class="ozx-serie ${enAvant ? 'avant' : actif !== 'tous' ? 'estompe' : ''}" style="--c:${s.couleur}">${aire}<path class="ozx-trait" d="${d}" pathLength="1" vector-effect="non-scaling-stroke"/></g>`;
  });
  // L'année mise en avant est dessinée en dernier (au-dessus)
  const ordre = series.map((s, i) => ({ s, t: traces[i] })).sort((p, q) => {
    const av = s => (actif === 'tous' ? s.a === D.anneeMax : s.a === actif) ? 1 : 0;
    return av(p.s) - av(q.s);
  });
  const couleurAvant = ozxCouleurAn(D.annees, actif === 'tous' ? D.anneeMax : actif);
  const graduations = [0, 0.25, 0.5, 0.75, 1].map(f => min + (max - min) * f);
  const colonnes = OZX_MOIS.map((mNom, i) => {
    const lignesBulle = series.filter(s => s.vals[i] !== null).map(s => `<span><i style="background:${s.couleur}"></i>${s.a}<b>${ozxCHF(s.vals[i])}</b></span>`).join('');
    return `<div class="ozx-col" tabindex="0" style="--x:${(i / 11 * 100).toFixed(3)}%"><div class="ozx-bulle ${i > 7 ? 'gauche' : i < 3 ? 'droite' : ''}"><strong>${mNom}${mode === 'cumul' ? ' · cumul' : ''}</strong>${lignesBulle || '<span>—</span>'}</div></div>`;
  }).join('');
  return `<div class="ozx-courbes">
    <div class="ozx-axe-y">${graduations.map(g => `<span style="--y:${((g - min) / (max - min || 1) * 100).toFixed(2)}%">${ozxCompact(g)}</span>`).join('')}</div>
    <div class="ozx-trace">
      ${graduations.map(g => `<span class="ozx-grille" style="--y:${((g - min) / (max - min || 1) * 100).toFixed(2)}%"></span>`).join('')}
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="ozx-degrade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${couleurAvant};stop-opacity:.32"/><stop offset="1" style="stop-color:${couleurAvant};stop-opacity:0"/></linearGradient></defs>
        ${ordre.map(o => o.t).join('')}
      </svg>
      ${colonnes}
    </div>
    <div class="ozx-axe-x">${OZX_MOIS.map((m, i) => `<span style="--x:${(i / 11 * 100).toFixed(3)}%"><em class="long">${m}</em><em class="court">${OZX_MOIS_INIT[i]}</em></span>`).join('')}</div>
  </div>
  <div class="ozx-legende">${series.map(s => `<button type="button" class="${(actif === s.a) ? 'actif' : ''}" onclick="ozxChoisirAnnee('${s.a === actif ? 'tous' : s.a}')"><i style="background:${s.couleur}"></i>${s.a}${D.estPartielle(s.a) ? ` <small>à fin ${OZX_MOIS[(D.dernierMois[s.a] || 1) - 1]}</small>` : ''}</button>`).join('')}</div>`;
}

// Mini courbe blanche du bandeau : net mensuel continu du premier au dernier mois
function ozxSparkHero(D) {
  if (!D.annees.length) return '';
  const vals = [];
  D.annees.forEach(a => { const fin = D.estPartielle(a) ? (D.dernierMois[a] || 0) : 12; for (let i = 0; i < fin; i++) vals.push(D.parAnMois[a][i]); });
  if (vals.length < 2) return '';
  let c = 0; const cumul = vals.map(v => (c += v));
  const W = 400, H = 120, max = Math.max(1, ...cumul), min = Math.min(0, ...cumul);
  const pts = cumul.map((v, i) => [i / (cumul.length - 1) * W, H - 6 - (v - min) / (max - min || 1) * (H - 12)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return `<svg class="ozx-hero-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="ozx-hero-deg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#00CFFF" stop-opacity=".45"/><stop offset="1" stop-color="#00CFFF" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${W},${H} L0,${H} Z" fill="url(#ozx-hero-deg)"/>
    <path class="ozx-hero-trait" d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
  </svg>`;
}

// Barres empilées gestion / acquisition / autre par année (+ projection de la gestion en pointillé)
function ozxBarresTypes(D) {
  const items = D.annees.map(a => {
    const p = D.parAn[a];
    const g = Math.max(0, p.Gestion), q = Math.max(0, p.Acquisition), o = Math.max(0, p.Autre);
    const proj = D.projection && D.projection.annee === a ? D.projection.reste : 0;
    return { a, g, q, o, proj, total: p.total };
  });
  const max = Math.max(1, ...items.map(x => x.g + x.q + x.o + x.proj));
  return `<div class="ozx-piles">${items.map((x, i) => {
    const h = v => (v / max * 100).toFixed(2) + '%';
    const actif = D.sel === 'tous' || D.sel === x.a;
    return `<button type="button" class="ozx-pile ${actif ? '' : 'estompe'}" style="--i:${i}" onclick="ozxChoisirAnnee('${D.sel === x.a ? 'tous' : x.a}')" title="${x.a} — gestion ${ozxCHF(x.g)}, acquisition ${ozxCHF(x.q)}${x.o ? ', autre ' + ozxCHF(x.o) : ''}${x.proj ? ', projection gestion + ' + ozxCHF(x.proj) : ''}">
      <span class="ozx-pile-val">${ozxCompact(x.total)}${x.proj ? `<small>→ ${ozxCompact(x.total + x.proj)}</small>` : ''}</span>
      <span class="ozx-pile-col">
        ${x.proj ? `<span class="seg proj" style="height:${h(x.proj)}"></span>` : ''}
        ${x.o ? `<span class="seg autre" style="height:${h(x.o)}"></span>` : ''}
        <span class="seg acq" style="height:${h(x.q)}"></span>
        <span class="seg ges" style="height:${h(x.g)}"></span>
      </span>
      <span class="ozx-pile-an">${x.a}${D.estPartielle(x.a) ? '<small>en cours</small>' : ''}</span>
    </button>`;
  }).join('')}</div>
  <div class="ozx-legende-types"><span><i class="ges"></i>Gestion (récurrent)</span><span><i class="acq"></i>Acquisition (ponctuel)</span><span><i class="autre"></i>Autre</span>${D.projection ? '<span><i class="proj"></i>Projection gestion</span>' : ''}</div>`;
}

// Carte de chaleur année × mois
function ozxChaleur(D) {
  const max = Math.max(1, ...D.annees.flatMap(a => D.parAnMois[a].map(v => Math.abs(v))));
  return `<div class="ozx-chaleur" style="--n:${D.annees.length}">
    <span></span>${OZX_MOIS_INIT.map(m => `<span class="ozx-chaleur-m">${m}</span>`).join('')}
    ${D.annees.map(a => `<span class="ozx-chaleur-an">${a}</span>${D.parAnMois[a].map((v, i) => {
      const vide = D.estPartielle(a) && i >= (D.dernierMois[a] || 0);
      const f = Math.round(Math.sqrt(Math.abs(v) / max) * 100);
      return `<span class="ozx-cellule ${vide ? 'vide' : ''} ${v < 0 ? 'neg' : ''}" style="--f:${vide ? 0 : f}%" title="${OZX_MOIS[i]} ${a} : ${vide ? 'pas encore de décompte' : ozxCHF(v)}"></span>`;
    }).join('')}`).join('')}
  </div>`;
}

// Anneau de progression (taille fixe, reste net sur mobile)
function ozxAnneau(pct, taille, couleur, contenu) {
  const r = 42, C = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return `<div class="ozx-anneau" style="width:${taille}px;height:${taille}px">
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" class="fond"/>
      <circle cx="50" cy="50" r="${r}" class="val" style="stroke:${couleur};--dash:${(p / 100 * C).toFixed(1)};--tot:${C.toFixed(1)}" stroke-dasharray="${(p / 100 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
    <div class="ozx-anneau-centre">${contenu}</div></div>`;
}

// Donut vie / non-vie
function ozxDonut(parts, taille, centre) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.v), 0) || 1;
  const r = 40, C = 2 * Math.PI * r;
  let cumul = 0;
  const segs = parts.map(p => {
    const frac = Math.max(0, p.v) / total, dash = frac * C;
    const s = `<circle cx="50" cy="50" r="${r}" fill="none" style="stroke:${p.c}" stroke-width="13" stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}" stroke-dashoffset="${(-cumul * C).toFixed(2)}" transform="rotate(-90 50 50)"><title>${ozxEsc(p.l)} : ${ozxCHF(p.v)} (${Math.round(frac * 100)} %)</title></circle>`;
    cumul += frac; return s;
  }).join('');
  return `<div class="ozx-anneau ozx-donut" style="width:${taille}px;height:${taille}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" class="fond" style="stroke-width:13"/>${segs}</svg><div class="ozx-anneau-centre">${centre}</div></div>`;
}

// ── Rendu ───────────────────────────────────────────────────────────────────────────────────
function ozxRendre(calme) {
  const D = ozxCalculs();
  setTimeout(() => ozxApresRendu(calme), 0);
  if (!D.lignes.length && !window._ozxCache.contrats.length) {
    return `<div class="dbx ozx">${ozxEntete()}<section class="dbx-carte"><div class="dbx-vide"><strong>Aucune donnée OZ Assure</strong>Le grand livre (commissions_oz) et le portefeuille (contrats_oz) sont vides.</div></section></div>`;
  }
  const libellePeriode = D.sel === 'tous' ? (D.annees.length ? `${D.annees[0]} – ${D.annees[D.annees.length - 1]}` : '—') : `${D.sel}${D.estPartielle(D.sel) && D.dernierMois[D.sel] ? ` (jan.–${OZX_MOIS[D.dernierMois[D.sel] - 1]})` : ''}`;
  // Comparaisons affichées dans le bandeau
  const comps = (D.sel === 'tous' ? D.annees.slice(-2) : [D.sel]).map(a => {
    const c = D.comparer(a);
    return c && c.precedent ? `<span class="ozx-hero-comp"><b>${a}</b> ${ozxTendance(c.actuel, c.precedent)} <small>${c.libelle}</small></span>` : '';
  }).filter(Boolean).join('');
  const nbClients = D.clients.length;
  const partGestion = ozxPct(D.tot.Gestion, D.tot.Gestion + D.tot.Acquisition + Math.max(0, D.tot.Autre));
  const moyenne = D.moisDistincts ? D.tot.total / D.moisDistincts : 0;
  const serieMois = D.sel === 'tous'
    ? D.annees.flatMap(a => D.parAnMois[a].slice(0, D.estPartielle(a) ? (D.dernierMois[a] || 0) : 12))
    : D.parAnMois[D.sel].slice(0, D.estPartielle(D.sel) ? (D.dernierMois[D.sel] || 0) : 12);
  const serieType = type => {
    const src = D.sel === 'tous' ? D.annees : [D.sel];
    const res = [];
    src.forEach(a => { const arr = Array(12).fill(0); D.lignes.forEach(l => { if (l.an === a && l.type === type && l.m) arr[l.m - 1] += l.net; }); res.push(...arr.slice(0, D.estPartielle(a) ? (D.dernierMois[a] || 0) : 12)); });
    return res;
  };
  const spark = (vals, c) => vals.length > 1 && typeof dbxSparkline === 'function' ? dbxSparkline(vals, c) : '';

  return `<div class="dbx ozx ${calme ? 'dbx-calme' : ''}">
    <div class="oz-screen-only">
    ${ozxEntete()}

    <section class="ozx-hero dbx-anim" style="--i:0">
      <div class="ozx-hero-deco" aria-hidden="true"></div>
      ${ozxSparkHero(D)}
      <div class="ozx-hero-contenu">
        <div class="ozx-hero-marque">${typeof OZASSURE_LOGO_SVG !== 'undefined' ? OZASSURE_LOGO_SVG : '<b>OZ Assure</b>'}</div>
        <span class="ozx-hero-surtitre">Encaissé par OZ Assure · ${ozxEsc(libellePeriode)}</span>
        <div class="ozx-hero-montant"><small>CHF</small><span data-ozx-compteur="${Math.round(D.tot.total)}">${fmtCHF(Math.round(D.tot.total))}</span></div>
        <div class="ozx-hero-comps">${comps}</div>
        <div class="ozx-hero-faits">
          <span><b>${D.filtre.length}</b> mouvement${D.filtre.length > 1 ? 's' : ''}</span>
          <span><b>${nbClients}</b> client${nbClients > 1 ? 's' : ''}</span>
          <span><b>${D.parCie.length}</b> compagnie${D.parCie.length > 1 ? 's' : ''}</span>
          <span><b>${partGestion} %</b> récurrent</span>
        </div>
      </div>
    </section>

    <div class="ozx-filtre-barre">
      <div class="dbx-onglets ozx-filtre" role="tablist" aria-label="Filtrer par année">
        <button type="button" role="tab" aria-selected="${D.sel === 'tous'}" class="${D.sel === 'tous' ? 'actif' : ''}" onclick="ozxChoisirAnnee('tous')">Tous</button>
        ${D.annees.map(a => `<button type="button" role="tab" aria-selected="${D.sel === a}" class="${D.sel === a ? 'actif' : ''}" onclick="ozxChoisirAnnee('${a}')">${a}<small>${ozxCompact(D.parAn[a].total)}</small></button>`).join('')}
      </div>
    </div>

    <div class="dbx-kpis">
      ${dbxKpi({ label: 'Gestion (récurrent)', valeur: D.tot.Gestion, prefixe: 'CHF ', sous: `${ozxPct(D.tot.Gestion, D.tot.total)} % du total`, spark: spark(serieType('Gestion'), '#22C55E'), i: 1 })}
      ${dbxKpi({ label: 'Acquisition (ponctuel)', valeur: D.tot.Acquisition, prefixe: 'CHF ', sous: `${ozxPct(D.tot.Acquisition, D.tot.total)} % du total`, spark: spark(serieType('Acquisition'), '#5B82C9'), i: 2 })}
      ${dbxKpi({ label: 'Moyenne mensuelle', valeur: moyenne, prefixe: 'CHF ', sous: `sur ${D.moisDistincts} mois avec mouvements`, spark: spark(serieMois, '#00CFFF'), i: 3 })}
      ${dbxKpi({ label: 'Volume de primes actif', valeur: D.pf.volumeActif, prefixe: 'CHF ', sous: `${D.pf.nbActifs} contrat${D.pf.nbActifs > 1 ? 's' : ''} actifs · ${D.pf.clients.length} clients`, onclick: "document.getElementById('ozx-portefeuille').scrollIntoView({behavior:'smooth'})", i: 4 })}
    </div>

    <div class="dbx-carte ozx-bandeau dbx-anim" style="--i:5">
      <span class="ozx-bandeau-icone">⚑</span>
      <span>Depuis le <b>01.06.2026</b>, le portefeuille OZ Assure est <b>virtuellement transféré à Assurex Sàrl</b> ; fusion complète le <b>${fmtDate(D.fusion.dateFusion)}</b>. Cette page est l’archive d’exploitation d’OZ et le suivi de la transition.</span>
    </div>

    <div class="ozx-grille ozx-grille-large">
      <section class="dbx-carte dbx-anim" style="--i:6">
        <header class="dbx-carte-tete"><h2>Rythme d’encaissement</h2>
          <div class="ozx-segment" role="group" aria-label="Type de courbe">
            <button type="button" class="${window._ozxCourbe !== 'mensuel' ? 'actif' : ''}" onclick="ozxChoisirCourbe('cumul')">Cumulé</button>
            <button type="button" class="${window._ozxCourbe === 'mensuel' ? 'actif' : ''}" onclick="ozxChoisirCourbe('mensuel')">Mensuel</button>
          </div></header>
        <p class="ozx-aide">Années superposées mois par mois : ${window._ozxCourbe === 'mensuel' ? 'net encaissé chaque mois' : 'cumul depuis janvier — l’écart entre les courbes montre l’avance ou le retard sur l’année précédente'}. Touchez un mois pour le détail.</p>
        ${D.annees.length ? ozxCourbes(D) : '<div class="dbx-vide-petit">Aucun mouvement.</div>'}
      </section>
      <section class="dbx-carte dbx-anim" style="--i:7">
        <header class="dbx-carte-tete"><h2>Acquisition vs gestion</h2><span class="dbx-carte-sous">par année</span></header>
        ${D.annees.length ? ozxBarresTypes(D) : '<div class="dbx-vide-petit">—</div>'}
        ${D.projection ? `<div class="ozx-projection">
          <div><span>Gestion ${D.projection.annee} à fin ${OZX_MOIS[D.projection.k - 1]}</span><b>${ozxCHF(D.projection.ytd)}</b></div>
          <div><span>Projection fin ${D.projection.annee}</span><b class="ozx-vert">${ozxCHF(D.projection.total)}</b></div>
          <div><span>Gestion 12 mois glissants</span><b>${ozxCHF(D.glissant12)}</b></div>
          <p>Projection = gestion déjà encaissée + gestion reçue sur les mois restants de ${Number(D.projection.annee) - 1} (même calendrier de versement des compagnies).</p>
        </div>` : ''}
      </section>
    </div>

    <div class="ozx-grille">
      <section class="dbx-carte dbx-anim" style="--i:8">
        <header class="dbx-carte-tete"><h2>Par compagnie</h2><span class="dbx-carte-sous">${ozxEsc(libellePeriode)}</span></header>
        ${ozxCompagnies(D)}
      </section>
      <section class="dbx-carte dbx-anim" style="--i:9">
        <header class="dbx-carte-tete"><h2>Top clients</h2><span class="dbx-carte-sous">gestion + acquisition</span></header>
        ${ozxTopClients(D)}
      </section>
    </div>

    <div class="ozx-grille ozx-grille-large">
      <section class="dbx-carte dbx-anim" style="--i:10">
        <header class="dbx-carte-tete"><h2>Dernière activité</h2><span class="dbx-carte-sous">derniers mouvements du compte courant</span></header>
        ${D.brds.length ? `<div class="ozx-brds" aria-label="Décomptes BRD">${D.brds.slice(0, 10).map(b => `<div class="ozx-brd-carte">
          ${pictoCompagnie(b.cie, 26)}<span><b>BRD ${ozxEsc(b.brd)}</b><small>${ozxEsc(b.periode || fmtDate(b.date))}</small></span><em>${ozxCompact(b.total)}</em></div>`).join('')}</div>` : ''}
        ${ozxDerniers(D)}
      </section>
      <section class="dbx-carte dbx-anim" style="--i:11">
        <header class="dbx-carte-tete"><h2>Carte de chaleur</h2><span class="dbx-carte-sous">net par mois</span></header>
        ${D.annees.length ? ozxChaleur(D) : '<div class="dbx-vide-petit">—</div>'}
        <div class="ozx-mix">
          <div><span>Vie & prévoyance</span><b>${ozxCHF(D.tot.vie)}</b><i style="--w:${ozxPct(Math.max(0, D.tot.vie), Math.max(0, D.tot.vie) + Math.max(0, D.tot.nonVie))}%;background:var(--ozx-vie)"></i></div>
          <div><span>Non-vie / IARD</span><b>${ozxCHF(D.tot.nonVie)}</b><i style="--w:${ozxPct(Math.max(0, D.tot.nonVie), Math.max(0, D.tot.vie) + Math.max(0, D.tot.nonVie))}%;background:var(--ozx-nonvie)"></i></div>
        </div>
        ${D.parProduit.length ? `<details class="ozx-details"><summary>Commissions par produit (${D.parProduit.length})</summary>
          <div class="sfx-mini">${D.parProduit.map(([p, v]) => `<div><span><b>${ozxEsc(p)}</b></span><em>${ozxCHF(v)}</em></div>`).join('')}</div></details>` : ''}
      </section>
    </div>

    ${ozxSectionFusion(D)}

    ${ozxSectionClients(D)}

    ${ozxSectionPortefeuille(D)}
    </div>
    ${ozxRapportImprimable(D, libellePeriode)}
  </div>`;
}

function ozxEntete() {
  return `<header class="dx-tete">
    <div><div class="dx-surtitre">Archive & transition · 2024 → 2027</div><h2>OZ Assure</h2></div>
    <div class="dx-tete-actions">
      <button type="button" class="btn-secondary" onclick="navigate('oz-commissions-assurex')">💼 Commissions Assurex versées à OZ</button>
      <button type="button" class="btn-secondary" onclick="navigate('rapport-finma-oz')">📋 Recensement FINMA</button>
      <button type="button" class="btn-secondary" onclick="window._sfxOnglet='oz';navigate('suivi-financier')">🔹 Cockpit OZ ↔ Assurex</button>
      <button type="button" class="btn-secondary" onclick="window.print()">🖨️ Imprimer / PDF</button>
    </div>
  </header>`;
}

function ozxCompagnies(D) {
  if (!D.parCie.length) return '<div class="dbx-vide-petit">Aucune commission.</div>';
  const max = Math.max(1, ...D.parCie.map(([, x]) => x.total));
  const total = D.parCie.reduce((s, [, x]) => s + Math.max(0, x.total), 0) || 1;
  return `<div class="dbx-hbarres ozx-cies">${D.parCie.slice(0, 9).map(([cie, x], i) => `<div class="dbx-hbarre" style="--i:${i}">
    <span class="dbx-hbarre-nom">${pictoCompagnie(cie, 26)}<span>${ozxEsc(cie)}</span></span>
    <span class="dbx-hbarre-piste ozx-piste-duo"><span style="--w:${Math.max(0, Math.round(x.total / max * 100))}%"><i style="width:${ozxPct(Math.max(0, x.Gestion), Math.max(0, x.Gestion) + Math.max(0, x.Acquisition)) || 0}%"></i></span></span>
    <span class="dbx-hbarre-val">${ozxCompact(x.total)}<small>${ozxPct(Math.max(0, x.total), total)} % · ${x.nb} mvt</small></span></div>`).join('')}</div>
    ${D.parCie.length > 9 ? `<div class="ozx-aide" style="margin-top:10px">+ ${D.parCie.length - 9} autre${D.parCie.length - 9 > 1 ? 's' : ''} compagnie${D.parCie.length - 9 > 1 ? 's' : ''} : ${ozxCHF(D.parCie.slice(9).reduce((s, [, x]) => s + x.total, 0))}</div>` : ''}
    <div class="ozx-legende-types" style="margin-top:12px"><span><i class="ges"></i>part gestion</span><span><i class="acq"></i>part acquisition</span></div>`;
}

function ozxLienClient(nom) {
  const c = ozxClientCrm(nom);
  return c ? `<button type="button" class="ozx-lien-client" onclick="showClient('${c.id}')">${ozxEsc(nom)}</button>` : `<span>${ozxEsc(nom)}</span>`;
}

function ozxTopClients(D) {
  const top = D.clients.slice().sort((a, b) => b.total - a.total).slice(0, 8);
  if (!top.length) return '<div class="dbx-vide-petit">Aucun client.</div>';
  const max = Math.max(1, ...top.map(c => c.total));
  return `<ol class="ozx-top">${top.map((c, i) => `<li style="--i:${i}">
    <span class="ozx-rang ${i < 3 ? 'podium' : ''}">${i + 1}</span>
    <span class="ozx-top-corps"><b>${ozxLienClient(c.client)}</b>
      <span class="ozx-top-barre" style="--w:${Math.max(3, Math.round(Math.max(0, c.total) / max * 100))}%"><i class="ges" style="flex:${Math.max(0, c.ges)}"></i><i class="acq" style="flex:${Math.max(0, c.acq)}"></i><i class="autre" style="flex:${Math.max(0, c.autre)}"></i></span>
      <small>${[...c.cies].slice(0, 3).map(ozxEsc).join(' · ')}</small></span>
    <em>${ozxCompact(c.total)}</em></li>`).join('')}</ol>`;
}

function ozxDerniers(D) {
  if (!D.derniers.length) return '<div class="dbx-vide-petit">Aucun mouvement.</div>';
  return `<div class="sfx-liste ozx-mvts">${D.derniers.map(l => `<div class="sfx-ligne ozx-mvt">
    <span class="sfx-logo">${pictoCompagnie(l.cie, 30)}</span>
    <span class="sfx-corps"><b>${ozxEsc(l.client || l.cie)}</b><small>${ozxEsc([l.r.produit, l.r.police ? 'police ' + l.r.police : ''].filter(Boolean).join(' · '))}</small>
      <span class="ozx-chips"><span class="ozx-chip ${l.type === 'Gestion' ? 'ges' : l.type === 'Acquisition' ? 'acq' : ''}">${l.type}</span>${l.brd ? `<span class="ozx-chip brd">BRD ${ozxEsc(l.brd)}</span>` : ''}${ozxPeriode(l.r.type_mouvement) ? `<span class="ozx-chip">${ozxEsc(ozxPeriode(l.r.type_mouvement))}</span>` : ''}</span></span>
    <span class="ozx-mvt-droite"><span class="sfx-montant ${l.net < 0 ? 'ozx-neg' : ''}">${l.net < 0 ? '− ' : ''}CHF ${fmtCHF2(Math.abs(l.net))}</span><small>${fmtDate(l.date)}</small></span>
  </div>`).join('')}</div>`;
}

function ozxSectionFusion(D) {
  const F = D.fusion, R = D.rapp;
  const debut = new Date('2026-06-01'), fin = new Date(F.dateFusion), auj = new Date();
  const progres = Math.max(0, Math.min(100, (auj - debut) / (fin - debut) * 100));
  const jours = Math.ceil((fin - auj) / 864e5);
  const pctRapp = R.nb ? Math.round(R.nbOk / R.nb * 100) : 100;
  return `<section class="ozx-fusion dbx-anim" style="--i:12">
    <header class="ozx-fusion-tete">
      <div><span class="dx-surtitre">Transition</span><h2>Fusion ${fin.getFullYear()}</h2></div>
      <div class="ozx-compte-rebours">${jours > 0 ? `<b data-ozx-compteur="${jours}">${jours}</b><span>jour${jours > 1 ? 's' : ''} avant la fusion complète</span>` : '<b>✓</b><span>Fusion complète effective</span>'}</div>
    </header>
    <div class="ozx-frise" style="--p:${progres.toFixed(1)}%">
      <div class="ozx-frise-piste"><span></span></div>
      <div class="ozx-frise-etapes">
        <div class="fait"><i></i><b>01.06.2026</b><small>Portefeuille transféré virtuellement à Assurex</small></div>
        <div class="encours" style="--x:${progres.toFixed(1)}%"><i></i><b>Aujourd’hui</b><small>Refacturation et rapprochement</small></div>
        <div class="${jours > 0 ? '' : 'fait'}"><i></i><b>${fmtDate(F.dateFusion)}</b><small>Gestion encaissée par Assurex</small></div>
      </div>
    </div>
    <div class="ozx-fusion-grille">
      <div class="dbx-carte ozx-f-carte">
        <span class="ozx-f-label">À refacturer à OZ · ${new Date().getFullYear()}</span>
        <b class="ozx-f-valeur">CHF <span data-ozx-compteur="${Math.round(F.aRefacturer)}">${fmtCHF(Math.round(F.aRefacturer))}</span></b>
        <small>${F.nbARefacturer} commission${F.nbARefacturer > 1 ? 's' : ''}${F.partsApporteurs ? ` · dont parts apporteurs ${ozxCHF(F.partsApporteurs)}` : ''}</small>
        <small>Déjà refacturé : <b>${ozxCHF(F.dejaRefacture)}</b></small>
        <button type="button" class="dbx-lien" onclick="window._sfxOnglet='oz';navigate('suivi-financier')">Préparer la refacturation →</button>
      </div>
      <div class="dbx-carte ozx-f-carte">
        <span class="ozx-f-label">Gestion OZ qui bascule chez Assurex</span>
        <b class="ozx-f-valeur ozx-vert">CHF <span data-ozx-compteur="${Math.round(F.bascule)}">${fmtCHF(Math.round(F.bascule))}</span></b>
        <small>${F.nbBascule} commission${F.nbBascule > 1 ? 's' : ''} de gestion dès le ${fmtDate(F.dateFusion)} · ${F.clientsBascule} client${F.clientsBascule > 1 ? 's' : ''} OZ</small>
        ${F.basculeCies.length ? `<span class="ozx-f-cies">${F.basculeCies.slice(0, 5).map(([c, v]) => `<span title="${ozxEsc(c)} : ${ozxCHF(v)}">${pictoCompagnie(c, 22)}<em>${ozxCompact(v)}</em></span>`).join('')}</span>` : ''}
        ${F.anneeReference ? `<small>Référence : gestion encaissée par OZ en ${F.anneeReference} = <b>${ozxCHF(F.gestionReference)}</b></small>` : ''}
      </div>
      <div class="dbx-carte ozx-f-carte ozx-f-rapp">
        <div class="ozx-f-rapp-haut">
          ${ozxAnneau(pctRapp, 92, pctRapp >= 90 ? 'var(--ozx-ges)' : pctRapp >= 50 ? '#F59E0B' : '#EF4444', `<b>${pctRapp}%</b><small>rapproché</small>`)}
          <div><span class="ozx-f-label">Rapprochement du compte courant ${R.annee}</span>
            <small><b>${R.nbOk}</b> / ${R.nb} versement${R.nb > 1 ? 's' : ''} déduit${R.nbOk > 1 ? 's' : ''} des commissions attendues (${ozxCHF(R.montantOk)} sur ${ozxCHF(R.montant)})</small>
            ${R.restantes.length ? `<small class="ozx-attention">${R.restantes.length} versement${R.restantes.length > 1 ? 's' : ''} à rapprocher · ${ozxCHF(R.montant - R.montantOk)}</small>` : '<small class="ozx-vert">✓ Tout est rapproché</small>'}</div>
        </div>
        ${R.restantes.length ? `<div class="sfx-mini">${R.restantes.slice(0, 3).map(l => `<div><span>${pictoCompagnie(l.cie, 18)}<b>${ozxEsc(l.client || l.cie)}</b>${l.brd ? `<span class="ozx-chip brd">BRD ${ozxEsc(l.brd)}</span>` : ''}</span><em>${ozxCompact(l.credit)}</em></div>`).join('')}</div>` : ''}
        <button type="button" class="btn-save ozx-f-bouton" onclick="window._sfxOnglet='oz';navigate('suivi-financier')">Déduire des commissions attendues →</button>
      </div>
    </div>
    ${F.nbVersesOz ? `<div class="ozx-aide ozx-fusion-note">🔹 ${F.nbVersesOz} commission${F.nbVersesOz > 1 ? 's' : ''} du CRM marquée${F.nbVersesOz > 1 ? 's' : ''} « versée à OZ » pour ${ozxCHF(F.versesOz)} au total — <button type="button" class="dbx-lien" onclick="navigate('oz-commissions-assurex')">voir le détail</button></div>` : ''}
  </section>`;
}

function ozxSectionClients(D) {
  const lignes = D.clients;
  const tous = window._ozxClientsTous;
  return `<section class="dbx-carte ozx-clients dbx-anim" style="--i:13">
    <header class="dbx-carte-tete"><h2>Gestion & acquisition par client <span class="ozx-compte">${lignes.length}</span></h2>
      <span class="dx-tete-actions"><button type="button" class="btn-secondary" onclick="exporterOzGestionClientCsv()">📊 Exporter CSV</button></span></header>
    <p class="ozx-aide">${D.sel === 'tous' ? 'Toutes années' : D.sel + (D.estPartielle(D.sel) ? ' (année en cours)' : ' (année complète)')} — trié par gestion décroissante : c’est la valeur récurrente que chaque client apporte au portefeuille. Le filtre année ci-dessus s’applique aussi à l’export.</p>
    <div class="ozx-recherche"><span aria-hidden="true">⌕</span><input type="search" placeholder="Rechercher un client…" aria-label="Rechercher un client" oninput="ozxFiltrerClients(this.value)"/></div>
    <div class="ozx-table" role="table">
      <div class="ozx-tr ozx-th" role="row"><span role="columnheader">Client</span><span role="columnheader">Gestion</span><span role="columnheader">Acquisition</span><span role="columnheader">Total</span></div>
      ${lignes.map((l, i) => `<div class="ozx-tr" role="row" data-nom="${ozxEsc(l.client.toLowerCase())}" ${!tous && i >= OZX_LIMITE_CLIENTS ? 'hidden' : ''}>
        <span class="ozx-td-nom" role="cell"><b>${ozxLienClient(l.client)}</b><small>${[...l.cies].map(ozxEsc).join(' · ')} · ${l.nb} mvt</small></span>
        <span class="ozx-td ozx-vert" role="cell" data-l="Gestion">${l.ges ? ozxCHF(l.ges) : '—'}</span>
        <span class="ozx-td ozx-bleu" role="cell" data-l="Acquisition">${l.acq ? ozxCHF(l.acq) : '—'}</span>
        <span class="ozx-td ozx-fort" role="cell" data-l="Total">${ozxCHF(l.total)}</span>
      </div>`).join('')}
      <div class="dbx-vide-petit" id="ozx-clients-vide" ${lignes.length ? 'hidden' : ''}>Aucun client pour cette période.</div>
    </div>
    ${lignes.length > OZX_LIMITE_CLIENTS ? `<button type="button" class="ozx-plus" id="ozx-clients-plus" ${tous ? 'hidden' : ''} onclick="ozxAfficherTousClients()">Afficher les ${lignes.length} clients</button>` : ''}
  </section>`;
}

function ozxSectionPortefeuille(D) {
  const P = D.pf;
  const produits = Object.entries(P.parProduit).sort((a, b) => b[1] - a[1]);
  const cies = Object.entries(P.parCie).sort((a, b) => b[1] - a[1]);
  const maxP = Math.max(1, ...produits.map(([, v]) => v));
  const maxC = Math.max(1, ...cies.map(([, v]) => v));
  const auj = new Date();
  return `<section id="ozx-portefeuille" class="ozx-portefeuille">
    <header class="dx-tete" style="margin-top:8px"><div><div class="dx-surtitre">Portefeuille OZ</div><h2>Contrats & volume de primes</h2></div></header>
    <div class="ozx-pf-kpis">
      <div class="dbx-carte"><span>Volume actif</span><b>${ozxCHF(P.volumeActif)}</b><small>${P.nbActifs} contrats actifs</small></div>
      <div class="dbx-carte"><span>Volume total</span><b>${ozxCHF(P.volumeTotal)}</b><small>${P.nb} contrats</small></div>
      <div class="dbx-carte"><span>Clients</span><b>${P.clients.length}</b><small>au portefeuille</small></div>
      <div class="dbx-carte"><span>Échéances 12 mois</span><b>${P.echeances.length}</b><small>${ozxCHF(P.echeances.reduce((s, c) => s + Number(c.prime_annuelle || 0), 0))} de primes</small></div>
    </div>
    ${P.sansPrime ? `<div class="ozx-aide" style="margin:-4px 0 14px">ℹ️ ${P.sansPrime} contrat${P.sansPrime > 1 ? 's' : ''} (principalement LAMal) sans prime annuelle renseignée — hors volume de primes.</div>` : ''}
    <div class="ozx-grille">
      <section class="dbx-carte">
        <header class="dbx-carte-tete"><h2>Vie / non-vie</h2><span class="dbx-carte-sous">primes des contrats actifs</span></header>
        <div class="ozx-vnv">
          ${ozxDonut([{ l: 'Vie & prévoyance', v: P.vie, c: 'var(--ozx-vie)' }, { l: 'Non-vie / IARD', v: P.nonVie, c: 'var(--ozx-nonvie)' }], 150, `<b>${ozxCompact(P.volumeActif)}</b><small>CHF / an</small>`)}
          <div class="ozx-vnv-leg">
            <div><i style="background:var(--ozx-vie)"></i><span>Vie & prévoyance<b>${ozxCHF(P.vie)}</b><small>${ozxPct(P.vie, P.volumeActif)} % du volume actif</small></span></div>
            <div><i style="background:var(--ozx-nonvie)"></i><span>Non-vie / IARD<b>${ozxCHF(P.nonVie)}</b><small>${ozxPct(P.nonVie, P.volumeActif)} % du volume actif</small></span></div>
          </div>
        </div>
        ${produits.length ? `<div class="dbx-hbarres" style="margin-top:16px">${produits.slice(0, 8).map(([p, v], i) => `<div class="dbx-hbarre" style="--i:${i}">
          <span class="dbx-hbarre-nom"><span class="dbx-point" style="background:${ozxEstVie(p) ? 'var(--ozx-vie)' : 'var(--ozx-nonvie)'}"></span><span>${ozxEsc(p)}</span></span>
          <span class="dbx-hbarre-piste"><span style="--w:${Math.round(v / maxP * 100)}%;background:${ozxEstVie(p) ? 'var(--ozx-vie)' : 'var(--ozx-nonvie)'}"></span></span>
          <span class="dbx-hbarre-val">${ozxCompact(v)}</span></div>`).join('')}</div>` : ''}
      </section>
      <section class="dbx-carte">
        <header class="dbx-carte-tete"><h2>Volume par compagnie</h2><span class="dbx-carte-sous">contrats actifs</span></header>
        ${cies.length ? `<div class="dbx-hbarres">${cies.slice(0, 8).map(([c, v], i) => `<div class="dbx-hbarre" style="--i:${i}">
          <span class="dbx-hbarre-nom">${pictoCompagnie(c, 24)}<span>${ozxEsc(c)}</span></span>
          <span class="dbx-hbarre-piste"><span style="--w:${Math.round(v / maxC * 100)}%"></span></span>
          <span class="dbx-hbarre-val">${ozxCompact(v)}<small>${ozxPct(v, P.volumeActif)} %</small></span></div>`).join('')}</div>` : '<div class="dbx-vide-petit">Aucun contrat actif avec prime.</div>'}
        <header class="dbx-carte-tete" style="margin-top:20px"><h2>Échéances à venir</h2><span class="dbx-carte-sous">12 prochains mois</span></header>
        ${P.echeances.length ? `<div class="sfx-liste">${P.echeances.slice(0, 8).map(c => {
          const j = Math.round((new Date(c.date_fin) - auj) / 864e5);
          return `<div class="sfx-ligne ozx-ech"><span class="sfx-logo">${pictoCompagnie(ozxCie(c.compagnie), 28)}</span>
            <span class="sfx-corps"><b>${ozxEsc(c.client_nom || '—')}</b><small>${ozxEsc(c.produit || '')}${c.prime_annuelle ? ' · ' + ozxCHF(c.prime_annuelle) + ' / an' : ''}</small></span>
            <span class="ozx-ech-date ${j <= 60 ? 'proche' : ''}"><b>${fmtDate(c.date_fin)}</b><small>dans ${j} j</small></span></div>`;
        }).join('')}</div>${P.echeances.length > 8 ? `<div class="ozx-aide" style="margin-top:8px">+ ${P.echeances.length - 8} autre${P.echeances.length - 8 > 1 ? 's' : ''} échéance${P.echeances.length - 8 > 1 ? 's' : ''}</div>` : ''}` : '<div class="dbx-vide-petit">Aucune échéance dans les 12 prochains mois.</div>'}
      </section>
    </div>
    <details class="dbx-carte ozx-details ozx-donnees">
      <summary>Données clients du portefeuille (${P.clients.length})</summary>
      <div class="ozx-table ozx-table-donnees" role="table">
        <div class="ozx-tr ozx-th" role="row"><span>Client</span><span>NPA</span><span>Né(e) le</span><span>Téléphone</span><span>Contrats</span><span>Prime / an</span></div>
        ${P.clients.map(c => `<div class="ozx-tr" role="row">
          <span class="ozx-td-nom"><b>${ozxEsc((c.titre ? c.titre + ' ' : '') + c.nom)}</b></span>
          <span class="ozx-td" data-l="NPA">${ozxEsc(c.npa || '—')}</span>
          <span class="ozx-td" data-l="Né(e) le">${c.naissance ? fmtDate(c.naissance) : '—'}</span>
          <span class="ozx-td" data-l="Téléphone">${ozxEsc(c.tel || '—')}</span>
          <span class="ozx-td" data-l="Contrats">${c.nb}</span>
          <span class="ozx-td ozx-fort" data-l="Prime / an">${c.prime ? ozxCHF(c.prime) : '—'}</span></div>`).join('')}
      </div>
    </details>
  </section>`;
}

// Résumé imprimable (masqué à l'écran, affiché par @media print via .oz-print-report)
function ozxRapportImprimable(D, libellePeriode) {
  const td = 'border:1px solid #ccc;padding:5px 8px';
  const th = td + ';background:#f0f0f0;text-align:left;font-size:11px';
  return `<div class="oz-print-report">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:20px;font-weight:900;color:black">OZ ASSURE — Résumé d'exploitation</div>
      <div style="font-size:12px;color:#555;margin-top:4px">Période : ${ozxEsc(libellePeriode)} · rapport généré le ${new Date().toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      <div style="font-size:11px;color:#888;margin-top:2px">Portefeuille virtuellement transféré à Assurex Sàrl depuis le 01.06.2026 · fusion complète le ${fmtDate(D.fusion.dateFusion)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px"><tr>
      <td style="${td}"><div style="font-size:9px;color:#666">COMMISSIONS NETTES</div><b>${ozxCHF(D.tot.total)}</b></td>
      <td style="${td}"><div style="font-size:9px;color:#666">GESTION</div><b>${ozxCHF(D.tot.Gestion)}</b></td>
      <td style="${td}"><div style="font-size:9px;color:#666">ACQUISITION</div><b>${ozxCHF(D.tot.Acquisition)}</b></td>
      <td style="${td}"><div style="font-size:9px;color:#666">VOLUME PRIMES ACTIF</div><b>${ozxCHF(D.pf.volumeActif)}</b></td>
    </tr></table>
    <div style="font-size:13px;font-weight:800;margin-bottom:6px">Par année</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px"><thead><tr><th style="${th}">Année</th><th style="${th}">Gestion</th><th style="${th}">Acquisition</th><th style="${th}">Autre</th><th style="${th}">Total</th><th style="${th}">Statut</th></tr></thead>
      <tbody>${D.annees.map(a => { const p = D.parAn[a]; return `<tr><td style="${td}">${a}</td><td style="${td};text-align:right">${ozxCHF(p.Gestion)}</td><td style="${td};text-align:right">${ozxCHF(p.Acquisition)}</td><td style="${td};text-align:right">${ozxCHF(p.Autre)}</td><td style="${td};text-align:right;font-weight:700">${ozxCHF(p.total)}</td><td style="${td}">${D.estPartielle(a) ? 'En cours' : 'Complète'}</td></tr>`; }).join('')}</tbody></table>
    <div style="font-size:13px;font-weight:800;margin-bottom:6px">Par compagnie</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px"><tbody>${D.parCie.map(([c, x]) => `<tr><td style="${td}">${ozxEsc(c)}</td><td style="${td};text-align:right">${ozxCHF(x.total)}</td></tr>`).join('')}</tbody></table>
    <div style="font-size:13px;font-weight:800;margin-bottom:6px">Gestion & acquisition par client</div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px"><thead><tr><th style="${th}">Client</th><th style="${th}">Gestion</th><th style="${th}">Acquisition</th><th style="${th}">Total</th></tr></thead>
      <tbody>${D.clients.map(l => `<tr><td style="${td}">${ozxEsc(l.client)}</td><td style="${td};text-align:right">${l.ges ? ozxCHF(l.ges) : '—'}</td><td style="${td};text-align:right">${l.acq ? ozxCHF(l.acq) : '—'}</td><td style="${td};text-align:right">${ozxCHF(l.total)}</td></tr>`).join('')}</tbody></table>
  </div>`;
}

// ── Après affichage : compteurs animés (sauf réaffichage « calme » ou mouvement réduit) ──────
function ozxApresRendu(calme) {
  if (!document.querySelector('.ozx')) return;
  const reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduit || calme) return;
  document.querySelectorAll('.ozx [data-ozx-compteur], .ozx [data-dbx-compteur]').forEach(el => {
    const cible = Number(el.dataset.ozxCompteur ?? el.dataset.dbxCompteur) || 0;
    const prefixe = el.dataset.prefixe || '', suffixe = el.dataset.suffixe || '';
    const debut = performance.now(), duree = 1000;
    const pas = t => {
      const p = Math.min(1, (t - debut) / duree), e = 1 - Math.pow(1 - p, 3);
      el.textContent = prefixe + fmtCHF(Math.round(cible * e)) + suffixe;
      if (p < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  });
}
