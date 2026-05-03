'use strict'

require('dotenv').config()

const db = require('./db')
const logger = require('./logger')
const GeminiProvider = require('./providers/gemini')
const GroqProvider = require('./providers/groq')

// ── Provider registry ──────────────────────────────────────────
// Order matters — first available provider in this list is tried first
// Free tier providers come first to minimise cost
const PROVIDERS = [
  new GeminiProvider(process.env.GEMINI_API_KEY),
  new GroqProvider(process.env.GROQ_API_KEY)
]

// Cooldown duration when a provider hits a rate limit (60 seconds)
const COOLDOWN_MS = 60 * 1000

// Error codes and messages that trigger a provider switch
const RATE_LIMIT_CODES = [429, 402, 401]
const RATE_LIMIT_MESSAGES = [
  'rate limit',
  'rate_limit',
  'quota exceeded',
  'insufficient_quota',
  'too many requests',
  'resource exhausted'
]

// ── Core routing function ──────────────────────────────────────

/**
 * route — sends a message through the router
 *
 * Tries providers in order. On rate limit or auth error,
 * puts the provider on cooldown and tries the next one.
 * Saves both the user message and assistant response to SQLite.
 *
 * @param {string} sessionId — current session ID
 * @param {string} userMessage — the user's input
 * @param {string} systemPrompt — injected memory + context
 * @returns {Object} { text, provider } — response and who answered
 */
async function route (sessionId, userMessage, systemPrompt = '') {
  const available = getAvailableProviders()

  if (available.length === 0) {
    const msg = 'All providers are on cooldown. Try again in a moment.'
    logger.warn('All providers on cooldown')
    throw new Error(msg)
  }

  // Save user message before attempting any provider
  db.saveMessage(sessionId, 'user', userMessage, 'user', 0)

  // Get recent conversation history for context
  const history = db.getRecentMessages(sessionId, 10)

  // Build normalized messages array — only role + content, nothing else
  const messages = history.map(msg => ({
    role: msg.role,
    content: msg.content
  }))

  for (const provider of available) {
    const name = provider.getName()

    if (!provider.isAvailable()) {
      logger.warn(`${name} skipped — API key not configured`)
      continue
    }

    try {
      logger.info(`Attempting ${name}`)
      const response = await provider.complete(messages, systemPrompt)

      // Success — save response and update stats
      db.saveMessage(sessionId, 'assistant', response.text, name, response.tokenCount)
      db.incrementProviderStats(name, response.tokenCount)

      logger.info(`${name} responded — ${response.tokenCount} tokens`)
      return { text: response.text, provider: name }

    } catch (err) {
      logger.warn(`${name} failed — ${err.message}`)
      db.setProviderError(name, err.message)

      if (isRateLimitError(err)) {
        logger.warn(`${name} rate limited — cooling down for 60s`)
        db.setProviderCooldown(name, COOLDOWN_MS)
        continue  // try next provider
      }

      // Non-rate-limit error — still try next provider but log differently
      logger.error(`${name} unexpected error — ${err.message}`)
      continue
    }
  }

  throw new Error(
    'All providers failed. Check your API keys with: ai-router providers'
  )
}

// ── Provider availability ──────────────────────────────────────

function getAvailableProviders () {
  return PROVIDERS.filter(provider => {
    const name = provider.getName()
    return !db.isProviderOnCooldown(name)
  })
}

function getProviderList () {
  return PROVIDERS.map(provider => {
    const name = provider.getName()
    const status = db.getProviderStatus(name)
    const onCooldown = db.isProviderOnCooldown(name)
    const configured = provider.isAvailable()

    let statusText
    if (!configured)   statusText = 'not configured'
    else if (onCooldown) {
      const remainingSec = Math.ceil((status.cooldown_until - Date.now()) / 1000)
      statusText = `cooling down (${remainingSec}s remaining)`
    } else statusText = 'ready'

    return {
      name,
      status: statusText,
      totalRequests: status.total_requests,
      totalTokens: status.total_tokens,
      lastError: status.last_error,
      configured
    }
  })
}

// ── Error classification ───────────────────────────────────────

function isRateLimitError (err) {
  const statusCode = err.status || err.statusCode || err.code
  if (RATE_LIMIT_CODES.includes(statusCode)) return true

  const message = (err.message || '').toLowerCase()
  return RATE_LIMIT_MESSAGES.some(phrase => message.includes(phrase))
}

module.exports = { route, getProviderList, getAvailableProviders }
