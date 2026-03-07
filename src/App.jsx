import { useState, useEffect, useRef } from 'react'
import logo from './PDlogo.png'
import { db, storage } from './firebase'
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import './App.css'

// ─── Views ────────────────────────────────────────────────────────────────────
// 'home'   → list of all saved folders
// 'create' → new-folder screen (name + pick photos)
// 'view'   → view a saved folder's photos

export default function App() {
  const [view, setView] = useState('home')
  const [folders, setFolders] = useState([])
  const [activeFolder, setActiveFolder] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch all folders from Firestore on mount
  useEffect(() => {
    fetchFolders()
  }, [])

  async function fetchFolders() {
    setLoading(true)
    try {
      const q = query(collection(db, 'folders'), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setFolders(data)
    } catch (err) {
      console.error('Error fetching folders:', err)
    }
    setLoading(false)
  }

  function openFolder(folder) {
    setActiveFolder(folder)
    setView('view')
  }

  function goHome() {
    setActiveFolder(null)
    setView('home')
    fetchFolders()
  }

  return (
    <div className="app">
      <Header
        showBack={view !== 'home'}
        onBack={goHome}
        onNew={view === 'home' ? () => setView('create') : null}
        title={
          view === 'view' && activeFolder ? activeFolder.title :
          view === 'create' ? 'New Folder' : null
        }
      />

      {view === 'home' && (
        <HomeView
          folders={folders}
          loading={loading}
          onOpenFolder={openFolder}
          onNew={() => setView('create')}
        />
      )}

      {view === 'create' && (
        <CreateFolderView onDone={goHome} onCancel={goHome} />
      )}

      {view === 'view' && activeFolder && (
        <FolderView folder={activeFolder} onBack={goHome} />
      )}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ showBack, onBack, onNew, title }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-left">
          {showBack && (
            <button className="btn-icon" onClick={onBack} aria-label="Back">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        {title
          ? <span className="header-folder-title">{title}</span>
          : <img src={logo} alt="PhotoDrop" className="header-logo" />
        }
        <div className="header-right">
          {onNew && (
            <button className="btn-icon" onClick={onNew} aria-label="New folder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Home View ────────────────────────────────────────────────────────────────
function HomeView({ folders, loading, onOpenFolder, onNew }) {
  if (loading) {
    return (
      <div className="center-msg">
        <div className="spinner" />
        <p>Loading folders…</p>
      </div>
    )
  }

  if (folders.length === 0) {
    return (
      <div className="center-msg">
        <div className="empty-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="rgba(212,168,67,0.55)" strokeWidth="1.5" fill="none"/>
          </svg>
        </div>
        <p className="empty-title">No folders yet</p>
        <p className="empty-sub">Tap + to create your first folder</p>
        <button className="btn-primary" onClick={onNew}>Create Folder</button>
      </div>
    )
  }

  return (
    <main className="main">
      <p className="section-label">{folders.length} folder{folders.length !== 1 ? 's' : ''}</p>
      <div className="folder-grid">
        {folders.map((folder) => (
          <FolderCard key={folder.id} folder={folder} onClick={() => onOpenFolder(folder)} />
        ))}
      </div>
    </main>
  )
}

// ─── Folder Card ──────────────────────────────────────────────────────────────
function FolderCard({ folder, onClick }) {
  const cover = folder.photos?.[0] || null
  const count = folder.photos?.length || 0

  return (
    <button className="folder-card" onClick={onClick}>
      <div className="folder-thumb">
        {cover ? (
          <img src={cover} alt={folder.title} className="folder-cover" />
        ) : (
          <div className="folder-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                stroke="#aaa" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
        )}
        <span className="folder-count">{count} photo{count !== 1 ? 's' : ''}</span>
      </div>
      <p className="folder-name">{folder.title}</p>
    </button>
  )
}

// ─── Create Folder View ───────────────────────────────────────────────────────
function CreateFolderView({ onDone, onCancel }) {
  const [title, setTitle] = useState('')
  const [previews, setPreviews] = useState([])   // { file, url }[]
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cameraOnly, setCameraOnly] = useState(false)
  const inputRef = useRef(null)

  // Programmatic focus after mount — avoids iOS tap-to-focus failures
  // that occur intermittently right after a React view transition
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [])

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const newPreviews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }))
    setPreviews((prev) => [...prev, ...newPreviews])
    // reset input so the same file can be added again if needed
    e.target.value = ''
  }

  function removePhoto(index) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleDone() {
    if (!title.trim()) {
      setError('Please enter a folder name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      // Upload each photo to Firebase Storage.
      // crypto.randomUUID() ensures a unique path for every file regardless
      // of filename (camera apps often reuse "image.jpg") or upload timing,
      // preventing the same storage path—and therefore duplicate URLs—from
      // being generated when multiple photos are saved at once.
      const photoUrls = await Promise.all(
        previews.map(async ({ file }) => {
          const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
          const storageRef = ref(
            storage,
            `folders/${crypto.randomUUID()}.${ext}`
          )
          await uploadBytes(storageRef, file)
          return getDownloadURL(storageRef)
        })
      )

      // Save folder document to Firestore
      await addDoc(collection(db, 'folders'), {
        title: title.trim(),
        photos: photoUrls,
        createdAt: serverTimestamp(),
      })

      // Cleanup object URLs
      previews.forEach(({ url }) => URL.revokeObjectURL(url))
      onDone()
    } catch (err) {
      console.error('Error saving folder:', err)
      setError(`Save failed: ${err.code || err.message || 'Unknown error'}`)
    }
    setSaving(false)
  }

  return (
    <main className="main create-view">
      <div className="field">
        <label className="field-label" htmlFor="folder-title">Folder Name</label>
        <input
          ref={inputRef}
          id="folder-title"
          className="field-input"
          type="text"
          placeholder="e.g. Summer 2025"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field-label">Photos</label>

        {/* Photo previews */}
        {previews.length > 0 && (
          <div className="photo-grid">
            {previews.map((p, i) => (
              <div key={i} className="photo-thumb-wrap">
                <img src={p.url} alt={`photo ${i + 1}`} className="photo-thumb" />
                <button
                  className="photo-remove"
                  onClick={() => removePhoto(i)}
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Camera / Gallery picker */}
        <label className="btn-add-photo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
              stroke="currentColor" strokeWidth="1.8" fill="none"/>
            <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8"/>
          </svg>
          Add Photos
          <input
            type="file"
            accept="image/*"
            multiple
            {...(cameraOnly ? { capture: 'environment' } : {})}
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
        </label>

        <label className="camera-only-toggle">
          <input
            type="checkbox"
            checked={cameraOnly}
            onChange={(e) => setCameraOnly(e.target.checked)}
          />
          Camera only (skip picker)
        </label>

        <p className="hint">{cameraOnly ? 'Opens camera directly' : 'Opens camera or photo library on iPhone'}</p>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <button
        className={`btn-primary btn-done ${saving ? 'loading' : ''}`}
        onClick={handleDone}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Done — Save Folder'}
      </button>

      <button className="btn-ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </main>
  )
}

// ─── Folder View ──────────────────────────────────────────────────────────────
function FolderView({ folder, onBack }) {
  const [lightbox, setLightbox] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!window.confirm(`Delete "${folder.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      // Deletes the Firestore document; Storage files are orphaned but harmless
      await deleteDoc(doc(db, 'folders', folder.id))
      onBack()
    } catch (err) {
      console.error('Error deleting folder:', err)
      alert(`Delete failed: ${err.code || err.message}`)
      setDeleting(false)
    }
  }

  return (
    <main className="main folder-view">
      <p className="section-label">
        {folder.photos?.length || 0} photo{folder.photos?.length !== 1 ? 's' : ''}
      </p>

      {folder.photos?.length === 0 && (
        <div className="center-msg">
          <p className="empty-sub">No photos in this folder.</p>
        </div>
      )}

      <div className="photo-grid">
        {folder.photos?.map((url, i) => (
          <div key={i} className="photo-thumb-wrap" onClick={() => setLightbox(url)}>
            <img src={url} alt={`${folder.title} ${i + 1}`} className="photo-thumb" />
          </div>
        ))}
      </div>

      <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
        {deleting ? 'Deleting…' : 'Delete Folder'}
      </button>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" className="lightbox-img" />
          <button className="lightbox-close">×</button>
        </div>
      )}
    </main>
  )
}
