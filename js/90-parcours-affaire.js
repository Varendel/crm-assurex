// ═══ LE PARCOURS D'UNE AFFAIRE (20.09.2026) ════════════════════════════════════════════════════
// « Produit envisagé est un vestige. Revois le processus de création et développement d'opp dans
// un processus complet et logique […] tant qu'un retour en arrière est facilement opérable. »
//
// RETOUR EN ARRIÈRE : tout est ici et dans css/99-parcours.css. Retirer les deux lignes
// correspondantes d'index.html rend l'ancienne fiche, intacte. Aucun stade n'a été renommé,
// aucune donnée migrée : les six stades (Contact → Analyse → Proposition → Négociation → Gagné /
// Perdu) restent ceux de la base, et le kanban, le pipeline et les statistiques continuent de
// lire exactement ce qu'ils lisaient.
//
// CE QUI NE MARCHAIT PAS.
//
// 1. « PRODUITS ENVISAGÉS » — le vestige. Cinquante cases à cocher sur deux colonnes, chacune
//    ouvrant une case de prime, pour décrire ce qu'on VA peut-être vendre. Le libellé l'avouait
//    lui-même : « le produit exact se précisera au contrat ». On demandait donc un travail de
//    saisie détaillé pour une information provisoire, au moment où l'on en sait le moins.
//    Ce qu'il faut savoir à ce stade tient en trois chiffres : quelle couverture, quel volume de
//    prime, à quelle échéance. Le détail appartient à l'offre, puis au contrat.
//
// 2. LA SITUATION DU CLIENT N'EXISTAIT NULLE PART. Une affaire de courtage est presque toujours
//    un transfert : le client a déjà quelque chose, ailleurs. Sans savoir chez qui, à quel prix
//    et jusqu'à quand, on ne peut ni comparer honnêtement, ni résilier à temps.
//
// 3. AUCUNE RÉSILIATION. Entre « le client signe » et « la police arrive », il y a un acte qui
//    n'était nulle part : résilier l'ancien contrat, dans les délais. Une résiliation partie trop
//    tard donne un client assuré deux fois, qui paie deux primes — et qui s'en aperçoit.
//
// 4. LE PASSAGE AU CONTRAT N'EXISTAIT QUE PAR UNE PORTE DÉROBÉE. « Signée → contrat » n'apparaît
//    que sur une offre reçue dans une demande d'offre. Sans demande d'offre formelle, aucun
//    chemin. Résultat mesuré : sur 8 affaires gagnées, 3 portent un contrat.
//
// CE QUI REMPLACE. Le même stade en base, mais présenté comme un PARCOURS à six étapes dont
// chacune affiche ce qu'il reste à faire pour passer à la suivante. Une étape qui ne dit pas
// quelle est l'action suivante est une étiquette, pas une étape.

const PAF_ETAPES = [
  { stade: 'Contact', nom: 'Prise de contact', icone: '👋',
    but: 'Savoir qui, pour quoi, et pour quand.',
    requis: ['client', 'titre'] },
  { stade: 'Analyse', nom: 'Analyse du besoin', icone: '🔍',
    but: 'Connaître la situation actuelle : chez qui, à quel prix, jusqu’à quand.',
    requis: ['type', 'volume'] },
  { stade: 'Proposition', nom: 'Consultation du marché', icone: '📨',
    but: 'Demander les offres aux compagnies et les recevoir.',
    requis: ['offres'] },
  { stade: 'Négociation', nom: 'Présentation au client', icone: '🤝',
    but: 'Comparer, recommander, obtenir la décision.',
    requis: ['decision'] },
  { stade: 'Gagné', nom: 'Conclusion', icone: '✍️',
    but: 'Proposition signée, ancien contrat résilié, police déposée.',
    requis: ['resiliation', 'contrat'] },
];

const PAF_TYPES = {
  nouvelle: { nom: 'Nouvelle couverture', aide: 'Le client n’avait rien sur ce risque.' },
  transfert: { nom: 'Transfert', aide: 'Il quitte un assureur : une résiliation sera due.' },
  complement: { nom: 'Complément', aide: 'Il garde l’existant et ajoute une couverture.' },
};

function pafEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pafCHF(n) { return Math.round(Number(n) || 0).toLocaleString('fr-CH'); }
function pafJours(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso + 'T23:59:59') - new Date()) / 86400000);
}

