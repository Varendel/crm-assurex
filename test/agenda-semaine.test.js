// Répartition en colonnes des rendez-vous qui se chevauchent — vue Agenda / semaine (24.09.2026).
// Sans dépendance : la fonction est extraite du vrai fichier de production et évaluée telle quelle,
// pour qu'un changement dans js/10 casse ce test plutôt que l'affichage de l'agenda de Jonathan.
//
// Incident à l'origine : toutes les barres d'une journée étaient posées « left:2px; right:2px ».
// Deux rendez-vous à la même heure se recouvraient exactement — le second masquait le premier,
// et une journée chargée paraissait vide.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', '10-commissions-parametres.js'), 'utf8')
  .replace(/\r\n/g, '\n');
const bloc = src.match(/function agendaRepartirColonnes[\s\S]*?\n}\n/);
if (!bloc) { console.log('FAIL  agendaRepartirColonnes introuvable dans js/10-commissions-parametres.js'); process.exit(1); }
eval(bloc[0]);

let pass = 0, fail = 0;

// La garantie qui compte : dans une même colonne, jamais deux rendez-vous qui se chevauchent.
function verifier(nom, barres, colonnesAttendues) {
  const r = agendaRepartirColonnes(barres.map(x => ({ ...x })));
  const problemes = [];
  if (r.length !== barres.length) problemes.push(`${r.length} barres rendues au lieu de ${barres.length}`);
  for (let i = 0; i < r.length; i++) {
    for (let j = i + 1; j < r.length; j++) {
      const a = r[i], b = r[j];
      if (a.col === b.col && a.debut < b.fin && b.debut < a.fin) {
        problemes.push(`[${a.debut}-${a.fin}] et [${b.debut}-${b.fin}] partagent la colonne ${a.col}`);
      }
    }
  }
  const nbCols = r.length ? Math.max(...r.map(x => x.nbCols)) : 0;
  if (colonnesAttendues != null && nbCols !== colonnesAttendues) {
    problemes.push(`${nbCols} colonnes au lieu de ${colonnesAttendues}`);
  }
  // Une barre doit toujours tenir dans la largeur : col < nbCols.
  r.forEach(b => { if (!(b.col < b.nbCols)) problemes.push(`colonne ${b.col} hors des ${b.nbCols} colonnes`); });

  if (problemes.length) { fail++; console.log(`FAIL  ${nom} — ${problemes.join(' ; ')}`); }
  else { pass++; console.log(`PASS  ${nom}${r.length ? ' — ' + r.map(x => `[${x.debut}-${x.fin}] col ${x.col}/${x.nbCols}`).join(', ') : ''}`); }
}

verifier('deux rendez-vous qui se chevauchent → 2 colonnes',
  [{ debut: 9, fin: 10 }, { debut: 9.5, fin: 11 }], 2);

verifier('trois exactement superposés → 3 colonnes',
  [{ debut: 9, fin: 12 }, { debut: 9, fin: 12 }, { debut: 9, fin: 12 }], 3);

verifier('deux qui se suivent sans se toucher → 1 seule colonne, pleine largeur',
  [{ debut: 9, fin: 10 }, { debut: 10, fin: 11 }], 1);

// Le cas piégeux : le troisième ne chevauche PAS le premier, il doit donc reprendre sa colonne
// au lieu d'en ouvrir une inutile qui rétrécirait toute la grappe.
verifier('chaîne décalée → la colonne libérée est réutilisée',
  [{ debut: 8, fin: 9.5 }, { debut: 9, fin: 10 }, { debut: 9.75, fin: 11 }], 2);

verifier('journée vide', [], null);

verifier('un seul rendez-vous → pleine largeur', [{ debut: 14, fin: 15 }], 1);

// Journée chargée réaliste : huit rendez-vous dont plusieurs simultanés.
verifier('journée chargée (8 rendez-vous)', [
  { debut: 8, fin: 9 }, { debut: 8.5, fin: 9.5 }, { debut: 9, fin: 10 },
  { debut: 11, fin: 12 }, { debut: 11, fin: 11.5 }, { debut: 11.25, fin: 13 },
  { debut: 14, fin: 15 }, { debut: 16, fin: 17 },
], null);

console.log(`\n${pass} tests passés, ${fail} échoués.`);
process.exit(fail > 0 ? 1 : 0);
