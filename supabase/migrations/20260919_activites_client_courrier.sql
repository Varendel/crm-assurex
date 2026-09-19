-- Générateur de courriers clients (js/45) : chaque courrier généré est archivé dans le journal
-- d'activité de la fiche client (type 'courrier', texte complet dans contenu).
-- Appliquée le 19.09.2026.
alter table public.activites_client drop constraint if exists activites_client_type_check;
alter table public.activites_client add constraint activites_client_type_check check (type in ('note','email','appel','courrier'));
