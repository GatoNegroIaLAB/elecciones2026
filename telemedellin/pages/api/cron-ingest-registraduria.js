import { getServerIngestRuntime } from '../../lib/election-runtime'
import { runPresidentialIngest } from '../../lib/presidential-ingest'

function isCronAuthorized(req) {
  const expected = process.env.CRON_SECRET
  const header = req.headers.authorization || ''
  return expected && header === `Bearer ${expected}`
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const runtime = getServerIngestRuntime()
  if (!runtime.shouldRun) {
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: runtime.reason,
      ingest_start_at: runtime.ingestStartAt,
    })
  }

  try {
    const result = await runPresidentialIngest()
    return res.status(200).json({
      ...result,
      trigger: 'cron',
    })
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message })
  }
}
