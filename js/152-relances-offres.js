// ═══ GÉNÉRATEUR DE RELANCES D'OFFRES (23.09.2026) ═══════════════════════════════════════════════
// « Il me faudrait un générateur de relances d'offres intelligent dans les mails. »
//
// Relancer une compagnie existait déjà (js/25), mais une offre à la fois, depuis la fiche de
// l'affaire : il fallait donc SAVOIR laquelle relancer, et y aller. En pratique on relance ce qui
// nous revient en tête, c'est-à-dire les gros dossiers, et les petits dorment.
//
// Ici, l'inverse : le CRM parcourt toutes les demandes envoyées, calcule ce qui est dû aujourd'hui,
// et prépare les messages. Trois décisions sont prises pour vous :
//
//   1. QUOI relancer. Le délai se resserre à chaque tour — 6 jours avant la première relance, 5
//      avant la deuxième, 4 ensuite : une compagnie qui ne répond pas mérite d'être poussée plus
//      souvent, pas moins. Et le délai tombe à 2 jours quand l'échéance du client approche : c'est
//      elle qui commande, pas notre routine.
//   2. À QUI. Un message PAR COMPAGNIE, pas par offre. Trois dossiers en attente chez le même
//      courtier partenaire font un seul courriel avec trois lignes — c'est ce qu'un humain ferait,
//      et ça se lit.
//   3. QUOI ÉCRIRE. Le ton suit le rang : on se permet de revenir, puis on constate l'absence de
//      réponse, puis on pose une échéance et on propose de retirer la demande. Une troisième
//      relance rédigée comme la première dit au destinataire qu'il peut continuer à ne rien faire.
//
// Rien ne part tout seul : chaque message est modifiable et confirmé (envoyerCourriel, js/143).
// Une relance envoyée est datée sur l'offre, donc le compteur du tour suivant est juste.

const REL_SEUILS = [6, 5, 4];          // jours avant la 1re, la 2e, la 3e relance et les suivantes
const REL_SEUIL_URGENT = 2;            // quand l'échéance du client est proche
const REL_ECHEANCE_PROCHE = 21;        // jours

const _rel = { lignes: [], sel: new Set(), charge: false };

function relEsc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function relJours(d) { return typeof opJoursDepuis === 'function' ? opJoursDepuis(d) : null; }
function relDate(d) { return d ? new Date(String(d).slice(0, 10)).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }

// ── Ce qui est dû aujourd'hui ───────────────────────────────────────────────────────────────────
function relDue(e, o) {
  if (!e || e.statut !== 'envoyée' || !e.envoye_le) return null;
  if (e.prime || e.recue_le || e.retenue) return null;          // une offre reçue ne se relance pas
  const rang = Number(e.relances) || (e.relance_le ? 1 : 0);
  const depuis = relJours(e.relance_le || e.envoye_le);
  if (depuis === null) return null;
  const jEcheance = o && o.date_echeance ? -relJours(o.date_echeance) : null;
  const urgent = jEcheance !== null && jEcheance >= 0 && jEcheance <= REL_ECHEANCE_PROCHE;
  const seuil = urgent ? REL_SEUIL_URGENT : (REL_SEUILS[Math.min(rang, REL_SEUILS.length - 1)]);
  if (depuis < seuil) return null;
  return { rang, depuis, urgent, jEcheance };
}

async function relCharger() {
  const rows = await dbGet('demandes_offre', 'select=id,opportunite_id,compagnies_envoi,created_at&order=created_at.desc&limit=400');
  const demandes = Array.isArray(rows) ? rows : [];
  const parCompagnie = new Map();
  for (const d of demandes) {
    const o = (typeof allOpportunites !== 'undefined' ? allOpportunites : []).find(x => x.id === d.opportunite_id);
    if (!o || o.stade === 'Gagné' || o.stade === 'Perdu') continue;
    (Array.isArray(d.compagnies_envoi) ? d.compagnies_envoi : []).forEach((e, idx) => {
      const due = relDue(e, o);
      if (!due || !e.email) return;
      const cle = String(e.email).trim().toLowerCase();
      if (!parCompagnie.has(cle)) parCompagnie.set(cle, { email: e.email, compagnie: e.compagnie || '', items: [] });
      parCompagnie.get(cle).items.push({ d, e, idx, o, ...due });
    });
  }
  // Le rang et l'urgence d'un groupe sont ceux du dossier le plus avancé : c'est le plus ancien
  // silence qui donne le ton, sinon la relance d'un dossier pressé s'écrit sur le ton du premier jour.
  _rel.lignes = [...parCompagnie.values()].map(g => {
    const rang = Math.max(...g.items.map(x => x.rang));
    const depuis = Math.max(...g.items.map(x => x.depuis));
    const urgent = g.items.some(x => x.urgent);
    return { ...g, rang, depuis, urgent, objet: relObjet(g, rang, depuis), corps: relCorps(g, rang) };
  }).sort((a, b) => (b.urgent - a.urgent) || (b.rang - a.rang) || (b.depuis - a.depuis));
  _rel.sel = new Set(_rel.lignes.map((_, i) => i));
  _rel.charge = true;
}

