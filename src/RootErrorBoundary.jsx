import React from 'react'

/** Catches render errors so a blank window becomes a readable failure surface. */
export default class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const err = this.state.error
      return (
        <div
          style={{
            padding: 28,
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 720,
            margin: '0 auto',
          }}
        >
          <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>
            Note App could not start
          </h1>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13,
              lineHeight: 1.45,
              color: '#8b1538',
              background: 'rgba(0,0,0,0.04)',
              padding: 12,
              borderRadius: 8,
            }}
          >
            {err?.message || String(err)}
            {err?.stack ? `\n\n${err.stack}` : ''}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