function pafOpp(id) { return (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(o => o.id === id); }

// ── Ce qu'il manque, étape par étape ────────────────────────────────────────────────────────────
// Le cœur du module. Pour chaque exigence, on regarde la donnée réelle : pas de case à cocher
// décorative, pas d'état déclaratif. Une étape est franchie quand ce qu'elle exige EXISTE.
function pafManques(o) {
  const m = {};
  m.client = !o.client_id && !o.prospect_nom ? 'Aucun client ni prospect nommé' : null;
  m.titre = !o.titre ? 'Pas d’intitulé' : null;
  m.type = !o.type_affaire ? 'Nature de l’affaire non précisée' : null;
  m.volume = !Number(o.montant_potentiel || 0) ? 'Volume de prime non estimé' : null;

  const demandes = (window._opDemandes && window._opDemandes[o.id]) || null;
  // null = pas encore chargé ; on ne réclame rien tant qu'on ne sait pas.
  m.offres = demandes === null ? null
    : !demandes.length ? 'Aucune demande d’offre envoyée'
    : !demandes.some(d => (d.compagnies_envoi || []).some(e => e.prime || e.recue_le)) ? 'Aucune offre reçue'
    : null;

  m.decision = !o.signee_le ? 'Date de signature non renseignée' : null;
  m.resiliation = (o.resiliation_requise && !o.resiliation_envoyee_le) ? 'Résiliation de l’ancien contrat à envoyer' : null;
  m.contrat = !o.contrat_id ? 'Contrat non créé dans le portefeuille' : null;
  return m;
}

function pafEtapeCourante(o) {
  const i = PAF_ETAPES.findIndex(e => e.stade === o.stade);
  return i < 0 ? 0 : i;
}

// ── Ce qu'il reste à faire pour avancer ─────────────────────────────────────────────────────────
// La fiche affichait déjà les six stades en rail. Ce qu'elle ne disait jamais, c'est POURQUOI on
// est encore à ce stade et ce qui débloque le suivant. Une barre d'étapes sans cela est une
// étiquette : elle nomme la situation sans aider à en sortir.
function pafBandeau(o) {
  if (o.stade === 'Perdu') return pafPerdue(o);
  const courante = pafEtapeCourante(o);
  return pafActionSuivante(o, courante, pafManques(o));
}

// L'action suivante. C'est ce qui manquait le plus : on savait où on en était, jamais quoi faire.
function pafActionSuivante(o, courante, manques) {
  const e = PAF_ETAPES[courante];
  const reste = e.requis.map(r => ({ cle: r, texte: manques[r] })).filter(x => x.texte);

  if (!reste.length) {
    const suivante = PAF_ETAPES[courante + 1];
    if (!suivante) {
      return `<div class="paf-suite ok">
        <b>✓ Affaire complète</b>
        <small>Signée, résiliée si besoin, et présente au portefeuille. Il n’y a plus rien à faire ici.</small>
      </div>`;
    }
    return `<div class="paf-suite ok">
      <b>✓ ${pafEsc(e.nom)} : rien ne manque</b>
      <small>${pafEsc(suivante.but)}</small>
      <button type="button" class="btn-save" onclick="pafAllerEtape('${o.id}','${suivante.stade}')">
        Passer à « ${pafEsc(suivante.nom)} » →</button>
    </div>`;
  }

  return `<div class="paf-suite">
    <b>Pour passer à l’étape suivante</b>
    <ul class="paf-manques">${reste.map(x => `<li>
      <span>${pafEsc(x.texte)}</span>
      ${pafBoutonPour(o, x.cle)}
    </li>`).join('')}</ul>
  </div>`;
}

// À chaque manque, le geste qui le comble — et pas un lien vers un écran où le chercher.
function pafBoutonPour(o, cle) {
  const b = (txt, action) => `<button type="button" class="paf-act" onclick="${action}">${txt}</button>`;
  switch (cle) {
    case 'client': return b('Rattacher un client', `pafFocus('o-client-recherche')`);
    case 'titre': return b('Donner un intitulé', `pafFocus('o-titre')`);
    case 'type': return b('Préciser', `pafOuvrirSituation('${o.id}')`);
    case 'volume': return b('Estimer', `pafOuvrirSituation('${o.id}')`);
    case 'offres': return typeof ouvrirDemandeOffre === 'function'
      ? b('Demander des offres', `ouvrirDemandeOffre('${o.id}')`) : '';
    case 'decision': return b('Marquer la signature', `pafOuvrirSignature('${o.id}')`);
    case 'resiliation': return b('Préparer la résiliation', `pafOuvrirResiliation('${o.id}')`);
    case 'contrat': return b('Créer le contrat', `pafVersContrat('${o.id}')`);
    default: return '';
  }
}

function pafPerdue(o) {
  return `<section class="paf-bloc paf-perdue">
    <b>✕ Affaire perdue</b>
    ${o.motif_perte ? `<p>${pafEsc(o.motif_perte)}</p>` : '<p>Aucun motif enregistré — il servirait la prochaine fois.</p>'}
    <button type="button" class="paf-act" onclick="pafAllerEtape('${o.id}','Négociation')">Rouvrir l’affaire</button>
  </section>`;
}

function pafFocus(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => el.focus(), 320);
}

