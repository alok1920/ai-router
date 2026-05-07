'use strict'

const readline  = require('readline')
const chalk     = require('chalk')
const cfg       = require('../config')
const db        = require('../db')
const { route, getProviderList } = require('../router')
const logger    = require('../logger')
const compressor    = require('../compressor')
const pythonManager = require('../python-manager')
const { indexProject } = require('./index-cmd')
const path = require('path')

async function chat (options = {}) {
  cfg.loadEnv()
  cfg.ensureHomeDir()

  let sessionId = db.getLatestSession()
  if (!sessionId) {
    sessionId = db.createSession()
    logger.info(`New session created: ${sessionId}`)
  }

  const memory      = db.getAllMemory()
  const codeContext = getCodeContext(options.project)
  let   systemPrompt = buildSystemPrompt(memory, codeContext)

  printHeader()

  const configProviders = cfg.getProviders()
  if (!configProviders || configProviders.length === 0) {
    console.log(chalk.red('  No providers configured.'))
    console.log(chalk.gray('  Run: ai-router provider add\n'))
    return
  }

  const providers = getProviderList()
  const ready     = providers.filter(p => p.configured)

  console.log(chalk.gray('  Providers  ') + ready.map(p => chalk.green('● ') + chalk.white(p.name)).join(chalk.gray('  ·  ')) + '\n')

  if (codeContext) {
    console.log(chalk.gray('  Context   ') + chalk.cyan('✓ project index loaded') + '\n')
  }

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout
  })

  const ask = () => {
    rl.question(chalk.cyan('  You: '), async (input) => {
      const message = input.trim()
      if (!message) { ask(); return }

      // ── Slash command router ─────────────────────────────────────

      if (message.startsWith('/')) {
        await handleSlashCommand(message, {
          rl,
          getSessionId:    ()    => sessionId,
          setSessionId:    (id)  => { sessionId = id },
          setSystemPrompt: (sp)  => { systemPrompt = sp },
          options,
          ask
        })
        return
      }

      // ── Regular message → AI ─────────────────────────────────────

      try {
        process.stdout.write(chalk.gray('  Thinking...'))
        const result = await route(sessionId, message, systemPrompt)
        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)

        console.log()
        console.log('  ' + chalk.bold.green('◆ ') + chalk.bold.white(result.provider))
        console.log(chalk.gray('  ' + '─'.repeat(40)))
        console.log(`  ${result.text.split('\n').join('\n  ')}`)
        console.log(chalk.gray('  ' + '─'.repeat(40)))
        console.log()

      } catch (err) {
        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)
        console.log(chalk.red(`\n  ${err.message}\n`))
        logger.error(err.message)
      }

      ask()
    })
  }

  ask()
}

// ── Slash command handler ──────────────────────────────────────

