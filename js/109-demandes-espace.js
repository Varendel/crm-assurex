// ═══ CE QUI VIENT DE L'ESPACE CLIENT SE VOIT (20.09.2026) ══════════════════════════════════════
// « Demande client en orange, et mets le logo REX CLOUD sur le bandeau demande client, qu'on
//   comprenne que ça vient de l'espace. »
//
// Une demande déposée par un client depuis REX CLOUD n'est pas une tâche interne. Elle a un
// auteur qui attend, elle a une date d'arrivée, et surtout : le client SAIT qu'il l'a envoyée. Un
// oubli ne se rattrape pas comme un oubli interne — il se remarque de l'autre côté.
//
// Jusqu'ici rien ne les distinguait d'une note prise au téléphone. Le surtitre disait bien
// « REX CLOUD » en petites capitales grises, mais un mot gris au-dessus d'un titre, personne ne
// le lit après la deuxième visite.
//
// L'ORANGE EST UNE ORIGINE, PAS UNE URGENCE. C'est une distinction qui se tient seulement si on
// s'y astreint : tout ce qui vient de l'espace client est orange, qu'il soit urgent ou pas, et
// rien d'autre ne l'est. Le retard, lui, passe au rouge (js/108) — sinon les deux signaux se
// confondraient et aucun des deux ne voudrait plus dire quelque chose.
//
// LE LOGO fait le reste du travail : c'est la même image que le client voit en haut de son
// espace. Le lien entre les deux côtés se comprend sans être expliqué.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de index.html.

const DSP_LOGO = 'assets/logos/rex-cloud-mini-blanc.svg';

function dspBandeauHtml() {
  return `<div class="dsp-origine">
    <img src="${DSP_LOGO}" alt="" class="dsp-logo" width="22" height="22"
      onerror="this.style.display='none'"/>
    <span class="dsp-marque"><b>REX</b> CLOUD</span>
    <span class="dsp-sep" aria-hidden="true">·</span>
    <span class="dsp-quoi">demandes déposées par vos clients depuis leur espace</span>
  </div>`;
}

(function dspBrancher() {
  if (typeof viewMessagesClients !== 'function') return;
  const origine = viewMessagesClients;
  // Le surtitre tel que js/51 l'écrit. On le remplace plutôt que de le doubler : deux mentions de
  // la même provenance, l'une grise et l'autre orange, se contrediraient.
  const MARQUE = '<div class="dx-surtitre">REX CLOUD · demandes venues de l’espace client</div>';

  window.viewMessagesClients = function () {
    const html = origine.apply(this, arguments);
    if (html.includes('dsp-origine')) return html;
    if (html.includes(MARQUE)) return html.replace(MARQUE, dspBandeauHtml());
    // Le libellé a changé depuis : on pose le bandeau devant le titre plutôt que de ne rien faire.
    const i = html.indexOf('<h2>');
    return i < 0 ? html : html.slice(0, i) + dspBandeauHtml() + html.slice(i);
  };
})();
