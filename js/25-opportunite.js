// ═══ FICHE OPPORTUNITÉ AÉRÉE + CRÉATION RAPIDE + OFFRES / COMPARATEUR / RELANCES (19.09.2026) ═══
// Remplace l'écran « Modifier l'opportunité » (long formulaire) par une fiche de suivi :
//   - en haut : l'essentiel (client, stade cliquable, prime, commission, probabilité, échéance) ;
//   - la prochaine action, bien visible ;
//   - un fil unique (notes, appels, e-mails, tâches, offres, documents) avec saisie rapide + dictée ;
//   - les offres reçues par compagnie, le comparateur et la recommandation imprimable ;
//   - les relances des compagnies qui n'ont pas répondu.
// L'ancien formulaire complet reste accessible (« Tous les champs ») et reste le seul écran de la
// session RH. Aucune nouvelle table : les offres vivent dans demandes_offre.compagnies_envoi
// (entrées {compagnie_id, compagnie, email, envoye_le, statut, recue_le, prime, franchise,
// couverture, remarque, retenue, relance_le, nb_relances}).

const OP_STADES = ['Contact', 'Analyse', 'Proposition', 'Négociation', 'Gagné'];
const OP_STADE_COUL = { Contact: '#94A3B8', Analyse: '#38BDF8', Proposition: '#F59E0B', Négociation: '#A78BFA', Gagné: '#22C55E', Perdu: '#EF4444' };
// Probabilité proposée par stade — appliquée seulement si l'utilisateur ne l'a pas personnalisée
const OP_PROBA_STADE = { Contact: 10, Analyse: 25, Proposition: 50, Négociation: 75, Gagné: 100 };
const OP_DELAI_RELANCE_JOURS = 7;   // offre demandée sans réponse depuis X jours → à relancer
const OP_DELAI_DORMANTE_JOURS = 21; // opportunité ouverte sans aucune activité depuis X jours
const OP_OBJETS_RAPIDES = ['LPP', 'Perte de gain maladie', 'LAA / accidents', 'RC entreprise', '3e pilier', 'Ménage / RC privée', 'Véhicule', 'Santé complémentaire', 'Protection juridique', 'Hypothèque'];

window._opDemandes = window._opDemandes || {}; // demandes_offre par opportunité (chargées à l'ouverture)
window._opMode = window._opMode || 'note';

function opEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function opAuj() { return new Date().toISOString().slice(0, 10); }
function opJoursDepuis(d) { if (!d) return null; const a = new Date(opAuj()); const b = new Date(String(d).slice(0, 10)); return Math.round((a - b) / 86400000); }
function opPlusJours(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function opClient(o) { return o && o.client_id ? allClients.find(c => c.id === o.client_id) : null; }
function opNomClient(o) {
  const c = opClient(o);
  if (c) return estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim();
  return o && o.prospect_nom ? o.prospect_nom : '';
}
function opAuteur() { return currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : ''; }
function opMonAgentId(o) {
  const monAgent = currentUser ? allAgents.find(a => a.email === currentUser.email) : null;
  return (o && o.apporteur_id) || (monAgent ? monAgent.id : null) || (allAgents.find(a => a.role === 'signataire')?.id || null);
}

// Dernière activité connue (historique, sinon création) — sert aux relances « affaire qui dort »
function opDerniereActivite(o) {
  const dates = (Array.isArray(o.historique) ? o.historique : []).map(h => h.date).filter(Boolean);
  if (o.created_at) dates.push(o.created_at);
  return dates.sort().pop() || null;
}
function opEstDormante(o) {
  if (!o || o.stade === 'Gagné' || o.stade === 'Perdu') return false;
  const j = opJoursDepuis(opDerniereActivite(o));
  return j !== null && j >= OP_DELAI_DORMANTE_JOURS;
}
// Offres demandées restées sans réponse (entrées compagnies_envoi)
function opEntreeSansReponse(e) {
  if (!e || e.statut !== 'envoyée' || !e.envoye_le) return false;
  const ref = e.relance_le || e.envoye_le;
  return opJoursDepuis(ref) >= OP_DELAI_RELANCE_JOURS;
}

// ── Aiguillage de la route 'nouvelle-opportunite' ───────────────────────────────────────────
function viewOpportuniteRoute() {
  const rh = estRoleRH();
  const opp = opportuniteEnEditionId ? allOpportunites.find(o => o.id === opportuniteEnEditionId) : null;
  if (rh) return viewNouvelleOpportunite();
  if (opp) {
    window._oppFormulaireNouveau = false;
    if (window._oppFormulairePour === opp.id) return htmlBandeauRetourFiche(opp) + viewNouvelleOpportunite();
    return viewFicheOpportunite(opp);
  }
  if (window._oppFormulaireNouveau) return viewNouvelleOpportunite();
  return viewCreationRapideOpportunite();
}

function htmlBandeauRetourFiche(opp) {
  return `<div class="opx-retour-fiche"><span>✎ Mode « tous les champs »</span><button type="button" onclick="window._oppFormulairePour=null;opRafraichir()">← Revenir à la fiche sans enregistrer</button></div>`;
}

function opRafraichir() {
  if (currentView !== 'nouvelle-opportunite') return;
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = viewOpportuniteRoute();
}

function opModeFormulaire(id) {
  window._oppFormulairePour = id;
  opRafraichir();
  window.scrollTo({ top: 0 });
}

// ═══ CRÉATION RAPIDE (3 champs) ═══════════════════════════════════════════════════════════
function viewCreationRapideOpportunite() {
  const clientId = prefillOpportuniteClientId || window._opcClientId || null;
  prefillOpportuniteClientId = null;
  window._opcClientId = clientId;
  const c = clientId ? allClients.find(x => x.id === clientId) : null;
  const nom = c ? (estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`) : '';
  return `<div class="opc">
    <button type="button" class="opx-lien-retour" onclick="goBack()">← Retour</button>
    <div class="opc-carte">
      <div class="opc-tete">
        <div class="opc-icone">🎯</div>
        <div><h2>Nouvelle opportunité</h2><div class="opc-sous">Trois informations suffisent — le reste se complète sur la fiche.</div></div>
      </div>
      <div class="form-field opc-champ">
        <label class="form-label" for="opc-client-recherche">1 · Client ou prospect</label>
        <div style="position:relative">
          <input class="form-input" id="opc-client-recherche" autocomplete="off" placeholder="Nom du client, ou d'un nouveau prospect" value="${opEsc(nom)}"
            oninput="window._opcClientId=null;opcRecherche(this.value)" onfocus="opcRecherche(this.value)" onblur="setTimeout(()=>{const z=document.getElementById('opc-resultats');if(z)z.style.display='none'},180)"/>
          <div id="opc-resultats" class="opc-resultats" style="display:none"></div>
        </div>
        <div id="opc-client-etat" class="opc-etat">${c ? `✓ Client existant${c.ville ? ' · ' + opEsc(c.ville) : ''}` : ''}</div>
      </div>
      <div class="form-field opc-champ">
        <label class="form-label" for="opc-titre">2 · Objet</label>
        <input class="form-input" id="opc-titre" placeholder="Ex. LPP pour 6 collaborateurs" value="${opEsc((window._opcPrefill && window._opcPrefill.titre) || '')}"/>
        ${window._opcPrefill && window._opcPrefill.montant ? `<div class="opc-etat">Depuis le dossier de conseil : ${opEsc(window._opcPrefill.produit || '')} · prime estimée CHF ${fmtCHF(Math.round(window._opcPrefill.montant))}/an</div>` : ''}
        <div class="opc-puces">${OP_OBJETS_RAPIDES.map(t => `<button type="button" onclick="opcObjet(this)">${opEsc(t)}</button>`).join('')}</div>
      </div>
      <div class="form-field opc-champ">
        <label class="form-label" for="opc-date">3 · Échéance visée <span style="font-weight:400;color:var(--text-dim)">(facultatif)</span></label>
        <input class="form-input" id="opc-date" type="date" style="max-width:220px"/>
        <div class="opc-puces">${[['Dans 2 semaines', 14], ['Dans 1 mois', 30], ['Dans 3 mois', 91], ['Au 1er janvier', null]].map(([l, n]) => `<button type="button" onclick="document.getElementById('opc-date').value='${n === null ? (new Date().getFullYear() + 1) + '-01-01' : opPlusJours(n)}'">${l}</button>`).join('')}</div>
      </div>
      <div id="opc-erreur" class="opc-erreur" style="display:none"></div>
      <div class="opc-actions">
        <button type="button" class="opx-lien" onclick="opcFormulaireComplet()">Formulaire complet (produits, primes…)</button>
        <button type="button" class="btn-save" id="opc-btn" onclick="opcCreer()">Créer et ouvrir la fiche →</button>
      </div>
    </div>
  </div>`;
}

function opcRecherche(texte) {
  const zone = document.getElementById('opc-resultats');
  if (!zone) return;
  const q = _cleRechercheSansAccents(texte || '');
  const nomC = c => estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
  const res = q ? allClients.filter(c => _cleRechercheSansAccents(nomC(c)).includes(q)).slice(0, 7) : [];
  const etat = document.getElementById('opc-client-etat');
  if (etat && !window._opcClientId) etat.textContent = texte && texte.trim() ? '🆕 Sera enregistré comme prospect (tu pourras créer sa fiche client plus tard).' : '';
  if (!q) { zone.style.display = 'none'; return; }
  zone.innerHTML = res.map(c => `<button type="button" onmousedown="opcChoisirClient('${c.id}')"><strong>${opEsc(nomC(c))}</strong><span>${estEntreprise(c) ? 'Entreprise' : 'Privé'}${c.ville ? ' · ' + opEsc(c.ville) : ''}</span></button>`).join('')
    + `<button type="button" class="opc-prospect" onmousedown="document.getElementById('opc-resultats').style.display='none'">🆕 Nouveau prospect : « ${opEsc(texte.trim())} »</button>`;
  zone.style.display = 'block';
}

function opcChoisirClient(id) {
  const c = allClients.find(x => x.id === id);
  if (!c) return;
  window._opcClientId = id;
  document.getElementById('opc-client-recherche').value = estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
  document.getElementById('opc-resultats').style.display = 'none';
  const etat = document.getElementById('opc-client-etat');
  if (etat) etat.textContent = `✓ Client existant${c.ville ? ' · ' + c.ville : ''}`;
  document.getElementById('opc-titre')?.focus();
}

function opcObjet(btn) {
  const champ = document.getElementById('opc-titre');
  if (!champ) return;
  champ.value = champ.value.trim() ? `${champ.value.trim()} + ${btn.textContent}` : btn.textContent;
  champ.focus();
}

function opcFormulaireComplet() {
  prefillOpportuniteClientId = window._opcClientId || null;
  window._opcClientId = null;
  window._oppFormulaireNouveau = true;
  opRafraichir();
}

async function opcCreer() {
  const pre = window._opcPrefill; window._opcPrefill = null; // repris du dossier de conseil (js/47), utilisé une seule fois
  const err = document.getElementById('opc-erreur');
  const montrer = t => { if (err) { err.textContent = t; err.style.display = ''; } };
  const clientId = window._opcClientId || null;
  const saisieNom = (document.getElementById('opc-client-recherche')?.value || '').trim();
  let titre = (document.getElementById('opc-titre')?.value || '').trim();
  if (!clientId && !saisieNom) { montrer('Indique le client ou le nom du prospect.'); return; }
  if (!titre) { montrer("Indique l'objet de l'opportunité (ex. LPP, RC entreprise…)."); return; }
  const btn = document.getElementById('opc-btn');
  if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Création…'; }
  const nomPourTitre = clientId ? saisieNom : saisieNom;
  if (nomPourTitre && !titre.toLowerCase().includes(nomPourTitre.toLowerCase())) titre = `${titre} — ${nomPourTitre}`;
  const body = {
    titre,
    client_id: clientId,
    prospect_nom: clientId ? null : saisieNom,
    stade: 'Contact',
    probabilite: OP_PROBA_STADE.Contact,
    date_echeance: document.getElementById('opc-date')?.value || null,
    apporteur_id: opMonAgentId(null),
    produits: [], produits_primes: {}, montant_potentiel: 0, commission_estimee: 0,
    historique: [{ texte: '✨ Opportunité créée', date: new Date().toISOString(), auteur: opAuteur() }],
  };
  const r = await dbPost('opportunites', body);
  if (r && r.error) { montrer('Création impossible : ' + errMsg(r)); if (btn) { btn.disabled = false; btn.textContent = 'Créer et ouvrir la fiche →'; } return; }
  allOpportunites = await dbGet('opportunites', 'select=*');
  const id = (Array.isArray(r) && r[0] && r[0].id) || null;
  window._opcClientId = null;
  if (!id) { navigate('opportunites'); return; }
  opportuniteEnEditionId = id;
  opRafraichir();
  if (typeof verifierProchaineAction === 'function') verifierProchaineAction(id);
}

// ═══ LA FICHE ═══════════════════════════════════════════════════════════════════════════════
function viewFicheOpportunite(o) {
  const c = opClient(o);
  const nom = opNomClient(o) || 'Sans client';
  const ferme = o.stade === 'Gagné' || o.stade === 'Perdu';
  const pondere = Math.round((o.montant_potentiel || 0) * (o.probabilite || 0) / 100);
  const creeLe = o.created_at ? fmtDate(o.created_at) : '';
  const tel = c ? (c.mobile || c.tel || '') : '';
  const email = c ? (c.email || '') : '';
  setTimeout(() => opChargerDemandes(o.id), 0);

  const etapes = OP_STADES.map((s, i) => {
    const idxActuel = OP_STADES.indexOf(o.stade);
    const etat = o.stade === s ? 'actif' : (idxActuel > i ? 'passe' : '');
    return `<button type="button" class="opx-etape ${etat}" style="--c:${OP_STADE_COUL[s]}" onclick="opChangerStade('${o.id}','${s}')" ${o.stade === s ? 'aria-current="step"' : ''}>
      <span class="opx-etape-point">${idxActuel > i ? '✓' : i + 1}</span><span class="opx-etape-nom">${s}</span></button>`;
  }).join('<span class="opx-etape-trait" aria-hidden="true"></span>');

  return `<div class="opx">
  <button type="button" class="opx-lien-retour" onclick="opportuniteEnEditionId=null;goBack()">← Retour</button>
  <section class="fcx-hero opx-hero">
    <div class="fcx-hero-deco" aria-hidden="true"></div>
    <div class="fcx-hero-haut">
      <div class="opx-identite">
        <div class="fcx-surtitre">Opportunité${creeLe ? ' · ouverte le ' + creeLe : ''}${o.cree_par ? ' · créée par ' + opEsc(o.cree_par) : ''}</div>
        <input class="opx-titre" value="${opEsc(o.titre)}" aria-label="Titre de l'opportunité" onchange="opMaj('${o.id}','titre',this.value.trim())"/>
        <div class="fcx-contacts">
          ${c ? `<button type="button" class="fcx-chip" onclick="showClient('${c.id}')">${estEntreprise(c) ? '🏢' : '👤'} ${opEsc(nom)} →</button>`
              : `<span class="fcx-chip">🆕 ${opEsc(nom)} · prospect</span><button type="button" class="fcx-chip" onclick="opModeFormulaire('${o.id}');setTimeout(()=>typeof ouvrirCreationClientDepuisOpportunite==='function'&&ouvrirCreationClientDepuisOpportunite(),60)">➕ Créer la fiche client</button>`}
          ${tel ? `<a class="fcx-chip" href="tel:${opEsc(tel.replace(/\s/g, ''))}">📞 ${opEsc(tel)}</a>` : ''}
          ${email ? `<a class="fcx-chip" href="mailto:${opEsc(email)}">✉️ ${opEsc(email)}</a>` : ''}
          ${o.compagnie ? `<span class="fcx-chip">${typeof pictoCompagnie === 'function' ? pictoCompagnie(o.compagnie, 18) : ''} ${opEsc(o.compagnie)}</span>` : ''}
        </div>
      </div>
      <div class="fcx-actions">
        <div class="fcx-actions-principales">
          <button type="button" class="fcx-btn-blanc" onclick="opNouvelleDemandeOffre('${o.id}')">📝 Demande d'offre</button>
          <button type="button" class="fcx-btn-verre" onclick="opModeFormulaire('${o.id}')">✎ Tous les champs</button>
        </div>
        <div class="fcx-actions-menus">
          <button type="button" onclick="opComparer('${o.id}')">⚖️ Comparer les offres</button>
          ${typeof pafGenererLettreResiliation === 'function' ? `<button type="button" onclick="pafGenererLettreResiliation('${o.id}')" title="Lettre de résiliation de l’ancien contrat : compagnie, membres de la famille, polices, délai">📝 Résiliation</button>` : ''}
          <button type="button" onclick="opChangerStade('${o.id}','Perdu')">✕ Perdue</button>
          <button type="button" onclick="supprimerOpportunite('${o.id}')">🗑️ Supprimer</button>
        </div>
      </div>
    </div>
    <div class="opx-etapes" role="list" aria-label="Stade">${etapes}</div>
    <div class="opx-kpis">
      <div class="opx-kpi"><span>Prime annuelle</span><b>CHF ${fmtCHF(o.montant_potentiel || 0)}</b></div>
      <div class="opx-kpi"><span>Commission estimée</span><b>CHF ${fmtCHF(Math.round(o.commission_estimee || 0))}</b></div>
      <div class="opx-kpi"><span>Probabilité · pondéré CHF ${fmtCHF(pondere)}</span>
        <div class="opx-proba"><input type="range" min="0" max="100" step="5" value="${o.probabilite ?? 50}" aria-label="Probabilité" oninput="this.nextElementSibling.textContent=this.value+' %'" onchange="opMaj('${o.id}','probabilite',parseInt(this.value))"/><b>${o.probabilite ?? 50} %</b></div></div>
      <div class="opx-kpi"><span>Échéance${o.date_echeance && opJoursDepuis(o.date_echeance) > 0 && !ferme ? ' · <em>dépassée</em>' : ''}</span>
        <input type="date" class="opx-date" value="${o.date_echeance || ''}" aria-label="Échéance" onchange="opMaj('${o.id}','date_echeance',this.value||null)"/></div>
    </div>
  </section>

  ${o.stade === 'Perdu' ? `<div class="opx-bandeau opx-bandeau-perdu">✕ Opportunité perdue${o.motif_perte ? ' — ' + opEsc(o.motif_perte) : ''}. <button type="button" onclick="opChangerStade('${o.id}','Contact')">Rouvrir</button></div>` : ''}
  ${o.stade === 'Gagné' ? `<div class="opx-bandeau opx-bandeau-gagne">🎉 Opportunité gagnée${o.contrat_id ? ' · contrat relié' : ''}. ${o.contrat_id ? '' : `<button type="button" onclick="proposerActionApresGain(allOpportunites.find(x=>x.id==='${o.id}'))">Créer / relier le contrat</button>`}</div>` : ''}

  <div class="opx-grille">
    <div class="opx-col">
      ${ferme ? '' : htmlProchaineActionFiche(o)}
      <section class="dbx-carte opx-carte">
        <div class="dbx-carte-tete"><h3 class="opx-h3">Fil de l'affaire</h3>
          <button type="button" class="dbx-lien" onclick="opChercherEmails('${o.id}')">🔍 E-mails Outlook</button></div>
        ${htmlComposeurOpportunite(o)}
        <div id="opp-emails-detectes" class="opx-emails"></div>
        ${htmlTachesOuvertesFiche(o)}
        <div id="opx-fil" class="opx-fil">${htmlFilOpportunite(o)}</div>
      </section>
    </div>
    <div class="opx-col">
      <section class="dbx-carte opx-carte">
        <div class="dbx-carte-tete"><h3 class="opx-h3">Offres des compagnies</h3>
          <button type="button" class="dbx-lien" onclick="opSaisirOffre('${o.id}',null,null)">+ Offre reçue</button></div>
        <div id="opx-offres"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
      </section>
      <section class="dbx-carte opx-carte">
        <div class="dbx-carte-tete"><h3 class="opx-h3">Produits envisagés</h3>
          <button type="button" class="dbx-lien" onclick="opModeFormulaire('${o.id}')">Modifier</button></div>
        ${htmlProduitsFiche(o)}
      </section>
      <section class="dbx-carte opx-carte">
        <div class="dbx-carte-tete"><h3 class="opx-h3">Notes</h3><span class="dbx-carte-sous" id="opx-notes-etat">Enregistrement automatique</span></div>
        <textarea class="form-input opx-notes" id="opx-notes" rows="4" placeholder="Contexte, besoins, concurrents, budget…" onchange="opMaj('${o.id}','notes',this.value||null,'opx-notes-etat')">${opEsc(o.notes || '')}</textarea>
      </section>
      <section class="dbx-carte opx-carte">
        <div class="dbx-carte-tete"><h3 class="opx-h3">Documents</h3></div>
        ${renderPiecesJointesOpportunite(o)}
      </section>
    </div>
  </div>

  <nav class="opx-barre-mobile" aria-label="Actions rapides">
    ${tel ? `<a href="tel:${opEsc(tel.replace(/\s/g, ''))}">📞<span>Appeler</span></a>` : `<button type="button" onclick="opChoisirMode('appel');document.getElementById('opx-saisie')?.focus()">📞<span>Appel</span></button>`}
    <button type="button" onclick="opChoisirMode('note');opDicter('opx-saisie')">🎤<span>Dicter</span></button>
    <button type="button" onclick="opChoisirMode('tache');document.getElementById('opx-saisie')?.focus()">✅<span>Tâche</span></button>
    <button type="button" onclick="opNouvelleDemandeOffre('${o.id}')">📝<span>Offre</span></button>
  </nav>
</div>`;
}

// ── Prochaine action (grande carte) ─────────────────────────────────────────────────────────
function htmlProchaineActionFiche(o) {
  const pa = typeof prochaineAction === 'function' ? prochaineAction(o.id) : null;
  if (!pa) {
    return `<button type="button" class="opx-pa opx-pa-vide" onclick="ouvrirModaleProchaineAction('${o.id}')">
      <span class="opx-pa-icone">➜</span><span class="opx-pa-corps"><b>Aucune prochaine action</b><small>Planifie l'étape suivante pour que l'affaire ne s'endorme pas.</small></span><span class="opx-pa-cta">Définir</span></button>`;
  }
  const j = pa.date_echeance ? -opJoursDepuis(pa.date_echeance) : null;
  const quand = j === null ? 'Sans date' : j < 0 ? `En retard de ${-j} j` : j === 0 ? "Aujourd'hui" : j === 1 ? 'Demain' : `Dans ${j} j · ${fmtDate(pa.date_echeance)}`;
  return `<div class="opx-pa ${j !== null && j < 0 ? 'retard' : ''}">
    <span class="opx-pa-icone">➜</span>
    <span class="opx-pa-corps"><small>Prochaine action · ${quand}</small><b>${opEsc(pa.titre)}</b></span>
    <span class="opx-pa-boutons">
      <button type="button" onclick="opReporterTache('${pa.id}',1)" title="Reporter au jour ouvré suivant">+1 j</button>
      <button type="button" onclick="opReporterTache('${pa.id}',5)" title="Reporter d'une semaine">+1 sem</button>
      <button type="button" class="ok" onclick="toggleTacheOpportunite('${pa.id}', true)">✓ Fait</button>
    </span>
  </div>`;
}

async function opReporterTache(id, joursOuvres) {
  const nouvelle = typeof paJoursOuvresPlus === 'function' ? paJoursOuvresPlus(joursOuvres) : opPlusJours(joursOuvres);
  const r = await dbPatch('rappels', id, { date_echeance: nouvelle });
  if (r && r.error) { showError('Report impossible : ' + errMsg(r)); return; }
  const t = allRappels.find(x => x.id === id);
  if (t) t.date_echeance = nouvelle;
  showError(`✓ Reporté au ${fmtDate(nouvelle)}.`);
  opRafraichir();
}

// ── Saisie rapide dans le fil ───────────────────────────────────────────────────────────────
const OP_MODES = [
  { id: 'note', icone: '📝', label: 'Note', ph: 'Ce qui s’est dit, ce qu’il faut retenir…', prefixe: '📝 ' },
  { id: 'appel', icone: '📞', label: 'Appel', ph: 'Résumé de l’appel…', prefixe: '📞 Appel : ' },
  { id: 'email', icone: '✉️', label: 'E-mail', ph: 'E-mail envoyé ou reçu…', prefixe: '✉️ E-mail : ' },
  { id: 'tache', icone: '✅', label: 'Tâche', ph: 'Ce qu’il faut faire (ex. Relancer pour signature)…' },
];

function htmlComposeurOpportunite(o) {
  const m = OP_MODES.find(x => x.id === window._opMode) || OP_MODES[0];
  const dicteeOk = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  return `<div class="opx-composeur" data-mode="${m.id}">
    <div class="opx-modes" role="tablist">${OP_MODES.map(x => `<button type="button" role="tab" aria-selected="${x.id === m.id}" class="${x.id === m.id ? 'actif' : ''}" onclick="opChoisirMode('${x.id}')">${x.icone} ${x.label}</button>`).join('')}</div>
    <div class="opx-saisie-ligne">
      <textarea id="opx-saisie" class="form-input" rows="2" placeholder="${opEsc(m.ph)}" onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();opEnvoyerSaisie('${o.id}')}"></textarea>
      ${dicteeOk ? `<button type="button" class="opx-micro" id="opx-micro" title="Dicter" aria-label="Dicter" onclick="opDicter('opx-saisie')">🎤</button>` : ''}
    </div>
    <div class="opx-saisie-bas">
      <div class="opx-date-tache" ${m.id === 'tache' ? '' : 'hidden'}>
        <input type="date" id="opx-tache-date" class="form-input" value="${typeof paJoursOuvresPlus === 'function' ? paJoursOuvresPlus(1) : opPlusJours(1)}" aria-label="Échéance de la tâche"/>
        ${[['Demain', 1], ['+3 j', 3], ['+1 sem', 5]].map(([l, n]) => `<button type="button" onclick="document.getElementById('opx-tache-date').value='${typeof paJoursOuvresPlus === 'function' ? paJoursOuvresPlus(n) : opPlusJours(n)}'">${l}</button>`).join('')}
      </div>
      <button type="button" class="btn-save opx-ajouter" id="opx-btn-ajouter" onclick="opEnvoyerSaisie('${o.id}')">Ajouter</button>
    </div>
  </div>`;
}

function opChoisirMode(mode) {
  window._opMode = mode;
  const comp = document.querySelector('.opx-composeur');
  if (!comp) return;
  const m = OP_MODES.find(x => x.id === mode) || OP_MODES[0];
  comp.dataset.mode = mode;
  comp.querySelectorAll('.opx-modes button').forEach((b, i) => { const on = OP_MODES[i].id === mode; b.classList.toggle('actif', on); b.setAttribute('aria-selected', on); });
  const zone = comp.querySelector('.opx-date-tache');
  if (zone) zone.hidden = mode !== 'tache';
  const champ = document.getElementById('opx-saisie');
  if (champ) champ.placeholder = m.ph;
}

async function opEnvoyerSaisie(oppId) {
  const champ = document.getElementById('opx-saisie');
  const texte = (champ?.value || '').trim();
  if (!texte) { champ?.focus(); return; }
  const btn = document.getElementById('opx-btn-ajouter');
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  const mode = window._opMode || 'note';
  if (mode === 'tache') {
    const date = document.getElementById('opx-tache-date')?.value || null;
    const ok = await opCreerTache(oppId, texte, date);
    if (btn) btn.disabled = false;
    if (ok) opRafraichir();
    return;
  }
  const m = OP_MODES.find(x => x.id === mode) || OP_MODES[0];
  await ajouterLigneHistoriqueOpportunite(oppId, m.prefixe + texte);
  opRafraichir();
}

async function opCreerTache(oppId, titre, date) {
  const o = allOpportunites.find(x => x.id === oppId);
  const body = {
    titre, nature: 'tache', type: 'Opportunité',
    client_id: o ? (o.client_id || null) : null,
    opportunite_id: oppId,
    apporteur_id: opMonAgentId(o),
    date_echeance: date || null,
    urgence: date && opJoursDepuis(date) >= -1 ? 'haute' : 'moyenne',
    statut: 'ouvert',
  };
  const r = await dbPost('rappels', body);
  if (r && r.error) { showError('Tâche non créée : ' + errMsg(r)); return false; }
  if (r && r[0] && r[0].id && date && typeof createOutlookEventFromRappel === 'function') {
    try { const ev = await createOutlookEventFromRappel(r[0]); if (ev) await dbPatch('rappels', r[0].id, { outlook_event_id: ev }); } catch (e) { /* resynchronisable depuis Tâches & rappels */ }
  }
  allRappels = await dbGet('rappels', 'select=*');
  showError(`✓ Tâche ajoutée${date ? ' pour le ' + fmtDate(date) : ''}.`);
  return true;
}

// Dictée vocale (Safari iOS / Chrome) — une pression, on parle, le texte arrive dans le champ
function opDicter(champId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const champ = document.getElementById(champId);
  if (!champ) return;
  if (!SR) { champ.focus(); showError('Dictée non disponible ici — utilise le micro 🎤 du clavier de ton téléphone.'); return; }
  if (window._opReco) { try { window._opReco.stop(); } catch (e) {} window._opReco = null; return; }
  const reco = new SR();
  reco.lang = 'fr-CH'; reco.interimResults = true; reco.continuous = false;
  const base = champ.value ? champ.value.trim() + ' ' : '';
  const micro = document.getElementById('opx-micro');
  micro?.classList.add('ecoute');
  reco.onresult = ev => { champ.value = base + [...ev.results].map(r => r[0].transcript).join(''); };
  reco.onend = () => { micro?.classList.remove('ecoute'); window._opReco = null; };
  reco.onerror = () => { micro?.classList.remove('ecoute'); window._opReco = null; };
  window._opReco = reco;
  reco.start();
}

async function opChercherEmails(oppId) {
  const zone = document.getElementById('opp-emails-detectes');
  if (zone) zone.classList.add('ouvert');
  await rechercherEmailsOpportunite(oppId);
}

// ── Tâches ouvertes (au-dessus du fil) ──────────────────────────────────────────────────────
function htmlTachesOuvertesFiche(o) {
  const pa = typeof prochaineAction === 'function' ? prochaineAction(o.id) : null;
  const taches = allRappels.filter(r => r.opportunite_id === o.id && r.statut === 'ouvert' && (!pa || r.id !== pa.id))
    .sort((a, b) => (a.date_echeance || '9999').localeCompare(b.date_echeance || '9999'));
  if (!taches.length) return '';
  return `<div class="opx-taches"><div class="dbx-groupe-titre">Aussi à faire</div>${taches.map(t => {
    const j = t.date_echeance ? -opJoursDepuis(t.date_echeance) : null;
    return `<label class="opx-tache"><input type="checkbox" onchange="toggleTacheOpportunite('${t.id}', true)"/><span>${opEsc(t.titre)}</span>${t.date_echeance ? `<em class="${j < 0 ? 'retard' : ''}">${fmtDate(t.date_echeance)}</em>` : ''}</label>`;
  }).join('')}</div>`;
}

// ── Le fil unique ───────────────────────────────────────────────────────────────────────────
function opIconeHisto(t) {
  const m = String(t || '').match(/^(\p{Extended_Pictographic}️?|✓|➜|★)/u);
  return m ? m[0] : '•';
}

function htmlFilOpportunite(o) {
  const items = [];
  (Array.isArray(o.historique) ? o.historique : []).forEach((h, i) => {
    const icone = opIconeHisto(h.texte);
    const texte = String(h.texte || '').replace(/^(\p{Extended_Pictographic}️?|✓|➜|★)\s*/u, '');
    items.push({ date: h.date || '', icone, texte, auteur: h.auteur, supprimer: i });
  });
  (window._opDemandes[o.id] || []).forEach(d => {
    (Array.isArray(d.compagnies_envoi) ? d.compagnies_envoi : []).forEach(e => {
      // 22.09.2026 : la synchro Outlook (js/04) et le kanban (js/16) écrivaient « recu_le » —
      // on lit les deux noms pour que les offres déjà enregistrées ainsi restent visibles.
      const recueLe = e.recue_le;
      if (recueLe) items.push({ date: recueLe, icone: '📥', texte: `Offre reçue de ${e.compagnie}${e.prime ? ' — CHF ' + fmtCHF(e.prime) + '/an' : ''}` });
      if (e.relance_le) items.push({ date: e.relance_le, icone: '🔔', texte: `Relance envoyée à ${e.compagnie}` });
    });
  });
  (Array.isArray(o.pieces_jointes) ? o.pieces_jointes : []).forEach(f => {
    if (f.uploaded_at) items.push({ date: f.uploaded_at, icone: '📎', texte: `Document ajouté : ${f.nom}`, auteur: f.uploaded_par });
  });
  const dejaCreee = items.some(x => /Opportunité créée/.test(x.texte));
  if (o.created_at && !dejaCreee) items.push({ date: o.created_at, icone: '✨', texte: 'Opportunité créée', auteur: o.cree_par });
  items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!items.length) return '<div class="dbx-vide-petit">Rien encore — ajoute une note ou un appel ci-dessus.</div>';
  let jourPrec = '';
  return items.map(it => {
    const jour = String(it.date).slice(0, 10);
    const sep = jour !== jourPrec ? `<div class="opx-fil-jour">${opLibelleJour(jour)}</div>` : '';
    jourPrec = jour;
    return `${sep}<div class="opx-fil-item">
      <span class="opx-fil-icone">${it.icone}</span>
      <div class="opx-fil-texte">${opEsc(it.texte)}${it.auteur ? `<small>${opEsc(it.auteur)}${String(it.date).length > 10 ? ' · ' + new Date(it.date).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : ''}</small>` : ''}</div>
      ${it.supprimer !== undefined ? `<button type="button" class="opx-fil-suppr" title="Retirer" aria-label="Retirer" onclick="opSupprimerHisto('${o.id}',${it.supprimer})">✕</button>` : ''}
    </div>`;
  }).join('');
}

