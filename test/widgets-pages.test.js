// Libre disposition des pages (js/160) — clés stables, masquage et ordre.
// Le module est chargé tel quel dans un DOM minimal : si quelqu'un change la façon dont une carte
// est identifiée, la disposition enregistrée par Jonathan cesserait de s'appliquer en silence.
// C'est exactement ce qu'un test doit attraper.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="main-content">
    <div class="dbx-onglets"></div>
    <div class="dbx-trio">
      <section class="dbx-carte dbx-demandes" aria-labelledby="t1">
        <header class="dbx-carte-tete"><h2 id="t1">Demandes clients en attente</h2></header>
      </section>
      <section class="dbx-carte dbx-horloge" aria-label="Horloge"></section>
      <section class="dbx-carte dbx-carte-agenda dbx-agenda-semaine" aria-label="Agenda de la semaine"></section>
    </div>
    <div class="dbx-grille"><div class="dbx-col">
      <section class="dbx-carte" aria-labelledby="t2">
        <header class="dbx-carte-tete"><h2 id="t2">À faire</h2></header>
      </section>
      <section class="dbx-carte" aria-labelledby="t3">
        <header class="dbx-carte-tete"><h2 id="t3">À surveiller</h2></header>
      </section>
    </div></div>
  </div></body></html>`, { runScripts: 'outside-only' });

const { window } = dom;
global.window = window;
global.document = window.document;
// Le module n'utilise ces globales que pour lire/écrire les préférences : on les neutralise,
// le test porte sur la mise en page, pas sur la base de données.
window.currentView = 'dashboard';
window.currentUser = null;
window.dbGet = async () => [];
window.dbPatch = async () => ({});
window.showError = () => {};
window.creerModale = () => {};
window.errMsg = e => String(e);

window.eval(fs.readFileSync(path.join(ROOT, 'js', '160-widgets-pages.js'), 'utf8'));

let pass = 0, fail = 0;
function check(label, actuel, attendu) {
  const ok = JSON.stringify(actuel) === JSON.stringify(attendu);
  if (ok) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} : obtenu ${JSON.stringify(actuel)}, attendu ${JSON.stringify(attendu)}`); }
}

const cartes = [...document.querySelectorAll('.dbx-carte')];
const cles = cartes.map(s => window.wgtCle(s));

// 1. Les clés : classe connue en priorité, titre sinon — et surtout, toutes distinctes.
check('clés des cartes', cles,
  ['demandes-clients', 'horloge', 'agenda-semaine', 'a-faire', 'a-surveiller']);
check('aucune clé vide', cles.filter(c => !c).length, 0);
check('toutes les clés sont distinctes', new Set(cles).size, cles.length);

// 2. Un titre accentué donne une clé sans accent ni espace — stable si on reformule la casse.
check('titre accentué normalisé', window.wgtNormaliser('À surveiller'), 'a-surveiller');
check('titre avec ponctuation', window.wgtNormaliser('Commissions encaissées / attendues'), 'commissions-encaissees-attendues');

const poserPrefs = p => { window._wgt.prefs = p; };

// 3. Application : ce qui est caché disparaît, ce qui est ordonné prend son rang.
poserPrefs({ dashboard: { caches: ['horloge'], ordre: ['a-faire', 'agenda-semaine', 'demandes-clients'] } });
window.wgtAppliquer();

const par = k => cartes.find(s => window.wgtCle(s) === k);
check('l’horloge est masquée', par('horloge').style.display, 'none');
check('les autres restent visibles', ['demandes-clients', 'a-faire', 'a-surveiller'].map(k => par(k).style.display), ['', '', '']);
check('ordre appliqué — à faire en premier', par('a-faire').style.order, '0');
check('ordre appliqué — agenda ensuite', par('agenda-semaine').style.order, '1');
check('ordre appliqué — demandes ensuite', par('demandes-clients').style.order, '2');
check('carte non listée : rang d’origine conservé', par('a-surveiller').style.order, '');
check('la clé est inscrite sur la carte', par('a-faire').dataset.wgt, 'a-faire');

// 4. Revenir à l'origine doit tout ré-afficher et tout déclasser.
poserPrefs({});
window.wgtAppliquer();
check('retour à l’origine — rien de masqué', cartes.map(s => s.style.display), ['', '', '', '', '']);
check('retour à l’origine — plus aucun rang', cartes.map(s => s.style.order), ['', '', '', '', '']);

// 5. Une préférence qui nomme une carte disparue ne doit rien casser.
poserPrefs({ dashboard: { caches: ['carte-supprimee-en-2025'], ordre: ['carte-supprimee-en-2025', 'a-faire'] } });
window.wgtAppliquer();
check('clé inconnue ignorée sans dégât', par('a-faire').style.order, '1');
check('aucune carte masquée par erreur', cartes.filter(s => s.style.display === 'none').length, 0);

console.log(`\n${pass} tests passés, ${fail} échoués.`);
process.exit(fail > 0 ? 1 : 0);
