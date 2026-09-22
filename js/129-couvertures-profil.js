// ═══ OPPORTUNITÉ : COUVERTURES VISÉES SELON LE PROFIL, ET LE MANDAT AUX COMPAGNIES (22.09.2026) ══
// « Couvertures visées doit s'adapter au profil client privé / entreprise. Je ne vois pas les pertes
// de gain, je ne vois pas beaucoup de choses — quitte à simplifier, fais deux vues distinctes.
// Ajoute un bouton poser le mandat compagnies sur les opp, c'est manquant. »
//
// Un seul catalogue servait les deux profils, filtré pour les particuliers : il cachait la perte de
// gain (vitale pour un indépendant) et il manquait des branches entières (accidents privés, voyage,
// animaux, bris de machines, marchandises, D&O, homme-clé…). Deux catalogues désormais :
//   · PRIVÉ      — habitation & RC, véhicules, protection juridique, santé, revenu & prévoyance ;
//   · ENTREPRISE — personnel (LAA, LAAC, perte de gain, LPP), responsabilité, choses & exploitation,
//                  véhicules, protection juridique, risques spécifiques, dirigeant à titre privé.
// La vue s'ouvre selon le segment du client ; un onglet bascule vers l'autre sans rien perdre, et une
// couverture déjà choisie qui n'est pas dans la vue affichée reste visible (« Déjà choisi »).
// Les identifiants existants sont repris tels quels : les affaires déjà saisies s'affichent comme avant.

const CPF_NOUVEAUX = {
  accident_prive: 'Assurance accidents privée (sans employeur, complément)',
  perte_gain_prive: 'Perte de gain maladie / accident (indépendant, non-salarié)',
  risque_deces: 'Risque pur décès / incapacité de gain',
  voyage: 'Assurance voyage / annulation',
  objets_valeur: 'Objets de valeur (bijoux, instruments, vélos…)',
  animaux: 'Animaux (frais vétérinaires)',
  do_entreprise: 'D&O — responsabilité des dirigeants',
  bris_machines: 'Bris de machines / électronique',
  marchandises_transport: 'Marchandises transportées',
  travaux_construction: 'Travaux de construction / RC maître d’ouvrage',
  cle_homme: 'Assurance homme-clé / associés',
  garantie_loyer_entreprise: 'Garantie des salaires / cautionnement',
};

const CPF_PRIVE = {
  'Habitation & responsabilité civile': ['rc_privee', 'menage', 'objets_valeur', 'batiment_prive', 'rc_batiment', 'caution_bail_prive'],
  'Véhicules': ['vehicule_rc', 'casco_partielle', 'casco_complete'],
  'Protection juridique': ['pj_privee', 'pj_circulation'],
  'Santé & accidents': ['lamal', 'lca_autre_compagnie', 'accident_prive', 'voyage'],
  'Revenu & prévoyance': ['perte_gain_prive', 'risque_deces', 'vie_3a', 'vie_3b_mixte', 'lpp_entreprise', 'prevoyance_enfant'],
  'Animaux & divers': ['animaux', 'autre'],
};

const CPF_ENTREPRISE = {
  'Personnel (assurances sociales)': ['laa', 'laac', 'perte_gain_maladie_accident_lca', 'lpp_entreprise'],
  'Responsabilité': ['rc_entreprise', 'do_entreprise'],
  'Choses & exploitation': ['choses_entreprise', 'pertes_exploitation', 'bris_machines', 'marchandises_transport', 'batiment_entreprise', 'travaux_construction'],
  'Véhicules': ['flotte_entreprise', 'vehicule_rc', 'casco_complete', 'casco_partielle'],
  'Protection juridique': ['pj_pro', 'pj_circulation'],
  'Risques spécifiques': ['cyber_entreprise', 'caution_bail_commercial', 'garantie_loyer_entreprise'],
  'Dirigeant & associés': ['cle_homme', 'vie_3a', 'vie_3b_mixte', 'risque_deces'],
  'Divers': ['autre'],
};