function opLibelleJour(jour) {
  if (!jour) return 'Sans date';
  const j = opJoursDepuis(jour);
  if (j === 0) return "Aujourd'hui";
  if (j === 1) return 'Hier';
  return new Date(jour).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: j > 300 ? 'numeric' : undefined });
}

async function opSupprimerHisto(oppId, index) {
  if (!confirm('Retirer cette ligne du fil ?')) return;
  await supprimerLigneHistoriqueOpportunite(oppId, index);
  opRafraichir();
}

// ── Produits ────────────────────────────────────────────────────────────────────────────────
function htmlProduitsFiche(o) {
  const produits = Array.isArray(o.produits) ? o.produits : [];
  if (!produits.length) return `<div class="dbx-vide-petit">Aucun produit choisi. <button type="button" class="dbx-lien" onclick="opModeFormulaire('${o.id}')">Ajouter les produits et primes →</button></div>`;
  const primes = o.produits_primes || {};
  const mensuel = id => typeof PRODUITS_SANTE_COMPAGNIE_INDEPENDANTE !== 'undefined' && PRODUITS_SANTE_COMPAGNIE_INDEPENDANTE.includes(id);
  return `<div class="opx-produits">${produits.map(id => `<div class="opx-produit"><span>${opEsc(typeof produitLabelParId === 'function' ? produitLabelParId(id) : id)}</span><b>${primes[id] ? 'CHF ' + fmtCHF(primes[id]) + (mensuel(id) ? '/mois' : '/an') : '<em>prime ?</em>'}</b></div>`).join('')}</div>`;
}

