// LE FIL DE L'AFFAIRE — ce qui est fait pour un client doit se retrouver dans son dossier.
//
// Le 25.09.2026, un mandat part à Zurich. Le fil de l'affaire TANDOORI PLAGE, lui, n'en sait rien :
// il montre « ✓ Tâche terminée : Poser mandat » et s'arrête là. À qui ? Quand ? Avec quoi ? La
// réponse était dans Outlook, c'est-à-dire nulle part pour qui reprend le dossier.
// js/166 rattache donc un envoi à une affaire — par son identifiant, ou par le client.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://crm.test/', runScripts: 'outside-only' });
const { window } = dom;
global.window = window; global.document = window.document;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)}`); }
}

// Les affaires telles qu'elles existent : un client peut en avoir plusieurs, dont des closes.
window.allOpportunites = [
  { id: 'opp-vieille', client_id: 'cl-1', stade: 'Gagné', created_at: '2026-01-10T09:00:00Z' },
  { id: 'opp-close-recente', client_id: 'cl-1', stade: 'Perdue', created_at: '2026-09-20T09:00:00Z' },
  { id: 'opp-en-cours', client_id: 'cl-1', stade: 'Analyse', created_at: '2026-09-01T09:00:00Z' },
  { id: 'opp-tandoori', client_id: 'cl-2', stade: 'Analyse', created_at: '2026-09-22T08:05:00Z' },
  { id: 'opp-ancienne-2', client_id: 'cl-3', stade: 'Gagné', created_at: '2026-02-01T09:00:00Z' },
];

const lignes = [];
window.ajouterLigneHistoriqueOpportunite = async (oppId, texte) => { lignes.push({ oppId, texte }); };

// L'envoi réel, remplacé par un double qui dit seulement s'il est parti.
let dernierEnvoi = null;
window.envoyerCourriel = async (o) => { dernierEnvoi = o; return o.echec ? { ok: false, statut: 'refus' } : { ok: true, statut: 'envoyé', destinataires: ['milene@zurich.ch'] }; };

window.eval(fs.readFileSync(path.join(ROOT, 'js/166-fil-affaire.js'), 'utf8'));

// ── Quelle affaire reçoit la ligne ───────────────────────────────────────────────────────────────
check('une affaire ouverte prime sur une affaire close plus récente', window.filOppDuClient('cl-1'), 'opp-en-cours');
check('client à une seule affaire', window.filOppDuClient('cl-2'), 'opp-tandoori');
check('toutes closes : la plus récente quand même', window.filOppDuClient('cl-3'), 'opp-ancienne-2');
check('client sans affaire', window.filOppDuClient('cl-inconnu'), null);
check('sans client', window.filOppDuClient(null), null);

(async () => {
  // ── La ligne elle-même ─────────────────────────────────────────────────────────────────────────
  lignes.length = 0;
  check('référencer par identifiant d’affaire', await window.filReferencer({ oppId: 'opp-tandoori' }, '🤝 Mandat posé'), true);
  check('… inscrit sur la bonne affaire', lignes[0].oppId, 'opp-tandoori');
  check('référencer par client', await window.filReferencer({ clientId: 'cl-1' }, 'test'), true);
  check('… résout l’affaire en cours', lignes[1].oppId, 'opp-en-cours');
  // Sans affaire, on n'invente pas de dossier où ranger la ligne.
  lignes.length = 0;
  check('client sans affaire : rien n’est écrit', await window.filReferencer({ clientId: 'cl-inconnu' }, 'test'), false);
  check('texte vide : rien n’est écrit', await window.filReferencer({ oppId: 'opp-tandoori' }, ''), false);
  check('aucune ligne parasite', lignes.length, 0);

  // ── Le branchement sur l'envoi ─────────────────────────────────────────────────────────────────
  lignes.length = 0;
  await window.envoyerCourriel({
    a: ['milene@zurich.ch'], objet: 'Mandat — TANDOORI PLAGE Sàrl', texte: 'Bonjour,',
    affaire: { clientId: 'cl-2', libelle: '🤝 Mandat posé chez Zurich' },
  });
  check('un mandat envoyé laisse une ligne', lignes.length, 1);
  check('… sur l’affaire du client', lignes[0].oppId, 'opp-tandoori');
  check('… avec le geste', lignes[0].texte.startsWith('🤝 Mandat posé chez Zurich'), true);
  check('… et le destinataire', lignes[0].texte.includes('milene@zurich.ch'), true);

  // Un envoi qui échoue n'a rien fait : le fil ne doit pas prétendre le contraire.
  lignes.length = 0;
  await window.envoyerCourriel({ a: ['x@y.ch'], objet: 'o', texte: 't', echec: true, affaire: { clientId: 'cl-2' } });
  check('envoi refusé : aucune ligne', lignes.length, 0);

  // Un essai ne part chez personne.
  await window.envoyerCourriel({ a: [], objet: 'o', texte: 't', test: true, affaire: { clientId: 'cl-2' } });
  check('essai : aucune ligne', lignes.length, 0);

  // Les envois qui écrivent déjà leur propre ligne (demande d'offre…) ne passent pas par ici.
  await window.envoyerCourriel({ a: ['x@y.ch'], objet: 'Demande d’offre', texte: 't' });
  check('sans affaire : aucune ligne automatique', lignes.length, 0);

  // Le courriel lui-même n'est pas altéré par le branchement.
  check('l’envoi reçoit bien son objet', dernierEnvoi.objet, 'Demande d’offre');

  // Sans libellé, la ligne dit au moins qu'un courriel est parti, et lequel.
  lignes.length = 0;
  await window.envoyerCourriel({ a: ['x@y.ch'], objet: 'Résiliation Zurich', texte: 't', affaire: { oppId: 'opp-tandoori' } });
  check('libellé par défaut : le courriel et son objet', lignes[0].texte.includes('Résiliation Zurich'), true);

  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail ? 1 : 0);
})();
