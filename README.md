# @alok1910/ai-router

![CI](https://github.com/alok1920/ai-router/actions/workflows/ci.yml/badge.svg)
![npm version](https://img.shields.io/npm/v/@alok1910/ai-router)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)

**Universal AI memory and credit router with rich terminal UI.**

Stop re-explaining yourself every time you switch AI tools. ai-router remembers your preferences, keeps your conversation history, and automatically switches to the next provider when one runs out — with a full-screen terminal experience that feels like a real product.

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

# 2. Launch the full TUI experience
ai-router start

# Or use plain terminal mode
ai-router chat
```

---

## ai-router start

Launches a full-screen terminal UI. Fixed input bar at the bottom. Chat history scrolls above it. Status bar shows provider and token usage at all times.

```
  ╔═══════════════════════════════════╗
  ║         AI Router  v0.6.0         ║
  ║   Universal AI Memory & Router    ║
  ╚═══════════════════════════════════╝

  Welcome back, Alok!

  Providers:
    ● Gemini Flash — ready
    ● Groq — ready

  Type / to see all commands   Ctrl+C to quit
```

Once you start chatting the welcome screen gives way to your conversation:

```
  You  09:32
    what files are in this project?

  Gemini Flash  09:32
    The project contains: src/adapters/, src/commands/,
    src/ui/, src/router.js, src/config.js...

  ─────────────────────────────────────────────────
  ● Gemini Flash  124/300 tokens    ● Groq  0/3000
  ╭─────────────────────────────────────────────╮
  │ > Type a message or / for commands...       │
  ╰─────────────────────────────────────────────╯
```

---

## Commands

### `ai-router start`
Launch the full-screen TUI. Fixed input bar, scrollable history, command palette.

```bash
ai-router start
ai-router start --project ./my-project   # with code context
```

### `ai-router chat`
Plain terminal fallback. Works in scripts and CI environments.

```bash
ai-router chat
ai-router chat --project ./my-project
```

### `ai-router setup`
Guided onboarding. Configure providers, preferences, and API keys.

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

### `ai-router cap`
Set your own daily token limit per provider.

```bash
ai-router cap set "Gemini Flash" 300
ai-router cap show
ai-router cap remove Groq
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

### `ai-router memory`
Store preferences that persist across every session and every provider.

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

## Slash Commands Inside the TUI

Type `/` in the input bar to open the command palette. Filter by typing, navigate with arrow keys, select with Enter.

| Command | What it does |
|---|---|
| `/cap` | Show token usage and caps |
| `/cap set <provider> <n>` | Set a daily token cap |
| `/clear` | Clear the screen |
| `/exit` | Quit ai-router |
| `/help` | Show all commands |
| `/index [path]` | Re-index project |
| `/memory` | Show stored preferences |
| `/memory set <key> <value>` | Update a preference |
| `/new` | Start a fresh session |
| `/providers` | Show provider status |
| `/sequence` | Show priority sequences |
| `/status` | Show current provider state |

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

## How It Works

```
You type a message
        ↓
ai-router picks the best available provider
        ↓
If that provider hits a limit or cap → switches automatically
        ↓
The new provider gets your full context + preferences
        ↓
You never notice the switch happened
```

---

## Where Your Data Lives

Everything stays on your machine at `~/.ai-router/`:

```
~/.ai-router/
  config.json     providers, sequences, and caps
  .env            your API keys
  memory.db       conversation history and preferences
  graphs/         project indexes from ai-router index
  logs/           debug logs
  venv/           Python environment for graphify
```

Nothing is sent anywhere except the API calls to your configured providers.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│            ai-router start (Ink TUI)            │
│  Fixed input · Scrollable history · / palette   │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│               src/router.js                      │
│   Reads config → picks provider by sequence      │
│   Enforces caps → handles failover               │
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