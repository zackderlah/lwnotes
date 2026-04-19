import dompurifyImport from 'dompurify'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { tables, taskListItems } from 'turndown-plugin-gfm'

marked.setOptions({ gfm: true, breaks: false })

const PURIFY_OPTS = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'del',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'strong',
    'strike',
    'u',
    'sub',
    'sup',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'ul',
    'input',
    'span',
  ],
  ALLOWED_ATTR: ['href', 'title', 'class', 'type', 'checked', 'disabled', 'src', 'alt'],
  ADD_ATTR: ['target'],
}

function getPurifyInstance() {
  try {
    if (typeof dompurifyImport?.sanitize === 'function') {
      return dompurifyImport
    }
    if (typeof dompurifyImport === 'function' && typeof window !== 'undefined') {
      const p = dompurifyImport(window)
      if (p && typeof p.sanitize === 'function') return p
    }
  } catch {
    /* ignore */
  }
  return null
}

function fallbackSanitize(html) {
  return String(html ?? '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
}

export function sanitizeRichHtml(html) {
  const raw = String(html ?? '')
  try {
    const purify = getPurifyInstance()
    if (purify) {
      return purify.sanitize(raw, PURIFY_OPTS)
    }
  } catch (e) {
    console.warn('sanitizeRichHtml failed', e)
  }
  return fallbackSanitize(raw)
}

let turndown
function getTurndown() {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    })
    try {
      tables(turndown)
      taskListItems(turndown)
    } catch (e) {
      console.warn('turndown gfm plugins failed', e)
    }
    try {
      turndown.addRule('strikethrough', {
        filter: ['del', 's', 'strike'],
        replacement: (content) => `~~${content}~~`,
      })
    } catch {
      /* ignore */
    }
  }
  return turndown
}

/** Heuristic: treat as HTML if it clearly contains block/inline markup we store in the editor. */
function looksLikeStoredHtml(s) {
  if (s == null || !String(s).trim()) return false
  const t = String(s)
  return /<(p|div|h[1-6]|ul|ol|li|blockquote|pre|table|strong|em|b|i|code|a\s|br\s*\/?|hr\s*\/?)/i.test(
    t,
  )
}

/**
 * Load note body into the rich editor: markdown/plain notes become HTML; existing HTML passes through.
 */
export function bodyToEditorHtml(body) {
  const raw = body ?? ''
  if (!String(raw).trim()) return '<p><br></p>'
  try {
    if (looksLikeStoredHtml(raw)) return sanitizeRichHtml(raw)
    const parsed = marked.parse(String(raw), { async: false })
    const str = typeof parsed === 'string' ? parsed : String(parsed)
    return sanitizeRichHtml(str)
  } catch (e) {
    console.warn('bodyToEditorHtml failed', e)
    const escaped = String(raw)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<p>${escaped}</p>`
  }
}

/**
 * Serialize editor HTML to Markdown for .md export only.
 */
export function editorHtmlToMarkdown(html) {
  const raw = html ?? ''
  if (!String(raw).trim()) return ''
  try {
    const td = getTurndown()
    if (!looksLikeStoredHtml(raw)) {
      return String(raw).trimEnd()
    }
    return td.turndown(sanitizeRichHtml(raw)).replace(/\n{3,}/g, '\n\n').trimEnd()
  } catch (e) {
    console.warn('editorHtmlToMarkdown failed', e)
    return String(raw).trimEnd()
  }
}

/** Plain text for search / empty checks. */
export function htmlToPlainText(html) {
  if (html == null) return ''
  const s = String(html)
  if (!s.trim()) return ''
  if (!/<[a-z]/i.test(s)) return s
  if (typeof document !== 'undefined') {
    try {
      const d = document.createElement('div')
      d.innerHTML = s
      return (d.textContent || d.innerText || '').replace(/\u00a0/g, ' ')
    } catch (e) {
      console.warn('htmlToPlainText DOM parse failed', e)
    }
  }
  return s.replace(/<[^>]+>/g, ' ')
}

export function isBodyEffectivelyEmpty(html) {
  try {
    const t = htmlToPlainText(html).replace(/\s/g, '')
    return t.length === 0
  } catch {
    return !(html != null && String(html).trim())
  }
}
