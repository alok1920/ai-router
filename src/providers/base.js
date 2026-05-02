'use strict'

/**
 * BaseProvider — the standard interface every provider must follow.
 *
 * Every provider (Gemini, Groq, Claude, OpenAI, custom LLMs)
 * extends this class and implements the same three methods.
 *
 * The router only ever calls these three methods — it does not
 * care what is behind them. Cloud model, local model, anything
 * with an HTTP endpoint works the same way.
 */
class BaseProvider {
  constructor (name, apiKey) {
    if (!name) throw new Error('Provider must have a name')
    this.name = name
    this.apiKey = apiKey
  }

  /**
   * getName — returns the provider's identifier string
   * Used by the router for logging and status display
   */
  getName () {
    return this.name
  }

  /**
   * isAvailable — checks if this provider can accept requests
   * Returns false if API key is missing
   * Router uses this before attempting a call
   */
  isAvailable () {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0)
  }

  /**
   * complete — sends messages to the provider and returns a response
   *
   * @param {Array} messages — normalized message array
   *   Each message: { role: 'user' | 'assistant', content: string }
   *   role is ALWAYS user or assistant — never a provider name
   *
   * @param {string} systemPrompt — the injected memory + context
   *
   * @returns {Object} — normalized response
   *   { text: string, tokenCount: number }
   *
   * Throws an error on failure — the router catches this
   * and decides whether to retry with another provider
   */
  async complete (messages, systemPrompt = '') {
    throw new Error(`complete() not implemented in provider: ${this.name}`)
  }
}

module.exports = BaseProvider
