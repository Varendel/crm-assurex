// ═══ TABLEAU DE BORD : HORLOGE & AGENDA 2 JOURS (19.09.2026) ═══════════════════════════════
// Demande de Jonathan : une horloge façon montre de luxe (cadran vert soleillé, index dorés,
// lunette cannelée, guichet date sous loupe à 3 h — la « Rorëx », couronne comprise) et une vue de l'agenda
// sur deux jours (aujourd'hui + demain) en tête de la colonne de droite du tableau de bord.

function hlEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ── La couronne Rorëx (20.09.2026) ──────────────────────────────────────────────────────────────
// Jonathan a baptisé la montre « Rorëx ». Elle a donc droit à son emblème : une couronne à cinq
// pointes, dans le même or que les index, posée au-dessus du nom à midi.
// Forme volontairement générique — une couronne héraldique à cinq perles, pas la reproduction
// d'un emblème de marque existante. C'est un clin d'œil interne au tableau de bord : il n'a pas
// vocation à sortir sur un support commercial.
//
// Dessinée dans le repère du cadran (200 × 200) : base à y = 52, hauteur 17, largeur 29.
function htmlCouronneRorex(x, y, echelle) {
  const cx = x == null ? 100 : x, cy = y == null ? 52 : y, k = echelle || 1;
  const pointes = [
    { dx: -14, dy: -8.5 },   // pointe gauche
    { dx: -7,  dy: -14.5 },
    { dx: 0,   dy: -17.5 },  // pointe centrale, la plus haute
    { dx: 7,   dy: -14.5 },
    { dx: 14,  dy: -8.5 },
  ];
  const perles = pointes.map(p => `<circle cx="${(cx + p.dx * k).toFixed(2)}" cy="${(cy + p.dy * k).toFixed(2)}" r="${(2.7 * k).toFixed(2)}" fill="url(#hl-or)" stroke="#6B4E14" stroke-width="${(0.45 * k).toFixed(2)}"/>`).join('');
  // Le corps : on relie les pointes par des creux, comme les dents d'une couronne
  const corps = `M ${cx - 14.6 * k} ${cy} L ${cx - 14.6 * k} ${cy - 7.5 * k}
    L ${cx - 10.5 * k} ${cy - 3.5 * k} L ${cx - 7 * k} ${cy - 13.5 * k}
    L ${cx - 3.5 * k} ${cy - 4.5 * k} L ${cx} ${cy - 16.5 * k}
    L ${cx + 3.5 * k} ${cy - 4.5 * k} L ${cx + 7 * k} ${cy - 13.5 * k}
    L ${cx + 10.5 * k} ${cy - 3.5 * k} L ${cx + 14.6 * k} ${cy - 7.5 * k}
    L ${cx + 14.6 * k} ${cy} Z`;
  return `<g class="hl-couronne" aria-hidden="true">
    ${perles}
    <path d="${corps}" fill="url(#hl-or)" stroke="#6B4E14" stroke-width="${(0.5 * k).toFixed(2)}" stroke-linejoin="round"/>
    <rect x="${(cx - 15.4 * k).toFixed(2)}" y="${(cy - 0.6 * k).toFixed(2)}" width="${(30.8 * k).toFixed(2)}" height="${(4 * k).toFixed(2)}" rx="${(1.8 * k).toFixed(2)}" fill="url(#hl-or)" stroke="#6B4E14" stroke-width="${(0.45 * k).toFixed(2)}"/>
    <path d="M ${cx - 12 * k} ${cy + 1.1 * k} L ${cx + 12 * k} ${cy + 1.1 * k}" stroke="#FFF6D8" stroke-width="${(0.8 * k).toFixed(2)}" opacity=".55"/>
  </g>`;
}

