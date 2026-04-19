/** Google Identity Services (OAuth 2.0) — access token for Drive API. */

const STORAGE_KEY = 'note-app-google-oauth'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
/** If the GIS callback never runs (common in embedded browsers), surface this after wait. */
const OAUTH_STALL_MS = 120_000

export function getGoogleClientId() {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return typeof id === 'string' && id.trim() ? id.trim() : ''
}

export function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (globalThis.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const existing = document.querySelector('script[data-gsi]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Google Sign-In script failed')),
      )
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.dataset.gsi = '1'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(s)
  })
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeStored(data) {
  try {
    if (data == null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

/** @returns {{ access_token: string, expires_at: number } | null} */
export function readPersistedGoogleSession() {
  const s = readStored()
  if (!s?.access_token || !s?.expires_at) return null
  if (Date.now() > s.expires_at - 60_000) return null
  return s
}

export function clearGoogleSession() {
  writeStored(null)
  tokenClient = null
  pendingOAuth = null
  if (pendingTimeout != null) {
    clearTimeout(pendingTimeout)
    pendingTimeout = null
  }
}

let tokenClient = null
/** @type {{ resolve: (v: any) => void, reject: (e: Error) => void } | null} */
let pendingOAuth = null
let pendingTimeout = null

function clearOAuthWait() {
  if (pendingTimeout != null) {
    clearTimeout(pendingTimeout)
    pendingTimeout = null
  }
}

function finishPendingError(err) {
  const p = pendingOAuth
  pendingOAuth = null
  clearOAuthWait()
  if (p) p.reject(err)
}

function finishPendingSuccess(val) {
  const p = pendingOAuth
  pendingOAuth = null
  clearOAuthWait()
  if (p) p.resolve(val)
}

function mapGisErrorType(type) {
  if (type === 'popup_closed') {
    return 'Sign-in window closed before finishing.'
  }
  if (type === 'popup_failed_to_open') {
    return 'Popup was blocked — allow popups for this site.'
  }
  return `Google sign-in could not complete (${type ?? 'unknown'}).`
}

function ensureTokenClient(clientId) {
  if (tokenClient) return
  tokenClient = globalThis.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    /** Avoid incremental-auth edge cases when the same OAuth client is used by other apps. */
    include_granted_scopes: false,
    callback: (resp) => {
      if (resp.error) {
        finishPendingError(new Error(resp.error))
        return
      }
      const expires_at = Date.now() + (resp.expires_in ?? 3600) * 1000
      writeStored({
        access_token: resp.access_token,
        expires_at,
      })
      finishPendingSuccess({
        access_token: resp.access_token,
        expires_in: resp.expires_in ?? 3600,
      })
    },
    error_callback: (err) => {
      finishPendingError(new Error(mapGisErrorType(err?.type)))
    },
  })
}

/**
 * @param {{ prompt?: '' | 'consent' | 'select_account' }} opts
 */
export function requestGoogleAccessToken(opts = {}) {
  const clientId = getGoogleClientId()
  if (!clientId) {
    return Promise.reject(
      new Error(
        'Missing VITE_GOOGLE_CLIENT_ID. Add it to .env and restart the dev server.',
      ),
    )
  }
  if (pendingOAuth) {
    return Promise.reject(new Error('Another Google sign-in is already in progress.'))
  }

  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        await loadGsiScript()
        ensureTokenClient(clientId)
        pendingOAuth = { resolve, reject }
        pendingTimeout = setTimeout(() => {
          pendingTimeout = null
          finishPendingError(
            new Error(
              'Google sign-in timed out. Open this app in Chrome or Edge (not an in-editor browser), allow third-party cookies for accounts.google.com, pause ad blockers, then try again.',
            ),
          )
        }, OAUTH_STALL_MS)
        tokenClient.requestAccessToken({
          prompt: opts.prompt ?? '',
        })
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        if (pendingOAuth) finishPendingError(err)
        else reject(err)
      }
    })()
  })
}

export async function getGoogleAccessTokenForSync() {
  const cached = readPersistedGoogleSession()
  if (cached) return cached.access_token
  return (await requestGoogleAccessToken({ prompt: '' })).access_token
}
