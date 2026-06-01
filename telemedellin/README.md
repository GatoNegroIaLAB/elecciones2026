# Telemedellín — Centro de Mando Electoral 2026

App Next.js para visualización de resultados electorales en tiempo real, conectada a Supabase.

## Estado operativo

- Estado general y handoff operativo: [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md)
- Flujo técnico presidencial: [`docs/PRESIDENTIAL_DATA_FLOW.md`](docs/PRESIDENTIAL_DATA_FLOW.md)
- Estado de alistamiento para jornada al 2026-05-29: [`docs/ELECTION_READINESS_2026-05-29.md`](docs/ELECTION_READINESS_2026-05-29.md)
- Bitácora de operación del día de elecciones 2026-05-31: [`docs/ELECTION_DAY_OPERATIONS_2026-05-31.md`](docs/ELECTION_DAY_OPERATIONS_2026-05-31.md)

### Corte operativo vigente

- La referencia horaria operativa del proyecto es siempre **Colombia / America/Bogota (UTC-05:00)**.
- El flujo productivo vigente es: `Registraduria -> Vercel ingest -> Supabase pr_* -> /api/results-live -> landing`.
- La señal en vivo de YouTube se cambia manualmente editando `LIVE_SIGNAL_URL` en `pages/index.js` y desplegando a production.
- Al cierre de jornada del 2026-05-31, con el avance ya practicamente consolidado, la cadencia se redujo a:
  - ingesta automatica: **cada 1 hora**
  - refresco visible del frontend: **cada 1 hora**
- Los dos primeros rotulos de las cards principales quedaron unificados como: `Candidatos a segunda vuelta`.

## Setup

### 1. Clonar e instalar
```bash
npm install
```

### 2. Variables de entorno
Copia `.env.local.example` a `.env.local` y completa:
- `NEXT_PUBLIC_SUPABASE_URL` — URL de tu proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon key de Supabase
- `SUPABASE_SERVICE_KEY` — Service key para ingesta y lecturas server-side
- `REGISTRADURIA_USER` — Usuario Basic Auth de la Registraduría
- `REGISTRADURIA_PASS` — Password Basic Auth de la Registraduría
- `REVALIDATE_TOKEN` — Token de ingesta manual
- `CRON_SECRET` — Token de autorización para Vercel Cron
- `NEXT_PUBLIC_RESULTS_REFRESH_MS` — Frecuencia de refresco del frontend en jornada
- `NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT` — Inicio de refresco automático visible
- `ENABLE_ELECTION_INGEST_CRON` — Habilita o apaga la ingesta automática
- `ELECTION_INGEST_START_AT` — Inicio real permitido para la ingesta automática

Valor operativo vigente al cierre de jornada:

- `NEXT_PUBLIC_RESULTS_REFRESH_MS=3600000`

### 3. Desarrollo local
```bash
npm run dev
```

### 4. Deploy en Vercel
```bash
npx vercel --prod
```
Configura las mismas variables de entorno en el dashboard de Vercel.

## Endpoints API

### `GET /api/results-live`
Endpoint público que consume la landing. Lee desde Supabase y devuelve:
- `status`
- `national`
- `departments`
- `cities`

### `POST /api/ingest-registraduria`
Endpoint privado de ingesta manual.

Requiere:
```text
Authorization: Bearer <REVALIDATE_TOKEN>
```

### `GET /api/cron-ingest-registraduria`
Endpoint privado para Vercel Cron.

Requiere:
```text
Authorization: Bearer <CRON_SECRET>
```

Si la jornada no ha empezado o la automatización está apagada, responde `200` con `skipped=true`.

Cadencia vigente versionada en `vercel.json` al cierre del 2026-05-31:

- `0 * * * *` (una vez por hora)

### `GET /api/proxy-boletin?url=<URL>`
Descarga y descomprime un boletín `.json.gz` de la Registraduría.
Usado por n8n en lugar de descargar el `.gz` directamente.

**Ejemplo:**
```
/api/proxy-boletin?url=https://descargas.registraduria.gov.co/SE/0000/BOL_SE_17_0000_1154.json.gz
```

### `POST /api/revalidate`
Invalida el caché de la página principal. Llamado por n8n al detectar un nuevo avance.

## Tablas Supabase relevantes hoy

Runtime presidencial:
- `pr_sync_state`
- `pr_raw_payloads`
- `pr_boletins`
- `pr_results`
- `pr_catalog_parties`
- `pr_catalog_candidates`
- `pr_latest_national_results`
- `pr_latest_department_winners`
- `pr_live_status`

Tablas legacy:
- existen tablas históricas del proyecto anterior, pero ya no son parte del runtime presidencial activo
- ver endurecimiento y RLS en `docs/ELECTION_READINESS_2026-05-29.md`
