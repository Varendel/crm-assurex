// ═══ FICHE CLIENT : LES COUVERTURES, REVUES (20.09.2026) ═══════════════════════════════════════
// « Est-ce qu'il ne serait pas judicieux de réorganiser le coup d'œil des couvertures ? Ou
// moderniser, c'est un vestige. »
//
// C'en était un, en effet : couleurs écrites en dur (#4ade80, rgba(74,222,128,…)), graisses 800
// et 900, tout en styles en ligne. Deux conséquences concrètes, pas seulement esthétiques —
// le bloc ne suivait aucune des sept ambiances ni le thème clair, et il échappait à la correction
// typographique de css/96 qui ramène les graisses à ce que la police sait vraiment dessiner.
//
// MAIS LE VRAI DÉFAUT ÉTAIT AILLEURS : L'ORGANISATION.
// Les branches couvertes et les branches manquantes étaient mélangées dans une même grille, dans
// l'ordre du catalogue. Pour savoir ce qui manquait, il fallait parcourir toutes les cartes et
// repérer celles qui étaient grises. Or la question d'un courtier devant une fiche n'est jamais
// « qu'est-ce qui est couvert » — ça, le client le sait — mais « QU'EST-CE QUI MANQUE ». C'est
// elle qui décide du prochain appel.
//
// On sépare donc les deux, et on met le manque en premier quand il y en a. Le ratio devient une
// barre : un « 4/9 » demande une division mentale, une barre remplie à moitié ne demande rien.
// Chaque branche couverte porte enfin sa prime — c'est le poids de la relation, il n'était nulle
// part sur cette vue.
//
// CE QU'ON NE FAIT PAS : proposer un bouton « créer l'opportunité » sur un manque. L'écran
// Équipement (js/12) le fait déjà, avec ses propres besoins et son suivi des polices externes.
// En refaire une version approximative ici créerait deux chemins qui divergeraient. On y renvoie.

function couEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function couCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }

function couIcone(label) {
  return (typeof ICONES_CATEGORIE_COUVERTURE !== 'undefined' && ICONES_CATEGORIE_COUVERTURE[label]) || '📄';
}

function couRendre(client, contrats, isEntreprise) {
  const segment = isEntreprise ? 'entreprise' : 'prive';
  const categories = (typeof getCategoriesPourSegment === 'function'
    ? getCategoriesPourSegment(segment) : []).filter(c => c !== 'Autre');
  const actifs = (contrats || []).filter(ct => !['résilié', 'annulé', 'mandat_resilie'].includes(ct.statut));
  const cat = ct => typeof categoriePourProduitLibre === 'function' ? categoriePourProduitLibre(ct.produit) : null;
  // Un contrat combiné (« RC + inventaire du ménage ») coche chacune des branches qu'il couvre.
  const cats = ct => typeof categoriesPourProduitLibre === 'function' ? categoriesPourProduitLibre(ct.produit) : [cat(ct)];

  const couvertes = [], manquantes = [];
  for (const c of categories) {
    const l = actifs.filter(ct => cats(ct).includes(c));
    (l.length ? couvertes : manquantes).push({ label: c, contrats: l });
  }
  const prime = actifs.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
  const pct = categories.length ? Math.round((couvertes.length / categories.length) * 100) : 0;
  const ton = pct === 100 ? 'complet' : pct >= 50 ? 'partiel' : 'faible';

  // Les contrats qu'aucune branche du segment ne réclame : ils existent, ils se voient ailleurs
  // sur la fiche, mais les compter dans le ratio fausserait le dénominateur. On les signale.
  const horsGrille = actifs.filter(ct => !cats(ct).some(c => categories.includes(c))).length;

  const cctBadge = isEntreprise ? `
    <span class="cou-cct ${client && client.cct ? 'oui' : 'non'}">
      🤝 ${client && client.cct ? 'Soumise à une CCT' : 'Pas de CCT'}</span>` : '';

  return `
  <section class="cou-bloc">
    <header class="cou-tete">
      <div class="cou-titre">
        <span class="cou-surtitre">Couvertures</span>
        <b>${couvertes.length} branche${couvertes.length > 1 ? 's' : ''} sur ${categories.length}</b>
        <small>${prime ? `CHF ${couCHF(prime)} de primes par an` : 'aucune prime renseignée'}${
          horsGrille ? ` · ${horsGrille} contrat${horsGrille > 1 ? 's' : ''} hors de ces branches` : ''}</small>
      </div>
      <div class="cou-jauge-boite">
        <div class="cou-jauge ton-${ton}" role="img"
          aria-label="${pct} % des branches du segment sont couvertes">
          <i style="width:${pct}%"></i>
        </div>
        <span class="cou-pct ton-${ton}">${pct} %</span>
      </div>
      ${cctBadge}
      ${client && client.id ? `<span class="cou-mandat" data-cou-mandat="${couEsc(client.id)}" aria-live="polite"></span>` : ''}
    </header>

    ${manquantes.length ? `
      <div class="cou-groupe">
        <h4 class="cou-sous">À découvrir <span>${manquantes.length}</span></h4>
        <div class="cou-grille cou-manque">${manquantes.map(m => `
          <div class="cou-carte vide" title="${couEsc(m.label)} — aucun contrat actif dans cette branche">
            <span class="cou-ico">${couIcone(m.label)}</span>
            <span class="cou-nom">${couEsc(m.label)}</span>
          </div>`).join('')}</div>
        ${typeof navigate === 'function' ? `<button type="button" class="cou-lien"
          onclick="navigate('equipement')">Ouvrir l’équipement pour en proposer une →</button>` : ''}
      </div>` : `
      <p class="cou-tout">✓ Toutes les branches de ce segment sont couvertes.</p>`}

    ${couvertes.length ? `
      <div class="cou-groupe">
        <h4 class="cou-sous">En place <span>${couvertes.length}</span></h4>
        <div class="cou-grille">${couvertes.map(c => couCarteHtml(c)).join('')}</div>
      </div>` : ''}
  </section>`;
}

