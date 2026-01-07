import type { ErrorInfo } from 'react'
import type { ErrorContext } from '../components/ErrorBoundary'

export interface ErrorLog {
  id: string
  timestamp: number
  level: 'error' | 'warning' | 'info'
  message: string
  error?: Error
  errorInfo?: ErrorInfo
  context?: ErrorContext
  userId?: string
  sessionId?: string
  url?: string
  userAgent?: string
  resolved?: boolean
  retryCount?: number
}

export interface ErrorReport {
  error: {
    name: string
    message: string
    stack?: string
  }
  context: {
    timestamp: number
    url: string
    userAgent: string
    sessionId?: string
    userId?: string
    level?: string
    retryCount?: number
    route?: string
    componentStack?: string
  }
  metadata: {
    appVersion: string
    environment: string
    buildId?: string
  }
}

/**
 * Error logging and reporting utility
 */
class ErrorLogger {
  private logs: ErrorLog[] = []
  private maxLogs = 100
  private sessionId: string

  constructor() {
    this.sessionId = this.generateSessionId()
    this.loadPersistedLogs()
  }

  /**
   * Log an error with context
   */
  logError(
    error: Error,
    errorInfo?: ErrorInfo,
    context?: ErrorContext,
    level: 'error' | 'warning' | 'info' = 'error'
  ): string {
    const errorLog: ErrorLog = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      message: error.message,
      error,
      errorInfo,
      context,
      userId: context?.userId,
      sessionId: context?.sessionId || this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: context?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      retryCount: context?.retryCount
    }

    // Add to logs array
    this.logs.unshift(errorLog)

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    // Persist logs
    this.persistLogs()

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 ${level.toUpperCase()}: ${error.message}`)
      console.error('Error:', error)
      if (errorInfo) console.error('Error Info:', errorInfo)
      if (context) console.error('Context:', context)
      console.groupEnd()
    }

    return errorLog.id
  }

  /**
   * Report error to external service
   */
  async reportError(
    error: Error,
    errorInfo?: ErrorInfo,
    context?: ErrorContext
  ): Promise<boolean> {
    const errorReport: ErrorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context: {
        timestamp: Date.now(),
        url: window?.location?.href || '',
        userAgent: navigator?.userAgent || '',
        sessionId: context?.sessionId || this.sessionId,
        userId: context?.userId,
        level: context ? 'component' : 'global',
        retryCount: context?.retryCount,
        route: context?.route,
        componentStack: errorInfo?.componentStack
      },
      metadata: {
        appVersion: process.env.VITE_APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        buildId: process.env.VITE_BUILD_ID
      }
    }

    try {
      // In development, just log to console
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Error Report:', errorReport)
        return true
      }

      // In production, send to error reporting service
      const response = await this.sendToErrorService(errorReport)

      if (response.ok) {
        console.log('✅ Error report sent successfully')
        return true
      } else {
        console.error('❌ Failed to send error report:', response.statusText)
        return false
      }
    } catch (reportError) {
      console.error('❌ Error reporting failed:', reportError)
      return false
    }
  }

  /**
   * Get all logged errors
   */
  getLogs(): ErrorLog[] {
    return [...this.logs]
  }

  /**
   * Get logs for current session
   */
  getSessionLogs(): ErrorLog[] {
    return this.logs.filter(log => log.sessionId === this.sessionId)
  }

  /**
   * Mark error as resolved
   */
  markResolved(errorId: string): boolean {
    const log = this.logs.find(l => l.id === errorId)
    if (log) {
      log.resolved = true
      this.persistLogs()
      return true
    }
    return false
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = []
    this.persistLogs()
  }

  /**
   * Clear session logs
   */
  clearSessionLogs(): void {
    this.logs = this.logs.filter(log => log.sessionId !== this.sessionId)
    this.persistLogs()
  }

  /**
   * Send error report to external service
   */
  private async sendToErrorService(errorReport: ErrorReport): Promise<Response> {
    // This would be your error reporting service endpoint
    // Examples: Sentry, LogRocket, Bugsnag, etc.

    const errorServiceUrl = process.env.VITE_ERROR_REPORTING_URL

    if (!errorServiceUrl) {
      throw new Error('Error reporting URL not configured')
    }

    return fetch(errorServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
        // 'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(errorReport)
    })
  }

  /**
   * Generate unique ID for error log
   */
  private generateId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('error_session_id')
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        sessionStorage.setItem('error_session_id', sessionId)
      }
      return sessionId
    }
    return `server_${Date.now()}`
  }

  /**
   * Persist logs to localStorage
   */
  private persistLogs(): void {
    if (typeof window !== 'undefined') {
      try {
        const logsToPersist = this.logs.slice(0, 50) // Only persist recent logs
        localStorage.setItem('error_logs', JSON.stringify(logsToPersist))
      } catch (e) {
        // localStorage might be full or unavailable
        console.warn('Failed to persist error logs:', e)
      }
    }
  }

  /**
   * Load persisted logs from localStorage
   */
  private loadPersistedLogs(): void {
    if (typeof window !== 'undefined') {
      try {
        const persistedLogs = localStorage.getItem('error_logs')
        if (persistedLogs) {
          const parsedLogs = JSON.parse(persistedLogs)
          // Only keep logs from last 24 hours
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
          this.logs = parsedLogs.filter((log: ErrorLog) => log.timestamp > oneDayAgo)
        }
      } catch (e) {
        console.warn('Failed to load persisted error logs:', e)
      }
    }
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  /**
   * Get error statistics
   */
  getStats() {
    const sessionLogs = this.getSessionLogs()
    return {
      total: this.logs.length,
      session: sessionLogs.length,
      unresolved: sessionLogs.filter(log => !log.resolved).length,
      byLevel: {
        error: sessionLogs.filter(log => log.level === 'error').length,
        warning: sessionLogs.filter(log => log.level === 'warning').length,
        info: sessionLogs.filter(log => log.level === 'info').length
      }
    }
  }
}

// Global error logger instance
export const errorLogger = new ErrorLogger()

// Convenience functions
export const logError = (error: Error, errorInfo?: ErrorInfo, context?: ErrorContext) =>
  errorLogger.logError(error, errorInfo, context)

export const reportError = (error: Error, errorInfo?: ErrorInfo, context?: ErrorContext) =>
  errorLogger.reportError(error, errorInfo, context)

export default errorLogger
