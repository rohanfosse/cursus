/**
 * Tests pour le markdown renderer Lumen.
 * Verifie surtout la securite (XSS, sanitisation) et le rendu basique.
 */
import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown - rendu basique', () => {
  it('rend un titre h1', () => {
    const html = renderMarkdown('# Bonjour')
    expect(html).toContain('<h1')
    expect(html).toContain('Bonjour')
  })

  it('rend du gras et de l\'italique', () => {
    const html = renderMarkdown('**gras** et *italique*')
    expect(html).toContain('<strong>gras</strong>')
    expect(html).toContain('<em>italique</em>')
  })

  it('rend une liste a puces', () => {
    const html = renderMarkdown('- un\n- deux')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>un</li>')
    expect(html).toContain('<li>deux</li>')
  })

  it('rend un lien', () => {
    const html = renderMarkdown('[Cursus](https://cursus.school)')
    expect(html).toContain('href="https://cursus.school"')
    expect(html).toContain('Cursus')
  })

  it('rend une chaine vide sans planter', () => {
    expect(renderMarkdown('')).toBe('')
  })

  it('rend un bloc de code avec syntax highlighting', () => {
    const html = renderMarkdown('```js\nconst a = 1\n```')
    expect(html).toContain('lumen-code')
    expect(html).toContain('hljs')
  })
})

