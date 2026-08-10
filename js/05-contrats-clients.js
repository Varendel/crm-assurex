// Petites illustrations pour la fiche client privé (homme / femme / bébé en attente de naissance) —
// remplacent le cercle d'initiales par défaut quand la civilité (ou le statut prénatal) est connue.
function iconAvatarClient(type, size) {
  const s = size;
  if (type === 'bebe') {
    return `<div style="width:${s}px;height:${s}px;border-radius:50%;background:rgba(244,114,182,0.14);border:2px solid rgba(244,114,182,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="${Math.round(s*0.62)}" height="${Math.round(s*0.62)}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="19" r="13" fill="#f9a8d4"/>
        <circle cx="15.5" cy="18" r="1.6" fill="#831843"/>
        <circle cx="24.5" cy="18" r="1.6" fill="#831843"/>
        <path d="M16 23c1.3 1.4 2.7 2 4 2s2.7-0.6 4-2" stroke="#831843" stroke-width="1.4" stroke-linecap="round" fill="none"/>
        <path d="M13 10c1.5-2.5 4-4 7-4s5.5 1.5 7 4" stroke="#f472b6" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <circle cx="20" cy="5.5" r="2" fill="#f472b6"/>
      </svg>
    </div>`;
  }
  if (type === 'femme') {
    return `<div style="width:${s}px;height:${s}px;border-radius:50%;background:rgba(167,139,250,0.12);border:2px solid rgba(167,139,250,0.35);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="${Math.round(s*0.62)}" height="${Math.round(s*0.62)}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 34c0-8 4.5-12.5 11-12.5S31 26 31 34" fill="#a78bfa"/>
        <circle cx="20" cy="14" r="9" fill="#e9d5ff"/>
        <path d="M10 15c0-6 4.5-10.5 10-10.5S30 9 30 15c0 1.5-0.3 3-1 4.3-0.6-3-1-6.5-1-9.3-2.6 2-6.5 3-9 3s-4.5-0.6-6-1.8C12.4 13 11.2 15.8 11 19.3 10.3 18 10 16.5 10 15z" fill="#7c3aed"/>
      </svg>
    </div>`;
  }
  if (type === 'homme') {
    return `<div style="width:${s}px;height:${s}px;border-radius:50%;background:rgba(56,189,248,0.12);border:2px solid rgba(56,189,248,0.35);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="${Math.round(s*0.62)}" height="${Math.round(s*0.62)}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 34c0-7.5 4.5-11.5 11-11.5S31 26.5 31 34" fill="#38bdf8"/>
        <circle cx="20" cy="14" r="9" fill="#bae6fd"/>
        <path d="M11.2 11.5c1.6-4.3 5-6.8 8.8-6.8s7.2 2.5 8.8 6.8c-2.7 0.8-5.9 1.2-8.8 1.2s-6.1-0.4-8.8-1.2z" fill="#0284c7"/>
      </svg>
    </div>`;
  }
  return null;
}

// Un contrat compte comme "santé" (LAMal/LCA) s'il correspond à un produit du catalogue Santé,
// ou à une ligne LCA combinable enregistrée sous le libellé libre "LCA — <nom du produit>".
function estProduitSante(produitLabel) {
  if (!produitLabel) return false;
  if (produitLabel.startsWith('LCA — ')) return true;
  return (CATALOGUE_PRODUITS['Santé'] || []).some(p => p.label === produitLabel);
}

