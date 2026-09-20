// ═══ LE TRANSFERT, QUAND IL Y EN A UN (20.09.2026) ═════════════════════════════════════════════
// « "Nous nous occupons de tout…" ne doit s'afficher que si le transfert a été demandé. Et il faut
// mettre transfert en cours. »
//
// Le bloc s'affichait à tout le monde, en permanence. Pour un client dont les polices sont depuis
// longtemps au dossier, « vos assureurs nous transmettent vos polices, vous n'avez rien à faire »
// ne veut plus rien dire — et une promesse qui se répète sans objet cesse d'être lue. Pire : elle
// laisse croire qu'une démarche est en cours alors que rien ne bouge.
//
// Il ne paraît donc que s'il existe une demande de transfert, et il dit où elle en est.
//
// CE QUE LE CLIENT VOIT EN PLUS : la liste des compagnies concernées, et pour chacune si la police
// est arrivée. C'est la vraie réponse à la question qu'il se pose — « où ça en est » — et elle
// vaut mieux qu'une phrase rassurante répétée. Une attente dont on voit l'avancement se supporte ;
// une attente muette inquiète.

async function etrCharger() {
  const E = window._ec || {};
  if (!E.client || !E.client.id) return;
  if (E.transferts !== undefined) return;     // déjà chargé, y compris quand c'est vide
  E.transferts = null;                        // en cours : évite deux appels simultanés
  try {
    const r = await dbGet('demandes_transfert',
      `client_id=eq.${E.client.id}&select=*&order=created_at.desc`);
    E.transferts = Array.isArray(r) ? r : [];
  } catch (e) {
    E.transferts = [];
  }
  if (typeof ecRendre === 'function') ecRendre();
}

// Le transfert en cours : le plus récent qui n'a pas encore été traité. Une demande traitée ne
// justifie plus le bloc — les polices sont arrivées, le client les voit dans ses contrats.
function etrEnCours() {
  const E = window._ec || {};
  if (!Array.isArray(E.transferts)) return null;
  return E.transferts.find(t => !t.traite_le) || null;
}

function etrEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Une police est considérée comme arrivée quand un contrat actif du client porte la même
// compagnie. On ne compare pas les numéros de police : celui du décompte diffère souvent de celui
// que le client nous avait donné, et un faux négatif inquiéterait pour rien.
function etrPoliceArrivee(ligne) {
  const E = window._ec || {};
  const cie = String(ligne.compagnie || '').trim().toLowerCase();
  if (!cie) return false;
  return (E.contrats || []).some(ct =>
    String(ct.compagnie || '').trim().toLowerCase() === cie
    && !['annulé', 'résilié', 'mandat_resilie'].includes(ct.statut));
}

function etrBlocHtml() {
  const t = etrEnCours();
  if (!t) return '';

  const lignes = Array.isArray(t.compagnies) ? t.compagnies : [];
  const arrivees = lignes.filter(etrPoliceArrivee).length;
  const total = lignes.length;
  const pct = total ? Math.round((arrivees / total) * 100) : 0;
  const depuis = t.signe_le || t.created_at;
  const jours = depuis ? Math.floor((Date.now() - new Date(depuis)) / 86400000) : null;

  return `<section class="etr-bloc">
    <header class="etr-tete">
      <span class="etr-badge">
        <span class="etr-pastille" aria-hidden="true"></span>
        Transfert en cours
      </span>
      ${jours != null ? `<span class="etr-depuis">demandé il y a ${jours === 0 ? 'moins d’un jour' : jours === 1 ? '1 jour' : jours + ' jours'}</span>` : ''}
    </header>

    <div class="etr-corps">
      <b>Nous nous occupons de tout.</b>
      <p>Vos assureurs nous transmettent vos polices, vous n’avez rien à faire. Une fois vos polices
        obtenues, vous les retrouvez ici, dans le dossier correspondant à votre contrat.
        <b>Vos couvertures restent inchangées.</b></p>
    </div>

    ${total ? `
      <div class="etr-avance">
        <div class="etr-jauge" role="img" aria-label="${arrivees} police${arrivees > 1 ? 's' : ''} reçue${arrivees > 1 ? 's' : ''} sur ${total}">
          <i style="width:${pct}%"></i>
        </div>
        <span class="etr-compte">${arrivees} sur ${total} reçue${arrivees > 1 ? 's' : ''}</span>
      </div>
      <ul class="etr-liste">${lignes.map(l => {
        const ok = etrPoliceArrivee(l);
        return `<li class="${ok ? 'recue' : 'attente'}">
          <span class="etr-ico" aria-hidden="true">${typeof ico === 'function' ? ico(ok ? 'responsabilite' : 'horloge', 16) : ''}</span>
          <span class="etr-cie">${etrEsc(l.compagnie || 'Compagnie à préciser')}</span>
          ${l.produit ? `<span class="etr-produit">${etrEsc(l.produit)}</span>` : ''}
          <span class="etr-statut">${ok ? 'Police reçue' : 'En attente'}</span>
        </li>`;
      }).join('')}</ul>`
    : ''}
  </section>`;
}

// On remplace la réassurance de js/79 : même texte, mais conditionné et daté.
(function etrBrancher() {
  if (typeof ecpRassuranceHtml === 'function') window.ecpRassuranceHtml = etrBlocHtml;

  // Le chargement se déclenche au premier rendu de l'espace : window._ec n'existe pas avant.
  if (typeof ecRendre === 'function') {
    const origine = ecRendre;
    window.ecRendre = function () {
      const r = origine.apply(this, arguments);
      if (window._ec && window._ec.client && window._ec.transferts === undefined) {
        setTimeout(() => etrCharger(), 0);
      }
      return r;
    };
  }
})();
