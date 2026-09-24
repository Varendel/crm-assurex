// ═══ LIBRE DISPOSITION DES PAGES (24.09.2026) ═══════════════════════════════════════════════════
// « Widgets et personnalisation des pages. »
//
// Le tableau de bord montre à tout le monde les mêmes cartes, dans le même ordre. Or ce qui compte
// n'est pas le même pour tous ni tous les jours : Jonathan regarde d'abord ses tâches et son
// agenda, quelqu'un d'autre le pipeline, et personne n'a besoin de l'horloge en permanence.
//
// Parti pris : ce module ne réécrit AUCUNE vue. Il lit les cartes déjà produites par js/18 & co,
// leur donne une clé stable, puis applique la disposition personnelle de l'agent — masquer,
// réordonner. Une carte ajoutée demain dans js/18 apparaît donc ici toute seule, sans rien
// déclarer. C'est le même principe que les couleurs d'état (js/159).
//
// La disposition vit dans agents.preferences_pages (jsonb), donc côté serveur : elle suit l'agent
// d'un poste à l'autre, et elle survit à un vidage de cache. Rien en local.
//   { "<vue>": { "caches": ["horloge", …], "ordre": ["a-faire", "agenda", …] } }

const WGT_SELECTEUR = '.dbx-carte';
// Certaines cartes portent une classe parlante : on s'en sert comme clé, plus stable qu'un titre
// qui peut être reformulé.
const WGT_CLES_PAR_CLASSE = {
  'dbx-demandes': 'demandes-clients',
  'dbx-horloge': 'horloge',
  'dbx-agenda-semaine': 'agenda-semaine',
};

// Sur window, comme _dx (js/26), _pje (js/136) et _aem (js/139) : l'état reste inspectable depuis
// la console quand une disposition se comporte mal, et testable hors navigateur.
window._wgt = window._wgt || { prefs: null, agentId: null, chargement: null, brouillon: null };
const _wgt = window._wgt;

