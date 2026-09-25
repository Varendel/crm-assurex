# Protocole de test — erreurs et pannes

**À dérouler avant chaque mise en ligne.** Compter 20 minutes.

Ce protocole ne cherche pas à prouver que le CRM marche : les autres tests s'en chargent. Il
cherche à savoir **ce qui se passe quand il ne marche pas**. C'est la différence entre un incident
qu'on corrige le jour même et un chiffre faux qu'on découvre six mois plus tard.

Le fil rouge, tiré de tout ce que le registre `INCIDENTS.md` a retenu cette année :

> **Une panne silencieuse coûte plus cher qu'une panne bruyante.** Les trois incidents les plus
> longs à trouver — le backtick de `js/159`, le bouton du dossier de dépôt, les 9 033.— d'AGV —
> avaient tous la même forme : rien ne cassait, rien ne s'affichait en rouge, et le CRM continuait
> de répondre quelque chose de faux.

---

## 1. Le filet automatique

```bash
node test/verifier.js
for t in test/*.test.js; do node "$t" || exit 1; done
```

| # | Contrôle | Attendu |
|---|---|---|
| 1.1 | `verifier.js` | syntaxe, scripts référencés, doublons, fonctions critiques : tout vert |
| 1.2 | Chaque `*.test.js` | 0 échec |
| 1.3 | Nombre de fichiers = nombre de scripts référencés | égalité stricte — un écart signifie qu'un module ne se charge pas |

Le 1.3 mérite un regard : c'est lui qui a rattrapé les 38 références cassées de septembre.

### Le piège qui revient

