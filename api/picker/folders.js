import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore'

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

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const q = query(collection(db, 'folders'), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    const folders = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.title || '',
        photoCount: (data.photos || []).length,
        thumbnailUrl: data.photos?.[0] ?? null,
      }
    })
    res.json(folders)
  } catch (err) {
    console.error('GET /api/picker/folders error:', err)
    res.status(500).json({ error: 'Failed to fetch folders' })
  }
}
