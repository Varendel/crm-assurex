// ═══ LE TABLEAU, UNE SEULE FOIS (20.09.2026) ═══════════════════════════════════════════════════
// Point 3 du chantier. Constat de départ : le CRM compte une vingtaine de listes, et chacune a
// été écrite à la main — sa propre grille CSS, ses propres en-têtes, son propre vide, son propre
// tri quand il y en a un. D'où trois symptômes qu'on ne savait pas nommer :
//   — les colonnes ne s'alignent pas d'un écran à l'autre,
//   — le tri existe sur certaines listes et pas sur d'autres, sans logique,
//   — et surtout : ajouter « trier par prime » quelque part ne le donne nulle part ailleurs.
//
// Ce composant est la réponse. Une liste se décrit, elle ne se dessine plus :
//
//   tblRendre('mon-id', {
//     colonnes: [
//       { cle: 'nom',   titre: 'Client',  gabarit: '1.6fr', valeur: l => l.nom },
//       { cle: 'prime', titre: 'Prime',   gabarit: '110px', aligne: 'droite',
//         valeur: l => l.prime, texte: l => fmtCHF(l.prime) },
//     ],
//     lignes: mesLignes,
//     surClic: l => showClient(l.id),
//   });
//
// Ce qu'on gagne d'un coup sur toutes les listes qui l'adoptent : tri par colonne, recherche,
// densité compacte, sélection multiple, export CSV, et un état vide qui se ressemble partout.
//
// Trois partis pris :
//
// 1. TRI SUR LA VALEUR, PAS SUR LE TEXTE. On trie « CHF 1 250 » comme le nombre 1250 et non comme
//    la chaîne « CHF 1 250 » — sinon 9 passe après 10, et personne ne comprend pourquoi.
// 2. PAS D'INNERHTML POUR LES DONNÉES. Les cellules sont posées via textContent. Un nom de client
//    contenant une apostrophe ou un chevron ne doit pas pouvoir casser la page — c'est
//    exactement la classe de bugs que provoquent les 899 onclick en chaîne du CRM actuel.
// 3. L'ÉTAT VIT DANS LE DOM, PAS DANS UNE GLOBALE. Deux tableaux peuvent coexister sur un écran
//    sans se marcher dessus.

const TBL_MAX_DEFAUT = 200;   // au-delà, on pagine : un navigateur peint mal 3 000 lignes

window._tbl = window._tbl || {};

function tblEsc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function tblCleTri(v) {
  if (v == null) return '';
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return isNaN(n) ? String(v).toLowerCase() : n;
}

function tblComparer(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
}

// ── Rendu ───────────────────────────────────────────────────────────────────────────────────────
function tblRendre(id, config) {
  const zone = document.getElementById(id);
  if (!zone) return;
  const etat = window._tbl[id] = Object.assign({
    tri: config.triInitial || null, sens: config.sensInitial || 'asc',
    recherche: '', page: 0, selection: new Set(),
  }, window._tbl[id] || {}, { config });
  tblPeindre(id);
}

function tblLignesVisibles(id) {
  const e = window._tbl[id];
  const c = e.config;
  let lignes = (c.lignes || []).slice();

  if (e.recherche) {
    const q = e.recherche.toLowerCase();
    lignes = lignes.filter(l => c.colonnes.some(col => {
      const t = col.texte ? col.texte(l) : col.valeur(l);
      return String(t ?? '').toLowerCase().includes(q);
    }));
  }
  if (e.tri) {
    const col = c.colonnes.find(x => x.cle === e.tri);
    if (col) {
      const sens = e.sens === 'desc' ? -1 : 1;
      lignes.sort((a, b) => sens * tblComparer(tblCleTri(col.valeur(a)), tblCleTri(col.valeur(b))));
    }
  }
  return lignes;
}

