// ═══ LES POLICES DÉJÀ DÉPOSÉES, PROPOSÉES À L'IMPORT (25.09.2026) ═══════════════════════════════
// « Lorsque j'ajoute des documents classés police dans les documents client, j'aimerais que
//   l'import propose de reprendre les polices déposées pour les lire et les créer dans le
//   système. »
//
// Aujourd'hui, l'écran « Nouveau contrat » sait lire une police — mais seulement celle qu'on lui
// donne au moment même, depuis le disque. Le PDF déposé la semaine dernière dans les documents du
// client, lui, dort dans documents_compagnies : il faut le retélécharger, le retrouver dans le
// dossier des téléchargements, puis le redonner à REX. Le document est pourtant déjà là, rangé,
// classé « Police », et il n'attend que d'être lu.
//
// Ce module pose la liste de ces polices-là directement dans le bloc d'import, avec un bouton par
// document. On ne montre que celles qui ne sont rattachées à AUCUN contrat (contrat_id vide) :
// une police déjà saisie n'a rien à faire dans une liste intitulée « à créer ».
//
// La lecture réutilise telle quelle la chaîne existante (js/09 importPolicePdfAI) : texte du PDF,
// puis repli sur le modèle de vision si la police est scannée. Rien n'est dupliqué.
//
// Et la boucle se referme : une fois le contrat enregistré, le document déposé est rattaché à ce
// contrat. C'est exactement ce que fait js/164 à la main ; ici c'est gratuit, puisqu'on sait de
// quel document le contrat est né.
//
// RETOUR EN ARRIÈRE : retirer la ligne de index.html. Aucune donnée n'est modifiée par le seul
// fait d'afficher la liste.

const PDP_MAX = 25;   // au-delà, la liste cesse d'être une liste et devient un écran

window._pdp = window._pdp || { docs: [], charge: false, enCours: null };

function pdpEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function pdpNomClient(clientId) {
  const c = (typeof allClients !== 'undefined' ? allClients : []).find(x => x.id === clientId);
  if (!c) return '';
  return (typeof estEntreprise === 'function' && estEntreprise(c) ? c.nom : `${c.prenom || ''} ${c.nom || ''}`).trim();
}

// Les polices déposées qu'aucun contrat ne revendique. `contrat_id=is.null` fait le tri en base :
// inutile de rapatrier tout l'historique des documents pour en écarter 95 % dans le navigateur.
async function pdpCharger() {
  if (window._pdp.charge) return window._pdp.docs;
  try {
    const r = await dbGet('documents_compagnies',
      `type=eq.police&contrat_id=is.null&select=id,client_id,nom_fichier,titre,numero_police,compagnie,chemin,date_document,created_at&order=created_at.desc&limit=${PDP_MAX}`);
    window._pdp.docs = Array.isArray(r) ? r : [];
  } catch (e) {
    window._pdp.docs = [];
    console.warn('Polices déposées : ' + (e.message || e));
  }
  window._pdp.charge = true;
  return window._pdp.docs;
}

// Le client déjà choisi sur le formulaire passe devant : c'est presque toujours de sa police qu'il
// s'agit. Les autres restent visibles — on crée aussi des contrats en partant du document.
function pdpTriees(docs) {
  const clientForm = document.getElementById('ct-client')?.value || '';
  if (!clientForm) return docs;
  return [...docs].sort((a, b) => (b.client_id === clientForm) - (a.client_id === clientForm));
}

function pdpLigneHtml(d) {
  const nom = d.nom_fichier || d.titre || 'Police';
  const client = pdpNomClient(d.client_id);
  const detail = [client, d.compagnie, d.numero_police,
    d.date_document && typeof fmtDate === 'function' ? fmtDate(d.date_document) : null].filter(Boolean).join(' · ');
  return `<div class="pdp-ligne" data-id="${pdpEsc(d.id)}">
    <span class="pdp-ico">📄</span>
    <span class="pdp-nom" title="${pdpEsc(nom)}">${pdpEsc(nom)}${detail ? `<small>${pdpEsc(detail)}</small>` : ''}</span>
    ${d.chemin ? `<button type="button" class="pdp-voir" onclick="pdpVoir('${pdpEsc(d.id)}')" title="Ouvrir le document">👁️</button>` : ''}
    <button type="button" class="pdp-lire" onclick="pdpLire('${pdpEsc(d.id)}')">Lire et créer</button>
  </div>`;
}

async function pdpRendre() {
  const hote = document.getElementById('pdp-zone');
  if (!hote) return;
  const docs = pdpTriees(await pdpCharger());
  if (!docs.length) {
    // Pas de liste vide décorative : s'il n'y a rien à reprendre, le bloc disparaît.
    hote.innerHTML = '';
    return;
  }
  hote.innerHTML = `
    <div class="pdp-tete">📥 <b>${docs.length} police${docs.length > 1 ? 's' : ''} déposée${docs.length > 1 ? 's' : ''}</b> qu'aucun contrat ne reprend encore</div>
    <div class="pdp-liste">${docs.map(pdpLigneHtml).join('')}</div>`;
}

function pdpVoir(id) {
  const d = window._pdp.docs.find(x => x.id === id);
  if (!d || !d.chemin) { showError('Document introuvable.'); return; }
  if (typeof ouvrirPieceJointe === 'function') ouvrirPieceJointe(d.chemin);
  else showError('Ouverture indisponible.');
}

