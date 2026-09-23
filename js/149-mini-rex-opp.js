// ═══ MINI REX SUR LA FICHE D'AFFAIRE (23.09.2026) ═══════════════════════════════════════════════
// « Dans l'opp, mets un mini Rex qui exécute la même séquence mais adaptée en petit. »
//
// Même séquence que l'assistant de l'espace client (js/112) : le nuage dérive, s'immobilise, repart
// — l'animation passe l'essentiel de son cycle à l'arrêt, c'est ce qui le rend vivant plutôt
// qu'agité — et une bulle sort quelques secondes de temps en temps. Deux tiers de la taille, dans
// le bandeau bleu de l'affaire.
//
// CE QU'IL DIT, LUI, EST DIFFÉRENT. Chez le client, Rex dit « demandez-moi » : c'est une invitation.
// Ici le lecteur est le courtier, et une bulle décorative sur un écran de travail devient vite un
// bandeau qu'on ne lit plus. Ses phrases sont donc CELLES DE L'AFFAIRE, reprises du parcours
// (js/90) : le but de l'étape en cours, puis ce qui manque pour passer à la suivante. Un clic
// descend sur « ce qu'il reste à faire ».
//
// Il se tait quand le système demande moins d'animations, et quand la fiche disparaît.

const MRX_IMG = 'assets/logos/rex/logo-cloud/embleme.png';

function mrxPhrases(o) {
  const ph = [];
  if (o.stade === 'Perdu') return ['Affaire perdue — elle se rouvre d’un clic.'];
  if (o.stade === 'Gagné') {
    if (!o.contrat_id) ph.push('Il manque encore le contrat au portefeuille.');
    if (o.resiliation_requise && !o.resiliation_envoyee_le) ph.push('La résiliation de l’ancien contrat n’est pas partie.');
    if (!ph.length) ph.push('Affaire bouclée, contrat relié. Rien ne traîne.');
    return ph;
  }

  const m = typeof pafManques === 'function' ? pafManques(o) : {};
  const inconnu = typeof PAF_INCONNU !== 'undefined' ? PAF_INCONNU : '\u0000';
  const etape = (typeof PAF_ETAPES !== 'undefined' && PAF_ETAPES[typeof pafEtapeCourante === 'function' ? pafEtapeCourante(o) : 0]) || null;
  if (etape) {
    ph.push(etape.but);
    etape.requis.forEach(r => { if (m[r] && m[r] !== inconnu) ph.push(m[r] + '.'); });
  }

  const recues = (typeof opToutesEntrees === 'function' ? opToutesEntrees(o.id) : [])
    .filter(x => x.e && (x.e.prime || x.e.recue_le));
  if (recues.some(x => x.e.retenue)) ph.push('Offre retenue — le comparatif peut partir au client.');
  else if (recues.length > 1) ph.push(`${recues.length} offres reçues : compare-les et retiens-en une.`);

  if (!ph.length) ph.push('Tout est en ordre sur cette affaire.');
  return ph;
}

function mrxClic(oppId) {
  const cible = document.getElementById('paf-bandeau-' + oppId)
    || document.querySelector('.opx-grille .paf-bandeau, .opx-grille .opx-carte');
  if (!cible) return;
  cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
  cible.classList.add('mrx-vise');
  setTimeout(() => cible.classList.remove('mrx-vise'), 1800);
}

// La séquence : une phrase, quatre secondes, puis le silence. Les intervalles sont volontairement
// longs — une bulle qui revient toutes les cinq secondes se fait fermer, pas lire.
function mrxVivre(bulle, o) {
  if (!bulle || bulle._vit) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  bulle._vit = true;
  let i = 0;
  const parler = () => {
    if (!document.body.contains(bulle)) return;          // on a quitté la fiche
    const ph = mrxPhrases(o);                            // relues à chaque fois : l'affaire bouge
    bulle.textContent = ph[i++ % ph.length];
    bulle.classList.add('visible');
    setTimeout(() => bulle.classList.remove('visible'), 4600);
    setTimeout(parler, 15000 + Math.random() * 8000);
  };
  setTimeout(parler, 2000);
}

function mrxPoser(o) {
  const haut = document.querySelector('.opx-hero .fcx-hero-haut');
  if (!haut || haut.querySelector('.mrx')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mrx';
  b.setAttribute('aria-label', 'Ce qu’il reste à faire sur cette affaire');
  b.innerHTML = `<span class="mrx-bulle" aria-hidden="true"></span><img src="${MRX_IMG}" alt="" aria-hidden="true"/>`;
  b.onclick = () => mrxClic(o.id);
  haut.appendChild(b);
  mrxVivre(b.querySelector('.mrx-bulle'), o);
}

(function mrxBrancher() {
  if (typeof viewFicheOpportunite !== 'function') return;
  const origine = viewFicheOpportunite;
  window.viewFicheOpportunite = function (o) {
    const html = origine.apply(this, arguments);
    if (o && o.id) setTimeout(() => mrxPoser(o), 0);
    return html;
  };
})();
