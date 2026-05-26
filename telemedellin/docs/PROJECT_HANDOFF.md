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
- Ultimo deploy validado al cierre del 2026-05-26: landing presidencial con fotos, layout responsive final, voto en blanco y copy superior actualizado.

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
- Landing principal: `pages/index.js`.
- Mapa geografico: `lib/colombia-map.js`.

## Landing actual

- Fuente de datos frontend: `GET /api/results-live`.
- Refresco automatico: cada 60 segundos.
- Boton manual de actualizacion: eliminado para evitar recargas agresivas de usuarios.
- Fotos de candidatos: se cargan desde URLs publicas optimizadas de Google Drive (`lh3.googleusercontent.com`) configuradas en `pages/index.js`; no se commitean binarios pesados al repo.
- Voto en blanco: se muestra en la card de avance nacional, separado del ranking de candidatos.
- Badge superior: `Datos oficiales de la Registraduria Nacional`.

### Orden mobile

1. Avance nacional.
2. Tres cards principales.
3. Senal en vivo.
4. Todos los candidatos.
5. Mapa de Colombia.

### Orden escritorio

1. Tres cards principales.
2. Senal en vivo.
3. Dos columnas: `Todos los candidatos` a la izquierda y `Avance nacional` a la derecha.
4. Mapa de Colombia.

### Cards principales

- Card 1: `Presidencia`.
- Card 2: `Curul en Senado y Camara`.
- Card 3: `Tercera mayor votacion`.
- Sin iconos en los rotulos.
- Porcentaje arriba y numero de votos debajo, para no pisar la foto.

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
6. Dar acceso a la integracion de Notion sobre `TM_Elecciones` si se quiere actualizar la ficha desde Loki; al cierre, el conector devuelve `object_not_found`.

## Riesgos tecnicos

- `npm audit` reporta vulnerabilidades por `next@14.2.3` y `postcss`.
- Conviene planear un upgrade controlado de Next 14.2.x antes de produccion.
- No guardar secretos en GitHub ni en documentacion.
- Las credenciales compartidas por chat deben rotarse si Registraduria lo permite.
- El avance `0000` puede contener datos de prueba/prejornada; no tratarlo como resultado definitivo.
