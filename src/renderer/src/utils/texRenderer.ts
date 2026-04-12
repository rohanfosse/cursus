/**
 * Rendu LaTeX simplifie pour Lumen — transforme un fichier .tex en HTML
 * avec les maths rendues via KaTeX et la structure du document preservee.
 *
 * Supporte : \section, \subsection, \subsubsection, \paragraph,
 * \textbf, \textit, \emph, \underline, \href, \url,
 * \begin{itemize/enumerate/description}, \item,
 * \begin{equation/align/gather}, $ et $$ (inline/display math),
 * \includegraphics (placeholder), \begin{verbatim}, \begin{lstlisting},
 * \begin{figure}, \caption, \label, \ref.
 *
 * Ce n'est PAS un compilateur LaTeX complet — c'est un parseur best-effort
 * pour rendre lisibles les fichiers .tex courants dans le contexte
 * pedagogique CESI (articles, TPs, cours).
 */
import katex from 'katex'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

const katexCache = new Map<string, string>()
const KATEX_CACHE_MAX = 2000

function renderKatex(tex: string, display: boolean): string {
  const key = `${display ? 'd' : 'i'}:${tex}`
  const cached = katexCache.get(key)
  if (cached !== undefined) return cached
  if (katexCache.size >= KATEX_CACHE_MAX) {
    const first = katexCache.keys().next().value
    if (first !== undefined) katexCache.delete(first)
  }
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

/**
 * Extrait le corps du document (entre \begin{document} et \end{document}).
 * Si pas de structure document, retourne le contenu tel quel.
 */
function extractBody(tex: string): string {
  const beginDoc = tex.indexOf('\\begin{document}')
  const endDoc = tex.indexOf('\\end{document}')
  if (beginDoc >= 0) {
    const start = beginDoc + '\\begin{document}'.length
    return tex.slice(start, endDoc >= 0 ? endDoc : undefined).trim()
  }
  return tex.trim()
}

/**
 * Extrait le titre depuis \title{...} et l'auteur depuis \author{...}
 * dans le preambule (avant \begin{document}).
 */
function extractMeta(tex: string): { title: string | null; author: string | null; date: string | null } {
  const title = tex.match(/\\title\{([^}]*)\}/)?.[1] ?? null
  const author = tex.match(/\\author\{([^}]*)\}/)?.[1] ?? null
  const date = tex.match(/\\date\{([^}]*)\}/)?.[1] ?? null
  return { title, author, date }
}

/**
 * Rend le contenu LaTeX en HTML.
 */
