'use strict'

/**
 * BaseAdapter — standard interface every provider adapter must follow.
 *
 * Three adapter types cover every provider in existence:
 *   openai-compatible.js  → Groq, Mistral, Ollama, GPT, custom LLMs
 *   anthropic.js          → all Claude models
 *   google.js             → all Gemini models
 *
 * User-configured providers from config.json are loaded at runtime
 * and wrapped in the correct adapter automatically.
 */
class BaseAdapter {
  constructor (providerConfig) {
    this.config = providerConfig
    this.name   = providerConfig.name
  }

  getName ()      { return this.name }
  getType ()      { return this.config.type }

  isAvailable () {
    // Local providers (Ollama, LM Studio) don't need a key
    if (this.config.local) return true
    const key = this.getApiKey()
    return Boolean(key && key.trim().length > 0)
  }

  getApiKey () {
    if (this.config.local) return 'local'
    const envVar = this.config.key_env
    return envVar ? (process.env[envVar] || null) : null
  }

  /**
   * complete — send messages and return response
   * @param {Array}  messages     [{role, content}] — normalized
   * @param {string} systemPrompt — memory + context injected here
   * @returns {Object} { text: string, tokenCount: number }
   */
  async complete (messages, systemPrompt = '') {
    throw new Error(`complete() not implemented in adapter: ${this.name}`)
  }
}

module.exports = BaseAdapter
