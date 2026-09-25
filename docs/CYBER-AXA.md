# Assurance cyber AXA — où nous en sommes

**25 septembre 2026**

## Avertissement sur la source

Le questionnaire cyber d'AXA n'a été retrouvé **ni dans le SharePoint Cofidex, ni dans
`C:\Users\jonat`**. Ce qui s'y trouve :

- `Downloads\15967FR-AXA-Cyber-Entreprises-CGA-2024-06D.pdf` — les **conditions générales** AXA
  Cyber Entreprises, éd. 06.2024 ;
- SharePoint → `Formulaires demandes d'offres\MOBILIERE_cyber_fragebogen-cyberschutz-lang_fr (2).pdf`
  — le questionnaire cyber de **la Mobilière**, pas celui d'AXA.

L'évaluation ci-dessous est donc adossée aux **obligations contractuelles d'AXA elles-mêmes**
(partie A11 des CGA). C'est la référence la plus sûre : un questionnaire sert à tarifer, mais ce
sont ces articles-là qui décident, le jour d'un sinistre, si l'indemnité est versée ou réduite.
À réviser dès que le questionnaire AXA sera disponible.

## Réponse courte

**Non, pas en l'état — pour une seule raison, mais elle est éliminatoire : il n'existe
aujourd'hui aucune sauvegarde des données du CRM.**

Tout le reste tient la route, et deux points ont été corrigés le jour même. La sauvegarde, elle,
ne se corrige pas par du code : elle demande une décision (25 $/mois) et une habitude
(un lundi matin par semaine).

## Les trois exigences d'AXA, une par une

### A11.2 — Sauvegarde ❌ **NON CONFORME**

> « Une sauvegarde de toutes les données doit être effectuée au moins une fois par semaine » ;
> « au moins une sauvegarde hebdomadaire des données doit être conservée séparément, hors du
> réseau du preneur d'assurance ».

État réel : le projet Supabase est sur le **plan gratuit**, qui ne garantit aucune sauvegarde
récupérable. Aucune copie locale n'existe. 256 fiches clients, 370 contrats, 148 documents
(126 Mo) tiennent en un seul exemplaire chez un seul prestataire.

L'exemption « cloud » de A11.2 ne s'applique pas : elle exige que le fournisseur
**« s'engage par contrat à effectuer la sauvegarde »**. Le plan gratuit ne le fait pas — répondre
« oui, c'est dans le cloud » à un questionnaire cyber serait, ici, une réponse inexacte, avec le
risque de réticence que cela comporte.

Conséquence chiffrée en cas de sinistre, selon **A11.4** : indemnité réduite à ce que la
reconstitution aurait coûté *si* la sauvegarde avait existé — et, sans sauvegarde exploitable,
AXA ne prend en charge que les frais engagés pour **constater** qu'il n'y en a pas. S'y ajoute
**B1.2.3** : sans sauvegarde opérationnelle de moins d'une semaine, la perte d'exploitation n'est
indemnisée qu'à proportion du dommage qui serait survenu malgré tout.

**Ce qui est fait :** `outils/sauvegarde.js` (base + documents + manifeste + contrôle de
cohérence) et `docs/SAUVEGARDES.md` (règle 3–2–1, rythme, conservation, essai de restauration).
**Ce qui reste à décider :** Supabase Pro, le disque externe chiffré, et le premier lundi.

### A11.3 — Systèmes de protection ✅ **CONFORME**, avec une réserve levée aujourd'hui

> Système d'exploitation pris en charge par le fabricant ; systèmes de protection (pare-feu,
> antivirus) ; correctifs des failles critiques **dans les 30 jours** ; mises à jour de sécurité
> peu après leur parution.

| Point | État |
|---|---|
| OS supporté et mis à jour | ✅ Windows 11 (26200), Windows Update actif |
| Pare-feu et antivirus | ✅ Microsoft Defender, actif par défaut |
| Correctifs sous 30 jours | ✅ mises à jour automatiques |
| Applications web à jour | ✅ le CRM n'a pas de serveur applicatif : page statique + base gérée, donc pas de pile à rustiner |
| Bibliothèques tierces | ✅ **corrigé le 25.09.2026** — voir ci-dessous |

Jusqu'à aujourd'hui, `index.html` chargeait quatre bibliothèques depuis des CDN externes
(msal-browser, xlsx, pizzip, docxtemplater) **sans contrôle d'intégrité**. Le CRM exécutait donc
ce que ces quatre serveurs voulaient bien lui servir : un CDN compromis, et du code arbitraire
tournait dans une page qui a accès à 256 dossiers clients. C'est le scénario *supply chain*
qu'un questionnaire cyber cherche précisément à détecter.

Les empreintes **SRI (sha384)** ont été calculées et posées sur les quatre balises, avec
`crossorigin`. Le navigateur vérifie désormais chaque fichier avant de l'exécuter et refuse tout
fichier modifié. *À retenir : lors d'un changement de version, l'empreinte doit être recalculée,
faute de quoi le script est bloqué.*

### A11.1 — Diligence dans le traitement des données ✅ **CONFORME**

