import { htmlToPlainText } from '../noteHtml.js'
import { DEFAULT_NOTE_FOLDER_ID } from './notes.js'

/** Virtual folder id: every note in the tab. */
export const ALL_FOLDER_ID = 'all'

/** Initial library rows per tab (includes virtual “All …” row). */
export const INITIAL_LIBRARY_FOLDERS_BY_TAB = {
  notes: [
    { id: ALL_FOLDER_ID, label: 'All Notes' },
    { id: 'personal', label: 'Personal' },
  ],
}

/**
 * True if another folder in the list already uses this label (case-insensitive).
 * @param {Array<{ id: string, label: string }>} folders
 * @param {string} label
 * @param {string | null} [exceptFolderId] folder id to exclude (e.g. when renaming)
 */
export function isFolderLabelTaken(folders, label, exceptFolderId = null) {
  const n = String(label ?? '').trim().toLowerCase()
  if (!n) return false
  return folders.some(
    (f) =>
      f.id !== exceptFolderId &&
      String(f.label ?? '').trim().toLowerCase() === n,
  )
}

export function countNotesInFolder(notes, folderId) {
  if (!notes?.length) return 0
  if (folderId === ALL_FOLDER_ID) return notes.length
  return notes.filter((n) => (n.folderId ?? 'personal') === folderId).length
}

export function filterNotesByFolder(notes, folderId) {
  if (!notes?.length) return []
  if (folderId === ALL_FOLDER_ID) return notes
  return notes.filter((n) => (n.folderId ?? 'personal') === folderId)
}

/** Normalize sidebar folder selection to a non-empty id array (supports legacy single-id state). */
export function normalizeFolderSelection(raw) {
  if (raw == null) return [ALL_FOLDER_ID]
  if (Array.isArray(raw)) {
    return raw.length ? raw : [ALL_FOLDER_ID]
  }
  return [raw]
}

/**
 * Notes visible when one or more folders are selected (union). If `all` is included, every note is included.
 */
export function filterNotesByFolders(notes, folderIds) {
  if (!notes?.length) return []
  const ids = normalizeFolderSelection(folderIds)
  if (ids.includes(ALL_FOLDER_ID)) return notes
  if (ids.length === 1) return filterNotesByFolder(notes, ids[0])
  const set = new Set(ids)
  return notes.filter((n) => set.has(n.folderId ?? DEFAULT_NOTE_FOLDER_ID))
}

export function filterNotesBySearch(notes, rawQuery) {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return notes
  return notes.filter((n) => {
    const title = (n.title ?? '').toLowerCase()
    const preview = (n.preview ?? '').toLowerCase()
    const body = htmlToPlainText(n.body ?? '').toLowerCase()
    return title.includes(q) || preview.includes(q) || body.includes(q)
  })
}

/**
 * Move `activeId` relative to `overId`: `before` = insert before that row, `after` = insert after.
 * Index 0 (`ALL_FOLDER_ID`) stays fixed. Dropping after `ALL_FOLDER_ID` inserts at index 1.
 */
export function reorderLibraryFolders(
  folders,
  activeId,
  overId,
  position = 'before',
) {
  if (activeId === ALL_FOLDER_ID) return folders
  if (activeId === overId) return folders

  if (overId === ALL_FOLDER_ID) {
    if (position !== 'after') return folders
    const from = folders.findIndex((f) => f.id === activeId)
    if (from <= 0) return folders
    const next = [...folders]
    const [moved] = next.splice(from, 1)
    next.splice(1, 0, moved)
    return next
  }

  const from = folders.findIndex((f) => f.id === activeId)
  const targetIdx = folders.findIndex((f) => f.id === overId)
  if (from <= 0 || targetIdx <= 0) return folders

  const next = [...folders]
  const [moved] = next.splice(from, 1)

  let ref = next.findIndex((f) => f.id === overId)
  if (ref < 0) return folders

  const insertAt = position === 'before' ? ref : ref + 1
  next.splice(insertAt, 0, moved)
  return next
}
