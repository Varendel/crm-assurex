// ═══ LE PIPELINE, RÉORGANISÉ (20.09.2026) ══════════════════════════════════════════════════════
// Demande de Jonathan : « est-ce que le pipeline est améliorable, vérifie la pertinence des infos,
// la cohérence générale, n'hésite pas à réorganiser ».
//
// Ce que j'ai trouvé en regardant les données avant de toucher au dessin — parce que redessiner
// un écran qui affiche des chiffres faux ne fait que mieux présenter le faux :
//
//   16 affaires en cours. Et :
//   — 9 sur 16 n'ont PAS DE MONTANT. Or l'écran annonçait « Pipeline total CHF 26 942 » sans dire
//     qu'il ne comptait que 7 affaires. Un total qui ignore la moitié de son objet et se présente
//     comme un total, c'est un chiffre faux.
//   — 9 sur 16 n'ont PAS DE PRODUIT. Les camemberts et les stats « par branche » étaient donc
//     calculés sur la moitié du pipeline, sans le dire non plus.
//   — 9 sur 16 sont ÉCHUES. C'est le vrai sujet de l'écran, et il n'apparaissait nulle part en tête.
//   — Une affaire en Négociation porte une prime de 252 et une commission estimée de 4 032.
//     Seize fois la prime : impossible. Personne ne l'avait vu parce que rien ne le cherchait.
//
// D'où la réorganisation :
//
// 1. LE PIPELINE D'ABORD. On traversait cinq blocs de chiffres avant de voir une seule affaire.
//    Le kanban remonte ; l'analyse descend dans un volet qu'on déplie quand on veut analyser.
// 2. QUATRE INDICATEURS, PAS HUIT, et ceux sur lesquels on agit : pondéré, à relancer, sans
//    montant, sans produit. « Gagnées : 8 » n'appelle aucune action, ça descend dans l'analyse.
// 3. CHAQUE CHIFFRE DIT SUR COMBIEN D'AFFAIRES IL PORTE. C'est la règle « jamais 0 sans être sûr »
//    déjà écrite dans ce code — elle était appliquée au calcul, pas à l'affichage.
// 4. LES INCOHÉRENCES SE SIGNALENT SEULES.

function plnEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function plnCHF(n) { return Number(Math.round(n || 0)).toLocaleString('fr-CH'); }

// dbxKpi passe sa valeur dans fmtCHF : un pourcentage écrit en toutes lettres y deviendrait NaN.
// Pour ces valeurs-là, on écrit la carte à la main, en gardant exactement la même structure.
function plnKpiTexte(label, valeur, sous) {
  return `<div class="dbx-kpi"><span class="dbx-kpi-label">${plnEsc(label)}</span>
    <span class="dbx-kpi-valeur">${plnEsc(valeur)}</span>
    <span class="dbx-kpi-bas"><span class="dbx-kpi-sous">${plnEsc(sous)}</span></span></div>`;
}

// Ce qui cloche, affaire par affaire. On ne corrige rien tout seul : on montre.
function plnAnomalies(opps) {
  const out = [];
  for (const o of opps) {
    const prime = Number(o.montant_potentiel || 0);
    const comm = Number(o.commission_estimee || 0);
    if (prime > 0 && comm > prime) {
      out.push({ o, quoi: `commission estimée (CHF ${plnCHF(comm)}) supérieure à la prime (CHF ${plnCHF(prime)})` });
    }
  }
  return out;
}

function plnDonnees() {
  const OPPS = allOpportunites.filter(o => o.stade !== 'Gagné' && o.stade !== 'Perdu');
  const auj = new Date().toISOString().slice(0, 10);
  const avecMontant = OPPS.filter(o => Number(o.montant_potentiel || 0) > 0);
  const avecProduit = OPPS.filter(o => Array.isArray(o.produits) && o.produits.length);
  const echues = OPPS.filter(o => o.date_echeance && o.date_echeance < auj);
  return {
    OPPS, auj, avecMontant, avecProduit, echues,
    gagnees: allOpportunites.filter(o => o.stade === 'Gagné'),
    perdues: allOpportunites.filter(o => o.stade === 'Perdu'),
    prime: avecMontant.reduce((s, o) => s + Number(o.montant_potentiel || 0), 0),
    pondere: OPPS.reduce((s, o) => s + Math.round(Number(o.montant_potentiel || 0) * Number(o.probabilite || 0) / 100), 0),
    commission: OPPS.reduce((s, o) => s + Number(o.commission_estimee || 0), 0),
    anomalies: plnAnomalies(OPPS),
  };
}

