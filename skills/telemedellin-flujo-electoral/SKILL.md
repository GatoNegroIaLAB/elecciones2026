# SKILL: Telemedellín — Flujo Electoral 2026
## Sistema de ingesta, procesamiento y visualización de resultados electorales en tiempo real

---

## ARQUITECTURA GENERAL

```
Registraduría Nacional (HTTPS + VPN)
        ↓
   n8n (Easypanel)          ← orquestador principal
        ↓
   Supabase (PostgreSQL)    ← base de datos
        ↓
   Vercel (Next.js)         ← app de visualización
        ↓
   Usuario final
```

**Regla fundamental:** n8n es el único componente que se conecta a la Registraduría. Vercel NUNCA se conecta directamente a la Registraduría — solo lee de Supabase.

---

## COMPONENTE 1: n8n

### Entorno (Easypanel → Variables de entorno)
```
NODE_FUNCTION_ALLOW_BUILTIN=zlib,buffer,crypto
NODE_FUNCTION_ALLOW_EXTERNAL=*
N8N_ALLOW_EXEC=true
```

### Workflow: TM_eleccionesCongresoV01_03_26
**17 nodos** — se ejecuta cada 60 segundos automáticamente.

> Nota operativa: en algunos entornos también aparece `TM_eleccionesCongresoV01_02_26`.
> Siempre trabajar sobre el workflow activo/vigente en n8n y mantener esta skill sincronizada.

---

### FLUJO COMPLETO PASO A PASO

#### NODO 1: ⏱ Cada 60 segundos
- **Tipo:** Schedule Trigger
- **Función:** Dispara el workflow cada 60 segundos
- **Importante:** Solo activo el día de elecciones. Desactivar en días normales para no consumir recursos.

---

#### NODO 2: Definir corporaciones
- **Tipo:** Code
- **Función:** Define las 3 corporaciones a procesar en paralelo
- **Código:**
```javascript
return [
  { json: { sigla: "SE", nombre: "SENADO",    prefijo: "DESE", ultimoConocido: 0 } },
  { json: { sigla: "CA", nombre: "CAMARA",    prefijo: "DECA", ultimoConocido: 0 } },
  { json: { sigla: "CN", nombre: "CONSULTAS", prefijo: "DECN", ultimoConocido: 0 } }
];
```
- **Output:** 3 items (uno por corporación)
- **IMPORTANTE:** El campo `ultimoConocido` debe ser 0 al inicio del día de elecciones. Si se reinicia el sistema, verificar que este valor esté en 0.

---

#### NODO 3: GET indice JSON
- **Tipo:** HTTP Request
- **Función:** Descarga el índice de avances disponibles para cada corporación
- **URL:** 
```
https://descargas.registraduria.gov.co/{{ $json.sigla }}/{{ String($json.ultimoConocido).padStart(4,'0') }}/{{ $json.prefijo }}INDEX{{ String($json.ultimoConocido).padStart(4,'0') }}.json
```
- **Authentication:** Generic Credential Type → Basic Auth → "Unnamed credential"
- **Output:** JSON con estructura `{ Avance: { Numero: "0000", URL_Json_COLOMBIA: "./BOL_SE_00_0000_XXXX.json.gz", ... } }`
- **Nota:** La URL del índice usa el avance 0000 como punto de partida para descubrir el avance actual.

---

#### NODO 4: Extraer número avance HTML
- **Tipo:** Code
- **Función:** Extrae el número de avance actual del JSON del índice y construye la URL del índice real
- **Código:**
```javascript
const results   = [];
const corpItems = $('Definir corporaciones').all();

for (let i = 0; i < $input.all().length; i++) {
  const item = $input.all()[i];
  const corp = corpItems[i] ? corpItems[i].json : {};

  let avance;
  if (item.json.Avance) {
    avance = item.json.Avance;
  } else if (item.json.data) {
    const parsed = typeof item.json.data === 'string'
      ? JSON.parse(item.json.data) : item.json.data;
    avance = parsed.Avance || parsed;
  } else {
    avance = item.json;
  }

  const sigla            = corp.sigla;
  const prefijo          = corp.prefijo;
  const nombre           = corp.nombre;
  const ultimoAvanceHTML = parseInt(avance.Numero || 0, 10);
  const numStr           = String(ultimoAvanceHTML).padStart(4, '0');

  results.push({ json: {
    sigla, nombre, prefijo,
    ultimoAvanceHTML,
    numStr,
    urlIndice: `https://descargas.registraduria.gov.co/${sigla}/${numStr}/${prefijo}INDEX${numStr}.json`,
    avanceData: avance
  }});
}

