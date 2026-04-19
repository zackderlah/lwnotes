/**
 * Import Obsidian vaults: folder pick yields .md files with webkitRelativePath.
 * Skips `.obsidian/` and non-markdown files.
 */

import { formatImportedMarkdown } from './markdownFormat.js'

function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\uFEFF/, '')
}

function folderIdFromKey(key) {
  const n = normalizePath(key).toLowerCase() || 'root'
  let h = 2166136261
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `obs-fld-${(h >>> 0).toString(36)}-${n.length}`
}

function folderLabelFromKey(key) {
  const k = normalizePath(key)
  if (!k || k === '.' || k === '/') return 'Obsidian root'
  return k.split('/').filter(Boolean).join(' › ')
}

function stripFrontmatter(text) {
  const raw = text.replace(/^\uFEFF/, '')
  const lines = raw.split('\n')
  if (lines[0]?.trim() !== '---') return { meta: {}, body: raw }
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end < 0) return { meta: {}, body: raw }
  const yamlBlock = lines.slice(1, end).join('\n')
  const body = lines.slice(end + 1).join('\n')
  const meta = {}
  for (const raw of yamlBlock.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    meta[m[1].toLowerCase()] = v
  }
  return { meta, body }
}

function firstHeading(body) {
  const m = body.match(/^\s*#{1,6}\s+(.+)$/m)
  return m ? m[1].trim() : ''
}

function extractTitle(meta, body, basename) {
  const t = meta.title?.trim()
  if (t) return t.slice(0, 500)
  const h = firstHeading(body)
  if (h) return h.slice(0, 500)
  const b = basename.replace(/\.md$/i, '').replace(/-/g, ' ')
  return b.slice(0, 500) || 'Untitled'
}

function makePreview(body) {
  const lines = body.split('\n')
  for (const line of lines) {
    const t = line.replace(/^#+\s+/, '').trim()
    if (t.length > 0) return t.slice(0, 120)
  }
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.slice(0, 120) || '—'
}

function dirnameFromRelativePath(rel) {
  const p = normalizePath(rel)
  const i = p.lastIndexOf('/')
  if (i <= 0) return ''
  return p.slice(0, i)
}

export function shouldSkipObsidianPath(relPath) {
  const p = normalizePath(relPath).toLowerCase()
  return p.split('/').includes('.obsidian')
}

/**
 * @param {FileList | File[]} fileList
 * @returns {Promise<{ folders: Array<{id: string, label: string}>, notes: object[], skipped: number, errors: Array<{path: string, message: string}> }>}
 */
export async function parseObsidianVaultFiles(fileList) {
  const files = Array.from(fileList).filter((f) => {
    const p = normalizePath(f.webkitRelativePath || f.name)
    if (!p.toLowerCase().endsWith('.md')) return false
    if (shouldSkipObsidianPath(p)) return false
    return true
  })

  const skipped = Array.from(fileList).length - files.length

  if (files.length === 0) {
    return { folders: [], notes: [], skipped, errors: [] }
  }

  const dirKeys = new Set()
  for (const f of files) {
    const rel = normalizePath(f.webkitRelativePath || f.name)
    const dir = dirnameFromRelativePath(rel) || '.'
    dirKeys.add(dir)
  }

  /** @type {Map<string, { id: string, label: string }>} */
  const folderByKey = new Map()
  for (const key of dirKeys) {
    folderByKey.set(key, {
      id: folderIdFromKey(key),
      label: folderLabelFromKey(key),
    })
  }

  const folders = Array.from(
    new Map(
      [...folderByKey.values()].map((f) => [f.id, f]),
    ).values(),
  )

  const errors = []
  const notes = []
  let seq = 0

  for (const file of files) {
    const rel = normalizePath(file.webkitRelativePath || file.name)
    try {
      const text = await file.text()
      const dirKey = dirnameFromRelativePath(rel) || '.'
      const folder = folderByKey.get(dirKey)
      if (!folder) {
        errors.push({ path: rel, message: 'Internal folder map error' })
        continue
      }
      const base = rel.split('/').pop() ?? 'note.md'
      const baseName = base.replace(/\.md$/i, '')
      const { meta, body: rawBody } = stripFrontmatter(text)
      const body = formatImportedMarkdown(rawBody)
      const title = extractTitle(meta, body, baseName)
      const preview = makePreview(body)
      const id = `obs-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 9)}`
      seq += 1
      notes.push({
        id,
        folderId: folder.id,
        timestamp: 'Imported',
        lastEditedLabel: 'Imported from Obsidian',
        title,
        preview,
        body,
        images: [],
      })
    } catch (e) {
      errors.push({
        path: rel,
        message: e?.message ?? String(e),
      })
    }
  }

  return { folders, notes, skipped, errors }
}

/**
 * @param {object} prevState App history state
 * @param {Array<{id: string, label: string}>} importedFolders
 * @param {object[]} importedNotes
 */
export function mergeObsidianImportIntoState(
  prevState,
  importedFolders,
  importedNotes,
) {
  const tabId = 'notes'
  const prevFolders = prevState.libraryFoldersByTab?.[tabId] ?? []
  const prevNotes = prevState.notesByTab?.[tabId] ?? []
  const seen = new Set(prevFolders.map((f) => f.id))
  const mergedFolders = [...prevFolders]
  for (const f of importedFolders) {
    if (!seen.has(f.id)) {
      mergedFolders.push({ id: f.id, label: f.label })
      seen.add(f.id)
    }
  }
  const mergedNotes = [...importedNotes, ...prevNotes]
  const firstId = importedNotes[0]?.id ?? prevState.selectedByTab?.[tabId]
  return {
    ...prevState,
    libraryFoldersByTab: {
      ...prevState.libraryFoldersByTab,
      [tabId]: mergedFolders,
    },
    notesByTab: {
      ...prevState.notesByTab,
      [tabId]: mergedNotes,
    },
    activeTabId: tabId,
    selectedByTab: {
      ...prevState.selectedByTab,
      [tabId]: firstId ?? null,
    },
  }
}
