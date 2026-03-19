
const { setupTestDb, teardownTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../src/db/models/messages')
})
afterAll(() => teardownTestDb())

describe('messages model', () => {
  it('sendMessage inserts a message', () => {
    const result = queries.sendMessage({
      channelId: 1,
      dmStudentId: null,
      authorName: 'Jean Dupont',
      authorType: 'student',
      content: 'Hello world',
    })
    expect(result.changes).toBe(1)
    expect(Number(result.lastInsertRowid)).toBeGreaterThan(0)
  })

  it('getChannelMessages returns inserted messages', () => {
    const msgs = queries.getChannelMessages(1)
    expect(msgs.length).toBeGreaterThan(0)
    expect(msgs[0].content).toBe('Hello world')
    expect(msgs[0].author_name).toBe('Jean Dupont')
  })

  it('editMessage updates content and sets edited flag', () => {
    const msgs = queries.getChannelMessages(1)
    const msgId = msgs[0].id
    queries.editMessage(msgId, 'Updated content')
    const updated = queries.getChannelMessages(1)
    const edited = updated.find((m) => m.id === msgId)
    expect(edited.content).toBe('Updated content')
    expect(edited.edited).toBe(1)
  })

  it('searchMessages finds by content', () => {
    const results = queries.searchMessages(1, 'Updated')
    expect(results.length).toBeGreaterThan(0)
  })

  it('searchMessages returns empty for no match', () => {
    const results = queries.searchMessages(1, 'nonexistentxyz')
    expect(results.length).toBe(0)
  })

  it('togglePinMessage pins a message', () => {
    const msgs = queries.getChannelMessages(1)
    const msgId = msgs[0].id
    queries.togglePinMessage(msgId, true)
    const pinned = queries.getPinnedMessages(1)
    expect(pinned.length).toBe(1)
    expect(pinned[0].id).toBe(msgId)
  })

  it('togglePinMessage unpins a message', () => {
    const msgs = queries.getChannelMessages(1)
    const msgId = msgs[0].id
    queries.togglePinMessage(msgId, false)
    const pinned = queries.getPinnedMessages(1)
    expect(pinned.length).toBe(0)
  })

  it('deleteMessage removes the message', () => {
    const msgs = queries.getChannelMessages(1)
    const msgId = msgs[0].id
    queries.deleteMessage(msgId)
    const after = queries.getChannelMessages(1)
    expect(after.find((m) => m.id === msgId)).toBeUndefined()
  })

  it('getChannelMessagesPage returns paginated results', () => {
    // Insert multiple messages
    for (let i = 0; i < 5; i++) {
      queries.sendMessage({
        channelId: 1,
        dmStudentId: null,
        authorName: 'Jean Dupont',
        authorType: 'student',
        content: `Paginated msg ${i}`,
      })
    }
    const page = queries.getChannelMessagesPage(1, null)
    expect(page.length).toBeGreaterThan(0)
    // Results should be in DESC order (newest first)
    expect(page[0].content).toBe('Paginated msg 4')
  })
})
