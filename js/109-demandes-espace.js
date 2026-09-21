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

// ── « Document demandé » sur la fiche client (22.09.2026) ───────────────────────────────────────
// « Il faudrait une notif sur la fiche client qui clignote : document demandé. » Quand le client a
// demandé un document depuis son espace (demandes_documents, pas encore envoyé), la fiche l'annonce
// en tête, en orange REX CLOUD, avec un voyant qui clignote tant que la demande est ouverte. Le
// bouton mène à l'onglet « Documents » des messages clients, où on l'envoie et la marque envoyée.
const DSP_DOC_OUVERTES = ['nouvelle', 'en_cours'];

async function dspSignalerDocumentsDemandes(clientId) {
  if (!clientId || typeof dbGet !== 'function') return;
  const rows = await dbGet('demandes_documents',
    `client_id=eq.${clientId}&statut=in.(${DSP_DOC_OUVERTES.join(',')})&select=id,type_document,statut,created_at&order=created_at.asc`).catch(() => []);
  // La fiche a pu changer pendant la requête : on ne pose l'alerte que sur la bonne.
  if (!Array.isArray(rows) || !rows.length || currentView !== 'fiche-client' || currentClientId !== clientId) return;
  const main = document.getElementById('main-content');
  if (!main || main.querySelector('.dsp-doc-alerte')) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jours = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  const plus = rows[0];
  const j = jours(plus.created_at);
  const types = [...new Set(rows.map(r => r.type_document || 'Document'))];
  main.insertAdjacentHTML('afterbegin', `<div class="dsp-doc-alerte" role="status">
    <span class="dsp-doc-feu" aria-hidden="true"></span>
    <img src="${DSP_LOGO}" alt="" class="dsp-logo" width="22" height="22" onerror="this.style.display='none'"/>
    <div class="dsp-doc-texte">
      <b>${rows.length > 1 ? rows.length + ' documents demandés' : 'Document demandé'} par le client</b>
      <span>${types.slice(0, 3).map(esc).join(' · ')}${types.length > 3 ? '…' : ''} — ${j === 0 ? 'aujourd’hui' : `depuis ${j} jour${j > 1 ? 's' : ''}`}</span>
    </div>
    <button type="button" class="dsp-doc-btn" onclick="if(typeof _mc!=='undefined'){_mc.onglet='documents';} navigate('messages-clients')">Traiter →</button>
  </div>`);
}

(function dspBrancherFiche() {
  if (typeof showClient !== 'function') return;
  const origine = window.showClient;
  window.showClient = async function (id) {
    const r = await origine.apply(this, arguments);
    dspSignalerDocumentsDemandes(id);
    return r;
  };
})();

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
