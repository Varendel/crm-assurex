# Roadmap — CRM Assurex

État du chantier (mis à jour le 19.09.2026). Les idées détaillées notées au fil de l'eau
sont en bas de ce fichier.

> Le repo est encore public : ce fichier ne contient volontairement ni chiffres du
> portefeuille ni détail des points de sécurité ouverts.

---

## ✅ Fait

- **18.09** — Signatures : plus d'écriture anonyme directe sur `signature_requests` (tout passe
  par les fonctions RPC) ; la purge 24 h ne supprime plus une signature reçue mais pas encore
  enregistrée sur la fiche client.
- **19.09** — Nettoyage des règles d'accès (RLS) en double + index sur les clés étrangères.
- **19.09** — Mandats signés en double corrigés (sondage en direct et rattrapage ne peuvent plus
  enregistrer deux fois le même mandat) + message de confirmation à la réception de la signature.
- **19.09** — Journal des erreurs (`js/00-journal-erreurs.js` → table `journal_erreurs`) :
  erreurs capturées automatiquement, signalement manuel **Ctrl+Alt+E**.
- **19.09** — Git en place (GitHub Desktop) ; migrations SQL versionnées dans `supabase/migrations/`.
- **19.09** — Maquette du nouveau tableau de bord (bureau + mobile) — en attente de validation.
- **19.09** — **Cockpit financier** (js/29, 34) : vue d'ensemble, commissions (encaissé Assurex + OZ
  en barres empilées, commission mensuelle moyenne), **par compagnie** (rythme réel, prochain
  versement, attendu ajusté par la précision observée), **prévisions 12 mois** (qui paie quoi,
  quand, pour quel contrat — export Excel, js/41), rentabilité, précision, retards, contrôle,
  onglet OZ ↔ Assurex (refacturation + rapprochement du compte courant OZ).
- **19.09** — **Prévisions de gestion** (js/19) : profils de versement réels par compagnie
  (Vaudoise, AXA, Swiss Life trimestriel, Nest), échéancier des primes fractionnées ancré sur
  l'année de facturation, gestion annuelle automatique, date de droit aux commissions par
  compagnie (HOTELA dès le 01.01.2027).
- **19.09** — Rapprochement **compte courant OZ → commissions attendues** (déduction automatique,
  jamais deux fois la même ligne) ; montants réels repris sur les commissions historiques OZ.
- **19.09** — Import décomptes : polices alphanumériques, noms proches, commission de paiement
  épargne, logos Assurex / OZ, n° de bordereau cohérents, logo compagnie sur chaque bordereau.
- **19.09** — Factures QR suisses (js/33), comptes de caution (js/35), rentabilité par produit (js/36).
- **19.09** — Vue **OZ Assure** refondue (js/38), **Marquage des entités** OZ / Assurex-EX (js/39).
- **19.09** — Mandats modernisés (onglet Documents, signature, envoi) et enregistrés au nom du
  client ; factures « n° — client » ; financement immobilier (maison, diagrammes, légendes).
- **19.09** — Tableau de bord : horloge et agenda sur 2 jours (js/40) ; citations de Rex (js/37) ;
  légende du plan de trésorerie.
- **19.09** — Récurrence sourcée OZ mise en avant (OZ Assure, cockpit, tableau de bord) ; bandeau
  bleu foncé en tête de toutes les pages (js/44).
- **19.09** — **Offre signée → contrat** (js/46) : depuis une offre reçue, dépôt de la ou des polices
  PDF, opportunité gagnée, un contrat par police pré-rempli par REX, police archivée sur le contrat.
- **19.09** — Retour arrière revu : flèche intégrée au bandeau avec fil d'Ariane, historique
  synchronisé avec le navigateur (bouton précédent, souris, Alt+←), « précédent » ferme d'abord
  la fenêtre ouverte et ne quitte jamais le CRM.
- **19.09** — **Archivage OZ au 01.01.2027** (automatique) : vue OZ Assure en archive arrêtée au
  31.12.2026, menu « OZ Assure · archives », saisie OZ limitée aux anciens décomptes ; rien supprimé.

- **20.09** — **EcoHub** (js/59, 61) : réception des documents des compagnies, rattachement au client
  et au contrat par n° de police, manomètre d'état, pastilles de nouveautés dans le bandeau,
  synchronisation planifiée deux fois par jour.
