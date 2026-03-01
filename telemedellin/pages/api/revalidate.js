export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Optional simple protection for webhook callers
  const expectedToken = process.env.REVALIDATE_TOKEN
  const receivedToken = req.headers['x-revalidate-token'] || req.query?.token

  if (expectedToken && receivedToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // This app loads data client-side (Supabase + polling/realtime), so
  // on-demand ISR revalidation is not required and may fail on static exports.
  return res.status(200).json({
    ok: true,
    message: 'No-op revalidate: frontend refreshes data client-side.',
    now: Date.now()
  })
}
