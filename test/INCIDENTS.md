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
| 5 | 20.09.2026 | Intégration continue (`controles.yml`) | 29 mails « Run failed » ; le garde-fou ne protège plus rien | Non identifiée — le log demande d'être connecté à GitHub. Vérifié en local : références de scripts (160/160), doublons `const`/`let` (aucun) et fonctions critiques (24/24) passent. Reste une erreur de syntaxe JS ou un des deux tests de commission | Ouvert |
| 6 | 19.09.2026 | Espace client → envoi des accès | Le mot de passe part en clair par e-mail et reste dans la boîte du destinataire | Génération du mot de passe côté CRM puis envoi tel quel, au lieu d'un lien d'activation à usage unique | Ouvert |

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
4. **Import de police (`parse_police`)** — aucun test.
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
