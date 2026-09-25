// ═══ IMPORT DES ARCHIVES DE DÉCOMPTES (25.09.2026) ═════════════════════════════════════════════
// « L'import des archives OZ » — le point 5 de la liste des demandes non exécutées.
//
// L'état au 25.09.2026 : 63 bordereaux en base, dont 10 seulement avec un fichier joint, et rien
// avant novembre 2025. Sur le disque, le dossier « OZ Assure / Décomptes commissions » contient
// près de quatre-vingt-dix décomptes, dont toute l'année 2024 et la plus grande partie de 2025,
// que le CRM ignore. Un décompte qu'on ne peut pas rouvrir, c'est un chiffre qu'il faut croire
// sur parole : c'est exactement ce qui a rendu l'affaire AGV impossible à trancher.
//
// Ce module lit un dossier d'archives d'un coup, reconnaît la compagnie et la période dans le nom
// du fichier ET dans les dossiers qui le contiennent, puis propose pour chaque fichier :
//   - JOINDRE   le fichier à un bordereau déjà en base qui n'en a pas
//   - CRÉER     le bordereau manquant, fichier joint, montant à confirmer
//   - DÉJÀ FAIT rien à faire, le bordereau a déjà ce fichier
//
// La reconnaissance se trompera : les noms sont écrits à la main depuis deux ans (« BRD61 janvier
// 20026 Helsana », « Groupemutuel déocmpte 21.03.2025 »). Compagnie, mois et année restent donc
// MODIFIABLES sur chaque ligne avant confirmation — c'est la seule façon honnête de traiter un
// fonds d'archives, et cela évite de créer des bordereaux fantômes.
//
// Le montant n'est jamais deviné : un bordereau créé ici vaut 0.— jusqu'à ce qu'il soit saisi ou
// lu. Mieux vaut un bordereau à confirmer qu'un montant inventé.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Le bouton disparaît de la vue Bordereaux.

const IDC_EXTENSIONS = /\.(pdf|xlsx?|csv|png|jpe?g)$/i;
const IDC_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
// Deux ans de noms écrits à la main : « Groupemutuel », « GM », « BRD SL », « Moblière »…
const IDC_COMPAGNIES = [
  [/groupe\s*mutuel|groupemutuel|\bgma?\b/i, 'Groupe Mutuel'],
  [/vaudoise/i, 'La Vaudoise'],
  [/mobili[eè]re|moblière|mobiliere/i, 'La Mobilière'],
  [/helsana/i, 'Helsana'],
  [/\bcss\b/i, 'CSS'],
  [/swica/i, 'SWICA'],
  [/allianz/i, 'Allianz'],
  [/b[âa]loise|baloise/i, 'Bâloise'],
  [/\baxa\b/i, 'AXA'],
  [/swiss\s*life|\bbrd\s*sl\b|\bsl\s*\d/i, 'Swiss Life'],
  [/orion/i, 'Orion'],
  [/\bnest\b/i, 'Nest'],
  [/generali/i, 'Generali'],
  [/zurich/i, 'Zurich'],
  [/helvetia/i, 'Helvetia'],
  [/visana/i, 'Visana'],
  [/sanitas/i, 'Sanitas'],
  [/\bcap\b/i, 'CAP'],
];

window._idc = window._idc || { lignes: [], nomDossier: '' };

function idcEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function idcSansAccents(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

function idcCompagnie(chemin) {
  for (const [re, nom] of IDC_COMPAGNIES) if (re.test(chemin)) return nom;
  return '';
}

// Année sur deux ou quatre chiffres, avec la tolérance qu'imposent les archives : « 20026 » pour
// 2026, « 25 » pour 2025. On refuse tout ce qui sort de la plage plausible plutôt que de deviner.
function idcAnnee(brut) {
  let n = parseInt(String(brut).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n)) return 0;
  if (n > 9999) n = Number(String(n).slice(-4));       // « 20026 » → 0026, corrigé juste après
  if (n < 100) n += 2000;                              // « 25 » → 2025
  if (n < 1000) n += 2000;                             // « 0026 » → 2026
  return (n >= 2015 && n <= 2100) ? n : 0;
}

