# Elecciones 2026 - Handoff operativo

Fecha: 2026-06-22 (hora de Colombia)

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
- Flujo activo: `Registraduria -> /api/ingest-registraduria -> Supabase pr_* -> /api/results-live -> Web`.
- Estado vigente tras el corte de primera vuelta: sistema reconvertido para segunda vuelta, con reset de `pr_*`, dos candidatos oficiales cargados y frontend simplificado a dos cards principales.
- Estado vigente post-jornada de segunda vuelta: ultimo corte congelado en `99.99%`, cron apagado en `vercel.json` y landing sirviendo el ultimo snapshot persistido en Supabase.
- Referencia horaria operativa: siempre `America/Bogota`.

## Servicios conectados

- Supabase:
  - Project ref: `poocwplikbzatcxmcglt`.
  - URL, anon key y service key configuradas en Vercel Production.
  - Modelo presidencial nuevo aislado con prefijo `pr_*`.
  - Verificacion de lectura OK en `/api/results-live`.
  - Verificacion de escritura/ingesta OK en `/api/ingest-registraduria`.
  - Verificacion de concurrencia OK: dos llamadas simultaneas ya no se pisan; una ejecuta y la otra responde `already_running`.

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

## Actualizacion 2026-06-11 - Segunda vuelta

- No se conserva informacion operativa de primera vuelta en `pr_*`.
- Se aplico un reset controlado sobre:
  - `pr_results`
  - `pr_boletins`
  - `pr_raw_payloads`
  - `pr_catalog_*`
  - `pr_sync_state`
- Se cargaron los basicos oficiales de segunda vuelta:
  - Partidos: `00026` Pacto Historico, `01003` Defensores de la Patria
  - Candidatos: `IVÁN CEPEDA CASTRO`, `ABELARDO DE LA ESPRIELLA`
- Conteo actual verificado en Supabase tras el reset:
  - `pr_catalog_parties = 2`
  - `pr_catalog_candidates = 2`
  - `pr_boletins = 0`
  - `pr_results = 0`
  - `pr_sync_state.status = idle`
- Los archivos basicos nuevos llegaron en `iso-8859-1`; el importador del repo ya fue ajustado para soportar ese encoding.
- En la revision del 2026-06-17 sobre los ZIP `v4` entregados por Registraduria se confirmo:
  - `CANDIDATOS` y `PARTIDOS` mantienen los mismos codigos y filas de segunda vuelta, pero corrigen acentos frente al `v03` versionado.
  - `CIRCUNSCRIPCION` y `CORPORACION` no cambian.
  - `DIVIPOL` coincide byte por byte con `data/registraduria-basics/v02/DIVIPOL.txt`.
- A partir de esa revision se versiono `data/registraduria-basics/v04` como nuevo snapshot de basicos de segunda vuelta.
- Decision operativa: `v04` queda como fuente explicita por defecto para la proxima carga/importacion pre-jornada.
- La fecha de arranque configurada para segunda vuelta quedo alineada a:
  - `2026-06-21T16:00:00-05:00` para `NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT`
  - `2026-06-21T16:00:00-05:00` para `ELECTION_INGEST_START_AT`
- `vercel.json` queda reactivado con cron por minuto hacia `/api/cron-ingest-registraduria`.
- Verificacion real de production el 2026-06-20:
  - `GET /api/cron-ingest-registraduria` con `CRON_SECRET` respondio `skipped=true`
  - `reason=before_start`
  - `ingest_start_at=2026-06-21T21:00:00.000Z`
  - conclusion: el gate real de Vercel ya esta listo para abrir el **2026-06-21 a las 16:00 America/Bogota**
- El color oficial de `Defensores de la Patria / Abelardo De La Espriella` quedo corregido a `#DA7100` en frontend, importador y Supabase.
- La documentacion detallada de esta fase vive tambien en `docs/SECOND_ROUND_STATUS_2026-06-11.md`.

## Actualizacion 2026-06-21 y 2026-06-22 - Jornada real y cierre

- El domingo 2026-06-21 corrio la jornada real de segunda vuelta con:
  - Vercel Cron cada `1` minuto hacia `/api/cron-ingest-registraduria`
  - frontend refrescando `/api/results-live` cada `70` segundos
  - hora de arranque efectiva: `2026-06-21 16:00:00 America/Bogota`
- Durante la jornada:
  - la cadena `Registraduria -> Vercel -> Supabase -> /api/results-live -> landing` se mantuvo sana
  - se hicieron varias rotaciones manuales de la senal de YouTube editando `LIVE_SIGNAL_URL` en `pages/index.js`
  - se corrigio el runtime de frontend para que el refresh visible respetara `70000 ms` en vez de quedar forzado a `1 hora`
  - se ajustaron los rotulos de las dos cards principales a:
    - `Presidente y Vicepresidente`
    - `Curul en el senado y camara`
- Verificaciones operativas registradas:
  - revision de las `16:05` COT: arranque real funcionando
  - revision de las `16:32` COT: API publica y Supabase sanos
  - revision de las `17:05` COT: fuente real, indice y API publica sanos
- Hallazgo de jornada:
  - se observo un `404` transitorio de Registraduria al publicar uno de los primeros indices
  - se resolvio sin intervencion manual
- Cierre del 2026-06-22:
  - se acepto `99.99%` como ultimo corte suficiente
  - se apago el cron quitando el bloque `crons` de `telemedellin/vercel.json`
  - commit de cierre: `a708cd9cb1a84b70edd7e8e487472564f671408f`
  - deployment de cierre: `dpl_4AWoEAwesAAuTHtAnjNztp9TzEmr`
  - estado esperado final: no mas consultas automaticas a Registraduria

## Documentacion tecnica

