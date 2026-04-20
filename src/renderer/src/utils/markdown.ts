/** Markdown renderer pour Lumen — marked + DOMPurify pour eviter XSS.
 *  Enrichi avec KaTeX (maths $...$ et $$...$$) et placeholder Mermaid pour
 *  les schemas (rendus cote viewer apres injection DOM). */
import { marked } from 'marked'
import DOMPurify from 'dompurify'
// hljs/lib/common : 36 langages (~600KB gzip) au lieu des 190 du paquet full
// (~8.6MB raw). Subset couvre tous les langages usuels — js/ts/py/java/kotlin/
// rust/go/sql/yaml/bash/css/html/json/md/etc. HLJS_AUTO_SUBSET ci-dessous
// narrow plus encore pour la detection automatique.
import hljs from 'highlight.js/lib/common'
import katex from 'katex'

// Configuration de marked : code highlighting + breaks + GFM
marked.setOptions({
  gfm: true,
  breaks: true,
})

// Autodetection limitee a un sous-ensemble de langages frequents. hljs charge
// ~190 langages par defaut et highlightAuto les essaie TOUS (>500ms par bloc
// sans langue declaree), ce qui fait timeout les tests et ralentit le reader.
// Subset = 10x a 20x plus rapide, precision equivalente pour du code usuel.
const HLJS_AUTO_SUBSET = [
  'javascript', 'typescript', 'python', 'bash', 'shell',
  'html', 'css', 'json', 'sql', 'yaml', 'markdown',
]

// Hook pour highlight.js sur les blocs de code + wrapper avec badge langue.
// Cas special : `mermaid` est passe tel-quel (echappe) dans un <pre> marque,
// le viewer se charge du rendu SVG apres montage.
marked.use({
  renderer: {
    code(token) {
      const code = typeof token === 'string' ? token : token.text
      const lang = typeof token === 'string' ? '' : (token.lang ?? '')
      if (lang === 'mermaid') {
        // Placeholder : la source est conservee en textContent, rendue
        // cote Vue par mermaid.render apres v-html.
        return `<pre class="lumen-mermaid-src">${escapeHtml(code)}</pre>`
      }
      const validLang = lang && hljs.getLanguage(lang)
      const highlighted = validLang
        ? hljs.highlight(code, { language: lang }).value
        : hljs.highlightAuto(code, HLJS_AUTO_SUBSET).value
      const cls = validLang ? `language-${lang}` : ''
      const label = (validLang ? lang : (lang || 'text')).toUpperCase()
      return (
        `<div class="lumen-codeblock">` +
          `<div class="lumen-codeblock-header">` +
            `<span class="lumen-codeblock-lang">${escapeHtml(label)}</span>` +
          `</div>` +
          `<pre class="lumen-code"><code class="hljs ${cls}">${highlighted}</code></pre>` +
        `</div>`
      )
    },
  },
})

// ── KaTeX : extraction des maths avant parsing markdown ─────────────────────
//
// On extrait d'abord `$$...$$` (display) et `$...$` (inline, flanque de
// non-espace) en remplacant par un token textuel unique. Le markdown est
// ensuite parse / sanitise normalement, puis les tokens sont remplaces par
// le HTML KaTeX rendu (qui contient beaucoup de spans / attributs que
// DOMPurify n'aime pas — d'ou la substitution post-sanitisation).
//
// Les regions de code (```...``` et `...`) sont protegees pour eviter de
// coloriser un "$" dans du code source.

// Delimiteurs en Private Use Area (U+E000/U+E001) : valides Unicode,
// preserves par marked/DOMPurify, jamais generes par une saisie clavier
// donc zero risque de collision avec du contenu utilisateur reel.
const MATH_TOKEN_RE = /\uE000LMATH(\d+)\uE001/g
function mathToken(i: number): string {
  return `\uE000LMATH${i}\uE001`
}

// Cache global des formules deja rendues : identique `$x$` ou `$n$` reviennent
// souvent et renderToString est synchrone + couteux.
const katexCache = new Map<string, string>()

