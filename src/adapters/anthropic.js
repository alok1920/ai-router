'use strict'

const BaseAdapter = require('./base')

/**
 * AnthropicAdapter — covers all Claude models.
 *
 * Anthropic uses a different API format from OpenAI:
 *   - system prompt is a separate top-level field
 *   - response is content[0].text not choices[0].message.content
 *   - role is 'user' / 'assistant' (same as normalized)
 */
class AnthropicAdapter extends BaseAdapter {
  constructor (providerConfig) {
    super(providerConfig)
    if (this.isAvailable()) {
      this._initClient()
    }
  }

  _initClient () {
    try {
      const Anthropic = require('@anthropic-ai/sdk')
      this.client = new Anthropic({ apiKey: this.getApiKey() })
    } catch {
      this.client = null
    }
  }

  async complete (messages, systemPrompt = '') {
    if (!this.isAvailable()) {
      throw new Error(`${this.name}: API key not configured — run: ai-router provider add`)
    }

    if (!this.client) this._initClient()
    if (!this.client) {
      throw new Error(`${this.name}: @anthropic-ai/sdk not available — run npm install`)
    }

    const response = await this.client.messages.create({
      model:      this.config.model,
      max_tokens: 8192,
      system:     systemPrompt || undefined,
      messages:   messages.map(m => ({ role: m.role, content: m.content }))
    })

    const text       = response.content[0]?.text || ''
    const tokenCount = (response.usage?.input_tokens || 0) +
                       (response.usage?.output_tokens || 0)

    return { text, tokenCount }
  }
}

module.exports = AnthropicAdapter
