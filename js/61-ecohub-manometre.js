// ═══ ECOHUB SUR LE TABLEAU DE BORD : MANOMÈTRE ET NOUVEAUX DOCUMENTS (20.09.2026) ══════════════
// Demande de Jonathan : voir l'état d'EcoHub d'un coup d'œil, et être prévenu quand la
// synchronisation a déposé de nouveaux documents.
//
// Le manomètre affiche UN seul chiffre, celui sur lequel on peut agir : la part des contrats des
// compagnies suivies qui portent un numéro de police. C'est lui qui décide si une ligne reçue
// retrouvera son contrat ou finira « à rattacher ». Un indice composite mélangeant préparation,
// conventions et fraîcheur donnerait un nombre que personne ne saurait interpréter ni corriger ;
// les deux autres informations sont donc affichées à côté, en clair, pas fondues dans l'aiguille.

const EHM_CLE_VU = 'ecohub-docs-vus';

window._ehm = window._ehm || { etat: null, chargement: false };

function ehmEsc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function ehmDernierVu() {
  try { return localStorage.getItem(EHM_CLE_VU) || ''; } catch (e) { return ''; }
}
function ehmMarquerVu() {
  try { localStorage.setItem(EHM_CLE_VU, new Date().toISOString()); } catch (e) {}
  window._ehm.etat = null;
  if (typeof dbxRerendre === 'function' && currentView === 'dashboard') dbxRerendre(true);
}

async function ehmCharger() {
  const E = { preparation: null, contrats: 0, sansPolice: 0, compagniesOuvertes: 0, compagniesSuivies: 0,
              derniere: null, nouveaux: [], total: 0 };
  try {
    const [partenaires, executions, documents] = await Promise.all([
      dbGet('ecohub_partenaires', 'select=compagnie,convention').catch(() => []),
      dbGet('ecohub_executions', 'select=demarre_le,statut,documents_deposes&order=demarre_le.desc&limit=1').catch(() => []),
      dbGet('documents_compagnies', 'select=id,titre,client_id,numero_police,created_at,source&order=created_at.desc&limit=60').catch(() => []),
    ]);
    const suivies = (partenaires || []).filter(p => p.convention && p.convention !== 'aucune');
    E.compagniesSuivies = suivies.length;
    E.compagniesOuvertes = suivies.filter(p => p.convention === 'active' || p.convention === 'signee').length;

    // Préparation : sur les contrats des compagnies suivies, combien portent un numéro de police
    const noms = new Set(suivies.map(p => String(p.compagnie || '').toLowerCase()));
    const contrats = (typeof allContrats !== 'undefined' ? allContrats : [])
      .filter(c => !['résilié', 'annulé', 'mandat_resilie'].includes(c.statut))
      .filter(c => !noms.size || noms.has(String(c.compagnie || '').toLowerCase()));
    E.contrats = contrats.length;
    E.sansPolice = contrats.filter(c => !c.numero_police).length;
    E.preparation = E.contrats ? Math.round((E.contrats - E.sansPolice) * 100 / E.contrats) : null;

    E.derniere = (executions || [])[0] || null;
    E.total = (documents || []).length;
    const vu = ehmDernierVu();
    E.nouveaux = (documents || []).filter(d => d.source === 'ecohub' && (!vu || String(d.created_at) > vu));
  } catch (e) { /* le tableau de bord ne doit jamais tomber pour un bandeau */ }
  window._ehm.etat = E;
}

