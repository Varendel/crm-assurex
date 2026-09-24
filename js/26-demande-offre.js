// ═══ DEMANDE D'OFFRE SIMPLIFIÉE (19.09.2026) ═══════════════════════════════════════════════
// Parcours en 4 temps sur une seule page :
//   1. Pour qui (client ou prospect — reprise automatique des données connues)
//   2. Quoi (branches en tuiles → seules les rubriques utiles apparaissent)
//   3. À qui (compagnies par logo)
//   4. E-mail complet, construit en direct, relu puis envoyé via Outlook (jamais automatiquement)
// Même structure de données que l'ancien formulaire (demandes_offre.donnees, mêmes identifiants
// de champs « do-* ») : les fonctions existantes de js/07 (préremplissage, collaborateurs LPP,
// véhicules, aperçu et envoi de l'e-mail) sont réutilisées telles quelles. L'ancien formulaire
// reste accessible (« Formulaire détaillé »).

const DX_BRANCHES = [
  { id: 'pgm', icone: '🤒', label: 'Perte de gain maladie', pour: 'e', flag: 'do-perte-gain', detect: ['do-perte-gain', 'do-pg-14j', 'do-pg-30j', 'do-pg-60j', 'do-couverture-salaire'] },
  { id: 'laa', icone: '🦺', label: 'Accidents LAA', pour: 'e', detect: ['do-laa', 'do-laaf', 'do-laac', 'do-semi-privee'] },
  { id: 'lpp', icone: '🏦', label: 'LPP', pour: 'e', flag: 'do-lpp', detect: ['do-lpp', 'do-taux-min-legal', 'do-cap-invalidite', 'do-cap-deces'] },
  { id: 'rc', icone: '🛡️', label: 'RC entreprise', pour: 'e', flag: 'do-rc-commerce', detect: ['do-rc-commerce', 'do-rc-risque', 'do-rc-lieux', 'do-rc-prejudice-fortune', 'do-prejudice-fortune'] },
  { id: 'choses', icone: '📦', label: 'Inventaire & choses', pour: 'e', detect: ['do-technique', 'do-perte-exploit', 'do-machines', 'do-vol', 'do-all-risk', 'do-marchandises', 'do-transports', 'do-transports-speciaux'] },
  { id: 'cyber', icone: '💻', label: 'Cyber', pour: 'e', flag: 'do-cyber', detect: ['do-cyber'] },
  { id: 'construction', icone: '🏗️', label: 'Construction', pour: 'e', flag: 'do-construction', detect: ['do-construction'] },
  { id: 'menage', icone: '🏠', label: 'Ménage / RC privée', pour: 'p', detect: [] },
  { id: 'vie', icone: '🌱', label: 'Vie · 3e pilier', pour: '*', detect: ['do-3a', 'do-3a-indep', 'do-3b', 'do-risque-pure', 'do-versement-unique', 'do-budget-epargne'] },
  { id: 'pj', icone: '⚖️', label: 'Protection juridique', pour: '*', detect: ['do-pj-privee', 'do-pj-circulation', 'do-pj-professionnelle'] },
  { id: 'vehicules', icone: '🚗', label: 'Véhicules', pour: '*', detect: [] },
];

window._dx = window._dx || { branches: new Set(), entreprise: true };

function dxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// Case à cocher « pastille » (même id que l'ancien formulaire)
function dxCk(id, label) { return `<label class="dx-ck"><input type="checkbox" id="${id}" onchange="dxApercu()"/><span>${label}</span></label>`; }
function dxChamp(id, label, attrs) { return `<div class="form-field"><label class="form-label" for="${id}">${label}</label><input class="form-input" id="${id}" ${attrs || ''} oninput="dxApercu()"/></div>`; }
function dxOuiNon(id, label) { return `<div class="form-field"><label class="form-label" for="${id}">${label}</label><select class="form-select" id="${id}" onchange="dxApercu()"><option value="">—</option><option value="oui">Oui</option><option value="non">Non</option></select></div>`; }

