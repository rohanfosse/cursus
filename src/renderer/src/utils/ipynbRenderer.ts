/**
 * Rendu Jupyter Notebook (.ipynb) pour Lumen.
 *
 * Parse le JSON du notebook et rend chaque cellule :
 * - code : bloc de code syntax-highlight (via le pipeline markdown)
 * - markdown : rendu markdown standard (avec KaTeX)
 * - raw : bloc preformate
 * - output : texte, images base64, HTML, erreurs
 */
import { renderMarkdown } from '@/utils/markdown'
import { escapeHtml } from '@/utils/html'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw'
  source: string[] | string
  outputs?: NotebookOutput[]
  execution_count?: number | null
  metadata?: Record<string, unknown>
}

interface NotebookOutput {
  output_type: string
  text?: string[] | string
  data?: Record<string, string[] | string>
  ename?: string
  evalue?: string
  traceback?: string[]
  execution_count?: number | null
}

interface Notebook {
  cells: NotebookCell[]
  metadata?: {
    kernelspec?: { display_name?: string; language?: string }
    language_info?: { name?: string }
  }
}

function joinSource(source: string[] | string): string {
  return Array.isArray(source) ? source.join('') : source
}

function renderOutput(output: NotebookOutput): string {
  const parts: string[] = []

  if (output.output_type === 'stream' && output.text) {
    const text = joinSource(output.text)
    parts.push(`<pre class="ipynb-stream">${escapeHtml(text)}</pre>`)
  }

  if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
    const data = output.data
    if (!data) return ''

    // Images
    if (data['image/png']) {
      const img = joinSource(data['image/png']).trim()
      parts.push(`<img class="ipynb-img" src="data:image/png;base64,${img}" alt="Output" />`)
    } else if (data['image/jpeg']) {
      const img = joinSource(data['image/jpeg']).trim()
      parts.push(`<img class="ipynb-img" src="data:image/jpeg;base64,${img}" alt="Output" />`)
    } else if (data['image/svg+xml']) {
      const svg = DOMPurify.sanitize(joinSource(data['image/svg+xml']), {
        USE_PROFILES: { svg: true },
      })
      parts.push(`<div class="ipynb-svg">${svg}</div>`)
    }

    // HTML (sanitise pour eviter les XSS dans les notebooks non-trusted)
    if (data['text/html']) {
      const html = DOMPurify.sanitize(joinSource(data['text/html']))
      parts.push(`<div class="ipynb-html-output">${html}</div>`)
    }

    // Texte brut (si pas d'image/HTML)
    if (parts.length === 0 && data['text/plain']) {
      const text = joinSource(data['text/plain'])
      parts.push(`<pre class="ipynb-text">${escapeHtml(text)}</pre>`)
    }
  }

  if (output.output_type === 'error') {
    const tb = output.traceback?.map((line) =>
      // Les tracebacks contiennent des codes ANSI — on les strip
      escapeHtml(line.replace(/\x1b\[[0-9;]*m/g, '')),
    ).join('\n') ?? `${output.ename}: ${output.evalue}`
    parts.push(`<pre class="ipynb-error">${tb}</pre>`)
  }

  return parts.join('\n')
}

export function renderIpynb(source: string, chapterPath: string): string {
  let nb: Notebook
  try {
    nb = JSON.parse(source)
  } catch {
    return `<div class="ipynb-parse-error"><p>Format .ipynb invalide</p></div>`
  }

  if (!nb.cells || !Array.isArray(nb.cells)) {
    return `<div class="ipynb-parse-error"><p>Aucune cellule trouvee dans le notebook</p></div>`
  }

  const lang = nb.metadata?.kernelspec?.language
    ?? nb.metadata?.language_info?.name
    ?? 'python'

  const MAX_CELLS = 500
  const cells = nb.cells.length > MAX_CELLS ? nb.cells.slice(0, MAX_CELLS) : nb.cells
  const parts: string[] = []

  for (const cell of cells) {
    const src = joinSource(cell.source)

    if (cell.cell_type === 'markdown') {
      parts.push(`<div class="ipynb-cell ipynb-cell--md">${renderMarkdown(src, { chapterPath })}</div>`)
      continue
    }

    if (cell.cell_type === 'code') {
      const execLabel = cell.execution_count != null ? `[${cell.execution_count}]` : '[ ]'
      const validLang = hljs.getLanguage(lang)
      const highlighted = validLang
        ? hljs.highlight(src, { language: lang }).value
        : escapeHtml(src)

      parts.push(
        `<div class="ipynb-cell ipynb-cell--code">` +
          `<div class="ipynb-code-wrap">` +
            `<span class="ipynb-exec-count">${escapeHtml(execLabel)}</span>` +
            `<pre class="lumen-code"><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>` +
          `</div>` +
          (cell.outputs?.length
            ? `<div class="ipynb-outputs">${cell.outputs.map(renderOutput).join('\n')}</div>`
            : '') +
        `</div>`,
      )
      continue
    }

    if (cell.cell_type === 'raw') {
      parts.push(`<div class="ipynb-cell ipynb-cell--raw"><pre>${escapeHtml(src)}</pre></div>`)
    }
  }

  if (nb.cells.length > MAX_CELLS) {
    parts.push(`<div class="ipynb-parse-error"><p>Notebook tronque : ${nb.cells.length - MAX_CELLS} cellules masquees</p></div>`)
  }

  return parts.join('\n')
}
