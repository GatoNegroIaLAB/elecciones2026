import crypto from 'crypto'
import {
  createServiceClient,
  fetchRegistraduriaJson,
  getBoletins,
  resolveLatestPresidentialIndex,
  resolveRegistraduriaUrl,
  storeRawPayload,
  upsertBoletin,
} from './presidential-data'

const INGEST_LOCK_KEY = 'presidential_live'
const DEFAULT_INGEST_LOCK_TIMEOUT_MS = 10 * 60 * 1000

export function isManualIngestAuthorized(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token
  const expected = process.env.INGEST_TOKEN || process.env.REVALIDATE_TOKEN
  return expected && token === expected
}

function getIngestLockTimeoutMs() {
  const parsed = Number.parseInt(process.env.INGEST_LOCK_TIMEOUT_MS || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INGEST_LOCK_TIMEOUT_MS
}

async function acquireIngestLock(supabase, startedAt, lockToken) {
  const expiresAt = new Date(new Date(startedAt).getTime() + getIngestLockTimeoutMs()).toISOString()
  const { data, error } = await supabase.rpc('pr_acquire_ingest_lock', {
    p_key: INGEST_LOCK_KEY,
    p_token: lockToken,
    p_started_at: startedAt,
    p_expires_at: expiresAt,
  })

  if (error) throw error

  const payload = Array.isArray(data) ? data[0] : data

  return {
    acquired: Boolean(payload?.acquired),
    lockExpiresAt: payload?.current_lock_expires_at || expiresAt,
    currentLockToken: payload?.current_lock_token || null,
  }
}

async function releaseIngestLock(supabase, lockToken, values) {
  const { error } = await supabase
    .from('pr_sync_state')
    .update({
      ...values,
      lock_token: null,
      lock_acquired_at: null,
      lock_expires_at: null,
    })
    .eq('key', INGEST_LOCK_KEY)
    .eq('lock_token', lockToken)

  if (error) throw error
}

export async function runPresidentialIngest() {
  const supabase = createServiceClient()
  const startedAt = new Date().toISOString()
  const lockToken = crypto.randomUUID()
  const lockState = await acquireIngestLock(supabase, startedAt, lockToken)

  if (!lockState.acquired) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_running',
      started_at: startedAt,
      lock_expires_at: lockState.lockExpiresAt,
    }
  }

  try {
    const latestIndex = await resolveLatestPresidentialIndex(supabase)
    const index = latestIndex.payload
    const avance = index.Avance || {}
    const nationalUrl = resolveRegistraduriaUrl(avance.URL_Json_COLOMBIA, latestIndex.url)
    const departmentsUrl = resolveRegistraduriaUrl(avance.URL_Json_DEPARTAMENTOS, latestIndex.url)
    const capitalsUrl = avance.URL_Json_CAPITALES
      ? resolveRegistraduriaUrl(avance.URL_Json_CAPITALES, latestIndex.url)
      : null

    await storeRawPayload(supabase, latestIndex.url, 'index', latestIndex.avanceNum, index)

    const [nationalPayload, departmentsPayload, capitalsPayload] = await Promise.all([
      fetchRegistraduriaJson(nationalUrl),
      fetchRegistraduriaJson(departmentsUrl),
      capitalsUrl ? fetchRegistraduriaJson(capitalsUrl) : Promise.resolve(null),
    ])

    const rawPayloadWrites = [
      storeRawPayload(supabase, nationalUrl, 'national', latestIndex.avanceNum, nationalPayload),
      storeRawPayload(supabase, departmentsUrl, 'departments', latestIndex.avanceNum, departmentsPayload),
    ]

    if (capitalsUrl && capitalsPayload) {
      rawPayloadWrites.push(storeRawPayload(supabase, capitalsUrl, 'capitals', latestIndex.avanceNum, capitalsPayload))
    }

    await Promise.all(rawPayloadWrites)

    const nationalResults = []
    for (const boletin of getBoletins(nationalPayload)) {
      nationalResults.push(await upsertBoletin(supabase, boletin, nationalUrl))
    }

    const departmentResults = []
    for (const boletin of getBoletins(departmentsPayload)) {
      departmentResults.push(await upsertBoletin(supabase, boletin, departmentsUrl))
    }

    const capitalResults = []
    for (const boletin of getBoletins(capitalsPayload)) {
      capitalResults.push(await upsertBoletin(supabase, boletin, capitalsUrl))
    }

    const latest = nationalResults[0] || departmentResults[0] || capitalResults[0] || {}
    const fetchedAt = new Date().toISOString()

    await releaseIngestLock(supabase, lockToken, {
      current_avance_num: latest.avanceNum ?? latestIndex.avanceNum,
      current_boletin_num: latest.boletinNum ?? Number(avance.Boletin || 0),
      current_index_url: latestIndex.url,
      current_national_url: nationalUrl,
      current_departments_url: departmentsUrl,
      status: 'ok',
      last_error: null,
      fetched_at: fetchedAt,
      updated_at: fetchedAt,
    })

    return {
      ok: true,
      started_at: startedAt,
      fetched_at: fetchedAt,
      national_boletins: nationalResults.length,
      department_boletins: departmentResults.length,
      capital_boletins: capitalResults.length,
      national_results: nationalResults.reduce((sum, item) => sum + item.resultCount, 0),
      department_results: departmentResults.reduce((sum, item) => sum + item.resultCount, 0),
      capital_results: capitalResults.reduce((sum, item) => sum + item.resultCount, 0),
    }
  } catch (error) {
    await releaseIngestLock(supabase, lockToken, {
      status: 'error',
      last_error: error.message,
      updated_at: new Date().toISOString(),
    })

    throw error
  }
}
