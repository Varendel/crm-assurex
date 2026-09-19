-- Ajoute le statut « relance » (Relancé) au suivi de renouvellement — utilisé par les
-- Relances LAMal (js/11-renouvellements.js). Appliquée le 19.09.2026.
alter table public.contrats drop constraint if exists contrats_revue_statut_check;
alter table public.contrats add constraint contrats_revue_statut_check
  check (revue_statut in ('a_contacter','relance','rdv','offre','reconduit','remplace','resilie'));
