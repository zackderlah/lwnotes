import { useCallback, useRef, useState } from 'react'
import { ALL_FOLDER_ID } from '../../data/folders.js'
import MobileFolderNameDialog from './MobileFolderNameDialog.jsx'

const LONG_PRESS_MS = 550

/**
 * Folder chips + scrollable note grid. Title row is above the folder bar (per product request).
 */
export default function MobileNotesHome({
  folders,
  visibleNotes,
  selectedFolderIds,
  onSelectFolder,
  onCreateFolderWithName,
  onRenameFolder,
  onDeleteFolder,
  onShowContextMenu,
  onSelectNote,
  headerTitle,
  onUndo,
  onAddNote,
}) {
  const selectedSingle =
    selectedFolderIds?.length === 1 ? selectedFolderIds[0] : ALL_FOLDER_ID

  const [nameDialog, setNameDialog] = useState(null)
  /** Block chip click right after long-press menu opens */
  const suppressFolderClickRef = useRef(false)
  const longPressTimerRef = useRef(null)
  const longPressFolderRef = useRef(null)

  const chipLabel = (folder) => {
    if (folder.id === ALL_FOLDER_ID) return 'All'
    const raw = (folder.label ?? '').trim()
    return raw || 'Folder'
  }

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressFolderRef.current = null
  }, [])

  const handleFolderPointerDown = useCallback(
    (e, folder) => {
      if (folder.id === ALL_FOLDER_ID) return
      clearLongPressTimer()
      longPressFolderRef.current = folder
      const x = e.clientX
      const y = e.clientY
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null
        longPressFolderRef.current = null
        suppressFolderClickRef.current = true
        onShowContextMenu?.({
          x,
          y,
          items: [
            {
              label: 'Rename…',
              onClick: () =>
                setNameDialog({
                  mode: 'rename',
                  folderId: folder.id,
                  initial: (folder.label ?? '').trim() || 'Folder',
                }),
            },
            {
              label: 'Delete folder',
              danger: true,
              onClick: () => onDeleteFolder?.(folder.id),
            },
          ],
        })
      }, LONG_PRESS_MS)
    },
    [clearLongPressTimer, onDeleteFolder, onShowContextMenu],
  )

  const handleFolderPointerUpOrCancel = useCallback(() => {
    clearLongPressTimer()
  }, [clearLongPressTimer])

  const handleFolderClick = useCallback(
    (e, folder) => {
      if (suppressFolderClickRef.current) {
        e.preventDefault()
        e.stopPropagation()
        suppressFolderClickRef.current = false
        return
      }
      onSelectFolder(folder.id)
    },
    [onSelectFolder],
  )

  const handleNameConfirm = useCallback(
    (trimmed) => {
      setNameDialog((d) => {
        if (d?.mode === 'create') onCreateFolderWithName?.(trimmed)
        else if (d?.mode === 'rename') onRenameFolder?.(d.folderId, trimmed)
        return null
      })
    },
    [onCreateFolderWithName, onRenameFolder],
  )

  return (
    <div className="mobile-notes-home">
      <div className="mobile-notes-home__top">
        <div className="mobile-header-row">
          <h1 className="mobile-title-large">{headerTitle}</h1>
          <button
            type="button"
            className="mobile-icon-btn"
            aria-label="Undo"
            title="Undo"
            onClick={onUndo}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M21 3v5h-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="mobile-folder-bar-wrap">
          <div className="mobile-folder-bar" role="tablist" aria-label="Folders">
            {folders.map((folder) => {
              const active = selectedSingle === folder.id
              const isAll = folder.id === ALL_FOLDER_ID
              return (
                <button
                  key={folder.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`mobile-folder-chip${active ? ' mobile-folder-chip--active' : ''}`}
                  style={{ touchAction: 'manipulation' }}
                  onClick={(e) => handleFolderClick(e, folder)}
                  onPointerDown={(e) => !isAll && handleFolderPointerDown(e, folder)}
                  onPointerUp={handleFolderPointerUpOrCancel}
                  onPointerCancel={handleFolderPointerUpOrCancel}
                  onPointerLeave={handleFolderPointerUpOrCancel}
                >
                  {chipLabel(folder)}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="mobile-folder-new-btn"
            aria-label="New folder"
            title="New folder"
            onClick={() => setNameDialog({ mode: 'create' })}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mobile-content-scroll">
        <div className="mobile-notes-grid">
          {visibleNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              className="mobile-note-card"
              onClick={() => onSelectNote(note.id)}
            >
              <div className="mobile-note-card__meta">{note.timestamp}</div>
              <div className="mobile-note-card__title">{note.title}</div>
              <div className="mobile-note-card__preview">{note.preview}</div>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="mobile-fab"
        aria-label="New note"
        onClick={onAddNote}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" />
          <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      </button>

      <MobileFolderNameDialog
        open={nameDialog != null}
        title={nameDialog?.mode === 'rename' ? 'Rename folder' : 'New folder'}
        defaultValue={
          nameDialog?.mode === 'rename' ? nameDialog.initial : 'New Folder'
        }
        confirmLabel={nameDialog?.mode === 'rename' ? 'Save' : 'Create'}
        onConfirm={handleNameConfirm}
        onCancel={() => setNameDialog(null)}
      />
    </div>
  )
}
