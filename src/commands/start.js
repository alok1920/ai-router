'use strict'

const chalk = require('chalk')
const cfg   = require('../config')
const db    = require('../db')
const { getProviderList } = require('../router')

async function start (options = {}) {
  cfg.loadEnv()
  cfg.ensureHomeDir()

  // Check providers before launching UI
  const providers = getProviderList()
  const ready     = providers.filter(p => p.status === 'ready' && p.configured)

  if (ready.length === 0) {
    console.log(chalk.bold('\n  AI Router\n'))
    console.log(chalk.yellow('  No providers configured.'))
    console.log(chalk.gray('  Run: ai-router provider add\n'))
    return
  }

  // Dynamically require Ink app — only loaded when start is called
  // This prevents Ink from interfering with plain terminal commands
  try {
    const { launchApp } = require('../ui/app')
    await launchApp(options)
  } catch (err) {
    if (err.message.includes('Cannot find module')) {
      console.log(chalk.red('\n  Ink TUI dependencies not installed.'))
      console.log(chalk.gray('  Run: npm install'))
      console.log(chalk.gray('  Or use plain terminal mode: ai-router chat\n'))
    } else {
      throw err
    }
  }
}

module.exports = { start }
