// ═══ SYNCHRONISATION OUTLOOK — détecte les réponses reçues aux demandes d'offre ═══
// Approche volontairement simple (validée avec Jonathan le 06.08.2026) : UN seul appel Graph
// récupère les mails des 60 derniers jours, puis on rapproche chaque compagnie encore "en
// attente" (demandes_offre.compagnies_envoi) par DOMAINE de l'expéditeur (celui déjà enregistré
// dans Contacts compagnies) et par date (mail reçu après la date d'envoi). Pas de reconnaissance
// par sujet/mots-clés pour l'instant — volontairement laissé de côté pour rester fiable.
async function synchroniserOutlook() {
  if (!msalAccessToken) { showError("Connecte-toi à Outlook (bouton Microsoft dans le menu) pour synchroniser."); return; }
  const btn = document.getElementById('btn-sync-outlook');
  if (btn) { btn.textContent = '🔄 Synchronisation...'; btn.disabled = true; }

  try {
    const toutes = await dbGet('demandes_offre', 'select=id,opportunite_id,compagnies_envoi&order=created_at.desc');
    const enAttenteBrut = (toutes || []).filter(d => (d.compagnies_envoi || []).some(e => e.statut !== 'reçue'));
    // Recherche scopée aux opportunités créées et EN COURS (décision de Jonathan le 06.08.2026) :
    // un dossier rattaché à une opportunité Gagnée ou Perdue n'est plus synchronisé (plus la
    // peine de vérifier les réponses reçues sur une affaire déjà classée). Un dossier sans
    // opportunité liée (simple prospect) reste synchronisé — rien à filtrer dans ce cas.
    const enAttente = enAttenteBrut.filter(d => {
      if (!d.opportunite_id) return true;
      const opp = (allOpportunites || []).find(o => o.id === d.opportunite_id);
      return !opp || !['Gagné', 'Perdu'].includes(opp.stade);
    });
    if (!enAttente.length) {
      showError('Rien à synchroniser — aucun dossier en attente de réponse.');
      if (btn) { btn.textContent = '📧 Synchroniser Outlook'; btn.disabled = false; }
      return;
    }

    const depuis = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    let messages = [];
    const url = `https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${depuis}&$orderby=receivedDateTime desc&$top=200&$select=id,subject,from,receivedDateTime`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${msalAccessToken}` } });
    if (r.ok) {
      const data = await r.json();
      messages = data.value || [];
    } else if (r.status === 401) {
      showError('Session Outlook expirée — reconnecte-toi (bouton Microsoft dans le menu) puis réessaie.');
      if (btn) { btn.textContent = '📧 Synchroniser Outlook'; btn.disabled = false; }
      return;
    }

    let nbMaj = 0;
    for (const d of enAttente) {
      const compagniesEnvoi = (d.compagnies_envoi || []).map(e => ({ ...e }));
      let modifie = false;
      compagniesEnvoi.forEach(e => {
        if (e.statut === 'reçue' || !e.email || !e.email.includes('@')) return;
        const domaine = e.email.split('@')[1].toLowerCase();
        const envoyeLe = new Date(e.envoye_le || 0);
        const match = messages.find(m => {
          const addr = (m.from && m.from.emailAddress && m.from.emailAddress.address || '').toLowerCase();
          return addr.endsWith('@' + domaine) && new Date(m.receivedDateTime) >= envoyeLe;
        });
        if (match) {
          e.statut = 'reçue';
          e.recu_le = match.receivedDateTime;
          modifie = true;
          nbMaj++;
        }
      });
      if (modifie) await dbPatch('demandes_offre', d.id, { compagnies_envoi: compagniesEnvoi });
    }

    showError(nbMaj ? `✓ Synchronisation terminée — ${nbMaj} offre(s) marquée(s) reçue(s).` : 'Synchronisation terminée — aucune nouvelle réponse détectée.');
  } catch (e) {
    showError('Erreur pendant la synchronisation Outlook : ' + e.message);
  }
  if (btn) { btn.textContent = '📧 Synchroniser Outlook'; btn.disabled = false; }
  if (currentView === 'dashboard') navigate('dashboard');
}

function viewDashboard() {
  const actifs = allClients.filter(c => c.statut === 'actif').length;
  const totalCAFull = allContrats.filter(ct => !['résilié','annulé','mandat_resilie'].includes(ct.statut)).reduce((s,ct) => s + Number(ct.prime_annuelle||0), 0);
  // ── Commissions en attente (pipeline) : basé sur la date de SIGNATURE du contrat ──
  // C'est la bonne définition métier : seuls les contrats signés depuis la fusion
  // génèrent de nouvelles commissions pour Assurex. Le portefeuille pré-fusion
  // (déjà géré par OZ Assure) ne compte pas, même si sa commission est encore "en attente".
  const commissionsActives = allCommissionsAttente.filter(ca => {
    if (ca.statut !== 'en_attente') return false;
    const ct = allContrats.find(c => c.id === ca.contrat_id);
    return ct && ct.statut !== 'annulé' && ct.date_debut && ct.date_debut >= DATE_BASCULE_ASSUREX;
  });
  const totalCommActives = commissionsActives.reduce((s, ca) => s + Number(ca.montant_estime || 0), 0);
  // ── Commissions reçues : basé sur la vraie date de RÉCEPTION (bordereau) uniquement ──
  // IMPORTANT : versé_oz / versé_cofidex marquent des paiements HISTORIQUES (pré-fusion,
  // déjà réglés par OZ Assure avant le 01.06.2026) — ils ne comptent JAMAIS comme
  // commissions post-fusion, même si techniquement rapprochés. Seul le statut "reçue"
  // (rapprochement bordereau Assurex, flux post-fusion) compte ici.
  // ── Commissions reçues : compte toute commission "reçue" par défaut ──
  // Elle n'est exclue QUE si on a la preuve explicite qu'elle date d'avant la fusion
  // (date connue et < 01.06.2026). Si aucune date n'est renseignée nulle part,
  // on l'inclut plutôt que de la faire disparaître silencieusement — une commission
  // marquée "reçue" dans ce CRM (créé après la fusion) ne peut pas être antérieure.
  const commissionsRecues = allCommissionsAttente.filter(ca => {
    if (ca.statut !== 'reçue') return false;
    const d = commissionDateReception(ca);
    if (!d) return true; // pas de date connue → on ne l'exclut plus par défaut
    return d >= DATE_BASCULE_ASSUREX;
  });
  const totalCommRecuesBrut = commissionsRecues.reduce((s, ca) => s + Number(ca.montant_final != null ? ca.montant_final : (ca.montant_estime||0)), 0);
  // Extourné = commission déjà reçue puis reprise par la compagnie (contrat policé annulé après coup) — réduit le net réellement conservé
  const commissionsExtournees = allCommissionsAttente.filter(ca => {
    if (ca.statut !== 'extourné') return false;
    const d = commissionDateReception(ca);
    if (!d) return true;
    return d >= DATE_BASCULE_ASSUREX;
  });
  const totalExtourne = commissionsExtournees.reduce((s, ca) => s + Number(ca.montant_final != null ? ca.montant_final : (ca.montant_estime||0)), 0);
  const totalCommRecues = totalCommRecuesBrut - totalExtourne;
  const totalGestionRecue = commissionsRecues.filter(ca => ca.nature === 'gestion').reduce((s, ca) => s + Number(ca.montant_final != null ? ca.montant_final : (ca.montant_estime||0)), 0);
  const totalAcquisitionRecue = totalCommRecuesBrut - totalGestionRecue;
  const nbContratsActifs = allContrats.filter(ct => !['résilié','annulé','mandat_resilie'].includes(ct.statut) && ct.commissionne !== false).length;
  const urgents = allRappels.filter(r => r.urgence === 'haute' && r.statut === 'ouvert');
  const now = new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  let rappelRows = urgents.length > 0 ? urgents.map(r => {
    const cl = r.client_id ? allClients.find(c => c.id === r.client_id) : null;
    const nomCl = cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`) : '';
    return `
    <div style="padding:11px 18px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center;cursor:pointer;transition:background 0.1s" onclick="showRappel('${r.id}')" onmouseover="this.style.background='rgba(56,189,248,0.06)'" onmouseout="this.style.background='transparent'">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--red);flex-shrink:0"></div>
      <div style="flex:1"><div style="font-size:12.5px;font-weight:600;color:var(--text)">${r.titre}</div><div style="font-size:11px;color:var(--text-muted)">${nomCl ? '👤 ' + nomCl + ' · ' : ''}${fmtDate(r.date_echeance)}</div></div>
      <span style="font-size:11px;color:var(--accent)">&#8594;</span>
    </div>`;
  }).join('') : '<div style="padding:16px 18px;color:var(--text-muted);font-size:13px">Aucun rappel urgent</div>';

  let teamRows = allAgents.map((a, i) => {
    const nb = allClients.filter(c => c.apporteur_id === a.id).length;
    const pct = allClients.length > 0 ? Math.round((nb / allClients.length) * 100) : 0;
    const color = agentColor(a);
    return `<div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        ${avatar(a, 24)}
        <div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--text)">${a.prenom} ${a.nom}</div><div style="font-size:10px;color:var(--text-muted)">${nb} clients</div></div>
        <span style="font-size:12px;font-weight:800;color:${color}">${pct}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }).join('');

  // ── Polices non commissionnées "à bouger" — regroupées par horizon d'échéance ──
  const today = new Date();
  const nonGerees = allContrats.filter(ct => ct.commissionne === false && !['résilié','annulé','mandat_resilie'].includes(ct.statut));
  function joursRestants(ct) { return ct.date_echeance ? Math.floor((new Date(ct.date_echeance) - today) / 86400000) : null; }
  const horizons = [
    { label: 'En retard', test: j => j !== null && j < 0, color: '#f87171' },
    { label: '0-3 mois', test: j => j !== null && j >= 0 && j <= 90, color: '#fb923c' },
    { label: '3-6 mois', test: j => j !== null && j > 90 && j <= 180, color: '#f59e0b' },
    { label: '6-12 mois', test: j => j !== null && j > 180 && j <= 365, color: '#a78bfa' },
    { label: '+12 mois / inconnue', test: j => j === null || j > 365, color: '#64748b' },
  ];
  const horizonsData = horizons.map(h => {
    const liste = nonGerees.filter(ct => h.test(joursRestants(ct)));
    return { ...h, nb: liste.length, montant: liste.reduce((s,ct) => s + Number(ct.prime_annuelle||0), 0) };
  });
  const totalNonGere = nonGerees.reduce((s,ct) => s + Number(ct.prime_annuelle||0), 0);
  const maxHorizon = Math.max(...horizonsData.map(h => h.montant), 1);

  // ── Récap opportunités en cours (pipeline) — pour le dashboard ──
  const oppsOuvertes = allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu');
  const oppsGagneesRecemment = allOpportunites.filter(o => o.stade === 'Gagné');
  const stadesOrdre = ['Contact','Analyse','Proposition','Négociation'];
  const stadeCouleur = { Contact:'#64748b', Analyse:'#38bdf8', Proposition:'#f59e0b', Négociation:'#a78bfa' };
  const oppTotalPipeline = oppsOuvertes.reduce((s,o) => s + Number(o.montant_potentiel||0), 0);
  const oppTotalPondere = oppsOuvertes.reduce((s,o) => s + Math.round(Number(o.montant_potentiel||0) * (o.probabilite||0) / 100), 0);
  const oppParStade = stadesOrdre.map(stade => ({
    stade, couleur: stadeCouleur[stade],
    nb: oppsOuvertes.filter(o => o.stade === stade).length,
    montant: oppsOuvertes.filter(o => o.stade === stade).reduce((s,o) => s + Number(o.montant_potentiel||0), 0),
  }));
  function nomClientOpp(o) {
    const cl = o.client_id ? allClients.find(c => c.id === o.client_id) : null;
    if (cl) return estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`;
    return o.prospect_nom ? `${o.prospect_nom} 🆕` : '—';
  }
  const oppUrgentes = oppsOuvertes.filter(o => o.date_echeance).sort((a,b) => new Date(a.date_echeance) - new Date(b.date_echeance)).slice(0, 5);

  // ── Filet de sécurité : contrats commissionnables sans AUCUNE ligne de commission ──
  // Détecte automatiquement les trous de données (ex: contrat inséré directement en SQL
  // sans passer par le formulaire du CRM, qui aurait dû générer la commission).
  const idsAvecCommission = new Set(allCommissionsAttente.map(ca => ca.contrat_id).filter(Boolean));
  const contratsOrphelins = allContrats.filter(ct =>
    ct.commissionne !== false &&
    !['résilié', 'annulé', 'mandat_resilie'].includes(ct.statut) &&
    Number(ct.prime_annuelle || 0) > 0 &&
    !idsAvecCommission.has(ct.id)
  );

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="margin-bottom:4px;color:var(--text-muted);font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${now}</div>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:900;color:var(--text)">Bonjour, ${currentUser.prenom} 👋</h1>
      </div>
      <div style="display:flex;gap:8px">
        <button id="btn-sync-outlook" onclick="synchroniserOutlook()" title="Vérifie dans Outlook si des compagnies ont répondu aux demandes d'offre envoyées" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:9px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">📧 Synchroniser Outlook</button>
        <button onclick="navigate('dashboard')" title="Recharger les données depuis Supabase" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:9px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">🔄 Actualiser</button>
      </div>
    </div>
    <div style="color:var(--text-muted);font-size:13px;margin-bottom:24px">Assurex Sàrl · EX Groupe · Commissions actives depuis le 01.06.2026</div>
    <div class="stat-grid" style="grid-template-columns:repeat(5,1fr)">
      ${statCard('Clients', allClients.length, '#38bdf8', `${actifs} actifs`)}
      ${statCard('CA portefeuille /an', 'CHF ' + Math.round(totalCAFull).toLocaleString(), '#f59e0b', `${nbContratsActifs} contrats`)}
      ${statCard('Commissions en attente', 'CHF ' + Math.round(totalCommActives).toLocaleString(), '#f59e0b', `depuis 01.06.2026`)}
      ${statCard('Commissions reçues', 'CHF ' + Math.round(totalCommRecues).toLocaleString(), '#4ade80', `Acquisition CHF ${fmtCHF(Math.round(totalAcquisitionRecue))} · Gestion CHF ${fmtCHF(Math.round(totalGestionRecue))}`)}
      ${statCard('Rappels urgents', urgents.length, urgents.length > 0 ? '#f87171' : '#64748b')}
    </div>

    ${contratsOrphelins.length > 0 ? `
    <div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.3);border-radius:14px;padding:18px 22px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;font-weight:800;color:#f87171">⚠️ ${contratsOrphelins.length} contrat(s) sans aucune commission créée</div>
        <button onclick="navigate('contrats-orphelins-commission')" style="background:rgba(248,113,113,0.15);border:1px solid rgba(248,113,113,0.4);color:#f87171;border-radius:7px;padding:6px 14px;font-size:11.5px;font-weight:700;cursor:pointer">Voir le détail →</button>
      </div>
      <div style="font-size:11.5px;color:var(--text-muted)">Ces contrats sont commissionnables et actifs, mais aucune ligne de commission n'existe pour eux — souvent le signe d'un contrat ajouté directement en base de données. Clique sur "Voir le détail" pour les corriger un par un.</div>
    </div>` : ''}

    ${nonGerees.length > 0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <div style="font-size:13px;font-weight:800;color:var(--text)">🎯 Polices non commissionnées à bouger</div>
        <div style="font-size:18px;font-weight:900;color:#fb923c">CHF ${fmtCHF(Math.round(totalNonGere))}</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:18px">${nonGerees.length} contrat(s) sans convention de collaboration — volume de primes potentiellement récupérable par transfert, classé par proximité d'échéance</div>
      <div style="display:flex;align-items:flex-end;gap:14px;height:120px;margin-bottom:6px">
        ${horizonsData.map(h => {
          const heightPx = Math.max(Math.round(h.montant / maxHorizon * 95), h.montant > 0 ? 6 : 2);
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
            <div style="font-size:10.5px;font-weight:800;color:${h.color};margin-bottom:4px">${h.montant > 0 ? Math.round(h.montant/1000) + 'k' : '—'}</div>
            <div style="width:100%;max-width:50px;height:${heightPx}px;background:${h.color};border-radius:5px 5px 2px 2px;opacity:${h.nb>0?1:0.25}"></div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:14px">
        ${horizonsData.map(h => `<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text-muted)">${h.label}</div><div style="font-size:10px;color:var(--text-dim)">${h.nb} contrat(s)</div></div>`).join('')}
      </div>
      <div style="margin-top:14px;text-align:right">
        <button onclick="navigate('suivi')" style="background:none;border:none;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer">Voir le détail →</button>
      </div>
    </div>` : ''}

    ${oppsOuvertes.length > 0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <div style="font-size:13px;font-weight:800;color:var(--text)">🎯 Opportunités en cours</div>
        <div style="font-size:18px;font-weight:900;color:#f59e0b">CHF ${fmtCHF(Math.round(oppTotalPipeline))}</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:18px">${oppsOuvertes.length} opportunité(s) ouverte(s) · CHF ${fmtCHF(Math.round(oppTotalPondere))} pondéré par probabilité${oppsGagneesRecemment.length ? ` · ${oppsGagneesRecemment.length} gagnée(s)` : ''}</div>
      <div style="display:flex;gap:14px;margin-bottom:18px;flex-wrap:wrap">
        ${oppParStade.map(s => `<div style="flex:1;min-width:90px;text-align:center;background:var(--surface-alt);border-radius:10px;padding:10px 8px">
          <div style="width:8px;height:8px;border-radius:50%;background:${s.couleur};margin:0 auto 6px"></div>
          <div style="font-size:16px;font-weight:900;color:var(--text)">${s.nb}</div>
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">${s.stade}</div>
          <div style="font-size:10px;color:${s.couleur};font-weight:700;margin-top:2px">CHF ${fmtCHF(Math.round(s.montant/1000))}k</div>
        </div>`).join('')}
      </div>
      ${oppUrgentes.length ? `<div style="font-size:10.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Échéances les plus proches</div>
      ${oppUrgentes.map(o => `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="opportuniteEnEditionId='${o.id}';navigate('nouvelle-opportunite')">
        <div style="font-size:12.5px;color:var(--text)"><strong>${o.titre}</strong> — ${nomClientOpp(o)}</div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:11px;color:var(--text-muted)">${fmtDate(o.date_echeance)}</span>
          <span style="font-size:12px;font-weight:800;color:#f59e0b">CHF ${fmtCHF(Number(o.montant_potentiel||0))}</span>
        </div>
      </div>`).join('')}` : ''}
      <div style="margin-top:14px;text-align:right">
        <button onclick="navigate('opportunites')" style="background:none;border:none;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer">Voir le pipeline →</button>
      </div>
    </div>` : ''}

    <div id="calendar-widget-container" style="margin-bottom:20px"></div>

    <!-- Graphiques commissions -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:4px">📊 Commissions — Gestion vs Acquisition</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px">Cumul 2026</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[['Gestion (récurrentes)','#38bdf8',0],['Acquisition (nouvelles)','#4ade80',0]].map(([l,c,v])=>`
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:12px;color:var(--text-muted)">${l}</span>
              <span style="font-size:12px;font-weight:800;color:${c}">CHF ${fmtCHF(v)}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:0%;background:${c}"></div></div>
          </div>`).join('')}
        </div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:4px">💼 Pipeline</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px">Signé (opportunités gagnées) vs Prévu (opportunités ouvertes)</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${(() => {
            const signe = oppsGagneesRecemment.reduce((s,o) => s + Number(o.montant_potentiel||0), 0);
            const prevu = oppTotalPipeline;
            const maxVal = Math.max(signe, prevu, 1);
            return [['Chiffre signé','#f59e0b',signe],['Chiffre prévu (pipeline)','#a78bfa',prevu]].map(([l,c,v])=>`
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:12px;color:var(--text-muted)">${l}</span>
              <span style="font-size:12px;font-weight:800;color:${c}">CHF ${fmtCHF(Math.round(v))}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(v/maxVal*100)}%;background:${c}"></div></div>
          </div>`).join('');
          })()}
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="table-wrap">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700;font-size:13px;color:var(--text)">🔔 Rappels urgents</div>
          ${badge(urgents.length + ' urgents', '#f87171')}
        </div>
        ${rappelRows}
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px">
        <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:16px">👥 Répartition équipe</div>
        ${teamRows || '<div style="color:var(--text-muted);font-size:13px">Chargement...</div>'}
      </div>
    </div>`;
}

// PORTEFEUILLE
// ═══ CLASSIFICATION VIE / NON-VIE ═══
// Produits VIE = prévoyance, vie, 3a, LPP, perte de gain, santé collective, LAA, IJM
const PRODUITS_VIE_KEYWORDS = [
  // Prévoyance professionnelle (2e pilier) et prévoyance privée (3a/3b)
  'vie','3a','3b','lpp','libre passage','libre_passage','vie_3a','lpp_entreprise',
  'prevoyance_enfant',
  // Risque pur et rente d'incapacité de gain LIÉS à une police vie/prévoyance (3a/3b/LPP) —
  // à distinguer de la "perte de gain maladie" collective (IJM), qui reste Non-Vie (branche dommages)
  'risque pur','incapacité de gain','incapacite de gain','rente incapacité','rente incapacite',
  'rente invalidité','rente invalidite','rente viagère','rente viagere',
  // NB : LAA, perte de gain maladie/accident (collective), IJM, santé/maladie collective et sursalaire
  // sont du domaine NON-VIE (branche dommages) — volontairement absents de cette liste.
];

// ═══ TAXONOMIE FINMA — Classification des contrats par branche d'assurance ═══
// Mapping mots-clés produit → branche FINMA (registre des intermédiaires, art. 183 OS)
const BRANCHES_FINMA = [
  { code: 'A1', label: 'Vie individuelle (LCA)', keywords: ['vie privé','vie individuelle','assurance vie'] },
  { code: 'A2', label: 'Prévoyance liée (3a)', keywords: ['3a','pilier 3a'] },
  { code: 'A3', label: 'Libre passage / LPP', keywords: ['lpp','libre passage','2e pilier'] },
  { code: 'B1', label: 'Maladie de base (LAMal)', keywords: ['lamal','maladie de base','assurance maladie (lamal)'] },
  { code: 'B2', label: 'Maladie complémentaire (LCA)', keywords: ['complémentaire','maladie (complémentaire)'] },
  { code: 'B3', label: 'Perte de gain maladie', keywords: ['perte de gain (maladie','perte de gain maladie'] },
  { code: 'C1', label: 'Accidents (LAA / LAA-C)', keywords: ['laa','accident'] },
  { code: 'C2', label: 'Indemnités journalières (IJM)', keywords: ['ijm','indemnité journalière'] },
  { code: 'D1', label: 'RC privée / Ménage', keywords: ['responsabilité civile (ménage','rc privée','rc ménage','inventaire du ménage','ménage'] },
  { code: 'D2', label: 'RC entreprise / professionnelle', keywords: ['responsabilité civile (entreprise','rc professionnelle','rc d&o','rc dirigeants','rc entreprise','rc commerce','exploitation'] },
  { code: 'E1', label: 'Véhicule à moteur', keywords: ['véhicule à moteur','casco','rc véhicule','flotte véhicules'] },
  { code: 'E2', label: 'Bâtiment / Choses', keywords: ['bâtiment','choses','inventaire ménage'] },
  { code: 'F1', label: 'Protection juridique', keywords: ['protection juridique'] },
  { code: 'F2', label: 'Voyage / Assistance', keywords: ['voyage','assistance'] },
  { code: 'G1', label: 'Garantie de loyer / Caution', keywords: ['garantie de loyer','caution'] },
  { code: 'H1', label: 'Animaux', keywords: ['animalière','animaux'] },
  { code: 'Z9', label: 'Autre / Non classé', keywords: [] },
];

function classifierBrancheFinma(produit) {
  const p = (produit || '').toLowerCase();
  for (const b of BRANCHES_FINMA) {
    if (b.keywords.some(kw => p.includes(kw))) return b;
  }
  return BRANCHES_FINMA[BRANCHES_FINMA.length - 1];
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ═══ PRODUCTION PAR PÉRIODE — contrats signés entre deux dates + CA ═══
function viewProduction() {
  const aujourd = new Date().toISOString().split('T')[0];
  const debutAnnee = new Date().getFullYear() + '-01-01';
  const produitsDistincts = [...new Set(allContrats.map(ct => ct.produit).filter(Boolean))].sort();
  setTimeout(() => renderProduction(), 0);
  return `
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:800;color:var(--text)">Production par période</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Contrats signés entre deux dates, avec la prime annuelle (CA) générée — par agent et par type de produit.</div>
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:flex-end">
      <div><label style="font-size:10.5px;color:var(--text-muted);display:block;margin-bottom:3px">Du</label><input class="form-input" id="prod-debut" type="date" value="${debutAnnee}" onchange="renderProduction()"/></div>
      <div><label style="font-size:10.5px;color:var(--text-muted);display:block;margin-bottom:3px">Au</label><input class="form-input" id="prod-fin" type="date" value="${aujourd}" onchange="renderProduction()"/></div>
      <select class="form-select" id="prod-agent" style="max-width:200px" onchange="renderProduction()">
        <option value="">Tous les agents</option>
        ${allAgents.map(a => `<option value="${a.id}">${a.prenom} ${a.nom}</option>`).join('')}
      </select>
      <select class="form-select" id="prod-produit" style="max-width:240px" onchange="renderProduction()">
        <option value="">Tous les types de produit</option>
        ${produitsDistincts.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>
    </div>
    <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-muted);cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px;width:fit-content;margin-bottom:18px">
      <input type="checkbox" id="prod-hide-lamal" checked onchange="renderProduction()"/> Masquer LAMal (fausse la lecture du CA produit, quasi pas commissionné)
    </label>
    <div id="prod-stats" class="stat-grid" style="margin-bottom:20px"></div>
    <div id="prod-detail"></div>
    <div id="prod-table"></div>`;
}

function renderProduction() {
  const debut = document.getElementById('prod-debut')?.value;
  const fin = document.getElementById('prod-fin')?.value;
  const agentFilter = document.getElementById('prod-agent')?.value || '';
  const produitFilter = document.getElementById('prod-produit')?.value || '';
  const hideLamal = document.getElementById('prod-hide-lamal')?.checked;

  const filtered = allContrats.filter(ct => {
    if (!ct.date_debut) return false;
    if (debut && ct.date_debut < debut) return false;
    if (fin && ct.date_debut > fin) return false;
    if (agentFilter && ct.apporteur_id !== agentFilter) return false;
    if (produitFilter && ct.produit !== produitFilter) return false;
    if (hideLamal && (ct.produit||'').toLowerCase().includes('lamal')) return false;
    return true;
  }).sort((a,b) => new Date(b.date_debut) - new Date(a.date_debut));

  function nomClient(ct) {
    const c = allClients.find(cl => cl.id === ct.client_id);
    return c ? (estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`) : '—';
  }

  const totalCA = filtered.reduce((s,ct) => s + Number(ct.prime_annuelle||0), 0);
  const commissionnes = filtered.filter(ct => ct.commissionne !== false);
  const totalCommissionne = commissionnes.reduce((s,ct) => s + Number(ct.prime_annuelle||0), 0);

  document.getElementById('prod-stats').innerHTML = `
    ${statCard('Contrats signés', filtered.length, '#38bdf8')}
    ${statCard('CA total (production)', 'CHF ' + Math.round(totalCA).toLocaleString(), '#f59e0b')}
    ${statCard('CA des contrats commissionnés', 'CHF ' + Math.round(totalCommissionne).toLocaleString(), '#4ade80', `${commissionnes.length}/${filtered.length} contrats`)}
  `;

  // Détail par agent
  const parAgent = {};
  filtered.forEach(ct => {
    const a = allAgents.find(ag => ag.id === ct.apporteur_id);
    const key = a ? `${a.prenom} ${a.nom}` : 'Non assigné';
    parAgent[key] = (parAgent[key] || 0) + Number(ct.prime_annuelle||0);
  });
  const agentsTries = Object.entries(parAgent).sort((a,b) => b[1]-a[1]);
  const maxAgent = agentsTries.length ? agentsTries[0][1] : 1;

  document.getElementById('prod-detail').innerHTML = agentsTries.length ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:14px">Production par agent</div>
      ${agentsTries.map(([nom,val]) => `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:var(--text)">${nom}</span><span style="color:#f59e0b;font-weight:700">CHF ${fmtCHF(Math.round(val))}</span></div>
          <div style="height:7px;border-radius:4px;background:var(--border);margin-top:4px;overflow:hidden"><div style="height:100%;width:${Math.round(val/maxAgent*100)}%;background:#38bdf8;border-radius:4px"></div></div>
        </div>`).join('')}
    </div>` : '';

  const cols = '1fr 1fr 110px 100px 90px';
  const rows = filtered.map(ct => `<div class="table-row" style="grid-template-columns:${cols};cursor:pointer" onclick="showDetailContrat('${ct.id}')">
    <div style="font-size:13px;font-weight:700;color:var(--text)">${nomClient(ct)}</div>
    <div style="font-size:12px;color:var(--text-muted)">${ct.produit || ''} · ${ct.compagnie || ''}</div>
    <div style="font-size:12px;color:var(--text-muted)">${fmtDate(ct.date_debut)}</div>
    <div style="font-weight:800;color:#f59e0b;text-align:right">CHF ${fmtCHF(Number(ct.prime_annuelle||0))}</div>
    <div>${ct.commissionne === false ? badge('Non comm.', '#64748b') : badge('OK', '#4ade80')}</div>
  </div>`).join('');

  document.getElementById('prod-table').innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}"><div>Client</div><div>Produit / Compagnie</div><div>Date signature</div><div>Prime/an</div><div>Commission</div></div>
      ${rows || '<div class="table-empty">Aucun contrat signé sur cette période.</div>'}
    </div>`;
}

