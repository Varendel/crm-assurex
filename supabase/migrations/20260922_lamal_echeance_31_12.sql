-- ═══ LAMal : l'échéance est toujours le 31.12 de l'année en cours (22.09.2026) ═══════════════════
-- « Date d'échéance des contrats LAMal, même nouveaux : toujours 31.12 de l'année en cours. »
-- L'assurance de base se renouvelle chaque année au 1er janvier : son échéance est le 31 décembre
-- de l'année en cours (ou de l'année de début, si le contrat commence plus tard). La règle est posée
-- en base, pour valoir quel que soit le chemin (formulaire, import, EcoHub, OCR…).
-- Les contrats résiliés, annulés ou dont le mandat est résilié gardent leur date.

create or replace function public.lamal_echeance_annuelle(debut date)
returns date language sql stable as $$
  select make_date(greatest(extract(year from current_date)::int, coalesce(extract(year from debut)::int, 0)), 12, 31)
$$;

create or replace function public.contrats_lamal_echeance()
returns trigger language plpgsql as $$
begin
  if new.produit ~* 'lamal' and coalesce(new.statut, '') not in ('résilié', 'annulé', 'mandat_resilie') then
    new.date_echeance := public.lamal_echeance_annuelle(new.date_debut);
  end if;
  return new;
end $$;

drop trigger if exists trg_contrats_lamal_echeance on public.contrats;
create trigger trg_contrats_lamal_echeance
  before insert or update of produit, date_debut, date_echeance, statut on public.contrats
  for each row execute function public.contrats_lamal_echeance();

-- Remise à niveau des contrats LAMal actifs existants.
update public.contrats
   set date_echeance = public.lamal_echeance_annuelle(date_debut)
 where produit ~* 'lamal'
   and coalesce(statut, '') not in ('résilié', 'annulé', 'mandat_resilie')
   and date_echeance is distinct from public.lamal_echeance_annuelle(date_debut);

-- Chaque 1er janvier : les échéances LAMal actives passent au 31.12 de la nouvelle année.
select cron.unschedule(jobid) from cron.job where jobname = 'lamal-echeance-annuelle';
select cron.schedule('lamal-echeance-annuelle', '10 0 1 1 *', $$
  update public.contrats
     set date_echeance = public.lamal_echeance_annuelle(date_debut)
   where produit ~* 'lamal'
     and coalesce(statut, '') not in ('résilié', 'annulé', 'mandat_resilie')
     and date_echeance is distinct from public.lamal_echeance_annuelle(date_debut)
$$);
