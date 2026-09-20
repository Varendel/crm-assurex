// ═══ FINANCEMENT IMMOBILIER — version modernisée (19.09.2026) ═════════════════════════════════
// Remplace l'ancien simulateur (formulaire + bouton « Calculer » + curseurs, js/01). Même moteur
// de calcul (règles de branche, js/01) : calculerCapaciteFinanciere, calculerPrixMaximalFinancable,
// schemaMaisonFinancement. Nouveautés :
//  - saisie à gauche, résultats à droite recalculés en direct ;
//  - fonds propres détaillés par source (épargne, 3a, EPL 2e pilier, donation) et frais d'achat
//    (droits de mutation, notaire) déduits des fonds propres — ils ne se financent pas ;
//  - coût THÉORIQUE (taux de 5 % imposé par les banques) et coût RÉEL au taux du marché ;
//  - leviers si le projet ne passe pas (revenu nécessaire, fonds propres manquants, prix maximal) ;
//  - frise de l'amortissement du 2e rang et contrôle de la charge à la retraite ;
//  - rapport client imprimable, enregistrement dans le dossier de conseil.

const FI_DEFAUT = () => ({
  nom: '', prix: '', type: 'principale', frais_pct: 5,
  fp_epargne: '', fp_3a: '', fp_lpp: '', fp_donation: '',
  revenu: '', revenu_retraite: '', naissance: '', age_retraite: 65,
  taux_theo: 5, entretien: 1, effort_max: 33, taux_effectif: 1.8,
});
let _fi = { d: FI_DEFAUT(), clientId: null };
// Couleurs de la charte (en dur dans les SVG → identiques à l'écran et dans le rapport imprimé ;
// en thème sombre, le bleu marine est éclairci par CSS via les classes fih-navy / fih-sw-navy).
const FI_COUL = { fp: '#F59E0B', r1: '#113679', r2: '#00CFFF', interets: '#113679', amort: '#00CFFF', entretien: '#F59E0B' };
// Couleur du texte posé SUR chaque couleur de barre (contraste lisible)
const FI_COUL_TXT = { '#113679': '#FFFFFF', '#00CFFF': '#0B2458', '#F59E0B': '#3A2600' };
let _fiSvgId = 0;

function fiEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function fiNum(v) { const n = typeof nombreCH === 'function' ? nombreCH(v) : Number(v); return isNaN(n) ? 0 : n; }
function fiCHF(v) { return 'CHF ' + fmtCHF(Math.round(v || 0)); }
function fiK(v) { const x = Math.round(v); return Math.abs(x) >= 1000 ? fmtCHF(Math.round(x / 1000)) + 'k' : fmtCHF(x); }
function fiAge(iso) { if (!iso) return null; const d = new Date(iso), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--; return a; }
function fiNomClient(c) { return c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : ''; }

// ── Calcul ──────────────────────────────────────────────────────────────────────────────────
function fiCalculer(d) {
  const prix = fiNum(d.prix);
  const fpTotal = fiNum(d.fp_epargne) + fiNum(d.fp_3a) + fiNum(d.fp_lpp) + fiNum(d.fp_donation);
  const frais = prix * fiNum(d.frais_pct) / 100;
  const fpNet = Math.max(0, fpTotal - frais);                 // fonds propres restant pour le prix
  const lpp = Math.min(fiNum(d.fp_lpp), fpNet);
  const age = fiAge(d.naissance);
  const ageRet = fiNum(d.age_retraite) || 65;
  const duree = age != null ? Math.max(1, Math.min(IMMO_LEGAL.duree_amortissement_defaut, ageRet - age)) : IMMO_LEGAL.duree_amortissement_defaut;
  const revenu = fiNum(d.revenu);
  const params = {
    prix, fondsPropresDisponibles: fpNet, fondsPropresLPP: lpp, revenuBrut: revenu,
    tauxInteret: (fiNum(d.taux_theo) || 5) / 100, chargesEntretien: (fiNum(d.entretien) || 1) / 100,
    tauxEndettementMax: (fiNum(d.effort_max) || 33) / 100, dureeAmortissement: duree, residenceSecondaire: d.type === 'secondaire',
  };
  const r = calculerCapaciteFinanciere(params);
  const pm = calculerPrixMaximalFinancable(params);
  const ok = r.fpSuffisants && r.fpDursSuffisants && r.tauxEffort <= params.tauxEndettementMax;
  const tauxEff = (fiNum(d.taux_effectif) || 0) / 100;
  const reel = { interets: r.hypotheque * tauxEff, amort: r.amortissementAnnuel, entretien: r.chargesAnnuelles };
  reel.total = reel.interets + reel.amort + reel.entretien;
  // Fonds propres manquants : le plus exigeant des deux seuils (total et « durs » hors LPP)
  const manqueFP = Math.max(0, r.fpMinRequis - fpNet, r.fpDursRequis - r.fondsPropresDurs);
  // À la retraite : 2e rang amorti ; charge théorique sur le 1er rang seul
  const chargeRetraite = r.premierRang * params.tauxInteret + r.chargesAnnuelles;
  const revRet = fiNum(d.revenu_retraite);
  const effortRetraite = revRet ? chargeRetraite / revRet : null;
  return { prix, fpTotal, frais, fpNet, lpp, age, ageRet, duree, revenu, params, r, pm, ok, reel, manqueFP, chargeRetraite, effortRetraite, revRet };
}

