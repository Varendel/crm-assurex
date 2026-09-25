// ═══ DÉCOMPTES DE COMMISSIONS ECOHUB — LECTURE DU FORMAT IG B2B 5.4.1 (20.09.2026) ══════════════
// Le jour où une compagnie ouvrira le flux, les décomptes arriveront en XML normalisé plutôt qu'en
// scan. Ce module lit ce format et en sort des lignes exploitables par le CRM, avec le même
// rapprochement que pour les décomptes scannés (js/53) : numéro de police, puis nom / IDE.
//
// Écrit et vérifié contre le fichier de test officiel d'EcoHub, versionné dans ecohub/testfiles/.
// Structure d'un décompte :
//   commission > header (sender/insurer, recipient/broker) + exchangeDateFrom/To
//              > contract[@contractNo] > commStatement > soit commStatementTotalOnly,
//                soit commStatementList > commStatementTotal + commStatementDetail*
//              > ICBusiness | ICPrivatePerson (le preneur d'assurance)
//              > commissionTotal
// Piège comptable : quand il y a une liste, le TOTAL est la somme des DÉTAILS. On marque donc
// chaque ligne (« total » ou « detail ») et on ne compte que les totaux, sans quoi tout est doublé.

// Codes typeComm — repris mot pour mot de commissionTypeLib_V5.4.1.xsd (vérifié le 20.09.2026
// contre un décompte Allianz réel : une première version de cette table inversait gestion et
// acquisition, ce qui aurait faussé toute la récurrence du portefeuille).
const EHC_TYPES_COMM = {
  '00': 'mixte',              // Mehrere, unterschiedliche Provisionsarten
  '01': 'gestion',            // Courtage / Betreuungsprovision
  '02': 'acquisition',        // Einmalige Abschlussprovision
  '03': 'acquisition_courante', // Laufende Abschlussprovision
  '04': 'forfait',            // Pauschalprovision
  '05': 'super_commission',   // Superprovision
  '06': 'acompte',            // Akontocourtage
};

