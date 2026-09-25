# Protocole de sécurité — REX CRM

Référentiel de sécurité du cabinet. Il vaut pour le CRM interne, l'espace client REX CLOUD et
les données qu'ils portent.

**Ce que ce document n'est pas.** Ce n'est pas une certification, et personne ne devrait le
présenter comme telle. C'est le socle qu'un intermédiaire financier suisse doit pouvoir montrer
quand un client, un assureur ou la FINMA demande comment les données sont tenues.

**Pourquoi il existe.** Assurex traite des données particulièrement sensibles au sens de la LPD
révisée : santé, revenus, numéros AVS, pièces d'identité, situation familiale. Une fuite ne coûte
pas un désagrément, elle coûte l'agrément.

| | |
|---|---|
| Entité | Assurex Sàrl · agrément FINMA F01492173 |
| Données | LPD (Suisse) · RGPD lorsqu'un client réside dans l'UE |
| Hébergement | Supabase, région **Zurich** — les données ne quittent pas la Suisse |
| Dernière revue | 25.09.2026 |
| Prochaine revue | à chaque déploiement touchant l'accès, la RLS ou les fonctions |

Statuts : `✅ en place` · `⚠️ à faire` · `⛔ bloquant`

---

## 1. Les quatre règles

Tout le reste en découle. Si une décision technique les contredit, c'est la décision qui est fausse.

1. **Un secret qu'on peut lire est un secret qu'on peut perdre.** Aucun mot de passe client n'est
   généré, affiché, envoyé ni stocké par le cabinet. Le client choisit le sien, personne d'autre
   ne le connaît.
2. **Le filtre posé par le navigateur ne protège rien.** La séparation des données se fait dans
   la base (RLS), jamais dans le code de la page. Une requête est refusée par le serveur, pas
   cachée par l'écran.
3. **Toute donnée reçue du client est une donnée, jamais une instruction.** Un nom, un nom de
   fichier, une remarque : échappés avant affichage, encodés avant d'entrer dans une URL.
4. **Une panne doit se voir.** Un échec silencieux qui rend une page vide est plus dangereux
   qu'une erreur affichée : on cesse de chercher.

---

## 2. Qui peut faire quoi

| Rôle | Accès | Contrôle |
|---|---|---|
| `signataire` | tout le CRM | ✅ |
| `apporteur` | le CRM, sans les réglages sensibles | ✅ |
| `rh` | saisie et consultation, **aucun chiffre financier** — ni commission, ni prime, ni pipeline, ni comptabilité | ✅ ; ne peut pas être désigné apporteur (25.09.2026) |
| `client` | son seul espace REX CLOUD | ✅ vérifié en base le 25.09.2026 |

| # | Contrôle | État |
|---|---|---|
| 2.1 | Un compte client ne peut jamais entrer dans le CRM | ✅ contrôlé avant tout au démarrage |
| 2.2 | Une adresse inconnue n'obtient aucun rôle par défaut | ✅ refus explicite |
| 2.3 | Le rôle RH ne voit aucun montant | ✅ `RH_VUES_AUTORISEES` |
| 2.4 | Les fonctions réservées au personnel refusent un compte client | ✅ `ocr-decompte`, `acces-client` |
| 2.5 | Départ d'un collaborateur : procédure écrite | ⚠️ voir § 7 |

**Double authentification** : ⚠️ non activée. À mettre en place au moins pour le compte
`signataire`, qui voit l'intégralité du portefeuille.

---

## 3. Les données

| # | Contrôle | État |
|---|---|---|
| 3.1 | RLS active sur toutes les tables sensibles | ✅ 13/13 au 25.09.2026 |
| 3.2 | Cloisonnement client vérifié **en base** | ✅ 25.09.2026 — voir PROTOCOLE-REX-CLOUD § 2 |
| 3.3 | Documents : un client n'a aucun droit sur le stockage | ✅ `NOT est_client()` sur les 4 politiques |
| 3.4 | Accès aux documents par lien signé de 300 s, appartenance vérifiée | ✅ `document-client` |
| 3.5 | Données au repos chiffrées | ✅ Supabase (AES-256) |
| 3.6 | Transport chiffré | ✅ HTTPS partout |
| 3.7 | **Sauvegardes restaurables** | ⛔ **absentes** — offre gratuite |
| 3.8 | Journal des erreurs sans donnée saisie | ✅ seuls les libellés de boutons cliqués |
| 3.9 | Journal d'audit des actions | ✅ `logAction` |

### 3.7 est le point le plus grave du dispositif

Aujourd'hui, **une suppression accidentelle est définitive**. Pas de restauration à un instant
donné, pas de retour en arrière. Ce n'est pas un risque théorique : le CRM contient des
suppressions en un clic, et une erreur de manipulation suffit.

Supabase Pro apporte la restauration à la seconde près sur 7 jours. C'est la dépense la plus
rentable du projet, et elle conditionne tout le reste : un dispositif de sécurité sans sauvegarde
n'est pas un dispositif de sécurité.

---

## 4. Les secrets

| # | Contrôle | État |
|---|---|---|
| 4.1 | Aucune clé de service dans le dépôt | ✅ — seule la clé **publique** y figure, ce qui est son rôle |
| 4.2 | Clés de modèle dans les secrets de fonction | ✅ `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` |
| 4.3 | Aucun mot de passe client stocké nulle part | ✅ depuis le 25.09.2026 |
| 4.4 | Protection contre les mots de passe compromis | ⚠️ **désactivée** |
| 4.5 | Rotation des clés | ⚠️ aucune procédure |
| 4.6 | Le dépôt est public | ⚠️ **assumé** — rien de sensible ne doit y entrer |