return results;
```
- **Output:** 3 items con `ultimoAvanceHTML` y `urlIndice`

---

#### NODO 5: 📊 Leer control Supabase
- **Tipo:** Supabase
- **Función:** Lee el último avance procesado por corporación desde la tabla de control
- **Resource:** Row
- **Operation:** Get Many
- **Table:** control_avances
- **Output:** 3 items con `{ corporacion, ultimo_avance_num, ultima_actualizacion }`

---

#### NODO 6: ⚡ ¿Avance nuevo?
- **Tipo:** Code
- **Función:** Compara el avance actual de la Registraduría vs el último guardado en Supabase
- **Código:**
```javascript
const htmlItems = $('Extraer número avance HTML').all();
const supaItems = $input.all();
const results   = [];

for (let i = 0; i < supaItems.length; i++) {
  const supaData    = supaItems[i].json;
  const htmlData    = htmlItems[i] ? htmlItems[i].json : {};

  const corporacion = supaData.corporacion;
  const ultimoDB    = parseInt(supaData.ultimo_avance_num || -1, 10);
  const ultimoHTML  = htmlData.ultimoAvanceHTML || 0;
  const hayNuevo    = ultimoHTML > ultimoDB;

  const siglaMap   = { 'SENADO':'SE', 'CAMARA':'CA', 'CONSULTAS':'CN' };
  const prefijoMap = { 'SENADO':'DESE', 'CAMARA':'DECA', 'CONSULTAS':'DECN' };
  const sigla      = siglaMap[corporacion]   || htmlData.sigla   || 'SE';
  const prefijo    = prefijoMap[corporacion] || htmlData.prefijo || 'DESE';
  const numStr     = String(ultimoHTML).padStart(4, '0');

  results.push({ json: {
    corporacion, sigla, prefijo,
    ultimoAvanceDB:   ultimoDB,
    ultimoAvanceHtml: ultimoHTML,
    hayNuevo,
    numeroAvance:     ultimoHTML,
    urlIndice: `https://descargas.registraduria.gov.co/${sigla}/${numStr}/${prefijo}INDEX${numStr}.json`
  }});
}

return results;
```
- **Output:** 3 items con `hayNuevo: true/false`

---

#### NODO 7: ❓ ¿Es nuevo?
- **Tipo:** IF
- **Función:** Filtra — solo continúa si `hayNuevo === true`
- **Condición:** `{{ $json.hayNuevo }}` equals `true` (boolean)
- **Rama TRUE:** continúa al GET índice real
- **Rama FALSE:** termina el flujo para esa corporación

---

#### NODO 8: GET índice real JSON
- **Tipo:** HTTP Request
- **Función:** Descarga el índice del avance nuevo con las URLs de los boletines
- **URL:** `={{ $json.urlIndice }}`
- **Authentication:** Basic Auth → "Unnamed credential"
- **Output:** JSON completo del índice con `URL_Json_COLOMBIA`, `URL_Json_DEPARTAMENTOS`, etc.

---

#### NODO 9: Parsear URLs departamentos
- **Tipo:** Code
- **Función:** Extrae SOLO la URL del boletín NACIONAL (Colombia) de cada corporación
- **Código:**
```javascript
const results   = [];
const corpItems = $('Definir corporaciones').all();

for (let i = 0; i < $input.all().length; i++) {
  const item   = $input.all()[i];
  const corp   = corpItems[i]?.json || {};
  const avance = item.json.Avance || item.json;
  const sigla  = corp.sigla;
  const prefijo = corp.prefijo;
  const nombre  = corp.nombre;
  const numStr  = String(parseInt(avance.Numero || 0)).padStart(4, '0');
  const base    = `https://descargas.registraduria.gov.co/${sigla}/${numStr}/`;

  const urlColombia = avance.URL_Json_COLOMBIA
    ? base + avance.URL_Json_COLOMBIA.replace('./', '')
    : null;

  if (!urlColombia) {
    results.push({ json: { error: 'Sin URL_Json_COLOMBIA', sigla }});
    continue;
  }

  results.push({ json: {
    corporacion:  nombre,
    sigla,
    prefijo,
    numeroAvance: parseInt(avance.Numero || 0),
    region:       'NACIONAL',
    urlBoletin:   urlColombia
  }});
}

