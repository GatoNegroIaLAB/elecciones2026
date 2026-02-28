import { useState, useEffect, useMemo, useCallback } from 'react'
import Head from 'next/head'
import {
  Play, RefreshCw, Send, Volume2, Copy, ChevronRight,
  Search, LayoutGrid, Zap, Activity, Smile, Meh, Frown,
  Instagram, Twitter, Table as TableIcon, BarChart3
} from 'lucide-react'
import { supabase, getResultados, getControlAvances, getPartidos, enrichResultados } from '../lib/supabase'

// ── Colores por partido (por código de la Registraduría) ─────────────────────
const PARTIDO_COLORS = {
  '00005': '#ef4444', // Pacto Histórico
  '00028': '#3b82f6', // Conservador
  '00002': '#f87171', // Liberal
  '00025': '#22c55e', // Alianza Verde
  '00020': '#60a5fa', // Centro Democrático
  '00019': '#f59e0b', // Cambio Radical
  '00004': '#fbbf24', // Partido de la U
  '00032': '#a855f7', // Coalición Esperanza
  '00030': '#6366f1', // MIRA
  'default': '#94a3b8'
}

const getColor = (cod) => PARTIDO_COLORS[cod] || PARTIDO_COLORS['default']

const TOTAL_SEATS_SENADO = 108

