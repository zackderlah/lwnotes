import { useEffect, useMemo, useState } from 'react'
import {
  SHORTCUT_ACTION_IDS,
  SHORTCUT_ACTION_META,
  formatShortcutLabel,
  bindingFromKeyboardEventCapture,
  setShortcutRecording,
  writeShortcutBindings,
  getDefaultShortcutBindings,
  bindingsEqual,
} from '../shortcuts.js'

const MAIN_ACTIONS = [
  'newNote',
  'searchNotes',
  'toggleArchive',
  'undo',
  'redo',
]

function tabActionIds() {
  return SHORTCUT_ACTION_IDS.filter((id) => id.startsWith('goToTab'))
}

export default function ShortcutsSettings({ bindings, onChangeBindings }) {
  const [recordingId, setRecordingId] = useState(null)
  const tabIds = useMemo(() => tabActionIds(), [])

  useEffect(() => {
    setShortcutRecording(!!recordingId)
    return () => setShortcutRecording(false)
  }, [recordingId])

  useEffect(() => {
    if (!recordingId) return
    const onKey = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecordingId(null)
        return
      }
      const next = bindingFromKeyboardEventCapture(e)
      if (!next) return
      onChangeBindings((prev) => {
        const merged = { ...prev, [recordingId]: next }
        for (const oid of SHORTCUT_ACTION_IDS) {
          if (oid === recordingId) continue
          if (bindingsEqual(merged[oid], next)) {
            merged[oid] = { ...SHORTCUT_ACTION_META[oid].defaultBinding }
          }
        }
        writeShortcutBindings(merged)
        return merged
      })
      setRecordingId(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recordingId, onChangeBindings])

  const handleResetAll = () => {
    if (!window.confirm('Reset all shortcuts to defaults?')) return
    const defs = getDefaultShortcutBindings()
    onChangeBindings(() => defs)
    writeShortcutBindings(defs)
  }

  const renderRow = (id) => {
    const meta = SHORTCUT_ACTION_META[id]
    if (!meta) return null
    const b = bindings[id]
    const isRec = recordingId === id
    const title = meta.description
      ? `${meta.label} — ${meta.description}`
      : meta.label
    return (
      <li key={id} className="shortcuts-row">
        <span className="shortcuts-row-label" title={title}>
          {meta.label}
        </span>
        <kbd className="shortcut-key shortcuts-row-kbd">
          {isRec ? '…' : formatShortcutLabel(b)}
        </kbd>
        <button
          type="button"
          className={`shortcuts-row-set${isRec ? ' shortcuts-row-set--active' : ''}`}
          onClick={() => setRecordingId((cur) => (cur === id ? null : id))}
        >
          {isRec ? '…' : 'Set'}
        </button>
      </li>
    )
  }

  return (
    <div className="shortcuts-simple">
      <ul className="shortcuts-simple-list">{MAIN_ACTIONS.map(renderRow)}</ul>

      <p className="shortcuts-simple-section-title">Number keys</p>
      <p className="shortcuts-simple-section-note">
        With ⌘ or Ctrl — jump to that tab when it exists.
      </p>
      <ul className="shortcuts-simple-list">{tabIds.map(renderRow)}</ul>

      <p className="shortcuts-simple-hint">
        Click <strong>Set</strong>, press the new shortcut. <strong>Esc</strong>{' '}
        cancels.
      </p>
      <button
        type="button"
        className="shortcuts-restore-all"
        onClick={handleResetAll}
      >
        Restore defaults
      </button>
    </div>
  )
}
