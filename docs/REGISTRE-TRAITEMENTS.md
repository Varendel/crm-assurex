# Registre des activités de traitement — Assurex Sàrl

**Version 1.0 — 25 septembre 2026** · art. 12 LPD, art. 24 OPDo

L'exemption prévue pour les entreprises de moins de 250 collaborateurs (art. 12 al. 5 LPD,
art. 24 OPDo) **ne s'applique pas ici** : le traitement porte sur des données sensibles au sens de
l'art. 5 let. c LPD — des données de santé — à grande échelle au regard de l'activité. Le registre
est donc obligatoire. Il est tenu par la direction, revu au moins une fois par an et à chaque
changement de sous-traitant.

**Responsable du traitement** : Assurex Sàrl, Rue du Centre 142, 1025 St-Sulpice —
agrément FINMA F01565757 — jo@cofidex.ch — +41 79 101 99 26.
**Personne de contact** : Jonathan Özkan, directeur associé.

---

## T1 · Gestion des mandats de courtage

| | |
|---|---|
| **Finalité** | Exécuter le mandat : analyse des besoins, conseil, conclusion, gestion du portefeuille, suivi des échéances, résiliations |
| **Personnes concernées** | Clients privés et entreprises, prospects, personnes assurées désignées au contrat |
| **Catégories de données** | Identité, coordonnées, état civil, n° AVS, situation familiale, professionnelle et financière, contrats, primes, échéances, correspondance |
| **Destinataires** | Compagnies d'assurance désignées par le client ; Cofidex SA (administration) |
| **Conservation** | Durée du mandat + 10 ans (art. 958f CO, prescription) |
| **Transfert hors de Suisse** | Aucun, hors T9 |
| **Base** | Contrat (art. 31 al. 2 let. a LPD) |

## T2 · Données de santé et questionnaires médicaux

| | |
|---|---|
| **Finalité** | Souscription des couvertures maladie, accident, perte de gain, prévoyance ; gestion des réserves et des cas d'incapacité |
| **Personnes concernées** | Clients, personnes assurées, collaborateurs des clients entreprises |
| **Catégories de données** | **Données sensibles** : santé, incapacités de travail, réserves, prestations d'invalidité, indemnités journalières |
| **Destinataires** | Uniquement la ou les compagnies désignées, pour la couverture demandée |
| **Conservation** | Durée du contrat + 10 ans |
| **Transfert hors de Suisse** | Possible via T9 si le document est lu automatiquement — droit d'opposition ouvert |
| **Base** | **Consentement exprès** (art. 6 al. 7 let. a LPD), recueilli dans le mandat et le questionnaire signés |

## T3 · Demandes d'offres aux compagnies

| | |
|---|---|
| **Finalité** | Obtenir et comparer des offres |
| **Personnes concernées** | Clients, prospects, collaborateurs des clients entreprises |
| **Catégories de données** | Identité, adresse, activité, masse salariale, effectif, couvertures souhaitées, données de santé le cas échéant |
| **Destinataires** | Les compagnies sollicitées — **en copie cachée lorsqu'elles sont plusieurs**, pour qu'aucune ne sache qui d'autre est consulté |
| **Conservation** | 10 ans (documentation du conseil, LSFin) |
| **Base** | Contrat + consentement pour les données sensibles |

## T4 · Identification LBA

| | |
|---|---|
| **Finalité** | Vérification de l'identité du cocontractant et de l'ayant droit économique, clarifications, documentation |
| **Personnes concernées** | Clients, ayants droit économiques, représentants de personnes morales |
| **Catégories de données** | Copie de pièce d'identité, date de naissance, nationalité, domicile, IDE, arrière-plan économique |
| **Destinataires** | Autorités : MROS (art. 9 LBA), FINMA, organisme d'autorégulation, autorités pénales |
| **Conservation** | **10 ans** après la fin de la relation d'affaires ou l'exécution de la transaction (art. 7 al. 3 LBA) — durée impérative |
| **Base** | Obligation légale (LBA) |
| **Particularité** | Interdiction d'informer la personne concernée en cas de communication au MROS (art. 10a LBA) ; le droit d'accès peut être restreint à ce titre (art. 26 al. 1 let. b LPD) |

