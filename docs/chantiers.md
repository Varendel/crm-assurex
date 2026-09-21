# REX CRM — chantiers, état des fonctions, vestiges

*21.09.2026. Mesures prises sur le code, pas à l'œil. Aucun nom de client ni montant de portefeuille :
le dépôt est public.*

---

## 1. Le constat en une page

**Ce qui tient.** Le modèle de données est sain : contrats, commissions, bordereaux et relevés
se recoupent, au centime quand les données sont complètes. Le système de jetons (couleurs, tailles,
rayons) existe et fonctionne : les réglages d'apparence en dépendent. Chaque ajout récent vit dans
son propre fichier et se retire en supprimant deux lignes de `index.html`.

**Ce qui fragilise.** Trois choses.

1. **La dette visuelle est concentrée dans huit fichiers.** 77 % des 3 162 styles écrits en ligne
   se trouvent dans `03` à `10` et `38`, les fichiers d'origine. Ce sont eux qui résistent aux thèmes, à la
   taille du texte et aux ambiances. Tous les écrans vestiges du §3 en sortent.
2. **L'empilement des surcharges.** Pour garder chaque changement réversible, les fichiers récents
   *enveloppent* les fonctions anciennes (`window.fn = function () { … origine … }`) et retouchent
   souvent le HTML produit en cherchant un repère textuel. Une vue comme l'espace client est
   enveloppée cinq fois. C'est sûr tant que rien ne bouge. Mais il suffit qu'un libellé change
   dans la fonction d'origine pour qu'une surcharge cesse d'agir, **sans aucune erreur**.
   Cette architecture était la bonne pour avancer vite et réversiblement. Elle doit maintenant être
   consolidée.
3. **Pas de filet automatique.** Pas d'étape de construction, pas de test qui charge chaque écran.
   La numérotation `?v=` du cache est tenue à la main dans `index.html` : un script de mise à jour
   l'a déjà cassée une fois (neuf fichiers non chargés, corrigé le jour même). 3,3 Mo de JavaScript
   sont chargés à chaque ouverture.

---

## 2. À faire avant une date

| Échéance | Chantier | Pourquoi maintenant |
|---|---|---|
| **tout de suite** | Changer les clés Brevo (API et SMTP) collées dans une conversation | Une clé qui a circulé en clair doit être considérée comme exposée |
| **6 octobre** | Campagne « REX CLOUD » aux clients Cofidex : compléter les adresses manquantes, rédiger les deux versions | Date prévue au tableau des campagnes |
| **fin octobre** | Espace client : demande de revoir la franchise / changer de caisse | Le 30 novembre ne se rattrape pas : l'oubli coûte une année de prime |
| **fin décembre** | Espace entreprise : déclaration annuelle des salaires | Les assureurs sociaux la réclament en janvier |

---

## 3. Écrans vestiges, encore non modernisés

Classés par dette mesurée dans la fonction de l'écran (styles en ligne, couleurs figées, emojis).
« Repris » = un fichier récent a déjà remplacé ou complété l'écran.

| Écran | Fichier | Styles en ligne | Couleurs figées | Emojis | Repris |
|---|---|---:|---:|---:|---|
| Tâches & rappels | 06 | 25 | 16 | 17 | non |
| Agents | 10 | 38 | 1 | 8 | non |
| Rapport FINMA | 04 | 24 | 3 | 2 | non |
| Importer un décompte | 06 | 18 | 2 | 6 | non |
| Agenda | 10 | 10 | 4 | 3 | non |
| Tous les contrats | 04 | 18 | — | 3 | non |
| Campagnes | 10 | 13 | — | 1 | non |
| Renouvellements · Relances LAMal | 11 | 22 | — | 2 | non |
| Équipement & ventes croisées | 12 | 9 | — | — | non |
| Production par période | 04 | 9 | — | — | non |
| Fiches de paie | 06 | 8 | — | — | non |
| Listes de clients (4 entrées) | 04 | 8 | — | 1 | en partie (86, 89) |
| Sources des clients | 14 | 5 | — | — | non |
| Recherche véhicules | 08 | 4 | — | 2 | non |

