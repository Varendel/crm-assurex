// ═══ MARQUAGE DES ENTITÉS (19.09.2026) ══════════════════════════════════════════════════════
// Vue de travail pour terminer de marquer l'entité de chaque client : OZ Assure (source_oz) ou
// Assurex / EX Groupe (source_cofidex). Ces marquages pilotent la répartition des commissions,
// la refacturation OZ et la fusion du 01.01.2027. Un clic marque le client, la carte disparaît et
// la progression avance ; l'onglet « Déjà marqués » permet de corriger. Rien n'est supprimé.

window._me = window._me || { onglet: 'aucun', recherche: '', segment: '' };

function meEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function meNom(c) { return (typeof estEntreprise === 'function' && estEntreprise(c)) ? (c.nom || '') : `${c.prenom || ''} ${c.nom || ''}`.trim(); }
function meEntite(c) { return c.source_oz && c.source_cofidex ? 'deux' : c.source_oz ? 'oz' : c.source_cofidex ? 'ex' : 'aucun'; }

// Indice pour aider à décider : origine de l'import, contrats repris d'OZ, apporteur
function meIndice(c) {
  const src = String(c.source || '').toLowerCase();
  if (src.includes('oz')) return { ent: 'oz', txt: 'importé du portefeuille OZ' };
  if (src.includes('cofidex') || src.includes('ex')) return { ent: 'ex', txt: 'importé du portefeuille EX' };
  return null;
}

function meLogoOz() { return typeof OZ_LOGO_TERTIAIRE_SVG !== 'undefined' ? `<span class="me-logo-oz">${OZ_LOGO_TERTIAIRE_SVG}</span>` : 'OZ Assure'; }
function meLogoEx() { return '<img src="assets/logos/assurex.png" alt="Assurex" class="me-logo-ex"/>'; }

function viewMarquageEntites() {
  const tous = (allClients || []).filter(c => c.statut !== 'supprimé');
  const nb = { aucun: 0, oz: 0, ex: 0, deux: 0 };
  tous.forEach(c => nb[meEntite(c)]++);
  const faits = tous.length - nb.aucun;
  const pct = tous.length ? Math.round(faits / tous.length * 100) : 100;
  return `
    <div class="dx-tete"><div><h1>Marquage des entités</h1><p class="dx-sous">OZ Assure ou Assurex / EX Groupe — un clic par client, la liste se vide au fur et à mesure.</p></div></div>
    <section class="dbx-carte me-progres">
      <div class="me-progres-haut"><b id="me-pct">${pct} %</b><span id="me-reste">${nb.aucun ? `${nb.aucun} client${nb.aucun > 1 ? 's' : ''} à marquer` : '✓ Tous les clients sont marqués'}</span></div>
      <div class="me-barre"><i id="me-barre" style="width:${pct}%"></i></div>
      <div class="me-compteurs">
        <span>${meLogoOz()} <b id="me-nb-oz">${nb.oz + nb.deux}</b></span>
        <span>${meLogoEx()} <b id="me-nb-ex">${nb.ex + nb.deux}</b></span>
        <span class="me-sans">Sans entité <b id="me-nb-aucun">${nb.aucun}</b></span>
      </div>
    </section>
    <div class="me-outils">
      <div class="me-onglets">
        <button type="button" class="${_me.onglet === 'aucun' ? 'actif' : ''}" onclick="meOnglet('aucun')">Sans entité</button>
        <button type="button" class="${_me.onglet === 'marques' ? 'actif' : ''}" onclick="meOnglet('marques')">Déjà marqués</button>
      </div>
      <input type="search" class="form-input me-recherche" placeholder="Rechercher un client…" value="${meEsc(_me.recherche)}" oninput="_me.recherche=this.value;meRendreListe()"/>
      <select class="form-select me-segment" onchange="_me.segment=this.value;meRendreListe()">
        <option value="">Privés et entreprises</option>
        <option value="prive" ${_me.segment === 'prive' ? 'selected' : ''}>Privés</option>
        <option value="entreprise" ${_me.segment === 'entreprise' ? 'selected' : ''}>Entreprises</option>
      </select>
    </div>
    <div id="me-liste" class="me-liste">${htmlListeMarquage()}</div>`;
}

