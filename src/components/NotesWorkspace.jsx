import FolderRail from './FolderRail.jsx'
import NoteList from './NoteList.jsx'

export default function NotesWorkspace({
  folders,
  notes,
  visibleNotes,
  selectedFolderIds,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onReorderFolders,
  onDeleteFolder,
  onAbandonNewFolder,
  pendingAutoEditFolderId,
  onConsumePendingAutoEdit,
  searchQuery,
  onSearchChange,
  selectedNoteIds,
  onSelectNote,
  onAddNote,
  onDeleteNote,
  onDuplicateNote,
  onShowContextMenu,
  notesSearchInputRef,
}) {
  const emptyHint =
    notes.length === 0
      ? 'No notes here yet.'
      : searchQuery.trim()
        ? 'No notes match your search.'
        : 'No notes in this folder.'

  return (
    <div className="notes-workspace">
      <FolderRail
        folders={folders}
        notes={notes}
        selectedFolderIds={selectedFolderIds}
        onSelectFolder={onSelectFolder}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onReorderFolders={onReorderFolders}
        onDeleteFolder={onDeleteFolder}
        onAbandonNewFolder={onAbandonNewFolder}
        pendingAutoEditFolderId={pendingAutoEditFolderId}
        onConsumePendingAutoEdit={onConsumePendingAutoEdit}
        onShowContextMenu={onShowContextMenu}
      />
      <div className="note-list-panel">
        <div className="note-list-toolbar">
          <label className="note-search-wrap">
            <span className="visually-hidden">Search notes</span>
            <span className="note-search-icon" aria-hidden>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              ref={notesSearchInputRef}
              type="search"
              className="note-search-input"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className="icon-btn note-list-add-btn"
            aria-label="Add note"
            onClick={onAddNote}
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
        <NoteList
          notes={visibleNotes}
          emptyHint={emptyHint}
          selectedNoteIds={selectedNoteIds}
          onSelectNote={onSelectNote}
          onAddNote={onAddNote}
          onDeleteNote={onDeleteNote}
          onDuplicateNote={onDuplicateNote}
          onShowContextMenu={onShowContextMenu}
        />
      </div>
    </div>
  )
}
