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
If that provider hits a limit → switches automatically
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
# 1. Run guided setup
ai-router setup

# 2. Start chatting
ai-router chat
```

`setup` walks you through everything — your name, language preference, and adding your first providers. Takes about 2 minutes.

---

## Commands

### `ai-router setup`
First-time configuration and onboarding. Asks your preferences and walks through adding providers interactively. Re-run anytime to update settings.

```bash
ai-router setup
```

---

### `ai-router chat`
Start a conversation.

```bash
ai-router chat
```

**In-chat commands:**

| Command | What it does |
|---|---|
| `/status` | Show all provider states and last errors |
| `/new` | Start a fresh session |
| `/exit` | Quit |

---

### `ai-router providers`
Show all configured providers and their status.

```bash
ai-router providers
```

---

### `ai-router provider`
Add, remove, and manage your AI providers. No code changes ever needed.

```bash
ai-router provider add       # guided prompts — name, key, auto-detected endpoint
ai-router provider list      # show all configured providers
ai-router provider remove    # remove a provider
ai-router provider test      # verify a provider's key works
ai-router provider update    # update a key or model name
```

**Adding a provider:**
```bash
ai-router provider add

? Which provider are you adding?
  Search: groq

  ● Groq — free tier, no card needed
  ○ My provider is not in this list

? Groq API key: **********************
✓ Testing connection...  working
✓ Groq added
```

Most providers are in the built-in list — just search by name and paste your key. For providers not in the list, the tool auto-detects the endpoint. You only need to provide a URL if auto-detection fails.

**Adding a local model (Ollama):**
```bash
ai-router provider add
# Search for "ollama"
# No API key needed — just select which model you pulled
```

---

### `ai-router memory`
Store preferences that persist across every session and every provider.

```bash
ai-router memory show
ai-router memory set <key> <value>
ai-router memory delete <key>
```

**Examples:**
```bash
ai-router memory set language Hindi
ai-router memory set tone casual
ai-router memory set expertise intermediate
ai-router memory set style "no inline comments in code"
```

Once set, every AI you talk to through ai-router knows these automatically.

---

### `ai-router history`
Show recent conversation history across all sessions and providers.

```bash
ai-router history
```

---

## Supported Providers

ai-router works with any AI provider. A built-in directory covers the most common ones:

| Provider | Free API | Notes |
|---|---|---|
| **Gemini Flash** | ✅ Yes | Default first provider |
| **Groq** | ✅ Yes | Default second provider |
| Claude (Anthropic) | ❌ Paid | Coming in v0.5 |
| OpenAI GPT | ❌ Paid | Coming in v0.5 |
| Mistral | ❌ Paid | Coming in v0.5 |
| Ollama (local) | ✅ Free | Runs on your machine |
| LM Studio (local) | ✅ Free | Runs on your machine |
| Any custom LLM | Varies | If it has an HTTP endpoint, it works |

**Getting free API keys:**
- Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Groq: [console.groq.com/keys](https://console.groq.com/keys)

---

## Failover

When a provider hits a rate limit, ai-router switches automatically.

```
Gemini Flash hits rate limit (429)
        ↓
ai-router sets Gemini on 60s cooldown
        ↓
Retries immediately with the next provider
        ↓
Your full conversation context travels with the switch
        ↓
Type /status to see what happened
```

---

## Memory

Stored permanently in a local SQLite database. Injected into every prompt sent to any provider. Survives closing and reopening the tool.

```bash
ai-router memory set language Hindi
# Every AI responds in Hindi from now on
# Works across Gemini, Groq, Claude — any provider you configure
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Your Terminal                   │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│              commands.js                         │
│    Parses input · injects memory · routes        │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│               router.js                          │
│   Picks provider · failover · cooldowns          │
└────┬──────────────┬──────────────┬──────────────┘
     │              │              │
┌────▼─────┐ ┌──────▼──┐ ┌────────▼─────────────┐
│  Gemini  │ │  Groq   │ │  Any provider you add │
│  (free)  │ │  (free) │ │  via: provider add    │
└──────────┘ └─────────┘ └──────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│           ~/.ai-router/                          │
│   config.json · .env · memory.db                │
│   Your data — never inside the package          │
└─────────────────────────────────────────────────┘
```

All your data lives in `~/.ai-router/` on your machine. The package files are never modified. Nothing is sent anywhere except the API calls to your configured providers.

---

## License

MIT — free to use, modify, and distribute.