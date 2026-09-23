// ═══ TRAVAILLER SUR DEUX DOSSIERS À LA FOIS (23.09.2026) ════════════════════════════════════════
// « L'idée serait de pouvoir travailler sur plusieurs dossiers si je reçois un appel. »
//
// Le besoin n'est pas « scinder l'écran », c'est GARDER le dossier en main et en ouvrir un autre à
// côté. Le téléphone sonne au sujet d'un autre client : jusqu'ici il fallait quitter la fiche en
// cours, la retrouver ensuite, et ce qui était à moitié saisi était perdu.
//
// Deux réponses, selon qu'on a un ou deux écrans :
//   · NOUVELLE FENÊTRE — une seconde fenêtre du CRM, à coller où l'on veut (Win + →) ou sur le
//     second écran. La session est partagée, donc pas de reconnexion.
//   · DEUX VOLETS — la fenêtre du CRM coupée en deux, chacun avec SON menu, sa recherche et sa
//     navigation, et une poignée au milieu pour ajuster le partage.
//
// POURQUOI UN IFRAME, et pas deux vues dans la même page. Les 150 modules du CRM travaillent sur un
// état global unique (currentView, currentClientId, allClients…). Deux vues côte à côte dans la
// même page se marcheraient dessus à la première navigation — et pas de façon visible : on
// croirait consulter deux dossiers alors qu'on en modifie un seul. Le volet de droite est donc une
// seconde instance du CRM, réellement indépendante. C'est plus lourd en mémoire, et c'est le prix
// d'une séparation qui tient.
//
// LIEN PROFOND. Le CRM n'en avait aucun : l'adresse ne portait jamais l'écran courant, donc toute
// seconde fenêtre s'ouvrait sur le tableau de bord. `?client=` / `?affaire=` / `?vue=` ouvrent
// maintenant directement le bon dossier — sans quoi les deux fonctions perdent leur intérêt.

const DV_MIN_LARGEUR = 1100;   // en dessous, deux volets ne montrent plus rien d'utile
const DV_CLE = 'rex-volets-part';

function dvParam(n) { try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; } }
function dvEstVolet() { return dvParam('volet') === '2'; }

// ── Le lien profond ─────────────────────────────────────────────────────────────────────────────
function dvCibleCourante() {
  if (typeof currentView !== 'undefined' && currentView === 'nouvelle-opportunite'
    && typeof opportuniteEnEditionId !== 'undefined' && opportuniteEnEditionId) return { k: 'affaire', v: opportuniteEnEditionId };
  if (typeof currentClientId !== 'undefined' && currentClientId
    && typeof currentView !== 'undefined' && currentView === 'client') return { k: 'client', v: currentClientId };
  return { k: 'vue', v: (typeof currentView !== 'undefined' && currentView) || 'dashboard' };
}

function dvLien(cible, volet) {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  if (cible && cible.v) u.searchParams.set(cible.k, cible.v);
  if (volet) u.searchParams.set('volet', '2');
  return u.toString();
}

// L'écran demandé ne peut s'ouvrir qu'une fois la session ouverte et les données chargées : on
// attend que l'application soit réellement là plutôt que de tenter et d'échouer en silence.
async function dvAppliquerLien() {
  const cible = dvParam('client') ? { k: 'client', v: dvParam('client') }
    : dvParam('affaire') ? { k: 'affaire', v: dvParam('affaire') }
    : dvParam('vue') ? { k: 'vue', v: dvParam('vue') } : null;
  if (!cible) return;
  for (let i = 0; i < 120; i++) {
    const app = document.getElementById('app');
    const pret = app && getComputedStyle(app).display !== 'none'
      && typeof allClients !== 'undefined' && Array.isArray(allClients) && allClients.length;
    if (pret) break;
    await new Promise(r => setTimeout(r, 300));
  }
  try {
    if (cible.k === 'client' && typeof showClient === 'function') await showClient(cible.v);
    else if (cible.k === 'affaire' && typeof editerOpportunite === 'function') editerOpportunite(cible.v);
    else if (typeof navigate === 'function') await navigate(cible.v);
  } catch (e) { console.warn('Lien profond', e); }
}

// ── Nouvelle fenêtre ────────────────────────────────────────────────────────────────────────────
function dvNouvelleFenetre() {
  const f = window.open(dvLien(dvCibleCourante(), false), 'rex-' + Date.now(),
    `width=${Math.min(1400, screen.availWidth)},height=${Math.min(950, screen.availHeight)}`);
  if (!f) showError('Autorise les fenêtres pop-up pour ouvrir une seconde fenêtre du CRM.');
}

