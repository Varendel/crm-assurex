// ═══ AUTOTESTS DES CALCULS (19.09.2026) ═════════════════════════════════════════════════════
// Vérifie en quelques millisecondes, sur des données FICTIVES (les données réelles sont mises de
// côté puis restaurées), que les règles de calcul des commissions donnent toujours le résultat
// attendu : dates prévues par compagnie, fractionnement des primes, droit HOTELA, période d'une
// ligne du compte courant OZ, taux appris, fourchette de trésorerie, ventes de l'année.
// Lancement : Cockpit financier → Contrôle → « Lancer les autotests », ou rexAutotests() en console.

function rexAutotests() {
  const sauve = { allContrats, allClients, allCommissionsAttente, allCommissionTranches: typeof allCommissionTranches !== 'undefined' ? allCommissionTranches : [] };
  const res = [];
  const ok = (nom, cond, detail) => res.push({ nom, ok: !!cond, detail: cond ? '' : String(detail ?? '') });
  const eq = (nom, obtenu, attendu) => ok(nom, JSON.stringify(obtenu) === JSON.stringify(attendu), `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
  try {
    allClients = [{ id: 'c-oz', nom: 'Client OZ', source_oz: true }, { id: 'c-ax', nom: 'Client Assurex' }];
    allContrats = [
      { id: 'k-vd', client_id: 'c-ax', compagnie: 'La Vaudoise', produit: 'LAA', statut: 'actif', prime_annuelle: 10000, periodicite: 4, date_echeance: '2026-12-31' },
      { id: 'k-sl', client_id: 'c-ax', compagnie: 'Swiss Life', produit: 'LPP collective (2e pilier entreprise)', statut: 'actif', prime_annuelle: 5000, periodicite: 12 },
      { id: 'k-ho', client_id: 'c-ax', compagnie: 'HOTELA', produit: 'LAA', statut: 'actif', prime_annuelle: 5000, date_debut: '2014-01-01' },
      { id: 'k-hv', client_id: 'c-ax', compagnie: 'Helvetia', produit: 'RC entreprise / exploitation', statut: 'actif', prime_annuelle: 1000 },
      { id: 'k-m1', client_id: 'c-ax', compagnie: 'La Mobilière', produit: 'RC entreprise / exploitation', statut: 'actif', prime_annuelle: 1000, date_signature: '2026-07-10' },
      { id: 'k-m2', client_id: 'c-ax', compagnie: 'La Mobilière', produit: 'RC entreprise / exploitation', statut: 'actif', prime_annuelle: 2000, date_signature: '2026-08-10' },
    ];
    allCommissionsAttente = [
      { id: 'ca-m1', contrat_id: 'k-m1', compagnie: 'La Mobilière', produit: 'RC entreprise / exploitation', nature: 'acquisition', statut: 'reçue', montant_estime: 100, montant_final: 150 },
      { id: 'ca-m2', contrat_id: 'k-m2', compagnie: 'La Mobilière', produit: 'RC entreprise / exploitation', nature: 'acquisition', statut: 'versé_oz', montant_estime: 200, montant_final: 320 },
    ];
    allCommissionTranches = [];

    // 1. Dates prévues : profils réels par compagnie
    if (typeof commissionDatePrevue === 'function') {
      eq('Vaudoise : renouvellement 01.01 → +37 j', commissionDatePrevue({ nature: 'gestion', compagnie: 'La Vaudoise', contrat_id: 'k-vd', date_creation: '2027-01-01', detail_calcul: '[gestion annuelle]' }), '2027-02-07');
      eq('Générique : renouvellement → fin du 2e mois', commissionDatePrevue({ nature: 'gestion', compagnie: 'Helvetia', contrat_id: 'k-hv', date_creation: '2027-01-01', detail_calcul: '[gestion annuelle]' }), '2027-02-28');
      eq('HOTELA : droit dès le 01.01.2027 → fin novembre 2027', commissionDatePrevue({ nature: 'gestion', compagnie: 'HOTELA', contrat_id: 'k-ho', date_creation: '2026-07-27', detail_calcul: '' }), '2027-11-30');
      eq('Acquisition : pas de date prévue par la règle de gestion', commissionDatePrevue({ nature: 'acquisition', compagnie: 'AXA', date_creation: '2026-09-01' }), null);
    }
    // 2. Fractionnement
    if (typeof commissionEcheancier === 'function') {
      const e1 = commissionEcheancier({ id: 'x', nature: 'gestion', compagnie: 'La Vaudoise', contrat_id: 'k-vd', date_creation: '2027-01-01', detail_calcul: '[gestion annuelle]', montant_estime: 1000 }, 1000);
      eq('Vaudoise trimestriel : 4 versements', e1.map(x => x.date), ['2027-02-07', '2027-05-08', '2027-08-07', '2027-11-07']);
      eq('Vaudoise trimestriel : somme exacte', Math.round(e1.reduce((s, x) => s + x.montant, 0) * 100) / 100, 1000);
      const e2 = commissionEcheancier({ id: 'y', nature: 'gestion', compagnie: 'Swiss Life', contrat_id: 'k-sl', date_creation: '2027-01-01', detail_calcul: '[gestion annuelle]', montant_estime: 126.8 }, 126.8);
      eq('Swiss Life : toujours 4 versements (même si prime mensuelle)', e2.length, 4);
      const e3 = commissionEcheancier({ id: 'z', nature: 'gestion', compagnie: 'La Vaudoise', contrat_id: 'k-vd', date_creation: '2027-01-01', detail_calcul: '[gestion annuelle]', montant_estime: 1000 }, 250);
      eq('Déjà reçu 3/4 → reste sur le dernier trimestre', e3.map(x => [x.date, x.montant]), [['2027-11-07', 250]]);
    }
    // 3. Période d'une ligne du compte courant OZ
    if (typeof ozPeriodeLigne === 'function') {
      eq('OZ : période écrite dans le libellé', ozPeriodeLigne({ type_mouvement: 'Commission gestion 01.01.25 - 31.12.25', date_mouvement: '2026-02-02' }), 2025);
      eq('OZ : gestion payée en février → année précédente', ozPeriodeLigne({ type_mouvement: 'commission de gestion', date_mouvement: '2026-02-02' }), 2025);
      eq('OZ : acquisition → année du versement', ozPeriodeLigne({ type_mouvement: "Commission d'acquisition", date_mouvement: '2026-01-05' }), 2026);
    }
    // 4. Taux appris
    if (typeof tauxCommissionAppris === 'function') {
      const t = tauxCommissionAppris('La Mobilière', 'RC entreprise / exploitation', 'acquisition');
      eq('Taux appris : médiane de 15 % et 16 %', t && Math.round(t.taux * 1000) / 1000, 0.155);
      eq('Taux appris : rien sans données', tauxCommissionAppris('Zurich', 'Assurance animalière', 'acquisition'), null);
    }
    // 5. Fourchette de trésorerie (écart médian mesuré, bornes 5–50 %, 20 % si < 5 comparaisons)
    if (typeof trIncertitude === 'function') {
      eq('Fourchette : 20 % par prudence avec 2 comparaisons', trIncertitude().taux, 0.2);
    }
    // 6. Ventes de l'année (objectifs)
    if (typeof objVentes === 'function') {
      const v = objVentes('2026');
      eq('Ventes 2026 : 2 affaires', v.nb, 2);
      eq('Ventes 2026 : acquisitions réelles 150 + 320', Math.round(v.acquisition), 470);
    }
    // 6b. Archive OZ : bascule automatique le 01.01.2027
    if (typeof ozArchive === 'function') {
      const f = window._ozArchiveForce; delete window._ozArchiveForce;
      const auj = new Date(); const iso = `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}-${String(auj.getDate()).padStart(2, '0')}`;
      eq('Archive OZ : active dès le 01.01.2027 seulement', ozArchive(), iso >= '2027-01-01');
      window._ozArchiveForce = true; eq('Archive OZ : prévisualisation forcée', ozArchive(), true);
      if (f === undefined) delete window._ozArchiveForce; else window._ozArchiveForce = f;
    }
    // 7. Doublons compte courant : une ligne déjà déduite n'est plus proposée
    if (typeof ozPropositionsCompteCourant === 'function' && window._ck) {
      const sauveLedger = window._ck.ozLedger;
      allContrats.push({ id: 'k-ax', client_id: 'c-ax', compagnie: 'AXA', produit: 'RC', numero_police: '12345678', statut: 'actif', prime_annuelle: 1000 });
      allCommissionsAttente.push({ id: 'ca-ax', contrat_id: 'k-ax', compagnie: 'AXA', nature: 'acquisition', statut: 'en_attente', montant_estime: 100, date_creation: '2026-07-01' });
      window._ck.ozLedger = [{ id: '00000000-0000-0000-0000-000000000001', police: '12 345 678', compagnie: 'AXA', type_mouvement: "Commission d'acquisition", credit: 60, debit: 0, date_mouvement: '2026-08-01' }];
      eq('Rapprochement OZ : ligne proposée', ozPropositionsCompteCourant().length, 1);
      allCommissionTranches = [{ commission_id: 'ca-ax', montant: 60, note: '[oz:00000000-0000-0000-0000-000000000001]' }];
      eq('Rapprochement OZ : jamais deux fois la même ligne', ozPropositionsCompteCourant().length, 0);
      window._ck.ozLedger = sauveLedger;
    }
  } catch (e) {
    res.push({ nom: 'Exception pendant les tests', ok: false, detail: e.message });
  } finally {
    allContrats = sauve.allContrats; allClients = sauve.allClients; allCommissionsAttente = sauve.allCommissionsAttente; allCommissionTranches = sauve.allCommissionTranches;
  }
  const echecs = res.filter(r => !r.ok);
  console.table(res);
  return { total: res.length, reussis: res.length - echecs.length, echecs };
}

function ckLancerAutotests() {
  const r = rexAutotests();
  const zone = document.getElementById('ck-autotests');
  const txt = r.echecs.length
    ? `<b style="color:#DC2626">✗ ${r.echecs.length} test(s) en échec sur ${r.total}</b><ul style="margin:6px 0 0 18px">${r.echecs.map(e => `<li>${e.nom} — ${String(e.detail).replace(/</g, '&lt;')}</li>`).join('')}</ul>`
    : `<b style="color:#16A34A">✓ ${r.total} tests réussis</b> — dates prévues, fractionnement, HOTELA, compte courant OZ, taux appris, fourchette, ventes.`;
  if (zone) zone.innerHTML = txt; else showError(r.echecs.length ? `✗ ${r.echecs.length} test(s) en échec` : `✓ ${r.total} tests réussis`);
}
