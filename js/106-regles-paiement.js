// ═══ LE RYTHME DE PAIEMENT DE CHAQUE COMPAGNIE (20.09.2026) ════════════════════════════════════
// « Crée et applique une règle de paiement pour les années suivantes selon les compagnies, basée
//   sur les paiements passés. »
//
// Jusqu'ici, quatre compagnies avaient un délai écrit à la main (Vaudoise 37 jours, AXA 40,
// Swiss Life 65, Nest 95) et toutes les autres recevaient un défaut de 60 jours. Ces chiffres
// n'avaient jamais été confrontés aux versements réels — ils venaient d'une impression.
//
// CE QU'ON A MESURÉ, ET POURQUOI CE N'EST PAS UN DÉLAI.
// Une compagnie n'a pas un délai, elle a un CALENDRIER DE PAIE. La Vaudoise verse entre le 1er et
// le 7 du mois, le Groupe Mutuel entre le 18 et le 24, AXA entre le 10 et le 13. Le jour du mois
// est resserré ; le délai depuis la fin de période, lui, s'étale — parce qu'il dépend aussi de la
// date à laquelle la compagnie a arrêté son décompte, qui varie.
//
// Le jour du mois a une seconde vertu : il vient du relevé bancaire, donc d'un fait. La période
// des bordereaux reconstitués depuis la banque a été déduite ; bâtir un délai là-dessus
// reviendrait à mesurer sa propre hypothèse.
//
// CE QUE CE FICHIER CORRIGE : le JOUR, pas le mois. La machinerie existante (js/19) décide dans
// quel mois la commission tombe — elle connaît la périodicité, les versements annuels, les
// naissances, les droits différés. On ne la remplace pas : on cale sa réponse sur le jour où
// cette compagnie paie réellement. Une prévision au 28 chez une compagnie qui verse le 5 est
// fausse de trois semaines, et trois semaines décident d'un découvert.
//
// FIABILITÉ. Une compagnie vue une fois ne donne pas une règle, elle donne une anecdote. En
// dessous de deux versements observés, on ne touche à rien.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Les prévisions reprennent leur jour d'avant.

let REGLES_PAIEMENT = null;        // rempli au premier chargement, indexé par nom normalisé

function rgpCle(compagnie) {
  const n = typeof pictoResoudre === 'function' ? pictoResoudre(compagnie)
    : (typeof normaliserCompagnie === 'function' ? normaliserCompagnie(compagnie) : compagnie);
  return String(n || '').trim().toLowerCase();
}

async function rgpCharger(forcer) {
  if (REGLES_PAIEMENT && !forcer) return REGLES_PAIEMENT;
  const lignes = await dbGet('v_regles_paiement_compagnies', 'select=*').catch(() => []) || [];
  const t = {};
  for (const r of lignes) t[rgpCle(r.compagnie)] = r;
  REGLES_PAIEMENT = t;
  return t;
}

function rgpRegle(compagnie) {
  if (!REGLES_PAIEMENT || !compagnie) return null;
  const r = REGLES_PAIEMENT[rgpCle(compagnie)];
  // « insuffisante » = une seule observation. On préfère ne rien dire que dire n'importe quoi.
  return r && r.fiabilite !== 'insuffisante' ? r : null;
}

// ── Caler une date sur le jour de paie de la compagnie ─────────────────────────────────────────
// On cherche l'occurrence du jour J la PLUS PROCHE de l'estimation, avant ou après. Toujours aller
// vers l'avant biaiserait la prévision en retard d'un demi-mois en moyenne, et une trésorerie
// systématiquement optimiste sur les dates est pire qu'une trésorerie imprécise.
function rgpCaler(iso, jour) {
  if (!iso || !jour) return iso;
  const base = new Date(iso + 'T00:00:00');
  if (isNaN(base)) return iso;

  const candidat = (decalageMois) => {
    const a = base.getFullYear(), m = base.getMonth() + decalageMois;
    // Le 31 n'existe pas partout : on retombe sur le dernier jour du mois plutôt que de déborder
    // silencieusement sur le mois suivant, ce que fait le constructeur Date par défaut.
    const dernier = new Date(a, m + 1, 0).getDate();
    return new Date(a, m, Math.min(jour, dernier));
  };

  let meilleur = null, ecart = Infinity;
  for (const d of [-1, 0, 1]) {
    const c = candidat(d);
    const e = Math.abs(c - base);
    if (e < ecart) { ecart = e; meilleur = c; }
  }
  const p = n => String(n).padStart(2, '0');
  return `${meilleur.getFullYear()}-${p(meilleur.getMonth() + 1)}-${p(meilleur.getDate())}`;
}

// ── Le branchement ─────────────────────────────────────────────────────────────────────────────
(function rgpBrancher() {
  // Les règles se chargent une fois, en arrière-plan. Tant qu'elles ne sont pas là, la prévision
  // d'origine s'applique telle quelle : aucun écran n'attend.
  if (typeof dbGet === 'function') setTimeout(() => rgpCharger().catch(() => {}), 1500);

  if (typeof commissionDatePrevue === 'function') {
    const origine = commissionDatePrevue;
    window.commissionDatePrevue = function (ca) {
      const p = origine.apply(this, arguments);
      if (!p || !ca) return p;
      const r = rgpRegle(ca.compagnie);
      if (!r || !r.jour_median) return p;
      return rgpCaler(p, r.jour_median);
    };
  }

  // Le profil de versement sert ailleurs (js/19 l'utilise pour expliquer la prévision à l'écran).
  // On y ajoute ce qu'on a mesuré, sans retirer ce qui existait : les quatre délais écrits à la
  // main restent la source du MOIS, la mesure donne le JOUR et la retenue.
  if (typeof profilVersementCompagnie === 'function') {
    const origine = profilVersementCompagnie;
    window.profilVersementCompagnie = function (ca) {
      const p = origine.apply(this, arguments) || null;
      const r = ca ? rgpRegle(ca.compagnie) : null;
      if (!r) return p;
      return Object.assign({}, p, {
        jour: r.jour_median,
        jourMin: r.jour_min,
        jourMax: r.jour_max,
        fiabilite: r.fiabilite,
        observations: r.observations,
        // Le Groupe Mutuel retient 10 % au compte de caution : ce n'est pas une perte, c'est une
        // créance qui rentrera plus tard. Elle décale la trésorerie sans réduire le revenu.
        retenuePct: Number(r.retenue_pct || 0),
        decalageJours: p ? p.decalageJours : undefined,
      });
    };
  }
})();

// ── Ce que la règle dit, en une phrase ─────────────────────────────────────────────────────────
// Utilisable partout où l'on veut expliquer une date plutôt que la subir.
function rgpPhrase(compagnie) {
  const r = rgpRegle(compagnie);
  if (!r) return '';
  const etendue = r.jour_max - r.jour_min;
  const precision = etendue <= 3 ? 'très régulier'
    : etendue <= 10 ? `entre le ${r.jour_min} et le ${r.jour_max}`
    : `avec des écarts (du ${r.jour_min} au ${r.jour_max})`;
  const retenue = Number(r.retenue_pct || 0) > 0
    ? ` Retient ${String(r.retenue_pct).replace('.', ',')} % au compte de caution.` : '';
  return `Verse autour du ${r.jour_median} du mois, ${precision} — ${r.observations} versement${r.observations > 1 ? 's' : ''} observé${r.observations > 1 ? 's' : ''}.${retenue}`;
}
