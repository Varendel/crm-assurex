// ═══ LA RECHERCHE PROPOSE CE QU'ON VIENT DE QUITTER (23.09.2026) ════════════════════════════════
// « Au clic sur la recherche, laisse le dernier opp ou client en reco, ou les 3 derniers. »
//
// Il existait déjà une liste des dernières fiches consultées (js/03, 20.09.2026), mais elle avait
// trois défauts qui la rendaient à peu près invisible :
//   · elle ne s'affichait que sur `oninput` — donc seulement si on TAPAIT quelque chose puis qu'on
//     effaçait. Cliquer dans le champ ne montrait rien : un panneau vide ;
//   · elle ne connaissait que les CLIENTS. Or une journée de courtage se passe autant dans les
//     affaires en cours que dans les fiches clients ;
//   · elle en proposait dix, c'est-à-dire une liste à lire, là où on veut un raccourci.
//
// Trois lignes, clients et affaires mélangés dans l'ordre où on les a quittés, affichées dès que le
// champ prend le focus. On revient sur le dossier qu'on avait en main sans taper une lettre.

const REC_CLE = 'rex-recents';
const REC_MAX = 12;         // on en garde douze, on en montre trois : les suivantes servent quand
const REC_MONTRE = 3;       // une fiche a été supprimée ou n'est pas encore chargée.

function recLire() {
  try {
    const v = JSON.parse(localStorage.getItem(REC_CLE) || '[]');
    return Array.isArray(v) ? v.filter(x => x && x.id && x.k) : [];
  } catch (e) { return []; }
}

function recNoter(k, id) {
  if (!k || !id) return;
  try {
    const liste = recLire().filter(x => !(x.k === k && x.id === id));
    liste.unshift({ k, id });
    localStorage.setItem(REC_CLE, JSON.stringify(liste.slice(0, REC_MAX)));
  } catch (e) { /* stockage indisponible : on s'en passe */ }
}

function recEsc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Une entrée récente → de quoi l'afficher, ou null si la fiche n'existe plus.
function recResoudre(x) {
  if (x.k === 'client') {
    const c = (typeof allClients !== 'undefined' ? allClients : []).find(y => y.id === x.id);
    if (!c) return null;
    const entreprise = typeof estEntreprise === 'function' && estEntreprise(c);
    return {
      icone: entreprise ? '🏢' : '👤',
      titre: entreprise ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim() || c.nom,
      sous: [c.ville, c.email].filter(Boolean).join(' · '),
      ouvrir: () => showClient(c.id),
    };
  }
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(y => y.id === x.id);
  if (!o) return null;
  const nom = typeof opNomClient === 'function' ? opNomClient(o) : '';
  return {
    icone: '🚀',
    titre: o.titre || nom || 'Affaire',
    sous: [nom && nom !== o.titre ? nom : '', o.stade].filter(Boolean).join(' · '),
    ouvrir: () => { if (typeof editerOpportunite === 'function') editerOpportunite(o.id); },
  };
}

// Remplace la liste de js/03 : mêmes crochets (window._rechercheGlobaleActions), donc le panneau
// de recherche n'a pas à savoir que le contenu a changé.
function htmlFichesRecentes() {
  const lus = [];
  for (const x of recLire()) {
    const r = recResoudre(x);
    if (r) lus.push(r);
    if (lus.length >= REC_MONTRE) break;
  }
  if (!lus.length) return '';
  window._rechercheGlobaleActions = {};
  const lignes = lus.map((r, i) => {
    const cle = 'h' + i;
    window._rechercheGlobaleActions[cle] = () => { fermerRechercheGlobale(); r.ouvrir(); };
    // Couleurs par classe, pas par variable : dans le bandeau, --text vaut du blanc, et le panneau
    // affichait du blanc sur blanc.
    return `<div class="rec-ligne" onmousedown="window._rechercheGlobaleActions['${cle}']()">
      <span class="rec-ico">${r.icone}</span>
      <div class="rec-txt">
        <div class="rec-titre">${recEsc(r.titre)}</div>
        ${r.sous ? `<div class="rec-sous">${recEsc(r.sous)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  return `<div class="rec-entete">🕘 Reprendre</div>${lignes}`;
}

(function recBrancher() {
  // Clients : js/05 appelle déjà noterFicheConsultee en ouvrant une fiche.
  if (typeof noterFicheConsultee === 'function') {
    const origine = noterFicheConsultee;
    window.noterFicheConsultee = function (clientId) {
      recNoter('client', clientId);
      return origine.apply(this, arguments);
    };
  }
  // Affaires : la fiche s'affiche, donc on la note.
  if (typeof viewFicheOpportunite === 'function') {
    const origine = viewFicheOpportunite;
    window.viewFicheOpportunite = function (o) {
      if (o && o.id) recNoter('opp', o.id);
      return origine.apply(this, arguments);
    };
  }
  // Le déclencheur qui manquait : au CLIC dans le champ.
  //
  // 23.09.2026, correction : j'écoutais `focusin`, c'est-à-dire N'IMPORTE QUELLE prise de focus —
  // y compris celle que le CRM donne lui-même au champ (Ctrl K, retour sur le tableau de bord) ou
  // un parcours au clavier. Le panneau s'ouvrait donc tout seul et restait posé sur « + Client » et
  // « + Opportunité », qu'on ne pouvait plus cliquer. On n'écoute plus que le CLIC : une intention,
  // pas un effet de bord. Et il se referme sur Échap et au premier clic ailleurs.
  document.addEventListener('click', e => {
    const champ = e.target && e.target.closest && e.target.closest('#recherche-globale-input');
    if (champ && typeof renderResultatsRechercheGlobale === 'function') { renderResultatsRechercheGlobale(); return; }
    // Clic ailleurs : si ce n'est pas dans le panneau lui-même, on ferme.
    const zone = document.getElementById('recherche-globale-resultats');
    if (zone && zone.style.display !== 'none' && !(e.target.closest && e.target.closest('#recherche-globale-resultats'))
      && typeof fermerRechercheGlobale === 'function') fermerRechercheGlobale();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && typeof fermerRechercheGlobale === 'function') fermerRechercheGlobale();
  });

  // Le panneau prenait `var(--surface)`, qui vaut un blanc translucide à l'intérieur du bandeau :
  // on voyait le bandeau au travers, et il ressemblait à un défaut d'affichage. Couleurs explicites.
  const st = document.createElement('style');
  st.textContent = `
    #recherche-globale-resultats {
      background: #FFFFFF; color: #0E1B33;
      border: 1px solid #E2E7EF; box-shadow: 0 18px 44px rgba(6, 20, 44, .34); z-index: 400;
    }
    html:not([data-theme="clair"]) #recherche-globale-resultats {
      background: #16233A; color: #E8EEF8; border-color: #2A3A57;
    }
    .rec-entete { padding: 8px 16px 5px; font-size: 10px; font-weight: 700; letter-spacing: .06em;
      text-transform: uppercase; opacity: .6; }
    .rec-ligne { display: flex; align-items: center; gap: 10px; padding: 9px 16px; cursor: pointer;
      border-top: 1px solid rgba(127, 127, 127, .18); }
    .rec-ligne:hover { background: rgba(0, 149, 184, .12); }
    .rec-ico { font-size: 15px; flex-shrink: 0; }
    .rec-txt { flex: 1; min-width: 0; }
    .rec-titre { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rec-sous { font-size: 11px; opacity: .65; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`;
  document.head.appendChild(st);
})();
