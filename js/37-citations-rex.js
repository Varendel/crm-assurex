// ═══ CITATIONS DE REX (19.09.2026) ══════════════════════════════════════════════════════════
// Une bulle discrète où Rex, la mascotte, partage une citation motivante : philosophie antique,
// latin (avec traduction) et tradition chrétienne. Elle change toute seule de temps en temps
// (toutes les 40 minutes), au clic sur la bulle, et se referme avec × jusqu'à la suivante.

const REX_CITATIONS = [
  { t: 'Per aspera ad astra.', tr: 'Par les difficultés jusqu’aux étoiles.', a: 'Sénèque' },
  { t: 'Audentes fortuna iuvat.', tr: 'La fortune sourit aux audacieux.', a: 'Virgile' },
  { t: 'Festina lente.', tr: 'Hâte-toi lentement.', a: 'Auguste' },
  { t: 'Labor omnia vincit improbus.', tr: 'Un travail acharné vient à bout de tout.', a: 'Virgile' },
  { t: 'Carpe diem.', tr: 'Cueille le jour présent.', a: 'Horace' },
  { t: 'Dum spiro, spero.', tr: 'Tant que je respire, j’espère.', a: 'Adage latin' },
  { t: 'Non scholae sed vitae discimus.', tr: 'Nous n’apprenons pas pour l’école, mais pour la vie.', a: 'Sénèque' },
  { t: 'Gutta cavat lapidem, non vi sed saepe cadendo.', tr: 'La goutte creuse la pierre, non par la force mais en tombant souvent.', a: 'Ovide' },
  { t: 'Ora et labora.', tr: 'Prie et travaille.', a: 'Règle de saint Benoît' },
  { t: 'Ad maiorem Dei gloriam.', tr: 'Pour la plus grande gloire de Dieu.', a: 'Saint Ignace de Loyola' },
  { t: 'Fiat voluntas tua.', tr: 'Que ta volonté soit faite.', a: 'Matthieu 6, 10' },
  { t: 'Spes non confundit.', tr: 'L’espérance ne déçoit pas.', a: 'Romains 5, 5' },
  { t: 'Omnia vincit amor.', tr: 'L’amour triomphe de tout.', a: 'Virgile' },
  { t: 'Nulla dies sine linea.', tr: 'Pas un jour sans une ligne.', a: 'Pline l’Ancien' },
  { t: 'Fortes fortuna adiuvat.', tr: 'La fortune aide les courageux.', a: 'Térence' },
  { t: 'Quod tibi fieri non vis, alteri ne feceris.', tr: 'Ne fais pas à autrui ce que tu ne voudrais pas qu’on te fasse.', a: 'Maxime latine' },
  { t: 'Il ne dépend pas de toi d’être riche, mais il dépend de toi d’être heureux.', a: 'Épictète' },
  { t: 'Ce ne sont pas les choses qui troublent les hommes, mais les jugements qu’ils portent sur elles.', a: 'Épictète' },
  { t: 'Le bonheur de ta vie dépend de la qualité de tes pensées.', a: 'Marc Aurèle' },
  { t: 'L’obstacle à l’action fait avancer l’action. Ce qui barre la route devient la route.', a: 'Marc Aurèle' },
  { t: 'Ne perds plus de temps à discuter de ce que doit être un homme de bien : sois-en un.', a: 'Marc Aurèle' },
  { t: 'Ce n’est pas parce que les choses sont difficiles que nous n’osons pas, c’est parce que nous n’osons pas qu’elles sont difficiles.', a: 'Sénèque' },
  { t: 'Il n’y a pas de vent favorable pour celui qui ne sait pas où il va.', a: 'Sénèque' },
  { t: 'Nous sommes ce que nous faisons de manière répétée. L’excellence n’est donc pas un acte, mais une habitude.', a: 'd’après Aristote' },
  { t: 'Connais-toi toi-même.', a: 'Temple de Delphes, Socrate' },
  { t: 'Le commencement est la moitié du tout.', a: 'Platon' },
  { t: 'Le cœur a ses raisons que la raison ne connaît point.', a: 'Blaise Pascal' },
  { t: 'Aime, et fais ce que tu veux.', a: 'Saint Augustin' },
  { t: 'Tu nous as faits pour toi, Seigneur, et notre cœur est sans repos tant qu’il ne demeure en toi.', a: 'Saint Augustin' },
  { t: 'Fais ce que tu peux, demande ce que tu ne peux pas, et Dieu te donnera de pouvoir.', a: 'Saint Augustin' },
  { t: 'Commence par faire le nécessaire, puis fais ce qu’il est possible de faire, et tu réaliseras l’impossible.', a: 'Saint François d’Assise' },
  { t: 'Là où il y a la haine, que je mette l’amour.', a: 'Prière attribuée à saint François' },
  { t: 'Je puis tout par celui qui me fortifie.', a: 'Philippiens 4, 13' },
  { t: 'Tout ce que vous faites, faites-le de bon cœur, comme pour le Seigneur.', a: 'Colossiens 3, 23' },
  { t: 'Demandez, et l’on vous donnera ; cherchez, et vous trouverez ; frappez, et l’on vous ouvrira.', a: 'Matthieu 7, 7' },
  { t: 'Ne vous inquiétez donc pas du lendemain ; car le lendemain aura soin de lui-même.', a: 'Matthieu 6, 34' },
  { t: 'Celui qui est fidèle dans les petites choses l’est aussi dans les grandes.', a: 'Luc 16, 10' },
  { t: 'Sois fort et courageux ; ne t’effraie point.', a: 'Josué 1, 9' },
  { t: 'Recommande ton sort à l’Éternel, et tes projets réussiront.', a: 'Proverbes 16, 3' },
  { t: 'Jesus Christ is King.', tr: 'Jésus-Christ est Roi.', a: 'Christus Rex' },
  { t: 'N’ayez pas peur !', a: 'Saint Jean-Paul II' },
  { t: 'Fais tout avec amour, rien par force.', a: 'Saint François de Sales' },
  { t: 'Il faut agir comme si tout dépendait de nous, et prier comme si tout dépendait de Dieu.', a: 'd’après saint Ignace de Loyola' },
];