// ── Le texte ────────────────────────────────────────────────────────────────────────────────────
function relObjet(g, rang, depuis) {
  const un = g.items.length === 1 ? g.items[0] : null;
  const quoi = un ? `${opNomClient(un.o) || un.o.titre}` : `${g.items.length} dossiers en attente`;
  if (rang === 0) return `Relance — demande d'offre ${quoi}`;
  if (rang === 1) return `2e relance — demande d'offre ${quoi}`;
  return `Sans réponse depuis ${depuis} jours — ${quoi}`;
}

function relCorps(g, rang) {
  const l = [];
  l.push('Bonjour,');
  l.push('');
  const liste = g.items.map(x => {
    const nom = opNomClient(x.o) || x.o.titre || '';
    const produit = (Array.isArray(x.o.produits) && x.o.produits[0]) || x.e.couverture || '';
    return `• ${nom}${produit ? ` — ${produit}` : ''} (demande du ${relDate(x.e.envoye_le)}${x.e.relance_le ? `, relancée le ${relDate(x.e.relance_le)}` : ''})`;
  });

  if (g.items.length === 1) {
    const x = g.items[0];
    const nom = opNomClient(x.o) || x.o.titre || '';
    const produit = (Array.isArray(x.o.produits) && x.o.produits[0]) || x.e.couverture || '';
    if (rang === 0) l.push(`Le ${relDate(x.e.envoye_le)}, je vous ai adressé une demande d'offre pour ${nom}${produit ? ` (${produit})` : ''}. Sans retour de votre part à ce jour, je me permets de revenir vers vous.`);
    else if (rang === 1) l.push(`Je reviens vers vous au sujet de la demande d'offre pour ${nom}${produit ? ` (${produit})` : ''}, adressée le ${relDate(x.e.envoye_le)} et déjà relancée le ${relDate(x.e.relance_le)}. Je n'ai pas eu de retour.`);
    else l.push(`Ma demande d'offre pour ${nom}${produit ? ` (${produit})` : ''} date du ${relDate(x.e.envoye_le)} et reste sans réponse malgré mes relances.`);
  } else {
    l.push(rang === 0
      ? `Je me permets de revenir vers vous : ${g.items.length} demandes d'offre sont en attente de votre réponse.`
      : `${g.items.length} demandes d'offre vous ont été adressées et restent sans réponse malgré mes relances :`);
    l.push('');
    l.push(...liste);
  }
  l.push('');

  // L'échéance du client : c'est le seul argument qui engage vraiment le destinataire.
  const presse = g.items.filter(x => x.urgent).sort((a, b) => a.jEcheance - b.jEcheance)[0];
  if (presse) {
    const nom = opNomClient(presse.o) || presse.o.titre || '';
    l.push(`L'échéance de ${nom} tombe le ${relDate(presse.o.date_echeance)} : passé cette date, le client ne pourra plus changer de solution cette année. J'ai besoin de votre offre avant.`);
    l.push('');
  }

  // Troisième relance : on cesse de demander, on propose une sortie. Une relance qui ne pose aucune
  // échéance apprend au destinataire qu'il peut continuer à ne pas répondre.
  if (rang >= 2) {
    l.push(`Merci de me confirmer d'ici la fin de la semaine si vous êtes en mesure de nous soumettre une offre. À défaut, je retirerai la demande et en informerai le client.`);
  } else {
    l.push(`Pouvez-vous m'indiquer où en est le dossier, et sous quel délai je peux espérer votre offre ?`);
  }
  l.push('');
  l.push('Avec mes remerciements et mes meilleures salutations,');
  return l.join('\n');
}

// ── L'écran ─────────────────────────────────────────────────────────────────────────────────────
function relLigneHtml(g, i) {
  const rangTxt = g.rang === 0 ? '1re relance' : g.rang === 1 ? '2e relance' : `${g.rang + 1}e relance`;
  return `<div class="rel-ligne ${g.urgent ? 'urgent' : ''}">
    <label class="rel-case"><input type="checkbox" ${_rel.sel.has(i) ? 'checked' : ''} onchange="relCocher(${i}, this.checked)"/></label>
    <div class="rel-corps">
      <div class="rel-tete">
        <b>${relEsc(g.compagnie || g.email)}</b>
        <span class="rel-pastille">${rangTxt}</span>
        <span class="rel-pastille rel-doux">${g.depuis} j de silence</span>
        ${g.urgent ? '<span class="rel-pastille rel-urgent">⏰ échéance proche</span>' : ''}
        <span class="rel-doux">${relEsc(g.email)}</span>
      </div>
      <div class="rel-dossiers">${g.items.map(x => `<span>${relEsc(opNomClient(x.o) || x.o.titre || '')}</span>`).join('')}</div>
      <label class="form-label" for="rel-objet-${i}">Objet</label>
      <input class="form-input" id="rel-objet-${i}" value="${relEsc(g.objet)}" oninput="_rel.lignes[${i}].objet=this.value"/>
      <label class="form-label" for="rel-corps-${i}">Message</label>
      <textarea class="form-input rel-texte" id="rel-corps-${i}" rows="9" oninput="_rel.lignes[${i}].corps=this.value">${relEsc(g.corps)}</textarea>
    </div>
  </div>`;
}

