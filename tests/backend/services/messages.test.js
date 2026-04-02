const { parseMentions, buildPushPayload } = require('../../../server/services/messages')

describe('parseMentions', () => {
  it('detects @everyone', () => {
    const result = parseMentions('Bonjour @everyone !')
    expect(result.mentionEveryone).toBe(true)
  })

  it('detects @everyone case insensitive', () => {
    const result = parseMentions('Hello @Everyone')
    expect(result.mentionEveryone).toBe(true)
  })

  it('extracts individual mentions', () => {
    const result = parseMentions('Hello @jean.dupont and @marie-curie')
    expect(result.mentionNames).toEqual(['jean.dupont', 'marie-curie'])
    expect(result.mentionEveryone).toBe(false)
  })

  it('excludes @everyone from individual mentions', () => {
    const result = parseMentions('@everyone @jean')
    expect(result.mentionEveryone).toBe(true)
    expect(result.mentionNames).toEqual(['jean'])
  })

  it('handles empty content', () => {
    const result = parseMentions('')
    expect(result.mentionEveryone).toBe(false)
    expect(result.mentionNames).toEqual([])
  })

  it('handles null content', () => {
    const result = parseMentions(null)
    expect(result.mentionEveryone).toBe(false)
    expect(result.mentionNames).toEqual([])
  })

  it('handles content without mentions', () => {
    const result = parseMentions('Un message normal sans mention')
    expect(result.mentionEveryone).toBe(false)
    expect(result.mentionNames).toEqual([])
  })

  it('handles multiple mentions of same user', () => {
    const result = parseMentions('@jean et encore @jean')
    expect(result.mentionNames).toEqual(['jean', 'jean'])
  })
})

describe('buildPushPayload', () => {
  const user = { id: 1, name: 'Jean Dupont' }
  const message = { id: 42, content: 'Hello' }
  const mentions = { mentionEveryone: false, mentionNames: [] }

  it('builds payload for channel message', () => {
    const payload = { channelId: 1, content: 'Hello world', channelName: 'general', promoId: 1 }
    const result = buildPushPayload(payload, user, message, mentions)
    expect(result.channelId).toBe(1)
    expect(result.dmStudentId).toBeNull()
    expect(result.authorName).toBe('Jean Dupont')
    expect(result.preview).toBe('Hello world')
    expect(result.message).toBeUndefined()
  })

  it('builds payload for DM message (includes message object)', () => {
    const payload = { dmStudentId: 2, content: 'Salut' }
    const result = buildPushPayload(payload, user, message, mentions)
    expect(result.dmStudentId).toBe(2)
    expect(result.channelId).toBeNull()
    expect(result.message).toEqual(message)
  })

  it('strips markdown from preview', () => {
    const payload = { channelId: 1, content: '**bold** `code` # heading [link](url) ![img](url)' }
    const result = buildPushPayload(payload, user, message, mentions)
    expect(result.preview).not.toContain('**')
    expect(result.preview).not.toContain('`')
    expect(result.preview).not.toContain('#')
  })

  it('truncates preview to 80 chars', () => {
    const payload = { channelId: 1, content: 'a'.repeat(200) }
    const result = buildPushPayload(payload, user, message, mentions)
    expect(result.preview.length).toBe(80)
  })

  it('includes mention info', () => {
    const payload = { channelId: 1, content: '@everyone' }
    const m = { mentionEveryone: true, mentionNames: ['jean'] }
    const result = buildPushPayload(payload, user, message, m)
    expect(result.mentionEveryone).toBe(true)
    expect(result.mentionNames).toEqual(['jean'])
  })
})
