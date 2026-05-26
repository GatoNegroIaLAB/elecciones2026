import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { Activity, Medal, Play, Trophy, Users } from 'lucide-react'
import { COLOMBIA_DEPARTMENTS, COLOMBIA_MAP_VIEWBOX } from '../lib/colombia-map'

const LIVE_SIGNAL_URL = 'https://www.youtube.com/embed/qWqWVzOMgsE?autoplay=0&mute=0&rel=0&modestbranding=1'
const DEFAULT_COLOR = '#64748b'

const CANDIDATES = {
  '00026': { name: 'Iván Cepeda Castro', party: 'Movimiento Político Pacto Histórico', color: '#6B2D8B', image: '/candidatos/ivan-cepeda.png' },
  '01004': { name: 'Claudia López', party: 'Con Claudia Imparables', color: '#2A7A4A', image: '/candidatos/claudia-lopez.png' },
  '01001': { name: 'Raúl Santiago Botero Jaramillo', party: 'Romper el Sistema', color: '#D4A017', image: '/candidatos/raul-botero.png' },
  '01003': { name: 'Abelardo De La Espriella', party: 'Defensores de la Patria', color: '#1E4D8C', image: '/candidatos/abelardo-de-la-espriella.png' },
  '03001': { name: 'Óscar Mauricio Lizcano Arango', party: 'Coalición F.A.M.I.L.I.A', color: '#2C6FA8', image: '/candidatos/mauricio-lizcano.png' },
  '00020': { name: 'Miguel Uribe Londoño', party: 'Partido Demócrata Colombiano', color: '#C0252A', image: '/candidatos/miguel-uribe-londono.png' },
  '01002': { name: 'Sondra Macollins Garvin Pinto', party: 'Sondra Macollins, La Abogada de Hierro', color: '#B02020', image: '/candidatos/sondra-macollins.png' },
  '00022': { name: 'Roy Leonardo Barreras Montealegre', party: 'Partido Político La Fuerza', color: '#C06040', image: '/candidatos/roy-barreras.png' },
  '01006': { name: 'Carlos Eduardo Caicedo Omar', party: 'Caicedo', color: '#1E6A98', image: '/candidatos/carlos-caicedo.png' },
  '00021': { name: 'Gustavo Matamoros Camacho', party: 'Partido Ecologista Colombiano', color: '#5A7A3A', image: '/candidatos/gustavo-matamoros.png' },
  '00009': { name: 'Paloma Valencia Laserna', party: 'Partido Centro Democrático', color: '#1A3A6B', image: '/candidatos/paloma-valencia.png' },
  '00015': { name: 'Sergio Fajardo Valderrama', party: 'Partido Político Dignidad & Compromiso', color: '#4A9A5A', image: '/candidatos/sergio-fajardo.png' },
  '01005': { name: 'Luis Gilberto Murillo Urrutia', party: 'La Oportunidad Es Colombia', color: '#3A8A6A', image: '/candidatos/luis-gilberto-murillo.png' },
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-CO')
}

function formatPercent(value) {
  const n = Number(String(value ?? 0).replace(',', '.'))
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : '0.00%'
}

function mapResult(row) {
  const fallback = CANDIDATES[row.codigo_partido] || {}
  return {
    code: row.codigo_partido,
    candidateCode: row.codigo_candidato,
    name: row.nombre_candidato || fallback.name || `Candidato ${row.codigo_partido}`,
    party: row.nombre_partido || fallback.party || `Partido ${row.codigo_partido}`,
    color: row.color_hex || fallback.color || DEFAULT_COLOR,
    image: fallback.image || null,
    votes: Number(row.votos || 0),
    percent: Number(row.porc_votos || 0),
  }
}

