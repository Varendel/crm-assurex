-- Journal des erreurs côté navigateur (CRM + page de signature/RDV publique).
-- Écriture seule depuis le navigateur ; lecture uniquement côté admin (dashboard / Claude via MCP).
-- Appliquée le 19.09.2026. Alimentée par js/00-journal-erreurs.js.
create table public.journal_erreurs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text check (length(source) <= 40),
  message text check (length(message) <= 4000),
  stack text check (length(stack) <= 8000),
  url text check (length(url) <= 500),
  user_email text check (length(user_email) <= 200),
  user_agent text check (length(user_agent) <= 400),
  session_id text check (length(session_id) <= 40),
  breadcrumbs jsonb check (length(breadcrumbs::text) <= 12000),
  contexte jsonb check (length(contexte::text) <= 4000)
);
create index idx_journal_erreurs_created_at on public.journal_erreurs (created_at desc);

alter table public.journal_erreurs enable row level security;
create policy journal_erreurs_insert on public.journal_erreurs
  for insert to anon, authenticated with check (true);
-- pas de policy SELECT/UPDATE/DELETE : personne ne peut lire le journal depuis l'API publique

-- Purge automatique après 90 jours
create or replace function public.purge_journal_erreurs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.journal_erreurs where created_at < now() - interval '90 days';
  return null;
end; $$;
revoke execute on function public.purge_journal_erreurs() from anon, authenticated, public;
create trigger trg_purge_journal_erreurs after insert on public.journal_erreurs
  for each statement execute function public.purge_journal_erreurs();
