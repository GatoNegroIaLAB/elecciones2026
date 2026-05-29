# Elecciones 2026 - Handoff operativo

Fecha: 2026-05-29

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
- Build y deploy en Vercel: OK.
- Vercel production: `https://elecciones2026-beta.vercel.app`.
- Root Directory correcto en Vercel: `telemedellin`.
- Flujo activo: `Registraduria -> /api/ingest-registraduria y /api/cron-ingest-registraduria -> Supabase pr_* -> /api/results-live -> Web`.
- Ultimo deploy validado al cierre del 2026-05-29: landing presidencial con programacion de jornada, card de ciudades, cron protegido, mapa neutro previo a jornada y datos oficiales en cero.

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
  - URL presidencial inicial verificada por proxy:
    - `https://descargas.registraduria.gov.co/PR/0000/DEPRINDEX0000.json`
  - La ingesta ya no queda fija en `0000`; busca el ultimo indice disponible siguiendo `DEPRINDEX0000`, `DEPRINDEX0001`, etc.
  - `/api/proxy-boletin` responde JSON valido para esa URL.
- Primera ingesta presidencial manual validada.
  - El voto en blanco viene en `Detalle_Partidos_Totales` como codigo `00996`, no como candidato normal.

## Documentacion tecnica

- Estado de alistamiento al 2026-05-29: `docs/ELECTION_READINESS_2026-05-29.md`.
- Flujo completo: `docs/PRESIDENTIAL_DATA_FLOW.md`.
- Migracion Supabase: `supabase/migrations/20260526163000_presidential_results_schema.sql`.
- Soporte voto en blanco: `supabase/migrations/20260526182500_add_blank_vote_support.sql`.
- Endurecimiento superficie presidencial: `supabase/migrations/20260529000500_harden_presidential_runtime_surface.sql`.
- Endurecimiento tablas legacy: `supabase/migrations/20260529110500_harden_legacy_public_tables.sql`.
- Logica compartida de ingesta: `lib/presidential-data.js`.
- Logica compartida de runtime e ingesta: `lib/election-runtime.js`, `lib/presidential-ingest.js`.
- Endpoint privado de ingesta: `pages/api/ingest-registraduria.js`.
- Endpoint privado de cron: `pages/api/cron-ingest-registraduria.js`.
- Endpoint publico para la web: `pages/api/results-live.js`.
- Endpoint privado de simulacion: `pages/api/simulate-registraduria.js`.
- Simulador local: `scripts/run-registraduria-simulator.mjs`.
- Landing principal: `pages/index.js`.
- Mapa geografico: `lib/colombia-map.js`.
- Auditoria de simulacro: `docs/SIMULATION_AUDIT_2026-05-27.md`.

## Landing actual

- Fuente de datos frontend: `GET /api/results-live`.
- Refresco automatico en jornada: cada 70 segundos, activado por fecha.
- Boton manual de actualizacion: eliminado para evitar recargas agresivas de usuarios.
- Fotos de candidatos: se cargan desde URLs publicas optimizadas de Google Drive (`lh3.googleusercontent.com`) configuradas en `pages/index.js`; no se commitean binarios pesados al repo.
- Voto en blanco: se muestra en la card de avance nacional, separado del ranking de candidatos.
- Badge superior: `Datos oficiales de la Registraduria Nacional`.
- Senal en vivo: YouTube embebido carga con `autoplay=1`, `mute=1` y `enablejsapi=1`; el usuario puede activar/desactivar audio desde el boton superpuesto.
- Titulo del mapa: `MAPA DE COLOMBIA POR MAYOR VOTACION DEPARTAMENTAL`.
- Card adicional: `Votacion por ciudades`, con Medellin, Bogota, Cali y Barranquilla.
- Comportamiento previo a jornada del mapa: todos los departamentos en naranja Telemedellin cuando no hay votos ni mesas reportadas.

### Orden mobile

1. Avance nacional.
2. Tres cards principales.
3. Senal en vivo.
4. Votacion por ciudades.
5. Todos los candidatos.
6. Mapa de Colombia.

### Orden escritorio

1. Tres cards principales.
2. Senal en vivo.
3. Dos columnas: `Todos los candidatos` a la izquierda; `Avance nacional` y `Votacion por ciudades` a la derecha.
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
- `CRON_SECRET`
- `NEXT_PUBLIC_RESULTS_REFRESH_MS`
- `NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT`
- `ENABLE_ELECTION_INGEST_CRON`
- `ELECTION_INGEST_START_AT`

Pendientes si se confirma que vuelven al alcance:

- `APIFY_WEBHOOK_TOKEN`
- `APIFY_API_TOKEN`

Nota: las credenciales reales no deben quedar en GitHub ni en documentacion.

## Pendiente inmediato

1. Esperar el inicio real de jornada.
2. Verificar el primer avance real despues de `2026-05-31T16:00:00-05:00`.
3. Confirmar que el cron pase de `skipped=true` a ingesta efectiva.
4. Revisar visualmente la landing con datos reales cuando empiecen los avances oficiales.
5. Dar acceso a la integracion de Notion sobre `TM_Elecciones` si se quiere actualizar la ficha desde Loki; al cierre, el conector devuelve `object_not_found`.

## Simulacro 2026-05-27

- Se probo una jornada simulada con ticks aleatorios enviados a `/api/simulate-registraduria`.
- Supabase acepto escrituras repetidas y la web reacciono correctamente leyendo `/api/results-live`.
- La frecuencia efectiva quedo por encima de 60 segundos porque cada tick espera a que termine la escritura antes de iniciar el siguiente intervalo.
- Se limpiaron los datos simulados con `mode=reset`.
- Se regreso a ingesta real desde Registraduria.
- `ENABLE_ELECTION_SIMULATION` fue removida de Vercel Production y se redeployo.
- Estado real observado tras restaurar: avance `0`, boletin `0`, `13` candidatos nacionales, `34` departamentos, `0` mesas informadas.

## Riesgos tecnicos

- `npm audit` reporta vulnerabilidades por `next@14.2.3` y `postcss`.
- Conviene planear un upgrade controlado de Next 14.2.x antes de produccion.
- No guardar secretos en GitHub ni en documentacion.
- Las credenciales compartidas por chat deben rotarse si Registraduria lo permite.
- El avance `0000` puede contener datos de prueba/prejornada; no tratarlo como resultado definitivo.
- El endpoint de simulacion nunca debe quedar activo durante operacion normal.
- Cambios de variables en Vercel requieren redeploy para afectar el runtime activo.
- Vercel Cron ejecuta cada minuto, no con granularidad de 70/80 segundos.
