-- Reset the presidential runtime from first round to second round.
-- This intentionally drops previously ingested pre-count data and clears the
-- first-round catalogs so the system can be reloaded with the official
-- second-round basics.

truncate table public.pr_results restart identity;
truncate table public.pr_boletins restart identity cascade;
truncate table public.pr_raw_payloads restart identity;

delete from public.pr_catalog_candidates;
delete from public.pr_catalog_parties;
delete from public.pr_catalog_circunscriptions;
delete from public.pr_catalog_corporations;
delete from public.pr_catalog_divipol;

insert into public.pr_sync_state (
  key,
  current_avance_num,
  current_boletin_num,
  current_index_url,
  current_national_url,
  current_departments_url,
  status,
  last_error,
  fetched_at,
  updated_at,
  lock_token,
  lock_acquired_at,
  lock_expires_at
)
values (
  'presidential_live',
  null,
  null,
  null,
  null,
  null,
  'idle',
  null,
  null,
  now(),
  null,
  null,
  null
)
on conflict (key) do update
set
  current_avance_num = excluded.current_avance_num,
  current_boletin_num = excluded.current_boletin_num,
  current_index_url = excluded.current_index_url,
  current_national_url = excluded.current_national_url,
  current_departments_url = excluded.current_departments_url,
  status = excluded.status,
  last_error = excluded.last_error,
  fetched_at = excluded.fetched_at,
  updated_at = excluded.updated_at,
  lock_token = excluded.lock_token,
  lock_acquired_at = excluded.lock_acquired_at,
  lock_expires_at = excluded.lock_expires_at;