// Une branche couverte. Quand elle porte plusieurs contrats — c'est courant côté entreprise, où
// LAA et perte de gain tombent dans la même famille — ils sont tous listés : une version
// antérieure n'en gardait qu'un et masquait les autres en silence.
function couCarteHtml(c) {
  const prime = c.contrats.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
  return `<div class="cou-carte pleine">
    <div class="cou-carte-tete">
      <span class="cou-ico">${couIcone(c.label)}</span>
      <span class="cou-nom">${couEsc(c.label)}</span>
      ${c.contrats.length > 1 ? `<span class="cou-n">${c.contrats.length}</span>` : ''}
      ${prime ? `<span class="cou-prime">CHF ${couCHF(prime)}</span>` : ''}
    </div>
    <ul class="cou-liste">${c.contrats.map(ct => `
      <li ${typeof showDetailContrat === 'function' ? `onclick="showDetailContrat('${ct.id}')" role="button" tabindex="0"
        onkeydown="if(event.key==='Enter'){showDetailContrat('${ct.id}')}"` : ''}>
        ${ct.compagnie && typeof pictoCompagnie === 'function' ? `<span class="cou-logo" title="${couEsc(ct.compagnie)}">${pictoCompagnie(ct.compagnie, 22)}</span>` : ''}
        <span class="cou-texte">
          <b>${couEsc(ct.produit || 'Contrat')}</b>
          <small>${couEsc(ct.compagnie || '')}${ct.numero_police ? ' · ' + couEsc(ct.numero_police) : ''}</small>
        </span>
      </li>`).join('')}</ul>
  </div>`;
}

// ── Le badge « mandat » (22.09.2026) ────────────────────────────────────────────────────────────
// « Crée un logo mandat avec un vu vert et ajoute-le comme badge sur les couvertures, pour
// comprendre en un clin d'œil. » Le champ clients.mandat vaut « oui » partout : il ne dit rien. La
// preuve, c'est un mandat signé et non archivé dans mandats_signes — on le lit après l'affichage
// (le bloc est rendu d'un trait), puis on remplit la pastille laissée dans l'en-tête.
//   · signé     → logo au vu vert, « Mandat signé » + date ; un clic l'ouvre.
//   · pas signé → pastille grise en pointillé, « Pas de mandat » ; un clic propose d'en créer un.
const _couMandats = new Map();   // client_id → { m, t } (cache de 60 s : la fiche se redessine souvent)

async function couMandatDe(clientId) {
  const c = _couMandats.get(clientId);
  if (c && Date.now() - c.t < 60000) return c.m;
  const r = await dbGet('mandats_signes', `client_id=eq.${clientId}&signe=is.true&archive=is.false&select=id,created_at,fichier_nom&order=created_at.desc&limit=1`).catch(() => null);
  const m = Array.isArray(r) ? (r[0] || false) : null;   // null = lecture impossible : on n'affiche rien
  if (m !== null) _couMandats.set(clientId, { m, t: Date.now() });
  return m;
}

async function couRemplirMandats() {
  for (const el of document.querySelectorAll('[data-cou-mandat]:not([data-rempli])')) {
    el.setAttribute('data-rempli', '');
    const id = el.getAttribute('data-cou-mandat');
    const m = await couMandatDe(id);
    if (m === null) { el.remove(); continue; }
    if (m) {
      el.className = 'cou-mandat oui';
      el.title = `${m.fichier_nom || 'Mandat de courtage'} — cliquer pour l’ouvrir`;
      el.innerHTML = `<img src="assets/logos/mandat-signe.svg" alt="" width="20" height="20"/><span>Mandat signé<small>${fmtDate(String(m.created_at).slice(0, 10))}</small></span>`;
      el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.onclick = () => typeof voirMandatSauvegarde === 'function' && voirMandatSauvegarde(m.id);
    } else {
      el.className = 'cou-mandat non';
      el.title = 'Aucun mandat signé enregistré — cliquer pour en créer un';
      el.innerHTML = `<img src="assets/logos/mandat-signe.svg" alt="" width="20" height="20"/><span>Pas de mandat</span>`;
      el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.onclick = () => typeof ouvrirOptionsMandatCourtage === 'function' && ouvrirOptionsMandatCourtage(id);
    }
    el.onkeydown = e => { if (e.key === 'Enter') el.onclick(); };
  }
}

// La pastille est posée dans le HTML ; on la remplit dès qu'elle arrive dans la page.
(function couObserverMandats() {
  const o = new MutationObserver(() => { if (document.querySelector('[data-cou-mandat]:not([data-rempli])')) couRemplirMandats(); });
  const go = () => o.observe(document.body, { childList: true, subtree: true });
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
})();

// On remplace la fonction de js/04 : elle est appelée par son nom depuis la fiche client, donc
// rien d'autre n'est à toucher, et l'ancienne reste en place si ce fichier n'est pas chargé.
(function couBrancher() {
  if (typeof renderVueEnsembleCouvertures === 'function') window.renderVueEnsembleCouvertures = couRendre;
})();
