'use strict'

const chalk    = require('chalk')
const inquirer = require('inquirer')
const cfg      = require('../config')
const { searchProviders } = require('../providers-directory')
const { detectEndpoint }  = require('../detector')
const db = require('../db')

async function setup () {
  cfg.ensureHomeDir()
  cfg.loadEnv()

  const isFirstRun = cfg.getProviders().length === 0
  const mem        = db.getAllMemory()

  if (isFirstRun) {
    await firstRunSetup(mem)
  } else {
    await returningUserSetup()
  }
}

// ── First run ──────────────────────────────────────────────────

async function firstRunSetup (existingMem) {
  console.log(chalk.bold('\n  AI Router — Setup\n'))
  console.log(chalk.gray('  This will take about 2 minutes.\n'))

  // Step 1 — Personal preferences
  const prefs = await inquirer.prompt([
    {
      type:    'input',
      name:    'name',
      message: 'What should AI Router call you?',
      default: existingMem.name || ''
    },
    {
      type:    'list',
      name:    'language',
      message: 'Preferred response language:',
      choices: ['English', 'Hindi', 'Spanish', 'French', 'German', 'Other'],
      default: existingMem.language || 'English'
    },
    {
      type:    'list',
      name:    'tone',
      message: 'Preferred tone:',
      choices: ['Casual', 'Professional', 'Technical'],
      default: existingMem.tone || 'Casual'
    },
    {
      type:    'list',
      name:    'expertise',
      message: 'Your expertise level:',
      choices: ['Beginner', 'Intermediate', 'Expert'],
      default: existingMem.expertise || 'Intermediate'
    }
  ])

  // Save preferences to memory
  if (prefs.name)      db.setMemory('name',      prefs.name)
  if (prefs.language)  db.setMemory('language',  prefs.language)
  if (prefs.tone)      db.setMemory('tone',       prefs.tone.toLowerCase())
  if (prefs.expertise) db.setMemory('expertise',  prefs.expertise.toLowerCase())

  console.log(chalk.green('\n  ✓ Preferences saved\n'))

  // Step 2 — Add providers
  console.log(chalk.bold('  Now let\'s add your AI providers.\n'))
  await addProviderFlow()

  // Done
  console.log(chalk.bold('\n  Setup complete!\n'))
  console.log(chalk.gray('  Run: ai-router chat   to start chatting'))
  console.log(chalk.gray('  Run: ai-router provider add   to add more providers\n'))
}

// ── Returning user ─────────────────────────────────────────────

async function returningUserSetup () {
  console.log(chalk.bold('\n  AI Router is already configured.\n'))

  const { action } = await inquirer.prompt([{
    type:    'list',
    name:    'action',
    message: 'What would you like to update?',
    choices: [
      { name: 'Add a new provider',             value: 'add_provider' },
      { name: 'Update an API key',               value: 'update_key' },
      { name: 'Update my preferences',           value: 'update_prefs' },
      { name: 'Change provider priority order',  value: 'sequence' },
      { name: 'Exit',                            value: 'exit' }
    ]
  }])

  if (action === 'add_provider')   await addProviderFlow()
  if (action === 'update_key')     await updateKeyFlow()
  if (action === 'update_prefs')   await updatePrefsFlow()
  if (action === 'sequence')       await sequenceFlow()
  if (action === 'exit')           return
}

// ── Add provider flow ──────────────────────────────────────────

async function addProviderFlow () {
  const { query } = await inquirer.prompt([{
    type:    'input',
    name:    'query',
    message: 'Search for a provider (or press Enter to see all):',
    default: ''
  }])

  const results = searchProviders(query)

  if (results.length === 0) {
    console.log(chalk.yellow('\n  No providers found. Try a different search term.\n'))
    return
  }

  const choices = [
    ...results.slice(0, 6).map(p => ({
      name:  `${p.name} — ${p.description}`,
      value: p
    })),
    { name: 'My provider is not in this list', value: 'custom' }
  ]

  const { selected } = await inquirer.prompt([{
    type:    'list',
    name:    'selected',
    message: 'Select a provider:',
    choices
  }])

  if (selected === 'custom') {
    await addCustomProviderFlow()
    return
  }

  await configureProvider(selected)
}

async function configureProvider (template) {
  const providerConfig = { ...template }

  // Local providers don't need a key
  if (template.local) {
    const { model } = await inquirer.prompt([{
      type:    'input',
      name:    'model',
      message: `Which model are you using? (e.g. llama3, mistral, codellama):`,
      validate: v => v.trim().length > 0 || 'Model name required'
    }])
    providerConfig.model   = model.trim()
    providerConfig.enabled = true
    cfg.addProvider(providerConfig)
    console.log(chalk.green(`\n  ✓ ${template.name} configured — model: ${model}\n`))
    return
  }

  // Ask for API key
  const { apiKey } = await inquirer.prompt([{
    type:    'password',
    name:    'apiKey',
    message: `${template.name} API key ${template.key_url ? `(get free at ${template.key_url})` : ''}:`,
    mask:    '*',
    validate: v => v.trim().length > 0 || 'API key required'
  }])

  // Save key to env
  process.stdout.write(chalk.gray('  Testing connection...'))

  cfg.setEnvKey(template.key_env, apiKey.trim())
  providerConfig.enabled = true

  // Test the connection
  let works = false
  try {
    if (template.type === 'openai-compatible') {
      const { testEndpoint } = require('../detector')
      works = await testEndpoint(template.endpoint, apiKey.trim())
    } else {
      works = true // Claude and Google — trust the key format
    }
  } catch { works = false }

  process.stdout.clearLine(0)
  process.stdout.cursorTo(0)

  if (works) {
    cfg.addProvider(providerConfig)
    console.log(chalk.green(`  ✓ ${template.name} connected and saved\n`))
  } else {
    console.log(chalk.yellow(`  ⚠ Could not verify connection — key saved anyway\n`))
    console.log(chalk.gray('    If it fails in chat, check the key and run: ai-router provider update\n'))
    cfg.addProvider(providerConfig)
  }
}

