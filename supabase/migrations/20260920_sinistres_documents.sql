-- Espace client REX CLOUD (20.09.2026) : le client déclare un sinistre, demande un document et
-- écrit à son conseiller avec un motif. Le courtier traite le tout depuis REX CRM.
alter table public.messages_clients add column if not exists motif text;

-- Coordonnées du conseiller affichées dans l'espace (sinon le conseiller par défaut du cabinet)
alter table public.acces_clients add column if not exists conseiller_nom text;
alter table public.acces_clients add column if not exists conseiller_email text;
alter table public.acces_clients add column if not exists conseiller_tel text;

create table if not exists public.sinistres (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contrat_id uuid references public.contrats(id) on delete set null,
  date_sinistre date,
  type_sinistre text check (length(type_sinistre) <= 80),
  lieu text check (length(lieu) <= 200),
  description text not null check (length(description) <= 5000),
  tiers text check (length(tiers) <= 1000),
  montant_estime numeric,
  statut text not null default 'declare' check (statut in ('declare','transmis','en_cours','regle','refuse','annule')),
  reference_assureur text check (length(reference_assureur) <= 100),
  notes text,
  traite_par text,
  traite_le timestamptz,
  created_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
create index if not exists idx_sinistres_client on public.sinistres (client_id, created_at desc);
create index if not exists idx_sinistres_statut on public.sinistres (statut, created_at desc);
alter table public.sinistres enable row level security;
create policy sinistres_staff on public.sinistres for all to authenticated
  using (not public.est_client()) with check (not public.est_client());
create policy sinistres_lecture_client on public.sinistres for select to authenticated
  using (public.est_client() and client_id = public.client_courant());
create policy sinistres_ecriture_client on public.sinistres for insert to authenticated
  with check (public.est_client() and client_id = public.client_courant() and statut = 'declare');

create table if not exists public.demandes_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contrat_id uuid references public.contrats(id) on delete set null,
  type_document text not null check (length(type_document) <= 120),
  precisions text check (length(precisions) <= 2000),
  statut text not null default 'nouvelle' check (statut in ('nouvelle','en_cours','envoye','refuse')),
  traite_par text,
  traite_le timestamptz,
  created_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
create index if not exists idx_demandes_documents_client on public.demandes_documents (client_id, created_at desc);
create index if not exists idx_demandes_documents_statut on public.demandes_documents (statut, created_at desc);
alter table public.demandes_documents enable row level security;
create policy demandes_documents_staff on public.demandes_documents for all to authenticated
  using (not public.est_client()) with check (not public.est_client());
create policy demandes_documents_lecture_client on public.demandes_documents for select to authenticated
  using (public.est_client() and client_id = public.client_courant());
create policy demandes_documents_ecriture_client on public.demandes_documents for insert to authenticated
  with check (public.est_client() and client_id = public.client_courant() and statut = 'nouvelle');