// Citations thématiques pour les rapports clients : bilans de prévoyance, conseil financier,
// financement immobilier et investissements (Rex les présente en fin de document).
const REX_CITATIONS_RAPPORT = {
  prevoyance: [
    { t: 'Gouverner, c’est prévoir.', a: 'Émile de Girardin' },
    { t: 'Si vis pacem, para bellum — qui veut la paix se prépare.', tr: 'Anticiper, c’est se donner la sérénité.', a: 'Végèce' },
    { t: 'Prudentia est rerum expetendarum fugiendarumque scientia.', tr: 'La prudence est la science de ce qu’il faut rechercher et de ce qu’il faut éviter.', a: 'Cicéron' },
    { t: 'Va vers la fourmi, paresseux ; considère ses voies, et deviens sage : elle prépare en été sa nourriture.', a: 'Proverbes 6, 6-8' },
    { t: 'Le meilleur moment pour planter un arbre était il y a vingt ans. Le deuxième meilleur moment, c’est maintenant.', a: 'Proverbe' },
    { t: 'L’homme prudent voit le mal et se cache ; les simples avancent et en portent la peine.', a: 'Proverbes 22, 3' },
    { t: 'Un homme sage bâtit sa maison sur le roc.', a: 'Matthieu 7, 24' },
    { t: 'Ce n’est pas le temps qui nous manque, c’est nous qui en perdons beaucoup.', a: 'Sénèque' },
  ],
  investissement: [
    { t: 'Le temps est le meilleur allié de l’investisseur patient.', a: 'Adage de gestion de patrimoine' },
    { t: 'Ne mets pas tous tes œufs dans le même panier.', a: 'Proverbe' },
    { t: 'Donne une part à sept et même à huit, car tu ne sais pas quel malheur peut arriver sur la terre.', a: 'Ecclésiaste 11, 2' },
    { t: 'Les projets de l’homme diligent ne mènent qu’à l’abondance.', a: 'Proverbes 21, 5' },
    { t: 'Lequel de vous, s’il veut bâtir une tour, ne s’assied d’abord pour calculer la dépense ?', a: 'Luc 14, 28' },
    { t: 'Magnum vectigal est parsimonia.', tr: 'L’épargne est un grand revenu.', a: 'Cicéron' },
    { t: 'La richesse ne consiste pas à avoir de grandes possessions, mais à avoir peu de besoins.', a: 'Épictète' },
    { t: 'Festina lente.', tr: 'Hâte-toi lentement : la constance l’emporte sur la précipitation.', a: 'Auguste' },
  ],
};

// Carte « Rex vous dit » à insérer dans un rapport HTML imprimable (fenêtre séparée : URL absolue)
function rexCitationRapportHtml(theme) {
  const liste = REX_CITATIONS_RAPPORT[theme] || REX_CITATIONS_RAPPORT.prevoyance;
  const c = liste[Math.floor(Math.random() * liste.length)];
  let img = 'assets/logos/rex-mascotte-hd.png';
  try { img = new URL(img, location.href).href; } catch (e) {}
  return `<div style="display:flex;align-items:center;gap:14px;margin:22px 0 4px;padding:14px 18px;border-radius:14px;background:linear-gradient(135deg,#F4F7FC,#EAF6FF);border:1px solid #DCE6F5;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact">
    <img src="${img}" alt="Rex" style="width:58px;height:58px;object-fit:contain;flex:0 0 auto"/>
    <div style="flex:1;min-width:0">
      <div style="font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#1A4A9C;font-weight:700;margin-bottom:3px">Le mot de Rex</div>
      <div style="font-size:13px;font-style:italic;font-weight:600;color:#0E1B33;line-height:1.45">« ${rexEsc(c.t)} »</div>
      ${c.tr ? `<div style="font-size:11px;color:#56627A;margin-top:2px">${rexEsc(c.tr)}</div>` : ''}
      <div style="font-size:10.5px;color:#1A4A9C;font-weight:700;margin-top:4px">— ${rexEsc(c.a)}</div>
    </div></div>`;
}

