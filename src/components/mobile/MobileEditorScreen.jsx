import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Editor from '../Editor.jsx'
import { hapticCloseSheet } from '../../mobileHaptics.js'

export default function MobileEditorScreen({
  note,
  onBack,
  onChangeTitle,
  onChangeBody,
  onRefresh,
  onAddImage,
  onRemoveImage,
}) {
  const [entered, setEntered] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const closedRef = useRef(false)
  const rootRef = useRef(null)

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const finishClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onBack()
  }, [onBack])

  const handleBack = () => {
    hapticCloseSheet()
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      finishClose()
      return
    }
    setLeaving(true)
  }

  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(() => finishClose(), 380)
    return () => clearTimeout(t)
  }, [leaving, finishClose])

  const onTransitionEnd = (e) => {
    if (e.target !== rootRef.current) return
    if (e.propertyName !== 'transform') return
    if (leaving) finishClose()
  }

  return (
    <div
      ref={rootRef}
      className={`mobile-editor-screen${entered ? ' mobile-editor-screen--open' : ''}${leaving ? ' mobile-editor-screen--leaving' : ''}`}
      onTransitionEnd={onTransitionEnd}
    >
      <header className="mobile-editor-screen__bar">
        <button
          type="button"
          className="mobile-editor-screen__back"
          onClick={handleBack}
          aria-label="Back to notes"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>
      <div className="mobile-editor-screen__body">
        <Editor
          note={note}
          onChangeTitle={onChangeTitle}
          onChangeBody={onChangeBody}
          onRefresh={onRefresh}
          onAddImage={onAddImage}
          onRemoveImage={onRemoveImage}
        />
      </div>
    </div>
  )
}
