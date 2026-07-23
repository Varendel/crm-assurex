function svgStackedBarChart(items, cible, cibleLabel, couleurs) {
  const c = couleurs || { texte: '#e2e8f0', muted: '#64748b', bordure: '#2a3550' };
  const width = 760, height = 340, padding = 56;
  const total = items.reduce((s, i) => s + i.value, 0);
  const maxVal = Math.max(total, cible || 0, 1) * 1.18;
  const zoneH = height - padding - 36;
  const barWidth = 220;
  const x = width / 2 - barWidth / 2;
  let y = height - padding;
  let segments = '';
  items.forEach(it => {
    if (it.value <= 0) return;
    const h = (it.value / maxVal) * zoneH;
    y -= h;
    segments += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth}" height="${h.toFixed(1)}" fill="${it.color}"/>`;
    if (h > 18) segments += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${(y + h / 2 + 5).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#0a0e1a">${Math.round(it.value).toLocaleString()}</text>`;
  });
  const totalY = height - padding - (total / maxVal) * zoneH;
  segments += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${(totalY - 10).toFixed(1)}" text-anchor="middle" font-size="15" font-weight="900" fill="${c.texte}">Total : CHF ${Math.round(total).toLocaleString()}</text>`;

  let legend = '';
  const legendY = height - padding + 26;
  let lx = padding;
  items.forEach(it => {
    legend += `<rect x="${lx.toFixed(1)}" y="${legendY}" width="12" height="12" fill="${it.color}" rx="2"/>`;
    legend += `<text x="${(lx + 16).toFixed(1)}" y="${legendY + 10.5}" font-size="11.5" fill="${c.muted}">${it.label}</text>`;
    lx += 16 + it.label.length * 6.6 + 22;
  });

  let ligneCible = '';
  if (cible > 0) {
    const yCible = height - padding - (cible / maxVal) * zoneH;
    ligneCible = `<line x1="${padding - 6}" y1="${yCible.toFixed(1)}" x2="${width - padding + 6}" y2="${yCible.toFixed(1)}" stroke="#f87171" stroke-width="2" stroke-dasharray="6,5"/>
      <text x="${width - padding + 6}" y="${(yCible - 6).toFixed(1)}" font-size="11.5" fill="#f87171" text-anchor="end" font-weight="700">${cibleLabel || 'Besoin'} : CHF ${Math.round(cible).toLocaleString()}</text>`;
  }

  return `<svg viewBox="0 0 ${width} ${height + 20}" style="width:100%;height:auto;max-height:440px;display:block;margin:0 auto">
    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="${c.bordure}" stroke-width="1"/>
    ${segments}
    ${ligneCible}
    ${legend}
  </svg>`;
}



// Frise chronologique schématique — positionne les jalons dans l'ordre, espacés uniformément
// (échelle non proportionnelle au temps réel : jours et années cohabitent, à la manière d'un exposé conseil)
function svgTimelineSchematique(etapes, couleurs, idSuffix) {
  const c = couleurs || { texte: '#e2e8f0', muted: '#64748b', bordure: '#2a3550', accent: '#38bdf8' };
  const width = 760, height = 120, marge = 70;
  const n = etapes.length;
  const step = n > 1 ? (width - marge * 2) / (n - 1) : 0;
  const markerId = 'arrow-' + (idSuffix || Math.random().toString(36).slice(2, 8));
  let dots = '';
  etapes.forEach((e, i) => {
    const x = n > 1 ? marge + i * step : width / 2;
    dots += `<circle cx="${x.toFixed(1)}" cy="60" r="6" fill="${c.accent}"/>`;
    dots += `<text x="${x.toFixed(1)}" y="42" text-anchor="middle" font-size="12.5" font-weight="700" fill="${c.texte}">${e.titre}</text>`;
    if (e.sousTitre) dots += `<text x="${x.toFixed(1)}" y="80" text-anchor="middle" font-size="10.5" fill="${c.muted}">${e.sousTitre}</text>`;
  });
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;max-height:150px;display:block;margin:0 auto">
    <defs><marker id="${markerId}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><polygon points="0 0, 9 4.5, 0 9" fill="${c.bordure}"/></marker></defs>
    <line x1="${marge - 15}" y1="60" x2="${width - marge + 15}" y2="60" stroke="${c.bordure}" stroke-width="2" marker-end="url(#${markerId})"/>
    ${dots}
  </svg>`;
}

// Préremplit le nom et la date de naissance depuis un client existant
function prefillClientLPP() {
  const clientId = document.getElementById('clpp-client').value;
  window._clppClientSelectionne = null;
  if (!clientId) return;
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  window._clppClientSelectionne = c;
  document.getElementById('clpp-nom').value = estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
  if (c.date_naissance) document.getElementById('clpp-naissance').value = c.date_naissance;
  document.getElementById('clpp-adresse').value = c.adresse || '';
  document.getElementById('clpp-npa-ville').value = [c.npa, c.ville].filter(Boolean).join(' ');
  document.getElementById('clpp-telephone').value = c.mobile || c.telephone || '';
  document.getElementById('clpp-email').value = c.email || '';
}

// Met à jour l'aperçu du salaire coordonné en direct pendant la saisie
function updateApercuSalaireCoordonne() {
  const salaireAVS = parseFloat(document.getElementById('clpp-salaire-avs').value) || 0;
  const coordonne = calculerSalaireCoordonneLPP(salaireAVS);
  document.getElementById('clpp-salaire-coordonne').value = coordonne;
}

// ═══ ENFANTS À CHARGE (calculateur LPP) — gestion dynamique en mémoire ═══
let enfantsLPPTemp = [];

function ajouterEnfantLPP() {
  enfantsLPPTemp.push({ naissance: '', etudes: false });
  renderEnfantsLPP();
}

function retirerEnfantLPP(idx) {
  enfantsLPPTemp.splice(idx, 1);
  renderEnfantsLPP();
}

function updateEnfantLPP(idx, field, value) {
  if (!enfantsLPPTemp[idx]) return;
  enfantsLPPTemp[idx][field] = value;
}

function renderEnfantsLPP() {
  const zone = document.getElementById('clpp-enfants-list');
  if (!zone) return;
  zone.innerHTML = enfantsLPPTemp.map((e, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:11px;color:var(--text-muted);width:60px">Enfant ${i + 1}</span>
      <input class="form-input" type="date" value="${e.naissance}" onchange="updateEnfantLPP(${i}, 'naissance', this.value)" style="flex:1"/>
      <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text);white-space:nowrap;cursor:pointer">
        <input type="checkbox" ${e.etudes ? 'checked' : ''} onchange="updateEnfantLPP(${i}, 'etudes', this.checked)" style="width:14px;height:14px;cursor:pointer"/> études (→25 ans)
      </label>
      <button type="button" onclick="retirerEnfantLPP(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px">✕</button>
    </div>`).join('');
}

// Calcule pour un enfant : est-il actuellement éligible à une rente, et en quelle année cesse-t-elle ?
function statutEnfantLPP(naissance, etudes) {
  if (!naissance) return null;
  const dateNaissance = new Date(naissance + 'T00:00:00');
  const age = ageAujourdhui(naissance);
  const limiteAns = etudes ? 25 : 18;
  const eligible = age < limiteAns;
  const anneeCessation = dateNaissance.getFullYear() + limiteAns;
  return { age, eligible, anneeCessation, limiteAns };
}

// Affiche/masque les champs de personnalisation du plan surobligatoire
function toggleSurobligatoire() {
  const zone = document.getElementById('clpp-surobligatoire-zone');
  zone.style.display = document.getElementById('clpp-surobligatoire').checked ? 'block' : 'none';
}

// Vérifie si un client est de segment "Entreprise" de façon robuste (insensible à la casse/espaces —
// évite les incohérences si le segment a été saisi/importé différemment quelque part).
// Ouvre une fiche client en navigation normale (SPA), mais laisse le navigateur gérer
// nativement Ctrl/Cmd+clic, clic molette ou Maj+clic (ouverture dans un nouvel onglet/fenêtre)
// — grâce au vrai href="?client=ID" posé sur le lien, chaque onglet ouvre sa propre session CRM
// sur la bonne fiche dès le chargement (voir la vérification du paramètre d'URL au démarrage).
function irVersClient(event, id) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) return true;
  event.preventDefault();
  showClient(id);
  return false;
}

function estEntreprise(c) {
  return !!(c && c.segment && c.segment.trim().toLowerCase() === 'entreprise');
}

function ageAujourdhui(dateNaissance) {
  const naissance = new Date(dateNaissance + 'T00:00:00');
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();
  const m = aujourdhui.getMonth() - naissance.getMonth();
  if (m < 0 || (m === 0 && aujourdhui.getDate() < naissance.getDate())) age--;
  return age;
}

