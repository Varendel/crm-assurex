-- Compte de caution par bordereau (Groupe Mutuel, CSS : retenue sur commissions, retraits pour
-- couvrir les contre-passations, solde annoncé par la compagnie) — vue « Comptes de caution ».
-- Versements partiels annulables (retour en arrière d'un bordereau) sans suppression. 19.09.2026.
alter table public.bordereaux add column if not exists caution_retenue numeric(12,2);
alter table public.bordereaux add column if not exists caution_retrait numeric(12,2);
alter table public.bordereaux add column if not exists caution_solde numeric(12,2);
alter table public.commission_tranches add column if not exists annule boolean not null default false;
