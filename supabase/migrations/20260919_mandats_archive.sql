-- Mandats : archivage au lieu de suppression (règle : on ne supprime jamais de données) — 19.09.2026
alter table public.mandats_signes add column if not exists archive boolean not null default false;