function wgtNormaliser(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Clé d'une carte : classe connue, sinon son titre, sinon son libellé d'accessibilité.
function wgtCle(section) {
  for (const c of section.classList) if (WGT_CLES_PAR_CLASSE[c]) return WGT_CLES_PAR_CLASSE[c];
  const titre = section.querySelector('.dbx-carte-tete h2')?.textContent
    || section.getAttribute('aria-label')
    || section.querySelector('h2, h3')?.textContent || '';
  return wgtNormaliser(titre) || null;
}

function wgtTitre(section) {
  const t = section.querySelector('.dbx-carte-tete h2')?.textContent
    || section.getAttribute('aria-label')
    || section.querySelector('h2, h3')?.textContent || '';
  return t.trim() || 'Carte sans titre';
}

function wgtVue() { return (typeof currentView !== 'undefined' && currentView) || 'dashboard'; }

async function wgtCharger() {
  if (_wgt.prefs) return _wgt.prefs;
  if (_wgt.chargement) return _wgt.chargement;
  _wgt.chargement = (async () => {
    const email = (typeof currentUser !== 'undefined' && currentUser && currentUser.email) || '';
    if (!email) { _wgt.prefs = {}; return _wgt.prefs; }
    try {
      const r = await dbGet('agents', `email=eq.${encodeURIComponent(email)}&select=id,preferences_pages`);
      const a = Array.isArray(r) && r[0] ? r[0] : null;
      _wgt.agentId = a ? a.id : null;
      _wgt.prefs = (a && a.preferences_pages) || {};
    } catch (e) {
      // Pas de disposition lisible : on affiche la page d'origine plutôt que de la casser.
      console.error('Disposition des pages — lecture impossible :', e);
      _wgt.prefs = {};
    }
    return _wgt.prefs;
  })();
  return _wgt.chargement;
}

async function wgtEnregistrer() {
  if (!_wgt.agentId) { showError('Disposition non enregistrée : fiche agent introuvable pour ton adresse.'); return false; }
  const r = await dbPatch('agents', _wgt.agentId, { preferences_pages: _wgt.prefs });
  if (r && r.error) { showError('Disposition non enregistrée : ' + errMsg(r)); return false; }
  return true;
}

function wgtPrefsVue(vue) {
  const p = _wgt.prefs || {};
  const v = p[vue] || {};
  return { caches: Array.isArray(v.caches) ? v.caches : [], ordre: Array.isArray(v.ordre) ? v.ordre : [] };
}

// Applique la disposition aux cartes présentes. Appelée après chaque rendu.
function wgtAppliquer() {
  const main = document.getElementById('main-content');
  if (!main || !_wgt.prefs) return;
  const vue = wgtVue();
  const { caches, ordre } = wgtPrefsVue(vue);
  const cartes = [...main.querySelectorAll(WGT_SELECTEUR)];
  if (!cartes.length) return;

  cartes.forEach(section => {
    const cle = wgtCle(section);
    if (!cle) return;
    section.dataset.wgt = cle;
    const masquee = caches.includes(cle);
    section.style.display = masquee ? 'none' : '';
    // `order` n'agit que sur un enfant de flex/grid — c'est le cas de .dbx-trio et .dbx-col.
    // Les cartes non classées gardent leur rang d'origine, derrière celles qu'on a ordonnées.
    const rang = ordre.indexOf(cle);
    section.style.order = rang === -1 ? '' : String(rang);
  });
  wgtBoutonReglage();
}

// Bouton d'accès, posé une fois par rendu à côté des onglets du tableau de bord.
function wgtBoutonReglage() {
  const main = document.getElementById('main-content');
  if (!main || document.getElementById('wgt-bouton')) return;
  if (!main.querySelector(WGT_SELECTEUR)) return;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.id = 'wgt-bouton';
  bouton.className = 'wgt-bouton';
  bouton.textContent = '⚙️ Disposition';
  bouton.title = 'Choisir les cartes affichées et leur ordre';
  bouton.onclick = wgtOuvrirPanneau;
  const onglets = main.querySelector('.dbx-onglets');
  if (onglets) onglets.appendChild(bouton);
  else main.insertBefore(bouton, main.firstChild);
}

// Panneau de réglage : cases à cocher + flèches. Pas de glisser-déposer — deux flèches marchent
// à la souris, au doigt et au clavier, là où un glisser-déposer échoue sur au moins un des trois.
function wgtOuvrirPanneau() {
  const main = document.getElementById('main-content');
  const vue = wgtVue();
  const { caches } = wgtPrefsVue(vue);
  // On repart de l'ordre AFFICHÉ : ce que Jonathan voit est ce qu'il réordonne.
  const cartes = [...main.querySelectorAll(WGT_SELECTEUR)]
    .map(s => ({ cle: wgtCle(s), titre: wgtTitre(s), section: s }))
    .filter(x => x.cle);
  const vues = [];
  const dejaVu = new Set();
  cartes.forEach(c => { if (!dejaVu.has(c.cle)) { dejaVu.add(c.cle); vues.push(c); } });
  const ordreCourant = wgtPrefsVue(vue).ordre.filter(c => dejaVu.has(c));
  vues.sort((a, b) => {
    const ia = ordreCourant.indexOf(a.cle), ib = ordreCourant.indexOf(b.cle);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  _wgt.brouillon = vues.map(v => ({ cle: v.cle, titre: v.titre, visible: !caches.includes(v.cle) }));

  creerModale('modal-wgt', `
    <div class="wgt-panneau">
      <h3>⚙️ Disposition de la page</h3>
      <p>Décoche ce que tu ne veux pas voir, et remonte ce qui compte le plus. Ta disposition te suit d'un poste à l'autre.</p>
      <div id="wgt-liste"></div>
      <div class="wgt-actions">
        <button type="button" class="btn-secondary" onclick="wgtReinitialiser()">↺ Disposition d'origine</button>
        <span style="flex:1"></span>
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-wgt').remove()">Annuler</button>
        <button type="button" class="btn-save" onclick="wgtValider()">✓ Appliquer</button>
      </div>
    </div>`, { padding: '16px' });
  wgtRendreListe();
}

function wgtRendreListe() {
  const zone = document.getElementById('wgt-liste');
  if (!zone) return;
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  zone.innerHTML = _wgt.brouillon.map((w, i) => `
    <div class="wgt-ligne${w.visible ? '' : ' wgt-masquee'}">
      <label>
        <input type="checkbox" ${w.visible ? 'checked' : ''} onchange="wgtBasculer(${i})"/>
        <span>${esc(w.titre)}</span>
      </label>
      <button type="button" title="Monter" aria-label="Monter ${esc(w.titre)}" ${i === 0 ? 'disabled' : ''} onclick="wgtDeplacer(${i},-1)">▲</button>
      <button type="button" title="Descendre" aria-label="Descendre ${esc(w.titre)}" ${i === _wgt.brouillon.length - 1 ? 'disabled' : ''} onclick="wgtDeplacer(${i},1)">▼</button>
    </div>`).join('');
}

function wgtBasculer(i) { _wgt.brouillon[i].visible = !_wgt.brouillon[i].visible; wgtRendreListe(); }

function wgtDeplacer(i, sens) {
  const j = i + sens;
  if (j < 0 || j >= _wgt.brouillon.length) return;
  const t = _wgt.brouillon[i]; _wgt.brouillon[i] = _wgt.brouillon[j]; _wgt.brouillon[j] = t;
  wgtRendreListe();
}

async function wgtValider() {
  const vue = wgtVue();
  _wgt.prefs = _wgt.prefs || {};
  _wgt.prefs[vue] = {
    caches: _wgt.brouillon.filter(w => !w.visible).map(w => w.cle),
    ordre: _wgt.brouillon.map(w => w.cle),
  };
  wgtAppliquer();
  document.getElementById('modal-wgt')?.remove();
  if (await wgtEnregistrer()) showError('✓ Disposition enregistrée.');
}

async function wgtReinitialiser() {
  const vue = wgtVue();
  if (_wgt.prefs) delete _wgt.prefs[vue];
  const main = document.getElementById('main-content');
  main?.querySelectorAll(WGT_SELECTEUR).forEach(s => { s.style.display = ''; s.style.order = ''; });
  document.getElementById('modal-wgt')?.remove();
  if (await wgtEnregistrer()) showError('✓ Disposition d’origine rétablie.');
}

(function wgtBrancher() {
  const st = document.createElement('style');
  st.textContent = `
    .wgt-bouton { margin-left: auto; background: var(--surface); border: 1px solid var(--border);
      color: var(--text-muted); border-radius: 9px; padding: 6px 13px; font-size: 12.5px;
      font-weight: 600; cursor: pointer; }
    .wgt-bouton:hover { color: var(--text); border-color: var(--accent-border); }
    .wgt-panneau { background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      padding: 22px; width: 100%; max-width: 520px; max-height: 85vh; display: flex; flex-direction: column; }
    .wgt-panneau h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; color: var(--text); }
    .wgt-panneau p { margin: 0 0 14px; font-size: 11.5px; color: var(--text-muted); }
    #wgt-liste { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
    .wgt-ligne { display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      border: 1px solid var(--border); border-radius: 8px; }
    .wgt-ligne label { flex: 1; display: flex; align-items: center; gap: 10px; cursor: pointer;
      font-size: 13px; color: var(--text); min-width: 0; }
    .wgt-ligne label span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .wgt-ligne.wgt-masquee label span { color: var(--text-muted); text-decoration: line-through; }
    .wgt-ligne button { background: none; border: 1px solid var(--border); border-radius: 6px;
      color: var(--text-muted); width: 26px; height: 26px; cursor: pointer; font-size: 11px; }
    .wgt-ligne button:disabled { opacity: .3; cursor: default; }
    .wgt-actions { display: flex; gap: 10px; align-items: center; margin-top: 16px; }`;
  document.head.appendChild(st);

  const main = document.getElementById('main-content');
  if (!main) return;
  let t = null;
  const relancer = () => { clearTimeout(t); t = setTimeout(() => wgtCharger().then(wgtAppliquer), 90); };
  new MutationObserver(relancer).observe(main, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', relancer);
  else relancer();
})();
