-- Relance du client = demande rouverte (22.09.2026)
--
-- POURQUOI : quand un client répond dans le fil d'une demande close (REX CLOUD, js/69
-- filEnvoyerClient), l'écran tentait de repasser messages_clients.statut à « nouveau » par un
-- PATCH. Or la RLS ne donne au client que SELECT et INSERT sur messages_clients : le PATCH était
-- refusé en silence, la demande restait « Traité » côté CRM et la relance passait inaperçue.
--
-- CE QUI CHANGE : la réouverture est faite par la BASE, au moment où la réponse du client est
-- écrite dans messages_echanges — quel que soit l'écran qui l'écrit. La fonction est SECURITY
-- DEFINER (elle agit avec les droits de son propriétaire, pas ceux du client) mais ne touche
-- qu'une chose : le statut de la demande à laquelle le message est rattaché.
--
-- COEXISTENCE avec messages_clients_ouvrir_fil : ce déclencheur-là recopie le PREMIER message du
-- client dans messages_echanges à la création de la demande. À cet instant le statut vaut déjà
-- « nouveau » : la condition `statut <> 'nouveau'` fait de notre mise à jour un non-événement.
-- Aucune boucle possible : on met à jour messages_clients, jamais messages_echanges.
--
-- APPLIQUÉE le 22.09.2026 sur le projet Supabase. Pour la rejouer ailleurs : coller ce fichier dans Supabase → SQL Editor du
-- projet et l'exécuter, ou `supabase db push` depuis le dépôt. Idempotent : peut être rejoué.
-- RETOUR EN ARRIÈRE :
--   drop trigger if exists messages_echanges_rouvrir_demande on public.messages_echanges;
--   drop function if exists public.rouvrir_demande_sur_relance_client();

create or replace function public.rouvrir_demande_sur_relance_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.auteur = 'client' then
    update public.messages_clients m
       set statut = 'nouveau'
     where m.id = new.message_id
       and m.statut <> 'nouveau'
       -- La recopie automatique du premier message (ouvrir_fil_message, auteur « client » même
       -- quand c'est le conseiller qui écrit) n'est pas une relance : sans cette exclusion, un
       -- message écrit par le conseiller (créé « traité ») se rouvrirait tout seul.
       and not (new.created_at = m.created_at and new.corps = m.message)
       -- Garde-fou : un compte client ne rouvre que SES demandes (la RLS d'insertion sur
       -- messages_echanges le garantit déjà ; on ne s'en remet pas qu'à elle, la fonction
       -- s'exécutant avec des droits élevés).
       and (not public.est_client() or m.client_id = public.client_courant());
  end if;
  return new;
end;
$$;

revoke all on function public.rouvrir_demande_sur_relance_client() from public;

drop trigger if exists messages_echanges_rouvrir_demande on public.messages_echanges;
create trigger messages_echanges_rouvrir_demande
  after insert on public.messages_echanges
  for each row
  execute function public.rouvrir_demande_sur_relance_client();