return results;
```
- **Output:** 3 items (1 por corporación) con `urlBoletin` apuntando al boletín COLOMBIA
- **DECISIÓN ARQUITECTURAL IMPORTANTE:** Solo se descarga el boletín NACIONAL (BOL_XX_00_...) y NO los 102 boletines departamentales. Esto reduce el tiempo de procesamiento de 6+ minutos a segundos. Los datos departamentales pueden agregarse en el futuro si se necesitan.

---

#### NODO 10: ⬇️ GET boletín .json.gz
- **Tipo:** HTTP Request
- **Función:** Descarga el boletín .json.gz de la Registraduría
- **URL:** `={{ $json.urlBoletin }}`
- **Authentication:** Generic Credential Type → Basic Auth → "Unnamed credential"
- **Response Format:** File
- **Put Output in Field:** `data`
- **Batching:** 5 requests por lote, 1000ms de intervalo (para evitar 502 Bad Gateway)
- **Output:** 3 items con binario .gz en `binary.data`
- **PROBLEMA CONOCIDO:** n8n NO puede descomprimir .gz en el nodo Code con zlib — el binario llega corrupto vía JavaScript. La solución es usar el nodo nativo Compression.

---

#### NODO 11: 🗜️ Compression1
- **Tipo:** Compression (nodo nativo n8n)
- **Función:** Descomprime el archivo .gz
- **Operation:** Decompress
- **Input Binary Field:** `data`
- **Output Prefix:** `data`
- **Output:** 3 items con binario .json descomprimido en `binary.data0`
- **NOTA:** El nodo nativo Compression funciona correctamente. NO usar zlib en nodo Code — siempre falla con "incorrect header check".

---

#### NODO 12: 📄 Extract from File
- **Tipo:** Extract from File
- **Función:** Convierte el binario JSON a objeto JavaScript accesible
- **Operation:** Extract from JSON
- **Binary Field:** `data0`
- **Destination Output Field:** `data`
- **Output:** 3 items con `item.json.data` conteniendo el JSON completo del boletín
- **Estructura del JSON:**
```json
{
  "data": {
    "Boletin": [{
      "Avance": "0001",
      "Desc_Corporacion": "SENADO",
      "Tipo_Boletin": "NACIONAL",
      "Departamento": "00",
      "Mesas_Instaladas": 126647,
      "Mesas_Informadas": 45231,
      "Porc_Mesas_Informadas": 35.7,
      "Potencial_Sufragantes": 41287084,
      "Total_Sufragantes": 18234567,
      "Votos_Validos": 17890123,
      "Votos_Nulos": 234567,
      "Votos_No_Marcados": 109877,
      "Detalle_Circunscripcion": [{
        "Circunscripcion": "NACIONAL",
        "Es_Circunscripcion": "No",
        "Detalle_Partidos_Totales": [{
          "Partido": "00001",
          "Votos": 2345678,
          "Porc": 13.12
        }],
        "Detalle_Candidato": [...]
      }]
    }]
  }
}
```

---

#### NODO 13: 🔧 Normalizar registros
- **Tipo:** Code
- **Función:** Transforma el JSON del boletín al esquema de Supabase, expandiendo por partido
- **Código:**
```javascript
const results = [];