- **20.09** — **Chantier visuel** : le CSS sorti de `index.html` (348 Ko → 17 Ko) vers `css/00…95`,
  **jetons de design** (`css/000-jetons.css`, source unique des couleurs, espacements, rayons,
  ombres, échelle typographique), **composant tableau** unique (js/66 + css/95), densité
  confortable / compact, curseur aux couleurs de l'accent, **échelle typographique appliquée**
  (`css/96-typographie.css` : chiffres tabulaires, faux gras supprimé, interlettrage optique).
- **20.09** — **Habillages saisonniers** (js/62) : Halloween dès le 01.10, Noël dès le 01.11,
  Rex et Rodolphe en tenue, neige, décor de l'espace client **et de la page de connexion** ;
  essayables hors période depuis Paramètres › Apparence (js/64).
- **20.09** — **Demandes de polices** (js/63) : une lettre par client et par compagnie qui annonce
  le mandat, demande la police et le transfert de portefeuille, envoi par lot avec relance à 12 jours.

## 🟡 En attente

- [ ] Signature de test de bout en bout avec le correctif en ligne
- [x] Nettoyer les mandats en double créés entre le 16 et le 19.09 (archivés, 1 gardé par client)
- [ ] Supabase Auth : vérifier que l'inscription publique est fermée, activer la MFA et la
      protection contre les mots de passe compromis
- [ ] Retrouver les décisions du chantier « sécurisation / segmentation » déjà discuté
- [ ] Retour sur la maquette + logo en fichier (SVG/PNG)

## 💰 Finances & commissions — à faire

- [ ] Saisir en détail les décomptes repérés sur le relevé bancaire mais absents des dossiers
      (Mobilière, Helsana, Groupe Mutuel, AXA) pour les ventiler par client
- [ ] Commissions OZ historiques restées à l'estimation (surtout santé) : retrouver les décomptes
- [ ] Compléter les primes estimées de quelques contrats créés depuis les décomptes (auto AXA,
      LPP Swiss Life) et la police définitive d'un véhicule
- [ ] Dépenses OZ : trancher les écritures « à vérifier » avant transmission à la fiduciaire
- [x] **Import XML IGB2B** (standard des assureurs) dans « Importer un décompte » (19.09)
- [x] Plan de trésorerie : fourchette d'incertitude calculée sur les écarts mesurés + mention
      « prévisionnel » à l'impression (19.09)
- [ ] Remplacer les estimations génériques à 10 % dès le premier décompte de chaque compagnie
- [ ] Profils de versement Helsana / Groupe Mutuel / CSS / Mobilière dès que la gestion sera versée
- [x] **Objectifs financiers & ventes** (19.09, js/42) : revenu, acquisitions, affaires, primes ; socle
      récurrent séparé (récurrence sourcée OZ / Assurex-EX), reste à vendre et rythme mensuel
- [ ] Fiscalité (plus tard)

## 🔴 Priorité 1 — Sécurité & fondations

- [ ] Repo **privé** + hébergement Cloudflare Pages (ou Netlify), déploiement à chaque push
- [ ] **Rôles** (admin, courtier, RH, client) à la place de « connecté = tout voir » et des
      emails codés en dur dans les règles d'accès
- [ ] **Cloisonnement par cabinet** (`tenant_id` porté par la session) — prérequis SaaS
- [ ] **Environnement de test** séparé de la production
- [ ] Exporter le schéma d'avant le 17.09 en migration initiale
- [ ] Durcir les fonctions publiques restantes, la prise de RDV publique, et l'affichage des
      données (`innerHTML` sans échappement)

## 🟢 Priorité 2 — Suivi commercial

- [x] **Échéancier des renouvellements** (19.09) — page Vente › Renouvellements + carte dashboard :
      classement par date limite de résiliation, suivi de revue, tâche de revue en un clic
- [x] **Relances LAMal** (19.09) — page Vente › Relances LAMal : la LAMal comme levier de RDV,
      message e-mail / WhatsApp avec lien de réservation personnalisé, suivi relancé → RDV
- [x] Échéancier, suite : préavis modifiable par contrat dans la fiche contrat (19.09) + note de revue sur chaque renouvellement
- [x] **Équipement & ventes croisées** (19.09) — page Vente › Équipement : besoins de base par profil
      (particulier / entreprise), taux de couverture par besoin, opportunité « Vente croisée » en un
      clic, liste des clients sans contrat actif avec tâche de contact
