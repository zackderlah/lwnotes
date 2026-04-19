import { isBodyEffectivelyEmpty } from '../noteHtml.js'

/** Default folder when none set (e.g. restored notes). */
export const DEFAULT_NOTE_FOLDER_ID = 'personal'

export const DEFAULT_NOTE_TITLE = 'Untitled Note'
export const DEFAULT_NOTE_PREVIEW = 'Start typing to capture your thoughts...'

/** True if deleting this note should create an archive entry (has real content). */
export function noteHasArchivableContent(note) {
  if (!note) return false
  if (!isBodyEffectivelyEmpty(note.body)) return true
  if ((note.images ?? []).length > 0) return true
  const title = (note.title ?? '').trim()
  if (title && title !== DEFAULT_NOTE_TITLE) return true
  const preview = (note.preview ?? '').trim()
  if (preview && preview !== DEFAULT_NOTE_PREVIEW) return true
  return false
}

/** Built-in tabs that cannot be deleted or duplicated. */
export const CORE_TAB_IDS = ['notes', 'archive', 'preferences']

export const INITIAL_TABS = [
  { id: 'notes', label: 'Notes', sidebarTitle: 'All Notes', color: null },
  { id: 'archive', label: 'Archive', sidebarTitle: 'Archived', color: null },
  {
    id: 'preferences',
    label: 'Preferences',
    sidebarTitle: 'Settings',
    color: null,
  },
]

/** Formats a timestamp like `SEP 12, 2023` for archived note headers. */
export function formatDeletedLabel(ms) {
  const d = new Date(ms)
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ]
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export const TAB_COLORS = [
  { label: 'Default', value: null },
  { label: 'Slate', value: '#B0BEC5' },
  { label: 'Sage', value: '#B5C4B0' },
  { label: 'Rose', value: '#D8B5B5' },
  { label: 'Sand', value: '#E2D4B7' },
  { label: 'Amber', value: '#E4C88A' },
  { label: 'Violet', value: '#C5B8D4' },
]

/** Archive kinds: note or deleted folder shell. */
export const ARCHIVE_KIND_NOTE = 'note'
export const ARCHIVE_KIND_FOLDER = 'folder'

export function getArchiveKindLabel(kind) {
  switch (kind) {
    case ARCHIVE_KIND_FOLDER:
      return 'Folder'
    default:
      return 'Note'
  }
}
