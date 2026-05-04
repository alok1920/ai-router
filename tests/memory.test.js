'use strict'

// Mock config before requiring db
jest.mock('../src/config', () => {
  const os   = require('os')
  const path = require('path')
  const fs   = require('fs')

  const HOME_DIR   = path.join(os.tmpdir(), 'ai-router-test-memory')
  const LOGS_DIR   = path.join(HOME_DIR, 'logs')
  const GRAPHS_DIR = path.join(HOME_DIR, 'graphs')

  function ensureHomeDir () {
    if (!fs.existsSync(HOME_DIR))   fs.mkdirSync(HOME_DIR,   { recursive: true })
    if (!fs.existsSync(LOGS_DIR))   fs.mkdirSync(LOGS_DIR,   { recursive: true })
    if (!fs.existsSync(GRAPHS_DIR)) fs.mkdirSync(GRAPHS_DIR, { recursive: true })
  }

  return {
    DB_FILE:      path.join(HOME_DIR, 'test-memory.db'),
    LOGS_DIR,
    GRAPHS_DIR,
    HOME_DIR,
    ensureHomeDir,
    loadEnv: () => {}
  }
})

const db = require('../src/db')

afterAll(() => {
  db.closeDb()
})

describe('Memory persistence', () => {
  test('stores multiple preferences independently', () => {
    db.setMemory('language',  'Hindi')
    db.setMemory('tone',      'casual')
    db.setMemory('expertise', 'intermediate')

    expect(db.getMemory('language')).toBe('Hindi')
    expect(db.getMemory('tone')).toBe('casual')
    expect(db.getMemory('expertise')).toBe('intermediate')
  })

  test('getAllMemory returns all preferences as an object', () => {
    db.setMemory('style', 'concise')
    const mem = db.getAllMemory()
    expect(typeof mem).toBe('object')
    expect(mem).toHaveProperty('style', 'concise')
  })

  test('unknown key returns null', () => {
    expect(db.getMemory('this_key_does_not_exist_9999')).toBeNull()
  })

  test('overwriting a key keeps only the new value', () => {
    db.setMemory('overwrite_test', 'first')
    db.setMemory('overwrite_test', 'second')
    db.setMemory('overwrite_test', 'third')
    expect(db.getMemory('overwrite_test')).toBe('third')
  })

  test('deleted key is gone from getAllMemory', () => {
    db.setMemory('to_delete', 'value')
    db.deleteMemory('to_delete')
    expect(db.getAllMemory()).not.toHaveProperty('to_delete')
  })
})

describe('Provider cooldown', () => {
  test('provider is on cooldown after setProviderCooldown', () => {
    db.setProviderCooldown('TestProvider', 60000)
    expect(db.isProviderOnCooldown('TestProvider')).toBe(true)
  })

  test('provider is not on cooldown after duration expires', () => {
    db.setProviderCooldown('ExpiredProvider', -1000)
    expect(db.isProviderOnCooldown('ExpiredProvider')).toBe(false)
  })
})