// ── Vue ─────────────────────────────────────────────────────────────────────────────────────
function viewFinancementImmo() {
  const initial = window._fiInitial || null;
  window._fiInitial = null;
  if (initial) { _fi.d = { ...FI_DEFAUT(), ...(initial.d || {}) }; _fi.clientId = initial.clientId || null; }
  // Aucun client choisi : les derniers projets immobiliers enregistrés (js/31)
  const recentes = !_fi.clientId && typeof anxHtmlZone === 'function';
  if (recentes) setTimeout(anxChargerImmo, 0);
  return `<div class="dbx ap fi">${recentes ? anxHtmlZone('fi') : ''}
    <section class="cf-hero">
      <div class="cf-hero-deco" aria-hidden="true"></div>
      <div class="cf-hero-texte">
        <span class="cf-surtitre">Conseil</span>
        <h1>Financement immobilier</h1>
        <p>Capacité financière selon les règles des prêteurs suisses — fonds propres, taux d’effort, amortissement — et coût réel au taux du marché, recalculés en direct.</p>
      </div>
      <div class="cf-hero-actions">
        <div class="cf-choix-client">
          <input id="fi-client" list="fi-liste-clients" placeholder="Client (ou simulation libre)" autocomplete="off" aria-label="Client" value="${fiEsc(_fi.clientId ? fiNomClient(allClients.find(c => c.id === _fi.clientId)) : '')}" onchange="fiChoisirClientParNom(this.value)"/>
          <datalist id="fi-liste-clients">${allClients.filter(c => !estEntreprise(c)).map(c => `<option value="${fiEsc(fiNomClient(c))}"></option>`).join('')}</datalist>
        </div>
        <div class="cf-boutons">
          <button type="button" class="fcx-btn-blanc" onclick="fiRapport()">📄 Rapport client</button>
          <button type="button" class="fcx-btn-verre" onclick="fiEnregistrerDossier()">💼 Dans le dossier de conseil</button>
          <button type="button" class="fcx-btn-verre" onclick="_fi={d:FI_DEFAUT(),clientId:null};fiRerendre()">↺ Nouvelle</button>
        </div>
      </div>
    </section>
    <div class="ap-grille">
      <aside class="ap-saisie">${fiFormulaire()}</aside>
      <section class="ap-droite"><div id="fi-resultats" class="fih-anime">${fiResultats()}</div></section>
    </div>
  </div>`;
}
function fiRerendre() { const m = document.getElementById('main-content'); if (m && currentView === 'calc-immo') m.innerHTML = viewFinancementImmo(); }
function fiChoisirClientParNom(nom) {
  const c = allClients.find(x => fiNomClient(x).toLowerCase() === (nom || '').trim().toLowerCase());
  if (c) fiChoisirClient(c.id);
  else if (!nom) _fi.clientId = null;
  else showError('Client introuvable — choisis un nom dans la liste, ou laisse vide pour une simulation libre.');
}
async function fiChoisirClient(clientId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const d = FI_DEFAUT();
  d.nom = fiNomClient(c); d.naissance = c.date_naissance || ''; d.revenu = c.revenu || '';
  const dos = await dbGet('dossiers_conseil', `client_id=eq.${clientId}&select=situation`);
  const s = Array.isArray(dos) && dos[0] ? dos[0].situation || {} : {};
  const im = s.immobilier || {}, p = s.prevoyance || {}, pa = s.patrimoine || {};
  if (im.prix) d.prix = im.prix;
  if (im.type) d.type = im.type;
  if (im.fonds_propres_lpp) d.fp_lpp = im.fonds_propres_lpp;
  if (im.fonds_propres) d.fp_epargne = Math.max(0, fiNum(im.fonds_propres) - fiNum(im.fonds_propres_lpp));
  else if (pa.liquidites) d.fp_epargne = pa.liquidites;
  if (pa.pilier3a && !im.fonds_propres) d.fp_3a = pa.pilier3a;
  if (p.salaire_brut) d.revenu = fiNum(p.salaire_brut) + fiNum(p.salaire_brut_conjoint);
  if (p.age_retraite) d.age_retraite = p.age_retraite;
  _fi = { d, clientId };
  fiRerendre();
}

