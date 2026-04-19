import { useCallback, useEffect, useRef, useState } from 'react'
import ShortcutsSettings from './ShortcutsSettings.jsx'
import { THEMES, THEME_OPTION_LABELS } from '../theme.js'

const SECTION_IDS = [
  'prefs-account',
  'prefs-appearance',
  'prefs-data',
  'prefs-shortcuts',
]

export default function PreferencesView({
  theme,
  onThemeChange,
  compactSidebar,
  onCompactSidebarChange,
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
  const contentRef = useRef(null)
  const [activeSection, setActiveSection] = useState(SECTION_IDS[0])
  /** Set in Electron packaged build (http://127.0.0.1:port); empty in browser / dev. */
  const [desktopOauthOrigin, setDesktopOauthOrigin] = useState('')

  useEffect(() => {
    const fn = globalThis.noteApp?.getOauthOriginHint
    if (typeof fn !== 'function') return
    void fn().then((u) => {
      if (typeof u === 'string' && u.trim()) setDesktopOauthOrigin(u.trim())
    })
  }, [])

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setActiveSection(id)
  }, [])

  useEffect(() => {
    const root = contentRef.current
    if (!root) return

    const updateActive = () => {
      const rootRect = root.getBoundingClientRect()
      const fromTop = 72
      let best = SECTION_IDS[0]
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id)
        if (!el) continue
        const t = el.getBoundingClientRect().top - rootRect.top
        if (t <= fromTop) best = id
      }
      setActiveSection(best)
    }

    root.addEventListener('scroll', updateActive, { passive: true })
    updateActive()
    return () => root.removeEventListener('scroll', updateActive)
  }, [])

  return (
    <div className="preferences-root">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">Settings</div>
        </div>
        <nav className="settings-nav" aria-label="Settings sections">
          <button
            type="button"
            className={`nav-item${activeSection === 'prefs-account' ? ' selected' : ''}`}
            onClick={() => scrollToSection('prefs-account')}
          >
            Account
          </button>
          <button
            type="button"
            className={`nav-item${activeSection === 'prefs-appearance' ? ' selected' : ''}`}
            onClick={() => scrollToSection('prefs-appearance')}
          >
            Appearance
          </button>
          <button
            type="button"
            className={`nav-item${activeSection === 'prefs-data' ? ' selected' : ''}`}
            onClick={() => scrollToSection('prefs-data')}
          >
            Data &amp; Export
          </button>
          <button
            type="button"
            className={`nav-item${activeSection === 'prefs-shortcuts' ? ' selected' : ''}`}
            onClick={() => scrollToSection('prefs-shortcuts')}
          >
            Shortcuts
          </button>
        </nav>
      </aside>

      <div className="content-area" ref={contentRef}>
        <h1 className="section-title">General Preferences</h1>

        <section
          id="prefs-account"
          className="settings-group prefs-section"
          aria-labelledby="prefs-account-heading"
        >
          <h2 className="group-label" id="prefs-account-heading">
            Account
          </h2>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">Google account</div>
              <div className="setting-desc">
                Optional. Used only to upload your library to your own Google Drive
                (folder <code className="prefs-inline-code">Note App</code> in My
                Drive). The app requests access to files it creates, not your whole
                Drive.
              </div>
            </div>
          </div>
        </section>

        <section
          id="prefs-appearance"
          className="settings-group prefs-section"
          aria-labelledby="prefs-appearance-heading"
        >
          <h2 className="group-label" id="prefs-appearance-heading">
            Appearance
          </h2>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">Interface Theme</div>
              <div className="setting-desc">
                Select the visual tone of the application.
              </div>
            </div>
            <select
              className="select-field"
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
              aria-label="Interface theme"
            >
              {THEMES.map((id) => (
                <option key={id} value={id}>
                  {THEME_OPTION_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">Compact Sidebar</div>
              <div className="setting-desc">
                Tighter spacing in the folder rail and note list (Notes tab).
              </div>
            </div>
            <div
              role="switch"
              tabIndex={0}
              aria-checked={compactSidebar}
              className={`toggle${compactSidebar ? ' on' : ''}`}
              onClick={() => onCompactSidebarChange(!compactSidebar)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onCompactSidebarChange(!compactSidebar)
                }
              }}
            />
          </div>
        </section>

        <section
          id="prefs-data"
          className="settings-group prefs-section"
          aria-labelledby="prefs-data-heading"
        >
          <h2 className="group-label" id="prefs-data-heading">
            Data Management
          </h2>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">Export Library</div>
              <div className="setting-desc">
                Download a ZIP with Markdown copies and a full{' '}
                <code className="prefs-inline-code">library.json</code> snapshot.
              </div>
            </div>
            <button
              type="button"
              className="button"
              disabled={exportBusy}
              onClick={() => void onExportLibrary()}
            >
              {exportBusy ? 'Exporting…' : 'Export All'}
            </button>
          </div>
          <div className="setting-row">
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
            <div className="setting-info">
              <div className="setting-name">Import from Obsidian</div>
              <div className="setting-desc">
                Select your vault folder (or a folder inside it). Markdown notes are
                added to the Notes tab; subfolders become Library groups (nested paths
                use &quot; › &quot; in the label). The{' '}
                <code className="prefs-inline-code">.obsidian</code> folder is
                ignored.
              </div>
            </div>
            <button
              type="button"
              className="button"
              disabled={importBusy || exportBusy}
              onClick={() => obsidianInputRef.current?.click()}
            >
              {importBusy ? 'Importing…' : 'Choose folder…'}
            </button>
          </div>
          <div className="prefs-google-block">
            <div className="setting-row prefs-google-title-row">
              <div className="setting-info">
                <div className="setting-name">Google Drive</div>
                <div className="setting-desc">
                  Sync mirrors{' '}
                  <code className="prefs-inline-code">library.json</code>,{' '}
                  <code className="prefs-inline-code">README.txt</code>, and a{' '}
                  <code className="prefs-inline-code">markdown/</code> tree: each tab
                  → library folder → note files. Turn on Cloud sync below to push
                  automatically after edits.
                </div>
                {!googleClientIdConfigured && (
                  <p className="prefs-google-setup-hint" role="note">
                    Create a <code className="prefs-inline-code">.env</code> file in the
                    project root (copy from{' '}
                    <code className="prefs-inline-code">.env.example</code>) — Vite does
                    not load <code className="prefs-inline-code">.env.example</code>.
                    Set <code className="prefs-inline-code">VITE_GOOGLE_CLIENT_ID</code>{' '}
                    and enable the Google Drive API. In Google Cloud → OAuth Web client →
                    Authorized JavaScript origins, add{' '}
                    <code className="prefs-inline-code">http://localhost:5181</code>{' '}
                    (or your Vite port) for local web dev
                    {desktopOauthOrigin ? (
                      <>
                        , and{' '}
                        <code className="prefs-inline-code">{desktopOauthOrigin}</code>{' '}
                        for the installed desktop app
                      </>
                    ) : null}
                    . Restart the dev server after editing{' '}
                    <code className="prefs-inline-code">.env</code>.
                  </p>
                )}
              </div>
            </div>
            {googleClientIdConfigured && (
              <p className="prefs-google-browser-hint prefs-google-where-drive">
                <strong>Where files go:</strong> open{' '}
                <a
                  href="https://drive.google.com/drive/my-drive"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Drive
                </a>{' '}
                → <strong>My Drive</strong> → folder <strong>Note App</strong> (created on
                first successful sync). Shared drives are not used. Use the same Google
                account you clicked at sign-in.
              </p>
            )}
            {googleClientIdConfigured && (
              <p className="prefs-google-browser-hint">
                {desktopOauthOrigin ? (
                  <>
                    Use a <strong>Web application</strong> OAuth client (not Desktop).
                    The desktop app loads from{' '}
                    <code className="prefs-inline-code">{desktopOauthOrigin}</code> — add
                    that <strong>exact</strong> URL under <strong>Authorized JavaScript
                    origins</strong> in Google Cloud (
                    <code className="prefs-inline-code">127.0.0.1</code> and{' '}
                    <code className="prefs-inline-code">localhost</code> are different
                    origins — register the one the app uses). If you see <strong>redirect_uri_mismatch</strong>, the origin is
                    missing or mistyped; you can also add{' '}
                    <code className="prefs-inline-code">{desktopOauthOrigin}/</code> under{' '}
                    <strong>Authorized redirect URIs</strong>. Allow popups and
                    third-party cookies for Google.
                  </>
                ) : (
                  <>
                    If the Google window never finishes loading, use Chrome or Edge at{' '}
                    <code className="prefs-inline-code">http://localhost:5181</code> —
                    not an in-editor or embedded browser — and allow cookies for Google.
                  </>
                )}
              </p>
            )}
            {googleClientIdConfigured && (
              <div className="prefs-google-actions">
                {googleSessionActive ? (
                  <>
                    <span className="prefs-google-status">Connected</span>
                    <button
                      type="button"
                      className="button"
                      disabled={driveSyncBusy}
                      onClick={() => void onDriveSyncNow()}
                    >
                      {driveSyncBusy ? 'Syncing…' : 'Sync now'}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={driveSyncBusy}
                      onClick={() => onGoogleDisconnect()}
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="button"
                    disabled={driveSyncBusy}
                    onClick={() => void onGoogleConnect()}
                  >
                    Connect Google
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">Cloud Sync</div>
              <div className="setting-desc">
                Saves backups on this device (IndexedDB). In the desktop app, also
                writes <code className="prefs-inline-code">latest.json</code> under
                your user data folder. When Google is connected, also syncs to
                Drive as above.
              </div>
            </div>
            <div
              role="switch"
              tabIndex={0}
              aria-checked={cloudSyncEnabled}
              className={`toggle${cloudSyncEnabled ? ' on' : ''}`}
              onClick={() => onCloudSyncChange(!cloudSyncEnabled)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onCloudSyncChange(!cloudSyncEnabled)
                }
              }}
            />
          </div>
          <div className="prefs-sync-status">
            <span className="prefs-sync-status-label">Last backup</span>
            <span className="prefs-sync-status-value">
              {cloudSyncEnabled ? lastSyncLabel : '—'}
            </span>
            {cloudSyncError && (
              <span className="prefs-sync-status-error" role="alert">
                {cloudSyncError}
              </span>
            )}
          </div>
        </section>

        <section
          id="prefs-shortcuts"
          className="settings-group prefs-section"
          aria-labelledby="prefs-shortcuts-heading"
        >
          <h2 className="group-label" id="prefs-shortcuts-heading">
            Keyboard Shortcuts
          </h2>
          <ShortcutsSettings
            bindings={shortcutBindings}
            onChangeBindings={onShortcutBindingsChange}
          />
        </section>
      </div>
    </div>
  )
}