function ehcTexte(parent, nom) {
  if (!parent) return '';
  for (const n of parent.children) if (n.localName === nom) return (n.textContent || '').trim();
  return '';
}
function ehcEnfant(parent, nom) {
  if (!parent) return null;
  for (const n of parent.children) if (n.localName === nom) return n;
  return null;
}
function ehcEnfants(parent, nom) {
  if (!parent) return [];
  return [...parent.children].filter(n => n.localName === nom);
}
function ehcNombre(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof nombreCH === 'function' ? nombreCH(v) : Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function ehcParserCommission(xmlTexte) {
  const doc = new DOMParser().parseFromString(String(xmlTexte || ''), 'application/xml');
  const erreur = doc.querySelector('parsererror');
  if (erreur) throw new Error('XML illisible : ' + (erreur.textContent || '').slice(0, 200));
  const racine = doc.documentElement;
  if (!racine || racine.localName !== 'commission') throw new Error(`Ce document est un « ${racine ? racine.localName : '?'} », pas un décompte de commissions.`);

  const entete = ehcEnfant(racine, 'header');
  const assureur = ehcEnfant(ehcEnfant(entete, 'sender'), 'insurer');
  const courtier = ehcEnfant(ehcEnfant(entete, 'recipient'), 'broker');

  const lignes = [];
  ehcEnfants(racine, 'contract').forEach(ct => {
    const police = ct.getAttribute('contractNo') || ehcTexte(ct, 'contractNoReplaced');
    const entreprise = ehcEnfant(ct, 'ICBusiness');
    const personne = ehcEnfant(ct, 'ICPrivatePerson');
    const preneur = entreprise
      ? { type: 'entreprise', nom: ehcTexte(entreprise, 'companyName'), ide: ehcTexte(entreprise, 'companyId') }
      : personne
        ? { type: 'prive', nom: `${ehcTexte(personne, 'firstname')} ${ehcTexte(personne, 'surname')}`.trim(), ide: '' }
        : { type: 'inconnu', nom: '', ide: '' };
    const commun = {
      numero_police: police,
      police_remplacee: ehcTexte(ct, 'contractNoReplaced'),
      contrat_cadre: ehcTexte(ct, 'frameworkContractNo'),
      code_courtier: ehcTexte(ct, 'brokerCodeIns'),
      agence: ehcTexte(ct, 'agency'),
      facture: ehcTexte(ct, 'invoiceNo'),
      date_facture: ehcTexte(ct, 'invoiceDate'),
      client_nom: preneur.nom, client_type: preneur.type, client_ide: preneur.ide,
    };
    const statement = ehcEnfant(ct, 'commStatement');
    const blocs = [];
    const seul = ehcEnfant(statement, 'commStatementTotalOnly');
    if (seul) blocs.push({ noeud: seul, niveau: 'total' });
    const liste = ehcEnfant(statement, 'commStatementList');
    if (liste) {
      ehcEnfants(liste, 'commStatementTotal').forEach(n => blocs.push({ noeud: n, niveau: 'total' }));
      ehcEnfants(liste, 'commStatementDetail').forEach(n => blocs.push({ noeud: n, niveau: 'detail' }));
    }
    blocs.forEach(({ noeud, niveau }) => {
      const type = ehcTexte(noeud, 'typeComm');
      lignes.push({
        ...commun, niveau,
        produit: ehcTexte(noeud, 'lobINS'),
        branche_ig: ehcTexte(noeud, 'lobIG'),
        periode_du: ehcTexte(noeud, 'premiumPeriodFromDate'),
        periode_au: ehcTexte(noeud, 'premiumPeriodToDate'),
        devise: ehcTexte(noeud, 'currency') || 'CHF',
        prime: ehcNombre(ehcTexte(noeud, 'premiumComm')),
        taux: ehcNombre(ehcTexte(noeud, 'commissionRate')),
        montant: ehcNombre(ehcTexte(noeud, 'commissionAmount')),
        type_commission: EHC_TYPES_COMM[type] || type || '',
      });
    });
  });

  const totaux = lignes.filter(l => l.niveau === 'total');
  const somme = totaux.reduce((s, l) => s + Number(l.montant || 0), 0);
  const annonce = ehcNombre(ehcTexte(racine, 'commissionTotal'));

  return {
    version: ehcTexte(entete, 'versionRec') || '5.4.1',
    reference: ehcTexte(entete, 'identificationNo'),
    cree_le: ehcTexte(entete, 'dateTimeCreation'),
    compagnie: ehcTexte(assureur, 'companyName'),
    compagnie_ide: ehcTexte(assureur, 'companyId'),
    code_assureur: ehcTexte(assureur, 'insurerCode'),
    courtier: ehcTexte(courtier, 'companyName'),
    courtier_finma: ehcTexte(courtier, 'brokerRegisterNo'),
    courtier_ide: ehcTexte(courtier, 'companyId'),
    periode_du: ehcTexte(racine, 'exchangeDateFrom'),
    periode_au: ehcTexte(racine, 'exchangeDateTo'),
    total_annonce: annonce,
    total_calcule: Math.round(somme * 100) / 100,
    // Un écart signale soit un cas de figure non prévu, soit un décompte partiel : on ne corrige
    // jamais en silence, on le signale pour vérification humaine.
    ecart: annonce === null ? null : Math.round((somme - annonce) * 100) / 100,
    nb_contrats: ehcEnfants(racine, 'contract').length,
    lignes,
  };
}

// Rapprochement avec le portefeuille : police d'abord, puis IDE (entreprise) ou nom (particulier).
function ehcRapprocher(ligne) {
  const contrats = typeof allContrats !== 'undefined' ? allContrats : [];
  const clients = typeof allClients !== 'undefined' ? allClients : [];
  const cle = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const police = cle(ligne.numero_police);
  if (police.length >= 4) {
    // Plusieurs contrats peuvent partager un numéro (santé + ménage chez Groupe Mutuel, RC + casco
    // chez un assureur véhicule). On départage par la branche annoncée dans le décompte plutôt que
    // de prendre le premier venu — même règle que l'import de bordereaux (scoreBrancheImport).
    const candidats = contrats.filter(x => cle(x.numero_police) === police);
    if (candidats.length) {
      const branche = [ligne.produit, ligne.branche_ig].filter(Boolean).join(' ');
      const ct = (candidats.length > 1 && typeof scoreBrancheImport === 'function')
        ? candidats.reduce((m, c) => scoreBrancheImport(c, branche) > m.s ? { c, s: scoreBrancheImport(c, branche) } : m,
            { c: candidats[0], s: -Infinity }).c
        : candidats[0];
      return { statut: 'contrat', contrat: ct, client: clients.find(c => c.id === ct.client_id) || null, candidats };
    }
  }
  if (ligne.client_ide) {
    const ide = cle(ligne.client_ide);
    const c = clients.find(x => x.ide && cle(x.ide) === ide);
    if (c) return { statut: 'client', client: c };
  }
  const nom = String(ligne.client_nom || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (nom.length >= 4) {
    const mots = nom.split(/\s+/).filter(m => m.length >= 3);
    const trouves = clients.filter(c => {
      const complet = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return mots.length && mots.every(m => complet.includes(m));
    });
    if (trouves.length === 1) return { statut: 'client', client: trouves[0] };
    if (trouves.length > 1) return { statut: 'ambigu', clients: trouves };
  }
  return { statut: 'inconnu' };
}

// Vérification du parseur contre un fichier de test — appelable depuis la console du CRM :
//   ehcAutotest(await (await fetch('ecohub/testfiles/testfile-commission-5.4.1-max.xml')).text())
function ehcAutotest(xmlTexte) {
  const r = ehcParserCommission(xmlTexte);
  const controles = [
    ['compagnie lue', !!r.compagnie],
    ['période lue', !!r.periode_du && !!r.periode_au],
    ['contrats trouvés', r.nb_contrats > 0],
    ['lignes trouvées', r.lignes.length > 0],
    ['numéros de police présents', r.lignes.every(l => !!l.numero_police)],
    ['preneurs identifiés', r.lignes.every(l => !!l.client_nom)],
    ['total annoncé lu', r.total_annonce !== null],
    ['total recalculé = total annoncé', r.ecart === 0],
  ];
  const echecs = controles.filter(c => !c[1]).map(c => c[0]);
  return { ok: echecs.length === 0, echecs, resume: r };
}