async function handleSlashCommand (message, ctx) {
  const { rl, getSessionId, setSessionId, setSystemPrompt, options, ask } = ctx
  const parts = message.trim().split(/\s+/)
  const base  = parts[0].toLowerCase()

  // ── /exit /quit ────────────────────────────────────────────────
  if (base === '/exit' || base === '/quit') {
    console.log(chalk.gray('\n  Goodbye.\n'))
    rl.close()
    db.closeDb()
    return
  }

  // ── /new ───────────────────────────────────────────────────────
  if (base === '/new') {
    const id = db.createSession()
    setSessionId(id)
    logger.info(`New session: ${id}`)
    console.log(chalk.green('\n  ✓ New session started.\n'))
    ask()
    return
  }

  // ── /clear ─────────────────────────────────────────────────────
  if (base === '/clear') {
    console.clear()
    printHeader()
    ask()
    return
  }

  // ── /status /providers ─────────────────────────────────────────
  if (base === '/status' || base === '/providers') {
    showProviderStatus()
    ask()
    return
  }

  // ── /cap ───────────────────────────────────────────────────────
  if (base === '/cap') {
    if (parts[1] === 'set' && parts.length >= 4) {
      const allProviders = cfg.getProviders()
      const limit        = parseInt(parts[parts.length - 1], 10)
      const providerStr  = parts.slice(2, -1).join(' ').toLowerCase()

      let found = allProviders.find(p => p.name.toLowerCase() === providerStr)
      if (!found) {
        found = allProviders.find(
          p => p.name.toLowerCase().includes(providerStr) ||
               providerStr.includes(p.name.toLowerCase())
        )
      }

      if (!isNaN(limit) && found) {
        cfg.setCap(found.name, limit)
        db.setProviderCooldown(found.name, -1) // clear any active cooldown
        console.log(chalk.green(
          `\n  ✓ ${found.name} cap set to ${limit.toLocaleString()} tokens/day\n`
        ))
      } else if (!found) {
        const names = allProviders.map(p => p.name).join(', ')
        console.log(chalk.yellow(`\n  Provider not found. Available: ${names}\n`))
      } else {
        console.log(chalk.yellow('\n  Usage: /cap set <provider> <limit>\n'))
      }
    } else if (parts[1] === 'remove' && parts[2]) {
      const name = parts.slice(2).join(' ')
      cfg.removeCap(name)
      console.log(chalk.green(`\n  ✓ Cap removed for ${name}\n`))
    } else {
      showCapStatus()
    }
    ask()
    return
  }

  // ── /memory ────────────────────────────────────────────────────
  if (base === '/memory') {
    if (parts[1] === 'set' && parts[2] && parts.length > 3) {
      const key   = parts[2]
      const value = parts.slice(3).join(' ')
      db.setMemory(key, value)
      // Rebuild system prompt with new memory
      const mem = db.getAllMemory()
      const ctx2 = getCodeContext(options.project)
      setSystemPrompt(buildSystemPrompt(mem, ctx2))
      console.log(chalk.green(`\n  ✓ ${key} = ${value}\n`))
    } else if (parts[1] === 'delete' && parts[2]) {
      db.deleteMemory(parts[2])
      console.log(chalk.green(`\n  ✓ Deleted: ${parts[2]}\n`))
    } else {
      showMemory()
    }
    ask()
    return
  }

  // ── /sequence ──────────────────────────────────────────────────
  if (base === '/sequence') {
    const seqs = cfg.getSequences()
    const keys = Object.keys(seqs)
    console.log(chalk.bold('\n  Priority Sequences\n'))
    if (keys.length === 0) {
      console.log(chalk.gray('  No sequences configured.'))
      console.log(chalk.gray('  Set one with: ai-router sequence set coding claude groq\n'))
    } else {
      for (const ctx of keys) {
        console.log(`  ${chalk.bold(ctx.padEnd(16))} ${seqs[ctx].join(' → ')}`)
      }
      console.log()
    }
    ask()
    return
  }

  // ── /index ─────────────────────────────────────────────────────
  if (base === '/index') {
    const target = parts[1] || options.project || process.cwd()
    console.log(chalk.gray(`\n  Indexing ${path.basename(target)}...\n`))
    try {
      await indexProject(target, { skipHook: true })
      // Reload code context after re-index
      const newCtx = getCodeContext(target)
      const mem    = db.getAllMemory()
      setSystemPrompt(buildSystemPrompt(mem, newCtx))
      console.log(chalk.green('  ✓ Index updated and context reloaded\n'))
    } catch (err) {
      console.log(chalk.red(`  Index failed: ${err.message}\n`))
    }
    ask()
    return
  }

  // ── /history ───────────────────────────────────────────────────
  if (base === '/history') {
    const messages = db.getHistory(20)
    console.log(chalk.bold('\n  Recent History\n'))
    if (messages.length === 0) {
      console.log(chalk.gray('  No history yet.\n'))
    } else {
      for (const msg of [...messages].reverse()) {
        const role = msg.role === 'user'
          ? chalk.cyan('  You')
          : chalk.bold(`  ${msg.provider_used}`)
        const time    = msg.created_at ? msg.created_at.slice(0, 16) : ''
        const preview = msg.content.slice(0, 100)
        console.log(`${role} ${chalk.gray(time)}`)
        console.log(`  ${preview}${msg.content.length > 100 ? '...' : ''}`)
        console.log()
      }
    }
    ask()
    return
  }

  // ── /help ──────────────────────────────────────────────────────
  if (base === '/help') {
    console.log(chalk.bold('\n  Available Commands\n'))
    const cmds = [
      ['/cap',              'show token caps and daily usage'],
      ['/cap set <p> <n>',  'set daily cap  e.g. /cap set Groq 5000'],
      ['/cap remove <p>',   'remove cap for a provider'],
      ['/clear',            'clear the screen'],
      ['/exit  /quit',      'quit ai-router'],
      ['/help',             'show this help'],
      ['/history',          'show recent conversation history'],
      ['/index [path]',     're-index project for code context'],
      ['/memory',           'show stored preferences'],
      ['/memory set k v',   'update a preference'],
      ['/memory delete k',  'remove a preference'],
      ['/new',              'start a fresh session'],
      ['/providers',        'show all provider states'],
      ['/sequence',         'show priority sequences'],
      ['/status',           'show current provider status'],
    ]
    for (const [cmd, desc] of cmds) {
      console.log(`  ${chalk.cyan(cmd.padEnd(22))} ${chalk.gray(desc)}`)
    }
    console.log()
    ask()
    return
  }

  // ── Unknown command ────────────────────────────────────────────
  console.log(chalk.yellow(`\n  Unknown command: ${base}`))
  console.log(chalk.gray('  Type /help to see all available commands.\n'))
  ask()
}

