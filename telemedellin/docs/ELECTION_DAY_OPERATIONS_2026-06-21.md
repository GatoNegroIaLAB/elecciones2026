# Operacion jornada electoral - 2026-06-21

Fecha de corte: 2026-06-22  
Jornada documentada: domingo 2026-06-21  
Cliente: Telemedellin  
App: `telemedellin/`  
Repo: `GatoNegroIaLAB/elecciones2026`  
Produccion: `https://elecciones2026-beta.vercel.app`

## Objetivo de esta sesion

Dejar trazabilidad completa de la jornada real de segunda vuelta presidencial y del cierre operativo posterior:

- validar que la transicion de primera vuelta a segunda vuelta quedo bien resuelta
- confirmar que la cadena `Registraduria -> Vercel -> Supabase -> /api/results-live -> landing` corrio estable durante la jornada
- registrar los cambios manuales hechos sobre la landing durante el dia
- documentar el cierre: ultimo corte visible y apagado del cron de Vercel

## Resumen ejecutivo

La transicion de primera vuelta a segunda vuelta si funciono en produccion.

Durante la jornada del domingo 21 de junio de 2026:

- el cron de Vercel consulto la Registraduria cada minuto
- la landing leyo `GET /api/results-live` con refresco visible cada `70` segundos
- Supabase se mantuvo como cache operacional y fuente publica estable
- la senal de YouTube se roto manualmente varias veces desde `LIVE_SIGNAL_URL`
- se hicieron pequenos ajustes de copy en la interfaz sin afectar la ingesta

Al cierre:

- el sistema quedo congelado con el ultimo corte visible de `99.99%` mesas informadas
- el cron de Vercel se apago el 2026-06-22 para dejar de consultar la Registraduria
- los ultimos datos quedan publicados y reutilizables desde `GET /api/results-live`

## Como se llego a esta jornada

La transicion desde primera vuelta hacia segunda vuelta ya venia preparada desde los dias previos:

1. se vaciaron las tablas `pr_*` de resultados y payloads de primera vuelta
2. se conservaron solo los catalogos oficiales de segunda vuelta
3. se redujo el tarjeton a `2` partidos y `2` candidatos
4. se reorganizo la landing para layout de dos candidatos
5. se fijaron variables reales de jornada para el domingo `2026-06-21 16:00:00` hora Colombia
6. se dejo activo un gate temporal para que el cron existiera antes de la jornada pero no corriera antes de tiempo
7. se endurecio la ingesta con lock de corrida unica y reescritura atomica por boletin

## Configuracion operativa usada en jornada

Referencia horaria obligatoria: `America/Bogota (UTC-05:00)`.

Configuracion efectiva usada el domingo 21 de junio:

- `ELECTION_INGEST_START_AT=2026-06-21T16:00:00-05:00`
- `NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT=2026-06-21T16:00:00-05:00`
- cron de Vercel cada `1` minuto mediante `vercel.json`
- refresco visible del frontend cada `70` segundos

Importante:

- la consulta real a Registraduria no era cada `70` segundos
- la consulta real era cada `60` segundos por cron
- los `70` segundos correspondian solo al refresco visible de la landing

## Cadena tecnica usada en produccion

```text
Registraduria
  -> /api/cron-ingest-registraduria
  -> lib/presidential-ingest.js
  -> Supabase pr_*
  -> /api/results-live
  -> landing pages/index.js
```

Componentes relevantes:

- Fuente oficial: `https://descargas.registraduria.gov.co/`
- Ingesta privada: `pages/api/ingest-registraduria.js`
- Cron privado: `pages/api/cron-ingest-registraduria.js`
- Runtime de configuracion: `lib/election-runtime.js`
- Lectura publica para la web: `pages/api/results-live.js`
- Vista principal: `pages/index.js`

## Verificaciones realizadas durante la jornada

### Verificacion de arranque

Cuando inicio la ventana operativa de las `16:00` hora Colombia, se verifico que:

- Vercel ya estaba ejecutando el cron de production
- Registraduria respondia correctamente a los indices presidenciales
- Supabase seguia escribiendo sin errores
- `GET /api/results-live` seguia devolviendo datos sanos

Hallazgo relevante:

- se observo un `404` transitorio de Registraduria al publicar uno de los primeros indices
- ese `404` se resolvio solo pocos minutos despues
- no hizo falta correr una ingesta manual para destrabar la operacion

### Verificacion de ritmo real

Se confirmo con evidencia de runtime y base de datos:

- Vercel estaba llamando `/api/cron-ingest-registraduria` cada minuto
- `pr_live_status.fetched_at` se movia con esa cadencia
- la landing seguia leyendo `/api/results-live` cada `70` segundos

Esto dejo la operacion desacoplada:

- ingesta real: `60` segundos
- refresco visible: `70` segundos

### Verificaciones intermedias