for (const item of $input.all()) {
  try {
    const cab  = item.json.data.Boletin[0];
    const circ = cab.Detalle_Circunscripcion;
    
    // Circunscripción NACIONAL = Es_Circunscripcion: "No"
    const circNacional = circ.find(c => c.Es_Circunscripcion === 'No') || circ[0];
    const partidos     = circNacional.Detalle_Partidos_Totales || [];

    for (const p of partidos) {
      results.push({ json: {
        corporacion:           cab.Desc_Corporacion,
        num_avance:            parseInt(cab.Avance || 0),
        tipo_boletin:          cab.Tipo_Boletin,
        cod_dpto:              cab.Departamento,
        nombre_dpto:           cab.Desc_Departamento,
        cod_municipio:         cab.Municipio || '000',
        nombre_municipio:      cab.Desc_Municipio || 'NACIONAL',
        mesas_instaladas:      parseInt(cab.Mesas_Instaladas || 0),
        mesas_informadas:      parseInt(cab.Mesas_Informadas || 0),
        porc_mesas:            parseFloat(cab.Porc_Mesas_Informadas || 0),
        potencial_sufragantes: parseInt(cab.Potencial_Sufragantes || 0),
        total_sufragantes:     parseInt(cab.Total_Sufragantes || 0),
        votos_validos:         parseInt(cab.Votos_Validos || 0),
        votos_nulos:           parseInt(cab.Votos_Nulos || 0),
        votos_no_marcados:     parseInt(cab.Votos_No_Marcados || 0),
        cod_partido:           p.Partido,
        votos_partido:         parseInt(p.Votos || 0),
        porc_partido:          parseFloat(p.Porc || 0)
      }});
    }
  } catch(e) {
    results.push({ json: { error: e.message }});
  }
}

return results;
```
- **Output:** N items (uno por partido × corporación). En avance 0 = 9 items (3 corporaciones × 3 partidos especiales). En avance real = ~30-50 items.
- **NOTA sobre códigos especiales:** En avance 0 solo aparecen `00995` (votos por lista), `00996` (votos en blanco), `00999` (votos válidos total). Los partidos reales aparecen a partir del avance 1.

---

#### NODO 14: 💾 Upsert Supabase (HTTP Request)
- **Tipo:** HTTP Request
- **Función:** Inserta o actualiza registros en Supabase (upsert)
- **Method:** POST
- **URL:** 
```
https://TU_PROYECTO.supabase.co/rest/v1/avances_resultados?on_conflict=corporacion,num_avance,tipo_boletin,cod_dpto,cod_municipio,cod_partido
```
- **Authentication:** Predefined Credential Type → Supabase API
- **Headers:**
  - `Prefer`: `resolution=merge-duplicates`
- **Body:** Using JSON → `={{ JSON.stringify($input.all().map(i => i.json)) }}`
- **IMPORTANTE:** El parámetro `on_conflict` en la URL es esencial para el upsert. Sin él, da error 409 en registros duplicados.
- **Restricción única en Supabase:**
```sql
UNIQUE (corporacion, num_avance, tipo_boletin, cod_dpto, cod_municipio, cod_partido)
```

---

#### NODO 15: ✅ Actualizar control
- **Tipo:** Supabase
- **Función:** Actualiza el último avance procesado en la tabla de control
- **Resource:** Row
- **Operation:** Update
- **Table:** control_avances
- **Select Condition:** `corporacion` equals `{{ $('⚡ ¿Avance nuevo?').first().json.corporacion }}`
- **Fields to Update:**
  - `ultimo_avance_num`: `{{ $('⚡ ¿Avance nuevo?').first().json.ultimoAvanceHtml }}`
  - `ultima_actualizacion`: `{{ new Date().toISOString() }}`

---

#### NODO 16: 📡 Notificar Vercel
- **Tipo:** HTTP Request
- **Función:** Notifica a Vercel para revalidar la página con datos nuevos
- **Method:** POST
- **URL:** `https://elecciones2026-beta.vercel.app/api/revalidate`
- **Headers:**
  - `x-revalidate-token`: `tm2026electoral` (debe coincidir con variable `REVALIDATE_TOKEN` en Vercel)
- **Body:** Using JSON:
```json
{
  "corporacion": "{{ $('⚡ ¿Avance nuevo?').first().json.nombre }}",
  "avance": "{{ $('⚡ ¿Avance nuevo?').first().json.ultimoAvanceHtml }}"
}
```

---

## COMPONENTE 2: Supabase

### Tablas principales