// Le document redescend du stockage, puis prend exactement le chemin d'un fichier choisi à la
// main. importPolicePdfAI ne lit que `input.files[0]` : on lui passe donc un objet qui n'a que ça,
// plutôt que de dupliquer 150 lignes de lecture et de pré-remplissage. Un test le vérifie — si
// cette fonction venait à lire autre chose de son argument, il faudra le savoir ici.
async function pdpLire(id) {
  const d = window._pdp.docs.find(x => x.id === id);
  if (!d) { showError('Document introuvable.'); return; }
  if (!d.chemin) { showError('Ce document n’a pas de fichier associé.'); return; }
  if (typeof importPolicePdfAI !== 'function') { showError('L’import de police n’est pas disponible sur cet écran.'); return; }

  const ligne = document.querySelector(`.pdp-ligne[data-id="${CSS.escape(id)}"] .pdp-lire`);
  if (ligne) { ligne.disabled = true; ligne.textContent = '⏳ Lecture…'; }
  try {
    const token = await getValidAccessToken() || SUPABASE_KEY;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/documents/${d.chemin.split('/').map(encodeURIComponent).join('/')}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`téléchargement impossible (${r.status})`);
    const blob = await r.blob();
    const fichier = new File([blob], d.nom_fichier || 'police.pdf', { type: blob.type || 'application/pdf' });

    // Le client du document est le client du contrat : on le pose avant la lecture, pour que la
    // recherche de produit sache déjà s'il s'agit d'un privé ou d'une entreprise (js/09 s'appuie
    // dessus pour départager les produits).
    const sel = document.getElementById('ct-client');
    if (sel && d.client_id && !sel.value) {
      sel.value = d.client_id;
      if (typeof syncSegmentFromClient === 'function') syncSegmentFromClient();
    }

    window._pdp.enCours = d;      // pour rattacher le document au contrat une fois celui-ci créé
    await importPolicePdfAI({ files: [fichier] });
  } catch (e) {
    window._pdp.enCours = null;
    showError('Police non lue : ' + (e.message || e));
  } finally {
    if (ligne) { ligne.disabled = false; ligne.textContent = 'Lire et créer'; }
  }
}

// ── La boucle se referme ────────────────────────────────────────────────────────────────────────
// Le contrat vient d'être créé à partir de ce document : il n'y a plus aucune raison de demander à
// quelqu'un de les relier à la main.
(function pdpBrancher() {
  if (typeof creerContratEtCommission === 'function') {
    const creer = creerContratEtCommission;
    window.creerContratEtCommission = async function () {
      const res = await creer.apply(this, arguments);
      const d = window._pdp.enCours;
      if (d && res && !res.error && res.contrat && res.contrat.id) {
        window._pdp.enCours = null;
        try {
          const maj = { contrat_id: res.contrat.id };
          // On complète ce qui manquait au document, sans jamais écraser ce qu'il portait déjà.
          if (!d.client_id && res.contrat.client_id) maj.client_id = res.contrat.client_id;
          if (!d.numero_police && res.contrat.numero_police) maj.numero_police = res.contrat.numero_police;
          if (!d.compagnie && res.contrat.compagnie) maj.compagnie = res.contrat.compagnie;
          const r = await dbPatch('documents_compagnies', d.id, maj);
          if (r && r.error) throw new Error(errMsg(r));
          window._pdp.docs = window._pdp.docs.filter(x => x.id !== d.id);
          showError(`✓ Contrat créé et police « ${d.nom_fichier || 'déposée'} » rattachée.`);
        } catch (e) {
          // Le contrat existe : ne pas laisser croire le contraire pour un rattachement manqué.
          showError('Contrat créé, mais le document déposé n’a pas pu y être rattaché : ' + (e.message || e) + ' — à relier depuis Documents.');
        }
      }
      return res;
    };
  }

  // Le bloc d'import est reconstruit à chaque affichage de l'écran : on le guette.
  const poser = () => {
    const zone = document.getElementById('ct-pan-auto');
    if (!zone || document.getElementById('pdp-zone')) return;
    zone.insertAdjacentHTML('beforeend', '<div id="pdp-zone" class="pdp"></div>');
    window._pdp.charge = false;          // la liste change dès qu'un document est déposé
    pdpRendre().catch(() => {});
  };
  let minuterie = null;
  const guetter = () => {
    const m = document.getElementById('main-content');
    if (!m) return;
    new MutationObserver(() => { clearTimeout(minuterie); minuterie = setTimeout(poser, 120); }).observe(m, { childList: true, subtree: true });
    poser();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guetter);
  else guetter();

  const st = document.createElement('style');
  st.textContent = `
    .pdp { margin-top: 14px; border-top: 1px dashed var(--accent-border); padding-top: 12px; }
    .pdp-tete { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
    .pdp-tete b { color: var(--text); }
    .pdp-liste { display: flex; flex-direction: column; gap: 4px; max-height: 210px; overflow: auto; }
    .pdp-ligne { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 9px; align-items: center;
      padding: 6px 8px; border-radius: 9px; background: var(--surface); border: 1px solid var(--border); }
    .pdp-nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--text); }
    .pdp-nom small { display: block; font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }
    .pdp-voir { background: none; border: 0; cursor: pointer; font-size: 14px; padding: 2px 4px; }
    .pdp-lire { background: var(--accent-dim); border: 1px solid var(--accent-border); color: var(--accent);
      border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .pdp-lire:disabled { opacity: .6; cursor: wait; }`;
  document.head.appendChild(st);
})();
