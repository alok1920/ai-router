'use strict'

const BaseAdapter = require('./base')

/**
 * OpenAICompatibleAdapter
 *
 * Covers every provider that uses the OpenAI message format:
 *   Groq, OpenAI GPT, Mistral, Together AI, Perplexity,
 *   Ollama (local), LM Studio (local), any custom HTTP endpoint
 *
 * User adds any of these via: ai-router provider add
 * No code changes ever needed.
 */
class OpenAICompatibleAdapter extends BaseAdapter {
  constructor (providerConfig) {
    super(providerConfig)
    if (this.isAvailable()) {
      this._initClient()
    }
  }

  _initClient () {
    // Lazy import openai — only loaded if provider is configured
    try {
      const OpenAI = require('openai')
      this.client = new OpenAI({
        apiKey:  this.getApiKey() || 'local',
        baseURL: this.config.endpoint
      })
    } catch {
      this.client = null
    }
  }

  async complete (messages, systemPrompt = '') {
    if (!this.isAvailable()) {
      throw new Error(`${this.name}: API key not configured`)
    }

    if (!this.client) this._initClient()
    if (!this.client) {
      throw new Error(`${this.name}: openai SDK not available — run npm install`)
    }

    const formattedMessages = []

    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt })
    }

    for (const msg of messages) {
      formattedMessages.push({ role: msg.role, content: msg.content })
    }

    const completion = await this.client.chat.completions.create({
      model:       this.config.model,
      messages:    formattedMessages,
      max_tokens:  8192,
      temperature: 0.7
    })

    const text       = completion.choices[0]?.message?.content || ''
    const tokenCount = completion.usage?.total_tokens || estimateTokens(text)

    return { text, tokenCount }
  }
}

function estimateTokens (text) {
  return Math.ceil(text.length / 4)
}

module.exports = OpenAICompatibleAdapter
