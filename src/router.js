'use strict'

const db      = require('./db')
const logger  = require('./logger')
const cfg     = require('./config')
const {
  getProviders, getCap, getSequence, getProviderStatus: getCfgStatus
} = cfg

const OpenAICompatibleAdapter = require('./adapters/openai-compatible')
const AnthropicAdapter        = require('./adapters/anthropic')
const GoogleAdapter           = require('./adapters/google')

const COOLDOWN_MS = 60 * 1000

const RATE_LIMIT_CODES    = [429, 402, 401]
const RATE_LIMIT_MESSAGES = [
  'rate limit', 'rate_limit', 'quota exceeded',
  'insufficient_quota', 'too many requests', 'resource exhausted'
]

// ── Adapter factory ────────────────────────────────────────────

function createAdapter (providerConfig) {
  switch (providerConfig.type) {
    case 'anthropic':         return new AnthropicAdapter(providerConfig)
    case 'google':            return new GoogleAdapter(providerConfig)
    case 'openai-compatible': return new OpenAICompatibleAdapter(providerConfig)
    default:
      return new OpenAICompatibleAdapter(providerConfig)
  }
}

// ── Load adapters from user config ────────────────────────────

function loadAdapters () {
  cfg.loadEnv()
  const providers = getProviders()
  return providers
    .filter(p => p.enabled !== false)
    .map(p => createAdapter(p))
}

// ── Core routing function ──────────────────────────────────────

async function route (sessionId, userMessage, systemPrompt = '', contextType = 'general') {
  cfg.loadEnv()

  const adapters  = loadAdapters()
  const available = getAvailableAdapters(adapters, contextType)

  if (available.length === 0) {
    throw new Error(
      'No providers available. Add one with: ai-router provider add'
    )
  }

  // Save user message before attempting any provider
  db.saveMessage(sessionId, 'user', userMessage, 'user', 0)

  // Build sliding window context — last 10 messages, summarise older ones
  const history  = db.getRecentMessages(sessionId, 10)
  const messages = history.map(m => ({ role: m.role, content: m.content }))

  for (const adapter of available) {
    const name = adapter.getName()

    if (!adapter.isAvailable()) {
      logger.warn(`${name} skipped — API key not configured`)
      continue
    }

    // Check custom token cap
    const cap = getCap(name)
    if (cap) {
      const dailyUsage = db.getDailyTokenUsage(name)
      if (dailyUsage >= cap.daily_limit) {
        logger.warn(`${name} at daily cap (${dailyUsage}/${cap.daily_limit}) — switching`)
        console.error(`  [${name}] daily cap of ${cap.daily_limit.toLocaleString()} tokens reached — switching`)
        db.setProviderCooldown(name, COOLDOWN_MS)
        continue
      }
    }

    try {
      logger.info(`Attempting ${name}`)
      const response = await adapter.complete(messages, systemPrompt)

      // Success
      db.saveMessage(sessionId, 'assistant', response.text, name, response.tokenCount)
      db.incrementProviderStats(name, response.tokenCount)
      db.recordTokenUsage(name, response.tokenCount)
      db.setProviderError(name, null)

      logger.info(`${name} responded — ${response.tokenCount} tokens`)
      return { text: response.text, provider: name }

    } catch (err) {
      const errMsg = err.message || String(err)
      logger.warn(`${name} failed — ${errMsg}`)
      db.setProviderError(name, errMsg)

      if (isRateLimitError(err)) {
        logger.warn(`${name} rate limited — cooling down 60s`)
        db.setProviderCooldown(name, COOLDOWN_MS)
        console.error(`  [${name}] rate limited — switching to next provider`)
        continue
      }

      console.error(`  [${name}] failed — ${shortenError(errMsg)}`)
      continue
    }
  }

  throw new Error(
    'All providers failed or at cap.\n' +
    '  Check status with: ai-router provider list\n' +
    '  Add a provider with: ai-router provider add'
  )
}

// ── Provider ordering with sequences ──────────────────────────

function getAvailableAdapters (adapters, contextType) {
  const sequence = getSequence(contextType) || getSequence('general')

  // Order by sequence if one exists
  let ordered = adapters
  if (sequence && sequence.length > 0) {
    const inSeq  = sequence
      .map(name => adapters.find(a => a.getName() === name))
      .filter(Boolean)
    const notInSeq = adapters.filter(a => !sequence.includes(a.getName()))
    ordered = [...inSeq, ...notInSeq]
  }

  return ordered.filter(a => !db.isProviderOnCooldown(a.getName()))
}

// ── Provider list for display ──────────────────────────────────

function getProviderList () {
  cfg.loadEnv()
  const providers = getProviders()

  return providers.map(p => {
    const adapter   = createAdapter(p)
    const status    = db.getProviderStatus(p.name)
    const onCooldown = db.isProviderOnCooldown(p.name)
    const cap       = getCap(p.name)
    const dailyUsed = db.getDailyTokenUsage(p.name)
    const configured = adapter.isAvailable()

    let statusText
    if (!configured) {
      statusText = 'not configured'
    } else if (cap && dailyUsed >= cap.daily_limit) {
      statusText = `at daily cap (${dailyUsed.toLocaleString()}/${cap.daily_limit.toLocaleString()} tokens)`
    } else if (onCooldown) {
      const rem = Math.ceil((status.cooldown_until - Date.now()) / 1000)
      statusText = `cooling down (${rem}s remaining)`
    } else {
      statusText = 'ready'
    }

    return {
      name:          p.name,
      type:          p.type,
      status:        statusText,
      totalRequests: status.total_requests,
      totalTokens:   status.total_tokens,
      dailyUsed,
      cap:           cap ? cap.daily_limit : null,
      lastError:     status.last_error,
      configured
    }
  })
}

// ── Error helpers ──────────────────────────────────────────────

function isRateLimitError (err) {
  const code = err.status || err.statusCode || err.code
  if (RATE_LIMIT_CODES.includes(code)) return true
  const msg = (err.message || '').toLowerCase()
  return RATE_LIMIT_MESSAGES.some(p => msg.includes(p))
}

function shortenError (msg) {
  if (msg.includes('404'))                                return 'model not found — name may have changed'
  if (msg.includes('401') || msg.includes('api key'))     return 'invalid API key — run: ai-router provider update'
  if (msg.includes('429') || msg.includes('rate limit'))  return 'rate limit hit'
  if (msg.includes('decommissioned'))                     return 'model decommissioned — run: ai-router provider update'
  return msg.slice(0, 80)
}

module.exports = { route, getProviderList, loadAdapters, createAdapter }
