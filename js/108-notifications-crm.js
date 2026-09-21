// ═══ CE QUI ATTEND UNE RÉPONSE (20.09.2026) ════════════════════════════════════════════════════
// « Ajoute un logo nouveaux messages sur le menu de gauche quand il y a des messages à traiter,
//   et il faut aussi une notification. Ajoute notification au CRM et au dashboard, voyant. »
//
// Le problème n'est pas qu'on ne sait pas répondre : c'est qu'on ne sait pas qu'il y a quelque
// chose. Un client écrit depuis REX CLOUD, sa demande se pose dans une table, et elle y reste
// jusqu'à ce que quelqu'un pense à ouvrir l'écran. Le délai de réponse ne dépend alors pas du
// travail, mais du hasard — et c'est le genre de retard qu'un client ressent comme du mépris.
//
// TROIS ENDROITS, UNE SEULE SOURCE :
//   · LE MENU porte un compteur permanent. C'est l'endroit où l'œil passe de toute façon.
//   · LE TABLEAU DE BORD porte un voyant détaillé : quoi, combien, et depuis quand. On y arrive
//     en ouvrant le CRM, donc c'est là que la journée se décide.
//   · UNE NOTIFICATION passe quand le compte AUGMENTE, et seulement alors. Un rappel qui se
//     répète à chaque minute cesse d'être lu au bout d'une heure ; celui-ci ne dit que du neuf.
//
// PAS DE NOTIFICATION NAVIGATEUR. Elle réclame une autorisation, et une fenêtre système qui
// s'ouvre sans qu'on l'ait demandée est le meilleur moyen de la faire refuser une fois pour
// toutes. L'onglet porte le compte dans son titre — visible même quand le CRM est en arrière-plan,
// sans rien demander à personne. Si vous voulez la vraie notification système, elle se propose
// dans les paramètres, à froid.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de index.html.

// Ce qui compte comme « en attente ». Chaque source dit sa table, son filtre et où aller.
// 22.09.2026 : les critères ne sont plus écrits ici mais tirés de MC_EN_ATTENTE (js/51), la
// définition commune au menu, au tableau de bord et à la page Messages clients. La pastille ne
// comptait que les « nouveau » (3) quand le tableau de bord affichait tout le non-traité (7).
const NTF_SOURCES = (typeof MC_EN_ATTENTE !== 'undefined' && typeof mcFiltreEnAttente === 'function')
  ? MC_EN_ATTENTE.map(s => ({ cle: s.cle, table: s.table, filtre: mcFiltreEnAttente(s),
      un: s.un, vue: 'messages-clients', ico: s.ico }))
  : [];

let NTF_ETAT = { comptes: {}, total: 0, plusAncien: null, charge: false };

function ntfEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ntfIco(nom, t) { return typeof ico === 'function' ? ico(nom, t || 16) : ''; }