function viewRapportFinma() {
  const actifs = allContrats.filter(ct => ct.statut === 'actif');
  const parBranche = {};
  BRANCHES_FINMA.forEach(b => parBranche[b.code] = { label: b.label, nb: 0, prime: 0 });
  actifs.forEach(ct => {
    const b = classifierBrancheFinma(ct.produit);
    parBranche[b.code].nb++;
    parBranche[b.code].prime += Number(ct.prime_annuelle || 0);
  });
  const lignes = Object.entries(parBranche).filter(([,v]) => v.nb > 0).sort((a,b) => b[1].prime - a[1].prime);
  const totalPrime = lignes.reduce((s,[,v]) => s + v.prime, 0);
  const totalNb = lignes.reduce((s,[,v]) => s + v.nb, 0);
  const dateRapport = new Date().toLocaleDateString('fr-CH', { day:'2-digit', month:'long', year:'numeric' });

  window._finmaLignes = lignes;
  window._finmaTotalPrime = totalPrime;
  window._finmaTotalNb = totalNb;
  window._finmaDate = dateRapport;

  function chf(v) { return 'CHF ' + Math.round(v).toLocaleString('fr-CH'); }

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Rapport FINMA</h2>
      <div style="display:flex;gap:8px">
        <button onclick="exportFinmaCsv()" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 16px;color:var(--text);font-size:12px;font-weight:700;cursor:pointer">⬇ Export CSV</button>
        <button onclick="exportFinmaTxt()" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 16px;color:var(--text);font-size:12px;font-weight:700;cursor:pointer">⬇ Export TXT</button>
        <button onclick="window.print()" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">🖨️ Imprimer</button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">Classification automatique des contrats actifs par branche d'assurance (registre des intermédiaires) — généré le ${dateRapport}</div>

    <div class="stat-grid" style="margin-bottom:24px">
      ${statCard('Contrats classés', totalNb, '#38bdf8')}
      ${statCard('Primes annuelles totales', chf(totalPrime), '#f59e0b')}
      ${statCard('Branches représentées', lignes.length, '#4ade80')}
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="color:var(--text-muted);font-size:10.5px;text-transform:uppercase">
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border)">Code</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border)">Branche FINMA</th>
          <th style="padding:8px 10px;text-align:center;border-bottom:1px solid var(--border)">Contrats</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:1px solid var(--border)">Prime annuelle</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:1px solid var(--border)">Part</th>
        </tr></thead>
        <tbody>${lignes.map(([code, v]) => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:9px 10px;font-weight:800;color:var(--accent)">${code}</td>
            <td style="padding:9px 10px;color:var(--text)">${v.label}</td>
            <td style="padding:9px 10px;text-align:center;color:var(--text-muted)">${v.nb}</td>
            <td style="padding:9px 10px;text-align:right;font-weight:700;color:#f59e0b">${chf(v.prime)}</td>
            <td style="padding:9px 10px;text-align:right;color:var(--text-muted)">${totalPrime > 0 ? Math.round(v.prime/totalPrime*100) : 0}%</td>
          </tr>`).join('') || '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-muted)">Aucun contrat actif classé.</td></tr>'}
        </tbody>
      </table>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:14px">⚠ Classification automatique basée sur le libellé produit — à vérifier avant transmission officielle à la FINMA.</div>`;
}

function exportFinmaCsv() {
  const lignes = window._finmaLignes || [];
  let csv = 'Code;Branche FINMA;Nombre de contrats;Prime annuelle (CHF);Part (%)\n';
  const total = window._finmaTotalPrime || 1;
  lignes.forEach(([code, v]) => {
    csv += `${code};${v.label};${v.nb};${v.prime.toFixed(2)};${Math.round(v.prime/total*100)}\n`;
  });
  csv += `;TOTAL;${window._finmaTotalNb};${total.toFixed(2)};100\n`;
  downloadBlob(csv, `rapport_finma_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8');
}

function exportFinmaTxt() {
  const lignes = window._finmaLignes || [];
  const total = window._finmaTotalPrime || 0;
  let txt = `RAPPORT FINMA — Assurex Sàrl\n`;
  txt += `Généré le ${window._finmaDate}\n`;
  txt += `${'='.repeat(60)}\n\n`;
  lignes.forEach(([code, v]) => {
    txt += `${code}  ${v.label}\n`;
    txt += `     Contrats: ${v.nb}   Prime annuelle: CHF ${fmtCHF2(v.prime)}   Part: ${total > 0 ? Math.round(v.prime/total*100) : 0}%\n\n`;
  });
  txt += `${'-'.repeat(60)}\n`;
  txt += `TOTAL — Contrats: ${window._finmaTotalNb}   Prime annuelle: CHF ${fmtCHF2(total)}\n`;
  downloadBlob(txt, `rapport_finma_${new Date().toISOString().slice(0,10)}.txt`, 'text/plain;charset=utf-8');
}

function classifierContrat(ct, clientsMap) {
  const produit = (ct.produit || '').toLowerCase();
  const isVie = PRODUITS_VIE_KEYWORDS.some(kw => produit.includes(kw));
  const client = clientsMap[ct.client_id];
  const isEntreprise = client && estEntreprise(client);
  return { isVie, isEntreprise };
}

async function viewVolumePrimes() {
  // Charger tous les contrats en portefeuille (tout sauf résilié/annulé — cohérent avec le "CA portefeuille" du dashboard,
  // pour ne pas faire disparaître silencieusement les contrats "en cours" ou "à renouveler" du volume affiché)
  const [contrats, clients] = await Promise.all([
    dbGet('contrats', `statut=neq.${encodeURIComponent('résilié')}&statut=neq.${encodeURIComponent('annulé')}&statut=neq.mandat_resilie&select=*`),
    dbGet('clients', 'select=id,segment,prenom,nom'),
  ]);
  const clientsMap = {};
  (clients || []).forEach(c => clientsMap[c.id] = c);
  window._volumePrimesContratsBruts = contrats || [];
  window._volumePrimesClientsMap = clientsMap;

  return `
    ${sectionCard('Filtrer par branche', '#64748b', `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px;flex-wrap:wrap">
        <div style="font-size:11px;color:var(--text-muted)">Décoche une branche pour l'exclure du volume de primes affiché ci-dessous.</div>
        <div style="display:flex;gap:8px">
          <button type="button" onclick="toutCocherVolumePrimes(true)" style="background:var(--surface-alt);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:700">Tout cocher</button>
          <button type="button" onclick="toutCocherVolumePrimes(false)" style="background:var(--surface-alt);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:700">Tout décocher</button>
        </div>
      </div>
      <div style="display:flex;gap:14px 20px;flex-wrap:wrap">
        ${BRANCHES_FINMA.map(b => `
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12.5px;color:var(--text)">
            <input type="checkbox" class="vp-branche-checkbox" data-branche="${b.code}" checked onchange="filtrerVolumePrimes()" style="width:15px;height:15px;cursor:pointer"/> ${b.label}
          </label>`).join('')}
      </div>
    `)}
    <div id="volume-primes-corps">${renderVolumePrimesCorps(contrats || [], clientsMap)}</div>
  `;
}

// Recalcule et réaffiche le contenu de Volume de primes selon les branches cochées, sans redemander
// les données au serveur (déjà en mémoire depuis le chargement initial). Classe chaque contrat par
// mots-clés (classifierBrancheFinma), pas par correspondance exacte de libellé — les libellés produit
// réellement saisis (ex. "Complémentaire santé", "Assurance maladie (LAMal)") ne correspondaient presque
// jamais mot pour mot aux libellés du catalogue, ce qui faisait que décocher une branche ne changeait rien.
function filtrerVolumePrimes() {
  const branchesActives = new Set(
    Array.from(document.querySelectorAll('.vp-branche-checkbox:checked')).map(cb => cb.dataset.branche)
  );
  const brut = window._volumePrimesContratsBruts || [];
  const filtres = brut.filter(ct => branchesActives.has(classifierBrancheFinma(ct.produit).code));
  document.getElementById('volume-primes-corps').innerHTML = renderVolumePrimesCorps(filtres, window._volumePrimesClientsMap || {});
}

function toutCocherVolumePrimes(etat) {
  document.querySelectorAll('.vp-branche-checkbox').forEach(cb => { cb.checked = etat; });
  filtrerVolumePrimes();
}

// Bascule vers "Tous les contrats" avec la recherche pré-remplie sur un libellé produit exact
// (utilisé depuis "Détail par catégorie" / "Top produits" du Volume de primes pour retrouver
// en un clic les contrats précis derrière un montant agrégé).
async function rechercherContratsProduit(produit) {
  await navigate('tous-contrats');
  const el = document.getElementById('tc-search');
  if (el) { el.value = produit; renderTousContrats(); }
}

// Reconstruit uniquement le tableau "Meilleurs clients par compagnie" (sélecteur ou clic sur une
// compagnie de la répartition), sans recalculer tout le reste de la vue Volume de primes.
function afficherTopClientsCompagnie(compagnie) {
  const parCompagnieClients = window._volumePrimesParCompagnieClients || {};
  const clientsMap = window._volumePrimesClientsMap || {};
  const select = document.getElementById('vp-compagnie-select');
  if (select && select.value !== compagnie) select.value = compagnie;
  const corps = document.getElementById('vp-top-clients-corps');
  if (corps) corps.innerHTML = renderTopClientsCompagnie(compagnie, parCompagnieClients, clientsMap);
}

// Top 10 clients par prime annuelle pour une compagnie donnée (fonction pure).
function renderTopClientsCompagnie(compagnie, parCompagnieClients, clientsMap) {
  const parClient = compagnie ? parCompagnieClients[compagnie] : null;
  if (!parClient || !Object.keys(parClient).length) {
    return `<div style="font-size:12px;color:var(--text-muted)">Aucun contrat avec prime pour cette compagnie.</div>`;
  }
  const lignes = Object.entries(parClient).map(([clientId, val]) => {
    const cl = clientsMap[clientId];
    const nom = cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom || ''} ${cl.nom || ''}`.trim()) : 'Client inconnu';
    return { clientId, nom, val };
  }).sort((a, b) => b.val - a.val).slice(0, 10);
  const totalCompagnie = Object.values(parClient).reduce((s, v) => s + v, 0) || 1;
  return `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="color:var(--text-muted);font-size:11px;text-transform:uppercase">
      <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">#</th>
      <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">Client</th>
      <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Prime annuelle</th>
      <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Part chez ${compagnie}</th>
    </tr></thead>
    <tbody>${lignes.map((l, i) => `
      <tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="showClient('${l.clientId}')">
        <td style="padding:10px;color:var(--text-muted);font-weight:700">${i + 1}</td>
        <td style="padding:10px;color:var(--text);font-weight:600;text-decoration:underline dotted">${l.nom}</td>
        <td style="padding:10px;text-align:right;font-weight:800;color:#f59e0b">CHF ${Math.round(l.val).toLocaleString('fr-CH')}</td>
        <td style="padding:10px;text-align:right;color:var(--text-muted)">${Math.round(l.val / totalCompagnie * 100)}%</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

