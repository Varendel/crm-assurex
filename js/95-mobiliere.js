// ═══ LA MOBILIÈRE : TAUX RÉELS, ET PAS DE GESTION (20.09.2026) ═════════════════════════════════
// « Adapte les estimations de commission pour la Mobilière et désactive la possibilité d'entrer
// des contrats gestion avec Mobilière tant que la convention ne sera pas gestion ; aujourd'hui
// c'est acquisition. »
//
// DEUX PROBLÈMES DISTINCTS, ET LE SECOND EST LE PLUS COÛTEUX.
//
// 1. L'ESTIMATION ÉTAIT FAUSSE D'UN FACTEUR SEPT. Aucune convention Mobilière n'étant enregistrée,
//    le CRM appliquait son repli de « 10 % de la prime annuelle ». Les versements réels, relevés
//    au rapprochement bancaire : RC entreprise 72 %, protection juridique professionnelle 66 %,
//    RC véhicule 12,7 %. Sept contrats estimés 281 CHF en ont rapporté 1 920. Ces branches
//    n'apparaissaient donc pour ainsi dire pas dans le prévisionnel.
//
// 2. LA GESTION N'EXISTE PAS CHEZ LA MOBILIÈRE. Tant qu'aucune convention ne prévoit de
//    commission de gestion, un contrat Mobilière inscrit « gestion » rapporte ZÉRO — mais le
//    moteur de trésorerie, lui, projette une ligne récurrente année après année. Une erreur de
//    saisie d'une seconde crée ainsi un revenu imaginaire qui se répète sur tout l'horizon, et
//    que rien ne vient contredire puisqu'on ne remarque pas l'absence d'un encaissement.
//    On bloque donc la saisie à la source plutôt que de corriger après coup.

const MOB_NOMS = /mobili[èe]re|mobiliar/i;

function mobEstMobiliere(nom) { return MOB_NOMS.test(String(nom || '')); }

function mobTaux() {
  return (typeof TAUX_COMMISSION !== 'undefined' && TAUX_COMMISSION.mobiliere) || null;
}

// Le taux pour un produit. On reconnaît la branche par son libellé, dans l'ordre du plus précis
// au plus général — « RC véhicule » doit sortir en véhicule, pas en RC entreprise.
function mobTauxProduit(produit) {
  const t = mobTaux();
  if (!t) return null;
  const p = String(produit || '');
  if (/v[ée]hicule|casco|flotte|plaque/i.test(p)) return { taux: t.vehicule_rc, nom: 'véhicule' };
  if (/juridique/i.test(p)) return { taux: t.protection_juridique_pro, nom: 'protection juridique' };
  if (/m[ée]nage|inventaire du m[ée]nage/i.test(p)) return { taux: t.rc_menage, nom: 'RC + ménage' };
  if (/\brc\b|responsabilit|exploitation|commerce|professionnelle/i.test(p)) return { taux: t.rc_entreprise, nom: 'RC entreprise' };
  return { taux: t.defaut, nom: 'branche non observée' };
}

// ── L'estimation ────────────────────────────────────────────────────────────────────────────────
// On enveloppe le calcul existant plutôt que de le réécrire : il connaît les cas santé, LPP,
// LAMal, et ce n'est pas eux qui posaient problème.
(function mobBrancherEstimation() {
  if (typeof creerCommissionManquante === 'function') {
    // Le « filet de sécurité » de js/04 applique lui aussi 10 % par défaut : on lui donne le bon
    // taux avant qu'il ne s'exécute, en corrigeant le contrat qu'il s'apprête à lire.
    const origine = creerCommissionManquante;
    window.creerCommissionManquante = async function (contratId) {
      const ct = (typeof allContrats !== 'undefined' ? allContrats : []).find(c => c.id === contratId);
      if (!ct || !mobEstMobiliere(ct.compagnie)) return origine.apply(this, arguments);

      const t = mobTauxProduit(ct.produit);
      const prime = Number(ct.prime_annuelle || 0);
      if (!t || !prime) return origine.apply(this, arguments);

      const cl = (typeof allClients !== 'undefined' ? allClients : []).find(c => c.id === ct.client_id);
      const nomClient = cl ? ((typeof estEntreprise === 'function' && estEntreprise(cl)) ? cl.nom : `${cl.prenom || ''} ${cl.nom || ''}`.trim()) : '';
      const montant = Math.round(prime * t.taux / 100);

      const r = await dbPost('commissions_attente', {
        client_id: ct.client_id, contrat_id: ct.id, client_nom: nomClient,
        compagnie: ct.compagnie, produit: ct.produit,
        montant_estime: montant,
        detail_calcul: `La Mobilière — ${t.nom} : ${String(t.taux).replace('.', ',')} % × prime ${prime} = CHF ${montant}. `
          + `Taux mesuré sur les versements réels (aucune convention enregistrée) — acquisition, première année.`,
        nature: 'acquisition', statut: 'en_attente',
        date_creation: new Date().toISOString().slice(0, 10),
      });
      if (r && r.error) { showError('Erreur : ' + errMsg(r)); return; }
      if (typeof logAction === 'function') logAction('creer_commission_mobiliere', 'commissions_attente', null, nomClient);
      if (typeof dbGet === 'function') allCommissionsAttente = await dbGet('commissions_attente', 'select=*');
      if (typeof navigate === 'function' && typeof currentView !== 'undefined') navigate(currentView);
    };
  }

  // Le taux appris (js/19) sert au calcul des estimations courantes : on lui fournit le nôtre
  // pour la Mobilière, qui repose sur davantage de cas que ce qu'il trouverait tout seul.
  if (typeof tauxCommissionAppris === 'function') {
    const origine = tauxCommissionAppris;
    window.tauxCommissionAppris = function (compagnie, produit, nature) {
      if (mobEstMobiliere(compagnie) && nature !== 'gestion') {
        const t = mobTauxProduit(produit);
        if (t) return { taux: t.taux / 100, n: 0, portee: 'compagnie', source: 'mesuré — La Mobilière' };
      }
      return origine.apply(this, arguments);
    };
  }
})();

