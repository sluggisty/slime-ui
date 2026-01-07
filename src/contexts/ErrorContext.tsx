import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { errorHandler, UserFriendlyMessage, ErrorSeverity, ErrorCategory } from '../utils/errorHandler'

// Error context state
interface ErrorState {
  messages: UserFriendlyMessage[]
  isLoading: boolean
  lastError?: {
    message: UserFriendlyMessage
    timestamp: number
  }
  stats: {
    total: number
    recent: number
    bySeverity: Record<ErrorSeverity, number>
    byCategory: Record<ErrorCategory, number>
  }
}

// Error context actions
type ErrorAction =
  | { type: 'ADD_MESSAGE'; payload: UserFriendlyMessage }
  | { type: 'REMOVE_MESSAGE'; payload: number }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'UPDATE_STATS'; payload: ErrorState['stats'] }
  | { type: 'SET_LAST_ERROR'; payload: UserFriendlyMessage }

// Error context methods
interface ErrorContextValue extends ErrorState {
  addError: (error: Error | string, category?: ErrorCategory, severity?: ErrorSeverity) => void
  addNetworkError: (error: Error, url?: string, method?: string, status?: number) => void
  addAuthError: (error: Error) => void
  removeMessage: (index: number) => void
  clearMessages: () => void
  dismissLastError: () => void
  refreshStats: () => void
}

// Create the context
const ErrorContext = createContext<ErrorContextValue | undefined>(undefined)

// Initial state
const initialState: ErrorState = {
  messages: [],
  isLoading: false,
  stats: {
    total: 0,
    recent: 0,
    bySeverity: {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    },
    byCategory: {
      [ErrorCategory.NETWORK]: 0,
      [ErrorCategory.AUTHENTICATION]: 0,
      [ErrorCategory.AUTHORIZATION]: 0,
      [ErrorCategory.VALIDATION]: 0,
      [ErrorCategory.RUNTIME]: 0,
      [ErrorCategory.RESOURCE]: 0,
      [ErrorCategory.THIRD_PARTY]: 0,
      [ErrorCategory.UNKNOWN]: 0
    }
  }
}

// Reducer function
function errorReducer(state: ErrorState, action: ErrorAction): ErrorState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        lastError: {
          message: action.payload,
          timestamp: Date.now()
        }
      }

    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter((_, index) => index !== action.payload)
      }

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
        lastError: undefined
      }

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      }

    case 'UPDATE_STATS':
      return {
        ...state,
        stats: action.payload
      }

    case 'SET_LAST_ERROR':
      return {
        ...state,
        lastError: {
          message: action.payload,
          timestamp: Date.now()
        }
      }

    default:
      return state
  }
}

