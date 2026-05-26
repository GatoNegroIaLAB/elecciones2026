# Elecciones 2026 - Handoff operativo

Fecha: 2026-05-26

## Fuente del proyecto

- Cliente: Telemedellin.
- Proyecto Notion: `TM_Elecciones`.
- Objetivo original: landing para seguir minuto a minuto el avance electoral.
- Cambio de alcance confirmado: el proyecto pasa de elecciones de Congreso a elecciones de Presidente.
- Apify sale del alcance activo salvo que se decida reincorporarlo.

## Estado local

- Repo: `vicentezuluaga-TM/elecciones2026`.
- App: `telemedellin/`.
- Framework: Next.js 14.2.3, Pages Router.
- Rama revisada: `main`.
- Build local: OK.
- Dev server usado: `http://localhost:3001`.

## Servicios conectados

- Supabase:
  - URL configurada en `.env.local`.
  - Publishable key configurada en `.env.local`.
  - Service key configurada en `.env.local`.
  - Verificacion de lectura OK en:
    - `control_avances`
    - `avances_resultados`
    - `cat_partidos`
    - `cat_candidatos`
    - `cat_divipol`
    - `palabras_nube`

- Registraduria:
  - Base URL: `https://descargas.registraduria.gov.co/`.
  - Basic Auth configurado en `.env.local`.
  - Verificacion de credenciales contra la base: OK.
  - URL presidencial verificada por proxy:
    - `https://descargas.registraduria.gov.co/PR/0000/DEPRINDEX0000.json`
  - `/api/proxy-boletin` responde JSON valido para esa URL.

## Variables locales

El archivo `.env.local` no se debe commitear. Variables configuradas o esperadas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `REGISTRADURIA_BASE_URL`
- `REGISTRADURIA_USER`
- `REGISTRADURIA_PASS`
- `REVALIDATE_TOKEN`

Pendientes si se confirma que siguen aplicando:

- `APIFY_WEBHOOK_TOKEN`
- `APIFY_API_TOKEN`

Nota: `REGISTRADURIA_PASS` debe quedar entre comillas en `.env.local` porque contiene `#`.

## Pendiente inmediato

1. Migrar UI y logica de Congreso a Presidente.
2. Revisar tablas/campos requeridos para datos presidenciales.
3. Ajustar endpoint/procesamiento desde el indice `PR`.
4. Retirar referencias activas a Apify si no se usara.
5. Ejecutar cambios pequenos y verificar con build en cada paso.

## Riesgos tecnicos

- `npm audit` reporta vulnerabilidades por `next@14.2.3` y `postcss`.
- Conviene planear un upgrade controlado de Next 14.2.x antes de produccion.
- No guardar secretos en GitHub ni en documentacion.
