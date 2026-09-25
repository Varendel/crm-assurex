// SAUVEGARDE COMPLÈTE DU CRM — base de données + documents déposés.
//
// Pourquoi ce script existe (25.09.2026) : le projet Supabase est sur le plan **gratuit**. Le plan
// gratuit ne garantit AUCUNE sauvegarde récupérable, et un projet inactif y est mis en pause.
// Autrement dit : au 25.09.2026, 256 fiches clients, 370 contrats et 148 documents ne tiennent
// qu'à un seul exemplaire, chez un seul prestataire. Une erreur de manipulation, une suppression
// en cascade ou un compte fermé, et il n'y a rien à restaurer.
//
// Ce n'est pas qu'une question de prudence : les CGA Cyber d'AXA (éd. 06.2024) en font une
// OBLIGATION contractuelle — A11.2 : « une sauvegarde de toutes les données doit être effectuée au
// moins une fois par semaine », dont « au moins une sauvegarde hebdomadaire conservée séparément,
// hors du réseau ». L'exemption prévue pour le cloud ne vaut que si le fournisseur « s'engage par
// contrat à effectuer la sauvegarde » — ce que le plan gratuit ne fait pas. Et A11.4 : si la
// dernière sauvegarde remonte à plus d'une semaine, l'indemnité est réduite à ce qu'elle aurait
// coûté si la sauvegarde avait été faite ; sans sauvegarde exploitable, AXA ne paie que les frais
// engagés pour constater qu'il n'y en a pas.
//
// Usage :
//   node outils/sauvegarde.js <jeton> [dossier de destination]
//
// Le jeton se récupère dans la console du CRM ouvert :  copy(supaSession.access_token)
// Il vaut une heure, n'est jamais écrit sur le disque, et le script ne le garde pas.
//
// Sans dossier indiqué, la sauvegarde va dans OneDrive - COFIDEX SA\Sauvegardes REX CRM.
// Le script REFUSE d'écrire dans le dépôt Git : il est public, les données ne s'y approchent pas.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const js01 = fs.readFileSync(path.join(ROOT, 'js/01-prevoyance-immo.js'), 'utf8');
const URL = js01.match(/const SUPABASE_URL = '([^']+)'/)[1];
const KEY = js01.match(/const SUPABASE_KEY = '([^']+)'/)[1];

const JETON = process.argv[2];
if (!JETON || JETON.startsWith('-')) {
  console.error('Usage : node outils/sauvegarde.js <jeton> [dossier]');
  console.error('Jeton : dans la console du CRM ouvert, copy(supaSession.access_token)');
  process.exit(2);
}

const DEFAUT = path.join(process.env.USERPROFILE || '', 'OneDrive - COFIDEX SA', 'Sauvegardes REX CRM');
const DEST = path.resolve(process.argv[3] || DEFAUT);
// Le dépôt est public. Une sauvegarde qui y atterrirait publierait le fichier clients entier.
if (!path.relative(ROOT, DEST).startsWith('..')) {
  console.error(`Refus : ${DEST} est dans le dépôt Git, qui est public. Choisis un dossier en dehors.`);
  process.exit(2);
}

const H = { apikey: KEY, Authorization: `Bearer ${JETON}` };
const PAGE = 1000;

// La liste des tables vient du serveur lui-même (description OpenAPI de PostgREST) : une table
// ajoutée demain sera sauvegardée sans que personne n'ait à y penser. Une liste écrite à la main
// finit toujours par oublier la table créée le mois dernier.
async function listerTables() {
  const r = await fetch(`${URL}/rest/v1/`, { headers: H });
  if (!r.ok) throw new Error(`Liste des tables : ${r.status} — jeton expiré ?`);
  const spec = await r.json();
  return Object.keys(spec.definitions || spec.components?.schemas || {}).sort();
}

// Pagination : au-delà de 1 000 lignes PostgREST coupe en silence. Une sauvegarde tronquée est
// pire qu'une absence de sauvegarde — on croit l'avoir.
async function lireTable(nom) {
  const lignes = [];
  for (let debut = 0; ; debut += PAGE) {
    const r = await fetch(`${URL}/rest/v1/${nom}?select=*&limit=${PAGE}&offset=${debut}`, { headers: H });
    if (!r.ok) { const t = await r.text(); throw new Error(`${nom} : ${r.status} ${t.slice(0, 140)}`); }
    const page = await r.json();
    lignes.push(...page);
    if (page.length < PAGE) break;
  }
  return lignes;
}

