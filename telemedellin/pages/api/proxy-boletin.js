import https from 'https'
import zlib from 'zlib'

// Proxy para descargar y descomprimir boletines .json.gz de la Registraduría
// n8n llama este endpoint en lugar de descargar el .gz directamente
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.query
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  // Validar que la URL sea de la Registraduría
  if (!url.includes('descargas.registraduria.gov.co')) {
    return res.status(403).json({ error: 'URL no permitida' })
  }

  const user = process.env.REGISTRADURIA_USER
  const pass = process.env.REGISTRADURIA_PASS
  const auth = Buffer.from(`${user}:${pass}`).toString('base64')

  try {
    const json = await new Promise((resolve, reject) => {
      const options = {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept-Encoding': 'gzip',
          'User-Agent': 'Mozilla/5.0'
        }
      }

      https.get(url, options, (response) => {
        // Manejar redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          https.get(response.headers.location, options, handleResponse)
          return
        }
        handleResponse(response)
      }).on('error', reject)

      function handleResponse(response) {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }

        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () => {
          const buffer = Buffer.concat(chunks)
          zlib.gunzip(buffer, (err, decompressed) => {
            if (err) {
              // Si falla gunzip, intentar leer directo como JSON
              try {
                resolve(JSON.parse(buffer.toString('utf8')))
              } catch (e) {
                reject(new Error(`Gunzip error: ${err.message}`))
              }
              return
            }
            try {
              resolve(JSON.parse(decompressed.toString('utf8')))
            } catch (e) {
              reject(new Error(`JSON parse error: ${e.message}`))
            }
          })
        })
        response.on('error', reject)
      }
    })

    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).json(json)

  } catch (error) {
    return res.status(500).json({ error: error.message, url })
  }
}

export const config = {
  api: { responseLimit: '10mb' }
}
