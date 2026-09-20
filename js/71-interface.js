// ═══ LES QUATRE DERNIÈRES CORRECTIONS VISUELLES (20.09.2026) ═══════════════════════════════════
// Fin du chantier visuel. Quatre points, et le premier est un vrai défaut, pas une finition.
//
// 1. UN SUCCÈS S'AFFICHAIT COMME UNE ERREUR.
//    showError (js/03) peint un cadre rouge sombre et préfixe le texte d'un « ⚠ ». Or tout le CRM
//    l'utilise aussi pour annoncer les réussites : « ✓ 12 demandes envoyées » s'affichait en rouge,
//    précédé d'un avertissement. Mesuré : 60 messages commençant par ✓ passent par cette fonction.
//    Chaque action réussie ressemblait donc à un incident. On ne rebaptise pas la fonction — elle
//    est appelée de partout — on lui apprend à reconnaître ce qu'elle annonce.
//
// 2. LES ÉTATS VIDES ÉTAIENT ÉCRITS UNE PAR UNE.
//    229 « Aucun… » dans le code, contre 86 usages du bloc prévu pour ça. Un écran vide est
//    pourtant le premier qu'on voit en arrivant : c'est là qu'on explique, et c'est là qu'on met
//    le bouton qui sort de l'impasse. Un composant, utilisé partout.
//
// 3. LES ACTIONS S'AFFICHAIENT TOUTES, TOUT LE TEMPS.
//    Vingt lignes × trois boutons = soixante boutons à l'écran. Ils n'apparaissent maintenant
//    qu'au survol de leur ligne — et au clavier, dès que le focus y entre, sans quoi on rendrait
//    la page inutilisable sans souris.
//
// 4. QUATRE-VINGT-DEUX OMBRES ÉCRITES EN DUR, TROIS DANS LES JETONS.
//    Les deux variables qui existaient sont ramenées sur l'échelle, ce qui aligne d'un coup les
//    cartes du tableau de bord et celles du reste du CRM.

// ── 1. Le retour immédiat ───────────────────────────────────────────────────────────────────────

const IX_TONS = {
  succes: { fond: 'var(--c-succes-fond)', bord: 'var(--c-succes)', encre: 'var(--c-succes-texte)', signe: '✓' },
  info:   { fond: 'var(--c-info-fond)',   bord: 'var(--c-info)',   encre: 'var(--c-info-texte)',   signe: 'ℹ' },
  alerte: { fond: 'var(--c-alerte-fond)', bord: 'var(--c-alerte)', encre: 'var(--c-alerte-texte)', signe: '⚠' },
  erreur: { fond: 'var(--c-danger-fond)', bord: 'var(--c-danger)', encre: 'var(--c-danger-texte)', signe: '⚠' },
};

// Le ton se déduit du message lui-même. C'est ce qui permet de corriger soixante appels sans en
// retoucher un seul : la convention « ✓ » existait déjà partout, on lui donne enfin un sens.
function ixTonDuMessage(msg) {
  const t = String(msg || '').trim();
  if (/^[✓✔☑]/.test(t)) return 'succes';
  if (/^[ℹi]\s|^Connecte-toi|^Aucun|^Rien /i.test(t)) return 'info';
  if (/échec|erreur|impossible|refus|non enregistr|pas pu/i.test(t)) return 'erreur';
  return 'alerte';
}

