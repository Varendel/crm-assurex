// ═══ PRÉPARATION DE LA SYNCHRONISATION ECOHUB (20.09.2026) ══════════════════════════════════════
// Quand une compagnie ouvrira le flux, elle enverra des lignes qui devront retrouver LEUR client et
// LEUR contrat chez nous. Le rapprochement se fait dans cet ordre :
//   1. numéro de police (à la ponctuation près) — la clé la plus sûre ;
//   2. nom + date de naissance pour un particulier, IDE pour une entreprise ;
//   3. à la main.
// Cet écran mesure donc ce qui manque AVANT l'ouverture : un contrat sans numéro de police ou un
// client sans identifiant, c'est une ligne qui restera bloquée. Utile même sans EcoHub : c'est la
// qualité de base du portefeuille.

let _ehs = { partenaires: null, correspondances: [], compagnie: null };

function ehsEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ehsCle(v) { return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
function ehsNomClient(c) {
  if (!c) return '';
  return (typeof estEntreprise === 'function' && estEntreprise(c)) ? (c.nom || '') : `${c.prenom || ''} ${c.nom || ''}`.trim();
}

const EHS_CONVENTIONS = {
  actif: { label: 'Convention active', classe: 'ok' },
  en_suspens: { label: 'Demande en suspens', classe: 'attente' },
  aucune: { label: 'Pas de convention', classe: 'neutre' },
  resilie: { label: 'Résiliée', classe: 'alerte' },
};

async function ehsCharger(forcer) {
  if (_ehs.partenaires && !forcer) return;
  const [p, c] = await Promise.all([
    dbGet('ecohub_partenaires', 'select=*&order=compagnie.asc').catch(() => []),
    dbGet('ecohub_correspondances', 'select=*').catch(() => []),
  ]);
  _ehs.partenaires = p || [];
  _ehs.correspondances = c || [];
}

// Contrats du CRM rattachés à une compagnie partenaire (comparaison souple des noms)
function ehsContratsDe(compagnie) {
  const cle = ehsCle(compagnie);
  return (typeof allContrats !== 'undefined' ? allContrats : []).filter(ct => {
    if (['annulé', 'annulée', 'resilie', 'résilié'].includes(String(ct.statut || '').toLowerCase())) return false;
    const nom = typeof normaliserCompagnie === 'function' ? normaliserCompagnie(ct.compagnie || '') : (ct.compagnie || '');
    const k = ehsCle(nom);
    return k === cle || k.includes(cle) || cle.includes(k);
  });
}

// Un client est identifiable par un flux entrant s'il a une date de naissance (particulier)
// ou une IDE (entreprise) — sans quoi seul le numéro de police permettra de le retrouver.
function ehsClientIdentifiable(c) {
  if (!c) return false;
  return (typeof estEntreprise === 'function' && estEntreprise(c)) ? !!String(c.ide || '').trim() : !!c.date_naissance;
}

function ehsAudit(compagnie) {
  const contrats = ehsContratsDe(compagnie);
  const clients = typeof allClients !== 'undefined' ? allClients : [];
  const sansPolice = contrats.filter(ct => !String(ct.numero_police || '').trim());
  const clientsConcernes = [...new Set(contrats.map(ct => ct.client_id))].map(id => clients.find(c => c.id === id)).filter(Boolean);
  const sansIdentifiant = clientsConcernes.filter(c => !ehsClientIdentifiable(c));
  const prime = contrats.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
  const pret = contrats.length ? Math.round((contrats.length - sansPolice.length) * 100 / contrats.length) : 100;
  return { contrats, sansPolice, clientsConcernes, sansIdentifiant, prime, pret };
}

function viewEcohubSync() {
  if (_ehs.partenaires === null) { ehsCharger().then(() => navigate('ecohub-sync', { silent: true })); return '<div class="loader">Chargement…</div>'; }
  const suivies = _ehs.partenaires.filter(p => p.convention !== 'aucune');
  const auditGlobal = suivies.map(p => ({ p, a: ehsAudit(p.compagnie) }));
  const totContrats = auditGlobal.reduce((s, x) => s + x.a.contrats.length, 0);
  const totSansPolice = auditGlobal.reduce((s, x) => s + x.a.sansPolice.length, 0);
  const totSansId = auditGlobal.reduce((s, x) => s + x.a.sansIdentifiant.length, 0);
  const pret = totContrats ? Math.round((totContrats - totSansPolice) * 100 / totContrats) : 100;

  return `<div class="ehs">
    <header class="dx-tete"><div><div class="dx-surtitre">EcoHub · IG B2B</div><h2>Préparation de la synchronisation</h2>
      <p class="dx-sous">Quand une compagnie ouvrira le flux, chaque ligne reçue devra retrouver son client et son contrat. Ici, ce qui manque pour que le rapprochement fonctionne dès le premier jour.</p></div>
      <div class="dx-tete-actions">
        <button type="button" class="btn-secondary" onclick="ehsCharger(true).then(() => navigate('ecohub-sync', { silent: true }))">↻ Actualiser</button>
        <button type="button" class="btn-save" onclick="ehsPreparerCorrespondances()">🔗 Préparer les correspondances</button>
      </div></header>

    <div class="dbx-kpis">
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 0, label: 'Prêt pour le rapprochement', valeur: pret, suffixe: ' %', sous: `${totContrats} contrat(s) chez les compagnies suivies` }) : ''}
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 1, label: 'Contrats sans n° de police', valeur: totSansPolice, sous: totSansPolice ? 'ils ne pourront pas être rapprochés' : 'rien à corriger' }) : ''}
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 2, label: 'Clients sans identifiant', valeur: totSansId, sous: 'ni date de naissance, ni IDE' }) : ''}
      ${typeof dbxKpi === 'function' ? dbxKpi({ i: 3, label: 'Correspondances enregistrées', valeur: _ehs.correspondances.length, sous: 'table ecohub_correspondances' }) : ''}
    </div>

    ${suivies.length ? suivies.map(p => {
      const a = ehsAudit(p.compagnie);
      const conv = EHS_CONVENTIONS[p.convention] || EHS_CONVENTIONS.aucune;
      return `<section class="dbx-carte ehs-compagnie" style="margin-top:16px">
        <header class="dbx-carte-tete">
          <h2>${typeof pictoCompagnie === 'function' ? pictoCompagnie(p.compagnie, 26) : ''} ${ehsEsc(p.compagnie)}</h2>
          <span class="ehs-conv ${conv.classe}">${conv.label}</span>
        </header>
        ${p.remarques ? `<p class="ehs-remarque">${ehsEsc(p.remarques)}</p>` : ''}
        <div class="ehs-mesures">
          <span><b>${a.contrats.length}</b> contrat(s)</span>
          <span><b>CHF ${fmtCHF(Math.round(a.prime))}</b> de primes</span>
          <span class="${a.sansPolice.length ? 'alerte' : 'ok'}"><b>${a.sansPolice.length}</b> sans n° de police</span>
          <span class="${a.sansIdentifiant.length ? 'attention' : 'ok'}"><b>${a.sansIdentifiant.length}</b> client(s) sans identifiant</span>
          <span class="ehs-barre"><i style="width:${a.pret}%"></i></span>
        </div>

        ${a.sansPolice.length ? `<div class="ehs-liste">
          <div class="ehs-liste-titre">Contrats à compléter — sans eux, les décomptes de cette compagnie resteront non rapprochés</div>
          ${a.sansPolice.slice(0, 12).map(ct => {
            const cl = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === ct.client_id);
            return `<div class="ehs-ligne">
              <button type="button" class="ehs-nom" onclick="showClient('${ct.client_id}')">${ehsEsc(ehsNomClient(cl) || 'Client')}</button>
              <span class="ehs-produit">${ehsEsc(ct.produit || 'Contrat')}${ct.date_debut ? ' · depuis le ' + fmtDate(ct.date_debut) : ''}</span>
              <span class="ehs-prime">${ct.prime_annuelle ? 'CHF ' + fmtCHF(Math.round(ct.prime_annuelle)) : '—'}</span>
              <button type="button" class="ehs-action" onclick="ehsSaisirPolice('${ct.id}')">➕ Saisir le n° de police</button>
            </div>`;
          }).join('')}
          ${a.sansPolice.length > 12 ? `<div class="ehs-plus">… et ${a.sansPolice.length - 12} autre(s)</div>` : ''}
        </div>` : ''}

        ${a.sansIdentifiant.length ? `<div class="ehs-liste">
          <div class="ehs-liste-titre">Clients sans date de naissance ni IDE — le rapprochement par nom sera impossible</div>
          ${a.sansIdentifiant.slice(0, 8).map(c => `<div class="ehs-ligne">
            <button type="button" class="ehs-nom" onclick="showClient('${c.id}')">${ehsEsc(ehsNomClient(c))}</button>
            <span class="ehs-produit">${(typeof estEntreprise === 'function' && estEntreprise(c)) ? 'Entreprise — IDE manquante' : 'Particulier — date de naissance manquante'}</span>
            <span class="ehs-prime"></span>
            <button type="button" class="ehs-action" onclick="showClient('${c.id}')">Ouvrir la fiche</button>
          </div>`).join('')}
          ${a.sansIdentifiant.length > 8 ? `<div class="ehs-plus">… et ${a.sansIdentifiant.length - 8} autre(s)</div>` : ''}
        </div>` : ''}
      </section>`;
    }).join('')
    : '<section class="dbx-carte"><div class="dbx-vide-petit">Aucune compagnie partenaire suivie. Les conventions se demandent dans le portail EcoHub.</div></section>'}
  </div>`;
}

// Saisie rapide d'un numéro de police manquant — même effet que depuis un décompte scanné (js/53)
async function ehsSaisirPolice(contratId) {
  const ct = (typeof allContrats !== 'undefined' ? allContrats : []).find(x => x.id === contratId);
  if (!ct) return;
  const numero = prompt(`Numéro de police — ${ct.produit || 'contrat'} (${ct.compagnie || ''}) :`, '');
  if (numero === null) return;
  const propre = numero.trim();
  if (!propre) return;
  const r = await dbPatch('contrats', contratId, { numero_police: propre });
  if (r && r.error) { showError('Enregistrement impossible : ' + (typeof errMsg === 'function' ? errMsg(r) : '')); return; }
  ct.numero_police = propre;
  if (typeof logAction === 'function') logAction('edit_contrat', 'contrats', contratId, `n° de police (préparation EcoHub) : ${propre}`);
  showError('✓ Numéro enregistré.');
  navigate('ecohub-sync', { silent: true });
}

// Construit (ou met à jour) la table de correspondance à partir du portefeuille actuel.
// Chaque contrat d'une compagnie suivie devient une clé de rapprochement ; la confiance dépend de
// ce dont on dispose : numéro de police → sûre, identifiant client seul → probable, rien → à vérifier.
async function ehsPreparerCorrespondances() {
  await ehsCharger(true);
  const suivies = _ehs.partenaires.filter(p => p.convention !== 'aucune');
  if (!suivies.length) { showError('Aucune compagnie suivie.'); return; }
  const clients = typeof allClients !== 'undefined' ? allClients : [];
  const existantes = new Set(_ehs.correspondances.map(c => `${c.contrat_id || ''}|${ehsCle(c.numero_police)}`));
  const lignes = [];
  suivies.forEach(p => {
    ehsContratsDe(p.compagnie).forEach(ct => {
      const cle = `${ct.id}|${ehsCle(ct.numero_police)}`;
      if (existantes.has(cle)) return;
      const client = clients.find(c => c.id === ct.client_id);
      const aPolice = !!String(ct.numero_police || '').trim();
      lignes.push({
        client_id: ct.client_id, contrat_id: ct.id, compagnie: p.compagnie,
        numero_police: ct.numero_police || null,
        methode: aPolice ? 'police' : (ehsClientIdentifiable(client) ? (estEntreprise && estEntreprise(client) ? 'ide' : 'nom_naissance') : 'manuel'),
        confiance: aPolice ? 'sure' : (ehsClientIdentifiable(client) ? 'probable' : 'a_verifier'),
      });
    });
  });
  if (!lignes.length) { showError('Tout est déjà à jour — aucune nouvelle correspondance.'); return; }
  const r = await dbPost('ecohub_correspondances', lignes);
  if (r && r.error) { showError('Enregistrement impossible : ' + (typeof errMsg === 'function' ? errMsg(r) : '')); return; }
  const sures = lignes.filter(l => l.confiance === 'sure').length;
  showError(`✓ ${lignes.length} correspondance(s) préparée(s) — dont ${sures} sûre(s) par numéro de police.`);
  await ehsCharger(true);
  navigate('ecohub-sync', { silent: true });
}
