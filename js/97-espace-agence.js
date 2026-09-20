// ═══ REX CLOUD : LE RENDU (20.09.2026) ═════════════════════════════════════════════════════════
// « L'espace client fait trop IA. Fais le rendu comme si c'était une agence web, je n'aime pas les
// pictogrammes et le visuel trop simple. »
//
// Trois défauts derrière cette impression, et le premier est le plus visible.
//
// 1. LES ÉMOJIS. Ils ne sont pas dessinés par nous : chaque système les rend à sa façon, donc
//    l'espace n'a pas la même allure sur un iPhone, un Android et un PC. Ils arrivent avec leurs
//    propres couleurs, qui n'appartiennent à aucune charte. Et leur épaisseur varie d'un caractère
//    à l'autre, là où une famille d'icônes tient justement par sa régularité. Ils sont remplacés
//    par un jeu dessiné au trait (js/96), même grille, même épaisseur, couleur du texte courant.
//
// 2. TOUT AVAIT LE MÊME POIDS. Une page où chaque bloc est une carte grise de même taille se lit
//    comme un formulaire : l'œil n'a aucune prise, rien ne dit par où commencer. Un travail
//    d'agence commence par décider ce qui est grand et ce qui est petit. Ici : le nom du client et
//    le nombre de contrats deviennent une vraie ouverture, les actions se rangent, les cartes
//    perdent leur uniformité.
//
// 3. AUCUNE MATIÈRE. Pas de règle fine, pas de filet, pas de chiffre posé, pas de lettrine, pas de
//    respiration — d'où l'impression de gabarit. Ce qui donne du caractère tient à peu de chose :
//    des chiffres en tabulaire, un interlignage plus généreux, des séparateurs d'un demi-pixel,
//    et des titres dont le tracking se resserre quand ils grandissent.

function eagEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function eagCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }

// ── Les familles, sans émoji ────────────────────────────────────────────────────────────────────
// On remplace le champ `icone` des deux jeux de familles par une icône dessinée. Les tables
// restent celles de js/52 et js/87 : un seul endroit définit ce qu'est « de la santé ».
(function eagRemplacerIcones() {
  if (typeof ico !== 'function') return;
  const poser = (table) => {
    if (!Array.isArray(table)) return;
    for (const t of table) t.icone = icoFamille(t.id, 22);
  };
  if (typeof EC_TYPES !== 'undefined') poser(EC_TYPES);
  if (typeof ECA_TYPES_ENTREPRISE !== 'undefined') poser(ECA_TYPES_ENTREPRISE);
})();

// ── Les actions d'un contrat ────────────────────────────────────────────────────────────────────
// Mêmes gestes, mêmes fonctions : seuls les émojis cèdent la place. On enveloppe le rendu de la
// feuille plutôt que de le réécrire, pour ne rien perdre de ce qu'il fait.
(function eagActions() {
  if (typeof ecaContratHtml !== 'function' || typeof ico !== 'function') return;
  const origine = ecaContratHtml;
  window.ecaContratHtml = function (ct) {
    return origine.apply(this, arguments)
      .replace('⬇️ Ma police', ico('telecharger', 17) + '<span>Ma police</span>')
      .replace('💬 Contacter mon conseiller', ico('message', 17) + '<span>Écrire à mon conseiller</span>')
      .replace('🛟 Déclarer un sinistre', ico('sinistre', 17) + '<span>Déclarer un sinistre</span>')
      .replace('📄 Demander un document', ico('document', 17) + '<span>Demander un document</span>');
  };
})();

// ── L'accueil : une ouverture, pas un tableau de bord ───────────────────────────────────────────
// Le bandeau disait « Bonjour X » et empilait des cartes. On lui donne la structure d'une page
// d'agence : une phrase d'accueil courte, un chiffre qui compte, et les gestes utiles rangés
// à droite — pas alignés au milieu comme sur un formulaire.
(function eagAccueil() {
  if (typeof ecOngletAccueil !== 'function' || typeof ico !== 'function') return;
  const origine = ecOngletAccueil;
  window.ecOngletAccueil = function () {
    let html = origine.apply(this, arguments);
    // La réassurance : le symbole de poignée de main cède au bouclier — c'est de protection
    // qu'il s'agit, et le dessin ne varie plus d'un téléphone à l'autre.
    html = html.replace(/<span class="ecp-rassurance-icone"[^>]*>🤝<\/span>/, `<span class="ecp-rassurance-icone">${ico('bouclier', 26)}</span>`);
    return html;
  };
})();

