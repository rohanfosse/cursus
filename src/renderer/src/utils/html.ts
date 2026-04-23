import { marked, type RendererThis, type Token } from 'marked'
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
import { authUrl } from '@/utils/auth'

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

// ─── Helpers fichiers ────────────────────────────────────────────────────────

function extIcon(ext: string): string {
  const map: Record<string, string> = {
    PDF: '📄', DOC: '📝', DOCX: '📝', XLS: '📊', XLSX: '📊',
    PPT: '📊', PPTX: '📊', ZIP: '📦', RAR: '📦', '7Z': '📦',
    PNG: '🖼️', JPG: '🖼️', JPEG: '🖼️', GIF: '🖼️', WEBP: '🖼️', SVG: '🖼️',
    MP4: '🎬', MP3: '🎵', TXT: '📃', CSV: '📊', MD: '📃',
  }
  return map[ext] || '📎'
}

function extCssClass(ext: string): string {
  const map: Record<string, string> = {
    PDF: 'mfc--pdf', DOC: 'mfc--doc', DOCX: 'mfc--doc',
    XLS: 'mfc--xls', XLSX: 'mfc--xls', CSV: 'mfc--xls',
    PPT: 'mfc--ppt', PPTX: 'mfc--ppt',
    ZIP: 'mfc--zip', RAR: 'mfc--zip', '7Z': 'mfc--zip',
    PNG: 'mfc--img', JPG: 'mfc--img', JPEG: 'mfc--img', GIF: 'mfc--img', WEBP: 'mfc--img',
  }
  return map[ext] || 'mfc--default'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' Ko'
  return (bytes / 1048576).toFixed(1) + ' Mo'
}

// ─── Configuration marked (singleton) ────────────────────────────────────────

