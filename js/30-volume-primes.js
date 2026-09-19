// ═══ VOLUME DE PRIMES MODERNISÉ (19.09.2026) ═══════════════════════════════════════════════
// Remplace l'affichage de js/04 (mêmes données, même filtre par branche FINMA) : indicateurs,
// anneau par compagnie avec logos, meilleurs clients, Vie / non-vie et privé / entreprise en
// barres empilées, catégories de produits, top produits. Nouveau : filtre du portefeuille
// Tous / Assurex / OZ Assure (clients marqués OZ).

window._vpxPortefeuille = window._vpxPortefeuille || 'tous';
const VPX_PALETTE = ['#00CFFF', '#113679', '#5B82C9', '#F59E0B', '#22C55E', '#A78BFA', '#EF4444', '#14B8A6', '#FB923C', '#94A3B8'];

function vpxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function viewVolumePrimes() {
  const contrats = await dbGet('contrats', `statut=neq.${encodeURIComponent('résilié')}&statut=neq.${encodeURIComponent('annulé')}&statut=neq.mandat_resilie&select=*`);
  const clientsMap = {};
  (allClients || []).forEach(c => clientsMap[c.id] = c);
  window._volumePrimesContratsBruts = contrats || [];
  window._volumePrimesClientsMap = clientsMap;
  const choix = [['tous', 'Tout le portefeuille'], ['assurex', 'Assurex'], ['oz', 'OZ Assure']];
  return `<div class="dbx vpx">
    <header class="dx-tete">
      <div><div class="dx-surtitre">Clients</div><h2>Volume de primes</h2></div>
      <div class="dbx-onglets" role="tablist" style="margin:0">${choix.map(([id, l]) => `<button type="button" role="tab" aria-selected="${window._vpxPortefeuille === id}" class="${window._vpxPortefeuille === id ? 'actif' : ''}" onclick="window._vpxPortefeuille='${id}';document.querySelectorAll('.vpx .dbx-onglets button').forEach(b=>b.classList.toggle('actif',b===this));filtrerVolumePrimes()">${l}</button>`).join('')}</div>
    </header>
    <details class="vpx-filtre">
      <summary>Filtrer par branche <span id="vpx-nb-branches"></span></summary>
      <div class="dx-pastilles" style="margin-top:10px">
        ${BRANCHES_FINMA.map(b => `<label class="dx-ck"><input type="checkbox" class="vp-branche-checkbox" data-branche="${b.code}" checked onchange="filtrerVolumePrimes()"/><span>${vpxEsc(b.label)}</span></label>`).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:6px"><button type="button" class="dbx-lien" onclick="toutCocherVolumePrimes(true)">Tout cocher</button><button type="button" class="dbx-lien" onclick="toutCocherVolumePrimes(false)">Tout décocher</button></div>
    </details>
    <div id="volume-primes-corps">${renderVolumePrimesCorps(contrats || [], clientsMap)}</div>
  </div>`;
}

