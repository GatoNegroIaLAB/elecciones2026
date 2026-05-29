# Estado de alistamiento electoral - 2026-05-29

Fecha de corte: 2026-05-29  
Cliente: Telemedellin  
App: `telemedellin/`  
Repo: `GatoNegroIaLAB/elecciones2026`  
Produccion: `https://elecciones2026-beta.vercel.app`

## Resumen ejecutivo

Al cierre del 2026-05-29, la landing presidencial queda lista para entrar en operacion automatizada el domingo 31 de mayo de 2026 a las 4:00 p. m. hora de Colombia.

Estado general:

- Produccion publicada y estable en Vercel.
- Root Directory corregido a `telemedellin`.
- Supabase presidencial depurado y endurecido.
- Flujo real con Registraduria restaurado.
- Datos oficiales actuales cargados en cero, como corresponde antes de jornada.
- Refresco visible del frontend programado para iniciar en jornada cada `70` segundos.
- Ingesta automatica programada por Vercel Cron cada `1` minuto.
- Endpoint de cron protegido probado antes de jornada con respuesta correcta `skipped=true`.
- Card de ciudades activa para Medellin, Bogota, Cali y Barranquilla.
- Mapa departamental ajustado para no simular ganadores cuando todo esta en cero.

## Arquitectura operativa

```text
Registraduria -> /api/ingest-registraduria y /api/cron-ingest-registraduria
              -> Supabase pr_*
              -> /api/results-live
              -> landing Next.js en Vercel
```

Principios del flujo:

- El navegador no consulta Registraduria directamente.
- El navegador no necesita acceso directo a tablas base de Supabase.
- La web lee una capa publicada desde `/api/results-live`.
- La ingesta real esta centralizada y compartida en `lib/presidential-ingest.js`.

## Servicios y configuracion confirmada

### GitHub

- Repo confirmado: `GatoNegroIaLAB/elecciones2026`
- Rama activa de despliegue: `main`
- Permisos operativos verificados previamente para escribir en el repo

### Vercel

- Proyecto: `elecciones2026`
- `projectId`: `prj_umQYaRv5V7YcjtKgiyLJ80VNtUvd`
- Team: `team_uKqf9BIiVZHNNA1DPmPXwKjZ`
- Dominio production: `elecciones2026-beta.vercel.app`
- Root Directory corregido y validado: `telemedellin`

### Supabase

- Project ref: `poocwplikbzatcxmcglt`
- Acceso operativo real validado
- SQL ejecutable validado con rol fuerte
- Modelo presidencial funcionando bajo prefijo `pr_*`

### Registraduria

- Fuente: `https://descargas.registraduria.gov.co/`
- Credenciales Basic Auth configuradas
- Indice inicial presidencial: `https://descargas.registraduria.gov.co/PR/0000/DEPRINDEX0000.json`

## Lo que se hizo el 2026-05-29

### 1. Seguridad y depuracion de Supabase

Se aplicaron dos frentes de endurecimiento:

1. Depuracion no destructiva de la superficie presidencial:
   - se cerro lectura publica sobre tablas base `pr_*`
   - se dejaron visibles solo las vistas minimas para runtime
   - se marco `pr_catalog_divipol`, `pr_catalog_corporations` y `pr_catalog_circunscriptions` como fuera de la superficie operativa

2. Endurecimiento de tablas legacy:
   - se activo `RLS` en las tablas viejas del esquema publico
   - se retiraron permisos publicos heredados
   - se elimino el riesgo critico que Supabase estaba reportando sobre tablas sin RLS

Migraciones asociadas:

- `supabase/migrations/20260529000500_harden_presidential_runtime_surface.sql`
- `supabase/migrations/20260529110500_harden_legacy_public_tables.sql`

### 2. Correccion del estado de sincronizacion presidencial

Se corrigio un bug real donde `current_avance_num = 0` podia perderse por usar logica basada en falsy values.

