'use strict'

const React  = require('react')
const { Box, Text, useInput } = require('ink')

const ALL_COMMANDS = [
  { cmd: '/cap',          desc: 'show token usage and caps' },
  { cmd: '/cap set',      desc: 'set a token cap  e.g. /cap set Groq 5000' },
  { cmd: '/clear',        desc: 'clear the screen' },
  { cmd: '/exit',         desc: 'quit ai-router' },
  { cmd: '/help',         desc: 'show all commands' },
  { cmd: '/index',        desc: 're-index current project' },
  { cmd: '/memory',       desc: 'show stored preferences' },
  { cmd: '/memory set',   desc: 'set a preference  e.g. /memory set tone casual' },
  { cmd: '/new',          desc: 'start a fresh session' },
  { cmd: '/providers',    desc: 'show all provider states' },
  { cmd: '/sequence',     desc: 'show priority sequences' },
  { cmd: '/status',       desc: 'show current provider status' }
]

function CommandPalette ({ query, onSelect, onClose }) {
  const [selected, setSelected] = React.useState(0)

  const filtered = query.length <= 1
    ? ALL_COMMANDS
    : ALL_COMMANDS.filter(c =>
        c.cmd.includes(query.slice(1)) ||
        c.desc.toLowerCase().includes(query.slice(1).toLowerCase())
      )

  useInput((input, key) => {
    if (key.escape) { onClose(); return }
    if (key.upArrow) {
      setSelected(s => Math.max(0, s - 1))
      return
    }
    if (key.downArrow) {
      setSelected(s => Math.min(filtered.length - 1, s + 1))
      return
    }
    if (key.return && filtered[selected]) {
      onSelect(filtered[selected].cmd)
    }
  })

  // Reset selection when filter changes
  React.useEffect(() => { setSelected(0) }, [query])

  if (filtered.length === 0) return null

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle:   'round',
    borderColor:   'gray',
    marginLeft:    2,
    marginRight:   2,
    marginBottom:  1
  },
    React.createElement(Box, { paddingLeft: 1 },
      React.createElement(Text, { color: 'gray' }, 'Commands — ↑↓ navigate  Enter select  Esc close')
    ),
    React.createElement(Box, { borderStyle: 'single', borderColor: 'gray' }),
    ...filtered.slice(0, 10).map((item, i) =>
      React.createElement(Box, {
        key:        item.cmd,
        paddingLeft: 1,
        paddingRight: 1,
        backgroundColor: i === selected ? 'gray' : undefined
      },
        React.createElement(Text, {
          color: i === selected ? 'white' : 'green',
          bold:  i === selected
        }, item.cmd.padEnd(18)),
        React.createElement(Text, {
          color: i === selected ? 'white' : 'gray'
        }, item.desc)
      )
    )
  )
}

module.exports = { CommandPalette, ALL_COMMANDS }