// ── Le logo EcoHub (22.09.2026) ─────────────────────────────────────────────────────────────────
// « Utilise ce logo pour les notifs EcoHub, les documents, le bouton d'envoi et les messages sur le
// tableau de bord. » Logo complet pour les titres, symbole seul (l'hexagone) pour les pastilles et
// les boutons, où le mot entier serait illisible. Version marine et version blanche : le CSS
// (css/90) bascule sur la blanche en thème sombre et sur les fonds bleus.
function ehmLogo(opts) {
  const o = opts || {};
  const f = o.icone ? 'ecohub-icone' : 'ecohub';
  const h = o.h || (o.icone ? 16 : 18);
  return `<img class="ehx-logo ${o.icone ? 'ehx-logo-icone' : ''} ${o.blanc ? 'ehx-blanc' : ''} ${o.classe || ''}" src="assets/logos/${f}${o.blanc ? '-blanc' : ''}.svg" alt="${o.alt == null ? 'EcoHub' : o.alt}" height="${h}" style="height:${h}px;width:auto"/>`;
}

// ── Le manomètre ────────────────────────────────────────────────────────────────────────────────
// Demi-cadran de 180°, aiguille à gauche quand rien n'est prêt, à droite quand tout l'est.
function htmlManometreEcohub(valeur, taille) {
  const t = taille || 168;
  const v = valeur == null ? 0 : Math.max(0, Math.min(100, valeur));
  const R = 68, cx = 100, cy = 92;
  const angle = (p) => Math.PI * (1 - p / 100);          // 0 % à gauche, 100 % à droite
  const pt = (p, r) => `${(cx + Math.cos(angle(p)) * r).toFixed(2)} ${(cy - Math.sin(angle(p)) * r).toFixed(2)}`;
  const arc = (de, a, r, couleur, epaisseur) =>
    `<path d="M ${pt(de, r)} A ${r} ${r} 0 0 1 ${pt(a, r)}" fill="none" stroke="${couleur}" stroke-width="${epaisseur}" stroke-linecap="round"/>`;
  const graduations = [0, 25, 50, 75, 100].map(p =>
    `<line x1="${pt(p, R - 13).split(' ')[0]}" y1="${pt(p, R - 13).split(' ')[1]}" x2="${pt(p, R - 5).split(' ')[0]}" y2="${pt(p, R - 5).split(' ')[1]}" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`).join('');
  const aAig = angle(v);
  const bout = `${(cx + Math.cos(aAig) * (R - 18)).toFixed(2)} ${(cy - Math.sin(aAig) * (R - 18)).toFixed(2)}`;
  const talon1 = `${(cx + Math.cos(aAig + Math.PI / 2) * 5).toFixed(2)} ${(cy - Math.sin(aAig + Math.PI / 2) * 5).toFixed(2)}`;
  const talon2 = `${(cx + Math.cos(aAig - Math.PI / 2) * 5).toFixed(2)} ${(cy - Math.sin(aAig - Math.PI / 2) * 5).toFixed(2)}`;
  const ton = v >= 90 ? '#4ADE80' : v >= 65 ? '#FBBF24' : '#FB7185';
  return `<svg class="ehm-cadran" viewBox="0 0 200 118" style="width:${t}px" role="img" aria-label="Préparation EcoHub : ${v} %">
    ${arc(0, 100, R, 'rgba(255,255,255,.12)', 13)}
    ${arc(0, 65, R, 'rgba(251,113,133,.55)', 13)}
    ${arc(65, 90, R, 'rgba(251,191,36,.55)', 13)}
    ${arc(90, 100, R, 'rgba(74,222,128,.6)', 13)}
    ${graduations}
    ${valeur == null ? '' : `<polygon points="${bout} ${talon1} ${talon2}" fill="${ton}"/>`}
    <circle cx="${cx}" cy="${cy}" r="6.5" fill="#0E1B33" stroke="${ton}" stroke-width="2.5"/>
    <text x="${cx}" y="${cy - 16}" text-anchor="middle" font-size="27" font-weight="800" fill="#fff">${valeur == null ? '—' : v + ' %'}</text>
    <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="9.5" letter-spacing="1.6" fill="rgba(255,255,255,.55)">PRÊT AU RAPPROCHEMENT</text>
  </svg>`;
}

