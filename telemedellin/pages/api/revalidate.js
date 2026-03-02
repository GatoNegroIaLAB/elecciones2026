export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = req.headers['x-revalidate-token']
  if (token !== process.env.REVALIDATE_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { corporacion, avance } = req.body || {}

  // No usar res.revalidate() — causa error en Vercel con apps SPA
  // La app refresca datos automáticamente via Supabase Realtime
  return res.status(200).json({
    ok: true,
    message: 'Notificación recibida. App refresca via Supabase Realtime.',
    corporacion,
    avance,
    now: Date.now()
  })
}
