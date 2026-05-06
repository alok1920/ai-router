'use strict'

const React  = require('react')
const { Box, Text } = require('ink')

function ChatPanel ({ messages, terminalHeight }) {
  // Reserve lines: status bar(1) + input bar(3) + border(2) + padding(2)
  const reservedLines = 8
  const availableLines = Math.max(4, terminalHeight - reservedLines)

  // Estimate how many messages fit — each message takes ~3 lines average
  const visibleMessages = getVisibleMessages(messages, availableLines)

  if (visibleMessages.length === 0) {
    return React.createElement(Box, {
      flexDirection: 'column',
      paddingLeft: 2,
      paddingTop: 1,
      flexGrow: 1
    },
      React.createElement(Text, { color: 'gray', dimColor: true },
        'No messages yet. Start typing below.'
      )
    )
  }

  return React.createElement(Box, {
    flexDirection: 'column',
    paddingLeft:   2,
    paddingRight:  2,
    paddingTop:    1,
    flexGrow:      1,
    overflowY:     'hidden'
  },
    ...visibleMessages.map((msg, i) =>
      React.createElement(MessageBubble, { key: i, message: msg })
    )
  )
}

function MessageBubble ({ message }) {
  const isUser = message.role === 'user'

  return React.createElement(Box, {
    flexDirection: 'column',
    marginBottom:  1
  },
    // Role label
    React.createElement(Box, null,
      React.createElement(Text, {
        color: isUser ? 'cyan' : 'green',
        bold:  true
      },
        isUser ? 'You' : message.provider || 'AI'
      ),
      message.timestamp
        ? React.createElement(Text, { color: 'gray', dimColor: true },
            '  ' + message.timestamp
          )
        : null
    ),
    // Message content — wrap long lines
    ...wrapText(message.content, 76).map((line, i) =>
      React.createElement(Text, { key: i, wrap: 'wrap' },
        '  ' + line
      )
    )
  )
}

// Simple text wrapper
function wrapText (text, maxWidth) {
  const lines = text.split('\n')
  const result = []
  for (const line of lines) {
    if (line.length <= maxWidth) {
      result.push(line)
    } else {
      // Split long lines
      let remaining = line
      while (remaining.length > maxWidth) {
        result.push(remaining.slice(0, maxWidth))
        remaining = remaining.slice(maxWidth)
      }
      if (remaining) result.push(remaining)
    }
  }
  return result
}

// Return the last N messages that fit in available lines
function getVisibleMessages (messages, availableLines) {
  if (messages.length === 0) return []

  let linesUsed = 0
  const result  = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg       = messages[i]
    const textLines = wrapText(msg.content || '', 76)
    const msgLines  = 1 + textLines.length + 1 // label + content + margin

    if (linesUsed + msgLines > availableLines && result.length > 0) break
    result.unshift(msg)
    linesUsed += msgLines
  }

  return result
}

module.exports = { ChatPanel }
