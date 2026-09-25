# Registre des incidents — REX CRM

Journal des anomalies constatées à l'usage, de leur cause réelle et de ce qui empêche
leur retour. Tenu à jour au fil des tests et des remontées de Jonathan.

**Règle** : un incident n'est « Clos » que lorsqu'un test automatique le reproduirait s'il
revenait. Un correctif sans test est « Corrigé, non couvert » — il retombera tôt ou tard.

Statuts : `Ouvert` · `Corrigé, non couvert` · `Clos` (correctif + test)

| # | Date | Écran / fonction | Symptôme constaté | Cause réelle | Statut |
|---|------|------------------|-------------------|--------------|--------|
| 1 | 24.09.2026 | Demande d'offre → reprise du personnel | « Le bouton n'existe pas » depuis une opportunité | Le bouton avait été posé sur l'ancien formulaire détaillé (`js/07`) alors que l'écran en service est la vue simplifiée (`js/26`) | Corrigé, non couvert |
| 2 | 24.09.2026 | Demande d'offre → entreprise | « Nombre de collaborateurs : 100 » pour une Sàrl qui en a un | `clients.taux_activite` est à double usage (nb de collaborateurs sur une fiche entreprise, taux d'occupation sur une fiche privée) ; un taux de 100 % y avait été saisi | Corrigé, non couvert |
| 3 | 24.09.2026 | Demande d'offre → e-mail compagnie | L'adresse privée du collaborateur était saisie puis absente de l'e-mail | Le rendu de l'e-mail ne sortait que nom, date de naissance et salaire | Corrigé, non couvert |
| 4 | 24.09.2026 | Demande d'offre → reprise du personnel | « Il ne le trouve plus » en rouvrant une demande enregistrée | Garde-fou anti-doublon trop brutal : la case était `disabled` dès que la personne figurait dans la liste — donc systématiquement, puisqu'une demande rouverte contient déjà tout son personnel | Corrigé, non couvert |
| 7 | 24.09.2026 | Demande d'offre → envoi à la compagnie | Copie interne envoyée en **Cc visible** alors que le Cci était demandé | Les agents marqués `copie_demandes_offre` étaient passés à `envoyerCourriel({ copie })` au lieu de `{ cci }` : chaque compagnie sollicitée voyait la boucle interne du cabinet | Corrigé, non couvert |
| 5 | 20.09.2026 | Intégration continue (`controles.yml`) | 29 mails « Run failed » ; le garde-fou ne protège plus rien | **Trois causes cumulées**, toutes corrigées le 24.09 : (a) `js/159` contenait un commentaire avec des *backticks* à l'intérieur d'un gabarit — le fichier ne se chargeait donc **nulle part**, ni en CI ni dans le navigateur ; (b) `commission.test.js` ne chargeait pas `js/07`, d'où une `ReferenceError` sur `PRODUITS_SANTE_X16` qui n'existe pas en production ; (c) `compagnies-filtre.test.js` attendait encore « Baloise » comme compagnie distincte, avant la fusion avec Helvetia | Clos |
| 8 | 24.09.2026 | Kanban des opportunités | Les couleurs d'état ne sont jamais apparues, malgré deux passes | Conséquence de 5(a) : le fichier entier était invalide. Aucune alerte visible — le navigateur abandonne un script en erreur en silence | Clos |
| 9 | 23.09.2026 | Import automatique d'offres | Une demande d'offre créée **par fichier importé** au lieu d'être rattachée à celle du prospect — la comparaison se retrouve coupée en deux (cas Personeni : Vaudoise seule d'un côté, Mobilière + GM de l'autre) | L'import ne cherche pas s'il existe déjà une demande pour ce client / prospect avant de créer | Ouvert — données Personeni laissées telles quelles, affaire signée |
| 6 | 19.09.2026 | Espace client → envoi des accès | Le mot de passe part en clair par e-mail et reste dans la boîte du destinataire | Génération du mot de passe côté CRM puis envoi tel quel, au lieu d'un lien d'activation à usage unique | Ouvert |
| 10 | 25.09.2026 | Entrées d'argent | « Ici il est écrit que j'ai encaissé 9k AGV en avril, c'est faux » | La ligne « Encaissé » additionnait `montant_final ?? montant_estime` : faute de versement reçu, l'estimation **annuelle** était affichée comme encaissée, alors que la Vaudoise paie trimestre par trimestre. 89 lignes `versé_oz` sur 240 étaient dans ce cas, soit 41 837.— comptés comme du cash | Corrigé, non couvert |
| 11 | 25.09.2026 | Import de mandats (`js/123`) | « Le fichier de dépôt fonctionne mais les mandats ne sont pas reconnus » | `parts[1]` en dur : juste seulement si on sélectionne exactement le dossier `Mandats`. Un niveau au-dessus, les 44 fichiers tombaient dans un seul paquet nommé « Mandats » qui ne correspond à aucune fiche | Corrigé, non couvert |
| 12 | 25.09.2026 | Fiche client → onglet Prévoyance | « Les RIG Sauthier ne sortent pas dans prévoyance » | L'onglet n'affichait **aucun** contrat : quatre cases cochées à la main, les bilans, une carte Santé. Ses deux rentes IG Zurich et ses deux 3a n'existaient que dans l'onglet Contrats | Corrigé, non couvert |
| 13 | 25.09.2026 | Rapprochement des décomptes | Départage à numéro de police égal impossible sur la police GM 7623523 (complémentaire santé **et** RC + inventaire du ménage) | `marqueursBranche` ne connaissait que le véhicule : aucun marqueur ne sortait et le premier contrat chargé l'emportait, au hasard | Clos (`departage-police.test.js`) |
| 14 | 25.09.2026 | Journal des erreurs | 41 entrées « ⏳ Upload en cours… » noyaient les 153 vraies erreurs | `showError` sert à tout : erreurs, 131 confirmations « ✓ », 11 attentes « ⏳ ». Tout s'affichait en rouge avec un ⚠ et tout partait au journal | Clos (`ton-message.test.js`) |
| 15 | 25.09.2026 | Recherche dans le dossier de dépôt (`js/114`) | Le bouton « Chercher dans le dossier de dépôt » introuvable | La greffe cherchait le **libellé exact** du bouton « Déposer un document » de `js/59` dans le HTML rendu ; `indexOf` à −1 rendait le HTML inchangé et le bouton s'évaporait sans erreur ni trace | Corrigé, non couvert |
| 17 | 25.09.2026 | Formulaires de contrat | « Attention, une périodicité annuelle peut être payée trimestriellement » | `contrats.periodicite` n'est **pas** un rythme de paiement : c'est un facteur de conversion du montant saisi (`prime_annuelle = montant × periodicite`). Le renommer « Paiement de la prime » (même jour, par moi) aurait transformé une prime annuelle de 1 200.— payée en quatre fois en une prime annuelle de 4 800.—. La colonne `contrats.paiement_prime`, créée puis laissée vide, existait précisément pour porter le rythme réel | Clos (`paiement-prime.test.js`) |
| 16 | 25.09.2026 | Fonction `ocr-decompte` (déploiement) | Version 9 déployée avec le contenu `PLACEHOLDER` — la fonction était **cassée en production** pendant une minute | Déploiement lancé avec un fichier factice au lieu du contenu réel. La version 10, identique au fichier du dépôt, a été redéployée et vérifiée par relecture de la source en ligne | Clos — toujours relire la source déployée après un déploiement |

