'use strict'

const chalk = require('chalk')
const cfg   = require('../config')
const db    = require('../db')

function capSet (providerName, limit) {
  cfg.loadEnv()
  const providers = cfg.getProviders()
  const found     = providers.find(
    p => p.name.toLowerCase() === providerName.toLowerCase()
  )

  if (!found) {
    console.log(chalk.red(`\n  Provider "${providerName}" not found.`))
    console.log(chalk.gray('  Run: ai-router provider list to see configured providers\n'))
    return
  }

  const numLimit = parseInt(limit, 10)
  if (isNaN(numLimit) || numLimit < 1) {
    console.log(chalk.red('\n  Invalid limit. Must be a positive number.\n'))
    return
  }

  cfg.setCap(found.name, numLimit)
  console.log(chalk.green(
    `\n  ✓ ${found.name} daily cap set to ${numLimit.toLocaleString()} tokens`
  ))
  console.log(chalk.gray(
    `  Router will switch away from ${found.name} at ${numLimit.toLocaleString()} tokens/day\n`
  ))
}

function capRemove (providerName) {
  cfg.loadEnv()
  const found = cfg.getProviders().find(
    p => p.name.toLowerCase() === providerName.toLowerCase()
  )

  if (!found) {
    console.log(chalk.red(`\n  Provider "${providerName}" not found.\n`))
    return
  }

  cfg.removeCap(found.name)
  console.log(chalk.green(`\n  ✓ Cap removed for ${found.name}\n`))
}

function capShow () {
  cfg.loadEnv()
  const caps      = cfg.getCaps()
  const providers = cfg.getProviders()

  console.log(chalk.bold('\n  Token Caps\n'))

  if (providers.length === 0) {
    console.log(chalk.gray('  No providers configured.\n'))
    return
  }

  for (const p of providers) {
    const cap       = caps[p.name]
    const dailyUsed = db.getDailyTokenUsage(p.name)

    if (cap) {
      const pct     = Math.min(100, Math.round((dailyUsed / cap.daily_limit) * 100))
      const barLen  = 20
      const filled  = Math.round((pct / 100) * barLen)
      const bar     = '█'.repeat(filled) + '░'.repeat(barLen - filled)
      const color   = pct >= 100 ? chalk.red : pct >= 80 ? chalk.yellow : chalk.green

      console.log(`  ${chalk.bold(p.name)}`)
      console.log(`  ${color(bar)} ${pct}%`)
      console.log(chalk.gray(`  ${dailyUsed.toLocaleString()} / ${cap.daily_limit.toLocaleString()} tokens today`))
    } else {
      console.log(`  ${chalk.bold(p.name)} ${chalk.gray('no cap set — uses full API limit')}`)
    }
    console.log()
  }
}

module.exports = { capSet, capRemove, capShow }
