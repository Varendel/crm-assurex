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

window._bmq = window._bmq || { valeurs: [], actus: [], maj: null, charge: 0, i: 0, timerActu: null, enCours: false };

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
