'use strict'

const chalk   = require('chalk')
const inquirer = require('inquirer')
const path    = require('path')
const fs      = require('fs')
const pythonManager = require('../python-manager')
const compressor    = require('../compressor')

async function indexProject (projectPath, options = {}) {
  const target = path.resolve(projectPath || '.')

  if (!fs.existsSync(target)) {
    console.log(chalk.red(`\n  Path not found: ${target}\n`))
    return
  }

  console.log(chalk.bold(`\n  Indexing: ${target}\n`))

  // Try graphify first
  const graphifyStatus = await pythonManager.ensureGraphify(chalk)

  if (graphifyStatus.ready) {
    await runWithGraphify(target, options)
  } else {
    console.log(chalk.yellow(`  ${graphifyStatus.message}\n`))
    await runWithBuiltIn(target)
  }
}

async function runWithGraphify (target, options) {
  process.stdout.write(chalk.gray('  Building knowledge graph with graphify...'))

  try {
    const graphFile = pythonManager.runGraphify(target)
    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    console.log(chalk.green('  ✓ Knowledge graph built'))
    console.log(chalk.gray(`  Graph saved to: ${graphFile}\n`))

    // Offer always-on hook
    if (!options.skipHook) {
      const { installHook } = await inquirer.prompt([{
        type:    'confirm',
        name:    'installHook',
        message: 'Install always-on hook? (AI assistants will read project structure before every answer)',
        default: true
      }])

      if (installHook) {
        process.stdout.write(chalk.gray('  Installing hook...'))
        const ok = pythonManager.installAlwaysOnHook(target)
        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)
        if (ok) {
          console.log(chalk.green('  ✓ Always-on hook installed'))
          console.log(chalk.gray('  Claude Code and Gemini CLI will read your graph before every response\n'))
        } else {
          console.log(chalk.yellow('  Could not install hook — run graphify install manually\n'))
        }
      }
    }

  } catch (err) {
    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    console.log(chalk.yellow(`  Graphify failed: ${err.message}`))
    console.log(chalk.gray('  Falling back to built-in compressor...\n'))
    await runWithBuiltIn(target)
  }
}

async function runWithBuiltIn (target) {
  process.stdout.write(chalk.gray('  Building project index with built-in compressor...'))

  try {
    const summary  = compressor.compress(target)
    const outFile  = compressor.saveCompressed(target, summary)

    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)

    console.log(chalk.green('  ✓ Project index built'))
    console.log(chalk.gray(`  Files indexed:   ${summary.total_files}`))
    console.log(chalk.gray(`  Symbols indexed: ${summary.total_symbols}`))
    console.log(chalk.gray(`  Index saved to:  ${outFile}\n`))

  } catch (err) {
    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    console.log(chalk.red(`  Failed: ${err.message}\n`))
  }
}

module.exports = { indexProject }
