// ─── Sécurité HTML ──────────────────────────────────────────────────────────

export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Met en évidence les occurrences d'un terme dans un texte
export function highlightTerm(text: string, term: string): string {
  if (!term) return escapeHtml(text)
  const escaped  = escapeHtml(text)
  const escapedT = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return escaped.replace(
    new RegExp(escapedT, 'gi'),
    (m) => `<mark class="search-highlight">${m}</mark>`,
  )
}

// ─── Markdown inline ─────────────────────────────────────────────────────────

export function parseMarkdown(html: string): string {
  return html
    .replace(/\*\*(.*?)\*\*/g,  '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,       '<em>$1</em>')
    .replace(/`(.*?)`/g,         '<code class="inline-code">$1</code>')
}

// ─── Mentions ────────────────────────────────────────────────────────────────

export function applyMentions(html: string): string {
  return html.replace(
    /@(everyone|\w[\w\s]*?\w)/g,
    (match) => `<span class="mention-tag">${match}</span>`,
  )
}

export function hasMention(text: string, userName: string): boolean {
  return /@everyone\b/i.test(text) || (!!userName && text.includes('@' + userName))
}

// ─── Formatage du contenu d'un message ───────────────────────────────────────

export function renderMessageContent(raw: string, searchTerm = ''): string {
  const escaped = searchTerm ? highlightTerm(raw, searchTerm) : escapeHtml(raw)
  return applyMentions(parseMarkdown(escaped))
}
