import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Tabs from './components/Tabs.jsx'
import NotesWorkspace from './components/NotesWorkspace.jsx'
import Editor from './components/Editor.jsx'
import ArchiveView from './components/ArchiveView.jsx'
import PreferencesView from './components/PreferencesView.jsx'
import ContextMenu from './components/ContextMenu.jsx'
import { useHistoryState } from './hooks/useHistoryState.js'
import {
  CORE_TAB_IDS,
  formatDeletedLabel,
  DEFAULT_NOTE_FOLDER_ID,
  DEFAULT_NOTE_TITLE,
  DEFAULT_NOTE_PREVIEW,
  noteHasArchivableContent,
  ARCHIVE_KIND_NOTE,
  ARCHIVE_KIND_FOLDER,
} from './data/notes.js'
import {
  ALL_FOLDER_ID,
  filterNotesByFolder,
  filterNotesBySearch,
  isFolderLabelTaken,
  reorderLibraryFolders,
} from './data/folders.js'
import { DEFAULT_APP_STATE, normalizeLibrarySnapshot } from './libraryState.js'
import {
  applyThemeToDocument,
  readStoredTheme,
  syncElectronTitleBarForTheme,
  THEME_STORAGE_KEY,
} from './theme.js'
import GlobalSearchPalette from './components/GlobalSearchPalette.jsx'
import { htmlToPlainText } from './noteHtml.js'
import {
  isChordRedoShiftZ,
  isShortcutRecording,
  matchShortcutAction,
  readStoredShortcutBindings,
} from './shortcuts.js'
import { exportLibraryToZipDownload } from './libraryExport.js'
import {
  buildSnapshotPayload,
  formatSavedAtLabel,
  loadSnapshotFromIndexedDB,
  saveSnapshotToIndexedDB,
} from './cloudBackup.js'
import {
  readStoredCloudSyncEnabled,
  writeStoredCloudSyncEnabled,
  writeLastSyncAtIso,
  readLastSyncAtIso,
} from './cloudSyncSettings.js'
import {
  clearGoogleSession,
  getGoogleClientId,
  readPersistedGoogleSession,
  requestGoogleAccessToken,
} from './google/googleAuth.js'
import {
  clearDriveSyncState,
  syncLibraryToGoogleDrive,
} from './google/driveSync.js'
import {
  applyCompactSidebarToDocument,
  readStoredCompactSidebar,
  writeStoredCompactSidebar,
} from './compactSidebar.js'
import {
  mergeObsidianImportIntoState,
  parseObsidianVaultFiles,
} from './importObsidian.js'

