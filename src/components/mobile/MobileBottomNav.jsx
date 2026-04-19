export default function MobileBottomNav({ activeId, onNavigate }) {
  const notesActive = activeId !== 'archive' && activeId !== 'preferences'

  return (
    <nav className="mobile-bottom-nav" aria-label="Main">
      <button
        type="button"
        className={`mobile-bottom-nav__item${notesActive ? ' mobile-bottom-nav__item--active' : ''}`}
        aria-current={notesActive ? 'page' : undefined}
        onClick={() => onNavigate('notes')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="mobile-bottom-nav__label">Notes</span>
      </button>

      <button
        type="button"
        className={`mobile-bottom-nav__item${activeId === 'archive' ? ' mobile-bottom-nav__item--active' : ''}`}
        aria-current={activeId === 'archive' ? 'page' : undefined}
        onClick={() => onNavigate('archive')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 8v13H3V8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M1 3h22v5H1z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="mobile-bottom-nav__label">Archive</span>
      </button>

      <button
        type="button"
        className={`mobile-bottom-nav__item${activeId === 'preferences' ? ' mobile-bottom-nav__item--active' : ''}`}
        aria-current={activeId === 'preferences' ? 'page' : undefined}
        onClick={() => onNavigate('preferences')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className="mobile-bottom-nav__label">Preferences</span>
      </button>
    </nav>
  )
}
