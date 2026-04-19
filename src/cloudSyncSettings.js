export const CLOUD_SYNC_ENABLED_KEY = 'note-app-cloud-sync-enabled'
export const LAST_SYNC_AT_KEY = 'note-app-last-sync-at'

export function readLastSyncAtIso() {
  try {
    return localStorage.getItem(LAST_SYNC_AT_KEY)
  } catch {
    return null
  }
}

export function writeLastSyncAtIso(iso) {
  try {
    if (iso) localStorage.setItem(LAST_SYNC_AT_KEY, iso)
    else localStorage.removeItem(LAST_SYNC_AT_KEY)
  } catch {
    /* ignore */
  }
}

export function readStoredCloudSyncEnabled() {
  try {
    return localStorage.getItem(CLOUD_SYNC_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeStoredCloudSyncEnabled(value) {
  try {
    localStorage.setItem(CLOUD_SYNC_ENABLED_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}
