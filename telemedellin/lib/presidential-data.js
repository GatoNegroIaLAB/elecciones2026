import crypto from 'crypto'
import https from 'https'
import zlib from 'zlib'
import { createClient } from '@supabase/supabase-js'

export const PRESIDENTIAL_INDEX_BASE_URL = 'https://descargas.registraduria.gov.co/PR/'
export const PRESIDENTIAL_INDEX_URL = presidentialIndexUrlForAvance(0)
export const DEFAULT_INDEX_PROBE_LIMIT = 500

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase service configuration')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

export function toNumber(value) {
  const n = Number(String(value ?? '0').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function toInteger(value) {
  const n = Number.parseInt(String(value ?? '0'), 10)
  return Number.isFinite(n) ? n : 0
}

function cleanText(value) {
  const text = String(value ?? '').trim()
  return text && text !== 'NO APLICA' ? text : null
}

function payloadHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function resolveRegistraduriaUrl(pathOrUrl, baseUrl = PRESIDENTIAL_INDEX_URL) {
  return new URL(pathOrUrl, baseUrl).toString()
}

export function formatAvanceNum(value) {
  return String(toInteger(value)).padStart(4, '0')
}

export function presidentialIndexUrlForAvance(value) {
  const avance = formatAvanceNum(value)
  return `${PRESIDENTIAL_INDEX_BASE_URL}${avance}/DEPRINDEX${avance}.json`
}

export async function fetchRegistraduriaJson(url) {
  const user = process.env.REGISTRADURIA_USER
  const pass = process.env.REGISTRADURIA_PASS

  if (!user || !pass) {
    throw new Error('Missing Registraduria credentials')
  }

  const auth = Buffer.from(`${user}:${pass}`).toString('base64')

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        Authorization: `Basic ${auth}`,
        'Accept-Encoding': 'gzip',
        'User-Agent': 'Telemedellin-Elecciones2026/1.0',
      },
    }

    https.get(url, options, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, options, handleResponse).on('error', reject)
        return
      }
      handleResponse(response)
    }).on('error', reject)

    function handleResponse(response) {
      if (response.statusCode !== 200) {
        const error = new Error(`Registraduria HTTP ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.url = url
        reject(error)
        return
      }

      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        zlib.gunzip(buffer, (err, decompressed) => {
          const raw = err ? buffer : decompressed
          try {
            resolve(JSON.parse(raw.toString('utf8')))
          } catch (e) {
            reject(new Error(`Registraduria JSON parse error: ${e.message}`))
          }
        })
      })
      response.on('error', reject)
    }
  })
}

async function fetchRegistraduriaJsonIfExists(url) {
  try {
    return await fetchRegistraduriaJson(url)
  } catch (error) {
    if (error.statusCode === 404) return null
    throw error
  }
}

export async function resolveLatestPresidentialIndex(supabase, options = {}) {
  const probeLimit = toInteger(options.probeLimit || process.env.REGISTRADURIA_INDEX_PROBE_LIMIT || DEFAULT_INDEX_PROBE_LIMIT)
  const { data, error } = await supabase
    .from('pr_sync_state')
    .select('current_avance_num')
    .eq('key', 'presidential_live')
    .maybeSingle()

  if (error) throw error

  const startAvance = Math.max(0, toInteger(data?.current_avance_num))
  let latest = null
  let currentAvance = startAvance

  while (currentAvance <= probeLimit) {
    const url = presidentialIndexUrlForAvance(currentAvance)
    const payload = await fetchRegistraduriaJsonIfExists(url)

    if (!payload) {
      if (latest) break

      currentAvance += 1
      continue
    }

    const payloadAvance = toInteger(payload?.Avance?.Numero ?? currentAvance)
    latest = {
      avanceNum: Math.max(currentAvance, payloadAvance),
      url,
      payload,
    }

    currentAvance = latest.avanceNum + 1
  }

  if (latest) return latest

  const fallbackUrl = PRESIDENTIAL_INDEX_URL
  return {
    avanceNum: 0,
    url: fallbackUrl,
    payload: await fetchRegistraduriaJson(fallbackUrl),
  }
}

export function getBoletins(payload) {
  if (!payload?.Boletin) return []
  return Array.isArray(payload.Boletin) ? payload.Boletin : [payload.Boletin]
}

export function getPartyRows(boletin) {
  const circunscriptions = boletin?.Detalle_Circunscripcion || []
  return circunscriptions.flatMap(circ => circ?.Detalle_Partido || [])
}

export function getPartyTotalRows(boletin) {
  const circunscriptions = boletin?.Detalle_Circunscripcion || []
  return circunscriptions.flatMap(circ => circ?.Detalle_Partidos_Totales || [])
}

function getBlankVoteTotal(boletin) {
  const totalRows = getPartyTotalRows(boletin)
  return totalRows.find(row => (
    String(row?.Partido ?? '').trim() === '00996' ||
    String(row?.Descripcion ?? '').toUpperCase().includes('VOTOS EN BLANCO')
  )) || null
}

export function mapBoletinHeader(boletin, sourceUrl) {
  const blankVote = getBlankVoteTotal(boletin)
  return {
    avance_num: toInteger(boletin?.Numero),
    boletin_num: toInteger(boletin?.Boletin),
    tipo_boletin: cleanText(boletin?.Tipo_Boletin) || 'NO_DEFINIDO',
    desc_corporacion: cleanText(boletin?.Desc_Corporacion),
    codigo_departamento: cleanText(boletin?.Departamento),
    nombre_departamento: cleanText(boletin?.Desc_Departamento),
    codigo_municipio: cleanText(boletin?.Municipio),
    nombre_municipio: cleanText(boletin?.Desc_Municipio),
    codigo_comuna: cleanText(boletin?.Comuna),
    nombre_comuna: cleanText(boletin?.Desc_Comuna),
    fecha_boletin: boletin?.Anio && boletin?.Mes && boletin?.Dia
      ? `${boletin.Anio}-${String(boletin.Mes).padStart(2, '0')}-${String(boletin.Dia).padStart(2, '0')}`
      : null,
    hora_boletin: boletin?.Hora && boletin?.Minuto
      ? `${String(boletin.Hora).padStart(2, '0')}:${String(boletin.Minuto).padStart(2, '0')}:00`
      : null,
    mesas_instaladas: toInteger(boletin?.Mesas_Instaladas),
    mesas_informadas: toInteger(boletin?.Mesas_Informadas),
    porc_mesas_informadas: toNumber(boletin?.Porc_Mesas_Informadas),
    potencial_sufragantes: toInteger(boletin?.Potencial_Sufragantes),
    total_sufragantes: toInteger(boletin?.Total_Sufragantes),
    porc_sufragantes: toNumber(boletin?.Porc_Sufragantes),
    votos_nulos: toInteger(boletin?.Votos_Nulos),
    porc_votos_nulos: toNumber(boletin?.Porc_Votos_Nulos),
    votos_validos: toInteger(boletin?.Votos_Validos),
    porc_votos_validos: toNumber(boletin?.Porc_Votos_Validos),
    votos_blancos: toInteger(blankVote?.Votos ?? boletin?.Votos_Blancos ?? boletin?.Votos_En_Blanco),
    porc_votos_blancos: toNumber(blankVote?.Porc ?? blankVote?.Porc_Votos ?? boletin?.Porc_Votos_Blancos ?? boletin?.Porc_Votos_En_Blanco),
    votos_no_marcados: toInteger(boletin?.Votos_No_Marcados),
    porc_votos_no_marcados: toNumber(boletin?.Porc_Votos_No_Marcados),
    source_url: sourceUrl,
    raw_header: boletin,
  }
}

export function mapResultRows(boletinId, boletin) {
  return getPartyRows(boletin).map(row => ({
    boletin_id: boletinId,
    codigo_partido: String(row.Partido ?? '').trim(),
    codigo_candidato: row.Candidato ? String(row.Candidato).trim() : null,
    votos: toInteger(row.Votos),
    porc_votos: toNumber(row.Porc_Votos ?? row.Porc),
    raw_result: row,
  })).filter(row => row.codigo_partido)
}

export async function storeRawPayload(supabase, sourceUrl, payloadKind, avanceNum, payload) {
  const hash = payloadHash(payload)
  await supabase
    .from('pr_raw_payloads')
    .upsert({
      source_url: sourceUrl,
      payload_kind: payloadKind,
      avance_num: avanceNum,
      payload,
      payload_hash: hash,
    }, { onConflict: 'source_url,payload_hash' })
}

export async function upsertBoletin(supabase, boletin, sourceUrl) {
  const row = mapBoletinHeader(boletin, sourceUrl)
  const match = {
    avance_num: row.avance_num,
    tipo_boletin: row.tipo_boletin,
    codigo_departamento: row.codigo_departamento,
    codigo_municipio: row.codigo_municipio,
    codigo_comuna: row.codigo_comuna,
  }

  let query = supabase
    .from('pr_boletins')
    .select('id')
    .eq('avance_num', match.avance_num)
    .eq('tipo_boletin', match.tipo_boletin)

  for (const key of ['codigo_departamento', 'codigo_municipio', 'codigo_comuna']) {
    query = match[key] === null ? query.is(key, null) : query.eq(key, match[key])
  }

  const { data: existing, error: selectError } = await query.maybeSingle()
  if (selectError) throw selectError

  const result = existing?.id
    ? await supabase.from('pr_boletins').update(row).eq('id', existing.id).select('id').single()
    : await supabase.from('pr_boletins').insert(row).select('id').single()

  if (result.error) throw result.error

  const boletinId = result.data.id
  await supabase.from('pr_results').delete().eq('boletin_id', boletinId)

  const rows = mapResultRows(boletinId, boletin)
  if (rows.length > 0) {
    const { error } = await supabase.from('pr_results').insert(rows)
    if (error) throw error
  }

  return { boletinId, resultCount: rows.length, avanceNum: row.avance_num, boletinNum: row.boletin_num }
}
