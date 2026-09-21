// ═══ TOUTES LES RÉSILIATIONS, ET LEURS EXPORTS (20.09.2026) ════════════════════════════════════
// « Est-ce que la fonction résiliation a été faite ? J'en ai besoin car bientôt je dois sortir des
// exports des résiliations à faire. »
//
// Le suivi par affaire existait (js/92) ; la vue d'ensemble, non. Or une résiliation ne se suit
// pas dossier par dossier : elle se suit par DATE. Ce qui compte n'est pas « où en est l'affaire
// Dupont » mais « qu'est-ce qui doit partir avant la fin du mois ». Ouvrir trente fiches pour le
// savoir, c'est la garantie d'en oublier une — et une résiliation oubliée coûte au client une
// année de prime.
//
// TROIS EXPORTS, PARCE QU'ILS NE SERVENT PAS À LA MÊME CHOSE.
//   Excel   — la liste de travail : triable, filtrable, à cocher au fur et à mesure.
//   Impression — la liste à emporter, ou à faire valider.
//   Lettres — le texte de chaque résiliation, à la suite, prêt à être mis en page et signé.
//
// L'URGENCE EST CALCULÉE SUR LA DATE DE RÉCEPTION, jamais sur celle de l'envoi. C'est la
// réception par l'assureur qui fait foi : entre le moment où l'on poste et celui où la lettre
// arrive, il se passe deux à quatre jours ouvrés. Une liste qui compte à rebours jusqu'à l'envoi
// ferait rater des délais en donnant l'impression du contraire.

window._rsx = window._rsx || { lignes: [], chargement: false, etat: 'a_faire', horizon: 120, tri: 'limite' };

function rsxEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rsxCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }
function rsxJours(iso) { return iso ? Math.ceil((new Date(iso + 'T23:59:59') - new Date()) / 86400000) : null; }

// Le délai de poste : une résiliation doit être postée AVANT sa date limite de réception.
// Quatre jours civils couvrent un week-end ; c'est volontairement prudent.
const RSX_POSTE = 4;

function rsxEtat(r) {
  if (r.confirmee_le) return { cle: 'confirmee', nom: 'Confirmée', ton: 'ok', rang: 4 };
  if (r.envoyee_le) return { cle: 'envoyee', nom: 'Envoyée, en attente', ton: 'attente', rang: 3 };
  const j = rsxJours(r.limite);
  if (j == null) return { cle: 'sans_date', nom: 'Échéance inconnue', ton: 'alerte', rang: 1 };
  if (j < 0) return { cle: 'depassee', nom: `Dépassée de ${-j} j`, ton: 'grave', rang: 0 };
  if (j <= RSX_POSTE) return { cle: 'aujourdhui', nom: 'À poster aujourd’hui', ton: 'grave', rang: 0 };
  if (j <= 21) return { cle: 'urgente', nom: `${j} j`, ton: 'grave', rang: 1 };
  if (j <= 60) return { cle: 'proche', nom: `${j} j`, ton: 'alerte', rang: 2 };
  return { cle: 'a_venir', nom: `${j} j`, ton: '', rang: 2 };
}

async function rsxCharger() {
  window._rsx.chargement = true;
  try {
    const r = await dbGet('opportunites_resiliations', 'select=*&order=limite.asc.nullslast');
    window._rsx.lignes = Array.isArray(r) ? r : [];
    window._rsx.erreur = null;
  } catch (e) {
    window._rsx.lignes = [];
    window._rsx.erreur = String(e.message || e);
  }
  window._rsx.chargement = false;
}

