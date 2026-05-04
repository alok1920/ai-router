'use strict'

const fs   = require('fs')
const path = require('path')
const { LOGS_DIR, ensureHomeDir } = require('./config')

const LOG_FILE  = path.join(LOGS_DIR, 'router.log')
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const LEVELS    = { error: 0, warn: 1, info: 2 }

function timestamp () {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function write (level, message) {
  if (LEVELS[level] > LEVELS[LOG_LEVEL]) return
  try {
    ensureHomeDir()
    const line = `[${timestamp()}] ${level.toUpperCase().padEnd(5)} ${message}\n`
    fs.appendFileSync(LOG_FILE, line)
  } catch {
    // Never crash because of logging failure
  }
}

module.exports = {
  info  : (msg) => write('info',  msg),
  warn  : (msg) => write('warn',  msg),
  error : (msg) => write('error', msg)
}
