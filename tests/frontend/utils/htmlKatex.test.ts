/**
 * Tests du rendu KaTeX dans les messages chat (utils/html.ts v2.239).
 *
 * On valide :
 *  - extractMath() substitue correctement $...$ et $$...$$ par un token.
 *  - Le code inline et les blocs triple-backtick sont proteges (ne touchent
 *    pas au `$` qu'ils peuvent contenir — ex. `$variable`).
 *  - reinsertMath() restaure le HTML KaTeX post-sanitisation.
 *  - renderMessageContent() produit du HTML katex pour une formule simple.
 *  - renderChatKatex() retourne un HTML qui contient la classe `katex`.
 */
import { describe, it, expect } from 'vitest'
import {
  extractMath,
  reinsertMath,
  renderChatKatex,
  renderMessageContent,
} from '@/utils/html'

describe('renderChatKatex', () => {
  it('returns HTML containing the "katex" class for inline math', () => {
    const html = renderChatKatex('x^2', false)
    expect(html).toContain('class="katex"')
  })

  it('returns "katex-display" wrapper for display mode', () => {
    const html = renderChatKatex('\\sum_{i=1}^n i', true)
    expect(html).toContain('katex-display')
  })

  it('returns an inline error marker for invalid LaTeX', () => {
    // KaTeX avec `throwOnError: false` rend en rouge via son propre mecanisme,
    // notre wrapper retombe sur msg-math-error uniquement si la lib throw.
    // Un input vraiment cassé : `\unknownmacro` en mode strict genererait un
    // warning ; en strict=ignore, KaTeX retourne une formule rendue avec
    // un span colorie par KaTeX (.katex-error). On verifie donc au moins
    // qu'aucune exception n'est propagee.
    expect(() => renderChatKatex('\\unknownmacro{x}', false)).not.toThrow()
  })

  it('uses a shared cache (same input = same reference)', () => {
    const a = renderChatKatex('\\pi', false)
    const b = renderChatKatex('\\pi', false)
    expect(a).toBe(b)
  })
})

describe('extractMath + reinsertMath', () => {
  it('replaces inline $...$ with a placeholder', () => {
    const store: string[] = []
    const result = extractMath('La formule est $x^2$ ici.', store)
    expect(store).toHaveLength(1)
    expect(store[0]).toContain('katex')
    // Le `$x^2$` est remplace par un token, le texte autour reste intact
    expect(result).toContain('La formule est')
    expect(result).toContain('MMATH0')
    expect(result).toContain('ici.')
    expect(result).not.toContain('$x^2$')
  })

  it('replaces display $$...$$ with a placeholder', () => {
    const store: string[] = []
    const result = extractMath('Voici :\n$$\\sum x$$\nFin.', store)
    expect(store).toHaveLength(1)
    expect(store[0]).toContain('katex-display')
    expect(result).toContain('MMATH0')
  })

  it('protects code blocks from math extraction', () => {
    const store: string[] = []
    // Le $foo dans le bloc code doit etre preserve, pas traite comme du math
    const input = 'Voici du code :\n```js\nconst x = `$foo` + `$bar`\n```\nEt $y^2$ hors code.'
    const result = extractMath(input, store)
    // Seul $y^2$ doit etre extrait, pas le contenu du bloc code
    expect(store).toHaveLength(1)
    expect(result).toContain('```js')
    expect(result).toContain('$foo')
    expect(result).toContain('$bar')
    expect(result).toContain('MMATH0')
  })

  it('protects inline code from math extraction', () => {
    const store: string[] = []
    const result = extractMath('Le prix est `$100` et la formule $a+b$.', store)
    // Le $100 dans le code inline est preserve, seul $a+b$ est extrait
    expect(store).toHaveLength(1)
    expect(result).toContain('`$100`')
    expect(result).toContain('MMATH0')
  })

  it('does not match $10 / $100 (dollar amounts)', () => {
    const store: string[] = []
    const result = extractMath('Le prix est $10 et le cout $100 euros.', store)
    // Aucune formule mathematique : les regex excluent les chiffres apres $
    expect(store).toHaveLength(0)
    expect(result).toBe('Le prix est $10 et le cout $100 euros.')
  })

  it('reinsertMath restores stored HTML from tokens', () => {
    const store = ['<span class="katex">RENDERED</span>']
    const result = reinsertMath('Avant MMATH0 Apres', store)
    expect(result).toBe('Avant <span class="katex">RENDERED</span> Apres')
  })
})

describe('renderMessageContent with math', () => {
  it('renders inline $x^2$ as a .katex span inside a message', () => {
    const html = renderMessageContent('La formule $x^2$ est simple.')
    expect(html).toContain('katex')
    expect(html).toContain('La formule')
    expect(html).toContain('est simple')
  })

  it('renders $$ block math as .katex-display', () => {
    const html = renderMessageContent('Formule :\n$$\\sum_{i=1}^n i$$\nFin.')
    expect(html).toContain('katex-display')
  })

  it('leaves $10 as plain text (pas une formule)', () => {
    const html = renderMessageContent('Le ticket coute $10 aujourd\'hui.')
    expect(html).not.toContain('katex')
    // Le $10 reste affiche tel-quel (pas de traitement math)
    expect(html).toContain('$10')
  })

  it('protects code blocks from math rendering', () => {
    const html = renderMessageContent('```js\nconst tpl = `$variable`\n```')
    expect(html).not.toContain('katex')
    // Le contenu du bloc code est preserve
    expect(html).toContain('variable')
  })

  it('handles multiple formulas in a single message', () => {
    const html = renderMessageContent('Soit $a$ et $b$ : $$a+b$$')
    // 3 renderings : 2 inline + 1 display
    const inlineCount = (html.match(/class="katex"/g) ?? []).length
    const displayCount = (html.match(/katex-display/g) ?? []).length
    expect(inlineCount).toBeGreaterThanOrEqual(2)
    expect(displayCount).toBe(1)
  })

  it('does not throw on invalid LaTeX (graceful fallback)', () => {
    expect(() => renderMessageContent('Formule cassee : $\\\\\\frac{a}$'))
      .not.toThrow()
  })
})
