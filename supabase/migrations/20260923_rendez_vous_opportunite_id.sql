-- Rendez-vous rattaché à une affaire (23.09.2026)
-- « Ajoute la fonction prise de RDV sur les opp. » Le rendez-vous pris depuis la fiche d'une
-- opportunité lui reste attaché : il apparaît dans son fil et sous sa prochaine action, au lieu
-- de se perdre dans l'agenda général.
alter table rendez_vous add column if not exists opportunite_id uuid references opportunites(id) on delete set null;
create index if not exists idx_rendez_vous_opportunite on rendez_vous(opportunite_id);