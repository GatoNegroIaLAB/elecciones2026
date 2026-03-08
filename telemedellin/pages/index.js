import { useState, useEffect, useMemo, useCallback } from 'react'
import Head from 'next/head'
import {
 Play, Send, Volume2, Copy, ChevronRight,
 Search, LayoutGrid, Zap, Activity, Cloud,
 Instagram, Twitter, Table as TableIcon, BarChart3
} from 'lucide-react'
import { supabase, getResultados, getControlAvances, getPartidos, enrichResultados, getCandidatos } from '../lib/supabase'

const DEFAULT_COLOR = '#414E57'

const TOTAL_SEATS_SENADO = 108

// ── Helpers ───────────────────────────────────────────────────────────────────
const Badge = ({ children, variant = 'fuchsia' }) => (
 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
 variant === 'fuchsia'
 ? 'bg-[#F1AA41]/20 text-[#F1AA41] border border-[#F1AA41]/40'
 : 'bg-[#0084B4]/20 text-[#00B6CD] border border-[#00A4C2]/40'
 }`}>{children}</span>
)

const Card = ({ title, subtitle, children, className = '', icon }) => (
 <div className={`bg-[#414E57]/55 border border-[#414E57] rounded-xl overflow-hidden backdrop-blur-sm ${className}`}>
 {(title || icon) && (
 <div className="px-5 py-4 border-b border-[#414E57] flex items-center gap-3">
 {icon && <span className="text-[#F1AA41]">{icon}</span>}
 <div>
 <h3 className="text-xs font-bold text-[#F8F8F7] uppercase tracking-widest">{title}</h3>
 {subtitle && <p className="text-[10px] text-[#BDB09B] uppercase tracking-widest mt-0.5">{subtitle}</p>}
 </div>
 </div>
 )}
 <div className="p-5">{children}</div>
 </div>
)

