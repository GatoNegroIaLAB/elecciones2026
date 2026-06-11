import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const PARTY_COLORS = {
  '00009': '#1A3A6B',
  '00015': '#4A9A5A',
  '00020': '#C0252A',
  '00021': '#5A7A3A',
  '00022': '#C06040',
  '00026': '#6B2D8B',
  '01001': '#D4A017',
  '01002': '#B02020',
  '01003': '#DA7100',
  '01004': '#2A7A4A',
  '01005': '#3A8A6A',
  '01006': '#1E6A98',
  '03001': '#2C6FA8',
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const env = {}
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator === -1) continue

    const key = line.slice(0, separator)
    let value = line.slice(separator + 1)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (value) env[key] = value
  }
  return env
}

const localEnv = {
  ...readEnvFile(path.join(rootDir, '.env.production.local')),
  ...readEnvFile(path.join(rootDir, '.env.local')),
  ...process.env,
}

function requireEnv(key) {
  const value = localEnv[key]
  if (!value) throw new Error(`Missing ${key}`)
  return value
}

function resolveBundledBasicsDir() {
  const baseDir = path.join(rootDir, 'data', 'registraduria-basics')
  if (!fs.existsSync(baseDir)) {
    throw new Error(`Missing bundled basics directory: ${baseDir}`)
  }

  const versions = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^v\d+$/i.test(entry.name))
    .map(entry => ({
      name: entry.name,
      version: Number.parseInt(entry.name.slice(1), 10),
    }))
    .sort((a, b) => b.version - a.version)

  if (versions.length === 0) {
    throw new Error(`No bundled basics versions found in ${baseDir}`)
  }

  return path.join(baseDir, versions[0].name)
}

function resolveBasicsDir() {
  if (localEnv.REGISTRADURIA_BASICS_DIR) {
    return path.resolve(rootDir, localEnv.REGISTRADURIA_BASICS_DIR)
  }
  return resolveBundledBasicsDir()
}

function resolveEncoding() {
  return localEnv.REGISTRADURIA_BASICS_ENCODING || 'utf8'
}

function readLines(basicsDir, filename, { optional = false } = {}) {
  const filePath = path.join(basicsDir, filename)
  if (!fs.existsSync(filePath)) {
    if (optional) return []
    throw new Error(`Missing basics file: ${filePath}`)
  }

  return fs.readFileSync(filePath, resolveEncoding())
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
}

function parseCorporations(basicsDir) {
  return readLines(basicsDir, 'CORPORACION.txt').map(line => ({
    codigo: line.slice(0, 3),
    nombre: line.slice(3).trim(),
    sigla: 'PR',
  }))
}

function parseCircunscriptions(basicsDir) {
  return readLines(basicsDir, 'CIRCUNSCRIPCION.txt').map(line => ({
    codigo: line.slice(0, 1),
    nombre: line.slice(1).trim(),
  }))
}

function parseParties(basicsDir) {
  return readLines(basicsDir, 'PARTIDOS.txt').map(line => ({
    codigo: line.slice(0, 5),
    nombre: line.slice(5, -2).trim(),
    es_nacional: line.slice(-1) === 'N',
    color_hex: PARTY_COLORS[line.slice(0, 5)] || null,
    source_raw: line,
    updated_at: new Date().toISOString(),
  }))
}

function parseCandidates(basicsDir) {
  return readLines(basicsDir, 'CANDIDATOS.txt').map(line => {
    const details = line.slice(20).trim()
    const match = details.match(/^(.*)\s+(\d+)\s+([MF])(\d+)$/)
    if (!match) throw new Error(`Could not parse candidate line: ${line}`)

    return {
      codigo_corporacion: line.slice(0, 3),
      codigo_circunscripcion: line.slice(3, 4),
      codigo_partido: line.slice(11, 16),
      codigo_candidato: line.slice(16, 19),
      nombre_completo: match[1].replace(/\s+/g, ' ').trim(),
      cedula: match[2],
      genero: match[3],
      sorteo: Number.parseInt(match[4], 10),
      source_raw: line,
      updated_at: new Date().toISOString(),
    }
  })
}

