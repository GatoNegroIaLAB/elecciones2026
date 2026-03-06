// pages/api/procesar-palabras.js
// Recibe webhook de Apify, descarga dataset y guarda palabras en Supabase

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const STOPWORDS = new Set([
  'de','la','el','en','y','a','los','del','se','las','por','un','para',
  'con','una','su','al','lo','como','más','pero','sus','le','ya','o',
  'este','si','porque','esta','entre','cuando','muy','sin','sobre','ser',
  'que','no','es','son','fue','hay','tiene','han','está','hacer','todo',
  'también','puede','así','bien','hasta','desde','me','te','le','nos',
  'les','mi','tu','su','mis','tus','sus','era','sido','ser','estar',
  'https','http','rt','via','amp','co','www','com','t','s','u','d','p',
  'colombia','colombianos','colombiano','colombiana','elecciones','congreso',
])

function extraerPalabras(texto) {
  if (!texto) return []
  return texto
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/@\w+/g, '')
    .replace(/[^\w\sáéíóúüñ]/gi, ' ')
    .split(/\s+/)
    .filter(p =>
      p.length > 3 &&
      !STOPWORDS.has(p) &&
      !/^\d+$/.test(p) &&
      p.length < 30
    )
}

function extraerHashtags(texto) {
  if (!texto) return []
  const matches = texto.match(/#(\w+)/g) || []
  return matches
    .map(h => h.replace('#', '').toLowerCase())
    .filter(h =>
      h.length > 3 &&
      !STOPWORDS.has(h) &&
      h !== 'elecciones2026' &&
      h !== 'congreso2026' &&
      h !== 'elecciones'
    )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = req.headers['x-apify-token'] || req.query.token
  if (token !== process.env.APIFY_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const fuente = req.query.fuente
  if (!fuente || !['instagram', 'twitter'].includes(fuente)) {
    return res.status(400).json({ error: 'fuente requerida: instagram | twitter' })
  }

  // Obtener datasetId del payload de Apify
  const body = req.body
  const datasetId = body?.resource?.defaultDatasetId

  if (!datasetId) {
    return res.status(400).json({ error: 'No se encontró defaultDatasetId en el payload' })
  }

  // Descargar items del dataset de Apify
  const apifyToken = process.env.APIFY_API_TOKEN
  const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&format=json&limit=1000`

  let items = []
  try {
    const response = await fetch(datasetUrl)
    items = await response.json()
  } catch (e) {
    return res.status(500).json({ error: `Error descargando dataset: ${e.message}` })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(200).json({ ok: true, message: 'Dataset vacío', total: 0 })
  }

  // Contar frecuencias
  const frecuencias = {}

  for (const item of items) {
    let palabras = []

    if (fuente === 'instagram') {
      palabras = [
        ...extraerPalabras(item.caption),
        ...extraerHashtags(item.caption),
        ...(item.hashtags || []).map(h => h.toLowerCase()).filter(h => h.length > 3 && !STOPWORDS.has(h))
      ]
    } else {
      palabras = [
        ...extraerPalabras(item.text),
        ...extraerHashtags(item.text)
      ]
    }

    for (const palabra of palabras) {
      frecuencias[palabra] = (frecuencias[palabra] || 0) + 1
    }
  }

  const palabrasSignificativas = Object.entries(frecuencias)
    .filter(([_, freq]) => freq >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)

  if (palabrasSignificativas.length === 0) {
    return res.status(200).json({ ok: true, message: 'Sin palabras significativas', total: 0 })
  }

  // Upsert en Supabase
  const { error } = await supabase.rpc('upsert_palabras_nube', {
    p_palabras: palabrasSignificativas.map(([palabra, frecuencia]) => ({
      palabra,
      frecuencia,
      fuente
    }))
  })

  if (error) {
    console.error('Supabase error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({
    ok: true,
    fuente,
    palabrasProcesadas: palabrasSignificativas.length,
    totalItemsRecibidos: items.length
  })
}