// ── Hemiciclo ─────────────────────────────────────────────────────────────────
const Hemiciclo = ({ partidos, getColor }) => {
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
 <p className="text-[10px] uppercase font-bold text-[#BDB09B] tracking-widest">Configuración del Senado</p>
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
 const [corporacion, setCorporacion] = useState('SENADO')
 const [resultados, setResultados] = useState([])
 const [partidos, setPartidos] = useState([])

 const getColor = useCallback((cod) => {
 const partido = partidos.find(p => p.codigo === cod)
 return partido?.color_hex || DEFAULT_COLOR
 }, [partidos])

 const getNombre = useCallback((cod) => {
 const partido = partidos.find(p => p.codigo === cod)
 return partido?.nombre || cod
 }, [partidos])

 const [control, setControl] = useState([])
 const [loading, setLoading] = useState(true)
 const [lastUpdate, setLastUpdate] = useState(new Date())
 const [searchTerm, setSearchTerm] = useState('')
 const [messages, setMessages] = useState([
 { role: 'assistant', text: 'Hola, soy tu asistente de datos. ¿Qué quieres saber sobre los resultados?' }
 ])
 const [inputValue, setInputValue] = useState('')
 const [tableMode, setTableMode] = useState('grafico')
 const [isLive, setIsLive] = useState(false)
 const [candidatos, setCandidatos] = useState([])
 const [palabrasInstagram, setPalabrasInstagram] = useState([])
 const [palabrasTwitter, setPalabrasTwitter] = useState([])

 const fetchPalabras = useCallback(async () => {
 try {
 const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
 const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
 const headers = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
 const [igRes, twRes] = await Promise.all([
 fetch(`${SUPA_URL}/rest/v1/palabras_nube?fuente=eq.instagram&activa=eq.true&order=frecuencia.desc&limit=60&select=palabra,frecuencia`, { headers }),
 fetch(`${SUPA_URL}/rest/v1/palabras_nube?fuente=eq.twitter&activa=eq.true&order=frecuencia.desc&limit=60&select=palabra,frecuencia`, { headers })
 ])
 const ig = await igRes.json()
 const tw = await twRes.json()
 if (Array.isArray(ig)) setPalabrasInstagram(ig)
 if (Array.isArray(tw)) setPalabrasTwitter(tw)
 } catch(e) { console.error('Error fetching palabras:', e) }
 }, [])

 useEffect(() => {
 fetchPalabras()
 const interval = setInterval(fetchPalabras, 60000)
 return () => clearInterval(interval)
 }, [fetchPalabras])

 useEffect(() => {
 const sendHeight = () => {
 const h = Math.max(
 document.documentElement?.scrollHeight || 0,
 document.body?.scrollHeight || 0
 )
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

 const fetchData = useCallback(async () => {
 try {
 setLoading(true)
 const [res, part, ctrl, cands] = await Promise.all([
 getResultados(corporacion),
 getPartidos(),
 getControlAvances(),
 getCandidatos()
 ])
 setResultados(enrichResultados(res, part))
 setPartidos(part)
 setControl(ctrl)
 setLastUpdate(new Date())
 setIsLive(res.length > 0)
 setCandidatos(cands)
 } catch (e) {
 console.error('Error fetching data:', e)
 } finally {
 setLoading(false)
 }
 }, [corporacion])

 const LIVE_MODE = true // Activado para simulacro/elecciones

 useEffect(() => {
 if (!LIVE_MODE) {
 fetchData() // carga datos una sola vez
 return
 }

 fetchData()
 const interval = setInterval(fetchData, 60000)
 return () => clearInterval(interval)
 }, [fetchData])

 // Suscripción en tiempo real vía Supabase Realtime
 useEffect(() => {
 if (!LIVE_MODE) return

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
 getNombre(r.cod_partido).toLowerCase().includes(searchTerm.toLowerCase())
 ).slice(0, 12),
 [resOrdenado, searchTerm, getNombre]
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
 return `Análisis: En ${corporacion}, ${getNombre(leader.cod_partido)} lidera${curules} con ${(leader.votos_partido || 0).toLocaleString('es-CO')} votos. El escrutinio avanza al ${pctMesas.toFixed(2)}% de mesas informadas.`
 }, [leader, corporacion, pctMesas, getNombre])

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
 ? `${getNombre(leader.cod_partido)} lidera con ${(leader.votos_partido||0).toLocaleString('es-CO')} votos.`
 : 'Aún no hay datos disponibles.'
 } else if (ql.includes('mesas')) {
 resp = `Se han informado ${statsNac.mesas_informadas?.toLocaleString('es-CO') || '—'} de ${statsNac.mesas_instaladas?.toLocaleString('es-CO') || '—'} mesas (${pctMesas.toFixed(1)}%).`
 } else if (ql.includes('votos') || ql.includes('total')) {
 resp = `Total de votos válidos: ${totalVotos.toLocaleString('es-CO')}.`
 } else {
 resp = `En ${corporacion}, ${leader ? getNombre(leader.cod_partido) : '—'} lidera con ${(leader?.votos_partido||0).toLocaleString('es-CO')} votos. Escrutinio al ${pctMesas.toFixed(1)}%.`
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

 <div className="min-h-screen text-[#F8F8F7] selection:bg-[#F1AA41]/30"
 style={{ fontFamily: "'IBM Plex Sans', sans-serif", backgroundColor: 'transparent' }}>

 {/* HEADER */}
 <header className="sticky top-0 z-50 bg-[#000000]/90 backdrop-blur-md border-b border-[#414E57] px-4 py-3">
 <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
 <div className="flex items-center gap-4">

 <div>
 <h1 className="text-base font-bold leading-none">
 Elecciones 2026 · <span className="text-[#00B6CD]">Resultados en vivo</span>
 </h1>
 <div className="flex items-center gap-2 mt-1">
 <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1AA41]/20 text-[#F1AA41] border border-[#F1AA41]/40">
 <span className={`w-1.5 h-1.5 rounded-full bg-[#F1AA41] ${isLive ? 'animate-pulse-glow' : ''}`} />
 {isLive ? 'EN VIVO' : 'ESPERANDO DATOS'}
 </span>
 <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wide uppercase bg-[#F1AA41]/15 text-[#F8F8F7] border border-[#F1AA41]/50">
 Registraduría Nacional
 </span>
 <span className="text-[10px] text-[#F1AA41] font-bold">·</span>
 <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-[#00629E]/35 text-[#F8F8F7] border border-[#00A4C2]/40">
 Hora: {lastUpdate.toLocaleTimeString('es-CO')}
 </span>
 </div>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {/* Selector de corporación */}
 <div className="flex gap-1 bg-[#414E57] p-1 rounded-lg">
 {['SENADO','CAMARA','CONSULTAS'].map(c => (
 <button
 key={c}
 onClick={() => setCorporacion(c)}
 className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
 corporacion === c ? 'bg-[#0084B4] text-white' : 'text-[#BDB09B] hover:text-[#F8F8F7]'
 }`}
 >{c}</button>
 ))}
 </div>
 </div>
 </div>
 </header>

 <main className="max-w-7xl mx-auto p-4 space-y-6">

 {/* KPIs */}
 <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card className="border-l-4 border-l-[#F1AA41]">
 <p className="text-[10px] text-[#BDB09B] font-bold uppercase tracking-widest">Escrutado</p>
 <h2 className="text-3xl font-black text-white mt-1 tabular-nums">{pctMesas.toFixed(2)}%</h2>
 <p className="text-[11px] text-[#BDB09B] mt-1">
 {(statsNac.mesas_informadas || 0).toLocaleString('es-CO')} mesas informadas
 </p>
 </Card>
 <Card className="border-l-4 border-l-[#00B6CD]">
 <p className="text-[10px] text-[#BDB09B] font-bold uppercase tracking-widest">Votos Válidos</p>
 <h2 className="text-3xl font-black text-white mt-1 tabular-nums">
 {totalVotos > 0 ? (totalVotos / 1_000_000).toFixed(2) + 'M' : '—'}
 </h2>
 <p className="text-[11px] text-[#BDB09B] mt-1">Nacional</p>
 </Card>
 <Card className="border-l-4 border-l-[#414E57]">
 <p className="text-[10px] text-[#BDB09B] font-bold uppercase tracking-widest">Participación</p>
 <h2 className="text-3xl font-black text-white mt-1 tabular-nums">{pctParticipacion}%</h2>
 <p className="text-[11px] text-[#BDB09B] mt-1">
 Avance {ctrlCorp?.ultimo_avance_num ?? '—'}
 </p>
 </Card>
 <Card className="border-l-4 border-l-yellow-500">
 <p className="text-[10px] text-[#BDB09B] font-bold uppercase tracking-widest">Líder</p>
 <h2 className="text-base font-black text-white mt-1 leading-tight truncate">
 {leader ? getNombre(leader.cod_partido) : (loading ? 'Cargando...' : 'Sin datos')}
 </h2>
 <p className="text-[11px] text-[#BDB09B] mt-1">
 {leader?.curules ? `${leader.curules} curules` : leader ? `${(leader.votos_partido||0).toLocaleString('es-CO')} votos` : '—'}
 </p>
 </Card>
 </section>

 {/* SEÑAL EN VIVO */}
 <section>
 <Card className="p-0 border-[#00A4C2]/40 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.07)]">
 <div className="bg-[#414E57]/50 px-4 py-2 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Play size={14} className="text-[#00B6CD] fill-[#00B6CD]" />
 <span className="text-[10px] font-black uppercase text-[#F8F8F7] tracking-widest">Señal en Vivo: Telemedellín</span>
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

 {/* CONSULTAS — 3 cards una por consulta */}
 {corporacion === 'CONSULTAS' && (() => {
 const CONSULTAS_DEF = [
 { cod: '00100', label: 'Consulta de las Soluciones', color: '#F1AA41' },
 { cod: '00200', label: 'La Gran Consulta por Colombia', color: '#00A4C2' },
 { cod: '00300', label: 'Frente por la Vida', color: '#A42EFF' },
 ]
 return (
 <section>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {CONSULTAS_DEF.map(({ cod, label, color }) => {
 const cands = resultados
 .filter(r => r.cod_partido === cod && r.cod_candidato !== '000')
 .sort((a, b) => b.votos_partido - a.votos_partido)
 const totalConsulta = cands.reduce((s, c) => s + (c.votos_partido || 0), 0)
 const lider = cands[0]
 const stats = resultados.find(r => r.cod_partido === cod) || {}
 return (
 <div key={cod} className="bg-[#414E57]/55 border border-[#414E57] rounded-xl overflow-hidden backdrop-blur-sm">
 <div className="px-4 py-3 border-b border-[#414E57]" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
 <p className="text-[10px] font-bold text-[#BDB09B] uppercase tracking-widest">Consulta</p>
 <h3 className="text-xs font-black text-white mt-0.5 leading-tight">{label}</h3>
 <p className="text-[10px] text-[#BDB09B] mt-1">
 {stats.porc_mesas ? `${parseFloat(stats.porc_mesas).toFixed(1)}% mesas` : '—'}
 {' · '}{totalConsulta.toLocaleString('es-CO')} votos
 </p>
 </div>
 <div className="p-4 space-y-3">
 {loading ? (
 <p className="text-[#BDB09B] text-xs text-center py-4">Cargando...</p>
 ) : cands.length === 0 ? (
 <p className="text-[#BDB09B] text-xs text-center py-4">Sin datos aún</p>
 ) : cands.map((c, idx) => {
 const cand = candidatos.find(x => x.cod_partido === cod && x.cod_candidato === c.cod_candidato)
 const nombre = cand ? `${cand.nombre} ${cand.apellido}` : `Candidato ${c.cod_candidato}`
 const pct = totalConsulta > 0 ? (c.votos_partido / totalConsulta) * 100 : 0
 return (
 <div key={c.cod_candidato} className="space-y-1">
 <div className="flex justify-between text-xs">
 <span className="text-[#F8F8F7] font-medium truncate max-w-[60%]">{idx + 1}. {nombre}</span>
 <span className="text-[#BDB09B] tabular-nums">{pct.toFixed(1)}%</span>
 </div>
 <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
 <div className="h-full rounded-full transition-all duration-1000"
 style={{ width: `${pct}%`, backgroundColor: color }} />
 </div>
 <p className="text-[10px] text-[#BDB09B]">{(c.votos_partido || 0).toLocaleString('es-CO')} votos</p>
 </div>
 )
 })}
 </div>
 </div>
 )
 })}
 </div>
 </section>
 )
 })()}

 {/* RANKING + IA */}
 {corporacion !== 'CONSULTAS' && (<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
 <div className="lg:col-span-7 space-y-6">
 <Card title={`Ranking de Listas — ${corporacion}`}>
 <div className="flex flex-col sm:flex-row gap-3 mb-6">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-2.5 text-[#BDB09B]" size={15} />
 <input
 type="text"
 placeholder="Buscar partido..."
 value={searchTerm}
 onChange={e => setSearchTerm(e.target.value)}
 className="w-full bg-[#414E57] border border-[#414E57] rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#00A4C2]"
 />
 </div>
 </div>

 {loading ? (
 <div className="flex items-center justify-center h-40 text-[#BDB09B] text-sm">
 Cargando resultados...
 </div>
 ) : resFiltrado.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-40 text-[#BDB09B] text-sm gap-2">
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
 <span className="text-[#F8F8F7]">{idx + 1}. {getNombre(item.cod_partido)}</span>
 <span className="text-[#BDB09B] tabular-nums">
 {(item.votos_partido || 0).toLocaleString('es-CO')} votos
 {item.curules != null ? ` · ${item.curules} cur.` : ''}
 </span>
 </div>
 <div className="h-3 bg-[#414E57] rounded-full overflow-hidden">
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
 <div className="bg-gradient-to-br from-[#00629E] to-[#00A4C2] p-[1px] rounded-xl">
 <div className="bg-[#414E57] rounded-xl overflow-hidden">
 <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Zap size={15} className="text-[#F1AA41]" />
 <h3 className="text-xs font-bold text-white uppercase tracking-widest">Brief IA</h3>
 </div>
 <div className="flex gap-1">
 <button onClick={() => speak(briefText)} className="p-1.5 hover:bg-white/10 rounded-md text-[#BDB09B]"><Volume2 size={15} /></button>
 <button onClick={() => navigator.clipboard?.writeText(briefText)} className="p-1.5 hover:bg-white/10 rounded-md text-[#BDB09B]"><Copy size={15} /></button>
 </div>
 </div>
 <div className="p-4">
 <p className="text-sm leading-relaxed text-[#F8F8F7] italic">"{briefText}"</p>
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
 ? 'bg-[#0084B4] text-white'
 : 'bg-[#414E57] text-[#F8F8F7] border border-[#414E57]'
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
 className="flex-1 bg-[#414E57] border border-[#414E57] rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[#00A4C2]"
 />
 <button type="submit" className="p-2 bg-[#F1AA41] rounded-lg hover:bg-[#F1AA41]/90 transition-colors">
 <Send size={15} />
 </button>
 </form>
 </div>
 </Card>
 </div>
 </div>)}

 {/* HEMICICLO — solo para Senado */}
 {corporacion === 'SENADO' && (
 <section>
 <Card>
 <div className="flex flex-col md:flex-row items-center justify-between mb-6 border-b border-[#414E57] pb-4">
 <div className="flex items-center gap-3">
 <LayoutGrid className="text-[#F1AA41]" size={20} />
 <div>
 <h3 className="font-bold text-base text-white">POSIBLE CONFORMACIÓN DEL SENADO</h3>
 <p className="text-[10px] text-[#BDB09B] uppercase tracking-widest">Distribución de Escaños — Cifra Repartidora</p>
 </div>
 </div>
 <div className="mt-3 md:mt-0 flex gap-1 bg-[#414E57] p-1 rounded-lg">
 <button onClick={() => setTableMode('grafico')} className={`px-4 py-1.5 text-[10px] rounded-md font-bold transition-all ${tableMode==='grafico' ? 'bg-[#00629E] text-[#00B6CD]' : 'text-[#BDB09B]'}`}>GRÁFICO</button>
 <button onClick={() => setTableMode('tabla')} className={`px-4 py-1.5 text-[10px] rounded-md font-bold transition-all ${tableMode==='tabla' ? 'bg-[#00629E] text-[#00B6CD]' : 'text-[#BDB09B]'}`}>TABLA</button>
 </div>
 </div>

 {tableMode === 'grafico' ? (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
 <div className="lg:col-span-7 bg-[#000000]/30 rounded-2xl border border-[#414E57]/50">
 <Hemiciclo partidos={resConCurules || []} getColor={getColor} />
 </div>
 <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
 {!resConCurules.length ? (
 <div className="col-span-2 flex items-center justify-center h-32 text-[#BDB09B] text-sm border border-[#414E57] rounded-xl bg-[#414E57]/40">
 {loading ? 'Calculando curules...' : 'Sin datos aún, mostrando hemiciclo base'}
 </div>
 ) : (
 [...resConCurules].sort((a,b)=>b.curules-a.curules).map(p => (
 <div key={p.cod_partido} className="flex items-center justify-between p-3 bg-[#414E57]/80 border border-[#414E57] rounded-xl">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getColor(p.cod_partido) }} />
 <p className="text-[11px] font-semibold text-[#F8F8F7] truncate max-w-[90px]">{getNombre(p.cod_partido)}</p>
 </div>
 <span className="text-base font-black text-white tabular-nums">{p.curules || 0}</span>
 </div>
 ))
 )}
 </div>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse text-sm">
 <thead>
 <tr className="border-b border-[#414E57] text-[10px] text-[#BDB09B] uppercase font-bold">
 <th className="px-4 py-3">#</th>
 <th className="px-4 py-3">Partido</th>
 <th className="px-4 py-3 text-right">Votos</th>
 <th className="px-4 py-3 text-right">%</th>
 <th className="px-4 py-3 text-right">Curules</th>
 </tr>
 </thead>
 <tbody>
 {[...resConCurules].sort((a,b)=>b.curules-a.curules).map((p, i) => (
 <tr key={p.cod_partido} className="border-b border-[#414E57]/50 hover:bg-[#414E57]/30 transition-colors">
 <td className="px-4 py-3 text-[#BDB09B]">{i+1}</td>
 <td className="px-4 py-3 font-semibold flex items-center gap-2">
 <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(p.cod_partido) }} />
 {getNombre(p.cod_partido)}
 </td>
 <td className="px-4 py-3 text-right tabular-nums text-[#F8F8F7]">
 {(p.votos_partido||0).toLocaleString('es-CO')}
 </td>
 <td className="px-4 py-3 text-right tabular-nums text-[#BDB09B]">
 {totalVotos ? ((p.votos_partido/totalVotos)*100).toFixed(2) : '0.00'}%
 </td>
 <td className="px-4 py-3 text-right font-black text-[#00B6CD] text-base tabular-nums">
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

 {/* CONVERSACIÓN EN REDES — nube de palabras */}
 <section className="pb-10">
 <div className="flex items-center gap-3 mb-5">
 <div className="p-2 bg-[#F1AA41]/10 rounded-lg">
 <Cloud className="text-[#F1AA41]" size={18} />
 </div>
 <div>
 <h3 className="font-bold text-base text-white">CONVERSACIÓN EN REDES</h3>
 <p className="text-[10px] text-[#BDB09B] uppercase tracking-widest">Palabras más mencionadas en Instagram y X</p>
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 {[
 { tipo: 'instagram', palabras: palabrasInstagram, color: '#F1AA41', borderColor: 'border-[#F1AA41]/30', bgColor: 'bg-[#F1AA41]/10', label: 'Instagram' },
 { tipo: 'twitter', palabras: palabrasTwitter, color: '#00B6CD', borderColor: 'border-[#00A4C2]/30', bgColor: 'bg-[#00A4C2]/10', label: 'X (Twitter)' }
 ].map(({ tipo, palabras, color, borderColor, bgColor, label }) => (
 <div key={tipo} className={`bg-[#414E57]/55 border rounded-xl p-5 ${borderColor}`}>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-lg ${bgColor}`}>
 {tipo === 'instagram'
 ? <Instagram size={18} className="text-[#F1AA41]" />
 : <Twitter size={18} className="text-[#00B6CD]" />}
 </div>
 <div>
 <p className="text-sm font-bold text-[#F8F8F7]">{label}</p>
 <p className="text-[10px] text-[#BDB09B] uppercase tracking-widest">{palabras.length} palabras trending</p>
 </div>
 </div>
 <Badge variant={tipo === 'instagram' ? 'fuchsia' : 'cyan'}>En vivo</Badge>
 </div>
 {palabras.length === 0 ? (
 <div className="flex items-center justify-center h-40 text-[#BDB09B]">
 <p className="text-xs uppercase tracking-widest">Sin datos aún...</p>
 </div>
 ) : (
 <div className="flex flex-wrap gap-2 justify-center items-center min-h-[160px] p-2">
 {palabras.map((item, i) => {
 const colors = tipo === 'instagram'
 ? ['#F1AA41','#F5C06A','#E8940F','#FDD78A','#D4820A','#FAC84E','#C97A00','#FFE0A0']
 : ['#00B6CD','#00A4C2','#22d3ee','#67e8f9','#0891b2','#a5f3fc','#0e7490','#06b6d4'];
 const maxFreq = Math.max(...palabras.map(p => p.frecuencia));
 const minFreq = Math.min(...palabras.map(p => p.frecuencia));
 const normalized = maxFreq === minFreq ? 0.5 : (item.frecuencia - minFreq) / (maxFreq - minFreq);
 const fontSize = Math.round(10 + normalized * 26);
 return (
 <span
 key={item.palabra}
 style={{ fontSize: `${fontSize}px`, color: colors[i % colors.length] }}
 className="font-bold leading-tight hover:opacity-70 transition-opacity cursor-default select-none"
 title={`${item.palabra}: ${item.frecuencia} menciones`}
 >
 {item.palabra}
 </span>
 );
 })}
 </div>
 )}
 </div>
 ))}
 </div>
 </section>

 </main>

 <footer className="max-w-7xl mx-auto px-4 py-8 text-center border-t border-[#414E57]/50">
 <p className="text-[10px] uppercase font-bold tracking-widest text-[#BDB09B]">
 Telemedellín Digital · Centro Digital Electoral 2026
 </p>
 <p className="text-[10px] text-[#BDB09B] mt-1">
 Datos oficiales: Registraduría Nacional del Estado Civil
 </p>
 </footer>

 </div>
 </>
 )
}