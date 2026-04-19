const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

async function parseJsonOrThrow(res) {
  const text = await res.text()
  if (!res.ok) {
    let msg = text || res.statusText
    try {
      const j = JSON.parse(text)
      msg = j.error?.message || j.error || msg
    } catch {
      /* use text */
    }
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function driveGet(accessToken, pathAndQuery) {
  const res = await fetch(`${DRIVE}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return parseJsonOrThrow(res)
}

export async function drivePostJson(accessToken, pathAndQuery, body) {
  const res = await fetch(`${DRIVE}${pathAndQuery}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return parseJsonOrThrow(res)
}

export async function drivePatchJson(accessToken, pathAndQuery, body) {
  const res = await fetch(`${DRIVE}${pathAndQuery}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return parseJsonOrThrow(res)
}

export async function driveDelete(accessToken, fileId) {
  const res = await fetch(`${DRIVE}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 404) return
  await parseJsonOrThrow(res)
}

/**
 * @param {string} q Drive search query
 */
export async function driveListFiles(accessToken, q, fields = 'files(id,name,mimeType)') {
  const params = new URLSearchParams({
    q,
    fields,
    pageSize: '100',
    spaces: 'drive',
  })
  return driveGet(accessToken, `/files?${params}`)
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function createFolder(accessToken, name, parentId) {
  return drivePostJson(accessToken, '/files?fields=id,name', {
    name,
    mimeType: FOLDER_MIME,
    parents: [parentId],
  })
}

export async function getFileMetadata(
  accessToken,
  fileId,
  fields = 'id,name,mimeType,trashed',
) {
  const q = new URLSearchParams({ fields })
  return driveGet(
    accessToken,
    `/files/${encodeURIComponent(fileId)}?${q}`,
  )
}

/**
 * Create a file with text content: metadata via Drive JSON API, then media upload.
 * (Multipart upload was unreliable in some environments; this matches updateFileMedia.)
 */
export async function createTextFile(accessToken, name, parents, content, mimeType) {
  const parentList = Array.isArray(parents) ? parents : [parents]
  const parentId = parentList[0]
  const created = await drivePostJson(accessToken, '/files?fields=id,name', {
    name,
    mimeType,
    parents: [parentId],
  })
  const res = await fetch(
    `${UPLOAD}/files/${encodeURIComponent(created.id)}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `${mimeType}; charset=UTF-8`,
      },
      body: content,
    },
  )
  await parseJsonOrThrow(res)
  return { id: created.id, name: created.name }
}

export async function updateFileMedia(accessToken, fileId, content, mimeType) {
  const res = await fetch(
    `${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `${mimeType}; charset=UTF-8`,
      },
      body: content,
    },
  )
  return parseJsonOrThrow(res)
}

/**
 * Find a direct child of parentId by exact name.
 */
export async function findChildByName(accessToken, parentId, name) {
  const esc = name.replace(/'/g, "\\'")
  const q = `'${parentId}' in parents and name = '${esc}' and trashed = false`
  const data = await driveListFiles(accessToken, q, 'files(id,name,mimeType)')
  const files = data?.files ?? []
  return files[0] ?? null
}

/**
 * Remember folder IDs created or resolved during one sync so we do not create
 * duplicates when Drive search lags right after createFolder (common API behavior).
 * Key: `${parentId}\0${segmentName}`
 * @param {Map<string, string> | undefined} pathCache
 */
export async function ensureChildFolder(accessToken, parentId, name, pathCache) {
  const cacheKey = `${parentId}\0${name}`
  if (pathCache?.has(cacheKey)) return pathCache.get(cacheKey)

  const found = await findChildByName(accessToken, parentId, name)
  if (found?.mimeType === FOLDER_MIME) {
    pathCache?.set(cacheKey, found.id)
    return found.id
  }
  const created = await createFolder(accessToken, name, parentId)
  pathCache?.set(cacheKey, created.id)
  return created.id
}

/**
 * Walk path segments under parentId, creating folders as needed.
 * @param {string[]} segments e.g. ['markdown','Notes','Personal']
 * @param {Map<string, string> | undefined} pathCache
 */
export async function ensureFolderPath(accessToken, parentId, segments, pathCache) {
  let id = parentId
  for (const seg of segments) {
    if (!seg) continue
    id = await ensureChildFolder(accessToken, id, seg, pathCache)
  }
  return id
}