// ── Deux volets ─────────────────────────────────────────────────────────────────────────────────
function dvPart() {
  const v = Number(localStorage.getItem(DV_CLE));
  return Number.isFinite(v) && v >= 25 && v <= 75 ? v : 50;
}

function dvBasculer() {
  if (document.body.classList.contains('dv-actif')) return dvFermer();
  if (window.innerWidth < DV_MIN_LARGEUR) {
    showError(`Deux volets demandent au moins ${DV_MIN_LARGEUR} px de large — sur téléphone, utilise plutôt « Nouvelle fenêtre ».`);
    return;
  }
  const part = dvPart();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="dv-poignee" id="dv-poignee" title="Tirer pour ajuster" role="separator" aria-orientation="vertical"></div>
    <div class="dv-volet" id="dv-volet">
      <div class="dv-barre"><span>2ᵉ dossier</span>
        <button type="button" onclick="dvFermer()" title="Fermer le second volet" aria-label="Fermer">✕</button></div>
      <iframe id="dv-cadre" title="Second dossier" src="${dvLien(null, true)}"></iframe>
    </div>`);
  document.body.classList.add('dv-actif');
  const b = document.getElementById('dv-b-volets');
  if (b) b.textContent = '⫽ Fermer le 2ᵉ volet';
  dvPoser(part);
  dvTirer();
}

function dvPoser(part) {
  document.documentElement.style.setProperty('--dv-part', part + '%');
  try { localStorage.setItem(DV_CLE, String(Math.round(part))); } catch (e) { /* stockage indisponible */ }
}

function dvFermer() {
  document.body.classList.remove('dv-actif');
  document.getElementById('dv-volet')?.remove();
  document.getElementById('dv-poignee')?.remove();
  const b = document.getElementById('dv-b-volets');
  if (b) b.textContent = '⫽ Deux volets';
}

// La poignée : pendant le glissement, l'iframe cesse de recevoir la souris — sans ça le curseur
// entre dedans au premier pixel et le glissement se fige.
function dvTirer() {
  const p = document.getElementById('dv-poignee');
  if (!p) return;
  let actif = false;
  const bouger = e => {
    if (!actif) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    dvPoser(Math.max(25, Math.min(75, x / window.innerWidth * 100)));
  };
  const fin = () => { actif = false; document.body.classList.remove('dv-glisse'); };
  const debut = e => { actif = true; document.body.classList.add('dv-glisse'); e.preventDefault(); };
  p.addEventListener('mousedown', debut);
  p.addEventListener('touchstart', debut, { passive: false });
  window.addEventListener('mousemove', bouger);
  window.addEventListener('touchmove', bouger, { passive: true });
  window.addEventListener('mouseup', fin);
  window.addEventListener('touchend', fin);
}

// ── Les boutons ─────────────────────────────────────────────────────────────────────────────────
function dvPoserBoutons() {
  if (dvEstVolet()) return;                       // pas de volet dans un volet
  const zone = document.querySelector('.sidebar-team');
  if (!zone || document.getElementById('dv-boutons')) return;
  const d = document.createElement('div');
  d.id = 'dv-boutons';
  d.className = 'dv-boutons';
  d.innerHTML = `
    <button type="button" class="dv-b-fenetre" onclick="dvNouvelleFenetre()" title="Ouvrir ce dossier dans une seconde fenêtre du CRM">⧉ Nouvelle fenêtre</button>
    <button type="button" class="dv-b-volets" id="dv-b-volets" onclick="dvBasculer()" title="Couper l’écran en deux, un menu de chaque côté">⫽ Deux volets</button>`;
  const version = document.getElementById('crm-version');
  zone.insertBefore(d, version || null);
}

(function dvBrancher() {
  const st = document.createElement('style');
  st.textContent = `
    /* Affinés et translucides, avec une lueur discrète. Le fond plein de la version précédente se
       lisait, mais il pesait autant qu'une entrée de menu pour deux fonctions qu'on emploie
       rarement. Ici : une plaque de verre teintée, un liseré clair, et une lueur de la couleur de
       la fonction — visible de près, invisible de loin. Le TEXTE, lui, reste plein et clair :
       c'est la plaque qui est translucide, pas les lettres. */
    .dv-boutons { display: flex; flex-direction: column; gap: 5px; margin-top: 10px; }
    .dv-boutons button { width: 100%; padding: 6px 9px; border-radius: 8px; cursor: pointer;
      font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
      display: flex; align-items: center; justify-content: center; gap: 5px;
      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
      transition: background .2s ease, box-shadow .2s ease, transform .1s ease; }
    .dv-boutons button:hover { transform: translateY(-1px); }
    .dv-boutons button:active { transform: translateY(1px); }
    .dv-boutons button:focus-visible { outline: 2px solid rgba(255, 255, 255, .75); outline-offset: 2px; }
    .dv-b-fenetre { background: rgba(96, 165, 250, .16); border: 1px solid rgba(147, 197, 253, .38);
      color: #DCEAFE; box-shadow: 0 0 10px rgba(96, 165, 250, .20), inset 0 1px 0 rgba(255, 255, 255, .14); }
    .dv-b-fenetre:hover { background: rgba(96, 165, 250, .28); box-shadow: 0 0 16px rgba(96, 165, 250, .38), inset 0 1px 0 rgba(255, 255, 255, .2); }
    .dv-b-volets { background: rgba(0, 207, 255, .14); border: 1px solid rgba(0, 207, 255, .40);
      color: #CFF4FF; box-shadow: 0 0 10px rgba(0, 207, 255, .22), inset 0 1px 0 rgba(255, 255, 255, .14); }
    .dv-b-volets:hover { background: rgba(0, 207, 255, .26); box-shadow: 0 0 16px rgba(0, 207, 255, .42), inset 0 1px 0 rgba(255, 255, 255, .2); }
    body.dv-actif .dv-b-volets { background: rgba(245, 158, 11, .20); border-color: rgba(251, 191, 36, .52);
      color: #FFE6B8; box-shadow: 0 0 12px rgba(245, 158, 11, .34), inset 0 1px 0 rgba(255, 255, 255, .16); }
    /* L'application est ramenée à gauche, le volet occupe le reste. On agit sur #app plutôt que sur
       body : le fond, les modales et les bandeaux gardent la pleine largeur. */
    body.dv-actif #app { width: var(--dv-part, 50%); max-width: var(--dv-part, 50%); overflow: hidden; }
    body.dv-actif .dv-volet { position: fixed; top: 0; right: 0; bottom: 0; left: var(--dv-part, 50%);
      display: flex; flex-direction: column; background: var(--surface, #0e1626); z-index: 60;
      border-left: 1px solid var(--border, #24324a); box-shadow: -8px 0 24px rgba(0, 0, 0, .25); }
    .dv-barre { display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 5px 8px 5px 12px; font-size: 11px; font-weight: 600; letter-spacing: .04em;
      text-transform: uppercase; color: var(--text-muted, #8ea0b8);
      background: var(--surface-2, #131d30); border-bottom: 1px solid var(--border, #24324a); }
    .dv-barre button { border: 0; background: transparent; color: inherit; font-size: 14px; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
    .dv-barre button:hover { background: rgba(127, 127, 127, .2); }
    .dv-volet iframe { flex: 1; width: 100%; border: 0; background: var(--bg, #0b1220); }
    .dv-poignee { position: fixed; top: 0; bottom: 0; left: var(--dv-part, 50%); width: 10px;
      margin-left: -5px; z-index: 61; cursor: col-resize; }
    .dv-poignee::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 4px; height: 46px; border-radius: 3px; background: color-mix(in srgb, var(--accent, #00cfff) 70%, transparent); }
    /* Pendant le glissement : l'iframe ne doit pas happer le curseur. */
    body.dv-glisse { user-select: none; }
    body.dv-glisse .dv-volet iframe { pointer-events: none; }
    @media (max-width: ${DV_MIN_LARGEUR - 1}px) { .dv-boutons button:last-child { display: none; } }`;
  document.head.appendChild(st);

  // Dans un volet, la barre latérale reste (c'est tout l'intérêt : deux menus), mais on retire les
  // boutons de partage pour ne pas empiler les instances.
  if (dvEstVolet()) document.documentElement.classList.add('dv-dans-volet');
  const demarrer = () => { dvPoserBoutons(); dvAppliquerLien(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  setInterval(dvPoserBoutons, 3000);   // la barre latérale se reconstruit à la connexion
})();