function calculerEtAfficherLPP() {
  const zone = document.getElementById('clpp-resultats');
  const naissance = document.getElementById('clpp-naissance').value;
  const salaireAVS = parseFloat(document.getElementById('clpp-salaire-avs').value) || 0;
  const avoirActuelCertificat = parseFloat(document.getElementById('clpp-avoir-actuel').value) || 0;
  if (!naissance || !salaireAVS) { showError('Date de naissance et salaire AVS sont obligatoires.'); return; }

  const ageRetraite = parseInt(document.getElementById('clpp-age-retraite').value) || 65;
  const moisDerniereAnnee = parseInt(document.getElementById('clpp-mois-derniere-annee').value) || 0;
  const tauxInteret = (parseFloat(document.getElementById('clpp-taux-interet').value) || 1.25) / 100;
  const tauxConversion = (parseFloat(document.getElementById('clpp-taux-conversion').value) || 6.8) / 100;
  const rachatAnnuel = parseFloat(document.getElementById('clpp-rachat-annuel').value) || 0;
  const libresPassage = parseFloat(document.getElementById('clpp-libre-passage').value) || 0;
  const avoirActuel = avoirActuelCertificat + libresPassage;
  const etatCivil = document.getElementById('clpp-etat-civil').value;
  const statutsEnfants = enfantsLPPTemp.map(e => statutEnfantLPP(e.naissance, e.etudes)).filter(s => s);
  const nbEnfants = statutsEnfants.filter(s => s.eligible).length;
  const degreInvalidite = Math.min(100, Math.max(0, parseInt(document.getElementById('clpp-degre-invalidite').value) || 0));
  const besoinDecesPct = parseFloat(document.getElementById('clpp-besoin-deces-pct').value) || 80;
  const besoinDecesManuel = parseFloat(document.getElementById('clpp-besoin-deces-manuel').value) || 0;
  const besoinInvaliditePct = parseFloat(document.getElementById('clpp-besoin-invalidite-pct').value) || 80;
  const besoinInvaliditeManuel = parseFloat(document.getElementById('clpp-besoin-invalidite-manuel').value) || 0;
  const estSurobligatoire = document.getElementById('clpp-surobligatoire').checked;
  const pctConjoint = (estSurobligatoire ? (parseFloat(document.getElementById('clpp-pct-conjoint').value) || 60) : 60) / 100;
  const pctOrphelin = (estSurobligatoire ? (parseFloat(document.getElementById('clpp-pct-orphelin').value) || 20) : 20) / 100;
  const pctEnfantInvalidite = (estSurobligatoire ? (parseFloat(document.getElementById('clpp-pct-enfant-invalidite').value) || 20) : 20) / 100;
  const renteConcubinIncluse = estSurobligatoire && document.getElementById('clpp-rente-concubin').checked;
  const capitalDecesLPP = estSurobligatoire ? (parseFloat(document.getElementById('clpp-capital-deces').value) || 0) : 0;
  const capitalInvaliditeLPP = estSurobligatoire ? (parseFloat(document.getElementById('clpp-capital-invalidite').value) || 0) : 0;
  const tauxBonifPersonnalise = estSurobligatoire ? [
    (parseFloat(document.getElementById('clpp-bonif-1').value) || 7) / 100,
    (parseFloat(document.getElementById('clpp-bonif-2').value) || 10) / 100,
    (parseFloat(document.getElementById('clpp-bonif-3').value) || 15) / 100,
    (parseFloat(document.getElementById('clpp-bonif-4').value) || 18) / 100,
  ] : null;
  const bonifFn = tauxBonifPersonnalise ? (age => {
    if (age < 25) return 0;
    if (age <= 34) return tauxBonifPersonnalise[0];
    if (age <= 44) return tauxBonifPersonnalise[1];
    if (age <= 54) return tauxBonifPersonnalise[2];
    return tauxBonifPersonnalise[3];
  }) : tauxBonificationLPP;

  // La rente de conjoint/veuvage n'est versée que si le client est marié, ou célibataire avec rente de concubin incluse au plan
  const droitRenteSurvivant = etatCivil === 'marie' || renteConcubinIncluse;

  const salaireCoordonne = (() => {
    const override = estSurobligatoire ? parseFloat(document.getElementById('clpp-salaire-coordonne-surob').value) : NaN;
    return !isNaN(override) && override > 0 ? override : calculerSalaireCoordonneLPP(salaireAVS);
  })();
  const ageActuel = ageAujourdhui(naissance);

  if (ageActuel >= ageRetraite) { showError('L\'âge actuel dépasse déjà l\'âge de référence de la retraite.'); return; }
  if (ageActuel < 25) { showError('Le calculateur suppose une affiliation dès 25 ans (bonifications de vieillesse) — âge actuel trop bas pour le parcours théorique.'); return; }

  const anneesCotisationSaisies = parseInt(document.getElementById('clpp-annees-cotisation').value);
  const anneesCotisationActuel = !isNaN(anneesCotisationSaisies) ? anneesCotisationSaisies : Math.max(0, ageActuel - 20);
  const anneesCotisationRetraite = Math.min(44, Math.max(0, ageRetraite - 20));

  // ═══ RISQUE VIE (retraite) ═══
  // Le parcours théorique (référence légale servant à calculer la lacune) utilise TOUJOURS
  // le minimum légal LPP — même si le plan réel est surobligatoire — sinon la notion de "lacune" perd son sens.
  const theorique = simulerParcoursLPP({ salaireCoordonne, capitalDepart: 0, ageDepart: 25, ageRetraite, moisDerniereAnnee, tauxInteret, rachatAnnuel: 0, tauxBonifFn: tauxBonificationLPP });
  const ligneTheoriqueActuelle = theorique.lignes.find(l => l.age === ageActuel - 1) || theorique.lignes[theorique.lignes.length - 1];
  const avoirTheoriqueActuel = ligneTheoriqueActuelle ? ligneTheoriqueActuelle.etatFin : 0;
  const reel = simulerParcoursLPP({ salaireCoordonne, capitalDepart: avoirActuel, ageDepart: ageActuel, ageRetraite, moisDerniereAnnee, tauxInteret, rachatAnnuel, tauxBonifFn: bonifFn });
  const capitalProjete = reel.capitalFinal;
  const renteVieillesseLPP = Math.round(capitalProjete * tauxConversion);
  const lacuneCapital = Math.round(avoirTheoriqueActuel - avoirActuel);
  const renteVieillesseAVS = estimerRenteAVS(salaireAVS, anneesCotisationRetraite);
  const objectif90 = Math.round(salaireAVS * 0.9);
  const renteCombineeVie = renteVieillesseAVS + renteVieillesseLPP;
  const lacuneRenteVie = objectif90 - renteCombineeVie;

  // ═══ RISQUE DÉCÈS ═══
  // Rente d'invalidité entière LPP théorique (base de calcul des rentes de survivants, avant application du degré)
  let bonificationsFutures = 0;
  for (let age = ageActuel; age < ageRetraite; age++) bonificationsFutures += salaireCoordonne * bonifFn(age);
  const avoirPrevisionnelLPP = avoirActuel + bonificationsFutures;
  const renteInvaliditeEntiereLPP = Math.round(avoirPrevisionnelLPP * tauxConversion);

  const renteAVSEntiereActuelle = estimerRenteAVS(salaireAVS, anneesCotisationActuel);
  const renteVeuvageAVS = etatCivil === 'marie' ? Math.round(renteAVSEntiereActuelle * AVS_LEGAL.taux_veuvage) : 0;
  const renteOrphelinAVS = Math.round(renteAVSEntiereActuelle * AVS_LEGAL.taux_orphelin) * nbEnfants;
  const renteConjointLPP = droitRenteSurvivant ? Math.round(renteInvaliditeEntiereLPP * pctConjoint) : 0;
  const renteOrphelinLPP = Math.round(renteInvaliditeEntiereLPP * pctOrphelin) * nbEnfants;
  const totalRenteDeces = renteVeuvageAVS + renteOrphelinAVS + renteConjointLPP + renteOrphelinLPP;
  const besoinDeces = besoinDecesManuel > 0 ? besoinDecesManuel : Math.round(salaireAVS * besoinDecesPct / 100);
  const lacuneDeces = besoinDeces - totalRenteDeces;

  // ═══ RISQUE INVALIDITÉ ═══
  const fractionLPP = fractionRenteInvaliditeLPP(degreInvalidite);
  const renteInvaliditeLPP = Math.round(renteInvaliditeEntiereLPP * fractionLPP);
  const renteEnfantInvaliditeLPP = Math.round(renteInvaliditeLPP * pctEnfantInvalidite) * nbEnfants;
  const renteInvaliditeAVS = degreInvalidite >= 70 ? renteAVSEntiereActuelle
    : degreInvalidite >= 50 ? Math.round(renteAVSEntiereActuelle * degreInvalidite / 100)
    : degreInvalidite >= 40 ? Math.round(renteAVSEntiereActuelle * fractionRenteInvaliditeLPP(degreInvalidite))
    : 0;
  const renteEnfantInvaliditeAVS = degreInvalidite >= 40 ? Math.round(renteInvaliditeAVS * AVS_LEGAL.taux_orphelin) * nbEnfants : 0;
  const totalRenteInvalidite = renteInvaliditeAVS + renteEnfantInvaliditeAVS + renteInvaliditeLPP + renteEnfantInvaliditeLPP;
  const besoinInvalidite = besoinInvaliditeManuel > 0 ? besoinInvaliditeManuel : Math.round(salaireAVS * besoinInvaliditePct / 100);
  const lacuneInvalidite = besoinInvalidite - totalRenteInvalidite;

  const blocRisque = (titre, couleur, lignes, besoin, total, lacune, note) => sectionCard(titre, couleur, `
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:12px">
      ${lignes.map(l => `<tr><td style="padding:4px 0;color:var(--text-muted)">${l.label}</td><td style="padding:4px 0;text-align:right;font-weight:700;color:var(--text)">CHF ${Math.round(l.montant).toLocaleString()}/an</td></tr>`).join('')}
      <tr style="border-top:1px solid var(--border)"><td style="padding:6px 0;font-weight:800">Total prestations projetées</td><td style="padding:6px 0;text-align:right;font-weight:800;color:${couleur}">CHF ${Math.round(total).toLocaleString()}/an</td></tr>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px">
      <div><div style="font-size:11px;color:var(--text-muted)">Besoin estimé</div><div style="font-size:16px;font-weight:800;color:var(--text)">CHF ${besoin.toLocaleString()}/an</div></div>
      <div><div style="font-size:11px;color:var(--text-muted)">Lacune</div><div style="font-size:16px;font-weight:800;color:${lacune > 0 ? '#f87171' : '#4ade80'}">CHF ${Math.round(lacune).toLocaleString()}/an</div></div>
    </div>
    ${lacune > 0
      ? `<div style="padding:10px 14px;border-radius:9px;background:var(--red-dim);font-size:12px;color:#f87171"><strong>Lacune identifiée : CHF ${Math.round(lacune).toLocaleString()}/an</strong> (CHF ${Math.round(lacune/12).toLocaleString()}/mois)${note ? ' — ' + note : ''}</div>`
      : `<div style="padding:10px 14px;border-radius:9px;background:rgba(74,222,128,0.12);font-size:12px;color:#4ade80"><strong>Besoin couvert</strong> par les prestations projetées.</div>`}
  `);

  // ═══ Jalons chronologiques (frises) par situation ═══
  const anneeActuelle = new Date().getFullYear();
  const anneeRetraiteProjetee = anneeActuelle + (ageRetraite - ageActuel);

  const jalonsEnfants = statutsEnfants.filter(s => s.eligible).map((s, i) => ({
    titre: `Fin rente enfant ${i + 1}`,
    sousTitre: `${s.limiteAns} ans — ${s.anneeCessation}`,
  }));

  const timelineVie = [
    { titre: 'Aujourd\'hui', sousTitre: `${ageActuel} ans — ${anneeActuelle}` },
    { titre: 'Retraite', sousTitre: `${ageRetraite} ans — ${anneeRetraiteProjetee}` },
  ];

  const timelineDeces = [
    { titre: 'Décès', sousTitre: `${anneeActuelle}` },
    { titre: 'Rente conjoint', sousTitre: 'à vie (jusqu\'à remariage)' },
    ...jalonsEnfants,
  ];

  const timelineInvalidite = [
    { titre: 'Jour 1-2', sousTitre: 'Délai d\'attente LAA' },
    { titre: 'Jour 3', sousTitre: 'Début IJ LAA' },
    { titre: 'Invalidité reconnue', sousTitre: `${anneeActuelle}` },
    ...jalonsEnfants,
  ];

  const tableRows = (lignes) => lignes.map(l => `
    <tr style="border-top:1px solid var(--border)">
      <td style="padding:5px 8px">${l.age}</td>
      <td style="padding:5px 8px;text-align:right">CHF ${Math.round(l.etatDebut).toLocaleString()}</td>
      <td style="padding:5px 8px;text-align:right;color:var(--text-muted)">CHF ${Math.round(l.interet).toLocaleString()}</td>
      <td style="padding:5px 8px;text-align:right;color:#4ade80">CHF ${Math.round(l.bonification).toLocaleString()}</td>
      <td style="padding:5px 8px;text-align:right;font-weight:700">CHF ${Math.round(l.etatFin).toLocaleString()}</td>
    </tr>`).join('');

  zone.innerHTML = `
    ${sectionCard('Risque VIE (retraite)', '#38bdf8', `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
        <div><div style="font-size:11px;color:var(--text-muted)">Avoir théorique à ${ageActuel} ans</div><div style="font-size:16px;font-weight:800;color:var(--text)">CHF ${Math.round(avoirTheoriqueActuel).toLocaleString()}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted)">Avoir réel actuel</div><div style="font-size:16px;font-weight:800;color:var(--text)">CHF ${avoirActuel.toLocaleString()}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted)">Lacune de capital</div><div style="font-size:16px;font-weight:800;color:${lacuneCapital > 0 ? '#f87171' : '#4ade80'}">CHF ${lacuneCapital.toLocaleString()}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:12px">
        <div><div style="font-size:11px;color:var(--text-muted)">Capital LPP projeté à ${ageRetraite} ans</div><div style="font-size:18px;font-weight:900;color:#f59e0b">CHF ${Math.round(capitalProjete).toLocaleString()}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted)">Rente LPP annuelle projetée</div><div style="font-size:18px;font-weight:900;color:#f59e0b">CHF ${renteVieillesseLPP.toLocaleString()}/an</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:12px">
        <tr><td style="padding:4px 0;color:var(--text-muted)">Rente AVS vieillesse estimée (échelle 44, approximation)</td><td style="padding:4px 0;text-align:right;font-weight:700">CHF ${renteVieillesseAVS.toLocaleString()}/an</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-muted)">Rente LPP vieillesse projetée</td><td style="padding:4px 0;text-align:right;font-weight:700">CHF ${renteVieillesseLPP.toLocaleString()}/an</td></tr>
        <tr style="border-top:1px solid var(--border)"><td style="padding:6px 0;font-weight:800">Total rentes projetées</td><td style="padding:6px 0;text-align:right;font-weight:800;color:#38bdf8">CHF ${renteCombineeVie.toLocaleString()}/an</td></tr>
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px">
        <div><div style="font-size:11px;color:var(--text-muted)">Objectif (90% du salaire actuel)</div><div style="font-size:16px;font-weight:800;color:var(--text)">CHF ${objectif90.toLocaleString()}/an</div></div>
        <div><div style="font-size:11px;color:var(--text-muted)">Lacune de rente</div><div style="font-size:16px;font-weight:800;color:${lacuneRenteVie > 0 ? '#f87171' : '#4ade80'}">CHF ${Math.round(lacuneRenteVie).toLocaleString()}/an</div></div>
      </div>
      ${lacuneRenteVie > 0
        ? `<div style="padding:10px 14px;border-radius:9px;background:var(--red-dim);font-size:12px;color:#f87171"><strong>Lacune de rente : CHF ${Math.round(lacuneRenteVie).toLocaleString()}/an</strong> — à combler via 3ème pilier ou rachats LPP.</div>`
        : `<div style="padding:10px 14px;border-radius:9px;background:rgba(74,222,128,0.12);font-size:12px;color:#4ade80"><strong>Objectif de rente atteint.</strong></div>`}
    `)}

    ${statutsEnfants.length ? sectionCard('Enfants à charge — durée de versement des rentes', '#fbbf24', `
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="color:var(--text-muted);font-size:10px;text-transform:uppercase"><th style="padding:4px 8px;text-align:left">Enfant</th><th style="padding:4px 8px;text-align:left">Âge actuel</th><th style="padding:4px 8px;text-align:left">Régime</th><th style="padding:4px 8px;text-align:left">Rente versée jusqu'en</th><th style="padding:4px 8px;text-align:left">Statut</th></tr></thead>
        <tbody>${statutsEnfants.map((s, i) => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:5px 8px">Enfant ${i + 1}</td>
            <td style="padding:5px 8px">${s.age} ans</td>
            <td style="padding:5px 8px;color:var(--text-muted)">${s.limiteAns === 25 ? "Poursuit des études (jusqu'à 25 ans)" : "Standard (jusqu'à 18 ans)"}</td>
            <td style="padding:5px 8px;font-weight:700">${s.anneeCessation}</td>
            <td style="padding:5px 8px">${s.eligible ? '<span style="color:#4ade80">✓ Éligible</span>' : '<span style="color:var(--text-muted)">Hors limite d\u2019âge</span>'}</td>
          </tr>`).join('')}</tbody>
      </table>
    `) : ''}

    ${blocRisque('Risque DÉCÈS', '#f87171', [
      { label: `Rente de veuve/veuf AVS (80% base, estimation)`, montant: renteVeuvageAVS },
      { label: `Rente(s) d'orphelin AVS (40% × ${nbEnfants} enfant(s))`, montant: renteOrphelinAVS },
      { label: `Rente de conjoint LPP (${Math.round(pctConjoint*100)}% de la rente d'invalidité entière)`, montant: renteConjointLPP },
      { label: `Rente(s) d'orphelin LPP (${Math.round(pctOrphelin*100)}% × ${nbEnfants} enfant(s))`, montant: renteOrphelinLPP },
    ], besoinDeces, totalRenteDeces, lacuneDeces, capitalDecesLPP > 0 ? `un capital décès additionnel de CHF ${capitalDecesLPP.toLocaleString()} est prévu au plan (non inclus dans la rente ci-dessus)` : '')}

    ${blocRisque(`Risque INVALIDITÉ (degré simulé : ${degreInvalidite}%)`, '#fb923c', [
      { label: `Rente d'invalidité AVS`, montant: renteInvaliditeAVS },
      { label: `Rente(s) pour enfant d'invalide AVS`, montant: renteEnfantInvaliditeAVS },
      { label: `Rente d'invalidité LPP (fraction ${Math.round(fractionLPP*100)}%)`, montant: renteInvaliditeLPP },
      { label: `Rente(s) pour enfant d'invalide LPP`, montant: renteEnfantInvaliditeLPP },
    ], besoinInvalidite, totalRenteInvalidite, lacuneInvalidite)}

    ${sectionCard('📊 Comparatif visuel — rentes superposées par situation', '#38bdf8', `
      <div style="display:grid;grid-template-columns:1fr;gap:28px;margin-bottom:18px">
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;text-align:center">VIE (retraite)</div>
          ${svgStackedBarChart([
            { label: 'AVS', value: renteVieillesseAVS, color: '#38bdf8' },
            { label: 'LPP', value: renteVieillesseLPP, color: '#f59e0b' },
          ], objectif90, 'Objectif 90%')}
        </div>
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;text-align:center">DÉCÈS</div>
          ${svgStackedBarChart([
            { label: 'Veuve/veuf AVS', value: renteVeuvageAVS, color: '#38bdf8' },
            { label: 'Orphelin AVS', value: renteOrphelinAVS, color: '#60a5fa' },
            { label: 'Conjoint LPP', value: renteConjointLPP, color: '#f59e0b' },
            { label: 'Orphelin LPP', value: renteOrphelinLPP, color: '#fbbf24' },
          ], besoinDeces, 'Besoin')}
        </div>
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;text-align:center">INVALIDITÉ</div>
          ${svgStackedBarChart([
            { label: 'Invalidité AVS', value: renteInvaliditeAVS, color: '#38bdf8' },
            { label: 'Enfant AVS', value: renteEnfantInvaliditeAVS, color: '#60a5fa' },
            { label: 'Invalidité LPP', value: renteInvaliditeLPP, color: '#f59e0b' },
            { label: 'Enfant LPP', value: renteEnfantInvaliditeLPP, color: '#fbbf24' },
          ], besoinInvalidite, 'Besoin')}
        </div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:18px;display:grid;grid-template-columns:1fr;gap:22px">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:2px;text-align:center">CHRONOLOGIE</div>
          ${svgTimelineSchematique(timelineVie, null, 'vie')}
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:2px;text-align:center">CHRONOLOGIE</div>
          ${svgTimelineSchematique(timelineDeces, null, 'deces')}
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:2px;text-align:center">CHRONOLOGIE</div>
          ${svgTimelineSchematique(timelineInvalidite, null, 'inval')}
        </div>
      </div>
    `)}

    ${sectionCard('Détail du parcours LPP réel projeté (année par année, jusqu\'à la retraite)', '#a78bfa', `
      <div style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:10px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead style="position:sticky;top:0;background:var(--surface)"><tr style="color:var(--text-muted);font-size:10px;text-transform:uppercase">
            <th style="padding:6px 8px;text-align:left">Âge</th><th style="padding:6px 8px;text-align:right">État 01.01</th>
            <th style="padding:6px 8px;text-align:right">Intérêts</th><th style="padding:6px 8px;text-align:right">Bonification</th>
            <th style="padding:6px 8px;text-align:right">État 31.12</th>
          </tr></thead>
          <tbody>${tableRows(reel.lignes)}</tbody>
        </table>
      </div>
    `)}

    <div style="font-size:10.5px;color:var(--text-muted);margin:10px 0">⚠️ Les rentes AVS sont estimées par interpolation linéaire (RAMD ≈ salaire actuel) — approximation de branche, ne remplace pas l'extrait de compte individuel AVS officiel du client. Les taux LPP de conjoint/orphelin/invalidité correspondent au minimum légal LPP ; un plan surobligatoire peut prévoir mieux.</div>

    <div style="display:flex;gap:10px;margin-top:10px">
      <button class="btn-secondary" onclick="imprimerResultatLPP()">🖨️ Imprimer / PDF</button>
      <button class="btn-save" onclick="enregistrerBilanSurFiche()">💾 Enregistrer sur la fiche client</button>
    </div>
  `;

  window._lppDernierResultat = {
    naissance, salaireAVS, salaireCoordonne, avoirActuel, ageActuel, ageRetraite,
    avoirTheoriqueActuel, lacuneCapital, capitalProjete, renteVieillesseLPP, renteVieillesseAVS, objectif90, renteCombineeVie, lacuneRenteVie,
    renteVeuvageAVS, renteOrphelinAVS, renteConjointLPP, renteOrphelinLPP, totalRenteDeces, besoinDeces, lacuneDeces, capitalDecesLPP,
    degreInvalidite, renteInvaliditeAVS, renteEnfantInvaliditeAVS, renteInvaliditeLPP, renteEnfantInvaliditeLPP, totalRenteInvalidite, besoinInvalidite, lacuneInvalidite,
    lignesReel: reel.lignes, statutsEnfants,
    adresse: document.getElementById('clpp-adresse').value,
    npaVille: document.getElementById('clpp-npa-ville').value,
    telephone: document.getElementById('clpp-telephone').value,
    email: document.getElementById('clpp-email').value,
  };
}

function imprimerResultatLPP() {
  const r = window._lppDernierResultat;
  if (!r) return;
  const nom = document.getElementById('clpp-nom').value || 'Client';
  const win = window.open('', '_blank');

  const anneeActuelleImpr = new Date().getFullYear();
  const anneeRetraiteImpr = anneeActuelleImpr + (r.ageRetraite - r.ageActuel);
  const jalonsEnfantsImpr = (r.statutsEnfants || []).filter(s => s.eligible).map((s, i) => ({
    titre: `Fin rente enfant ${i + 1}`,
    sousTitre: `${s.limiteAns} ans — ${s.anneeCessation}`,
  }));
  const timelineVieImpression = [
    { titre: 'Aujourd\'hui', sousTitre: `${r.ageActuel} ans — ${anneeActuelleImpr}` },
    { titre: 'Retraite', sousTitre: `${r.ageRetraite} ans — ${anneeRetraiteImpr}` },
  ];
  const timelineDecesImpression = [
    { titre: 'Décès', sousTitre: `${anneeActuelleImpr}` },
    { titre: 'Rente conjoint', sousTitre: 'à vie (jusqu\'à remariage)' },
    ...jalonsEnfantsImpr,
  ];
  const timelineInvaliditeImpression = [
    { titre: 'Jour 1-2', sousTitre: 'Délai d\'attente LAA' },
    { titre: 'Jour 3', sousTitre: 'Début IJ LAA' },
    { titre: 'Invalidité reconnue', sousTitre: `${anneeActuelleImpr}` },
    ...jalonsEnfantsImpr,
  ];

  const rows = r.lignesReel.map(l => `
    <tr><td>${l.age}</td><td style="text-align:right">CHF ${Math.round(l.etatDebut).toLocaleString()}</td><td style="text-align:right">CHF ${Math.round(l.interet).toLocaleString()}</td><td style="text-align:right">CHF ${Math.round(l.bonification).toLocaleString()}</td><td style="text-align:right;font-weight:700">CHF ${Math.round(l.etatFin).toLocaleString()}</td></tr>`).join('');
  win.document.write(`<html><head><title>Bilan de prévoyance — ${nom}</title><style>
    body{font-family:Arial,sans-serif;padding:30px;color:#0f2244}
    .entete{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f2244;padding-bottom:14px;margin-bottom:20px}
    .logo-assurex{font-size:22px;font-weight:900;color:#0f2244;letter-spacing:0.5px}
    .logo-assurex span{color:#c9a24b}
    .coord-assurex{font-size:10.5px;color:#666;margin-top:4px;line-height:1.5}
    .coord-client{text-align:right;font-size:11.5px;color:#0f2244;line-height:1.6}
    .coord-client b{font-size:13px}
    h1{font-size:16px;color:#0f2244;margin:0 0 4px}
    h2{font-size:14px;color:#0f2244;margin-top:26px;border-bottom:1px solid #ddd;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
    th,td{padding:6px 8px;border-bottom:1px solid #ddd}
    th{background:#f2f5fa;text-align:left}
    @media print{ button{display:none !important} }
    .stat{display:inline-block;margin-right:30px;margin-bottom:14px}
    .stat b{display:block;font-size:16px}
    .lacune{color:#c0392b;font-weight:700}
  </style></head><body>
    <div class="entete">
      <div style="display:flex;align-items:center;gap:14px">
        ${genererBadgeLogoAssurex()}
        <div class="coord-assurex">c/o COFIDEX SA · Rue du Centre 142 · 1025 St-Sulpice<br/>Courtier en assurances FINMA F01492173</div>
      </div>
      <div class="coord-client">
        <b>${nom}</b><br/>
        ${r.adresse ? r.adresse + '<br/>' : ''}
        ${r.npaVille ? r.npaVille + '<br/>' : ''}
        ${r.telephone ? '📞 ' + r.telephone + '<br/>' : ''}
        ${r.email ? '✉️ ' + r.email : ''}
      </div>
    </div>
    <h1>Bilan de prévoyance — Vie · Décès · Invalidité</h1>
    <div style="font-size:11px;color:#666;margin-bottom:14px">Document établi le ${new Date().toLocaleDateString('fr-CH')} — à titre indicatif, sur la base des données transmises par le client.</div>

    <h2>Vie (retraite)</h2>
    <div class="stat">Capital projeté à la retraite<b>CHF ${Math.round(r.capitalProjete).toLocaleString()}</b></div>
    <div class="stat">Rente LPP projetée<b>CHF ${r.renteVieillesseLPP.toLocaleString()}/an</b></div>
    <div class="stat">Rente AVS estimée<b>CHF ${r.renteVieillesseAVS.toLocaleString()}/an</b></div>
    <div class="stat">Lacune de rente (objectif 90%)<b class="${r.lacuneRenteVie>0?'lacune':''}">CHF ${Math.round(r.lacuneRenteVie).toLocaleString()}/an</b></div>

    <h2>Décès</h2>
    ${r.statutsEnfants && r.statutsEnfants.length ? `
    <table style="margin-bottom:14px">
      <thead><tr><th>Enfant</th><th>Âge actuel</th><th>Régime</th><th>Rente versée jusqu'en</th></tr></thead>
      <tbody>${r.statutsEnfants.map((s,i) => `<tr><td>Enfant ${i+1}</td><td>${s.age} ans</td><td>${s.limiteAns === 25 ? 'Études (25 ans)' : 'Standard (18 ans)'}</td><td><b>${s.anneeCessation}</b></td></tr>`).join('')}</tbody>
    </table>` : ''}
    <div class="stat">Rente veuve/veuf AVS<b>CHF ${r.renteVeuvageAVS.toLocaleString()}/an</b></div>
    <div class="stat">Rente(s) orphelin AVS<b>CHF ${r.renteOrphelinAVS.toLocaleString()}/an</b></div>
    <div class="stat">Rente conjoint LPP<b>CHF ${r.renteConjointLPP.toLocaleString()}/an</b></div>
    <div class="stat">Rente(s) orphelin LPP<b>CHF ${r.renteOrphelinLPP.toLocaleString()}/an</b></div>
    <div class="stat">Besoin estimé<b>CHF ${r.besoinDeces.toLocaleString()}/an</b></div>
    <div class="stat">Lacune<b class="${r.lacuneDeces>0?'lacune':''}">CHF ${Math.round(r.lacuneDeces).toLocaleString()}/an</b></div>
    ${r.capitalDecesLPP > 0 ? `<div class="stat">Capital décès LPP additionnel<b>CHF ${r.capitalDecesLPP.toLocaleString()}</b></div>` : ''}

    <h2>Invalidité (degré simulé : ${r.degreInvalidite}%)</h2>
    <div class="stat">Rente invalidité AVS<b>CHF ${r.renteInvaliditeAVS.toLocaleString()}/an</b></div>
    <div class="stat">Rente(s) enfant AVS<b>CHF ${r.renteEnfantInvaliditeAVS.toLocaleString()}/an</b></div>
    <div class="stat">Rente invalidité LPP<b>CHF ${r.renteInvaliditeLPP.toLocaleString()}/an</b></div>
    <div class="stat">Rente(s) enfant LPP<b>CHF ${r.renteEnfantInvaliditeLPP.toLocaleString()}/an</b></div>
    <div class="stat">Besoin estimé<b>CHF ${r.besoinInvalidite.toLocaleString()}/an</b></div>
    <div class="stat">Lacune<b class="${r.lacuneInvalidite>0?'lacune':''}">CHF ${Math.round(r.lacuneInvalidite).toLocaleString()}/an</b></div>

    <h2>Comparatif visuel — rentes superposées</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
      <div>
        <div style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px;text-align:center">Vie (retraite)</div>
        ${svgStackedBarChart([
          { label: 'AVS', value: r.renteVieillesseAVS, color: '#2563eb' },
          { label: 'LPP', value: r.renteVieillesseLPP, color: '#d97706' },
        ], r.objectif90, 'Objectif 90%', { texte: '#0f2244', muted: '#666', bordure: '#ccc' })}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px;text-align:center">Décès</div>
        ${svgStackedBarChart([
          { label: 'Veuve/veuf AVS', value: r.renteVeuvageAVS, color: '#2563eb' },
          { label: 'Orphelin AVS', value: r.renteOrphelinAVS, color: '#60a5fa' },
          { label: 'Conjoint LPP', value: r.renteConjointLPP, color: '#d97706' },
          { label: 'Orphelin LPP', value: r.renteOrphelinLPP, color: '#fbbf24' },
        ], r.besoinDeces, 'Besoin', { texte: '#0f2244', muted: '#666', bordure: '#ccc' })}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px;text-align:center">Invalidité</div>
        ${svgStackedBarChart([
          { label: 'Invalidité AVS', value: r.renteInvaliditeAVS, color: '#2563eb' },
          { label: 'Enfant AVS', value: r.renteEnfantInvaliditeAVS, color: '#60a5fa' },
          { label: 'Invalidité LPP', value: r.renteInvaliditeLPP, color: '#d97706' },
          { label: 'Enfant LPP', value: r.renteEnfantInvaliditeLPP, color: '#fbbf24' },
        ], r.besoinInvalidite, 'Besoin', { texte: '#0f2244', muted: '#666', bordure: '#ccc' })}
      </div>
    </div>

    <h2 style="margin-top:20px">Chronologie des événements</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:10px">
      <div>${svgTimelineSchematique(timelineVieImpression, { texte: '#0f2244', muted: '#666', bordure: '#ccc', accent: '#2563eb' }, 'p-vie')}</div>
      <div>${svgTimelineSchematique(timelineDecesImpression, { texte: '#0f2244', muted: '#666', bordure: '#ccc', accent: '#2563eb' }, 'p-deces')}</div>
      <div>${svgTimelineSchematique(timelineInvaliditeImpression, { texte: '#0f2244', muted: '#666', bordure: '#ccc', accent: '#2563eb' }, 'p-inval')}</div>
    </div>

    <h2>Détail du parcours LPP (année par année)</h2>
    <table><thead><tr><th>Âge</th><th>État 01.01</th><th>Intérêts</th><th>Bonification</th><th>État 31.12</th></tr></thead><tbody>${rows}</tbody></table>

    <p style="font-size:10px;color:#888;margin-top:20px">Rentes AVS estimées par interpolation linéaire (approximation) — ne remplace pas l'extrait de compte individuel AVS officiel.</p>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#0f2244;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimer / Enregistrer en PDF</button>
  </body></html>`);
  win.document.close();
}

// ═══ ENREGISTREMENT DU BILAN SUR LA FICHE CLIENT ═══
async function enregistrerBilanSurFiche() {
  const r = window._lppDernierResultat;
  if (!r) { showError('Calcule d\'abord le bilan avant de l\'enregistrer.'); return; }
  const clientId = document.getElementById('clpp-client').value;
  if (!clientId) { showError('Sélectionne un client existant dans la liste déroulante pour pouvoir enregistrer ce bilan sur sa fiche.'); return; }
  const nom = document.getElementById('clpp-nom').value || 'Client';
  const resume = `Vie : ${r.lacuneRenteVie > 0 ? 'lacune CHF ' + Math.round(r.lacuneRenteVie).toLocaleString() + '/an' : 'objectif atteint'} · Décès : ${r.lacuneDeces > 0 ? 'lacune CHF ' + Math.round(r.lacuneDeces).toLocaleString() + '/an' : 'couvert'} · Invalidité : ${r.lacuneInvalidite > 0 ? 'lacune CHF ' + Math.round(r.lacuneInvalidite).toLocaleString() + '/an' : 'couvert'}`;
  const htmlSnapshot = document.getElementById('clpp-resultats').innerHTML;
  const btn = event.target;
  btn.textContent = 'Enregistrement...'; btn.disabled = true;
  const created = await dbPost('bilans_prevoyance', { client_id: clientId, nom, resume, html_snapshot: htmlSnapshot });
  btn.disabled = false;
  if (created && created.error) { showError('Erreur lors de l\'enregistrement : ' + errMsg(created)); btn.textContent = '💾 Enregistrer sur la fiche client'; return; }
  btn.textContent = '✓ Enregistré sur la fiche';
  setTimeout(() => { btn.textContent = '💾 Enregistrer sur la fiche client'; }, 2500);
}

// Récupère les bilans de prévoyance enregistrés pour un client donné
async function getBilansPrevoyanceClient(clientId) {
  return await dbGet('bilans_prevoyance', `client_id=eq.${clientId}&select=*&order=created_at.desc`).catch(() => []);
}

// Affiche un bilan sauvegardé dans une modale en lecture seule
function voirBilanSauvegarde(bilanId) {
  const bilans = window._bilansPrevoyanceActuel || [];
  const b = bilans.find(x => x.id === bilanId);
  if (!b) return;
  const modal = creerModale('modal-bilan-lpp', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:900px;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <h3 style="margin:0;font-size:16px;font-weight:800;color:var(--text)">Bilan de prévoyance — ${fmtDate(b.created_at)}</h3>
        <button onclick="document.getElementById('modal-bilan-lpp').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px">✕</button>
      </div>
      ${b.html_snapshot}
    </div>`);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

// Catalogue des produits d'assurance par catégorie, avec modules complémentaires (à enrichir au fur et à mesure)
const CATALOGUE_PRODUITS = {
  'Responsabilité civile': [
    { id: 'rc_privee', label: 'RC privée', segment: 'prive', modules: ['Véhicules de location / autopartage', 'Animaux domestiques (logement loué)', 'Location de chevaux', 'Usage occasionnel véhicule de tiers'], combinables: ['menage'] },
    { id: 'rc_inventaire', label: 'RC + inventaire du ménage', segment: 'prive', modules: ['Objets de valeur', 'Vol hors domicile', 'Animaux de compagnie'] },
    { id: 'rc_entreprise', label: 'RC entreprise / exploitation', segment: 'entreprise', modules: ['RC produits', 'Dommages environnementaux soudains', 'RC maître d\'ouvrage'] },
    { id: 'rc_pro', label: 'RC professionnelle (erreurs, omissions, préjudices de fortune)', segment: 'entreprise', modules: ['Erreurs / omissions', 'Préjudices purement pécuniaires', 'Cyber-risque professionnel', 'Violation de propriété intellectuelle'] },
    { id: 'rc_commerce', label: 'RC commerce / exploitation commerciale', segment: 'entreprise', modules: ['Rappel de produits', 'Pollution accidentelle'] },
    { id: 'rc_do', label: 'RC D&O (administrateurs et dirigeants)', segment: 'entreprise', modules: ['Frais de défense', 'Extension filiales', 'Extension mandats externes (fondations, associations)', 'Side A/B/C'] },
    { id: 'rc_batiment', label: 'RC bâtiments / propriétaire immobilier', segment: 'tous', modules: ['Bris de glace bâtiment', 'Dommages aux locataires'] },
    { id: 'rc_vehicule', label: 'RC véhicule à moteur (obligatoire)', segment: 'tous', modules: [], combinables: ['casco_partielle', 'casco_complete'] },
    { id: 'rc_drone', label: 'RC drone', segment: 'tous', modules: [] },
  ],
  'Ménage / habitation': [
    { id: 'menage', label: 'Inventaire du ménage', segment: 'prive', modules: ['Vol hors domicile', 'Bris de glace vitrages mobilier', 'Bris de glace bâtiment', 'Tremblement de terre', 'Objets de valeur', 'Animaux de compagnie', 'Cyberprotection'] },
  ],
  'Bâtiment': [
    { id: 'batiment_prive', label: 'Bâtiment privé (propriétaire)', segment: 'prive', modules: ['Bris de glace bâtiment (fenêtres, portes)', 'Équipements encastrés', 'Jardin / constructions extérieures', 'Tremblement de terre'] },
    { id: 'batiment_entreprise', label: 'Bâtiment commercial / locaux professionnels', segment: 'entreprise', modules: ['Bris de glace bâtiment', 'Pertes d\'exploitation suite sinistre', 'Tremblement de terre', 'Vol et vandalisme'] },
  ],
  'Véhicule': [
    { id: 'vehicule_rc', label: 'RC véhicule (obligatoire)', segment: 'tous', modules: [], combinables: ['casco_partielle', 'casco_complete'] },
    { id: 'casco_partielle', label: 'Casco partielle', segment: 'tous', modules: ['Bris de glace étendu (phares, rétroviseurs)', 'Dommages au véhicule parqué', 'Véhicule de remplacement', 'Dépannage / assistance', 'Objets transportés', 'Batterie / borne e-mobilité'] },
    { id: 'casco_complete', label: 'Casco complète', segment: 'tous', modules: ['Bris de glace étendu (phares, rétroviseurs)', 'Protection du bonus', 'Faute grave', 'Dommages au véhicule parqué', 'Véhicule de remplacement', 'Dépannage / assistance', 'Objets transportés', 'Batterie / borne e-mobilité'] },
    { id: 'flotte_entreprise', label: 'Flotte véhicules entreprise (plaques multiples)', segment: 'entreprise', modules: ['Casco partielle flotte', 'Casco complète flotte', 'Conducteurs multiples', 'Véhicules de remplacement flotte'], flotte: true },
  ],
  'Protection juridique': [
    { id: 'pj_privee', label: 'Protection juridique privée', segment: 'prive', modules: [] },
    { id: 'pj_circulation', label: 'Protection juridique circulation routière', segment: 'tous', modules: [] },
    { id: 'pj_pro', label: 'Protection juridique professionnelle / entreprise', segment: 'entreprise', modules: [] },
    { id: 'pj_contractuelle', label: 'Protection juridique contractuelle (véhicules)', segment: 'tous', modules: [] },
  ],
  'Prévoyance': [
    // ── Pilier 3a ────────────────────────────────────────────────────────
    { id: 'vie_3a', label: 'Assurance vie liée 3a (pilier 3a)', segment: 'prive', modules: ['Risque pur (décès/invalidité)', 'Mixte (épargne + risque)', 'Fonds de placement 3a'] },
    { id: 'compte_3a', label: 'Compte de prévoyance 3a (bancaire)', segment: 'prive', modules: [] },
    // ── Pilier 3b ────────────────────────────────────────────────────────
    { id: 'vie_3b_mixte', label: 'Assurance vie mixte 3b (pilier 3b)', segment: 'prive', modules: ['Épargne + risque', 'Capital garanti', 'Participation aux excédents'] },
    { id: 'vie_3b_risque', label: 'Assurance vie risque pur 3b', segment: 'prive', modules: ['Décès seul', 'Décès + invalidité'] },
    { id: 'vie_3b_placement', label: 'Assurance vie placement 3b (Swiss Life Select / BVG)', segment: 'prive', modules: [] },
    // ── Libre passage / autres ───────────────────────────────────────────
    { id: 'libre_passage', label: 'Police de libre passage (LPP sortie)', segment: 'prive', modules: [] },
    { id: 'prevoyance_enfant', label: 'Prévoyance enfant', segment: 'prive', modules: [] },
    // ── LPP 2e pilier entreprise ─────────────────────────────────────────
    { id: 'lpp_entreprise', label: 'LPP collective (2e pilier entreprise)', segment: 'tous', modules: ['Business Invest', 'Business Premium', 'Business Select', 'Prime Solution', 'Business Protect', 'Company Protect'] },
    { id: 'lpp_individuelle', label: 'LPP rachat / versement volontaire', segment: 'tous', modules: [] },
  ],
  'Santé': [
    { id: 'lamal', label: 'LAMal (assurance de base)', segment: 'prive', compagnie_fixe: null, modules: [] },
    // ── CSS ──────────────────────────────────────────────────────────────
    { id: 'css_myflex_ambulatoire', label: 'CSS myFlex — Ambulatoire', segment: 'prive', compagnie_fixe: 'CSS', modules: ['Médecin de famille (telmed)', 'Pharmacie directe', 'Libre choix du médecin'] },
    { id: 'css_myflex_hospitalisation', label: 'CSS myFlex — Hospitalisation', segment: 'prive', compagnie_fixe: 'CSS', modules: ['Division commune', 'Semi-privée', 'Privée', 'Toute la Suisse', 'Monde entier'] },
    { id: 'css_myflex_medecines', label: 'CSS myFlex — Médecines naturelles', segment: 'prive', compagnie_fixe: 'CSS', modules: [] },
    { id: 'css_myflex_dental', label: 'CSS myFlex — Dental', segment: 'prive', compagnie_fixe: 'CSS', modules: [] },
    // ── Helsana ──────────────────────────────────────────────────────────
    { id: 'helsana_top', label: 'Helsana TOP (ambulatoire)', segment: 'prive', compagnie_fixe: 'Helsana', modules: [] },
    { id: 'helsana_completa', label: 'Helsana COMPLETA (ambulatoire + hospit.)', segment: 'prive', compagnie_fixe: 'Helsana', modules: ['Division commune', 'Semi-privée', 'Privée'] },
    { id: 'helsana_sana', label: 'Helsana SANA (médecines alternatives)', segment: 'prive', compagnie_fixe: 'Helsana', modules: [] },
    { id: 'helsana_dental', label: 'Helsana DENTAL', segment: 'prive', compagnie_fixe: 'Helsana', modules: [] },
    { id: 'helsana_plus', label: 'Helsana PLUS (prévention & fitness)', segment: 'prive', compagnie_fixe: 'Helsana', modules: [] },
    // ── Groupe Mutuel ─────────────────────────────────────────────────────
    { id: 'gm_optisana', label: 'GM Optisana A (ambulatoire)', segment: 'prive', compagnie_fixe: 'Groupe Mutuel', modules: [] },
    { id: 'gm_hopital', label: 'GM Complément Hôpital', segment: 'prive', compagnie_fixe: 'Groupe Mutuel', modules: ['Division commune', 'Semi-privée', 'Privée'] },
    { id: 'gm_globalcare', label: 'GM Global Care', segment: 'prive', compagnie_fixe: 'Groupe Mutuel', modules: [] },
    { id: 'gm_denta', label: 'GM Denta Plus', segment: 'prive', compagnie_fixe: 'Groupe Mutuel', modules: [] },
    { id: 'gm_medoucine', label: 'GM Médecines douces', segment: 'prive', compagnie_fixe: 'Groupe Mutuel', modules: [] },
    // ── SWICA ─────────────────────────────────────────────────────────────
    { id: 'swica_completa', label: 'SWICA COMPLETA (ambulatoire)', segment: 'prive', compagnie_fixe: 'SWICA', modules: [] },
    { id: 'swica_hospita', label: 'SWICA HOSPITA (hospitalisation)', segment: 'prive', compagnie_fixe: 'SWICA', modules: ['Division commune', 'Semi-privée', 'Privée', 'Monde entier'] },
    { id: 'swica_denta', label: 'SWICA DENTA', segment: 'prive', compagnie_fixe: 'SWICA', modules: [] },
    { id: 'swica_praeventa', label: 'SWICA PRAEVENTA (prévention)', segment: 'prive', compagnie_fixe: 'SWICA', modules: [] },
    // ── Complémentaire générique (autres compagnies) ───────────────────────
    { id: 'sante_complementaire', label: 'Complémentaire santé — autre compagnie', segment: 'prive', modules: [] },
  ],
  'Assurances de personnes (entreprise)': [
    { id: 'laa', label: 'LAA (assurance-accidents obligatoire)', segment: 'entreprise', modules: ['Accidents professionnels (AP)', 'Accidents non professionnels (ANP)', 'Sursalaire LAA complémentaire'] },
    { id: 'laac', label: 'LAAC — LAA complémentaire (sursalaire au-delà du plafond LAA)', segment: 'entreprise', modules: [] },
    { id: 'perte_gain_maladie_collective', label: 'Perte de gain maladie collective', segment: 'entreprise', modules: ['Délai d\'attente réduit', 'Couverture 720 jours étendue'] },
    { id: 'perte_gain_accident_collective', label: 'Perte de gain accident collective (complémentaire LAA)', segment: 'entreprise', modules: [] },
    { id: 'sante_collective_entreprise', label: 'Assurance maladie collective entreprise', segment: 'entreprise', modules: [] },
  ],
  'Entreprise — risques spécifiques': [
    { id: 'pertes_exploitation', label: 'Perte d\'exploitation', segment: 'entreprise', modules: [] },
    { id: 'cyber_entreprise', label: 'Cyber-risque entreprise', segment: 'entreprise', modules: [] },
    { id: 'choses_entreprise', label: 'Assurance choses / inventaire commercial', segment: 'entreprise', modules: ['Vol et vandalisme', 'Bris de machine', 'Marchandises en transit'] },
  ],
  'Autre': [
    { id: 'autre', label: 'Autre (saisie manuelle)', segment: 'tous', modules: [] },
  ],
};

let msalAccessToken = null;
let calendarEvents = [];

// ═══ RÔLES (non sensible — les mots de passe sont gérés par Supabase Auth) ═══
// ═══ LOGO OZ ASSURE (navigation) ═══
const ASSUREX_LOGO_WORDMARK_PNG = "data:image/png;base64,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";

const ASSUREX_LOGO_SVG = `<svg class="assurex-logo-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 900" style="display:block"><defs><style>.assurex-c1{fill:#fff}.assurex-c2{fill:#113679}.assurex-c3{fill:#00cfff}</style></defs><rect class="assurex-c2" x="-19.09" y="-9.92" width="1338.18" height="919.85" rx="16.94" ry="16.94"/><g><rect class="assurex-c3" x="833.34" y="457.74" width="12.39" height="12.39"/><g><path class="assurex-c1" d="M713.01,448.18v-4.39c0-4.99-3.69-8.3-9.01-8.3h-29.56v6.84h27.99c1.74,0,3.04,1.09,3.04,2.82v2.12c0,1.74-1.09,2.87-3.04,2.87h-27.99v19.37h7.65v-12.53h14.92l7.92,12.53h8.62l-7.76-12.64c4.56-.65,7.21-3.96,7.21-8.68"/><path class="assurex-c1" d="M519.1,444.47v2.41c0,1.19.96,2.15,2.15,2.15h19.35c4.39,0,7.95,3.56,7.95,7.95v4.55c0,4.39-3.56,7.95-7.95,7.95h-28.34v-6.89h27.3c1.19,0,2.15-.96,2.15-2.15v-2.41c0-1.19-.96-2.15-2.15-2.15h-19.35c-4.39,0-7.95-3.56-7.95-7.95v-4.5c0-4.39,3.56-7.95,7.95-7.95h28.34v6.84h-27.3c-1.19,0-2.15.96-2.15,2.15Z"/><path class="assurex-c1" d="M572.42,444.47v2.41c0,1.19.96,2.15,2.15,2.15h19.35c4.39,0,7.95,3.56,7.95,7.95v4.55c0,4.39-3.56,7.95-7.95,7.95h-28.34v-6.89h27.3c1.19,0,2.15-.96,2.15-2.15v-2.41c0-1.19-.96-2.15-2.15-2.15h-19.35c-4.39,0-7.95-3.56-7.95-7.95v-4.5c0-4.39,3.56-7.95,7.95-7.95h28.34v6.84h-27.3c-1.19,0-2.15.96-2.15,2.15Z"/><polygon class="assurex-c1" points="476.36 445.03 462.9 469.5 454.28 469.5 472.99 435.48 479.66 435.48 498.43 469.5 489.86 469.5 476.36 445.03"/><path class="assurex-c1" d="M657.41,435.49v22.44c0,6.39-5.18,11.58-11.58,11.58h-15.37c-6.39,0-11.58-5.18-11.58-11.58v-22.44h7.71v22.24c0,2.25,1.82,4.06,4.06,4.06h14.97c2.25,0,4.06-1.82,4.06-4.06v-22.24h7.71Z"/><rect class="assurex-c1" x="730.03" y="448.77" width="33.14" height="6.89"/><rect class="assurex-c1" x="730.03" y="462.61" width="36.29" height="6.89"/><rect class="assurex-c1" x="730.03" y="435.48" width="36.29" height="6.84"/><polygon class="assurex-c1" points="829.79 420 828.7 426.86 828.52 428.04 826.9 438.23 822.57 434.54 810.97 447.22 801.38 447.22 806.2 452.43 821.91 469.4 811.72 469.4 801.12 457.92 781.15 480 771.14 480 796.05 452.42 780.4 435.48 790.52 435.48 801.29 447.1 816.91 429.72 812.63 426.06 829.79 420"/></g></g></svg>`;

const OZASSURE_LOGO_SVG = `<svg class="oz-logo-svg" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 1920 434">
  <defs>
    <style>
      .st0 {
        fill: #fff;
        stroke: #fff;
        stroke-miterlimit: 10;
      }
    </style>
  </defs>
  <g>
    <path class="st0" d="M412.66,315.97c-20.52,0-38.83-4.73-54.95-14.19-16.12-9.45-28.84-22.38-38.17-38.77-9.33-16.39-13.99-35.1-13.99-56.15s4.66-39.76,13.99-56.15c9.32-16.39,22.04-29.3,38.17-38.76,16.12-9.45,34.43-14.19,54.95-14.19s38.43,4.73,54.55,14.19c16.12,9.46,28.84,22.38,38.17,38.76,9.32,16.39,13.99,35.11,13.99,56.15s-4.67,39.76-13.99,56.15c-9.33,16.39-22.05,29.31-38.17,38.77-16.12,9.46-34.31,14.19-54.55,14.19ZM412.66,278.41c12.52,0,23.71-3.13,33.57-9.39,9.85-6.26,17.58-14.79,23.18-25.58,5.59-10.79,8.25-22.98,7.99-36.57.26-13.85-2.4-26.18-7.99-36.97-5.59-10.79-13.33-19.25-23.18-25.38-9.86-6.13-21.05-9.19-33.57-9.19s-23.78,3.13-33.77,9.39c-9.99,6.26-17.78,14.79-23.38,25.58-5.59,10.79-8.26,22.98-7.99,36.57-.27,13.59,2.4,25.78,7.99,36.57,5.59,10.79,13.39,19.32,23.38,25.58,9.99,6.26,21.24,9.39,33.77,9.39Z"/>
    <path class="st0" d="M551.33,311.98v-34.37l108.3-144.67v4.8h-108.3v-35.57h153.06v33.57l-106.7,142.67-1.6-2h110.7v35.57h-155.46Z"/>
    <path class="st0" d="M842.26,315.97c-19.45,0-36.84-4.6-52.15-13.79-15.32-9.19-27.38-21.84-36.17-37.97-8.79-16.12-13.19-34.57-13.19-55.35s4.53-39.76,13.59-56.15c9.05-16.39,21.11-29.24,36.17-38.57,15.05-9.32,31.77-13.99,50.15-13.99,11.19,0,21.84,1.74,31.97,5.2,10.12,3.47,19.18,8.39,27.17,14.79,7.99,6.39,14.72,13.99,20.18,22.78,5.46,8.79,9.12,18.52,10.99,29.17l-2.4-1.2.8-68.74h7.99v209.81h-8.79v-68.74l3.6-1.2c-2.4,10.66-6.33,20.52-11.79,29.57-5.46,9.06-12.19,16.92-20.18,23.58-7.99,6.66-16.85,11.79-26.58,15.39-9.73,3.6-20.18,5.4-31.37,5.4ZM842.26,307.18c16.25,0,30.97-4.2,44.16-12.59s23.58-20.04,31.17-34.97c7.59-14.92,11.39-32.1,11.39-51.55s-3.8-36.23-11.39-51.15c-7.59-14.92-17.98-26.64-31.17-35.17-13.19-8.52-28.17-12.79-44.96-12.79-17.85,0-33.71,4.27-47.56,12.79-13.86,8.53-24.65,20.32-32.37,35.37-7.73,15.06-11.59,32.31-11.59,51.75s3.86,35.77,11.59,50.55c7.72,14.79,18.51,26.44,32.37,34.97,13.85,8.53,29.97,12.79,48.36,12.79Z"/>
    <path class="st0" d="M1064.46,315.97c-17.58,0-33.57-3.33-47.96-9.99-14.39-6.66-25.45-15.45-33.17-26.38l6.79-5.99c7.46,9.86,17.58,17.92,30.37,24.18,12.79,6.26,27.71,9.39,44.76,9.39,10.92,0,20.24-1.33,27.97-4,7.72-2.66,13.99-6.26,18.78-10.79,4.8-4.53,8.39-9.65,10.79-15.39,2.4-5.73,3.6-11.79,3.6-18.18,0-13.05-5.59-23.31-16.79-30.77-5.33-4-11.99-7.46-19.98-10.39-7.99-2.93-17.32-5.6-27.97-7.99-11.99-2.93-22.58-6.26-31.77-9.99-9.19-3.73-16.72-7.99-22.58-12.79-5.33-4.53-9.33-9.39-11.99-14.59-2.67-5.2-4-10.99-4-17.38,0-8.25,1.66-15.72,5-22.38,3.33-6.66,7.99-12.45,13.99-17.38,5.99-4.93,13.32-8.65,21.98-11.19,8.66-2.53,18.32-3.8,28.97-3.8,9.32,0,18.38,1.34,27.17,4,8.79,2.67,17.05,6.53,24.78,11.59,7.72,5.06,14.65,11.19,20.78,18.38l-6.39,7.19c-5.86-6.66-12.26-12.45-19.18-17.38-6.93-4.93-14.33-8.65-22.18-11.19-7.86-2.53-16.18-3.8-24.98-3.8-9.59,0-18.18,1.14-25.78,3.4-7.59,2.27-14.06,5.46-19.38,9.59-5.33,4.13-9.33,8.93-11.99,14.39-2.67,5.46-4,11.53-4,18.18,0,4.53.93,8.93,2.8,13.19,1.86,4.27,4.93,8.13,9.19,11.59,5.33,4.53,12.32,8.53,20.98,11.99,8.65,3.47,18.71,6.53,30.17,9.19,11.99,2.67,22.44,5.66,31.37,8.99,8.92,3.33,16.32,7.26,22.18,11.79,6.12,4.53,10.72,9.86,13.79,15.99,3.06,6.13,4.6,13.33,4.6,21.58,0,11.46-2.8,21.52-8.39,30.17-5.59,8.66-13.72,15.32-24.38,19.98-10.66,4.66-23.32,6.99-37.97,6.99Z"/>
    <path class="st0" d="M1255.88,315.97c-17.58,0-33.57-3.33-47.96-9.99-14.39-6.66-25.45-15.45-33.17-26.38l6.79-5.99c7.46,9.86,17.58,17.92,30.37,24.18,12.79,6.26,27.71,9.39,44.76,9.39,10.92,0,20.24-1.33,27.97-4,7.72-2.66,13.99-6.26,18.78-10.79,4.8-4.53,8.39-9.65,10.79-15.39,2.4-5.73,3.6-11.79,3.6-18.18,0-13.05-5.59-23.31-16.79-30.77-5.33-4-11.99-7.46-19.98-10.39-7.99-2.93-17.32-5.6-27.97-7.99-11.99-2.93-22.58-6.26-31.77-9.99-9.19-3.73-16.72-7.99-22.58-12.79-5.33-4.53-9.33-9.39-11.99-14.59-2.67-5.2-4-10.99-4-17.38,0-8.25,1.66-15.72,5-22.38,3.33-6.66,7.99-12.45,13.99-17.38,5.99-4.93,13.32-8.65,21.98-11.19,8.66-2.53,18.32-3.8,28.97-3.8,9.32,0,18.38,1.34,27.17,4,8.79,2.67,17.05,6.53,24.78,11.59,7.72,5.06,14.65,11.19,20.78,18.38l-6.39,7.19c-5.86-6.66-12.26-12.45-19.18-17.38-6.93-4.93-14.33-8.65-22.18-11.19-7.86-2.53-16.18-3.8-24.98-3.8-9.59,0-18.18,1.14-25.78,3.4-7.59,2.27-14.06,5.46-19.38,9.59-5.33,4.13-9.33,8.93-11.99,14.39-2.67,5.46-4,11.53-4,18.18,0,4.53.93,8.93,2.8,13.19,1.86,4.27,4.93,8.13,9.19,11.59,5.33,4.53,12.32,8.53,20.98,11.99,8.65,3.47,18.71,6.53,30.17,9.19,11.99,2.67,22.44,5.66,31.37,8.99,8.92,3.33,16.32,7.26,22.18,11.79,6.12,4.53,10.72,9.86,13.79,15.99,3.06,6.13,4.6,13.33,4.6,21.58,0,11.46-2.8,21.52-8.39,30.17-5.59,8.66-13.72,15.32-24.38,19.98-10.66,4.66-23.32,6.99-37.97,6.99Z"/>
    <path class="st0" d="M1453.3,315.97c-16.25,0-30.04-2.87-41.36-8.59-11.33-5.73-19.92-14.72-25.78-26.98-5.86-12.25-8.79-27.97-8.79-47.16V102.17h8.79v131.08c0,17.32,2.6,31.44,7.79,42.36,5.2,10.93,12.85,18.92,22.98,23.98,10.12,5.06,22.51,7.59,37.17,7.59,9.59,0,18.71-2,27.38-5.99,8.65-4,16.32-8.99,22.98-14.99,6.66-5.99,11.85-12.05,15.59-18.18,3.73-6.13,5.6-11.32,5.6-15.59V102.17h8.79v209.81h-7.99l-.8-48.36,3.6-.8c-3.2,9.59-8.53,18.38-15.99,26.38-7.46,7.99-16.32,14.46-26.58,19.38-10.26,4.93-21.38,7.39-33.37,7.39Z"/>
    <path class="st0" d="M1591.18,311.98V102.17h7.99l.4,50.75-2.4.8c1.86-8.79,5.66-17.25,11.39-25.38,5.73-8.12,13.45-14.85,23.18-20.18,9.72-5.33,21.24-7.99,34.57-7.99,4.53,0,8.72.27,12.59.8,3.86.54,7.39,1.34,10.59,2.4l-2.8,9.19c-4.26-1.33-8.33-2.26-12.19-2.8-3.87-.53-7.26-.8-10.19-.8-10.66,0-20.05,2.14-28.17,6.39-8.13,4.27-14.86,9.86-20.18,16.79-5.33,6.93-9.33,14.32-11.99,22.18-2.67,7.86-4,15.39-4,22.58v135.08h-8.79Z"/>
    <path class="st0" d="M1797.39,315.97c-20.25,0-38.1-4.66-53.55-13.99-15.46-9.32-27.51-22.24-36.17-38.76-8.66-16.52-12.99-35.3-12.99-56.35,0-15.72,2.4-30.1,7.19-43.16,4.8-13.05,11.52-24.31,20.18-33.77,8.65-9.45,18.98-16.78,30.97-21.98s25.18-7.79,39.56-7.79c13.32,0,25.58,2.2,36.77,6.59,11.19,4.4,20.84,10.79,28.97,19.18,8.12,8.39,14.32,18.45,18.58,30.17,4.26,11.73,6.12,24.92,5.59,39.56l-.4,10.39h-182.64v-8.79h178.24l-4.8,6.79.8-9.99c0-17.05-3.6-31.97-10.79-44.76-7.19-12.79-16.85-22.71-28.97-29.77-12.13-7.06-25.51-10.59-40.16-10.59-18.12,0-33.91,4.2-47.36,12.59-13.46,8.39-23.92,19.98-31.37,34.77-7.46,14.79-11.33,31.64-11.59,50.55.26,19.45,4.4,36.77,12.39,51.95,7.99,15.19,18.98,27.04,32.97,35.57,13.99,8.53,30.17,12.79,48.56,12.79,13.85,0,26.64-2.53,38.37-7.59,11.72-5.06,22.24-11.99,31.57-20.78l4.8,7.19c-6.66,6.13-13.79,11.39-21.38,15.79s-15.85,7.86-24.78,10.39c-8.93,2.53-18.45,3.8-28.57,3.8Z"/>
  </g>
  <g>
    <path class="st0" d="M134.26,156.95c0,18.34-8.92,34.6-22.66,44.69l-52.84,6.92c-20.63-8.06-35.26-28.12-35.26-51.61,0-30.58,24.8-55.38,55.38-55.38,30.58,0,55.38,24.8,55.38,55.38Z"/>
    <path class="st0" d="M188.32,192.54l-.43.43c-10.37.86-19.64,1.51-29.8,2.58l-7.23.95c-10.25-10.06-16.6-24.06-16.6-39.55,0-5.6.83-11,2.38-16.09l51.67,51.67Z"/>
    <path class="st0" d="M245.03,156.95c0,16.89-7.55,32-19.48,42.17l-78.06-78.07c10.15-11.92,25.26-19.48,42.15-19.48,30.58,0,55.38,24.8,55.38,55.38Z"/>
    <path class="st0" d="M245.03,269.25c0,30.58-24.8,55.38-55.38,55.38-30.58,0-55.38-24.8-55.38-55.38,0-23.17,14.25-43.03,34.44-51.27l27.97-3.66h.02c27.26,3.46,48.34,26.74,48.34,54.94Z"/>
    <path class="st0" d="M121.77,304.28c-10.15,12.41-25.6,20.35-42.89,20.35-30.58,0-55.38-24.8-55.38-55.38,0-17.29,7.94-32.74,20.35-42.89l77.92,77.92Z"/>
    <path class="st0" d="M134.26,269.25c0,5.26-.74,10.37-2.11,15.18l-55-55,.43-.43c10.14-.65,19.65-1.51,29.78-3.02l5.22-.68c13.18,10.11,21.68,26.03,21.68,43.94Z"/>
  </g>
</svg>`;

const OZASSURE_LOGO_PRIMARY_SVG = `<svg class="oz-logo-primary-svg" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 1920 1080">
  <defs>
    <style>
      .st0 {
        fill: #fff;
        stroke: #fff;
        stroke-miterlimit: 10;
      }
    </style>
  </defs>
  <g>
    <path class="st0" d="M147.57,870.67c-24.52,0-46.4-5.65-65.66-16.95-19.26-11.3-34.46-26.74-45.6-46.32-11.15-19.58-16.71-41.94-16.71-67.09s5.57-47.51,16.71-67.09c11.14-19.58,26.34-35.01,45.6-46.32,19.26-11.3,41.14-16.95,65.66-16.95s45.91,5.66,65.18,16.95c19.26,11.3,34.45,26.74,45.6,46.32,11.14,19.58,16.71,41.95,16.71,67.09s-5.57,47.51-16.71,67.09c-11.15,19.58-26.34,35.02-45.6,46.32-19.26,11.3-40.99,16.95-65.18,16.95ZM147.57,825.79c14.96,0,28.33-3.74,40.11-11.22,11.77-7.48,21.01-17.67,27.69-30.56s9.86-27.46,9.55-43.69c.31-16.55-2.87-31.28-9.55-44.17s-15.92-22.99-27.69-30.32c-11.78-7.32-25.15-10.98-40.11-10.98s-28.41,3.75-40.35,11.22c-11.94,7.48-21.25,17.67-27.93,30.56-6.68,12.89-9.87,27.46-9.55,43.69-.32,16.23,2.87,30.8,9.55,43.69,6.69,12.89,16,23.08,27.93,30.56,11.94,7.48,25.38,11.22,40.35,11.22Z"/>
    <path class="st0" d="M313.26,865.9v-41.06l129.4-172.85v5.73h-129.4v-42.5h182.88v40.11l-127.49,170.47-1.91-2.39h132.27v42.5h-185.75Z"/>
    <path class="st0" d="M660.88,870.67c-23.24,0-44.01-5.49-62.31-16.47-18.31-10.98-32.71-26.1-43.21-45.36-10.5-19.26-15.76-41.3-15.76-66.13s5.41-47.51,16.23-67.09c10.82-19.58,25.23-34.93,43.21-46.08,17.98-11.14,37.96-16.71,59.93-16.71,13.37,0,26.1,2.07,38.2,6.21,12.09,4.14,22.92,10.03,32.47,17.67,9.55,7.64,17.59,16.71,24.11,27.22,6.52,10.5,10.9,22.13,13.13,34.86l-2.87-1.43.96-82.13h9.55v250.69h-10.5v-82.13l4.3-1.43c-2.87,12.74-7.57,24.52-14.09,35.33-6.53,10.83-14.56,20.22-24.11,28.17-9.55,7.96-20.14,14.09-31.75,18.38-11.62,4.3-24.11,6.45-37.48,6.45ZM660.88,860.17c19.41,0,37.01-5.01,52.76-15.04,15.76-10.03,28.17-23.95,37.24-41.78,9.07-17.82,13.61-38.36,13.61-61.6s-4.54-43.29-13.61-61.12c-9.07-17.82-21.49-31.83-37.24-42.02-15.76-10.18-33.66-15.28-53.72-15.28-21.33,0-40.27,5.1-56.82,15.28-16.56,10.19-29.45,24.28-38.68,42.26-9.24,17.99-13.85,38.6-13.85,61.84s4.61,42.74,13.85,60.4c9.23,17.67,22.12,31.6,38.68,41.78,16.55,10.19,35.81,15.28,57.78,15.28Z"/>
    <path class="st0" d="M926.36,870.67c-21.01,0-40.11-3.98-57.3-11.94-17.19-7.95-30.4-18.46-39.63-31.51l8.12-7.16c8.91,11.78,21.01,21.41,36.29,28.89,15.28,7.48,33.1,11.22,53.48,11.22,13.05,0,24.19-1.59,33.42-4.77,9.23-3.18,16.71-7.48,22.44-12.89,5.73-5.41,10.03-11.53,12.89-18.38,2.87-6.84,4.3-14.09,4.3-21.73,0-15.59-6.69-27.85-20.05-36.77-6.37-4.77-14.33-8.91-23.88-12.42-9.55-3.5-20.7-6.69-33.43-9.55-14.32-3.5-26.98-7.48-37.96-11.94-10.98-4.45-19.98-9.55-26.98-15.28-6.37-5.41-11.15-11.22-14.32-17.43-3.19-6.21-4.77-13.13-4.77-20.77,0-9.86,1.98-18.78,5.97-26.74,3.98-7.95,9.55-14.88,16.71-20.77,7.16-5.89,15.91-10.34,26.26-13.37,10.34-3.02,21.88-4.54,34.62-4.54,11.14,0,21.97,1.6,32.47,4.78,10.51,3.19,20.37,7.8,29.61,13.85,9.23,6.05,17.5,13.37,24.83,21.96l-7.64,8.6c-7.01-7.95-14.64-14.88-22.92-20.77-8.28-5.89-17.12-10.34-26.5-13.37-9.39-3.02-19.34-4.54-29.84-4.54-11.46,0-21.73,1.36-30.8,4.06-9.07,2.71-16.79,6.53-23.16,11.46-6.37,4.94-11.15,10.67-14.33,17.19-3.19,6.53-4.77,13.77-4.77,21.73,0,5.42,1.11,10.67,3.34,15.76,2.22,5.1,5.89,9.71,10.98,13.85,6.36,5.42,14.72,10.19,25.07,14.33,10.34,4.14,22.36,7.8,36.05,10.98,14.32,3.19,26.81,6.77,37.48,10.74,10.66,3.98,19.5,8.68,26.5,14.09,7.32,5.42,12.81,11.78,16.47,19.1,3.66,7.33,5.49,15.92,5.49,25.79,0,13.69-3.34,25.71-10.03,36.05-6.68,10.35-16.4,18.31-29.13,23.88-12.73,5.57-27.86,8.36-45.36,8.36Z"/>
    <path class="st0" d="M1155.08,870.67c-21.01,0-40.11-3.98-57.3-11.94-17.19-7.95-30.4-18.46-39.63-31.51l8.12-7.16c8.91,11.78,21.01,21.41,36.29,28.89,15.28,7.48,33.1,11.22,53.48,11.22,13.05,0,24.19-1.59,33.42-4.77,9.23-3.18,16.71-7.48,22.44-12.89,5.73-5.41,10.03-11.53,12.89-18.38,2.87-6.84,4.3-14.09,4.3-21.73,0-15.59-6.68-27.85-20.05-36.77-6.37-4.77-14.33-8.91-23.88-12.42-9.55-3.5-20.7-6.69-33.42-9.55-14.33-3.5-26.98-7.48-37.96-11.94-10.98-4.45-19.98-9.55-26.98-15.28-6.37-5.41-11.15-11.22-14.33-17.43-3.19-6.21-4.78-13.13-4.78-20.77,0-9.86,1.99-18.78,5.97-26.74,3.98-7.95,9.55-14.88,16.71-20.77,7.16-5.89,15.91-10.34,26.26-13.37,10.34-3.02,21.88-4.54,34.62-4.54,11.14,0,21.96,1.6,32.47,4.78,10.5,3.19,20.37,7.8,29.61,13.85,9.23,6.05,17.5,13.37,24.83,21.96l-7.64,8.6c-7.01-7.95-14.65-14.88-22.92-20.77-8.28-5.89-17.12-10.34-26.5-13.37-9.39-3.02-19.34-4.54-29.84-4.54-11.46,0-21.73,1.36-30.8,4.06-9.07,2.71-16.79,6.53-23.16,11.46-6.37,4.94-11.15,10.67-14.33,17.19-3.19,6.53-4.78,13.77-4.78,21.73,0,5.42,1.11,10.67,3.34,15.76,2.22,5.1,5.89,9.71,10.98,13.85,6.36,5.42,14.72,10.19,25.07,14.33,10.34,4.14,22.36,7.8,36.05,10.98,14.33,3.19,26.81,6.77,37.48,10.74,10.66,3.98,19.5,8.68,26.5,14.09,7.32,5.42,12.81,11.78,16.47,19.1,3.66,7.33,5.49,15.92,5.49,25.79,0,13.69-3.34,25.71-10.03,36.05-6.68,10.35-16.4,18.31-29.13,23.88-12.74,5.57-27.86,8.36-45.36,8.36Z"/>
    <path class="st0" d="M1390.96,870.67c-19.42,0-35.89-3.42-49.42-10.27-13.53-6.84-23.8-17.59-30.8-32.23-7.01-14.64-10.5-33.42-10.5-56.34v-156.62h10.5v156.62c0,20.7,3.1,37.57,9.31,50.61,6.21,13.06,15.35,22.61,27.46,28.65,12.09,6.05,26.9,9.07,44.41,9.07,11.46,0,22.36-2.39,32.71-7.16,10.34-4.77,19.5-10.74,27.46-17.91,7.95-7.16,14.16-14.4,18.62-21.73,4.45-7.32,6.69-13.53,6.69-18.62v-179.54h10.5v250.69h-9.55l-.96-57.78,4.3-.96c-3.82,11.46-10.19,21.96-19.1,31.52-8.92,9.55-19.5,17.27-31.75,23.16-12.26,5.89-25.55,8.83-39.87,8.83Z"/>
    <path class="st0" d="M1555.69,865.9v-250.69h9.55l.48,60.64-2.86.95c2.22-10.5,6.76-20.61,13.61-30.32,6.84-9.71,16.07-17.74,27.69-24.11,11.62-6.36,25.38-9.55,41.3-9.55,5.41,0,10.42.32,15.04.96,4.61.64,8.83,1.6,12.65,2.87l-3.34,10.98c-5.1-1.59-9.95-2.7-14.56-3.34-4.62-.63-8.68-.95-12.18-.95-12.74,0-23.96,2.55-33.66,7.64-9.71,5.1-17.75,11.78-24.11,20.06-6.37,8.28-11.15,17.12-14.33,26.5-3.19,9.39-4.78,18.38-4.78,26.98v161.39h-10.5Z"/>
    <path class="st0" d="M1802.08,870.67c-24.2,0-45.53-5.57-63.99-16.71-18.47-11.14-32.87-26.58-43.21-46.32-10.35-19.73-15.52-42.18-15.52-67.33,0-18.78,2.87-35.97,8.6-51.57,5.73-15.59,13.76-29.05,24.11-40.35,10.34-11.3,22.68-20.05,37.01-26.26,14.33-6.21,30.08-9.31,47.27-9.31,15.91,0,30.56,2.63,43.93,7.88,13.37,5.25,24.9,12.89,34.62,22.92,9.71,10.03,17.11,22.05,22.2,36.05,5.09,14.01,7.32,29.77,6.68,47.27l-.48,12.42h-218.22v-10.5h212.96l-5.73,8.12.96-11.94c0-20.37-4.3-38.2-12.89-53.48-8.59-15.28-20.14-27.14-34.62-35.57-14.49-8.43-30.49-12.65-47.99-12.65-21.65,0-40.51,5.01-56.58,15.04-16.08,10.03-28.58,23.88-37.48,41.54-8.92,17.67-13.53,37.8-13.85,60.4.31,23.24,5.25,43.93,14.8,62.07s22.68,32.31,39.39,42.5c16.71,10.19,36.05,15.28,58.02,15.28,16.55,0,31.83-3.02,45.84-9.07,14-6.04,26.58-14.33,37.72-24.83l5.73,8.59c-7.96,7.33-16.47,13.61-25.55,18.86s-18.94,9.39-29.61,12.42c-10.67,3.02-22.05,4.54-34.14,4.54Z"/>
  </g>
  <g>
    <path class="st0" d="M960.5,223.62c0,31.69-15.42,59.8-39.16,77.24l-91.33,11.96c-35.65-13.93-60.94-48.6-60.94-89.2,0-52.86,42.86-95.72,95.72-95.72,52.86,0,95.72,42.86,95.72,95.72Z"/>
    <path class="st0" d="M1053.93,285.12l-.74.74c-17.92,1.49-33.95,2.61-51.5,4.47l-12.5,1.65c-17.71-17.39-28.69-41.58-28.69-68.36,0-9.68,1.44-19.01,4.12-27.81l89.31,89.31Z"/>
    <path class="st0" d="M1151.93,223.62c0,29.19-13.05,55.3-33.66,72.88l-134.91-134.93c17.55-20.61,43.66-33.66,72.85-33.66,52.86,0,95.72,42.86,95.72,95.72Z"/>
    <path class="st0" d="M1068.37,322.77l-48.34,6.33c11.17-4.57,23.37-7.1,36.19-7.1,4.12,0,8.19.27,12.15.77Z"/>
    <path class="st0" d="M1151.93,417.71c0,52.86-42.86,95.72-95.72,95.72-52.86,0-95.72-42.86-95.72-95.72,0-40.04,24.62-74.37,59.53-88.62l48.34-6.33h.03c47.11,5.98,83.54,46.21,83.54,94.94Z"/>
    <path class="st0" d="M938.91,478.25c-17.55,21.46-44.24,35.18-74.13,35.18-52.86,0-95.72-42.86-95.72-95.72,0-29.88,13.72-56.58,35.18-74.13l134.67,134.67Z"/>
    <path class="st0" d="M960.5,417.71c0,9.09-1.28,17.92-3.64,26.24l-95.05-95.05.74-.74c17.52-1.12,33.95-2.61,51.47-5.21l9.01-1.17c22.79,17.47,37.46,44.99,37.46,75.93Z"/>
  </g>
</svg>`;
const OZASSURE_LOGO_TERTIARY_SVG = `<svg class="oz-logo-tertiary-svg" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 1920 1080">
  <defs>
    <style>
      .st0 {
        fill: #fff;
        stroke: #fff;
        stroke-miterlimit: 10;
      }
    </style>
  </defs>
  <g>
    <path class="st0" d="M1088.65,823.72c-55.56,0-105.16-12.8-148.8-38.42-43.66-25.61-78.11-60.59-103.36-104.97s-37.88-95.06-37.88-152.06,12.62-107.66,37.88-152.03,59.7-79.36,103.36-104.98c43.64-25.61,93.23-38.42,148.8-38.42s104.06,12.81,147.72,38.42c43.66,25.62,78.11,60.61,103.36,104.98s37.88,95.05,37.88,152.03-12.62,107.69-37.88,152.06-59.7,79.36-103.36,104.97c-43.66,25.62-92.89,38.42-147.72,38.42ZM1088.65,721.99c33.91,0,64.22-8.47,90.91-25.42s47.61-40.05,62.77-69.27,22.38-62.22,21.66-99.03c.72-37.5-6.5-70.88-21.66-100.09s-36.08-52.12-62.77-68.72-57-24.89-90.91-24.89-64.39,8.48-91.44,25.44c-27.06,16.95-48.16,40.03-63.31,69.25s-22.36,62.23-21.64,99.02c-.72,36.81,6.48,69.81,21.64,99.03s36.25,52.31,63.31,69.27c27.05,16.95,57.53,25.42,91.44,25.42Z"/>
    <path class="st0" d="M1464.17,812.89v-93.06l293.28-391.77v12.98h-293.28v-96.31h414.48v90.91l-288.95,386.34-4.33-5.41h299.78v96.31h-420.98Z"/>
  </g>
  <g>
    <path class="st0" d="M334.78,393.09c0,49.66-24.16,93.69-61.36,121.02l-143.1,18.75c-55.86-21.83-95.48-76.15-95.48-139.76,0-82.82,67.15-149.97,149.97-149.97,82.82,0,149.97,67.15,149.97,149.97Z"/>
    <path class="st0" d="M481.17,489.45l-1.17,1.17c-28.08,2.33-53.2,4.08-80.69,7l-19.58,2.58c-27.74-27.24-44.95-65.15-44.95-107.1,0-15.16,2.25-29.79,6.46-43.57l139.93,139.93Z"/>
    <path class="st0" d="M634.72,393.09c0,45.74-20.45,86.65-52.74,114.18l-211.37-211.42c27.49-32.29,68.4-52.74,114.14-52.74,82.82,0,149.97,67.15,149.97,149.97Z"/>
    <path class="st0" d="M634.72,697.2c0,82.82-67.15,149.97-149.97,149.97-82.82,0-149.97-67.15-149.97-149.97,0-62.74,38.58-116.52,93.27-138.85l75.73-9.91h.04c73.82,9.37,130.89,72.4,130.89,148.76Z"/>
    <path class="st0" d="M300.95,792.05c-27.49,33.62-69.32,55.11-116.14,55.11-82.82,0-149.97-67.15-149.97-149.97,0-46.82,21.5-88.65,55.11-116.14l211,211Z"/>
    <path class="st0" d="M334.78,697.2c0,14.25-2,28.08-5.71,41.12l-148.93-148.93,1.17-1.17c27.45-1.75,53.2-4.08,80.65-8.16l14.12-1.83c35.7,27.37,58.7,70.49,58.7,118.98Z"/>
  </g>
</svg>`;


const USER_ROLES = {
  'jo@cofidex.ch': { prenom: 'Jonathan', nom: 'Özkan', role: 'signataire', taux: 100 },
  'dp@cofidex.ch': { prenom: 'David', nom: 'Pereira', role: 'apporteur', taux: 50 },
  'ae@cofidex.ch': { prenom: 'Alejandro', nom: 'Espinoza', role: 'apporteur', taux: 50 },
};

// ═══ SESSION SUPABASE AUTH ═══
let supaSession = null; // { access_token, refresh_token, expires_at, email }

function saveSession(s) {
  supaSession = s;
  try { localStorage.setItem('crm_session', JSON.stringify(s)); } catch(e) {}
}

function clearSession() {
  supaSession = null;
  try { localStorage.removeItem('crm_session'); } catch(e) {}
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem('crm_session');
    if (raw) supaSession = JSON.parse(raw);
  } catch(e) { supaSession = null; }
  return supaSession;
}

// Retourne un token d'accès valide, en le rafraîchissant si besoin
// ═══ JOURNAL D'AUDIT (traçabilité nLPD) ═══
async function logAction(action, tableName, recordId, detail) {
  try {
    if (!supaSession || !supaSession.email) return; // pas de log si pas connecté
    await dbPost('audit_log', {
      user_email: supaSession.email,
      action,
      table_name: tableName || null,
      record_id: recordId || null,
      detail: detail || null,
    });
  } catch(e) { /* le journal ne doit jamais bloquer l'usage normal */ }
}

async function getValidAccessToken() {
  if (!supaSession) return null;
  const now = Math.floor(Date.now() / 1000);
  if (supaSession.expires_at && supaSession.expires_at - now > 60) {
    return supaSession.access_token;
  }
  // Token expiré ou proche de l'expiration → refresh
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: supaSession.refresh_token }),
    });
    if (!r.ok) { clearSession(); return null; }
    const data = await r.json();
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: now + (data.expires_in || 3600),
      email: supaSession.email,
    });
    return supaSession.access_token;
  } catch(e) { return null; }
}

async function supabaseAuthLogin(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json();
  if (!r.ok) return { error: true, message: data.error_description || data.msg || 'Échec de connexion' };
  const now = Math.floor(Date.now() / 1000);
  saveSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: now + (data.expires_in || 3600),
    email,
  });
  return { error: false };
}

