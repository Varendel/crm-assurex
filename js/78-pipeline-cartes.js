// ═══ LES CARTES DU PIPELINE, REDESSINÉES (20.09.2026) ══════════════════════════════════════════
// Ce que faisait la carte : onze informations empilées, toutes alignées à gauche, toutes de la
// même importance apparente. Le client était écrit plus gros que l'affaire ; le montant était
// orange — exactement la couleur du stade « Proposition », donc on croyait y lire une alerte ; une
// barre de progression pleine largeur affichait une probabilité qu'un « 60 % » répétait juste en
// dessous ; et deux boutons d'action s'affichaient sur CHAQUE carte, soit quatorze contrôles à
// l'écran dans une colonne de sept.
//
// Ce qui change :
//
// 1. UNE HIÉRARCHIE. Le client en tête, l'affaire dessous en gris, le montant à droite en chiffres
//    tabulaires — donc alignés d'une carte à l'autre, ce qui permet de comparer une colonne d'un
//    coup d'œil. Le montant est de l'encre, pas une alerte : il perd son orange.
//
// 2. « CHF 0 » DISPARAÎT QUAND ON NE SAIT PAS. Neuf affaires sur seize n'ont pas de montant, et la
//    carte affirmait « CHF 0 ». Zéro est une valeur ; inconnu n'en est pas une. On écrit « montant
//    à estimer », et la carte porte un liseré pointillé.
//
// 3. LA PROBABILITÉ DEVIENT UN ANNEAU de 30 px au lieu d'une barre pleine largeur doublée d'un
//    pourcentage. Même information, un dixième de la place.
//
// 4. L'ÂGE APPARAÎT. C'est le signal le plus important d'un pipeline — une affaire qui dort — et
//    il ne figurait nulle part. Discret jusqu'à 21 jours, ambre ensuite, rouge au-delà de 45.
//
// 5. LES ACTIONS AU SURVOL, comme partout ailleurs depuis js/71.
//
// Le glisser-déposer, les offres multi-compagnies et les zones Gagné/Perdu continuent de marcher :
// on garde scrupuleusement les mêmes classes et attributs (.kanban-card, data-opp-id, data-stade,
// .opp-offres), c'est par eux que js/16 s'accroche.

const PLC_AGE_TIEDE = 21;   // jours avant de signaler
const PLC_AGE_FROID = 45;   // jours avant d'alerter

function plcEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function plcAge(o) {
  const d = (o.created_at || '').slice(0, 10);
  if (!d) return null;
  return Math.max(0, Math.round((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000));
}

// L'anneau de probabilité : un cercle dont on découvre une portion. Deux traits, pas une image —
// il doit se dessiner à l'instant et suivre la couleur du stade.
function plcAnneau(pct, couleur) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const r = 13, c = 2 * Math.PI * r;
  return `<span class="plc-anneau" title="Probabilité : ${p} %">
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <circle cx="16" cy="16" r="${r}" fill="none" stroke="currentColor" stroke-width="3" opacity=".18"/>
      <circle cx="16" cy="16" r="${r}" fill="none" stroke="${couleur}" stroke-width="3" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" transform="rotate(-90 16 16)"/>
    </svg>
    <b>${p}</b>
  </span>`;
}

function plcCarte(o, stade, couleur, tousLesStades, nomClient, rhMode) {
  const taches = (typeof allRappels !== 'undefined' ? allRappels : [])
    .filter(r => r.opportunite_id === o.id && r.statut === 'ouvert').length;
  const auj = new Date(new Date().setHours(0, 0, 0, 0));
  const echue = o.date_echeance && new Date(o.date_echeance) < auj;
  const montant = Number(o.montant_potentiel || 0);
  const sansMontant = !(montant > 0);
  const age = plcAge(o);
  const tonAge = age == null ? '' : age >= PLC_AGE_FROID ? 'froid' : age >= PLC_AGE_TIEDE ? 'tiede' : '';

  const pastilles = [
    o.compagnie ? `<span class="plc-past">${typeof compagnieAvecPicto === 'function' ? compagnieAvecPicto(o.compagnie, 15) : plcEsc(o.compagnie)}</span>` : '',
    taches ? `<span class="plc-past" title="${taches} tâche(s) ouverte(s)">☑ ${taches}</span>` : '',
    age != null ? `<span class="plc-past plc-age ${tonAge}" title="Créée il y a ${age} jour(s)">${age} j</span>` : '',
    o.date_echeance ? `<span class="plc-past ${echue ? 'plc-echue' : ''}" title="${echue ? 'Échéance dépassée' : 'Échéance'}">${echue ? '⏰ ' : ''}${fmtDate(o.date_echeance)}</span>` : '',
  ].filter(Boolean).join('');

  return `<div class="kanban-card plc-carte ${sansMontant ? 'plc-incomplete' : ''} ${echue ? 'plc-retard' : ''}"
      data-opp-id="${o.id}" style="--stade:${couleur}"
      ${rhMode ? '' : 'draggable="true" title="Glisser vers un autre stade"'}
      onclick="editerOpportunite('${o.id}')">

    ${o.cree_par ? `<span class="plc-equipe" title="Créée par ${plcEsc(o.cree_par)}">${PICTO_CREE_EQUIPE}${o.notif_vue ? '' : ' 🔴'}</span>` : ''}

    <div class="plc-tete">
      <div class="plc-qui">
        <b>${plcEsc(nomClient(o))}</b>
        <small>${plcEsc(o.titre || 'Affaire sans titre')}</small>
      </div>
      ${rhMode ? '' : `<div class="plc-chiffres">
        <span class="plc-montant ${sansMontant ? 'inconnu' : ''}">${sansMontant ? 'à estimer' : 'CHF ' + fmtCHF(montant)}</span>
        ${plcAnneau(o.probabilite, couleur)}
      </div>`}
    </div>

    <div class="opp-offres" data-opp="${o.id}" data-compagnie="${plcEsc(o.compagnie || '')}"></div>
    ${typeof htmlProchaineAction === 'function' ? htmlProchaineAction(o) : ''}
    ${pastilles ? `<div class="plc-pastilles">${pastilles}</div>` : ''}

    <div class="plc-pied">
      ${o.apporteur_id && typeof avatar === 'function' ? avatar(agentById(o.apporteur_id), 20) : '<span></span>'}
      ${rhMode ? '' : `<div class="plc-actions">
        <button type="button" class="plc-perdu" onclick="event.stopPropagation();ouvrirModaleMotifPerte('${o.id}','kanban')" title="Marquer perdue">✕ Perdu</button>
        ${selectStadeOpportunite(o, stade, tousLesStades)}
      </div>`}
    </div>
  </div>`;
}

