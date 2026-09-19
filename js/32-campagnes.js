// ═══ CAMPAGNES MODERNISÉES (19.09.2026) ═════════════════════════════════════════════════════
// Redéfinit l'AFFICHAGE des campagnes (liste + fiche) au style des écrans refaits (js/18, 25, 27).
// Chargé après js/10 : les déclarations ci-dessous remplacent viewCampagnes, showCampagne et
// filtrerClientsCiblesCampagne. Toute la logique métier reste celle de js/10 (ciblage, textes,
// exclusions, création, suppression, export CSV, aperçu + envoi Outlook confirmé) : aucun envoi
// automatique, chaque courriel passe toujours par l'aperçu et la confirmation existants.
//
// Suivi des contacts (À contacter → Contacté → Intéressé → Gagné) : enregistré dans la table
// campagnes_suivi. Les campagnes personnalisées s'archivent (actif = false), jamais supprimées.

window._cpxFiltre = window._cpxFiltre || 'toutes';
window._cpxFiltreStatut = window._cpxFiltreStatut || 'tous';
window._cpxRecherche = window._cpxRecherche || '';

// Périodes recommandées des campagnes prédéfinies (mois de début et de fin, inclus) — sert au
// statut « En saison / Hors saison ». null = pertinente toute l'année.
const CPX_SAISONS = {
  'prevoyance': [2, 5],
  'sante': null,
  'sante-hausse-primes-2027': [9, 12],
};

const CPX_STATUTS = [
  { v: 'a_contacter', l: 'À contacter', c: '#94A3B8' },
  { v: 'contacte', l: 'Contacté', c: '#0EA5E9' },
  { v: 'interesse', l: 'Intéressé', c: '#F59E0B' },
  { v: 'gagne', l: 'Gagné', c: '#22C55E' },
  { v: 'refus', l: 'Pas intéressé', c: '#EF4444' },
];

function cpxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function cpxNom(c) { return c ? (estEntreprise(c) ? (c.nom || '') : `${c.prenom || ''} ${c.nom || ''}`.trim()) : ''; }
function cpxPluriel(n, mot, motPl) { return `${n} ${n > 1 ? (motPl || mot + 's') : mot}`; }
function cpxPct(n, total) { return total ? Math.round((n / total) * 100) : 0; }
function cpxNormaliser(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

function cpxEtat(t) {
  if (t.personnalisee) return { cle: 'active', label: 'Personnalisée', classe: 'violet' };
  const s = CPX_SAISONS[t.id];
  if (s === undefined) return { cle: 'active', label: 'Disponible', classe: 'bleu' };
  if (s === null) return { cle: 'annee', label: 'Toute l’année', classe: 'bleu' };
  const m = new Date().getMonth() + 1;
  return (m >= s[0] && m <= s[1]) ? { cle: 'saison', label: 'En saison', classe: 'vert' } : { cle: 'hors', label: 'Hors saison', classe: 'gris' };
}

function cpxCorrespondFiltre(t, filtre) {
  const e = cpxEtat(t);
  if (filtre === 'en-cours') return e.cle !== 'hors';
  if (filtre === 'hors') return e.cle === 'hors';
  if (filtre === 'perso') return !!t.personnalisee;
  return true;
}

function cpxDateLigne(t) {
  if (t.personnalisee) return `Créée le ${fmtDate(t.created_at)}${t.cree_par ? ' par ' + cpxEsc(t.cree_par) : ''}`;
  return cpxEsc(t.periode || '');
}

// Suivi des contacts enregistré dans le cloud (table campagnes_suivi, 19.09.2026) : chargé une
// fois, puis chaque changement de statut est écrit immédiatement (upsert campagne + client).
window._cpxSuiviDB = window._cpxSuiviDB || null;
async function cpxChargerSuivi() {
  const rows = await dbGet('campagnes_suivi', 'select=theme_id,client_id,statut');
  const db = {};
  (Array.isArray(rows) ? rows : []).forEach(r => { if (r.statut !== 'a_contacter') (db[r.theme_id] = db[r.theme_id] || {})[r.client_id] = r.statut; });
  window._cpxSuiviDB = db;
  if (currentView === 'campagnes') {
    const main = document.getElementById('main-content');
    if (vueDetailActive && vueDetailActive.type === 'campagne') showCampagne(vueDetailActive.id);
    else if (main) main.innerHTML = viewCampagnes();
  }
}
function cpxSuivi(t) {
  if (!window._cpxSuiviDB) { window._cpxSuiviDB = {}; cpxChargerSuivi(); }
  return (window._cpxSuiviDB[t.id] = window._cpxSuiviDB[t.id] || {});
}
async function cpxEnregistrerStatut(themeId, clientId, statut) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/campagnes_suivi?on_conflict=theme_id,client_id`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${await getValidAccessToken() || SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ theme_id: themeId, client_id: clientId, statut, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) showError('Statut non enregistré — réessaie.');
  } catch (e) { showError('Statut non enregistré (réseau) — réessaie.'); }
}
function cpxStatutClient(t, clientId) { return cpxSuivi(t)[clientId] || 'a_contacter'; }
function cpxComptes(t, cibles) {
  const s = cpxSuivi(t);
  const k = { cibles: cibles.length, contactes: 0, interesses: 0, gagnes: 0, refus: 0 };
  cibles.forEach(c => {
    const v = s[c.id] || 'a_contacter';
    if (v !== 'a_contacter') k.contactes++;
    if (v === 'interesse' || v === 'gagne') k.interesses++;
    if (v === 'gagne') k.gagnes++;
    if (v === 'refus') k.refus++;
  });
  return k;
}

// Clients réellement enregistrés avec la source « Campagne » (js/14) dont le détail cite la campagne.
function cpxClientsAcquis(t) {
  const titre = cpxNormaliser(t.titre);
  if (!titre) return [];
  return (allClients || []).filter(c => {
    if (c.source !== 'campagne' || !c.source_detail) return false;
    const d = cpxNormaliser(c.source_detail);
    return d.includes(titre) || (d.length >= 4 && titre.includes(d));
  });
}

// ═══ LISTE ═══════════════════════════════════════════════════════════════════════════════════
function viewCampagnes() {
  const toutes = [...CAMPAGNES_THEMES, ...allCampagnesPersonnalisees];
  const infos = toutes.map(t => ({ t, cibles: ciblesCampagne(t), etat: cpxEtat(t) }));
  const distincts = new Map();
  infos.forEach(x => x.cibles.forEach(c => distincts.set(c.id, c)));
  const nbDistincts = distincts.size;
  const avecEmail = [...distincts.values()].filter(c => c.email).length;
  const enCours = infos.filter(x => x.etat.cle !== 'hors').length;
  const enSaison = infos.filter(x => x.etat.cle === 'saison').length;
  const acquis = (allClients || []).filter(c => c.source === 'campagne').length;
  const filtre = window._cpxFiltre;

  const pastilles = [
    ['toutes', 'Toutes', infos.length],
    ['en-cours', 'En cours', enCours],
    ['hors', 'Hors saison', infos.filter(x => x.etat.cle === 'hors').length],
    ['perso', 'Personnalisées', allCampagnesPersonnalisees.length],
  ].map(([cle, label, n]) => `<button type="button" class="cpx-pastille ${filtre === cle ? 'actif' : ''}" aria-pressed="${filtre === cle}" onclick="cpxFiltrerListe('${cle}')">${label} <span>${n}</span></button>`).join('');

  const cartes = infos.map(({ t, cibles, etat }, i) => {
    const k = cpxComptes(t, cibles);
    const avancement = cpxPct(k.contactes, k.cibles);
    const emails = cibles.filter(c => c.email).length;
    const visible = cpxCorrespondFiltre(t, filtre);
    return `<button type="button" class="cpx-carte cpx-anim" style="--c:${cpxEsc(t.color)};--i:${i}" data-cpx-id="${cpxEsc(t.id)}" ${visible ? '' : 'hidden'} onclick="showCampagne('${cpxEsc(t.id)}')">
      <span class="cpx-carte-haut">
        <span class="cpx-icone" aria-hidden="true">${t.icon || '📣'}</span>
        <span class="cpx-badges">
          <span class="cpx-badge ${etat.classe}">${etat.label}</span>
          <span class="cpx-badge segment">${cpxEsc(t.segment || 'Tous')}</span>
        </span>
      </span>
      <span class="cpx-carte-titre">${cpxEsc(t.titre)}</span>
      <span class="cpx-carte-date">🗓 ${cpxDateLigne(t)}</span>
      <span class="cpx-carte-chiffres">
        <span><b>${k.cibles}</b> ciblé${k.cibles > 1 ? 's' : ''}</span>
        <span><b>${emails}</b> avec e-mail</span>
        ${k.interesses ? `<span><b>${k.interesses}</b> intéressé${k.interesses > 1 ? 's' : ''}</span>` : ''}
      </span>
      <span class="cpx-avancement">
        <span class="cpx-avancement-tete"><span>Avancement</span><b>${avancement} %</b></span>
        <span class="cpx-barre" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${avancement}" aria-label="Contacts contactés"><span style="width:${avancement}%"></span></span>
        <span class="cpx-avancement-sous">${k.contactes} / ${k.cibles} contacté${k.contactes > 1 ? 's' : ''}${k.gagnes ? ` · ${k.gagnes} gagné${k.gagnes > 1 ? 's' : ''}` : ''}</span>
      </span>
      <span class="cpx-carte-lien">Ouvrir la campagne →</span>
    </button>`;
  }).join('');

  const carteAjout = `<button type="button" class="cpx-carte cpx-carte-ajout cpx-anim" style="--i:${infos.length}" onclick="ouvrirNouvelleCampagnePersonnalisee()">
    <span class="cpx-ajout-plus" aria-hidden="true">+</span>
    <span class="cpx-carte-titre">Nouvelle campagne</span>
    <span class="cpx-carte-date">Ciblage, texte et export comme les campagnes prédéfinies</span>
  </button>`;

  return `<div class="dbx cpx">
    <header class="dx-tete">
      <div><div class="dx-surtitre">Marketing</div><h2>Campagnes</h2>
        <p class="cpx-intro">Choisis une campagne pour régler la cible, ajuster le texte et préparer tes e-mails. Rien n’est envoyé sans ta relecture.</p></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-save" onclick="ouvrirNouvelleCampagnePersonnalisee()">+ Nouvelle campagne</button>
      </div>
    </header>
    <div class="sux-kpis">
      <div class="sux-kpi"><span>Campagnes</span><b>${infos.length}</b><small>${enSaison ? `${enSaison} en saison actuellement` : `${enCours} en cours`}</small></div>
      <div class="sux-kpi"><span>Contacts ciblés</span><b>${nbDistincts}</b><small>clients distincts sur ${(allClients || []).length}</small></div>
      <div class="sux-kpi ${nbDistincts && avecEmail < nbDistincts ? 'alerte' : ''}"><span>Joignables par e-mail</span><b>${cpxPct(avecEmail, nbDistincts)} %</b><small>${nbDistincts - avecEmail ? `${nbDistincts - avecEmail} sans e-mail` : 'tous ont un e-mail ✓'}</small></div>
      <div class="sux-kpi"><span>Clients acquis par campagne</span><b>${acquis}</b><small>source « Campagne » sur la fiche</small></div>
    </div>
    <div class="cpx-pastilles" role="group" aria-label="Filtrer les campagnes">${pastilles}</div>
    <div class="cpx-grille" id="cpx-grille">${cartes}${carteAjout}</div>
    <div class="dbx-vide" id="cpx-liste-vide" style="display:${infos.some(x => cpxCorrespondFiltre(x.t, filtre)) ? 'none' : 'flex'}"><span style="font-size:26px">📭</span>Aucune campagne dans ce filtre.</div>
  </div>`;
}

function cpxFiltrerListe(cle) {
  window._cpxFiltre = cle;
  const toutes = [...CAMPAGNES_THEMES, ...allCampagnesPersonnalisees];
  let visibles = 0;
  document.querySelectorAll('#cpx-grille [data-cpx-id]').forEach(el => {
    const t = toutes.find(x => x.id === el.dataset.cpxId);
    const ok = !!t && cpxCorrespondFiltre(t, cle);
    el.hidden = !ok;
    if (ok) visibles++;
  });
  document.querySelectorAll('.cpx-pastilles .cpx-pastille').forEach(b => {
    const actif = (b.getAttribute('onclick') || '').includes(`'${cle}'`);
    b.classList.toggle('actif', actif);
    b.setAttribute('aria-pressed', String(actif));
  });
  const vide = document.getElementById('cpx-liste-vide');
  if (vide) vide.style.display = visibles > 0 ? 'none' : 'flex';
}

// ═══ FICHE ═══════════════════════════════════════════════════════════════════════════════════
function cpxLireDefilement(main) {
  return [document.scrollingElement, main, main && main.parentElement].filter(Boolean).map(el => [el, el.scrollTop]);
}

function showCampagne(themeId) {
  const t = trouverCampagne(themeId);
  if (!t) return;
  const main = document.getElementById('main-content');
  // Réaffichage de la même fiche (case cochée, filtre, statut…) : on garde défilement, recherche et filtre
  const memeFiche = currentView === 'campagne-detail' && currentCampagneId === themeId && vueDetailActive && vueDetailActive.type === 'campagne';
  const defilement = memeFiche ? cpxLireDefilement(main) : null;
  if (!memeFiche) { window._cpxRecherche = ''; window._cpxFiltreStatut = 'tous'; }

  const etatPrecedent = capturerEtatActuel();
  if (!(etatPrecedent.type === 'campagne' && etatPrecedent.id === themeId)) navHistory.push(etatPrecedent);
  vueDetailActive = { type: 'campagne', id: themeId };
  currentCampagneId = themeId;
  currentView = 'campagne-detail';

  const r = reglagesCampagne(t);
  const ciblesEligibles = ciblesEligiblesCampagne(t);
  const cibles = ciblesCampagne(t);
  const texte = texteCampagne(t);
  const etat = cpxEtat(t);
  const k = cpxComptes(t, cibles);
  const emails = cibles.filter(c => c.email).length;
  const acquis = cpxClientsAcquis(t);
  const tid = cpxEsc(t.id);

  // ── Entonnoir de suivi (bandeau) ──
  const etapes = [
    ['Ciblés', k.cibles, '#00CFFF'],
    ['Contactés', k.contactes, '#38BDF8'],
    ['Intéressés', k.interesses, '#FBBF24'],
    ['Gagnés', k.gagnes, '#4ADE80'],
  ].map(([label, n, c], i) => `<div class="cpx-etape" style="--c:${c}">
      <span class="cpx-etape-label">${label}</span>
      <b>${n}</b>
      <span class="cpx-etape-piste"><span style="width:${i === 0 ? (k.cibles ? 100 : 0) : cpxPct(n, k.cibles)}%"></span></span>
      <small>${i === 0 ? `${emails} avec e-mail` : `${cpxPct(n, k.cibles)} % des ciblés`}</small>
    </div>`).join('<span class="cpx-etape-fleche" aria-hidden="true">→</span>');

  // ── Entonnoir de ciblage (données réelles) ──
  const base = (allClients || []).length;
  const hbarres = [
    ['Base clients', base, '#94A3B8'],
    ['Correspondent aux critères', ciblesEligibles.length, '#1A4A9C'],
    ['Ciblés (après retraits)', cibles.length, '#00CFFF'],
    ['Avec e-mail', emails, '#22C55E'],
  ].map(([label, n, c], i) => `<div class="dbx-hbarre" style="--i:${i}">
      <div class="dbx-hbarre-nom"><span class="dbx-point" style="background:${c}"></span><span>${label}</span></div>
      <div class="dbx-hbarre-piste"><span style="--w:${cpxPct(n, base)}%"></span></div>
      <div class="dbx-hbarre-val">${n}<small>${cpxPct(n, base)} %</small></div>
    </div>`).join('');

  // ── Contacts ──
  const suivi = cpxSuivi(t);
  const nbStatut = v => cibles.filter(c => (suivi[c.id] || 'a_contacter') === v).length;
  const nbRetires = ciblesEligibles.length - cibles.length;
  const filtreStatut = window._cpxFiltreStatut;
  const pastillesStatut = [['tous', 'Tous', ciblesEligibles.length, ''], ...CPX_STATUTS.map(s => [s.v, s.l, nbStatut(s.v), s.c]), ['retire', 'Retirés', nbRetires, '']]
    .filter(([v, , n]) => v === 'tous' || v === 'a_contacter' || n > 0 || filtreStatut === v)
    .map(([v, l, n, c]) => `<button type="button" class="cpx-pastille ${filtreStatut === v ? 'actif' : ''}" aria-pressed="${filtreStatut === v}" data-statut-filtre="${v}" onclick="cpxFiltrerStatut('${v}')">${c ? `<i style="background:${c}"></i>` : ''}${l} <span>${n}</span></button>`).join('');

  const lignes = ciblesEligibles.map((c, i) => {
    const inclus = !r.exclusions.includes(c.id);
    const statut = cpxStatutClient(t, c.id);
    const def = CPX_STATUTS.find(s => s.v === statut) || CPX_STATUTS[0];
    const nom = cpxNom(c);
    const tel = c.mobile || c.tel || '';
    const corpsClient = texteCampagneAvecPlaceholders(texte.corps, c);
    const mailtoHref = `mailto:${c.email || ''}?subject=${encodeURIComponent(texte.sujet || '')}&body=${encodeURIComponent(corpsClient)}`;
    const recherche = cpxEsc(`${nom} ${c.email || ''}`.toLowerCase());
    const cid = cpxEsc(c.id);
    return `<div class="cpx-contact ${inclus ? '' : 'retire'}" style="--i:${Math.min(i, 20)}" data-search="${recherche}" data-statut="${inclus ? statut : 'retire'}">
      <label class="cpx-coche" title="${inclus ? 'Retirer de la campagne' : 'Remettre dans la campagne'}">
        <input type="checkbox" ${inclus ? 'checked' : ''} aria-label="Inclure ${cpxEsc(nom)}" onchange="toggleClientExclusionCampagne('${tid}','${cid}',this.checked)" style="accent-color:${cpxEsc(t.color)}"/>
      </label>
      <div class="cpx-contact-corps">
        <button type="button" class="cpx-contact-nom" onclick="showClient('${cid}')">${estEntreprise(c) ? '🏢 ' : ''}${cpxEsc(nom) || '—'}</button>
        <small>${c.email ? cpxEsc(c.email) : '<em>Pas d’e-mail</em>'}${tel ? ' · ' + cpxEsc(tel) : ''}</small>
      </div>
      ${inclus ? `<select class="cpx-statut" style="--c:${def.c}" aria-label="Statut de suivi de ${cpxEsc(nom)}" onchange="cpxChangerStatut('${tid}','${cid}',this.value)">
          ${CPX_STATUTS.map(s => `<option value="${s.v}" ${s.v === statut ? 'selected' : ''}>${s.l}</option>`).join('')}
        </select>` : '<span class="cpx-retire-label">Retiré</span>'}
      <div class="cpx-contact-actions">
        ${inclus && c.email ? `<a class="cpx-icone-btn" href="${cpxEsc(mailtoHref)}" title="Ouvrir dans mon client mail" aria-label="Mailto ${cpxEsc(nom)}">✉️</a>` : ''}
        ${inclus && tel ? `<a class="cpx-icone-btn" href="tel:${cpxEsc(tel.replace(/\s/g, ''))}" title="Appeler ${cpxEsc(tel)}" aria-label="Appeler ${cpxEsc(nom)}">📞</a>` : ''}
        ${inclus ? `<button type="button" class="cpx-btn-petit cpx-apercu" aria-label="Aperçu du mail pour ${cpxEsc(nom)}" onclick="ouvrirApercuEmailCampagne('${tid}','${cid}')">👁<span> Aperçu</span></button>`
                 : `<button type="button" class="cpx-btn-petit" onclick="toggleClientExclusionCampagne('${tid}','${cid}',true)">↺ Remettre</button>`}
      </div>
    </div>`;
  }).join('');

  const option = (champ, actif, texteLabel, aide) => `<label class="cpx-option">
      <input type="checkbox" ${actif ? 'checked' : ''} onchange="appliquerReglageCampagne('${tid}','${champ}',this.checked)"/>
      <span><b>${texteLabel}</b>${aide ? `<small>${aide}</small>` : ''}</span>
    </label>`;

  main.innerHTML = `<div class="dbx cpx cpx-fiche ${memeFiche ? 'dbx-calme cpx-calme' : ''}">
    <section class="fcx-hero cpx-hero" style="--c:${cpxEsc(t.color)}">
      <div class="fcx-hero-deco" aria-hidden="true"></div>
      <div class="fcx-hero-haut">
        <div class="fcx-identite">
          <div class="cpx-hero-icone" aria-hidden="true">${t.icon || '📣'}</div>
          <div class="fcx-identite-texte">
            <div class="fcx-surtitre">Campagne ${t.personnalisee ? 'personnalisée' : 'prédéfinie'} · ${cpxEsc(t.segment || 'Tous')}</div>
            <h1 class="fcx-nom">${cpxEsc(t.titre)}</h1>
            <div class="fcx-contacts">
              <span class="fcx-badge ${etat.cle === 'saison' ? 'ok' : etat.cle === 'hors' ? '' : 'on'}">${etat.label}</span>
              <span class="fcx-chip">🗓 ${cpxDateLigne(t)}</span>
              <span class="fcx-chip">👥 ${cpxPluriel(cibles.length, 'client ciblé', 'clients ciblés')}</span>
            </div>
          </div>
        </div>
        <div class="fcx-actions">
          <div class="fcx-actions-principales">
            <button type="button" class="fcx-btn-blanc" onclick="ouvrirApercuEmailCampagne('${tid}')">✉️ Préparer le mail</button>
            <button type="button" class="fcx-btn-verre" onclick="exporterPublipostageCampagne('${tid}')">📊 Export CSV</button>
          </div>
          <div class="fcx-actions-menus">
            <button type="button" onclick="reinitialiserTexteCampagne('${tid}')">↺ Texte par défaut</button>
            ${t.personnalisee ? `<button type="button" onclick="supprimerCampagnePersonnalisee('${tid}')">🗄 Archiver la campagne</button>` : ''}
          </div>
        </div>
      </div>
      <div class="cpx-entonnoir" aria-label="Avancement de la campagne">${etapes}</div>
    </section>

    <div class="opx-grille cpx-grille-fiche">
      <div class="opx-col cpx-col-contacts">
        <section class="dbx-carte">
          <div class="dbx-carte-tete cpx-tete-contacts">
            <h3 class="opx-h3">Contacts <span class="cpx-compte">${cibles.length} sur ${ciblesEligibles.length}</span></h3>
            <div class="cpx-tete-boutons">
              <button type="button" class="cpx-btn-petit" onclick="toutSelectionnerCampagne('${tid}')">☑ Tout sélectionner</button>
              <button type="button" class="cpx-btn-petit" onclick="toutDeselectionnerCampagne('${tid}')">☐ Tout désélectionner</button>
            </div>
          </div>
          <input type="search" class="form-input cpx-recherche" placeholder="🔍 Rechercher un contact (nom, e-mail)…" value="${cpxEsc(window._cpxRecherche)}" oninput="filtrerClientsCiblesCampagne(this.value)" aria-label="Rechercher un contact"/>
          <div class="cpx-pastilles cpx-pastilles-statut" role="group" aria-label="Filtrer par statut">${pastillesStatut}</div>
          <div class="cpx-liste" id="campagne-cibles-tbody">${lignes || '<div class="dbx-vide-petit">Aucun client ne correspond à ces critères actuellement.</div>'}</div>
          <div id="campagne-cibles-recherche-vide" class="dbx-vide-petit" style="display:none;text-align:center">Aucun contact ne correspond à cette recherche.</div>
          <p class="cpx-note">Le statut de suivi est conservé pendant la session (comme les autres réglages de campagne), pas encore en base. La case retire ou remet un client dans la cible.</p>
        </section>
      </div>

      <div class="opx-col cpx-col-reglages">
        <section class="dbx-carte">
          <div class="dbx-carte-tete"><h3 class="opx-h3">🎯 Ciblage</h3><span class="dbx-carte-sous">${ciblesEligibles.length} / ${base} correspondent</span></div>
          <div class="form-field"><label class="form-label" for="cpx-segment">Segment</label>
            <select class="form-select" id="cpx-segment" onchange="appliquerReglageCampagne('${tid}','segment',this.value)">
              <option value="tous" ${r.segment === 'tous' ? 'selected' : ''}>Tous les clients</option>
              <option value="prive" ${r.segment === 'prive' ? 'selected' : ''}>Privés uniquement</option>
              <option value="entreprise" ${r.segment === 'entreprise' ? 'selected' : ''}>Entreprises uniquement</option>
            </select>
          </div>
          <div class="cpx-options">
            ${option('sansSante', r.sansSante, 'Sans complémentaire santé active', 'Recommandation intelligente')}
            ${option('emailUniquement', r.emailUniquement, 'E-mail renseigné uniquement', 'Nécessaire pour un envoi')}
            ${option('cofidexUniquement', r.cofidexUniquement, 'Clients EX (Cofidex) uniquement', '')}
          </div>
          <div class="dbx-hbarres cpx-hbarres">${hbarres}</div>
          <p class="cpx-note">${cpxPluriel(ciblesEligibles.length, 'client correspond', 'clients correspondent')} à ces critères sur ${base} au total — ${cibles.length} effectivement ciblé${cibles.length > 1 ? 's' : ''} après retraits manuels.${acquis.length ? ` <b>${cpxPluriel(acquis.length, 'client acquis', 'clients acquis')}</b> avec la source « Campagne — ${cpxEsc(t.titre)} ».` : ''}</p>
        </section>

        <section class="dbx-carte">
          <div class="dbx-carte-tete"><h3 class="opx-h3">✉️ Objet et texte du message</h3></div>
          <div class="form-field"><label class="form-label" for="cpx-sujet">Objet</label>
            <input class="form-input" id="cpx-sujet" oninput="sauverTexteCampagne('${tid}','sujet',this.value)" value="${cpxEsc(texte.sujet || '')}"/></div>
          <div class="form-field" style="margin-top:10px"><label class="form-label" for="cpx-corps">Corps</label>
            <textarea class="form-input cpx-corps" id="cpx-corps" oninput="sauverTexteCampagne('${tid}','corps',this.value)">${cpxEsc(texte.corps || '')}</textarea></div>
          <p class="cpx-note">Variables : <code>{prenom}</code> (prénom du client), <code>{lien_rdv}</code> (lien de réservation de RDV en autonomie).</p>
          <div class="cpx-boutons">
            <button type="button" class="btn-save" onclick="ouvrirApercuEmailCampagne('${tid}')">✉️ Générer le mail prêt à l'envoi</button>
            <button type="button" class="btn-secondary" onclick="exporterPublipostageCampagne('${tid}')">📊 Exporter pour publipostage (CSV)</button>
            <button type="button" class="btn-secondary" onclick="reinitialiserTexteCampagne('${tid}')">↺ Réinitialiser le texte</button>
          </div>
          <p class="cpx-note">Aucun envoi automatique : chaque courriel s’ouvre d’abord en aperçu, à relire puis copier, ouvrir dans ton client mail ou envoyer après confirmation.</p>
        </section>
      </div>
    </div>
  </div>`;
  insertBackBar({ homeId: 'campagnes', homeLabel: 'Campagnes', itemLabel: cpxEsc(t.titre) });

  if (window._cpxRecherche || window._cpxFiltreStatut !== 'tous') filtrerClientsCiblesCampagne(window._cpxRecherche);
  if (defilement) defilement.forEach(([el, y]) => { el.scrollTop = y; });
  else window.scrollTo(0, 0);
}

function cpxChangerStatut(themeId, clientId, valeur) {
  const t = trouverCampagne(themeId);
  if (!t) return;
  const s = cpxSuivi(t);
  if (valeur === 'a_contacter') delete s[clientId]; else s[clientId] = valeur;
  cpxEnregistrerStatut(themeId, clientId, valeur);
  showCampagne(themeId);
}

// Archivage (actif = false) au lieu de la suppression définitive — règle du CRM : jamais de hard delete
async function supprimerCampagnePersonnalisee(themeId) {
  const t = trouverCampagne(themeId);
  if (!t || !t.personnalisee) return;
  if (!confirm(`Archiver la campagne « ${t.titre} » ? Elle disparaît de la liste mais reste conservée (suivi des contacts compris).`)) return;
  const r = await dbPatch('campagnes_personnalisees', themeId, { actif: false });
  if (r && r.error) { showError('Erreur lors de l’archivage : ' + errMsg(r)); return; }
  allCampagnesPersonnalisees = allCampagnesPersonnalisees.filter(x => x.id !== themeId);
  showError('✓ Campagne archivée.');
  navigate('campagnes');
}

function cpxFiltrerStatut(valeur) {
  window._cpxFiltreStatut = valeur;
  document.querySelectorAll('.cpx-pastilles-statut .cpx-pastille').forEach(b => {
    const actif = b.dataset.statutFiltre === valeur;
    b.classList.toggle('actif', actif);
    b.setAttribute('aria-pressed', String(actif));
  });
  filtrerClientsCiblesCampagne(window._cpxRecherche);
}

// Recherche live (nom / e-mail) + filtre de statut — masque seulement les lignes déjà rendues
// (pas de ré-affichage), pour garder le focus du champ pendant la frappe (même principe que js/10).
function filtrerClientsCiblesCampagne(query) {
  window._cpxRecherche = query || '';
  const q = window._cpxRecherche.toLowerCase().trim();
  const filtre = window._cpxFiltreStatut || 'tous';
  const liste = document.getElementById('campagne-cibles-tbody');
  if (!liste) return;
  let visibles = 0;
  const lignes = liste.querySelectorAll('[data-search]');
  lignes.forEach(el => {
    const ok = el.dataset.search.includes(q) && (filtre === 'tous' || el.dataset.statut === filtre);
    el.style.display = ok ? '' : 'none';
    if (ok) visibles++;
  });
  const vide = document.getElementById('campagne-cibles-recherche-vide');
  if (vide) {
    vide.style.display = (lignes.length && visibles === 0) ? 'block' : 'none';
    vide.textContent = q ? 'Aucun contact ne correspond à cette recherche.' : 'Aucun contact avec ce statut.';
  }
}
