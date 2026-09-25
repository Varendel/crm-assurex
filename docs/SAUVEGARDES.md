# Sauvegardes — organisation

**25 septembre 2026**

## Le point de départ, qui n'est pas confortable

Le projet Supabase est sur le **plan gratuit**. Le plan gratuit ne garantit aucune sauvegarde
récupérable, et met un projet en pause après une semaine d'inactivité. Au 25.09.2026, cela veut
dire que **256 fiches clients, 370 contrats, 148 documents (126 Mo) et tout l'historique des
commissions n'existent qu'en un seul exemplaire, chez un seul prestataire.**

Une suppression en cascade, une erreur de manipulation, un litige de facturation, et il n'y a rien
à restaurer. Ce n'est pas un risque théorique : c'est le scénario le plus banal de perte de
données dans une PME.

Ce n'est pas non plus seulement une question de prudence. Les **CGA Cyber d'AXA (éd. 06.2024)** en
font une obligation contractuelle, et l'absence de sauvegarde ne se traduit pas par un refus franc
mais par une réduction de l'indemnité, ce qui est pire — on croit être couvert :

> **A11.2** « une sauvegarde de toutes les données doit être effectuée au moins une fois par
> semaine » ; « au moins une sauvegarde hebdomadaire des données doit être conservée séparément,
> hors du réseau du preneur d'assurance ».
> L'obligation est levée en cas d'usage d'un cloud **« dans la mesure où le fournisseur du système
> de cloud computing s'engage par contrat à effectuer la sauvegarde »** — ce que le plan gratuit
> ne fait pas.
>
> **A11.4** « S'il apparaît lors d'un dommage que la dernière sauvegarde remonte à plus d'une
> semaine, seuls sont pris en compte pour le calcul de l'indemnité les frais qui auraient été
> engagés si la sauvegarde requise avait été effectuée. Si aucune sauvegarde exploitable n'a été
> effectuée, seuls sont pris en charge les frais engagés pour constater cet état de fait. »

## La règle retenue : 3–2–1

**3** copies des données, sur **2** supports de nature différente, dont **1** hors du réseau.

| Copie | Où | Quoi | Rythme | Qui |
|---|---|---|---|---|
| 1 — production | Supabase, région Zurich | base + documents | continu | — |
| 2 — copie de travail | `OneDrive - COFIDEX SA\Sauvegardes REX CRM` | export complet | **chaque lundi** | `outils/sauvegarde.js` |
| 3 — copie hors réseau | disque externe **chiffré**, rangé hors du bureau | la copie 2, recopiée | **1×/mois**, et avant toute opération lourde | Jonathan |

Le poste tourne sous **Windows 11 Home**, qui ne propose pas BitLocker To Go : le chiffrement du
disque externe passe donc par **VeraCrypt** (gratuit) ou par un disque à chiffrement matériel.
Un disque de sauvegarde non chiffré, c'est le fichier clients entier — données de santé
comprises — que n'importe qui peut lire en le branchant.

**OneDrive n'est pas une sauvegarde.** C'est une synchronisation : ce qui est supprimé ici est
supprimé là-bas. Il compte comme deuxième copie parce qu'il conserve un historique de versions,
pas parce qu'il est « dans le cloud ». C'est la copie 3, débranchée, qui répond à l'exigence
« hors du réseau » d'AXA et qui survit à un rançongiciel — un rançongiciel chiffre tout ce qui est
monté, y compris les lecteurs synchronisés.

## Comment on la fait

```bash
node outils/sauvegarde.js <jeton>
```

Le jeton se récupère dans la console du CRM ouvert : `copy(supaSession.access_token)`. Il vaut une
heure, n'est écrit nulle part et n'est pas conservé.

Le script écrit un dossier horodaté contenant :

- `tables/<nom>.json` — chaque table, toutes colonnes, paginée (au-delà de 1 000 lignes PostgREST
  tronque en silence : une sauvegarde tronquée est pire qu'une absence de sauvegarde, on croit
  l'avoir) ;
- `documents/…` — les fichiers du stockage dans leur arborescence ;
- `MANIFESTE.json` — le compte de chaque table et les avertissements ;
- `LISEZ-MOI.txt` — la marche à suivre pour restaurer.

Le script **compare à la sauvegarde précédente** et signale toute table qui aurait perdu plus de
10 % de ses lignes. Sans ce contrôle, une sauvegarde vide s'archiverait consciencieusement chaque
semaine.

Il **refuse d'écrire dans le dépôt Git**, qui est public.

## Ce qu'elle ne contient pas

Les **comptes et mots de passe** (schéma `auth` de Supabase) n'en font pas partie : ils
appartiennent au prestataire et ne sont pas exportables par l'API. Après une restauration dans un
nouveau projet, les accès à l'espace client sont à recréer depuis le CRM — quelques minutes, à
condition de le savoir avant le jour où ça compte.

Le **code** est sauvegardé par ailleurs : dépôt Git local + GitHub.

## Conservation

- les **4 dernières** sauvegardes hebdomadaires ;
- la **première de chaque mois**, pendant 12 mois ;
- une sauvegarde **annuelle**, conservée 10 ans — c'est la durée LBA/CO du § 7 de la politique de
  confidentialité.

Purge manuelle : supprimer les dossiers horodatés qui ne relèvent d'aucune de ces trois règles.

## L'essai de restauration — la partie qu'on saute toujours

**Une sauvegarde qui n'a jamais été restaurée n'est pas une sauvegarde, c'est une intention.**

Deux fois par an, sur une base Supabase d'essai (branche ou projet jetable) :

1. réinjecter `clients.json` et `contrats.json` ;
2. vérifier que le nombre de lignes correspond au `MANIFESTE.json` ;
3. rouvrir deux ou trois fiches et comparer à la production ;
4. redéposer trois documents dans le bucket et les rouvrir ;
5. noter la date de l'essai et le temps qu'il a pris dans `test/INCIDENTS.md`.

Le temps mesuré est la vraie réponse à « en combien de temps repart-on ? ». Tant qu'il n'a pas été
mesuré, la réponse honnête est « on ne sait pas ».

## Données personnelles

Une sauvegarde contient le fichier clients entier, données de santé comprises. Elle ne se dépose
ni dans un dépôt Git, ni dans une boîte mail, ni sur une clé USB non chiffrée. Le disque externe
est chiffré (VeraCrypt) et rangé hors du bureau. Les copies périmées sont **effacées**, pas
simplement mises à la corbeille.

## Ce qui améliorerait encore la situation

1. **Supabase Pro (25 $/mois)** — sauvegardes quotidiennes automatiques conservées 7 jours, plus
   l'option *Point-in-Time Recovery*. C'est aussi ce qui permettrait d'écrire noir sur blanc, dans
   un questionnaire cyber, que le fournisseur s'engage contractuellement à sauvegarder — la
   condition exacte de l'exemption A11.2 d'AXA. Et cela supprime la mise en pause pour inactivité.
2. **Automatiser l'exécution hebdomadaire** (tâche planifiée Windows). Aujourd'hui, la sauvegarde
   dépend de quelqu'un qui y pense un lundi matin. Réserve : le script réclame un jeton de session
   valable une heure ; une exécution vraiment automatique demanderait une clé de service, qu'il
   faudrait alors protéger au moins aussi bien que les données.