// Error Provider component
interface ErrorProviderProps {
  children: ReactNode
  maxMessages?: number
  autoDismissMs?: number
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({
  children,
  maxMessages = 5,
  autoDismissMs = 10000 // 10 seconds
}) => {
  const [state, dispatch] = useReducer(errorReducer, initialState)

  // Initialize error handler on mount
  useEffect(() => {
    errorHandler.initialize()

    // Load initial stats
    refreshStats()

    // Cleanup on unmount
    return () => {
      errorHandler.destroy()
    }
  }, [])

  // Refresh stats periodically
  useEffect(() => {
    const interval = setInterval(refreshStats, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Auto-dismiss messages
  useEffect(() => {
    if (autoDismissMs > 0 && state.messages.length > 0) {
      const timer = setTimeout(() => {
        dispatch({ type: 'REMOVE_MESSAGE', payload: 0 })
      }, autoDismissMs)

      return () => clearTimeout(timer)
    }
  }, [state.messages, autoDismissMs])

  // Limit messages
  useEffect(() => {
    if (state.messages.length > maxMessages) {
      dispatch({ type: 'REMOVE_MESSAGE', payload: 0 })
    }
  }, [state.messages.length, maxMessages])

  // Context methods
  const addError = React.useCallback(async (
    error: Error | string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ) => {
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      await errorHandler.handleError(error, { category, severity })

      // Get new messages from handler
      const messages = errorHandler.getUserMessages()
      messages.forEach(message => {
        dispatch({ type: 'ADD_MESSAGE', payload: message })
      })

      // Clear the handler's queue
      errorHandler.clearUserMessages()
    } catch (handlerError) {
      console.error('Failed to handle error:', handlerError)
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const addNetworkError = React.useCallback(async (
    error: Error,
    url?: string,
    method?: string,
    status?: number
  ) => {
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      await errorHandler.handleNetworkError(error, url, method, status)

      // Get new messages from handler
      const messages = errorHandler.getUserMessages()
      messages.forEach(message => {
        dispatch({ type: 'ADD_MESSAGE', payload: message })
      })

      errorHandler.clearUserMessages()
    } catch (handlerError) {
      console.error('Failed to handle network error:', handlerError)
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const addAuthError = React.useCallback(async (error: Error) => {
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      await errorHandler.handleAuthError(error)

      // Get new messages from handler
      const messages = errorHandler.getUserMessages()
      messages.forEach(message => {
        dispatch({ type: 'ADD_MESSAGE', payload: message })
      })

      errorHandler.clearUserMessages()
    } catch (handlerError) {
      console.error('Failed to handle auth error:', handlerError)
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const removeMessage = React.useCallback((index: number) => {
    dispatch({ type: 'REMOVE_MESSAGE', payload: index })
  }, [])

  const clearMessages = React.useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' })
  }, [])

  const dismissLastError = React.useCallback(() => {
    dispatch({ type: 'SET_LAST_ERROR', payload: state.lastError!.message })
  }, [state.lastError])

  const refreshStats = React.useCallback(() => {
    const stats = errorHandler.getStats()
    dispatch({ type: 'UPDATE_STATS', payload: stats })
  }, [])

  const contextValue: ErrorContextValue = {
    ...state,
    addError,
    addNetworkError,
    addAuthError,
    removeMessage,
    clearMessages,
    dismissLastError,
    refreshStats
  }

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
    </ErrorContext.Provider>
  )
}

// Hook to use the error context
export const useError = (): ErrorContextValue => {
  const context = useContext(ErrorContext)
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}

// Hook for error boundary integration
export const useErrorBoundary = () => {
  const { addError } = useError()

  return {
    captureError: (error: Error, errorInfo?: React.ErrorInfo) => {
      addError(error, ErrorCategory.RUNTIME, ErrorSeverity.HIGH)
    }
  }
}

// Error notification component
export const ErrorNotifications: React.FC = () => {
  const { messages, removeMessage } = useError()

  if (messages.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        maxWidth: '400px'
      }}
    >
      {messages.map((message, index) => (
        <ErrorNotification
          key={`${message.timestamp || index}`}
          message={message}
          onClose={() => removeMessage(index)}
        />
      ))}
    </div>
  )
}

// Individual error notification
interface ErrorNotificationProps {
  message: UserFriendlyMessage
  onClose: () => void
}

const ErrorNotification: React.FC<ErrorNotificationProps> = ({ message, onClose }) => {
  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return '#dc3545'
      case ErrorSeverity.HIGH:
        return '#fd7e14'
      case ErrorSeverity.MEDIUM:
        return '#ffc107'
      case ErrorSeverity.LOW:
        return '#17a2b8'
      default:
        return '#6c757d'
    }
  }

  return (
    <div
      style={{
        background: 'white',
        border: `2px solid ${getSeverityColor(message.severity)}`,
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}
    >
      <div
        style={{
          color: getSeverityColor(message.severity),
          fontSize: '20px',
          flexShrink: 0
        }}
      >
        {message.severity === ErrorSeverity.CRITICAL ? '🚨' :
         message.severity === ErrorSeverity.HIGH ? '⚠️' :
         message.severity === ErrorSeverity.MEDIUM ? 'ℹ️' : '💡'}
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>
          {message.title}
        </h4>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
          {message.message}
        </p>
        {message.action && (
          <button
            style={{
              background: getSeverityColor(message.severity),
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {message.action}
          </button>
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer',
          color: '#999',
          flexShrink: 0
        }}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  )
}
