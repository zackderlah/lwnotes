import { INITIAL_TABS, CORE_TAB_IDS } from './data/notes.js'
import { INITIAL_LIBRARY_FOLDERS_BY_TAB } from './data/folders.js'

/** Fresh install: no sample notes; minimal folders. */
export const DEFAULT_APP_STATE = {
  tabs: INITIAL_TABS,
  activeTabId: INITIAL_TABS[0].id,
  notesByTab: {
    notes: [],
    archive: [],
    preferences: [],
  },
  selectedByTab: {
    notes: null,
    archive: null,
    preferences: null,
  },
  libraryFoldersByTab: INITIAL_LIBRARY_FOLDERS_BY_TAB,
}

/**
 * Validate and normalize a snapshot from IndexedDB / export.
 * Preserves custom tab keys in `notesByTab` / `selectedByTab` / `libraryFoldersByTab`.
 * @param {unknown} raw
 * @returns {typeof DEFAULT_APP_STATE | null}
 */
export function normalizeLibrarySnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.format !== 'note-app-library' || raw.version !== 1) return null

  const tabs = Array.isArray(raw.tabs) && raw.tabs.length > 0 ? raw.tabs : null
  if (!tabs) return null

  const tabIds = new Set(tabs.map((t) => t.id))
  let activeTabId =
    typeof raw.activeTabId === 'string' && tabIds.has(raw.activeTabId)
      ? raw.activeTabId
      : tabs[0].id

  const nbt =
    raw.notesByTab && typeof raw.notesByTab === 'object' ? raw.notesByTab : {}
  const notesByTab = { ...DEFAULT_APP_STATE.notesByTab }
  for (const [key, val] of Object.entries(nbt)) {
    if (Array.isArray(val)) notesByTab[key] = val
  }
  for (const id of CORE_TAB_IDS) {
    if (!Array.isArray(notesByTab[id])) notesByTab[id] = []
  }

  const sbt =
    raw.selectedByTab && typeof raw.selectedByTab === 'object'
      ? raw.selectedByTab
      : {}
  const selectedByTab = { ...DEFAULT_APP_STATE.selectedByTab, ...sbt }

  const lfb =
    raw.libraryFoldersByTab && typeof raw.libraryFoldersByTab === 'object'
      ? raw.libraryFoldersByTab
      : {}
  const libraryFoldersByTab = { ...INITIAL_LIBRARY_FOLDERS_BY_TAB }
  for (const [key, val] of Object.entries(lfb)) {
    if (Array.isArray(val)) libraryFoldersByTab[key] = val
  }

  return {
    tabs,
    activeTabId,
    notesByTab,
    selectedByTab,
    libraryFoldersByTab,
  }
}