async function viewDemandeOffreSimple() {
  const editId = demandeOffreEnEditionId;
  demandeOffreEnEditionId = null;
  demandeOffreActiveId = editId;
  const existante = editId ? (await dbGet('demandes_offre', `id=eq.${editId}&select=*`))[0] : null;
  const clientId = existante ? existante.client_id : prefillDemandeOffreClientId;
  const oppId = existante ? existante.opportunite_id : prefillDemandeOffreOpportuniteId;
  prefillDemandeOffreClientId = null;
  prefillDemandeOffreOpportuniteId = null;
  const opp = oppId ? allOpportunites.find(o => o.id === oppId) : null;
  const client = clientId ? allClients.find(c => c.id === clientId) : null;
  const contacts = await dbGet('compagnies_contacts', 'select=*&order=compagnie.asc');
  window._doContacts = Array.isArray(contacts) ? contacts : [];
  window._dx = { branches: new Set((existante && existante.donnees && existante.donnees.branches) || []), entreprise: client ? estEntreprise(client) : true, existante, opp };
  const nomClient = client ? (estEntreprise(client) ? client.nom : `${client.prenom} ${client.nom}`) : '';
  const prospect = !client ? ((existante && existante.prospect_nom) || (opp && !opp.client_id ? opp.prospect_nom : '') || '') : '';
  const envois = (existante && Array.isArray(existante.compagnies_envoi)) ? existante.compagnies_envoi : [];

  setTimeout(() => {
    if (existante) prefillChampsDemandeOffre(existante);
    else if (client) dxPrefillClient(client, true);
    if (existante && existante.donnees && existante.donnees.precisions) { const p = document.getElementById('dx-precisions'); if (p) p.value = existante.donnees.precisions; }
    dxDetecterBranches();
    dxApercu();
  }, 0);

  const tuiles = DX_BRANCHES.map(b => `<button type="button" class="dx-tuile" data-br="${b.id}" data-pour="${b.pour}" aria-pressed="false" onclick="dxBasculer('${b.id}')"><span class="dx-tuile-icone">${b.icone}</span><span>${b.label}</span><span class="dx-tuile-coche" aria-hidden="true">✓</span></button>`).join('');

  const cies = window._doContacts.map(c => {
    const env = envois.find(e => e.compagnie_id === c.id);
    return `<label class="dx-cie" data-nom="${dxEsc(_cleRechercheSansAccents(c.compagnie + ' ' + (c.libelle_contact || '')))}">
      <input type="checkbox" class="do-cie-checkbox" value="${c.id}" onchange="dxMajCies()"/>
      <span class="dx-cie-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(c.compagnie, 38) : ''}</span>
      <span class="dx-cie-nom"><b>${dxEsc(c.compagnie)}</b>${c.libelle_contact ? `<small>${dxEsc(c.libelle_contact)}</small>` : ''}
        ${env && env.envoye_le ? `<em class="deja">Envoyée le ${fmtDate(env.envoye_le)}</em>` : (c.email ? '' : '<em class="sans">pas d’e-mail</em>')}</span>
      <span class="dx-cie-coche" aria-hidden="true">✓</span>
    </label>`;
  }).join('');

  return `<div class="dx">
    <button type="button" class="opx-lien-retour" onclick="goBack()">← Retour</button>
    ${existante ? `<input type="hidden" id="do-demande-offre-id" value="${existante.id}"/>` : ''}
    ${opp ? `<input type="hidden" id="do-opportunite-id" value="${opp.id}"/>` : ''}
    <header class="dx-tete">
      <div>
        <div class="dx-surtitre">Demande d'offre${existante ? ' · du ' + fmtDate(existante.created_at) : ''}</div>
        <h2>${nomClient || prospect ? dxEsc(nomClient || prospect) : 'Nouvelle demande d’offre'}</h2>
        ${opp ? `<button type="button" class="dx-lien-opp" onclick="opportuniteEnEditionId='${opp.id}';navigate('nouvelle-opportunite')">🎯 ${dxEsc(opp.titre)} →</button>` : ''}
      </div>
      <div class="dx-tete-actions">
        <button type="button" class="dx-ia-btn" onclick="document.getElementById('dx-ia').hidden=!document.getElementById('dx-ia').hidden">✨ Remplir en dictant</button>
        <button type="button" class="opx-lien" onclick="dxFormulaireDetaille()">Formulaire détaillé</button>
      </div>
    </header>
    <div id="dx-ia" class="dx-ia" hidden>
      <div class="dx-ia-texte">Décris la situation (à l'oral avec 🎤, ou par écrit) : les rubriques se cochent et se remplissent toutes seules. Tu vérifies ensuite.</div>
      <div class="opx-saisie-ligne"><textarea id="do-texte-libre" class="form-input" rows="3" placeholder="Ex. 8 employés, CA 1.2 million, perte de gain 30 jours, LPP, RC commerce…"></textarea>
        ${(window.SpeechRecognition || window.webkitSpeechRecognition) ? `<button type="button" class="opx-micro" id="opx-micro" aria-label="Dicter" onclick="opDicter('do-texte-libre')">🎤</button>` : ''}</div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap"><button type="button" class="btn-save" onclick="dxRemplirIA()">Remplir automatiquement</button><span id="do-ia-status" class="dbx-carte-sous"></span></div>
    </div>

    <div class="dx-grille">
      <div class="dx-col">
        <section class="dx-etape">
          <div class="dx-etape-num">1</div>
          <div class="dx-etape-corps">
            <h3>Pour qui ?</h3>
            <div class="form-field" style="position:relative">
              <input class="form-input" id="dx-client-recherche" autocomplete="off" placeholder="Client existant ou nom du prospect" value="${dxEsc(nomClient || prospect)}"
                oninput="dxRechercheClient(this.value)" onfocus="dxRechercheClient(this.value)" onblur="setTimeout(()=>{const z=document.getElementById('dx-resultats');if(z)z.style.display='none'},180)"/>
              <div id="dx-resultats" class="opc-resultats" style="display:none"></div>
              <select id="do-client" hidden>${client ? `<option value="${client.id}" selected>${dxEsc(nomClient)}</option>` : '<option value="" selected></option>'}</select>
              <input type="hidden" id="do-prospect-nom" value="${dxEsc(prospect)}"/>
              <div id="dx-client-etat" class="opc-etat">${client ? '✓ Client existant — coordonnées reprises de sa fiche' : (prospect ? '🆕 Prospect' : '')}</div>
            </div>
            <details class="dx-details" ${client ? '' : 'open'}>
              <summary>Coordonnées et identité</summary>
              <div class="form-grid">
                ${dxChamp('do-contact', 'Personne de contact')}
                ${dxChamp('do-tel', 'Téléphone', 'type="tel"')}
                ${dxChamp('do-email', 'E-mail', 'type="email"')}
                <div class="form-field" style="grid-column:span 2"><label class="form-label" for="do-adresse">Adresse</label><input class="form-input" id="do-adresse" oninput="dxApercu()"/></div>
                <div data-dx="e">${dxChamp('do-activite', 'Activité principale')}</div>
                <div data-dx="rc choses">${dxChamp('do-lieu-risque', 'Lieu du risque')}</div>
                <div data-dx="lpp vie">${dxChamp('do-avs', 'N° AVS')}</div>
              </div>
            </details>
          </div>
        </section>

        <section class="dx-etape">
          <div class="dx-etape-num">2</div>
          <div class="dx-etape-corps">
            <h3>Quelles couvertures ?</h3>
            <div class="dx-tuiles" id="dx-tuiles">${tuiles}</div>
            <div id="dx-rubriques" class="dx-rubriques">
              <div class="dx-rub" data-dx="pgm laa lpp rc choses cyber">
                <h4>🏢 Entreprise</h4>
                <div class="form-grid">
                  ${dxChamp('do-ca', "Chiffre d'affaires (CHF)", 'inputmode="decimal"')}
                  ${dxChamp('do-nb-collab', 'Nombre de collaborateurs', 'inputmode="numeric"')}
                </div>
              </div>
              <!-- La ventilation AP / ANP / excédentaire n'a de sens que si on demande de l'accident :
                   ce sont des notions LAA. Pour une perte de gain ou une LPP seules, la compagnie
                   veut la masse salariale AVS tout court, ventilée hommes / femmes (24.09.2026). -->
              <div class="dx-rub" data-dx="pgm lpp !laa">
                <h4>💶 Masse salariale AVS <small>ventilée hommes / femmes</small></h4>
                <div class="form-grid dx-grid-3">
                  ${dxChamp('do-avs-h', 'Salaires AVS — hommes', 'inputmode="decimal"')}${dxChamp('do-avs-f', 'Salaires AVS — femmes', 'inputmode="decimal"')}<div></div>
                </div>
              </div>
              <div class="dx-rub" data-dx="laa">
                <h4>💶 Masse salariale AVS <small>max. 148'200 par personne en LAA · dès 8 h/sem. soumis ANP</small></h4>
                <div class="form-grid dx-grid-3">
                  ${dxChamp('do-ap-h', 'AP — hommes', 'inputmode="decimal"')}${dxChamp('do-ap-f', 'AP — femmes', 'inputmode="decimal"')}${dxChamp('do-masse-chef', "Chef d'entreprise", 'inputmode="decimal"')}
                  ${dxChamp('do-anp-h', 'ANP — hommes', 'inputmode="decimal"')}${dxChamp('do-anp-f', 'ANP — femmes', 'inputmode="decimal"')}<div></div>
                  ${dxChamp('do-exc-avs-h', 'Excédentaire — hommes', 'inputmode="decimal"')}${dxChamp('do-exc-avs-f', 'Excédentaire — femmes', 'inputmode="decimal"')}
                </div>
              </div>
              <div class="dx-rub" data-dx="pgm">
                <h4>🤒 Perte de gain maladie</h4>
                <input type="checkbox" id="do-perte-gain" hidden/>
                <div class="dx-pastilles"><span class="dx-pastilles-label">Délai d'attente</span>${dxCk('do-pg-14j', '14 j')}${dxCk('do-pg-30j', '30 j')}${dxCk('do-pg-60j', '60 j')}</div>
                <div class="form-grid">
                  <div class="form-field"><label class="form-label" for="do-couverture-salaire">Couverture du salaire</label><select class="form-select" id="do-couverture-salaire" onchange="dxApercu()"><option value="">—</option><option value="80">80 %</option><option value="90">90 %</option><option value="100">100 %</option></select></div>
                  ${dxOuiNon('do-cct', 'Soumis à une CCT ?')}
                </div>
              </div>
              <div class="dx-rub" data-dx="laa">
                <h4>🦺 Accidents</h4>
                <div class="dx-pastilles">${dxCk('do-laa', 'LAA')}${dxCk('do-laac', 'Complémentaire LAAC')}${dxCk('do-laaf', 'LAAF (indépendant)')}${dxCk('do-semi-privee', 'Division semi-privée')}</div>
                <div class="form-grid">${dxOuiNon('do-suva', 'Soumis SUVA ?')}${dxOuiNon('do-independant', 'Statut indépendant ?')}</div>
              </div>
              <div class="dx-rub" data-dx="lpp">
                <h4>🏦 LPP <small>seuil 22'680 · coordonné 3'780 – 64'260</small></h4>
                <input type="checkbox" id="do-lpp" hidden/>
                <div class="form-grid">
                  <div class="form-field"><label class="form-label" for="do-taux-min-legal">Bonifications</label><select class="form-select" id="do-taux-min-legal" onchange="basculerTauxLppPersonnalise(this);dxApercu()"><option value="">—</option><option value="7/10/15/18">7/10/15/18 (minimum légal)</option><option value="personnalise">Personnalisé…</option></select><input class="form-input" id="do-taux-min-legal-custom" placeholder="Ex. 10/15/20/25" style="margin-top:6px;display:none" oninput="dxApercu()"/></div>
                  <div class="form-field"><label class="form-label" for="do-ded-coord">Déduction de coordination</label><select class="form-select" id="do-ded-coord" onchange="dxApercu()"><option value="">—</option><option value="avec">Avec</option><option value="sans">Sans</option></select></div>
                  ${dxChamp('do-cap-invalidite', 'Capital invalidité souhaité (CHF)', 'inputmode="decimal"')}
                  ${dxChamp('do-cap-deces', 'Capital décès souhaité (CHF)', 'inputmode="decimal"')}
                  ${dxChamp('do-lpp-exc-h', 'Salaires excédentaires — hommes', 'inputmode="decimal"')}
                  ${dxChamp('do-lpp-exc-f', 'Salaires excédentaires — femmes', 'inputmode="decimal"')}
                </div>
                <div class="dx-pastilles"><span class="dx-pastilles-label">Améliorations</span>${dxCk('do-amelio-rentes', 'Rentes')}${dxCk('do-amelio-epargne', 'Épargne')}${dxCk('do-amelio-tranches', 'Tranches')}${dxCk('do-amelio-rendement', 'Rendement')}</div>
                <div class="form-label" style="margin-top:12px">Collaborateurs à assurer</div>
                <div id="do-collabs-list" class="dx-lignes" oninput="dxApercu()"></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <button type="button" class="dx-ajouter" onclick="ajouterCollaborateurDemandeOffre()">+ Collaborateur</button>
                  <!-- 24.09.2026 : la reprise à choix multiples avait été posée sur l'ancien formulaire
                       détaillé (js/07) alors que c'est CETTE vue qui sert au quotidien, y compris depuis
                       une opportunité. Le personnel est déjà fiché sur le client : on coche, on reprend. -->
                  <button type="button" class="dx-ajouter" onclick="ouvrirReprisesCollaborateurs()">👥 Reprendre le personnel fiché</button>
                </div>
              </div>
              <div class="dx-rub" data-dx="rc">
                <h4>🛡️ Responsabilité civile</h4>
                <input type="checkbox" id="do-rc-commerce" hidden/>
                <div class="form-grid">
                  <div class="form-field" style="grid-column:span 2"><label class="form-label" for="do-rc-risque">Risque particulier dans l'activité ?</label><textarea class="form-input" id="do-rc-risque" rows="2" oninput="dxApercu()"></textarea></div>
                  <div class="form-field" style="grid-column:span 2"><label class="form-label" for="do-rc-lieux">Lieux d'exploitation</label><input class="form-input" id="do-rc-lieux" oninput="dxApercu()"/></div>
                </div>
                <div class="dx-pastilles">${dxCk('do-rc-prejudice-fortune', 'Préjudice de fortune (CV + diplômes)')}</div>
                <input type="checkbox" id="do-prejudice-fortune" hidden/>
                <textarea class="form-input" id="do-rc-cv-details" rows="2" placeholder="Formations, CV (si préjudice de fortune)" oninput="dxApercu()" style="margin-top:8px"></textarea>
              </div>
              <div class="dx-rub" data-dx="choses menage">
                <h4>📦 Inventaire</h4>
                <div class="form-grid">${dxChamp('do-inventaire', 'Somme d’assurance (CHF)', 'inputmode="decimal"')}</div>
                <input type="hidden" id="do-rc-inventaire"/>
                <div class="dx-pastilles" data-dx="choses">${dxCk('do-vol', 'Vol')}${dxCk('do-all-risk', 'All risk')}${dxCk('do-machines', 'Machines')}${dxCk('do-technique', 'Technique')}${dxCk('do-perte-exploit', 'Perte d’exploitation')}${dxCk('do-marchandises', 'Marchandises')}${dxCk('do-transports', 'Transports')}${dxCk('do-transports-speciaux', 'Transports spéciaux')}</div>
              </div>
              <input type="checkbox" id="do-cyber" hidden/><input type="checkbox" id="do-construction" hidden/>
              <div class="dx-rub" data-dx="vie">
                <h4>🌱 Vie · 3e pilier</h4>
                <div class="dx-pastilles">${dxCk('do-3a', '3a')}${dxCk('do-3a-indep', '3a indépendant')}${dxCk('do-3b', '3b')}${dxCk('do-risque-pure', 'Risque pur')}${dxCk('do-versement-unique', 'Versement unique')}</div>
                <div class="form-grid">${dxChamp('do-budget-epargne', 'Budget épargne (CHF / an)', 'inputmode="decimal"')}${dxChamp('do-pa', 'Police existante')}</div>
              </div>
              <div class="dx-rub" data-dx="pj">
                <h4>⚖️ Protection juridique</h4>
                <div class="dx-pastilles">${dxCk('do-pj-privee', 'Privée')}${dxCk('do-pj-circulation', 'Circulation')}${dxCk('do-pj-professionnelle', 'Entreprise')}</div>
              </div>
              <div class="dx-rub" data-dx="vehicules">
                <h4>🚗 Véhicules</h4>
                <div id="do-plaques-list" class="dx-lignes" oninput="dxApercu()"></div>
                <button type="button" class="dx-ajouter" onclick="ajouterPlaqueDemandeOffre()">+ Véhicule</button>
              </div>
              <div class="dx-rub dx-rub-toujours">
                <h4>📝 Précisions pour la compagnie</h4>
                <textarea class="form-input" id="dx-precisions" rows="2" placeholder="Sinistres passés, assureur actuel, échéance, souhaits particuliers…" oninput="dxApercu()"></textarea>
              </div>
            </div>
          </div>
        </section>

        <section class="dx-etape">
          <div class="dx-etape-num">3</div>
          <div class="dx-etape-corps">
            <h3>À quelles compagnies ? <span class="dx-compteur" id="dx-nb-cies"></span></h3>
            ${window._doContacts.length > 8 ? `<input class="form-input dx-filtre" placeholder="Filtrer les compagnies…" oninput="dxFiltrerCies(this.value)"/>` : ''}
            <div class="dx-cies">${cies || '<div class="dbx-vide-petit">Aucune compagnie — ajoute-les dans Paramètres → Contacts compagnies.</div>'}</div>
          </div>
        </section>
      </div>

      <aside class="dx-col dx-apercu-col">
        <section class="dx-etape dx-apercu">
          <div class="dx-etape-num">4</div>
          <div class="dx-etape-corps">
            <h3>L'e-mail <small>se construit en direct</small></h3>
            <pre id="dx-apercu" class="dx-apercu-texte"></pre>
          </div>
        </section>
      </aside>
    </div>

    <div class="dx-barre">
      <button type="button" class="btn-secondary" onclick="dxEnregistrer(true)">💾 Enregistrer</button>
      <button type="button" class="btn-secondary" onclick="dxImprimer()">🖨️ PDF</button>
      <button type="button" class="btn-save" id="dx-btn-envoyer" onclick="dxEnvoyer()">✉️ Relire et envoyer</button>
    </div>
  </div>`;
}

