# Base de données (Supabase)

Projet Supabase : `gutlkjovmsyazwcomoyt` (région eu-central-2, Zurich).

`migrations/` garde une copie de chaque changement de schéma appliqué à la base, dans
l'ordre des dates. Toute modification de tables, de règles d'accès (RLS) ou de fonctions
doit y être ajoutée au moment où elle est appliquée, pour que la base puisse être
reconstruite et que l'historique reste dans le cloud (et pas sur un PC).

Le schéma créé avant le 17.09.2026 a été fait à la main dans le dashboard Supabase et
n'est pas encore versionné ici (à exporter en une migration « initiale »).
