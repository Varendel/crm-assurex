// ═══ ESPACE CLIENT : LES PRIMES MALADIE, ET LE RESTE (20.09.2026) ══════════════════════════════
// Demandes de Jonathan, toutes côté client :
//   — la mini photo du conseiller ;
//   — un texte de réassurance sur le transfert : « nous nous occupons de tout » ;
//   — le nom du client illisible dans le bandeau ;
//   — un widget d'échéances suivant la sortie des primes LAMal, avec le lien priminfo.
//
// SUR LE CANTON, ET POURQUOI JE NE LE DÉDUIS PAS DU NPA.
// Les primes varient par canton ET par région de primes à l'intérieur d'un canton. Le NPA est
// renseigné chez 237 clients sur 253, le canton chez 26 seulement — la tentation était de déduire
// l'un de l'autre. Mais les plages de NPA ne suivent pas les frontières cantonales : 1530 Payerne
// est vaudois alors qu'il est entouré de NPA fribourgeois. Se tromper de canton, c'est afficher
// les primes d'un autre. On passe donc le NPA à priminfo, qui est l'autorité sur la question, et
// on affiche le canton uniquement quand il est enregistré sur la fiche.
//
// SUR LES DATES. L'OFSP publie les primes de l'année suivante fin septembre, sans date fixe d'une
// année à l'autre. Je n'en invente pas : tant que Jonathan n'a pas saisi la date réelle, le widget
// dit « attendue fin septembre ». Le 30 novembre, lui, est une règle de loi et non une estimation.

const ECP_DELAI_RESILIATION = { jour: 30, mois: 11 };   // arrivée chez l'assureur au plus tard
const ECP_PRIMINFO = 'https://www.priminfo.admin.ch/fr';
const ECP_CLE_DATE = 'rex-primes-publication';           // date réelle, saisie par le conseiller

function ecpEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function ecpAnneeCible() {
  const d = new Date();
  // Après le 1er décembre, les primes de l'année suivante sont déjà connues : on bascule.
  return d.getMonth() >= 11 ? d.getFullYear() + 2 : d.getFullYear() + 1;
}

function ecpDatePublication() {
  try { return localStorage.getItem(ECP_CLE_DATE) || null; } catch (e) { return null; }
}

function ecpJoursRestants() {
  const d = new Date();
  const limite = new Date(d.getFullYear(), ECP_DELAI_RESILIATION.mois - 1, ECP_DELAI_RESILIATION.jour, 23, 59, 59);
  if (limite < d) limite.setFullYear(limite.getFullYear() + 1);
  return { jours: Math.ceil((limite - d) / 86400000), limite };
}

// Le canton normalisé, uniquement s'il est enregistré. « genève », « Vaud » et « VD » cohabitent
// dans la base : on les ramène à une forme unique plutôt que d'afficher ce qui a été tapé.
const ECP_CANTONS = {
  vd: 'Vaud', vaud: 'Vaud', ge: 'Genève', geneve: 'Genève', genève: 'Genève',
  vs: 'Valais', valais: 'Valais', fr: 'Fribourg', fribourg: 'Fribourg',
  ne: 'Neuchâtel', neuchatel: 'Neuchâtel', neuchâtel: 'Neuchâtel',
  ju: 'Jura', jura: 'Jura', be: 'Berne', berne: 'Berne',
};
function ecpCanton(client) {
  const brut = String((client && client.canton) || '').trim().toLowerCase();
  if (!brut || brut === 'france') return null;
  return ECP_CANTONS[brut] || (brut.length <= 3 ? brut.toUpperCase() : brut.charAt(0).toUpperCase() + brut.slice(1));
}

// Jonathan : « widget que pour privé, entreprise pas de LAMal ». C'est exact et ce n'est pas une
// préférence d'affichage : la LAMal est une assurance de personnes, une Sàrl n'en a pas. Afficher
// un compte à rebours de résiliation à une entreprise, ce serait lui parler d'un contrat qu'elle
// n'a pas. On réutilise estEntreprise() du catalogue plutôt que de relire `segment` ici — une
// seule définition de ce qu'est une entreprise dans toute l'application.
function ecpEstPrive(c) {
  if (typeof estEntreprise === 'function') return !estEntreprise(c);
  return String((c && c.segment) || '').trim().toLowerCase() !== 'entreprise';
}

