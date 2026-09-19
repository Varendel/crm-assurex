-- Préparation d'un dossier de financement hypothécaire (20.09.2026) : check-list des pièces à
-- réunir (d'après la check-list Assurex « Demande de prêt hypothécaire »), suivi de ce qui est
-- reçu, et relance du client sur ce qui manque. Un dossier par projet de financement.
create table if not exists public.dossiers_financement (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  objet text check (length(objet) <= 200),
  banque text check (length(banque) <= 120),
  montant numeric,
  statut text not null default 'en_cours' check (statut in ('en_cours','transmis','accepte','refuse','annule')),
  situation jsonb not null default '{}'::jsonb,   -- salarié / indépendant, achat / reprise / construction, PPE, rendement
  documents jsonb not null default '[]'::jsonb,   -- [{cle, fourni, date_recue, note}]
  notes text,
  cree_par text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
create index if not exists idx_dossiers_financement_client on public.dossiers_financement (client_id, created_at desc);
alter table public.dossiers_financement enable row level security;
create policy dossiers_financement_staff on public.dossiers_financement for all to authenticated
  using (not public.est_client()) with check (not public.est_client());
create policy dossiers_financement_espace_client on public.dossiers_financement for select to authenticated
  using (public.est_client() and client_id = public.client_courant());
