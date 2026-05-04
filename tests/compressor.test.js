'use strict'

const path       = require('path')
const fs         = require('fs')
const os         = require('os')
const compressor = require('../src/compressor')

// Create a temp project folder for testing
const TEST_PROJECT = path.join(os.tmpdir(), `ai-router-compress-test-${Date.now()}`)

beforeAll(() => {
  fs.mkdirSync(TEST_PROJECT, { recursive: true })

  // Write sample JS file
  fs.writeFileSync(path.join(TEST_PROJECT, 'index.js'), `
'use strict'
function greet(name) { return 'Hello ' + name }
const farewell = (name) => 'Goodbye ' + name
class Greeter { sayHi() { return 'hi' } }
module.exports = { greet, farewell, Greeter }
  `)

  // Write sample MD file
  fs.writeFileSync(path.join(TEST_PROJECT, 'README.md'), `
# Test Project
## Installation
## Usage
## Contributing
  `)

  // Write a file that should be ignored
  fs.mkdirSync(path.join(TEST_PROJECT, 'node_modules'), { recursive: true })
  fs.writeFileSync(path.join(TEST_PROJECT, 'node_modules', 'dep.js'), 'module.exports = {}')
})

afterAll(() => {
  fs.rmSync(TEST_PROJECT, { recursive: true, force: true })
})

describe('compressor', () => {
  test('compress returns summary with files and symbols', () => {
    const summary = compressor.compress(TEST_PROJECT)
    expect(summary.project).toBe(path.basename(TEST_PROJECT))
    expect(summary.total_files).toBeGreaterThan(0)
    expect(summary.total_symbols).toBeGreaterThan(0)
  })

  test('extracts JS function names', () => {
    const summary = compressor.compress(TEST_PROJECT)
    const jsFile  = Object.entries(summary.files).find(([f]) => f.endsWith('.js'))
    expect(jsFile).toBeTruthy()
    expect(jsFile[1]).toContain('greet')
  })

  test('extracts MD headings', () => {
    const summary = compressor.compress(TEST_PROJECT)
    const mdFile  = Object.entries(summary.files).find(([f]) => f.endsWith('.md'))
    expect(mdFile).toBeTruthy()
    expect(mdFile[1]).toContain('Test Project')
  })

  test('ignores node_modules', () => {
    const summary = compressor.compress(TEST_PROJECT)
    const hasNodeModules = Object.keys(summary.files).some(
      f => f.includes('node_modules')
    )
    expect(hasNodeModules).toBe(false)
  })

  test('formatForPrompt returns string with project name', () => {
    const summary = compressor.compress(TEST_PROJECT)
    const prompt  = compressor.formatForPrompt(summary)
    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('Project:')
  })

  test('throws for nonexistent path', () => {
    expect(() => compressor.compress('/nonexistent/path/abc123')).toThrow()
  })
})
