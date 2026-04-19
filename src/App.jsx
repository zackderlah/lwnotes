import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Tabs from './components/Tabs.jsx'
import NotesWorkspace from './components/NotesWorkspace.jsx'
import Editor from './components/Editor.jsx'
import ContextMenu from './components/ContextMenu.jsx'

const ArchiveView = lazy(() => import('./components/ArchiveView.jsx'))
const PreferencesView = lazy(() => import('./components/PreferencesView.jsx'))
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
  filterNotesByFolders,
  filterNotesBySearch,
  isFolderLabelTaken,
  normalizeFolderSelection,
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
import { useMediaQuery } from './hooks/useMediaQuery.js'
import MobileNotesHome from './components/mobile/MobileNotesHome.jsx'
import MobileBottomNav from './components/mobile/MobileBottomNav.jsx'
import MobileEditorScreen from './components/mobile/MobileEditorScreen.jsx'
import MobilePreferencesView from './components/mobile/MobilePreferencesView.jsx'
import {
  hapticOpenSheet,
  hapticTab,
} from './mobileHaptics.js'
import './styles/mobile.css'

/** Library + editor surface (any note tab, including extra workspace tabs — not Archive/Settings). */
function isWorkspaceNotesTab(tabId) {
  return tabId !== 'archive' && tabId !== 'preferences'
}

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
    notes: [ALL_FOLDER_ID],
  }))
  const [searchByTab, setSearchByTab] = useState(() => ({
    notes: '',
  }))
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [pendingAutoEditFolderId, setPendingAutoEditFolderId] = useState(null)
  const [noteMultiByTab, setNoteMultiByTab] = useState(() => ({}))
  const [shortcutBindings, setShortcutBindings] = useState(
    readStoredShortcutBindings,
  )
  const notesSearchInputRef = useRef(null)
  const folderAnchorRef = useRef(ALL_FOLDER_ID)
  const noteAnchorRef = useRef(null)

  const isMobile = useMediaQuery('(max-width: 768px)')
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false)

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

  const selectedFolderIds = useMemo(
    () => normalizeFolderSelection(folderByTab[activeTabId]),
    [folderByTab, activeTabId],
  )
  const notesSearchQuery = searchByTab.notes ?? ''

  const visibleNotes = useMemo(() => {
    if (activeTabId === 'archive' || activeTabId === 'preferences') return []
    const byFolder = filterNotesByFolders(notes, selectedFolderIds)
    return filterNotesBySearch(byFolder, notesSearchQuery)
  }, [activeTabId, notes, selectedFolderIds, notesSearchQuery])

  const noteMultiIds = noteMultiByTab[activeTabId]
  const selectedNoteIds = useMemo(() => {
    if (noteMultiIds?.length) return noteMultiIds
    if (selectedNoteId) return [selectedNoteId]
    return []
  }, [noteMultiIds, selectedNoteId])

  const mobileHeaderTitle = useMemo(() => {
    const ids = selectedFolderIds
    if (ids.length === 1 && ids[0] === ALL_FOLDER_ID) return 'All Notes'
    if (ids.length === 1) {
      const f = libraryFolders.find((x) => x.id === ids[0])
      return (f?.label ?? '').trim() || 'Notes'
    }
    return 'Notes'
  }, [selectedFolderIds, libraryFolders])

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
    const multi = noteMultiByTab[activeTabId]
    if (multi?.length) {
      const filtered = multi.filter((nid) => ids.has(nid))
      if (filtered.length !== multi.length) {
        setNoteMultiByTab((prev) => {
          const { [activeTabId]: _, ...rest } = prev
          if (filtered.length > 1) return { ...rest, [activeTabId]: filtered }
          return rest
        })
      }
    }
    if (selectedNoteId != null && !ids.has(selectedNoteId)) {
      setNoteMultiByTab((prev) => {
        const { [activeTabId]: _, ...rest } = prev
        return rest
      })
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
  }, [activeTabId, visibleNotes, selectedNoteId, commit, noteMultiByTab])

  useEffect(() => {
    if (!isWorkspaceNotesTab(activeTabId)) return
    const validIds = new Set(libraryFolders.map((f) => f.id))
    const cur = normalizeFolderSelection(folderByTab[activeTabId])
    const filtered = cur.filter((id) => validIds.has(id))
    const next = filtered.length ? filtered : [ALL_FOLDER_ID]
    const unchanged =
      next.length === cur.length && next.every((id, i) => id === cur[i])
    if (unchanged) return
    setFolderByTab((prev) => ({ ...prev, [activeTabId]: next }))
  }, [activeTabId, libraryFolders, folderByTab[activeTabId]])

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

  const handleDeleteNotes = useCallback(
    (rawIds) => {
      const ids = [...new Set(rawIds)].filter(Boolean)
      if (!ids.length) return
      const targetTabId = activeTabId
      if (targetTabId === 'archive' || targetTabId === 'preferences') return

      commit((prev) => {
        const list = prev.notesByTab[targetTabId] ?? []
        const idSet = new Set(ids)
        const removedRows = list.filter((n) => idSet.has(n.id))
        if (removedRows.length === 0) return prev

        let nextArchive = prev.notesByTab.archive ?? []
        const deletedAt = Date.now()
        for (const note of removedRows) {
          if (!noteHasArchivableContent(note)) continue
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
          nextArchive = [archived, ...nextArchive]
        }

        const remaining = list.filter((n) => !idSet.has(n.id))
        const currentlySelected = prev.selectedByTab[targetTabId]
        const nextSelected = idSet.has(currentlySelected)
          ? remaining[0]?.id ?? null
          : currentlySelected

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

      setNoteMultiByTab((prev) => {
        const { [targetTabId]: _, ...rest } = prev
        return rest
      })
    },
    [activeTabId, commit],
  )

  const handleDeleteNote = useCallback(
    (id) => handleDeleteNotes([id]),
    [handleDeleteNotes],
  )

  const handleAddNote = () => {
    if (activeTabId === 'preferences' || activeTabId === 'archive') return
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const targetTabId = activeTabId

    const sel = normalizeFolderSelection(folderByTab[activeTabId])
    let folderId = DEFAULT_NOTE_FOLDER_ID
    if (!sel.includes(ALL_FOLDER_ID)) {
      const concrete = sel.find((fid) => fid !== ALL_FOLDER_ID)
      folderId = concrete ?? DEFAULT_NOTE_FOLDER_ID
    }
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

  const handleSelectNote = useCallback(
    (id, e) => {
      const targetTabId = activeTabId
      const hasModifiers = e && 'shiftKey' in e
      const shift = hasModifiers ? e.shiftKey : false
      const alt = hasModifiers ? e.altKey : false

      if (shift) {
        const anchor = noteAnchorRef.current ?? selectedNoteId ?? id
        const list = visibleNotes
        const ia = list.findIndex((n) => n.id === anchor)
        const ib = list.findIndex((n) => n.id === id)
        if (ia < 0 || ib < 0) {
          setNoteMultiByTab((prev) => {
            const { [targetTabId]: _, ...rest } = prev
            return rest
          })
          commit(
            (prev) => ({
              ...prev,
              selectedByTab: { ...prev.selectedByTab, [targetTabId]: id },
            }),
            { recordHistory: false },
          )
          noteAnchorRef.current = id
          return
        }
        const start = Math.min(ia, ib)
        const end = Math.max(ia, ib)
        const range = list.slice(start, end + 1).map((n) => n.id)
        setNoteMultiByTab((prev) => ({ ...prev, [targetTabId]: range }))
        commit(
          (prev) => ({
            ...prev,
            selectedByTab: { ...prev.selectedByTab, [targetTabId]: id },
          }),
          { recordHistory: false },
        )
        noteAnchorRef.current = id
        return
      }

      if (alt) {
        const cur =
          noteMultiByTab[targetTabId] ??
          (selectedNoteId ? [selectedNoteId] : [])
        let next
        if (cur.includes(id)) {
          next = cur.filter((x) => x !== id)
        } else {
          next = [...cur, id]
        }
        if (next.length === 0) {
          setNoteMultiByTab((prev) => {
            const { [targetTabId]: _, ...rest } = prev
            return rest
          })
          commit(
            (prev) => ({
              ...prev,
              selectedByTab: { ...prev.selectedByTab, [targetTabId]: null },
            }),
            { recordHistory: false },
          )
          noteAnchorRef.current = id
          return
        }
        if (next.length === 1) {
          setNoteMultiByTab((prev) => {
            const { [targetTabId]: _, ...rest } = prev
            return rest
          })
          commit(
            (prev) => ({
              ...prev,
              selectedByTab: {
                ...prev.selectedByTab,
                [targetTabId]: next[0],
              },
            }),
            { recordHistory: false },
          )
        } else {
          setNoteMultiByTab((prev) => ({ ...prev, [targetTabId]: next }))
          commit(
            (prev) => ({
              ...prev,
              selectedByTab: { ...prev.selectedByTab, [targetTabId]: id },
            }),
            { recordHistory: false },
          )
        }
        noteAnchorRef.current = id
        return
      }

      setNoteMultiByTab((prev) => {
        const { [targetTabId]: _, ...rest } = prev
        return rest
      })
      commit(
        (prev) => ({
          ...prev,
          selectedByTab: { ...prev.selectedByTab, [targetTabId]: id },
        }),
        { recordHistory: false },
      )
      noteAnchorRef.current = id
    },
    [activeTabId, commit, visibleNotes, selectedNoteId, noteMultiByTab],
  )

  const handleSwitchTab = (id) => {
    commit((prev) => ({ ...prev, activeTabId: id }), {
      recordHistory: false,
    })
  }

  const openMobileEditor = useCallback(() => {
    hapticOpenSheet()
    setMobileEditorOpen(true)
  }, [])

  const handleMobileNavigate = useCallback(
    (targetId) => {
      if (targetId !== activeTabId) hapticTab()
      setMobileEditorOpen(false)
      commit((prev) => ({ ...prev, activeTabId: targetId }), {
        recordHistory: false,
      })
    },
    [activeTabId, commit],
  )

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
    setNoteMultiByTab((prev) => {
      const { [targetTabId]: _, ...rest } = prev
      return rest
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

  const handleConsumePendingAutoEdit = useCallback(() => {
    setPendingAutoEditFolderId(null)
  }, [])

  const handleCreateFolder = useCallback(() => {
    if (!isWorkspaceNotesTab(activeTabId)) return
    const newId = `fld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    commit((prev) => ({
      ...prev,
      libraryFoldersByTab: {
        ...prev.libraryFoldersByTab,
        [activeTabId]: [
          ...(prev.libraryFoldersByTab[activeTabId] ?? []),
          { id: newId, label: '' },
        ],
      },
    }))
    setFolderByTab((prev) => ({ ...prev, [activeTabId]: [newId] }))
    folderAnchorRef.current = newId
    setPendingAutoEditFolderId(newId)
  }, [activeTabId, commit])

  const handleCreateFolderWithName = useCallback(
    (trimmed) => {
      const label = trimmed?.trim()
      if (!label) return
      if (!isWorkspaceNotesTab(activeTabId)) return
      const list = libraryFoldersByTab?.[activeTabId] ?? []
      if (isFolderLabelTaken(list, label)) {
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
            { id: newId, label },
          ],
        },
      }))
      setFolderByTab((prev) => ({ ...prev, [activeTabId]: [newId] }))
      folderAnchorRef.current = newId
    },
    [activeTabId, commit, libraryFoldersByTab],
  )

  const handleAbandonNewFolder = useCallback(
    (folderId) => {
      if (folderId === ALL_FOLDER_ID) return
      if (!isWorkspaceNotesTab(activeTabId)) return
      const folder = libraryFolders.find((f) => f.id === folderId)
      if (!folder || folder.label.trim() !== '') return

      const tabId = activeTabId
      commit((prev) => {
        const folders = (prev.libraryFoldersByTab[tabId] ?? []).filter(
          (f) => f.id !== folderId,
        )
        const list = prev.notesByTab[tabId] ?? []
        const hadArchivableInFolder = list.some(
          (n) => n.folderId === folderId && noteHasArchivableContent(n),
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
            title: folder.label || 'Folder',
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
      setFolderByTab((prev) => {
        const cur = normalizeFolderSelection(prev[tabId])
        const next = cur.filter((fid) => fid !== folderId)
        return { ...prev, [tabId]: next.length ? next : [ALL_FOLDER_ID] }
      })
      setPendingAutoEditFolderId((p) => (p === folderId ? null : p))
    },
    [activeTabId, commit, libraryFolders],
  )

  const handleRenameFolder = useCallback(
    (folderId, newLabel) => {
      if (folderId === ALL_FOLDER_ID) return
      if (!isWorkspaceNotesTab(activeTabId)) return
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
      if (!isWorkspaceNotesTab(activeTabId)) return
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
      if (!isWorkspaceNotesTab(activeTabId)) return
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
      setFolderByTab((prev) => {
        const cur = normalizeFolderSelection(prev[tabId])
        if (!cur.includes(folderId)) return prev
        const next = cur.filter((id) => id !== folderId)
        return { ...prev, [tabId]: next.length ? next : [ALL_FOLDER_ID] }
      })
    },
    [activeTabId, commit, libraryFolders],
  )

  const handleSelectFolder = useCallback(
    (folderId, e) => {
      const tab = activeTabId
      const order = libraryFolders.map((f) => f.id)

      const hasModifiers = e && 'shiftKey' in e
      const shift = hasModifiers ? e.shiftKey : false
      const alt = hasModifiers ? e.altKey : false

      if (shift) {
        const anchor = folderAnchorRef.current ?? ALL_FOLDER_ID
        const ia = order.indexOf(anchor)
        const ib = order.indexOf(folderId)
        if (ia < 0 || ib < 0) {
          setFolderByTab((prev) => ({ ...prev, [tab]: [folderId] }))
          folderAnchorRef.current = folderId
          return
        }
        const start = Math.min(ia, ib)
        const end = Math.max(ia, ib)
        const rangeIds = order.slice(start, end + 1)
        setFolderByTab((prev) => ({ ...prev, [tab]: rangeIds }))
        return
      }

      if (alt) {
        setFolderByTab((prev) => {
          const cur = normalizeFolderSelection(prev[tab])
          let next = [...cur]
          if (next.includes(folderId)) {
            next = next.filter((id) => id !== folderId)
            if (next.length === 0) next = [ALL_FOLDER_ID]
          } else {
            next = [...next, folderId]
          }
          return { ...prev, [tab]: next }
        })
        folderAnchorRef.current = folderId
        return
      }

      setFolderByTab((prev) => ({ ...prev, [tab]: [folderId] }))
      folderAnchorRef.current = folderId
    },
    [activeTabId, libraryFolders],
  )

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
      setFolderByTab((prev) => ({ ...prev, notes: [fid] }))
      setNoteMultiByTab((prev) => {
        const { notes: _, ...rest } = prev
        return rest
      })
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
        if (isWorkspaceNotesTab(activeTabId)) {
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
        if (activeTabId === 'archive' || activeTabId === 'preferences') return
        const multi = noteMultiByTab[activeTabId]
        const toArchive =
          multi?.length > 1 ? multi : selectedNoteId ? [selectedNoteId] : []
        if (toArchive.length) handleDeleteNotes(toArchive)
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
    handleDeleteNotes,
    noteMultiByTab,
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

  useEffect(() => {
    if (!isMobile) return
    if (selectedNoteId == null) setMobileEditorOpen(false)
  }, [isMobile, selectedNoteId])

  useEffect(() => {
    if (!isMobile) return
    if (activeTabId === 'archive' || activeTabId === 'preferences') {
      setMobileEditorOpen(false)
    }
  }, [isMobile, activeTabId])

  if (!libraryHydrated) {
    return (
      <div className="app-window app-loading-screen" aria-busy="true">
        Loading library…
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="app-window app-window--mobile">
        <Tabs
          tabs={tabs}
          activeTabId={activeTabId}
          onChange={handleSwitchTab}
          onDeleteTab={handleDeleteTab}
          onSetTabColor={handleSetTabColor}
          onShowContextMenu={showContextMenu}
        />

        <div className="app-body">
          <Suspense fallback={<div className="app-view-suspense-fallback" />}>
            <div className="app-mobile">
              <div
                className={`app-mobile__main${mobileEditorOpen && selectedNote ? ' app-mobile__main--editor-open' : ''}`}
              >
                {activeTabId === 'archive' ? (
                  <div
                    key={activeTabId}
                    className="app-mobile__pane-fade app-mobile__scroll-pane"
                  >
                    <ArchiveView
                      archivedNotes={notesByTab.archive ?? []}
                      onRestore={handleRestoreFromArchive}
                      onDeleteForever={handleDeleteArchiveForever}
                      onDeleteAllForever={handleDeleteArchiveAll}
                      onRestoreBatch={handleRestoreArchiveBatch}
                      onDeleteForeverBatch={handleDeleteArchiveForeverBatch}
                    />
                  </div>
                ) : activeTabId === 'preferences' ? (
                  <div
                    key={activeTabId}
                    className="app-mobile__pane-fade app-mobile__scroll-pane app-mobile__scroll-pane--prefs"
                  >
                    <MobilePreferencesView
                      theme={interfaceTheme}
                      onThemeChange={setInterfaceTheme}
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
                  </div>
                ) : (
                  <>
                    <div
                      key={activeTabId}
                      className="app-mobile__pane-fade app-mobile__notes-pane"
                    >
                      <MobileNotesHome
                        folders={libraryFolders}
                        visibleNotes={visibleNotes}
                        selectedFolderIds={selectedFolderIds}
                        onSelectFolder={(id) => handleSelectFolder(id, undefined)}
                        onCreateFolderWithName={handleCreateFolderWithName}
                        onRenameFolder={handleRenameFolder}
                        onDeleteFolder={handleDeleteFolder}
                        onShowContextMenu={showContextMenu}
                        onSelectNote={(id) => {
                          handleSelectNote(id, undefined)
                          openMobileEditor()
                        }}
                        headerTitle={mobileHeaderTitle}
                        onUndo={undo}
                        onAddNote={() => {
                          handleAddNote()
                          setTimeout(() => openMobileEditor(), 0)
                        }}
                      />
                    </div>
                    {mobileEditorOpen && selectedNote && (
                      <MobileEditorScreen
                        note={selectedNote}
                        onBack={() => setMobileEditorOpen(false)}
                        onChangeTitle={handleChangeTitle}
                        onChangeBody={handleChangeBody}
                        onRefresh={handleRefresh}
                        onAddImage={handleAddImage}
                        onRemoveImage={handleRemoveImage}
                      />
                    )}
                  </>
                )}
              </div>
              <MobileBottomNav
                activeId={activeTabId}
                onNavigate={handleMobileNavigate}
              />
            </div>
          </Suspense>
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
        <Suspense fallback={<div className="app-view-suspense-fallback" />}>
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
                selectedFolderIds={selectedFolderIds}
                onSelectFolder={handleSelectFolder}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onReorderFolders={handleReorderFolders}
                onDeleteFolder={handleDeleteFolder}
                onAbandonNewFolder={handleAbandonNewFolder}
                pendingAutoEditFolderId={pendingAutoEditFolderId}
                onConsumePendingAutoEdit={handleConsumePendingAutoEdit}
                searchQuery={notesSearchQuery}
                onSearchChange={handleNotesSearchChange}
                notesSearchInputRef={notesSearchInputRef}
                selectedNoteIds={selectedNoteIds}
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
        </Suspense>
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
