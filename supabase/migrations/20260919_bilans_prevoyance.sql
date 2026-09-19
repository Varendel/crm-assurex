-- Analyses / bilans de prévoyance enregistrés sur la fiche client. La table était utilisée par le
-- code (js/02 enregistrerBilanSurFiche, js/05 onglet Prévoyance) mais n'avait jamais été créée :
-- l'enregistrement échouait. donnees = saisie complète de l'analyse (js/23) pour la rouvrir.
-- Appliquée le 19.09.2026.
create table if not exists public.bilans_prevoyance (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  nom text check (length(nom) <= 200),
  resume text check (length(resume) <= 2000),
  html_snapshot text,
  donnees jsonb,
  auteur text check (length(auteur) <= 200),
  created_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
create index if not exists idx_bilans_prevoyance_client on public.bilans_prevoyance (client_id, created_at desc);
alter table public.bilans_prevoyance enable row level security;
create policy bilans_prevoyance_authentifie_hors_rh on public.bilans_prevoyance
  for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');