// ── Helpers ───────────────────────────────────────────────────────────────────
const Badge = ({ children, variant = 'fuchsia' }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
    variant === 'fuchsia'
      ? 'bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30'
      : 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
  }`}>{children}</span>
)

const Card = ({ title, subtitle, children, className = '', icon }) => (
  <div className={`bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm ${className}`}>
    {(title || icon) && (
      <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
        {icon && <span className="text-fuchsia-400">{icon}</span>}
        <div>
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">{title}</h3>
          {subtitle && <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{subtitle}</p>}
        </div>
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
)

// ── Hemiciclo ─────────────────────────────────────────────────────────────────
const Hemiciclo = ({ partidos }) => {
  const seatsPerRow = [14, 18, 22, 26, 28]
  const seatColors = []
  partidos.forEach(p => {
    for (let i = 0; i < (p.curules || 0); i++) {
      if (seatColors.length < TOTAL_SEATS_SENADO) seatColors.push(getColor(p.cod_partido))
    }
  })
  while (seatColors.length < TOTAL_SEATS_SENADO) seatColors.push('#1e293b')

  const dots = []
  let idx = 0
  seatsPerRow.forEach((count, row) => {
    const radius = 60 + row * 30
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (i / (count - 1)) * Math.PI
      const x = 200 + radius * Math.cos(angle)
      const y = 200 + radius * Math.sin(angle)
      dots.push({ x, y, color: seatColors[idx++], key: `${row}-${i}` })
    }
  })

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <svg viewBox="0 0 400 220" className="w-full max-w-lg">
        {dots.map(d => (
          <circle
            key={d.key} cx={d.x} cy={d.y} r="4.5"
            fill={d.color}
            style={{ filter: `drop-shadow(0 0 3px ${d.color})` }}
          />
        ))}
        <rect x="185" y="185" width="30" height="15" rx="2" fill="#334155" />
      </svg>
      <div className="text-center mt-2">
        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Configuración del Senado</p>
        <p className="text-xl font-black text-white tracking-tighter">{TOTAL_SEATS_SENADO} CURULES TOTALES</p>
      </div>
    </div>
  )
}

// ── Función para calcular curules por cifra repartidora (D'Hondt) ─────────────
function calcularCurules(resultados, totalCurules) {
  if (!resultados.length) return []
  const partidos = resultados.map(r => ({ ...r, votos: r.votos_partido || 0 }))
  const quotients = []
  partidos.forEach(p => {
    for (let d = 1; d <= totalCurules; d++) {
      quotients.push({ cod: p.cod_partido, value: p.votos / d })
    }
  })
  quotients.sort((a, b) => b.value - a.value)
  const curules = {}
  quotients.slice(0, totalCurules).forEach(q => {
    curules[q.cod] = (curules[q.cod] || 0) + 1
  })
  return partidos.map(p => ({ ...p, curules: curules[p.cod_partido] || 0 }))
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Home() {
  const [corporacion, setCorporacion]   = useState('SENADO')
  const [resultados, setResultados]     = useState([])
  const [partidos, setPartidos]         = useState([])
  const [control, setControl]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [lastUpdate, setLastUpdate]     = useState(new Date())
  const [searchTerm, setSearchTerm]     = useState('')
  const [messages, setMessages]         = useState([
    { role: 'assistant', text: 'Hola, soy tu asistente de datos. ¿Qué quieres saber sobre los resultados?' }
  ])
  const [inputValue, setInputValue]     = useState('')
  const [tableMode, setTableMode]       = useState('grafico')
  const [isLive, setIsLive]             = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [res, part, ctrl] = await Promise.all([
        getResultados(corporacion),
        getPartidos(),
        getControlAvances()
      ])
      setResultados(enrichResultados(res, part))
      setPartidos(part)
      setControl(ctrl)
      setLastUpdate(new Date())
      setIsLive(res.length > 0)
    } catch (e) {
      console.error('Error fetching data:', e)
    } finally {
      setLoading(false)
    }
  }, [corporacion])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // refresca cada 60s
    return () => clearInterval(interval)
  }, [fetchData])

  // Suscripción en tiempo real vía Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel('avances')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'avances_resultados',
        filter: `corporacion=eq.${corporacion}`
      }, () => fetchData())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [corporacion, fetchData])

  // ── Datos procesados ────────────────────────────────────────────────────────
  const resNacional = useMemo(() =>
    resultados.filter(r => r.tipo_boletin === 'NACIONAL'),
    [resultados]
  )

  const resConCurules = useMemo(() => {
    if (corporacion !== 'SENADO' || !resNacional.length) return resNacional
    return calcularCurules(resNacional, TOTAL_SEATS_SENADO)
  }, [resNacional, corporacion])

  const resOrdenado = useMemo(() =>
    [...resConCurules].sort((a, b) => b.votos_partido - a.votos_partido),
    [resConCurules]
  )

  const resFiltrado = useMemo(() =>
    resOrdenado.filter(r =>
      r.nombre_partido?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 12),
    [resOrdenado, searchTerm]
  )

  const ctrlCorp = control.find(c => c.corporacion === corporacion)
  const totalVotos = resNacional.reduce((s, r) => s + (r.votos_partido || 0), 0)
  const leader = resOrdenado[0]

  // Estadísticas de mesas (del primer registro nacional)
  const statsNac = resNacional[0] || {}
  const pctMesas = statsNac.porc_mesas
    ? parseFloat(statsNac.porc_mesas.replace(',', '.'))
    : 0
  const pctParticipacion = statsNac.potencial_sufragantes
    ? ((statsNac.total_sufragantes / statsNac.potencial_sufragantes) * 100).toFixed(1)
    : '—'

  // ── Brief IA ────────────────────────────────────────────────────────────────
  const briefText = useMemo(() => {
    if (!leader) return 'Esperando datos de la Registraduría...'
    const curules = leader.curules ? ` con ${leader.curules} curules proyectadas` : ''
    return `Análisis: En ${corporacion}, ${leader.nombre_partido} lidera${curules} con ${(leader.votos_partido || 0).toLocaleString('es-CO')} votos. El escrutinio avanza al ${pctMesas.toFixed(2)}% de mesas informadas.`
  }, [leader, corporacion, pctMesas])

  const speak = (text) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-CO'
    window.speechSynthesis.speak(u)
  }

  const handleSend = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    const q = inputValue
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInputValue('')
    setTimeout(() => {
      let resp = ''
      const ql = q.toLowerCase()
      if (ql.includes('lider') || ql.includes('líder') || ql.includes('primero')) {
        resp = leader
          ? `${leader.nombre_partido} lidera con ${(leader.votos_partido||0).toLocaleString('es-CO')} votos.`
          : 'Aún no hay datos disponibles.'
      } else if (ql.includes('mesas')) {
        resp = `Se han informado ${statsNac.mesas_informadas?.toLocaleString('es-CO') || '—'} de ${statsNac.mesas_instaladas?.toLocaleString('es-CO') || '—'} mesas (${pctMesas.toFixed(1)}%).`
      } else if (ql.includes('votos') || ql.includes('total')) {
        resp = `Total de votos válidos: ${totalVotos.toLocaleString('es-CO')}.`
      } else {
        resp = `En ${corporacion}, ${leader?.nombre_partido || '—'} lidera con ${(leader?.votos_partido||0).toLocaleString('es-CO')} votos. Escrutinio al ${pctMesas.toFixed(1)}%.`
      }
      setMessages(prev => [...prev, { role: 'assistant', text: resp }])
      speak(resp)
    }, 500)
  }

  return (
    <>
      <Head>
        <title>Telemedellín · Elecciones 2026 en Vivo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;600;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-fuchsia-500/30"
           style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>

        {/* HEADER */}
        <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="bg-white text-slate-950 font-black px-2 py-1 rounded-md text-xl tracking-tighter">TM</div>
              <div>
                <h1 className="text-base font-bold leading-none">
                  Elecciones 2026 · <span className="text-cyan-400">Resultados en vivo</span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30">
                    <span className={`w-1.5 h-1.5 rounded-full bg-fuchsia-400 ${isLive ? 'animate-pulse-glow' : ''}`} />
                    {isLive ? 'EN VIVO' : 'ESPERANDO DATOS'}
                  </span>
                  <span className="text-[10px] text-slate-500">Fuente: Registraduría Nacional</span>
                  <span className="text-[10px] text-slate-600">·</span>
                  <span className="text-[10px] text-slate-500">{lastUpdate.toLocaleTimeString('es-CO')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Selector de corporación */}
              <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
                {['SENADO','CAMARA','CONSULTAS'].map(c => (
                  <button
                    key={c}
                    onClick={() => setCorporacion(c)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                      corporacion === c ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >{c}</button>
                ))}
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600 text-[11px] font-bold hover:bg-cyan-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                ACTUALIZAR
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-4 space-y-6">

          {/* KPIs */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-fuchsia-500">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Escrutado</p>
              <h2 className="text-3xl font-black text-white mt-1 tabular-nums">{pctMesas.toFixed(2)}%</h2>
              <p className="text-[11px] text-slate-500 mt-1">
                {(statsNac.mesas_informadas || 0).toLocaleString('es-CO')} mesas informadas
              </p>
            </Card>
            <Card className="border-l-4 border-l-cyan-500">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Votos Válidos</p>
              <h2 className="text-3xl font-black text-white mt-1 tabular-nums">
                {totalVotos > 0 ? (totalVotos / 1_000_000).toFixed(2) + 'M' : '—'}
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">Nacional</p>
            </Card>
            <Card className="border-l-4 border-l-slate-500">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Participación</p>
              <h2 className="text-3xl font-black text-white mt-1 tabular-nums">{pctParticipacion}%</h2>
              <p className="text-[11px] text-slate-500 mt-1">
                Avance {ctrlCorp?.ultimo_avance_num ?? '—'}
              </p>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Líder</p>
              <h2 className="text-base font-black text-white mt-1 leading-tight truncate">
                {leader?.nombre_partido || (loading ? 'Cargando...' : 'Sin datos')}
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">
                {leader?.curules ? `${leader.curules} curules` : leader ? `${(leader.votos_partido||0).toLocaleString('es-CO')} votos` : '—'}
              </p>
            </Card>
          </section>

          {/* SEÑAL EN VIVO */}
          <section>
            <Card className="p-0 border-cyan-500/30 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.07)]">
              <div className="bg-slate-800/50 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play size={14} className="text-cyan-400 fill-cyan-400" />
                  <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Señal en Vivo: Telemedellín</span>
                </div>
                <Badge variant="fuchsia">Live HD</Badge>
              </div>
              <div className="aspect-video w-full bg-black">
                <iframe
                  width="100%" height="100%"
                  src="https://www.youtube.com/embed/B0OF-ovhdHY?autoplay=0&mute=0&rel=0&modestbranding=1"
                  title="Telemedellín en Vivo"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </Card>
          </section>

          {/* RANKING + IA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <Card title={`Ranking de Listas — ${corporacion}`}>
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={15} />
                    <input
                      type="text"
                      placeholder="Buscar partido..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                    Cargando resultados...
                  </div>
                ) : resFiltrado.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm gap-2">
                    <span>Sin datos disponibles</span>
                    <span className="text-xs">Los datos aparecerán cuando inicie el conteo</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {resFiltrado.map((item, idx) => {
                      const pct = resOrdenado[0]?.votos_partido
                        ? (item.votos_partido / resOrdenado[0].votos_partido) * 100
                        : 0
                      return (
                        <div key={item.cod_partido} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-200">{idx + 1}. {item.nombre_partido}</span>
                            <span className="text-slate-400 tabular-nums">
                              {(item.votos_partido || 0).toLocaleString('es-CO')} votos
                              {item.curules != null ? ` · ${item.curules} cur.` : ''}
                            </span>
                          </div>
                          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-1000"
                              style={{ width: `${pct}%`, backgroundColor: getColor(item.cod_partido) }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>

            <div className="lg:col-span-5 space-y-6">
              {/* BRIEF IA */}
              <div className="bg-gradient-to-br from-fuchsia-600 to-cyan-600 p-[1px] rounded-xl">
                <div className="bg-slate-900 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={15} className="text-fuchsia-400" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-widest">Brief IA</h3>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => speak(briefText)} className="p-1.5 hover:bg-white/10 rounded-md text-slate-400"><Volume2 size={15} /></button>
                      <button onClick={() => navigator.clipboard?.writeText(briefText)} className="p-1.5 hover:bg-white/10 rounded-md text-slate-400"><Copy size={15} /></button>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm leading-relaxed text-slate-300 italic">"{briefText}"</p>
                  </div>
                </div>
              </div>

              {/* ASISTENTE */}
              <Card title="Asistente de Datos">
                <div className="h-[260px] flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 text-slate-200 border border-slate-700'
                        }`}>{m.text}</div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSend} className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="¿Quién va primero? ¿Cuántas mesas?..."
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <button type="submit" className="p-2 bg-fuchsia-600 rounded-lg hover:bg-fuchsia-500 transition-colors">
                      <Send size={15} />
                    </button>
                  </form>
                </div>
              </Card>
            </div>
          </div>

          {/* HEMICICLO — solo para Senado */}
          {corporacion === 'SENADO' && (
            <section>
              <Card>
                <div className="flex flex-col md:flex-row items-center justify-between mb-6 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="text-fuchsia-400" size={20} />
                    <div>
                      <h3 className="font-bold text-base text-white">CONFORMACIÓN DEL SENADO</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Distribución de Escaños — Cifra Repartidora</p>
                    </div>
                  </div>
                  <div className="mt-3 md:mt-0 flex gap-1 bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => setTableMode('grafico')} className={`px-4 py-1.5 text-[10px] rounded-md font-bold transition-all ${tableMode==='grafico' ? 'bg-slate-700 text-cyan-400' : 'text-slate-500'}`}>GRÁFICO</button>
                    <button onClick={() => setTableMode('tabla')} className={`px-4 py-1.5 text-[10px] rounded-md font-bold transition-all ${tableMode==='tabla' ? 'bg-slate-700 text-cyan-400' : 'text-slate-500'}`}>TABLA</button>
                  </div>
                </div>

                {tableMode === 'grafico' ? (
                  loading || !resConCurules.length ? (
                    <div className="flex items-center justify-center h-60 text-slate-500 text-sm">
                      {loading ? 'Calculando curules...' : 'Sin datos para mostrar el hemiciclo'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      <div className="lg:col-span-7 bg-slate-950/30 rounded-2xl border border-slate-800/50">
                        <Hemiciclo partidos={resConCurules} />
                      </div>
                      <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[...resConCurules].sort((a,b)=>b.curules-a.curules).map(p => (
                          <div key={p.cod_partido} className="flex items-center justify-between p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getColor(p.cod_partido) }} />
                              <p className="text-[11px] font-semibold text-slate-200 truncate max-w-[90px]">{p.nombre_partido}</p>
                            </div>
                            <span className="text-base font-black text-white tabular-nums">{p.curules || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase font-bold">
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Partido</th>
                          <th className="px-4 py-3 text-right">Votos</th>
                          <th className="px-4 py-3 text-right">%</th>
                          <th className="px-4 py-3 text-right">Curules</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...resConCurules].sort((a,b)=>b.curules-a.curules).map((p, i) => (
                          <tr key={p.cod_partido} className="border-b border-slate-900/50 hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3 text-slate-500">{i+1}</td>
                            <td className="px-4 py-3 font-semibold flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(p.cod_partido) }} />
                              {p.nombre_partido}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                              {(p.votos_partido||0).toLocaleString('es-CO')}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                              {totalVotos ? ((p.votos_partido/totalVotos)*100).toFixed(2) : '0.00'}%
                            </td>
                            <td className="px-4 py-3 text-right font-black text-cyan-400 text-base tabular-nums">
                              {p.curules || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </section>
          )}

          {/* MONITOR DE SENTIMIENTO — placeholder visual */}
          <section className="pb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Activity className="text-emerald-400" size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">MONITOR DE SENTIMIENTO (IA)</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Análisis de Percepción en Redes Sociales</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {['instagram','twitter'].map(tipo => (
                <div key={tipo} className={`bg-slate-900/50 border rounded-xl p-5 ${tipo==='instagram' ? 'border-fuchsia-500/20' : 'border-cyan-500/20'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${tipo==='instagram' ? 'bg-fuchsia-500/10' : 'bg-cyan-500/10'}`}>
                        {tipo==='instagram'
                          ? <Instagram size={18} className="text-fuchsia-400" />
                          : <Twitter size={18} className="text-cyan-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200 capitalize">{tipo} Analytics</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Próximamente</p>
                      </div>
                    </div>
                    <Badge variant={tipo==='instagram' ? 'fuchsia' : 'cyan'}>IA Monitor</Badge>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-slate-700 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-xs text-slate-500 italic">El monitor de sentimiento estará disponible durante el día de elecciones.</p>
                </div>
              ))}
            </div>
          </section>

        </main>

        <footer className="max-w-7xl mx-auto px-4 py-8 text-center border-t border-slate-800/50">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-600">
            Telemedellín Digital · Centro de Mando Electoral 2026
          </p>
          <p className="text-[10px] text-slate-700 mt-1">
            Datos oficiales: Registraduría Nacional del Estado Civil
          </p>
        </footer>

      </div>
    </>
  )
}
