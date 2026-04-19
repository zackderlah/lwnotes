/** @typedef {{ code: string, mod?: boolean, shift?: boolean, alt?: boolean }} ShortcutBinding */

export const SHORTCUTS_STORAGE_KEY = 'note-app-keyboard-shortcuts'

/** When true, App-level shortcut handler ignores keys (Preferences capture mode). */
let shortcutRecording = false
export function setShortcutRecording(value) {
  shortcutRecording = !!value
}
export function isShortcutRecording() {
  return shortcutRecording
}

/** Logical actions (ids stable for localStorage). */
export const SHORTCUT_ACTION_IDS = [
  'newNote',
  'searchNotes',
  'toggleArchive',
  'undo',
  'redo',
  'goToTab1',
  'goToTab2',
  'goToTab3',
  'goToTab4',
  'goToTab5',
  'goToTab6',
  'goToTab7',
  'goToTab8',
  'goToTab9',
]

/** @type {Record<string, { label: string, description?: string, defaultBinding: ShortcutBinding }>} */
export const SHORTCUT_ACTION_META = {
  newNote: {
    label: 'New note',
    defaultBinding: { code: 'KeyN', mod: true, shift: false, alt: false },
  },
  searchNotes: {
    label: 'Search',
    defaultBinding: { code: 'KeyF', mod: true, shift: false, alt: false },
  },
  toggleArchive: {
    label: 'Archive note',
    description: 'Moves the selected note to Archive.',
    defaultBinding: { code: 'KeyE', mod: true, shift: false, alt: false },
  },
  undo: {
    label: 'Undo',
    defaultBinding: { code: 'KeyZ', mod: true, shift: false, alt: false },
  },
  redo: {
    label: 'Redo',
    description: 'Shift+Z with the same modifiers also redoes.',
    defaultBinding: { code: 'KeyY', mod: true, shift: false, alt: false },
  },
  goToTab1: {
    label: 'Tab 1',
    defaultBinding: { code: 'Digit1', mod: true, shift: false, alt: false },
  },
  goToTab2: {
    label: 'Tab 2',
    defaultBinding: { code: 'Digit2', mod: true, shift: false, alt: false },
  },
  goToTab3: {
    label: 'Tab 3',
    defaultBinding: { code: 'Digit3', mod: true, shift: false, alt: false },
  },
  goToTab4: {
    label: 'Tab 4',
    defaultBinding: { code: 'Digit4', mod: true, shift: false, alt: false },
  },
  goToTab5: {
    label: 'Tab 5',
    defaultBinding: { code: 'Digit5', mod: true, shift: false, alt: false },
  },
  goToTab6: {
    label: 'Tab 6',
    defaultBinding: { code: 'Digit6', mod: true, shift: false, alt: false },
  },
  goToTab7: {
    label: 'Tab 7',
    defaultBinding: { code: 'Digit7', mod: true, shift: false, alt: false },
  },
  goToTab8: {
    label: 'Tab 8',
    defaultBinding: { code: 'Digit8', mod: true, shift: false, alt: false },
  },
  goToTab9: {
    label: 'Tab 9',
    defaultBinding: { code: 'Digit9', mod: true, shift: false, alt: false },
  },
}

/** Redo also accepts Mod+Shift+Z — not stored as a separate row; handled in App. */

export function getDefaultShortcutBindings() {
  /** @type {Record<string, ShortcutBinding>} */
  const out = {}
  for (const id of SHORTCUT_ACTION_IDS) {
    const meta = SHORTCUT_ACTION_META[id]
    if (meta) out[id] = { ...meta.defaultBinding }
  }
  return out
}

function cloneBindings(raw) {
  const defs = getDefaultShortcutBindings()
  if (!raw || typeof raw !== 'object') return defs
  /** @type {Record<string, ShortcutBinding>} */
  const merged = { ...defs }
  for (const id of SHORTCUT_ACTION_IDS) {
    const b = raw[id]
    if (b && typeof b.code === 'string') {
      merged[id] = {
        code: b.code,
        mod: !!b.mod,
        shift: !!b.shift,
        alt: !!b.alt,
      }
    }
  }
  return merged
}

export function readStoredShortcutBindings() {
  try {
    const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY)
    if (!raw) return getDefaultShortcutBindings()
    return cloneBindings(JSON.parse(raw))
  } catch {
    return getDefaultShortcutBindings()
  }
}

export function writeShortcutBindings(bindings) {
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(bindings))
  } catch {
    /* ignore */
  }
}

/**
 * @param {KeyboardEvent} e
 * @param {ShortcutBinding} b
 */
export function eventMatchesBinding(e, b) {
  if (!b || e.code !== b.code) return false
  const hasMod = e.ctrlKey || e.metaKey
  if (b.mod) {
    if (!hasMod) return false
  } else if (hasMod) {
    return false
  }
  if (!!e.shiftKey !== !!b.shift) return false
  if (!!e.altKey !== !!b.alt) return false
  return true
}

export function bindingsEqual(a, b) {
  if (!a || !b) return false
  return (
    a.code === b.code &&
    !!a.mod === !!b.mod &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt
  )
}

/**
 * @param {KeyboardEvent} e
 * @param {Record<string, ShortcutBinding>} bindings
 * @returns {string | null} action id
 */
export function matchShortcutAction(e, bindings) {
  for (const id of SHORTCUT_ACTION_IDS) {
    const b = bindings[id]
    if (b && eventMatchesBinding(e, b)) return id
  }
  return null
}

const CODE_LABELS = {
  Space: 'Space',
  Comma: ',',
  Period: '.',
  Slash: '/',
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Backslash: '\\',
}

function codeToReadable(code) {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return CODE_LABELS[code] ?? code
}

export function isMacPlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent || '')
}

/**
 * @param {ShortcutBinding} b
 */
export function formatShortcutLabel(b) {
  if (!b) return '—'
  const mac = isMacPlatform()
  const parts = []
  if (b.alt) parts.push(mac ? '⌥' : 'Alt+')
  if (b.shift) parts.push(mac ? '⇧' : 'Shift+')
  if (b.mod) parts.push(mac ? '⌘' : 'Ctrl+')
  const key = codeToReadable(b.code)
  if (mac) return `${parts.join('')}${key}`
  return `${parts.join('')}${key}`
}

/** Typical redo chord when undo is ⌘/Ctrl+Z (not customizable separately). */
export function isChordRedoShiftZ(e) {
  return (
    (e.ctrlKey || e.metaKey) &&
    e.shiftKey &&
    !e.altKey &&
    e.code === 'KeyZ'
  )
}

/**
 * For the shortcut editor: accept any key including when modifiers held.
 * @param {KeyboardEvent} e
 */
export function bindingFromKeyboardEventCapture(e) {
  if (e.repeat) return null
  if (
    ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key) &&
    !e.code.startsWith('Digit') &&
    !e.code.startsWith('Key')
  ) {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt')
      return null
  }
  if (
    e.code === 'ControlLeft' ||
    e.code === 'ControlRight' ||
    e.code === 'MetaLeft' ||
    e.code === 'MetaRight' ||
    e.code === 'ShiftLeft' ||
    e.code === 'ShiftRight' ||
    e.code === 'AltLeft' ||
    e.code === 'AltRight'
  ) {
    return null
  }
  return {
    code: e.code,
    mod: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
  }
}
