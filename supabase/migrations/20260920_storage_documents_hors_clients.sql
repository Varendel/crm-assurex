-- Sécurité du bucket « documents » (20.09.2026) : depuis l'ouverture des comptes clients, toute
-- personne authentifiée — donc n'importe quel client — pouvait lire, remplacer et supprimer
-- n'importe quel fichier du bucket. On réserve désormais l'accès direct au personnel Assurex ;
-- les clients n'obtiennent leurs propres documents que par la fonction « document-client », qui
-- vérifie que le contrat leur appartient et renvoie un lien signé de courte durée.
drop policy if exists documents_authenticated_select on storage.objects;
drop policy if exists documents_authenticated_insert on storage.objects;
drop policy if exists documents_authenticated_update on storage.objects;
drop policy if exists documents_authenticated_delete on storage.objects;

create policy documents_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and not public.est_client());
create policy documents_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and not public.est_client());
create policy documents_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and not public.est_client())
  with check (bucket_id = 'documents' and not public.est_client());
create policy documents_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and not public.est_client());
