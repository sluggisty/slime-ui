import React, { useState } from 'react'
import { useError, useErrorBoundary } from '../contexts/ErrorContext'
import { ErrorSeverity, ErrorCategory } from '../utils/errorHandler'

/**
 * Example component demonstrating error context usage
 */
export const ErrorExample: React.FC = () => {
  const {
    addError,
    addNetworkError,
    addAuthError,
    messages,
    clearMessages,
    stats,
    isLoading
  } = useError()

  const { captureError } = useErrorBoundary()
  const [testType, setTestType] = useState<string>('')

  const triggerDifferentErrors = async () => {
    switch (testType) {
      case 'manual':
        addError(
          new Error('This is a manual error'),
          ErrorCategory.RUNTIME,
          ErrorSeverity.MEDIUM
        )
        break

      case 'network':
        // Simulate a network error
        try {
          await fetch('/api/nonexistent-endpoint')
        } catch (error) {
          addNetworkError(error as Error, '/api/nonexistent-endpoint', 'GET', 404)
        }
        break

      case 'auth':
        addAuthError(new Error('Session expired'))
        break

      case 'component':
        // Trigger a component error that will be caught by error boundary
        throw new Error('Component error example')

      case 'async':
        // Simulate an async error
        setTimeout(() => {
          captureError(new Error('Async component error'))
        }, 1000)
        break

      default:
        addError(
          new Error('Unknown test type'),
          ErrorCategory.UNKNOWN,
          ErrorSeverity.LOW
        )
    }
  }

  return (
    <div style={{ padding: '2rem', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>Error Handling Examples</h3>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          <strong>Test Type:</strong>
          <select
            value={testType}
            onChange={(e) => setTestType(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="">Select test type...</option>
            <option value="manual">Manual Error</option>
            <option value="network">Network Error</option>
            <option value="auth">Auth Error</option>
            <option value="component">Component Error</option>
            <option value="async">Async Error</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={triggerDifferentErrors}
          disabled={!testType || isLoading}
          style={{ marginRight: '0.5rem' }}
        >
          {isLoading ? 'Processing...' : 'Trigger Error'}
        </button>

        <button onClick={clearMessages} disabled={messages.length === 0}>
          Clear Messages ({messages.length})
        </button>
      </div>

      {/* Error Messages Display */}
      {messages.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4>Current Error Messages:</h4>
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                padding: '0.5rem',
                marginBottom: '0.5rem',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                backgroundColor: '#fff3cd'
              }}
            >
              <strong>{message.title}</strong>: {message.message}
              {message.action && (
                <span style={{ marginLeft: '0.5rem', fontStyle: 'italic' }}>
                  ({message.action})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error Statistics */}
      <div style={{ marginBottom: '1rem' }}>
        <h4>Error Statistics:</h4>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          <div>Total Errors: {stats.total}</div>
          <div>Recent Errors (24h): {stats.recent}</div>
          <div>
            By Severity:
            <span style={{ color: '#dc3545', marginLeft: '0.5rem' }}>
              Critical: {stats.bySeverity[ErrorSeverity.CRITICAL] || 0}
            </span>
            <span style={{ color: '#fd7e14', marginLeft: '0.5rem' }}>
              High: {stats.bySeverity[ErrorSeverity.HIGH] || 0}
            </span>
            <span style={{ color: '#ffc107', marginLeft: '0.5rem' }}>
              Medium: {stats.bySeverity[ErrorSeverity.MEDIUM] || 0}
            </span>
            <span style={{ color: '#17a2b8', marginLeft: '0.5rem' }}>
              Low: {stats.bySeverity[ErrorSeverity.LOW] || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{ fontSize: '0.9rem', color: '#666', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        <h4>How to use the Error Context:</h4>
        <ul>
          <li><strong>Manual Errors:</strong> Use <code>addError()</code> for custom errors</li>
          <li><strong>Network Errors:</strong> Use <code>addNetworkError()</code> for API failures</li>
          <li><strong>Auth Errors:</strong> Use <code>addAuthError()</code> for authentication issues</li>
          <li><strong>Component Errors:</strong> Use <code>useErrorBoundary()</code> hook</li>
          <li><strong>Statistics:</strong> Access error stats via the context</li>
        </ul>

        <p>
          <strong>Note:</strong> Component and async errors will be caught by error boundaries.
          Check the browser console and error notifications for details.
        </p>
      </div>
    </div>
  )
}

export default ErrorExample
