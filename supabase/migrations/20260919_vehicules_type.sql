-- Véhicules : colonne « type de véhicule » (voiture de tourisme, camion, chariot de travail…).
-- Avant, les imports de flotte mettaient « marque + modèle » dans marque et le type dans modele.
-- Les données existantes ont été remises en ordre le 19.09.2026 (marque / modèle / type séparés,
-- erreurs de lecture corrigées, plaques uniformisées). Appliquée le 19.09.2026.
alter table public.vehicules add column if not exists type_vehicule text check (length(type_vehicule) <= 120);
