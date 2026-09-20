// ═══ PORTEFEUILLE EN ARBORESCENCE (20.09.2026) ═════════════════════════════════════════════════
// « Clients entreprise et privés : incorpore une arborescence des contrats regroupés par
// catégories. »
//
// POURQUOI UNE ARBORESCENCE ET PAS UNE COLONNE DE PLUS.
// Le tableau du portefeuille répond à « qui sont mes clients ». Il ne répond pas à « combien de
// véhicules ai-je en portefeuille », ni à « qui a de la prévoyance chez moi » — or ce sont les
// questions d'un courtier : elles commandent les campagnes, les relances d'échéance, et le
// rapport par branche. Un tableau à plat ne les porte pas, parce qu'un client y tient une ligne
// et ses contrats aucune.
//
// DEUX AXES, PARCE QUE LES DEUX QUESTIONS EXISTENT.
//   Par catégorie  : branche → client → contrat. « Qui a du 3a ? »
//   Par client     : client → branche → contrat. « Que possède monsieur Dupont ? »
// La même donnée, lue dans les deux sens. Le défaut est « par catégorie », c'est la demande.
//
// LES CATÉGORIES VIENNENT DE EC_TYPES (js/52), celles de l'espace client. Une seule définition de
// ce qu'est « de la santé » ou « de la prévoyance » dans toute l'application : le jour où un
// produit change de famille, il change partout, et le client voit le même classement que nous.
//
// <details>/<summary> natifs plutôt qu'un pliage en JavaScript : le clavier fonctionne, les
// lecteurs d'écran annoncent l'état, la recherche du navigateur (Ctrl+F) ouvre les nœuds repliés,
// et l'état survit au re-rendu tant que le DOM n'est pas remplacé.

window._arb = window._arb || { vue: 'liste', axe: 'categorie', filtre: 'tous' };

function arbEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function arbCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }

function arbNomClient(c) {
  if (!c) return '—';
  return (typeof estEntreprise === 'function' && estEntreprise(c))
    ? (c.nom || '—') : [c.prenom, c.nom].filter(Boolean).join(' ') || '—';
}

// La catégorie d'un contrat. On passe par ecTypeContrat() quand il est là ; le repli n'existe que
// pour le cas où js/52 ne serait pas chargé, et il classe tout dans « autre » plutôt que de
// réinventer une seconde table de correspondances qui divergerait de la première.
function arbCategorie(ct) {
  if (typeof ecTypeContrat === 'function') return ecTypeContrat(ct);
  return 'autre';
}
function arbTypes() {
  return (typeof EC_TYPES !== 'undefined') ? EC_TYPES : [{ id: 'autre', label: 'Contrats', icone: '📁' }];
}

// Les contrats qui comptent. Un contrat annulé ou résilié n'a plus à peupler un arbre de
// portefeuille : il n'est plus au portefeuille. « À renouveler » y reste, en revanche — c'est
// justement celui qu'on cherche.
const ARB_EXCLUS = ['annulé', 'résilié', 'mandat_resilie'];

function arbContratsDe(clientId) {
  return (typeof allContrats !== 'undefined' ? allContrats : [])
    .filter(ct => ct.client_id === clientId && !ARB_EXCLUS.includes(ct.statut));
}

// ── Construction ────────────────────────────────────────────────────────────────────────────────
function arbDonnees() {
  const clients = window._pfFiltres || [];
  const noeuds = [];
  for (const c of clients) {
    for (const ct of arbContratsDe(c.id)) {
      noeuds.push({
        client: c, contrat: ct, categorie: arbCategorie(ct),
        prime: Number(ct.prime_annuelle || 0),
      });
    }
  }
  return { clients, noeuds };
}

function arbRendre() {
  const zone = document.getElementById('pf-table-container');
  if (!zone) return;
  const { clients, noeuds } = arbDonnees();

  if (!noeuds.length) {
    zone.innerHTML = `<div class="table-empty">Aucun contrat en portefeuille pour ces
      ${clients.length} client${clients.length > 1 ? 's' : ''}.</div>`;
    return;
  }
  zone.innerHTML = `
    <div class="arb-barre">
      <div class="arb-axes" role="group" aria-label="Axe de regroupement">
        <button type="button" class="${window._arb.axe === 'categorie' ? 'actif' : ''}"
          onclick="arbAxe('categorie')">Par catégorie</button>
        <button type="button" class="${window._arb.axe === 'client' ? 'actif' : ''}"
          onclick="arbAxe('client')">Par client</button>
      </div>
      <div class="arb-total">${noeuds.length} contrat${noeuds.length > 1 ? 's' : ''} ·
        ${new Set(noeuds.map(n => n.client.id)).size} client${new Set(noeuds.map(n => n.client.id)).size > 1 ? 's' : ''} ·
        CHF ${arbCHF(noeuds.reduce((s, n) => s + n.prime, 0))} de primes</div>
      <div class="arb-actions">
        <button type="button" class="arb-act" onclick="arbToutOuvrir(true)">Tout déplier</button>
        <button type="button" class="arb-act" onclick="arbToutOuvrir(false)">Tout replier</button>
        <button type="button" class="arb-act" onclick="arbExporter()">⬇ Excel</button>
      </div>
    </div>
    <div class="arb-arbre">${window._arb.axe === 'categorie' ? arbParCategorie(noeuds) : arbParClient(noeuds)}</div>`;
}

