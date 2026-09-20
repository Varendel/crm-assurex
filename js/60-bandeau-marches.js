// ═══ BANDEAU MARCHÉS ET ACTUALITÉ GÉOPOLITIQUE (20.09.2026) ════════════════════════════════════
// Demande de Jonathan : sous l'en-tête du tableau de bord, un fil d'actualité géopolitique qui
// change, et un défilé des indices et des cryptos.
//
// Les données viennent de la fonction Supabase « marches-actus » : Yahoo Finance pour les indices,
// les devises et les matières premières, CoinGecko pour les cryptos, l'agrégateur Google News pour
// les titres. Ce relais est nécessaire parce que ces sources ne renvoient pas d'en-têtes CORS ;
// il met aussi en cache quelques minutes pour ne pas marteler les serveurs.
//
// Deux précautions de métier :
//   - les cours sont différés et le bandeau le dit, pour qu'aucun chiffre ne soit pris pour une
//     cotation en temps réel devant un client ;
//   - rien de ce bandeau ne constitue un conseil en placement, et il ne sort jamais dans un
//     document remis au client.

const BMQ_FONCTION = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/marches-actus';
const BMQ_RAFRAICHI_MS = 10 * 60 * 1000;   // on redemande les cours toutes les dix minutes
const BMQ_ACTU_MS = 11 * 1000;             // ... et on change de titre toutes les onze secondes

window._bmq = window._bmq || { valeurs: [], actus: [], maj: null, charge: 0, i: 0, timerActu: null, enCours: false, meteo: null };

// ── Météo (20.09.2026) ──────────────────────────────────────────────────────────────────────────
// Open-Meteo : gratuit, sans clé, et surtout il répond avec les en-têtes CORS — donc appel direct
// depuis le navigateur, sans passer par la fonction Supabase comme pour les cours de bourse.
// Coordonnées de la Riviera vaudoise, là où est le portefeuille.
const BMQ_METEO_URL = 'https://api.open-meteo.com/v1/forecast?latitude=46.46&longitude=6.84'
  + '&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min'
  + '&timezone=Europe%2FZurich&forecast_days=1';

// Codes WMO : on regroupe les 28 codes en huit situations lisibles. Distinguer « bruine légère »
// de « bruine modérée » dans un bandeau de CRM n'apporte rien à personne.
function bmqMeteoSituation(code) {
  const c = Number(code);
  if (c === 0) return { e: '☀️', t: 'Grand soleil' };
  if (c <= 2) return { e: '🌤️', t: 'Éclaircies' };
  if (c === 3) return { e: '☁️', t: 'Couvert' };
  if (c === 45 || c === 48) return { e: '🌫️', t: 'Brouillard' };
  if (c >= 51 && c <= 57) return { e: '🌦️', t: 'Bruine' };
  if (c >= 61 && c <= 67) return { e: '🌧️', t: 'Pluie' };
  if (c >= 71 && c <= 77) return { e: '🌨️', t: 'Neige' };
  if (c >= 80 && c <= 82) return { e: '🌧️', t: 'Averses' };
  if (c >= 85 && c <= 86) return { e: '🌨️', t: 'Averses de neige' };
  if (c >= 95) return { e: '⛈️', t: 'Orage' };
  return { e: '🌡️', t: 'Temps variable' };
}

async function bmqChargerMeteo() {
  try {
    const r = await fetch(BMQ_METEO_URL);
    if (!r.ok) return;
    const d = await r.json();
    window._bmq.meteo = {
      temp: Math.round(d.current.temperature_2m),
      code: d.current.weather_code,
      vent: Math.round(d.current.wind_speed_10m),
      min: Math.round(d.daily.temperature_2m_min[0]),
      max: Math.round(d.daily.temperature_2m_max[0]),
    };
  } catch (e) { /* le bandeau vit très bien sans la météo */ }
}

function bmqMeteoHtml() {
  const m = window._bmq.meteo;
  if (!m) return '';
  const s = bmqMeteoSituation(m.code);
  return `<span class="bmq-meteo" title="Riviera vaudoise · ${s.t} · vent ${m.vent} km/h">
    <span class="bmq-meteo-icone" aria-hidden="true">${s.e}</span>
    <span class="bmq-meteo-temp">${m.temp}°</span>
    <span class="bmq-meteo-detail">${s.t}<em>${m.min}° / ${m.max}°</em></span>
  </span>`;
}

function bmqEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function bmqNombre(v, groupe) {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  // Les devises se lisent à quatre décimales, le reste à deux — et les grandes valeurs sans décimale.
  if (groupe === 'devise') return n.toFixed(4);
  if (Math.abs(n) >= 10000) return n.toLocaleString('fr-CH', { maximumFractionDigits: 0 });
  return n.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function bmqVariation(v) {
  const n = Number(v);
  if (!isFinite(n)) return { texte: '—', sens: 'plat' };
  const sens = n > 0.02 ? 'hausse' : n < -0.02 ? 'baisse' : 'plat';
  const fleche = sens === 'hausse' ? '▲' : sens === 'baisse' ? '▼' : '=';
  return { texte: `${fleche} ${Math.abs(n).toFixed(2)} %`, sens };
}

// ── Chargement ──────────────────────────────────────────────────────────────────────────────────
async function bmqCharger(force) {
  const B = window._bmq;
  if (B.enCours) return;
  if (!force && B.maj && Date.now() - B.charge < BMQ_RAFRAICHI_MS) return;
  B.enCours = true;
  // La météo part en parallèle et sans attendre : elle n'a pas la même source ni le même rythme
  // que les cours, et le bandeau ne doit pas rester vide si l'une des deux traîne.
  bmqChargerMeteo().then(() => bmqPeindre());
  try {
    const token = (typeof getValidAccessToken === 'function' ? await getValidAccessToken() : null) || SUPABASE_KEY;
    const r = await fetch(BMQ_FONCTION, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    B.valeurs = Array.isArray(d.valeurs) ? d.valeurs : [];
    B.actus = Array.isArray(d.actus) ? d.actus : [];
    B.maj = d.maj || new Date().toISOString();
    B.charge = Date.now();
    B.i = 0;
  } catch (e) {
    B.erreur = String(e.message || e);
  }
  B.enCours = false;
  bmqPeindre();
}

// ── Rendu ───────────────────────────────────────────────────────────────────────────────────────
// Le bandeau est posé vide par le tableau de bord, puis rempli quand les données arrivent : on
// n'attend jamais le réseau pour afficher la page.
function bmqBandeauHtml() {
  return `<section class="bmq" id="bmq" aria-label="Marchés et actualité">
    <div class="bmq-actu">
      <span id="bmq-meteo-zone">${bmqMeteoHtml()}</span>
      <span id="bmq-pastilles-zone">${typeof ehmPastillesBandeau === 'function' ? ehmPastillesBandeau() : ''}${typeof spoPastilleHtml === 'function' ? spoPastilleHtml() : ''}</span>
      <span class="bmq-etiquette"><span class="bmq-point" aria-hidden="true"></span>Géopolitique</span>
      <button type="button" class="bmq-titre" id="bmq-titre" onclick="bmqOuvrirActu()">Chargement de l’actualité…</button>
      <button type="button" class="bmq-suivant" onclick="bmqActuSuivante(true)" title="Titre suivant" aria-label="Titre suivant">›</button>
    </div>
    <div class="bmq-ruban" id="bmq-ruban">
      <div class="bmq-defile" id="bmq-defile"><span class="bmq-attente">Cours en cours de chargement…</span></div>
    </div>
    <div class="bmq-pied"><span id="bmq-maj">—</span> · cours différés, à titre indicatif</div>
  </section>`;
}

function bmqPeindre() {
  const B = window._bmq;
  const zoneMeteo = document.getElementById('bmq-meteo-zone');
  if (zoneMeteo) zoneMeteo.innerHTML = bmqMeteoHtml();
  // Les pastilles EcoHub suivent leur propre chargement : on les repeint à chaque passage,
  // sinon elles restent vides si l'état arrive après le bandeau.
  const zoneP = document.getElementById('bmq-pastilles-zone');
  if (zoneP) zoneP.innerHTML = (typeof ehmPastillesBandeau === 'function' ? ehmPastillesBandeau() : '')
    + (typeof spoPastilleHtml === 'function' ? spoPastilleHtml() : '');
  const defile = document.getElementById('bmq-defile');
  if (defile) {
    if (B.valeurs.length) {
      // On duplique la série : le défilé se boucle alors sans saut visible.
      const serie = B.valeurs.map(bmqPastille).join('');
      defile.innerHTML = serie + serie;
      defile.classList.add('anime');
    } else {
      defile.innerHTML = `<span class="bmq-attente">${B.erreur ? 'Cours indisponibles pour l’instant.' : 'Cours en cours de chargement…'}</span>`;
      defile.classList.remove('anime');
    }
  }
  const maj = document.getElementById('bmq-maj');
  if (maj) maj.textContent = B.maj ? 'Mis à jour à ' + new Date(B.maj).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : '—';
  bmqAfficherActu();
}

function bmqPastille(v) {
  const g = v.groupe || '';
  const va = bmqVariation(v.variation);
  const icone = g === 'crypto' ? '₿' : g === 'devise' ? '⇄' : g === 'matiere' ? '⛏' : '📈';
  return `<span class="bmq-valeur ${g}" title="${bmqEsc(v.nom)}${v.devise ? ' · ' + bmqEsc(v.devise) : ''}">
    <span class="bmq-ico" aria-hidden="true">${icone}</span>
    <span class="bmq-nom">${bmqEsc(v.nom)}</span>
    <span class="bmq-prix">${bmqNombre(v.prix, g)}</span>
    <span class="bmq-var ${va.sens}">${va.texte}</span>
  </span>`;
}

function bmqAfficherActu() {
  const B = window._bmq;
  const el = document.getElementById('bmq-titre');
  if (!el) return;
  if (!B.actus.length) { el.textContent = B.erreur ? 'Actualité indisponible pour l’instant.' : 'Chargement de l’actualité…'; return; }
  const a = B.actus[B.i % B.actus.length];
  el.classList.remove('bmq-entre'); void el.offsetWidth; el.classList.add('bmq-entre');
  el.innerHTML = `<span class="bmq-actu-texte">${bmqEsc(a.titre)}</span>${a.source ? `<span class="bmq-actu-source">${bmqEsc(a.source)}</span>` : ''}`;
  el.title = a.titre + (a.source ? ' — ' + a.source : '') + '\nCliquer pour ouvrir l’article';
}

function bmqActuSuivante(manuel) {
  const B = window._bmq;
  if (!B.actus.length) return;
  B.i = (B.i + 1) % B.actus.length;
  bmqAfficherActu();
  if (manuel) bmqRelancerRotation();
}

function bmqRelancerRotation() {
  clearInterval(window._bmq.timerActu);
  window._bmq.timerActu = setInterval(() => {
    // Inutile de tourner si le bandeau n'est plus à l'écran (changement de page)
    if (!document.getElementById('bmq-titre')) { clearInterval(window._bmq.timerActu); return; }
    bmqActuSuivante(false);
  }, BMQ_ACTU_MS);
}

// L'article s'ouvre dans un nouvel onglet : on ne quitte jamais le CRM sous les pieds de l'utilisateur.
function bmqOuvrirActu() {
  const B = window._bmq;
  const a = B.actus[B.i % B.actus.length];
  if (a && a.lien) window.open(a.lien, '_blank', 'noopener');
}

// Appelé par le tableau de bord après chaque rendu.
function bmqApresRendu() {
  if (!document.getElementById('bmq')) return;
  bmqPeindre();
  bmqCharger(false);
  bmqRelancerRotation();
}

// ── Version REX CLOUD (20.09.2026) ──────────────────────────────────────────────────────────────
// Demande de Jonathan : le même bandeau côté client, mais discret et que le client peut retirer.
// Il est réduit — l'heure et les cours ne sont pas ce que le client vient chercher — et son choix
// est retenu sur son appareil. La mention « cours différés, à titre indicatif » reste affichée :
// devant un client, aucun chiffre ne doit pouvoir passer pour une cotation en direct, et ce
// bandeau n'est en aucun cas un conseil en placement.
const BMQ_CLE_CLIENT = 'rexcloud-marches';

function bmqClientVisible() {
  try { return localStorage.getItem(BMQ_CLE_CLIENT) !== '0'; } catch (e) { return true; }
}

function bmqClientBasculer(afficher) {
  try { localStorage.setItem(BMQ_CLE_CLIENT, afficher ? '1' : '0'); } catch (e) {}
  const z = document.getElementById('bmq-client');
  if (z) z.outerHTML = bmqBlocClient();
  if (afficher) bmqApresRenduClient();
}

function bmqBlocClient() {
  if (!bmqClientVisible()) {
    return `<div id="bmq-client" class="bmq-client-replie">
      <button type="button" onclick="bmqClientBasculer(true)">📈 Afficher l’heure et les marchés</button>
    </div>`;
  }
  return `<div id="bmq-client" class="bmq-client">
    ${typeof htmlHorlogeLuxe === 'function' ? `<div class="bmq-client-montre">${htmlHorlogeLuxe()}</div>` : ''}
    <div class="bmq-client-marches">${bmqBandeauHtml()}</div>
    <button type="button" class="bmq-client-fermer" onclick="bmqClientBasculer(false)" title="Masquer" aria-label="Masquer l’heure et les marchés">×</button>
  </div>`;
}

function bmqApresRenduClient() {
  if (!document.getElementById('bmq-client')) return;
  if (!bmqClientVisible()) return;
  bmqPeindre();
  bmqCharger(false);
  bmqRelancerRotation();
}
