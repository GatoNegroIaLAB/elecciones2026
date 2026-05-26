# Flujo de datos presidencial 2026

Fecha de corte: 2026-05-26

## Resumen

La landing presidencial ya no debe depender de consultas directas del navegador a Registraduria. El flujo productivo queda separado en cinco capas:

```text
Registraduria -> Ingesta Vercel -> Supabase pr_* -> API Vercel -> Web
```

La ingesta automatica queda pendiente para la manana de elecciones. Por ahora se dispara manualmente con token privado.

## Servicios

- Fuente oficial: `https://descargas.registraduria.gov.co/`
- Indice presidencial: `https://descargas.registraduria.gov.co/PR/0000/DEPRINDEX0000.json`
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

1. Lee el indice presidencial `DEPRINDEX0000.json`.
2. Resuelve los archivos `URL_Json_COLOMBIA` y `URL_Json_DEPARTAMENTOS`.
3. Descarga JSON/GZIP desde Registraduria con Basic Auth.
4. Guarda payloads crudos en `pr_raw_payloads`.
5. Normaliza cabeceras en `pr_boletins`, incluido `VOTOS EN BLANCO` desde `Detalle_Partidos_Totales`.
6. Normaliza votos por partido/candidato en `pr_results`.
7. Actualiza `pr_sync_state`.

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

## Frontend

Archivo principal: `pages/index.js`.

La landing llama `GET /api/results-live` cada 60 segundos. Renderiza:

- top 3 candidatos;
- lista nacional completa;
- avance nacional, incluido voto en blanco;
- senal en vivo;
- mapa de Colombia por ganador departamental.

El mapa usa `lib/colombia-map.js`. `CONSULADOS` se excluye del mapa porque no es departamento geografico.

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

## Seguridad

- No guardar credenciales reales en GitHub ni docs.
- `SUPABASE_SERVICE_KEY`, `REGISTRADURIA_USER`, `REGISTRADURIA_PASS` y `REVALIDATE_TOKEN` solo deben vivir como variables cifradas.
- Las credenciales compartidas por chat deben rotarse si el proveedor lo permite.
- El endpoint de ingesta debe seguir protegido; sin token debe responder `401`.

## Verificaciones realizadas

- Build local: `npm run build` OK.
- Deploy production Vercel: OK.
- Proxy Registraduria con credenciales: `200`.
- Ingesta manual: `200`.
- `GET /api/results-live`: `200`.
- Supabase poblado con estado `ok`.