function normalizeDepartmentName(name = '') {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function departmentKey(name = '') {
  const normalized = normalizeDepartmentName(name)
  if (normalized.includes('BOGOTA')) return 'BOGOTA'
  if (normalized.includes('SAN ANDRES')) return 'SAN ANDRES'
  if (normalized === 'VALLE') return 'VALLE DEL CAUCA'
  if (normalized === 'NORTE DE SAN') return 'NORTE DE SANTANDER'
  return normalized
}

const Card = ({ children, className = '' }) => (
  <div className={`rounded-xl border border-[#414E57] bg-[#414E57]/55 backdrop-blur-sm ${className}`}>
    {children}
  </div>
)

const CandidateRow = ({ candidate, leaderVotes, rank }) => {
  const width = leaderVotes > 0 ? Math.max((candidate.votes / leaderVotes) * 100, 2) : 0
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="break-words font-bold leading-tight text-white">
            <span className="text-[#BDB09B]">{rank}. </span>{candidate.name}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[#BDB09B]">{candidate.party}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-white tabular-nums">{formatPercent(candidate.percent)}</p>
          <p className="text-[11px] text-[#BDB09B] tabular-nums">{formatNumber(candidate.votes)} votos</p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/35 sm:h-2.5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${width}%`, backgroundColor: candidate.color || DEFAULT_COLOR }}
        />
      </div>
    </div>
  )
}

const ColombiaMap = ({ winnersByDepartment }) => (
  <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
    <div className="lg:col-span-7">
      <svg
        viewBox={COLOMBIA_MAP_VIEWBOX}
        role="img"
        aria-label="Mapa de Colombia por ganador departamental"
        className="h-auto w-full max-h-[680px]"
      >
        <rect width="100%" height="100%" rx="16" fill="rgba(0,0,0,0.18)" />
        {COLOMBIA_DEPARTMENTS.map(department => {
          const winner = winnersByDepartment.get(departmentKey(department.name))
          return (
            <path
              key={department.code}
              d={department.path}
              fill={winner?.winner?.color || '#1f2937'}
              stroke="#0f172a"
              strokeWidth="0.8"
              opacity={winner ? 0.94 : 0.45}
            >
              <title>
                {winner
                  ? `${department.name}: ${winner.winner.name} (${formatPercent(winner.winner.percent)})`
                  : `${department.name}: sin datos`}
              </title>
            </path>
          )
        })}
      </svg>
    </div>
    <div className="lg:col-span-5">
      <div className="grid max-h-[680px] grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2 lg:grid-cols-1">
        {[...winnersByDepartment.values()].map(dep => (
          <div key={dep.code} className="rounded-lg border border-[#414E57] bg-black/20 p-3">
            <div className="mb-2 h-2 rounded-full" style={{ backgroundColor: dep.winner.color || DEFAULT_COLOR }} />
            <p className="text-xs font-black uppercase leading-tight text-white">{dep.name}</p>
            <p className="mt-1 truncate text-[11px] font-bold text-[#BDB09B]">{dep.winner.name}</p>
            <p className="mt-2 text-[10px] text-[#BDB09B]">{formatPercent(dep.winner.percent)} · {formatPercent(dep.mesas)} mesas</p>
          </div>
        ))}
      </div>
    </div>
  </div>
)

export default function Home() {
  const [national, setNational] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/results-live')
      if (!response.ok) throw new Error('No se pudieron leer los resultados presidenciales')

      const data = await response.json()
      setNational(data.status || null)
      setCandidates((data.national || []).map(mapResult))
      setDepartments((data.departments || []).map(row => ({
        code: row.codigo_departamento,
        name: row.nombre_departamento,
        mesas: row.porc_mesas_informadas,
        winner: mapResult(row),
      })))
      setLastUpdate(data.status?.fetched_at ? new Date(data.status.fetched_at) : new Date())
    } catch (e) {
      setError(e.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 60000)
    return () => clearInterval(id)
  }, [fetchData])

  useEffect(() => {
    const sendHeight = () => {
      const h = Math.max(document.documentElement?.scrollHeight || 0, document.body?.scrollHeight || 0)
      window.parent?.postMessage({ type: 'tm-elecciones-height', height: h }, '*')
    }
    sendHeight()
    window.addEventListener('resize', sendHeight)
    const id = setInterval(sendHeight, 1000)
    return () => {
      window.removeEventListener('resize', sendHeight)
      clearInterval(id)
    }
  }, [])

  const topThree = candidates.slice(0, 3)
  const leaderVotes = candidates[0]?.votes || 0
  const departmentWinners = useMemo(() => (
    departments.filter(dep => dep.winner && departmentKey(dep.name) !== 'CONSULADOS')
  ), [departments])
  const winnersByDepartment = useMemo(() => {
    const map = new Map()
    departmentWinners.forEach(dep => map.set(departmentKey(dep.name), dep))
    return map
  }, [departmentWinners])

  return (
    <>
      <Head>
        <title>Telemedellín · Presidenciales 2026 en Vivo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;600;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen text-[#F8F8F7] selection:bg-[#F1AA41]/30" style={{ fontFamily: "'IBM Plex Sans', sans-serif", backgroundColor: 'transparent' }}>
        <header className="sticky top-0 z-50 border-b border-[#414E57] bg-black/90 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto max-w-7xl">
            <div>
              <h1 className="text-base font-bold leading-none">
                Elecciones Presidenciales 2026 · <span className="text-[#00B6CD]">Resultados en vivo</span>
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 rounded border border-[#F1AA41]/40 bg-[#F1AA41]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#F1AA41]">
                  <span className={`h-1.5 w-1.5 rounded-full bg-[#F1AA41] ${!error ? 'animate-pulse-glow' : ''}`} />
                  {error ? 'Revisar datos' : 'En vivo'}
                </span>
                <span className="rounded-md border border-[#00A4C2]/40 bg-[#00629E]/35 px-2 py-1 text-[10px] font-bold">
                  Registraduría Nacional
                </span>
                <span className="rounded-md border border-[#F1AA41]/50 bg-[#F1AA41]/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                  Presidencia y Vicepresidencia
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 p-3 sm:gap-6 sm:p-4 lg:grid-cols-12">
          {error && (
            <Card className="border-red-500/50 p-4 text-sm text-red-100 lg:col-span-12">
              {error}
            </Card>
          )}

          <Card className="order-1 p-4 sm:p-5 lg:col-span-5 lg:order-1">
            <div className="mb-4 flex items-center gap-3">
              <Activity size={18} className="text-[#00B6CD]" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Avance nacional</h3>
                <p className="text-[10px] uppercase tracking-widest text-[#BDB09B]">
                  Última lectura: {lastUpdate ? lastUpdate.toLocaleTimeString('es-CO') : '—'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:gap-4">
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#BDB09B]">Mesas informadas</p>
                <p className="mt-1 text-2xl font-black text-white">{formatPercent(national?.porc_mesas_informadas)}</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#BDB09B]">Votos válidos</p>
                <p className="mt-1 text-2xl font-black text-white">{formatNumber(national?.votos_validos)}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-black/20 p-3 sm:col-span-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#BDB09B]">Voto en blanco</p>
                <p className="mt-1 text-2xl font-black text-white">{formatNumber(national?.votos_blancos)}</p>
                <p className="mt-0.5 text-[11px] font-bold text-[#BDB09B]">{formatPercent(national?.porc_votos_blancos)}</p>
              </div>
            </div>
          </Card>

          <section className="order-2 grid grid-cols-1 gap-4 md:grid-cols-3 lg:col-span-12 lg:order-3">
            {topThree.map((candidate, idx) => (
              <Card key={candidate.code} className="overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: candidate.color }} />
                <div className="relative min-h-[260px] overflow-hidden p-4 sm:p-5">
                  {candidate.image && (
                    <img
                      src={candidate.image}
                      alt=""
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      className="pointer-events-none absolute bottom-0 right-0 h-[78%] max-h-[230px] w-auto object-contain opacity-95"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#414E57] via-[#414E57]/80 to-transparent" />
                  <div className="absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-[#414E57]/20 to-transparent" />
                  <div className="relative z-10 max-w-[68%]">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#BDB09B]">
                      Puesto {idx + 1}
                    </span>
                    {idx === 0 ? <Trophy size={20} className="text-[#F1AA41]" /> : <Medal size={20} className="text-[#00B6CD]" />}
                  </div>
                  <h2 className="text-lg font-black leading-tight text-white sm:text-xl">{candidate.name}</h2>
                  <p className="mt-1 text-xs text-[#BDB09B]">{candidate.party}</p>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <p className="text-2xl font-black tabular-nums text-white sm:text-3xl">{formatPercent(candidate.percent)}</p>
                    <p className="pb-1 text-right text-sm font-bold tabular-nums text-[#BDB09B]">{formatNumber(candidate.votes)} votos</p>
                  </div>
                  </div>
                </div>
              </Card>
            ))}
          </section>

          <section className="order-3 lg:col-span-12 lg:order-4">
            <Card className="overflow-hidden border-[#00A4C2]/40 shadow-[0_0_30px_rgba(6,182,212,0.07)]">
              <div className="flex items-center justify-between bg-[#414E57]/50 px-4 py-2">
                <div className="flex items-center gap-2">
                  <Play size={14} className="fill-[#00B6CD] text-[#00B6CD]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#F8F8F7]">Señal en vivo: Telemedellín</span>
                </div>
                <span className="rounded border border-[#F1AA41]/40 bg-[#F1AA41]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#F1AA41]">Live HD</span>
              </div>
              <div className="aspect-video w-full bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src={LIVE_SIGNAL_URL}
                  title="Telemedellín en Vivo"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </Card>
          </section>

          <Card className="order-4 p-4 sm:p-5 lg:col-span-7 lg:order-2">
            <div className="mb-5 flex items-center gap-3">
              <Users size={18} className="text-[#F1AA41]" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Todos los candidatos</h3>
                <p className="text-[10px] uppercase tracking-widest text-[#BDB09B]">Votación nacional y porcentaje</p>
              </div>
            </div>
            <div className="space-y-4 sm:space-y-5">
              {loading && candidates.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#BDB09B]">Cargando resultados...</p>
              ) : candidates.map((candidate, idx) => (
                <CandidateRow key={candidate.code} candidate={candidate} leaderVotes={leaderVotes} rank={idx + 1} />
              ))}
            </div>
          </Card>

          <section className="order-5 lg:col-span-12 lg:order-5">
            <Card className="p-5">
              <div className="mb-5">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Mapa de Colombia por ganador departamental</h3>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-[#BDB09B]">Departamentos coloreados según el candidato líder</p>
              </div>
              <ColombiaMap winnersByDepartment={winnersByDepartment} />
            </Card>
          </section>
        </main>

        <footer className="mx-auto max-w-7xl border-t border-[#414E57]/50 px-4 py-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#BDB09B]">
            Telemedellín Digital · Centro Digital Electoral 2026
          </p>
          <p className="mt-1 text-[10px] text-[#BDB09B]">
            Datos oficiales de preconteo: Registraduría Nacional del Estado Civil. Información no vinculante.
          </p>
        </footer>
      </div>
    </>
  )
}
