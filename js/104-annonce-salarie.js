// ═══ ANNONCER UN SALARIÉ (20.09.2026) ══════════════════════════════════════════════════════════
// « Ajoute la possibilité d'annoncer un salarié, nous faisons ensuite aux assurances sociales :
//   LPP, LAA, IJM. »
//
// C'est l'acte administratif qui coûte le plus cher quand il est oublié. Un salarié non annoncé
// n'est PAS couvert en LAA ; l'affiliation LPP rétroagit avec des cotisations de rattrapage ; et
// l'assureur IJM peut opposer une réserve. Le délai usuel est de trente jours — au-delà,
// l'employeur répond personnellement du sinistre.
//
// Aujourd'hui l'annonce passe par un appel ou un courriel, souvent le vendredi soir, souvent
// incomplet — et c'est l'aller-retour pour compléter qui fait perdre les jours.
//
// CE QUI EST DEMANDÉ est exactement ce que les trois assureurs réclament, et rien de plus :
//   · le NUMÉRO AVS identifie la personne auprès de la Centrale du 2e pilier. Sans lui, aucune
//     affiliation LPP n'aboutit ;
//   · la DATE DE NAISSANCE commande les bonifications de vieillesse LPP — les taux changent à
//     25, 35, 45 et 55 ans — et l'âge d'entrée ;
//   · le SALAIRE ANNUEL détermine le salaire coordonné LPP, le gain assuré LAA et la prestation
//     IJM ;
//   · la FONCTION classe le risque LAA : bureau et atelier ne se tarifent pas pareil.
//
// LA SORTIE EST DANS LE MÊME FORMULAIRE. C'est l'oubli symétrique, et il coûte dans l'autre sens :
// un salarié parti et non annoncé reste assuré et facturé, parfois des trimestres.
//
// ANNONCER N'EST PAS AFFILIER. Ce formulaire transmet au courtier ; c'est le courtier qui annonce
// aux compagnies, et c'est ce geste-là qui couvre. L'écran le dit sans détour — laisser croire
// qu'une saisie suffit serait la pire des simplifications.
//
// RETOUR EN ARRIÈRE : retirer les deux lignes de index.html (ce fichier + 99-salarie.css).

function aslEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function aslIco(nom, t) { return typeof ico === 'function' ? ico(nom, t || 18) : ''; }

function aslEstEntreprise() {
  const c = (window._ec || {}).client;
  return !!(typeof estEntreprise === 'function' && c && estEntreprise(c));
}

// ── Le numéro AVS ──────────────────────────────────────────────────────────────────────────────
// 756.XXXX.XXXX.XX, treize chiffres avec une clé de contrôle EAN-13. La vérifier ici évite le
// seul incident vraiment coûteux : un chiffre faux passe la saisie, part à la compagnie, et
// l'affiliation revient trois semaines plus tard — après le délai de trente jours.
function aslAvsChiffres(v) { return String(v || '').replace(/\D/g, ''); }

function aslAvsValide(v) {
  const d = aslAvsChiffres(v);
  if (d.length !== 13 || !d.startsWith('756')) return false;
  let somme = 0;
  for (let i = 0; i < 12; i++) somme += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (somme % 10)) % 10 === Number(d[12]);
}

function aslAvsFormate(v) {
  const d = aslAvsChiffres(v);
  if (d.length !== 13) return String(v || '').trim();
  return `${d.slice(0, 3)}.${d.slice(3, 7)}.${d.slice(7, 11)}.${d.slice(11)}`;
}

// ── Quelles assurances sociales l'entreprise a-t-elle réellement ? ─────────────────────────────
// On ne demande pas au client de cocher au hasard : on lit ses contrats. Lui dire « sera annoncé
// à Swiss Life (LPP) et Helvetia (LAA) » vaut mieux qu'une liste de cases — c'est la réponse à
// la question qu'il se pose vraiment, qui est « et après ? ».
const ASL_SOCIALES = [
  { cle: 'LPP', nom: 'LPP — prévoyance professionnelle', test: /\blpp\b|pr[ée]voyance profession|2e?\s*pilier|caisse de pension/i },
  { cle: 'LAA', nom: 'LAA — accidents', test: /\blaa[cs]?\b|accident/i },
  { cle: 'IJM', nom: 'IJM — indemnités journalières maladie', test: /\bijm\b|indemnit[ée]s? journali|perte de gain maladie|\bpgm\b/i },
];

