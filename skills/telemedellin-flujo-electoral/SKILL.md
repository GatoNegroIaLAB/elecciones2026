# SKILL: Telemedellín — Flujo Electoral 2026

## Sistema de ingesta, procesamiento y visualización de resultados electorales en tiempo real

---

## ARQUITECTURA GENERAL

```
Registraduría Nacional (HTTPS + VPN)
               ↓
         n8n (Easypanel)   ← orquestador principal
               ↓
   Supabase (PostgreSQL)   ← base de datos
               ↓
      Vercel (Next.js)     ← app de visualización
               ↓
          Usuario final
```

**Regla fundamental:** n8n es el único componente que se conecta a la Registraduría.
Vercel **NUNCA** se conecta directamente a la Registraduría — solo lee de Supabase.

---

## COMPONENTE 1: n8n

### Entorno (Easypanel → Variables de entorno)

```bash
NODE_FUNCTION_ALLOW_BUILTIN=zlib,buffer,crypto
NODE_FUNCTION_ALLOW_EXTERNAL=*
N8N_ALLOW_EXEC=true
```

### Workflow: TM_eleccionesCongresoV01_03_26

**17 nodos** — se ejecuta cada 60 segundos automáticamente.

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
const results = [];
const corpItems = $('Definir corporaciones').all();
for (let i = 0; i < $input.all().length; i++) {
  const item = $input.all()[i];
  const corp = corpItems[i] ? corpItems[i].json : {};

  let avance;
  if (item.json.Avance) {
    avance = item.json.Avance;
  } else if (item.json.data) {
    const parsed = typeof item.json.data === 'string' ? JSON.parse(item.json.data) : item.json.data;
    avance = parsed.Avance || parsed;
  } else {
    avance = item.json;
  }

  const sigla = corp.sigla;
  const prefijo = corp.prefijo;
  const nombre = corp.nombre;
  const ultimoAvanceHTML = parseInt(avance.Numero || 0, 10);
  const numStr = String(ultimoAvanceHTML).padStart(4, '0');

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
const results = [];

for (let i = 0; i < supaItems.length; i++) {
  const supaData = supaItems[i].json;
  const htmlData = htmlItems[i] ? htmlItems[i].json : {};

  const corporacion = supaData.corporacion;
  const ultimoDB = parseInt(supaData.ultimo_avance_num || -1, 10);
  const ultimoHTML = htmlData.ultimoAvanceHTML || 0;
  const hayNuevo = ultimoHTML > ultimoDB;

  const siglaMap = { 'SENADO':'SE', 'CAMARA':'CA', 'CONSULTAS':'CN' };
  const prefijoMap = { 'SENADO':'DESE', 'CAMARA':'DECA', 'CONSULTAS':'DECN' };
  const sigla = siglaMap[corporacion] || htmlData.sigla || 'SE';
  const prefijo = prefijoMap[corporacion] || htmlData.prefijo || 'DESE';
  const numStr = String(ultimoHTML).padStart(4, '0');

  results.push({ json: {
    corporacion,
    sigla,
    prefijo,
    ultimoAvanceDB: ultimoDB,
    ultimoAvanceHtml: ultimoHTML,
    hayNuevo,
    numeroAvance: ultimoHTML,
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
const results = [];
const corpItems = $('Definir corporaciones').all();

for (let i = 0; i < $input.all().length; i++) {
  const item = $input.all()[i];
  const corp = corpItems[i]?.json || {};

  const avance = item.json.Avance || item.json;
  const sigla = corp.sigla;
  const prefijo = corp.prefijo;
  const nombre = corp.nombre;
  const numStr = String(parseInt(avance.Numero || 0)).padStart(4, '0');

  const base = `https://descargas.registraduria.gov.co/${sigla}/${numStr}/`;

  const urlColombia = avance.URL_Json_COLOMBIA
    ? base + avance.URL_Json_COLOMBIA.replace('./', '')
    : null;

  if (!urlColombia) {
    results.push({ json: { error: 'Sin URL_Json_COLOMBIA', sigla }});
    continue;
  }

  results.push({ json: {
    corporacion: nombre,
    sigla,
    prefijo,
    numeroAvance: parseInt(avance.Numero || 0),
    region: 'NACIONAL',
    urlBoletin: urlColombia
  }});
}

return results;
```
- **Output:** 3 items (1 por corporación) con `urlBoletin` apuntando al boletín COLOMBIA
- **DECISIÓN ARQUITECTURAL IMPORTANTE:** Solo se descarga el boletín NACIONAL (BOL_XX_00_...) y NO los 102 boletines departamentales. Esto reduce el tiempo de procesamiento de 6+ minutos a segundos.

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
- **PROBLEMA CONOCIDO:** n8n NO puede descomprimir .gz en el nodo Code con zlib — usar nodo nativo Compression.

---

#### NODO 11: 🗜️ Compression1
- **Tipo:** Compression (nodo nativo n8n)
- **Función:** Descomprime el archivo .gz
- **Operation:** Decompress
- **Input Binary Field:** `data`
- **Output Prefix:** `data`
- **Output:** 3 items con binario .json descomprimido en `binary.data0`

---

#### NODO 12: 📄 Extract from File
- **Tipo:** Extract from File
- **Función:** Convierte el binario JSON a objeto JavaScript accesible
- **Operation:** Extract from JSON
- **Binary Field:** `data0`
- **Destination Output Field:** `data`
- **Output:** 3 items con `item.json.data` conteniendo el JSON completo del boletín

---

#### NODO 13: 🔧 Normalizar registros
- **Tipo:** Code
- **Función:** Transforma el JSON del boletín al esquema de Supabase, expandiendo por partido
- **Código:**
```javascript
const results = [];

for (const item of $input.all()) {
  try {
    const cab = item.json.data.Boletin[0];
    const circ = cab.Detalle_Circunscripcion;
    const circNacional = circ.find(c => c.Es_Circunscripcion === 'No') || circ[0];
    const partidos = circNacional.Detalle_Partidos_Totales || [];

    for (const p of partidos) {
      results.push({
        json: {
          corporacion: cab.Desc_Corporacion,
          num_avance: parseInt(cab.Avance || 0),
          tipo_boletin: cab.Tipo_Boletin,
          cod_dpto: cab.Departamento,
          nombre_dpto: cab.Desc_Departamento,
          cod_municipio: cab.Municipio || '000',
          nombre_municipio: cab.Desc_Municipio || 'NACIONAL',
          mesas_instaladas: parseInt(cab.Mesas_Instaladas || 0),
          mesas_informadas: parseInt(cab.Mesas_Informadas || 0),
          porc_mesas: parseFloat(cab.Porc_Mesas_Informadas || 0),
          potencial_sufragantes: parseInt(cab.Potencial_Sufragantes || 0),
          total_sufragantes: parseInt(cab.Total_Sufragantes || 0),
          votos_validos: parseInt(cab.Votos_Validos || 0),
          votos_nulos: parseInt(cab.Votos_Nulos || 0),
          votos_no_marcados: parseInt(cab.Votos_No_Marcados || 0),
          cod_partido: p.Partido,
          votos_partido: parseInt(p.Votos || 0),
          porc_partido: parseFloat(p.Porc || 0)
        }
      });
    }
  } catch (e) {
    results.push({ json: { error: e.message } });
  }
}

return results;
```

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
- **Headers:** `Prefer: resolution=merge-duplicates`
- **Body:** `={{ JSON.stringify($input.all().map(i => i.json)) }}`

---

#### NODO 15: ✅ Actualizar control
- **Tipo:** Supabase
- **Función:** Actualiza el último avance procesado en la tabla de control

---

#### NODO 16: 📡 Notificar Vercel
- **Tipo:** HTTP Request
- **Función:** Notifica a Vercel para revalidar la página con datos nuevos
- **Method:** POST
- **URL:** `https://elecciones2026-beta.vercel.app/api/revalidate`
- **Headers:** `x-revalidate-token: tm2026electoral`

---

## COMPONENTE 2: Supabase

### Tablas principales
- `avances_resultados`
- `control_avances`
- `cat_partidos`
- `cat_candidatos`
- `cat_divipol`

### Reset para el día de elecciones

```sql
UPDATE control_avances SET ultimo_avance_num = -1, ultima_actualizacion = NOW();
DELETE FROM avances_resultados;
```

---

## COMPONENTE 3: Vercel (Next.js)

### Variables de entorno en Vercel

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
REGISTRADURIA_USER=TU_USUARIO
REGISTRADURIA_PASS=TU_PASSWORD
REVALIDATE_TOKEN=tm2026electoral
```

### Endpoints API
- `GET /api/proxy-boletin?url=<URL_ENCODED>` → debugging/manual
- `POST /api/revalidate` → llamado por n8n

---

## REGLA OPERATIVA IMPORTANTE

La conexión **Registraduría → Vercel directa** quedó descontinuada.

Arquitectura válida actual:
1. Registraduría → n8n
2. n8n → Supabase
3. Vercel → Supabase
4. n8n → Vercel (solo revalidate)
