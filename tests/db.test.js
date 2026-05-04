'use strict'

const os   = require('os')
const path = require('path')
const fs   = require('fs')

// Override DB_FILE before requiring db module
const TEST_DB = path.join(os.tmpdir(), `ai-router-db-test-${Date.now()}.db`)

jest.mock('../src/config', () => {
  const os   = require('os')
  const path = require('path')
  const fs   = require('fs')

  const HOME_DIR   = path.join(os.tmpdir(), 'ai-router-test-db')
  const LOGS_DIR   = path.join(HOME_DIR, 'logs')
  const GRAPHS_DIR = path.join(HOME_DIR, 'graphs')

  function ensureHomeDir () {
    if (!fs.existsSync(HOME_DIR))   fs.mkdirSync(HOME_DIR,   { recursive: true })
    if (!fs.existsSync(LOGS_DIR))   fs.mkdirSync(LOGS_DIR,   { recursive: true })
    if (!fs.existsSync(GRAPHS_DIR)) fs.mkdirSync(GRAPHS_DIR, { recursive: true })
  }

  return {
    DB_FILE:      path.join(HOME_DIR, 'test-memory.db'),
    LOGS_DIR,
    GRAPHS_DIR,
    HOME_DIR,
    ensureHomeDir,
    loadEnv: () => {}
  }
})

const db = require('../src/db')

afterAll(() => {
  db.closeDb()
})

// ── Session tests ──────────────────────────────────────────────

describe('Sessions', () => {
  test('creates a new session and returns an ID', () => {
    const id = db.createSession()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  test('getLatestSession returns most recent session', () => {
    const id     = db.createSession()
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
    db.saveMessage(sessionId, 'user',      'question', 'user',         2)
    db.saveMessage(sessionId, 'assistant', 'answer',   'Gemini Flash', 10)

    const messages = db.getRecentMessages(sessionId, 10)
    expect(messages.length).toBe(2)
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].provider_used).toBe('Gemini Flash')
  })

  test('role is always user or assistant — never a provider name', () => {
    const sessionId = db.createSession()
    db.saveMessage(sessionId, 'assistant', 'response', 'Groq', 8)

    const messages = db.getRecentMessages(sessionId, 10)
    const last = messages[messages.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.role).not.toBe('Groq')
  })
})

// ── Memory tests ───────────────────────────────────────────────

describe('Memory', () => {
  test('sets and retrieves a memory value', () => {
    db.setMemory('language', 'Hindi')
    expect(db.getMemory('language')).toBe('Hindi')
  })

  test('updates existing memory key', () => {
    db.setMemory('tone', 'formal')
    db.setMemory('tone', 'casual')
    expect(db.getMemory('tone')).toBe('casual')
  })

  test('getAllMemory returns all key-value pairs', () => {
    db.setMemory('expertise', 'intermediate')
    const mem = db.getAllMemory()
    expect(mem).toHaveProperty('expertise', 'intermediate')
  })

  test('deleteMemory removes a key', () => {
    db.setMemory('temp_key', 'temp_value')
    db.deleteMemory('temp_key')
    expect(db.getMemory('temp_key')).toBeNull()
  })
})

// ── Token usage tests ──────────────────────────────────────────

describe('Token usage', () => {
  test('records and retrieves daily token usage', () => {
    db.recordTokenUsage('TestProvider', 500)
    db.recordTokenUsage('TestProvider', 300)
    const total = db.getDailyTokenUsage('TestProvider')
    expect(total).toBeGreaterThanOrEqual(800)
  })

  test('unknown provider returns zero', () => {
    expect(db.getDailyTokenUsage('NonExistentProvider9999')).toBe(0)
  })
})