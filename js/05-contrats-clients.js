async function showClient(id) {
  // Empile où on était avant d'ouvrir cette fiche, pour que la flèche retour y ramène précisément
  const etatPrecedent = capturerEtatActuel();
  if (!(etatPrecedent.type === 'client' && etatPrecedent.id === id)) navHistory.push(etatPrecedent);
  vueDetailActive = { type: 'client', id };
  currentClientId = id;
  currentView = 'fiche-client';
  renderSidebar();
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loader">Chargement...</div>';
  const [clients, contrats, rappels, collaborateurs, factures, postits, bilansPrevoyance] = await Promise.all([
    dbGet('clients', `id=eq.${id}&select=*`),
    dbGet('contrats', `client_id=eq.${id}&select=*`),
    dbGet('rappels', `client_id=eq.${id}&select=*`),
    dbGet('collaborateurs', `client_id=eq.${id}&select=*&order=nom.asc`),
    dbGet('factures', `client_id=eq.${id}&select=*&order=date_emission.desc`),
    dbGet('postits', `client_id=eq.${id}&select=*&order=created_at.asc`),
    getBilansPrevoyanceClient(id),
  ]);
  const c = clients[0];
  if (!c) { main.innerHTML = '<div class="loader">Client introuvable.</div>'; return; }
  window._bilansPrevoyanceActuel = bilansPrevoyance;
  logAction('view_client', 'clients', id, estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`);
  const agent = agentById(c.apporteur_id);
  const color = agentColor(agent);

  const isEntreprise = estEntreprise(c);
  const displayName = isEntreprise ? c.nom : `${c.prenom} ${c.nom}`;
  const displaySub = isEntreprise
    ? `${c.profession || 'Entreprise'}${c.prenom ? ' · Contact: ' + c.prenom : ''}`
    : `${c.profession || ''}${c.employeur ? ' · ' + c.employeur : ''}`;
  const headerIcon = isEntreprise
    ? `<div style="width:52px;height:52px;border-radius:14px;background:rgba(245,158,11,0.12);border:2px solid rgba(245,158,11,0.35);display:flex;align-items:center;justify-content:center;font-size:24px">🏢</div>`
    : `<div style="width:52px;height:52px;border-radius:50%;background:var(--accent-dim);border:2px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:var(--accent)">${(c.prenom||'?')[0]}${(c.nom||'?')[0]}</div>`;

  main.innerHTML = `
    <div class="print-header" style="display:none">
      <div style="display:flex;justify-content:flex-start;align-items:center;border-bottom:2px solid #7dd3fc;padding-bottom:10px;margin-bottom:18px">
        <img src="data:image/png;base64,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" alt="Assurex" style="height:36px"/>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:16px">
      <div style="display:flex;gap:10px">
        <button onclick="toggleEditClient()" style="background:${editingClient ? 'var(--red-dim)' : 'var(--surface)'};border:1px solid ${editingClient ? 'rgba(248,113,113,0.3)' : 'var(--border)'};border-radius:8px;padding:7px 16px;color:${editingClient ? 'var(--red)' : 'var(--text-muted)'};font-size:12px;font-weight:700;cursor:pointer">${editingClient ? '✕ Annuler' : '✏️ Modifier'}</button>
        <button onclick="ouvrirSignatureMandat('${c.id}')" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">📄 Mandat de courtage</button>
        <button onclick="window.print()" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">🖨️ Imprimer la fiche</button>
      </div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:22px;margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div style="display:flex;gap:14px;align-items:center">
          ${headerIcon}
          <div>
            <h2 style="margin:0;font-size:20px;font-weight:900;color:var(--text)">${displayName}</h2>
            <div style="color:var(--text-muted);font-size:12px;margin-top:2px">${displaySub}</div>
            <div style="color:var(--text-muted);font-size:12px">${c.adresse || ''} ${c.npa || ''} ${c.ville || ''}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${badge(c.segment || 'Privé', isEntreprise ? '#f59e0b' : '#38bdf8')} ${badge(c.statut || 'prospect', statutColor(c.statut))}
          <div style="display:flex;gap:4px;margin-left:6px">
            ${c.statut !== 'prospect' ? `<button onclick="changerStatutClient('${c.id}','prospect')" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:6px;padding:3px 9px;font-size:10.5px;cursor:pointer;font-weight:700">→ Prospect</button>` : ''}
            ${c.statut !== 'actif' ? `<button onclick="changerStatutClient('${c.id}','actif')" style="background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:6px;padding:3px 9px;font-size:10.5px;cursor:pointer;font-weight:700">✓ Client actif</button>` : ''}
            ${c.statut !== 'inactif' ? `<button onclick="changerStatutClient('${c.id}','inactif')" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:6px;padding:3px 9px;font-size:10.5px;cursor:pointer;font-weight:700">Inactif</button>` : ''}
          </div>
        </div>
      </div>
      <div class="stat-grid" style="margin-bottom:16px">
        ${statCard('Contrats', contrats.length, '#38bdf8')}
        ${statCard('Rappels ouverts', rappels.filter(r => r.statut === 'ouvert').length, rappels.filter(r => r.statut === 'ouvert').length > 0 ? '#f87171' : '#64748b')}
        ${statCard('CA annuel', caClient(c.id) ? 'CHF ' + caClient(c.id).toLocaleString() : '—', '#f59e0b')}
      </div>
      ${renderVueEnsembleCouvertures(c, contrats, isEntreprise)}
      ${(() => { const signataire = allAgents.find(a => a.role === 'signataire'); return signataire ? `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--surface-alt);border-radius:10px;margin-bottom:8px">
        ${avatar(signataire, 32)}
        <div>
          <div style="font-size:12.5px;font-weight:700;color:var(--text)">${signataire.prenom} ${signataire.nom}</div>
          <div style="font-size:10.5px;color:var(--text-muted)">👤 Agent signataire — toujours responsable, touche systématiquement sa part</div>
        </div>
        <button onclick="toggleSourceOz('${c.id}', ${!c.source_oz})" title="${c.source_oz ? 'Client OZ Assure — cliquer pour retirer' : 'Marquer comme client OZ Assure'}" style="margin-left:auto;background:${c.source_oz ? 'rgba(74,144,226,0.15)' : 'var(--surface-alt)'};border:1px solid ${c.source_oz ? 'rgba(74,144,226,0.4)' : 'var(--border)'};border-radius:7px;padding:4px 8px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:10.5px;color:${c.source_oz ? '#4a90e2' : 'var(--text-muted)'};font-weight:700">${c.source_oz ? OZASSURE_LOGO_SVG.replace('class="oz-logo-svg"', 'style="height:18px;width:auto"') + ' Client OZ' : '+ Marquer OZ'}</button>
        <button onclick="toggleSourceCofidex('${c.id}', ${!c.source_cofidex})" title="${c.source_cofidex ? 'Client EX Groupe — cliquer pour retirer' : 'Marquer comme client Cofidex / EX Groupe'}" style="background:${c.source_cofidex ? 'rgba(0,207,255,0.12)' : 'var(--surface-alt)'};border:1px solid ${c.source_cofidex ? 'rgba(0,207,255,0.4)' : 'var(--border)'};border-radius:7px;padding:4px 8px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:10.5px;color:${c.source_cofidex ? '#00cfff' : 'var(--text-muted)'};font-weight:700">${c.source_cofidex ? COFIDEX_MINI_LOGO + ' Client EX' : '+ Marquer EX'}</button>
      </div>` : ''; })()}
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;margin-bottom:${c.apporteur_externe ? '8px' : '0'}">
        ${agent ? avatar(agent, 36) : `<div style="width:36px;height:36px;border-radius:50%;background:rgba(148,163,184,0.15);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🤷</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Source du lead (apporteur interne)</div>
          <select onchange="changerAgentClient('${c.id}', this.value)" style="background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:5px 8px;color:var(--text);font-size:13px;font-weight:700;max-width:220px">
            <option value="">— Aucun / pas de partage —</option>
            ${allAgents.map(a => `<option value="${a.id}" ${c.apporteur_id === a.id ? 'selected' : ''}>${a.prenom} ${a.nom}${a.role === 'signataire' ? ' (moi-même)' : ''}</option>`).join('')}
          </select>
          <div style="font-size:9.5px;color:var(--text-muted);margin-top:3px">Détermine le partage de commission — n'affecte pas la responsabilité de la relation client</div>
        </div>
        ${agent && c.mobile ? `<a href="tel:${c.mobile}" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:5px 12px;font-size:11px;font-weight:700;text-decoration:none">📞</a>` : ''}
        ${agent && c.email ? `<a href="mailto:${c.email}" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:5px 12px;font-size:11px;font-weight:700;text-decoration:none">✉️</a>` : ''}
      </div>
      ${c.apporteur_externe ? `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--surface-alt);border-radius:10px">
        <div style="width:32px;height:32px;border-radius:50%;background:rgba(167,139,250,0.15);border:2px solid rgba(167,139,250,0.4);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#a78bfa;flex-shrink:0">${c.apporteur_externe.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
        <div>
          <div style="font-size:12.5px;font-weight:700;color:var(--text)">${c.apporteur_externe}</div>
          <div style="font-size:10.5px;color:var(--text-muted)">🤝 Origine du lead — recommandation externe</div>
        </div>
      </div>` : ''}
    </div>

    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;padding:6px 2px 14px">
      ${postits.map(p => `
        <div class="postit-note" style="background:${p.couleur || '#fde047'};transform:rotate(${p.rotation || 0}deg)">
          <button onclick="deletePostit('${p.id}','${c.id}')" class="postit-close">×</button>
          <textarea class="postit-text" onblur="savePostitContenu('${p.id}', this.value)" placeholder="Écris ici...">${p.contenu || ''}</textarea>
          <button onclick="convertirPostitEnRappel('${p.id}','${c.id}', this)" style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.12);border:none;border-radius:6px;padding:3px 7px;font-size:10px;font-weight:700;color:#1a1a1a;cursor:pointer">→ Tâche</button>
        </div>`).join('')}
      <button onclick="addPostit('${c.id}')" class="postit-add" title="Ajouter un post-it">📌 +</button>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(this,'tab-identite')">Identité</button>
      <button class="tab-btn" onclick="switchTab(this,'tab-prevoyance')">Prévoyance</button>
      ${isEntreprise ? `<button class="tab-btn" onclick="switchTab(this,'tab-collaborateurs')">Collaborateurs (${collaborateurs.length})</button>` : ''}
      ${isEntreprise ? `<button class="tab-btn" onclick="switchTab(this,'tab-flotte')">🚗 Flotte (${allVehicules.filter(v=>v.client_id===c.id).length})</button>` : ''}
      <button class="tab-btn" onclick="switchTab(this,'tab-contrats')">Contrats (${contrats.length})</button>
      <button class="tab-btn" onclick="switchTab(this,'tab-factures')">Factures (${factures.length})</button>
      <button class="tab-btn" onclick="switchTab(this,'tab-rappels')">Rappels (${rappels.length})</button>
      <button class="tab-btn" onclick="switchTab(this,'tab-notes')">Notes</button>
    </div>

    <div id="tab-identite">
      ${editingClient ? `
        ${sectionCard(isEntreprise ? 'Identification entreprise' : 'Coordonnées personnelles', isEntreprise ? '#f59e0b' : '#38bdf8', isEntreprise ? `<div class="form-grid">
          <div class="form-field"><label class="form-label">Raison sociale</label><div style="display:flex;gap:6px"><input id="ec-nom" class="form-input" value="${c.nom || ''}" style="flex:1"><button type="button" onclick="rechercheZefix('ec-nom')" title="Rechercher sur Zefix" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;padding:0 12px;color:var(--text-muted);cursor:pointer;font-size:14px">🔍</button></div></div>
          <div class="form-field"><label class="form-label">Secteur d'activité</label><input id="ec-profession" class="form-input" value="${c.profession || ''}"></div>
          <div class="form-field"><label class="form-label">Contact principal</label><input id="ec-prenom" class="form-input" value="${c.prenom || ''}"></div>
          <div class="form-field"><label class="form-label">Nb collaborateurs</label><input id="ec-taux-activite" type="number" class="form-input" value="${c.taux_activite || ''}"></div>
          <div class="form-field"><label class="form-label">Chiffre d'affaires</label><input id="ec-revenu" type="number" class="form-input" value="${c.revenu || ''}"></div>
          <div class="form-field"><label class="form-label">N° AVS (LPP)</label><input id="ec-avs" class="form-input" value="${c.avs || ''}"></div>
        </div>` : `<div class="form-grid">
          <div class="form-field"><label class="form-label">Prénom</label><input id="ec-prenom" class="form-input" value="${c.prenom || ''}"></div>
          <div class="form-field"><label class="form-label">Nom</label><input id="ec-nom" class="form-input" value="${c.nom || ''}"></div>
          <div class="form-field"><label class="form-label">Date de naissance</label><input id="ec-date-naissance" type="date" class="form-input" value="${c.date_naissance || ''}"></div>
          <div class="form-field"><label class="form-label">Nationalité</label><input id="ec-nationalite" class="form-input" value="${c.nationalite || ''}"></div>
          <div class="form-field"><label class="form-label">État civil</label>
            <select id="ec-etat-civil" class="form-input">
              <option value="">—</option>
              ${['Célibataire','Marié','Divorcé','Divorcée','Veuf','Veuve','Pacsé','Pacsée'].map(s => `<option ${c.etat_civil === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-field"><label class="form-label">Enfants</label><input id="ec-enfants" type="number" class="form-input" value="${c.enfants || 0}"></div>
          <div class="form-field"><label class="form-label">N° AVS</label><input id="ec-avs" class="form-input" value="${c.avs || ''}"></div>
          <div class="form-field"><label class="form-label">Langue</label>
            <select id="ec-langue" class="form-input">
              <option value="FR" ${c.langue === 'FR' ? 'selected' : ''}>Français</option>
              <option value="DE" ${c.langue === 'DE' ? 'selected' : ''}>Allemand</option>
              <option value="IT" ${c.langue === 'IT' ? 'selected' : ''}>Italien</option>
            </select>
          </div>
        </div>`)}
        ${sectionCard('Contact', '#f59e0b', `<div class="form-grid">
          <div class="form-field"><label class="form-label">Adresse</label><input id="ec-adresse" class="form-input" value="${c.adresse || ''}"></div>
          <div class="form-field"><label class="form-label">c/o (optionnel)</label><input id="ec-co" class="form-input" value="${c.co || ''}" placeholder="c/o Nom Prénom"></div>
          <div class="form-field"><label class="form-label">Mandat de courtage actif</label><select id="ec-mandat" class="form-select">
            <option value="oui" ${(!c.mandat || c.mandat==='oui')?'selected':''}>Oui</option>
            <option value="non" ${c.mandat==='non'?'selected':''}>Non</option>
            <option value="résilié" ${c.mandat==='résilié'?'selected':''}>Résilié</option>
          </select>
          ${c.mandat === 'résilié' ? `<div style="font-size:10.5px;color:#f87171;margin-top:4px">⚠️ Mandat résilié : tous les contrats de ce client sont exclus du volume de primes et du CA portefeuille.</div>` : ''}
          </div>
          <div class="form-field"><label class="form-label">NPA</label><input id="ec-npa" class="form-input" value="${c.npa || ''}"></div>
          <div class="form-field"><label class="form-label">Ville</label><input id="ec-ville" class="form-input" value="${c.ville || ''}"></div>
          <div class="form-field"><label class="form-label">Canton</label><input id="ec-canton" class="form-input" value="${c.canton || ''}"></div>
          <div class="form-field"><label class="form-label">Email</label><input id="ec-email" class="form-input" value="${c.email || ''}"></div>
          <div class="form-field"><label class="form-label">Téléphone fixe</label><input id="ec-tel" class="form-input" value="${c.tel || ''}"></div>
          <div class="form-field"><label class="form-label">Mobile</label><input id="ec-mobile" class="form-input" value="${c.mobile || ''}"></div>
          ${isEntreprise ? `<div class="form-field"><label class="form-label">Soumis à une CCT ?</label><select id="ec-cct" class="form-select"><option value="non" ${!c.cct ? 'selected' : ''}>Non</option><option value="oui" ${c.cct ? 'selected' : ''}>Oui</option></select></div>
          <div class="form-field"><label class="form-label">N° IDE (CHE)</label><input id="ec-ide" class="form-input" value="${c.ide || ''}" placeholder="CHE-123.456.789"></div>
          <div class="form-field"><label class="form-label">Domaine SUVA (monopole accident) ?</label><select id="ec-suva" class="form-select"><option value="non" ${!c.domaine_suva ? 'selected' : ''}>Non</option><option value="oui" ${c.domaine_suva ? 'selected' : ''}>Oui</option></select></div>` : ''}
        </div>`)}
        ${sectionCard('Coordonnées bancaires', '#a78bfa', `<div class="form-grid">
          <div class="form-field"><label class="form-label">Banque</label><input id="ec-banque" class="form-input" value="${c.banque || ''}"></div>
          <div class="form-field"><label class="form-label">IBAN</label><input id="ec-iban" class="form-input" value="${c.iban || ''}"></div>
        </div>`)}
        ${!isEntreprise ? sectionCard('Situation professionnelle', '#4ade80', `<div class="form-grid">
          <div class="form-field"><label class="form-label">Profession</label><input id="ec-profession" class="form-input" value="${c.profession || ''}"></div>
          <div class="form-field"><label class="form-label">Employeur</label><input id="ec-employeur" class="form-input" value="${c.employeur || ''}"></div>
          <div class="form-field"><label class="form-label">Revenu annuel brut</label><input id="ec-revenu" type="number" class="form-input" value="${c.revenu || ''}"></div>
          <div class="form-field"><label class="form-label">Taux d'activité (%)</label><input id="ec-taux-activite" type="number" class="form-input" value="${c.taux_activite || ''}"></div>
        </div>`) : ''}
        ${sectionCard('Origine client', '#a78bfa', `<div class="form-grid">
          <div class="form-field" style="grid-column:span 2"><label class="form-label">Apporteur / Recommandation externe</label><input id="ec-apporteur-ext" class="form-input" placeholder="Ex: Luca Renda, BNI Lavaux, Hôtel Modern Times…" value="${c.apporteur_externe || ''}"></div>
        </div>`)}
        <div style="display:flex;gap:10px;margin-top:14px">
          <button class="btn-secondary" onclick="toggleEditClient()">Annuler</button>
          <button class="btn-save" onclick="saveClientEdit('${c.id}', ${isEntreprise})">💾 Enregistrer les modifications</button>
        </div>
      ` : `
      ${isEntreprise ? sectionCard('Identification entreprise', '#f59e0b', `<div class="info-grid">
        ${infoBlock('Raison sociale', c.nom)} ${infoBlock('Secteur d\'activité', c.profession)}
        ${infoBlock('Contact principal', c.prenom)} ${infoBlock('Nb collaborateurs', c.taux_activite || '—')}
        ${infoBlock('Chiffre d\'affaires', c.revenu ? 'CHF ' + Number(c.revenu).toLocaleString() : '—')} ${infoBlock('N° AVS (LPP)', c.avs)}
      </div>`) : sectionCard('Coordonnées personnelles', '#38bdf8', `<div class="info-grid">
        ${infoBlock('Prénom', c.prenom)} ${infoBlock('Nom', c.nom)}
        ${infoBlock('Date de naissance', c.date_naissance)} ${infoBlock('Nationalité', c.nationalite)}
        ${infoBlock('État civil', c.etat_civil)} ${infoBlock('Enfants', c.enfants > 0 ? c.enfants : 'Aucun')}
        ${infoBlock('N° AVS', c.avs)} ${infoBlock('Langue', c.langue === 'FR' ? 'Français' : c.langue === 'DE' ? 'Allemand' : 'Italien')}
      </div>`)}
      ${sectionCard('Contact', '#f59e0b', `<div class="info-grid">
        ${infoBlock('Adresse', c.adresse)} ${infoBlock('NPA / Ville', (c.npa || '') + ' ' + (c.ville || ''))}
        ${infoBlock('Canton', c.canton)} ${infoBlock('Email', c.email)}
        ${infoBlock('Téléphone fixe', c.tel)} ${infoBlock('Mobile', c.mobile)}
      </div>`)}
      ${sectionCard('Coordonnées bancaires', '#a78bfa', `<div class="info-grid">
        ${infoBlock('Banque', c.banque)} ${infoBlock('IBAN', c.iban)}
      </div>`)}
      ${!isEntreprise ? sectionCard('Situation professionnelle', '#4ade80', `<div class="info-grid">
        ${infoBlock('Profession', c.profession)} ${infoBlock('Employeur', c.employeur)}
        ${infoBlock('Revenu annuel brut', c.revenu ? 'CHF ' + Number(c.revenu).toLocaleString() : '—')}
        ${infoBlock("Taux d'activité", c.taux_activite ? c.taux_activite + '%' : '—')}
      </div>`) : ''}
      `}
    </div>

    <div id="tab-prevoyance" class="hidden">
      ${sectionCard('Prévoyance', '#38bdf8', `<div class="info-grid">
        ${infoBlock('LPP (2e pilier)', c.lpp_actuel ? '✓ Affilié' : '✗ Non affilié')}
        ${infoBlock('Pilier 3a', c.pilier3a ? '✓ Actif' : '✗ Aucun')}
        ${infoBlock('Cotisation 3a', c.montant_3a ? 'CHF ' + c.montant_3a : '—')}
        ${infoBlock('Plafond légal 2026', "CHF 7'056")}
      </div>`)}
      ${sectionCard('🧮 Bilans de prévoyance enregistrés', '#a78bfa', bilansPrevoyance.length ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${bilansPrevoyance.map(b => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:var(--surface-alt);border-radius:9px;border:1px solid var(--border)">
              <div style="flex:1">
                <div style="font-size:12.5px;font-weight:700;color:var(--text)">${fmtDate(b.created_at)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${b.resume || ''}</div>
              </div>
              <button onclick="voirBilanSauvegarde('${b.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:6px 14px;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap">👁️ Voir</button>
            </div>`).join('')}
        </div>
      ` : `<div style="font-size:12px;color:var(--text-muted)">Aucun bilan de prévoyance enregistré pour ce client. Utilise le Calculateur LPP (menu Vente → 🧮 Bilan de prévoyance) pour en créer un.</div>`)}
      ${(() => {
        const santeContrats = contrats.filter(ct => {
          const p = (ct.produit||'').toLowerCase();
          return p.includes('completa') || p.includes('myflex') || p.includes('top') || 
                 p.includes('sana') || p.includes('dental') || p.includes('hospita') ||
                 p.includes('optisana') || p.includes('praeventa') || p.includes('global care') ||
                 p.includes('complémentaire') || p.includes('complementaire') || p.includes('lamal');
        });
        if (!santeContrats.length) return '';
        return sectionCard('Santé — couvertures actives', '#22c55e', `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${santeContrats.map(ct => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface-alt);border-radius:9px;border:1px solid var(--border)">
                <div>
                  <div style="font-size:13px;font-weight:700;color:var(--text)">${ct.produit}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${ct.compagnie || ''}${ct.date_debut ? ' · Dès le ' + fmtDate(ct.date_debut) : ''}${ct.date_echeance ? ' → ' + fmtDate(ct.date_echeance) : ''}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${ct.numero_police ? 'Police № ' + ct.numero_police : ''}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:800;color:#f59e0b;font-size:13px">CHF ${Number(ct.prime_annuelle||0).toLocaleString()}/an</div>
                  <div style="font-size:10px;color:var(--text-muted)">CHF ${Math.round(Number(ct.prime_annuelle||0)/12)}/mois</div>
                  ${badge(ct.statut, ct.statut==='actif'?'#4ade80':'#f59e0b')}
                </div>
              </div>`).join('')}
          </div>`);
      })()}
    </div>

    <div id="tab-contrats" class="hidden">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn-add" onclick="contratClientId='${c.id}'; navigate('nouveau-contrat')">+ Nouveau contrat</button>
      </div>
      ${contrats.length > 0 ? `<div class="table-wrap"><div class="table-header" style="grid-template-columns:1fr 120px 100px 110px 100px 40px"><div>Produit</div><div>Compagnie</div><div>Échéance</div><div>Prime/an</div><div>Statut</div><div></div></div>
      ${contrats.map(ct => `<div class="table-row" style="grid-template-columns:1fr 120px 100px 110px 100px 80px;cursor:pointer" onclick="showDetailContrat('${ct.id}')">
        <div>
          <div style="font-weight:700;font-size:13px;color:var(--text)">${ct.produit}</div>
          <div style="font-size:11px;color:var(--text-muted)">${ct.numero_police ? '№ ' + ct.numero_police : ''}${ct.date_debut ? ' · Dès le ' + fmtDate(ct.date_debut) : ''}${ct.date_echeance ? ' → ' + fmtDate(ct.date_echeance) : ''}</div>
        </div>
        <div style="font-size:13px;color:var(--text)">${ct.compagnie}</div>
        <div style="font-size:12px;color:var(--text-muted)">${fmtDate(ct.date_echeance)}</div>
        <div style="font-weight:800;color:#f59e0b">CHF ${Number(ct.prime_annuelle || 0).toLocaleString()}</div>
        <div>${badge(ct.statut, ct.statut === 'actif' ? '#4ade80' : ct.statut === 'renouveler' ? '#f59e0b' : '#f87171')}${ct.commissionne === false ? ' ' + badge('Non commissionné', '#64748b') : ''}</div>
        <div style="display:flex;gap:4px;align-items:center" onclick="event.stopPropagation()">
          ${ct.police_url
            ? `<button onclick="ouvrirPieceJointe('${ct.police_url}')" title="Voir la police PDF" style="background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:7px;padding:5px 8px;font-size:13px;cursor:pointer;line-height:1">📄</button>`
            : `<label title="Joindre la police PDF" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:5px 8px;font-size:13px;cursor:pointer;line-height:1">📎<input type="file" accept="application/pdf" onchange="uploadPolicePdf('${ct.id}', this)" style="display:none"/></label>`
          }
          <button onclick="showEditContrat('${ct.id}')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:5px 8px;font-size:13px;cursor:pointer;line-height:1" title="Modifier">✏️</button>
        </div>
      </div>`).join('')}</div>` : '<div class="table-empty">Aucun contrat.</div>'}

    <div id="tab-factures" class="hidden">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn-add" onclick="showFormFacture('${c.id}')">+ Nouvelle facture</button>
      </div>
      ${factures.length > 0 ? `<div class="table-wrap"><div class="table-header" style="grid-template-columns:120px 1fr 100px 100px 100px 90px"><div>N°</div><div>Objet</div><div>Émission</div><div>Échéance</div><div>Montant</div><div>Statut</div></div>
      ${factures.map(f => {
        const enRetard = f.statut === 'envoyee' && f.date_echeance && new Date(f.date_echeance) < new Date();
        const statutLabel = f.statut === 'payee' ? 'Payée' : enRetard ? 'En retard' : f.statut === 'annulee' ? 'Annulée' : 'Envoyée';
        const statutColor2 = f.statut === 'payee' ? '#4ade80' : enRetard ? '#f87171' : f.statut === 'annulee' ? '#64748b' : '#f59e0b';
        return `<div class="table-row" style="grid-template-columns:120px 1fr 100px 100px 100px 90px;cursor:pointer" onclick="toggleFactureStatut('${f.id}','${f.statut}','${c.id}')" title="Cliquer pour changer le statut">
          <div style="font-weight:700;font-size:13px;color:var(--text);font-family:monospace">${f.numero}</div>
          <div style="font-size:13px;color:var(--text)">${f.objet || '—'}</div>
          <div style="font-size:12px;color:var(--text-muted)">${f.date_emission || ''}</div>
          <div style="font-size:12px;color:var(--text-muted)">${fmtDate(f.date_echeance)}</div>
          <div style="font-weight:800;color:#f59e0b">CHF ${Number(f.montant||0).toLocaleString()}</div>
          <div>${badge(statutLabel, statutColor2)}</div>
        </div>`;
      }).join('')}</div>` : '<div class="table-empty">Aucune facture.</div>'}
    </div>

    <div id="tab-collaborateurs" class="hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Collaborateurs (${collaborateurs.length})</div>
        <button class="btn-add" onclick="showFormCollaborateur('${c.id}')" title="Ajouter un collaborateur" style="display:flex;align-items:center;gap:6px">👤+ Ajouter</button>
      </div>
      ${collaborateurs.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Nom</th>
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Prénom</th>
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Naissance</th>
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Téléphone</th>
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Adresse privée</th>
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">N° AVS</th>
          <th style="padding:8px 12px;border-bottom:1px solid var(--border)"></th>
        </tr></thead>
        <tbody>${collaborateurs.map(col => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:10px 12px;font-weight:700;color:var(--text)">${col.nom || '—'}</td>
            <td style="padding:10px 12px;color:var(--text)">${col.prenom || '—'}</td>
            <td style="padding:10px 12px;color:var(--text-muted)">${fmtDate(col.date_naissance)}</td>
            <td style="padding:10px 12px;color:var(--text-muted)">${col.telephone || '—'}</td>
            <td style="padding:10px 12px;color:var(--text-muted)">${col.adresse || '—'}</td>
            <td style="padding:10px 12px;color:var(--text-muted);font-family:monospace">${col.avs || '—'}</td>
            <td style="padding:10px 12px;text-align:right">
              <button onclick="deleteCollaborateur('${col.id}','${c.id}')" style="background:rgba(248,113,113,0.1);color:#f87171;border:1px solid rgba(248,113,113,0.3);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">Supprimer</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<div class="table-empty">Aucun collaborateur enregistré.</div>'}
    </div>

    <div id="tab-flotte" class="hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Flotte de véhicules</div>
        <div style="display:flex;gap:8px">
          <label style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">
            🤖 Importer depuis un PDF
            <input type="file" accept="application/pdf" onchange="importFlottePdf('${c.id}', this)" style="display:none"/>
          </label>
          <button class="btn-add" onclick="showFormVehicule('${c.id}')" title="Ajouter un véhicule" style="display:flex;align-items:center;gap:6px">🚗+ Ajouter un véhicule</button>
        </div>
      </div>
      <div id="flotte-import-status-${c.id}" style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px"></div>
      <input class="form-input" id="flotte-search-${c.id}" placeholder="🔍 Rechercher par marque, modèle, cylindrée ou plaque..." style="margin-bottom:14px" oninput="renderFlotteClient('${c.id}')"/>
      <div id="flotte-liste-${c.id}">${flotteListeHtml(c.id, '')}</div>
    </div>

    <div id="tab-rappels" class="hidden">
      ${rappels.length > 0 ? rappels.map(r => `<div class="rappel-item" style="cursor:pointer" onclick="showRappel('${r.id}')">
        <div class="urgence-dot" style="background:${r.urgence === 'haute' ? '#f87171' : r.urgence === 'moyenne' ? '#f59e0b' : '#64748b'}"></div>
        <div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--text)">${r.titre}</div><div style="font-size:11px;color:var(--text-muted)">${r.type || ''}</div></div>
        <span style="font-size:12px;color:var(--text-muted)">${fmtDate(r.date_echeance)}</span>
      </div>`).join('') : '<div class="table-empty">Aucun rappel.</div>'}
    </div>

    <div id="tab-notes" class="hidden">
      ${sectionCard('Notes', '#64748b', `
        <div style="color:var(--text);font-size:13px;line-height:1.7;margin-bottom:16px">${c.notes || 'Aucune note.'}</div>
        <textarea id="client-note-input" placeholder="Ajouter une note..." style="width:100%;background:var(--surface-alt);border:1px solid var(--border);border-radius:9px;padding:10px 14px;color:var(--text);font-size:13px;outline:none;resize:vertical;min-height:80px;font-family:inherit;box-sizing:border-box"></textarea>
        <button class="btn-save" style="margin-top:8px" onclick="saveClientNote('${c.id}')">Enregistrer</button>
      `)}
    </div>

    <div style="text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid var(--border)">
      <button onclick="confirmerSuppressionClient('${c.id}', '${displayName.replace(/'/g, "\\'")}')" style="background:none;border:none;color:var(--text-dim);font-size:11px;cursor:pointer;text-decoration:underline dotted">🗑️ Supprimer cette fiche client</button>
    </div>`;
  bindAdresseAutocomplete({ adresseId: 'ec-adresse', npaId: 'ec-npa', villeId: 'ec-ville', cantonId: 'ec-canton' });
  insertBackBar({ homeId: 'clients', homeLabel: 'Clients', itemLabel: displayName });
}

// Suppression d'un client — demande une double confirmation explicite (irréversible),
// et signale clairement s'il a des contrats/commissions liés avant de permettre l'action.
function confirmerSuppressionClient(clientId, nomClient) {
  const contratsLies = allContrats.filter(ct => ct.client_id === clientId);
  const commissionsLiees = allCommissionsAttente.filter(c => c.client_id === clientId);
  creerModale('modal-suppression-client', `
    <div style="background:var(--surface);border-radius:14px;padding:24px;max-width:440px;width:100%">
      <div style="font-size:16px;font-weight:800;color:#f87171;margin-bottom:10px">⚠️ Supprimer ${nomClient} ?</div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">Cette action est <strong>définitive et irréversible</strong>. Elle supprimera aussi :</div>
      <ul style="font-size:12.5px;color:var(--text);margin:0 0 16px;padding-left:20px">
        <li>${contratsLies.length} contrat(s)</li>
        <li>${commissionsLiees.length} commission(s) liée(s)</li>
        <li>Rappels, factures, collaborateurs et notes liés à ce client</li>
      </ul>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" onclick="document.getElementById('modal-suppression-client').remove()" style="flex:1">Annuler</button>
        <button onclick="executerSuppressionClient('${clientId}', this)" style="flex:1;background:#f87171;color:#0a0e1a;border:none;border-radius:8px;padding:10px;font-weight:800;cursor:pointer">🗑️ Confirmer la suppression</button>
      </div>
    </div>`, { opacite: 0.8, padding: '16px', overflowY: false });
}

async function executerSuppressionClient(clientId, btn) {
  btn.textContent = 'Suppression...'; btn.disabled = true;

  // Ordre important : supprimer d'abord ce qui dépend des contrats, puis les contrats,
  // puis le reste des données liées au client, et enfin le client lui-même —
  // pour éviter tout blocage de contrainte de clé étrangère et ne rien laisser en orphelin.
  // Si UNE SEULE suppression liée échoue, on s'arrête avant de toucher au client :
  // mieux vaut un client avec des données déjà partiellement nettoyées et un message clair,
  // qu'un blocage confus sur la contrainte de clé étrangère à la toute dernière étape.
  async function supprimerLot(table, items, libelle) {
    for (const item of items) {
      const r = await dbDelete(table, item.id);
      if (r && r.error) {
        showError(`Suppression interrompue : impossible de supprimer ${libelle} — ${errMsg(r)}`);
        btn.textContent = '🗑️ Confirmer la suppression'; btn.disabled = false;
        return false;
      }
    }
    return true;
  }

  const commissionsLiees = allCommissionsAttente.filter(c => c.client_id === clientId);
  if (!(await supprimerLot('commissions_attente', commissionsLiees, 'une commission liée'))) return;

  const contratsLies = allContrats.filter(ct => ct.client_id === clientId);
  if (!(await supprimerLot('contrats', contratsLies, 'un contrat lié'))) return;

  const [rappelsLies, facturesLiees, collaborateursLies, postitsLies] = await Promise.all([
    dbGet('rappels', `client_id=eq.${clientId}&select=id`),
    dbGet('factures', `client_id=eq.${clientId}&select=id`),
    dbGet('collaborateurs', `client_id=eq.${clientId}&select=id`),
    dbGet('postits', `client_id=eq.${clientId}&select=id`),
  ]);
  if (!(await supprimerLot('rappels', rappelsLies, 'un rappel lié'))) return;
  if (!(await supprimerLot('factures', facturesLiees, 'une facture liée'))) return;
  if (!(await supprimerLot('collaborateurs', collaborateursLies, 'un collaborateur lié'))) return;
  if (!(await supprimerLot('postits', postitsLies, 'un post-it lié'))) return;

  const resultatSuppression = await dbDelete('clients', clientId);
  if (resultatSuppression && resultatSuppression.error) {
    showError('Erreur lors de la suppression : ' + errMsg(resultatSuppression));
    btn.textContent = '🗑️ Confirmer la suppression'; btn.disabled = false;
    return;
  }
  logAction('delete_client', 'clients', clientId, null);
  document.getElementById('modal-suppression-client')?.remove();
  [allClients, allContrats, allCommissionsAttente, allRappels] = await Promise.all([
    dbGet('clients', 'select=*'),
    dbGet('contrats', 'select=*'),
    dbGet('commissions_attente', 'select=*'),
    dbGet('rappels', 'select=*'),
  ]);
  navigate('clients');
}

async function saveClientNote(clientId) {
  const textarea = document.getElementById('client-note-input');
  const nouvelleNote = textarea.value.trim();
  if (!nouvelleNote) { showError('Écris une note avant l\'enregistrement.'); return; }
  const client = allClients.find(c => c.id === clientId);
  const notesExistantes = client && client.notes ? client.notes + '\n\n' : '';
  const dateAujourdhui = new Date().toLocaleDateString('fr-CH');
  const noteAvecDate = `[${dateAujourdhui}] ${nouvelleNote}`;
  const notesCompletes = notesExistantes + noteAvecDate;

  const btn = document.querySelector('.btn-save');
  if (btn) { btn.textContent = 'Enregistrement...'; btn.disabled = true; }

  const r = await dbPatch('clients', clientId, { notes: notesCompletes });
  if (r && r.error) { showError('Erreur lors de l\'enregistrement de la note: ' + errMsg(r)); if (btn) { btn.textContent = 'Enregistrer'; btn.disabled = false; } return; }

  allClients = await dbGet('clients', 'select=*');
  await showClient(clientId);
  const notesBtn = document.querySelector('.tab-btn[onclick*="tab-notes"]');
  if (notesBtn) switchTab(notesBtn, 'tab-notes');
}

function toggleEditClient() {
  editingClient = !editingClient;
  showClient(currentClientId);
  if (editingClient) {
    setTimeout(() => {
      // Fiche privé
      bindAdresseAutocomplete({ adresseId:'ec-adresse', npaId:'ec-npa', villeId:'ec-ville', cantonId:'ec-canton' });
    }, 0);
  }
}

// ═══ MARQUAGE CLIENT OZ ASSURE ═══
async function toggleSourceOz(clientId, valeur) {
  const r = await dbPatch('clients', clientId, { source_oz: valeur });
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  logAction('toggle_source_oz', 'clients', clientId, valeur ? 'Client marqué OZ' : 'Marquage OZ retiré');
  allClients = await dbGet('clients', 'select=*');
  showClient(clientId);
}

async function toggleSourceCofidex(clientId, valeur) {
  const r = await dbPatch('clients', clientId, { source_cofidex: valeur });
  if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
  logAction('toggle_source_cofidex', 'clients', clientId, valeur ? 'Client marqué Cofidex' : 'Marquage Cofidex retiré');
  allClients = await dbGet('clients', 'select=*');
  showClient(clientId);
}

async function changerAgentClient(clientId, agentId) {
  const r = await dbPatch('clients', clientId, { apporteur_id: agentId || null });
  if (r && r.error) { showError('Erreur lors du changement d\u2019agent : ' + errMsg(r)); return; }
  const agent = allAgents.find(a => a.id === agentId);
  logAction('edit_client', 'clients', clientId, `Agent réassigné → ${agent ? agent.prenom + ' ' + agent.nom : 'aucun'}`);
  allClients = await dbGet('clients', 'select=*');
  showClient(clientId);
}

// ═══ MANDAT DE COURTAGE — génération pré-remplie au nom du client ═══
// ═══ SIGNATURE TACTILE — capture avant génération du mandat de courtage ═══
// Signature électronique SIMPLE (dessin sur écran tactile ou souris), pas une signature
// électronique qualifiée au sens de la loi suisse (SCSE/ZertES) — suffisant pour un mandat
// de courtage (aucune exigence légale de forme stricte), mais moins probant qu'une signature
// manuscrite ou une solution qualifiée type Skribble/DocuSign.
function ouvrirSignatureMandat(clientId) {
  creerModale('modal-signature-mandat', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:520px;width:100%">
      <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">✍️ Signature du mandant</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">Choisis comment le client va signer :</div>
      <div style="display:flex;gap:6px;margin-bottom:14px">
        <button id="onglet-signature-ici" class="btn-secondary" onclick="basculerModeSignature('ici', '${clientId}')" style="flex:1;font-size:11.5px">✍️ Ici, sur cet écran</button>
        <button id="onglet-signature-qr" class="btn-secondary" onclick="basculerModeSignature('qr', '${clientId}')" style="flex:1;font-size:11.5px">📱 QR code / lien</button>
        <button id="onglet-signature-email" class="btn-secondary" onclick="basculerModeSignature('email', '${clientId}')" style="flex:1;font-size:11.5px">✉️ Par e-mail</button>
      </div>
      <div id="zone-mode-signature"></div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn-secondary" onclick="document.getElementById('modal-signature-mandat').remove()">Sans signature</button>
      </div>
    </div>`, { opacite: 0.8, padding: '16px', overflowY: false });
  basculerModeSignature('ici', clientId);
}