// ── Mises à jour en place ───────────────────────────────────────────────────────────────────
async function opMaj(id, champ, valeur, etatId) {
  const o = allOpportunites.find(x => x.id === id);
  if (!o) return;
  if (champ === 'titre' && !valeur) { showError('Le titre ne peut pas être vide.'); opRafraichir(); return; }
  const etat = etatId ? document.getElementById(etatId) : null;
  if (etat) etat.textContent = 'Enregistrement…';
  const r = await dbPatch('opportunites', id, { [champ]: valeur });
  if (r && r.error) { showError('Non enregistré : ' + errMsg(r)); if (etat) etat.textContent = '⚠ Non enregistré'; return; }
  o[champ] = valeur;
  if (etat) etat.textContent = '✓ Enregistré';
  if (champ === 'probabilite' || champ === 'date_echeance') opRafraichir();
}

async function opChangerStade(id, stade) {
  const o = allOpportunites.find(x => x.id === id);
  if (!o || o.stade === stade) return;
  const ancien = o.stade;
  const probaAncienne = o.probabilite;
  await changerStadeOpportuniteRapide(id, stade);
  if (o.stade !== stade) return; // Perdu (modale de motif) ou erreur
  // Probabilité : suit le stade tant qu'elle n'a pas été personnalisée
  const defautAncien = OP_PROBA_STADE[ancien];
  if (OP_PROBA_STADE[stade] !== undefined && (probaAncienne == null || probaAncienne === defautAncien || probaAncienne === 50 || ancien === 'Perdu')) {
    const p = OP_PROBA_STADE[stade];
    const r = await dbPatch('opportunites', id, { probabilite: p });
    if (!(r && r.error)) o.probabilite = p;
  }
  await ajouterLigneHistoriqueOpportunite(id, `🔀 Stade : ${ancien || '—'} → ${stade}`);
  opRafraichir();
}

