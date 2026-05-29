import { createServiceClient } from '../../lib/presidential-data'

const CITY_TARGETS = [
  { key: 'medellin', name: 'Medellín', codigo_departamento: '01', codigo_municipio: '001' },
  { key: 'bogota', name: 'Bogotá', codigo_departamento: '16', codigo_municipio: '001' },
  { key: 'cali', name: 'Cali', codigo_departamento: '31', codigo_municipio: '001' },
  { key: 'barranquilla', name: 'Barranquilla', codigo_departamento: '03', codigo_municipio: '001' },
]

function cityFilter() {
  return CITY_TARGETS
    .map(city => `and(codigo_departamento.eq.${city.codigo_departamento},codigo_municipio.eq.${city.codigo_municipio})`)
    .join(',')
}

async function loadCityResults(supabase, avanceNum) {
  if (avanceNum == null) {
    return CITY_TARGETS.map(city => ({ ...city, winner: null }))
  }

  const cityBoletinsResult = await supabase
    .from('pr_boletins')
    .select('id, codigo_departamento, nombre_departamento, codigo_municipio, nombre_municipio, mesas_informadas, porc_mesas_informadas, votos_validos, votos_blancos')
    .eq('avance_num', avanceNum)
    .or(cityFilter())

  if (cityBoletinsResult.error) throw cityBoletinsResult.error

  const cityBoletins = cityBoletinsResult.data || []
  if (cityBoletins.length === 0) {
    return CITY_TARGETS.map(city => ({ ...city, winner: null }))
  }

  const resultsResult = await supabase
    .from('pr_results')
    .select('boletin_id, codigo_partido, codigo_candidato, votos, porc_votos')
    .in('boletin_id', cityBoletins.map(row => row.id))

  if (resultsResult.error) throw resultsResult.error

  const partyCodes = [...new Set((resultsResult.data || []).map(row => row.codigo_partido).filter(Boolean))]
  const partiesResult = partyCodes.length > 0
    ? await supabase
      .from('pr_catalog_parties')
      .select('codigo, nombre, color_hex')
      .in('codigo', partyCodes)
    : { data: [], error: null }

  if (partiesResult.error) throw partiesResult.error

  const partiesByCode = new Map((partiesResult.data || []).map(row => [row.codigo, row]))
  const resultsByBoletinId = new Map()

  for (const row of resultsResult.data || []) {
    const bucket = resultsByBoletinId.get(row.boletin_id) || []
    bucket.push(row)
    resultsByBoletinId.set(row.boletin_id, bucket)
  }

  return CITY_TARGETS.map(city => {
    const boletin = cityBoletins.find(row => (
      row.codigo_departamento === city.codigo_departamento &&
      row.codigo_municipio === city.codigo_municipio
    ))

    if (!boletin) {
      return { ...city, winner: null }
    }

    const winner = [...(resultsByBoletinId.get(boletin.id) || [])]
      .sort((a, b) => Number(b.votos || 0) - Number(a.votos || 0))[0] || null

    const party = winner ? partiesByCode.get(winner.codigo_partido) : null

    return {
      ...city,
      nombre_departamento: boletin.nombre_departamento,
      nombre_municipio: boletin.nombre_municipio || city.name,
      mesas_informadas: boletin.mesas_informadas,
      porc_mesas_informadas: boletin.porc_mesas_informadas,
      votos_validos: boletin.votos_validos,
      votos_blancos: boletin.votos_blancos,
      winner: winner ? {
        ...winner,
        nombre_partido: party?.nombre || null,
        color_hex: party?.color_hex || null,
      } : null,
    }
  })
}

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

    const cities = await loadCityResults(supabase, statusResult.data?.current_avance_num)

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=50')
    return res.status(200).json({
      status: statusResult.data || null,
      national: nationalResult.data || [],
      departments: departmentsResult.data || [],
      cities,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
