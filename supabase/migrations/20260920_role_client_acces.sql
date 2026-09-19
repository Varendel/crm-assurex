-- Rôle « client » / espace client (20.09.2026) : un compte Supabase Auth par client, avec son
-- propre mot de passe (créé par le courtier via la fonction edge « acces-client », seule à
-- détenir la clé de service). Principe : par défaut un compte client ne voit RIEN — toutes les
-- règles existantes « connecté = tout voir » sont fermées pour lui — puis on ouvre explicitement,
-- en lecture seule, sa fiche, ses contrats en vigueur, ses véhicules, ses mandats et ses RDV.
-- Appliquée le 20.09.2026.
create table if not exists public.acces_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  auth_user_id uuid unique,
  email text not null,
  actif boolean not null default true,
  cree_par text,
  cree_le timestamptz not null default now(),
  dernier_acces timestamptz,
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
create unique index if not exists idx_acces_clients_email on public.acces_clients (lower(email));
create index if not exists idx_acces_clients_client on public.acces_clients (client_id);
alter table public.acces_clients enable row level security;

create or replace function public.est_client() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.acces_clients a where a.auth_user_id = auth.uid() and a.actif);
$$;
create or replace function public.client_courant() returns uuid
language sql stable security definer set search_path = public as $$
  select a.client_id from public.acces_clients a where a.auth_user_id = auth.uid() and a.actif limit 1;
$$;
grant execute on function public.est_client() to authenticated, anon;
grant execute on function public.client_courant() to authenticated, anon;

-- 1) Toutes les règles « connecté = tout voir » excluent les comptes clients
do $$
declare p record; q text; w text; parties text;
begin
  for p in select tablename, policyname, qual, with_check from pg_policies
           where schemaname = 'public' and 'authenticated' = any(roles) and tablename <> 'acces_clients' loop
    q := p.qual; w := p.with_check; parties := '';
    if q is not null and position('est_client' in q) = 0 then
      parties := parties || format(' using ((%s) and not public.est_client())', q);
    end if;
    if w is not null and position('est_client' in w) = 0 then
      parties := parties || format(' with check ((%s) and not public.est_client())', w);
    end if;
    if parties <> '' then
      execute format('alter policy %I on public.%I%s', p.policyname, p.tablename, parties);
    end if;
  end loop;
end $$;

-- 2) Ce qu'un client peut voir — lecture seule, uniquement ce qui le concerne
create policy acces_clients_self on public.acces_clients for select to authenticated
  using (auth_user_id = auth.uid() or not public.est_client());
create policy acces_clients_staff on public.acces_clients for all to authenticated
  using (not public.est_client()) with check (not public.est_client());
create policy clients_espace_client on public.clients for select to authenticated
  using (public.est_client() and id = public.client_courant());
create policy contrats_espace_client on public.contrats for select to authenticated
  using (public.est_client() and client_id = public.client_courant()
         and coalesce(statut,'') not in ('annulé','mandat_resilie'));
create policy vehicules_espace_client on public.vehicules for select to authenticated
  using (public.est_client() and client_id = public.client_courant());
create policy mandats_espace_client on public.mandats_signes for select to authenticated
  using (public.est_client() and client_id = public.client_courant());
create policy rdv_espace_client on public.rendez_vous for select to authenticated
  using (public.est_client() and client_id = public.client_courant());