Un **backtick dans un commentaire, à l'intérieur d'un gabarit** (`` ` ``) casse le fichier
**entier**, et le navigateur l'abandonne **en silence** — aucune erreur, la fonctionnalité n'existe
simplement pas. C'est arrivé deux fois : `js/159` (couleurs du kanban, invisibles pendant quatre
jours) et `js/04` (rattrapé par le vérificateur avant commit, le 25.09.2026).

`verifier.js` le détecte. **Ne jamais commiter sans l'avoir lancé.**

---

## 2. Le ton des messages

Depuis le 25.09.2026, `showError` distingue trois tons, lus dans le message lui-même
(`tonDuMessage`, js/00). Couvert par `test/ton-message.test.js`, à revoir à l'œil une fois :

| # | Geste | Attendu |
|---|---|---|
| 2.1 | Enregistrer un contrat | bandeau **vert**, 4 s, sans ⚠ |
| 2.2 | Envoyer un document | bandeau **bleu** « ⏳ », 5 s |
| 2.3 | Enregistrer un contrat sans compagnie | bandeau **rouge** avec ⚠, 6 s |
| 2.4 | Après 2.1 et 2.2 | `journal_erreurs` n'a reçu **aucune** ligne |
| 2.5 | Après 2.3 | `journal_erreurs` a reçu **une** ligne |

```sql
select source, message, created_at from journal_erreurs order by created_at desc limit 10;
```

---

## 3. Le journal

| # | Contrôle | Comment | Attendu |
|---|---|---|---|
| 3.1 | Une erreur JavaScript est enregistrée | console : `null.x` | ligne `source = 'window.error'` |
| 3.2 | Une promesse rejetée aussi | `Promise.reject(new Error('essai'))` | ligne `source = 'promesse'` |
| 3.3 | Le fil d'Ariane est joint | cliquer 3 boutons puis provoquer une erreur | `breadcrumbs` contient les 3 libellés |
| 3.4 | Aucune valeur saisie n'est enregistrée | taper dans un champ puis provoquer une erreur | le contenu du champ n'apparaît **nulle part** |
| 3.5 | Le signalement manuel fonctionne | `Ctrl + Alt + E` | ligne `source = 'signalement'` |
| 3.6 | Le journal ne casse jamais le CRM | couper le réseau, provoquer une erreur | le CRM continue de répondre |

Le 3.4 est une exigence de confidentialité, pas de confort : le journal part en base et sera relu.

### Lecture du journal avant mise en ligne

```sql
select source, count(*), max(created_at)::date
from journal_erreurs where created_at > now() - interval '7 days'
group by 1 order by 2 desc;
```

Les entrées `source = 'showError-info'` sont d'anciens messages d'attente réétiquetés le
25.09.2026 : les ignorer. Toute autre source en hausse mérite d'être ouverte avant de déployer.

---

## 4. Les pannes réseau et base

| # | Essai | Attendu | Constaté |
|---|---|---|---|
| 4.1 | Réseau coupé, enregistrer un contrat | message d'erreur explicite, **rien d'enregistré à moitié** | |
| 4.2 | Réseau coupé, ouvrir une fiche client | message, pas une fiche vide qui ressemble à un client sans contrat | |
| 4.3 | Jeton expiré (> 1 h d'inactivité) | reconnexion ou message clair | |
| 4.4 | Upload d'un fichier de 25 Mo | refus annoncé avant l'envoi | |
| 4.5 | Envoi d'un e-mail avec 20 Mo de pièces jointes | passe par la session d'envoi Microsoft, sans échec silencieux | |

Le 4.2 est le même défaut que celui décrit au § 4 du protocole REX CLOUD : un `catch` qui rend un
tableau vide transforme une panne en « il n'y a rien ». **C'est la forme d'erreur la plus coûteuse
du projet** — la seule qui produise un chiffre faux plutôt qu'un écran cassé.

---

## 5. Les chiffres — la panne qui ne fait aucun bruit

Un montant faux ne déclenche aucune erreur. Ces contrôles sont donc les seuls à pouvoir l'attraper.

| # | Contrôle | Comment | Attendu |
|---|---|---|---|
| 5.1 | Aucune estimation n'est comptée comme encaissée | vue Entrées d'argent | « Encaissé » ne compte que les lignes avec un montant réel ; le reste est « à confirmer » |
| 5.2 | Les estimations correspondent aux règles codées | `node test/audit-estimations.js <jeton>` | 0 écart, ou des écarts expliqués |
| 5.3 | Les taux par compagnie | même audit | aucune compagnie à un taux impossible (> 40 % hors vie et protection juridique) |
| 5.4 | La part des estimations génériques | même audit | connue et assumée — 35 lignes / 18 954.— au 25.09.2026 |
| 5.5 | Prime annuelle et rythme de paiement | fiche d'un contrat trimestriel | la prime annuelle ne change pas quand le rythme change |

Le 5.5 rejoue l'incident n° 17 : confondre `periodicite` (facteur de conversion du montant saisi)
et `paiement_prime` (rythme des appels) multipliait une prime annuelle par quatre.

---

## 6. Retour en arrière

Avant de mettre en ligne, savoir comment revenir :

| # | Point | État |
|---|---|---|
| 6.1 | Le commit précédent est identifié | `git log --oneline -5` |
| 6.2 | Chaque module récent documente son retour en arrière | en tête de fichier : « retirer la ligne de index.html » |
| 6.3 | Les modifications de base sont réversibles | ⛔ **non** — pas de sauvegarde restaurable (offre gratuite) |
| 6.4 | Les fonctions déployées sont versionnées dans le dépôt | `ocr-decompte` ✅ · `clever-worker` ❌ **son code n'existe que sur Supabase** |

Les 6.3 et 6.4 sont les deux vrais trous du dispositif. Le 6.3 se règle avec Supabase Pro. Le 6.4
se règle en copiant le source de `clever-worker` depuis l'éditeur Supabase vers
`supabase/functions/` — l'API ne sait pas le relire.

**Leçon du 25.09.2026 :** une fonction a été déployée avec un contenu factice et est restée cassée
en production une minute. Depuis : **toujours relire la source déployée après un déploiement**
(`get_edge_function`), jamais se fier au retour de la commande.

---

## 7. Signature du contrôle

| Date | Version (`version.js`) | Par | Bloquants | Mise en ligne |
|---|---|---|---|---|
| | | | | |
