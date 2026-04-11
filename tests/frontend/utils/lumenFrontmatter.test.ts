import { describe, it, expect } from 'vitest'
import { parseChapterContent } from '../../../src/renderer/src/utils/lumenFrontmatter'

describe('parseChapterContent', () => {
  it('returns empty frontmatter when content is null', () => {
    const r = parseChapterContent(null)
    expect(r.frontmatter).toEqual({})
    expect(r.body).toBe('')
    expect(r.isMarp).toBe(false)
  })

  it('returns empty frontmatter when content is undefined', () => {
    const r = parseChapterContent(undefined)
    expect(r.frontmatter).toEqual({})
    expect(r.body).toBe('')
    expect(r.isMarp).toBe(false)
  })

  it('returns body unchanged when no frontmatter present', () => {
    const md = '# Hello\n\nWorld'
    const r = parseChapterContent(md)
    expect(r.frontmatter).toEqual({})
    expect(r.body).toBe(md)
    expect(r.isMarp).toBe(false)
  })

  it('parses simple frontmatter and strips it from body', () => {
    const md = '---\ntitle: Cours\nauthor: Rohan\n---\n# Hello'
    const r = parseChapterContent(md)
    expect(r.frontmatter.title).toBe('Cours')
    expect(r.frontmatter.author).toBe('Rohan')
    expect(r.body).toBe('# Hello')
    expect(r.isMarp).toBe(false)
  })

  it('detects marp: true and sets isMarp', () => {
    const md = '---\nmarp: true\ntheme: default\n---\n# Slide 1\n---\n# Slide 2'
    const r = parseChapterContent(md)
    expect(r.isMarp).toBe(true)
    expect(r.frontmatter.marp).toBe(true)
    expect(r.frontmatter.theme).toBe('default')
    expect(r.body).toBe('# Slide 1\n---\n# Slide 2')
  })

  it('does not set isMarp when marp is false', () => {
    const md = '---\nmarp: false\n---\n# Hello'
    const r = parseChapterContent(md)
    expect(r.isMarp).toBe(false)
  })

  it('does not set isMarp when marp is missing', () => {
    const md = '---\ntheme: default\n---\n# Hello'
    const r = parseChapterContent(md)
    expect(r.isMarp).toBe(false)
  })

  it('handles CRLF line endings', () => {
    const md = '---\r\nmarp: true\r\n---\r\n# Slide'
    const r = parseChapterContent(md)
    expect(r.isMarp).toBe(true)
    expect(r.body).toBe('# Slide')
  })

  it('returns empty frontmatter on broken YAML', () => {
    const md = '---\ntitle: [unclosed\n---\n# Body'
    const r = parseChapterContent(md)
    expect(r.frontmatter).toEqual({})
    expect(r.isMarp).toBe(false)
    expect(r.body).toBe(md)
  })

  it('does not match frontmatter that does not start at byte 0', () => {
    const md = '\n---\nmarp: true\n---\n# Body'
    const r = parseChapterContent(md)
    expect(r.isMarp).toBe(false)
    expect(r.body).toBe(md)
  })

  it('returns body when frontmatter delimiters are not closed', () => {
    const md = '---\nmarp: true\n# never closed'
    const r = parseChapterContent(md)
    expect(r.frontmatter).toEqual({})
    expect(r.body).toBe(md)
  })

  it('preserves multiline body content after frontmatter', () => {
    const md = '---\nmarp: true\n---\n# A\n\nparagraph\n\n## B\n'
    const r = parseChapterContent(md)
    expect(r.body).toBe('# A\n\nparagraph\n\n## B\n')
  })
})
