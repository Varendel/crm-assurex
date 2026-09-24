// Carte « Agenda de la semaine » du tableau de bord (js/03, dayCard) — passage en colonnes.
// La fonction est imbriquée dans renderCalendarWidget : on en extrait le corps et on l'évalue
// avec des dépendances minimales. Ce que le test garantit, c'est la STRUCTURE : au-delà de trois
// rendez-vous, une grille, et surtout aucun rendez-vous perdu en route.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', '03-auth-navigation.js'), 'utf8')
  .replace(/\r\n/g, '\n');
const bloc = src.match(/ {2}function dayCard\(date, label\) \{[\s\S]*?\n {2}\}\n/);
if (!bloc) { console.log('FAIL  dayCard introuvable dans js/03-auth-navigation.js'); process.exit(1); }

const dom = new JSDOM('<!DOCTYPE html><body></body>');
let evenements = [];
// Dépendances de dayCard, réduites au strict nécessaire.
const eventsForDay = () => evenements;
const dateEvenementGraph = s => new Date(s);
eval(bloc[0]);

let pass = 0, fail = 0;
function check(label, actuel, attendu) {
  const ok = JSON.stringify(actuel) === JSON.stringify(attendu);
  if (ok) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} : obtenu ${JSON.stringify(actuel)}, attendu ${JSON.stringify(attendu)}`); }
}

function rendre(n) {
  evenements = Array.from({ length: n }, (_, i) => ({
    subject: `Rendez-vous ${i + 1}`,
    start: { dateTime: `2026-09-24T0${8 + i}:00:00` },
    end: { dateTime: `2026-09-24T0${9 + i}:00:00` },
  }));
  const hote = dom.window.document.createElement('div');
  hote.innerHTML = dayCard(new Date('2026-09-24'), 'Aujourd’hui');
  return hote;
}

// Le libellé apparaît deux fois par rendez-vous (infobulle + texte) : on compte les BLOCS,
// reconnaissables à leur liseré d'accent, pas les occurrences du mot.
const nbBlocs = hote => hote.querySelectorAll('div[style*="border-left:3px solid var(--accent)"]').length;

// Trois rendez-vous ou moins : liste verticale, comme avant.
let h = rendre(3);
check('3 rendez-vous — pas de grille', /display:grid/.test(h.innerHTML), false);
check('3 rendez-vous — les 3 sont rendus', nbBlocs(h), 3);

// Au-delà : grille multi-colonnes, et surtout aucun rendez-vous perdu.
h = rendre(6);
check('6 rendez-vous — grille en colonnes', /display:grid/.test(h.innerHTML), true);
check('6 rendez-vous — les 6 sont rendus', nbBlocs(h), 6);
check('6 rendez-vous — le compte est annoncé', /6 rendez-vous/.test(h.innerHTML), true);

// Le HTML doit rester bien formé : jsdom recolle les balises mal fermées, donc on compare la
// profondeur attendue plutôt que le texte. Un div de trop sortirait les blocs de la grille.
const grille = h.querySelector('div > div[style*="display:grid"]');
check('la grille existe et contient tous les rendez-vous', grille ? grille.children.length : 0, 6);

// Journée vide : ni grille, ni bloc fantôme.
evenements = [];
const vide = dom.window.document.createElement('div');
vide.innerHTML = dayCard(new Date('2026-09-24'), 'Demain');
check('journée vide — message affiché', /Aucun rendez-vous/.test(vide.innerHTML), true);
check('journée vide — pas de grille', /display:grid/.test(vide.innerHTML), false);

console.log(`\n${pass} tests passés, ${fail} échoués.`);
process.exit(fail > 0 ? 1 : 0);
