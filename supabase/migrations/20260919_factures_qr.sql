-- Factures QR suisses (générateur js/33) + paramètres de la société émettrice (IBAN, adresse).
-- Jamais supprimées : statut 'annulee' à la place. Appliquée le 19.09.2026.
create table if not exists public.factures (
  id uuid primary key default gen_random_uuid(),
  numero text not null check (length(numero) <= 40),
  client_id uuid references public.clients(id) on delete set null,
  debiteur jsonb not null default '{}'::jsonb,
  lignes jsonb not null default '[]'::jsonb,
  montant numeric(12,2) not null default 0,
  devise text not null default 'CHF' check (devise in ('CHF','EUR')),
  reference text check (length(reference) <= 40),
  message text check (length(message) <= 140),
  date_emission date not null default current_date,
  date_echeance date,
  statut text not null default 'emise' check (statut in ('brouillon','emise','payee','annulee')),
  paye_le date,
  notes text check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
alter table public.factures enable row level security;
create policy factures_authentifie_hors_rh on public.factures
  for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');

create table if not exists public.parametres_societe (
  cle text primary key check (length(cle) <= 60),
  valeur jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
alter table public.parametres_societe enable row level security;
create policy parametres_societe_authentifie_hors_rh on public.parametres_societe
  for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');
