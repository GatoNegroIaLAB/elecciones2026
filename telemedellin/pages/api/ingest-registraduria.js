import {
  PRESIDENTIAL_INDEX_URL,
  createServiceClient,
  fetchRegistraduriaJson,
  getBoletins,
  resolveRegistraduriaUrl,
  storeRawPayload,
  upsertBoletin,
} from '../../lib/presidential-data'

function isAuthorized(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token
  const expected = process.env.INGEST_TOKEN || process.env.REVALIDATE_TOKEN
  return expected && token === expected
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createServiceClient()
  const startedAt = new Date().toISOString()

  try {
    await supabase
      .from('pr_sync_state')
      .upsert({
        key: 'presidential_live',
        current_index_url: PRESIDENTIAL_INDEX_URL,
        status: 'fetching',
        last_error: null,
        updated_at: startedAt,
      }, { onConflict: 'key' })

    const index = await fetchRegistraduriaJson(PRESIDENTIAL_INDEX_URL)
    const avance = index.Avance || {}
    const nationalUrl = resolveRegistraduriaUrl(avance.URL_Json_COLOMBIA)
    const departmentsUrl = resolveRegistraduriaUrl(avance.URL_Json_DEPARTAMENTOS)

    await storeRawPayload(supabase, PRESIDENTIAL_INDEX_URL, 'index', Number(avance.Numero || 0), index)

    const [nationalPayload, departmentsPayload] = await Promise.all([
      fetchRegistraduriaJson(nationalUrl),
      fetchRegistraduriaJson(departmentsUrl),
    ])

    await Promise.all([
      storeRawPayload(supabase, nationalUrl, 'national', Number(avance.Numero || 0), nationalPayload),
      storeRawPayload(supabase, departmentsUrl, 'departments', Number(avance.Numero || 0), departmentsPayload),
    ])

    const nationalResults = []
    for (const boletin of getBoletins(nationalPayload)) {
      nationalResults.push(await upsertBoletin(supabase, boletin, nationalUrl))
    }

    const departmentResults = []
    for (const boletin of getBoletins(departmentsPayload)) {
      departmentResults.push(await upsertBoletin(supabase, boletin, departmentsUrl))
    }

    const latest = nationalResults[0] || departmentResults[0] || {}
    const fetchedAt = new Date().toISOString()
    await supabase
      .from('pr_sync_state')
      .upsert({
        key: 'presidential_live',
        current_avance_num: latest.avanceNum || Number(avance.Numero || 0),
        current_boletin_num: latest.boletinNum || Number(avance.Boletin || 0),
        current_index_url: PRESIDENTIAL_INDEX_URL,
        current_national_url: nationalUrl,
        current_departments_url: departmentsUrl,
        status: 'ok',
        last_error: null,
        fetched_at: fetchedAt,
        updated_at: fetchedAt,
      }, { onConflict: 'key' })

    return res.status(200).json({
      ok: true,
      started_at: startedAt,
      fetched_at: fetchedAt,
      national_boletins: nationalResults.length,
      department_boletins: departmentResults.length,
      national_results: nationalResults.reduce((sum, item) => sum + item.resultCount, 0),
      department_results: departmentResults.reduce((sum, item) => sum + item.resultCount, 0),
    })
  } catch (error) {
    await supabase
      .from('pr_sync_state')
      .upsert({
        key: 'presidential_live',
        status: 'error',
        last_error: error.message,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    return res.status(500).json({ ok: false, error: error.message })
  }
}

export const config = {
  api: { responseLimit: '12mb' },
}