function aslContratsSociaux() {
  const contrats = typeof ecContratsActifs === 'function' ? ecContratsActifs() : ((window._ec || {}).contrats || []);
  const out = [];
  for (const s of ASL_SOCIALES) {
    const ct = contrats.find(x => s.test.test(`${x.produit || ''} ${x.categorie || ''} ${x.modules || ''}`));
    if (ct) out.push({ ...s, compagnie: ct.compagnie || '' });
  }
  return out;
}

// ── Le formulaire ──────────────────────────────────────────────────────────────────────────────
let _aslNature = 'entree';

function aslOuvrir(nature) {
  if (!aslEstEntreprise()) return;
  _aslNature = nature || 'entree';
  const sociales = aslContratsSociaux();

  creerModale('modal-asl', `
    <div class="opx-modale mdx-modale mdx-modale-flex asl-modale" role="dialog" aria-modal="true" aria-labelledby="asl-titre">
      <h3 id="asl-titre">Annoncer un salarié</h3>
      <p class="asl-sous">Nous transmettons l’annonce à vos assureurs sociaux. Tant que nous ne
        l’avons pas faite, la personne n’est pas couverte — c’est pourquoi mieux vaut annoncer
        tôt, quitte à corriger ensuite.</p>

      ${sociales.length ? `<div class="asl-destinataires">
        <em>Sera annoncé à</em>
        <ul>${sociales.map(s => `<li>${typeof pictoCompagnie === 'function' ? pictoCompagnie(s.compagnie, 20) : ''}
          <b>${aslEsc(s.cle)}</b><span>${aslEsc(s.compagnie || 'compagnie à préciser')}</span></li>`).join('')}</ul>
      </div>` : `<div class="asl-destinataires asl-vide">
        <em>Aucune assurance sociale active dans votre dossier</em>
        <span>Transmettez quand même : votre conseiller vérifiera auprès de quelle caisse annoncer.</span>
      </div>`}

      <div class="asl-nature" role="radiogroup" aria-label="Nature de l’annonce">
        ${[['entree', 'Entrée', 'Un nouveau collaborateur arrive'],
           ['sortie', 'Sortie', 'Un collaborateur quitte l’entreprise']].map(([k, t, aide]) => `
          <label class="asl-radio ${_aslNature === k ? 'actif' : ''}">
            <input type="radio" name="asl-nature" value="${k}" ${_aslNature === k ? 'checked' : ''}
              onchange="aslMajNature(this.value)"/>
            <b>${t}</b><small>${aide}</small>
          </label>`).join('')}
      </div>

      <div class="asl-grille">
        <div class="form-field"><label class="form-label" for="asl-prenom">Prénom</label>
          <input class="form-input" id="asl-prenom" maxlength="80" autocomplete="off"/></div>
        <div class="form-field"><label class="form-label" for="asl-nom">Nom</label>
          <input class="form-input" id="asl-nom" maxlength="80" autocomplete="off"/></div>
      </div>

      <div class="form-field"><label class="form-label" for="asl-avs">Numéro AVS</label>
        <input class="form-input" id="asl-avs" maxlength="20" inputmode="numeric" placeholder="756.1234.5678.97"
          oninput="aslControlerAvs()"/>
        <small class="asl-aide" id="asl-avs-aide">Il figure sur la carte d’assurance maladie et sur le
          certificat de salaire. Sans lui, l’affiliation LPP ne peut pas aboutir.</small></div>

      <div id="asl-entree" style="display:${_aslNature === 'entree' ? '' : 'none'}">
        <div class="asl-grille">
          <div class="form-field"><label class="form-label" for="asl-naissance">Date de naissance</label>
            <input class="form-input" id="asl-naissance" type="date"/></div>
          <div class="form-field"><label class="form-label" for="asl-sexe">Sexe</label>
            <select class="form-select" id="asl-sexe">
              <option value="">—</option><option value="f">Féminin</option>
              <option value="m">Masculin</option><option value="autre">Autre</option>
            </select></div>
        </div>
        <div class="asl-grille asl-trois">
          <div class="form-field"><label class="form-label" for="asl-taux">Taux d’activité</label>
            <input class="form-input" id="asl-taux" inputmode="numeric" placeholder="100" maxlength="3"/></div>
          <div class="form-field"><label class="form-label" for="asl-salaire">Salaire annuel brut (CHF)</label>
            <input class="form-input" id="asl-salaire" inputmode="decimal" placeholder="72 000"/></div>
          <div class="form-field"><label class="form-label" for="asl-contrat">Contrat</label>
            <select class="form-select" id="asl-contrat">
              <option value="">—</option><option>Durée indéterminée</option>
              <option>Durée déterminée</option><option>Apprentissage</option><option>Stage</option>
            </select></div>
        </div>
        <div class="form-field"><label class="form-label" for="asl-fonction">Fonction</label>
          <input class="form-input" id="asl-fonction" maxlength="120" placeholder="Ex. cuisinier, employée de bureau"/>
          <small class="asl-aide">Elle classe le risque accident : un poste d’atelier et un poste
            de bureau ne se tarifent pas de la même façon.</small></div>
      </div>

      <div class="form-field"><label class="form-label" for="asl-effet">
        <span id="asl-effet-label">${_aslNature === 'sortie' ? 'Dernier jour de travail' : 'Date d’entrée'}</span></label>
        <input class="form-input" id="asl-effet" type="date"/></div>

      <div class="form-field"><label class="form-label" for="asl-remarque">Précisions <span class="mdx-optionnel">facultatif</span></label>
        <textarea class="form-input" id="asl-remarque" rows="3" maxlength="1000"
          placeholder="Reprise d’un contrat précédent, salaire variable, temps partiel irrégulier…"></textarea></div>

      <div class="opx-modale-actions mdx-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-asl').remove()">Annuler</button>
        <button type="button" class="btn-save" id="asl-envoi" onclick="aslEnvoyer()">Transmettre</button>
      </div>
    </div>`, { padding: '16px' }).classList.add('rex-modale-feuille');
}