// Les nouveaux produits rejoignent le catalogue commun : leurs libellés se lisent partout (puces de
// l'affaire, demandes d'offre…), et les écrans qui parcourent ce catalogue les voient aussi.
(function cpfEtendreCatalogue() {
  if (typeof PRODUITS_OPPORTUNITE_GROUPES === 'undefined') return;
  const deja = new Set(Object.values(PRODUITS_OPPORTUNITE_GROUPES).flat().map(p => p.id));
  const ajout = Object.entries(CPF_NOUVEAUX).filter(([id]) => !deja.has(id)).map(([id, label]) => ({ id, label }));
  if (ajout.length) PRODUITS_OPPORTUNITE_GROUPES['Compléments (privé / entreprise)'] = ajout;
})();

function cpfLabel(id) {
  for (const l of Object.values(typeof PRODUITS_OPPORTUNITE_GROUPES !== 'undefined' ? PRODUITS_OPPORTUNITE_GROUPES : {})) {
    const p = l.find(x => x.id === id); if (p) return p.label;
  }
  return CPF_NOUVEAUX[id] || id;
}
const CPF_ICONES = { 'Habitation & responsabilité civile': '🏠', 'Véhicules': '🚗', 'Protection juridique': '⚖️', 'Santé & accidents': '🩺',
  'Revenu & prévoyance': '🛡️', 'Animaux & divers': '🐾', 'Personnel (assurances sociales)': '👥', 'Responsabilité': '🛡️',
  'Choses & exploitation': '🏭', 'Risques spécifiques': '⚠️', 'Dirigeant & associés': '👔', 'Divers': '📌' };

// Remplace la fenêtre de js/90 : même enregistrement (pafEnregistrerCouvertures lit les cases cochées).
window.pafOuvrirCouvertures = function (oppId, vue) {
  const o = pafOpp(oppId);
  if (!o || typeof creerModale !== 'function') return;
  const cl = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === o.client_id);
  const entrepriseClient = !!(cl && typeof estEntreprise === 'function' && estEntreprise(cl));
  if (vue !== 'prive' && vue !== 'entreprise') vue = entrepriseClient ? 'entreprise' : 'prive';
  const catalogue = vue === 'entreprise' ? CPF_ENTREPRISE : CPF_PRIVE;
  const choisis = new Set(Array.isArray(o.produits) ? o.produits : []);
  const dansVue = new Set(Object.values(catalogue).flat());
  const ailleurs = [...choisis].filter(id => !dansVue.has(id));
  const coche = id => `<label class="paf-coche ${choisis.has(id) ? 'actif' : ''}">
      <input type="checkbox" value="${id}" ${choisis.has(id) ? 'checked' : ''} onchange="this.closest('label').classList.toggle('actif', this.checked)"/>
      <span>${pafEsc(cpfLabel(id))}</span></label>`;
  document.getElementById('modal-paf-couv')?.remove();
  creerModale('modal-paf-couv', `
    <div class="paf-modale">
      <h3>Quelles couvertures visons-nous ?</h3>
      <div class="cpf-vues" role="tablist">
        <button type="button" role="tab" class="${vue === 'prive' ? 'actif' : ''}" onclick="cpfBasculer('${oppId}','prive')">👤 Privé${!entrepriseClient && cl ? ' <small>profil du client</small>' : ''}</button>
        <button type="button" role="tab" class="${vue === 'entreprise' ? 'actif' : ''}" onclick="cpfBasculer('${oppId}','entreprise')">🏢 Entreprise${entrepriseClient ? ' <small>profil du client</small>' : ''}</button>
      </div>
      <p class="paf-sous">Plusieurs possibles. Le produit exact, ses modules et sa prime se fixeront au contrat ; ici on dit seulement de quoi il s’agit.</p>
      <div class="paf-familles">
        ${ailleurs.length ? `<fieldset class="paf-famille cpf-ailleurs"><legend>✓ Déjà choisi (autre vue)</legend>${ailleurs.map(coche).join('')}</fieldset>` : ''}
        ${Object.entries(catalogue).map(([cat, ids]) => `<fieldset class="paf-famille">
          <legend>${CPF_ICONES[cat] || '📌'} ${pafEsc(cat)}</legend>${ids.map(coche).join('')}</fieldset>`).join('')}
      </div>
      <div class="paf-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-paf-couv').remove()">Annuler</button>
        <button type="button" class="btn-save" onclick="pafEnregistrerCouvertures('${oppId}')">✓ Enregistrer</button>
      </div>
    </div>`, { opacite: .7, padding: '16px' });
};

