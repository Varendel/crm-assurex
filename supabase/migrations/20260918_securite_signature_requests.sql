-- Migration 1 — Sécurisation de signature_requests sans casser le flux de signature des mandats
--
-- Flux actuel (js/05-contrats-clients.js) :
--   * création de la demande      : POST par le CRM avec la session connectée (ligne ~1866)
--   * signature par le client     : RPC submit_signature_request (SECURITY DEFINER, ligne ~2143)
--   * lecture du lien de signature: RPC get_signature_request (SECURITY DEFINER)
--   * rattrapage                  : recupererSignaturesEnAttente -> SELECT + PATCH traite=true, session connectée
-- => le rôle anonyme n'a besoin d'AUCUN accès direct à la table, seulement aux deux RPC.

-- 1. Retirer les accès anonymes directs
drop policy if exists signature_requests_insert_all on public.signature_requests;
drop policy if exists signature_requests_update_all on public.signature_requests;

create policy signature_requests_insert_authenticated on public.signature_requests
  for insert to authenticated with check (true);

create policy signature_requests_update_authenticated on public.signature_requests
  for update to authenticated using (true) with check (true);
-- (signature_requests_select_authenticated existe déjà et reste inchangée)

-- 2. Purge : ne plus jamais supprimer une signature reçue mais pas encore rattachée au mandat
--    Avant : DELETE de TOUT ce qui a > 24 h, y compris statut='signe' AND traite=false
--    -> un mandat signé un vendredi soir pouvait être effacé avant que le CRM ne le récupère.
create or replace function public.purge_anciennes_signature_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.signature_requests
  where created_at < now() - interval '24 hours'
    and (
      statut is distinct from 'signe'        -- lien jamais signé : expire après 24 h (comportement inchangé)
      or traite = true                      -- signé ET déjà enregistré dans mandats_signes
    );
  return new;
end;
$function$;

-- 3. Les fonctions internes n'ont pas à être appelables via l'API
revoke execute on function public.purge_anciennes_signature_requests() from anon, authenticated, public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
