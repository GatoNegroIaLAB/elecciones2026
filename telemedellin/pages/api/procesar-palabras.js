// pages/api/procesar-palabras.js
// Recibe webhook de Apify (Instagram o Twitter) y guarda palabras en Supabase

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // usar service key para writes desde servidor
)

// Stopwords en español
const STOPWORDS = new Set([
  'de','la','el','en','y','a','los','del','se','las','por','un','para',
  'con','una','su','al','lo','como','más','pero','sus','le','ya','o',
  'este','si','porque','esta','entre','cuando','muy','sin','sobre','ser',
  'que','no','es','son','fue','hay','tiene','han','está','hacer','todo',
  'también','puede','así','bien','hasta','desde','me','te','le','nos',
  'les','mi','tu','su','mis','tus','sus','era','sido','ser','estar',
  'https','http','rt','via','amp','co','www','com','t','s','u','d',
  'colombia','colombianos','colombiano','colombiana',
])

// Extraer palabras limpias de un texto
function extraerPalabras(texto) {
  if (!texto) return []

  return texto
    .toLowerCase()
    // Eliminar URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Eliminar menciones @usuario
    .replace(/@\w+/g, '')
    // Eliminar emojis y caracteres especiales
    .replace(/[^\w\sáéíóúüñ]/gi, ' ')
    // Normalizar espacios
    .split(/\s+/)
    // Filtrar palabras cortas, stopwords y números
    .filter(p => 
      p.length > 3 && 
      !STOPWORDS.has(p) && 
      !/^\d+$/.test(p) &&
      p.length < 30
    )
}

// Extraer hashtags limpios
function extraerHashtags(texto) {
  if (!texto) return []
  const matches = texto.match(/#(\w+)/g) || []
  return matches
    .map(h => h.replace('#', '').toLowerCase())
    .filter(h => 
      h.length > 3 && 
      !STOPWORDS.has(h) &&
      h !== 'elecciones2026' && // muy genérico
      h !== 'congreso2026'
    )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validar token
  const token = req.headers['x-apify-token'] || req.query.token
  if (token !== process.env.APIFY_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  // Determinar fuente: 'instagram' o 'twitter'
  const fuente = req.query.fuente
  if (!fuente || !['instagram', 'twitter'].includes(fuente)) {
    return res.status(400).json({ error: 'fuente requerida: instagram | twitter' })
  }

  const items = req.body
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Body debe ser array de items' })
  }

  // Contar frecuencias de palabras
  const frecuencias = {}

  for (const item of items) {
    let palabras = []

    if (fuente === 'instagram') {
      // Instagram: caption + hashtags array
      palabras = [
        ...extraerPalabras(item.caption),
        ...extraerHashtags(item.caption),
        ...(item.hashtags || []).map(h => h.toLowerCase()).filter(h => h.length > 3)
      ]
    } else {
      // Twitter: text
      palabras = [
        ...extraerPalabras(item.text),
        ...extraerHashtags(item.text)
      ]
    }

    for (const palabra of palabras) {
      frecuencias[palabra] = (frecuencias[palabra] || 0) + 1
    }
  }

  // Filtrar palabras con al menos 2 menciones
  const palabrasSignificativas = Object.entries(frecuencias)
    .filter(([_, freq]) => freq >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100) // máximo 100 palabras por run

  if (palabrasSignificativas.length === 0) {
    return res.status(200).json({ ok: true, message: 'Sin palabras significativas', total: 0 })
  }

  // Upsert en Supabase — suma frecuencias existentes
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
