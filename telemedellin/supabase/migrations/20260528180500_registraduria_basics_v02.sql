-- Registraduria presidential basics V02.
-- Full DIVIPOL V02 is versioned in data/registraduria-basics/v02 and imported with
-- npm run import:registraduria-basics.

insert into public.pr_catalog_corporations (codigo, nombre, sigla)
values ('001', 'PRESIDENCIA Y VICEPRESIDENCIA', 'PR')
on conflict (codigo) do update set nombre = excluded.nombre, sigla = excluded.sigla;

insert into public.pr_catalog_circunscriptions (codigo, nombre)
values ('0', 'NACIONAL')
on conflict (codigo) do update set nombre = excluded.nombre;

insert into public.pr_catalog_parties (codigo, nombre, es_nacional, source_raw, updated_at)
values
  ('00009', 'PARTIDO CENTRO DEMOCRÁTICO', true, '00009PARTIDO CENTRO DEMOCRÁTICO N', now()),
  ('00015', 'PARTIDO POLÍTICO DIGNIDAD & COMPROMISO', true, '00015PARTIDO POLÍTICO DIGNIDAD & COMPROMISO N', now()),
  ('00020', 'PARTIDO DEMÓCRATA COLOMBIANO', true, '00020PARTIDO DEMÓCRATA COLOMBIANO N', now()),
  ('00021', 'PARTIDO ECOLOGISTA COLOMBIANO', true, '00021PARTIDO ECOLOGISTA COLOMBIANO N', now()),
  ('00022', 'PARTIDO POLÍTICO LA FUERZA', true, '00022PARTIDO POLÍTICO LA FUERZA N', now()),
  ('00026', 'MOVIMIENTO POLÍTICO PACTO HISTÓRICO', true, '00026MOVIMIENTO POLÍTICO PACTO HISTÓRICO N', now()),
  ('01001', 'ROMPER EL SISTEMA', true, '01001ROMPER EL SISTEMA N', now()),
  ('01002', 'SONDRA MACOLLINS, LA ABOGADA DE HIERRO', true, '01002SONDRA MACOLLINS, LA ABOGADA DE HIERRO N', now()),
  ('01003', 'DEFENSORES DE LA PATRIA', true, '01003DEFENSORES DE LA PATRIA N', now()),
  ('01004', 'CON CLAUDIA IMPARABLES', true, '01004CON CLAUDIA IMPARABLES N', now()),
  ('01005', 'LA OPORTUNIDAD ES COLOMBIA', true, '01005LA OPORTUNIDAD ES COLOMBIA N', now()),
  ('01006', 'CAICEDO', true, '01006CAICEDO N', now()),
  ('03001', 'COALICIÓN F.A.M.I.L.I.A', true, '03001COALICIÓN F.A.M.I.L.I.A N', now())
on conflict (codigo) do update set
  nombre = excluded.nombre,
  es_nacional = excluded.es_nacional,
  source_raw = excluded.source_raw,
  updated_at = excluded.updated_at;

insert into public.pr_catalog_candidates
  (codigo_corporacion, codigo_circunscripcion, codigo_partido, codigo_candidato, nombre_completo, cedula, genero, sorteo, source_raw, updated_at)
values
  ('001', '0', '00026', '001', 'IVÁN CEPEDA CASTRO', '79262397', 'M', 1, '00100000000000260011IVÁN CEPEDA CASTRO 79262397 M01', now()),
  ('001', '0', '01004', '002', 'CLAUDIA LÓPEZ', '51992648', 'F', 3, '00100000000010040021CLAUDIA LÓPEZ 51992648 F03', now()),
  ('001', '0', '01001', '003', 'RAÚL SANTIAGO BOTERO JARAMILLO', '98567762', 'M', 4, '00100000000010010031RAÚL SANTIAGO BOTERO JARAMILLO 98567762 M04', now()),
  ('001', '0', '01003', '004', 'ABELARDO DE LA ESPRIELLA', '11004242', 'M', 5, '00100000000010030041ABELARDO DE LA ESPRIELLA 11004242 M05', now()),
  ('001', '0', '03001', '005', 'ÓSCAR MAURICIO LIZCANO ARANGO', '79960663', 'M', 6, '00100000000030010051ÓSCAR MAURICIO LIZCANO ARANGO 79960663 M06', now()),
  ('001', '0', '00020', '006', 'MIGUEL URIBE LONDOÑO', '8319134', 'M', 7, '00100000000000200061MIGUEL URIBE LONDOÑO 8319134 M07', now()),
  ('001', '0', '01002', '007', 'SONDRA MACOLLINS GARVIN PINTO', '66921526', 'F', 8, '00100000000010020071SONDRA MACOLLINS GARVIN PINTO 66921526 F08', now()),
  ('001', '0', '00022', '008', 'ROY LEONARDO BARRERAS MONTEALEGRE', '79289575', 'M', 9, '00100000000000220081ROY LEONARDO BARRERAS MONTEALEGRE 79289575 M09', now()),
  ('001', '0', '01006', '009', 'CARLOS EDUARDO CAICEDO OMAR', '85448338', 'M', 10, '00100000000010060091CARLOS EDUARDO CAICEDO OMAR 85448338 M10', now()),
  ('001', '0', '00021', '010', 'GUSTAVO MATAMOROS CAMACHO', '79140442', 'M', 11, '00100000000000210101GUSTAVO MATAMOROS CAMACHO 79140442 M11', now()),
  ('001', '0', '00009', '011', 'PALOMA VALENCIA LASERNA', '25280205', 'F', 12, '00100000000000090111PALOMA VALENCIA LASERNA 25280205 F12', now()),
  ('001', '0', '00015', '012', 'SERGIO FAJARDO VALDERRAMA', '70546658', 'M', 13, '00100000000000150121SERGIO FAJARDO VALDERRAMA 70546658 M13', now()),
  ('001', '0', '01005', '013', 'LUIS GILBERTO MURILLO URRUTIA', '11794488', 'M', 14, '00100000000010050131LUIS GILBERTO MURILLO URRUTIA 11794488 M14', now())
on conflict (codigo_corporacion, codigo_circunscripcion, codigo_partido, codigo_candidato)
do update set
  nombre_completo = excluded.nombre_completo,
  cedula = excluded.cedula,
  genero = excluded.genero,
  sorteo = excluded.sorteo,
  source_raw = excluded.source_raw,
  updated_at = excluded.updated_at;
