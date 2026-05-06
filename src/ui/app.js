'use strict'

const React    = require('react')
const { render, Box, Text, useInput, useApp, useStdout } = require('ink')
const TextInput = require('ink-text-input').default || require('ink-text-input')

const { Welcome }        = require('./welcome')
const { ChatPanel }      = require('./chat-panel')
const { StatusBar }      = require('./status-bar')
const { CommandPalette } = require('./command-palette')
const { Thinking }       = require('./thinking')

const cfg    = require('../config')
const db     = require('../db')
const { route, getProviderList } = require('../router')
const logger = require('../logger')
const { capShow }      = require('../commands/cap')
const { memoryShow }   = require('../commands/memory')
const { sequenceShow } = require('../commands/sequence')
const { providerList } = require('../commands/provider')
const { indexProject } = require('../commands/index-cmd')
const compressor       = require('../compressor')
const pythonManager    = require('../python-manager')
const path             = require('path')

// ── App component ──────────────────────────────────────────────

function App ({ projectPath, initialProviders, initialMemory }) {
  const { exit }      = useApp()
  const { stdout }    = useStdout()

  const [messages,    setMessages]    = React.useState([])
  const [input,       setInput]       = React.useState('')
  const [loading,     setLoading]     = React.useState(false)
  const [activeProvider, setActiveProvider] = React.useState(null)
  const [showWelcome, setShowWelcome] = React.useState(true)
  const [showPalette, setShowPalette] = React.useState(false)
  const [providers,   setProviders]   = React.useState(initialProviders)
  const [notification, setNotification] = React.useState(null)
  const [sessionId,   setSessionId]   = React.useState(() => {
    let id = db.getLatestSession()
    if (!id) id = db.createSession()
    return id
  })

  const terminalHeight = stdout ? stdout.rows : 24

  // Build system prompt from memory + code context
  const systemPrompt = React.useMemo(() => {
    const memory = db.getAllMemory()
    const lines  = [
      'You are a helpful AI assistant continuing an ongoing conversation.',
      'The conversation history is ground truth — treat it as your own prior responses.',
      'Do not mention which AI model you are unless directly asked.'
    ]
    if (Object.keys(memory).length > 0) {
      lines.push('\nUser preferences (always respect these):')
      for (const [k, v] of Object.entries(memory)) {
        lines.push(`- ${k}: ${v}`)
      }
    }
    if (projectPath) {
      const report = pythonManager.getGraphReport(projectPath)
      if (report) {
        lines.push('\nProject context:')
        lines.push(report.slice(0, 3000))
      } else {
        const compressed = compressor.loadCompressed(projectPath)
        if (compressed) {
          lines.push('\nProject context:')
          lines.push(compressor.formatForPrompt(compressed))
        }
      }
    }
    return lines.join('\n')
  }, [projectPath])

  // Refresh provider list
  const refreshProviders = React.useCallback(() => {
    setProviders(getProviderList())
  }, [])

  // Add a notification that auto-clears
  const notify = React.useCallback((msg, color = 'gray') => {
    setNotification({ msg, color })
    setTimeout(() => setNotification(null), 3000)
  }, [])

  // ── Command handler ────────────────────────────────────────────

  const handleCommand = React.useCallback(async (cmd) => {
    const parts = cmd.trim().split(/\s+/)
    const base  = parts[0]

    setShowWelcome(false)

    if (base === '/exit' || base === '/quit') {
      db.closeDb()
      exit()
      return
    }

    if (base === '/new') {
      const id = db.createSession()
      setSessionId(id)
      setMessages([])
      notify('New session started', 'green')
      return
    }

    if (base === '/clear') {
      setMessages([])
      return
    }

    if (base === '/status' || base === '/providers') {
      refreshProviders()
      const list = getProviderList()
      const lines = list.map(p =>
        `${p.name}: ${p.status}${p.cap ? ` (${p.dailyUsed}/${p.cap} tokens)` : ''}`
      ).join('\n')
      addSystemMessage(lines)
      return
    }

    if (base === '/cap') {
      if (parts[1] === 'set' && parts[2] && parts[3]) {
        const { setCap } = require('../commands/cap')
        // Find provider by case-insensitive match
        const allProviders = cfg.getProviders()
        const found = allProviders.find(
          p => p.name.toLowerCase() === parts.slice(2, -1).join(' ').toLowerCase()
        )
        if (found) {
          cfg.setCap(found.name, parseInt(parts[parts.length - 1], 10))
          notify(`Cap set: ${found.name} → ${parts[parts.length - 1]} tokens/day`, 'green')
          refreshProviders()
        } else {
          notify(`Provider not found: ${parts.slice(2, -1).join(' ')}`, 'red')
        }
      } else {
        const list   = getProviderList()
        const capStr = list
          .filter(p => p.configured)
          .map(p => {
            if (!p.cap) return `${p.name}: no cap`
            const exceeded = p.dailyUsed > p.cap
            return `${p.name}: ${p.dailyUsed.toLocaleString()}/${p.cap.toLocaleString()} tokens${exceeded ? ' EXCEEDED' : ''}`
          })
          .join('\n')
        addSystemMessage(capStr || 'No providers configured')
      }
      return
    }

    if (base === '/memory') {
      if (parts[1] === 'set' && parts[2] && parts[3]) {
        db.setMemory(parts[2], parts.slice(3).join(' '))
        notify(`Memory updated: ${parts[2]} = ${parts.slice(3).join(' ')}`, 'green')
      } else {
        const mem = db.getAllMemory()
        const str = Object.entries(mem).map(([k, v]) => `${k}: ${v}`).join('\n')
        addSystemMessage(str || 'No preferences stored')
      }
      return
    }

    if (base === '/sequence') {
      const seqs = cfg.getSequences()
      const str  = Object.entries(seqs)
        .map(([ctx, order]) => `${ctx}: ${order.join(' → ')}`)
        .join('\n')
      addSystemMessage(str || 'No sequences configured')
      return
    }

    if (base === '/index') {
      const target = parts[1] || projectPath || process.cwd()
      notify(`Indexing ${target}...`, 'gray')
      try {
        await indexProject(target, { skipHook: true })
        notify('Index updated', 'green')
      } catch (err) {
        notify(`Index failed: ${err.message}`, 'red')
      }
      return
    }

    if (base === '/help') {
      const helpText = [
        '/cap              show token usage',
        '/cap set P N      set cap for provider P to N tokens',
        '/clear            clear the screen',
        '/exit             quit ai-router',
        '/help             show this help',
        '/index [path]     re-index project',
        '/memory           show preferences',
        '/memory set k v   set a preference',
        '/new              start fresh session',
        '/providers        show provider status',
        '/sequence         show priority sequences',
        '/status           show provider states'
      ].join('\n')
      addSystemMessage(helpText)
      return
    }

    notify(`Unknown command: ${base}. Type /help to see all commands.`, 'yellow')
  }, [exit, notify, refreshProviders, projectPath, sessionId])

  // ── Message sender ─────────────────────────────────────────────

  const sendMessage = React.useCallback(async (text) => {
    if (!text.trim()) return

    setShowWelcome(false)
    const userMsg = {
      role:      'user',
      content:   text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const result = await route(sessionId, text, systemPrompt)
      setActiveProvider(result.provider)
      setMessages(prev => [...prev, {
        role:      'assistant',
        content:   result.text,
        provider:  result.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
      refreshProviders()
    } catch (err) {
      setMessages(prev => [...prev, {
        role:     'assistant',
        content:  `Error: ${err.message}`,
        provider: 'System'
      }])
      logger.error(err.message)
    } finally {
      setLoading(false)
      setActiveProvider(null)
    }
  }, [sessionId, systemPrompt, refreshProviders])

  // Add a system info message to chat
  const addSystemMessage = React.useCallback((content) => {
    setMessages(prev => [...prev, {
      role:     'assistant',
      content,
      provider: 'System'
    }])
  }, [])

  // ── Input handler ──────────────────────────────────────────────

  const handleInputChange = React.useCallback((val) => {
    setInput(val)
    if (val.startsWith('/')) {
      setShowPalette(true)
    } else {
      setShowPalette(false)
    }
  }, [])

  const handleSubmit = React.useCallback(async (val) => {
    const text = val.trim()
    setInput('')
    setShowPalette(false)

    if (!text) return

    if (text.startsWith('/')) {
      await handleCommand(text)
    } else {
      await sendMessage(text)
    }
  }, [handleCommand, sendMessage])

  const handlePaletteSelect = React.useCallback((cmd) => {
    setInput(cmd + ' ')
    setShowPalette(false)
  }, [])

  const handlePaletteClose = React.useCallback(() => {
    setShowPalette(false)
  }, [])

  // ── Render ─────────────────────────────────────────────────────

  return React.createElement(Box, {
    flexDirection: 'column',
    height:        terminalHeight
  },

    // Welcome screen (shown until first interaction)
    showWelcome
      ? React.createElement(Welcome, {
          userName:  initialMemory.name,
          providers: providers,
          memory:    initialMemory
        })
      : null,

    // Chat history (scrollable, takes available space)
    !showWelcome
      ? React.createElement(ChatPanel, {
          messages,
          terminalHeight
        })
      : null,

    // Thinking indicator
    loading
      ? React.createElement(Thinking, { provider: activeProvider })
      : null,

    // Notification
    notification
      ? React.createElement(Box, { paddingLeft: 2 },
          React.createElement(Text, { color: notification.color },
            '  ' + notification.msg
          )
        )
      : null,

    // Command palette (shown when input starts with /)
    showPalette
      ? React.createElement(CommandPalette, {
          query:    input,
          onSelect: handlePaletteSelect,
          onClose:  handlePaletteClose
        })
      : null,

    // Status bar
    React.createElement(Box, {
      borderStyle: 'single',
      borderColor: 'gray',
      borderTop:   true,
      borderBottom: false,
      borderLeft:  false,
      borderRight: false,
      marginTop:   0
    },
      React.createElement(StatusBar, { providers })
    ),

    // Fixed input bar at bottom
    React.createElement(Box, {
      borderStyle:  'round',
      borderColor:  'green',
      paddingLeft:  1,
      paddingRight: 1,
      marginLeft:   1,
      marginRight:  1
    },
      React.createElement(Text, { color: 'cyan', bold: true }, '> '),
      React.createElement(TextInput, {
        value:       input,
        onChange:    handleInputChange,
        onSubmit:    handleSubmit,
        placeholder: 'Type a message or / for commands...'
      })
    )
  )
}

// ── Launch function ────────────────────────────────────────────

function launchApp (options = {}) {
  cfg.loadEnv()
  cfg.ensureHomeDir()

  const providers = getProviderList()
  const memory    = db.getAllMemory()

  const { waitUntilExit } = render(
    React.createElement(App, {
      projectPath:      options.project ? path.resolve(options.project) : null,
      initialProviders: providers,
      initialMemory:    memory
    }),
    { exitOnCtrlC: true }
  )

  return waitUntilExit()
}

module.exports = { launchApp }