function arbAxe(axe) { window._arb.axe = axe; arbRendre(); }
function arbToutOuvrir(ouvert) {
  document.querySelectorAll('.arb-arbre details').forEach(d => { d.open = ouvert; });
}

// ── Axe 1 : catégorie → client → contrat ────────────────────────────────────────────────────────
function arbParCategorie(noeuds) {
  const parCat = new Map();
  for (const n of noeuds) {
    if (!parCat.has(n.categorie)) parCat.set(n.categorie, []);
    parCat.get(n.categorie).push(n);
  }
  // On suit l'ordre de EC_TYPES et non l'ordre d'apparition : une arborescence dont les branches
  // changent de place d'un filtre à l'autre oblige à la relire entièrement à chaque fois.
  return arbTypes().map(t => {
    const l = parCat.get(t.id);
    if (!l || !l.length) return '';
    const prime = l.reduce((s, n) => s + n.prime, 0);
    const clients = new Map();
    for (const n of l) {
      if (!clients.has(n.client.id)) clients.set(n.client.id, { client: n.client, lignes: [] });
      clients.get(n.client.id).lignes.push(n);
    }
    const tries = [...clients.values()].sort((a, b) =>
      b.lignes.reduce((s, x) => s + x.prime, 0) - a.lignes.reduce((s, x) => s + x.prime, 0));

    return `<details class="arb-n1" open>
      <summary>
        <span class="arb-icone" aria-hidden="true">${t.icone}</span>
        <b>${arbEsc(t.label)}</b>
        <span class="arb-compte">${l.length} contrat${l.length > 1 ? 's' : ''} · ${clients.size} client${clients.size > 1 ? 's' : ''}</span>
        <span class="arb-prime">CHF ${arbCHF(prime)}<small>/an</small></span>
      </summary>
      <div class="arb-corps">${tries.map(g => `
        <details class="arb-n2">
          <summary>
            <b>${arbEsc(arbNomClient(g.client))}</b>
            ${arbBadgeSegment(g.client)}
            <span class="arb-compte">${g.lignes.length} contrat${g.lignes.length > 1 ? 's' : ''}</span>
            <span class="arb-prime">CHF ${arbCHF(g.lignes.reduce((s, x) => s + x.prime, 0))}</span>
          </summary>
          <div class="arb-corps">${g.lignes.map(n => arbContratHtml(n)).join('')}</div>
        </details>`).join('')}</div>
    </details>`;
  }).join('');
}

// ── Axe 2 : client → catégorie → contrat ────────────────────────────────────────────────────────
function arbParClient(noeuds) {
  const parClient = new Map();
  for (const n of noeuds) {
    if (!parClient.has(n.client.id)) parClient.set(n.client.id, { client: n.client, lignes: [] });
    parClient.get(n.client.id).lignes.push(n);
  }
  const tries = [...parClient.values()].sort((a, b) =>
    b.lignes.reduce((s, x) => s + x.prime, 0) - a.lignes.reduce((s, x) => s + x.prime, 0));

  return tries.map(g => {
    const prime = g.lignes.reduce((s, x) => s + x.prime, 0);
    const cats = new Map();
    for (const n of g.lignes) {
      if (!cats.has(n.categorie)) cats.set(n.categorie, []);
      cats.get(n.categorie).push(n);
    }
    return `<details class="arb-n1">
      <summary>
        <b>${arbEsc(arbNomClient(g.client))}</b>
        ${arbBadgeSegment(g.client)}
        <span class="arb-compte">${g.lignes.length} contrat${g.lignes.length > 1 ? 's' : ''} ·
          ${cats.size} branche${cats.size > 1 ? 's' : ''}</span>
        <span class="arb-prime">CHF ${arbCHF(prime)}<small>/an</small></span>
      </summary>
      <div class="arb-corps">${arbTypes().map(t => {
        const l = cats.get(t.id);
        if (!l || !l.length) return '';
        return `<details class="arb-n2" open>
          <summary>
            <span class="arb-icone" aria-hidden="true">${t.icone}</span>
            <b>${arbEsc(t.label)}</b>
            <span class="arb-compte">${l.length}</span>
            <span class="arb-prime">CHF ${arbCHF(l.reduce((s, x) => s + x.prime, 0))}</span>
          </summary>
          <div class="arb-corps">${l.map(n => arbContratHtml(n)).join('')}</div>
        </details>`;
      }).join('')}</div>
    </details>`;
  }).join('');
}

function arbBadgeSegment(c) {
  const ent = typeof estEntreprise === 'function' && estEntreprise(c);
  return `<span class="arb-seg ${ent ? 'ent' : 'priv'}">${ent ? 'Entreprise' : 'Privé'}</span>`;
}

