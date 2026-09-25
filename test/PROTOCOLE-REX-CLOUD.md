# Protocole de test — REX CLOUD (espace client)

**À dérouler en entier avant chaque mise en ligne qui touche l'espace client, la RLS, les
fonctions en base, ou la table `acces_clients`.** Compter 30 minutes la première fois.

REX CLOUD est la **seule porte ouverte sur l'extérieur**. Tout le reste du CRM est interne : une
erreur y coûte du temps. Ici, une erreur montre les assurances d'un client à un autre.

> **Le point qu'il ne faut jamais perdre de vue.** Dans `js/48-espace-client.js`, toutes les
> requêtes sont filtrées **par le navigateur** (`client_id=eq.…`). Un client qui ouvre les outils
> de développement peut demander n'importe quel `client_id`. **La seule barrière réelle est la
> RLS.** `test/rex-cloud.test.js` vérifie que le CRM demande bien ce qu'il faut ; il ne prouve
> rien sur ce que la base accepte de répondre. C'est la section 2 qui le prouve.

Statuts : `✅ conforme` · `⚠️ à corriger avant mise en ligne` · `⛔ bloquant`

---

## 1. Avant de commencer

| # | Contrôle | Comment | Attendu |
|---|---|---|---|
| 1.1 | Les tests automatiques passent | `node test/verifier.js` puis chaque `test/*.test.js` | tout vert |
| 1.2 | Deux comptes clients de test existent | table `acces_clients`, deux `client_id` différents | 2 lignes `actif = true` |
| 1.3 | Les deux clients ont des données distinctes | au moins 1 contrat et 1 document chacun | visible en base |

Les deux comptes sont indispensables : **un seul compte ne prouve rien**. Le cloisonnement ne se
teste qu'en essayant d'atteindre les données du second depuis le premier.

---

## 2. Cloisonnement — la partie qui compte ⛔

À faire **connecté comme client**, pas comme conseiller. Récupérer le jeton dans la console de
l'espace client ouvert : `copy(supaSession.access_token)`.

### 2.1 Ce que la base répond vraiment

Pour chaque table, demander les données **de l'autre client** avec le jeton du premier :

```bash
curl -s "https://gutlkjovmsyazwcomoyt.supabase.co/rest/v1/contrats?client_id=eq.<ID_AUTRE_CLIENT>&select=*" \
  -H "apikey: <CLE_PUBLIQUE>" -H "Authorization: Bearer <JETON_CLIENT_1>"
```

**Attendu : `[]` pour chacune.** Une seule ligne renvoyée est ⛔ bloquant.

| Table | Résultat attendu | Constaté |
|---|---|---|
| `clients` | `[]` | |
| `contrats` | `[]` | |
| `vehicules` | `[]` | |
| `rendez_vous` | `[]` | |
| `mandats_signes` | `[]` | |
| `messages_clients` | `[]` | |
| `demandes_transfert` | `[]` | |
| `documents_compagnies` | `[]` | |

### 2.2 Les tables qui ne le regardent pas du tout

Toujours avec un jeton client, sans filtre :

| Table | Résultat attendu | Constaté |
|---|---|---|
| `commissions_attente` | `[]` | |
| `bordereaux` | `[]` | |
| `agents` | `[]` ou sa seule fiche si elle existe | |
| `fiches_paie` | `[]` | |
| `acces_clients` | sa propre ligne, **une seule** | |

### 2.3 Écriture

| # | Essai | Attendu |
|---|---|---|
| 2.3.1 | `PATCH` sur un contrat (le sien) | refusé |
| 2.3.2 | `PATCH` sur `acces_clients` (sa ligne) | refusé — la trace de connexion passe par `marquer_acces_client`, pas par un PATCH |
| 2.3.3 | `POST` d'un message dans `messages_clients` avec le `client_id` de l'autre | refusé |
| 2.3.4 | `POST` d'un message pour lui-même | accepté |

### 2.4 Le stockage

Les documents vivent dans le bucket `documents`, chemins `mandats/<client_id>/…`.

