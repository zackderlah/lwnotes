const DB_NAME = 'note-app-sync'
const DB_VERSION = 1
const STORE = 'kv'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

/**
 * @param {object} payload Must include `savedAt` ISO string
 */
export async function saveSnapshotToIndexedDB(payload) {
  const db = await openDb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).put(payload, 'library-snapshot')
    })
  } finally {
    db.close()
  }
}

/** @returns {Promise<object | null>} */
export async function loadSnapshotFromIndexedDB() {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const r = tx.objectStore(STORE).get('library-snapshot')
      r.onsuccess = () => resolve(r.result ?? null)
      r.onerror = () => reject(r.error)
    })
  } finally {
    db.close()
  }
}

/** Serializable snapshot for backup / restore (future). */
export function buildSnapshotPayload(state) {
  return {
    format: 'note-app-library',
    version: 1,
    savedAt: new Date().toISOString(),
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    notesByTab: state.notesByTab,
    selectedByTab: state.selectedByTab,
    libraryFoldersByTab: state.libraryFoldersByTab,
  }
}

export function formatSavedAtLabel(iso) {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}
