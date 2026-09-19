-- Source d'acquisition du client (canal par lequel il est arrivé) — distincte des entités
-- source_oz / source_cofidex (répartition des commissions), qui restent inchangées.
-- Appliquée le 19.09.2026. Utilisée par js/14-sources.js.
alter table public.clients
  add column if not exists source text check (source in ('recommandation_client','apporteur','famille','reseau','portefeuille_oz','cofidex','rdv_en_ligne','campagne','web','prospection','autre')),
  add column if not exists source_detail text check (length(source_detail) <= 200),
  add column if not exists source_client_id uuid references public.clients(id) on delete set null;
create index if not exists idx_clients_source on public.clients (source);
create index if not exists idx_clients_source_client_id on public.clients (source_client_id);

-- Pré-remplissage (uniquement là où source est vide)
update public.clients set source = 'apporteur',
  source_detail = case
    when lower(apporteur_externe) in ('gaël debressy','gael debressy') then 'Gaël Debressy'
    when lower(apporteur_externe) in ('bruno henriques do vale','bruno do vale henriques') then 'Bruno Henriques do Vale'
    else trim(apporteur_externe) end
  where source is null and coalesce(trim(apporteur_externe),'') <> '';
update public.clients c set source = 'famille', source_client_id = coalesce(c.pere_id, c.mere_id)
  where c.source is null and coalesce(c.pere_id, c.mere_id) is not null;
update public.clients set source = 'portefeuille_oz' where source is null and source_oz = true;
update public.clients set source = 'cofidex' where source is null and source_cofidex = true;
