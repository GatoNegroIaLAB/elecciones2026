# Telemedellín — Centro de Mando Electoral 2026

App Next.js para visualización de resultados electorales en tiempo real, conectada a Supabase.

## Estado operativo

- Estado general y handoff operativo: [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md)
- Flujo técnico presidencial: [`docs/PRESIDENTIAL_DATA_FLOW.md`](docs/PRESIDENTIAL_DATA_FLOW.md)
- Estado detallado de segunda vuelta al 2026-06-11: [`docs/SECOND_ROUND_STATUS_2026-06-11.md`](docs/SECOND_ROUND_STATUS_2026-06-11.md)
- Bitácora de jornada real de segunda vuelta 2026-06-21: [`docs/ELECTION_DAY_OPERATIONS_2026-06-21.md`](docs/ELECTION_DAY_OPERATIONS_2026-06-21.md)
- Estado de alistamiento para jornada al 2026-05-29: [`docs/ELECTION_READINESS_2026-05-29.md`](docs/ELECTION_READINESS_2026-05-29.md)
- Bitácora de operación del día de elecciones 2026-05-31: [`docs/ELECTION_DAY_OPERATIONS_2026-05-31.md`](docs/ELECTION_DAY_OPERATIONS_2026-05-31.md)

### Corte operativo vigente

- La referencia horaria operativa del proyecto es siempre **Colombia / America/Bogota (UTC-05:00)**.
- El flujo productivo vigente es: `Registraduria -> Vercel ingest -> Supabase pr_* -> /api/results-live -> landing`.
- La señal en vivo de YouTube se cambia manualmente editando `LIVE_SIGNAL_URL` en `pages/index.js` y desplegando a production.
- El 2026-06-11 se hizo el corte de primera vuelta para reconvertir el sistema a **segunda vuelta presidencial**.
- Se eliminaron de `pr_*` los boletines, resultados y catálogos de primera vuelta.
- Supabase queda cargado con los básicos oficiales de segunda vuelta: **2 partidos** y **2 candidatos**.
- La jornada real del domingo **2026-06-21** corrio con:
  - ingesta real cada `1` minuto desde Vercel Cron
  - refresco visible del frontend cada `70` segundos
- La landing quedó simplificada para segunda vuelta: dos cards principales, copy dedicado y catálogos alineados al nuevo tarjetón.
- El cierre operativo posterior a jornada se hizo el **2026-06-22**:
  - ultimo corte visible congelado: `99.99%` mesas informadas
  - cron de Vercel ya apagado en `vercel.json`
  - no se deben hacer mas consultas automaticas a Registraduria salvo decision explicita futura
- El layout desktop vigente se reorganizó para dos candidatos:
  - fila superior con `Candidatos en segunda vuelta` y `Avance nacional`
  - fila inferior con `Votación por ciudades` a ancho completo
- El color oficial de `Defensores de la Patria / Abelardo De La Espriella` quedó corregido a `#DA7100` tanto en frontend como en Supabase.
- Los rótulos actuales de las cards principales quedaron en:
  - `Presidente y Vicepresidente`
  - `Curul en el senado y camara`

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

Valor operativo usado durante la jornada de segunda vuelta:

- `NEXT_PUBLIC_RESULTS_REFRESH_MS=70000`
- `NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT=2026-06-21T16:00:00-05:00`
- `ENABLE_ELECTION_INGEST_CRON=true`
- `ELECTION_INGEST_START_AT=2026-06-21T16:00:00-05:00`

Estado posterior al cierre del 2026-06-22:

- el cron ya no se declara en `vercel.json`
- si en el futuro se quiere volver a consultar Registraduria, hay que reintroducir el bloque `crons` y volver a desplegar

### Básicos de Registraduría

- El importador `scripts/import-registraduria-basics.mjs` ahora soporta:
  - seleccionar carpeta con `REGISTRADURIA_BASICS_DIR`
  - seleccionar encoding con `REGISTRADURIA_BASICS_ENCODING`
  - omitir `DIVIPOL` si no existe en la carpeta de carga
- Fuente operativa explicita antes de jornada:
  - `data/registraduria-basics/v04`
  - si no se envia `REGISTRADURIA_BASICS_DIR`, el importador ya toma `v04` como snapshot bundled por defecto
- Los básicos versionados en el repo viven en:
  - `data/registraduria-basics/v02` — primera vuelta
  - `data/registraduria-basics/v03` — segunda vuelta, primer corte
  - `data/registraduria-basics/v04` — segunda vuelta, actualización recibida el 2026-06-11 y revisada el 2026-06-17
- Los archivos oficiales de segunda vuelta entregados por Registraduría llegaron en `iso-8859-1`, no en `utf-8`.
- Hallazgo de revisión `v04`:
  - `CANDIDATOS` y `PARTIDOS` corrigen acentos respecto al `v03` versionado
  - `CIRCUNSCRIPCION` y `CORPORACION` no cambian
  - `DIVIPOL` coincide con el `v02` ya versionado en el repo

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

Estado vigente post-jornada:

- `vercel.json` ya no define cron para este proyecto
- la ultima jornada automatica real ya termino
- el endpoint sigue existiendo pero ya no debe ser invocado automaticamente desde Vercel

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