function renderVolumePrimesCorps(contrats, clientsMap) {
  const mode = window._vpxPortefeuille || 'tous';
  const estOZ = ct => { const c = clientsMap[ct.client_id]; return !!(c && c.source_oz); };
  const liste = (contrats || []).filter(ct => Number(ct.prime_annuelle || 0) > 0 && (mode === 'tous' || (mode === 'oz' ? estOZ(ct) : !estOZ(ct))));
  const nbBranches = document.querySelectorAll('.vp-branche-checkbox:checked').length, totBranches = document.querySelectorAll('.vp-branche-checkbox').length;
  const etiquette = document.getElementById('vpx-nb-branches');
  if (etiquette) etiquette.textContent = totBranches && nbBranches < totBranches ? `· ${nbBranches}/${totBranches} branches` : '';

  let total = 0, vie = 0, prive = 0;
  const parCie = {}, parCat = {}, parProduit = {}, parCieClients = {}, clientsDistincts = new Set();
  liste.forEach(ct => {
    const prime = Number(ct.prime_annuelle);
    const { isVie, isEntreprise } = classifierContrat(ct, clientsMap);
    total += prime; if (isVie) vie += prime; if (!isEntreprise) prive += prime;
    const cie = (typeof normaliserCompagnie === 'function' ? normaliserCompagnie(ct.compagnie || '') : ct.compagnie) || 'Autre';
    parCie[cie] = (parCie[cie] || 0) + prime;
    const cat = (typeof categoriePourProduitLibre === 'function' ? categoriePourProduitLibre(ct.produit) : null) || 'Autre';
    parCat[cat] = parCat[cat] || { total: 0, produits: {} };
    parCat[cat].total += prime;
    parCat[cat].produits[ct.produit || 'Autre'] = (parCat[cat].produits[ct.produit || 'Autre'] || 0) + prime;
    parProduit[ct.produit || 'Autre'] = (parProduit[ct.produit || 'Autre'] || 0) + prime;
    (parCieClients[cie] = parCieClients[cie] || {})[ct.client_id] = (parCieClients[cie][ct.client_id] || 0) + prime;
    if (ct.client_id) clientsDistincts.add(ct.client_id);
  });
  window._volumePrimesParCompagnieClients = parCieClients;
  if (!liste.length) return `<section class="dbx-carte"><div class="dbx-vide"><span style="font-size:26px">📦</span>Aucun contrat avec prime pour ce filtre.</div></section>`;

  const pct = v => total ? Math.round(v / total * 100) : 0;
  const cies = Object.entries(parCie).sort((a, b) => b[1] - a[1]);
  const cats = Object.entries(parCat).sort((a, b) => b[1].total - a[1].total);
  const maxCat = cats.length ? cats[0][1].total : 1;
  const produits = Object.entries(parProduit).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Anneau par compagnie (8 premières + « autres »)
  const top = cies.slice(0, 8); const autres = cies.slice(8).reduce((s, [, v]) => s + v, 0);
  const parts = [...top, ...(autres ? [['Autres', autres]] : [])];
  const R = 70, C = 2 * Math.PI * R; let cumul = 0;
  const anneau = parts.map(([cie, v], i) => { const f = v / total, dash = f * C, off = cumul * C; cumul += f;
    return `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${VPX_PALETTE[i % VPX_PALETTE.length]}" stroke-width="22" stroke-dasharray="${dash.toFixed(1)} ${(C - dash).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 90 90)"><title>${vpxEsc(cie)} : ${dbxCHF(v)}</title></circle>`; }).join('');

  const split = (titre, a, la, ca, lb, cb) => `<section class="dbx-carte"><header class="dbx-carte-tete"><h2>${titre}</h2></header>
    <div class="vpx-split"><span style="width:${pct(a)}%;background:${ca}"></span><span style="width:${100 - pct(a)}%;background:${cb}"></span></div>
    <div class="vpx-split-legende"><div><i style="background:${ca}"></i><span>${la}</span><b>${dbxCHF(a)}</b><small>${pct(a)} %</small></div><div><i style="background:${cb}"></i><span>${lb}</span><b>${dbxCHF(total - a)}</b><small>${100 - pct(a)} %</small></div></div>
  </section>`;

  const premiere = cies.length ? cies[0][0] : null;
  return `
    <div class="dbx-kpis">
      ${dbxKpi({ label: 'Volume annuel', valeur: total, prefixe: 'CHF ', sous: mode === 'tous' ? 'tout le portefeuille' : mode === 'oz' ? 'clients OZ Assure' : 'hors clients OZ', i: 0 })}
      ${dbxKpi({ label: 'Contrats avec prime', valeur: liste.length, sous: `${clientsDistincts.size} client${clientsDistincts.size > 1 ? 's' : ''}`, onclick: "navigate('tous-contrats')", i: 1 })}
      ${dbxKpi({ label: 'Prime moyenne par client', valeur: clientsDistincts.size ? total / clientsDistincts.size : 0, prefixe: 'CHF ', sous: 'par an', i: 2 })}
      ${dbxKpi({ label: 'Première compagnie', valeur: premiere ? pct(parCie[premiere]) : 0, suffixe: ' %', sous: premiere ? vpxEsc(premiere) : '—', i: 3 })}
    </div>
    <div class="dbx-grille dbx-grille-egale">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Par compagnie</h2><span class="dbx-carte-sous">clique une compagnie pour ses meilleurs clients</span></header>
        <div class="vpx-anneau">
          <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Répartition par compagnie">${anneau}
            <text x="90" y="86" text-anchor="middle" font-size="20" font-weight="700" fill="currentColor">${cies.length}</text>
            <text x="90" y="104" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">compagnies</text></svg>
          <div class="vpx-legende">${cies.slice(0, 10).map(([cie, v], i) => `<button type="button" onclick="afficherTopClientsCompagnie(this.dataset.c)" data-c="${vpxEsc(cie)}">
            <i style="background:${VPX_PALETTE[Math.min(i, 8) % VPX_PALETTE.length]}"></i>${typeof pictoCompagnie === 'function' ? pictoCompagnie(cie, 20) : ''}<span>${vpxEsc(cie)}</span><b>${dbxCompact(v)}</b><small>${pct(v)} %</small></button>`).join('')}</div>
        </div>
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Meilleurs clients</h2>
          <select id="vp-compagnie-select" class="form-select vpx-select" onchange="afficherTopClientsCompagnie(this.value)">${cies.map(([c]) => `<option value="${vpxEsc(c)}">${vpxEsc(c)}</option>`).join('')}</select></header>
        <div id="vp-top-clients-corps">${renderTopClientsCompagnie(premiere, parCieClients, clientsMap)}</div>
      </section>
      ${split('Vie et prévoyance / non-vie', vie, '🫀 Vie & prévoyance', '#A78BFA', '🛡️ Non-vie (IARD)', '#00CFFF')}
      ${split('Clients privés / entreprises', prive, '👤 Privés', '#22C55E', '🏢 Entreprises', '#F59E0B')}
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Par catégorie</h2><span class="dbx-carte-sous">clique pour voir les contrats</span></header>
        <div class="dbx-hbarres">${cats.map(([cat, x], i) => `<div class="dbx-hbarre vpx-cat" style="--i:${i}" title="${vpxEsc(Object.entries(x.produits).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p, v]) => p + ' : ' + dbxCHF(v)).join(' · '))}">
          <span class="dbx-hbarre-nom"><span class="dbx-point" style="background:${(typeof COULEUR_CATEGORIE_PRODUIT !== 'undefined' && COULEUR_CATEGORIE_PRODUIT[cat]) || '#94A3B8'}"></span><span>${vpxEsc(cat)}</span></span>
          <span class="dbx-hbarre-piste"><span style="--w:${Math.round(x.total / maxCat * 100)}%;background:${(typeof COULEUR_CATEGORIE_PRODUIT !== 'undefined' && COULEUR_CATEGORIE_PRODUIT[cat]) || '#94A3B8'}"></span></span>
          <span class="dbx-hbarre-val">${dbxCompact(x.total)}<small>${pct(x.total)} %</small></span></div>`).join('')}</div>
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Top produits</h2><span class="dbx-carte-sous">volume annuel</span></header>
        <div class="sfx-mini">${produits.map(([p, v], i) => `<button type="button" class="vpx-produit" data-produit="${vpxEsc(p)}" onclick="rechercherContratsProduit(this.dataset.produit)"><span><b><em>${i + 1}</em>${vpxEsc(p)}</b></span><em>${dbxCHF(v)} <small>${pct(v)} %</small></em></button>`).join('')}</div>
      </section>
    </div>`;
}

