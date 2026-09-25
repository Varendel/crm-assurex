// AUDIT — recalcule chaque estimation de commission avec les règles codées dans le CRM et la
// compare au montant_estime enregistré en base. Demandé par Jonathan le 25.09.2026 :
// « vérifie que les règles de calcul soient justes, les estimations justes ».
//
// Ce n'est PAS un test (il interroge la base en ligne, il n'a donc pas sa place dans la CI —
// le nom ne finit d'ailleurs pas par .test.js, le workflow ne le ramasse donc pas).
//
// IL FAUT UN JETON DE SESSION. La clé publique du CRM ne donne rien : les règles RLS bloquent
// la lecture anonyme de commissions_attente et de contrats — ce qui est le comportement voulu,
// et vérifié le 25.09.2026. Récupère le jeton depuis le CRM ouvert, console du navigateur :
//     copy(supaSession.access_token)
// puis :
//     node test/audit-estimations.js <jeton>
// Le jeton expire en une heure ; il n'est ni enregistré ni écrit nulle part par ce script.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const js01 = fs.readFileSync(path.join(ROOT, 'js/01-prevoyance-immo.js'), 'utf8');
const URL = js01.match(/const SUPABASE_URL = '([^']+)'/)[1];
const KEY = js01.match(/const SUPABASE_KEY = '([^']+)'/)[1];

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only' });
const { window } = dom;
global.window = window; global.document = window.document;
window.localStorage = { getItem: () => null, setItem: () => {} };
window.allCompagniesContacts = []; window.allClients = []; window.allContrats = [];

window.eval(['js/01-prevoyance-immo.js', 'js/02-catalogue-session.js', 'js/07-fichepaie-bordereaux.js', 'js/09-rappels-vehicules.js']
  .map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n;\n'));

const JETON = process.argv[2];
if (!JETON) {
  console.error('Jeton de session manquant. Dans la console du CRM ouvert : copy(supaSession.access_token)');
  console.error('puis : node test/audit-estimations.js <jeton>');
  process.exit(2);
}

async function table(nom, params) {
  const r = await fetch(`${URL}/rest/v1/${nom}?${params}`, { headers: { apikey: KEY, Authorization: `Bearer ${JETON}` } });
  if (!r.ok) throw new Error(`${nom} : ${r.status} ${(await r.text()).slice(0, 120)}`);
  const d = await r.json();
  // Zéro ligne sur une table qui en contient : le jeton est expiré ou sans droits. Mieux vaut
  // s'arrêter que de conclure « tout est conforme » sur un tableau vide.
  if (!d.length) throw new Error(`${nom} : aucune ligne lue — jeton expiré ou sans droits ?`);
  return d;
}

const nb = v => Math.round(Number(v || 0) * 100) / 100;
const chf = v => nb(v).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  const [commissions, contrats] = await Promise.all([
    table('commissions_attente', 'select=id,compagnie,produit,montant_estime,montant_final,statut,nature,contrat_id,client_nom&limit=2000'),
    table('contrats', 'select=id,produit,compagnie,prime_annuelle,periodicite,paiement_prime&limit=2000'),
  ]);
  const parId = new Map(contrats.map(c => [c.id, c]));

  // Label de produit -> id du catalogue : ct-produit porte le LABEL, pas l'id.
  const idParLabel = new Map();
  for (const [, liste] of Object.entries(window.CATALOGUE_PRODUITS || {})) {
    for (const p of liste) idParLabel.set(p.label.toLowerCase(), p.id);
  }

  let identiques = 0; const ecarts = [], sansRegle = [], horsCatalogue = [], sansContrat = [];
  for (const ca of commissions) {
    if (!['versé_oz', 'reçue', 'en_attente'].includes(ca.statut)) continue;
    const ct = parId.get(ca.contrat_id);
    if (!ct || !(Number(ct.prime_annuelle) > 0)) { sansContrat.push(ca); continue; }
    const id = idParLabel.get(String(ct.produit || '').toLowerCase());
    if (!id) { horsCatalogue.push({ ...ca, prod: ct.produit }); continue; }
    let r = null;
    try { r = window.estimerCommissionProduit(id, ca.compagnie || ct.compagnie, Number(ct.prime_annuelle), 1); } catch (e) { r = null; }
    const calcule = nb(r && r.montant);
    if (!calcule) { sansRegle.push({ cie: ca.compagnie || ct.compagnie, prod: ct.produit }); continue; }
    const enregistre = nb(ca.montant_estime);
    if (Math.abs(calcule - enregistre) < 0.02) { identiques++; continue; }
    ecarts.push({ cie: ca.compagnie || ct.compagnie, prod: ct.produit, client: ca.client_nom,
      prime: nb(ct.prime_annuelle), enregistre, calcule, ecart: nb(calcule - enregistre) });
  }

  const retenues = identiques + ecarts.length;
  console.log(`\nESTIMATIONS — ${retenues} lignes recalculables`);
  console.log(`  ${identiques} conformes aux règles codées`);
  console.log(`  ${ecarts.length} en écart`);
  console.log(`  ${sansRegle.length} sans taux applicable · ${horsCatalogue.length} produit hors catalogue · ${sansContrat.length} sans contrat chiffré`);

  if (ecarts.length) {
    const parCie = {};
    for (const e of ecarts) (parCie[e.cie] = parCie[e.cie] || []).push(e);
    console.log(`\n  Écarts par compagnie (montant enregistré → recalcul) :`);
    for (const cie of Object.keys(parCie).sort()) {
      const l = parCie[cie].sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));
      const somme = nb(l.reduce((s, e) => s + e.ecart, 0));
      console.log(`  ── ${cie} : ${l.length} ligne(s), effet net ${somme > 0 ? '+' : ''}${chf(somme)}`);
      for (const e of l.slice(0, 5)) {
        console.log(`     ${String(e.prod).slice(0, 44).padEnd(44)} prime ${chf(e.prime).padStart(11)} | ${chf(e.enregistre).padStart(10)} → ${chf(e.calcule).padStart(10)}`);
      }
    }
  }
  if (sansRegle.length) {
    const g = {};
    for (const s of sansRegle) { const k = `${s.cie} · ${s.prod}`; g[k] = (g[k] || 0) + 1; }
    console.log(`\n  Aucun taux codé pour :`);
    for (const k of Object.keys(g).sort()) console.log(`     ${String(g[k]).padStart(3)}× ${k}`);
  }
  if (horsCatalogue.length) {
    const g = {};
    for (const s of horsCatalogue) g[s.prod] = (g[s.prod] || 0) + 1;
    console.log(`\n  Produits absents du catalogue :`);
    for (const k of Object.keys(g).sort()) console.log(`     ${String(g[k]).padStart(3)}× ${k}`);
  }

  // ── Encaissé documenté vs estimé, la question d'origine ──────────────────────────────────────
  const verses = commissions.filter(c => c.statut === 'versé_oz');
  const reels = verses.filter(c => c.montant_final != null);
  const somme = l => nb(l.reduce((s, c) => s + Number(c.montant_final != null ? c.montant_final : c.montant_estime || 0), 0));
  console.log(`\nENCAISSEMENTS — ${verses.length} lignes « versé_oz »`);
  console.log(`  ${reels.length} avec un montant réel : CHF ${chf(reels.reduce((s, c) => s + Number(c.montant_final), 0))}`);
  console.log(`  ${verses.length - reels.length} encore sur estimation : CHF ${chf(somme(verses.filter(c => c.montant_final == null)))}`);
})().catch(e => { console.error('AUDIT INTERROMPU :', e.message); process.exit(1); });