- [x] Équipement, suite : « assuré ailleurs » vs « pas assuré » — polices externes saisies comme contrats
      non commissionnés, transfert proposé à l'échéance (19.09)
- [x] **Prochaine action obligatoire** (19.09) — demandée à la création, au changement de stade et à la fin de la dernière tâche ; affichée sur chaque carte du pipeline ; bandeau + carte dashboard pour les opportunités sans étape
- [x] **Source des clients** (19.09) — page Vente › Sources : canal d'acquisition par client
      (recommandation, apporteur, RDV en ligne…), indicateurs par source, apporteurs externes,
      clients qui recommandent, attribution rapide des clients sans source
- [x] **Pictogrammes des compagnies** (19.09) sur les contrats — logos AXA, Vaudoise, HOTELA,
      symbole Helvetia ; monogrammes aux couleurs officielles pour les autres
- [x] Synchronisation Outlook des offres reçues (bouton « Synchroniser Outlook »)
- [x] **Décomptes reçus par e-mail** (19.09) : recherche des pièces jointes Excel / XML / PDF des compagnies
      dans Outlook et import en un clic (Importer un décompte)

- [x] **Nouveau contrat, formulaire revu** (20.09) : une seule ligne de prime au départ, préavis de
      résiliation saisissable, statut « à renouveler », type de véhicule sur chaque plaque,
      avertissement quand le n° de police existe déjà chez le client, et brouillon automatique
      repris après une fermeture ou une navigation.

## 🔵 Priorité 3 — Produit

- [x] Nouveau design, étape 1 (19.09) : police Geist sans le « tout en gras », couleurs de la charte REX (cyan #00CFFF / bleu marine #113679), thème clair avec menu blanc, logo REX + mascotte (menu et connexion)
- [x] Nouveau design, étape 2 (19.09) : kanban du pipeline, fiche client avec journal d'activité, thème clair deux tons
- [x] **Nouveau tableau de bord** (19.09, js/18-dashboard.js) — onglets « Aujourd'hui » (liste d'actions par urgence, cochables sur place ; nouveautés 7 jours ; signaux à surveiller ; agenda) et « Pilotage » (graphiques 12 mois, portefeuille par compagnie, pipeline par stade). L'ancien reste accessible (« Vue classique »)
- [x] **Courriers clients avec en-tête** (19.09, js/45) — menu Clients › Courriers clients et fiche
      client › Documents : 7 modèles, aperçu A4, Word (templates/courrier-client.docx), PDF, e-mail
      Outlook avec le Word joint (aperçu + confirmation), archivage dans le journal de la fiche.
      Reste : modèles personnalisables enregistrés par l'utilisateur.