// Bascule entre les 3 modes de signature : ici sur cet écran, via QR code/lien à distance,
// ou envoi direct par e-mail au client. Ce sont 3 options indépendantes, pas des sous-options.
function basculerModeSignature(mode, clientId) {
  ['ici', 'qr', 'email'].forEach(m => {
    document.getElementById(`onglet-signature-${m}`).style.background = mode === m ? 'var(--accent-dim)' : 'var(--surface-alt)';
  });
  clearInterval(window._pollingSignatureInterval);
  const zone = document.getElementById('zone-mode-signature');
  if (mode === 'ici') {
    zone.innerHTML = `
      <canvas id="canvas-signature" width="460" height="200" style="width:100%;height:200px;background:#fff;border-radius:9px;touch-action:none;cursor:crosshair;display:block"></canvas>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn-secondary" onclick="effacerSignature()">🗑️ Effacer</button>
        <button class="btn-save" onclick="validerSignatureEtGenerer('${clientId}')" style="margin-left:auto">✓ Valider et générer le mandat</button>
      </div>`;
    initCanvasSignature();
  } else {
    zone.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12.5px">Génération du lien...</div>`;
    envoyerVersAutreAppareil(clientId, mode);
  }
}

// Attache le mécanisme de dessin à un canvas de signature (id="canvas-signature") —
// utilisé à la fois pour la signature directe sur PC et pour la page autonome sur téléphone.
// Pointer events unifie souris/doigt/stylet en un seul mécanisme.
function initCanvasSignature() {
  const canvas = document.getElementById('canvas-signature');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#0f2244';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let enTrainDeDessiner = false;

  function positionRelative(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }
  canvas.addEventListener('pointerdown', (e) => {
    enTrainDeDessiner = true;
    const p = positionRelative(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!enTrainDeDessiner) return;
    const p = positionRelative(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => canvas.addEventListener(ev, () => { enTrainDeDessiner = false; }));
}

function effacerSignature() {
  const canvas = document.getElementById('canvas-signature');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function validerSignatureEtGenerer(clientId) {
  const canvas = document.getElementById('canvas-signature');
  // Détecte si quelque chose a réellement été dessiné (pas juste un canvas blanc)
  let signatureDataUrl = null;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const aDessine = pixels.some((v, i) => i % 4 === 3 && v > 0); // un pixel avec de l'opacité = un trait
    if (aDessine) signatureDataUrl = canvas.toDataURL('image/png');
  }
  document.getElementById('modal-signature-mandat').remove();
  genererMandatCourtage(clientId, signatureDataUrl);
}

// Génère un lien de signature à distance (QR code + lien copiable) et attend que le client
// signe sur son propre téléphone — sondage régulier de la base jusqu'à réception de la signature.
async function envoyerVersAutreAppareil(clientId, mode) {
  const c = allClients.find(x => x.id === clientId);
  const nomClient = c ? (estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`) : '';
  const token = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const r = await dbPost('signature_requests', { token, client_id: clientId, client_nom: nomClient });
  if (r && r.error) {
    document.getElementById('zone-mode-signature').innerHTML = `<div style="color:#f87171;font-size:12.5px">Impossible de créer le lien de signature : ${errMsg(r)}</div>`;
    return;
  }

  const urlBase = window.location.origin + window.location.pathname;
  const lienSignature = `${urlBase}?signer=${token}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(lienSignature)}`;

  const zone = document.getElementById('zone-mode-signature');
  const contenuAttente = `
      <div id="statut-attente-signature" style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px">
        <span class="loader-spin" style="display:inline-block;width:12px;height:12px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite"></span>
        En attente de la signature du client...
      </div>`;

  if (mode === 'qr') {
    zone.innerHTML = `
      <div style="text-align:center">
        <img src="${qrUrl}" alt="QR code de signature" style="width:180px;height:180px;background:#fff;padding:8px;border-radius:9px;margin-bottom:12px"/>
        <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px">Le client scanne ce code avec son téléphone, ou tu lui envoies le lien ci-dessous.</div>
        <div style="display:flex;gap:6px">
          <input class="form-input" readonly value="${lienSignature}" style="font-size:10.5px" onclick="this.select()"/>
          <button class="btn-secondary" onclick="navigator.clipboard.writeText('${lienSignature}')">📋 Copier</button>
        </div>
        ${contenuAttente}
      </div>`;
  } else if (mode === 'email') {
    zone.innerHTML = `
      <div style="text-align:center">
        ${c && c.email ? `
        <div style="font-size:12.5px;color:var(--text);margin-bottom:12px">Envoyer le lien de signature à <strong>${c.email}</strong></div>
        <button class="btn-save" id="btn-envoi-email-signature" onclick="envoyerLienSignatureParEmail('${clientId}', '${lienSignature}', '${c.email}')" style="width:100%">✉️ Envoyer l'e-mail maintenant</button>
        ` : `<div style="font-size:12px;color:#f87171">Pas d'e-mail enregistré pour ce client — ajoute-en un sur sa fiche pour utiliser cette option.</div>`}
        ${contenuAttente}
      </div>`;
  }

  // Sondage de la base toutes les 3 secondes — s'arrête après 10 minutes si personne ne signe
  const debut = Date.now();
  window._pollingSignatureInterval = setInterval(async () => {
    if (Date.now() - debut > 10 * 60 * 1000) {
      clearInterval(window._pollingSignatureInterval);
      const statutEl = document.getElementById('statut-attente-signature');
      if (statutEl) statutEl.innerHTML = '⏱️ Délai dépassé — régénère un nouveau lien si besoin.';
      return;
    }
    const resultats = await dbGet('signature_requests', `token=eq.${token}&select=signature_data,statut`);
    const demande = resultats && resultats[0];
    if (demande && demande.signature_data) {
      clearInterval(window._pollingSignatureInterval);
      document.getElementById('modal-signature-mandat')?.remove();
      genererMandatCourtage(clientId, demande.signature_data);
    }
  }, 3000);
}

// Envoie le lien de signature par e-mail via Microsoft Graph (même mécanisme que les
// notifications de rappels/tâches assignées) — nécessite d'être connecté à Outlook dans le CRM.
async function envoyerLienSignatureParEmail(clientId, lienSignature, emailDestinataire) {
  const btn = document.getElementById('btn-envoi-email-signature');
  if (!msalAccessToken) {
    showError('Connecte-toi à Outlook (Microsoft) dans le CRM pour pouvoir envoyer cet e-mail.');
    return;
  }
  if (btn) { btn.textContent = 'Envoi en cours...'; btn.disabled = true; }
  const c = allClients.find(x => x.id === clientId);
  const nomClient = c ? (estEntreprise(c) ? c.nom : c.prenom) : '';
  const contenu = `Bonjour ${nomClient || ''},\n\nMerci de signer votre mandat de courtage en suivant ce lien depuis votre téléphone ou votre ordinateur :\n\n${lienSignature}\n\nLa signature ne prend qu'une minute.\n\nMeilleures salutations,\nAssurex Sàrl`;
  const body = {
    message: {
      subject: 'Signature de votre mandat de courtage — Assurex Sàrl',
      body: { contentType: 'text', content: contenu },
      toRecipients: [{ emailAddress: { address: emailDestinataire } }],
    },
    saveToSentItems: true,
  };
  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${msalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (btn) {
      btn.textContent = r.ok ? '✓ E-mail envoyé' : 'Échec de l\u2019envoi — réessayer';
      btn.disabled = false;
    }
  } catch (e) {
    if (btn) { btn.textContent = 'Échec de l\u2019envoi — réessayer'; btn.disabled = false; }
  }
}

// ═══ PAGE AUTONOME DE SIGNATURE (téléphone du client — sans compte, sans connexion Microsoft) ═══
async function afficherPageSignatureAutonome(token) {
  document.body.innerHTML = `<div id="page-signature-autonome" style="min-height:100vh;background:#0f2244;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Arial,sans-serif">
    <div style="background:#fff;border-radius:16px;padding:24px;max-width:420px;width:100%;text-align:center">
      <div id="contenu-signature-autonome"><p style="color:#666">Chargement...</p></div>
    </div>
  </div>`;

  const resultats = await dbGet('signature_requests', `token=eq.${token}&select=*`);
  const demande = resultats && resultats[0];
  const zone = document.getElementById('contenu-signature-autonome');
  if (!demande) {
    zone.innerHTML = `<p style="color:#c0392b">Ce lien de signature n'est plus valide.</p>`;
    return;
  }
  if (demande.statut === 'signe' || demande.signature_data) {
    zone.innerHTML = `<div style="font-size:40px;margin-bottom:10px">✅</div><p style="color:#333;font-weight:700">Signature déjà transmise, merci !</p><p style="color:#888;font-size:12.5px">Vous pouvez fermer cette page.</p>`;
    return;
  }

  zone.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#0f2244;margin-bottom:4px">Signature du mandat de courtage</div>
    <div style="font-size:12.5px;color:#666;margin-bottom:16px">${demande.client_nom || ''}</div>
    <div style="font-size:11px;color:#888;margin-bottom:10px">Signez ci-dessous avec votre doigt</div>
    <canvas id="canvas-signature" width="340" height="180" style="width:100%;height:180px;background:#f8f8f8;border:1px solid #ddd;border-radius:9px;touch-action:none;display:block"></canvas>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button onclick="effacerSignature()" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff;color:#666;font-weight:700;cursor:pointer">Effacer</button>
      <button onclick="envoyerSignatureAutonome('${token}')" style="flex:2;padding:10px;border-radius:8px;border:none;background:#0f2244;color:#fff;font-weight:700;cursor:pointer">✓ Envoyer ma signature</button>
    </div>
    <div style="font-size:9.5px;color:#aaa;margin-top:12px">Signature électronique simple — ASSUREX Sàrl</div>
  `;
  initCanvasSignature();
}

async function envoyerSignatureAutonome(token) {
  const canvas = document.getElementById('canvas-signature');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const aDessine = pixels.some((v, i) => i % 4 === 3 && v > 0);
  if (!aDessine) { alert('Merci de signer avant d\u2019envoyer.'); return; }
  const signatureDataUrl = canvas.toDataURL('image/png');
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/signature_requests?token=eq.${encodeURIComponent(token)}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ signature_data: signatureDataUrl, statut: 'signe' }),
    });
  } catch (e) { /* affichage de confirmation optimiste malgré tout — la page est fermée juste après par le client */ }
  const zone = document.getElementById('contenu-signature-autonome');
  zone.innerHTML = `<div style="font-size:40px;margin-bottom:10px">✅</div><p style="color:#333;font-weight:700">Merci, votre signature a été transmise !</p><p style="color:#888;font-size:12.5px">Vous pouvez fermer cette page.</p>`;
}

function genererMandatCourtage(clientId, signatureDataUrl) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) { showError('Client introuvable.'); return; }
  const isEnt = estEntreprise(c);

  // Découpage adresse : "adresse" seul + "ville" contient déjà "NPA Localité" (convention existante du CRM)
  const npaLocalite = c.ville || '';

  const champs = {
    nom: isEnt ? '' : (c.nom || ''),
    prenom: isEnt ? '' : (c.prenom || ''),
    societe: isEnt ? (c.nom || '') : '',
    naissanceOuIde: isEnt ? (c.ide || '') : (c.date_naissance ? fmtDate(c.date_naissance) : ''),
    adresse: c.adresse || '',
    co: c.co || '',
    npaLocalite,
    tel: c.tel || c.mobile || c.telephone || '',
    email: c.email || '',
    contactEntreprise: isEnt ? (c.prenom || '') : '',
  };

  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Mandat de courtage — ${isEnt ? champs.societe : champs.prenom + ' ' + champs.nom}</title><style>
    body{font-family:Arial,sans-serif;padding:35px;color:#1a1a1a;font-size:12.5px;line-height:1.5}
    .entete{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #113679;padding-bottom:14px;margin-bottom:20px}
    h1{font-size:19px;color:#113679;text-align:center;margin:10px 0 2px}
    .sous-titre{text-align:center;font-style:italic;color:#444;margin-bottom:18px;font-size:12px}
    h2{font-size:13px;color:#113679;margin:18px 0 8px;font-weight:800}
    table{width:100%;border-collapse:collapse;margin-bottom:4px}
    td{border:1px solid #ccc;padding:7px 10px;font-size:11.5px;vertical-align:middle}
    td.label{background:#f2f5fa;font-weight:700;width:22%;color:#113679}
    td.valeur{width:28%}
    ol{padding-left:20px}
    ol li{margin-bottom:9px;font-size:11.5px}
    .signatures{display:flex;justify-content:space-between;margin-top:40px}
    .signatures div{width:45%}
    .ligne-signature{border-top:1px solid #333;margin-top:50px;padding-top:5px;font-style:italic;font-size:11px;color:#555}
    .footer{text-align:center;font-size:9.5px;color:#888;margin-top:30px;border-top:1px solid #ddd;padding-top:10px}
    .page-break{page-break-before:always}
    .art45-table th{background:#113679;color:#fff;padding:8px 10px;font-size:11px;text-align:left}
    .art45-table td{font-size:10.5px;padding:8px 10px}
    .print-btn{margin-top:25px;padding:10px 20px;background:#113679;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px}
    @media print {
      .print-btn { display: none !important; }
      body { padding: 15px 25px; font-size: 11px; }
      h1 { font-size: 17px; margin: 6px 0 2px; }
      .sous-titre { margin-bottom: 12px; }
      h2 { margin: 10px 0 5px; font-size: 12px; }
      table { margin-bottom: 2px; }
      td { padding: 5px 8px; font-size: 10.5px; }
      ol li { margin-bottom: 5px; font-size: 10.5px; }
      p { margin: 5px 0; }
      .signatures { margin-top: 22px; }
      .ligne-signature { margin-top: 30px; }
      .footer { margin-top: 14px; padding-top: 6px; }
      .page-break { page-break-before: always; }
      @page { margin: 12mm; }
    }
  </style></head><body>

    <div class="entete">
      ${genererBadgeLogoAssurex(28, '10px 16px', 'inline-block')}
    </div>

    <h1>MANDAT DE COURTAGE</h1>
    <div class="sous-titre">Représentation et gestion du portefeuille d'assurances</div>

    <p><strong>Entre les soussigné(e)s :</strong></p>
    <h2>LE MANDANT</h2>
    <table>
      <tr><td class="label">Nom</td><td class="valeur">${champs.nom}${champs.co ? `<div style="font-size:9.5px;color:#666;margin-top:2px">${champs.co}</div>` : ''}</td><td class="label">Prénom</td><td class="valeur">${champs.prenom}</td></tr>
      <tr><td class="label">Société / raison sociale</td><td class="valeur">${champs.societe}${isEnt && champs.contactEntreprise ? `<div style="font-size:9.5px;color:#666;margin-top:2px">Contact : ${champs.contactEntreprise}</div>` : ''}</td><td class="label">Date de naissance / IDE</td><td class="valeur">${champs.naissanceOuIde}</td></tr>
      <tr><td class="label">Adresse</td><td class="valeur">${champs.adresse}</td><td class="label">NPA / Localité</td><td class="valeur">${champs.npaLocalite}</td></tr>
      <tr><td class="label">Téléphone</td><td class="valeur">${champs.tel}</td><td class="label">E-mail</td><td class="valeur">${champs.email}</td></tr>
    </table>
    <p style="font-size:11px">ci-après « le mandant », d'une part,</p>

    <h2>LE MANDATAIRE</h2>
    <table>
      <tr><td class="label">Nom</td><td class="valeur">Ozkan</td><td class="label">Prénom</td><td class="valeur">Jonathan</td></tr>
      <tr><td class="label">Raison sociale</td><td class="valeur">Assurex Sàrl</td><td class="label">Autorisation FINMA</td><td class="valeur">F01492173</td></tr>
      <tr><td class="label">Adresse</td><td class="valeur">Rue du Centre 142</td><td class="label">NPA / Localité</td><td class="valeur">1025 St-Sulpice</td></tr>
      <tr><td class="label">Téléphone</td><td class="valeur">079 101 99 26</td><td class="label">E-mail</td><td class="valeur">jo@cofidex.ch</td></tr>
    </table>
    <p style="font-size:11px">et le conseiller à la clientèle d'ASSUREX Sàrl, ci-après « le mandataire », d'autre part,</p>

    <p><strong>Il est convenu ce qui suit :</strong></p>
    <ol>
      <li>Le mandant confie au mandataire sa représentation auprès des compagnies d'assurances, ainsi que la gestion de son portefeuille d'assurances. Il pourra obtenir en son nom tout document, copie ou information au sujet du portefeuille d'assurances du mandant.</li>
      <li>A la demande du mandant, le mandataire pourra donner toutes instructions aux compagnies d'assurance pour la conclusion, la modification ou l'annulation de ses contrats.</li>
      <li>Le mandant demeure preneur d'assurance, débiteur des primes et bénéficiaire des prestations (indemnités de sinistre etc.). Le mandataire n'assume de responsabilité que par rapport aux documents et informations qui lui ont été transmis.</li>
      <li>Le mandataire s'engage à respecter la stricte confidentialité en ce qui concerne ses relations d'affaires, les règles d'usage traitant du secret professionnel et de la protection des données sont applicables, y compris à la fin du mandat.</li>
      <li>Sur information au mandant, le mandataire est autorisé à confier certaines tâches à des tiers (confrères agréés FINMA, fiduciaires, avocats etc.). Le mandataire restera toutefois conseiller unique du mandant.</li>
      <li>Le mandataire précise que son indemnisation provient directement des compagnies d'assurance, et par conséquent, ses prestations ne feront l'objet d'aucune facturation d'honoraires, sauf condition particulière préalablement validée entre les parties.</li>
      <li>Par sa signature, le mandant confirme expressément avoir eu connaissance des informations relatives au mandataire, conformément à l'art. 45 de la LSA (copie au verso du présent document, remis au mandant), avoir pris connaissance et être en parfait accord avec les conditions générales liées au présent mandat de courtage.</li>
      <li>Le présent mandat annule et remplace tout autre mandat convenu antérieurement entre le mandant et tout autre mandataire. Il pourra être révoqué en tout temps par chacune des parties.</li>
      <li>Entrée en vigueur du mandat : à la date de signature.</li>
    </ol>

    <p>Fait en deux exemplaires, à _________________________, le _________________________.</p>

    <div class="signatures">
      <div><strong>Signature du mandant</strong>${signatureDataUrl ? `<div style="margin-top:8px"><img src="${signatureDataUrl}" style="max-height:60px;max-width:220px;display:block"/></div><div class="ligne-signature" style="margin-top:6px">Le mandant</div>` : `<div class="ligne-signature">Le mandant</div>`}</div>
      <div><strong>Signature du mandataire (ASSUREX Sàrl)</strong><div class="ligne-signature">Le mandataire</div></div>
    </div>

    <div class="footer">ASSUREX Sàrl – Rue du Centre 142, 1025 St-Sulpice – Autorisation FINMA F01492173</div>

    <div class="page-break"></div>

    <h2 style="margin-top:0">INFORMATIONS RELATIVES AU MANDATAIRE – ART. 45 LSA</h2>
    <p style="font-size:11px">Votre conseiller ou son employeur agit comme courtier non lié, et travaille sur mandat de ses clients selon prestations convenues dans le mandat de courtage. Une rémunération forfaitaire est octroyée pour l'acquisition de contrats d'assurance, et se monte à septante francs maximum pour l'assurance de base, et seize primes pour la complémentaire. Il collabore avec les assureurs indiqués qui lui versent des courtages prévalant sur le marché. Le courtier est lui-même responsable en cas de faute, de négligence, d'information erronée qu'il peut commettre dans le cadre de son activité d'intermédiaire. Votre conseiller est autorisé à négocier les produits d'assurance des assureurs pour les branches et les assureurs porteurs des risques suivants :</p>

    <table class="art45-table">
      <tr><th>Type d'assurance</th><th>Assureur(s) porteur(s) du risque</th></tr>
      <tr><td>Assurance maladie et accident – LAMal</td><td>CSS Assurances, 6002 Lucerne · Groupe Mutuel, 1920 Martigny · Helsana, 1003 Lausanne · Swica, 1006 Lausanne</td></tr>
      <tr><td>Assurances complémentaires – LCA</td><td>CSS Assurances, 6002 Lucerne · Groupe Mutuel, 1920 Martigny · Helsana, 1003 Lausanne · Swica, 1006 Lausanne</td></tr>
      <tr><td>Assurances de prévoyance</td><td>GMV SA, 1920 Martigny · AXA Winterthur, 1003 Lausanne · Allianz, 1023 Crissier · La Mobilière Riviera · Vaudoise Riviera · Swiss Life, Lausanne</td></tr>
      <tr><td>Assurances choses – Véhicules à moteur</td><td>Groupe Mutuel, 1920 Martigny · AXA Winterthur, 1003 Lausanne · Allianz, 1023 Crissier · La Mobilière Riviera · Vaudoise Riviera</td></tr>
      <tr><td>Assurances choses – Inventaire du ménage</td><td>Groupe Mutuel, 1920 Martigny · AXA Winterthur, 1003 Lausanne · Allianz, 1023 Crissier · La Mobilière Riviera · Vaudoise Riviera</td></tr>
      <tr><td>Protection juridique – Privée / Entreprise</td><td>Groupe Mutuel, 1920 Martigny · AXA Winterthur, 1003 Lausanne · Allianz, 1023 Crissier · La Mobilière Riviera · Orion, Bâle</td></tr>
      <tr><td>Assurances d'entreprises – LAA / LAAC / LPP / IJM / RC Prof / PEE</td><td>Groupe Mutuel, 1920 Martigny · AXA Winterthur, 1003 Lausanne · Allianz, 1023 Crissier · La Mobilière Riviera · Vaudoise Riviera</td></tr>
    </table>

    <h2>UTILISATION DES DONNÉES À DES FINS PROFESSIONNELLES</h2>
    <p style="font-size:10.5px;text-align:justify">L'intermédiaire saisit et utilise vos données personnelles et administratives pour définir vos besoins actuels et futurs en matière d'assurance, afin d'établir une offre et/ou pour les transmettre avec vos données médicales aux assureurs concernés en vue de traiter votre/vos proposition(s) d'assurance(s) et le contrat qui s'en suit. Il/Elle peut conserver une copie des documents contractuels dans son dossier et recevoir de l'assureur des données clients, notamment en ce qui concerne l'acceptation de la proposition, l'exécution du contrat d'assurance, l'encaissement ou la résiliation. Les assureurs utiliseront vos données dans le respect de la Loi sur la protection des données, pour évaluer le risque à assurer, pour le traitement des sinistres, ainsi que pour le suivi administratif, statistique et financier de(s) l'assurance(s) contractée(s), de même que pour le suivi administratif et financier entre l'intermédiaire et l'assureur porteur du risque. Vos données personnelles et administratives peuvent être utilisées par l'intermédiaire et/ou par les assureurs porteurs du risque et/ou par d'autres partenaires des assureurs dans le contexte d'actions de marketing, notamment la transmission par poste, e-mail, téléphone ou SMS d'informations et de publicités concernant leurs offres et produits. Les données personnelles sont généralement conservées sous la forme électronique et/ou papier. Elles sont conservées aussi longtemps que la loi, la gestion du contrat d'assurance, des sinistres, des droits de recours, du recouvrement, de la rémunération de l'intermédiaire et/ou d'éventuels litiges entre l'assureur, l'assuré, l'intermédiaire ou de tiers l'exigent.</p>

    <h2>AUTORISATION DE PRISE DE CONTACT</h2>
    <p style="font-size:11px">Adresse recommandée avec autorisation : _________________________ – par : _________________________</p>
    <p style="font-size:10.5px;font-style:italic">Le mandant confirme avoir pris connaissance des informations ci-dessus (art. 45 LSA, utilisation des données, autorisation de prise de contact).</p>

    <div class="signatures">
      <div><strong>Signature du mandant</strong>${signatureDataUrl ? `<div style="margin-top:8px"><img src="${signatureDataUrl}" style="max-height:60px;max-width:220px;display:block"/></div><div class="ligne-signature" style="margin-top:6px">Le mandant</div>` : `<div class="ligne-signature">Le mandant</div>`}</div>
      <div><strong>Signature du mandataire (ASSUREX Sàrl)</strong><div class="ligne-signature">Le mandataire</div></div>
    </div>

    <div class="footer">ASSUREX Sàrl – Rue du Centre 142, 1025 St-Sulpice – Autorisation FINMA F01492173</div>

    <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
  </body></html>`);
  win.document.close();
}

async function saveClientEdit(id, isEntreprise) {
  const body = isEntreprise ? {
    nom: document.getElementById('ec-nom').value.trim(),
    profession: document.getElementById('ec-profession').value.trim(),
    prenom: document.getElementById('ec-prenom').value.trim(),
    taux_activite: Number(document.getElementById('ec-taux-activite').value) || null,
    revenu: Number(document.getElementById('ec-revenu').value) || null,
    avs: document.getElementById('ec-avs').value.trim(),
    cct: document.getElementById('ec-cct') ? document.getElementById('ec-cct').value === 'oui' : undefined,
    domaine_suva: document.getElementById('ec-suva') ? document.getElementById('ec-suva').value === 'oui' : undefined,
    ide: document.getElementById('ec-ide') ? document.getElementById('ec-ide').value.trim() : undefined,
  } : {
    prenom: document.getElementById('ec-prenom').value.trim(),
    nom: document.getElementById('ec-nom').value.trim(),
    date_naissance: document.getElementById('ec-date-naissance').value || null,
    nationalite: document.getElementById('ec-nationalite').value.trim(),
    etat_civil: document.getElementById('ec-etat-civil').value,
    enfants: Number(document.getElementById('ec-enfants').value) || 0,
    avs: document.getElementById('ec-avs').value.trim(),
    langue: document.getElementById('ec-langue').value,
  };

  // Champs communs (Contact, Bancaire, et Pro pour les particuliers)
  Object.assign(body, {
    adresse: document.getElementById('ec-adresse').value.trim(),
    co: document.getElementById('ec-co') ? document.getElementById('ec-co').value.trim() : undefined,
    npa: document.getElementById('ec-npa').value.trim(),
    ville: document.getElementById('ec-ville').value.trim(),
    canton: document.getElementById('ec-canton').value.trim(),
    email: document.getElementById('ec-email').value.trim(),
    tel: document.getElementById('ec-tel').value.trim(),
    mobile: document.getElementById('ec-mobile').value.trim(),
    banque: document.getElementById('ec-banque').value.trim(),
    iban: document.getElementById('ec-iban').value.trim(),
    apporteur_externe: document.getElementById('ec-apporteur-ext') ? (document.getElementById('ec-apporteur-ext').value.trim() || null) : undefined,
    mandat: document.getElementById('ec-mandat') ? document.getElementById('ec-mandat').value : undefined,
  });

  if (!isEntreprise) {
    const profEl = document.getElementById('ec-profession');
    const empEl = document.getElementById('ec-employeur');
    const revEl = document.getElementById('ec-revenu');
    const tauxEl = document.getElementById('ec-taux-activite');
    if (profEl) body.profession = profEl.value.trim();
    if (empEl) body.employeur = empEl.value.trim();
    if (revEl) body.revenu = Number(revEl.value) || null;
    if (tauxEl) body.taux_activite = Number(tauxEl.value) || null;
  }

  if (!body.prenom && !body.nom) { showError('Le nom est obligatoire.'); return; }

  const btn = document.querySelector('.btn-save');
  if (btn) { btn.textContent = 'Enregistrement...'; btn.disabled = true; }

  const r = await dbPatch('clients', id, body);
  if (r && r.error) { showError('Erreur lors de la mise à jour: ' + errMsg(r)); if (btn) { btn.textContent = '💾 Enregistrer les modifications'; btn.disabled = false; } return; }
  logAction('edit_client', 'clients', id, `${body.prenom || ''} ${body.nom || ''}`.trim());

  // Resynchronise le nom dupliqué dans les commissions en attente liées à ce client
  if (body.prenom !== undefined || body.nom !== undefined) {
    const nomComplet = isEntreprise ? body.nom : `${body.prenom} ${body.nom}`;
    const liees = allCommissionsAttente.filter(c => c.client_id === id);
    await Promise.all(liees.map(c => dbPatch('commissions_attente', c.id, { client_nom: nomComplet })));
    allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
  }

  // Cascade : si le mandat de courtage vient d'être résilié, tous les contrats encore actifs
  // (hors résilié/annulé, déjà des états terminaux qu'on ne veut pas écraser) basculent en
  // "mandat_resilie" — le client garde ses polices chez l'assureur, mais elles sortent du
  // volume de primes et du CA portefeuille puisque le mandat de représentation n'existe plus.
  if (body.mandat === 'résilié') {
    const contratsDuClient = allContrats.filter(ct => ct.client_id === id && !['résilié','annulé','mandat_resilie'].includes(ct.statut));
    await Promise.all(contratsDuClient.map(ct => dbPatch('contrats', ct.id, { statut: 'mandat_resilie' })));
    allContrats = await dbGet('contrats', 'select=*');
  }

  editingClient = false;
  allClients = await dbGet('clients', 'select=*');
  showClient(id);
}

