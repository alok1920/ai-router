'use strict'

const BaseAdapter             = require('../src/adapters/base')
const OpenAICompatibleAdapter = require('../src/adapters/openai-compatible')
const AnthropicAdapter        = require('../src/adapters/anthropic')
const GoogleAdapter           = require('../src/adapters/google')

describe('BaseAdapter', () => {
  test('getName returns provider name', () => {
    const adapter = new BaseAdapter({ name: 'TestProvider', type: 'openai-compatible' })
    expect(adapter.getName()).toBe('TestProvider')
  })

  test('isAvailable returns false when no key', () => {
    const adapter = new BaseAdapter({ name: 'Test', type: 'openai-compatible', key_env: 'NONEXISTENT_KEY_9999' })
    delete process.env.NONEXISTENT_KEY_9999
    expect(adapter.isAvailable()).toBe(false)
  })

  test('isAvailable returns true for local providers', () => {
    const adapter = new BaseAdapter({ name: 'Ollama', type: 'openai-compatible', local: true })
    expect(adapter.isAvailable()).toBe(true)
  })

  test('complete throws not implemented', async () => {
    const adapter = new BaseAdapter({ name: 'Test', type: 'openai-compatible' })
    await expect(adapter.complete([])).rejects.toThrow('not implemented')
  })
})

describe('OpenAICompatibleAdapter', () => {
  test('throws when API key not configured', async () => {
    delete process.env.TEST_KEY_OPENAI_9999
    const adapter = new OpenAICompatibleAdapter({
      name:     'TestOpenAI',
      type:     'openai-compatible',
      endpoint: 'https://api.test.com/v1',
      model:    'test-model',
      key_env:  'TEST_KEY_OPENAI_9999'
    })
    await expect(adapter.complete([{ role: 'user', content: 'hi' }]))
      .rejects.toThrow('API key not configured')
  })

  test('local provider is available without key', () => {
    const adapter = new OpenAICompatibleAdapter({
      name:     'Ollama',
      type:     'openai-compatible',
      endpoint: 'http://localhost:11434/v1',
      model:    'llama3',
      local:    true
    })
    expect(adapter.isAvailable()).toBe(true)
  })
})

describe('AnthropicAdapter', () => {
  test('throws when API key not configured', async () => {
    delete process.env.TEST_ANTHROPIC_KEY_9999
    const adapter = new AnthropicAdapter({
      name:    'Claude',
      type:    'anthropic',
      model:   'claude-3-5-haiku-20241022',
      key_env: 'TEST_ANTHROPIC_KEY_9999'
    })
    await expect(adapter.complete([{ role: 'user', content: 'hi' }]))
      .rejects.toThrow('API key not configured')
  })
})

describe('GoogleAdapter', () => {
  test('throws when API key not configured', async () => {
    delete process.env.TEST_GOOGLE_KEY_9999
    const adapter = new GoogleAdapter({
      name:    'Gemini',
      type:    'google',
      model:   'gemini-2.5-flash',
      key_env: 'TEST_GOOGLE_KEY_9999'
    })
    await expect(adapter.complete([{ role: 'user', content: 'hi' }]))
      .rejects.toThrow('API key not configured')
  })
})