- [ ] ~~Génération de courriers clients avec en-tête~~ (détail d'origine) (demandé le 19.09, modèle Word fourni : envoi
      de polices 3a) — papier à en-tête Assurex / EX.GROUP (logos en haut), lieu et date
      (« St-Sulpice, le … »), bloc adresse du client repris de la fiche, n° de police(s) en
      référence, objet en gras, formule d'appel selon la civilité, corps du texte, signature avec
      nom, e-mail et téléphone du conseiller. Modèles réutilisables (envoi de polices, bulletins
      de versement / ordres permanents 3a, changement de compagnie, résiliation, rappel
      d'échéance…), variables remplies automatiquement, export PDF et Word, archivage sur la
      fiche client (onglet Documents) et envoi par e-mail depuis Outlook.
- [x] **Espace client, première version** (20.09, js/48) — rôle « client » : un compte et un mot de
      passe par client, créés depuis la fiche client (fonction serveur dédiée, mot de passe affiché
      une seule fois). Le client voit sa fiche, ses contrats en vigueur avec dates limites de
      résiliation, ses véhicules et ses rendez-vous ; tout le reste lui est fermé au niveau de la
      base. Reste à faire : accès aux documents (polices), changement de mot de passe côté client,
      et test de bout en bout avec un compte de test avant ouverture à un vrai client.
- [ ] Espace client, suite : app installable, documents téléchargeables, notifications
- [ ] **Projet « Rex assistant IA »** (ajouté le 20.09.2026) — voir le détail en bas de ce fichier
- [ ] Lecture IA des certificats LPP, scénario avant / après, import bancaire, notes de frais
- [ ] Ouverture à 1–2 cabinets pilotes — prérequis : priorité 1 complète + licence
- [x] Autotests des calculs de commissions (js/43, 18 tests, bouton dans Cockpit › Contrôle)
- [ ] Code : découpage en modules, build (Vite), tests signature

---

# Idées détaillées

## Projet « Rex assistant IA »

**Ajouté le 20.09.2026.**

**Objectif** : que Rex cesse d'être seulement une mascotte et devienne l'assistant du CRM — on lui
pose une question en français, il répond en s'appuyant sur les données réelles du portefeuille, et
il prépare le travail au lieu de se contenter de l'afficher.

**Trois niveaux, du plus simple au plus ambitieux** :

1. **Rex qui répond** — « combien de contrats arrivent à échéance en novembre ? », « quel client n'a
   pas de RC ? », « où en est le dossier Untel ? ». La question est traduite en requête sur la base,
   la réponse est chiffrée et accompagnée du lien vers l'écran concerné. Rien n'est inventé : si la
   donnée n'existe pas, Rex le dit.
2. **Rex qui prépare** — résumé d'une fiche client avant un rendez-vous, brouillon de courrier ou
   d'e-mail à partir des modèles existants, proposition de la prochaine action sur une opportunité,
   lecture des documents reçus par EcoHub (certificat LPP, police, avenant) pour en extraire les
   chiffres et les proposer à la saisie. **Rien n'est envoyé ni enregistré sans validation.**
3. **Rex qui veille** — le check matinal décrit plus bas dans ce fichier (dossiers sans réponse,
   échéances qui approchent, incohérences repérées), rendu sous forme de trois phrases sur le
   tableau de bord plutôt que d'une carte de plus.

**Points à trancher avant de construire** :
- **Où tourne le modèle** : appel depuis une fonction serveur (edge function) et jamais depuis le
  navigateur — la clé ne doit pas se trouver dans une page publique.
- **Ce qui sort du CRM** : par défaut, aucune donnée nominative. Les questions du niveau 1 peuvent
  se traiter sans jamais transmettre un nom (Rex construit la requête, la base répond). Les niveaux
  2 et 3 transmettent du contenu client : il faut le consentement, un hébergement acceptable, et
  une mention dans la politique de confidentialité — nLPD.
- **Traçabilité** : chaque réponse de Rex est journalisée (question, données consultées, réponse),
  sinon on ne peut pas expliquer une erreur.
- **Le garde-fou métier** : Rex ne donne jamais de recommandation de couverture présentée comme un
  conseil. Il prépare, le conseiller signe — FINMA / FIDLEG.

**Statut** : idée notée, non planifiée. Prérequis : priorité 1 (rôles, cloisonnement) terminée.

---

## Diffusion WhatsApp — news marchés, assurance & patrimoine

**Ajouté le 19.09.2026.**

**Objectif** : une diffusion WhatsApp où Jonathan informe clients et contacts des nouveautés
(marchés financiers suisses, assurance, patrimoine) par des **news périodiques non invasives** —
tenir informé et rester présent entre deux échéances, sans démarchage.

**Pistes** :
- Format à sens unique : **Canal WhatsApp** (les abonnés ne voient ni les numéros ni les réponses des
  autres) plutôt qu'un groupe ; rythme régulier mais espacé (ex. toutes les 2 semaines + actualité forte).
- **Inscription volontaire** (opt-in) et désinscription simple — nLPD ; mention « information générale,
  pas un conseil personnalisé » — FIDLEG.
- Lien avec le CRM : case « abonné aux news » sur la fiche client, invitation à rejoindre le canal
  dans les Relances LAMal et après un RDV, lien de prise de RDV dans certaines news.
- Thèmes récurrents possibles : primes LAMal (automne), 3e pilier (fin d'année), taux hypothécaires,
  changements LPP/AVS, rappels d'échéances saisonnières.

**Statut** : idée notée, non planifiée.

---

## Agent IA de suivi quotidien des dossiers (check matinal 8h00)

**Ajouté le 06.08.2026.**

**Objectif** : chaque matin à 8h00, un agent vérifie automatiquement l'état des dossiers en cours (demandes d'offre envoyées aux compagnies, dossiers en attente de réponse) et met à jour un indicateur visible sur le dashboard.

**Fonctionnement envisagé** :
- L'agent parcourt les demandes d'offre du CRM (`demandes_offre`) dont le statut n'est pas encore « clôturé ».
- Pour chaque dossier envoyé, il vérifie si une réponse a été reçue (via la boîte mail connectée — nécessite de connecter Gmail/Outlook à Cowork, pas encore fait).
- Il met à jour un statut par dossier : **Envoyé** / **Reçu** / **En attente (relance à prévoir)**.
- Tourne automatiquement tous les matins ouvrés à 8h00 (via une tâche planifiée Cowork).

**Intégration dashboard** :
- Nouvelle carte « État des dossiers » sur le dashboard, avec un badge par dossier (🟡 Envoyé / 🟢 Reçu / 🔴 En attente depuis Xj) et un lien direct vers le dossier concerné.
- Optionnellement, alerte si un dossier envoyé n'a aucune réponse après un certain délai (relance à faire).

**Prérequis techniques avant de pouvoir développer ça** :
- Connecter une boîte mail (Gmail ou Outlook) à Cowork, pour que l'agent puisse lire les réponses reçues et les rattacher au bon dossier (probablement par nom de client / numéro de dossier dans l'objet du mail).
- Définir une règle fiable pour rattacher un email entrant à une `demande_offre` précise (objet du mail, expéditeur = compagnie connue, etc.).
- Ajouter un champ `statut_reponse` (ou équivalent) sur la table `demandes_offre` pour stocker Envoyé / Reçu / En attente.

