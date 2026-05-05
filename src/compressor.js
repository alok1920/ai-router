'use strict'

const fs   = require('fs')
const path = require('path')

/**
 * Built-in lightweight code compressor.
 *
 * Used as fallback when graphify is not available (Python not installed).
 * Extracts function names, class names, and exports from code files
 * to produce a compact project map.
 *
 * Supports: .js .ts .mjs .cjs .py .md .json
 * No LLM needed. No external dependencies.
 */

const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx',
  '.py', '.md', '.json', '.yaml', '.yml'
])

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build',
  'coverage', '.cache', 'vendor', '__pycache__', '.venv'
])

// ── File collection ────────────────────────────────────────────

function collectFiles (dir, maxDepth = 6, depth = 0) {
  if (depth > maxDepth) return []

  const files = []
  let entries

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return files
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue
    if (entry.name.startsWith('.'))   continue

    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectFiles(full, maxDepth, depth + 1))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (SUPPORTED_EXTENSIONS.has(ext)) files.push(full)
    }
  }

  return files
}

// ── Extractors ─────────────────────────────────────────────────

function extractJS (content) {
  const symbols = []

  // Function declarations and arrow functions assigned to const/let/var
  const fnPatterns = [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
    /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/gm,
    /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(.*\)\s*=>/gm
  ]

  for (const pattern of fnPatterns) {
    let m
    while ((m = pattern.exec(content)) !== null) {
      if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
    }
  }

  // Class declarations
  const classPattern = /^(?:export\s+)?class\s+(\w+)/gm
  let m
  while ((m = classPattern.exec(content)) !== null) {
    if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
  }

  // module.exports keys
  const exportsPattern = /module\.exports\s*=\s*\{([^}]+)\}/
  const exportsMatch   = content.match(exportsPattern)
  if (exportsMatch) {
    const keys = exportsMatch[1].match(/\b\w+\b/g) || []
    for (const key of keys) {
      if (!symbols.includes(key)) symbols.push(key)
    }
  }

  return symbols
}

function extractPython (content) {
  const symbols = []

  const fnPattern    = /^def\s+(\w+)/gm
  const classPattern = /^class\s+(\w+)/gm

  let m
  while ((m = fnPattern.exec(content)) !== null) {
    if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
  }
  while ((m = classPattern.exec(content)) !== null) {
    if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
  }

  return symbols
}

function extractMd (content) {
  // Extract headings as structure markers
  const headings = []
  const pattern  = /^#{1,3}\s+(.+)$/gm
  let m
  while ((m = pattern.exec(content)) !== null) {
    headings.push(m[1].trim())
  }
  return headings.slice(0, 10) // cap at 10 headings
}

// ── Main compress function ─────────────────────────────────────

/**
 * Compress a project directory into a compact summary.
 *
 * @param {string} projectPath — absolute or relative path to project
 * @returns {Object} — compact project map
 */
function compress (projectPath) {
  const absPath = path.resolve(projectPath)

  if (!fs.existsSync(absPath)) {
    throw new Error(`Project path not found: ${absPath}`)
  }

  const files   = collectFiles(absPath)
  const summary = {
    project:  path.basename(absPath),
    path:     absPath,
    files:    {},
    generated_at: new Date().toISOString()
  }

  let totalSymbols = 0

  for (const filePath of files) {
    const relative = path.relative(absPath, filePath)
    const ext      = path.extname(filePath).toLowerCase()

    let content
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch {
      continue
    }

    // Skip very large files
    if (content.length > 100_000) continue

    let symbols = []

    if (['.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx'].includes(ext)) {
      symbols = extractJS(content)
    } else if (ext === '.py') {
      symbols = extractPython(content)
    } else if (ext === '.md') {
      symbols = extractMd(content)
    } else if (ext === '.json') {
      try {
        const keys = Object.keys(JSON.parse(content)).slice(0, 10)
        symbols    = keys
      } catch { /* skip malformed JSON */ }
    }

    if (symbols.length > 0) {
      summary.files[relative] = symbols
      totalSymbols += symbols.length
    }
  }

  summary.total_files   = Object.keys(summary.files).length
  summary.total_symbols = totalSymbols

  return summary
}

/**
 * Format the project map as a compact prompt-injectable string.
 * Designed to be injected into the system prompt.
 */
function formatForPrompt (summary) {
  const lines = [
    `## Project: ${summary.project}`,
    `## Root path: ${summary.path}`,
    `## Files: ${summary.total_files} | Symbols: ${summary.total_symbols}`,
    ''
  ]

  for (const [file, symbols] of Object.entries(summary.files)) {
    lines.push(`${summary.path}/${file}: ${symbols.join(', ')}`)
  }

  return lines.join('\n')
}

/**
 * Save compressed summary to ~/.ai-router/graphs/
 */
function saveCompressed (projectPath, summary) {
  const { GRAPHS_DIR } = require('./config')
  const name     = path.basename(path.resolve(projectPath))
  const outFile  = path.join(GRAPHS_DIR, `${name}.json`)
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2))
  return outFile
}

/**
 * Load previously saved compressed summary
 */
function loadCompressed (projectPath) {
  const { GRAPHS_DIR } = require('./config')
  const name    = path.basename(path.resolve(projectPath))
  const outFile = path.join(GRAPHS_DIR, `${name}.json`)
  if (!fs.existsSync(outFile)) return null
  try {
    return JSON.parse(fs.readFileSync(outFile, 'utf8'))
  } catch {
    return null
  }
}

module.exports = {
  compress,
  formatForPrompt,
  saveCompressed,
  loadCompressed,
  collectFiles
}