async function addCustomProviderFlow () {
  console.log(chalk.gray('\n  Custom provider setup\n'))

  const answers = await inquirer.prompt([
    {
      type:    'input',
      name:    'name',
      message: 'Provider name:',
      validate: v => v.trim().length > 0 || 'Name required'
    },
    {
      type:    'password',
      name:    'apiKey',
      message: 'API key (press Enter if not needed):',
      mask:    '*'
    },
    {
      type:    'input',
      name:    'model',
      message: 'Model name:',
      validate: v => v.trim().length > 0 || 'Model name required'
    }
  ])

  const name = answers.name.trim()

  // Auto-detect endpoint
  process.stdout.write(chalk.gray('  Auto-detecting endpoint...'))
  const endpoint = await detectEndpoint(name, answers.apiKey)
  process.stdout.clearLine(0)
  process.stdout.cursorTo(0)

  let finalEndpoint = endpoint

  if (!endpoint) {
    console.log(chalk.yellow('  Could not auto-detect endpoint.\n'))
    const { manual } = await inquirer.prompt([{
      type:    'input',
      name:    'manual',
      message: 'Paste the API base URL from their documentation:',
      validate: v => v.startsWith('http') || 'Must be a valid URL starting with http'
    }])
    finalEndpoint = manual.trim()
  } else {
    console.log(chalk.green(`  ✓ Endpoint detected: ${endpoint}\n`))
  }

  const keyEnv = `${name.toUpperCase().replace(/\s+/g, '_')}_API_KEY`
  if (answers.apiKey) cfg.setEnvKey(keyEnv, answers.apiKey)

  cfg.addProvider({
    name:     name,
    type:     'openai-compatible',
    endpoint: finalEndpoint,
    model:    answers.model.trim(),
    key_env:  answers.apiKey ? keyEnv : null,
    local:    !answers.apiKey,
    enabled:  true
  })

  console.log(chalk.green(`  ✓ ${name} added\n`))
}

// ── Update key flow ────────────────────────────────────────────

async function updateKeyFlow () {
  const providers = cfg.getProviders().filter(p => p.key_env)
  if (providers.length === 0) {
    console.log(chalk.gray('\n  No configured providers with API keys.\n'))
    return
  }

  const { provider } = await inquirer.prompt([{
    type:    'list',
    name:    'provider',
    message: 'Which provider key to update?',
    choices: providers.map(p => ({ name: p.name, value: p }))
  }])

  const { apiKey } = await inquirer.prompt([{
    type:    'password',
    name:    'apiKey',
    message: `New API key for ${provider.name}:`,
    mask:    '*',
    validate: v => v.trim().length > 0 || 'API key required'
  }])

  cfg.setEnvKey(provider.key_env, apiKey.trim())
  console.log(chalk.green(`\n  ✓ ${provider.name} key updated\n`))
}

// ── Update preferences flow ────────────────────────────────────

async function updatePrefsFlow () {
  const mem = db.getAllMemory()

  const prefs = await inquirer.prompt([
    { type: 'input', name: 'name',      message: 'Your name:',       default: mem.name || '' },
    { type: 'input', name: 'language',  message: 'Language:',        default: mem.language || 'English' },
    { type: 'input', name: 'tone',      message: 'Tone:',            default: mem.tone || 'casual' },
    { type: 'input', name: 'expertise', message: 'Expertise level:', default: mem.expertise || 'intermediate' }
  ])

  for (const [key, value] of Object.entries(prefs)) {
    if (value) db.setMemory(key, value)
  }

  console.log(chalk.green('\n  ✓ Preferences updated\n'))
}

// ── Sequence flow ──────────────────────────────────────────────

async function sequenceFlow () {
  const providers = cfg.getProviders().map(p => p.name)
  if (providers.length < 2) {
    console.log(chalk.gray('\n  Add at least 2 providers before setting sequences.\n'))
    return
  }

  const { contextType } = await inquirer.prompt([{
    type:    'list',
    name:    'contextType',
    message: 'Which context type?',
    choices: ['general', 'coding', 'writing', 'custom']
  }])

  let context = contextType
  if (contextType === 'custom') {
    const { custom } = await inquirer.prompt([{
      type:    'input',
      name:    'custom',
      message: 'Context type name:',
      validate: v => v.trim().length > 0 || 'Required'
    }])
    context = custom.trim()
  }

  const { order } = await inquirer.prompt([{
    type:    'checkbox',
    name:    'order',
    message: `Provider order for "${context}" (top = tried first):`,
    choices: providers.map(name => ({ name, checked: true }))
  }])

  if (order.length > 0) {
    cfg.setSequence(context, order)
    console.log(chalk.green(`\n  ✓ Sequence set: ${order.join(' → ')}\n`))
  }
}

module.exports = { setup, addProviderFlow, configureProvider }
