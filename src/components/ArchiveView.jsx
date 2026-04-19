import { useEffect, useMemo, useState } from 'react'
import { getArchiveKindLabel } from '../data/notes.js'

const SORT_OPTIONS = [
  { value: 'dateDeleted', label: 'Date Deleted' },
  { value: 'title', label: 'Title (A–Z)' },
]

export default function ArchiveView({
  archivedNotes,
  onRestore,
  onDeleteForever,
  onDeleteAllForever,
  onRestoreBatch,
  onDeleteForeverBatch,
}) {
  const [sortBy, setSortBy] = useState('dateDeleted')
  const [query, setQuery] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  const filteredSorted = useMemo(() => {
    let list = [...archivedNotes]
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((n) => {
        const kind = getArchiveKindLabel(n.archiveKind).toLowerCase()
        return (
          n.title.toLowerCase().includes(q) ||
          (n.preview ?? '').toLowerCase().includes(q) ||
          kind.includes(q)
        )
      })
    }
    if (sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title))
    } else {
      list.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    }
    return list
  }, [archivedNotes, sortBy, query])

  const visibleIdSet = useMemo(
    () => new Set(filteredSorted.map((n) => n.id)),
    [filteredSorted],
  )

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => visibleIdSet.has(id)))
  }, [visibleIdSet])

  useEffect(() => {
    const alive = new Set(archivedNotes.map((n) => n.id))
    setSelectedIds((prev) => prev.filter((id) => alive.has(id)))
  }, [archivedNotes])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const batchCount = selectedIds.length

  const toggleSelectionMode = () => {
    setSelectionMode((m) => {
      if (m) setSelectedIds([])
      return !m
    })
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const selectAllVisible = () => {
    setSelectedIds(filteredSorted.map((n) => n.id))
  }

  const clearSelection = () => setSelectedIds([])

  const handleBatchRestore = () => {
    if (batchCount === 0) return
    onRestoreBatch?.(selectedIds)
    setSelectedIds([])
    setSelectionMode(false)
  }

  const handleBatchDelete = () => {
    if (batchCount === 0) return
    onDeleteForeverBatch?.(selectedIds)
    setSelectedIds([])
    setSelectionMode(false)
  }

  return (
    <div className="archive-panel">
      <header className="archive-header">
        <div className="archive-header-text">
          <h1 className="archive-title">Archive</h1>
          <p className="archive-subtitle">
            Notes moved here will be stored indefinitely unless deleted.
          </p>
        </div>
        <div className="archive-header-controls">
          <button
            type="button"
            className={`archive-select-btn${selectionMode ? ' is-active' : ''}`}
            aria-pressed={selectionMode}
            onClick={toggleSelectionMode}
          >
            {selectionMode ? 'Done' : 'Select'}
          </button>
          <label className="archive-sort-label" htmlFor="archive-sort">
            Sort by:
          </label>
          <select
            id="archive-sort"
            className="archive-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="archive-search-wrap">
            <input
              type="search"
              className="archive-search-input"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search archived notes"
            />
            <button
              type="button"
              className="archive-search-btn"
              aria-label="Search"
              title="Search"
              tabIndex={-1}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className="archive-btn-delete-all"
            disabled={archivedNotes.length === 0}
            onClick={() => onDeleteAllForever?.()}
            title={
              archivedNotes.length === 0
                ? 'No archived items'
                : 'Permanently delete every item in the archive'
            }
          >
            Delete all
          </button>
        </div>
      </header>

      <div className="archive-divider" />

      {selectionMode && (
        <div className="archive-batch-bar">
          <span className="archive-batch-count">
            {filteredSorted.length === 0
              ? 'No items match the current filter.'
              : batchCount === 0
                ? 'None selected'
                : `${batchCount} selected`}
          </span>
          <div className="archive-batch-actions">
            <button
              type="button"
              className="archive-batch-btn"
              disabled={filteredSorted.length === 0}
              onClick={selectAllVisible}
            >
              Select all
            </button>
            <button
              type="button"
              className="archive-batch-btn archive-batch-btn-primary"
              disabled={batchCount === 0}
              onClick={handleBatchRestore}
            >
              Restore
            </button>
            <button
              type="button"
              className="archive-batch-btn archive-batch-btn-danger"
              disabled={batchCount === 0}
              onClick={handleBatchDelete}
            >
              Delete forever
            </button>
            <button
              type="button"
              className="archive-batch-btn"
              disabled={batchCount === 0}
              onClick={clearSelection}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {filteredSorted.length === 0 ? (
        <div className="archive-empty">
          {archivedNotes.length === 0
            ? 'No archived notes yet.'
            : 'No notes match your search.'}
        </div>
      ) : (
        <div className="archive-grid">
          {filteredSorted.map((note) => (
            <article
              key={note.id}
              className={`archive-card${
                selectionMode && selectedSet.has(note.id)
                  ? ' archive-card--selected'
                  : ''
              }`}
            >
              <div className="archive-card-inner">
                {selectionMode && (
                  <label
                    className="archive-card-cb-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="archive-card-cb"
                      checked={selectedSet.has(note.id)}
                      onChange={() => toggleSelect(note.id)}
                      aria-label={`Select ${note.title ?? 'item'}`}
                    />
                  </label>
                )}
                <div className="archive-card-body">
                  <p className="archive-card-meta">
                    <span className="archive-kind-badge">
                      {getArchiveKindLabel(note.archiveKind)}
                    </span>
                    <span className="archive-card-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>DELETED {note.deletedLabel}</span>
                  </p>
                  <h2 className="archive-card-title">{note.title}</h2>
                  <p className="archive-card-snippet">{note.preview}</p>
                  {!selectionMode && (
                    <div className="archive-card-actions">
                      <button
                        type="button"
                        className="archive-btn-restore"
                        onClick={() => onRestore(note.id)}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="archive-btn-delete-forever"
                        onClick={() => onDeleteForever(note.id)}
                      >
                        Delete Forever
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
