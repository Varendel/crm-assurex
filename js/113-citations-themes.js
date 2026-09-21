// ═══ LES CITATIONS DE REX, PAR THÈME (21.09.2026) ══════════════════════════════════════════════
// « Ajoute une personnalisation directe sur REX citation : par thème — Jules César, grecques,
// chrétiennes, perses, etc. »
//
// Directe : le choix se fait SUR la bulle, pas dans un écran de réglages qu'on ne rouvre jamais.
// Un petit bouton « Thèmes » sous la citation ouvre la liste ; on coche, et la citation suivante
// vient déjà du bon réservoir. Le choix est retenu sur cet appareil.
//
// Les familles sont celles de js/57, qui les range déjà par monde. On y ajoute deux coupes qui
// n'existaient pas comme listes : Jules César seul, et les stoïciens.
//
// Pour César, quatre citations seulement figuraient au réservoir. Cinq sont ajoutées, toutes
// tirées de ses propres écrits ou d'un auteur antique qui le rapporte, avec la source — même
// règle que js/57 : jamais une phrase prêtée sans le dire.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Rex reprend le tirage dans tout le réservoir.

const RCT_CESAR_PLUS = [
  { t: 'La Gaule, dans son ensemble, est divisée en trois parties.', a: 'Jules César, La Guerre des Gaules, I, 1' },
  { t: 'De tous ces peuples, les Belges sont les plus braves.', a: 'Jules César, La Guerre des Gaules, I, 1' },
  { t: 'La fortune a beaucoup de pouvoir en toutes choses, et surtout à la guerre.', a: 'Jules César, La Guerre des Gaules, VI, 30' },
  { t: 'À la guerre, de grands événements naissent de petites causes.', a: 'd’après Jules César, La Guerre civile, I, 21' },
  { t: 'La femme de César ne doit pas même être soupçonnée.', a: 'Jules César, rapporté par Plutarque' },
];

// « Évangiles et psaumes, supprime christianisme » (21.09.2026) : le thème large « Chrétiennes »
// mêlait les Pères de l'Église, le Moyen Âge et l'Écriture. Il cède la place aux seuls Évangiles et
// Psaumes, que le réservoir ne comptait qu'à 18. On en ajoute, verset cité (traduction Segond).
const RCT_EVANGILES_PSAUMES = [
  { t: 'L’Éternel est mon berger : je ne manquerai de rien.', a: 'Psaume 23, 1' },
  { t: 'Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.', a: 'Psaume 119, 105' },
  { t: 'Si l’Éternel ne bâtit la maison, ceux qui la bâtissent travaillent en vain.', a: 'Psaume 127, 1' },
  { t: 'Je lève mes yeux vers les montagnes : d’où me viendra le secours ?', a: 'Psaume 121, 1' },
  { t: 'Il est comme un arbre planté près d’un courant d’eau, qui donne son fruit en sa saison.', a: 'Psaume 1, 3' },
  { t: 'Qu’il est agréable, qu’il est doux pour des frères de demeurer ensemble !', a: 'Psaume 133, 1' },
  { t: 'Éloigne-toi du mal, et fais le bien ; recherche et poursuis la paix.', a: 'Psaume 34, 15' },
  { t: 'C’est ici la journée que l’Éternel a faite : qu’elle soit pour nous un sujet d’allégresse.', a: 'Psaume 118, 24' },
  { t: 'Confie-toi en l’Éternel, et pratique le bien.', a: 'Psaume 37, 3' },
  { t: 'Vous êtes la lumière du monde.', a: 'Matthieu 5, 14' },
  { t: 'Heureux ceux qui procurent la paix.', a: 'Matthieu 5, 9' },
  { t: 'Demandez, et l’on vous donnera ; cherchez, et vous trouverez ; frappez, et l’on vous ouvrira.', a: 'Matthieu 7, 7' },
  { t: 'Celui qui entend ces paroles et les met en pratique est semblable à un homme prudent qui a bâti sa maison sur le roc.', a: 'Matthieu 7, 24' },
  { t: 'Là où est ton trésor, là aussi sera ton cœur.', a: 'Matthieu 6, 21' },
  { t: 'Tu as été fidèle en peu de chose, je te confierai beaucoup.', a: 'Matthieu 25, 21' },
  { t: 'Pourquoi vois-tu la paille qui est dans l’œil de ton frère, et n’aperçois-tu pas la poutre qui est dans ton œil ?', a: 'Matthieu 7, 3' },
  { t: 'Que ta main gauche ne sache pas ce que fait ta droite.', a: 'Matthieu 6, 3' },
  { t: 'L’ouvrier mérite son salaire.', a: 'Luc 10, 7' },
  { t: 'Rien n’est impossible à Dieu.', a: 'Luc 1, 37' },
  { t: 'Tout est possible à celui qui croit.', a: 'Marc 9, 23' },
  { t: 'La lumière luit dans les ténèbres.', a: 'Jean 1, 5' },
  { t: 'Il n’y a pas de plus grand amour que de donner sa vie pour ses amis.', a: 'Jean 15, 13' },
];

