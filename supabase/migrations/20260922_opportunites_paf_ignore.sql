-- ═══ PARCOURS DE L'AFFAIRE : POUVOIR PASSER UNE ÉTAPE (22.09.2026) ══════════════════════════════
-- « Ajoute un bouton passer l'étape pour les opp gagnées : certaines affaires sont déjà saisies
-- avant la fonction. » Le parcours (js/90) réclamait indéfiniment des étapes faites ailleurs.
-- paf_ignore : à la dernière étape, les points restants sont déclarés déjà faits ; le fil de
-- l'affaire garde la trace du saut.
alter table public.opportunites add column if not exists paf_ignore boolean not null default false;
comment on column public.opportunites.paf_ignore is 'Parcours de l''affaire (js/90) : points restants déclarés déjà faits — affaires saisies avant le parcours.';
