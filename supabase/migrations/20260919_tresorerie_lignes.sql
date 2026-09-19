-- Plan de trésorerie : charges et encaissements saisis à la main + solde de départ
-- (les commissions attendues sont calculées depuis commissions_attente). js/21-tresorerie.js
-- Appliquée le 19.09.2026.
create table if not exists public.tresorerie_lignes (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('entree','sortie','solde')),
  libelle text not null check (length(libelle) <= 200),
  categorie text check (length(categorie) <= 60),
  montant numeric(12,2) not null default 0,
  frequence text not null default 'mensuel' check (frequence in ('unique','mensuel','trimestriel','semestriel','annuel')),
  date_debut date not null default current_date,
  date_fin date,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
alter table public.tresorerie_lignes enable row level security;
create policy tresorerie_authentifie_hors_rh on public.tresorerie_lignes
  for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');
