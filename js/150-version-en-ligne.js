// ═══ QUELLE VERSION TOURNE, ET EST-CE LA DERNIÈRE ? (23.09.2026) ════════════════════════════════
// « En dessous du menu, sous Assurex, tu vas noter la version des commits, comme ça plus de chichi. »
//
// Trois fois de suite, une fonction livrée et déployée n'apparaissait pas : le navigateur servait
// l'ancien index.html. Les fichiers sont pourtant versionnés (`?v=`), mais ce versionnage ne sert à
// rien quand c'est index.html LUI-MÊME qui est périmé — c'est lui qui porte les numéros. Ni le CRM
// ni l'utilisateur n'avaient moyen de savoir qu'ils tournaient sur une vieille copie : on cherchait
// un bouton qui existait, mais pas là.
//
// Sous le logo Assurex, une ligne dit donc ce qui tourne : « v152 · 23.09 16:40 ». Le numéro est le
// rang du commit (version.js, réécrit à chaque commit) — il ne recule jamais, et se compare d'un
// coup d'œil avec ce que j'annonce.
//
// Et le CRM vérifie tout seul : il relit l'index.html publié et compare l'EMPREINTE, c'est-à-dire
// la liste des fichiers avec leur `?v=`. Rien à maintenir : si un seul fichier a bougé, l'empreinte
// change. Si la copie locale est en retard, la ligne passe en orange et devient un bouton. Elle ne
// recharge jamais d'elle-même — un formulaire à moitié rempli se perdrait — mais le bouton fait le
// vrai ménage : service worker désenregistré, caches vidés, puis rechargement. Un simple F5 ne
// suffisait pas, le service worker resservait sa copie.

const VER_DELAI = 10 * 60 * 1000;
let _verDernier = 0, _verEnRetard = false;

function verEtiquette() {
  const v = typeof CRM_VERSION !== 'undefined' ? CRM_VERSION : null;
  if (!v) return 'version inconnue';
  return `v${v.n}${v.date ? ' · ' + v.date : ''}`;
}

function verPoser() {
  const zone = document.querySelector('.sidebar-team');
  if (!zone || document.getElementById('crm-version')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'crm-version';
  b.className = 'crm-version';
  b.textContent = verEtiquette();
  b.title = 'Version installée — cliquer pour forcer la mise à jour';
  b.onclick = () => verRecharger(b);
  zone.appendChild(b);
}

function verEmpreinteDom() {
  return [...document.querySelectorAll('script[src], link[href]')]
    .map(e => e.getAttribute('src') || e.getAttribute('href') || '')
    .filter(u => /^(?:js|css)\/.*\?v=\d+/.test(u)).sort().join('|');
}

function verEmpreinteTexte(html) {
  return (html.match(/(?:src|href)="((?:js|css)\/[^"]*\?v=\d+)"/g) || [])
    .map(s => s.slice(s.indexOf('"') + 1, -1)).sort().join('|');
}

async function verControler() {
  if (_verEnRetard || Date.now() - _verDernier < VER_DELAI) return;
  _verDernier = Date.now();
  try {
    const r = await fetch('index.html?ver=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const distante = verEmpreinteTexte(await r.text());
    if (!distante || distante === verEmpreinteDom()) return;
    _verEnRetard = true;
    const b = document.getElementById('crm-version');
    if (b) {
      b.classList.add('retard');
      b.textContent = '✨ Nouvelle version — recharger';
      b.title = `Tu tournes sur ${verEtiquette()}. Une version plus récente est publiée.`;
    }
  } catch (e) { /* hors ligne : on ne dit rien */ }
}

async function verRecharger(bouton) {
  if (bouton) { bouton.disabled = true; bouton.textContent = 'Mise à jour…'; }
  try {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(x => x.unregister()));
    }
    if (window.caches) {
      const cles = await caches.keys();
      await Promise.all(cles.map(c => caches.delete(c)));
    }
  } catch (e) { /* on recharge quand même */ }
  location.replace(location.pathname + '?maj=' + Date.now());
}

(function verBrancher() {
  const st = document.createElement('style');
  st.textContent = `
    .crm-version { display: block; width: 100%; margin: 8px 0 0; padding: 5px 8px; border: 0; border-radius: 8px;
      background: transparent; color: color-mix(in srgb, currentColor 55%, transparent);
      font-size: 11px; font-weight: 500; letter-spacing: .01em; text-align: center; cursor: pointer;
      opacity: .75; transition: opacity .2s ease, background .2s ease; }
    .crm-version:hover { opacity: 1; background: rgba(255, 255, 255, .07); }
    .crm-version.retard { background: #F59E0B; color: #23180A; font-weight: 600; opacity: 1; }
    .crm-version.retard:hover { background: #FBBF24; }`;
  document.head.appendChild(st);
  const demarrer = () => { verPoser(); setTimeout(verControler, 4000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  // La barre latérale se reconstruit à la connexion : on repose l'étiquette si elle a disparu.
  setInterval(verPoser, 3000);
  setInterval(verControler, VER_DELAI);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verControler(); });
})();