## Ce qui reste à couvrir par un test

Fonctions critiques encore sans filet, par ordre de risque — le risque étant
« une erreur silencieuse qui part chez un client ou chez une compagnie » :

1. **Calcul de commission** — partiellement couvert (`commission.test.js` : Vaudoise, AXA).
   Manque : capital de production vie (`prime annuelle × durée × 4 %`), retenue GM 10 %,
   exclusion du supplément de fractionnement de la base commissionnable.
2. **Demande d'offre** — aucun test. Reprise du personnel, champs conditionnels par branche,
   contenu de l'e-mail généré.
3. **Rapprochement des décomptes** — aucun test. Départage à numéro de police égal,
   lignes « D » dont la somme doit égaler le total.
4. **Import de police (`parse_police`)** — aucun test. Et surtout : la fonction `clever-worker`,
   qui porte `parse_police`, **n'est pas versionnée** dans ce dépôt. Son code n'existe que sur
   Supabase, et l'API ne sait pas le relire (« Failed to retrieve function bundle »). Une seule
   fausse manœuvre de déploiement et il est perdu. À rapatrier dans `supabase/functions/`.
   Le repli OCR ajouté le 25.09.2026 vit, lui, dans `ocr-decompte` (action « police »), versionnée.
5. **Espace client** — aucun test. Cloisonnement des données entre clients (RLS).

## Méthode de test en chaîne

Le CRM n'a pas de serveur : chaque `js/NN-*.js` s'exécute dans la page. Deux façons de
le tester, complémentaires :

- **Hors navigateur (`node test/*.test.js`)** — jsdom monte un DOM minimal, on charge les
  vrais fichiers de production et on appelle les fonctions. C'est ce que fait déjà
  `commission.test.js`. Rapide, tourne à chaque envoi via `controles.yml`.
- **Dans le navigateur, contre le site publié** — on ouvre la console sur
  `varendel.github.io/crm-assurex`, on monte la fixture et on appelle les mêmes fonctions.
  Sert à reproduire un incident exactement tel que Jonathan le vit, y compris les effets
  de cache et de version. C'est ainsi que l'incident 4 a été isolé.
