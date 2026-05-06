'use strict'

const React  = require('react')
const { Box, Text } = require('ink')

function StatusBar ({ providers }) {
  const configured = providers.filter(p => p.configured)

  return React.createElement(Box, {
    paddingLeft:  2,
    paddingRight: 2,
    paddingTop:   0
  },
    ...configured.map((p, i) => {
      const isReady    = p.status === 'ready'
      const isExceeded = p.status.includes('cap') || p.status.includes('exceeded')
      const isCooldown = p.status.includes('cooling')

      const dot   = isReady ? '●' : isCooldown ? '◐' : '○'
      const color = isReady ? 'green' : isCooldown ? 'yellow' : 'red'

      const tokenStr = p.cap
        ? `${p.dailyUsed.toLocaleString()}/${p.cap.toLocaleString()}`
        : `${p.dailyUsed.toLocaleString()} tokens`

      return React.createElement(Box, { key: p.name, marginRight: 3 },
        React.createElement(Text, { color }, dot + ' '),
        React.createElement(Text, { color: 'white' }, p.name + ' '),
        React.createElement(Text, { color: isExceeded ? 'red' : 'gray' }, tokenStr)
      )
    })
  )
}

module.exports = { StatusBar }