async function supabaseAuthLogout() {
  try {
    const token = await getValidAccessToken();
    if (token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      });
    }
  } catch(e) {}
  clearSession();
}

// ═══ COULEURS AGENTS ═══
function agentColor(agent) {
  if (!agent) return '#38bdf8';
  if (agent.role === 'signataire') return '#38bdf8';
  if (agent.prenom === 'David') return '#f59e0b';
  return '#a78bfa';
}

// ═══ SUPABASE ═══
async function dbGet(table, params = '') {
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });
    if (!r.ok) { console.error(`dbGet(${table}) HTTP ${r.status}`); return []; }
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch(e) { console.error(`dbGet(${table}) exception`, e); return []; }
}

async function dbPost(table, body) {
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Supabase error', r.status, data);
      return { error: true, status: r.status, detail: data };
    }
    return data;
  } catch(e) {
    console.error('Network error', e);
    return { error: true, detail: e.message };
  }
}

async function dbPatch(table, id, body) {
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      let detail = null;
      try { detail = await r.json(); } catch(e) {}
      console.error(`dbPatch(${table}) HTTP ${r.status}`, detail);
      return { error: true, status: r.status, detail };
    }
    return { error: false };
  } catch(e) {
    console.error(`dbPatch(${table}) exception`, e);
    return { error: true, detail: e.message };
  }
}

async function dbDelete(table, id) {
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      let detail = null;
      try { detail = await r.json(); } catch(e) {}
      console.error(`dbDelete(${table}) HTTP ${r.status}`, detail);
      return { error: true, status: r.status, detail };
    }
    return { error: false };
  } catch(e) {
    console.error(`dbDelete(${table}) exception`, e);
    return { error: true, detail: e.message };
  }
}

// Appelle une fonction PostgreSQL exposée via /rest/v1/rpc/ — utilisé pour les accès qui
// doivent rester impossibles à énumérer (ex: statut d'une signature, accessible uniquement
// via son jeton exact, jamais par simple lecture de table).
async function dbRpc(fonction, params) {
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fonction}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    if (!r.ok) { console.error(`dbRpc(${fonction}) HTTP ${r.status}`); return null; }
    const data = await r.json();
    return Array.isArray(data) ? data : (data ? [data] : []);
  } catch(e) { console.error(`dbRpc(${fonction}) exception`, e); return null; }
}

// ═══ MSAL ═══
