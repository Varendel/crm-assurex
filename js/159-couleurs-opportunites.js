// ═══ L'ÉTAT D'UNE AFFAIRE, À LA COULEUR (24.09.2026) ════════════════════════════════════════════
// « On pourrait appliquer une différenciation de couleur aux opp à jour, celles dont la prochaine
// action arrive, et celles à tâches échues ? »
//
// La prochaine action est déjà écrite sur chaque carte (js/13), mais il faut la LIRE — et sur un
// pipeline de trente affaires, on ne lit pas trente lignes, on balaie. Une bande de couleur au bord
// gauche se voit sans lire : on repère les rouges avant d'avoir compris ce qu'elles disent.
//
// Trois états, et volontairement trois — au-delà, plus personne ne retient le code :
//   · rouge   : une tâche est échue, OU l'affaire n'a aucune prochaine action (elle dort) ;
//   · ambre   : la prochaine action tombe aujourd'hui ou dans les 3 jours ;
//   · vert    : datée au-delà. Rien à faire maintenant.
// Une affaire gagnée ou perdue n'a pas d'état : elle est finie, elle reste neutre.
//
// Le vert est discret exprès. Ce qu'on cherche dans un pipeline, ce n'est pas ce qui va bien.

const COP_BIENTOT_JOURS = 3;

function copEtat(o) {
  if (!o || typeof paOuverte !== 'function' || !paOuverte(o)) return null;
  const pa = typeof prochaineAction === 'function' ? prochaineAction(o.id) : null;
  if (!pa) return 'dort';                       // aucune prochaine action : le cas le plus grave
  if (!pa.date_echeance) return 'dort';         // une action sans date ne se déclenchera jamais
  const auj = new Date().toISOString().split('T')[0];
  if (pa.date_echeance < auj) return 'echue';
  const limite = new Date();
  limite.setDate(limite.getDate() + COP_BIENTOT_JOURS);
  return pa.date_echeance <= limite.toISOString().split('T')[0] ? 'bientot' : 'ajour';
}

const COP_TITRES = {
  dort: 'Aucune prochaine action datée — cette affaire dort',
  echue: 'Tâche échue',
  bientot: `Prochaine action dans moins de ${COP_BIENTOT_JOURS} jours`,
  ajour: 'À jour',
};

// Une légende, parce qu'un code couleur qu'il faut deviner n'en est pas un. Posée une fois au-dessus
// du kanban, pas dans les listes : c'est là qu'on balaie.
function copLegende() {
  const kanban = document.querySelector('#main-content .kanban');
  if (!kanban || document.getElementById('cop-legende')) return;
  const cle = (c, t) => `<span class="cop-leg-item"><i style="background:${c}"></i>${t}</span>`;
  kanban.insertAdjacentHTML('beforebegin', `<div id="cop-legende" class="cop-legende">
    ${cle('#b91c1c', 'Sans prochaine action')}
    ${cle('#ef4444', 'Tâche échue')}
    ${cle('#f59e0b', `Dans ${COP_BIENTOT_JOURS} jours`)}
    ${cle('#16a34a', 'À jour')}
  </div>`);
}

function copDecorer() {
  const main = document.getElementById('main-content');
  if (!main) return;
  copLegende();
  const opps = typeof allOpportunites !== 'undefined' ? allOpportunites : [];
  main.querySelectorAll('[onclick*="editerOpportunite(\'"]').forEach(el => {
    const m = (el.getAttribute('onclick') || '').match(/editerOpportunite\('([^']+)'\)/);
    if (!m) return;
    const etat = copEtat(opps.find(x => x.id === m[1]));
    // On repose la classe à chaque passage : une tâche terminée doit faire virer la couleur au
    // rendu suivant, sans recharger la page.
    if (el.dataset.cop === (etat || '')) return;
    el.dataset.cop = etat || '';
    el.classList.remove('cop-dort', 'cop-echue', 'cop-bientot', 'cop-ajour');
    if (etat) { el.classList.add('cop-' + etat); el.title = COP_TITRES[etat]; }
  });
}

(function copBrancher() {
  const st = document.createElement('style');
  st.textContent = `
    /* La bande est posée en ombre portée intérieure : elle n'ajoute aucune largeur, donc elle ne
       décale ni les cartes du kanban ni les colonnes des tableaux. */
    .cop-dort, .cop-echue, .cop-bientot, .cop-ajour { box-shadow: inset 4px 0 0 0 var(--cop-c); }
    .cop-dort    { --cop-c: #b91c1c; }
    .cop-echue   { --cop-c: #ef4444; }
    .cop-bientot { --cop-c: #f59e0b; }
    .cop-ajour   { --cop-c: color-mix(in srgb, #16a34a 55%, transparent); }
    /* Sur une ligne de tableau, l'ombre intérieure ne porte pas : on borde la première cellule. */
    tr.cop-dort > *:first-child, tr.cop-echue > *:first-child,
    tr.cop-bientot > *:first-child, tr.cop-ajour > *:first-child { box-shadow: inset 4px 0 0 0 var(--cop-c); }
    .cop-legende { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 0 10px;
      font-size: 11px; color: var(--text-muted); }
    .cop-leg-item { display: inline-flex; align-items: center; gap: 5px; }
    .cop-leg-item i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }`;
  document.head.appendChild(st);

  const main = document.getElementById('main-content');
  if (main) {
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(copDecorer, 90); })
      .observe(main, { childList: true, subtree: true });
  }
  const demarrer = () => setTimeout(copDecorer, 200);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
