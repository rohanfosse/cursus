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
