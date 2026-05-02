'use strict'

const Groq = require('groq-sdk')
const BaseProvider = require('./base')

class GroqProvider extends BaseProvider {
  constructor (apiKey) {
    super('Groq', apiKey)
    if (this.isAvailable()) {
      this.client = new Groq({ apiKey })
    }
  }

  async complete (messages, systemPrompt = '') {
    if (!this.isAvailable()) {
      throw new Error('Groq API key not configured')
    }

    // Groq uses OpenAI-compatible format — straightforward
    const formattedMessages = []

    // Inject system prompt as first message if it exists
    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt
      })
    }

    // Add conversation history — roles are already normalized
    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role,     // already 'user' or 'assistant'
        content: msg.content
      })
    }

    const completion = await this.client.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: formattedMessages,
      max_tokens: 8192,
      temperature: 0.7
    })

    const text = completion.choices[0]?.message?.content || ''
    const tokenCount = completion.usage?.total_tokens || estimateTokens(text)

    return { text, tokenCount }
  }
}

function estimateTokens (text) {
  return Math.ceil(text.length / 4)
}

module.exports = GroqProvider
