// ═══ REX DES QUATRE SAISONS (21.09.2026) ═══════════════════════════════════════════════════════
// « Je t'ai donné les planches pour te dire d'ajouter des thèmes. » Trois planches de douze Rex
// costumés — Halloween, Été, Printemps —, chacun avec sa phrase (« Plongeon dans la réussite »,
// « Faire fleurir les projets »…). Découpées et détourées le 21.09.2026 dans
// assets/logos/rex/saison-<saison>/, un fichier par dessin.
//
// Ce que ça change :
//   · deux saisons de plus dans js/62 : Printemps (20 mars – 31 mai) et Été (1er juin – 31 août).
//     Halloween (octobre) et Noël (novembre – 6 janvier) restent. Elles apparaissent d'elles-mêmes
//     dans Apparence, où l'on peut en imposer une pour la voir hors saison ;
//   · les poses de Rex (pouce, joie, planification…) prennent le costume du moment quand la
//     planche en a un équivalent. Sinon, repli sur la pose ordinaire, comme avant ;
//   · la mascotte « de marque » — connexion, REX CLOUD, bulle des citations, barre mobile —
//     devient un Rex de la saison, tiré au sort parmi les douze et changé chaque jour, avec sa
//     phrase en info-bulle.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Les fichiers d'images restent, sans effet.

const SRX_GALERIES = {
  halloween: {
    dossier: 'assets/logos/rex/saison-halloween/',
    dessins: [
      ['chasse-bonbons', 'Prêt pour la chasse aux bonbons'], ['ca-fait-peur', 'Ça fait peur !'], ['momie-mission', 'Momie en mission'],
      ['citrouille-power', 'Citrouille power'], ['equipe-nuit', 'En équipe même la nuit'], ['planification-magique', 'Planification magique'],
      ['toujours-plus-loin', 'Toujours plus loin'], ['effrayamment-efficace', 'Effrayamment efficace'], ['esprit-squelettique', 'Un esprit d’équipe squelettique'],
      ['bons-compagnons', 'Les bons compagnons font la différence'], ['strategie-noir', 'Stratégie même dans le noir'], ['prochaine-aventure', 'Prêt pour la prochaine aventure'],
    ],
    // pose de Rex → dessin de la saison qui dit la même chose
    poses: { debout: 'prochaine-aventure', pouce: 'citrouille-power', montre: 'chasse-bonbons', ordinateur: 'equipe-nuit',
      joie: 'toujours-plus-loin', planification: 'planification-magique', reflexion: 'strategie-noir', marche: 'momie-mission',
      concentre: 'effrayamment-efficace', confiant: 'bons-compagnons', enthousiaste: 'esprit-squelettique' },
  },
  ete: {
    dossier: 'assets/logos/rex/saison-ete/',
    dessins: [
      ['profiter-moment', 'Profiter du moment'], ['plongeon-reussite', 'Plongeon dans la réussite'], ['surf-projets', 'Surf de projets'],
      // « Construire ensemble » (Rex et son château de sable) retiré le 21.09.2026 : trop enfantin.
      ['equipe-vacances', 'Équipe en mode vacances'], ['nouveaux-horizons', 'Explorer de nouveaux horizons'],
      ['pause-meritee', 'Pause bien méritée'], ['relax-performance', 'Relax & performance'], ['garder-cap', 'Garder le cap'],
      ['petits-plaisirs', 'Petits plaisirs, grands résultats'], ['plus-loin-ensemble', 'Ensemble, on va plus loin'],
      // « Vibrer toute l'année » (Rex fleuri à la noix de coco) retiré le 22.09.2026 à la demande de Jonathan.
    ],
    poses: { debout: 'profiter-moment', pouce: 'garder-cap', montre: 'surf-projets', ordinateur: 'pause-meritee',
      joie: 'plongeon-reussite', planification: 'nouveaux-horizons', reflexion: 'nouveaux-horizons', marche: 'plus-loin-ensemble',
      concentre: 'relax-performance', confiant: 'equipe-vacances', enthousiaste: 'petits-plaisirs' },
  },
  printemps: {
    dossier: 'assets/logos/rex/saison-printemps/',
    dessins: [
      ['epanouis-potentiel', 'Épanouis ton potentiel'], ['grandir-ensemble', 'Grandir ensemble'], ['fleurir-projets', 'Faire fleurir les projets'],
      ['petits-gestes', 'Petits gestes, grands impacts'], ['plus-positif', 'Toujours plus positif'], ['cultiver-confiance', 'Cultiver la confiance'],
      ['petits-pas', 'Petits pas, grands résultats'], ['innover-naturellement', 'Innover naturellement'], ['energie-evolution', 'Énergie & évolution'],
      ['grandir-idees', 'Ensemble, on fait grandir vos idées'], ['avenir-vert', 'Vers un avenir plus vert'], ['printemps-opportunites', 'Le printemps des opportunités'],
    ],
    poses: { debout: 'epanouis-potentiel', pouce: 'plus-positif', montre: 'cultiver-confiance', ordinateur: 'grandir-idees',
      joie: 'printemps-opportunites', planification: 'fleurir-projets', reflexion: 'petits-gestes', marche: 'avenir-vert',
      concentre: 'innover-naturellement', confiant: 'grandir-ensemble', enthousiaste: 'energie-evolution' },
  },
};