// Calcule et génère tout l'affichage de Volume de primes à partir d'une liste de contrats donnée
// (fonction pure, appelée à la fois au chargement initial et à chaque changement de filtre par branche).
function renderVolumePrimesCorps(contrats, clientsMap) {

  // Totaux globaux
  let totalVie = 0, totalNonVie = 0, totalPrive = 0, totalEntreprise = 0;

  // Détail par catégorie produit
  const parCategorie = {};
  // Détail par produit (top 10)
  const parProduit = {};
  // Détail par compagnie
  const parCompagnie = {};
  // Détail par compagnie x client (pour la vue "meilleurs clients par compagnie")
  const parCompagnieClients = {};
  // Détail par catégorie, à l'intérieur de chaque segment (pour sous-détail des 4 carrés)
  const parCategorieVie = {}, parCategorieNonVie = {}, parCategoriePrive = {}, parCategorieEntreprise = {};

  (contrats || []).forEach(ct => {
    const prime = Number(ct.prime_annuelle || 0);
    if (!prime) return;
    const { isVie, isEntreprise } = classifierContrat(ct, clientsMap);
    const catLabel = (ct.produit || 'Autre').trim();

    if (isVie) { totalVie += prime; parCategorieVie[catLabel] = (parCategorieVie[catLabel]||0) + prime; }
    else { totalNonVie += prime; parCategorieNonVie[catLabel] = (parCategorieNonVie[catLabel]||0) + prime; }
    if (isEntreprise) { totalEntreprise += prime; parCategorieEntreprise[catLabel] = (parCategorieEntreprise[catLabel]||0) + prime; }
    else { totalPrive += prime; parCategoriePrive[catLabel] = (parCategoriePrive[catLabel]||0) + prime; }

    parCategorie[catLabel] = (parCategorie[catLabel] || 0) + prime;
    parProduit[ct.produit || 'Autre'] = (parProduit[ct.produit || 'Autre'] || 0) + prime;
    parCompagnie[ct.compagnie || 'Autre'] = (parCompagnie[ct.compagnie || 'Autre'] || 0) + prime;
    const compClients = parCompagnieClients[ct.compagnie || 'Autre'] || (parCompagnieClients[ct.compagnie || 'Autre'] = {});
    compClients[ct.client_id] = (compClients[ct.client_id] || 0) + prime;
  });

  function topDetail(obj, segTotal, max) {
    return Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, max || 5).map(([label, val]) => ({
      label, val, pct: segTotal > 0 ? Math.round(val/segTotal*100) : 0,
    }));
  }
  function detailHtml(obj, segTotal, color) {
    const items = topDetail(obj, segTotal);
    if (!items.length) return '';
    return `<div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px">
      ${items.map(it => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:11px;margin-bottom:5px">
          <div style="color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%">${it.label}</div>
          <div style="color:${color};font-weight:700;white-space:nowrap">${Math.round(it.val).toLocaleString('fr-CH')} CHF · ${it.pct}%</div>
        </div>`).join('')}
    </div>`;
  }

  const total = totalVie + totalNonVie;

  // Trier catégories par volume décroissant
  const categories = Object.entries(parCategorie).sort((a,b) => b[1]-a[1]);
  const topProduits = Object.entries(parProduit).sort((a,b) => b[1]-a[1]).slice(0, 10);

  function pct(val) { return total > 0 ? Math.round(val / total * 100) : 0; }
  function chf(val) { return 'CHF ' + Math.round(val).toLocaleString('fr-CH'); }
  function bar(val, color, maxVal) {
    const w = maxVal > 0 ? Math.round(val / maxVal * 100) : 0;
    return `<div style="height:8px;border-radius:4px;background:var(--border);margin-top:6px;overflow:hidden">
      <div style="height:100%;width:${w}%;background:${color};border-radius:4px;transition:width 0.4s"></div></div>`;
  }

  const maxCat = categories.length > 0 ? categories[0][1] : 1;
  const PALETTE_CIE = ['#38bdf8','#f59e0b','#a78bfa','#4ade80','#f87171','#fb923c','#22d3ee','#e879f9','#64748b'];
  const compagnies = Object.entries(parCompagnie).sort((a,b) => b[1]-a[1]);
  window._volumePrimesParCompagnieClients = parCompagnieClients;
  const totalCompagnies = compagnies.reduce((s,[,v]) => s+v, 0) || 1;
  let cumulCie = 0;
  const Rcie = 70, Ccie = 2 * Math.PI * Rcie;
  const donutCompagnies = compagnies.map(([comp, val], i) => {
    const frac = val / totalCompagnies;
    const dash = frac * Ccie;
    const offset = cumulCie * Ccie;
    cumulCie += frac;
    return `<circle cx="90" cy="90" r="${Rcie}" fill="none" stroke="${PALETTE_CIE[i % PALETTE_CIE.length]}" stroke-width="22"
      stroke-dasharray="${dash.toFixed(1)} ${(Ccie-dash).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 90 90)"/>`;
  }).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Volume de primes</h2>
      <div style="font-size:13px;color:var(--text-muted)">Contrats actifs uniquement · ${(contrats||[]).filter(ct=>ct.prime_annuelle>0).length} contrats</div>
    </div>

    <!-- KPIs globaux -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px">
      ${[
        { label:'Total portefeuille', val:chf(total), color:'var(--accent)', sub:'' },
        { label:'Contrats actifs', val:(contrats||[]).length, color:'#64748b', sub:'avec prime' },
      ].map(k => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${k.label}</div>
          <div style="font-size:22px;font-weight:900;color:${k.color}">${k.val}</div>
          ${k.sub ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${k.sub}</div>` : ''}
        </div>`).join('')}
    </div>

    <!-- Répartition par compagnie -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:16px">Répartition par compagnie</div>
      <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        <svg width="180" height="180" viewBox="0 0 180 180" style="flex-shrink:0">${donutCompagnies}
          <text x="90" y="86" text-anchor="middle" font-size="18" font-weight="900" fill="#fff">${compagnies.length}</text>
          <text x="90" y="104" text-anchor="middle" font-size="9" fill="#94a3b8">compagnies</text>
        </svg>
        <div style="flex:1;min-width:200px">
          ${compagnies.map(([comp,val],i) => `
            <div data-compagnie="${comp}" onclick="afficherTopClientsCompagnie(this.dataset.compagnie)" style="display:flex;align-items:center;gap:8px;margin-bottom:9px;font-size:12.5px;cursor:pointer">
              <div style="width:10px;height:10px;border-radius:50%;background:${PALETTE_CIE[i % PALETTE_CIE.length]};flex-shrink:0"></div>
              <div style="color:var(--text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${comp}</div>
              <div style="color:var(--text-muted);font-weight:700;flex-shrink:0">${chf(val)} · ${Math.round(val/totalCompagnies*100)}%</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Meilleurs clients par compagnie -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div style="font-size:13px;font-weight:800;color:var(--text)">Meilleurs clients par compagnie</div>
        <select id="vp-compagnie-select" onchange="afficherTopClientsCompagnie(this.value)" style="background:var(--surface-alt);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12.5px;cursor:pointer">
          ${compagnies.map(([comp]) => `<option value="${comp}">${comp}</option>`).join('')}
        </select>
      </div>
      <div id="vp-top-clients-corps">${renderTopClientsCompagnie(compagnies.length ? compagnies[0][0] : null, parCompagnieClients, clientsMap)}</div>
    </div>

    <!-- VIE vs NON-VIE -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:var(--surface);border:2px solid rgba(167,139,250,0.3);border-radius:14px;padding:20px">
        <div style="font-size:11px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🫀 VIE & Prévoyance</div>
        <div style="font-size:26px;font-weight:900;color:#a78bfa">${chf(totalVie)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${pct(totalVie)}% du total</div>
        <div style="height:8px;border-radius:4px;background:var(--border);margin-top:12px;overflow:hidden">
          <div style="height:100%;width:${pct(totalVie)}%;background:#a78bfa;border-radius:4px"></div>
        </div>
        ${detailHtml(parCategorieVie, totalVie, '#a78bfa')}
      </div>
      <div style="background:var(--surface);border:2px solid rgba(56,189,248,0.3);border-radius:14px;padding:20px">
        <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🛡️ NON-VIE (IARD)</div>
        <div style="font-size:26px;font-weight:900;color:var(--accent)">${chf(totalNonVie)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${pct(totalNonVie)}% du total</div>
        <div style="height:8px;border-radius:4px;background:var(--border);margin-top:12px;overflow:hidden">
          <div style="height:100%;width:${pct(totalNonVie)}%;background:var(--accent);border-radius:4px"></div>
        </div>
        ${detailHtml(parCategorieNonVie, totalNonVie, 'var(--accent)')}
      </div>
    </div>

    <!-- PRIVÉ vs ENTREPRISE -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:var(--surface);border:2px solid rgba(74,222,128,0.3);border-radius:14px;padding:20px">
        <div style="font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">👤 Clients privés</div>
        <div style="font-size:26px;font-weight:900;color:#4ade80">${chf(totalPrive)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${pct(totalPrive)}% du total</div>
        <div style="height:8px;border-radius:4px;background:var(--border);margin-top:12px;overflow:hidden">
          <div style="height:100%;width:${pct(totalPrive)}%;background:#4ade80;border-radius:4px"></div>
        </div>
        ${detailHtml(parCategoriePrive, totalPrive, '#4ade80')}
      </div>
      <div style="background:var(--surface);border:2px solid rgba(245,158,11,0.3);border-radius:14px;padding:20px">
        <div style="font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🏢 Entreprises</div>
        <div style="font-size:26px;font-weight:900;color:#f59e0b">${chf(totalEntreprise)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${pct(totalEntreprise)}% du total</div>
        <div style="height:8px;border-radius:4px;background:var(--border);margin-top:12px;overflow:hidden">
          <div style="height:100%;width:${pct(totalEntreprise)}%;background:#f59e0b;border-radius:4px"></div>
        </div>
        ${detailHtml(parCategorieEntreprise, totalEntreprise, '#f59e0b')}
      </div>
    </div>

    <!-- Détail par catégorie -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:16px">Répartition par type de produit</div>
      ${categories.map(([cat, val]) => `
        <div data-produit="${cat}" onclick="rechercherContratsProduit(this.dataset.produit)" style="margin-bottom:14px;cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-size:13px;font-weight:700;color:var(--text);text-decoration:underline dotted">${cat}</div>
            <div style="font-size:13px;font-weight:800;color:var(--accent)">${chf(val)} <span style="font-size:11px;color:var(--text-muted);font-weight:400">(${pct(val)}%)</span></div>
          </div>
          ${bar(val, 'var(--accent)', maxCat)}
        </div>`).join('')}
    </div>

    <!-- Top 10 produits -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:16px">Top produits par volume</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="color:var(--text-muted);font-size:11px;text-transform:uppercase">
          <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">#</th>
          <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">Produit</th>
          <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Volume annuel</th>
          <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Part</th>
        </tr></thead>
        <tbody>${topProduits.map(([prod, val], i) => `
          <tr data-produit="${prod}" onclick="rechercherContratsProduit(this.dataset.produit)" style="border-bottom:1px solid var(--border);cursor:pointer">
            <td style="padding:10px;color:var(--text-muted);font-weight:700">${i+1}</td>
            <td style="padding:10px;color:var(--text);font-weight:600;text-decoration:underline dotted">${prod}</td>
            <td style="padding:10px;text-align:right;font-weight:800;color:#f59e0b">${chf(val)}</td>
            <td style="padding:10px;text-align:right;color:var(--text-muted)">${pct(val)}%</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}


// ═══ TOUS LES CONTRATS — vue filtrée ═══
// ═══ RÉSUMÉ CONTRAT — modale slide-in depuis Tous les contrats ═══
function showDetailContrat(contratId) {
  const ct = allContrats.find(x => x.id === contratId);
  if (!ct) return;
  const cl = allClients.find(c => c.id === ct.client_id);
  const nom = cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`) : '—';
  const agent = allAgents.find(a => a.id === ct.apporteur_id);
  const signataire = allAgents.find(a => a.role === 'signataire');
  const commission = allCommissionsAttente.find(ca => ca.contrat_id === contratId);

  // Supprimer une éventuelle modale précédente
  document.getElementById('modal-detail-contrat')?.remove();

  const primenMois = ct.prime_annuelle ? Math.round(ct.prime_annuelle / 12 * 100) / 100 : 0;

  const contenuHtml = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:0;width:100%;max-width:460px;overflow:hidden">

      <!-- Header coloré -->
      <div style="background:linear-gradient(135deg,var(--primary) 0%,#1e3a5f 100%);padding:20px 22px 16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${ct.compagnie || '—'}</div>
            <div style="font-size:17px;font-weight:800;color:#fff;line-height:1.2">${ct.produit || '—'}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px">👤 <span style="cursor:pointer;text-decoration:underline dotted" onclick="document.getElementById('modal-detail-contrat').remove(); showClient('${ct.client_id}')">${nom}</span></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:20px;font-weight:900;color:#f59e0b">CHF ${fmtCHF(Number(ct.prime_annuelle||0))}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.5)">/an · CHF ${fmtCHF(primenMois)}/mois</div>
            <div style="margin-top:6px">${badge(ct.statut==='annulé'?'❌ Annulé':ct.statut==='mandat_resilie'?'🚫 Mandat résilié':ct.statut, ct.statut==='actif'?'#4ade80':ct.statut==='mandat_resilie'?'#f87171':ct.statut==='résilié'?'#94a3b8':ct.statut==='annulé'?'#f87171':'#f59e0b')}</div>
          </div>
        </div>
      </div>

      <!-- Corps -->
      <div style="padding:18px 22px;display:flex;flex-direction:column;gap:12px">

        <!-- Infos clés -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:var(--surface-alt);border-radius:10px;padding:10px 14px">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Date de début</div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtDate(ct.date_debut)}</div>
          </div>
          <div style="background:var(--surface-alt);border-radius:10px;padding:10px 14px">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Échéance</div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtDate(ct.date_echeance)}</div>
          </div>
          <div style="background:var(--surface-alt);border-radius:10px;padding:10px 14px">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">N° de police</div>
            <div style="font-size:13px;font-weight:700;color:var(--text);font-family:monospace">${ct.numero_police || '—'}</div>
          </div>
          <div style="background:var(--surface-alt);border-radius:10px;padding:10px 14px">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Apporteur</div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">${agent ? agent.prenom + ' ' + agent.nom : (signataire ? signataire.prenom + ' ' + signataire.nom : '—')}</div>
          </div>
        </div>

        <!-- Commission -->
        ${commission ? `<div style="background:${commission.statut==='en_attente'?'rgba(245,158,11,0.08)':commission.statut==='annulé'?'rgba(248,113,113,0.08)':'rgba(74,222,128,0.08)'};border:1px solid ${commission.statut==='en_attente'?'rgba(245,158,11,0.2)':commission.statut==='annulé'?'rgba(248,113,113,0.2)':'rgba(74,222,128,0.2)'};border-radius:10px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Commission</div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">${commission.detail_calcul ? commission.detail_calcul.split('[')[0].trim() : '—'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:900;color:#f59e0b">CHF ${fmtCHF(Number(commission.montant_estime||0))}</div>
            <div>${badge(statutCommissionLabel(commission.statut), statutCommissionColor(commission.statut))}</div>
          </div>
        </div>` : `<div style="background:var(--surface-alt);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--text-muted)">${ct.commissionne === false ? '⚠️ Contrat non commissionné (hors convention)' : 'Aucune commission liée à ce contrat'}</div>`}

        <!-- Police PDF -->
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface-alt);border-radius:10px">
          <span style="font-size:13px;font-weight:700;color:var(--text)">Police PDF</span>
          ${ct.police_url
            ? `<button onclick="ouvrirPieceJointe('${ct.police_url}')" style="background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:7px;padding:5px 12px;font-size:12px;cursor:pointer;font-weight:700">📄 Ouvrir</button>`
            : `<label style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:5px 12px;font-size:12px;cursor:pointer;font-weight:700">📎 Joindre<input type="file" accept="application/pdf" onchange="uploadPolicePdf('${ct.id}', this); document.getElementById('modal-detail-contrat').remove();" style="display:none"/></label>`
          }
          <span style="font-size:11px;color:var(--text-muted)">${ct.police_nom || (ct.police_url ? '' : 'Aucune police jointe')}</span>
        </div>

        <!-- Modules -->
        ${ct.modules ? `<div style="font-size:11.5px;color:var(--text-muted);padding:0 2px">📋 <strong>Modules complémentaires :</strong> ${ct.modules}</div>` : ''}

        <!-- Actions -->
        <div style="display:flex;gap:8px;padding-top:4px">
          <button onclick="document.getElementById('modal-detail-contrat').remove(); showClient('${ct.client_id}')" style="flex:1;background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:9px;padding:10px;font-weight:700;font-size:12.5px;cursor:pointer">👤 Fiche client</button>
          <button onclick="document.getElementById('modal-detail-contrat').remove(); showEditContrat('${ct.id}', 'tous-contrats')" style="flex:1;background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:9px;padding:10px;font-weight:700;font-size:12.5px;cursor:pointer">✏️ Modifier</button>
          <button onclick="document.getElementById('modal-detail-contrat').remove()" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:9px;padding:10px 14px;font-weight:700;font-size:12.5px;cursor:pointer">✕</button>
        </div>

      </div>
    </div>`;

  const modal = creerModale('modal-detail-contrat', contenuHtml, { opacite: 0.55, padding: '16px', overflowY: false });
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

// ═══ Contrats sans aucune commission créée (filet de sécurité) ═══
function viewContratsOrphelinsCommission() {
  setTimeout(() => renderContratsOrphelins(), 0);
  const idsAvecCommissionTmp = new Set(allCommissionsAttente.map(ca => ca.contrat_id).filter(Boolean));
  const compagniesPresentes = [...new Set(
    allContrats
      .filter(ct => ct.commissionne !== false && !['résilié','annulé','mandat_resilie'].includes(ct.statut) && Number(ct.prime_annuelle||0) > 0 && !idsAvecCommissionTmp.has(ct.id))
      .map(ct => normaliserCompagnie(ct.compagnie)).filter(Boolean)
  )].sort();

  return `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--text)">Contrats sans commission créée</h2>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Ces contrats sont commissionnables mais n'ont aucune ligne de commission — utile pour préparer un rapport de contrôle par compagnie. Clique sur "+ Créer" pour générer la commission avec la formule standard selon le produit (LPP, LAMal, complémentaire, ou estimation générique).</div>
    <div style="margin-bottom:18px">
      <select class="form-select" id="orph-compagnie" style="max-width:260px" onchange="renderContratsOrphelins()">
        <option value="">Toutes compagnies (${compagniesPresentes.length})</option>
        ${compagniesPresentes.map(comp => `<option value="${comp}">${comp}</option>`).join('')}
      </select>
    </div>
    <div id="orph-table"></div>`;
}

function renderContratsOrphelins() {
  const compagnieFilter = document.getElementById('orph-compagnie')?.value || '';
  const idsAvecCommission = new Set(allCommissionsAttente.map(ca => ca.contrat_id).filter(Boolean));
  const orphelins = allContrats.filter(ct =>
    ct.commissionne !== false &&
    !['résilié', 'annulé', 'mandat_resilie'].includes(ct.statut) &&
    Number(ct.prime_annuelle || 0) > 0 &&
    !idsAvecCommission.has(ct.id) &&
    (!compagnieFilter || normaliserCompagnie(ct.compagnie) === compagnieFilter)
  );

  const cols = '1fr 130px 100px 100px 100px';
  const rows = orphelins.map(ct => {
    const cl = allClients.find(c => c.id === ct.client_id);
    const nom = cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`) : '—';
    return `<div class="table-row" style="grid-template-columns:${cols}">
      <div>
        <a href="?client=${ct.client_id}" style="font-size:13px;font-weight:700;color:var(--accent);cursor:pointer;text-decoration:underline dotted" onclick="return irVersClient(event, '${ct.client_id}')">${nom}</a>
        <div style="font-size:11px;color:var(--text-muted)">${ct.produit||''}</div>
      </div>
      <div style="font-size:12px;color:var(--text-muted)">${ct.compagnie||''}</div>
      <div style="font-weight:800;color:#f59e0b">CHF ${fmtCHF(Number(ct.prime_annuelle||0))}</div>
      <div>${badge(ct.statut, ct.statut==='actif'?'#4ade80':'#f59e0b')}</div>
      <div><button onclick="creerCommissionManquante('${ct.id}')" style="background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">+ Créer</button></div>
    </div>`;
  }).join('');

  document.getElementById('orph-table').innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}"><div>Client / Produit</div><div>Compagnie</div><div>Prime/an</div><div>Statut</div><div></div></div>
      ${rows || '<div class="table-empty">✅ Aucun contrat orphelin — tout est en ordre.</div>'}
    </div>`;
}

async function creerCommissionManquante(contratId) {
  const ct = allContrats.find(c => c.id === contratId);
  if (!ct) return;
  const cl = allClients.find(c => c.id === ct.client_id);
  const nomClient = cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`) : '';
  const produit = (ct.produit || '').toLowerCase();
  const prime = Number(ct.prime_annuelle || 0);

  let montant = 0, detail = '';
  if (produit.includes('lpp') || produit.includes('pilier')) {
    montant = prime < 2000 ? 0 : Math.round(prime * 1.20 * 0.063);
    detail = `COG Swiss Life SL1102 : prime ${prime} × 1.20 × 6.3% — créée depuis le filet de sécurité`;
  } else if (produit.includes('lamal')) {
    montant = 70;
    detail = 'LAMal : forfait CHF 70 — créée depuis le filet de sécurité';
  } else if (produit.includes('complémentaire') || produit.includes('complementaire')) {
    montant = Math.round(prime / 12 * 16);
    detail = 'Complémentaire santé : prime mensuelle × 16 — créée depuis le filet de sécurité';
  } else {
    montant = Math.round(prime * 0.10);
    detail = 'Estimation 10% (à affiner selon compagnie) — créée depuis le filet de sécurité';
  }

  const r = await dbPost('commissions_attente', {
    client_id: ct.client_id,
    contrat_id: ct.id,
    client_nom: nomClient,
    compagnie: ct.compagnie,
    produit: ct.produit,
    montant_estime: montant,
    detail_calcul: detail,
    nature: 'acquisition',
    statut: 'en_attente',
    date_creation: new Date().toISOString().split('T')[0],
  });
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  logAction('creer_commission_manquante', 'commissions_attente', null, nomClient);
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  navigate('contrats-orphelins-commission');
}

