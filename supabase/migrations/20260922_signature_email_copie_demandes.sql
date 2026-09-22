-- ═══ SIGNATURE DES E-MAILS DU CRM + COPIE DES DEMANDES D'OFFRE (22.09.2026) ═══════════════════════
-- « Est-ce que REX peut ajouter la signature aux courriels sortants ? » — « Il faut que je sois en
-- copie systématique des demandes d'offre. »
-- L'API Outlook (sendMail) n'ajoute pas la signature Outlook : le CRM la garde par utilisateur
-- (reprise telle quelle d'un e-mail envoyé depuis Outlook, images intégrées rangées dans le
-- stockage « documents » sous signatures/<agent>/) et l'ajoute à chaque envoi.
-- copie_demandes_offre : l'agent est mis en copie de toute demande d'offre envoyée depuis le CRM,
-- quel que soit l'expéditeur. Sur agents (lisible par toute l'équipe, RH comprise), pour que la
-- copie parte aussi quand c'est l'équipe qui envoie.

alter table public.agents add column if not exists signature_email_html text;
alter table public.agents add column if not exists signature_email_images jsonb not null default '[]'::jsonb;
alter table public.agents add column if not exists signature_email_actif boolean not null default true;
alter table public.agents add column if not exists signature_email_maj_le timestamptz;
alter table public.agents add column if not exists copie_demandes_offre boolean not null default false;

update public.agents set copie_demandes_offre = true where lower(email) = 'jo@cofidex.ch';
