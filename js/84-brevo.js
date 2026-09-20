// ═══ BREVO (20.09.2026) ════════════════════════════════════════════════════════════════════════
// Le CRM n'appelle jamais api.brevo.com directement : la clé serait dans le code d'une page web,
// donc publiée. Tout passe par la fonction serveur « brevo » (verify_jwt actif), qui détient la
// clé dans les secrets Supabase et n'expose qu'une liste blanche d'actions — aucune d'envoi.
//
// CE QUE CET ÉCRAN APPORTE. Les cartes du tableau des campagnes portaient des chiffres saisis à la
// main, relevés dans Brevo. Une statistique recopiée est une statistique qui vieillit en silence :
// personne ne sait, en la lisant, si elle date d'hier ou de trois semaines. Ici les chiffres sont
// relevés à la demande, horodatés, et le report dans le CRM est explicite — on voit ce qu'on
// écrase avant de l'écraser.

const BRV_FONCTION = `${typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : ''}/functions/v1/brevo`;

window._brv = window._brv || { etat: 'inconnu', compte: null, campagnes: [], erreur: '', releve: null };

function brvEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function brvNb(n) { return Number(n || 0).toLocaleString('fr-CH'); }
function brvPct(n) { return `${String(Number(n || 0)).replace('.', ',')} %`; }

async function brvAppel(action, params) {
  if (typeof SUPABASE_URL === 'undefined') return { ok: false, erreur: 'Configuration absente.' };
  try {
    const jeton = (typeof getValidAccessToken === 'function' ? await getValidAccessToken() : null) || SUPABASE_KEY;
    const r = await fetch(BRV_FONCTION, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(params || {}) }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, erreur: String(e.message || e) };
  }
}

// ── L'écran ─────────────────────────────────────────────────────────────────────────────────────
function viewBrevo() {
  setTimeout(() => brvCharger(), 0);
  return `
    <section class="fcx-hero brv-hero">
      <div class="fcx-hero-deco" aria-hidden="true"></div>
      <div>
        <span class="cf-surtitre">Emailing</span>
        <h1>Brevo</h1>
        <p>Les campagnes et leurs chiffres, relevés à la demande. La clé d’API reste sur le serveur :
          le CRM ne la voit jamais, et elle n’est donc pas dans le dépôt public.</p>
      </div>
      <div class="cf-hero-actions">
        <button type="button" class="fcx-btn-verre" onclick="brvCharger()">↻ Relever</button>
        <a class="fcx-btn-blanc" href="https://app.brevo.com/marketing-campaigns" target="_blank" rel="noopener">Ouvrir Brevo ↗</a>
      </div>
    </section>
    <div id="brv-corps"></div>`;
}

async function brvCharger() {
  const zone = document.getElementById('brv-corps');
  if (!zone) return;
  zone.innerHTML = '<section class="dbx-carte brv-carte"><div class="dbx-chargement"><span></span><span></span><span></span></div></section>';

  const compte = await brvAppel('compte');
  if (!compte || !compte.ok) {
    window._brv.etat = 'erreur'; window._brv.erreur = (compte && compte.erreur) || 'Appel impossible.';
    zone.innerHTML = brvNonConfigureHtml(window._brv.erreur);
    return;
  }
  const camp = await brvAppel('campagnes', { limite: 50 });
  window._brv.etat = 'ok';
  window._brv.compte = compte;
  window._brv.campagnes = (camp && camp.ok && camp.campagnes) || [];
  window._brv.releve = new Date();
  zone.innerHTML = brvCorpsHtml();
}

function brvNonConfigureHtml(erreur) {
  const manque = /BREVO_API_KEY/i.test(erreur);
  return `<section class="dbx-carte brv-carte">
    <header class="dbx-carte-tete"><div><h2>Connexion</h2>
      <span class="dbx-carte-sous">${manque ? 'Clé non configurée' : 'Brevo n’a pas répondu'}</span></div></header>
    <div class="brv-message ${manque ? 'info' : 'alerte'}">
      <b>${manque ? 'Il manque la clé d’API.' : 'La connexion a échoué.'}</b>
      ${manque ? `<ol>
          <li>Brevo → <b>SMTP &amp; API</b> → onglet <b>Clés API</b> → générer une clé (elle commence par <code>xkeysib-</code>)</li>
          <li>Supabase → projet → <b>Edge Functions</b> → <b>Secrets</b> → secret nommé <code>BREVO_API_KEY</code></li>
        </ol>
        <p class="brv-note">Une clé SMTP (<code>xsmtpsib-</code>) ne convient pas : elle sert au relais
          d’envoi, pas à l’API v3 que le CRM interroge.</p>`
        : `<p class="brv-note">${brvEsc(erreur)}</p>
           <p class="brv-note">Si la clé vient d’être remplacée, vérifiez qu’elle est bien de type
             <b>API</b> et non <b>SMTP</b>, et qu’elle n’a pas été révoquée.</p>`}
    </div>
  </section>`;
}

