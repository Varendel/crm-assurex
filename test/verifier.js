// Contrôles automatiques avant publication (20.09.2026)
// Sans dépendance : s'exécute avec « node test/verifier.js ». Le déploiement (GitHub Actions)
// l'appelle avant de mettre en ligne — si un contrôle échoue, rien n'est publié.
//
// Ce qui est vérifié :
//   1. chaque fichier js/*.js est syntaxiquement valide (une seule erreur casse toute l'appli) ;
//   2. chaque <script src="js/…"> d'index.html existe réellement ;
//   3. aucun const/let de même nom déclaré dans deux fichiers — c'est fatal en scripts classiques
//      (« Identifier 'SUPABASE_URL' has already been declared » vu dans le journal d'erreurs) ;
//   4. les fonctions critiques du CRM et de l'espace client existent bien quelque part ;
//   5. chaque fichier js/*.js présent est bien chargé par index.html (sinon il est mort).
// Les redéclarations de « function » ne sont PAS signalées : c'est la convention du projet, un
// fichier de numéro supérieur remplace volontairement une fonction d'un fichier précédent.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RACINE = path.join(__dirname, '..');
const erreurs = [];
const avertissements = [];

const FONCTIONS_CRITIQUES = [
  // Noyau
  'enterApp', 'navigate', 'renderSidebar', 'dbGet', 'dbPost', 'dbPatch', 'creerModale', 'showError',
  // Clients et contrats
  'showClient', 'viewNouveauContrat', 'saveContrat', 'genererMandatCourtage',
  // Modules métier
  'viewDashboardV2', 'dbxVueEssentiel', 'viewCourriers', 'viewDossierFinancement',
  'viewMessagesClients', 'viewConseil',
  // Espace client REX CLOUD
  'ecVueEspaceClient', 'ecOuvrirTransfert', 'ecOuvrirSinistre', 'ecOuvrirDemandeDocument',
  'ecOuvrirMessage', 'ecTelechargerPolice', 'ouvrirAccesEspaceClient',
];

const index = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
const fichiers = fs.readdirSync(path.join(RACINE, 'js')).filter(f => f.endsWith('.js')).sort();

// 1. Syntaxe
const sources = {};
for (const f of fichiers) {
  const code = fs.readFileSync(path.join(RACINE, 'js', f), 'utf8');
  sources[f] = code;
  try { new vm.Script(code, { filename: f }); }
  catch (e) { erreurs.push(`${f} — erreur de syntaxe : ${e.message}`); }
}

// 2. Scripts référencés présents
const references = [...index.matchAll(/src="(js\/[^"?]+)/g)].map(m => m[1]);
for (const src of references) {
  if (!fs.existsSync(path.join(RACINE, src))) erreurs.push(`index.html référence ${src}, qui n'existe pas`);
}

// 3. Doublons de const / let entre fichiers
const declarations = new Map();
for (const f of fichiers) {
  const vus = new Set();
  for (const m of sources[f].matchAll(/^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/gm)) {
    const nom = m[1];
    if (vus.has(nom)) continue;
    vus.add(nom);
    if (!declarations.has(nom)) declarations.set(nom, []);
    declarations.get(nom).push(f);
  }
}
for (const [nom, dans] of declarations) {
  if (dans.length > 1) erreurs.push(`« ${nom} » est déclaré (const/let) dans ${dans.join(' et ')} — la page ne se chargera pas`);
}

// 4. Fonctions critiques présentes
const tout = fichiers.map(f => sources[f]).join('\n');
for (const nom of FONCTIONS_CRITIQUES) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${nom}\\s*\\(|(?:const|let|var)\\s+${nom}\\s*=\\s*(?:async\\s*)?(?:function|\\()`);
  if (!re.test(tout)) erreurs.push(`fonction critique absente : ${nom}()`);
}

// 5. Fichiers orphelins (présents mais jamais chargés)
for (const f of fichiers) {
  if (!references.includes(`js/${f}`)) avertissements.push(`js/${f} n'est chargé par aucune balise <script> d'index.html`);
}

// Résultat
const vert = (s) => `[32m${s}[0m`, rouge = (s) => `[31m${s}[0m`, jaune = (s) => `[33m${s}[0m`;
console.log(`Contrôles REX CRM — ${fichiers.length} fichiers JS, ${references.length} scripts référencés`);
avertissements.forEach(a => console.log(jaune('  ⚠ ' + a)));
if (erreurs.length) {
  erreurs.forEach(e => console.log(rouge('  ✗ ' + e)));
  console.log(rouge(`\n${erreurs.length} problème(s) bloquant(s) — publication annulée.`));
  process.exit(1);
}
console.log(vert('  ✓ syntaxe, scripts, déclarations et fonctions critiques : tout est en ordre.'));