describe('renderMarkdown - securite XSS', () => {
  it('strip un script tag', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert')
  })

  it('strip un onerror sur img', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('alert')
  })

  it('strip un onclick sur lien', () => {
    const html = renderMarkdown('<a href="#" onclick="alert(1)">click</a>')
    expect(html).not.toContain('onclick')
  })

  it('strip un href javascript:', () => {
    const html = renderMarkdown('[xss](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })

  it('strip un iframe', () => {
    const html = renderMarkdown('<iframe src="https://evil.com"></iframe>')
    expect(html).not.toContain('<iframe')
  })

  it('strip un style tag', () => {
    const html = renderMarkdown('<style>body { display: none }</style>')
    expect(html).not.toContain('<style')
  })

  it('strip un object embed', () => {
    const html = renderMarkdown('<object data="evil.swf"></object>')
    expect(html).not.toContain('<object')
  })

  it('strip un base tag (redirect attack)', () => {
    const html = renderMarkdown('<base href="https://evil.com/">')
    expect(html).not.toContain('<base')
  })

  it('strip un form tag', () => {
    const html = renderMarkdown('<form action="evil.com"><input/></form>')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<input')
  })

  it('preserve les attributs srs (href, src, alt)', () => {
    const html = renderMarkdown('![alt text](https://example.com/img.png)')
    expect(html).toContain('src="https://example.com/img.png"')
    expect(html).toContain('alt="alt text"')
  })

  it('force rel noopener sur les liens avec target', () => {
    // Marked ne genere pas target="_blank" par defaut, mais on teste le hook
    const html = renderMarkdown('<a href="https://example.com" target="_blank">link</a>')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})

describe('renderMarkdown - structures complexes', () => {
  it('rend une table GFM', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    const html = renderMarkdown(md)
    expect(html).toContain('<table>')
    expect(html).toContain('<th>A</th>')
    expect(html).toContain('<td>1</td>')
  })

  it('rend une citation imbriquee', () => {
    const html = renderMarkdown('> citation\n>\n> deuxieme ligne')
    expect(html).toContain('<blockquote>')
  })

  it('rend du code inline', () => {
    const html = renderMarkdown('utiliser `npm install` pour installer')
    expect(html).toContain('<code>npm install</code>')
  })
})

describe('renderMarkdown - keyword highlighting', () => {
  it('decore TODO en rouge (lumen-kw-todo)', () => {
    const html = renderMarkdown('TODO: ecrire la doc')
    expect(html).toContain('lumen-kw')
    expect(html).toContain('lumen-kw-todo')
  })

  it('decore WARNING et ATTENTION en orange', () => {
    const h1 = renderMarkdown('WARNING: ne pas faire ca')
    const h2 = renderMarkdown('ATTENTION au style')
    expect(h1).toContain('lumen-kw-warn')
    expect(h2).toContain('lumen-kw-warn')
  })

  it('decore NOTE et INFO en bleu', () => {
    const html = renderMarkdown('NOTE: important a retenir')
    expect(html).toContain('lumen-kw-note')
  })

  it('decore TIP en vert', () => {
    const html = renderMarkdown('TIP: utilise ce raccourci')
    expect(html).toContain('lumen-kw-tip')
  })

  it('ne decore PAS les mots-cles dans un bloc de code', () => {
    const md = '```\n// TODO: code fixe\n```'
    const html = renderMarkdown(md)
    expect(html).toContain('lumen-code')
    const preMatch = html.match(/<pre[\s\S]*?<\/pre>/)
    expect(preMatch).toBeTruthy()
    expect(preMatch![0]).not.toContain('lumen-kw')
  })

  it('ne decore pas les occurrences en minuscules', () => {
    const html = renderMarkdown('une todo rapide')
    expect(html).not.toContain('lumen-kw')
  })
})

describe('renderMarkdown - admonitions Obsidian-style', () => {
  it('transforme > [!NOTE] Titre en bloc note', () => {
    const md = '> [!NOTE] Ma note\n> Contenu de la note'
    const html = renderMarkdown(md)
    expect(html).toContain('lumen-admonition')
    expect(html).toContain('lumen-adm-note')
    expect(html).toContain('Ma note')
    expect(html).toContain('Contenu de la note')
  })

  it('transforme > [!WARNING] en bloc warning', () => {
    const md = '> [!WARNING]\n> Attention danger'
    const html = renderMarkdown(md)
    expect(html).toContain('lumen-adm-warning')
    expect(html).toContain('Attention danger')
  })

  it('utilise le titre par defaut si pas fourni', () => {
    const md = '> [!TIP]\n> Astuce rapide'
    const html = renderMarkdown(md)
    expect(html).toContain('lumen-adm-tip')
    expect(html).toContain('Astuce') // titre par defaut TIP
  })

  it('gere DANGER et IMPORTANT', () => {
    const d = renderMarkdown('> [!DANGER] Piege\n> Eviter')
    const imp = renderMarkdown('> [!IMPORTANT]\n> Point cle')
    expect(d).toContain('lumen-adm-danger')
    expect(imp).toContain('lumen-adm-warning') // IMPORTANT est mappe sur warning
  })

  it('rend le contenu markdown du body', () => {
    const md = '> [!NOTE] Test\n> **gras** et *italique*'
    const html = renderMarkdown(md)
    expect(html).toContain('<strong>gras</strong>')
    expect(html).toContain('<em>italique</em>')
  })

  it('ne transforme pas un blockquote normal', () => {
    const md = '> citation simple\n> sans admonition'
    const html = renderMarkdown(md)
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('lumen-admonition')
  })

  it('gere plusieurs admonitions consecutives', () => {
    const md = '> [!NOTE] A\n> Contenu A\n\n> [!TIP] B\n> Contenu B'
    const html = renderMarkdown(md)
    expect(html).toContain('lumen-adm-note')
    expect(html).toContain('lumen-adm-tip')
  })

  it('echappe le HTML dans le titre pour eviter XSS', () => {
    const md = '> [!NOTE] <script>alert(1)</script>\n> contenu'
    const html = renderMarkdown(md)
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('injecte un SVG icone inline pour chaque type d admonition', () => {
    const note = renderMarkdown('> [!NOTE]\n> test')
    const warn = renderMarkdown('> [!WARNING]\n> test')
    const danger = renderMarkdown('> [!DANGER]\n> test')
    const tip = renderMarkdown('> [!TIP]\n> test')
    expect(note).toContain('<svg')
    expect(warn).toContain('<svg')
    expect(danger).toContain('<svg')
    expect(tip).toContain('<svg')
    // Verifier que les SVG sont marques aria-hidden (purement decoratifs)
    expect(note).toContain('aria-hidden="true"')
  })

  it('DOMPurify conserve les SVG des admonitions apres sanitisation', () => {
    const html = renderMarkdown('> [!WARNING] Important\n> contenu')
    // Apres sanitisation DOMPurify, le SVG doit toujours etre present
    expect(html).toContain('<svg')
    expect(html).toContain('viewBox')
    expect(html).toContain('lumen-admonition-icon')
  })
})

// ── Cross-repo lumen:// links (v2.72) ────────────────────────────────────

describe('renderMarkdown : liens lumen:// (v2.72)', () => {
  it('reecrit un lien lumen://repo/path en data-lumen-link', () => {
    const md = '[Voir maths](lumen://0-Mathematiques/sujets/qcm.pdf)'
    const html = renderMarkdown(md, { chapterPath: 'guides/scrum.md' })
    expect(html).toContain('data-lumen-link="0-Mathematiques|sujets/qcm.pdf"')
    // Le href est reecrit en fragment pour passer DOMPurify
    expect(html).toContain('href="#lumen:0-Mathematiques:sujets/qcm.pdf"')
  })

  it('gere les chemins avec sous-dossiers profonds', () => {
    const md = '[Lab01](lumen://3-Reseau/02-Labs-and-Exercises/Lab01-Basic-LAN/instructions.md)'
    const html = renderMarkdown(md, { chapterPath: 'README.md' })
    expect(html).toContain('data-lumen-link="3-Reseau|02-Labs-and-Exercises/Lab01-Basic-LAN/instructions.md"')
  })

  it('preserve le texte du lien', () => {
    const md = '[Retour au bloc](lumen://4-Programmation-Web/README.md)'
    const html = renderMarkdown(md, { chapterPath: 'guides/php/mvc.md' })
    expect(html).toContain('Retour au bloc')
  })

  it("n'affecte pas les liens http/https", () => {
    const md = '[Google](https://google.com)'
    const html = renderMarkdown(md, { chapterPath: 'README.md' })
    expect(html).not.toContain('data-lumen-link')
    expect(html).toContain('data-external="1"')
  })

  it("n'affecte pas les liens relatifs .md (data-chapter-link standard)", () => {
    const md = '[Intro](intro.md)'
    const html = renderMarkdown(md, { chapterPath: 'cours/01-main.md' })
    expect(html).not.toContain('data-lumen-link')
    expect(html).toContain('data-chapter-link')
  })

  it('ignore lumen:// mal forme (pas de /)', () => {
    const md = '[broken](lumen://noslash)'
    const html = renderMarkdown(md, { chapterPath: 'README.md' })
    expect(html).not.toContain('data-lumen-link')
  })
})