// ── La carte du tableau de bord ─────────────────────────────────────────────────────────────────
function ehmCarteDashboard() {
  const E = window._ehm.etat;
  if (!E) {
    if (!window._ehm.chargement) {
      window._ehm.chargement = true;
      ehmCharger().then(() => {
        window._ehm.chargement = false;
        // La carte vit à deux endroits : le tableau de bord et la page EcoHub. On rafraîchit
        // celui où l'on se trouve, sinon la jauge reste vide là où on l'a justement cherchée.
        if (currentView === 'dashboard' && typeof dbxRerendre === 'function') dbxRerendre(true);
        else if (currentView === 'ecohub-sync' && typeof navigate === 'function') navigate('ecohub-sync', { silent: true });
        if (typeof bmqPeindre === 'function') bmqPeindre();
      });
    }
    return '<section class="dbx-carte ehm-carte"><div class="loader">Lecture de l’état EcoHub…</div></section>';
  }
  const d = E.derniere;
  const etatFlux = E.compagniesOuvertes
    ? `<span class="ehm-pastille ok">${E.compagniesOuvertes} compagnie${E.compagniesOuvertes > 1 ? 's' : ''} ouverte${E.compagniesOuvertes > 1 ? 's' : ''}</span>`
    : `<span class="ehm-pastille attente">flux pas encore ouvert</span>`;
  const quand = d ? `${fmtDate(String(d.demarre_le).slice(0, 10))} à ${String(d.demarre_le).slice(11, 16)}` : 'jamais';
  const etatSync = !d ? '<span class="ehm-pastille attente">aucune synchronisation</span>'
    : d.statut === 'ok' ? `<span class="ehm-pastille ok">dernier passage ${quand}</span>`
    : d.statut === 'erreur' ? `<span class="ehm-pastille alerte">échec le ${quand}</span>`
    : `<span class="ehm-pastille attente">en attente d’activation · ${quand}</span>`;

  return `<section class="dbx-carte ehm-carte">
    <header class="dbx-carte-tete">
      <div><h2 class="ehx-titre">${ehmLogo({ h: 20 })}</h2><span class="dbx-carte-sous">échange normalisé avec les compagnies</span></div>
      <button type="button" class="dbx-lien" onclick="navigate('ecohub-sync')">Ouvrir →</button>
    </header>
    <div class="ehm-corps">
      <div class="ehm-jauge">${htmlManometreEcohub(E.preparation)}</div>
      <div class="ehm-infos">
        <div class="ehm-ligne"><b>${E.contrats}</b> contrat(s) chez les compagnies suivies</div>
        ${E.sansPolice
          ? `<div class="ehm-ligne alerte"><b>${E.sansPolice}</b> sans numéro de police — ils ne pourront pas être rapprochés</div>`
          : '<div class="ehm-ligne">tous portent un numéro de police</div>'}
        <div class="ehm-etats">${etatFlux}${etatSync}</div>
        <button type="button" class="btn-secondary ehm-btn ehx-btn" onclick="ehsSynchroniserMaintenant()">${ehmLogo({ icone: true, alt: '' })} Synchroniser maintenant</button>
      </div>
    </div>
  </section>`;
}

