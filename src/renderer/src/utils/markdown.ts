/** Markdown renderer pour Lumen — marked + DOMPurify pour eviter XSS. */
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'

// Configuration de marked : code highlighting + breaks + GFM
marked.setOptions({
  gfm: true,
  breaks: true,
})

// Hook pour highlight.js sur les blocs de code
marked.use({
  renderer: {
    code(token) {
      const code = typeof token === 'string' ? token : token.text
      const lang = typeof token === 'string' ? '' : (token.lang ?? '')
      const validLang = lang && hljs.getLanguage(lang)
      const highlighted = validLang
        ? hljs.highlight(code, { language: lang }).value
        : hljs.highlightAuto(code).value
      const cls = validLang ? `language-${lang}` : ''
      return `<pre class="lumen-code"><code class="hljs ${cls}">${highlighted}</code></pre>`
    },
  },
})

// Slug : transforme un titre en identifiant stable (minuscules, accents retires,
// espaces -> tirets). Utilise par le TOC du reader pour l'ancrage.
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'heading'
}

// Injecte des IDs slug uniques sur tous les h1-h6 du HTML rendu.
// Passe par des regex plutot que DOMParser pour rester side-effect-free.
function injectHeadingIds(html: string): string {
  const seen = new Map<string, number>()
  return html.replace(/<(h[1-6])>([\s\S]*?)<\/\1>/g, (_, tag, inner) => {
    const text = inner.replace(/<[^>]+>/g, '')
    let slug = slugifyHeading(text)
    const count = seen.get(slug) ?? 0
    seen.set(slug, count + 1)
    if (count > 0) slug = `${slug}-${count}`
    return `<${tag} id="${slug}">${inner}</${tag}>`
  })
}

// Mots-cles pedagogiques a mettre en evidence dans le rendu : wrap dans
// un span stylise avec classe dediee. Detection uniquement en debut de
// mot (word boundary) et uniquement dans le texte (pas dans les blocs
// de code pour ne pas colorer les TODO du code source).
const KEYWORD_PATTERNS: Array<{ word: string; cls: string }> = [
  { word: 'TODO',    cls: 'lumen-kw-todo' },
  { word: 'FIXME',   cls: 'lumen-kw-todo' },
  { word: 'WARNING', cls: 'lumen-kw-warn' },
  { word: 'ATTENTION', cls: 'lumen-kw-warn' },
  { word: 'NOTE',    cls: 'lumen-kw-note' },
  { word: 'INFO',    cls: 'lumen-kw-note' },
  { word: 'TIP',     cls: 'lumen-kw-tip' },
  { word: 'IMPORTANT', cls: 'lumen-kw-warn' },
]

/**
 * Admonitions style Obsidian : transforme un blockquote contenant
 * "[!TYPE] Titre optionnel" sur la premiere ligne en un bloc stylise.
 * Types supportes : NOTE, TIP, WARNING, DANGER, INFO, IMPORTANT.
 *
 * Format d'entree markdown :
 *   > [!NOTE] Mon titre
 *   > Contenu de la note
 *   > sur plusieurs lignes
 *
 * Le preprocessing remplace les blockquotes qui matchent par des div
 * structurees AVANT le parsing marked, pour ne pas avoir a remplacer
 * les <blockquote> apres coup.
 */
const ADMONITION_PATTERN = /^\s*\[!(NOTE|TIP|WARNING|DANGER|INFO|IMPORTANT)\](?:\s+(.*))?$/

// Icones SVG inline (lucide-style, stroke 2, 16x16). Stockees en constantes
// pour injection directe dans le HTML genere — bien plus lisibles que les
// anciens caracteres ASCII i/*/!/x et parfaitement accessibles car marques
// aria-hidden="true" (le titre textuel assume la semantique).
const ICON_INFO = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
const ICON_TIP = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z"/></svg>'
const ICON_WARN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
const ICON_DANGER = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'

