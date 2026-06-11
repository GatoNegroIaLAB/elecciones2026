-- Load the official second-round presidential basics.

insert into public.pr_catalog_corporations (codigo, nombre, sigla)
values
  ('001', 'PRESIDENCIA Y VICEPRESIDENCIA', 'PR');

insert into public.pr_catalog_circunscriptions (codigo, nombre)
values
  ('0', 'NACIONAL');

insert into public.pr_catalog_parties (codigo, nombre, es_nacional, color_hex, source_raw, updated_at)
values
  (
    '00026',
    'MOVIMIENTO POLÍTICO PACTO HISTÓRICO',
    true,
    '#6B2D8B',
    '00026MOVIMIENTO POLÍTICO PACTO HISTÓRICO                                                                                                                                                                     N',
    now()
  ),
  (
    '01003',
    'DEFENSORES DE LA PATRIA',
    true,
    '#1E4D8C',
    '01003DEFENSORES DE LA PATRIA                                                                                                                                                                                 N',
    now()
  );

insert into public.pr_catalog_candidates (
  codigo_corporacion,
  codigo_circunscripcion,
  codigo_partido,
  codigo_candidato,
  nombre_completo,
  cedula,
  genero,
  sorteo,
  source_raw,
  updated_at
)
values
  (
    '001',
    '0',
    '00026',
    '001',
    'IVÁN CEPEDA CASTRO',
    '79262397',
    'M',
    1,
    '00100000000000260011IVÁN                                              CEPEDA CASTRO                                     79262397       M01',
    now()
  ),
  (
    '001',
    '0',
    '01003',
    '002',
    'ABELARDO DE LA ESPRIELLA',
    '11004242',
    'M',
    2,
    '00100000000010030021ABELARDO                                          DE LA ESPRIELLA                                   11004242       M02',
    now()
  );