function ixToast(msg, ton) {
  const t = IX_TONS[ton || ixTonDuMessage(msg)] || IX_TONS.alerte;
  let el = document.getElementById('ix-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ix-toast';
    el.className = 'ix-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.style.setProperty('--ix-fond', t.fond);
  el.style.setProperty('--ix-bord', t.bord);
  el.style.setProperty('--ix-encre', t.encre);
  // Le signe est déjà dans le texte quand il commence par ✓ : on ne le double pas.
  const texte = String(msg || '');
  el.textContent = /^[✓✔☑ℹ⚠]/.test(texte.trim()) ? texte : `${t.signe} ${texte}`;
  el.classList.remove('ix-sort');
  el.classList.add('ix-entre');
  clearTimeout(window._ixToast);
  window._ixToast = setTimeout(() => {
    el.classList.remove('ix-entre');
    el.classList.add('ix-sort');
  }, ton === 'erreur' || ixTonDuMessage(msg) === 'erreur' ? 7000 : 3800);
}

// On remplace showError sans toucher à ses 600 appels. L'écran de connexion garde son
// comportement d'origine : là, un message rouge dans le formulaire est exactement ce qu'il faut.
(function ixRemplacerShowError() {
  const origine = window.showError;
  window.showError = function (msg, ton) {
    const loginEl = document.getElementById('login-error');
    const app = document.getElementById('app');
    if (loginEl && app && !app.classList.contains('active')) {
      if (typeof origine === 'function') return origine(msg);
    }
    ixToast(msg, ton);
  };
})();

// Retour immédiat sur un bouton : il se désactive, dit ce qu'il fait, et se rend à la fin —
// quoi qu'il arrive. Sans le « finally », une erreur laisse un bouton mort à l'écran.
async function ixAction(bouton, promesse, libelleEnCours) {
  const el = typeof bouton === 'string' ? document.getElementById(bouton) : bouton;
  const avant = el ? el.innerHTML : null;
  if (el) {
    el.disabled = true;
    el.classList.add('ix-occupe');
    el.innerHTML = `<span class="ix-rouet" aria-hidden="true"></span>${libelleEnCours || 'En cours…'}`;
  }
  try { return await promesse; }
  finally {
    if (el) { el.disabled = false; el.classList.remove('ix-occupe'); if (avant !== null) el.innerHTML = avant; }
  }
}

// ── 2. L'état vide, dessiné une fois ────────────────────────────────────────────────────────────
// Trois choses, toujours dans cet ordre : ce qu'il n'y a pas, pourquoi, et quoi faire. Un écran
// vide qui ne dit que « Aucun résultat » laisse l'utilisateur sans porte de sortie.
function ixVide(opts) {
  const o = typeof opts === 'string' ? { titre: opts } : (opts || {});
  const rex = o.pose === false ? ''
    : (typeof rexPoseHtml === 'function' ? rexPoseHtml({ taille: o.petit ? 84 : 124, pose: o.pose || 'confiant', respire: false }) : '');
  return `<div class="ix-vide ${o.petit ? 'ix-vide-petit' : ''}">
    ${rex}
    <strong>${o.titre || 'Rien à afficher'}</strong>
    ${o.texte ? `<span>${o.texte}</span>` : ''}
    ${o.action ? `<div class="ix-vide-action">${o.action}</div>` : ''}
  </div>`;
}

// Le composant tableau (js/66) affiche « Aucune ligne » en dur. On lui donne le bloc dessiné,
// sans toucher à son code : toutes les listes qui l'adoptent en héritent d'un coup.
(function ixHabillerTableauVide() {
  if (typeof tblPeindre !== 'function') return;
  const origine = tblPeindre;
  window.tblPeindre = function (id) {
    origine(id);
    const zone = document.getElementById(id);
    const vide = zone && zone.querySelector('.tbl-vide');
    if (!vide) return;
    const e = window._tbl && window._tbl[id];
    const texte = (e && e.config && e.config.vide) || null;
    const recherche = e && e.recherche;
    vide.innerHTML = ixVide(recherche
      ? { titre: 'Aucune ligne ne correspond', texte: `Rien ne contient « ${tblEsc(recherche)} ». Essaie avec moins de mots.`, petit: true, pose: 'reflexion' }
      : { titre: texte || 'Cette liste est vide', petit: true });
  };
})();

// ── 3. Les actions au survol ────────────────────────────────────────────────────────────────────
// Rien à écrire en JS : c'est du CSS (css/99-interface.css). Les familles de lignes déjà en place
// sont listées là-bas, et toute nouvelle liste n'a qu'à porter la classe .actions-survol.

// ── 4. Un raccourci pour les listes ─────────────────────────────────────────────────────────────
// Beaucoup d'écrans testent « si vide, afficher un message ». On en fait une ligne.
function ixListe(lignes, rendu, vide) {
  if (!lignes || !lignes.length) return ixVide(vide);
  return lignes.map(rendu).join('');
}