function relCocher(i, v) { if (v) _rel.sel.add(i); else _rel.sel.delete(i); relMajCompte(); }
function relMajCompte() {
  const b = document.getElementById('rel-envoyer');
  if (b) { b.textContent = `📨 Envoyer ${_rel.sel.size} relance${_rel.sel.size > 1 ? 's' : ''}`; b.disabled = !_rel.sel.size; }
}

async function relOuvrir() {
  creerModale('modal-relances', `<div class="opx-modale opx-modale-large rel-modale" role="dialog" aria-labelledby="rel-titre">
    <h3 id="rel-titre">🔔 Relances d'offres</h3>
    <div class="opx-modale-sous">Calcul en cours…</div>
    <div id="rel-liste"><div class="dbx-chargement"><span></span><span></span><span></span></div></div>
  </div>`, { padding: '16px' });
  try { await relCharger(); } catch (e) { showError('Relances : ' + (e.message || e)); return; }
  const m = document.getElementById('modal-relances');
  if (!m) return;
  const n = _rel.lignes.length;
  m.querySelector('.opx-modale-sous').textContent = n
    ? `${n} compagnie${n > 1 ? 's' : ''} à relancer — un message par compagnie, regroupant ses dossiers.`
    : 'Rien à relancer aujourd’hui : toutes les demandes envoyées sont dans les délais.';
  document.getElementById('rel-liste').innerHTML = n
    ? _rel.lignes.map(relLigneHtml).join('') + `<div class="opx-modale-actions">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-relances').remove()">Fermer</button>
        <button type="button" class="btn-save" id="rel-envoyer" onclick="relEnvoyer()"></button></div>`
    : `<div class="rel-vide">✓ Aucune relance due. Le délai se resserre à chaque tour : ${REL_SEUILS.join(', ')} jours, et ${REL_SEUIL_URGENT} jours quand l’échéance du client est à moins de ${REL_ECHEANCE_PROCHE} jours.</div>
       <div class="opx-modale-actions"><button type="button" class="btn-secondary" onclick="document.getElementById('modal-relances').remove()">Fermer</button></div>`;
  relMajCompte();
}

async function relEnvoyer() {
  const choisis = [...(_rel.sel)].sort((a, b) => a - b).map(i => _rel.lignes[i]).filter(Boolean);
  if (!choisis.length) return;
  let envoyes = 0;
  for (const g of choisis) {
    const res = await envoyerCourriel({ a: g.email, objet: g.objet, texte: g.corps, contexte: `relance ${g.compagnie || ''}`.trim() });
    if (res.annule) continue;
    if (!res.ok) break;                       // erreur réelle : on s'arrête plutôt que d'enchaîner
    envoyes++;
    // La relance est datée sur CHAQUE offre du groupe, sinon le tour suivant la redemande aussitôt.
    for (const x of g.items) {
      const r = await majListeJson('demandes_offre', x.d.id, 'compagnies_envoi',
        l => l.map((e, i) => i === x.idx ? { ...e, relance_le: opAuj(), relances: (Number(e.relances) || (e.relance_le ? 1 : 0)) + 1 } : e),
        x.d.compagnies_envoi);
      if (r && r.liste) x.d.compagnies_envoi = r.liste;
      if (typeof ajouterLigneHistoriqueOpportunite === 'function')
        await ajouterLigneHistoriqueOpportunite(x.o.id, `🔔 Relance ${x.rang + 2 > 2 ? (x.rang + 2) + 'e' : ''} envoyée à ${x.e.compagnie || g.email}`.replace('  ', ' '));
    }
  }
  document.getElementById('modal-relances')?.remove();
  if (envoyes) showError(`✓ ${envoyes} relance${envoyes > 1 ? 's' : ''} envoyée${envoyes > 1 ? 's' : ''}.`);
  if (typeof opRafraichir === 'function') opRafraichir();
}

// ── Le bouton, dans l'écran des courriels ───────────────────────────────────────────────────────
(function relPoser() {
  if (typeof viewCofidex !== 'function') return;
  const nom = 'viewCofidex';
  const origine = window[nom];
  window[nom] = function () {
    const html = origine.apply(this, arguments);
    setTimeout(() => {
      const tete = document.querySelector('.ccx-vue .dx-tete');
      if (!tete || tete.querySelector('.rel-bouton')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-save rel-bouton';
      b.textContent = '🔔 Relances d’offres';
      b.title = 'Les demandes restées sans réponse, regroupées par compagnie, avec le message déjà écrit';
      b.onclick = relOuvrir;
      tete.appendChild(b);
    }, 0);
    return html;
  };
})();
