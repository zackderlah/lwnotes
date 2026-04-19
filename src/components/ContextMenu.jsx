import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x, top: y, ready: false })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 8
    let left = x
    let top = y
    if (left + rect.width > vw - margin) left = vw - rect.width - margin
    if (top + rect.height > vh - margin) top = vh - rect.height - margin
    if (left < margin) left = margin
    if (top < margin) top = margin
    setPos({ left, top, ready: true })
  }, [x, y, items])

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    const onWheel = () => onClose()
    const onResize = () => onClose()
    const onContext = (e) => {
      if (!ref.current?.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    document.addEventListener('wheel', onWheel, { passive: true })
    document.addEventListener('contextmenu', onContext)
    window.addEventListener('resize', onResize)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('contextmenu', onContext)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{
        left: pos.left,
        top: pos.top,
        visibility: pos.ready ? 'visible' : 'hidden',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={`sep-${i}`} className="context-menu-separator" />
        }
        if (item.type === 'header') {
          return (
            <div key={`header-${i}`} className="context-menu-header">
              {item.label}
            </div>
          )
        }
        if (item.type === 'colorPicker') {
          return (
            <div key={`colors-${i}`} className="context-menu-color-row">
              {item.colors.map((c) => {
                const isNone = !c.value
                const isSelected =
                  (c.value ?? null) === (item.current ?? null)
                return (
                  <button
                    key={c.value ?? 'none'}
                    type="button"
                    className={`color-swatch${isNone ? ' none' : ''}${
                      isSelected ? ' selected' : ''
                    }`}
                    style={c.value ? { backgroundColor: c.value } : undefined}
                    aria-label={c.label}
                    title={c.label}
                    onClick={() => {
                      item.onSelect?.(c.value)
                      onClose()
                    }}
                  />
                )
              })}
            </div>
          )
        }
        const classes = [
          'context-menu-item',
          item.danger ? 'danger' : '',
          item.disabled ? 'disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={item.label + i}
            type="button"
            role="menuitem"
            className={classes}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              item.onClick?.()
              onClose()
            }}
          >
            <span className="context-menu-label">{item.label}</span>
            {item.shortcut && (
              <span className="context-menu-shortcut">{item.shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