(function rctCompleter() {
  if (typeof REX_CITATIONS === 'undefined') return;
  const cle = v => String(v || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  const vues = new Set(REX_CITATIONS.map(c => cle(c.t)));
  for (const c of [...RCT_CESAR_PLUS, ...RCT_EVANGILES_PSAUMES]) if (!vues.has(cle(c.t))) { REX_CITATIONS.push(c); vues.add(cle(c.t)); }
  // Elles appartiennent aussi au thème « Rome ».
  if (typeof REX_CIT_ROME !== 'undefined') REX_CIT_ROME.push(...RCT_CESAR_PLUS);
})();

// Chaque thème dit comment reconnaître ses citations. On compare les OBJETS des familles de js/57
// (une citation appartient à sa famille), et l'auteur pour les coupes transversales.
const RCT_THEMES = [
  { id: 'cesar', label: 'Jules César', test: c => /césar/i.test(c.a || '') },
  { id: 'rome', label: 'Rome et les empereurs', famille: () => typeof REX_CIT_ROME !== 'undefined' ? REX_CIT_ROME : [] },
  { id: 'grece', label: 'Grèce antique', famille: () => typeof REX_CIT_GRECE !== 'undefined' ? REX_CIT_GRECE : [] },
  { id: 'perse', label: 'Perse', famille: () => typeof REX_CIT_PERSE !== 'undefined' ? REX_CIT_PERSE : [] },
  { id: 'evangiles', label: 'Évangiles et Psaumes', test: c => /(^|\W)(matthieu|marc|luc|jean|psaume) \d/i.test(c.a || '') },
  { id: 'aquin', label: 'Thomas d’Aquin', famille: () => typeof REX_CIT_AQUIN !== 'undefined' ? REX_CIT_AQUIN : [] },
  { id: 'stoiciens', label: 'Stoïciens', test: c => /^(marc aurèle|sénèque|épictète|zénon|chrysippe)/i.test(c.a || '') },
  { id: 'rois', label: 'Rois et devises', famille: () => typeof REX_CIT_ROIS !== 'undefined' ? REX_CIT_ROIS : [] },
  { id: 'philo', label: 'Philosophes modernes', famille: () => typeof REX_CITATIONS_PHILO !== 'undefined' ? REX_CITATIONS_PHILO : [] },
];
const RCT_CLE = 'rex-citation-themes';

function rctChoisis() {
  const connus = new Set(RCT_THEMES.map(t => t.id));
  // Un thème retiré (« chretien ») ne doit pas rester coché en silence dans le navigateur.
  try { const v = JSON.parse(localStorage.getItem(RCT_CLE) || '[]'); return Array.isArray(v) ? v.filter(id => connus.has(id)) : []; } catch (e) { return []; }
}
function rctEnregistrer(ids) {
  try { localStorage.setItem(RCT_CLE, JSON.stringify(ids)); } catch (e) {}
}

// Le réservoir filtré : les indices, dans REX_CITATIONS, des citations des thèmes choisis.
// Aucun thème coché = tout le réservoir, comme avant.
function rctIndices() {
  const ids = rctChoisis();
  if (!ids.length || typeof REX_CITATIONS === 'undefined') return null;
  const cle = v => String(v || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  const textes = new Set();
  const tests = [];
  for (const th of RCT_THEMES.filter(t => ids.includes(t.id))) {
    if (th.famille) th.famille().forEach(c => textes.add(cle(c.t)));
    if (th.test) tests.push(th.test);
  }
  const out = [];
  REX_CITATIONS.forEach((c, i) => { if (textes.has(cle(c.t)) || tests.some(f => f(c))) out.push(i); });
  return out.length ? out : null;
}

function rctCompte(th) {
  const cle = v => String(v || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  if (typeof REX_CITATIONS === 'undefined') return 0;
  const textes = th.famille ? new Set(th.famille().map(c => cle(c.t))) : null;
  return REX_CITATIONS.filter(c => (textes && textes.has(cle(c.t))) || (th.test && th.test(c))).length;
}

// ── Le panneau, sur la bulle ───────────────────────────────────────────────────────────────────
function rctOuvrir(ev) {
  if (ev) ev.stopPropagation();
  const bulle = document.querySelector('#rex-citation .rex-citation-bulle');
  if (!bulle) return;
  const existant = bulle.querySelector('.rct-panneau');
  if (existant) { existant.remove(); return; }
  // Rex ne s'efface pas pendant qu'on choisit.
  if (window._rexCit) clearTimeout(window._rexCit.repli);
  const ids = rctChoisis();
  bulle.insertAdjacentHTML('beforeend', `<div class="rct-panneau" onclick="event.stopPropagation()" role="group" aria-label="Thèmes des citations">
    <div class="rct-titre">Thèmes des citations</div>
    <div class="rct-puces">${RCT_THEMES.map(t => `<label class="rct-puce ${ids.includes(t.id) ? 'on' : ''}">
      <input type="checkbox" value="${t.id}" ${ids.includes(t.id) ? 'checked' : ''} onchange="rctBasculer(this)"/>${t.label}<small>${rctCompte(t)}</small></label>`).join('')}</div>
    <div class="rct-pied">
      <button type="button" onclick="rctTout()">Tous les thèmes</button>
      <button type="button" class="rct-ok" onclick="rctAppliquer()">Nouvelle citation</button>
    </div>
  </div>`);
}

function rctBasculer(input) {
  const ids = new Set(rctChoisis());
  if (input.checked) ids.add(input.value); else ids.delete(input.value);
  rctEnregistrer([...ids]);
  input.closest('.rct-puce')?.classList.toggle('on', input.checked);
}
function rctTout() {
  rctEnregistrer([]);
  document.querySelectorAll('.rct-puce').forEach(p => { p.classList.remove('on'); const i = p.querySelector('input'); if (i) i.checked = false; });
}
function rctAppliquer() { if (typeof rexAfficherCitation === 'function') rexAfficherCitation(true); }

// ── Branchements ───────────────────────────────────────────────────────────────────────────────
(function rctBrancher() {
  if (typeof rexCitationSuivante === 'function') {
    const origine = rexCitationSuivante;
    window.rexCitationSuivante = function () {
      const pool = rctIndices();
      if (!pool) return origine.apply(this, arguments);
      let i = pool[Math.floor(Math.random() * pool.length)];
      if (pool.length > 1 && i === window._rexCit.index) i = pool[(pool.indexOf(i) + 1) % pool.length];
      window._rexCit.index = i;
      try { localStorage.setItem('rex-citation-index', String(i)); } catch (e) {}
      return REX_CITATIONS[i];
    };
  }
  if (typeof rexAfficherCitation === 'function') {
    const origine = rexAfficherCitation;
    window.rexAfficherCitation = function () {
      const r = origine.apply(this, arguments);
      const bulle = document.querySelector('#rex-citation .rex-citation-bulle');
      if (bulle && !bulle.querySelector('.rct-bouton')) {
        const n = rctChoisis().length;
        bulle.insertAdjacentHTML('beforeend', `<button type="button" class="rct-bouton" onclick="rctOuvrir(event)" aria-haspopup="true">Thèmes${n ? ` · ${n}` : ''}</button>`);
      }
      return r;
    };
  }
})();

// Le style, posé une fois : quelques règles, pas un fichier de plus.
(function rctStyles() {
  if (document.getElementById('rct-styles')) return;
  const s = document.createElement('style');
  s.id = 'rct-styles';
  s.textContent = `
    .rct-bouton { margin-top: 8px; border: 1px solid rgba(0,207,255,.35); background: rgba(0,207,255,.10); color: #7FE3FF;
      border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
    .rct-bouton:hover { background: rgba(0,207,255,.2); }
    .rct-panneau { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.12); cursor: default; }
    .rct-titre { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: #94A3B8; margin-bottom: 6px; }
    .rct-puces { display: flex; flex-wrap: wrap; gap: 5px; }
    .rct-puce { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; cursor: pointer;
      border: 1px solid rgba(255,255,255,.16); font-size: 11.5px; color: #CBD5E1; user-select: none; }
    .rct-puce input { position: absolute; opacity: 0; pointer-events: none; }
    .rct-puce small { font-size: 10px; color: #64748B; }
    .rct-puce.on { background: #00CFFF; border-color: #00CFFF; color: #06243A; }
    .rct-puce.on small { color: #0B4A66; }
    .rct-puce:focus-within { outline: 2px solid #00CFFF; outline-offset: 1px; }
    .rct-pied { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; }
    .rct-pied button { border: 0; background: none; color: #94A3B8; font: inherit; font-size: 11.5px; cursor: pointer; text-decoration: underline; }
    .rct-pied .rct-ok { text-decoration: none; background: #00CFFF; color: #06243A; border-radius: 999px; padding: 4px 12px; font-weight: 600; }`;
  document.head.appendChild(s);
})();