#### `avances_resultados`
Tabla central — un registro por partido por boletín.
```sql
CREATE TABLE avances_resultados (
  id                    SERIAL PRIMARY KEY,
  corporacion           TEXT,        -- 'SENADO', 'CAMARA', 'CONSULTAS'
  num_avance            INTEGER,     -- número de avance (0, 1, 2, ...)
  tipo_boletin          TEXT,        -- 'NACIONAL'
  cod_dpto              TEXT,        -- '00' para nacional
  nombre_dpto           TEXT,
  cod_municipio         TEXT,        -- '000' para nacional
  nombre_municipio      TEXT,
  cod_partido           TEXT,        -- '00001', '00002', etc.
  nombre_partido        TEXT,        -- NULL (se resuelve con cat_partidos)
  votos_partido         INTEGER,
  porc_partido          NUMERIC,
  mesas_instaladas      INTEGER,
  mesas_informadas      INTEGER,
  porc_mesas            NUMERIC,
  potencial_sufragantes INTEGER,
  total_sufragantes     INTEGER,
  votos_validos         INTEGER,
  votos_nulos           INTEGER,
  votos_no_marcados     INTEGER,
  timestamp_registro    TIMESTAMP DEFAULT NOW(),
  CONSTRAINT avances_resultados_unique 
    UNIQUE (corporacion, num_avance, tipo_boletin, cod_dpto, cod_municipio, cod_partido)
);
```

#### `control_avances`
Rastrea el último avance procesado por corporación.
```sql
CREATE TABLE control_avances (
  corporacion          TEXT PRIMARY KEY,
  ultimo_avance_num    INTEGER DEFAULT -1,
  ultima_actualizacion TIMESTAMP
);

-- Datos iniciales
INSERT INTO control_avances VALUES ('SENADO', -1, NOW());
INSERT INTO control_avances VALUES ('CAMARA', -1, NOW());
INSERT INTO control_avances VALUES ('CONSULTAS', -1, NOW());
```

#### `cat_partidos`
Catálogo de partidos políticos.
```sql
CREATE TABLE cat_partidos (
  codigo  TEXT PRIMARY KEY,  -- '00001', '00002', etc.
  nombre  TEXT
);
```

#### `cat_candidatos`
Catálogo de candidatos.

#### `cat_divipol`
Catálogo de puestos de votación (14,430 registros).

### Query principal de la app
```sql
SELECT 
  a.corporacion, a.num_avance, a.tipo_boletin,
  a.cod_partido, p.nombre as nombre_partido,
  a.votos_partido, a.porc_partido,
  a.mesas_instaladas, a.mesas_informadas, a.porc_mesas,
  a.potencial_sufragantes, a.total_sufragantes,
  a.votos_validos, a.votos_nulos
FROM avances_resultados a
LEFT JOIN cat_partidos p ON p.codigo = a.cod_partido
WHERE a.corporacion = 'SENADO'
  AND a.tipo_boletin = 'NACIONAL'
ORDER BY a.votos_partido DESC;
```

### Reset para el día de elecciones
```sql
-- Ejecutar la mañana del día de elecciones
UPDATE control_avances SET ultimo_avance_num = -1, ultima_actualizacion = NOW();
DELETE FROM avances_resultados;
```

---

## COMPONENTE 3: Vercel (Next.js)

### Variables de entorno en Vercel
```
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
REGISTRADURIA_USER=TU_USUARIO
REGISTRADURIA_PASS=TU_PASSWORD
REVALIDATE_TOKEN=tm2026electoral
```

### Endpoints API

#### `GET /api/proxy-boletin?url=<URL_ENCODED>`
Proxy para descargar y descomprimir boletines .json.gz.
- **Uso:** Solo para consultas manuales desde el navegador o debugging
- **NO usar en producción** para el flujo masivo — n8n lo hace directamente
- Requiere que la URL esté codificada con `encodeURIComponent()`

#### `POST /api/revalidate`
Revalida la página principal cuando hay datos nuevos.
- **Header requerido:** `x-revalidate-token: tm2026electoral`
- **Body:** `{ corporacion, avance }`
- **Llamado por:** n8n después de cada upsert exitoso

### Flujo de datos en la app
1. Página carga → `getResultados('SENADO')` → query a Supabase
2. Calcula curules con cifra repartidora D'Hondt
3. Suscripción Realtime de Supabase para actualizaciones automáticas
4. Refresco cada 60 segundos como respaldo

---

## PROBLEMAS CONOCIDOS Y SOLUCIONES

### ❌ "incorrect header check" en zlib
- **Causa:** n8n corrompe el binario .gz al guardarlo en `binary.data` con filesystem mode
- **Solución:** Usar el nodo nativo **Compression** de n8n (nunca zlib en Code)

### ❌ "filesystem-v2" en `binaryData.data`
- **Causa:** n8n en modo filesystem guarda una referencia, no el contenido
- **Solución:** Usar nodo **Extract from File** después de Compression

