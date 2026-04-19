import { useEffect, useRef, useState } from 'react'
import { hapticLight } from '../../mobileHaptics.js'

/** Modal to name or rename a folder (mobile). Uses global theme tokens. */
export default function MobileFolderNameDialog({
  open,
  title = 'New folder',
  defaultValue = 'New Folder',
  confirmLabel = 'Create',
  onConfirm,
  onCancel,
}) {
  const inputRef = useRef(null)
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (!open) return
    setValue(defaultValue)
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => clearTimeout(t)
  }, [open, defaultValue])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', onDoc, true)
    return () => document.removeEventListener('keydown', onDoc, true)
  }, [open, onCancel])

  if (!open) return null

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    hapticLight()
    onConfirm(trimmed)
  }

  return (
    <div
      className="mobile-folder-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="mobile-folder-dialog"
        role="dialog"
        aria-labelledby="mobile-folder-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="mobile-folder-dialog-title" className="mobile-folder-dialog__title">
          {title}
        </h2>
        <input
          ref={inputRef}
          type="text"
          className="mobile-folder-dialog__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="mobile-folder-dialog__actions">
          <button type="button" className="mobile-folder-dialog__btn secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="mobile-folder-dialog__btn primary" onClick={submit}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
