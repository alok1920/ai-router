# ai-router

![CI](https://github.com/alok1920/ai-router/actions/workflows/ci.yml/badge.svg)
![npm version](https://img.shields.io/npm/v/ai-router)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)

**Universal AI memory and credit router.**

Stop re-explaining yourself every time you switch AI tools. ai-router remembers your preferences, keeps your conversation history, and automatically switches to the next provider when one runs out — all from your terminal.

---

## The Problem

You use multiple AI tools. Every time you switch — because a free tier ran out, because you want a second opinion, because one is better at a specific task — you start from scratch. No memory of your preferences. No context of what you were working on. Every session a blank slate.

ai-router fixes this. One tool. Any provider. Persistent memory.

---

## How It Works

```
You type a message
        ↓
ai-router picks the best available provider
        ↓
If that provider hits a limit or cap → switches automatically
        ↓
The new provider gets your full conversation context + preferences
        ↓
You never notice the switch happened
```

Your preferences — language, tone, coding style — are stored once and injected into every prompt, across every provider, forever.

---

## Install

```bash
npm install -g ai-router
```

Requires Node.js 22 or higher.

---

## Quick Start

```bash
# 1. Run guided setup — takes about 2 minutes
ai-router setup

# 2. Start chatting
ai-router chat
```

---

## Commands

### `ai-router setup`
Guided onboarding. Asks your name, language, tone, and expertise. Walks through adding providers. Re-run anytime to update one setting.

```bash
ai-router setup
```

---

### `ai-router chat`
Start a conversation. Optionally attach a project folder for code-aware context.

```bash
ai-router chat
ai-router chat --project ./my-project
```

**In-chat commands:**

| Command | What it does |
|---|---|
| `/status` | Show all provider states and last errors |
| `/new` | Start a fresh session |
| `/exit` | Quit |

---

### `ai-router provider`
Add, list, remove, and test providers. No code changes ever needed.

```bash
ai-router provider add        # guided setup — search by name, paste key
ai-router provider list       # show all configured providers and status
ai-router provider remove     # remove a provider
ai-router provider test       # verify a provider key works
ai-router provider update     # update a key or model name
```

**Adding any provider:**
```bash
ai-router provider add

? Search for a provider: groq

  ● Groq — free tier, fast inference
  ○ My provider is not in this list

? Groq API key: **********************
  Testing connection...  ✓
✓ Groq connected and saved
```

**Adding a local model (Ollama):**
```bash
ai-router provider add
# Search: ollama
# No API key needed — just enter which model you pulled
```

**Adding any custom provider:**
```bash
ai-router provider add
# Search your provider name
# If not found — tool auto-detects endpoint from name
# Only asks for URL if auto-detection fails
```

---

### `ai-router cap`
Set your own daily token limit per provider — below the real API limit. Router switches to the next provider automatically when your cap is hit.

```bash
ai-router cap set claude 3000     # stop using Claude at 3,000 tokens/day
ai-router cap set groq 10000      # stop using Groq at 10,000 tokens/day
ai-router cap show                # show usage bars for all providers
ai-router cap remove claude       # remove cap for Claude
```

Example output of `cap show`:
```
  Groq
  ████████░░░░░░░░░░░░ 40%
  4,000 / 10,000 tokens today

  Claude
  ██████████████████░░ 90%
  2,700 / 3,000 tokens today
```

---

### `ai-router sequence`
Set the order providers are tried per context type.

```bash
ai-router sequence coding claude groq gemini
ai-router sequence general gemini groq
ai-router sequence show
ai-router sequence remove coding
```

When you start a chat, the router follows your sequence for that context type. If no sequence is set for the current context, it falls back to the `general` sequence.

---

### `ai-router index`
Index a project folder so ai-router understands your codebase. Code context is injected automatically into every chat question about that project.

```bash
ai-router index ./my-project
ai-router index .               # index current directory
```

If Python 3.10+ is installed, graphify is set up automatically in an isolated environment and builds a full knowledge graph. If Python is not available, the built-in compressor extracts function names, class names, and exports from your source files.

Use `--project` in chat to activate the index:
```bash
ai-router chat --project ./my-project
```

---

### `ai-router memory`
Store preferences that persist across every session and every provider.

```bash
ai-router memory show
ai-router memory set language Hindi
ai-router memory set tone casual
ai-router memory set expertise intermediate
ai-router memory set style "no inline comments in code"
ai-router memory delete language
```

Once set, every AI you talk to through ai-router knows these automatically. No need to repeat yourself.

---

### `ai-router history`
Show recent conversation history across all sessions and providers.

```bash
ai-router history
```

---

## Supported Providers

ai-router works with any AI provider. A built-in directory covers the most common ones — just search by name and paste your key.

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
| Any custom LLM | Varies | If it has an HTTP endpoint, it works |

**Free API keys:**
- Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Groq: [console.groq.com/keys](https://console.groq.com/keys)

---

## Failover

When a provider hits a rate limit or your personal cap, ai-router switches automatically.

```
Gemini Flash hits rate limit or daily cap
        ↓
ai-router sets Gemini on cooldown
        ↓
Retries with next provider in your sequence
        ↓
Full conversation context travels with the switch
        ↓
Type /status to see what happened
```

---

## Memory

Stored permanently in a local database at `~/.ai-router/`. Injected into every prompt sent to any provider. Survives closing and reopening the tool.

```bash
ai-router memory set language Hindi
# Every AI responds in Hindi from now on
# Works across Gemini, Groq, Claude — any provider you configure
```

---

## Where Your Data Lives

Everything stays on your machine at `~/.ai-router/`:

```
~/.ai-router/
  config.json     your providers, sequences, and caps
  .env            your API keys
  memory.db       conversation history and preferences
  graphs/         project indexes from ai-router index
  logs/           debug logs (never pushed to GitHub)
  venv/           Python environment for graphify (if used)
```

The package files are never modified. Nothing is sent anywhere except the API calls to your configured providers.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Your Terminal                   │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│              src/commands/                       │
│   setup · chat · provider · cap · sequence       │
│   index · memory · history                       │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│               src/router.js                      │
│   Reads config → picks provider by sequence      │
│   Enforces caps → handles failover               │
└────┬──────────────┬──────────────┬──────────────┘
     │              │              │
┌────▼─────────┐ ┌──▼──────────┐ ┌▼──────────────┐
│ adapters/    │ │ adapters/   │ │ adapters/     │
│ google.js    │ │ openai-     │ │ anthropic.js  │
│ all Gemini   │ │ compatible  │ │ all Claude    │
│ models       │ │ .js         │ │ models        │
│              │ │ Groq,Mistral│ │               │
│              │ │ Ollama,GPT  │ │               │
└──────────────┘ │ any custom  │ └───────────────┘
                 └─────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│           ~/.ai-router/                          │
│   config.json · .env · memory.db · graphs/       │
└─────────────────────────────────────────────────┘
```

---

## License

MIT — free to use, modify, and distribute.