// ── Le blocage de la gestion ────────────────────────────────────────────────────────────────────
// Trois barrières, parce qu'une seule se contourne : le champ se désactive à l'écran, la
// sauvegarde refuse, et l'utilisateur comprend pourquoi. Un blocage qui ne s'explique pas se vit
// comme un bug et finit par être contourné.
const MOB_MESSAGE = 'La Mobilière ne verse aujourd’hui aucune commission de gestion : aucune convention ne la prévoit. '
  + 'Un contrat saisi en gestion projetterait un revenu récurrent qui n’arrivera jamais. '
  + 'Saisissez-le en acquisition ; dès que la convention le permettra, ce blocage sautera.';

function mobVerifier(compagnie, nature) {
  if (!mobEstMobiliere(compagnie)) return true;
  if (String(nature || '').toLowerCase() !== 'gestion') return true;
  if (typeof showError === 'function') showError(MOB_MESSAGE);
  return false;
}

// Applique le verrou aux sélecteurs de nature présents à l'écran, en lisant la compagnie choisie.
// Relancé à chaque rendu : les formulaires du CRM se redessinent entièrement.
function mobAppliquerVerrou() {
  const champsNature = document.querySelectorAll('select[id*="nature"], select[name*="nature"], #c-nature, #comm-nature');
  if (!champsNature.length) return;

  const champCompagnie = document.querySelector('#c-compagnie, #o-compagnie, #contrat-compagnie, select[id*="compagnie"], input[id*="compagnie"]');
  const compagnie = champCompagnie ? (champCompagnie.value || '') : '';
  const bloque = mobEstMobiliere(compagnie);

  champsNature.forEach(sel => {
    const opt = [...sel.options].find(o => /gestion/i.test(o.value) || /gestion/i.test(o.textContent));
    if (!opt) return;
    opt.disabled = bloque;
    opt.textContent = bloque ? 'Gestion — indisponible chez La Mobilière' : opt.textContent.replace(/ — indisponible.*$/, '');
    if (bloque && /gestion/i.test(sel.value)) {
      sel.value = [...sel.options].find(o => /acquisition/i.test(o.value))?.value || sel.options[0].value;
      if (typeof showError === 'function') showError(MOB_MESSAGE);
    }
    // Le motif s'affiche sous le champ : un choix grisé sans explication se lit comme une panne.
    const id = 'mob-note-' + (sel.id || 'nature');
    document.getElementById(id)?.remove();
    if (bloque) {
      const note = document.createElement('div');
      note.id = id;
      note.className = 'mob-note';
      note.textContent = 'La Mobilière : acquisition uniquement — aucune convention de gestion à ce jour.';
      sel.insertAdjacentElement('afterend', note);
    }
  });
}

(function mobBrancherVerrou() {
  // À chaque changement de compagnie dans un formulaire, et après chaque rendu de page.
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.id) return;
    if (/compagnie/i.test(t.id) || /nature/i.test(t.id)) setTimeout(mobAppliquerVerrou, 0);
  }, true);

  if (typeof renderView === 'function') {
    const origine = renderView;
    window.renderView = async function () {
      const r = await origine.apply(this, arguments);
      setTimeout(mobAppliquerVerrou, 60);
      return r;
    };
  }

  // Dernière barrière : la sauvegarde. Si le verrou d'écran a été contourné — champ ajouté par un
  // autre module, valeur forcée dans la console —, l'enregistrement refuse quand même.
  for (const nom of ['saveContrat', 'saveCommission', 'enregistrerContrat']) {
    if (typeof window[nom] !== 'function') continue;
    const origine = window[nom];
    window[nom] = function (...args) {
      const cie = document.querySelector('#c-compagnie, #contrat-compagnie, select[id*="compagnie"]')?.value;
      const nat = document.querySelector('select[id*="nature"], #c-nature')?.value;
      if (cie && nat && !mobVerifier(cie, nat)) return;
      return origine.apply(this, args);
    };
  }
})();