Le 4.6 mérite d'être dit clairement : le dépôt GitHub est **public**. Aucun nom de client, aucun
montant, aucune clé privée ne doit apparaître dans le code, un commentaire ou un message de commit.
Les tests utilisent des cas réels du portefeuille — c'est volontaire et c'est la limite : ils
nomment des sociétés, jamais des personnes privées avec leurs données.

---

## 5. Le code

| # | Contrôle | État |
|---|---|---|
| 5.1 | Contrôles automatiques à chaque envoi | ✅ `controles.yml` |
| 5.2 | Échappement de tout ce qui vient d'un tiers | ✅ fonctions `*Esc` dans chaque module |
| 5.3 | Requêtes paramétrées, jamais concaténées | ✅ `encodeURIComponent` sur les filtres |
| 5.4 | Dépendances extérieures | ⚠️ 4 scripts chargés depuis des CDN |
| 5.5 | Fonctions déployées versionnées dans le dépôt | ⚠️ `clever-worker` **absent** |
| 5.6 | Relecture de la source après déploiement | ✅ règle établie le 25.09.2026 |

Le 5.4 : MSAL, XLSX, PizZip et Docxtemplater viennent de `alcdn.msauth.net`, `cdnjs` et `jsdelivr`.
Un CDN compromis exécute son code dans le CRM. La parade tient en un attribut : ajouter
`integrity` et `crossorigin` sur ces quatre balises, pour que le navigateur refuse un fichier
modifié. **À faire.**

Le 5.5 : le code de `clever-worker`, qui porte `parse_police`, n'existe que sur Supabase et l'API
ne sait pas le relire. Une fausse manœuvre de déploiement le perd définitivement.

---

## 6. Ce qui part à l'extérieur

| Destinataire | Ce qui sort | Contrôle |
|---|---|---|
| Anthropic / OpenAI | documents envoyés à la lecture automatique (décomptes, polices, pièces) | ⚠️ à documenter dans la notice de confidentialité |
| Microsoft Graph | e-mails, pièces jointes, agenda | ✅ compte professionnel du cabinet |
| Compagnies | demandes d'offre, mandats | ✅ après confirmation explicite, jamais d'envoi automatique |
| EcoHub | décomptes de commissions | ✅ |

**Aucun e-mail ne part sans confirmation.** C'est une règle du CRM, pas une option : toute fonction
d'envoi passe par un aperçu et un accord.

Le premier point demande une décision : les documents lus automatiquement contiennent des données
de santé et des pièces d'identité. Les modèles ne les conservent pas, mais **le client doit en être
informé** — c'est une exigence de la LPD, pas une politesse.

---

## 7. Quand quelque chose arrive

### Un collaborateur part

1. Désactiver son compte Microsoft (coupe l'accès au CRM et aux e-mails).
2. Passer sa fiche agent en inactif — ne pas la supprimer : elle porte l'historique des affaires.
3. Réaffecter ses clients à un autre apporteur.
4. Vérifier qu'aucun lien de signature ni lien d'activation émis par lui ne reste valable.

### Un accès client est compromis

1. Désactiver l'accès depuis la fiche client (**⏸ Désactiver**) — effet immédiat.
2. Émettre un nouveau lien d'activation : l'ancien mot de passe est coupé à la seconde.
3. Lire le journal d'audit pour établir ce qui a été consulté.

### Une donnée a été divulguée par erreur

1. Établir l'étendue : quelles personnes, quelles données, sur quelle période.
2. **Annoncer au PFPDT** si la fuite entraîne un risque élevé pour les personnes — la LPD
   révisée impose l'annonce *dans les meilleurs délais*.
3. Informer les personnes concernées lorsque c'est nécessaire à leur protection.
4. Consigner l'incident dans `INCIDENTS.md`, cause réelle comprise.

### Droit d'accès ou de suppression

Un client peut demander ce que le cabinet détient sur lui, et sa suppression. Les données liées à
un contrat d'assurance restent soumises aux délais de conservation légaux — la suppression ne peut
donc pas être totale tant qu'un contrat court. ⚠️ **Procédure à écrire** : aujourd'hui il n'existe
pas d'export « toutes les données d'un client » sur un bouton.

---

## 8. Ce qu'il reste à faire, par ordre

| Rang | Action | Pourquoi ce rang |
|---|---|---|
| 1 | **Supabase Pro** — sauvegardes restaurables | Sans elle, tout le reste protège des données qu'on peut perdre en une manipulation |
| 2 | Protection contre les mots de passe compromis | Une case à cocher ; le client choisit maintenant son mot de passe, autant refuser les mauvais |
| 3 | Ajouter l'URL de retour aux Redirect URLs | Le lien d'activation ne fonctionne de bout en bout que là |
| 4 | `integrity` sur les 4 scripts de CDN | Un CDN compromis exécute son code chez nous |
| 5 | Double authentification sur le compte signataire | Il voit l'intégralité du portefeuille |
| 6 | Rapatrier `clever-worker` dans le dépôt | Code non versionné = code perdable |
| 7 | Export « toutes les données d'un client » | Exigence LPD, aujourd'hui manuel |
| 8 | Notice de confidentialité mentionnant la lecture automatique | Exigence LPD |

Les rangs 1 à 3 se font en une heure et sans écrire une ligne de code. Les rangs 4 à 8 demandent
du travail.

---

## 9. Signature de la revue

| Date | Par | Points ⛔ | Points ⚠️ | Commentaire |
|---|---|---|---|---|
| 25.09.2026 | Claude, consultant informatique | 1 (sauvegardes) | 8 | Cloisonnement vérifié en base, aucune fuite. Mot de passe client corrigé le jour même. |
