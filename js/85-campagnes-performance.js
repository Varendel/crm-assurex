// ═══ PERFORMANCE DES CAMPAGNES (20.09.2026) ════════════════════════════════════════════════════
// « Il faut pouvoir mesurer la performance des campagnes : performance, retour, rentabilité. »
//
// TROIS ÉTAGES, ET ILS NE SE VALENT PAS.
//
//   1. LA DIFFUSION — combien sont partis, combien sont arrivés. Vient de Brevo, c'est mesuré.
//   2. L'ENGAGEMENT — ouvertures, clics, désabonnements. Vient de Brevo, c'est mesuré, mais
//      l'ouverture est une mesure sale depuis qu'Apple précharge les images (Mail Privacy
//      Protection ouvre les courriels à la place du destinataire). Le CLIC reste propre.
//   3. LE RETOUR — combien d'affaires, combien de francs. Ne vient d'aucune API : c'est du
//      rattachement, et le rattachement est un jugement.
//
// POURQUOI LE RETOUR N'EST PAS CALCULÉ AUTOMATIQUEMENT.
// Il serait facile de compter toutes les affaires nées dans les soixante jours suivant un envoi
// et de les appeler « retour de la campagne ». Le chiffre serait flatteur et faux : il inclurait
// tout ce qui serait arrivé de toute façon. Le CRM propose donc des CANDIDATS — les affaires
// apparues dans la fenêtre — et c'est le conseiller qui confirme ou écarte. Seuls les confirmés
// entrent dans le rendement. Un rendement qu'on a validé ligne à ligne est un rendement sur
// lequel on peut décider ; un rendement automatique est un chiffre qu'on cite sans y croire.
//
// LES REPÈRES DU SECTEUR affichés à côté des taux sont des ORDRES DE GRANDEUR pour l'emailing
// assurance/finance, pas une vérité mesurée sur ce portefeuille. Ils servent à savoir si l'on est
// dans la plage habituelle, jamais à se juger au dixième de point.

const CPF_REPERES = {
  delivrabilite: { bon: 98, moyen: 95, texte: 'Sous 95 %, la liste est à nettoyer : les rebonds abîment la réputation d’expéditeur.' },
  ouverture: { bon: 30, moyen: 20, texte: 'Ordre de grandeur en assurance/finance : 20 à 30 %. Gonflé par les préchargements Apple.' },
  clic: { bon: 3, moyen: 1.5, texte: 'Le clic est la mesure propre : elle n’est pas faussée par les préchargements.' },
  ctor: { bon: 12, moyen: 6, texte: 'Clics rapportés aux ouvertures : mesure la pertinence du contenu pour qui a ouvert.' },
  desabonnement: { bon: 0.3, moyen: 0.6, inverse: true, texte: 'Au-delà de 0,6 %, le message ou le ciblage dérange.' },
  plainte: { bon: 0.05, moyen: 0.1, inverse: true, texte: 'Au-delà de 0,1 %, les boîtes de réception commencent à filtrer l’expéditeur.' },
};

const CPF_ETAPES = ['devis', 'opportunite', 'contrat'];

window._cpf = window._cpf || { campagnes: [], retours: [], choisie: null, chargement: false };

function cpfEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cpfCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }
function cpfPct(n, d) { return d > 0 ? Math.round((n / d) * 1000) / 10 : 0; }
function cpfAff(n) { return String(n).replace('.', ',') + ' %'; }

// Le ton d'un taux : vert dans la plage haute, ambre dans la plage moyenne, rouge en dessous.
// Pour les taux où « moins c'est mieux » (désabonnement, plainte), la comparaison s'inverse.
function cpfTon(cle, valeur) {
  const r = CPF_REPERES[cle];
  if (!r || valeur == null) return 'neutre';
  if (r.inverse) return valeur <= r.bon ? 'ok' : valeur <= r.moyen ? 'moyen' : 'faible';
  return valeur >= r.bon ? 'ok' : valeur >= r.moyen ? 'moyen' : 'faible';
}