function brvCorpsHtml() {
  const B = window._brv;
  const c = B.compte || {};
  const camp = B.campagnes;
  const envoyees = camp.filter(x => x.statut === 'sent');
  const brouillons = camp.filter(x => x.statut === 'draft');

  // Les moyennes ne se calculent que sur ce qui est parti : inclure les brouillons (zéro envoi)
  // ferait tomber tous les taux, et un taux faux est pire qu'un taux absent.
  const moy = cle => envoyees.length
    ? Math.round(envoyees.reduce((s, x) => s + Number(x[cle] || 0), 0) / envoyees.length * 10) / 10
    : null;

  return `
    <section class="dbx-carte brv-carte">
      <header class="dbx-carte-tete">
        <div><h2>Connexion établie</h2>
          <span class="dbx-carte-sous">${brvEsc(c.email || '')}${c.societe ? ' · ' + brvEsc(c.societe) : ''}
            ${B.releve ? '· relevé à ' + B.releve.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>
        <span class="brv-pastille ok">✓ Active</span>
      </header>
      <div class="brv-kpis">
        <div class="brv-kpi"><b>${brvEsc(c.plan || '—')}</b><small>Formule</small></div>
        <div class="brv-kpi"><b>${brvNb(c.credits)}</b><small>${brvEsc(c.type_credits === 'sendLimit' ? 'envois par jour' : (c.type_credits || 'crédits'))}</small></div>
        <div class="brv-kpi"><b>${envoyees.length}</b><small>campagnes envoyées</small></div>
        <div class="brv-kpi"><b>${brouillons.length}</b><small>brouillons</small></div>
        ${moy('taux_ouverture') != null ? `<div class="brv-kpi"><b>${brvPct(moy('taux_ouverture'))}</b><small>ouverture moyenne</small></div>` : ''}
        ${moy('taux_clic') != null ? `<div class="brv-kpi"><b>${brvPct(moy('taux_clic'))}</b><small>clic moyen</small></div>` : ''}
      </div>
      ${!envoyees.length ? `<p class="brv-note">Aucune campagne n’est encore partie : les taux
        apparaîtront après le premier envoi. Les taux sont calculés sur les messages <b>livrés</b>,
        pas sur les envois — un message tombé en rebond n’a jamais eu la moindre chance d’être
        ouvert, l’inclure ferait mentir le taux.</p>` : ''}
    </section>

    <section class="dbx-carte brv-carte">
      <header class="dbx-carte-tete"><div><h2>Campagnes</h2>
        <span class="dbx-carte-sous">${camp.length} campagne${camp.length > 1 ? 's' : ''} · les envoyées d’abord</span></div></header>
      ${camp.length ? `<div class="brv-table-enveloppe"><table class="brv-table">
        <thead><tr><th><span>Campagne</span></th><th><span>État</span></th>
          <th class="d"><span>Envoyés</span></th><th class="d"><span>Ouvertures</span></th>
          <th class="d"><span>Clics</span></th><th><span></span></th></tr></thead>
        <tbody>${camp.slice().sort((a, b) => (b.statut === 'sent') - (a.statut === 'sent')
            || String(b.cree_le).localeCompare(String(a.cree_le)))
          .map(brvLigneHtml).join('')}</tbody>
      </table></div>` : '<div class="dbx-vide-petit">Aucune campagne dans ce compte.</div>'}
    </section>`;
}

const BRV_ETATS = {
  sent: ['Envoyée', 'ok'], draft: ['Brouillon', 'neutre'], queued: ['En file', 'attente'],
  inProcess: ['En cours', 'attente'], suspended: ['Suspendue', 'alerte'],
  archive: ['Archivée', 'neutre'], cancelled: ['Annulée', 'alerte'],
};

function brvLigneHtml(x) {
  const [nom, ton] = BRV_ETATS[x.statut] || [x.statut, 'neutre'];
  const partie = x.statut === 'sent';
  const lien = (typeof kbcCampagneParBrevo === 'function' && kbcCampagneParBrevo(x.id)) || null;
  return `<tr>
    <td><b>${brvEsc(x.nom || '')}</b><small>${brvEsc(x.sujet || '')}</small></td>
    <td><span class="brv-pastille ${ton}">${brvEsc(nom)}</span></td>
    <td class="d">${partie ? brvNb(x.envoyes) : '<span class="brv-vide">—</span>'}</td>
    <td class="d">${partie ? `${brvNb(x.ouvertures)}<small>${brvPct(x.taux_ouverture)}</small>` : '<span class="brv-vide">—</span>'}</td>
    <td class="d">${partie ? `${brvNb(x.clics)}<small>${brvPct(x.taux_clic)}</small>` : '<span class="brv-vide">—</span>'}</td>
    <td class="brv-actions">
      ${partie && typeof kbcReporterChiffres === 'function'
        ? `<button type="button" class="brv-act" onclick="brvReporter(${Number(x.id)})">Reporter dans le CRM</button>` : ''}
      <a class="brv-act" href="${brvEsc(x.lien)}" target="_blank" rel="noopener">Rapport ↗</a>
      ${lien ? '<span class="brv-lie" title="Reliée à une campagne du tableau">🔗</span>' : ''}
    </td>
  </tr>`;
}

// Le report vers le tableau des campagnes (js/70). On ne l'exécute que si la campagne du CRM
// existe et porte bien cet identifiant Brevo : écrire des chiffres dans la mauvaise campagne est
// une erreur qu'on ne remarque pas avant longtemps.
async function brvReporter(brevoId) {
  const x = (window._brv.campagnes || []).find(c => Number(c.id) === Number(brevoId));
  if (!x) return;
  if (typeof kbcReporterChiffres !== 'function') {
    if (typeof showError === 'function') showError('Le tableau des campagnes n’est pas chargé.');
    return;
  }
  const r = await kbcReporterChiffres(brevoId, {
    envoyes: x.envoyes, ouvertures: x.ouvertures, clics: x.clics,
    desabonnements: x.desabonnements, rebonds: x.rebonds,
    releve_le: new Date().toISOString(),
  });
  if (typeof showError === 'function') {
    showError(r && r.ok ? `✓ Chiffres reportés sur « ${r.nom} »` : (r && r.erreur) || 'Aucune campagne du tableau ne porte ce numéro Brevo.');
  }
}

(function brvBrancher() {
  if (typeof NAV_SYNONYMES !== 'undefined') {
    NAV_SYNONYMES['brevo'] = 'brevo email emailing newsletter campagne statistiques ouverture clic sendinblue';
  }
})();
