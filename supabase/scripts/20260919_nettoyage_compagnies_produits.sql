-- Nettoyage des données du 19.09.2026 (validé par Jonathan) — à exécuter UNE fois dans
-- Supabase › SQL Editor. Uniquement des UPDATE : aucune ligne n'est supprimée.
--   1. Noms de compagnies unifiés (= noms canoniques de normaliserCompagnie, js/09)
--   2. Libellés de produits en double -> libellé du catalogue
--   3. Camille Sauthier : 9 contrats créés par erreur le 17.09 par l'ancienne feuille de
--      résiliation -> statut « annulé » (réversible ; suppression définitive possible ensuite
--      depuis la fiche contrat)
-- Céline Demir : NON concernée (deux polices différentes).

begin;

create temp table map_cie(ancien text, nouveau text) on commit drop;
insert into map_cie values
 ('CSS Assurance', 'CSS'),
 ('Helvetia Compagnie Suisse d''Assurances SA', 'Helvetia'),
 ('Balose', 'Helvetia'),
 ('Vaudoise Générale', 'La Vaudoise'),
 ('Vaudoise', 'La Vaudoise'),
 ('mobilière', 'La Mobilière'),
 ('swisslife', 'Swiss Life'),
 ('Orion Assurance de protection Juridique SA', 'Orion'),
 ('Orion Assurance de Protection Juridique SA', 'Orion'),
 ('HOTELA Fonds de prévoyance', 'HOTELA');
update contrats k            set compagnie = m.nouveau from map_cie m where k.compagnie = m.ancien;
update commissions_attente k set compagnie = m.nouveau from map_cie m where k.compagnie = m.ancien;
update opportunites k        set compagnie = m.nouveau from map_cie m where k.compagnie = m.ancien;
update bordereaux k          set compagnie = m.nouveau from map_cie m where k.compagnie = m.ancien;

create temp table map_prod(ancien text, nouveau text) on commit drop;
insert into map_prod values
 ('RC véhicule à moteur (obligatoire)', 'RC véhicule (obligatoire)'),
 ('Protection Juridique (Privé)', 'Protection juridique privée'),
 ('Perte de Gain (Maladie/Accident)', 'Perte de gain maladie/accident LCA');
update contrats k            set produit = m.nouveau from map_prod m where k.produit = m.ancien;
update commissions_attente k set produit = m.nouveau from map_prod m where k.produit = m.ancien;

update contrats set statut = 'annulé'
where statut = 'actif' and id in (
  '2d1d7d86-9f7d-45ca-ac67-d36729bb0111','45707ad0-9375-48cb-a189-6e5627d8acc4',
  '7d7be719-895b-4856-9041-d057b1b591e1','376833ff-e8ab-4bc4-a842-c53d00fdebe9',
  'cf6e5b10-bfeb-4a53-9e88-c19c6458ecdc','1b34d1d7-6a83-4300-862a-833d796f9a22',
  '75a8e1a9-c33b-419c-a8f3-bca24e22f1c5','fd778de7-4b09-499e-a7be-25fa71f9ac39',
  '304a816c-8515-43d8-b105-5dad683fc373');

insert into audit_log(user_email, action, table_name, detail) values
 ('jo@cofidex.ch', 'nettoyage_donnees', 'contrats',
  '19.09.2026 : noms de compagnies unifiés (CSS, Helvetia, La Vaudoise, La Mobilière, Swiss Life, Orion, HOTELA), 3 libellés produits unifiés, 9 contrats Sauthier (ancienne feuille de résiliation) annulés');

commit;

-- Vérification : doit lister chaque compagnie une seule fois
select compagnie, count(*) from contrats group by 1 order by 1;
