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

## Bouton "Synchroniser Outlook" + suivi par compagnie (mise à jour du 06.08.2026)

**Contexte** : bonne nouvelle découverte en creusant ce point — le CRM a déjà une intégration Microsoft Graph fonctionnelle côté navigateur (MSAL, voir `initMSAL()` / `msalAccessToken` dans js/03), utilisée aujourd'hui pour l'agenda et l'envoi de mails (scopes actuels : `Calendars.ReadWrite`, `Mail.Send`). Il **manque le scope `Mail.Read`** pour pouvoir lire les réponses reçues dans la boîte mail. Contrairement à ce qu'on pensait initialement, ça ne nécessite pas de serveur/backend séparé : un bouton dans le CRM peut appeler directement Microsoft Graph (`GET /me/messages`) depuis le navigateur, avec le même token.

**Ce que ça implique concrètement** :
- Ajouter `Mail.Read` aux scopes MSAL → Jonathan devra se reconnecter à Outlook une fois (nouveau consentement Microsoft) après ce changement.
- Un bouton « 🔄 Synchroniser Outlook » (dashboard, et/ou sur chaque demande d'offre) qui : pour chaque compagnie en statut "envoyée" sur une demande d'offre, cherche dans la boîte mail une réponse (par domaine expéditeur = email connu de la compagnie dans Contacts compagnies, après la date d'envoi) ; si trouvée, passe cette ligne à "reçue" avec la date.
- **Prérequis déjà posé le 06.08.2026** : chaque demande d'offre mémorise maintenant QUELLES compagnies ont été sollicitées et QUAND (`demandes_offre.compagnies_envoi`), affiché ligne par ligne sur la fiche client ET la fiche opportunité (au lieu d'un statut global unique "envoyée" qui ne disait pas à qui).

## Upload des offres reçues + préparation à la signature (mise à jour du 06.08.2026)

Une fois une offre marquée "reçue" pour une compagnie : possibilité d'uploader le PDF de l'offre (stockage déjà existant, bucket Supabase `documents`, même mécanisme que les autres pièces jointes du CRM), puis un bouton « Préparer l'envoi pour signature » qui réutilise le système de signature des mandats de courtage déjà existant (canvas sur place, QR code / lien à distance avec sondage automatique, envoi par e-mail) — généralisé pour signer un document quelconque (offre) et non plus seulement le mandat de courtage.

**Décisions à prendre avec Jonathan avant de construire cette partie** : logique de rapprochement email→compagnie (domaine expéditeur uniquement, ou aussi mots-clés sujet/nom client) ; extraction automatique de la pièce jointe PDF depuis le mail reçu, ou upload manuel après coup.
