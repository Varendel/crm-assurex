// ═══ REX — LA GALERIE DE POSES (20.09.2026) ════════════════════════════════════════════════════
// Jonathan a fait produire une planche de douze poses (assets/logos/rex/_planche.png). Elles ont
// été découpées cellule par cellule, fond blanc retiré par remplissage depuis les bords — un
// simple seuil sur le blanc aurait troué les yeux du personnage.
//
// Cette galerie remplace le montage articulé de ce matin (tête découpée du sprite assis et
// pivotée sur la nuque). Ce bricolage n'a plus lieu d'être : on a maintenant de vraies postures,
// dessinées, y compris celles qui étaient hors de portée d'un découpage — debout, en marche,
// de dos. Les accessoires ajoutés en SVG (monocle, nœud papillon) disparaissent aussi : ils
// étaient calés sur l'ancien sprite, et le personnage n'en a plus besoin pour se lire.
//
// Chaque pose porte l'intention qu'elle sert : on choisit une pose parce qu'elle dit quelque
// chose à cet endroit-là, pas pour décorer.

const REX_DOSSIER = 'assets/logos/rex/poses/';

const REX_POSES = {
  debout:       { f: 'debout.png',       titre: 'Rex',                      usage: 'présence neutre' },
  pouce:        { f: 'pouce.png',        titre: 'Rex vous félicite',        usage: 'confirmation, réussite' },
  montre:       { f: 'montre.png',       titre: 'Rex vous montre',          usage: 'désigner, guider vers une action' },
  ordinateur:   { f: 'ordinateur.png',   titre: 'Rex au travail',           usage: 'traitement, productivité' },
  joie:         { f: 'joie.png',         titre: 'Rex est ravi',             usage: 'objectif atteint' },
  planification:{ f: 'planification.png',titre: 'Rex prépare votre dossier',usage: 'conseil, analyse, checklist' },
  reflexion:    { f: 'reflexion.png',    titre: 'Rex réfléchit',            usage: 'stratégie, arbitrage' },
  marche:       { f: 'marche.png',       titre: 'Rex avance',               usage: 'chargement, progression' },
  concentre:    { f: 'concentre.png',    titre: 'Rex est concentré',        usage: 'calcul, simulation' },
  confiant:     { f: 'confiant.png',     titre: 'Rex vous écoute',          usage: 'fiabilité, attente' },
  deDos:        { f: 'de-dos.png',       titre: 'Rex veille',               usage: 'suivi, veille discrète' },
  enthousiaste: { f: 'enthousiaste.png', titre: 'Rex saute de joie',        usage: 'bonne nouvelle' },
};

const REX_POSE_DEFAUT = 'debout';

function rexbEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function rexPoseFichier(nom) {
  const p = REX_POSES[nom] || REX_POSES[REX_POSE_DEFAUT];
  return REX_DOSSIER + p.f;
}

// Bloc à insérer dans une page. `taille` est la hauteur en pixels ; la largeur suit le dessin.
//   pose    : une clé de REX_POSES
//   respire : léger flottement, pour que le personnage ne soit pas tout à fait figé
function rexPoseHtml(opts) {
  const o = opts || {};
  const nom = REX_POSES[o.pose] ? o.pose : REX_POSE_DEFAUT;
  const p = REX_POSES[nom];
  const taille = Number(o.taille) || 120;
  const titre = o.titre || p.titre;
  const classes = ['rexb', `rexb-${nom}`, o.classe || '', o.respire === false ? '' : 'respire'].filter(Boolean).join(' ');
  // Habillage saisonnier (js/62) : on tente la planche de la saison, et le navigateur retombe
  // tout seul sur la pose normale si elle n'a pas encore été livrée.
  const s = typeof saisonSourceRex === 'function' ? saisonSourceRex(nom) : null;
  const src = s ? s.src : rexPoseFichier(nom);
  const repli = s && s.repli ? ` onerror="this.onerror=null;this.src='${s.repli}'"` : '';
  return `<img class="${classes}" src="${src}"${repli} alt="" role="img" aria-label="${rexbEsc(titre)}" title="${rexbEsc(titre)}" style="height:${taille}px" loading="lazy"/>`;
}

// ── Les compagnons (20.09.2026) ─────────────────────────────────────────────────────────────────
// Rodolphe n'est pas une pose de Rex : c'est un second personnage, et il n'existe QUE dans les
// planches saisonnières. Le mécanisme de repli des poses ne lui convient donc pas — replier vers
// « assets/logos/rex/poses/rodolphe.png » afficherait une image cassée, ce fichier n'existant pas.
//
// Les compagnons déclarent donc les saisons où ils existent, et disparaissent le reste de l'année
// au lieu de se replier. C'est la différence entre « cette pose n'est pas encore dessinée » et
// « ce personnage n'a rien à faire ici en avril ».
const REX_COMPAGNONS = {
  rodolphe: { f: 'rodolphe.png', titre: 'Rodolphe', saisons: ['noel', 'halloween'] },
};

function rexCompagnonHtml(nom, opts) {
  const o = opts || {};
  const c = REX_COMPAGNONS[nom];
  const s = typeof saisonCourante === 'function' ? saisonCourante() : null;
  if (!c || !s || !c.saisons.includes(s.cle)) return '';
  const taille = Number(o.taille) || 120;
  const titre = o.titre || `${c.titre} · ${s.nom}`;
  return `<img class="rexb rexb-compagnon ${o.classe || ''} ${o.respire === false ? '' : 'respire'}"
    src="${s.dossierRex + c.f}" alt="" role="img" aria-label="${rexbEsc(titre)}" title="${rexbEsc(titre)}"
    style="height:${taille}px" loading="lazy"/>`;
}

// Rex et son compagnon côte à côte. Rodolphe est légèrement plus petit et en retrait : il
// accompagne Rex, il ne le remplace pas — c'est la mascotte du CRM qui doit rester lue en premier.
function rexDuoHtml(opts) {
  const o = opts || {};
  const taille = Number(o.taille) || 120;
  const compagnon = rexCompagnonHtml(o.compagnon || 'rodolphe', { taille: Math.round(taille * 0.84), respire: o.respire });
  if (!compagnon) return rexPoseHtml(o);
  return `<span class="rexb-duo">${rexPoseHtml(o)}${compagnon}</span>`;
}

// Rex du conseil financier : la pose « planification », celle qui tient le dossier.
function rexBanquierHtml(opts) {
  const o = opts || {};
  return rexPoseHtml({ ...o, pose: o.pose || 'planification' });
}

// Bandeau d'accueil : Rex + une phrase de contexte + une action éventuelle.
function rexBanquierBandeau(texte, boutonHtml, pose) {
  return `<div class="rexb-bandeau">
    ${rexPoseHtml({ taille: 104, pose: pose || 'planification' })}
    <div class="rexb-bandeau-texte">${texte || ''}</div>
    ${boutonHtml || ''}
  </div>`;
}