function safeRenderKatex(tex: string, display: boolean): string {
  const key = `${display ? 'd' : 'i'}:${tex}`
  const cached = katexCache.get(key)
  if (cached !== undefined) return cached
  let html: string
  try {
    html = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      output: 'html',
      strict: 'ignore',
    })
  } catch {
    html = `<code class="lumen-math-error">${escapeHtml(tex)}</code>`
  }
  katexCache.set(key, html)
  return html
}

function extractMath(md: string, store: string[]): string {
  // Protege les blocs / inline code d'abord
  const codeParts: string[] = []
  let work = md.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => {
    const i = codeParts.length
    codeParts.push(m)
    return `\u0000CODEPROT${i}\u0000`
  })

  // Display math : $$...$$ (multi-ligne autorise)
  work = work.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    const html = safeRenderKatex(tex.trim(), true)
    const i = store.length
    store.push(html)
    return mathToken(i)
  })

  // Inline math : $...$ (pas de saut de ligne, flanque de non-espace,
  // evite les "$10" / "$100" en n'acceptant pas un chiffre apres le $ final)
  work = work.replace(/(?<![\\$])\$(?!\s)([^\n$]+?)(?<![\s\\])\$(?!\d)/g, (_, tex: string) => {
    const html = safeRenderKatex(tex, false)
    const i = store.length
    store.push(html)
    return mathToken(i)
  })

  // Restore les blocs de code
  work = work.replace(/\u0000CODEPROT(\d+)\u0000/g, (_, i) => codeParts[Number(i)] ?? '')
  return work
}

function reinsertMath(html: string, store: string[]): string {
  return html.replace(MATH_TOKEN_RE, (_, i) => store[Number(i)] ?? '')
}

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
  'data-chapter-link', 'data-external', 'data-lumen-link',
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
 *  - liens lumen://repo/path -> flag data-lumen-link pour navigation
 *    cross-repo dans la meme promo (v2.72)
 *  - liens relatifs vers un .md -> flag data-chapter-link pour que le
 *    viewer intercepte le clic et navigue en interne
 *  - liens http/https -> marque data-external pour ouverture dans le
 *    navigateur systeme (geree par le click handler du viewer)
 */
function rewriteLinksForLumen(html: string, chapterPath: string): string {
  return html.replace(/<a\s+([^>]*)href="([^"]+)"([^>]*)>/g, (full, beforeHref, href, afterHref) => {
    // v2.72 : lumen://<repo-short-name>/<path> pour sauter vers un autre
    // chapitre du meme org (meme promo). Le repo est resolu cote viewer
    // par comparaison sur repo.repo (nom court) dans la liste des repos
    // de la promo courante.
    if (/^lumen:\/\//i.test(href)) {
      const without = href.replace(/^lumen:\/\//i, '')
      const firstSlash = without.indexOf('/')
      if (firstSlash > 0) {
        const repoName = without.slice(0, firstSlash)
        const path = without.slice(firstSlash + 1)
        return `<a ${beforeHref}href="#lumen:${repoName}:${path}"${afterHref} data-lumen-link="${repoName}|${path}">`
      }
      return full
    }
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
  const mathStore: string[] = []
  const withMath = extractMath(md, mathStore)
  const withAdmonitions = preprocessAdmonitions(withMath)
  const rawHtml = marked.parse(withAdmonitions, { async: false }) as string
  const withIds = injectHeadingIds(rawHtml)
  const withKeywords = highlightKeywords(withIds)
  const withLinks = options.chapterPath
    ? rewriteLinksForLumen(withKeywords, options.chapterPath)
    : withKeywords
  const sanitized = DOMPurify.sanitize(withLinks, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Autorise les data URIs sur img (necessaire pour les images
    // inlinees par le backend Lumen) et les fragments internes (#...)
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))|^(?:data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,)|^#/i,
  })
  // Re-insertion des maths KaTeX apres sanitisation (KaTeX produit du HTML
  // structurellement complexe que DOMPurify retirerait — on lui fait
  // confiance car l'entree TeX est echappee par KaTeX).
  return reinsertMath(sanitized, mathStore)
}