**Priorité : Importer un décompte.** Ce n'est pas le plus lourd visuellement, mais c'est l'écran
qui décide de la qualité des chiffres. Tout le travail sur les dates et les bordereaux du
20.09 vient de décomptes validés sans contrôle du montant ni de la date. Un import qui lit
le fichier, propose le rattachement ligne par ligne et refuse une date de réception absente
réglerait le problème à la source.

**Ensuite : Tâches & rappels, et Agents.** Ce sont les deux écrans quotidiens les plus chargés.

---

## 4. Fonctions à regrouper ou à retirer

| Aujourd'hui | Proposition |
|---|---|
| Rapprochement bancaire | **Retirer du menu.** Le rapprochement se fait par les bordereaux ; l'écran n'est plus nécessaire. |
| Campagnes · Tableau des campagnes · Performance | **Un écran, trois onglets**, sur le modèle des Commissions. |
| Clients privés · Entreprises · Tous les clients · Clients OZ | **Une liste avec un filtre**, et non quatre entrées de menu. |
| Importer un décompte · Lire un décompte scanné | **Un seul import**, qui accepte Excel, PDF et scan. |
| Les lignes annulées dans « Toutes les commissions » | Les estomper ou les masquer par défaut. Elles donnent l'impression d'un doublon alors qu'elles corrigent une saisie. |

---

## 5. Fonctions à améliorer

- **Commissions ↔ bordereaux.** Les bordereaux sont datés par la banque, mais la plupart des lignes de
  commission ne leur sont pas rattachées. Les totaux sont justes. Ce qui manque : ouvrir un
  bordereau et voir quelles commissions il a payées. Le rattachement peut se faire par
  numéro de police à partir des décomptes.
- **Décomptes PDF.** Les fichiers Excel se lisent sans difficulté. Les PDF demandent une lecture texte.
  Il faut le format complet de Helsana : l'Excel actuel est tronqué pour l'impression.
- **Dépôt des polices dans l'espace client** : déposer d'abord, rattacher ensuite, en confirmant chaque
  rattachement proposé. Proposé, en attente de votre accord.
- **Graisse 700 réelle.** Plus aucune déclaration ne dépasse 600 : on peut charger un vrai 700 et le
  réserver aux quelques éléments qui doivent dominer.
- **Tailles restantes.** 261 tailles de police hors échelle, surtout dans les fichiers vestiges. Elles
  disparaîtront avec la reprise des écrans du §3, pas avant.
- **Notification système** (fenêtre du navigateur), en option dans les paramètres.

---

## 6. Robustesse et sécurité

- **Consolider les surcharges** : une fois un écran stabilisé, remettre la version finale dans sa
  fonction d'origine et supprimer les enveloppes. À faire écran par écran, en commençant par
  l'espace client.
- **Un test de chargement** qui ouvre chaque écran du menu et signale ceux qui ne déclarent plus leurs
  fonctions. C'est le contrôle fait à la main le 20.09 ; il doit tourner seul.
- **Numéros de cache** générés automatiquement plutôt que réécrits à la main.
- **Police hébergée sur le site** plutôt que chez Google : l'écran de connexion annonce des données
  hébergées en Suisse pendant que chaque chargement appelle un serveur de Google.
- **Rôles et droits du personnel en base, double authentification** : point reporté, à voir avec David.
- **Fonctions serveur (Edge Functions) versionnées dans le dépôt**, pour qu'une remise à zéro du
  projet ne les perde pas.

---

## 7. Ordre proposé

1. Clés Brevo, puis la campagne du 6 octobre.
2. Importer un décompte, refait : il protège tous les chiffres qui suivent.
3. Franchise / caisse maladie dans l'espace client, avant fin octobre.
4. Tâches & rappels et Agents, les deux vestiges quotidiens.
5. Regroupements du §4 : moins de boutons, sans rien retirer d'utile.
6. Consolidation des surcharges et test de chargement : en tâche de fond, écran par écran.
7. Déclaration des salaires, avant fin décembre.
