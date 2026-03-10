import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, getDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDmTlYeGThBZCVdq5vVnpWDk-Tpw8qE_iY',
  projectId: 'photodump-e1fcb',
}

if (!getApps().length) initializeApp(firebaseConfig)
const db = getFirestore()

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://wolfkrow.onrender.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    const docSnap = await getDoc(doc(db, 'folders', id))

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    const data = docSnap.data()
    const photos = (data.photos || []).map((url, i) => ({
      id: String(i),
      name: nameFromUrl(url),
      url,
      thumbnailUrl: url,
      mimeType: mimeFromUrl(url),
    }))

    res.json(photos)
  } catch (err) {
    console.error('GET /api/picker/folders/[id]/photos error:', err)
    res.status(500).json({ error: 'Failed to fetch photos' })
  }
}
