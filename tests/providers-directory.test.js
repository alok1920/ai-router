'use strict'

const { KNOWN_PROVIDERS, searchProviders, getProviderByName } = require('../src/providers-directory')

describe('Provider directory', () => {
  test('contains at least 5 providers', () => {
    expect(KNOWN_PROVIDERS.length).toBeGreaterThanOrEqual(5)
  })

  test('searchProviders returns results for groq', () => {
    const results = searchProviders('groq')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name).toBe('Groq')
  })

  test('searchProviders returns results for partial match', () => {
    const results = searchProviders('gem')
    expect(results.some(p => p.name.toLowerCase().includes('gemini'))).toBe(true)
  })

  test('searchProviders returns all when query is empty', () => {
    expect(searchProviders('').length).toBe(KNOWN_PROVIDERS.length)
  })

  test('searchProviders is case-insensitive', () => {
    const lower = searchProviders('claude')
    const upper = searchProviders('CLAUDE')
    expect(lower.length).toBe(upper.length)
  })

  test('getProviderByName finds exact match', () => {
    const p = getProviderByName('Groq')
    expect(p).not.toBeNull()
    expect(p.name).toBe('Groq')
  })

  test('getProviderByName is case-insensitive', () => {
    expect(getProviderByName('groq')).not.toBeNull()
    expect(getProviderByName('GROQ')).not.toBeNull()
  })

  test('getProviderByName returns null for unknown', () => {
    expect(getProviderByName('NonExistentAI9999')).toBeNull()
  })

  test('free providers have no key_env or have key_url', () => {
    const freeProviders = KNOWN_PROVIDERS.filter(p => p.free)
    expect(freeProviders.length).toBeGreaterThan(0)
  })

  test('Ollama is marked as local', () => {
    const ollama = getProviderByName('Ollama')
    expect(ollama).not.toBeNull()
    expect(ollama.local).toBe(true)
  })
})