// Le pluriel se pose sur le nom, pas au bout : « 2 demandes de document », pas « 2 demande de
// documents ». Même règle que l'écran de suppression (js/89).
function ntfPluriel(libelle, n) {
  if (n <= 1) return libelle;
  const mots = libelle.split(' ');
  const out = []; let encore = true;
  for (const m of mots) {
    // « d’adresse » s'écrit en un seul mot : la préposition est collée. Sans ce cas, on obtenait
    // « changements d’adresses », alors que le complément reste au singulier.
    if (!encore || /^(de|à|au|aux|du|des|en)$/i.test(m) || /^[dl][’']/i.test(m)) {
      encore = false; out.push(m); continue;
    }
    out.push(/[sx]$/.test(m) ? m : m + 's');
  }
  return out.join(' ');
}

// ── La mesure ──────────────────────────────────────────────────────────────────────────────────
// On demande l'identifiant et la date, rien d'autre : le compte et l'ancienneté suffisent, et
// rapatrier le contenu des messages pour les compter serait payer cher une information qu'on
// n'affiche pas.
// 22.09.2026 : le relevé tournait aussi dans l'espace client (REX CLOUD) : toutes les 90 s, six
// requêtes sur des tables du cabinet (où la RLS ne lui rend au mieux que ses propres lignes), et
// le titre de l'onglet du client prenait un compteur « (2) » de ses PROPRES demandes, comme s'il
// avait des messages à traiter. Côté client, on ne relève rien.
function ntfEstEspaceClient() {
  return (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'client')
    || document.body.classList.contains('mode-espace-client');
}

async function ntfCharger() {
  if (typeof dbGet !== 'function') return NTF_ETAT;
  if (ntfEstEspaceClient()) return NTF_ETAT;
  const resultats = await Promise.all(NTF_SOURCES.map(s =>
    dbGet(s.table, `select=id,created_at&${s.filtre}&order=created_at.asc&limit=200`).catch(() => null)));

  const comptes = {};
  let total = 0, plusAncien = null;
  resultats.forEach((lignes, i) => {
    // null = la requête a échoué (table absente, droits). On ne compte pas zéro : on ne compte
    // pas du tout, sinon une panne de lecture ressemblerait à une boîte vide.
    if (!Array.isArray(lignes)) return;
    const s = NTF_SOURCES[i];
    comptes[s.cle] = lignes.length;
    total += lignes.length;
    if (lignes.length && lignes[0].created_at) {
      if (!plusAncien || lignes[0].created_at < plusAncien) plusAncien = lignes[0].created_at;
    }
  });

  // Ces deux valeurs se lisent AVANT de remplacer l'état : après, « charge » vaut toujours vrai
  // et le premier relevé annoncerait comme nouvelles des demandes vieilles de trois jours.
  const premier = !NTF_ETAT.charge;
  const avant = NTF_ETAT.total;

  NTF_ETAT = { comptes, total, plusAncien, charge: true };
  ntfPoserTitre(total);
  ntfMajMenu();
  if (!premier && total > avant) ntfSignaler(total - avant);
  return NTF_ETAT;
}

function ntfJours(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ── Le titre de l'onglet ───────────────────────────────────────────────────────────────────────
// Le seul endroit visible quand le CRM est en arrière-plan, et il ne demande aucune autorisation.
let NTF_TITRE_BASE = null;
function ntfPoserTitre(n) {
  if (NTF_TITRE_BASE === null) NTF_TITRE_BASE = document.title.replace(/^\(\d+\)\s*/, '');
  document.title = n > 0 ? `(${n}) ${NTF_TITRE_BASE}` : NTF_TITRE_BASE;
}

// ── La notification ────────────────────────────────────────────────────────────────────────────
// Seulement sur une augmentation, et jamais au premier chargement : annoncer « 6 messages en
// attente » à l'ouverture, alors qu'ils sont là depuis trois jours, ce n'est pas une nouvelle.
function ntfSignaler(nouveaux) {
  if (typeof showError !== 'function') return;
  showError(`✉️ ${nouveaux} nouvelle${nouveaux > 1 ? 's' : ''} demande${nouveaux > 1 ? 's' : ''} de client`);
}

// ── Le compteur dans le menu ───────────────────────────────────────────────────────────────────
function ntfMajMenu() {
  const bouton = document.querySelector('#nav .nav-item[onclick*="messages-clients"]');
  if (!bouton) return;
  let pastille = bouton.querySelector('.ntf-pastille');
  if (!NTF_ETAT.total) { if (pastille) pastille.remove(); bouton.classList.remove('ntf-actif'); return; }
  if (!pastille) {
    pastille = document.createElement('span');
    pastille.className = 'nav-compteur ntf-pastille';
    bouton.appendChild(pastille);
  }
  pastille.textContent = NTF_ETAT.total > 99 ? '99+' : String(NTF_ETAT.total);
  pastille.title = ntfPhrase();
  bouton.classList.add('ntf-actif');
}

function ntfPhrase() {
  const bouts = NTF_SOURCES
    .filter(s => NTF_ETAT.comptes[s.cle])
    .map(s => `${NTF_ETAT.comptes[s.cle]} ${ntfPluriel(s.un, NTF_ETAT.comptes[s.cle])}`);
  return bouts.length ? bouts.join(', ') : 'rien en attente';
}

// ── Le voyant du tableau de bord ───────────────────────────────────────────────────────────────
function ntfVoyantHtml() {
  if (!NTF_ETAT.charge) return '';
  const total = NTF_ETAT.total;
  const j = ntfJours(NTF_ETAT.plusAncien);
  // Au-delà de deux jours, ce n'est plus une file d'attente, c'est un oubli.
  const ton = !total ? 'calme' : (j !== null && j >= 2) ? 'tard' : 'actif';

  if (!total) {
    return `<section class="ntf-voyant calme">
      <span class="ntf-lampe" aria-hidden="true"></span>
      <div class="ntf-texte"><b>Rien en attente</b>
        <small>Toutes les demandes des clients ont été traitées.</small></div>
    </section>`;
  }

  const detail = NTF_SOURCES.filter(s => NTF_ETAT.comptes[s.cle]).map(s => `
    <button type="button" class="ntf-ligne" onclick="navigate('${s.vue}')">
      <span class="ntf-ligne-ico">${ntfIco(s.ico, 16)}</span>
      <b>${NTF_ETAT.comptes[s.cle]}</b>
      <span>${ntfEsc(ntfPluriel(s.un, NTF_ETAT.comptes[s.cle]))}</span>
    </button>`).join('');

  return `<section class="ntf-voyant ${ton}">
    <span class="ntf-lampe" aria-hidden="true"></span>
    <div class="ntf-texte">
      <b>${total} demande${total > 1 ? 's' : ''} de client${total > 1 ? 's' : ''} en attente</b>
      <small>${j !== null
        ? (j === 0 ? 'la plus ancienne est arrivée aujourd’hui'
          : j === 1 ? 'la plus ancienne attend depuis hier'
          : `la plus ancienne attend depuis ${j} jours`)
        : ''}</small>
    </div>
    <div class="ntf-detail">${detail}</div>
  </section>`;
}

// ── Les branchements ───────────────────────────────────────────────────────────────────────────
(function ntfBrancher() {
  // Le menu se redessine souvent ; on repose la pastille après chaque rendu plutôt que de
  // modifier renderSidebar, qui construit son HTML d'un bloc.
  if (typeof renderSidebar === 'function') {
    const origine = renderSidebar;
    window.renderSidebar = function () {
      const r = origine.apply(this, arguments);
      setTimeout(ntfMajMenu, 0);
      return r;
    };
  }

  // Le voyant se pose en tête du tableau de bord : c'est la première chose qu'on ouvre, donc
  // l'endroit où la journée se décide.
  if (typeof viewDashboardV2 === 'function') {
    const origine = viewDashboardV2;
    window.viewDashboardV2 = function () {
      const html = origine.apply(this, arguments);
      const v = ntfVoyantHtml();
      if (!v) return html;
      // Après le bandeau s'il y en a un, sinon tout en haut.
      const fin = html.indexOf('</section>');
      if (fin < 0) return v + html;
      return html.slice(0, fin + 10) + v + html.slice(fin + 10);
    };
  }

  // Premier chargement puis relevé régulier. On ne relève pas quand l'onglet est caché : personne
  // ne lit, et une requête toutes les 90 secondes pendant une nuit ne sert qu'à faire du bruit.
  const relever = () => { if (!document.hidden && !ntfEstEspaceClient()) ntfCharger().catch(() => {}); };
  setTimeout(relever, 2500);
  setInterval(relever, 90000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) relever(); });
})();