function htmlHorlogeLuxe() {
  const R = 100;
  // Lunette cannelée : fines stries dorées tout autour
  const stries = Array.from({ length: 120 }, (_, i) => {
    const a = i * 3 * Math.PI / 180;
    const x1 = R + Math.sin(a) * 92, y1 = R - Math.cos(a) * 92, x2 = R + Math.sin(a) * 99, y2 = R - Math.cos(a) * 99;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${i % 2 ? '#B8903A' : '#F3DC9A'}" stroke-width="1.6"/>`;
  }).join('');
  // Index : bâtons dorés, triangle à midi, rien à 3 h (guichet date), minutes fines
  const index = Array.from({ length: 60 }, (_, i) => {
    const a = i * 6 * Math.PI / 180, s = Math.sin(a), c = Math.cos(a);
    if (i % 5) return `<line x1="${(R + s * 80).toFixed(2)}" y1="${(R - c * 80).toFixed(2)}" x2="${(R + s * 84).toFixed(2)}" y2="${(R - c * 84).toFixed(2)}" stroke="#E9EEF0" stroke-width="0.9" opacity=".8"/>`;
    if (i === 15) return '';
    if (i === 0) return `<polygon points="${R},${R - 82} ${R - 6},${R - 70} ${R + 6},${R - 70}" fill="url(#hl-or)" stroke="#7A5A17" stroke-width=".6"/><circle cx="${R}" cy="${R - 74}" r="1.6" fill="#DFF7E9"/>`;
    const x1 = R + s * 66, y1 = R - c * 66, x2 = R + s * 81, y2 = R - c * 81;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#7A5A17" stroke-width="6.2" stroke-linecap="round"/><line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="url(#hl-or)" stroke-width="4.6" stroke-linecap="round"/><line x1="${(R + s * 69).toFixed(2)}" y1="${(R - c * 69).toFixed(2)}" x2="${(R + s * 78).toFixed(2)}" y2="${(R - c * 78).toFixed(2)}" stroke="#DFF7E9" stroke-width="1.4" stroke-linecap="round"/>`;
  }).join('');
  setTimeout(hlDemarrerHorloge, 0);
  return `<div class="hl-montre" title="Heure de Suisse">
    <svg viewBox="0 0 200 200" role="img" aria-label="Horloge">
      <defs>
        <radialGradient id="hl-cadran" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#2E8B57"/><stop offset=".55" stop-color="#0F5A3A"/><stop offset="1" stop-color="#062E1E"/></radialGradient>
        <linearGradient id="hl-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".45" stop-color="#D4A94A"/><stop offset="1" stop-color="#8C6420"/></linearGradient>
        <linearGradient id="hl-acier" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDFDFD"/><stop offset="1" stop-color="#9AA4AE"/></linearGradient>
        <radialGradient id="hl-verre" cx="35%" cy="25%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="99.5" fill="#6B4E14"/>
      ${stries}
      <circle cx="100" cy="100" r="91" fill="url(#hl-acier)"/>
      <circle cx="100" cy="100" r="88" fill="url(#hl-cadran)"/>
      ${Array.from({ length: 36 }, (_, i) => `<line x1="100" y1="100" x2="${(100 + Math.sin(i * 10 * Math.PI / 180) * 88).toFixed(1)}" y2="${(100 - Math.cos(i * 10 * Math.PI / 180) * 88).toFixed(1)}" stroke="#fff" stroke-opacity=".035" stroke-width="3"/>`).join('')}
      ${index}
      ${htmlCouronneRorex(100, 53, 0.88)}
      <text x="100" y="66" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="11" font-weight="700" letter-spacing="2.2" fill="#F3DC9A">RORËX</text>
      <text x="100" y="74.5" text-anchor="middle" font-family="Georgia, serif" font-size="4.6" letter-spacing="1.4" fill="#E9EEF0" opacity=".9">ASSUREX · SWISS</text>
      <text x="100" y="140" text-anchor="middle" font-family="Georgia, serif" font-size="4.6" letter-spacing="1.4" fill="#E9EEF0" opacity=".85">CHRONOMÈTRE</text>
      <text x="100" y="147" text-anchor="middle" font-family="Georgia, serif" font-size="4.2" letter-spacing="1.4" fill="#E9EEF0" opacity=".75">SWISS MADE</text>
      <rect x="148" y="92" width="22" height="16" rx="2" fill="#FBFAF4" stroke="url(#hl-or)" stroke-width="1.4"/>
      <text id="hl-date" x="159" y="104.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#111">--</text>
      <ellipse cx="159" cy="100" rx="15" ry="12" fill="url(#hl-verre)" stroke="#fff" stroke-opacity=".35" stroke-width=".6"/>
      <g id="hl-h"><path d="M98 104 L98 64 Q100 57 102 64 L102 104 Z" fill="url(#hl-or)" stroke="#6B4E14" stroke-width=".5"/><circle cx="100" cy="66" r="5.2" fill="none" stroke="url(#hl-or)" stroke-width="2.4"/><circle cx="100" cy="66" r="3.4" fill="#DFF7E9"/></g>
      <g id="hl-m"><path d="M98.6 106 L98.6 30 L100 22 L101.4 30 L101.4 106 Z" fill="url(#hl-or)" stroke="#6B4E14" stroke-width=".5"/><line x1="100" y1="36" x2="100" y2="88" stroke="#DFF7E9" stroke-width="1.3"/></g>
      <g id="hl-s"><line x1="100" y1="118" x2="100" y2="20" stroke="#D4A94A" stroke-width="1.2"/><circle cx="100" cy="42" r="3" fill="none" stroke="#D4A94A" stroke-width="1.2"/><circle cx="100" cy="42" r="1.8" fill="#DFF7E9"/></g>
      <circle cx="100" cy="100" r="3.6" fill="url(#hl-or)" stroke="#6B4E14" stroke-width=".5"/>
      <circle cx="100" cy="100" r="88" fill="url(#hl-verre)"/>
    </svg>
    <div class="hl-numerique"><b id="hl-heure">--:--</b><span id="hl-jour"></span></div>
  </div>`;
}

