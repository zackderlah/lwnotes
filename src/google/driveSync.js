import { buildGoogleDriveSyncManifest } from '../driveSyncManifest.js'
import {
  createTextFile,
  createFolder,
  driveDelete,
  driveListFiles,
  ensureFolderPath,
  findChildByName,
  getFileMetadata,
  updateFileMedia,
} from './driveApi.js'
import { getGoogleAccessTokenForSync } from './googleAuth.js'

const SYNC_STATE_KEY = 'note-app-drive-sync-state-v1'
const ROOT_NAME = 'Note App'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

function loadSyncState() {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY)
    if (!raw) return { rootFolderId: null, files: {} }
    const j = JSON.parse(raw)
    return {
      rootFolderId: j.rootFolderId ?? null,
      files: typeof j.files === 'object' && j.files ? j.files : {},
    }
  } catch {
    return { rootFolderId: null, files: {} }
  }
}

function saveSyncState(state) {
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function mimeForPath(path) {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.md')) return 'text/markdown'
  return 'text/plain'
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Shorten common Google Cloud misconfiguration errors for the preferences UI. */
function friendlyDriveError(msg) {
  const m = msg ?? ''
  if (
    /Google Drive API has not been used|has not been used in project|SERVICE_DISABLED|API has not been used|it is disabled\. Enable it/i.test(
      m,
    )
  ) {
    return 'Enable the Google Drive API for this project: Google Cloud Console → APIs & Services → Library → search “Google Drive API” → Enable. Wait 1–2 minutes, then click Sync now again.'
  }
  return m
}

async function ensureRootFolder(accessToken) {
  const esc = ROOT_NAME.replace(/'/g, "\\'")
  const q = `name = '${esc}' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const data = await driveListFiles(accessToken, q, 'files(id,name)')
  const hit = data?.files?.[0]
  if (hit) return hit.id

  const created = await createFolder(accessToken, ROOT_NAME, 'root')
  return created.id
}

/**
 * Upload library snapshot + nested markdown tree under "Note App".
 * Removes Drive files that are no longer in the manifest.
 */
export async function syncLibraryToGoogleDrive(state) {
  let accessToken
  try {
    accessToken = await getGoogleAccessTokenForSync()
  } catch (e) {
    return {
      ok: false,
      error: e?.message ?? 'Not signed in to Google',
    }
  }

  const manifest = buildGoogleDriveSyncManifest(state)
  const wantedPaths = new Set(manifest.files.map((f) => f.path))

  const syncState = loadSyncState()
  try {
    if (syncState.rootFolderId) {
      try {
        const meta = await getFileMetadata(accessToken, syncState.rootFolderId)
        if (meta?.trashed || meta?.mimeType !== FOLDER_MIME) {
          syncState.rootFolderId = null
          syncState.files = {}
        }
      } catch (e) {
        if (e?.status === 404) {
          syncState.rootFolderId = null
          syncState.files = {}
        } else {
          throw e
        }
      }
    }
    if (!syncState.rootFolderId) {
      syncState.rootFolderId = await ensureRootFolder(accessToken)
      saveSyncState(syncState)
    }

    const rootId = syncState.rootFolderId
    /** Dedupe folder creates within this run (Drive search can lag after createFolder). */
    const folderPathCache = new Map()
    let count = 0

    for (const { path, content } of manifest.files) {
      const segments = path.split('/').filter(Boolean)
      const fileName = segments.pop()
      const parentId =
        segments.length === 0
          ? rootId
          : await ensureFolderPath(accessToken, rootId, segments, folderPathCache)

      const mime = mimeForPath(path)
      const knownId = syncState.files[path]

      if (knownId) {
        try {
          await updateFileMedia(accessToken, knownId, content, mime)
        } catch (e) {
          if (e?.status === 404) {
            const { id } = await createTextFile(
              accessToken,
              fileName,
              [parentId],
              content,
              mime,
            )
            syncState.files[path] = id
          } else {
            throw e
          }
        }
      } else {
        const existing = await findChildByName(accessToken, parentId, fileName)
        if (existing && !existing.mimeType?.includes('folder')) {
          await updateFileMedia(accessToken, existing.id, content, mime)
          syncState.files[path] = existing.id
        } else {
          const { id } = await createTextFile(
            accessToken,
            fileName,
            [parentId],
            content,
            mime,
          )
          syncState.files[path] = id
        }
      }
      count += 1
      await sleep(40)
    }

    const toRemove = Object.keys(syncState.files).filter((p) => !wantedPaths.has(p))
    for (const p of toRemove) {
      const fid = syncState.files[p]
      if (fid) {
        try {
          await driveDelete(accessToken, fid)
        } catch {
          /* ignore */
        }
      }
      delete syncState.files[p]
    }

    saveSyncState(syncState)
    return { ok: true, fileCount: count }
  } catch (e) {
    const msg = e?.message ?? String(e)
    if (e?.status === 401 || /401|Invalid Credentials|UNAUTHORIZED/i.test(msg)) {
      return { ok: false, error: 'Google session expired. Connect again.' }
    }
    return { ok: false, error: friendlyDriveError(msg) }
  }
}

export function clearDriveSyncState() {
  try {
    localStorage.removeItem(SYNC_STATE_KEY)
  } catch {
    /* ignore */
  }
}
