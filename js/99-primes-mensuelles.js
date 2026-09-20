// ═══ LES PRIMES MALADIE, AU MOIS (20.09.2026) ══════════════════════════════════════════════════
// « LAMal indiquer prime mensuelle, LCA santé aussi sur REX CLOUD. »
//
// En Suisse, une prime maladie se parle au mois. Personne ne dit « ma LAMal me coûte 4 705 francs
// par an » : on dit « 392 par mois », parce que c'est le montant du bulletin, celui du budget, et
// celui que le client compare quand il regarde une autre caisse. Afficher 4 705 l'oblige à
// diviser de tête pour reconnaître son propre contrat.
//
// Les autres branches restent à l'année, et c'est voulu : une RC ménage ou une casco se facturent
// annuellement, les annualiser est la façon dont le client les connaît. Chaque branche parle donc
// dans son unité d'usage plutôt que dans une unité unique qui arrangerait le calcul.
//
// CE QUI EST AFFICHÉ : le mois en grand, l'année dessous en petit. Les deux sont utiles — le mois
// pour se reconnaître, l'année pour comparer avec le reste du portefeuille — et les totaux de
// branche restent annuels, sinon additionner des mois et des années donnerait un chiffre faux.

// Ce qui se compte au mois : l'assurance de base et les complémentaires santé. Les indemnités
// journalières et la perte de gain n'en sont pas — elles se facturent à l'année comme le reste.
const PMN_MENSUEL = /lamal|assurance maladie|compl[ée]mentaire sant[ée]|\blca\b|hospital|dentaire|ambulatoire|helsana (completa|hospital|dentaplus)/i;

function pmnEstMensuel(ct) {
  const texte = `${ct.produit || ''} ${ct.categorie || ''}`;
  if (/perte de gain|indemnit[ée]s? journali|collective/i.test(texte)) return false;
  return PMN_MENSUEL.test(texte);
}

function pmnCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }

// Deux décimales pour le mois : une prime maladie tombe rarement sur un franc rond, et arrondir
// ferait douter le client en comparant avec son bulletin.
function pmnMois(annuelle) {
  const m = Number(annuelle || 0) / 12;
  return m.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// On enveloppe le rendu d'une ligne de contrat (js/87, lui-même enveloppé par js/97) : c'est le
// dernier maillon, donc celui qui produit le HTML réellement affiché.
(function pmnBrancher() {
  if (typeof ecaContratHtml !== 'function') return;
  const origine = ecaContratHtml;

  window.ecaContratHtml = function (ct) {
    const html = origine.apply(this, arguments);
    if (!ct || !pmnEstMensuel(ct) || !Number(ct.prime_annuelle || 0)) return html;

    const annuelle = Number(ct.prime_annuelle);
    // Le bloc de prime tel que js/87 l'écrit : « CHF 4 705<small>/an</small> ».
    const ancien = `CHF ${pmnCHF(annuelle)}<small>/an</small>`;
    const nouveau = `CHF ${pmnMois(annuelle)}<small>/mois</small>`
      + `<small class="pmn-annuel">CHF ${pmnCHF(annuelle)} par an</small>`;
    return html.includes(ancien) ? html.replace(ancien, nouveau) : html;
  };
})();
