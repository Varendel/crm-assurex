// ═══ FICHE CLIENT — EN-TÊTE MODERNE (19.09.2026) ══════════════════════════════════════════════
// Même logique visuelle que le tableau de bord REX : bandeau bleu marine avec l'identité, les
// coordonnées cliquables et les actions ; statut en un clic ; bande d'indicateurs cliquables qui
// ouvrent l'onglet concerné ; carte « Relation » compacte (signataire, apporteur, recommandation,
// source). Toutes les actions existantes sont conservées (mêmes fonctions qu'avant).

function fcxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// Ouvre un onglet de la fiche depuis un indicateur (et fait défiler jusqu'aux onglets)
function fcxOnglet(idOnglet) {
  const btn = [...document.querySelectorAll('.fiche-principale .tab-btn, .tabs .tab-btn')].find(b => (b.getAttribute('onclick') || '').includes(`'${idOnglet}'`));
  if (!btn) return;
  btn.click();
  btn.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function htmlEnteteFicheClient(c, ctx) {
  const { contrats = [], rappels = [], mandatsSignes = [], rendezVousClient = [], agent, isEntreprise, displayName, displaySub, headerIcon } = ctx;
  const rh = typeof estRoleRH === 'function' && estRoleRH();
  const auj = new Date().toISOString().slice(0, 10);
  const actifs = contrats.filter(ct => !['résilié', 'annulé', 'mandat_resilie'].includes(ct.statut));
  const primes = actifs.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
  const ouverts = rappels.filter(r => r.statut === 'ouvert');
  const enRetard = ouverts.filter(r => r.date_echeance && r.date_echeance.slice(0, 10) < auj).length;
  const prochainRdv = rendezVousClient.filter(r => r.statut !== 'annule' && new Date(r.date_heure) >= new Date()).sort((a, b) => new Date(a.date_heure) - new Date(b.date_heure))[0];
  const commAttente = (typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : []).filter(ca => ca.client_id === c.id && ca.statut === 'en_attente');
  const totalCommAttente = commAttente.reduce((s, ca) => s + Number(ca.montant_estime || 0), 0);
  const mandatSigne = mandatsSignes.some(m => m.signe);
  const adresse = [c.adresse, [c.npa, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const tel = c.mobile || c.telephone || '';
  const teams = typeof lienAppelTeams === 'function' ? lienAppelTeams(c) : '';
  const statut = c.statut || 'prospect';
  const signataire = allAgents.find(a => a.role === 'signataire');
  const oppsClient = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).filter(o => o.client_id === c.id);
  const couleurStade = { Contact: '#94A3B8', Analyse: '#38BDF8', Proposition: '#F59E0B', Négociation: '#A78BFA', Gagné: '#22C55E', Perdu: '#EF4444' };

  const kpi = (label, valeur, sous, onglet, ton, i) => `<button type="button" class="fcx-kpi ${ton || ''}" style="--i:${i}" onclick="fcxOnglet('${onglet}')">
      <span class="fcx-kpi-label">${label}</span><span class="fcx-kpi-valeur">${valeur}</span><span class="fcx-kpi-sous">${sous || ''}</span></button>`;

  return `
  <section class="fcx-hero">
    <div class="fcx-hero-deco" aria-hidden="true"></div>
    <div class="fcx-hero-haut">
      <div class="fcx-identite">
        <div class="fcx-avatar">${headerIcon}</div>
        <div class="fcx-identite-texte">
          <div class="fcx-surtitre">${isEntreprise ? 'Entreprise' : c.prenatal ? 'Naissance à venir' : 'Client privé'}${c.segment && !/^(priv[ée]|entreprise)$/i.test(c.segment) ? ' · ' + fcxEsc(c.segment) : ''}</div>
          <h1 class="fcx-nom">${fcxEsc(displayName)}${typeof getClientMiniLogos === 'function' ? getClientMiniLogos(c) : ''}</h1>
          ${displaySub.replace(/[·\s]/g, '') ? `<div class="fcx-sous">${fcxEsc(displaySub)}</div>` : ''}
          <div class="fcx-contacts">
            ${adresse ? `<span class="fcx-chip" title="Adresse">📍 ${fcxEsc(adresse)}</span>` : ''}
            ${c.email ? `<a class="fcx-chip" href="mailto:${fcxEsc(c.email)}" title="Écrire un e-mail">✉️ ${fcxEsc(c.email)}</a>` : ''}
            ${tel ? `<a class="fcx-chip" href="tel:${fcxEsc(tel)}" title="Appeler">📞 ${fcxEsc(tel)}</a>` : ''}
            ${teams ? `<a class="fcx-chip" href="${teams}" title="Appeler via Teams">💬 Teams</a>` : ''}
          </div>
        </div>
      </div>
      <div class="fcx-actions">
        <div class="fcx-actions-principales">
          <button type="button" class="fcx-btn-blanc" onclick="prefillOpportuniteClientId='${c.id}'; opportuniteEnEditionId=null; navigate('nouvelle-opportunite')">🎯 Opportunité</button>
          <button type="button" class="fcx-btn-verre" onclick="ouvrirModaleNouveauRdv('${c.id}')">📅 Rendez-vous</button>
          ${!isEntreprise && !rh && typeof ouvrirDossierConseil === 'function' ? `<button type="button" class="fcx-btn-verre" onclick="ouvrirDossierConseil('${c.id}')" title="Dossier de conseil financier : budget, projets, retraite, immobilier">💼 Conseil</button>` : ''}
        </div>
        <div class="fcx-actions-menus">
          <button type="button" onclick="ouvrirOngletDocumentsClient('${c.id}')">📄 Documents ▾</button>
          <button type="button" onclick="ouvrirOngletAdminClient('${c.id}')">🗂️ Admin ▾</button>
          ${isEntreprise ? `<button type="button" onclick="ouvrirOngletEntrepriseClient('${c.id}')">🏢 Entreprise ▾</button>` : ''}
          ${!isEntreprise && !c.prenatal ? `<button type="button" onclick="ouvrirOngletSuiviClient('${c.id}')">👪 Suivi ▾</button>` : ''}
          ${!isEntreprise ? `<button type="button" onclick="voirConstellationFamiliale('${c.id}')" class="${typeof aConstellationFamiliale === 'function' && aConstellationFamiliale(c) ? 'fam-glow' : ''}">🌳 Famille</button>` : ''}
          <button type="button" onclick="ouvrirOngletFicheClient('${c.id}')">⚙️ Fiche ▾</button>
        </div>
      </div>
    </div>
    <div class="fcx-hero-bas">
      <div class="fcx-statut" role="group" aria-label="Statut du client">
        ${[['prospect', 'Prospect'], ['actif', 'Client actif'], ['inactif', 'Inactif']].map(([v, l]) =>
          `<button type="button" class="${statut === v ? 'actif' : ''}" aria-pressed="${statut === v}" ${statut === v ? '' : `onclick="changerStatutClient('${c.id}','${v}')"`}>${l}</button>`).join('')}
      </div>
      <span class="fcx-badge ${mandatSigne ? 'ok' : ''}">🖊️ ${mandatSigne ? 'Mandat signé' : 'Mandat non signé'}</span>
      <button type="button" class="fcx-badge ${c.source_oz ? 'on' : ''}" onclick="toggleSourceOz('${c.id}', ${!c.source_oz})" title="${c.source_oz ? 'Client OZ Assure — cliquer pour retirer' : 'Marquer comme client OZ Assure'}">${typeof OZ_LOGO_TERTIAIRE_SVG !== 'undefined' ? `<span class="fcx-logo-oz">${OZ_LOGO_TERTIAIRE_SVG}</span>` : 'OZ'}${c.source_oz ? ' Client OZ Assure' : ' + marquer OZ'}</button>
      <button type="button" class="fcx-badge ${c.source_cofidex ? 'on' : ''}" onclick="toggleSourceCofidex('${c.id}', ${!c.source_cofidex})" title="${c.source_cofidex ? 'Client EX Groupe — cliquer pour retirer' : 'Marquer comme client Cofidex / EX Groupe'}">${c.source_cofidex ? '✓ EX Groupe' : '+ EX'}</button>
    </div>
  </section>

  ${c.prenatal ? `<div class="fcx-bandeau rose">
    <span class="fcx-bandeau-icone">🍼</span>
    <div><strong>Naissance à venir${c.date_naissance ? ' — prévue le ' + fmtDate(c.date_naissance) : ''}</strong><span>Assurance prénatale — les contrats LAMal/LCA sont suivis dès maintenant, la commission se déclenchera une fois la naissance confirmée.</span></div>
    <button type="button" onclick="ouvrirAnnonceNaissance('${c.id}')">🎉 Annoncer la naissance</button>
  </div>` : ''}

  <div class="fcx-kpis">
    ${rh ? '' : kpi('Contrats actifs', actifs.length, `${contrats.length} au total`, 'tab-contrats', '', 1)}
    ${rh ? '' : kpi('Primes annuelles', 'CHF ' + fmtCHF(Math.round(primes)), actifs.length ? 'portefeuille du client' : 'aucun contrat actif', 'tab-contrats', '', 2)}
    ${kpi('Tâches ouvertes', ouverts.length, enRetard ? `<span class="fcx-rouge">${enRetard} en retard</span>` : ouverts.length ? 'à jour' : 'rien en cours', 'tab-rappels', enRetard ? 'alerte' : '', 3)}
    ${kpi('Prochain rendez-vous', prochainRdv ? fmtDate(prochainRdv.date_heure) : '—', prochainRdv ? new Date(prochainRdv.date_heure).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : 'aucun planifié', 'tab-rdv', '', 4)}
    ${rh ? '' : kpi('Commissions à recevoir', 'CHF ' + fmtCHF(Math.round(totalCommAttente)), `${commAttente.length} en attente`, 'tab-contrats', '', 5)}
  </div>

  ${oppsClient.length ? `<div class="fcx-opps">
    <span class="fcx-opps-titre">🎯 Opportunités</span>
    ${oppsClient.map(o => `<button type="button" class="fcx-opp" onclick="editerOpportunite('${o.id}')">
      <span class="fcx-point" style="background:${couleurStade[o.stade] || '#94A3B8'}"></span>${fcxEsc(o.titre)}<span class="fcx-opp-stade" style="color:${couleurStade[o.stade] || '#94A3B8'}">${fcxEsc(o.stade)}</span>
    </button>`).join('')}
  </div>` : ''}

  ${typeof renderVueEnsembleCouvertures === 'function' ? renderVueEnsembleCouvertures(c, contrats, isEntreprise) : ''}

  <section class="fcx-relation" aria-label="Relation client">
    ${signataire ? `<div class="fcx-rel">
      ${avatar(signataire, 34)}
      <div class="fcx-rel-texte"><span class="fcx-rel-label">Agent signataire</span><strong>${fcxEsc(signataire.prenom)} ${fcxEsc(signataire.nom)}</strong><small>Toujours responsable du client</small></div>
    </div>` : ''}
    <div class="fcx-rel">
      ${agent ? avatar(agent, 34) : '<span class="fcx-rel-icone">🤷</span>'}
      <div class="fcx-rel-texte"><span class="fcx-rel-label">Apporteur interne</span>
        <select aria-label="Apporteur interne" onchange="changerAgentClient('${c.id}', this.value)">
          <option value="">— Aucun / pas de partage —</option>
          ${allAgents.map(a => `<option value="${a.id}" ${c.apporteur_id === a.id ? 'selected' : ''}>${fcxEsc(a.prenom)} ${fcxEsc(a.nom)}${a.role === 'signataire' ? ' (moi-même)' : ''}</option>`).join('')}
        </select>
        <small>Détermine le partage de commission</small>
      </div>
    </div>
    ${typeof SOURCES_CLIENT !== 'undefined' ? `<div class="fcx-rel">
      <span class="fcx-rel-icone">🧭</span>
      <div class="fcx-rel-texte"><span class="fcx-rel-label">Source du client</span>
        <select aria-label="Source du client" onchange="srcChangerSourceFiche('${c.id}', this.value)">
          <option value="">— Non renseignée —</option>
          ${SOURCES_CLIENT.map(s => `<option value="${s.v}" ${c.source === s.v ? 'selected' : ''}>${fcxEsc(s.label)}</option>`).join('')}
        </select>
        <small>${c.source && typeof srcResume === 'function' ? fcxEsc(srcResume(c).replace(srcLabel(c.source), '').replace(/^ — /, '')) || '&nbsp;' : '&nbsp;'}</small>
      </div>
    </div>` : ''}
    ${c.apporteur_externe ? `<div class="fcx-rel">
      <span class="fcx-rel-icone violet">${fcxEsc(c.apporteur_externe.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>
      <div class="fcx-rel-texte"><span class="fcx-rel-label">Recommandé par</span><strong>${fcxEsc(c.apporteur_externe)}</strong><small>Apporteur externe</small></div>
    </div>` : ''}
  </section>`;
}