// ═══ OFFRES PAR COMPAGNIE ══════════════════════════════════════════════════════════════════
async function opChargerDemandes(oppId) {
  const rows = await dbGet('demandes_offre', `opportunite_id=eq.${oppId}&select=*&order=created_at.desc`);
  window._opDemandes[oppId] = Array.isArray(rows) ? rows : [];
  const zone = document.getElementById('opx-offres');
  const o = allOpportunites.find(x => x.id === oppId);
  if (zone) zone.innerHTML = htmlOffresOpportunite(oppId);
  const fil = document.getElementById('opx-fil');
  if (fil && o) fil.innerHTML = htmlFilOpportunite(o);
  // 22.09.2026 : le bandeau « ce qu'il reste à faire » (js/90) est calculé avant ce chargement ;
  // on le repeint maintenant que les offres sont connues, sinon il reste sur « vérification ».
  if (typeof pafRepeindreBandeau === 'function') pafRepeindreBandeau(oppId);
}

function opToutesEntrees(oppId) {
  const res = [];
  (window._opDemandes[oppId] || []).forEach(d => (Array.isArray(d.compagnies_envoi) ? d.compagnies_envoi : []).forEach((e, idx) => res.push({ d, e, idx })));
  return res;
}

function opStatutOffre(e) {
  if (e.retenue) return { cls: 'retenue', txt: '★ Retenue' };
  if (e.statut === 'déclinée') return { cls: 'declinee', txt: 'Déclinée' };
  if (e.recue_le || e.statut === 'reçue') return { cls: 'recue', txt: 'Reçue' }; // 22.09.2026 : ancien nom recu_le toléré
  const j = opJoursDepuis(e.relance_le || e.envoye_le);
  if (opEntreeSansReponse(e)) return { cls: 'relancer', txt: `Sans réponse · ${opJoursDepuis(e.envoye_le)} j` };
  return { cls: 'attente', txt: e.envoye_le ? `Envoyée ${j === 0 ? "aujourd'hui" : 'il y a ' + j + ' j'}` : 'À envoyer' };
}