## T5 · Gestion des sinistres

| | |
|---|---|
| **Finalité** | Assister le client dans la déclaration et le suivi |
| **Personnes concernées** | Clients, personnes assurées, tiers lésés le cas échéant |
| **Catégories de données** | Circonstances, constats, rapports médicaux, factures, photos, correspondance |
| **Destinataires** | Compagnie concernée |
| **Conservation** | Clôture + 10 ans |
| **Base** | Contrat ; consentement pour les données de santé |

## T6 · Données des collaborateurs des clients entreprises

| | |
|---|---|
| **Finalité** | Établir et gérer les couvertures collectives (LAA, LAAC, PGM, LPP) |
| **Personnes concernées** | Salariés des clients entreprises |
| **Catégories de données** | Nom, date de naissance, n° AVS, sexe, taux d'activité, date d'entrée, **salaire AVS annuel**, adresse privée pour les offres LPP nominatives |
| **Destinataires** | Compagnies et institutions de prévoyance sollicitées |
| **Conservation** | Durée du contrat collectif + 10 ans |
| **Base** | Contrat conclu avec l'employeur ; **c'est l'employeur qui répond de l'information de ses salariés** |
| **Particularité** | Assurex agit ici pour le compte de l'employeur — la qualification de sous-traitance (art. 9 LPD) est à formaliser dans le mandat entreprise |

## T7 · Espace client REX CLOUD

| | |
|---|---|
| **Finalité** | Donner au client l'accès à ses contrats, documents, rendez-vous ; recevoir ses demandes et ses dépôts |
| **Personnes concernées** | Clients disposant d'un accès |
| **Catégories de données** | Sous-ensemble de T1/T5 limité au dossier du client, plus les traces de connexion |
| **Destinataires** | Le client lui-même, exclusivement |
| **Conservation** | Traces de connexion : 12 mois. Données affichées : voir T1 |
| **Base** | Contrat |
| **Mesures** | Cloisonnement appliqué par la base de données (RLS), pas par l'affichage ; stockage fermé aux comptes clients, accès par fonction serveur qui déduit l'identité du jeton ; activation par lien à usage unique, aucun mot de passe transmis |

## T8 · Commissions, facturation et comptabilité

| | |
|---|---|
| **Finalité** | Calculer et contrôler les commissions, facturer, tenir la comptabilité |
| **Personnes concernées** | Clients, apporteurs, agents |
| **Catégories de données** | Contrats, primes, taux, décomptes des compagnies, relevés bancaires |
| **Destinataires** | Fiduciaire, autorités fiscales |
| **Conservation** | 10 ans (art. 958f CO) |
| **Base** | Obligation légale et intérêt prépondérant |
| **Accès** | Restreint : le compte administratif RH n'accède ni aux commissions, ni aux fiches de paie, ni à la trésorerie |

## T9 · Lecture automatique de documents (OCR par IA)

| | |
|---|---|
| **Finalité** | Extraire les données chiffrées des polices et décomptes pour éviter la ressaisie |
| **Personnes concernées** | Clients dont un document est lu |
| **Catégories de données** | Le contenu du document : identité, n° de police, primes, échéances — et, sur une police santé, des données sensibles |
| **Sous-traitants** | **Anthropic PBC** et **OpenAI LLC**, États-Unis |
| **Transfert hors de Suisse** | **Oui — États-Unis.** Décision d'adéquation limitée aux entreprises certifiées *Swiss-U.S. Data Privacy Framework* ; à défaut, clauses contractuelles types et engagements de non-conservation et de non-entraînement |
| **Conservation** | Le document reste hébergé en Suisse ; seul le résultat de la lecture est repris dans le CRM |
| **Base** | Intérêt prépondérant à la qualité de la saisie, **avec droit d'opposition** : sur demande, la saisie est faite à la main |
| **À faire** | Obtenir et classer l'accord de traitement (DPA) de chaque fournisseur ; vérifier la certification DPF |

