-- Échéancier des renouvellements : préavis de résiliation + suivi de la revue par échéance.
-- Colonnes ajoutées uniquement (aucune donnée existante modifiée). Appliquée le 19.09.2026.
-- Utilisée par js/11-renouvellements.js.
alter table public.contrats
  add column if not exists preavis_mois integer check (preavis_mois between 0 and 12),
  add column if not exists revue_statut text check (revue_statut in ('a_contacter','rdv','offre','reconduit','remplace','resilie')),
  add column if not exists revue_echeance date,
  add column if not exists revue_note text check (length(revue_note) <= 2000),
  add column if not exists revue_maj timestamptz;

comment on column public.contrats.preavis_mois is 'Préavis de résiliation en mois ; null = défaut (3 mois, 1 mois pour la LAMal)';
comment on column public.contrats.revue_statut is 'Suivi de la revue pour l''échéance revue_echeance ; ignoré si revue_echeance <> date_echeance';
comment on column public.contrats.revue_echeance is 'Échéance à laquelle se rapporte revue_statut (repart à zéro quand date_echeance change)';
