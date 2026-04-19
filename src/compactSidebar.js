export const COMPACT_SIDEBAR_KEY = 'note-app-compact-sidebar'

export function readStoredCompactSidebar() {
  try {
    return localStorage.getItem(COMPACT_SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

export function writeStoredCompactSidebar(enabled) {
  try {
    localStorage.setItem(COMPACT_SIDEBAR_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function applyCompactSidebarToDocument(enabled) {
  if (enabled) {
    document.documentElement.setAttribute('data-compact-sidebar', 'true')
  } else {
    document.documentElement.removeAttribute('data-compact-sidebar')
  }
}