function aslMajNature(v) {
  _aslNature = v;
  const z = document.getElementById('asl-entree');
  if (z) z.style.display = v === 'entree' ? '' : 'none';
  const l = document.getElementById('asl-effet-label');
  if (l) l.textContent = v === 'sortie' ? 'Dernier jour de travail' : 'Date d’entrée';
  document.querySelectorAll('.asl-radio').forEach(x =>
    x.classList.toggle('actif', x.querySelector('input').value === v));
}

// Le contrôle se fait pendant la frappe, pas à l'envoi : corriger un chiffre est facile tant
// qu'on a le document sous les yeux, pénible une fois la fenêtre refermée.
function aslControlerAvs() {
  const champ = document.getElementById('asl-avs');
  const aide = document.getElementById('asl-avs-aide');
  if (!champ || !aide) return;
  const d = aslAvsChiffres(champ.value);
  champ.classList.remove('asl-ko', 'asl-ok');
  if (!d.length) {
    aide.textContent = 'Il figure sur la carte d’assurance maladie et sur le certificat de salaire. Sans lui, l’affiliation LPP ne peut pas aboutir.';
    aide.className = 'asl-aide'; return;
  }
  if (d.length < 13) {
    aide.textContent = `${d.length} chiffre${d.length > 1 ? 's' : ''} sur 13.`;
    aide.className = 'asl-aide'; return;
  }
  if (aslAvsValide(d)) {
    champ.classList.add('asl-ok');
    aide.textContent = `Numéro valide : ${aslAvsFormate(d)}`;
    aide.className = 'asl-aide asl-aide-ok';
  } else {
    champ.classList.add('asl-ko');
    aide.textContent = 'Ce numéro ne passe pas le contrôle : un chiffre a dû être mal recopié.';
    aide.className = 'asl-aide asl-aide-ko';
  }
}

