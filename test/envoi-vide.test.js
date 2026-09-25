// L'ENVOI VIERGE DU 25.09.2026 — et ce qui doit empêcher qu'il se reproduise.
//
// Ce qui s'est passé : la pose du mandat a été rebranchée le 24.09 sur le rédacteur d'e-mail
// partagé (js/07 — champs `apercu-email-sujet` / `apercu-email-corps`), mais son bouton d'envoi,
// resté dans js/05, lisait encore les champs de l'ancienne fenêtre (`apercu-mandat-…`). Ces
// identifiants n'existaient plus. `document.getElementById(...)?.value || ''` n'a pas bronché : il
// a rendu deux chaînes vides, et un courriel sans objet ni texte est parti à une compagnie, avec
// le mandat en pièce jointe et la signature — il a fallu s'en excuser.
//
// L'essai « M'envoyer un essai », lui, lisait les bons champs et était irréprochable. Un essai ne
// protège que le chemin qu'il emprunte : celui de l'envoi réel n'était pas testé du tout.
//
// Deux verrous, donc deux familles de contrôles ici :
//   1. structurel — tout bouton d'envoi greffé sur le rédacteur partagé DOIT lire ses champs ;
//   2. de dernier recours — envoyerCourriel refuse un message sans objet ET sans corps.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)}`); }
}

// ── 1. Structurel : les champs que le rédacteur partagé crée sont ceux que les envois lisent ─────
const src07 = lire('js/07-fichepaie-bordereaux.js');
const src05 = lire('js/05-contrats-clients.js');

// Les identifiants réellement créés par la fenêtre partagée.
const champsPartages = ['apercu-email-sujet', 'apercu-email-corps'];
champsPartages.forEach(id => check(`le rédacteur partagé crée ${id}`, src07.includes(`id="${id}"`), true));

// Toute fonction passée en `actionEnvoi` remplace le bouton d'envoi DANS cette fenêtre : elle doit
// donc y lire son objet et son corps. C'est exactement ce qui manquait au mandat.
const actions = [...src05.matchAll(/actionEnvoi:\s*'([A-Za-z0-9_]+)\(\)'/g)].map(m => m[1]);
check('la pose du mandat greffe bien un bouton sur le rédacteur partagé', actions.includes('envoyerApercuEmailMandatViaOutlook'), true);

// Le corps de la fonction, plus celui des aides qu'elle appelle : on suit une indirection, ce qui
// suffit pour mdxChampApercu() sans transformer ce test en interpréteur.
function corpsFonction(src, nom) {
  const i = src.indexOf(`function ${nom}(`);
  if (i < 0) return '';
  let p = src.indexOf('{', i), n = 0, j = p;
  for (; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}' && --n === 0) break;
  }
  return src.slice(i, j + 1);
}
// Les champs peuvent être lus par leur nom entier ou composés (`apercu-email-${base}`) : c'est le
// préfixe qui dit dans quelle fenêtre on va chercher, et c'est lui qui s'était trompé.
const litLaFenetrePartagee = corps => corps.includes('apercu-email-');

// Les boutons de cette fenêtre : celui de l'envoi, et ceux qui reprennent le même texte.
[...actions, 'copierApercuEmailMandat', 'ouvrirMailtoApercuMandat'].forEach(nom => {
  let corps = corpsFonction(src05, nom);
  [...corps.matchAll(/([a-zA-Z0-9_]+)\('(?:sujet|corps)'\)/g)].forEach(m => { corps += corpsFonction(src05, m[1]); });
  check(`${nom} lit les champs de la fenêtre ouverte`, litLaFenetrePartagee(corps), true);
});

// ── 2. Dernier recours : envoyerCourriel refuse un courriel vide ─────────────────────────────────
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://crm.test/', runScripts: 'outside-only' });
const { window } = dom;
global.window = window; global.document = window.document;
const dits = [];
window.showError = m => dits.push(String(m));
window.eval(lire('js/143-envoi-courriel.js'));
const envoyerCourriel = window.envoyerCourriel;

(async () => {
  // Le cas réel : destinataire connu, pièce jointe prête, mais objet et corps perdus en route.
  const vide = await envoyerCourriel({ a: ['milene.exemple@compagnie.ch'], objet: '', texte: '', pieces: [{ nom: 'Mandat.pdf' }], confirmer: false });
  check('courriel sans objet ni texte : refusé', vide.ok, false);
  check('courriel sans objet ni texte : statut', vide.statut, 'courriel-vide');
  check('le refus est dit à l’écran', dits.some(m => /vide/i.test(m)), true);

  // Des espaces et des sauts de ligne ne valent pas un message.
  const blancs = await envoyerCourriel({ a: ['x@y.ch'], objet: '   ', texte: '\n\n  \n', confirmer: false });
  check('objet et corps en blancs : refusé', blancs.statut, 'courriel-vide');

  // Un objet seul suffit à prouver l'intention : le CRM n'a pas à juger du reste. Le refus ne doit
  // pas non plus bloquer un envoi légitime — ici il passe la barrière et échoue plus loin,
  // faute de session Outlook dans ce test : ce qui compte, c'est qu'il ne soit pas « courriel-vide ».
  const objetSeul = await envoyerCourriel({ a: ['x@y.ch'], objet: 'Relance', texte: '', confirmer: false });
  check('un objet seul n’est pas un courriel vide', objetSeul.statut === 'courriel-vide', false);
  const corpsSeul = await envoyerCourriel({ a: ['x@y.ch'], objet: '', texte: 'Bonjour,', confirmer: false });
  check('un corps seul n’est pas un courriel vide', corpsSeul.statut === 'courriel-vide', false);
  // Et un corps déjà en HTML (comparatif d'offres) compte comme un corps.
  const htmlSeul = await envoyerCourriel({ a: ['x@y.ch'], objet: '', html: '<p>Bonjour</p>', confirmer: false });
  check('un corps HTML n’est pas un courriel vide', htmlSeul.statut === 'courriel-vide', false);

  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail ? 1 : 0);
})();