// ── Données ─────────────────────────────────────────────────────────────────────────────────────
async function cpfCharger() {
  window._cpf.chargement = true;
  try {
    window._cpf.campagnes = await dbGet('campagnes_projets', 'select=*&order=created_at.desc') || [];
    window._cpf.retours = await dbGet('campagnes_retours', 'select=*') || [];
  } catch (e) {
    window._cpf.campagnes = []; window._cpf.retours = [];
  }
  window._cpf.chargement = false;
}

function cpfRetoursDe(campagneId) {
  return (window._cpf.retours || []).filter(r => r.campagne_id === campagneId);
}

// Les chiffres d'une campagne, réunis en un seul objet. Tout ce qui n'est pas connu vaut null et
// non zéro : un taux d'ouverture inconnu et un taux d'ouverture nul ne se ressemblent pas.
function cpfMesures(c) {
  const s = c.stats || {};
  const envoyes = Number(s.envoyes || 0);
  const rebonds = Number(s.rebonds || 0);
  const livres = envoyes ? envoyes - rebonds : 0;
  const ouvertures = Number(s.ouvertures || 0);
  const clics = Number(s.clics || 0);
  const desab = Number(s.desabonnements || 0);
  const plaintes = Number(s.plaintes || 0);

  const R = cpfRetoursDe(c.id);
  const confirmes = R.filter(r => r.statut === 'confirme');
  const candidats = R.filter(r => r.statut === 'candidat');

  const prime = confirmes.reduce((t, r) => t + Number(r.prime_annuelle || 0), 0);
  const commission = confirmes.reduce((t, r) => t + Number(r.commission || 0), 0);
  const cout = Number(c.cout || 0);

  const parType = t => confirmes.filter(r => r.type === t).length;

  return {
    envoi: !!envoyes,
    envoyes, livres, rebonds, ouvertures, clics, desab, plaintes,
    delivrabilite: envoyes ? cpfPct(livres, envoyes) : null,
    tauxOuverture: livres ? cpfPct(ouvertures, livres) : null,
    tauxClic: livres ? cpfPct(clics, livres) : null,
    ctor: ouvertures ? cpfPct(clics, ouvertures) : null,
    tauxDesab: livres ? cpfPct(desab, livres) : null,
    tauxPlainte: livres ? cpfPct(plaintes, livres) : null,
    devis: parType('devis'), opportunites: parType('opportunite'), contrats: parType('contrat'),
    clients: parType('client'),
    nbConfirmes: confirmes.length, nbCandidats: candidats.length,
    prime, commission, cout,
    // Le rendement : ce que la campagne rapporte pour un franc dépensé. Sans coût saisi, il n'a
    // pas de sens — on renvoie null plutôt qu'un infini ou un zéro trompeur.
    rendement: cout > 0 ? Math.round(((commission - cout) / cout) * 1000) / 10 : null,
    coutParClic: cout > 0 && clics ? Math.round((cout / clics) * 100) / 100 : null,
    coutParAffaire: cout > 0 && parType('contrat') ? Math.round((cout / parType('contrat')) * 100) / 100 : null,
    valeurParDestinataire: envoyes ? Math.round((commission / envoyes) * 100) / 100 : null,
  };
}

// ── L'écran ─────────────────────────────────────────────────────────────────────────────────────
function viewCampagnesPerformance() {
  setTimeout(async () => {
    if (!(window._cpf.campagnes || []).length) await cpfCharger();
    cpfPeindre();
  }, 0);
  return `
    <section class="fcx-hero cpf-hero">
      <div class="fcx-hero-deco" aria-hidden="true"></div>
      <div>
        <span class="cf-surtitre">Marketing</span>
        <h1>Performance des campagnes</h1>
        <p>Ce qui est parti, ce qui a été lu, ce que ça a rapporté. Les deux premiers sont mesurés ;
          le troisième est rattaché à la main, parce qu’une attribution automatique compte comme
          « retour » tout ce qui serait arrivé de toute façon.</p>
      </div>
      <div class="cf-hero-actions">
        <button type="button" class="fcx-btn-verre" onclick="cpfRafraichir()">↻ Actualiser</button>
      </div>
    </section>
    <div id="cpf-corps"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>`;
}