function htmlOffresOpportunite(oppId) {
  const demandes = window._opDemandes[oppId] || [];
  const entrees = opToutesEntrees(oppId);
  const derniere = demandes[0];
  const actions = `<div class="opx-offres-actions">
    <button type="button" class="btn-secondary" onclick="opNouvelleDemandeOffre('${oppId}')">📝 ${demandes.length ? 'Nouvelle demande' : "Demander des offres"}</button>
    ${derniere ? `<button type="button" class="btn-secondary" onclick="demandeOffreEnEditionId='${derniere.id}';navigate('nouvelle-demande-offre')">↺ Reprendre la demande du ${fmtDate(derniere.created_at)}</button>` : ''}
    <button type="button" class="btn-secondary" onclick="opSaisirOffre('${oppId}',null,null)" title="Offre reçue d'une compagnie (y compris non sollicitée) : compagnie, prime et PDF">📎 Uploader une offre</button>
  </div>`;
  if (!entrees.length) {
    return `<div class="dbx-vide-petit">${demandes.length ? 'Demande enregistrée, pas encore envoyée aux compagnies.' : "Aucune offre demandée pour l'instant."}</div>${actions}`;
  }
  const recues = entrees.filter(x => x.e.prime);
  const minPrime = recues.length ? Math.min(...recues.map(x => Number(x.e.prime))) : null;
  return `<div class="opx-offres">${entrees.map(({ d, e, idx }) => {
    const st = opStatutOffre(e);
    const meilleur = e.prime && minPrime !== null && Number(e.prime) === minPrime && recues.length > 1;
    return `<div class="opx-offre ${st.cls}">
      <span class="opx-offre-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(e.compagnie, 34) : ''}</span>
      <div class="opx-offre-corps">
        <b>${opEsc(e.compagnie || '—')}</b>
        <span class="opx-offre-statut ${st.cls}">${st.txt}</span>
        ${e.prime ? `<div class="opx-offre-prime">CHF ${fmtCHF(e.prime)}<small>/an</small>${meilleur ? '<em>Meilleur prix</em>' : ''}</div>` : ''}
        ${e.franchise || e.couverture ? `<div class="opx-offre-details">${e.franchise ? 'Franchise ' + opEsc(e.franchise) : ''}${e.franchise && e.couverture ? ' · ' : ''}${opEsc(e.couverture || '')}</div>` : ''}
      </div>
      <div class="opx-offre-boutons">
        ${st.cls === 'relancer' || st.cls === 'attente' ? `<button type="button" onclick="opRelancerCompagnie('${d.id}',${idx})">🔔 Relancer</button>` : ''}
        ${e.offre_path
          ? `<button type="button" onclick="ouvrirPieceJointe('${e.offre_path}')" title="${opEsc(e.offre_nom || 'Offre PDF')}">📄 Voir l'offre</button>`
          : `<label class="opx-joindre" title="Joindre le PDF de l'offre (10 Mo max.)">📎 Joindre l'offre<input type="file" accept="application/pdf" hidden onchange="opJoindreOffre('${oppId}','${d.id}',${idx},this)"/></label>`}
        <button type="button" onclick="opSaisirOffre('${oppId}','${d.id}',${idx})">${e.prime || e.recue_le ? '✎' : '📥 Offre reçue'}</button>
        ${(e.prime || e.recue_le) && e.statut !== 'déclinée' && typeof opSigneeVersContrat === 'function' ? `<button type="button" class="opx-offre-signee" onclick="opSigneeVersContrat('${oppId}','${d.id}',${idx})" title="Déposer la ou les polices, passer l’opportunité en Gagné et créer le contrat">✍️ Signée → contrat</button>` : ''}
      </div>
    </div>`;
  }).join('')}</div>
  ${recues.length ? `<button type="button" class="opx-comparer" onclick="opComparer('${oppId}')">⚖️ Comparer ${recues.length} offre${recues.length > 1 ? 's' : ''} et préparer la recommandation</button>` : ''}
  ${actions}`;
}

function opNouvelleDemandeOffre(oppId) {
  const o = allOpportunites.find(x => x.id === oppId);
  prefillDemandeOffreOpportuniteId = oppId;
  prefillDemandeOffreClientId = o && o.client_id ? o.client_id : null;
  navigate('nouvelle-demande-offre');
}

