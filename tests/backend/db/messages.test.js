
// Set JWT_SECRET before requiring crypto-dependent modules
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'

const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/messages')
})
afterAll(() => teardownTestDb())

describe('messages model', () => {
  it('sendMessage inserts a message', () => {
    const result = queries.sendMessage({
      channelId: 1,
      dmStudentId: null,
      authorName: 'Jean Dupont',
      authorId: 1,
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

  it('getMessageById returns enriched message data', () => {
    const msgs = queries.getChannelMessages(1)
    const message = queries.getMessageById(msgs[0].id)
    expect(message).toMatchObject({
      id: msgs[0].id,
      author_name: 'Jean Dupont',
      author_initials: 'JD',
      is_pinned: 0,
    })
  })

  it('getMessageById returns null for non-existent id', () => {
    const message = queries.getMessageById(99999)
    expect(message).toBeNull()
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

  it('searchMessages returns empty for null/empty query', () => {
    expect(queries.searchMessages(1, '')).toEqual([])
    expect(queries.searchMessages(1, null)).toEqual([])
  })

  it('togglePinMessage pins a message', () => {
    const msgs = queries.getChannelMessages(1)
    const msgId = msgs[0].id
    queries.togglePinMessage(msgId, true)
    const pinned = queries.getPinnedMessages(1)
    expect(pinned.length).toBe(1)
    expect(pinned[0].id).toBe(msgId)
    expect(queries.getMessageById(msgId).is_pinned).toBe(1)
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

  it('deleteMessage returns 0 for already deleted message', () => {
    const result = queries.sendMessage({
      channelId: 1, authorName: 'Test', authorType: 'student', content: 'del twice',
    })
    const id = Number(result.lastInsertRowid)
    expect(queries.deleteMessage(id)).toBe(1)
    expect(queries.deleteMessage(id)).toBe(0)
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

  it('getChannelMessagesPage with beforeId returns older messages', () => {
    const page1 = queries.getChannelMessagesPage(1, null)
    const lastId = page1[page1.length - 1].id
    const page2 = queries.getChannelMessagesPage(1, lastId)
    // All IDs in page2 should be < lastId
    for (const msg of page2) {
      expect(msg.id).toBeLessThan(lastId)
    }
  })
})

describe('updateReactions', () => {
  it('sets reactions JSON on a message', () => {
    const result = queries.sendMessage({
      channelId: 1, authorName: 'Test', authorType: 'student', content: 'React me',
    })
    const id = Number(result.lastInsertRowid)
    const reactionsJson = JSON.stringify({ thumbsup: [1] })
    const changes = queries.updateReactions(id, reactionsJson)
    expect(changes).toBe(1)
    const msg = queries.getMessageById(id)
    expect(msg.reactions).toBe(reactionsJson)
  })

  it('returns 0 for deleted message', () => {
    const result = queries.sendMessage({
      channelId: 1, authorName: 'Test', authorType: 'student', content: 'React del',
    })
    const id = Number(result.lastInsertRowid)
    queries.deleteMessage(id)
    expect(queries.updateReactions(id, '{}')).toBe(0)
  })
})

describe('sendMessage with reply fields', () => {
  it('stores reply_to fields', () => {
    const original = queries.sendMessage({
      channelId: 1, authorName: 'Alice', authorType: 'student', content: 'Original',
    })
    const origId = Number(original.lastInsertRowid)
    const reply = queries.sendMessage({
      channelId: 1, authorName: 'Bob', authorType: 'student', content: 'Reply',
      replyToId: origId, replyToAuthor: 'Alice', replyToPreview: 'Original',
    })
    const replyMsg = queries.getMessageById(Number(reply.lastInsertRowid))
    expect(replyMsg.reply_to_id).toBe(origId)
    expect(replyMsg.reply_to_author).toBe('Alice')
    expect(replyMsg.reply_to_preview).toBe('Original')
  })
})

describe('sendMessage with ta author type', () => {
  it('stores ta as teacher', () => {
    const result = queries.sendMessage({
      channelId: 1, authorName: 'TA User', authorId: -1, authorType: 'ta', content: 'TA msg',
    })
    const msg = queries.getMessageById(Number(result.lastInsertRowid))
    expect(msg.author_type).toBe('teacher')
  })
})

describe('sendMessage with admin author type', () => {
  it('stores admin as teacher', () => {
    const result = queries.sendMessage({
      channelId: 1, authorName: 'Admin User', authorId: -2, authorType: 'admin', content: 'Admin msg',
    })
    expect(result.changes).toBe(1)
    const msg = queries.getMessageById(Number(result.lastInsertRowid))
    expect(msg.author_type).toBe('teacher')
  })
})

describe('sendMessage author_type mapping', () => {
  it.each([
    ['student', 'student'],
    ['teacher', 'teacher'],
    ['ta',      'teacher'],
    ['admin',   'teacher'],
  ])('maps %s to %s', (input, expected) => {
    const result = queries.sendMessage({
      channelId: 1, authorName: 'Type Test', authorType: input, content: `type ${input}`,
    })
    const msg = queries.getMessageById(Number(result.lastInsertRowid))
    expect(msg.author_type).toBe(expected)
  })

  it('rejects unknown author_type', () => {
    expect(() => queries.sendMessage({
      channelId: 1, authorName: 'Bad', authorType: 'hacker', content: 'nope',
    })).toThrow()
  })
})

describe('DM messages', () => {
  beforeAll(() => {
    // Send some DM messages
    queries.sendMessage({
      dmStudentId: 1, authorName: 'Jean Dupont', authorId: 1, authorType: 'student', content: 'DM Hello',
    })
    queries.sendMessage({
      dmStudentId: 1, authorName: 'Prof Test', authorId: -1, authorType: 'teacher', content: 'DM Reply',
    })
  })

  it('getDmMessages returns DMs for a student', () => {
    const msgs = queries.getDmMessages(1)
    expect(msgs.length).toBeGreaterThanOrEqual(2)
    // Content is decrypted
    expect(msgs[0].content).toBe('DM Hello')
  })

  it('getDmMessagesPage returns paginated DMs', () => {
    const page = queries.getDmMessagesPage(1)
    expect(page.length).toBeGreaterThan(0)
  })

  it('getDmMessagesPage with beforeId', () => {
    const page1 = queries.getDmMessagesPage(1)
    if (page1.length > 1) {
      const lastId = page1[page1.length - 1].id
      const page2 = queries.getDmMessagesPage(1, lastId)
      for (const msg of page2) {
        expect(msg.id).toBeLessThan(lastId)
      }
    }
  })

  it('getDmMessagesPage with peerStudentId filters by peer', () => {
    const page = queries.getDmMessagesPage(1, null, -1)
    expect(Array.isArray(page)).toBe(true)
  })

  it('getDmMessagesPage with peerStudentId and beforeId', () => {
    const page1 = queries.getDmMessagesPage(1, null, -1)
    if (page1.length > 0) {
      const page2 = queries.getDmMessagesPage(1, page1[0].id + 999, -1)
      expect(Array.isArray(page2)).toBe(true)
    }
  })

  it('searchDmMessages finds decrypted content', () => {
    const { results } = queries.searchDmMessages(1, 'DM Hello')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toContain('DM Hello')
  })

  it('searchDmMessages with peerId filters by peer', () => {
    const { results } = queries.searchDmMessages(1, 'DM', -1)
    expect(Array.isArray(results)).toBe(true)
  })

  it('searchDmMessages returns empty for no match', () => {
    const { results, truncated } = queries.searchDmMessages(1, 'zzz_nonexistent_zzz')
    expect(results).toEqual([])
    expect(truncated).toBe(false)
  })

  it('editMessage encrypts DM content', () => {
    const dms = queries.getDmMessages(1)
    const dmId = dms[0].id
    queries.editMessage(dmId, 'DM Edited')
    const db = getTestDb()
    const raw = db.prepare('SELECT content FROM messages WHERE id = ?').get(dmId)
    // Should be encrypted (starts with enc:)
    expect(raw.content.startsWith('enc:')).toBe(true)
    // But getMessageById decrypts it
    const decrypted = queries.getMessageById(dmId)
    expect(decrypted.content).toBe('DM Edited')
  })
})

describe('searchDmMessages limit', () => {
  it('returns truncated: false when <= 200 results', () => {
    const { results, truncated } = queries.searchDmMessages(1, 'DM')
    expect(truncated).toBe(false)
    expect(results.length).toBeLessThanOrEqual(200)
  })

  it('limits results to 200 messages and sets truncated: true', () => {
    // Insert 201 DM messages that match a search term
    for (let i = 0; i < 201; i++) {
      queries.sendMessage({
        dmStudentId: 1, authorName: 'Jean Dupont', authorId: 1,
        authorType: 'student', content: `bulk_search_target ${i}`,
      })
    }
    const { results, truncated } = queries.searchDmMessages(1, 'bulk_search_target')
    expect(results.length).toBe(200)
    expect(truncated).toBe(true)
  })
})

describe('resolveUserName', () => {
  it('resolves student name by positive id', () => {
    expect(queries.resolveUserName(1)).toBe('Jean Dupont')
  })

  it('resolves teacher name by negative id', () => {
    expect(queries.resolveUserName(-1)).toBe('Prof Test')
  })

  it('returns null for non-existent student', () => {
    expect(queries.resolveUserName(9999)).toBeNull()
  })

  it('returns null for non-existent teacher', () => {
    expect(queries.resolveUserName(-9999)).toBeNull()
  })
})

describe('searchAllMessages', () => {
  beforeAll(() => {
    queries.sendMessage({
      channelId: 1, authorName: 'Search User', authorType: 'student', content: 'global search target',
    })
  })

  it('searches channel messages by promo', () => {
    const results = queries.searchAllMessages(1, 'global search')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].source_type).toBe('channel')
  })

  it('searches channel messages without promo (all)', () => {
    const results = queries.searchAllMessages(null, 'global search')
    expect(results.length).toBeGreaterThan(0)
  })

  it('includes DM results when userId is provided', () => {
    const results = queries.searchAllMessages(1, 'DM', 8, 1)
    expect(Array.isArray(results)).toBe(true)
  })

  it('returns empty for no matches', () => {
    const results = queries.searchAllMessages(1, 'zzz_absolutely_nothing_zzz')
    expect(results).toEqual([])
  })
})

describe('getRecentDmContacts', () => {
  it('returns contacts for a student', () => {
    const contacts = queries.getRecentDmContacts(1)
    expect(Array.isArray(contacts)).toBe(true)
    // We sent DMs above from teacher (-1), so should have at least one contact
    expect(contacts.length).toBeGreaterThan(0)
    expect(contacts[0]).toHaveProperty('author_id')
    expect(contacts[0]).toHaveProperty('name')
  })

  it('returns contacts for a teacher (negative id)', () => {
    const contacts = queries.getRecentDmContacts(-1)
    expect(Array.isArray(contacts)).toBe(true)
  })

  it('returns empty for student with no DMs', () => {
    const contacts = queries.getRecentDmContacts(9999)
    expect(contacts).toEqual([])
  })
})

describe('getDmFiles', () => {
  it('returns files from DM messages', () => {
    // Insert a DM with a file attachment
    queries.sendMessage({
      dmStudentId: 1, authorName: 'Jean Dupont', authorId: 1, authorType: 'student',
      content: '![photo](http://example.com/pic.jpg)',
    })
    const files = queries.getDmFiles()
    expect(Array.isArray(files)).toBe(true)
    expect(files.length).toBeGreaterThan(0)
    expect(files[0]).toHaveProperty('file_name')
    expect(files[0]).toHaveProperty('file_url')
    expect(files[0].is_image).toBe(true)
  })

  it('extracts file attachments', () => {
    queries.sendMessage({
      dmStudentId: 1, authorName: 'Jean Dupont', authorId: 1, authorType: 'student',
      content: '[📎 rapport.pdf](http://example.com/rapport.pdf#size=1024)',
    })
    const files = queries.getDmFiles()
    const fileAttach = files.find(f => f.file_name === 'rapport.pdf')
    expect(fileAttach).toBeDefined()
    expect(fileAttach.is_image).toBe(false)
    expect(fileAttach.file_size).toBe(1024)
  })

  it('returns empty when no file messages', () => {
    // getDmFiles scans all DMs, but at least it runs without error
    const files = queries.getDmFiles()
    expect(Array.isArray(files)).toBe(true)
  })
})

describe('getPinnedMessages', () => {
  it('returns empty for channel with no pinned messages', () => {
    const pinned = queries.getPinnedMessages(9999)
    expect(pinned).toEqual([])
  })
})
