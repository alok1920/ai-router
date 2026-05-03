'use strict'

const { DatabaseSync } = require('node:sqlite')
const path = require('path')

// Database lives in the project root — never in src/
const DB_PATH = path.join(process.cwd(), 'ai-router.db')

let db

function getDb () {
  if (!db) {
    db = new DatabaseSync(DB_PATH)
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA foreign_keys = ON')
    runMigrations()
  }
  return db
}

function runMigrations () {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id            TEXT PRIMARY KEY,
      session_id    TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content       TEXT NOT NULL,
      provider_used TEXT NOT NULL,
      token_count   INTEGER DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS user_memory (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS provider_status (
      name            TEXT PRIMARY KEY,
      cooldown_until  INTEGER DEFAULT 0,
      total_requests  INTEGER DEFAULT 0,
      total_tokens    INTEGER DEFAULT 0,
      last_error      TEXT DEFAULT NULL,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

// ── Session functions ──────────────────────────────────────────

function createSession () {
  const id = generateId()
  getDb().prepare('INSERT INTO sessions (id) VALUES (?)').run(id)
  return id
}

function getLatestSession () {
  const row = getDb().prepare(
    'SELECT id FROM sessions ORDER BY rowid DESC LIMIT 1'
  ).get()
  return row ? row.id : null
}

// ── Message functions ──────────────────────────────────────────

function saveMessage (sessionId, role, content, providerUsed, tokenCount = 0) {
  const id = generateId()
  getDb().prepare(`
    INSERT INTO messages (id, session_id, role, content, provider_used, token_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, role, content, providerUsed, tokenCount)

  getDb().prepare(
    "UPDATE sessions SET updated_at = datetime('now') WHERE id = ?"
  ).run(sessionId)

  return id
}

function getRecentMessages (sessionId, limit = 10) {
  const all = getDb().prepare(`
    SELECT role, content, provider_used, created_at
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId)
  return all.slice(-limit)
}

function getHistory (limit = 20) {
  return getDb().prepare(`
    SELECT role, content, provider_used, created_at, session_id
    FROM messages
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit)
}

// ── Memory functions ───────────────────────────────────────────

function setMemory (key, value) {
  getDb().prepare(`
    INSERT INTO user_memory (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value)
}

function getMemory (key) {
  const row = getDb().prepare(
    'SELECT value FROM user_memory WHERE key = ?'
  ).get(key)
  return row ? row.value : null
}

function getAllMemory () {
  const rows = getDb().prepare(
    'SELECT key, value FROM user_memory ORDER BY key ASC'
  ).all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

function deleteMemory (key) {
  getDb().prepare('DELETE FROM user_memory WHERE key = ?').run(key)
}

// ── Provider status functions ──────────────────────────────────

function setProviderCooldown (name, durationMs) {
  const cooldownUntil = Date.now() + durationMs
  getDb().prepare(`
    INSERT INTO provider_status (name, cooldown_until, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      cooldown_until = excluded.cooldown_until,
      last_error = NULL,
      updated_at = excluded.updated_at
  `).run(name, cooldownUntil)
}

function setProviderError (name, errorMessage) {
  getDb().prepare(`
    INSERT INTO provider_status (name, last_error, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).run(name, errorMessage ?? null)
}

function incrementProviderStats (name, tokens) {
  getDb().prepare(`
    INSERT INTO provider_status (name, total_requests, total_tokens, updated_at)
    VALUES (?, 1, ?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      total_requests = total_requests + 1,
      total_tokens   = total_tokens + excluded.total_tokens,
      updated_at     = excluded.updated_at
  `).run(name, tokens)
}

function getProviderStatus (name) {
  return getDb().prepare(
    'SELECT * FROM provider_status WHERE name = ?'
  ).get(name) || {
    name,
    cooldown_until: 0,
    total_requests: 0,
    total_tokens: 0,
    last_error: null
  }
}

function getAllProviderStatus () {
  return getDb().prepare(
    'SELECT * FROM provider_status ORDER BY name ASC'
  ).all()
}

function isProviderOnCooldown (name) {
  const status = getProviderStatus(name)
  return Date.now() < status.cooldown_until
}

// ── Utility ───────────────────────────────────────────────────

function generateId () {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function closeDb () {
  if (db) {
    db.close()
    db = null
  }
}

module.exports = {
  getDb,
  createSession,
  getLatestSession,
  saveMessage,
  getRecentMessages,
  getHistory,
  setMemory,
  getMemory,
  getAllMemory,
  deleteMemory,
  setProviderCooldown,
  setProviderError,
  incrementProviderStats,
  getProviderStatus,
  getAllProviderStatus,
  isProviderOnCooldown,
  closeDb
}