import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ErrorFallback } from './ErrorFallback'
import { errorLogger } from '../utils/errorLogger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: React.ComponentType<ErrorFallbackProps>
  onError?: (error: Error, errorInfo: ErrorInfo, context?: ErrorContext) => void
  resetOnPropsChange?: boolean
  resetKeys?: Array<string | number>
  level?: 'global' | 'route' | 'component'
  context?: ErrorContext
  enableRetry?: boolean
  maxRetries?: number
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
  lastErrorTime: number | null
}

export interface ErrorContext {
  componentStack?: string
  userId?: string
  route?: string
  userAgent?: string
  timestamp: number
  sessionId?: string
  retryCount?: number
}

export interface ErrorFallbackProps {
  error: Error
  errorInfo?: ErrorInfo
  context?: ErrorContext
  onRetry?: () => void
  onReport?: () => void
  onReset?: () => void
  canRetry?: boolean
  level?: 'global' | 'route' | 'component'
}

/**
 * React Error Boundary component that catches JavaScript errors anywhere in the
 * component tree, logs those errors, and displays a fallback UI.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastErrorTime: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error info
    this.setState({
      errorInfo,
      retryCount: this.state.retryCount + 1
    })

    // Create error context
    const context: ErrorContext = {
      componentStack: errorInfo.componentStack,
      userId: this.getCurrentUserId(),
      route: this.getCurrentRoute(),
      userAgent: navigator?.userAgent,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      retryCount: this.state.retryCount + 1,
      ...this.props.context
    }

    // Log the error using the error logger
    errorLogger.logError(error, errorInfo, context)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, context)
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state if resetKeys have changed
    if (this.props.resetOnPropsChange && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some((key, index) => {
        return prevProps.resetKeys?.[index] !== key
      })

      if (hasResetKeyChanged) {
        this.resetError()
      }
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  /**
   * Reset the error boundary to its initial state
   */
  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastErrorTime: null
    })
  }

  /**
   * Attempt to retry rendering the component
   */
  retry = () => {
    const { maxRetries = 3 } = this.props
    const { retryCount } = this.state

    if (retryCount >= maxRetries) {
      console.warn('Maximum retry attempts reached')
      return
    }

    // Add exponential backoff delay
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Max 10 seconds

    this.retryTimeoutId = setTimeout(() => {
      console.log(`Retrying component render (attempt ${retryCount + 1})`)
      this.resetError()
    }, delay)
  }


  /**
   * Get current user ID from auth context
   */
  private getCurrentUserId(): string | undefined {
    // This would typically come from your auth context/store
    // For now, return undefined
    return undefined
  }

  /**
   * Get current route for context
   */
  private getCurrentRoute(): string | undefined {
    if (typeof window !== 'undefined') {
      return window.location.pathname
    }
    return undefined
  }

  /**
   * Get session ID for tracking
   */
  private getSessionId(): string | undefined {
    // This would typically come from your session management
    // For now, generate a simple session ID
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('session_id')
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        sessionStorage.setItem('session_id', sessionId)
      }
      return sessionId
    }
    return undefined
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || ErrorFallback

      const context: ErrorContext = {
        componentStack: this.state.errorInfo?.componentStack,
        userId: this.getCurrentUserId(),
        route: this.getCurrentRoute(),
        userAgent: navigator?.userAgent,
        timestamp: this.state.lastErrorTime || Date.now(),
        sessionId: this.getSessionId(),
        retryCount: this.state.retryCount,
        ...this.props.context
      }

      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo || undefined}
          context={context}
          onRetry={this.props.enableRetry ? this.retry : undefined}
          onReset={this.resetError}
          onReport={this.reportError}
          canRetry={this.props.enableRetry && this.state.retryCount < (this.props.maxRetries || 3)}
          level={this.props.level}
        />
      )
    }

    return this.props.children
  }

  /**
   * Report error to external service
   */
  private reportError = async () => {
    if (!this.state.error) return

    try {
      const success = await errorLogger.reportError(
        this.state.error,
        this.state.errorInfo || undefined,
        {
          componentStack: this.state.errorInfo?.componentStack,
          userId: this.getCurrentUserId(),
          route: this.getCurrentRoute(),
          userAgent: navigator?.userAgent,
          timestamp: this.state.lastErrorTime || Date.now(),
          sessionId: this.getSessionId(),
          retryCount: this.state.retryCount,
          ...this.props.context
        }
      )

      if (success) {
        alert('Error report has been sent. Thank you for helping us improve!')
      } else {
        alert('Failed to send error report. Please try again later.')
      }
    } catch (reportError) {
      console.error('Error reporting failed:', reportError)
      alert('Failed to send error report. Please check your connection and try again.')
    }
  }
}

export default ErrorBoundary
