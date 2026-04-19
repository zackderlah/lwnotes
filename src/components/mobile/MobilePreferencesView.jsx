import { useEffect, useRef, useState } from 'react'
import ShortcutsSettings from '../ShortcutsSettings.jsx'
import { getThemeLabel, THEMES, THEME_OPTION_LABELS } from '../../theme.js'
import { hapticLight } from '../../mobileHaptics.js'
import '../../styles/mobile-preferences.css'

function ChevronRight() {
  return (
    <span className="mobile-prefs__chevron" aria-hidden>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
      </svg>
    </span>
  )
}

export default function MobilePreferencesView({
  theme,
  onThemeChange,
  shortcutBindings,
  onShortcutBindingsChange,
  googleClientIdConfigured,
  googleSessionActive,
  driveSyncBusy,
  onGoogleConnect,
  onGoogleDisconnect,
  onDriveSyncNow,
  cloudSyncEnabled,
  onCloudSyncChange,
  lastSyncLabel,
  cloudSyncError,
  exportBusy,
  onExportLibrary,
  importBusy,
  onImportObsidianFiles,
}) {
  const obsidianInputRef = useRef(null)
  const [subView, setSubView] = useState('main')
  const [desktopOauthOrigin, setDesktopOauthOrigin] = useState('')

  useEffect(() => {
    const fn = globalThis.noteApp?.getOauthOriginHint
    if (typeof fn !== 'function') return
    void fn().then((u) => {
      if (typeof u === 'string' && u.trim()) setDesktopOauthOrigin(u.trim())
    })
  }, [])

  const emailStatus = !googleClientIdConfigured
    ? 'Not configured'
    : googleSessionActive
      ? 'Session active'
      : 'Not signed in'

  const profileSub = googleSessionActive
    ? 'Signed in with Google'
    : 'Link Google for Drive backup'

  if (subView === 'theme') {
    return (
      <div className="mobile-prefs-sub mobile-prefs-sub--fixed">
        <header className="mobile-prefs-sub__bar">
          <button
            type="button"
            className="mobile-prefs-sub__back"
            aria-label="Back"
            onClick={() => setSubView('main')}
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
          <h2 className="mobile-prefs-sub__title">Theme</h2>
        </header>
        <div className="mobile-prefs-sub__scroll">
          <p className="mobile-prefs-theme__hint">
            Choose the visual tone of the app. You can change this anytime.
          </p>
          <div
            className="mobile-prefs-theme__list"
            role="listbox"
            aria-label="Interface theme"
          >
            {THEMES.map((id) => {
              const selected = theme === id
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`mobile-prefs-theme__option${selected ? ' mobile-prefs-theme__option--selected' : ''}`}
                  onClick={() => {
                    hapticLight()
                    onThemeChange(id)
                    setSubView('main')
                  }}
                >
                  <span className="mobile-prefs-theme__option-label">
                    {THEME_OPTION_LABELS[id]}
                  </span>
                  {selected ? (
                    <span className="mobile-prefs-theme__check" aria-hidden>
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (subView === 'shortcuts') {
    return (
      <div className="mobile-prefs-sub mobile-prefs-sub--fixed">
        <header className="mobile-prefs-sub__bar">
          <button
            type="button"
            className="mobile-prefs-sub__back"
            aria-label="Back"
            onClick={() => setSubView('main')}
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
          <h2 className="mobile-prefs-sub__title">Keyboard Shortcuts</h2>
        </header>
        <div className="mobile-prefs-sub__scroll">
          <ShortcutsSettings
            bindings={shortcutBindings}
            onChangeBindings={onShortcutBindingsChange}
          />
        </div>
      </div>
    )
  }

  if (subView === 'google') {
    return (
      <div className="mobile-prefs-sub mobile-prefs-sub--fixed">
        <header className="mobile-prefs-sub__bar">
          <button
            type="button"
            className="mobile-prefs-sub__back"
            aria-label="Back"
            onClick={() => setSubView('main')}
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
          <h2 className="mobile-prefs-sub__title">Google Drive</h2>
        </header>
        <div className="mobile-prefs-sub__scroll">
          <p className="mobile-prefs-google__p">
            Optional. Syncs your library to the <strong>Note App</strong> folder in My
            Drive when Cloud sync is enabled and you are signed in.
          </p>
          {!googleClientIdConfigured && (
            <p className="mobile-prefs-google__p">
              Add <code className="mobile-prefs-google__code">VITE_GOOGLE_CLIENT_ID</code>{' '}
              to <code className="mobile-prefs-google__code">.env</code> (see{' '}
              <code className="mobile-prefs-google__code">.env.example</code>) and restart
              the dev server.
            </p>
          )}
          {googleClientIdConfigured && (
            <p className="mobile-prefs-google__p">
              <strong>Where files go:</strong> Google Drive → My Drive →{' '}
              <strong>Note App</strong>.
            </p>
          )}
          {googleClientIdConfigured && (
            <div className="mobile-prefs-google__actions">
              {googleSessionActive ? (
                <>
                  <span className="mobile-prefs-google__status">Connected</span>
                  <button
                    type="button"
                    className="mobile-prefs-google__btn mobile-prefs-google__btn--primary"
                    disabled={driveSyncBusy}
                    onClick={() => void onDriveSyncNow()}
                  >
                    {driveSyncBusy ? 'Syncing…' : 'Sync now'}
                  </button>
                  <button
                    type="button"
                    className="mobile-prefs-google__btn"
                    disabled={driveSyncBusy}
                    onClick={() => onGoogleDisconnect()}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="mobile-prefs-google__btn mobile-prefs-google__btn--primary"
                  disabled={driveSyncBusy}
                  onClick={() => void onGoogleConnect()}
                >
                  Connect Google
                </button>
              )}
            </div>
          )}
          {desktopOauthOrigin ? (
            <p className="mobile-prefs-google__p">
              Desktop app origin:{' '}
              <code className="mobile-prefs-google__code">{desktopOauthOrigin}</code> — add
              to OAuth Web client authorized JavaScript origins.
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-prefs">
      <header className="mobile-prefs__header">
        <h1 className="mobile-prefs__title">Settings</h1>
      </header>

      <div className="mobile-prefs__scroll">
        <div className="mobile-prefs__group-label">Account</div>
        <div className="mobile-prefs__card">
          <button
            type="button"
            className="mobile-prefs__row"
            onClick={() => {
              hapticLight()
              setSubView('google')
            }}
          >
            <div className="mobile-prefs__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div className="mobile-prefs__content">
              <div className="mobile-prefs__label">Profile</div>
              <div className="mobile-prefs__sub">{profileSub}</div>
            </div>
            <ChevronRight />
          </button>
          <button
            type="button"
            className="mobile-prefs__row"
            onClick={() => {
              hapticLight()
              setSubView('google')
            }}
          >
            <div className="mobile-prefs__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </div>
            <div className="mobile-prefs__content">
              <div className="mobile-prefs__label">Email</div>
            </div>
            <span className="mobile-prefs__value">{emailStatus}</span>
            <ChevronRight />
          </button>
        </div>

        <div className="mobile-prefs__group-label">Appearance</div>
        <div className="mobile-prefs__card">
          <button
            type="button"
            className="mobile-prefs__row"
            onClick={() => {
              hapticLight()
              setSubView('theme')
            }}
          >
            <div className="mobile-prefs__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
              </svg>
            </div>
            <div className="mobile-prefs__content">
              <div className="mobile-prefs__label">Theme</div>
            </div>
            <span className="mobile-prefs__value">{getThemeLabel(theme)}</span>
            <ChevronRight />
          </button>
        </div>

        <div className="mobile-prefs__group-label">Data &amp; Sync</div>
        <div className="mobile-prefs__card">
          <div
            className="mobile-prefs__row"
            onClick={() => onCloudSyncChange(!cloudSyncEnabled)}
          >
            <div className="mobile-prefs__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
              </svg>
            </div>
            <div className="mobile-prefs__content">
              <div className="mobile-prefs__label">Cloud Sync</div>
            </div>
            <button
              type="button"
              className={`mobile-prefs__toggle${cloudSyncEnabled ? ' on' : ''}`}
              aria-pressed={cloudSyncEnabled}
              onClick={(e) => {
                e.stopPropagation()
                onCloudSyncChange(!cloudSyncEnabled)
              }}
            />
          </div>
          <button
            type="button"
            className="mobile-prefs__row"
            disabled={exportBusy}
            onClick={() => void onExportLibrary()}
          >
            <div className="mobile-prefs__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
            </div>
            <div className="mobile-prefs__content">
              <div className="mobile-prefs__label">Export Library</div>
              <div className="mobile-prefs__sub">Download as Markdown ZIP</div>
            </div>
            <ChevronRight />
          </button>
          <button
            type="button"
            className="mobile-prefs__row"
            disabled={importBusy || exportBusy}
            onClick={() => obsidianInputRef.current?.click()}
          >
            <input
              ref={obsidianInputRef}
              type="file"
              className="visually-hidden"
              tabIndex={-1}
              multiple
              webkitdirectory=""
              onChange={(e) => {
                const fl = e.target.files
                if (fl?.length) void onImportObsidianFiles(fl)
                e.target.value = ''
              }}
            />
            <div className="mobile-prefs__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
              </svg>
            </div>
            <div className="mobile-prefs__content">
              <div className="mobile-prefs__label">Import from Obsidian</div>
              <div className="mobile-prefs__sub">Choose vault folder</div>
            </div>
            <ChevronRight />
          </button>
        </div>
        <p
          className={`mobile-prefs__sync-note${cloudSyncError ? ' mobile-prefs__sync-note--error' : ''}`}
        >
          {cloudSyncError
            ? cloudSyncError
            : cloudSyncEnabled
              ? `Last backup: ${lastSyncLabel}`
              : 'Cloud sync off — local backups only when enabled.'}
        </p>

        <div className="mobile-prefs__group-label">Shortcuts</div>
        <div className="mobile-prefs__card">
          <button
            type="button"
            className="mobile-prefs__row"
            onClick={() => {
              hapticLight()
              setSubView('shortcuts')
            }}
          >
            <div className="mobile-prefs__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
              </svg>
            </div>
            <div className="mobile-prefs__content">
              <div className="mobile-prefs__label">Keyboard Shortcuts</div>
            </div>
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  )
}
