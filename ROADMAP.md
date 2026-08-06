# Roadmap — Idées futures CRM Assurex

Notes de fonctionnalités envisagées mais pas encore planifiées. Chaque idée reste ici jusqu'à ce qu'on décide de la développer.

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
