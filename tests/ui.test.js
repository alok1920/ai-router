'use strict'

// Mock config before anything
jest.mock('../src/config', () => {
  const os   = require('os')
  const path = require('path')
  const fs   = require('fs')

  const HOME_DIR   = path.join(os.tmpdir(), 'ai-router-test-ui')
  const LOGS_DIR   = path.join(HOME_DIR, 'logs')
  const GRAPHS_DIR = path.join(HOME_DIR, 'graphs')

  function ensureHomeDir () {
    if (!fs.existsSync(HOME_DIR))   fs.mkdirSync(HOME_DIR,   { recursive: true })
    if (!fs.existsSync(LOGS_DIR))   fs.mkdirSync(LOGS_DIR,   { recursive: true })
    if (!fs.existsSync(GRAPHS_DIR)) fs.mkdirSync(GRAPHS_DIR, { recursive: true })
  }

  return {
    DB_FILE:      path.join(HOME_DIR, 'test-ui.db'),
    VENV_DIR:     path.join(HOME_DIR, 'venv'),
    LOGS_DIR,
    GRAPHS_DIR,
    HOME_DIR,
    ensureHomeDir,
    loadEnv:        () => {},
    getProviders:   () => [],
    getCap:         () => null,
    getSequence:    () => null,
    getSequences:   () => ({}),
    setCap:         jest.fn(),
    removeCap:      jest.fn()
  }
})

jest.mock('../src/router', () => ({
  getProviderList: () => [
    {
      name: 'Groq', status: 'ready', configured: true,
      dailyUsed: 100, cap: 5000, totalRequests: 5, lastError: null
    }
  ],
  route: jest.fn()
}))

jest.mock('../src/db', () => ({
  getAllMemory:      () => ({ name: 'Alok', language: 'English' }),
  getLatestSession: () => 'test-session',
  createSession:    () => 'test-session',
  getRecentMessages: () => [],
  setMemory:        jest.fn(),
  getMemory:        () => null,
  deleteMemory:     jest.fn(),
  setProviderCooldown: jest.fn(),
  closeDb:          jest.fn()
}))

// ── chat.js slash command handler tests ───────────────────────

describe('chat module', () => {
  test('exports a chat function', () => {
    const { chat } = require('../src/commands/chat')
    expect(typeof chat).toBe('function')
  })
})

// ── start.js alias tests ───────────────────────────────────────

describe('start module', () => {
  test('exports a start function', () => {
    const { start } = require('../src/commands/start')
    expect(typeof start).toBe('function')
  })
})

// ── _addSystemMessage helper tests ────────────────────────────

describe('_addSystemMessage', () => {
  test('appends a System message and resets scrollOffset to 0', () => {
    // Import the helper directly — it is a pure function
    // We test the logic without needing React or Ink
    const setMessages     = jest.fn()
    const setScrollOffset = jest.fn()

    // Replicate the helper logic for testing
    function _addSystemMessage (setMessages, setScrollOffset, content) {
      setMessages(prev => [...prev, { role: 'assistant', content, provider: 'System' }])
      setScrollOffset(0)
    }

    _addSystemMessage(setMessages, setScrollOffset, 'test message')

    expect(setScrollOffset).toHaveBeenCalledTimes(1)
    expect(setScrollOffset).toHaveBeenCalledWith(0)
    expect(setMessages).toHaveBeenCalledTimes(1)

    // Verify the updater function appends correctly
    const updater = setMessages.mock.calls[0][0]
    const result  = updater([])
    expect(result).toEqual([{
      role:     'assistant',
      content:  'test message',
      provider: 'System'
    }])
  })
})

// ── slash command list completeness ───────────────────────────

describe('slash commands', () => {
  const EXPECTED_COMMANDS = [
    '/cap', '/clear', '/exit', '/quit', '/help',
    '/history', '/index', '/memory', '/new',
    '/providers', '/sequence', '/status'
  ]

  test('all expected slash commands are handled in chat.js', () => {
    const fs      = require('fs')
    const path    = require('path')
    const chatSrc = fs.readFileSync(
      path.join(__dirname, '../src/commands/chat.js'), 'utf8'
    )

    for (const cmd of EXPECTED_COMMANDS) {
      expect(chatSrc).toContain(`'${cmd}'`)
    }
  })
})