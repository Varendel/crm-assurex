// ═══ PRÉVISION DES COMMISSIONS (règle de Jonathan, 19.09.2026) ══════════════════════════════════
// Commission de GESTION : attendue dans les 3 mois qui suivent la signature du contrat, pour
// toutes les compagnies — sauf celles qui ne versent qu'une fois par an (HOTELA, Gastrosocial).
// Les commissions d'acquisition n'ont pas (encore) de règle.

const PREVISION_GESTION_DELAI_MOIS = 3;
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

function _prevIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// Point de départ : date de signature du contrat. À défaut, la plus récente entre sa date de début
// et la création de la commission — un contrat repris en gestion (début en 2019, commission créée
// en 07.2026) part de la reprise, pas de 2019.
function commissionDateDepart(ca) {
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
  return `<div style="font-size:10.5px;color:${couleur};margin-top:2px" title="Commission de gestion : attendue ${commissionVersementAnnuel(ca) ? '1× par an' : `dans les ${PREVISION_GESTION_DELAI_MOIS} mois après la signature`}">${retard > 0 ? `⚠ prévue le ${fmtDate(p)} (${retard} j de retard)` : `prévue le ${fmtDate(p)}`}${annuel}</div>`;
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
    const montant = Number(ca.montant_estime || 0);
    if (p < _prevIso(auj)) { res.retard.total += montant; res.retard.nb++; return; }
    const cible = res.mois.find(x => x.cle === p.slice(0, 7));
    if (cible) { cible.total += montant; cible.nb++; }
  });
  return res;
}
