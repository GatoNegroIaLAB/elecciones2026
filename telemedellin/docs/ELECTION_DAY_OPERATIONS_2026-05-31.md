# Operacion jornada electoral - 2026-05-31

Fecha de corte: 2026-05-31  
Cliente: Telemedellin  
App: `telemedellin/`  
Repo: `GatoNegroIaLAB/elecciones2026`  
Produccion: `https://elecciones2026-beta.vercel.app`

## Objetivo de esta sesion

Consolidar el estado real del sistema el dia de elecciones antes del inicio de la ventana automatica de ingesta, y reducir el riesgo principal detectado por antecedente historico:

- evitar ingestas concurrentes sobre la misma fuente
- evitar reescrituras parciales de boletines y resultados

El usuario confirmo que ya no existe ningun flujo activo de `n8n` ni `EasyPanel` para esta landing presidencial.

## Hora de referencia

La verificacion operativa de esta sesion se hizo durante la madrugada/manana del domingo **31 de mayo de 2026**, con foco en hora de Colombia.

Configuracion vigente de arranque automatico:

- `ELECTION_INGEST_START_AT=2026-05-31T16:00:00-05:00`
- `NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT=2026-05-31T16:00:00-05:00`
- Vercel Cron cada `1` minuto
- refresco visible del frontend cada `70` segundos

## Estado verificado antes del endurecimiento

Se comprobo en produccion y en infraestructura:

- `GET /` responde `200`
- `GET /api/results-live` responde `200`
- el sitio seguia mostrando correctamente el estado oficial actual en cero
- Supabase `poocwplikbzatcxmcglt` estaba `ACTIVE_HEALTHY`
- Registraduria respondia `200` en:
  - `https://descargas.registraduria.gov.co/PR/0000/DEPRINDEX0000.json`
- la ingesta manual protegida podia correr contra produccion

Primera validacion real del dia:

```json
{
  "ok": true,
  "started_at": "2026-05-31T10:46:57.999Z",
  "fetched_at": "2026-05-31T10:47:31.401Z",
  "national_boletins": 1,
  "department_boletins": 34,
  "capital_boletins": 32,
  "national_results": 13,
  "department_results": 442,
  "capital_results": 416
}
```

## Riesgo principal identificado

El riesgo mas serio ya no era volumen de datos sino concurrencia de escrituras.

Problemas detectados en el codigo previo:

1. **No existia lock de corrida unica.**
   - dos llamadas casi simultaneas a `/api/ingest-registraduria` podian ejecutar al mismo tiempo
   - el cron de Vercel y una llamada manual podian pisarse entre si

2. **La reescritura de resultados por boletin no era atomica.**
   - el flujo hacia `select`
   - luego `update` o `insert` del boletin
   - luego `delete` de `pr_results`
   - luego `insert` de `pr_results`
   - todo eso quedaba expuesto a carreras entre corridas concurrentes

Ese patron si podia explicar un bloqueo o comportamiento erratico como el observado antes en Congreso, incluso sin un volumen enorme de filas.

## Cambios aplicados el 2026-05-31

### 1. Lock de corrida unica

Se agrego lease lock en `pr_sync_state` sobre la llave `presidential_live`.

Columnas usadas:

- `lock_token`
- `lock_acquired_at`
- `lock_expires_at`

Funcion nueva:

- `public.pr_acquire_ingest_lock(...)`

Comportamiento:

- si no hay lock activo, la ingesta toma el lock y continua
- si ya hay otra corrida vigente, la nueva llamada responde `skipped=true` con `reason="already_running"`
- al terminar, la corrida libera lock y actualiza `pr_sync_state`

### 2. Reescritura atomica por boletin

Se movio la escritura del boletin y la reposicion completa de `pr_results` a una funcion SQL unica:

- `public.pr_upsert_boletin_with_results(...)`

Comportamiento:

- toma `pg_advisory_xact_lock(...)` por combinacion de:
  - avance
  - tipo de boletin
  - departamento
  - municipio
  - comuna
- hace `SELECT ... FOR UPDATE` sobre el boletin existente si ya existe
- actualiza o inserta el boletin
- borra los resultados previos de ese boletin
- inserta de nuevo los resultados del boletin
- retorna:
  - `boletin_id`
  - `result_count`
  - `avance_num`
  - `boletin_num`

Con esto la operacion queda agrupada y consistente por boletin.

### 3. Endurecimiento de `search_path`

Se observo en Supabase Advisor que las dos funciones nuevas quedaban con `search_path` mutable.

Se corrigio agregando:

- `set search_path = public`

en:

- `public.pr_acquire_ingest_lock(...)`
- `public.pr_upsert_boletin_with_results(...)`

## Incidencia real durante el despliegue

La primera version del RPC atomico tuvo un bug real en produccion.

Error observado:

```text
column reference "boletin_id" is ambiguous
```

Contexto:

- el error aparecio despues de desplegar la primera version del RPC
- el sitio seguia sirviendo datos, pero `status` en `pr_sync_state` quedo en `error`
- la causa fue una ambiguedad entre la columna de salida `boletin_id` del `RETURNS TABLE` y el `DELETE` sobre `pr_results`

Correccion aplicada:

- se califico explicitamente la tabla en:
  - `delete from public.pr_results pr where pr.boletin_id = v_boletin_id`

Despues de eso:

- la ingesta manual volvio a correr bien
- `pr_sync_state` regreso a `status = ok`

## Migraciones nuevas de esta sesion

- `supabase/migrations/20260531111500_ingest_lock_and_atomic_boletin_upsert.sql`
- `supabase/migrations/20260531113000_fix_atomic_boletin_delete_qualifier.sql`
- `supabase/migrations/20260531114500_harden_ingest_functions_search_path.sql`

## Validaciones reales despues del endurecimiento

### Ingesta manual sana

```json
{
  "ok": true,
  "started_at": "2026-05-31T11:12:45.256Z",
  "fetched_at": "2026-05-31T11:12:55.823Z",
  "national_boletins": 1,
  "department_boletins": 34,
  "capital_boletins": 32,
  "national_results": 13,
  "department_results": 442,
  "capital_results": 416
}
```

### Estado publico restaurado

`GET /api/results-live` volvio a:

- `status = "ok"`
- `last_error = null`
- `fetched_at = 2026-05-31T11:12:55.823+00:00`

### Prueba de concurrencia real

Se lanzaron dos llamadas casi simultaneas contra:

- `https://elecciones2026-beta.vercel.app/api/ingest-registraduria`

Resultado:

```json
[
  {
    "id": 1,
    "status": 200,
    "elapsed_ms": 770,
    "payload": {
      "ok": true,
      "skipped": true,
      "reason": "already_running",
      "started_at": "2026-05-31T11:13:34.115Z",
      "lock_expires_at": "2026-05-31T11:23:34.089+00:00"
    }
  },
  {
    "id": 2,
    "status": 200,
    "elapsed_ms": 9489,
    "payload": {
      "ok": true,
      "started_at": "2026-05-31T11:13:34.089Z",
      "fetched_at": "2026-05-31T11:13:43.162Z",
      "national_boletins": 1,
      "department_boletins": 34,
      "capital_boletins": 32,
      "national_results": 13,
      "department_results": 442,
      "capital_results": 416
    }
  }
]
```

Interpretacion:

- el lock ya esta funcionando en produccion
- una corrida entra
- la otra se salta sin pisar la primera
- no quedaron locks colgados al final

Estado final del lock despues de la prueba:

- `lock_token = null`
- `lock_acquired_at = null`
- `lock_expires_at = null`
- `status = ok`

### Revalidacion tras endurecer `search_path`

Se corrio una nueva ingesta manual despues del ajuste de seguridad de funciones:

```json
{
  "ok": true,
  "started_at": "2026-05-31T11:16:14.735Z",
  "fetched_at": "2026-05-31T11:16:25.852Z",
  "national_boletins": 1,
  "department_boletins": 34,
  "capital_boletins": 32,
  "national_results": 13,
  "department_results": 442,
  "capital_results": 416
}
```

## Estado actual al cierre de esta sesion

Para el flujo presidencial activo:

- hay lock de corrida unica
- la escritura por boletin ya es atomica
- la ingesta manual funciona
- el endpoint publico funciona
- el sitio sigue mostrando el estado oficial en cero
- no hay dependencia operativa de `n8n` ni de `EasyPanel`

## Hallazgos que siguen abiertos pero no bloquean esta jornada

### Supabase Advisor - seguridad

Persisten hallazgos previos no introducidos en esta sesion:

- varias tablas con `RLS enabled` pero sin policies
  - en este proyecto eso hoy es compatible con el modelo porque ya no tienen lectura publica operativa
- varias vistas legacy y algunas presidenciales aparecen como `security definer view`
  - ejemplo:
    - `public.pr_live_status`
    - `public.pr_latest_national_results`
    - `public.pr_latest_department_winners`

Esto merece una pasada posterior de seguridad, pero **no bloquea** la proteccion nueva de concurrencia ni la operacion de jornada de hoy.

### Supabase Advisor - performance

Persisten avisos menores heredados:

- foreign key sin indice en tabla legacy `cat_candidatos`
- indice no usado en `palabras_nube`
- estrategia de conexiones de Auth mejorable

No son el cuello de botella del flujo presidencial actual.

## Recomendacion operativa para hoy

Durante la jornada:

1. Vigilar `GET /api/results-live` y el campo `status`.
2. Si se dispara una ingesta manual mientras el cron esta corriendo, ahora debe responder `already_running` en vez de duplicar trabajo.
3. Si aparece un nuevo error, revisar primero:
   - `pr_sync_state.last_error`
   - logs de Vercel de `ingest-registraduria`
   - logs de Postgres en Supabase
