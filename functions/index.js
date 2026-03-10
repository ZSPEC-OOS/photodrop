import { onRequest } from 'firebase-functions/v2/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import express from 'express'

initializeApp()
const db = getFirestore()

const ALLOWED_ORIGIN = 'https://wolfkrow.onrender.com'

const app = express()

// CORS — applied to every request including OPTIONS preflight
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.set('Access-Control-Allow-Credentials', 'true')
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).send('')
  next()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function storagePath(url) {
  try {
    const segment = url.split('/o/')[1]?.split('?')[0] || ''
    return decodeURIComponent(segment)
  } catch {
    return ''
  }
}

function nameFromUrl(url) {
  return storagePath(url).split('/').pop() || 'photo.jpg'
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

// Build a proxy URL so WolfKrow's browser can fetch Firebase Storage images
// cross-origin (Storage has no CORS headers for external origins).
function makeProxyUrl(req, storageUrl) {
  const host = req.get('host')
  return `https://${host}/api/picker/image?url=${encodeURIComponent(storageUrl)}`
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/picker/image?url=<encoded-firebase-storage-url>
// Proxies a Firebase Storage image with CORS headers.
app.get('/api/picker/image', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url parameter required' })

  let decoded
  try { decoded = decodeURIComponent(url) } catch {
    return res.status(400).json({ error: 'invalid url' })
  }

  if (!decoded.startsWith('https://firebasestorage.googleapis.com/')) {
    return res.status(403).json({ error: 'Only Firebase Storage URLs may be proxied' })
  }

  try {
    const upstream = await fetch(decoded)
    if (!upstream.ok) return res.status(upstream.status).end()

    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.set('Cache-Control', 'public, max-age=3600')
    const buffer = await upstream.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (err) {
    console.error('Image proxy error:', err)
    res.status(502).json({ error: 'Failed to fetch image' })
  }
})

// GET /api/picker/folders
app.get('/api/picker/folders', async (req, res) => {
  try {
    const snapshot = await db.collection('folders').orderBy('createdAt', 'desc').get()
    const folders = snapshot.docs.map((doc) => {
      const data = doc.data()
      const firstPhoto = data.photos?.[0] ?? null
      return {
        id: doc.id,
        name: data.title || '',
        photoCount: (data.photos || []).length,
        thumbnailUrl: firstPhoto ? makeProxyUrl(req, firstPhoto) : null,
      }
    })
    res.json(folders)
  } catch (err) {
    console.error('GET /api/picker/folders error:', err)
    res.status(500).json({ error: 'Failed to fetch folders' })
  }
})

// GET /api/picker/folders/:id/photos
app.get('/api/picker/folders/:id/photos', async (req, res) => {
  try {
    const docSnap = await db.collection('folders').doc(req.params.id).get()
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Folder not found' })
    }
    const data = docSnap.data()
    const photos = (data.photos || []).map((url, i) => ({
      id: String(i),
      name: nameFromUrl(url),
      url: makeProxyUrl(req, url),
      thumbnailUrl: makeProxyUrl(req, url),
      mimeType: mimeFromUrl(url),
    }))
    res.json(photos)
  } catch (err) {
    console.error('GET /api/picker/folders/:id/photos error:', err)
    res.status(500).json({ error: 'Failed to fetch photos' })
  }
})

export const api = onRequest(app)
