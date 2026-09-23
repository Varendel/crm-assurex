-- 23.09.2026 — trouvé dans journal_erreurs : « invalid input syntax for type integer: "971.25" ».
-- montant_potentiel était un ENTIER, alors que le CRM y écrit une prime annuelle avec ses centimes
-- (les offres AXA d'Allocia Palanca : 971.25 et 1076.25). Chaque enregistrement d'offre renvoyait
-- donc un HTTP 400, et TOUT le patch était refusé : prime de l'affaire, produits, primes par
-- produit et commission estimée restaient à leur ancienne valeur, en silence.
alter table opportunites alter column montant_potentiel type numeric(12,2) using montant_potentiel::numeric;