// La période, cherchée du plus précis au plus vague. Le chemin COMPLET est examiné : l'arborescence
// « 2026 / 04 Avril / BRD69 04.26 AXA.pdf » porte la réponse dans les dossiers, pas dans le nom.
function idcPeriode(chemin) {
  const t = idcSansAccents(chemin);

  // 1. Une plage « 01.04-30.04.2026 » ou « 01.06-30.06.26 » : c'est la fin qui date le décompte.
  let m = t.match(/\b\d{1,2}[.\-\/]\d{1,2}[.\-\/]?\d{0,4}\s*[-–]\s*\d{1,2}[.\-\/](\d{1,2})[.\-\/](\d{2,5})\b/);
  if (m) { const a = idcAnnee(m[2]); if (a) return { mois: Number(m[1]), annee: a }; }

  // 2. Une date ISO complète, comme dans les exports Vaudoise « ..._2026-06-29_FR_... ».
  //    Pas de \b ici : le souligné est un caractère de mot, si bien que « _2026-06-29_ » n'avait
  //    aucune frontière devant lui et n'était pas reconnu. On encadre par « pas un chiffre ».
  m = t.match(/(?:^|[^0-9])(20\d{2})-(\d{2})-(\d{2})(?:[^0-9]|$)/);
  if (m) return { mois: Number(m[2]), annee: Number(m[1]) };

  // 3. Une date suisse « 17.12.2024 ».
  m = t.match(/\b(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,5})\b/);
  if (m) { const a = idcAnnee(m[3]); if (a && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { mois: Number(m[2]), annee: a }; }

  // 4. Un mois nommé, avec l'année quelque part autour — « BRD61 janvier 20026 Helsana ».
  for (let i = 0; i < 12; i++) {
    const nom = idcSansAccents(IDC_MOIS[i]);
    if (!new RegExp(`\\b${nom}\\b`).test(t)) continue;
    const an = t.match(/\b(20\d{2,3})\b/) || t.match(/\b(2\d{4})\b/);
    const a = an ? idcAnnee(an[1]) : 0;
    if (a) return { mois: i + 1, annee: a };
  }

  // 5. « 04.26 », « 07.2026 » : mois et année collés, sans jour.
  m = t.match(/\b(\d{1,2})[.\-](\d{2,4})\b/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) { const a = idcAnnee(m[2]); if (a) return { mois: Number(m[1]), annee: a }; }

  return { mois: 0, annee: 0 };
}

// Le numéro de bordereau écrit par Jonathan : « BRD 56 », « BRD69 », « BRD 013 ».
function idcNumeroBrd(chemin) {
  const m = String(chemin).match(/\bbrd\s*0*(\d{1,3})\b/i);
  return m ? Number(m[1]) : 0;
}

function idcLibelleMois(l) { return l.mois && l.annee ? `${IDC_MOIS[l.mois - 1]} ${l.annee}` : ''; }

// À quel bordereau existant ce fichier se rattache-t-il ? Le numéro BRD prime — c'est la référence
// que Jonathan utilise — puis la paire compagnie + mois.
function idcRapprocher(l, bordereaux) {
  if (!l.compagnie) return null;
  if (l.brd) {
    const parNum = bordereaux.find(b => b.compagnie === l.compagnie && idcNumeroBrd(b.numero) === l.brd);
    if (parNum) return parNum;
  }
  const libelle = idcLibelleMois(l);
  if (!libelle) return null;
  // Entre deux bordereaux du même mois, on vise celui qui n'a pas encore de fichier.
  const memeMois = bordereaux.filter(b => b.compagnie === l.compagnie && b.mois === libelle);
  return memeMois.find(b => !b.pdf_url) || memeMois[0] || null;
}

