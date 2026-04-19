import { CORE_TAB_IDS, TAB_COLORS } from '../data/notes.js'

export default function Tabs({
  tabs,
  activeTabId,
  onChange,
  onDeleteTab,
  onSetTabColor,
  onShowContextMenu,
}) {
  const isCoreTab = (tabId) => CORE_TAB_IDS.includes(tabId)

  const confirmDeleteTab = (tab) => {
    if (isCoreTab(tab.id)) return
    if (tabs.length <= 1) return
    const ok = window.confirm(
      `Delete the "${tab.label}" tab and all its notes?`,
    )
    if (ok) onDeleteTab(tab.id)
  }

  const handleDelete = (e, tab) => {
    e.stopPropagation()
    confirmDeleteTab(tab)
  }

  const handleContextMenu = (e, tab) => {
    e.preventDefault()
    e.stopPropagation()
    onChange(tab.id)
    const core = isCoreTab(tab.id)
    const items = [
      { type: 'header', label: 'Color' },
      {
        type: 'colorPicker',
        colors: TAB_COLORS,
        current: tab.color ?? null,
        onSelect: (color) => onSetTabColor?.(tab.id, color),
      },
    ]
    if (!core) {
      items.push(
        { type: 'separator' },
        {
          label: 'Delete tab',
          danger: true,
          disabled: tabs.length <= 1,
          onClick: () => confirmDeleteTab(tab),
        },
      )
    }
    onShowContextMenu?.({
      x: e.clientX,
      y: e.clientY,
      items,
    })
  }

  return (
    <div className="tabs-container">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const showClose = !isCoreTab(tab.id) && tabs.length > 1
        return (
          <div
            key={tab.id}
            className={`tab${isActive ? ' active' : ''}${
              tab.color ? ' colored' : ''
            }`}
            style={
              tab.color
                ? { '--tab-color': tab.color, backgroundColor: tab.color }
                : undefined
            }
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => onChange(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onChange(tab.id)
              }
            }}
          >
            <span className="tab-label">{tab.label}</span>
            {showClose && (
              <button
                type="button"
                className="tab-close-btn"
                aria-label={`Delete ${tab.label} tab`}
                title="Delete tab"
                onClick={(e) => handleDelete(e, tab)}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <svg
                  width="10"
                  height="10"
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
            )}
          </div>
        )
      })}
    </div>
  )
}
