import { isManualIngestAuthorized, runPresidentialIngest } from '../../lib/presidential-ingest'

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isManualIngestAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const result = await runPresidentialIngest()
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message })
  }
}

export const config = {
  api: { responseLimit: '12mb' },
}
