-- Presidential pre-count data model.
-- Keeps the previous congressional tables intact and isolates the new flow under pr_*.

create table if not exists public.pr_sync_state (
  key text primary key default 'presidential_live',
  current_avance_num integer,
  current_boletin_num integer,
  current_index_url text,
  current_national_url text,
  current_departments_url text,
  status text not null default 'idle',
  last_error text,
  fetched_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.pr_raw_payloads (
  id bigserial primary key,
  source_url text not null,
  payload_kind text not null,
  avance_num integer,
  payload jsonb not null,
  payload_hash text,
  fetched_at timestamptz not null default now(),
  unique (source_url, payload_hash)
);

create table if not exists public.pr_catalog_corporations (
  codigo text primary key,
  nombre text not null,
  sigla text not null default 'PR'
);

create table if not exists public.pr_catalog_circunscriptions (
  codigo text primary key,
  nombre text not null
);

create table if not exists public.pr_catalog_parties (
  codigo text primary key,
  nombre text not null,
  es_nacional boolean,
  color_hex text,
  source_raw text,
  updated_at timestamptz not null default now()
);

create table if not exists public.pr_catalog_candidates (
  id bigserial primary key,
  codigo_corporacion text not null default '001',
  codigo_circunscripcion text not null default '0',
  codigo_partido text not null references public.pr_catalog_parties(codigo),
  codigo_candidato text not null,
  nombre_completo text not null,
  cedula text,
  genero text,
  sorteo integer,
  source_raw text,
  updated_at timestamptz not null default now(),
  unique (codigo_corporacion, codigo_circunscripcion, codigo_partido, codigo_candidato)
);

create table if not exists public.pr_catalog_divipol (
  codigo_departamento text not null,
  codigo_municipio text not null,
  codigo_zona text not null,
  codigo_puesto text not null,
  nombre_departamento text,
  nombre_municipio text,
  nombre_puesto text,
  indicador_puesto text,
  potencial_hombres integer,
  potencial_mujeres integer,
  numero_mesas integer,
  codigo_comuna text,
  nombre_comuna text,
  source_raw text,
  updated_at timestamptz not null default now(),
  primary key (codigo_departamento, codigo_municipio, codigo_zona, codigo_puesto)
);

create table if not exists public.pr_boletins (
  id bigserial primary key,
  avance_num integer not null,
  boletin_num integer,
  tipo_boletin text not null,
  desc_corporacion text,
  codigo_departamento text,
  nombre_departamento text,
  codigo_municipio text,
  nombre_municipio text,
  codigo_comuna text,
  nombre_comuna text,
  fecha_boletin date,
  hora_boletin time,
  mesas_instaladas integer,
  mesas_informadas integer,
  porc_mesas_informadas numeric(6,2),
  potencial_sufragantes integer,
  total_sufragantes integer,
  porc_sufragantes numeric(6,2),
  votos_nulos integer,
  porc_votos_nulos numeric(6,2),
  votos_validos integer,
  porc_votos_validos numeric(6,2),
  votos_no_marcados integer,
  porc_votos_no_marcados numeric(6,2),
  source_url text,
  raw_header jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists public.pr_results (
  id bigserial primary key,
  boletin_id bigint not null references public.pr_boletins(id) on delete cascade,
  codigo_partido text not null,
  codigo_candidato text,
  votos integer not null default 0,
  porc_votos numeric(6,2),
  raw_result jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists pr_boletins_scope_unique_idx
  on public.pr_boletins (
    avance_num,
    tipo_boletin,
    coalesce(codigo_departamento, ''),
    coalesce(codigo_municipio, ''),
    coalesce(codigo_comuna, '')
  );

create unique index if not exists pr_results_scope_unique_idx
  on public.pr_results (
    boletin_id,
    codigo_partido,
    coalesce(codigo_candidato, '')
  );

create index if not exists pr_boletins_latest_idx
  on public.pr_boletins (avance_num desc, tipo_boletin, codigo_departamento, codigo_municipio);

create index if not exists pr_results_boletin_votes_idx
  on public.pr_results (boletin_id, votos desc);

create index if not exists pr_candidates_party_idx
  on public.pr_catalog_candidates (codigo_partido);

create or replace view public.pr_latest_boletins as
select b.*
from public.pr_boletins b
where b.avance_num = (select max(avance_num) from public.pr_boletins);

create or replace view public.pr_latest_national_results as
select
  b.avance_num,
  b.boletin_num,
  b.tipo_boletin,
  b.fecha_boletin,
  b.hora_boletin,
  b.mesas_instaladas,
  b.mesas_informadas,
  b.porc_mesas_informadas,
  b.potencial_sufragantes,
  b.total_sufragantes,
  b.votos_validos,
  b.votos_nulos,
  b.votos_no_marcados,
  r.codigo_partido,
  p.nombre as nombre_partido,
  p.color_hex,
  c.codigo_candidato,
  c.nombre_completo as nombre_candidato,
  c.sorteo,
  r.votos,
  r.porc_votos
from public.pr_latest_boletins b
join public.pr_results r on r.boletin_id = b.id
left join public.pr_catalog_parties p on p.codigo = r.codigo_partido
left join public.pr_catalog_candidates c on c.codigo_partido = r.codigo_partido
where b.tipo_boletin = 'NACIONAL'
order by r.votos desc, c.sorteo nulls last;

create or replace view public.pr_latest_department_results as
select
  b.avance_num,
  b.boletin_num,
  b.tipo_boletin,
  b.codigo_departamento,
  b.nombre_departamento,
  b.mesas_instaladas,
  b.mesas_informadas,
  b.porc_mesas_informadas,
  r.codigo_partido,
  p.nombre as nombre_partido,
  p.color_hex,
  c.codigo_candidato,
  c.nombre_completo as nombre_candidato,
  c.sorteo,
  r.votos,
  r.porc_votos
from public.pr_latest_boletins b
join public.pr_results r on r.boletin_id = b.id
left join public.pr_catalog_parties p on p.codigo = r.codigo_partido
left join public.pr_catalog_candidates c on c.codigo_partido = r.codigo_partido
where b.tipo_boletin = 'DEPARTAMENTAL';

create or replace view public.pr_latest_department_winners as
select distinct on (codigo_departamento)
  *
from public.pr_latest_department_results
order by codigo_departamento, votos desc;

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
  n.votos_nulos,
  n.votos_no_marcados
from public.pr_sync_state s
left join public.pr_boletins n
  on n.avance_num = s.current_avance_num
 and n.tipo_boletin = 'NACIONAL'
where s.key = 'presidential_live';

alter table public.pr_sync_state enable row level security;
alter table public.pr_catalog_corporations enable row level security;
alter table public.pr_catalog_circunscriptions enable row level security;
alter table public.pr_catalog_parties enable row level security;
alter table public.pr_catalog_candidates enable row level security;
alter table public.pr_catalog_divipol enable row level security;
alter table public.pr_boletins enable row level security;
alter table public.pr_results enable row level security;
alter table public.pr_raw_payloads enable row level security;

drop policy if exists "Public read presidential sync" on public.pr_sync_state;
create policy "Public read presidential sync"
on public.pr_sync_state for select
to anon, authenticated
using (true);

drop policy if exists "Public read presidential corporations" on public.pr_catalog_corporations;
create policy "Public read presidential corporations"
on public.pr_catalog_corporations for select
to anon, authenticated
using (true);

drop policy if exists "Public read presidential circunscriptions" on public.pr_catalog_circunscriptions;
create policy "Public read presidential circunscriptions"
on public.pr_catalog_circunscriptions for select
to anon, authenticated
using (true);

drop policy if exists "Public read presidential parties" on public.pr_catalog_parties;
create policy "Public read presidential parties"
on public.pr_catalog_parties for select
to anon, authenticated
using (true);

drop policy if exists "Public read presidential candidates" on public.pr_catalog_candidates;
create policy "Public read presidential candidates"
on public.pr_catalog_candidates for select
to anon, authenticated
using (true);

drop policy if exists "Public read presidential divipol" on public.pr_catalog_divipol;
create policy "Public read presidential divipol"
on public.pr_catalog_divipol for select
to anon, authenticated
using (true);

drop policy if exists "Public read presidential boletins" on public.pr_boletins;
create policy "Public read presidential boletins"
on public.pr_boletins for select
to anon, authenticated
using (true);

drop policy if exists "Public read presidential results" on public.pr_results;
create policy "Public read presidential results"
on public.pr_results for select
to anon, authenticated
using (true);

grant select on
  public.pr_sync_state,
  public.pr_catalog_corporations,
  public.pr_catalog_circunscriptions,
  public.pr_catalog_parties,
  public.pr_catalog_candidates,
  public.pr_catalog_divipol,
  public.pr_boletins,
  public.pr_results,
  public.pr_latest_boletins,
  public.pr_latest_national_results,
  public.pr_latest_department_results,
  public.pr_latest_department_winners,
  public.pr_live_status
to anon, authenticated;

insert into public.pr_catalog_corporations (codigo, nombre, sigla)
values ('001', 'PRESIDENCIA Y VICEPRESIDENCIA', 'PR')
on conflict (codigo) do update set nombre = excluded.nombre, sigla = excluded.sigla;

insert into public.pr_catalog_circunscriptions (codigo, nombre)
values ('0', 'NACIONAL')
on conflict (codigo) do update set nombre = excluded.nombre;

insert into public.pr_catalog_parties (codigo, nombre, es_nacional, color_hex)
values
  ('00009', 'PARTIDO CENTRO DEMOCRATICO', true, '#1A3A6B'),
  ('00015', 'PARTIDO POLITICO DIGNIDAD & COMPROMISO', true, '#4A9A5A'),
  ('00020', 'PARTIDO DEMOCRATA COLOMBIANO', true, '#C0252A'),
  ('00021', 'PARTIDO ECOLOGISTA COLOMBIANO', true, '#5A7A3A'),
  ('00022', 'PARTIDO POLITICO LA FUERZA', true, '#C06040'),
  ('00026', 'MOVIMIENTO POLITICO PACTO HISTORICO', true, '#6B2D8B'),
  ('01001', 'ROMPER EL SISTEMA', true, '#D4A017'),
  ('01002', 'SONDRA MACOLLINS, LA ABOGADA DE HIERRO', true, '#B02020'),
  ('01003', 'DEFENSORES DE LA PATRIA', true, '#1E4D8C'),
  ('01004', 'CON CLAUDIA IMPARABLES', true, '#2A7A4A'),
  ('01005', 'LA OPORTUNIDAD ES COLOMBIA', true, '#3A8A6A'),
  ('01006', 'CAICEDO', true, '#1E6A98'),
  ('03001', 'COALICION F.A.M.I.L.I.A', true, '#2C6FA8')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  es_nacional = excluded.es_nacional,
  color_hex = excluded.color_hex,
  updated_at = now();

insert into public.pr_catalog_candidates
  (codigo_partido, codigo_candidato, nombre_completo, cedula, genero, sorteo)
values
  ('00026', '001', 'IVAN CEPEDA CASTRO', '79262397', 'M', 1),
  ('01004', '002', 'CLAUDIA LOPEZ', '51992648', 'F', 3),
  ('01001', '003', 'RAUL SANTIAGO BOTERO JARAMILLO', '98567762', 'M', 4),
  ('01003', '004', 'ABELARDO DE LA ESPRIELLA', '11004242', 'M', 5),
  ('03001', '005', 'OSCAR MAURICIO LIZCANO ARANGO', '79960663', 'M', 6),
  ('00020', '006', 'MIGUEL URIBE LONDONO', '8319134', 'M', 7),
  ('01002', '007', 'SONDRA MACOLLINS GARVIN PINTO', '66921526', 'F', 8),
  ('00022', '008', 'ROY LEONARDO BARRERAS MONTEALEGRE', '79289575', 'M', 9),
  ('01006', '009', 'CARLOS EDUARDO CAICEDO OMAR', '85448338', 'M', 10),
  ('00021', '010', 'GUSTAVO MATAMOROS CAMACHO', '79140442', 'M', 11),
  ('00009', '011', 'PALOMA VALENCIA LASERNA', '25280205', 'F', 12),
  ('00015', '012', 'SERGIO FAJARDO VALDERRAMA', '70546658', 'M', 13),
  ('01005', '013', 'LUIS GILBERTO MURILLO URRUTIA', '11794488', 'M', 14)
on conflict (codigo_corporacion, codigo_circunscripcion, codigo_partido, codigo_candidato)
do update set
  nombre_completo = excluded.nombre_completo,
  cedula = excluded.cedula,
  genero = excluded.genero,
  sorteo = excluded.sorteo,
  updated_at = now();

insert into public.pr_sync_state (key, current_index_url, status, updated_at)
values (
  'presidential_live',
  'https://descargas.registraduria.gov.co/PR/0000/DEPRINDEX0000.json',
  'configured',
  now()
)
on conflict (key) do update set
  current_index_url = excluded.current_index_url,
  status = excluded.status,
  updated_at = now();
