// ═══ PRÉVISION DES COMMISSIONS (règle de Jonathan, 19.09.2026) ══════════════════════════════════
// Commission de GESTION : attendue dans les 3 mois qui suivent la signature du contrat, pour
// toutes les compagnies — sauf celles qui ne versent qu'une fois par an (HOTELA, Gastrosocial).
// Les commissions d'acquisition n'ont pas (encore) de règle.

const PREVISION_GESTION_DELAI_MOIS = 3;
// Renouvellement : commission sur le décompte de fin du 2e mois après l'échéance (01.01 → fin février)
const PREVISION_GESTION_RENOUVELLEMENT_MOIS = 1;

// Prime fractionnée (contrats.periodicite = nombre de paiements par an : 1, 2, 4, 12) : la commission
// d'encaissement suit chaque paiement du client → la commission annuelle est répartie en autant de
// versements, espacés de 12 / périodicité mois à partir de la première date prévue.
// ── Profils de versement RÉELS par compagnie (affinés le 19.09.2026 sur les dates du compte
//    courant OZ et du relevé BCV) : décalage entre le début de la période couverte (échéance /
//    fraction de prime) et l'arrivée de l'argent sur le compte, et rythme imposé par la compagnie.
//    - Vaudoise : commission d'encaissement versée au fil des primes (facturées 1-2 mois avant la
//      période), décompte fin de mois, virement ~5-7 du mois suivant → +37 j en moyenne (13 versements) ;
//    - AXA : commission B versée au paiement du client, bordereau mensuel, virement ~10 → +40 j ;
//    - Swiss Life (LPP) : commission courante trimestrielle, décompte le 2e mois du trimestre,
//      virement début du mois suivant → +65 j (4 versements), toujours 4× par an ;
//    - Nest : courtage trimestriel à terme échu → +95 j, 4× par an.
//    Sans profil : règles génériques (+3 mois après signature, fin du 2e mois après l'échéance).
const PREVISION_PROFILS_COMPAGNIE = {
  'La Vaudoise': { decalageJours: 37 },
  'AXA': { decalageJours: 40 },
  'Swiss Life': { decalageJours: 65, periodicite: 4 },
  'Nest': { decalageJours: 95, periodicite: 4 },
};
function profilVersementCompagnie(ca) {
  const nom = (typeof normaliserCompagnie === 'function' ? normaliserCompagnie(ca.compagnie || '') : (ca.compagnie || '')) || '';
  const n = nom.toLowerCase();
  const cle = Object.keys(PREVISION_PROFILS_COMPAGNIE).find(k => n === k.toLowerCase() || n.includes(k.toLowerCase().replace(/^la /, '')));
  return cle ? PREVISION_PROFILS_COMPAGNIE[cle] : null;
}
function _prevAjouterJours(iso, j) { const [y, m, d] = iso.split('-').map(Number); return _prevIso(new Date(y, m - 1, d + j)); }

function commissionEcheancier(ca, montant) {
  const p = commissionDatePrevue(ca);
  if (!p) return [];
  const ct = ca.contrat_id && typeof allContrats !== 'undefined' ? allContrats.find(x => x.id === ca.contrat_id) : null;
  const profil = profilVersementCompagnie(ca);
  const n = _prevDateAnnuelle(ca) ? 1
    : (profil && profil.periodicite) ? profil.periodicite
    : (ct && [2, 4, 12].includes(Number(ct.periodicite)) ? Number(ct.periodicite) : 1);
  if (n === 1) return [{ date: p, montant }];
  const [y, m, d] = p.split('-').map(Number);
  const part = Math.round(montant / n * 100) / 100;
  const finDeMois = d === new Date(y, m, 0).getDate(); // renouvellement : fin de mois → reste en fin de mois
  return Array.from({ length: n }, (_, i) => {
    const dernier = new Date(y, m - 1 + i * (12 / n) + 1, 0).getDate();
    return { date: _prevIso(new Date(y, m - 1 + i * (12 / n), finDeMois ? dernier : Math.min(d, dernier))), montant: i === n - 1 ? Math.round((montant - part * (n - 1)) * 100) / 100 : part };
  });
}
// Compagnies qui versent la gestion 1× par an (clé = nom renvoyé par normaliserCompagnie), avec
// la date de versement habituelle — indication de Jonathan du 19.09.2026, à confirmer :
// HOTELA vers fin novembre, Gastrosocial vers fin avril. Prochaine échéance après la signature.
const PREVISION_GESTION_ANNUELLE_DATES = { 'HOTELA': { mois: 11, jour: 30 }, 'Gastrosocial': { mois: 4, jour: 30 } };
const PREVISION_GESTION_ANNUELLE = Object.keys(PREVISION_GESTION_ANNUELLE_DATES);
function _prevDateAnnuelle(ca) {
  const nom = typeof normaliserCompagnie === 'function' ? normaliserCompagnie(ca.compagnie || '') : (ca.compagnie || '');
  const cle = PREVISION_GESTION_ANNUELLE.find(c => c.toLowerCase() === (nom || '').toLowerCase());
  return cle ? PREVISION_GESTION_ANNUELLE_DATES[cle] : null;
}

