'use strict'

const fs = require('fs')
const path = require('path')

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'router.log')
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

const LEVELS = { error: 0, warn: 1, info: 2 }

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

function timestamp () {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function write (level, message) {
  if (LEVELS[level] > LEVELS[LOG_LEVEL]) return

  const line = `[${timestamp()}] ${level.toUpperCase().padEnd(5)} ${message}\n`

  // Write to file — this is what gets kept for debugging
  fs.appendFileSync(LOG_FILE, line)
}

const logger = {
  info  : (msg) => write('info',  msg),
  warn  : (msg) => write('warn',  msg),
  error : (msg) => write('error', msg)
}

module.exports = logger