function ecpWidgetPrimes() {
  const E = window._ec || {};
  const c = E.client || {};
  if (!ecpEstPrive(c)) return '';
  const annee = ecpAnneeCible();
  const publication = ecpDatePublication();
  const { jours, limite } = ecpJoursRestants();
  const canton = ecpCanton(c);
  const npa = String(c.npa || '').trim();
  const lieu = [npa, c.ville].filter(Boolean).join(' ');

  const urgence = jours <= 21 ? 'urgent' : jours <= 60 ? 'proche' : '';

  return `<section class="dbx-carte ecp-carte" style="margin-top:18px">
    <header class="dbx-carte-tete">
      <div><h2>Primes maladie ${annee}</h2>
        <span class="dbx-carte-sous">Suivez la sortie des primes selon votre région</span></div>
    </header>

    <div class="ecp-corps">
      <div class="ecp-etat ${publication ? 'publiees' : 'attente'}">
        <span class="ecp-etat-icone" aria-hidden="true">${publication ? '📣' : '⏳'}</span>
        <div>
          <b>${publication
            ? `Primes ${annee} publiées le ${fmtDate(publication)}`
            : `Primes ${annee} — annonce attendue fin septembre`}</b>
          <small>L’Office fédéral de la santé publique publie chaque automne les primes de
            l’assurance obligatoire pour l’année suivante. Elles varient selon le canton et,
            à l’intérieur d’un canton, selon la région de primes.</small>
        </div>
      </div>

      <div class="ecp-grille">
        <div class="ecp-bloc">
          <span class="ecp-label">Votre région</span>
          <b>${lieu ? ecpEsc(lieu) : 'non renseignée'}</b>
          <small>${canton ? 'Canton de ' + ecpEsc(canton) : 'Indiquez votre NPA à votre conseiller pour un suivi précis'}</small>
        </div>
        <div class="ecp-bloc ${urgence}">
          <span class="ecp-label">Changer de caisse au 1er janvier</span>
          <b>${jours} jour${jours > 1 ? 's' : ''}</b>
          <small>La résiliation doit parvenir à votre assureur au plus tard le ${fmtDate(limite.toISOString().slice(0, 10))}.</small>
        </div>
      </div>

      <div class="ecp-actions">
        <a class="btn-secondary" href="${ECP_PRIMINFO}" target="_blank" rel="noopener">
          🔎 Comparer sur priminfo.admin.ch ↗</a>
        <button type="button" class="btn-save" onclick="ecpDemanderComparatif()">
          Demandez-moi un comparatif</button>
      </div>

      <p class="ecp-note">priminfo.admin.ch est le comparateur officiel de la Confédération :
        vous y entrez votre NPA et il affiche les primes de votre région. Si vous préférez, nous le
        faisons pour vous — et nous nous occupons du changement de bout en bout si vous décidez de
        le faire.</p>
    </div>
  </section>`;
}

// Le bouton ouvre le message déjà écrit : personne ne rédige une demande à 22 h un dimanche.
function ecpDemanderComparatif() {
  const annee = ecpAnneeCible();
  if (typeof ecOuvrirMessage !== 'function') return;
  ecOuvrirMessage();
  setTimeout(() => {
    const sujet = document.getElementById('ec-msg-sujet');
    const corps = document.getElementById('ec-msg-corps');
    if (sujet && !sujet.value) sujet.value = `Comparatif des primes maladie ${annee}`;
    if (corps && !corps.value) {
      corps.value = `Bonjour,\n\nPourriez-vous comparer les primes ${annee} pour ma situation et me dire s’il y a un intérêt à changer ?\n\nMerci d’avance.`;
    }
  }, 80);
}

// ── Le mini logo de l'en-tête ───────────────────────────────────────────────────────────────────
// Le bandeau portait un nuage générique suivi de « REX CLOUD » écrit en HTML. Il porte maintenant
// la vraie marque, en blanc, dans sa version mini — resserrée et sans accroche, parce qu'un logo
// qui marche à 22 px n'est jamais le grand mis à l'échelle. Le fichier est servi en image plutôt
// qu'incorporé : le navigateur le met en cache d'une page à l'autre.
const ECP_MINI_LOGO = '<img src="assets/logos/rex-cloud-mini-blanc.svg" alt="REX CLOUD" class="ecp-mini-logo"/>';

