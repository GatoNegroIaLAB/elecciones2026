export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await res.revalidate('/')
    return res.status(200).json({ revalidated: true, now: Date.now() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
