// ═══ LECTEUR SPOTIFY DU BANDEAU (20.09.2026, demande de Jonathan) ══════════════════════════════
// « Mets à côté de Rex un lecteur Spotify emoji. »
//
// Une pastille 🎧 dans le bandeau, à côté de la météo et des pastilles EcoHub, dans le même
// registre : un pictogramme, un état, le détail au survol. On clique, un petit lecteur s'ouvre
// sous le bandeau.
//
// Deux décisions qui comptent :
//
//   1. Le lecteur vit HORS du bandeau. Le bandeau est repeint à chaque rafraîchissement des cours
//      (toutes les huit minutes) et à chaque changement d'onglet. Un <iframe> repeint est un
//      <iframe> rechargé : la musique s'arrêterait toute seule, sans raison visible. Le lecteur est
//      donc posé une fois pour toutes sur <body> et on ne fait que le montrer ou le cacher — la
//      lecture continue quand le panneau est fermé, comme dans n'importe quel lecteur.
//
//   2. Aucune connexion Spotify n'est demandée par le CRM. On utilise le lecteur intégré public
//      de Spotify : il joue des extraits sans compte, et la totalité si une session Spotify est
//      déjà ouverte dans le navigateur. Le CRM ne voit jamais d'identifiants, ne stocke rien
//      d'autre que le lien choisi, et ce lien reste sur le poste (localStorage).

const SPO_CLE = 'rex-spotify-lien';
const SPO_CLE_OUVERT = 'rex-spotify-ouvert';

// Par défaut, une playlist de travail. Elle se remplace en collant n'importe quel lien Spotify
// dans le champ du lecteur — playlist, album, titre ou artiste.
const SPO_DEFAUT = 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ';

function spoLien() {
  try { return localStorage.getItem(SPO_CLE) || SPO_DEFAUT; } catch (e) { return SPO_DEFAUT; }
}

// Traduit un lien Spotify (ou un URI spotify:…) en adresse du lecteur intégré.
// Renvoie null si ça n'est pas du Spotify : on ne met pas n'importe quelle page dans un iframe.
function spoAdresseLecteur(lien) {
  const t = String(lien || '').trim();
  if (!t) return null;
  const types = 'playlist|album|track|artist|show|episode';
  // spotify:playlist:37i9dQZF1DWZeKCadgRdKQ
  let m = t.match(new RegExp('^spotify:(' + types + '):([A-Za-z0-9]+)$'));
  if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`;
  // https://open.spotify.com/intl-fr/playlist/37i9…?si=…
  m = t.match(new RegExp('^https?://open\\.spotify\\.com/(?:[a-z-]+/)?(' + types + ')/([A-Za-z0-9]+)'));
  if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`;
  return null;
}

function spoEnregistrerLien(lien) {
  const adresse = spoAdresseLecteur(lien);
  const champ = document.getElementById('spo-champ');
  const note = document.getElementById('spo-note');
  if (!adresse) {
    if (note) note.textContent = 'Ce lien n’est pas reconnu. Colle un lien Spotify (playlist, album, titre ou artiste).';
    if (champ) champ.focus();
    return;
  }
  try { localStorage.setItem(SPO_CLE, String(lien).trim()); } catch (e) {}
  const cadre = document.getElementById('spo-cadre');
  if (cadre && cadre.src !== adresse) cadre.src = adresse;
  if (note) note.textContent = 'Playlist changée.';
}

// ── La pastille du bandeau ──────────────────────────────────────────────────────────────────────
function spoPastilleHtml() {
  const ouvert = spoPanneauOuvert();
  return `<button type="button" class="bmq-pastille spo-pastille${ouvert ? ' actif' : ''}" onclick="spoBasculer()"
    title="Musique — lecteur Spotify&#10;Cliquer pour ouvrir ou fermer le lecteur"
    aria-label="Lecteur de musique" aria-expanded="${ouvert}">
    <span class="bmq-pastille-icone" aria-hidden="true">🎧</span>
    <span class="bmq-pastille-valeur">${ouvert ? '▮▮' : '▶'}</span>
  </button>`;
}

function spoPanneauOuvert() {
  const p = document.getElementById('spo-panneau');
  return !!p && !p.classList.contains('ferme');
}

// ── Le panneau, posé une seule fois sur <body> ──────────────────────────────────────────────────
function spoPanneau() {
  let p = document.getElementById('spo-panneau');
  if (p) return p;
  p = document.createElement('section');
  p.id = 'spo-panneau';
  p.className = 'spo-panneau ferme';
  p.setAttribute('aria-label', 'Lecteur de musique');
  const adresse = spoAdresseLecteur(spoLien()) || spoAdresseLecteur(SPO_DEFAUT);
  p.innerHTML = `
    <header class="spo-tete">
      <span class="spo-titre">🎧 Musique</span>
      <button type="button" class="spo-fermer" onclick="spoBasculer(false)" aria-label="Fermer le lecteur">✕</button>
    </header>
    <iframe id="spo-cadre" class="spo-cadre" src="${adresse}" height="152" frameborder="0"
      loading="lazy" title="Lecteur Spotify"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
    <div class="spo-reglage">
      <input type="url" id="spo-champ" class="spo-champ" placeholder="Coller un lien Spotify…"
        value="" onkeydown="if(event.key==='Enter'){event.preventDefault();spoEnregistrerLien(this.value)}"/>
      <button type="button" class="spo-ok" onclick="spoEnregistrerLien(document.getElementById('spo-champ').value)">Changer</button>
    </div>
    <p class="spo-note" id="spo-note">La lecture continue quand le lecteur est fermé.</p>`;
  document.body.appendChild(p);
  return p;
}

function spoBasculer(force) {
  const p = spoPanneau();
  const ouvrir = force === undefined ? p.classList.contains('ferme') : !!force;
  p.classList.toggle('ferme', !ouvrir);
  try { localStorage.setItem(SPO_CLE_OUVERT, ouvrir ? '1' : '0'); } catch (e) {}
  // La pastille doit refléter l'état : on repeint la zone qui la contient.
  const zone = document.getElementById('bmq-pastilles-zone');
  if (zone && typeof bmqPeindre === 'function') bmqPeindre();
}

// Au chargement : si le lecteur était ouvert, on le rouvre — mais on ne le CRÉE pas avant, pour
// ne pas charger un iframe Spotify chez quelqu'un qui ne s'en sert jamais.
(function spoDemarrer() {
  const poser = () => {
    let ouvert = false;
    try { ouvert = localStorage.getItem(SPO_CLE_OUVERT) === '1'; } catch (e) {}
    if (ouvert) spoBasculer(true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
})();
