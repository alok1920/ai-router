'use strict'

const BaseAdapter = require('./base')

/**
 * GoogleAdapter — covers all Gemini models.
 *
 * Google uses a different SDK and format:
 *   - assistant role is called 'model' not 'assistant'
 *   - history and current message are separate parameters
 *   - system prompt prepended to first user message
 *   - model name is configurable via GEMINI_MODEL env var
 */
class GoogleAdapter extends BaseAdapter {
  constructor (providerConfig) {
    super(providerConfig)
    if (this.isAvailable()) {
      this._initClient()
    }
  }

  _initClient () {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      this.genAI    = new GoogleGenerativeAI(this.getApiKey())
      const model   = process.env.GEMINI_MODEL || this.config.model
      this.model    = this.genAI.getGenerativeModel({ model })
    } catch {
      this.genAI = null
      this.model = null
    }
  }

  async complete (messages, systemPrompt = '') {
    if (!this.isAvailable()) {
      throw new Error(`${this.name}: API key not configured — run: ai-router provider add`)
    }

    if (!this.model) this._initClient()
    if (!this.model) {
      throw new Error(`${this.name}: @google/generative-ai not available — run npm install`)
    }

    const allMessages    = [...messages]
    const currentMessage = allMessages.pop()

    // Build clean history — Gemini requires starting with user role
    const rawHistory = allMessages.filter(m => m.content?.trim())
    const cleanHistory = []
    for (const msg of rawHistory) {
      const last = cleanHistory[cleanHistory.length - 1]
      if (last && last.role === (msg.role === 'assistant' ? 'model' : 'user')) continue
      cleanHistory.push({
        role:  msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })
    }
    // Ensure history starts with user
    if (cleanHistory.length && cleanHistory[0].role !== 'user') {
      cleanHistory.shift()
    }

    const systemPrefix = systemPrompt ? `${systemPrompt}\n\n---\n\n` : ''

    const chat = this.model.startChat({
      history:          cleanHistory,
      generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
    })

    const result   = await chat.sendMessage(systemPrefix + currentMessage.content)
    const response = await result.response
    const text     = response.text()

    const tokenCount = response.usageMetadata?.totalTokenCount ||
                       estimateTokens(text)

    return { text, tokenCount }
  }
}

function estimateTokens (text) {
  return Math.ceil(text.length / 4)
}

module.exports = GoogleAdapter
