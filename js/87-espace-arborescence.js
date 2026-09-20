// ═══ REX CLOUD : LES CONTRATS EN ARBORESCENCE (20.09.2026) ═════════════════════════════════════
// « Clients entreprise et privés : incorpore une arborescence des contrats regroupés par
// catégories, pour leurs espaces respectifs. »
//
// L'onglet « Mes contrats » empilait des cartes, une par famille, toutes ouvertes. Pour un
// particulier avec cinq contrats, cela passe. Pour une entreprise qui en a vingt-deux, la page
// fait quatre écrans de haut et le client fait défiler en cherchant. Une arborescence repliable
// lui donne d'abord la carte de ce qu'il possède — six lignes —, puis ce qu'il veut voir.
//
// DEUX JEUX DE CATÉGORIES, PARCE QUE CE NE SONT PAS LES MÊMES ASSURANCES.
// Les familles de l'espace client (EC_TYPES) sont pensées pour un particulier : véhicules,
// ménage, santé, prévoyance. Une entreprise y tombait entièrement dans une seule case nommée
// « Entreprise » — ce qui revenait à lui dire « voici vos vingt-deux contrats, débrouillez-vous ».
// Une société lit son portefeuille autrement : ce qui protège ses GENS, ce qui couvre sa
// RESPONSABILITÉ, ce qui protège ses BIENS. C'est la structure d'un rapport de courtage, et c'est
// celle que nous lui montrons.
//
// L'ordre des catégories n'est pas alphabétique : il va du plus engageant au plus accessoire.
// Pour une entreprise, le personnel d'abord — c'est ce qui est obligatoire et ce qui coûte le
// plus. Pour un particulier, la santé et les véhicules d'abord, pour la même raison.

// Les familles d'une entreprise. Les expressions sont testées dans l'ordre : la plus spécifique
// gagne. « RC véhicule » doit sortir en Flotte et non en Responsabilité, d'où le test des
// véhicules avant celui de la RC.
const ECA_TYPES_ENTREPRISE = [
  { id: 'personnel', label: 'Mon personnel', icone: '👥',
    aide: 'Accidents, perte de gain, prévoyance professionnelle — ce qui couvre vos collaborateurs.',
    mots: /\blaa\b|laac|laaf|perte de gain|indemnit[ée]s? journali|apg|lpp|2e pilier|2ᵉ pilier|pr[ée]voyance profession|maladie collective|accident collective|assurance maladie collective/i },
  { id: 'vehicules', label: 'Véhicules et flotte', icone: '🚚',
    aide: 'Les véhicules de l’entreprise, à la plaque ou en flotte.',
    mots: /flotte|v[ée]hicule|rc\s*v[ée]h|casco|camion|utilitaire|remorque/i },
  // Volontairement resserré. Un premier jeu testait « professionnelle » et « exploitation » :
  // « Protection juridique professionnelle » tombait alors en Responsabilité, et « Perte
  // d'exploitation » aussi — deux contrats rangés dans la mauvaise famille sous les yeux du
  // client. On s'appuie sur « RC » et sur les termes qui ne désignent QUE la responsabilité.
  { id: 'responsabilite', label: 'Responsabilité', icone: '🛡️',
    aide: 'Ce que vous devez si un tiers subit un dommage de votre fait.',
    mots: /\brc\b|responsabilit[ée] civile|d&o|administrateurs et dirigeants/i },
  { id: 'biens', label: 'Biens et exploitation', icone: '🏭',
    aide: 'Locaux, matériel, marchandises, et la poursuite de l’activité après un sinistre.',
    mots: /chose|inventaire|b[âa]timent|immeuble|locaux|perte d.exploitation|bris de machine|technique|transport|marchandise|vol et vandalisme/i },
  { id: 'cyber', label: 'Cyber-risques', icone: '🌐',
    aide: 'Attaques informatiques, fuite de données, interruption de service.',
    mots: /cyber|informatique|donn[ée]es/i },
  { id: 'juridique', label: 'Protection juridique', icone: '⚖️',
    aide: 'La prise en charge de vos frais de défense et de procédure.',
    mots: /juridique/i },
  { id: 'caution', label: 'Cautions et garanties', icone: '🔑',
    aide: 'Garanties de loyer commercial et cautionnements.',
    mots: /caution|garantie de loyer/i },
  { id: 'autre', label: 'Autres contrats', icone: '📁', aide: '', mots: null },
];

function ecaEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ecaCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }

function ecaEstEntreprise() {
  const c = (window._ec || {}).client;
  return !!(typeof estEntreprise === 'function' && c && estEntreprise(c));
}

function ecaTypes() {
  if (ecaEstEntreprise()) return ECA_TYPES_ENTREPRISE;
  return (typeof EC_TYPES !== 'undefined') ? EC_TYPES : ECA_TYPES_ENTREPRISE;
}

// La catégorie d'un contrat, dans le jeu qui correspond au segment du client. On relit le texte
// du contrat plutôt que d'appeler ecTypeContrat() : celui-ci ne connaît que les familles
// « particulier » et renverrait « entreprise » pour les vingt-deux contrats d'une société.
function ecaCategorie(ct) {
  const texte = `${ct.categorie || ''} ${ct.produit || ''} ${ct.modules || ''}`;
  const types = ecaTypes();
  return (types.find(t => t.mots && t.mots.test(texte)) || types[types.length - 1]).id;
}

// ── L'arbre ─────────────────────────────────────────────────────────────────────────────────────
function ecaOngletContrats() {
  const actifs = typeof ecContratsActifs === 'function' ? ecContratsActifs() : [];
  const primes = typeof ecpWidgetPrimes === 'function' ? ecpWidgetPrimes() : '';

  if (!actifs.length) {
    return primes + `<section class="dbx-carte" style="margin-top:18px">
      <div class="dbx-vide-petit">Aucun contrat en vigueur pour l’instant. Dès qu’une police nous
        parvient, elle apparaît ici.</div></section>`;
  }

  const types = ecaTypes();
  const parCat = new Map();
  for (const ct of actifs) {
    const id = ecaCategorie(ct);
    if (!parCat.has(id)) parCat.set(id, []);
    parCat.get(id).push(ct);
  }
  const total = actifs.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
  const branches = types.filter(t => (parCat.get(t.id) || []).length);

  return primes + `
  <section class="dbx-carte eca-carte">
    <header class="dbx-carte-tete">
      <div><h2>Mes contrats</h2>
        <span class="dbx-carte-sous">${actifs.length} contrat${actifs.length > 1 ? 's' : ''} en vigueur,
          répartis en ${branches.length} ${branches.length > 1 ? 'domaines' : 'domaine'}${total ? ` · CHF ${ecaCHF(total)} de primes par an` : ''}</span></div>
      <div class="eca-outils">
        <button type="button" class="eca-act" onclick="ecaTout(true)">Tout ouvrir</button>
        <button type="button" class="eca-act" onclick="ecaTout(false)">Tout fermer</button>
      </div>
    </header>

    <div class="eca-apercu">${branches.map(t => {
      const l = parCat.get(t.id);
      const p = l.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
      return `<button type="button" class="eca-puce" onclick="ecaAller('${t.id}')"
          title="${ecaEsc(t.aide || t.label)}">
        <span aria-hidden="true">${t.icone}</span>
        <b>${l.length}</b>
        <small>${ecaEsc(t.label)}</small>
        ${p ? `<i>CHF ${ecaCHF(p)}</i>` : ''}
      </button>`;
    }).join('')}</div>

    <div class="eca-arbre">${branches.map((t, i) => {
      const l = parCat.get(t.id);
      const p = l.reduce((s, ct) => s + Number(ct.prime_annuelle || 0), 0);
      // La première branche est ouverte : arriver sur un écran entièrement replié donne
      // l'impression qu'il est vide, et oblige à un clic pour comprendre ce qu'on regarde.
      return `<details class="eca-branche" id="eca-${t.id}" ${i === 0 ? 'open' : ''}>
        <summary>
          <span class="eca-icone" aria-hidden="true">${t.icone}</span>
          <span class="eca-titre">
            <b>${ecaEsc(t.label)}</b>
            ${t.aide ? `<small>${ecaEsc(t.aide)}</small>` : ''}
          </span>
          <span class="eca-compte">${l.length}</span>
          ${p ? `<span class="eca-prime">CHF ${ecaCHF(p)}<small>/an</small></span>` : ''}
        </summary>
        <div class="eca-corps">${l.map(ct => ecaContratHtml(ct)).join('')}</div>
      </details>`;
    }).join('')}</div>
  </section>`;
}

