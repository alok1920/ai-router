'use strict'

const path = require('path')
const fs = require('fs')

// Use a separate test database — never the real one
process.env.NODE_ENV = 'test'

// Point to test db before requiring db module
const TEST_DB_PATH = path.join(__dirname, 'test.db')
process.chdir(__dirname)

const db = require('../src/db')

afterAll(() => {
  db.closeDb()
  // Clean up test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH)
  }
})

// ── Session tests ──────────────────────────────────────────────

describe('Sessions', () => {
  test('creates a new session and returns an ID', () => {
    const id = db.createSession()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  test('getLatestSession returns most recent session', () => {
    const id = db.createSession()
    const latest = db.getLatestSession()
    expect(latest).toBe(id)
  })
})

// ── Message tests ──────────────────────────────────────────────

describe('Messages', () => {
  test('saves a user message and retrieves it', () => {
    const sessionId = db.createSession()
    db.saveMessage(sessionId, 'user', 'Hello world', 'user', 5)

    const messages = db.getRecentMessages(sessionId, 10)
    expect(messages.length).toBe(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('Hello world')
  })

  test('saves assistant message with provider metadata', () => {
    const sessionId = db.createSession()
    db.saveMessage(sessionId, 'user', 'question', 'user', 2)
    db.saveMessage(sessionId, 'assistant', 'answer', 'Gemini Flash', 10)

    const messages = db.getRecentMessages(sessionId, 10)
    expect(messages.length).toBe(2)
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].provider_used).toBe('Gemini Flash')
  })

  test('role is always user or assistant — never a provider name', () => {
    const sessionId = db.createSession()
    db.saveMessage(sessionId, 'assistant', 'response', 'Groq', 8)

    const messages = db.getRecentMessages(sessionId, 10)
    const lastMsg = messages[messages.length - 1]
    expect(lastMsg.role).toBe('assistant')
    expect(lastMsg.role).not.toBe('Groq')
  })
})

// ── Memory tests ───────────────────────────────────────────────

describe('Memory', () => {
  test('sets and retrieves a memory value', () => {
    db.setMemory('language', 'Hindi')
    const value = db.getMemory('language')
    expect(value).toBe('Hindi')
  })

  test('updates existing memory key', () => {
    db.setMemory('tone', 'formal')
    db.setMemory('tone', 'casual')
    const value = db.getMemory('tone')
    expect(value).toBe('casual')
  })

  test('getAllMemory returns all key-value pairs', () => {
    db.setMemory('expertise', 'intermediate')
    const mem = db.getAllMemory()
    expect(mem).toHaveProperty('expertise', 'intermediate')
  })

  test('deleteMemory removes a key', () => {
    db.setMemory('temp_key', 'temp_value')
    db.deleteMemory('temp_key')
    const value = db.getMemory('temp_key')
    expect(value).toBeNull()
  })

  test('memory persists — value survives multiple get calls', () => {
    db.setMemory('persistent', 'yes')
    expect(db.getMemory('persistent')).toBe('yes')
    expect(db.getMemory('persistent')).toBe('yes')
    expect(db.getMemory('persistent')).toBe('yes')
  })
})
