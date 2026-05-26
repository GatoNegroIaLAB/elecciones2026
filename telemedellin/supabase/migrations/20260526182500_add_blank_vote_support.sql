alter table public.pr_boletins
  add column if not exists votos_blancos integer,
  add column if not exists porc_votos_blancos numeric(6,2);

drop view if exists public.pr_live_status;

create or replace view public.pr_live_status as
select
  s.key,
  s.current_avance_num,
  s.current_boletin_num,
  s.status,
  s.last_error,
  s.fetched_at,
  s.updated_at,
  n.mesas_instaladas,
  n.mesas_informadas,
  n.porc_mesas_informadas,
  n.votos_validos,
  n.votos_blancos,
  n.porc_votos_blancos,
  n.votos_nulos,
  n.votos_no_marcados
from public.pr_sync_state s
left join public.pr_boletins n
  on n.avance_num = s.current_avance_num
 and n.tipo_boletin = 'NACIONAL'
where s.key = 'presidential_live';

grant select on public.pr_live_status to anon, authenticated;