## T10 · Information des clients et campagnes

| | |
|---|---|
| **Finalité** | Informer les clients dans le cadre du mandat : échéances, changements de loi, optimisations |
| **Personnes concernées** | Clients sous mandat |
| **Catégories de données** | Identité, coordonnées, contrats concernés |
| **Destinataires** | Aucun tiers |
| **Conservation** | Durée du mandat |
| **Base** | Contrat |
| **Limite** | **Aucune publicité pour des tiers, aucune cession ni location de fichier, aucune exploitation commerciale.** Opposition possible en tout temps sans effet sur le mandat |

## T11 · Sécurité, journalisation et sauvegardes

| | |
|---|---|
| **Finalité** | Tracer les accès et les actions, détecter les incidents, pouvoir restaurer les données |
| **Personnes concernées** | Clients, collaborateurs, agents |
| **Catégories de données** | Identifiant de l'auteur, horodatage, action, objet concerné ; copies complètes des données pour les sauvegardes |
| **Destinataires** | Aucun |
| **Conservation** | Journal : 12 mois. Sauvegardes : 4 hebdomadaires, 12 mensuelles, 1 annuelle sur 10 ans |
| **Base** | Intérêt prépondérant à la sécurité (art. 31 al. 1 LPD) ; obligation contractuelle d'assurance |
| **Mesures** | Support externe chiffré, conservé hors du réseau |

---

## Registre des sous-traitants (art. 9 et 12 al. 3 LPD)

| Sous-traitant | Traitements | Lieu | Transfert hors de Suisse | Contrat de sous-traitance |
|---|---|---|---|---|
| Supabase Inc. / AWS | T1 à T11 — hébergement de la base et des documents | **Suisse** (Zurich, `eu-central-2`) | Non pour l'hébergement ; administration depuis les États-Unis | Conditions de service — **DPA à classer** |
| Microsoft (365, Outlook, SharePoint) | T1, T3, T5, T10 — messagerie et classement | UE / Suisse | Groupe américain — DPF | Conditions Microsoft — **DPA à classer** |
| Microsoft (GitHub Pages) | Hébergement de l'application, **aucune donnée client** | États-Unis | Sans objet | — |
| Anthropic PBC | T9 — lecture de documents | États-Unis | **Oui** | **À obtenir** |
| OpenAI LLC | T9 — lecture de documents | États-Unis | **Oui** | **À obtenir** |

## Mesures de sécurité (art. 8 LPD, art. 1 à 3 OPDo)

Chiffrement en transit (TLS) ; chiffrement au repos côté hébergeur ; cloisonnement par dossier
appliqué au niveau de la base de données et vérifié par des tests automatiques ; comptes
nominatifs et droits différenciés ; contrôle d'intégrité (SRI) sur les bibliothèques externes ;
journalisation des accès ; liens de téléchargement signés valables 5 minutes ; activation des
accès clients par lien à usage unique ; sauvegardes hebdomadaires dont une hors réseau.

## Ce qui reste à mettre en place

| Point | Échéance visée |
|---|---|
| MFA sur Microsoft 365 et sur l'administration Supabase | immédiat |
| Protection contre les mots de passe compromis (Supabase) | immédiat |
| Première sauvegarde et rythme hebdomadaire | immédiat |
| DPA signés ou classés pour les cinq sous-traitants | 1 mois |
| Analyse d'impact (art. 22 LPD) sur T2 et T9 — données de santé et transfert hors de Suisse | 3 mois |
| Clause de sous-traitance dans le mandat entreprise (T6) | 3 mois |
| Procédure écrite en cas de violation de la sécurité des données (art. 24 LPD) | 1 mois |

*Revu le : 25.09.2026 — prochaine revue : 25.09.2027 ou à tout changement de sous-traitant.*
