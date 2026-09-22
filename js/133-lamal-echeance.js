// ═══ LAMal : ÉCHÉANCE 31.12 DÈS LA SAISIE (22.09.2026) ═════════════════════════════════════════
// « Date d'échéance des contrats LAMal, même nouveaux : toujours 31.12 de l'année en cours. »
// La base l'impose (déclencheur trg_contrats_lamal_echeance, migration 20260922) ; ici, les
// formulaires l'affichent tout de suite : dès que le produit est une LAMal, le champ échéance
// passe au 31.12 de l'année en cours — ou de l'année de début si le contrat commence plus tard.

function lamEcheance(debut) {
  const an = Math.max(new Date().getFullYear(), debut ? Number(String(debut).slice(0, 4)) || 0 : 0);
  return `${an}-12-31`;
}

function lamAppliquer() {
  for (const [prod, deb, ech] of [['ct-produit', 'ct-date', 'ct-echeance'], ['ect-produit', 'ect-date-debut', 'ect-echeance']]) {
    const p = document.getElementById(prod), e = document.getElementById(ech);
    if (!p || !e) continue;
    const libelle = p.tagName === 'SELECT' ? (p.options[p.selectedIndex]?.text || p.value) : p.value;
    if (!/lamal/i.test(libelle || '')) continue;
    const v = lamEcheance(document.getElementById(deb)?.value);
    if (e.value !== v) { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }
    e.title = 'LAMal : échéance toujours au 31.12 (renouvellement annuel au 1er janvier)';
  }
}

(function lamBrancher() {
  const ecoute = ev => { if (ev.target && /^(e?ct-produit|ct-date|ect-date-debut|e?ct-echeance)$/.test(ev.target.id || '')) setTimeout(lamAppliquer, 0); };
  document.addEventListener('change', ecoute, true);
  document.addEventListener('input', ecoute, true);
  // Formulaire ouvert déjà rempli (modification d'un contrat LAMal) : on corrige à l'affichage.
  const main = () => document.getElementById('main-content');
  const go = () => { const m = main(); if (m) new MutationObserver(() => { if (document.getElementById('ct-echeance') || document.getElementById('ect-echeance')) setTimeout(lamAppliquer, 50); }).observe(m, { childList: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