// ── Client / prospect ───────────────────────────────────────────────────────────────────────
function dxRechercheClient(texte) {
  const zone = document.getElementById('dx-resultats');
  if (!zone) return;
  const q = _cleRechercheSansAccents(texte || '');
  const nomC = c => estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
  const sel = document.getElementById('do-client');
  if (sel && sel.value && (sel.selectedOptions[0]?.text || '') !== texte) {
    sel.innerHTML = '<option value="" selected></option>';
  }
  document.getElementById('do-prospect-nom').value = sel && sel.value ? '' : (texte || '').trim();
  const etat = document.getElementById('dx-client-etat');
  if (etat && !(sel && sel.value)) etat.textContent = texte && texte.trim() ? '🆕 Prospect (pas encore client)' : '';
  if (!q) { zone.style.display = 'none'; dxApercu(); return; }
  const res = allClients.filter(c => _cleRechercheSansAccents(nomC(c)).includes(q)).slice(0, 7);
  zone.innerHTML = res.map(c => `<button type="button" onmousedown="dxChoisirClient('${c.id}')"><strong>${dxEsc(nomC(c))}</strong><span>${estEntreprise(c) ? 'Entreprise' : 'Privé'}${c.ville ? ' · ' + dxEsc(c.ville) : ''}</span></button>`).join('')
    || '<div class="opc-vide">Aucun client — ce sera un prospect.</div>';
  zone.style.display = 'block';
  dxApercu();
}

