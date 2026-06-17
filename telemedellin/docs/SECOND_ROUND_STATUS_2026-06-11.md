# Estado de segunda vuelta - 2026-06-11

Fecha de corte: 2026-06-11 (hora de Colombia / America/Bogota)

## Objetivo de este documento

Dejar un estado legible para una persona o asistente nuevo que llegue al proyecto y necesite entender:

- en qué punto quedó la transición de primera a segunda vuelta;
- qué ya se cambió en código, datos y despliegue;
- qué sigue antes de jornada;
- dónde mirar primero si algo no cuadra.

## Resumen ejecutivo

El sistema ya no está operando sobre los datos de primera vuelta. Se hizo un corte limpio y el proyecto quedó dedicado a **segunda vuelta presidencial**.

Estado real al cierre de este documento:

- Supabase `pr_*` reseteado para segunda vuelta.
- Catálogos oficiales nuevos cargados: `2` partidos y `2` candidatos.
- Landing simplificada para una contienda de dos fórmulas.
- Variables de arranque de jornada alineadas para el **domingo 21 de junio de 2026 a las 4:00 p. m. hora Colombia**.
- Cron de Vercel todavía retirado del repo; no hay consultas automáticas activas a Registraduría.
- Color de `Defensores de la Patria / Abelardo De La Espriella` corregido a `#DA7100`.

## Cambios realizados

### 1. Corte operativo de primera vuelta

Se decidió no conservar la operación de primera vuelta en las tablas activas `pr_*`.

Se aplicó un reset controlado sobre:

- `pr_results`
- `pr_boletins`
- `pr_raw_payloads`
- `pr_catalog_parties`
- `pr_catalog_candidates`
- `pr_sync_state`

Resultado esperado y verificado:

- `pr_catalog_parties = 2`
- `pr_catalog_candidates = 2`
- `pr_boletins = 0`
- `pr_results = 0`
- `pr_raw_payloads = 0`
- `pr_sync_state.status = idle`

### 2. Carga de básicos oficiales de segunda vuelta

Los archivos entregados por Registraduría para segunda vuelta se revisaron y se confirmó que:

- `PARTIDOS.TXT` ahora trae `2` filas reales de tarjetón.
- `CANDIDATOS.TXT` ahora trae `2` filas reales de tarjetón.
- el encoding de entrega oficial viene en `iso-8859-1`.

Para soportarlo:

- se ajustó `scripts/import-registraduria-basics.mjs`
- se versionaron los básicos nuevos en `data/registraduria-basics/v03`

Actualización posterior revisada el 2026-06-17:

- Registraduría entregó un nuevo paquete de básicos identificado operativamente como `v4`.
- Ese paquete mantiene el mismo catálogo de segunda vuelta.
- La diferencia real frente al `v03` versionado es:
  - `CANDIDATOS` corrige `IVÁN`
  - `PARTIDOS` corrige `MOVIMIENTO POLÍTICO PACTO HISTÓRICO`
  - `CIRCUNSCRIPCION` y `CORPORACION` no cambian
  - `DIVIPOL` coincide con el `v02` ya versionado
- A partir de esa revisión se creó `data/registraduria-basics/v04`.

Catálogo operativo actual:

- `00026` — Movimiento Político Pacto Histórico
- `01003` — Defensores de la Patria
- `00026/001` — IVÁN CEPEDA CASTRO
- `01003/002` — ABELARDO DE LA ESPRIELLA

### 3. Ajustes de frontend para segunda vuelta

La landing dejó de estar pensada para trece candidatos y pasó a una lectura más limpia para dos.

Cambios funcionales:

- copy `Candidatos en contienda` -> `Candidatos en segunda vuelta`
- solo dos cards principales de candidatos
- fallback pre-jornada con ambos candidatos visibles en `0`
- mantenimiento del bloque `Avance nacional`
- mantenimiento del bloque `Votación por ciudades`

Cambios de layout en desktop:

- fila superior:
  - columna 1: `Candidatos en segunda vuelta`
  - columna 2: `Avance nacional`
- fila inferior:
  - `Votación por ciudades` a ancho completo
  - ciudades distribuidas en dos columnas visuales

En móvil se conservó el orden que ya funcionaba:

