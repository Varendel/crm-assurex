// FUSION DE PDF — reconstituer un document signé à partir de son original.
//
// Le cas qui l'a fait écrire (25.09.2026) : une cliente renvoie « Signature RC Pro.pdf », c'est-à-dire
// la seule page qu'elle a signée, détachée de l'offre. Le dossier se retrouve avec deux fichiers
// dont aucun n'est le document : l'offre sans signature, et une signature sans offre.
//
// Ce script les remet ensemble. Par défaut il REMPLACE les dernières pages de l'original par
// celles du document signé — une page signée est la même page, en mieux : garder les deux ferait
// un document qui se contredit.
//
// Usage :
//   node test/fusion-pdf.js <original.pdf> <signe.pdf> <sortie.pdf> [--ajouter]
//
//   --ajouter  ajoute les pages signées à la fin au lieu de remplacer. À utiliser quand le
//              document signé n'est pas une reprise des dernières pages (un avenant, par exemple).
//
// Il n'écrase jamais un fichier existant : mieux vaut refuser que perdre un original.
const fs = require('fs');
const path = require('path');

const [, , original, signe, sortie, ...options] = process.argv;
if (!original || !signe || !sortie) {
  console.error('Usage : node test/fusion-pdf.js <original.pdf> <signe.pdf> <sortie.pdf> [--ajouter]');
  process.exit(2);
}
for (const f of [original, signe]) {
  if (!fs.existsSync(f)) { console.error(`Introuvable : ${f}`); process.exit(2); }
}
if (fs.existsSync(sortie)) { console.error(`${sortie} existe déjà — choisis un autre nom.`); process.exit(2); }

let PDFDocument;
try {
  ({ PDFDocument } = require(path.join(__dirname, '..', 'node_modules', 'pdf-lib')));
} catch (e) {
  console.error('pdf-lib manquant. Lance : npm install pdf-lib --no-save');
  process.exit(2);
}

(async () => {
  const docOriginal = await PDFDocument.load(fs.readFileSync(original));
  const docSigne = await PDFDocument.load(fs.readFileSync(signe));
  const nOriginal = docOriginal.getPageCount();
  const nSigne = docSigne.getPageCount();
  const remplacer = !options.includes('--ajouter');

  const resultat = await PDFDocument.create();
  // Les pages de l'original qu'on garde : toutes, moins celles que la version signée reprend.
  const garder = remplacer ? Math.max(0, nOriginal - nSigne) : nOriginal;
  if (remplacer && nSigne > nOriginal) {
    console.error(`Le document signé a ${nSigne} pages, l'original ${nOriginal} : il ne peut pas en être la fin. Relance avec --ajouter.`);
    process.exit(1);
  }

  const pagesOriginal = await resultat.copyPages(docOriginal, [...Array(garder).keys()]);
  pagesOriginal.forEach(p => resultat.addPage(p));
  const pagesSigne = await resultat.copyPages(docSigne, [...Array(nSigne).keys()]);
  pagesSigne.forEach(p => resultat.addPage(p));

  // Le document reconstitué le dit de lui-même : personne ne doit le prendre pour l'original.
  resultat.setTitle(path.basename(sortie, '.pdf'));
  resultat.setSubject('Document reconstitué : original + pages signées');
  resultat.setProducer('REX CRM — fusion-pdf.js');
  resultat.setCreationDate(new Date());

  fs.writeFileSync(sortie, await resultat.save());
  console.log(`✓ ${sortie}`);
  console.log(`  ${garder} page(s) de l'original${remplacer && garder < nOriginal ? ` (les ${nOriginal - garder} dernières remplacées)` : ''}`);
  console.log(`  + ${nSigne} page(s) signée(s) = ${garder + nSigne} pages`);
})().catch(e => { console.error('Fusion impossible : ' + e.message); process.exit(1); });
