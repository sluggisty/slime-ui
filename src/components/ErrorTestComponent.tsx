import React, { useState } from 'react'
import { useAsyncWithRecovery } from '../hooks/useErrorRecovery'
import { api } from '../api/client'

/**
 * Test component for demonstrating error boundaries and recovery
 * This component intentionally creates various error scenarios
 */
export const ErrorTestComponent: React.FC = () => {
  const [errorType, setErrorType] = useState<string>('none')
  const [shouldThrow, setShouldThrow] = useState(false)

  // Simulate an async operation that can fail
  const { data, loading, error, execute, retry, hasError, canRetry } = useAsyncWithRecovery(
    async () => {
      // Simulate different types of failures
      switch (errorType) {
        case 'network':
          throw new Error('Network request failed')
        case 'auth':
          throw new Error('Authentication failed')
        case 'server':
          throw new Error('Internal server error')
        case 'timeout':
          await new Promise(resolve => setTimeout(resolve, 100))
          throw new Error('Request timeout')
        default:
          return { message: 'Success!', timestamp: new Date().toISOString() }
      }
    },
    {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      context: 'error-test-component'
    }
  )

  // Throw synchronous error if requested
  if (shouldThrow) {
    if (errorType === 'render') {
      throw new Error('Render error: Component failed to render')
    }
    if (errorType === 'reference') {
      // @ts-ignore - intentionally cause a reference error
      nonexistentVariable.access.undefined
    }
    if (errorType === 'type') {
      throw new TypeError('Type error: Invalid type operation')
    }
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>Error Boundary Test Component</h3>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          <strong>Error Type:</strong>
          <select
            value={errorType}
            onChange={(e) => setErrorType(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="none">None</option>
            <option value="network">Network Error</option>
            <option value="auth">Auth Error</option>
            <option value="server">Server Error</option>
            <option value="timeout">Timeout Error</option>
            <option value="render">Render Error</option>
            <option value="reference">Reference Error</option>
            <option value="type">Type Error</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={execute}
          disabled={loading}
          style={{ marginRight: '0.5rem' }}
        >
          {loading ? 'Loading...' : 'Execute Operation'}
        </button>

        {hasError && canRetry && (
          <button onClick={retry} style={{ marginRight: '0.5rem' }}>
            Retry
          </button>
        )}

        <button
          onClick={() => setShouldThrow(true)}
          style={{ backgroundColor: '#dc3545', color: 'white' }}
        >
          Trigger Sync Error
        </button>
      </div>

      {data && (
        <div style={{
          padding: '0.5rem',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <strong>Success:</strong> {JSON.stringify(data)}
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.5rem',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <strong>Error:</strong> {error.message}
          {canRetry && <div>Will retry automatically...</div>}
        </div>
      )}

      <div style={{ fontSize: '0.8rem', color: '#666' }}>
        <p>This component demonstrates various error scenarios:</p>
        <ul>
          <li><strong>Network/Auth/Server Errors:</strong> Async operation failures with automatic retry</li>
          <li><strong>Render/Reference/Type Errors:</strong> Synchronous errors caught by error boundaries</li>
          <li><strong>Error Recovery:</strong> Automatic retry with exponential backoff</li>
        </ul>
      </div>
    </div>
  )
}

export default ErrorTestComponent