// Saisie d'une offre reçue (entrée existante, ou nouvelle compagnie hors CRM : demandeId null)
function opSaisirOffre(oppId, demandeId, idx) {
  const d = demandeId ? (window._opDemandes[oppId] || []).find(x => x.id === demandeId) : null;
  const e = d && idx !== null ? (d.compagnies_envoi || [])[idx] || {} : {};
  const compagnies = typeof getCompagniesConnues === 'function' ? getCompagniesConnues() : [];
  creerModale('modal-offre-recue', `
    <div class="opx-modale" role="dialog" aria-labelledby="opx-offre-titre">
      <h3 id="opx-offre-titre">${e.compagnie ? `${typeof pictoCompagnie === 'function' ? pictoCompagnie(e.compagnie, 26) : ''} Offre de ${opEsc(e.compagnie)}` : '📥 Offre reçue'}</h3>
      <div class="form-grid">
        ${e.compagnie ? '' : `<div class="form-field" style="grid-column:span 2"><label class="form-label" for="of-compagnie">Compagnie</label>
          <input class="form-input" id="of-compagnie" list="of-compagnies" placeholder="Ex. Allianz"/><datalist id="of-compagnies">${compagnies.map(c => `<option value="${opEsc(c)}">`).join('')}</datalist></div>`}
        <div class="form-field"><label class="form-label" for="of-prime">Prime annuelle (CHF)</label><input class="form-input" id="of-prime" inputmode="decimal" value="${e.prime ?? ''}" placeholder="Ex. 4'250"/></div>
        <div class="form-field"><label class="form-label" for="of-franchise">Franchise / délai d'attente</label><input class="form-input" id="of-franchise" value="${opEsc(e.franchise || '')}" placeholder="Ex. CHF 500 · 30 j"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label" for="of-couverture">Couverture — points clés</label><input class="form-input" id="of-couverture" value="${opEsc(e.couverture || '')}" placeholder="Ex. 90 % du salaire, 730 j, sans réserve"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label" for="of-remarque">Remarque</label><textarea class="form-input" id="of-remarque" rows="2">${opEsc(e.remarque || '')}</textarea></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label" for="of-fichier">Offre PDF${e.offre_path ? ' — déjà jointe : ' + opEsc(e.offre_nom || 'offre.pdf') + ' (en choisir une autre la remplace)' : ' (facultatif)'}</label>
          <input class="form-input" id="of-fichier" type="file" accept="application/pdf"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Statut</label>
          <div class="opx-radios">${[['reçue', 'Offre reçue'], ['déclinée', 'La compagnie décline'], ['envoyée', 'Toujours en attente']].map(([v, l]) => `<label><input type="radio" name="of-statut" value="${v}" ${(e.statut === 'déclinée' ? 'déclinée' : 'reçue') === v ? 'checked' : ''}/> ${l}</label>`).join('')}</div></div>
      </div>
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-offre-recue').remove()">Annuler</button>
        <button type="button" class="btn-save" id="of-btn" onclick="opEnregistrerOffre('${oppId}',${demandeId ? `'${demandeId}'` : 'null'},${idx === null ? 'null' : idx})">✓ Enregistrer</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById(e.compagnie ? 'of-prime' : 'of-compagnie')?.focus(), 60);
}

async function opEnregistrerOffre(oppId, demandeId, idx) {
  const o = allOpportunites.find(x => x.id === oppId);
  const val = id => (document.getElementById(id)?.value || '').trim();
  const primeTxt = val('of-prime');
  const prime = primeTxt ? (typeof nombreCH === 'function' ? nombreCH(primeTxt) : parseFloat(primeTxt.replace(/[' ]/g, '').replace(',', '.'))) : null;
  const statut = document.querySelector('input[name="of-statut"]:checked')?.value || 'reçue';
  const fichier = document.getElementById('of-fichier')?.files?.[0] || null;
  if (fichier && fichier.type !== 'application/pdf') { showError('Seuls les fichiers PDF sont acceptés pour une offre.'); return; }
  if (fichier && fichier.size > 10 * 1024 * 1024) { showError('Fichier trop lourd — maximum 10 Mo.'); return; }
  const btn = document.getElementById('of-btn');
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  let d = demandeId ? (window._opDemandes[oppId] || []).find(x => x.id === demandeId) : null;
  let entrees = d ? [...(d.compagnies_envoi || [])] : [];
  let entree;
  if (d && idx !== null) {
    entree = { ...entrees[idx] };
  } else {
    const compagnie = val('of-compagnie');
    if (!compagnie) { showError('Indique la compagnie.'); if (btn) btn.disabled = false; return; }
    entree = { compagnie_id: null, compagnie, email: null, envoye_le: null, statut: 'envoyée' };
    d = (window._opDemandes[oppId] || [])[0] || null;
    entrees = d ? [...(d.compagnies_envoi || [])] : [];
    idx = null;
  }
  const etaitRecue = !!entree.recue_le;
  Object.assign(entree, {
    prime: Number.isFinite(prime) && prime > 0 ? Math.round(prime * 100) / 100 : null,
    franchise: val('of-franchise') || null,
    couverture: val('of-couverture') || null,
    remarque: val('of-remarque') || null,
    statut: entree.retenue && statut === 'reçue' ? 'retenue' : statut,
  });
  if (statut === 'reçue' && !entree.recue_le) entree.recue_le = new Date().toISOString();
  if (statut !== 'reçue') { entree.retenue = false; if (statut === 'envoyée') entree.recue_le = null; }
  if (idx !== null) entrees[idx] = entree; else entrees.push(entree);

  // 23.09.2026 — PERTE D'OFFRE CORRIGÉE. Le tableau partait de window._opDemandes, c'est-à-dire de
  // la mémoire de la page, et il était réécrit EN ENTIER. Une offre ajoutée depuis ailleurs (un
  // autre écran, un autre onglet, le dépôt automatique de js/137) n'y figurait pas : l'enregistrement
  // suivant l'effaçait en silence. Cas vécu : deux offres AXA d'Allocia Palanca, il n'en restait
  // qu'une. On relit donc la ligne juste avant d'écrire, et on ne remplace que l'entrée touchée.
  if (d) {
    try {
      const frais = await dbGet('demandes_offre', `id=eq.${d.id}&select=compagnies_envoi`);
      const vraies = Array.isArray(frais) && frais[0] && Array.isArray(frais[0].compagnies_envoi) ? frais[0].compagnies_envoi : null;
      if (vraies && vraies.length >= entrees.length - 1) {
        entrees = [...vraies];
        if (idx !== null && entrees[idx]) entrees[idx] = entree; else entrees.push(entree);
      }
    } catch (e) { /* relecture impossible : on garde le tableau en mémoire */ }
  }

  let r;
  if (d) r = await dbPatch('demandes_offre', d.id, { compagnies_envoi: entrees });
  else r = await dbPost('demandes_offre', { opportunite_id: oppId, client_id: o?.client_id || null, prospect_nom: o?.client_id ? null : (o?.prospect_nom || null), agent_id: opMonAgentId(o), donnees: {}, compagnies_envoi: entrees });
  if (r && r.error) { showError('Offre non enregistrée : ' + errMsg(r)); if (btn) btn.disabled = false; return; }
  document.getElementById('modal-offre-recue')?.remove();
  if (statut === 'reçue' && !etaitRecue) await ajouterLigneHistoriqueOpportunite(oppId, `📥 Offre reçue de ${entree.compagnie}${entree.prime ? ' — CHF ' + fmtCHF(entree.prime) + '/an' : ''}`);
  if (statut === 'déclinée') await ajouterLigneHistoriqueOpportunite(oppId, `🚫 ${entree.compagnie} décline`);
  // Première offre reçue : l'affaire passe naturellement en « Proposition »
  if (statut === 'reçue' && o && ['Contact', 'Analyse'].includes(o.stade)) await opChangerStade(oppId, 'Proposition');
  await opChargerDemandes(oppId);
  // PDF de l'offre (22.09.2026) : archivé sur l'entrée de la compagnie, même stockage que
  // « Joindre l'offre » de la fiche client (js/08). Pour une compagnie ajoutée ici, on retrouve
  // son entrée par son nom dans les demandes rechargées.
  if (fichier && typeof uploadOffreCompagnie === 'function') {
    // L'entrée qu'on vient d'écrire : la même position si elle existait, sinon la dernière de la
    // demande complétée (d) ou de la demande créée (r) — jamais une recherche par nom, qui pouvait
    // tomber sur la même compagnie dans une ancienne demande.
    const nouvelleId = !d && Array.isArray(r) && r[0] ? r[0].id : (!d && r && r.id) || null;
    const cible = d ? { id: d.id, i: idx !== null ? idx : entrees.length - 1 } : nouvelleId ? { id: nouvelleId, i: entrees.length - 1 } : null;
    if (cible && await uploadOffreCompagnie(cible.id, cible.i, { files: [fichier] }, '', '')) {
      await ajouterLigneHistoriqueOpportunite(oppId, `📎 Offre PDF de ${entree.compagnie} jointe`);
      await opChargerDemandes(oppId);
    } else if (!cible) showError('Offre enregistrée, mais le PDF n’a pas pu être rattaché : joins-le avec « 📎 Joindre l’offre ».');
  }
  opRafraichir();
  if (currentView === 'suivi' && typeof suxRecharger === 'function') suxRecharger();
}

// « 📎 Joindre l'offre » sur une ligne de la fiche opportunité (22.09.2026). Joindre le PDF vaut
// réception : si l'offre n'était pas encore marquée reçue, elle le devient (et l'affaire passe
// en « Proposition » comme lors d'une saisie).
async function opJoindreOffre(oppId, demandeId, idx, input) {
  if (!input.files || !input.files[0] || typeof uploadOffreCompagnie !== 'function') return;
  const nom = input.files[0].name;
  await uploadOffreCompagnie(demandeId, idx, input, '', '');
  const rows = await dbGet('demandes_offre', `id=eq.${demandeId}&select=id,compagnies_envoi`);
  const d = Array.isArray(rows) && rows[0];
  const entrees = d ? [...(d.compagnies_envoi || [])] : [];
  const e = entrees[idx] ? { ...entrees[idx] } : null;
  if (e && e.offre_path && e.offre_nom === nom) {
    if (!e.recue_le && e.statut !== 'déclinée') {
      e.recue_le = new Date().toISOString();
      e.statut = e.retenue ? 'retenue' : 'reçue';
      entrees[idx] = e;
      const r = await dbPatch('demandes_offre', demandeId, { compagnies_envoi: entrees });
      if (!(r && r.error)) {
        await ajouterLigneHistoriqueOpportunite(oppId, `📥 Offre reçue de ${e.compagnie} (PDF joint)`);
        const o = allOpportunites.find(x => x.id === oppId);
        if (o && ['Contact', 'Analyse'].includes(o.stade)) await opChangerStade(oppId, 'Proposition');
      }
    } else await ajouterLigneHistoriqueOpportunite(oppId, `📎 Offre PDF de ${e.compagnie} jointe`);
  }
  await opChargerDemandes(oppId);
  opRafraichir();
}

// ── Relance d'une compagnie (aperçu modifiable, jamais d'envoi automatique) ─────────────────
function opRelancerCompagnie(demandeId, idx) {
  const oppId = Object.keys(window._opDemandes).find(k => (window._opDemandes[k] || []).some(d => d.id === demandeId))
    || (window._suiviDemandes || []).find(d => d.id === demandeId)?.opportunite_id || null;
  const d = (window._opDemandes[oppId] || []).find(x => x.id === demandeId) || (window._suiviDemandes || []).find(x => x.id === demandeId);
  if (!d) return;
  const e = (d.compagnies_envoi || [])[idx];
  if (!e) return;
  const o = oppId ? allOpportunites.find(x => x.id === oppId) : null;
  const client = d.client_id ? allClients.find(c => c.id === d.client_id) : null;
  const nomClient = client ? (estEntreprise(client) ? client.nom : `${client.prenom} ${client.nom}`) : (d.prospect_nom || (o ? opNomClient(o) : 'notre client'));
  const corps = [
    'Bonjour,',
    `Le ${fmtDate(e.envoye_le)}, je vous ai transmis une demande d'offre pour ${nomClient}. Sauf erreur de ma part, je n'ai pas encore reçu votre proposition.`,
    "Pourriez-vous m'indiquer quand je peux compter sur votre offre ? Je reste volontiers à disposition pour tout complément d'information.",
    "Avec mes remerciements et mes meilleures salutations.",
    `${opAuteur()}\nAssurex Sàrl`,
  ].join('\n\n');
  ouvrirApercuEmailDemandeOffre({
    demandeOffreId: d.id,
    cies: [{ id: e.compagnie_id, compagnie: e.compagnie, email: e.email }],
    emails: e.email ? [e.email] : [],
    sansEmail: e.email ? [] : [e.compagnie],
    sujet: `Relance — demande d'offre ${nomClient}`,
    corps,
  });
  Object.assign(window._apercuEmailDemandeOffre, { relance: true, relanceIndex: idx, oppId: oppId || d.opportunite_id || null });
}

// Appelée par js/07 après un envoi réussi (demande ou relance)
async function opApresEnvoiDemande(ctx) {
  const oppId = ctx.oppId || null;
  const noms = (ctx.cies || []).map(c => c.compagnie).join(', ');
  if (oppId) await ajouterLigneHistoriqueOpportunite(oppId, ctx.relance ? `🔔 Relance envoyée à ${noms}` : `📨 Demande d'offre envoyée à ${noms}`);
  if (oppId && window._opDemandes[oppId]) await opChargerDemandes(oppId);
  if (currentView === 'nouvelle-opportunite') opRafraichir();
  if (currentView === 'suivi' && typeof suxRecharger === 'function') suxRecharger();
}

