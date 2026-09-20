// ═══ REX CLOUD — LA DATE DE NAISSANCE SOUS LE NOM (20.09.2026) ═════════════════════════════════
// « Insère date de naissance sous le nom. »
//
// Le nom seul ne prouve rien : Özkan Kevin et Özkan Kevin peuvent être deux personnes, et un
// client qui ouvre son espace veut d'abord savoir qu'il est chez LUI. La date de naissance est
// la donnée qui le lui dit en un regard.
//
// Elle sert aussi de contrôle silencieux dans l'autre sens. Une date de naissance fausse dans la
// fiche, ce sont des primes fausses partout : la LAMal est tarifée par classe d'âge, le 3a par
// durée jusqu'à la retraite, la vie et l'IJ par âge d'entrée. Le client est le seul à pouvoir
// repérer l'erreur, et il ne la repérera que si on la lui montre.
//
// PAS POUR LES ENTREPRISES : une société n'a pas de date de naissance. Le bloc ne paraît que
// lorsque la fiche en porte une.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de index.html (ce fichier + 99-ec-identite.css).

function eciEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// L'âge révolu. Le calcul se fait sur l'année puis se corrige si l'anniversaire n'est pas passé :
// soustraire les millisecondes donnerait un an de trop un jour sur quatre à cause des bissextiles.
function eciAge(iso) {
  if (!iso) return null;
  const n = new Date(iso + 'T00:00:00');
  if (isNaN(n)) return null;
  const auj = new Date();
  let a = auj.getFullYear() - n.getFullYear();
  const m = auj.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && auj.getDate() < n.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

// « Né le » / « Née le » quand la civilité est connue, sinon une formulation qui ne suppose rien.
function eciNePrefixe(c) {
  const civ = String((c && c.civilite) || '').trim().toLowerCase();
  if (/^(mme|madame)/.test(civ)) return 'Née le';
  if (/^(m\.?|monsieur)$/.test(civ)) return 'Né le';
  return 'Date de naissance';
}

function eciBlocHtml(c) {
  if (!c || !c.date_naissance) return '';
  if (typeof estEntreprise === 'function' && estEntreprise(c)) return '';
  const d = typeof fmtDate === 'function' ? fmtDate(String(c.date_naissance).slice(0, 10)) : c.date_naissance;
  const age = eciAge(String(c.date_naissance).slice(0, 10));
  const prefixe = eciNePrefixe(c);
  return `<div class="ec-ident">
    <span><em>${prefixe}</em> ${eciEsc(d)}</span>
    ${age !== null ? `<span class="ec-ident-sep">·</span><span>${age} ans</span>` : ''}
  </div>`;
}

// On enveloppe la vue de l'espace client (js/52, la dernière en place) et on glisse le bloc
// juste après le titre. Insérer dans le HTML produit plutôt que réécrire la vue : les autres
// fichiers qui l'enveloppent (js/97, js/98) continuent de fonctionner sans rien savoir d'ici.
(function eciBrancher() {
  if (typeof ecVueEspaceClient !== 'function') return;
  const origine = ecVueEspaceClient;

  window.ecVueEspaceClient = function () {
    const html = origine.apply(this, arguments);
    const c = (window._ec || {}).client;
    const bloc = eciBlocHtml(c);
    if (!bloc || html.includes('class="ec-ident"')) return html;
    // Le premier </h1> de la page est celui du nom, dans le bandeau.
    const i = html.indexOf('</h1>');
    if (i < 0) return html;
    return html.slice(0, i + 5) + bloc + html.slice(i + 5);
  };
})();