function parseDivipolTail(line) {
  const match = line.match(/([15])(\d{8})(\d{8})(\d{6})([0-9A-Z]{2})?([^0-9]*)$/)
  if (!match) {
    return {
      beforeTail: line.slice(9).trim(),
      indicador_puesto: null,
      potencial_hombres: null,
      potencial_mujeres: null,
      numero_mesas: null,
      codigo_comuna: null,
      nombre_comuna: null,
    }
  }

  return {
    beforeTail: line.slice(9, match.index).trim(),
    indicador_puesto: match[1],
    potencial_hombres: Number.parseInt(match[2], 10),
    potencial_mujeres: Number.parseInt(match[3], 10),
    numero_mesas: Number.parseInt(match[4], 10),
    codigo_comuna: match[5] || null,
    nombre_comuna: match[6]?.trim() || null,
  }
}

function parseDivipol(basicsDir) {
  return readLines(basicsDir, 'DIVIPOL.txt', { optional: true }).map(line => {
    const parsed = parseDivipolTail(line)

    return {
      codigo_departamento: line.slice(0, 2),
      codigo_municipio: line.slice(2, 5),
      codigo_zona: line.slice(5, 7),
      codigo_puesto: line.slice(7, 9),
      nombre_departamento: null,
      nombre_municipio: null,
      nombre_puesto: parsed.beforeTail || null,
      indicador_puesto: parsed.indicador_puesto,
      potencial_hombres: parsed.potencial_hombres,
      potencial_mujeres: parsed.potencial_mujeres,
      numero_mesas: parsed.numero_mesas,
      codigo_comuna: parsed.codigo_comuna,
      nombre_comuna: parsed.nombre_comuna,
      source_raw: line,
      updated_at: new Date().toISOString(),
    }
  })
}

async function upsertInChunks(supabase, table, rows, options = {}) {
  const chunkSize = options.chunkSize || 500
  let processed = 0

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    const { error } = await supabase.from(table).upsert(chunk, options.upsertOptions)
    if (error) throw new Error(`${table}: ${error.message}`)
    processed += chunk.length
    process.stdout.write(`\r${table}: ${processed}/${rows.length}`)
  }
  process.stdout.write('\n')
}

async function main() {
  const basicsDir = resolveBasicsDir()
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_KEY'),
    { auth: { persistSession: false } },
  )

  const corporations = parseCorporations(basicsDir)
  const circunscriptions = parseCircunscriptions(basicsDir)
  const parties = parseParties(basicsDir)
  const candidates = parseCandidates(basicsDir)
  const divipol = parseDivipol(basicsDir)

  await upsertInChunks(supabase, 'pr_catalog_corporations', corporations, { chunkSize: 50 })
  await upsertInChunks(supabase, 'pr_catalog_circunscriptions', circunscriptions, { chunkSize: 50 })
  await upsertInChunks(supabase, 'pr_catalog_parties', parties, { chunkSize: 50 })
  await upsertInChunks(supabase, 'pr_catalog_candidates', candidates, {
    chunkSize: 50,
    upsertOptions: { onConflict: 'codigo_corporacion,codigo_circunscripcion,codigo_partido,codigo_candidato' },
  })
  if (divipol.length > 0) {
    await upsertInChunks(supabase, 'pr_catalog_divipol', divipol, {
      chunkSize: 500,
      upsertOptions: { onConflict: 'codigo_departamento,codigo_municipio,codigo_zona,codigo_puesto' },
    })
  }

  console.log(JSON.stringify({
    basics_dir: basicsDir,
    encoding: resolveEncoding(),
    corporations: corporations.length,
    circunscriptions: circunscriptions.length,
    parties: parties.length,
    candidates: candidates.length,
    divipol: divipol.length,
  }, null, 2))
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
