'use strict'

const React   = require('react')
const { Box, Text } = require('ink')
const { h }   = { h: React.createElement }

const LOGO = [
  '  ╔═══════════════════════════════════╗',
  '  ║         AI Router  v0.6.0         ║',
  '  ║   Universal AI Memory & Router    ║',
  '  ╚═══════════════════════════════════╝'
]

function Welcome ({ userName, providers, memory }) {
  const ready    = providers.filter(p => p.status === 'ready' && p.configured)
  const notReady = providers.filter(p => !p.configured)

  return React.createElement(Box, {
    flexDirection: 'column',
    paddingBottom: 1
  },
    // Logo
    React.createElement(Box, { flexDirection: 'column', marginBottom: 1 },
      ...LOGO.map((line, i) =>
        React.createElement(Text, { key: i, color: 'green' }, line)
      )
    ),

    // Welcome message
    userName
      ? React.createElement(Text, { color: 'white' },
          `  Welcome back, ${userName}!`
        )
      : React.createElement(Text, { color: 'white' },
          '  Welcome to AI Router'
        ),

    React.createElement(Box, { height: 1 }),

    // Provider status
    React.createElement(Text, { color: 'gray' }, '  Providers:'),
    ...ready.map(p =>
      React.createElement(Text, { key: p.name, color: 'green' },
        `    ● ${p.name} — ready`
      )
    ),
    ...notReady.map(p =>
      React.createElement(Text, { key: p.name, color: 'gray' },
        `    ○ ${p.name} — not configured`
      )
    ),

    React.createElement(Box, { height: 1 }),

    // Memory summary
    memory && Object.keys(memory).length > 0
      ? React.createElement(Box, { flexDirection: 'column' },
          React.createElement(Text, { color: 'gray' }, '  Preferences:'),
          ...Object.entries(memory).slice(0, 4).map(([k, v]) =>
            React.createElement(Text, { key: k, color: 'gray' },
              `    ${k}: ${v}`
            )
          )
        )
      : null,

    React.createElement(Box, { height: 1 }),

    // Tips
    React.createElement(Text, { color: 'gray' },
      '  Type / to see all commands   Ctrl+C to quit'
    )
  )
}

module.exports = { Welcome }
