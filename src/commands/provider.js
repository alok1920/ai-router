'use strict'

const chalk    = require('chalk')
const inquirer = require('inquirer')
const cfg      = require('../config')
const { searchProviders }  = require('../providers-directory')
const { testProvider }     = require('../detector')
const { addProviderFlow, configureProvider } = require('./setup')

// ── provider list ──────────────────────────────────────────────

function providerList () {
  cfg.loadEnv()
  const { getProviderList } = require('../router')
  const list = getProviderList()

  console.log(chalk.bold('\n  Configured Providers\n'))

  if (list.length === 0) {
    console.log(chalk.gray('  No providers configured.'))
    console.log(chalk.gray('  Add one with: ai-router provider add\n'))
    return
  }

  for (const p of list) {
    const statusColor = p.status === 'ready' ? chalk.green
      : p.status === 'not configured'        ? chalk.gray
      : chalk.yellow

    console.log(`  ${chalk.bold(p.name.padEnd(20))} ${statusColor(p.status)}`)
    console.log(chalk.gray(`  ${''.padEnd(20)} Type: ${p.type}`))

    if (p.configured) {
      console.log(chalk.gray(`  ${''.padEnd(20)} Requests: ${p.totalRequests}  Tokens today: ${p.dailyUsed.toLocaleString()}${p.cap ? `/${p.cap.toLocaleString()}` : ''}`))
    }

    if (p.lastError) {
      const short = p.lastError.slice(0, 80)
      console.log(chalk.gray(`  ${''.padEnd(20)} Last error: ${short}`))
    }

    console.log()
  }
}

// ── provider add ───────────────────────────────────────────────

async function providerAdd () {
  await addProviderFlow()
}

// ── provider remove ────────────────────────────────────────────

async function providerRemove (name) {
  cfg.loadEnv()
  const providers = cfg.getProviders()

  if (name) {
    const found = providers.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (!found) {
      console.log(chalk.red(`\n  Provider "${name}" not found.\n`))
      return
    }
    const { confirm } = await inquirer.prompt([{
      type:    'confirm',
      name:    'confirm',
      message: `Remove ${found.name}?`,
      default: false
    }])
    if (confirm) {
      cfg.removeProvider(found.name)
      console.log(chalk.green(`\n  ✓ ${found.name} removed\n`))
    }
    return
  }

  if (providers.length === 0) {
    console.log(chalk.gray('\n  No providers configured.\n'))
    return
  }

  const { selected } = await inquirer.prompt([{
    type:    'list',
    name:    'selected',
    message: 'Which provider to remove?',
    choices: [
      ...providers.map(p => ({ name: p.name, value: p.name })),
      { name: 'Cancel', value: null }
    ]
  }])

  if (!selected) return

  const { confirm } = await inquirer.prompt([{
    type:    'confirm',
    name:    'confirm',
    message: `Remove ${selected}?`,
    default: false
  }])

  if (confirm) {
    cfg.removeProvider(selected)
    console.log(chalk.green(`\n  ✓ ${selected} removed\n`))
  }
}

// ── provider test ──────────────────────────────────────────────

async function providerTest (name) {
  cfg.loadEnv()
  const providers = cfg.getProviders()

  let toTest = []

  if (name) {
    const found = providers.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (!found) {
      console.log(chalk.red(`\n  Provider "${name}" not found.\n`))
      return
    }
    toTest = [found]
  } else if (providers.length === 0) {
    console.log(chalk.gray('\n  No providers configured.\n'))
    return
  } else {
    const { selected } = await inquirer.prompt([{
      type:    'list',
      name:    'selected',
      message: 'Which provider to test?',
      choices: [
        ...providers.map(p => ({ name: p.name, value: p })),
        { name: 'All providers', value: 'all' }
      ]
    }])
    toTest = selected === 'all' ? providers : [selected]
  }

  console.log()
  for (const p of toTest) {
    process.stdout.write(chalk.gray(`  Testing ${p.name}...`))

    let works = false
    try {
      if (p.type === 'openai-compatible' && !p.local) {
        const apiKey = p.key_env ? process.env[p.key_env] : null
        if (!apiKey) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
          console.log(`  ${chalk.bold(p.name.padEnd(20))} ${chalk.gray('not configured — no API key')}`)
          continue
        }
        works = await testProvider({ ...p, key: apiKey })
      } else if (p.local) {
        const { testEndpoint } = require('../detector')
        works = await testEndpoint(p.endpoint, 'local')
      } else {
        works = true // Anthropic and Google — tested in live chat
      }
    } catch { works = false }

    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)

    const statusIcon = works ? chalk.green('✓ working') : chalk.red('✗ failed')
    console.log(`  ${chalk.bold(p.name.padEnd(20))} ${statusIcon}`)
  }
  console.log()
}

// ── provider update ────────────────────────────────────────────

async function providerUpdate (name) {
  cfg.loadEnv()
  const providers = cfg.getProviders()

  let target

  if (name) {
    target = providers.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (!target) {
      console.log(chalk.red(`\n  Provider "${name}" not found.\n`))
      return
    }
  } else {
    if (providers.length === 0) {
      console.log(chalk.gray('\n  No providers configured.\n'))
      return
    }
    const { selected } = await inquirer.prompt([{
      type:    'list',
      name:    'selected',
      message: 'Which provider to update?',
      choices: providers.map(p => ({ name: p.name, value: p }))
    }])
    target = selected
  }

  const { field } = await inquirer.prompt([{
    type:    'list',
    name:    'field',
    message: `Update ${target.name}:`,
    choices: [
      { name: 'API key',    value: 'key' },
      { name: 'Model name', value: 'model' },
      { name: 'Endpoint',   value: 'endpoint' }
    ]
  }])

  if (field === 'key' && target.key_env) {
    const { value } = await inquirer.prompt([{
      type:    'password',
      name:    'value',
      message: 'New API key:',
      mask:    '*',
      validate: v => v.trim().length > 0 || 'Required'
    }])
    cfg.setEnvKey(target.key_env, value.trim())
    console.log(chalk.green(`\n  ✓ ${target.name} key updated\n`))
  }

  if (field === 'model') {
    const { value } = await inquirer.prompt([{
      type:    'input',
      name:    'value',
      message: 'New model name:',
      default: target.model || '',
      validate: v => v.trim().length > 0 || 'Required'
    }])
    target.model = value.trim()
    cfg.addProvider(target)
    console.log(chalk.green(`\n  ✓ ${target.name} model updated to: ${value}\n`))
  }

  if (field === 'endpoint') {
    const { value } = await inquirer.prompt([{
      type:    'input',
      name:    'value',
      message: 'New endpoint URL:',
      default: target.endpoint || '',
      validate: v => v.startsWith('http') || 'Must start with http'
    }])
    target.endpoint = value.trim()
    cfg.addProvider(target)
    console.log(chalk.green(`\n  ✓ ${target.name} endpoint updated\n`))
  }
}

module.exports = { providerList, providerAdd, providerRemove, providerTest, providerUpdate }