// ── Pastilles du bandeau (20.09.2026) ───────────────────────────────────────────────────────────
// Demande de Jonathan : voir l'état EcoHub et les derniers documents reçus sans quitter le
// tableau de bord. Deux pastilles, à côté de la météo, dans le même registre : un pictogramme, un
// chiffre, et le détail au survol. Elles ne remplacent pas le manomètre — elles y mènent.
//
// Le nom des clients concernés est dans l'infobulle et non à l'écran : il n'a pas à s'afficher en
// permanence sur un poste qu'on peut consulter par-dessus l'épaule.
function ehmPastillesBandeau() {
  const E = window._ehm.etat;
  // Les pastilles vivent dans le bandeau, qui s'affiche sur tous les onglets du tableau de bord —
  // alors que le manomètre n'est que dans « Pilotage ». Elles doivent donc pouvoir déclencher le
  // chargement elles-mêmes, sinon elles restent vides pour qui ne va jamais dans Pilotage.
  if (!E) {
    if (!window._ehm.chargement) {
      window._ehm.chargement = true;
      ehmCharger().then(() => { window._ehm.chargement = false; if (typeof bmqPeindre === 'function') bmqPeindre(); });
    }
    return '';
  }
  const p = E.preparation;
  const ton = p == null ? 'attente' : p >= 90 ? 'ok' : p >= 65 ? 'moyen' : 'faible';

  const recents = (E.nouveaux.length ? E.nouveaux : []).slice(0, 6);
  const noms = [...new Set(recents.map(d => {
    const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === d.client_id);
    return c ? ((c.prenom ? c.prenom + ' ' : '') + c.nom).trim() : 'à rattacher';
  }))];

  return `
    <button type="button" class="bmq-pastille ${ton}" onclick="navigate('ecohub-sync')"
      title="EcoHub · ${E.contrats} contrat(s) chez les compagnies suivies, ${E.sansPolice} sans numéro de police&#10;Cliquer pour ouvrir le manomètre">
      <span class="bmq-pastille-icone" aria-hidden="true">${ehmLogo({ icone: true, blanc: true, alt: '', h: 15 })}</span>
      <span class="bmq-pastille-valeur">${p == null ? '—' : p + ' %'}</span>
    </button>
    ${E.nouveaux.length ? `<button type="button" class="bmq-pastille nouveau" onclick="navigate('documents-compagnies')"
      title="${E.nouveaux.length} document(s) reçu(s) depuis ta dernière visite :&#10;${noms.map(n => '· ' + n).join('&#10;')}${E.nouveaux.length > 6 ? '&#10;…' : ''}&#10;Cliquer pour les ouvrir">
      <span class="bmq-pastille-icone" aria-hidden="true">${ehmLogo({ icone: true, blanc: true, alt: '', h: 15 })}📥</span>
      <span class="bmq-pastille-valeur">${E.nouveaux.length}</span>
    </button>` : ''}`;
}

// ── Le bandeau « nouveaux documents » ───────────────────────────────────────────────────────────
// Il ne s'affiche que s'il y a vraiment du nouveau depuis la dernière fois qu'on a regardé, et il
// se referme en un clic : un bandeau permanent finit par ne plus être lu.
function ehmBandeauNouveaux() {
  const E = window._ehm.etat;
  if (!E || !E.nouveaux.length) return '';
  const n = E.nouveaux.length;
  const clients = [...new Set(E.nouveaux.map(d => {
    const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === d.client_id);
    return c ? ((c.prenom ? c.prenom + ' ' : '') + c.nom).trim() : null;
  }).filter(Boolean))];
  const orphelins = E.nouveaux.filter(d => !d.client_id).length;
  return `<div class="ehm-bandeau">
    <span class="ehm-bandeau-icone" aria-hidden="true">${ehmLogo({ icone: true, alt: '', h: 26 })}</span>
    <div class="ehm-bandeau-texte">
      <strong>${n} nouveau${n > 1 ? 'x' : ''} document${n > 1 ? 's' : ''} reçu${n > 1 ? 's' : ''} d’${ehmLogo({ h: 13, classe: 'ehx-logo-texte' })}</strong>
      <span>${clients.length ? clients.slice(0, 4).map(ehmEsc).join(' · ') + (clients.length > 4 ? ` et ${clients.length - 4} autre(s)` : '') : ''}${orphelins ? `${clients.length ? ' · ' : ''}${orphelins} à rattacher` : ''}</span>
    </div>
    <button type="button" class="btn-save" onclick="navigate('documents-compagnies')">Voir</button>
    <button type="button" class="ehm-bandeau-fermer" onclick="ehmMarquerVu()" title="J’ai vu" aria-label="J’ai vu">×</button>
  </div>`;
}
