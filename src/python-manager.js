'use strict'

const { execSync, exec } = require('child_process')
const fs   = require('fs')
const path = require('path')
const os   = require('os')
const { VENV_DIR, GRAPHS_DIR, ensureHomeDir } = require('./config')

const GRAPHIFY_PKG     = 'graphifyy'
const GRAPHIFY_VERSION = 'graphifyy>=0.6.0'

// Paths inside the managed venv
const VENV_PYTHON  = path.join(VENV_DIR, 'bin', 'python')
const VENV_PIP     = path.join(VENV_DIR, 'bin', 'pip')
const VENV_GRAPHIFY = path.join(VENV_DIR, 'bin', 'graphify')

// Windows paths (bin → Scripts)
const IS_WINDOWS    = os.platform() === 'win32'
const WIN_PYTHON    = path.join(VENV_DIR, 'Scripts', 'python.exe')
const WIN_PIP       = path.join(VENV_DIR, 'Scripts', 'pip.exe')
const WIN_GRAPHIFY  = path.join(VENV_DIR, 'Scripts', 'graphify.exe')

function getPaths () {
  return {
    python:   IS_WINDOWS ? WIN_PYTHON   : VENV_PYTHON,
    pip:      IS_WINDOWS ? WIN_PIP      : VENV_PIP,
    graphify: IS_WINDOWS ? WIN_GRAPHIFY : VENV_GRAPHIFY
  }
}

// ── Python version check ───────────────────────────────────────

function checkPython () {
  const candidates = ['python3', 'python', 'python3.12', 'python3.11', 'python3.10']

  for (const cmd of candidates) {
    try {
      const out     = execSync(`${cmd} --version 2>&1`, { encoding: 'utf8' })
      const match   = out.match(/Python (\d+)\.(\d+)/)
      if (!match) continue

      const major = parseInt(match[1])
      const minor = parseInt(match[2])

      if (major === 3 && minor >= 10) {
        return { found: true, command: cmd, version: `${major}.${minor}` }
      }
    } catch {
      continue
    }
  }

  return { found: false }
}

function getPythonInstallHint () {
  const platform = os.platform()
  if (platform === 'darwin')  return 'brew install python  OR  download from python.org'
  if (platform === 'win32')   return 'winget install Python.Python.3  OR  download from python.org'
  return 'sudo apt install python3  OR  sudo dnf install python3'
}

// ── Venv management ────────────────────────────────────────────

function venvExists () {
  const { python } = getPaths()
  return fs.existsSync(python)
}

function graphifyInstalled () {
  const { graphify } = getPaths()
  return fs.existsSync(graphify)
}

function createVenv (pythonCmd) {
  ensureHomeDir()
  execSync(`${pythonCmd} -m venv "${VENV_DIR}"`, { stdio: 'pipe' })
}

function installGraphify () {
  const { pip } = getPaths()
  execSync(`"${pip}" install --quiet "${GRAPHIFY_VERSION}"`, { stdio: 'pipe' })
}

function updateGraphify () {
  const { pip } = getPaths()
  execSync(`"${pip}" install --quiet --upgrade "${GRAPHIFY_PKG}"`, { stdio: 'pipe' })
}

// ── Main setup entry point ─────────────────────────────────────

/**
 * Ensure graphify is installed and ready.
 * Returns { ready: bool, message: string, fallback: bool }
 */
async function ensureGraphify (chalk) {
  const log = chalk
    ? (msg) => process.stdout.write(chalk.gray(`  ${msg}\n`))
    : (msg) => process.stdout.write(`  ${msg}\n`)

  // Step 1 — check Python
  const python = checkPython()
  if (!python.found) {
    return {
      ready:    false,
      fallback: true,
      message:  `Python 3.10+ not found.\n  Install: ${getPythonInstallHint()}\n  Using built-in compressor instead.`
    }
  }

  // Step 2 — create venv if needed
  if (!venvExists()) {
    log(`Setting up graphify environment (Python ${python.version})...`)
    try {
      createVenv(python.command)
      log('Virtual environment created ✓')
    } catch (err) {
      return {
        ready:    false,
        fallback: true,
        message:  `Could not create Python environment: ${err.message}\n  Using built-in compressor instead.`
      }
    }
  }

  // Step 3 — install or update graphify
  if (!graphifyInstalled()) {
    log('Installing graphifyy...')
    try {
      installGraphify()
      log('graphifyy installed ✓')
    } catch (err) {
      return {
        ready:    false,
        fallback: true,
        message:  `Could not install graphifyy: ${err.message}\n  Using built-in compressor instead.`
      }
    }
  } else {
    log('Checking for graphifyy updates...')
    try {
      updateGraphify()
      log('graphifyy is up to date ✓')
    } catch {
      log('Could not update graphifyy — using installed version')
    }
  }

  return { ready: true, fallback: false, message: 'graphifyy ready' }
}

// ── Run graphify on a project folder ──────────────────────────

function runGraphify (projectPath) {
  const { graphify } = getPaths()
  const absPath      = path.resolve(projectPath)

  if (!fs.existsSync(absPath)) {
    throw new Error(`Project path not found: ${absPath}`)
  }

  execSync(
    `"${graphify}"`,
    { stdio: 'pipe', cwd: absPath }
  )

  return path.join(absPath, 'graphify-out', 'graph.json')
}

function runGraphifyUpdate (projectPath) {
  const { graphify } = getPaths()
  const absPath      = path.resolve(projectPath)

  execSync(
    `"${graphify}" --update`,
    { stdio: 'pipe', cwd: absPath }
  )

  return path.join(absPath, 'graphify-out', 'graph.json')
}

function installAlwaysOnHook (projectPath) {
  const { graphify } = getPaths()
  const absPath      = path.resolve(projectPath)

  try {
    execSync(`"${graphify}" install`, { stdio: 'pipe', cwd: absPath })
    return true
  } catch {
    return false
  }
}

// ── Read graph output ──────────────────────────────────────────

function readGraph (projectPath) {
  const graphPath = path.join(path.resolve(projectPath), 'graphify-out', 'graph.json')
  if (!fs.existsSync(graphPath)) return null

  try {
    return JSON.parse(fs.readFileSync(graphPath, 'utf8'))
  } catch {
    return null
  }
}

function getGraphReport (projectPath) {
  const reportPath = path.join(path.resolve(projectPath), 'graphify-out', 'GRAPH_REPORT.md')
  if (!fs.existsSync(reportPath)) return null
  return fs.readFileSync(reportPath, 'utf8')
}

module.exports = {
  checkPython,
  getPythonInstallHint,
  ensureGraphify,
  venvExists,
  graphifyInstalled,
  runGraphify,
  runGraphifyUpdate,
  installAlwaysOnHook,
  readGraph,
  getGraphReport
}