// ── Le conseiller, avec sa photo ────────────────────────────────────────────────────────────────
// Une photo vaut mieux que deux initiales dans un rond : l'espace client sert aussi à rappeler
// qu'il y a quelqu'un derrière. La photo est celle du profil, détourée sur fond de marque.
const ECP_PHOTO_CONSEILLER = 'assets/logos/photo-profil-assurex-bleu.png';

function ecpOngletConseiller() {
  const co = typeof ecConseiller === 'function' ? ecConseiller() : {};
  const initiales = (co.nom || '?').split(/\s+/).map(m => m[0]).join('').slice(0, 2).toUpperCase();
  return `<section class="dbx-carte ec-conseiller" style="margin-top:18px">
      <header class="dbx-carte-tete"><h2>Mon conseiller</h2></header>
      <div class="ec-co-carte">
        <div class="ec-co-ident">
          <span class="ecp-photo">
            <img src="${ECP_PHOTO_CONSEILLER}" alt=""
              onerror="this.remove()" loading="lazy"/>
            <span class="ecp-photo-repli" aria-hidden="true">${ecpEsc(initiales)}</span>
          </span>
          <div><b>${ecpEsc(co.nom)}</b><small>${ecpEsc(co.role)}</small><small>${ecpEsc(co.agrement)}</small></div>
        </div>
        <div class="ec-co-liens">
          <a href="tel:${ecpEsc((co.tel || '').replace(/\s/g, ''))}">📞 ${ecpEsc(co.tel)}</a>
          <a href="mailto:${ecpEsc(co.email)}">✉️ ${ecpEsc(co.email)}</a>
        </div>
        <div class="ec-co-actions">
          <button type="button" class="btn-save" onclick="ecOuvrirMessage()">💬 Lui écrire depuis mon espace</button>
          <button type="button" class="btn-secondary" onclick="ecOuvrirMessageMotif('rendez_vous')">📅 Demander un rendez-vous</button>
        </div>
        <p class="ec-suivi-txt">Assurex Sàrl — Rue du Centre 142, 1025 St-Sulpice · succursale c/o Cofidex SA,
          Ch. de Pallud 3, 1822 Chernex. Écrire depuis l’espace garde l’échange rattaché à votre dossier.</p>
      </div>
    </section>`;
}

// ── La réassurance sur le transfert ─────────────────────────────────────────────────────────────
// Le texte de Jonathan, mot pour mot : c'est la promesse commerciale, elle ne se reformule pas.
function ecpRassuranceHtml() {
  return `<div class="ecp-rassurance">
    <span class="ecp-rassurance-icone" aria-hidden="true">🤝</span>
    <div>
      <b>Nous nous occupons de tout.</b>
      <p>Vos assureurs nous transmettent vos polices, vous n’avez rien à faire. Une fois vos polices
        obtenues, vous les retrouvez ici, dans le dossier correspondant à votre contrat.
        <b>Vos couvertures restent inchangées.</b></p>
    </div>
  </div>`;
}

// On remplace l'onglet conseiller sans toucher à js/52 : la fonction y est appelée par son nom.
// Le widget primes, lui, se pose en tête de « Mes contrats » : c'est là que le client voit déjà
// ses dates de résiliation, donc c'est là qu'une échéance de résiliation a du sens. Sur l'accueil
// il aurait été un rappel de plus ; ici il est la suite logique de ce qu'il regarde.
(function ecpBrancher() {
  if (typeof ecOngletConseiller === 'function') window.ecOngletConseiller = ecpOngletConseiller;

  if (typeof ecOngletContrats === 'function') {
    const origine = ecOngletContrats;
    window.ecOngletContrats = function () {
      // ecpWidgetPrimes() rend une chaîne vide pour une entreprise : rien à tester de plus ici.
      return ecpWidgetPrimes() + origine.apply(this, arguments);
    };
  }
})();
