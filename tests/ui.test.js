'use strict'

// Mock config before anything
jest.mock('../src/config', () => {
  const os   = require('os')
  const path = require('path')
  const fs   = require('fs')

  const HOME_DIR   = path.join(os.tmpdir(), 'ai-router-test-ui')
  const LOGS_DIR   = path.join(HOME_DIR, 'logs')
  const GRAPHS_DIR = path.join(HOME_DIR, 'graphs')

  function ensureHomeDir () {
    if (!fs.existsSync(HOME_DIR))   fs.mkdirSync(HOME_DIR,   { recursive: true })
    if (!fs.existsSync(LOGS_DIR))   fs.mkdirSync(LOGS_DIR,   { recursive: true })
    if (!fs.existsSync(GRAPHS_DIR)) fs.mkdirSync(GRAPHS_DIR, { recursive: true })
  }

  return {
    DB_FILE: path.join(HOME_DIR, 'test-ui.db'),
    LOGS_DIR, GRAPHS_DIR, HOME_DIR,
    ensureHomeDir,
    loadEnv:      () => {},
    getProviders: () => [],
    getCap:       () => null,
    getSequence:  () => null,
    getSequences: () => ({}),
    getAllMemory:  () => ({})
  }
})

jest.mock('../src/router', () => ({
  getProviderList: () => [
    { name: 'Groq', status: 'ready', configured: true, dailyUsed: 100, cap: 5000, totalRequests: 5 }
  ],
  route: jest.fn()
}))

jest.mock('../src/db', () => ({
  getAllMemory:    () => ({ name: 'Alok', language: 'English' }),
  getLatestSession: () => 'test-session',
  createSession:  () => 'test-session',
  setMemory:      jest.fn(),
  getMemory:      () => null,
  closeDb:        jest.fn()
}))

// ── Command palette tests ──────────────────────────────────────

describe('Command palette', () => {
  test('ALL_COMMANDS contains required commands', () => {
    const { ALL_COMMANDS } = require('../src/ui/command-palette')
    const cmds = ALL_COMMANDS.map(c => c.cmd)
    expect(cmds).toContain('/exit')
    expect(cmds).toContain('/new')
    expect(cmds).toContain('/cap')
    expect(cmds).toContain('/memory')
    expect(cmds).toContain('/status')
    expect(cmds).toContain('/help')
  })

  test('ALL_COMMANDS all have descriptions', () => {
    const { ALL_COMMANDS } = require('../src/ui/command-palette')
    for (const cmd of ALL_COMMANDS) {
      expect(cmd.desc).toBeTruthy()
      expect(typeof cmd.desc).toBe('string')
    }
  })
})

// ── Start command tests ────────────────────────────────────────

describe('Start command', () => {
  test('start module exports start function', () => {
    const { start } = require('../src/commands/start')
    expect(typeof start).toBe('function')
  })
})

// ── App module tests ───────────────────────────────────────────

describe('App module', () => {
  test('launchApp is exported', () => {
    jest.mock('ink', () => ({
      render:    jest.fn(() => ({ waitUntilExit: () => Promise.resolve() })),
      Box:       'Box',
      Text:      'Text',
      useInput:  jest.fn(),
      useApp:    jest.fn(() => ({ exit: jest.fn() })),
      useStdout: jest.fn(() => ({ stdout: { rows: 24 } }))
    }))
    jest.mock('ink-text-input', () => ({ default: 'TextInput' }))

    const { launchApp } = require('../src/ui/app')
    expect(typeof launchApp).toBe('function')
  })
})
