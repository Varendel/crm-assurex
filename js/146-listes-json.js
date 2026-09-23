// ═══ ÉCRIRE DANS UNE LISTE JSON SANS EFFACER LE RESTE (23.09.2026) ══════════════════════════════
// Audit du 23.09.2026, après la perte d'une offre d'Allocia Palanca.
//
// LE PROBLÈME. Plusieurs colonnes du CRM sont des listes JSON — les offres d'une demande
// (demandes_offre.compagnies_envoi), les pièces jointes d'une affaire (opportunites.pieces_jointes),
// les polices d'une demande. Une écriture y remplace TOUT le contenu, pas seulement la ligne
// touchée. Or le code partait presque toujours de la copie en mémoire (window._opDemandes,
// _pipelineDemandes, allOpportunites), qui date du dernier chargement de l'écran. Tout ce qui avait
// été ajouté depuis — depuis un autre écran, un autre onglet, un import Outlook, le dépôt
// automatique d'un PDF — n'y figurait pas, et disparaissait à l'enregistrement suivant. Sans
// erreur, sans message : la ligne n'était simplement plus là.
//
// L'audit en a trouvé onze. Deux ont fait des dégâts visibles le 23.09.2026.
//
// LA RÈGLE. On ne construit plus la liste à partir de la mémoire : on relit la ligne en base,
// on applique la modification à CETTE liste-là, et on réécrit. Deux écrans qui travaillent sur la
// même demande ne s'effacent plus l'un l'autre.
//
//   await majListeJson('demandes_offre', d.id, 'compagnies_envoi',
//     liste => liste.map((e, i) => i === idx ? { ...e, retenue: true } : e));
//
// Le transformateur reçoit la liste FRAÎCHE et rend la nouvelle. Les positions restent valables :
// les entrées s'ajoutent toujours à la fin, jamais au milieu.

async function majListeJson(table, id, colonne, transformer, secours) {
  let fraiche = null;
  try {
    const rows = await dbGet(table, `id=eq.${id}&select=${colonne}`);
    const v = Array.isArray(rows) && rows[0] ? rows[0][colonne] : null;
    if (Array.isArray(v)) fraiche = v;
  } catch (e) { /* relecture impossible : on retombe sur la liste fournie par l'appelant */ }

  const base = fraiche || (Array.isArray(secours) ? secours : []);
  let nouvelle;
  try { nouvelle = transformer(base); } catch (e) { return { error: 'liste non modifiée : ' + (e.message || e) }; }
  if (!Array.isArray(nouvelle)) return { error: 'liste non modifiée : transformation invalide' };

  const r = await dbPatch(table, id, { [colonne]: nouvelle });
  if (r && r.error) return r;
  return { liste: nouvelle };
}

// Raccourci pour le cas le plus fréquent : remplacer l'entrée n° idx d'une liste d'offres.
async function majEntreeOffre(demandeId, idx, entree, secours) {
  return majListeJson('demandes_offre', demandeId, 'compagnies_envoi',
    liste => (idx === null || idx === undefined || !liste[idx])
      ? [...liste, entree]
      : liste.map((e, i) => (i === idx ? entree : e)),
    secours);
}
