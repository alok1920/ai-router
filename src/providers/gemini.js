'use strict'

const { GoogleGenerativeAI } = require('@google/generative-ai')
const BaseProvider = require('./base')

class GeminiProvider extends BaseProvider {
  constructor (apiKey) {
    super('Gemini Flash', apiKey)
    if (this.isAvailable()) {
      this.client = new GoogleGenerativeAI(apiKey)
      this.model = this.client.getGenerativeModel({
        model: 'gemini-1.5-flash'
      })
    }
  }

  async complete (messages, systemPrompt = '') {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured')
    }

    // Gemini uses a different format — build history and current message
    const history = []
    const allMessages = [...messages]

    // Separate all but the last message into history
    // Last message is the current user turn
    const currentMessage = allMessages.pop()

    for (const msg of allMessages) {
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })
    }

    // Build system instruction prefix if memory exists
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

    // Gemini returns usage metadata
    const tokenCount = response.usageMetadata
      ? (response.usageMetadata.totalTokenCount || 0)
      : estimateTokens(text)

    return { text, tokenCount }
  }
}

// Rough token estimator as fallback (1 token ≈ 4 characters)
function estimateTokens (text) {
  return Math.ceil(text.length / 4)
}

module.exports = GeminiProvider