export function renderTex(source: string): string {
  if (source.length > 2_000_000) {
    return '<div class="lumen-tex-img-placeholder"><span>Fichier .tex trop volumineux pour le rendu en ligne</span></div>'
  }
  const meta = extractMeta(source)
  let body = extractBody(source)

  const parts: string[] = []

  // Titre du document
  if (meta.title) {
    parts.push(`<h1 class="lumen-tex-title">${escapeHtml(meta.title)}</h1>`)
    if (meta.author || meta.date) {
      const items = [meta.author, meta.date].filter((x): x is string => Boolean(x)).map(escapeHtml)
      parts.push(`<p class="lumen-tex-meta">${items.join(' — ')}</p>`)
    }
  }

  // Extraire et proteger les environnements verbatim/lstlisting
  const verbatimBlocks: string[] = []
  body = body.replace(/\\begin\{(verbatim|lstlisting)\}([\s\S]*?)\\end\{\1\}/g, (_, _env, code) => {
    const i = verbatimBlocks.length
    verbatimBlocks.push(
      `<div class="lumen-codeblock"><pre class="lumen-code"><code>${escapeHtml(code.trim())}</code></pre></div>`,
    )
    return `\u0000VERB${i}\u0000`
  })

  // Extraire les environnements math display
  // \begin{equation}...\end{equation}, \begin{align}...\end{align}, etc.
  const mathEnvs = ['equation', 'equation\\*', 'align', 'align\\*', 'gather', 'gather\\*', 'multline', 'multline\\*']
  for (const env of mathEnvs) {
    const re = new RegExp(`\\\\begin\\{${env}\\}([\\s\\S]*?)\\\\end\\{${env}\\}`, 'g')
    body = body.replace(re, (_, math: string) => renderKatex(math.trim(), true))
  }

  // \[ ... \] display math
  body = body.replace(/\\\[([\s\S]*?)\\\]/g, (_, math: string) => renderKatex(math.trim(), true))

  // $$ ... $$ display math
  body = body.replace(/\$\$([\s\S]+?)\$\$/g, (_, math: string) => renderKatex(math.trim(), true))

  // $ ... $ inline math (pas les \$ echappes)
  body = body.replace(/(?<!\\)\$(?!\s)([^\n$]+?)(?<![\s\\])\$(?!\d)/g, (_, math: string) => renderKatex(math, false))

  // Structure du document
  body = body.replace(/\\section\*?\{([^}]*)\}/g, '<h2>$1</h2>')
  body = body.replace(/\\subsection\*?\{([^}]*)\}/g, '<h3>$1</h3>')
  body = body.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<h4>$1</h4>')
  body = body.replace(/\\paragraph\*?\{([^}]*)\}/g, '<h5>$1</h5>')

  // Formatage texte
  body = body.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
  body = body.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
  body = body.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
  body = body.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>')
  body = body.replace(/\\texttt\{([^}]*)\}/g, '<code>$1</code>')

  // Liens
  body = body.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
  body = body.replace(/\\url\{([^}]*)\}/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')

  // Images : placeholder lisible
  body = body.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g,
    '<div class="lumen-tex-img-placeholder"><span>[Image : $1]</span></div>',
  )

  // Listes itemize / enumerate / description
  body = body.replace(/\\begin\{itemize\}/g, '<ul>')
  body = body.replace(/\\end\{itemize\}/g, '</ul>')
  body = body.replace(/\\begin\{enumerate\}/g, '<ol>')
  body = body.replace(/\\end\{enumerate\}/g, '</ol>')
  body = body.replace(/\\begin\{description\}/g, '<dl>')
  body = body.replace(/\\end\{description\}/g, '</dl>')
  body = body.replace(/\\item\[([^\]]*)\]/g, '<dt>$1</dt><dd>')
  body = body.replace(/\\item\s*/g, '<li>')

  // Figure + caption
  body = body.replace(/\\begin\{figure\}(?:\[[^\]]*\])?/g, '<figure>')
  body = body.replace(/\\end\{figure\}/g, '</figure>')
  body = body.replace(/\\caption\{([^}]*)\}/g, '<figcaption>$1</figcaption>')

  // Tabular basique
  body = body.replace(/\\begin\{tabular\}\{[^}]*\}/g, '<table class="lumen-tex-table"><tbody>')
  body = body.replace(/\\end\{tabular\}/g, '</tbody></table>')
  body = body.replace(/\\hline/g, '')

  // Quote / abstract
  body = body.replace(/\\begin\{(quote|quotation|abstract)\}/g, '<blockquote>')
  body = body.replace(/\\end\{(quote|quotation|abstract)\}/g, '</blockquote>')

  // Nettoyage des commandes non reconnues
  body = body.replace(/\\label\{[^}]*\}/g, '')
  body = body.replace(/\\ref\{([^}]*)\}/g, '[$1]')
  body = body.replace(/\\centering/g, '')
  body = body.replace(/\\noindent/g, '')
  body = body.replace(/\\newpage/g, '<hr />')
  body = body.replace(/\\\\(?:\[[\d.]*(?:em|ex|pt|cm|mm)\])?/g, '<br />')  // \\ linebreaks
  body = body.replace(/\\maketitle/g, '')
  body = body.replace(/\\tableofcontents/g, '')

  // Caracteres speciaux LaTeX
  body = body.replace(/\\&/g, '&amp;')
  body = body.replace(/\\%/g, '%')
  body = body.replace(/\\#/g, '#')
  body = body.replace(/\\\$/g, '$')
  body = body.replace(/\\textbackslash(?:\{\})?/g, '\\')
  body = body.replace(/---/g, '\u2014')
  body = body.replace(/--/g, '\u2013')
  body = body.replace(/``/g, '\u201C')
  body = body.replace(/''/g, '\u201D')
  body = body.replace(/\\ldots/g, '\u2026')

  // Commentaires LaTeX (lignes commencant par %)
  body = body.replace(/^%.*$/gm, '')

  // Convertir les doubles sauts de ligne en paragraphes
  const paragraphs = body.split(/\n{2,}/)
  const htmlParts = paragraphs.map((p) => {
    const trimmed = p.trim()
    if (!trimmed) return ''
    // Si le paragraphe commence deja par un element de bloc, ne pas wrapper
    if (/^<(h[1-6]|ul|ol|dl|table|figure|blockquote|div|hr|pre)[\s>]/i.test(trimmed)) return trimmed
    // Si c'est du KaTeX display, ne pas wrapper
    if (trimmed.startsWith('<span class="katex-display"')) return trimmed
    return `<p>${trimmed}</p>`
  })

  // Restaurer les blocs verbatim
  let result = parts.join('\n') + '\n' + htmlParts.join('\n')
  result = result.replace(/\u0000VERB(\d+)\u0000/g, (_, i) => verbatimBlocks[Number(i)] ?? '')

  // Traiter les lignes de tableau (& separateur, \\ fin de ligne)
  // Simplifie: convertir & en </td><td> dans les tables
  result = result.replace(/<tbody>([\s\S]*?)<\/tbody>/g, (_, inner: string) => {
    const rows = inner.split('<br />').filter((r: string) => r.trim())
    const htmlRows = rows.map((row: string) => {
      const cells = row.split('&amp;').map((c: string) => `<td>${c.trim()}</td>`)
      return `<tr>${cells.join('')}</tr>`
    })
    return `<tbody>${htmlRows.join('')}</tbody>`
  })

  return result
}
