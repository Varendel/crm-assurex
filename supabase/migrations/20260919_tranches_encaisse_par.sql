-- Versements partiels encaissés par OZ (commission de paiement mensuelle sur l'épargne, Swiss Life…) :
-- ils diminuent le reste attendu mais ne comptent pas dans les encaissements Assurex. 19.09.2026.
alter table public.commission_tranches add column if not exists encaisse_par text not null default 'assurex';