// Une ligne enrichie de son contexte : de quelle affaire, de quel client. Sans le nom du client,
// une liste de résiliations n'est pas exploitable — c'est lui qui signe la lettre.
function rsxEnrichies() {
  const OPP = typeof allOpportunites !== 'undefined' ? allOpportunites : [];
  const CL = typeof allClients !== 'undefined' ? allClients : [];
  return (window._rsx.lignes || []).map(r => {
    const o = OPP.find(x => x.id === r.opportunite_id) || null;
    const c = o ? CL.find(x => x.id === o.client_id) : null;
    const nom = c ? ((typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : [c.prenom, c.nom].filter(Boolean).join(' '))
      : (o && o.prospect_nom) || '—';
    return { ...r, opp: o, client: c, client_nom: nom, affaire: o ? (o.titre || '') : '', etat: rsxEtat(r) };
  });
}

function rsxVisibles() {
  const F = window._rsx;
  const l = rsxEnrichies().filter(r => {
    if (F.etat === 'a_faire' && (r.envoyee_le || r.confirmee_le)) return false;
    if (F.etat === 'attente' && !(r.envoyee_le && !r.confirmee_le)) return false;
    if (F.etat === 'confirmees' && !r.confirmee_le) return false;
    if (F.horizon && !r.envoyee_le && !r.confirmee_le) {
      const j = rsxJours(r.limite);
      if (j != null && j > F.horizon) return false;
    }
    return true;
  });
  return l.sort((a, b) => {
    if (F.tri === 'client') return a.client_nom.localeCompare(b.client_nom, 'fr');
    if (F.tri === 'compagnie') return String(a.compagnie || '').localeCompare(String(b.compagnie || ''), 'fr');
    // Par défaut : le plus urgent d'abord, et les sans-date remontent — une échéance inconnue
    // est un risque, pas une absence de risque.
    return a.etat.rang - b.etat.rang
      || String(a.limite || '9999').localeCompare(String(b.limite || '9999'));
  });
}

// ── L'écran ─────────────────────────────────────────────────────────────────────────────────────
function viewResiliations() {
  setTimeout(async () => { await rsxCharger(); rsxPeindre(); }, 0);
  return `
    <section class="fcx-hero rsx-hero">
      <div class="fcx-hero-deco" aria-hidden="true"></div>
      <div>
        <span class="cf-surtitre">Transferts</span>
        <h1>Résiliations à faire</h1>
        <p>Les contrats à quitter, par date limite. Le compte à rebours porte sur la <b>réception</b>
          par l’assureur : il faut poster ${RSX_POSTE} jours plus tôt.</p>
      </div>
      <div class="cf-hero-actions">
        <button type="button" class="fcx-btn-verre" onclick="rsxRafraichir()">↻ Actualiser</button>
      </div>
    </section>
    <div id="rsx-corps"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>`;
}

async function rsxRafraichir() {
  const z = document.getElementById('rsx-corps');
  if (z) z.innerHTML = '<div class="dbx-chargement"><span></span><span></span><span></span></div>';
  await rsxCharger();
  rsxPeindre();
}

function rsxFiltrer(champ, v) {
  window._rsx[champ] = champ === 'horizon' ? Number(v) : v;
  rsxPeindre();
}

function rsxPeindre() {
  const z = document.getElementById('rsx-corps');
  if (!z) return;
  const F = window._rsx;

  if (F.erreur) {
    z.innerHTML = `<section class="dbx-carte rsx-carte"><div class="rsx-vide">
      <b>La liste n’a pas pu être lue.</b><p>${rsxEsc(F.erreur)}</p></div></section>`;
    return;
  }

  const toutes = rsxEnrichies();
  const aFaire = toutes.filter(r => !r.envoyee_le && !r.confirmee_le);
  const urgentes = aFaire.filter(r => ['depassee', 'aujourdhui', 'urgente'].includes(r.etat.cle));
  const depassees = aFaire.filter(r => r.etat.cle === 'depassee');
  const attente = toutes.filter(r => r.envoyee_le && !r.confirmee_le);
  const L = rsxVisibles();

  const seg = (champ, vals) => `<div class="rsx-segments">${vals.map(([v, n]) =>
    `<button type="button" class="${String(F[champ]) === String(v) ? 'actif' : ''}" onclick="rsxFiltrer('${champ}','${v}')">${n}</button>`).join('')}</div>`;

  z.innerHTML = `
    <section class="dbx-carte rsx-carte">
      <header class="dbx-carte-tete">
        <div><h2>${aFaire.length} résiliation${aFaire.length > 1 ? 's' : ''} à envoyer</h2>
          <span class="dbx-carte-sous">${attente.length} en attente de confirmation ·
            ${toutes.filter(r => r.confirmee_le).length} confirmée${toutes.filter(r => r.confirmee_le).length > 1 ? 's' : ''}</span></div>
        ${depassees.length ? `<span class="rsx-alerte-tete">${depassees.length} délai${depassees.length > 1 ? 's' : ''} dépassé${depassees.length > 1 ? 's' : ''}</span>`
          : urgentes.length ? `<span class="rsx-alerte-tete urgent">${urgentes.length} à traiter sous 3 semaines</span>` : ''}
      </header>

      ${depassees.length ? `<div class="rsx-bandeau grave">
        <b>${depassees.length} résiliation${depassees.length > 1 ? 's' : ''} hors délai</b>
        <small>Ces contrats repartent pour une année. Si le client a déjà signé ailleurs, il paiera
          deux primes : il faut le lui dire maintenant, et voir avec la compagnie s’il reste une
          issue (déménagement, changement de situation, sinistre).</small>
      </div>` : ''}

      <div class="rsx-outils">
        <div><label class="rsx-label">État</label>
          ${seg('etat', [['a_faire', 'À envoyer'], ['attente', 'En attente'], ['confirmees', 'Confirmées'], ['tout', 'Tout']])}</div>
        <div><label class="rsx-label">Horizon</label>
          ${seg('horizon', [[30, '30 j'], [60, '60 j'], [120, '120 j'], [0, 'Tout']])}</div>
        <div><label class="rsx-label">Trier par</label>
          ${seg('tri', [['limite', 'Urgence'], ['client', 'Client'], ['compagnie', 'Compagnie']])}</div>
        <div class="rsx-exports">
          <button type="button" class="btn-save" onclick="rsxExcel()">⬇ Excel</button>
          <button type="button" class="btn-secondary" onclick="rsxImprimer()">🖨️ Imprimer</button>
          <button type="button" class="btn-secondary" onclick="rsxLettres()">✉️ Lettres</button>
        </div>
      </div>
    </section>

    ${L.length ? `<section class="dbx-carte rsx-carte">
      <div class="rsx-table-enveloppe"><table class="rsx-table">
        <thead><tr>
          <th><span>Échéance</span></th><th><span>Client</span></th><th><span>Compagnie</span></th>
          <th><span>Contrat</span></th>
          <th><span>État</span></th><th><span></span></th>
        </tr></thead>
        <tbody>${L.map(rsxLigneHtml).join('')}</tbody>
      </table></div>
    </section>`
    : `<section class="dbx-carte rsx-carte"><div class="rsx-vide rsx-ok">
        <b>✓ Rien à envoyer</b>
        <p>Aucune résiliation ne correspond à cette sélection.</p>
      </div></section>`}`;
}

// « Poster avant » = limite moins RSX_POSTE jours, en date LOCALE : toISOString() passait en UTC
// et reculait d'un jour de plus en heure suisse (limite 30.09 → 25.09 au lieu du 26.09).
function rsxPosterAvant(limite) {
  const d = new Date(limite + 'T00:00:00');
  d.setDate(d.getDate() - RSX_POSTE);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rsxLigneHtml(r) {
  const e = r.etat;
  return `<tr class="ton-${e.ton}">
    <td class="rsx-date">
      ${r.limite ? `<b>${fmtDate(r.limite)}</b><small>poster avant le ${fmtDate(rsxPosterAvant(r.limite))}</small>`
        : '<b class="rsx-inconnu">à déterminer</b><small>échéance du contrat inconnue</small>'}
    </td>
    <td><b>${rsxEsc(r.client_nom)}</b><small>${rsxEsc(r.affaire)}</small></td>
    <td>${rsxEsc(r.compagnie || '—')}</td>
    <td>${rsxEsc(r.produit || '—')}<small>${r.numero_police ? 'police ' + rsxEsc(r.numero_police) : ''}</small></td>
    <td><span class="rsx-etat ton-${e.ton}">${rsxEsc(e.nom)}</span></td>
    <td class="rsx-actions">
      ${r.opp ? `<button type="button" class="rsx-act" onclick="rsxOuvrirAffaire('${r.opportunite_id}')" title="Ouvrir l’affaire">Affaire</button>` : ''}
      ${!r.envoyee_le ? `<button type="button" class="rsx-act rsx-act-ok" onclick="rsxMarquer('${r.id}','envoyee_le')">Envoyée</button>`
        : !r.confirmee_le ? `<button type="button" class="rsx-act rsx-act-ok" onclick="rsxMarquer('${r.id}','confirmee_le')">Confirmée</button>` : ''}
    </td>
  </tr>`;
}

function rsxOuvrirAffaire(oppId) {
  if (typeof opportuniteEnEditionId !== 'undefined') opportuniteEnEditionId = oppId;
  if (typeof navigate === 'function') navigate('nouvelle-opportunite');
}

async function rsxMarquer(id, champ) {
  const auj = new Date().toISOString().slice(0, 10);
  const r = await dbPatch('opportunites_resiliations', id, { [champ]: auj });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  const l = (window._rsx.lignes || []).find(x => x.id === id);
  if (l) l[champ] = auj;
  // Le bloc de la fiche affaire lit son propre cache : on l'invalide pour qu'il ne montre pas
  // l'ancien état si on y retourne dans la foulée.
  if (l && window._rsl && window._rsl.parOpp) window._rsl.parOpp[l.opportunite_id] = null;
  rsxPeindre();
  showError(champ === 'envoyee_le' ? '✓ Envoi noté' : '✓ Confirmée');
}

// ── Les exports ─────────────────────────────────────────────────────────────────────────────────
function rsxExcel() {
  if (typeof XLSX === 'undefined') { showError('Le module Excel n’est pas chargé.'); return; }
  const L = rsxVisibles();
  if (!L.length) { showError('Rien à exporter dans cette sélection.'); return; }

  const d = iso => (iso ? new Date(iso + 'T00:00:00') : null);
  const feuille = XLSX.utils.json_to_sheet(L.map(r => ({
    'Réception avant le': d(r.limite),
    'À poster avant le': r.limite ? d(rsxPosterAvant(r.limite)) : null,
    Client: r.client_nom,
    Compagnie: r.compagnie || '',
    Contrat: r.produit || '',
    'N° de police': r.numero_police || '',
    'Échéance du contrat': d(r.echeance),
    État: r.etat.nom,
    'Envoyée le': d(r.envoyee_le),
    'Confirmée le': d(r.confirmee_le),
    Affaire: r.affaire,
  })));
  feuille['!cols'] = [{ wch: 17 }, { wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 30 },
    { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 13 }, { wch: 28 }];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, 'Résiliations');
  XLSX.writeFile(classeur, `resiliations_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// L'impression : une zone dédiée plutôt que la page telle quelle. On imprime la LISTE, pas
// l'interface — les filtres, les boutons et le menu n'ont rien à faire sur un papier.
function rsxImprimer() {
  const L = rsxVisibles();
  if (!L.length) { showError('Rien à imprimer dans cette sélection.'); return; }
  const zone = document.createElement('div');
  zone.id = 'rsx-impression';
  zone.innerHTML = `
    <header class="rsx-imp-tete">
      <div><h1>Résiliations à faire</h1>
        <p>Au ${fmtDate(new Date().toISOString().slice(0, 10))} · ${L.length} ligne${L.length > 1 ? 's' : ''}</p></div>
      <img src="assets/logos/assurex.png" alt="Assurex"/>
    </header>
    <table class="rsx-imp-table">
      <thead><tr><th>✓</th><th>Réception avant</th><th>Poster avant</th><th>Client</th>
        <th>Compagnie</th><th>Police</th><th>Contrat</th></tr></thead>
      <tbody>${L.map(r => `<tr>
        <td class="rsx-case"></td>
        <td>${r.limite ? fmtDate(r.limite) : '—'}</td>
        <td>${r.limite ? fmtDate(rsxPosterAvant(r.limite)) : '—'}</td>
        <td>${rsxEsc(r.client_nom)}</td>
        <td>${rsxEsc(r.compagnie || '')}</td>
        <td>${rsxEsc(r.numero_police || '')}</td>
        <td>${rsxEsc(r.produit || '')}</td>
      </tr>`).join('')}</tbody>
    </table>
    <p class="rsx-imp-pied">Le délai porte sur la <b>réception</b> par l’assureur : la colonne
      « poster avant » retire ${RSX_POSTE} jours pour le courrier. Assurex Sàrl — Rue du Centre 142, 1025 St-Sulpice.</p>`;

  document.getElementById('rsx-impression')?.remove();
  document.body.appendChild(zone);
  document.body.classList.add('rsx-mode-impression');
  const nettoyer = () => {
    document.body.classList.remove('rsx-mode-impression');
    document.getElementById('rsx-impression')?.remove();
    window.removeEventListener('afterprint', nettoyer);
  };
  window.addEventListener('afterprint', nettoyer);
  setTimeout(() => window.print(), 80);
  setTimeout(nettoyer, 60000);   // filet : certains navigateurs n'émettent pas « afterprint »
}

// Les lettres, à la suite, dans le presse-papiers. Une par contrat, séparées par un trait de
// coupe : il n'y a plus qu'à coller dans un traitement de texte, mettre l'en-tête et faire signer.
// Rien ne part d'ici : une résiliation s'envoie sous la signature du client.
function rsxLettres() {
  const L = rsxVisibles().filter(r => !r.envoyee_le);
  if (!L.length) { showError('Aucune lettre à préparer : tout est déjà envoyé.'); return; }
  const auj = fmtDate(new Date().toISOString().slice(0, 10));

  const texte = L.map(r => {
    const c = r.client;
    return [
      rsxEsc(r.client_nom),
      c && c.adresse ? c.adresse : '',
      c && (c.npa || c.ville) ? `${c.npa || ''} ${c.ville || ''}`.trim() : '',
      '',
      r.compagnie || '[Compagnie]',
      '',
      `${c && c.ville ? c.ville + ', ' : ''}le ${auj}`,
      '',
      `Objet : résiliation de la police n° ${r.numero_police || '[numéro]'}${r.produit ? ` — ${r.produit}` : ''}`,
      '',
      'Madame, Monsieur,',
      '',
      `Par la présente, je résilie la police citée en objet pour son échéance du ${r.echeance ? fmtDate(r.echeance) : '[échéance]'}, dans le respect du délai contractuel.`,
      '',
      'Je vous remercie de me confirmer par écrit la prise en compte de cette résiliation ainsi que la date effective de fin de couverture.',
      '',
      'Veuillez agréer, Madame, Monsieur, mes salutations distinguées.',
      '',
      '',
      rsxEsc(r.client_nom),
    ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
  }).join('\n\n' + '─'.repeat(64) + '\n\n');

  const fini = ok => showError(ok
    ? `✓ ${L.length} lettre${L.length > 1 ? 's' : ''} copiée${L.length > 1 ? 's' : ''} — à relire et à faire signer`
    : 'Copie impossible — utilisez l’export Excel.');
  navigator.clipboard.writeText(texte).then(() => fini(true)).catch(() => {
    try {
      const z = document.createElement('textarea');
      z.value = texte; z.style.cssText = 'position:fixed;top:-9999px';
      document.body.appendChild(z); z.select();
      fini(document.execCommand('copy'));
      z.remove();
    } catch (e) { fini(false); }
  });
}

(function rsxBrancher() {
  if (typeof NAV_SYNONYMES !== 'undefined') {
    NAV_SYNONYMES['resiliations'] = 'resiliation resilier quitter assureur delai echeance lettre transfert export';
  }
})();
