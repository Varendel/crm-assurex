-- 21.09.2026 : la variable « nom » se confondait avec la colonne clients.nom (erreur 42702,
-- « column reference nom is ambiguous ») : aucune fiche vierge ne pouvait être supprimée.
-- Correctif : la variable devient v_nom et la lecture du nom qualifie ses colonnes.
CREATE OR REPLACE FUNCTION public.supprimer_client_vierge(p_client uuid, p_balayer boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  liens   jsonb;
  traces  jsonb;
  reste   jsonb := '{}'::jsonb;
  cle     text;
  total   bigint;
  trace_n bigint;
  v_nom   text;
begin
  if est_client() then
    raise exception 'Réservé au cabinet.' using errcode = '42501';
  end if;

  if not exists (select 1 from clients where id = p_client) then
    return jsonb_build_object('ok', false, 'motif', 'Cette fiche n''existe plus.');
  end if;

  liens  := public.client_rattachements(p_client);
  traces := public.client_traces_techniques(p_client);

  for cle in select jsonb_object_keys(liens) loop
    total   := (liens ->> cle)::bigint;
    trace_n := coalesce((traces ->> cle)::bigint, 0);
    if total > trace_n then
      reste := reste || jsonb_build_object(cle, total - trace_n);
    end if;
  end loop;

  if reste <> '{}'::jsonb then
    return jsonb_build_object('ok', false, 'motif', 'La fiche n''est pas vierge.',
                              'rattachements', reste, 'traces', traces);
  end if;

  if traces <> '{}'::jsonb and not p_balayer then
    return jsonb_build_object('ok', false, 'motif', 'traces', 'traces', traces);
  end if;

  select coalesce(nullif(trim(coalesce(c.prenom,'') || ' ' || coalesce(c.nom,'')), ''), 'sans nom')
    into v_nom from clients c where c.id = p_client;

  if traces <> '{}'::jsonb then
    delete from signature_requests
     where client_id = p_client
       and signature_data is null
       and coalesce(traite, false) = false
       and coalesce(statut, '') <> 'signe';
    delete from acces_clients      where client_id = p_client and dernier_acces is null;
    delete from activites_client   where client_id = p_client;
    delete from notifications_clients where client_id = p_client;
  end if;

  delete from clients where id = p_client;
  return jsonb_build_object('ok', true, 'nom', v_nom, 'traces_balayees', traces);
end;
$function$;