const ADMONITION_CONFIG: Record<string, { cls: string; icon: string; defaultTitle: string }> = {
  NOTE:      { cls: 'lumen-adm-note',    icon: ICON_INFO,   defaultTitle: 'Note' },
  INFO:      { cls: 'lumen-adm-note',    icon: ICON_INFO,   defaultTitle: 'Info' },
  TIP:       { cls: 'lumen-adm-tip',     icon: ICON_TIP,    defaultTitle: 'Astuce' },
  WARNING:   { cls: 'lumen-adm-warning', icon: ICON_WARN,   defaultTitle: 'Attention' },
  IMPORTANT: { cls: 'lumen-adm-warning', icon: ICON_WARN,   defaultTitle: 'Important' },
  DANGER:    { cls: 'lumen-adm-danger',  icon: ICON_DANGER, defaultTitle: 'Danger' },
}

function preprocessAdmonitions(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Cherche un debut de blockquote admonition : "> [!TYPE] Titre?"
    const m = line.match(/^>\s*(\[![A-Z]+\][^\n]*)/)
    if (m) {
      const firstInner = m[1]
      const adm = firstInner.match(ADMONITION_PATTERN)
      if (adm) {
        const type = adm[1]
        const config = ADMONITION_CONFIG[type]
        const title = (adm[2] ?? '').trim() || config.defaultTitle
        // Collecte les lignes suivantes du blockquote
        const body: string[] = []
        i++
        while (i < lines.length && lines[i].startsWith('>')) {
          body.push(lines[i].replace(/^>\s?/, ''))
          i++
        }
        const bodyMd = body.join('\n').trim()
        const bodyHtml = bodyMd
          ? (marked.parse(bodyMd, { async: false }) as string)
          : ''
        const icon = config.icon
        out.push(
          `<div class="lumen-admonition ${config.cls}">` +
            `<div class="lumen-admonition-head">` +
              `<span class="lumen-admonition-icon" aria-hidden="true">${icon}</span>` +
              `<span class="lumen-admonition-title">${escapeHtml(title)}</span>` +
            `</div>` +
            `<div class="lumen-admonition-body">${bodyHtml}</div>` +
          `</div>`
        )
        continue
      }
    }
    out.push(line)
    i++
  }
  return out.join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

/**
 * Decore les mots-cles pedagogiques (TODO, NOTE, etc.) avec un span.
 * Parcourt uniquement les noeuds texte hors <pre><code> pour ne pas
 * toucher au code source colorise par highlight.js.
 */
function highlightKeywords(html: string): string {
  // On repere les blocs <pre>...</pre> pour les exclure : on les remplace
  // temporairement par des placeholders, on decore le reste, puis on
  // restore. Simple et side-effect-free.
  const placeholders: string[] = []
  const withoutCode = html.replace(/<pre[\s\S]*?<\/pre>/g, (match) => {
    const id = placeholders.length
    placeholders.push(match)
    return `\u0000PRE_${id}\u0000`
  })
  // Applique les remplacements sequentiellement
  let decorated = withoutCode
  for (const { word, cls } of KEYWORD_PATTERNS) {
    // \b ne marche pas sur les ":", on ajoute explicitement le ":" optionnel
    const re = new RegExp(`\\b(${word})\\b(:?)`, 'g')
    decorated = decorated.replace(re, `<span class="lumen-kw ${cls}">$1$2</span>`)
  }
  // Restore les blocs <pre>
  decorated = decorated.replace(/\u0000PRE_(\d+)\u0000/g, (_, id) => placeholders[Number(id)] ?? '')
  return decorated
}

