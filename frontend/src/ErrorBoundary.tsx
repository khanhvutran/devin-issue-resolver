import React from 'react'
import { Heading, Text, Button, Flash } from '@primer/react'

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
          <Flash variant="danger" style={{ maxWidth: 600, width: '100%' }}>
            <Heading as="h2" style={{ marginBottom: '0.5rem' }}>Something went wrong</Heading>
            <Text as="p" style={{ marginBottom: '1rem' }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </Text>
            <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}>
              Try Again
            </Button>
          </Flash>
        </div>
      )
    }

    return this.props.children
  }
}