// On remplace le rendu du kanban sans toucher aux trois autres vues ni au glisser-déposer.
function renderKanbanOpportunites(OPPS, gagnees, perdues, stades, stadeColor, tousLesStades, nomClient, rhMode) {
  const colonnes = stades.map(stade => {
    const opps = OPPS.filter(o => o.stade === stade);
    const couleur = stadeColor[stade];
    const total = opps.reduce((s, o) => s + Number(o.montant_potentiel || 0), 0);
    const renseignees = opps.filter(o => Number(o.montant_potentiel || 0) > 0).length;
    return `<div class="kanban-col plc-col" data-stade="${stade}" style="--stade:${couleur}">
      <div class="kanban-col-title plc-col-tete">
        <span class="plc-col-nom">${stade}</span>
        <span class="plc-col-compte">${opps.length}</span>
        ${rhMode || !total ? '' : `<span class="plc-col-total"
          title="${renseignees === opps.length ? 'Toutes les affaires de la colonne' : `${renseignees} affaire(s) sur ${opps.length} ont un montant`}">CHF ${fmtCHF(Math.round(total))}${renseignees < opps.length ? ' *' : ''}</span>`}
      </div>
      <div class="plc-cartes">
        ${opps.map(o => plcCarte(o, stade, couleur, tousLesStades, nomClient, rhMode)).join('')
          || '<div class="kanban-empty plc-vide">Rien ici</div>'}
      </div>
    </div>`;
  }).join('');

  setTimeout(() => { if (typeof activerKanbanPipeline === 'function') activerKanbanPipeline(rhMode); }, 0);

  const tableFin = (liste, titre, couleur, perdu) => !liste.length ? '' : `
    <details class="plc-fin" ${perdu ? '' : 'open'}>
      <summary style="--c:${couleur}">${perdu ? '✕' : '✓'} ${titre} (${liste.length})</summary>
      <div class="plc-fin-liste">
        ${liste.map(o => `<div class="plc-fin-ligne" ${rhMode ? '' : `onclick="editerOpportunite('${o.id}')"`}>
          <span class="plc-fin-qui"><b>${plcEsc(nomClient(o))}</b><small>${plcEsc(o.titre || '')}</small>
            ${perdu && o.motif_perte ? `<em>Motif : ${plcEsc(o.motif_perte)}</em>` : ''}</span>
          ${rhMode ? '' : `<span class="plc-fin-montant">${Number(o.montant_potentiel || 0) > 0 ? 'CHF ' + fmtCHF(o.montant_potentiel) : '—'}</span>`}
          ${rhMode ? '' : `<span onclick="event.stopPropagation()">${selectStadeOpportunite(o, perdu ? 'Perdu' : 'Gagné', tousLesStades)}</span>`}
          ${perdu ? '' : `<span>${o.contrat_id ? badge('Contrat créé', '#16A34A') : badge('À finaliser', '#F59E0B')}</span>`}
        </div>`).join('')}
      </div>
    </details>`;

  return `${rhMode ? '' : `<div class="kanban-zones-fin" aria-hidden="true">
      <div class="kanban-zone-fin" data-stade="Gagné">✓ Déposer ici : <strong>Gagné</strong></div>
      <div class="kanban-zone-fin perdu" data-stade="Perdu">✕ Déposer ici : <strong>Perdu</strong></div>
    </div>`}
    <div class="kanban plc-kanban">${colonnes}</div>
    ${tableFin(gagnees, 'Gagnées', '#16A34A', false)}
    ${tableFin(perdues, 'Perdues', '#B91C1C', true)}`;
}
