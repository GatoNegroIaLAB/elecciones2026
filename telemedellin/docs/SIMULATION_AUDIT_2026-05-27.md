# Auditoria de simulacro Registraduria

Fecha: 2026-05-27

## Objetivo

Probar el comportamiento del sitio recibiendo datos nuevos de forma periodica, como si fueran avances de Registraduria durante una jornada electoral.

## Flujo probado

```text
Script local -> Vercel /api/simulate-registraduria -> Supabase pr_* -> Vercel /api/results-live -> Frontend
```

Luego se restauro el flujo real:

```text
Registraduria -> Vercel /api/ingest-registraduria -> Supabase pr_* -> Vercel /api/results-live -> Frontend
```

## Resultado del simulacro

- Endpoint desplegado: `POST /api/simulate-registraduria`.
- Frecuencia esperada: 1 tick por minuto.
- Avances simulados observados: `9001` a `9012`.
- Cada tick escribio:
  - 1 boletin nacional.
  - 33 boletines departamentales simulados.
  - 13 resultados nacionales.
  - 429 resultados departamentales.
- El frontend reacciono correctamente porque ya consulta `/api/results-live` cada 60 segundos.
- Supabase acepto escrituras repetidas sin errores visibles.
- Vercel respondio los ticks del simulador con `200`.

## Observaciones tecnicas

- Los ticks reales tardaron mas de 60 segundos entre si en varias corridas. La causa probable es que el intervalo del script empieza despues de terminar cada escritura; como cada tick tarda alrededor de 14-16 segundos, el periodo efectivo queda cerca de 75 segundos.
- `/api/results-live` usa cache `s-maxage=10, stale-while-revalidate=50`. Despues de cambiar de simulacion a datos reales, puede mostrar datos anteriores hasta unos 60 segundos.
- El primer deploy normal quedo en estado `UNKNOWN` en Vercel. El despliegue precompilado con `vercel build --prod` + `vercel deploy --prebuilt --prod` fue estable.
- Quitar una variable de entorno en Vercel no cambia el deployment activo hasta redeplegar. Se hizo redeploy final para que `ENABLE_ELECTION_SIMULATION` quedara realmente apagada.

## Estado final

- Proceso local del simulador: detenido.
- Variable `ENABLE_ELECTION_SIMULATION`: removida de Production en Vercel.
- Endpoint de simulacion: responde `403 Election simulation is disabled`.
- Datos simulados en Supabase: `0` boletines y `0` payloads crudos restantes.
- Ingesta real desde Registraduria ejecutada correctamente.
- Estado publicado:
  - `status`: `ok`
  - `current_avance_num`: `0`
  - `current_boletin_num`: `0`
  - `mesas_instaladas`: `122020`
  - `mesas_informadas`: `0`
  - `votos_validos`: `0`
  - `departmentWinners`: `34`
  - `nationalRows`: `13`

## Datos actuales de Registraduria

Ultima ingesta validada: `2026-05-27T09:32:27.335Z`.

URLs activas:

- Indice: `https://descargas.registraduria.gov.co/PR/0000/DEPRINDEX0000.json`
- Nacional: `https://descargas.registraduria.gov.co/PR/0000/BOL_PR_00_0000_1196.json.gz`
- Departamentos: `https://descargas.registraduria.gov.co/PR/0000/BOL_PR_DE_0000_1196.json.gz`

Top nacional publicado por la fuente actual:

- IVAN CEPEDA CASTRO: `0` votos.
- CLAUDIA LOPEZ: `0` votos.
- RAUL SANTIAGO BOTERO JARAMILLO: `0` votos.
- ABELARDO DE LA ESPRIELLA: `0` votos.
- OSCAR MAURICIO LIZCANO ARANGO: `0` votos.

La fuente actual esta en avance `0`, sin mesas informadas y sin votos. Esto corresponde al estado previo/no activo de jornada.

## Recomendaciones

- Para el dia electoral, activar el job de ingesta real solo cuando se confirme inicio de publicacion oficial.
- Usar un runner externo controlado, preferiblemente n8n/EasyPanel, para pausar/reanudar y monitorear errores.
- Si se requiere frecuencia exacta de 60 segundos, cambiar el script para programar el siguiente tick desde el inicio del tick anterior, no despues de completarlo.
- Mantener el endpoint de simulacion apagado salvo durante ensayos controlados.
