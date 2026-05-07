# @alok1910/ai-router

![CI](https://github.com/alok1920/ai-router/actions/workflows/ci.yml/badge.svg)
![npm version](https://img.shields.io/npm/v/@alok1910/ai-router)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)

**Universal AI memory and credit router.**

Stop re-explaining yourself every time you switch AI tools. ai-router remembers your preferences, keeps your conversation history, and automatically switches to the next provider when one runs out — all from your terminal with natural scroll and inline commands.

---

## Install

```bash
npm install -g @alok1910/ai-router
```

Requires Node.js 22 or higher.

---

## Quick Start

```bash
# 1. Configure providers and preferences
ai-router setup

# 2. Start chatting
ai-router chat
```

---

## What It Looks Like

```
  ╔════════════════════════════════════════╗
  ║ AI Router v0.7.0                       ║
  ║ Universal AI Memory & Router           ║
  ╚════════════════════════════════════════╝

  Type a message to chat  ·  /help for commands

  Providers  ● Groq  ·  ● Gemini Flash

  You: explain how the router works

  ◆ Groq
  ────────────────────────────────────────
  The router tries each provider in your
  configured sequence. If one hits a rate
  limit or your personal cap, it switches
  automatically to the next one...
  ────────────────────────────────────────

  You: /cap
  Token Caps

  Groq
  ████████░░░░░░░░░░░░ 40%
  4,000 / 10,000 tokens today

  Gemini Flash
  ██████████████████░░ 90%
  2,700 / 3,000 tokens today

  You: /cap set groq 15000
  ✓ Groq cap set to 15,000 tokens/day
```

---

## Slash Commands Inside Chat

All commands work inline — no need to exit and re-enter.

| Command | What it does |
|---|---|
| `/help` | Show all available commands |
| `/cap` | Show token usage and caps with progress bars |
| `/cap set <provider> <n>` | Set daily token cap |
| `/cap remove <provider>` | Remove a cap |
| `/memory` | Show stored preferences |
| `/memory set <key> <value>` | Update a preference |
| `/memory delete <key>` | Remove a preference |
| `/status` | Show provider states and last errors |
| `/providers` | Same as /status |
| `/sequence` | Show priority sequences |
| `/history` | Show recent conversation history |
| `/index [path]` | Re-index project for code context |
| `/clear` | Clear the screen |
| `/new` | Start a fresh session |
| `/exit` or `/quit` | Quit ai-router |

---

## Commands

### `ai-router chat`
Start a conversation. Natural terminal scroll — use your trackpad or mouse wheel to scroll through history.

```bash
ai-router chat
ai-router chat --project ./my-project   # with code context
```

### `ai-router setup`
Guided onboarding. Configure your name, language, tone, and add providers.

```bash
ai-router setup
```

### `ai-router provider`
Add, list, remove, and test providers. No code changes ever needed.

```bash
ai-router provider add        # search by name, paste key, done
ai-router provider list       # show all configured providers
ai-router provider remove     # remove a provider
ai-router provider test       # verify a provider key works
ai-router provider update     # update a key or model name
```

**Adding any provider:**
```bash
ai-router provider add

? Search for a provider: groq
  ● Groq — free tier, fast inference

? Groq API key: **********************
✓ Groq connected and saved
```

**Adding Ollama (local, no API key needed):**
```bash
ai-router provider add
# Search: ollama
# Enter which model you pulled: llama3
```

### `ai-router cap`
Set your own daily token limit per provider — below the real API limit.

```bash
ai-router cap set Groq 10000
ai-router cap show
ai-router cap remove "Gemini Flash"
```

### `ai-router sequence`
Set provider priority order per context type.

```bash
ai-router sequence set coding "Gemini Flash" Groq
ai-router sequence set general Groq "Gemini Flash"
ai-router sequence show
ai-router sequence remove coding
```

### `ai-router index`
Index a project folder for code-aware AI responses.

```bash
ai-router index ./my-project
ai-router index .
```

Uses graphify if Python 3.10+ is available. Falls back to built-in compressor otherwise.

### `ai-router memory`
Store preferences that persist across every session and provider.

```bash
ai-router memory show
ai-router memory set language Hindi
ai-router memory set tone casual
ai-router memory set expertise intermediate
ai-router memory delete language
```

### `ai-router history`
Show recent conversation history.

```bash
ai-router history
```

---

## Supported Providers

| Provider | Free API | Notes |
|---|---|---|
| **Gemini Flash** | ✅ Yes | Default first provider |
| **Groq** | ✅ Yes | Default second provider |
| Claude (Anthropic) | ❌ Paid | Add with: provider add |
| OpenAI GPT | ❌ Paid | Add with: provider add |
| Mistral | ❌ Paid | Add with: provider add |
| Perplexity | ❌ Paid | Add with: provider add |
| Ollama (local) | ✅ Free | Runs on your machine |
| LM Studio (local) | ✅ Free | Runs on your machine |
| Any custom LLM | Varies | Any HTTP endpoint works |

**Free API keys:**
- Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Groq: [console.groq.com/keys](https://console.groq.com/keys)

---

## How Failover Works

```
You send a message
        ↓
Router tries first provider in your sequence
        ↓
Provider hits rate limit or your personal cap
        ↓
Router switches to next provider automatically
        ↓
Full conversation context carries over
        ↓
You see which provider responded in [brackets]
```

Type `/status` at any time to see exactly what each provider is doing and why.

---

## Memory

Stored permanently at `~/.ai-router/memory.db`. Injected into every prompt sent to any provider. Survives closing and reopening the tool.

```bash
ai-router memory set language Hindi
# Every AI responds in Hindi from now on
# Works across Groq, Gemini, Claude — any provider you configure
```

---

## Code Context

Index your project once and every code question gets compressed context automatically:

```bash
ai-router index ./my-project
ai-router chat --project ./my-project

# Now ask: what files handle routing?
# AI knows your actual project structure
```

---

## Where Your Data Lives

Everything stays on your machine at `~/.ai-router/`:

```
~/.ai-router/
  config.json     providers, sequences, caps
  .env            your API keys
  memory.db       conversation history and preferences
  graphs/         project indexes from ai-router index
  logs/           debug logs
  venv/           Python environment for graphify
```

Nothing is sent anywhere except API calls to your configured providers.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              ai-router chat                      │
│  Natural scroll · Inline /commands · No exit     │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│               src/router.js                      │
│   Reads config → sequence → enforces caps        │
│   Handles failover automatically                 │
└────┬──────────────┬──────────────┬──────────────┘
     │              │              │
┌────▼─────────┐ ┌──▼────────────┐ ┌▼─────────────┐
│ google.js    │ │openai-compat  │ │ anthropic.js  │
│ All Gemini   │ │Groq,GPT,Ollama│ │ All Claude    │
└──────────────┘ └───────────────┘ └──────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│           ~/.ai-router/                          │
│   config.json · .env · memory.db · graphs/       │
└─────────────────────────────────────────────────┘
```

---

## License

MIT — free to use, modify, and distribute.