async function listerFichiers(bucket, prefixe = '', sortie = []) {
  const r = await fetch(`${URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: prefixe, limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!r.ok) throw new Error(`Stockage ${bucket} : ${r.status}`);
  for (const o of await r.json()) {
    const chemin = prefixe ? `${prefixe}/${o.name}` : o.name;
    // Un dossier n'a pas d'identifiant : on descend dedans.
    if (o.id === null) await listerFichiers(bucket, chemin, sortie);
    else sortie.push({ chemin, taille: Number(o.metadata?.size || 0) });
  }
  return sortie;
}

(async () => {
  const horodatage = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const dossier = path.join(DEST, horodatage);
  fs.mkdirSync(path.join(dossier, 'tables'), { recursive: true });

  console.log(`Sauvegarde vers ${dossier}\n`);

  // ── Les tables ───────────────────────────────────────────────────────────────────────────────
  const tables = await listerTables();
  const manifeste = { date: new Date().toISOString(), base: URL, tables: {}, fichiers: [], avertissements: [] };
  let totalLignes = 0;
  for (const t of tables) {
    try {
      const lignes = await lireTable(t);
      fs.writeFileSync(path.join(dossier, 'tables', `${t}.json`), JSON.stringify(lignes, null, 1), 'utf8');
      manifeste.tables[t] = lignes.length;
      totalLignes += lignes.length;
      console.log(`  ${String(lignes.length).padStart(6)}  ${t}`);
    } catch (e) {
      // Une table illisible ne doit pas emporter toute la sauvegarde — mais elle doit se voir.
      manifeste.avertissements.push(`${t} : ${e.message}`);
      console.log(`       !  ${t} — ${e.message}`);
    }
  }

  // ── Les documents ────────────────────────────────────────────────────────────────────────────
  // Les polices, mandats signés et offres ne sont pas dans la base : ils pèsent l'essentiel du
  // volume, et ce sont eux qu'un client redemande.
  let octets = 0;
  try {
    const fichiers = await listerFichiers('documents');
    for (const f of fichiers) {
      const r = await fetch(`${URL}/storage/v1/object/documents/${f.chemin.split('/').map(encodeURIComponent).join('/')}`, { headers: H });
      if (!r.ok) { manifeste.avertissements.push(`fichier ${f.chemin} : ${r.status}`); continue; }
      const cible = path.join(dossier, 'documents', f.chemin);
      fs.mkdirSync(path.dirname(cible), { recursive: true });
      const donnees = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(cible, donnees);
      octets += donnees.length;
      manifeste.fichiers.push({ chemin: f.chemin, octets: donnees.length });
    }
    console.log(`\n  ${manifeste.fichiers.length} document(s), ${(octets / 1048576).toFixed(1)} Mo`);
  } catch (e) {
    manifeste.avertissements.push(`stockage : ${e.message}`);
    console.log(`\n  ! documents non sauvegardés — ${e.message}`);
  }

  // ── Le contrôle qui rend la sauvegarde crédible ──────────────────────────────────────────────
  // Une sauvegarde qu'on ne compare à rien finit par être une sauvegarde vide qu'on archive
  // consciencieusement chaque semaine. On compare donc à la précédente.
  const precedentes = fs.existsSync(DEST)
    ? fs.readdirSync(DEST).filter(d => d !== horodatage && fs.existsSync(path.join(DEST, d, 'MANIFESTE.json'))).sort()
    : [];
  if (precedentes.length) {
    const avant = JSON.parse(fs.readFileSync(path.join(DEST, precedentes[precedentes.length - 1], 'MANIFESTE.json'), 'utf8'));
    for (const [t, n] of Object.entries(avant.tables || {})) {
      const maintenant = manifeste.tables[t];
      if (maintenant === undefined) manifeste.avertissements.push(`${t} : absente cette fois (${n} lignes la dernière fois)`);
      else if (n > 0 && maintenant < n * 0.9) manifeste.avertissements.push(`${t} : ${maintenant} lignes contre ${n} la dernière fois — vérifier avant d'écraser la précédente`);
    }
  }

  fs.writeFileSync(path.join(dossier, 'MANIFESTE.json'), JSON.stringify(manifeste, null, 2), 'utf8');
  fs.writeFileSync(path.join(dossier, 'LISEZ-MOI.txt'),
    [`Sauvegarde REX CRM du ${new Date().toLocaleString('fr-CH')}`,
      '',
      `${Object.keys(manifeste.tables).length} tables, ${totalLignes} lignes, ${manifeste.fichiers.length} documents (${(octets / 1048576).toFixed(1)} Mo).`,
      '',
      'CONTENU',
      '  tables/<nom>.json  une table, telle qu elle etait, toutes colonnes comprises.',
      '  documents/...      les fichiers du stockage, dans leur arborescence d origine.',
      '  MANIFESTE.json     le compte de chaque table, et les avertissements eventuels.',
      '',
      'DONNEES PERSONNELLES — ce dossier contient des donnees de clients identifies (etat de sante,',
      'situation financiere, documents d identite). Il ne se depose ni dans un depot Git, ni dans une',
      'boite mail, ni sur une cle USB non chiffree. Conservation : voir la politique de',
      'confidentialite (documents/POLITIQUE-CONFIDENTIALITE.md).',
      '',
      'RESTAURATION',
      '  Une table se reinjecte telle quelle :',
      '    POST {URL}/rest/v1/<table>  (en-tete Prefer: resolution=merge-duplicates)',
      '  Les documents se redeposent dans le bucket "documents" au meme chemin.',
      '  Restaurer d abord les tables sans dependance (clients, agents, compagnies_contacts),',
      '  puis celles qui les referencent (contrats, commissions, opportunites).',
      '',
      'CE QUI N EST PAS LA-DEDANS',
      '  Les comptes et mots de passe (schema auth) : ils appartiennent a Supabase. Apres une',
      '  restauration dans un nouveau projet, les acces clients sont a recreer depuis le CRM.',
    ].join('\n'), 'utf8');

  console.log(`\n✓ ${Object.keys(manifeste.tables).length} tables, ${totalLignes} lignes`);
  if (manifeste.avertissements.length) {
    console.log(`\n⚠ ${manifeste.avertissements.length} avertissement(s) :`);
    manifeste.avertissements.forEach(a => console.log(`   - ${a}`));
    process.exit(1);
  }
})().catch(e => { console.error('Sauvegarde interrompue : ' + e.message); process.exit(1); });
