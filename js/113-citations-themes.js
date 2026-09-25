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

// EB Garamond, pour le parchemin et lui seul. Chargée ici plutôt que dans index.html : elle ne
// sert qu'à cet objet, et une citation ne s'affiche pas à chaque écran. Le texte reste lisible
// pendant le chargement (display=swap) — il s'affiche en Palatino puis bascule.
(function rctPolice() {
  if (document.getElementById('rct-police')) return;
  const l = document.createElement('link');
  l.id = 'rct-police';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap';
  document.head.appendChild(l);
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
    .rct-pied .rct-ok { text-decoration: none; background: #00CFFF; color: #06243A; border-radius: 999px; padding: 4px 12px; font-weight: 600; }

    /* ── Le parchemin (21.09.2026, refait le 25.09.2026) ─────────────────────────────────────────
       « Les citations s'ouvrent dans un parchemin à l'ancienne, adapté au texte », puis
       « utilise un meilleur rendu, change aussi la police, trouve mieux ».

       Ce qui manquait à la première version : la MATIÈRE. Trois dégradés plats donnaient une
       couleur de parchemin, pas du parchemin. Un vélin, ça a des fibres qui courent en travers,
       des taches d'âge qui ne sont jamais au centre, et une feuille qui s'enroule sous la tige.
       Les fibres viennent d'un bruit SVG étiré à l'horizontale (feTurbulence) : une seule image
       vectorielle, nette à tous les grossissements, et qui ne pèse rien.

       LA POLICE. Elle suivait --police-titres, c'est-à-dire le thème que l'agent a choisi pour le
       CRM : un parchemin en Inter, ça ne veut rien dire. Le parchemin est un OBJET — il garde sa
       typographie quoi qu'on règle ailleurs, comme il garde son aspect en thème clair et sombre.
       EB Garamond : c'est la reprise du caractère gravé par Claude Garamond à Paris vers 1540,
       donc exactement l'écriture de l'époque qu'on imite, et son italique — la citation est en
       italique — est l'une des plus belles qui soient. Palatino reste en secours. */
    #rex-citation .rex-citation-bulle {
      --rct-encre: #3A2A15;
      width: max-content; max-width: min(360px, calc(100vw - 120px));
      margin: 14px 4px; padding: 26px 32px 24px 28px; border: 0; border-radius: 2px;
      background:
        /* Fibres du vélin : un bruit très étiré en largeur, donc des filaments horizontaux. */
        url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='v'><feTurbulence type='fractalNoise' baseFrequency='0.95 0.035' numOctaves='3' seed='11'/><feColorMatrix values='0 0 0 0 0.40 0 0 0 0 0.28 0 0 0 0 0.10 0 0 0 0.55 0'/></filter><rect width='260' height='260' filter='url(%23v)'/></svg>"),
        /* Taches d'âge : jamais centrées, jamais de la même taille. */
        radial-gradient(ellipse 60% 40% at 18% 12%, rgba(255, 252, 238, .80), transparent 70%),
        radial-gradient(ellipse 34% 22% at 88% 24%, rgba(150, 102, 34, .16), transparent 72%),
        radial-gradient(ellipse 46% 30% at 72% 92%, rgba(132, 88, 26, .20), transparent 74%),
        radial-gradient(ellipse 22% 16% at 8% 74%, rgba(160, 118, 48, .13), transparent 76%),
        linear-gradient(176deg, #F7E9C6 0%, #EFDCAE 48%, #E5CB93 82%, #DCBF83 100%);
      background-size: 260px 260px, auto, auto, auto, auto, auto;
      color: var(--rct-encre);
      font-family: "EB Garamond", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
      box-shadow:
        /* L'enroulement sous les tiges : la feuille s'assombrit en haut et en bas. */
        inset 0 11px 14px -9px rgba(94, 62, 16, .55),
        inset 0 -11px 14px -9px rgba(94, 62, 16, .55),
        inset 0 0 30px rgba(120, 80, 20, .26),
        inset 0 0 1px rgba(90, 60, 20, .50),
        0 18px 34px rgba(40, 25, 5, .34);
      animation: rctDerouler .8s cubic-bezier(.22, .78, .2, 1) both;
    }
    #rex-citation .rex-citation-bulle:hover { transform: none; }
    /* Les tiges : un bois tourné, avec ses veines et ses embouts qui dépassent. */
    #rex-citation .rex-citation-bulle::before, #rex-citation .rex-citation-bulle::after {
      content: ''; position: absolute; left: -11px; right: -11px; height: 14px; border-radius: 7px; pointer-events: none;
      background:
        repeating-linear-gradient(90deg, rgba(90, 58, 16, .16) 0 2px, transparent 2px 9px),
        linear-gradient(180deg, #A87C3C 0%, #E9D2A0 34%, #F6E8C4 46%, #C9A25E 66%, #8A6428 100%);
      box-shadow:
        0 2px 5px rgba(50, 30, 5, .38),
        inset 0 0 0 1px rgba(80, 52, 14, .22),
        /* Les deux embouts, un peu plus sombres que la tige. */
        -4px 0 0 -1px #8A6428, 4px 0 0 -1px #8A6428;
    }
    #rex-citation .rex-citation-bulle::before { top: -9px; }
    #rex-citation .rex-citation-bulle::after { bottom: -9px; }
    #rex-citation .rex-citation-texte {
      font-size: 17px; line-height: 1.5; font-style: italic; font-weight: 400;
      text-align: center; text-wrap: balance; letter-spacing: .005em;
    }
    #rex-citation.grande .rex-citation-texte { font-size: 18.5px; }
    #rex-citation .rex-citation-trad { color: #6A5130; text-align: center; font-size: 13.5px; font-style: italic; margin-top: 4px; }
    /* Un filet et un losange séparent la citation de son auteur, comme sur une page gravée. */
    #rex-citation .rex-citation-auteur {
      color: #7A4A12; font-variant: small-caps; letter-spacing: .07em; font-size: 13.5px;
      text-align: right; margin-top: 13px; padding-top: 9px; position: relative;
    }
    #rex-citation .rex-citation-auteur::before {
      content: '◆'; position: absolute; top: 1px; left: 50%; transform: translateX(-50%);
      font-size: 7px; color: rgba(122, 74, 18, .55); letter-spacing: 0;
    }
    #rex-citation .rex-citation-auteur::after {
      content: ''; position: absolute; top: 5px; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(122, 74, 18, .30) 22%, rgba(122, 74, 18, .30) 78%, transparent);
    }
    #rex-citation .rex-citation-fermer { color: #7A5A2A; }
    #rex-citation .rex-citation-fermer:hover { background: rgba(122, 74, 18, .12); }
    #rex-citation .rct-bouton { border-color: rgba(122, 74, 18, .4); background: rgba(122, 74, 18, .08); color: #7A4A12; font-family: system-ui, sans-serif; }
    #rex-citation .rct-panneau { border-top-color: rgba(122, 74, 18, .25); font-family: system-ui, sans-serif; }
    #rex-citation .rct-titre { color: #7A5A2A; }
    #rex-citation .rct-puce { border-color: rgba(122, 74, 18, .3); color: #4A3418; }
    #rex-citation .rct-puce small { color: #9C7A48; }
    #rex-citation .rct-puce.on { background: #7A4A12; border-color: #7A4A12; color: #FBEFD2; }
    #rex-citation .rct-puce.on small { color: #E8CF9A; }
    #rex-citation .rct-pied button { color: #7A5A2A; }
    #rex-citation .rct-pied .rct-ok { background: #7A4A12; color: #FBEFD2; }
    @keyframes rctDerouler {
      from { clip-path: inset(-14px -14px calc(100% - 8px) -14px); }
      to { clip-path: inset(-14px -14px -14px -14px); }
    }
    @media (prefers-reduced-motion: reduce) { #rex-citation .rex-citation-bulle { animation: none; } }
    /* ── Téléphone (22.09.2026 — « trop invasif et grand ») ──────────────────────────────────────
       Le parchemin gardait sa taille d'ordinateur : texte à 16,5 px, marges de 32 px, Rex de
       68 px — il couvrait le tiers bas de l'écran. Ici : un rouleau serré, Rex en vignette, et la
       citation se lit sans masquer les boutons du bas. */
    @media (max-width: 620px) {
      #rex-citation { right: 8px; bottom: calc(72px + env(safe-area-inset-bottom, 0px)); gap: 4px; max-width: calc(100vw - 16px); }
      #rex-citation .rex-citation-bulle { max-width: min(280px, calc(100vw - 70px)); margin: 6px 2px; padding: 11px 22px 10px 13px; }
      #rex-citation .rex-citation-bulle::before, #rex-citation .rex-citation-bulle::after { left: -5px; right: -5px; height: 9px; border-radius: 5px; }
      #rex-citation .rex-citation-bulle::before { top: -4px; }
      #rex-citation .rex-citation-bulle::after { bottom: -4px; }
      /* EB Garamond a un œil plus petit que Palatino : à taille égale elle paraît plus fine.
         On remonte donc d'un demi-point sur téléphone plutôt que de garder les 13 px d'avant. */
      #rex-citation .rex-citation-texte, #rex-citation.grande .rex-citation-texte { font-size: 14px; line-height: 1.42; }
      #rex-citation .rex-citation-trad { font-size: 12px; }
      #rex-citation .rex-citation-auteur { font-size: 11.5px; margin-top: 7px; padding-top: 6px; }
      #rex-citation .rex-citation-auteur::before { font-size: 6px; }
      #rex-citation .rex-citation-auteur::after { top: 3px; }
      #rex-citation .rex-citation-fermer { top: 3px; right: 4px; font-size: 16px; }
      #rex-citation img, #rex-citation.grande img { width: 40px; height: 40px; }
      #rex-citation .rct-bouton { font-size: 10.5px !important; padding: 2px 9px !important; margin-top: 5px; min-height: 0 !important; min-width: 0 !important; line-height: 1.4; }
      #rex-citation .rex-citation-bulle { max-width: min(262px, calc(100vw - 70px)); }
    }`;
  document.head.appendChild(s);
})();