function ecaTout(ouvert) {
  document.querySelectorAll('.eca-arbre .eca-branche').forEach(d => { d.open = ouvert; });
}

function ecaAller(id) {
  const d = document.getElementById('eca-' + id);
  if (!d) return;
  d.open = true;
  d.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// La feuille : un contrat. On garde exactement les actions de l'ancien onglet — télécharger la
// police, écrire, déclarer un sinistre, demander un document. Réorganiser une page ne doit jamais
// faire disparaître ce qu'on pouvait y faire.
function ecaContratHtml(ct) {
  const auj = new Date().toISOString().slice(0, 10);
  const dans120 = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  const limite = typeof ecDateLimiteResiliation === 'function' ? ecDateLimiteResiliation(ct) : null;
  const bientot = limite && limite >= auj && limite <= dans120;

  return `<article class="ec-contrat eca-feuille">
    <span class="ec-logo">${typeof pictoCompagnie === 'function' ? pictoCompagnie(ct.compagnie, 34) : ''}</span>
    <div class="ec-corps">
      <b>${ecaEsc(ct.produit || 'Contrat')}</b>
      <small>${ecaEsc(ct.compagnie || '')}${ct.numero_police ? ` · police ${ecaEsc(ct.numero_police)}` : ''}</small>
      ${ct.modules ? `<small class="ec-modules">${ecaEsc(ct.modules)}</small>` : ''}
    </div>
    <div class="ec-dates">
      ${ct.date_debut ? `<span>Depuis le ${fmtDate(ct.date_debut)}</span>` : ''}
      ${ct.date_echeance ? `<span>Échéance ${fmtDate(ct.date_echeance)}</span>` : '<span>Sans échéance</span>'}
      ${limite ? `<span class="${bientot ? 'ec-alerte' : ''}">Résiliation jusqu’au ${fmtDate(limite)}</span>` : ''}
    </div>
    <div class="ec-prime">${ct.prime_annuelle ? `CHF ${ecaCHF(ct.prime_annuelle)}<small>/an</small>` : '—'}</div>
    <div class="ec-actions-contrat">
      ${typeof ecPoliceDisponible === 'function' && ecPoliceDisponible(ct.id)
        ? `<button type="button" class="ec-doc-dispo" onclick="ecTelechargerPolice('${ct.id}', this)">⬇️ Ma police</button>` : ''}
      <button type="button" onclick="ecOuvrirMessage('${ct.id}')">💬 Contacter mon conseiller</button>
      <button type="button" onclick="ecOuvrirSinistre('${ct.id}')">🛟 Déclarer un sinistre</button>
      <button type="button" onclick="ecOuvrirDemandeDocument('${ct.id}')">📄 Demander un document</button>
    </div>
  </article>`;
}

// On remplace l'onglet plutôt que de l'envelopper : js/79 y ajoutait le widget des primes maladie
// en tête, et ce widget est repris ici explicitement (il rend une chaîne vide pour une
// entreprise, qui n'a pas de LAMal).
(function ecaBrancher() {
  if (typeof ecOngletContrats === 'function') window.ecOngletContrats = ecaOngletContrats;
})();
