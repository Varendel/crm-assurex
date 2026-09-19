-- Journal des écarts entre l'estimation de commission du CRM et le montant réellement versé par la
-- compagnie (rempli à chaque import de décompte qui solde ou rapproche une commission), pour affiner
-- les taux paramétrés au fil du temps. js/06 (import), js/29 (Suivi financier → Précision). 19.09.2026.
create table if not exists public.commission_ecarts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  commission_id uuid references public.commissions_attente(id) on delete set null,
  contrat_id uuid,
  bordereau_id uuid,
  compagnie text,
  produit text,
  nature text,
  prime_annuelle numeric(12,2),
  montant_estime numeric(12,2),
  montant_recu numeric(12,2),
  taux_decompte numeric(6,2),
  source text,
  note text check (length(note) <= 500),
  tenant_id uuid default 'becc5112-5c6d-4474-94e9-781786eda011'::uuid references public.tenants(id)
);
alter table public.commission_ecarts enable row level security;
create policy commission_ecarts_authentifie_hors_rh on public.commission_ecarts
  for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');