const REX_CITATION_INTERVALLE_MS = 40 * 60 * 1000;
window._rexCit = window._rexCit || { index: null, masquee: false, timer: null };

function rexCitationStyles() {
  if (document.getElementById('rex-citation-style')) return;
  const s = document.createElement('style');
  s.id = 'rex-citation-style';
  s.textContent = `
  .rex-citation{position:fixed;right:20px;bottom:20px;z-index:900;display:flex;align-items:flex-end;gap:10px;max-width:min(380px,calc(100vw - 32px));pointer-events:none;animation:rexCitIn .5s cubic-bezier(.2,.8,.2,1)}
  .rex-citation-bulle{pointer-events:auto;position:relative;background:var(--surface,#fff);color:var(--text,#1e293b);border:1px solid var(--border,rgba(0,0,0,.08));border-radius:18px 18px 4px 18px;padding:12px 30px 12px 14px;box-shadow:0 12px 32px rgba(15,23,42,.14);cursor:pointer;transition:transform .2s ease, box-shadow .2s ease}
  .rex-citation-bulle:hover{transform:translateY(-2px);box-shadow:0 16px 38px rgba(15,23,42,.2)}
  .rex-citation-texte{font-size:13px;line-height:1.45;font-style:italic;font-weight:600}
  .rex-citation-trad{font-size:12px;line-height:1.4;color:var(--text-muted,#64748b);margin-top:4px}
  .rex-citation-auteur{font-size:11px;color:var(--accent,#2563eb);font-weight:700;margin-top:6px;letter-spacing:.02em}
  .rex-citation-fermer{position:absolute;top:6px;right:8px;border:0;background:none;color:var(--text-muted,#64748b);font-size:15px;line-height:1;cursor:pointer;padding:2px 4px;border-radius:6px}
  .rex-citation-fermer:hover{background:var(--accent-dim,rgba(37,99,235,.08))}
  .rex-citation img{pointer-events:auto;width:46px;height:46px;object-fit:contain;flex:0 0 auto;filter:drop-shadow(0 4px 8px rgba(0,0,0,.15));cursor:pointer}
  .rex-citation.change .rex-citation-bulle{animation:rexCitChange .45s ease}
  @keyframes rexCitIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
  @keyframes rexCitChange{0%{opacity:.2;transform:scale(.97)}100%{opacity:1;transform:none}}
  @media (max-width:768px){.rex-citation{right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));max-width:calc(100vw - 24px)}.rex-citation img{width:38px;height:38px}}
  @media print{.rex-citation{display:none!important}}
  @media (prefers-reduced-motion: reduce){.rex-citation,.rex-citation.change .rex-citation-bulle{animation:none}}`;
  document.head.appendChild(s);
}

function rexEsc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function rexCitationSuivante() {
  const n = REX_CITATIONS.length;
  let i = Math.floor(Math.random() * n);
  if (n > 1 && i === window._rexCit.index) i = (i + 1) % n;
  window._rexCit.index = i;
  try { localStorage.setItem('rex-citation-index', String(i)); } catch (e) {}
  return REX_CITATIONS[i];
}

function rexAfficherCitation(changer) {
  if (typeof currentUser === 'undefined' || !currentUser) return;
  rexCitationStyles();
  const c = changer || window._rexCit.index == null ? rexCitationSuivante() : REX_CITATIONS[window._rexCit.index];
  let el = document.getElementById('rex-citation');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rex-citation';
    el.className = 'rex-citation';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="rex-citation-bulle" onclick="rexAfficherCitation(true)" title="Une autre citation">
      <button type="button" class="rex-citation-fermer" onclick="event.stopPropagation();rexMasquerCitation()" aria-label="Fermer">×</button>
      <div class="rex-citation-texte">« ${rexEsc(c.t)} »</div>
      ${c.tr ? `<div class="rex-citation-trad">${rexEsc(c.tr)}</div>` : ''}
      <div class="rex-citation-auteur">— ${rexEsc(c.a)}</div>
    </div>
    <img src="assets/logos/rex-mascotte-hd.png" alt="Rex" onclick="rexAfficherCitation(true)"/>`;
  el.style.display = '';
  el.classList.remove('change'); void el.offsetWidth; if (changer) el.classList.add('change');
  window._rexCit.masquee = false;
}

function rexMasquerCitation() {
  const el = document.getElementById('rex-citation');
  if (el) el.style.display = 'none';
  window._rexCit.masquee = true;
}

// Démarrage : attend la connexion, puis une nouvelle citation toutes les 40 minutes
(function rexDemarrerCitations() {
  try { const i = Number(localStorage.getItem('rex-citation-index')); if (Number.isInteger(i) && i >= 0 && i < REX_CITATIONS.length) window._rexCit.index = i; } catch (e) {}
  const attendre = setInterval(() => {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    clearInterval(attendre);
    rexAfficherCitation(true);
    clearInterval(window._rexCit.timer);
    window._rexCit.timer = setInterval(() => rexAfficherCitation(true), REX_CITATION_INTERVALLE_MS);
  }, 1500);
})();