| # | Essai | Attendu |
|---|---|---|
| 2.4.1 | télécharger un fichier de son propre dossier | accepté |
| 2.4.2 | télécharger un fichier du dossier de l'autre client (chemin deviné) | refusé |
| 2.4.3 | lister le bucket | refusé ou limité à son dossier |

### 2.5 État de la RLS

```sql
select c.relname, c.relrowsecurity, count(p.polname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
left join pg_policy p on p.polrelid = c.oid
where c.relkind = 'r' group by 1,2 having c.relrowsecurity = false or count(p.polname) = 0;
```

Toute table listée ici est à examiner. `relrowsecurity = false` sur une table qui contient des
données client est ⛔ bloquant. Zéro politique équivaut à tout refuser — sans danger, mais à
vérifier que c'est voulu.

*Relevé du 25.09.2026 : RLS active sur les 13 tables sensibles. `tenants` a 0 politique
(refus total, voulu).*

---

## 3. Ce que le client voit

| # | Contrôle | Attendu | Constaté |
|---|---|---|---|
| 3.1 | Connexion avec un compte client | arrive dans REX CLOUD, **jamais** dans le CRM |  |
| 3.2 | Connexion conseiller sur le même appareil, juste après | arrive dans le CRM, l'habillage client a disparu |  |
| 3.3 | Session client restaurée après fermeture du navigateur | revient dans REX CLOUD |  |
| 3.4 | Adresse inconnue | refus, aucun rôle inventé |  |
| 3.5 | Compte client désactivé (`actif = false`) | refus |  |
| 3.6 | Documents affichés | **uniquement** ceux publiés (`visible_client = true`) |  |
| 3.7 | Un document non publié, atteint par son URL directe | refusé |  |
| 3.8 | Montants de commission | **invisibles partout** |  |
| 3.9 | Noms d'autres clients | absents, y compris dans les listes déroulantes |  |

Le 3.6 se vérifie des deux côtés : publier un document depuis le CRM, le voir apparaître ;
le dépublier, le voir disparaître.

---

## 4. Quand ça se passe mal

`ecEntrerEspaceClient` enveloppe chaque chargement d'un `.catch(() => [])`. **Une panne se traduit
donc par un espace vide, pas par un message.** Le client voit « aucun contrat » au lieu d'« erreur ».

| # | Essai | Attendu aujourd'hui | Souhaitable |
|---|---|---|---|
| 4.1 | Couper le réseau puis ouvrir l'espace | espace vide, sans explication | un message qui distingue « rien à afficher » de « impossible de charger » |
| 4.2 | Jeton expiré (> 1 h) | à constater | reconnexion proposée |
| 4.3 | Une table refusée par la RLS | section vide, silencieuse | trace dans `journal_erreurs` |

**Ce point est ouvert.** Il n'est pas bloquant pour la mise en ligne — un espace vide ne divulgue
rien — mais il rend tout incident invisible côté client comme côté conseiller. À traiter dès que
le cloisonnement est validé.

---

## 5. Réglages du compte Supabase

| # | Réglage | État au 25.09.2026 | Attendu |
|---|---|---|---|
| 5.1 | Protection contre les mots de passe compromis | ❌ désactivée | activée avant ouverture à de vrais clients |
| 5.2 | Sauvegardes restaurables | ❌ absentes (offre gratuite) | Supabase Pro — **le plus grave de la liste** |
| 5.3 | Fonctions `SECURITY DEFINER` exécutables par `anon` | 13 | chacune justifiée par un usage public réel |
| 5.4 | Envoi des accès client | mot de passe en clair par e-mail | lien d'activation à usage unique (incident n° 6) |

Le 5.2 ne concerne pas que l'espace client, mais c'est le risque le plus lourd du projet :
aujourd'hui, une suppression accidentelle est définitive.

---

## 6. Signature du contrôle

| Date | Version (`version.js`) | Par | Bloquants | Mise en ligne |
|---|---|---|---|---|
| | | | | |
