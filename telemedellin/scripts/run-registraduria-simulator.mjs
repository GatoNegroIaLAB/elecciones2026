const targetUrl = process.env.SIMULATION_URL
const token = process.env.REVALIDATE_TOKEN || process.env.INGEST_TOKEN
const intervalSeconds = Number(process.env.SIMULATION_INTERVAL_SECONDS || 60)
const maxTicks = Number(process.env.SIMULATION_TICKS || 0)

if (!targetUrl) {
  throw new Error('Missing SIMULATION_URL')
}

if (!token) {
  throw new Error('Missing REVALIDATE_TOKEN or INGEST_TOKEN')
}

async function tick(count) {
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode: 'tick' }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Simulation tick failed: ${response.status} ${JSON.stringify(payload)}`)
  }

  console.log(`[${new Date().toISOString()}] tick ${count}`, payload)
}

let count = 0

while (!maxTicks || count < maxTicks) {
  count += 1
  await tick(count)

  if (maxTicks && count >= maxTicks) break
  await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000))
}
