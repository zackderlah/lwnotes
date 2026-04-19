/**
 * Rich-text commands for a contenteditable editor (visual bold/italic/etc.).
 */

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function selectionInside(el) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  let n = sel.anchorNode
  if (n && n.nodeType === Node.TEXT_NODE) n = n.parentElement
  return !!(n && el.contains(n))
}

function focusAndEnsureCaret(el) {
  el.focus({ preventScroll: true })
  if (!selectionInside(el)) {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }
}

function selectNodeEnd(el) {
  const sel = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

/**
 * @param {HTMLElement} editorEl
 * @param {'bold'|'italic'|'strike'|'code'|'link'|'h1'|'h2'|'h3'|'ul'|'ol'|'task'|'quote'|'hr'|'codeblock'} kind
 * @param {string} [linkUrl]
 */
export function runRichEditorAction(editorEl, kind, linkUrl) {
  if (!editorEl) return
  focusAndEnsureCaret(editorEl)

  try {
    document.execCommand('styleWithCSS', false, 'false')
  } catch {
    /* ignore */
  }

  switch (kind) {
    case 'bold':
      document.execCommand('bold')
      break
    case 'italic':
      document.execCommand('italic')
      break
    case 'strike':
      document.execCommand('strikeThrough')
      break
    case 'code': {
      const sel = window.getSelection()
      if (!sel.rangeCount) break
      const range = sel.getRangeAt(0)
      const code = document.createElement('code')
      const frag = range.extractContents()
      if (frag.textContent?.trim()) {
        code.appendChild(frag)
      } else {
        code.textContent = 'code'
      }
      range.insertNode(code)
      selectNodeEnd(code)
      break
    }
    case 'link': {
      const url = (linkUrl?.trim() || 'https://').replace(/"/g, '&quot;')
      const sel = window.getSelection()
      const hasText = sel && sel.toString().trim().length > 0
      if (hasText) {
        document.execCommand('createLink', false, url)
      } else {
        document.execCommand(
          'insertHTML',
          false,
          `<a href="${escapeAttr(url)}">link text</a>`,
        )
      }
      break
    }
    case 'h1':
      document.execCommand('formatBlock', false, 'h1')
      break
    case 'h2':
      document.execCommand('formatBlock', false, 'h2')
      break
    case 'h3':
      document.execCommand('formatBlock', false, 'h3')
      break
    case 'ul':
      document.execCommand('insertUnorderedList')
      break
    case 'ol':
      document.execCommand('insertOrderedList')
      break
    case 'task':
      document.execCommand(
        'insertHTML',
        false,
        '<ul><li><input type="checkbox"> </li></ul>',
      )
      break
    case 'quote':
      document.execCommand('formatBlock', false, 'blockquote')
      break
    case 'hr':
      document.execCommand('insertHorizontalRule')
      break
    case 'codeblock': {
      const sel = window.getSelection()
      if (!sel.rangeCount) break
      const range = sel.getRangeAt(0)
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      const frag = range.extractContents()
      code.appendChild(frag)
      if (!code.textContent?.trim()) {
        code.appendChild(document.createTextNode('\n'))
      }
      pre.appendChild(code)
      range.insertNode(pre)
      selectNodeEnd(code)
      break
    }
    default:
      break
  }
}
