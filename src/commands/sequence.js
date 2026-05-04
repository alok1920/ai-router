'use strict'

const chalk = require('chalk')
const cfg   = require('../config')

function sequenceSet (contextType, providerNames) {
  cfg.loadEnv()
  const providers = cfg.getProviders().map(p => p.name)

  if (!contextType) {
    console.log(chalk.red('\n  Usage: ai-router sequence <context> <provider1> <provider2> ...\n'))
    console.log(chalk.gray('  Example: ai-router sequence coding claude groq gemini\n'))
    return
  }

  if (!providerNames || providerNames.length === 0) {
    console.log(chalk.red('\n  At least one provider name required.\n'))
    return
  }

  // Validate all provider names exist
  const invalid = providerNames.filter(
    name => !providers.some(p => p.toLowerCase() === name.toLowerCase())
  )

  if (invalid.length > 0) {
    console.log(chalk.red(`\n  Unknown providers: ${invalid.join(', ')}`))
    console.log(chalk.gray('  Run: ai-router provider list to see configured providers\n'))
    return
  }

  // Normalize names to match stored casing
  const normalized = providerNames.map(name =>
    providers.find(p => p.toLowerCase() === name.toLowerCase()) || name
  )

  cfg.setSequence(contextType, normalized)

  console.log(chalk.green(`\n  ✓ Sequence set for "${contextType}"`))
  console.log(chalk.gray(`  Order: ${normalized.join(' → ')}\n`))
}

function sequenceRemove (contextType) {
  if (!contextType) {
    console.log(chalk.red('\n  Usage: ai-router sequence remove <context>\n'))
    return
  }
  cfg.removeSequence(contextType)
  console.log(chalk.green(`\n  ✓ Sequence removed for "${contextType}"\n`))
}

function sequenceShow () {
  cfg.loadEnv()
  const sequences = cfg.getSequences()
  const keys      = Object.keys(sequences)

  console.log(chalk.bold('\n  Priority Sequences\n'))

  if (keys.length === 0) {
    console.log(chalk.gray('  No sequences configured.'))
    console.log(chalk.gray('  Set one with: ai-router sequence coding claude groq gemini\n'))
    return
  }

  for (const context of keys) {
    const order = sequences[context]
    console.log(`  ${chalk.bold(context.padEnd(16))} ${order.join(' → ')}`)
  }
  console.log()
}

module.exports = { sequenceSet, sequenceRemove, sequenceShow }
