-- Journal d'activité de la fiche client : notes, e-mails envoyés, appels (le reste du fil —
-- tâches, RDV, signatures, modifications — est lu dans les tables existantes).
-- Appliquée le 19.09.2026. Utilisée par js/17-fiche-activite.js.
create table if not exists public.activites_client (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('note','email','appel')),
  sujet text check (length(sujet) <= 300),
  contenu text check (length(contenu) <= 10000),
  auteur text check (length(auteur) <= 200),
  created_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
create index if not exists idx_activites_client_client on public.activites_client (client_id, created_at desc);
alter table public.activites_client enable row level security;
create policy activites_client_authentifie on public.activites_client
  for all to authenticated using (true) with check (true);
