// ═══ COMMISSIONS : 12 MOIS DERRIÈRE, 6 DEVANT (20.09.2026) ═════════════════════════════════════
// Demande de Jonathan : voir les versements ATTENDUS sur le même graphique que les encaissements,
// sur 18 mois.
//
// C'est le bon réflexe, et ça change la nature de l'objet : un graphique qui ne montre que le
// passé se lit comme un bilan ; le même graphique prolongé de six mois devient un outil de
// décision — on y voit le creux arriver avant d'y être.
//
// Trois partis pris :
//
// 1. LA LIGNE D'AUJOURD'HUI EST TRACÉE. Sans elle, l'œil confond un encaissement et une prévision,
//    et le graphique ment par omission. Les barres à venir sont en plus hachurées et plus claires :
//    deux signaux valent mieux qu'un, et le second survit à une impression en noir et blanc.
//
// 2. LE MOIS COURANT PORTE LES DEUX. Ce qui est déjà tombé en septembre est du constaté ; ce qui
//    reste à tomber d'ici le 30 est de l'attendu. Les empiler dans la même colonne est la seule
//    façon honnête de montrer un mois en cours.
//
// 3. L'ÉCHÉANCIER VIENT DU MOTEUR DE TRÉSORERIE, pas d'un calcul refait ici. Si les deux écrans
//    divergeaient d'un franc, on ne saurait plus lequel croire.

const DBX18_PASSES = 12;   // mois courant inclus
const DBX18_AVENIR = 6;