async function pafAllerEtape(oppId, stade) {
  if (typeof changerStadeOpportuniteRapide === 'function') await changerStadeOpportuniteRapide(oppId, stade);
}

// ── La situation actuelle du client ─────────────────────────────────────────────────────────────
// Remplace « produits envisagés ». Trois chiffres au lieu de cinquante cases : ce qu'il a
// aujourd'hui, ce qu'on vise, et quand la porte se ferme.
function pafOuvrirSituation(oppId) {
  const o = pafOpp(oppId);
  if (!o || typeof creerModale !== 'function') return;
  const v = x => (x == null ? '' : x);
  creerModale('modal-paf-situation', `
    <div class="paf-modale">
      <h3>La situation du client</h3>
      <p class="paf-sous">Ce qu’il a aujourd’hui, et ce que nous visons. C’est ce qui permet de
        comparer honnêtement — et de résilier à temps.</p>

      <label class="paf-label">Nature de l’affaire</label>
      <div class="paf-choix">${Object.entries(PAF_TYPES).map(([k, t]) => `
        <label class="paf-radio ${o.type_affaire === k ? 'actif' : ''}">
          <input type="radio" name="paf-type" value="${k}" ${o.type_affaire === k ? 'checked' : ''}
            onchange="pafMajTypeUI(this.value)"/>
          <b>${t.nom}</b><small>${t.aide}</small>
        </label>`).join('')}</div>

      <div id="paf-actuel" style="display:${o.type_affaire === 'transfert' ? '' : 'none'}">
        <label class="paf-label">Ce qu’il a aujourd’hui</label>
        <div class="paf-grille">
          <div><label for="paf-a-cie">Compagnie actuelle</label>
            <input class="form-input" id="paf-a-cie" value="${pafEsc(v(o.actuel_compagnie))}" placeholder="Ex. Helvetia"/></div>
          <div><label for="paf-a-prime">Prime actuelle (CHF/an)</label>
            <input class="form-input" id="paf-a-prime" inputmode="decimal" value="${v(o.actuel_prime)}"/></div>
          <div><label for="paf-a-police">N° de police</label>
            <input class="form-input" id="paf-a-police" value="${pafEsc(v(o.actuel_police))}"/></div>
          <div><label for="paf-a-ech">Échéance du contrat actuel</label>
            <input class="form-input" id="paf-a-ech" type="date" value="${v(o.actuel_echeance)}"/></div>
        </div>
        <p class="paf-note">L’échéance commande tout le calendrier : c’est elle qui fixe la date
          limite de résiliation, et donc la date à laquelle l’affaire doit être conclue.</p>
      </div>

      <label class="paf-label">Ce que nous visons</label>
      <div class="paf-grille">
        <div><label for="paf-volume">Prime annuelle visée (CHF)</label>
          <input class="form-input" id="paf-volume" inputmode="decimal" value="${v(o.montant_potentiel)}"/></div>
        <div><label for="paf-ech">Échéance de l’affaire</label>
          <input class="form-input" id="paf-ech" type="date" value="${v(o.date_echeance)}"/></div>
      </div>

      <div class="paf-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-paf-situation').remove()">Annuler</button>
        <button type="button" class="btn-save" onclick="pafEnregistrerSituation('${oppId}')">✓ Enregistrer</button>
      </div>
    </div>`, { opacite: .7, padding: '16px' });
}

function pafMajTypeUI(valeur) {
  const z = document.getElementById('paf-actuel');
  if (z) z.style.display = valeur === 'transfert' ? '' : 'none';
  document.querySelectorAll('.paf-radio').forEach(l => {
    l.classList.toggle('actif', l.querySelector('input').value === valeur);
  });
}