> « prendre les mesures commandées par les circonstances pour protéger les données assurées ».

- chiffrement en transit (TLS) sur tous les accès ;
- **cloisonnement au niveau de la base** : chaque table porte ses règles RLS ; un client connecté
  ne lit que son propre dossier, la règle étant appliquée par le serveur et non par l'affichage —
  vérifié table par table le 25.09.2026, et couvert par `test/rex-cloud.test.js` ;
- comptes nominatifs, droits différenciés (le compte RH n'accède ni aux commissions, ni aux
  fiches de paie, ni à la trésorerie) ;
- journalisation des accès et des actions ;
- plus aucun mot de passe transmis par courriel : lien d'activation à usage unique ;
- liens de téléchargement signés, valables 5 minutes ;
- stockage des documents **fermé aux comptes clients** : ils passent par une fonction serveur qui
  déduit leur identité du jeton.

## Ce qu'un questionnaire demandera en plus — et nos réponses

| Question habituelle | Réponse | Remarque |
|---|---|---|
| Sauvegardes hebdomadaires, hors réseau, testées | ❌ **non** | le point bloquant |
| Antivirus / EDR sur tous les postes | ✅ Defender | pas d'EDR centralisé, normal à cette taille |
| Pare-feu | ✅ | |
| Mises à jour dans les 30 jours | ✅ | |
| **MFA sur la messagerie** (Microsoft 365) | ⚠️ **à vérifier et à activer** | c'est le premier vecteur de fraude au paiement |
| **MFA sur l'administration du CRM** (Supabase) | ❌ **non activé** | |
| Mots de passe : contrôle des mots de passe compromis | ❌ **désactivé** | option Supabase, gratuite, un clic |
| Comptes nominatifs, droits différenciés | ✅ | |
| Séparation des droits d'administration | ⚠️ partielle | un seul administrateur, qui est aussi l'utilisateur quotidien |
| Chiffrement des données au repos | ✅ | chiffrement du disque côté hébergeur |
| Hébergement | ✅ **Suisse** (région Zurich) | argument favorable, à mentionner |
| Sous-traitants et transferts hors de Suisse | ⚠️ à déclarer | OCR des polices et décomptes par un service d'IA aux **États-Unis** (Anthropic/OpenAI) ; Microsoft 365 ; GitHub Pages |
| Procédure en cas d'incident | ✅ partielle | `test/PROTOCOLE-ERREURS.md`, `test/PROTOCOLE-SECURITE.md`, `test/INCIDENTS.md` (19 entrées) |
| Plan de reprise, délai de remise en service | ❌ **non mesuré** | tant qu'aucune restauration n'a été essayée, la réponse honnête est « on ne sait pas » |
| Sensibilisation du personnel (hameçonnage) | ❌ aucune formalisée | |
| Procédure de vérification des changements de coordonnées bancaires | ⚠️ à formaliser | couverture B4/B6 (e-banking, ingénierie sociale) : l'assureur attend une règle écrite, du type double validation par téléphone à un numéro connu |
| Sinistre cyber dans les 3 dernières années | ✅ aucun | |

## Ce qu'il faut faire, dans cet ordre

| # | Action | Coût | Effet |
|---|---|---|---|
| 1 | **Première sauvegarde** : `node outils/sauvegarde.js <jeton>` | 5 min | fait passer A11.2 de « rien » à « quelque chose » |
| 2 | **Supabase Pro** | 25 $/mois | sauvegardes quotidiennes contractuelles + PITR ; permet de répondre « oui » à l'exemption cloud ; supprime la mise en pause pour inactivité |
| 3 | **MFA** sur Microsoft 365 **et** sur Supabase | 15 min | la case la plus regardée par les assureurs cyber |
| 4 | **Protection contre les mots de passe compromis** (Supabase → Auth) | 1 clic | |
| 5 | **Disque externe chiffré** (VeraCrypt — Windows Home n'a pas BitLocker To Go), copie mensuelle | ~80 CHF | la copie « hors réseau » exigée par A11.2 |
| 6 | **Essai de restauration** documenté, 2×/an | 1 h | donne le délai de reprise réel |
| 7 | **Règle écrite** sur les changements de coordonnées bancaires | 30 min | conditionne souvent les couvertures B4/B6 |
| 8 | **Note de sensibilisation** au hameçonnage, signée par chaque collaborateur | 1 h | |

Les points 1, 3 et 4 ne coûtent rien et se font dans la journée. Le point 2 est la seule décision
qui engage de l'argent — et c'est celle qui change la réponse au questionnaire.

## Un mot sur la sincérité des réponses

Un questionnaire cyber est une **déclaration de risque** au sens de l'art. 4 LCA. Une réponse
inexacte sur les sauvegardes ou sur le MFA est une réticence, et l'assureur peut s'en prévaloir
pour résilier et refuser sa prestation — exactement au moment où on en a besoin. Mieux vaut
répondre « non » sur deux lignes, payer une prime un peu plus élevée, et être couvert, que
répondre « oui » par habitude et découvrir le contraire après un chiffrement de la base.
