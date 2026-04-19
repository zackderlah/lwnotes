import { ALL_FOLDER_ID } from './data/folders.js'
import { ARCHIVE_KIND_NOTE, DEFAULT_NOTE_FOLDER_ID } from './data/notes.js'
import { noteMarkdownFile, sanitizeSegment } from './libraryExport.js'
import { buildSnapshotPayload } from './cloudBackup.js'

/**
 * Markdown files for one tab bucket (tab id + label used for Drive path segment).
 */
/** One file per path (last wins) so duplicate tab rows or manifest quirks cannot double-upload. */
function dedupeFilesByPath(files) {
  const byPath = new Map()
  for (const f of files) {
    byPath.set(f.path, f)
  }
  return Array.from(byPath.values())
}

function appendMarkdownForTab(files, tab, notes, libraryFoldersByTab) {
  const folders = libraryFoldersByTab?.[tab.id] ?? []
  const tabSeg = sanitizeSegment(tab.label || tab.id)

  for (const note of notes) {
    let effectiveFolderId = note.folderId ?? DEFAULT_NOTE_FOLDER_ID
    if (effectiveFolderId === ALL_FOLDER_ID) {
      effectiveFolderId = DEFAULT_NOTE_FOLDER_ID
    }
    const folderLabel =
      folders.find((f) => f.id === effectiveFolderId)?.label ??
      effectiveFolderId ??
      'Notes'
    const folderSeg = sanitizeSegment(folderLabel)
    // Full id avoids collisions; matches stable paths across syncs for the same note.
    const fname = `${sanitizeSegment(note.title)}-${sanitizeSegment(note.id)}.md`
    const path = `markdown/${tabSeg}/${folderSeg}/${fname}`
    files.push({
      path,
      content: noteMarkdownFile(note, {
        tabId: tab.id,
        folderId: effectiveFolderId,
        folder: folderLabel,
      }),
    })
  }
}

/**
 * Google Drive folder layout (under one root folder "Note App"):
 *
 *   library.json          — full app snapshot (same as IndexedDB export)
 *   README.txt
 *   markdown/
 *     Archive/            — archived items
 *     {Tab name}/         — one folder per tab (e.g. "Notes", custom tabs)
 *       {Library folder}/ — e.g. Personal, Research (mirrors Library rail)
 *         {title}-{id}.md
 *
 * @param {object} state App history state
 * @returns {{ files: { path: string, content: string }[], snapshot: object }}
 */
export function buildGoogleDriveSyncManifest(state) {
  const snapshot = buildSnapshotPayload(state)
  const { tabs, notesByTab, libraryFoldersByTab } = state
  const files = []

  files.push({
    path: 'library.json',
    content: JSON.stringify(
      {
        ...snapshot,
        driveSyncAt: snapshot.savedAt,
      },
      null,
      2,
    ),
  })

  files.push({
    path: 'README.txt',
    content: [
      'Note App — Google Drive sync',
      '',
      '• library.json — complete library (open in Note App or merge manually).',
      '• markdown/ — human-readable notes grouped by tab and Library folder.',
      '',
      `Synced ${snapshot.savedAt}`,
      '',
      'Do not rename the root "Note App" folder or move library.json if you rely on sync.',
    ].join('\n'),
  })

  for (const tab of tabs) {
    if (tab.id === 'preferences') continue

    if (tab.id === 'archive') {
      const list = notesByTab.archive ?? []
      for (const item of list) {
        const base = sanitizeSegment(`${item.title}-${item.id.slice(-8)}`)
        const content =
          item.archiveKind === ARCHIVE_KIND_NOTE
            ? noteMarkdownFile(item, {
                archived: true,
                deletedLabel: item.deletedLabel,
                kind: 'note',
              })
            : `---\nkind: folder-archive\ntitle: ${JSON.stringify(item.title)}\nid: ${JSON.stringify(item.id)}\n---\n\n`
        files.push({
          path: `markdown/Archive/${base}.md`,
          content,
        })
      }
      continue
    }

    const notes = notesByTab[tab.id] ?? []
    appendMarkdownForTab(files, tab, notes, libraryFoldersByTab)
  }

  // Notes keyed under a tab id that does not appear in `tabs` (legacy/import casing,
  // or migration drift) would be skipped by the loop above — export them here.
  const tabIdSet = new Set(tabs.map((t) => t.id))
  for (const key of Object.keys(notesByTab)) {
    if (key === 'archive' || key === 'preferences') continue
    if (tabIdSet.has(key)) continue
    const list = notesByTab[key]
    if (!Array.isArray(list) || list.length === 0) continue
    appendMarkdownForTab(
      files,
      { id: key, label: key },
      list,
      libraryFoldersByTab,
    )
  }

  return { files: dedupeFilesByPath(files), snapshot }
}