async function cpfRafraichir() { await cpfCharger(); cpfPeindre(); }

function cpfPeindre() {
  const zone = document.getElementById('cpf-corps');
  if (!zone) return;
  const C = (window._cpf.campagnes || []).filter(c => !c.archive);
  if (!C.length) {
    zone.innerHTML = `<section class="dbx-carte cpf-carte"><div class="dbx-vide-petit">
      Aucune campagne au tableau. Créez-en une depuis « Tableau des campagnes », puis reliez-la à
      Brevo par son numéro pour que ses chiffres remontent ici.</div></section>`;
    return;
  }
  const choisie = C.find(c => c.id === window._cpf.choisie) || null;
  zone.innerHTML = cpfSyntheseHtml(C) + (choisie ? cpfDetailHtml(choisie) : '');
}

// ── La synthèse : toutes les campagnes, comparables d'un coup d'œil ─────────────────────────────
function cpfSyntheseHtml(C) {
  const parties = C.filter(c => cpfMesures(c).envoi);
  const tot = parties.reduce((a, c) => {
    const m = cpfMesures(c);
    a.envoyes += m.envoyes; a.livres += m.livres; a.ouvertures += m.ouvertures;
    a.clics += m.clics; a.cout += m.cout; a.commission += m.commission;
    a.contrats += m.contrats; a.prime += m.prime;
    return a;
  }, { envoyes: 0, livres: 0, ouvertures: 0, clics: 0, cout: 0, commission: 0, contrats: 0, prime: 0 });

  const rendement = tot.cout > 0 ? Math.round(((tot.commission - tot.cout) / tot.cout) * 1000) / 10 : null;

  const kpi = (label, valeur, sous, ton) => `<div class="cpf-kpi ${ton || ''}">
    <span class="cpf-kpi-label">${label}</span>
    <b>${valeur}</b><small>${sous}</small></div>`;

  return `
  <section class="dbx-carte cpf-carte">
    <header class="dbx-carte-tete"><div><h2>Toutes campagnes confondues</h2>
      <span class="dbx-carte-sous">${parties.length} envoyée${parties.length > 1 ? 's' : ''} sur ${C.length} au tableau</span></div></header>
    ${parties.length ? `<div class="cpf-kpis">
      ${kpi('Destinataires', cpfCHF(tot.envoyes), `${cpfCHF(tot.livres)} livrés`)}
      ${kpi('Ouvertures', cpfAff(cpfPct(tot.ouvertures, tot.livres)), `${cpfCHF(tot.ouvertures)} lecteurs`, 'ton-' + cpfTon('ouverture', cpfPct(tot.ouvertures, tot.livres)))}
      ${kpi('Clics', cpfAff(cpfPct(tot.clics, tot.livres)), `${cpfCHF(tot.clics)} clics`, 'ton-' + cpfTon('clic', cpfPct(tot.clics, tot.livres)))}
      ${kpi('Affaires signées', cpfCHF(tot.contrats), tot.prime ? `CHF ${cpfCHF(tot.prime)} de primes` : 'rattachées et confirmées')}
      ${kpi('Investi', 'CHF ' + cpfCHF(tot.cout), tot.cout ? 'coût saisi' : 'aucun coût saisi')}
      ${kpi('Rapporté', 'CHF ' + cpfCHF(tot.commission), 'commissions des affaires confirmées')}
      ${rendement != null
        ? kpi('Rendement', (rendement > 0 ? '+' : '') + cpfAff(rendement), 'pour un franc investi', rendement >= 0 ? 'ton-ok' : 'ton-faible')
        : kpi('Rendement', '—', 'saisissez un coût pour le calculer')}
    </div>` : `<div class="dbx-vide-petit">Aucune campagne n’est encore partie : les chiffres
      apparaîtront après le premier envoi et le relevé depuis Brevo.</div>`}
  </section>

  <section class="dbx-carte cpf-carte">
    <header class="dbx-carte-tete"><div><h2>Par campagne</h2>
      <span class="dbx-carte-sous">Cliquez une ligne pour ouvrir son détail et ses retours</span></div></header>
    <div class="cpf-table-enveloppe"><table class="cpf-table">
      <thead><tr>
        <th><span>Campagne</span></th><th><span>Envoi</span></th>
        <th class="d"><span>Partis</span></th><th class="d"><span>Ouv.</span></th>
        <th class="d"><span>Clics</span></th><th class="d"><span>Affaires</span></th>
        <th class="d"><span>Coût</span></th><th class="d"><span>Rapporté</span></th>
        <th class="d"><span>Rendement</span></th>
      </tr></thead>
      <tbody>${C.map(c => cpfLigneHtml(c)).join('')}</tbody>
    </table></div>
    <p class="cpf-note">« Rapporté » ne compte que les affaires <b>confirmées</b> comme venant de la
      campagne. Les affaires simplement apparues dans la fenêtre qui suit l’envoi sont proposées
      dans le détail, et n’entrent dans aucun total tant qu’on ne les a pas reconnues.</p>
  </section>`;
}

