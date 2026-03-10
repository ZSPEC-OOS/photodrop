const PROJECT_ID = 'photodump-e1fcb'
const API_KEY = 'AIzaSyDmTlYeGThBZCVdq5vVnpWDk-Tpw8qE_iY'
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://wolfkrow.onrender.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

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

// Extract the decoded filename from a Firebase Storage download URL.
// e.g. .../o/folders%2Fabc123.jpg?alt=media  →  "abc123.jpg"
function nameFromUrl(url) {
  try {
    const segment = url.split('/o/')[1]?.split('?')[0] || ''
    return decodeURIComponent(segment).split('/').pop() || 'photo.jpg'
  } catch {
    return 'photo.jpg'
  }
}

function mimeFromUrl(url) {
  const ext = nameFromUrl(url).split('.').pop().toLowerCase()
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
    heif: 'image/heif', avif: 'image/avif',
  }
  return map[ext] || 'image/jpeg'
}

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { id } = req.query
    const docUrl = `${FIRESTORE_BASE}/folders/${id}?key=${API_KEY}`
    const raw = await fetch(docUrl)

    if (raw.status === 404) return res.status(404).json({ error: 'Folder not found' })

    if (!raw.ok) {
      const text = await raw.text()
      console.error('Firestore fetch failed:', text)
      return res.status(502).json({ error: 'Failed to fetch from Firestore' })
    }

    const firestoreDoc = await raw.json()
    const data = parseDoc(firestoreDoc)

    // Route Firebase Storage URLs through our image proxy so WolfKrow's
    // browser can fetch them cross-origin.
    const origin = `https://${req.headers.host}`
    const proxyUrl = (storageUrl) =>
      `${origin}/api/picker/image?url=${encodeURIComponent(storageUrl)}`

    const photos = (Array.isArray(data.photos) ? data.photos : []).map((url, i) => ({
      id: String(i),
      name: nameFromUrl(url),
      url: proxyUrl(url),
      thumbnailUrl: proxyUrl(url),
      mimeType: mimeFromUrl(url),
    }))

    res.json(photos)
  } catch (err) {
    console.error('GET /api/picker/folders/[id]/photos error:', err)
    res.status(500).json({ error: 'Failed to fetch photos' })
  }
}
