create or replace function public.pr_acquire_ingest_lock(
  p_key text,
  p_token text,
  p_started_at timestamptz,
  p_expires_at timestamptz
)
returns table (
  acquired boolean,
  current_lock_token text,
  current_lock_expires_at timestamptz
)
language plpgsql
set search_path = public
as $$
begin
  update public.pr_sync_state
     set status = 'fetching',
         last_error = null,
         updated_at = p_started_at,
         lock_token = p_token,
         lock_acquired_at = p_started_at,
         lock_expires_at = p_expires_at
   where key = p_key
     and (
       lock_token is null
       or lock_expires_at is null
       or lock_expires_at <= p_started_at
       or lock_token = p_token
     );

  if found then
    return query
      select true, p_token, p_expires_at;
    return;
  end if;

  return query
    select false, s.lock_token, s.lock_expires_at
      from public.pr_sync_state s
     where s.key = p_key;
end;
$$;

create or replace function public.pr_upsert_boletin_with_results(
  p_boletin jsonb,
  p_results jsonb default '[]'::jsonb
)
returns table (
  boletin_id bigint,
  result_count integer,
  avance_num integer,
  boletin_num integer
)
language plpgsql
set search_path = public
as $$
declare
  v_input public.pr_boletins;
  v_boletin_id bigint;
  v_result_count integer := 0;
begin
  v_input := jsonb_populate_record(null::public.pr_boletins, p_boletin);

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(
        '|',
        coalesce(v_input.avance_num::text, ''),
        coalesce(v_input.tipo_boletin, ''),
        coalesce(v_input.codigo_departamento, ''),
        coalesce(v_input.codigo_municipio, ''),
        coalesce(v_input.codigo_comuna, '')
      ),
      0
    )
  );

  select b.id
    into v_boletin_id
    from public.pr_boletins b
   where b.avance_num = v_input.avance_num
     and b.tipo_boletin = v_input.tipo_boletin
     and b.codigo_departamento is not distinct from v_input.codigo_departamento
     and b.codigo_municipio is not distinct from v_input.codigo_municipio
     and b.codigo_comuna is not distinct from v_input.codigo_comuna
   for update;

  if found then
    update public.pr_boletins
       set boletin_num = v_input.boletin_num,
           desc_corporacion = v_input.desc_corporacion,
           nombre_departamento = v_input.nombre_departamento,
           nombre_municipio = v_input.nombre_municipio,
           nombre_comuna = v_input.nombre_comuna,
           fecha_boletin = v_input.fecha_boletin,
           hora_boletin = v_input.hora_boletin,
           mesas_instaladas = v_input.mesas_instaladas,
           mesas_informadas = v_input.mesas_informadas,
           porc_mesas_informadas = v_input.porc_mesas_informadas,
           potencial_sufragantes = v_input.potencial_sufragantes,
           total_sufragantes = v_input.total_sufragantes,
           porc_sufragantes = v_input.porc_sufragantes,
           votos_nulos = v_input.votos_nulos,
           porc_votos_nulos = v_input.porc_votos_nulos,
           votos_validos = v_input.votos_validos,
           porc_votos_validos = v_input.porc_votos_validos,
           votos_blancos = v_input.votos_blancos,
           porc_votos_blancos = v_input.porc_votos_blancos,
           votos_no_marcados = v_input.votos_no_marcados,
           porc_votos_no_marcados = v_input.porc_votos_no_marcados,
           source_url = v_input.source_url,
           raw_header = coalesce(v_input.raw_header, '{}'::jsonb),
           fetched_at = now()
     where id = v_boletin_id;
  else
    insert into public.pr_boletins (
      avance_num,
      boletin_num,
      tipo_boletin,
      desc_corporacion,
      codigo_departamento,
      nombre_departamento,
      codigo_municipio,
      nombre_municipio,
      codigo_comuna,
      nombre_comuna,
      fecha_boletin,
      hora_boletin,
      mesas_instaladas,
      mesas_informadas,
      porc_mesas_informadas,
      potencial_sufragantes,
      total_sufragantes,
      porc_sufragantes,
      votos_nulos,
      porc_votos_nulos,
      votos_validos,
      porc_votos_validos,
      votos_blancos,
      porc_votos_blancos,
      votos_no_marcados,
      porc_votos_no_marcados,
      source_url,
      raw_header
    ) values (
      v_input.avance_num,
      v_input.boletin_num,
      v_input.tipo_boletin,
      v_input.desc_corporacion,
      v_input.codigo_departamento,
      v_input.nombre_departamento,
      v_input.codigo_municipio,
      v_input.nombre_municipio,
      v_input.codigo_comuna,
      v_input.nombre_comuna,
      v_input.fecha_boletin,
      v_input.hora_boletin,
      v_input.mesas_instaladas,
      v_input.mesas_informadas,
      v_input.porc_mesas_informadas,
      v_input.potencial_sufragantes,
      v_input.total_sufragantes,
      v_input.porc_sufragantes,
      v_input.votos_nulos,
      v_input.porc_votos_nulos,
      v_input.votos_validos,
      v_input.porc_votos_validos,
      v_input.votos_blancos,
      v_input.porc_votos_blancos,
      v_input.votos_no_marcados,
      v_input.porc_votos_no_marcados,
      v_input.source_url,
      coalesce(v_input.raw_header, '{}'::jsonb)
    )
    returning id into v_boletin_id;
  end if;

  delete from public.pr_results pr
   where pr.boletin_id = v_boletin_id;

  insert into public.pr_results (
    boletin_id,
    codigo_partido,
    codigo_candidato,
    votos,
    porc_votos,
    raw_result,
    updated_at
  )
  select
    v_boletin_id,
    trim(r.codigo_partido),
    nullif(trim(coalesce(r.codigo_candidato, '')), ''),
    coalesce(r.votos, 0),
    r.porc_votos,
    coalesce(r.raw_result, '{}'::jsonb),
    now()
  from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as r(
    codigo_partido text,
    codigo_candidato text,
    votos integer,
    porc_votos numeric,
    raw_result jsonb
  )
  where trim(coalesce(r.codigo_partido, '')) <> '';

  get diagnostics v_result_count = row_count;

  return query
    select v_boletin_id, v_result_count, v_input.avance_num, v_input.boletin_num;
end;
$$;