function fiChamp(chemin, label, o = {}) {
  const val = _fi.d[chemin] ?? '';
  if (o.type === 'select') return `<label class="ap-champ ${o.large ? 'large' : ''}"><span>${label}</span><select data-fi="${chemin}" onchange="fiMaj(this)">${o.options.map(([x, l]) => `<option value="${x}" ${String(val) === String(x) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  if (o.type === 'date') return `<label class="ap-champ"><span>${label}</span><input type="date" data-fi="${chemin}" value="${fiEsc(val)}" onchange="fiMaj(this)"/></label>`;
  if (o.type === 'texte') return `<label class="ap-champ large"><span>${label}</span><input data-fi="${chemin}" value="${fiEsc(val)}" oninput="fiMaj(this)"/></label>`;
  return `<label class="ap-champ ${o.large ? 'large' : ''}"><span>${label}</span><div class="cf-saisie"><input data-fi="${chemin}" data-num="1" inputmode="decimal" value="${fiEsc(val)}" placeholder="${fiEsc(o.placeholder || '')}" oninput="fiMaj(this)"/>${o.unite ? `<em>${o.unite}</em>` : ''}</div>${o.aide ? `<small>${o.aide}</small>` : ''}</label>`;
}
function fiFormulaire() {
  const sec = (t, i, c, ouvert) => `<details class="ap-bloc" ${ouvert ? 'open' : ''}><summary><span>${i}</span>${t}</summary><div class="ap-champs">${c}</div></details>`;
  return `
    ${sec('Le bien', '🏡', `
      ${fiChamp('nom', 'Client / projet', { type: 'texte' })}
      ${fiChamp('prix', 'Prix d’achat', { unite: 'CHF', large: true, placeholder: 'ex. 950’000' })}
      ${fiChamp('type', 'Type', { type: 'select', options: [['principale', 'Résidence principale'], ['secondaire', 'Résidence secondaire']] })}
      ${fiChamp('frais_pct', 'Frais d’achat', { unite: '% du prix', aide: 'droits de mutation, notaire, registre foncier' })}
    `, true)}
    ${sec('Fonds propres', '💰', `
      ${fiChamp('fp_epargne', 'Épargne & placements', { unite: 'CHF' })}
      ${fiChamp('fp_3a', 'Retrait 3e pilier A', { unite: 'CHF' })}
      ${fiChamp('fp_lpp', 'Versement anticipé LPP (EPL)', { unite: 'CHF', aide: 'compte comme fonds propres, pas « durs »' })}
      ${fiChamp('fp_donation', 'Donation / avance d’hoirie', { unite: 'CHF' })}
    `, true)}
    ${sec('Revenus', '💼', `
      ${fiChamp('revenu', 'Revenu brut annuel du ménage', { unite: 'CHF/an', large: true })}
      ${fiChamp('naissance', 'Date de naissance (plus âgé)', { type: 'date' })}
      ${fiChamp('age_retraite', 'Âge de la retraite', { unite: 'ans' })}
      ${fiChamp('revenu_retraite', 'Revenu brut à la retraite', { unite: 'CHF/an', large: true, aide: 'facultatif — pour vérifier la charge à la retraite' })}
    `, true)}
    ${sec('Hypothèses', '⚙️', `
      ${fiChamp('taux_effectif', 'Taux hypothécaire réel', { unite: '%', aide: 'taux du marché (fixe / SARON)' })}
      ${fiChamp('taux_theo', 'Taux théorique (banques)', { unite: '%' })}
      ${fiChamp('entretien', 'Frais d’entretien', { unite: '% du prix' })}
      ${fiChamp('effort_max', 'Taux d’effort maximal', { unite: '% du revenu' })}
    `, false)}`;
}
function fiMaj(el) {
  const k = el.dataset.fi;
  _fi.d[k] = el.dataset.num ? (el.value.trim() === '' ? '' : fiNum(el.value)) : el.value;
  const z = document.getElementById('fi-resultats');
  // Pas d'animation d'entrée à chaque frappe : seulement au premier affichage de la vue
  if (z) { z.classList.remove('fih-anime'); z.innerHTML = fiResultats(); }
}

// ── Résultats ───────────────────────────────────────────────────────────────────────────────
function fiResultats() {
  const d = _fi.d;
  if (!fiNum(d.prix) || !fiNum(d.revenu)) return `<div class="dbx-vide">${typeof rexBanquierHtml === 'function' ? rexBanquierHtml({ taille: 140 }) : '<img src="assets/logos/rex-mascotte-hd.png" alt=""/>'}<strong>Indique le prix du bien et le revenu du ménage</strong><span>Le financement, le taux d’effort, le coût réel et le prix maximal s’affichent au fil de la saisie.</span></div>`;
  const R = fiCalculer(d), r = R.r;
  const eff = r.tauxEffort * 100, effMax = R.params.tauxEndettementMax * 100;
  const kpi = (l, v, s, ton, i) => `<div class="dbx-kpi tr-kpi ${ton || ''}" style="--i:${i}"><span class="dbx-kpi-label">${l}</span><span class="dbx-kpi-valeur">${v}</span><span class="dbx-kpi-sous">${s}</span></div>`;
  const verif = (okL, titre, detail) => `<div class="fi-verif ${okL ? 'ok' : 'ko'}"><span>${okL ? '✓' : '✕'}</span><div><strong>${titre}</strong><small>${detail}</small></div></div>`;
  return `
    <div class="fi-verdict ${R.ok ? 'ok' : 'ko'}">
      <span class="fi-verdict-icone">${R.ok ? '✓' : '!'}</span>
      <div><strong>${R.ok ? 'Projet finançable' : 'Projet non finançable en l’état'}</strong>
      <span>${R.ok ? `Il reste une marge : prix maximal finançable ${fiCHF(R.pm.prixMax)}.` : `Prix maximal finançable avec ces données : <b>${fiCHF(R.pm.prixMax)}</b>.`}</span></div>
    </div>
    <div class="dbx-kpis">
      ${kpi('Prix maximal finançable', fiCHF(R.pm.prixMax), R.pm.contrainteLimitante === 'tauxEffort' ? 'limité par le revenu' : 'limité par les fonds propres', '', 1)}
      ${kpi('Hypothèque', fiCHF(r.hypotheque), `${Math.round(r.hypotheque / R.prix * 100)} % du prix (avance)`, '', 2)}
      ${kpi('Taux d’effort', eff.toFixed(1).replace('.', ',') + ' %', `maximum ${fmtCHF(effMax)} %`, eff <= effMax ? 'ok' : 'alerte', 3)}
      ${kpi('Coût réel', fiCHF(R.reel.total / 12) + '/mois', `à ${fmtCHF(fiNum(d.taux_effectif))} % — théorique ${fiCHF(r.chargeTotaleAnnuelle / 12)}/mois`, '', 4)}
    </div>
    <div class="dbx-grille dbx-grille-egale">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Les trois règles</h2></header>
        ${verif(r.fpSuffisants, `Fonds propres ≥ ${R.params.residenceSecondaire ? '33 %' : '20 %'} du prix`, `${fiCHF(R.fpNet)} disponibles pour le prix (après ${fiCHF(R.frais)} de frais) · ${fiCHF(r.fpMinRequis)} requis`)}
        ${verif(r.fpDursSuffisants, R.params.residenceSecondaire ? 'Sans 2e pilier (résidence secondaire)' : 'Au moins 10 % hors 2e pilier', `${fiCHF(r.fondsPropresDurs)} hors LPP · ${fiCHF(r.fpDursRequis)} requis`)}
        ${verif(eff <= effMax, `Charges théoriques ≤ ${fmtCHF(effMax)} % du revenu`, `${fiCHF(r.chargeTotaleAnnuelle)}/an pour ${fiCHF(R.revenu)} de revenu (${eff.toFixed(1).replace('.', ',')} %)`)}
        ${!R.ok ? `<div class="fi-leviers"><strong>Ce qui débloquerait le projet</strong>
          ${R.manqueFP > 0 ? `<span>➕ ${fiCHF(R.manqueFP)} de fonds propres supplémentaires${!r.fpDursSuffisants ? ' (hors 2e pilier)' : ''}</span>` : ''}
          ${eff > effMax ? `<span>📈 un revenu brut de ${fiCHF(r.revenuMinimumNecessaire)} (+${fiCHF(r.revenuMinimumNecessaire - R.revenu)})</span>` : ''}
          <span>🏷️ ou un prix d’achat d’au plus ${fiCHF(R.pm.prixMax)}</span></div>` : ''}
      </section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Charges annuelles</h2><span class="dbx-carte-sous">théorique (banques) et réel</span></header><div class="fih-graphe">${fiSvgCharges(R)}</div>
        ${fiLegendeCharges(effMax)}
      </section>
    </div>
    <div class="dbx-grille dbx-grille-egale">
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Structure du financement</h2></header>
        <div class="fi-schema">${schemaMaisonFinancement(R.fpNet, r.premierRang, r.deuxiemeRang, R.prix, R.duree)}</div></section>
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>En chiffres</h2></header>
        <div class="ap-lignes">
          <div class="ap-ligne"><span>Prix d’achat</span><b>${fiCHF(R.prix)}</b></div>
          <div class="ap-ligne discret"><span>+ Frais d’achat (${fmtCHF(fiNum(d.frais_pct))} %)</span><b>${fiCHF(R.frais)}</b></div>
          <div class="ap-ligne"><i style="background:${FI_COUL.fp}"></i><span>Fonds propres (dont EPL ${fiCHF(R.lpp)})</span><b>${fiCHF(R.fpTotal)}</b></div>
          <div class="ap-ligne"><i style="background:${FI_COUL.r1}"></i><span>Hypothèque 1er rang (≤ 65 %)</span><b>${fiCHF(r.premierRang)}</b></div>
          <div class="ap-ligne"><i style="background:${FI_COUL.r2}"></i><span>Hypothèque 2e rang</span><b>${fiCHF(r.deuxiemeRang)}</b></div>
          <div class="ap-ligne discret"><span>Amortissement du 2e rang</span><b>${fiCHF(r.amortissementAnnuel)}/an sur ${R.duree} ans</b></div>
          <div class="ap-ligne total"><span>Coût réel mensuel</span><b>${fiCHF(R.reel.total / 12)}</b></div>
          <div class="ap-ligne discret"><span>dont intérêts à ${fmtCHF(fiNum(d.taux_effectif))} %</span><b>${fiCHF(R.reel.interets / 12)}</b></div>
        </div>
        <p class="cf-mention">L’amortissement du 2e rang peut se faire indirectement via un 3e pilier nanti : l’hypothèque reste constante, les versements sont déductibles.</p>
      </section>
    </div>
    <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Évolution dans le temps</h2><span class="dbx-carte-sous">dette hypothécaire et charge théorique, année après année</span></header>
      <div class="fih-defile" tabindex="0" aria-label="Graphique défilant horizontalement sur petit écran">${fiSvgTemps(R)}</div>
      ${fiLegendeTemps()}
      ${R.effortRetraite != null ? `<div class="cf-note ${R.effortRetraite <= R.params.tauxEndettementMax ? 'vert' : 'rouge'}">À la retraite : charge théorique ${fiCHF(R.chargeRetraite)}/an pour ${fiCHF(R.revRet)} de revenu, soit <b>${(R.effortRetraite * 100).toFixed(1).replace('.', ',')} %</b> — ${R.effortRetraite <= R.params.tauxEndettementMax ? 'tenable.' : 'au-delà de la limite : prévoir un amortissement supplémentaire ou des fonds à la retraite.'}</div>` : '<p class="cf-mention">Indique le revenu à la retraite pour vérifier que la charge reste supportable après la retraite (question systématique des banques).</p>'}
    </section>
    <p class="cf-mention">Simulation indicative selon les règles usuelles de branche (taux théorique ${fmtCHF(fiNum(d.taux_theo))} %, entretien ${fmtCHF(fiNum(d.entretien))} %, 1er rang ≤ 65 %, 2e rang amorti en ${IMMO_LEGAL.duree_amortissement_defaut} ans ou jusqu’à la retraite). Chaque prêteur applique ses propres critères.</p>`;
}

// ── Diagrammes ──────────────────────────────────────────────────────────────────────────────
// SVG autonomes aux couleurs en dur (identiques à l'écran et dans le rapport imprimé, fond blanc).
// Les textes portent les classes fih-t-fort / fih-t-doux : couleur par défaut pour fond blanc,
// éclaircie en thème sombre par CSS. Animation d'entrée (classe fih-monte) seulement sous .fih-anime.
function fiPasAxe(max, n = 4) {
  const brut = Math.max(max, 1) / n, p = Math.pow(10, Math.floor(Math.log10(brut)));
  const m = brut / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
function fiPctTxt(x, dec = 1) { return (x * 100).toFixed(dec).replace('.', ',') + ' %'; }
function fiTaux(x) { return String(+(x * 100).toFixed(2)).replace('.', ','); }
function fiLegende(items) {
  return `<div class="ap-legende fih-legende">${items.map(([c, l, forme]) => {
    const st = forme === 'ligne' ? `background:${c};height:3px;width:16px;border-radius:2px` : forme === 'tirets' ? `background:none;height:0;width:16px;border-top:2px dashed ${c};border-radius:0` : `background:${c}`;
    return `<span><i class="${c === FI_COUL.r1 && !forme ? 'fih-sw-navy' : ''}" style="${st}"></i>${l}</span>`;
  }).join('')}</div>`;
}
function fiLegendeCharges(effMax) { return fiLegende([[FI_COUL.interets, 'Intérêts'], [FI_COUL.amort, 'Amortissement du 2e rang'], [FI_COUL.entretien, 'Entretien'], ['#EF4444', `Limite ${fmtCHF(effMax)} % du revenu`, 'tirets']]); }
function fiLegendeTemps() { return fiLegende([[FI_COUL.r1, 'Hypothèque 1er rang'], [FI_COUL.r2, '2e rang (amorti)'], ['#EF4444', 'Taux d’effort théorique', 'ligne'], ['#EF4444', 'Limite', 'tirets']]); }

// Colonnes : charges théoriques (banques) vs réelles (taux du marché), limite de taux d'effort
function fiSvgCharges(R, imprime) {
  const r = R.r, W = 400, H = 278, g = 50, droite = 330, bas = 232, haut = 54, bw = 84;
  const limite = R.revenu * R.params.tauxEndettementMax;
  const brut = Math.max(r.chargeTotaleAnnuelle, R.reel.total, limite, 1) * 1.04;
  const pas = fiPasAxe(brut), max = Math.ceil(brut / pas) * pas;
  const y = v => bas - v / max * (bas - haut);
  const id = 'fic' + (++_fiSvgId);
  const tauxReel = r.hypotheque ? R.reel.interets / r.hypotheque : 0;
  const col = (k, cx, segs, tot, lib) => {
    const x = cx - bw / 2, yt = y(tot), effort = R.revenu ? tot / R.revenu : 0;
    const okE = effort <= R.params.tauxEndettementMax;
    let cum = 0;
    const rects = segs.map(([v, c, t], j) => {
      if (v <= 0) return '';
      const h = v / max * (bas - haut), yy = bas - cum - h; cum += h;
      const sep = j > 0 ? `<line x1="${x}" x2="${x + bw}" y1="${(yy + h).toFixed(1)}" y2="${(yy + h).toFixed(1)}" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="1.2"/>` : '';
      const txt = h >= 17 ? `<text x="${cx}" y="${(yy + h / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${FI_COUL_TXT[c] || '#FFFFFF'}">${fiK(v)}</text>` : '';
      return `<rect class="${c === FI_COUL.r1 ? 'fih-navy' : ''}" x="${x}" y="${yy.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" fill="${c}"><title>${t} : CHF ${fmtCHF(Math.round(v))}/an (${fmtCHF(Math.round(v / 12))}/mois)</title></rect>${sep}${txt}`;
    }).join('');
    return `<clipPath id="${id}-${k}"><rect x="${x}" y="${yt.toFixed(1)}" width="${bw}" height="${(bas - yt + 12).toFixed(1)}" rx="9"/></clipPath>
      <g class="fih-monte" style="animation-delay:${k * 140}ms"><g clip-path="url(#${id}-${k})">${rects}</g></g>
      <g class="fih-fondu" style="animation-delay:${300 + k * 140}ms">
        <text x="${cx}" y="${(yt - 22).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="800" class="fih-t-fort" fill="#0E1B33">CHF ${fmtCHF(Math.round(tot))}</text>
        <text x="${cx}" y="${(yt - 8).toFixed(1)}" text-anchor="middle" font-size="10.5" class="fih-t-doux" fill="#56627A">soit ${fmtCHF(Math.round(tot / 12))} / mois</text>
      </g>
      <text x="${cx}" y="${bas + 18}" text-anchor="middle" font-size="12" font-weight="700" class="fih-t-fort" fill="#0E1B33">${lib}</text>
      <text x="${cx}" y="${bas + 33}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${okE ? '#16A34A' : '#DC2626'}">effort ${fiPctTxt(effort)}</text>`;
  };
  let grille = '';
  for (let v = 0; v <= max + 0.5; v += pas) grille += `<line x1="${g}" x2="${droite}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#94A3B8" stroke-opacity="${v ? '.22' : '.55'}"/><text x="${g - 8}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" class="fih-t-doux" fill="#8A94A8">${fiK(v)}</text>`;
  const yl = y(limite);
  return `<svg viewBox="0 0 ${W} ${H}" class="ap-svg fih-svg" role="img" aria-label="Charges annuelles : théorique CHF ${fmtCHF(Math.round(r.chargeTotaleAnnuelle))}, réel CHF ${fmtCHF(Math.round(R.reel.total))}, limite CHF ${fmtCHF(Math.round(limite))}" font-family="Arial,Helvetica,sans-serif">
    <text x="4" y="16" font-size="10" class="fih-t-doux" fill="#8A94A8">CHF par an</text>
    ${grille}
    ${col(0, g + (droite - g) * 0.29, [[r.interetsAnnuels, FI_COUL.interets, `Intérêts théoriques (${fiTaux(R.params.tauxInteret)} %)`], [r.amortissementAnnuel, FI_COUL.amort, 'Amortissement du 2e rang'], [r.chargesAnnuelles, FI_COUL.entretien, 'Entretien']], r.chargeTotaleAnnuelle, `Théorique · ${fiTaux(R.params.tauxInteret)} %`)}
    ${col(1, g + (droite - g) * 0.73, [[R.reel.interets, FI_COUL.interets, 'Intérêts réels'], [R.reel.amort, FI_COUL.amort, 'Amortissement du 2e rang'], [R.reel.entretien, FI_COUL.entretien, 'Entretien']], R.reel.total, `Réel · ${fiTaux(tauxReel)} %`)}
    ${limite > 0 ? `<line x1="${g}" x2="${droite}" y1="${yl.toFixed(1)}" y2="${yl.toFixed(1)}" stroke="#EF4444" stroke-width="2" stroke-dasharray="6 4"/>
    <text x="${droite + 6}" y="${(yl - 3).toFixed(1)}" font-size="10.5" font-weight="700" fill="#EF4444">Limite ${Math.round(R.params.tauxEndettementMax * 100)} %</text>
    <text x="${droite + 6}" y="${(yl + 10).toFixed(1)}" font-size="10" fill="#EF4444">${fiK(limite)} / an</text>` : ''}
  </svg>`;
}

// Frise : dette (1er rang constant, 2e rang qui s'amortit) et taux d'effort théorique
function fiSvgTemps(R) {
  const r = R.r, ans = Math.min(40, Math.max(R.duree + 5, R.age != null ? R.ageRet - R.age + 5 : 20));
  const W = 760, H = 300, g = 58, bas = 244, haut = 52, droite = W - 50;
  const annee0 = new Date().getFullYear();
  const pts = [];
  for (let y = 0; y <= ans; y++) {
    const r2 = Math.max(0, r.deuxiemeRang - r.amortissementAnnuel * y);
    const charge = (r.premierRang + r2) * R.params.tauxInteret + (r2 > 0 ? r.amortissementAnnuel : 0) + r.chargesAnnuelles;
    const retraite = R.age != null && R.age + y >= R.ageRet;
    const rev = retraite && R.revRet ? R.revRet : R.revenu;
    pts.push({ y, r1: r.premierRang, r2, effort: rev ? charge / rev : 0, age: R.age != null ? R.age + y : null, an: annee0 + y, evt: y === R.duree && r.deuxiemeRang > 0 ? '2e rang amorti' : (R.age != null && R.age + y === R.ageRet ? 'Retraite' : '') });
  }
  // Échelles « rondes » : dette à gauche (CHF), taux d'effort à droite (%)
  const brutD = Math.max(r.hypotheque, 1) * 1.04, pasD = fiPasAxe(brutD), maxD = Math.ceil(brutD / pasD) * pasD;
  const brutE = Math.max(R.params.tauxEndettementMax, ...pts.map(p => p.effort)) * 1.08;
  const pasE = brutE <= 0.5 ? 0.1 : brutE <= 1 ? 0.2 : 0.5, maxE = Math.ceil(brutE / pasE) * pasE;
  const n = pts.length, pas = (droite - g) / n, bw = Math.max(3, pas * 0.66);
  const xc = i => g + i * pas + pas / 2;
  const yD = v => bas - v / maxD * (bas - haut), yE = v => bas - v / maxE * (bas - haut);
  let grille = '';
  for (let v = 0; v <= maxD + 0.5; v += pasD) grille += `<line x1="${g}" x2="${droite}" y1="${yD(v).toFixed(1)}" y2="${yD(v).toFixed(1)}" stroke="#94A3B8" stroke-opacity="${v ? '.22' : '.55'}"/><text x="${g - 8}" y="${(yD(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" class="fih-t-doux" fill="#8A94A8">${fiK(v)}</text>`;
  for (let e = 0; e <= maxE + 1e-9; e += pasE) grille += `<text x="${droite + 8}" y="${(yE(e) + 3.5).toFixed(1)}" font-size="10" fill="#EF4444" fill-opacity=".75">${Math.round(e * 100)} %</text>`;
  // Période de retraite : fond grisé
  const iRet = pts.findIndex(p => p.age != null && p.age >= R.ageRet);
  const zoneRet = iRet > 0 ? `<rect x="${(g + iRet * pas).toFixed(1)}" y="${haut - 8}" width="${(droite - g - iRet * pas).toFixed(1)}" height="${bas - haut + 8}" fill="#94A3B8" fill-opacity=".1"/>` : '';
  const barres = pts.map((p, i) => {
    const x = g + i * pas + (pas - bw) / 2, h1 = p.r1 / maxD * (bas - haut), h2 = p.r2 / maxD * (bas - haut);
    const qui = `${p.an}${p.age != null ? ` (${p.age} ans)` : ''}`;
    return `<g class="fih-monte" style="animation-delay:${Math.round(i * 16)}ms"><rect class="fih-navy" x="${x.toFixed(1)}" y="${(bas - h1).toFixed(1)}" width="${bw.toFixed(1)}" height="${h1.toFixed(1)}" fill="${FI_COUL.r1}"><title>${qui} — 1er rang : CHF ${fmtCHF(Math.round(p.r1))}</title></rect>${h2 > 0.3 ? `<rect x="${x.toFixed(1)}" y="${(bas - h1 - h2).toFixed(1)}" width="${bw.toFixed(1)}" height="${h2.toFixed(1)}" fill="${FI_COUL.r2}"><title>${qui} — 2e rang : CHF ${fmtCHF(Math.round(p.r2))}</title></rect>` : ''}</g>`;
  }).join('');
  const ligne = pts.map((p, i) => `${i ? 'L' : 'M'}${xc(i).toFixed(1)},${yE(p.effort).toFixed(1)}`).join(' ');
  const lim = yE(R.params.tauxEndettementMax);
  // Points commentés : aujourd'hui, chaque événement, fin de la frise (sans doublons trop proches)
  const marques = [0, ...pts.map((p, i) => p.evt ? i : -1).filter(i => i > 0), n - 1].filter((i, k, a) => a.indexOf(i) === k);
  let dernierX = -99;
  const points = marques.map(i => {
    const x = xc(i), yy = yE(pts[i].effort);
    const eti = x - dernierX >= 44 ? `<text x="${x.toFixed(1)}" y="${(yy - 9).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="800" fill="#DC2626" class="fih-halo" stroke="#FFFFFF" stroke-width="3" paint-order="stroke">${Math.round(pts[i].effort * 100)} %</text>` : '';
    if (eti) dernierX = x;
    return `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="3.6" fill="#EF4444" class="fih-halo" stroke="#FFFFFF" stroke-width="1.6"/>${eti}`;
  }).join('');
  const etiq = pts.map((p, i) => (i % 5 === 0 || i === n - 1) ? `<text x="${xc(i).toFixed(1)}" y="${bas + 16}" text-anchor="middle" font-size="10.5" font-weight="600" class="fih-t-doux" fill="#56627A">${p.age != null ? p.age + ' ans' : (p.y ? '+' + p.y + ' ans' : 'auj.')}</text><text x="${xc(i).toFixed(1)}" y="${bas + 29}" text-anchor="middle" font-size="9.5" class="fih-t-doux" fill="#8A94A8">${p.an}</text>` : '').join('');
  // Événements : trait pointillé + pastille (décalée en 2e ligne si trop proche de la précédente)
  let dernierEvt = -999;
  const evts = pts.map((p, i) => {
    if (!p.evt) return '';
    const x = g + i * pas, lw = p.evt.length * 5.9 + 18;
    const rang = x - dernierEvt < lw + 8 ? 1 : 0; dernierEvt = x;
    const yp = 4 + rang * 20;
    const xp = Math.min(x - lw / 2, droite - lw);
    return `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yp + 16}" y2="${bas}" class="fih-trait" stroke="#475569" stroke-opacity=".5" stroke-dasharray="3 3"/>
      <rect x="${xp.toFixed(1)}" y="${yp}" width="${lw.toFixed(1)}" height="17" rx="8.5" class="fih-pastille" fill="#FFFFFF" stroke="#CBD5E1"/>
      <text x="${(xp + lw / 2).toFixed(1)}" y="${yp + 12}" text-anchor="middle" font-size="10" font-weight="700" class="fih-t-fort" fill="#0E1B33">${p.evt}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="ap-svg ap-svg-temps fih-svg" role="img" aria-label="Évolution de la dette hypothécaire et du taux d’effort sur ${ans} ans" font-family="Arial,Helvetica,sans-serif">
    <text x="4" y="${haut - 16}" font-size="10" class="fih-t-doux" fill="#8A94A8">Dette (CHF)</text>
    <text x="${W - 4}" y="${haut - 16}" text-anchor="end" font-size="10" fill="#EF4444">Taux d’effort</text>
    ${zoneRet}${grille}${barres}
    <line x1="${g}" x2="${droite}" y1="${lim.toFixed(1)}" y2="${lim.toFixed(1)}" stroke="#EF4444" stroke-width="1.5" stroke-opacity=".8" stroke-dasharray="6 4"/>
    <text x="${droite - 4}" y="${(lim - 6).toFixed(1)}" text-anchor="end" font-size="10" font-weight="700" fill="#EF4444" class="fih-halo" stroke="#FFFFFF" stroke-width="3" paint-order="stroke">limite ${Math.round(R.params.tauxEndettementMax * 100)} %</text>
    <path class="fih-trace" pathLength="1" d="${ligne}" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${points}${evts}${etiq}
    <text x="${g}" y="${H - 3}" font-size="9.5" class="fih-t-doux" fill="#8A94A8">${R.age != null ? 'âge · année' : 'années · année civile'} — barres : dette hypothécaire, ligne : taux d’effort théorique${iRet > 0 ? ' — zone grisée : retraite' : ''}</text>
  </svg>`;
}

// ── Dossier de conseil & rapport ────────────────────────────────────────────────────────────
async function fiEnregistrerDossier() {
  if (!_fi.clientId) { showError('Choisis d’abord un client (en haut).'); return; }
  const d = _fi.d;
  const immo = { prix: fiNum(d.prix), fonds_propres: fiNum(d.fp_epargne) + fiNum(d.fp_3a) + fiNum(d.fp_lpp) + fiNum(d.fp_donation), fonds_propres_lpp: fiNum(d.fp_lpp), type: d.type, taux_actuel: fiNum(d.taux_effectif) };
  const dos = await dbGet('dossiers_conseil', `client_id=eq.${_fi.clientId}&select=id,situation`);
  let r;
  if (Array.isArray(dos) && dos[0]) r = await dbPatch('dossiers_conseil', dos[0].id, { situation: { ...(dos[0].situation || {}), immobilier: { ...((dos[0].situation || {}).immobilier || {}), ...immo } }, updated_at: new Date().toISOString() });
  else r = await dbPost('dossiers_conseil', { client_id: _fi.clientId, etape: 'analyse', situation: { immobilier: immo } });
  if (r && r.error) { showError('Non enregistré : ' + errMsg(r)); return; }
  showError('✓ Projet immobilier enregistré dans le dossier de conseil du client.');
}

function fiRapport() {
  const d = _fi.d;
  if (!fiNum(d.prix) || !fiNum(d.revenu)) { showError('Indique au moins le prix et le revenu.'); return; }
  const R = fiCalculer(d), r = R.r;
  const ligne = (l, v, fort) => `<tr><td style="padding:4px 0;${fort ? 'font-weight:bold' : 'color:#56627A'}">${l}</td><td style="text-align:right;${fort ? 'font-weight:bold' : ''}">${v}</td></tr>`;
  const v = (ok, t, s) => `<div style="display:flex;gap:10px;margin:6px 0"><b style="width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:${ok ? '#22C55E' : '#EF4444'};flex-shrink:0">${ok ? '✓' : '✕'}</b><div><b>${t}</b><div style="font-size:11px;color:#56627A">${s}</div></div></div>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Financement immobilier — ${fiEsc(d.nom || 'Simulation')}</title>
  <style>body{margin:0;padding:26px 34px;font-family:Arial,Helvetica,sans-serif;color:#0E1B33;font-size:12px}header{display:flex;justify-content:space-between;align-items:flex-end;background:linear-gradient(135deg,#0B2458,#113679 60%,#1A4A9C);color:#fff;border-radius:14px;padding:18px 22px;margin-bottom:16px}h1{font-size:21px;margin:0}header img{height:30px;filter:brightness(0) invert(1)}.sous{color:rgba(255,255,255,.75);font-size:11.5px;margin-top:3px}
  .verdict{border-radius:12px;padding:12px 16px;margin-bottom:14px;font-size:13px;background:${R.ok ? '#DCFCE7' : '#FEE2E2'};color:${R.ok ? '#166534' : '#991B1B'}}.grille{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:14px}.carte{border:1px solid #E2E7EF;border-radius:12px;padding:12px 14px;break-inside:avoid}h3{color:#113679;font-size:13.5px;margin:0 0 8px}table{width:100%;border-collapse:collapse}.ap-svg{width:100%;height:auto;display:block}.fih-maison svg{max-width:420px;margin:0 auto}.ap-legende{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:10.5px;color:#56627A;margin-top:6px}.ap-legende span{display:inline-flex;align-items:center;gap:5px}.ap-legende i{width:10px;height:10px;border-radius:3px;display:inline-block}.mention{font-size:9.5px;color:#8A94A8;margin-top:14px;border-top:1px solid #E2E7EF;padding-top:8px}@page{margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>
  <header><div><h1>Financement immobilier</h1><div class="sous">${fiEsc(d.nom || 'Simulation')} · ${new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>${typeof ASSUREX_LOGO_B64 !== 'undefined' ? `<img src="${ASSUREX_LOGO_B64}" alt="Assurex"/>` : ''}</header>
  <div class="verdict"><b>${R.ok ? '✓ Projet finançable' : '✕ Projet non finançable en l’état'}</b> — prix maximal finançable : <b>${fiCHF(R.pm.prixMax)}</b></div>
  <div class="grille">
    <div class="carte"><h3>Les trois règles</h3>
      ${v(r.fpSuffisants, `Fonds propres ≥ ${R.params.residenceSecondaire ? '33' : '20'} %`, `${fiCHF(R.fpNet)} / ${fiCHF(r.fpMinRequis)} requis`)}
      ${v(r.fpDursSuffisants, 'Fonds propres hors 2e pilier', `${fiCHF(r.fondsPropresDurs)} / ${fiCHF(r.fpDursRequis)} requis`)}
      ${v(r.tauxEffort <= R.params.tauxEndettementMax, 'Taux d’effort', `${(r.tauxEffort * 100).toFixed(1)} % (max. ${Math.round(R.params.tauxEndettementMax * 100)} %)`)}
    </div>
    <div class="carte"><h3>Charges annuelles</h3>${fiSvgCharges(R, true)}${fiLegendeCharges(Math.round(R.params.tauxEndettementMax * 100))}</div>
  </div>
  <div class="grille">
    <div class="carte"><h3>Structure du financement</h3>${schemaMaisonFinancement(R.fpNet, r.premierRang, r.deuxiemeRang, R.prix, R.duree)}</div>
    <div class="carte"><h3>En chiffres</h3><table>
      ${ligne('Prix d’achat', fiCHF(R.prix))}${ligne(`Frais d’achat (${fmtCHF(fiNum(d.frais_pct))} %)`, fiCHF(R.frais))}${ligne('Fonds propres', fiCHF(R.fpTotal))}
      ${ligne('Hypothèque 1er rang', fiCHF(r.premierRang))}${ligne('Hypothèque 2e rang', fiCHF(r.deuxiemeRang))}${ligne('Amortissement', `${fiCHF(r.amortissementAnnuel)}/an sur ${R.duree} ans`)}
      ${ligne('Charge théorique', `${fiCHF(r.chargeTotaleAnnuelle / 12)}/mois`)}${ligne(`Coût réel (taux ${fmtCHF(fiNum(d.taux_effectif))} %)`, `${fiCHF(R.reel.total / 12)}/mois`, true)}
    </table></div>
  </div>
  <div class="carte"><h3>Évolution dans le temps</h3>${fiSvgTemps(R)}${fiLegendeTemps()}</div>
  ${typeof rexCitationRapportHtml === 'function' ? rexCitationRapportHtml('investissement') : ''}
  <div class="mention">Simulation indicative selon les règles usuelles des prêteurs suisses ; chaque établissement applique ses propres critères. Ne constitue pas une offre de financement. Assurex Sàrl — courtier en assurances inscrit auprès de la FINMA.</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`;
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  if (!w) showError('Autorise les fenêtres pop-up pour afficher le rapport.');
}
