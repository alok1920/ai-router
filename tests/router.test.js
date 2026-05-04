'use strict'

// Shared mock complete functions — used by every adapter instance
const mockGeminiComplete = jest.fn()
const mockGroqComplete   = jest.fn()

// Mock config before anything else
jest.mock('../src/config', () => {
  const os   = require('os')
  const path = require('path')
  const fs   = require('fs')

  const HOME_DIR   = path.join(os.tmpdir(), 'ai-router-test-router')
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
    loadEnv:        () => {},
    getProviders:   () => [
      { name: 'Gemini Flash', type: 'google',            key_env: 'GEMINI_API_KEY', model: 'test', enabled: true },
      { name: 'Groq',         type: 'openai-compatible', key_env: 'GROQ_API_KEY',   model: 'test', endpoint: 'http://test.com/v1', enabled: true }
    ],
    getCap:         () => null,
    getSequence:    () => null
  }
})

// Mock adapters — every instance uses the shared mock functions above
jest.mock('../src/adapters/google', () => {
  return jest.fn().mockImplementation(() => ({
    getName:     () => 'Gemini Flash',
    isAvailable: () => true,
    complete:    (...args) => mockGeminiComplete(...args)
  }))
})

jest.mock('../src/adapters/openai-compatible', () => {
  return jest.fn().mockImplementation(() => ({
    getName:     () => 'Groq',
    isAvailable: () => true,
    complete:    (...args) => mockGroqComplete(...args)
  }))
})

jest.mock('../src/adapters/anthropic', () => {
  return jest.fn().mockImplementation(() => ({
    getName:     () => 'Claude',
    isAvailable: () => false,
    complete:    jest.fn()
  }))
})

process.env.GEMINI_API_KEY = 'test-gemini-key'
process.env.GROQ_API_KEY   = 'test-groq-key'

const db = require('../src/db')
const { route, getProviderList } = require('../src/router')

// Reset shared mocks and clear cooldowns before every test
beforeEach(() => {
  mockGeminiComplete.mockReset()
  mockGroqComplete.mockReset()
  db.setProviderCooldown('Gemini Flash', -100000)
  db.setProviderCooldown('Groq',         -100000)
})

afterAll(() => {
  db.closeDb()
})

// ── Failover tests ─────────────────────────────────────────────

describe('Router failover', () => {
  test('uses first available provider on success', async () => {
    mockGeminiComplete.mockResolvedValueOnce({
      text: 'Hello from Gemini', tokenCount: 10
    })

    const sessionId = db.createSession()
    const result    = await route(sessionId, 'hi', '')

    expect(result.provider).toBe('Gemini Flash')
    expect(result.text).toBe('Hello from Gemini')
  })

  test('switches to Groq when Gemini returns rate limit error', async () => {
    const rateLimitError  = new Error('rate limit exceeded')
    rateLimitError.status = 429
    mockGeminiComplete.mockRejectedValueOnce(rateLimitError)
    mockGroqComplete.mockResolvedValueOnce({
      text: 'Hello from Groq', tokenCount: 8
    })

    const sessionId = db.createSession()
    const result    = await route(sessionId, 'hi', '')

    expect(result.provider).toBe('Groq')
    expect(result.text).toBe('Hello from Groq')
  })

  test('throws when all providers fail', async () => {
    const err    = new Error('rate limit')
    err.status   = 429
    mockGeminiComplete.mockRejectedValue(err)
    mockGroqComplete.mockRejectedValue(err)

    const sessionId = db.createSession()
    await expect(route(sessionId, 'hi', '')).rejects.toThrow()
  })
})

// ── Provider list tests ────────────────────────────────────────

describe('Provider list', () => {
  test('returns a list of providers with name and status', () => {
    const list = getProviderList()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
    expect(list[0]).toHaveProperty('name')
    expect(list[0]).toHaveProperty('status')
  })
})