function aslNombre(id) {
  const v = (document.getElementById(id)?.value || '').replace(/['’\s]/g, '').replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

async function aslEnvoyer() {
  const c = (window._ec || {}).client;
  if (!c) return;
  const t = id => (document.getElementById(id)?.value || '').trim();
  const prenom = t('asl-prenom'), nom = t('asl-nom'), effet = t('asl-effet');

  if (!nom) { showError('Indiquez au moins le nom du salarié.'); return; }
  if (!effet) {
    showError(_aslNature === 'sortie'
      ? 'Indiquez le dernier jour de travail : c’est lui qui met fin aux couvertures.'
      : 'Indiquez la date d’entrée : c’est elle qui ouvre les couvertures.');
    return;
  }
  // Un AVS renseigné mais faux est pire qu'un AVS absent : il part à la compagnie et revient
  // après le délai. Absent, il se complète ; faux, il se découvre trop tard.
  const avs = t('asl-avs');
  if (avs && !aslAvsValide(avs)) {
    showError('Le numéro AVS ne passe pas le contrôle — vérifiez-le, ou laissez le champ vide.');
    return;
  }

  const btn = document.getElementById('asl-envoi');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  const ligne = {
    client_id: c.id, nature: _aslNature,
    prenom: prenom || null, nom,
    avs: avs ? aslAvsFormate(avs) : null,
    date_effet: effet,
    remarque: t('asl-remarque') || null,
    assurances: aslContratsSociaux().map(s => s.cle),
    statut: 'nouvelle',
  };
  if (_aslNature === 'entree') {
    Object.assign(ligne, {
      date_naissance: t('asl-naissance') || null,
      sexe: t('asl-sexe') || null,
      taux_activite: aslNombre('asl-taux'),
      salaire_annuel: aslNombre('asl-salaire'),
      fonction: t('asl-fonction') || null,
      type_contrat: t('asl-contrat') || null,
    });
  }

  const r = await dbPost('annonces_salaries', ligne);
  if (r && r.error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Transmettre'; }
    showError('L’annonce n’a pas pu être enregistrée — réessayez dans un instant.');
    return;
  }
  document.getElementById('modal-asl')?.remove();
  showError('✓ Annonce transmise. Votre conseiller l’adresse à vos assureurs sociaux.');
  window._ec.annoncesSalaries = [{ ...ligne, created_at: new Date().toISOString() }, ...(window._ec.annoncesSalaries || [])];
  if (typeof ecRendre === 'function') ecRendre();
}

// ── La tuile, côté entreprise ──────────────────────────────────────────────────────────────────
function aslTuileHtml() {
  if (!aslEstEntreprise()) return '';
  const enCours = ((window._ec || {}).annoncesSalaries || []).filter(a => a.statut === 'nouvelle').length;
  return `<button type="button" class="ec-tuile" onclick="aslOuvrir()">
    <span>${aslIco('personnel', 22)}</span>
    <b>Annoncer un salarié</b>
    <small>Entrée ou sortie — nous annonçons à la LPP, la LAA et l’IJM${enCours ? ` · ${enCours} en cours` : ''}</small>
  </button>`;
}

// ── Côté cabinet ───────────────────────────────────────────────────────────────────────────────
function aslEnAttente() {
  const src = (typeof _mc !== 'undefined' && _mc.salaries) || [];
  return src.filter(a => a.statut === 'nouvelle');
}

function aslCarteCabinet() {
  const liste = aslEnAttente();
  if (!liste.length) return '';
  const nom = id => (typeof mcNomClient === 'function' ? mcNomClient(id) : 'Entreprise');
  const jours = iso => Math.floor((Date.now() - new Date(iso || Date.now()).getTime()) / 86400000);

  return `<section class="dbx-carte asl-cabinet">
    <header class="dbx-carte-tete">
      <h2>Annonces de personnel</h2>
      <span class="dbx-carte-sous">${liste.length} à transmettre</span>
    </header>
    <p class="asl-rappel">Le délai usuel est de trente jours. Tant que l’annonce n’est pas faite,
      un nouvel arrivant n’est pas couvert en LAA — et un partant reste facturé.</p>
    <div class="asl-liste">${liste.map(a => {
      const d = jours(a.created_at);
      const tard = d > 20;
      return `<article class="asl-item ${tard ? 'tard' : ''}">
        <div class="asl-item-tete">
          <span class="asl-badge ${a.nature}">${a.nature === 'sortie' ? 'Sortie' : 'Entrée'}</span>
          <b>${aslEsc([a.prenom, a.nom].filter(Boolean).join(' ') || 'Salarié')}</b>
          <span class="asl-item-cie">${aslEsc(nom(a.client_id))}</span>
          <span class="asl-item-age">${d === 0 ? 'aujourd’hui' : `il y a ${d} j`}</span>
        </div>
        <div class="asl-item-faits">
          ${a.date_effet ? `<span><em>${a.nature === 'sortie' ? 'Fin' : 'Début'}</em> ${typeof fmtDate === 'function' ? fmtDate(a.date_effet) : a.date_effet}</span>` : ''}
          ${a.avs ? `<span><em>AVS</em> ${aslEsc(a.avs)}</span>` : '<span class="asl-manque">AVS manquant</span>'}
          ${a.date_naissance ? `<span><em>Né(e)</em> ${typeof fmtDate === 'function' ? fmtDate(a.date_naissance) : a.date_naissance}</span>` : ''}
          ${a.taux_activite ? `<span><em>Taux</em> ${a.taux_activite} %</span>` : ''}
          ${a.salaire_annuel ? `<span><em>Salaire</em> CHF ${typeof fmtCHF === 'function' ? fmtCHF(Math.round(a.salaire_annuel)) : a.salaire_annuel}</span>` : ''}
          ${a.fonction ? `<span><em>Fonction</em> ${aslEsc(a.fonction)}</span>` : ''}
          ${(a.assurances || []).length ? `<span><em>Concerne</em> ${aslEsc((a.assurances || []).join(', '))}</span>` : ''}
        </div>
        ${a.remarque ? `<p class="asl-item-note">${aslEsc(a.remarque)}</p>` : ''}
        <div class="asl-item-actions">
          <button type="button" class="btn-secondary" onclick="aslCopier('${a.id}')">Copier pour la compagnie</button>
          <button type="button" class="btn-save" onclick="aslClore('${a.id}')">Annoncé</button>
        </div>
      </article>`;
    }).join('')}</div>
  </section>`;
}

// Le texte prêt à coller dans le courriel à la compagnie : c'est le geste réel du courtier, et
// le retaper à la main est exactement là où les chiffres se perdent.
function aslCopier(id) {
  const a = ((typeof _mc !== 'undefined' && _mc.salaries) || []).find(x => x.id === id);
  if (!a) return;
  const cie = typeof mcNomClient === 'function' ? mcNomClient(a.client_id) : '';
  const l = [];
  l.push(`${a.nature === 'sortie' ? 'SORTIE' : 'ENTRÉE'} — ${cie}`);
  l.push(`Salarié : ${[a.prenom, a.nom].filter(Boolean).join(' ')}`);
  if (a.avs) l.push(`N° AVS : ${a.avs}`);
  if (a.date_naissance) l.push(`Date de naissance : ${typeof fmtDate === 'function' ? fmtDate(a.date_naissance) : a.date_naissance}`);
  if (a.sexe) l.push(`Sexe : ${a.sexe === 'f' ? 'féminin' : a.sexe === 'm' ? 'masculin' : 'autre'}`);
  l.push(`${a.nature === 'sortie' ? 'Dernier jour de travail' : 'Date d’entrée'} : ${typeof fmtDate === 'function' ? fmtDate(a.date_effet) : a.date_effet}`);
  if (a.taux_activite) l.push(`Taux d’activité : ${a.taux_activite} %`);
  if (a.salaire_annuel) l.push(`Salaire annuel brut : CHF ${Math.round(a.salaire_annuel)}`);
  if (a.fonction) l.push(`Fonction : ${a.fonction}`);
  if (a.type_contrat) l.push(`Contrat : ${a.type_contrat}`);
  if (a.remarque) l.push(`Remarque : ${a.remarque}`);
  const txt = l.join('\n');
  navigator.clipboard?.writeText(txt).then(
    () => showError('✓ Annonce copiée — collez-la dans le message à la compagnie.'),
    () => showError('Copie impossible : sélectionnez le texte à la main.'));
}

async function aslClore(id) {
  if (!confirm('Marquer cette annonce comme transmise aux assureurs ?\n\nÀ ne faire qu’une fois le message effectivement parti.')) return;
  const r = await dbPatch('annonces_salaries', id, {
    statut: 'traitee', traite_le: new Date().toISOString(),
    traite_par: (typeof currentUserEmail === 'function' ? currentUserEmail() : null),
  });
  if (r && r.error) { showError('Échec : ' + errMsg(r)); return; }
  const a = ((typeof _mc !== 'undefined' && _mc.salaries) || []).find(x => x.id === id);
  if (a) a.statut = 'traitee';
  if (typeof navigate === 'function') navigate('messages-clients', { silent: true });
}

// ── Les branchements ───────────────────────────────────────────────────────────────────────────
(function aslBrancher() {
  if (typeof ecChargerServices === 'function') {
    const origine = ecChargerServices;
    window.ecChargerServices = async function () {
      const r = await origine.apply(this, arguments);
      const E = window._ec;
      if (E && E.client && E.annoncesSalaries === undefined && aslEstEntreprise()) {
        E.annoncesSalaries = await dbGet('annonces_salaries',
          `client_id=eq.${E.client.id}&select=*&order=created_at.desc`).catch(() => []) || [];
        if (typeof ecRendre === 'function') ecRendre();
      }
      return r;
    };
  }

  // La tuile se pose avant « Demander un document », comme celle de l'adresse (js/103). Les deux
  // s'insèrent au même repère : la dernière enveloppe passe en premier dans la liste, l'ordre
  // exact n'a pas d'importance tant qu'elles sont voisines.
  if (typeof ecVueEspaceClient === 'function') {
    const origine = ecVueEspaceClient;
    const MARQUE = '<button type="button" class="ec-tuile" onclick="ecOuvrirDemandeDocument()">';
    window.ecVueEspaceClient = function () {
      const html = origine.apply(this, arguments);
      const tuile = aslTuileHtml();
      if (!tuile) return html;
      const i = html.indexOf(MARQUE);
      if (i < 0) return html;
      return html.slice(0, i) + tuile + html.slice(i);
    };
  }

  if (typeof mcCharger === 'function') {
    const origine = mcCharger;
    window.mcCharger = async function (forcer) {
      const r = await origine.apply(this, arguments);
      if (typeof _mc !== 'undefined' && (!_mc.salaries || forcer)) {
        _mc.salaries = await dbGet('annonces_salaries', 'select=*&order=created_at.desc&limit=200').catch(() => []) || [];
      }
      return r;
    };
  }

  if (typeof viewMessagesClients === 'function') {
    const origine = viewMessagesClients;
    const MARQUE = '<div class="mcx-onglets"';
    window.viewMessagesClients = function () {
      const html = origine.apply(this, arguments);
      const carte = aslCarteCabinet();
      if (!carte) return html;
      const i = html.indexOf(MARQUE);
      if (i < 0) return html + carte;
      return html.slice(0, i) + carte + html.slice(i);
    };
  }
})();
