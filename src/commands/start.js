'use strict'

// ai-router start is an alias for ai-router chat
// Keeps backwards compatibility for anyone who read the v0.6 README
const { chat } = require('./chat')

async function start (options = {}) {
  await chat(options)
}

module.exports = { start }