// La feuille de l'arbre : un contrat. Elle porte ce qui sert à agir — la compagnie, le numéro de
// police, l'échéance — et pas ce qui sert à décorer.
function arbContratHtml(n) {
  const ct = n.contrat;
  const auj = new Date().toISOString().slice(0, 10);
  const dans90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const echeanceProche = ct.date_echeance && ct.date_echeance >= auj && ct.date_echeance <= dans90;
  return `<div class="arb-feuille" onclick="arbOuvrirClient('${n.client.id}')" role="button" tabindex="0"
      onkeydown="if(event.key==='Enter'){arbOuvrirClient('${n.client.id}')}">
    <span class="arb-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 22) : ''}</span>
    <div class="arb-feuille-texte">
      <b>${arbEsc(ct.produit || 'Contrat')}</b>
      <small>${arbEsc(ct.compagnie || '')}${ct.numero_police ? ' · police ' + arbEsc(ct.numero_police) : ''}</small>
    </div>
    ${ct.statut && ct.statut !== 'actif' ? `<span class="arb-statut">${arbEsc(ct.statut)}</span>` : ''}
    ${ct.date_echeance ? `<span class="arb-echeance ${echeanceProche ? 'proche' : ''}">${fmtDate(ct.date_echeance)}</span>` : ''}
    <span class="arb-feuille-prime">${n.prime ? 'CHF ' + arbCHF(n.prime) : '—'}</span>
  </div>`;
}

function arbOuvrirClient(id) {
  if (typeof showClient === 'function') showClient(id);
  else if (typeof voirClient === 'function') voirClient(id);
}

// ── Export ──────────────────────────────────────────────────────────────────────────────────────
// Une ligne par contrat, avec sa catégorie : c'est la forme qui se retrie et se pivote dans Excel.
// Exporter l'arbre tel qu'il s'affiche donnerait un tableau avec des trous, impossible à filtrer.
function arbExporter() {
  if (typeof XLSX === 'undefined') { if (typeof showError === 'function') showError('Le module Excel n’est pas chargé.'); return; }
  const { noeuds } = arbDonnees();
  const label = id => (arbTypes().find(t => t.id === id) || {}).label || id;
  const f = XLSX.utils.json_to_sheet(noeuds.map(n => ({
    Catégorie: label(n.categorie),
    Client: arbNomClient(n.client),
    Segment: (typeof estEntreprise === 'function' && estEntreprise(n.client)) ? 'Entreprise' : 'Privé',
    Compagnie: n.contrat.compagnie || '',
    Produit: n.contrat.produit || '',
    Police: n.contrat.numero_police || '',
    Statut: n.contrat.statut || '',
    'Prime annuelle': n.prime || null,
    Échéance: n.contrat.date_echeance ? new Date(n.contrat.date_echeance + 'T00:00:00') : null,
  })));
  f['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 11 }, { wch: 16 }, { wch: 34 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
  const w = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(w, f, 'Portefeuille');
  XLSX.writeFile(w, `portefeuille-par-categorie_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Branchement ─────────────────────────────────────────────────────────────────────────────────
// On enveloppe les deux fonctions de js/04 : la vue pour y glisser la bascule, le rendu pour
// remplacer le tableau par l'arbre quand c'est le mode choisi. Le filtrage, lui, reste celui de
// js/04 — l'arbre lit window._pfFiltres, donc les deux vues montrent toujours la même population.
(function arbBrancher() {
  if (typeof viewPortefeuille === 'function') {
    const origine = viewPortefeuille;
    window.viewPortefeuille = function (filtre) {
      window._arb.filtre = filtre;
      const html = origine.apply(this, arguments);
      const bascule = `
        <div class="arb-bascule" role="group" aria-label="Mode d’affichage">
          <button type="button" class="${window._arb.vue === 'liste' ? 'actif' : ''}"
            onclick="arbVue('liste')" title="Un client par ligne">☰ Liste</button>
          <button type="button" class="${window._arb.vue === 'arbre' ? 'actif' : ''}"
            onclick="arbVue('arbre')" title="Les contrats regroupés par catégorie">🌳 Arborescence</button>
        </div>`;
      // Posée en fin de barre de filtres, là où l'œil arrive après les avoir réglés.
      return html.replace('</div>\n    <div id="pf-stats"', bascule + '</div>\n    <div id="pf-stats"');
    };
  }

  if (typeof renderPortefeuilleTable === 'function') {
    const origine = renderPortefeuilleTable;
    window.renderPortefeuilleTable = function (filtre) {
      const r = origine.apply(this, arguments);   // filtre, met à jour les compteurs et _pfFiltres
      if (window._arb.vue === 'arbre') arbRendre();
      return r;
    };
  }
})();

function arbVue(vue) {
  window._arb.vue = vue;
  if (typeof navigate === 'function' && typeof currentView !== 'undefined') navigate(currentView);
}