function htmlListeMarquage() {
  const q = (_me.recherche || '').toLowerCase().trim();
  const liste = (allClients || []).filter(c => c.statut !== 'supprimé')
    .filter(c => _me.onglet === 'aucun' ? meEntite(c) === 'aucun' : meEntite(c) !== 'aucun')
    .filter(c => !_me.segment || (_me.segment === 'entreprise') === (typeof estEntreprise === 'function' && estEntreprise(c)))
    .filter(c => !q || meNom(c).toLowerCase().includes(q) || String(c.ville || '').toLowerCase().includes(q))
    .sort((a, b) => meNom(a).localeCompare(meNom(b), 'fr'));
  if (!liste.length) return `<div class="dbx-carte"><div class="dbx-vide"><span style="font-size:28px">🎉</span>${_me.onglet === 'aucun' ? 'Plus aucun client sans entité.' : 'Aucun client marqué ne correspond.'}</div></div>`;
  return liste.slice(0, 300).map(c => {
    const cts = (allContrats || []).filter(ct => ct.client_id === c.id && ct.statut !== 'annulé');
    const comps = [...new Set(cts.map(ct => ct.compagnie).filter(Boolean))];
    const ag = (typeof allAgents !== 'undefined' ? allAgents : []).find(a => a.id === c.apporteur_id);
    const ind = meIndice(c);
    const ent = meEntite(c);
    return `<article class="me-carte" id="me-c-${c.id}">
      <div class="me-corps">
        <b class="me-nom" onclick="showClient('${c.id}')">${meEsc(meNom(c)) || '—'}</b>
        <small>${typeof estEntreprise === 'function' && estEntreprise(c) ? '🏢 Entreprise' : '🙂 Privé'}${c.ville ? ' · ' + meEsc(c.ville) : ''}${ag ? ' · ' + meEsc(`${ag.prenom || ''} ${ag.nom || ''}`.trim()) : ''} · ${cts.length} contrat${cts.length > 1 ? 's' : ''}</small>
        ${comps.length ? `<div class="me-comps">${comps.slice(0, 6).map(n => `<span title="${meEsc(n)}">${typeof pictoCompagnie === 'function' ? pictoCompagnie(n, 22) : meEsc(n)}</span>`).join('')}</div>` : ''}
        ${ind && ent === 'aucun' ? `<span class="me-indice">💡 ${ind.txt}</span>` : ''}
      </div>
      <div class="me-actions">
        <button type="button" class="me-btn ${ent === 'oz' || ent === 'deux' ? 'choisi' : ''} ${ind && ind.ent === 'oz' && ent === 'aucun' ? 'suggere' : ''}" onclick="meMarquer('${c.id}','oz')" title="Client OZ Assure">${meLogoOz()}</button>
        <button type="button" class="me-btn ${ent === 'ex' || ent === 'deux' ? 'choisi' : ''} ${ind && ind.ent === 'ex' && ent === 'aucun' ? 'suggere' : ''}" onclick="meMarquer('${c.id}','ex')" title="Client Assurex / EX Groupe">${meLogoEx()}</button>
      </div>
    </article>`;
  }).join('') + (liste.length > 300 ? `<div class="dbx-vide-petit">${liste.length - 300} autres — affine la recherche.</div>` : '');
}

function meOnglet(o) { _me.onglet = o; const m = document.getElementById('main-content'); if (m) m.innerHTML = viewMarquageEntites(); }
function meRendreListe() { const el = document.getElementById('me-liste'); if (el) el.innerHTML = htmlListeMarquage(); }

function meMajCompteurs() {
  const tous = (allClients || []).filter(c => c.statut !== 'supprimé');
  const nb = { aucun: 0, oz: 0, ex: 0, deux: 0 };
  tous.forEach(c => nb[meEntite(c)]++);
  const pct = tous.length ? Math.round((tous.length - nb.aucun) / tous.length * 100) : 100;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('me-pct', pct + ' %'); set('me-nb-oz', nb.oz + nb.deux); set('me-nb-ex', nb.ex + nb.deux); set('me-nb-aucun', nb.aucun);
  set('me-reste', nb.aucun ? `${nb.aucun} client${nb.aucun > 1 ? 's' : ''} à marquer` : '✓ Tous les clients sont marqués');
  const b = document.getElementById('me-barre'); if (b) b.style.width = pct + '%';
}

// Marque (ou, dans « Déjà marqués », bascule) l'entité d'un client
async function meMarquer(clientId, ent) {
  const c = (allClients || []).find(x => x.id === clientId);
  if (!c) return;
  let patch;
  if (_me.onglet === 'aucun') patch = ent === 'oz' ? { source_oz: true, source_cofidex: false } : { source_oz: false, source_cofidex: true };
  else patch = ent === 'oz' ? { source_oz: !c.source_oz } : { source_cofidex: !c.source_cofidex };
  const r = await dbPatch('clients', clientId, patch);
  if (r && r.error) { showError('Erreur : ' + (typeof errMsg === 'function' ? errMsg(r) : '')); return; }
  Object.assign(c, patch);
  if (typeof logAction === 'function') {
    if ('source_oz' in patch) logAction('toggle_source_oz', 'clients', clientId, patch.source_oz ? 'Client marqué OZ' : 'Marquage OZ retiré');
    if ('source_cofidex' in patch) logAction('toggle_source_cofidex', 'clients', clientId, patch.source_cofidex ? 'Client marqué Cofidex' : 'Marquage Cofidex retiré');
  }
  const carte = document.getElementById('me-c-' + clientId);
  if (_me.onglet === 'aucun' && carte) {
    carte.classList.add('sortie');
    setTimeout(() => { carte.remove(); if (!document.querySelector('.me-carte')) meRendreListe(); }, 320);
  } else meRendreListe();
  meMajCompteurs();
}