// ═══ COMPARATEUR + RECOMMANDATION ═══════════════════════════════════════════════════════════
function opComparer(oppId) {
  const o = allOpportunites.find(x => x.id === oppId);
  const entrees = opToutesEntrees(oppId).filter(x => x.e.prime || x.e.recue_le || x.e.recue_le);
  if (!entrees.length) { showError('Aucune offre reçue à comparer — saisis d’abord les offres (« + Offre reçue »).'); return; }
  const min = Math.min(...entrees.filter(x => x.e.prime).map(x => Number(x.e.prime)));
  const d0 = (window._opDemandes[oppId] || [])[0];
  const recoExistante = (d0 && d0.donnees && d0.donnees.recommandation) || '';
  const retenue = entrees.find(x => x.e.retenue);
  const recoDefaut = retenue
    ? `Nous vous recommandons l'offre de ${retenue.e.compagnie}${retenue.e.prime ? ` (CHF ${fmtCHF(retenue.e.prime)} par an)` : ''}, qui présente à notre avis le meilleur rapport entre la prime et l'étendue de la couverture.`
    : '';
  creerModale('modal-comparateur', `
    <div class="opx-modale opx-modale-large" role="dialog" aria-labelledby="opx-comp-titre">
      <h3 id="opx-comp-titre">⚖️ Comparaison des offres</h3>
      <div class="opx-modale-sous">${opEsc(o ? o.titre : '')}${o ? ' · ' + opEsc(opNomClient(o)) : ''}</div>
      <div class="opx-comp">${entrees.map(({ d, e, idx }) => {
        const ecart = e.prime && Number.isFinite(min) ? Number(e.prime) - min : null;
        return `<div class="opx-comp-col ${e.retenue ? 'retenue' : ''} ${ecart === 0 && entrees.length > 1 ? 'meilleur' : ''}">
          <div class="opx-comp-tete">${typeof pictoCompagnie === 'function' ? pictoCompagnie(e.compagnie, 40) : ''}<b>${opEsc(e.compagnie)}</b></div>
          <div class="opx-comp-prime">${e.prime ? 'CHF ' + fmtCHF(e.prime) : '—'}<small>par an</small></div>
          <div class="opx-comp-ecart">${ecart === null ? '' : ecart === 0 ? (entrees.length > 1 ? '🏆 Meilleur prix' : '') : '+ CHF ' + fmtCHF(ecart)}</div>
          <dl><dt>Franchise</dt><dd>${opEsc(e.franchise || '—')}</dd><dt>Couverture</dt><dd>${opEsc(e.couverture || '—')}</dd><dt>Remarque</dt><dd>${opEsc(e.remarque || '—')}</dd></dl>
          <button type="button" class="${e.retenue ? 'btn-save' : 'btn-secondary'}" onclick="opRetenir('${oppId}','${d.id}',${idx})">${e.retenue ? '★ Retenue' : 'Retenir cette offre'}</button>
        </div>`;
      }).join('')}</div>
      <div class="form-field" style="margin-top:16px"><label class="form-label" for="opx-reco">Recommandation au client</label>
        <textarea class="form-input" id="opx-reco" rows="4" placeholder="Pourquoi cette offre ? (prix, couverture, service, solidité…)">${opEsc(recoExistante || recoDefaut)}</textarea></div>
      <div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-comparateur').remove()">Fermer</button>
        <button type="button" class="btn-secondary" onclick="opSauverReco('${oppId}')">💾 Enregistrer le texte</button>
        <button type="button" class="btn-save" onclick="opImprimerRecommandation('${oppId}')">🖨️ Recommandation PDF</button>
      </div>
    </div>`, { padding: '16px' });
}

async function opRetenir(oppId, demandeId, idx) {
  const demandes = window._opDemandes[oppId] || [];
  let compagnieRetenue = null, prime = null;
  for (const d of demandes) {
    const entrees = [...(d.compagnies_envoi || [])];
    let change = false;
    entrees.forEach((e, i) => {
      const cible = d.id === demandeId && i === idx;
      if (cible) { compagnieRetenue = e.compagnie; prime = e.prime; }
      if (!!e.retenue !== cible) {
        entrees[i] = { ...e, retenue: cible, statut: cible ? 'retenue' : (e.statut === 'retenue' ? 'reçue' : e.statut) };
        change = true;
      }
    });
    if (change) {
      const r = await dbPatch('demandes_offre', d.id, { compagnies_envoi: entrees });
      if (r && r.error) { showError('Choix non enregistré : ' + errMsg(r)); return; }
      d.compagnies_envoi = entrees;
    }
  }
  const o = allOpportunites.find(x => x.id === oppId);
  if (o && compagnieRetenue) {
    const nom = typeof normaliserCompagnie === 'function' ? normaliserCompagnie(compagnieRetenue) : compagnieRetenue;
    const r = await dbPatch('opportunites', oppId, { compagnie: nom });
    if (!(r && r.error)) o.compagnie = nom;
    await ajouterLigneHistoriqueOpportunite(oppId, `★ Offre retenue : ${compagnieRetenue}${prime ? ' — CHF ' + fmtCHF(prime) + '/an' : ''}`);
  }
  const reco = document.getElementById('opx-reco')?.value || '';
  document.getElementById('modal-comparateur')?.remove();
  opRafraichir();
  opComparer(oppId);
  const champ = document.getElementById('opx-reco');
  if (champ && reco) champ.value = reco;
}

async function opSauverReco(oppId, silencieux) {
  const d0 = (window._opDemandes[oppId] || [])[0];
  const texte = document.getElementById('opx-reco')?.value || '';
  if (!d0) return;
  const donnees = { ...(d0.donnees || {}), recommandation: texte };
  const r = await dbPatch('demandes_offre', d0.id, { donnees });
  if (r && r.error) { showError('Texte non enregistré : ' + errMsg(r)); return; }
  d0.donnees = donnees;
  if (!silencieux) showError('✓ Recommandation enregistrée.');
}

async function opImprimerRecommandation(oppId) {
  await opSauverReco(oppId, true);
  const o = allOpportunites.find(x => x.id === oppId);
  const entrees = opToutesEntrees(oppId).filter(x => x.e.prime || x.e.recue_le || x.e.recue_le).sort((a, b) => (Number(a.e.prime) || 9e9) - (Number(b.e.prime) || 9e9));
  const reco = document.getElementById('opx-reco')?.value || '';
  const nom = o ? opNomClient(o) : '';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Comparaison des offres</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#0E1B33;margin:0;padding:34px 40px;font-size:12px}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #113679;padding-bottom:12px;margin-bottom:22px}
    header img{height:34px} h1{font-size:22px;margin:0;color:#113679} .sous{color:#56627A;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin:8px 0 22px} th{background:#113679;color:#fff;text-align:left;padding:8px 10px;font-size:11px}
    td{padding:9px 10px;border-bottom:1px solid #E2E7EF;vertical-align:top} td.prime{text-align:right;font-weight:bold;white-space:nowrap}
    tr.retenue td{background:#ECFDF5} tr.retenue td:first-child{border-left:4px solid #16A34A} .etoile{color:#16A34A;font-weight:bold}
    h2{font-size:14px;color:#113679;margin:0 0 8px} .reco{background:#F4F6F9;border-radius:8px;padding:14px 16px;line-height:1.55;white-space:pre-wrap}
    .signature{margin-top:30px} .mention{font-size:9.5px;color:#8A94A8;margin-top:34px;border-top:1px solid #E2E7EF;padding-top:8px}
    @page{size:A4;margin:12mm}
  </style></head><body>
    <header><div><h1>Comparaison des offres</h1><div class="sous">${opEsc(nom)}${o ? ' · ' + opEsc(o.titre) : ''} · ${new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>${typeof ASSUREX_LOGO_B64 !== 'undefined' ? `<img src="${ASSUREX_LOGO_B64}" alt="Assurex"/>` : '<b>Assurex Sàrl</b>'}</header>
    <table><thead><tr><th>Compagnie</th><th style="text-align:right">Prime annuelle</th><th>Franchise</th><th>Couverture</th><th>Remarques</th></tr></thead><tbody>
      ${entrees.map(({ e }) => `<tr class="${e.retenue ? 'retenue' : ''}"><td>${e.retenue ? '<span class="etoile">★</span> ' : ''}<b>${opEsc(e.compagnie)}</b></td><td class="prime">${e.prime ? 'CHF ' + fmtCHF(e.prime) : '—'}</td><td>${opEsc(e.franchise || '—')}</td><td>${opEsc(e.couverture || '—')}</td><td>${opEsc(e.remarque || '')}</td></tr>`).join('')}
    </tbody></table>
    ${reco ? `<h2>Notre recommandation</h2><div class="reco">${opEsc(reco)}</div>` : ''}
    <div class="signature">${opEsc(opAuteur())}<br>Assurex Sàrl</div>
    <div class="mention">Document établi à titre indicatif sur la base des offres reçues des compagnies. Seules les conditions générales et particulières des polices font foi.</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`;
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  if (!w) showError('Autorise les fenêtres pop-up pour afficher le PDF.');
}