function viewTousContrats() {
  const agentOptions = allAgents.map(a => `<option value="${a.id}">${a.prenom} ${a.nom}</option>`).join('');
  const compagnies = [...new Set(allContrats.map(c => c.compagnie).filter(Boolean))].sort();
  const compagnieOptions = compagnies.map(c => `<option value="${c}">${c}</option>`).join('');
  setTimeout(() => renderTousContrats(), 0);
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">Tous les contrats</h2>
      <div id="tc-count" style="font-size:12px;color:var(--text-muted)"></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <input class="form-input" id="tc-search" placeholder="🔍 Client, compagnie, produit, n° police..." style="flex:1;min-width:180px" oninput="renderTousContrats()"/>
      <select class="form-select" id="tc-agent" style="max-width:180px" onchange="renderTousContrats()">
        <option value="">Tous les agents</option>
        <option value="__sans__">— Sans apporteur (moi seul)</option>
        ${agentOptions}
      </select>
      <select class="form-select" id="tc-compagnie" style="max-width:160px" onchange="renderTousContrats()">
        <option value="">Toutes compagnies</option>${compagnieOptions}
      </select>
      <select class="form-select" id="tc-statut" style="max-width:140px" onchange="renderTousContrats()">
        <option value="">Tous statuts</option>
        <option value="actif">Actif</option>
        <option value="en_cours">En cours</option>
        <option value="résilié">Résilié</option>
        <option value="renouveler">À renouveler</option>
      </select>
      <select class="form-select" id="tc-comm" style="max-width:160px" onchange="renderTousContrats()">
        <option value="">Commissionné/Non</option>
        <option value="oui">Commissionné</option>
        <option value="non">Non commissionné</option>
      </select>
    </div>
    <div id="tc-stats" class="stat-grid" style="margin-bottom:16px"></div>
    <div id="tc-body"></div>`;
}

function renderTousContrats() {
  const search = (document.getElementById('tc-search')?.value || '').toLowerCase().trim();
  const agentF = document.getElementById('tc-agent')?.value || '';
  const compagnieF = document.getElementById('tc-compagnie')?.value || '';
  const statutF = document.getElementById('tc-statut')?.value || '';
  const commF = document.getElementById('tc-comm')?.value || '';

  const filtered = allContrats.filter(ct => {
    if (agentF === '__sans__' && ct.apporteur_id) return false;
    if (agentF && agentF !== '__sans__' && ct.apporteur_id !== agentF) return false;
    if (compagnieF && ct.compagnie !== compagnieF) return false;
    if (statutF && ct.statut !== statutF) return false;
    if (commF === 'oui' && ct.commissionne === false) return false;
    if (commF === 'non' && ct.commissionne !== false) return false;
    if (search) {
      const cl = allClients.find(c => c.id === ct.client_id);
      const nom = cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`) : '';
      const hay = `${nom} ${ct.compagnie||''} ${ct.produit||''} ${ct.numero_police||''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  }).sort((a,b) => new Date(b.date_debut||0) - new Date(a.date_debut||0));

  const totalPrimes = filtered.reduce((s,ct) => s + Number(ct.prime_annuelle||0), 0);
  const sanAgent = filtered.filter(ct => !ct.apporteur_id).length;

  document.getElementById('tc-count').textContent = `${filtered.length} contrat(s)`;
  document.getElementById('tc-stats').innerHTML = `
    ${statCard('Contrats', filtered.length, '#38bdf8')}
    ${statCard('Primes/an', 'CHF ' + Math.round(totalPrimes).toLocaleString(), '#f59e0b')}
    ${sanAgent > 0 ? statCard('Sans apporteur', sanAgent, '#64748b', 'toi seul') : ''}`;

  const cols = '1fr 110px 110px 100px 90px 70px 36px';
  const rows = filtered.map(ct => {
    const cl = allClients.find(c => c.id === ct.client_id);
    const nom = cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom} ${cl.nom}`) : '—';
    const agent = allAgents.find(a => a.id === ct.apporteur_id);
    return `<div class="table-row" style="grid-template-columns:${cols};cursor:pointer" onclick="showDetailContrat('${ct.id}')">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${nom}${getClientMiniLogos(cl)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${ct.produit||''} · ${ct.numero_police ? '№ '+ct.numero_police : 'sans n° police'}</div>
      </div>
      <div style="font-size:12px;color:var(--text-muted)">${ct.compagnie||'—'}</div>
      <div style="font-size:12px;color:var(--text-muted)">${fmtDate(ct.date_debut)}</div>
      <div style="font-weight:800;color:#f59e0b;text-align:right">CHF ${fmtCHF(Number(ct.prime_annuelle||0))}</div>
      <div>${badge(ct.statut==='annulé'?'❌ Annulé':ct.statut==='mandat_resilie'?'🚫 Mandat résilié':ct.statut, ct.statut==='actif'?'#4ade80':ct.statut==='mandat_resilie'?'#f87171':ct.statut==='résilié'?'#94a3b8':ct.statut==='annulé'?'#f87171':'#f59e0b')}</div>
      <div style="font-size:11px;color:var(--text-muted)">${(() => {
        if (agent) return agent.prenom + ' ' + agent.nom;
        const sig = allAgents.find(a => a.role === 'signataire');
        return sig ? '<span style="color:var(--text-muted)">' + sig.prenom + ' ' + sig.nom + '</span>' : '—';
      })()}</div>
      <div onclick="event.stopPropagation()"><button onclick="showEditContrat('${ct.id}', 'tous-contrats')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:4px 7px;font-size:12px;cursor:pointer">✏️</button></div>
    </div>`;
  }).join('');

  document.getElementById('tc-body').innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}">
        <div>Client / Produit</div><div>Compagnie</div><div>Date signature</div><div>Prime/an</div><div>Statut</div><div>Signataire / Apporteur</div><div></div>
      </div>
      ${rows || '<div class="table-empty">Aucun contrat ne correspond aux filtres.</div>'}
    </div>`;
}

function viewPortefeuille(filtre) {
  const titre = filtre === 'prive' ? 'Clients privés' : filtre === 'entreprise' ? 'Entreprises' : 'Portefeuille complet';
  const agentOptions = allAgents.map(a => `<option value="${a.id}">${a.prenom} ${a.nom}</option>`).join('');

  setTimeout(() => renderPortefeuilleTable(filtre), 0);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)" id="pf-titre">${titre}</h2>
      <button class="btn-add" onclick="navigate('nouveau-client')">+ Nouveau client</button>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
      <input class="form-input" id="pf-search" placeholder="🔍 Rechercher un nom, ville, email..." style="flex:1;min-width:200px" oninput="renderPortefeuilleTable('${filtre}')"/>
      <select class="form-select" id="pf-agent" style="max-width:200px" onchange="renderPortefeuilleTable('${filtre}')">
        <option value="">Tous les agents</option>
        <option value="__sans__">— Sans apporteur (moi seul)</option>
        ${agentOptions}
      </select>
      <select class="form-select" id="pf-statut" style="max-width:160px" onchange="renderPortefeuilleTable('${filtre}')">
        <option value="">Tous statuts</option>
        <option value="actif">Actif</option>
        <option value="prospect">Prospect</option>
        <option value="inactif">Inactif</option>
      </select>
      <select class="form-select" id="pf-entite" style="max-width:180px" onchange="renderPortefeuilleTable('${filtre}')">
        <option value="">Toutes entités</option>
        <option value="oz">${OZ_MINI_LOGO} Clients OZ Assure</option>
        <option value="assurex">${COFIDEX_MINI_LOGO} Clients Assurex / EX Groupe</option>
      </select>
    </div>
    <div id="pf-stats" class="stat-grid" style="margin-bottom:20px"></div>
    <div id="pf-table-container"></div>`;
}

