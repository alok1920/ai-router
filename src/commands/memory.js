'use strict'

const chalk = require('chalk')
const db    = require('../db')

// ── Memory commands ────────────────────────────────────────────

function memoryShow () {
  const mem  = db.getAllMemory()
  const keys = Object.keys(mem)

  console.log(chalk.bold('\n  Stored Memory\n'))

  if (keys.length === 0) {
    console.log(chalk.gray('  No memory stored yet.'))
    console.log(chalk.gray('  Set a preference: ai-router memory set language Hindi\n'))
    return
  }

  for (const key of keys) {
    console.log(`  ${chalk.bold(key.padEnd(20))} ${mem[key]}`)
  }
  console.log()
}

function memorySet (key, value) {
  if (!key || !value) {
    console.log(chalk.red('\n  Usage: ai-router memory set <key> <value>'))
    console.log(chalk.gray('  Example: ai-router memory set tone casual\n'))
    return
  }
  db.setMemory(key, value)
  console.log(chalk.green(`\n  ✓ ${key} = ${value}\n`))
}

function memoryDelete (key) {
  if (!key) {
    console.log(chalk.red('\n  Usage: ai-router memory delete <key>\n'))
    return
  }
  db.deleteMemory(key)
  console.log(chalk.green(`\n  ✓ Deleted: ${key}\n`))
}

// ── History command ────────────────────────────────────────────

function history () {
  const messages = db.getHistory(20)

  if (messages.length === 0) {
    console.log(chalk.gray('\n  No history yet. Start with: ai-router chat\n'))
    return
  }

  console.log(chalk.bold('\n  Recent History\n'))

  for (const msg of [...messages].reverse()) {
    const roleLabel = msg.role === 'user'
      ? chalk.cyan('  You')
      : chalk.bold(`  ${msg.provider_used}`)

    const time    = msg.created_at.slice(0, 16)
    const preview = msg.content.slice(0, 120)
    console.log(`${roleLabel} ${chalk.gray(time)}`)
    console.log(`  ${preview}${msg.content.length > 120 ? '...' : ''}`)
    console.log()
  }
}

module.exports = { memoryShow, memorySet, memoryDelete, history }
