// ═══ OFFRES : LE TYPE REPÉRÉ À L'IMPORT, ET L'ARBORESCENCE DEMANDÉES / REÇUES (22.09.2026) ══════
// « Si à l'import des offres le système pouvait repérer le type d'offre et le classer, ce serait
// top : comme ça on peut mettre une arborescence des offres demandées et de celles reçues. »
//
// 1. À chaque PDF d'offre joint (à la main, depuis Outlook, depuis la saisie), le type de couverture
//    est déduit du nom du fichier, de l'objet de l'e-mail et de la description : LAA, perte de gain,
//    LPP, RC entreprise, ménage, PJ, véhicule, LAMal, LCA… et enregistré sur l'offre (type_produit).
//    Une offre déjà présente sans type est classée à l'affichage par la même règle.
// 2. En tête des offres, un arbre par type : pour chaque couverture, les compagnies à qui l'offre a
//    été DEMANDÉE et celles qui ont RÉPONDU (prime). Un type mal deviné se corrige d'un clic ; le
//    choix est enregistré et l'emporte ensuite sur la détection.

// Ordre important : la règle la plus précise passe d'abord (LAAC avant LAA, PJ circulation avant PJ…).
const OTY_REGLES = [
  ['laac', /\blaac\b|\buvgz\b|compl[ée]mentaire\s+(?:laa|accidents?)|lAA\s*compl/i],
  ['laa', /\blaa\b|\buvg\b|assurance[- ]accidents?\s+obligatoire|accidents?\s+professionnels?/i],
  ['perte_gain_maladie_accident_lca', /\bijm\b|\bktg\b|perte\s+de\s+gain|indemnit[ée]s?\s+journali[èe]res?|krankentaggeld|taggeld/i],
  ['lpp_entreprise', /\blpp\b|\bbvg\b|2e\s*pilier|deuxi[èe]me\s+pilier|pr[ée]voyance\s+professionnelle|caisse\s+de\s+pension/i],
  ['pj_circulation', /protection\s+juridique\s+(?:de\s+)?circulation|verkehrsrechtsschutz|pj\s+circulation/i],
  ['pj_pro', /protection\s+juridique\s+(?:d.)?entreprise|pj\s+(?:pro|entreprise)|betriebsrechtschutz|orion\s+pro/i],
  ['pj_privee', /protection\s+juridique|rechtsschutz|\bpj\b/i],
  ['do_entreprise', /\bd\s*&\s*o\b|responsabilit[ée]\s+des\s+dirigeants/i],
  ['cyber_entreprise', /cyber/i],
  ['rc_entreprise', /rc\s+(?:entreprise|commerce|professionnelle|exploitation)|responsabilit[ée]\s+civile\s+(?:d.)?entreprise|betriebshaftpflicht|haftpflicht\s+betrieb/i],
  ['pertes_exploitation', /pertes?\s+d.exploitation|betriebsunterbruch/i],
  ['bris_machines', /bris\s+de\s+machines?|maschinen/i],
  ['choses_entreprise', /(?:assurance\s+)?choses?\s+(?:entreprise|commerciales?)|inventaire\s+commercial|sachversicherung|assurance\s+commerce|police\s+commerce/i],
  ['flotte_entreprise', /flotte/i],
  ['casco_complete', /casco\s+compl[èe]te|vollkasko/i],
  ['casco_partielle', /casco\s+partielle|teilkasko/i],
  ['vehicule_rc', /v[ée]hicule|auto(?:mobile)?\b|\bmoto\b|motorfahrzeug|\brc\s+v[ée]h/i],
  ['batiment_entreprise', /b[âa]timent\s+(?:commercial|professionnel)|locaux\s+professionnels/i],
  ['batiment_prive', /b[âa]timent|\beca\b|geb[äa]ude/i],
  ['menage', /m[ée]nage|inventaire|hausrat/i],
  ['rc_privee', /rc\s+priv[ée]e|responsabilit[ée]\s+civile\s+priv[ée]e|privathaftpflicht|\brc\b/i],
  ['lamal', /lamal|\bkvg\b|assurance\s+de\s+base|assurance[- ]maladie\s+obligatoire|grundversicherung/i],
  ['lca_autre_compagnie', /\blca\b|\bvvg\b|compl[ée]mentaire|hospitalisation|zusatzversicherung/i],
  ['vie_3a', /\b3a\b|pilier\s*3a|s[äa]ule\s*3a/i],
  ['vie_3b_mixte', /\b3b\b|assurance[- ]vie|mixte/i],
  ['caution_bail_commercial', /caution.*(?:commercial|entreprise)|garantie\s+de\s+loyer\s+commercial/i],
  ['caution_bail_prive', /caution\s+de\s+loyer|garantie\s+de\s+loyer|swisscaution|gocaution|firstcaution/i],
  ['voyage', /voyage|annulation|reise/i],
  ['animaux', /animaux|v[ée]t[ée]rinaire|chien|chat\b/i],
];

