const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://wolfkrow.onrender.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Proxy Firebase Storage images so WolfKrow's browser can fetch them without
// hitting Firebase Storage's lack of CORS headers for external origins.
export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url parameter required' })

  // Only proxy Firebase Storage URLs — reject anything else to prevent misuse.
  let decoded
  try {
    decoded = decodeURIComponent(url)
  } catch {
    return res.status(400).json({ error: 'invalid url' })
  }

  if (!decoded.startsWith('https://firebasestorage.googleapis.com/')) {
    return res.status(403).json({ error: 'Only Firebase Storage URLs may be proxied' })
  }

  try {
    const upstream = await fetch(decoded)
    if (!upstream.ok) return res.status(upstream.status).end()

    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    const buffer = await upstream.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (err) {
    console.error('Image proxy error:', err)
    res.status(502).json({ error: 'Failed to fetch image' })
  }
}