function pafNombre(id) {
  const v = (document.getElementById(id)?.value || '').replace(/['’\s]/g, '').replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

async function pafEnregistrerSituation(oppId) {
  const o = pafOpp(oppId);
  if (!o) return;
  const txt = id => (document.getElementById(id)?.value || '').trim() || null;
  const type = document.querySelector('input[name="paf-type"]:checked')?.value || null;

  const maj = {
    type_affaire: type,
    montant_potentiel: pafNombre('paf-volume'),
    date_echeance: txt('paf-ech'),
    actuel_compagnie: type === 'transfert' ? txt('paf-a-cie') : null,
    actuel_prime: type === 'transfert' ? pafNombre('paf-a-prime') : null,
    actuel_police: type === 'transfert' ? txt('paf-a-police') : null,
    actuel_echeance: type === 'transfert' ? txt('paf-a-ech') : null,
    // Un transfert suppose une résiliation. On la pose comme due sans attendre la signature :
    // c'est la date limite qui compte, et elle se calcule dès maintenant.
    resiliation_requise: type === 'transfert',
  };
  if (maj.resiliation_requise && maj.actuel_echeance) {
    maj.resiliation_limite = pafLimiteResiliation(maj.actuel_echeance);
  }

  const r = await dbPatch('opportunites', oppId, maj);
  if (r && r.error) { showError('Enregistrement impossible : ' + errMsg(r)); return; }
  Object.assign(o, maj);
  document.getElementById('modal-paf-situation')?.remove();
  showError('✓ Situation enregistrée');
  pafRafraichir();
}

// Trois mois avant l'échéance : c'est le délai ordinaire des contrats choses et RC en Suisse.
// C'est une aide à la saisie, pas une règle : les conditions générales de chaque contrat font foi,
// et certaines branches (LAMal, maladie) ont leur propre calendrier. La date reste modifiable.
function pafLimiteResiliation(echeance) {
  const d = new Date(echeance + 'T00:00:00');
  d.setMonth(d.getMonth() - 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── La résiliation ──────────────────────────────────────────────────────────────────────────────
function pafOuvrirResiliation(oppId) {
  const o = pafOpp(oppId);
  if (!o || typeof creerModale !== 'function') return;
  const limite = o.resiliation_limite || (o.actuel_echeance ? pafLimiteResiliation(o.actuel_echeance) : '');
  const j = pafJours(limite);
  const urgence = j == null ? '' : j < 0 ? 'depasse' : j <= 21 ? 'urgent' : j <= 60 ? 'proche' : '';

  creerModale('modal-paf-resiliation', `
    <div class="paf-modale">
      <h3>Résilier le contrat actuel</h3>
      <p class="paf-sous">${o.actuel_compagnie
        ? `Chez <b>${pafEsc(o.actuel_compagnie)}</b>${o.actuel_police ? `, police ${pafEsc(o.actuel_police)}` : ''}.`
        : 'La compagnie actuelle n’est pas renseignée — complétez d’abord la situation du client.'}</p>

      ${limite ? `<div class="paf-compteur ${urgence}">
        <b>${j < 0 ? `Délai dépassé de ${-j} jour${-j > 1 ? 's' : ''}` : `${j} jour${j > 1 ? 's' : ''}`}</b>
        <small>La résiliation doit être <b>parvenue</b> à l’assureur le ${fmtDate(limite)} au plus tard.
          C’est la réception qui fait foi, pas l’envoi : comptez le courrier.</small>
      </div>` : ''}

      <div class="paf-grille">
        <div><label for="paf-r-limite">Date limite de réception</label>
          <input class="form-input" id="paf-r-limite" type="date" value="${limite || ''}"/></div>
        <div><label for="paf-r-envoi">Envoyée le</label>
          <input class="form-input" id="paf-r-envoi" type="date" value="${o.resiliation_envoyee_le || ''}"/></div>
        <div><label for="paf-r-conf">Confirmée par l’assureur le</label>
          <input class="form-input" id="paf-r-conf" type="date" value="${o.resiliation_confirmee_le || ''}"/></div>
      </div>
      <p class="paf-note">Tant que la confirmation n’est pas revenue, l’affaire n’est pas close :
        un client qui croit avoir résilié et dont la lettre s’est perdue paie deux primes l’année
        suivante, et l’apprend par son relevé.</p>

      <div class="paf-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-paf-resiliation').remove()">Fermer</button>
        <button type="button" class="btn-secondary" onclick="pafCopierLettre('${oppId}')">📋 Copier le texte de la lettre</button>
        <button type="button" class="btn-save" onclick="pafEnregistrerResiliation('${oppId}')">✓ Enregistrer</button>
      </div>
    </div>`, { opacite: .7, padding: '16px' });
}

async function pafEnregistrerResiliation(oppId) {
  const o = pafOpp(oppId);
  if (!o) return;
  const txt = id => (document.getElementById(id)?.value || '').trim() || null;
  const maj = {
    resiliation_requise: true,
    resiliation_limite: txt('paf-r-limite'),
    resiliation_envoyee_le: txt('paf-r-envoi'),
    resiliation_confirmee_le: txt('paf-r-conf'),
  };
  const r = await dbPatch('opportunites', oppId, maj);
  if (r && r.error) { showError('Enregistrement impossible : ' + errMsg(r)); return; }
  Object.assign(o, maj);
  if (maj.resiliation_envoyee_le && typeof ajouterLigneHistoriqueOpportunite === 'function') {
    await ajouterLigneHistoriqueOpportunite(oppId,
      `✉️ Résiliation envoyée à ${o.actuel_compagnie || 'l’assureur actuel'} le ${fmtDate(maj.resiliation_envoyee_le)}`);
  }
  document.getElementById('modal-paf-resiliation')?.remove();
  showError('✓ Résiliation enregistrée');
  pafRafraichir();
}

// Le texte de la lettre, dans le presse-papiers. Pas d'envoi automatique : une résiliation part
// sous la signature du client, pas sous celle du courtier, et une lettre envoyée par erreur ne se
// rattrape pas.
function pafCopierLettre(oppId) {
  const o = pafOpp(oppId);
  if (!o) return;
  const cl = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === o.client_id);
  const nom = cl ? ((typeof estEntreprise === 'function' && estEntreprise(cl)) ? cl.nom : `${cl.prenom || ''} ${cl.nom || ''}`.trim()) : (o.prospect_nom || '');
  const lettre = [
    `${nom}`,
    cl && cl.adresse ? cl.adresse : '',
    cl && (cl.npa || cl.ville) ? `${cl.npa || ''} ${cl.ville || ''}`.trim() : '',
    '',
    o.actuel_compagnie || '[Compagnie]',
    '',
    `${cl && cl.ville ? cl.ville + ', ' : ''}le ${fmtDate(new Date().toISOString().slice(0, 10))}`,
    '',
    `Objet : résiliation de la police n° ${o.actuel_police || '[numéro]'}`,
    '',
    'Madame, Monsieur,',
    '',
    `Par la présente, je résilie la police citée en objet pour son échéance du ${o.actuel_echeance ? fmtDate(o.actuel_echeance) : '[échéance]'}, dans le respect du délai contractuel.`,
    '',
    'Je vous remercie de me confirmer par écrit la prise en compte de cette résiliation ainsi que la date effective de fin de couverture.',
    '',
    'Veuillez agréer, Madame, Monsieur, mes salutations distinguées.',
    '',
    '',
    nom,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

  const fini = ok => showError(ok ? '✓ Lettre copiée — à relire et à faire signer par le client'
    : 'Copie impossible — sélectionnez le texte à la main.');
  navigator.clipboard.writeText(lettre).then(() => fini(true)).catch(() => {
    try {
      const z = document.createElement('textarea');
      z.value = lettre; z.style.cssText = 'position:fixed;top:-9999px';
      document.body.appendChild(z); z.select();
      fini(document.execCommand('copy'));
      z.remove();
    } catch (e) { fini(false); }
  });
}

// ── La signature ────────────────────────────────────────────────────────────────────────────────
function pafOuvrirSignature(oppId) {
  const o = pafOpp(oppId);
  if (!o || typeof creerModale !== 'function') return;
  const auj = new Date().toISOString().slice(0, 10);
  creerModale('modal-paf-signature', `
    <div class="paf-modale">
      <h3>La proposition est signée</h3>
      <p class="paf-sous">L’affaire passe en <b>Gagné</b>. Elle ne sera close que lorsque le contrat
        sera au portefeuille${o.resiliation_requise ? ' et l’ancien résilié' : ''}.</p>
      <div class="paf-grille">
        <div><label for="paf-s-date">Signée le</label>
          <input class="form-input" id="paf-s-date" type="date" value="${o.signee_le || auj}"/></div>
        <div><label for="paf-s-prime">Prime retenue (CHF/an)</label>
          <input class="form-input" id="paf-s-prime" inputmode="decimal" value="${o.montant_potentiel ?? ''}"/></div>
      </div>
      <div class="paf-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-paf-signature').remove()">Annuler</button>
        <button type="button" class="btn-save" onclick="pafEnregistrerSignature('${oppId}')">✓ Enregistrer</button>
      </div>
    </div>`, { opacite: .7, padding: '16px' });
}

async function pafEnregistrerSignature(oppId) {
  const o = pafOpp(oppId);
  if (!o) return;
  const date = (document.getElementById('paf-s-date')?.value || '').trim() || null;
  const prime = pafNombre('paf-s-prime');
  const maj = { signee_le: date, stade: 'Gagné' };
  if (prime != null) maj.montant_potentiel = prime;
  const r = await dbPatch('opportunites', oppId, maj);
  if (r && r.error) { showError('Enregistrement impossible : ' + errMsg(r)); return; }
  Object.assign(o, maj);
  if (typeof ajouterLigneHistoriqueOpportunite === 'function') {
    await ajouterLigneHistoriqueOpportunite(oppId, `✍️ Proposition signée le ${fmtDate(date)}`);
  }
  document.getElementById('modal-paf-signature')?.remove();
  showError('✓ Affaire gagnée — reste à la porter au portefeuille');
  pafRafraichir();
}

// ── Vers le contrat ─────────────────────────────────────────────────────────────────────────────
// Le chemin qui manquait. js/46 sait le faire depuis une OFFRE reçue ; on s'appuie dessus quand
// il y en a une, et sinon on ouvre le formulaire de contrat pré-rempli depuis l'affaire.
function pafVersContrat(oppId) {
  const o = pafOpp(oppId);
  if (!o) return;

  const demandes = (window._opDemandes && window._opDemandes[oppId]) || [];
  for (const d of demandes) {
    const i = (d.compagnies_envoi || []).findIndex(e => (e.prime || e.recue_le) && e.statut !== 'déclinée');
    if (i >= 0 && typeof opSigneeVersContrat === 'function') {
      opSigneeVersContrat(oppId, d.id, i);
      return;
    }
  }

  // Pas d'offre formelle : on part de l'affaire elle-même.
  if (typeof prefillOpportunite !== 'undefined') {
    try { prefillOpportunite = o; } catch (e) { /* variable absente : le formulaire s'ouvrira vide */ }
  }
  if (typeof showFormContrat === 'function') { showFormContrat(o.client_id, null, o); return; }
  if (typeof navigate === 'function') {
    showError('Créez le contrat depuis la fiche client — l’affaire y est rattachée.');
    if (o.client_id && typeof showClient === 'function') showClient(o.client_id);
  }
}

// ── Le résumé remplaçant « produits envisagés » ─────────────────────────────────────────────────
function pafResume(o) {
  const gain = (o.actuel_prime && o.montant_potentiel)
    ? Number(o.actuel_prime) - Number(o.montant_potentiel) : null;
  const jL = pafJours(o.resiliation_limite);

  const cartes = [
    { l: 'Nature', v: o.type_affaire ? PAF_TYPES[o.type_affaire].nom : '—',
      s: o.type_affaire ? PAF_TYPES[o.type_affaire].aide : 'à préciser' },
    { l: 'Prime visée', v: o.montant_potentiel ? 'CHF ' + pafCHF(o.montant_potentiel) : '—',
      s: o.commission_estimee ? `commission estimée CHF ${pafCHF(o.commission_estimee)}` : 'par an' },
  ];
  if (o.type_affaire === 'transfert') {
    cartes.push({ l: 'Prime actuelle', v: o.actuel_prime ? 'CHF ' + pafCHF(o.actuel_prime) : '—',
      s: o.actuel_compagnie || 'compagnie à renseigner' });
    // L'économie est l'argument de vente : elle mérite d'être calculée, pas laissée à la tête du
    // client. Une économie négative est une information aussi — on la montre telle quelle.
    if (gain != null) {
      cartes.push({ l: gain >= 0 ? 'Économie annuelle' : 'Surcoût annuel',
        v: 'CHF ' + pafCHF(Math.abs(gain)), s: gain >= 0 ? 'pour le client' : 'à justifier par les garanties',
        ton: gain >= 0 ? 'ok' : 'alerte' });
    }
  }
  if (o.resiliation_requise) {
    cartes.push({
      l: 'Résiliation',
      v: o.resiliation_confirmee_le ? 'Confirmée' : o.resiliation_envoyee_le ? 'Envoyée' : jL != null ? `${jL} j` : 'À faire',
      s: o.resiliation_confirmee_le ? fmtDate(o.resiliation_confirmee_le)
        : o.resiliation_envoyee_le ? `le ${fmtDate(o.resiliation_envoyee_le)} — confirmation attendue`
        : o.resiliation_limite ? `avant le ${fmtDate(o.resiliation_limite)}` : 'échéance actuelle inconnue',
      ton: o.resiliation_confirmee_le ? 'ok' : (jL != null && jL <= 21) ? 'alerte' : '',
    });
  }

  return `<section class="paf-bloc">
    <header class="paf-tete">
      <h3>L’affaire en bref</h3>
      <div class="paf-tete-actions">
        <button type="button" class="paf-act" onclick="pafOuvrirSituation('${o.id}')">Situation du client</button>
        ${o.resiliation_requise ? `<button type="button" class="paf-act" onclick="pafOuvrirResiliation('${o.id}')">Résiliation</button>` : ''}
        ${o.stade !== 'Gagné' ? `<button type="button" class="paf-act" onclick="pafOuvrirSignature('${o.id}')">Marquer signée</button>` : ''}
        ${o.stade === 'Gagné' && !o.contrat_id ? `<button type="button" class="paf-act paf-act-fort" onclick="pafVersContrat('${o.id}')">Créer le contrat</button>` : ''}
      </div>
    </header>
    <div class="paf-cartes">${cartes.map(c => `
      <div class="paf-carte ${c.ton || ''}">
        <span class="paf-carte-l">${c.l}</span>
        <b>${c.v}</b>
        <small>${pafEsc(c.s)}</small>
      </div>`).join('')}</div>

    ${pafCouverturesHtml(o)}
  </section>`;
}

// ── Les couvertures visées ──────────────────────────────────────────────────────────────────────
// Jonathan : « est-ce que ça ferait pas sens quand même de laisser les produits à sélectionner ? »
// Oui, et j'avais jeté trop large. Ce qui était le vestige, ce n'était PAS de dire quelles
// couvertures on vise — c'est l'objet même de l'affaire, et c'est ce qui détermine à quelles
// compagnies on demande des offres. Le vestige, c'étaient les cinquante lignes à plat, chacune
// avec sa case de prime à remplir : le DÉTAIL, pas la sélection.
//
// On garde donc la sélection — même colonne `produits`, mêmes identifiants, les vingt affaires
// qui en portent déjà s'affichent sans rien changer — mais présentée par famille, et sans saisie
// de prime ligne à ligne. Le volume total est déjà au-dessus ; le répartir produit par produit
// avant d'avoir une offre, c'est inventer des chiffres.
function pafCouverturesHtml(o) {
  const choisis = Array.isArray(o.produits) ? o.produits : [];
  const label = id => {
    for (const l of Object.values(typeof PRODUITS_OPPORTUNITE_GROUPES !== 'undefined' ? PRODUITS_OPPORTUNITE_GROUPES : {})) {
      const p = l.find(x => x.id === id);
      if (p) return p.label;
    }
    return id;
  };
  return `<div class="paf-couvertures">
    <div class="paf-couv-tete">
      <span class="paf-carte-l">Couvertures visées</span>
      <button type="button" class="paf-act" onclick="pafOuvrirCouvertures('${o.id}')">
        ${choisis.length ? 'Modifier' : 'Choisir'}</button>
    </div>
    ${choisis.length
      ? `<div class="paf-puces">${choisis.map(id => `<span class="paf-puce">${pafEsc(label(id))}</span>`).join('')}</div>`
      : `<p class="paf-note">Aucune couverture indiquée. C’est elle qui dit à quelles compagnies
          demander une offre — et ce que le client attend de nous.</p>`}
  </div>`;
}

// Ce qui ne concerne pas ce client-là n'a pas à s'afficher. Un particulier n'a ni LAA, ni LPP
// collective, ni RC entreprise — lui présenter ces lignes, c'est lui faire lire vingt-huit choix
// pour en trouver six. Le filtre se fait sur le SEGMENT du client, et il est levé d'un clic :
// un indépendant assure parfois son activité sur sa fiche privée, et une case masquée qu'on ne
// peut pas retrouver est pire qu'une case en trop.
const PAF_RESERVE_ENTREPRISE = /entreprise|collective|\blaa\b|\blpp\b|commercial|professionnel|flotte|exploitation|d&o|perte de gain/i;

function pafPourSegment(cat, produit, entreprise) {
  if (entreprise) return true;                         // une société peut tout avoir, y compris du privé
  return !PAF_RESERVE_ENTREPRISE.test(`${cat} ${produit.label}`);
}

function pafOuvrirCouvertures(oppId, toutVoir) {
  const o = pafOpp(oppId);
  if (!o || typeof creerModale !== 'function') return;
  const groupes = typeof PRODUITS_OPPORTUNITE_GROUPES !== 'undefined' ? PRODUITS_OPPORTUNITE_GROUPES : {};
  const choisis = new Set(Array.isArray(o.produits) ? o.produits : []);
  const cl = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === o.client_id);
  // Sans fiche client rattachée, on ne sait pas : on montre tout plutôt que de masquer à tort.
  const entreprise = !cl || !!(typeof estEntreprise === 'function' && estEntreprise(cl));
  const filtre = !toutVoir && !entreprise;

  creerModale('modal-paf-couv', `
    <div class="paf-modale">
      <h3>Quelles couvertures visons-nous ?</h3>
      <p class="paf-sous">Plusieurs possibles. Le produit exact, ses modules et sa prime
        définitive se fixeront au contrat, quand la police sera émise — ici on dit seulement de
        quoi il s’agit.</p>
      <div class="paf-familles">${Object.entries(groupes).map(([cat, produits]) => {
        // Une case déjà cochée reste visible même si le filtre l'exclurait : on ne cache jamais
        // une décision prise, sous peine de la faire disparaître au prochain enregistrement.
        const visibles = produits.filter(p => choisis.has(p.id) || !filtre || pafPourSegment(cat, p, false));
        const masques = produits.length - visibles.length;
        if (!visibles.length) return '';
        return `<fieldset class="paf-famille">
          <legend>${typeof ICONES_CATEGORIE_PRODUIT !== 'undefined' && ICONES_CATEGORIE_PRODUIT[cat] ? ICONES_CATEGORIE_PRODUIT[cat] : '📌'} ${pafEsc(cat)}</legend>
          ${visibles.map(p => `
            <label class="paf-coche ${choisis.has(p.id) ? 'actif' : ''}">
              <input type="checkbox" value="${p.id}" ${choisis.has(p.id) ? 'checked' : ''}
                onchange="this.closest('label').classList.toggle('actif', this.checked)"/>
              <span>${pafEsc(p.label)}</span>
            </label>`).join('')}
          ${masques ? `<span class="paf-masques">${masques} couverture${masques > 1 ? 's' : ''} d’entreprise masquée${masques > 1 ? 's' : ''}</span>` : ''}
        </fieldset>`;
      }).join('')}</div>
      ${!entreprise ? `<label class="paf-tout-voir">
        <input type="checkbox" ${toutVoir ? 'checked' : ''} onchange="pafToutVoir('${oppId}', this.checked)"/>
        Afficher aussi les couvertures d’entreprise
        <small>Utile pour un indépendant qui assure son activité sur sa fiche privée.</small>
      </label>` : ''}
      <div class="paf-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-paf-couv').remove()">Annuler</button>
        <button type="button" class="btn-save" onclick="pafEnregistrerCouvertures('${oppId}')">✓ Enregistrer</button>
      </div>
    </div>`, { opacite: .7, padding: '16px' });
}

// Lever le filtre sans perdre ce qui vient d'être coché : on relit les cases de la fenêtre
// ouverte, on les enregistre en mémoire, puis on rouvre en montrant tout.
function pafToutVoir(oppId, tout) {
  const o = pafOpp(oppId);
  if (!o) return;
  // On relit les cases avant de refermer : sans cela, cocher trois couvertures puis lever le
  // filtre les perdrait toutes. Rien n'est écrit en base ici — seulement gardé en mémoire le
  // temps de rouvrir.
  const coches = [...document.querySelectorAll('#modal-paf-couv input[type="checkbox"]:checked')]
    .map(i => i.value).filter(v => v && v !== 'on');
  o.produits = coches;
  document.getElementById('modal-paf-couv')?.remove();
  pafOuvrirCouvertures(oppId, tout);
}

async function pafEnregistrerCouvertures(oppId) {
  const o = pafOpp(oppId);
  if (!o) return;
  const produits = [...document.querySelectorAll('#modal-paf-couv input[type="checkbox"]:checked')].map(i => i.value);
  // On ne touche PAS à produits_primes : les primes déjà saisies par produit restent en base,
  // intactes, et l'ancienne fiche les retrouvera si ce module est retiré.
  const r = await dbPatch('opportunites', oppId, { produits });
  if (r && r.error) { showError('Enregistrement impossible : ' + errMsg(r)); return; }
  o.produits = produits;
  document.getElementById('modal-paf-couv')?.remove();
  showError(`✓ ${produits.length || 'Aucune'} couverture${produits.length > 1 ? 's' : ''} retenue${produits.length > 1 ? 's' : ''}`);
  pafRafraichir();
}

function pafRafraichir() {
  if (typeof navigate === 'function' && typeof currentView !== 'undefined' && currentView === 'nouvelle-opportunite') {
    navigate('nouvelle-opportunite');
  }
}

// ── Branchement ─────────────────────────────────────────────────────────────────────────────────
// On enveloppe viewFicheOpportunite (js/25), la fiche réellement affichée. Deux interventions :
//   — « Produits envisagés » cède sa place à « L'affaire en bref » ;
//   — « Ce qu'il reste à faire » s'insère au-dessus des colonnes, sous le bandeau d'en-tête.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de ce module dans index.html suffit. La fonction
// d'origine n'est pas modifiée, aucun stade n'est renommé, et les colonnes ajoutées en base
// (situation actuelle, résiliation, date de signature) sont simplement ignorées par l'ancienne
// fiche. Rien n'est perdu dans un sens comme dans l'autre.
(function pafBrancher() {
  if (typeof viewFicheOpportunite !== 'function') return;
  const origine = viewFicheOpportunite;

  window.viewFicheOpportunite = function (o) {
    let html = origine.apply(this, arguments);
    if (!o || !o.id) return html;

    // Le vestige : la carte « Produits envisagés ». On la remplace en entier plutôt que de la
    // masquer, pour ne pas laisser un bloc vide dans la colonne.
    const avant = html;
    html = html.replace(
      /<section class="dbx-carte opx-carte">\s*<div class="dbx-carte-tete"><h3 class="opx-h3">Produits envisagés<\/h3>[\s\S]*?<\/section>/,
      pafResume(o),
    );
    // Si le repère a changé dans js/25, on ne perd pas le résumé : on le pose en tête de colonne.
    if (html === avant) {
      html = html.replace(/(<div class="opx-col">\s*<section class="dbx-carte opx-carte">\s*<div class="dbx-carte-tete"><h3 class="opx-h3">Offres)/,
        '<div class="opx-col">' + pafResume(o) + '<section class="dbx-carte opx-carte"><div class="dbx-carte-tete"><h3 class="opx-h3">Offres');
    }

    // Ce qu'il reste à faire, juste avant les deux colonnes.
    html = html.replace(/(<div class="opx-grille">)/, pafBandeau(o) + '$1');
    return html;
  };
})();