function otyDetecter(texte) {
  const t = String(texte || '');
  for (const [id, re] of OTY_REGLES) if (re.test(t)) return id;
  return null;
}
function otyLabel(id) {
  if (!id) return 'Non classées';
  if (typeof cpfLabel === 'function') return cpfLabel(id);
  for (const l of Object.values(typeof PRODUITS_OPPORTUNITE_GROUPES !== 'undefined' ? PRODUITS_OPPORTUNITE_GROUPES : {})) { const p = l.find(x => x.id === id); if (p) return p.label; }
  return id;
}
function otyEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Le type d'une offre : celui qu'on a choisi, sinon celui qu'on devine, sinon — si l'affaire ne vise
// qu'une couverture — celle-là.
function otyTypeEntree(e, o) {
  if (e && e.type_produit) return e.type_produit;
  const devine = otyDetecter(`${e && e.offre_nom || ''} ${e && e.couverture || ''} ${e && e.remarque || ''}`);
  if (devine) return devine;
  const vises = o && Array.isArray(o.produits) ? o.produits : [];
  return vises.length === 1 ? vises[0] : null;
}

// ── À l'import : le type est enregistré sur l'offre ─────────────────────────────────────────────
(function otyBrancherImport() {
  if (typeof uploadOffreCompagnie !== 'function') return;
  const origine = uploadOffreCompagnie;
  window.uploadOffreCompagnie = async function (demandeOffreId, idx, input) {
    const ok = await origine.apply(this, arguments);
    if (!ok) return ok;
    try {
      const rows = await dbGet('demandes_offre', `id=eq.${demandeOffreId}&select=id,opportunite_id,compagnies_envoi`);
      const d = Array.isArray(rows) && rows[0];
      const e = d && (d.compagnies_envoi || [])[idx];
      if (e && !e.type_produit) {
        const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === d.opportunite_id);
        const sujet = (window._oxoSujetImport || '');
        const type = otyDetecter(`${(input.files && input.files[0] && input.files[0].name) || e.offre_nom || ''} ${sujet} ${e.couverture || ''}`) || otyTypeEntree(e, o);
        if (type) {
          const entrees = d.compagnies_envoi.map((x, i) => i === idx ? { ...x, type_produit: type, type_auto: true } : x);
          await dbPatch('demandes_offre', d.id, { compagnies_envoi: entrees });
        }
      }
    } catch (e) { console.error('Type d’offre non enregistré', e); }
    window._oxoSujetImport = '';
    return ok;
  };
})();

// Corriger le type d'une offre (le choix manuel l'emporte ensuite sur la détection).
async function otyClasser(oppId, demandeId, idx, type) {
  const rows = await dbGet('demandes_offre', `id=eq.${demandeId}&select=id,compagnies_envoi`).catch(() => []);
  const d = Array.isArray(rows) && rows[0];
  if (!d || !(d.compagnies_envoi || [])[idx]) return;
  const entrees = d.compagnies_envoi.map((x, i) => i === idx ? { ...x, type_produit: type || null, type_auto: false } : x);
  const r = await dbPatch('demandes_offre', demandeId, { compagnies_envoi: entrees });
  if (r && r.error) { showError('Classement non enregistré : ' + errMsg(r)); return; }
  if (typeof opChargerDemandes === 'function') await opChargerDemandes(oppId);
  if (typeof opRafraichir === 'function') opRafraichir();
}

