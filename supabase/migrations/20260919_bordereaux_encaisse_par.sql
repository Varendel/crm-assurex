-- Qui a encaissé le bordereau : Assurex (défaut) ou OZ Assure (décomptes encore versés à OZ,
-- saisis pour mémoire sans fausser les chiffres Assurex). js/06 import de décompte, js/07 liste.
-- Appliquée le 19.09.2026.
alter table public.bordereaux add column if not exists encaisse_par text not null default 'assurex'
  check (encaisse_par in ('assurex','oz'));
