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
    // L'élément cliquable n'est pas toujours la carte : sur les cartes de priorité, c'est le bloc
    // de texte à l'intérieur. On remonte donc à la carte quand il y en a une, sinon on teinte
    // l'élément lui-même (lignes de tableau, listes).
    const cible = el.closest('.kanban-card, .table-row, .opp-carte-priorite') || el;
    const etat = copEtat(opps.find(x => x.id === m[1]));
    // On repose la classe à chaque passage : une tâche terminée doit faire virer la couleur au
    // rendu suivant, sans recharger la page.
    if (cible.dataset.cop === (etat || '')) return;
    cible.dataset.cop = etat || '';
    cible.classList.remove('cop-dort', 'cop-echue', 'cop-bientot', 'cop-ajour');
    if (etat) {
      cible.classList.add('cop-' + etat);
      // Ne pas écraser une infobulle existante (« Glisser vers un autre stade » sur le kanban) :
      // on la complète.
      const dejaLa = (cible.getAttribute('title') || '').split(' — ')[0];
      cible.title = dejaLa && dejaLa !== COP_TITRES[etat] ? `${dejaLa} — ${COP_TITRES[etat]}` : COP_TITRES[etat];
    }
  });
}

(function copBrancher() {
  const st = document.createElement('style');
  st.textContent = `
    /* 24.09.2026 — « Je ne vois pas de différence. Marque mieux, que l'opp elle-même prenne la
       couleur de son état, mais comme un EFFET : on comprend que c'est temporaire. »
       Une simple bande de 4 px se perdait dans la page. La carte entière est donc lavée de sa
       couleur — mais en dégradé, fort à gauche et éteint avant la moitié. Un aplat aurait l'air
       d'une propriété de l'affaire (comme une catégorie) ; un lavis qui s'efface a l'air d'un
       état : ça passera quand la tâche sera faite.
       On peint en background-image par-dessus le fond existant : le thème clair/sombre garde
       sa couleur de carte, on ne fait que la teinter. */
    .cop-dort, .cop-echue, .cop-bientot, .cop-ajour {
      background-image: linear-gradient(95deg,
        color-mix(in srgb, var(--cop-c) var(--cop-f, 20%), transparent) 0%,
        color-mix(in srgb, var(--cop-c) calc(var(--cop-f, 20%) / 3), transparent) 38%,
        transparent 62%);
      box-shadow: inset 3px 0 0 0 var(--cop-c);
      transition: background-image .25s ease;
    }
    .cop-dort    { --cop-c: #b91c1c; --cop-f: 26%; }
    .cop-echue   { --cop-c: #ef4444; --cop-f: 24%; }
    .cop-bientot { --cop-c: #f59e0b; --cop-f: 22%; }
    .cop-ajour   { --cop-c: #16a34a; --cop-f: 14%; }
    /* Ce qui presse respire — lentement, et seulement ce qui presse. Le vert et l'ambre ne bougent
       pas : une page où tout clignote ne dit plus rien. */
    .cop-dort, .cop-echue { animation: cop-respire 3.2s ease-in-out infinite; }
    @keyframes cop-respire {
      0%, 100% { --cop-f: 26%; }
      50%      { --cop-f: 12%; }
    }
    @property --cop-f { syntax: '<percentage>'; inherits: true; initial-value: 20%; }
    @media (prefers-reduced-motion: reduce) { .cop-dort, .cop-echue { animation: none; } }
    /* Sur une ligne de tableau, le fond et l'ombre se posent cellule par cellule. */
    tr.cop-dort, tr.cop-echue, tr.cop-bientot, tr.cop-ajour { background-image: none; box-shadow: none; }
    tr.cop-dort > *, tr.cop-echue > *, tr.cop-bientot > *, tr.cop-ajour > * {
      background-color: color-mix(in srgb, var(--cop-c) calc(var(--cop-f, 20%) / 2), transparent);
    }
    tr.cop-dort > *:first-child, tr.cop-echue > *:first-child,
    tr.cop-bientot > *:first-child, tr.cop-ajour > *:first-child { box-shadow: inset 3px 0 0 0 var(--cop-c); }
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
