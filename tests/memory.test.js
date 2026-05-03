'use strict'

process.chdir(__dirname)

const db = require('../src/db')
const fs = require('fs')
const path = require('path')
const TEST_DB = path.join(__dirname, 'test.db')

afterAll(() => {
  db.closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

describe('Memory persistence', () => {
  test('stores multiple preferences independently', () => {
    db.setMemory('language', 'Hindi')
    db.setMemory('tone', 'casual')
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
    const value = db.getMemory('this_key_does_not_exist')
    expect(value).toBeNull()
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

    const mem = db.getAllMemory()
    expect(mem).not.toHaveProperty('to_delete')
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