### ❌ 502 Bad Gateway de la Registraduría
- **Causa:** Demasiadas peticiones simultáneas (102 boletines en paralelo)
- **Solución:** Descargar solo el boletín NACIONAL (3 requests en lugar de 102)

### ❌ 409 Duplicate Key en Supabase
- **Causa:** El nodo Supabase no tiene operación Upsert nativa
- **Solución:** Usar HTTP Request con `?on_conflict=...` en la URL y header `Prefer: resolution=merge-duplicates`

### ❌ `this.helpers.getBinaryDataBuffer` devuelve vacío
- **Causa:** No funciona en modo "Run Once for All Items" en algunas versiones de n8n
- **Solución:** Usar nodo Extract from File en lugar de código JavaScript

### ❌ Vercel no puede conectarse a la Registraduría
- **Causa:** La Registraduría requiere VPN — Vercel no tiene acceso
- **Solución:** n8n (que sí tiene VPN) hace todas las descargas. Vercel solo lee Supabase.

---

## CHECKLIST DÍA DE ELECCIONES

### Antes de las elecciones (6:00 AM)
- [ ] Verificar que n8n esté corriendo en Easypanel
- [ ] Ejecutar reset en Supabase:
  ```sql
  UPDATE control_avances SET ultimo_avance_num = -1;
  DELETE FROM avances_resultados;
  ```
- [ ] Verificar conexión VPN activa
- [ ] Activar workflow en n8n (Enable)
- [ ] Verificar que `ultimoConocido: 0` en nodo "Definir corporaciones"

### Durante las elecciones
- [ ] Monitorear logs en n8n → Executions
- [ ] Verificar que Supabase recibe datos cada vez que hay avance nuevo
- [ ] Si hay error 502: reducir batching o esperar y reintentar

### Si el flujo falla
1. Abrir n8n → Executions → ver el error
2. Si es error de conexión: verificar VPN
3. Si es error de Supabase: verificar credenciales
4. Si es error de parsing: el formato del JSON cambió — revisar nodo "Normalizar registros"
5. Reiniciar workflow manualmente con "Execute workflow"

---

## ESTRUCTURA DE URLs DE LA REGISTRADURÍA

```
Base: https://descargas.registraduria.gov.co

Índice inicial:
/{SIGLA}/{AVANCE_PADDED}/{PREFIJO}INDEX{AVANCE_PADDED}.json
Ejemplo: /SE/0000/DESEINDEX0000.json

Boletín NACIONAL:
/{SIGLA}/{AVANCE_PADDED}/BOL_{SIGLA}_00_{AVANCE_PADDED}_{TIMESTAMP}.json.gz
Ejemplo: /SE/0001/BOL_SE_00_0001_8703.json.gz
```

**Siglas:**
- `SE` → Senado (prefijo: `DESE`)
- `CA` → Cámara (prefijo: `DECA`)  
- `CN` → Consultas (prefijo: `DECN`)

**Avance padded:** número de avance con 4 dígitos → `0000`, `0001`, `0025`, etc.

---

## VERSIONES Y ARCHIVOS

| Archivo | Descripción |
|---------|-------------|
| `TM_eleccionesCongresoV01_03_26.json` | Workflow n8n productivo actual |
| `telemedellin-app.zip` | Código fuente Next.js/Vercel |
| `telemedellin_catalogo_v2.zip` | SQLs de catálogos (partidos, candidatos, divipol) |

**Repositorio GitHub:** conectado a Vercel para deploy automático
**App Vercel:** https://elecciones2026-beta.vercel.app

---

## NUBE DE PALABRAS — REDES SOCIALES

### Arquitectura
```
Apify (c/30min) → webhook → Vercel /api/procesar-palabras → Supabase → app
```

### Tablas Supabase
```sql
-- palabras con frecuencia por fuente
CREATE TABLE palabras_nube (
  id          SERIAL PRIMARY KEY,
  palabra     TEXT NOT NULL,
  frecuencia  INTEGER DEFAULT 1,
  fuente      TEXT NOT NULL CHECK (fuente IN ('instagram', 'twitter')),
  activa      BOOLEAN DEFAULT true,
  editada     BOOLEAN DEFAULT false,
  timestamp   TIMESTAMP DEFAULT NOW(),
  UNIQUE(palabra, fuente)
);

-- configuración editorial
CREATE TABLE config_nube (
  id              SERIAL PRIMARY KEY,
  max_palabras    INTEGER DEFAULT 80,
  forma           TEXT DEFAULT 'colombia',
  stopwords_extra TEXT[] DEFAULT '{}',
  activa          BOOLEAN DEFAULT true
);
```

