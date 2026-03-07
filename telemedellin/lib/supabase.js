import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Leer resultados por corporación ──────────────────────────────────────────
export async function getResultados(corporacion = 'SENADO') {
  // Primero obtenemos el último avance disponible
  const { data: ctrl } = await supabase
    .from('control_avances')
    .select('ultimo_avance_num')
    .eq('corporacion', corporacion)
    .single()

  const ultimoAvance = ctrl?.ultimo_avance_num ?? 0

  // Luego traemos solo los registros de ese avance
  const { data, error } = await supabase
    .from('avances_resultados')
    .select(`
      corporacion, num_avance, tipo_boletin,
      cod_dpto, nombre_dpto, cod_municipio, nombre_municipio,
      cod_partido, votos_partido, porc_partido,
      mesas_instaladas, mesas_informadas, porc_mesas,
      potencial_sufragantes, total_sufragantes, votos_validos,
      votos_nulos, votos_no_marcados
    `)
    .eq('corporacion', corporacion)
    .eq('tipo_boletin', 'NACIONAL')
    .eq('num_avance', ultimoAvance)
    .order('votos_partido', { ascending: false })

  if (error) throw error
  return data || []
}

// ── Leer control de avances ───────────────────────────────────────────────────
export async function getControlAvances() {
  const { data, error } = await supabase
    .from('control_avances')
    .select('corporacion, ultimo_avance_num, ultima_actualizacion')

  if (error) throw error
  return data || []
}

// ── Leer catálogo de partidos ─────────────────────────────────────────────────
export async function getPartidos() {
  const { data, error } = await supabase
    .from('cat_partidos')
    .select('codigo, nombre')

  if (error) throw error
  return data || []
}

// ── Combinar resultados con nombres de partidos ───────────────────────────────
export function enrichResultados(resultados, partidos) {
  const partidosMap = {}
  partidos.forEach(p => { partidosMap[p.codigo] = p.nombre })
  return resultados.map(r => ({
    ...r,
    nombre_partido: partidosMap[r.cod_partido] || `Partido ${r.cod_partido}`
  }))
}
