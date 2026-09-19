-- Conseil financier (js/22-conseil-financier.js) : un dossier par client — situation (budget,
-- patrimoine, prévoyance), projets de vie, hypothèses de calcul, recommandations, étape du processus.
-- Appliquée le 19.09.2026.
create table if not exists public.dossiers_conseil (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  etape text not null default 'decouverte' check (etape in ('decouverte','analyse','recommandations','mise_en_oeuvre','suivi')),
  situation jsonb not null default '{}'::jsonb,
  projets jsonb not null default '[]'::jsonb,
  hypotheses jsonb not null default '{}'::jsonb,
  recommandations jsonb not null default '[]'::jsonb,
  notes text check (length(notes) <= 20000),
  prochain_point date,
  conseiller text check (length(conseiller) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
create index if not exists idx_dossiers_conseil_maj on public.dossiers_conseil (updated_at desc);
alter table public.dossiers_conseil enable row level security;
create policy dossiers_conseil_authentifie_hors_rh on public.dossiers_conseil
  for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');