### Función Supabase (upsert acumulativo)
```sql
CREATE OR REPLACE FUNCTION upsert_palabras_nube(p_palabras JSONB)
RETURNS void AS $$
DECLARE item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_palabras)
  LOOP
    INSERT INTO palabras_nube (palabra, frecuencia, fuente)
    VALUES (item->>'palabra', (item->>'frecuencia')::INTEGER, item->>'fuente')
    ON CONFLICT (palabra, fuente)
    DO UPDATE SET
      frecuencia = palabras_nube.frecuencia + EXCLUDED.frecuencia,
      timestamp  = NOW()
    WHERE palabras_nube.editada = false;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### Actors de Apify
| Actor | ID | Precio | Campo de texto |
|-------|----|--------|----------------|
| Instagram Hashtag Scraper | `apify/instagram-hashtag-scraper` | $2.30/1K | `caption` + `hashtags[]` |
| Twitter Scraper | `apidojo/twitter-scraper-lite` | pay per event | `text` |

### Hashtags configurados
`#Elecciones2026`, `#Congreso2026`, `elecciones senado cámara voto`

### Webhooks Apify configurados
- **Instagram:** `POST https://elecciones2026-beta.vercel.app/api/procesar-palabras?fuente=instagram&token=tm2026apify`
- **Twitter:** `POST https://elecciones2026-beta.vercel.app/api/procesar-palabras?fuente=twitter&token=tm2026apify`
- **Payload template:** `{"resource": {{resource}}, "eventData": {{eventData}}}`
- **Headers template:** `{"Content-Type": "application/json"}`

### Variables de entorno Vercel (nuevas)
```
APIFY_WEBHOOK_TOKEN=tm2026apify
APIFY_API_TOKEN=<token de Apify Settings → Integrations>
SUPABASE_SERVICE_KEY=<service_role key de Supabase Settings → API>
```

### Endpoint Vercel
`pages/api/procesar-palabras.js`
- Recibe webhook de Apify
- Descarga dataset via `https://api.apify.com/v2/datasets/{id}/items`
- Limpia texto: elimina URLs, menciones, stopwords en español
- Extrae palabras del `caption` (Instagram) o `text` (Twitter)
- Extrae hashtags con regex `/#(\w+)/g`
- Hace upsert acumulativo en Supabase via RPC `upsert_palabras_nube`

### Costo estimado día de elecciones
- Instagram: ~$15-20 (48 runs × ~500 posts × $2.30/1K)
- Twitter: mínimo (pay per event)
- **Total: ~$20-25**

---

## CHECKLIST DÍA DE ELECCIONES — NUBE DE PALABRAS

### Antes (la noche anterior)
```sql
-- Limpiar datos de prueba
DELETE FROM palabras_nube;
```

### El día (antes de arrancar cobertura)
1. **Apify — Instagram Scraper** → Schedules → New Schedule → Every 30 minutes → Activar
2. **Apify — Twitter Scraper** → Schedules → New Schedule → Every 30 minutes → Activar
3. **Vercel** → `pages/index.js` → cambiar `LIVE_MODE = false` a `LIVE_MODE = true` → commit → deploy

### Si la nube no aparece
- Verificar en Apify que los runs estén ejecutándose (Runs tab)
- Verificar en Supabase que `palabras_nube` tenga registros
- Revisar logs en Vercel → Functions → `procesar-palabras`
- Probar manualmente con curl:
```bash
curl -X POST \
  "https://elecciones2026-beta.vercel.app/api/procesar-palabras?fuente=instagram&token=tm2026apify" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"defaultDatasetId":"ID_DEL_DATASET"},"eventData":{}}'
```

### Reset si hay palabras incorrectas
```sql
-- Desactivar una palabra específica
UPDATE palabras_nube SET activa = false WHERE palabra = 'palabra_no_deseada';

-- Borrar todo y empezar de cero
DELETE FROM palabras_nube;
```
