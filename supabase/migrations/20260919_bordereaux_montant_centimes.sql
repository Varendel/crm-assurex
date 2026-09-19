-- Montant brut des bordereaux avec centimes (était un entier : les décimales étaient perdues).
-- Appliquée le 19.09.2026.
alter table public.bordereaux alter column montant_brut type numeric(12,2) using montant_brut::numeric(12,2);
