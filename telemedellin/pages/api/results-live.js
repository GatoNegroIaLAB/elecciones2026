import { createServiceClient } from '../../lib/presidential-data'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createServiceClient()

    const [statusResult, nationalResult, departmentsResult] = await Promise.all([
      supabase.from('pr_live_status').select('*').maybeSingle(),
      supabase.from('pr_latest_national_results').select('*').order('votos', { ascending: false }),
      supabase.from('pr_latest_department_winners').select('*').order('nombre_departamento', { ascending: true }),
    ])

    for (const result of [statusResult, nationalResult, departmentsResult]) {
      if (result.error) throw result.error
    }

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=50')
    return res.status(200).json({
      status: statusResult.data || null,
      national: nationalResult.data || [],
      departments: departmentsResult.data || [],
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
