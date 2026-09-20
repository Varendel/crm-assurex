# REX CLOUD — plan des fonctions de base

*20.09.2026 — pour Assurex Sàrl*

## Le principe de tri

Une fonction de l'espace client n'a pas pour but d'occuper le client. Elle a pour but
d'**empêcher un appel, ou d'éviter un oubli qui coûte**. Les fonctions sont donc classées par ce
qu'elles évitent, pas par ce qu'elles montrent.

Trois questions pour chaque ligne :

1. **Qu'est-ce qui se passe aujourd'hui sans elle ?** Un appel ? Un courriel incomplet ? Rien du
   tout — et c'est le pire cas, parce que l'information n'arrive jamais.
2. **Qui perd quoi si ça n'est pas fait à temps ?** Une couverture qui ne porte pas, une prime
   payée en trop, un délai légal dépassé.
3. **Le client peut-il le faire seul, ou faut-il valider ?** Rien de ce qui engage une compagnie
   ne part sans le courtier. L'espace client **transmet**, il n'affilie pas.

---

## Déjà en place

| Fonction | Privé | Entreprise |
|---|:--:|:--:|
| Voir ses contrats, échéances et délais de résiliation | ✓ | ✓ |
| Télécharger ses polices | ✓ | ✓ |
| Arborescence des contrats par catégorie | ✓ | ✓ |
| Déclarer un sinistre | ✓ | ✓ |
| Demander un document | ✓ | ✓ |
| Écrire à son conseiller | ✓ | ✓ |
| Demander le transfert de gestion | ✓ | ✓ |
| Prime mensuelle affichée (LAMal, LCA santé) | ✓ | — |
| Changer d'adresse | ✓ | ✓ |
| Annoncer un salarié (entrée / sortie) | — | ✓ |

---

## À ajouter — communes aux deux

### 1. Mettre à jour ses coordonnées · *effort : faible*

Téléphone et e-mail, sur le modèle exact du changement d'adresse (proposition, pas écriture
directe). Sans cela, un numéro périmé bloque la seule voie rapide le jour d'un sinistre.

### 2. Prendre rendez-vous · *effort : faible*

Le lien Calendly existe déjà côté CRM ; il n'est pas exposé dans l'espace client. Un bouton dans
l'onglet « Mon conseiller » suffit. Ce qu'on évite : l'aller-retour de quatre messages pour
trouver un créneau.

### 3. Être averti quand une police arrive · *effort : moyen*

Le client dépose une demande, puis n'a aucune raison de revenir. Une notification à l'arrivée du
document transforme l'espace d'un endroit qu'on visite en un endroit qui appelle.
**Condition :** aucun envoi automatique sans validation — la règle de la maison s'applique ici
comme ailleurs.

---

## À ajouter — clients privés

### 4. Annoncer un changement de situation · *effort : moyen* — **priorité haute**

Mariage, naissance, séparation, changement d'employeur, départ à l'étranger, fin d'études.
Chacun de ces événements change une couverture, et aucun n'arrive spontanément au courtier.

C'est la fonction qui rapporte le plus : une naissance ouvre une LAMal enfant, une RC ménage
révisée et souvent un 3a. Aujourd'hui on l'apprend six mois plus tard, ou jamais.

Même patron que l'adresse et le salarié : un type d'événement, une date, quelques champs, et le
courtier applique.

### 5. Membres du ménage · *effort : moyen*

Conjoint et enfants, avec date de naissance. Ils commandent la LAMal, la RC ménage et la
prévoyance. Sans eux, la fiche décrit une personne seule alors qu'elle assure une famille.

À faire **après** le point 4 : une naissance annoncée alimente cette liste, l'inverse n'est pas
vrai.

### 6. Franchise et caisse maladie — la fenêtre de novembre · *effort : moyen* — **saisonnier**

Le changement de franchise et le changement de caisse se demandent avant le **30 novembre**.
C'est une date unique, connue d'avance, et l'oubli coûte une année entière de prime trop élevée.

Une demande simple — « je veux revoir ma franchise » — suffit : c'est le courtier qui calcule et
propose. À livrer **avant fin octobre** pour servir cette année, sinon la fonction attend douze
mois.

### 7. Véhicules : changement de plaque ou de véhicule · *effort : faible*

Un véhicule remplacé et non annoncé, c'est une casco qui porte sur l'ancien. Les véhicules sont
déjà dans la fiche ; il manque le geste d'annonce.

---

## À ajouter — clients entreprise

### 8. Déclaration annuelle des salaires · *effort : moyen* — **priorité haute, saisonnier**

Chaque janvier, la LAA, la LPP et l'IJM réclament la masse salariale de l'année écoulée. C'est
la démarche administrative la plus lourde de l'année pour l'employeur, la plus relancée par les
compagnies, et celle qui produit les régularisations les plus désagréables quand elle est
approximative.

Un écran qui reprend les salariés déjà annoncés et demande seulement les salaires effectifs
supprime la ressaisie — et c'est la ressaisie qui produit les erreurs.

À livrer **avant fin décembre**.

### 9. Liste des salariés assurés · *effort : faible*

Le pendant de l'annonce : voir qui est effectivement annoncé, et depuis quand. C'est aussi le
seul moyen pour l'employeur de repérer un oubli — un salarié parti l'an dernier et toujours
assuré.

Dépend du point 8 pour être complète, mais utile dès maintenant avec les seules annonces reçues.

### 10. Déclaration d'accident professionnel · *effort : moyen*

Distincte du sinistre général : la LAA a son propre formulaire, ses propres délais, et le
salarié n'est pas le preneur d'assurance. Aujourd'hui traité comme un sinistre ordinaire, ce qui
fait perdre des jours.

### 11. Attestations d'entreprise · *effort : faible*

Attestation LAA et certificat LPP, réclamés à chaque appel d'offres et à chaque nouveau mandat.
Techniquement une demande de document, mais qui mérite son propre bouton : c'est ce qu'on
cherche quand on est pressé.

### 12. Changement de raison sociale, de siège ou d'IDE · *effort : faible*

Rare, mais bloquant : une police au nom d'une société qui n'existe plus se conteste.

---

## Ordre proposé

L'ordre suit deux critères : ce qui expire, puis ce qui rapporte.

| # | Quand | Quoi | Pourquoi maintenant |
|---|---|---|---|
| 1 | **avant fin octobre** | Franchise et caisse maladie (6) | Le 30 novembre ne se rattrape pas |
| 2 | **avant fin décembre** | Déclaration annuelle des salaires (8) | Janvier arrive avec les relances |
| 3 | ensuite | Changement de situation (4) | Le plus gros rendement, sans date limite |
| 4 | ensuite | Coordonnées (1) + rendez-vous (2) | Faibles, à grouper en une fois |
| 5 | ensuite | Salariés assurés (9) + accident LAA (10) | Complètent le volet entreprise |
| 6 | plus tard | Ménage (5), véhicules (7), attestations (11), raison sociale (12) | Utiles, jamais urgents |

---

## Deux règles qui ne changent pas

**L'espace client transmet, il n'exécute pas.** Chaque fonction de cette liste produit une
demande que le courtier applique. Laisser croire qu'une saisie suffit à couvrir quelqu'un serait
la pire des simplifications — et la seule qui expose vraiment.

**Rien ne part automatiquement.** Notifications comprises : un message au client est validé avant
d'être envoyé.
