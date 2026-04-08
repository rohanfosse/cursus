import { describe, it, expect } from 'vitest'
import { escapeHtml, applyMentions, hasMention, renderMessageContent } from '@/utils/html'

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B')
  })

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
  })

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('hasMention', () => {
  it('detects @everyone', () => {
    expect(hasMention('Hello @everyone!', 'Jean')).toBe(true)
  })

  it('detects @everyone case-insensitive', () => {
    expect(hasMention('Hello @Everyone!', 'Jean')).toBe(true)
  })

  it('detects user name mention', () => {
    expect(hasMention('Hey @jean, look at this', 'Jean Dupont')).toBe(true)
  })

  it('detects last name mention', () => {
    expect(hasMention('Hey @dupont', 'Jean Dupont')).toBe(true)
  })

  it('returns false when no mention', () => {
    expect(hasMention('Hello world', 'Jean')).toBe(false)
  })

  it('returns false with empty username', () => {
    expect(hasMention('Hello @someone', '')).toBe(false)
  })
})

describe('applyMentions', () => {
  it('wraps @everyone with mention-me class', () => {
    const result = applyMentions('Hello @everyone', 'Jean')
    expect(result).toContain('class="mention-me"')
    expect(result).toContain('@everyone')
  })

  it('wraps own name with mention-me class', () => {
    const result = applyMentions('Hello @jean', 'Jean Dupont')
    expect(result).toContain('class="mention-me"')
  })

  it('wraps other names with mention-tag class', () => {
    const result = applyMentions('Hello @alice', 'Jean')
    expect(result).toContain('class="mention-tag"')
  })
})

describe('renderMessageContent', () => {
  it('renders markdown bold to HTML', () => {
    const result = renderMessageContent('**bold**')
    expect(result).toContain('<strong>bold</strong>')
  })

  it('renders markdown italic', () => {
    const result = renderMessageContent('*italic*')
    expect(result).toContain('<em>italic</em>')
  })

  it('renders inline code', () => {
    const result = renderMessageContent('`code`')
    expect(result).toContain('<code>')
  })

  it('strips dangerous script tags via DOMPurify', () => {
    const result = renderMessageContent('<script>alert(1)</script>')
    expect(result).not.toContain('<script>')
  })

  it('strips onerror handlers', () => {
    const result = renderMessageContent('<img src=x onerror=alert(1)>')
    expect(result).not.toContain('onerror')
  })

  it('applies search highlighting', () => {
    const result = renderMessageContent('find the needle here', 'needle')
    expect(result).toContain('<mark class="search-highlight">needle</mark>')
  })

  it('applies mentions', () => {
    const result = renderMessageContent('Hello @everyone', '', 'Jean')
    expect(result).toContain('mention-me')
  })

  it('transforme \\[title](lumen:42) en span lumen-ref clickable', () => {
    const result = renderMessageContent('Voir \\[TP Python](lumen:42)')
    expect(result).toContain('class="lumen-ref"')
    expect(result).toContain('data-lumen-id="42"')
    expect(result).toContain('>TP Python<')
    expect(result).not.toContain('data-lumen-file')
  })

  it('transforme \\[title](lumen:42:src/main.py) en span avec data-lumen-file', () => {
    const result = renderMessageContent('Voir \\[main.py](lumen:42:src/main.py)')
    expect(result).toContain('data-lumen-id="42"')
    expect(result).toContain('data-lumen-file="src/main.py"')
  })

  it('gere les paths avec extensions diverses', () => {
    const result = renderMessageContent('\\[cfg](lumen:1:config/app.json)')
    expect(result).toContain('data-lumen-file="config/app.json"')
  })
})