// Allowlist explicite : seules ces balises peuvent passer le sanitiseur.
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'span', 'div',
  'strong', 'em', 'del', 's', 'sub', 'sup',
  'ul', 'ol', 'li',
  'blockquote',
  'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  // SVG inline pour les icones admonitions (injectees par preprocessAdmonitions)
  'svg', 'path', 'circle', 'line', 'polygon',
]

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'target', 'rel',
  'colspan', 'rowspan',
  // Attributs SVG necessaires pour les icones admonitions
  'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'cx', 'cy', 'r',
  'x1', 'y1', 'x2', 'y2', 'd', 'points',
  'aria-hidden',
  // Attributs data-* utilises par Lumen pour relier les liens
  // inter-chapitres a une navigation interne via un click handler.
  'data-chapter-link', 'data-external',
]

// Force rel="noopener noreferrer" sur tous les liens externes pour eviter window.opener leak
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const el = node as HTMLAnchorElement
    if (el.getAttribute('target')) {
      el.setAttribute('rel', 'noopener noreferrer')
    }
  }
})

/**
 * Resout un chemin relatif (lien markdown) par rapport au chemin d'un
 * fichier de reference. Supporte `../`, `./`, `/` absolu (racine repo).
 * Retourne null si le lien est absolu (http, mailto, ancre, data:).
 */
function resolveRelativePath(link: string, currentPath: string): string | null {
  if (!link || /^(https?:|data:|mailto:|#)/i.test(link)) return null
  if (link.startsWith('/')) return link.replace(/^\/+/, '')
  const dirParts = currentPath.split('/').slice(0, -1)
  const parts = link.split('/')
  for (const p of parts) {
    if (p === '..') dirParts.pop()
    else if (p !== '.' && p !== '') dirParts.push(p)
  }
  return dirParts.join('/')
}

/**
 * Post-process les liens du HTML rendu quand on est dans un contexte
 * Lumen (chapterPath fourni) :
 *  - liens relatifs vers un .md -> flag data-chapter-link pour que le
 *    viewer intercepte le clic et navigue en interne
 *  - liens http/https -> marque data-external pour ouverture dans le
 *    navigateur systeme (geree par le click handler du viewer)
 */
function rewriteLinksForLumen(html: string, chapterPath: string): string {
  return html.replace(/<a\s+([^>]*)href="([^"]+)"([^>]*)>/g, (full, beforeHref, href, afterHref) => {
    const isExternal = /^https?:\/\//i.test(href)
    if (isExternal) {
      return `<a ${beforeHref}href="${href}"${afterHref} data-external="1" target="_blank" rel="noopener noreferrer">`
    }
    if (/\.md(#.*)?$/i.test(href)) {
      const [rawPath, hash] = href.split('#')
      const resolved = resolveRelativePath(rawPath, chapterPath)
      if (resolved) {
        const target = hash ? `${resolved}#${hash}` : resolved
        return `<a ${beforeHref}href="#${target}"${afterHref} data-chapter-link="${resolved}">`
      }
    }
    return full
  })
}

export interface RenderMarkdownOptions {
  /** Chemin du chapitre courant dans le repo (ex: "cours/01-intro.md").
   *  Quand fourni, les liens relatifs vers d'autres .md recoivent un
   *  attribut data-chapter-link pour etre interceptes par le viewer. */
  chapterPath?: string
}

/**
 * Convertit un markdown en HTML sanitise (allowlist + force rel noopener).
 * DOMPurify retire automatiquement les protocoles dangereux (javascript:).
 */
export function renderMarkdown(md: string, options: RenderMarkdownOptions = {}): string {
  if (!md) return ''
  const withAdmonitions = preprocessAdmonitions(md)
  const rawHtml = marked.parse(withAdmonitions, { async: false }) as string
  const withIds = injectHeadingIds(rawHtml)
  const withKeywords = highlightKeywords(withIds)
  const withLinks = options.chapterPath
    ? rewriteLinksForLumen(withKeywords, options.chapterPath)
    : withKeywords
  return DOMPurify.sanitize(withLinks, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Autorise les data URIs sur img (necessaire pour les images
    // inlinees par le backend Lumen) et les fragments internes (#...)
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))|^(?:data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,)|^#/i,
  })
}
