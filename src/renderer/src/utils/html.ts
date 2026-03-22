import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import cpp from 'highlight.js/lib/languages/cpp'
import DOMPurify from 'dompurify'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c', cpp)

// ─── Sécurité HTML ───────────────────────────────────────────────────────────

export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Configuration marked (singleton) ────────────────────────────────────────

marked.use({
  breaks: true,
  gfm: true,
  renderer: {
    // Liens : data-url pour l'interception click existante dans MessageBubble
    link({ href, tokens }: { href: string; title?: string | null; tokens: unknown[] }) {
      const text = (this as any).parser.parseInline(tokens)
      const safe = escapeHtml(href ?? '')
      return `<a class="msg-link" data-url="${safe}" href="#" tabindex="0">${text}</a>`
    },
    // Blocs de code : coloration syntaxique via highlight.js
    code({ text, lang }: { text: string; lang?: string; escaped?: boolean }) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      const highlighted = hljs.highlight(text, { language }).value
      const langLabel = escapeHtml(lang || 'code')
      return (
        `<div class="code-block">` +
        `<span class="code-lang">${langLabel}</span>` +
        `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>` +
        `</div>`
      )
    },
  },
})

// ─── Mentions ────────────────────────────────────────────────────────────────

export function applyMentions(html: string, currentUserName = ''): string {
  return html.replace(/@([\w][\w.\-]*)/g, (match, name) => {
    const isEveryone = name.toLowerCase() === 'everyone'
    const isMine =
      !isEveryone &&
      !!currentUserName &&
      currentUserName.toLowerCase().includes(name.toLowerCase())
    const cls = isEveryone || isMine ? 'mention-me' : 'mention-tag'
    return `<span class="${cls}">${match}</span>`
  })
}

export function hasMention(text: string, userName: string): boolean {
  if (/@everyone\b/i.test(text)) return true
  if (!userName) return false
  const parts = userName.toLowerCase().split(/\s+/)
  return parts.some((p) => text.toLowerCase().includes('@' + p))
}

// ─── Mise en évidence du terme de recherche (texte seulement) ────────────────

function highlightInHtml(html: string, term: string): string {
  if (!term) return html
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  // Traite uniquement les nœuds texte (ignore les balises HTML)
  return html.replace(/<[^>]*>|[^<]+/g, (part) => {
    if (part.startsWith('<')) return part
    return part.replace(re, (m) => `<mark class="search-highlight">${m}</mark>`)
  })
}

// ─── Références #canal ──────────────────────────────────────────────────────

export function applyChannelRefs(html: string): string {
  return html.replace(/#([\w][\w.\-]*)/g, (match) => {
    return `<span class="channel-ref" data-channel="${escapeHtml(match.slice(1))}">${match}</span>`
  })
}

// ─── Références 📋 devoirs et 📄 documents ─────────────────────────────────

export function applyInlineRefs(html: string): string {
  // \[Title](devoir:ID) - clickable devoir reference
  html = html.replace(/\\\[([^\]]+)\]\(devoir:(\d+)\)/g, (_m, title, id) => {
    return `<span class="devoir-ref" data-devoir-id="${escapeHtml(id)}" role="link" tabindex="0">\\${escapeHtml(title)}</span>`
  })
  // ~[Title](devoir:ID) - legacy format (backward compat)
  html = html.replace(/~\[([^\]]+)\]\(devoir:(\d+)\)/g, (_m, title, id) => {
    return `<span class="devoir-ref" data-devoir-id="${escapeHtml(id)}" role="link" tabindex="0">\\${escapeHtml(title)}</span>`
  })
  // 📋 [Titre du devoir] - legacy static format
  html = html.replace(/📋\s*\[([^\]]+)\]/g, (_m, title) => {
    return `<span class="devoir-ref">📋 ${escapeHtml(title)}</span>`
  })
  // 📄 [Nom du document]
  html = html.replace(/📄\s*\[([^\]]+)\]/g, (_m, title) => {
    return `<span class="doc-ref">📄 ${escapeHtml(title)}</span>`
  })
  return html
}

// ─── Formatage du contenu d'un message ───────────────────────────────────────

export function renderMessageContent(raw: string, searchTerm = '', currentUserName = ''): string {
  // Traiter les refs devoir AVANT le markdown (sinon \ et ~ sont consommés par marked)
  let preprocessed = raw
  // \[Title](devoir:ID) et ~[Title](devoir:ID) → placeholder HTML
  preprocessed = preprocessed.replace(/[\\~]\[([^\]]+)\]\(devoir:(\d+)\)/g, (_m, title, id) => {
    return `<span class="devoir-ref" data-devoir-id="${escapeHtml(id)}" role="link" tabindex="0">${escapeHtml(title)}</span>`
  })
  let html = marked.parse(preprocessed) as string
  // marked encode les apostrophes en &#39; ce qui casse l'affichage du texte francais
  html = html.replace(/&#39;/g, "'")
  html = html.replace(/&amp;#39;/g, "'")
  html = applyMentions(html, currentUserName)
  html = applyChannelRefs(html)
  html = applyInlineRefs(html)
  if (searchTerm) html = highlightInHtml(html, searchTerm)
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'a', 'span', 'div', 'mark', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'del', 's'],
    ALLOWED_ATTR: ['class', 'data-url', 'data-channel', 'data-devoir-id', 'role', 'href', 'tabindex', 'style', 'src', 'alt'],
  })
}
