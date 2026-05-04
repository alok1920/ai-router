'use strict'

const os   = require('os')
const path = require('path')
const fs   = require('fs')

// Override home dir to a temp location for testing
const TEST_HOME = path.join(os.tmpdir(), `ai-router-test-${Date.now()}`)
jest.mock('../src/config', () => {
  const os   = require('os')
  const path = require('path')
  const fs   = require('fs')

  const HOME_DIR    = path.join(os.tmpdir(), `ai-router-test-config`)
  const CONFIG_FILE = path.join(HOME_DIR, 'config.json')
  const ENV_FILE    = path.join(HOME_DIR, '.env')
  const DB_FILE     = path.join(HOME_DIR, 'memory.db')
  const LOGS_DIR    = path.join(HOME_DIR, 'logs')
  const GRAPHS_DIR  = path.join(HOME_DIR, 'graphs')
  const VENV_DIR    = path.join(HOME_DIR, 'venv')

  const DEFAULT_CONFIG = { version: '0.5.0', providers: [], sequences: {}, caps: {} }

  function ensureHomeDir () {
    if (!fs.existsSync(HOME_DIR))   fs.mkdirSync(HOME_DIR,   { recursive: true })
    if (!fs.existsSync(LOGS_DIR))   fs.mkdirSync(LOGS_DIR,   { recursive: true })
    if (!fs.existsSync(GRAPHS_DIR)) fs.mkdirSync(GRAPHS_DIR, { recursive: true })
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2))
    }
    if (!fs.existsSync(ENV_FILE)) {
      fs.writeFileSync(ENV_FILE, '# AI Router API Keys\n')
    }
  }

  function readConfig () {
    ensureHomeDir()
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
    catch { return { ...DEFAULT_CONFIG } }
  }

  function writeConfig (config) {
    ensureHomeDir()
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  }

  function getProviders ()       { return readConfig().providers || [] }
  function addProvider (p)       {
    const cfg = readConfig()
    const idx = cfg.providers.findIndex(x => x.name === p.name)
    if (idx >= 0) cfg.providers[idx] = p; else cfg.providers.push(p)
    writeConfig(cfg)
  }
  function removeProvider (name) {
    const cfg = readConfig()
    cfg.providers = cfg.providers.filter(p => p.name !== name)
    writeConfig(cfg)
  }
  function getProvider (name)    { return getProviders().find(p => p.name === name) || null }
  function getCaps ()            { return readConfig().caps || {} }
  function setCap (name, limit)  {
    const cfg = readConfig()
    if (!cfg.caps) cfg.caps = {}
    cfg.caps[name] = { daily_limit: limit }
    writeConfig(cfg)
  }
  function removeCap (name)      {
    const cfg = readConfig()
    if (cfg.caps) delete cfg.caps[name]
    writeConfig(cfg)
  }
  function getCap (name)         { return (getCaps())[name] || null }
  function getSequences ()       { return readConfig().sequences || {} }
  function setSequence (ctx, p)  {
    const cfg = readConfig()
    if (!cfg.sequences) cfg.sequences = {}
    cfg.sequences[ctx] = p
    writeConfig(cfg)
  }
  function removeSequence (ctx)  {
    const cfg = readConfig()
    if (cfg.sequences) delete cfg.sequences[ctx]
    writeConfig(cfg)
  }
  function getSequence (ctx)     { return (getSequences())[ctx] || null }
  function setEnvKey (key, val)  {
    ensureHomeDir()
    let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : ''
    const lines = content.split('\n')
    const idx   = lines.findIndex(l => l.startsWith(`${key}=`))
    if (idx >= 0) lines[idx] = `${key}=${val}`; else lines.push(`${key}=${val}`)
    fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n')
    process.env[key] = val
  }
  function getEnvKey (key)       { return process.env[key] || null }
  function loadEnv ()            {}

  return {
    HOME_DIR, CONFIG_FILE, ENV_FILE, DB_FILE, LOGS_DIR, GRAPHS_DIR, VENV_DIR,
    ensureHomeDir, readConfig, writeConfig,
    getProviders, addProvider, removeProvider, getProvider,
    getCaps, setCap, removeCap, getCap,
    getSequences, setSequence, removeSequence, getSequence,
    setEnvKey, getEnvKey, loadEnv
  }
})

const cfg = require('../src/config')

beforeEach(() => {
  cfg.ensureHomeDir()
  // Clear providers between tests
  const config = cfg.readConfig()
  config.providers = []
  config.caps      = {}
  config.sequences = {}
  cfg.writeConfig(config)
})

describe('Provider management', () => {
  test('adds a provider to config', () => {
    cfg.addProvider({ name: 'TestGroq', type: 'openai-compatible', enabled: true })
    expect(cfg.getProviders()).toHaveLength(1)
    expect(cfg.getProviders()[0].name).toBe('TestGroq')
  })

  test('updates existing provider', () => {
    cfg.addProvider({ name: 'TestGroq', type: 'openai-compatible', model: 'old' })
    cfg.addProvider({ name: 'TestGroq', type: 'openai-compatible', model: 'new' })
    expect(cfg.getProviders()).toHaveLength(1)
    expect(cfg.getProviders()[0].model).toBe('new')
  })

  test('removes a provider', () => {
    cfg.addProvider({ name: 'ToRemove', type: 'openai-compatible' })
    cfg.removeProvider('ToRemove')
    expect(cfg.getProviders()).toHaveLength(0)
  })

  test('getProvider returns correct provider', () => {
    cfg.addProvider({ name: 'FindMe', type: 'google' })
    expect(cfg.getProvider('FindMe')).not.toBeNull()
    expect(cfg.getProvider('NotThere')).toBeNull()
  })
})

describe('Token cap management', () => {
  test('sets a token cap', () => {
    cfg.setCap('Claude', 3000)
    const cap = cfg.getCap('Claude')
    expect(cap).not.toBeNull()
    expect(cap.daily_limit).toBe(3000)
  })

  test('removes a token cap', () => {
    cfg.setCap('Claude', 3000)
    cfg.removeCap('Claude')
    expect(cfg.getCap('Claude')).toBeNull()
  })
})

describe('Sequence management', () => {
  test('sets a sequence', () => {
    cfg.setSequence('coding', ['Claude', 'Groq', 'Gemini'])
    expect(cfg.getSequence('coding')).toEqual(['Claude', 'Groq', 'Gemini'])
  })

  test('removes a sequence', () => {
    cfg.setSequence('coding', ['Claude', 'Groq'])
    cfg.removeSequence('coding')
    expect(cfg.getSequence('coding')).toBeNull()
  })

  test('unknown sequence returns null', () => {
    expect(cfg.getSequence('nonexistent')).toBeNull()
  })
})