export default function App() {
  const { state, commit, undo, redo } = useHistoryState(DEFAULT_APP_STATE)
  const { tabs, activeTabId, notesByTab, selectedByTab, libraryFoldersByTab } =
    state

  const [contextMenu, setContextMenu] = useState(null)
  const showContextMenu = useCallback((menu) => setContextMenu(menu), [])
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const [interfaceTheme, setInterfaceTheme] = useState(readStoredTheme)
  const [compactSidebar, setCompactSidebar] = useState(readStoredCompactSidebar)

  const [folderByTab, setFolderByTab] = useState(() => ({
    notes: ALL_FOLDER_ID,
  }))
  const [searchByTab, setSearchByTab] = useState(() => ({
    notes: '',
  }))
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [shortcutBindings, setShortcutBindings] = useState(
    readStoredShortcutBindings,
  )
  const notesSearchInputRef = useRef(null)

  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(
    readStoredCloudSyncEnabled,
  )
  const [lastSyncLabel, setLastSyncLabel] = useState(() =>
    formatSavedAtLabel(readLastSyncAtIso()),
  )
  const [cloudSyncError, setCloudSyncError] = useState(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [libraryHydrated, setLibraryHydrated] = useState(false)
  const [googleSessionActive, setGoogleSessionActive] = useState(
    () => !!readPersistedGoogleSession(),
  )
  const [driveSyncBusy, setDriveSyncBusy] = useState(false)

  useEffect(() => {
    const refreshGoogle = () => {
      setGoogleSessionActive(!!readPersistedGoogleSession())
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshGoogle()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = await loadSnapshotFromIndexedDB()
        if (cancelled) return
        const next = normalizeLibrarySnapshot(raw)
        if (next) {
          commit(() => next, { recordHistory: false })
        }
      } catch {
        /* ignore corrupt / unavailable IDB */
      } finally {
        if (!cancelled) setLibraryHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [commit])

  useEffect(() => {
    if (!libraryHydrated) return
    const id = setTimeout(() => {
      void (async () => {
        try {
          await saveSnapshotToIndexedDB(buildSnapshotPayload(state))
        } catch {
          /* ignore quota / private mode */
        }
      })()
    }, 500)
    return () => clearTimeout(id)
  }, [state, libraryHydrated])

  const runCloudBackup = useCallback(async () => {
    try {
      const payload = buildSnapshotPayload(state)
      writeLastSyncAtIso(payload.savedAt)
      setLastSyncLabel(formatSavedAtLabel(payload.savedAt))
      setCloudSyncError(null)
      if (globalThis.noteApp?.writeCloudBackup) {
        await globalThis.noteApp.writeCloudBackup(JSON.stringify(payload))
      }
      if (cloudSyncEnabled) {
        if (!readPersistedGoogleSession()) {
          setGoogleSessionActive(false)
        } else {
          setDriveSyncBusy(true)
          try {
            const r = await syncLibraryToGoogleDrive(state)
            if (!r.ok) {
              setCloudSyncError(
                r.error ? `Google Drive: ${r.error}` : 'Google Drive sync failed',
              )
              setGoogleSessionActive(!!readPersistedGoogleSession())
            }
          } finally {
            setDriveSyncBusy(false)
          }
        }
      }
    } catch (e) {
      setCloudSyncError(e?.message ?? 'Backup failed')
    }
  }, [state, cloudSyncEnabled])

  useEffect(() => {
    if (!cloudSyncEnabled || !libraryHydrated) return
    const id = setTimeout(() => {
      void runCloudBackup()
    }, 2000)
    return () => clearTimeout(id)
  }, [state, cloudSyncEnabled, libraryHydrated, runCloudBackup])

  const handleCloudSyncChange = useCallback(
    (enabled) => {
      setCloudSyncEnabled(enabled)
      writeStoredCloudSyncEnabled(enabled)
      if (!enabled) {
        setCloudSyncError(null)
      }
    },
    [],
  )

  const handleGoogleConnect = useCallback(async () => {
    try {
      setCloudSyncError(null)
      await requestGoogleAccessToken({ prompt: 'consent' })
      setGoogleSessionActive(true)
      if (cloudSyncEnabled && libraryHydrated) {
        setDriveSyncBusy(true)
        try {
          const r = await syncLibraryToGoogleDrive(state)
          if (!r.ok) {
            setCloudSyncError(
              r.error ? `Google Drive: ${r.error}` : 'Google Drive sync failed',
            )
          }
        } finally {
          setDriveSyncBusy(false)
        }
      }
    } catch (e) {
      setCloudSyncError(e?.message ?? 'Google sign-in failed')
    }
  }, [cloudSyncEnabled, libraryHydrated, state])

  const handleGoogleDisconnect = useCallback(() => {
    clearGoogleSession()
    clearDriveSyncState()
    setGoogleSessionActive(false)
    setCloudSyncError(null)
  }, [])

  const handleDriveSyncNow = useCallback(async () => {
    if (!readPersistedGoogleSession()) {
      setCloudSyncError('Connect a Google account first.')
      return
    }
    setCloudSyncError(null)
    setDriveSyncBusy(true)
    try {
      const r = await syncLibraryToGoogleDrive(state)
      if (!r.ok) {
        setCloudSyncError(
          r.error ? `Google Drive: ${r.error}` : 'Google Drive sync failed',
        )
        setGoogleSessionActive(!!readPersistedGoogleSession())
        return
      }
      const payload = buildSnapshotPayload(state)
      writeLastSyncAtIso(payload.savedAt)
      setLastSyncLabel(formatSavedAtLabel(payload.savedAt))
    } finally {
      setDriveSyncBusy(false)
    }
  }, [state])

  const handleExportLibrary = useCallback(async () => {
    setExportBusy(true)
    try {
      await exportLibraryToZipDownload(state)
    } catch (err) {
      window.alert(
        `Export failed: ${err?.message ?? String(err)}`,
      )
    } finally {
      setExportBusy(false)
    }
  }, [state])

  const handleImportObsidianFiles = useCallback(
    async (fileList) => {
      if (!fileList?.length) return
      setImportBusy(true)
      try {
        const { folders, notes, skipped, errors } =
          await parseObsidianVaultFiles(fileList)
        if (notes.length === 0) {
          window.alert(
            skipped > 0
              ? `No markdown files found. The .obsidian folder and non-.md files are skipped (${skipped} skipped).`
              : 'No markdown (.md) files found in the chosen folder.',
          )
          return
        }
        commit(
          (prev) => mergeObsidianImportIntoState(prev, folders, notes),
          { recordHistory: true },
        )
        if (notes[0]?.folderId) {
          setFolderByTab((prev) => ({
            ...prev,
            notes: notes[0].folderId,
          }))
        }
        const errTail =
          errors.length > 0
            ? `\n\n${errors.length} file(s) failed to read.`
            : ''
        window.alert(
          `Imported ${notes.length} note(s); ${folders.length} folder group(s) in the Library.${skipped ? ` Skipped ${skipped} file(s) (non-markdown or .obsidian).` : ''}${errTail}`,
        )
      } catch (err) {
        window.alert(`Import failed: ${err?.message ?? String(err)}`)
      } finally {
        setImportBusy(false)
      }
    },
    [commit],
  )

  useEffect(() => {
    applyThemeToDocument(interfaceTheme)
    syncElectronTitleBarForTheme(interfaceTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, interfaceTheme)
    } catch {
      /* ignore */
    }
  }, [interfaceTheme])

  useEffect(() => {
    applyCompactSidebarToDocument(compactSidebar)
    writeStoredCompactSidebar(compactSidebar)
  }, [compactSidebar])

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const notes = notesByTab[activeTabId] ?? []
  const selectedNoteId = selectedByTab[activeTabId] ?? null

  const libraryFolders = libraryFoldersByTab?.[activeTabId] ?? []

  const selectedFolderId = folderByTab[activeTabId] ?? ALL_FOLDER_ID
  const notesSearchQuery = searchByTab.notes ?? ''

  const visibleNotes = useMemo(() => {
    if (activeTabId === 'archive' || activeTabId === 'preferences') return []
    const byFolder = filterNotesByFolder(notes, selectedFolderId)
    return filterNotesBySearch(byFolder, notesSearchQuery)
  }, [activeTabId, notes, selectedFolderId, notesSearchQuery])

  const globalSearchResults = useMemo(() => {
    const list = notesByTab.notes ?? []
    return filterNotesBySearch(list, notesSearchQuery)
  }, [notesByTab, notesSearchQuery])

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  )

  useEffect(() => {
    if (activeTabId === 'archive' || activeTabId === 'preferences') return
    const ids = new Set(visibleNotes.map((n) => n.id))
    if (selectedNoteId != null && !ids.has(selectedNoteId)) {
      commit(
        (prev) => ({
          ...prev,
          selectedByTab: {
            ...prev.selectedByTab,
            [activeTabId]: visibleNotes[0]?.id ?? null,
          },
        }),
        { recordHistory: false },
      )
    }
  }, [activeTabId, visibleNotes, selectedNoteId, commit])

  useEffect(() => {
    if (activeTabId !== 'notes') return
    const ids = new Set(libraryFolders.map((f) => f.id))
    if (!ids.has(selectedFolderId)) {
      setFolderByTab((prev) => ({ ...prev, [activeTabId]: ALL_FOLDER_ID }))
    }
  }, [activeTabId, libraryFolders, selectedFolderId])

  const handleChangeTitle = (title) => {
    if (!selectedNoteId) return
    const targetTabId = activeTabId
    const targetNoteId = selectedNoteId
    commit(
      (prev) => ({
        ...prev,
        notesByTab: {
          ...prev.notesByTab,
          [targetTabId]: (prev.notesByTab[targetTabId] ?? []).map((n) =>
            n.id === targetNoteId ? { ...n, title } : n,
          ),
        },
      }),
      { coalesceKey: `title:${targetTabId}:${targetNoteId}` },
    )
  }

  const handleChangeBody = (body) => {
    if (!selectedNoteId) return
    const targetTabId = activeTabId
    const targetNoteId = selectedNoteId
    const plain = htmlToPlainText(body)
    const firstLine =
      plain.split('\n').find((line) => line.trim().length > 0) ?? ''
    commit(
      (prev) => ({
        ...prev,
        notesByTab: {
          ...prev.notesByTab,
          [targetTabId]: (prev.notesByTab[targetTabId] ?? []).map((n) =>
            n.id === targetNoteId
              ? { ...n, body, preview: firstLine.slice(0, 120) }
              : n,
          ),
        },
      }),
      { coalesceKey: `body:${targetTabId}:${targetNoteId}` },
    )
  }

  const handleRefresh = () => {
    if (!selectedNoteId) return
    const targetTabId = activeTabId
    const targetNoteId = selectedNoteId
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const suffix = hours >= 12 ? 'PM' : 'AM'
    const displayHour = ((hours + 11) % 12) + 1
    const label = `Last edited today at ${displayHour}:${minutes} ${suffix}`
    commit((prev) => ({
      ...prev,
      notesByTab: {
        ...prev.notesByTab,
        [targetTabId]: (prev.notesByTab[targetTabId] ?? []).map((n) =>
          n.id === targetNoteId ? { ...n, lastEditedLabel: label } : n,
        ),
      },
    }))
  }

  const handleDeleteNote = useCallback(
    (id) => {
    const targetTabId = activeTabId
    if (targetTabId === 'archive' || targetTabId === 'preferences') return

    commit((prev) => {
      const list = prev.notesByTab[targetTabId] ?? []
      const note = list.find((n) => n.id === id)
      if (!note) return prev

      const deletedAt = Date.now()
      const archived = {
        id: note.id,
        deletedAt,
        deletedLabel: formatDeletedLabel(deletedAt),
        archiveKind: ARCHIVE_KIND_NOTE,
        sourceTabId: targetTabId,
        title: note.title,
        preview: note.preview ?? '',
        body: note.body ?? '',
        images: note.images ?? [],
      }

      const remaining = list.filter((n) => n.id !== id)
      const currentlySelected = prev.selectedByTab[targetTabId]
      const nextSelected =
        currentlySelected === id ? remaining[0]?.id ?? null : currentlySelected

      const prevArchive = prev.notesByTab.archive ?? []
      const nextArchive = noteHasArchivableContent(note)
        ? [archived, ...prevArchive]
        : prevArchive

      return {
        ...prev,
        notesByTab: {
          ...prev.notesByTab,
          [targetTabId]: remaining,
          archive: nextArchive,
        },
        selectedByTab: {
          ...prev.selectedByTab,
          [targetTabId]: nextSelected,
        },
      }
    })
  },
    [activeTabId, commit],
  )

  const handleAddNote = () => {
    if (activeTabId === 'preferences' || activeTabId === 'archive') return
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const targetTabId = activeTabId

    const folderId =
      (folderByTab[activeTabId] ?? ALL_FOLDER_ID) === ALL_FOLDER_ID
        ? DEFAULT_NOTE_FOLDER_ID
        : folderByTab[activeTabId]
    const newNote = {
      id,
      folderId,
      timestamp: 'Just now',
      lastEditedLabel: 'Last edited just now',
      title: DEFAULT_NOTE_TITLE,
      preview: DEFAULT_NOTE_PREVIEW,
      body: '',
    }
    commit((prev) => ({
      ...prev,
      notesByTab: {
        ...prev.notesByTab,
        [targetTabId]: [newNote, ...(prev.notesByTab[targetTabId] ?? [])],
      },
      selectedByTab: { ...prev.selectedByTab, [targetTabId]: id },
    }))
  }

  const handleSelectNote = (id) => {
    const targetTabId = activeTabId
    commit(
      (prev) => ({
        ...prev,
        selectedByTab: { ...prev.selectedByTab, [targetTabId]: id },
      }),
      { recordHistory: false },
    )
  }

  const handleSwitchTab = (id) => {
    commit((prev) => ({ ...prev, activeTabId: id }), {
      recordHistory: false,
    })
  }

  const handleSetTabColor = (id, color) => {
    commit((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === id ? { ...t, color } : t)),
    }))
  }

  const handleAddImage = (dataUrl) => {
    if (!selectedNoteId) return
    const targetTabId = activeTabId
    const targetNoteId = selectedNoteId
    const imageId = `img-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`
    commit((prev) => ({
      ...prev,
      notesByTab: {
        ...prev.notesByTab,
        [targetTabId]: (prev.notesByTab[targetTabId] ?? []).map((n) =>
          n.id === targetNoteId
            ? {
                ...n,
                images: [...(n.images ?? []), { id: imageId, dataUrl }],
              }
            : n,
        ),
      },
    }))
  }

  const handleRemoveImage = (imageId) => {
    if (!selectedNoteId) return
    const targetTabId = activeTabId
    const targetNoteId = selectedNoteId
    commit((prev) => ({
      ...prev,
      notesByTab: {
        ...prev.notesByTab,
        [targetTabId]: (prev.notesByTab[targetTabId] ?? []).map((n) =>
          n.id === targetNoteId
            ? {
                ...n,
                images: (n.images ?? []).filter((img) => img.id !== imageId),
              }
            : n,
        ),
      },
    }))
  }

  const handleDuplicateNote = (id) => {
    const targetTabId = activeTabId
    if (targetTabId === 'archive' || targetTabId === 'preferences') return
    const newId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    commit((prev) => {
      const notes = prev.notesByTab[targetTabId] ?? []
      const idx = notes.findIndex((n) => n.id === id)
      if (idx < 0) return prev
      const original = notes[idx]
      const copy = {
        ...original,
        id: newId,
        title: `${original.title} (copy)`,
        timestamp: 'Just now',
        lastEditedLabel: 'Last edited just now',
        folderId: original.folderId ?? DEFAULT_NOTE_FOLDER_ID,
      }
      const nextNotes = [...notes]
      nextNotes.splice(idx + 1, 0, copy)
      return {
        ...prev,
        notesByTab: { ...prev.notesByTab, [targetTabId]: nextNotes },
        selectedByTab: { ...prev.selectedByTab, [targetTabId]: newId },
      }
    })
  }

  const handleRestoreFromArchive = (id) => {
    const newId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    commit((prev) => {
      const arch = prev.notesByTab.archive ?? []
      const item = arch.find((n) => n.id === id)
      if (!item) return prev

      const kind = item.archiveKind ?? ARCHIVE_KIND_NOTE
      const nextArchive = arch.filter((n) => n.id !== id)

      if (kind === ARCHIVE_KIND_FOLDER) {
        const tabKey = 'notes'
        const existing = prev.libraryFoldersByTab?.[tabKey] ?? []
        let folderId = item.restoredFolderId ?? `fld-${Date.now()}`
        if (existing.some((f) => f.id === folderId)) {
          folderId = `fld-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
        }
        return {
          ...prev,
          notesByTab: { ...prev.notesByTab, archive: nextArchive },
          libraryFoldersByTab: {
            ...prev.libraryFoldersByTab,
            [tabKey]: [...existing, { id: folderId, label: item.title }],
          },
          activeTabId: tabKey,
        }
      }

      const restored = {
        id: newId,
        folderId: DEFAULT_NOTE_FOLDER_ID,
        timestamp: 'Just now',
        lastEditedLabel: 'Restored from archive',
        title: item.title,
        preview: item.preview ?? '',
        body: item.body ?? '',
        images: item.images ?? [],
      }
      const targetKey = 'notes'
      return {
        ...prev,
        notesByTab: {
          ...prev.notesByTab,
          archive: nextArchive,
          [targetKey]: [restored, ...(prev.notesByTab[targetKey] ?? [])],
        },
        activeTabId: targetKey,
        selectedByTab: {
          ...prev.selectedByTab,
          [targetKey]: newId,
        },
      }
    })
  }

  const handleDeleteArchiveForever = (id) => {
    const arch = notesByTab.archive ?? []
    const note = arch.find((n) => n.id === id)
    const kind = note?.archiveKind ?? ARCHIVE_KIND_NOTE
    const noun = kind === ARCHIVE_KIND_FOLDER ? 'folder' : 'note'
    if (
      !window.confirm(
        `Permanently delete ${noun} "${note?.title ?? 'Untitled'}"? This cannot be undone.`,
      )
    ) {
      return
    }
    commit((prev) => ({
      ...prev,
      notesByTab: {
        ...prev.notesByTab,
        archive: (prev.notesByTab.archive ?? []).filter((n) => n.id !== id),
      },
    }))
  }

  const handleDeleteArchiveAll = useCallback(() => {
    const arch = notesByTab.archive ?? []
    if (arch.length === 0) return
    if (
      !window.confirm(
        `Permanently delete all ${arch.length} archived item(s)? This cannot be undone.`,
      )
    ) {
      return
    }
    commit((prev) => ({
      ...prev,
      notesByTab: { ...prev.notesByTab, archive: [] },
    }))
  }, [commit, notesByTab.archive])

  const handleDeleteArchiveForeverBatch = useCallback(
    (ids) => {
      if (!ids?.length) return
      if (
        !window.confirm(
          `Permanently delete ${ids.length} item(s)? This cannot be undone.`,
        )
      ) {
        return
      }
      const idSet = new Set(ids)
      commit((prev) => ({
        ...prev,
        notesByTab: {
          ...prev.notesByTab,
          archive: (prev.notesByTab.archive ?? []).filter((n) => !idSet.has(n.id)),
        },
      }))
    },
    [commit],
  )

  const handleRestoreArchiveBatch = useCallback(
    (ids) => {
      if (!ids?.length) return
      commit((prev) => {
        const arch = prev.notesByTab.archive ?? []
        const idSet = new Set(ids)
        const ordered = ids
          .map((id) => arch.find((n) => n.id === id))
          .filter(Boolean)
        if (ordered.length === 0) return prev

        const nextArchive = arch.filter((n) => !idSet.has(n.id))
        const tabKey = 'notes'
        let folderList = [...(prev.libraryFoldersByTab?.[tabKey] ?? [])]
        const notesList = [...(prev.notesByTab[tabKey] ?? [])]
        const toPrepend = []
        let lastNoteId = null
        const t = Date.now()

        for (let i = 0; i < ordered.length; i++) {
          const item = ordered[i]
          const kind = item.archiveKind ?? ARCHIVE_KIND_NOTE
          if (kind === ARCHIVE_KIND_FOLDER) {
            let folderId = item.restoredFolderId ?? `fld-${t + i}`
            if (folderList.some((f) => f.id === folderId)) {
              folderId = `fld-${t + i}-${Math.random().toString(36).slice(2, 5)}`
            }
            folderList = [...folderList, { id: folderId, label: item.title }]
          } else {
            const newId = `note-${t + i}-${Math.random().toString(36).slice(2, 7)}`
            toPrepend.push({
              id: newId,
              folderId: DEFAULT_NOTE_FOLDER_ID,
              timestamp: 'Just now',
              lastEditedLabel: 'Restored from archive',
              title: item.title,
              preview: item.preview ?? '',
              body: item.body ?? '',
              images: item.images ?? [],
            })
            lastNoteId = newId
          }
        }

        return {
          ...prev,
          notesByTab: {
            ...prev.notesByTab,
            archive: nextArchive,
            [tabKey]: [...toPrepend, ...notesList],
          },
          libraryFoldersByTab: {
            ...prev.libraryFoldersByTab,
            [tabKey]: folderList,
          },
          activeTabId: tabKey,
          selectedByTab: {
            ...prev.selectedByTab,
            [tabKey]:
              lastNoteId ?? prev.selectedByTab[tabKey] ?? null,
          },
        }
      })
    },
    [commit],
  )

  const handleCreateFolder = useCallback(() => {
    if (activeTabId !== 'notes') return
    const name = window.prompt('New folder name', 'New Folder')
    const trimmed = name?.trim()
    if (!trimmed) return
    const list = libraryFoldersByTab?.[activeTabId] ?? []
    if (isFolderLabelTaken(list, trimmed)) {
      window.alert('A folder with that name already exists.')
      return
    }
    const newId = `fld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    commit((prev) => ({
      ...prev,
      libraryFoldersByTab: {
        ...prev.libraryFoldersByTab,
        [activeTabId]: [
          ...(prev.libraryFoldersByTab[activeTabId] ?? []),
          { id: newId, label: trimmed },
        ],
      },
    }))
  }, [activeTabId, commit, libraryFoldersByTab])

  const handleRenameFolder = useCallback(
    (folderId, newLabel) => {
      if (folderId === ALL_FOLDER_ID) return
      if (activeTabId !== 'notes') return
      const trimmed = newLabel?.trim()
      if (!trimmed) return
      commit((prev) => {
        const list = prev.libraryFoldersByTab[activeTabId] ?? []
        if (isFolderLabelTaken(list, trimmed, folderId)) {
          window.alert('A folder with that name already exists.')
          return prev
        }
        return {
          ...prev,
          libraryFoldersByTab: {
            ...prev.libraryFoldersByTab,
            [activeTabId]: list.map((f) =>
              f.id === folderId ? { ...f, label: trimmed } : f,
            ),
          },
        }
      })
    },
    [activeTabId, commit],
  )

  const handleReorderFolders = useCallback(
    (activeId, overId, position = 'before') => {
      if (activeTabId !== 'notes') return
      commit((prev) => {
        const list = prev.libraryFoldersByTab[activeTabId] ?? []
        const next = reorderLibraryFolders(list, activeId, overId, position)
        if (next === list) return prev
        return {
          ...prev,
          libraryFoldersByTab: {
            ...prev.libraryFoldersByTab,
            [activeTabId]: next,
          },
        }
      })
    },
    [activeTabId, commit],
  )

  const handleDeleteFolder = useCallback(
    (folderId) => {
      if (folderId === ALL_FOLDER_ID) return
      if (activeTabId !== 'notes') return
      const folder = libraryFolders.find((f) => f.id === folderId)
      if (!folder) return
      if (
        !window.confirm(
          `Delete folder "${folder.label}"? Notes inside will move to Personal.`,
        )
      ) {
        return
      }
      const tabId = activeTabId
      commit((prev) => {
        const folders = (prev.libraryFoldersByTab[tabId] ?? []).filter(
          (f) => f.id !== folderId,
        )
        const list = prev.notesByTab[tabId] ?? []
        const hadArchivableInFolder = list.some(
          (n) =>
            n.folderId === folderId && noteHasArchivableContent(n),
        )
        const notes = list.map((n) =>
          n.folderId === folderId
            ? { ...n, folderId: DEFAULT_NOTE_FOLDER_ID }
            : n,
        )
        const prevArchive = prev.notesByTab.archive ?? []
        let nextArchive = prevArchive
        if (hadArchivableInFolder) {
          const deletedAt = Date.now()
          const archivedFolder = {
            id: `arch-folder-${folderId}-${deletedAt}`,
            deletedAt,
            deletedLabel: formatDeletedLabel(deletedAt),
            archiveKind: ARCHIVE_KIND_FOLDER,
            sourceTabId: tabId,
            restoredFolderId: folderId,
            title: folder.label,
            preview: 'Folder',
            body: '',
          }
          nextArchive = [archivedFolder, ...prevArchive]
        }
        return {
          ...prev,
          libraryFoldersByTab: {
            ...prev.libraryFoldersByTab,
            [tabId]: folders,
          },
          notesByTab: {
            ...prev.notesByTab,
            [tabId]: notes,
            archive: nextArchive,
          },
        }
      })
      setFolderByTab((prev) =>
        prev[tabId] === folderId
          ? { ...prev, [tabId]: ALL_FOLDER_ID }
          : prev,
      )
    },
    [activeTabId, commit, libraryFolders],
  )

  const handleSelectFolder = (folderId) => {
    setFolderByTab((prev) => ({ ...prev, [activeTabId]: folderId }))
  }

  const handleNotesSearchChange = (q) => {
    setSearchByTab((prev) => ({ ...prev, notes: q }))
  }

  const handleGlobalSearchPick = useCallback(
    (noteId) => {
      const list = notesByTab.notes ?? []
      const note = list.find((n) => n.id === noteId)
      setGlobalSearchOpen(false)
      commit(
        (prev) => ({
          ...prev,
          activeTabId: 'notes',
          selectedByTab: { ...prev.selectedByTab, notes: noteId },
        }),
        { recordHistory: false },
      )
      const fid = note?.folderId ?? DEFAULT_NOTE_FOLDER_ID
      setFolderByTab((prev) => ({ ...prev, notes: fid }))
    },
    [notesByTab.notes, commit],
  )

  const addNoteRef = useRef(() => {})
  addNoteRef.current = handleAddNote

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isShortcutRecording()) return
      if (contextMenu) {
        if (e.key === 'Escape') {
          e.preventDefault()
          closeContextMenu()
        }
        return
      }

      if (isChordRedoShiftZ(e)) {
        e.preventDefault()
        redo()
        return
      }

      const action = matchShortcutAction(e, shortcutBindings)
      if (!action) return

      if (action === 'undo') {
        e.preventDefault()
        undo()
        return
      }
      if (action === 'redo') {
        e.preventDefault()
        redo()
        return
      }

      if (action === 'searchNotes') {
        e.preventDefault()
        if (globalSearchOpen) {
          setGlobalSearchOpen(false)
          return
        }
        if (activeTabId === 'notes') {
          const el = notesSearchInputRef.current
          el?.focus()
          el?.select()
          return
        }
        setGlobalSearchOpen(true)
        return
      }

      if (action === 'newNote') {
        e.preventDefault()
        if (activeTabId === 'archive' || activeTabId === 'preferences') {
          commit(
            (prev) => ({ ...prev, activeTabId: 'notes' }),
            { recordHistory: false },
          )
          setTimeout(() => addNoteRef.current(), 0)
          return
        }
        addNoteRef.current()
        return
      }

      if (action === 'toggleArchive') {
        e.preventDefault()
        if (
          activeTabId !== 'archive' &&
          activeTabId !== 'preferences' &&
          selectedNoteId
        ) {
          handleDeleteNote(selectedNoteId)
        }
        return
      }

      const tabMatch = action.match(/^goToTab(\d)$/)
      if (tabMatch) {
        const idx = parseInt(tabMatch[1], 10) - 1
        const tab = tabs[idx]
        if (tab) {
          e.preventDefault()
          commit((prev) => ({ ...prev, activeTabId: tab.id }), {
            recordHistory: false,
          })
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [
    shortcutBindings,
    contextMenu,
    closeContextMenu,
    globalSearchOpen,
    activeTabId,
    selectedNoteId,
    tabs,
    commit,
    undo,
    redo,
    handleDeleteNote,
  ])

  const handleDeleteTab = (id) => {
    if (CORE_TAB_IDS.includes(id)) return
    commit((prev) => {
      if (prev.tabs.length <= 1) return prev
      const idx = prev.tabs.findIndex((t) => t.id === id)
      const nextTabs = prev.tabs.filter((t) => t.id !== id)
      const { [id]: _removedNotes, ...restNotes } = prev.notesByTab
      const { [id]: _removedSel, ...restSel } = prev.selectedByTab
      let nextActive = prev.activeTabId
      if (prev.activeTabId === id) {
        const fallback = nextTabs[idx] ?? nextTabs[idx - 1] ?? nextTabs[0]
        nextActive = fallback.id
      }
      return {
        ...prev,
        tabs: nextTabs,
        notesByTab: restNotes,
        selectedByTab: restSel,
        activeTabId: nextActive,
      }
    })
  }

  if (!libraryHydrated) {
    return (
      <div className="app-window app-loading-screen" aria-busy="true">
        Loading library…
      </div>
    )
  }

  return (
    <div className="app-window">
      <Tabs
        tabs={tabs}
        activeTabId={activeTabId}
        onChange={handleSwitchTab}
        onDeleteTab={handleDeleteTab}
        onSetTabColor={handleSetTabColor}
        onShowContextMenu={showContextMenu}
      />

      <div className="app-body">
        {activeTabId === 'archive' ? (
          <ArchiveView
            archivedNotes={notesByTab.archive ?? []}
            onRestore={handleRestoreFromArchive}
            onDeleteForever={handleDeleteArchiveForever}
            onDeleteAllForever={handleDeleteArchiveAll}
            onRestoreBatch={handleRestoreArchiveBatch}
            onDeleteForeverBatch={handleDeleteArchiveForeverBatch}
          />
        ) : activeTabId === 'preferences' ? (
          <PreferencesView
            theme={interfaceTheme}
            onThemeChange={setInterfaceTheme}
            compactSidebar={compactSidebar}
            onCompactSidebarChange={setCompactSidebar}
            shortcutBindings={shortcutBindings}
            onShortcutBindingsChange={setShortcutBindings}
            googleClientIdConfigured={Boolean(getGoogleClientId())}
            googleSessionActive={googleSessionActive}
            driveSyncBusy={driveSyncBusy}
            onGoogleConnect={handleGoogleConnect}
            onGoogleDisconnect={handleGoogleDisconnect}
            onDriveSyncNow={handleDriveSyncNow}
            cloudSyncEnabled={cloudSyncEnabled}
            onCloudSyncChange={handleCloudSyncChange}
            lastSyncLabel={lastSyncLabel}
            cloudSyncError={cloudSyncError}
            exportBusy={exportBusy}
            onExportLibrary={handleExportLibrary}
            importBusy={importBusy}
            onImportObsidianFiles={handleImportObsidianFiles}
          />
        ) : (
          <>
            <NotesWorkspace
              folders={libraryFolders}
              notes={notes}
              visibleNotes={visibleNotes}
              selectedFolderId={selectedFolderId}
              onSelectFolder={handleSelectFolder}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onReorderFolders={handleReorderFolders}
              onDeleteFolder={handleDeleteFolder}
              searchQuery={notesSearchQuery}
              onSearchChange={handleNotesSearchChange}
              notesSearchInputRef={notesSearchInputRef}
              selectedNoteId={selectedNoteId}
              onSelectNote={handleSelectNote}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onDuplicateNote={handleDuplicateNote}
              onShowContextMenu={showContextMenu}
            />
            <Editor
              note={selectedNote}
              onChangeTitle={handleChangeTitle}
              onChangeBody={handleChangeBody}
              onRefresh={handleRefresh}
              onAddImage={handleAddImage}
              onRemoveImage={handleRemoveImage}
            />
          </>
        )}
      </div>

      <GlobalSearchPalette
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        query={notesSearchQuery}
        onChangeQuery={handleNotesSearchChange}
        results={globalSearchResults}
        onPickNote={handleGlobalSearchPick}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}
    </div>
  )
}
