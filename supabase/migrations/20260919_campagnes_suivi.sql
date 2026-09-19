-- Suivi des contacts de campagne (À contacter → Contacté → Intéressé → Gagné / Pas intéressé),
-- enregistré dans le cloud (js/32), et archivage des campagnes personnalisées (actif = false)
-- au lieu d'une suppression définitive. Appliquée le 19.09.2026.
create table if not exists public.campagnes_suivi (
  id uuid primary key default gen_random_uuid(),
  theme_id text not null check (length(theme_id) <= 80),
  client_id uuid not null references public.clients(id) on delete cascade,
  statut text not null default 'a_contacter' check (statut in ('a_contacter','contacte','interesse','gagne','refus')),
  updated_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id),
  unique (theme_id, client_id)
);
alter table public.campagnes_suivi enable row level security;
create policy campagnes_suivi_authentifie_hors_rh on public.campagnes_suivi
  for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');
alter table public.campagnes_personnalisees add column if not exists actif boolean not null default true;
