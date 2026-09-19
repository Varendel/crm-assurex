-- Migration 2 — Nettoyage RLS + index (aucun changement de droits, uniquement perf / lisibilité)

-- 1. Doublons : ces tables ont déjà "authenticated_only" (ALL, to authenticated, true)
--    qui couvre exactement la même chose que *_select_authentifie.
drop policy if exists agents_select_authentifie              on public.agents;
drop policy if exists clients_select_authentifie             on public.clients;
drop policy if exists collaborateurs_select_authentifie      on public.collaborateurs;
drop policy if exists commission_tranches_select_authentifie on public.commission_tranches;
drop policy if exists compagnies_contacts_select_authentifie on public.compagnies_contacts;
drop policy if exists contrats_select_authentifie            on public.contrats;
drop policy if exists opportunites_select_authentifie        on public.opportunites;
drop policy if exists rappels_select_authentifie             on public.rappels;
drop policy if exists vehicules_select_authentifie           on public.vehicules;

-- 2. "to public using (auth.role() = 'authenticated')" == "to authenticated using (true)",
--    mais sans réévaluer auth.role() à chaque ligne.
drop policy if exists audit_log_select_authentifie on public.audit_log;
create policy audit_log_select_authentifie on public.audit_log for select to authenticated using (true);

drop policy if exists tache_etapes_select_authentifie on public.tache_etapes;
create policy tache_etapes_select_authentifie on public.tache_etapes for select to authenticated using (true);

drop policy if exists factures_select_authentifie on public.factures;
drop policy if exists factures_insert_authentifie on public.factures;
drop policy if exists factures_update_authentifie on public.factures;
drop policy if exists factures_delete_authentifie on public.factures;
create policy factures_all_authentifie on public.factures for all to authenticated using (true) with check (true);

drop policy if exists postits_select_authentifie on public.postits;
drop policy if exists postits_insert_authentifie on public.postits;
drop policy if exists postits_update_authentifie on public.postits;
drop policy if exists postits_delete_authentifie on public.postits;
create policy postits_all_authentifie on public.postits for all to authenticated using (true) with check (true);

-- mandats_signes : pas d'UPDATE aujourd'hui, on garde exactement les mêmes droits
drop policy if exists mandats_signes_select_authentifie on public.mandats_signes;
drop policy if exists mandats_signes_insert_authentifie on public.mandats_signes;
drop policy if exists mandats_signes_delete_authentifie on public.mandats_signes;
create policy mandats_signes_select_authentifie on public.mandats_signes for select to authenticated using (true);
create policy mandats_signes_insert_authentifie on public.mandats_signes for insert to authenticated with check (true);
create policy mandats_signes_delete_authentifie on public.mandats_signes for delete to authenticated using (true);

-- 3. Policies basées sur l'email : même règle, auth.jwt() évalué une seule fois
drop policy if exists authenticated_only on public.bordereaux;
create policy authenticated_only on public.bordereaux for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');

drop policy if exists authenticated_only on public.commissions;
create policy authenticated_only on public.commissions for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');

drop policy if exists authenticated_only on public.commissions_attente;
create policy authenticated_only on public.commissions_attente for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');

drop policy if exists authenticated_only on public.fiches_paie;
create policy authenticated_only on public.fiches_paie for all to authenticated
  using (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') <> 'rh@cofidex.ch');

drop policy if exists jonathan_only on public.commissions_oz;
create policy jonathan_only on public.commissions_oz for all to authenticated
  using (((select auth.jwt()) ->> 'email') = 'jo@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') = 'jo@cofidex.ch');

drop policy if exists jonathan_only on public.contrats_oz;
create policy jonathan_only on public.contrats_oz for all to authenticated
  using (((select auth.jwt()) ->> 'email') = 'jo@cofidex.ch')
  with check (((select auth.jwt()) ->> 'email') = 'jo@cofidex.ch');

-- 4. Index sur les clés étrangères (hors tenant_id, inutile avec un seul cabinet)
create index if not exists idx_clients_apporteur_id on public.clients (apporteur_id);
create index if not exists idx_clients_pere_id on public.clients (pere_id);
create index if not exists idx_clients_mere_id on public.clients (mere_id);
create index if not exists idx_contrats_client_id on public.contrats (client_id);
create index if not exists idx_contrats_co_apporteur_id on public.contrats (co_apporteur_id);
create index if not exists idx_opportunites_client_id on public.opportunites (client_id);
create index if not exists idx_opportunites_apporteur_id on public.opportunites (apporteur_id);
create index if not exists idx_opportunites_contrat_id on public.opportunites (contrat_id);
create index if not exists idx_commissions_bordereau_id on public.commissions (bordereau_id);
create index if not exists idx_commissions_client_id on public.commissions (client_id);
create index if not exists idx_commissions_apporteur_id on public.commissions (apporteur_id);
create index if not exists idx_commissions_contrat_id on public.commissions (contrat_id);
create index if not exists idx_commissions_attente_client_id on public.commissions_attente (client_id);
create index if not exists idx_commissions_attente_bordereau_id on public.commissions_attente (bordereau_id);
create index if not exists idx_commissions_attente_fiche_paie_id on public.commissions_attente (fiche_paie_id);
create index if not exists idx_commissions_attente_contrat_id on public.commissions_attente (contrat_id);
create index if not exists idx_commission_tranches_bordereau_id on public.commission_tranches (bordereau_id);
create index if not exists idx_rappels_client_id on public.rappels (client_id);
create index if not exists idx_rappels_apporteur_id on public.rappels (apporteur_id);
create index if not exists idx_rappels_collaborateur_id on public.rappels (collaborateur_id);
create index if not exists idx_rappels_tache_parent_id on public.rappels (tache_parent_id);
create index if not exists idx_rappels_contrat_id on public.rappels (contrat_id);
create index if not exists idx_tache_etapes_rappel_id on public.tache_etapes (rappel_id);
create index if not exists idx_collaborateurs_client_id on public.collaborateurs (client_id);
create index if not exists idx_factures_client_id on public.factures (client_id);
create index if not exists idx_demandes_offre_client_id on public.demandes_offre (client_id);
create index if not exists idx_demandes_offre_agent_id on public.demandes_offre (agent_id);
create index if not exists idx_demandes_offre_opportunite_id on public.demandes_offre (opportunite_id);
create index if not exists idx_postits_client_id on public.postits (client_id);
create index if not exists idx_vehicules_contrat_id on public.vehicules (contrat_id);
create index if not exists idx_signature_requests_client_id on public.signature_requests (client_id);
create index if not exists idx_mandats_signes_client_id on public.mandats_signes (client_id);
create index if not exists idx_rendez_vous_agent_id on public.rendez_vous (agent_id);
create index if not exists idx_rendez_vous_client_id on public.rendez_vous (client_id);