4. No reactivar simuladores ni endpoints heredados.
5. No abrir un segundo automatismo externo de ingesta.

## Conclusion

El endurecimiento principal pedido para hoy quedo implementado y validado en produccion:

- **solo puede existir una ingesta presidencial activa al tiempo**
- **cada boletin se reescribe de forma atomica**

Eso reduce de forma directa el riesgo mas plausible de bloqueo que se venia arrastrando por el antecedente de Congreso.

## Seguimiento operativo de la tarde - hora Colombia

La referencia horaria operativa de esta etapa fue siempre **America/Bogota (UTC-05:00)**, incluso cuando el entorno del agente estuviera en Europa.

### Revision 16:05 COT

Se ejecuto una revision de solo lectura, sin disparar ingesta manual.

Hallazgos:

- `/api/results-live` respondia `200`
- se observo por unos minutos un `Registraduria HTTP 404` transitorio
- el error no era de Vercel ni de Supabase; correspondia a la ventana en la que Registraduria estaba publicando el primer paquete real

Pocos minutos despues el sistema se recompuso sin intervencion manual:

- `status = ok`
- `last_error = null`
- primeros datos reales visibles en nacional y departamentos

### Revision 16:32 COT

Se repitio el chequeo de lectura contra API publica, Supabase y Registraduria.

Estado observado:

- `pr_sync_state.status = ok`
- indice activo en Supabase: `PR/0005/DEPRINDEX0005.json`
- `GET /api/results-live` con:
  - `mesas_informadas = 3261`
  - `porc_mesas_informadas = 2.67`
  - `votos_validos = 216152`
- Registraduria respondiendo `200` en el indice vigente

### Revision 17:05 COT

Se hizo una nueva revision integral en modo lectura.

Estado observado:

- API publica: `200`
- Supabase project `poocwplikbzatcxmcglt`: `ACTIVE_HEALTHY`
- `pr_sync_state.status = ok`
- `last_error = null`
- indice vigente: `PR/0012/DEPRINDEX0012.json`
- datos publicados en `results-live`:
  - `mesas_informadas = 86892`
  - `porc_mesas_informadas = 71.21`
  - `votos_validos = 15857533`

Conclusion de ese corte:

- la cadena `Registraduria -> Vercel -> Supabase -> /api/results-live -> landing` quedo validada con datos reales y en crecimiento

## Ajustes de contenido hechos en vivo

### Rotulos de cards principales

Se cambio el copy de las dos primeras cards:

- antes:
  - `Presidencia`
  - `Curul en Senado y Camara`
- despues:
  - `Candidatos a segunda vuelta`
  - `Candidatos a segunda vuelta`

El tercer rotulo se mantuvo como:

- `Tercera mayor votacion`

### Senal en vivo de YouTube

Durante la jornada se opero el relevo manual de enlaces de YouTube editando la constante:

- `LIVE_SIGNAL_URL` en `pages/index.js`

Eso permitio reemplazar rapidamente la senal embebida sin tocar otras partes del layout.

## Ajuste de cadencia al cierre

Mas tarde, con el avance ya practicamente consolidado, el usuario reporto un avance aproximado de `99.95%`.

Con base en eso se redujo la frecuencia operativa para evitar consultas y refrescos innecesarios:

- frontend:
  - antes: `70` segundos
  - despues: `1` hora
- cron de ingesta:
  - antes: cada minuto
  - despues: cada hora

Cambios aplicados:

- `lib/election-runtime.js`
  - `DEFAULT_RESULTS_REFRESH_MS = 3600000`
  - se impone una cadencia minima efectiva de `1` hora aunque siga existiendo un valor menor heredado en variables de entorno
- `vercel.json`
  - cron actualizado a `0 * * * *`

Resultado:

- despliegues de produccion validados en `READY`
- la landing queda mucho menos agresiva despues del cierre practico del conteo

## Estado operativo consolidado al cierre del dia

- lock de corrida unica: activo y probado
- reescritura atomica por boletin: activa y probada
- Registraduria: accesible con credenciales validas
- Supabase: sano y sin lock colgado
- API publica: sana
- landing: sana
- cards principales: actualizadas a segunda vuelta
- senal en vivo: operable por reemplazo rapido de `LIVE_SIGNAL_URL`
- cadencia final: horaria

## Commits relevantes del cierre

- `dd07dd38bca05326c40e97f3d9588bf73a7b0141`
  - actualiza el copy de las dos primeras cards a `Candidatos a segunda vuelta`
- `f5f0b1d29abb8871eef8bfaf466fb9d9dd3baced`
  - baja el refresco visible del frontend a cadencia horaria
- `b1b560fceb0f886c7a9b240c33e3ffb602314ba6`
  - cambia el cron de ingesta a frecuencia horaria en `vercel.json`
