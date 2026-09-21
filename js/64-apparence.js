// ═══ APPARENCE : DENSITÉ, SAISONS, JETONS (20.09.2026) ═════════════════════════════════════════
// Demande de Jonathan : que les thèmes soient visibles et essayables depuis les paramètres.
// Un habillage qu'on ne peut voir qu'à sa date ne se valide jamais — on le découvre le 1er
// décembre, en production, devant les clients.
//
// Trois réglages, tous retenus sur l'appareil :
//   Densité   confortable ou compact. Un courtier qui traite quarante lignes veut en voir quarante.
//   Saison    automatique, aucune, ou imposée pour essayer hors période.
//   Jetons    la palette affichée telle qu'elle est réellement définie, pas redessinée à côté.
//
// La palette ci-dessous n'est pas une capture : elle lit les variables CSS appliquées. Si un jeton
// change dans css/000-jetons.css, cette page le montre sans qu'on y touche. C'est la seule façon
// qu'une documentation de design reste vraie.

const APX_DENSITES = [
  { cle: 'confortable', nom: 'Confortable', desc: 'Lignes aérées, lecture reposante' },
  { cle: 'compact', nom: 'Compact', desc: 'Un tiers de lignes en plus à l’écran' },
];

const APX_JETONS = [
  { groupe: 'Marque', vars: ['--m-marine', '--m-marine-fonce', '--m-marine-nuit', '--m-turquoise', '--m-turquoise-doux', '--m-or'] },
  { groupe: 'Intentions', vars: ['--c-succes', '--c-alerte', '--c-danger', '--c-info', '--c-neutre'] },
  { groupe: 'Gris', vars: ['--g-0', '--g-50', '--g-100', '--g-200', '--g-300', '--g-400', '--g-500', '--g-700', '--g-900'] },
];

function apxEsc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function apxDensite() {
  try { return localStorage.getItem('rex-densite') || 'confortable'; } catch (e) { return 'confortable'; }
}
function apxAppliquerDensite(cle) {
  try { localStorage.setItem('rex-densite', cle); } catch (e) {}
  document.body.setAttribute('data-densite', cle === 'compact' ? 'compact' : 'confortable');
  if (typeof navigate === 'function' && currentView === 'apparence') navigate('apparence');
}

// Lecture de la valeur réellement calculée par le navigateur
function apxValeur(nom) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(nom).trim(); } catch (e) { return ''; }
}

