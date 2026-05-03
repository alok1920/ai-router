'use strict'

const Groq = require('groq-sdk')
const BaseProvider = require('./base')

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

class GroqProvider extends BaseProvider {
  constructor (apiKey) {
    super('Groq', apiKey)
    if (this.isAvailable()) {
      this.client = new Groq({ apiKey })
      this.modelName = process.env.GROQ_MODEL || DEFAULT_MODEL
    }
  }

  async complete (messages, systemPrompt = '') {
    if (!this.isAvailable()) {
      throw new Error('Groq API key not configured')
    }

    const formattedMessages = []

    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt
      })
    }

    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role,
        content: msg.content
      })
    }

    const completion = await this.client.chat.completions.create({
      model: this.modelName,
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