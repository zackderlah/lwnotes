export default function NoteList({
  notes,
  emptyHint = 'No notes here yet.',
  selectedNoteIds,
  onSelectNote,
  onAddNote,
  onDeleteNote,
  onDuplicateNote,
  onShowContextMenu,
}) {
  const selectedSet = new Set(selectedNoteIds ?? [])
  const handleDeleteClick = (e, note) => {
    e.stopPropagation()
    onDeleteNote(note.id)
  }

  const handleNoteContextMenu = (e, note) => {
    e.preventDefault()
    e.stopPropagation()
    onSelectNote(note.id, e)
    onShowContextMenu?.({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'Duplicate note',
          onClick: () => onDuplicateNote?.(note.id),
        },
        { type: 'separator' },
        {
          label: 'New note',
          onClick: () => onAddNote?.(),
        },
        { type: 'separator' },
        {
          label: 'Move to Archive',
          danger: true,
          onClick: () => onDeleteNote(note.id),
        },
      ],
    })
  }

  const handleListContextMenu = (e) => {
    if (e.target.closest('.note-item')) return
    e.preventDefault()
    onShowContextMenu?.({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'New note',
          onClick: () => onAddNote?.(),
        },
      ],
    })
  }

  if (notes.length === 0) {
    return (
      <div className="note-list" onContextMenu={handleListContextMenu}>
        <div className="note-item note-list-empty">
          <div className="note-preview">{emptyHint}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="note-list" onContextMenu={handleListContextMenu}>
      {notes.map((note) => (
        <div
          key={note.id}
          className={`note-item${
            selectedSet.has(note.id) ? ' selected' : ''
          }`}
          onClick={(e) => {
            if (e.altKey) e.preventDefault()
            onSelectNote(note.id, e)
          }}
          onContextMenu={(e) => handleNoteContextMenu(e, note)}
        >
          <div className="note-meta">
            <span>{note.timestamp}</span>
            <button
              type="button"
              className="note-delete-btn"
              aria-label={`Move to archive: ${note.title}`}
              title="Move to Archive"
              onClick={(e) => handleDeleteClick(e, note)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
          <div className="note-title">{note.title}</div>
          <div className="note-preview">{note.preview}</div>
        </div>
      ))}
    </div>
  )
}
