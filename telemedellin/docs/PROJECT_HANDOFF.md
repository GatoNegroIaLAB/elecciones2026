# Elecciones 2026 - Handoff operativo

Fecha: 2026-05-26

## Fuente del proyecto

- Cliente: Telemedellin.
- Proyecto Notion: `TM_Elecciones`.
- Objetivo original: landing para seguir minuto a minuto el avance electoral.
- Cambio de alcance confirmado: el proyecto pasa de elecciones de Congreso a elecciones de Presidente.
- Apify sale del alcance activo salvo que se decida reincorporarlo.

## Estado actual

- Repo actual: `GatoNegroIaLAB/elecciones2026`.
- Repo anterior/historico: `vicentezuluaga-TM/elecciones2026`.
- App: `telemedellin/`.
- Framework: Next.js 14.2.3, Pages Router.
- Rama revisada: `main`.
- Build local: OK.
- Vercel production: `https://elecciones2026-beta.vercel.app`.
- Flujo activo: `Registraduria -> /api/ingest-registraduria -> Supabase pr_* -> /api/results-live -> Web`.

## Servicios conectados

- Supabase:
  - Project ref: `poocwplikbzatcxmcglt`.
  - URL, anon key y service key configuradas en Vercel Production.
  - Modelo presidencial nuevo aislado con prefijo `pr_*`.
  - Verificacion de lectura OK en `/api/results-live`.
  - Verificacion de escritura/ingesta OK en `/api/ingest-registraduria`.

- Registraduria:
  - Base URL: `https://descargas.registraduria.gov.co/`.
  - Basic Auth configurado en Vercel Production.
  - Verificacion de credenciales contra la base: OK.
  - URL presidencial verificada por proxy:
    - `https://descargas.registraduria.gov.co/PR/0000/DEPRINDEX0000.json`
  - `/api/proxy-boletin` responde JSON valido para esa URL.
- Primera ingesta presidencial manual validada.
  - El voto en blanco viene en `Detalle_Partidos_Totales` como codigo `00996`, no como candidato normal.

## Documentacion tecnica

- Flujo completo: `docs/PRESIDENTIAL_DATA_FLOW.md`.
- Migracion Supabase: `supabase/migrations/20260526163000_presidential_results_schema.sql`.
- Soporte voto en blanco: `supabase/migrations/20260526182500_add_blank_vote_support.sql`.
- Logica compartida de ingesta: `lib/presidential-data.js`.
- Endpoint privado de ingesta: `pages/api/ingest-registraduria.js`.
- Endpoint publico para la web: `pages/api/results-live.js`.

## Variables locales

El archivo `.env.local` no se debe commitear. Variables configuradas o esperadas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `REGISTRADURIA_BASE_URL`
- `REGISTRADURIA_USER`
- `REGISTRADURIA_PASS`
- `REVALIDATE_TOKEN`

Pendientes si se confirma que vuelven al alcance:

- `APIFY_WEBHOOK_TOKEN`
- `APIFY_API_TOKEN`

Nota: las credenciales reales no deben quedar en GitHub ni en documentacion.

## Pendiente inmediato

1. No automatizar la ingesta todavia.
2. Activar ingesta automatica la manana de elecciones.
3. Elegir mecanismo: Vercel Cron si el plan lo permite, o n8n/EasyPanel para mayor control.
4. Durante pruebas, disparar ingesta manual con `Authorization: Bearer <REVALIDATE_TOKEN>`.
5. Revisar visualmente la landing con datos reales cuando empiecen los avances oficiales.

## Riesgos tecnicos

- `npm audit` reporta vulnerabilidades por `next@14.2.3` y `postcss`.
- Conviene planear un upgrade controlado de Next 14.2.x antes de produccion.
- No guardar secretos en GitHub ni en documentacion.
- Las credenciales compartidas por chat deben rotarse si Registraduria lo permite.
- El avance `0000` puede contener datos de prueba/prejornada; no tratarlo como resultado definitivo.
