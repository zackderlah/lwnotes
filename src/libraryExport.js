import JSZip from 'jszip'
import { editorHtmlToMarkdown } from './noteHtml.js'
import { ARCHIVE_KIND_NOTE } from './data/notes.js'

export function sanitizeSegment(s) {
  return String(s ?? 'untitled')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72) || 'untitled'
}

export function noteMarkdownFile(note, extra = {}) {
  const fm = {
    id: note.id,
    ...extra,
  }
  const yaml = Object.entries(fm)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${JSON.stringify(String(v))}`)
    .join('\n')
  const body = editorHtmlToMarkdown(note.body ?? '')
  return `---\n${yaml}\n---\n\n${body}`
}

/**
 * @param {object} snapshot Same shape as useHistoryState `state` plus optional theme for json
 */
export async function exportLibraryToZipDownload(snapshot) {
  const zip = new JSZip()
  const { tabs, notesByTab, libraryFoldersByTab } = snapshot

  const manifest = {
    format: 'note-app-library',
    version: 1,
    exportedAt: new Date().toISOString(),
    tabs,
    notesByTab,
    libraryFoldersByTab,
  }
  zip.file('library.json', JSON.stringify(manifest, null, 2))

  const mdRoot = zip.folder('markdown')

  for (const tab of tabs) {
    if (tab.id === 'preferences') continue

    if (tab.id === 'archive') {
      const archFolder = mdRoot.folder('Archive')
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
        archFolder.file(`${base}.md`, content)
      }
      continue
    }

    const notes = notesByTab[tab.id] ?? []
    const tabDir = mdRoot.folder(sanitizeSegment(tab.label || tab.id))
    for (const note of notes) {
      const folderLabel =
        libraryFoldersByTab?.[tab.id]?.find((f) => f.id === note.folderId)
          ?.label ?? note.folderId
      const fname = `${sanitizeSegment(note.title)}-${note.id.slice(-6)}.md`
      tabDir.file(
        fname,
        noteMarkdownFile(note, {
          tabId: tab.id,
          folderId: note.folderId,
          folder: folderLabel,
        }),
      )
    }
  }

  zip.file(
    'README.txt',
    [
      'Note App — library export',
      '',
      '• library.json — full data for this app (tabs, notes, folders, archive).',
      '• markdown/ — readable .md copies of your notes (archive under markdown/Archive/).',
      '',
      `Generated ${manifest.exportedAt}`,
    ].join('\n'),
  )

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const name = `note-library-${manifest.exportedAt.slice(0, 10)}.zip`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