function hlMettreAJour() {
  const h = document.getElementById('hl-h');
  if (!h) { clearInterval(window._hlTimer); window._hlTimer = null; return; }
  const d = new Date();
  const s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, hr = (d.getHours() % 12) + m / 60;
  h.setAttribute('transform', `rotate(${hr * 30} 100 100)`);
  document.getElementById('hl-m').setAttribute('transform', `rotate(${m * 6} 100 100)`);
  document.getElementById('hl-s').setAttribute('transform', `rotate(${s * 6} 100 100)`);
  // 22.09.2026 : ces trois textes étaient réécrits 8 fois par seconde même inchangés. Chaque
  // écriture de textContent remplace le nœud texte et réveille les MutationObserver posés sur
  // #main-content (trois modules) : du travail pour rien, en continu, tant que l'accueil est ouvert.
  // On n'écrit plus que si la valeur a changé (une fois par minute, une fois par jour).
  const ecrire = (id, v) => { const el = document.getElementById(id); v = String(v); if (el && el.textContent !== v) el.textContent = v; };
  ecrire('hl-date', d.getDate());
  ecrire('hl-heure', d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }));
  ecrire('hl-jour', d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' }));
}
function hlDemarrerHorloge() {
  hlMettreAJour();
  clearInterval(window._hlTimer);
  // Trotteuse « balayante » : 8 pas par seconde (réduit à 1/s si l'utilisateur limite les animations)
  const reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window._hlTimer = setInterval(hlMettreAJour, reduit ? 1000 : 125);
}

// ── Agenda sur deux jours ────────────────────────────────────────────────────────────────────
function htmlAgenda2Jours() {
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const auj = new Date(), dem = new Date(); dem.setDate(dem.getDate() + 1);
  const moi = currentUser ? (allAgents || []).find(a => a.email === currentUser.email) : null;
  const rdvs = (typeof allRendezVous !== 'undefined' ? allRendezVous : []).filter(r => r.statut !== 'annule' && r.date_heure);
  const nomClient = r => {
    if (r.client_id) { const c = (allClients || []).find(x => x.id === r.client_id); if (c) return typeof estEntreprise === 'function' && estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim(); }
    return r.prospect_nom || 'Rendez-vous';
  };
  const jour = (d, libelle) => {
    const k = iso(d);
    const liste = rdvs.filter(r => String(r.date_heure).slice(0, 10) === k).sort((a, b) => String(a.date_heure).localeCompare(String(b.date_heure)));
    const maintenant = new Date();
    return `<div class="hl-jour">
      <div class="hl-jour-tete"><b>${libelle}</b><span>${d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      ${liste.length ? liste.map(r => {
        const debut = new Date(r.date_heure), fin = new Date(debut.getTime() + (Number(r.duree_min) || 60) * 60000);
        const enCours = maintenant >= debut && maintenant < fin, passe = maintenant >= fin;
        const agent = r.agent_id && moi && r.agent_id !== moi.id ? (allAgents || []).find(a => a.id === r.agent_id) : null;
        return `<button type="button" class="hl-rdv ${enCours ? 'en-cours' : ''} ${passe ? 'passe' : ''}" onclick="${r.client_id ? `showClient('${r.client_id}')` : `navigate('rendez-vous')`}">
          <span class="hl-rdv-heure">${debut.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}<small>${fin.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</small></span>
          <span class="hl-rdv-corps"><b>${hlEsc(nomClient(r))}</b><small>${hlEsc([r.type, r.lieu, agent ? agent.prenom : ''].filter(Boolean).join(' · ') || 'Rendez-vous')}</small></span>
          ${enCours ? '<span class="hl-rdv-badge">en cours</span>' : ''}
        </button>`;
      }).join('') : '<div class="hl-vide">Aucun rendez-vous</div>'}
    </div>`;
  };
  return `<header class="dbx-carte-tete"><h2>Agenda</h2><button type="button" class="dbx-lien" onclick="navigate('rendez-vous')">Tous les rendez-vous →</button></header>
    <div class="hl-agenda">${jour(auj, 'Aujourd’hui')}${jour(dem, 'Demain')}</div>`;
}
