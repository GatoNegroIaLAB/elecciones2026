# Telemedellín — Centro de Mando Electoral 2026

App Next.js para visualización de resultados electorales en tiempo real, conectada a Supabase.

## Estado operativo

Ver handoff del 2026-05-26 en [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md).

## Setup

### 1. Clonar e instalar
```bash
npm install
```

### 2. Variables de entorno
Copia `.env.local.example` a `.env.local` y completa:
- `NEXT_PUBLIC_SUPABASE_URL` — URL de tu proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon key de Supabase
- `REGISTRADURIA_USER` — Usuario Basic Auth de la Registraduría
- `REGISTRADURIA_PASS` — Password Basic Auth de la Registraduría

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

### `GET /api/proxy-boletin?url=<URL>`
Descarga y descomprime un boletín `.json.gz` de la Registraduría.
Usado por n8n en lugar de descargar el `.gz` directamente.

**Ejemplo:**
```
/api/proxy-boletin?url=https://descargas.registraduria.gov.co/SE/0000/BOL_SE_17_0000_1154.json.gz
```

### `POST /api/revalidate`
Invalida el caché de la página principal. Llamado por n8n al detectar un nuevo avance.

## Tablas Supabase requeridas
- `avances_resultados` — resultados por partido/departamento
- `control_avances` — último avance procesado por corporación
- `cat_partidos` — catálogo de partidos
- `cat_candidatos` — catálogo de candidatos
- `cat_divipol` — catálogo de puestos de votación
