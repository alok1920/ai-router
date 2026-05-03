'use strict'

// Mock both providers before requiring router
jest.mock('../src/providers/gemini', () => {
  return jest.fn().mockImplementation(() => ({
    getName: () => 'Gemini Flash',
    isAvailable: () => true,
    complete: jest.fn()
  }))
})

jest.mock('../src/providers/groq', () => {
  return jest.fn().mockImplementation(() => ({
    getName: () => 'Groq',
    isAvailable: () => true,
    complete: jest.fn()
  }))
})

process.chdir(__dirname)
process.env.GEMINI_API_KEY = 'test-gemini-key'
process.env.GROQ_API_KEY = 'test-groq-key'

const db = require('../src/db')
const { route, getProviderList } = require('../src/router')
const GeminiProvider = require('../src/providers/gemini')
const GroqProvider = require('../src/providers/groq')

const fs = require('fs')
const path = require('path')
const TEST_DB = path.join(__dirname, 'test.db')

// Clear provider cooldowns before every test so previous runs don't bleed in
beforeEach(() => {
  db.setProviderCooldown('Gemini Flash', -100000)
  db.setProviderCooldown('Groq', -100000)
})

afterAll(() => {
  db.closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

// ── Failover tests ─────────────────────────────────────────────

describe('Router failover', () => {
  test('uses first available provider on success', async () => {
    const geminiInstance = GeminiProvider.mock.results[0].value
    geminiInstance.complete.mockResolvedValueOnce({
      text: 'Hello from Gemini',
      tokenCount: 10
    })

    const sessionId = db.createSession()
    const result = await route(sessionId, 'hi', '')

    expect(result.provider).toBe('Gemini Flash')
    expect(result.text).toBe('Hello from Gemini')
  })

  test('switches to Groq when Gemini returns rate limit error', async () => {
    const geminiInstance = GeminiProvider.mock.results[0].value
    const groqInstance = GroqProvider.mock.results[0].value

    const rateLimitError = new Error('rate limit exceeded')
    rateLimitError.status = 429
    geminiInstance.complete.mockRejectedValueOnce(rateLimitError)

    groqInstance.complete.mockResolvedValueOnce({
      text: 'Hello from Groq',
      tokenCount: 8
    })

    const sessionId = db.createSession()
    const result = await route(sessionId, 'hi', '')

    expect(result.provider).toBe('Groq')
    expect(result.text).toBe('Hello from Groq')
  })

  test('throws when all providers fail', async () => {
    const geminiInstance = GeminiProvider.mock.results[0].value
    const groqInstance = GroqProvider.mock.results[0].value

    const err = new Error('rate limit')
    err.status = 429
    geminiInstance.complete.mockRejectedValue(err)
    groqInstance.complete.mockRejectedValue(err)

    const sessionId = db.createSession()
    await expect(route(sessionId, 'hi', '')).rejects.toThrow()
  })
})

// ── Provider list tests ────────────────────────────────────────

describe('Provider list', () => {
  test('returns a list of providers with status', () => {
    const list = getProviderList()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
    expect(list[0]).toHaveProperty('name')
    expect(list[0]).toHaveProperty('status')
  })
})