// ═══ ASSURANCE PRÉNATALE — annonce de la naissance ═══
async function ouvrirAnnonceNaissance(clientId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  creerModale('modal-annonce-naissance', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:480px">
      <h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:var(--text)">🎉 Annoncer la naissance</h3>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">Confirme le prénom et la date de naissance réels — le dossier et les contrats LAMal/LCA basculeront en vigueur, et les commissions liées passeront en suivi normal.</div>
      <div class="form-grid">
        <div class="form-field"><label class="form-label">Prénom de l'enfant</label><input class="form-input" id="an-prenom" value="${c.prenom && c.prenom !== 'Baby' ? c.prenom : ''}" placeholder="Prénom réel"/></div>
        <div class="form-field"><label class="form-label">Date de naissance</label><input class="form-input" id="an-date" type="date" value="${c.date_naissance || ''}"/></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn-secondary" onclick="document.getElementById('modal-annonce-naissance').remove()">Annuler</button>
        <button class="btn-save" onclick="confirmerNaissance('${clientId}')">✓ Confirmer la naissance</button>
      </div>
    </div>`);
}

async function confirmerNaissance(clientId) {
  const prenom = document.getElementById('an-prenom').value.trim() || 'Baby';
  const dateNaissance = document.getElementById('an-date').value;
  if (!dateNaissance) { showError('Indique la date de naissance.'); return; }
  const btn = document.querySelector('#modal-annonce-naissance .btn-save');
  if (btn) { btn.textContent = 'Confirmation...'; btn.disabled = true; }

  const rClient = await dbPatch('clients', clientId, { prenom, date_naissance: dateNaissance, prenatal: false });
  if (rClient && rClient.error) { showError('Erreur : ' + errMsg(rClient)); if (btn) { btn.textContent = '✓ Confirmer la naissance'; btn.disabled = false; } return; }

  // Bascule tous les contrats du client (LAMal/LCA prénatals) en vigueur
  const contratsClient = allContrats.filter(x => x.client_id === clientId);
  for (const ct of contratsClient) {
    if (ct.statut !== 'actif') await dbPatch('contrats', ct.id, { statut: 'actif' });
  }

  // Les commissions "en attente de naissance" deviennent des commissions normales en attente
  const commissionsClient = allCommissionsAttente.filter(cm => contratsClient.some(ct => ct.id === cm.contrat_id) && cm.statut === 'en_attente_naissance');
  for (const cm of commissionsClient) {
    await dbPatch('commissions_attente', cm.id, { statut: 'en_attente' });
  }

  logAction('naissance_confirmee', 'clients', clientId, `${prenom} — naissance confirmée le ${dateNaissance}`);

  allClients = await dbGet('clients', 'select=*');
  allContrats = await dbGet('contrats', 'select=*');
  allCommissionsAttente = await dbGet('commissions_attente', 'select=*');

  const modal = document.getElementById('modal-annonce-naissance');
  if (modal) modal.remove();

  ouvrirEmailsNaissance(clientId, prenom, dateNaissance);
}

function ouvrirEmailsNaissance(clientId, prenom, dateNaissance) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) { showClient(clientId); return; }
  const contratsSante = allContrats.filter(ct => ct.client_id === clientId && estProduitSante(ct.produit));
  const compagnies = [...new Set(contratsSante.map(ct => ct.compagnie).filter(Boolean))];
  const nomComplet = `${prenom} ${c.nom}`;

  if (compagnies.length === 0) {
    showError(`Naissance confirmée pour ${nomComplet} — aucun contrat LAMal/LCA trouvé pour proposer une annonce par email.`);
    showClient(clientId);
    return;
  }

  const liensMail = compagnies.map(comp => {
    const polices = contratsSante.filter(ct => ct.compagnie === comp).map(ct => `- ${ct.produit}${ct.numero_police ? ' (police ' + ct.numero_police + ')' : ''}`).join('\n');
    const sujet = `Naissance — ${nomComplet} — régularisation de couverture`;
    const corps = `Bonjour,\n\nNous vous annonçons la naissance de ${nomComplet}, né(e) le ${fmtDate(dateNaissance)}.\n\nMerci de bien vouloir régulariser la/les couverture(s) suivante(s), assurée(s) à titre prénatal :\n${polices}\n\nNous restons à votre disposition pour tout document complémentaire (acte de naissance, etc.).\n\nMeilleures salutations`;
    const mailto = `mailto:?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
    return `<a href="${mailto}" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--surface-alt);border:1px solid var(--border);border-radius:9px;text-decoration:none;color:var(--text);font-size:12.5px;font-weight:700;margin-bottom:8px">✉️ Annoncer à ${comp}<span style="color:var(--accent);font-size:11px">Ouvrir l'email →</span></a>`;
  }).join('');

  creerModale('modal-emails-naissance', `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;width:100%;max-width:480px">
      <h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:var(--text)">🎉 Naissance confirmée</h3>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px">${nomComplet}, né(e) le ${fmtDate(dateNaissance)} — les contrats sont maintenant actifs. Choisis la compagnie à annoncer par email (destinataire à compléter toi-même) :</div>
      ${liensMail}
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn-secondary" onclick="document.getElementById('modal-emails-naissance').remove(); showClient('${clientId}')">Fermer</button>
      </div>
    </div>`);
}

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
  // État des dossiers (demandes_offre) retiré de la fiche client le 07.08.2026 (demande de
  // Jonathan) — ce suivi vit désormais uniquement sur la fiche opportunité (bloc "📧 Emails
  // détectés"), donc plus besoin de charger demandes_offre ici.
  const [clients, contrats, rappels, collaborateurs, factures, postits, bilansPrevoyance, mandatsSignes] = await Promise.all([
    dbGet('clients', `id=eq.${id}&select=*`),
    dbGet('contrats', `client_id=eq.${id}&select=*`),
    dbGet('rappels', `client_id=eq.${id}&select=*`),
    dbGet('collaborateurs', `client_id=eq.${id}&select=*&order=nom.asc`),
    dbGet('factures', `client_id=eq.${id}&select=*&order=date_emission.desc`),
    dbGet('postits', `client_id=eq.${id}&select=*&order=created_at.asc`),
    getBilansPrevoyanceClient(id),
    getMandatsSignesClient(id),
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
    : (c.prenatal ? iconAvatarClient('bebe', 52)
      : c.civilite === 'Madame' ? iconAvatarClient('femme', 52)
      : c.civilite === 'Monsieur' ? iconAvatarClient('homme', 52)
      : `<div style="width:52px;height:52px;border-radius:50%;background:var(--accent-dim);border:2px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:var(--accent)">${(c.prenom||'?')[0]}${(c.nom||'?')[0]}</div>`);

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
        <button onclick="ouvrirUploadContratSignature('${c.id}')" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">📎 Faire signer un contrat</button>
        <button onclick="ouvrirModaleResiliation('${c.id}')" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">📝 Feuille de résiliation</button>
        <button onclick="prefillOpportuniteClientId='${c.id}'; opportuniteEnEditionId=null; navigate('nouvelle-opportunite')" style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:8px;padding:7px 16px;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer">🎯 Créer une opportunité</button>
        <button onclick="prefillDemandeOffreClientId='${c.id}'; navigate('nouvelle-demande-offre')" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">📝 Demande d'offre</button>
        ${estEntreprise(c) ? `<button onclick="genererFicheDemandeOffre('${c.id}')" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">🖨️ Fiche papier (demande d'offre)</button>` : ''}
        ${estEntreprise(c) ? `<button onclick="showCompleterDetailsEntreprise('${c.id}')" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 16px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">📋 Détails entreprise (masse salariale, assurances, LPP...)</button>` : ''}
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
          ${badge(mandatsSignes.some(m => m.signe) ? '🖊️ Mandat signé' : '🖊️ Mandat non signé', mandatsSignes.some(m => m.signe) ? '#4ade80' : '#64748b')}
          <div style="display:flex;gap:4px;margin-left:6px">
            ${c.statut !== 'prospect' ? `<button onclick="changerStatutClient('${c.id}','prospect')" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:6px;padding:3px 9px;font-size:10.5px;cursor:pointer;font-weight:700">→ Prospect</button>` : ''}
            ${c.statut !== 'actif' ? `<button onclick="changerStatutClient('${c.id}','actif')" style="background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:6px;padding:3px 9px;font-size:10.5px;cursor:pointer;font-weight:700">✓ Client actif</button>` : ''}
            ${c.statut !== 'inactif' ? `<button onclick="changerStatutClient('${c.id}','inactif')" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:6px;padding:3px 9px;font-size:10.5px;cursor:pointer;font-weight:700">Inactif</button>` : ''}
          </div>
        </div>
      </div>
      ${c.prenatal ? `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(244,114,182,0.08);border:1px solid rgba(244,114,182,0.3);border-radius:10px;margin-bottom:16px">
        <div style="font-size:22px">🍼</div>
        <div style="flex:1">
          <div style="font-size:12.5px;font-weight:700;color:var(--text)">Naissance à venir${c.date_naissance ? ' — prévue le ' + fmtDate(c.date_naissance) : ''}</div>
          <div style="font-size:10.5px;color:var(--text-muted)">Assurance prénatale — les contrats LAMal/LCA sont suivis dès maintenant, la commission se déclenchera une fois la naissance confirmée.</div>
        </div>
        <button onclick="ouvrirAnnonceNaissance('${c.id}')" style="background:rgba(244,114,182,0.16);border:1px solid rgba(244,114,182,0.4);color:#f472b6;border-radius:8px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">🎉 Annoncer la naissance</button>
      </div>` : ''}
      <div class="stat-grid" style="margin-bottom:16px">
        ${statCard('Contrats', contrats.length, '#38bdf8')}
        ${statCard('Rappels ouverts', rappels.filter(r => r.statut === 'ouvert').length, rappels.filter(r => r.statut === 'ouvert').length > 0 ? '#f87171' : '#64748b')}
        ${estRoleRH() ? '' : statCard('CA annuel', caClient(c.id) ? 'CHF ' + caClient(c.id).toLocaleString() : '—', '#f59e0b')}
      </div>
      ${(() => {
        const oppsClient = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).filter(o => o.client_id === c.id);
        if (!oppsClient.length) return '';
        const stadeColor = { Contact:'#64748b', Analyse:'#38bdf8', Proposition:'#f59e0b', Négociation:'#a78bfa', 'Gagné':'#4ade80', 'Perdu':'#f87171' };
        return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 16px;background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;margin-bottom:16px">
          <span style="font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0">🎯 Opportunités</span>
          ${oppsClient.map(o => `<span onclick="opportuniteEnEditionId='${o.id}';navigate('nouvelle-opportunite')" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:11.5px;font-weight:700;color:var(--text)">
            <span style="width:7px;height:7px;border-radius:50%;background:${stadeColor[o.stade]||'#64748b'};flex-shrink:0"></span>
            ${o.titre} <span style="color:${stadeColor[o.stade]||'#64748b'};font-weight:800">· ${o.stade}</span>
          </span>`).join('')}
        </div>`;
      })()}
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
      ${estRoleRH() ? '' : `<button class="tab-btn" onclick="switchTab(this,'tab-prevoyance')">Prévoyance</button>`}
      ${isEntreprise ? `<button class="tab-btn" onclick="switchTab(this,'tab-collaborateurs')">Collaborateurs (${collaborateurs.length})</button>` : ''}
      ${isEntreprise ? `<button class="tab-btn" onclick="switchTab(this,'tab-flotte')">🚗 Flotte (${allVehicules.filter(v=>v.client_id===c.id).length})</button>` : ''}
      ${estRoleRH() ? '' : `<button class="tab-btn" onclick="switchTab(this,'tab-contrats')">Contrats (${contrats.length})</button>`}
      ${estRoleRH() ? '' : `<button class="tab-btn" onclick="switchTab(this,'tab-factures')">Factures (${factures.length})</button>`}
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
          <div class="form-field"><label class="form-label">Civilité</label><select id="ec-civilite" class="form-input"><option value="">—</option><option value="Monsieur" ${c.civilite==='Monsieur'?'selected':''}>Monsieur</option><option value="Madame" ${c.civilite==='Madame'?'selected':''}>Madame</option></select></div>
          <div class="form-field"><label class="form-label">Prénom</label><input id="ec-prenom" class="form-input" value="${c.prenom || ''}"></div>
          <div class="form-field"><label class="form-label">Nom</label><input id="ec-nom" class="form-input" value="${c.nom || ''}"></div>
          <div class="form-field"><label class="form-label">Date de naissance${c.prenatal ? ' prévue (grossesse en cours)' : ''}</label><input id="ec-date-naissance" type="date" class="form-input" value="${c.date_naissance || ''}"></div>
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
      ${sectionCard('📄 Documents & mandats signés', '#38bdf8', `
        <div style="margin-bottom:12px">
          <label style="background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;padding:7px 14px;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer;display:inline-block">
            📤 Uploader un mandat signé à la main (PDF ou photo)
            <input type="file" accept="application/pdf,image/*" style="display:none" onchange="uploadMandatSigne('${c.id}', this)"/>
          </label>
        </div>
        ${mandatsSignes.length ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${mandatsSignes.map(m => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:var(--surface-alt);border-radius:9px;border:1px solid var(--border)">
              <div style="flex:1">
                <div style="font-size:12.5px;font-weight:700;color:var(--text)">${fmtDate(m.created_at)} ${m.signe ? '<span style="color:#4ade80">✓ Signé</span>' : '<span style="color:var(--text-muted)">Non signé</span>'}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${m.fichier_url ? '📎 ' + (m.fichier_nom || 'Fichier uploadé') : (m.cree_par ? 'Généré par ' + m.cree_par : 'Généré dans le CRM')}</div>
              </div>
              <button onclick="voirMandatSauvegarde('${m.id}')" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-border);border-radius:7px;padding:6px 14px;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap">👁️ Voir / Télécharger</button>
              <button onclick="supprimerMandatSauvegarde('${m.id}','${c.id}')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:16px;padding:0 4px" title="Supprimer">✕</button>
            </div>`).join('')}
        </div>
        ` : `<div style="font-size:12px;color:var(--text-muted)">Rien d'enregistré pour l'instant — utilise "📄 Mandat de courtage" ou "📎 Faire signer un contrat" en haut de la fiche, ou uploade un document déjà signé à la main.</div>`}
      `)}
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
                  <div style="font-weight:800;color:#f59e0b;font-size:13px">CHF ${fmtCHF(Number(ct.prime_annuelle||0))}/an</div>
                  <div style="font-size:10px;color:var(--text-muted)">CHF ${fmtCHF(Math.round(Number(ct.prime_annuelle||0)/12*100)/100)}/mois</div>
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
          ${ct.modules ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:3px;line-height:1.5">🔗 ${ct.modules.split(', ').join(' · ')}</div>` : ''}
        </div>
        <div style="font-size:13px;color:var(--text)">${ct.compagnie}</div>
        <div style="font-size:12px;color:var(--text-muted)">${fmtDate(ct.date_echeance)}</div>
        <div style="font-weight:800;color:#f59e0b">CHF ${fmtCHF(Number(ct.prime_annuelle || 0))}</div>
        <div>${badge(ct.statut, ct.statut === 'actif' ? '#4ade80' : ct.statut === 'renouveler' ? '#f59e0b' : '#f87171')}${ct.commissionne === false ? ' ' + badge('Non commissionné', '#64748b') : ''}</div>
        <div style="display:flex;gap:4px;align-items:center" onclick="event.stopPropagation()">
          ${ct.police_url
            ? `<button onclick="ouvrirPieceJointe('${ct.police_url}')" title="Voir la police PDF" style="background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:7px;padding:5px 8px;font-size:13px;cursor:pointer;line-height:1">📄</button>`
            : `<label title="Joindre la police PDF" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:5px 8px;font-size:13px;cursor:pointer;line-height:1">📎<input type="file" accept="application/pdf" onchange="uploadPolicePdf('${ct.id}', this)" style="display:none"/></label>`
          }
          <button onclick="showEditContrat('${ct.id}')" style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);border-radius:7px;padding:5px 8px;font-size:13px;cursor:pointer;line-height:1" title="Modifier">✏️</button>
        </div>
      </div>`).join('')}</div>` : '<div class="table-empty">Aucun contrat.</div>'}
    </div>

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
          <div style="font-weight:800;color:#f59e0b">CHF ${fmtCHF(Number(f.montant||0))}</div>
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
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn-add" onclick="prefillRappelClientId='${c.id}'; navigate('nouveau-rappel')" title="Créer une tâche liée à ce client">📋+ Tâche</button>
      </div>
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
// Contexte de la signature en cours — null pour le mandat de courtage générique (comportement
// d'origine), ou {type:'contrat', documentNom, documentPath} quand ouvrirSignatureMandat() est
// appelée depuis ouvrirUploadContratSignature() pour faire signer un contrat quelconque déjà
// uploadé (demande de Jonathan le 07.08.2026 : « uploader des contrats et récupérer la
// signature », au-delà du seul mandat de courtage à texte fixe).
let signatureContexteActuel = null;

// ═══ FEUILLE DE RÉSILIATION — génération + signature via le même système que les contrats/mandats ═══
// Demande de Jonathan le 07.08.2026 : bouton sur la fiche client pour générer une lettre de
// résiliation (LAMal, LCA, vie liée 3A, vie libre 3B) avec les coordonnées du client reprises
// automatiquement, puis faire signer via les 4 canaux existants (ici, QR/lien, e-mail, WhatsApp).
// Réutilise ouvrirSignatureMandat() avec contexte.type = 'resiliation' — contenuCorps porte le
// texte de la lettre (sans l'entête HTML complète), documentData porte une URL data:text/html
// pour la prévisualisation (côté staff ET côté client à distance, sans compte).
const RESILIATION_TYPES = [
  { id: 'lamal', label: 'LAMal (assurance de base)', note: "Délai légal : la résiliation pour la fin de l'année doit parvenir à la caisse au plus tard le 30 novembre (art. 7 LAMal)." },
  { id: 'lca', label: 'LCA (complémentaires)', note: "Vérifie le délai contractuel de résiliation (souvent 3 mois avant l'échéance annuelle)." },
  { id: 'vie3a', label: 'Assurance vie liée — pilier 3A', note: "Le rachat/transfert du pilier 3a obéit à des règles spécifiques — vérifie les conditions du contrat avant d'envoyer." },
  { id: 'vie3b', label: 'Assurance vie libre — pilier 3B', note: "Vérifie la valeur de rachat et d'éventuelles pénalités avant d'envoyer." },
];

function afficherNoteResiliation(typeId) {
  const t = RESILIATION_TYPES.find(x => x.id === typeId);
  const el = document.getElementById('res-note');
  if (el) el.textContent = t ? t.note : '';
}

function ouvrirModaleResiliation(clientId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const contratsClient = allContrats.filter(ct => ct.client_id === clientId);
  const contratOptions = contratsClient.map(ct => `<option value="${ct.id}" data-compagnie="${(ct.compagnie || '').replace(/"/g, '&quot;')}" data-police="${(ct.numero_police || '').replace(/"/g, '&quot;')}">${ct.produit || 'Contrat'} — ${ct.compagnie || ''}${ct.numero_police ? ' (' + ct.numero_police + ')' : ''}</option>`).join('');
  creerModale('modal-resiliation', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:480px;width:100%">
      <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">📝 Générer une feuille de résiliation</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:16px">Sélectionne le type d'assurance à résilier — les coordonnées du client sont reprises automatiquement dans la lettre.</div>
      <div class="form-grid">
        <div class="form-field" style="grid-column:span 2">
          <label class="form-label">Type d'assurance *</label>
          <select class="form-select" id="res-type" onchange="afficherNoteResiliation(this.value)">
            ${RESILIATION_TYPES.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
          </select>
          <div id="res-note" style="font-size:10.5px;color:var(--text-muted);margin-top:6px">${RESILIATION_TYPES[0].note}</div>
        </div>
        ${contratsClient.length ? `<div class="form-field" style="grid-column:span 2">
          <label class="form-label">Contrat concerné (optionnel — pré-remplit compagnie et n° de police)</label>
          <select class="form-select" id="res-contrat" onchange="const o=this.selectedOptions[0];document.getElementById('res-compagnie').value=o?o.dataset.compagnie||'':'';document.getElementById('res-police').value=o?o.dataset.police||'':''">
            <option value="">— Aucun / saisie manuelle —</option>
            ${contratOptions}
          </select>
        </div>` : ''}
        <div class="form-field"><label class="form-label">Compagnie destinataire</label><input class="form-input" id="res-compagnie" placeholder="Ex: CSS Assurance"/></div>
        <div class="form-field"><label class="form-label">N° de police</label><input class="form-input" id="res-police" placeholder="Ex: 123.456.789"/></div>
        <div class="form-field" style="grid-column:span 2"><label class="form-label">Adresse de la compagnie (optionnel)</label><input class="form-input" id="res-compagnie-adresse" placeholder="Ex: Case postale, 1001 Lausanne"/></div>
        <div class="form-field"><label class="form-label">Date d'effet souhaitée</label><input class="form-input" id="res-date-effet" type="date"/></div>
        <div class="form-field" style="display:flex;align-items:flex-end;padding-bottom:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;color:var(--text)">
            <input type="checkbox" id="res-recommandee" checked style="width:15px;height:15px;cursor:pointer"/> Envoi recommandé
          </label>
        </div>
      </div>
      <div id="erreur-resiliation" style="color:#f87171;font-size:11.5px;margin-top:8px;display:none"></div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn-secondary" onclick="document.getElementById('modal-resiliation').remove()">Annuler</button>
        <button class="btn-save" onclick="confirmerResiliation('${clientId}')" style="margin-left:auto">Continuer →</button>
      </div>
    </div>`, { opacite: 0.8, padding: '16px', overflowY: false });
}

// Modèle de lettre commerciale suisse classique (entête société, date/lieu et mention
// "Recommandée" en haut à droite, bloc destinataire, objet en gras, corps, formule de politesse,
// signature) — reprend la structure et les formulations d'un modèle de résiliation d'assurance
// fourni par Jonathan le 07.08.2026, avec le bandeau Assurex (genererBadgeLogoAssurex, déjà
// utilisé pour le mandat de courtage) plutôt qu'un logo générique.
// Document volontairement dépourvu de toute mention Assurex (demande de Jonathan le 07.08.2026) :
// c'est une lettre PERSONNELLE du client à son assureur, pas un document Assurex — y apposer le
// logo/l'entête du courtier aurait été trompeur sur l'identité de l'expéditeur. Mise en page
// simple d'une lettre suisse classique : expéditeur en haut à gauche, date/lieu à droite,
// destinataire, objet, corps, formule de politesse, signature — rien d'autre.
function construireHtmlResiliation(corps, titre, signatureDataUrl) {
  return `<html><head><meta charset="utf-8"><title>${(titre || 'Résiliation').replace(/</g, '&lt;')}</title><style>
    body{font-family:Arial,sans-serif;padding:40px 45px;color:#000;font-size:12.5px;line-height:1.7;max-width:700px;margin:0 auto}
    .entete{display:flex;justify-content:space-between;align-items:flex-start}
    .expediteur{font-size:12px}
    .recommandee{font-weight:700;font-size:12px}
    .date-ligne{text-align:right;margin-top:10px;font-size:12px}
    .destinataire{margin-top:42px;font-size:12.5px}
    .objet{margin-top:36px;font-weight:700;font-size:13px}
    p{margin:12px 0}
    .signature-zone{margin-top:44px}
    .ligne-signature{border-top:1px solid #000;margin-top:46px;padding-top:5px;font-style:italic;font-size:11px;max-width:220px}
    .print-btn{margin-top:30px;padding:9px 18px;background:#000;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px}
    @media print { .print-btn { display: none !important; } body { padding: 15px 20px; } }
  </style></head><body>
    ${corps}
    <button class="print-btn" onclick="window.print()">🖨️ Imprimer</button>
  </body></html>`;
}

function confirmerResiliation(clientId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const typeId = document.getElementById('res-type').value;
  const typeInfo = RESILIATION_TYPES.find(t => t.id === typeId);
  const compagnie = document.getElementById('res-compagnie').value.trim();
  const compagnieAdresse = document.getElementById('res-compagnie-adresse').value.trim();
  const police = document.getElementById('res-police').value.trim();
  const dateEffet = document.getElementById('res-date-effet').value;
  const recommandee = document.getElementById('res-recommandee').checked;
  const erreurEl = document.getElementById('erreur-resiliation');
  if (!compagnie) { erreurEl.textContent = 'Indique la compagnie destinataire.'; erreurEl.style.display = 'block'; return; }
  if (!dateEffet) { erreurEl.textContent = "Indique la date d'effet souhaitée."; erreurEl.style.display = 'block'; return; }

  const isEnt = estEntreprise(c);
  const nomClient = isEnt ? c.nom : `${c.civilite ? c.civilite + ' ' : ''}${c.prenom} ${c.nom}`;
  const adresseClient = `${c.adresse || ''}${c.adresse ? ', ' : ''}${c.npa || ''} ${c.ville || ''}`.trim();
  const dateEffetFr = fmtDate(dateEffet);
  const aujourdhui = fmtDate(new Date().toISOString());
  const echapper = s => (s || '').replace(/</g, '&lt;');

  const noteLamal = typeId === 'lamal'
    ? `<p>Pour la LAMal, le nouvel assureur vous adressera prochainement une attestation d'assurance.</p>`
    : '';
  // Lieu de la date = localité du client (expéditeur réel de la lettre), pas St-Sulpice —
  // ce document n'a plus aucune mention Assurex, donc plus de raison d'utiliser l'adresse du
  // courtier ici. c.ville contient déjà "NPA Localité" (convention du CRM) : on retire le NPA.
  const localiteClient = (c.ville || '').replace(/^\d{4}\s*/, '').trim();

  const corps = `
    <div class="entete">
      <div class="expediteur"><strong>${echapper(nomClient)}</strong>${adresseClient ? `<br/>${echapper(adresseClient)}` : ''}</div>
      ${recommandee ? `<div class="recommandee">Recommandée</div>` : ''}
    </div>
    <div class="date-ligne">${localiteClient ? echapper(localiteClient) + ', ' : ''}le ${aujourdhui}</div>
    <div class="destinataire">
      <strong>${echapper(compagnie)}</strong>${compagnieAdresse ? `<br/>${echapper(compagnieAdresse)}` : ''}
    </div>
    <div class="objet">Résiliation du contrat d'assurance${police ? ' n° ' + echapper(police) : ''}</div>
    <p style="margin-top:18px">Madame, Monsieur,</p>
    <p>Par la présente lettre, je vous notifie de la résiliation de mon contrat d'assurance cité en référence :</p>
    <p>☑ ${typeInfo.label} avec effet au <strong>${dateEffetFr}</strong></p>
    ${noteLamal}
    <p>Je vous remercie de bien vouloir me faire parvenir une confirmation par courrier, et dans cette attente, de bien vouloir croire en l'expression de mes meilleures salutations.</p>
    <div class="signature-zone">
      <div>${echapper(nomClient)}</div>
    </div>
  `;

  document.getElementById('modal-resiliation').remove();
  const titreDoc = `Résiliation ${typeInfo.label}${compagnie ? ' — ' + compagnie : ''}`;
  const previewHtml = construireHtmlResiliation(corps, titreDoc, null);
  ouvrirSignatureMandat(clientId, {
    type: 'resiliation',
    documentNom: titreDoc,
    contenuCorps: corps,
    documentData: 'data:text/html;charset=utf-8,' + encodeURIComponent(previewHtml),
  });
}

function genererLettreResiliationSignee(clientId, signatureDataUrl, contexte) {
  // La zone de signature est injectée ici (et non dans contenuCorps) car elle dépend de
  // signatureDataUrl, connu seulement au moment de la signature — contenuCorps reste identique
  // entre l'aperçu (avant signature) et le document final.
  const corpsAvecSignature = contexte.contenuCorps + `
    <div class="signature-zone" style="margin-top:6px">
      ${signatureDataUrl ? `<div style="margin-top:8px"><img src="${signatureDataUrl}" style="max-height:80px;max-width:260px;display:block"/></div>` : `<div class="ligne-signature">Signature</div>`}
    </div>`;
  const html = construireHtmlResiliation(corpsAvecSignature, contexte.documentNom, signatureDataUrl);
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  dbPost('mandats_signes', {
    client_id: clientId,
    signe: !!signatureDataUrl,
    cree_par: (typeof supaSession !== 'undefined' && supaSession && supaSession.email) || null,
    html_snapshot: html,
    fichier_nom: contexte.documentNom || null,
  }).then(r => {
    if (r && r.error) console.error("Échec de l'enregistrement de la résiliation sur la fiche :", errMsg(r));
    showClient(clientId);
  });
}

function ouvrirSignatureMandat(clientId, contexte) {
  signatureContexteActuel = contexte || null;
  const titreModale = signatureContexteActuel ? `✍️ Signature — ${signatureContexteActuel.documentNom}` : '✍️ Signature du mandant';
  creerModale('modal-signature-mandat', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:520px;width:100%">
      <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">${titreModale}</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px">Choisis comment le client va signer :</div>
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        <button id="onglet-signature-ici" class="btn-secondary" onclick="basculerModeSignature('ici', '${clientId}')" style="flex:1;min-width:110px;font-size:11.5px">✍️ Ici, sur cet écran</button>
        <button id="onglet-signature-qr" class="btn-secondary" onclick="basculerModeSignature('qr', '${clientId}')" style="flex:1;min-width:110px;font-size:11.5px">📱 QR code / lien</button>
        <button id="onglet-signature-email" class="btn-secondary" onclick="basculerModeSignature('email', '${clientId}')" style="flex:1;min-width:110px;font-size:11.5px">✉️ Par e-mail</button>
        <button id="onglet-signature-whatsapp" class="btn-secondary" onclick="basculerModeSignature('whatsapp', '${clientId}')" style="flex:1;min-width:110px;font-size:11.5px">📲 WhatsApp</button>
      </div>
      <div id="zone-mode-signature"></div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn-secondary" onclick="genererSansSignature('${clientId}')">🖨️ Sans signature (impression)</button>
      </div>
    </div>`, { opacite: 0.8, padding: '16px', overflowY: false });
  basculerModeSignature('ici', clientId);
}

// Bascule entre les 3 modes de signature : ici sur cet écran, via QR code/lien à distance,
// ou envoi direct par e-mail au client. Ce sont 3 options indépendantes, pas des sous-options.
function basculerModeSignature(mode, clientId) {
  ['ici', 'qr', 'email', 'whatsapp'].forEach(m => {
    document.getElementById(`onglet-signature-${m}`).style.background = mode === m ? 'var(--accent-dim)' : 'var(--surface-alt)';
  });
  clearInterval(window._pollingSignatureInterval);
  const zone = document.getElementById('zone-mode-signature');
  if (mode === 'ici') {
    const boutonVoirDocumentIci = (signatureContexteActuel && signatureContexteActuel.type === 'contrat' && signatureContexteActuel.documentPath)
      ? `<button type="button" onclick="ouvrirPieceJointe('${signatureContexteActuel.documentPath}')" style="display:block;width:100%;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface-alt);color:var(--text);font-weight:700;font-size:11.5px;cursor:pointer">📄 Voir le document avant de faire signer</button>`
      : (signatureContexteActuel && signatureContexteActuel.type === 'resiliation' && signatureContexteActuel.documentData)
      ? `<button type="button" onclick="window.open(signatureContexteActuel.documentData, '_blank')" style="display:block;width:100%;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface-alt);color:var(--text);font-weight:700;font-size:11.5px;cursor:pointer">📄 Voir le document avant de faire signer</button>`
      : '';
    zone.innerHTML = `
      ${boutonVoirDocumentIci}
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
function initCanvasSignature(canvasId = 'canvas-signature') {
  const canvas = document.getElementById(canvasId);
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

function effacerSignature(canvasId = 'canvas-signature') {
  const canvas = document.getElementById(canvasId);
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// Bug corrigé le 07.08.2026 : le bouton "Sans signature" fermait la modale sans rien produire.
// Il doit ouvrir le document (contrat/résiliation/mandat) prêt à imprimer, sans image de
// signature — utile quand le client signe à la main sur une version papier plutôt qu'à l'écran.
function genererSansSignature(clientId) {
  document.getElementById('modal-signature-mandat').remove();
  const contexte = signatureContexteActuel;
  signatureContexteActuel = null;
  if (contexte && contexte.type === 'contrat') genererDocumentSigne(clientId, null, contexte);
  else if (contexte && contexte.type === 'resiliation') genererLettreResiliationSignee(clientId, null, contexte);
  else genererMandatCourtage(clientId, null);
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
  const contexte = signatureContexteActuel;
  signatureContexteActuel = null;
  if (contexte && contexte.type === 'contrat') genererDocumentSigne(clientId, signatureDataUrl, contexte);
  else if (contexte && contexte.type === 'resiliation') genererLettreResiliationSignee(clientId, signatureDataUrl, contexte);
  else genererMandatCourtage(clientId, signatureDataUrl);
}

// Génère un lien de signature à distance (QR code + lien copiable) et attend que le client
// signe sur son propre téléphone — sondage régulier de la base jusqu'à réception de la signature.
async function envoyerVersAutreAppareil(clientId, mode) {
  const c = allClients.find(x => x.id === clientId);
  const nomClient = c ? (estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`) : '';
  const token = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // Contexte figé dès l'ouverture du mode (avant tout await) : signatureContexteActuel pourrait
  // changer si l'utilisateur rouvre une autre modale entre-temps sur le même onglet.
  const contexteFige = signatureContexteActuel;
  // Insertion en fetch direct avec Prefer: return=minimal (plutôt que dbPost, qui demande
  // return=representation) — corrige un bug du 07.08.2026 : la lecture de la ligne fraîchement
  // insérée nécessite une policy SELECT, or celle-ci a été retirée pour le rôle anonyme lors du
  // durcissement sécurité (elle exposait toutes les signatures à qui connaît la clé publique).
  // Comme le token est déjà connu côté client (généré juste au-dessus), on n'a de toute façon
  // pas besoin que le serveur nous renvoie la ligne — return=minimal évite complètement le
  // problème, sans rouvrir l'accès en lecture anonyme.
  let insertOk = false;
  try {
    const tokenAcces = await getValidAccessToken() || SUPABASE_KEY;
    const resInsert = await fetch(`${SUPABASE_URL}/rest/v1/signature_requests`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${tokenAcces}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        token, client_id: clientId, client_nom: nomClient,
        type: contexteFige ? contexteFige.type : null,
        document_nom: contexteFige ? contexteFige.documentNom : null,
        document_data: contexteFige ? (contexteFige.documentData || null) : null,
      }),
    });
    insertOk = resInsert.ok;
  } catch (e) { insertOk = false; }
  if (!insertOk) {
    document.getElementById('zone-mode-signature').innerHTML = `<div style="color:#f87171;font-size:12.5px">Impossible de créer le lien de signature — réessaie, ou contacte le support si le problème persiste.</div>`;
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
  } else if (mode === 'whatsapp') {
    // Lien "click-to-chat" WhatsApp (wa.me) — pas d'intégration WhatsApp Business API, juste
    // l'ouverture de WhatsApp (web ou appli) avec le message et le lien de signature déjà rédigés,
    // à envoyer manuellement d'un clic. Numéro pris depuis la fiche client (c.mobile) ; si absent
    // ou mal formaté, ouvre WhatsApp sans destinataire pré-rempli (choix du contact à la main).
    let telClean = (c && c.mobile) ? c.mobile.replace(/[^\d]/g, '') : '';
    if (telClean.startsWith('00')) telClean = telClean.slice(2);
    if (telClean.startsWith('0')) telClean = '41' + telClean.slice(1); // 0791234567 → 41791234567 (CH par défaut)
    const estContratWa = contexteFige && contexteFige.type === 'contrat';
    const estResiliationWa = contexteFige && contexteFige.type === 'resiliation';
    const messageWhatsapp = estContratWa
      ? `Bonjour${c && !estEntreprise(c) && c.prenom ? ' ' + c.prenom : ''}, afin de valider la proposition d'assurance, veuillez signer dans l'encadré en suivant ce lien : ${lienSignature}`
      : estResiliationWa
      ? `Bonjour${c && !estEntreprise(c) && c.prenom ? ' ' + c.prenom : ''}, afin de valider la résiliation de votre police, veuillez signer dans l'encadré en suivant ce lien : ${lienSignature}`
      : `Bonjour${c && !estEntreprise(c) && c.prenom ? ' ' + c.prenom : ''}, afin de valider votre mandat de courtage, veuillez signer dans l'encadré en suivant ce lien : ${lienSignature}`;
    const lienWhatsapp = `https://wa.me/${telClean}?text=${encodeURIComponent(messageWhatsapp)}`;
    zone.innerHTML = `
      <div style="text-align:center">
        ${telClean ? `<div style="font-size:12.5px;color:var(--text);margin-bottom:12px">Envoyer le lien de signature par WhatsApp à <strong>${c.mobile}</strong></div>`
                    : `<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px">Aucun mobile enregistré pour ce client — WhatsApp s'ouvrira sans destinataire, choisis le contact à la main.</div>`}
        <a href="${lienWhatsapp}" target="_blank" rel="noopener" class="btn-save" style="display:block;width:100%;text-decoration:none;box-sizing:border-box">📲 Ouvrir WhatsApp et envoyer</a>
        <div style="display:flex;gap:6px;margin-top:10px">
          <input class="form-input" readonly value="${lienSignature}" style="font-size:10.5px" onclick="this.select()"/>
          <button class="btn-secondary" onclick="navigator.clipboard.writeText('${lienSignature}')">📋 Copier</button>
        </div>
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
    const resultats = await dbRpc('get_signature_request', { p_token: token });
    const demande = resultats && resultats[0];
    if (demande && demande.signature_data) {
      clearInterval(window._pollingSignatureInterval);
      document.getElementById('modal-signature-mandat')?.remove();
      signatureContexteActuel = null;
      if (contexteFige && contexteFige.type === 'contrat') genererDocumentSigne(clientId, demande.signature_data, contexteFige);
      else if (contexteFige && contexteFige.type === 'resiliation') genererLettreResiliationSignee(clientId, demande.signature_data, contexteFige);
      else genererMandatCourtage(clientId, demande.signature_data);
    }
  }, 3000);
}

// Envoie le lien de signature par e-mail via Microsoft Graph (même mécanisme que les
// notifications de rappels/tâches assignées) — nécessite d'être connecté à Outlook dans le CRM.
async function envoyerLienSignatureParEmail(clientId, lienSignature, emailDestinataire) {
  const btn = document.getElementById('btn-envoi-email-signature');
  if (!(await assurerTokenOutlook())) {
    showError('Connecte-toi à Outlook (Microsoft) dans le CRM pour pouvoir envoyer cet e-mail.');
    return;
  }
  if (btn) { btn.textContent = 'Envoi en cours...'; btn.disabled = true; }
  const c = allClients.find(x => x.id === clientId);
  const nomClient = c ? (estEntreprise(c) ? c.nom : c.prenom) : '';
  // Message adapté au contexte — mandat de courtage générique, ou validation d'un contrat/d'une
  // proposition d'assurance uploadée (demande de Jonathan le 07.08.2026 : le mail ne doit plus
  // toujours parler de "mandat" quand ce n'est pas le mandat de courtage qui est signé).
  const estContrat = signatureContexteActuel && signatureContexteActuel.type === 'contrat';
  const estResiliation = signatureContexteActuel && signatureContexteActuel.type === 'resiliation';
  const sujet = estContrat
    ? `Signature — ${signatureContexteActuel.documentNom} — Assurex Sàrl`
    : estResiliation
    ? `Signature — ${signatureContexteActuel.documentNom} — Assurex Sàrl`
    : 'Signature de votre mandat de courtage — Assurex Sàrl';
  const contenu = estContrat
    ? `Bonjour ${nomClient || ''},\n\nAfin de valider la proposition d'assurance, veuillez signer dans l'encadré prévu à cet effet en suivant ce lien depuis votre téléphone ou votre ordinateur :\n\n${lienSignature}\n\nLa signature ne prend qu'une minute.\n\nMeilleures salutations,\nAssurex Sàrl`
    : estResiliation
    ? `Bonjour ${nomClient || ''},\n\nAfin de valider la résiliation de votre police, veuillez signer dans l'encadré prévu à cet effet en suivant ce lien depuis votre téléphone ou votre ordinateur :\n\n${lienSignature}\n\nLa signature ne prend qu'une minute.\n\nMeilleures salutations,\nAssurex Sàrl`
    : `Bonjour ${nomClient || ''},\n\nAfin de valider votre mandat de courtage, veuillez signer dans l'encadré prévu à cet effet en suivant ce lien depuis votre téléphone ou votre ordinateur :\n\n${lienSignature}\n\nLa signature ne prend qu'une minute.\n\nMeilleures salutations,\nAssurex Sàrl`;
  const body = {
    message: {
      subject: sujet,
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

  const resultats = await dbRpc('get_signature_request', { p_token: token });
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

  const titreAutonome = (demande.type === 'contrat' || demande.type === 'resiliation') && demande.document_nom
    ? `Signature — ${demande.document_nom}`
    : 'Signature du mandat de courtage';
  // Le client doit pouvoir consulter le document avant de le signer — condition de base pour
  // une signature électronique valable (demande de Jonathan le 07.08.2026 : "est-ce qu'il peut
  // visualiser avant [de signer] ?"). Le PDF est embarqué en base64 dans document_data au moment
  // de la création de la demande (voir confirmerUploadContratPuisSigner), justement pour rester
  // consultable ici sans que ce client, non connecté, ait besoin d'un accès au stockage privé.
  const boutonVoirDocument = demande.document_data
    ? `<a href="${demande.document_data}" target="_blank" rel="noopener" style="display:block;margin-bottom:14px;padding:10px;border-radius:8px;border:1.5px solid #0f2244;color:#0f2244;font-weight:700;font-size:12.5px;text-decoration:none">📄 Voir le document avant de signer</a>`
    : '';
  zone.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#0f2244;margin-bottom:4px">${titreAutonome}</div>
    <div style="font-size:12.5px;color:#666;margin-bottom:16px">${demande.client_nom || ''}</div>
    ${boutonVoirDocument}
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

// ═══ RÉSERVATION DE RDV EN AUTONOMIE — page publique liée à un agent (?rdv=TOKEN) ═══
// Même principe que la signature autonome ci-dessus : un lien sans connexion CRM, protégé par un
// token non devinable (agents.rdv_token). Le client choisit un motif, puis un créneau parmi ceux
// réellement libres (calculerCreneauxLibresRdv, js/03), saisit ses coordonnées si le lien n'est
// pas déjà associé à une fiche client connue (paramètre ?client=ID pour un lien personnalisé), et
// confirme. Le RDV est poussé dans l'agenda Outlook de l'agent à sa prochaine connexion au CRM
// (voir synchroniserRdvOutlook, js/03) — pas d'écriture directe dans Outlook depuis cette page
// publique, qui n'a et ne doit pas avoir accès au compte Microsoft de l'agent.
let _rdvEtat = null;

async function afficherPageReservationRdv(token, clientIdPrefill) {
  document.body.innerHTML = `<div id="page-rdv-autonome" style="min-height:100vh;background:#0f2244;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Arial,sans-serif">
    <div style="background:#fff;border-radius:16px;padding:24px;max-width:460px;width:100%">
      <div id="contenu-rdv-autonome"><p style="color:#666;text-align:center">Chargement...</p></div>
    </div>
  </div>`;
  const zone = document.getElementById('contenu-rdv-autonome');

  const agents = await dbGet('agents', `rdv_token=eq.${encodeURIComponent(token)}&rdv_actif=eq.true&select=id,prenom,nom,rdv_jours_travail,rdv_heure_debut,rdv_heure_fin,rdv_duree_defaut,rdv_delai_min_heures,rdv_horizon_jours,rdv_busy_cache`);
  const agent = agents && agents[0];
  if (!agent) { zone.innerHTML = `<p style="color:#c0392b;text-align:center">Ce lien de prise de rendez-vous n'est plus valide.</p>`; return; }

  let clientPrefill = null;
  if (clientIdPrefill) {
    const clients = await dbGet('clients', `id=eq.${clientIdPrefill}&select=id,prenom,nom,email,tel`);
    clientPrefill = (clients && clients[0]) || null;
  }

  const existants = await dbGet('rendez_vous', `agent_id=eq.${agent.id}&statut=eq.confirme&select=date_heure,duree_min`);

  _rdvEtat = { token, agent, clientPrefill, existants: existants || [], type: null, date: null, heure: null, joursDisponibles: [] };
  renderEtapeTypeRdv();
}

function renderEtapeTypeRdv() {
  const zone = document.getElementById('contenu-rdv-autonome');
  zone.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#0f2244;margin-bottom:4px">Prendre rendez-vous</div>
    <div style="font-size:12.5px;color:#666;margin-bottom:16px">avec ${_rdvEtat.agent.prenom} ${_rdvEtat.agent.nom}</div>
    <div style="font-size:11px;color:#888;margin-bottom:10px">Choisissez le motif du rendez-vous</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${TYPES_RDV.map(t => `<button onclick="choisirTypeRdv('${t.replace(/'/g, "\\'")}')" style="padding:12px;border-radius:8px;border:1.5px solid #0f2244;background:#fff;color:#0f2244;font-weight:700;font-size:13px;cursor:pointer;text-align:left">${t}</button>`).join('')}
    </div>`;
}

function choisirTypeRdv(type) {
  _rdvEtat.type = type;
  renderEtapeCreneaux();
}

function renderEtapeCreneaux() {
  const zone = document.getElementById('contenu-rdv-autonome');
  const dureeMin = _rdvEtat.agent.rdv_duree_defaut || 45;
  const jours = calculerCreneauxLibresRdv(_rdvEtat.agent, _rdvEtat.existants, dureeMin);
  _rdvEtat.joursDisponibles = jours;
  if (!jours.length) {
    zone.innerHTML = `<p style="color:#c0392b;text-align:center">Aucun créneau disponible pour le moment — contactez directement ${_rdvEtat.agent.prenom}.</p>
      <button onclick="renderEtapeTypeRdv()" style="margin-top:14px;width:100%;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff;color:#666;font-weight:700;cursor:pointer">← Retour</button>`;
    return;
  }
  const optionsDates = jours.map(j => `<option value="${j.date}">${fmtDateJourLong(j.date)}</option>`).join('');
  zone.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#0f2244;margin-bottom:4px">${_rdvEtat.type}</div>
    <div style="font-size:12.5px;color:#666;margin-bottom:16px">Choisissez un jour puis un créneau (${dureeMin} min)</div>
    <select class="form-select" id="rdv-select-jour" onchange="renderCreneauxDuJour()" style="width:100%;margin-bottom:12px">${optionsDates}</select>
    <div id="rdv-creneaux-jour" style="display:flex;flex-wrap:wrap;gap:8px"></div>
    <button onclick="renderEtapeTypeRdv()" style="margin-top:16px;width:100%;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff;color:#666;font-weight:700;cursor:pointer">← Retour</button>`;
  renderCreneauxDuJour();
}

function renderCreneauxDuJour() {
  const sel = document.getElementById('rdv-select-jour');
  const zone = document.getElementById('rdv-creneaux-jour');
  if (!sel || !zone) return;
  const jour = _rdvEtat.joursDisponibles.find(j => j.date === sel.value);
  zone.innerHTML = (jour ? jour.creneaux : []).map(h => `<button onclick="choisirCreneauRdv('${sel.value}','${h}')" style="padding:8px 12px;border-radius:7px;border:1.5px solid #0f2244;background:#fff;color:#0f2244;font-weight:700;font-size:12.5px;cursor:pointer">${h}</button>`).join('') || `<div style="font-size:12px;color:#888">Aucun créneau ce jour-là.</div>`;
}

function choisirCreneauRdv(date, heure) {
  _rdvEtat.date = date; _rdvEtat.heure = heure;
  renderEtapeCoordonnees();
}

function renderEtapeCoordonnees() {
  const zone = document.getElementById('contenu-rdv-autonome');
  const cp = _rdvEtat.clientPrefill;
  zone.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#0f2244;margin-bottom:4px">${_rdvEtat.type}</div>
    <div style="font-size:12.5px;color:#666;margin-bottom:16px">${fmtDateJourLong(_rdvEtat.date)} à ${_rdvEtat.heure}</div>
    ${cp ? `<div style="font-size:13px;color:#333;margin-bottom:14px">Pour : <strong>${cp.prenom} ${cp.nom}</strong></div>` : `
      <div style="margin-bottom:10px"><input class="form-input" id="rdv-nom" placeholder="Nom complet" style="width:100%"/></div>
      <div style="margin-bottom:10px"><input class="form-input" id="rdv-email" type="email" placeholder="Email" style="width:100%"/></div>
      <div style="margin-bottom:10px"><input class="form-input" id="rdv-tel" placeholder="Téléphone" style="width:100%"/></div>
    `}
    <div style="margin-bottom:14px"><textarea class="form-input" id="rdv-notes" rows="2" placeholder="Une précision à ajouter ? (facultatif)" style="width:100%"></textarea></div>
    <div style="display:flex;gap:8px">
      <button onclick="renderEtapeCreneaux()" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff;color:#666;font-weight:700;cursor:pointer">← Retour</button>
      <button onclick="confirmerReservationRdv()" style="flex:2;padding:10px;border-radius:8px;border:none;background:#0f2244;color:#fff;font-weight:700;cursor:pointer">✓ Confirmer le rendez-vous</button>
    </div>`;
}

async function confirmerReservationRdv() {
  const cp = _rdvEtat.clientPrefill;
  const nom = cp ? `${cp.prenom} ${cp.nom}` : (document.getElementById('rdv-nom')?.value || '').trim();
  const email = cp ? cp.email : (document.getElementById('rdv-email')?.value || '').trim();
  const tel = cp ? cp.tel : (document.getElementById('rdv-tel')?.value || '').trim();
  if (!nom) { alert('Merci d\'indiquer votre nom.'); return; }
  const notes = (document.getElementById('rdv-notes')?.value || '').trim();
  const dateHeureIso = `${_rdvEtat.date}T${_rdvEtat.heure}:00`;

  const body = {
    agent_id: _rdvEtat.agent.id,
    client_id: cp ? cp.id : null,
    prospect_nom: cp ? null : nom,
    prospect_email: email || null,
    prospect_tel: tel || null,
    type: _rdvEtat.type,
    date_heure: dateHeureIso,
    duree_min: _rdvEtat.agent.rdv_duree_defaut || 45,
    notes: notes || null,
    statut: 'confirme',
    cree_par: 'client',
  };
  const res = await dbPost('rendez_vous', body);
  if (res && res.error) {
    document.getElementById('contenu-rdv-autonome').innerHTML = `<p style="color:#c0392b;text-align:center">Une erreur est survenue — merci de réessayer ou de contacter directement ${_rdvEtat.agent.prenom}.</p>`;
    return;
  }
  const dureeMin = _rdvEtat.agent.rdv_duree_defaut || 45;
  const icsUrl = genererIcsRdv(_rdvEtat, dureeMin, nom);
  document.getElementById('contenu-rdv-autonome').innerHTML = `
    <div style="font-size:40px;margin-bottom:10px;text-align:center">✅</div>
    <p style="color:#333;font-weight:700;text-align:center">Rendez-vous confirmé !</p>
    <p style="color:#666;font-size:13px;text-align:center;margin-bottom:16px">${_rdvEtat.type}<br>${fmtDateJourLong(_rdvEtat.date)} à ${_rdvEtat.heure}</p>
    <a href="${icsUrl}" download="rendez-vous.ics" style="display:block;text-align:center;padding:10px;border-radius:8px;border:1.5px solid #0f2244;color:#0f2244;font-weight:700;font-size:12.5px;text-decoration:none">📅 Ajouter à mon calendrier</a>
    <div style="font-size:9.5px;color:#aaa;margin-top:16px;text-align:center">Vous pouvez fermer cette page.</div>`;
}

function fmtDateJourLong(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
}

function genererIcsRdv(etat, dureeMin, nomInvite) {
  const debut = new Date(`${etat.date}T${etat.heure}:00`);
  const fin = new Date(debut.getTime() + dureeMin * 60000);
  const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `UID:${Date.now()}@crm-assurex`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(debut)}`,
    `DTEND:${fmt(fin)}`,
    `SUMMARY:${etat.type} — ${etat.agent.prenom} ${etat.agent.nom}`,
    `DESCRIPTION:Rendez-vous avec ${nomInvite}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
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

  // Signature du mandataire (Jonathan/Assurex) enregistrée une fois dans Paramètres → Agents
  // (voir enregistrerMaSignature, js/10) et reprise automatiquement sur tous les mandats générés,
  // avec la date du jour — demande de Jonathan le 07.08.2026 : ne plus avoir à signer à la main
  // à chaque mandat.
  const agentSignataire = allAgents.find(a => a.role === 'signataire');
  const signatureMandataire = agentSignataire ? agentSignataire.signature_image : null;

  const win = window.open('', '_blank');
  const contenuMandatHtml = `<html><head><meta charset="utf-8"><title>Mandat de courtage — ${isEnt ? champs.societe : champs.prenom + ' ' + champs.nom}</title><style>
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
    <div style="text-align:center;font-size:7px;color:#ccc;margin:2px 0 0">En partenariat avec OZ Assure</div>

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

    <p>Fait en deux exemplaires, à St-Sulpice, le ${fmtDate(new Date().toISOString())}.</p>

    <div class="signatures">
      <div><strong>Signature du mandant</strong>${signatureDataUrl ? `<div style="margin-top:8px"><img src="${signatureDataUrl}" style="max-height:60px;max-width:220px;display:block"/></div><div class="ligne-signature" style="margin-top:6px">Le mandant</div>` : `<div class="ligne-signature">Le mandant</div>`}</div>
      <div><strong>Signature du mandataire (ASSUREX Sàrl)</strong>${signatureMandataire ? `<div style="margin-top:8px"><img src="${signatureMandataire}" style="max-height:60px;max-width:220px;display:block"/></div><div class="ligne-signature" style="margin-top:6px">Le mandataire</div>` : `<div class="ligne-signature">Le mandataire</div>`}</div>
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
      <div><strong>Signature du mandataire (ASSUREX Sàrl)</strong>${signatureMandataire ? `<div style="margin-top:8px"><img src="${signatureMandataire}" style="max-height:60px;max-width:220px;display:block"/></div><div class="ligne-signature" style="margin-top:6px">Le mandataire</div>` : `<div class="ligne-signature">Le mandataire</div>`}</div>
    </div>

    <div class="footer">ASSUREX Sàrl – Rue du Centre 142, 1025 St-Sulpice – Autorisation FINMA F01492173</div>

    <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
  </body></html>`;
  win.document.write(contenuMandatHtml);
  win.document.close();

  // Enregistrement automatique sur la fiche client — toujours disponible ensuite, même si
  // c'est un(e) collègue qui a généré/fait signer ce mandat à ma place.
  dbPost('mandats_signes', {
    client_id: clientId,
    signe: !!signatureDataUrl,
    cree_par: (typeof supaSession !== 'undefined' && supaSession && supaSession.email) || null,
    html_snapshot: contenuMandatHtml,
  }).then(r => {
    if (r && r.error) console.error('Échec de l\u2019enregistrement du mandat sur la fiche :', errMsg(r));
  });
}

// ═══ SIGNATURE D'UN CONTRAT UPLOADÉ (générique, pas le mandat de courtage à texte fixe) ═══
// Génère une page de confirmation (nom du document, coordonnées client, image de la signature,
// date) et l'enregistre sur la fiche client dans la même liste que les mandats de courtage —
// fichier_url pointe vers le contrat ORIGINAL uploadé (ouvrable via le bouton "Voir/Télécharger"
// de la liste, lien signé généré à la volée comme pour tout autre document du CRM), tandis que
// html_snapshot garde la preuve de signature elle-même (voir voirMandatSauvegarde plus bas,
// qui préfère désormais html_snapshot quand les deux sont présents).
function genererDocumentSigne(clientId, signatureDataUrl, contexte) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) { showError('Client introuvable.'); return; }
  const nomClient = estEntreprise(c) ? c.nom : `${c.prenom} ${c.nom}`;
  const maintenant = new Date();
  const dateFr = fmtDate(maintenant.toISOString());

  const contenuHtml = `<html><head><meta charset="utf-8"><title>Signature — ${(contexte.documentNom || 'Document').replace(/</g,'&lt;')}</title><style>
    body{font-family:Arial,sans-serif;padding:35px;color:#1a1a1a;font-size:13px;line-height:1.6}
    .entete{border-bottom:2px solid #113679;padding-bottom:14px;margin-bottom:20px}
    h1{font-size:18px;color:#113679;margin:0 0 4px}
    .sous-titre{color:#555;font-size:12px}
    .bloc{background:#f2f5fa;border-radius:8px;padding:14px 18px;margin:18px 0}
    .bloc div{margin-bottom:4px}
    .signature-zone{margin-top:30px}
    .print-btn{margin-top:25px;padding:10px 20px;background:#113679;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-right:10px}
    .voir-btn{margin-top:25px;padding:10px 20px;background:#fff;color:#113679;border:1.5px solid #113679;border-radius:6px;cursor:pointer;font-size:13px}
    .footer{text-align:center;font-size:9.5px;color:#888;margin-top:30px;border-top:1px solid #ddd;padding-top:10px}
    @media print { .print-btn, .voir-btn { display: none !important; } }
  </style></head><body>
    <div class="entete"><h1>Confirmation de signature électronique</h1><div class="sous-titre">ASSUREX Sàrl — Autorisation FINMA F01492173</div></div>
    <div class="bloc">
      <div><strong>Client :</strong> ${nomClient.replace(/</g,'&lt;')}</div>
      <div><strong>Document :</strong> ${(contexte.documentNom || '—').replace(/</g,'&lt;')}</div>
      <div><strong>Signé le :</strong> ${dateFr}</div>
    </div>
    <p>Le client mentionné ci-dessus a approuvé électroniquement le document « ${(contexte.documentNom || '').replace(/</g,'&lt;')} » en apposant la signature ci-dessous.</p>
    <div class="signature-zone">
      <strong>Signature du client</strong>
      ${signatureDataUrl ? `<div style="margin-top:8px"><img src="${signatureDataUrl}" style="max-height:80px;max-width:260px;display:block;border:1px solid #ddd;border-radius:6px;padding:6px"/></div>` : `<div style="color:#888;font-size:11.5px;margin-top:6px">(signature non capturée)</div>`}
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
    <button class="voir-btn" onclick="window.opener && window.opener.ouvrirPieceJointe && window.opener.ouvrirPieceJointe('${contexte.documentPath || ''}')">📎 Voir le contrat original</button>
    <div class="footer">ASSUREX Sàrl – Rue du Centre 142, 1025 St-Sulpice</div>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(contenuHtml);
  win.document.close();

  dbPost('mandats_signes', {
    client_id: clientId,
    signe: !!signatureDataUrl,
    cree_par: (typeof supaSession !== 'undefined' && supaSession && supaSession.email) || null,
    html_snapshot: contenuHtml,
    fichier_url: contexte.documentPath || null,
    fichier_nom: contexte.documentNom || null,
  }).then(r => {
    if (r && r.error) console.error('Échec de l\u2019enregistrement du document signé sur la fiche :', errMsg(r));
    showClient(clientId);
  });
}

// Ouvre une petite modale de sélection de fichier PDF, uploade le contrat vers le stockage, puis
// enchaîne directement sur la modale de signature (mode contexte "contrat") — bouton "📎 Faire
// signer un contrat" sur la fiche client, à côté de "📄 Mandat de courtage".
function ouvrirUploadContratSignature(clientId) {
  creerModale('modal-upload-contrat', `
    <div style="background:var(--surface);border-radius:14px;padding:22px;max-width:420px;width:100%">
      <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">📎 Faire signer un contrat</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:16px">Choisis le PDF du contrat à faire signer par le client — il sera enregistré puis tu pourras récupérer la signature (ici, par QR/lien, e-mail ou WhatsApp).</div>
      <input type="file" id="input-contrat-a-signer" accept="application/pdf" class="form-input" style="margin-bottom:16px"/>
      <div id="erreur-upload-contrat" style="color:#f87171;font-size:11.5px;margin-bottom:8px;display:none"></div>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" onclick="document.getElementById('modal-upload-contrat').remove()">Annuler</button>
        <button class="btn-save" id="btn-continuer-upload-contrat" onclick="confirmerUploadContratPuisSigner('${clientId}')" style="margin-left:auto">Continuer →</button>
      </div>
    </div>`, { opacite: 0.8, padding: '16px', overflowY: false });
}

async function confirmerUploadContratPuisSigner(clientId) {
  const input = document.getElementById('input-contrat-a-signer');
  const file = input && input.files[0];
  const erreurEl = document.getElementById('erreur-upload-contrat');
  if (!file) { erreurEl.textContent = 'Choisis un fichier PDF.'; erreurEl.style.display = 'block'; return; }
  if (file.type !== 'application/pdf') { erreurEl.textContent = 'Seuls les PDF sont acceptés.'; erreurEl.style.display = 'block'; return; }
  if (file.size > 15 * 1024 * 1024) { erreurEl.textContent = 'Fichier trop lourd — maximum 15 Mo.'; erreurEl.style.display = 'block'; return; }

  const btn = document.getElementById('btn-continuer-upload-contrat');
  if (btn) { btn.textContent = 'Envoi...'; btn.disabled = true; }

  const path = `contrats-a-signer/${clientId}/${Date.now()}.pdf`;
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
      body: file,
    });
    if (!uploadRes.ok) { erreurEl.textContent = "Erreur lors de l'envoi du fichier."; erreurEl.style.display = 'block'; if (btn) { btn.textContent = 'Continuer →'; btn.disabled = false; } return; }
    const documentData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    document.getElementById('modal-upload-contrat').remove();
    ouvrirSignatureMandat(clientId, { type: 'contrat', documentNom: file.name, documentPath: path, documentData });
  } catch (e) {
    erreurEl.textContent = "Erreur lors de l'envoi : " + e.message;
    erreurEl.style.display = 'block';
    if (btn) { btn.textContent = 'Continuer →'; btn.disabled = false; }
  }
}

// ═══ DÉTAILS ENTREPRISE (masse salariale, assurances, LPP, RC & choses, véhicules) ═══
// Ces champs n'ont pas de colonne dédiée sur `clients` — ils étaient auparavant saisis sur le
// formulaire de création mais jamais envoyés au serveur (bug corrigé le 06.08.2026). Cette vue
// permet de les compléter/corriger après coup, stockés dans clients.details_entreprise (jsonb).
// Réutilise exactement les mêmes ids de champs que formEntreprise() afin que
// collecterDetailsEntreprise() (définie dans js/07) fonctionne identiquement pour les deux vues.
function viewCompleterDetailsEntreprise(c) {
  const d = c.details_entreprise || {};
  const slug = s => s.replace(/\s/g, '-').toLowerCase();
  const ap = d.assurances_personnes || {};
  const vie = d.assurances_vie || {};
  const rcc = d.rc_assurances_choses || {};
  const veh = d.vehicules || [];
  return `
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:800;color:var(--text)">Détails entreprise — ${c.nom}</h2>
    <div style="color:var(--text-muted);font-size:13px;margin-bottom:20px">Masse salariale, assurances envisagées, LPP, RC &amp; assurances choses, véhicules. L'identité, l'adresse et le contact se modifient via "✏️ Modifier" sur la fiche.</div>
    ${sectionCard('Interlocuteur — compléments', '#a78bfa', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Fonction</label><input class="form-input" id="e-contact-fonction" value="${d.contact_fonction || ''}" placeholder="Directeur, RH..."/></div>
      <div class="form-field"><label class="form-label">Mobile direct</label><input class="form-input" id="e-contact-mobile" value="${d.contact_mobile || ''}" placeholder="+41 79 XXX XX XX"/></div>
      <div class="form-field"><label class="form-label">Statut indépendant</label><select class="form-select" id="e-independant"><option value="non" ${d.independant==='non'?'selected':''}>Non</option><option value="oui" ${d.independant==='oui'?'selected':''}>Oui</option></select></div>
    </div>`)}
    ${sectionCard("Données de base de calcul (masse salariale AVS — max. 90'720)", '#4ade80', `<div class="form-grid">
      <div class="form-field"><label class="form-label">Chiffre d'affaires (CHF)</label><input class="form-input" id="e-ca" type="number" value="${c.revenu || ''}" placeholder="500000"/></div>
      <div class="form-field"><label class="form-label">Nb collaborateurs</label><input class="form-input" id="e-collaborateurs" type="number" value="${c.taux_activite || ''}" placeholder="5"/></div>
      <div class="form-field"><label class="form-label">Masse salariale totale (CHF)</label><input class="form-input" id="e-ms-total" type="number" value="${d.ms_total || ''}" placeholder="250000"/></div>
      <div class="form-field"><label class="form-label">MS chef d'entreprise (CHF)</label><input class="form-input" id="e-ms-chef" type="number" value="${d.ms_chef || ''}" placeholder="120000"/></div>
      <div class="form-field"><label class="form-label">MS AP Hommes (CHF)</label><input class="form-input" id="e-ms-ap-h" type="number" value="${d.ms_ap_h || ''}" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">MS AP Femmes (CHF)</label><input class="form-input" id="e-ms-ap-f" type="number" value="${d.ms_ap_f || ''}" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">MS ANP Hommes (CHF)</label><input class="form-input" id="e-ms-anp-h" type="number" value="${d.ms_anp_h || ''}" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">MS ANP Femmes (CHF)</label><input class="form-input" id="e-ms-anp-f" type="number" value="${d.ms_anp_f || ''}" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Sal. excéd. AVS H (CHF)</label><input class="form-input" id="e-exc-h" type="number" value="${d.exc_h || ''}" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Sal. excéd. AVS F (CHF)</label><input class="form-input" id="e-exc-f" type="number" value="${d.exc_f || ''}" placeholder="0"/></div>
    </div>`)}
    ${sectionCard('Assurances de personnes', '#38bdf8', `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      ${['Perte de gain maladie','LAA','LPP','LAAF (indépendant)','LAAC','Semi-privée'].map(l => `
      <label style="display:flex;align-items:center;gap:8px;background:var(--surface-alt);border-radius:8px;padding:10px 12px;cursor:pointer">
        <input type="checkbox" id="e-ap-${slug(l)}" ${ap[l] ? 'checked' : ''} style="width:14px;height:14px;accent-color:#38bdf8"/>
        <span style="font-size:12px;color:var(--text);font-weight:600">${l}</span>
      </label>`).join('')}
    </div>
    <div style="margin-top:12px">
      <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:8px">Perte de gain — délai d'attente</div>
      <div style="display:flex;gap:8px">
        ${['14j','30j','60j'].map(dl => `<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="e-delai" value="${dl}" ${d.delai_attente===dl?'checked':''} style="accent-color:#38bdf8"/><span style="font-size:12px;color:var(--text)">${dl}</span></label>`).join('')}
      </div>
    </div>`)}
    ${sectionCard('Assurances vie', '#a78bfa', `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
      ${['3a','3a indépendant','3B','Risque pur','Versement unique'].map(l => `
      <label style="display:flex;align-items:center;gap:8px;background:var(--surface-alt);border-radius:8px;padding:10px 12px;cursor:pointer">
        <input type="checkbox" id="e-vie-${slug(l)}" ${vie[l] ? 'checked' : ''} style="width:14px;height:14px;accent-color:#a78bfa"/>
        <span style="font-size:12px;color:var(--text);font-weight:600">${l}</span>
      </label>`).join('')}
    </div>
    <div class="form-grid" style="margin-top:12px">
      <div class="form-field"><label class="form-label">Budget épargne (CHF/an)</label><input class="form-input" id="e-budget-epargne" type="number" value="${d.budget_epargne || ''}" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">PA (prime annuelle)</label><input class="form-input" id="e-pa" type="number" value="${d.pa || ''}" placeholder="0"/></div>
    </div>`)}
    ${sectionCard('LPP', '#4ade80', `<div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Sal. min coord. LPP 3780 - max. 64260 CHF - seuil entree 22680 - plafond sans ded. coord. 90720 CHF</div>
    <div class="form-grid">
      <div class="form-field"><label class="form-label">Soumis CCT ?</label><select class="form-select" id="e-cct"><option value="non" ${c.cct===false?'selected':''}>Non</option><option value="oui" ${c.cct===true?'selected':''}>Oui</option></select></div>
      <div class="form-field"><label class="form-label">Domaine SUVA (monopole accident) ?</label><select class="form-select" id="e-suva"><option value="non" ${c.domaine_suva===false?'selected':''}>Non</option><option value="oui" ${c.domaine_suva===true?'selected':''}>Oui</option></select></div>
      <div class="form-field"><label class="form-label">Taux LPP souhaité</label><select class="form-select" id="e-taux-lpp"><option ${d.taux_lpp==='Min. légal 7/10/15/18'?'selected':''}>Min. légal 7/10/15/18</option><option ${d.taux_lpp==='Spécifique'?'selected':''}>Spécifique</option></select></div>
      <div class="form-field"><label class="form-label">Capital invalidité souhaité (CHF)</label><input class="form-input" id="e-cap-invalidite" type="number" value="${d.cap_invalidite || ''}" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Capital décès souhaité (CHF)</label><input class="form-input" id="e-cap-deces" type="number" value="${d.cap_deces || ''}" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Améliorations</label><input class="form-input" id="e-ameliorations" value="${d.ameliorations || ''}" placeholder="rentes, épargne, tranches..."/></div>
      <div class="form-field"><label class="form-label">Déduction coordinée</label><select class="form-select" id="e-ded-coord"><option ${d.ded_coord==='Avec déd. coord.'?'selected':''}>Avec déd. coord.</option><option ${d.ded_coord==='Sans déd. coord.'?'selected':''}>Sans déd. coord.</option></select></div>
    </div>`)}
    ${sectionCard('Responsabilité civile & Assurances choses', '#f87171', `<div class="form-grid">
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Risque particulier dans le domaine d'activité ?</label><input class="form-input" id="e-rc-risque" value="${d.rc_risque || ''}" placeholder="Décrire si applicable"/></div>
      <div class="form-field" style="grid-column:span 2"><label class="form-label">Lieux d'exploitation</label><input class="form-input" id="e-lieux" value="${d.lieux_exploitation || ''}" placeholder="Tous les lieux de risque"/></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
      ${['RC/Commerce','Inventaire','Protection juridique','Perte exploitation','Machines','Vol','All Risk','Transports','Cyber','Construction/MO'].map(l => `
      <label style="display:flex;align-items:center;gap:8px;background:var(--surface-alt);border-radius:8px;padding:10px 12px;cursor:pointer">
        <input type="checkbox" id="e-rcc-${slug(l)}" ${rcc[l] ? 'checked' : ''} style="width:14px;height:14px;accent-color:#f87171"/>
        <span style="font-size:12px;color:var(--text);font-weight:600">${l}</span>
      </label>`).join('')}
    </div>
    <div class="form-grid" style="margin-top:12px">
      <div class="form-field"><label class="form-label">Inventaire — somme assurée (CHF)</label><input class="form-input" id="e-inventaire" type="number" value="${d.inventaire_somme || ''}" placeholder="0"/></div>
      <div class="form-field"><label class="form-label">Perte exploitation (CHF)</label><input class="form-input" id="e-perte-exploit" type="number" value="${d.perte_exploitation || ''}" placeholder="0"/></div>
    </div>`)}
    ${sectionCard('Véhicules', '#64748b', `<div class="form-grid">
      <div class="form-field"><label class="form-label">N° plaque 1</label><input class="form-input" id="e-plaque1" value="${(veh[0]&&veh[0].plaque)||''}" placeholder="VD 123456"/></div>
      <div class="form-field"><label class="form-label">Modèle 1</label><input class="form-input" id="e-modele1" value="${(veh[0]&&veh[0].modele)||''}" placeholder="VW Transporter"/></div>
      <div class="form-field"><label class="form-label">N° plaque 2</label><input class="form-input" id="e-plaque2" value="${(veh[1]&&veh[1].plaque)||''}" placeholder="VD 654321"/></div>
      <div class="form-field"><label class="form-label">Modèle 2</label><input class="form-input" id="e-modele2" value="${(veh[1]&&veh[1].modele)||''}" placeholder=""/></div>
    </div>`)}
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn-secondary" onclick="showClient('${c.id}')">✕ Annuler</button>
      <button class="btn-save" onclick="saveDetailsEntrepriseClient('${c.id}')">✓ Enregistrer</button>
    </div>`;
}

// Ouvre la vue "Détails entreprise" depuis la fiche client — même logique de mémorisation de
// l'état précédent que showClient()/showRappel(), pour que le retour arrière fonctionne
// correctement (voir capturerEtatActuel()/restaurerEtat() dans js/03-auth-navigation.js).
function showCompleterDetailsEntreprise(clientId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const etatPrecedent = capturerEtatActuel();
  if (!(etatPrecedent.type === 'client' && etatPrecedent.id === clientId)) navHistory.push(etatPrecedent);
  vueDetailActive = { type: 'client', id: clientId };
  const main = document.getElementById('main-content');
  main.innerHTML = viewCompleterDetailsEntreprise(c);
  insertBackBar({ homeId: 'clients', homeLabel: 'Clients', itemLabel: "Détails entreprise — " + c.nom });
}

// Fusionne avec les détails déjà enregistrés (ne remplace jamais l'objet entier) : cette vue ne
// re-rend pas forcément tous les groupes de champs possibles, donc écraser aveuglément
// details_entreprise perdrait des informations saisies ailleurs (ex: à la création).
async function saveDetailsEntrepriseClient(clientId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const nouveaux = collecterDetailsEntreprise();
  const body = {
    details_entreprise: Object.assign({}, c.details_entreprise || {}, nouveaux),
    revenu: Number(document.getElementById('e-ca')?.value) || c.revenu || 0,
    taux_activite: Number(document.getElementById('e-collaborateurs')?.value) || c.taux_activite || 0,
    cct: document.getElementById('e-cct') ? document.getElementById('e-cct').value === 'oui' : c.cct,
    domaine_suva: document.getElementById('e-suva') ? document.getElementById('e-suva').value === 'oui' : c.domaine_suva,
  };
  const btn = document.querySelector('.btn-save');
  if (btn) { btn.textContent = 'Enregistrement...'; btn.disabled = true; }
  const r = await dbPatch('clients', clientId, body);
  if (r && r.error) { showError('Erreur lors de l\'enregistrement : ' + errMsg(r)); if (btn) { btn.textContent = '✓ Enregistrer'; btn.disabled = false; } return; }
  logAction('edit_details_entreprise', 'clients', clientId, c.nom);
  allClients = await dbGet('clients', 'select=*');
  await showClient(clientId);
}

// ═══ FICHE DE TRAVAIL — DEMANDE D'OFFRE ENTREPRISE ═══
// Génère une fiche imprimable de recueil de besoins, préremplie avec ce qui est déjà
// connu du client (identité, contact, secteur, CCT...) — le reste (masses salariales,
// couvertures souhaitées, budgets) reste à remplir à la main pendant l'entretien.
// Récupère les mandats enregistrés pour un client donné
async function getMandatsSignesClient(clientId) {
  return await dbGet('mandats_signes', `client_id=eq.${clientId}&select=*&order=created_at.desc`).catch(() => []);
}

// Réouvre un mandat sauvegardé dans une nouvelle fenêtre — imprimable/téléchargeable en PDF
// depuis là, exactement comme au moment de sa génération d'origine (signature comprise).
async function voirMandatSauvegarde(mandatId) {
  const mandats = await dbGet('mandats_signes', `id=eq.${mandatId}&select=*`);
  const m = mandats && mandats[0];
  if (!m) { showError('Mandat introuvable.'); return; }
  if (m.html_snapshot) {
    const win = window.open('', '_blank');
    win.document.write(m.html_snapshot);
    win.document.close();
    return;
  }
  if (m.fichier_url) { ouvrirPieceJointe(m.fichier_url); return; }
}

async function supprimerMandatSauvegarde(mandatId, clientId) {
  if (!confirm('Supprimer ce mandat enregistré ? Cette action est irréversible.')) return;
  const r = await dbDelete('mandats_signes', mandatId);
  if (r && r.error) { showError('Erreur lors de la suppression : ' + errMsg(r)); return; }
  showClient(clientId);
}

// Sauvegarde les données saisies dans la fenêtre imprimable "Fiche demande d'offre" (appelée
// depuis cette fenêtre via window.opener) — les valeurs réapparaissent, modifiables, la prochaine
// fois que la fiche est rouverte pour ce client.
async function sauvegarderFicheOffre(clientId, data) {
  const r = await dbPatch('clients', clientId, { fiche_offre_data: data });
  if (r && r.error) {
    console.error('Échec sauvegarde fiche demande d\'offre :', errMsg(r));
    return { ok: false, raison: 'Erreur serveur : ' + errMsg(r) };
  }
  // Vérifie que l'écriture a réellement été appliquée : une session expirée dans l'onglet
  // principal fait retomber dbPatch sur la clé anonyme, qui est bloquée par la sécurité de la
  // base sans remonter d'erreur HTTP (0 ligne modifiée, mais requête "réussie") — d'où le bouton
  // qui semblait fonctionner sans jamais rien enregistrer.
  const verif = await dbGet('clients', `id=eq.${clientId}&select=fiche_offre_data`);
  const enregistre = verif && verif[0] && verif[0].fiche_offre_data;
  const cles = enregistre ? Object.keys(data) : [];
  const bienEnregistre = enregistre && cles.length === Object.keys(enregistre).length && cles.every(k => enregistre[k] === data[k]);
  if (!bienEnregistre) {
    return { ok: false, raison: 'Session probablement expirée \u2014 reconnectez-vous sur l\u2019onglet principal du CRM puis r\u00e9essayez.' };
  }
  allClients = await dbGet('clients', 'select=*');
  logAction('edit_fiche_offre', 'clients', clientId, 'Mise à jour de la fiche demande d\'offre');
  return { ok: true };
}

function genererFicheDemandeOffre(clientId) {
  const c = allClients.find(x => x.id === clientId);
  if (!c) return;
  const nomContact = c.prenom || '';
  const nbCollaborateurs = allCollaborateurs ? allCollaborateurs.filter(co => co.client_id === clientId).length : '';
  const adresseComplete = [c.adresse, c.npa, c.ville].filter(Boolean).join(', ');

  // Les réponses saisies à l'écran (au clavier, dans la fenêtre imprimable) sont conservées sur le
  // client (clients.fiche_offre_data) — rouvrir la fiche plus tard réaffiche et permet de modifier
  // ce qui a déjà été saisi, au lieu de repartir d'une fiche vierge à chaque fois.
  const donnees = c.fiche_offre_data || {};
  const v = (key) => (donnees[key] != null ? String(donnees[key]).replace(/"/g, '&quot;') : '');
  const champEditable = (key, largeur = '100%') => `<input type="text" data-champ="${key}" value="${v(key)}" style="border:none;border-bottom:1px solid #999;min-height:18px;width:${largeur};font:inherit;background:transparent;padding:0 0 1px"/>`;
  const zoneEditable = (key, lignes = 2) => `<textarea data-champ="${key}" rows="${lignes}" style="border:1px solid #ccc;border-radius:3px;width:100%;font:inherit;background:transparent;padding:4px;resize:vertical">${donnees[key] || ''}</textarea>`;
  const caseEditable = (key, label) => `<span style="display:inline-block;margin-right:14px;white-space:nowrap"><label style="cursor:pointer"><input type="checkbox" data-champ="${key}" ${donnees[key] ? 'checked' : ''} style="width:11px;height:11px;margin-right:4px;vertical-align:middle;cursor:pointer"/>${label}</label></span>`;

  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Fiche demande d'offre — ${c.nom}</title><meta charset="utf-8">
  <style>
    @media print { .print-btn, .save-btn, .save-note { display:none } @page { margin: 14mm } input, textarea { border-color: #999 !important } }
    body { font-family: Arial, sans-serif; font-size: 11.5px; color: #1a1a1a; max-width: 850px; margin: 20px auto; line-height: 1.45 }
    input, textarea { color: #1a1a1a }
    .raison-sociale { font-size: 25px; font-weight: 900; color: #113679; letter-spacing: 0.3px; margin: 10px 0 2px; text-transform: uppercase }
    .sous-titre { color: #555; font-size: 10.5px; margin-bottom: 14px }
    h2 { font-size: 12.5px; background: #113679; color: #fff; padding: 5px 10px; margin: 16px 0 8px; border-radius: 4px }
    .ligne { display: flex; gap: 18px; margin-bottom: 8px; align-items: baseline; flex-wrap: wrap }
    .champ { flex: 1; min-width: 150px }
    .champ label { display: block; font-size: 9.5px; color: #555; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px }
    .rappel-legal { background: #f3f4f6; border-left: 3px solid #113679; padding: 6px 10px; font-size: 9.5px; color: #444; margin: 6px 0 10px }
    .print-btn { position: fixed; top: 16px; right: 16px; background: #113679; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; font-size: 13px }
    .save-btn { position: fixed; top: 16px; right: 168px; background: #16a34a; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; font-size: 13px }
    .save-btn:disabled { opacity: 0.6; cursor: wait }
    .save-note { position: fixed; top: 62px; right: 16px; background: #16a34a; color: #fff; border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: 700; display: none }
    table.plaques { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 6px }
    table.plaques th, table.plaques td { border: 1px solid #ccc; padding: 5px 8px; text-align: left }
    table.plaques input { border: none; width: 100%; font: inherit; background: transparent }
    .footer { margin-top: 22px; font-size: 9px; color: #888; border-top: 1px solid #ddd; padding-top: 8px }
  </style></head><body>

    <div class="entete">
      ${genererBadgeLogoAssurex(28, '10px 16px', 'inline-block')}
    </div>
    <div class="raison-sociale">${c.nom || '—'}</div>
    <div class="sous-titre">Fiche de demande d'offre — Entreprise — document de travail, à compléter pendant l'entretien avec le client</div>

    <h2>1. Identité de l'entreprise</h2>
    <div class="ligne">
      <div class="champ"><label>Raison sociale</label>${c.nom || '—'}</div>
      <div class="champ"><label>Forme juridique / IDE</label>${c.ide || '—'}</div>
      <div class="champ"><label>Date d'inscription au RC</label>${champEditable('date_rc')}</div>
    </div>
    <div class="ligne">
      <div class="champ" style="flex:2"><label>Adresse</label>${adresseComplete || '—'}</div>
      <div class="champ"><label>Lieu du risque (si différent)</label>${champEditable('lieu_risque')}</div>
    </div>
    <div class="ligne">
      <div class="champ"><label>Contact (prénom nom)</label>${nomContact || '—'}</div>
      <div class="champ"><label>Téléphone</label>${c.tel || c.mobile || '—'}</div>
      <div class="champ"><label>E-mail</label>${c.email || '—'}</div>
    </div>
    <div class="ligne">
      <div class="champ"><label>Activité principale / secteur</label>${c.profession || '—'}</div>
      <div class="champ"><label>Nombre de collaborateurs</label>${nbCollaborateurs || '—'}</div>
    </div>
    <div class="ligne">
      <div class="champ">${caseEditable('suva_oui', 'Soumis SUVA ? Oui')} ${caseEditable('suva_non', 'Non')}</div>
      <div class="champ">${caseEditable('independant', 'Statut indépendant')}</div>
      <div class="champ">${caseEditable('cct_oui', `Soumis CCT ? ${c.cct ? '(déjà indiqué: Oui)' : 'Oui'}`)} ${caseEditable('cct_non', 'Non')}</div>
    </div>

    <h2>2. Données salariales (base de calcul LAA / LPP / perte de gain)</h2>
    <div class="rappel-legal">Rappels légaux 2026 : masse salariale max. soumise AVS CHF 90'720/an dès 8h hebdo (soumis ANP) · seuil d'entrée LPP CHF 22'680 · salaire coordonné LPP min. CHF 3'780 – max. CHF 64'260 · plafond LPP sans déduction de coordination CHF 90'720.</div>
    <div class="ligne">
      <div class="champ"><label>Chiffre d'affaires</label>${champEditable('ca')}</div>
      <div class="champ"><label>Masse salariale chef d'entreprise</label>${champEditable('masse_salariale_dirigeant')}</div>
    </div>
    <div class="ligne">
      <div class="champ"><label>Masse salariale AP — Hommes</label>${champEditable('masse_ap_hommes')}</div>
      <div class="champ"><label>Masse salariale AP — Femmes</label>${champEditable('masse_ap_femmes')}</div>
    </div>
    <div class="ligne">
      <div class="champ"><label>Masse salariale ANP — Hommes</label>${champEditable('masse_anp_hommes')}</div>
      <div class="champ"><label>Masse salariale ANP — Femmes</label>${champEditable('masse_anp_femmes')}</div>
    </div>
    <div class="ligne">
      <div class="champ"><label>Salaires excédentaires AVS — Hommes</label>${champEditable('salaires_exc_hommes')}</div>
      <div class="champ"><label>Salaires excédentaires AVS — Femmes</label>${champEditable('salaires_exc_femmes')}</div>
    </div>

    <h2>3. Assurances de personnes (collectives)</h2>
    <div class="ligne">
      ${caseEditable('laa', 'LAA')} ${caseEditable('laac', 'LAAC (complémentaire)')} ${caseEditable('laaf', 'LAAF min. CHF 66\'690 (indépendant)')}
    </div>
    <div class="ligne">
      <div class="champ"><label>Perte de gain maladie — délai d'attente</label>${caseEditable('delai_14', '14j')} ${caseEditable('delai_30', '30j')} ${caseEditable('delai_60', '60j')}</div>
      <div class="champ"><label>Couverture salaire souhaitée</label>${caseEditable('couv_80', '80%')} ${caseEditable('couv_90', '90%')} ${caseEditable('couv_100', '100%')}</div>
    </div>
    <div class="ligne">${caseEditable('semi_privee', 'Semi-privée souhaitée')}</div>
    <div class="rappel-legal">LPP — préciser le souhait du client (plans-cadres), puis remplir la fiche Excel dédiée par collaborateur.</div>

    <h2>4. Prévoyance privée (vie du dirigeant / collaborateurs clés)</h2>
    <div class="ligne">
      ${caseEditable('p3a', '3a')} ${caseEditable('p3a_indep', '3a indépendant')} ${caseEditable('p3b', '3b')} ${caseEditable('risque_pur', 'Risque pur')} ${caseEditable('versement_unique', 'Versement unique')}
    </div>
    <div class="ligne">
      <div class="champ"><label>Budget épargne souhaité (CHF)</label>${champEditable('budget_epargne')}</div>
      <div class="champ"><label>Capital invalidité souhaité (CHF)</label>${champEditable('capital_invalidite')}</div>
      <div class="champ"><label>Capital décès souhaité (CHF)</label>${champEditable('capital_deces')}</div>
    </div>
    <div class="ligne"><div class="champ"><label>Améliorations souhaitées</label>${caseEditable('amelio_rentes', 'Rentes')} ${caseEditable('amelio_epargne', 'Épargne')} ${caseEditable('amelio_tranches', 'Tranches de cotisations')} ${caseEditable('amelio_rendement', 'Rendement')}</div></div>

    <h2>5. Responsabilité civile &amp; choses</h2>
    <div class="ligne"><div class="champ"><label>Risque particulier lié au domaine d'activité</label>${champEditable('risque_particulier')}</div></div>
    <div class="ligne"><div class="champ"><label>Lieux d'exploitation (tous les sites à risque)</label>${champEditable('lieux_exploitation')}</div></div>
    <div class="ligne">
      ${caseEditable('rc_commerce', 'RC / commerce')} ${caseEditable('prejudices_fortune', 'Préjudices de fortune (CV + diplômes requis)')} ${caseEditable('cyber', 'Cyber')}
    </div>
    <div class="ligne">
      ${caseEditable('marchandises', 'Marchandises à assurer')} ${caseEditable('transports', 'Transports')} ${caseEditable('transports_speciaux', 'Transports spéciaux')} ${caseEditable('machines', 'Machines à assurer')} ${caseEditable('vol', 'Vol')} ${caseEditable('all_risk', 'All Risk')}
    </div>
    <div class="ligne">
      ${caseEditable('protection_juridique', 'Protection juridique')} ${caseEditable('construction', 'Construction & maître d\u2019ouvrage')} ${caseEditable('technique', 'Technique')} ${caseEditable('perte_exploitation', 'Perte d\u2019exploitation')}
    </div>
    <div class="ligne"><div class="champ"><label>Inventaire — somme d'assurance souhaitée (CHF)</label>${champEditable('inventaire_somme')}</div></div>

    <h2>6. Véhicules</h2>
    <table class="plaques">
      <tr><th style="width:30%">N° de plaque</th><th>Marque / modèle</th></tr>
      <tr><td>${champEditable('veh1_plaque')}</td><td>${champEditable('veh1_marque')}</td></tr>
      <tr><td>${champEditable('veh2_plaque')}</td><td>${champEditable('veh2_marque')}</td></tr>
      <tr><td>${champEditable('veh3_plaque')}</td><td>${champEditable('veh3_marque')}</td></tr>
    </table>

    <h2>7. Synthèse et priorités du client</h2>
    <div class="ligne"><div class="champ"><label>Objectifs principaux exprimés par le client (dans ses mots)</label>${zoneEditable('objectifs', 3)}</div></div>
    <div class="ligne">
      <div class="champ"><label>Compagnie(s) actuelle(s) à résilier</label>${champEditable('compagnies_resilier')}</div>
      <div class="champ"><label>Échéance(s) connue(s)</label>${champEditable('echeances_connues')}</div>
    </div>
    <div class="ligne">
      <div class="champ"><label>Budget global envisagé (CHF/an)</label>${champEditable('budget_global')}</div>
      <div class="champ"><label>Délai souhaité pour la mise en place</label>${champEditable('delai_souhaite')}</div>
    </div>
    <div class="ligne"><div class="champ"><label>Prochaine étape / date de suivi</label>${champEditable('prochaine_etape')}</div></div>

    <div class="footer">ASSUREX Sàrl – Rue du Centre 142, 1025 St-Sulpice – Autorisation FINMA F01492173 — Document de travail interne, non contractuel</div>

    <button class="save-btn" onclick="(async () => {
      const btn = document.querySelector('.save-btn');
      try {
        if (!window.opener || window.opener.closed || typeof window.opener.sauvegarderFicheOffre !== 'function') {
          alert('Impossible d\u2019enregistrer : la fen\u00eatre du CRM d\u2019origine est introuvable ou a \u00e9t\u00e9 ferm\u00e9e. Gardez l\u2019onglet du CRM ouvert et rouvrez cette fiche depuis la fiche client.');
          return;
        }
        const d = {};
        document.querySelectorAll('[data-champ]').forEach(el => {
          if (el.type === 'checkbox') { d[el.dataset.champ] = el.checked; }
          else { d[el.dataset.champ] = el.value; }
        });
        btn.disabled = true; btn.textContent = 'Enregistrement...';
        const res = await window.opener.sauvegarderFicheOffre('${clientId}', d);
        if (res && res.ok) {
          const note = document.querySelector('.save-note');
          note.style.display = 'block';
          setTimeout(() => note.style.display = 'none', 2500);
        } else {
          alert('\u00c9chec de l\u2019enregistrement : ' + (res && res.raison ? res.raison : 'erreur inconnue'));
        }
      } catch (e) {
        alert('Erreur lors de l\u2019enregistrement : ' + e.message);
      } finally {
        btn.disabled = false; btn.textContent = '\ud83d\udcbe Enregistrer les infos';
      }
    })()">💾 Enregistrer les infos</button>
    <div class="save-note">✓ Enregistré — réouvrir la fiche depuis la fiche client pour continuer à la modifier</div>
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
    civilite: document.getElementById('ec-civilite') ? (document.getElementById('ec-civilite').value || null) : undefined,
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