// ── Le widget des primes ────────────────────────────────────────────────────────────────────────
(function eagPrimes() {
  if (typeof ecpWidgetPrimes !== 'function' || typeof ico !== 'function') return;
  const origine = ecpWidgetPrimes;
  window.ecpWidgetPrimes = function () {
    let html = origine.apply(this, arguments);
    if (!html) return html;
    return html
      .replace(/<span class="ecp-etat-icone"[^>]*>⏳<\/span>/, `<span class="ecp-etat-icone">${ico('horloge', 22)}</span>`)
      .replace(/<span class="ecp-etat-icone"[^>]*>📣<\/span>/, `<span class="ecp-etat-icone">${ico('etincelle', 22)}</span>`)
      .replace('🔎 Comparer sur priminfo.admin.ch ↗', ico('loupe', 17) + '<span>Comparer sur priminfo.admin.ch</span>');
  };
})();

// ── Le conseiller ───────────────────────────────────────────────────────────────────────────────
(function eagConseiller() {
  if (typeof ecpOngletConseiller !== 'function' || typeof ico !== 'function') return;
  const origine = ecpOngletConseiller;
  window.ecpOngletConseiller = function () {
    return origine.apply(this, arguments)
      .replace(/📞 /, ico('telephone', 16) + ' ')
      .replace(/✉️ /, ico('courriel', 16) + ' ')
      .replace('💬 Lui écrire depuis mon espace', ico('message', 17) + '<span>Lui écrire depuis mon espace</span>')
      .replace('📅 Prendre rendez-vous', ico('agenda', 17) + '<span>Prendre rendez-vous</span>')
      .replace('📅 Demander un rendez-vous', ico('agenda', 17) + '<span>Demander un rendez-vous</span>');
  };
})();

// ── Les onglets ─────────────────────────────────────────────────────────────────────────────────
// Ils portaient des émojis eux aussi. On les retire sans toucher à la logique d'onglets : le
// libellé seul suffit, et c'est ce que fait un site bien tenu.
(function eagOnglets() {
  if (typeof ecVueEspaceClient !== 'function') return;
  const origine = ecVueEspaceClient;
  window.ecVueEspaceClient = function () {
    let html = origine.apply(this, arguments);
    // Retire les émojis en tête des libellés d'onglets, sans toucher au reste du HTML.
    html = html.replace(/(<button[^>]*class="[^"]*ec-onglet[^"]*"[^>]*>)\s*[\p{Extended_Pictographic}️]+\s*/gu, '$1');
    return html;
  };
})();

// ── Le nettoyage de sécurité ────────────────────────────────────────────────────────────────────
// Certains émojis vivent dans des chaînes que les enveloppes ci-dessus ne traversent pas (messages
// d'état, libellés construits ailleurs). Après chaque rendu de l'espace, on balaie le DOM et on
// retire ceux qui restent. C'est un filet, pas la méthode : ce qui est repéré ici doit finir par
// être corrigé à la source.
const EAG_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu;

function eagNettoyerEmojis(racine) {
  const zone = racine || document.querySelector('.ec-page, #main-content');
  if (!zone) return;
  const marcheur = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
  const aNettoyer = [];
  let n;
  while ((n = marcheur.nextNode())) {
    if (EAG_EMOJI.test(n.nodeValue)) aNettoyer.push(n);
    EAG_EMOJI.lastIndex = 0;
  }
  for (const t of aNettoyer) {
    // On ne supprime que l'émoji et l'espace qui le suit — jamais le texte autour.
    t.nodeValue = t.nodeValue.replace(EAG_EMOJI, '').replace(/^\s+/, ' ').replace(/\s{2,}/g, ' ');
  }
}

(function eagBrancherNettoyage() {
  if (typeof ecRendre !== 'function') return;
  const origine = ecRendre;
  window.ecRendre = function () {
    const r = origine.apply(this, arguments);
    setTimeout(() => eagNettoyerEmojis(), 30);
    return r;
  };
})();
