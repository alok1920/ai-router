'use strict'

const readline = require('readline')
const chalk    = require('chalk')
const cfg      = require('../config')
const db       = require('../db')
const { route, getProviderList } = require('../router')
const logger   = require('../logger')
const compressor = require('../compressor')
const pythonManager = require('../python-manager')
const path     = require('path')
const fs       = require('fs')

const SLIDING_WINDOW = parseInt(process.env.SLIDING_WINDOW_SIZE || '10', 10)

async function chat (options = {}) {
  cfg.loadEnv()
  cfg.ensureHomeDir()

  // Get or create session
  let sessionId = db.getLatestSession()
  if (!sessionId) {
    sessionId = db.createSession()
    logger.info(`New session created: ${sessionId}`)
  }

  // Build system prompt from memory + optional code context
  const memory       = db.getAllMemory()
  const codeContext  = getCodeContext(options.project)
  const systemPrompt = buildSystemPrompt(memory, codeContext)

  console.log(chalk.bold('\n  AI Router — Chat\n'))
  console.log(chalk.gray('  Type your message and press Enter.'))
  console.log(chalk.gray('  /status   show provider states'))
  console.log(chalk.gray('  /new      start fresh session'))
  console.log(chalk.gray('  /exit     quit\n'))

  // Show ready providers
  const providers = getProviderList()
  const ready     = providers.filter(p => p.status === 'ready' && p.configured)

  if (ready.length === 0) {
    console.log(chalk.red('  No providers configured.'))
    console.log(chalk.gray('  Run: ai-router provider add\n'))
    return
  }

  console.log(chalk.gray(`  Providers ready: ${ready.map(p => p.name).join(', ')}\n`))

  if (codeContext) {
    console.log(chalk.gray('  Code context loaded from project index\n'))
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  const askQuestion = () => {
    rl.question(chalk.cyan('  You: '), async (input) => {
      const message = input.trim()
      if (!message) { askQuestion(); return }

      if (message === '/exit') {
        console.log(chalk.gray('\n  Goodbye.\n'))
        rl.close()
        db.closeDb()
        return
      }

      if (message === '/new') {
        sessionId = db.createSession()
        logger.info(`New session: ${sessionId}`)
        console.log(chalk.gray('\n  New session started.\n'))
        askQuestion()
        return
      }

      if (message === '/status') {
        showProviderStatus()
        askQuestion()
        return
      }

      try {
        process.stdout.write(chalk.gray('  Thinking...'))
        const result = await route(sessionId, message, systemPrompt)
        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)

        console.log(chalk.bold(`\n  ${result.provider}:`))
        console.log(`  ${result.text.split('\n').join('\n  ')}`)
        console.log(chalk.gray(`\n  [${result.provider}]\n`))

      } catch (err) {
        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)
        console.log(chalk.red(`\n  ${err.message}\n`))
        logger.error(err.message)
      }

      askQuestion()
    })
  }

  askQuestion()
}

// ── Code context injection ─────────────────────────────────────

function getCodeContext (projectPath) {
  const target = projectPath ? path.resolve(projectPath) : process.cwd()

  // Try graphify output first
  const graphReport = pythonManager.getGraphReport(target)
  if (graphReport) return graphReport.slice(0, 3000) // cap at 3000 chars

  // Fall back to built-in compressor output
  const compressed = compressor.loadCompressed(target)
  if (compressed) return compressor.formatForPrompt(compressed)

  return null
}

// ── System prompt builder ──────────────────────────────────────

function buildSystemPrompt (memory, codeContext) {
  const lines = [
    'You are a helpful AI assistant continuing an ongoing conversation.',
    'The conversation history is ground truth — treat it as your own prior responses.',
    'Do not mention which AI model you are unless directly asked.'
  ]

  if (Object.keys(memory).length > 0) {
    lines.push('\nUser preferences (always respect these):')
    for (const [key, value] of Object.entries(memory)) {
      lines.push(`- ${key}: ${value}`)
    }
  }

  if (codeContext) {
    lines.push('\nProject context (compressed):')
    lines.push(codeContext)
  }

  return lines.join('\n')
}

// ── In-chat status display ─────────────────────────────────────

function showProviderStatus () {
  const list = getProviderList()

  console.log(chalk.bold('\n  Provider Status\n'))

  for (const p of list) {
    let label, color

    if (!p.configured) {
      label = 'not configured — run: ai-router provider add'
      color = chalk.gray
    } else if (p.status.startsWith('at daily cap')) {
      label = p.status
      color = chalk.red
    } else if (p.status.startsWith('cooling down')) {
      label = p.status
      color = chalk.yellow
    } else if (p.lastError) {
      label = shortenError(p.lastError)
      color = chalk.red
    } else {
      label = 'ready'
      color = chalk.green
    }

    console.log(`  ${chalk.bold(p.name.padEnd(16))} ${color(label)}`)

    if (p.configured && p.totalRequests > 0) {
      const capStr = p.cap ? `/${p.cap.toLocaleString()}` : ''
      console.log(chalk.gray(
        `  ${''.padEnd(16)} ${p.totalRequests} requests · ${p.dailyUsed.toLocaleString()}${capStr} tokens today`
      ))
    }
    console.log()
  }
}

function shortenError (msg) {
  if (msg.includes('404'))           return 'model not found — run: ai-router provider update'
  if (msg.includes('401'))           return 'invalid API key — run: ai-router provider update'
  if (msg.includes('decommissioned')) return 'model decommissioned — run: ai-router provider update'
  return msg.slice(0, 70)
}

module.exports = { chat }