function apxSectionHtml() {
  const densite = apxDensite();
  const curseurActif = typeof curActif === 'function' ? curActif() : false;
  const forcee = typeof saisonForcee === 'function' ? saisonForcee() : '';
  const active = typeof saisonActive === 'function' ? saisonActive() : null;
  const courante = typeof saisonCourante === 'function' ? saisonCourante() : null;

  const saisons = [
    { cle: '', nom: 'Automatique', desc: active ? `en ce moment : ${active.nom}` : 'aucune période en cours' },
    { cle: 'aucune', nom: 'Aucune', desc: 'le CRM reste neutre toute l’année' },
    ...(typeof SAISONS !== 'undefined' ? SAISONS.map(s => ({
      cle: s.cle, nom: s.nom,
      desc: `du ${s.debut.jour}.${String(s.debut.mois).padStart(2, '0')} au ${s.fin.jour}.${String(s.fin.mois).padStart(2, '0')}`,
    })) : []),
  ];

  const carteDensite = APX_DENSITES.map(d => `
    <button type="button" class="apx-carte ${densite === d.cle ? 'actif' : ''}" onclick="apxAppliquerDensite('${d.cle}')">
      <span class="apx-apercu apx-apercu-${d.cle}"><i></i><i></i><i></i><i></i></span>
      <b>${d.nom}${densite === d.cle ? ' ✓' : ''}</b><small>${d.desc}</small>
    </button>`).join('');

  const carteSaison = saisons.map(s => `
    <button type="button" class="apx-carte ${forcee === s.cle ? 'actif' : ''}" onclick="saisonImposer('${s.cle}')">
      <span class="apx-saison-icone">${s.cle === 'aucune' ? '—' : ((typeof SAISONS !== 'undefined' && (SAISONS.find(x => x.cle === s.cle) || {}).decors || ['🗓️'])[0])}</span>
      <b>${s.nom}${forcee === s.cle ? ' ✓' : ''}</b><small>${apxEsc(s.desc)}</small>
    </button>`).join('');

  const poses = ['debout', 'pouce', 'planification', 'joie', 'reflexion'];
  const apercuRex = typeof rexPoseHtml === 'function'
    ? poses.map(p => `<span class="apx-rex">${rexPoseHtml({ taille: 92, pose: p, respire: false })}<small>${p}</small></span>`).join('')
      // Rodolphe n'apparaît que si la saison affichée le prévoit : inutile de montrer une case
      // vide le reste de l'année.
      + (typeof rexCompagnonHtml === 'function' && rexCompagnonHtml('rodolphe', { taille: 92, respire: false })
        ? `<span class="apx-rex apx-rex-compagnon">${rexCompagnonHtml('rodolphe', { taille: 92, respire: false })}<small>rodolphe</small></span>` : '')
    : '';

  const palette = APX_JETONS.map(g => `
    <div class="apx-groupe">
      <h4>${g.groupe}</h4>
      <div class="apx-pastilles">
        ${g.vars.map(v => {
          const val = apxValeur(v);
          return `<span class="apx-pastille" title="${v} = ${val}">
            <i style="background:${val}"></i><b>${v.replace(/^--[a-z]-/, '')}</b><small>${apxEsc(val)}</small></span>`;
        }).join('')}
      </div>
    </div>`).join('');

  return `
  <section class="dbx-carte apx-section">
    <header class="dbx-carte-tete"><div><h2>Densité d’affichage</h2>
      <span class="dbx-carte-sous">Combien d’informations tiennent à l’écran</span></div></header>
    <div class="apx-cartes">${carteDensite}</div>
  </section>

  <section class="dbx-carte apx-section">
    <header class="dbx-carte-tete"><div><h2>Habillage saisonnier</h2>
      <span class="dbx-carte-sous">Espace client et mascotte${courante ? ` · actuellement : ${courante.nom}` : ' · actuellement : neutre'}</span></div></header>
    <div class="apx-cartes">${carteSaison}</div>
    ${apercuRex ? `<div class="apx-rex-ligne">${apercuRex}</div>
      <p class="apx-note">Rex reprend automatiquement sa pose normale tant que la planche de la saison n’a pas été livrée : les poses peuvent arriver une par une.</p>` : ''}
  </section>

  <section class="dbx-carte apx-section">
    <header class="dbx-carte-tete"><div><h2>Pointeur de souris</h2>
      <span class="dbx-carte-sous">Une flèche aux couleurs de l’accent, légèrement assombrie</span></div></header>
    <div class="apx-curseur">
      <span class="apx-curseur-apercu">${curseurActif
        ? '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M5 2 L5 20.5 L9.8 16.1 L12.9 23.2 L16.1 21.8 L13.1 14.9 L19.6 14.4 Z" fill="var(--accent)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" style="filter:brightness(.72)"/></svg>'
        : '<span style="opacity:.4">—</span>'}</span>
      <button type="button" class="apx-carte ${curseurActif ? 'actif' : ''}" style="flex:0 1 240px" onclick="curBasculer(${curseurActif ? 'false' : 'true'})">
        <b>${curseurActif ? 'Activé ✓' : 'Désactivé'}</b>
        <small>La main du survol et le curseur de saisie restent ceux du système : ils portent une information, on ne les habille pas.</small>
      </button>
    </div>
  </section>

  <section class="dbx-carte apx-section">
    <header class="dbx-carte-tete"><div><h2>Jetons de design</h2>
      <span class="dbx-carte-sous">Les valeurs réellement appliquées, lues dans la feuille de style</span></div></header>
    ${palette}
    <p class="apx-note">Ces valeurs viennent de <code>css/000-jetons.css</code>. Elles ne sont pas recopiées ici : cette page les lit, donc elle ne peut pas mentir. Changer une couleur à cet endroit la change partout dans le CRM.</p>
  </section>`;
}

// Applique la densité retenue au démarrage, avant le premier rendu.
(function apxDemarrer() {
  const poser = () => { if (document.body) document.body.setAttribute('data-densite', apxDensite() === 'compact' ? 'compact' : 'confortable'); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
})();
