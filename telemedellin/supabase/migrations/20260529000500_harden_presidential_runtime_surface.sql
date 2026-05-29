-- Tighten the presidential runtime surface to only what the landing needs.
-- This is intentionally non-destructive: it does not drop tables or data.
-- The public web should read through Vercel APIs, not directly from base tables.

-- Remove public read policies from base tables and non-operational catalogs.
drop policy if exists "Public read presidential sync" on public.pr_sync_state;
drop policy if exists "Public read presidential corporations" on public.pr_catalog_corporations;
drop policy if exists "Public read presidential circunscriptions" on public.pr_catalog_circunscriptions;
drop policy if exists "Public read presidential parties" on public.pr_catalog_parties;
drop policy if exists "Public read presidential candidates" on public.pr_catalog_candidates;
drop policy if exists "Public read presidential divipol" on public.pr_catalog_divipol;
drop policy if exists "Public read presidential boletins" on public.pr_boletins;
drop policy if exists "Public read presidential results" on public.pr_results;

-- Remove direct public grants from base tables and internal-only views.
revoke select on public.pr_sync_state from anon, authenticated;
revoke select on public.pr_catalog_corporations from anon, authenticated;
revoke select on public.pr_catalog_circunscriptions from anon, authenticated;
revoke select on public.pr_catalog_parties from anon, authenticated;
revoke select on public.pr_catalog_candidates from anon, authenticated;
revoke select on public.pr_catalog_divipol from anon, authenticated;
revoke select on public.pr_boletins from anon, authenticated;
revoke select on public.pr_results from anon, authenticated;
revoke select on public.pr_latest_boletins from anon, authenticated;
revoke select on public.pr_latest_department_results from anon, authenticated;

-- Keep only the published presidential runtime views readable.
grant select on public.pr_latest_national_results to anon, authenticated;
grant select on public.pr_latest_department_winners to anon, authenticated;
grant select on public.pr_live_status to anon, authenticated;

comment on table public.pr_catalog_corporations is
  'Fixed presidential catalog. Retained for referential clarity, not part of the public runtime surface.';

comment on table public.pr_catalog_circunscriptions is
  'Fixed presidential catalog. Retained for referential clarity, not part of the public runtime surface.';

comment on table public.pr_catalog_divipol is
  'Optional granular catalog for puestos/zonas/comunas. Retained for offline or future use, not required by the presidential landing runtime.';