// Meilleurs clients d'une compagnie — version moderne (même signature que js/04)
function renderTopClientsCompagnie(compagnie, parCompagnieClients, clientsMap) {
  const parClient = compagnie ? parCompagnieClients[compagnie] : null;
  if (!parClient || !Object.keys(parClient).length) return '<div class="dbx-vide-petit">Aucun contrat avec prime pour cette compagnie.</div>';
  const tot = Object.values(parClient).reduce((s, v) => s + v, 0) || 1;
  const lignes = Object.entries(parClient).map(([id, v]) => {
    const c = clientsMap[id] || (allClients || []).find(x => x.id === id);
    return { id, v, nom: c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : 'Client inconnu' };
  }).sort((a, b) => b.v - a.v).slice(0, 10);
  const max = lignes[0].v || 1;
  return `<div class="vpx-top">${lignes.map((l, i) => `<button type="button" onclick="showClient('${l.id}')">
    <em>${i + 1}</em><span class="vpx-top-nom">${vpxEsc(l.nom)}<span class="dbx-hbarre-piste"><span style="--w:${Math.round(l.v / max * 100)}%;width:${Math.round(l.v / max * 100)}%"></span></span></span>
    <b>${dbxCHF(l.v)}</b><small>${Math.round(l.v / tot * 100)} %</small></button>`).join('')}</div>`;
}
