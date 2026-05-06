#!/usr/bin/env node
'use strict'

const { Command } = require('commander')
const chalk       = require('chalk')
const pkg         = require('../package.json')

// Load env from ~/.ai-router/.env on startup
try {
  const { loadEnv } = require('./config')
  loadEnv()
} catch { /* first run before config exists */ }

const { setup }                                          = require('./commands/setup')
const { chat }                                           = require('./commands/chat')
const { start }                                          = require('./commands/start')
const { providerList, providerAdd, providerRemove,
        providerTest, providerUpdate }                   = require('./commands/provider')
const { capSet, capRemove, capShow }                    = require('./commands/cap')
const { sequenceSet, sequenceRemove, sequenceShow }     = require('./commands/sequence')
const { indexProject }                                  = require('./commands/index-cmd')
const { memoryShow, memorySet, memoryDelete, history }  = require('./commands/memory')

const program = new Command()

program
  .name('ai-router')
  .description('Universal AI memory and credit router')
  .version(pkg.version)

// ── start (Ink TUI) ────────────────────────────────────────────
program
  .command('start')
  .description('Launch the full-screen TUI — fixed input bar, command palette, status panel')
  .option('-p, --project <path>', 'Project path for code context injection')
  .action(async (opts) => { await start({ project: opts.project }) })

// ── setup ──────────────────────────────────────────────────────
program
  .command('setup')
  .description('Configure API keys and preferences interactively')
  .action(async () => { await setup() })

// ── chat (plain terminal fallback) ────────────────────────────
program
  .command('chat')
  .description('Start a plain terminal chat session (fallback for scripts)')
  .option('-p, --project <path>', 'Project path for code context injection')
  .action(async (opts) => { await chat({ project: opts.project }) })

// ── provider ───────────────────────────────────────────────────
const providerCmd = program
  .command('provider')
  .description('Manage AI providers')

providerCmd
  .command('list')
  .description('Show all configured providers')
  .action(() => { providerList() })

providerCmd
  .command('add')
  .description('Add a new provider interactively')
  .action(async () => { await providerAdd() })

providerCmd
  .command('remove [name]')
  .description('Remove a provider')
  .action(async (name) => { await providerRemove(name) })

providerCmd
  .command('test [name]')
  .description('Test a provider connection')
  .action(async (name) => { await providerTest(name) })

providerCmd
  .command('update [name]')
  .description('Update a provider key or model')
  .action(async (name) => { await providerUpdate(name) })

// ── providers (alias) ──────────────────────────────────────────
program
  .command('providers')
  .description('Show all providers (alias for provider list)')
  .action(() => { providerList() })

// ── cap ────────────────────────────────────────────────────────
const capCmd = program
  .command('cap')
  .description('Manage daily token caps per provider')

capCmd
  .command('set <provider> <limit>')
  .description('Set daily token cap  e.g. cap set Groq 5000')
  .action((provider, limit) => { capSet(provider, limit) })

capCmd
  .command('remove <provider>')
  .description('Remove token cap for a provider')
  .action((provider) => { capRemove(provider) })

capCmd
  .command('show')
  .description('Show all caps and daily usage')
  .action(() => { capShow() })

// ── sequence ───────────────────────────────────────────────────
const seqCmd = program
  .command('sequence')
  .description('Manage provider priority sequences')

seqCmd
  .command('set <context> [providers...]')
  .description('Set provider order  e.g. sequence set coding claude groq')
  .action((ctx, providers) => { sequenceSet(ctx, providers) })

seqCmd
  .command('show')
  .description('Show all configured sequences')
  .action(() => { sequenceShow() })

seqCmd
  .command('remove <context>')
  .description('Remove a sequence')
  .action((ctx) => { sequenceRemove(ctx) })

// ── index ──────────────────────────────────────────────────────
program
  .command('index [path]')
  .description('Index a project folder for code-aware context injection')
  .option('--skip-hook', 'Skip always-on hook installation prompt')
  .action(async (projectPath, opts) => {
    await indexProject(projectPath, { skipHook: opts.skipHook })
  })

// ── memory ─────────────────────────────────────────────────────
const memCmd = program
  .command('memory')
  .description('Manage persistent user preferences')

memCmd
  .command('show')
  .description('Show all stored memory')
  .action(() => { memoryShow() })

memCmd
  .command('set <key> <value>')
  .description('Store a preference')
  .action((key, value) => { memorySet(key, value) })

memCmd
  .command('delete <key>')
  .description('Remove a preference')
  .action((key) => { memoryDelete(key) })

// ── history ────────────────────────────────────────────────────
program
  .command('history')
  .description('Show recent conversation history')
  .action(() => { history() })

// ── Default: show help ─────────────────────────────────────────
if (process.argv.length <= 2) {
  console.log(chalk.bold('\n  AI Router v' + pkg.version))
  console.log(chalk.gray('  Universal AI memory and credit router\n'))
  console.log(chalk.gray('  Quick start:'))
  console.log(chalk.cyan('    ai-router start') + chalk.gray('   — launch full TUI'))
  console.log(chalk.cyan('    ai-router setup') + chalk.gray('   — configure providers'))
  console.log(chalk.cyan('    ai-router chat') + chalk.gray('    — plain terminal mode\n'))
  program.outputHelp()
  process.exit(0)
}

program.parseAsync(process.argv).catch(err => {
  console.error(chalk.red('\n  Error: ' + err.message + '\n'))
  process.exit(1)
})
