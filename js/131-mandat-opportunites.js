// ═══ OPPORTUNITÉS : LE LOGO DU MANDAT QUAND IL EST ENREGISTRÉ (22.09.2026) ══════════════════════
// « Ajoute le logo du mandat s'il est enregistré dans les opp. »
//
// Le même logo que sur les couvertures (assets/logos/mandat-signe.svg, js/88) : sur chaque carte et
// chaque ligne du pipeline, et dans l'en-tête de la fiche opportunité, à côté du nom du client.
// La preuve est un mandat SIGNÉ et non archivé dans mandats_signes — lu en une seule requête pour
// tous les clients (cache de 60 s), puis posé sur ce qui est affiché. Pas de mandat : rien.

const _mop = { t: 0, clients: null, enCours: null };

async function mopClientsAvecMandat(forcer) {
  if (!forcer && _mop.clients && Date.now() - _mop.t < 60000) return _mop.clients;
  if (_mop.enCours) return _mop.enCours;
  _mop.enCours = dbGet('mandats_signes', 'signe=is.true&archive=is.false&select=client_id').then(r => {
    _mop.clients = new Set((Array.isArray(r) ? r : []).map(x => x.client_id).filter(Boolean));
    _mop.t = Date.now(); return _mop.clients;
  }).catch(() => _mop.clients || new Set()).finally(() => { _mop.enCours = null; });
  return _mop.enCours;
}

const MOP_BADGE = '<img src="assets/logos/mandat-signe.svg" alt="Mandat signé" class="mop-badge" title="Mandat signé enregistré" width="18" height="18"/>';

async function mopDecorer() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const cibles = main.querySelectorAll('[onclick*="editerOpportunite(\'"]:not([data-mop])');
  const fiche = main.querySelector('.opx-hero .fcx-contacts [onclick^="showClient(\'"]:not([data-mop])');
  if (!cibles.length && !fiche) return;
  const avec = await mopClientsAvecMandat();
  const clientDeOpp = id => { const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === id); return o && o.client_id; };
  cibles.forEach(el => {
    el.setAttribute('data-mop', '');
    const m = (el.getAttribute('onclick') || '').match(/editerOpportunite\('([^']+)'\)/);
    const cid = m && clientDeOpp(m[1]);
    if (!cid || !avec.has(cid) || el.querySelector('.mop-badge')) return;
    // Sur la carte : à côté du nom (premier titre ou premier texte en gras), sinon en tête.
    // Ligne de tableau (liste, échéances…) : la 2e colonne est le client ; ne jamais ajouter une cellule.
    const cible = el.classList.contains('table-row') ? (el.children[1] || el.children[0])
      : (el.querySelector('.plc-qui b, b, strong, .sux-sous, .ocv-titre') || el);
    cible.insertAdjacentHTML('beforeend', ' ' + MOP_BADGE);
  });
  if (fiche) {
    fiche.setAttribute('data-mop', '');
    const m = (fiche.getAttribute('onclick') || '').match(/showClient\('([^']+)'\)/);
    if (m && avec.has(m[1])) fiche.insertAdjacentHTML('afterend', `<span class="fcx-chip mop-chip" title="Mandat de courtage signé enregistré">${MOP_BADGE} Mandat signé</span>`);
  }
}

(function mopBrancher() {
  let t = null;
  const relancer = () => { clearTimeout(t); t = setTimeout(() => mopDecorer().catch(() => {}), 120); };
  const go = () => { const main = document.getElementById('main-content'); if (main) new MutationObserver(relancer).observe(main, { childList: true, subtree: true }); relancer(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  const st = document.createElement('style');
  st.textContent = `
    .mop-badge { width: 18px; height: 18px; vertical-align: -4px; margin-left: 4px; background: #fff; border-radius: 50%; padding: 1px; display: inline-block; }
    .mop-chip { display: inline-flex; align-items: center; gap: 5px; }
    .mop-chip .mop-badge { margin: 0; }`;
  document.head.appendChild(st);
})();
