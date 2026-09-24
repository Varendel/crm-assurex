// ═══ CONFIG ═══
const SUPABASE_URL = 'https://gutlkjovmsyazwcomoyt.supabase.co';

// Ouvre/ferme le menu en tiroir sur mobile (iPhone) — sans effet sur desktop (la sidebar y est
// toujours visible, cf. CSS). forceState optionnel (true/false) pour fermer explicitement
// (ex: clic sur l'overlay, ou après avoir choisi une page dans le menu).
function toggleSidebarMobile(forceState) {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (!sb || !ov) return;
  const open = typeof forceState === 'boolean' ? forceState : !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  ov.classList.toggle('open', open);
}
const DATE_BASCULE_ASSUREX = '2026-06-01'; // Date à partir de laquelle les commissions sont versées à Assurex
const AI_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/clever-worker`;
const SUPABASE_KEY = 'sb_publishable_DJtZwHKeA5X1ck1coAQFOA_xOd7c02i';

// ═══ FORMATAGE DES MONTANTS CHF (séparateur de milliers) ═══
// Utilisé partout où un montant CHF est affiché, pour la lisibilité — décision de Jonathan le
// 06.08.2026. fmtCHF garde le nombre de décimales tel quel (aucune si entier, jusqu'à 2 sinon) ;
// fmtCHF2 force toujours 2 décimales (relevés/rapports comptables).
function fmtCHF(n) {
  const num = Number(n);
  if (!isFinite(num)) return '0';
  return num.toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
// Lit un montant tel qu'il apparaît dans les décomptes et bordereaux suisses, centimes compris :
// 1'234,50 · 1’234.50 · 1 234,50 · CHF 12,50 · -12,50 · 12.50- · (12,50). parseFloat s'arrêtait à la
// virgule (« 12,50 » → 12) et à l'apostrophe (« 1'234,50 » → 1) — correctif du 19.09.2026.
function nombreCH(v) {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/CHF|Fr\.?|SFr\.?/gi, '').replace(/[\s  '’‘`´]/g, '');
  let negatif = false;
  if (/^\(.*\)$/.test(s)) { negatif = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { negatif = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { negatif = !negatif; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  const derVirgule = s.lastIndexOf(','), derPoint = s.lastIndexOf('.');
  if (derVirgule !== -1 && derPoint !== -1) {
    // Les deux présents : le dernier des deux est le séparateur décimal
    s = derVirgule > derPoint ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (derVirgule !== -1) {
    // Virgule seule : décimale (usage suisse romand), sauf si plusieurs virgules (milliers)
    s = (s.match(/,/g).length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, ''); // 1.234.567 → milliers
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : (negatif ? -n : n);
}
function fmtCHF2(n) {
  const num = Number(n);
  if (!isFinite(num)) return '0.00';
  return num.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ═══ AUTOCOMPLÉTION ADRESSES SUISSES (swisstopo geo.admin.ch — sans clé, CORS OK) ═══
const CANTON_MAP = {
  'AG':'AG','AI':'AI','AR':'AR','BE':'BE','BL':'BL','BS':'BS','FR':'FR','GE':'GE',
  'GL':'GL','GR':'GR','JU':'JU','LU':'LU','NE':'NE','NW':'NW','OW':'OW','SG':'SG',
  'SH':'SH','SO':'SO','SZ':'SZ','TG':'TG','TI':'TI','UR':'UR','VD':'VD','VS':'VS',
  'ZG':'ZG','ZH':'ZH',
};

let _addrDebounceTimer = null;
let _addrDropdown = null;

// Parse le champ "detail" de geo.admin.ch : "rue de la paix 1 1003 lausanne 5586 lausanne ch vd"
function _parseGeoDetail(detail) {
  if (!detail) return {};
  const parts = detail.trim().split(' ');
  const canton = CANTON_MAP[parts[parts.length - 1]?.toUpperCase()] || '';
  // NPA = premier token qui est un nombre à 4 chiffres
  let npaIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (/^\d{4}$/.test(parts[i])) { npaIdx = i; break; }
  }
  const npa = npaIdx >= 0 ? parts[npaIdx] : '';
  const rue = npaIdx > 0 ? parts.slice(0, npaIdx).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
  // Ville = mot(s) après NPA jusqu'au prochain nombre ou "ch"
  let ville = '';
  if (npaIdx >= 0) {
    const rest = parts.slice(npaIdx + 1);
    const stopIdx = rest.findIndex(w => /^\d+$/.test(w) || w === 'ch');
    const villeWords = stopIdx >= 0 ? rest.slice(0, stopIdx) : rest.slice(0, 2);
    ville = villeWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return { rue, npa, ville, canton };
}

function initAdresseAutocomplete(inputId, onSelect) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.setAttribute('autocomplete', 'off');
  input.addEventListener('input', () => {
    clearTimeout(_addrDebounceTimer);
    const q = input.value.trim();
    if (q.length < 3) { _closeAddrDropdown(); return; }
    _addrDebounceTimer = setTimeout(() => _fetchAddrSuggestions(q, input, onSelect), 300);
  });
  input.addEventListener('blur', () => setTimeout(_closeAddrDropdown, 200));
}

// ── ADRESSES FRANÇAISES (24.09.2026) ───────────────────────────────────────────────────────────
// « Est-ce que ça existe et facilement connectable, une recherche d'adresse française ? » Oui : la
// Base Adresse Nationale, publiée par l'État français. Sans clé, sans compte, CORS ouvert, licence
// ouverte — exactement les mêmes conditions que geo.admin.ch pour la Suisse. Les deux sources sont
// donc interrogées EN PARALLÈLE sur le même champ : on ne demande pas à qui saisit de choisir le
// pays d'abord, l'adresse se reconnaît d'elle-même.
//
// Testé le 24.09.2026 contre les deux points d'entrée. `api-adresse.data.gouv.fr` est l'historique ;
// `data.geopf.fr` est celui de la Géoplateforme de l'IGN, qui lui succède. Les deux répondent, et
// le second sert de repli — le jour où le premier s'arrête, rien ne casse.
const BAN_POINTS = [
  'https://api-adresse.data.gouv.fr/search/',
  'https://data.geopf.fr/geocodage/search',
];

// Le numéro de maison tapé par l'utilisateur, quand la Base Adresse Nationale ne le connaît pas.
// Beaucoup de rues n'ont pas toutes leurs plaques référencées : la recherche rend alors la RUE,
// sans numéro. Choisir cette suggestion effaçait le « 59 » qu'on venait de taper — sans le dire.
// On le récupère du texte saisi pour le recoller sur une suggestion de type « street ».
function _numeroSaisi(q) {
  const m = String(q || '').trim().match(/(?:^|\s)(\d+\s*[a-zA-Z]?)(?=\s|,|$)/);
  return m ? m[1].replace(/\s+/g, '') : '';
}

async function _fetchAdressesFr(q) {
  const numero = _numeroSaisi(q);
  for (const base of BAN_POINTS) {
    try {
      const r = await fetch(`${base}?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`);
      if (!r.ok) continue;
      const d = await r.json();
      const traits = (d && d.features) || [];
      if (!traits.length) return [];
      // On rend le MÊME objet que le suisse pour que la liste et la sélection ne sachent pas d'où
      // ça vient : rue, npa, ville. Le canton n'a pas d'équivalent — on met le département, qui
      // joue le même rôle d'orientation à l'écran.
      return traits.filter(t => t.properties && t.properties.label).map(t => {
        const p = t.properties;
        // L'usage suisse met le numéro APRÈS la rue ; la BAN le rend avant. On suit l'usage local,
        // c'est ce qui sera imprimé sur une police.
        const voie = p.street || p.name || '';
        const num = p.housenumber || (p.type === 'street' ? numero : '');
        const rue = [voie, num].filter(Boolean).join(' ').trim();
        return {
          _fr: true,
          label: num && !p.housenumber ? `${rue} — ${p.postcode || ''} ${p.city || ''}`.trim() : p.label,
          sous: p.context || '',
          parsed: { rue, npa: p.postcode || '', ville: p.city || '', canton: '', pays: 'France' },
        };
      });
    } catch (e) { /* point suivant */ }
  }
  return [];
}

async function _fetchAddrSuggestions(q, input, onSelect) {
  try {
    const urlCh = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(q)}&type=locations&origins=address&limit=8&lang=fr`;
    // Les deux pays en même temps, et aucune ne doit pouvoir faire tomber l'autre : une source
    // indisponible rend une liste vide, elle n'annule pas la recherche.
    const [ch, fr] = await Promise.all([
      fetch(urlCh).then(r => (r.ok ? r.json() : null)).then(d => (d && d.results) || []).catch(() => []),
      _fetchAdressesFr(q),
    ]);
    _showAddrDropdown([...ch, ...fr], input, onSelect);
  } catch(e) { console.error('Addr autocomplete error', e); }
}

function _showAddrDropdown(results, input, onSelect) {
  _closeAddrDropdown();
  if (!results.length) return;
  const rect = input.getBoundingClientRect();
  const dd = document.createElement('div');
  dd.id = 'addr-autocomplete-dd';
  dd.style.cssText = `position:fixed;top:${rect.bottom + 2}px;left:${rect.left}px;width:${Math.max(rect.width, 320)}px;background:var(--surface);border:1px solid var(--border);border-radius:10px;z-index:99999;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.5);max-height:260px;overflow-y:auto`;
  results.forEach(res => {
    // Deux origines, une seule liste : le suisse arrive en `attrs`, le français déjà mis en forme.
    const attrs = res.attrs || {};
    const parsed = res._fr ? res.parsed : _parseGeoDetail(attrs.detail);
    const label = res._fr ? res.label : (attrs.label ? attrs.label.replace(/<[^>]+>/g, '') : '');
    if (!label) return;
    const sous = res._fr ? `🇫🇷 ${res.sous}` : (parsed.canton ? `Canton ${parsed.canton}` : '');
    const item = document.createElement('div');
    item.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:13px;color:var(--text);border-bottom:1px solid var(--border);line-height:1.4;transition:background 0.1s';
    item.innerHTML = `<div style="font-weight: 600">${label}</div>${sous ? `<div style="font-size:11px;color:var(--text-muted)">${sous}</div>` : ''}`;
    item.addEventListener('mousedown', () => { onSelect(parsed); _closeAddrDropdown(); });
    item.addEventListener('mouseover', () => item.style.background = 'var(--surface-hover)');
    item.addEventListener('mouseout', () => item.style.background = 'transparent');
    dd.appendChild(item);
  });
  if (!dd.children.length) return;
  document.body.appendChild(dd);
  _addrDropdown = dd;
}

function _closeAddrDropdown() {
  if (_addrDropdown) { _addrDropdown.remove(); _addrDropdown = null; }
}

// Raccourci recherche Zefix (registre du commerce) — ouvre la recherche pré-remplie dans un nouvel onglet
// À remplacer par une auto-complétion intégrée une fois les identifiants API obtenus (zefix@bj.admin.ch)
function rechercheZefix(inputId) {
  const nom = (document.getElementById(inputId)?.value || '').trim();
  const url = nom
    ? `https://www.zefix.ch/fr/search/entity/list?name=${encodeURIComponent(nom)}&searchType=exact`
    : `https://www.zefix.ch/fr/search/entity/list`;
  window.open(url, '_blank');
}

function bindAdresseAutocomplete(fieldMap) {
  const { adresseId, npaId, villeId, cantonId, npaVilleId, champUnique } = fieldMap;
  const adresseInput = document.getElementById(adresseId);
  if (!adresseInput) return;
  initAdresseAutocomplete(adresseId, ({ rue, npa, ville, canton }) => {
    if (adresseInput) adresseInput.value = champUnique ? `${rue}, ${npa} ${ville}`.trim().replace(/^,\s*/, '') : rue;
    if (npaVilleId) { const el = document.getElementById(npaVilleId); if (el) el.value = `${npa} ${ville}`.trim(); }
    if (npaId) { const el = document.getElementById(npaId); if (el) el.value = npa; }
    if (villeId) { const el = document.getElementById(villeId); if (el) el.value = ville; }
    if (cantonId) { const el = document.getElementById(cantonId); if (el) el.value = canton; }
  });
}

const MSAL_CONFIG = {
  auth: {
    clientId: '4b0a711d-2bd4-41a8-9782-0b7be5daab68',
    authority: 'https://login.microsoftonline.com/a4b1f96c-aa53-4dfc-b2ed-465bb3188198',
    redirectUri: 'https://varendel.github.io/crm-assurex',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  }
};

// ═══ STATE ═══
let currentUser = null;
let currentView = 'dashboard';
let openSections = { clients: true, vente: true, 'conseil-section': true, organisation: true, compta: true, settings: false };
let allAgents = [];
let allClients = [];
let allRappels = [];
let allCollaborateurs = [];
let msalInstance = null;
let openBordereaux = {};
let contratClientId = null;
let allContrats = [];
let allOpportunites = [];
let allRendezVous = [];
let allCampagnesPersonnalisees = [];
let prefillOpportunite = null;
// Produit précis (id catalogue) à préremplir dans "Nouveau contrat" pour l'opportunité en cours de
// conversion, et file d'attente des autres produits sélectionnés sur cette même opportunité —
// permet d'enchaîner la création d'un contrat par produit quand plusieurs ont été cochés au
// pipeline, sans perdre le lien avec l'opportunité entre deux créations.
let prefillOpportuniteProduitId = null;
let oppFileAttenteProduits = [];
let prefillDemandeOffreClientId = null;
let prefillDemandeOffreOpportuniteId = null;
// Pré-remplissage du formulaire "Nouvelle tâche / rappel" depuis le bouton dédié sur la fiche
// client (onglet Rappels) — pré-sélectionne le client et force nature='tache' d'emblée.
let prefillRappelClientId = null;
let demandeOffreEnEditionId = null;
// Contrairement à demandeOffreEnEditionId (consommé et remis à null dès le premier rendu,
// pour ne servir qu'une fois comme "trigger" d'ouverture), demandeOffreActiveId persiste
// tant qu'on reste sur l'écran "nouvelle-demande-offre" : c'est lui qui permet au bouton
// retour de savoir QUELLE demande était affichée, pour la restaurer correctement.
let demandeOffreActiveId = null;
let ozAnnualSummary = null;
let allCommissionsAttente = [];
let allCommissionTranches = []; // versements partiels (commissions payées en plusieurs fois, ex. AGV TONI SA)
let allFichesPaie = [];
let allCompagniesContacts = [];
let allVehicules = [];
let currentClientId = null;
let currentCampagneId = null;

// Paramètres de taux de commission — modifiables via Paramètres (gestion récurrente)
// Acquisition: santé = primemensuelle x ce facteur ; vie = primemensuelle x12 x facteur(par année du contrat)
// ═══ MARQUAGE CLIENT OZ ASSURE ═══
// Logo officiel OZ Assure, version « tertiaire » (symbole + OZ), fourni par Jonathan le 19.09.2026
// (assets/logos/oz-assure-tertiaire-blanc.svg / -noir.svg). Monochrome : dessiné en currentColor, il
// prend la couleur du texte — foncé sur fond clair, blanc sur fond sombre ou sur le bandeau bleu.
// viewBox recadré sur le dessin (le fichier d'origine est un plan de travail 1920×1080).
const OZ_LOGO_TERTIAIRE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="28 236 1864 618" fill="currentColor" aria-hidden="true" style="height:1em;width:auto;display:block"><path d="M1088.65,823.72c-55.56,0-105.16-12.8-148.8-38.42-43.66-25.61-78.11-60.59-103.36-104.97s-37.88-95.06-37.88-152.06,12.62-107.66,37.88-152.03,59.7-79.36,103.36-104.98c43.64-25.61,93.23-38.42,148.8-38.42s104.06,12.81,147.72,38.42c43.66,25.62,78.11,60.61,103.36,104.98s37.88,95.05,37.88,152.03-12.62,107.69-37.88,152.06-59.7,79.36-103.36,104.97c-43.66,25.62-92.89,38.42-147.72,38.42ZM1088.65,721.99c33.91,0,64.22-8.47,90.91-25.42s47.61-40.05,62.77-69.27,22.38-62.22,21.66-99.03c.72-37.5-6.5-70.88-21.66-100.09s-36.08-52.12-62.77-68.72-57-24.89-90.91-24.89-64.39,8.48-91.44,25.44c-27.06,16.95-48.16,40.03-63.31,69.25s-22.36,62.23-21.64,99.02c-.72,36.81,6.48,69.81,21.64,99.03s36.25,52.31,63.31,69.27c27.05,16.95,57.53,25.42,91.44,25.42Z"/><path d="M1464.17,812.89v-93.06l293.28-391.77v12.98h-293.28v-96.31h414.48v90.91l-288.95,386.34-4.33-5.41h299.78v96.31h-420.98Z"/><path d="M334.78,393.09c0,49.66-24.16,93.69-61.36,121.02l-143.1,18.75c-55.86-21.83-95.48-76.15-95.48-139.76,0-82.82,67.15-149.97,149.97-149.97,82.82,0,149.97,67.15,149.97,149.97Z"/><path d="M481.17,489.45l-1.17,1.17c-28.08,2.33-53.2,4.08-80.69,7l-19.58,2.58c-27.74-27.24-44.95-65.15-44.95-107.1,0-15.16,2.25-29.79,6.46-43.57l139.93,139.93Z"/><path d="M634.72,393.09c0,45.74-20.45,86.65-52.74,114.18l-211.37-211.42c27.49-32.29,68.4-52.74,114.14-52.74,82.82,0,149.97,67.15,149.97,149.97Z"/><path d="M634.72,697.2c0,82.82-67.15,149.97-149.97,149.97-82.82,0-149.97-67.15-149.97-149.97,0-62.74,38.58-116.52,93.27-138.85l75.73-9.91h.04c73.82,9.37,130.89,72.4,130.89,148.76Z"/><path d="M300.95,792.05c-27.49,33.62-69.32,55.11-116.14,55.11-82.82,0-149.97-67.15-149.97-149.97,0-46.82,21.5-88.65,55.11-116.14l211,211Z"/><path d="M334.78,697.2c0,14.25-2,28.08-5.71,41.12l-148.93-148.93,1.17-1.17c27.45-1.75,53.2-4.08,80.65-8.16l14.12-1.83c35.7,27.37,58.7,70.49,58.7,118.98Z"/></svg>`;
const OZ_MINI_LOGO = `<span title="Client OZ Assure" aria-label="Client OZ Assure" role="img" style="display:inline-flex;align-items:center;margin-left:5px;vertical-align:middle;font-size:12px;line-height:1;color:currentColor;opacity:.9">${OZ_LOGO_TERTIAIRE_SVG}</span>`;

// ═══ MARQUAGE CLIENT EX GROUPE (logo officiel) ═══
const COFIDEX_MINI_LOGO = `<span title="Client EX Groupe" style="display:inline-flex;align-items:center;margin-left:4px;vertical-align:middle;border-radius:3px;overflow:hidden"><svg xmlns="http://www.w3.org/2000/svg" viewBox="670 488 180 108" style="height:16px;width:auto;vertical-align:middle"><rect x="-42.76" y="-54.33" width="2005.52" height="1188.65" fill="#0f2244"/><rect x="829.47" y="551.34" width="18.15" height="18.15" fill="#00cfff"/><rect x="686.18" y="538.2" width="48.56" height="10.09" fill="#fff"/><rect x="686.18" y="558.47" width="53.17" height="10.09" fill="#fff"/><rect x="686.18" y="518.73" width="53.17" height="10.01" fill="#fff"/><polygon points="829.47 496.06 827.87 506.11 827.61 507.83 825.24 522.76 818.89 517.34 801.9 535.92 787.85 535.92 794.91 543.55 817.93 568.41 803 568.41 787.47 551.6 758.21 583.94 743.55 583.94 780.04 543.54 757.11 518.73 771.94 518.73 787.72 535.76 810.6 510.28 804.33 504.93 829.47 496.06" fill="#fff"/></svg></span>`;
const SUVA_MINI_LOGO = `<span title="Domaine SUVA (monopole accident LAA)" style="display:inline-flex;align-items:center;margin-left:4px;vertical-align:middle;background:#fff;border-radius:3px;padding:2px 4px"><img src="data:image/png;base64,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" style="height:18px;width:auto;display:block"/></span>`;

// ═══ EN-TÊTE CORPORATE POUR EXPORTS PDF/IMPRESSION ═══
// Même logo Assurex (PNG base64) déjà utilisé sur la fiche client imprimable (js/05) — repris ici
// pour que TOUT rapport exporté (Tous les contrats, Toutes les commissions, etc.) ait le même
// habillage professionnel : logo, titre du rapport, date/heure de génération. Invisible à l'écran
// (.print-header est display:none par défaut), affiché uniquement au print via le CSS dédié.
// Demande de Jonathan le 03.09.2026 : "aperçus professionnels qui collent au corporate" sur les PDF.
const ASSUREX_LOGO_B64 = "data:image/png;base64,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";
function printHeaderCorporate(titre, sousTitre) {
  const maintenant = new Date();
  const dateStr = maintenant.toLocaleDateString('fr-CH') + ' à ' + maintenant.toLocaleTimeString('fr-CH', {hour:'2-digit', minute:'2-digit'});
  return `<div class="print-header" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #7dd3fc;padding-bottom:10px;margin-bottom:18px">
      <img src="${ASSUREX_LOGO_B64}" alt="Assurex" style="height:34px"/>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight: 600;color:#0f2244">${titre}</div>
        ${sousTitre ? `<div style="font-size:10.5px;color:#52525b;margin-top:2px">${sousTitre}</div>` : ''}
        <div style="font-size:9.5px;color:#71717a;margin-top:2px">Édité le ${dateStr} — Assurex CRM</div>
      </div>
    </div>
  </div>`;
}

function getClientMiniLogos(c) {
  let logos = '';
  if (c && c.source_oz) logos += OZ_MINI_LOGO;
  if (c && c.source_cofidex) logos += COFIDEX_MINI_LOGO;
  // Domaine SUVA (monopole légal de l'assurance-accidents pour certaines branches, art. 66 LAA) :
  // déclaré manuellement à la création/édition du client (champ "Domaine SUVA ?"), OU détecté
  // automatiquement dès qu'un contrat LAA actif chez SUVA existe pour ce client — les deux
  // signaux se combinent, pour couvrir aussi bien un nouveau client sans contrat encore créé
  // qu'un client existant dont le contrat suffit à le déterminer sans case à cocher.
  if (c) {
    const contratSuva = typeof allContrats !== 'undefined' && allContrats.some(ct =>
      ct.client_id === c.id &&
      (ct.compagnie || '').trim().toLowerCase().includes('suva') &&
      !['résilié', 'annulé', 'mandat_resilie'].includes(ct.statut)
    );
    if (c.domaine_suva || contratSuva) logos += SUVA_MINI_LOGO;
  }
  return logos;
}

// ═══ STATUTS DE COMMISSION ═══
function statutCommissionLabel(statut) {
  if (statut === 'reçue') return 'Reçue';
  if (statut === 'versé_oz') return 'Versé OZ';
  if (statut === 'versé_cofidex') return 'Versé EX Groupe';
  if (statut === 'extourné') return '↩ Extournée';
  if (statut === 'annulé') return '❌ Annulé (legacy)';
  // 22.09.2026 : ces deux statuts existent en base mais tombaient dans « En attente » — une commission
  // annulée (jamais versée) se lisait comme attendue.
  if (statut === 'annulée') return '❌ Annulée';
  if (statut === 'en_attente_naissance') return '🍼 Attente naissance';
  return 'En attente';
}
function statutCommissionColor(statut) {
  if (statut === 'reçue') return '#4ade80';
  if (statut === 'versé_oz') return '#1a56db';
  if (statut === 'versé_cofidex') return '#f59e0b';
  if (statut === 'extourné') return '#f87171';
  if (statut === 'annulé') return '#94a3b8';
  return '#f59e0b';
}

// ═══ MARQUAGE CLIENT EX GROUPE / COFIDEX ═══
// Logo EX Groupe officiel (logo officiel EX Groupe)

// Facteur produit (FP) LPP Swiss Life — PAR PRODUIT EXACT, vérifié contre l'Annexe A à la
// convention d'indemnisation Prévoyance professionnelle (PP), valable dès 01.01.2024 (PDF fourni
// par Jonathan le 25.08.2026). Remplace l'ancien FP fixe à 1.20 qui surestimait la commission pour
// tout produit autre que Business Invest/Premium/Select(Fondation SL)/Prime Solution.
const SWISS_LIFE_LPP_FP = {
  'Business Invest': 1.20,
  'Business Premium': 1.20,
  'Business Select (réserve à la Fondation de placement SL)': 1.20,
  'Business Select (réserve gérée par un tiers)': 1.00,
  'Prime Solution': 1.20,
  'Business Protect (Super/Suplessa)': 0.85,
  'Company Protect (Super/Suplessa)': 0.85,
  'Company Risk (Super/Suplessa)': 0.60,
  'Company Fixed Rate Risk (primes forfaitaires)': 0.60,
  'Company Flatrate (avec commission)': 1.00,
  'Company Flatrate (net, sans commission)': 0.00,
  'Business Direct': 0.00,
  'Contrats à tarification pluriannuelle': 0.00,
};

const TAUX_COMMISSION = {
  sante_facteur_mensuel: 16,   // santé complémentaire : prime mensuelle x 16 (acquisition unique)
  vie_taux_capital: 4,         // vie 3a/3b : 4% du capital de production (= prime ANNUELLE x nb d'années, jamais x12 en plus)
  lpp_taux: 6.3,               // LPP Swiss Life : taux 6.3% (Annexe B convention SL1102, vérifié 25.08.2026)
  lamal_forfait: 70,           // LAMal : forfait unique CHF 70.- par contrat à la signature
  // COG annuelle LPP = base risque+frais × FP (par produit exact, voir SWISS_LIFE_LPP_FP) × 6.3% (versée trimestriellement)
  // LAMal : CHF 70 une seule fois, à la signature, indépendant de la prime
  // Convention de collaboration HOTELA (entrée en vigueur 01.05.2026) — taux sur prime effectivement payée
  hotela: {
    ij_maladie: 7.00,               // Indemnités journalières en cas de maladie
    accidents: 5.00,                // Assurance-accidents (LAA)
    accidents_complementaire: 15.00,// Assurance-accidents complémentaire
    lpp: 1.50,                      // Prévoyance professionnelle
    lpp_plafond: 20000,             // Plafond annuel CHF 20'000.- par preneur soumis à la CCNT hôtellerie-restauration
    package: 10.00,                 // Package HOTELA (nouvelles affaires uniquement, toutes couvertures placées par le courtier)
  },
  // Gastrosocial — caisse LPP restauration/hôtellerie : taux unique sur la prime totale
  gastrosocial: {
    lpp: 1.60,
  },
  // Groupe Mutuel — branches ENTREPRISE. ⚠️ TAUX PROVISOIRES, communiqués de mémoire par Jonathan
  // le 24.09.2026 en attendant la convention entreprise et ses annexes (demandées à Valérie Dubuis
  // et Antoine Meyer, Groupe Mutuel — échanges des 18 et 22.09.2026). Le dossier
  // « Conventions\Groupe Mutuel » ne contient à ce jour que la tabelle du domaine SANTÉ.
  // À remplacer par les taux contractuels dès réception — et à vérifier : la tabelle santé montre
  // que GM raisonne parfois en multiples de prime mensuelle plutôt qu'en pourcentage.
  groupe_mutuel: {
    laa: 4.00,     // Assurance-accidents selon la LAA
    laac: 10.00,   // Assurance complémentaire à la LAA
    ijm: 7.00,     // Indemnité journalière maladie (perte de gain)
    provisoire: true,
  },
  // Vaudoise Générale — Tabelle de commissions A1 non-vie, édition 01.11.2024
  // (Convention de collaboration de courtage signée le 09.09.2025 — entrée en vigueur 01.09.2025)
  // Non-vie : uniquement des Commissions d'Encaissement (art. 2.2.1 du Règlement),
  // en % de la Prime nette encaissée (hors taxes). Taux appliqué à la prime annuelle en l'absence
  // d'un suivi d'encaissement par échéance — le montant obtenu reste une ESTIMATION annuelle.
  vaudoise: {
    accident_individuel_collectif: 15.00,  // Accident individuelle et collective (sans LAA)
    laa: 4.00,                             // Accident collective obligatoire selon LAA
    maladie_collective: 7.50,              // Maladie collective
    rc_generale: 15.00,                    // RC générale (entreprises, professionnelles), immeubles, privée
    rc_agricole_dirigeant: 12.50,          // Agricole, RC dirigeant
    caution: 5.00,                         // Caution, garantie de construction
    rc_construction: 15.00,                // Travaux de construction, RC maître de l'ouvrage, RC consortiums
    vehicule_rc: 4.00,                     // Véhicules à moteur — Responsabilité civile
    vehicule_casco_complete: 12.00,        // Casco complète
    vehicule_casco_partielle: 15.00,       // Casco partielle, occupants (taux Vaudoise volontairement > Casco complète)
    batiment: 15.00,                       // Produit Building / Septimo / Home in One — tous risques
    choses: 15.00,                         // Incendie, vol, dégât des eaux, bris de glaces, objets de valeur / machines / perte d'exploitation / Tech in One / Cyber
    five_in_one: 15.00,                    // Produit entreprise "Five in one" : RC - inventaire - bureautique - transports - protection juridique
    assistance: 15.00,                     // Assistance tous risques
    // NB: Tabelle B1 (Risques "Vie" — PlanoProtect/RythmoProtect/RythmoInvest/SerenityPlan) non intégrée ici :
    // taux/coefficients dépendent du produit Vie précis, absent du catalogue générique "vie_3a" du CRM.
    // À traiter au cas par cas tant qu'un mapping produit-Vie Vaudoise n'existe pas.
  },
  // AXA — Agence partenaire DES GOUTTES & Cie SA (Genève), Contrat pour intermédiaire non lié,
  // entrée en vigueur 01.04.2025, signé 10.03.2025 — Annexe Non-vie, Tableau de courtage (§B4.4).
  // Commissions de courtage annuelles sur prime nette. AUCUNE commission sur police échue ou en
  // renouvellement tacite (§B3) — contrairement à Vaudoise, pas d'AR/portefeuille séparé ici.
  axa: {
    choses: 15.00,                  // Incendie, vol, DE, BG, PE incendie et DE
    rc_hors_vehicules: 15.00,       // RC (sans RC véhicules), RC bateaux, RC avions
    techniques: 15.00,              // Machines, casco-machines, DATA, ATA, Montage, PE Machines
    transport: 15.00,               // Police d'abonnement, à forfait, au CA
    personnes_accidents: 15.00,     // Accidents individuelles et collectives (sans LAA/LAAF)
    maladie_collective: 6.50,       // Maladie collective
    laa_laaf: 3.00,                 // Accidents collectives obligatoires et facultative (LAA/LAAF)
    vehicules: 7.00,                // Véhicules automobiles — RC, Casco, Accidents, Flottes (taux unique)
    autres: 10.00,                  // Cautionnement, garantie constr., Intertours, OV, épidémie, bateaux,
                                     // RCMO, protection juridique, perte sur débiteurs, complémentaires, ménage/bâtiment
    // Flotte Auto et Aviation/crédits : "taux déterminé de cas en cas" — non chiffrables, à saisir manuellement.
    // NB: un 2e contrat AXA existe (Agence principale Mario Piscopo, Pully, éd. 01.11.2024) avec des taux
    // forfaitaires différents (18.70% acquisition / 3.20% portefeuille, hors tableau de courtage) — à
    // clarifier avec Jonathan s'il est toujours actif en parallèle de celui-ci avant de l'intégrer.
  },
  // LA MOBILIÈRE (20.09.2026) — taux MESURÉS sur les versements réels, pas issus d'une convention.
  //
  // Pourquoi mesurés : aucune convention Mobilière n'est enregistrée, et le CRM appliquait donc son
  // taux de repli de 10 % de la prime. Le rapprochement bancaire a montré l'ampleur de l'erreur :
  // sept contrats RC entreprise et protection juridique estimés à 10 % ont été payés entre 65 et
  // 74 %. Un facteur SEPT. Ces branches étaient invisibles dans le prévisionnel.
  //
  // Les taux ci-dessous sont la médiane du rapport « commission encaissée / prime annuelle » sur
  // les versements constatés. Ils restent une ESTIMATION fondée sur l'observation : le jour où la
  // convention arrive, elle les remplace.
  //
  // CE SONT DES TAUX D'ACQUISITION — première année uniquement. La Mobilière ne nous verse
  // aujourd'hui aucune commission de gestion : tant que la convention ne le prévoit pas, un
  // contrat Mobilière en gestion rapporterait zéro, et l'inscrire comme tel gonflerait la
  // trésorerie d'un revenu qui n'existe pas. Le formulaire l'empêche (voir js/95).
  mobiliere: {
    acquisition_seulement: true,           // pas de commission de gestion tant qu'aucune convention ne l'accorde
    rc_entreprise: 72.00,                  // mesuré sur 2 versements (72,2 % médian)
    protection_juridique_pro: 66.00,       // mesuré sur 2 versements (65,7 % médian)
    vehicule_rc: 12.70,                    // mesuré sur 6 versements
    rc_menage: 66.00,                      // aligné sur la PJ professionnelle faute d'assez de cas isolés
    defaut: 15.00,                         // les branches non observées : la moyenne du marché non-vie,
                                           // et non les 10 % de repli qui se sont révélés très faux ici
  },
};

// ═══ CONSTANTES LÉGALES LPP (état au 01.01.2026 — inchangées depuis 2025, réforme rejetée) ═══
const LPP_LEGAL = {
  seuil_entree: 22680,
  deduction_coordination: 26460,
  salaire_max: 90720,
  coordonne_min: 3780,
  coordonne_max: 64260,
  taux_interet_minimal: 0.0125,   // taux d'intérêt minimal LPP maintenu à 1.25% en 2026
  taux_conversion_legal: 0.068,   // taux de conversion 6.8% (part obligatoire, inchangé en 2026)
};

// ═══ ESTIMATION RENTE AVS (échelle 44) — état 2026, inchangé depuis 2025 ═══
// Approximation standard de branche : interpolation linéaire entre rente min et rente max
// selon le RAMD (Revenu Annuel Moyen Déterminant), en prenant le salaire actuel comme proxy du RAMD.
// ⚠️ Estimation indicative — ne remplace pas l'extrait de compte individuel AVS officiel.
const AVS_LEGAL = {
  ramd_min: 15120,
  ramd_max: 90720,
  rente_min: 15120,   // CHF/an (1'260/mois)
  rente_max: 30240,   // CHF/an (2'520/mois)
  duree_cotisation_complete: 44,
  taux_veuvage: 0.80,   // rente de veuve/veuf = 80% de la rente entière du défunt (art. 24 LAVS)
  taux_orphelin: 0.40,  // rente d'orphelin = 40% de la rente entière du défunt, par enfant (art. 25 LAVS)
};

// Estime la rente AVS annuelle (entière, à durée de cotisation donnée) à partir d'un RAMD approximé par le salaire actuel
function estimerRenteAVS(salaireActuel, anneesCotisation) {
  let renteComplete;
  if (salaireActuel <= AVS_LEGAL.ramd_min) renteComplete = AVS_LEGAL.rente_min;
  else if (salaireActuel >= AVS_LEGAL.ramd_max) renteComplete = AVS_LEGAL.rente_max;
  else renteComplete = AVS_LEGAL.rente_min + (salaireActuel - AVS_LEGAL.ramd_min) / (AVS_LEGAL.ramd_max - AVS_LEGAL.ramd_min) * (AVS_LEGAL.rente_max - AVS_LEGAL.rente_min);
  const coefficient = Math.min(anneesCotisation, AVS_LEGAL.duree_cotisation_complete) / AVS_LEGAL.duree_cotisation_complete;
  return Math.round(renteComplete * coefficient);
}

// Table officielle de fraction de rente LPP selon le degré d'invalidité (changement de méthode au 01.01.2022)
function fractionRenteInvaliditeLPP(degre) {
  if (degre < 40) return 0;
  if (degre <= 49) {
    const table = { 40:0.25, 41:0.275, 42:0.30, 43:0.325, 44:0.35, 45:0.375, 46:0.40, 47:0.425, 48:0.45, 49:0.475 };
    return table[degre] !== undefined ? table[degre] : 0;
  }
  if (degre < 70) return degre / 100; // taux linéaire de manière précise
  return 1; // dès 70% = rente entière
}

// ═══ RÈGLES DE FINANCEMENT IMMOBILIER (bases IAF) — standards de branche 2026 ═══
const IMMO_LEGAL = {
  fp_min_principale: 0.20,     // fonds propres minimum : 20% du prix (résidence principale)
  fp_min_secondaire: 1 / 3,    // fonds propres minimum : 33.3% (résidence secondaire — pas de LPP autorisé)
  fp_min_durs: 0.10,           // dont au moins 10% doivent être des fonds propres "durs" (hors 2e pilier)
  premier_rang_max: 0.65,      // 1er rang hypothécaire : max 65% de la valeur du bien
  taux_interet_theorique_defaut: 0.05,  // taux théorique standard de branche (souvent 4.5%-5%)
  charges_entretien_defaut: 0.01,       // frais d'entretien/accessoires : ~1% du prix d'achat
  duree_amortissement_defaut: 15,       // amortissement du 2e rang : 15 ans, ou jusqu'à la retraite si plus tôt
  taux_endettement_max_defaut: 0.33,    // charge totale ne doit pas dépasser 1/3 du revenu brut
};

// Calcule la capacité financière pour un prix d'achat donné
function calculerCapaciteFinanciere({ prix, fondsPropresDisponibles, fondsPropresLPP, revenuBrut, tauxInteret, chargesEntretien, dureeAmortissement, residenceSecondaire, tauxEndettementMax }) {
  const pctFPMin = residenceSecondaire ? IMMO_LEGAL.fp_min_secondaire : IMMO_LEGAL.fp_min_principale;
  const fpMinRequis = prix * pctFPMin;
  const fpDursRequis = residenceSecondaire ? fpMinRequis : prix * IMMO_LEGAL.fp_min_durs;
  const fondsPropresDurs = fondsPropresDisponibles - (fondsPropresLPP || 0);

  const hypotheque = Math.max(0, prix - fondsPropresDisponibles);
  const premierRang = Math.min(hypotheque, prix * IMMO_LEGAL.premier_rang_max);
  const deuxiemeRang = Math.max(0, hypotheque - premierRang);

  const interetsAnnuels = hypotheque * tauxInteret;
  const amortissementAnnuel = dureeAmortissement > 0 ? deuxiemeRang / dureeAmortissement : 0;
  const chargesAnnuelles = prix * chargesEntretien;
  const chargeTotaleAnnuelle = interetsAnnuels + amortissementAnnuel + chargesAnnuelles;
  const tauxEffort = revenuBrut > 0 ? chargeTotaleAnnuelle / revenuBrut : Infinity;
  const revenuMinimumNecessaire = tauxEndettementMax > 0 ? chargeTotaleAnnuelle / tauxEndettementMax : chargeTotaleAnnuelle / 0.33;

  return {
    fpMinRequis, fpDursRequis, fondsPropresDurs,
    fpSuffisants: fondsPropresDisponibles >= fpMinRequis - 0.01,
    fpDursSuffisants: fondsPropresDurs >= fpDursRequis - 0.01,
    hypotheque, premierRang, deuxiemeRang,
    interetsAnnuels, amortissementAnnuel, chargesAnnuelles, chargeTotaleAnnuelle, tauxEffort, revenuMinimumNecessaire,
  };
}

// Recherche par dichotomie le prix d'achat maximal finançable (respecte fonds propres ET taux d'effort)
function calculerPrixMaximalFinancable({ fondsPropresDisponibles, fondsPropresLPP, revenuBrut, tauxInteret, chargesEntretien, dureeAmortissement, tauxEndettementMax, residenceSecondaire }) {
  const pctFPMin = residenceSecondaire ? IMMO_LEGAL.fp_min_secondaire : IMMO_LEGAL.fp_min_principale;
  let lo = 0, hi = fondsPropresDisponibles > 0 ? fondsPropresDisponibles / pctFPMin : 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const c = calculerCapaciteFinanciere({ prix: mid, fondsPropresDisponibles, fondsPropresLPP, revenuBrut, tauxInteret, chargesEntretien, dureeAmortissement, residenceSecondaire, tauxEndettementMax });
    if (c.tauxEffort <= tauxEndettementMax && c.fpSuffisants && c.fpDursSuffisants) lo = mid; else hi = mid;
  }
  const prixMax = lo;

  // Identifie quelle règle bloque effectivement le prix maximal, pour l'expliquer clairement
  const capFPTotale = fondsPropresDisponibles > 0 ? fondsPropresDisponibles / pctFPMin : 0;
  const fondsPropresDurs = fondsPropresDisponibles - (fondsPropresLPP || 0);
  const capFPDurs = residenceSecondaire ? Infinity : (fondsPropresDurs > 0 ? fondsPropresDurs / IMMO_LEGAL.fp_min_durs : 0);
  let contrainteLimitante = 'tauxEffort';
  if (Math.abs(prixMax - capFPDurs) < Math.max(1, prixMax * 0.005) && capFPDurs <= capFPTotale) contrainteLimitante = 'fondsPropresDurs';
  else if (Math.abs(prixMax - capFPTotale) < Math.max(1, prixMax * 0.005)) contrainteLimitante = 'fondsPropresTotaux';

  return { prixMax, contrainteLimitante, capFPTotale, capFPDurs };
}

// ═══ SCHÉMA "MAISON" DU FINANCEMENT — représentation visuelle pour présentation client ═══
// Refait le 19.09.2026 (même signature — utilisée par js/22 et js/24, écran et rapport imprimé) :
// maison stylisée dont les bandes sont proportionnelles au financement — fonds propres (socle),
// hypothèque 1er rang (corps), hypothèque 2e rang à amortir (toit) — avec montants et % du prix.
// Fond transparent, couleurs en dur prévues pour le blanc (rapport) ; en thème sombre, les textes
// et le bleu marine s'éclaircissent par CSS (classes fih-t-*, fih-navy…). Animation d'entrée
// seulement sous un parent .fih-anime (sinon affichage statique, ex. impression).
let _schemaMaisonId = 0;
function schemaMaisonFinancement(fondsPropres, premierRang, deuxiemeRang, prix, dureeAmortissement) {
  const W = 480, H = 340;
  const x0 = 62, bw = 184, deb = 16;                 // murs et débord du toit
  const sol = 300, sommetMin = 74;
  const fp = Math.max(0, +fondsPropres || 0), r1 = Math.max(0, +premierRang || 0), r2 = Math.max(0, +deuxiemeRang || 0);
  const total = Math.max(fp + r1 + r2, 1);
  const base = prix > 0 ? prix : total;               // pourcentages exprimés en % du prix d'achat
  const toitDeco = 44;                                // toit neutre quand il n'y a pas de 2e rang
  const dispo = (sol - sommetMin) - (r2 > 0 ? 0 : toitDeco);

  // Hauteurs proportionnelles, plancher de lisibilité pour les bandes non nulles, puis remise à
  // l'échelle pour que la somme tienne exactement dans la hauteur disponible.
  // (le toit, triangulaire, reçoit un plancher plus haut pour rester lisible et élancé)
  const planch = (v, min) => v > 0 ? Math.max(dispo * v / total, min) : 0;
  let hFP = planch(fp, 30), hP1 = planch(r1, 30), hP2 = planch(r2, 56);
  const k = dispo / ((hFP + hP1 + hP2) || 1);
  hFP *= k; hP1 *= k; hP2 *= k;
  const yFP = sol - hFP, yP1 = yFP - hP1, sommet = r2 > 0 ? yP1 - hP2 : yP1 - toitDeco;
  const cx = x0 + bw / 2, xg = x0 - deb, xd = x0 + bw + deb;
  const f1 = v => v.toFixed(1);
  const pct = v => Math.round(v / base * 100) + ' %';
  const chf = v => 'CHF ' + Math.round(v).toLocaleString('fr-CH').replace(/,/g, "'");
  const penteY = x => sommet + (Math.abs(x - cx) / (xd - cx)) * (yP1 - sommet);
  const n = ++_schemaMaisonId;

  // Sol et ombre
  const sol_ = `<ellipse cx="${cx}" cy="${sol + 6}" rx="${bw * 0.78}" ry="6" fill="#0E1B33" fill-opacity=".08" class="fih-ombre"/>
    <line x1="${xg - 28}" x2="${xd + 28}" y1="${sol + 1}" y2="${sol + 1}" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round" class="fih-sol"/>`;

  // Toit : 2e rang (cyan) ou toit neutre ; cheminée décorative
  const xChem = cx + bw * 0.22;
  const cheminee = r2 > 0 && hP2 >= 44 ? `<rect x="${f1(xChem)}" y="${f1(penteY(xChem) - 16)}" width="14" height="${f1(22)}" rx="2" fill="#113679" class="fih-navy"/>` : '';
  const coulToit = r2 > 0 ? '#00CFFF' : '#CBD5E1';
  const toit = `<g class="fih-monte" style="animation-delay:260ms">${cheminee}
      <polygon points="${xg},${f1(yP1)} ${cx},${f1(sommet)} ${xd},${f1(yP1)}" fill="${coulToit}" stroke="${coulToit}" stroke-width="6" stroke-linejoin="round" class="${r2 > 0 ? '' : 'fih-toit-neutre'}"/>
      <rect x="${xg - 2}" y="${f1(yP1 - 1.5)}" width="${xd - xg + 4}" height="3" rx="1.5" fill="#0B2458" fill-opacity=".28"/>
      ${r2 > 0 && hP2 >= 30 ? `<text x="${cx}" y="${f1(yP1 - hP2 * 0.3 + 6)}" text-anchor="middle" font-size="${hP2 >= 48 ? 18 : 14}" font-weight="800" fill="#0B2458">${pct(r2)}</text>` : ''}
      ${r2 <= 0 ? `<text x="${cx}" y="${f1(yP1 - 12)}" text-anchor="middle" font-size="10" class="fih-t-doux" fill="#56627A">pas de 2e rang</text>` : ''}
    </g>`;

  // Corps : 1er rang, avec deux fenêtres si la bande est assez haute
  const fenetre = x => `<g><rect x="${x}" y="${f1(yP1 + 16)}" width="28" height="24" rx="4" fill="#FFFFFF" fill-opacity=".14"/><line x1="${x + 14}" x2="${x + 14}" y1="${f1(yP1 + 16)}" y2="${f1(yP1 + 40)}" stroke="#FFFFFF" stroke-opacity=".22"/><line x1="${x}" x2="${x + 28}" y1="${f1(yP1 + 28)}" y2="${f1(yP1 + 28)}" stroke="#FFFFFF" stroke-opacity=".22"/></g>`;
  const legC = hP1 >= 56;
  const corps = r1 > 0 ? `<g class="fih-monte" style="animation-delay:130ms">
      <rect x="${x0}" y="${f1(yP1)}" width="${bw}" height="${f1(hP1)}" fill="#113679" class="fih-navy"/>
      ${hP1 >= 84 ? fenetre(x0 + 16) + fenetre(x0 + bw - 44) : ''}
      <text x="${cx}" y="${f1(yP1 + hP1 / 2 + (legC ? 2 : 7))}" text-anchor="middle" font-size="${hP1 >= 40 ? 20 : 14}" font-weight="800" fill="#FFFFFF">${pct(r1)}</text>
      ${legC ? `<text x="${cx}" y="${f1(yP1 + hP1 / 2 + 18)}" text-anchor="middle" font-size="10.5" fill="#FFFFFF" fill-opacity=".75">1er rang</text>` : ''}
    </g>` : '';

  // Socle : fonds propres (un peu plus large que les murs, comme une fondation)
  const legF = hFP >= 52;
  const socle = fp > 0 ? `<g class="fih-monte">
      <rect x="${x0 - 8}" y="${f1(yFP)}" width="${bw + 16}" height="${f1(hFP)}" rx="5" fill="#F59E0B"/>
      <text x="${cx}" y="${f1(yFP + hFP / 2 + (legF ? 2 : 6))}" text-anchor="middle" font-size="${hFP >= 34 ? 17 : 13}" font-weight="800" fill="#3A2600">${pct(fp)}</text>
      ${legF ? `<text x="${cx}" y="${f1(yFP + hFP / 2 + 17)}" text-anchor="middle" font-size="10.5" fill="#3A2600" fill-opacity=".75">fonds propres</text>` : ''}
    </g>` : '';

  // Accolade à gauche : hypothèque totale
  const hyp = r1 + r2;
  const accolade = hyp > 0 ? (() => {
    const xb = xg - 12, top = r2 > 0 ? sommet + 2 : yP1, bot = yFP;
    return `<path d="M${xb + 6},${f1(top)} H${xb} V${f1(bot)} H${xb + 6}" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-linejoin="round"/>
      <text transform="translate(${xb - 6},${f1((top + bot) / 2)}) rotate(-90)" text-anchor="middle" font-size="10.5" font-weight="600" class="fih-t-doux" fill="#56627A">Hypothèque ${chf(hyp)} · ${pct(hyp)}</text>`;
  })() : '';

  // Étiquettes à droite, espacées pour ne jamais se chevaucher
  const xL = xd + 36;
  const etiqs = [
    r2 > 0 && { cy: yP1 - hP2 / 3, ax: cx + (xd - cx) * ((hP2 * 2 / 3) / (yP1 - sommet)) + 3, titre: 'Hypothèque 2e rang', coul: '#0891B2', cls: 'fih-t-cyan', pt: '#00CFFF', v: r2, sous: `à amortir en ${dureeAmortissement} ans` },
    r1 > 0 && { cy: yP1 + hP1 / 2, ax: x0 + bw, titre: 'Hypothèque 1er rang', coul: '#113679', cls: 'fih-t-navy', pt: '#113679', v: r1, sous: 'jusqu’à 65 % du prix' },
    fp > 0 && { cy: yFP + hFP / 2, ax: x0 + bw + 8, titre: 'Fonds propres', coul: '#D97706', cls: 'fih-t-ambre', pt: '#F59E0B', v: fp, sous: 'apport du client' },
  ].filter(Boolean);
  let prec = 60;
  etiqs.forEach(e => { e.ly = Math.max(e.cy, prec + 54); prec = e.ly; });
  const deborde = prec - (H - 34);
  if (deborde > 0) etiqs.forEach(e => { e.ly -= deborde; });
  const etiquettes = etiqs.map(e => `
      <path d="M${f1(e.ax)},${f1(e.cy)} L${xL - 14},${f1(e.ly)} H${xL - 6}" fill="none" stroke="#94A3B8" stroke-width="1.2"/>
      <circle cx="${f1(e.ax)}" cy="${f1(e.cy)}" r="3.5" fill="${e.pt}" stroke="#FFFFFF" stroke-width="1.5" class="fih-halo ${e.pt === '#113679' ? 'fih-navy' : ''}"/>
      <text x="${xL}" y="${f1(e.ly - 12)}" font-size="12.5" font-weight="700" class="fih-t-fort" fill="#0E1B33">${e.titre}</text>
      <text x="${xL}" y="${f1(e.ly + 5)}" font-size="14.5" font-weight="800" class="${e.cls}" fill="${e.coul}">${chf(e.v)} · ${pct(e.v)}</text>
      <text x="${xL}" y="${f1(e.ly + 19)}" font-size="10.5" class="fih-t-doux" fill="#56627A">${e.sous}</text>`).join('');

  const resume = `Structure du financement pour un prix de ${chf(base)} : fonds propres ${chf(fp)} (${pct(fp)}), hypothèque 1er rang ${chf(r1)} (${pct(r1)}), 2e rang ${chf(r2)} (${pct(r2)})`;
  return `<div class="fih-maison">
    <svg viewBox="0 0 ${W} ${H}" width="100%" class="fih-svg" role="img" aria-label="${resume}" style="display:block;max-width:520px;margin:0 auto" font-family="Arial,Helvetica,sans-serif" xmlns="http://www.w3.org/2000/svg" data-schema="${n}">
      <text x="${xL}" y="22" font-size="11" class="fih-t-doux" fill="#56627A">Prix d’achat</text>
      <text x="${xL}" y="43" font-size="18" font-weight="800" class="fih-t-fort" fill="#0E1B33">${chf(base)}</text>
      ${sol_}${accolade}${socle}${corps}${toit}
      <g class="fih-fondu" style="animation-delay:420ms">${etiquettes}</g>
      <text x="8" y="${H - 6}" font-size="9" class="fih-t-doux" fill="#8A94A8">Assurex Sàrl · Courtier FINMA</text>
    </svg>
  </div>`;
}

// Taux de bonification de vieillesse par tranche d'âge (art. 16 LPP, minimum légal)
function tauxBonificationLPP(age) {
  if (age < 25) return 0;
  if (age <= 34) return 0.07;
  if (age <= 44) return 0.10;
  if (age <= 54) return 0.15;
  return 0.18;
}

// Calcule le salaire coordonné LPP selon les règles légales (plafonnement + déduction + garde-fous min/max)
function calculerSalaireCoordonneLPP(salaireAVS) {
  if (!salaireAVS || salaireAVS < LPP_LEGAL.seuil_entree) return 0;
  const salairePlafonne = Math.min(salaireAVS, LPP_LEGAL.salaire_max);
  let coordonne = salairePlafonne - LPP_LEGAL.deduction_coordination;
  if (coordonne < LPP_LEGAL.coordonne_min) coordonne = LPP_LEGAL.coordonne_min;
  if (coordonne > LPP_LEGAL.coordonne_max) coordonne = LPP_LEGAL.coordonne_max;
  return Math.round(coordonne);
}

// Simule un parcours d'épargne LPP année par année, avec capitalisation des intérêts
// (réplique la logique du tableau d'évolution LPP : bonifications par tranche d'âge + intérêts composés,
// avec prorata sur l'année de la retraite selon le nombre de mois avant l'échéance)
function simulerParcoursLPP({ salaireCoordonne, capitalDepart, ageDepart, ageRetraite, moisDerniereAnnee, tauxInteret, rachatAnnuel, tauxBonifFn }) {
  const bonifFn = tauxBonifFn || tauxBonificationLPP;
  const lignes = [];
  let capital = capitalDepart || 0;
  for (let age = ageDepart; age < ageRetraite; age++) {
    const interet = capital * tauxInteret;
    const bonification = salaireCoordonne * bonifFn(age);
    const rachat = rachatAnnuel || 0;
    const etatDebut = capital;
    capital = capital + interet + bonification + rachat;
    lignes.push({ age, etatDebut, interet, bonification, rachat, etatFin: capital });
  }
  // Année de la retraite : bonification et intérêt proratés sur le nombre de mois avant l'échéance
  const etatDebutFinal = capital;
  const interetFinal = (capital * tauxInteret / 12) * moisDerniereAnnee;
  const bonificationFinale = (salaireCoordonne * bonifFn(ageRetraite) / 12) * moisDerniereAnnee;
  const capitalFinal = capital + interetFinal + bonificationFinale;
  lignes.push({ age: ageRetraite, etatDebut: etatDebutFinal, interet: interetFinal, bonification: bonificationFinale, rachat: 0, etatFin: capitalFinal });
  return { lignes, capitalFinal };
}
