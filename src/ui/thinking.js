'use strict'

const React  = require('react')
const { Text, Box } = require('ink')

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function Thinking ({ provider }) {
  const [frame, setFrame] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return React.createElement(Box, { paddingLeft: 2, paddingTop: 1 },
    React.createElement(Text, { color: 'green' }, FRAMES[frame] + ' '),
    React.createElement(Text, { color: 'gray' },
      provider ? `Asking ${provider}...` : 'Thinking...'
    )
  )
}

module.exports = { Thinking }