// ── L'arborescence ───────────────────────────────────────────────────────────────────────────────
function otyArbreHtml(oppId) {
  const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === oppId);
  const entrees = typeof opToutesEntrees === 'function' ? opToutesEntrees(oppId) : [];
  if (!entrees.length) return '';
  const groupes = new Map();
  (o && Array.isArray(o.produits) ? o.produits : []).forEach(id => groupes.set(id, []));   // les couvertures visées d'abord, même sans offre
  entrees.forEach(x => { const t = otyTypeEntree(x.e, o) || ''; if (!groupes.has(t)) groupes.set(t, []); groupes.get(t).push(x); });
  const recue = e => !!(e.recue_le || e.statut === 'reçue' || e.retenue);
  const choix = [...new Set([...(o && o.produits || []), ...OTY_REGLES.map(r => r[0])])];
  const selecteur = (x, t) => `<select class="oty-classer" title="Changer le type de cette offre" onchange="otyClasser('${oppId}','${x.d.id}',${x.idx},this.value)">
      <option value="">— Non classée —</option>${choix.map(id => `<option value="${id}" ${id === t ? 'selected' : ''}>${otyEsc(otyLabel(id))}</option>`).join('')}</select>`;
  return `<details class="oty-arbre" open>
    <summary>🗂️ Offres par type <small>${[...groupes.keys()].filter(Boolean).length} type(s)</small></summary>
    ${[...groupes.entries()].sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1)).map(([t, xs]) => {
      const dem = xs.filter(x => !recue(x.e) && x.e.statut !== 'déclinée'), rec = xs.filter(x => recue(x.e)), dec = xs.filter(x => x.e.statut === 'déclinée');
      return `<div class="oty-type ${t ? '' : 'sans'}">
        <div class="oty-tete"><b>${otyEsc(otyLabel(t))}</b><span>${xs.length ? `${xs.length} demandée${xs.length > 1 ? 's' : ''} · <em>${rec.length} reçue${rec.length > 1 ? 's' : ''}</em>` : 'aucune offre demandée'}</span></div>
        ${xs.length ? `<ul>
          ${rec.map(x => `<li class="rec"><span>📥 ${otyEsc(x.e.compagnie || '—')}${x.e.prime ? ` <b>CHF ${fmtCHF(x.e.prime)}</b>` : ''}${x.e.type_auto ? ' <small title="Type repéré automatiquement">auto</small>' : ''}</span>${selecteur(x, t)}</li>`).join('')}
          ${dem.map(x => `<li class="dem"><span>📤 ${otyEsc(x.e.compagnie || '—')} <small>en attente</small></span>${selecteur(x, t)}</li>`).join('')}
          ${dec.map(x => `<li class="dec"><span>🚫 ${otyEsc(x.e.compagnie || '—')} <small>déclinée</small></span>${selecteur(x, t)}</li>`).join('')}
        </ul>` : ''}
      </div>`;
    }).join('')}
  </details>`;
}

(function otyBrancherAffichage() {
  if (typeof htmlOffresOpportunite !== 'function') return;
  const rendu = htmlOffresOpportunite;
  window.htmlOffresOpportunite = function (oppId) {
    const h = rendu.apply(this, arguments);
    const arbre = otyArbreHtml(oppId);
    return arbre ? h.replace(/(<div class="opx-offres"[^>]*>)/, `${arbre}$1`) : h;
  };
  const st = document.createElement('style');
  st.textContent = `
    .oty-arbre { margin: 0 0 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-alt); padding: 8px 10px; }
    .oty-arbre > summary { cursor: pointer; font-weight: 600; font-size: var(--t-s); list-style: none; display: flex; gap: 8px; align-items: center; }
    .oty-arbre > summary::-webkit-details-marker { display: none; }
    .oty-arbre > summary small { font-weight: 500; color: var(--text-muted); font-size: var(--t-xs); }
    .oty-type { margin-top: 8px; padding-left: 10px; border-left: 2px solid color-mix(in srgb, var(--accent) 45%, var(--border)); }
    .oty-type.sans { border-left-color: var(--border); }
    .oty-tete { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; flex-wrap: wrap; }
    .oty-tete b { font-size: var(--t-s); }
    .oty-tete span { font-size: var(--t-xs); color: var(--text-muted); }
    .oty-tete em { font-style: normal; color: #16A34A; font-weight: 600; }
    .oty-type ul { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
    .oty-type li { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: var(--t-xs); padding: 3px 6px; border-radius: 7px; background: var(--surface); }
    .oty-type li.rec { border-left: 2px solid #16A34A; } .oty-type li.dem { border-left: 2px solid #38BDF8; } .oty-type li.dec { border-left: 2px solid #94A3B8; opacity: .75; }
    .oty-type li small { color: var(--text-muted); font-size: 10px; }
    .oty-classer { max-width: 140px; font: inherit; font-size: 10.5px; padding: 2px 4px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-alt); color: var(--text); }`;
  document.head.appendChild(st);
})();