// Dès le 01.01.2027, TOUS les mandats de gestion passent en production Assurex (règle générale,
// Jonathan le 19.09.2026). Jusque-là, la gestion des clients OZ Assure est encaissée par OZ : elle
// ne doit pas compter dans la trésorerie / les prévisions d'encaissement d'Assurex.
const DATE_GESTION_ASSUREX = '2027-01-01';
function commissionGestionEncaisseeParOZ(ca, dateEncaissement) {
  if (!ca || ca.nature !== 'gestion') return false;
  const d = (dateEncaissement || '').slice(0, 10);
  if (d && d >= DATE_GESTION_ASSUREX) return false;
  const cl = ca.client_id && typeof allClients !== 'undefined' ? allClients.find(x => x.id === ca.client_id) : null;
  return !!(cl && cl.source_oz);
}

// ── Versements partiels (commission_tranches) — conventions de paiement échelonné (ex. AGV TONI SA,
//    commission annuelle payée mensuellement) : ce qui est déjà reçu est déduit de l'attendu. ──
function commissionTranches(ca) {
  return (typeof allCommissionTranches !== 'undefined' ? allCommissionTranches : []).filter(t => t.commission_id === ca.id);
}
function commissionDejaRecu(ca) { return commissionTranches(ca).reduce((s, t) => s + Number(t.montant || 0), 0); }
function commissionResteAttendu(ca) { return Math.max(0, Math.round((Number(ca.montant_estime || 0) - commissionDejaRecu(ca)) * 100) / 100); }

