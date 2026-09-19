-- Espace client REX CLOUD (20.09.2026) : le client peut écrire à son conseiller (au sujet d'un
-- contrat précis ou librement) et demander le transfert de la gestion de ses contrats en signant
-- son mandat de courtage en ligne. Le courtier traite ensuite depuis le CRM.
create table if not exists public.messages_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contrat_id uuid references public.contrats(id) on delete set null,
  sujet text check (length(sujet) <= 200),
  message text not null check (length(message) <= 5000),
  canal text not null default 'espace_client',
  statut text not null default 'nouveau' check (statut in ('nouveau','lu','traite')),
  reponse text,
  repondu_par text,
  repondu_le timestamptz,
  created_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
create index if not exists idx_messages_clients_client on public.messages_clients (client_id, created_at desc);
create index if not exists idx_messages_clients_statut on public.messages_clients (statut, created_at desc);
alter table public.messages_clients enable row level security;
create policy messages_clients_staff on public.messages_clients for all to authenticated
  using (not public.est_client()) with check (not public.est_client());
create policy messages_clients_lecture_client on public.messages_clients for select to authenticated
  using (public.est_client() and client_id = public.client_courant());
create policy messages_clients_ecriture_client on public.messages_clients for insert to authenticated
  with check (public.est_client() and client_id = public.client_courant() and statut = 'nouveau');

create table if not exists public.demandes_transfert (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  compagnies jsonb not null default '[]'::jsonb,  -- [{compagnie, produit, police, statut, police_url, police_nom}]
  message text check (length(message) <= 5000),
  signature_data text,                            -- signature du mandat, image PNG en dataURL
  signe_le timestamptz,
  statut text not null default 'nouveau' check (statut in ('nouveau','mandat_genere','envoye','termine','annule')),
  traite_par text,
  traite_le timestamptz,
  created_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
create index if not exists idx_demandes_transfert_statut on public.demandes_transfert (statut, created_at desc);
alter table public.demandes_transfert enable row level security;
create policy demandes_transfert_staff on public.demandes_transfert for all to authenticated
  using (not public.est_client()) with check (not public.est_client());
create policy demandes_transfert_lecture_client on public.demandes_transfert for select to authenticated
  using (public.est_client() and client_id = public.client_courant());
create policy demandes_transfert_ecriture_client on public.demandes_transfert for insert to authenticated
  with check (public.est_client() and client_id = public.client_courant() and statut = 'nouveau');
