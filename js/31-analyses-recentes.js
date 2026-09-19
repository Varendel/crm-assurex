// ═══ DERNIÈRES ANALYSES (19.09.2026) ═══════════════════════════════════════════════════════
// Analyse de prévoyance et financement immobilier ouverts sans client : on affiche les dernières
// analyses enregistrées (bilans_prevoyance / dossiers_conseil.situation.immobilier) pour les
// rouvrir en un clic, plutôt qu'une page vide.

function anxEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function anxNom(clientId, repli) {
  const c = clientId ? allClients.find(x => x.id === clientId) : null;
  return c ? (estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`.trim()) : (repli || 'Simulation');
}

function anxHtmlZone(type) {
  return `<section class="anx" id="anx-${type}" aria-label="Dernières analyses">
    <div class="anx-tete"><span>${type === 'ap' ? '🧮 Dernières analyses de prévoyance' : '🏠 Derniers projets immobiliers'}</span><small>clique pour rouvrir</small></div>
    <div class="anx-liste"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
  </section>`;
}

async function anxChargerPrevoyance() {
  const zone = document.querySelector('#anx-ap .anx-liste');
  if (!zone) return;
  const rows = await dbGet('bilans_prevoyance', 'select=id,client_id,nom,created_at,resume&order=created_at.desc&limit=24');
  // Une carte par client (sa dernière analyse)
  const vus = new Set();
  const liste = (Array.isArray(rows) ? rows : []).filter(a => { const k = a.client_id || a.id; if (vus.has(k)) return false; vus.add(k); return true; }).slice(0, 8);
  if (!liste.length) { document.getElementById('anx-ap')?.remove(); return; }
  zone.innerHTML = liste.map(a => `<button type="button" class="anx-carte" onclick="anxOuvrirPrevoyance(${a.client_id ? `'${a.client_id}'` : 'null'},'${a.id}')">
    <b>${anxEsc(anxNom(a.client_id, a.nom))}</b>
    <small>${fmtDate(a.created_at)}</small>
    ${a.resume ? `<span>${anxEsc(String(a.resume).slice(0, 110))}</span>` : ''}
  </button>`).join('');
}

async function anxOuvrirPrevoyance(clientId, analyseId) {
  if (clientId) {
    await apChoisirClient(clientId);
    const choisie = _ap.analyses.find(a => a.id === analyseId);
    if (choisie && choisie !== _ap.analyses.find(a => a.donnees)) apChargerAnalyse(analyseId);
    else apRerendre();
    return;
  }
  const rows = await dbGet('bilans_prevoyance', `id=eq.${analyseId}&select=id,created_at,resume,donnees,html_snapshot`);
  _ap.analyses = Array.isArray(rows) ? rows : [];
  apChargerAnalyse(analyseId);
}

async function anxChargerImmo() {
  const zone = document.querySelector('#anx-fi .anx-liste');
  if (!zone) return;
  const rows = await dbGet('dossiers_conseil', 'select=id,client_id,situation,updated_at,created_at&order=updated_at.desc.nullslast&limit=40');
  const liste = (Array.isArray(rows) ? rows : []).filter(d => d.client_id && d.situation && d.situation.immobilier && (d.situation.immobilier.prix || d.situation.immobilier.fonds_propres)).slice(0, 8);
  if (!liste.length) { document.getElementById('anx-fi')?.remove(); return; }
  zone.innerHTML = liste.map(d => {
    const im = d.situation.immobilier;
    const prix = Number(String(im.prix || 0).replace(/[^\d.]/g, '')) || 0;
    return `<button type="button" class="anx-carte" onclick="fiChoisirClient('${d.client_id}')">
      <b>${anxEsc(anxNom(d.client_id))}</b>
      <small>${fmtDate(d.updated_at || d.created_at)}</small>
      <span>${prix ? 'Bien de CHF ' + fmtCHF(prix) : 'Projet immobilier'}${im.type ? ' · ' + anxEsc(im.type) : ''}</span>
    </button>`;
  }).join('');
}
