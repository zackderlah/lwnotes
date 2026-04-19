/**
 * Normalize markdown imported from Obsidian (and similar sources).
 */
export function formatImportedMarkdown(text) {
  if (text == null) return ''
  let t = String(text)
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  t = t
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
  t = t.replace(/\n{4,}/g, '\n\n\n')
  return t.trimEnd()
}
