# Flujo de datos presidencial 2026

Fecha de corte: 2026-05-27

## Resumen

La landing presidencial ya no debe depender de consultas directas del navegador a Registraduria. El flujo productivo queda separado en cinco capas:

```text
Registraduria -> Ingesta Vercel -> Supabase pr_* -> API Vercel -> Web
```

La ingesta automatica queda pendiente para la manana de elecciones. Por ahora se dispara manualmente con token privado.

Estado actual: la conexion real con Registraduria esta restaurada, el simulador existe en codigo pero esta apagado en Vercel Production, y la web lee el ultimo estado publicado en Supabase.

## Servicios

- Fuente oficial: `https://descargas.registraduria.gov.co/`
- Indice presidencial inicial: `https://descargas.registraduria.gov.co/PR/0000/DEPRINDEX0000.json`
- Vercel production: `https://elecciones2026-beta.vercel.app`
- Supabase project ref: `poocwplikbzatcxmcglt`
- GitHub: `GatoNegroIaLAB/elecciones2026`
- App: `telemedellin/`

## Variables de entorno

Estas variables viven en Vercel Production. No deben commitearse ni documentarse con valores reales.

- `NEXT_PUBLIC_SUPABASE_URL`: URL publica del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: key publica para lecturas controladas.
- `SUPABASE_SERVICE_KEY`: key server-side para ingesta y consultas privilegiadas.
- `REGISTRADURIA_USER`: usuario Basic Auth de Registraduria.
- `REGISTRADURIA_PASS`: password Basic Auth de Registraduria.
- `REVALIDATE_TOKEN`: token privado usado para proteger la ingesta.

## Endpoints propios

### `GET /api/results-live`

Endpoint publico usado por la web. Lee desde Supabase, no desde Registraduria.

Respuesta:

- `status`: estado de sincronizacion desde `pr_live_status`.
- `national`: resultados nacionales desde `pr_latest_national_results`.
- `departments`: ganadores departamentales desde `pr_latest_department_winners`.

### `POST /api/ingest-registraduria`

Endpoint privado de ingesta. Requiere:

```text
Authorization: Bearer <REVALIDATE_TOKEN>
```

Proceso:

1. Busca el ultimo indice presidencial disponible siguiendo el patron `/PR/0000/DEPRINDEX0000.json`, `/PR/0001/DEPRINDEX0001.json`, etc.
2. Lee el indice mas reciente encontrado.
3. Resuelve los archivos `URL_Json_COLOMBIA` y `URL_Json_DEPARTAMENTOS` relativos al indice elegido.
4. Descarga JSON/GZIP desde Registraduria con Basic Auth.
5. Guarda payloads crudos en `pr_raw_payloads`.
6. Normaliza cabeceras en `pr_boletins`, incluido `VOTOS EN BLANCO` desde `Detalle_Partidos_Totales`.
7. Normaliza votos por partido/candidato en `pr_results`.
8. Actualiza `pr_sync_state`.

### `POST /api/simulate-registraduria`

Endpoint privado para ensayo. Requiere:

```text
Authorization: Bearer <REVALIDATE_TOKEN>
ENABLE_ELECTION_SIMULATION=true
```

Modos:

- `mode=tick`: genera un avance sintetico nuevo con datos aleatorios, usando candidatos reales del catalogo y departamentos del mapa.
- `mode=reset`: elimina solo los boletines/payloads generados por el simulador (`simulator://registraduria/...`) y devuelve el estado al ultimo boletin no simulado disponible.

Los avances simulados empiezan en `9001` para quedar por encima de los datos de prueba actuales. No activar este endpoint sin tener claro si se esta apuntando a staging o produccion.

En produccion normal `ENABLE_ELECTION_SIMULATION` debe estar ausente o apagada. En ese estado el endpoint responde `403 Election simulation is disabled`.

### `GET /api/proxy-boletin`

Proxy heredado para diagnostico y compatibilidad. Ya no debe ser la fuente principal de la landing.

## Modelo Supabase

Las tablas presidenciales usan prefijo `pr_` para no mezclar datos con las tablas viejas de Congreso.

### Estado e historico bruto

- `pr_sync_state`: estado de la ultima sincronizacion, URLs actuales, avance, boletin y errores.
- `pr_raw_payloads`: payloads originales descargados desde Registraduria para auditoria.

### Catalogos

- `pr_catalog_corporations`: corporacion presidencial.
- `pr_catalog_circunscriptions`: circunscripcion nacional.
- `pr_catalog_parties`: partidos/agrupaciones del tarjeton presidencial.
- `pr_catalog_candidates`: candidatos presidenciales.
- `pr_catalog_divipol`: division politica/puntos de votacion, preparada para carga posterior si se requiere granularidad fina.

### Boletines y resultados

- `pr_boletins`: cabecera de cada boletin por nivel nacional/departamental. Incluye votos validos, nulos, no marcados y voto en blanco.
- `pr_results`: votos y porcentajes por partido/candidato para cada boletin.

### Vistas

- `pr_latest_boletins`: boletines del ultimo avance cargado.
- `pr_latest_national_results`: ranking nacional del ultimo avance.
- `pr_latest_department_results`: resultados departamentales del ultimo avance.
- `pr_latest_department_winners`: ganador por departamento.
- `pr_live_status`: estado resumido para la web.

## Datos cargados al 2026-05-26

Primera ingesta manual validada:

- `35` boletines.
- `455` resultados.
- `3` payloads crudos.
- `13` candidatos nacionales.
- `34` departamentos.
- Voto en blanco identificado en la fuente oficial como `Detalle_Partidos_Totales` codigo `00996`.
- Estado `ok`.

