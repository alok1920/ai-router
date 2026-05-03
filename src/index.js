#!/usr/bin/env node
'use strict'

const { Command } = require('commander')
const chalk = require('chalk')
const pkg = require('../package.json')
const commands = require('./commands')

const program = new Command()

program
  .name('ai-router')
  .description('Universal AI memory and credit router')
  .version(pkg.version)

// ── setup ──────────────────────────────────────────────────────
program
  .command('setup')
  .description('Configure your API keys interactively')
  .action(async () => {
    await commands.setup()
  })

// ── chat ───────────────────────────────────────────────────────
program
  .command('chat')
  .description('Start a chat session')
  .action(async () => {
    await commands.chat()
  })

// ── providers ──────────────────────────────────────────────────
program
  .command('providers')
  .description('Show status of all configured providers')
  .action(() => {
    commands.providers()
  })

// ── history ────────────────────────────────────────────────────
program
  .command('history')
  .description('Show recent conversation history')
  .action(() => {
    commands.history()
  })

// ── memory ─────────────────────────────────────────────────────
const memoryCmd = program
  .command('memory')
  .description('Manage persistent user preferences')

memoryCmd
  .command('show')
  .description('Show all stored memory')
  .action(() => {
    commands.memoryShow()
  })

memoryCmd
  .command('set <key> <value>')
  .description('Store a preference (e.g. memory set language Hindi)')
  .action((key, value) => {
    commands.memorySet(key, value)
  })

memoryCmd
  .command('delete <key>')
  .description('Remove a stored preference')
  .action((key) => {
    commands.memoryDelete(key)
  })

// ── Default: show help if no command given ─────────────────────
if (process.argv.length <= 2) {
  console.log(chalk.bold('\n  AI Router v' + pkg.version))
  console.log(chalk.gray('  Universal AI memory and credit router\n'))
  program.outputHelp()
  process.exit(0)
}

program.parseAsync(process.argv).catch(err => {
  console.error(chalk.red('\n  Error: ' + err.message + '\n'))
  process.exit(1)
})