function _prevIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// Point de départ : date de signature du contrat. À défaut, la plus récente entre sa date de début
// et la création de la commission — un contrat repris en gestion (début en 2019, commission créée
// en 07.2026) part de la reprise, pas de 2019.
function commissionDateDepart(ca) {
  // Gestion des années suivantes : elle part de l'échéance de facturation (date_creation), pas de la signature
  if (/\[gestion annuelle\]/.test(ca.detail_calcul || '') && ca.date_creation) return ca.date_creation.slice(0, 10);
  const ct = ca.contrat_id ? allContrats.find(x => x.id === ca.contrat_id) : null;
  if (ct && ct.date_signature) return ct.date_signature.slice(0, 10);
  const dates = [ct && ct.date_debut, ca.date_creation].filter(Boolean).map(d => d.slice(0, 10)).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

function commissionVersementAnnuel(ca) {
  const nom = typeof normaliserCompagnie === 'function' ? normaliserCompagnie(ca.compagnie || '') : (ca.compagnie || '');
  return PREVISION_GESTION_ANNUELLE.some(c => c.toLowerCase() === (nom || '').toLowerCase());
}

// Date d'encaissement attendue (AAAA-MM-JJ) ou null si aucune règle ne s'applique
function commissionDatePrevue(ca) {
  if (!ca || ca.nature !== 'gestion') return null;
  const depart = commissionDateDepart(ca);
  if (!depart) return null;
  const [y, m, d] = depart.split('-').map(Number);
  const annuel = _prevDateAnnuelle(ca);
  if (annuel) {
    let annee = y;
    const cible = () => `${annee}-${String(annuel.mois).padStart(2, '0')}-${String(annuel.jour).padStart(2, '0')}`;
    if (cible() < depart) annee++;
    return cible();
  }
  // Renouvellement (échéance de facturation) : la prime part en novembre-décembre, le client paie au
  // plus tard à la fin du mois qui suit l'échéance, la commission arrive sur le décompte suivant →
  // fin du 2e mois après l'échéance (01.01 → fin février). Règle de Jonathan, 19.09.2026.
  const profil = profilVersementCompagnie(ca);
  if (/\[gestion annuelle\]/.test(ca.detail_calcul || '')) {
    if (profil) return _prevAjouterJours(depart, profil.decalageJours); // délai réel observé chez cette compagnie
    return _prevIso(new Date(y, m - 1 + PREVISION_GESTION_RENOUVELLEMENT_MOIS + 1, 0));
  }
  // Nouvelle signature avec profil connu : ~1 mois pour la première facture, puis délai réel de la compagnie
  if (profil) return _prevAjouterJours(depart, 30 + profil.decalageJours);
  // Nouvelle signature : facture dans les semaines qui suivent, paiement à 1-2 mois, puis décompte →
  // + 3 mois en restant sur le dernier jour du mois si besoin (30.11 + 3 mois = 28/29.02)
  const dernier = new Date(y, m - 1 + PREVISION_GESTION_DELAI_MOIS + 1, 0).getDate();
  return _prevIso(new Date(y, m - 1 + PREVISION_GESTION_DELAI_MOIS, Math.min(d, dernier)));
}

// Jours de retard par rapport à la date prévue (> 0 = en retard), null sans prévision
function commissionJoursRetard(ca) {
  const p = commissionDatePrevue(ca);
  if (!p || ca.statut !== 'en_attente') return null;
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const [y, m, d] = p.split('-').map(Number);
  return Math.round((auj - new Date(y, m - 1, d)) / 86400000);
}

// Petit libellé HTML « Prévue le … » (rouge si dépassée), pour les listes
function htmlCommissionPrevue(ca) {
  const p = commissionDatePrevue(ca);
  if (!p || ca.statut !== 'en_attente') return '';
  const retard = commissionJoursRetard(ca);
  const annuel = commissionVersementAnnuel(ca) ? ' · versement annuel' : '';
  const couleur = retard > 0 ? '#EF4444' : retard > -15 ? '#F59E0B' : 'var(--text-dim)';
  const profil = profilVersementCompagnie(ca);
  return `<div style="font-size:10.5px;color:${couleur};margin-top:2px" title="Commission de gestion : attendue ${commissionVersementAnnuel(ca) ? '1× par an' : profil ? `environ ${profil.decalageJours} jours après le début de la période (délai réel observé chez cette compagnie${profil.periodicite ? `, ${profil.periodicite} versements par an` : ''})` : `dans les ${PREVISION_GESTION_DELAI_MOIS} mois après la signature`}">${retard > 0 ? `⚠ prévue le ${fmtDate(p)} (${retard} j de retard)` : `prévue le ${fmtDate(p)}`}${annuel}</div>`;
}

// Encaissements de gestion attendus : en retard + chacun des N prochains mois
function previsionGestionParMois(nbMois) {
  const auj = new Date();
  const mois = [];
  for (let i = 0; i < nbMois; i++) { const d = new Date(auj.getFullYear(), auj.getMonth() + i, 1); mois.push(_prevIso(d).slice(0, 7)); }
  const res = { retard: { total: 0, nb: 0 }, mois: mois.map(m => ({ cle: m, total: 0, nb: 0 })) };
  allCommissionsAttente.filter(ca => ca.statut === 'en_attente').forEach(ca => {
    const ct = ca.contrat_id ? allContrats.find(x => x.id === ca.contrat_id) : null;
    if (ct && (ct.commissionne === false || ct.statut === 'annulé')) return;
    const p = commissionDatePrevue(ca);
    if (!p) return;
    if (commissionGestionEncaisseeParOZ(ca, p)) return; // encaissée par OZ jusqu'au 31.12.2026
    const montant = typeof commissionResteAttendu === 'function' ? commissionResteAttendu(ca) : Number(ca.montant_estime || 0); // reste après versements partiels
    commissionEcheancier(ca, montant).forEach(pt => {
      if (pt.date < _prevIso(auj)) { res.retard.total += pt.montant; res.retard.nb++; return; }
      const cible = res.mois.find(x => x.cle === pt.date.slice(0, 7));
      if (cible) { cible.total += pt.montant; cible.nb++; }
    });
  });
  return res;
}

// ═══ GESTION ANNUELLE (19.09.2026) ══════════════════════════════════════════════════════════
// La commission de gestion est reversée CHAQUE ANNÉE, sur la prime facturée au client à l'échéance
// (ex. Vaudoise : prorata la 1re année, puis prime complète dès le 01.01 suivant). Le CRM ne créait
// qu'une seule commission de gestion par contrat. Désormais, à l'approche de chaque échéance de
// facturation (45 jours avant), la commission de l'année suivante est créée « en attente » :
//   - uniquement pour les contrats actifs qui ont déjà eu une commission de gestion ;
//   - jamais s'il en reste une en attente (pas de doublon) ;
//   - montant = prime annuelle × taux de gestion constaté (décompte) ou estimé précédemment.
const GESTION_ANNUELLE_AVANCE_JOURS = 45;

// Échéance de facturation annuelle (MM-JJ) : lendemain de la date d'échéance du contrat
// (31.12 → 01.01), à défaut l'anniversaire de sa date de début
function echeanceFacturationMMJJ(ct) {
  if (ct.date_echeance) {
    const d = new Date(ct.date_echeance.slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + 1);
    return _prevIso(d).slice(5);
  }
  return ct.date_debut ? ct.date_debut.slice(5, 10) : null;
}

// Première échéance de facturation strictement postérieure à une date (AAAA-MM-JJ)
function prochaineEcheanceFacturation(ct, apres) {
  const mmjj = echeanceFacturationMMJJ(ct);
  if (!mmjj || !apres) return null;
  let an = Number(apres.slice(0, 4));
  let d = `${an}-${mmjj}`;
  if (d <= apres) d = `${an + 1}-${mmjj}`;
  return d.endsWith('-02-29') && new Date(Number(d.slice(0, 4)), 1, 29).getMonth() !== 1 ? d.slice(0, 5) + '03-01' : d;
}

function tauxGestionConnu(ca, prime) {
  const m = String(ca.detail_calcul || '').match(/([\d]+(?:[.,]\d+)?)\s*%/);
  if (m) { const t = parseFloat(m[1].replace(',', '.')); if (t > 0 && t < 40) return t / 100; }
  const est = Number(ca.montant_estime || 0);
  return prime > 0 && est > 0 && est / prime < 0.4 ? est / prime : null;
}

async function assurerGestionAnnuelle() {
  if (typeof estRoleRH === 'function' && estRoleRH()) return 0;
  const auj = _prevIso(new Date());
  const limite = _prevIso(new Date(Date.now() + GESTION_ANNUELLE_AVANCE_JOURS * 86400000));
  let crees = 0;
  for (const ct of allContrats) {
    if (ct.commissionne === false || !['actif', 'renouveler'].includes(ct.statut)) continue;
    const prime = Number(ct.prime_annuelle || 0);
    if (!prime) continue;
    const gs = allCommissionsAttente.filter(c => c.contrat_id === ct.id && c.nature === 'gestion' && c.statut !== 'annulée');
    if (!gs.length || gs.some(c => c.statut === 'en_attente' || c.statut === 'en_attente_naissance')) continue;
    const derniere = gs.slice().sort((a, b) => String(a.date_creation || '').localeCompare(String(b.date_creation || ''))).pop();
    const depuis = (derniere.date_creation || ct.date_debut || '').slice(0, 10);
    let echeance = prochaineEcheanceFacturation(ct, depuis);
    // Échéances anciennes (historique repris) : on ne recrée pas le passé, on part de l'échéance récente
    const plancher = _prevIso(new Date(Date.now() - 120 * 86400000));
    let garde = 0;
    while (echeance && echeance < plancher && garde++ < 30) echeance = prochaineEcheanceFacturation(ct, echeance);
    if (!echeance || echeance > limite) continue;
    const taux = gs.map(c => tauxGestionConnu(c, prime)).find(t => t !== null);
    if (!taux) continue;
    const montant = Math.round(prime * taux * 100) / 100;
    const cl = allClients.find(c => c.id === ct.client_id);
    const body = {
      client_id: ct.client_id, contrat_id: ct.id,
      client_nom: cl ? (estEntreprise(cl) ? cl.nom : `${cl.prenom || ''} ${cl.nom || ''}`.trim()) : null,
      compagnie: ct.compagnie, produit: ct.produit, nature: 'gestion',
      montant_estime: montant, statut: 'en_attente', date_creation: echeance,
      detail_calcul: `[gestion annuelle] Échéance de facturation du ${echeance.split('-').reverse().join('.')} — ${(Math.round(taux * 1000) / 10).toString().replace('.', ',')} % × prime annuelle CHF ${prime}`,
    };
    const r = await dbPost('commissions_attente', body);
    if (r && !r.error && r[0]) { allCommissionsAttente.push(r[0]); crees++; }
  }
  if (crees && typeof logAction === 'function') logAction('gestion_annuelle', 'commissions_attente', null, `${crees} commission(s) de gestion annuelle créée(s) (échéances jusqu'au ${limite.split('-').reverse().join('.')})`);
  return crees;
}

// Projection des commissions de gestion RÉCURRENTES sur un horizon (trésorerie, cockpit) : pour chaque
// contrat actif dont le taux de gestion est connu, les échéances de facturation à venir qui n'ont pas
// encore de commission dans le CRM sont projetées (prime annuelle × taux), encaissement 3 mois après
// l'échéance (ou à la date annuelle HOTELA / Gastrosocial). Rien n'est enregistré : c'est une prévision.
function projectionGestionRecurrente(jusquA) {
  const res = [];
  const auj = _prevIso(new Date());
  for (const ct of allContrats) {
    if (ct.commissionne === false || !['actif', 'renouveler'].includes(ct.statut)) continue;
    const prime = Number(ct.prime_annuelle || 0);
    if (!prime) continue;
    const gs = allCommissionsAttente.filter(c => c.contrat_id === ct.id && c.nature === 'gestion' && c.statut !== 'annulée');
    if (!gs.length) continue;
    const taux = gs.map(c => tauxGestionConnu(c, prime)).find(t => t !== null);
    if (!taux) continue;
    // Dernière période déjà couverte par une commission (en attente ou encaissée)
    let depuis = gs.map(c => (c.date_creation || '').slice(0, 10)).filter(Boolean).sort().pop() || ct.date_debut;
    if (!depuis) continue;
    let garde = 0;
    let ech = prochaineEcheanceFacturation(ct, depuis);
    while (ech && garde++ < 20) {
      const fictive = { nature: 'gestion', compagnie: ct.compagnie, client_id: ct.client_id, contrat_id: ct.id, date_creation: ech, detail_calcul: '[gestion annuelle]', statut: 'en_attente' };
      const prevue = commissionDatePrevue(fictive);
      if (!prevue || prevue > jusquA) break;
      if (!commissionGestionEncaisseeParOZ(fictive, prevue)) {
        // Prime fractionnée : un versement de commission par paiement du client
        commissionEcheancier(fictive, Math.round(prime * taux * 100) / 100).forEach(pt => {
          if (pt.date >= auj && pt.date <= jusquA) res.push({ contrat: ct, echeance: ech, date: pt.date, montant: pt.montant, taux });
        });
      }
      ech = prochaineEcheanceFacturation(ct, ech);
    }
  }
  return res;
}