function tblPeindre(id) {
  const zone = document.getElementById(id);
  const e = window._tbl[id];
  if (!zone || !e) return;
  const c = e.config;
  const toutes = tblLignesVisibles(id);
  const max = c.parPage || TBL_MAX_DEFAUT;
  const pages = Math.max(1, Math.ceil(toutes.length / max));
  if (e.page >= pages) e.page = pages - 1;
  const lignes = toutes.slice(e.page * max, (e.page + 1) * max);
  const gabarit = (c.selection ? '34px ' : '') + c.colonnes.map(x => x.gabarit || '1fr').join(' ');

  zone.className = 'tbl' + (c.classe ? ' ' + c.classe : '');
  zone.innerHTML = `
    ${c.recherche === false && !c.titre && !c.export ? '' : `<div class="tbl-barre">
      ${c.titre ? `<span class="tbl-titre">${tblEsc(c.titre)}</span>` : ''}
      <span class="tbl-compte">${toutes.length}${toutes.length !== (c.lignes || []).length ? ` sur ${(c.lignes || []).length}` : ''}</span>
      ${c.recherche === false ? '' : `<input type="search" class="form-input tbl-recherche" placeholder="Filtrer…" value="${tblEsc(e.recherche)}"/>`}
      ${e.selection.size ? `<span class="tbl-selection">${e.selection.size} sélectionné(s)</span>` : ''}
      ${c.export === false ? '' : '<button type="button" class="btn-secondary tbl-export">⬇ CSV</button>'}
    </div>`}
    <div class="tbl-grille" style="--gabarit:${gabarit}">
      <div class="tbl-entete" role="row">
        ${c.selection ? '<span class="tbl-cellule tbl-case"><input type="checkbox" class="tbl-tout"/></span>' : ''}
        ${c.colonnes.map(col => `<button type="button" class="tbl-cellule tbl-th ${col.aligne === 'droite' ? 'droite' : ''} ${e.tri === col.cle ? 'trie' : ''}"
          data-cle="${tblEsc(col.cle)}" ${col.triable === false ? 'disabled' : ''}>
          ${tblEsc(col.titre)}${e.tri === col.cle ? `<i>${e.sens === 'asc' ? '▲' : '▼'}</i>` : ''}
        </button>`).join('')}
      </div>
      <div class="tbl-corps"></div>
    </div>
    ${pages > 1 ? `<div class="tbl-pages">
      <button type="button" class="btn-secondary tbl-prec" ${e.page === 0 ? 'disabled' : ''}>←</button>
      <span>page ${e.page + 1} sur ${pages}</span>
      <button type="button" class="btn-secondary tbl-suiv" ${e.page >= pages - 1 ? 'disabled' : ''}>→</button>
    </div>` : ''}
    ${!toutes.length ? `<div class="tbl-vide">${c.vide || 'Aucune ligne'}</div>` : ''}`;

  // Les données sont posées en textContent, jamais en innerHTML : un nom de client avec une
  // apostrophe ou un chevron ne doit pas pouvoir casser la page.
  const corps = zone.querySelector('.tbl-corps');
  for (const l of lignes) {
    const ligne = document.createElement('div');
    ligne.className = 'tbl-ligne' + (c.classeLigne ? ' ' + (c.classeLigne(l) || '') : '');
    ligne.setAttribute('role', 'row');
    if (c.surClic) { ligne.tabIndex = 0; ligne.classList.add('cliquable'); }
    if (c.selection) {
      const cel = document.createElement('span');
      cel.className = 'tbl-cellule tbl-case';
      const b = document.createElement('input');
      b.type = 'checkbox';
      b.checked = e.selection.has(c.cle ? c.cle(l) : l.id);
      b.addEventListener('change', ev => {
        ev.stopPropagation();
        const k = c.cle ? c.cle(l) : l.id;
        if (b.checked) e.selection.add(k); else e.selection.delete(k);
        if (c.surSelection) c.surSelection([...e.selection]);
        tblPeindre(id);
      });
      cel.appendChild(b);
      ligne.appendChild(cel);
    }
    for (const col of c.colonnes) {
      const cel = document.createElement('span');
      cel.className = 'tbl-cellule' + (col.aligne === 'droite' ? ' droite' : '') + (col.classe ? ' ' + col.classe : '');
      const rendu = col.rendu ? col.rendu(l) : null;
      if (rendu instanceof Node) cel.appendChild(rendu);
      else cel.textContent = col.texte ? col.texte(l) : (col.valeur(l) ?? '');
      if (col.titreCellule) cel.title = col.titreCellule(l);
      ligne.appendChild(cel);
    }
    if (c.surClic) {
      ligne.addEventListener('click', () => c.surClic(l));
      ligne.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); c.surClic(l); } });
    }
    corps.appendChild(ligne);
  }

  // ── Branchements ──────────────────────────────────────────────────────────────────────────
  zone.querySelectorAll('.tbl-th').forEach(b => b.addEventListener('click', () => {
    const cle = b.dataset.cle;
    if (e.tri === cle) e.sens = e.sens === 'asc' ? 'desc' : 'asc';
    else { e.tri = cle; e.sens = 'asc'; }
    tblPeindre(id);
  }));
  const rech = zone.querySelector('.tbl-recherche');
  if (rech) rech.addEventListener('input', () => {
    e.recherche = rech.value; e.page = 0;
    tblPeindre(id);
    // Le champ est reconstruit : on lui rend le curseur, sinon la frappe s'interrompt.
    const n = document.getElementById(id).querySelector('.tbl-recherche');
    if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  });
  const tout = zone.querySelector('.tbl-tout');
  if (tout) tout.addEventListener('change', () => {
    if (tout.checked) toutes.forEach(l => e.selection.add(c.cle ? c.cle(l) : l.id));
    else e.selection.clear();
    if (c.surSelection) c.surSelection([...e.selection]);
    tblPeindre(id);
  });
  zone.querySelector('.tbl-prec')?.addEventListener('click', () => { e.page--; tblPeindre(id); });
  zone.querySelector('.tbl-suiv')?.addEventListener('click', () => { e.page++; tblPeindre(id); });
  zone.querySelector('.tbl-export')?.addEventListener('click', () => tblExporter(id));
}

// ── Export CSV ──────────────────────────────────────────────────────────────────────────────────
// Point-virgule et BOM UTF-8 : c'est ce qu'attend Excel en Suisse romande. Un CSV à la virgule
// s'ouvre en une seule colonne et l'utilisateur en conclut que l'export est cassé.
function tblExporter(id) {
  const e = window._tbl[id];
  if (!e) return;
  const c = e.config;
  const lignes = tblLignesVisibles(id);
  const cell = v => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [c.colonnes.map(x => cell(x.titre)).join(';')]
    .concat(lignes.map(l => c.colonnes.map(col => cell(col.texte ? col.texte(l) : col.valeur(l))).join(';')))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(c.titre || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
