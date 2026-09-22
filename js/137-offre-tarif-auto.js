// ═══ OFFRE : LE TARIF RECONNU À L'UPLOAD (22.09.2026) ═══════════════════════════════════════════
// « Est-ce que le comparateur peut être automatique ? J'aimerais qu'à l'upload d'une offre, le
// tarif soit reconnu. »
//
// REX lit le PDF de l'offre avec la même lecture que l'import de police (clever-worker,
// action parse_police : compagnie, produit, prime annuelle ou mensuelle, date de début) :
//   · dans la fenêtre « Offre reçue » (js/25), dès que le PDF est choisi : la prime, la compagnie et
//     le produit se remplissent (champs vides uniquement) — tu vérifies avant d'enregistrer ;
//   · pour tout autre dépôt d'offre (📎 Joindre l'offre, import Outlook, fiche client) : après
//     l'archivage du PDF, si l'offre n'a pas encore de prime, elle est inscrite sur l'offre avec la
//     mention « lue par REX » (prime_auto), et une ligne s'ajoute au fil de l'affaire.
// Le comparateur (« Comparer », js/25) se sert de ces primes : il est donc à jour sans saisie.
// Une prime déjà saisie à la main n'est jamais remplacée.

const _ota = new WeakMap();   // fichier → promesse de lecture (une seule lecture par fichier)