Se hicieron chequeos cortos durante la tarde para revisar:

- salud general del cron
- respuesta actual de Registraduria
- estado de `pr_live_status`
- estado de `/api/results-live`

Hitos registrados durante la jornada:

- revision de las `16:05` COT: arranque real funcionando
- revision de las `16:32` COT: API publica sana, Supabase sano, indice ya avanzando
- revision de las `17:05` COT: fuente real y resultados publicos seguian sanos

## Cambios manuales hechos en la landing durante la jornada

### 1. Rotacion repetida de la senal de YouTube

Telemedellin hizo varios cambios de transmision durante el dia.

La operacion elegida fue mantener una sola constante en frontend:

- `LIVE_SIGNAL_URL` en `pages/index.js`

Cada vez que cambio la transmision:

1. se reemplazo el `youtube embed`
2. se publico a GitHub
3. Vercel redeployo production
4. se verifico que el iframe nuevo quedara servido en la landing

Ultimo embed activo al cierre de esta etapa:

- `https://www.youtube.com/embed/7zipc1y5uvU?...`

### 2. Correccion del copy de refresco

Durante la jornada se detecto que el sitio mostraba `cada hora` aunque el frontend debia refrescar cada `70` segundos.

Causa real:

- `lib/election-runtime.js` forzaba un minimo de `3600000 ms`

Correccion:

- se dejo `DEFAULT_RESULTS_REFRESH_MS = 70000`
- se elimino el clamp que obligaba el minimo de `1 hora`

Resultado:

- la landing paso a mostrar `Actualizacion automatica cada 70 segundos`

### 3. Ajustes de copy en las cards principales

Se pidio cambiar el titulo de las dos cards superiores.

Los rotulos que quedaron en el estado final documentado fueron:

- card 1: `Presidente y Vicepresidente`
- card 2: `Curul en el senado y camara`

Nota:

- ese copy fue una decision editorial del momento, no un cambio estructural del flujo
- la estructura tecnica siguio siendo la de segunda vuelta presidencial

## Estado de datos observado al cierre

Durante la madrugada del 22 de junio, antes de apagar el cron, el ultimo corte visible observado fue:

- `mesas_informadas = 122017`
- `mesas_instaladas = 122020`
- `porc_mesas_informadas = 99.99`
- `status = ok`

Resultado nacional visible en ese corte:

- `ABELARDO DE LA ESPRIELLA` - `12,959,542` votos - `49.66%`
- `IVAN CEPEDA CASTRO` - `12,708,712` votos - `48.70%`
- `votos_validos = 26,095,102`
- `votos_blancos = 426,848`

Ciudades visibles al cierre:

- Medellin: `100%`
- Bogota: `100%`
- Cali: `100%`
- Barranquilla: `100%`

Conclusion operativa tomada con el usuario:

- aunque la Registraduria no hubiera llegado aun a `100.00%`, el `99.99%` ya era suficiente para detener la consulta automatica

## Cierre operativo del 2026-06-22

Con el corte de `99.99%` ya se decidio apagar la consulta automatica.

Accion realizada:

- se elimino el bloque `crons` de `telemedellin/vercel.json`
- el archivo quedo en `{}` para que Vercel dejara de programar nuevas ejecuciones

Commit de cierre:

- `a708cd9cb1a84b70edd7e8e487472564f671408f`
- mensaje: `ops: disable registraduria cron`

Deployment verificado:

- `dpl_4AWoEAwesAAuTHtAnjNztp9TzEmr`
- estado final: `READY`

Efecto esperado:

- no se hacen mas consultas automaticas a Registraduria
- la landing conserva el ultimo estado publicado
- `GET /api/results-live` sigue sirviendo el ultimo corte almacenado en Supabase

## Estado final recomendado para quien retome

Si un humano o una IA retoman este proyecto despues de esta jornada, deben asumir:

1. la transicion de primera vuelta a segunda vuelta ya esta resuelta
2. la infraestructura `pr_*` de Supabase ya quedo dedicada a presidencial
3. el cron de Vercel ya esta apagado post-jornada
4. la landing sigue operativa leyendo desde Supabase
5. la senal de YouTube se sigue operando manualmente desde `LIVE_SIGNAL_URL`
6. si se vuelve a necesitar una jornada en vivo, hay que decidir explicitamente:
   - si se reactiva cron en `vercel.json`
   - desde que hora Colombia
   - con que copy de frontend

## Archivos mas importantes para entender esta jornada

- `README.md`
- `docs/PROJECT_HANDOFF.md`
- `docs/PRESIDENTIAL_DATA_FLOW.md`
- `docs/SECOND_ROUND_STATUS_2026-06-11.md`
- `pages/index.js`
- `lib/election-runtime.js`
- `pages/api/cron-ingest-registraduria.js`
- `pages/api/results-live.js`
- `vercel.json`
