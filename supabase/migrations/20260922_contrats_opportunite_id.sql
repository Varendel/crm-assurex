-- Lien retour contrat → opportunité (22.09.2026)
-- opportunites.contrat_id ne peut porter qu'UN contrat, alors qu'une affaire gagnée en produit
-- souvent plusieurs (conversion multi-produits, js/134). Sans lien retour, la fiche d'une affaire
-- convertie ne menait à aucun contrat. On ajoute le lien dans l'autre sens et on reprend l'existant.
alter table contrats add column if not exists opportunite_id uuid references opportunites(id) on delete set null;
create index if not exists idx_contrats_opportunite on contrats(opportunite_id);
update contrats c set opportunite_id = o.id from opportunites o where o.contrat_id = c.id and c.opportunite_id is null;