// ── Display helpers ────────────────────────────────────────────

function printHeader () {
  console.log()
  console.log(chalk.green('  ╔════════════════════════════════════╗'))
  console.log(chalk.green('  ║  ') + chalk.bold.white('AI Router') + chalk.gray('  v' + require('../../package.json').version) + chalk.green('               ║'))
  console.log(chalk.green('  ║  ') + chalk.gray('Universal AI Memory & Router') + chalk.green('        ║'))
  console.log(chalk.green('  ╚════════════════════════════════════╝'))
  console.log()
  console.log(chalk.gray('  Type a message to chat  ·  /help for commands'))
  console.log()
}

function showProviderStatus () {
  const list = getProviderList()
  console.log(chalk.bold('\n  Provider Status\n'))

  for (const p of list) {
    let label, color

    if (!p.configured) {
      label = 'not configured — run: ai-router provider add'
      color = chalk.gray
    } else if (p.dailyUsed > p.cap) {
      label = `EXCEEDED (${p.dailyUsed.toLocaleString()}/${p.cap.toLocaleString()} tokens)`
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

    console.log(`  ${chalk.bold(p.name.padEnd(20))} ${color(label)}`)

    if (p.configured && p.totalRequests > 0) {
      const capStr = p.cap ? `/${p.cap.toLocaleString()}` : ''
      console.log(chalk.gray(
        `  ${''.padEnd(20)} ${p.totalRequests} requests · ` +
        `${p.dailyUsed.toLocaleString()}${capStr} tokens today`
      ))
    }
    console.log()
  }
}

function showCapStatus () {
  const list = getProviderList()
  console.log(chalk.bold('\n  Token Caps\n'))

  for (const p of list.filter(p => p.configured)) {
    if (!p.cap) {
      console.log(`  ${chalk.bold(p.name.padEnd(20))} ${chalk.gray('no cap — uses full API limit')}`)
    } else {
      const exceeded = p.dailyUsed > p.cap
      const pct      = Math.min(100, Math.round((p.dailyUsed / p.cap) * 100))
      const barLen   = 20
      const filled   = Math.round((pct / 100) * barLen)
      const bar      = '█'.repeat(filled) + '░'.repeat(barLen - filled)
      const color    = exceeded ? chalk.red : pct >= 80 ? chalk.yellow : chalk.green
      const label    = exceeded ? chalk.red('EXCEEDED') : `${pct}%`

      console.log(`  ${chalk.bold(p.name)}`)
      console.log(`  ${color(bar)} ${label}`)
      console.log(chalk.gray(
        `  ${p.dailyUsed.toLocaleString()} / ${p.cap.toLocaleString()} tokens today` +
        `${exceeded ? ' — switching to next provider' : ''}`
      ))
    }
    console.log()
  }
}

function showMemory () {
  const mem  = db.getAllMemory()
  const keys = Object.keys(mem)
  console.log(chalk.bold('\n  Stored Memory\n'))

  if (keys.length === 0) {
    console.log(chalk.gray('  No preferences stored yet.'))
    console.log(chalk.gray('  Set one with: /memory set language Hindi\n'))
    return
  }

  for (const key of keys) {
    console.log(`  ${chalk.bold(key.padEnd(20))} ${mem[key]}`)
  }
  console.log()
}

// ── Code context ───────────────────────────────────────────────

function getCodeContext (projectPath) {
  const target = projectPath ? path.resolve(projectPath) : process.cwd()

  const graphReport = pythonManager.getGraphReport(target)
  if (graphReport) return graphReport.slice(0, 3000)

  const compressed = compressor.loadCompressed(target)
  if (compressed) return compressor.formatForPrompt(compressed)

  return null
}

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

function shortenError (msg) {
  if (msg.includes('404'))            return 'model not found — run: ai-router provider update'
  if (msg.includes('401'))            return 'invalid API key — run: ai-router provider update'
  if (msg.includes('decommissioned')) return 'model decommissioned — run: ai-router provider update'
  return msg.slice(0, 70)
}

module.exports = { chat }