Efecto:

- el avance `0` ya no se convierte incorrectamente en otro valor
- `/api/results-live` refleja de forma fiel el estado previo a jornada

### 3. Card de votacion por ciudades

Se agrego una card nueva con:

- Medellin
- Bogota
- Cali
- Barranquilla

Comportamiento aprobado:

- Desktop: debajo de `Avance nacional`, en la misma columna
- Mobile: debajo de `Señal en vivo`

Importante:

- como Registraduria hoy entrega estos bloques en cero, la UI no inventa un ganador
- si no hay avance, la ciudad muestra estado vacio honesto

### 4. Programacion de jornada

Se dejo lista la activacion automatica para:

- domingo 31 de mayo de 2026
- 4:00 p. m. hora de Colombia
- valor ISO en configuracion: `2026-05-31T16:00:00-05:00`

Politica operativa:

- frontend: refresco visible cada `70` segundos
- backend por Vercel Cron: ejecucion cada `1` minuto

Nota:

- Vercel Cron no permite 70 u 80 segundos exactos
- por eso la ingesta y el refresco visible no tienen la misma cadencia

### 5. Cron protegido en Vercel

Se versiono `vercel.json` con:

```json
{
  "crons": [
    {
      "path": "/api/cron-ingest-registraduria",
      "schedule": "* * * * *"
    }
  ]
}
```

Se dejo el endpoint:

- protegido por `Authorization: Bearer <CRON_SECRET>`
- gobernado por `ENABLE_ELECTION_INGEST_CRON`
- gobernado por `ELECTION_INGEST_START_AT`

### 6. Ajuste del mapa departamental para estado previo a jornada

Antes del ajuste, los departamentos heredaban un color de candidato aunque todo estuviera en cero, lo que visualmente insinuaba una tendencia inexistente.

Se corrigio para que:

- si no hay votos ni mesas reportadas, todos los departamentos se pinten en un color neutro de Telemedellin
- la lista departamental muestre `Sin avance reportado`
- el subtitulo del bloque cambie a `Todos los departamentos en espera de avance oficial`

Color usado:

- `#F1AA41`

## Variables de entorno operativas

### Ya necesarias

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `REGISTRADURIA_USER`
- `REGISTRADURIA_PASS`
- `REVALIDATE_TOKEN`
- `CRON_SECRET`
- `NEXT_PUBLIC_RESULTS_REFRESH_MS`
- `NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT`
- `ENABLE_ELECTION_INGEST_CRON`
- `ELECTION_INGEST_START_AT`

### Configuracion acordada

- `NEXT_PUBLIC_RESULTS_REFRESH_MS=70000`
- `NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT=2026-05-31T16:00:00-05:00`
- `ENABLE_ELECTION_INGEST_CRON=true`
- `ELECTION_INGEST_START_AT=2026-05-31T16:00:00-05:00`

Regla de clasificacion:

- variables `NEXT_PUBLIC_*`: no son secretas, terminan expuestas al frontend
- `CRON_SECRET`, `SUPABASE_SERVICE_KEY`, `REGISTRADURIA_USER`, `REGISTRADURIA_PASS`, `REVALIDATE_TOKEN`: deben tratarse como sensibles

## Verificaciones reales ejecutadas

### Produccion web

Verificado:

- `GET /` responde `200`
- dominio principal sano
- build de produccion servida desde Vercel

### API publica

Verificado:

- `GET /api/results-live` responde `200`
- estado actual observado:
  - `current_avance_num = 0`
  - `current_boletin_num = 0`
  - `mesas_instaladas = 122020`
  - `mesas_informadas = 0`
  - `votos_validos = 0`
  - `votos_blancos = 0`
- candidatos nacionales en cero
- departamentos en cero
- ciudades en cero y sin lider

### Prueba del cron protegido

Prueba ejecutada el 2026-05-29 contra:

- `GET /api/cron-ingest-registraduria`
- header `Authorization: Bearer <CRON_SECRET>`

Resultado real:

```json
{
  "ok": true,
  "skipped": true,
  "reason": "before_start",
  "ingest_start_at": "2026-05-31T21:00:00.000Z"
}
```

Interpretacion:

- la proteccion del endpoint funciona
- la compuerta temporal funciona
- el sistema reconoce que antes del domingo 31 de mayo de 2026 a las 16:00 en Colombia no debe ingerir automaticamente
- la fecha aparece en UTC en la respuesta del runtime, lo cual es esperado

## Commits y despliegues relevantes

### Flujo de automatizacion y jornada

- `592195059661667a6f6b8574a9a562007aa61c42` - runtime programado de jornada
- `adaa3017167a399535f8e983abf60083febfc5b7` - logica compartida de ingesta presidencial
- `2d363c652e03e2b104e5a9e0ad65b8504e7d11d6` - endpoint protegido de cron
- `072328f8c6331e6081b45d324f662e7b0bc97fa1` - `vercel.json` con cron cada minuto
- `c506e30ad3bf8e67b0cb7ba3504f33e87fa62e8a` - refactor de endpoint de ingesta manual
- `a261fee16fdf435ee3a033adf85ad74d30c46a6d` - refresco frontend programado para jornada

### Seguridad y datos

- `a77970a9533c442a3102355db47e2868351fe5b7` - endurecimiento de superficie presidencial
- `ac58cd00390f707a12304f180e5e05570973fb6d` - endurecimiento de tablas legacy
- `b290db66a444995d136ce2a692eee53ff2ad028c` - correccion del `sync_state` con avance `0`

### UI y mapa

- `83eb99b8b19ff28d20332f76fbb213da149788ab` - datos/card de ciudades
- `dde0e934dc1badd7090bac26c6e902d2747cace9` - ocultar lideres vacios en ciudades
- `f497f25bede6ac7aee02872a306dc34c8610551b` - mapa neutral antes de avances

### Deployments

- `dpl_FaiYXuMGmDqQ8kLfk3PxSiTkakpe` - redeploy sano con runtime de jornada
- `dpl_34k3jkSCBw7tDPA8FnazVPzxbc8r` - deploy `READY` con el ajuste del mapa neutral

## Estado funcional que deberia ver otro operador

Antes de jornada:

- web cargando normal
- datos oficiales todos en cero
- ciudades sin ganador
- mapa entero en naranja Telemedellin
- endpoint de cron responde `skipped=true`

Durante jornada, despues de la hora de inicio:

- el cron puede ejecutar ingesta real cada minuto
- la web empieza a refrescarse sola cada 70 segundos
- ciudades, mapa y ranking nacional empiezan a mostrar datos reales

## Riesgos y cosas a tener en cuenta

1. `Vercel Cron` no da frecuencia sub-minuto.
2. La fuente de Registraduria puede cambiar estructura, nombre de archivos o tiempos de publicacion.
3. El avance `0` es preconteo previo a jornada, no debe interpretarse como resultado definitivo.
4. Las credenciales y tokens compartidos por chat deberian rotarse despues del operativo.
5. Las tablas legacy siguen existiendo, pero ya no deben ser la referencia del runtime presidencial.
6. `CONSULADOS` no se pinta en el mapa porque no es un departamento geografico.
7. Las cards superiores y algunos bloques hacen primer render sin datos hasta que corre la lectura cliente; esto es normal en el estado actual del frontend.

## Proximo paso recomendado

Lo siguiente despues de este corte es solo operativo:

1. esperar la jornada
2. vigilar el primer avance real despues de la hora de inicio
3. comprobar que `cron-ingest-registraduria` deje de responder `before_start`
4. validar que `/api/results-live` empiece a moverse con datos reales
5. revisar visualmente ciudades, mapa y ranking nacional con el primer boletin activo
