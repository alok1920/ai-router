'use strict'

/**
 * Built-in provider directory.
 *
 * Users search this list by name in: ai-router provider add
 * Matching entries have endpoints and models pre-filled.
 * User only needs to paste their API key.
 *
 * Add new providers here as they become available.
 */
const KNOWN_PROVIDERS = [
  {
    name:        'Gemini Flash',
    search_tags: ['gemini', 'google', 'flash'],
    type:        'google',
    model:       'gemini-2.5-flash',
    key_env:     'GEMINI_API_KEY',
    free:        true,
    key_url:     'https://aistudio.google.com/apikey',
    description: 'Google Gemini Flash — free tier, 1500 req/day'
  },
  {
    name:        'Groq',
    search_tags: ['groq', 'llama', 'fast'],
    type:        'openai-compatible',
    endpoint:    'https://api.groq.com/openai/v1',
    model:       process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    key_env:     'GROQ_API_KEY',
    free:        true,
    key_url:     'https://console.groq.com/keys',
    description: 'Groq — free tier, fast inference'
  },
  {
    name:        'Claude',
    search_tags: ['claude', 'anthropic', 'haiku', 'sonnet', 'opus'],
    type:        'anthropic',
    model:       'claude-3-5-haiku-20241022',
    key_env:     'ANTHROPIC_API_KEY',
    free:        false,
    key_url:     'https://console.anthropic.com',
    description: 'Anthropic Claude — paid, per token'
  },
  {
    name:        'OpenAI GPT',
    search_tags: ['openai', 'gpt', 'chatgpt', 'gpt4', 'gpt-4o'],
    type:        'openai-compatible',
    endpoint:    'https://api.openai.com/v1',
    model:       'gpt-4o-mini',
    key_env:     'OPENAI_API_KEY',
    free:        false,
    key_url:     'https://platform.openai.com/api-keys',
    description: 'OpenAI GPT — paid, per token'
  },
  {
    name:        'Mistral',
    search_tags: ['mistral', 'mistral-large', 'mixtral'],
    type:        'openai-compatible',
    endpoint:    'https://api.mistral.ai/v1',
    model:       'mistral-large-latest',
    key_env:     'MISTRAL_API_KEY',
    free:        false,
    key_url:     'https://console.mistral.ai',
    description: 'Mistral AI — paid, per token'
  },
  {
    name:        'Perplexity',
    search_tags: ['perplexity', 'pplx', 'sonar'],
    type:        'openai-compatible',
    endpoint:    'https://api.perplexity.ai',
    model:       'llama-3.1-sonar-large-128k-online',
    key_env:     'PERPLEXITY_API_KEY',
    free:        false,
    key_url:     'https://www.perplexity.ai/settings/api',
    description: 'Perplexity — online search-augmented AI'
  },
  {
    name:        'Ollama',
    search_tags: ['ollama', 'local', 'llama', 'offline'],
    type:        'openai-compatible',
    endpoint:    'http://localhost:11434/v1',
    model:       null,           // asked interactively — user picks their pulled model
    key_env:     null,
    local:       true,
    free:        true,
    description: 'Ollama — runs locally on your machine, no API key needed'
  },
  {
    name:        'LM Studio',
    search_tags: ['lmstudio', 'lm studio', 'lm-studio', 'local'],
    type:        'openai-compatible',
    endpoint:    'http://localhost:1234/v1',
    model:       null,           // asked interactively
    key_env:     null,
    local:       true,
    free:        true,
    description: 'LM Studio — runs locally on your machine, no API key needed'
  }
]

/**
 * Search the directory by name or tag.
 * Returns ranked results — exact matches first, partial matches second.
 */
function searchProviders (query) {
  if (!query) return KNOWN_PROVIDERS

  const q = query.toLowerCase().trim()

  const exact   = KNOWN_PROVIDERS.filter(p =>
    p.name.toLowerCase() === q ||
    p.search_tags.includes(q)
  )

  const partial = KNOWN_PROVIDERS.filter(p =>
    !exact.includes(p) && (
      p.name.toLowerCase().includes(q) ||
      p.search_tags.some(t => t.includes(q) || q.includes(t))
    )
  )

  return [...exact, ...partial]
}

function getProviderByName (name) {
  return KNOWN_PROVIDERS.find(
    p => p.name.toLowerCase() === name.toLowerCase()
  ) || null
}

module.exports = { KNOWN_PROVIDERS, searchProviders, getProviderByName }
