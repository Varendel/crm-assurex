-- ═══ ÉQUIPE COFIDEX : DESTINATAIRES DES COURRIELS LIÉS À UN CLIENT (22.09.2026) ═════════════════
-- « Ajoute l'équipe Cofidex SA avec les collaborateurs… le rôle est destinataires. »
-- Table à part : dans « agents », ces personnes apparaîtraient dans les listes d'apporteurs, le
-- partage des commissions et le tableau d'équipe — ce qu'elles ne sont pas.
create table if not exists public.equipe_cofidex (
  id uuid primary key default gen_random_uuid(),
  prenom text, nom text not null, email text, fonction text,
  email_a_verifier boolean not null default false,
  actif boolean not null default true,
  ordre integer not null default 100,
  created_at timestamptz not null default now()
);
alter table public.equipe_cofidex enable row level security;
drop policy if exists equipe_cofidex_interne on public.equipe_cofidex;
create policy equipe_cofidex_interne on public.equipe_cofidex for all
  using (not est_client()) with check (not est_client());
-- Adresses au format initiales@cofidex.ch (sans point). Celles marquées « à vérifier » sont
-- déduites du format : à confirmer avant le premier envoi.
