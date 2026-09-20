// ═══ JOURNAL DES ERREURS — L'ÉCRAN (20.09.2026) ════════════════════════════════════════════════
// « Est-ce qu'il y a un journal des erreurs sur le site ? Si non il faut le déployer. »
//
// Il y en avait un — js/00 collecte depuis le 19.09 et tourne bien en production. Mais la table
// ne portait QU'UNE politique d'insertion : aucune lecture n'était possible, depuis nulle part.
// Quatre-vingt-six erreurs s'étaient accumulées sans que personne ne puisse les voir. Un journal
// qu'on ne peut pas consulter n'est pas un journal, c'est une décharge.
//
// CE QUE CET ÉCRAN FAIT, ET POURQUOI IL REGROUPE.
// Quatre-vingt-six lignes brutes ne se lisent pas : la même image manquante revient treize fois,
// le même appel échoue à chaque ouverture d'écran. On regroupe donc par (source + message) et on
// compte. Ce qui compte n'est pas « combien de lignes » mais « combien de PROBLÈMES distincts »,
// et lequel dure encore.
//
// LA DISTINCTION QUI CHANGE TOUT : PRODUCTION OU LOCAL.
// Une erreur vue sur varendel.github.io touche Jonathan et ses clients. La même sur localhost
// vient d'un essai en cours de développement et ne concerne personne. Les mélanger noierait les
// vraies sous les fausses — l'écran s'ouvre donc sur la production seule.

const JEV_SITE = 'varendel.github.io';

window._jev = window._jev || {
  lignes: [], chargement: false, portee: 'prod', etat: 'ouverts', jours: 7, ouverte: null,
};

function jevEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function jevQuand(iso) {
  const d = new Date(iso);
  const h = Math.floor((Date.now() - d) / 3600000);
  if (h < 1) return 'il y a moins d’une heure';
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} jours`;
}

// Les sources, traduites. « window.error » ne dit rien à personne ; « erreur JavaScript » si.
const JEV_SOURCES = {
  'window.error': { nom: 'Erreur JavaScript', ton: 'grave',
    aide: 'Un script s’est arrêté, ou un fichier n’a pas pu être chargé.' },
  'console.error': { nom: 'Échec technique', ton: 'grave',
    aide: 'Le plus souvent un appel à la base qui n’a pas abouti.' },
  'promesse': { nom: 'Appel interrompu', ton: 'grave',
    aide: 'Une opération asynchrone a échoué sans être rattrapée — réseau, le plus souvent.' },
  'showError': { nom: 'Message à l’écran', ton: 'info',
    aide: 'Ce que le CRM a affiché à l’utilisateur. Souvent normal (un champ manquant), parfois révélateur.' },
  'signalement': { nom: 'Signalé à la main', ton: 'signal',
    aide: 'Quelqu’un a pressé Ctrl+Alt+E pour dire que quelque chose n’allait pas.' },
};
function jevSource(s) { return JEV_SOURCES[s] || { nom: s, ton: 'info', aide: '' }; }

// ── Chargement ──────────────────────────────────────────────────────────────────────────────────
async function jevCharger() {
  window._jev.chargement = true;
  const depuis = new Date(Date.now() - window._jev.jours * 86400000).toISOString();
  try {
    const r = await dbGet('journal_erreurs',
      `select=*&created_at=gte.${depuis}&order=created_at.desc&limit=500`);
    window._jev.lignes = Array.isArray(r) ? r : [];
    window._jev.erreur = null;
  } catch (e) {
    window._jev.lignes = [];
    window._jev.erreur = String(e.message || e);
  }
  window._jev.chargement = false;
}

function jevEnProd(l) { return String(l.url || '').includes(JEV_SITE); }

// Le regroupement. Une clé = un problème ; les occurrences sont conservées pour pouvoir ouvrir
// la plus récente et voir son contexte.
function jevGroupes() {
  const F = window._jev;
  const retenues = F.lignes.filter(l => {
    if (F.portee === 'prod' && !jevEnProd(l)) return false;
    if (F.portee === 'local' && jevEnProd(l)) return false;
    if (F.etat === 'ouverts' && l.resolu_le) return false;
    if (F.etat === 'resolus' && !l.resolu_le) return false;
    return true;
  });

  const map = new Map();
  for (const l of retenues) {
    const cle = `${l.source}|${(l.message || '').slice(0, 160)}`;
    if (!map.has(cle)) map.set(cle, { cle, source: l.source, message: l.message || '', occurrences: [] });
    map.get(cle).occurrences.push(l);
  }
  return [...map.values()].map(g => {
    g.occurrences.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    g.derniere = g.occurrences[0];
    g.n = g.occurrences.length;
    g.sessions = new Set(g.occurrences.map(o => o.session_id)).size;
    g.resolu = g.occurrences.every(o => o.resolu_le);
    return g;
  }).sort((a, b) => {
    // Le plus récent d'abord, pas le plus fréquent : une erreur qui vient d'apparaître mérite
    // l'attention avant une vieille qui revient depuis trois jours et qu'on a déjà vue.
    return String(b.derniere.created_at).localeCompare(String(a.derniere.created_at));
  });
}

// ── L'écran ─────────────────────────────────────────────────────────────────────────────────────
function viewJournalErreurs() {
  setTimeout(async () => { await jevCharger(); jevPeindre(); }, 0);
  return `
    <section class="fcx-hero jev-hero">
      <div class="fcx-hero-deco" aria-hidden="true"></div>
      <div>
        <span class="cf-surtitre">Santé de l’application</span>
        <h1>Journal des erreurs</h1>
        <p>Tout ce qui part en erreur dans le navigateur est enregistré ici, avec les derniers
          clics qui y ont mené. Les occurrences identiques sont regroupées : on compte les
          problèmes, pas les lignes.</p>
      </div>
      <div class="cf-hero-actions">
        <button type="button" class="fcx-btn-blanc" onclick="jevRafraichir()">↻ Actualiser</button>
      </div>
    </section>
    <div id="jev-corps"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>`;
}

async function jevRafraichir() {
  const z = document.getElementById('jev-corps');
  if (z) z.innerHTML = '<div class="dbx-chargement"><span></span><span></span><span></span></div>';
  await jevCharger();
  jevPeindre();
}

function jevFiltrer(champ, valeur) {
  window._jev[champ] = champ === 'jours' ? Number(valeur) : valeur;
  if (champ === 'jours') { jevRafraichir(); return; }
  jevPeindre();
}

function jevPeindre() {
  const z = document.getElementById('jev-corps');
  if (!z) return;
  const F = window._jev;

  if (F.erreur) {
    z.innerHTML = `<section class="dbx-carte jev-carte"><div class="jev-vide">
      <b>Le journal n’a pas pu être lu.</b>
      <p>${jevEsc(F.erreur)}</p></div></section>`;
    return;
  }

  const groupes = jevGroupes();
  const prod = F.lignes.filter(jevEnProd);
  const ouverts = F.lignes.filter(l => !l.resolu_le && jevEnProd(l));
  const graves = groupes.filter(g => jevSource(g.source).ton === 'grave');
  const signalements = groupes.filter(g => g.source === 'signalement');

  const seg = (champ, valeurs) => `<div class="jev-segments">${valeurs.map(([v, nom]) =>
    `<button type="button" class="${F[champ] === v ? 'actif' : ''}" onclick="jevFiltrer('${champ}','${v}')">${nom}</button>`).join('')}</div>`;

  z.innerHTML = `
    <section class="dbx-carte jev-carte">
      <header class="dbx-carte-tete">
        <div><h2>${groupes.length} problème${groupes.length > 1 ? 's' : ''} distinct${groupes.length > 1 ? 's' : ''}</h2>
          <span class="dbx-carte-sous">${F.lignes.length} entrée${F.lignes.length > 1 ? 's' : ''} sur ${F.jours} jours ·
            ${prod.length} en production · ${ouverts.length} non traitée${ouverts.length > 1 ? 's' : ''}</span></div>
        <span class="jev-sante ${graves.length ? (graves.length > 3 ? 'faible' : 'moyen') : 'ok'}">
          ${graves.length ? `${graves.length} technique${graves.length > 1 ? 's' : ''}` : '✓ rien de technique'}
        </span>
      </header>
      ${signalements.length ? `<div class="jev-signal">
        <b>🖐️ ${signalements.length} signalement${signalements.length > 1 ? 's' : ''} manuel${signalements.length > 1 ? 's' : ''}</b>
        <small>Quelqu’un a décrit un problème que la technique ne voit pas — à lire en premier.</small>
      </div>` : ''}
      <div class="jev-outils">
        <div><label class="jev-label">Où</label>${seg('portee', [['prod', 'En ligne'], ['local', 'Développement'], ['tout', 'Les deux']])}</div>
        <div><label class="jev-label">État</label>${seg('etat', [['ouverts', 'À traiter'], ['resolus', 'Traités'], ['tout', 'Tout']])}</div>
        <div><label class="jev-label">Période</label>
          <select class="form-select" onchange="jevFiltrer('jours', this.value)">
            ${[[1, '24 heures'], [7, '7 jours'], [30, '30 jours'], [90, '90 jours']].map(([v, n]) =>
              `<option value="${v}" ${F.jours === v ? 'selected' : ''}>${n}</option>`).join('')}
          </select></div>
      </div>
    </section>

    ${groupes.length ? `<div class="jev-liste">${groupes.map(jevGroupeHtml).join('')}</div>`
      : `<section class="dbx-carte jev-carte"><div class="jev-vide jev-ok">
          <b>✓ Rien à signaler</b>
          <p>Aucune erreur ${F.portee === 'prod' ? 'en production ' : ''}sur cette période.</p>
        </div></section>`}`;
}

function jevGroupeHtml(g) {
  const s = jevSource(g.source);
  const ouverte = window._jev.ouverte === g.cle;
  const d = g.derniere;
  return `<article class="jev-groupe ton-${s.ton} ${g.resolu ? 'resolu' : ''}">
    <button type="button" class="jev-entete" onclick="jevOuvrir('${jevEsc(g.cle).replace(/'/g, '&#39;')}')"
      aria-expanded="${ouverte}">
      <span class="jev-badge">${jevEsc(s.nom)}</span>
      <span class="jev-message">${jevEsc(g.message).slice(0, 200)}</span>
      <span class="jev-compte" title="${g.n} occurrence${g.n > 1 ? 's' : ''} sur ${g.sessions} session${g.sessions > 1 ? 's' : ''}">
        ${g.n}×</span>
      <span class="jev-quand">${jevQuand(d.created_at)}</span>
      <span class="jev-chevron" aria-hidden="true"></span>
    </button>
    ${ouverte ? jevDetailHtml(g) : ''}
  </article>`;
}

function jevDetailHtml(g) {
  const d = g.derniere;
  const s = jevSource(g.source);
  const fil = Array.isArray(d.breadcrumbs) ? d.breadcrumbs.slice(-8).reverse() : [];
  const ctx = d.contexte || null;

  return `<div class="jev-detail">
    <p class="jev-aide">${jevEsc(s.aide)}</p>

    <dl class="jev-faits">
      <div><dt>Dernière fois</dt><dd>${fmtDate(String(d.created_at).slice(0, 10))} à ${String(d.created_at).slice(11, 16)}</dd></div>
      <div><dt>Occurrences</dt><dd>${g.n} sur ${g.sessions} session${g.sessions > 1 ? 's' : ''}</dd></div>
      ${d.user_email ? `<div><dt>Utilisateur</dt><dd>${jevEsc(d.user_email)}</dd></div>` : ''}
      ${d.url ? `<div><dt>Écran</dt><dd class="jev-url">${jevEsc(d.url)}</dd></div>` : ''}
      ${ctx && ctx.fichier ? `<div><dt>Fichier</dt><dd class="jev-url">${jevEsc(String(ctx.fichier).split('/').pop())}${ctx.ligne ? ` — ligne ${ctx.ligne}` : ''}</dd></div>` : ''}
    </dl>

    ${fil.length ? `<div class="jev-fil">
      <h4>Les derniers clics avant l’erreur</h4>
      <ol>${fil.map(c => `<li><span class="jev-h">${jevEsc(c.t || '')}</span>
        ${jevEsc(c.texte || c.ident || c.el || '…')}</li>`).join('')}</ol>
      <p class="jev-aide">Seul le texte des boutons est enregistré, jamais ce qui a été saisi.</p>
    </div>` : ''}

    ${d.stack ? `<details class="jev-pile"><summary>Trace technique</summary>
      <pre>${jevEsc(d.stack).slice(0, 2000)}</pre></details>` : ''}

    <div class="jev-actions">
      ${g.resolu
        ? `<span class="jev-traite">✓ Traité${d.resolu_par ? ' par ' + jevEsc(d.resolu_par) : ''}</span>
           <button type="button" class="jev-act" onclick="jevMarquer('${jevEsc(g.cle).replace(/'/g, '&#39;')}', false)">Rouvrir</button>`
        : `<button type="button" class="jev-act jev-act-ok" onclick="jevMarquer('${jevEsc(g.cle).replace(/'/g, '&#39;')}', true)">
             ✓ Marquer traité (${g.n})</button>`}
      <button type="button" class="jev-act" onclick="jevCopier('${jevEsc(g.cle).replace(/'/g, '&#39;')}')">📋 Copier pour Claude</button>
    </div>
  </div>`;
}

function jevOuvrir(cle) {
  const c = String(cle).replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  window._jev.ouverte = window._jev.ouverte === c ? null : c;
  jevPeindre();
}

function jevGroupeParCle(cle) {
  const c = String(cle).replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return jevGroupes().find(g => g.cle === c);
}

// Marquer traité vaut pour TOUTES les occurrences du groupe : c'est le problème qu'on traite, pas
// la ligne. Le nombre est affiché sur le bouton pour qu'on sache ce qu'on marque.
async function jevMarquer(cle, traite) {
  const g = jevGroupeParCle(cle);
  if (!g) return;
  const qui = (typeof currentUser !== 'undefined' && currentUser)
    ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : null;
  const maj = traite ? { resolu_le: new Date().toISOString(), resolu_par: qui } : { resolu_le: null, resolu_par: null };

  let echecs = 0;
  for (const o of g.occurrences) {
    if (traite === !!o.resolu_le) continue;
    const r = await dbPatch('journal_erreurs', o.id, maj);
    if (r && r.error) { echecs++; continue; }
    Object.assign(o, maj);
  }
  if (echecs) showError(`${echecs} ligne(s) n’ont pas pu être mises à jour.`);
  else showError(traite ? `✓ ${g.n} occurrence${g.n > 1 ? 's' : ''} marquée${g.n > 1 ? 's' : ''} traitée${g.n > 1 ? 's' : ''}` : '✓ Rouvert');
  jevPeindre();
}

// Le texte prêt à coller dans une conversation avec Claude : le message, le contexte, le fil des
// clics. C'est exactement ce qu'il faut pour diagnostiquer sans capture d'écran.
function jevCopier(cle) {
  const g = jevGroupeParCle(cle);
  if (!g) return;
  const d = g.derniere;
  const ctx = d.contexte || {};
  const fil = Array.isArray(d.breadcrumbs) ? d.breadcrumbs.slice(-8) : [];
  const t = [
    `[${jevSource(g.source).nom}] ${g.message}`,
    `${g.n} occurrence(s) sur ${g.sessions} session(s), dernière le ${fmtDate(String(d.created_at).slice(0, 10))} à ${String(d.created_at).slice(11, 16)}`,
    d.url ? `Écran : ${d.url}` : '',
    ctx.fichier ? `Fichier : ${String(ctx.fichier).split('/').pop()}${ctx.ligne ? ` ligne ${ctx.ligne}` : ''}` : '',
    fil.length ? `Derniers clics : ${fil.map(c => c.texte || c.ident || c.el).filter(Boolean).join(' → ')}` : '',
    d.stack ? `\nTrace :\n${String(d.stack).slice(0, 1200)}` : '',
  ].filter(Boolean).join('\n');

  const fini = ok => showError(ok ? '✓ Copié — colle-le dans la conversation' : 'Copie impossible — sélectionne le texte à la main.');
  navigator.clipboard.writeText(t).then(() => fini(true)).catch(() => {
    try {
      const z = document.createElement('textarea');
      z.value = t; z.style.cssText = 'position:fixed;top:-9999px';
      document.body.appendChild(z); z.select();
      fini(document.execCommand('copy'));
      z.remove();
    } catch (e) { fini(false); }
  });
}

(function jevBrancher() {
  if (typeof NAV_SYNONYMES !== 'undefined') {
    NAV_SYNONYMES['journal-erreurs'] = 'journal erreur bug panne probleme incident log diagnostic sante technique';
  }
})();
