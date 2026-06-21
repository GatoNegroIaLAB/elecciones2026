const DEFAULT_RESULTS_REFRESH_MS = 70000
const SECOND_ROUND_DEFAULT_START_AT = '2026-06-21T16:00:00-05:00'

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveSecondRoundStartAt(configuredValue) {
  const defaultStartAt = parseDate(SECOND_ROUND_DEFAULT_START_AT)
  if (!configuredValue) return defaultStartAt
  return configuredValue >= defaultStartAt ? configuredValue : defaultStartAt
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

export function getPublicElectionRuntime(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now)
  const refreshMs = parsePositiveInt(process.env.NEXT_PUBLIC_RESULTS_REFRESH_MS, DEFAULT_RESULTS_REFRESH_MS)
  const autoRefreshStartAt = resolveSecondRoundStartAt(
    parseDate(process.env.NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT)
  )

  let mode = 'manual'
  if (autoRefreshStartAt) {
    mode = current >= autoRefreshStartAt ? 'live' : 'scheduled'
  }

  return {
    mode,
    refreshMs,
    autoRefreshStartAt: autoRefreshStartAt ? autoRefreshStartAt.toISOString() : null,
  }
}

export function getServerIngestRuntime(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now)
  const ingestStartAt = resolveSecondRoundStartAt(
    parseDate(process.env.ELECTION_INGEST_START_AT || process.env.NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT)
  )
  const cronEnabled = isTruthy(process.env.ENABLE_ELECTION_INGEST_CRON)
  const beforeStart = Boolean(ingestStartAt && current < ingestStartAt)

  return {
    cronEnabled,
    ingestStartAt: ingestStartAt ? ingestStartAt.toISOString() : null,
    shouldRun: cronEnabled && !beforeStart,
    reason: !cronEnabled ? 'disabled' : beforeStart ? 'before_start' : 'ready',
  }
}