function cpfLigneHtml(c) {
  const m = cpfMesures(c);
  const actif = window._cpf.choisie === c.id;
  const rien = '<span class="cpf-vide">—</span>';
  return `<tr class="${actif ? 'actif' : ''}" onclick="cpfChoisir('${c.id}')">
    <td><b>${cpfEsc(c.titre || '')}</b><small>${cpfEsc(c.canal || '')}${c.cible ? ' · ' + cpfEsc(c.cible) : ''}</small></td>
    <td>${c.date_envoi ? fmtDate(c.date_envoi) : (m.envoi ? '<span class="cpf-vide">date à saisir</span>' : '<span class="cpf-tag">non envoyée</span>')}</td>
    <td class="d">${m.envoi ? cpfCHF(m.envoyes) : rien}</td>
    <td class="d">${m.tauxOuverture != null ? `<span class="cpf-taux ton-${cpfTon('ouverture', m.tauxOuverture)}">${cpfAff(m.tauxOuverture)}</span>` : rien}</td>
    <td class="d">${m.tauxClic != null ? `<span class="cpf-taux ton-${cpfTon('clic', m.tauxClic)}">${cpfAff(m.tauxClic)}</span>` : rien}</td>
    <td class="d">${m.contrats || (m.nbCandidats ? `<span class="cpf-candidats">${m.nbCandidats} à trier</span>` : rien)}</td>
    <td class="d">${m.cout ? cpfCHF(m.cout) : rien}</td>
    <td class="d">${m.commission ? cpfCHF(m.commission) : rien}</td>
    <td class="d">${m.rendement != null
      ? `<span class="cpf-taux ${m.rendement >= 0 ? 'ton-ok' : 'ton-faible'}">${m.rendement > 0 ? '+' : ''}${cpfAff(m.rendement)}</span>` : rien}</td>
  </tr>`;
}

