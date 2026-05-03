'use strict'

const { GoogleGenerativeAI } = require('@google/generative-ai')
const BaseProvider = require('./base')

// Model name is configurable via .env so you never need to change code
// when Google updates their model names
const DEFAULT_MODEL = 'gemini-2.5-flash'

class GeminiProvider extends BaseProvider {
  constructor (apiKey) {
    super('Gemini Flash', apiKey)
    if (this.isAvailable()) {
      this.client = new GoogleGenerativeAI(apiKey)
      this.modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL
      this.model = this.client.getGenerativeModel({
        model: this.modelName
      })
    }
  }

  async complete (messages, systemPrompt = '') {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured')
    }

    const history = []
    const allMessages = [...messages]
    const currentMessage = allMessages.pop()

    // Gemini requires history to start with 'user' role
    // Filter out any leading assistant messages from corrupted sessions
    const validHistory = allMessages.filter((msg, index) => {
      if (index === 0 && msg.role === 'assistant') return false
      return msg.content && msg.content.trim().length > 0
    })

    // Ensure history alternates correctly — if two consecutive same roles exist, skip the first
    const cleanHistory = []
    for (const msg of validHistory) {
      const last = cleanHistory[cleanHistory.length - 1]
      if (last && last.role === msg.role) continue
      cleanHistory.push(msg)
    }

    for (const msg of cleanHistory) {
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })
    }

    const systemPrefix = systemPrompt
      ? `${systemPrompt}\n\n---\n\n`
      : ''

    const chat = this.model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7
      }
    })

    const result = await chat.sendMessage(systemPrefix + currentMessage.content)
    const response = await result.response
    const text = response.text()

    const tokenCount = response.usageMetadata
      ? (response.usageMetadata.totalTokenCount || 0)
      : estimateTokens(text)

    return { text, tokenCount }
  }
}

function estimateTokens (text) {
  return Math.ceil(text.length / 4)
}

module.exports = GeminiProvider