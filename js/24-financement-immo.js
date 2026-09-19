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
const FI_COUL = { fp: '#F59E0B', r1: '#113679', r2: '#0EA5E9', interets: '#113679', amort: '#0EA5E9', entretien: '#F59E0B' };

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
  return `<div class="dbx ap fi">
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
      <section class="ap-droite"><div id="fi-resultats">${fiResultats()}</div></section>
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
  if (z) z.innerHTML = fiResultats();
}

// ── Résultats ───────────────────────────────────────────────────────────────────────────────
function fiResultats() {
  const d = _fi.d;
  if (!fiNum(d.prix) || !fiNum(d.revenu)) return `<div class="dbx-vide"><img src="assets/logos/rex-mascotte-hd.png" alt=""/><strong>Indique le prix du bien et le revenu du ménage</strong><span>Le financement, le taux d’effort, le coût réel et le prix maximal s’affichent au fil de la saisie.</span></div>`;
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
      <section class="dbx-carte"><header class="dbx-carte-tete"><h2>Charges annuelles</h2><span class="dbx-carte-sous">théorique (banques) et réel</span></header>${fiSvgCharges(R)}
        <div class="ap-legende"><span><i style="background:${FI_COUL.interets}"></i>Intérêts</span><span><i style="background:${FI_COUL.amort}"></i>Amortissement</span><span><i style="background:${FI_COUL.entretien}"></i>Entretien</span><span><i style="background:#EF4444;height:3px"></i>Limite ${fmtCHF(effMax)} % du revenu</span></div>
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
      ${fiSvgTemps(R)}
      <div class="ap-legende"><span><i style="background:${FI_COUL.r1}"></i>1er rang</span><span><i style="background:${FI_COUL.r2}"></i>2e rang (amorti)</span><span><i style="background:#EF4444;height:3px"></i>Taux d’effort théorique</span></div>
      ${R.effortRetraite != null ? `<div class="cf-note ${R.effortRetraite <= R.params.tauxEndettementMax ? 'vert' : 'rouge'}">À la retraite : charge théorique ${fiCHF(R.chargeRetraite)}/an pour ${fiCHF(R.revRet)} de revenu, soit <b>${(R.effortRetraite * 100).toFixed(1).replace('.', ',')} %</b> — ${R.effortRetraite <= R.params.tauxEndettementMax ? 'tenable.' : 'au-delà de la limite : prévoir un amortissement supplémentaire ou des fonds à la retraite.'}</div>` : '<p class="cf-mention">Indique le revenu à la retraite pour vérifier que la charge reste supportable après la retraite (question systématique des banques).</p>'}
    </section>
    <p class="cf-mention">Simulation indicative selon les règles usuelles de branche (taux théorique ${fmtCHF(fiNum(d.taux_theo))} %, entretien ${fmtCHF(fiNum(d.entretien))} %, 1er rang ≤ 65 %, 2e rang amorti en ${IMMO_LEGAL.duree_amortissement_defaut} ans ou jusqu’à la retraite). Chaque prêteur applique ses propres critères.</p>`;
}

