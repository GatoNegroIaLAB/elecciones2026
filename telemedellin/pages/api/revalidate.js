export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validar token de seguridad
  const token = req.headers['x-revalidate-token']
  if (token !== process.env.REVALIDATE_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { corporacion, avance } = req.body || {}

  try {
    await res.revalidate('/')
    return res.status(200).json({ 
      revalidated: true, 
      corporacion,
      avance,
      now: Date.now() 
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
