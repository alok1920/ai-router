'use strict'

/**
 * Auto endpoint detector.
 *
 * When a user adds a provider not in the built-in directory,
 * we try common URL patterns before asking them for a URL.
 * Covers 95% of real providers without user needing to know
 * what "OpenAI-compatible" means.
 */

// Common URL patterns tried in order
function buildCandidateUrls (name) {
  const n = name.toLowerCase().replace(/\s+/g, '')
  return [
    `https://api.${n}.ai/v1`,
    `https://api.${n}.com/v1`,
    `https://${n}.openai.azure.com/openai/deployments`,
    `https://api.${n}.io/v1`,
    `https://${n}-api.com/v1`
  ]
}

/**
 * Try to detect the endpoint for an unknown provider.
 * Sends a minimal test request to each candidate URL.
 *
 * @param {string} name    — provider name the user typed
 * @param {string} apiKey  — their API key
 * @returns {string|null}  — working endpoint URL or null
 */
async function detectEndpoint (name, apiKey) {
  const candidates = buildCandidateUrls(name)

  for (const url of candidates) {
    const works = await testEndpoint(url, apiKey)
    if (works) return url
  }

  return null
}

/**
 * Test if an OpenAI-compatible endpoint responds correctly.
 * Uses a minimal models list call — cheapest possible test.
 */
async function testEndpoint (baseUrl, apiKey) {
  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeout)

    // 200 or 401 both mean the endpoint exists
    // 401 = endpoint real but key wrong — still a valid endpoint
    return res.status === 200 || res.status === 401

  } catch {
    return false
  }
}

/**
 * Test a specific configured provider.
 * Sends a tiny real chat request to verify key + endpoint work together.
 */
async function testProvider (provider) {
  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 10000)

    const body = {
      model:      provider.model || 'gpt-3.5-turbo',
      messages:   [{ role: 'user', content: 'Reply with just the word: working' }],
      max_tokens: 10
    }

    const apiKey = provider.key_env ? process.env[provider.key_env] : 'local'

    const res = await fetch(`${provider.endpoint}/chat/completions`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey || 'local'}`,
        'Content-Type': 'application/json'
      },
      body:   JSON.stringify(body),
      signal: controller.signal
    })

    clearTimeout(timeout)
    return res.status === 200

  } catch {
    return false
  }
}

module.exports = { detectEndpoint, testEndpoint, testProvider }