// ── Les saisons ────────────────────────────────────────────────────────────────────────────────
(function srxSaisons() {
  if (typeof SAISONS === 'undefined') return;
  const ajouter = s => { if (!SAISONS.some(x => x.cle === s.cle)) SAISONS.push(s); };
  // Bascule aux équinoxes et aux solstices (Jonathan, 21.09.2026) : printemps à l'équinoxe de mars,
  // été au solstice de juin, automne (habillé en Halloween) à l'équinoxe de septembre. Noël garde
  // ses dates (1er novembre – 6 janvier) ; sans planche d'hiver, Rex reste en tenue ordinaire
  // jusqu'au printemps.
  ajouter({ cle: 'printemps', nom: 'Printemps', debut: { mois: 3, jour: 20 }, fin: { mois: 6, jour: 20 },
    dossierRex: SRX_GALERIES.printemps.dossier, poseConnexion: 'debout', decors: ['🌸', '🦋', '🌷', '🐝'] });
  ajouter({ cle: 'ete', nom: 'Été', debut: { mois: 6, jour: 21 }, fin: { mois: 9, jour: 22 },
    dossierRex: SRX_GALERIES.ete.dossier, poseConnexion: 'debout', decors: ['☀️', '🌊', '🏖️', '🍉'] });
  const hal = SAISONS.find(s => s.cle === 'halloween');
  if (hal) { hal.debut = { mois: 9, jour: 23 }; hal.fin = { mois: 10, jour: 31 }; hal.nom = 'Halloween (automne)'; }
  // L'ordre d'affichage dans Apparence suit l'année.
  const ordre = ['printemps', 'ete', 'halloween', 'noel'];
  SAISONS.sort((a, b) => ordre.indexOf(a.cle) - ordre.indexOf(b.cle));
})();

function srxGalerie(s) { return s ? SRX_GALERIES[s.cle] || null : null; }

// Un dessin par jour : assez pour que Rex change, pas au point de clignoter à chaque clic.
function srxDessinDuJour(s) {
  const g = srxGalerie(s);
  if (!g) return null;
  const d = new Date(), n = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  const [f, legende] = g.dessins[n % g.dessins.length];
  return { src: g.dossier + f + '.png', legende };
}

// ── Les poses de Rex, en costume ───────────────────────────────────────────────────────────────
(function srxPoses() {
  if (typeof saisonSourceRex !== 'function') return;
  const origine = saisonSourceRex;
  window.saisonSourceRex = function (nom) {
    const s = typeof saisonCourante === 'function' ? saisonCourante() : null;
    const g = srxGalerie(s);
    const p = typeof REX_POSES !== 'undefined' ? REX_POSES[nom] : null;
    if (g && p) {
      const dessin = g.poses[nom];
      // Halloween avait déjà quatre poses dessinées (poses-halloween/) : elles restent prioritaires.
      if (dessin && !(s.cle === 'halloween' && ['enthousiaste', 'joie', 'planification', 'reflexion'].includes(nom))) {
        return { src: g.dossier + dessin + '.png', repli: REX_DOSSIER + p.f };
      }
    }
    return origine.apply(this, arguments);
  };
})();

// ── La mascotte de marque, en costume ──────────────────────────────────────────────────────────
// Le Rex du bandeau (.rex-mascotte-menu) n'est pas costumé : il s'anime (js/117), et les
// animations n'existent qu'en tenue ordinaire. Le costume habille tout le reste.
const SRX_CIBLES = ['.cloud-rex', '.rex-topbar-mascotte', '#rex-citation > img', '.login-mascotte'];
const SRX_ORIGINE = 'data-srx-origine';

function srxAppliquer() {
  const s = typeof saisonCourante === 'function' ? saisonCourante() : null;
  const dessin = srxDessinDuJour(s);
  document.querySelectorAll(SRX_CIBLES.join(',')).forEach(img => {
    if (!img.hasAttribute(SRX_ORIGINE)) img.setAttribute(SRX_ORIGINE, img.getAttribute('src') || '');
    const origine = img.getAttribute(SRX_ORIGINE);
    // Sans planche pour la saison (Noël), on ne touche à rien, sauf pour retirer un costume posé ici.
    if (!dessin && !img.classList.contains('srx-costume')) return;
    const voulu = dessin ? dessin.src : origine;
    if (img.getAttribute('src') !== voulu) {
      img.onerror = function () { this.onerror = null; this.src = origine; };
      img.src = voulu;
    }
    img.title = dessin ? `Rex · ${dessin.legende}` : (img.title || '');
    img.classList.toggle('srx-costume', !!dessin);
  });
}

(function srxBrancher() {
  // Après chaque changement de saison (Apparence, interrupteur) et à chaque citation.
  for (const nom of ['saisonAppliquer', 'rexAfficherCitation', 'saisonPoserCompagnonConnexion']) {
    if (typeof window[nom] !== 'function') continue;
    const origine = window[nom];
    window[nom] = function () { const r = origine.apply(this, arguments); srxAppliquer(); return r; };
  }
  const go = () => { srxAppliquer(); setInterval(srxAppliquer, 60 * 60 * 1000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();

  const st = document.createElement('style');
  st.textContent = `
    /* Les dessins de saison sont plus larges que la pose ordinaire (accessoires) : ils restent
       dans la même boîte, sans déformer. */
    img.srx-costume { object-fit: contain; }
    #rex-citation > img.srx-costume { width: auto; }`;
  document.head.appendChild(st);
})();