// Changer de vue sans perdre ce qui vient d'être coché (gardé en mémoire, rien n'est écrit).
function cpfBasculer(oppId, vue) {
  const o = pafOpp(oppId);
  if (!o) return;
  o.produits = [...new Set([...document.querySelectorAll('#modal-paf-couv input[type="checkbox"]:checked')].map(i => i.value))];
  pafOuvrirCouvertures(oppId, vue);
}

// Les puces de l'affaire : libellés des nouveaux produits compris.
if (typeof pafCouverturesHtml === 'function') {
  const cpfRenduPuces = pafCouverturesHtml;
  window.pafCouverturesHtml = function (o) {
    return cpfRenduPuces.apply(this, arguments).replace(/<span class="paf-puce">([^<]*)<\/span>/g, (m, t) => `<span class="paf-puce">${pafEsc(CPF_NOUVEAUX[t] || t)}</span>`);
  };
}

// ── « Poser le mandat aux compagnies » dans L'affaire en bref ────────────────────────────────────
// Même fonction que la carte « Documents & mandats signés » de la fiche (js/05) : e-mail aux
// compagnies choisies, mandat signé joint. Sans fiche client ou sans mandat signé, on le dit.
async function cpfPoserMandat(oppId) {
  const o = pafOpp(oppId);
  if (!o || !o.client_id) { showError('Rattache d’abord l’affaire à une fiche client : le mandat part au nom du client.'); return; }
  const m = typeof couMandatDe === 'function' ? await couMandatDe(o.client_id) : true;
  if (m === false) {
    if (confirm('Aucun mandat signé n’est enregistré pour ce client.\n\nCréer le mandat de courtage maintenant ?') && typeof ouvrirOptionsMandatCourtage === 'function') ouvrirOptionsMandatCourtage(o.client_id);
    return;
  }
  if (typeof ouvrirEnvoiMandatCompagnies === 'function') ouvrirEnvoiMandatCompagnies(o.client_id);
}

if (typeof pafResume === 'function') {
  const cpfResume = pafResume;
  window.pafResume = function (o) {
    return cpfResume.apply(this, arguments).replace(
      `<button type="button" class="paf-act" onclick="pafOuvrirSituation('${o.id}')">Situation du client</button>`,
      `<button type="button" class="paf-act" onclick="pafOuvrirSituation('${o.id}')">Situation du client</button>
        <button type="button" class="paf-act paf-act-mandat" onclick="cpfPoserMandat('${o.id}')" title="Envoyer le mandat signé aux compagnies concernées">📨 Poser le mandat aux compagnies</button>`);
  };
}

(function cpfStyles() {
  const st = document.createElement('style');
  st.textContent = `
    .cpf-vues { display: inline-flex; gap: 4px; padding: 3px; margin: 2px 0 10px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface-alt); }
    .cpf-vues button { border: 0; background: transparent; color: var(--text-muted); font: inherit; font-size: var(--t-s); font-weight: 600; padding: 7px 14px; border-radius: 8px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
    .cpf-vues button.actif { background: var(--accent-dim); color: var(--accent); }
    .cpf-vues small { font-size: 10px; font-weight: 500; padding: 1px 6px; border-radius: 999px; background: color-mix(in srgb, #16A34A 16%, transparent); color: #16A34A; }
    .cpf-ailleurs { border-color: color-mix(in srgb, #16A34A 40%, var(--border)) !important; }
    .paf-act-mandat { border-color: color-mix(in srgb, #16A34A 45%, var(--border)) !important; }`;
  document.head.appendChild(st);
})();