// On remplace viewOpportunites sans toucher aux quatre vues (kanban, liste, échéances, priorités) :
// elles restent celles de js/06, et n'importe laquelle peut évoluer sans repasser ici.
function viewOpportunites() {
  const rhMode = typeof estRoleRH === 'function' ? estRoleRH() : false;
  const stadeColor = { Contact: '#64748b', Analyse: '#38bdf8', Proposition: '#f59e0b', Négociation: '#a78bfa' };
  const stades = ['Contact', 'Analyse', 'Proposition', 'Négociation'];
  const tousLesStades = [...stades, 'Gagné', 'Perdu'];
  const D = plnDonnees();

  // Le « undefined Machin SA » vu en test : une société sans prénom passait par la branche
  // particulier. On joint ce qui existe au lieu d'interpoler ce qui peut manquer.
  const nomClient = o => {
    const c = allClients.find(cl => cl.id === o.client_id);
    if (c) return (typeof estEntreprise === 'function' && estEntreprise(c))
      ? c.nom : [c.prenom, c.nom].filter(Boolean).join(' ') || c.nom || '—';
    return o.prospect_nom ? `${o.prospect_nom} 🆕` : '—';
  };

  const vues = [
    { id: 'kanban', label: '📋 Kanban' }, { id: 'liste', label: '📃 Liste' },
    { id: 'echeances', label: '📅 Échéances' }, { id: 'priorites', label: '🎯 Priorités' },
  ].map(v => `<button class="tab-btn ${vueModePipeline === v.id ? 'active' : ''}"
      onclick="vueModePipeline='${v.id}';navigate('opportunites')">${v.label}</button>`).join('');

  let corps;
  if (vueModePipeline === 'liste') corps = renderListeOpportunites(D.OPPS, nomClient, tousLesStades, stadeColor, rhMode);
  else if (vueModePipeline === 'echeances') corps = renderEcheancesOpportunites(D.OPPS, nomClient, stadeColor, rhMode);
  else if (vueModePipeline === 'priorites') corps = renderPrioritesOpportunites(D.OPPS, nomClient, stadeColor, rhMode);
  else corps = renderKanbanOpportunites(D.OPPS, D.gagnees, D.perdues, stades, stadeColor, tousLesStades, nomClient, rhMode);

  // Un indicateur dit toujours sur combien d'affaires il porte quand il n'en couvre pas la totalité.
  const couverture = (n, total) => n === total ? `${total} affaire${total > 1 ? 's' : ''}` : `${n} affaire(s) renseignée(s) sur ${total}`;
  // dbxKpi ne connaît pas la notion de ton : on la lui ajoute en enveloppant sa sortie, plutôt que
  // de dupliquer sa structure ici — le jour où elle change, cet écran suit.
  const kpi = (o) => {
    const html = typeof dbxKpi === 'function' ? dbxKpi(o)
      : `<div class="dbx-kpi"><span class="dbx-kpi-label">${o.label}</span><span class="dbx-kpi-valeur">${o.prefixe || ''}${o.valeur}</span><span class="dbx-kpi-sous">${o.sous}</span></div>`;
    return o.ton ? html.replace('class="dbx-kpi', `class="${o.ton} dbx-kpi`) : html;
  };

  return `
  <div class="page-header">
    <h2>🚀 Pipeline — affaires en cours</h2>
    <p class="page-sub">${rhMode
      ? 'Vue d’ensemble des affaires en cours — lecture seule, sans montants.'
      : 'Les affaires avant signature. Une fois « Gagnée », l’opportunité ouvre le formulaire de contrat pré-rempli.'}</p>
  </div>

  <div class="pln-actions">
    <button class="btn-add" onclick="opportuniteEnEditionId=null;navigate('nouvelle-opportunite')">${rhMode ? PICTO_CREE_EQUIPE + ' Créer une opportunité pour Jonathan' : '+ Nouvelle opportunité'}</button>
    ${rhMode ? `<button class="btn-secondary" onclick="navigate('nouveau-rappel')">${PICTO_CREE_EQUIPE} Créer une tâche pour Jonathan</button>` : ''}
  </div>

  ${(() => {
    // Le haut du pipeline, en une ligne (21.09.2026) : « les encadrés au-dessus des opportunités
    // prennent trop de place ». Quatre cartes de chiffres et trois bandeaux d'alerte faisaient
    // descendre les affaires sous la ligne de flottaison. Les chiffres deviennent des pastilles ;
    // les alertes, des boutons qui se déplient à la demande. Rien n'est retiré.
    const sansMontant = D.OPPS.length - D.avecMontant.length;
    const sansAction = typeof paOuverte === 'function' && typeof prochaineAction === 'function'
      ? D.OPPS.filter(o => paOuverte(o) && !prochaineAction(o.id)).length : 0;
    const echuesHtml = typeof renderOppsEchuesBanner === 'function' ? renderOppsEchuesBanner(D.OPPS, nomClient) : '';
    const sansActionHtml = !rhMode && typeof bandeauSansProchaineAction === 'function' ? bandeauSansProchaineAction(D.OPPS, nomClient) : '';
    const anomaliesHtml = D.anomalies.length ? `<div class="pln-anomalies">
      <ul>${D.anomalies.map(a => `<li><button type="button" onclick="opportuniteEnEditionId='${a.o.id}';navigate('nouvelle-opportunite')">${plnEsc(a.o.titre || nomClient(a.o))}</button> — ${plnEsc(a.quoi)}</li>`).join('')}</ul>
      <small>Une commission ne peut pas dépasser la prime qui la produit. Corrige l’un ou l’autre sur la fiche.</small></div>` : '';
    const repli = (cle, ton, libelle, html) => html ? `<details class="pln-repli ${ton}" data-cle="${cle}"><summary>${libelle}</summary><div class="pln-repli-corps">${html}</div></details>` : '';
    return `<div class="pln-resume">
      ${rhMode ? '' : `<span class="pln-pastille"><small>Pondéré</small><b>CHF ${plnCHF(D.pondere)}</b></span>
      <span class="pln-pastille"><small>Commission potentielle</small><b>CHF ${plnCHF(D.commission)}</b><i>${plnEsc(couverture(D.OPPS.filter(o => Number(o.commission_estimee || 0) > 0).length, D.OPPS.length))}</i></span>
      ${sansMontant ? `<span class="pln-pastille alerte"><small>À compléter</small><b>${sansMontant}</b><i>sans montant</i></span>` : ''}`}
      ${repli('echues', 'danger', `⏰ ${D.echues.length} à relancer`, echuesHtml)}
      ${repli('action', 'alerte', `➜ ${sansAction} sans prochaine action`, sansActionHtml)}
      ${rhMode ? '' : repli('anomalies', 'alerte', `⚠️ ${D.anomalies.length} chiffre${D.anomalies.length > 1 ? 's' : ''} à vérifier`, anomaliesHtml)}
    </div>`;
  })()}

  <div class="tabs pln-tabs">${vues}</div>
  ${corps}

  ${rhMode ? '' : `<details class="pln-analyse">
    <summary>Analyse du pipeline — répartition, branches, gagnées et perdues</summary>
    <div class="pln-analyse-corps">
      <div class="pln-couverture">
        Ces chiffres portent sur <b>${D.avecProduit.length} affaire(s) sur ${D.OPPS.length}</b> :
        celles dont les produits sont renseignés. Les autres n’entrent dans aucun total — un chiffre
        incomplet qui ne le dit pas vaut moins que pas de chiffre.
      </div>
      <div class="dbx-kpis">
        ${kpi({ i: 1, label: 'Prime en jeu', valeur: D.prime, prefixe: 'CHF ', sous: couverture(D.avecMontant.length, D.OPPS.length) })}
        ${kpi({ i: 2, label: 'Gagnées', valeur: D.gagnees.length, sous: `CHF ${plnCHF(D.gagnees.reduce((s, o) => s + Number(o.montant_potentiel || 0), 0))} de prime` })}
        ${kpi({ i: 3, label: 'Perdues', valeur: D.perdues.length, sous: `CHF ${plnCHF(D.perdues.reduce((s, o) => s + Number(o.montant_potentiel || 0), 0))} de prime` })}
        ${plnKpiTexte('Taux de gain',
          (D.gagnees.length + D.perdues.length) ? Math.round(D.gagnees.length * 100 / (D.gagnees.length + D.perdues.length)) + ' %' : '—',
          `${D.gagnees.length} gagnées / ${D.perdues.length} perdues`)}
      </div>
      ${typeof renderStatsBranchesPipeline === 'function' ? renderStatsBranchesPipeline(D.OPPS) : ''}
      ${typeof renderCamembertsPipeline === 'function' ? renderCamembertsPipeline(D.OPPS) : ''}
    </div>
  </details>`}`;
}