function cpfChoisir(id) {
  window._cpf.choisie = window._cpf.choisie === id ? null : id;
  cpfPeindre();
  if (window._cpf.choisie) {
    setTimeout(() => document.getElementById('cpf-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

// ── Le détail d'une campagne ────────────────────────────────────────────────────────────────────
function cpfDetailHtml(c) {
  const m = cpfMesures(c);
  return `<div id="cpf-detail">
    ${cpfEntonnoirHtml(c, m)}
    ${cpfQualiteHtml(m)}
    ${cpfEconomieHtml(c, m)}
    ${cpfRetoursHtml(c)}
  </div>`;
}

// L'entonnoir : chaque étage porte son effectif ET sa conversion depuis l'étage précédent. Un
// entonnoir qui n'affiche que des effectifs oblige à faire les divisions de tête, et personne ne
// les fait.
function cpfEntonnoirHtml(c, m) {
  if (!m.envoi) {
    return `<section class="dbx-carte cpf-carte">
      <header class="dbx-carte-tete"><div><h2>${cpfEsc(c.titre)}</h2>
        <span class="dbx-carte-sous">Pas encore envoyée</span></div></header>
      <div class="dbx-vide-petit">Les chiffres apparaîtront après l’envoi, puis le relevé depuis
        l’écran Brevo.</div>
    </section>`;
  }
  const etapes = [
    { nom: 'Envoyés', n: m.envoyes, de: null },
    { nom: 'Livrés', n: m.livres, de: m.envoyes },
    { nom: 'Ouverts', n: m.ouvertures, de: m.livres },
    { nom: 'Cliqués', n: m.clics, de: m.ouvertures },
    { nom: 'Affaires', n: m.contrats, de: m.clics },
  ];
  const max = Math.max(...etapes.map(e => e.n), 1);
  return `<section class="dbx-carte cpf-carte">
    <header class="dbx-carte-tete"><div><h2>${cpfEsc(c.titre)}</h2>
      <span class="dbx-carte-sous">${c.date_envoi ? 'Envoyée le ' + fmtDate(c.date_envoi) : 'Date d’envoi non saisie'}
        ${c.stats_le ? '· chiffres relevés le ' + fmtDate(String(c.stats_le).slice(0, 10)) : ''}</span></div>
      <button type="button" class="btn-secondary" onclick="cpfOuvrirReglages('${c.id}')">Coût et date d’envoi</button>
    </header>
    <div class="cpf-entonnoir">${etapes.map(e => `
      <div class="cpf-etage">
        <div class="cpf-etage-barre"><i style="width:${Math.max(3, (e.n / max) * 100)}%"></i></div>
        <div class="cpf-etage-texte">
          <b>${cpfCHF(e.n)}</b>
          <span>${e.nom}</span>
          ${e.de ? `<small>${cpfAff(cpfPct(e.n, e.de))} de l’étape précédente</small>` : '<small>base</small>'}
        </div>
      </div>`).join('')}</div>
    ${!m.contrats && m.nbCandidats ? `<p class="cpf-note">${m.nbCandidats} affaire${m.nbCandidats > 1 ? 's' : ''}
      ${m.nbCandidats > 1 ? 'sont apparues' : 'est apparue'} dans la fenêtre qui suit l’envoi,
      mais ${m.nbCandidats > 1 ? 'aucune n’a' : 'elle n’a pas'} encore été confirmée : le dernier
      étage reste donc à zéro.</p>` : ''}
  </section>`;
}

function cpfQualiteHtml(m) {
  if (!m.envoi) return '';
  const l = [
    ['Délivrabilité', m.delivrabilite, 'delivrabilite', `${cpfCHF(m.rebonds)} rebond${m.rebonds > 1 ? 's' : ''}`],
    ['Taux d’ouverture', m.tauxOuverture, 'ouverture', `${cpfCHF(m.ouvertures)} lecteurs`],
    ['Taux de clic', m.tauxClic, 'clic', `${cpfCHF(m.clics)} clics`],
    ['Clics / ouvertures', m.ctor, 'ctor', 'pertinence du contenu'],
    ['Désabonnements', m.tauxDesab, 'desabonnement', `${cpfCHF(m.desab)} départs`],
    ['Plaintes', m.tauxPlainte, 'plainte', `${cpfCHF(m.plaintes)} signalements`],
  ];
  return `<section class="dbx-carte cpf-carte">
    <header class="dbx-carte-tete"><div><h2>Qualité de la diffusion</h2>
      <span class="dbx-carte-sous">Comparé aux ordres de grandeur du secteur, pas à une norme</span></div></header>
    <div class="cpf-mesures">${l.map(([nom, v, cle, sous]) => `
      <div class="cpf-mesure ton-${cpfTon(cle, v)}" title="${cpfEsc(CPF_REPERES[cle].texte)}">
        <span class="cpf-mesure-nom">${nom}</span>
        <b>${v != null ? cpfAff(v) : '—'}</b>
        <small>${sous}</small>
        <span class="cpf-repere">repère ${CPF_REPERES[cle].inverse ? '≤' : '≥'} ${cpfAff(CPF_REPERES[cle].bon)}</span>
      </div>`).join('')}</div>
    <p class="cpf-note"><b>Sur le taux d’ouverture :</b> depuis que Mail d’Apple précharge les
      images à la place du destinataire, une partie des « ouvertures » n’a été lue par personne.
      Le chiffre garde sa valeur pour comparer deux campagnes entre elles, il ne dit plus combien
      de gens ont lu. Le <b>clic</b>, lui, demande un geste : c’est la mesure sur laquelle décider.</p>
  </section>`;
}

function cpfEconomieHtml(c, m) {
  const sansCout = !m.cout;
  return `<section class="dbx-carte cpf-carte">
    <header class="dbx-carte-tete"><div><h2>Rentabilité</h2>
      <span class="dbx-carte-sous">${sansCout ? 'Aucun coût saisi — le rendement ne peut pas être calculé' : 'Sur les affaires confirmées uniquement'}</span></div></header>
    <div class="cpf-kpis">
      <div class="cpf-kpi"><span class="cpf-kpi-label">Investi</span><b>CHF ${cpfCHF(m.cout)}</b>
        <small>${sansCout ? 'à saisir' : 'coût de la campagne'}</small></div>
      <div class="cpf-kpi"><span class="cpf-kpi-label">Primes apportées</span><b>CHF ${cpfCHF(m.prime)}</b>
        <small>${m.contrats} affaire${m.contrats > 1 ? 's' : ''} confirmée${m.contrats > 1 ? 's' : ''}</small></div>
      <div class="cpf-kpi"><span class="cpf-kpi-label">Commissions</span><b>CHF ${cpfCHF(m.commission)}</b>
        <small>ce que touche Assurex</small></div>
      <div class="cpf-kpi ${m.rendement == null ? '' : m.rendement >= 0 ? 'ton-ok' : 'ton-faible'}">
        <span class="cpf-kpi-label">Rendement</span>
        <b>${m.rendement != null ? (m.rendement > 0 ? '+' : '') + cpfAff(m.rendement) : '—'}</b>
        <small>(commissions − coût) ÷ coût</small></div>
      <div class="cpf-kpi"><span class="cpf-kpi-label">Coût par clic</span>
        <b>${m.coutParClic != null ? 'CHF ' + String(m.coutParClic).replace('.', ',') : '—'}</b>
        <small>ce que coûte un geste d’intérêt</small></div>
      <div class="cpf-kpi"><span class="cpf-kpi-label">Coût par affaire</span>
        <b>${m.coutParAffaire != null ? 'CHF ' + cpfCHF(m.coutParAffaire) : '—'}</b>
        <small>${m.contrats ? 'à comparer à la commission moyenne' : 'aucune affaire confirmée'}</small></div>
    </div>
    <p class="cpf-note">Le rendement se lit sur la <b>commission</b>, pas sur la prime : la prime est
      ce que paie le client à l’assureur, la commission est ce qui revient à Assurex. Et il ne
      compte qu’une année : une affaire qui dure cinq ans rapporte davantage que ce chiffre ne le
      dit — ce qui est affiché est donc un plancher, jamais une promesse.</p>
  </section>`;
}

// ── Les retours à trier ─────────────────────────────────────────────────────────────────────────
function cpfRetoursHtml(c) {
  const R = cpfRetoursDe(c.id);
  const candidats = R.filter(r => r.statut === 'candidat');
  const confirmes = R.filter(r => r.statut === 'confirme');
  const ecartes = R.filter(r => r.statut === 'ecarte');

  return `<section class="dbx-carte cpf-carte">
    <header class="dbx-carte-tete"><div><h2>Retours rattachés</h2>
      <span class="dbx-carte-sous">${confirmes.length} confirmé${confirmes.length > 1 ? 's' : ''} ·
        ${candidats.length} à trier · ${ecartes.length} écarté${ecartes.length > 1 ? 's' : ''}</span></div>
      <button type="button" class="btn-save" onclick="cpfProposer('${c.id}')">Chercher des candidats</button>
    </header>
    ${R.length ? `<div class="cpf-retours">${R.map(r => cpfRetourHtml(r)).join('')}</div>`
      : `<div class="dbx-vide-petit">Aucun retour rattaché. « Chercher des candidats » liste les
        affaires apparues dans les ${c.fenetre_jours || 60} jours suivant l’envoi ; à vous de
        reconnaître celles qui viennent vraiment de cette campagne.</div>`}
  </section>`;
}

const CPF_TYPES = { devis: 'Demande de devis', opportunite: 'Affaire', contrat: 'Contrat signé', client: 'Nouveau client' };

function cpfRetourHtml(r) {
  const nom = cpfNomObjet(r);
  return `<article class="cpf-retour ${r.statut}">
    <div class="cpf-retour-texte">
      <b>${cpfEsc(nom)}</b>
      <small>${CPF_TYPES[r.type] || r.type}${r.prime_annuelle ? ` · prime CHF ${cpfCHF(r.prime_annuelle)}` : ''}${r.commission ? ` · commission CHF ${cpfCHF(r.commission)}` : ''}</small>
    </div>
    <div class="cpf-retour-actions">
      ${r.statut === 'candidat' ? `
        <button type="button" class="cpf-act cpf-act-oui" onclick="cpfDecider('${r.id}','confirme')">Vient de la campagne</button>
        <button type="button" class="cpf-act" onclick="cpfDecider('${r.id}','ecarte')">Non</button>`
      : `<span class="cpf-statut ${r.statut}">${r.statut === 'confirme' ? '✓ Confirmé' : '✕ Écarté'}</span>
         <button type="button" class="cpf-act" onclick="cpfDecider('${r.id}','candidat')">Revoir</button>`}
    </div>
  </article>`;
}

function cpfNomObjet(r) {
  const cl = id => {
    const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === id);
    if (!c) return null;
    return (typeof estEntreprise === 'function' && estEntreprise(c)) ? c.nom : [c.prenom, c.nom].filter(Boolean).join(' ');
  };
  if (r.type === 'client') return cl(r.objet_id) || 'Client';
  if (r.type === 'opportunite') {
    const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === r.objet_id);
    return o ? `${o.titre || 'Affaire'} — ${cl(o.client_id) || o.prospect_nom || ''}` : 'Affaire';
  }
  if (r.type === 'contrat') {
    const ct = (typeof allContrats !== 'undefined' ? allContrats : []).find(x => x.id === r.objet_id);
    return ct ? `${ct.produit || 'Contrat'} — ${cl(ct.client_id) || ''}` : 'Contrat';
  }
  return r.note || 'Demande de devis';
}

// ── Proposer des candidats ──────────────────────────────────────────────────────────────────────
// Ce n'est PAS une attribution : c'est une liste de suspects, bornée par les dates. Le mot
// « candidat » est choisi exprès — rien n'entre dans le rendement sans un clic de confirmation.
async function cpfProposer(campagneId) {
  const c = (window._cpf.campagnes || []).find(x => x.id === campagneId);
  if (!c) return;
  if (!c.date_envoi) {
    showError('Saisissez d’abord la date d’envoi : sans elle, aucune fenêtre ne peut être calculée.');
    cpfOuvrirReglages(campagneId);
    return;
  }
  const debut = c.date_envoi;
  const fin = new Date(new Date(debut + 'T00:00:00').getTime() + (Number(c.fenetre_jours) || 60) * 86400000)
    .toISOString().slice(0, 10);

  const dejaVus = new Set(cpfRetoursDe(campagneId).map(r => r.type + ':' + r.objet_id));
  const nouveaux = [];

  const dans = iso => { const d = String(iso || '').slice(0, 10); return d >= debut && d <= fin; };

  for (const o of (typeof allOpportunites !== 'undefined' ? allOpportunites : [])) {
    if (!dans(o.created_at) || dejaVus.has('opportunite:' + o.id)) continue;
    nouveaux.push({
      campagne_id: campagneId, type: 'opportunite', objet_id: o.id, statut: 'candidat',
      prime_annuelle: Number(o.montant_potentiel || 0) || null,
      commission: Number(o.commission_estimee || 0) || null,
    });
  }
  for (const ct of (typeof allContrats !== 'undefined' ? allContrats : [])) {
    if (!dans(ct.created_at) || dejaVus.has('contrat:' + ct.id)) continue;
    nouveaux.push({
      campagne_id: campagneId, type: 'contrat', objet_id: ct.id, statut: 'candidat',
      prime_annuelle: Number(ct.prime_annuelle || 0) || null,
      commission: cpfCommissionDe(ct.id) || null,
    });
  }

  if (!nouveaux.length) {
    showError(`Aucune affaire nouvelle entre le ${fmtDate(debut)} et le ${fmtDate(fin)}.`);
    return;
  }
  const r = await dbPost('campagnes_retours', nouveaux);
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  await cpfCharger();
  cpfPeindre();
  showError(`✓ ${nouveaux.length} candidat${nouveaux.length > 1 ? 's' : ''} à trier — rien n’est compté avant confirmation.`);
}

function cpfCommissionDe(contratId) {
  return (typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : [])
    .filter(x => x.contrat_id === contratId && x.statut !== 'annulée')
    .reduce((s, x) => s + Number(x.montant_final ?? x.montant_estime ?? 0), 0);
}

async function cpfDecider(retourId, statut) {
  const r = await dbPatch('campagnes_retours', retourId, {
    statut, decide_le: new Date().toISOString(),
    decide_par: (typeof crxMoi === 'function' ? crxMoi().nom : null),
  });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  const l = (window._cpf.retours || []).find(x => x.id === retourId);
  if (l) l.statut = statut;
  cpfPeindre();
}

// ── Coût et date d'envoi ────────────────────────────────────────────────────────────────────────
function cpfOuvrirReglages(campagneId) {
  const c = (window._cpf.campagnes || []).find(x => x.id === campagneId);
  if (!c || typeof creerModale !== 'function') return;
  creerModale('modal-cpf', `
    <div class="modal-box cpf-modale">
      <h3>Coût et envoi — ${cpfEsc(c.titre)}</h3>
      <div class="form-grid">
        <div class="form-field"><label class="form-label" for="cpf-cout">Coût total (CHF)</label>
          <input class="form-input" id="cpf-cout" inputmode="decimal" value="${c.cout ?? ''}" placeholder="ex. 450"/>
          <small class="cpf-aide">Tout ce que la campagne a coûté : abonnement au prorata, visuel,
            rédaction, et le temps passé si vous le valorisez. Sans coût, pas de rendement.</small></div>
        <div class="form-field"><label class="form-label" for="cpf-envoi">Date d’envoi réelle</label>
          <input class="form-input" id="cpf-envoi" type="date" value="${c.date_envoi || ''}"/></div>
        <div class="form-field"><label class="form-label" for="cpf-fenetre">Fenêtre d’attribution (jours)</label>
          <input class="form-input" id="cpf-fenetre" type="number" min="1" max="365" value="${c.fenetre_jours ?? 60}"/>
          <small class="cpf-aide">Durée pendant laquelle une affaire nouvelle est proposée comme
            retour possible. 60 jours par défaut : en assurance, un devis se décide rarement en
            moins de deux semaines et rarement au-delà de deux mois.</small></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-cpf').remove()">Annuler</button>
        <button type="button" class="btn-save" onclick="cpfEnregistrerReglages('${c.id}')">✓ Enregistrer</button>
      </div>
    </div>`, { opacite: .55 });
}

async function cpfEnregistrerReglages(campagneId) {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const cout = v('cpf-cout').replace(/['’\s]/g, '').replace(',', '.');
  const ligne = {
    cout: cout === '' ? null : Number(cout),
    date_envoi: v('cpf-envoi') || null,
    fenetre_jours: Number(v('cpf-fenetre')) || 60,
  };
  if (ligne.cout != null && !isFinite(ligne.cout)) { showError('Le coût doit être un nombre.'); return; }
  const r = await dbPatch('campagnes_projets', campagneId, ligne);
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  Object.assign((window._cpf.campagnes || []).find(x => x.id === campagneId) || {}, ligne);
  document.getElementById('modal-cpf')?.remove();
  cpfPeindre();
  showError('✓ Enregistré');
}

(function cpfBrancher() {
  if (typeof NAV_SYNONYMES !== 'undefined') {
    NAV_SYNONYMES['campagnes-performance'] = 'performance campagne roi rentabilite retour rendement ouverture clic emailing entonnoir cout';
  }
})();