// Colonnes : charges théoriques vs réelles, ligne de la limite (1/3 du revenu)
function fiSvgCharges(R, imprime) {
  const r = R.r, W = 340, H = 230, g = 48, bas = 190, haut = 18;
  const limite = R.revenu * R.params.tauxEndettementMax;
  const max = Math.max(r.chargeTotaleAnnuelle, R.reel.total, limite, 1) * 1.1;
  const y = v => bas - v / max * (bas - haut);
  const col = (x, segs, tot, lib) => { let cum = 0; return segs.map(([v, c, t]) => { const h = v / max * (bas - haut); const s = `<rect x="${x}" y="${(bas - cum - h).toFixed(1)}" width="84" height="${Math.max(0, h).toFixed(1)}" fill="${c}"><title>${t} : ${fmtCHF(Math.round(v))}/an</title></rect>`; cum += h; return s; }).join('') + `<text x="${x + 42}" y="${(y(tot) - 5).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="bold" fill="#64748B">${fiK(tot)}</text><text x="${x + 42}" y="${bas + 15}" text-anchor="middle" font-size="11" fill="#8A94A8">${lib}</text>`; };
  const ticks = [0, limite].map(v => `<line x1="${g}" x2="${W - 6}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#94A3B8" stroke-opacity=".25"/><text x="${g - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#8A94A8">${fiK(v)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="ap-svg" role="img" aria-label="Charges théoriques et réelles" font-family="Arial,Helvetica,sans-serif">${ticks}
    ${col(g + 26, [[r.interetsAnnuels, FI_COUL.interets, 'Intérêts théoriques'], [r.amortissementAnnuel, FI_COUL.amort, 'Amortissement'], [r.chargesAnnuelles, FI_COUL.entretien, 'Entretien']], r.chargeTotaleAnnuelle, 'Théorique')}
    ${col(g + 160, [[R.reel.interets, FI_COUL.interets, 'Intérêts réels'], [R.reel.amort, FI_COUL.amort, 'Amortissement'], [R.reel.entretien, FI_COUL.entretien, 'Entretien']], R.reel.total, 'Réel')}
    <line x1="${g}" x2="${W - 6}" y1="${y(limite).toFixed(1)}" y2="${y(limite).toFixed(1)}" stroke="#EF4444" stroke-width="2.5"/><text x="${W - 8}" y="${(y(limite) - 5).toFixed(1)}" text-anchor="end" font-size="10" font-weight="bold" fill="#EF4444">limite ${fiK(limite)}</text>
  </svg>`;
}

// Frise : dette (1er rang constant, 2e rang qui s'amortit) et taux d'effort théorique
function fiSvgTemps(R) {
  const r = R.r, ans = Math.min(40, Math.max(R.duree + 5, R.age != null ? R.ageRet - R.age + 5 : 20));
  const W = 760, H = 250, g = 52, bas = 200, haut = 16, droite = W - 44;
  const annee0 = new Date().getFullYear();
  const pts = [];
  for (let y = 0; y <= ans; y++) {
    const r2 = Math.max(0, r.deuxiemeRang - r.amortissementAnnuel * y);
    const charge = (r.premierRang + r2) * R.params.tauxInteret + (r2 > 0 ? r.amortissementAnnuel : 0) + r.chargesAnnuelles;
    const retraite = R.age != null && R.age + y >= R.ageRet;
    const rev = retraite && R.revRet ? R.revRet : R.revenu;
    pts.push({ y, r1: r.premierRang, r2, effort: rev ? charge / rev : 0, age: R.age != null ? R.age + y : null, an: annee0 + y, evt: y === R.duree && r.deuxiemeRang > 0 ? '2e rang amorti' : (R.age != null && R.age + y === R.ageRet ? 'Retraite' : '') });
  }
  const maxD = Math.max(r.hypotheque, 1) * 1.08, maxE = Math.max(0.5, ...pts.map(p => p.effort)) * 1.1;
  const n = pts.length, pas = (droite - g) / n, bw = Math.max(2, pas * 0.74);
  const yD = v => bas - v / maxD * (bas - haut), yE = v => bas - v / maxE * (bas - haut);
  const barres = pts.map((p, i) => { const x = g + i * pas + (pas - bw) / 2; const h1 = p.r1 / maxD * (bas - haut), h2 = p.r2 / maxD * (bas - haut);
    return `<rect x="${x.toFixed(1)}" y="${(bas - h1).toFixed(1)}" width="${bw.toFixed(1)}" height="${h1.toFixed(1)}" fill="${FI_COUL.r1}"><title>${p.an} — 1er rang ${fmtCHF(Math.round(p.r1))}</title></rect><rect x="${x.toFixed(1)}" y="${(bas - h1 - h2).toFixed(1)}" width="${bw.toFixed(1)}" height="${h2.toFixed(1)}" fill="${FI_COUL.r2}"><title>${p.an} — 2e rang ${fmtCHF(Math.round(p.r2))}</title></rect>`; }).join('');
  const ligne = pts.map((p, i) => `${i ? 'L' : 'M'}${(g + i * pas + pas / 2).toFixed(1)},${yE(p.effort).toFixed(1)}`).join(' ');
  const lim = yE(R.params.tauxEndettementMax);
  const etiq = pts.map((p, i) => (i % 5 === 0 || i === n - 1) ? `<text x="${(g + i * pas + pas / 2).toFixed(1)}" y="${bas + 14}" text-anchor="middle" font-size="10" fill="#8A94A8">${p.age != null ? p.age : '+' + p.y}</text><text x="${(g + i * pas + pas / 2).toFixed(1)}" y="${bas + 26}" text-anchor="middle" font-size="9" fill="#8A94A8" opacity=".75">${p.an}</text>` : '').join('');
  const evts = pts.map((p, i) => p.evt ? `<line x1="${(g + i * pas).toFixed(1)}" x2="${(g + i * pas).toFixed(1)}" y1="${haut - 4}" y2="${bas}" stroke="#64748B" stroke-opacity=".5" stroke-dasharray="3 3"/><text x="${(g + i * pas + 3).toFixed(1)}" y="${haut + 6}" font-size="9.5" font-weight="bold" fill="#64748B">${p.evt}</text>` : '').join('');
  const ticksD = [0, maxD / 2 / 1.08, maxD / 1.08].map(v => `<text x="${g - 6}" y="${(yD(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#8A94A8">${fiK(v)}</text><line x1="${g}" x2="${droite}" y1="${yD(v).toFixed(1)}" y2="${yD(v).toFixed(1)}" stroke="#94A3B8" stroke-opacity=".2"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="ap-svg ap-svg-temps" role="img" aria-label="Évolution de la dette hypothécaire" font-family="Arial,Helvetica,sans-serif">${ticksD}${barres}
    <line x1="${g}" x2="${droite}" y1="${lim.toFixed(1)}" y2="${lim.toFixed(1)}" stroke="#EF4444" stroke-opacity=".45" stroke-dasharray="5 4"/>
    <path d="${ligne}" fill="none" stroke="#EF4444" stroke-width="2.5"/>
    <text x="${droite + 4}" y="${(lim + 3.5).toFixed(1)}" font-size="10" fill="#EF4444">${Math.round(R.params.tauxEndettementMax * 100)} %</text>
    <text x="${droite + 4}" y="${(yE(pts[0].effort) + 3.5).toFixed(1)}" font-size="10" font-weight="bold" fill="#EF4444">${Math.round(pts[0].effort * 100)} %</text>
    ${evts}${etiq}
    <text x="${g}" y="${H - 4}" font-size="9.5" fill="#8A94A8">âge · année — barres : dette (CHF), ligne rouge : taux d’effort théorique</text>
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
  .verdict{border-radius:12px;padding:12px 16px;margin-bottom:14px;font-size:13px;background:${R.ok ? '#DCFCE7' : '#FEE2E2'};color:${R.ok ? '#166534' : '#991B1B'}}.grille{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:14px}.carte{border:1px solid #E2E7EF;border-radius:12px;padding:12px 14px;break-inside:avoid}h3{color:#113679;font-size:13.5px;margin:0 0 8px}table{width:100%;border-collapse:collapse}.ap-svg{width:100%;height:auto}.mention{font-size:9.5px;color:#8A94A8;margin-top:14px;border-top:1px solid #E2E7EF;padding-top:8px}@page{margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>
  <header><div><h1>Financement immobilier</h1><div class="sous">${fiEsc(d.nom || 'Simulation')} · ${new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>${typeof ASSUREX_LOGO_B64 !== 'undefined' ? `<img src="${ASSUREX_LOGO_B64}" alt="Assurex"/>` : ''}</header>
  <div class="verdict"><b>${R.ok ? '✓ Projet finançable' : '✕ Projet non finançable en l’état'}</b> — prix maximal finançable : <b>${fiCHF(R.pm.prixMax)}</b></div>
  <div class="grille">
    <div class="carte"><h3>Les trois règles</h3>
      ${v(r.fpSuffisants, `Fonds propres ≥ ${R.params.residenceSecondaire ? '33' : '20'} %`, `${fiCHF(R.fpNet)} / ${fiCHF(r.fpMinRequis)} requis`)}
      ${v(r.fpDursSuffisants, 'Fonds propres hors 2e pilier', `${fiCHF(r.fondsPropresDurs)} / ${fiCHF(r.fpDursRequis)} requis`)}
      ${v(r.tauxEffort <= R.params.tauxEndettementMax, 'Taux d’effort', `${(r.tauxEffort * 100).toFixed(1)} % (max. ${Math.round(R.params.tauxEndettementMax * 100)} %)`)}
    </div>
    <div class="carte"><h3>Charges annuelles</h3>${fiSvgCharges(R)}</div>
  </div>
  <div class="grille">
    <div class="carte"><h3>Structure du financement</h3>${schemaMaisonFinancement(R.fpNet, r.premierRang, r.deuxiemeRang, R.prix, R.duree)}</div>
    <div class="carte"><h3>En chiffres</h3><table>
      ${ligne('Prix d’achat', fiCHF(R.prix))}${ligne(`Frais d’achat (${fmtCHF(fiNum(d.frais_pct))} %)`, fiCHF(R.frais))}${ligne('Fonds propres', fiCHF(R.fpTotal))}
      ${ligne('Hypothèque 1er rang', fiCHF(r.premierRang))}${ligne('Hypothèque 2e rang', fiCHF(r.deuxiemeRang))}${ligne('Amortissement', `${fiCHF(r.amortissementAnnuel)}/an sur ${R.duree} ans`)}
      ${ligne('Charge théorique', `${fiCHF(r.chargeTotaleAnnuelle / 12)}/mois`)}${ligne(`Coût réel (taux ${fmtCHF(fiNum(d.taux_effectif))} %)`, `${fiCHF(R.reel.total / 12)}/mois`, true)}
    </table></div>
  </div>
  <div class="carte"><h3>Évolution dans le temps</h3>${fiSvgTemps(R)}</div>
  <div class="mention">Simulation indicative selon les règles usuelles des prêteurs suisses ; chaque établissement applique ses propres critères. Ne constitue pas une offre de financement. Assurex Sàrl — courtier en assurances inscrit auprès de la FINMA.</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`;
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  if (!w) showError('Autorise les fenêtres pop-up pour afficher le rapport.');
}