function dxChoisirClient(id) {
  const c = allClients.find(x => x.id === id);
  if (!c) return;
  const nom = estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
  document.getElementById('do-client').innerHTML = `<option value="${c.id}" selected>${dxEsc(nom)}</option>`;
  document.getElementById('dx-client-recherche').value = nom;
  document.getElementById('do-prospect-nom').value = '';
  document.getElementById('dx-resultats').style.display = 'none';
  document.getElementById('dx-client-etat').textContent = '✓ Client existant — coordonnées reprises de sa fiche';
  dxPrefillClient(c, false);
  dxDetecterBranches();
  dxApercu();
}

// Reprend les données connues du client dans les champs encore vides
function dxPrefillClient(c, initial) {
  window._dx.entreprise = estEntreprise(c);
  const setSiVide = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
  setSiVide('do-contact', estEntreprise(c) ? (c.prenom || '') : `${c.prenom || ''} ${c.nom || ''}`.trim());
  setSiVide('do-adresse', [c.co, c.adresse, [c.npa, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '));
  setSiVide('do-tel', c.mobile || c.tel || '');
  setSiVide('do-email', c.email || '');
  setSiVide('do-avs', c.avs || '');
  setSiVide('do-activite', c.profession || '');
  if (estEntreprise(c) && c.details_entreprise) prefillDemandeOffreDepuisDetailsClient(c);
  dxOrdonnerTuiles();
}

// ── Branches ────────────────────────────────────────────────────────────────────────────────
function dxBasculer(id) {
  const b = DX_BRANCHES.find(x => x.id === id);
  if (!b) return;
  const on = !window._dx.branches.has(id);
  if (on) window._dx.branches.add(id); else window._dx.branches.delete(id);
  if (b.flag) { const f = document.getElementById(b.flag); if (f) f.checked = on; }
  if (on && id === 'laa') { const laa = document.getElementById('do-laa'); if (laa && !document.getElementById('do-laaf').checked) laa.checked = true; }
  if (on && id === 'vehicules' && !document.querySelector('.do-plaque-numero')) ajouterPlaqueDemandeOffre();
  if (on && id === 'lpp' && !document.querySelector('.do-collab-row')) ajouterCollaborateurDemandeOffre();
  dxAppliquer(!on);
  dxApercu();
  if (on) {
    const rub = [...document.querySelectorAll('.dx-rub[data-dx]')].find(r => r.dataset.dx.split(' ').includes(id));
    if (rub && window.innerWidth < 900) setTimeout(() => rub.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }
}

// Affiche les rubriques des branches actives ; vide celles qui disparaissent (sinon elles
// partiraient quand même dans l'e-mail)
function dxAppliquer(viderMasques) {
  const actives = window._dx.branches;
  document.querySelectorAll('.dx-tuile').forEach(t => { const on = actives.has(t.dataset.br); t.classList.toggle('actif', on); t.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-dx]').forEach(el => {
    // Une clé préfixée de « ! » exclut : `data-dx="pgm lpp !laa"` = visible pour la perte de gain
    // ou la LPP, mais pas si l'accident est demandé (là c'est la ventilation AP/ANP qui s'applique).
    const cles = el.dataset.dx.split(' ').filter(Boolean);
    const positives = cles.filter(k => k[0] !== '!');
    const negatives = cles.filter(k => k[0] === '!').map(k => k.slice(1));
    const actif = k => k === 'e' ? window._dx.entreprise : actives.has(k);
    const visible = positives.some(actif) && !negatives.some(actif);
    const etaitVisible = !el.hidden;
    el.hidden = !visible;
    if (!visible && etaitVisible && viderMasques) {
      el.querySelectorAll('input, select, textarea').forEach(ch => { if (ch.type === 'checkbox') ch.checked = false; else ch.value = ''; });
      el.querySelectorAll('.do-collab-wrapper, #do-plaques-list > div').forEach(r => r.remove());
    }
  });
  DX_BRANCHES.forEach(b => { if (b.flag) { const f = document.getElementById(b.flag); if (f) f.checked = actives.has(b.id); } });
  const vide = !actives.size;
  const rubs = document.getElementById('dx-rubriques');
  if (rubs) rubs.classList.toggle('vide', vide);
}

function dxDetecterBranches() {
  const a = window._dx.branches;
  const rempli = id => { const el = document.getElementById(id); return el && (el.type === 'checkbox' ? el.checked : !!el.value); };
  DX_BRANCHES.forEach(b => { if (b.detect.some(rempli)) a.add(b.id); });
  if (document.querySelector('.do-collab-row')) a.add('lpp');
  if (document.querySelector('.do-plaque-numero')) a.add('vehicules');
  if (rempli('do-inventaire') && !a.has('choses')) a.add(window._dx.entreprise ? 'choses' : 'menage');
  dxAppliquer(false);
  dxOrdonnerTuiles();
}

// Clients privés : les branches privées passent devant
function dxOrdonnerTuiles() {
  const zone = document.getElementById('dx-tuiles');
  if (!zone) return;
  const ent = window._dx.entreprise;
  [...zone.children].sort((x, y) => {
    const rang = t => t.dataset.pour === '*' ? 1 : (t.dataset.pour === (ent ? 'e' : 'p') ? 0 : 2);
    return rang(x) - rang(y);
  }).forEach(t => { zone.appendChild(t); t.classList.toggle('secondaire', t.dataset.pour !== '*' && t.dataset.pour !== (ent ? 'e' : 'p')); });
  dxAppliquer(false);
}

async function dxRemplirIA() {
  await remplirDemandeOffreParIA();
  dxDetecterBranches();
  dxApercu();
}

// ── Compagnies ──────────────────────────────────────────────────────────────────────────────
function dxMajCies() {
  const n = document.querySelectorAll('.do-cie-checkbox:checked').length;
  const el = document.getElementById('dx-nb-cies');
  if (el) el.textContent = n ? `${n} sélectionnée${n > 1 ? 's' : ''}` : '';
  const btn = document.getElementById('dx-btn-envoyer');
  if (btn) btn.textContent = n ? `✉️ Relire et envoyer à ${n} compagnie${n > 1 ? 's' : ''}` : '✉️ Relire et envoyer';
}
function dxFiltrerCies(t) {
  const q = _cleRechercheSansAccents(t || '');
  document.querySelectorAll('.dx-cie').forEach(el => { el.hidden = q && !el.dataset.nom.includes(q) && !el.querySelector('input').checked; });
}

// ── L'e-mail ───────────────────────────────────────────────────────────────────────────────
function dxNombre(v) { const n = typeof nombreCH === 'function' ? nombreCH(v) : parseFloat(v); return Number.isFinite(n) ? n : 0; }
function dxCHF(v) { return 'CHF ' + dxNombre(v).toLocaleString('fr-CH'); }

function dxCorpsEmail() {
  const body = construireBodyDemandeOffre();
  const d = body.donnees;
  const a = window._dx.branches;
  const i = d.identite, b = d.base_calcul, ap = d.assurances_personnes, av = d.assurances_vie, ac = d.assurances_choses,
    pj = d.protection_juridique, comp = d.complementaires, lpp = d.lpp, rc = d.rc;
  const sel = document.getElementById('do-client');
  const nomClient = (sel && sel.value ? sel.selectedOptions[0]?.text : '') || document.getElementById('do-prospect-nom')?.value || '[Client]';
  const oui = (x, l) => x ? l : null;
  const liste = arr => arr.filter(Boolean);

  const coord = liste([
    i.adresse ? `Adresse : ${i.adresse}` : null,
    i.activite && window._dx.entreprise ? `Activité principale : ${i.activite}` : null,
    i.lieu_risque ? `Lieu du risque : ${i.lieu_risque}` : null,
  ]).join('\n');

  const masses = [['Salaires AVS — hommes', b.avs_h], ['Salaires AVS — femmes', b.avs_f],
    ['Masse salariale AP — hommes', b.ap_h], ['Masse salariale AP — femmes', b.ap_f], ['Masse salariale ANP — hommes', b.anp_h], ['Masse salariale ANP — femmes', b.anp_f],
    ['Salaire excédentaire AVS — hommes', b.exc_avs_h], ['Salaire excédentaire AVS — femmes', b.exc_avs_f], ["Masse salariale chef d'entreprise", b.masse_chef]].filter(([, v]) => dxNombre(v) > 0);
  const taille = liste([
    b.ca ? `Chiffre d'affaires : ${dxCHF(b.ca)}` : null,
    masses.length ? `Masse salariale :\n${masses.map(([l, v]) => `- ${l} : ${dxCHF(v)}`).join('\n')}` : null,
    b.nb_collab ? `Nombre de collaborateurs : ${b.nb_collab}` : null,
  ]).join('\n');

  const blocs = [];
  if (a.has('pgm')) {
    const delais = liste([ap.pg_14j && '14 j', ap.pg_30j && '30 j', ap.pg_60j && '60 j']);
    blocs.push(`- Perte de gain maladie${delais.length ? ` — délai d'attente ${delais.join(' / ')}` : ''}${comp.couverture_salaire ? ` — couverture ${comp.couverture_salaire} % du salaire` : ''}${comp.cct ? ` — CCT : ${comp.cct}` : ''}`);
  }
  if (a.has('laa')) {
    const l = liste([oui(ap.laa, 'LAA'), oui(ap.laac, 'complémentaire LAAC'), oui(ap.laaf, 'LAAF (indépendant)'), oui(ap.semi_privee, 'division semi-privée')]);
    blocs.push(`- Accidents : ${l.join(', ') || 'LAA'}${i.suva ? ` — soumis SUVA : ${i.suva}` : ''}`);
  }
  if (a.has('lpp')) {
    const l = liste([lpp.taux_min_legal ? `bonifications ${lpp.taux_min_legal}` : null, lpp.ded_coord ? `${lpp.ded_coord} déduction de coordination` : null,
      lpp.cap_invalidite ? `capital invalidité ${dxCHF(lpp.cap_invalidite)}` : null, lpp.cap_deces ? `capital décès ${dxCHF(lpp.cap_deces)}` : null]);
    const amelio = liste([oui(lpp.amelio_rentes, 'rentes'), oui(lpp.amelio_epargne, 'épargne'), oui(lpp.amelio_tranches, 'tranches de cotisations'), oui(lpp.amelio_rendement, 'rendement')]);
    let t = `- LPP${l.length ? ' — ' + l.join(', ') : ''}${amelio.length ? `\n  Améliorations souhaitées : ${amelio.join(', ')}` : ''}`;
    if (dxNombre(lpp.exc_h) || dxNombre(lpp.exc_f)) t += `\n  Salaires excédentaires : hommes ${dxCHF(lpp.exc_h)} / femmes ${dxCHF(lpp.exc_f)}`;
    if (d.collaborateurs_lpp.length) t += `\n  Collaborateurs à assurer (${d.collaborateurs_lpp.length}) :\n${d.collaborateurs_lpp.map(c => `  • ${[c.prenom, c.nom].filter(Boolean).join(' ')}${c.date_naissance ? ', né(e) le ' + fmtDate(c.date_naissance) : ''}${c.salaire ? ', salaire AVS ' + dxCHF(c.salaire) : ''}`).join('\n')}`;
    blocs.push(t);
  }
  if (a.has('rc')) {
    let t = '- Responsabilité civile entreprise';
    if (rc.risque) t += `\n  Risque particulier : ${rc.risque}`;
    if (rc.lieux) t += `\n  Lieux d'exploitation : ${rc.lieux}`;
    if (rc.prejudice_fortune) t += `\n  Avec préjudice de fortune${rc.cv_details ? ` (${rc.cv_details})` : ''} — CV et diplômes en annexe`;
    blocs.push(t);
  }
  if (a.has('choses')) {
    const l = liste([oui(rc.vol, 'vol'), oui(rc.all_risk, 'all risk'), oui(rc.machines, 'machines'), oui(ac.technique, 'technique'), oui(ac.perte_exploit, "perte d'exploitation"),
      oui(rc.marchandises, 'marchandises'), oui(rc.transports, 'transports'), oui(rc.transports_speciaux, 'transports spéciaux')]);
    blocs.push(`- Inventaire / choses${ac.inventaire ? ` — somme d'assurance ${dxCHF(ac.inventaire)}` : ''}${l.length ? `\n  Risques : ${l.join(', ')}` : ''}`);
  }
  if (a.has('menage')) blocs.push(`- Ménage et RC privée${ac.inventaire ? ` — somme d'assurance ménage ${dxCHF(ac.inventaire)}` : ''}`);
  if (a.has('cyber')) blocs.push('- Cyber');
  if (a.has('construction')) blocs.push('- Construction & maître de l\'ouvrage');
  if (a.has('vie')) {
    const l = liste([oui(av.a3a, '3a'), oui(av.a3a_indep, '3a indépendant'), oui(av.a3b, '3b'), oui(av.risque_pure, 'risque pur'), oui(av.versement_unique, 'versement unique')]);
    blocs.push(`- Assurance vie : ${l.join(', ') || 'à définir'}${av.budget_epargne ? ` — budget ${dxCHF(av.budget_epargne)} par an` : ''}${av.pa ? `\n  Police existante : ${av.pa}` : ''}`);
  }
  if (a.has('pj')) {
    const l = liste([oui(pj.privee, 'privée'), oui(pj.circulation, 'circulation'), oui(pj.professionnelle, 'entreprise')]);
    blocs.push(`- Protection juridique${l.length ? ' : ' + l.join(', ') : ''}`);
  }
  if (a.has('vehicules')) {
    blocs.push(`- Véhicules${d.vehicules.length ? ` :\n${d.vehicules.map(v => `  • ${[v.numero, v.modele].filter(Boolean).join(' — ')}`).join('\n')}` : ''}`);
  }
  const precisions = (document.getElementById('dx-precisions')?.value || '').trim();

  // Introduction et formule finale : texte validé par Jonathan le 06.08.2026 — ne pas modifier
  const paragraphes = [
    'Bonjour,\nPour le PA ci-dessous, et selon les questionnaires et divers documents en pièce jointe, je vous serai reconnaissant de bien vouloir me transmettre une offre :',
    `Client :\n${nomClient}`,
    coord,
    taille,
    `Couvertures souhaitées :\n\n${blocs.length ? blocs.join('\n') : '- Voir détails ci-dessous'}`,
    precisions ? `Précisions :\n${precisions}` : '',
    'Je peux rapidement vous fournir toute autre information utile.',
    'Tout en vous remerciant d’avance, je vous souhaite une agréable journée.',
    `${opAuteurDx()}\nAssurex Sàrl`,
  ].filter(Boolean);
  return { sujet: `Demande d'offre — ${nomClient}`, corps: paragraphes.join('\n\n'), nomClient };
}
function opAuteurDx() { return currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : ''; }

let _dxMinuterie = null;
function dxApercu() {
  clearTimeout(_dxMinuterie);
  _dxMinuterie = setTimeout(() => {
    const zone = document.getElementById('dx-apercu');
    if (!zone) return;
    const { sujet, corps } = dxCorpsEmail();
    zone.textContent = `Objet : ${sujet}\n\n${corps}`;
  }, 120);
}

// ── Enregistrer / envoyer / imprimer ────────────────────────────────────────────────────────
async function dxEnregistrer(avecMessage) {
  const body = construireBodyDemandeOffre();
  body.donnees.branches = [...window._dx.branches];
  body.donnees.precisions = (document.getElementById('dx-precisions')?.value || '').trim() || null;
  const ancienne = window._dx.existante;
  if (ancienne && ancienne.donnees && ancienne.donnees.recommandation) body.donnees.recommandation = ancienne.donnees.recommandation;
  if (!body.client_id && !body.prospect_nom) { showError('Indique le client ou le nom du prospect (étape 1).'); return null; }
  let id = document.getElementById('do-demande-offre-id')?.value || null;
  const res = id ? await dbPatch('demandes_offre', id, body) : await dbPost('demandes_offre', body);
  if (res && res.error) { showError('Enregistrement impossible : ' + errMsg(res)); return null; }
  const nouveau = !id;
  if (!id) id = res && res[0] ? res[0].id : null;
  if (!id) return null;
  if (!document.getElementById('do-demande-offre-id')) {
    const h = document.createElement('input'); h.type = 'hidden'; h.id = 'do-demande-offre-id'; h.value = id;
    document.querySelector('.dx')?.appendChild(h);
  }
  demandeOffreActiveId = id;
  window._dx.existante = { ...(ancienne || {}), id, donnees: body.donnees };
  if (typeof logAction === 'function') logAction(nouveau ? 'create_demande_offre' : 'update_demande_offre', 'demandes_offre', id, body.prospect_nom || 'Client existant');
  if (nouveau && body.opportunite_id) await ajouterLigneHistoriqueOpportunite(body.opportunite_id, `📝 Demande d'offre préparée (${[...window._dx.branches].map(b => DX_BRANCHES.find(x => x.id === b)?.label).filter(Boolean).join(', ') || 'couvertures à préciser'})`);
  if (avecMessage) showError('✓ Demande d’offre enregistrée.');
  return id;
}

async function dxEnvoyer() {
  const checked = [...document.querySelectorAll('.do-cie-checkbox:checked')];
  if (!window._dx.branches.size) { showError('Choisis au moins une couverture (étape 2).'); return; }
  if (!checked.length) { showError('Choisis au moins une compagnie (étape 3).'); document.querySelector('.dx-cies')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const id = await dxEnregistrer(false);
  if (!id) return;
  const cies = checked.map(el => (window._doContacts || []).find(c => c.id === el.value)).filter(Boolean);
  const { sujet, corps } = dxCorpsEmail();
  ouvrirApercuEmailDemandeOffre({ demandeOffreId: id, cies, emails: cies.map(c => c.email).filter(Boolean), sansEmail: cies.filter(c => !c.email).map(c => c.compagnie), sujet, corps });
}

function dxImprimer() {
  const { sujet, corps, nomClient } = dxCorpsEmail();
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${dxEsc(sujet)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#0E1B33;margin:0;padding:34px 40px;font-size:12.5px}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #113679;padding-bottom:12px;margin-bottom:22px}
    header img{height:34px} h1{font-size:21px;margin:0;color:#113679} .sous{color:#56627A;margin-top:4px}
    pre{font-family:inherit;white-space:pre-wrap;line-height:1.6;margin:0} @page{size:A4;margin:14mm}
  </style></head><body>
    <header><div><h1>Demande d'offre</h1><div class="sous">${dxEsc(nomClient)} · ${new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>${typeof ASSUREX_LOGO_B64 !== 'undefined' ? `<img src="${ASSUREX_LOGO_B64}" alt="Assurex"/>` : '<b>Assurex Sàrl</b>'}</header>
    <pre>${dxEsc(corps)}</pre>
    <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`;
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  if (!w) showError('Autorise les fenêtres pop-up pour afficher le PDF.');
}

function dxFormulaireDetaille() {
  window._doClassique = true;
  demandeOffreEnEditionId = document.getElementById('do-demande-offre-id')?.value || demandeOffreActiveId || null;
  const opp = document.getElementById('do-opportunite-id')?.value;
  if (!demandeOffreEnEditionId && opp) prefillDemandeOffreOpportuniteId = opp;
  const sel = document.getElementById('do-client');
  if (!demandeOffreEnEditionId && sel && sel.value) prefillDemandeOffreClientId = sel.value;
  renderView();
}