- Estado de alistamiento al 2026-05-29: `docs/ELECTION_READINESS_2026-05-29.md`.
- Bitacora del dia de elecciones al 2026-05-31: `docs/ELECTION_DAY_OPERATIONS_2026-05-31.md`.
- Bitacora de jornada real de segunda vuelta: `docs/ELECTION_DAY_OPERATIONS_2026-06-21.md`.
- Flujo completo: `docs/PRESIDENTIAL_DATA_FLOW.md`.
- Migracion Supabase: `supabase/migrations/20260526163000_presidential_results_schema.sql`.
- Soporte voto en blanco: `supabase/migrations/20260526182500_add_blank_vote_support.sql`.
- Endurecimiento superficie presidencial: `supabase/migrations/20260529000500_harden_presidential_runtime_surface.sql`.
- Endurecimiento tablas legacy: `supabase/migrations/20260529110500_harden_legacy_public_tables.sql`.
- Lock y escritura atomica de ingesta: `supabase/migrations/20260531111500_ingest_lock_and_atomic_boletin_upsert.sql`.
- Correccion de ambiguedad en RPC atomico: `supabase/migrations/20260531113000_fix_atomic_boletin_delete_qualifier.sql`.
- Endurecimiento de `search_path` en funciones de ingesta: `supabase/migrations/20260531114500_harden_ingest_functions_search_path.sql`.
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
- Durante la jornada, el refresco automatico visible corrio cada `70` segundos.
- Boton manual de actualizacion: eliminado para evitar recargas agresivas de usuarios.
- Fotos de candidatos: se cargan desde URLs publicas optimizadas de Google Drive (`lh3.googleusercontent.com`) configuradas en `pages/index.js`; no se commitean binarios pesados al repo.
- Voto en blanco: se muestra en la card de avance nacional, separado del ranking de candidatos.
- Badge superior: `Datos oficiales de la Registraduria Nacional`.
- Senal en vivo: YouTube embebido carga con `autoplay=1`, `mute=1` y `enablejsapi=1`; el usuario puede activar/desactivar audio desde el boton superpuesto.
- La referencia operativa de horario es siempre `America/Bogota` aunque el entorno del agente este en otra zona horaria.
- El cambio de senal en vivo durante la jornada se hace editando la constante `LIVE_SIGNAL_URL` en `pages/index.js` y desplegando a production.
- Titulo del mapa: `MAPA DE COLOMBIA POR MAYOR VOTACION DEPARTAMENTAL`.
- Card adicional: `Votacion por ciudades`, con Medellin, Bogota, Cali y Barranquilla.
- Comportamiento previo a jornada del mapa: todos los departamentos en naranja Telemedellin cuando no hay votos ni mesas reportadas.
- Copy vigente de bloque lateral/listado: `Candidatos en segunda vuelta`.
- Estado post-jornada: el sitio debe seguir sirviendo el ultimo snapshot de Supabase sin nuevas consultas automaticas.

### Orden mobile

1. Avance nacional.
2. Dos cards principales.
3. Senal en vivo.
4. Votacion por ciudades.
5. Candidatos en segunda vuelta.
6. Mapa de Colombia.

### Orden escritorio

1. Dos cards principales.
2. Senal en vivo.
3. Dos columnas en la fila superior: `Candidatos en segunda vuelta` a la izquierda y `Avance nacional` a la derecha.
4. Una fila completa debajo con `Votacion por ciudades`.
5. Mapa de Colombia.

### Cards principales

- Card 1: `Presidente y Vicepresidente`.
- Card 2: `Curul en el senado y camara`.
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

## Estado confirmado durante jornada

- Revision de las 16:05 COT: la cadena completa quedo viva en lectura real.
- Se observo un `404` transitorio de Registraduria durante la publicacion inicial de `0001`, resuelto sin intervencion manual pocos minutos despues.
- Revision de las 16:32 COT: API publica sana, Supabase sano, indice ya en `0005`.
- Revision de las 17:05 COT: API publica sana, Supabase sano, Registraduria `200`, indice ya en `0012`.
- El usuario reporto avance aproximado de `99.95%` al cierre de jornada; con eso se redujo la cadencia operativa a 1 hora.
- Cierre operativo del 2026-06-22:
  - ultimo corte visible aceptado: `99.99%`
  - cron ya apagado en `vercel.json`
  - Vercel production ya no debe seguir consultando automaticamente la Registraduria

## Pendiente inmediato

1. Si en el futuro se reabre la operacion en vivo, volver a declarar `crons` en `vercel.json` y desplegar.
2. Si cambia la senal de YouTube, editar `LIVE_SIGNAL_URL` en `pages/index.js` y desplegar.
3. Dar acceso a la integracion de Notion sobre `TM_Elecciones` si se quiere actualizar la ficha desde Loki; al cierre, el conector devuelve `object_not_found`.

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
- Tras el cierre de primera vuelta, el proyecto quedo en transicion controlada hacia segunda vuelta:
  - durante la jornada real `vercel.json` tuvo cron activo por minuto
  - Supabase ya no conserva los resultados anteriores en `pr_*`
  - el frontend ya no muestra una tercera card
  - el layout desktop ya no apila `Votacion por ciudades` debajo de `Avance nacional`; ahora vive en una fila propia
  - el nuevo encendido de jornada ya quedo programado para el 2026-06-21 a las 16:00 America/Bogota
- Tras el cierre del 2026-06-22:
  - `vercel.json` vuelve a quedar sin cron
  - la landing depende del ultimo snapshot persistido en Supabase
  - cualquier reactivacion futura del flujo debe ser deliberada y redeployada
- Si aparece un error de ingesta durante jornada, revisar primero `pr_sync_state.last_error`, luego logs de Vercel y logs de Postgres en Supabase.
