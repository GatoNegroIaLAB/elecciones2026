import {
  createServiceClient,
  storeRawPayload,
  upsertBoletin,
} from '../../lib/presidential-data'
import {
  generateSimulationBoletins,
  getNextSimulationAvance,
  getSimulationCandidates,
  resetSimulationData,
  simulationSourceUrl,
} from '../../lib/presidential-simulator'

function isAuthorized(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token
  const expected = process.env.INGEST_TOKEN || process.env.REVALIDATE_TOKEN
  return expected && token === expected
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (process.env.ENABLE_ELECTION_SIMULATION !== 'true') {
    return res.status(403).json({ error: 'Election simulation is disabled' })
  }

  const supabase = createServiceClient()
  const mode = req.query.mode || req.body?.mode || 'tick'

  try {
    if (mode === 'reset') {
      await resetSimulationData(supabase)
      return res.status(200).json({ ok: true, mode: 'reset' })
    }

    if (mode !== 'tick') {
      return res.status(400).json({ error: 'Invalid simulation mode' })
    }

    const avanceNum = await getNextSimulationAvance(supabase, req.query.avance || req.body?.avance)
    const candidates = await getSimulationCandidates(supabase)
    const payload = generateSimulationBoletins({ avanceNum, candidates })
    const nationalUrl = simulationSourceUrl('national', avanceNum)
    const departmentsUrl = simulationSourceUrl('departments', avanceNum)

    await Promise.all([
      storeRawPayload(supabase, nationalUrl, 'simulation_national', avanceNum, { Boletin: payload.national }),
      storeRawPayload(supabase, departmentsUrl, 'simulation_departments', avanceNum, { Boletin: payload.departments }),
    ])

    const nationalResult = await upsertBoletin(supabase, payload.national, nationalUrl)
    const departmentResults = []

    for (const boletin of payload.departments) {
      departmentResults.push(await upsertBoletin(supabase, boletin, departmentsUrl))
    }

    const fetchedAt = new Date().toISOString()
    await supabase
      .from('pr_sync_state')
      .upsert({
        key: 'presidential_live',
        current_avance_num: avanceNum,
        current_boletin_num: nationalResult.boletinNum,
        current_national_url: nationalUrl,
        current_departments_url: departmentsUrl,
        status: 'simulation',
        last_error: null,
        fetched_at: fetchedAt,
        updated_at: fetchedAt,
      }, { onConflict: 'key' })

    return res.status(200).json({
      ok: true,
      mode: 'tick',
      avance_num: avanceNum,
      boletin_num: nationalResult.boletinNum,
      national_results: nationalResult.resultCount,
      department_boletins: departmentResults.length,
      department_results: departmentResults.reduce((sum, item) => sum + item.resultCount, 0),
      fetched_at: fetchedAt,
    })
  } catch (error) {
    await supabase
      .from('pr_sync_state')
      .upsert({
        key: 'presidential_live',
        status: 'simulation_error',
        last_error: error.message,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    return res.status(500).json({ ok: false, error: error.message })
  }
}

export const config = {
  api: { responseLimit: '12mb' },
}