1. Avance nacional
2. Dos cards principales
3. Señal en vivo
4. Votación por ciudades
5. Candidatos en segunda vuelta
6. Mapa

### 4. Programación de jornada para segunda vuelta

Se dejó el sistema preparado para anunciar el inicio de actualizaciones el:

- **domingo 21 de junio de 2026**
- **4:00 p. m.**
- **hora Colombia / America/Bogota**

Esto ya quedó alineado en:

- código
- `.env.local.example`
- variables reales de Vercel Production

Variables relevantes:

- `NEXT_PUBLIC_RESULTS_AUTO_REFRESH_START_AT=2026-06-21T16:00:00-05:00`
- `ELECTION_INGEST_START_AT=2026-06-21T16:00:00-05:00`

Importante:

- `vercel.json` sigue sin cron activo
- la jornada automática no arrancará sola hasta que se decida reactivar cron de forma explícita

### 5. Corrección de color oficial

Se detectó que `Defensores de la Patria / Abelardo De La Espriella` estaba quedando con azul heredado.

Corrección aplicada:

- color correcto: `#DA7100`

Se corrigió en:

- `pages/index.js`
- `scripts/import-registraduria-basics.mjs`
- Supabase mediante migración `20260611173000_fix_runoff_party_color.sql`

## Archivos clave

Código:

- `pages/index.js`
- `lib/election-runtime.js`
- `pages/api/results-live.js`
- `pages/api/ingest-registraduria.js`
- `scripts/import-registraduria-basics.mjs`

Datos y migraciones:

- `data/registraduria-basics/v03`
- `data/registraduria-basics/v04`
- `supabase/migrations/20260611150000_prepare_second_round_reset.sql`
- `supabase/migrations/20260611153000_load_second_round_basics.sql`
- `supabase/migrations/20260611173000_fix_runoff_party_color.sql`

Documentación base:

- `README.md`
- `docs/PROJECT_HANDOFF.md`
- `docs/PRESIDENTIAL_DATA_FLOW.md`

## Despliegue y validaciones

Validaciones ya hechas:

- Vercel production responde bien después de la transición.
- Supabase quedó con catálogos de segunda vuelta solamente.
- Variables reales de Vercel quedaron alineadas al 2026-06-21 16:00 COT.
- El color `#DA7100` quedó persistido en base y reflejado en frontend.

Últimos despliegues relevantes de esta fase:

- `dpl_CNPMBVcncddHjd6sYyZszJGQbYz9` — alineación de variables de jornada
- `dpl_J6xj3oRukomDnnRZzSQSGiFXGWyb` — copy `Candidatos en segunda vuelta`
- `dpl_UMwX74NaH6ayAiA1D4Qsb5i3XWJH` — nuevo layout desktop para dos candidatos
- `dpl_HDZzrvoQXdCNnAtZjv7q9jRFh8BV` — corrección de color `#DA7100`

## Qué sigue

### Antes del día de elecciones

1. Confirmar si el cron volverá a correr desde Vercel o desde otro orquestador.
2. Rehabilitar la ingesta automática solo cuando esté confirmada la operación de jornada.
3. Hacer una verificación corta contra Registraduría con los archivos reales de segunda vuelta.
4. Hacer una pasada visual final de la landing en desktop y móvil con datos en cero.

### El día de elecciones

1. Validar que Registraduría esté publicando el índice esperado.
2. Confirmar que `pr_sync_state` cambie de `idle` a `ok` sin `last_error`.
3. Revisar `/api/results-live`.
4. Si algo falla, mirar en este orden:
   - `pr_sync_state.last_error`
   - logs de Vercel
   - logs de Postgres / Supabase

## Riesgos y notas

- La zona horaria del entorno del agente puede no ser Colombia; la referencia operativa del proyecto sigue siendo **America/Bogota**.
- El cron sigue apagado en el repo; eso es correcto por ahora, pero hay que recordar reactivarlo antes de jornada si se decide automatizar desde Vercel.
- No guardar credenciales reales en documentación ni en commits.
- Los archivos oficiales de Registraduría no deben asumirse como `utf-8`; el importador ya quedó preparado, pero conviene recordar el detalle.

## Estado final de esta fase

La transición a segunda vuelta quedó técnicamente lista.  
Lo que falta ya no es una limpieza estructural sino el encendido controlado de operación para jornada.