function otaNombre(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : (typeof nombreCH === 'function' ? nombreCH(String(v)) : parseFloat(String(v).replace(/[' ’]/g, '').replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function otaLire(file) {
  if (!file || file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024 || typeof AI_FUNCTION_URL === 'undefined') return Promise.resolve(null);
  if (_ota.has(file)) return _ota.get(file);
  const p = (async () => {
    const base64 = await new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = ko; fr.readAsDataURL(file); });
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(AI_FUNCTION_URL, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parse_police', pdf_base64: base64 }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(d.error || 'lecture impossible');
    let prime = otaNombre(d.prime_annuelle);
    if (!prime && otaNombre(d.prime_mensuelle)) prime = Math.round(otaNombre(d.prime_mensuelle) * 12 * 100) / 100;
    if (!prime && Array.isArray(d.lignes_prime)) { const s = d.lignes_prime.reduce((a, l) => a + (otaNombre(l && (l.prime_annuelle ?? l.prime ?? l.montant)) || 0), 0); if (s > 0) prime = Math.round(s * 100) / 100; }
    return { prime, compagnie: d.compagnie || null, produit: d.produit || null, debut: d.date_debut || null, franchise: d.franchise || null };
  })().catch(e => { console.warn('Lecture offre', e); return null; });
  _ota.set(file, p);
  return p;
}

// ── Fenêtre « Offre reçue » : pré-remplissage dès le choix du PDF ─────────────────────────────────
document.addEventListener('change', async (ev) => {
  const inp = ev.target;
  if (!inp || inp.id !== 'of-fichier') return;
  const file = inp.files && inp.files[0];
  let st = document.getElementById('ota-statut');
  if (!st) { inp.insertAdjacentHTML('afterend', '<div id="ota-statut" class="ota-statut"></div>'); st = document.getElementById('ota-statut'); }
  if (!file) { st.textContent = ''; return; }
  st.className = 'ota-statut'; st.textContent = '🤖 REX lit l’offre…';
  const d = await otaLire(file);
  if (!document.getElementById('of-fichier')) return;   // fenêtre fermée entre-temps
  if (!d || (!d.prime && !d.compagnie)) { st.className = 'ota-statut ota-rien'; st.textContent = 'REX n’a pas reconnu le tarif — saisis la prime à la main.'; return; }
  const remplir = (id, v) => { const el = document.getElementById(id); if (el && v && !el.value.trim()) { el.value = v; el.classList.add('ota-rempli'); return true; } return false; };
  const faits = [];
  if (remplir('of-prime', d.prime ? String(d.prime).replace('.', ',') : '')) faits.push(`prime CHF ${fmtCHF(d.prime)}/an`);
  if (remplir('of-compagnie', d.compagnie ? (typeof normaliserCompagnie === 'function' ? normaliserCompagnie(d.compagnie) : d.compagnie) : '')) faits.push(d.compagnie);
  if (remplir('of-couverture', d.produit)) faits.push('produit');
  if (remplir('of-franchise', d.franchise)) faits.push('franchise');
  st.className = 'ota-statut ota-ok';
  st.textContent = faits.length ? `✓ Reconnu par REX : ${faits.join(' · ')} — vérifie avant d’enregistrer.` : `REX a lu CHF ${d.prime ? fmtCHF(d.prime) : '—'}/an ; les champs étaient déjà remplis.`;
}, true);

// ── Tout autre dépôt d'offre : la prime inscrite après l'archivage ────────────────────────────────
(function otaBrancher() {
  if (typeof uploadOffreCompagnie !== 'function') return;
  const origine = uploadOffreCompagnie;
  window.uploadOffreCompagnie = async function (demandeOffreId, idx, input) {
    const ok = await origine.apply(this, arguments);
    const file = input && input.files && input.files[0];
    if (!ok || !file) return ok;
    try {
      const avant = await dbGet('demandes_offre', `id=eq.${demandeOffreId}&select=id,compagnies_envoi`);
      const e0 = Array.isArray(avant) && avant[0] && (avant[0].compagnies_envoi || [])[idx];
      if (!e0 || otaNombre(e0.prime)) return ok;   // prime déjà connue : on n'y touche pas
      const d = await otaLire(file);
      if (!d || !d.prime) return ok;
      // Relecture juste avant d'écrire : d'autres enrichissements (type de produit, js/132) ont pu passer.
      const rows = await dbGet('demandes_offre', `id=eq.${demandeOffreId}&select=id,opportunite_id,compagnies_envoi`);
      const dem = Array.isArray(rows) && rows[0];
      const e = dem && (dem.compagnies_envoi || [])[idx];
      if (!e || otaNombre(e.prime)) return ok;
      const entrees = dem.compagnies_envoi.map((x, i) => i === idx ? { ...x, prime: d.prime, prime_auto: true } : x);
      const r = await dbPatch('demandes_offre', demandeOffreId, { compagnies_envoi: entrees });
      if (r && r.error) return ok;
      const liste = dem.opportunite_id && window._opDemandes && window._opDemandes[dem.opportunite_id];
      const loc = liste && liste.find(x => x.id === demandeOffreId); if (loc) loc.compagnies_envoi = entrees;
      if (dem.opportunite_id && typeof ajouterLigneHistoriqueOpportunite === 'function')
        await ajouterLigneHistoriqueOpportunite(dem.opportunite_id, `🤖 Prime reconnue par REX sur l’offre ${e.compagnie || ''} : CHF ${fmtCHF(d.prime)}/an`);
      showError(`✓ Offre archivée — prime reconnue : CHF ${fmtCHF(d.prime)}/an.`);
      if (dem.opportunite_id && typeof opRafraichir === 'function' && typeof currentView !== 'undefined' && /opportunit/.test(currentView)) opRafraichir();
    } catch (err) { /* lecture facultative : l'archivage est déjà fait */ }
    return ok;
  };

  const st = document.createElement('style');
  st.textContent = `
    .ota-statut { font-size: 12px; margin-top: 6px; color: var(--text-muted); }
    .ota-statut.ota-ok { color: #15803D; font-weight: 600; }
    .ota-statut.ota-rien { color: var(--c-alerte-texte, #B45309); }
    .form-input.ota-rempli { border-color: #16A34A; box-shadow: 0 0 0 3px color-mix(in srgb, #16A34A 18%, transparent); }`;
  document.head.appendChild(st);
})();