marked.use({
  breaks: true,
  gfm: true,
  renderer: {
    // Liens : data-url pour l'interception click existante dans MessageBubble
    link({ href, tokens }: { href: string; title?: string | null; tokens: Token[] }) {
      const text = (this as RendererThis).parser.parseInline(tokens)
      const safe = escapeHtml(href ?? '')
      // Pièce jointe 📎 → card visuel enrichie
      if (text.includes('📎')) {
        const name = text.replace(/📎\s*/g, '').replace(/<[^>]+>/g, '').trim()
        const ext  = name.split('.').pop()?.toUpperCase() ?? 'FILE'
        const sizeMatch = (href ?? '').match(/#size=(\d+)/)
        const sizeStr = sizeMatch ? formatFileSize(parseInt(sizeMatch[1])) : ''
        const cleanUrl = escapeHtml((href ?? '').replace(/#size=\d+/, ''))
        const icon = extIcon(ext)
        const extClass = extCssClass(ext)
        const imgExts = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG', 'BMP']
        const isImg = imgExts.includes(ext)
        const iconHtml = isImg
          ? `<img class="msg-file-card-thumb" src="${authUrl(cleanUrl)}" alt="" />`
          : `<span class="msg-file-card-icon ${extClass}">${icon}</span>`
        return (
          `<a class="msg-file-card ${extClass}" data-url="${cleanUrl}" data-file-name="${escapeHtml(name)}" href="#" tabindex="0">` +
          iconHtml +
          `<span class="msg-file-card-body"><span class="msg-file-card-name">${escapeHtml(name)}</span>` +
          `<span class="msg-file-card-meta"><span class="msg-file-card-ext">${escapeHtml(ext)}</span>` +
          (sizeStr ? `<span class="msg-file-card-size">${sizeStr}</span>` : '') +
          `</span></span></a>`
        )
      }
      return `<a class="msg-link" data-url="${safe}" href="#" tabindex="0">${text}</a>`
    },
    // Images : ajout de class pour styling + lightbox
    image({ href, text }: { href: string; title?: string | null; text: string }) {
      const safe = escapeHtml(href ?? '')
      const alt  = escapeHtml(text ?? '')
      return `<img class="msg-inline-img" src="${authUrl(safe)}" alt="${alt}" loading="lazy" />`
    },
    // Blocs de code : coloration syntaxique via highlight.js. Header avec
    // langue + bouton "Copier" (intercepte par listener delegue dans
    // MessageBubble via data-action="copy-code").
    code({ text, lang }: { text: string; lang?: string; escaped?: boolean }) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      const highlighted = hljs.highlight(text, { language }).value
      const langLabel = escapeHtml(lang || 'code')
      const nbLines = text.split('\n').length
      return (
        `<div class="code-block">` +
        `<div class="code-block-head">` +
          `<span class="code-lang">${langLabel}</span>` +
          `<span class="code-lines">${nbLines} ligne${nbLines > 1 ? 's' : ''}</span>` +
          `<button type="button" class="code-copy" data-action="copy-code" aria-label="Copier le code">Copier</button>` +
        `</div>` +
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
  // 📄 [Nom du document] — legacy (sans ID, non cliquable).
  // La variante `📄 [Nom](doc:ID)` est gérée en preprocessing avant marked
  // dans renderMessageContent (sinon marked consommerait la syntaxe lien).
  html = html.replace(/📄\s*\[([^\]]+)\]/g, (_m, title) => {
    return `<span class="doc-ref">📄 ${escapeHtml(title)}</span>`
  })
  return html
}

// ─── Formatage du contenu d'un message ───────────────────────────────────────

// Cache de rendu markdown : evite de re-parser le meme message a chaque rerender.
// Key : hash FNV-1a du contenu complet + searchTerm + currentUserName.
// (Avant v2.228.0 on hashait seulement raw.length + slice(0,50), ce qui
// collisionnait sur 2 messages de meme longueur et meme prefix.)
const _renderCache = new Map<string, string>()
const RENDER_CACHE_MAX = 500

function fnv1a(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(36)
}

export function renderMessageContent(raw: string, searchTerm = '', currentUserName = ''): string {
  const cacheKey = `${fnv1a(raw)}:${searchTerm}:${currentUserName}`
  const cached = _renderCache.get(cacheKey)
  if (cached) return cached
  // Traiter les refs devoir/lumen/doc AVANT le markdown (sinon le parser
  // marked consomme la syntaxe `[..](scheme:id)` comme un lien standard et
  // produit un `<a href="doc:8">` qui finit ouvert dans le navigateur).
  let preprocessed = raw
  // \[Title](devoir:ID) et ~[Title](devoir:ID) → placeholder HTML
  preprocessed = preprocessed.replace(/[\\~]\[([^\]]+)\]\(devoir:(\d+)\)/g, (_m, title, id) => {
    return `<span class="devoir-ref" data-devoir-id="${escapeHtml(id)}" role="link" tabindex="0">${escapeHtml(title)}</span>`
  })
  // \[Title](lumen:ID) → ref Lumen cliquable. Posee par le bot Cursus a la
  // premiere publication d'un cours, ouvre le reader Lumen au clic.
  // Variante \[Title](lumen:ID:path/to/file.py) → ouvre ET auto-selectionne
  // un fichier precis du projet d'exemple attache au cours.
  preprocessed = preprocessed.replace(/[\\~]\[([^\]]+)\]\(lumen:(\d+)(?::([^\)]+))?\)/g, (_m, title, id, filePath) => {
    const fileAttr = filePath ? ` data-lumen-file="${escapeHtml(filePath)}"` : ''
    return `<span class="lumen-ref" data-lumen-id="${escapeHtml(id)}"${fileAttr} role="link" tabindex="0">${escapeHtml(title)}</span>`
  })
  // 📄 [Nom](doc:ID) → ref document cliquable. Insere via MessageInput quand
  // on selectionne un document dans l'autocomplete `📄`. Au clic, ouvre le
  // DocumentPreviewModal (cf. useBubbleActions).
  preprocessed = preprocessed.replace(/📄\s*\[([^\]]+)\]\(doc:(\d+)\)/g, (_m, title, id) => {
    return `<span class="doc-ref" data-doc-id="${escapeHtml(id)}" role="link" tabindex="0">📄 ${escapeHtml(title)}</span>`
  })
  let html = marked.parse(preprocessed) as string
  // marked encode les apostrophes en &#39; ce qui casse l'affichage du texte francais
  html = html.replace(/&#39;/g, "'")
  html = html.replace(/&amp;#39;/g, "'")
  // Task list GFM : marked genere des checkboxes avec `disabled` par defaut.
  // On les retire pour rendre les cases cochables (MessageBubble gere le clic
  // via delegation + editMessage si l'utilisateur est l'auteur).
  html = html.replace(
    /<input([^>]*?)\stype="checkbox"([^>]*?)\sdisabled(?:="[^"]*")?([^>]*?)>/gi,
    '<input$1 type="checkbox"$2$3>',
  )
  html = html.replace(
    /<input\sdisabled(?:="[^"]*")?([^>]*?)type="checkbox"([^>]*?)>/gi,
    '<input$1 type="checkbox"$2>',
  )
  html = applyMentions(html, currentUserName)
  html = applyChannelRefs(html)
  html = applyInlineRefs(html)
  if (searchTerm) html = highlightInHtml(html, searchTerm)
  const result = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'a', 'span', 'div', 'mark', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'del', 's', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'button', 'input'],
    // `style` retire : marked n'en emet pas, surface XSS inutile (url()/:has selectors).
    ALLOWED_ATTR: ['class', 'data-url', 'data-channel', 'data-devoir-id', 'data-doc-id', 'data-lumen-id', 'data-lumen-file', 'data-file-name', 'data-action', 'role', 'href', 'tabindex', 'src', 'alt', 'loading', 'align', 'type', 'aria-label', 'checked', 'disabled'],
    // Whitelist des schemes URI : bloque javascript:, data: et autres exotiques
    // avant meme le filtrage per-attribut.
    ALLOWED_URI_REGEXP: /^(?:https?|cursus|mailto|tel|#):/i,
  })
  // Evicter le cache si trop gros
  if (_renderCache.size >= RENDER_CACHE_MAX) {
    const firstKey = _renderCache.keys().next().value
    if (firstKey) _renderCache.delete(firstKey)
  }
  _renderCache.set(cacheKey, result)
  return result
}
