// ═══ LE LOGO PARTOUT OÙ LA COMPAGNIE EST NOMMÉE (20.09.2026) ═══════════════════════════════════
// « Ajoute les logos des compagnies un peu partout où elles sont mentionnées. »
//
// Le nom d'une compagnie apparaît à quarante-trois endroits du code, répartis dans vingt-cinq
// fichiers : fiches, cartes, listes, fenêtres, récapitulatifs. En poser un par un reviendrait à
// quarante-trois modifications, donc quarante-trois occasions de casser une mise en page — et à
// en oublier, puisque de nouveaux écrans s'ajoutent.
//
// On balaie donc le rendu : tout texte qui EST exactement le nom d'une compagnie connue reçoit
// son logo devant. La règle se tient d'elle-même et vaut pour les écrans à venir.
//
// LE PIÈGE, ET CE QU'ON FAIT CONTRE :
//   · un nom de compagnie qui est aussi un nom de lieu. En Suisse il n'y en a qu'un — ZURICH —
//     et une colonne « Localité » recevrait le logo de l'assureur. « Zurich » seul est donc
//     écarté ici : il garde son logo dans les tableaux (js/101), où l'en-tête de colonne prouve
//     qu'il s'agit bien d'une compagnie. « Zurich Assurances » passe, lui, sans ambiguïté ;
//   · un logo déjà posé à côté. Beaucoup d'écrans écrivent déjà « pastille + nom » ; en ajouter
//     un second ferait doublon. On remonte donc trois niveaux et on s'abstient si un logo s'y
//     trouve déjà ;
//   · les champs de saisie, les menus déroulants et les en-têtes de tableau : on n'y touche pas.
//     Une balise dans un <option> ne s'affiche pas, elle s'imprime en clair.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Les noms redeviennent du texte.

// Les noms qui ne suffisent pas à eux seuls. La liste est courte parce que le problème l'est.
const LGP_AMBIGUS = /^(zurich|orion|cap|pax)$/i;

// Là où une balise ne s'affiche pas, ou n'a rien à faire.
const LGP_INTERDITS = new Set(['OPTION', 'SELECT', 'INPUT', 'TEXTAREA', 'SCRIPT', 'STYLE', 'TITLE', 'TH', 'CODE', 'PRE']);

// Un logo est-il DÉJÀ posé juste à côté ? Beaucoup d'écrans écrivent « pastille + nom » dans deux
// éléments voisins ; en ajouter un second ferait doublon.
//
// Le voisinage se regarde de près, et c'est volontaire. Une première version remontait trois
// niveaux et interrogeait chaque ancêtre : à trois niveaux au-dessus on tombe sur le conteneur de
// la page, qui contient forcément un logo quelque part — et plus rien n'était jamais traité. On
// se limite donc à l'élément lui-même et aux frères immédiats, à deux niveaux de profondeur.
const LGP_VOISINS = ':scope > img, :scope > svg, :scope > [role="img"],'
  + ' :scope > * > img, :scope > * > svg, :scope > * > [role="img"]';

function lgpDejaUnLogo(el) {
  if (!el) return true;
  if (el.querySelector && el.querySelector('img, svg, [role="img"]')) return true;
  const p = el.parentElement;
  if (p && p.querySelector && p.querySelector(LGP_VOISINS)) return true;
  return false;
}

// Le texte désigne-t-il une compagnie connue ? On passe par la résolution du logo (js/15), qui
// reconnaît aussi les agences — « Allianz Suisse Crissier » tombe sur Allianz.
function lgpCompagnie(texte) {
  const t = texte.trim();
  if (!t || t.length > 60 || t.length < 3) return null;
  // Un texte qui contient de la ponctuation de phrase n'est pas un libellé de compagnie.
  if (/[.,;:!?·|]|\s{2,}/.test(t)) return null;
  if (LGP_AMBIGUS.test(t)) return null;
  if (typeof pictoResoudre !== 'function' || typeof PICTOS_COMPAGNIES === 'undefined') return null;
  const nom = pictoResoudre(t);
  return PICTOS_COMPAGNIES[nom] ? nom : null;
}

let lgpEnCours = false;

function lgpAppliquer(racine) {
  if (lgpEnCours) return;
  if (typeof pictoCompagnie !== 'function') return;
  lgpEnCours = true;
  try {
    const zone = racine || document.getElementById('main-content');
    if (!zone) return;
    const marcheur = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || LGP_INTERDITS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.dataset && p.dataset.lgp) return NodeFilter.FILTER_REJECT;
        // Le texte doit être TOUT le contenu de son élément : « Helvetia » oui, « offre reçue de
        // Helvetia le 3 mars » non. Le second est une phrase, pas une étiquette.
        if ((p.textContent || '').trim() !== (n.nodeValue || '').trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const aFaire = [];
    let n;
    while ((n = marcheur.nextNode())) {
      const cie = lgpCompagnie(n.nodeValue || '');
      if (cie && !lgpDejaUnLogo(n.parentElement)) aFaire.push([n.parentElement, cie]);
    }

    for (const [el, cie] of aFaire) {
      el.dataset.lgp = '1';
      const pastille = document.createElement('span');
      pastille.className = 'lgp-logo';
      pastille.innerHTML = pictoCompagnie(cie, 16);
      el.insertBefore(pastille, el.firstChild);
    }
  } finally {
    setTimeout(() => { lgpEnCours = false; }, 0);
  }
}

// Même déclenchement que js/101 : un observateur, parce que les écrans se redessinent seuls au
// filtre, au tri et à la navigation.
(function lgpBrancher() {
  const demarrer = () => {
    const zone = document.getElementById('main-content');
    if (!zone) { setTimeout(demarrer, 300); return; }
    let minuteur = null;
    new MutationObserver(() => {
      if (lgpEnCours) return;
      clearTimeout(minuteur);
      minuteur = setTimeout(() => lgpAppliquer(), 60);
    }).observe(zone, { childList: true, subtree: true });
    lgpAppliquer();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
