import { COLOMBIA_DEPARTMENTS } from './colombia-map'
import { toInteger } from './presidential-data'

const SIMULATION_SOURCE_PREFIX = 'simulator://registraduria'
const SIMULATION_START_AVANCE = 9000

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function percent(part, total) {
  if (!total) return 0
  return Number(((part / total) * 100).toFixed(2))
}

function distributeVotes(candidates, totalVotes, volatility = 0.45) {
  const weights = candidates.map((_, index) => Math.max(0.12, 1.9 - index * 0.12) + Math.random() * volatility)
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  let assigned = 0

  const rows = candidates.map((candidate, index) => {
    const votes = index === candidates.length - 1
      ? totalVotes - assigned
      : Math.floor((weights[index] / weightTotal) * totalVotes)
    assigned += votes

    return {
      Partido: candidate.codigo_partido,
      Candidato: candidate.codigo_candidato,
      Votos: votes,
      Porc_Votos: percent(votes, totalVotes),
    }
  })

  return rows.sort((a, b) => b.Votos - a.Votos)
}

function buildBoletin({
  avanceNum,
  boletinNum,
  type,
  department,
  candidates,
  mesasInstaladas,
  mesasInformadas,
  potentialVoters,
  validVotes,
}) {
  const blankVotes = Math.floor(validVotes * randomInt(1, 5) / 100)
  const candidateVotes = Math.max(0, validVotes - blankVotes)
  const nullVotes = Math.floor(validVotes * randomInt(1, 3) / 100)
  const unmarkedVotes = Math.floor(validVotes * randomInt(1, 2) / 100)
  const totalSufragantes = validVotes + nullVotes + unmarkedVotes
  const now = new Date()

  return {
    Numero: avanceNum,
    Boletin: boletinNum,
    Tipo_Boletin: type,
    Desc_Corporacion: 'PRESIDENTE Y VICEPRESIDENTE',
    Departamento: department?.code || null,
    Desc_Departamento: department?.name || null,
    Municipio: null,
    Desc_Municipio: null,
    Comuna: null,
    Desc_Comuna: null,
    Anio: now.getFullYear(),
    Mes: now.getMonth() + 1,
    Dia: now.getDate(),
    Hora: now.getHours(),
    Minuto: now.getMinutes(),
    Mesas_Instaladas: mesasInstaladas,
    Mesas_Informadas: mesasInformadas,
    Porc_Mesas_Informadas: percent(mesasInformadas, mesasInstaladas),
    Potencial_Sufragantes: potentialVoters,
    Total_Sufragantes: totalSufragantes,
    Porc_Sufragantes: percent(totalSufragantes, potentialVoters),
    Votos_Nulos: nullVotes,
    Porc_Votos_Nulos: percent(nullVotes, totalSufragantes),
    Votos_Validos: validVotes,
    Porc_Votos_Validos: percent(validVotes, totalSufragantes),
    Votos_No_Marcados: unmarkedVotes,
    Porc_Votos_No_Marcados: percent(unmarkedVotes, totalSufragantes),
    Detalle_Circunscripcion: [{
      Detalle_Partido: distributeVotes(candidates, candidateVotes),
      Detalle_Partidos_Totales: [{
        Partido: '00996',
        Descripcion: 'VOTOS EN BLANCO',
        Votos: blankVotes,
        Porc: percent(blankVotes, validVotes),
      }],
    }],
  }
}

export function simulationSourceUrl(kind, avanceNum) {
  return `${SIMULATION_SOURCE_PREFIX}/${kind}/${avanceNum}.json`
}

export async function getSimulationCandidates(supabase) {
  const { data, error } = await supabase
    .from('pr_catalog_candidates')
    .select('codigo_partido,codigo_candidato,nombre_completo,sorteo')
    .order('sorteo', { ascending: true })

  if (error) throw error

  if (!data?.length) {
    throw new Error('No presidential candidates found for simulation')
  }

  return data
}

export async function getNextSimulationAvance(supabase, requestedAvance) {
  if (requestedAvance) return toInteger(requestedAvance)

  const { data, error } = await supabase
    .from('pr_boletins')
    .select('avance_num')
    .gte('avance_num', SIMULATION_START_AVANCE)
    .order('avance_num', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return (data?.avance_num || SIMULATION_START_AVANCE) + 1
}

export function generateSimulationBoletins({ avanceNum, candidates }) {
  const progress = clamp((avanceNum - SIMULATION_START_AVANCE) * randomInt(2, 6), 1, 98)
  const nationalMesas = 110000
  const nationalMesasInformadas = Math.floor(nationalMesas * progress / 100)
  const nationalPotential = 39000000
  const nationalValidVotes = Math.floor(nationalPotential * (progress / 100) * (0.35 + Math.random() * 0.2))

  const national = buildBoletin({
    avanceNum,
    boletinNum: avanceNum - SIMULATION_START_AVANCE,
    type: 'NACIONAL',
    candidates,
    mesasInstaladas: nationalMesas,
    mesasInformadas: nationalMesasInformadas,
    potentialVoters: nationalPotential,
    validVotes: nationalValidVotes,
  })

  const departments = COLOMBIA_DEPARTMENTS.map((department) => {
    const mesasInstaladas = randomInt(600, 7800)
    const mesasInformadas = Math.max(1, Math.floor(mesasInstaladas * clamp(progress + randomInt(-12, 12), 1, 99) / 100))
    const potentialVoters = mesasInstaladas * randomInt(260, 430)
    const validVotes = Math.floor(potentialVoters * (mesasInformadas / mesasInstaladas) * (0.32 + Math.random() * 0.24))

    return buildBoletin({
      avanceNum,
      boletinNum: avanceNum - SIMULATION_START_AVANCE,
      type: 'DEPARTAMENTAL',
      department,
      candidates,
      mesasInstaladas,
      mesasInformadas,
      potentialVoters,
      validVotes,
    })
  })

  return { national, departments }
}

export async function resetSimulationData(supabase) {
  const { error: boletinsError } = await supabase
    .from('pr_boletins')
    .delete()
    .like('source_url', `${SIMULATION_SOURCE_PREFIX}/%`)

  if (boletinsError) throw boletinsError

  const { error: rawError } = await supabase
    .from('pr_raw_payloads')
    .delete()
    .like('source_url', `${SIMULATION_SOURCE_PREFIX}/%`)

  if (rawError) throw rawError

  const { data: latest, error: latestError } = await supabase
    .from('pr_boletins')
    .select('avance_num,boletin_num,source_url')
    .eq('tipo_boletin', 'NACIONAL')
    .order('avance_num', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) throw latestError

  const fetchedAt = new Date().toISOString()
  const { error: stateError } = await supabase
    .from('pr_sync_state')
    .upsert({
      key: 'presidential_live',
      current_avance_num: latest?.avance_num || null,
      current_boletin_num: latest?.boletin_num || null,
      current_national_url: latest?.source_url || null,
      current_departments_url: latest?.source_url || null,
      status: latest ? 'ok' : 'idle',
      last_error: null,
      fetched_at: latest ? fetchedAt : null,
      updated_at: fetchedAt,
    }, { onConflict: 'key' })

  if (stateError) throw stateError
}
