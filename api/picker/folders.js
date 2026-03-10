const PROJECT_ID = 'photodump-e1fcb'
const API_KEY = 'AIzaSyDmTlYeGThBZCVdq5vVnpWDk-Tpw8qE_iY'
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://wolfkrow.onrender.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Parse a Firestore REST field value into a plain JS value.
function parseField(field) {
  if ('stringValue' in field) return field.stringValue
  if ('integerValue' in field) return Number(field.integerValue)
  if ('booleanValue' in field) return field.booleanValue
  if ('timestampValue' in field) return field.timestampValue
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(parseField)
  if ('mapValue' in field) {
    const out = {}
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) out[k] = parseField(v)
    return out
  }
  return null
}

function parseDoc(firestoreDoc) {
  const out = {}
  for (const [k, v] of Object.entries(firestoreDoc.fields || {})) out[k] = parseField(v)
  return out
}

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Use structured query so we can order by createdAt without a composite index.
    const queryUrl = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'folders' }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      },
    }

    const raw = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody),
    })

    if (!raw.ok) {
      const text = await raw.text()
      console.error('Firestore query failed:', text)
      return res.status(502).json({ error: 'Failed to query Firestore' })
    }

    const results = await raw.json()

    // Route Firebase Storage URLs through our image proxy so WolfKrow's
    // browser can fetch them cross-origin.
    const origin = `https://${req.headers.host}`
    const proxyUrl = (storageUrl) =>
      `${origin}/api/picker/image?url=${encodeURIComponent(storageUrl)}`

    const folders = results
      .filter((r) => r.document) // runQuery can return empty result items
      .map((r) => {
        const id = r.document.name.split('/').pop()
        const data = parseDoc(r.document)
        const firstPhoto = Array.isArray(data.photos) ? data.photos[0] : null
        return {
          id,
          name: data.title || '',
          photoCount: Array.isArray(data.photos) ? data.photos.length : 0,
          thumbnailUrl: firstPhoto ? proxyUrl(firstPhoto) : null,
        }
      })

    res.json(folders)
  } catch (err) {
    console.error('GET /api/picker/folders error:', err)
    res.status(500).json({ error: 'Failed to fetch folders' })
  }
}
