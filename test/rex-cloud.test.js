// REX CLOUD — cloisonnement de l'espace client (25.09.2026).
//
// Le risque n'est pas qu'un écran s'affiche mal : c'est qu'un client voie les données d'un autre.
// Tout le reste du CRM est interne ; REX CLOUD est la seule porte ouverte sur l'extérieur.
//
// Ce que ce fichier vérifie, et ses limites — les deux comptent :
//   - VÉRIFIÉ ICI : toute requête lancée à l'ouverture de l'espace porte le client_id de la ligne
//     d'accès, et aucun autre ; l'accès est refusé si la ligne est inactive ; l'e-mail est
//     normalisé et encodé avant d'entrer dans une URL.
//   - PAS VÉRIFIÉ ICI, et c'est le point capital : ces filtres sont posés par le NAVIGATEUR.
//     Un client qui modifie le code de la page peut demander n'importe quel client_id. La seule
//     barrière réelle est la RLS, côté base. Elle se contrôle avec test/PROTOCOLE-REX-CLOUD.md,
//     avant chaque déploiement, et rien ici ne dispense de le faire.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="login-screen"></div><div id="app"></div><div id="main-content"></div>
</body></html>`, { runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
window.localStorage = { getItem: () => null, setItem: () => {} };

// Ce que js/48 attend de son environnement.
const requetes = [];
window.dbGet = (table, q) => { requetes.push({ table, q }); return Promise.resolve([]); };
window.getValidAccessToken = () => Promise.resolve('jeton-de-test');
window.fetch = (url, opt) => { requetes.push({ table: 'rpc', q: String(url).split('/rpc/')[1] || '', opt }); return Promise.resolve({ ok: true, status: 200 }); };
window.SUPABASE_URL = 'https://exemple.supabase.co';
window.SUPABASE_KEY = 'cle-publique';
window.estEntreprise = c => !!(c && c.segment === 'Entreprise');
window.currentUser = null;

window.eval(fs.readFileSync(path.join(ROOT, 'js/48-espace-client.js'), 'utf8'));
// La vue elle-même n'est pas l'objet du test : on la neutralise pour n'observer que les requêtes.
window.ecVueEspaceClient = () => '<p>espace</p>';
const { ecAccesDeLEmail, ecEntrerEspaceClient, ecEsc } = window;

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}: obtenu ${a}, attendu ${e}`); }
}

const MIEN = '11111111-1111-1111-1111-111111111111';
const AUTRE = '22222222-2222-2222-2222-222222222222';

// ── L'accès se lit sur acces_clients, et seulement s'il est actif ──────────────────────────────
(async () => {
  requetes.length = 0;
  await ecAccesDeLEmail('Client@Exemple.CH');
  const r = requetes[0];
  check('l’accès est cherché dans acces_clients', r.table, 'acces_clients');
  check('l’e-mail est mis en minuscules', r.q.includes('client%40exemple.ch'), true);
  check('un accès désactivé ne compte pas', r.q.includes('actif=is.true'), true);

  // Une adresse tordue ne doit pas pouvoir sortir de son paramètre.
  requetes.length = 0;
  await ecAccesDeLEmail('a@b.ch&select=*&client_id=eq.' + AUTRE);
  check('l’e-mail est encodé, pas concaténé brut', requetes[0].q.includes('&client_id=eq.' + AUTRE), false);
  check('… les caractères de requête sont échappés', requetes[0].q.includes('%26select'), true);

  // ── Tout ce qui est chargé l'est pour CE client ─────────────────────────────────────────────
  requetes.length = 0;
  await ecEntrerEspaceClient({ client_id: MIEN, email: 'client@exemple.ch' }, 'client@exemple.ch');

  const lectures = requetes.filter(x => x.table !== 'rpc');
  check('sept jeux de données sont chargés', lectures.length, 7);
  check('les tables attendues, et pas d’autres',
    lectures.map(x => x.table).sort(),
    ['clients', 'contrats', 'demandes_transfert', 'mandats_signes', 'messages_clients', 'rendez_vous', 'vehicules']);

  // Le point central : aucune requête ne part sans être bornée à ce client.
  const nonBornees = lectures.filter(x => !x.q.includes(MIEN));
  check('aucune requête n’est lancée sans le client_id', nonBornees.map(x => x.table), []);
  const fuites = lectures.filter(x => x.q.includes(AUTRE));
  check('aucune requête ne mentionne un autre client', fuites.map(x => x.table), []);
  // La table clients se borne par id, les autres par client_id : les deux doivent être exacts.
  check('clients est borné par son id', lectures.find(x => x.table === 'clients').q.includes(`id=eq.${MIEN}`), true);
  ['contrats', 'vehicules', 'rendez_vous', 'mandats_signes', 'messages_clients', 'demandes_transfert'].forEach(t => {
    check(`${t} est borné par client_id`, lectures.find(x => x.table === t).q.includes(`client_id=eq.${MIEN}`), true);
  });

  // ── La session ouverte est bien une session client, pas une session du CRM ──────────────────
  check('le rôle est « client »', window.currentUser.role, 'client');
  check('le client_id de la session est celui de l’accès', window.currentUser.client_id, MIEN);
  check('la page passe en mode espace client', window.document.body.classList.contains('mode-espace-client'), true);

  // ── La trace de connexion passe par la fonction en base, pas par un PATCH ────────────────────
  // La RLS ne donne au client que la LECTURE de sa ligne d'accès : un PATCH serait refusé en
  // silence et la fiche afficherait « jamais connecté » à tort (corrigé le 20.09.2026).
  const rpc = requetes.find(x => x.table === 'rpc');
  check('la connexion est tracée par marquer_acces_client', rpc && rpc.q, 'marquer_acces_client');
  check('… en POST', rpc && rpc.opt.method, 'POST');

  // ── L'échappement HTML, sur tout ce qui vient du client ──────────────────────────────────────
  check('les chevrons sont échappés', ecEsc('<script>'), '&lt;script&gt;');
  check('les guillemets aussi', ecEsc('a"b\'c'), 'a&quot;b&#39;c');
  check('l’esperluette d’abord', ecEsc('&lt;'), '&amp;lt;');
  check('null ne casse rien', ecEsc(null), '');

  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST INTERROMPU :', e.message); process.exit(1); });
