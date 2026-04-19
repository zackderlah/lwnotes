export const THEME_STORAGE_KEY = 'note-app-interface-theme'

export const DEFAULT_THEME = 'warm-grey'

/**
 * Matches `--bg-app-frame` and readable caption-button glyphs per theme (Electron
 * `titleBarOverlay` on Windows / Linux — see electron/main.cjs).
 */
export const TITLE_BAR_OVERLAY_BY_THEME = {
  'warm-grey': { color: '#D8E6F3', symbolColor: '#111111' },
  'high-contrast': { color: '#e8e8e4', symbolColor: '#000000' },
  'drab-archive': { color: '#c4bdb2', symbolColor: '#252220' },
  'deep-sea': { color: '#060a12', symbolColor: '#e6edf3' },
  gruvbox: { color: '#1d2021', symbolColor: '#ebdbb2' },
}

/** Values must match Preferences theme `<option value>` ids. */
export const THEMES = [
  'warm-grey',
  'high-contrast',
  'drab-archive',
  'deep-sea',
  'gruvbox',
]

/** Human-readable labels for settings UI (desktop + mobile). */
export const THEME_LABELS = {
  'warm-grey': 'Warm Grey',
  'high-contrast': 'High Contrast Ink',
  'drab-archive': 'Drab Archive',
  'deep-sea': 'Deep Sea (Focus)',
  gruvbox: 'Gruvbox',
}

/** Full labels for theme pickers / `<select>` options (includes “Default” on warm grey). */
export const THEME_OPTION_LABELS = {
  'warm-grey': 'Warm Grey (Default)',
  'high-contrast': 'High Contrast Ink',
  'drab-archive': 'Drab Archive',
  'deep-sea': 'Deep Sea (Focus)',
  gruvbox: 'Gruvbox',
}

export function getThemeLabel(theme) {
  const t = THEMES.includes(theme) ? theme : DEFAULT_THEME
  return THEME_LABELS[t] ?? THEME_LABELS[DEFAULT_THEME]
}

export function readStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (THEMES.includes(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

/** Warm grey uses :root defaults; other themes set `data-theme` on `<html>`. */
export function applyThemeToDocument(theme) {
  const t = THEMES.includes(theme) ? theme : DEFAULT_THEME
  if (t === 'warm-grey') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', t)
  }
}

export function getTitleBarOverlayForTheme(theme) {
  const t = THEMES.includes(theme) ? theme : DEFAULT_THEME
  return (
    TITLE_BAR_OVERLAY_BY_THEME[t] ?? TITLE_BAR_OVERLAY_BY_THEME[DEFAULT_THEME]
  )
}

/** Notify Electron to repaint native caption buttons (no-op in browser). */
export function syncElectronTitleBarForTheme(theme) {
  try {
    const overlay = getTitleBarOverlayForTheme(theme)
    globalThis.noteApp?.setTitleBarOverlay?.(overlay)
  } catch {
    /* ignore */
  }
}