El avance inicial de prueba es `0000`; puede contener datos de prueba o estructura previa a jornada. En produccion debe tratarse como preconteo informativo, no vinculante.

La ingesta no debe asumir que `0000` sera siempre el ultimo indice. En cada ejecucion consulta el ultimo avance conocido en `pr_sync_state` y prueba los siguientes indices secuenciales hasta encontrar el primer `404`. El ultimo indice existente es el que se procesa.

## Estado verificado al 2026-05-27

Despues del simulacro se limpio Supabase de datos sinteticos, se apago el simulador y se ejecuto de nuevo ingesta real desde Registraduria.

- Estado: `ok`.
- Avance: `0`.
- Boletin: `0`.
- Mesas instaladas: `122020`.
- Mesas informadas: `0`.
- Votos validos: `0`.
- Candidatos nacionales: `13`.
- Departamentos: `34`.

Este estado corresponde a fuente previa/no activa de jornada. No debe interpretarse como resultado electoral definitivo.

## Frontend

Archivo principal: `pages/index.js`.

La landing llama `GET /api/results-live` cada 60 segundos. Renderiza:

- tres cards principales con foto para las mayores votaciones;
- lista nacional completa;
- avance nacional, incluido voto en blanco;
- senal en vivo de YouTube con autoplay en mute y boton superpuesto para activar/desactivar audio;
- mapa de Colombia por mayor votacion departamental.

El mapa usa `lib/colombia-map.js`. `CONSULADOS` se excluye del mapa porque no es departamento geografico.

### Layout vigente

Mobile:

1. Avance nacional.
2. Tres cards principales.
3. Senal en vivo.
4. Todos los candidatos.
5. Mapa de Colombia.

Escritorio:

1. Tres cards principales.
2. Senal en vivo.
3. Dos columnas: todos los candidatos a la izquierda y avance nacional a la derecha.
4. Mapa de Colombia.

### Fotos y rotulos

- Las fotos se referencian desde Google Drive usando URLs `https://lh3.googleusercontent.com/d/<fileId>=s640`.
- No se guardan fotos de candidatos como binarios en GitHub.
- Rotulos de las tres cards: `Presidencia`, `Curul en Senado y Camara`, `Tercera mayor votacion`.
- Las cards principales no usan iconos en el rotulo.
- El iframe de YouTube usa `autoplay=1`, `mute=1`, `enablejsapi=1` y `playsinline=1`; el boton de audio envia `mute` / `unMute` con `postMessage` a la API del iframe.

## Operacion manual

Para disparar ingesta manual:

```bash
curl -X POST \
  -H "Authorization: Bearer $REVALIDATE_TOKEN" \
  https://elecciones2026-beta.vercel.app/api/ingest-registraduria
```

Para validar datos publicados:

```bash
curl https://elecciones2026-beta.vercel.app/api/results-live
```

## Automatizacion pendiente

No automatizar todavia. Decision actual: activar la ingesta automatica la manana de elecciones.

Opciones recomendadas:

- Vercel Cron llamando `/api/ingest-registraduria` cada 30-60 segundos si el plan lo permite.
- Cron externo controlado desde n8n/EasyPanel con header `Authorization`.
- Job temporal en servidor propio durante la jornada.

Recomendacion: usar n8n/EasyPanel si necesitamos control fino de frecuencia, pausas y alertas.

## Ensayo con datos aleatorios

Para simular una jornada donde llegan datos cada minuto:

1. Activar `ENABLE_ELECTION_SIMULATION=true` en el entorno que se va a probar.
2. Desplegar el endpoint `/api/simulate-registraduria`.
3. Ejecutar un tick manual:

```bash
curl -X POST \
  -H "Authorization: Bearer $REVALIDATE_TOKEN" \
  https://elecciones2026-beta.vercel.app/api/simulate-registraduria
```

4. Dejarlo corriendo cada minuto:

```bash
SIMULATION_URL=https://elecciones2026-beta.vercel.app/api/simulate-registraduria \
SIMULATION_INTERVAL_SECONDS=60 \
SIMULATION_TICKS=30 \
REVALIDATE_TOKEN=$REVALIDATE_TOKEN \
npm run simulate:registraduria
```

5. Al terminar, limpiar los datos sinteticos:

```bash
curl -X POST \
  -H "Authorization: Bearer $REVALIDATE_TOKEN" \
  "https://elecciones2026-beta.vercel.app/api/simulate-registraduria?mode=reset"
```

Resultado del ensayo del 2026-05-27: ver `docs/SIMULATION_AUDIT_2026-05-27.md`.

## Seguridad

- No guardar credenciales reales en GitHub ni docs.
- `SUPABASE_SERVICE_KEY`, `REGISTRADURIA_USER`, `REGISTRADURIA_PASS` y `REVALIDATE_TOKEN` solo deben vivir como variables cifradas.
- Las credenciales compartidas por chat deben rotarse si el proveedor lo permite.
- El endpoint de ingesta debe seguir protegido; sin token debe responder `401`.
- El endpoint de simulacion debe seguir protegido por token y por `ENABLE_ELECTION_SIMULATION=true`; sin bandera activa debe responder `403`.
- Despues de cambiar variables de entorno en Vercel, hacer redeploy para que el runtime tome el cambio.

## Verificaciones realizadas

- Build local: `npm run build` OK.
- Deploy production Vercel: OK.
- Proxy Registraduria con credenciales: `200`.
- Ingesta manual: `200`.
- `GET /api/results-live`: `200`.
- Supabase poblado con estado `ok`.
- Simulador apagado tras ensayo: `403`.