async function idcOuvrir() {
  document.getElementById('idc-modale')?.remove();
  const m = document.createElement('div');
  m.id = 'idc-modale'; m.className = 'imp-voile';
  m.innerHTML = `<div class="imp-boite" role="dialog" aria-modal="true" aria-labelledby="idc-titre">
    <header class="imp-tete"><h2 id="idc-titre">Importer un dossier d’archives de décomptes</h2>
      <button type="button" class="imp-x" onclick="document.getElementById('idc-modale').remove()" aria-label="Fermer">×</button></header>
    <div class="imp-corps" id="idc-corps">
      <p>Choisis le dossier qui contient les décomptes — par exemple <b>Décomptes commissions</b> du site OZ Assure, années comprises.
      Rien n’est envoyé avant ta confirmation, et le montant d’un bordereau créé ici reste à saisir.</p>
      <div class="imp-choix">
        <label class="btn-save imp-dossier">📁 Choisir le dossier…<input type="file" webkitdirectory directory multiple hidden onchange="idcAnalyser(this.files)"/></label>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
}

async function idcAnalyser(files) {
  const corps = document.getElementById('idc-corps');
  if (corps) corps.innerHTML = '<p>Lecture du dossier…</p>';
  const bordereaux = (typeof allBordereaux !== 'undefined' && Array.isArray(allBordereaux)) ? allBordereaux : (await dbGet('bordereaux', 'select=*') || []);

  const lignes = [];
  for (const f of files) {
    if (!IDC_EXTENSIONS.test(f.name) || /^\._/.test(f.name)) continue;
    const chemin = f.webkitRelativePath || f.name;
    // Les factures émises et les relevés de compte courant ne sont pas des décomptes de commissions.
    if (/facture|compte_courant|quittance/i.test(chemin)) continue;
    const p = idcPeriode(chemin);
    const l = {
      fichier: f, chemin,
      compagnie: idcCompagnie(chemin),
      mois: p.mois, annee: p.annee,
      brd: idcNumeroBrd(chemin),
    };
    l.cible = idcRapprocher(l, bordereaux);
    l.action = !l.compagnie || !l.mois ? 'incomplet'
      : (l.cible ? (l.cible.pdf_url ? 'deja' : 'joindre') : 'creer');
    l.coche = l.action === 'joindre' || l.action === 'creer';
    lignes.push(l);
  }
  lignes.sort((a, b) => (b.annee - a.annee) || (b.mois - a.mois) || a.chemin.localeCompare(b.chemin, 'fr'));
  window._idc = { lignes, bordereaux, nomDossier: (files[0] && (files[0].webkitRelativePath || '').split('/')[0]) || '' };
  idcRendre();
}

function idcRendre() {
  const corps = document.getElementById('idc-corps');
  if (!corps) return;
  const L = window._idc.lignes;
  if (!L.length) { corps.innerHTML = '<p>Aucun décompte reconnu dans ce dossier.</p>'; return; }
  const n = a => L.filter(l => l.action === a).length;
  const coches = L.filter(l => l.coche).length;

  const optionsMois = i => IDC_MOIS.map((nom, k) => `<option value="${k + 1}" ${k + 1 === i ? 'selected' : ''}>${nom}</option>`).join('');
  const compagnies = [...new Set([...IDC_COMPAGNIES.map(c => c[1]), ...window._idc.bordereaux.map(b => b.compagnie).filter(Boolean)])].sort();

  corps.innerHTML = `
    <p><b>${L.length}</b> décompte(s) lu(s) dans <b>${idcEsc(window._idc.nomDossier)}</b> —
      ${n('creer')} à créer · ${n('joindre')} à joindre à un bordereau existant · ${n('deja')} déjà présent(s) · ${n('incomplet')} à compléter à la main.</p>
    <table class="idc-table">
      <thead><tr><th></th><th>Fichier</th><th>Compagnie</th><th>Période</th><th>Ce qui sera fait</th></tr></thead>
      <tbody>${L.map((l, i) => `<tr class="${l.action === 'deja' ? 'idc-deja' : ''}">
        <td><input type="checkbox" ${l.coche ? 'checked' : ''} ${l.action === 'deja' ? 'disabled' : ''} onchange="window._idc.lignes[${i}].coche=this.checked; idcMajCompteur()"/></td>
        <td class="idc-nom" title="${idcEsc(l.chemin)}">${idcEsc(l.fichier.name)}</td>
        <td><select onchange="idcModifier(${i}, 'compagnie', this.value)">
          <option value="">— à choisir —</option>
          ${compagnies.map(c => `<option value="${idcEsc(c)}" ${c === l.compagnie ? 'selected' : ''}>${idcEsc(c)}</option>`).join('')}
        </select></td>
        <td class="idc-periode">
          <select onchange="idcModifier(${i}, 'mois', this.value)"><option value="0">— mois —</option>${optionsMois(l.mois)}</select>
          <input type="number" min="2015" max="2100" step="1" value="${l.annee || ''}" placeholder="année" onchange="idcModifier(${i}, 'annee', this.value)"/>
        </td>
        <td class="idc-action idc-${l.action}">${idcTexteAction(l)}</td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="opx-modale-actions mdx-actions">
      <button type="button" class="btn-secondary" onclick="document.getElementById('idc-modale').remove()">Fermer</button>
      <button type="button" class="btn-save" id="idc-confirmer" onclick="idcConfirmer()" ${coches ? '' : 'disabled'}>Importer <span id="idc-compteur">${coches}</span> décompte(s)</button>
    </div>`;
}

function idcTexteAction(l) {
  if (l.action === 'incomplet') return 'Compagnie ou période à préciser';
  if (l.action === 'deja') return `Déjà joint à ${idcEsc(l.cible.numero || 'ce bordereau')}`;
  if (l.action === 'joindre') return `Joindre à ${idcEsc(l.cible.numero || idcLibelleMois(l))}`;
  return `Créer le bordereau ${idcEsc(idcLibelleMois(l))} — montant à saisir`;
}

function idcModifier(i, champ, valeur) {
  const l = window._idc.lignes[i];
  if (!l) return;
  l[champ] = (champ === 'compagnie') ? valeur : Number(valeur) || 0;
  l.cible = idcRapprocher(l, window._idc.bordereaux);
  l.action = !l.compagnie || !l.mois || !l.annee ? 'incomplet'
    : (l.cible ? (l.cible.pdf_url ? 'deja' : 'joindre') : 'creer');
  if (l.action === 'incomplet' || l.action === 'deja') l.coche = false;
  idcRendre();
}

function idcMajCompteur() {
  const n = window._idc.lignes.filter(l => l.coche).length;
  const c = document.getElementById('idc-compteur');
  if (c) c.textContent = n;
  const b = document.getElementById('idc-confirmer');
  if (b) b.disabled = !n;
}

async function idcConfirmer() {
  const b = document.getElementById('idc-confirmer');
  if (b && b.disabled) return;
  if (b) { b.disabled = true; b.textContent = 'Import…'; }
  const aFaire = window._idc.lignes.filter(l => l.coche && l.action !== 'deja' && l.action !== 'incomplet');
  let joints = 0, crees = 0;
  const echecs = [];

  for (const l of aFaire) {
    try {
      let cible = l.cible;
      if (!cible) {
        // Le montant n'est jamais deviné : le bordereau naît à 0.— et attend sa saisie.
        const r = await dbPost('bordereaux', {
          compagnie: l.compagnie,
          mois: idcLibelleMois(l),
          montant_brut: 0,
          statut: 'reçu',
          date_reception: new Date(l.fichier.lastModified || Date.now()).toISOString().slice(0, 10),
          numero: `${l.brd ? 'BRD ' + String(l.brd).padStart(3, '0') : 'ARCH'} - ${idcLibelleMois(l)} - ${l.compagnie} (archive importée)`,
        });
        if (r && r.error) throw new Error(errMsg(r));
        cible = Array.isArray(r) ? r[0] : r;
        if (!cible || !cible.id) throw new Error('bordereau créé sans identifiant');
        window._idc.bordereaux.push(cible);
        crees++;
      } else {
        joints++;
      }
      const ok = await archiverFichierBordereau(cible, l.fichier);
      if (!ok) throw new Error('fichier non archivé');
      l.action = 'deja'; l.coche = false; l.cible = { ...cible, pdf_url: 'oui', numero: cible.numero };
    } catch (e) {
      echecs.push(`${l.fichier.name} : ${String(e.message || e).slice(0, 60)}`);
    }
  }

  if (typeof logAction === 'function') logAction('import_decomptes', 'bordereaux', null, `${crees} créé(s), ${joints} joint(s)`);
  if (typeof dbGet === 'function') { try { allBordereaux = await dbGet('bordereaux', 'select=*'); } catch (e) { /* la vue se rafraîchira au prochain passage */ } }
  idcRendre();
  showError(echecs.length
    ? `⚠️ ${crees} bordereau(x) créé(s), ${joints} fichier(s) joint(s) — ${echecs.length} échec(s) : ${echecs.join(' ; ')}`
    : `✓ ${crees} bordereau(x) créé(s) et ${joints} fichier(s) joint(s). Les montants des bordereaux créés restent à saisir.`);
}

// ── Le bouton, dans la vue Bordereaux ──────────────────────────────────────────────────────────
(function idcBrancher() {
  if (typeof viewBordereaux !== 'function') return;
  const origine = viewBordereaux;
  window.viewBordereaux = function () {
    const h = origine.apply(this, arguments);
    const ancre = `<button class="btn-add" onclick="navigate('import-decompte')">`;
    if (h.indexOf(ancre) < 0) {
      console.warn('[idc] Bouton « Importer les archives » non greffé : ancre absente de la vue Bordereaux.');
      return h;
    }
    return h.replace(ancre, `<button class="btn-secondary" onclick="idcOuvrir()" title="Importer un dossier entier de décomptes archivés (PDF, Excel)">📁 Importer les archives</button>${ancre}`);
  };
})();

(function idcStyles() {
  if (document.getElementById('idc-styles')) return;
  const s = document.createElement('style');
  s.id = 'idc-styles';
  s.textContent = `
    .idc-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    .idc-table th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .5px;
      color: var(--text-muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
    .idc-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .idc-table tr.idc-deja { opacity: .5; }
    .idc-nom { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .idc-table select, .idc-table input[type="number"] { font: inherit; padding: 3px 6px; border-radius: 6px;
      border: 1px solid var(--border); background: var(--surface); color: var(--text); max-width: 130px; }
    .idc-periode { display: flex; gap: 4px; }
    .idc-periode input { max-width: 70px; }
    .idc-action { font-weight: 600; }
    .idc-creer { color: var(--accent); }
    .idc-joindre { color: var(--c-succes-texte, #16A34A); }
    .idc-incomplet { color: var(--c-alerte-texte, #D97706); }
    .idc-deja .idc-action { color: var(--text-muted); font-weight: 500; }
  `;
  document.head.appendChild(s);
})();
