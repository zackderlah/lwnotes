import { useEffect, useRef, useState } from 'react'
import { ALL_FOLDER_ID, countNotesInFolder } from '../data/folders.js'

const FOLDER_DRAG_TYPE = 'application/x-note-folder-id'

export default function FolderRail({
  folders,
  notes,
  selectedFolderIds,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onReorderFolders,
  onDeleteFolder,
  onAbandonNewFolder,
  onShowContextMenu,
  pendingAutoEditFolderId,
  onConsumePendingAutoEdit,
}) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  /** Drop hint: insert before or after this folder row */
  const [dropIndicator, setDropIndicator] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [settledFolderId, setSettledFolderId] = useState(null)
  const settleTimeoutRef = useRef(null)
  const editInputRef = useRef(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (!pendingAutoEditFolderId) return
    const exists = folders.some((f) => f.id === pendingAutoEditFolderId)
    if (!exists) return
    setEditingId(pendingAutoEditFolderId)
    setDraft('')
    onConsumePendingAutoEdit?.()
  }, [pendingAutoEditFolderId, folders, onConsumePendingAutoEdit])

  useEffect(
    () => () => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current)
      }
    },
    [],
  )

  const beginEdit = (folder) => {
    if (folder.id === ALL_FOLDER_ID) return
    setEditingId(folder.id)
    setDraft(folder.label)
  }

  const commitEdit = () => {
    if (editingId == null) return
    const trimmed = draft.trim()
    const folder = folders.find((f) => f.id === editingId)
    if (!folder) {
      setEditingId(null)
      return
    }
    const isNewUnnamed = folder.label === ''
    if (isNewUnnamed) {
      if (!trimmed) {
        onAbandonNewFolder?.(editingId)
        setEditingId(null)
        return
      }
      onRenameFolder?.(editingId, trimmed)
      setEditingId(null)
      return
    }
    if (trimmed && trimmed !== folder.label) {
      onRenameFolder?.(editingId, trimmed)
    }
    setEditingId(null)
  }

  const cancelEdit = () => {
    if (editingId == null) return
    const folder = folders.find((f) => f.id === editingId)
    if (folder?.label === '') {
      onAbandonNewFolder?.(editingId)
    }
    setEditingId(null)
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  const handleRailContextMenu = (e) => {
    if (e.target.closest('.folder-rail-item')) return
    e.preventDefault()
    onShowContextMenu?.({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Create new folder',
          onClick: () => onCreateFolder?.(),
        },
      ],
    })
  }

  const handleFolderContextMenu = (e, folder) => {
    e.preventDefault()
    e.stopPropagation()
    onShowContextMenu?.({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Rename…',
          disabled: folder.id === ALL_FOLDER_ID,
          onClick: () => beginEdit(folder),
        },
        {
          label: 'Delete folder',
          disabled: folder.id === ALL_FOLDER_ID,
          onClick: () => onDeleteFolder?.(folder.id),
        },
      ],
    })
  }

  const handleDragStart = (e, folderId) => {
    if (folderId === ALL_FOLDER_ID) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData(FOLDER_DRAG_TYPE, folderId)
    e.dataTransfer.setData('text/plain', folderId)
    e.dataTransfer.effectAllowed = 'move'
    const row =
      e.currentTarget instanceof HTMLElement &&
      e.currentTarget.classList.contains('folder-rail-item')
        ? e.currentTarget
        : e.currentTarget.closest('.folder-rail-item')
    if (row) {
      const r = row.getBoundingClientRect()
      const x = Math.round(e.clientX - r.left)
      const y = Math.round(e.clientY - r.top)
      e.dataTransfer.setDragImage(row, x, y)
    }
    setDraggingId(folderId)
    setDropIndicator(null)
  }

  const handleDragEnd = () => {
    requestAnimationFrame(() => {
      setDraggingId(null)
      setDropIndicator(null)
    })
  }

  const handleRowDragOver = (e, folderId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (draggingId === folderId) {
      setDropIndicator(null)
      return
    }

    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const place = e.clientY < mid ? 'before' : 'after'

    if (folderId === ALL_FOLDER_ID) {
      if (place === 'before') {
        setDropIndicator(null)
        return
      }
      setDropIndicator({ id: ALL_FOLDER_ID, place: 'after' })
      return
    }

    setDropIndicator({ id: folderId, place })
  }

  const runSettle = (dragId) => {
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current)
    }
    setSettledFolderId(dragId)
    settleTimeoutRef.current = window.setTimeout(() => {
      setSettledFolderId(null)
      settleTimeoutRef.current = null
    }, 520)
  }

  const handleRowDrop = (e, folderId) => {
    e.preventDefault()
    setDropIndicator(null)
    setDraggingId(null)

    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const place = e.clientY < mid ? 'before' : 'after'

    const dragId =
      e.dataTransfer.getData(FOLDER_DRAG_TYPE) ||
      e.dataTransfer.getData('text/plain')
    if (!dragId) return

    if (folderId === ALL_FOLDER_ID) {
      if (place !== 'after') return
      onReorderFolders?.(dragId, ALL_FOLDER_ID, 'after')
      runSettle(dragId)
      return
    }

    if (dragId === folderId) return
    onReorderFolders?.(dragId, folderId, place)
    runSettle(dragId)
  }

  const selectedSet = new Set(selectedFolderIds ?? [])

  return (
    <aside
      className={`folder-rail${draggingId ? ' folder-rail--drag-active' : ''}`}
      aria-label="Library"
    >
      <div className="folder-rail-header-row">
        <span className="folder-rail-header-lead" aria-hidden="true" />
        <span className="folder-rail-header">Library</span>
        <button
          type="button"
          className="icon-btn folder-rail-new-folder-btn"
          aria-label="New folder"
          title="New folder"
          onClick={() => onCreateFolder?.()}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      <nav
        className="folder-rail-list"
        onContextMenu={handleRailContextMenu}
      >
        {folders.map((folder) => {
          const count = countNotesInFolder(notes, folder.id)
          const selected = selectedSet.has(folder.id)
          const isAll = folder.id === ALL_FOLDER_ID
          const editing = editingId === folder.id
          const isDragging = draggingId === folder.id
          const isSettled = settledFolderId === folder.id
          const canDrag = !isAll && !editing

          const di = dropIndicator
          const showDropBefore =
            di &&
            draggingId &&
            draggingId !== folder.id &&
            di.id === folder.id &&
            di.place === 'before'
          const showDropAfter =
            di &&
            draggingId &&
            draggingId !== folder.id &&
            di.id === folder.id &&
            di.place === 'after'

          return (
            <div
              key={folder.id}
              role={editing ? undefined : 'button'}
              tabIndex={editing ? -1 : 0}
              draggable={canDrag}
              aria-grabbed={canDrag ? isDragging : undefined}
              aria-pressed={!editing ? selected : undefined}
              title={
                canDrag
                  ? 'Drag to reorder — top half inserts above, bottom half below — click to open'
                  : undefined
              }
              className={`folder-rail-item${selected ? ' selected' : ''}${
                showDropBefore ? ' folder-rail-item--drop-before' : ''
              }${showDropAfter ? ' folder-rail-item--drop-after' : ''}${
                isDragging ? ' folder-rail-item--dragging' : ''
              }${isSettled ? ' folder-rail-item--settled' : ''}${
                canDrag ? ' folder-rail-item--movable' : ''
              }`}
              onClick={(e) => {
                if (editing) return
                if (e.altKey) e.preventDefault()
                onSelectFolder(folder.id, e)
              }}
              onKeyDown={(e) => {
                if (editing) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectFolder(folder.id, e)
                }
              }}
              onDragStart={(e) => handleDragStart(e, folder.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleRowDragOver(e, folder.id)}
              onDrop={(e) => handleRowDrop(e, folder.id)}
              onContextMenu={(e) => handleFolderContextMenu(e, folder)}
            >
              <span className="folder-rail-icon" aria-hidden>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              {editing ? (
                <input
                  ref={editInputRef}
                  type="text"
                  className="folder-rail-rename-input"
                  value={draft}
                  placeholder="Folder name"
                  maxLength={80}
                  aria-label="Folder name"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleEditKeyDown}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="folder-rail-label"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (!isAll) beginEdit(folder)
                  }}
                >
                  {folder.label || 'New folder'}
                </span>
              )}
              <span className="folder-rail-count">{count}</span>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