function dbx18Mois() {
  const res = [];
  const d = new Date(); d.setDate(1);
  for (let i = DBX18_PASSES - 1; i >= -DBX18_AVENIR; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    res.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return res;
}

// Les versements attendus, mois par mois. Mêmes règles que le plan de trésorerie : profil de
// versement réel de la compagnie pour la gestion, création + délai observé pour l'acquisition.
function dbx18Attendu(mois) {
  const out = Object.fromEntries(mois.map(m => [m, 0]));
  const aujIso = new Date().toISOString().slice(0, 10);
  const CA = typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : [];
  const CT = typeof allContrats !== 'undefined' ? allContrats : [];

  for (const ca of CA) {
    if (!['en_attente', 'en_attente_naissance'].includes(ca.statut)) continue;
    const ct = ca.contrat_id ? CT.find(x => x.id === ca.contrat_id) : null;
    if (ct && (ct.commissionne === false || ct.statut === 'annulé')) continue;
    const reste = typeof commissionResteAttendu === 'function'
      ? commissionResteAttendu(ca) : Number(ca.montant_estime || 0);
    if (!reste) continue;

    let date = typeof commissionDatePrevue === 'function' ? commissionDatePrevue(ca) : null;
    if (!date) {
      const delai = typeof trDelaiMoyenAcquisition === 'function' ? trDelaiMoyenAcquisition() : 60;
      const b = new Date(((ca.date_creation || aujIso).slice(0, 10)) + 'T00:00:00');
      b.setDate(b.getDate() + delai);
      date = b.toISOString().slice(0, 10);
    }
    const parts = (ca.nature === 'gestion' && typeof commissionEcheancier === 'function')
      ? commissionEcheancier(ca, reste) : [{ date, montant: reste }];

    for (const pt of parts) {
      if (!pt.date) continue;
      // Ce qui est en retard n'est pas perdu : on le montre sur le mois courant, là où il pèse
      // vraiment sur la trésorerie, plutôt que sur un mois passé où il n'est jamais arrivé.
      const cle = pt.date < aujIso ? mois[DBX18_PASSES - 1] : pt.date.slice(0, 7);
      if (out[cle] != null) out[cle] += Number(pt.montant || 0);
    }
  }
  return out;
}

// Les encaissements constatés, mois par mois — mêmes règles que le tableau de bord : une date
// conventionnelle n'entre pas dans la courbe.
function dbx18Encaisse(mois) {
  const out = Object.fromEntries(mois.map(m => [m, 0]));
  const bascule = typeof DATE_BASCULE_ASSUREX !== 'undefined' ? DATE_BASCULE_ASSUREX : '2026-06-01';
  const CA = typeof allCommissionsAttente !== 'undefined' ? allCommissionsAttente : [];
  for (const ca of CA) {
    if (!['reçue', 'extourné'].includes(ca.statut)) continue;
    if (ca.date_reception_estimee) continue;
    const d = typeof commissionDateReception === 'function' ? commissionDateReception(ca) : ca.date_reception;
    if (!d || d < bascule) continue;
    const cle = String(d).slice(0, 7);
    if (out[cle] != null) out[cle] += (ca.statut === 'extourné' ? -1 : 1) * Number(ca.montant_final ?? ca.montant_estime ?? 0);
  }
  const tranches = typeof allCommissionTranches !== 'undefined' ? allCommissionTranches : [];
  for (const t of tranches) {
    const ca = CA.find(c => c.id === t.commission_id);
    if (!ca || ca.statut !== 'en_attente' || t.encaisse_par === 'oz' || !t.date_reception) continue;
    if (t.date_reception < bascule) continue;
    const cle = String(t.date_reception).slice(0, 7);
    if (out[cle] != null) out[cle] += Number(t.montant || 0);
  }
  return out;
}

function dbx18Barres() {
  const mois = dbx18Mois();
  const enc = dbx18Encaisse(mois);
  const att = dbx18Attendu(mois);
  const iCourant = DBX18_PASSES - 1;
  const max = Math.max(1, ...mois.map(m => Math.max(0, enc[m]) + Math.max(0, att[m])));
  const fmt = n => (typeof dbxCompact === 'function' ? dbxCompact(n) : Math.round(n));
  const lib = m => (typeof dbxLibelleMois === 'function' ? dbxLibelleMois(m) : m.slice(5));

  const totalEnc = mois.slice(0, iCourant + 1).reduce((s, m) => s + Math.max(0, enc[m]), 0);
  const totalAtt = mois.reduce((s, m) => s + Math.max(0, att[m]), 0);

  return `<div class="dbx18">
    <div class="dbx18-barres">
      ${mois.map((m, i) => {
        const e = Math.max(0, enc[m]), a = Math.max(0, att[m]), t = e + a;
        const h = Math.max(t ? 3 : 2, Math.round(t / max * 100));
        const avenir = i > iCourant;
        return `<div class="dbx18-col ${i === iCourant ? 'courant' : ''} ${avenir ? 'avenir' : ''}"
            title="${lib(m)} ${m.slice(0, 4)} — encaissé CHF ${fmt(e)} · attendu CHF ${fmt(a)}">
          <span class="dbx18-val">${t ? fmt(t) : ''}</span>
          <span class="dbx18-pile" style="--h:${h}%;--i:${i}">
            ${a ? `<i class="dbx18-att" style="flex:${a}"></i>` : ''}
            ${e ? `<i class="dbx18-enc" style="flex:${e}"></i>` : ''}
          </span>
          <span class="dbx18-mois">${lib(m)}</span>
        </div>`;
      }).join('')}
      <span class="dbx18-aujourdhui" style="--pos:${((iCourant + 1) / mois.length) * 100}%" aria-hidden="true"></span>
    </div>
    <div class="dbx18-legende">
      <span><i class="dbx18-pastille enc"></i>Encaissé — CHF ${fmt(totalEnc)} sur 12 mois</span>
      <span><i class="dbx18-pastille att"></i>Attendu — CHF ${fmt(totalAtt)} d’ici 6 mois</span>
      <span class="dbx18-note">Le trait marque aujourd’hui. À sa droite, ce sont des prévisions :
        elles reposent sur les conventions de commissionnement et les rythmes de versement observés,
        et n’engagent pas les compagnies.</span>
    </div>
  </div>`;
}
