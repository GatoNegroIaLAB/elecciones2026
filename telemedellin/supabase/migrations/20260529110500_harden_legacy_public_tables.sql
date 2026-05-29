-- Harden legacy public tables that are not part of the presidential landing runtime.
-- These tables previously exposed broad privileges to anon/authenticated.
-- We enable RLS and revoke direct table privileges, preserving only privileged access.

alter table public.cat_corporaciones enable row level security;
alter table public.cat_circunscripciones enable row level security;
alter table public.cat_partidos enable row level security;
alter table public.cat_candidatos enable row level security;
alter table public.cat_divipol enable row level security;
alter table public.control_avances enable row level security;
alter table public.avances_resultados enable row level security;
alter table public.historicos_2022 enable row level security;
alter table public.palabras_nube enable row level security;
alter table public.config_nube enable row level security;

revoke all privileges on table public.cat_corporaciones from anon, authenticated;
revoke all privileges on table public.cat_circunscripciones from anon, authenticated;
revoke all privileges on table public.cat_partidos from anon, authenticated;
revoke all privileges on table public.cat_candidatos from anon, authenticated;
revoke all privileges on table public.cat_divipol from anon, authenticated;
revoke all privileges on table public.control_avances from anon, authenticated;
revoke all privileges on table public.avances_resultados from anon, authenticated;
revoke all privileges on table public.historicos_2022 from anon, authenticated;
revoke all privileges on table public.palabras_nube from anon, authenticated;
revoke all privileges on table public.config_nube from anon, authenticated;

comment on table public.cat_corporaciones is
  'Legacy congress catalog. Public direct access disabled; retained only for privileged or historical use.';

comment on table public.cat_circunscripciones is
  'Legacy congress catalog. Public direct access disabled; retained only for privileged or historical use.';

comment on table public.cat_partidos is
  'Legacy congress catalog. Public direct access disabled; retained only for privileged or historical use.';

comment on table public.cat_candidatos is
  'Legacy congress catalog. Public direct access disabled; retained only for privileged or historical use.';

comment on table public.cat_divipol is
  'Legacy congress catalog. Public direct access disabled; retained only for privileged or historical use.';

comment on table public.control_avances is
  'Legacy congress control table. Public direct access disabled; retained only for privileged or historical use.';

comment on table public.avances_resultados is
  'Legacy congress results table. Public direct access disabled; retained only for privileged or historical use.';

comment on table public.historicos_2022 is
  'Legacy historical table. Public direct access disabled; retained only for privileged or historical use.';

comment on table public.palabras_nube is
  'Legacy social keyword table. Public direct access disabled; updates should go through privileged server-side flows only.';

comment on table public.config_nube is
  'Legacy social keyword config. Public direct access disabled; retained only for privileged or historical use.';