function renderPortefeuilleTable(filtre) {
  const base = filtre === 'tous' ? allClients :
    filtre === 'prive' ? allClients.filter(c => !estEntreprise(c)) :
    filtre === 'entreprise' ? allClients.filter(c => estEntreprise(c)) :
    filtre === 'oz' ? allClients.filter(c => c.source_oz) :
    filtre === 'cofidex' ? allClients.filter(c => c.source_cofidex) :
    allClients;

  const search = (document.getElementById('pf-search')?.value || '').toLowerCase().trim();
  const agentFilter = document.getElementById('pf-agent')?.value || '';
  const sansAgent = agentFilter === '__sans__';
  const statutFilter = document.getElementById('pf-statut')?.value || '';
  const entiteFilter = document.getElementById('pf-entite')?.value || '';

  const filtered = base.filter(c => {
    if (sansAgent && c.apporteur_id) return false;
    if (agentFilter && agentFilter !== '__sans__' && c.apporteur_id !== agentFilter) return false;
    if (statutFilter && c.statut !== statutFilter) return false;
    if (entiteFilter === 'oz' && !c.source_oz) return false;
    if (entiteFilter === 'assurex' && !c.source_cofidex && c.source_oz) return false;
    if (search) {
      const haystack = `${estEntreprise(c) ? '' : (c.prenom||'')} ${c.nom||''} ${c.ville||''} ${c.email||''} ${c.profession||''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const totalCA = filtered.reduce((s,c) => s + caClient(c.id), 0);
  const actifs = filtered.filter(c => c.statut === 'actif').length;
  const prospects = filtered.filter(c => c.statut === 'prospect').length;

  // Plus récent en premier — les clients sans date de création (anciens, avant migration) passent en dernier
  filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  document.getElementById('pf-titre').textContent = `${filtre === 'prive' ? 'Clients privés' : filtre === 'entreprise' ? 'Entreprises' : 'Portefeuille complet'} (${filtered.length})`;
  document.getElementById('pf-stats').innerHTML = `
    ${statCard('Total', filtered.length, '#e2e8f0')}
    ${statCard('Actifs', actifs, '#4ade80')}
    ${statCard('Prospects', prospects, '#f59e0b')}
    ${statCard('CA total', 'CHF ' + totalCA.toLocaleString(), '#38bdf8')}`;

  const cols = '1fr 140px 85px 90px 100px 55px';
  const rows = filtered.map(c => {
    const agent = agentById(c.apporteur_id);
    const ca = caClient(c.id);
    return `<a href="?client=${c.id}" class="table-row" style="grid-template-columns:${cols};text-decoration:none;color:inherit" onclick="return irVersClient(event, '${c.id}')">
      <div>
        <div style="font-weight:700;font-size:13px;color:var(--text)">${estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`}${getClientMiniLogos(c)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${c.npa || ''} ${c.ville || ''} · ${c.profession || ''}</div>
      </div>
      <div><div style="font-size:11px;color:var(--text)">${c.email || ''}</div><div style="font-size:11px;color:var(--text-muted)">${c.mobile || ''}</div></div>
      <div>${badge(c.statut || '—', statutColor(c.statut))}</div>
      <div>${badge(c.segment || 'Privé', estEntreprise(c) ? '#f59e0b' : '#38bdf8')}</div>
      <div style="font-size:12px;font-weight:700;color:#f59e0b">${ca ? 'CHF ' + ca.toLocaleString() : '—'}</div>
      <div>${agent ? avatar(agent, 26) : ''}</div>
    </a>`;
  }).join('') || '<div class="table-empty">Aucun client ne correspond à ces filtres.</div>';

  document.getElementById('pf-table-container').innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}">
        <div>Client</div><div>Contact</div><div>Statut</div><div>Segment</div><div>CA annuel</div><div>Agent</div>
      </div>
      ${rows}
    </div>`;
}

// CLIENTS
function renderClientsTable() {
  const search = (document.getElementById('cl-search')?.value || '').toLowerCase().trim();
  const agentFilter = document.getElementById('cl-agent')?.value || '';
  const statutFilter = document.getElementById('cl-statut')?.value || '';
  const segmentFilter = document.getElementById('cl-segment')?.value || '';

  const filtered = allClients.filter(c => {
    if (sansAgent && c.apporteur_id) return false;
    if (agentFilter && agentFilter !== '__sans__' && c.apporteur_id !== agentFilter) return false;
    if (statutFilter && c.statut !== statutFilter) return false;
    if (segmentFilter && (c.segment || 'Privé') !== segmentFilter) return false;
    if (search) {
      const haystack = `${estEntreprise(c) ? '' : (c.prenom||'')} ${c.nom||''} ${c.ville||''} ${c.email||''} ${c.profession||''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  document.getElementById('cl-titre').textContent = `Clients (${filtered.length})`;

  const cols = '1fr 160px 85px 90px 55px';
  let rows = filtered.map(c => {
    const agent = agentById(c.apporteur_id);
    return `<a href="?client=${c.id}" class="table-row" style="grid-template-columns:${cols};text-decoration:none;color:inherit" onclick="return irVersClient(event, '${c.id}')">
      <div><div style="font-weight:700;font-size:13px;color:var(--text)">${estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`}</div><div style="font-size:11px;color:var(--text-muted)">${c.npa || ''} ${c.ville || ''} · ${c.profession || ''}</div></div>
      <div><div style="font-size:11px;color:var(--text)">${c.email || ''}</div><div style="font-size:11px;color:var(--text-muted)">${c.mobile || ''}</div></div>
      <div>${badge(c.statut || '—', statutColor(c.statut))}</div>
      <div style="font-size:12px;color:var(--text-muted)">${c.segment || '—'}</div>
      <div>${agent ? avatar(agent, 26) : ''}</div>
    </a>`;
  }).join('') || '<div class="table-empty">Aucun client ne correspond à ces filtres.</div>';

  document.getElementById('cl-table-container').innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="grid-template-columns:${cols}">
        <div>Client</div><div>Contact</div><div>Statut</div><div>Segment</div><div>Agent</div>
      </div>
      ${rows}
    </div>`;
}

// FICHE CLIENT
// Vue d'ensemble rapide des couvertures clés pour un client entreprise — CCT, LAA, LPP, PGM.
// Volontairement sommaire (juste "couvert / non couvert"), sans entrer dans le détail des contrats.
// Vue d'ensemble des couvertures pour un client — un encadré listant TOUTES les catégories de contrats
// pertinentes pour son segment (privé ou entreprise), avec ✅/❌ selon qu'un contrat actif existe ou non.
// S'adapte automatiquement : un privé voit RC privée/Ménage/Véhicule/Prévoyance/Santé..., une entreprise
// voit RC entreprise/LAA/LPP collective/PGM/Bâtiment commercial..., sans avoir à ouvrir chaque contrat.
function renderVueEnsembleCouvertures(client, contrats, isEntreprise) {
  const segment = isEntreprise ? 'entreprise' : 'prive';
  const categories = getCategoriesPourSegment(segment).filter(cat => cat !== 'Autre');
  const contratsActifs = contrats.filter(ct => !['résilié','annulé','mandat_resilie'].includes(ct.statut));

  const contratPourCategorie = (cat) => {
    const labelsCategorie = (CATALOGUE_PRODUITS[cat] || []).map(p => p.label.toLowerCase());
    return contratsActifs.find(ct => ct.produit && labelsCategorie.includes(ct.produit.trim().toLowerCase()));
  };

  const items = categories.map(cat => {
    const trouve = contratPourCategorie(cat);
    return { label: cat, ok: !!trouve, detail: trouve ? trouve.produit : null };
  });

  const ligne = (label, ok, detail) => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 6px;border-bottom:1px solid var(--border)">
      <span style="font-size:14px;width:18px;text-align:center;flex-shrink:0;margin-top:1px">${ok ? '✅' : '❌'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:700;color:var(--text)">${label}</div>
        ${detail ? `<div style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${detail}</div>` : ''}
      </div>
    </div>`;

  const cctLigne = isEntreprise ? `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 6px;margin-top:2px;border-top:1px solid var(--border)">
      <span style="font-size:14px;width:18px;text-align:center;flex-shrink:0">${client.cct ? '✓' : '—'}</span>
      <div style="font-size:12.5px;font-weight:700;color:var(--text)">Soumis à une CCT</div>
    </div>` : '';

  return `
    <div style="background:var(--surface-alt);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:8px">Couvertures — vue d'ensemble</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
        ${items.map(i => ligne(i.label, i.ok, i.detail)).join('')}
      </div>
      ${cctLigne}
    </div>`;
}

// ═══ SUIVI FINANCIER — pilotage des paiements de commissions (prévu vs réel) ═══
function viewSuiviFinancier() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const joursEntre = (d1, d2) => Math.round((new Date(d2) - new Date(d1)) / 86400000);

  const enAttente = allCommissionsAttente.filter(ca => ca.statut === 'en_attente');
  const totalEnAttente = enAttente.reduce((s, ca) => s + Number(ca.montant_estime || 0), 0);

  const payees = allCommissionsAttente.filter(ca => ca.statut === 'reçue' || ca.statut === 'versé_oz');
  const totalRecu = payees.reduce((s, ca) => s + Number(ca.montant_final || ca.montant_estime || 0), 0);

  // Délai réel de paiement : uniquement calculable sur les dossiers dont la date de réception a été
  // capturée (import de décompte rapproché) — la plupart des lignes "versé_oz" historiques (bascule du
  // 01.06.2026) n'ont pas de date de réception précise, seulement un statut. Ce chiffre s'affinera avec
  // le temps à mesure que les décomptes compagnies sont importés et rapprochés.
  const avecDelai = allCommissionsAttente.filter(ca => ca.date_creation && ca.date_reception);
  const delais = avecDelai.map(ca => joursEntre(ca.date_creation, ca.date_reception)).filter(j => j >= 0);
  const delaiMoyen = delais.length ? Math.round(delais.reduce((s, j) => s + j, 0) / delais.length) : null;

  const SEUIL_RETARD = 45;
  const enRetard = enAttente
    .filter(ca => ca.date_creation && joursEntre(ca.date_creation, todayStr) > SEUIL_RETARD)
    .sort((a, b) => a.date_creation.localeCompare(b.date_creation));
  const totalEnRetard = enRetard.reduce((s, ca) => s + Number(ca.montant_estime || 0), 0);

  // ── Chart 1 : pipeline créé par mois (date_creation = quand le dossier est entré en attente) ──
  const moisListe = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    moisListe.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' }) });
  }
  const dataMois = moisListe.map(m => {
    const prevu = allCommissionsAttente.filter(ca => (ca.date_creation || '').slice(0, 7) === m.key).reduce((s, ca) => s + Number(ca.montant_estime || 0), 0);
    const recu = allCommissionsAttente.filter(ca => (ca.date_reception || '').slice(0, 7) === m.key).reduce((s, ca) => s + Number(ca.montant_final || ca.montant_estime || 0), 0);
    return { ...m, prevu, recu };
  });
  const maxMois = Math.max(...dataMois.map(m => Math.max(m.prevu, m.recu)), 1);

  // ── Chart 2 : ancienneté des dossiers en attente (0-30 / 30-60 / 60-90 / +90 jours) ──
  const buckets = [
    { label: '0-30j', test: j => j <= 30, color: '#4ade80' },
    { label: '30-60j', test: j => j > 30 && j <= 60, color: '#f59e0b' },
    { label: '60-90j', test: j => j > 60 && j <= 90, color: '#fb923c' },
    { label: '+90j', test: j => j > 90, color: '#f87171' },
  ];
  const bucketsData = buckets.map(b => {
    const liste = enAttente.filter(ca => ca.date_creation && b.test(joursEntre(ca.date_creation, todayStr)));
    return { ...b, nb: liste.length, montant: liste.reduce((s, ca) => s + Number(ca.montant_estime || 0), 0) };
  });
  const maxBucket = Math.max(...bucketsData.map(b => b.montant), 1);

  // ── Chart 3 : répartition des commissions en attente par compagnie (top 8) ──
  const parCompagnie = {};
  enAttente.forEach(ca => {
    const nom = ca.compagnie || '—';
    parCompagnie[nom] = (parCompagnie[nom] || 0) + Number(ca.montant_estime || 0);
  });
  const compagniesData = Object.entries(parCompagnie).map(([nom, montant]) => ({ nom, montant })).sort((a, b) => b.montant - a.montant).slice(0, 8);
  const maxCompagnie = Math.max(...compagniesData.map(c => c.montant), 1);
  const paletteCompagnies = ['#38bdf8', '#f59e0b', '#4ade80', '#a78bfa', '#f87171', '#fb923c', '#22d3ee', '#e879f9'];

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">💰 Suivi financier — Pilotage</h2>
      <button onclick="navigate('suivi-financier')" title="Recharger" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:9px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">🔄 Actualiser</button>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">Vue prévu vs réel des paiements de commission, pour piloter la trésorerie au jour le jour.</div>

    <div class="stat-grid" style="margin-bottom:20px">
      ${statCard('En attente', 'CHF ' + Math.round(totalEnAttente).toLocaleString(), '#f59e0b', `${enAttente.length} dossier(s)`)}
      ${statCard('Reçu (cumulé)', 'CHF ' + Math.round(totalRecu).toLocaleString(), '#4ade80', `${payees.length} dossier(s)`)}
      ${statCard('Délai moyen de paiement', delaiMoyen !== null ? delaiMoyen + ' j' : '—', '#38bdf8', delais.length ? `basé sur ${delais.length} dossier(s)` : 'pas encore assez de données')}
      ${statCard('En retard (+' + SEUIL_RETARD + 'j)', enRetard.length, enRetard.length > 0 ? '#f87171' : '#64748b', 'CHF ' + Math.round(totalEnRetard).toLocaleString())}
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px">📈 Pipeline créé vs commissions reçues, par mois</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:18px">Barres claires = montant entré dans le pipeline ce mois-là (prévu). Barres pleines = montant dont la date de réception réelle est connue ce mois-là. La majorité des paiements historiques ("versé_oz") n'ont pas encore de date de réception précise — ce graphique se remplira automatiquement au fil des décomptes compagnie importés et rapprochés.</div>
      <div style="display:flex;align-items:flex-end;gap:10px;height:140px;margin-bottom:8px">
        ${dataMois.map(m => {
          const hPrevu = Math.max(Math.round(m.prevu / maxMois * 110), m.prevu > 0 ? 4 : 1);
          const hRecu = Math.max(Math.round(m.recu / maxMois * 110), m.recu > 0 ? 4 : 1);
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
            <div style="display:flex;align-items:flex-end;gap:3px;height:100%">
              <div title="Prévu : CHF ${fmtCHF(Math.round(m.prevu))}" style="width:12px;height:${hPrevu}px;background:rgba(56,189,248,0.25);border:1px solid #38bdf8;border-radius:3px 3px 0 0"></div>
              <div title="Reçu : CHF ${fmtCHF(Math.round(m.recu))}" style="width:12px;height:${hRecu}px;background:#4ade80;border-radius:3px 3px 0 0"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:10px">
        ${dataMois.map(m => `<div style="flex:1;text-align:center;font-size:10px;color:var(--text-muted)">${m.label}</div>`).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:14px">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted)"><div style="width:10px;height:10px;border-radius:2px;background:rgba(56,189,248,0.25);border:1px solid #38bdf8"></div>Prévu</div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted)"><div style="width:10px;height:10px;border-radius:2px;background:#4ade80"></div>Reçu (date connue)</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px">⏳ Ancienneté des dossiers en attente</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:18px">Depuis combien de temps chaque dossier attend son paiement</div>
        <div style="display:flex;align-items:flex-end;gap:14px;height:110px;margin-bottom:6px">
          ${bucketsData.map(b => {
            const h = Math.max(Math.round(b.montant / maxBucket * 90), b.montant > 0 ? 6 : 2);
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
              <div style="font-size:10px;font-weight:800;color:${b.color};margin-bottom:4px">${b.montant > 0 ? Math.round(b.montant/1000) + 'k' : '—'}</div>
              <div style="width:100%;max-width:44px;height:${h}px;background:${b.color};border-radius:5px 5px 2px 2px;opacity:${b.nb>0?1:0.25}"></div>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:14px">
          ${bucketsData.map(b => `<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text-muted)">${b.label}</div><div style="font-size:10px;color:var(--text-dim)">${b.nb}</div></div>`).join('')}
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px">🏢 En attente par compagnie</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:18px">Où sont concentrés les montants en attente</div>
        ${compagniesData.map((c, i) => `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px">
              <span style="color:var(--text);font-weight:700">${c.nom}</span>
              <span style="color:var(--text-muted)">CHF ${fmtCHF(Math.round(c.montant))}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(c.montant/maxCompagnie*100)}%;background:${paletteCompagnies[i % paletteCompagnies.length]}"></div></div>
          </div>`).join('')}
      </div>
    </div>

    ${enRetard.length > 0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:#f87171;margin-bottom:14px">🚨 Dossiers en retard de plus de ${SEUIL_RETARD} jours (${enRetard.length})</div>
      <div class="table-wrap">
        <div class="table-header" style="grid-template-columns:1fr 130px 100px 90px 90px"><div>Client</div><div>Compagnie</div><div>Depuis le</div><div>Jours</div><div>Montant</div></div>
        ${enRetard.map(ca => `<div class="table-row" style="grid-template-columns:1fr 130px 100px 90px 90px">
          <div style="font-weight:700;font-size:13px;color:var(--text)">${ca.client_nom || '—'}</div>
          <div style="font-size:12px;color:var(--text-muted)">${ca.compagnie || '—'}</div>
          <div style="font-size:12px;color:var(--text-muted)">${fmtDate(ca.date_creation)}</div>
          <div style="font-size:12px;font-weight:700;color:#f87171">${joursEntre(ca.date_creation, todayStr)} j</div>
          <div style="font-size:12px;font-weight:700;color:#f59e0b">CHF ${fmtCHF(Math.round(ca.montant_estime||0))}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <div style="background:var(--surface-alt);border:1px solid var(--border);border-radius:14px;padding:22px">
      <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px">💡 Idées de pilotage supplémentaires (chantier à développer)</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.9">
        • <strong style="color:var(--text)">Fiabiliser les dates de paiement réelles</strong> — les 140 lignes "versé_oz" historiques n'ont pas de date de réception précise (import en bloc lors de la bascule du 01.06.2026). Chaque décompte compagnie importé et rapproché capture désormais cette date automatiquement : le graphique prévu/reçu et le délai moyen s'affineront tout seuls avec le temps.<br/>
        • <strong style="color:var(--text)">Délai moyen par compagnie</strong> — une fois assez de décomptes rapprochés, un graphique dédié pourra montrer quelles compagnies paient vite ou lentement, pour prioriser les relances.<br/>
        • <strong style="color:var(--text)">Objectif de trésorerie mensuel</strong> — définir une cible CHF/mois et afficher une barre de progression (réalisé vs objectif) en temps réel.<br/>
        • <strong style="color:var(--text)">Alerte de retard anormal</strong> — signaler automatiquement un dossier qui dépasse le délai moyen habituel de sa compagnie, plutôt qu'un seuil fixe unique.<br/>
        • <strong style="color:var(--text)">Prévision de trésorerie à 30/60/90 jours</strong> — projeter les encaissements attendus en pondérant le montant en attente par un taux de recouvrement historique par compagnie.<br/>
        • <strong style="color:var(--text)">Taux de perte</strong> — suivre le % de dossiers qui passent en "annulé" avant paiement, par compagnie et par produit, pour détecter un problème récurrent.<br/>
        • <strong style="color:var(--text)">Export mensuel</strong> — packet PDF/Excel de ce pilotage, prêt à transmettre au comptable ou à Assurex.
      </div>
    </div>`;
}
