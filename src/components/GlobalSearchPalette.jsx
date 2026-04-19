import { useEffect, useRef } from 'react'

export default function GlobalSearchPalette({
  open,
  onClose,
  query,
  onChangeQuery,
  results,
  onPickNote,
}) {
  const inputRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onDoc, true)
    return () => document.removeEventListener('keydown', onDoc, true)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="global-search-palette-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="global-search-palette"
        role="dialog"
        aria-label="Search notes"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <label className="note-search-wrap global-search-palette-input-wrap">
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
            ref={inputRef}
            type="search"
            className="note-search-input"
            placeholder="Search notes…"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <div className="global-search-palette-hint">
          {query.trim()
            ? `${results.length} match${results.length === 1 ? '' : 'es'}`
            : 'Type to filter notes across all folders'}
        </div>

        <ul className="global-search-palette-list">
          {results.length === 0 ? (
            <li className="global-search-palette-empty">
              {query.trim() ? 'No notes match.' : ''}
            </li>
          ) : (
            results.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className="global-search-palette-item"
                  onClick={() => onPickNote(note.id)}
                >
                  <span className="global-search-palette-title">{note.title}</span>
                  <span className="global-search-palette-preview">
                    {note.preview ?? ''}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
