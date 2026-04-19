import { useCallback, useEffect, useRef, useState } from 'react'
import {
  bodyToEditorHtml,
  htmlToPlainText,
  sanitizeRichHtml,
} from '../noteHtml.js'
import { runRichEditorAction } from '../richTextActions.js'

function ToolbarBtn({ label, title, onClick, children }) {
  return (
    <button
      type="button"
      className="editor-md-btn"
      title={title}
      aria-label={title || label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children ?? <span className="editor-md-btn-text">{label}</span>}
    </button>
  )
}

export default function Editor({
  note,
  onChangeTitle,
  onChangeBody,
  onRefresh,
  onAddImage,
  onRemoveImage,
}) {
  const editorRef = useRef(null)
  /** True while we set innerHTML from props — ignore synthetic input (prevents update loops / max depth). */
  const syncFromNoteRef = useRef(false)
  /** Last body string we sent to the parent from this editor (for undo/redo detection). */
  const lastEmittedBodyRef = useRef(null)
  const lastNoteIdRef = useRef(null)
  /** Previous `note.body` from the last time we reacted to a body change (avoids spurious sync on title-only re-renders). */
  const prevBodyPropRef = useRef(undefined)
  const [isEmpty, setIsEmpty] = useState(true)
  /** Rich-text toolbar hidden by default; toggle with the control above the note body. */
  const [formatToolbarVisible, setFormatToolbarVisible] = useState(false)

  const syncEmptyState = useCallback((html) => {
    setIsEmpty(!htmlToPlainText(html ?? '').trim())
  }, [])

  const commitHtml = useCallback(() => {
    if (syncFromNoteRef.current) return
    const el = editorRef.current
    if (!el) return
    let html = el.innerHTML
    const clean = sanitizeRichHtml(html)
    if (clean !== html) el.innerHTML = clean
    if (note && clean === (note.body ?? '')) return
    lastEmittedBodyRef.current = clean
    onChangeBody(clean)
    syncEmptyState(clean)
  }, [note, onChangeBody, syncEmptyState])

  useEffect(() => {
    if (!note) {
      lastEmittedBodyRef.current = null
      lastNoteIdRef.current = null
      prevBodyPropRef.current = undefined
      return undefined
    }

    const el = editorRef.current
    if (!el) return undefined

    const body = note.body ?? ''
    const idChanged = note.id !== lastNoteIdRef.current

    const applyFromParent = (rawBody) => {
      const s = rawBody ?? ''
      prevBodyPropRef.current = s
      const html = bodyToEditorHtml(s)
      syncFromNoteRef.current = true
      el.innerHTML = html
      syncEmptyState(html)
      lastEmittedBodyRef.current = s
      const t = window.setTimeout(() => {
        syncFromNoteRef.current = false
      }, 0)
      return () => {
        window.clearTimeout(t)
        syncFromNoteRef.current = false
      }
    }

    if (idChanged) {
      lastNoteIdRef.current = note.id
      return applyFromParent(body)
    }

    // Our commit just landed in the parent — do not replace DOM (keeps caret).
    if (
      lastEmittedBodyRef.current !== null &&
      body === lastEmittedBodyRef.current
    ) {
      lastEmittedBodyRef.current = null
      prevBodyPropRef.current = body
      return undefined
    }

    // Title / metadata-only re-render: body string unchanged
    if (body === prevBodyPropRef.current) {
      return undefined
    }

    // Undo/redo, import, or other external body updates
    return applyFromParent(body)
  }, [note, note?.id, note?.body, syncEmptyState])

  const runAction = useCallback(
    (kind) => {
      const el = editorRef.current
      if (!el || !note) return
      let url
      if (kind === 'link') {
        url = window.prompt('Link URL', 'https://')
        if (url === null) return
        if (!url.trim()) url = 'https://'
      }
      runRichEditorAction(el, kind, url)
      requestAnimationFrame(() => {
        commitHtml()
      })
    },
    [note, commitHtml],
  )

  const handleKeyDown = useCallback(
    (e) => {
      if (!note) return
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'b') {
        e.preventDefault()
        runAction('bold')
      } else if (k === 'i') {
        e.preventDefault()
        runAction('italic')
      } else if (k === 'k') {
        e.preventDefault()
        runAction('link')
      }
    },
    [note, runAction],
  )

  const readImageBlob = (blob) => {
    if (!blob) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onAddImage?.(reader.result)
      }
    }
    reader.readAsDataURL(blob)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (items) {
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          e.preventDefault()
          const blob = item.getAsFile()
          readImageBlob(blob)
          return
        }
      }
    }
    const html = e.clipboardData?.getData('text/html')
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!html && !text) return
    e.preventDefault()
    const el = editorRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    if (html) {
      const clean = sanitizeRichHtml(html)
      document.execCommand('insertHTML', false, clean)
    } else {
      document.execCommand('insertText', false, text)
    }
    requestAnimationFrame(() => commitHtml())
  }

  const handleDrop = (e) => {
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    let handled = false
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        handled = true
        readImageBlob(file)
      }
    }
    if (handled) e.preventDefault()
  }

  const handleDragOver = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
    }
  }

  if (!note) {
    return (
      <section className="main-editor">
        <div className="editor-header">
          <div style={{ flex: 1 }}>
            <div className="editor-meta">No note selected</div>
            <div className="editor-title-input editor-empty-state">
              Select a note to begin
            </div>
          </div>
        </div>
      </section>
    )
  }

  const images = note.images ?? []

  return (
    <section className="main-editor">
      <div className="editor-header">
        <div style={{ flex: 1 }}>
          <div className="editor-meta">{note.lastEditedLabel}</div>
          <input
            type="text"
            className="editor-title-input"
            value={note.title}
            onChange={(e) => onChangeTitle(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="refresh-icon"
          aria-label="Refresh note"
          onClick={onRefresh}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      </div>

      <div
        className="editor-content"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="editor-format-toggle-wrap">
          <button
            type="button"
            className="editor-format-toggle"
            aria-pressed={formatToolbarVisible}
            aria-expanded={formatToolbarVisible}
            aria-controls={
              formatToolbarVisible ? 'editor-format-toolbar' : undefined
            }
            aria-label={
              formatToolbarVisible
                ? 'Hide formatting toolbar'
                : 'Show formatting toolbar'
            }
            title={
              formatToolbarVisible
                ? 'Hide formatting toolbar'
                : 'Show formatting toolbar'
            }
            onClick={() => setFormatToolbarVisible((v) => !v)}
          >
            <span className="editor-format-toggle-icon" aria-hidden>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h10M4 17h14" />
              </svg>
            </span>
            <span>Formatting</span>
          </button>
        </div>

        {formatToolbarVisible && (
          <div className="editor-toolbar-row" id="editor-format-toolbar">
            <div
              className="editor-format-tools"
              role="toolbar"
              aria-label="Text formatting"
            >
              <ToolbarBtn
                label="B"
                title="Bold (Ctrl+B)"
                onClick={() => runAction('bold')}
              />
              <ToolbarBtn
                label="I"
                title="Italic (Ctrl+I)"
                onClick={() => runAction('italic')}
              />
              <ToolbarBtn
                label="S"
                title="Strikethrough"
                onClick={() => runAction('strike')}
              />
              <ToolbarBtn
                label="<>"
                title="Inline code"
                onClick={() => runAction('code')}
              />
              <ToolbarBtn
                label="Link"
                title="Link (Ctrl+K)"
                onClick={() => runAction('link')}
              />
              <span className="editor-toolbar-sep" aria-hidden />
              <ToolbarBtn
                label="H1"
                title="Heading 1"
                onClick={() => runAction('h1')}
              />
              <ToolbarBtn
                label="H2"
                title="Heading 2"
                onClick={() => runAction('h2')}
              />
              <ToolbarBtn
                label="H3"
                title="Heading 3"
                onClick={() => runAction('h3')}
              />
              <span className="editor-toolbar-sep" aria-hidden />
              <ToolbarBtn
                label="• List"
                title="Bullet list"
                onClick={() => runAction('ul')}
              />
              <ToolbarBtn
                label="1."
                title="Numbered list"
                onClick={() => runAction('ol')}
              />
              <ToolbarBtn
                label="☐"
                title="Task list"
                onClick={() => runAction('task')}
              />
              <ToolbarBtn
                label="“"
                title="Quote"
                onClick={() => runAction('quote')}
              />
              <ToolbarBtn
                label="---"
                title="Horizontal rule"
                onClick={() => runAction('hr')}
              />
              <ToolbarBtn
                label="{ }"
                title="Code block"
                onClick={() => runAction('codeblock')}
              />
            </div>
          </div>
        )}

        {images.length > 0 && (
          <div className="editor-images">
            {images.map((img) => (
              <div key={img.id} className="editor-image">
                <img src={img.dataUrl} alt="" />
                <button
                  type="button"
                  className="editor-image-remove"
                  aria-label="Remove image"
                  title="Remove image"
                  onClick={() => onRemoveImage?.(img.id)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          ref={editorRef}
          className={`editor-textarea editor-rich${isEmpty ? ' is-empty' : ''}`}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Note content"
          data-placeholder="Start writing. Formatting shows here; Data Management exports Markdown files."
          spellCheck={false}
          onInput={commitHtml}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
        />
      </div>
    </section>
  )
}