**Statut** : idée notée, non planifiée. À reprendre quand la boîte mail sera connectée.

---

## Bouton "Synchroniser Outlook" + suivi par compagnie (mise à jour du 06.08.2026)

**Contexte** : bonne nouvelle découverte en creusant ce point — le CRM a déjà une intégration Microsoft Graph fonctionnelle côté navigateur (MSAL, voir `initMSAL()` / `msalAccessToken` dans js/03), utilisée aujourd'hui pour l'agenda et l'envoi de mails (scopes actuels : `Calendars.ReadWrite`, `Mail.Send`). Il **manque le scope `Mail.Read`** pour pouvoir lire les réponses reçues dans la boîte mail. Contrairement à ce qu'on pensait initialement, ça ne nécessite pas de serveur/backend séparé : un bouton dans le CRM peut appeler directement Microsoft Graph (`GET /me/messages`) depuis le navigateur, avec le même token.

**Ce que ça implique concrètement** :
- Ajouter `Mail.Read` aux scopes MSAL → Jonathan devra se reconnecter à Outlook une fois (nouveau consentement Microsoft) après ce changement.
- Un bouton « 🔄 Synchroniser Outlook » (dashboard, et/ou sur chaque demande d'offre) qui : pour chaque compagnie en statut "envoyée" sur une demande d'offre, cherche dans la boîte mail une réponse (par domaine expéditeur = email connu de la compagnie dans Contacts compagnies, après la date d'envoi) ; si trouvée, passe cette ligne à "reçue" avec la date.
- **Prérequis déjà posé le 06.08.2026** : chaque demande d'offre mémorise maintenant QUELLES compagnies ont été sollicitées et QUAND (`demandes_offre.compagnies_envoi`), affiché ligne par ligne sur la fiche client ET la fiche opportunité (au lieu d'un statut global unique "envoyée" qui ne disait pas à qui).

## Upload des offres reçues + préparation à la signature (mise à jour du 06.08.2026)

Une fois une offre marquée "reçue" pour une compagnie : possibilité d'uploader le PDF de l'offre (stockage déjà existant, bucket Supabase `documents`, même mécanisme que les autres pièces jointes du CRM), puis un bouton « Préparer l'envoi pour signature » qui réutilise le système de signature des mandats de courtage déjà existant (canvas sur place, QR code / lien à distance avec sondage automatique, envoi par e-mail) — généralisé pour signer un document quelconque (offre) et non plus seulement le mandat de courtage.

**Décisions à prendre avec Jonathan avant de construire cette partie** : logique de rapprochement email→compagnie (domaine expéditeur uniquement, ou aussi mots-clés sujet/nom client) ; extraction automatique de la pièce jointe PDF depuis le mail reçu, ou upload manuel après coup.
